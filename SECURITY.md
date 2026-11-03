# Seguridad

- El contenido del sitio se guarda en Firebase (`site/menu` en Firestore). La lectura es pública;
  la escritura está limitada a la cuenta del panel mediante `firestore.rules` y `storage.rules`.
- La `apiKey` de Firebase que aparece en `js/firebase.js` es pública por diseño; no da acceso de
  escritura por sí sola. La protección real son las reglas y la cuenta de Authentication.
- No guardes contraseñas en este repositorio. La contraseña del panel solo existe en
  Firebase Authentication.
- *Enable create (sign-up)* queda activado para crear cuentas del personal. Una cuenta nueva no tiene ningún acceso hasta que el dueño le da permisos en la colección `staff`.
- La clave de la API de IA vive como secreto de Firebase; nunca se pone en el sitio ni en el repositorio.
- Todo el texto editable se muestra escapado (sin HTML) y los enlaces solo aceptan `https://`,
  `tel:`, `mailto:` o rutas del propio sitio.

Para reportar un problema de seguridad, contacta directamente al administrador del sitio.
