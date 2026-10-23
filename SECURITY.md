# Seguridad

- El contenido del sitio se guarda en Firebase (`site/menu` en Firestore). La lectura es pública;
  la escritura está limitada a la cuenta del panel mediante `firestore.rules` y `storage.rules`.
- La `apiKey` de Firebase que aparece en `js/firebase.js` es pública por diseño; no da acceso de
  escritura por sí sola. La protección real son las reglas y la cuenta de Authentication.
- No guardes contraseñas en este repositorio. La contraseña del panel solo existe en
  Firebase Authentication.
- Mantén desactivado *Enable create (sign-up)* en Authentication para que nadie más pueda crear cuentas.
- Todo el texto editable se muestra escapado (sin HTML) y los enlaces solo aceptan `https://`,
  `tel:`, `mailto:` o rutas del propio sitio.

Para reportar un problema de seguridad, contacta directamente al administrador del sitio.
