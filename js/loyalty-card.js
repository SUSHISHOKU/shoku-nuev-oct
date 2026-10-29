// Tarjeta de fidelidad: configuración por defecto y dibujo de la tarjeta.
// Se usa en membresia.html (cliente) y en admin.html (vista previa y registro de visitas).
import { esc, safeUrl } from './util.js';

export const DEFAULT_LOYALTY = {
  enabled: true,
  programName: 'SHOKU CLUB',
  card: {
    bg: '#121214',
    fg: '#f5f1ea',
    label: '#c9a45c',
    accent: '#c9a45c',
    bgImage: '',
    logo: 'img/logo.webp',
    pattern: true,
    stampType: 'sushi', // star | sushi | emoji | image
    stampEmoji: '🍣',
    stampImage: '',
    stampsRequired: 8,
    rewardText: '1 rollo de la casa gratis',
    headline: 'Junta tus sellos y llévate un rollo gratis'
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

export function stampIcon(card) {
  switch (card.stampType) {
    case 'star': return STAR;
    case 'emoji': return `<span class="lc-emoji">${esc(card.stampEmoji || '⭐')}</span>`;
    case 'image': return card.stampImage ? `<img alt="" data-src="${esc(card.stampImage)}">` : STAR;
    default: return SUSHI;
  }
}

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';

// Devuelve el HTML de la tarjeta. state = { name, stamps, rewards, qr (svg), code }
export function renderCard(cfg, state = {}) {
  const c = { ...DEFAULT_LOYALTY.card, ...(cfg.card || {}) };
  const total = Math.max(1, Math.min(20, Number(c.stampsRequired) || 8));
  const have = Math.max(0, Math.min(total, Number(state.stamps) || 0));
  const cols = total <= 5 ? total : Math.ceil(total / 2);
  const icon = stampIcon(c);
  const stamps = Array.from({ length: total }, (_, i) =>
    `<span class="lc-stamp${i < have ? ' is-on' : ''}">${i < have ? icon : `<b>${i + 1}</b>`}</span>`).join('');
  const bgImage = safeUrl(c.bgImage) && !c.bgImage.startsWith('media:') ? c.bgImage : '';
  const style = [
    `--lc-bg:${c.bg}`, `--lc-fg:${c.fg}`, `--lc-label:${c.label}`, `--lc-accent:${c.accent}`,
    bgImage ? `--lc-img:url("${bgImage.replace(/"/g, '%22')}")` : ''
  ].filter(Boolean).join(';');

  return `
    <article class="lc${c.pattern ? ' has-pattern' : ''}${bgImage || c.bgImage ? ' has-image' : ''}" style="${esc(style)}" data-bg-image="${esc(c.bgImage || '')}">
      <header class="lc-top">
        ${c.logo ? `<img class="lc-logo" alt="" data-src="${esc(c.logo)}">` : `<span class="lc-logo-text">${esc(cfg.programName || '')}</span>`}
        <div class="lc-field lc-field--right"><span>SELLOS</span><strong>${have} / ${total}</strong></div>
      </header>
      <p class="lc-program">${esc(cfg.programName || '')}</p>
      <div class="lc-strip" style="--cols:${cols}">${stamps}</div>
      ${state.rewards > 0 ? `<div class="lc-reward">🎁 ${state.rewards > 1 ? `${state.rewards} recompensas listas` : 'Recompensa lista'} · ${esc(c.rewardText)}</div>` : ''}
      <div class="lc-fields">
        <div class="lc-field"><span>MIEMBRO</span><strong>${esc(state.name || 'Tu nombre')}</strong></div>
        <div class="lc-field lc-field--right"><span>RECOMPENSA</span><strong>${esc(c.rewardText)}</strong></div>
      </div>
      ${state.qr || state.code ? `<footer class="lc-qr">
        <div class="lc-qr__box">${state.qr || '<div class="lc-qr__ph"></div>'}</div>
        ${state.code ? `<small>${esc(state.code)}</small>` : ''}
      </footer>` : ''}
    </article>`;
}

// Resuelve imágenes (incluidas las guardadas en Firestore como "media:ID") dentro de la tarjeta.
export function hydrateCard(root, resolve) {
  root.querySelectorAll('img[data-src]').forEach((img) => {
    resolve(img.dataset.src).then((u) => { if (u) img.src = u; });
  });
  const card = root.querySelector('.lc[data-bg-image]');
  const src = card?.dataset.bgImage;
  if (src && src.startsWith('media:')) {
    resolve(src).then((u) => { if (u) card.style.setProperty('--lc-img', `url("${u}")`); });
  }
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
