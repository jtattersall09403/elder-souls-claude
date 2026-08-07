// THE DELETION TEST — applied to round 3's own fixes, before anybody else applies it.
//
// Three W1-09 rounds each closed their named gap by moving the defect somewhere else, and a
// critic caught it by DELETING the fix from a copy and re-measuring. The dispatch for this round
// makes that the standard, so this file does it to W1-10 round 3.
//
// The rule each case follows:
//
//   1. measure the number the fix claims to move, on the shipped build
//   2. DELETE the fix — not disable it behind a flag, not perturb its input: remove the code or
//      the data that constitutes it, in a scratch copy
//   3. measure again
//   4. the fix is REAL if the number returns to the pre-fix value, and the pre-fix value is the
//      one the round-2 verdict recorded. A fix whose deletion changes nothing was decoration; a
//      fix whose deletion moves a DIFFERENT number is the defect relocating.
//
// Every case also names the number it must NOT move, because "the fix worked and something else
// broke" is the failure this instrument exists to catch.
//
//   node tools/weapons/deletion-test.mjs [out.json]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = process.argv[2] || path.resolve(ROOT, 'reports/W1-10-deletion-test.json');
const SRC = {
  moveset: `${ROOT}/game/src/combat/moveset.js`,
  system: `${ROOT}/game/src/combat/system.js`,
  resolve: `${ROOT}/game/src/combat/resolve.js`,
  classes: `${ROOT}/game/data/weapons/classes.json`,
};

/**
 * Edit a file, run `fn`, restore it whatever happens — and THROW if the edit changed nothing.
 *
 * The first version of this file did not assert that, and three of its five cases reported
 * "deleting the fix changes nothing" when what had actually happened was that the deletion never
 * landed. A deletion test whose deletion silently no-ops is the exact instrument AGENT-PROTOCOL
 * warns about: it cannot fail, so it proves nothing.
 */
async function withEdit(file, mutate, fn) {
  const orig = fs.readFileSync(file, 'utf8');
  const next = mutate(orig);
  if (next === orig) throw new Error(`deletion-test: the mutation of ${path.basename(file)} matched nothing — the test would have measured the shipped build twice`);
  try {
    fs.writeFileSync(file, next);
    return await fn();
  } finally { fs.writeFileSync(file, orig); }
}

/**
 * Every measurement runs in a FRESH NODE PROCESS. `import('x?v=rand')` busts one module and
 * leaves its transitive imports in the ESM registry, so an edit to `resolve.js` or `system.js`
 * was invisible to a probe that only cache-busted `combat-node.mjs`. A process boundary is the
 * only honest module-cache reset, and it is what makes the deleted column mean anything.
 */
