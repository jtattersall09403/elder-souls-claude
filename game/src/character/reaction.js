// Race and standing: the 12x10 reaction matrix and everything downstream of it.
//
// Owner: W1-07. Binding source: RI-CHR02 §3 (the matrix), §4a (disposition), §4b (prices),
// §4e (the AR-3 encounter lever), §5 (guards).
//
// Pure and total, like sheet.js, and for the same reason: the audit tool imports this module
// rather than reimplementing the arithmetic.
'use strict';

/** RI-CHR02 §3: the race term plus the upbringing term, applied BEFORE every other term. */
export function raceTerm(data, group, race, upbringing) {
  const row = data.reactions.matrix[group];
  if (!row) throw new Error(`unknown reaction group: ${JSON.stringify(group)}`);
  if (!(race in row)) throw new Error(`unknown race in matrix: ${JSON.stringify(race)}`);
  const up = data.reactions.upbringings.find((u) => u.id === upbringing);
  if (!up) throw new Error(`unknown upbringing: ${JSON.stringify(upbringing)}`);
  const raceR = row[race];
  const upR = up.mods[group] || 0;
  return { race: raceR, upbringing: upR, total: raceR + upR };
}

/**
 * RI-DLG04 §B's derivedDisposition with the race term in front of it. The other terms
 * (Personality, faction rank, crime, weapon-drawn, Reputation) are RI-DLG04's and belong to
 * W1-11; they enter here as an opaque `otherTerms` number so this function is honest about
 * what it does and does not own.
 */
export function derivedDisposition(data, { group, race, upbringing, baseDisposition = 50, otherTerms = 0, birthsign = null }) {
  const t = raceTerm(data, group, race, upbringing);
  let signTerm = 0;
  if (birthsign === 'shuja-vei' && (group === 'RG-ROOT')) signTerm = -25; // RI-CHR03 §3 The Grey Sap
  const raw = baseDisposition + t.total + otherTerms + signTerm;
  const value = Math.max(0, Math.min(100, raw));
  return { value, clamped: raw !== value, base: baseDisposition, race_term: t.race, upbringing_term: t.upbringing, birthsign_term: signTerm, other_terms: otherTerms, band: band(value) };
}

/** RI-DLG04 §E bands, as consumed by this item's §4a table. */
export function band(v) {
  if (v <= 10) return 'hostile';
  if (v < 30) return 'cold';
  if (v < 60) return 'neutral';
  if (v < 80) return 'friendly';
  return 'devoted';
}

/** RI-CHR02 §4b. Returns the standing surcharge only; RI-PRG05's terms multiply on top. */
export function raceSurcharge(data, { group, race, upbringing }) {
  const t = raceTerm(data, group, race, upbringing);
  const c = data.reactions.price_surcharge;
  const buy = clamp(1.00 + c.buy_coeff * t.total, c.buy_clamp[0], c.buy_clamp[1]);
  const sell = clamp(1.00 + c.sell_coeff * t.total, c.sell_clamp[0], c.sell_clamp[1]);
  return { r: t.total, buyMult: buy, sellMult: sell };
}

/**
 * A quoted price, with RI-PRG05's disposition/Mercantile term supplied by the caller as
 * `skillMult` so this module never invents a number it does not own.
 */
export function priceQuote(data, { group, race, upbringing, basePrice, skillBuyMult = 1.0, skillSellMult = 1.0 }) {
  const s = raceSurcharge(data, { group, race, upbringing });
  return {
    ...s,
    buy: Math.round(basePrice * s.buyMult * skillBuyMult),
    sell: Math.round(basePrice * s.sellMult * skillSellMult),
  };
}

/** RI-CHR02 §5. The interior does not arrest; only RG-EMPIRE does. */
export function guardTerms(data, race) {
  const t = data.reactions.guards.law_factor[race];
  if (!t) throw new Error(`no lawFactor row for race ${JSON.stringify(race)}`);
  return { ...t };
}

/** Mean of (raceA - raceB) over all twelve groups. RI-CHR02 method 3. */
export function meanRaceGap(data, raceA, raceB) {
  const groups = Object.keys(data.reactions.matrix);
  let t = 0;
  for (const g of groups) t += data.reactions.matrix[g][raceA] - data.reactions.matrix[g][raceB];
  return t / groups.length;
}

/** Population-standard deviation over all 120 cells. RI-CHR02 method 2. */
export function matrixSigma(data) {
  const cells = [];
  for (const g of Object.keys(data.reactions.matrix)) {
    for (const r of data.reactions.races) cells.push(data.reactions.matrix[g][r]);
  }
  const mean = cells.reduce((a, b) => a + b, 0) / cells.length;
  const varr = cells.reduce((a, b) => a + (b - mean) * (b - mean), 0) / cells.length;
  return { n: cells.length, mean, sigma: Math.sqrt(varr) };
}

/**
 * The player-race class used to key greeting pools. RI-CHR02 §4c: five classes, not ten,
 * because the coast does not distinguish a Nord from a Bosmer and the interior barely does.
 */
export function playerRaceClass(race) {
  if (race === 'saxhleel' || race === 'naga' || race === 'dunmer' || race === 'imperial') return race;
  return 'other-foreign';
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
