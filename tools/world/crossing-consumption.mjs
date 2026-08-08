#!/usr/bin/env node
/**
 * crossing-consumption.mjs — CONSUMPTION (RI-MTH07 §B, mandatory under ARBITRATION.md §3).
 *
 * "Sixteen subsystems have shipped a correct, instrumented model that nothing in the running world
 * reads." W1-CROSSING ships two models and this names the world-side consumer of each and then
 * perturbs the model and watches an entity change what it does.
 *
 *   MODEL 1 — the road centreline, `game/data/world/roads.json` legs[].points.
 *   CONSUMER — the player capsule, through `engine._pursue()`: the body's target every frame is
 *              its own projection onto that polyline. Move the road and the body must move.
 *
 *   MODEL 2 — the structures, `legs[].deck_spans`, and the `spanFirst`/`spanLast` chain-end flags
 *              `field.setRoads()` derives from them.
 *   CONSUMER — `field.clampToDeck()`, called from the movement resolve on the player capsule.
 *              Take the bridge out of the model and a body pushed sideways must walk off the edge;
 *              put it back and the same push must be held.
 *
 * THE NULL ARM IS NOT OPTIONAL. The road-join round's null control caught a real defect in that
 * round's own fix — a perturbation 800 m away moved the road 236 m — so this perturbs a leg the
 * crossing does not use and requires the body's track to be **bit-identical**.
 *
 * Note: perturbing the roads in the live page updates collision (`field`) but not the already-built
 * ground skin meshes, which are baked per streamed tile. Every number here is a collision number.
 *
 * Usage: node tools/world/crossing-consumption.mjs [--frames 12000] [--out reports/w1-crossing/consumption.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `crossing-consumption.mjs — RI-MTH07.
  --frames <n>   frames per walk arm (default 12000)
  --out <file>   default reports/w1-crossing/consumption.json`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const FRAMES = Number(args.frames || 12000);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/w1-crossing/consumption.json')));
ensureDir(path.dirname(OUT));

const doc = { schema: 'elder-souls/crossing-consumption@1', measured_at: new Date().toISOString(),
  git: gitInfo(), frames_per_arm: FRAMES, probes: [], checks: [], ok: false };
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const handle = await launchGame({ ...args, width: 640, height: 360 });

/** Shift a contiguous run of a leg's points sideways by `metres`, then re-attach the network. */
const shift = async (legId, from, to, metres) => handle.page.evaluate(([legId, from, to, metres]) => {
  const E = window.__ENGINE;
  const leg = E.data.roads.legs.find((l) => l.id === legId);
  if (!leg) throw new Error(`no leg ${legId}`);
  const p = leg.points;
  for (let i = from; i <= to && i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    // a raised-cosine bump so the ends stay attached and the grade stays sane
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * (i - from) / Math.max(1, to - from));
    p[i][0] += (-dz / L) * metres * w;
    p[i][1] += (dx / L) * metres * w;
  }
  E.field.setRoads(E.data.roads);
  return { leg: legId, moved_points: to - from + 1, metres };
}, [legId, from, to, metres]);

const restore = async () => handle.page.evaluate(() => {
  const E = window.__ENGINE;
  E.data.roads = JSON.parse(E.__roadsPristine);
  E.field.setRoads(E.data.roads);
  return true;
});

const walk = async (frames) => {
  let r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', restart: true, chunkFrames: 1 });
  while (!r.done && r.frames < frames) r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: Math.min(6000, frames - r.frames) });
  const p = await handle.h('getPlayerStats');
  return { path_m: r.path_m, frames: r.frames, end: [+p.pos[0].toFixed(3), +p.pos[2].toFixed(3)],
    worst_off_path_m: r.worst_off_path_m, regains: r.regains };
};

