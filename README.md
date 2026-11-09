# 📒 Agenda di Ceci

Un'agenda digitale per segnare ogni giorno cosa fa Cecilia — pipì, cacca,
pasti con il totale dei ml, pisolini con orari e note — **condivisa in tempo reale tra
Andrea e Alice**. È una web‑app che si installa sul telefono come un'app vera
(icona nella schermata Home) e funziona anche senza connessione.

## Cosa si può fare

- Una pagina per ogni giorno, con frecce ‹ › e calendario per spostarsi.
- **Pipì / Cacca**: ogni tocco su ＋ aggiunge una ✕ (con l'ora salvata).
  Tocca una ✕ per vedere l'ora, correggerla o eliminarla.
- **Pasti**: ＋ Aggiungi → ora (già compilata) e ml. In fondo il **TOT** dei ml.
- **Pisolini**: "Si è addormentata ora" e poi "Si è svegliata ora" (oppure a mano).
  Una linea del tempo dalle 6 alle 22 mostra quando ha dormito, con il totale.
- **Previsione pasti**: in cima ai Pasti di oggi, quando mangerà probabilmente e quanto,
  e il totale previsto a fine giornata (dopo almeno 3 giorni di pasti segnati; vedi `js/predict.js`).
- **Settimana** (barra in basso): i pisolini dei 7 giorni uno sotto l'altro per
  confrontare gli orari, con medie della settimana e orario tipico di ogni pisolino;
  sotto, il grafico dei ml di latte di ogni giorno con la media e la proiezione di oggi,
  e la sezione **Peso**: si inserisce una volta a settimana (in kg o in grammi) e mostra
  aumento, grammi al giorno e grafico dell'andamento.
- Tocca una riga per modificarla o eliminarla.
- Ogni voce mostra chi l'ha inserita (il nome si imposta da ⚙️).
- ⚙️ → *Scarica backup* per salvare tutti i dati in un file.

## Modificare le sezioni

Tutta la struttura della pagina è in [`js/config.js`](js/config.js): si possono
aggiungere, togliere o rinominare sezioni e campi senza toccare il resto del
codice. In fondo al file ci sono già pronte Salute e Umore da attivare.

## 0. Il modo più rapido: dentro Claude

L'app è pubblicata anche come Artifact su claude.ai e si apre direttamente
dall'app Claude (anche da telefono). I dati sono condivisi tra chi ha accesso
al link: per Alice basta condividerla dal menu **Condividi** dell'artifact.
Il file si rigenera con `python3 tools/build-artifact.py` → `dist/agenda-ceci.html`.

## 1. Pubblicare l'app (GitHub Pages, gratis)

1. Unisci questo branch in `main`.
2. Su GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Al primo push su `main` l'app sarà online su
   `https://<tuo-utente>.github.io/App-Ceci/`.

Finché non configuri Firebase (punto 2) l'app funziona già, ma i dati restano
solo sul dispositivo su cui li inserisci.

## 2. Condivisione con Alice (Firebase, gratis)

1. Vai su <https://console.firebase.google.com> → **Aggiungi progetto**
   (es. `agenda-ceci`; Google Analytics non serve).
2. **Build → Authentication → Inizia → Email/Password → Attiva**.
   Poi nella scheda **Users → Add user** crea due account: il tuo e quello di Alice.
3. **Build → Firestore Database → Crea database** (modalità produzione,
   regione `europe-west`).
   Nella scheda **Regole** incolla il contenuto di [`firestore.rules`](firestore.rules)
   sostituendo le due email con quelle appena create → **Pubblica**.
4. **Impostazioni progetto (⚙️) → Le tue app → icona Web `</>`** → registra
   l'app e copia l'oggetto `firebaseConfig`.
5. Incollalo in [`js/config.js`](js/config.js) al posto di `null`:
   ```js
   export const FIREBASE_CONFIG = { apiKey: "…", authDomain: "…", projectId: "…", … };
   ```
   (Questi valori non sono segreti: la protezione la fanno le regole del punto 3.)
6. **Authentication → Settings → Domini autorizzati**: aggiungi
   `<tuo-utente>.github.io`.

Fatto: ora l'app chiede email e password, e ciò che scrive uno compare subito
sul telefono dell'altra.

## 3. Installarla sul telefono (tu e Alice)

Apri il link dell'app e:

- **iPhone (Safari)**: tasto Condividi → *Aggiungi alla schermata Home*.
- **Android (Chrome)**: menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.

## Provarla sul computer

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```
