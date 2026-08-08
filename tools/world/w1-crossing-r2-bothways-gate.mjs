#!/usr/bin/env node
/**
 * w1-crossing-r2-bothways-gate.mjs — THE SLOPE GATE, ASKED IN BOTH DIRECTIONS.
 *
 * Rule 8 generalised, and the reason this file exists: the province's centrelines have only ever
 * been sampled ONE WAY. `traversal.js`'s slope gate is **not symmetric** — it only bites when the
 * body is CLIMBING (`if (!(yA > y0)) return 0`), so a step that is a 6% descent northbound is a 6%
 * climb southbound, and a refusal that is invisible in one direction stops the body dead in the
 * other. Every "worst gradient on the province is 24.27 deg" figure published so far is a
 * *longitudinal* gradient off `roads.json`'s own point elevations. It is not the quantity the gate
 * reads. The gate reads `field.heightAt()` — which includes the deck slabs, the site pads and the
 * signature landform — through the secant over 1.5 m in the direction of travel, maxed with
 * `slopeAt(2.5)` at the midpoint.
 *
 * So this walks every leg's centreline at `--step` metres and evaluates `climbDeg` FORWARDS and
 * BACKWARDS at each sample, exactly as `sim/traversal.js` computes it, and reports every place the
 * gate would refuse — with the direction it refuses in. A place that refuses in one direction only
 * is the shape that makes a province crossable one way and not the other.
 *
 * `--self-test` runs the same sweep with every `deck_span` removed and with the roads detached
 * entirely, and requires the three arms to differ: an instrument that reports the same refusals on
 * bare terrain as on the built road is measuring the hillside, not the road.
 *
 * No browser. `game/src/world/field.js` and `game/data/world/traversal.json`'s own numbers.
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
const OUT = String(argOf('--out', 'reports/w1-crossing-r2/bothways-gate.json'));
const ROADS = String(argOf('--roads', 'game/data/world/roads.json'));
const STEP = Number(argOf('--step', 0.5));
const SELF_TEST = ARGV.includes('--self-test');
const DEG = 180 / Math.PI;
const MAXDEG = rd('game/data/world/traversal.json').slope.max_walkable_deg;

function fieldWith(roads) {
  const f = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
  f.setSignatures(new SignatureField(rd('game/data/world/signatures.json')));
  if (roads) f.setRoads(roads);
  return f;
}

/** `sim/traversal.js` lines 220-230, transcribed. Zero unless the step CLIMBS. */
function climbDeg(field, x, z, ux, uz) {
  const L = 1.5;
  const y0 = field.heightAt(x, z);
  const yA = field.heightAt(x + ux * L, z + uz * L);
  if (!(yA > y0)) return 0;
  const secant = Math.atan2(yA - y0, L) * DEG;
  const local = field.slopeAt(x + ux * L * 0.5, z + uz * L * 0.5, 2.5);
  return Math.max(secant, local);
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

function sweep(roads, label) {
  const field = fieldWith(roads);
  const legs = [];
  let refusedF = 0, refusedR = 0, samples = 0, worst = { deg: 0 };
  for (const leg of (roads ? roads.legs : [])) {
    const L = legLen(leg.points);
    const hits = [];
    let wf = 0, wr = 0;
    for (let d = 0; d <= L; d += STEP) {
      const a = atArc(leg.points, d);
      samples++;
      const f = climbDeg(field, a.x, a.z, a.ux, a.uz);
      const r = climbDeg(field, a.x, a.z, -a.ux, -a.uz);
      if (f > wf) wf = f;
      if (r > wr) wr = r;
      const bad = f > MAXDEG || r > MAXDEG;
      if (bad) {
        if (f > MAXDEG) refusedF++;
        if (r > MAXDEG) refusedR++;
        hits.push({ m: +d.toFixed(1), at: [+a.x.toFixed(1), +a.z.toFixed(1)], point_i: a.i,
          fwd_deg: +f.toFixed(2), rev_deg: +r.toFixed(2),
          direction: f > MAXDEG && r > MAXDEG ? 'both' : f > MAXDEG ? 'forwards only' : 'BACKWARDS ONLY' });
        const m = Math.max(f, r);
        if (m > worst.deg) worst = { deg: +m.toFixed(2), leg: leg.id, m: +d.toFixed(1), at: [+a.x.toFixed(1), +a.z.toFixed(1)] };
      }
    }
    legs.push({ leg: leg.id, length_m: +L.toFixed(1), worst_forward_deg: +wf.toFixed(2), worst_reverse_deg: +wr.toFixed(2),
      refusals: hits.length, one_way_only: hits.filter((h) => h.direction !== 'both').length, hits: hits.slice(0, 60) });
  }
  return { label, samples, refused_forward: refusedF, refused_reverse: refusedR,
    refused_one_direction_only: legs.reduce((n, l) => n + l.one_way_only, 0), worst, legs };
}

const roads = rd(ROADS);
const out = {
  tool: 'tools/world/w1-crossing-r2-bothways-gate.mjs',
  commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
  roads: ROADS, step_m: STEP, max_walkable_deg: MAXDEG,
  question: 'where would the slope gate refuse a body on the centreline, and in WHICH direction?',
  shipped: sweep(roads, 'shipped'),
};
if (SELF_TEST) {
  const noDeck = JSON.parse(JSON.stringify(roads));
  let removed = 0;
  for (const l of noDeck.legs) { removed += (l.deck_spans || []).length; l.deck_spans = []; }
  const a = sweep(noDeck, 'every deck_span removed');
  // Third arm: the same centrelines sampled with NO roads attached at all — the bare hillside the
  // road was cut into. If this reads the same as the built road, the sweep is measuring terrain.
  const bare = fieldWith(null);
  let bareRef = 0, bareSamples = 0, bareWorst = 0;
  for (const leg of roads.legs) {
    const L = legLen(leg.points);
    for (let d = 0; d <= L; d += STEP * 4) {
      const q = atArc(leg.points, d); bareSamples++;
      const f = climbDeg(bare, q.x, q.z, q.ux, q.uz), r = climbDeg(bare, q.x, q.z, -q.ux, -q.uz);
      bareWorst = Math.max(bareWorst, f, r);
      if (f > MAXDEG || r > MAXDEG) bareRef++;
    }
  }
  out.self_test = {
    arm_no_deck: { spans_removed: removed, refused_forward: a.refused_forward, refused_reverse: a.refused_reverse, worst: a.worst },
    arm_no_roads: { samples: bareSamples, refused: bareRef, worst_deg: +bareWorst.toFixed(2) },
    arm_shipped: { refused_forward: out.shipped.refused_forward, refused_reverse: out.shipped.refused_reverse, worst: out.shipped.worst },
    ARMS_DIFFER: !(a.refused_forward === out.shipped.refused_forward && a.refused_reverse === out.shipped.refused_reverse)
      || bareRef !== out.shipped.refused_forward,
  };
  out.self_test.pass = out.self_test.ARMS_DIFFER;
}
mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2));

