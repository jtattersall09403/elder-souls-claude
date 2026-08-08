#!/usr/bin/env node
/*
 * CRITIC W1-04 r4 — the pictures. Through the POOLED capture daemon (RULES.md rule 20), so this
 * launches no browser of its own. Every spec is `evidence_of: 'appearance'` (ARBITRATION S34):
 * none of these is offered as evidence that anybody walked anywhere.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { capture } = await import(path.join(ROOT, 'tools/capture/client.mjs'));
const SHOTS = path.join(ROOT, 'docs/shots');
fs.mkdirSync(SHOTS, { recursive: true });

const specs = [
  {
    name: '2026-08-08-w1-04-r4-critic-archon-roofs-now-close-the-boxes',
    claim: 'Archon from above: after round 4 every one of the 202 buildings has a roof deck that covers its own footprint. Round 3 left 62 of them open-topped trays.',
    place: { x: 3800, z: 3846 }, pose: { yaw_deg: 0, pitch_deg: 78, eye_m: 62, fov: 70 }, time: 11,
  },
  {
    name: '2026-08-08-w1-04-r4-critic-blackrose-the-terraced-street',
    claim: 'Blackrose: the per-axis shrink turns a swallowed block into a terrace — buildings narrow on one axis and keep their depth, 12.94 x 4.34 m, instead of round 3 shrinking both axes together.',
    // SURVEYED, not guessed — the mistake the round-3 critic and the round-4 builder each made
    // once. `insideBuilding()` says this point is 1.5 m clear of every wall in the drawn plan,
    // the nearest facade is 13.8 m away, and all 22 of Blackrose's buildings fall inside a
    // 60-degree cone on this heading.
    place: { x: 1857.5, z: 4484 }, pose: { yaw_deg: 125.3, pitch_deg: -2, eye_m: 1.7, fov: 75 }, time: 10,
  },
  {
    name: '2026-08-08-w1-04-r4-critic-vp04-new-pose',
    claim: "VP04's new surveyed pose in Thorn — the round-3 verdict condemned the old one for standing inside thorn-sapwell. This is what the moved viewpoint sees.",
    viewpoint: 'VP04-settlement-street',
  },
  {
    // SURVEYED the same way as the Blackrose shot: 1.5 m clear of every wall, nearest facade
    // 14.1 m, all 22 Archon buildings inside a 60-degree cone on this heading. `archon-market`
    // is the nearest facade on the left of frame.
    name: '2026-08-08-w1-04-r4-critic-archon-street-and-no-street',
    claim: 'Archon from a surveyed standing point in the town: the shrunk terraces read as buildings, and the ground between them is undifferentiated terrain — there is still no paving, yard or street surface of any kind.',
    place: { x: 3827, z: 3869.5 }, pose: { yaw_deg: 222.4, pitch_deg: -2, eye_m: 1.7, fov: 75 }, time: 11,
  },
  {
    name: '2026-08-08-w1-04-r4-critic-archon-market-inside',
    claim: 'archon-market from inside: the room the join cut from 13.6 x 15.6 m to 7.3 x 4.98 m, keeping 17.1% of its declared area. Four of its nine distinct declared lamps now stand outside these walls.',
    ops: [['enterInterior', 'archon-market'], ['stepFrames', 30]],
    pose: { yaw_deg: 0, pitch_deg: 0, eye_m: 1.6, fov: 80 }, time: 11,
  },
  {
    // The declared doorstep of `archon-guild-office`, verbatim from
    // `continuity.exterior_spawn`. `insideBuilding()` returns `archon-guild-office` for this
    // point, and the live L6 sweep lands the body here through `exitInterior()`. Standing here
    // and looking at the entry wall is what walking out of that door shows you.
    name: '2026-08-08-w1-04-r4-critic-walking-out-leaves-you-inside-the-building',
    claim: "The declared doorstep of archon-guild-office is the building's own centre point, so leaving the room puts the player inside the exterior shell, under the roof this round added. 39 of 40 doors tested do this.",
    place: { x: 3785, z: 3791.3 },
    pose: { yaw_deg: 0, pitch_deg: 4, eye_m: 1.7, fov: 85 }, time: 12,
  },
  {
    name: '2026-08-08-w1-04-r4-critic-the-same-doorstep-looking-back',
    claim: 'The same declared doorstep of archon-guild-office, turned 180 degrees: four walls and a roof in every direction, because the doorstep is inside the building.',
    place: { x: 3785, z: 3791.3 },
    pose: { yaw_deg: 180, pitch_deg: 4, eye_m: 1.7, fov: 85 }, time: 12,
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
    out.push({ name, error: String(e && e.message || e).slice(0, 300) });
    console.log(`FAIL ${name}: ${String(e && e.message || e).slice(0, 200)}`);
  }
}
fs.mkdirSync(path.join(ROOT, 'reports/critic-w1-04-r4'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/critic-w1-04-r4/shots.json'), JSON.stringify({ when: new Date().toISOString(), shots: out }, null, 2));
console.log(`\n${out.filter((o) => !o.error).length} of ${out.length} shots taken.`);
