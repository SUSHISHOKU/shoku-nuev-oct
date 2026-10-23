// Configuración e inicialización de Firebase compartida por index.html y admin.html.
// La apiKey de Firebase web es pública por diseño: la seguridad real está en las reglas
// de Firestore/Storage (ver firestore.rules y storage.rules).
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

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
