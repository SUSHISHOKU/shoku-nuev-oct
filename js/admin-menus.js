// Panel: menús por sucursal con su enlace y su código QR para imprimir.
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { db } from './firebase.js';
import { qrSvg } from './loyalty-card.js';
import { BRANCH_MENUS, branchName, branchUrl, menuDocPath } from './branches.js';

const fileSafe = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

// QR grande con el nombre de la sucursal debajo, listo para imprimir.
async function downloadQr(id, name) {
  const svg = await qrSvg(branchUrl(id));
  const img = new Image();
  const withNs = svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
  await img.decode();
  const size = 1200;
  const pad = 110;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size + 200;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.imageSmoothingEnabled = false;
  g.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
  g.fillStyle = '#121214';
  g.textAlign = 'center';
  g.font = '700 64px Georgia, serif';
  g.fillText(`SHOKU · ${name.toUpperCase()}`, size / 2, size + 40);
  g.font = '400 40px Arial, sans-serif';
  g.fillText('Escanea para ver el menú', size / 2, size + 110);
  const a = document.createElement('a');
  a.href = c.toDataURL('image/png');
  a.download = `qr-menu-${fileSafe(name)}.png`;
  a.click();
}

export function createMenus(ctx) {
  const { h, toast, render, getNames, setNames, currentMenu, switchMenu, isDirty } = ctx;

  function renderMenusQr() {
    const names = { ...getNames() };
    const grid = h('div', { class: 'qr-grid' });

    BRANCH_MENUS.forEach((b) => {
      const qrBox = h('div', { class: 'qr-box' });
      const status = h('small', { class: 'muted', text: b.id === 'general' ? 'Menú principal' : 'Revisando…' });
      qrSvg(branchUrl(b.id)).then((svg) => { qrBox.innerHTML = svg; }).catch(() => { qrBox.textContent = 'Sin QR'; });
      if (b.id !== 'general') {
        getDoc(doc(db, ...menuDocPath(b.id)))
          .then((s) => { status.textContent = s.exists() ? 'Tiene su propio menú' : 'Aún muestra el menú General'; status.classList.toggle('is-warn', !s.exists()); })
          .catch(() => { status.textContent = 'No se pudo revisar'; });
      }
      const nameInput = h('input', { value: branchName(b.id, names), maxlength: 40, oninput: (e) => { names[b.id] = e.target.value.trim(); } });
      grid.append(h('article', { class: `qr-card${currentMenu() === b.id ? ' is-on' : ''}` },
        qrBox,
        h('label', { class: 'field' }, h('span', { text: b.id === 'general' ? 'Nombre' : 'Nombre de la sucursal' }), nameInput),
        h('a', { class: 'qr-link', href: branchUrl(b.id), target: '_blank', rel: 'noopener', text: branchUrl(b.id).replace('https://', '') }),
        status,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn btn--sm', onclick: () => downloadQr(b.id, branchName(b.id, names)).catch((err) => toast(err.message, 'error')) }, '⬇ Descargar QR'),
          h('button', {
            type: 'button', class: 'btn btn--sm btn--ghost',
            onclick: async () => { try { await navigator.clipboard.writeText(branchUrl(b.id)); toast('Enlace copiado.', 'ok'); } catch { prompt('Enlace:', branchUrl(b.id)); } }
          }, 'Copiar enlace'),
          h('button', {
            type: 'button', class: 'btn btn--sm btn--primary',
            onclick: async () => {
              if (currentMenu() !== b.id && isDirty() && !confirm('Tienes cambios sin publicar en el menú que estás editando. ¿Cambiar de todos modos? Se perderán.')) return;
              await switchMenu(b.id);
            }
          }, currentMenu() === b.id ? 'Editando' : 'Editar este menú'))));
    });

    return [
      h('h2', { text: 'Menús por sucursal y QR' }),
      h('p', { class: 'lead', text: 'Cada sucursal tiene su propia dirección y su propio menú. Imprime su QR y colócalo en esa sucursal. Mientras una sucursal no tenga menú propio, su página muestra el menú General.' }),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Sucursales' }),
          h('button', {
            type: 'button', class: 'btn btn--sm',
            onclick: async () => {
              try {
                await setDoc(doc(db, 'site', 'branches'), { names });
                setNames(names);
                toast('Nombres guardados.', 'ok');
                render();
              } catch (err) {
                toast(err.code === 'permission-denied' ? 'Firebase rechazó el guardado: faltan las reglas nuevas.' : err.message, 'error');
              }
            }
          }, 'Guardar nombres')),
        grid)
    ];
  }

  return { renderMenusQr };
}
