#!/usr/bin/env node
// act5-argument-probe.mjs — read Q-MAIN-26's conversation out of the RUNNING BUILD.
//
// Q-MAIN-26 declares a twelve-topic pre-violence conversation and RI-EXP05 LH6 sets the bar at
// ">= 12 topics, >= 4 knowledge-gated". This probe does not read the JSON; it boots the game,
// puts six different characters in front of Ixtu-Meer, and asks him. What it prints is what a
// player would be offered.
//
//   node tools/quests/act5-argument-probe.mjs [--out <file>]
//
// It asserts, and exits non-zero on any of them:
//   1. twelve topics reachable in total across the signatures;
//   2. >= 4 of them absent for a character who has learned nothing and present once the flags
//      are set — a gate that cannot fail is not a gate;
//   3. every offered topic returns text (no dangling advertisement);
//   4. `how-the-count-opens` is offered to EVERY signature, including the lowest-standing one,
//      because the non-violent route through the climax must not be a privilege of standing;
//   5. the Recension topic is refused below disposition 20 and answered above it.

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';

const USAGE = `
act5-argument-probe.mjs — drive Q-MAIN-26's conversation in the running build.

USAGE
  node tools/quests/act5-argument-probe.mjs [--out <file>]
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const NPC = 'ixtu-meer';
const FLAGS = [
  'player_knows_the_curve_is_older',
  'player_proved_the_wells_drink_the_overflow',
  'player_knows_the_gem_trade_cannot_account_for_the_curve',
  'player_carries_the_gapped_copies',
  'player_carries_ashul_teis_question',
  'player_heard_the_eleven_keepers',
];

const SIGNATURES = [
  { id: 'interior-saxhleel', race: 'saxhleel', upbringing: 'interior' },
  { id: 'lukiul-saxhleel', race: 'saxhleel', upbringing: 'lukiul' },
  { id: 'interior-dunmer', race: 'dunmer', upbringing: 'interior' },
  { id: 'lukiul-dunmer', race: 'dunmer', upbringing: 'lukiul' },
  { id: 'foreign-imperial', race: 'imperial', upbringing: 'foreign-born' },
  { id: 'blackrose-khajiit', race: 'khajiit', upbringing: 'blackrose' },
];

const handle = await launchGame({ ...args, width: 320, height: 240 });
const page = handle.page;
await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.setRenderRate && window.__HARNESS.setRenderRate(0));

const run = async (sig, withFlags) => page.evaluate(({ npc, sig, flags }) => {
  const H = window.__HARNESS;
  H.setCharacter({ race: sig.race, upbringing: sig.upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
  // He is in the counting chamber under the Stone Wastes and no shipped state puts the player
  // there, so the probe stands him up from his own record — every field, including `topics`,
  // `actor` and `disposition`, comes off game/data/npcs/mainline.json unchanged.
  H.spawnNPC({ from_record: npc });
  for (const f of flags) H.questSetFlag(f, true);
  const d = H.npcDisposition(npc);
  const st = H.talkTo(npc);
  const said = {};
  for (const t of st.topics) {
    const r = H.conversationSay(t.id);
    said[t.id] = (r && r.said) ? r.said : null;
  }
  H.conversationClose();
  return { disposition: d.disposition, band: d.band, race_term: d.race_term, upbringing_term: d.upbringing_term, topics: st.topics.map((t) => t.id), said };
}, { npc: NPC, sig, flags: withFlags ? FLAGS : [] });

const rows = [];
// Cold pass first — a fresh world per signature, so a flag set for one character is not still
// set for the next. The engine's reset() re-seeds sim.quest, which is where the flags live.
for (const sig of SIGNATURES) {
  await page.evaluate(() => window.__HARNESS.reset && window.__HARNESS.reset());
  const cold = await run(sig, false);
  const warm = await run(sig, true);
  rows.push({ signature: sig.id, ...sig, cold, warm });
}

const all = new Set();
for (const r of rows) for (const t of r.warm.topics) all.add(t);

const gatedTopics = [];
for (const t of all) {
  const inCold = rows.some((r) => r.cold.topics.includes(t));
  const inWarm = rows.some((r) => r.warm.topics.includes(t));
  if (!inCold && inWarm) gatedTopics.push(t);
}

const fails = [];
if (all.size !== 12) fails.push(`expected 12 topics on ${NPC}, the running build offers ${all.size}: ${[...all].sort().join(', ')}`);
if (gatedTopics.length < 4) fails.push(`LH6 wants >= 4 knowledge-gated topics; ${gatedTopics.length} closed without the flags`);
for (const r of rows) {
  for (const t of r.warm.topics) if (!r.warm.said[t]) fails.push(`${r.signature}: topic "${t}" is offered and says nothing`);
  for (const t of r.cold.topics) if (!r.cold.said[t]) fails.push(`${r.signature} (cold): topic "${t}" is offered and says nothing`);
  if (!r.cold.topics.includes('the-count-itself') && !r.cold.topics.includes('the count itself')) {
    fails.push(`${r.signature}: cannot ask what the Count is`);
  }
  const opens = r.cold.topics.find((t) => t.replace(/[- ]/g, '') === 'howtheCountopens'.toLowerCase().replace(/ /g, '') || /how.the.count.opens/i.test(t));
  if (!opens) fails.push(`${r.signature}: the non-violent method is not offered at disposition ${r.cold.disposition}`);
}

// Clause banding: the answer above 20, the refusal below it. Both must be non-empty and different.
const clause = (r) => r.warm.topics.find((t) => /ninth.clause/i.test(t));
const above = rows.filter((r) => r.warm.disposition >= 20);
const below = rows.filter((r) => r.warm.disposition < 20);
const clauseTexts = {};
for (const r of rows) { const c = clause(r); clauseTexts[r.signature] = c ? r.warm.said[c] : null; }
if (!above.length || !below.length) fails.push('the signature set does not straddle disposition 20; the clause band is untested');
else {
  const a = clauseTexts[above[0].signature], b = clauseTexts[below[0].signature];
  if (!a || !b) fails.push('the Recension topic returned nothing on one side of the 20 line');
  else if (a === b) fails.push('the Recension answer is identical above and below disposition 20 — the band is decorative');
  else if (!/never written in the Recension/i.test(a)) fails.push('the above-20 answer does not contain the revelation');
  else if (/never written in the Recension/i.test(b)) fails.push('the below-20 refusal leaks the revelation');
}

const report = {
  npc: NPC,
  topics_total: all.size,
  topics: [...all].sort(),
  knowledge_gated: gatedTopics.sort(),
  per_signature: rows.map((r) => ({
    signature: r.signature, race: r.race, upbringing: r.upbringing,
    disposition: r.warm.disposition, band: r.warm.band,
    race_term: r.warm.race_term, upbringing_term: r.warm.upbringing_term,
    topics_cold: r.cold.topics.length, topics_warm: r.warm.topics.length,
    words_warm: Object.values(r.warm.said).filter(Boolean).reduce((a, s) => a + s.split(/\s+/).length, 0),
    distinct_from_top_signature: null,
  })),
  ok: fails.length === 0,
  failures: fails,
};

// How much of the conversation is actually different between the highest and lowest standing.
const top = rows[0], low = rows.find((r) => r.signature === 'lukiul-dunmer');
if (top && low) {
  let differing = 0, shared = 0;
  for (const t of all) {
    const a = top.warm.said[t] || null, b = low.warm.said[t] || null;
    if (a && b) { shared++; if (a !== b) differing++; }
  }
  report.standing_delta = { compared: shared, differing_answers: differing, top: top.signature, low: low.signature,
    top_disposition: top.warm.disposition, low_disposition: low.warm.disposition,
    topics_top: top.warm.topics.length, topics_low: low.warm.topics.length };
}

if (args.out) writeJson(args.out, report);
console.log(JSON.stringify(report, null, 2));
await handle.close();
process.exit(fails.length ? 1 : 0);
