import { DEFAULT_DATA } from './menu-data.js';
import { app, db, MENU_DOC, MEDIA_COLLECTION, MEDIA_PREFIX, usernameToEmail, resolveMedia } from './firebase.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { safeUrl, formatPrice, normalizeData, slugify } from './util.js';

const auth = getAuth(app);
const $ = (s) => document.querySelector(s);

// Imágenes incluidas en el sitio, para elegirlas sin tener que subirlas.
const SITE_IMAGES = [
  'entradas', 'entradas1', 'entradas2', 'entradas3', 'rollos', 'rollof1', 'rollof2', 'rollof3',
  'teppan', 'plati1', 'plati2', 'plati3', 'especiales', 'especiales1', 'especiales2', 'kids', 'kids1', 'kids2',
  'combos', 'comb1', 'comb2', 'postres', 'postres1', 'postres2', 'bebidas', 'bebi1', 'bebi2', 'bebi3', 'fondot', 'logo'
].map((n) => `img/${n}.webp`).concat(['ig.png', 'tel.png']);

let data = null;
let savedJSON = '';
let meta = {};
let view = { type: 'section', id: null };
let storageOk = null;

/* ==================== Utilidades de interfaz ==================== */

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Campo de texto enlazado a obj[key]: cada tecla actualiza los datos sin volver a pintar.
function bound(obj, key, { multiline = false, onChange, ...attrs } = {}) {
  const grow = (el) => { el.style.height = 'auto'; el.style.height = `${el.scrollHeight + 2}px`; };
  const el = h(multiline ? 'textarea' : 'input', {
    type: multiline ? null : (attrs.type || 'text'),
    rows: multiline ? (attrs.rows || 2) : null,
    ...attrs,
    value: obj[key] ?? '',
    oninput: (e) => { obj[key] = e.target.value; if (multiline) grow(el); changed(); onChange?.(e.target.value); }
  });
  if (multiline) requestAnimationFrame(() => grow(el));
  return el;
}
const field = (label, control, hint) => h('label', { class: 'field' }, h('span', { text: label }), control, hint ? h('small', { text: hint }) : null);
function toggle(obj, key, label, { invert = false, rerender = true } = {}) {
  return h('label', { class: 'check' },
    h('input', {
      type: 'checkbox', checked: invert ? !obj[key] : !!obj[key],
      onchange: (e) => { obj[key] = invert ? !e.target.checked : e.target.checked; changed(); if (rerender) render(); }
    }), label);
}
const iconBtn = (label, title, onclick, cls = '') => h('button', { type: 'button', class: `icon-btn ${cls}`, title, 'aria-label': title, onclick }, label);
function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  changed(); render();
}
function removeAt(arr, i, what) {
  if (!confirm(`¿Eliminar ${what}? Podrás deshacerlo solo si no publicas.`)) return;
  arr.splice(i, 1);
  changed(); render();
}

let toastTimer;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast is-on ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, type === 'error' ? 6500 : 3200);
}

/* ==================== Estado y guardado ==================== */

const isDirty = () => data && JSON.stringify(data) !== savedJSON;
function changed() {
  const dirty = isDirty();
  $('#publish-btn').disabled = !dirty;
  const st = $('#status');
  st.className = `status ${dirty ? 'dirty' : 'saved'}`;
  st.textContent = dirty ? 'Cambios sin publicar' : (meta.updatedAt ? 'Publicado' : 'Sin publicar');
}

async function loadData() {
  $('#editor').replaceChildren(h('p', { class: 'empty', text: 'Cargando menú…' }));
  let remote = null;
  try {
    const snap = await getDoc(doc(db, ...MENU_DOC));
    remote = snap.exists() ? snap.data() : null;
  } catch (err) {
    toast(`No se pudo leer Firebase: ${err.message}`, 'error');
  }
  meta = {};
  if (remote) {
    meta = { updatedAt: remote.updatedAt?.toDate?.(), updatedBy: remote.updatedBy };
    delete remote.updatedAt; delete remote.updatedBy;
  }
  data = normalizeData(DEFAULT_DATA, remote);
  savedJSON = remote ? JSON.stringify(data) : '';
  meta.isNew = !remote;
  view = { type: 'section', id: data.sections[0]?.id };
  render();
  changed();
}

