// Previsioni sui pasti, a partire dalle abitudini degli ultimi giorni.
// Funzioni pure: nessun accesso a pagina o archivio, così si possono provare da sole.
//
// days:  [{ date: 'YYYY-MM-DD', feeds: [{ min, ml }] }]  giorni passati, dal più vecchio
// today: [{ min, ml }]  pasti di oggi segnati finora
// nowMin: minuti dalla mezzanotte adesso

const DAY = 1440;
const DECAY = 0.85; // ogni giorno più vecchio pesa il 15% in meno
export const MIN_DAYS = 3;

// quantile pesato: q tra 0 e 1
export function wq(values, q) {
  const v = values.filter((x) => x.w > 0).sort((a, b) => a.x - b.x);
  if (!v.length) return null;
  const tot = v.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  for (const x of v) { acc += x.w; if (acc >= q * tot - 1e-9) return x.x; }
  return v[v.length - 1].x;
}
const stats = (vals) => ({ mid: wq(vals, 0.5), lo: wq(vals, 0.25), hi: wq(vals, 0.75), n: vals.length });
const round5 = (x) => Math.round(x / 5) * 5;
const round10 = (x) => Math.round(x / 10) * 10;

// giorni utili: con pasti, senza giorni chiaramente incompleti, con un peso per l'età
export function usableDays(days, todayIso) {
  const withFeeds = days.filter((d) => d.date < todayIso && d.feeds.length)
    .map((d) => ({ ...d, feeds: d.feeds.slice().sort((a, b) => a.min - b.min), total: d.feeds.reduce((s, f) => s + (f.ml || 0), 0) }));
  if (!withFeeds.length) return [];
  const totals = withFeeds.map((d) => d.total).sort((a, b) => a - b);
  const median = totals[Math.floor(totals.length / 2)];
  const kept = withFeeds.filter((d) => d.total >= median * 0.6); // un giorno con pasti non segnati falserebbe le medie
  const t = Date.parse(todayIso);
  return kept.map((d) => ({ ...d, w: DECAY ** (Math.round((t - Date.parse(d.date)) / 864e5) - 1) }));
}

// intervalli tra un pasto e il successivo, compresi quelli notturni tra giorni consecutivi
function intervals(days) {
  const out = [];
  days.forEach((d, i) => {
    d.feeds.forEach((f, j) => {
      const next = d.feeds[j + 1];
      if (next) out.push({ start: f.min, gap: next.min - f.min, w: d.w });
    });
    const nd = days[i + 1];
    if (nd && Date.parse(nd.date) - Date.parse(d.date) === 864e5 && d.feeds.length && nd.feeds.length) {
      const last = d.feeds[d.feeds.length - 1];
      out.push({ start: last.min, gap: DAY - last.min + nd.feeds[0].min, w: d.w });
    }
  });
  return out.filter((x) => x.gap > 0);
}

// prende i valori vicini a un orario, allargando la finestra se sono pochi
function near(items, key, min, get) {
  for (const win of [90, 150, 240, DAY]) {
    const sel = items.filter((x) => Math.abs(x[key] - min) <= win);
    if (sel.length >= 4 || win === DAY) return sel.map((x) => ({ x: get(x), w: x.w }));
  }
  return [];
}

export function typicalGap(gaps, at) { return stats(near(gaps, 'start', at, (x) => x.gap)); }
export function typicalMl(feeds, at) { return stats(near(feeds, 'min', at, (x) => x.ml)); }

export function predict(days, today, nowMin, todayIso) {
  const ok = usableDays(days, todayIso);
  if (ok.length < MIN_DAYS) return { needDays: MIN_DAYS - ok.length };

  const gaps = intervals(ok);
  const feeds = ok.flatMap((d) => d.feeds.filter((f) => f.ml > 0).map((f) => ({ ...f, w: d.w })));
  const todaySorted = today.slice().sort((a, b) => a.min - b.min);
  const soFar = todaySorted.reduce((s, f) => s + (f.ml || 0), 0);
  const last = todaySorted[todaySorted.length - 1];

  // 1) prossimo pasto
  let next;
  if (last) {
    const g = typicalGap(gaps, last.min);
    next = { at: last.min + g.mid, from: last.min + g.lo, to: last.min + g.hi };
  } else {
    const first = stats(ok.map((d) => ({ x: d.feeds[0].min, w: d.w })));
    next = { at: first.mid, from: first.lo, to: first.hi };
  }
  const ml = typicalMl(feeds, next.at % DAY);
  next.ml = round5(ml.mid); next.mlFrom = round5(ml.lo); next.mlTo = round5(ml.hi);
  next.overdue = next.at < nowMin;
  next.stale = nowMin - next.at > 120; // in ritardo di oltre 2 ore: forse un pasto non è stato segnato
  next.tomorrow = next.at >= DAY;

  // 2) totale a fine giornata
  const dayTotals = ok.map((d) => ({ x: d.total, w: d.w }));
  const usual = stats(dayTotals);
  let total;
  if (!last) {
    total = { mid: usual.mid, lo: usual.lo, hi: usual.hi };
  } else {
    // a) simulo i pasti che mancano fino a mezzanotte
    // un pasto "saltato" nel passato non si recupera: il prossimo arriva al più presto adesso
    let t = last.min, sim = soFar;
    for (let i = 0; i < 24; i++) {
      t += typicalGap(gaps, t).mid;
      if (i === 0) t = Math.max(t, nowMin);
      if (t >= DAY) break;
      sim += typicalMl(feeds, t).mid;
    }
    // b) quanta parte del totale aveva di solito già preso a quest'ora
    const at = Math.max(nowMin, last.min);
    const perDay = ok.map((d) => {
      const done = d.feeds.filter((f) => f.min <= at).reduce((s, f) => s + (f.ml || 0), 0);
      return { x: d.total ? done / d.total : 0, w: d.w };
    }).filter((f) => f.x >= 0.15);
    let mid = sim, lo = sim, hi = sim;
    if (perDay.length >= 2) {
      const proj = perDay.map((f) => ({ x: soFar / f.x, w: f.w }));
      const p = stats(proj);
      mid = (sim + p.mid) / 2;
      lo = Math.min(sim, p.lo); hi = Math.max(sim, p.hi);
    }
    total = { mid: Math.max(mid, soFar), lo: Math.max(lo, soFar), hi: Math.max(hi, soFar) };
  }
  for (const k of ['mid', 'lo', 'hi']) total[k] = round10(total[k]);

  const recent = ok.slice(-7);
  const avg7 = round10(recent.reduce((s, d) => s + d.total, 0) / recent.length);
  return { next, total, soFar, avg7, days: ok.length };
}
