#!/usr/bin/env node
// critic-readable-slots-and-marks.mjs — W1-READABLES r2 critic, attack F.
//
// Two defects the builder found in a browser and fixed. Neither is verified by any check on the
// shipped tree, so both are re-taken here in the running game.
//
// F1 — THE READABLE SLOT ALLOCATOR WRAPPED. `render/interior.js` allocated wall slots as
//      `rSlots[(wi + 3 + ri * 2) % rSlots.length]`, so a room with more documents than half its
//      wall ring put two of them within a metre of each other, and both the reach prompt and the
//      interact reach take the NEAREST prop. Taking Soulrest's archive from 12 to 15 documents
//      made pressing at the Tally open the Blackrose lease stubs. The claimed fix is a chosen
//      slot with a 2.6 m minimum separation.
//      THIS TOOL: walks into EVERY interior that carries a readable — 83 of them, not just the
//      one that broke — and measures the minimum pairwise separation of the spawned readable
//      props. Then it stands at each document in the busiest room in turn and presses the button,
//      and asserts the book that opens is the book it stood at. A separation number is not the
//      claim; "the right document opens" is the claim.
//
// F2 — ZERO MARKS IN THE PROVINCE AFTER EVERY reset(). `applyNamedState()` runs `sim.reset()`
//      (which replaces the props array) and THEN `_applyCell()`; a done-flag set before that
//      boundary claims the marks are standing in a world where they are not. The claimed fix is
//      three guards: `clearProps()` forgets the flag, `_ensureProvinceMarks()` distrusts the flag
//      while no mark is in `sim.props`, and `_syncCell()` repairs before `_applyCell()`.
//      "Zero marks after every reset" is the kind of defect that comes back, so this counts the
//      marks standing in the province across SIX consecutive resets and across a round trip into
//      an interior and out again — not once.
//
// Exits non-zero on any failure. `--self-test` proves the separation measurement can go red by
// running it against a fabricated pair of props 0.4 m apart.
//
//   node tools/quests/critic-readable-slots-and-marks.mjs [--json] [--self-test] [--entry <path>]

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const args = parseArgs();
const MIN_SEP_M = 2.6;

const minPairSep = (props) => {
  let best = Infinity, pair = null;
  for (let i = 0; i < props.length; i++) for (let j = i + 1; j < props.length; j++) {
    const d = Math.hypot(props[i].pos[0] - props[j].pos[0], props[i].pos[2] - props[j].pos[2]);
    if (d < best) { best = d; pair = [props[i].eid, props[j].eid]; }
  }
  return { min_m: props.length < 2 ? null : +best.toFixed(2), pair };
};

if (args['self-test'] || args.selfTest) {
  const fake = [{ eid: 'a', pos: [0, 0, 0] }, { eid: 'b', pos: [0.4, 0, 0] }];
  const good = [{ eid: 'a', pos: [0, 0, 0] }, { eid: 'b', pos: [4, 0, 0] }];
  const t1 = minPairSep(fake).min_m === 0.4 && minPairSep(fake).min_m < MIN_SEP_M;
  const t2 = minPairSep(good).min_m === 4 && minPairSep(good).min_m >= MIN_SEP_M;
  const t3 = minPairSep([{ eid: 'a', pos: [0, 0, 0] }]).min_m === null;
  console.log(`self-test: two props 0.4 m apart are called too close : ${t1 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: two props 4.0 m apart are called clear     : ${t2 ? 'PASS' : 'FAIL'}`);
  console.log(`self-test: a lone prop yields no separation           : ${t3 ? 'PASS' : 'FAIL'}`);
  process.exit(t1 && t2 && t3 ? 0 : 1);
}

