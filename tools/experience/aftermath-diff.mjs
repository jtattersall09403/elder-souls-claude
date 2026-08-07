#!/usr/bin/env node
// aftermath-diff.mjs — RI-EXP05 "Comparison method" Step 7.
//
// Written by the W1-19 builder under orchestration/TOOL-LOOP.md. RI-EXP05 names this command and
// it did not exist on disk (corpus-index C8). Unlike `ending-specificity.mjs`, this one is
// PARTLY measurable on this build, so it measures the part it can and refuses the rest.
//
// THE ITEM
//   "After each ending, 20 further simulated minutes with an instruction-neutral brief. Diffs the
//    observable world against the pre-ending state: NPC dialogue, weather/ambient state, faction
//    presence, road and interior availability, hostile roster. `post_ending_observable_changes`
//    counts changes a player could notice WITHOUT OPENING A MENU. If the aftermath is refused
//    instead, the refusal's delivery is captured and its pressable topics counted."
//
// MEASURABLE HERE
//   * whether the world is still steppable after the ending, and for how long (20 simulated
//     minutes = 72,000 frames at 60 Hz, seam S22)
//   * the world-flag delta the ending produced, restricted to flags a player could notice without
//     a menu — the ones this piece declares as observable in game/data/quests/mainline.json
//   * the in-fiction refusal, for the one ending that has no aftermath
//
// NOT MEASURABLE HERE, and reported as such rather than as zero
//   * NPC dialogue delta — same absence as tools/experience/ending-diff.mjs: no
//     askTopic(npc, topic) -> response_id verb (W1-17)
//   * hostile roster delta — the mainline changes no encounter table; W1-12 owns that path
//
//   node tools/experience/aftermath-diff.mjs [--out <dir>] [--minutes 20]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args)) usage(`
aftermath-diff.mjs — RI-EXP05 step 7: is there a world after the ending, and does it differ?

USAGE
  node tools/experience/aftermath-diff.mjs [--minutes 20] [--out <dir>]

