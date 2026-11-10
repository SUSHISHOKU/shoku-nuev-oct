# Panel de administración de Shoku

El menú público (`index.html`) toma su contenido de Firebase. Todo se edita desde
`admin.html`: platillos, precios, descripciones, secciones, fotos de portada y del
carrusel, video de inicio, botones, enlaces, teléfono, logo, fondo y colores.

Mientras no publiques nada desde el panel, el sitio muestra el menú nuevo incluido en
`js/menu-data.js` (el del PDF), así que nunca se queda en blanco.

---

## Configuración inicial en Firebase (una sola vez, ~5 minutos)

Entra a <https://console.firebase.google.com> → proyecto **shoku-4696b**.

### 1. Activar el inicio de sesión
1. **Authentication** → *Comenzar* (si aparece).
2. Pestaña **Sign-in method** → **Correo electrónico/contraseña** → *Habilitar* → Guardar.

### 2. Crear el usuario del panel
1. **Authentication** → pestaña **Users** → **Agregar usuario**.
2. Correo: `shoku@shoku-4696b.firebaseapp.com`
3. Contraseña: la contraseña que elegiste para el panel.

En `admin.html` se entra escribiendo solo **shoku** como usuario (el panel completa el
correo automáticamente).

### 3. Permitir crear usuarios del personal (importante)
**Authentication** → **Settings** → **User actions** → deja **activado** **Enable create (sign-up)**.
El panel lo usa para crear las cuentas de tus meseros. Es seguro: una cuenta nueva no puede ver ni
cambiar nada hasta que el dueño le da permisos desde **Personal y permisos**. Primero crea la cuenta del dueño (paso 2).

### 4. Reglas de seguridad de Firestore (importante — vuelve a pegarlas si ya lo habías hecho, cambiaron)
**Firestore Database** → pestaña **Reglas** → borra lo que haya, pega el contenido de
`firestore.rules` → **Publicar**.

Así cualquiera puede *ver* el menú, los clientes solo pueden *crear* su propia tarjeta, y solo el
dueño o el personal con permiso pueden ver datos de clientes, dar sellos o modificar el sitio.
(Si la base estaba en "modo de prueba", cualquier persona podía escribir en ella.)

### 5. Reglas de Firebase Storage (importante)
**Storage** → pestaña **Reglas** → borra lo que haya, pega el contenido de `storage.rules` → **Publicar**.
Con esto las fotos y videos que subas desde el panel se guardan en Storage y solo la cuenta del panel puede subirlos.

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

## Menús por sucursal

Hay 8 menús: el **General** (`shokusushi.com`) y uno por sucursal, cada uno con su dirección para el QR:

| Sucursal | Dirección |
| --- | --- |
| Milenio | `shokusushi.com/menu-milenio` |
| Tec | `shokusushi.com/menu-tec` |
| Independencia | `shokusushi.com/menu-independencia` |
| Matamoros | `shokusushi.com/menu-matamoros` |
| Gómez | `shokusushi.com/menu-gomez` |
| Centrito | `shokusushi.com/menu-centrito` |
| Sucursal 7 (libre) | `shokusushi.com/menu7` |

- En el panel, arriba a la izquierda, elige **Menú que estás editando**. Todo lo que cambies y publiques (platillos, precios,
  fotos, botones, teléfono, video) se aplica solo a ese menú.
- Una sucursal sin menú propio muestra el General. Al publicar su menú por primera vez, empieza como copia del General.
- **Respaldo → Copiar el menú de otra sucursal** para partir de otro menú.
- **🔗 Menús por sucursal y QR**: cambia los nombres (por ejemplo, el de la Sucursal 7), copia los enlaces y descarga cada QR para imprimir.
- Si cambias `index.html`, vuelve a crear las páginas de sucursal con `node herramientas/generar-menus-sucursal.cjs`.

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

