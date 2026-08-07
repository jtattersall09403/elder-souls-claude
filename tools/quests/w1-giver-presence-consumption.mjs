#!/usr/bin/env node
// w1-giver-presence-consumption.mjs — RI-MTH07 / ARBITRATION §3 for GAP-W1-quest-givers-not-in-the-world.
//
// Two models shipped by this piece, and a census of either one proves nothing:
//
//   A. THE POPULATION.  `post` on the quest-giver records, `env.settlement` on the town states,
//      and `Engine.populateSettlement()` reached from `applyNamedState()`. The observable is the
//      RUNNING WORLD: the giver is in `H.listNPCs()` in the town they live in and not elsewhere.
//   B. THE PRESENCE TERM.  `QuestEngine.open()`'s new clause. The observable is the GATE'S ANSWER
//      changing when — and only when — the world changes underneath it.
//
// Five checks. Each one is a statement about the running build, and each one is paired with a
// BREAKAGE that must make it fail. `--self-test` performs those breakages and exits 0 only if
// every check goes red under the one that should kill it.
//
//   BREAK-TERM   pin `questPresenceGate('off')` for the whole run — the term is never evaluated.
//                C1 and C2 must die: they are the two checks that are about the term.
//   BREAK-WORLD  use the EMPTY state where the town state should be — nobody is populated.
//                C3, C4 and C5 must die: they are the three checks that are about the people.
//
// A self-test that merely inverts its own assertion tests nothing, which is what the first
// version of this file did (AGENT-PROTOCOL failure mode 2, in my own instrument, recorded rather
// than quietly fixed).
//
//   node tools/quests/w1-giver-presence-consumption.mjs [--self-test]

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-giver-presence-consumption.mjs — perturb the population and the term, watch the world change.
  --town <state>  a state with the giver in it   (default town-soulrest)
  --empty <state> a state with nobody in it      (default arena_flat)
  --quest <id>    the quest under test           (default Q-MAIN-01)
  --self-test     break the term and break the world; exits 0 only if the right checks go red.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SELF = !!args['self-test'];
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-GIVER-PRESENCE');
ensureDir(outDir);

const TOWN = String(args.town || 'town-soulrest');
const EMPTY = String(args.empty || 'arena_flat');
const QUEST = String(args.quest || 'Q-MAIN-01');

const PAGE_FN = async ({ townState, emptyState, QUEST, forceMode }) => {
  const H = window.__HARNESS;
  const giver = ((H.questDef(QUEST) || {}).giver || {}).npc_id;
  const look = (state) => {
    const mode = forceMode || 'on';
    H.loadState(state); H.setRenderRate(0); H.questPresenceGate(mode);
    const npcs = H.listNPCs().map((n) => n.eid);
    const open = H.questOpen(QUEST);
    let spoke = null;
    try { const st = H.talkTo(giver); spoke = !!st; H.conversationClose(); } catch (e) { spoke = String(e && e.message || e); }
    // The same call again from a fresh load of the same world, with the term disarmed. This is
    // the term-side perturbation: nothing about the world differs between the two answers.
    H.loadState(state); H.setRenderRate(0); H.questPresenceGate('off');
    const openOff = H.questOpen(QUEST);
    return { state, npcs_in_world: npcs.length, giver_in_world: npcs.includes(giver), open, open_gate_off: openOff, spoke };
  };
  return { quest: QUEST, giver, town: look(townState), empty: look(emptyState) };
};

const isAbsent = (o) => String((o && o.gate) || '') === 'giver_presence';
const why = (o) => (o && (o.reason || (o.ok ? 'ok' : null))) || null;

