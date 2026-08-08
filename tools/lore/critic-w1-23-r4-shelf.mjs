#!/usr/bin/env node
/**
 * critic-w1-23-r4-shelf.mjs — CRITIC instrument, W1-23 round 4. Written by the critic.
 *
 * Two things `critic-w1-23-r4-onscreen.mjs` could not answer from twelve legs, plus the picture.
 *
 * 1. CROWDING. `render/interior.js` allocates a wall slot per document with a 2.6 m minimum
 *    separation and a documented fallback: "A room that still cannot fit them all keeps the old
 *    wrapping behaviour for the remainder, which is a crowded shelf and not a crash." Round 4 put
 *    110 texts into 50 rooms, and `Engine._reachPrompt` and the interact reach both take the
 *    NEAREST prop — so two documents inside one reach radius means one of them can never be
 *    opened, however correctly it is placed. The rooms at risk are the loaded ones, and this walks
 *    every readable in them and measures the real pairwise separation in the built room.
 *
 * 2. WHETHER EVERY DOCUMENT IN A LOADED ROOM CAN ACTUALLY BE OPENED. Placement is per book;
 *    reachability is per room. Fifteen documents in one archive is the case where they differ.
 *
 * 3. One screenshot of an opened book, because whether words reach the screen was an open
 *    question in this piece and a picture of the answer is cheap.
 *
 * Prohibited, asserted over this file's own bytes: the harness door into the book screen and the
 * documented engine back door. Every book here is opened by standing at it and pressing interact.
 *
 * Run:  node tools/lore/critic-w1-23-r4-shelf.mjs [--shot <png>] [--out <json>]
 * Exit: 0 if every readable in every room examined is separately openable. 1 otherwise.
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
  const body = fs.readFileSync(SELF, 'utf8').split('\n')
    .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.includes('PROHIBITED')).join('\n');
  const PROHIBITED = ['openMenu', '__ENGINE'];
  for (const p of PROHIBITED) {
    if (body.includes(`'${p}'`) || body.includes(`"${p}"`) || body.includes(`.${p}(`)) {
      console.error(`this tool names the prohibited verb ${p}. Refusing to report.`); process.exit(2);
    }
  }
}

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(args.out || 'reports/w1-23-r4/critic-shelf.json'));
const SHOT = args.shot ? path.resolve(ROOT, String(args.shot)) : null;
const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

// The loaded rooms, chosen by counting the shipped records rather than by picking favourites.
const IDIR = path.join(ROOT, 'game/data/world/interiors');
const loaded = [];
for (const f of fs.readdirSync(IDIR)) {
  if (!f.endsWith('.json')) continue;
  const rec = JSON.parse(fs.readFileSync(path.join(IDIR, f), 'utf8'));
  const list = (Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : [])).filter((r) => r && r.book);
  if (list.length >= 4) loaded.push({ room: f.replace(/\.json$/, ''), books: list.map((r) => r.book) });
}
loaded.sort((a, b) => b.books.length - a.books.length);
const ROOMS = loaded.slice(0, 6);
if (!ROOMS.length) { console.error('FATAL: no room carries four or more documents — nothing to crowd.'); process.exit(2); }

const handle = await launchGame({ ...args });
const rooms = [];
try {
  await requireMethods(handle, ['reset', 'setRenderRate', 'enterInterior', 'listEntities', 'teleport',
    'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'whereAmI', 'renderFrame', 'renderedTextClear', 'getRenderedText']);

  for (const R of ROOMS) {
    const out = { room: R.room, declared: R.books.length, spawned: 0, min_separation_m: null, pairs_within_reach: [], openable: 0, failures: [] };
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    try { await handle.h('enterInterior', R.room); } catch (e) { out.note = `enterInterior threw: ${e.message}`; rooms.push(out); continue; }
    await handle.h('stepFrames', 2);
    const ents = await handle.h('listEntities');
    const docs = (Array.isArray(ents) ? ents : []).filter((e) => e && e.readable_book);
    out.spawned = docs.length;

    let minSep = Infinity;
    for (let i = 0; i < docs.length; i++) for (let j = i + 1; j < docs.length; j++) {
      const d = Math.hypot(docs[i].pos[0] - docs[j].pos[0], docs[i].pos[2] - docs[j].pos[2]);
      if (d < minSep) minSep = d;
      const reach = Math.max(docs[i].reach_m || 1.6, docs[j].reach_m || 1.6);
      if (d < reach) out.pairs_within_reach.push({ a: docs[i].readable_book, b: docs[j].readable_book, m: +d.toFixed(2), reach });
    }
    out.min_separation_m = Number.isFinite(minSep) ? +minSep.toFixed(2) : null;

    const where = await handle.h('whereAmI');
    const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
    const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
    for (const d of docs) {
      let vx = cx - d.pos[0], vz = cz - d.pos[2];
      const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
      await handle.h('teleport', d.pos[0] + vx * 1.0, d.pos[2] + vz * 1.0);
      await handle.h('renderedTextClear');
      await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
      await handle.h('stepFrames', 8);
      await handle.h('renderFrame');
      const ui = await handle.h('getUIState');
      const opened = (ui && ui.book && ui.book.id) || null;
      const t = await handle.h('getRenderedText');
      const chars = ((Array.isArray(t) ? t : (t && t.distinct) || []).join('\n')).length;
      if (opened === d.readable_book && chars > 200) out.openable++;
      else out.failures.push({ want: d.readable_book, got: opened, chars });
      if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
    }
    rooms.push(out);
  }

  if (SHOT) try {
    const R = ROOMS.find((r) => r.room === 'lilmoth-customs') || ROOMS[0];
    const book = R.room === 'lilmoth-customs' ? 'the-blessings-of-the-coast' : R.books[0];
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    await handle.h('enterInterior', R.room);
    await handle.h('stepFrames', 2);
    const ents = await handle.h('listEntities');
    const d = (Array.isArray(ents) ? ents : []).find((e) => e && e.readable_book === book);
    if (d) {
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
      await handle.page.screenshot({ path: SHOT, timeout: 120000, animations: 'disabled', caret: 'hide' });
      console.log(`shot: ${path.relative(ROOT, SHOT)} — ${book} open in ${R.room}`);
    } else console.error('shot: the book was not in the room; no picture taken');
  } catch (e) { console.error(`shot failed (the census above is unaffected): ${e.message}`); }
} finally { await handle.close(); }

const bad = rooms.filter((r) => r.openable !== r.spawned || r.pairs_within_reach.length);
const report = { commit, rooms, pass: bad.length === 0 };
ensureDir(path.dirname(OUT));
writeJson(OUT, report);

console.log(`\ncommit ${commit}`);
for (const r of rooms) {
  console.log(`  ${r.room.padEnd(24)} declared ${String(r.declared).padStart(2)}  spawned ${String(r.spawned).padStart(2)}  `
    + `min separation ${r.min_separation_m ?? '-'} m  separately openable ${r.openable}/${r.spawned}`);
  for (const p of r.pairs_within_reach) console.log(`      WITHIN ONE REACH: ${p.a} and ${p.b} are ${p.m} m apart (reach ${p.reach} m)`);
  for (const f of r.failures) console.log(`      COULD NOT OPEN: wanted ${f.want}, got ${f.got || '(nothing)'} (${f.chars} chars drawn)`);
}
console.log(report.pass
  ? 'SHELF: every document in every loaded room is separately reachable and separately openable.'
  : 'SHELF: some documents cannot be opened where they stand.');
process.exit(report.pass ? 0 : 1);