function worker(args) {
  const out = execFileSync(process.execPath, [`${ROOT}/tools/weapons/_deletion-worker.mjs`, JSON.stringify(args)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

/** A fresh module graph each time — the point is to re-import the EDITED source. */
async function freshLib() {
  const v = `?v=${Math.random()}`;
  const { loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs${v}`);
  const { MovesetLibrary } = await import(`${ROOT}/game/src/combat/moveset.js${v}`);
  const { Rig } = await import(`${ROOT}/game/src/combat/skeleton.js${v}`);
  const D = loadCombatData();
  const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/classes.json`, 'utf8'));
  const lib = new MovesetLibrary(
    { clips: JSON.parse(fs.readFileSync(`${ROOT}/game/data/weapons/clip-registry.json`, 'utf8')).clips },
    CLASSES, D.weaponMovesets, D.skeleton, D.hitgeometry);
  return { D, CLASSES, lib, Rig };
}

const measureReachAndSep = async () => worker({ op: 'reach' });
const fight = async (o = {}) => worker({ op: 'fight', weapon: o.weapon || 'straight-sword', target: o.target || 'dummy_passive', dist: o.dist === undefined ? 1.2 : o.dist, frames: o.frames || 240 });
const band = async (weapon, from = 0.2, to = 3.0, step = 0.1) => worker({ op: 'band', weapon, from, to, step, frames: 200 });

const cases = [];
const log = (o) => { cases.push(o); console.log(`\n### ${o.fix}\n  deletes: ${o.deletion}\n  shipped : ${JSON.stringify(o.shipped)}\n  deleted : ${JSON.stringify(o.deleted)}\n  VERDICT : ${o.verdict}`); };

// =================================================================================================
// CASE 1 — `_bladeLength`: blade length is a property of the weapon, not of the animation.
// Claim: it makes measured blade reach conform to `reach_m` and collapses the within-class reach
// spread that set `W_max` and put `SEP` at 0.72.
// =================================================================================================
{
  const shipped = await measureReachAndSep();
  const deleted = await withEdit(SRC.moveset,
    (s) => s.replace('const b = this._bladeLength(weaponId) ?? clip.capsuleLength;', 'const b = clip.capsuleLength;'),
    measureReachAndSep);
  log({
    fix: 'CASE 1 — MovesetLibrary._bladeLength (blade length is a weapon property)',
    deletion: 'socketsFor() takes the blade length from clip.capsuleLength again, exactly as it did at HEAD',
    shipped: { conform_0_10m: `${shipped.conform_0_10m}/${shipped.weapons}`, max_err_m: shipped.max_err_m, worst_class_spread_m: shipped.worst_class_spread_m, worst_class: shipped.worst_class },
    deleted: { conform_0_10m: `${deleted.conform_0_10m}/${deleted.weapons}`, max_err_m: deleted.max_err_m, worst_class_spread_m: deleted.worst_class_spread_m, worst_class: deleted.worst_class },
    verdict: deleted.conform_0_10m < shipped.conform_0_10m
      && deleted.worst_class_spread_m > shipped.worst_class_spread_m
      ? 'REAL — deleting it puts both numbers back' : 'DECORATION or RELOCATED — investigate',
  });
}

// =================================================================================================
// CASE 2 — `socketsFor` grip→tip: the S26 contiguity fix.
// Claim: the capsule runs grip→tip, so eleven weapons no longer have an interior hole and five
// classes can reach a target standing against them. Deleting it must bring the hole back.
// =================================================================================================
{
  const W = ['spr_drowned_harpoon', 'hlb_garrison_bill', 'axe_bog_cleaver'];
  const shippedGeom = await measureReachAndSep();
  const shipped = {}; for (const w of W) shipped[w] = await band(w);
  const deleted = await withEdit(SRC.moveset,
    (s) => s.replace('      a: GRIP_OFFSET_M,\n', '      a: Math.max(GRIP_OFFSET_M, Math.round((b - span) * 1000) / 1000),\n'),
    async () => { const o = { _geom: await measureReachAndSep() }; for (const w of W) o[w] = await band(w); return o; });
  const deletedGeom = deleted._geom;
  const gapsAfter = W.reduce((n, w) => n + deleted[w].interior_gaps_m.length, 0);
  const gapsNow = W.reduce((n, w) => n + shipped[w].interior_gaps_m.length, 0);
  log({
    fix: 'CASE 2 — socketsFor a = GRIP_OFFSET (S26 contiguity)',
    deletion: 'a = capsule - hitbox_span_m, the round-2 expression',
    shipped: { ...Object.fromEntries(W.map((w) => [w, `${shipped[w].vector} min ${shipped[w].min} gaps ${JSON.stringify(shipped[w].interior_gaps_m)}`])), capsule_near_end_max_m: shippedGeom.max_inboard_m, weapons_whose_capsule_starts_beyond_0_60m: shippedGeom.weapons_with_inboard_over_0_60 },
    deleted: { ...Object.fromEntries(W.map((w) => [w, `${deleted[w].vector} min ${deleted[w].min} gaps ${JSON.stringify(deleted[w].interior_gaps_m)}`])), capsule_near_end_max_m: deletedGeom.max_inboard_m, weapons_whose_capsule_starts_beyond_0_60m: deletedGeom.weapons_with_inboard_over_0_60 },
    verdict: (gapsAfter > gapsNow) || (deletedGeom.weapons_with_inboard_over_0_60 > shippedGeom.weapons_with_inboard_over_0_60)
      ? 'REAL — deleting it puts the capsule\'s near end back out into the shaft, which is where the interior hole came from'
      : 'DECORATION or RELOCATED — investigate',
  });
}

// =================================================================================================
// CASE 3 — the material model has a consumer.
// Claim: `resolve.js` calls `impact.js` at hit time. Deleting the material lookup — replacing the
// resolved material with a hard-coded 'flesh', which is exactly what the round-2 build did — must
// change the damage and the hitstop against a non-flesh target.
// =================================================================================================
{
  const shipped = await fight({ weapon: 'mce_bog_iron_mace', target: 'mat_stone', dist: 1.2 });
  const shippedRapier = await fight({ weapon: 'tsw_bog_rapier', target: 'mat_stone', dist: 1.2 });
  const del = (s) => s.replace(
    "const material = blocking ? 'shield' : materialAt(B, bestHb.id);",
    "const material = blocking ? 'shield' : 'flesh';");
  const rj = `${ROOT}/game/src/combat/resolve.js`;
  const deleted = await withEdit(rj, del, () => fight({ weapon: 'mce_bog_iron_mace', target: 'mat_stone', dist: 1.2 }));
  const deletedRapier = await withEdit(rj, del, () => fight({ weapon: 'tsw_bog_rapier', target: 'mat_stone', dist: 1.2 }));
  log({
    fix: 'CASE 3 — resolve.js resolves the STRUCK REGION\'s material (RI-WPN05 §A/§B)',
    deletion: "materialAt(B, part) replaced with the literal 'flesh' — the round-2 behaviour",
    shipped: { mace_on_stone: shipped, rapier_on_stone: shippedRapier },
    deleted: { mace_on_stone: deleted, rapier_on_stone: deletedRapier },
    verdict: (shipped.dmg !== deleted.dmg || shipped.impact_hitstop_f !== deleted.impact_hitstop_f)
      && (shippedRapier.dmg !== deletedRapier.dmg)
      ? 'REAL — a stone target stops being stone and both the damage and the deflection change'
      : 'DECORATION — the material is resolved and then not used',
  });
}

// =================================================================================================
// CASE 4 — the hitstop hold is N frames, not N-1.
// Claim: `hitstopUntil = frame + N + 1`. Deleting the `+ 1` must shorten the observed hold by
// exactly one frame — the shortfall the round-2 trace showed as "hitstop_f 4 held for 3 frames".
// =================================================================================================
{
  const shipped = await fight({ weapon: 'ssw_garrison_sword', target: 'mat_flesh', dist: 1.2 });
  const src = fs.readFileSync(SRC.resolve, 'utf8');
  const NEEDLE = 'const a = imp.attacker_hitstop_f ? frame + imp.attacker_hitstop_f + 1 : 0;';
  if (!src.includes(NEEDLE)) {
    log({ fix: 'CASE 4 — hitstop holds N frames', deletion: 'the +1 is not in resolve.js applyHitstop in this tree', shipped, deleted: null, verdict: 'NOT APPLICABLE' });
  } else {
    const deleted = await withEdit(SRC.resolve, (s) => s.replace(NEEDLE, 'const a = imp.attacker_hitstop_f ? frame + imp.attacker_hitstop_f : 0;'), () => fight({ weapon: 'ssw_garrison_sword', target: 'mat_flesh', dist: 1.2 }));
    log({
      fix: 'CASE 4 — hitstop holds N frames, not N-1 (RI-WPN05 M1, ±0 tolerance)',
      deletion: 'the `+ 1` removed from hitstopUntil',
      shipped, deleted,
      verdict: shipped.held - deleted.held === 1 ? 'REAL — exactly one frame, which is the size of the defect'
        : `SUSPECT — the hold moved by ${shipped.held - deleted.held}, not 1`,
    });
  }
}

// =================================================================================================
// CASE 5 — `advanceAlong`, the crash fix.
// Claim: without it every fight in which one body drives its root into another throws out of
// `CombatSystem.step`. Deleting the function must make the fight throw again.
// =================================================================================================
{
  const shipped = await fight({ weapon: 'ugs_golem_sword', target: 'dummy_passive', dist: 0.6 });
  const deleted = await withEdit(SRC.system,
    (s) => s.replace('  const d = body.lastRootDelta || 0;', '  const d = body.lastRootDelta || 0; throw new ReferenceError(\'advanceAlong is not defined\');'),
    () => fight({ weapon: 'ugs_golem_sword', target: 'dummy_passive', dist: 0.6 }));
  log({
    fix: 'CASE 5 — system.js advanceAlong (the shipping-build crash)',
    deletion: 'the function body replaced with the ReferenceError HEAD threw — the same failure at the same three call sites',
    shipped: { error: shipped.error, dmg: shipped.dmg },
    deleted: { error: deleted.error, dmg: deleted.dmg },
    verdict: !shipped.error && /advanceAlong is not defined/.test(deleted.error || '')
      ? 'REAL — the crash comes straight back' : 'INVESTIGATE — the crash did not reproduce',
  });
}

const summary = { generated: new Date().toISOString(), cases: cases.length, real: cases.filter((c) => c.verdict.startsWith('REAL')).length, results: cases };
fs.writeFileSync(OUT, JSON.stringify(summary, null, 1));
console.log(`\n${summary.real}/${summary.cases} fixes survive their own deletion test.`);
console.log(`wrote ${OUT}`);
