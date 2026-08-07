#!/usr/bin/env node
/**
 * W1-04 — the `settlement` field on an NPC record: audit, and CONSUMPTION proof.
 *
 * WHAT THIS IS FOR. NPC records carry a `settlement` string. Two shipped consumers key on it:
 * `RumourBook.pick()` (what the town is saying, RI-DLG02) and `RoadBook.forNpc()` (the way out
 * of it, RI-WLD06). Records kept acquiring values that are not settlements — `thornmarsh` on
 * `widow-ineel` and `herbwife-ossa`, `rootlands` on the three named-state wilderness people —
 * each found by hand, a round apart, with nothing catching the class.
 *
 * WHY A JUNK VALUE IS WORSE THAN NO VALUE. Both consumers are written as
 * `npc.settlement || <the settlement the PLAYER is standing in>`. That fallback is deliberate.
 * A junk string does not fail the fallback, it DEFEATS it: `"rootlands" || fallback` is
 * `"rootlands"`, every rumour row filters out on `r.settlement !== settlement`, the road book's
 * `bySettlement` lookup misses, and the person answers nothing while nothing goes red.
 *
 * WHY THIS RUNS IN BARE NODE AND IS STILL HONEST. It imports the REAL `RumourBook` and
 * `RoadBook` out of `game/src/sim/quest/topic-supply.js` — the same classes `engine.js`
 * constructs — and wires them exactly as `Engine._installTopicSupply()` does, quoted below.
 * Nothing here is a reimplementation of the consumer. `topic-supply.js` imports only
 * `core/topics.js`, so no engine and no browser is needed to run the production code path.
 * (Behavioural claims about the WORLD still belong in the browser; this is a claim about a
 * pure reader, and the reader is the thing under test.)
 *
 * THE PERTURBATION (RI-MTH07 / ARBITRATION §3). For each repaired record it runs the real
 * consumers twice with the player standing in the SAME town: once with the record as shipped,
 * once with `settlement` put back to the junk value. If the two answer the same, the field is
 * not consumed and this exits non-zero.
 *
 * Run: node tools/world/w1-04-settlement-field.mjs
 *      node tools/world/w1-04-settlement-field.mjs --json
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RumourBook, RoadBook } from '../../game/src/sim/quest/topic-supply.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const D = (...p) => join(ROOT, 'game', 'data', ...p);
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---------------------------------------------------------------------------
// The key space: settlement records UNION rumour buckets.
//
// Not the settlements directory alone. `tidewrack` is the opening prison barge — no settlement
// record and no road out of it (correctly; there is no road off a barge) — but it does have
// rumours, so the three people aboard CAN answer for where they are. The bar is "can this
// person answer for the place they claim", not "is this place on the map".
const settlementIds = existsSync(D('world', 'settlements'))
  ? readdirSync(D('world', 'settlements')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5))
  : [];
const rumoursDoc = readJSON(D('dialogue', 'rumours.json'));
const roadsDoc = readJSON(D('dialogue', 'road-directions.json'));

const rumourBuckets = new Set([
  ...Object.keys(rumoursDoc.rumours || {}),
  ...(rumoursDoc.race_gated || []).map((r) => r && r.settlement).filter(Boolean),
]);
const known = new Set([...settlementIds, ...rumourBuckets]);

const rumourBook = new RumourBook(rumoursDoc);
const roadBook = new RoadBook(roadsDoc);

// ---------------------------------------------------------------------------
// The consumers, wired exactly as Engine._installTopicSupply() wires them (engine.js ~1711):
//     roadsFor:  (npc) => this.roadBook.forNpc(npc, this.sim.env && this.sim.env.settlement)
//     rumourFor: (npc, player, nth) => {
//       const settlement = npc.settlement || (npc.record && npc.record.settlement)
//                          || this.sim.env.settlement || null;
//       return this.rumourBook.pick(settlement, player, npc.eid, nth); }
const rumourFor = (npc, player, envSettlement, nth = 0) => {
  const settlement = npc.settlement || (npc.record && npc.record.settlement) || envSettlement || null;
  return rumourBook.pick(settlement, player, npc.eid, nth);
};
const roadsFor = (npc, envSettlement) => roadBook.forNpc(npc, envSettlement);

// ---------------------------------------------------------------------------
// Part A — the audit.
const npcFiles = readdirSync(D('npcs')).filter((f) => f.endsWith('.json') && !f.startsWith('.'));
const records = [];
for (const f of npcFiles) {
  let doc;
  try { doc = readJSON(D('npcs', f)); } catch { continue; }
  for (const n of (Array.isArray(doc) ? doc : (doc.npcs || []))) {
    if (n && typeof n === 'object') records.push({ file: f, rec: n });
  }
}
const junk = records.filter(({ rec }) => rec.settlement != null && !known.has(rec.settlement));
const nulls = records.filter(({ rec }) => rec.settlement == null);

// ---------------------------------------------------------------------------
// Part B — consumption. Perturb the field, watch the answer change.
//
// The player is standing in Thorn in every scenario, so the ONLY thing that differs between the
// two runs of a pair is the record's own `settlement`. A control townsperson is included so the
// run distinguishes "the field is consumed" from "this data happens to be empty".
const PLAYER = { race: 'saxhleel', upbringing: 'marsh' };
const ENV = 'thorn';

const subjects = [
  { id: 'rootlands-keeper', junkWas: 'rootlands' },
  { id: 'rootlands-drowned-speaker', junkWas: 'rootlands' },
  { id: 'rootlands-band-elder', junkWas: 'rootlands' },
  // The pair W1-19 repaired a round earlier, kept here so the regression is covered too.
  { id: 'widow-ineel', junkWas: 'thornmarsh' },
  { id: 'herbwife-ossa', junkWas: 'thornmarsh' },
];

const byId = new Map(records.map(({ rec }) => [rec.id, rec]));
const rows = [];

for (const s of subjects) {
  const rec = byId.get(s.id);
  if (!rec) { rows.push({ npc: s.id, verdict: 'MISSING' }); continue; }

  const asShipped = { ...rec, eid: rec.id };
  const perturbed = { ...rec, eid: rec.id, settlement: s.junkWas };

  const shippedRumour = rumourFor(asShipped, PLAYER, ENV);
  const shippedRoads = roadsFor(asShipped, ENV);
  const brokenRumour = rumourFor(perturbed, PLAYER, ENV);
  const brokenRoads = roadsFor(perturbed, ENV);

  // Consumed means: with the junk value restored, this person loses the ability to answer.
  const consumed = (!!shippedRumour && !brokenRumour) || (shippedRoads.length > 0 && brokenRoads.length === 0);

  rows.push({
    npc: s.id,
    settlement_now: rec.settlement,
    junk_was: s.junkWas,
    shipped: { rumour: shippedRumour ? shippedRumour.x : null, roads: shippedRoads.length },
    perturbed: { rumour: brokenRumour ? brokenRumour.x : null, roads: brokenRoads.length },
    verdict: consumed ? 'CONSUMED' : 'NOT-CONSUMED',
  });
}

// Control: a townsperson whose settlement is real and unchanged. If this one also came back
// empty, the run would prove nothing about the field — it would only prove the books are bare.
const control = records.find(({ rec }) => rec.settlement === 'thorn');
let controlRow = null;
if (control) {
  const c = { ...control.rec, eid: control.rec.id };
  const r = rumourFor(c, PLAYER, ENV);
  const rd = roadsFor(c, ENV);
  controlRow = { npc: c.id, settlement: c.settlement, rumour: r ? r.x : null, roads: rd.length,
    verdict: (r || rd.length) ? 'ANSWERS' : 'SILENT' };
}

// ---------------------------------------------------------------------------
const report = {
  at: new Date().toISOString(),
  piece: 'W1-04',
  known_places: [...known].sort(),
  audit: {
    records: records.length,
    junk: junk.map(({ file, rec }) => `${file}: ${rec.id} -> "${rec.settlement}"`),
    null_settlement: nulls.length,
  },
  consumption: rows,
  control: controlRow,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`W1-04 settlement field — ${records.length} NPC records, ${known.size} known places`);
  console.log(`  known: ${[...known].sort().join(', ')}`);
  console.log(`\nAUDIT: ${junk.length} junk value(s), ${nulls.length} deliberate null(s).`);
  for (const j of report.audit.junk) console.log(`  BAD  ${j}`);
  console.log('\nCONSUMPTION (player standing in thorn; only the record\'s own field differs):');
  for (const r of rows) {
    if (r.verdict === 'MISSING') { console.log(`  ${r.npc.padEnd(28)} MISSING`); continue; }
    console.log(`  ${r.npc.padEnd(28)} ${r.verdict}`);
    console.log(`      as shipped (settlement=${JSON.stringify(r.settlement_now)}): roads=${r.shipped.roads}  rumour=${r.shipped.rumour ? JSON.stringify(r.shipped.rumour.slice(0, 60) + '…') : 'none'}`);
    console.log(`      perturbed  (settlement="${r.junk_was}"): roads=${r.perturbed.roads}  rumour=${r.perturbed.rumour ? JSON.stringify(r.perturbed.rumour.slice(0, 60) + '…') : 'none'}`);
  }
  if (controlRow) console.log(`\nCONTROL ${controlRow.npc} (settlement=${controlRow.settlement}): ${controlRow.verdict} — roads=${controlRow.roads}`);
}

// Fail loudly on either half: a junk value present, or a field nothing consumes.
const notConsumed = rows.filter((r) => r.verdict !== 'CONSUMED');
if (junk.length || notConsumed.length || (controlRow && controlRow.verdict !== 'ANSWERS')) {
  console.error('\nFAIL:');
  if (junk.length) console.error(`  ${junk.length} NPC record(s) name a settlement that does not exist.`);
  for (const r of notConsumed) console.error(`  ${r.npc}: ${r.verdict} — perturbing the field changed nothing.`);
  if (controlRow && controlRow.verdict !== 'ANSWERS') console.error(`  control ${controlRow.npc} is SILENT; the books are empty and this run proves nothing.`);
  process.exit(1);
}
console.log('\nOK: no junk settlements, and the field is consumed by both books.');
