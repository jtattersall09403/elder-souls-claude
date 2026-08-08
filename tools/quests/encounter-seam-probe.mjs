#!/usr/bin/env node
// encounter-seam-probe.mjs — does a quest resolution change what the world spawns?
//
// Declared under `orchestration/TOOL-LOOP.md`. Written by the W1-19 round-2 successor (gen 3).
//
// WHY. The round-1 verdict on the main quest closed with AR-3: **`seam_sterile: true`**.
// "The complete set of consequence keys across all 32 mainline quests is `faction_reputation`,
// `kills_npc`, `locks`, `npc_disposition`, `unlocks`, `world_flags`. Nothing touches an encounter,
// an enemy, a spawn or a combat quantity … the one place in the project where the faction system,
// the world and the fight were all supposed to meet currently contains no fight."
//
// `ARBITRATION` AR-3 names the crossing it wants in as many words: *"a quest whose resolution
// changes an encounter's composition"*. `Q-MAIN-23 res_sign_the_clause` writes a clause into the
// Dres writ that protects sixty labourers from Dres raiding for a season and sets the world flag
// `the_sixty_are_protected`. The encounter that clause is ABOUT — `dres-raid-party`, with its two
// net-throwers whose `net_behaviour` is `capture` and whose `on_player_defeat` is
// `capture-transport-archon` — spawned identically whether or not the player had signed it.
//
// This probe is the CONSUMPTION demonstration (`RI-MTH07`, ARBITRATION §3): spawn the encounter
// with the flag clear, count bodies; set the flag the quest sets, spawn again, count again. If the
// two counts are the same, the coupling is dead and this tool must say so and exit non-zero. It
// asserts nothing about hp, poise, damage, archetype or frame data, because moving one of those as
// a function of anything the player IS would be an automatic AR-1 fail; composition is the legal
// lever and composition is all this reads.
//
// Run:  node tools/quests/encounter-seam-probe.mjs [--json]
// Exit: 0 = the resolution changes the encounter. 1 = it does not.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { runControl, VERDICT } from '../experience/lib/sabotage.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('encounter-seam-probe.mjs [--out <dir>]');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-SEAM');
ensureDir(outDir);

const ENCOUNTER = 'dres-raid-party';
const FLAG = 'the_sixty_are_protected';
const QUEST = 'Q-MAIN-23';
const RESOLUTION = 'res_sign_the_clause';

// Is the flag one this quest's resolution actually writes? Read it off the SHIPPED QUEST FILE,
// not off `H.questDef()` — that projection deliberately drops `resolutions[].consequences`, so a
// probe that asked the harness would have been asking the wrong witness and would have reported
// the coupling imaginary while it was working. The tool must not invent the coupling it measures.
const QFILE = 'game/data/quests/mainline-act4.json';
const qdoc = JSON.parse(fs.readFileSync(path.join(process.cwd(), QFILE), 'utf8'));
const qdef = (qdoc.quests || []).find((q) => q.id === QUEST) || null;
const rdef = qdef && (qdef.resolutions || []).find((r) => r.id === RESOLUTION);
const declared = !!(rdef && rdef.consequences && (rdef.consequences.world_flags || []).includes(FLAG));

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 300000) });
let out;
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  out = await page.evaluate(async ({ ENCOUNTER, FLAG, QUEST, RESOLUTION }) => {
    const H = window.__HARNESS;
    const run = (flagValue) => {
      H.loadState('arena_flat');                 // a clean field, so the only variable is the flag
      H.questSetFlag(FLAG, flagValue);
      const r = H.spawnEncounter(ENCOUNTER, 0, 12);
      const st = H.getEncounterState(ENCOUNTER);
      const byRole = {};
      for (const m of st.members) byRole[m.role] = (byRole[m.role] || 0) + 1;
      return {
        flag: flagValue,
        bodies: r.eids.length,
        by_role: byRole,
        // The things that MUST NOT move. AR-1: no stat may vary with anything the player is or did.
        statblocks: [...new Set(st.members.map((m) => m.statblock))].sort(),
        hp_max: [...new Set(st.members.map((m) => m.hp_max))].sort((a, b) => a - b),
        poise_max: [...new Set(st.members.map((m) => m.poise_max))].sort((a, b) => a - b),
      };
    };
    return { clear: run(false), signed: run(true) };
  }, { ENCOUNTER, FLAG, QUEST, RESOLUTION });
} finally {
  await handle.close();
}

