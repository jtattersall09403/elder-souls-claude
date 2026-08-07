#!/usr/bin/env node
// `RI-WLD12` M66 — is a jump in danger announced BEFORE the player is in it?
//
// M66's shape: where the danger tier rises by two or more, the crossing must be announced on more
// than one channel, and the first hostile encounter beyond the border must be at least 40 m past
// it — because an announcement the player cannot act on is not an announcement. `borders.json`
// declares all three parts on all seven of the province's big jumps: `announcement.channels`,
// `announcement.remains`, and `announcement.first_hostile_min_m: 40`.
//
// THE POINT OF THIS FILE. The first two are now real — round 2 gave the threshold objects and the
// remains meshes and made them solid, and `threshold-consumption.mjs` measures that. The THIRD was
// never read by anything: `grep -rn first_hostile_min_m game/ tools/` returns exactly one hit, the
// line in `build-borders.mjs` that WRITES it. So this measures it against the population the game
// actually spawns, and it is not a check that passes today — see T3.
//
// It deliberately does not fix what it finds. The posts belong to `population-posts.json`, which is
// another piece's build output and was being rewritten during this session; a silent nudge to five
// of its rows would be a change nobody could see and nobody agreed to. A measured, named, re-runnable
// failure is worth more than a quiet edit, and this tool is the handover.
'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { BorderField } from '../../game/src/world/borders.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const doc = R('game/data/world/borders.json');
const bf = new BorderField(doc, R('game/data/world/regions.json').regions);
const posts = R('game/data/world/population-posts.json').posts || [];

const checks = [];
const add = (name, pass, detail) => checks.push({ check: name, pass: !!pass, detail });

// Every border where the tier moves by two or more, in either direction.
const jumps = doc.borders.filter((b) => Math.abs(b.delta_tier) >= 2);

// ---- T1: every big jump carries an announcement, on two channels --------------------------------
const unannounced = jumps.filter((b) => !b.announcement || (b.announcement.channels || []).length < 2);
add('T1 every tier jump of 2 or more is announced on at least two channels',
  jumps.length > 0 && unannounced.length === 0, {
    jumps: jumps.length,
    bar: 'RI-WLD12 M66: more than one channel',
    unannounced: unannounced.map((b) => b.id),
    rows: jumps.map((b) => ({
      border: b.id, delta_tier: b.delta_tier, higher: b.announcement && b.announcement.higher,
      channels: (b.announcement && b.announcement.channels) || [],
      remains: !!(b.announcement && b.announcement.remains),
      threshold_type: b.threshold_type,
    })),
  });

// ---- T2: both channels are now things in the world, not strings ---------------------------------
// The threshold objects and the remains are drawn and collidable as of W1-02 round 2; here we only
// confirm every announced border actually HAS instances placed, since a channel with nothing on
// the ground is the failure this whole round was about.
const emptyChannel = [];
for (const b of jumps) {
  const objs = (b.threshold_objects || []).length;
  const rem = !!(b.announcement && b.announcement.remains);
  if (objs === 0 || !rem) emptyChannel.push({ border: b.id, objects: objs, remains: rem });
}
add('T2 both declared channels have something standing on the ground',
  emptyChannel.length === 0, {
    note: 'the meshes are measured by tools/world/threshold-consumption.mjs and threshold-live.mjs',
    borders_with_an_empty_channel: emptyChannel,
    total_objects_on_jump_borders: jumps.reduce((a, b) => a + (b.threshold_objects || []).length, 0),
  });

// ---- T3: the first hostile beyond the border ----------------------------------------------------
// For each announced jump, find the nearest hostile post on the HIGHER-tier side that is inside
// this border's own band, and measure how far past the frontier line it stands.
const rows = [];
for (const b of jumps) {
  const an = b.announcement;
  if (!an) continue;
  const need = an.first_hostile_min_m;
  let nearest = null;
  for (const p of posts) {
    if (p.region !== an.higher) continue;
    const s = bf.at(p.x, p.z);
    if (!s || s.border.id !== b.id) continue;
    const d = Math.abs(s.distance_m);
    if (!nearest || d < nearest.distance_m) {
      nearest = { post: p.id, encounter: p.encounter, tier: p.tier, x: p.x, z: p.z, distance_m: +d.toFixed(2), bodies: p.bodies };
    }
  }
  rows.push({
    border: b.id, delta_tier: b.delta_tier, higher: an.higher,
    declared_min_m: need,
    nearest_hostile: nearest,
    clears: nearest === null ? null : nearest.distance_m >= need,
  });
}
const measured = rows.filter((r) => r.nearest_hostile);
const violations = measured.filter((r) => !r.clears);
add('T3 the first hostile beyond a tier border stands at least first_hostile_min_m past it',
  measured.length > 0 && violations.length === 0, {
    declared_by: 'game/data/world/borders.json announcement.first_hostile_min_m',
    read_by_before_this_tool: 'nothing — tools/world/build-borders.mjs writes it and no consumer reads it',
    jump_borders: rows.length,
    measurable: measured.length,
    no_hostile_in_band: rows.length - measured.length,
    violations: violations.length,
    rows,
    what_this_means: violations.length
      ? 'the announcement has no room to work: the player meets the higher tier at the same step '
        + 'they read the warning. The fix belongs to whoever owns population-posts.json — push '
        + 'these posts back along the border gradient until they clear the declared distance.'
      : 'every announced jump gives the player ground between the warning and the consequence',
  });

// ---- report --------------------------------------------------------------------------------------
const passed = checks.filter((c) => c.pass).length;
const out = {
  tool: 'tools/world/tier-announcement.mjs', owner: 'W1-02', item: 'RI-WLD12 M66',
  at: new Date().toISOString(), passed, of: checks.length,
  known_failing: violations.length ? ['T3'] : [],
  checks,
};
writeFileSync(resolve(ROOT, 'reports/tier-announcement.json'), JSON.stringify(out, null, 2));
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.check}`);
if (violations.length) {
  console.log('\nT3 violations:');
  for (const r of violations) {
    console.log(`  ${r.border}  dtier ${r.delta_tier}  first hostile "${r.nearest_hostile.encounter}" `
      + `at ${r.nearest_hostile.distance_m} m (needs ${r.declared_min_m} m)  [${r.nearest_hostile.post}]`);
  }
}
console.log(`\ntier-announcement: ${passed}/${checks.length} -> reports/tier-announcement.json`);
// Exits 0 with a declared known-failing check rather than red, because T3's subject is another
// piece's data file and this tool is a handover, not a gate. `known_failing` is the honest signal.
process.exit(0);
