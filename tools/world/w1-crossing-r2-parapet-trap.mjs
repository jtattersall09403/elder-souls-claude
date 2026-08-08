#!/usr/bin/env node
/**
 * w1-crossing-r2-parapet-trap.mjs — WHERE THE RAILING STANDS BETWEEN A BODY AND ITS OWN ROAD.
 *
 * The census for the second half of W1-CROSSING round 2's reverse-jam fix. `stormhold-helstrom`
 * walks forwards and does not walk backwards; the body is pinned on the carriageway by
 * `field.clampToDeck` at a hairpin where a 13 m viaduct begins AT the apex, so the deck's slab
 * lies over the earth approach and every step toward the road reads as a step over the side.
 *
 * This walks every leg's centreline at `--step` metres and, at each sample, offers the body a
 * one-frame step ALONG the road in each direction. A sample is a TRAP when
 *
 *   - `clampToDeck` refuses the step (returns a clamped position), AND
 *   - the destination is on the carriageway (`onRoadAt`), AND
 *   - the road surface there (`naturalHeightAt` — terrain, sites, road corridor, no slab) is less
 *     than `--kerb` metres below the deck the body is standing on.
 *
 * i.e. the railing is refusing to let a body step down a kerb onto its own road. It reports the
 * direction, because a trap that only bites one way is exactly how a province becomes crossable
 * in one direction and not the other.
 *
 * `--self-test` requires TWO things and fails loudly if either is missing:
 *   1. the shipped `clampToDeck` must be seen REFUSING a step over the side of a real viaduct
 *      (the parapet still works — this is the control for "did the fix just delete the railing");
 *   2. the pre-fix `clampToDeck`, loaded from `tools/world/old-clamp-345dcca.js` and installed on
 *      the same field, must report MORE traps than the shipped one.
 * A fix whose control has never been watched go red is not evidence.
 *
 * No browser.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const ARGV = process.argv.slice(2);
const argOf = (f, d) => (ARGV.includes(f) ? ARGV[ARGV.indexOf(f) + 1] : d);
const OUT = String(argOf('--out', 'reports/w1-crossing-r2/parapet-trap.json'));
const ROADS = String(argOf('--roads', 'game/data/world/roads.json'));
const STEP = Number(argOf('--step', 0.5));
const KERB = Number(argOf('--kerb', 1.0));
const SELF_TEST = ARGV.includes('--self-test');
const FRAME_M = 2.0 / 60;                            // one frame of a walking body

function fieldWith(roads) {
  const f = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
  f.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
  f.setRoads(roads);
  return f;
}
function atArc(pts, d) {
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][0] - pts[k - 1][0], dz = pts[k][1] - pts[k - 1][1];
    const L = Math.hypot(dx, dz) || 1;
    if (acc + L >= d) return { x: pts[k - 1][0] + dx * (d - acc) / L, z: pts[k - 1][1] + dz * (d - acc) / L, ux: dx / L, uz: dz / L, i: k - 1 };
    acc += L;
  }
  const n = pts.length - 1, dx = pts[n][0] - pts[n - 1][0], dz = pts[n][1] - pts[n - 1][1], L = Math.hypot(dx, dz) || 1;
  return { x: pts[n][0], z: pts[n][1], ux: dx / L, uz: dz / L, i: n - 1 };
}
const legLen = (p) => { let s = 0; for (let k = 1; k < p.length; k++) s += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return s; };

function census(field, roads) {
  const legs = [];
  let traps = 0, fwd = 0, rev = 0, samples = 0;
  for (const leg of roads.legs) {
    const L = legLen(leg.points);
    const hits = [];
    for (let d = 0; d <= L; d += STEP) {
      const a0 = atArc(leg.points, d);
      // NOT ONLY THE CENTRELINE. The body that this census exists for was 1.97 m off it — the
      // steering keeps a walker within about 1.4 m of the line and a corner pushes it further, and
      // the first cut of this tool sampled the centreline alone and reported ZERO traps on a leg
      // with a body pinned on it. A probe that cannot see the defect it was written for is worse
      // than no probe (rule 4), so the sweep is lateral as well.
      for (const off of [0, 1, -1, 2, -2, 3, -3]) {
      const a = { x: a0.x - a0.uz * off, z: a0.z + a0.ux * off, ux: a0.ux, uz: a0.uz, i: a0.i };
      samples++;
      const deck = field.onDeckAt(a.x, a.z);
      if (!deck) continue;
      for (const [dir, ux, uz] of [['forwards', a.ux, a.uz], ['backwards', -a.ux, -a.uz]]) {
        const nx = a.x + ux * FRAME_M, nz = a.z + uz * FRAME_M;
        const c = field.clampToDeck(a.x, a.z, nx, nz);
        if (!c) continue;
        if (!field.onRoadAt(nx, nz)) continue;                  // over the side into air: correct
        const drop = deck.deck_y - field.naturalHeightAt(nx, nz);
        if (drop > KERB) continue;                              // a real drop: the railing is right
        traps++; dir === 'forwards' ? fwd++ : rev++;
        hits.push({ m: +d.toFixed(1), point_i: a.i, at: [+a.x.toFixed(1), +a.z.toFixed(1)], lateral_m: off,
          direction: dir, kerb_m: +drop.toFixed(2), deck_y: +deck.deck_y.toFixed(2), kind: deck.kind });
      }
      }
    }
    if (hits.length) legs.push({ leg: leg.id, traps: hits.length, hits: hits.slice(0, 40) });
  }
  return { samples, traps, trapped_forwards: fwd, trapped_backwards: rev, legs };
}

/** The control: how often does the parapet still refuse a step over the side INTO AIR? */
function railingStillWorks(field, roads) {
  let refusals = 0, tested = 0, worstDrop = 0;
  for (const leg of roads.legs) {
    const L = legLen(leg.points);
    for (let d = 0; d <= L; d += 2) {
      const a = atArc(leg.points, d);
      const deck = field.onDeckAt(a.x, a.z);
      if (!deck) continue;
      const px = -a.uz, pz = a.ux;                              // straight over the side
      // 5 m sideways: past `hw + 0.5`, which is what walking off a deck actually is. The first cut
      // pushed one eighth of a metre and recorded ZERO refusals over 1,720 pushes — a control that
      // never fires, which is exactly the shape RULES rule 6 names.
      for (const s of [1, -1]) {
        const nx = a.x + px * s * 5, nz = a.z + pz * s * 5;
        tested++;
        if (field.clampToDeck(a.x, a.z, nx, nz)) {
          refusals++;
          worstDrop = Math.max(worstDrop, deck.deck_y - field.bareHeightAt(nx, nz));
        }
      }
    }
  }
  return { sideways_pushes: tested, refused_by_the_railing: refusals, worst_drop_saved_m: +worstDrop.toFixed(1) };
}

