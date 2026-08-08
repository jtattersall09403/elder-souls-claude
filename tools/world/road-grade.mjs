#!/usr/bin/env node
/**
 * road-grade.mjs — WHAT IS THE STEEPEST THING A BODY ON THIS ROAD IS ASKED TO CLIMB,
 * AND IF IT STEPS OFF THE ROAD, CAN IT GET BACK ON?
 *
 * Written for W1-CROSSING. The road-join round left the crossing stopped at 550.1 m by what its
 * handoff H1 called "a 57.5 degree skirt on the Valus Ridge, 4.98 m off a 3.6 m deck". That
 * description is a symptom, not the defect. What is actually there is a **471 m viaduct standing
 * up to 50.6 m above the mountainside**, six metres wide, and the body had fallen off it.
 *
 * So this tool measures four different things that all get called "the grade", because conflating
 * them is how the ridge was misdiagnosed for a round:
 *
 *   1. `deck_grade_deg`      — the ROAD's own longitudinal gradient, from roads.json's own points.
 *                              This is what `build-roads.mjs` solves and caps at STAIR_GRADE.
 *   2. `centreline_slope_deg`— `field.slopeAt()` on the built ground along the centreline. On a
 *                              viaduct this is GARBAGE and reads 60-80 deg, because the +/-5 m
 *                              central difference straddles the edge of the slab. Reported so the
 *                              next reader knows why the stall census printed 61.09.
 *   3. `climb_deg`           — the quantity `sim/traversal.js` ACTUALLY gates on: the secant over
 *                              1.5 m in the direction of travel, maxed with `slopeAt(2.5)`, and
 *                              only where the body is NOT exempt (`onRoadAt` / `onDeckAt`). This
 *                              is the one that must be under `traversal.json max_walkable_deg`.
 *   4. `regain_deg`          — H1, made into a number. Stand the body just outside the exempt
 *                              band and point it back at the road: what does it have to climb to
 *                              get on? Over 40 deg is a body that has left the road for good, and
 *                              a drop of more than a step means it fell rather than wandered.
 *
 * Every number is sampled off `game/src/world/field.js` — the same module the running game
 * collides against — with no browser. It is the BEFORE/AFTER instrument for W1-CROSSING and it
 * fails loudly rather than reporting a shrug: `--self-test` bends one leg's deck into a wall and
 * requires the report to go red.
 *
 * Usage:
 *   node tools/world/road-grade.mjs [--roads <file>] [--out reports/road-grade.json] [--quiet]
 *   node tools/world/road-grade.mjs --self-test
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { SignatureField } from '../../game/src/world/signature.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const ARGV = process.argv.slice(2);
const argOf = (f, d) => (ARGV.includes(f) ? ARGV[ARGV.indexOf(f) + 1] : d);
const QUIET = ARGV.includes('--quiet');
const SELF_TEST = ARGV.includes('--self-test');
const DEG = 180 / Math.PI;

const ROADS_FILE = String(argOf('--roads', 'game/data/world/roads.json'));
const OUT = String(argOf('--out', 'reports/road-grade.json'));

/** A field with the given road network attached — the ground the body stands on. */
function fieldWith(roads) {
  const f = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
  f.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
  if (roads) f.setRoads(roads);
  return f;
}

const MAX_WALK_DEG = rd('game/data/world/traversal.json').slope.max_walkable_deg;
/** A step. The capsule moves ~0.033 m per frame at 2 m/s; anything it can walk down without the
 *  fall system taking over is a step, and `sim/traversal.js` treats a drop over this as a fall. */
const STEP_M = 0.6;

/** Sample a leg every SAMPLE_M along its centreline. 1 m: a 6 m carriageway is six samples wide. */
const SAMPLE_M = 1.0;

