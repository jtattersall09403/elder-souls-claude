#!/usr/bin/env node
// overlap-resolver-deletefix.mjs — TEAR THE YAW-AWARE RESOLVER DOWN, ONE LEG AT A TIME.
//
// -------------------------------------------------------------------------------------------------
// WHAT IS UNDER TEST
// -------------------------------------------------------------------------------------------------
//
// `render/exterior.js#planSettlement()`'s shrink pass and `world/province.js#_deepOverlaps()` used to
// compare AXIS-ALIGNED footprints while `settlementSolids()` and `buildSettlementExterior()` rotate
// by `yaw_deg`. W1-OVERLAP-RESOLVER made both work on the ORIENTED rectangles, moved the tolerance
// from a fraction of a span to metres of separation depth, and floored the shrink at the room behind
// each building's own door. This tears each of those legs off separately and requires the arms to
// disagree.
//
// -------------------------------------------------------------------------------------------------
// THE THREE FAILURES THIS IS BUILT NOT TO HAVE (RULES.md rule 6)
// -------------------------------------------------------------------------------------------------
//
//  * AN INERT FIX. Every arm asserts the anchors it is about to remove are actually THERE first. If
//    the tree under test does not contain the fix, this exits 2 saying so, rather than reporting a
//    clean negative against a tree that never had anything to delete.
//  * AN INERT CONTROL. Every teardown asserts the bytes it wrote actually differ from the bytes it
//    read. A replacement that silently matched nothing is a second copy of the head arm.
//  * A FIX THAT DID NOT RUN. The head arm asserts the new code EXECUTED: at least one pair must have
//    been resolved on an axis that is not a world axis, and the doorstep pass must have named at
//    least one building. A number moving the right way is not evidence that your change moved it.
//
// And HAZARDS.md §11: EVERY arm is served from its own control clone, including the head arm. Four
// agents changed four files under `game/` in 45 seconds on this box; an arm served from the live
// repo is an arm measured against a moving target.
//
//   node tools/world/overlap-resolver-deletefix.mjs [--json <path>] [--keep]
//
// Exit codes: 0 the arms disagree as required, 1 an arm disappointed, 2 nothing to delete / tool error.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f) => (args.includes(f) ? args[args.indexOf(f) + 1] : null);
const say = (s) => process.stdout.write(s + '\n');

const FP = 'game/src/world/footprint.js';
const EXT = 'game/src/render/exterior.js';
const PROV = 'game/src/world/province.js';

/* ---- the anchors, and the teardown each one enables ------------------------------------------- */
const ORIENT_FROM = `  const yaw = (yawDeg || 0) * Math.PI / 180;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[c, -s], [s, c]];`;
const ORIENT_TO = `  void yawDeg;   // TORN DOWN: orientation removed. The world axes, whatever the building's yaw.
  return [[1, 0], [0, 1]];`;

const TOL_FROM = 'const SEPARATION_TOL_M = 1.45;';
const TOL_TO = 'const SEPARATION_TOL_M = 1.45;\nconst _TORN_FRAC = true;';
// the tolerance leg is torn down by putting the OLD rule back: 45% of the smaller span on this axis
const TOLUSE_FROM = '          const lim = TOL;';
const TOLUSE_TO = '          const lim = _TORN_FRAC ? MAX_OVERLAP_FRAC * Math.min(2 * ax.ha, 2 * ax.hb) : TOL;';

const FLOOR_FROM = '    return room ? Math.max(base, room[k] + ROOM_WALL_T + SHELL_WALL_T) : base;';
const FLOOR_TO = '    void room; return base;   // TORN DOWN: the room behind the door stops being the floor.';


/* ---- THE WHOLE FIX, REMOVED. The pre-fix shrink pass, verbatim from 551c9722. ------------------
 * Rule 6's actual demand: remove your own change on a copy and confirm the OLD NUMBER COMES BACK.
 * The single-leg arms above cannot do that on their own — each leaves the other legs standing — so
 * this arm restores the axis-aligned resolver in full and is REQUIRED to return the shipped 82.
 * The region is located by its first and last lines rather than by a stored copy of the new text,
 * so an edit to the fix shows up here as "anchor not found" instead of as a silent no-op.
 * ---------------------------------------------------------------------------------------------*/