// THE COMPARISON, THROUGH THE SHARED CONTROL FACILITY (W1-25, tools/experience/lib/sabotage.mjs).
//
// `out.clear.bodies !== out.signed.bodies` is a correct one-line answer to "did the arms differ",
// and it is the exact line RULES #6 is about: it cannot tell a real difference from a difference
// between two empty sets. If `spawnEncounter` ever returned nothing in both arms — a moved id, a
// renamed statblock, a broken arena load — this probe would print "the seam crossing is dead" and
// exit 1, which reads as a finding about the build and would be a finding about the spawn call.
//
// So the decision is delegated. The facility adds, for free: the vacuity check (0 bodies in an arm
// is VACUOUS, not INERT), a verdict for "neither arm measured anything", and the support-collapse
// test — which is switched OFF here, deliberately and with the note the facility asks for, because
// THIS control's whole point is that the flag removes bodies.
const seamControl = await runControl({
  id: 'W1-19-r2 AR-3 seam: does res_sign_the_clause change what dres-raid-party spawns?',
  what: `spawn ${ENCOUNTER} on arena_flat with ${FLAG} clear, then set, and count who is there`,
  metric: 'bodies spawned, and the roles they fill',
  unit: 'bodies the encounter spawned and the composition census actually counted',
  factors: [{ id: 'clause_signed', what: `H.questSetFlag('${FLAG}', true) — the world flag ${QUEST} ${RESOLUTION} writes` }],
  direction: 'lower',
  supportFloor: 0,
  support_note: 'The support floor is disabled on purpose. A collapse in support normally means the ' +
    'teardown removed the units before the comparator saw them (SHORT_CIRCUIT). Here the units ARE ' +
    'the measurement: the clause is supposed to take two net-throwers out of the raid party, so ' +
    'fewer bodies in the signed arm is the finding and not an artifact.',
  measure: async (broken) => {
    const arm = broken.length ? out.signed : out.clear;
    return { value: { bodies: arm.bodies, by_role: arm.by_role }, support: arm.bodies, detail: arm };
  },
});

const changed = out.clear.bodies !== out.signed.bodies;
const statsHeld = JSON.stringify(out.clear.hp_max) === JSON.stringify(out.signed.hp_max)
  && JSON.stringify(out.clear.poise_max) === JSON.stringify(out.signed.poise_max)
  && JSON.stringify(out.clear.statblocks) === JSON.stringify(out.signed.statblocks);

console.log(`\n  ${QUEST} ${RESOLUTION} declares world flag '${FLAG}':  ${declared ? 'YES' : 'NO'}`);
console.log(`\n  ${ENCOUNTER} with the clause UNSIGNED   ${out.clear.bodies} bodies   ${JSON.stringify(out.clear.by_role)}`);
console.log(`  ${ENCOUNTER} with the clause SIGNED     ${out.signed.bodies} bodies   ${JSON.stringify(out.signed.by_role)}`);
console.log(`\n  composition changed by the resolution   ${changed ? 'YES' : 'NO'}`);
console.log(`  sabotage control (tools/experience/lib/sabotage.mjs)   ${seamControl.verdict}`);
console.log(`     ${seamControl.why}`);
console.log(`  statblock / hp_max / poise_max unchanged (AR-1)   ${statsHeld ? 'YES' : 'NO'}`);
console.log(`     statblocks ${JSON.stringify(out.clear.statblocks)}  hp_max ${JSON.stringify(out.clear.hp_max)}  poise_max ${JSON.stringify(out.clear.poise_max)}`);

const file = path.join(outDir, 'encounter-seam-probe.json');
writeJson(file, { tool: 'encounter-seam-probe', quest: QUEST, resolution: RESOLUTION, flag: FLAG, encounter: ENCOUNTER, composition_changed: changed, stats_held: statsHeld, declared_by_the_quest: declared, quest_file: QFILE, sabotage_control: seamControl, ...out });
console.log(`\nwrote ${file}`);

if (!declared) { console.log('\nFAIL — the quest resolution does not declare that flag; the coupling is imaginary.'); process.exit(1); }
if (!changed) { console.log('\nFAIL — the flag makes no difference to what spawns. The seam crossing is dead.'); process.exit(1); }
if (!statsHeld) { console.log('\nFAIL — a statblock or a stat moved. That is AR-1, not AR-3.'); process.exit(1); }
if (seamControl.verdict !== VERDICT.OK) {
  console.log(`\nFAIL — the shared control facility returns ${seamControl.verdict}. ${seamControl.why}`);
  process.exit(1);
}
console.log('\nPASS — one quest resolution changes one encounter, and it changes only who is there.');
