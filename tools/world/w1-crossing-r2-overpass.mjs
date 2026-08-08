#!/usr/bin/env node
/**
 * w1-crossing-r2-overpass.mjs — WHERE THE ROAD IS BURIED UNDER ITS OWN BRIDGE.
 *
 * W1-CROSSING round 1 (critic, §G1/§G2) found that THE CROSSING does not walk backwards: the body
 * jams at 5,072.3 m, 1,633 m along `stormhold-helstrom`, standing 0.62 m from the centreline on
 * flat road, for 900 consecutive frames under 1 cm. The cause it named is a world defect, not a
 * steering one: the leg SWITCHBACKS, and the upper limb is a declared 17 m viaduct whose deck slab
 * (`half_width + 0.5` = 3.5 m either side of ITS centreline) is laid ACROSS the lower limb's
 * carriageway, 7.51 m above it.
 *
 * `field.heightAt()` returns `_deckY()` when any deck covers the point, and `_deckY` takes the
 * HIGHEST slab. So a body walking the lower limb reads the ground as the deck of the road it is
 * about to climb: a 5.75 m step up over ten metres. `traversal.js` refuses a climb over 40 deg and
 * the body stops dead. Walking the other way the steering happens to cut the hairpin and miss it,
 * which is exactly rule 8's lesson — one direction is a still target.
 *
 * THIS TOOL IS THE CENSUS, not the fix. For every leg it walks the centreline at `--step` metres
 * and asks one question at each sample: **is the ground here higher than this leg's own declared
 * road profile, and if so, whose slab is doing it?** A sample is an OFFENCE when
 *
 *     heightAt(x, z) - declared_y  >  --bury  (default 1.0 m)
 *
 * and the shadowing structure is a `deck_span` segment that is NOT the segment the sample is on.
 * It reports, per offence run: the leg, the metre along it, the burial depth, the shadowing leg and
 * span, and the horizontal separation between the two carriageway centrelines there.
 *
 * `--self-test` proves the census can fail in both directions:
 *   - the SHIPPED tree must report a non-zero count (the defect the critic found is real), and
 *   - with every `deck_span` deleted the count must go to ZERO (the census is measuring slabs and
 *     not, say, terrain noise or the site pads).
 * A census that reports the same number with and without the thing it claims to measure is a
 * second copy of the terrain, and this one is not.
 *
 * No browser. Everything is read off `game/src/world/field.js`, the module the game collides with.
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
const OUT = String(argOf('--out', 'reports/w1-crossing-r2/overpass.json'));
const STEP = Number(argOf('--step', 1));
const BURY = Number(argOf('--bury', 1.0));
const SELF_TEST = ARGV.includes('--self-test');
const ROADS = String(argOf('--roads', 'game/data/world/roads.json'));
// What this run asserts about the roads file it was given. The census is used on BOTH arms of the
// self-clearance delete-the-fix, so the expectation is an argument and not a constant: on the
// pre-fix roads it must BITE, on the shipped roads it must be CLEAN, and the tool exits non-zero
// when the tree disagrees with the arm it was told it is measuring.
const EXPECT = ARGV.includes('--expect-bite') ? 'bite' : ARGV.includes('--expect-clean') ? 'clean' : null;

function fieldWith(roads) {
  const f = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
  f.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
  f.setRoads(roads);
  return f;
}

/** The leg's OWN declared surface at arc distance d: linear interpolation of its point elevations. */
function alongLeg(pts, d) {
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][0] - pts[k - 1][0], dz = pts[k][1] - pts[k - 1][1];
    const L = Math.hypot(dx, dz) || 1;
    if (acc + L >= d) {
      const t = (d - acc) / L;
      return { x: pts[k - 1][0] + dx * t, z: pts[k - 1][1] + dz * t,
        y: pts[k - 1][2] + (pts[k][2] - pts[k - 1][2]) * t, i: k - 1, t };
    }
    acc += L;
  }
  const n = pts.length - 1;
  return { x: pts[n][0], z: pts[n][1], y: pts[n][2], i: n - 1, t: 1 };
}
const legLen = (pts) => { let s = 0; for (let k = 1; k < pts.length; k++) s += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return s; };

/**
 * Which deck segment is standing over (x, z), and is it a FOREIGN one — i.e. not the stretch of
 * road the sample itself belongs to? Answered against `field.roadSegs` directly, using `_deckY`'s
 * own geometry (square end caps included), so the census and the collision agree by construction.
 */
function shadowOver(field, x, z, ownLeg, ownI) {
  const segs = field.roadGrid.at(x, z);
  let best = null;
  for (const s of segs) {
    if (!s.span) continue;
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz || 1;
    const tr = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
    if ((s.spanFirst && tr < 0) || (s.spanLast && tr > 1)) continue;
    const t = Math.max(0, Math.min(1, tr));
    const cx = s.ax + dx * t, cz = s.az + dz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (d > s.hw + 0.5) continue;
    const y = s.ay + (s.by - s.ay) * t;
    // "Foreign": a different leg, or the same leg but a stretch far enough away along the polyline
    // that it is a different limb of a switchback rather than the sample's own neighbourhood.
    const foreign = s.leg !== ownLeg || Math.abs(s.i - ownI) > 3;
    if (!best || y > best.deck_y) best = { deck_y: y, sep_m: d, leg: s.leg, seg_i: s.i, kind: s.span.kind, foreign };
  }
  return best;
}

