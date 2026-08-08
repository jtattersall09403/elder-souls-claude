#!/usr/bin/env node
// w1-23-r4-consume.mjs — CONSUMPTION for the library half (RI-MTH07 §B, mandatory under
// `corpus/00-doctrine/ARBITRATION.md` §3).
//
// W1-23 round 3 §4 found the shape this project keeps finding: "not a model nothing reads, but a
// model that is READ, wired to a corpus the reader cannot reach." The register half was
// demonstrated at 78 changed answers. The library half was consumed by nothing — 99 of 152 texts
// referenced nowhere under `game/`, and 15 of 19 registered contradiction pairs with NEITHER side
// placed anywhere a person could stand.
//
// This round placed 99 texts into 40 rooms. That is a claim about `game/data`, and a claim about
// data is exactly what sixteen subsystems here have shipped and had voided. So this tool asks the
// only question that settles it:
//
//     STAND IN THE ROOM. PRESS THE BUTTON A PLAYER PRESSES. DOES WHAT COMES UP ON THE SCREEN
//     CHANGE WHEN THE LORE RECORD CHANGES?
//
// THE FOUR ARMS, and the last two are the ones that make the first two mean anything:
//
//   A. SHIPPED. Walk into the room, stand at the object, press `interact`, and read back the id
//      and the first line of the text on the book screen.
//   B. PERTURBED. On a COPY of `game/`, rewrite one sentence inside one book record — the
//      Blessings of the Coast, the Empire's own answer to whether subjects are held as property —
//      and run the identical leg. The line the player reads must change. If it does not, the room
//      is drawing a book-shaped box and the corpus is decoration.
//   C. CONTROL, OUT OF REACH (RULES #4). Same room, same button, standing at `reach_m + 3 m`.
//      Nothing may open. Without this, arm A would pass in a build where pressing `interact`
//      anywhere read every document in the province.
//   D. DELETE-THE-FIX (RULES #6). On a second COPY, remove THIS PIECE'S placements from the
//      interior records — `node tools/lore/place-library.mjs` is idempotent and additive, so the
//      teardown is "take those readable entries out again" and nothing else. The object must not
//      be in the room and the press must open nothing.
//
//      RULES #6 as amended today distinguishes an inert FIX from an inert CONTROL. Arm D is the
//      inert-fix check. The inert-CONTROL check is arm C run against a torn-down tree: if arm C
//      is passing because it never presses anything, it will pass in arm D too and prove nothing,
//      so arm D also asserts that the SHIPPED arm goes red — the control arm is watched failing,
//      not assumed to fail.
//
// PROHIBITED, asserted against this file's own bytes: `openMenu` (the harness door straight into
// the book screen, which would skip the room, the object and the reach — the three things being
// measured) and `__ENGINE` (INDEX.md's documented back door around harness prohibitions).
//
// Run: node tools/lore/w1-23-r4-consume.mjs [--out reports/w1-23-r4/consume.json]
// Exit 0 only if A opened the right books, B changed the text, C stayed shut, and D went red.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '../..');
const PROHIBITED = ['openMenu', '__ENGINE'];

const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(ROOT, String(args.out || 'reports/w1-23-r4/consume.json'));

// The tool must not be able to cheat, and the check is over its own bytes.
{
  const self = fs.readFileSync(SELF, 'utf8');
  // Comments and the declaration of the list itself are not calls. Everything else is.
  const body = self.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.includes('PROHIBITED'))
    .join('\n');
  for (const p of PROHIBITED) {
    if (body.includes(`'${p}'`) || body.includes(`"${p}"`) || body.includes(`.${p}(`)) {
      console.error(`w1-23-r4-consume: this tool names the prohibited verb ${p}. Refusing to report.`);
      process.exit(2);
    }
  }
}

// ---- the two legs. Both sides of the province's central moral fact. -----------------------------
const LEGS = [
  { room: 'lilmoth-customs', book: 'the-blessings-of-the-coast' },
  { room: 'lilmoth-ledger-house', book: 'ledger-and-journal-of-andrel-vorin' },
];

const commit = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; } })();

