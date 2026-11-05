// Archivio dati: locale (solo questo dispositivo) oppure Firebase (condiviso).
// Forma di un giorno: { fields: {sezione: valore}, entries: [{id, section, ...}] }

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ───────────────────────── Locale ─────────────────────────
export function createLocalStore() {
  const KEY = 'ceci-agenda-v1';
  const subs = new Map(); // date -> Set(cb)
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { days: {} }; }
    catch { return { days: {} }; }
  };
  let data = load();
  const day = (d) => (data.days[d] ||= { fields: {}, entries: {} });
  const snapshot = (d) => {
    const x = data.days[d] || { fields: {}, entries: {} };
    return { fields: { ...x.fields }, entries: Object.entries(x.entries).map(([id, e]) => ({ id, ...e })) };
  };
  const emit = (d) => subs.get(d)?.forEach((cb) => cb(snapshot(d)));
  const save = (d) => { localStorage.setItem(KEY, JSON.stringify(data)); emit(d); };
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    data = load();
    subs.forEach((_, d) => emit(d));
  });

  return {
    shared: false,
    async init(onUser) { onUser({ email: null }); },
    async signIn() {},
    async signOut() {},
    subscribeDay(d, cb) {
      if (!subs.has(d)) subs.set(d, new Set());
      subs.get(d).add(cb);
      cb(snapshot(d));
      return () => subs.get(d).delete(cb);
    },
    async addEntry(d, entry, by) { day(d).entries[uid()] = { ...entry, by, createdAt: Date.now() }; save(d); },
    async updateEntry(d, id, entry, by) { Object.assign(day(d).entries[id], entry, { by }); save(d); },
    async deleteEntry(d, id) { delete day(d).entries[id]; save(d); },
    async setField(d, key, value) { day(d).fields[key] = value; save(d); },
    async exportAll() { return data; },
  };
}

// ───────────────────────── Firebase ─────────────────────────
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

export async function createFirebaseStore(config) {
  const { initializeApp } = await import(FB + 'firebase-app.js');
  const auth$ = await import(FB + 'firebase-auth.js');
  const fs = await import(FB + 'firebase-firestore.js');

  const app = initializeApp(config);
  const auth = auth$.getAuth(app);
  await auth$.setPersistence(auth, auth$.browserLocalPersistence);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }

  const dayDoc = (d) => fs.doc(db, 'days', d);
  const entriesCol = (d) => fs.collection(db, 'days', d, 'entries');

  return {
    shared: true,
    init(onUser) {
      auth$.onAuthStateChanged(auth, (u) => onUser(u ? { email: u.email } : null));
    },
    async signIn(email, password) {
      await auth$.signInWithEmailAndPassword(auth, email, password);
    },
    async resetPassword(email) {
      await auth$.sendPasswordResetEmail(auth, email);
    },
    async signOut() { await auth$.signOut(auth); },
    subscribeDay(d, cb, onError) {
      let fields = {}, entries = [];
      const push = () => cb({ fields, entries });
      const u1 = fs.onSnapshot(dayDoc(d), (s) => { fields = s.data()?.fields || {}; push(); }, onError);
      const u2 = fs.onSnapshot(entriesCol(d), (s) => {
        entries = s.docs.map((x) => ({ id: x.id, ...x.data() }));
        push();
      }, onError);
      return () => { u1(); u2(); };
    },
    async addEntry(d, entry, by) {
      await fs.setDoc(dayDoc(d), { updatedAt: fs.serverTimestamp() }, { merge: true });
      await fs.addDoc(entriesCol(d), { ...entry, by, createdAt: Date.now() });
    },
    async updateEntry(d, id, entry, by) {
      await fs.updateDoc(fs.doc(db, 'days', d, 'entries', id), { ...entry, by });
    },
    async deleteEntry(d, id) {
      await fs.deleteDoc(fs.doc(db, 'days', d, 'entries', id));
    },
    async setField(d, key, value) {
      await fs.setDoc(dayDoc(d), { fields: { [key]: value }, updatedAt: fs.serverTimestamp() }, { merge: true });
    },
    async exportAll() {
      const out = { days: {} };
      const days = await fs.getDocs(fs.collection(db, 'days'));
      for (const dd of days.docs) {
        const ents = await fs.getDocs(entriesCol(dd.id));
        out.days[dd.id] = {
          fields: dd.data().fields || {},
          entries: Object.fromEntries(ents.docs.map((e) => [e.id, e.data()])),
        };
      }
      return out;
    },
  };
}
