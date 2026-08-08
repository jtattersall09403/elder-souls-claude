#!/usr/bin/env node
// critic-w1-23-r5-consume.mjs — CONSUMPTION (RI-MTH07 §B) for the eleven texts ROUND 4 ITSELF WROTE.
//
// WHY THIS TOOL EXISTS AND WHY THE ROUND'S OWN ONE DOES NOT COVER IT.
// `tools/lore/w1-23-r4-consume.mjs` hard-codes its two legs:
//     { room: 'lilmoth-customs',      book: 'the-blessings-of-the-coast' }
//     { room: 'lilmoth-ledger-house', book: 'ledger-and-journal-of-andrel-vorin' }
// Both books pre-date round 4. So the round demonstrated that the LIBRARY MECHANISM reaches a
// screen — which it does — and never once asked whether the ELEVEN TEXTS IT WROTE THIS ROUND do.
// Sixteen subsystems in this project have shipped a correct, instrumented model that nothing in
// the running world reads; "the mechanism works, therefore my new rows are read" is exactly the
// inference RULES #5 forbids. This tool asks the question of the new rows.
//
// FOUR ARMS. The last two are what make the first two mean anything.
//   A SHIPPED     enter the room, stand at the object, press `interact`, read back the id and the
//                 STRINGS THE FRAME ACTUALLY DREW.
//   B PERTURBED   on a copy, put a marker sentence at the head of that book's `text`. The marker
//                 must appear on the screen. If it does not, the room draws a book-shaped box.
//   C CONTROL     same room, same button, standing at reach_m + 3 m. Nothing may open.
//                 RULES #6: a control I have never seen fail is a second copy of the experiment,
//                 so arm C is only counted where arm A opened the same book from the same spot.
//   D DELETE      on a copy, delete the book RECORD outright. The press must open nothing. This is
//                 a stricter teardown than removing the placement: it proves the screen is fed by
//                 the record and not by a string cached in the interior file.
//
// The rendered-text register: round 4 declared `getRenderedText()` structurally blind to the book
// screen. It is not. `ui/system.js` build() short-circuits on a cache key that cannot change while
// a screen is up, so a clear AFTER the press reads an empty register. Clear BEFORE the press.
//
// Run: node tools/lore/critic-w1-23-r5-consume.mjs [--out reports/w1-23-r5/consume.json]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(args.out || 'reports/w1-23-r5/consume.json'));

// The harness has a door that opens a screen directly. Using it would make every arm pass.
// The check is over this file's own bytes.
{
  const body = fs.readFileSync(SELF, 'utf8').split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  for (const p of ['openMenu', '__ENGINE']) {
    if (body.includes(`'${p}'`) || body.includes(`"${p}"`) || body.includes(`.${p}(`)) {
      console.error(`critic-w1-23-r5-consume: names the prohibited verb ${p}. Refusing to report.`);
      process.exit(2);
    }
  }
}

// Six of round 4's own eleven texts, spread over five settlements so one bad room cannot carry
// the number. Room ids read off game/data/world/interiors/ at the commit under test.
const LEGS = [
  { room: 'soulrest-boneyard',     book: 'what-is-sung-going-down' },
  { room: 'gideon-tollhouse',      book: 'the-toll-at-gideon-gate-in-verse' },
  { room: 'thorn-sapwell',         book: 'the-weir-count' },
  { room: 'helstrom-deep-market',  book: 'why-the-mud-crab-carries-his-house' },
  { room: 'blackrose-market',      book: 'the-man-who-sold-his-name' },
  { room: 'gideon-grange',         book: 'what-the-water-took' },
  // Two REGRESSION legs. Round 4's critic found these placed, drawn and inert under the button,
  // beaten to `engine.js`'s nearest-prop test by a `site-marks.json` entry 0.50-0.90 m away.
  // Neither `site-marks.json` nor `place-library.mjs` has been touched since that verdict, so
  // these two are here to say whether the gap is open at my commit rather than to assume it.
  { room: 'gideon-court',          book: 'a-short-account-of-the-pacification', regression: true },
  { room: 'helstrom-undertemple',  book: 'the-helstrom-kin-list', regression: true },
];

const MARK = 'PERTURBATION MARKER W1-23 R5 CRITIC';
const commit = (() => {
  try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; }
})();

