import { DEFAULT_DATA } from './menu-data.js';
import { esc, safeUrl, formatPrice, telHref, normalizeData } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);
const CACHE_KEY = 'shoku-menu-cache-v1';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Fuerza un reflow antes de agregar la clase para que la transición CSS arranque,
// sin depender de requestAnimationFrame (que no corre si la pestaña está en segundo plano).
const enter = (el, cls) => { void el.offsetWidth; el.classList.add(cls); };
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

let data = normalizeData(DEFAULT_DATA, readCache());
let firebase = null; // módulo js/firebase.js, cargado de forma diferida
let menuRendered = false;
let navDepth = 0;
let currentSection = null;
let carouselTimer = null;
let carouselRestart = null;

/* ---------- Datos ---------- */

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(d) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
}

async function loadRemote() {
  try {
    firebase = firebase || await import('./firebase.js');
    const remote = await Promise.race([
      firebase.fetchMenu(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))
    ]);
    if (!remote) return;
    writeCache(remote);
    data = normalizeData(DEFAULT_DATA, remote);
    applySettings();
    if (menuRendered && !currentSection) renderCards();
  } catch (err) {
    console.warn('[Shoku] Usando menú local:', err?.message || err);
  }
  loadAnalytics();
}

async function loadAnalytics() {
  try {
    const { getAnalytics, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js');
    if (await isSupported()) getAnalytics(firebase.app);
  } catch { /* analytics es opcional */ }
}

// Devuelve la URL final de una imagen; las fotos guardadas en Firestore ("media:ID") se resuelven aparte.
async function resolveSrc(src) {
  if (!src) return '';
  if (!src.startsWith('media:')) return safeUrl(src);
  firebase = firebase || await import('./firebase.js');
  return firebase.resolveMedia(src);
}
const setImg = (img, src) => resolveSrc(src).then((u) => { if (u) img.src = u; });
const setBg = (el, src) => resolveSrc(src).then((u) => { if (u) el.style.backgroundImage = `url("${u.replace(/"/g, '%22')}")`; });

/* ---------- Ajustes generales (inicio, logo, colores) ---------- */

function applySettings() {
  const s = data.settings;
  const h = s.home;
  document.documentElement.style.setProperty('--gold', s.accent || '#c9a45c');
  document.documentElement.style.setProperty('--overlay', String(h.overlay ?? .45));

  document.querySelectorAll('.js-logo, #home-logo').forEach((img) => setImg(img, s.logo));
  $('#home-logo').hidden = h.showLogo === false;
  $('#home-tagline').textContent = s.tagline || '';
  $('#menu-label').textContent = h.menuLabel || 'MENÚ';

  const video = $('#home-video');
  if (h.poster) resolveSrc(h.poster).then((u) => { if (u) video.poster = u; });
  const videoSrc = safeUrl(h.video);
  const source = video.querySelector('source');
  if (videoSrc && source.getAttribute('src') !== videoSrc) {
    source.setAttribute('src', videoSrc);
    video.load();
    video.play().catch(() => {});
  }

  const ig = $('#ig-link');
  ig.hidden = !h.instagram?.visible || !safeUrl(h.instagram.url);
  if (!ig.hidden) { ig.href = safeUrl(h.instagram.url); setImg($('#ig-icon'), h.instagram.icon || 'ig.png'); }
  const tel = $('#tel-link');
  tel.hidden = !h.phone?.visible || !h.phone.number;
  if (!tel.hidden) { tel.href = telHref(h.phone.number); setImg($('#tel-icon'), h.phone.icon || 'tel.png'); }

  const nav = $('#home-buttons');
  nav.querySelectorAll('a.btn').forEach((a) => a.remove());
  (h.buttons || []).filter((b) => b.visible !== false && safeUrl(b.url)).forEach((b) => {
    const a = document.createElement('a');
    a.className = 'btn';
    a.href = safeUrl(b.url);
    if (/^https?:/i.test(a.getAttribute('href'))) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    a.textContent = b.label;
    nav.appendChild(a);
  });

  $('#book-title').textContent = s.book?.title || 'MENÚ';
  $('#book-inner-title').textContent = s.menu?.title || 'MENÚ';
  const cover = $('#book-cover');
  cover.classList.toggle('has-image', !!s.book?.cover);
  if (s.book?.cover) setBg(cover.firstElementChild, s.book.cover);

  $('#menu-title').textContent = s.menu?.title || 'MENÚ';
  $('#menu-disclaimer').textContent = s.menu?.disclaimer || '';
  setBg($('#menu-bg'), s.menu?.background);
  document.title = `${s.brandName || 'Shoku'} · Menú`;

  const social = $('#menu-social');
  social.innerHTML = '';
  if (!ig.hidden) social.appendChild(cloneIcon(ig));
  if (!tel.hidden) social.appendChild(cloneIcon(tel));
}
function cloneIcon(a) {
  const c = a.cloneNode(true);
  c.removeAttribute('id');
  c.querySelector('img')?.removeAttribute('id');
  return c;
}

/* ---------- Tarjetas de secciones ---------- */

const visibleSections = () => data.sections.filter((s) => !s.hidden);

function renderCards() {
  const wrap = $('#cards');
  const sections = visibleSections();
  wrap.innerHTML = sections.map((s) => `
    <button class="card" type="button" data-section="${esc(s.id)}">
      <img alt="" loading="lazy" decoding="async" data-src="${esc(s.cover || s.images[0] || '')}">
      <span class="card__label">
        <span><h2>${esc(s.name)}</h2><small>VER MENÚ</small></span>
        <span class="card__go">${ICON_NEXT}</span>
      </span>
    </button>`).join('') || '<p class="loading">Menú no disponible por el momento.</p>';
  wrap.querySelectorAll('img[data-src]').forEach((img) => setImg(img, img.dataset.src));

  const io = 'IntersectionObserver' in window && !reduceMotion
    ? new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { threshold: .15 })
    : null;
  wrap.querySelectorAll('.card').forEach((c, idx) => {
    c.style.transitionDelay = `${Math.min(idx % 3, 2) * 80}ms`;
    if (io) io.observe(c); else c.classList.add('is-in');
  });
  menuRendered = true;
}

