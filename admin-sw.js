// Service worker del panel. Solo controla admin.html (ver el scope al registrarlo).
// Pide siempre lo más nuevo a la red y usa la copia guardada únicamente sin conexión,
// para que un cambio publicado se vea de inmediato. No guarda datos de Firebase.
const CACHE = 'shoku-panel-v1';
const SHELL = ['admin.html', 'css/admin.css', 'css/card.css', 'js/admin.js', 'js/admin-loyalty.js', 'js/admin-team.js', 'js/firebase.js', 'js/loyalty-card.js', 'js/menu-data.js', 'js/util.js', 'img/logo.webp', 'img/app-icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  }).catch(() => caches.match(request)));
});