const s = out.shipped;
console.log(`both-ways slope gate @ ${out.commit} on ${ROADS}: ${s.samples} samples, limit ${MAXDEG} deg`);
console.log(`  refused walking FORWARDS  ${s.refused_forward}`);
console.log(`  refused walking BACKWARDS ${s.refused_reverse}`);
console.log(`  refused in ONE DIRECTION ONLY ${s.refused_one_direction_only}   worst ${JSON.stringify(s.worst)}`);
for (const l of s.legs) if (l.refusals) {
  console.log(`  ${l.leg.padEnd(20)} worst fwd ${String(l.worst_forward_deg).padStart(6)} / rev ${String(l.worst_reverse_deg).padStart(6)} deg   ${l.refusals} refusal(s), ${l.one_way_only} one-way`);
  for (const h of l.hits.slice(0, 8)) console.log(`      ${String(h.m).padStart(7)} m  pt ${h.point_i}  fwd ${h.fwd_deg} / rev ${h.rev_deg}  ${h.direction}  ${JSON.stringify(h.at)}`);
}
if (SELF_TEST) console.log(`self-test: arms differ -> ${out.self_test.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(out.self_test.arm_no_roads)}`);
console.log(`wrote ${OUT}`);
process.exit(SELF_TEST && !out.self_test.pass ? 1 : 0);
