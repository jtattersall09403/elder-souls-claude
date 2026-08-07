#!/usr/bin/env node
// cmb-chain.mjs — RI-CMB02 M4b, per-class chain tempo.
//
// WHY. `RI-CMB02` §C's two chain rows were class-uniform, and BAR-CRITIQUE-W1-09-R1 §R1 found
// what that cost:
//
//   "for any conforming build the ratio of one link's timing to the next was a constant shared
//    by all eighty-seven weapons: a dagger's four-hit chain and an ultra greatsword's three-hit
//    chain accelerated and decelerated in exactly the same proportions, and only the scale
//    differed … at the level of rhythm this table guaranteed that no weapon owned its combo."
//
// The rows are now DEFAULTS with a ±0.20 per-class deviation budget on **startup and recovery
// only** (active, stamina, motion value and poise stay shared, so tempo cannot become a balance
// lever), a per-link `recovery / startup ≥ 1.40` rule, and a roster requirement that **≥ 6 of
// the 14 melee classes actually deviate** — because a permission nobody uses is not an axis.
//
// WHAT IS MEASURED. The REALISED frame counts, read out of the generated movesets in
// `game/data/combat/movesets/*.json` — the documents the fight loads — and compared against the
// arithmetic the class's own declared pair predicts. A table that agrees with itself is not a
// measurement; this reads the shipped artifact and re-derives the expectation independently.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

const CLASSES = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/weapons/classes.json'), 'utf8'));
const CH = CLASSES.chain_multipliers;
const FLOOR = (CLASSES.contextual_multipliers && CLASSES.contextual_multipliers.startup_floor_f) || 6;

// §C's own defaults, restated here so the ±0.20 budget is checked against the ITEM's numbers and
// not against whatever the build happens to have put in `chain_multipliers`. A uniform deviation
// applied to every class is exactly the shape the amendment exists to stop, so it must not be
// able to hide by becoming the baseline this check measures from.
const SPEC_DEFAULT = { r1_2: { startup: 0.78, recovery: 1.05 }, r1_3: { startup: 0.78, recovery: 1.35 } };
const BUDGET = 0.20;
const RATIO_MIN = 1.40;
const MIN_DEVIATING = 6;

const rhu = (x) => Math.round(x);
const pairOf = (c, key) => {
  const base = CH[key] || SPEC_DEFAULT[key];
  const o = c.chain && c.chain[key];
  return {
    startup: o && o.startup !== undefined ? o.startup : base.startup,
    recovery: o && o.recovery !== undefined ? o.recovery : base.recovery,
    declared: !!o,
  };
};

// The generated movesets, keyed by class, so the REALISED counts come off the shipped artifact.
const realised = {};
const msDir = path.join(ROOT, 'game/data/combat/movesets');
if (fs.existsSync(msDir)) {
  for (const f of fs.readdirSync(msDir)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(msDir, f), 'utf8'));
    if (!doc.weapon_id || !doc.slots) continue;
    const r = realised[doc.class] || (realised[doc.class] = []);
    const link = [];
    for (const s of ['r1.1', 'r1.2', 'r1.3']) {
      const sl = doc.slots[s];
      link.push(sl ? { s: sl.startup_f, a: sl.active_f, r: sl.recovery_f } : null);
    }
    r.push({ weapon: doc.weapon_id, link });
  }
}