async function publish() {
  const btn = $('#publish-btn');
  const json = JSON.stringify(data);
  if (new Blob([json]).size > 950_000) {
    toast('El menú es demasiado grande para guardarse. Revisa que no haya fotos pegadas como texto.', 'error');
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Publicando…';
  try {
    await setDoc(doc(db, ...MENU_DOC), { ...JSON.parse(json), updatedAt: serverTimestamp(), updatedBy: auth.currentUser?.email || '' });
    savedJSON = json;
    meta = { updatedAt: new Date(), updatedBy: auth.currentUser?.email, isNew: false };
    toast('¡Cambios publicados! Ya se ven en el sitio.', 'ok');
    if (view.type === 'backup') render();
  } catch (err) {
    toast(err.code === 'permission-denied'
      ? 'Firebase rechazó el guardado: revisa las reglas de Firestore (archivo firestore.rules).'
      : `No se pudo publicar: ${err.message}`, 'error');
  } finally {
    btn.textContent = 'Publicar cambios';
    changed();
  }
}

/* ==================== Imágenes y video ==================== */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Formato de imagen no compatible. Usa JPG, PNG o WebP.')); };
    img.src = url;
  });
}
async function compress(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let blob = await new Promise((r) => c.toBlob(r, 'image/webp', quality));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', quality));
  return blob;
}
const blobToDataUrl = (blob) => new Promise((resolve) => {
  const fr = new FileReader();
  fr.onload = () => resolve(fr.result);
  fr.readAsDataURL(blob);
});

async function uploadToStorage(blob, folder, name) {
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  const storage = getStorage(app);
  storage.maxUploadRetryTime = 15000;
  storage.maxOperationRetryTime = 15000;
  const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  const r = ref(storage, `${folder}/${Date.now()}-${slugify(name.replace(/\.[^.]+$/, ''))}.${ext}`);
  await uploadBytes(r, blob, { contentType: blob.type, cacheControl: 'public, max-age=31536000' });
  return getDownloadURL(r);
}

// Sube una foto: primero intenta Firebase Storage; si no está activo, la guarda comprimida en Firestore.
async function uploadImage(file) {
  const img = await loadImage(file);
  if (storageOk !== false) {
    try {
      const url = await uploadToStorage(await compress(img, 1800, .84), 'imagenes', file.name);
      storageOk = true;
      return url;
    } catch (err) {
      console.warn('[Admin] Storage no disponible, se usará Firestore:', err.code || err.message);
      storageOk = false;
    }
  }
  for (const [max, q] of [[1400, .8], [1200, .74], [1000, .68], [800, .62]]) {
    const dataUrl = await blobToDataUrl(await compress(img, max, q));
    if (dataUrl.length < 850_000) {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await setDoc(doc(db, MEDIA_COLLECTION, id), { data: dataUrl, name: file.name, createdAt: serverTimestamp() });
      return MEDIA_PREFIX + id;
    }
  }
  throw new Error('La imagen es demasiado grande.');
}

