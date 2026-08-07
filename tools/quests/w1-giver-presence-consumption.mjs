#!/usr/bin/env node
// w1-giver-presence-consumption.mjs — RI-MTH07 / ARBITRATION §3 for GAP-W1-quest-givers-not-in-the-world.
//
// Two models shipped by this piece, and a census of either one proves nothing:
//
//   A. THE POPULATION.  `post` on 39 NPC records, `env.settlement` on the town states, and
//      `Engine.populateSettlement()` reached from `applyNamedState()`. The observable is the
//      RUNNING WORLD: the same quest's giver is in `H.listNPCs()` in the town they live in and
//      not in a town they do not.
//   B. THE PRESENCE TERM.  `QuestEngine.open()`'s new clause. The observable is the GATE'S ANSWER
//      changing when — and only when — the world changes underneath it.
//
// Four checks, each with its own inversion. The probe exits non-zero unless every one of them
// both HOLDS and can be shown to FAIL when the thing it depends on is taken away.
//
//   1. WORLD-SIDE, no flags touched. Boot a state with nobody in it and a state with the giver in
//      it. Same quest, same gate, same code: `giver absent` in one and not in the other.
//   2. TERM-SIDE. In the empty world, `questPresenceGate('off')` and the same call stops refusing.
//      A term that cannot be turned off cannot be shown to be doing anything.
//   3. NOT A RUBBER STAMP. With the term ON and the giver present, the quest is not refused for
//      absence. A gate that refuses everything is as useless as one that refuses nothing.
//   4. THE PERSON, NOT THE FLAG. `H.talkTo(giver)` opens a real conversation in the town and
//      throws in the empty world — so what changed is a body, not a boolean.
//
//   --self-test   break the instrument on purpose: assert the OPPOSITE of every expectation.
//                 Exits 0 only when every check goes red, which is the whole point of the mode.
//
//   node tools/quests/w1-giver-presence-consumption.mjs [--self-test]

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-giver-presence-consumption.mjs — perturb the population and the term, watch the world change.
  --self-test   invert every expectation; exits 0 only if all of them go red.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const SELF = !!args['self-test'];
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-GIVER-PRESENCE');
ensureDir(outDir);

// A state with people, a state with none, and a quest whose giver lives in the first.
const TOWN = String(args.town || 'town-soulrest');
const EMPTY = String(args.empty || 'arena_flat');
const QUEST = String(args.quest || 'Q-MAIN-01');

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
let r;
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  r = await page.evaluate(async ({ TOWN, EMPTY, QUEST }) => {
    const H = window.__HARNESS;
    const giver = ((H.questDef(QUEST) || {}).giver || {}).npc_id;
    const look = (state) => {
      H.loadState(state);
      H.setRenderRate(0);
      H.questPresenceGate('on');
      const npcs = H.listNPCs().map((n) => n.eid);
      const open = H.questOpen(QUEST);
      let spoke = null;
      try { const st = H.talkTo(giver); spoke = !!st; H.conversationClose(); } catch (e) { spoke = String(e && e.message || e); }
      // and the same call with the term disarmed, from the same world
      H.questPresenceGate('off');
      H.loadState(state); H.setRenderRate(0); H.questPresenceGate('off');
      const openOff = H.questOpen(QUEST);
      return { state, npcs_in_world: npcs.length, giver_in_world: npcs.includes(giver), open, open_gate_off: openOff, spoke };
    };
    return { quest: QUEST, giver, town: look(TOWN), empty: look(EMPTY) };
  }, { TOWN, EMPTY, QUEST });
} finally { await handle.close(); }

const isAbsent = (o) => String((o && o.gate) || '') === 'giver_presence';
const checks = [
  {
    id: 'C1-world-side',
    what: `the same quest, the same gate, two worlds: '${EMPTY}' refuses ${r.quest} for absence and '${TOWN}' does not`,
    holds: isAbsent(r.empty.open) && !isAbsent(r.town.open),
    saw: { empty_reason: r.empty.open.reason, town_reason: r.town.open.reason || (r.town.open.ok ? 'ok' : null) },
  },
  {
    id: 'C2-term-side',
    what: 'in the empty world, disarming the term stops the refusal — so the refusal is this term and not another',
    holds: isAbsent(r.empty.open) && !isAbsent(r.empty.open_gate_off),
    saw: { on: r.empty.open.reason, off: r.empty.open_gate_off.reason || (r.empty.open_gate_off.ok ? 'ok' : null) },
  },
  {
    id: 'C3-not-a-rubber-stamp',
    what: 'with the term armed and the giver standing there, the quest is not refused for absence',
    holds: r.town.giver_in_world && !isAbsent(r.town.open),
    saw: { giver_in_world: r.town.giver_in_world, reason: r.town.open.reason || (r.town.open.ok ? 'ok' : null) },
  },
  {
    id: 'C4-a-body-not-a-boolean',
    what: 'talkTo(giver) opens a conversation in the town and throws in the empty world',
    holds: r.town.spoke === true && typeof r.empty.spoke === 'string',
    saw: { town: r.town.spoke, empty: r.empty.spoke },
  },
  {
    id: 'C5-the-population',
    what: 'the town has people in it and the empty state does not',
    holds: r.town.npcs_in_world > 1 && r.empty.npcs_in_world === 0,
    saw: { town: r.town.npcs_in_world, empty: r.empty.npcs_in_world },
  },
];

let bad = 0;
console.log(`\nquest ${r.quest}   giver ${r.giver}`);
console.log(`  ${TOWN.padEnd(16)} npcs ${String(r.town.npcs_in_world).padStart(3)}  giver present ${r.town.giver_in_world}`);
console.log(`  ${EMPTY.padEnd(16)} npcs ${String(r.empty.npcs_in_world).padStart(3)}  giver present ${r.empty.giver_in_world}\n`);
for (const c of checks) {
  const want = SELF ? !c.holds : c.holds;
  if (!want) bad++;
  console.log(`${(SELF ? (c.holds ? 'STILL-GREEN' : 'WENT-RED   ') : (c.holds ? 'CONSUMED' : 'FAILED  '))}  ${c.id}  ${c.what}`);
  console.log(`            saw ${JSON.stringify(c.saw)}`);
}
const report = { tool: 'tools/quests/w1-giver-presence-consumption.mjs', measured_at: new Date().toISOString(), self_test: SELF, town: TOWN, empty: EMPTY, quest: QUEST, raw: r, checks };
writeJson(path.join(outDir, `presence-consumption${SELF ? '-self-test' : ''}.json`), report);
console.log(`\n${SELF ? 'SELF-TEST: checks that went red' : 'checks CONSUMED'}: ${checks.length - bad} / ${checks.length}`);
process.exit(bad === 0 ? 0 : 1);