const fails = [];
const rows = [];
let deviating = 0;
for (const code of Object.keys(CLASSES.classes)) {
  const c = CLASSES.classes[code];
  // §E's readability contract is a MELEE rule; a bow has no `recovery/startup` argument to make.
  if (code === 'BOW') continue;
  const s1 = c.r1_startup;
  const r1 = c.r1_total - c.r1_startup - c.r1_active;
  const p2 = pairOf(c, 'r1_2'), p3 = pairOf(c, 'r1_3');
  if (p2.declared || p3.declared) deviating++;
  const exp = [
    { s: s1, r: r1 },
    { s: Math.max(FLOOR, rhu(s1 * p2.startup)), r: rhu(r1 * p2.recovery) },
    { s: Math.max(FLOOR, rhu(s1 * p3.startup)), r: rhu(r1 * p3.recovery) },
  ];
  // budget
  for (const [key, p] of [['r1_2', p2], ['r1_3', p3]]) {
    for (const f of ['startup', 'recovery']) {
      const d = Math.abs(p[f] - SPEC_DEFAULT[key][f]);
      if (d > BUDGET + 1e-9) fails.push(`${code}/${key}.${f} = ${p[f]} is ${d.toFixed(2)} from the §C default ${SPEC_DEFAULT[key][f]} — outside the ±${BUDGET} budget`);
    }
  }
  // per-link readability
  const ratios = exp.map((e) => e.r / e.s);
  ratios.forEach((ra, i) => {
    if (ra < RATIO_MIN) fails.push(`${code} link ${i + 1}: recovery/startup ${ra.toFixed(2)} < ${RATIO_MIN} — §E per-link readability`);
  });
  // Realised vs expected, on every weapon of the class.
  //
  // The expectation is computed from **that weapon's own link 1**, not from the class anchor row.
  // `RI-WPN02` gives every weapon a per-weapon perturbation of its class base (a bone awl is
  // 14/28 where the DGR anchor is 12/24), so comparing link 2 against the ANCHOR would measure
  // the roster's spread and call it a chain-tempo defect. What M4b is about is the RATIO between
  // one link and the next, and that ratio is the class's declared pair applied to whatever base
  // the weapon itself has.
  const mismatches = [];
  for (const w of (realised[code] || [])) {
    const L1 = w.link[0];
    if (!L1) continue;
    const wexp = [
      L1,
      { s: Math.max(FLOOR, rhu(L1.s * p2.startup)), r: rhu(L1.r * p2.recovery) },
      { s: Math.max(FLOOR, rhu(L1.s * p3.startup)), r: rhu(L1.r * p3.recovery) },
    ];
    w.link.forEach((L, i) => {
      if (!L || i === 0) return;
      if (L.s !== wexp[i].s || L.r !== wexp[i].r) mismatches.push({ weapon: w.weapon, link: i + 1, realised: [L.s, L.r], expected: [wexp[i].s, wexp[i].r] });
    });
  }
  if (mismatches.length) fails.push(`${code}: ${mismatches.length} realised link counts differ from the class's own declared pair (first: ${JSON.stringify(mismatches[0])})`);
  rows.push({
    class: code, deviates: p2.declared || p3.declared,
    mult: { r1_2: [p2.startup, p2.recovery], r1_3: [p3.startup, p3.recovery] },
    tempo: [exp[0].s, exp[1].s, exp[2].s, exp[0].r, exp[1].r, exp[2].r],
    ratios: ratios.map((x) => +x.toFixed(2)),
    weapons_checked: (realised[code] || []).length,
    mismatches: mismatches.length,
  });
}
if (deviating < MIN_DEVIATING) fails.push(`only ${deviating} of 14 melee classes deviate from the default (need ≥ ${MIN_DEVIATING}) — chain tempo is a permission nobody used`);

const R = {
  schema: 'es-chain-tempo/1', item: 'RI-CMB02 M4b', spec_default: SPEC_DEFAULT,
  budget: BUDGET, ratio_min: RATIO_MIN, deviating_classes: rows.filter((r) => r.deviates).map((r) => r.class),
  rows, acceptance_failures: fails, ok: fails.length === 0,
};
if (arg('out')) {
  fs.mkdirSync(path.dirname(String(arg('out'))), { recursive: true });
  fs.writeFileSync(String(arg('out')), JSON.stringify(R, null, 1) + '\n');
}

const L = [];
L.push('cmb-chain — RI-CMB02 M4b, per-class chain tempo  [st1 st2 st3 | rec1 rec2 rec3]');
L.push('  class  hit2 mult     hit3 mult     st1 st2 st3  rec1 rec2 rec3   r/s per link        wpns  mism  dev');
for (const r of R.rows) {
  const t = r.tempo;
  L.push(`  ${r.class.padEnd(6)} ${String(r.mult.r1_2[0]).padStart(4)}/${String(r.mult.r1_2[1]).padEnd(5)} ${String(r.mult.r1_3[0]).padStart(5)}/${String(r.mult.r1_3[1]).padEnd(5)}  ${String(t[0]).padStart(4)}${String(t[1]).padStart(4)}${String(t[2]).padStart(4)} ${String(t[3]).padStart(5)}${String(t[4]).padStart(5)}${String(t[5]).padStart(5)}   ${r.ratios.map((x) => x.toFixed(2)).join(' ')}   ${String(r.weapons_checked).padStart(4)}  ${String(r.mismatches).padStart(4)}  ${r.deviates ? 'yes' : '-'}`);
}
L.push(`\n  deviating classes: ${R.deviating_classes.length} of 14 — ${R.deviating_classes.join(', ')}`);
L.push('');
L.push(R.ok ? '  ACCEPTANCE: pass' : '  ACCEPTANCE: FAIL\n' + fails.map((f) => '    - ' + f).join('\n'));
process.stdout.write(L.join('\n') + '\n');
process.exit(R.ok ? 0 : 1);
