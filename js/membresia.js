import { db, resolveMedia } from './firebase.js';
import { doc, getDoc, collection, writeBatch, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { DEFAULT_LOYALTY, renderCard, hydrateCard, qrSvg, normalizePhone, firstName } from './loyalty-card.js';
import { esc, safeUrl, deepMerge } from './util.js';

const $ = (s) => document.querySelector(s);
const STORE_KEY = 'shoku-card-id';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
let cfg = structuredClone(DEFAULT_LOYALTY);
let unsubscribe = null;

const resolveSrc = (src) => Promise.resolve(src?.startsWith('media:') ? resolveMedia(src) : safeUrl(src));
const store = {
  get() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(STORE_KEY, v) : localStorage.removeItem(STORE_KEY); } catch { /* sin almacenamiento */ } }
};
const cardUrl = (id) => `${location.origin}${location.pathname}?c=${encodeURIComponent(id)}`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-on');
  setTimeout(() => t.classList.remove('is-on'), 2600);
}

async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, 'site', 'loyalty'));
    if (snap.exists()) cfg = deepMerge(DEFAULT_LOYALTY, snap.data());
  } catch (err) { console.warn('[Shoku] Config de tarjeta local:', err.message); }
  document.documentElement.style.setProperty('--gold', cfg.card.accent || '#c9a45c');
  $('#program-name').textContent = cfg.programName;
  $('#headline').textContent = cfg.card.headline || '';
  $('#terms').textContent = cfg.terms || '';
  $('#privacy-text').textContent = `Acepto el aviso de privacidad: ${cfg.privacy || ''}`;
  resolveSrc(cfg.card.logo).then((u) => { if (u) $('#bar-logo').src = u; });
  renderPromos();
}

