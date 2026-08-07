#!/usr/bin/env node
// mainline-race-trace.mjs — CAN EVERY RACE AND UPBRINGING FINISH THE MAIN QUEST?
//
// Written by the W1-19 round-1 critic, declared under `orchestration/TOOL-LOOP.md`: the method
// this answers (re-run the completion trace for every signature) is named by the W1-19 critic
// dispatch and by `RI-QST06`'s "Main quest completable while locked out of every faction", and
// the tool did not exist. `tools/quests/mainline-trace.mjs` runs ONE character — whatever
// `loadState('arena_flat')` leaves in `sim.character` — and predates the wave-3 fix that made
// `QuestEngine.context()` return a race-derived disposition view. `tools/harness/
// chr-quest-race-gate.mjs` sweeps signatures but measures the OFFER GATE at a cold start with
// every topic hand-granted; it never plays a chain, so it cannot see a gate that only closes
// once the chain has moved standing around.
//
// This tool is the intersection: mainline-trace's two chains, run once per signature, through
// the shipping QuestEngine, in the browser.
//
//   node tools/quests/mainline-race-trace.mjs [--out <dir>] [--json] [--signatures <n>]
//                                             [--full]   (all 40 race x upbringing pairs)
//
// Exit 0 only if every signature completes both chains.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mainline-race-trace.mjs — the main quest played end to end, once per character signature.

USAGE
  node tools/quests/mainline-race-trace.mjs [--out <dir>] [--full] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R1-RACE');
ensureDir(outDir);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json')) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));

const INTENDED = [...mainline.acts.flatMap((a) => a.quests), ...mainline.aftermath.quests];
const BACKPATH = [
  ...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests),
  'Q-MAIN-29', 'Q-MAIN-31',
];

// Identical plan construction to tools/quests/mainline-trace.mjs, so a difference in the result
// is a difference in the character and in nothing else.
const planFor = (ids) => ids.map((id) => {
  const q = defs[id];
  if (!q) throw new Error(`mainline-race-trace: ${id} is not in game/data/quests/**`);
  return {
    id,
    topic: q.opens_by.topic,
    prereq_topics: q.opens_by.prerequisite_topics || [],
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => r.id),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch')
      .map((e) => e.index).filter((i) => i > 10),
    resolutions: (q.resolutions || []).filter((r) => !r.violence_required).map((r) => r.id),
  };
});
const PREFER = {
  intended: { 'Q-MAIN-14': 'res_give_it_back', 'Q-MAIN-28': 'res_open_the_count' },
  backpath: { 'Q-MAIN-14': 'res_take_the_skei', 'Q-MAIN-31': 'res_drain_past_the_roots' },
};
const plans = { intended: planFor(INTENDED), backpath: planFor(BACKPATH) };