function census(roads) {
  const field = fieldWith(roads);
  // `setRoads` does not keep the point index on a segment; re-derive it so a shadow can name the
  // stretch of road it belongs to. Same iteration order as `setRoads`, so the indices line up.
  let n = 0;
  for (const leg of roads.legs) for (let i = 0; i + 1 < leg.points.length; i++) field.roadSegs[n++].i = i;

  const offences = [];
  let samples = 0;
  for (const leg of roads.legs) {
    const L = legLen(leg.points);
    let run = null;
    for (let d = 0; d <= L; d += STEP) {
      const a = alongLeg(leg.points, d);
      samples++;
      const h = field.heightAt(a.x, a.z);
      const bury = h - a.y;
      const sh = bury > BURY ? shadowOver(field, a.x, a.z, leg.id, a.i) : null;
      const bad = !!(sh && sh.foreign);
      if (bad) {
        if (!run) run = { leg: leg.id, from_m: +d.toFixed(1), to_m: +d.toFixed(1), worst_bury_m: 0,
          at: null, over_leg: sh.leg, over_kind: sh.kind, min_sep_m: Infinity, samples: 0 };
        run.to_m = +d.toFixed(1); run.samples++;
        run.min_sep_m = Math.min(run.min_sep_m, +sh.sep_m.toFixed(2));
        if (bury > run.worst_bury_m) {
          run.worst_bury_m = +bury.toFixed(2);
          run.at = [+a.x.toFixed(1), +a.z.toFixed(1)];
          run.road_y = +a.y.toFixed(2); run.deck_y = +sh.deck_y.toFixed(2);
          run.over_seg_i = sh.seg_i;
        }
      } else if (run) { offences.push(run); run = null; }
    }
    if (run) offences.push(run);
  }
  return { samples, offences, buried_samples: offences.reduce((s, o) => s + o.samples, 0) };
}

const roads = rd(ROADS);
const shipped = census(roads);
const out = {
  tool: 'tools/world/w1-crossing-r2-overpass.mjs',
  commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
  roads: ROADS, step_m: STEP, bury_threshold_m: BURY,
  question: 'where does a deck_span slab stand over the carriageway of a DIFFERENT stretch of road, burying it?',
  shipped,
};

if (SELF_TEST) {
  const stripped = JSON.parse(JSON.stringify(roads));
  let removed = 0;
  for (const leg of stripped.legs) { removed += (leg.deck_spans || []).length; leg.deck_spans = []; }
  const noDeck = census(stripped);
  // The control arm: strip every deck_span and the count must go to zero. A census that reports
  // the same number with and without the slabs it claims to measure is a second copy of the
  // terrain. This arm is checked on EVERY tree, defective or fixed.
  out.self_test = {
    arm_no_deck: { spans_removed: removed, buried_samples: noDeck.buried_samples, offence_runs: noDeck.offences.length },
    arm_given: { roads: ROADS, buried_samples: shipped.buried_samples, offence_runs: shipped.offences.length },
    CONTROL_ARM_IS_CLEAN: noDeck.offences.length === 0,
    GIVEN_ARM_BITES: shipped.offences.length > 0,
    pass: noDeck.offences.length === 0,
  };
}

mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2));
console.log(`overpass census @ ${out.commit}: ${shipped.offences.length} offence run(s), ${shipped.buried_samples} buried sample(s) of ${shipped.samples}`);
for (const o of shipped.offences) {
  console.log(`  ${o.leg} ${o.from_m}-${o.to_m} m  bury ${o.worst_bury_m} m  road_y ${o.road_y} deck_y ${o.deck_y}  under ${o.over_leg} seg ${o.over_seg_i} (${o.over_kind})  sep ${o.min_sep_m} m  at ${o.at}`);
}
if (SELF_TEST) {
  console.log(`self-test: given arm ${out.self_test.GIVEN_ARM_BITES ? 'BITES' : 'silent'}, no-deck control ${out.self_test.CONTROL_ARM_IS_CLEAN ? 'CLEAN' : 'DIRTY'} -> ${out.self_test.pass ? 'PASS' : 'FAIL'}`);
}
let bad = SELF_TEST && !out.self_test.pass;
if (EXPECT) {
  out.expect = EXPECT;
  out.expect_met = EXPECT === 'bite' ? shipped.offences.length > 0 : shipped.offences.length === 0;
  console.log(`expect ${EXPECT}: ${out.expect_met ? 'MET' : 'NOT MET'}`);
  if (!out.expect_met) bad = true;
}
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2));
console.log(`wrote ${OUT}`);
process.exit(bad ? 1 : 0);
