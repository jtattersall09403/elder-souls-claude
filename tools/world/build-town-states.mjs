#!/usr/bin/env node
// build-town-states.mjs — one bootable state per settlement, standing in the town itself.
//
// GAP-W1-quest-givers-not-in-the-world. Four of the eight settlements had no bootable state at
// all, so half the quest givers in the build had nowhere to be even once `populateSettlement()`
// could be reached: the W1-19 round-2 verdict noted that Aveline Rell offers the topics "the road
// to Blackrose" and "the road to Gideon" and neither Blackrose nor Gideon is a place this build
// can boot.
//
// A `town-<id>` state stands the player on the street AT THE TOWN'S OWN WORLD COORDINATES — which
// none of the four pre-existing town states do; every one of them is a scene assembled at the
// world origin with its people placed by hand. That is why they could hold twelve people between
// them and no more: a hand-placed scene is exactly as populated as somebody remembered to type.
// These states name their settlement and let the town's own records fill it.
//
//   node tools/world/build-town-states.mjs [--dry]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const SDIR = path.join(ROOT, 'game/data/world/settlements');
const OUT = path.join(ROOT, 'game/data/states');

// Where on the street to stand, and at what hour. Noon-ish, so the working day has people at
// their posts rather than in their beds — a town photographed at 03:00 is empty and correct.
const HOUR = 12.5;

const NDIR = path.join(ROOT, 'game/data/npcs');
const recs = [];
for (const f of fs.readdirSync(NDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  for (const n of JSON.parse(fs.readFileSync(path.join(NDIR, f), 'utf8')).npcs || []) recs.push(n);
}

const written = [];
for (const f of fs.readdirSync(SDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const s = JSON.parse(fs.readFileSync(path.join(SDIR, f), 'utf8'));
  const posts = recs.filter((r) => r.post && r.post.settlement === s.id);
  // Stand where the people are: the centroid of this town's posts, a couple of paces back, so
  // the frame a screenshot takes has somebody in it rather than a wall.
  let px = s.pos[0], pz = s.pos[2];
  if (posts.length) {
    px = posts.reduce((a, r) => a + r.post.pos[0], 0) / posts.length;
    pz = posts.reduce((a, r) => a + r.post.pos[2], 0) / posts.length;
  }
  const yaw = Math.round(((Math.atan2(px - s.pos[0], pz - s.pos[2]) * 180) / Math.PI + 180 + 360) % 360);
  const state = {
    schema: 'elder-souls/state@1',
    id: `town-${s.id}`,
    owner: 'W1-GIVER-PRESENCE — GAP-W1-quest-givers-not-in-the-world',
    title: `${s.name} at midday, standing in the town itself. Nobody is placed here by hand: `
      + `env.settlement names the town and Engine.populateSettlement() spawns everyone whose record `
      + `says they live in it, at the cell the clock has them in. ${posts.length} of them are quest `
      + `givers standing at an authored post outside a real building's door.`,
    generated_by: 'tools/world/build-town-states.mjs',
    env: {
      timeOfDay: HOUR,
      weather: 'clear',
      region: s.region,
      settlement: s.id,
      interior: null,
    },
    player: { pos: [Math.round(px * 100) / 100, Math.round(s.pos[1] * 100) / 100, Math.round(pz * 100) / 100], yaw },
    camera: { yaw, pitch: -4.0, mode: 'free' },
    npcs: [],
    props: [],
    spawn: [],
  };
  const file = path.join(OUT, `town-${s.id}.json`);
  if (!DRY) fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
  written.push({ id: state.id, settlement: s.id, posts: posts.length, pos: state.player.pos });
}

for (const w of written) console.log(`${w.id.padEnd(20)} ${String(w.posts).padStart(2)} posted givers   player at ${JSON.stringify(w.pos)}`);
console.log(`${written.length} town states ${DRY ? 'would be ' : ''}written`);
