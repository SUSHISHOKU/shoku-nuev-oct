// Configuración e inicialización de Firebase compartida por index.html y admin.html.
// La apiKey de Firebase web es pública por diseño: la seguridad real está en las reglas
// de Firestore/Storage (ver firestore.rules y storage.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBvToEAL_baFb0dNX0Hn7RBW1bNVy7A5B0',
  authDomain: 'shoku-4696b.firebaseapp.com',
  projectId: 'shoku-4696b',
  storageBucket: 'shoku-4696b.firebasestorage.app',
  messagingSenderId: '47036782323',
  appId: '1:47036782323:web:c66e92594a3b3f34ad0986',
  measurementId: 'G-64QM9MX8CQ'
};

// El usuario "shoku" del panel se traduce a este correo en Firebase Authentication.
export const ADMIN_DOMAIN = 'shoku-4696b.firebaseapp.com';
export const OWNER_EMAIL = `shoku@${ADMIN_DOMAIN}`;
export const usernameToEmail = (u) => (u.includes('@') ? u : `${u}@${ADMIN_DOMAIN}`).trim().toLowerCase();

// Modo de pruebas: solo en localhost y abriendo una página con "?emulador" usa el emulador local de Firebase,
// para probar sin tocar los datos reales.
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
export const USE_EMULATOR = isLocal && (() => {
  try {
    if (new URLSearchParams(location.search).has('emulador')) sessionStorage.setItem('shoku-emulador', '1');
    return sessionStorage.getItem('shoku-emulador') === '1';
  } catch { return false; }
})();

export const app = initializeApp(USE_EMULATOR ? { ...firebaseConfig, projectId: 'demo-shoku' } : firebaseConfig);
export const db = getFirestore(app);
if (USE_EMULATOR) connectFirestoreEmulator(db, '127.0.0.1', 8080);

// Servidor de Wallet (Cloud Functions de este proyecto).
export const WALLET_API = USE_EMULATOR ? 'http://127.0.0.1:5101/demo-shoku/us-central1/wallet' : 'https://us-central1-shoku-4696b.cloudfunctions.net/wallet';

// Documento único con todo el contenido del sitio.
export const MENU_DOC = ['site', 'menu'];
// Colección donde se guardan las fotos subidas cuando Firebase Storage no está disponible.
export const MEDIA_COLLECTION = 'media';
export const MEDIA_PREFIX = 'media:';

// Menú de una sucursal; si todavía no tiene uno propio (o no se puede leer), el General.
export async function fetchMenu(branch = 'general') {
  if (branch && branch !== 'general') {
    try {
      const own = await getDoc(doc(db, 'menus', branch));
      if (own.exists()) return own.data();
    } catch (err) {
      console.warn('[Shoku] Menú de sucursal no disponible, se usa el General:', err.code || err.message);
    }
  }
  const snap = await getDoc(doc(db, ...MENU_DOC));
  return snap.exists() ? snap.data() : null;
}

const mediaCache = new Map();

// Convierte "media:ID" en la imagen guardada en Firestore; cualquier otra ruta se devuelve igual.
export async function resolveMedia(src) {
  if (!src || !src.startsWith(MEDIA_PREFIX)) return src;
  const id = src.slice(MEDIA_PREFIX.length);
  if (!mediaCache.has(id)) {
    mediaCache.set(id, getDoc(doc(db, MEDIA_COLLECTION, id))
      .then((snap) => (snap.exists() ? snap.data().data : ''))
      .catch(() => ''));
  }
  return mediaCache.get(id);
}