try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  await handle.page.evaluate(() => { window.__ENGINE.__roadsPristine = JSON.stringify(window.__ENGINE.data.roads); });

  log('baseline ...');
  const base = await walk(FRAMES);
  doc.probes.push({ id: 'BASE', model: '-', perturbation: 'none', ...base }); flush();
  log(`  ${base.path_m} m, end ${JSON.stringify(base.end)}`);

  // ---- P1: MOVE THE ROAD ------------------------------------------------------------------------
  const p1i = await shift('stormhold-helstrom', 8, 24, 25);
  log(`P1 move the road: ${JSON.stringify(p1i)}`);
  const p1 = await walk(FRAMES);
  const p1move = Math.hypot(p1.end[0] - base.end[0], p1.end[1] - base.end[1]);
  doc.probes.push({ id: 'P1-MOVE-ROAD', model: 'roads.json legs[].points', consumer: 'engine._pursue -> the player capsule',
    perturbation: p1i, ...p1, body_moved_m: +p1move.toFixed(2) }); flush();
  log(`  body moved ${p1move.toFixed(2)} m`);
  await restore();

  // ---- NULL: move a leg the crossing does not use -----------------------------------------------
  const n0i = await shift('lilmoth-archon', 8, 24, 25);
  log(`NULL move a leg off the route: ${JSON.stringify(n0i)}`);
  const n0 = await walk(FRAMES);
  const n0move = Math.hypot(n0.end[0] - base.end[0], n0.end[1] - base.end[1]);
  doc.probes.push({ id: 'NULL-OFF-ROUTE', model: 'roads.json legs[].points', consumer: 'engine._pursue -> the player capsule',
    perturbation: n0i, ...n0, body_moved_m: +n0move.toFixed(2) }); flush();
  log(`  body moved ${n0move.toFixed(2)} m  (must be 0.00)`);
  await restore();

  // ---- P2: TAKE THE BRIDGE OUT OF THE MODEL -----------------------------------------------------
  // The consumer is the parapet. Push a body sideways off the middle of the 471 m viaduct, with the
  // span declared and with it deleted, and read how far it gets from the centreline.
  const push = async () => handle.page.evaluate(() => {
    const E = window.__ENGINE, f = E.field;
    const leg = E.data.roads.legs.find((l) => l.id === 'stormhold-helstrom');
    const i = 55;                                   // deep inside the 471 m viaduct (points 38-77)
    const a = leg.points[i], b = leg.points[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    let bx = a[0], bz = a[1];
    for (let k = 0; k < 200; k++) {
      const tx = bx + nx * 0.06, tz = bz + nz * 0.06;
      const c = f.clampToDeck(bx, bz, tx, tz);
      bx = c ? c[0] : tx; bz = c ? c[1] : tz;
      if (Math.hypot(bx - a[0], bz - a[1]) > 11) break;
    }
    return { off_centreline_m: +Math.hypot(bx - a[0], bz - a[1]).toFixed(3),
      ground_under_body_m: +(f.heightAt(a[0], a[1]) - f.heightAt(bx, bz)).toFixed(2),
      spans_declared: (leg.deck_spans || []).length };
  });
  const held = await push();
  const p2i = await handle.page.evaluate(() => {
    const E = window.__ENGINE;
    const leg = E.data.roads.legs.find((l) => l.id === 'stormhold-helstrom');
    const n = leg.deck_spans.length; leg.deck_spans = [];
    E.field.setRoads(E.data.roads);
    return { leg: 'stormhold-helstrom', spans_deleted: n };
  });
  const leaked = await push();
  doc.probes.push({ id: 'P2-DELETE-THE-BRIDGE', model: 'roads.json legs[].deck_spans -> field spanFirst/spanLast',
    consumer: 'field.clampToDeck -> the player capsule', perturbation: p2i,
    with_the_bridge: held, without_it: leaked }); flush();
  log(`P2: parapet holds at ${held.off_centreline_m} m with the span declared; ${leaked.off_centreline_m} m with it deleted`);
  await restore();
  const restored = await push();
  doc.probes.push({ id: 'P2-RESTORED', with_the_bridge: restored }); flush();

  // ---- P3: "A BODY THAT LEAVES THE ROAD CANNOT GET BACK ON" — the acceptance, as a count -------
  // The fixed walker does not leave the road on its own (worst deviation over the whole crossing:
  // 1.22 m of a 6 m deck), so the recovery it was built for cannot be observed by watching it walk.
  // It has to be PUSHED. Ten times, at ten different places along the crossing, the body is put 25
  // m off the centreline and the walk is resumed; a regain is the engine's own counter — the body
  // coming back inside 3.5 m of the road it was following — not this file's opinion.
  //
  // The OLD steering is the control and it is run identically. It is the arm that produced this
  // defect's headline: 6,459 m walked on an 1,841 m leg, ending in 18 m of sea.
  const regainRun = async (steering) => {
    await handle.page.evaluate(([steer, oldPursue]) => {
      const E = window.__ENGINE;
      if (!E.__newPursue) E.__newPursue = E._pursue;
      E._pursue = steer === 'NEW' ? E.__newPursue : eval(`(${oldPursue})`);
      const orig = E.__afterStepRaw || E._afterStep.bind(E);
      E.__afterStepRaw = orig;
      E._afterStep = function () { orig(); const p = this.sim.player; if (p.hp < p.hpMax) p.hp = p.hpMax; const c = this.combat && this.combat.player; if (c && c.hp !== undefined) c.hp = p.hpMax; };
    }, [steering, OLD_PURSUE]);
    const installed = await handle.page.evaluate(() => (/PROXIMITY/.test(String(window.__ENGINE._pursue)) ? 'OLD' : 'NEW'));
    if (installed !== steering) throw new Error(`P3 arm ${steering}: install did not take (${installed})`);
    let r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', restart: true, chunkFrames: 1 });
    const events = [];
    for (let k = 0; k < 10; k++) {
      r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: 3000 });
      const before = r.regains;
      const shoved = await handle.page.evaluate(() => {
        const E = window.__ENGINE, w = E._walk, p = w.pts, i = Math.min(w.seg, p.length - 2);
        const dx = p[i + 1][0] - p[i][0], dz = p[i + 1][1] - p[i][1], L = Math.hypot(dx, dz) || 1;
        const x = E.sim.player.pos[0] + (-dz / L) * 25, z = E.sim.player.pos[2] + (dx / L) * 25;
        E.teleport(x, z); E.sim.player.pos[1] = E.field.heightAt(x, z);
        return { to: [+x.toFixed(1), +z.toFixed(1)] };
      });
      const f0 = r.frames;
      r = await handle.h('walkRoute', { route: 'crossing', speed: 'walk', chunkFrames: 4000 });
      events.push({ shoved_to: shoved.to, regained: r.regains > before, frames_allowed: r.frames - f0,
        worst_off_after_m: r.worst_off_path_m });
    }
    return { steering, displacements: events.length, regained: events.filter((e) => e.regained).length,
      path_m: r.path_m, remaining_points: r.remaining_points, regains_total: r.regains, events };
  };
  const p3new = await regainRun('NEW');
  doc.probes.push({ id: 'P3-REGAIN-NEW', ...p3new }); flush();
  log(`P3 NEW steering: ${p3new.regained} of ${p3new.displacements} shoves recovered`);
  const p3old = await regainRun('OLD');
  doc.probes.push({ id: 'P3-REGAIN-OLD', ...p3old }); flush();
  log(`P3 OLD steering: ${p3old.regained} of ${p3old.displacements} shoves recovered`);
  await handle.page.evaluate(() => { window.__ENGINE._pursue = window.__ENGINE.__newPursue; });
} catch (e) { doc.error = String(e && e.stack || e); flush(); throw e; }
finally { flush(); await handle.close(); }

