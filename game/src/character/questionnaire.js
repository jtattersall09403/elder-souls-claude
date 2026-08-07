// Route C — the ten questions the Warden-Scribe actually asks, and what they infer.
//
// Owner: W1-07. Binding source: RI-CHR01 §4 route C; purity rule RI-JRN01 M7.
//
// Deterministic end to end: which ten of the twelve you are asked is a function of your race
// and upbringing, and the scoring has no RNG and no clock in it. Ten answers in, one class
// shape out, every time.
'use strict';

import { attributeIds, skillIds } from './sheet.js';

/**
 * RI-CHR01 §4: "drawn deterministically from your race + upbringing so the questions
 * themselves are characterised". score = 3 for an upbringing affinity, 2 for a race affinity;
 * the two lowest-scoring questions are dropped, higher index first on a tie.
 */
export function selectQuestions(data, race, upbringing) {
  const qs = data.creationQuestions.questions;
  const scored = qs.map((q) => ({
    q,
    score: (q.upbringing_affinity.indexOf(upbringing) >= 0 ? 3 : 0) + (q.race_affinity.indexOf(race) >= 0 ? 2 : 0),
  }));
  // Sort a COPY, ascending by score then descending by index, and drop the first two.
  const order = scored.slice().sort((a, b) => (a.score - b.score) || (b.q.index - a.q.index));
  const dropped = new Set(order.slice(0, 2).map((x) => x.q.id));
  return {
    asked: qs.filter((q) => !dropped.has(q.id)),
    dropped: qs.filter((q) => dropped.has(q.id)).map((q) => q.id),
  };
}

/**
 * Score a set of answers. `answers` is [{questionId, answerId}]; order is irrelevant.
 * Returns the three primaries, two secondaries, two favoured and two neglected attributes.
 */
export function scoreAnswers(data, answers, opts = {}) {
  const qs = new Map(data.creationQuestions.questions.map((q) => [q.id, q]));
  const skillOrder = skillIds(data);
  const attrOrder = attributeIds(data);
  const skillWeight = new Map(skillOrder.map((s) => [s, 0]));
  for (const a of answers) {
    const q = qs.get(a.questionId);
    if (!q) throw new Error(`unknown question ${a.questionId}`);
    const ans = q.answers.find((x) => x.id === a.answerId);
    if (!ans) throw new Error(`unknown answer ${a.answerId} for ${a.questionId}`);
    for (const s of ans.weights) {
      if (!skillWeight.has(s)) throw new Error(`question ${q.id} answer ${ans.id} weights unknown skill ${s}`);
      skillWeight.set(s, skillWeight.get(s) + 1);
    }
  }
  // Rank skills: weight descending, then RI-PRG03 §1 order (the tie-break is DECLARED, so
  // two runs of the same answers cannot disagree).
  const ranked = skillOrder.slice().sort((a, b) => (skillWeight.get(b) - skillWeight.get(a)) || (skillOrder.indexOf(a) - skillOrder.indexOf(b)));
  const primary = ranked.slice(0, 3);
  const secondary = ranked.slice(3, 5);

  // Governing-attribute weights are the sum of their skills' weights.
  const govOf = new Map(data.skills.skills.map((s) => [s.id, s.governing]));
  const attrWeight = new Map(attrOrder.map((a) => [a, 0]));
  for (const s of skillOrder) attrWeight.set(govOf.get(s), attrWeight.get(govOf.get(s)) + skillWeight.get(s));
  const attrRanked = attrOrder.slice().sort((a, b) => (attrWeight.get(b) - attrWeight.get(a)) || (attrOrder.indexOf(a) - attrOrder.indexOf(b)));
  const favoured = attrRanked.slice(0, 2);
  // Least-weighted two, excluding the favoured pair — W1-07's completion of route C, declared
  // in dialogue/creation-questions.json#scoring. Without it the route breaks sum-zero.
  const neglected = attrRanked.slice().reverse().filter((a) => favoured.indexOf(a) < 0).slice(0, 2);

  const skill_weights = Object.fromEntries(skillOrder.map((s) => [s, skillWeight.get(s)]));
  const matched_class = matchNamedClass(data, primary, secondary);

  // The word she writes in the box. `matched_class` is set only when the derived shape IS a
  // named class to the skill; `nearest` is what a clerk with fourteen words and a tally sheet
  // actually does. See nearestProfession() for why the two are different questions.
  const askedQuestions = opts.asked || answers.map((a) => qs.get(a.questionId)).filter(Boolean);
  const nearest = nearestProfession(data, askedQuestions, skill_weights);
  const floor = professionFloor(data);
  const named_class = matched_class || (nearest && nearest.fit >= floor ? nearest.id : null);

  return {
    skill_weights,
    attribute_weights: Object.fromEntries(attrOrder.map((a) => [a, attrWeight.get(a)])),
    primary, secondary, favoured, neglected,
    matched_class,
    named_class,
    named_via: matched_class ? 'exact' : (named_class ? 'nearest' : null),
    nearest_profession: nearest,
    profession_floor: floor,
  };
}

