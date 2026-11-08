// Panel: Retroalimentación. Conserva los teléfonos aunque la tarjeta ya no exista e invita a regresar por WhatsApp.
import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase.js';
import { fillMessage, firstName } from './loyalty-card.js';

const DAY = 86400000;
const toDate = (ts) => ts?.toDate?.() || null;
const fmt = (d) => (d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const isPhone = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const FILTERS = [
  { key: 'all', label: 'Todos', test: () => true },
  { key: 'noCard', label: 'Sin tarjeta activa', test: (c) => !c.activeCard },
  { key: 'done', label: 'Ya completaron al menos una', test: (c) => c.passes > 0 },
  { key: 'rest', label: 'Sin contactar en 7 días o más', test: (c, now) => !c.lastContact || now - c.lastContact.getTime() >= 7 * DAY }
];

export function createFeedback(ctx) {
  const { h, field, bound, toast, render, changed, loyalty, getLoy, can, isOwner } = ctx;
  let filter = 'all';
  let queueIndex = 0;

  // Une el historial (contacts) con quienes hoy tienen tarjeta, para que nadie falte.
  async function loadContacts() {
    const [contactsSnap, customers] = await Promise.all([getDocs(collection(db, 'contacts')), loyalty.loadCustomers(true)]);
    const byPhone = new Map();
    contactsSnap.docs.forEach((d) => {
      const c = d.data();
      byPhone.set(d.id, {
        phone: d.id, name: c.name || '', email: c.email || '', passes: c.cardsCompleted || 0, visits: c.visitsTotal || 0,
        lastVisit: toDate(c.lastVisit), lastContact: toDate(c.lastContactAt), whatsappOk: c.whatsappOk !== false, activeCard: false
      });
    });
    customers.forEach((c) => {
      const cur = byPhone.get(c.phone) || { phone: c.phone, name: '', email: '', passes: 0, visits: 0, lastVisit: null, lastContact: null, whatsappOk: true };
      const last = toDate(c.lastVisit);
      byPhone.set(c.phone, {
        ...cur,
        name: c.name || cur.name, email: c.email || cur.email,
        passes: cur.passes + (c.rewardsEarned || 0), visits: cur.visits + (c.visits || 0),
        lastVisit: last && (!cur.lastVisit || last > cur.lastVisit) ? last : cur.lastVisit,
        whatsappOk: cur.whatsappOk && c.whatsappOk !== false,
        activeCard: true
      });
    });
    return [...byPhone.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  const waLink = (phone, text) => (isPhone
    ? `https://wa.me/52${phone}?text=${encodeURIComponent(text)}`
    : `https://web.whatsapp.com/send?phone=52${phone}&text=${encodeURIComponent(text)}`);

  function exportCsv(rows) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [['Nombre', 'Teléfono', 'Correo', 'Pases completados', 'Visitas', 'Última visita', 'Último WhatsApp', 'Tarjeta activa', 'Acepta WhatsApp'].join(',')];
    rows.forEach((c) => lines.push([c.name, c.phone, c.email, c.passes, c.visits, fmt(c.lastVisit), fmt(c.lastContact), c.activeCard ? 'Sí' : 'No', c.whatsappOk ? 'Sí' : 'No'].map(cell).join(',')));
    const a = h('a', { href: URL.createObjectURL(new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv' })), download: `retroalimentacion-shoku-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function renderFeedback() {
    const loy = getLoy();
    const box = h('div', {}, h('p', { class: 'empty', text: 'Cargando teléfonos…' }));

    const paint = (all) => {
      const now = Date.now();
      const test = FILTERS.find((f) => f.key === filter).test;
      const rows = all.filter((c) => test(c, now));
      const queue = rows.filter((c) => c.whatsappOk);
      if (queueIndex >= queue.length) queueIndex = 0;

      const sendNext = async () => {
        const c = queue[queueIndex];
        if (!c) return;
        const text = fillMessage(loy.feedbackMessage, { nombre: firstName(c.name) });
        window.open(waLink(c.phone, text), 'shoku-whatsapp');
        c.lastContact = new Date();
        queueIndex += 1;
        setDoc(doc(db, 'contacts', c.phone), { phone: c.phone, name: c.name, lastContactAt: serverTimestamp() }, { merge: true })
          .catch((err) => toast(`No se guardó el registro: ${err.message}`, 'error'));
        paint(all);
      };
      const current = queue[queueIndex];

      box.replaceChildren(
        h('div', { class: 'stats' }, [
          ['Teléfonos guardados', all.length],
          ['Pases completados', all.reduce((a, c) => a + c.passes, 0)],
          ['Sin tarjeta activa', all.filter((c) => !c.activeCard).length],
          ['Aceptan WhatsApp', all.filter((c) => c.whatsappOk).length]
        ].map(([l, v]) => h('div', { class: 'stat' }, h('span', { text: l }), h('strong', { text: String(v) })))),
        h('section', { class: 'card' },
          h('div', { class: 'card__head' }, h('h3', { text: 'Invitar a regresar por WhatsApp' })),
          h('p', { class: 'muted', style: 'margin-bottom:12px;line-height:1.5', text: isPhone
            ? 'Cada toque abre tu WhatsApp con el mensaje listo; ahí lo envías y regresas por el siguiente.'
            : 'La primera vez, WhatsApp Web te pedirá escanear su QR con tu teléfono. Después, cada clic abre el chat con el mensaje listo y solo presionas Enviar.' }),
          field('Mensaje (usa {nombre})', bound(loy, 'feedbackMessage', { multiline: true, rows: 3 })),
          h('div', { class: 'row', style: 'margin-top:12px' },
            h('label', { class: 'field', style: 'flex:1;min-width:220px' }, h('span', { text: '¿A quién?' }),
              h('select', { onchange: (e) => { filter = e.target.value; queueIndex = 0; paint(all); } },
                FILTERS.map((f) => h('option', { value: f.key, selected: f.key === filter ? true : null, text: f.label }))))),
          current
            ? h('div', { class: 'wa-next' },
              h('div', {}, h('small', { text: `Siguiente · ${queueIndex + 1} de ${queue.length}` }), h('strong', { text: current.name || 'Sin nombre' }), h('span', { text: current.phone })),
              h('div', { class: 'row' },
                h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => { queueIndex += 1; paint(all); } }, 'Saltar'),
                h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: sendNext }, '💬 Abrir WhatsApp')))
            : h('p', { class: 'empty', text: queue.length ? 'Terminaste la lista.' : 'No hay personas en este grupo.' })),
        h('section', { class: 'card' },
          h('div', { class: 'card__head' }, h('h3', { text: `Teléfonos (${rows.length})` }),
            h('button', { type: 'button', class: 'btn btn--sm', onclick: () => exportCsv(rows) }, 'Descargar Excel (CSV)')),
          h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, ['Nombre', 'Teléfono', 'Pases', 'Visitas', 'Última visita', 'Último WhatsApp', 'Tarjeta', ''].map((t) => h('th', { text: t })))),
            h('tbody', {}, rows.map((c) => h('tr', { style: 'cursor:default' },
              h('td', {}, h('strong', { text: c.name || '—' })),
              h('td', {}, h('a', { href: `tel:${c.phone}`, style: 'color:var(--gold)', text: c.phone })),
              h('td', { text: String(c.passes) }),
              h('td', { text: String(c.visits) }),
              h('td', { text: fmt(c.lastVisit) }),
              h('td', { text: fmt(c.lastContact) }),
              h('td', { text: c.activeCard ? 'Activa' : '—' }),
              h('td', {}, h('div', { class: 'row', style: 'flex-wrap:nowrap' },
                h('label', { class: 'check', title: 'Desmárcalo si la persona pide no recibir mensajes' },
                  h('input', {
                    type: 'checkbox', checked: c.whatsappOk,
                    onchange: async (e) => {
                      c.whatsappOk = e.target.checked;
                      await setDoc(doc(db, 'contacts', c.phone), { phone: c.phone, name: c.name, whatsappOk: c.whatsappOk }, { merge: true });
                      paint(all);
                    }
                  }), 'WhatsApp'),
                isOwner() && !c.activeCard ? h('button', {
                  type: 'button', class: 'icon-btn danger', title: 'Eliminar teléfono', 'aria-label': 'Eliminar teléfono',
                  onclick: async () => {
                    if (!confirm(`¿Eliminar a ${c.name || c.phone} y su historial? No se puede deshacer.`)) return;
                    await deleteDoc(doc(db, 'contacts', c.phone));
                    all.splice(all.indexOf(c), 1);
                    paint(all);
                  }
                }, '✕') : null)))))))));
    };

    loadContacts().then(paint).catch((err) => box.replaceChildren(h('div', { class: 'notice notice--danger', text: `No se pudieron leer los teléfonos: ${err.message}` })));
    return [
      h('h2', { text: 'Retroalimentación' }),
      h('p', { class: 'lead', text: 'Todos los teléfonos y cuántas tarjetas ha completado cada persona, aunque su tarjeta ya se haya retirado.' }),
      box
    ];
  }

  return { renderFeedback };
}