// ---- tree copies --------------------------------------------------------------------------------
//
// EVERY ARM RUNS ON A COPY, INCLUDING THE SHIPPED ONE, and the reason is a neighbour rather than
// tidiness. Twelve agents are writing this tree. While this piece was being measured, an
// uncommitted edit to `game/data/dialogue/topics/50-factions.json` made `Engine._installCanon`
// throw at boot — "CF-D015/A: topic `the-xanmeers` has no info written for actor `notary`" — so
// nothing in the project could launch a browser at all, this piece included. That is not my file
// and not my defect to fix.
//
// So each copy is taken from the working tree and then every file that is MODIFIED-BUT-NOT-
// COMMITTED and NOT declared by this piece is reset to its HEAD contents. The arms therefore
// measure this piece's change against HEAD plus this piece's change, with a neighbour's in-flight
// work neither carried nor blamed. What was neutralised is printed and lands in the report.
const MINE = [
  'game/data/world/interiors/',
  'game/data/npcs/',
  'game/data/world/property/',
  'game/data/world/settlements/',
];

function neighbourEdits() {
  const out = [];
  // NOT .trim() on the whole blob: porcelain lines begin with a status column that may be a
  // space, and trimming the output ate the first character of the first path.
  const st = execSync('git status --porcelain -- game/', { cwd: ROOT, encoding: 'utf8' }).replace(/\n+$/, '');
  for (const line of (st ? st.split('\n') : [])) {
    const code = line.slice(0, 2), file = line.slice(3);
    if (!code.includes('M')) continue;
    if (MINE.some((m) => file.startsWith(m))) continue;
    out.push(file);
  }
  return out;
}

