#!/usr/bin/env node
/**
 * critic-road-join-ingame.mjs — the road/settlement join, measured against THE GAME'S footprints.
 *
 * WHY. W1-ROAD-JOIN's own finding F1 is that `tools/world/road-through-building.mjs` calls
 * `planSettlement(doc, {})` with an EMPTY interiors map while the running game calls
 * `setSettlements(docs, this.data.interiors)` with all 115, and that 114 of 202 buildings get a
 * different — usually bigger — footprint between the two. The builder answered that by clearing
 * the UNION of both plans, computed by a SECOND OFFLINE CALL to the same generator.
 *
 * That is one half checking the other half. This tool takes the third position: it boots the game,
 * reads the plans OFF THE RUNNING ENGINE (`renderer.province.settlementPlans`, built by the boot
 * path from `this.data.interiors`), reads the roads off `engine.data.roads`, and asks the ENGINE'S
 * OWN predicate `province.buildingAt(x, z)` about every 1 m sample of every leg and named route.
 *
 * It then does the harder version: the actual COLLISION geometry. `settlementSolids()` builds four
 * wall slabs per building, each standing `WALL_T/2 = 0.18 m` proud of the footprint, and the body
 * is a `PLAYER_RADIUS_M = 0.32 m` capsule. A centreline sample can be OUTSIDE every footprint and
 * still have no room for the body. This tool measures signed clearance from each road sample to
 * every wall slab and reports where it is under the body radius.
 *
 * IT CAN FAIL. `--self-test` teleports one named building onto the road IN THE RUNNING ENGINE via
 * `province.setSettlements()` and requires the count to go up, then restores and requires it to go
 * back down — a retargeted arm A that works on a FIXED tree, which is what
 * `road-through-building.mjs --self-test` can no longer do.
 *
 * Usage:
 *   node tools/world/critic-road-join-ingame.mjs [--out reports/critic-road-join/ingame.json]
 *   node tools/world/critic-road-join-ingame.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = parseArgs(process.argv.slice(2));
const OUT = String(args.out || 'reports/critic-road-join/ingame.json');
const SELF_TEST = !!args['self-test'];

const git = (() => {
  try {
    const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();

/**
 * Runs INSIDE the page. Everything it reads comes off the live engine.
 * `mutate` is an optional {town, building, dx, dz} teleport applied by re-planning through
 * `province.setSettlements()` — the same call `engine._boot()` makes.
 */
