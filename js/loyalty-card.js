// Tarjeta de fidelidad: configuración por defecto y dibujo de la tarjeta.
// Se usa en membresia.html (cliente) y en admin.html (vista previa y registro de visitas).
import { esc, safeUrl } from './util.js';

export const DEFAULT_LOYALTY = {
  enabled: true,
  programName: 'SHOKU CLUB',
  card: {
    layout: 'art', // art (ilustración completa) | classic (color o foto de fondo)
    artImage: 'img/tarjeta-fondo.webp',
    title: 'TARJETA DE FIDELIDAD',
    subtitle: 'CLIENTE FRECUENTE',
    bg: '#f3e7d9',
    fg: '#1a1a1a',
    label: '#b3131b',
    accent: '#c8202b',
    bgImage: '',
    logo: 'img/tarjeta-logo.webp',
    pattern: false,
    stampType: 'sakura', // sakura | sushi | star | emoji | image
    stampEmoji: '🍣',
    stampImage: '',
    stampsRequired: 4,
    welcomeStamps: 1, // sellos de regalo al registrarse
    validityMonths: 1, // 0 = no vence
    validityFrom: 'signup', // signup: desde el registro | visit: desde la última visita
    rewardText: '30% de descuento',
    headline: 'Junta {sellos} sellos y llévate {recompensa}'
  },
  terms: 'Un sello por visita con consumo. La recompensa no es acumulable con otras promociones y no aplica en días festivos.',
  privacy: 'Usaremos tus datos solo para administrar tu tarjeta de fidelidad y enviarte promociones de Shoku. Puedes pedir que los eliminemos en cualquier momento.',
  promotions: [
    { id: 'p1', title: 'Sushi al 2x1', desc: 'Lunes, martes y miércoles en rollos seleccionados.', active: true, until: '' }
  ],
  notifications: {
    stamp: '¡Sumaste un sello, {nombre}! Te faltan {faltan} para tu recompensa.',
    reward: '🎉 ¡Completaste tu tarjeta! Tu recompensa: {recompensa}.',
    inactivity: [
      { enabled: true, days: 7, message: 'Hey {nombre}, ¡te extrañamos! 🍣 Ven a Shoku, te esperamos con {promo}.' },
      { enabled: true, days: 14, message: '{nombre}, tu próximo sello te espera. Visítanos esta semana y aprovecha {promo}.' }
    ],
    birthday: { enabled: true, message: '¡Feliz cumpleaños, {nombre}! 🎂 Ven a celebrar a Shoku, tenemos una sorpresa para ti.' },
    location: { enabled: true, lat: '', lng: '', message: 'Estás cerca de Shoku 🍣 ¡Ven y disfruta un sushi!' }
  },
  wallet: { apiBase: '', apple: false, google: false }
};

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.83 5.73 6.33.92-4.58 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3L2.84 9.45l6.33-.92z"/></svg>';
const SUSHI = '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="16" width="22" height="10.5" rx="5" fill="#f7f4ee"/><path fill="currentColor" d="M3.5 17.6c0-4.1 5.6-7.6 12.5-7.6s12.5 3.5 12.5 7.6c0 1-1 1.5-2 1.3-3.4-.6-7-.9-10.5-.9s-7.1.3-10.5.9c-1 .2-2-.3-2-1.3z"/><path d="M9 12.6l2.4 5.4M15 11.1l1.9 6.7M21 11.9l1.6 6" stroke="#fff" stroke-opacity=".6" stroke-width="1.4" stroke-linecap="round"/><rect x="13.8" y="14.2" width="4.4" height="12.3" rx="1.2" fill="#1f2a22"/></svg>';

const PETAL = 'M16 15.4c-3.1-2.9-4.8-6.3-3.6-9.3.6-1.6 1.8-2.6 2.7-3l.9 1.7.9-1.7c.9.4 2.1 1.4 2.7 3 1.2 3-.5 6.4-3.6 9.3z';
const SAKURA = `<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor">${[0, 72, 144, 216, 288].map((a) => `<path transform="rotate(${a} 16 16)" d="${PETAL}"/>`).join('')}</g><circle cx="16" cy="16" r="2.7" fill="#fff"/><circle cx="16" cy="16" r="1.2" fill="#1a1a1a"/></svg>`;

export function stampIcon(card) {
  switch (card.stampType) {
    case 'sakura': return SAKURA;
    case 'star': return STAR;
    case 'emoji': return `<span class="lc-emoji">${esc(card.stampEmoji || '⭐')}</span>`;
    case 'image': return card.stampImage ? `<img alt="" data-src="${esc(card.stampImage)}">` : STAR;
    default: return SUSHI;
  }
}

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

export const totalStamps = (c) => Math.max(1, Math.min(20, Math.round(Number(c.stampsRequired)) || 4));
// Sellos de regalo: nunca pueden completar la tarjeta por sí solos.
export const welcomeOf = (c) => Math.max(0, Math.min(totalStamps(c) - 1, Math.round(Number(c.welcomeStamps)) || 0));