function copyGame(tag) {
  const dst = path.join(ROOT, 'reports', 'w1-23-r4', `arm-${tag}`);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(path.join(ROOT, 'game'), path.join(dst, 'game'), { recursive: true });
  for (const f of NEIGHBOURS) {
    const head = execSync(`git show HEAD:${f}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(dst, f), head);
  }
  return path.join(dst, 'game', 'index.html');
}

const NEIGHBOURS = neighbourEdits();
if (NEIGHBOURS.length) console.log(`neutralised ${NEIGHBOURS.length} neighbour edit(s) on every arm: ${NEIGHBOURS.join(', ')}`);

const PERTURB_MARK = 'THE PERTURBATION MARKER FOR W1-23 ROUND 4';

/** Arm B: change one sentence inside one book record, on a copy. */
function perturbBook(entry, bookId) {
  const dir = path.join(path.dirname(entry), 'data', 'books');
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = j.books || [j];
    let hit = false;
    for (const b of list) {
      if (!b || b.id !== bookId) continue;
      b.text = `${PERTURB_MARK}\n\n${b.text || ''}`;
      hit = true;
    }
    if (hit) { fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n'); return true; }
  }
  return false;
}

/** Arm D: take this piece's placements back out of the interior records, on a copy. */
async function tearDownPlacements(entry) {
  const { PLACEMENTS } = await import(path.join(ROOT, 'tools/lore/place-library.mjs').replace(/\\/g, '/') + '?teardown');
  const dir = path.join(path.dirname(entry), 'data', 'world', 'interiors');
  let removed = 0;
  for (const [room, list] of Object.entries(PLACEMENTS)) {
    const p = path.join(dir, `${room}.json`);
    if (!fs.existsSync(p)) continue;
    const rec = JSON.parse(fs.readFileSync(p, 'utf8'));
    const ids = new Set(list.map(([id]) => id));
    const before = Array.isArray(rec.readable) ? rec.readable : (rec.readable ? [rec.readable] : []);
    const after = before.filter((r) => !ids.has(r.id));
    removed += before.length - after.length;
    rec.readable = after;
    fs.writeFileSync(p, JSON.stringify(rec, null, 2) + '\n');
  }
  return removed;
}

// ---- one leg, in a running game -----------------------------------------------------------------
async function runLegs(handle, { farByM = 0 } = {}) {
  const out = [];
  for (const leg of LEGS) {
    await handle.h('reset');
    await handle.h('setRenderRate', 0);
    const rec = { ...leg, entered: false, prop: null, stood_m: null, opened: null, first_line: null, note: null };
    try {
      await handle.h('enterInterior', leg.room);
      rec.entered = true;
    } catch (e) { rec.note = `enterInterior threw: ${e.message}`; out.push(rec); continue; }

    const ents = await handle.h('listEntities');
    const props = (ents.entities || ents || []).filter((e) => e && e.readable_book === leg.book);
    if (!props.length) { rec.note = 'no prop in this room offers that book'; out.push(rec); continue; }
    const prop = props[0];
    rec.prop = { eid: prop.eid, name: prop.name, reach_m: prop.reach_m ?? null, pos: prop.pos };

    // Stand toward the middle of the room from the object, so the doorway is not in reach.
    const where = await handle.h('whereAmI');
    const cx = (where && where.bounds) ? (where.bounds.x[0] + where.bounds.x[1]) / 2 : 0;
    const cz = (where && where.bounds) ? (where.bounds.z[0] + where.bounds.z[1]) / 2 : 0;
    let vx = cx - prop.pos[0], vz = cz - prop.pos[2];
    const L = Math.hypot(vx, vz) || 1; vx /= L; vz /= L;
    const d = (farByM ? (prop.reach_m || 1.6) + farByM : 1.0);
    await handle.h('teleport', prop.pos[0] + vx * d, prop.pos[2] + vz * d);
    rec.stood_m = +d.toFixed(2);

    await handle.h('queueInputs', [{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    await handle.h('stepFrames', 8);
    const ui = await handle.h('getUIState');
    rec.opened = (ui && ui.book && ui.book.id) || null;
    const body = (ui && ui.book && (ui.book.text || ui.book.body || '')) || '';
    rec.first_line = String(body).split('\n').map((s) => s.trim()).filter(Boolean)[0] || null;
    rec.perturbation_visible = String(body).includes(PERTURB_MARK);
    if (ui && ui.mode && ui.mode !== 'world') await handle.h('closeMenu');
    out.push(rec);
  }
  return out;
}

// ---- run -----------------------------------------------------------------------------------------
const arms = {};

async function arm(tag, entry) {
  const handle = await launchGame({ ...args, entry });
  try {
    await requireMethods(handle, ['reset', 'setRenderRate', 'enterInterior', 'listEntities', 'teleport',
      'queueInputs', 'stepFrames', 'getUIState', 'closeMenu', 'whereAmI']);
    arms[tag] = await runLegs(handle, tag === 'C-out-of-reach' ? { farByM: 3 } : {});
  } finally { await handle.close(); }
}

// A. shipped
const aEntry = copyGame('A');
await arm('A-shipped', aEntry);

// B. perturbed lore record, on a copy
const bEntry = copyGame('B');
const perturbed = LEGS.map((l) => perturbBook(bEntry, l.book));
await arm('B-perturbed', bEntry);

// C. control: out of reach, on the same tree as arm A
await arm('C-out-of-reach', copyGame('C'));

// D. delete-the-fix, on a copy
const dEntry = copyGame('D');
const removed = await tearDownPlacements(dEntry);
await arm('D-placement-removed', dEntry);

// ---- verdict -------------------------------------------------------------------------------------
const A = arms['A-shipped'], B = arms['B-perturbed'], C = arms['C-out-of-reach'], D = arms['D-placement-removed'];
const openedA = A.filter((r) => r.opened === r.book).length;
const changedB = B.filter((r, i) => r.opened === r.book && r.perturbation_visible && !A[i].perturbation_visible).length;
const shutC = C.filter((r) => !r.opened).length;
const redD = D.filter((r) => !r.opened).length;
const propGoneD = D.filter((r) => !r.prop).length;

const pass = openedA === LEGS.length
  && changedB === LEGS.length
  && shutC === LEGS.length
  && redD === LEGS.length
  && propGoneD === LEGS.length
  && perturbed.every(Boolean)
  && removed > 0;

const report = { commit, neighbour_edits_neutralised: NEIGHBOURS, legs: LEGS.length, arms, summary: { openedA, changedB, shutC, redD, propGoneD, placements_removed: removed }, pass };
ensureDir(path.dirname(OUT));
writeJson(OUT, report);

console.log(`commit ${commit}`);
for (const [tag, rows] of Object.entries(arms)) {
  console.log(`\n${tag}`);
  for (const r of rows) {
    console.log(`  ${r.room.padEnd(22)} prop:${r.prop ? 'yes' : 'NO '}  stood ${r.stood_m ?? '-'} m  opened:${r.opened || '(nothing)'}  `
      + `perturbation_visible:${r.perturbation_visible ? 'YES' : 'no'}${r.note ? `  [${r.note}]` : ''}`);
    if (r.first_line) console.log(`      first line: ${r.first_line.slice(0, 96)}`);
  }
}
console.log(`\nA opened the right book on ${openedA}/${LEGS.length} legs`);
console.log(`B (lore record perturbed) changed what the player reads on ${changedB}/${LEGS.length} legs`);
console.log(`C (out of reach) stayed shut on ${shutC}/${LEGS.length} legs`);
console.log(`D (placements removed, ${removed} entries) — object absent on ${propGoneD}/${LEGS.length}, opened nothing on ${redD}/${LEGS.length}`);
console.log(`\nreport: ${path.relative(ROOT, OUT)}`);
console.log(pass ? 'CONSUMPTION: demonstrated, with a control that stayed shut and a teardown that went red.'
  : 'CONSUMPTION: NOT demonstrated. See the arms above.');
process.exit(pass ? 0 : 1);