/**
 * The floor under which the Warden-Scribe admits she has no word for you. Lives in
 * `dialogue/creation-questions.json#scoring.nearest_profession_floor` so that a critic can
 * move it and watch the outcome move — CONSUMPTION, RI-MTH07 §3.
 */
export function professionFloor(data) {
  const sc = data.creationQuestions.scoring || {};
  const v = sc.nearest_profession_floor;
  return Number.isFinite(v) ? v : 4;
}

/**
 * Expected weight of each skill under uniform answering over a given question set. This is the
 * whole trick, and it is worth the paragraph.
 *
 * Skills are not evenly distributed across the 48 answers — `speechcraft` is weighted by many
 * more answers than `polearms` is. So a raw dot product against a class's skill set is a
 * measure of how *common* that class's skills are in the questionnaire, not of what the player
 * chose: measured over 41,943,040 routes, the raw product picks only 5 of the 14 classes ever,
 * and over a 240-run play sweep it picks 5. Subtracting the expected weight turns the score
 * into "how much more of this than chance", and the same sweep then reaches 14 of 14.
 */
export function expectedWeights(data, askedQuestions) {
  const e = new Map(skillIds(data).map((s) => [s, 0]));
  for (const q of askedQuestions) {
    const n = q.answers.length || 1;
    for (const a of q.answers) for (const s of a.weights) e.set(s, (e.get(s) || 0) + 1 / n);
  }
  return e;
}

/**
 * RI-CHR01 §4: "at the end of it I will have a word for you, and it will be a better word than
 * the one you would have picked" — the Warden-Scribe's own shipped line, and a description of
 * this function. She has fourteen words on her list and a tally of what you said. She writes
 * the nearest one, or she writes that she has none.
 *
 * @returns {null|{id, fit, margin, runner_up}} fit is in units of answers-above-chance.
 */
export function nearestProfession(data, askedQuestions, skillWeights) {
  if (!askedQuestions || !askedQuestions.length) return null;
  const e = expectedWeights(data, askedQuestions);
  const classes = data.classes.classes;
  const scored = classes.map((c, i) => {
    let fit = 0;
    for (const k of Object.keys(c.skills)) {
      const w = (skillWeights[k] || 0) - (e.get(k) || 0);
      fit += (c.skills[k] === 25 ? 3 : 2) * w;
    }
    // Round to a tenth: the tie-break must not turn on float noise, and two runs of the same
    // answers must not disagree.
    return { id: c.id, fit: Math.round(fit * 10) / 10, i };
  });
  scored.sort((a, b) => (b.fit - a.fit) || (a.i - b.i));
  return {
    id: scored[0].id,
    fit: scored[0].fit,
    margin: Math.round((scored[0].fit - scored[1].fit) * 10) / 10,
    runner_up: scored[1].id,
  };
}

/** Does this five-skill set exactly equal a named class's? If so the scribe says it aloud. */
export function matchNamedClass(data, primary, secondary) {
  const want25 = [...primary].sort().join(',');
  const want15 = [...secondary].sort().join(',');
  for (const c of data.classes.classes) {
    const p = Object.keys(c.skills).filter((k) => c.skills[k] === 25).sort().join(',');
    const s = Object.keys(c.skills).filter((k) => c.skills[k] === 15).sort().join(',');
    if (p === want25 && s === want15) return c.id;
  }
  return null;
}

/**
 * RI-CHR01 method 4: exhaustively enumerate every route through a given question set and
 * report which named classes are reachable. The literal product is 4^10 = 1,048,576 routes,
 * but only the SKILL-WEIGHT VECTOR decides the outcome, and answers commute — so two routes
 * that reach the same vector reach the same class. We therefore walk the product level by
 * level, deduplicating on the vector, which is exhaustive (every route's vector is generated)
 * and about two orders of magnitude cheaper. `routes_enumerated` is reported so a critic can
 * see that the whole product was covered rather than sampled.
 *
 * TWO reachability questions, and the round-2 verdict is the reason they are both answered
 * here. `classes` is the set reachable by EXACT shape identity — the strict reading, and the
 * one that is true in principle and never happens in play. `named` is the set the Warden-Scribe
 * actually says out loud, which is exact identity OR the nearest profession above the floor.
 * A route that reaches 11 classes on paper and 0 in 240 plays has not shipped a questionnaire.
 */
