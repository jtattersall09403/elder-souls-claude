#!/usr/bin/env node
// mainline-trace.mjs — W1-19's deliverable: the main quest, played end to end, in the browser,
// through the shipped QuestEngine, with a trace instead of a claim.
//
// It walks two chains from one seed:
//   * `intended`  — Acts I..V to `Q-MAIN-28`, taking a non-violent resolution at every step and
//                   holding NO faction rank and NO gold, which is RI-QST06's "completable while
//                   locked out of every faction, at higher cost".
//   * `backpath`  — Acts I..III, then the cut, then `Q-MAIN-31`, reaching an ending by breaking
//                   the intended path.
// It then diffs the two ending world states.
//
// The instrument is meant to be able to fail, and was checked against three sabotages before it
// was trusted (--sabotage below); a probe that cannot go red is worse than no probe
// (AGENT-PROTOCOL "Two failure modes"). Nothing here writes a verdict.
//
//   node tools/quests/mainline-trace.mjs [--out <dir>] [--json] [--sabotage <name>]
//
// Sabotages, each of which MUST make the run fail:
//   drop-topic     — never seed the opening topic; every quest should refuse to open
//   drop-reveal    — never learn any truth; every knowledge-gated resolution should refuse
//   drop-dispo     — zero the disposition table; every giver with a disposition_min should refuse
//
// Exit 0 only if both chains complete and every declared assertion holds.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mainline-trace.mjs — the main quest played end to end in the browser, twice, with a trace.

USAGE
  node tools/quests/mainline-trace.mjs [--out <dir>] [--json] [--sabotage drop-topic|drop-reveal|drop-dispo]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-MAINLINE');
ensureDir(outDir);
const sabotage = args.sabotage ? String(args.sabotage) : null;

// ---- the walk plan, built node-side from the shipped quest files ---------------------------
// Nothing here invents a step: the order is the quests' own `opens_by.prerequisite_quests`, the
// reveals are the quests' own `deceit.revealed_by[].id`, and the resolution chosen is the first
// one the ENGINE reports as available. The plan tells the probe which quests to attempt; the
// engine decides whether any of it is legal.
const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));

const INTENDED = [
  ...mainline.acts.flatMap((a) => a.quests),
  ...mainline.aftermath.quests,
];
const BACKPATH = [
  ...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests),
  'Q-MAIN-29', 'Q-MAIN-31',
];

const planFor = (ids) => ids.map((id) => {
  const q = defs[id];
  if (!q) throw new Error(`mainline-trace: ${id} is not in game/data/quests/**`);
  return {
    id,
    topic: q.opens_by.topic,
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    // every non-terminal entry, so the journal records the middle of the quest and not only
    // its beginning and its end
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch')
      .map((e) => e.index).filter((i) => i > 10),
    branches: (q.branches || []).map((b) => ({ id: b.id, at: b.at_journal_index })),
    // resolutions the probe is ALLOWED to take, in preference order: never violent, and on the
    // backpath chain prefer the betray/steal routes that the fiction says that chain takes
    resolutions: (q.resolutions || []).filter((r) => !r.violence_required).map((r) => r.id),
    all_resolutions: (q.resolutions || []).map((r) => ({ id: r.id, violent: !!r.violence_required })),
  };
});

// The two chains diverge at Q-MAIN-14: the backpath needs the skei taken, the intended chain
// does not care. Declared here rather than discovered, because it is a plot fact.
const PREFER = {
  intended: { 'Q-MAIN-14': 'res_give_it_back', 'Q-MAIN-28': 'res_open_the_count' },
  backpath: { 'Q-MAIN-14': 'res_take_the_skei', 'Q-MAIN-31': 'res_drain_past_the_roots' },
};

const plans = { intended: planFor(INTENDED), backpath: planFor(BACKPATH) };

