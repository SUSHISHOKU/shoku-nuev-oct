# Panel de administración de Shoku

El menú público (`index.html`) toma su contenido de Firebase. Todo se edita desde
`admin.html`: platillos, precios, descripciones, secciones, fotos de portada y del
carrusel, video de inicio, botones, enlaces, teléfono, logo, fondo y colores.

Mientras no publiques nada desde el panel, el sitio muestra el menú nuevo incluido en
`js/menu-data.js` (el del PDF), así que nunca se queda en blanco.

---

## Configuración inicial en Firebase (una sola vez, ~5 minutos)

Entra a <https://console.firebase.google.com> → proyecto **shoku-bb26b**.

### 1. Activar el inicio de sesión
1. **Authentication** → *Comenzar* (si aparece).
2. Pestaña **Sign-in method** → **Correo electrónico/contraseña** → *Habilitar* → Guardar.

### 2. Crear el usuario del panel
1. **Authentication** → pestaña **Users** → **Agregar usuario**.
2. Correo: `shoku@shoku-bb26b.firebaseapp.com`
3. Contraseña: la contraseña que elegiste para el panel.

En `admin.html` se entra escribiendo solo **shoku** como usuario (el panel completa el
correo automáticamente).

### 3. Bloquear que otras personas creen cuentas (importante)
**Authentication** → **Settings** → **User actions** → desmarca
**Enable create (sign-up)** → Guardar.

### 4. Reglas de seguridad de Firestore (importante)
**Firestore Database** → pestaña **Reglas** → borra lo que haya, pega el contenido de
`firestore.rules` → **Publicar**.

Así cualquiera puede *ver* el menú, pero solo la cuenta del panel puede *modificarlo*.
(Si la base estaba en "modo de prueba", cualquier persona podía escribir en ella.)

### 5. (Opcional) Firebase Storage para fotos y videos grandes
Storage requiere el plan **Blaze** (pago por uso; para un menú normalmente cuesta $0).
- Si lo activas: **Storage** → Comenzar → pestaña **Reglas** → pega `storage.rules` → Publicar.
- Si **no** lo activas: las fotos que subas se optimizan y se guardan en Firestore
  automáticamente. Para cambiar el **video** puedes pegar un enlace directo a un `.mp4`
  o reemplazar el archivo `fondo.mp4` del sitio.

### 6. Publicar por primera vez
Abre `admin.html`, entra y presiona **Publicar cambios**. Desde ese momento el sitio
lee el menú desde Firebase.

---

## Uso diario

| Quiero… | Dónde |
| --- | --- |
| Cambiar un precio rápido | Escribe el nombre en **Buscar platillo** (barra lateral) y edita el precio ahí mismo. |
| Agregar / quitar / ocultar platillos | Abre la sección → *+ Agregar platillo*, ✕ para eliminar, ● para ocultar temporalmente. |
| Cambiar la foto de una sección | Sección → **Foto de portada** → *Cambiar foto*. |
| Cambiar las fotos del carrusel | Sección → **Carrusel de fotos** (✎ reemplazar, ✕ quitar, ← → ordenar). |
| Cambiar enlaces (Membresía, Recomiéndanos, Instagram, teléfono) | **Inicio, botones y enlaces**. |
| Cambiar video, fondo, logo o color | **Inicio, botones y enlaces** / **Apariencia y fondo**. |
| Guardar una copia | **Respaldo** → *Descargar respaldo*. |

- Los cambios **no** se ven en el sitio hasta presionar **Publicar cambios** (o Ctrl + S).
- En **Precio** escribe solo el número (`215` se muestra como `$215`). Si escribes texto,
  se muestra tal cual (por ejemplo `$110 / pieza`).
- Si el sitio no muestra un cambio, recarga la página: el teléfono guarda una copia
  para abrir más rápido y se actualiza sola en segundos.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Inicio con video + libro animado + menú por secciones. |
| `admin.html` | Panel de administración. |
| `menu.html`, `meny.html` | Redirigen al menú nuevo (por si hay QR impresos con esas direcciones). |
| `js/menu-data.js` | Menú por defecto (el del PDF). |
| `img/` | Fotos optimizadas (WebP), ~2.5 MB en total en lugar de ~40 MB. |
| `firestore.rules`, `storage.rules` | Reglas de seguridad para pegar en Firebase. |