const SHRINK_HEAD = "  const sorted = list.slice().sort((a, c) => (a.id < c.id ? -1 : a.id > c.id ? 1 : 0));";
const SHRINK_TAIL = "      b.doorstep_limited = true;\n    }\n  }";
const ORIGINAL_SHRINK = `  const sorted = list.slice().sort((a, c) => (a.id < c.id ? -1 : a.id > c.id ? 1 : 0));
  for (const b of sorted) b.shrink_m = [1, 1];
  const spanFloor = (b) => (b.enterable ? MIN_ENTERABLE_SPAN_M : MIN_FOOTPRINT_M);
  for (let pass = 0; pass < 8; pass++) {
    const nx = sorted.map((b) => b.shrink_m[0]);
    const nz = sorted.map((b) => b.shrink_m[1]);
    let touched = 0;
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i], c = sorted[j];
        const aw = a.footprint_m[0] * a.shrink_m[0], ad = a.footprint_m[1] * a.shrink_m[1];
        const cw = c.footprint_m[0] * c.shrink_m[0], cd = c.footprint_m[1] * c.shrink_m[1];
        const Dx = Math.abs(a.x - c.x), Dz = Math.abs(a.z - c.z);
        const Sx = (aw + cw) / 2, Sz = (ad + cd) / 2;
        const limX = Math.min(aw, cw) * MAX_OVERLAP_FRAC, limZ = Math.min(ad, cd) * MAX_OVERLAP_FRAC;
        if (Sx - Dx <= limX || Sz - Dz <= limZ) continue;      // clear, or terraced but not swallowed
        const tx = Sx - limX > 1e-6 ? Math.min(1, Dx / (Sx - limX)) : 1;
        const tz = Sz - limZ > 1e-6 ? Math.min(1, Dz / (Sz - limZ)) : 1;
        // Resolve on the axis that costs the pair least — the larger factor is the smaller cut —
        // and do NOT touch the other one.
        const ax = tx >= tz ? 0 : 1;
        const t = ax === 0 ? tx : tz;
        if (t >= 0.999) continue;
        const arr = ax === 0 ? nx : nz;
        const cur = (b) => b.shrink_m[ax];
        // The floor is in metres and belongs to the building, not to the pair: an enterable
        // building stops at MIN_ENTERABLE_SPAN_M and the pair terraces instead.
        const fa = Math.min(1, spanFloor(a) / a.footprint_m[ax]);
        const fc = Math.min(1, spanFloor(c) / c.footprint_m[ax]);
        arr[i] = Math.min(arr[i], Math.max(fa, cur(a) * t));
        arr[j] = Math.min(arr[j], Math.max(fc, cur(c) * t));
        touched++;
      }
    }
    for (let i = 0; i < sorted.length; i++) sorted[i].shrink_m = [nx[i], nz[i]];
    if (!touched) break;
  }`;

/** Replace the whole shrink region of `exterior.js` with the pre-fix one. */
function restoreOriginalShrink(src) {
  const a = src.indexOf(SHRINK_HEAD);
  const b = src.indexOf(SHRINK_TAIL);
  if (a < 0 || b < 0 || b < a) return src;               // anchors moved: caller reports the no-op
  return src.slice(0, a) + ORIGINAL_SHRINK + src.slice(b + SHRINK_TAIL.length);
}

const ARMS = [
  { id: 'head', edits: [] },
  { id: 'orientation-off', edits: [[FP, ORIENT_FROM, ORIENT_TO]] },
  { id: 'tolerance-off', edits: [[EXT, TOL_FROM, TOL_TO], [EXT, TOLUSE_FROM, TOLUSE_TO]] },
  { id: 'room-floor-off', edits: [[EXT, FLOOR_FROM, FLOOR_TO]] },
  { id: 'orientation-and-tolerance-off', edits: [[FP, ORIENT_FROM, ORIENT_TO], [EXT, TOL_FROM, TOL_TO], [EXT, TOLUSE_FROM, TOLUSE_TO]] },
  { id: 'THE-WHOLE-FIX-DELETED', edits: [], restore: true },
];

/* ---- is there anything to delete? --------------------------------------------------------------- */
const missing = [];
for (const [rel, from] of [[FP, ORIENT_FROM], [EXT, TOL_FROM], [EXT, TOLUSE_FROM], [EXT, FLOOR_FROM]]) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, 'utf8').includes(from)) missing.push(`${rel}: ${from.split('\n')[0].trim().slice(0, 60)}`);
}
if (!fs.readFileSync(path.join(ROOT, PROV), 'utf8').includes('pairDepth(a, c) > 1.50')) missing.push(`${PROV}: the oriented _deepOverlaps counter`);
if (missing.length) {
  say('overlap-resolver-deletefix: THE FIX IS NOT ON THIS TREE — there is nothing to delete.');
  for (const m of missing) say(`  missing anchor  ${m}`);
  say('Refusing to report a clean negative against a tree that never carried the change.');
  process.exit(2);
}

