#!/usr/bin/env node
/**
 * critic-prov-shot.mjs — photograph the same spot 750 m into a WALK, with and without the pump.
 *
 * W1-01 province-stream critic, round 1. This exists because a residency count is a number and
 * "the ground under your feet is gone" is a picture. It walks — it never teleports to the spot —
 * so the picture is arrival evidence under ARBITRATION S34, not a placed capture.
 *
 *   --break-fix   neuter `Engine._streamProvince()` before the walk (the defect, restored)
 *   --metres <m>  how far to walk before the shutter (default 750)
 *   --settle <n>  extra fixed steps after the walk, before rendering (default 0)
 *   --out <png>
 *
 * The camera is the game's own gameplay camera, never a posed override, so the picture is what a
 * player standing there would see.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-prov-shot.mjs — the same spot, 750 m into a walk, with and without the pump
  --break-fix     neuter Engine._streamProvince before walking
  --metres <m>    walk distance before the shutter (default 750)
  --settle <n>    fixed steps after the walk before rendering (default 0)
  --state <id>    state to load (default default)
  --out <png>     output png`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const BREAK = args['break-fix'] === true || String(args['break-fix']) === 'true';
const METRES = Number(args.metres || 750);
const SETTLE = Number(args.settle || 0);
const STATE = String(args.state || 'default');
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'world', 'critic-prov-r1', `walk${METRES}${BREAK ? '-broken' : '-fixed'}.png`)));
ensureDir(path.dirname(OUT));

async function main() {
  const t0 = Date.now();
  const handle = await launchGame({ ...args, width: Number(args.width || 1280), height: Number(args.height || 720) });
  let meta;
  try {
    await handle.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 120000 });
    await handle.page.evaluate(() => window.__HARNESS.ready());
    await handle.page.evaluate((s) => window.__HARNESS.loadState(s), STATE);
    await handle.page.evaluate(() => window.__HARNESS.setRenderRate(0));
    if (BREAK) await handle.page.evaluate(() => { window.__ENGINE._streamProvince = function () {}; });
    meta = await handle.page.evaluate(([m, settle]) => {
      const e = window.__ENGINE, p = e.sim.player;
      const R = e.data.roads, named = R.named_routes.crossing;
      const pts = [];
      for (let i = 0; i + 1 < named.settlements.length; i++) {
        const a = named.settlements[i], b = named.settlements[i + 1];
        const leg = R.legs.find((l) => (l.from === a && l.to === b) || (l.from === b && l.to === a));
        const q = leg.from === a ? leg.points : leg.points.slice().reverse();
        for (let k = (pts.length ? 1 : 0); k < q.length; k++) pts.push([q[k][0], q[k][1]]);
      }
      // ONE setup teleport to the start of the road. Nothing teleports again.
      e.teleport(pts[0][0], pts[0][1]);
      const start = [p.pos[0], p.pos[2]];
      let idx = 1, dist = 0, frames = 0;
      while (dist < m && frames < 200000) {
        while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
        const b = Math.atan2(pts[idx][0] - p.pos[0], pts[idx][1] - p.pos[2]);
        const cy = e.sim.camera.yaw * Math.PI / 180;
        e.input.reset(e.sim.frame);
        const sc = [{ f: 0, move: [Math.sin(b - cy) * 0.549999999, Math.cos(b - cy) * 0.549999999] }];
        if (e.traversal && e.traversal.mired) { sc.push({ f: 0, press: ['roll'] }); sc.push({ f: 1, release: ['roll'] }); }
        e.input.queueInputs(sc, e.sim.frame);
        const x0 = p.pos[0], z0 = p.pos[2];
        e.loop.stepOnce(); e._afterStep();
        dist += Math.hypot(p.pos[0] - x0, p.pos[2] - z0); frames++;
      }
      // Face the way we were walking, so the picture is the road ahead.
      while (idx < pts.length - 1 && Math.hypot(p.pos[0] - pts[idx][0], p.pos[2] - pts[idx][1]) < 4.5) idx++;
      const yaw = Math.atan2(pts[idx][0] - p.pos[0], pts[idx][1] - p.pos[2]) * 180 / Math.PI;
      e.sim.camera.yaw = yaw;
      for (let i = 0; i < settle; i++) { e.loop.stepOnce(); e._afterStep(); }
      const pv = e.renderer.province, s = pv.stats();
      const T = s.tileSizeM, RR = s.residentRadiusTiles;
      const tx0 = Math.floor(p.pos[0] / T), tz0 = Math.floor(p.pos[2] / T);
      let want = 0, built = 0;
      for (let dz = -RR; dz <= RR; dz++) for (let dx = -RR; dx <= RR; dx++) {
        const tx = tx0 + dx, tz = tz0 + dz;
        if (tx < 0 || tz < 0 || tx * T >= e.field.sizeX || tz * T >= e.field.sizeZ) continue;
        want++; if (pv.tiles.has(`${tx},${tz}`)) built++;
      }
      return { start: start.map((v) => +v.toFixed(1)), at: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
        walked_m: +dist.toFixed(1), frames, yaw_deg: +yaw.toFixed(1),
        region: e.field.regionAt(p.pos[0], p.pos[2]).id,
        underfoot_built: pv.tiles.has(`${tx0},${tz0}`), ring_built: built, ring_want: want,
        tiles_resident: s.tilesResident, tiles_built_total: s.tilesBuiltTotal,
        skin_lag_m: pv.skinAtPos ? +Math.hypot(p.pos[0] - pv.skinAtPos[0], p.pos[2] - pv.skinAtPos[1]).toFixed(1) : null,
        cover_lag_m: pv.coverAt ? +Math.hypot(p.pos[0] - pv.coverAt[0], p.pos[2] - pv.coverAt[1]).toFixed(1) : null,
        ground_y: +p.pos[1].toFixed(2) };
    }, [METRES, SETTLE]);
    await handle.page.evaluate(() => window.__HARNESS.setUIVisible(false));
    const dataURL = await handle.page.evaluate(() => window.__HARNESS.screenshot());
    fs.writeFileSync(OUT, Buffer.from(String(dataURL).split(',')[1], 'base64'));
    meta.png = path.relative(REPO_ROOT, OUT);
    meta.break_fix = BREAK;
    meta.git = gitInfo();
    meta.loadavg = fs.readFileSync('/proc/loadavg', 'utf8').trim();
    fs.writeFileSync(OUT.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 2));
  } finally {
    await handle.close();
  }
  log(`${OUT} — walked ${meta.walked_m} m in ${meta.frames} f, ring ${meta.ring_built}/${meta.ring_want}, ` +
      `underfoot ${meta.underfoot_built}, skin lag ${meta.skin_lag_m} m (${Date.now() - t0} ms)`);
}

main().catch((e) => { console.error(e); process.exit(20); });
