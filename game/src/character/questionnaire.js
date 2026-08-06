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
export function scoreAnswers(data, answers) {
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

  return {
    skill_weights: Object.fromEntries(skillOrder.map((s) => [s, skillWeight.get(s)])),
    attribute_weights: Object.fromEntries(attrOrder.map((a) => [a, attrWeight.get(a)])),
    primary, secondary, favoured, neglected,
    matched_class: matchNamedClass(data, primary, secondary),
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
 * report which named classes are reachable. 4^10 = 1,048,576 per (race, upbringing) pair,
 * which is trivial, but the reachable SET is what matters, so we walk the product with an
 * incremental weight vector rather than materialising anything.
 */
export function reachableClasses(data, askedQuestions) {
  const skillOrder = skillIds(data);
  const idx = new Map(skillOrder.map((s, i) => [s, i]));
  const w = new Int32Array(skillOrder.length);
  const found = new Set();
  const qs = askedQuestions;
  const n = qs.length;

  const rec = (i) => {
    if (i === n) {
      const ranked = skillOrder.slice().sort((a, b) => (w[idx.get(b)] - w[idx.get(a)]) || (idx.get(a) - idx.get(b)));
      const m = matchNamedClass(data, ranked.slice(0, 3), ranked.slice(3, 5));
      if (m) found.add(m);
      return;
    }
    for (const ans of qs[i].answers) {
      for (const s of ans.weights) w[idx.get(s)]++;
      rec(i + 1);
      for (const s of ans.weights) w[idx.get(s)]--;
    }
  };
  rec(0);
  return [...found].sort();
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
