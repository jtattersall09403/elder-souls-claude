#!/usr/bin/env node
// W1-04 round 4 — THE TWO PICTURES.
//
// THE TWO PICTURES. A building whose outside now contains its inside, and a roof — both
// photographed rather than counted, because the two defects this round fixes are the two the
// round-3 critic found with a camera and not with an instrument. The LIVE half of round 4 (does
// the running engine do the join?) is `tools/world/w1-04-r4-live.mjs`, which needs a browser it
// can mutate; this file needs only pixels.
//
// It uses the POOLED CAPTURE DAEMON (`tools/capture/`), not a browser of its own.
// The contention gate was over its per-core ceiling for this run and rule 21 says the pool is
// what to use for pictures. The only world read here is `getTerrainAt`, which is on the daemon's
// read-only whitelist, so nothing this tool does leaves the shared engine dirty for anyone else.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CaptureSession, CaptureError } from '../capture/client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r4');
const SHOTS = path.join(ROOT, 'docs/shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const report = { tool: 'tools/world/w1-04-r4-shots.mjs', when: new Date().toISOString(), commit: process.env.W1_04_COMMIT || null, live: {}, shots: [], failures: [] };
const write = () => fs.writeFileSync(path.join(OUT, 'live-and-shots.json'), JSON.stringify(report, null, 2));
write();

const session = new CaptureSession();
await session.connect();
const one = async (m, ...a) => {
  const r = await session.query([[m, ...a]]);
  const v = r.results[0];
  if (v && v.ok === false) throw new Error(`${m}: ${v.error}`);
  return v.value;
};

try {
  // THE LIVE JOIN MOVED OUT OF THIS FILE. The capture daemon's `query` path is a read-only
  // whitelist and `__w1_04_plan` / `__w1_04_interior` are not on it (correctly: a query runs on
  // the same engine an in-flight capture is using). So the live arm is
  // `tools/world/w1-04-r4-live.mjs`, in one browser of its own, and this file does the pictures
  // through the pool. The camera placements below come from `planSettlement()` run offline —
  // the same pure function the renderer plans from.
  const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
  const load = (dir) => { const o = {}; for (const f of fs.readdirSync(path.join(ROOT, dir))) { const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8')); o[d.id] = d; } return o; };
  const S = load('game/data/world/settlements'), I = load('game/data/world/interiors');
  const planOf = (id) => EX.planSettlement(S[id], I);

  // ---- 2. THE PICTURES ---------------------------------------------------------------------
  const shoot = async (spec, file, note) => {
    try {
      const res = await session.capture({ time: 10.5, weather: 'clear', width: 1280, height: 720, settle_frames: 24, ...spec });
      const dest = path.join(SHOTS, file);
      fs.copyFileSync(res.path, dest);
      report.shots.push({ file: `docs/shots/${file}`, note, settled: res.settle ? res.settle.settled : null, cached: res.cached, arrival: res.provenance.arrival, build_key: res.provenance.build_key });
      console.log(`SHOT  docs/shots/${file}${res.cached ? ' (cache)' : ''}`);
    } catch (e) {
      if (e instanceof CaptureError) { report.failures.push(`capture refused for ${file}: ${e.code} ${e.message.split('\n')[0]}`); console.log(`SHOT  REFUSED ${file}: ${e.code}`); }
      else throw e;
    }
    write();
  };

  // WHERE TO STAND. The first version of this file put the camera at a hand-picked offset from
  // the subject and got a near-black frame, because Blackrose is the densest plan in the province
  // and the offset landed inside the neighbour — which is precisely the defect that has had VP04
  // condemned twice. So the standing point is SURVEYED against the same drawn plan the renderer
  // builds: a 1 m grid, keep only points outside every footprint by `clear` metres, and take the
  // one that sees the subject closest with nothing in between.
  const distTo = (b, x, z) => {
    const yaw = (b.yaw_deg || 0) * Math.PI / 180;
    const c = Math.cos(-yaw), sn = Math.sin(-yaw);
    const dx = x - b.x, dz = z - b.z;
    const lx = Math.abs(dx * c + dz * sn), lz = Math.abs(-dx * sn + dz * c);
    const ox = lx - b.drawn_footprint_m[0] / 2, oz = lz - b.drawn_footprint_m[1] / 2;
    if (ox <= 0 && oz <= 0) return -Math.min(-ox, -oz);
    return Math.hypot(Math.max(ox, 0), Math.max(oz, 0));
  };
  // A RANGE BAND, not "as close as possible". The second version of this file surveyed correctly
  // and then stood 5 m from a 13.6 m wall with a 68-degree lens, which fills the frame with one
  // unlit slab and photographs a black rectangle — the same picture the bad pose gave, for a
  // different reason. A building is legible from about two of its own widths away.
  const standNear = (plan, target, clear = 2.5, near_m = 15, far_m = 32) => {
    let best = null;
    const maxR = Math.ceil(far_m) + 2;
    for (let x = target.x - maxR; x <= target.x + maxR; x += 1) {
      for (let z = target.z - maxR; z <= target.z + maxR; z += 1) {
        let near = Infinity, nearest = null;
        for (const b of plan.buildings) { const d = distTo(b, x, z); if (d < near) { near = d; nearest = b; } }
        if (near < clear) continue;
        // Nothing between the camera and the subject: the nearest building to the standing point
        // must BE the subject.
        if (!nearest || nearest.id !== target.id) continue;
        const d = Math.hypot(x - target.x, z - target.z);
        if (d < near_m || d > far_m) continue;
        const score = near;                     // the most open spot in the band
        if (!best || score > best.score) best = { x, z, d, clear: near, score };
      }
    }
    return best;
  };

  // (a) A building whose outside now contains its inside. Blackrose's inn is the round-3
  //     verdict's own worst case — a 3.4 m shed over a 13.6 m hall — and is now a full-depth
  //     terrace with the room behind its door fitted to it.
  const bla = planOf('blackrose');
  const inn = bla.buildings.find((b) => b.id === 'blackrose-inn');
  const stand = standNear(bla, inn, 2.5, 15, 32);
  if (!stand) { report.failures.push('no clear standing point near blackrose-inn'); }
  else {
    const gy = (await one('getTerrainAt', stand.x, stand.z)).y;
    report.inn_pose = { stand, drawn_footprint_m: inn.drawn_footprint_m, clear_m: +stand.clear.toFixed(2), range_m: +stand.d.toFixed(1) };
    await shoot({
      evidence_of: 'appearance',
      claim: 'W1-04 r4 — blackrose-inn from the street: the building that was a 3.4 m shed over a 13.6 m hall',
      place: { x: stand.x, z: stand.z },
      camera: { pos: [stand.x, gy + 9.0, stand.z], look: [inn.x, gy + 3.0, inn.z], fov: 62 },
    }, '2026-08-08-w1-04-r4-blackrose-inn-outside-now-contains-inside.png',
       `blackrose-inn drawn ${inn.drawn_footprint_m.join(' x ')} m, photographed from ${stand.d.toFixed(1)} m away with ${stand.clear.toFixed(1)} m of clearance; the room behind its door is fitted to it`);
  }

  // (b) The roofs, from above, at the angle the round-3 critic photographed them from. Helstrom
  //     had 40 of 40 open-topped trays with a dome sitting loose inside; Archon had 22.
  const hel = planOf('helstrom');
  const hgy = (await one('getTerrainAt', hel.pos[0], hel.pos[2])).y;
  await shoot({
    evidence_of: 'appearance',
    claim: 'W1-04 r4 — Helstrom from above: the roofs that were open-topped trays with a dome loose inside them',
    place: { x: hel.pos[0], z: hel.pos[2] + 30 },
    camera: { pos: [hel.pos[0] + 4, hgy + 58, hel.pos[2] + 46], look: [hel.pos[0], hgy + 4, hel.pos[2]], fov: 62 },
  }, '2026-08-08-w1-04-r4-helstrom-roofs-now-cover-the-buildings.png',
     'every building in the frame now has a hipped deck under its shell; the corners are closed');
} finally {
  report.pass = report.failures.length === 0;
  write();
  await session.close();
}
for (const f of report.failures) console.log(`FAIL  ${f}`);
console.log(`report reports/w1-04-r4/live-and-shots.json`);
process.exit(report.failures.length ? 1 : 0);
