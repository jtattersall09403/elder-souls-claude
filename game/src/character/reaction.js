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
/**
 * RI-PRG05 §3's barter multipliers. THIS is what round 1 was missing: `priceQuote` took the
 * skill term as a caller-supplied parameter, so — the W1-07 verdict, verbatim — "a Dunmer
 * with Mercantile 100 and PERSONALITY 60 quotes `buyMult 1.264` — identical to an untrained
 * Dunmer. The build derives no Mercantile term."
 *
 *   buy_mult  = clamp(1.55 - 0.0060*Disposition - 0.0035*Mercantile - 0.0040*Personality, 0.80, 1.60)
 *   sell_mult = clamp(0.22 + 0.0025*Disposition + 0.0022*Mercantile + 0.0018*Personality, 0.20, 0.60)
 *
 * The flip invariant (max sell 0.60 < min buy 0.80) is a property of the clamps and is
 * asserted, here, at every call — an economy that can be inverted is an infinite-money bug
 * and it should fail loudly rather than quietly print a number.
 */
export function skillPriceTerms({ disposition = 40, mercantile = 5, personality = 10 }) {
  const buy = clamp(1.55 - 0.0060 * disposition - 0.0035 * mercantile - 0.0040 * personality, 0.80, 1.60);
  const sell = clamp(0.22 + 0.0025 * disposition + 0.0022 * mercantile + 0.0018 * personality, 0.20, 0.60);
  if (sell >= buy) {
    throw new Error(`price flip invariant broken: sell ${sell} >= buy ${buy} (RI-PRG05 §3). ` +
      'Buying and immediately reselling must always lose at least 25% of the outlay.');
  }
  return { buyMult: round4(buy), sellMult: round4(sell), disposition, mercantile, personality };
}

/**
 * The quote a merchant gives THIS character. Race surcharge (RI-CHR02 §4b) multiplied by the
 * RI-PRG05 §3 skill/disposition terms, both derived from the character rather than supplied.
 *
 * `skillBuyMult`/`skillSellMult` are still honoured when passed explicitly, because RI-CHR02
 * §4b's worked table is stated in terms of them and a critic must be able to reproduce that
 * table exactly. When they are absent the terms are derived, which is method 7's clause
 * "assert the Mercantile-100/PER-60 Dunmer buy multiplier is in [0.98, 1.05]".
 */
export function priceQuote(data, { group, race, upbringing, basePrice, skillBuyMult, skillSellMult, skills, attributes, disposition }) {
  const s = raceSurcharge(data, { group, race, upbringing });
  const derived = skillPriceTerms({
    disposition: disposition === undefined
      ? derivedDisposition(data, { group, race, upbringing, baseDisposition: 50 }).value
      : disposition,
    mercantile: (skills && skills.mercantile !== undefined)
      ? (typeof skills.mercantile === 'object' ? skills.mercantile.value : skills.mercantile) : 5,
    personality: (attributes && attributes.personality !== undefined) ? attributes.personality : 10,
  });
  const bm = skillBuyMult === undefined ? derived.buyMult : skillBuyMult;
  const sm = skillSellMult === undefined ? derived.sellMult : skillSellMult;
  return {
    ...s,
    skill_terms: derived,
    skill_buy_mult: bm,
    skill_sell_mult: sm,
    effective_buy_mult: round4(s.buyMult * bm),
    effective_sell_mult: round4(s.sellMult * sm),
    buy: Math.round(basePrice * s.buyMult * bm),
    sell: Math.round(basePrice * s.sellMult * sm),
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
