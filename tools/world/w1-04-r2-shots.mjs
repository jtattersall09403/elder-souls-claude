#!/usr/bin/env node
/**
 * w1-04-r2-shots.mjs — the pictures for W1-04 round 2.
 *
 * The round-1 critic took two captures, of an alchemist's shop in Archon and a rotted great-hall
 * in a village four kilometres away, and they were the same room: "same hearth, same benches,
 * same beams, same door frame. The only difference between the two frames is which people are
 * standing in it." They also had to be STAGED, through `state: "interior_firelit"`, because
 * `ops: [["enterInterior", ...]]` alone photographed the exterior — the door changed nothing
 * about what was drawn.
 *
 * So both of those are what this has to answer, and it answers them the honest way: the same two
 * buildings, entered THROUGH THE DOOR with `ops`, no staging state, no `interior_firelit`, and
 * nobody in the room — because the round-1 pair differed only in who was standing in it and a
 * pair that differs only in its cast would prove nothing a second time.
 *
 *   node tools/world/w1-04-r2-shots.mjs
 *
 * Pictures go to docs/shots/ with dated descriptive names (RULES.md rule 27) and through
 * `tools/capture/` rather than a browser of my own (rule 20).
 */
import { capture } from '../capture/client.mjs';
import { log } from '../lib/cli.mjs';

// One camera pose, used for every frame. If the pose moved between shots, a difference between
// two pictures would be a difference of viewpoint rather than of room.
const POSE = { pos: [0, 1.62, -5.4], look: [0, 1.35, 2.4], fov: 68 };

const SHOTS = [
  {
    interior: 'archon-apothecary',
    file: '2026-08-07-w1-04-r2-archon-apothecary-through-the-door',
    caption: 'The Crimson Apothecary, Archon — entered through its own door, built from its own record: '
      + '18 props, 10 declared lights, a dye-town palette and the arc_* architecture kit.',
  },
  {
    interior: 'thorn-hall',
    file: '2026-08-07-w1-04-r2-thorn-hall-through-the-door',
    caption: 'The Rotted Hall, Thorn — the same camera pose, the same code path, four kilometres away. '
      + 'In round 1 this frame and the one above were the same 249-triangle hall.',
  },
  {
    interior: 'blackrose-prison',
    file: '2026-08-07-w1-04-r2-blackrose-gaol-through-the-door',
    caption: 'Blackrose gaol — windowless by rule (RI-WLD13 N4), iron palette, the bla_* fortress kit.',
  },
];

let failed = 0;
for (const s of SHOTS) {
  try {
    const shot = await capture({
      // NO staging state. The door is the only thing that puts the camera in this room.
      time: 12,
      weather: 'clear',
      width: 1280, height: 720,
      camera: POSE,
      ops: [
        ['setTimeOfDay', 12],
        ['enterInterior', s.interior],
        ['stepFrames', 4],
        // The room, not its cast. The round-1 pair differed ONLY in who was standing in it.
        ['clearNPCs'],
        ['stepFrames', 1],
      ],
      out: `docs/shots/${s.file}.png`,
      evidence_of: 'w1-04 round 2: the door opens on the room the file describes',
      caption: s.caption,
    });
    log(`${s.interior.padEnd(22)} -> ${shot.path}${shot.cached ? '  (cached)' : ''}`);
  } catch (e) {
    failed++;
    log(`${s.interior.padEnd(22)} -> FAILED: ${String(e && e.message ? e.message : e).slice(0, 300)}`);
  }
}
process.exit(failed ? 1 : 0);
