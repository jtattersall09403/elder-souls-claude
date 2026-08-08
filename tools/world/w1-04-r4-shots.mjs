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

  // (a) A building whose outside now contains its inside. Blackrose's inn is the round-3
  //     verdict's own worst case — a 3.4 m shed over a 13.6 m hall — and is now a full-depth
  //     terrace with the room behind its door fitted to it.
  const bla = planOf('blackrose');
  const inn = bla.buildings.find((b) => b.id === 'blackrose-inn');
  const gy = (await one('getTerrainAt', inn.x, inn.z + 18)).y;
  await shoot({
    evidence_of: 'appearance',
    claim: 'W1-04 r4 — blackrose-inn from the street: the building that was a 3.4 m shed over a 13.6 m hall',
    place: { x: inn.x, z: inn.z + 18 },
    camera: { pos: [inn.x + 9, gy + 5.2, inn.z + 17], look: [inn.x, gy + 2.2, inn.z], fov: 62 },
  }, '2026-08-08-w1-04-r4-blackrose-inn-outside-now-contains-inside.png',
     `blackrose-inn drawn ${inn.drawn_footprint_m.join(' x ')} m; the room behind its door is fitted to it`);

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