function renderPromos() {
  const list = (cfg.promotions || []).filter((p) => p.active && (!p.until || p.until >= today()));
  $('#promos').hidden = !list.length;
  $('#promo-list').innerHTML = list.map((p) => `
    <article class="promo-card">
      <h3>${esc(p.title)}</h3>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      ${p.until ? `<small>Válida hasta el ${esc(new Date(`${p.until}T12:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }))}</small>` : ''}
    </article>`).join('');
}

function paintCard(state, sample = false) {
  const slot = $('#card-slot');
  slot.classList.toggle('is-sample', sample);
  slot.innerHTML = renderCard(cfg, state);
  hydrateCard(slot, resolveSrc);
  // La animación de entrada solo se ve la primera vez, no en cada actualización de sellos.
  setTimeout(() => slot.classList.add('is-painted'), 1000);
}

/* ---------- Registro ---------- */

function showSignup() {
  unsubscribe?.();
  $('#signup').hidden = false;
  $('#mine').hidden = true;
  paintCard({ name: 'Tu nombre', stamps: Math.min(3, cfg.card.stampsRequired - 1) }, true);
}

$('#signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const err = $('#signup-error');
  const name = f.name.value.trim().replace(/\s+/g, ' ');
  const phone = normalizePhone(f.phone.value);
  const email = f.email.value.trim().toLowerCase();
  const birthday = f.birthday.value;
  const bad = (input, msg) => { input.setAttribute('aria-invalid', 'true'); input.focus(); err.textContent = msg; };
  f.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));

  if (name.length < 3) return bad(f.name, 'Escribe tu nombre completo.');
  if (phone.length !== 10) return bad(f.phone, 'El teléfono debe tener 10 dígitos.');
  if (!birthday || birthday > today()) return bad(f.birthday, 'Revisa tu fecha de cumpleaños.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(f.email, 'Revisa tu correo.');
  if (!f.consent.checked) { err.textContent = 'Debes aceptar el aviso de privacidad.'; return; }

  err.textContent = '';
  const btn = $('#signup-btn');
  btn.disabled = true;
  btn.textContent = 'Creando tu tarjeta…';
  try {
    const id = doc(collection(db, 'customers')).id;
    const batch = writeBatch(db);
    batch.set(doc(db, 'customers', id), {
      name, phone, birthday, email, consent: true, source: 'membresia',
      stamps: 0, visits: 0, rewardsAvailable: 0, rewardsEarned: 0, rewardsRedeemed: 0,
      lastVisit: null, createdAt: serverTimestamp()
    });
    batch.set(doc(db, 'cards', id), {
      firstName: firstName(name), stamps: 0, rewardsAvailable: 0,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    // Índice por teléfono: solo se puede crear una vez, así evitamos tarjetas duplicadas.
    batch.set(doc(db, 'phones', phone), { cardId: id });
    await batch.commit();
    store.set(id);
    history.replaceState(null, '', `?c=${id}`);
    showCard(id, true);
  } catch (ex) {
    err.textContent = ex.code === 'permission-denied'
      ? 'Ese teléfono ya tiene una tarjeta. Si la perdiste, pídela en caja y te la reenviamos.'
      : 'No pudimos crear tu tarjeta. Revisa tu conexión e inténtalo de nuevo.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Obtener mi tarjeta';
  }
});

/* ---------- Tarjeta del cliente ---------- */

const APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>';
const GOOGLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z"/></svg>';

function renderWallet(id) {
  const w = cfg.wallet || {};
  const base = safeUrl(w.apiBase).replace(/\/$/, '');
  const ua = navigator.userAgent;
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const isAndroid = /Android/.test(ua);
  const buttons = [];
  if (base && w.apple && !isAndroid) buttons.push(`<a class="wallet-btn" href="${esc(`${base}/applePass?c=${encodeURIComponent(id)}`)}">${APPLE} Agregar a Apple Wallet</a>`);
  if (base && w.google && !isApple) buttons.push(`<a class="wallet-btn" href="${esc(`${base}/googlePass?c=${encodeURIComponent(id)}`)}" target="_blank" rel="noopener">${GOOGLE} Agregar a Google Wallet</a>`);
  $('#wallet-buttons').innerHTML = buttons.join('');
  $('#wallet-note').textContent = buttons.length
    ? 'Agrégala a tu Wallet y recibe avisos de tus sellos y promociones.'
    : `Muy pronto podrás agregarla a Apple Wallet y Google Wallet. Mientras tanto, guarda esta página: ${isApple ? 'toca Compartir → “Agregar a inicio”' : 'abre el menú del navegador → “Agregar a pantalla principal”'}.`;
}

async function showCard(id, isNew = false) {
  $('#signup').hidden = true;
  $('#mine').hidden = false;
  renderWallet(id);
  const qr = await qrSvg(cardUrl(id)).catch(() => '');
  const code = id.slice(0, 6).toUpperCase();
  paintCard({ name: '', stamps: 0, qr, code });
  unsubscribe?.();
  unsubscribe = onSnapshot(doc(db, 'cards', id), (snap) => {
    if (!snap.exists()) {
      store.set(null);
      toast('No encontramos esa tarjeta.');
      history.replaceState(null, '', location.pathname);
      return showSignup();
    }
    const c = snap.data();
    paintCard({ name: c.firstName, stamps: c.stamps, rewards: c.rewardsAvailable, qr, code });
  }, () => toast('Sin conexión: mostrando tu tarjeta guardada.'));
  if (isNew) toast('¡Listo! Tu tarjeta fue creada.');
}

$('#copy-link').addEventListener('click', async () => {
  const id = new URLSearchParams(location.search).get('c') || store.get();
  try { await navigator.clipboard.writeText(cardUrl(id)); toast('Enlace copiado'); } catch { prompt('Copia tu enlace:', cardUrl(id)); }
});
$('#not-me').addEventListener('click', () => {
  store.set(null);
  history.replaceState(null, '', location.pathname);
  showSignup();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

await loadConfig();
const id = new URLSearchParams(location.search).get('c') || store.get();
if (id && /^[A-Za-z0-9]{10,40}$/.test(id)) { store.set(id); showCard(id); } else showSignup();