function auditLeg(field, bare, leg) {
  const pts = leg.points;
  const hw = leg.half_width_m;
  const out = {
    leg: leg.id, half_width_m: hw, points: pts.length,
    metres: 0,
    deck_grade_deg: 0, deck_grade_at_m: 0,
    centreline_slope_deg: 0, centreline_slope_at_m: 0,
    climb_deg: 0, climb_at_m: 0, climb_over_limit: 0,
    regain_deg: 0, regain_at_m: 0, regain_over_limit: 0,
    edge_drop_m: 0, edge_drop_at_m: 0, edge_drop_over_step: 0,
    samples: 0,
    worst: null,
  };
  // ---- 1. the road's own gradient, straight off the artifact -----------------------------------
  let cum = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) || 1;
    cum += d;
    const g = Math.abs(pts[i][2] - pts[i - 1][2]) / d;
    const deg = Math.atan(g) * DEG;
    if (deg > out.deck_grade_deg) { out.deck_grade_deg = deg; out.deck_grade_at_m = cum; }
  }
  out.metres = cum;

  // ---- 2/3/4. the ground, sampled along the centreline ------------------------------------------
  let s = 0, i = 0, t = 0;
  const total = cum;
  const at = (dist) => {
    // walk the polyline to arc-length `dist`, return [x, z, tangent]
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const dx = pts[k][0] - pts[k - 1][0], dz = pts[k][1] - pts[k - 1][1];
      const L = Math.hypot(dx, dz) || 1;
      if (acc + L >= dist || k === pts.length - 1) {
        const u = Math.max(0, Math.min(1, (dist - acc) / L));
        return [pts[k - 1][0] + dx * u, pts[k - 1][1] + dz * u, dx / L, dz / L];
      }
      acc += L;
    }
    return [pts[0][0], pts[0][1], 1, 0];
  };
  for (s = 0; s <= total; s += SAMPLE_M) {
    const [x, z, ux, uz] = at(s);
    out.samples++;
    // 2. the omnidirectional slope reading — reported, never used as a gate
    const cs = field.slopeAt(x, z);
    if (cs > out.centreline_slope_deg) { out.centreline_slope_deg = cs; out.centreline_slope_at_m = s; }
    // 3. the gate, exactly as sim/traversal.js computes it, ALONG the direction of travel
    const exempt = field.onRoadAt(x, z) || !!field.onDeckAt(x, z);
    if (!exempt) {
      const L = 1.5;
      const y0 = field.heightAt(x, z);
      const yA = field.heightAt(x + ux * L, z + uz * L);
      const secant = Math.atan2(yA - y0, L) * DEG;
      const local = yA > y0 ? field.slopeAt(x + ux * L * 0.5, z + uz * L * 0.5, 2.5) : 0;
      const climb = Math.max(secant, local);
      if (yA > y0 && climb > MAX_WALK_DEG) out.climb_over_limit++;
      if (yA > y0 && climb > out.climb_deg) { out.climb_deg = climb; out.climb_at_m = s; }
    }
    // 4. H1 — step off the road and try to come back.
    //    Stand 1 m outside the exempt band on each side, face the centreline, and ask the same
    //    question the slope gate asks. Also record how far DOWN the first step off the edge is:
    //    a body that fell is not a body that wandered, and the two want different fixes.
    const nx = -uz, nz = ux;
    const off = hw * 1.15 + 1.0;
    const deckY = field.heightAt(x, z);
    for (const sgn of [-1, 1]) {
      const px = x + nx * off * sgn, pz = z + nz * off * sgn;
      // the drop from the carriageway to the ground just outside it
      const drop = deckY - field.heightAt(px, pz);
      if (drop > out.edge_drop_m) { out.edge_drop_m = drop; out.edge_drop_at_m = s; }
      if (drop > STEP_M) out.edge_drop_over_step++;
      // pointing back at the road
      const bx = -nx * sgn, bz = -nz * sgn;
      const L = 1.5;
      const y0 = field.heightAt(px, pz);
      const yA = field.heightAt(px + bx * L, pz + bz * L);
      const secant = Math.atan2(yA - y0, L) * DEG;
      const local = yA > y0 ? field.slopeAt(px + bx * L * 0.5, pz + bz * L * 0.5, 2.5) : 0;
      const regain = yA > y0 ? Math.max(secant, local) : 0;
      if (regain > MAX_WALK_DEG) out.regain_over_limit++;
      if (regain > out.regain_deg) {
        out.regain_deg = regain; out.regain_at_m = s;
        out.worst = { at_m: +s.toFixed(1), on_road: [+x.toFixed(1), +z.toFixed(1)], off_road: [+px.toFixed(1), +pz.toFixed(1)], drop_m: +drop.toFixed(2) };
      }
    }
  }
  // spans, straight off the artifact — the structures a body can fall from
  const spans = leg.deck_spans || [];
  out.span_count = spans.length;
  out.span_m = spans.reduce((a, sp) => a + sp.length_m, 0);
  out.span_max_height_m = spans.reduce((a, sp) => Math.max(a, sp.max_height_m), 0);
  out.max_fill_m = leg.max_fill_m;
  for (const k of ['deck_grade_deg', 'centreline_slope_deg', 'climb_deg', 'regain_deg', 'edge_drop_m', 'metres',
    'deck_grade_at_m', 'centreline_slope_at_m', 'climb_at_m', 'regain_at_m', 'edge_drop_at_m']) out[k] = +out[k].toFixed(2);
  return out;
}