async function uploadVideo(file) {
  if (file.size > 60 * 1024 * 1024) throw new Error('El video pesa más de 60 MB. Comprímelo antes de subirlo.');
  try {
    return await uploadToStorage(file, 'videos', file.name);
  } catch (err) {
    throw new Error('Para subir videos necesitas activar Firebase Storage (ver LEEME-ADMIN.md). También puedes pegar el enlace directo a un .mp4.');
  }
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = $('#file-input');
    input.value = '';
    input.accept = accept;
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

// Diálogo para elegir imagen o video: subir, galería del sitio o enlace.
function chooseMedia({ video = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (done) return; done = true; dlg.close(); dlg.remove(); resolve(val); };
    const status = h('p', { class: 'picker__path' });
    const upload = async () => {
      const file = await pickFile(video ? 'video/mp4,video/webm' : 'image/*');
      if (!file) return;
      status.textContent = video ? 'Subiendo video… puede tardar un poco.' : 'Optimizando y subiendo foto…';
      try {
        finish(video ? await uploadVideo(file) : await uploadImage(file));
        toast(video ? 'Video subido. Recuerda publicar.' : 'Foto lista. Recuerda publicar.', 'ok');
      } catch (err) {
        status.textContent = '';
        toast(err.code === 'permission-denied' ? 'Sin permiso para subir: revisa las reglas de Firebase.' : err.message, 'error');
      }
    };
    const fromUrl = () => {
      const u = prompt(video ? 'Pega el enlace directo al video (.mp4):' : 'Pega el enlace de la imagen (https://…):');
      if (u == null) return;
      const clean = safeUrl(u);
      if (!clean || !/^https?:/i.test(clean)) return toast('El enlace debe empezar con https://', 'error');
      finish(clean);
    };
    const dlg = h('dialog', { onclose: () => finish(null) },
      h('h3', { text: video ? 'Cambiar video' : 'Cambiar foto' }),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn btn--primary', onclick: upload }, video ? 'Subir video' : 'Subir desde el dispositivo'),
        h('button', { type: 'button', class: 'btn', onclick: fromUrl }, 'Usar un enlace'),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => finish(null) }, 'Cancelar')),
      status,
      video
        ? h('p', { class: 'picker__path', text: 'Video incluido en el sitio: fondo.mp4' }, ' ', h('button', { type: 'button', class: 'btn btn--sm', onclick: () => finish('fondo.mp4') }, 'Usar fondo.mp4'))
        : [h('p', { class: 'mini-label', style: 'margin-top:14px', text: 'O elige una foto del sitio:' }),
          h('div', { class: 'gallery' }, SITE_IMAGES.map((src) =>
            h('button', { type: 'button', title: src, onclick: () => finish(src) }, h('img', { src, alt: '', loading: 'lazy' }))))]);
    document.body.append(dlg);
    dlg.showModal();
  });
}

function preview(src, { video = false, small = false } = {}) {
  const box = h('div', { class: `picker__preview${small ? ' is-small' : ''}` }, src ? '' : 'Sin imagen');
  if (!src) return box;
  const apply = (u) => {
    if (!u) { box.textContent = 'No disponible'; return; }
    box.replaceChildren(video ? h('video', { src: u, muted: true, autoplay: true, loop: true, playsinline: true }) : h('img', { src: u, alt: '' }));
  };
  src.startsWith(MEDIA_PREFIX) ? resolveMedia(src).then(apply) : apply(safeUrl(src));
  return box;
}

function picker(obj, key, { video = false, small = false, clearable = false } = {}) {
  const src = obj[key];
  return h('div', { class: 'picker' },
    preview(src, { video, small }),
    h('div', { class: 'picker__actions' },
      h('div', { class: 'row' },
        h('button', {
          type: 'button', class: 'btn btn--sm',
          onclick: async () => { const v = await chooseMedia({ video }); if (v) { obj[key] = v; changed(); render(); } }
        }, video ? 'Cambiar video' : 'Cambiar foto'),
        clearable && src ? h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { obj[key] = ''; changed(); render(); } }, 'Quitar') : null),
      h('span', { class: 'picker__path', text: src ? (src.startsWith(MEDIA_PREFIX) ? 'Foto guardada en Firebase' : src) : '' })));
}

/* ==================== Navegación ==================== */

function renderNav() {
  const list = $('#section-list');
  list.replaceChildren(...data.sections.map((s) => h('li', {},
    h('button', {
      type: 'button',
      class: view.type === 'section' && view.id === s.id ? 'is-active' : '',
      onclick: () => go({ type: 'section', id: s.id })
    }, h('span', { text: s.name || '(sin nombre)' }), s.hidden ? h('span', { class: 'off', text: 'oculta' }) : null))));
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('is-active', view.type === b.dataset.view));
}
function go(v) {
  view = v;
  if (v.type !== 'search') $('#search').value = '';
  $('#sidebar').classList.remove('is-open');
  render();
  window.scrollTo(0, 0);
}

function render() {
  renderNav();
  const ed = $('#editor');
  let content;
  if (view.type === 'search') content = renderSearch(view.q);
  else if (view.type === 'home') content = renderHome();
  else if (view.type === 'look') content = renderLook();
  else if (view.type === 'backup') content = renderBackup();
  else {
    const s = data.sections.find((x) => x.id === view.id) || data.sections[0];
    if (s) view.id = s.id;
    content = s ? renderSection(s) : h('p', { class: 'empty', text: 'No hay secciones. Crea una nueva.' });
  }
  ed.replaceChildren(...[].concat(content));
}

