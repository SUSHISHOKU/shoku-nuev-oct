// Tarjeta de fidelidad dentro del panel: diseño, promociones, mensajes, visitas, clientes y reportes.
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit, runTransaction, writeBatch,
  serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db, resolveMedia } from './firebase.js';
import { renderCard, hydrateCard, normalizePhone, firstName, fillMessage, welcomeOf, totalStamps, computeExpiry, isExpired, fmtExpiry, retireDate } from './loyalty-card.js';
import { safeUrl } from './util.js';

const resolveSrc = (src) => Promise.resolve(src?.startsWith('media:') ? resolveMedia(src) : safeUrl(src));
const fmtDate = (d) => (d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const toDate = (ts) => ts?.toDate?.() || null;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysSince = (d) => (d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null);

const PRESETS = [
  { name: 'Sumi-e (ilustración)', layout: 'art', bg: '#f3e7d9', fg: '#1a1a1a', label: '#b3131b', accent: '#c8202b' },
  { name: 'Negro y dorado', bg: '#121214', fg: '#f5f1ea', label: '#c9a45c', accent: '#c9a45c' },
  { name: 'Sakura', bg: '#2a1520', fg: '#fff2f5', label: '#f4a7bb', accent: '#ff8fab' },
  { name: 'Matcha', bg: '#14211a', fg: '#eef5ea', label: '#a8c686', accent: '#b5d98a' },
  { name: 'Océano', bg: '#0e1b2c', fg: '#eef4fb', label: '#8fb8de', accent: '#5fb3ff' },
  { name: 'Rojo shoku', bg: '#5b0f14', fg: '#fff5ef', label: '#f2c48d', accent: '#ffd28a' },
  { name: 'Minimal claro', bg: '#f6f2ea', fg: '#1b1b1d', label: '#9a7a3c', accent: '#b8862f' }
];
const EMOJIS = ['🍣', '🍱', '🍙', '🥢', '🍤', '⭐', '❤️', '🔥', '🎌', '🌸'];

export function createLoyalty(ctx) {
  const { h, bound, field, toggle, iconBtn, toast, picker, changed, render, go, can } = ctx;
  let customers = null; // caché de la lista de clientes
  let selected = null; // { id, data, history }

  /* ==================== Datos de clientes ==================== */

  async function loadCustomers(force = false) {
    if (customers && !force) return customers;
    const snap = await getDocs(query(collection(db, 'customers'), orderBy('createdAt', 'desc'), limit(2000)));
    customers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return customers;
  }

  // Cada movimiento se guarda en el historial del cliente y en la colección general de reportes.
  // Sin permiso de reportes, el personal solo puede leer el historial de la tarjeta que tiene enfrente.
  function logMovement(writer, id, entry) {
    writer.set(doc(collection(db, 'visits')), entry);
    writer.set(doc(collection(db, 'customers', id, 'history')), entry);
  }

  async function openCustomer(id) {
    const snap = await getDoc(doc(db, 'customers', id));
    if (!snap.exists()) { toast('No se encontró esa tarjeta.', 'error'); return; }
    const hist = await getDocs(collection(db, 'customers', id, 'history'));
    const data = snap.data();
    const rows = hist.docs.map((d) => d.data());
    // El sello de regalo no es una visita, pero sí aparece en el historial.
    if (data.welcomeStamps > 0) rows.push({ type: 'bienvenida', at: data.createdAt, stampsAfter: data.welcomeStamps });
    selected = { id, data, history: rows.sort((a, b) => (toDate(b.at)?.getTime() || 0) - (toDate(a.at)?.getTime() || 0)) };
    go({ type: 'loy-visit' });
  }

  // Suma un sello. Al completar la tarjeta se reinician los sellos y se acumula una recompensa.
  async function addStamp() {
    const loy = ctx.getLoy();
    const required = totalStamps(loy.card);
    if (selected.data.completedAt) { toast('Esta tarjeta ya está completa.', 'error'); return; }
    if (isExpired(toDate(selected.data.expiresAt))) { toast('La tarjeta está vencida. Renuévala para seguir sumando sellos.', 'error'); return; }
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
      if (stamps >= required) { stamps = required; available += 1; earned += 1; completed = true; }
      const now = serverTimestamp();
      // Al completarse, la tarjeta muestra la felicitación y se retira al terminar el plazo configurado.
      // Si no, su vigencia sigue igual o se renueva en cada visita, según la configuración.
      let expiresAt = cur.expiresAt ?? null;
      const finish = {};
      if (completed) {
        expiresAt = Timestamp.fromDate(retireDate(loy.card));
        Object.assign(finish, { completedAt: now, deleteAt: expiresAt });
      } else if (loy.card.validityFrom === 'visit') {
        const next = computeExpiry(loy.card);
        expiresAt = next ? Timestamp.fromDate(next) : null;
      }
      tx.update(ref, { stamps, visits: (cur.visits || 0) + 1, rewardsAvailable: available, rewardsEarned: earned, lastVisit: now, expiresAt, ...finish });
      tx.update(doc(db, 'cards', id), { stamps, rewardsAvailable: available, updatedAt: now, expiresAt, lastVisit: now, ...finish });
      logMovement(tx, id, { cardId: id, name: cur.name, type: 'sello', stampsAfter: stamps, completed, at: now, by: ctx.userEmail() });
      return { completed, stamps };
    });
    toast(result.completed ? `🎉 ¡Tarjeta completa! ${selected.data.name} ganó: ${loy.card.rewardText}. Se retirará en ${loy.card.completedDays} día(s).` : `Sello agregado (${result.stamps}/${required}).`, 'ok');
    customers = null;
    await openCustomer(id);
  }

  async function redeem() {
    const loy = ctx.getLoy();
    if (isExpired(toDate(selected.data.expiresAt))) { toast('La tarjeta está vencida: la recompensa ya no es válida.', 'error'); return; }
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
      logMovement(tx, id, { cardId: id, name: cur.name, type: 'canje', reward: loy.card.rewardText, at: now, by: ctx.userEmail() });
    }).catch((err) => { toast(err.message, 'error'); throw err; });
    toast('Recompensa entregada ✅', 'ok');
    customers = null;
    await openCustomer(id);
  }

  // Reinicia una tarjeta vencida: vuelve a los sellos de regalo y pierde lo acumulado.
  async function renew() {
    const loy = ctx.getLoy();
    const w = welcomeOf(loy.card);
    if (!confirm(`¿Renovar la tarjeta de ${selected.data.name}? Empezará de nuevo con ${w} sello(s) y perderá sellos y recompensas sin canjear.`)) return;
    const next = computeExpiry(loy.card);
    const expiresAt = next ? Timestamp.fromDate(next) : null;
    const batch = writeBatch(db);
    batch.update(doc(db, 'customers', selected.id), { stamps: w, rewardsAvailable: 0, expiresAt });
    batch.update(doc(db, 'cards', selected.id), { stamps: w, rewardsAvailable: 0, expiresAt, updatedAt: serverTimestamp() });
    logMovement(batch, selected.id, { cardId: selected.id, name: selected.data.name, type: 'renovacion', stampsAfter: w, at: serverTimestamp(), by: ctx.userEmail() });
    await batch.commit();
    toast('Tarjeta renovada.', 'ok');
    customers = null;
    await openCustomer(selected.id);
  }

  async function adjustStamps() {
    const loy = ctx.getLoy();
    const required = totalStamps(loy.card);
    const v = prompt(`Corregir sellos de ${selected.data.name} (0 a ${required - 1}):`, selected.data.stamps || 0);
    if (v == null) return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n >= required) { toast('Número de sellos no válido.', 'error'); return; }
    const batch = writeBatch(db);
    batch.update(doc(db, 'customers', selected.id), { stamps: n });
    batch.update(doc(db, 'cards', selected.id), { stamps: n, updatedAt: serverTimestamp() });
    logMovement(batch, selected.id, { cardId: selected.id, name: selected.data.name, type: 'ajuste', stampsAfter: n, at: serverTimestamp(), by: ctx.userEmail() });
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
    // Sin permiso de ver la lista completa, solo se puede buscar por teléfono o escaneando.
    if (!can('customers')) return [];
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
      type: 'search', placeholder: can('customers') ? 'Teléfono, nombre o correo…' : 'Teléfono de 10 dígitos…', autocomplete: 'off',
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
      const required = totalStamps(loy.card);
      const expiresAt = toDate(c.expiresAt);
      const completedCard = !!c.completedAt;
      const deleteAt = toDate(c.deleteAt);
      const expired = !completedCard && isExpired(expiresAt);
      out.push(h('section', { class: 'card loy-customer' },
        h('div', { class: 'loy-customer__grid' },
          cardBox(loy, { name: firstName(c.name), stamps: c.stamps, rewards: c.rewardsAvailable, expiresAt, completed: completedCard, deleteAt }),
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
              h('dt', { text: completedCard ? 'Se retira' : expired ? 'Venció' : 'Vence' }), h('dd', { class: expired ? 'is-danger' : '', text: fmtExpiry(completedCard ? deleteAt : expiresAt) }),
              h('dt', { text: 'Registro' }), h('dd', { text: fmtDate(toDate(c.createdAt)) })),
            h('div', { class: 'row', style: 'margin-top:16px' },
              expired && can('visits') ? h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: () => renew().catch((e) => toast(e.message, 'error')) }, 'Renovar tarjeta') : null,
              !expired && !completedCard && can('visits') ? h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: () => addStamp().catch((e) => toast(e.message, 'error')) }, '+1 sello') : null,
              !expired && can('redeem') && c.rewardsAvailable > 0 ? h('button', { type: 'button', class: 'btn btn--big btn--reward', onclick: () => redeem().catch(() => {}) }, '🎁 Entregar recompensa') : null),
            h('div', { class: 'row', style: 'margin-top:10px' },
              can('customers') && !completedCard ? h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: () => adjustStamps().catch((e) => toast(e.message, 'error')) }, 'Corregir sellos') : null,
              h('button', {
                type: 'button', class: 'btn btn--sm btn--ghost',
                onclick: async () => {
                  const url = new URL(`membresia.html?c=${selected.id}`, location.href).href;
                  try { await navigator.clipboard.writeText(url); toast('Enlace de la tarjeta copiado. Puedes mandárselo por WhatsApp.', 'ok'); } catch { prompt('Enlace de la tarjeta:', url); }
                }
              }, 'Copiar enlace de su tarjeta'),
              ctx.isOwner() ? h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => deleteCustomer().catch((e) => toast(e.message, 'error')) }, 'Eliminar cliente') : null))),
        h('h3', { style: 'margin:22px 0 10px', text: 'Historial' }),
        selected.history.length
          ? h('ul', { class: 'history' }, selected.history.map((v) => h('li', {},
            h('span', { class: `pill pill--${v.type}`, text: { sello: v.completed ? 'Sello · completó' : 'Sello', canje: 'Canje', ajuste: 'Ajuste', bienvenida: 'Sello de regalo', renovacion: 'Renovación' }[v.type] || v.type }),
            h('span', { text: fmtDateTime(toDate(v.at)) }),
            h('span', { class: 'muted', text: `${v.type === 'canje' ? v.reward : v.stampsAfter != null ? `${v.stampsAfter}/${required}` : ''}${v.by ? ` · ${v.by}` : ''}` }))))
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
          h('thead', {}, h('tr', {}, ['Nombre', 'Teléfono', 'Sellos', 'Recompensas', 'Visitas', 'Última visita', 'Vence', 'Registro'].map((t) => h('th', { text: t })))),
          h('tbody', {}, list.map((c) => h('tr', { onclick: () => openCustomer(c.id) },
            h('td', {}, h('strong', { text: c.name })),
            h('td', { text: c.phone }),
            h('td', { text: String(c.stamps || 0) }),
            h('td', { text: c.rewardsAvailable ? `🎁 ${c.rewardsAvailable}` : '—' }),
            h('td', { text: String(c.visits || 0) }),
            h('td', { text: fmtDate(toDate(c.lastVisit)) }),
            h('td', { class: isExpired(toDate(c.expiresAt)) ? 'is-danger' : '', text: fmtDate(toDate(c.expiresAt)) }),
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
    const cols = ['name', 'phone', 'email', 'birthday', 'stamps', 'visits', 'rewardsAvailable', 'rewardsEarned', 'rewardsRedeemed', 'lastVisit', 'expiresAt', 'createdAt'];
    const head = ['Nombre', 'Teléfono', 'Correo', 'Cumpleaños', 'Sellos', 'Visitas', 'Recompensas por canjear', 'Recompensas ganadas', 'Recompensas canjeadas', 'Última visita', 'Vence', 'Registro'];
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
      const soon = Date.now() + 7 * 86400000;
      const expired = list.filter((c) => isExpired(toDate(c.expiresAt)));
      const expiring = list.filter((c) => { const e = toDate(c.expiresAt); return e && e.getTime() >= Date.now() && e.getTime() <= soon; });
      const byStaff = new Map();
      stamps30.forEach((v) => byStaff.set(v.by || 'Sin registro', (byStaff.get(v.by || 'Sin registro') || 0) + 1));
      const top = [...list].sort((a, b) => (b.visits || 0) - (a.visits || 0)).slice(0, 10).filter((c) => c.visits);

      wrap.replaceChildren(
        h('div', { class: 'stats' },
          stat('Clientes', list.length, `${list.filter((c) => toDate(c.createdAt) >= since).length} nuevos en 30 días`),
          stat('Visitas (30 días)', stamps30.length),
          stat('Tarjetas completadas', stamps30.filter((v) => v.completed).length, 'últimos 30 días'),
          stat('Recompensas por canjear', list.reduce((s, c) => s + (c.rewardsAvailable || 0), 0)),
          stat('Recompensas canjeadas', list.reduce((s, c) => s + (c.rewardsRedeemed || 0), 0), 'en total'),
          stat('Clientes inactivos', inactive.length, `sin venir en ${inactDays}+ días`),
          stat('Tarjetas vencidas', expired.length),
          stat('Por vencer', expiring.length, 'en los próximos 7 días')),
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
        byStaff.size ? h('section', { class: 'card' },
          h('div', { class: 'card__head' }, h('h3', { text: 'Sellos por persona (30 días)' })),
          h('ul', { class: 'history' }, [...byStaff].sort((a, b) => b[1] - a[1]).map(([who, n]) => h('li', {}, h('strong', { text: String(n) }), h('span', { text: who }), h('span'))))) : null,
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
      prev.innerHTML = renderCard(loy, { name: 'Ana', stamps: welcomeOf(c), code: 'A1B2C3', expiresAt: computeExpiry(c) });
      hydrateCard(prev, resolveSrc);
    };
    const live = { onChange: paint };
    // Selector de color + campo hexadecimal, sincronizados entre sí.
    const colorField = (key, label) => {
      const text = bound(c, key, { onChange: (v) => { if (/^#[0-9a-f]{6}$/i.test(v)) swatch.value = v; paint(); }, style: 'max-width:110px' });
      const swatch = h('input', { type: 'color', value: c[key], oninput: (e) => { c[key] = e.target.value; text.value = e.target.value; changed(); paint(); } });
      return h('label', { class: 'field' }, h('span', { text: label }), h('div', { class: 'row' }, swatch, text));
    };

    const welcomeInput = h('input', { type: 'number', min: 0, max: totalStamps(c) - 1, value: welcomeOf(c), oninput: (e) => {
      const n = Math.round(Number(e.target.value));
      if (n >= 0 && n < totalStamps(c)) { c.welcomeStamps = n; changed(); paint(); }
    } });
    const types = [['sakura', '🌸 Flor de cerezo'], ['sushi', '🍣 Sushi'], ['star', '⭐ Estrella'], ['emoji', '😀 Emoji'], ['image', '🖼️ Imagen PNG']];
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
              onclick: () => { Object.assign(c, { layout: p.layout || 'classic', bg: p.bg, fg: p.fg, label: p.label, accent: p.accent }); changed(); render(); }
            }, h('i'), h('span', { text: p.name }))))),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Tipo de diseño' })),
            h('div', { class: 'segmented' }, [['art', '🖼️ Ilustración completa'], ['classic', '🎨 Color o foto']].map(([k, label]) => h('button', {
              type: 'button', class: c.layout === k ? 'is-on' : '', onclick: () => { c.layout = k; changed(); render(); }
            }, label))),
            c.layout === 'art' ? h('div', { class: 'grid grid--2', style: 'margin-top:14px' },
              field('Título sobre la ilustración', bound(c, 'title', live)),
              field('Texto inferior', bound(c, 'subtitle', live)),
              h('div', { class: 'field' }, h('span', { text: 'Ilustración de fondo (vertical, 2:3)' }), picker(c, 'artImage', { small: true }))) : null),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Programa y recompensa' })),
            h('div', { class: 'grid grid--2' },
              field('Nombre del programa', bound(loy, 'programName', live)),
              field('Frase principal (usa {sellos} y {recompensa})', bound(c, 'headline', live)),
              field('Recompensa al completar', bound(c, 'rewardText', live)),
              field('Mensaje al completar (usa {recompensa})', bound(c, 'completedMessage', live)),
              h('label', { class: 'field' }, h('span', { text: 'Días antes de retirar la tarjeta completa' }),
                h('input', { type: 'number', min: 0, max: 30, value: c.completedDays ?? 1, oninput: (e) => {
                  const n = Math.round(Number(e.target.value));
                  if (n >= 0 && n <= 30) { c.completedDays = n; changed(); }
                } }),
                h('small', { text: '1 = se retira al terminar el día siguiente. 0 = al terminar el mismo día.' })),
              h('label', { class: 'field' }, h('span', { text: 'Sellos para completar' }),
                h('input', { type: 'number', min: 1, max: 20, value: c.stampsRequired, oninput: (e) => {
                  const n = Math.round(Number(e.target.value));
                  if (n >= 1 && n <= 20) { c.stampsRequired = n; c.welcomeStamps = welcomeOf(c); welcomeInput.value = c.welcomeStamps; welcomeInput.max = n - 1; changed(); paint(); }
                } })),
              h('label', { class: 'field' }, h('span', { text: 'Sellos de regalo al registrarse' }), welcomeInput,
                h('small', { text: 'Pon 0 si no quieres regalar sellos.' })),
              h('label', { class: 'field' }, h('span', { text: 'La tarjeta vence en (meses)' }),
                h('input', { type: 'number', min: 0, max: 36, value: c.validityMonths, oninput: (e) => {
                  const n = Math.round(Number(e.target.value));
                  if (n >= 0 && n <= 36) { c.validityMonths = n; changed(); paint(); }
                } }),
                h('small', { text: 'Pon 0 para que no venza.' })),
              h('label', { class: 'field' }, h('span', { text: 'El vencimiento cuenta desde' }),
                h('select', { onchange: (e) => { c.validityFrom = e.target.value; changed(); } },
                  h('option', { value: 'signup', selected: c.validityFrom !== 'visit' ? true : null, text: 'El registro (o al completar la tarjeta)' }),
                  h('option', { value: 'visit', selected: c.validityFrom === 'visit' ? true : null, text: 'La última visita' }))))),
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
            c.layout === 'art' ? null : h('div', { style: 'margin-top:14px' }, toggle(c, 'pattern', 'Patrón de olas japonesas')),
            h('div', { class: 'grid grid--2', style: 'margin-top:14px' },
              h('div', { class: 'field' }, h('span', { text: 'Logo' }), picker(c, 'logo', { small: true, clearable: true })),
              c.layout === 'art' ? null : h('div', { class: 'field' }, h('span', { text: 'Imagen de fondo (opcional)' }), picker(c, 'bgImage', { small: true, clearable: true })))),
          h('section', { class: 'card' },
            h('div', { class: 'card__head' }, h('h3', { text: 'Textos legales' })),
            field('Términos (se muestran en la página de membresía)', bound(loy, 'terms', { multiline: true })),
            h('div', { style: 'margin-top:12px' }, field('Aviso de privacidad (el cliente lo acepta al registrarse)', bound(loy, 'privacy', { multiline: true }))))),
        h('aside', { class: 'design__preview' }, prev,
          h('p', { class: 'muted', style: 'text-align:center;margin-top:12px;font-size:.8rem', text: 'Vista previa de una tarjeta recién creada' })))
    ];
  }

  /* ==================== Vista: promociones y mensajes ==================== */

  function renderPromos() {
    const loy = ctx.getLoy();
    const n = loy.notifications;
    const vars = 'Variables: {nombre} · {faltan} · {recompensa} · {promo}';
    const sample = (tpl) => fillMessage(tpl, { sucursal: (loy.branches || [])[0]?.name || 'Centro', nombre: 'Ana', faltan: 5, recompensa: loy.card.rewardText, promo: loy.promotions.find((p) => p.active)?.title || 'nuestras promociones' });
    const msg = (obj, key, label) => {
      const out = h('small', { class: 'msg-preview', text: `Vista previa: ${sample(obj[key])}` });
      return h('div', { class: 'field' }, h('span', { text: label }),
        bound(obj, key, { multiline: true, onChange: () => { out.textContent = `Vista previa: ${sample(obj[key])}`; } }), out);
    };

    return [
      h('h2', { text: 'Promociones y mensajes' }),
      h('p', { class: 'lead', text: 'Las promociones activas se ven en la página de Membresía y se pueden usar en los mensajes con {promo}.' }),
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
        h('div', { class: 'card__head' }, h('h3', { text: 'Cerca de una sucursal' }), toggle(n.location, 'enabled', 'Activo')),
        h('p', { class: 'muted', style: 'margin-bottom:12px;line-height:1.5', text: 'Las ubicaciones se configuran en 📍 Sucursales. Usa {sucursal} para incluir el nombre de cada una.' }),
        msg(n.location, 'message', 'Mensaje')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Botones de Wallet en la página de Membresía' })),
        h('div', { class: 'row' }, toggle(loy.wallet, 'appleOff', 'Apple Wallet', { invert: true }), toggle(loy.wallet, 'googleOff', 'Google Wallet', { invert: true })))
    ];
  }

  function renderView(v) {
    if (v.type === 'loy-visit') return renderVisit();
    if (v.type === 'loy-customers') return renderCustomers();
    if (v.type === 'loy-reports') return renderReports();
    if (v.type === 'loy-design') return renderDesign();
    return renderPromos();
  }

  return { renderView, openCustomer, loadCustomers };
}
