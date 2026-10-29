// Tarjeta de fidelidad dentro del panel: diseño, promociones, mensajes, visitas, clientes y reportes.
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, writeBatch,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, resolveMedia } from './firebase.js';
import { renderCard, hydrateCard, normalizePhone, firstName, fillMessage } from './loyalty-card.js';
import { safeUrl } from './util.js';

const resolveSrc = (src) => Promise.resolve(src?.startsWith('media:') ? resolveMedia(src) : safeUrl(src));
const fmtDate = (d) => (d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const toDate = (ts) => ts?.toDate?.() || null;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysSince = (d) => (d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null);

const PRESETS = [
  { name: 'Negro y dorado', bg: '#121214', fg: '#f5f1ea', label: '#c9a45c', accent: '#c9a45c' },
  { name: 'Sakura', bg: '#2a1520', fg: '#fff2f5', label: '#f4a7bb', accent: '#ff8fab' },
  { name: 'Matcha', bg: '#14211a', fg: '#eef5ea', label: '#a8c686', accent: '#b5d98a' },
  { name: 'Océano', bg: '#0e1b2c', fg: '#eef4fb', label: '#8fb8de', accent: '#5fb3ff' },
  { name: 'Rojo shoku', bg: '#5b0f14', fg: '#fff5ef', label: '#f2c48d', accent: '#ffd28a' },
  { name: 'Minimal claro', bg: '#f6f2ea', fg: '#1b1b1d', label: '#9a7a3c', accent: '#b8862f' }
];
const EMOJIS = ['🍣', '🍱', '🍙', '🥢', '🍤', '⭐', '❤️', '🔥', '🎌', '🌸'];

export function createLoyalty(ctx) {
  const { h, bound, field, toggle, iconBtn, toast, picker, changed, render, go } = ctx;
  let customers = null; // caché de la lista de clientes
  let selected = null; // { id, data, history }

  /* ==================== Datos de clientes ==================== */

  async function loadCustomers(force = false) {
    if (customers && !force) return customers;
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(2000)));
    customers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return customers;
  }

  async function openCustomer(id) {
    const snap = await getDoc(doc(db, 'customers', id));
    if (!snap.exists()) { toast('No se encontró esa tarjeta.', 'error'); return; }
    const hist = await getDocs(query(collection(db, 'visits'), where('cardId', '==', id)));
    selected = {
      id,
      data: snap.data(),
      history: hist.docs.map((d) => d.data()).sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0))
    };
    go({ type: 'loy-visit' });
  }

  // Suma un sello. Al completar la tarjeta se reinician los sellos y se acumula una recompensa.
  async function addStamp() {
    const loy = ctx.getLoy();
    const required = Math.max(1, Number(loy.card.stampsRequired) || 8);
    const last = toDate(selected.data.lastVisit);
    if (last && Date.now() - last.getTime() < 3 * 3600 * 1000 &&
      !confirm(`Este cliente ya recibió un sello hace ${Math.round((Date.now() - last.getTime()) / 60000)} minutos. ¿Dar otro sello?`)) return;
    const id = selected.id;
    const result = await runTransaction(db, async (tx) => {
      const ref = doc(db, 'customers', id);
      const cur = (await tx.get(ref)).data();
      let stamps = (cur.stamps || 0) + 1;
      let completed = false;
      let available = cur.rewardsAvailable || 0;
      let earned = cur.rewardsEarned || 0;
      if (stamps >= required) { stamps -= required; available += 1; earned += 1; completed = true; }
      const now = serverTimestamp();
      tx.update(ref, { stamps, visits: (cur.visits || 0) + 1, rewardsAvailable: available, rewardsEarned: earned, lastVisit: now });
      tx.update(doc(db, 'cards', id), { stamps, rewardsAvailable: available, updatedAt: now });
      tx.set(doc(collection(db, 'visits')), {
        cardId: id, name: cur.name, type: 'sello', stampsAfter: stamps, completed, at: now, by: ctx.userEmail()
      });
      return { completed, stamps };
    });
    toast(result.completed ? `🎉 ¡Tarjeta completa! ${selected.data.name} ganó: ${loy.card.rewardText}` : `Sello agregado (${result.stamps}/${required}).`, 'ok');
    customers = null;
    await openCustomer(id);
  }

  async function redeem() {
    const loy = ctx.getLoy();
    if (!confirm(`¿Entregar la recompensa "${loy.card.rewardText}" a ${selected.data.name}?`)) return;
    const id = selected.id;
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'customers', id);
      const cur = (await tx.get(ref)).data();
      if ((cur.rewardsAvailable || 0) < 1) throw new Error('Este cliente no tiene recompensas disponibles.');
      const available = cur.rewardsAvailable - 1;
      const now = serverTimestamp();
      tx.update(ref, { rewardsAvailable: available, rewardsRedeemed: (cur.rewardsRedeemed || 0) + 1 });
      tx.update(doc(db, 'cards', id), { rewardsAvailable: available, updatedAt: now });
      tx.set(doc(collection(db, 'visits')), { cardId: id, name: cur.name, type: 'canje', reward: loy.card.rewardText, at: now, by: ctx.userEmail() });
    }).catch((err) => { toast(err.message, 'error'); throw err; });
    toast('Recompensa entregada ✅', 'ok');
    customers = null;
    await openCustomer(id);
  }

  async function adjustStamps() {
    const loy = ctx.getLoy();
    const v = prompt(`Corregir sellos de ${selected.data.name} (0 a ${loy.card.stampsRequired - 1}):`, selected.data.stamps || 0);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n >= loy.card.stampsRequired) { toast('Número de sellos no válido.', 'error'); return; }
    const batch = writeBatch(db);
    batch.update(doc(db, 'customers', selected.id), { stamps: n });
    batch.update(doc(db, 'cards', selected.id), { stamps: n, updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, 'visits')), { cardId: selected.id, name: selected.data.name, type: 'ajuste', stampsAfter: n, at: serverTimestamp(), by: ctx.userEmail() });
    await batch.commit();
    toast('Sellos corregidos.', 'ok');
    customers = null;
    await openCustomer(selected.id);
  }

  async function deleteCustomer() {
    if (!confirm(`¿Eliminar a ${selected.data.name} y su tarjeta? Esta acción no se puede deshacer.`)) return;
    const batch = writeBatch(db);
    batch.delete(doc(db, 'customers', selected.id));
    batch.delete(doc(db, 'cards', selected.id));
    batch.delete(doc(db, 'phones', selected.data.phone));
    await batch.commit();
    toast('Cliente eliminado.', 'ok');
    selected = null;
    customers = null;
    go({ type: 'loy-customers' });
  }

  async function search(term) {
    const t = term.trim();
    if (!t) return [];
    const phone = normalizePhone(t);
    if (phone.length === 10) {
      const p = await getDoc(doc(db, 'phones', phone));
      if (p.exists()) return [{ id: p.data().cardId }];
    }
    const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const list = await loadCustomers();
    const needle = norm(t);
    return list.filter((c) => norm(c.name).includes(needle) || c.phone.includes(t.replace(/\D/g, '')) || norm(c.email).includes(needle)).slice(0, 20);
  }

  /* ==================== Escáner QR ==================== */

  function extractId(text) {
    try { const u = new URL(text); return u.searchParams.get('c') || ''; } catch { return /^[A-Za-z0-9]{10,40}$/.test(text) ? text : ''; }
  }

  async function scan() {
    if (!navigator.mediaDevices?.getUserMedia) { toast('Este navegador no permite usar la cámara. Busca por teléfono.', 'error'); return; }
    let stream;
    let stop = false;
    const video = h('video', { playsinline: true, muted: true, class: 'scan__video' });
    const dlg = h('dialog', { class: 'scan', onclose: () => { stop = true; stream?.getTracks().forEach((t) => t.stop()); dlg.remove(); } },
      h('h3', { text: 'Escanea el QR de la tarjeta' }),
      h('div', { class: 'scan__frame' }, video, h('span', { class: 'scan__aim' })),
      h('button', { type: 'button', class: 'btn btn--block', onclick: () => dlg.close() }, 'Cancelar'));
    document.body.append(dlg);
    dlg.showModal();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      dlg.close();
      toast('No se pudo abrir la cámara. Revisa los permisos del navegador.', 'error');
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    let detect;
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats?.())?.includes('qr_code')) {
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      detect = async () => (await det.detect(video))[0]?.rawValue;
    } else {
      const { default: jsQR } = await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/+esm');
      const canvas = document.createElement('canvas');
      const c2d = canvas.getContext('2d', { willReadFrequently: true });
      detect = async () => {
        if (!video.videoWidth) return null;
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        c2d.drawImage(video, 0, 0);
        return jsQR(c2d.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)?.data;
      };
    }
    while (!stop) {
      const text = await detect().catch(() => null);
      const id = text && extractId(text);
      if (id) { navigator.vibrate?.(80); dlg.close(); await openCustomer(id); return; }
      await new Promise((r) => setTimeout(r, 180));
    }
  }

  /* ==================== Vista: registrar visita ==================== */

  function cardBox(loy, state) {
    const box = h('div', { class: 'loy-card' });
    box.innerHTML = renderCard(loy, state);
    hydrateCard(box, resolveSrc);
    return box;
  }

  function renderVisit() {
    const loy = ctx.getLoy();
    const results = h('div', { class: 'results' });
    let timer;
    const input = h('input', {
      type: 'search', placeholder: 'Teléfono, nombre o correo…', autocomplete: 'off',
      oninput: (e) => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const found = await search(e.target.value).catch((err) => { toast(err.message, 'error'); return []; });
          results.replaceChildren(...(await Promise.all(found.map(async (r) => {
            const c = r.name ? r : { id: r.id, ...(await getDoc(doc(db, 'customers', r.id))).data() };
            return h('button', { type: 'button', class: 'result', onclick: () => openCustomer(c.id) },
              h('strong', { text: c.name || '—' }), h('span', { text: `${c.phone || ''} · ${c.stamps ?? 0} sellos${c.rewardsAvailable ? ' · 🎁' : ''}` }));
          }))));
          if (!found.length && e.target.value.trim()) results.replaceChildren(h('p', { class: 'empty', text: 'Sin resultados.' }));
        }, 300);
      }
    });

    const out = [
      h('h2', { text: 'Registrar visita' }),
      h('p', { class: 'lead', text: 'Escanea el QR de la tarjeta del cliente o búscalo por teléfono para darle su sello o entregar su recompensa.' }),
      h('section', { class: 'card' },
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: scan }, '📷 Escanear tarjeta'),
          h('div', { style: 'flex:1;min-width:220px' }, input)),
        results)
    ];

    if (selected) {
      const c = selected.data;
      const required = loy.card.stampsRequired;
      out.push(h('section', { class: 'card loy-customer' },
        h('div', { class: 'loy-customer__grid' },
          cardBox(loy, { name: firstName(c.name), stamps: c.stamps, rewards: c.rewardsAvailable }),
          h('div', {},
            h('h3', { class: 'loy-name', text: c.name }),
            h('dl', { class: 'loy-dl' },
              h('dt', { text: 'Teléfono' }), h('dd', {}, h('a', { href: `tel:${c.phone}`, text: c.phone })),
              h('dt', { text: 'Correo' }), h('dd', { text: c.email || '—' }),
              h('dt', { text: 'Cumpleaños' }), h('dd', { text: c.birthday ? new Date(`${c.birthday}T12:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) : '—' }),
              h('dt', { text: 'Sellos' }), h('dd', { text: `${c.stamps || 0} de ${required}` }),
              h('dt', { text: 'Visitas totales' }), h('dd', { text: String(c.visits || 0) }),
              h('dt', { text: 'Recompensas' }), h('dd', { text: `${c.rewardsAvailable || 0} por canjear · ${c.rewardsRedeemed || 0} canjeadas` }),
              h('dt', { text: 'Última visita' }), h('dd', { text: fmtDateTime(toDate(c.lastVisit)) }),
              h('dt', { text: 'Registro' }), h('dd', { text: fmtDate(toDate(c.createdAt)) })),
            h('div', { class: 'row', style: 'margin-top:16px' },
              h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: () => addStamp().catch((e) => toast(e.message, 'error')) }, '+1 sello'),
              c.rewardsAvailable > 0 ? h('button', { type: 'button', class: 'btn btn--big btn--reward', onclick: () => redeem().catch(() => {}) }, `🎁 Entregar recompensa`) : null),
            h('div', { class: 'row', style: 'margin-top:10px' },
              h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: () => adjustStamps().catch((e) => toast(e.message, 'error')) }, 'Corregir sellos'),
              h('button', {
                type: 'button', class: 'btn btn--sm btn--ghost',
                onclick: async () => {
                  const url = new URL(`membresia.html?c=${selected.id}`, location.href).href;
                  try { await navigator.clipboard.writeText(url); toast('Enlace de la tarjeta copiado. Puedes mandárselo por WhatsApp.', 'ok'); } catch { prompt('Enlace de la tarjeta:', url); }
                }
              }, 'Copiar enlace de su tarjeta'),
              h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => deleteCustomer().catch((e) => toast(e.message, 'error')) }, 'Eliminar cliente')))),
        h('h3', { style: 'margin:22px 0 10px', text: 'Historial' }),
        selected.history.length
          ? h('ul', { class: 'history' }, selected.history.map((v) => h('li', {},
            h('span', { class: `pill pill--${v.type}`, text: v.type === 'sello' ? (v.completed ? 'Sello · completó' : 'Sello') : v.type === 'canje' ? 'Canje' : 'Ajuste' }),
            h('span', { text: fmtDateTime(toDate(v.at)) }),
            h('span', { class: 'muted', text: v.type === 'canje' ? v.reward : v.stampsAfter != null ? `${v.stampsAfter}/${required}` : '' }))))
          : h('p', { class: 'empty', text: 'Sin visitas todavía.' })));
    }
    return out;
  }

  /* ==================== Vista: clientes ==================== */

  function renderCustomers() {
    const wrap = h('div', {}, h('p', { class: 'empty', text: 'Cargando clientes…' }));
    let filter = '';
    const paint = () => {
      const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const list = customers.filter((c) => !filter || norm(`${c.name} ${c.phone} ${c.email}`).includes(norm(filter)));
      wrap.replaceChildren(
        h('p', { class: 'muted', style: 'margin-bottom:10px', text: `${list.length} cliente(s)` }),
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, ['Nombre', 'Teléfono', 'Sellos', 'Recompensas', 'Visitas', 'Última visita', 'Registro'].map((t) => h('th', { text: t })))),
          h('tbody', {}, list.map((c) => h('tr', { onclick: () => openCustomer(c.id) },
            h('td', {}, h('strong', { text: c.name })),
            h('td', { text: c.phone }),
            h('td', { text: String(c.stamps || 0) }),
            h('td', { text: c.rewardsAvailable ? `🎁 ${c.rewardsAvailable}` : '—' }),
            h('td', { text: String(c.visits || 0) }),
            h('td', { text: fmtDate(toDate(c.lastVisit)) }),
            h('td', { text: fmtDate(toDate(c.createdAt)) })))))));
    };
    loadCustomers().then(paint).catch((err) => wrap.replaceChildren(h('div', { class: 'notice notice--danger', text: `No se pudieron leer los clientes: ${err.message}. Revisa que hayas pegado las reglas nuevas de firestore.rules.` })));
    return [
      h('h2', { text: 'Clientes' }),
      h('p', { class: 'lead', text: 'Toca un cliente para ver su tarjeta, historial y darle sellos.' }),
      h('div', { class: 'row', style: 'margin-bottom:14px' },
        h('input', { type: 'search', placeholder: 'Filtrar por nombre, teléfono o correo…', style: 'flex:1;min-width:220px', oninput: (e) => { filter = e.target.value; if (customers) paint(); } }),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => { await loadCustomers(true); paint(); } }, 'Actualizar'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: () => exportCsv() }, 'Descargar Excel (CSV)')),
      wrap
    ];
  }

  async function exportCsv() {
    const list = await loadCustomers();
    const cols = ['name', 'phone', 'email', 'birthday', 'stamps', 'visits', 'rewardsAvailable', 'rewardsEarned', 'rewardsRedeemed', 'lastVisit', 'createdAt'];
    const head = ['Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Sellos', 'Visitas', 'Recompensas por canjear', 'Recompensas ganadas', 'Recompensas canjeadas', 'Última visita', 'Registro'];
    const cell = (v) => {
      const d = v?.toDate?.();
      const s = d ? `${dayKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = '﻿' + [head.join(','), ...list.map((c) => cols.map((k) => cell(c[k])).join(','))].join('\n');
    const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `clientes-shoku-${dayKey(new Date())}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* ==================== Vista: reportes ==================== */

  function renderReports() {
    const loy = ctx.getLoy();
    const wrap = h('div', {}, h('p', { class: 'empty', text: 'Calculando…' }));
    (async () => {
      const list = await loadCustomers(true);
      const since = new Date(Date.now() - 30 * 86400000);
      const vs = (await getDocs(query(collection(db, 'visits'), where('at', '>=', Timestamp.fromDate(since))))).docs.map((d) => d.data());
      const stamps30 = vs.filter((v) => v.type === 'sello');
      const inactDays = Math.min(...(loy.notifications.inactivity || []).filter((r) => r.enabled).map((r) => Number(r.days)), 14);
      const inactive = list.filter((c) => {
        const ref = toDate(c.lastVisit) || toDate(c.createdAt);
        return ref && daysSince(ref) >= inactDays;
      });
      const month = new Date().getMonth() + 1;
      const bdays = list.filter((c) => Number(c.birthday?.slice(5, 7)) === month).sort((a, b) => a.birthday.slice(8).localeCompare(b.birthday.slice(8)));
      const byDay = new Map();
      for (let i = 29; i >= 0; i--) byDay.set(dayKey(new Date(Date.now() - i * 86400000)), 0);
      stamps30.forEach((v) => {
        const at = toDate(v.at);
        const k = at && dayKey(at);
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1);
      });
      const max = Math.max(1, ...byDay.values());
      const stat = (label, value, hint) => h('div', { class: 'stat' }, h('span', { text: label }), h('strong', { text: String(value) }), hint ? h('small', { text: hint }) : null);
      const top = [...list].sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 10).filter((c) => c.visits);

      wrap.replaceChildren(
        h('div', { class: 'stats' },
          stat('Clientes', list.length, `${list.filter((c) => toDate(c.createdAt) >= since).length} nuevos en 30 días`),
          stat('Visitas (30 días)', stamps30.length),
          stat('Tarjetas completadas', stamps30.filter((v) => v.completed).length, 'últimos 30 días'),
          stat('Recompensas por canjear', list.reduce((s, c) => s + (c.rewardsAvailable || 0), 0)),
          stat('Recompensas canjeadas', list.reduce((s, c) => s + (c.rewardsRedeemed || 0), 0), 'en total'),
          stat('Clientes inactivos', inactive.length, `sin venir en ${inactDays}+ días`)),
        h('section', { class: 'card' },
          h('div', { class: 'card__head' }, h('h3', { text: 'Visitas por día (últimos 30 días)' })),
          h('div', { class: 'bars' }, [...byDay].map(([k, n]) => h('div', { class: 'bar', title: `${k}: ${n} visita(s)` },
            h('i', { style: `height:${(n / max) * 100}%` }), h('span', { text: k.slice(8) }))))),
        h('div', { class: 'grid grid--2' },
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: '🎂 Cumpleaños este mes' })),
            bdays.length ? h('ul', { class: 'history' }, bdays.map((c) => h('li', { onclick: () => openCustomer(c.id), style: 'cursor:pointer' },
              h('strong', { text: c.birthday.slice(8) }), h('span', { text: c.name }), h('span', { class: 'muted', text: c.phone }))))
              : h('p', { class: 'empty', text: 'Nadie cumple años este mes.' })),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: '⭐ Clientes más frecuentes' })),
            top.length ? h('ul', { class: 'history' }, top.map((c) => h('li', { onclick: () => openCustomer(c.id), style: 'cursor:pointer' },
              h('strong', { text: String(c.visits) }), h('span', { text: c.name }), h('span', { class: 'muted', text: `${c.stamps} sellos` }))))
              : h('p', { class: 'empty', text: 'Aún no hay visitas.' }))),
        h('section', { class: 'card' },
          h('div', { class: 'card__head' }, h('h3', { text: `😴 Inactivos (${inactDays}+ días)` })),
          inactive.length ? h('ul', { class: 'history' }, inactive.slice(0, 50).map((c) => h('li', { onclick: () => openCustomer(c.id), style: 'cursor:pointer' },
            h('strong', { text: `${daysSince(toDate(c.lastVisit) || toDate(c.createdAt))} d` }), h('span', { text: c.name }), h('span', { class: 'muted', text: c.phone }))))
            : h('p', { class: 'empty', text: 'Ningún cliente inactivo. 🎉' })));
    })().catch((err) => wrap.replaceChildren(h('div', { class: 'notice notice--danger', text: `No se pudieron calcular los reportes: ${err.message}` })));
    return [h('h2', { text: 'Reportes de la tarjeta' }), h('p', { class: 'lead', text: 'Resumen de clientes, visitas y recompensas.' }), wrap];
  }

  /* ==================== Vista: diseño ==================== */

  function renderDesign() {
    const loy = ctx.getLoy();
    const c = loy.card;
    const prev = h('div', { class: 'loy-preview' });
    const paint = () => {
      prev.innerHTML = renderCard(loy, { name: 'Ana', stamps: Math.min(3, c.stampsRequired - 1), code: 'A1B2C3' });
      hydrateCard(prev, resolveSrc);
    };
    const live = { onChange: paint };
    // Selector de color + campo hexadecimal, sincronizados entre sí.
    const colorField = (key, label) => {
      const text = bound(c, key, { onChange: (v) => { if (/^#[0-9a-f]{6}$/i.test(v)) swatch.value = v; paint(); }, style: 'max-width:110px' });
      const swatch = h('input', { type: 'color', value: c[key], oninput: (e) => { c[key] = e.target.value; text.value = e.target.value; changed(); paint(); } });
      return h('label', { class: 'field' }, h('span', { text: label }), h('div', { class: 'row' }, swatch, text));
    };

    const types = [['sushi', '🍣 Sushi'], ['star', '⭐ Estrella'], ['emoji', '😀 Emoji'], ['image', '🖼️ Imagen PNG']];
    queueMicrotask(paint);

    return [
      h('h2', { text: 'Diseño de la tarjeta' }),
      h('p', { class: 'lead', text: 'Así se ve la tarjeta en el celular del cliente. Los cambios se aplican al presionar “Publicar cambios”.' }),
      h('div', { class: 'design' },
        h('div', { class: 'design__controls' },
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Estilos listos' })),
            h('div', { class: 'presets' }, PRESETS.map((p) => h('button', {
              type: 'button', class: 'preset', title: p.name, style: `--p-bg:${p.bg};--p-ac:${p.accent}`,
              onclick: () => { Object.assign(c, { bg: p.bg, fg: p.fg, label: p.label, accent: p.accent }); changed(); render(); }
            }, h('i'), h('span', { text: p.name }))))),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Programa y recompensa' })),
            h('div', { class: 'grid grid--2' },
              field('Nombre del programa', bound(loy, 'programName', live)),
              field('Frase principal (en la página de membresía)', bound(c, 'headline', live)),
              h('label', { class: 'field' }, h('span', { text: 'Sellos para completar' }),
                h('input', { type: 'number', min: 3, max: 15, value: c.stampsRequired, oninput: (e) => { const n = Math.round(Number(e.target.value)); if (n >= 3 && n <= 15) { c.stampsRequired = n; changed(); paint(); } } })),
              field('Recompensa al completar', bound(c, 'rewardText', live)))),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Tipo de sello' })),
            h('div', { class: 'segmented' }, types.map(([k, label]) => h('button', {
              type: 'button', class: c.stampType === k ? 'is-on' : '', onclick: () => { c.stampType = k; changed(); render(); }
            }, label))),
            c.stampType === 'emoji' ? h('div', { style: 'margin-top:14px' },
              h('div', { class: 'row' }, EMOJIS.map((em) => h('button', { type: 'button', class: `emoji-btn${c.stampEmoji === em ? ' is-on' : ''}`, onclick: () => { c.stampEmoji = em; changed(); render(); } }, em))),
              h('div', { style: 'margin-top:10px;max-width:220px' }, field('U otro emoji', bound(c, 'stampEmoji', { ...live, maxlength: 4 })))) : null,
            c.stampType === 'image' ? h('div', { style: 'margin-top:14px' }, picker(c, 'stampImage', { small: true }),
              h('small', { class: 'muted', text: 'Usa un PNG con fondo transparente, cuadrado (por ejemplo 256×256).' })) : null),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Colores y fondo' })),
            h('div', { class: 'grid grid--2' },
              colorField('bg', 'Fondo'), colorField('accent', 'Sellos y detalles'),
              colorField('fg', 'Texto'), colorField('label', 'Etiquetas')),
            h('div', { style: 'margin-top:14px' }, toggle(c, 'pattern', 'Patrón de olas japonesas')),
            h('div', { class: 'grid grid--2', style: 'margin-top:14px' },
              h('div', { class: 'field' }, h('span', { text: 'Logo' }), picker(c, 'logo', { small: true, clearable: true })),
              h('div', { class: 'field' }, h('span', { text: 'Imagen de fondo (opcional)' }), picker(c, 'bgImage', { small: true, clearable: true })))),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Textos legales' })),
            field('Términos (se muestran en la página de membresía)', bound(loy, 'terms', { multiline: true })),
            h('div', { style: 'margin-top:12px' }, field('Aviso de privacidad (el cliente lo acepta al registrarse)', bound(loy, 'privacy', { multiline: true }))))),
        h('aside', { class: 'design__preview' }, prev,
          h('p', { class: 'muted', style: 'text-align:center;margin-top:12px;font-size:.8rem', text: 'Vista previa con 3 sellos' })))
    ];
  }

  /* ==================== Vista: promociones y mensajes ==================== */

  function renderPromos() {
    const loy = ctx.getLoy();
    const n = loy.notifications;
    const vars = 'Variables: {nombre} · {faltan} · {recompensa} · {promo}';
    const sample = (tpl) => fillMessage(tpl, { nombre: 'Ana', faltan: 5, recompensa: loy.card.rewardText, promo: loy.promotions.find((p) => p.active)?.title || 'nuestras promociones' });
    const msg = (obj, key, label) => {
      const out = h('small', { class: 'msg-preview', text: `Vista previa: ${sample(obj[key])}` });
      return h('div', { class: 'field' }, h('span', { text: label }),
        bound(obj, key, { multiline: true, onChange: () => { out.textContent = `Vista previa: ${sample(obj[key])}`; } }), out);
    };
    const geo = () => {
      if (!navigator.geolocation) return toast('Este navegador no da la ubicación.', 'error');
      navigator.geolocation.getCurrentPosition((p) => {
        n.location.lat = p.coords.latitude.toFixed(6);
        n.location.lng = p.coords.longitude.toFixed(6);
        changed(); render();
        toast('Ubicación del negocio guardada (recuerda publicar).', 'ok');
      }, () => toast('No se pudo obtener la ubicación. Escríbela a mano.', 'error'), { enableHighAccuracy: true });
    };
    const walletReady = loy.wallet.apiBase && (loy.wallet.apple || loy.wallet.google);

    return [
      h('h2', { text: 'Promociones y mensajes' }),
      h('p', { class: 'lead', text: 'Las promociones activas se ven en la página de Membresía y se pueden usar en los mensajes con {promo}.' }),
      walletReady ? null : h('div', { class: 'notice', text: 'Los mensajes automáticos (sellos, inactividad, cumpleaños y cercanía) se enviarán al Wallet del cliente en cuanto conectemos tus certificados de Apple y Google. Ya puedes dejarlos configurados.' }),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Promociones' })),
        loy.promotions.map((p, i) => h('div', { class: 'promo-row' },
          h('div', { class: 'grid grid--2' },
            field('Título', bound(p, 'title')),
            h('label', { class: 'field' }, h('span', { text: 'Válida hasta (opcional)' }), h('input', { type: 'date', value: p.until || '', oninput: (e) => { p.until = e.target.value; changed(); } }))),
          h('div', { style: 'margin-top:10px' }, field('Descripción', bound(p, 'desc', { multiline: true }))),
          h('div', { class: 'row', style: 'margin-top:10px;justify-content:space-between' },
            toggle(p, 'active', 'Activa'),
            iconBtn('✕', 'Eliminar promoción', () => { if (confirm('¿Eliminar esta promoción?')) { loy.promotions.splice(i, 1); changed(); render(); } }, 'danger')))),
        h('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:12px', onclick: () => { loy.promotions.push({ id: `p${Date.now()}`, title: '', desc: '', active: true, until: '' }); changed(); render(); } }, '+ Agregar promoción')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Mensajes de sellos' }), h('span', { class: 'muted', text: vars })),
        h('div', { class: 'grid grid--2' },
          msg(n, 'stamp', 'Al recibir un sello'),
          msg(n, 'reward', 'Al completar la tarjeta'))),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Si el cliente deja de venir' })),
        n.inactivity.map((r, i) => h('div', { class: 'promo-row' },
          h('div', { class: 'row' },
            toggle(r, 'enabled', 'Activo'),
            h('label', { class: 'row' }, 'Enviar después de',
              h('input', { type: 'number', min: 1, max: 180, value: r.days, style: 'width:80px', oninput: (e) => { r.days = Math.max(1, Math.round(Number(e.target.value) || 1)); changed(); } }),
              'días sin visitar'),
            h('span', { style: 'flex:1' }),
            iconBtn('✕', 'Eliminar regla', () => { n.inactivity.splice(i, 1); changed(); render(); }, 'danger')),
          h('div', { style: 'margin-top:10px' }, msg(r, 'message', 'Mensaje')))),
        h('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:12px', onclick: () => { n.inactivity.push({ enabled: true, days: 30, message: '{nombre}, ¡hace mucho que no te vemos! Ven por tu sello 🍣' }); changed(); render(); } }, '+ Agregar recordatorio')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Cumpleaños' }), toggle(n.birthday, 'enabled', 'Activo')),
        msg(n.birthday, 'message', 'Mensaje el día de su cumpleaños')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Cerca del negocio' }), toggle(n.location, 'enabled', 'Activo')),
        h('p', { class: 'muted', style: 'margin-bottom:12px;line-height:1.5', text: 'El Wallet muestra este mensaje en la pantalla bloqueada cuando el cliente pasa cerca del restaurante. Apple y Google deciden la distancia exacta (aprox. 100 m en iPhone); no es posible configurar 5 o 10 km en una tarjeta de Wallet.' }),
        h('div', { class: 'grid grid--2' },
          field('Latitud', bound(n.location, 'lat', { placeholder: '25.5428' })),
          field('Longitud', bound(n.location, 'lng', { placeholder: '-103.4068' }))),
        h('div', { class: 'row', style: 'margin:10px 0 14px' },
          h('button', { type: 'button', class: 'btn btn--sm', onclick: geo }, '📍 Usar mi ubicación actual (estando en el negocio)'),
          n.location.lat && n.location.lng ? h('a', { class: 'btn btn--sm btn--ghost', target: '_blank', rel: 'noopener', href: `https://www.google.com/maps?q=${encodeURIComponent(`${n.location.lat},${n.location.lng}`)}` }, 'Ver en el mapa') : null),
        msg(n.location, 'message', 'Mensaje')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Conexión con Apple y Google Wallet' }),
          h('span', { class: `pill ${walletReady ? 'pill--sello' : 'pill--ajuste'}`, text: walletReady ? 'Conectado' : 'Pendiente' })),
        h('p', { class: 'muted', style: 'margin-bottom:12px;line-height:1.5', text: 'Esta parte la configuramos juntos cuando tengas los certificados de Apple y la cuenta de Google Wallet. Mientras tanto, los clientes usan su tarjeta digital desde la página de Membresía.' }),
        field('Dirección del servidor de Wallet', bound(loy.wallet, 'apiBase', { type: 'url', placeholder: 'https://us-central1-shoku-bb26b.cloudfunctions.net/wallet' })),
        h('div', { class: 'row', style: 'margin-top:12px' }, toggle(loy.wallet, 'apple', 'Apple Wallet'), toggle(loy.wallet, 'google', 'Google Wallet')))
    ];
  }

  function renderView(v) {
    if (v.type === 'loy-visit') return renderVisit();
    if (v.type === 'loy-customers') return renderCustomers();
    if (v.type === 'loy-reports') return renderReports();
    if (v.type === 'loy-design') return renderDesign();
    return renderPromos();
  }

  return { renderView, openCustomer };
}
