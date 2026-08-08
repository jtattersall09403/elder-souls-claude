#!/usr/bin/env node
/**
 * critic-road-join-stale.mjs — is the road/settlement join STALE?
 *
 * W1-ROAD-JOIN cut `game/data/world/roads.json` against the settlement plan and shipped
 * "0 of 10 legs blocked, 0 offences". The join is a BUILD-TIME consumption: the roads carry the
 * answer, not the code. The builder's own handoff H4 names the staleness hazard — but names it as
 * a DATA hazard ("if anyone edits settlements/*.json or an interior's exterior_footprint_m").
 *
 * There is a second, larger door: `planSettlement()` ITSELF. The footprints are not data, they are
 * the output of a generator, and a change to the generator moves every wall in the province
 * without touching a byte of settlement data.
 *
 * This tool holds `roads.json` FIXED at whatever is on disk and swaps `planSettlement` for the
 * revision named on the command line, then re-runs the same 1 m `insideBuilding()` audit
 * `road-through-building.mjs` runs. Any difference in the result is the join going stale under a
 * generator change.
 *
 * Usage:
 *   node tools/world/critic-road-join-stale.mjs --impl <path-to-an-exterior.js> [--label <name>]
 *   node tools/world/critic-road-join-stale.mjs --impl a.js --impl b.js --out reports/x.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const impls = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--impl') impls.push({ file: argv[++i], label: null });
  else if (argv[i] === '--label' && impls.length) impls[impls.length - 1].label = argv[++i];
}
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/critic-road-join/stale.json';
if (!impls.length) { process.stderr.write('need at least one --impl <exterior.js>\n'); process.exit(2); }

const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const roads = rd('game/data/world/roads.json');
const TOWNS = ['stormhold', 'thorn', 'gideon', 'helstrom', 'archon', 'blackrose', 'soulrest', 'lilmoth'];
const git = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })();

function loadInteriors() {
  const out = {};
  const dir = path.join(ROOT, 'game/data/world/interiors');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (doc && doc.id) out[doc.id] = doc;
  }
  return out;
}
const INTERIORS = loadInteriors();

function resample(points, step) {
  const out = [];
  let m = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg <= 1e-9) continue;
    for (let d = 0; d < seg; d += step) { const u = d / seg; out.push({ x: ax + u * (bx - ax), z: az + u * (bz - az), m }); m += step; }
  }
  return out;
}

async function runImpl(spec) {
  const mod = await import(path.resolve(spec.file));
  const { planSettlement, insideBuilding } = mod;
  // Two plan sets: what the OFFLINE CHECK sees ({}), and what the GAME sees (all 115 interiors).
  const make = (ints) => TOWNS.map((id) => planSettlement(rd(`game/data/world/settlements/${id}.json`), ints));
  const result = {};
  for (const [key, ints] of [['check_no_interiors', {}], ['game_with_interiors', INTERIORS]]) {
    const plans = make(ints);
    const legs = [];
    for (const leg of roads.legs) {
      const hits = new Set();
      let n = 0;
      for (const s of resample(leg.points, 1)) {
        for (const pl of plans) { const b = insideBuilding(pl, s.x, s.z, 0); if (b) { hits.add(b); n++; break; } }
      }
      if (hits.size) legs.push({ leg: leg.id, buildings: [...hits].sort(), samples: n });
    }
    // Footprint census, so the difference between two revisions is legible.
    let area = 0, biggest = null;
    const fps = {};
    for (const pl of plans) for (const b of pl.buildings) {
      const fp = b.drawn_footprint_m || b.footprint_m;
      fps[`${pl.id}/${b.id}`] = [fp[0], fp[1]];
      area += fp[0] * fp[1];
      if (!biggest || fp[0] * fp[1] > biggest.a) biggest = { id: b.id, a: fp[0] * fp[1] };
    }
    result[key] = {
      blocked_legs: legs.length, legs,
      total_footprint_area_m2: +area.toFixed(1),
      buildings: Object.keys(fps).length,
      footprints: fps,
    };
  }
  return result;
}

const out = { schema: 'critic-road-join/stale@1', measured_at: new Date().toISOString(), git_head: git,
  roads_json_from: 'game/data/world/roads.json as it stands on disk (held FIXED across every impl)',
  impls: [] };
for (const spec of impls) {
  const label = spec.label || path.basename(spec.file);
  const r = await runImpl(spec);
  out.impls.push({ label, file: spec.file, ...r });
  process.stdout.write(`${label.padEnd(28)} check(no interiors): ${r.check_no_interiors.blocked_legs}/10 legs blocked   `
    + `game(115 interiors): ${r.game_with_interiors.blocked_legs}/10 legs blocked   `
    + `total footprint area ${r.game_with_interiors.total_footprint_area_m2} m2\n`);
  for (const l of r.game_with_interiors.legs) process.stdout.write(`    GAME  ${l.leg}: ${l.buildings.join(', ')} (${l.samples} samples)\n`);
}
// A per-building footprint delta between the first and last impl, so "the generator moved the
// walls" is a number rather than an assertion.
if (out.impls.length > 1) {
  const a = out.impls[0].game_with_interiors.footprints, b = out.impls[out.impls.length - 1].game_with_interiors.footprints;
  const grew = [], shrank = [];
  for (const k of Object.keys(a)) {
    if (!b[k]) continue;
    const da = a[k][0] * a[k][1], db = b[k][0] * b[k][1];
    if (db > da + 0.01) grew.push({ id: k, from: a[k], to: b[k], d_m2: +(db - da).toFixed(2) });
    else if (db < da - 0.01) shrank.push({ id: k, from: a[k], to: b[k], d_m2: +(db - da).toFixed(2) });
  }
  grew.sort((x, y) => y.d_m2 - x.d_m2); shrank.sort((x, y) => x.d_m2 - y.d_m2);
  out.footprint_delta = { first: out.impls[0].label, last: out.impls[out.impls.length - 1].label,
    grew: grew.length, shrank: shrank.length, biggest_growth: grew.slice(0, 10), biggest_shrink: shrank.slice(0, 5) };
  process.stdout.write(`\nfootprints ${out.impls[0].label} -> ${out.impls[out.impls.length - 1].label}: ${grew.length} grew, ${shrank.length} shrank\n`);
  for (const g of grew.slice(0, 6)) process.stdout.write(`    ${g.id}: ${g.from.join('x')} -> ${g.to.join('x')}  (+${g.d_m2} m2)\n`);
}
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1) + '\n');
process.stdout.write(`\n  ${OUT}\n`);