// Suma meses respetando el fin de mes (31 ene + 1 mes = 28/29 feb).
export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
}
// Fecha de vencimiento a partir de hoy, o null si la tarjeta no vence.
export const computeExpiry = (c, from = new Date()) => {
  const months = Math.round(Number(c.validityMonths)) || 0;
  return months > 0 ? addMonths(from, months) : null;
};
export const isExpired = (date) => !!date && date.getTime() < Date.now();
export const fmtExpiry = (date) => (date ? date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin vencimiento');
export const headlineText = (cfg) => fillMessage(cfg.card?.headline, { sellos: totalStamps(cfg.card || {}), recompensa: cfg.card?.rewardText || '' });

// Devuelve el HTML de la tarjeta. state = { name, stamps, rewards, qr (svg), code, expiresAt (Date) }
export function renderCard(cfg, state = {}) {
  const c = { ...DEFAULT_LOYALTY.card, ...(cfg.card || {}) };
  const total = totalStamps(c);
  const have = Math.max(0, Math.min(total, Number(state.stamps) || 0));
  const cols = total <= 6 ? total : Math.ceil(total / 2);
  const icon = stampIcon(c);
  const stamps = Array.from({ length: total }, (_, i) =>
    `<span class="lc-stamp${i < have ? ' is-on' : ''}">${i < have ? icon : `<b>${i + 1}</b>`}</span>`).join('');
  const style = [`--lc-bg:${c.bg}`, `--lc-fg:${c.fg}`, `--lc-label:${c.label}`, `--lc-accent:${c.accent}`].join(';');
  const expired = isExpired(state.expiresAt);
  const showExpiry = Number(c.validityMonths) > 0 || state.expiresAt;
  const banner = expired
    ? '<div class="lc-reward lc-reward--off">Tarjeta vencida · pasa a caja para renovarla</div>'
    : state.rewards > 0
      ? `<div class="lc-reward">🎁 ${state.rewards > 1 ? `${state.rewards} recompensas listas` : 'Recompensa lista'} · ${esc(c.rewardText)}</div>`
      : '';
  const expiryField = showExpiry
    ? `<div class="lc-field lc-field--right"><span>${expired ? 'VENCIÓ' : 'VENCE'}</span><strong>${esc(fmtExpiry(state.expiresAt || computeExpiry(c)))}</strong></div>`
    : '';
  const qr = state.qr || state.code ? `<footer class="lc-qr">
        <div class="lc-qr__box">${state.qr || '<div class="lc-qr__ph"></div>'}</div>
        ${state.code ? `<small>${esc(state.code)}</small>` : ''}
      </footer>` : '';

  if (c.layout === 'art') {
    return `
    <article class="lc lc--art${expired ? ' is-expired' : ''}" style="${esc(style)}">
      <div class="lca-art" data-art="${esc(c.artImage || '')}">
        ${c.logo ? `<img class="lca-logo" alt="" data-src="${esc(c.logo)}">` : ''}
        ${c.title ? `<h3 class="lca-title">${esc(c.title)}</h3>` : ''}
        <div class="lca-stamps" style="--cols:${cols}">${stamps}</div>
        ${c.subtitle ? `<p class="lca-sub"><span>${esc(c.subtitle)}</span></p>` : ''}
      </div>
      <div class="lca-stub">
        ${banner}
        <div class="lc-fields">
          <div class="lc-field"><span>MIEMBRO</span><strong>${esc(state.name || 'Tu nombre')}</strong></div>
          <div class="lc-field lc-field--right"><span>SELLOS</span><strong>${have} / ${total}</strong></div>
        </div>
        <div class="lc-fields">
          <div class="lc-field"><span>RECOMPENSA</span><strong>${esc(c.rewardText)}</strong></div>
          ${expiryField}
        </div>
        ${qr}
      </div>
    </article>`;
  }

  return `
    <article class="lc${c.pattern ? ' has-pattern' : ''}${c.bgImage ? ' has-image' : ''}${expired ? ' is-expired' : ''}" style="${esc(style)}" data-bg-image="${esc(c.bgImage || '')}">
      <header class="lc-top">
        ${c.logo ? `<img class="lc-logo" alt="" data-src="${esc(c.logo)}">` : `<span class="lc-logo-text">${esc(cfg.programName || '')}</span>`}
        <div class="lc-field lc-field--right"><span>SELLOS</span><strong>${have} / ${total}</strong></div>
      </header>
      <p class="lc-program">${esc(cfg.programName || '')}</p>
      <div class="lc-strip" style="--cols:${cols}">${stamps}</div>
      ${banner}
      <div class="lc-fields">
        <div class="lc-field"><span>MIEMBRO</span><strong>${esc(state.name || 'Tu nombre')}</strong></div>
        <div class="lc-field lc-field--right"><span>RECOMPENSA</span><strong>${esc(c.rewardText)}</strong></div>
      </div>
      ${showExpiry ? `<div class="lc-fields"><span></span>${expiryField}</div>` : ''}
      ${qr}
    </article>`;
}

// Resuelve imágenes (incluidas las guardadas en Firestore como "media:ID") dentro de la tarjeta.
export function hydrateCard(root, resolve) {
  const abs = (u) => `url("${new URL(u, location.href).href.replace(/"/g, '%22')}")`;
  root.querySelectorAll('img[data-src]').forEach((img) => {
    resolve(img.dataset.src).then((u) => { if (u) img.src = u; });
  });
  root.querySelectorAll('[data-art]').forEach((el) => {
    if (el.dataset.art) resolve(el.dataset.art).then((u) => { if (u) el.style.backgroundImage = abs(u); });
  });
  const card = root.querySelector('.lc[data-bg-image]');
  const src = card?.dataset.bgImage;
  if (src) resolve(src).then((u) => { if (u) card.style.setProperty('--lc-img', abs(u)); });
}

export async function qrSvg(text) {
  const { default: qrcode } = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

// Texto de notificación con variables: {nombre}, {faltan}, {recompensa}, {promo}
export function fillMessage(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

export const normalizePhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);
