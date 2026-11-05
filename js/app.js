import { BABY_NAME, FIREBASE_CONFIG, SECTIONS } from './config.js';
import { icon } from './icons.js';
import { createLocalStore, createFirebaseStore, createClaudeStore } from './store.js';

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
  name: (() => { try { return localStorage.getItem('ceci-name') || ''; } catch { return ''; } })(),
  editing: null, // {section, id}
  view: 'day', // 'day' | 'week'
  week: { start: null, days: {}, unsubs: [] },
  names: {}, // id persona → nome (solo su claude.ai)
};

let store;
const status = (msg, isError = false) => {
  const el = $('#status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
};

// ───────────────────────── Avvio ─────────────────────────
async function start() {
  $('#title').textContent = BABY_NAME;
  document.title = `Agenda di ${BABY_NAME}`;
  try {
    if (typeof window.claude?.use === 'function') {
      store = await createClaudeStore();
      if (!store) status('Accedi a Claude per vedere l\'agenda condivisa. Intanto i dati restano su questo dispositivo.', true);
    }
    store ||= FIREBASE_CONFIG ? await createFirebaseStore(FIREBASE_CONFIG) : createLocalStore();
  } catch (e) {
    console.error(e);
    store = createLocalStore();
    status('Impossibile collegarsi al server: uso i dati di questo dispositivo.', true);
  }
  store.init((user) => {
    if (!user) {
      $('#login').classList.remove('hidden');
      $('#main').classList.add('hidden');
      $('#week').classList.add('hidden');
      $('.tabbar').classList.add('hidden');
      return;
    }
    state.user = user;
    if (!state.name && user.email) state.name = user.email.split('@')[0];
    $('#login').classList.add('hidden');
    $('.tabbar').classList.remove('hidden');
    showView(state.view);
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
  const diff = Math.round((d - parseDate(isoDate(new Date()))) / 864e5);
  const rel = { 0: 'Oggi', [-1]: 'Ieri', 1: 'Domani' }[diff];
  $('#date-eyebrow').textContent = rel || d.toLocaleDateString('it-IT', { weekday: 'long' });
  $('#date-text').textContent = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#date-input').value = date;
  $('#today').classList.toggle('hidden', date === isoDate(new Date()));
  state.unsub = store.subscribeDay(date, async (day) => {
    state.day = day;
    status('');
    render();
    if (store.names) {
      const ids = [...new Set(day.entries.map((e) => e.byId).filter((i) => i && !(i in state.names)))];
      if (ids.length) { Object.assign(state.names, await store.names(ids)); render(); }
    }
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

  // riquadri riassuntivi in alto
  $('#today-stats').innerHTML = SECTIONS.filter((s) => s.stat).map((sec) => {
    const st = sec.stat(itemsOf(sec));
    return `<button class="tile tone-${sec.id}" data-jump="sec-${sec.id}">
      ${icon(sec.icon)}<b>${esc(st.value)}${st.unit ? `<small>${esc(st.unit)}</small>` : ''}</b><span>${esc(st.label)}</span></button>`;
  }).join('');

  $('#sections').innerHTML = SECTIONS.map((sec) => {
    let body = '';
    if (sec.type === 'tally') {
      const items = itemsOf(sec);
      body = `<div class="tally">${items.map((e) =>
        `<button class="mark" data-edit="${sec.id}" data-id="${e.id}" aria-label="${esc(sec.title)} delle ${esc(e.ora || '')}">✕<small>${esc(e.ora || '')}</small></button>`).join('')}
        <button class="add-mark" data-quick="${sec.id}" aria-label="Aggiungi ${esc(sec.title)}">${icon('plus')}</button></div>`;
    } else if (sec.type === 'list') {
      const items = itemsOf(sec);
      body = items.length
        ? `<ul class="entries">${items.map((e) => entryRow(sec, e)).join('')}</ul>`
        : `<p class="empty">Ancora niente oggi</p>`;
      if (sec.timeline) body = timeline(sec, items) + body;
      if (sec.quick) {
        const open = items.find((e) => e[sec.quick.from] && !e[sec.quick.to]);
        body += open
          ? `<button class="quick wake" data-wake="${sec.id}" data-id="${open.id}">${icon('sun')}${esc(sec.quick.endLabel)}</button>`
          : `<button class="quick" data-sleep="${sec.id}">${icon(sec.icon)}${esc(sec.quick.startLabel)}</button>`;
      }
      body += `<button class="add" data-add="${sec.id}">${icon('plus')}Aggiungi${sec.quick ? ' a mano' : ''}</button>`;
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
    return `<section class="card sec tone-${sec.id}" id="sec-${sec.id}">
      <h2><span class="badge">${icon(sec.icon)}</span><span class="hl">${esc(sec.title)}</span>${n}</h2>
      ${body}${total}
    </section>`;
  }).join('');

  if (focusedText) {
    const ta = document.querySelector(`[data-text-section="${focusedText}"]`);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
}

const toMin = (t) => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function timeline(sec, items, date = state.date, { ticks: showTicks = true } = {}) {
  const { from, to, start, end } = sec.timeline;
  const a = start * 60, b = end * 60, span = b - a;
  const isToday = date === isoDate(new Date());
  const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const pct = (m) => (Math.min(Math.max(m, a), b) - a) / span * 100;
  const blocks = items.map((e) => {
    const x = toMin(e[from]); if (x == null) return '';
    let y = toMin(e[to]); const ongoing = y == null;
    if (ongoing) y = isToday ? Math.max(nowMin, x + 5) : x + 5;
    if (y < x) y = b; // passa la mezzanotte: fino a fine scala
    if (y <= a || x >= b) return '';
    return `<span class="nap ${ongoing ? 'ongoing' : ''}" style="left:${pct(x)}%;width:${Math.max(pct(y) - pct(x), 0.8)}%"
      title="${esc(e[from])}${e[to] ? '–' + esc(e[to]) : ''}"></span>`;
  }).join('');
  const ticks = [];
  for (let h = start; h <= end; h += 2) ticks.push(`<span class="tick" style="left:${pct(h * 60)}%">${h}</span>`);
  const nowMark = isToday && nowMin > a && nowMin < b ? `<span class="now" style="left:${pct(nowMin)}%"></span>` : '';
  // linee guida ogni 2 ore
  const grid = [];
  for (let h = start + 2; h < end; h += 2) grid.push(`<span class="gridline" style="left:${pct(h * 60)}%"></span>`);
  return `<div class="timeline" aria-label="Linea del tempo dalle ${start} alle ${end}">
    <div class="track">${grid.join('')}${blocks}${nowMark}</div>${showTicks ? `<div class="ticks">${ticks.join('')}</div>` : ''}</div>`;
}

const who = (e) => (e.byId && state.names[e.byId]) || e.by || '';

function entryRow(sec, e) {
  const times = sec.fields.filter((f) => f.type === 'time').map((f) => e[f.key]).filter(Boolean);
  const rest = sec.fields.filter((f) => f.type !== 'time' && e[f.key] !== undefined && e[f.key] !== '')
    .map((f) => f.type === 'number' ? `${esc(e[f.key])} ${f.label.match(/\(([^)]+)\)/)?.[1] || ''}` : esc(e[f.key]));
  if (sec.detail) rest.unshift(`<b>${esc(sec.detail(e))}</b>`);
  return `<li><button class="entry" data-edit="${sec.id}" data-id="${e.id}">
    <span class="time">${esc(times.join(' – ') || '—')}</span>
    <span class="desc">${rest.join(' · ') || '&nbsp;'}</span>
    ${who(e) ? `<span class="by">${esc(who(e))}</span>` : ''}
  </button></li>`;
}

// ───────────────────────── Interazioni ─────────────────────────
$('#today-stats').addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-jump]');
  if (t) document.getElementById(t.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#sections').addEventListener('click', (ev) => {
  const t = ev.target.closest('button');
  if (!t) return;
  if (t.dataset.quick) {
    const sec = SECTIONS.find((s) => s.id === t.dataset.quick);
    const data = { section: sec.id };
    for (const f of sec.fields) data[f.key] = f.now ? nowTime() : '';
    store.addEntry(state.date, data, state.name || '').catch(saveError);
  } else if (t.dataset.sleep) {
    const sec = SECTIONS.find((s) => s.id === t.dataset.sleep);
    const data = { section: sec.id };
    for (const f of sec.fields) data[f.key] = '';
    data[sec.quick.from] = nowTime();
    store.addEntry(state.date, data, state.name || '').catch(saveError);
  } else if (t.dataset.wake) {
    const sec = SECTIONS.find((s) => s.id === t.dataset.wake);
    const e = state.day.entries.find((x) => x.id === t.dataset.id);
    const { id, by, byId, createdAt, date, ...data } = e;
    store.updateEntry(state.date, t.dataset.id, { ...data, [sec.quick.to]: nowTime() }, state.name || '').catch(saveError);
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
  $('#entry-title').innerHTML = `<span class="badge">${icon(sec.icon)}</span>${esc(sec.title)}`;
  $('#entry-form').className = `tone-${sec.id}`;
  $('#entry-delete').classList.toggle('hidden', !id);
  delete $('#entry-delete').dataset.armed;
  $('#entry-delete').textContent = 'Elimina';
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
$('#entry-delete').addEventListener('click', async (ev) => {
  const b = ev.currentTarget;
  if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Sicura? Tocca ancora'; return; }
  dlg.close();
  try { await store.deleteEntry(state.date, state.editing.id); } catch (err) { saveError(err); }
});


// ───────────────────────── Settimana ─────────────────────────
const NAP = SECTIONS.find((s) => s.timeline);
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const mondayOf = (iso) => { const d = parseDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDate(d); };
const addDays = (iso, n) => { const d = parseDate(iso); d.setDate(d.getDate() + n); return isoDate(d); };
const fmtMin = (m) => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m}m`; };
const fmtClock = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60))}`;
const napLen = (e) => {
  const x = toMin(e[NAP.timeline.from]), y = toMin(e[NAP.timeline.to]);
  if (x == null || y == null) return null;
  return y >= x ? y - x : y + 1440 - x;
};

function showView(view) {
  state.view = view;
  $('#main').classList.toggle('hidden', view !== 'day');
  $('#week').classList.toggle('hidden', view !== 'week');
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false'));
  if (view === 'day') openDay(state.date);
  else openWeek(state.week.start || mondayOf(state.date));
  window.scrollTo(0, 0);
}

function openWeek(start) {
  const w = state.week;
  w.unsubs.forEach((u) => u());
  w.start = start; w.days = {};
  const end = addDays(start, 6);
  const f = (iso, o) => parseDate(iso).toLocaleDateString('it-IT', o);
  $('#week-text').textContent = `${f(start, { day: 'numeric', month: 'short' })} – ${f(end, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  $('#week-this').classList.toggle('hidden', start === mondayOf(isoDate(new Date())));
  w.unsubs = [...Array(7)].map((_, i) => {
    const d = addDays(start, i);
    return store.subscribeDay(d, (day) => {
      w.days[d] = day.entries.filter((e) => e.section === NAP.id);
      renderWeek();
    }, (err) => status(err.message, true));
  });
  renderWeek();
}

function renderWeek() {
  const w = state.week;
  if (!NAP || !w.start) return;
  const today = isoDate(new Date());
  const { from, start, end } = NAP.timeline;
  const rows = [], perDay = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(w.start, i);
    const items = (w.days[d] || []).slice().sort((a, b) => (a[from] || '').localeCompare(b[from] || ''));
    const tot = items.reduce((s, e) => s + (napLen(e) || 0), 0);
    if (items.length) perDay.push({ items, tot });
    const future = d > today;
    rows.push(`<button class="wrow ${d === today ? 'today' : ''} ${future ? 'future' : ''}" data-day="${d}">
      <span class="wday"><b>${WEEKDAYS[i]}</b> ${parseDate(d).getDate()}</span>
      ${timeline(NAP, items, d, { ticks: false })}
      <span class="wtot">${items.length ? `${fmtMin(tot)}<small>${items.length} ${items.length === 1 ? 'pisolino' : 'pisolini'}</small>` : '<small>—</small>'}</span>
    </button>`);
  }
  const ticks = [];
  for (let h = start; h <= end; h += 4) ticks.push(`<span class="tick" style="left:${(h - start) / (end - start) * 100}%">${h}</span>`);
  $('#week-chart').innerHTML = rows.join('') +
    `<div class="wrow axis"><span class="wday"></span><div class="ticks">${ticks.join('')}</div><span class="wtot"></span></div>`;

  // medie della settimana
  const n = perDay.length;
  const stats = [];
  if (n) {
    stats.push(['Pisolini al giorno', (perDay.reduce((s, x) => s + x.items.length, 0) / n).toFixed(1).replace('.', ',')]);
    stats.push(['Sonno di giorno', fmtMin(perDay.reduce((s, x) => s + x.tot, 0) / n)]);
  }
  $('#week-stats').innerHTML = n
    ? stats.map(([k, v]) => `<div class="stat"><span>${k}</span><b>${v}</b><small>media su ${n} ${n === 1 ? 'giorno' : 'giorni'}</small></div>`).join('')
    : '<p class="empty">Nessun pisolino segnato in questa settimana.</p>';

  // orario tipico di ogni pisolino (1°, 2°, 3°…)
  const byIndex = [];
  for (const { items } of perDay) items.forEach((e, i) => {
    const x = toMin(e[from]); if (x == null) return;
    (byIndex[i] ||= []).push({ x, len: napLen(e) });
  });
  $('#week-typical').innerHTML = byIndex.length ? `<h3>Orario tipico</h3><ul class="typical">${byIndex.map((arr, i) => {
    const avgStart = arr.reduce((s, v) => s + v.x, 0) / arr.length;
    const lens = arr.map((v) => v.len).filter((v) => v != null);
    const avgLen = lens.length ? lens.reduce((s, v) => s + v, 0) / lens.length : null;
    const spread = Math.max(...arr.map((v) => v.x)) - Math.min(...arr.map((v) => v.x));
    return `<li><span class="nth">${i + 1}° pisolino</span>
      <span>verso le <b>${fmtClock(avgStart)}</b>${avgLen != null ? ` · dura ${fmtMin(avgLen)}` : ''}</span>
      <small>${arr.length} ${arr.length === 1 ? 'volta' : 'volte'}${arr.length > 1 ? ` · varia di ${fmtMin(spread)}` : ''}</small></li>`;
  }).join('')}</ul>` : '';
}

$('#week-prev').addEventListener('click', () => openWeek(addDays(state.week.start, -7)));
$('#week-next').addEventListener('click', () => openWeek(addDays(state.week.start, 7)));
$('#week-this').addEventListener('click', () => openWeek(mondayOf(isoDate(new Date()))));
$('#week-chart').addEventListener('click', (ev) => {
  const r = ev.target.closest('[data-day]');
  if (r) { state.date = r.dataset.day; showView('day'); }
});
document.querySelector('.tabbar').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-view]');
  if (!b) return;
  if (b.dataset.view === 'week') state.week.start = mondayOf(state.date);
  showView(b.dataset.view);
});

// ───────────────────────── Impostazioni ─────────────────────────
const sdlg = $('#settings-dialog');
$('#btn-settings').addEventListener('click', () => {
  $('#set-name').value = state.name;
  $('#mode-info').textContent = store?.shared
    ? `Agenda condivisa ✅${state.user?.email ? ' — sei collegato come ' + state.user.email : ''}. Tutto quello che scrivi lo vedono anche le altre persone.`
    : 'Modalità locale: i dati restano solo su questo dispositivo. Per condividerli con Alice segui il README.';
  $('#btn-logout').classList.toggle('hidden', !(store?.shared && state.user?.email));
  $('#btn-export').classList.toggle('hidden', store?.download && !store.canDownload);
  sdlg.showModal();
});
$('#settings-form').addEventListener('submit', () => {
  state.name = $('#set-name').value.trim();
  try { localStorage.setItem('ceci-name', state.name); } catch {}
});
$('#btn-logout').addEventListener('click', async () => { sdlg.close(); await store.signOut(); });
$('#btn-export').addEventListener('click', async () => {
  const data = await store.exportAll();
  const filename = `agenda-${BABY_NAME.toLowerCase()}-${isoDate(new Date())}.json`;
  if (store.download) { try { await store.download(filename, JSON.stringify(data, null, 2)); } catch {} return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
});

// riapre su "oggi" quando l'app torna in primo piano il giorno dopo
let lastToday = isoDate(new Date());
document.addEventListener('visibilitychange', () => {
  const t = isoDate(new Date());
  if (document.visibilityState === 'visible' && t !== lastToday) {
    if (state.date === lastToday && state.user && state.view === 'day') openDay(t);
    lastToday = t;
  }
});

setInterval(() => { if (state.user && document.visibilityState === 'visible' && !dlg.open) state.view === 'day' ? render() : renderWeek(); }, 60000);

start();
