// ─────────────────────────────────────────────────────────────
//  CONFIGURAZIONE DELL'AGENDA DI CECILIA
// ─────────────────────────────────────────────────────────────

export const BABY_NAME = 'Cecilia';

// 1) Per condividere i dati con Alice incolla qui la configurazione
//    del tuo progetto Firebase (vedi README.md, "Condivisione").
//    Finché resta `null` l'app funziona solo su questo dispositivo.
export const FIREBASE_CONFIG = null;
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
//    type: 'list'   → righe ripetibili (es. ogni poppata)
//          'choice' → una scelta tra opzioni
//          'text'   → testo libero
//    Tipi di campo: time, text, number, select
const minutes = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const SECTIONS = [
  {
    id: 'pappa',
    title: 'Pappa',
    icon: '🍼',
    type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'tipo', label: 'Cosa', type: 'select',
        options: ['Latte materno', 'Latte artificiale', 'Pappa', 'Frutta', 'Merenda', 'Acqua'] },
      { key: 'quantita', label: 'Quantità (ml / g)', type: 'number' },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'es. ha mangiato tutto' },
    ],
    summary: (items) => {
      const tot = items.reduce((s, i) => s + (Number(i.quantita) || 0), 0);
      return `${items.length} ${items.length === 1 ? 'pasto' : 'pasti'}` + (tot ? ` · ${tot} ml/g` : '');
    },
  },
  {
    id: 'nanna',
    title: 'Nanna',
    icon: '😴',
    type: 'list',
    fields: [
      { key: 'inizio', label: 'Dalle', type: 'time', now: true },
      { key: 'fine', label: 'Alle', type: 'time' },
      { key: 'note', label: 'Note', type: 'text', placeholder: 'es. nel lettino, risvegli…' },
    ],
    summary: (items) => {
      let tot = 0;
      for (const i of items) {
        const a = minutes(i.inizio), b = minutes(i.fine);
        if (a != null && b != null) tot += b >= a ? b - a : b + 1440 - a;
      }
      const h = Math.floor(tot / 60), m = tot % 60;
      return tot ? `${h}h ${String(m).padStart(2, '0')}m` : `${items.length} ${items.length === 1 ? 'nanna' : 'nanne'}`;
    },
  },
  {
    id: 'pannolino',
    title: 'Pannolino',
    icon: '🧷',
    type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Pipì', 'Cacca', 'Pipì + cacca'] },
      { key: 'note', label: 'Note', type: 'text' },
    ],
    summary: (items) => `${items.length} ${items.length === 1 ? 'cambio' : 'cambi'}`,
  },
  {
    id: 'attivita',
    title: 'Cosa ha fatto',
    icon: '🎈',
    type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'cosa', label: 'Attività', type: 'text', placeholder: 'es. parco, bagnetto, nonni…' },
    ],
  },
  {
    id: 'salute',
    title: 'Salute e medicine',
    icon: '💊',
    type: 'list',
    fields: [
      { key: 'ora', label: 'Ora', type: 'time', now: true },
      { key: 'cosa', label: 'Cosa', type: 'text', placeholder: 'es. Tachipirina, febbre 37.8°' },
      { key: 'dose', label: 'Dose', type: 'text' },
    ],
  },
  {
    id: 'umore',
    title: 'Umore',
    icon: '🌈',
    type: 'choice',
    options: ['😄 Felice', '🙂 Tranquilla', '😐 Così così', '😢 Nervosa', '🤒 Malaticcia'],
  },
  {
    id: 'note',
    title: 'Note',
    icon: '📝',
    type: 'text',
    placeholder: 'Comunicazioni, cose da ricordare, da comprare…',
  },
];