/* ==================== Vista: sección ==================== */

function itemRow(it, arr, idx, where) {
  return h('div', { class: `item${it.hidden ? ' is-hidden' : ''}` },
    h('div', {}, h('span', { class: 'mini-label', text: 'Platillo' }), bound(it, 'name', { placeholder: 'Nombre del platillo' })),
    h('div', {}, h('span', { class: 'mini-label', text: 'Precio' }), bound(it, 'price', { class: 'price', placeholder: '150', inputmode: 'decimal' })),
    h('div', { class: 'item__tag' }, h('span', { class: 'mini-label', text: 'Etiqueta' }), bound(it, 'tag', { placeholder: 'NUEVO, PICANTE…' })),
    h('div', { class: 'item__tools' },
      iconBtn(it.hidden ? '◌' : '●', it.hidden ? 'Mostrar platillo' : 'Ocultar platillo', () => { it.hidden = !it.hidden; changed(); render(); }),
      where ? null : iconBtn('↑', 'Subir', () => move(arr, idx, -1)),
      where ? null : iconBtn('↓', 'Bajar', () => move(arr, idx, 1)),
      where ? null : iconBtn('⧉', 'Duplicar', () => { arr.splice(idx + 1, 0, structuredClone(it)); changed(); render(); }),
      iconBtn('✕', 'Eliminar platillo', () => removeAt(arr, idx, `"${it.name || 'este platillo'}"`), 'danger')),
    h('div', { class: 'item__desc' }, bound(it, 'desc', { multiline: true, rows: 1, placeholder: 'Descripción / ingredientes (opcional)' })),
    where ? h('button', { type: 'button', class: 'item__where', style: 'text-align:left', onclick: () => go({ type: 'section', id: where.id }) }, `${where.name} › ${where.group}  ·  se muestra como ${formatPrice(it.price) || 'sin precio'}`) : null);
}

