// ─────────────────────────────────────────────────────────────
//  CONFIGURAZIONE DELL'AGENDA DI CECILIA
// ─────────────────────────────────────────────────────────────

export const BABY_NAME = 'Cecilia';

// 1) Per condividere i dati con Alice incolla qui la configurazione
//    del tuo progetto Firebase (vedi README.md, "Condivisione").
//    Finché resta `null` l'app funziona solo su questo dispositivo.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD8vfWP-s0PqVudiImcLpNEPenPlFkwBtQ",
  authDomain: "agenda-ceci.firebaseapp.com",
  projectId: "agenda-ceci",
  storageBucket: "agenda-ceci.firebasestorage.app",
  messagingSenderId: "741995113271",
  appId: "1:741995113271:web:a5d4191fcc7c3f606f08b2"
};
/* Esempio:
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "agenda-ceci.firebaseapp.com",
  projectId: "agenda-ceci",
  storageBucket: "agenda-ceci.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
*/

// 2) Le sezioni della pagina giornaliera.
//    type: 'tally'  → contatore a crocette ✕ (es. pipì)
//          'list'   → righe ripetibili (es. ogni pasto)
//          'choice' → una scelta tra opzioni
//          'text'   → testo libero
//    Tipi di campo: time, text, number, select
const minutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const duration = (a, b) => {
  const x = minutes(a), y = minutes(b);
  if (x == null || y == null) return 0;
  return y >= x ? y - x : y + 1440 - x;
};
const fmtDuration = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`);

export const SECTIONS = [
  {
    id: 'pipi',
    title: 'Pipì',
    icon: 'pipi',
    type: 'tally', // ogni tocco su "＋" aggiunge una ✕ (con l'ora)
    fields: [{ key: 'ora', label: 'Ora', type: 'time', now: true }],
    stat: (items) => ({ value: items.length, label: 'pipì' }),
  },
  {
    id: 'cacca',
    title: 'Cacca',
    icon: 'cacca',
    type: 'tally',
    fields: [{ key: 'ora', label: 'Ora', type: 'time', now: true }],
    stat: (items) => ({ value: items.length, label: 'cacca' }),
  },
  {
    id: 'pasti',
    title: 'Pasti',
    icon: 'pasti',
    type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'ml', label: 'Quantità (ml)', type: 'number', step: 10 },
    ],
    // previsione del prossimo pasto e del totale di fine giornata (js/predict.js)
    forecast: { time: 'ora', amount: 'ml' },
    total: (items) => `TOT: ${items.reduce((s, i) => s + (Number(i.ml) || 0), 0)} ml`,
    stat: (items) => ({
      value: items.reduce((s, i) => s + (Number(i.ml) || 0), 0), unit: 'ml',
      label: `${items.length} ${items.length === 1 ? 'pasto' : 'pasti'}`,
    }),
  },
  {
    id: 'pisolini',
    title: 'Pisolini',
    icon: 'pisolini',
    type: 'list',
    fields: [
      { key: 'inizio', label: 'Si è addormentata alle', type: 'time', now: true },
      { key: 'fine', label: 'Si è svegliata alle', type: 'time' },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'es. in carrozzina, in braccio…' },
    ],
    // pulsante rapido: "Si è addormentata ora" → poi "Si è svegliata ora"
    quick: { from: 'inizio', to: 'fine', startLabel: 'Si è addormentata ora', endLabel: 'Si è svegliata ora' },
    // linea del tempo della giornata (dalle 6 alle 22)
    timeline: { from: 'inizio', to: 'fine', start: 6, end: 22 },
    detail: (e) => (e.fine ? fmtDuration(duration(e.inizio, e.fine)) : 'sta dormendo…'),
    total: (items) => {
      const tot = items.reduce((s, i) => s + (i.fine ? duration(i.inizio, i.fine) : 0), 0);
      return `TOT: ${fmtDuration(tot)}`;
    },
    stat: (items) => ({
      value: fmtDuration(items.reduce((s, i) => s + (i.fine ? duration(i.inizio, i.fine) : 0), 0)),
      label: `${items.length} ${items.length === 1 ? 'pisolino' : 'pisolini'}`,
    }),
  },
  {
    id: 'note',
    title: 'Note',
    icon: 'note',
    type: 'text',
    placeholder: 'Cose da dire all\'altra, da ricordare, da comprare…',
  },
];

/* Altre sezioni pronte da aggiungere all'elenco sopra, se servono:

  { id: 'salute', title: 'Salute e medicine', icon: 'salute', type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'cosa', label: 'Cosa', type: 'text', placeholder: 'es. Tachipirina, febbre 37.8°' },
    ] },

  { id: 'umore', title: 'Umore', icon: 'umore', type: 'choice',
    options: ['😄 Felice', '🙂 Tranquilla', '😢 Nervosa', '🤒 Malaticcia'] },
*/
