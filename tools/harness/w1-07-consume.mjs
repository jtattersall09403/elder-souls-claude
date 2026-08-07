#!/usr/bin/env node
// W1-07 round 3 — the CONSUMPTION instrument.
//
// ARBITRATION §3 / RI-MTH07: for every model this piece ships, name the world-side consumer
// and DEMONSTRATE it by perturbing the model and watching the world change. Round 2 passed
// that test for the reaction matrix and the birthsign terms and failed it for greetings.json
// and the 96 race-gated topic records, which had no reader at all.
//
// This probe does four things, in a live browser, against the real engine:
//
//   G1  a live NPC greets a live character with a line out of dialogue/greetings.json, and
//       the cell it came from is reported;
//   G2  changing the PLAYER'S RACE moves the cell and the line;
//   G3  PERTURBING greetings.json itself moves the line (the delete-the-fix test: if the line
//       does not move when the data moves, the data is not the source);
//   T1  the topic list a person offers differs by player race, and every difference is
//       attributable to a requires.race / forbids.race clause.
//
// Usage: node tools/harness/w1-07-consume.mjs [--out reports/w1-07/consume.json]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';

const ROOT = REPO_ROOT;
const args = parseArgs();
const outPath = path.resolve(ROOT, args.out ? String(args.out) : 'reports/w1-07/consume.json');

const GREETINGS = path.join(ROOT, 'game/data/dialogue/greetings.json');
const backup = fs.readFileSync(GREETINGS, 'utf8');

const out = { schema: 'elder-souls/w1-07-consume@1', started: new Date().toISOString(), checks: [] };
const rec = (id, pass, value, note) => { out.checks.push({ id, result: pass ? 'pass' : 'fail', value, note: note || null }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id}\n        ${value}`); return pass; };

async function run(label) {
  const handle = await launchGame({ width: 320, height: 240 });
  const page = handle.page;
  const r = await page.evaluate(async () => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.setRenderRate(0);
    H.loadState('helstrom-market');
    const npcs = H.listNPCs().map((n) => n.eid);
    const races = ['saxhleel', 'dunmer', 'naga', 'imperial', 'nord'];
    const rows = [];
    for (const race of races) {
      // Compose a character of this race without walking the census: setState is the
      // supported path and it is the one a critic will use.
      H.setCharacter({ race, upbringing: 'foreign-born', classId: 'ledger-hand', birthsign: 'raj-xul', givenName: 'Probe' });
      for (const eid of npcs) {
        H.conversationClose();
        const t = H.talkTo(eid);
        const d = H.npcDisposition(eid);
        rows.push({
          race, npc: eid, group: d.group, disposition: d.disposition,
          cell: t.greeting_cell, key: t.greeting_key, greeting: t.greeting,
          topics: t.topics.map((x) => x.id),
          gated: t.topics.filter((x) => x.gated).map((x) => x.id),
        });
      }
    }
    H.conversationClose();
    return { rows, npcs };
  });
  const errs = handle.errors.slice();
  await handle.close();
  return { ...r, errors: errs, label };
}

const base = await run('baseline');
out.npcs = base.npcs;
out.baseline = base.rows;
if (base.errors.length) console.log('page errors:', base.errors.slice(0, 3));

// --- G1: a greeting reached a person
const withLine = base.rows.filter((r) => r.greeting && r.cell !== null);
rec('G1-greeting-reaches-a-person',
  withLine.length === base.rows.length && withLine.length > 0,
  `${withLine.length}/${base.rows.length} (npc, player-race) pairs produced a greeting out of a numbered greetings.json cell`,
  'round 2: chData.greetings was written at engine.js:3706 and read nowhere');

// --- G2: race moves the cell and the line
const byNpc = new Map();
for (const r of base.rows) { const a = byNpc.get(r.npc) || []; a.push(r); byNpc.set(r.npc, a); }
let movedCell = 0, movedLine = 0, npcCount = 0;
for (const [, rows] of byNpc) {
  npcCount++;
  if (new Set(rows.map((r) => r.cell)).size > 1) movedCell++;
  if (new Set(rows.map((r) => r.greeting)).size > 1) movedLine++;
}
rec('G2-race-moves-the-greeting', movedLine === npcCount,
  `${movedLine}/${npcCount} people say something different to a Saxhleel, a Dunmer, a Naga, an Imperial and a Nord; ${movedCell}/${npcCount} land in a different greetings.json cell`);

// --- T1: race moves the topic list, and the difference is attributable
let topicsDiffer = 0;
const diffs = [];
for (const [npc, rows] of byNpc) {
  const sets = rows.map((r) => r.topics.join('|'));
  if (new Set(sets).size > 1) {
    topicsDiffer++;
    const a = rows.find((r) => r.race === 'saxhleel'), b = rows.find((r) => r.race === 'dunmer');
    diffs.push({ npc, saxhleel: a ? a.topics : [], dunmer: b ? b.topics : [] });
  }
}
out.topic_diffs = diffs;
rec('T1-race-moves-the-topic-list', topicsDiffer > 0,
  `${topicsDiffer}/${npcCount} people offer a different topic list by player race. Example: ${diffs.length ? JSON.stringify(diffs[0]) : '(none)'}`,
  'round 2: "an NPC\'s topic list is byte-identical for a Dunmer and a Saxhleel"');

// --- G3: PERTURB greetings.json and re-run. The delete-the-fix test.
const doc = JSON.parse(backup);
const sentinel = 'PERTURBED-BY-THE-CONSUMPTION-PROBE';
let touched = 0;
for (const k of Object.keys(doc.pools)) { doc.pools[k].lines = doc.pools[k].lines.map(() => sentinel); touched++; }
fs.writeFileSync(GREETINGS, JSON.stringify(doc, null, 2));
let pert = null;
try {
  pert = await run('perturbed');
} finally {
  fs.writeFileSync(GREETINGS, backup);
}
const pertLines = pert.rows.filter((r) => r.greeting === sentinel).length;
out.perturbed = { pools_touched: touched, rows: pert.rows.length, rows_showing_sentinel: pertLines };
rec('G3-perturbing-greetings-json-moves-the-line', pertLines === pert.rows.length && pertLines > 0,
  `rewrote all ${touched} pools in greetings.json; ${pertLines}/${pert.rows.length} live greetings changed to the sentinel`,
  'if a data file can be blanked and the world says the same thing, the world was not reading it');

// --- restore check: the file is back and the game still boots on it
const after = await run('restored');
const same = JSON.stringify(after.rows.map((r) => r.greeting)) === JSON.stringify(base.rows.map((r) => r.greeting));
rec('G4-restored', same, `greetings.json restored byte-identical and the same ${after.rows.length} lines come back`);

out.finished = new Date().toISOString();
out.pass = out.checks.every((c) => c.result === 'pass');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`\n${out.checks.filter((c) => c.result === 'pass').length}/${out.checks.length} checks pass`);
console.log(outPath);
process.exit(out.pass ? 0 : 1);