/* ---------- Hoja de sección ---------- */

function renderSection(s) {
  const sections = visibleSections();
  const idx = sections.findIndex((x) => x.id === s.id);
  const prev = sections[idx - 1];
  const next = sections[idx + 1];
  const imgs = s.images.length ? s.images : (s.cover ? [s.cover] : []);

  const shown = s.groups.filter((gr) => gr.items.some((it) => !it.hidden));
  const chips = shown.length > 2 && shown.every((gr) => gr.title)
    ? `<nav class="chips" aria-label="Subsecciones">${shown.map((gr, n) => `<button type="button" data-jump="g${n}">${esc(gr.title)}</button>`).join('')}</nav>`
    : '';
  const groups = shown.map((gr, n) => {
    const items = gr.items.filter((it) => !it.hidden);
    const compact = items.every((it) => !it.desc) && items.length > 2;
    return `
      <section class="group" id="g${n}">
        ${gr.title ? `<h3 class="group__title">${esc(gr.title)}</h3>` : ''}
        ${gr.note ? `<p class="group__note">${esc(gr.note)}</p>` : ''}
        <ul class="items${compact ? ' items--compact' : ''}">
          ${items.map((it) => `
            <li class="item">
              <div class="item__row">
                <span class="item__name">${esc(it.name)}${it.tag ? `<span class="tag">${esc(it.tag)}</span>` : ''}</span>
                <span class="item__dots"></span>
                <span class="item__price">${esc(formatPrice(it.price))}</span>
              </div>
              ${it.desc ? `<p class="item__desc">${esc(it.desc)}</p>` : ''}
            </li>`).join('')}
        </ul>
      </section>`;
  }).join('');

  $('#sheet-title').textContent = s.name;
  $('#sheet-body').innerHTML = `
    ${imgs.length ? `
      <div class="carousel" id="carousel">
        ${imgs.map((src, n) => `<img alt="" decoding="async" class="${n === 0 ? 'is-active' : ''}" data-src="${esc(src)}">`).join('')}
        ${imgs.length > 1 ? `
          <button class="carousel__nav carousel__nav--prev" type="button" aria-label="Foto anterior">${ICON_PREV}</button>
          <button class="carousel__nav carousel__nav--next" type="button" aria-label="Foto siguiente">${ICON_NEXT}</button>
          <div class="carousel__dots">${imgs.map((_, n) => `<button type="button" aria-label="Foto ${n + 1}" class="${n === 0 ? 'is-active' : ''}"></button>`).join('')}</div>` : ''}
      </div>` : ''}
    ${s.promo ? `<div class="promo">${esc(s.promo)}</div>` : ''}
    ${chips}
    ${groups || '<p class="loading">Próximamente</p>'}
    <div class="sheet__notes">
      ${s.note ? `<p>${esc(s.note)}</p>` : ''}
      ${data.settings.menu?.disclaimer ? `<p>${esc(data.settings.menu.disclaimer)}</p>` : ''}
    </div>
    <nav class="sheet__pager">
      ${prev ? `<button class="pager-btn" type="button" data-goto="${esc(prev.id)}"><small>ANTERIOR</small>${esc(prev.name)}</button>` : '<span></span>'}
      ${next ? `<button class="pager-btn pager-btn--next" type="button" data-goto="${esc(next.id)}"><small>SIGUIENTE</small>${esc(next.name)}</button>` : ''}
    </nav>`;
  $('#sheet-body').querySelectorAll('img[data-src]').forEach((img) => setImg(img, img.dataset.src));
  $('#sheet-panel').scrollTop = 0;
  startCarousel();
}

