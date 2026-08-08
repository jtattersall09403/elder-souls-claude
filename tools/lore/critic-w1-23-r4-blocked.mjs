#!/usr/bin/env node
/**
 * critic-w1-23-r4-blocked.mjs — CRITIC instrument, W1-23 round 4. Written by the critic.
 *
 * `critic-w1-23-r4-shelf.mjs` walked every document in the six most loaded rooms and found four it
 * could not open: two in `gideon-court`, two in `helstrom-undertemple`. Separation is not the
 * cause — those rooms' minimum document spacing is 3.53 m and 3.32 m, comfortably outside the
 * 2 m interact reach. So a book is placed, drawn, standable-at, and pressing the button does
 * nothing, which is the same outcome for a player as not being placed at all.
 *
 * This file asks why, and it asks it the only way that settles it: stand at the object, press the
 * button, and then read back the world state that decided what the press did — where the player
 * is, where the room's `interior_spawn` is, and what else is inside reach.
 *
 * THE HYPOTHESIS IT IS TESTING, stated before the run so the answer is not fitted to it:
 * `render/interior.js` filters document slots to more than 3.8 m from `continuity.interior_spawn`,
 * with its own comment explaining why — `sim/settlement.js` takes `interact` for the way OUT within
 * `DOOR_REACH_M` = 2.6 m of the spawn, and it takes it BEFORE the engine's prop reach. But the
 * filter is applied to the SLOT, and the player does not stand on the slot: they stand a metre off
 * it, toward the middle of the room. If that metre carries them back inside the door's radius, the
 * door eats the press. The prediction is therefore: the four failing legs have the PLAYER within
 * 2.6 m of the interior spawn while the OBJECT is more than 3.8 m from it.
 *
 * It also takes the screenshot, at a smaller viewport, because the full-size one timed out twice
 * under a loaded box and a picture of an open book is the thing this piece most needs.
 *
 * Prohibited, asserted over this file's own bytes: the harness door into the book screen and the
 * documented engine back door.
 *
 * Run:  node tools/lore/critic-w1-23-r4-blocked.mjs [--shot <png>] [--out <json>]
 * Exit: 0 if every leg either opened or was explained. 1 if a failure is unexplained.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
{
  const PROHIBITED = ['openMenu', '__ENGINE'];
  const body = fs.readFileSync(SELF, 'utf8').split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.includes('PROHIBITED')).join('\n');
  for (const p of PROHIBITED) if (body.includes(`'${p}'`) || body.includes(`"${p}"`) || body.includes(`.${p}(`)) {
    console.error(`this tool names the prohibited verb ${p}. Refusing to report.`); process.exit(2);
  }
}

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(args.out || 'reports/w1-23-r4/critic-blocked.json'));
const SHOT = args.shot ? path.resolve(ROOT, String(args.shot)) : null;
const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();
const DOOR_REACH_M = 2.6;   // sim/settlement.js's number, quoted in render/interior.js's own comment

const LEGS = [
  { room: 'gideon-court', book: 'a-short-account-of-the-pacification' },
  { room: 'gideon-court', book: 'the-legates-seal-register' },
  { room: 'gideon-court', book: 'the-casebook-i' },                        // a control: one in the SAME room that DID open
  { room: 'helstrom-undertemple', book: 'the-coast-survey-line' },
  { room: 'helstrom-undertemple', book: 'the-helstrom-kin-list' },
  { room: 'lilmoth-customs', book: 'the-blessings-of-the-coast' },          // a control in a clean room
];

const spawnOf = (room) => {
  const p = path.join(ROOT, 'game/data/world/interiors', `${room}.json`);
  if (!fs.existsSync(p)) return null;
  const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
  return (rec.continuity && rec.continuity.interior_spawn) || null;
};

const handle = await launchGame({ ...args, width: 1280, height: 720 });
const rows = [];
try {
  await requireMethods(handle, ['reset', 'setRenderRate', 'enterInterior', 'listEntities', 'teleport',
    'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'whereAmI', 'renderFrame', 'renderedTextClear', 'getRenderedText']);

  for (const leg of LEGS) {
    const rec = { ...leg, spawn: spawnOf(leg.room), opened: null, note: null };
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    try { await handle.h('enterInterior', leg.room); } catch (e) { rec.note = `enterInterior threw: ${e.message}`; rows.push(rec); continue; }
    await handle.h('stepFrames', 2);
    const ents = await handle.h('listEntities');
    const prop = (Array.isArray(ents) ? ents : []).find((e) => e && e.readable_book === leg.book);
    if (!prop) { rec.note = 'no prop for that book in this room'; rows.push(rec); continue; }
    rec.prop = { eid: prop.eid, pos: prop.pos, reach_m: prop.reach_m ?? null };

    const where = await handle.h('whereAmI');
    const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
    const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
    let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    const px = prop.pos[0] + vx * 1.0, pz = prop.pos[2] + vz * 1.0;
    await handle.h('teleport', px, pz);
    rec.player = [+px.toFixed(2), +pz.toFixed(2)];

    if (rec.spawn) {
      rec.object_to_spawn_m = +Math.hypot(prop.pos[0] - rec.spawn[0], prop.pos[2] - rec.spawn[2]).toFixed(2);
      rec.player_to_spawn_m = +Math.hypot(px - rec.spawn[0], pz - rec.spawn[2]).toFixed(2);
      rec.player_inside_door_reach = rec.player_to_spawn_m <= DOOR_REACH_M;
    }
    // What else is within reach of where the player is standing?
    const reach = prop.reach_m || 2;
    rec.others_in_reach = (Array.isArray(ents) ? ents : [])
      .filter((e) => e && e.pos && e.eid !== prop.eid && Math.hypot(e.pos[0] - px, e.pos[2] - pz) <= reach)
      .map((e) => ({ eid: e.eid, name: e.name || null, m: +Math.hypot(e.pos[0] - px, e.pos[2] - pz).toFixed(2) }))
      .sort((a, b) => a.m - b.m).slice(0, 6);

    await handle.h('renderedTextClear');
    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 8);
    await handle.h('renderFrame');
    const ui = await handle.h('getUIState');
    rec.opened = (ui && ui.book && ui.book.id) || null;
    rec.mode_after = (ui && ui.mode) || null;
    const w2 = await handle.h('whereAmI');
    rec.interior_after = (w2 && (w2.interior ?? w2.room ?? w2.id)) || null;
    rec.left_the_room = !!(rec.interior_after && String(rec.interior_after) !== leg.room);
    if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
    rows.push(rec);
  }

  if (SHOT) try {
    const leg = { room: 'lilmoth-customs', book: 'the-blessings-of-the-coast' };
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    await handle.h('enterInterior', leg.room);
    await handle.h('stepFrames', 2);
    const ents = await handle.h('listEntities');
    const d = (Array.isArray(ents) ? ents : []).find((e) => e && e.readable_book === leg.book);
    const where = await handle.h('whereAmI');
    const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
    const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
    let vx = cx - d.pos[0], vz = cz - d.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    await handle.h('teleport', d.pos[0] + vx * 1.0, d.pos[2] + vz * 1.0);
    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 10);
    await handle.h('renderFrame');
    ensureDir(path.dirname(SHOT));
    const buf = await handle.page.locator('canvas').first().screenshot({ timeout: 180000 });
    fs.writeFileSync(SHOT, buf);
    console.log(`shot: ${path.relative(ROOT, SHOT)}`);
  } catch (e) { console.error(`shot failed: ${e.message}`); }
} finally { await handle.close(); }

const failures = rows.filter((r) => r.opened !== r.book);
const explained = failures.filter((r) => r.player_inside_door_reach || r.left_the_room);
const report = { commit, door_reach_m: DOOR_REACH_M, rows, summary: { legs: rows.length, failures: failures.length, explained: explained.length } };
ensureDir(path.dirname(OUT));
writeJson(OUT, report);

console.log(`commit ${commit}\n`);
for (const r of rows) {
  console.log(`  ${r.room.padEnd(22)} ${r.book.padEnd(38)} opened:${(r.opened || '(nothing)').padEnd(38)}`);
  console.log(`      object is ${r.object_to_spawn_m ?? '-'} m from the interior spawn; the PLAYER standing at it is `
    + `${r.player_to_spawn_m ?? '-'} m from it  -> inside the ${DOOR_REACH_M} m door reach: `
    + `${r.player_inside_door_reach ? 'YES — the door eats the press' : 'no'}`);
  if (r.left_the_room) console.log(`      AND THE PRESS WALKED THE PLAYER OUT: now in ${r.interior_after}`);
  if (r.others_in_reach && r.others_in_reach.length) {
    console.log(`      also within reach: ${r.others_in_reach.map((o) => `${o.name || o.eid} ${o.m} m`).join(', ')}`);
  }
}
console.log(`\n${failures.length} of ${rows.length} legs did not open their book; ${explained.length} of those are explained by the door taking the press.`);
process.exit(failures.length === explained.length ? 0 : 1);
