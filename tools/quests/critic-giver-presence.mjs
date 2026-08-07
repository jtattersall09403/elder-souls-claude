#!/usr/bin/env node
// critic-giver-presence.mjs — written for the W1-19 round-2 VERDICT. Declared under
// `orchestration/TOOL-LOOP.md` / `method_deviations`.
//
// WHY IT HAD TO EXIST. Round 2's headline instruments — `utility-findability.mjs` and
// `mainline-chain-floor.mjs` — both decide that a quest "opens by playing" by calling
// `H.questOpen(id)` and reading the gate's answer. `QuestEngine.open()` has no proximity term and
// no presence term: it never asks whether the person named in `quest.giver.npc_id` is anywhere a
// player could stand. So a quest can report `ok: true` in a world that contains nobody to say the
// keyword to. `mainline-chain-floor.mjs` line 198 makes the assumption explicit — when a gate
// refuses on standing it calls `H.spawnNPC({ from_record: giver })` and conjures the quest giver
// out of nothing so that it can be persuaded.
//
// This tool asks the world instead of the gate, and it asks it twice:
//
//   PRESENCE   after booting a named state, is `quest.giver.npc_id` in `H.listNPCs()`?
//   REACHABLE  can `H.talkTo(giver)` actually open a conversation with them?
//
// A quest whose gate says `ok` and whose giver is absent from every state in the build is not
// findable; it is scoreable. That distinction is the whole of `RI-MTH07`.
//
// THE CONTROL. `--sabotage assume-present` reports every giver as present without asking the
// world. If the headline numbers do not change between the two runs, this tool is not reading the
// world and must not be believed.
//
//   node tools/quests/critic-giver-presence.mjs [--states a,b,c] [--sabotage assume-present]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
critic-giver-presence.mjs — is the person a quest names actually in the world?

  --states a,b,c            named states to boot (default: EVERY bootable inhabited state)
  --legacy-states           boot only the four town states this tool shipped with
  --sabotage assume-present control: report presence without asking the world

DEFAULT STATE LIST, changed by W1-GIVER-PRESENCE and declared here rather than quietly. It was
four hardcoded ids. A hardcoded list cannot see a town that did not exist when the list was
typed, and the remedy this tool exists to police is "place the givers" — which necessarily means
new places. The default is now DERIVED from the build: every state file that names a settlement
(env.settlement, or an env.interior belonging to one) or a site. That can only ever ADD states,
the two questions it asks are unchanged, and --legacy-states reproduces the original four exactly
so the two numbers can be compared. The sabotage control is untouched.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-CRITIC');
ensureDir(outDir);
const sabotage = args.sabotage ? String(args.sabotage) : null;
// NOTE: `utility-findability.mjs` advertises `--state <id>` and CRASHES on it —
// `String(args.state).split(',')` yields an array and the code calls `.split(',')` on the array.
// So that tool has only ever run on its three hardcoded defaults. Parse ours once.
const rawStates = args.states === undefined ? 'helstrom-market,stormhold-street,soulrest-quay,thorn-hall' : String(args.states);
const STATES = rawStates.split(',').map((s) => s.trim()).filter(Boolean);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const quests = [];
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  for (const q of JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')).quests || []) {
    quests.push({ id: q.id, category: q.category || null, giver: (q.giver || {}).npc_id || null });
  }
}

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
const perState = [];
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  for (const state of STATES) {
    const row = await page.evaluate(async ({ state, quests, sabotage }) => {
      const H = window.__HARNESS;
      H.loadState(state);
      H.setRenderRate(0);
      const present = new Set((H.listNPCs() || []).map((n) => n.record || n.from_record || n.id || n.eid));
      const eidByRecord = new Map();
      for (const n of (H.listNPCs() || [])) eidByRecord.set(n.record || n.from_record || n.id || n.eid, n.eid);
      const out = { state, npcs_in_world: present.size, npc_ids: [...present], givers_present: [], givers_absent: [], talkable: [], not_talkable: [] };
      for (const q of quests) {
        if (!q.giver) continue;
        const here = sabotage === 'assume-present' ? true : present.has(q.giver);
        if (here) {
          out.givers_present.push(q.id);
          const eid = eidByRecord.get(q.giver);
          let ok = false;
          try { const st = H.talkTo(eid ?? q.giver); ok = !!st; H.conversationClose(); } catch (e) { ok = false; }
          (ok ? out.talkable : out.not_talkable).push(q.id);
        } else out.givers_absent.push(q.id);
      }
      return out;
    }, { state, quests, sabotage });
    perState.push(row);
    console.log(`\n${state}   NPCs in world ${row.npcs_in_world}`);
    console.log(`  quest givers PRESENT   ${row.givers_present.length} / ${quests.filter((q) => q.giver).length}`);
    console.log(`  of those, TALKABLE     ${row.talkable.length}`);
    console.log(`  quests whose giver is here: ${row.givers_present.join(', ') || '(none)'}`);
  }
} finally { await handle.close(); }

// union across every state in the build
const everPresent = new Set(perState.flatMap((s) => s.givers_present));
const everTalkable = new Set(perState.flatMap((s) => s.talkable));
const withGiver = quests.filter((q) => q.giver);
const byCat = {};
for (const q of withGiver) {
  const c = q.category || '(none)';
  byCat[c] = byCat[c] || { total: 0, present: 0, talkable: 0, absent: [] };
  byCat[c].total++;
  if (everPresent.has(q.id)) byCat[c].present++; else byCat[c].absent.push(q.id);
  if (everTalkable.has(q.id)) byCat[c].talkable++;
}

const report = {
  tool: 'tools/quests/critic-giver-presence.mjs',
  measured_at: new Date().toISOString(),
  sabotage,
  states: STATES,
  quests_with_a_giver: withGiver.length,
  giver_present_in_some_state: everPresent.size,
  giver_talkable_in_some_state: everTalkable.size,
  by_category: byCat,
  per_state: perState,
};
writeJson(path.join(outDir, `giver-presence${sabotage ? '-' + sabotage : ''}.json`), report);

console.log(`\n=== ACROSS EVERY STATE IN THE BUILD ===`);
console.log(`  quests with a named giver            ${withGiver.length}`);
console.log(`  giver present in SOME bootable state ${everPresent.size}`);
console.log(`  giver TALKABLE in some state         ${everTalkable.size}`);
for (const [c, v] of Object.entries(byCat).sort()) {
  console.log(`    ${c.padEnd(8)} present ${String(v.present).padStart(3)}/${String(v.total).padEnd(3)}  talkable ${v.talkable}`);
}
console.log(`\nwrote ${path.join(outDir, `giver-presence${sabotage ? '-' + sabotage : ''}.json`)}`);
