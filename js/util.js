// Utilidades compartidas por el sitio público y el panel de administración.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Solo permite enlaces seguros: http(s), tel, mailto, rutas relativas e imágenes embebidas.
export function safeUrl(url, { allowData = false } = {}) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^(https?:|tel:|mailto:)/i.test(u)) return u;
  if (allowData && /^data:(image|video)\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return ''; // javascript:, data:, etc.
  return u;
}

// "215" -> "$215"; texto libre ("$110 / pieza") se respeta tal cual.
export function formatPrice(p) {
  const s = String(p ?? '').trim();
  if (!s) return '';
  return /^\d+(\.\d+)?$/.test(s) ? `$${s}` : s;
}

export const telHref = (n) => `tel:${String(n ?? '').replace(/[^\d+]/g, '')}`;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Mezcla profunda: lo guardado en Firebase gana, lo que falte se completa con los valores por defecto.
export function deepMerge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? structuredClone(base) : structuredClone(over);
  const out = structuredClone(base);
  for (const [k, v] of Object.entries(over)) {
    out[k] = isObj(v) && isObj(base[k]) ? deepMerge(base[k], v) : structuredClone(v);
  }
  return out;
}

export function normalizeData(defaults, remote) {
  const data = deepMerge(defaults, remote || {});
  if (!Array.isArray(data.sections)) data.sections = structuredClone(defaults.sections);
  data.sections.forEach((s, idx) => {
    s.id = s.id || `seccion-${idx + 1}`;
    s.images = Array.isArray(s.images) ? s.images.filter(Boolean) : [];
    s.groups = Array.isArray(s.groups) ? s.groups : [];
    s.groups.forEach((gr) => { gr.items = Array.isArray(gr.items) ? gr.items : []; });
  });
  return data;
}

export const slugify = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'seccion';