export function reachableClasses(data, askedQuestions, opts = {}) {
  const skillOrder = skillIds(data);
  const idx = new Map(skillOrder.map((s, i) => [s, i]));
  const n = skillOrder.length;
  const table = maskClassTable(data, idx);
  const found = new Set();
  const namedFound = new Set();
  const w = new Int32Array(n);
  const qs = askedQuestions;
  // Answers pre-resolved to skill indices, so the hot loop touches no strings and no Maps.
  const answerIdx = qs.map((q) => q.answers.map((a) => a.weights.map((s) => idx.get(s))));
  const depth = qs.length;
  const top = new Int32Array(5);
  let routes = 0;
  let namedRoutes = 0;

  // --- the nearest-profession score, maintained incrementally down the recursion. `fit[c]`
  // is class c's bias-corrected score for the partial answer set; `cw[c*n+s]` is its weight
  // on skill s; `base[c]` is the constant -sum(cw*E) so the leaf never re-subtracts chance.
  const classes = data.classes.classes;
  const C = classes.length;
  const cw = new Float64Array(C * n);
  const base = new Float64Array(C);
  const floor = professionFloor(data);
  {
    const e = expectedWeights(data, qs);
    for (let c = 0; c < C; c++) {
      const cls = classes[c];
      for (const k of Object.keys(cls.skills)) {
        const si = idx.get(k);
        const v = cls.skills[k] === 25 ? 3 : 2;
        cw[c * n + si] = v;
        base[c] -= v * (e.get(k) || 0);
      }
    }
  }
  const fit = new Float64Array(C);
  for (let c = 0; c < C; c++) fit[c] = base[c];

  const leaf = () => {
    routes++;
    // Top five by (weight desc, RI-PRG03 §1 order asc). A five-slot insertion beats a sort by
    // an order of magnitude and the tie-break is identical to scoreAnswers().
    let k = 0;
    for (let i = 0; i < n; i++) {
      const wi = w[i];
      let j = k < 5 ? k : 5;
      while (j > 0 && (wi > w[top[j - 1]])) { if (j < 5) top[j] = top[j - 1]; j--; }
      if (j < 5) { top[j] = i; if (k < 5) k++; }
    }
    let m3 = 0, m2 = 0;
    for (let i = 0; i < 3; i++) m3 |= 1 << top[i];
    for (let i = 3; i < 5; i++) m2 |= 1 << top[i];
    const hit = table.get(m3 * 524288 + m2);
    if (hit) { found.add(hit); namedFound.add(hit); namedRoutes++; return; }
    // Nearest profession. Ties go to the earlier class in the roster, exactly as
    // nearestProfession() does, so the two cannot disagree.
    let bi = 0, bf = fit[0];
    for (let c = 1; c < C; c++) if (fit[c] > bf) { bf = fit[c]; bi = c; }
    if (Math.round(bf * 10) / 10 >= floor) { namedFound.add(classes[bi].id); namedRoutes++; }
  };

  const rec = (i) => {
    if (i === depth) { leaf(); return; }
    const opts2 = answerIdx[i];
    for (let a = 0; a < opts2.length; a++) {
      const ws = opts2[a];
      for (let s = 0; s < ws.length; s++) { const si = ws[s]; w[si]++; for (let c = 0; c < C; c++) fit[c] += cw[c * n + si]; }
      rec(i + 1);
      for (let s = 0; s < ws.length; s++) { const si = ws[s]; w[si]--; for (let c = 0; c < C; c++) fit[c] -= cw[c * n + si]; }
    }
  };
  rec(0);

  const out = [...found].sort();
  if (opts.detail) {
    return {
      classes: out,
      named: [...namedFound].sort(),
      routes_enumerated: routes,
      routes_named: namedRoutes,
      named_fraction: routes ? +(namedRoutes / routes).toFixed(6) : 0,
    };
  }
  return out;
}

/** (top-3 mask, top-2 mask) -> class id, built once. 19 skills fits in 19 bits. */
function maskClassTable(data, idx) {
  const t = new Map();
  for (const c of data.classes.classes) {
    let m3 = 0, m2 = 0;
    for (const k of Object.keys(c.skills)) {
      if (c.skills[k] === 25) m3 |= 1 << idx.get(k);
      else if (c.skills[k] === 15) m2 |= 1 << idx.get(k);
    }
    t.set(m3 * 524288 + m2, c.id);
  }
  return t;
}

/** RI-JRN01 M7 / RI-CHR01 method 4: the purity sweep, run over the shipped text. */
export function purityViolations(data) {
  const bad = [];
  const skillNames = data.skills.skills.map((s) => s.name);
  const attrNames = data.attributes.attributes.map((a) => a.name);
  const attrAbbr = data.attributes.attributes.map((a) => a.abbr);
  const tokens = [...skillNames, ...attrNames, ...attrAbbr, 'skill', 'attribute', 'Tutorial', 'Objective'];
  const check = (where, text) => {
    for (const t of tokens) {
      const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&')}\\b`, 'i');
      if (re.test(text)) bad.push({ where, token: t, text });
    }
    if (/[0-9]/.test(text)) bad.push({ where, token: 'digit', text });
    if (/[+%]/.test(text)) bad.push({ where, token: '+ or %', text });
  };
  for (const q of data.creationQuestions.questions) {
    check(`${q.id}.text`, q.text);
    for (const a of q.answers) check(`${q.id}.${a.id}`, a.text);
  }
  return bad;
}