function renderSection(s) {
  const idx = data.sections.indexOf(s);
  const newItem = () => ({ name: '', price: '', desc: '', tag: '', hidden: false });

  const groups = s.groups.map((gr, gi) => h('div', { class: 'group' },
    h('div', { class: 'group__head' },
      h('div', { class: 'grid grid--2' },
        field('Subsección', bound(gr, 'title', { placeholder: 'Ej. ROLLOS FRÍOS' })),
        field('Nota de la subsección', bound(gr, 'note', { placeholder: 'Opcional, ej. Incluye arroz' }))),
      h('div', { class: 'row' },
        iconBtn('↑', 'Subir subsección', () => move(s.groups, gi, -1)),
        iconBtn('↓', 'Bajar subsección', () => move(s.groups, gi, 1)),
        iconBtn('✕', 'Eliminar subsección', () => removeAt(s.groups, gi, `la subsección "${gr.title || ''}" y sus ${gr.items.length} platillos`), 'danger'))),
    h('div', { class: 'items' }, gr.items.map((it, ii) => itemRow(it, gr.items, ii))),
    h('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:10px', onclick: () => { gr.items.push(newItem()); changed(); render(); } }, '+ Agregar platillo')));

  return [
    h('h2', { text: s.name || 'Sección' }),
    h('p', { class: 'lead', text: 'Edita nombres, precios y descripciones. Los cambios se ven en el sitio al presionar “Publicar cambios”.' }),
    meta.isNew ? h('div', { class: 'notice', text: 'Aún no has publicado nada en Firebase: estás viendo el menú nuevo (del PDF). Presiona “Publicar cambios” una vez para guardarlo.' }) : null,

    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Datos de la sección' }),
        iconBtn('↑', 'Mover sección arriba', () => move(data.sections, idx, -1)),
        iconBtn('↓', 'Mover sección abajo', () => move(data.sections, idx, 1)),
        h('button', {
          type: 'button', class: 'btn btn--sm btn--danger',
          onclick: () => {
            if (!confirm(`¿Eliminar la sección "${s.name}" completa?`)) return;
            data.sections.splice(idx, 1); changed(); go({ type: 'section', id: data.sections[0]?.id });
          }
        }, 'Eliminar sección')),
      h('div', { class: 'grid grid--2' },
        field('Nombre de la sección', bound(s, 'name', { onChange: renderNav })),
        h('div', { class: 'field' }, h('span', { text: 'Visibilidad' }), toggle(s, 'hidden', 'Mostrar en el menú', { invert: true }))),
      h('div', { class: 'grid grid--2', style: 'margin-top:14px' },
        field('Promoción destacada', bound(s, 'promo', { multiline: true, placeholder: 'Ej. SUSHI AL 2X1 LUNES Y MARTES' })),
        field('Nota al pie', bound(s, 'note', { multiline: true, placeholder: 'Ej. No válida en días festivos' })))),

    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Foto de portada' })),
      picker(s, 'cover')),

    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Carrusel de fotos' }), h('span', { class: 'picker__path', text: 'Cambian solas cada 3.5 s' })),
      h('div', { class: 'thumbs' },
        s.images.map((src, i) => h('div', { class: 'thumb' },
          preview(src),
          h('div', { class: 'thumb__bar' },
            h('div', { class: 'row' }, iconBtn('←', 'Mover a la izquierda', () => move(s.images, i, -1)), iconBtn('→', 'Mover a la derecha', () => move(s.images, i, 1))),
            h('div', { class: 'row' },
              iconBtn('✎', 'Reemplazar foto', async () => { const v = await chooseMedia(); if (v) { s.images[i] = v; changed(); render(); } }),
              iconBtn('✕', 'Quitar foto', () => { s.images.splice(i, 1); changed(); render(); }, 'danger'))))),
        h('button', {
          type: 'button', class: 'thumb thumb--add',
          onclick: async () => { const v = await chooseMedia(); if (v) { s.images.push(v); changed(); render(); } }
        }, '+ Agregar foto'))),

    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Platillos' })),
      groups.length ? groups : h('p', { class: 'empty', text: 'Esta sección aún no tiene platillos.' }),
      h('button', {
        type: 'button', class: 'btn', style: 'margin-top:14px',
        onclick: () => { s.groups.push({ title: '', note: '', items: [newItem()] }); changed(); render(); }
      }, '+ Agregar subsección'))
  ];
}

/* ==================== Vista: búsqueda ==================== */

function renderSearch(q) {
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = norm(q).trim();
  const rows = [];
  data.sections.forEach((s) => s.groups.forEach((gr) => gr.items.forEach((it, ii) => {
    if ([it.name, it.desc, it.price, it.tag, gr.title].some((t) => norm(t).includes(needle))) {
      rows.push(itemRow(it, gr.items, ii, { id: s.id, name: s.name, group: gr.title || 'Sin subsección' }));
    }
  })));
  return [
    h('h2', { text: `Resultados para “${q}”` }),
    h('p', { class: 'lead', text: `${rows.length} platillo(s). Puedes cambiar el precio o la descripción directamente aquí.` }),
    rows.length ? h('div', { class: 'items' }, rows) : h('p', { class: 'empty', text: 'No se encontró nada.' })
  ];
}

/* ==================== Vista: inicio y enlaces ==================== */