// ---- tree copies -------------------------------------------------------------------------------
// Every arm runs on its own copy of the WORKING TREE, including the shipped one, so that a
// neighbour landing an edit mid-run cannot move one arm and not another.
const DROPPED = [];
function copyGame(tag) {
  const dst = path.join(ROOT, 'reports', 'w1-23-r5', `arm-${tag}`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  // `loadData()` throws on the first 404, and a half-landed neighbour edit that names a file not
  // yet on disk takes every arm down. Drop those entries on the copy and print what was dropped.
  const ix = path.join(dst, 'game', 'data', 'index.json');
  if (fs.existsSync(ix)) {
    const j = JSON.parse(fs.readFileSync(ix, 'utf8'));
    const before = (j.files || []).length;
    j.files = (j.files || []).filter((e) => fs.existsSync(path.join(dst, 'game', 'data', e.path)));
    if (before - j.files.length) {
      DROPPED.push(`${before - j.files.length} index entr(ies) naming a file not on disk`);
      fs.writeFileSync(ix, JSON.stringify(j, null, 2) + '\n');
    }
  }
  return path.join(dst, 'game', 'index.html');
}

function eachBookRecord(entry, fn) {
  const dir = path.join(path.dirname(entry), 'data', 'books');
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(j) ? j : (j.books || j.texts || [j]);
    let hit = false;
    for (let i = 0; i < list.length; i++) {
      const r = fn(list[i], list, i);
      if (r) { hit = true; n++; }
    }
    if (hit) fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  }
  return n;
}

/** Arm B: marker sentence at the head of each target book's text. */
const perturb = (entry, ids) => eachBookRecord(entry, (b) => {
  if (!b || !ids.has(b.id)) return false;
  b.text = `${MARK}\n\n${b.text || ''}`;
  return true;
});

/** Arm D: delete the RECORD, not the placement. The prop stays; the text is gone. */
const deleteRecords = (entry, ids) => eachBookRecord(entry, (b, list, i) => {
  if (!b || !ids.has(b.id)) return false;
  list.splice(i, 1, { ...b, id: `${b.id}--deleted-by-r5-critic`, text: '' });
  return true;
});

// ---- one leg -----------------------------------------------------------------------------------
async function runLegs(handle, { farByM = 0 } = {}) {
  const out = [];
  for (const leg of LEGS) {
    const rec = { ...leg, entered: false, prop: null, stood_m: null, opened: null,
                  drawn_chars: 0, marker_on_screen: false, first_line: null, note: null };
    try {
      await handle.h('reset');
      await handle.h('setRenderRate', 0);
      await handle.h('enterInterior', leg.room);
      rec.entered = true;
    } catch (e) { rec.note = `enter: ${e.message}`; out.push(rec); continue; }

    await handle.h('stepFrames', 2);
    const ents = await handle.h('listEntities');
    if (!Array.isArray(ents)) { rec.note = 'listEntities did not return an array'; out.push(rec); continue; }
    const props = ents.filter((e) => e && e.readable_book === leg.book);
    rec.props_in_room = ents.filter((e) => e && e.readable_book).length;
    if (!props.length) { rec.note = 'no prop in this room offers that book'; out.push(rec); continue; }
    const prop = props[0];
    rec.prop = { eid: prop.eid, name: prop.name, reach_m: prop.reach_m ?? null, pos: prop.pos };

    // The nearest OTHER document, because engine.js takes the nearest prop and a rival within a
    // metre is how a placed, drawn book opens something else. Round 4's own critic found four.
    let nearest = null;
    for (const e of ents) {
      if (!e || !e.readable_book || e.eid === prop.eid || !e.pos) continue;
      const d = Math.hypot(e.pos[0] - prop.pos[0], e.pos[2] - prop.pos[2]);
      if (!nearest || d < nearest.m) nearest = { m: +d.toFixed(2), book: e.readable_book };
    }
    rec.nearest_rival = nearest;

    const where = await handle.h('whereAmI');
    const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
    const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
    let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    const d = farByM ? (prop.reach_m || 1.6) + farByM : 1.0;
    await handle.h('teleport', prop.pos[0] + vx * d, prop.pos[2] + vz * d);
    rec.stood_m = +d.toFixed(2);

    // CLEAR BEFORE THE PRESS. build() short-circuits on a cache key that cannot change while a
    // screen is up (the world is paused, ctx.frame stops), so a clear afterwards reads empty and
    // the register looks blind. This is the two-line difference round 4 called unfixable.
    try { await handle.h('renderedTextClear'); } catch (e) { rec.note = `clear: ${e.message}`; }
    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 8);
    await handle.h('renderFrame');

    const ui = await handle.h('getUIState');
    rec.opened = (ui && ui.book && ui.book.id) || null;
    try {
      const t = await handle.h('getRenderedText');
      const rows = Array.isArray(t) ? t : (t && t.text) || [];
      const drawn = rows.map((r) => (typeof r === 'string' ? r : (r && (r.text || r.s)) || '')).join('\n');
      rec.drawn_chars = drawn.length;
      rec.marker_on_screen = drawn.includes(MARK);
      rec.first_line = drawn.split('\n').map((s) => s.trim()).filter(Boolean)[0] || null;
    } catch (e) { rec.note = `getRenderedText: ${e.message}`; }
    if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
    out.push(rec);
  }
  return out;
}

