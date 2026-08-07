#!/usr/bin/env node
// critic-ar3-endtoend.mjs — written for the W1-19 round-2 VERDICT. Declared under
// `method_deviations`.
//
// WHY IT HAD TO EXIST. `tools/quests/encounter-seam-probe.mjs` proves the second half of the AR-3
// crossing and asserts the first half. It calls `H.questSetFlag('the_sixty_are_protected', v)` by
// hand and then reads `game/data/quests/mainline-act4.json` off disk to check that
// `Q-MAIN-23 res_sign_the_clause` declares that flag. So the link it actually demonstrates is
//
//     a hand-set flag  ->  fewer bodies
//
// and the link it needs is
//
//     the player signs the clause  ->  the flag  ->  fewer bodies.
//
// The builder caught itself asking `H.questDef()` (which drops `resolutions[].consequences`) and
// corrected to the shipped file. But a shipped file is still the design document, not the running
// world — `RI-MTH07`. A resolution whose `consequences.world_flags` the QuestEngine never applied
// would pass that probe forever.
//
// This tool RESOLVES the quest through the running QuestEngine and reads the flag back out of
// `H.getQuestState().flags` before spawning anything.
//
// THE CONTROL is the other resolution of the same quest: play Q-MAIN-23 to a resolution that is
// NOT `res_sign_the_clause` and the raid party must come back to full strength. If both branches
// give the same field, the flag is not what is doing the work.
//
//   node tools/quests/critic-ar3-endtoend.mjs

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage('critic-ar3-endtoend.mjs [--out <dir>]');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-CRITIC');
ensureDir(outDir);

const ENCOUNTER = 'dres-raid-party';
const FLAG = 'the_sixty_are_protected';
const QUEST = 'Q-MAIN-23';
const SIGN = 'res_sign_the_clause';
// The control is the sibling branch of the SAME quest: also non-violent, also wins the Salt Voice,
// and it does NOT declare `the_sixty_are_protected`.
const CONTROL = 'res_buy_the_water';
import fs from 'node:fs';
const qdoc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/quests/mainline-act4.json'), 'utf8'));
const RESOLUTIONS = (qdoc.quests.find((q) => q.id === QUEST).resolutions || []).map((r) => r.id);
const mainDoc = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/quests/mainline.json'), 'utf8'));
const MAIN = [...mainDoc.acts.flatMap((a) => a.quests), ...mainDoc.aftermath.quests];
// reveals + mid-quest notes per quest, exactly as `mainline-chain-floor.mjs` builds them
const ALLQ = {};
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/quests'))) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  for (const q of JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/quests', f), 'utf8')).quests || []) ALLQ[q.id] = q;
}
const PLAN = {};
for (const id of MAIN) {
  const q = ALLQ[id]; if (!q) continue;
  PLAN[id] = {
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch').map((e) => e.index).filter((i) => i > 10),
  };
}

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
let out;
try {
  const { page } = handle;
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
  out = await page.evaluate(async ({ ENCOUNTER, FLAG, QUEST, SIGN, CONTROL, RESOLUTIONS, MAIN, PLAN }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);

    // Play the INTENDED chain from the Soulrest quay exactly as `mainline-chain-floor.mjs`
    // does — greet the carter, then walk the acts — up to Q-MAIN-23, and branch there. This is
    // the only way to get the quest legitimately open, and it means the flag under test is
    // written by the same consequence pipeline a player would drive.
    // MAIN arrives as an argument
    const play = (resolutionId) => {
      H.setSeed(1337);
      H.loadState('soulrest-quay');
      H.setRenderRate(0);
      H.setGold(100000);
      H.setCharacter({ race: 'dunmer', upbringing: 'interior', class: 'reed-walker', birthsign: 'raj-xul' });
      H.talkTo('bone-ladder-carter'); H.conversationClose();
      const steps = [];
      let reached = false, resolved = null, err = null; const revealResults = [];
      for (const id of MAIN) {
        const o = H.questOpen(id);
        if (!o.ok) { steps.push(id + ' BLOCKED: ' + o.reason); break; }
        if (id === 'Q-MAIN-23') {
          reached = true;
          // Fire this quest's own reveals/notes too — the sign branch carries
          // `requires_knowing: ['rev_why_the_clause']`, whose channel is `talk_to_target`.
          const qd23 = PLAN[id] || { reveals: [], notes: [] };
          for (const rv of qd23.reveals) { try { revealResults.push([rv, JSON.stringify(H.questReveal(id, rv))]); } catch (e) { revealResults.push([rv, 'THREW ' + e.message]); } }
          for (const ix of qd23.notes) { try { H.questNote(id, ix); } catch (e) {} }
          const before = !!(H.getQuestState().flags || {})[FLAG];
          try { resolved = H.questResolve(id, resolutionId); } catch (e) { err = String(e && e.message || e); }
          const after = !!(H.getQuestState().flags || {})[FLAG];
          steps.push('Q-MAIN-23 ' + resolutionId + ' resolved=' + !!(resolved && resolved.ok) + ' flag ' + before + '->' + after);
          var flagBefore = before, flagAfter = after;
          break;
        }
        // Mirror `mainline-chain-floor.mjs`: a resolution only becomes available once the
        // quest's reveals have fired and its mid-quest journal notes have been reached.
        const qd = PLAN[id] || { reveals: [], notes: [] };
        for (const rv of qd.reveals) { try { H.questReveal(id, rv); } catch (e) {} }
        for (const ix of qd.notes) { try { H.questNote(id, ix); } catch (e) {} }
        const avail = H.questResolutions(id);
        const pick = avail.find((a) => a.available && a.violence_required === false) || avail.find((a) => a.available);
        if (!pick) { steps.push(id + ' NO RESOLUTION'); break; }
        const r = H.questResolve(id, pick.id);
        if (!r.ok) { steps.push(id + ' RESOLVE REFUSED ' + r.reason); break; }
        steps.push(id + ' ' + pick.id);
      }
      const flags = H.getQuestState().flags || {};
      // Now ask the WORLD what turns up on the road.
      const r2 = H.spawnEncounter(ENCOUNTER, 0, 12);
      const st = H.getEncounterState(ENCOUNTER);
      const byRole = {};
      for (const m of st.members) byRole[m.role] = (byRole[m.role] || 0) + 1;
      return {
        resolution: resolutionId,
        reached_q23: reached,
        resolved_ok: !!(resolved && resolved.ok), resolve_reason: resolved ? resolved.reason : null,
        error: err,
        flag_before: typeof flagBefore === 'boolean' ? flagBefore : null,
        flag_after: !!flags[FLAG],
        steps_n: steps.length, last_steps: steps.slice(-3), reveal_results: revealResults,
        bodies: r2.eids.length, by_role: byRole,
        statblocks: [...new Set(st.members.map((m) => m.statblock))].sort(),
        hp_max: [...new Set(st.members.map((m) => m.hp_max))].sort((a, b) => a - b),
        poise_max: [...new Set(st.members.map((m) => m.poise_max))].sort((a, b) => a - b),
      };
    };

    // Which other resolutions does this quest even have? The control has to be a real branch.
    return { available_resolutions: RESOLUTIONS, signed: play(SIGN), control: play(CONTROL) };
  }, { ENCOUNTER, FLAG, QUEST, SIGN, CONTROL, RESOLUTIONS, MAIN, PLAN });
} finally { await handle.close(); }

