// Configuración e inicialización de Firebase compartida por index.html y admin.html.
// La apiKey de Firebase web es pública por diseño: la seguridad real está en las reglas
// de Firestore/Storage (ver firestore.rules y storage.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyB6Bs3CFmiz1FUd0hMQWwpk-s5p-AoVu5c',
  authDomain: 'shoku-bb26b.firebaseapp.com',
  projectId: 'shoku-bb26b',
  storageBucket: 'shoku-bb26b.firebasestorage.app',
  messagingSenderId: '838811032960',
  appId: '1:838811032960:web:e667369157d501c74a7565',
  measurementId: 'G-2VM1BM0CH6'
};

// El usuario "shoku" del panel se traduce a este correo en Firebase Authentication.
export const ADMIN_DOMAIN = 'shoku-bb26b.firebaseapp.com';
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

// Documento único con todo el contenido del sitio.
export const MENU_DOC = ['site', 'menu'];
// Colección donde se guardan las fotos subidas cuando Firebase Storage no está disponible.
export const MEDIA_COLLECTION = 'media';
export const MEDIA_PREFIX = 'media:';

export async function fetchMenu() {
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