const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const SIGS = [];
for (const r of RACES) for (const u of UPBRINGINGS) SIGS.push([r, u]);

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 600000) });
let report;
try {
  report = await handle.page.evaluate(async ({ plans, prefer, seedTopic, sigs }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);

    const runChain = (name, plan) => {
      const out = { chain: name, completed: [], blocked_at: null, why: null, violent: [], journal_n: 0 };
      for (const step of plan) {
        H.learnTopic(step.topic);
        for (const t of step.prereq_topics) H.learnTopic(t);
        const o = H.questOpen(step.id);
        if (!o.ok) { out.blocked_at = step.id; out.why = o.reason; break; }
        for (const r of step.reveals) { try { H.questReveal(step.id, r); } catch (e) { /* not offered */ } }
        for (const ix of step.notes) { try { H.questNote(step.id, ix); } catch (e) { /* not reachable */ } }
        const avail = H.questResolutions(step.id);
        const want = prefer[name] && prefer[name][step.id];
        const pick = (want && avail.find((a) => a.id === want && a.available))
          || avail.find((a) => a.available && a.violence_required === false)
          || avail.find((a) => a.available);
        if (!pick) {
          out.blocked_at = step.id;
          out.why = 'no resolution available — ' + avail.map((a) => `${a.id}: ${(a.why || []).join('; ')}`).join(' | ');
          break;
        }
        const res = H.questResolve(step.id, pick.id);
        if (!res.ok) { out.blocked_at = step.id; out.why = 'resolve refused — ' + res.reason; break; }
        if (pick.violence_required) out.violent.push(step.id);
        out.completed.push(step.id);
      }
      const st = H.getQuestState();
      out.journal_n = st.journal.length;
      out.flags_ending = Object.keys(st.flags).filter((f) => st.flags[f] && f.startsWith('ending_'));
      return out;
    };

    const rows = [];
    for (const [race, upbringing] of sigs) {
      const row = { race, upbringing, chains: {} };
      for (const name of ['intended', 'backpath']) {
        H.setSeed(1337);
        H.loadState('arena_flat');
        H.setRenderRate(0);
        H.setGold(0);
        // The one difference from mainline-trace.mjs: who the player is.
        H.setCharacter({ race, upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
        row.chains[name] = runChain(name, plans[name]);
      }
      // What the live gate thinks this signature stands at, for attribution.
      try {
        const view = H.getGateDispositions();
        row.disposition_sample = {
          'undersexton-aveline-rell': view['undersexton-aveline-rell'],
          'neeja-xul': view['neeja-xul'],
        };
      } catch (e) { row.disposition_sample = null; }
      rows.push(row);
    }
    return { schema: 'elder-souls/mainline-race-trace@1', harness_version: H.version, rows };
  }, { plans, prefer: PREFER, seedTopic: 'the drowned tally', sigs: SIGS });
} finally {
  await handle.close();
}

const A = [];
const assert = (id, label, value, ok, bar) => A.push({ id, label, value, bar, pass: ok });

const failures = [];
for (const row of report.rows) {
  for (const name of ['intended', 'backpath']) {
    const want = name === 'intended' ? INTENDED : BACKPATH;
    const c = row.chains[name];
    if (c.completed.length !== want.length) {
      failures.push(`${row.race}/${row.upbringing} ${name}: ${c.completed.length}/${want.length}, blocked at ${c.blocked_at} — ${c.why}`);
    }
  }
}
assert('race.every_signature_finishes', 'signatures completing both chains',
  `${report.rows.length - new Set(failures.map((f) => f.split(' ')[0])).size}/${report.rows.length}`,
  failures.length === 0, 'all');
assert('race.failures', 'signature/chain failures', failures, failures.length === 0, 'none');

const violent = report.rows.flatMap((r) => ['intended', 'backpath'].flatMap((n) => r.chains[n].violent));
assert('race.nonlethal', 'quests resolved with violence across all signatures', violent, violent.length === 0, '0');

const out = {
  tool: 'tools/quests/mainline-race-trace.mjs',
  ...report,
  chains: { intended: INTENDED, backpath: BACKPATH },
  signatures: SIGS.length,
  assertions: A,
  ok: A.every((a) => a.pass),
};
writeJson(path.join(outDir, 'mainline-race-trace.json'), out);

console.log(`\nmainline race trace — ${report.rows.length} signatures x 2 chains\n`);
for (const row of report.rows) {
  const i = row.chains.intended, b = row.chains.backpath;
  const mark = (c, want) => (c.completed.length === want ? 'ok ' : 'RED');
  console.log(`  ${(row.race + '/' + row.upbringing).padEnd(24)} intended ${mark(i, INTENDED.length)} ${String(i.completed.length).padStart(2)}/${INTENDED.length}   backpath ${mark(b, BACKPATH.length)} ${String(b.completed.length).padStart(2)}/${BACKPATH.length}` +
    (i.blocked_at ? `   [${i.blocked_at}: ${String(i.why).slice(0, 70)}]` : ''));
}
console.log('');
for (const a of A) console.log(`  ${a.pass ? 'PASS' : 'FAIL'}  ${a.id} — ${a.label} = ${JSON.stringify(a.value).slice(0, 300)}  [${a.bar}]`);
console.log(`\nwrote ${path.join(outDir, 'mainline-race-trace.json')}`);
process.exit(out.ok ? 0 : 1);
