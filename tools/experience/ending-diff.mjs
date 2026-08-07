#!/usr/bin/env node
// ending-diff.mjs — RI-EXP05 "Comparison method" Step 3, executed as far as this build allows.
//
// Written by the W1-19 builder under orchestration/TOOL-LOOP.md: RI-EXP05 names this command and
// it did not exist on disk (corpus-index C8). The item's specification:
//
//   "exports, for each route: final getQuestState().flags, the final journal, and — via loadState
//    on each ending's state-out.json — a scripted sweep asking the same 6 topics of the same 40
//    named NPCs in both worlds. Emits world_flag_delta, npc_reaction_delta (string-inequality on
//    response ids, not on prose similarity), and availability_delta. The sweep is the
//    load-bearing part."
//
// WHAT THIS BUILD CAN AND CANNOT ANSWER, stated rather than papered over:
//
//   * `world_flag_delta`   — answerable. Both routes are played here, in the browser, through the
//                            shipped QuestEngine, and the final flag sets are diffed.
//   * `availability_delta` — answerable. After each ending the same set of quests is offered to
//                            the engine and the refusals are compared.
//   * `npc_reaction_delta` — NOT answerable on this build, and the tool says so and exits
//                            non-zero. It needs a topic system that returns a response id per
//                            (npc, topic) pair. `game/data/dialogue/topics/` holds topic bodies
//                            but there is no `askTopic(npc, topic) -> response_id` verb on
//                            window.__HARNESS, so string-inequality on response ids has nothing
//                            to compare. That is W1-17's path (`dialogue.topics.*`), not this
//                            piece's, and reporting it as 0 would be a pass by absence.
//
// RI-EXP05's hard fail 1 is `world_flag_delta < 5` OR `npc_reaction_delta == 0`. This tool
// therefore CANNOT clear that hard fail on its own and does not pretend to: it exits 3 with
// `npc_reaction_delta: unmeasurable` so the state is a declared corpus/build debt rather than a
// silent pass.
//
//   node tools/experience/ending-diff.mjs [--a <resolution id>] [--b <resolution id>] [--out <dir>]

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
ending-diff.mjs — RI-EXP05 step 3: diff the two ending world states.

USAGE
  node tools/experience/ending-diff.mjs [--a res_open_the_count] [--b res_drain_past_the_roots] [--out <dir>]

Exit 0 = both routes reached and every measurable check passed.
Exit 3 = the measurable checks passed and npc_reaction_delta is unmeasurable on this build.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-ENDING-DIFF');
ensureDir(outDir);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));

const RES_A = args.a ? String(args.a) : 'res_open_the_count';
const RES_B = args.b ? String(args.b) : 'res_drain_past_the_roots';
const endA = (mainline.endings || []).find((e) => e.resolution === RES_A);
const endB = (mainline.endings || []).find((e) => e.resolution === RES_B);
if (!endA || !endB) { console.error(`ending-diff: mainline.json declares no ending for ${RES_A} and/or ${RES_B}`); process.exit(2); }

const chainFor = (ending) => {
  const acts = mainline.acts.flatMap((a) => a.quests);
  return ending.route === 'backpath'
    ? [...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests), 'Q-MAIN-29', 'Q-MAIN-31']
    : acts;
};
const planFor = (ids) => ids.map((id) => {
  const q = defs[id];
  return {
    id,
    topic: q.opens_by.topic,
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch').map((e) => e.index).filter((i) => i > 10),
  };
});

const routes = {
  A: { ending: endA, plan: planFor(chainFor(endA)), prefer: { 'Q-MAIN-14': 'res_give_it_back', 'Q-MAIN-28': RES_A } },
  B: { ending: endB, plan: planFor(chainFor(endB)), prefer: { 'Q-MAIN-14': 'res_take_the_skei', 'Q-MAIN-31': RES_B } },
};

// The availability sweep: the same question asked of both worlds.
const SWEEP_QUESTS = Object.keys(defs).sort();

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let live;
try {
  live = await handle.page.evaluate(async ({ routes, sweep }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const run = (r) => {
      H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.setGold(0);
      H.learnTopic('the drowned tally');
      const problems = [];
      for (const step of r.plan) {
        H.learnTopic(step.topic);
        for (const t of step.prereq_topics) H.learnTopic(t);
        const o = H.questOpen(step.id);
        if (!o.ok) { problems.push(`${step.id}: ${o.reason}`); break; }
        for (const rev of step.reveals) H.questReveal(step.id, rev);
        for (const ix of step.notes) H.questNote(step.id, ix);
        const avail = H.questResolutions(step.id).filter((a) => a.available);
        const want = r.prefer[step.id];
        const pick = (want && avail.find((a) => a.id === want)) || avail.find((a) => a.violence_required === false) || avail[0];
        if (!pick) { problems.push(`${step.id}: no resolution available`); break; }
        const res = H.questResolve(step.id, pick.id);
        if (!res.ok) { problems.push(`${step.id}: ${res.reason}`); break; }
      }
      const s = H.getQuestState();
      const s0completed = s.completed;
      // availability sweep — the same list offered to both worlds
      // Tri-state, not a boolean. `questOffers().offerable` is false both for a quest that is
      // finished and for a quest that is walled off, and those are opposite availabilities.
      // Collapsing them to one bit is what made the first run of this tool report a delta of 0
      // between two worlds that differ in 117 flags.
      const done = new Set(s0completed);
      const offers = {};
      for (const o of H.questOffers()) {
        if (!sweep.includes(o.id)) continue;
        const state = done.has(o.id) ? 'done' : (o.offerable ? 'offerable' : `blocked:${(o.why[0] || 'unknown').replace(/"[^"]*"/g, '<topic>')}`);
        offers[o.id] = { state, why: o.why };
      }
      return {
        flags: { ...s.flags },
        completed: s.completed.slice(),
        journal: s.journal,
        factions: s.factions,
        dispositions: s.dispositions,
        offers,
        problems,
      };
    };
    return { A: run(routes.A), B: run(routes.B) };
  }, { routes, sweep: SWEEP_QUESTS });
} finally {
  await handle.close();
}

