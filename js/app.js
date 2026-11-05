import { BABY_NAME, FIREBASE_CONFIG, SECTIONS } from './config.js';
import { createLocalStore, createFirebaseStore } from './store.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

const state = {
  date: isoDate(new Date()),
  day: { fields: {}, entries: [] },
  unsub: null,
  name: localStorage.getItem('ceci-name') || '',
  editing: null, // {section, id}
};

let store;
const status = (msg, isError = false) => {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
};

// ───────────────────────── Avvio ─────────────────────────
async function start() {
  $('#title').textContent = `Agenda di ${BABY_NAME}`;
  document.title = `Agenda di ${BABY_NAME}`;
  try {
    store = FIREBASE_CONFIG ? await createFirebaseStore(FIREBASE_CONFIG) : createLocalStore();
  } catch (e) {
    console.error(e);
    store = createLocalStore();
    status('Impossibile collegarsi al server: uso i dati di questo dispositivo.', true);
  }
  store.init((user) => {
    if (!user) {
      $('#login').classList.remove('hidden');
      $('#main').classList.add('hidden');
      return;
    }
    state.user = user;
    if (!state.name && user.email) state.name = user.email.split('@')[0];
    $('#login').classList.add('hidden');
    $('#main').classList.remove('hidden');
    openDay(state.date);
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ───────────────────────── Login ─────────────────────────
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#login-error').textContent = '';
  try {
    await store.signIn(f.get('email').trim(), f.get('password'));
  } catch (err) {
    $('#login-error').textContent = 'Email o password non corrette.';
    console.error(err);
  }
});
$('#btn-reset').addEventListener('click', async () => {
  const email = $('#login-form').email.value.trim();
  if (!email) { $('#login-error').textContent = 'Scrivi prima la tua email.'; return; }
  try { await store.resetPassword(email); $('#login-error').textContent = 'Ti ho mandato una email per reimpostare la password.'; }
  catch { $('#login-error').textContent = 'Non è stato possibile inviare l\'email.'; }
});

// ───────────────────────── Giorno ─────────────────────────
function openDay(date) {
  state.date = date;
  state.unsub?.();
  const d = parseDate(date);
  const txt = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('#date-text').textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
  $('#date-input').value = date;
  $('#today').classList.toggle('hidden', date === isoDate(new Date()));
  state.unsub = store.subscribeDay(date, (day) => {
    state.day = day;
    status('');
    render();
  }, (err) => {
    console.error(err);
    status(err.code === 'permission-denied'
      ? 'Questo account non è autorizzato a vedere l\'agenda.'
      : 'Errore di collegamento: ' + err.message, true);
  });
}

const shift = (n) => { const d = parseDate(state.date); d.setDate(d.getDate() + n); openDay(isoDate(d)); };
$('#prev').addEventListener('click', () => shift(-1));
$('#next').addEventListener('click', () => shift(1));
$('#today').addEventListener('click', () => openDay(isoDate(new Date())));
$('#date-input').addEventListener('change', (e) => e.target.value && openDay(e.target.value));

// ───────────────────────── Rendering ─────────────────────────
const sortKey = (sec, e) => {
  const t = sec.fields.find((f) => f.type === 'time');
  return (t && e[t.key]) || '99:99';
};
const itemsOf = (sec) => state.day.entries
  .filter((e) => e.section === sec.id)
  .sort((a, b) => sortKey(sec, a).localeCompare(sortKey(sec, b)) || (a.createdAt || 0) - (b.createdAt || 0));

function render() {
  const active = document.activeElement;
  const focusedText = active?.dataset?.textSection;

  $('#sections').innerHTML = SECTIONS.map((sec) => {
    let body = '';
    if (sec.type === 'tally') {
      const items = itemsOf(sec);
      body = `<div class="tally">${items.map((e) =>
        `<button class="mark" data-edit="${sec.id}" data-id="${e.id}" title="${esc(e.ora || '')}${e.by ? ' · ' + esc(e.by) : ''}">✕</button>`).join('')}
        <button class="mark add-mark" data-quick="${sec.id}" aria-label="Aggiungi ${esc(sec.title)}">＋</button></div>`;
    } else if (sec.type === 'list') {
      const items = itemsOf(sec);
      body = items.length
        ? `<ul class="entries">${items.map((e) => entryRow(sec, e)).join('')}</ul>`
        : `<p class="empty">Ancora niente oggi</p>`;
      body += `<button class="add" data-add="${sec.id}">＋ Aggiungi</button>`;
    } else if (sec.type === 'choice') {
      const cur = state.day.fields[sec.id];
      body = `<div class="choices">${sec.options.map((o) =>
        `<button class="choice ${cur === o ? 'on' : ''}" data-choice="${sec.id}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
    } else if (sec.type === 'text') {
      const val = focusedText === sec.id ? active.value : (state.day.fields[sec.id] || '');
      body = `<textarea data-text-section="${sec.id}" rows="3" placeholder="${esc(sec.placeholder || '')}">${esc(val)}</textarea>`;
    }
    const n = sec.type === 'tally' ? `<span class="count">${itemsOf(sec).length}</span>` : '';
    const total = sec.total ? `<p class="total">${esc(sec.total(itemsOf(sec)))}</p>` : '';
    return `<section class="card sec-${sec.id}">
      <h2><span>${sec.icon}</span> ${esc(sec.title)} ${n}</h2>
      ${body}${total}
    </section>`;
  }).join('');

  if (focusedText) {
    const ta = document.querySelector(`[data-text-section="${focusedText}"]`);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
}

function entryRow(sec, e) {
  const times = sec.fields.filter((f) => f.type === 'time').map((f) => e[f.key]).filter(Boolean);
  const rest = sec.fields.filter((f) => f.type !== 'time' && e[f.key] !== undefined && e[f.key] !== '')
    .map((f) => f.type === 'number' ? `${esc(e[f.key])} ${f.label.match(/\(([^)]+)\)/)?.[1] || ''}` : esc(e[f.key]));
  return `<li><button class="entry" data-edit="${sec.id}" data-id="${e.id}">
    <span class="time">${esc(times.join(' – ') || '—')}</span>
    <span class="desc">${rest.join(' · ') || '&nbsp;'}</span>
    ${e.by ? `<span class="by">${esc(e.by)}</span>` : ''}
  </button></li>`;
}

// ───────────────────────── Interazioni ─────────────────────────
$('#sections').addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.quick) {
    const sec = SECTIONS.find((s) => s.id === t.dataset.quick);
    const data = { section: sec.id };
    for (const f of sec.fields) data[f.key] = f.now ? nowTime() : '';
    store.addEntry(state.date, data, state.name || '').catch(saveError);
  } else if (t.dataset.add) openEntry(t.dataset.add);
  else if (t.dataset.edit) openEntry(t.dataset.edit, t.dataset.id);
  else if (t.dataset.choice) {
    const cur = state.day.fields[t.dataset.choice];
    const v = cur === t.dataset.value ? '' : t.dataset.value;
    store.setField(state.date, t.dataset.choice, v).catch(saveError);
  }
});