- Al registrarse, el cliente recibe los **sellos de regalo** configurados (por defecto 1 de 4).
- Al completar los sellos, la tarjeta muestra la felicitación en lugar de los sellos y gana la recompensa. Por defecto se retira al terminar el día siguiente (se configura en **Diseño de la tarjeta**).
- Al retirarse se borra del sistema y el cliente puede registrarse otra vez con el mismo teléfono. Su teléfono y cuántos pases ha completado quedan en **💬 Retroalimentación**.
- Apple y Google no permiten borrar una tarjeta del teléfono de un cliente: queda anulada, fuera de las tarjetas activas, y la persona la puede quitar.
- Una tarjeta **vencida** no recibe sellos ni canjea recompensas hasta que se renueve; al renovar empieza de nuevo.
- Sellos, regalo, vigencia, recompensa, textos e ilustración se cambian en **Diseño de la tarjeta**.
- Si das dos sellos al mismo cliente en menos de 3 horas, el panel te pide confirmar.
- Para escanear con la cámara, el sitio debe abrirse con `https://`.
- **Apple Wallet / Google Wallet:** el cliente agrega la tarjeta desde Membresía. Los sellos y avisos se actualizan solos
  gracias a las funciones de la carpeta `functions/`. Las llaves privadas viven como secretos de Firebase, nunca en el repositorio.

Las ubicaciones de cada sucursal se configuran en **📍 Sucursales** (hasta 10). Los avisos por cercanía funcionan dentro
del radio que deciden Apple y Google (≈100 m en iPhone), no ocurren siempre y no es posible un radio de 5–10 km con
tarjetas de Wallet.

### Clave para el mapa de Google
1. En <https://console.cloud.google.com> (proyecto **shoku-4696b**), activa **Maps JavaScript API** y **Geocoding API**.
2. En **APIs y servicios → Credenciales**, crea una **clave de API**.
3. Restríngela: sitios web `https://shokusushi.com/*` y solo esas dos API.
4. Pégala en el panel, en **📍 Sucursales**, y presiona **Publicar cambios**.

## Instalar el panel como app

`admin.html` es una app web: se instala en el teléfono o la computadora y se abre con su propio ícono.
- **Android o computadora (Chrome/Edge):** entra y toca **📲 Instalar la app**.
- **iPhone:** ábrelo en Safari → **Compartir** → **Agregar a inicio**.

Necesita internet para funcionar, porque los datos viven en Firebase.

## Personal, notificaciones y estrategias

- **Retroalimentación:** lista de teléfonos con los pases completados. **💬 Abrir WhatsApp** abre cada chat con tu mensaje listo y tú lo envías; en computadora usa WhatsApp Web, que se enlaza escaneando su QR. No hay envío masivo automático: los programas que lo hacen con ese QR van contra las reglas de WhatsApp y pueden hacer que bloqueen tu número. Si alguien pide no recibir mensajes, desmarca su casilla.

- **Personal y permisos** (solo el dueño): crea un usuario por mesero y elige qué puede hacer. Por defecto
  solo registra visitas, ve los datos del comensal y entrega recompensas. Para cambiar una contraseña olvidada,
  elimina el usuario y crea otro con un nombre distinto.
- **Notificaciones:** escribe un aviso, elige a quién y toca **Notificar**. Llega al teléfono de quienes agregaron la
  tarjeta a su Wallet y aparece en la página de Membresía.
- **Estrategias con IA:** el diagnóstico funciona de inmediato. Para generar estrategias con IA hay que publicar la
  función (carpeta `functions-ai/`) y guardar una clave de la API de Anthropic como secreto:

```bash
firebase login
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions:ai
```

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | Inicio con video + libro animado + menú por secciones. |
| `admin.html` | Panel de administración (app web instalable, con `admin.webmanifest` y `admin-sw.js`). |
| `membresia.html` | Registro de clientes y tarjeta de fidelidad digital. |
| `menu-*.html`, `menu7.html` | Menú de cada sucursal (copias de `index.html`). |
| `menu.html`, `meny.html` | Redirigen al menú nuevo (por si hay QR impresos con esas direcciones). |
| `js/menu-data.js` | Menú por defecto (el del PDF). |
| `img/` | Fotos optimizadas (WebP), ~2.5 MB en total en lugar de ~40 MB. |
| `firestore.rules`, `storage.rules` | Reglas de seguridad para pegar en Firebase. |