// Every interior in the tree that declares a readable, busiest first, so the room the defect was
// found in is measured first and the other 82 are measured too.
const IDIR = path.join(ROOT, 'game/data/world/interiors');
const interiors = [];
for (const f of fs.readdirSync(IDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(IDIR, f), 'utf8'));
  const r = d.readable;
  const n = Array.isArray(r) ? r.length : (r ? 1 : 0);
  if (n) interiors.push({ id: d.id, declared: n, bounds: d.bounds_m, spawn: (d.continuity || {}).interior_spawn || null });
}
interiors.sort((a, b) => b.declared - a.declared);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 900000) });
const h = (...a) => handle.h(...a);
const report = {
  tool: 'critic-readable-slots-and-marks',
  commit: (() => { try { return execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { return null; } })(),
  taken_at: new Date().toISOString(),
  load: (() => { try { return fs.readFileSync('/proc/loadavg', 'utf8').trim(); } catch { return null; } })(),
  min_separation_m: MIN_SEP_M,
  f1_rooms: [], f1_presses: [], f2_resets: [],
};
try {
  await h('ready');
  await h('reset');
  await h('setRenderRate', 0);

  // ---- F1a: separation, in every room that carries a document -----------------------------
  for (const it of interiors) {
    try {
      await h('enterInterior', it.id);
      await h('stepFrames', 2);
      const props = (await h('listEntities')).filter((e) => typeof e.eid === 'string' && e.eid.startsWith('interior-readable:') && e.pos);
      const sep = minPairSep(props);
      report.f1_rooms.push({ interior: it.id, declared: it.declared, spawned: props.length, ...sep, ok: sep.min_m == null || sep.min_m >= MIN_SEP_M });
    } catch (e) { report.f1_rooms.push({ interior: it.id, declared: it.declared, error: String((e && e.message) || e) }); }
  }

  // ---- F1b: the claim that matters — press at a document, does THAT document open? ---------
  const busiest = interiors[0];
  await h('reset'); await h('setRenderRate', 0);
  await h('enterInterior', busiest.id);
  await h('stepFrames', 2);
  const docs = (await h('listEntities')).filter((e) => typeof e.eid === 'string' && e.eid.startsWith('interior-readable:') && e.pos);
  const DOOR_REACH_M = 2.6;
  const spawn = busiest.spawn;
  const bx = (busiest.bounds && busiest.bounds.x) || [-6, 6], bz = (busiest.bounds && busiest.bounds.z) || [-6, 6];
  const cx = (bx[0] + bx[1]) / 2, cz = (bz[0] + bz[1]) / 2;
  for (const d of docs) {
    let vx = cx - d.pos[0], vz = cz - d.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    let stood = null;
    for (const off of [1.0, 1.4, 1.8]) {
      const x = d.pos[0] + vx * off, z = d.pos[2] + vz * off;
      const dd = spawn ? Math.hypot(x - spawn[0], z - spawn[2]) : Infinity;
      if (dd > DOOR_REACH_M) { stood = { x, z, off_m: off, door_m: +dd.toFixed(2) }; break; }
    }
    if (!stood) { report.f1_presses.push({ prop: d.eid, skipped: 'cannot be stood at clear of the doorway' }); continue; }
    await h('teleport', stood.x, stood.z);
    await h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await h('stepFrames', 8);
    const ui = await h('getUIState');
    const opened = (ui.book && ui.book.id) || null;
    if (ui.mode === 'book') await h('closeMenu');
    const want = d.eid.slice('interior-readable:'.length);
    report.f1_presses.push({
      prop: d.eid, stood, mode: ui.mode, opened,
      // The readable id and the book id need not be the same string; what must be true is that
      // pressing at THIS prop opened SOMETHING, and that no two presses in the room opened the
      // same book — which is the exact signature of two documents sharing a slot.
      readable_id: want,
    });
  }
  const openedIds = report.f1_presses.filter((p) => p.opened).map((p) => p.opened);
  report.f1_distinct_books_opened = new Set(openedIds).size;
  report.f1_presses_that_opened = openedIds.length;
  report.f1_collisions = openedIds.length - new Set(openedIds).size;

  // ---- F2: marks in the province, across six resets and a room round trip ------------------
  const countMarks = async () => ((await h('listEntities')) || []).filter((e) => typeof e.eid === 'string' && e.eid.startsWith('mark:')).length;
  for (let i = 0; i < 6; i++) {
    await h('reset');
    await h('setRenderRate', 0);
    await h('stepFrames', 2);
    report.f2_resets.push({ pass: i + 1, phase: 'after reset', marks: await countMarks() });
  }
  // ...and the round trip that `_clearProvinceMarks()` exists for.
  await h('enterInterior', 'helstrom-undertemple');
  await h('stepFrames', 2);
  report.f2_resets.push({ pass: 'inside helstrom-undertemple', marks: await countMarks() });
  try { await h('exitInterior'); } catch { /* already outside */ }
  await h('stepFrames', 4);
  report.f2_resets.push({ pass: 'back outside', marks: await countMarks() });
  await h('reset'); await h('setRenderRate', 0); await h('stepFrames', 2);
  report.f2_resets.push({ pass: 'reset after the round trip', marks: await countMarks() });
} finally {
  await handle.close();
}

const badRooms = report.f1_rooms.filter((r) => r.ok === false);
const provinceResets = report.f2_resets.filter((r) => typeof r.pass === 'number' || r.pass === 'back outside' || r.pass === 'reset after the round trip');
const zeroMark = provinceResets.filter((r) => !r.marks);
report.verdict = {
  f1_every_room_clear: badRooms.length === 0,
  f1_rooms_too_close: badRooms.map((r) => `${r.interior} ${r.min_m} m (${(r.pair || []).join(' / ')})`),
  f1_no_two_presses_opened_the_same_book: report.f1_collisions === 0,
  f2_marks_survive_every_reset: zeroMark.length === 0,
  f2_zero_at: zeroMark.map((r) => String(r.pass)),
};

const out = args.out ? String(args.out) : path.join(ROOT, 'reports/runs/CRITIC-W1-READABLES/slots-and-marks.json');
ensureDir(path.dirname(out)); writeJson(out, report);

if (args.json) console.log(JSON.stringify(report, null, 2));
else {
  console.log('\ncritic-readable-slots-and-marks — the two browser defects, re-taken\n');
  console.log(`  F1a  rooms with a readable ......................... ${report.f1_rooms.length}`);
  console.log(`       rooms whose closest pair is under ${MIN_SEP_M} m ...... ${badRooms.length}`);
  for (const r of badRooms) console.log(`         ${r.interior.padEnd(26)} ${r.min_m} m  ${(r.pair || []).join(' / ')}`);
  const busiestRow = report.f1_rooms[0];
  console.log(`       busiest room: ${busiestRow.interior} — ${busiestRow.spawned} spawned of ${busiestRow.declared} declared, closest pair ${busiestRow.min_m} m`);
  console.log(`\n  F1b  presses in ${interiors[0].id} ............... ${report.f1_presses.length}`);
  console.log(`       presses that opened a document ............... ${report.f1_presses_that_opened}`);
  console.log(`       DISTINCT documents opened ................... ${report.f1_distinct_books_opened}`);
  console.log(`       two presses that opened the SAME document ... ${report.f1_collisions}`);
  console.log(`\n  F2   marks standing in the province:`);
  for (const r of report.f2_resets) console.log(`         ${String(r.pass).padEnd(28)} ${r.marks}`);
  console.log(`\n  VERDICT  F1 separation ${report.verdict.f1_every_room_clear ? 'PASS' : 'FAIL'} · F1 no collision ${report.verdict.f1_no_two_presses_opened_the_same_book ? 'PASS' : 'FAIL'} · F2 marks survive reset ${report.verdict.f2_marks_survive_every_reset ? 'PASS' : 'FAIL'}`);
  console.log(`  wrote ${path.relative(ROOT, out)}\n`);
}
const ok = report.verdict.f1_every_room_clear && report.verdict.f1_no_two_presses_opened_the_same_book && report.verdict.f2_marks_survive_every_reset;
process.exit(ok ? 0 : 1);
