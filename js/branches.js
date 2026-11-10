// Menús por sucursal. Cada uno tiene su propia página (y su QR) y su propio documento en Firebase.
// "page" es la dirección pública: https://shokusushi.com/<page>
export const SITE_URL = 'https://shokusushi.com';

export const BRANCH_MENUS = [
  { id: 'general', page: '', name: 'General' },
  { id: 'milenio', page: 'menu-milenio', name: 'Milenio' },
  { id: 'tec', page: 'menu-tec', name: 'Tec' },
  { id: 'independencia', page: 'menu-independencia', name: 'Independencia' },
  { id: 'matamoros', page: 'menu-matamoros', name: 'Matamoros' },
  { id: 'gomez', page: 'menu-gomez', name: 'Gómez' },
  { id: 'centrito', page: 'menu-centrito', name: 'Centrito' },
  { id: 'menu7', page: 'menu7', name: 'Sucursal 7' }
];

export const isBranchId = (id) => BRANCH_MENUS.some((b) => b.id === id);

// El menú general sigue en site/menu; cada sucursal en menus/<id>.
export const menuDocPath = (id) => (!id || id === 'general' ? ['site', 'menu'] : ['menus', id]);

// Nombre visible: el que se guardó en el panel o el de esta lista.
export const branchName = (id, names = {}) => names[id] || BRANCH_MENUS.find((b) => b.id === id)?.name || id;

export const branchUrl = (id) => {
  const b = BRANCH_MENUS.find((x) => x.id === id);
  return b?.page ? `${SITE_URL}/${b.page}` : `${SITE_URL}/`;
};

// La página de cada sucursal lo indica en <html data-branch="...">.
export const currentBranch = () => {
  const id = document.documentElement.dataset.branch || 'general';
  return isBranchId(id) ? id : 'general';
};
