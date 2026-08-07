#!/usr/bin/env node
// critic-w1-07-r3c.mjs — CRITIC's own RI-JRN09 M3 (ES-NAMED) sweep.
//
// Independent of tools/harness/jrn09-exchange.mjs (the builder's). It calls the SHIPPED
// selectQuestions()/scoreAnswers() out of game/src/character/questionnaire.js in bare Node, so
// it exercises the same matcher the engine does with none of the builder's framing, and it asks
// three questions the builder's sweep does not:
//
//   A. the histogram, computed by ME, over a sweep shape I chose (all 40 race x upbringing
//      pairs x N answer patterns, each answer index drawn from an independent LCG rather than
//      from a fixed rotation — a fixed a/b/c/d rotation can be even and still be biased,
//      because question k always gets answer (k mod 4));
//   B. NAMED_distinct and NAMED_rate;
//   C. **the How-we-lose check the item names and the builder did not run**: sweep the floor
//      `nearest_profession_floor` and show what the unnamed band is made of. The item warns
//      "NAMED is met by widening the matcher until everything is named"; a floor chosen from
//      a percentile table to leave ~4% unnamed is a calibrated cosmetic unless the unnamed
//      runs are a real class of answers.
import fs from 'node:fs';
import path from 'node:path';
import { selectQuestions, scoreAnswers, professionFloor, nearestProfession, expectedWeights } from '../../game/src/character/questionnaire.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const D = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', p), 'utf8'));
const say = (s) => process.stdout.write(s + '\n');

const data = {
  creationQuestions: D('dialogue/creation-questions.json'),
  classes: D('progression/classes.json'),
  skills: D('progression/skills.json'),
  attributes: D('progression/attributes.json'),
};
const races = D('progression/races.json').races.map((r) => r.id);
const upbringings = ((D('dialogue/topics/writ-house.json').nodes || [])
  .find((n) => n.id === 'writ.upbringing').input.options).map((o) => o.id);

say(`races ${races.length}  upbringings ${upbringings.length}  classes ${data.classes.classes.length}  floor ${professionFloor(data)}`);

// An independent LCG, so answer choice is not a function of question index.
let seed = 0x2f6e2b1;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };

function sweep(patterns, floorOverride) {
  const hist = { a: 0, b: 0, c: 0, d: 0 };
  const byClass = {}; let named = 0, total = 0, exact = 0;
  const fits = [];
  const unnamedFits = [];
  for (const r of races) for (const u of upbringings) for (let p = 0; p < patterns; p++) {
    const { asked } = selectQuestions(data, r, u);
    const answers = asked.map((q) => {
      const i = Math.floor(rnd() * q.answers.length);
      hist[['a', 'b', 'c', 'd'][i] || 'd']++;
      return { questionId: q.id, answerId: q.answers[i].id };
    });
    const s = scoreAnswers(data, answers, { asked });
    total++;
    const fit = s.nearest_profession ? s.nearest_profession.fit : -99;
    fits.push(fit);
    const fl = floorOverride === undefined ? professionFloor(data) : floorOverride;
    const nm = s.matched_class || (s.nearest_profession && fit >= fl ? s.nearest_profession.id : null);
    if (s.matched_class) exact++;
    if (nm) { named++; byClass[nm] = (byClass[nm] || 0) + 1; } else { byClass._unnamed = (byClass._unnamed || 0) + 1; unnamedFits.push(fit); }
  }
  return { hist, byClass, named, total, exact, fits, unnamedFits };
}

// ---- A/B: the sweep, at the shipped floor -------------------------------------------------
const PATTERNS = 6;                       // 10 races x 4 upbringings x 6 = 240, the item's floor
const r = sweep(PATTERNS);
const tot = r.hist.a + r.hist.b + r.hist.c + r.hist.d;
const even = tot / 4;
const dev = Math.max(...['a', 'b', 'c', 'd'].map((k) => Math.abs(r.hist[k] - even) / even));
say(`\n== M3 ES-NAMED, ${r.total} completions (>= 240 required) ==`);
say(`  answer histogram a/b/c/d = ${r.hist.a}/${r.hist.b}/${r.hist.c}/${r.hist.d}  (max deviation from even ${(dev * 100).toFixed(2)}%)`);
const distinct = Object.keys(r.byClass).filter((k) => k !== '_unnamed');
say(`  NAMED_distinct = ${distinct.length} of ${data.classes.classes.length}   (item: >= 10 full marks, >= 6 pass)`);
say(`  NAMED_rate     = ${(100 * r.named / r.total).toFixed(2)}%   exact set-equality matches: ${r.exact}`);
const sorted = Object.entries(r.byClass).sort((a, b) => b[1] - a[1]);
for (const [k, v] of sorted) say(`     ${k.padEnd(20)} ${v}`);
const never = data.classes.classes.map((c) => c.id).filter((c) => !r.byClass[c]);
say(`  classes NEVER produced: ${never.length ? never.join(', ') : '(none)'}`);

// ---- C: what is the unnamed band made of? -------------------------------------------------
say(`\n== the unnamed band, and whether the floor is doing real work ==`);
const fs2 = r.fits.slice().sort((a, b) => a - b);
const pct = (p) => fs2[Math.min(fs2.length - 1, Math.floor(p * fs2.length))];
say(`  fit percentiles p1 ${pct(0.01)}  p5 ${pct(0.05)}  p25 ${pct(0.25)}  p50 ${pct(0.5)}  p90 ${pct(0.9)}`);
for (const f of [0, 2, 3, 4, 5, 6, 8, 10]) {
  const s = sweep(PATTERNS, f);
  const d = Object.keys(s.byClass).filter((k) => k !== '_unnamed').length;
  say(`  floor ${String(f).padStart(2)}: NAMED_rate ${(100 * s.named / s.total).toFixed(1)}%  NAMED_distinct ${d}`);
}

const out = {
  probe: 'critic-w1-07-r3c', runs: r.total, histogram: r.hist, hist_max_dev_pct: +(dev * 100).toFixed(2),
  named_distinct: distinct.length, classes_total: data.classes.classes.length,
  named_rate_pct: +(100 * r.named / r.total).toFixed(2), exact_matches: r.exact,
  by_class: r.byClass, never_produced: never,
  fit_percentiles: { p1: pct(0.01), p5: pct(0.05), p25: pct(0.25), p50: pct(0.5), p90: pct(0.9) },
  shipped_floor: professionFloor(data),
};
fs.writeFileSync(path.join(ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-07-r3/named-critic.json'), JSON.stringify(out, null, 2));
say('\nwrote corpus/90-verdicts/wave1/artifacts/W1-07-r3/named-critic.json');
