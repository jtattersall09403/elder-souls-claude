#!/usr/bin/env node
/**
 * critic-crossing-grade.mjs — THE W1-CROSSING CRITIC'S OWN OFFLINE ADJUDICATION.
 *
 * Written with fresh context by the round-1 critic, declared under `method_deviations`. It exists
 * to adjudicate the premise correction §P.4 now rests on — *"there is no 57.5 deg skirt; the road's
 * worst gradient anywhere in the province is 24.27 deg, and the slope gate refuses zero samples of
 * any centreline"* — WITHOUT reading `tools/world/road-grade.mjs`'s arithmetic, because that is the
 * instrument the claim comes from.
 *
 * Five things, each with its own failure mode:
 *
 *   I1  GRADE       the worst longitudinal gradient of every leg, computed from `roads.json`'s own
 *                   points by this file's own arithmetic. An independent re-derivation of 24.27.
 *   I2  VACUITY     "the slope gate refuses zero samples of any centreline" is a claim about a
 *                   counter. This measures whether that counter CAN be non-zero: `traversal.js`
 *                   exempts a body from the slope gate when `onRoadAt(x,z)` is true, and the
 *                   centreline is the locus where `onRoadAt` is true by construction. A check that
 *                   cannot fail is worse than no check (RULES rule 4), so I2 both proves the
 *                   vacuity and supplies the replacement: the gate swept ACROSS the carriageway,
 *                   from the centreline out past the exempt band, which can and does bite.
 *   I3  STALL SITE  the published pre-fix stall coordinate, audited against the structure: lateral
 *                   distance to the centreline, deck elevation, bare ground, and whether the point
 *                   lies inside a declared `deck_span`. Did it fall off a bridge, or meet a slope?
 *   I4  SLOPEAT     can this file reproduce 57.5 / 61.09 / 64.6 deg from `field.slopeAt()` at and
 *                   around that point, and does the same reading appear on ordinary flat road?
 *   I5  OPEN COUNTS an independent recount of G3-REGAIN (63) and G4-NO-FALL (488).
 *
 * `--self-test` bends one leg into a wall and requires I1 AND I2's replacement sweep to go red. A
 * tool that has never been seen to fail is not evidence.
 *
 * No browser. Everything is sampled off `game/src/world/field.js`, the module the running game
 * collides against.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';
import { execSync } from 'node:child_process';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const ARGV = process.argv.slice(2);
const argOf = (f, d) => (ARGV.includes(f) ? ARGV[ARGV.indexOf(f) + 1] : d);
const SELF_TEST = ARGV.includes('--self-test');
const OUT = String(argOf('--out', 'reports/critic-w1-crossing/grade.json'));
const DEG = 180 / Math.PI;
const MAX_WALK_DEG = rd('game/data/world/traversal.json').slope.max_walkable_deg;
const STEP_M = 0.6;
const SAMPLE_M = 1.0;

function fieldWith(roads) {
  const f = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
  f.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
  if (roads) f.setRoads(roads);
  return f;
}

/** `sim/traversal.js`'s gate, transcribed: the secant over 1.5 m in the direction of travel,
 *  maxed with `slopeAt(2.5)` at the midpoint, and only counted where the body is climbing. */
function climbDeg(field, x, z, ux, uz) {
  const L = 1.5;
  const y0 = field.heightAt(x, z);
  const yA = field.heightAt(x + ux * L, z + uz * L);
  if (!(yA > y0)) return 0;
  const secant = Math.atan2(yA - y0, L) * DEG;
  const local = field.slopeAt(x + ux * L * 0.5, z + uz * L * 0.5, 2.5);
  return Math.max(secant, local);
}

/** Walk a polyline to arc length `d`; returns [x, z, tangent_x, tangent_z]. */
function atArc(pts, d) {
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][0] - pts[k - 1][0], dz = pts[k][1] - pts[k - 1][1];
    const L = Math.hypot(dx, dz) || 1;
    if (acc + L >= d || k === pts.length - 1) {
      const u = Math.max(0, Math.min(1, (d - acc) / L));
      return [pts[k - 1][0] + dx * u, pts[k - 1][1] + dz * u, dx / L, dz / L];
    }
    acc += L;
  }
  return [pts[0][0], pts[0][1], 1, 0];
}

