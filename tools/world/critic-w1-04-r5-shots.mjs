#!/usr/bin/env node
/*
 * W1-04 ROUND-5 CRITIC — the pictures. Through the POOLED capture daemon (rule 20); this tool
 * launches no browser of its own.
 *
 * Three, in priority order:
 *
 *  1. THE ONE THE ROUND COULD NOT GET. `archon-market`'s interior — the worst-hit room in the
 *     join, refused by the settle gate for the round-4 critic (three times) and the round-5
 *     builder (four times). If it refuses me too, that is a finding about a screen nobody in
 *     this piece has been able to photograph, and it is reported as one rather than dropped.
 *
 *  2. THE ONE ON THE DOORSTEP, LOOKING BACK. Also refused for the builder; the shipped shot is
 *     6 m back and says so. Same rule: if it refuses me, it is reported.
 *
 *  3. MY OWN HEADLINE, which the round has no picture of at all: `thorn-inn`. The body leaves
 *     that door, stands clear for one frame — the frame the round measures — and half a second
 *     later is standing inside `thorn-trader` next door. Photographed at 120 frames after the
 *     door, which is where my L1/L2 sweep says the body actually comes to rest.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { capture } = await import(path.join(ROOT, 'tools/capture/client.mjs'));
const SHOTS = path.join(ROOT, 'docs/shots');
const OUT = path.join(ROOT, 'reports/critic-w1-04-r5');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const specs = [
  {
    name: '2026-08-08-w1-04-r5-critic-archon-market-inside',
    claim: 'The inside of archon-market — the room the join left at 17.1% of its declared area, and the picture two consecutive critics and one builder have been refused by the settle gate.',
    evidence_of: 'interior',
    place: { x: 3804.5, z: 3851 },
    ops: [['enterInterior', 'archon-market'], ['stepFrames', 240]],
    settle_frames: 240,
    pose: { yaw_deg: 0, pitch_deg: 0, eye_m: 1.6, fov: 85 }, time: 12,
  },
  {
    name: '2026-08-08-w1-04-r5-critic-on-the-doorstep-looking-back',
    claim: 'A camera standing on the doorstep of archon-guild-office at eye height, looking back at the door it came out of. The round shipped this view from 6 m back and said so.',
    evidence_of: 'composition',
    place: { x: 3785, z: 3798.8 },
    ops: [['enterInterior', 'archon-guild-office'], ['stepFrames', 2], ['exitInterior'], ['stepFrames', 1], ['stepFrames', 200]],
    settle_frames: 200,
    pose: { yaw_deg: 180, pitch_deg: 4, eye_m: 1.7, fov: 80 }, time: 12,
  },
  {
    name: '2026-08-08-w1-04-r5-critic-half-a-second-after-the-door',
    claim: 'Where the body from the thorn-inn door is standing 120 fixed steps after leaving it: inside thorn-trader, the building next door. One frame after the door it was clear of every footprint, which is the frame the round measures.',
    // NOT a coordinate this tool chose: [3834.96, 873.86] is the position my own L1/L2 sweep
    // read off `whereAmI()` for this door at 120 frames, and `buildingAt()` returns
    // `thorn-trader` for it. The ops drive the same door so the body walks here itself.
    evidence_of: 'composition',
    place: { x: 3834.96, z: 873.86 },
    ops: [['enterInterior', 'thorn-inn'], ['stepFrames', 2], ['exitInterior'], ['stepFrames', 120], ['stepFrames', 150]],
    settle_frames: 150,
    pose: { yaw_deg: 0, pitch_deg: 0, eye_m: 1.6, fov: 85 }, time: 12,
  },
];

const out = { tool: 'tools/world/critic-w1-04-r5-shots.mjs', when: new Date().toISOString(), shots: [] };
for (const s of specs) {
  const dest = path.join(SHOTS, `${s.name}.png`);
  try {
    const r = await capture({ ...s, out: dest });
    // The daemon answers with a path into its own build-keyed cache; copying it to docs/shots/
    // is the caller's job. A capture that returns a path and writes nothing to `out` is a
    // SUCCESS, and my first run reported all three as failures for want of these two lines.
    if (r && r.path && fs.existsSync(r.path) && !fs.existsSync(dest)) fs.copyFileSync(r.path, dest);
    const ok = fs.existsSync(dest) && fs.statSync(dest).size > 2000;
    out.shots.push({ name: s.name, ok, bytes: ok ? fs.statSync(dest).size : 0, result: r && r.reason ? r.reason : (r && r.status) || null, claim: s.claim });
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.name}  ${ok ? fs.statSync(dest).size + ' bytes' : JSON.stringify(r).slice(0, 300)}`);
  } catch (e) {
    out.shots.push({ name: s.name, ok: false, refused: String((e && e.message) || e).slice(0, 400), claim: s.claim });
    console.log(`FAIL ${s.name}  ${String((e && e.message) || e).slice(0, 300)}`);
  }
  fs.writeFileSync(path.join(OUT, 'shots.json'), JSON.stringify(out, null, 2));
}
console.log(`\n${out.shots.filter((s) => s.ok).length} of ${out.shots.length} taken -> reports/critic-w1-04-r5/shots.json`);
