// Panel: sucursales con mapa de Google para ubicar cada una.
import { USE_EMULATOR } from './firebase.js';

const MAX_BRANCHES = 10; // límite de Apple Wallet y Google Wallet
const DEFAULT_CENTER = { lat: 25.5428, lng: -103.4068 }; // Torreón
const validPoint = (b) => Number.isFinite(Number(b.lat)) && Number.isFinite(Number(b.lng)) && b.lat !== '' && b.lng !== ''
  && Math.abs(Number(b.lat)) <= 90 && Math.abs(Number(b.lng)) <= 180;

let mapsPromise = null;
let mapsKeyLoaded = null;
function loadMaps(key) {
  if (mapsPromise && mapsKeyLoaded === key) return mapsPromise;
  mapsKeyLoaded = key;
  mapsPromise = new Promise((resolve, reject) => {
    window.__shokuMapsReady = () => resolve(window.google.maps);
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?v=weekly&loading=async&callback=__shokuMapsReady&language=es&region=MX${key ? `&key=${encodeURIComponent(key)}` : ''}`;
    s.async = true;
    s.onerror = () => reject(new Error('No se pudo cargar Google Maps. Revisa tu conexión.'));
    document.head.append(s);
  });
  return mapsPromise;
}

// Acepta "25.54, -103.40" o un enlace largo de Google Maps.
export function parseCoords(text) {
  const t = String(text || '').trim();
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i, /^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/];
  for (const re of patterns) {
    const m = re.exec(t);
    if (m) return { lat: Number(m[1]).toFixed(6), lng: Number(m[2]).toFixed(6) };
  }
  return null;
}

export function createBranches(ctx) {
  const { h, field, bound, toggle, iconBtn, toast, changed, render, getLoy } = ctx;
  let selectedId = null;
  let lastView = null; // conserva centro y zoom del mapa entre repintados

  function renderBranches() {
    const loy = getLoy();
    loy.branches = Array.isArray(loy.branches) ? loy.branches : [];
    const list = loy.branches;
    if (!list.some((b) => b.id === selectedId)) selectedId = list[0]?.id || null;
    const selected = () => list.find((b) => b.id === selectedId);
    const hasKey = !!loy.mapsKey || USE_EMULATOR;
    const inputs = new Map();
    const markers = new Map();
    let map = null;

    const mapBox = h('div', { class: 'map-box' }, hasKey ? h('p', { class: 'empty', style: 'padding:20px', text: 'Cargando mapa…' }) : null);
    const missing = list.filter((b) => !validPoint(b)).length;

    const setPoint = (b, lat, lng, { pan = false } = {}) => {
      b.lat = Number(lat).toFixed(6);
      b.lng = Number(lng).toFixed(6);
      const refs = inputs.get(b.id);
      if (refs) { refs.lat.value = b.lat; refs.lng.value = b.lng; }
      if (map) {
        const pos = { lat: Number(b.lat), lng: Number(b.lng) };
        if (markers.has(b.id)) markers.get(b.id).setPosition(pos);
        else addMarker(b);
        if (pan) map.panTo(pos);
      }
      changed();
    };

    function addMarker(b) {
      const i = list.indexOf(b);
      const marker = new window.google.maps.Marker({
        position: { lat: Number(b.lat), lng: Number(b.lng) }, map, draggable: true, title: b.name || `Sucursal ${i + 1}`,
        label: { text: String(i + 1), color: '#fff', fontWeight: '600' }
      });
      marker.addListener('dragend', (e) => { selectedId = b.id; setPoint(b, e.latLng.lat(), e.latLng.lng()); });
      marker.addListener('click', () => { selectedId = b.id; rememberView(); render(); });
      markers.set(b.id, marker);
    }
    const rememberView = () => { if (map) lastView = { center: map.getCenter().toJSON(), zoom: map.getZoom() }; };

    if (hasKey) {
      loadMaps(loy.mapsKey).then((maps) => {
        window.gm_authFailure = () => mapBox.replaceChildren(h('div', { class: 'notice notice--danger', style: 'margin:12px', text: 'Google rechazó la clave del mapa. Revisa que la clave sea correcta, que tenga activada “Maps JavaScript API” y que permita tu sitio. Mientras tanto puedes pegar la ubicación en cada sucursal.' }));
        const points = list.filter(validPoint);
        const first = selected() && validPoint(selected()) ? selected() : points[0];
        mapBox.replaceChildren();
        map = new maps.Map(mapBox, {
          center: lastView?.center || (first ? { lat: Number(first.lat), lng: Number(first.lng) } : DEFAULT_CENTER),
          zoom: lastView?.zoom || (first ? 15 : 12),
          mapTypeControl: false, streetViewControl: false, fullscreenControl: true
        });
        points.forEach(addMarker);
        map.addListener('click', (e) => {
          const b = selected();
          if (!b) return toast('Primero agrega una sucursal.', 'error');
          setPoint(b, e.latLng.lat(), e.latLng.lng());
          toast(`Ubicación de ${b.name || 'la sucursal'} actualizada. Recuerda publicar.`, 'ok');
          return undefined;
        });
      }).catch((err) => mapBox.replaceChildren(h('div', { class: 'notice notice--danger', style: 'margin:12px', text: err.message })));
    }

    const searchInput = h('input', {
      type: 'search', placeholder: 'Busca la dirección de la sucursal…',
      onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }
    });
    async function search() {
      const b = selected();
      const q = searchInput.value.trim();
      if (!q) return;
      if (!b) { toast('Primero agrega una sucursal.', 'error'); return; }
      if (!map) { toast('El mapa todavía no está listo.', 'error'); return; }
      try {
        const { results } = await new window.google.maps.Geocoder().geocode({ address: q, region: 'MX' });
        const loc = results[0].geometry.location;
        setPoint(b, loc.lat(), loc.lng(), { pan: true });
        map.setZoom(17);
        if (!b.address) {
          b.address = results[0].formatted_address;
          if (inputs.get(b.id)) inputs.get(b.id).address.value = b.address;
        }
        toast('Encontrada. Si hace falta, arrastra el marcador al lugar exacto.', 'ok');
      } catch (err) {
        toast(err.code === 'REQUEST_DENIED' ? 'Activa “Geocoding API” en Google Cloud para poder buscar direcciones.' : 'No se encontró esa dirección. Prueba con otra o marca el lugar en el mapa.', 'error');
      }
    }

    const add = () => {
      if (list.length >= MAX_BRANCHES) return toast(`Apple y Google permiten hasta ${MAX_BRANCHES} ubicaciones por tarjeta.`, 'error');
      const b = { id: `b${Date.now()}`, name: `Sucursal ${list.length + 1}`, address: '', lat: '', lng: '', active: true, message: '' };
      list.push(b);
      selectedId = b.id;
      rememberView();
      changed();
      render();
      return undefined;
    };

    const rows = list.map((b, i) => {
      const lat = bound(b, 'lat', { placeholder: '25.5428', inputmode: 'decimal', onChange: () => syncMarker(b) });
      const lng = bound(b, 'lng', { placeholder: '-103.4068', inputmode: 'decimal', onChange: () => syncMarker(b) });
      const address = bound(b, 'address', { placeholder: 'Calle, número y colonia' });
      inputs.set(b.id, { lat, lng, address });
      return h('div', { class: `branch${b.id === selectedId ? ' is-on' : ''}${validPoint(b) ? '' : ' is-missing'}` },
        h('div', { class: 'branch__head' },
          h('button', { type: 'button', class: 'branch__pick', onclick: () => { selectedId = b.id; rememberView(); render(); } },
            h('span', { class: 'branch__num', text: String(i + 1) }), h('strong', { text: b.name || `Sucursal ${i + 1}` }),
            h('small', { text: !validPoint(b) ? 'Falta ubicación' : b.id === selectedId ? 'Seleccionada: haz clic en el mapa' : 'Toca para seleccionar' })),
          toggle(b, 'active', 'Activa', { rerender: false }),
          iconBtn('✕', 'Eliminar sucursal', () => {
            if (!confirm(`¿Eliminar ${b.name || 'esta sucursal'}?`)) return;
            list.splice(i, 1); rememberView(); changed(); render();
          }, 'danger')),
        h('div', { class: 'grid grid--2' },
          field('Nombre', bound(b, 'name', { placeholder: 'Ej. Tecnológico' })),
          field('Dirección (opcional)', address),
          field('Latitud', lat),
          field('Longitud', lng),
          field('O pega un enlace de Google Maps o coordenadas', h('input', {
            placeholder: 'https://www.google.com/maps/…@25.54,-103.40…',
            onchange: (e) => {
              const p = parseCoords(e.target.value);
              if (!p) return toast('No encontré coordenadas ahí. Usa el enlace largo de la barra del navegador o escribe “lat, lng”.', 'error');
              selectedId = b.id;
              setPoint(b, p.lat, p.lng, { pan: true });
              e.target.value = '';
              toast('Ubicación guardada. Recuerda publicar.', 'ok');
              return undefined;
            }
          })),
          field('Mensaje propio (opcional)', bound(b, 'message', { placeholder: 'Usa el mensaje general si lo dejas vacío' }))));
    });

    function syncMarker(b) {
      if (!map || !validPoint(b)) return;
      const pos = { lat: Number(b.lat), lng: Number(b.lng) };
      if (markers.has(b.id)) markers.get(b.id).setPosition(pos);
      else addMarker(b);
    }

    return [
      h('h2', { text: 'Sucursales' }),
      h('p', { class: 'lead', text: 'Ubica cada sucursal en el mapa. Las tarjetas guardadas en Wallet se actualizan solas al publicar.' }),
      h('div', { class: 'notice', text: 'Cuando un cliente pasa cerca, el teléfono muestra la tarjeta o un aviso con tu mensaje. Apple y Google deciden la distancia y el momento (en iPhone, unos 100 m), y no ocurre todas las veces. Android además necesita la ubicación activada para Google Wallet.' }),
      hasKey ? null : h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Conecta el mapa de Google' })),
        h('p', { class: 'muted', style: 'margin-bottom:12px;line-height:1.5', text: 'Google pide una clave para mostrar el mapa. Sin ella igual puedes pegar el enlace o las coordenadas de cada sucursal.' }),
        field('Clave de Google Maps', bound(loy, 'mapsKey', { placeholder: 'AIza…' })),
        h('button', { type: 'button', class: 'btn btn--sm', style: 'margin-top:10px', onclick: () => { render(); } }, 'Cargar mapa')),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Mapa' }), h('span', { class: 'muted', text: `${list.length - missing} de ${list.length} ubicadas · máximo ${MAX_BRANCHES}` })),
        hasKey ? h('div', { class: 'row', style: 'margin-bottom:10px' },
          h('div', { style: 'flex:1;min-width:200px' }, searchInput),
          h('button', { type: 'button', class: 'btn', onclick: search }, 'Buscar')) : null,
        hasKey ? mapBox : null,
        hasKey ? h('p', { class: 'muted', style: 'margin-top:8px', text: 'Selecciona una sucursal y haz clic en el mapa, o arrastra su marcador.' }) : null),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Tus sucursales' }),
          h('button', { type: 'button', class: 'btn btn--sm btn--primary', onclick: add }, '+ Agregar sucursal')),
        rows.length ? rows : h('p', { class: 'empty', text: 'Agrega tu primera sucursal.' })),
      loy.mapsKey ? h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Clave de Google Maps' })),
        field('Clave', bound(loy, 'mapsKey', { placeholder: 'AIza…' }))) : null
    ];
  }

  return { renderBranches };
}