function run(roads, label) {
  const field = fieldWith(roads);
  const out = { label, legs: [], I2: null, I3: null, I4: null, totals: {} };

  // ---- I1: the road's own longitudinal gradient, this file's arithmetic ------------------------
  for (const leg of roads.legs) {
    const pts = leg.points, hw = leg.half_width_m;
    let cum = 0, worst = 0, worstAt = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1;
      cum += d;
      const deg = Math.atan2(Math.abs(pts[i][2] - pts[i - 1][2]), d) * DEG;
      if (deg > worst) { worst = deg; worstAt = cum; }
    }
    const spans = leg.deck_spans || [];
    out.legs.push({
      leg: leg.id, metres: +cum.toFixed(1), half_width_m: hw,
      worst_longitudinal_grade_deg: +worst.toFixed(2), at_m: +worstAt.toFixed(1),
      span_m: spans.reduce((a, s) => a + s.length_m, 0),
      tallest_span_m: spans.reduce((a, s) => Math.max(a, s.max_height_m), 0),
      spans: spans.length,
    });
  }
  out.totals.worst_longitudinal_grade_deg = +Math.max(...out.legs.map((l) => l.worst_longitudinal_grade_deg)).toFixed(2);
  out.totals.worst_leg = out.legs.find((l) => l.worst_longitudinal_grade_deg === out.totals.worst_longitudinal_grade_deg).leg;
  out.totals.max_walkable_deg = MAX_WALK_DEG;

  // ---- I2: is "zero refusals on the centreline" a measurement or a tautology? -------------------
  // and the replacement that can bite: sweep the gate ACROSS the carriageway.
  const OFFSETS = [0, 1, 2, 3, 3.45, 3.5, 4, 5, 6, 8];
  const mk = (o) => ({ offset_m: o, samples: 0, exempt: 0, gated: 0, refused: 0, worst_deg: 0, worst_at: null });
  const band = OFFSETS.map(mk);
  // THE SAME SWEEP OVER LEGS WITH NO STRUCTURES AT ALL. The whole premise correction turns on
  // `slopeAt` being garbage beside a slab edge, and `climbDeg` uses `slopeAt(2.5)`. If the critic
  // reported an 88 deg shoulder taken beside a viaduct it would be making the builder's mistake in
  // the other direction. These four legs declare zero `deck_spans`, so there is no slab to straddle.
  const bandEarth = OFFSETS.map(mk);
  let centreSamples = 0, centreExempt = 0;
  for (const leg of roads.legs) {
    const noStructures = (leg.deck_spans || []).length === 0;
    const pts = leg.points;
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (let s = 0; s <= total; s += SAMPLE_M) {
      const [x, z, ux, uz] = atArc(pts, s);
      const nx = -uz, nz = ux;
      centreSamples++;
      if (field.onRoadAt(x, z) || !!field.onDeckAt(x, z)) centreExempt++;
      for (let bi = 0; bi < OFFSETS.length; bi++) {
        for (const sgn of OFFSETS[bi] === 0 ? [1] : [-1, 1]) {
          const px = x + nx * OFFSETS[bi] * sgn, pz = z + nz * OFFSETS[bi] * sgn;
          const bs = noStructures ? [band[bi], bandEarth[bi]] : [band[bi]];
          for (const b of bs) b.samples++;
          if (field.onRoadAt(px, pz) || !!field.onDeckAt(px, pz)) { for (const b of bs) b.exempt++; continue; }
          const c = climbDeg(field, px, pz, ux, uz);          // climbing ALONG the road
          for (const b of bs) {
            b.gated++;
            if (c > b.worst_deg) { b.worst_deg = +c.toFixed(2); b.worst_at = { leg: leg.id, at_m: +s.toFixed(0), pos: [+px.toFixed(1), +pz.toFixed(1)] }; }
            if (c > MAX_WALK_DEG) b.refused++;
          }
        }
      }
    }
  }
  out.I2 = {
    centreline_samples: centreSamples,
    centreline_exempt_from_the_slope_gate: centreExempt,
    centreline_exempt_pct: +(100 * centreExempt / centreSamples).toFixed(4),
    verdict: centreExempt === centreSamples
      ? 'THE CENTRELINE COUNTER IS STRUCTURALLY ZERO: every centreline sample is exempt via onRoadAt(), so `climb_over_limit` on a centreline cannot be non-zero for any road, any terrain, any commit.'
      : 'the centreline counter can be non-zero',
    lateral_sweep: band,
    lateral_sweep_structure_free_legs: bandEarth,
  };

  // ---- I3 / I4: the stall site ------------------------------------------------------------------
  const STALL = [2153.7, 1197.8];
  const leg = roads.legs.find((l) => l.id === 'stormhold-helstrom');
  if (leg) {
    const pts = leg.points;
    let best = { d: Infinity };
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const ax = pts[k - 1][0], az = pts[k - 1][1];
      const dx = pts[k][0] - ax, dz = pts[k][1] - az;
      const L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
      const u = Math.max(0, Math.min(1, ((STALL[0] - ax) * dx + (STALL[1] - az) * dz) / L2));
      const cx = ax + dx * u, cz = az + dz * u;
      const d = Math.hypot(STALL[0] - cx, STALL[1] - cz);
      if (d < best.d) best = { d, k, u, cx, cz, at_m: acc + L * u, i: k - 1 };
      acc += L;
    }
    const spanHere = (leg.deck_spans || []).find((s) => best.i >= s.from_i && best.i <= s.to_i) || null;
    const deck = field.onDeckAt(best.cx, best.cz);
    out.I3 = {
      stall_pos: STALL,
      nearest_centreline_point: [+best.cx.toFixed(1), +best.cz.toFixed(1)],
      lateral_m: +best.d.toFixed(2), at_m_along_leg: +best.at_m.toFixed(1), point_index: best.i,
      inside_declared_span: spanHere && { ...spanHere },
      on_deck_at_centreline: deck && { kind: deck.kind, deck_y: +deck.deck_y.toFixed(2), clearance_m: +deck.clearance_m.toFixed(2) },
      on_deck_at_the_stall: !!field.onDeckAt(STALL[0], STALL[1]),
      on_road_at_the_stall: field.onRoadAt(STALL[0], STALL[1]),
      deck_y_at_centreline: +field.heightAt(best.cx, best.cz).toFixed(2),
      ground_y_at_the_stall: +field.heightAt(STALL[0], STALL[1]).toFixed(2),
      bare_ground_y_at_the_stall: +field.bareHeightAt(STALL[0], STALL[1]).toFixed(2),
    };
    out.I3.below_the_deck_m = +(out.I3.deck_y_at_centreline - out.I3.ground_y_at_the_stall).toFixed(2);

    // I4 — what does slopeAt() say here, and does it say it on flat road too?
    const rings = [];
    for (const r of [1.5, 2.5, 5]) {
      rings.push({ radius_m: r,
        at_the_stall: +field.slopeAt(STALL[0], STALL[1], r).toFixed(2),
        at_the_centreline: +field.slopeAt(best.cx, best.cz, r).toFixed(2) });
    }
    // a control: the same reading taken on a leg with no structures at all
    const flat = roads.legs.find((l) => (l.deck_spans || []).length === 0);
    const [fx, fz] = atArc(flat.points, 500);
    out.I4 = {
      note: 'field.slopeAt() default radius is 5 m — the +/-5 m central difference the survey blames.',
      rings,
      default_at_the_stall: +field.slopeAt(STALL[0], STALL[1]).toFixed(2),
      default_at_the_centreline: +field.slopeAt(best.cx, best.cz).toFixed(2),
      control_flat_leg: { leg: flat.id, pos: [+fx.toFixed(1), +fz.toFixed(1)], slopeAt: +field.slopeAt(fx, fz).toFixed(2) },
      published_readings_the_round_disowns: [57.5, 61.09, 64.6],
    };
  }

  // ---- I5: G3-REGAIN and G4-NO-FALL, recounted --------------------------------------------------
  let regainOver = 0, dropOver = 0, worstRegain = 0, worstDrop = 0, earthSamples = 0;
  const regainByLeg = {}, dropByLeg = {};
  for (const lg of roads.legs) {
    const pts = lg.points, hw = lg.half_width_m, off = hw * 1.15 + 1.0;
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    regainByLeg[lg.id] = 0; dropByLeg[lg.id] = 0;
    for (let s = 0; s <= total; s += SAMPLE_M) {
      const [x, z, ux, uz] = atArc(pts, s);
      if (field.onDeckAt(x, z)) continue;                       // a bridge is allowed a drop beside it
      earthSamples++;
      const nx = -uz, nz = ux, deckY = field.heightAt(x, z);
      for (const sgn of [-1, 1]) {
        const px = x + nx * off * sgn, pz = z + nz * off * sgn;
        const drop = deckY - field.heightAt(px, pz);
        if (drop > worstDrop) worstDrop = drop;
        if (drop > STEP_M) { dropOver++; dropByLeg[lg.id]++; }
        const rg = climbDeg(field, px, pz, -nx * sgn, -nz * sgn);   // pointing back at the road
        if (rg > worstRegain) worstRegain = rg;
        if (rg > MAX_WALK_DEG) { regainOver++; regainByLeg[lg.id]++; }
      }
    }
  }
  out.I5 = {
    earth_centreline_samples: earthSamples,
    G3_regain_over_limit: regainOver, worst_regain_deg: +worstRegain.toFixed(2), regain_by_leg: regainByLeg,
    G4_edge_drop_over_step: dropOver, worst_edge_drop_m: +worstDrop.toFixed(2), drop_by_leg: dropByLeg,
    published: { G3: 63, G4: 488 },
  };
  return out;
}