const s = out.signed, c = out.control;
console.log(`\n  ${QUEST} resolutions in the running build: ${out.available_resolutions.join(', ')}`);
console.log(`\n  SIGNED  (${s.resolution})`);
console.log(`     opened ${s.opened_ok}   resolved ${s.resolved_ok} ${s.resolve_reason ? '(' + s.resolve_reason + ')' : ''} ${s.error ? 'ERR ' + s.error : ''}`);
console.log(`     flag '${FLAG}'  before ${s.flag_before}  ->  after ${s.flag_after}   <-- set BY PLAYING, not by hand`);
console.log(`     raid party ${s.bodies} bodies ${JSON.stringify(s.by_role)}  hp_max ${JSON.stringify(s.hp_max)}  poise ${JSON.stringify(s.poise_max)}`);
if (c) {
  console.log(`\n  CONTROL (${c.resolution})`);
  console.log(`     opened ${c.opened_ok}   resolved ${c.resolved_ok} ${c.resolve_reason ? '(' + c.resolve_reason + ')' : ''} ${c.error ? 'ERR ' + c.error : ''}`);
  console.log(`     flag '${FLAG}'  before ${c.flag_before}  ->  after ${c.flag_after}`);
  console.log(`     raid party ${c.bodies} bodies ${JSON.stringify(c.by_role)}  hp_max ${JSON.stringify(c.hp_max)}  poise ${JSON.stringify(c.poise_max)}`);
}

const playedSetsFlag = s.resolved_ok && !s.flag_before && s.flag_after;
const branchesDiffer = !!c && s.bodies !== c.bodies;
const statsHeld = !!c && JSON.stringify(s.hp_max) === JSON.stringify(c.hp_max)
  && JSON.stringify(s.poise_max) === JSON.stringify(c.poise_max)
  && JSON.stringify(s.statblocks) === JSON.stringify(c.statblocks);

console.log(`\n  resolving the quest SETS the flag in the live world   ${playedSetsFlag ? 'YES' : 'NO'}`);
console.log(`  the two branches give different fields                ${branchesDiffer ? 'YES' : 'NO'}`);
console.log(`  no stat moved between the branches (AR-1)             ${statsHeld ? 'YES' : 'NO'}`);

writeJson(path.join(outDir, 'ar3-endtoend.json'), { tool: 'critic-ar3-endtoend', quest: QUEST, flag: FLAG, encounter: ENCOUNTER, played_sets_flag: playedSetsFlag, branches_differ: branchesDiffer, stats_held: statsHeld, ...out });
console.log(`\nwrote ${path.join(outDir, 'ar3-endtoend.json')}`);
process.exit(playedSetsFlag && branchesDiffer && statsHeld ? 0 : 1);