const timers = {};
$('#sections').addEventListener('input', (ev) => {
  const key = ev.target.dataset.textSection;
  if (!key) return;
  clearTimeout(timers[key]);
  const date = state.date, value = ev.target.value;
  timers[key] = setTimeout(() => store.setField(date, key, value).catch(saveError), 700);
});
$('#sections').addEventListener('focusout', (ev) => {
  const key = ev.target.dataset.textSection;
  if (!key) return;
  clearTimeout(timers[key]);
  if ((state.day.fields[key] || '') !== ev.target.value) store.setField(state.date, key, ev.target.value).catch(saveError);
});

function saveError(err) {
  console.error(err);
  status('Non sono riuscito a salvare: ' + (err.message || err), true);
}

// ───────────────────────── Finestra voce ─────────────────────────
const dlg = $('#entry-dialog');
function openEntry(sectionId, id) {
  const sec = SECTIONS.find((s) => s.id === sectionId);
  const entry = id ? state.day.entries.find((e) => e.id === id) : null;
  state.editing = { sec, id };
  $('#entry-title').textContent = `${sec.icon} ${sec.title}`;
  $('#entry-delete').classList.toggle('hidden', !id);
  $('#entry-fields').innerHTML = sec.fields.map((f) => {
    const val = entry ? entry[f.key] ?? '' : (f.now ? nowTime() : '');
    let input;
    if (f.type === 'select') {
      input = `<select name="${f.key}"><option value=""></option>${f.options.map((o) =>
        `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else {
      input = `<input name="${f.key}" type="${f.type}" value="${esc(val)}" placeholder="${esc(f.placeholder || '')}"
        ${f.type === 'number' ? 'inputmode="decimal" step="any" min="0"' : ''}
        ${f.type === 'number' && !entry ? 'autofocus' : ''}>`;
    }
    return `<label>${esc(f.label)}${input}</label>`;
  }).join('');
  dlg.showModal();
}

$('#entry-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const { sec, id } = state.editing;
  const f = new FormData(ev.target);
  const data = { section: sec.id };
  for (const fld of sec.fields) {
    const v = (f.get(fld.key) || '').toString().trim();
    data[fld.key] = fld.type === 'number' && v !== '' ? Number(v.replace(',', '.')) : v;
  }
  dlg.close();
  const by = state.name || '';
  try {
    if (id) await store.updateEntry(state.date, id, data, by);
    else await store.addEntry(state.date, data, by);
  } catch (err) { saveError(err); }
});
$('#entry-cancel').addEventListener('click', () => dlg.close());
$('#entry-delete').addEventListener('click', async () => {
  if (!confirm('Eliminare questa voce?')) return;
  dlg.close();
  try { await store.deleteEntry(state.date, state.editing.id); } catch (err) { saveError(err); }
});

// ───────────────────────── Impostazioni ─────────────────────────
const sdlg = $('#settings-dialog');
$('#btn-settings').addEventListener('click', () => {
  $('#set-name').value = state.name;
  $('#mode-info').textContent = store?.shared
    ? `Agenda condivisa ✅ — sei collegato come ${state.user?.email || '—'}.`
    : 'Modalità locale: i dati restano solo su questo dispositivo. Per condividerli con Alice segui il README.';
  $('#btn-logout').classList.toggle('hidden', !(store?.shared && state.user));
  sdlg.showModal();
});
$('#settings-form').addEventListener('submit', () => {
  state.name = $('#set-name').value.trim();
  localStorage.setItem('ceci-name', state.name);
});
$('#btn-logout').addEventListener('click', async () => { sdlg.close(); await store.signOut(); });
$('#btn-export').addEventListener('click', async () => {
  const data = await store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: `agenda-${BABY_NAME.toLowerCase()}-${isoDate(new Date())}.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
});

// riapre su "oggi" quando l'app torna in primo piano il giorno dopo
let lastToday = isoDate(new Date());
document.addEventListener('visibilitychange', () => {
  const t = isoDate(new Date());
  if (document.visibilityState === 'visible' && t !== lastToday) {
    if (state.date === lastToday && state.user) openDay(t);
    lastToday = t;
  }
});

start();