// ---------------------------------------------------------------------------------------------
const roads = rd(String(argOf('--roads', 'game/data/world/roads.json')));
const doc = {
  schema: 'elder-souls/critic-crossing-grade@1',
  measured_at: new Date().toISOString(),
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  self_test: null,
  shipped: run(roads, 'SHIPPED'),
};

if (SELF_TEST) {
  // Bend `helstrom-blackrose` — a leg with no structures — into a wall: raise 20 consecutive
  // points by 30 m each and lift the terrain under the shoulder with them. I1 must go red, and
  // I2's lateral sweep must start refusing, or these instruments cannot see a defect.
  const bent = JSON.parse(JSON.stringify(roads));
  const lg = bent.legs.find((l) => l.id === 'helstrom-blackrose');
  for (let i = 40; i < 60; i++) lg.points[i][2] += (i - 40) * 30;
  const after = run(bent, 'BENT');
  const i1 = after.totals.worst_longitudinal_grade_deg > doc.shipped.totals.worst_longitudinal_grade_deg + 20;
  const b0 = doc.shipped.I2.lateral_sweep.find((b) => b.offset_m === 5).worst_deg;
  const b1 = after.I2.lateral_sweep.find((b) => b.offset_m === 5).worst_deg;
  doc.self_test = {
    I1_went_red: i1, I1_before: doc.shipped.totals.worst_longitudinal_grade_deg, I1_after: after.totals.worst_longitudinal_grade_deg,
    I2_sweep_moved: b1 > b0 + 1, I2_before: b0, I2_after: b1,
    pass: i1,
  };
}

mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(doc, null, 2) + '\n');

const S = doc.shipped;
console.log(`\nI1  worst longitudinal road gradient: ${S.totals.worst_longitudinal_grade_deg} deg on ${S.totals.worst_leg} (limit ${MAX_WALK_DEG})`);
console.log(`I2  centreline samples ${S.I2.centreline_samples}, exempt from the slope gate ${S.I2.centreline_exempt_pct}%`);
console.log(`    ${S.I2.verdict}`);
console.log('    lateral sweep across the carriageway:');
for (let i = 0; i < S.I2.lateral_sweep.length; i++) {
  const b = S.I2.lateral_sweep[i], e = S.I2.lateral_sweep_structure_free_legs[i];
  console.log(`      ${String(b.offset_m).padStart(5)} m  gated ${String(b.gated).padStart(6)}/${String(b.samples).padStart(6)}  refused ${String(b.refused).padStart(5)}  worst ${String(b.worst_deg).padStart(6)} deg   |  no-structure legs: refused ${String(e.refused).padStart(4)}/${String(e.gated).padStart(5)}  worst ${e.worst_deg} deg`);
}
if (S.I3) {
  console.log(`I3  the stall (${S.I3.stall_pos}): ${S.I3.lateral_m} m off the centreline, ${S.I3.below_the_deck_m} m below the deck`);
  console.log(`    inside a declared span: ${S.I3.inside_declared_span ? `${S.I3.inside_declared_span.length_m} m ${S.I3.inside_declared_span.kind}, ${S.I3.inside_declared_span.max_height_m} m tall` : 'NO'}`);
  console.log(`    on deck at the stall: ${S.I3.on_deck_at_the_stall}   on road at the stall: ${S.I3.on_road_at_the_stall}`);
}
if (S.I4) {
  console.log(`I4  slopeAt at the stall: ${S.I4.default_at_the_stall} deg (r=5), at the centreline ${S.I4.default_at_the_centreline} deg; flat-leg control ${S.I4.control_flat_leg.slopeAt} deg`);
  console.log(`    by radius: ${S.I4.rings.map((r) => `r=${r.radius_m} stall ${r.at_the_stall} / centre ${r.at_the_centreline}`).join('  |  ')}`);
}
console.log(`I5  G3-REGAIN ${S.I5.G3_regain_over_limit} (published 63)   G4-NO-FALL ${S.I5.G4_edge_drop_over_step} (published 488)`);
if (doc.self_test) console.log(`\nSELF-TEST ${doc.self_test.pass ? 'PASS' : 'FAIL'} — I1 ${doc.self_test.I1_before} -> ${doc.self_test.I1_after} deg`);
console.log(`\n${OUT}`);
process.exit(SELF_TEST && !doc.self_test.pass ? 1 : 0);
