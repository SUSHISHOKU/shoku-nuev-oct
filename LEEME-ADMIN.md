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

### 4. Reglas de seguridad de Firestore (importante — vuelve a pegarlas si ya lo habías hecho, cambiaron)
**Firestore Database** → pestaña **Reglas** → borra lo que haya, pega el contenido de
`firestore.rules` → **Publicar**.

Así cualquiera puede *ver* el menú, los clientes solo pueden *crear* su propia tarjeta, y solo la
cuenta del panel puede ver datos de clientes, dar sellos o modificar el sitio.
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

## Tarjeta de fidelidad (Shoku Club)

El botón **MEMBRESÍA** del inicio abre `membresia.html`: el cliente escribe su nombre, teléfono,
cumpleaños y correo y obtiene su tarjeta con un código QR. La tarjeta se actualiza sola cuando le das un sello.

| Quiero… | Dónde (panel → Tarjeta de fidelidad) |
| --- | --- |
| Dar un sello o entregar la recompensa | **Registrar visita** → *Escanear tarjeta* (cámara del celular) o busca por teléfono. |
| Ver todos los clientes / descargar Excel | **Clientes**. |
| Ver visitas, cumpleaños del mes, clientes frecuentes e inactivos | **Reportes**. |
| Cambiar logo, colores, fondo, tipo de sello (sushi, estrella, emoji o PNG), número de sellos y recompensa | **Diseño de la tarjeta**. |
| Agregar promociones y configurar los mensajes automáticos | **Promociones y mensajes**. |

- Cada vez que se completan los sellos, la tarjeta vuelve a 0 y se acumula una recompensa para canjear.
- Si das dos sellos al mismo cliente en menos de 3 horas, el panel te pide confirmar.
- Para escanear con la cámara, el sitio debe abrirse con `https://`.
- **Apple Wallet / Google Wallet:** se conectan en un segundo paso con tus certificados (ver abajo).
  Mientras tanto los clientes usan su tarjeta digital desde la página de Membresía.

### Pendiente: conectar Apple Wallet y Google Wallet
Se necesita el plan **Blaze** de Firebase y estos datos (guarda los archivos privados en una carpeta
`secretos/` **fuera** de `public`, nunca en el repositorio):
- **Apple:** Team ID, Pass Type ID (ej. `pass.com.shoku.club`) y el certificado **.p12** con su contraseña.
- **Google:** Issuer ID de Google Wallet y el archivo **.json** de la cuenta de servicio.

Los avisos por cercanía funcionan dentro del radio que deciden Apple y Google (≈100 m en iPhone);
no es posible un radio de 5–10 km con tarjetas de Wallet.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Inicio con video + libro animado + menú por secciones. |
| `admin.html` | Panel de administración. |
| `membresia.html` | Registro de clientes y tarjeta de fidelidad digital. |
| `menu.html`, `meny.html` | Redirigen al menú nuevo (por si hay QR impresos con esas direcciones). |
| `js/menu-data.js` | Menú por defecto (el del PDF). |
| `img/` | Fotos optimizadas (WebP), ~2.5 MB en total en lugar de ~40 MB. |
| `firestore.rules`, `storage.rules` | Reglas de seguridad para pegar en Firebase. |
