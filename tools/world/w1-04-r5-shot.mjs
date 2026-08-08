#!/usr/bin/env node
/*
 * W1-04 round 5 — THE PICTURE: a body standing OUTSIDE a building it has just left.
 *
 * The round-4 verdict published the opposite picture at this exact spot
 * (`2026-08-08-w1-04-r4-critic-walking-out-leaves-you-inside-the-building.png`): the declared
 * doorstep of `archon-guild-office`, four walls and a ceiling and the doorway across the room.
 *
 * These shots are taken by DRIVING THE DOOR — `enterInterior`, step, `exitInterior`, step — and
 * photographing wherever that leaves the body, rather than by pointing a camera at a coordinate.
 * That is the whole difference between round 4's question and round 5's: the position is not a
 * number this tool chose, it is where `leaveInterior()` put the player.
 *
 * Through the POOLED capture daemon (rule 20) — this launches no browser of its own.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { capture } = await import(path.join(ROOT, 'tools/capture/client.mjs'));
const SHOTS = path.join(ROOT, 'docs/shots');
fs.mkdirSync(SHOTS, { recursive: true });

const LEAVE = (id) => [['enterInterior', id], ['stepFrames', 2], ['exitInterior'], ['stepFrames', 1]];

const specs = [
  {
    name: '2026-08-08-w1-04-r5-walking-out-now-leaves-you-outside',
    claim: 'archon-guild-office, photographed where the body stands one frame after exitInterior(): outside the building, looking back at the wall it came out of. Round 4 photographed this door from inside the room.',
    // `place` is NOT a coordinate this tool chose. It is the position `tools/world/w1-04-r5-live.mjs`
    // measured for this door in the shipped arm — `whereAmI().pos` one frame after `exitInterior()`
    // — and the `ops` drive the same door so the body is genuinely standing here rather than
    // teleported here. The camera pose in this daemon is built from `place`, so both are needed.
    place: { x: 3785, z: 3798.8 },
    ops: LEAVE('archon-guild-office'),
    pose: { yaw_deg: 180, pitch_deg: 2, eye_m: 1.7, fov: 85 }, time: 12,
  },
  {
    name: '2026-08-08-w1-04-r5-the-same-doorstep-facing-away',
    claim: 'The same doorstep of archon-guild-office, turned 180 degrees: open town rather than the far wall of a room.',
    place: { x: 3785, z: 3798.8 },
    ops: LEAVE('archon-guild-office'),
    pose: { yaw_deg: 0, pitch_deg: 2, eye_m: 1.7, fov: 85 }, time: 12,
  },
  {
    name: '2026-08-08-w1-04-r5-blackrose-house-1-lamps-back-inside',
    claim: 'blackrose-house-1 from inside, after the lamp clamp. Round 4 left six of its eight distinct lamps outside these walls, worst 2.33 m out, and the detection model was reading those positions.',
    place: { x: 1857.5, z: 4484 },
    ops: [['enterInterior', 'blackrose-house-1'], ['stepFrames', 90]],
    pose: { yaw_deg: 0, pitch_deg: 0, eye_m: 1.6, fov: 80 }, time: 11,
  },
];

const out = [];
for (const s of specs) {
  const { name, claim, ...rest } = s;
  try {
    const shot = await capture({ evidence_of: 'appearance', claim, width: 1280, height: 720, ...rest });
    const dest = path.join(SHOTS, `${name}.png`);
    fs.copyFileSync(shot.path, dest);
    out.push({ name, path: path.relative(ROOT, dest), cached: !!shot.cached, bytes: fs.statSync(dest).size });
    console.log(`OK   ${name}  (${fs.statSync(dest).size} bytes, cached=${!!shot.cached})`);
  } catch (e) {
    out.push({ name, error: String((e && e.message) || e).slice(0, 400) });
    console.log(`FAIL ${name}: ${String((e && e.message) || e).slice(0, 300)}`);
  }
}
fs.mkdirSync(path.join(ROOT, 'reports/w1-04-r5'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/w1-04-r5/shots.json'), JSON.stringify({ when: new Date().toISOString(), shots: out }, null, 2));
process.exit(out.some((o) => o.error) ? 1 : 0);
