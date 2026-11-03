// Panel: personal y permisos, notificaciones manuales y estrategias con IA.
import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, query, where, orderBy, limit, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { db, USE_EMULATOR, usernameToEmail } from './firebase.js';
import { totalStamps, welcomeOf } from './loyalty-card.js';

export const PERMS = [
  { key: 'visits', label: 'Registrar visitas', hint: 'Escanear tarjetas, dar sellos y ver los datos del comensal' },
  { key: 'redeem', label: 'Entregar recompensas', hint: 'Marcar recompensas como canjeadas' },
  { key: 'customers', label: 'Ver todos los clientes', hint: 'Lista completa, búsqueda por nombre y descarga a Excel' },
  { key: 'reports', label: 'Ver reportes', hint: 'Visitas, cumpleaños, frecuentes e inactivos' },
  { key: 'notify', label: 'Enviar notificaciones', hint: 'Mandar avisos a quienes tienen la tarjeta' },
  { key: 'card', label: 'Editar la tarjeta', hint: 'Diseño, sellos, recompensa, promociones y mensajes' },
  { key: 'menu', label: 'Editar el menú y el sitio', hint: 'Platillos, precios, fotos, enlaces y apariencia' },
  { key: 'ai', label: 'Estrategias con IA', hint: 'Ver el diagnóstico y generar estrategias' }
];
const DEFAULT_PERMS = { visits: true, redeem: true };
const DAY = 86400000;
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const toDate = (ts) => ts?.toDate?.() || null;
const fmt = (d) => (d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Grupos de clientes a los que se puede mandar una notificación.
export const AUDIENCES = [
  { key: 'all', label: 'Todos los que tienen tarjeta', test: () => true },
  { key: 'inactive14', label: 'No han venido en 14 días o más', test: (c, now) => (now - ((toDate(c.lastVisit) || toDate(c.createdAt))?.getTime() || now)) >= 14 * DAY },
  { key: 'expiring7', label: 'Su tarjeta vence en 7 días o menos', test: (c, now) => { const e = toDate(c.expiresAt)?.getTime(); return !!e && e >= now && e <= now + 7 * DAY; } },
  { key: 'reward', label: 'Tienen una recompensa sin canjear', test: (c) => (c.rewardsAvailable || 0) > 0 }
];

export function createTeam(ctx) {
  const { h, field, toast, render, loyalty, getMenu, getLoy, can, app } = ctx;

  /* ==================== Personal y permisos ==================== */

  // Crea la cuenta con una instancia aparte de Firebase para no cerrar la sesión del dueño.
  async function createAccount(email, password) {
    const second = initializeApp(app.options, `alta-${Date.now()}`);
    const auth2 = getAuth(second);
    if (USE_EMULATOR) connectAuthEmulator(auth2, 'http://127.0.0.1:9099', { disableWarnings: true });
    try {
      const cred = await createUserWithEmailAndPassword(auth2, email, password);
      await signOut(auth2);
      return cred.user.uid;
    } finally {
      await deleteApp(second);
    }
  }

  const SIGNUP_ERRORS = {
    'auth/email-already-in-use': 'Ese usuario ya existe. Elige otro nombre de usuario.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'El usuario solo puede tener letras, números y puntos.',
    'auth/admin-restricted-operation': 'Firebase tiene bloqueada la creación de cuentas. Activa “Enable create (sign-up)” en Authentication → Settings.',
    'auth/operation-not-allowed': 'Activa “Correo electrónico/contraseña” en Firebase Authentication.'
  };

  function permChecks(perms, onChange) {
    return h('div', { class: 'perm-grid' }, PERMS.map((p) => h('label', { class: 'check', style: 'align-items:flex-start' },
      h('input', { type: 'checkbox', checked: !!perms[p.key], onchange: (e) => onChange(p.key, e.target.checked) }),
      h('span', {}, p.label, h('small', { text: p.hint })))));
  }

  function renderStaff() {
    const list = h('div', {}, h('p', { class: 'empty', text: 'Cargando personal…' }));
    const paint = async () => {
      const snap = await getDocs(collection(db, 'staff'));
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (!rows.length) { list.replaceChildren(h('p', { class: 'empty', text: 'Todavía no hay personal registrado.' })); return; }
      list.replaceChildren(...rows.map((st) => h('div', { class: `staff-card${st.active ? '' : ' is-off'}` },
        h('div', { class: 'staff-card__head' },
          h('strong', { text: st.name }), h('small', { text: `usuario: ${st.username}` }), h('span', { class: 'spacer' }),
          h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: !!st.active, onchange: async (e) => { await updateDoc(doc(db, 'staff', st.uid), { active: e.target.checked }); toast(e.target.checked ? `${st.name} activado.` : `${st.name} ya no puede entrar.`, 'ok'); paint(); } }),
            'Activo'),
          h('button', {
            type: 'button', class: 'btn btn--sm btn--danger',
            onclick: async () => {
              if (!confirm(`¿Quitarle el acceso a ${st.name}? Ese nombre de usuario ya no se podrá volver a usar.`)) return;
              await deleteDoc(doc(db, 'staff', st.uid));
              toast('Acceso eliminado.', 'ok');
              paint();
            }
          }, 'Eliminar')),
        permChecks(st.perms || {}, async (key, val) => {
          await updateDoc(doc(db, 'staff', st.uid), { [`perms.${key}`]: val });
          toast('Permiso actualizado.', 'ok');
        }))));
    };
    paint().catch((err) => list.replaceChildren(h('div', { class: 'notice notice--danger', text: `No se pudo leer el personal: ${err.message}` })));

    const form = { name: '', username: '', password: '', perms: { ...DEFAULT_PERMS } };
    const input = (key, attrs) => h('input', { ...attrs, oninput: (e) => { form[key] = e.target.value; } });
    const create = async (e) => {
      const btn = e.currentTarget;
      const username = form.username.trim().toLowerCase();
      if (form.name.trim().length < 2) return toast('Escribe el nombre de la persona.', 'error');
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) return toast('El usuario debe tener de 3 a 30 letras o números, sin espacios.', 'error');
      if (form.password.length < 6) return toast('La contraseña debe tener al menos 6 caracteres.', 'error');
      btn.disabled = true;
      try {
        const uid = await createAccount(usernameToEmail(username), form.password);
        await setDoc(doc(db, 'staff', uid), { name: form.name.trim(), username, active: true, perms: form.perms, createdAt: serverTimestamp() });
        toast(`Listo: ${form.name.trim()} ya puede entrar con el usuario “${username}”.`, 'ok');
        render();
      } catch (err) {
        toast(SIGNUP_ERRORS[err.code] || `No se pudo crear: ${err.message}`, 'error');
      } finally {
        btn.disabled = false;
      }
    };

    return [
      h('h2', { text: 'Personal y permisos' }),
      h('p', { class: 'lead', text: 'Crea un usuario para cada mesero. Entran en esta misma página y solo ven lo que les permitas.' }),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Agregar persona' })),
        h('div', { class: 'grid grid--2' },
          field('Nombre', input('name', { placeholder: 'Ej. Juan Pérez' })),
          field('Usuario para entrar', input('username', { placeholder: 'Ej. juan', autocapitalize: 'none', spellcheck: 'false' })),
          field('Contraseña', input('password', { type: 'text', placeholder: 'Mínimo 6 caracteres', autocomplete: 'new-password' }), 'Anótala y dásela a la persona: por seguridad no se vuelve a mostrar.')),
        h('p', { class: 'mini-label', style: 'margin:14px 0 8px', text: 'Qué puede hacer' }),
        permChecks(form.perms, (key, val) => { form.perms[key] = val; }),
        h('button', { type: 'button', class: 'btn btn--primary', style: 'margin-top:14px', onclick: create }, 'Crear usuario')),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', { text: 'Personal registrado' })), list)
    ];
  }

  /* ==================== Notificaciones ==================== */

  function renderNotify() {
    const walletReady = !!getLoy().wallet?.notifyReady;
    const form = { title: '', message: '', audience: 'all' };
    const countEl = h('p', { class: 'muted', text: 'Calculando destinatarios…' });
    const historyEl = h('div', {}, h('p', { class: 'empty', text: 'Cargando…' }));
    let customers = [];

    const refreshCount = () => {
      const aud = AUDIENCES.find((a) => a.key === form.audience);
      const now = Date.now();
      countEl.textContent = `Se enviará a ${customers.filter((c) => aud.test(c, now)).length} persona(s).`;
    };
    loyalty.loadCustomers(true).then((l) => { customers = l; refreshCount(); })
      .catch(() => { countEl.textContent = 'No se pudo calcular cuántas personas lo recibirán.'; });

    const paintHistory = async () => {
      const snap = await getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(20)));
      historyEl.replaceChildren(...(snap.empty
        ? [h('p', { class: 'empty', text: 'Todavía no has enviado notificaciones.' })]
        : snap.docs.map((d) => {
          const b = d.data();
          return h('div', { class: 'insight' },
            h('strong', { text: b.title || 'Aviso' }), b.message, h('br'),
            h('small', { class: 'muted', text: `${fmt(toDate(b.createdAt))} · ${AUDIENCES.find((a) => a.key === b.audience)?.label || ''} · ${b.recipients ?? 0} persona(s) · ${b.by || ''}` }));
        })));
    };
    paintHistory().catch((err) => historyEl.replaceChildren(h('p', { class: 'empty', text: err.message })));

    const send = async (e) => {
      const btn = e.currentTarget;
      const title = form.title.trim();
      const message = form.message.trim();
      if (!message) return toast('Escribe el mensaje.', 'error');
      const aud = AUDIENCES.find((a) => a.key === form.audience);
      const now = Date.now();
      const recipients = customers.filter((c) => aud.test(c, now)).length;
      if (!confirm(`¿Enviar este aviso a ${recipients} persona(s)?\n\n${message}`)) return undefined;
      btn.disabled = true;
      try {
        await addDoc(collection(db, 'broadcasts'), {
          title, message, audience: form.audience, recipients,
          by: ctx.userEmail?.() || '', createdAt: serverTimestamp(), walletStatus: 'pendiente'
        });
        toast('Notificación enviada.', 'ok');
        render();
      } catch (err) {
        toast(err.code === 'permission-denied' ? 'No tienes permiso o faltan las reglas nuevas de Firestore.' : err.message, 'error');
      } finally {
        btn.disabled = false;
      }
      return undefined;
    };

    return [
      h('h2', { text: 'Notificaciones' }),
      h('p', { class: 'lead', text: 'Escribe un aviso y mándalo a quienes tienen tu tarjeta.' }),
      walletReady ? null : h('div', { class: 'notice', text: 'Por ahora el aviso aparece al instante en la página de la tarjeta del cliente. Para que también llegue a la pantalla de bloqueo del teléfono falta publicar el servidor de Wallet; los avisos que mandes hoy no se reenviarán.' }),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Nuevo aviso' })),
        h('div', { class: 'grid grid--2' },
          field('Título (opcional)', h('input', { maxlength: 60, placeholder: 'Ej. ¡Hoy 2x1!', oninput: (e) => { form.title = e.target.value; } })),
          field('¿A quién?', h('select', { onchange: (e) => { form.audience = e.target.value; refreshCount(); } }, AUDIENCES.map((a) => h('option', { value: a.key, text: a.label }))))),
        h('div', { style: 'margin-top:12px' }, field('Mensaje', h('textarea', { rows: 3, maxlength: 300, placeholder: 'Ej. Hoy martes rollos al 2x1. ¡Te esperamos!', oninput: (e) => { form.message = e.target.value; } }))),
        countEl,
        h('button', { type: 'button', class: 'btn btn--primary btn--big', style: 'margin-top:10px', onclick: send }, '🔔 Notificar')),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', { text: 'Enviadas' })), historyEl)
    ];
  }

  /* ==================== Estrategias con IA ==================== */

  // Solo cifras agregadas: ningún nombre, teléfono ni correo sale del negocio.
  async function collectMetrics() {
    const loy = getLoy();
    const menu = getMenu();
    const list = await loyalty.loadCustomers(true);
    const since = new Date(Date.now() - 90 * DAY);
    const snap = await getDocs(query(collection(db, 'visits'), where('at', '>=', Timestamp.fromDate(since))));
    const visits = snap.docs.map((d) => d.data());
    const stamps = visits.filter((v) => v.type === 'sello');
    const now = Date.now();
    const byDay = Array(7).fill(0);
    const byHour = Array(24).fill(0);
    stamps.forEach((v) => { const d = toDate(v.at); if (d) { byDay[d.getDay()] += 1; byHour[d.getHours()] += 1; } });
    const items = menu.sections.flatMap((s) => s.groups.flatMap((g) => g.items));
    const prices = items.map((i) => Number(i.price)).filter((n) => n > 0);
    return {
      periodoDias: 90,
      clientes: {
        total: list.length,
        nuevos30d: list.filter((c) => toDate(c.createdAt) >= new Date(now - 30 * DAY)).length,
        sinVolver: list.filter((c) => !c.visits).length,
        unaVisita: list.filter((c) => c.visits === 1).length,
        dosOMasVisitas: list.filter((c) => c.visits >= 2).length,
        inactivos14d: list.filter((c) => (now - ((toDate(c.lastVisit) || toDate(c.createdAt))?.getTime() || now)) >= 14 * DAY).length,
        tarjetasVencidas: list.filter((c) => toDate(c.expiresAt) && toDate(c.expiresAt).getTime() < now).length,
        vencenEn7d: list.filter((c) => { const e = toDate(c.expiresAt)?.getTime(); return e && e >= now && e <= now + 7 * DAY; }).length
      },
      visitas: {
        total: stamps.length,
        porDia: Object.fromEntries(WEEKDAYS.map((d, i) => [d, byDay[i]])),
        porHora: Object.fromEntries(byHour.map((n, i) => [`${i}:00`, n]).filter(([, n]) => n > 0))
      },
      recompensas: {
        ganadas: list.reduce((s, c) => s + (c.rewardsEarned || 0), 0),
        canjeadas: list.reduce((s, c) => s + (c.rewardsRedeemed || 0), 0),
        sinCanjear: list.reduce((s, c) => s + (c.rewardsAvailable || 0), 0)
      },
      programa: {
        sellosParaCompletar: totalStamps(loy.card),
        sellosDeRegalo: welcomeOf(loy.card),
        vigenciaMeses: Number(loy.card.validityMonths) || 0,
        recompensa: loy.card.rewardText,
        promocionesActivas: (loy.promotions || []).filter((p) => p.active).map((p) => p.title)
      },
      menu: {
        secciones: menu.sections.filter((s) => !s.hidden).map((s) => s.name),
        platillos: items.filter((i) => !i.hidden).length,
        precioPromedio: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0
      }
    };
  }

  // Observaciones calculadas con reglas simples; no usan IA ni tienen costo.
  function localInsights(m) {
    const out = [];
    const c = m.clientes;
    if (c.total < 20) out.push(['', 'Todavía hay pocos datos', `Llevas ${c.total} cliente(s) con tarjeta. Las conclusiones serán más confiables con al menos 20 o 30. Por ahora, lo más útil es invitar a registrarse en cada mesa.`]);
    if (c.total && c.sinVolver / c.total >= 0.5) out.push(['warn', `${pct(c.sinVolver, c.total)}% se registró y no ha regresado`, 'Es tu mayor oportunidad: manda un aviso a quienes tienen pocos sellos con una razón concreta para volver esta semana.']);
    if (c.vencenEn7d) out.push(['warn', `${c.vencenEn7d} tarjeta(s) vencen en 7 días`, 'Avísales ahora que les falta poco: es el mensaje con más motivo para regresar.']);
    if (m.recompensas.sinCanjear) out.push(['warn', `${m.recompensas.sinCanjear} recompensa(s) sin canjear`, 'Recuérdaselas: un cliente con premio pendiente tiene una razón fácil para volver.']);
    if (c.tarjetasVencidas) out.push(['', `${c.tarjetasVencidas} tarjeta(s) vencidas`, 'Si son muchas, puede que un mes sea poco tiempo para juntar los sellos. Compáralo con cuántos clientes completan la tarjeta.']);
    if (m.recompensas.ganadas >= 5 && m.recompensas.canjeadas / m.recompensas.ganadas < 0.5) out.push(['warn', 'Se canjean pocas recompensas', `Solo ${pct(m.recompensas.canjeadas, m.recompensas.ganadas)}% de las recompensas ganadas se ha usado. Revisa si el personal las está ofreciendo al cobrar.`]);
    if (m.visitas.total >= 20) {
      const days = Object.entries(m.visitas.porDia).sort((a, b) => a[1] - b[1]);
      out.push(['good', `${days[6][0]} es tu día más fuerte; ${days[0][0]}, el más flojo`, `Con tarjeta registraste ${days[6][1]} visitas en ${days[6][0].toLowerCase()} contra ${days[0][1]} en ${days[0][0].toLowerCase()}. Prueba una promoción solo para el día flojo.`]);
    }
    return out;
  }

  const AI_ERRORS = {
    'functions/not-found': 'La función de IA todavía no está publicada en Firebase.',
    'functions/unavailable': 'No se pudo contactar la función de IA. Revisa tu conexión o que esté publicada.',
    'functions/internal': 'La función de IA todavía no está publicada o falló. Revisa los registros en Firebase.'
  };

  function renderAI() {
    const diagnosis = h('div', {}, h('p', { class: 'empty', text: 'Calculando diagnóstico…' }));
    const results = h('div', {});
    const history = h('div', {});
    let metrics = null;

    const strategyCard = (it) => h('div', { class: 'strategy' },
      h('h4', { text: it.title }), h('p', { text: it.why }),
      h('ul', {}, (it.actions || []).map((a) => h('li', { text: a }))),
      h('small', { text: `Cómo medirlo: ${it.metric} · Esfuerzo: ${it.effort}` }));

    const paintHistory = async () => {
      const snap = await getDocs(query(collection(db, 'strategies'), orderBy('createdAt', 'desc'), limit(5)));
      history.replaceChildren(...(snap.empty ? [h('p', { class: 'empty', text: 'Aún no has generado estrategias.' })] : snap.docs.map((d) => {
        const st = d.data();
        return h('details', { class: 'strategy' },
          h('summary', { text: `${fmt(toDate(st.createdAt))}${st.goal ? ` · ${st.goal}` : ''}` }),
          h('p', { style: 'margin-top:8px', text: st.summary }), (st.items || []).map(strategyCard));
      })));
    };

    collectMetrics().then((m) => {
      metrics = m;
      const ins = localInsights(m);
      diagnosis.replaceChildren(
        h('div', { class: 'stats' }, [
          ['Clientes', m.clientes.total], ['Regresaron 2+ veces', m.clientes.dosOMasVisitas],
          ['Visitas (90 días)', m.visitas.total], ['Recompensas canjeadas', m.recompensas.canjeadas]
        ].map(([l, v]) => h('div', { class: 'stat' }, h('span', { text: l }), h('strong', { text: String(v) })))),
        ...(ins.length ? ins : [['good', 'Sin alertas por ahora', 'No se detectó ningún problema evidente con los datos actuales.']]).map(([kind, title, text]) =>
          h('div', { class: `insight${kind ? ` insight--${kind}` : ''}` }, h('strong', { text: title }), text)));
    }).catch((err) => diagnosis.replaceChildren(h('div', { class: 'notice notice--danger', text: `No se pudo calcular el diagnóstico: ${err.message}` })));
    paintHistory().catch(() => {});

    let goal = '';
    const generate = async (e) => {
      const btn = e.currentTarget;
      if (!metrics) return toast('Espera a que termine el diagnóstico.', 'error');
      btn.disabled = true;
      btn.textContent = 'Pensando… puede tardar un minuto';
      results.replaceChildren();
      try {
        const fns = getFunctions(app);
        if (USE_EMULATOR) connectFunctionsEmulator(fns, '127.0.0.1', 5001);
        const call = httpsCallable(fns, 'generateStrategies', { timeout: 280000 });
        const { data } = await call({ metrics, goal: goal.trim().slice(0, 300) });
        results.replaceChildren(h('div', { class: 'insight insight--good' }, h('strong', { text: 'Resumen' }), data.summary), ...data.items.map(strategyCard));
        await addDoc(collection(db, 'strategies'), { goal: goal.trim().slice(0, 300), summary: data.summary, items: data.items, by: ctx.userEmail?.() || '', createdAt: serverTimestamp() });
        paintHistory().catch(() => {});
      } catch (err) {
        results.replaceChildren(h('div', { class: 'notice notice--danger', text: AI_ERRORS[err.code] || err.message }));
      } finally {
        btn.disabled = false;
        btn.textContent = '✨ Generar estrategias con IA';
      }
      return undefined;
    };

    return [
      h('h2', { text: 'Estrategias con IA' }),
      h('p', { class: 'lead', text: 'Un diagnóstico con los datos de tu tarjeta y tu menú, y recomendaciones para mejorar el restaurante.' }),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', { text: 'Diagnóstico de tus datos' })), diagnosis),
      h('section', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', { text: 'Generar estrategias' })),
        field('¿En qué te quieres enfocar? (opcional)', h('textarea', { rows: 2, maxlength: 300, placeholder: 'Ej. Llenar el restaurante los lunes y martes', oninput: (e) => { goal = e.target.value; } })),
        h('p', { class: 'muted', style: 'margin:8px 0 12px', text: 'A la IA solo se le envían cifras generales; nunca nombres, teléfonos ni correos. Cada generación tiene un costo pequeño en tu cuenta de la API.' }),
        h('button', { type: 'button', class: 'btn btn--primary btn--big', onclick: generate }, '✨ Generar estrategias con IA'),
        results),
      h('section', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', { text: 'Estrategias anteriores' })), history)
    ];
  }

  return { renderStaff, renderAI, renderNotify };
}