const setOf = (o) => new Set(Object.keys(o.flags).filter((f) => o.flags[f]));
const fa = setOf(live.A), fb = setOf(live.B);
const flagDelta = [...new Set([...[...fa].filter((f) => !fb.has(f)), ...[...fb].filter((f) => !fa.has(f))])].sort();

const availDelta = SWEEP_QUESTS.filter((id) => {
  const a = live.A.offers[id], b = live.B.offers[id];
  if (!a || !b) return false;
  return a.state !== b.state;
});

// disposition delta — the closest thing this build has to an NPC reaction, and NOT a substitute
// for the topic sweep. Reported as evidence, never as npc_reaction_delta.
const dispKeys = [...new Set([...Object.keys(live.A.dispositions), ...Object.keys(live.B.dispositions)])];
const dispDelta = dispKeys.filter((k) => (live.A.dispositions[k] || 0) !== (live.B.dispositions[k] || 0));

const M = [];
const metric = (id, label, value, ok, bar) => M.push({ id, label, value, bar, pass: ok });
metric('routes.A', `route A (${endA.id}) completed`, live.A.problems, live.A.problems.length === 0, 'no problems');
metric('routes.B', `route B (${endB.id}) completed`, live.B.problems, live.B.problems.length === 0, 'no problems');
metric('world_flag_delta', 'world_flag_delta', flagDelta.length, flagDelta.length >= 25, '>= 25 (LH12); hard fail < 5');
metric('availability_delta', 'availability_delta — quests whose availability state (done / offerable / blocked-and-why) differs by route',
  { n: availDelta.length, examples: availDelta.slice(0, 6).map((id) => ({ id, A: live.A.offers[id].state, B: live.B.offers[id].state })) },
  availDelta.length >= 3, '>= 3');
metric('ending_flags_disjoint', 'the two routes set different ending_* flags',
  { A: [...fa].filter((f) => f.startsWith('ending_')), B: [...fb].filter((f) => f.startsWith('ending_')) },
  [...fa].filter((f) => f.startsWith('ending_')).every((f) => !fb.has(f)), 'disjoint');
metric('disposition_delta', 'named NPCs whose standing differs by route (evidence, NOT npc_reaction_delta)', dispDelta.length, dispDelta.length > 0, '> 0');

const unmeasurable = [{
  id: 'npc_reaction_delta',
  why: 'RI-EXP05 step 3 requires the same 6 topics asked of the same 40 named NPCs in both loaded ending states, compared by response id. There is no askTopic(npc, topic) -> response_id verb on window.__HARNESS and no per-NPC response id in game/data/dialogue/topics/**, so there is nothing to compare by string inequality. This is W1-17\'s path (dialogue.topics.*). Reported as unmeasurable and NOT as 0, because 0 would clear a bar by absence, and RI-EXP05 hard fail 1 keys on npc_reaction_delta == 0.',
  blocks: 'RI-EXP05 LH12 cannot be fully cleared by this tool. world_flag_delta and availability_delta are answered; the sweep is not.',
}];

const failed = M.filter((m) => !m.pass);
const out = {
  schema: 'elder-souls/ending-diff@1',
  tool: 'tools/experience/ending-diff.mjs',
  written_by: 'W1-19 under orchestration/TOOL-LOOP.md — RI-EXP05 step 3 named this command and it did not exist',
  at: new Date().toISOString(),
  routes: { A: endA, B: endB },
  world_flag_delta: flagDelta,
  availability_delta: availDelta,
  disposition_delta: dispDelta,
  journals: { A: live.A.journal.length, B: live.B.journal.length },
  metrics: M,
  unmeasurable,
  ok: failed.length === 0,
};
writeJson(path.join(outDir, 'ending-diff.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nending-diff — ${endA.id} vs ${endB.id}\n`);
  for (const m of M) console.log(`  ${(m.pass ? 'PASS' : 'FAIL').padEnd(5)} ${m.id.padEnd(20)} ${m.label} = ${JSON.stringify(m.value).slice(0, 200)}  [${m.bar}]`);
  console.log('\n  UNMEASURABLE ON THIS BUILD:');
  for (const u of unmeasurable) console.log(`    ${u.id}: ${u.why}`);
  console.log(`\n  wrote ${outDir}\n`);
}
process.exit(failed.length ? 1 : 3);