function startCarousel() {
  stopCarouselFully();
  const root = $('#carousel');
  if (!root) return;
  const slides = [...root.querySelectorAll('img')];
  const dots = [...root.querySelectorAll('.carousel__dots button')];
  if (slides.length < 2) return;
  let cur = 0;
  const show = (n) => {
    slides[cur].classList.remove('is-active'); dots[cur]?.classList.remove('is-active');
    cur = (n + slides.length) % slides.length;
    slides[cur].classList.add('is-active'); dots[cur]?.classList.add('is-active');
  };
  const restart = () => { clearInterval(carouselTimer); carouselTimer = setInterval(() => show(cur + 1), 3500); };
  carouselRestart = restart;
  dots.forEach((d, n) => d.addEventListener('click', () => { show(n); restart(); }));
  root.querySelector('.carousel__nav--prev').addEventListener('click', () => { show(cur - 1); restart(); });
  root.querySelector('.carousel__nav--next').addEventListener('click', () => { show(cur + 1); restart(); });
  let x0 = null;
  root.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) { show(cur + (dx < 0 ? 1 : -1)); restart(); }
    x0 = null;
  });
  restart();
}
function stopCarousel() { clearInterval(carouselTimer); carouselTimer = null; }
function stopCarouselFully() { stopCarousel(); carouselRestart = null; }

function openSheet(id) {
  const s = visibleSections().find((x) => x.id === id);
  if (!s) return false;
  currentSection = s.id;
  renderSection(s);
  const sheet = $('#sheet');
  if (sheet.hidden) {
    sheet.hidden = false;
    document.documentElement.classList.add('lock');
    enter(sheet, 'is-open');
    setTimeout(() => $('#sheet-close').focus({ preventScroll: true }), 50);
  }
  return true;
}
function closeSheet() {
  const sheet = $('#sheet');
  if (sheet.hidden) return;
  stopCarouselFully();
  sheet.classList.remove('is-open');
  document.documentElement.classList.remove('lock');
  const last = currentSection;
  currentSection = null;
  setTimeout(() => {
    sheet.hidden = true;
    $(`.card[data-section="${CSS.escape(last || '')}"]`)?.focus({ preventScroll: true });
  }, 350);
}

/* ---------- Vistas y animación del libro ---------- */

function showHome() {
  closeSheet();
  const menu = $('#menu');
  menu.classList.remove('is-visible');
  $('#home').classList.remove('is-away');
  setTimeout(() => { if (!location.hash.startsWith('#menu')) menu.hidden = true; }, 600);
  $('#home-video').play().catch(() => {});
}

let bookPlaying = false;
function playBook() {
  return new Promise((resolve) => {
    const stage = $('#book-stage');
    if (reduceMotion || document.hidden) return resolve();
    bookPlaying = true;
    stage.hidden = false;
    stage.className = 'book-stage';
    const timers = [];
    const finish = () => {
      if (!bookPlaying) return;
      bookPlaying = false;
      timers.forEach(clearTimeout);
      stage.classList.add('is-zoom');
      resolve();
      setTimeout(() => { stage.hidden = true; stage.className = 'book-stage'; }, 800);
    };
    stage.onclick = finish;
    enter(stage, 'is-visible');
    timers.push(setTimeout(() => stage.classList.add('is-open'), 650));
    timers.push(setTimeout(finish, 2500));
  });
}

async function showMenu({ animate }) {
  if (!menuRendered) renderCards();
  const menu = $('#menu');
  const wasHidden = menu.hidden;
  if (wasHidden && animate) await playBook();
  $('#home').classList.add('is-away');
  menu.hidden = false;
  enter(menu, 'is-visible');
  if (wasHidden) window.scrollTo(0, 0);
  $('#home-video').pause();
}

async function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash.startsWith('menu')) return showHome();
  const sectionId = hash.split('/')[1];
  await showMenu({ animate: !sectionId || $('#menu').hidden });
  if (sectionId) { if (!openSheet(sectionId)) history.replaceState(null, '', '#menu'); }
  else closeSheet();
}

function go(hash) {
  history.pushState(null, '', hash || location.pathname + location.search);
  navDepth++;
  route();
}
function goBack(fallback) {
  if (navDepth > 0) history.back();
  else { history.replaceState(null, '', fallback || location.pathname + location.search); route(); }
}

/* ---------- Eventos ---------- */

$('#open-menu').addEventListener('click', () => go('#menu'));
$('#back-home').addEventListener('click', () => goBack(''));
$('#sheet-close').addEventListener('click', () => goBack('#menu'));
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') goBack('#menu'); });
$('#cards').addEventListener('click', (e) => {
  const card = e.target.closest('[data-section]');
  if (card) go(`#menu/${encodeURIComponent(card.dataset.section)}`);
});
$('#sheet-body').addEventListener('click', (e) => {
  const j = e.target.closest('[data-jump]');
  if (j) {
    const target = document.getElementById(j.dataset.jump);
    const panel = $('#sheet-panel');
    panel.scrollTo({ top: target.offsetTop - $('.sheet__bar').offsetHeight - 10, behavior: reduceMotion ? 'auto' : 'smooth' });
    return;
  }
  const b = e.target.closest('[data-goto]');
  if (b) { history.replaceState(null, '', `#menu/${encodeURIComponent(b.dataset.goto)}`); route(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#sheet').hidden) goBack('#menu');
});
window.addEventListener('popstate', () => { navDepth = Math.max(0, navDepth - 1); route(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopCarousel(); else carouselRestart?.();
});

applySettings();
route();
loadRemote();