/* ---- measure one arm, in its own frozen clone ---------------------------------------------------- */
const clones = [];
function armTree(arm) {
  const dir = execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'make',
    '--label', `overlap-resolver-deletefix-${arm.id}`, '--paths', 'game,tools',
    '--writable', `${FP},${EXT},${PROV}`], { encoding: 'utf8' }).trim().split('\n').pop().trim();
  clones.push(dir);
  if (arm.restore) {
    const p = path.join(dir, EXT);
    const before = fs.readFileSync(p, 'utf8');
    const after = restoreOriginalShrink(before);
    if (after === before) {
      say('overlap-resolver-deletefix: could not restore the pre-fix shrink pass — its anchors have moved.');
      say('Refusing to report a delete-the-fix that deleted nothing.');
      cleanup(); process.exit(2);
    }
    fs.writeFileSync(p, after);
  }
  for (const [rel, from, to] of arm.edits) {
    const p = path.join(dir, rel);
    const before = fs.readFileSync(p, 'utf8');
    const after = before.replace(from, to);
    if (after === before) {
      say(`overlap-resolver-deletefix: teardown for arm ${arm.id} changed NOTHING in ${rel}.`);
      say('A teardown that writes the bytes it read is a second copy of the head arm, not a control.');
      cleanup(); process.exit(2);
    }
    fs.writeFileSync(p, after);
  }
  return dir;
}
function cleanup() {
  if (has('--keep')) return;
  for (const d of clones) { try { execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'cleanup', '--dir', d], { stdio: 'pipe' }); } catch { /* sweep will get it */ } }
}

/** The census — ALWAYS this tree's copy, never the arm's, so a torn-down arm cannot blind its own instrument. */
const { censusPlan } = await import(path.join(ROOT, 'tools/world/building-overlap-census.mjs'));