const PROBE = async ({ mutate, step, radius }) => {
  const E = window.__ENGINE;
  if (!E) return { __err: 'window.__ENGINE missing' };
  const pv = E.renderer && E.renderer.province;
  if (!pv) return { __err: 'renderer.province missing' };
  const docs = Object.values(E.data.settlements || {});
  const interiors = E.data.interiors || {};
  if (mutate) {
    const d = docs.find((q) => q.id === mutate.town);
    if (!d) return { __err: 'no such settlement ' + mutate.town };
    const b = (d.buildings || []).find((q) => q.id === mutate.building);
    if (!b) return { __err: 'no such building ' + mutate.building };
    b.__saved = b.__saved || (b.offset_m ? b.offset_m.slice() : [0, 0, 0]);
    const s = b.__saved;
    b.offset_m = [s[0] + mutate.dx, s[1], s[2] + mutate.dz];
  } else {
    // restore any earlier mutation
    for (const d of docs) for (const b of (d.buildings || [])) if (b.__saved) { b.offset_m = b.__saved.slice(); delete b.__saved; }
  }
  pv.setSettlements(docs, interiors);
  const plans = pv.settlementPlans;

  const roads = E.data.roads;
  const legs = roads.legs;

  // --- the game's footprints, straight off the plans the engine is holding -----------------
  const footprints = [];
  for (const p of plans) for (const b of p.buildings) {
    const fp = b.drawn_footprint_m || b.footprint_m;
    footprints.push({ town: p.id, id: b.id, x: +b.x.toFixed(3), z: +b.z.toFixed(3), yaw: b.yaw_deg || 0, w: +fp[0].toFixed(3), d: +fp[1].toFixed(3) });
  }

  // --- the wall slabs the collision cell is actually built from ----------------------------
  // `settlementSolidsNear` filters by radius around a point, so ask each plan for its own centre
  // with a radius wide enough to take every building in it.
  const slabs = [];
  for (const p of plans) {
    let reach = 0;
    for (const b of p.buildings) reach = Math.max(reach, Math.hypot(b.x - p.pos[0], b.z - p.pos[2]) + 40);
    const got = pv.settlementSolidsNear(p.pos[0], p.pos[2], reach + 10);
    if (!got) continue;
    for (const s of got.shapes) slabs.push({ town: p.id, id: s.id, x: s.c[0], z: s.c[2], hx: s.h[0], hz: s.h[2], yaw: s.yaw_deg || 0 });
  }

  // --- signed clearance to an oriented box (box SDF), negative inside ----------------------
  const boxSD = (o, x, z) => {
    const c = Math.cos(-o.yaw * Math.PI / 180), s = Math.sin(-o.yaw * Math.PI / 180);
    const dx = x - o.x, dz = z - o.z;
    const lx = Math.abs(dx * c + dz * s) - o.hx;
    const lz = Math.abs(-dx * s + dz * c) - o.hz;
    if (lx > 0 || lz > 0) return Math.hypot(Math.max(lx, 0), Math.max(lz, 0));
    return Math.max(lx, lz);
  };

  const resample = (pts, st) => {
    const out = [];
    let m = 0;
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[k + 1];
      const seg = Math.hypot(bx - ax, bz - az);
      if (seg <= 1e-9) continue;
      for (let d = 0; d < seg; d += st) {
        const u = d / seg;
        out.push({ x: ax + u * (bx - ax), z: az + u * (bz - az), m });
        m += st;
      }
    }
    return out;
  };

  const legPoints = (leg) => leg.points;
  const routePoints = (named) => {
    const pts = [];
    for (let i = 0; i + 1 < named.settlements.length; i++) {
      const a = named.settlements[i], b = named.settlements[i + 1];
      const leg = legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
      if (!leg) continue;
      const p = leg.from === a ? leg.points : leg.points.slice().reverse();
      for (let k = (pts.length ? 1 : 0); k < p.length; k++) pts.push(p[k]);
    }
    return pts;
  };

  // For speed, index slabs by a coarse grid.
  const G = 40;
  const grid = new Map();
  const key = (gx, gz) => gx + ',' + gz;
  for (const s of slabs) {
    const r = Math.hypot(s.hx, s.hz) + 4;
    for (let gx = Math.floor((s.x - r) / G); gx <= Math.floor((s.x + r) / G); gx++)
      for (let gz = Math.floor((s.z - r) / G); gz <= Math.floor((s.z + r) / G); gz++) {
        const k = key(gx, gz);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(s);
      }
  }
  const nearSlabs = (x, z) => grid.get(key(Math.floor(x / G), Math.floor(z / G))) || [];

  const auditPts = (pts) => {
    const samples = resample(pts, step);
    const inside = [];          // the game's own insideBuilding predicate
    let worstClear = Infinity, worstAt = null;
    const tight = [];           // samples with < radius clearance to a wall slab
    for (const s of samples) {
      const hit = pv.buildingAt(s.x, s.z, 0);
      if (hit) inside.push({ m: +s.m.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), town: hit.settlement, building: hit.building });
      let c = Infinity;
      for (const o of nearSlabs(s.x, s.z)) { const d = boxSD(o, s.x, s.z); if (d < c) c = d; }
      if (c < worstClear) { worstClear = c; worstAt = { m: +s.m.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1) }; }
      if (c < radius) tight.push({ m: +s.m.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), clear_m: +c.toFixed(3) });
    }
    return {
      samples: samples.length,
      inside_building: inside.length,
      inside_first: inside.slice(0, 6),
      worst_slab_clearance_m: Number.isFinite(worstClear) ? +worstClear.toFixed(3) : null,
      worst_at: worstAt,
      body_blocked_samples: tight.length,
      body_blocked_first: tight.slice(0, 6),
    };
  };

  const legRes = legs.map((l) => ({ leg: l.id, ...auditPts(legPoints(l)) }));
  const routeRes = Object.entries(roads.named_routes).map(([n, r]) => ({ route: n, declared_m: r.metres, ...auditPts(routePoints(r)) }));

  return {
    settlements: plans.length,
    buildings: footprints.length,
    slabs: slabs.length,
    footprints,
    legs: legRes,
    routes: routeRes,
  };
};

const handle = await launchGame({ width: 320, height: 240 });
const run = async (mutate) => {
  const r = await handle.page.evaluate(PROBE, { mutate: mutate || null, step: 1, radius: 0.32 });
  if (r && r.__err) { await handle.close(); throw new Error(r.__err); }
  return r;
};