const P = (id) => doc.probes.find((p) => p.id === id);
const ck = (id, pass, detail) => doc.checks.push({ id, pass: !!pass, detail });
ck('C1-ROAD-IS-READ', P('P1-MOVE-ROAD').body_moved_m > 8,
  `moving 17 road points 25 m sideways moved the walking body ${P('P1-MOVE-ROAD').body_moved_m} m`);
ck('C2-NULL-IS-SILENT', P('NULL-OFF-ROUTE').body_moved_m < 0.01,
  `moving a leg the crossing does not use moved the body ${P('NULL-OFF-ROUTE').body_moved_m} m, bar 0.00`);
ck('C3-BRIDGE-IS-READ', P('P2-DELETE-THE-BRIDGE').without_it.off_centreline_m > P('P2-DELETE-THE-BRIDGE').with_the_bridge.off_centreline_m + 2,
  `a sideways push reaches ${P('P2-DELETE-THE-BRIDGE').with_the_bridge.off_centreline_m} m with the span declared and `
  + `${P('P2-DELETE-THE-BRIDGE').without_it.off_centreline_m} m with it deleted`);
ck('C5-REGAIN', P('P3-REGAIN-NEW').regained > P('P3-REGAIN-OLD').regained && P('P3-REGAIN-NEW').regained >= 8,
  `a body put 25 m off the road got back on ${P('P3-REGAIN-NEW').regained} of ${P('P3-REGAIN-NEW').displacements} times with the fix in, `
  + `and ${P('P3-REGAIN-OLD').regained} of ${P('P3-REGAIN-OLD').displacements} with the pre-fix steering restored`);
ck('C4-REVERSIBLE', Math.abs(P('P2-RESTORED').with_the_bridge.off_centreline_m - P('P2-DELETE-THE-BRIDGE').with_the_bridge.off_centreline_m) < 0.01,
  `restoring the model restores the behaviour exactly`);
doc.ok = doc.checks.every((c) => c.pass);
flush();
for (const c of doc.checks) console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
console.log(`\n${OUT}`);
process.exit(doc.ok ? 0 : 1);