function renderHome() {
  const hm = data.settings.home;
  hm.buttons = hm.buttons || [];
  const overlayLabel = h('span', { text: `${Math.round((hm.overlay ?? .45) * 100)}%` });
  const linkHint = (b) => (b.url && !safeUrl(b.url) ? 'Enlace no válido: debe empezar con https://' : null);

  return [
    h('h2', { text: 'Inicio, botones y enlaces' }),
    h('p', { class: 'lead', text: 'La página principal con el video de fondo.' }),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Video de fondo' })),
      picker(hm, 'video', { video: true }),
      h('div', { class: 'grid grid--2', style: 'margin-top:16px' },
        h('div', { class: 'field' }, h('span', { text: 'Imagen mientras carga el video' }), picker(hm, 'poster', { small: true })),
        h('label', { class: 'field' }, h('span', {}, 'Oscurecer video: ', overlayLabel),
          h('input', {
            type: 'range', min: 0, max: .85, step: .05, value: hm.overlay ?? .45,
            oninput: (e) => { hm.overlay = Number(e.target.value); overlayLabel.textContent = `${Math.round(hm.overlay * 100)}%`; changed(); }
          })))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Botón del menú y logo' })),
      h('div', { class: 'grid grid--2' },
        field('Texto del botón del menú', bound(hm, 'menuLabel')),
        field('Frase debajo del logo', bound(data.settings, 'tagline', { placeholder: 'Opcional' })),
        h('div', { class: 'field' }, h('span', { text: 'Logo sobre el video' }), toggle(hm, 'showLogo', 'Mostrar logo (desactívalo si el video ya trae el logo)')))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Botones' }), h('span', { class: 'picker__path', text: 'Aparecen debajo del botón del menú' })),
      hm.buttons.map((b, i) => h('div', { class: 'list-row' },
        bound(b, 'label', { placeholder: 'Texto del botón' }),
        h('div', {}, bound(b, 'url', { type: 'url', placeholder: 'https://…', onChange: () => {} }), linkHint(b) ? h('small', { style: 'color:var(--danger)', text: linkHint(b) }) : null),
        h('div', { class: 'row' },
          toggle(b, 'visible', 'Visible'),
          iconBtn('↑', 'Subir', () => move(hm.buttons, i, -1)),
          iconBtn('↓', 'Bajar', () => move(hm.buttons, i, 1)),
          iconBtn('✕', 'Eliminar botón', () => removeAt(hm.buttons, i, `el botón "${b.label}"`), 'danger')))),
      h('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:12px', onclick: () => { hm.buttons.push({ label: 'NUEVO', url: 'https://', visible: true }); changed(); render(); } }, '+ Agregar botón')),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Instagram' }), toggle(hm.instagram, 'visible', 'Mostrar')),
      h('div', { class: 'grid grid--2' },
        field('Enlace de Instagram', bound(hm.instagram, 'url', { type: 'url' })),
        h('div', { class: 'field' }, h('span', { text: 'Ícono' }), picker(hm.instagram, 'icon', { small: true })))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Teléfono' }), toggle(hm.phone, 'visible', 'Mostrar')),
      h('div', { class: 'grid grid--2' },
        field('Número (con lada)', bound(hm.phone, 'number', { type: 'tel', placeholder: '+52 871 000 0000' })),
        h('div', { class: 'field' }, h('span', { text: 'Ícono' }), picker(hm.phone, 'icon', { small: true }))))
  ];
}

/* ==================== Vista: apariencia ==================== */

function renderLook() {
  const st = data.settings;
  return [
    h('h2', { text: 'Apariencia y fondo' }),
    h('p', { class: 'lead', text: 'Logo, colores, fondo del menú y portada del libro animado.' }),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Marca' })),
      h('div', { class: 'grid grid--2' },
        field('Nombre del restaurante', bound(st, 'brandName')),
        h('label', { class: 'field' }, h('span', { text: 'Color de acento (dorado)' }),
          h('div', { class: 'row' },
            h('input', { type: 'color', value: st.accent || '#c9a45c', oninput: (e) => { st.accent = e.target.value; changed(); } }),
            h('button', { type: 'button', class: 'btn btn--sm btn--ghost', onclick: () => { st.accent = '#c9a45c'; changed(); render(); } }, 'Restablecer')))),
      h('div', { class: 'field', style: 'margin-top:14px' }, h('span', { text: 'Logo' }), picker(st, 'logo'))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Página del menú' })),
      h('div', { class: 'grid grid--2' },
        field('Título', bound(st.menu, 'title')),
        h('div', { class: 'field' }, h('span', { text: 'Fondo' }), picker(st.menu, 'background', { clearable: true }))),
      h('div', { style: 'margin-top:14px' }, field('Aviso general (alergias, tiempos, salsas)', bound(st.menu, 'disclaimer', { multiline: true, rows: 3 })))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Libro animado' })),
      h('div', { class: 'grid grid--2' },
        field('Texto de la portada', bound(st.book, 'title')),
        h('div', { class: 'field' }, h('span', { text: 'Imagen de portada (opcional)' }), picker(st.book, 'cover', { clearable: true }))))
  ];
}