try {
  if (SELF_TEST) {
    // A retargeted arm A that works on a FIXED tree: pick a building near a road in the RUNNING
    // engine and drive it onto the nearest road point, then restore.
    const base = await run(null);
    // find the closest (building, road point) pair to teleport onto
    const roads = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/roads.json'), 'utf8'));
    let best = null;
    for (const f of base.footprints) {
      for (const leg of roads.legs) for (const p of leg.points) {
        const d = Math.hypot(p[0] - f.x, p[1] - f.z);
        if (!best || d < best.d) best = { d, f, p, leg: leg.id };
      }
    }
    const dx = best.p[0] - best.f.x, dz = best.p[1] - best.f.z;
    const on = await run({ town: best.f.town, building: best.f.id, dx, dz });
    const restored = await run(null);
    const count = (r) => r.legs.reduce((n, l) => n + l.inside_building, 0);
    const blocked = (r) => r.legs.reduce((n, l) => n + l.body_blocked_samples, 0);
    const b0 = count(base), b1 = count(on), b2 = count(restored);
    const k0 = blocked(base), k1 = blocked(on), k2 = blocked(restored);
    const red = b1 > b0, green = b2 === b0, bodyRed = k1 > k0;
    process.stdout.write(`self-test — teleport ${best.f.town}/${best.f.id} ${best.d.toFixed(1)} m onto leg ${best.leg}\n`);
    process.stdout.write(`  baseline   inside=${b0}  body-blocked=${k0}\n`);
    process.stdout.write(`  perturbed  inside=${b1}  body-blocked=${k1}   ${red ? 'RED (correct)' : 'NOT RED — PROBE IS BLIND'}\n`);
    process.stdout.write(`  restored   inside=${b2}  body-blocked=${k2}   ${green ? 'back to baseline (correct)' : 'STUCK ON'}\n`);
    const ok = red && green && bodyRed;
    process.stdout.write(ok ? '\nself-test PASS — the probe moves with the running world.\n' : '\nself-test FAIL\n');
    await handle.close();
    process.exit(ok ? 0 : 1);
  }

  const res = await run(null);
  // Cross-check: the union footprints `build-roads.mjs` cleared against, vs the game's.
  const out = {
    schema: 'critic-road-join/ingame@1',
    measured_at: new Date().toISOString(), git,
    method: 'plans read off the RUNNING engine (renderer.province.settlementPlans, built by _boot from data.interiors); '
      + 'roads read off engine.data.roads; every leg and named route sampled at 1 m; '
      + 'province.buildingAt() is the engine\'s own predicate; slab clearance is against the actual '
      + 'settlementSolids() wall boxes with PLAYER_RADIUS_M = 0.32 m.',
    ...res,
  };
  fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1) + '\n');
  const totalInside = res.legs.reduce((n, l) => n + l.inside_building, 0);
  const totalBody = res.legs.reduce((n, l) => n + l.body_blocked_samples, 0);
  const badLegs = res.legs.filter((l) => l.inside_building > 0);
  const tightLegs = res.legs.filter((l) => l.body_blocked_samples > 0);
  for (const l of res.legs) {
    process.stdout.write(`${l.leg.padEnd(24)} ${String(l.samples).padStart(6)} m  inside=${String(l.inside_building).padStart(4)}  body-blocked=${String(l.body_blocked_samples).padStart(4)}  worst slab clearance ${l.worst_slab_clearance_m} m\n`);
  }
  for (const r of res.routes) {
    process.stdout.write(`ROUTE ${r.route.padEnd(12)} ${r.declared_m} m declared, ${r.samples} sampled — inside=${r.inside_building} body-blocked=${r.body_blocked_samples} worst=${r.worst_slab_clearance_m} m\n`);
  }
  process.stdout.write(`\n${badLegs.length} of ${res.legs.length} legs run inside a GAME footprint (${totalInside} samples).\n`);
  process.stdout.write(`${tightLegs.length} of ${res.legs.length} legs have a sample with less than 0.32 m to a wall slab (${totalBody} samples).\n`);
  process.stdout.write(`  ${OUT}\n`);
  await handle.close();
  process.exit(badLegs.length === 0 ? 0 : 1);
} catch (e) {
  try { await handle.close(); } catch { /* ignore */ }
  process.stderr.write(String(e && e.stack || e) + '\n');
  process.exit(2);
}