function report(roads, label) {
  const field = fieldWith(roads);
  const bare = fieldWith(null);
  const legs = roads.legs.map((l) => auditLeg(field, bare, l));
  const named = {};
  for (const [id, r] of Object.entries(roads.named_routes || {})) {
    const ids = r.legs || [];
    const rows = legs.filter((l) => ids.includes(l.leg));
    named[id] = {
      legs: ids, metres: r.metres,
      worst_deck_grade_deg: Math.max(0, ...rows.map((x) => x.deck_grade_deg)),
      worst_climb_deg: Math.max(0, ...rows.map((x) => x.climb_deg)),
      worst_regain_deg: Math.max(0, ...rows.map((x) => x.regain_deg)),
      climb_over_limit: rows.reduce((a, x) => a + x.climb_over_limit, 0),
      regain_over_limit: rows.reduce((a, x) => a + x.regain_over_limit, 0),
      span_m: rows.reduce((a, x) => a + x.span_m, 0),
      span_max_height_m: Math.max(0, ...rows.map((x) => x.span_max_height_m)),
    };
  }
  const checks = [
    { id: 'G1-DECK-GRADE', pass: legs.every((l) => l.deck_grade_deg < MAX_WALK_DEG),
      detail: `worst road gradient ${Math.max(...legs.map((l) => l.deck_grade_deg)).toFixed(2)} deg, bar < ${MAX_WALK_DEG}` },
    { id: 'G2-CLIMB', pass: legs.every((l) => l.climb_over_limit === 0),
      detail: `${legs.reduce((a, l) => a + l.climb_over_limit, 0)} centreline samples the slope gate would refuse, bar 0` },
    { id: 'G3-REGAIN', pass: legs.every((l) => l.regain_over_limit === 0),
      detail: `${legs.reduce((a, l) => a + l.regain_over_limit, 0)} places where a body one metre off the road cannot climb back on, bar 0` },
    { id: 'G4-NO-FALL', pass: legs.every((l) => l.edge_drop_over_step === 0),
      detail: `${legs.reduce((a, l) => a + l.edge_drop_over_step, 0)} places where stepping off the carriageway is a fall of more than ${STEP_M} m, bar 0` },
  ];
  return { label, max_walkable_deg: MAX_WALK_DEG, step_m: STEP_M, legs, named_routes: named, checks, ok: checks.every((c) => c.pass) };
}

const roads = rd(ROADS_FILE);
const main = report(roads, ROADS_FILE);

if (SELF_TEST) {
  // RULES rule 4. Bend one leg's deck into a wall and require every gate to notice.
  const broken = JSON.parse(JSON.stringify(roads));
  const leg = broken.legs.find((l) => l.deck_spans && l.deck_spans.length === 0) || broken.legs[0];
  for (let i = 40; i < 50 && i < leg.points.length; i++) leg.points[i][2] += (i - 39) * 6;
  leg.deck_spans = [];
  const bent = report(broken, 'self-test: one leg bent into a wall');
  const before = main.legs.find((l) => l.leg === leg.id);
  const after = bent.legs.find((l) => l.leg === leg.id);
  const moved = after.deck_grade_deg > before.deck_grade_deg + 5;
  const red = !bent.ok;
  const others = main.legs.filter((l) => l.leg !== leg.id).every((l) => {
    const b = bent.legs.find((x) => x.leg === l.leg);
    return b && b.climb_deg === l.climb_deg && b.regain_deg === l.regain_deg;
  });
  console.log(`self-test leg           ${leg.id}`);
  console.log(`  deck grade            ${before.deck_grade_deg} -> ${after.deck_grade_deg} deg   ${moved ? 'FLAG' : 'NOT FLAGGED'}`);
  console.log(`  report went red       ${red ? 'yes' : 'NO'}`);
  console.log(`  every other leg identical ${others ? 'yes' : 'NO'}`);
  const ok = moved && red && others;
  console.log(ok ? 'SELF-TEST PASS — the instrument bites' : 'SELF-TEST FAIL — this instrument cannot fail, do not trust it');
  process.exit(ok ? 0 : 1);
}

mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify({
  schema: 'elder-souls/road-grade@1', measured_at: new Date().toISOString(), roads_file: ROADS_FILE, ...main,
}, null, 2));

if (!QUIET) {
  const pad = (s, n) => String(s).padEnd(n);
  const num = (v, n = 7) => String(v).padStart(n);
  console.log(`road-grade — ${ROADS_FILE}   walkable limit ${MAX_WALK_DEG} deg`);
  console.log(`${pad('leg', 22)}${num('len')} ${num('deck')} ${num('climb')} ${num('regain')} ${num('drop')} ${num('span_m')} ${num('span_h')}  over-limit`);
  for (const l of main.legs) {
    console.log(`${pad(l.leg, 22)}${num(l.metres.toFixed(0))} ${num(l.deck_grade_deg.toFixed(1))} ${num(l.climb_deg.toFixed(1))} ${num(l.regain_deg.toFixed(1))} ${num(l.edge_drop_m.toFixed(1))} ${num(l.span_m)} ${num(l.span_max_height_m)}  climb ${l.climb_over_limit} regain ${l.regain_over_limit} fall ${l.edge_drop_over_step}`);
  }
  for (const c of main.checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.detail}`);
  console.log(`wrote ${OUT}`);
}
process.exit(main.ok ? 0 : 1);