function checksFor(r) {
  return [
    { id: 'C1-world-side', kills: 'BREAK-TERM',
      what: 'the same quest and the same gate in two worlds: the empty one refuses for absence, the town does not',
      holds: isAbsent(r.empty.open) && !isAbsent(r.town.open),
      saw: { empty: why(r.empty.open), town: why(r.town.open) } },
    { id: 'C2-term-side', kills: 'BREAK-TERM',
      what: 'in the empty world, disarming the term stops the refusal — so the refusal is THIS term',
      holds: isAbsent(r.empty.open) && !isAbsent(r.empty.open_gate_off),
      saw: { on: why(r.empty.open), off: why(r.empty.open_gate_off) } },
    { id: 'C3-not-a-rubber-stamp', kills: 'BREAK-WORLD',
      what: 'with the term armed and the giver standing there, the quest is not refused for absence',
      holds: r.town.giver_in_world && !isAbsent(r.town.open),
      saw: { giver_in_world: r.town.giver_in_world, reason: why(r.town.open) } },
    { id: 'C4-a-body-not-a-boolean', kills: 'BREAK-WORLD',
      what: 'talkTo(giver) opens a real conversation in the town and throws where nobody is',
      holds: r.town.spoke === true && typeof r.empty.spoke === 'string',
      saw: { town: r.town.spoke, empty: r.empty.spoke } },
    { id: 'C5-the-population', kills: 'BREAK-WORLD',
      what: 'the town state has a town in it, declared by nobody: its `npcs:` block is empty',
      holds: r.town.npcs_in_world > 1 && r.empty.npcs_in_world === 0,
      saw: { town: r.town.npcs_in_world, empty: r.empty.npcs_in_world } },
  ];
}

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
const runs = {};
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  runs.baseline = await page.evaluate(PAGE_FN, { townState: TOWN, emptyState: EMPTY, QUEST, forceMode: null });
  if (SELF) {
    runs.break_term = await page.evaluate(PAGE_FN, { townState: TOWN, emptyState: EMPTY, QUEST, forceMode: 'off' });
    runs.break_world = await page.evaluate(PAGE_FN, { townState: EMPTY, emptyState: EMPTY, QUEST, forceMode: null });
  }
} finally { await handle.close(); }

const base = checksFor(runs.baseline);
const r = runs.baseline;
console.log(`\nquest ${r.quest}   giver ${r.giver}`);
console.log(`  ${TOWN.padEnd(16)} npcs ${String(r.town.npcs_in_world).padStart(3)}  giver present ${r.town.giver_in_world}`);
console.log(`  ${EMPTY.padEnd(16)} npcs ${String(r.empty.npcs_in_world).padStart(3)}  giver present ${r.empty.giver_in_world}\n`);
let bad = 0;
for (const c of base) {
  if (!c.holds) bad++;
  console.log(`${c.holds ? 'CONSUMED' : 'FAILED  '}  ${c.id.padEnd(24)} ${c.what}`);
  console.log(`            saw ${JSON.stringify(c.saw)}`);
}
console.log(`\nchecks CONSUMED: ${base.length - bad} / ${base.length}`);

let selfBad = 0;
if (SELF) {
  const broken = { 'BREAK-TERM': checksFor(runs.break_term), 'BREAK-WORLD': checksFor(runs.break_world) };
  console.log('\n=== SELF-TEST: the fix removed on purpose ===');
  for (const c of base) {
    const after = broken[c.kills].find((x) => x.id === c.id);
    const died = c.holds && !after.holds;
    if (!died) selfBad++;
    console.log(`${died ? 'WENT RED   ' : 'STILL GREEN'}  ${c.id.padEnd(24)} under ${c.kills}`);
    console.log(`            after ${JSON.stringify(after.saw)}`);
  }
  console.log(`\nchecks that went red under their own breakage: ${base.length - selfBad} / ${base.length}`);
}

writeJson(path.join(outDir, `presence-consumption${SELF ? '-self-test' : ''}.json`), {
  tool: 'tools/quests/w1-giver-presence-consumption.mjs', measured_at: new Date().toISOString(),
  self_test: SELF, town: TOWN, empty: EMPTY, quest: QUEST, checks: base, runs,
});
process.exit((bad === 0 && selfBad === 0) ? 0 : 1);