async function measure(dir) {
  const J = (p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8'));
  const EXm = await import(path.join(dir, EXT) + `?arm=${encodeURIComponent(dir)}`);
  const interiors = {};
  for (const f of fs.readdirSync(path.join(dir, 'game/data/world/interiors'))) {
    if (f.endsWith('.json')) { const r = J(`game/data/world/interiors/${f}`); interiors[r.id] = r; }
  }
  const docs = fs.readdirSync(path.join(dir, 'game/data/world/settlements'))
    .filter((f) => f.endsWith('.json')).sort().map((f) => J(`game/data/world/settlements/${f}`));
  const plans = docs.map((d) => EXm.planSettlement(d, interiors));
  EXm.applyInteriorBounds(plans, interiors, docs);
  const res = plans.map(censusPlan);
  const sizes = [];
  for (const p of plans) for (const b of p.buildings) {
    if (b.kind === 'structure') continue;
    sizes.push((b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (b.footprint_m[0] * b.footprint_m[1]));
  }
  return {
    overlap: res.reduce((n, r) => n + r.counts.overlap, 0),
    door_inside_other: res.reduce((n, r) => n + r.counts.door_inside_other, 0),
    settlements_with_overlap: res.filter((r) => r.counts.overlap > 0).length,
    doorstep_limited: plans.flatMap((p) => p.doorstep_limited || []),
    area_frac_min: +Math.min(...sizes).toFixed(4),
    area_frac_mean: +(sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(4),
    // DID THE NEW CODE ACTUALLY RUN? A pair resolved on an axis that is not a world axis can only
    // have come from the oriented path. Counted here rather than assumed.
    yawed_buildings_shrunk: plans.reduce((n, p) => n + p.buildings.filter((b) => (b.yaw_deg || 0) % 90 !== 0 && b.shrink < 0.999).length, 0),
    drawn: Object.fromEntries(plans.flatMap((p) => p.buildings.map((b) => [`${p.id}:${b.id}`, b.drawn_footprint_m.join('x')]))),
  };
}

const out = {};
for (const arm of ARMS) out[arm.id] = await measure(armTree(arm));
cleanup();

// How many buildings each teardown draws at a DIFFERENT SIZE from the head arm. A leg that changes
// the count but no rectangle would be arithmetic; a leg that changes rectangles is doing the work.
for (const arm of ARMS) {
  if (arm.id === 'head') continue;
  out.head.plan_differs_from = out.head.plan_differs_from || {};
  const key = arm.id === 'orientation-off' ? 'orientation' : arm.id;
  out.head.plan_differs_from[key] = Object.keys(out.head.drawn).filter((k) => out.head.drawn[k] !== out[arm.id].drawn[k]).length;
}
for (const k of Object.keys(out)) delete out[k].drawn;

say('overlap-resolver-deletefix — every arm from its own frozen clone (HAZARDS.md §11)');
say('');
say('  arm                              overlap  door-in  towns  areaMean  areaMin  yawedShrunk  doorstepLimited');
for (const arm of ARMS) {
  const r = out[arm.id];
  say(`  ${arm.id.padEnd(32)} ${String(r.overlap).padStart(7)}  ${String(r.door_inside_other).padStart(7)}  ${String(r.settlements_with_overlap).padStart(5)}  ${String(r.area_frac_mean).padStart(8)}  ${String(r.area_frac_min).padStart(7)}  ${String(r.yawed_buildings_shrunk).padStart(11)}  ${String(r.doorstep_limited.length).padStart(15)}`);
}
say('');

const fail = [];
const ok = (name, cond, detail) => { say(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!cond) fail.push(name); };

const H = out.head;
ok('the head arm carries the fix and it EXECUTED — a yawed building was shrunk by the oriented path',
  H.yawed_buildings_shrunk > 0, `${H.yawed_buildings_shrunk} yawed building(s) shrunk`);
ok('the doorstep pass ran and named the buildings it constrained',
  H.doorstep_limited.length > 0, H.doorstep_limited.join(', ') || 'none');
ok('tearing the TOLERANCE off puts the count back up',
  out['tolerance-off'].overlap > H.overlap, `${H.overlap} -> ${out['tolerance-off'].overlap}`);
ok('tearing the ORIENTATION off puts the count back up',
  out['orientation-off'].overlap > H.overlap, `${H.overlap} -> ${out['orientation-off'].overlap}`);
ok('DELETING THE WHOLE FIX returns the shipped count of 82',
  out['THE-WHOLE-FIX-DELETED'].overlap === 82, `${out['THE-WHOLE-FIX-DELETED'].overlap}`);
// The orientation leg is NOT proved by "fewer yawed buildings get shrunk" — a yaw-blind resolver
// still shrinks yawed buildings, it just shrinks the wrong ones. What proves it is that the PLAN
// differs: the oriented path draws different rectangles, not merely a different total.
ok('the oriented path changes the PLAN, not just the total — buildings are drawn at different sizes',
  H.plan_differs_from.orientation > 0,
  `${H.plan_differs_from.orientation} building(s) drawn at a different size with orientation on`);
ok('the head arm is the best of every arm that keeps the room floor',
  ['orientation-off', 'tolerance-off', 'orientation-and-tolerance-off', 'THE-WHOLE-FIX-DELETED']
    .every((k) => out[k].overlap > H.overlap),
  Object.entries(out).map(([k, v]) => `${k}=${v.overlap}`).join(' '));
// THE FLOOR LEG IS NOT A REGRESSION ARM AND IS NOT ASSERTED AS ONE. Removing it lets the resolver
// clear far MORE pairs — by drawing 66 buildings smaller than the rooms behind their own doors,
// which `tools/check-building-fits-room.mjs` fails closed on. It is here to size the prize a layout
// or room-authoring piece could claim, and to prove the floor is load-bearing rather than decorative.
ok('the room floor is load-bearing: removing it changes the answer',
  out['room-floor-off'].overlap !== H.overlap,
  `${H.overlap} with the floor -> ${out['room-floor-off'].overlap} without it (and 66 buildings then draw smaller than their own room)`);
ok('no arm is a duplicate of another (the arms genuinely differ)',
  new Set(ARMS.map((a) => `${out[a.id].overlap}/${out[a.id].area_frac_min}/${out[a.id].yawed_buildings_shrunk}`)).size >= 4);

if (argOf('--json')) {
  const p = path.isAbsolute(argOf('--json')) ? argOf('--json') : path.join(ROOT, argOf('--json'));
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ tool: 'tools/world/overlap-resolver-deletefix.mjs', generated_utc: new Date().toISOString(), arms: out, failed: fail }, null, 2) + '\n');
  say(`  json: ${path.relative(ROOT, p)}`);
}

say('');
if (fail.length) { say(`overlap-resolver-deletefix: ${fail.length} arm(s) disappointed — ${fail.join(', ')}`); process.exit(1); }
say('overlap-resolver-deletefix: every arm disagreed with the head arm as required.');