/* ==================== Vista: respaldo ==================== */

function renderBackup() {
  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `shoku-menu-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importJson = async () => {
    const file = await pickFile('application/json,.json');
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.sections)) throw new Error('El archivo no parece un respaldo del menú.');
      data = normalizeData(DEFAULT_DATA, parsed);
      changed(); go({ type: 'section', id: data.sections[0]?.id });
      toast('Respaldo cargado. Revisa y presiona “Publicar cambios”.', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  };
  const restore = () => {
    if (!confirm('¿Reemplazar todo por el menú original del PDF? Perderás los cambios que no hayas respaldado.')) return;
    data = normalizeData(DEFAULT_DATA, null);
    changed(); go({ type: 'section', id: data.sections[0]?.id });
    toast('Menú del PDF cargado. Presiona “Publicar cambios” para aplicarlo.', 'ok');
  };
  return [
    h('h2', { text: 'Respaldo' }),
    h('p', { class: 'lead', text: meta.updatedAt ? `Última publicación: ${meta.updatedAt.toLocaleString('es-MX')}${meta.updatedBy ? ` por ${meta.updatedBy}` : ''}.` : 'Aún no se ha publicado ninguna versión en Firebase.' }),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Copias de seguridad' })),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn', onclick: download }, 'Descargar respaldo (.json)'),
        h('button', { type: 'button', class: 'btn', onclick: importJson }, 'Cargar respaldo'))),
    h('section', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', { text: 'Restaurar' })),
      h('p', { class: 'lead', text: 'Vuelve a cargar el menú tal como venía en el PDF (no se publica hasta que presiones “Publicar cambios”).' }),
      h('button', { type: 'button', class: 'btn btn--danger', onclick: restore }, 'Restaurar menú del PDF'))
  ];
}

/* ==================== Login ==================== */

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/invalid-login-credentials': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/invalid-email': 'Usuario no válido.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión a internet.',
  'auth/operation-not-allowed': 'Activa “Correo electrónico/contraseña” en Firebase Authentication (ver LEEME-ADMIN.md).',
  'auth/configuration-not-found': 'Firebase Authentication no está activado en el proyecto (ver LEEME-ADMIN.md).'
};

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const err = $('#login-error');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  try {
    await signInWithEmailAndPassword(auth, usernameToEmail($('#login-user').value), $('#login-pass').value);
    $('#login-pass').value = '';
  } catch (ex) {
    err.textContent = AUTH_ERRORS[ex.code] || `No se pudo entrar (${ex.code || ex.message}).`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});
$('#pw-toggle').addEventListener('click', () => {
  const p = $('#login-pass');
  p.type = p.type === 'password' ? 'text' : 'password';
  $('#pw-toggle').textContent = p.type === 'password' ? 'Ver' : 'Ocultar';
});

/* ==================== Arranque ==================== */

$('#publish-btn').addEventListener('click', publish);
$('#logout-btn').addEventListener('click', async () => {
  if (isDirty() && !confirm('Tienes cambios sin publicar. ¿Salir de todos modos?')) return;
  savedJSON = JSON.stringify(data);
  await signOut(auth);
});
$('#add-section').addEventListener('click', () => {
  const name = prompt('Nombre de la nueva sección:', 'NUEVA SECCIÓN');
  if (!name) return;
  let id = slugify(name);
  while (data.sections.some((s) => s.id === id)) id += '-2';
  data.sections.push({ id, name: name.toUpperCase(), hidden: false, cover: '', images: [], promo: '', note: '', groups: [{ title: '', note: '', items: [] }] });
  changed(); go({ type: 'section', id });
});
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => go({ type: b.dataset.view })));
$('#nav-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('is-open'));
let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  searchTimer = setTimeout(() => {
    if (q) { view = { type: 'search', q }; render(); }
    else if (view.type === 'search') go({ type: 'section', id: data.sections[0]?.id });
  }, 200);
});
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && data) {
    e.preventDefault();
    if (isDirty()) publish();
  }
});

onAuthStateChanged(auth, (user) => {
  $('#login-view').hidden = !!user;
  $('#app-view').hidden = !user;
  if (user) loadData();
  else { data = null; $('#login-user').focus(); }
});