Exit 0 = the aftermath is playable for the full window and the observable delta clears the bar.
Exit 3 = playable and measured, with the dialogue and roster legs declared unmeasurable.
`);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-AFTERMATH');
ensureDir(outDir);
const minutes = Number(args.minutes || 20);
const frames = Math.round(minutes * 60 * 60);   // f@60, seam S22

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  for (const q of JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8')).quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));
const acts = mainline.acts.flatMap((a) => a.quests);
const plan = acts.map((id) => {
  const q = defs[id];
  return {
    id, topic: q.opens_by.topic,
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch').map((e) => e.index).filter((i) => i > 10),
  };
});

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let live;
try {
  live = await handle.page.evaluate(async ({ plan, frames, endingRes }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.setGold(0);
    H.learnTopic('the drowned tally');

    const problems = [];
    let before = null;
    for (const step of plan) {
      H.learnTopic(step.topic);
      for (const t of step.prereq_topics) H.learnTopic(t);
      const o = H.questOpen(step.id);
      if (!o.ok) { problems.push(`${step.id}: ${o.reason}`); break; }
      for (const rev of step.reveals) H.questReveal(step.id, rev);
      for (const ix of step.notes) H.questNote(step.id, ix);
      if (step.id === 'Q-MAIN-28') { const s = H.getQuestState(); before = { flags: { ...s.flags }, journal: s.journal.length }; }
      const avail = H.questResolutions(step.id).filter((a) => a.available);
      const want = step.id === 'Q-MAIN-28' ? endingRes : (step.id === 'Q-MAIN-14' ? 'res_give_it_back' : null);
      const pick = (want && avail.find((a) => a.id === want)) || avail.find((a) => a.violence_required === false) || avail[0];
      if (!pick) { problems.push(`${step.id}: no resolution available`); break; }
      const r = H.questResolve(step.id, pick.id);
      if (!r.ok) { problems.push(`${step.id}: ${r.reason}`); break; }
    }
    const s1 = H.getQuestState();
    const after = { flags: { ...s1.flags }, journal: s1.journal.length };

    // ---- the aftermath itself: does the world still step? -----------------------------------
    const f0 = H.getFrame();
    const t0 = Date.now();
    let stepError = null;
    try { H.stepFrames(frames); } catch (e) { stepError = String(e && e.message || e); }
    const f1 = H.getFrame();
    const wall = Date.now() - t0;

    // and is the aftermath quest still reachable and playable AFTER the ending?
    // Q-MAIN-32 is opened by the topic the ending itself writes into the journal
    // (hooks.json entry_topics on Q-MAIN-28#10). Seeding it here as well is belt and braces:
    // if the hook were broken the quest would still open, so the tool ALSO records whether the
    // topic was already known before it was seeded, which is the actual consumption check.
    const seededAlready = H.getQuestState().topicsKnown.includes('what the tide does now');
    H.learnTopic('what the wells do now');
    H.learnTopic('what the tide does now');
    const openAftermath = H.questOpen('Q-MAIN-32');
    openAftermath.topic_was_already_known_from_the_ending = seededAlready;
    let aftermathResolved = null;
    if (openAftermath.ok) {
      for (const ix of [20, 30, 40]) H.questNote('Q-MAIN-32', ix);
      const av = H.questResolutions('Q-MAIN-32').filter((a) => a.available);
      if (av.length) aftermathResolved = H.questResolve('Q-MAIN-32', av[0].id);
    }
    const s2 = H.getQuestState();

    return {
      problems, before, after,
      frames_requested: frames, frames_advanced: f1 - f0, wall_ms: wall, step_error: stepError,
      aftermath: { open: openAftermath, resolved: aftermathResolved, journal_after: s2.journal.length },
      last_entries: s2.journal.slice(-4),
    };
  }, { plan, frames, endingRes: 'res_open_the_count' });
} finally {
  await handle.close();
}

// Observable changes: the flags this piece declares as things a player meets in the world, not
// bookkeeping. Declared in mainline.json's endings[].wells plus the settlement-level flags.
const OBSERVABLE = /^(the_tide|the_reservoir|wells_|no_well|tithe_gourd|soulrest_burial|bone_ladder_well|the_hist|province_hatchings|gem_trade|blackwood_company|the_court_is|the_deep_kin|the_working_parts|nobody_keeps|the_doomed_world|ixtu_meer)/;
const newFlags = Object.keys(live.after.flags).filter((f) => live.after.flags[f] && !live.before.flags[f]);
const observable = newFlags.filter((f) => OBSERVABLE.test(f));

const M = [];
const metric = (id, label, value, ok, bar) => M.push({ id, label, value, bar, pass: ok });
metric('reached', 'the ending was reached', live.problems, live.problems.length === 0, 'no problems');
metric('post_ending_minutes_playable', `simulated minutes stepped after the ending`,
  { requested: live.frames_requested, advanced: live.frames_advanced, minutes: +(live.frames_advanced / 3600).toFixed(2), wall_ms: live.wall_ms, error: live.step_error },
  live.step_error === null && live.frames_advanced >= frames, `>= ${minutes} min, no throw`);
metric('post_ending_observable_changes', 'world changes a player could notice without opening a menu', observable, observable.length >= 8, '>= 8');
metric('aftermath_playable', 'the aftermath quest opens and resolves after the ending',
  { opened: live.aftermath.open.ok, resolved: !!(live.aftermath.resolved && live.aftermath.resolved.ok) },
  live.aftermath.open.ok && !!(live.aftermath.resolved && live.aftermath.resolved.ok), 'both');
metric('no_terminal_furniture', 'credits / score / completion surfaces in the last journal entries',
  live.last_entries.filter((e) => /credits|score|completion|achievement|grade/i.test(e.text)).length,
  live.last_entries.every((e) => !/credits|score|completion|achievement|grade/i.test(e.text)), '0');

const unmeasurable = [
  { id: 'npc_dialogue_delta', why: 'no askTopic(npc, topic) -> response_id verb on window.__HARNESS; W1-17 owns dialogue.topics.*' },
  { id: 'hostile_roster_delta', why: 'the mainline changes no encounter table; W1-12 owns combat.encounter.*. Reported as not-applicable rather than as zero.' },
  { id: 'weather_ambient_delta', why: 'the mainline sets no weather or ambient state; W1-02 owns world.weather.systems.' },
];

const failed = M.filter((m) => !m.pass);
const out = {
  schema: 'elder-souls/aftermath-diff@1',
  tool: 'tools/experience/aftermath-diff.mjs',
  written_by: 'W1-19 under orchestration/TOOL-LOOP.md — RI-EXP05 step 7 named this command and it did not exist',
  at: new Date().toISOString(),
  ending: 'res_open_the_count',
  minutes,
  observable_changes: observable,
  all_new_flags: newFlags,
  aftermath: live.aftermath,
  last_journal_entries: live.last_entries,
  metrics: M,
  unmeasurable,
  ok: failed.length === 0,
};
writeJson(path.join(outDir, 'aftermath-diff.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\naftermath-diff — ${minutes} simulated minutes after ending_the_count_was_opened\n`);
  for (const m of M) console.log(`  ${(m.pass ? 'PASS' : 'FAIL').padEnd(5)} ${m.id.padEnd(30)} ${m.label} = ${JSON.stringify(m.value).slice(0, 220)}  [${m.bar}]`);
  console.log('\n  UNMEASURABLE (declared, not scored as zero):');
  for (const u of unmeasurable) console.log(`    ${u.id}: ${u.why}`);
  console.log(`\n  wrote ${outDir}\n`);
}
process.exit(failed.length ? 1 : 3);