// ---- run -------------------------------------------------------------------------------------
const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let report;
try {
  report = await handle.page.evaluate(async ({ plans, prefer, seedTopic, sabotage }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);

    const runChain = (name, plan) => {
      H.setSeed(1337);
      H.loadState('arena_flat');
      H.setRenderRate(0);

      const out = { chain: name, steps: [], journal: [], events: [], problems: [], gold_spent: 0 };

      // A player with nothing: no faction rank anywhere, no gold, no standing bought.
      // RI-QST06: "Main quest completable while locked out of every faction, at higher cost."
      H.setGold(0);

      if (sabotage === 'drop-dispo') {
        for (const k of Object.keys(H.getDispositions())) H.setDisposition(k, 0);
      }

      if (sabotage !== 'drop-topic') H.learnTopic(seedTopic);

      for (const step of plan) {
        const rec = { quest: step.id, opened: null, reveals: [], notes: [], resolution: null, why: null };

        // topics the quest needs and that the chain has not yet written into the journal
        if (sabotage !== 'drop-topic') {
          H.learnTopic(step.topic);
          for (const t of step.prereq_topics) H.learnTopic(t);
        }

        const o = H.questOpen(step.id);
        rec.opened = o.ok ? o.stage : false;
        if (!o.ok) { rec.why = o.reason; out.problems.push(`${step.id}: could not open — ${o.reason}`); out.steps.push(rec); break; }

        // learn what this quest can teach, which is the only way `requires_knowing` is satisfied
        if (sabotage !== 'drop-reveal') {
          for (const r of step.reveals) {
            const rr = H.questReveal(step.id, r);
            if (rr.ok) rec.reveals.push(r);
          }
        }

        // walk the middle of the quest: every non-terminal entry the file declares
        for (const ix of step.notes) {
          const n = H.questNote(step.id, ix);
          if (n.ok) rec.notes.push(ix);
        }

        const avail = H.questResolutions(step.id);
        const want = prefer[name] && prefer[name][step.id];
        const pick = (want && avail.find((a) => a.id === want && a.available))
          || avail.find((a) => a.available && a.violence_required === false)
          || avail.find((a) => a.available);
        if (!pick) {
          rec.why = avail.map((a) => `${a.id}: ${a.why.join('; ')}`).join(' | ');
          out.problems.push(`${step.id}: no resolution available — ${rec.why}`);
          out.steps.push(rec);
          break;
        }
        const res = H.questResolve(step.id, pick.id);
        if (!res.ok) { rec.why = res.reason; out.problems.push(`${step.id}: resolve refused — ${res.reason}`); out.steps.push(rec); break; }
        rec.resolution = { id: pick.id, method: pick.method, violent: !!pick.violence_required };
        out.steps.push(rec);
      }

      const st = H.getQuestState();
      out.journal = st.journal;
      out.completed = st.completed;
      out.flags = st.flags;
      out.topics_known = st.topicsKnown;
      out.events = H.questEventsDrain();
      out.factions = st.factions;
      return out;
    };

    const intended = runChain('intended', plans.intended);
    const backpath = runChain('backpath', plans.backpath);
    return { schema: 'elder-souls/mainline-trace@1', harness_version: H.version, intended, backpath };
  }, { plans, prefer: PREFER, seedTopic: 'the drowned tally', sabotage });
} finally {
  await handle.close();
}

// ---- assertions ------------------------------------------------------------------------------
const A = [];
const assert = (id, label, value, ok, bar) => A.push({ id, label, value, bar, pass: ok });

for (const name of ['intended', 'backpath']) {
  const c = report[name];
  const want = name === 'intended' ? INTENDED : BACKPATH;
  assert(`${name}.complete`, `every quest in the ${name} chain resolved`,
    `${c.completed.filter((id) => want.includes(id)).length}/${want.length}`,
    want.every((id) => c.completed.includes(id)), 'all');
  assert(`${name}.problems`, `${name} chain problems`, c.problems, c.problems.length === 0, 'none');
  const violent = c.steps.filter((s) => s.resolution && s.resolution.violent).map((s) => s.quest);
  assert(`${name}.nonlethal`, `${name} chain quests resolved with violence`, violent, violent.length === 0, '0');
  assert(`${name}.journal`, `${name} chain journal entries written`, c.journal.length, c.journal.length >= 100, '>= 100');
  const firstPerson = c.journal.filter((e) => /\b(I|my|me)\b/.test(e.text)).length;
  assert(`${name}.firstperson`, `${name} journal entries in first person`, `${firstPerson}/${c.journal.length}`,
    c.journal.length > 0 && firstPerson === c.journal.length, '100%');
  const dated = c.journal.filter((e) => e.date && /\d/.test(e.date)).length;
  assert(`${name}.dated`, `${name} journal entries carrying a date`, `${dated}/${c.journal.length}`,
    c.journal.length > 0 && dated === c.journal.length, '100%');
}