// ---- run ---------------------------------------------------------------------------------------
const ids = new Set(LEGS.map((l) => l.book));
const arms = {};
async function arm(tag, entry, opts) {
  const handle = await launchGame({ ...args, entry });
  try {
    await requireMethods(handle, ['reset', 'setRenderRate', 'enterInterior', 'listEntities', 'teleport',
      'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'whereAmI',
      'renderFrame', 'renderedTextClear', 'getRenderedText']);
    arms[tag] = await runLegs(handle, opts || {});
  } finally { await handle.close(); }
}

await arm('A-shipped', copyGame('A'));
const bEntry = copyGame('B');
const nPerturbed = perturb(bEntry, ids);
await arm('B-perturbed', bEntry);
await arm('C-out-of-reach', copyGame('C'), { farByM: 3 });
const dEntry = copyGame('D');
const nDeleted = deleteRecords(dEntry, ids);
await arm('D-record-deleted', dEntry);

// ---- verdict -----------------------------------------------------------------------------------
const A = arms['A-shipped'], B = arms['B-perturbed'], C = arms['C-out-of-reach'], D = arms['D-record-deleted'];
// The six NEW-TEXT legs are the piece under test. The two regression legs are reported beside
// them and are deliberately NOT allowed to move the round's own number in either direction.
const NEW = LEGS.map((l, i) => (l.regression ? -1 : i)).filter((i) => i >= 0);
const REG = LEGS.map((l, i) => (l.regression ? i : -1)).filter((i) => i >= 0);
const nlegs = NEW.length;
const openedA = NEW.filter((i) => A[i] && A[i].opened === A[i].book).length;
const drewA = NEW.filter((i) => A[i] && A[i].opened === A[i].book && A[i].drawn_chars > 0).length;
const markerB = NEW.filter((i) => B[i] && B[i].marker_on_screen).length;
// The control only counts on a leg whose shipped arm opened. Otherwise "nothing opened" is free.
const cEligible = NEW.filter((i) => A[i] && A[i].opened === A[i].book);
const cShut = cEligible.filter((i) => !C[i].opened).length;
const dEligible = NEW.filter((i) => A[i] && A[i].opened === A[i].book);
const dShut = dEligible.filter((i) => D[i].opened !== D[i].book).length;
const regOpened = REG.filter((i) => A[i] && A[i].opened === A[i].book).length;

const verdict = {
  commit, legs_new_text: nlegs, legs_regression: REG.length,
  records_perturbed: nPerturbed, records_deleted: nDeleted, dropped_index_entries: DROPPED,
  A_opened_the_right_book: `${openedA}/${nlegs}`,
  A_drew_characters: `${drewA}/${nlegs}`,
  B_marker_reached_the_screen: `${markerB}/${nlegs}`,
  C_control_stayed_shut: `${cShut}/${cEligible.length} (eligible legs only)`,
  D_delete_the_record_shut_it: `${dShut}/${dEligible.length}`,
  REGRESSION_r4_inert_docs_now_open: `${regOpened}/${REG.length}`,
  PASS: openedA === nlegs && drewA === nlegs && markerB === nlegs
        && cShut === cEligible.length && cEligible.length > 0
        && dShut === dEligible.length && dEligible.length > 0,
};
ensureDir(path.dirname(OUT));
writeJson(OUT, { verdict, arms });
for (const [k, v] of Object.entries(verdict)) console.log(`  ${k.padEnd(30)} ${v}`);
console.log(`  report                         ${path.relative(ROOT, OUT)}`);
for (const r of A) {
  console.log(`  A ${r.room.padEnd(24)} ${String(r.opened)} drew=${r.drawn_chars} rival=${r.nearest_rival ? r.nearest_rival.m + 'm' : '-'} ${r.note || ''}`);
}
process.exit(verdict.PASS ? 0 : 1);