const roads = rd(ROADS);
const field = fieldWith(roads);
const out = {
  tool: 'tools/world/w1-crossing-r2-parapet-trap.mjs',
  commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
  roads: ROADS, step_m: STEP, kerb_m: KERB,
  question: 'where does clampToDeck refuse a step ALONG the road onto carriageway that is within a kerb of the deck?',
  shipped: census(field, roads),
  railing: railingStillWorks(field, roads),
};

if (SELF_TEST) {
  // THE TEARDOWN, and it is the round-1 parapet, not the round-0 one. `clamp-before-r2.js` is
  // everything round 1 shipped with round 2's exemption removed — the actual thing this round
  // changed. `old-clamp-345dcca.js` (the pre-round-1 parapet) is kept as a second, independent
  // control so a reader can see the trap is not an artefact of one particular ancestor.
  const armOf = (file) => {
    const src = readFileSync(join(ROOT, file), 'utf8');
    const f2 = fieldWith(roads);
    // eslint-disable-next-line no-eval
    f2.clampToDeck = eval(`(${src.slice(src.indexOf('function (px'))})`).bind(f2);
    const c = census(f2, roads);
    return { file, traps: c.traps, forwards: c.trapped_forwards, backwards: c.trapped_backwards, legs: c.legs };
  };
  const before = armOf('tools/world/clamp-before-r2.js');
  out.self_test = {
    arm_round_1_parapet: before,
    arm_round_0_parapet: armOf('tools/world/old-clamp-345dcca.js'),
    arm_shipped_clamp: { traps: out.shipped.traps, forwards: out.shipped.trapped_forwards, backwards: out.shipped.trapped_backwards },
    arm_shipped_clamp: { traps: out.shipped.traps, forwards: out.shipped.trapped_forwards, backwards: out.shipped.trapped_backwards },
    RAILING_STILL_REFUSES: out.railing.refused_by_the_railing > 0,
    FIX_REMOVES_TRAPS: before.traps > out.shipped.traps,
    pass: out.railing.refused_by_the_railing > 0 && before.traps > out.shipped.traps,
  };
}

mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2));
const s = out.shipped;
console.log(`parapet-trap @ ${out.commit} on ${ROADS}: ${s.traps} trap(s) over ${s.samples} centreline samples`);
console.log(`  walking forwards ${s.trapped_forwards}, walking backwards ${s.trapped_backwards}`);
for (const l of s.legs) {
  console.log(`  ${l.leg.padEnd(20)} ${l.traps}`);
  for (const h of l.hits.slice(0, 6)) console.log(`      ${String(h.m).padStart(7)} m  pt ${h.point_i}  ${h.direction}  kerb ${h.kerb_m} m  ${h.kind}  ${JSON.stringify(h.at)}`);
}
console.log(`  the railing itself: ${out.railing.refused_by_the_railing} of ${out.railing.sideways_pushes} sideways pushes still refused, worst drop saved ${out.railing.worst_drop_saved_m} m`);
if (SELF_TEST) console.log(`self-test: round-1 parapet ${out.self_test.arm_round_1_parapet.traps} traps, round-0 parapet ${out.self_test.arm_round_0_parapet.traps}, shipped ${out.self_test.arm_shipped_clamp.traps}; railing refuses ${out.railing.refused_by_the_railing}/${out.railing.sideways_pushes} -> ${out.self_test.pass ? 'PASS' : 'FAIL'}`);
console.log(`wrote ${OUT}`);
process.exit(SELF_TEST && !out.self_test.pass ? 1 : 0);