const endingFlags = (c) => new Set(Object.keys(c.flags).filter((f) => c.flags[f]));
const fa = endingFlags(report.intended), fb = endingFlags(report.backpath);
const flagDelta = [...new Set([...[...fa].filter((f) => !fb.has(f)), ...[...fb].filter((f) => !fa.has(f))])];
assert('endings.delta', 'world flags differing between the two ending states', flagDelta.length, flagDelta.length >= 25, '>= 25');
assert('endings.distinct', 'the two chains reach different ending flags',
  { intended: [...fa].filter((f) => f.startsWith('ending_')), backpath: [...fb].filter((f) => f.startsWith('ending_')) },
  [...fa].filter((f) => f.startsWith('ending_')).every((f) => !fb.has(f)) && [...fb].some((f) => f.startsWith('ending_')), 'disjoint and non-empty');
assert('ponr.crossed', 'the intended chain crossed the point of no return', !!report.intended.flags.point_of_no_return_crossed, !!report.intended.flags.point_of_no_return_crossed, 'true');
assert('mark.irreversible', 'the Act III mark is set and no chain clears it',
  { intended: !!report.intended.flags.player_reissue_is_degraded, backpath: !!report.backpath.flags.player_reissue_is_degraded },
  !!report.intended.flags.player_reissue_is_degraded && !!report.backpath.flags.player_reissue_is_degraded, 'both true');

// AR-2 / RI-JRN07 U9: nothing in a written journal entry may be a marker.
const MARKER = /\b(marked on|on your map|quest ?log|objective|waypoint|marker|the compass|mini-?map|hud|fast[- ]travel)\b/i;
const markerHits = [...report.intended.journal, ...report.backpath.journal].filter((e) => MARKER.test(e.text));
assert('jrn07.U9', 'marker_count in the written journal', markerHits.length, markerHits.length === 0, '0');

// One entry per stage advanced, no duplicates within a quest (RI-JRN07 U7).
const dupes = [];
for (const c of [report.intended, report.backpath]) {
  const seen = new Set();
  for (const e of c.journal) { const k = `${c.chain}:${e.quest}#${e.n}`; if (seen.has(k)) dupes.push(k); seen.add(k); }
}
assert('jrn07.U7', 'duplicate journal entries for the same stage', dupes, dupes.length === 0, '0');

const failed = A.filter((a) => !a.pass);
const out = {
  ...report,
  tool: 'tools/quests/mainline-trace.mjs',
  sabotage,
  assertions: A,
  ok: failed.length === 0,
  chains: { intended: INTENDED, backpath: BACKPATH },
  ending_flag_delta: flagDelta.sort(),
};

writeJson(path.join(outDir, sabotage ? `mainline-trace.${sabotage}.json` : 'mainline-trace.json'), out);
// The trace as prose, which is the thing a critic actually reads.
if (!sabotage) {
  const lines = [];
  for (const name of ['intended', 'backpath']) {
    lines.push(`\n=== ${name.toUpperCase()} CHAIN ===\n`);
    for (const e of report[name].journal) lines.push(`[${String(e.n).padStart(3)}] ${e.date} — ${e.quest}\n    ${e.text}\n`);
  }
  fs.writeFileSync(path.join(outDir, 'mainline-journal.txt'), lines.join('\n'));
}

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nmainline trace${sabotage ? ` [SABOTAGE ${sabotage}]` : ''}\n`);
  for (const name of ['intended', 'backpath']) {
    const c = report[name];
    console.log(`  ${name}: ${c.steps.length} quests attempted, ${c.completed.length} completed, ${c.journal.length} journal entries`);
    for (const p of c.problems) console.log(`     ! ${p}`);
  }
  console.log('');
  for (const a of A) console.log(`  ${(a.pass ? 'PASS' : 'FAIL').padEnd(5)} ${a.id.padEnd(22)} ${a.label} = ${JSON.stringify(a.value)}  [${a.bar}]`);
  console.log(`\n  wrote ${outDir}\n`);
}
process.exit(failed.length ? 1 : 0);
