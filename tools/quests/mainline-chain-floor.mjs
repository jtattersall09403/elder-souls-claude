#!/usr/bin/env node
// mainline-chain-floor.mjs — the main quest played by a person, with consequences accumulating.
//
// Written by the W1-19 ROUND-2 BUILDER and declared under `orchestration/TOOL-LOOP.md`. It exists
// because every instrument that certified the round-1 build measured the wrong moment or was fed
// the answer, and a builder that reports a number from the tool which certified the defect has
// graded itself:
//
//   * `tools/harness/chr-quest-race-gate.mjs` measures the offer gate at a COLD START. The
//     round-1 clamp was set from it, so all nine clamped gates ended with a worst-signature
//     margin of exactly 0 and the first point of erosion closed them.
//   * `tools/quests/mainline-gate-margin.mjs` (round-1 critic) measures the margin, also at a
//     cold start. It is the right question at the wrong instant.
//   * `tools/quests/mainline-trace.mjs` and `tools/quests/mainline-race-trace.mjs` both call
//     `H.learnTopic(step.topic)` immediately before asking the gate for that topic —
//     `RI-MTH07`'s hand-feed failure. They can play a chain no player could start.
//
// This tool answers the two questions those three cannot, in one pass:
//
//   A. THE CHAIN FLOOR.  For every (race x upbringing) signature and every main-quest giver,
//      the MINIMUM derived standing reached at any point along the chain — not at frame zero.
//      `chain_floor(gate) = min over signatures, min over steps` is the number a
//      `giver.disposition_min` has to sit under if every signature is to finish, and the gap
//      between it and the gate is the RESERVE the design is choosing to leave.
//
//   B. COMPLETION WITHOUT A HAND-FEED.  The same run plays both chains with **zero**
//      `learnTopic()` calls. The only topic granted from outside the quest graph is the one a
//      player gets by walking up to somebody in Soulrest and being greeted — the world-side
//      consumer of `opens_by.overheard_from` — after which every keyword must arrive through
//      `hooks.json`'s forward AddTopic edges or the chain stops where a player would stop.
//
// Exit 0 only when every signature completes both chains AND every clamped gate has a positive
// chain-floor margin. `--sabotage` breaks the thing on purpose so the instrument can be shown to
// go red (rule: a probe that cannot fail is worse than no probe).
//
//   node tools/quests/mainline-chain-floor.mjs [--out <dir>] [--json]
//                                              [--sabotage no-bootstrap|hand-feed]
//
//   --sabotage no-bootstrap   skip the greeting. Nothing supplies `the drowned tally`; the
//                             chain must stop at Q-MAIN-01 for all 40 signatures.
//   --sabotage hand-feed      call learnTopic() before every step, the way the round-1 tools
//                             did. Completion must NOT change — if it does, the forward AddTopic
//                             graph is not carrying the chain and something else is.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mainline-chain-floor.mjs — the chain played end to end per signature, with consequences kept.

USAGE
  node tools/quests/mainline-chain-floor.mjs [--out <dir>] [--json]
                                             [--sabotage no-bootstrap|hand-feed]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-19-R2-FLOOR');
ensureDir(outDir);
const sabotage = args.sabotage ? String(args.sabotage) : null;
if (sabotage && !['no-bootstrap', 'hand-feed'].includes(sabotage)) usage(USAGE);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));

const INTENDED = [...mainline.acts.flatMap((a) => a.quests), ...mainline.aftermath.quests];
const BACKPATH = [
  ...mainline.acts.filter((a) => a.act <= 3).flatMap((a) => a.quests),
  'Q-MAIN-29', 'Q-MAIN-31',
];

// The same plan shape `mainline-race-trace.mjs` builds, MINUS the topic, so that a difference in
// the result is a difference in what the world supplied and in nothing else.
const planFor = (ids) => ids.map((id) => {
  const q = defs[id];
  if (!q) throw new Error(`mainline-chain-floor: ${id} is not in game/data/quests/**`);
  return {
    id,
    topic: q.opens_by.topic,                                     // reported, and hand-fed ONLY under --sabotage hand-feed
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

// Every main-quest gate, so the floor is sampled at the people the gates actually name.
const gates = [];
for (const q of Object.values(defs)) {
  if (q.category !== 'main' || !q.giver || q.giver.disposition_min == null) continue;
  gates.push({ quest: q.id, act: q.act ?? null, npc: q.giver.npc_id, min: q.giver.disposition_min });
}
const gateNpcs = [...new Set(gates.map((g) => g.npc))].sort();

const RACES = ['saxhleel', 'naga', 'dunmer', 'imperial', 'nord', 'breton', 'redguard', 'khajiit', 'orsimer', 'bosmer'];
const UPBRINGINGS = ['interior', 'lukiul', 'foreign-born', 'blackrose'];
const SIGS = [];
for (const r of RACES) for (const u of UPBRINGINGS) SIGS.push([r, u]);

// The one world action the trace is allowed. `bone-ladder-carter` is named in Q-MAIN-01's own
// `opens_by.overheard_from`, and greeting somebody is the cheapest thing a player can do.
const BOOTSTRAP_NPC = 'bone-ladder-carter';
const STATE = 'soulrest-quay';

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 900000) });
let report;
try {
  report = await handle.page.evaluate(async ({ plans, prefer, sigs, gateNpcs, gates, sabotage, BOOTSTRAP_NPC, STATE }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);

    const sampleStanding = () => {
      const v = H.getGateDispositions();
      const out = {};
      for (const n of gateNpcs) out[n] = v[n] ?? null;
      return out;
    };

    const runChain = (name, plan) => {
      const out = {
        chain: name, completed: [], blocked_at: null, why: null, violent: [], journal_n: 0,
        // per gate NPC: the lowest standing seen at any step of this chain
        floor: {}, trace: [],
      };
      const fold = (s) => { for (const [k, v] of Object.entries(s)) { if (v == null) continue; if (out.floor[k] == null || v < out.floor[k]) out.floor[k] = v; } };
      // Frame zero counts: it is a step of the chain like any other.
      let st = sampleStanding(); fold(st);
      out.trace.push({ after: '(cold start)', standing: st });

      for (const step of plan) {
        if (sabotage === 'hand-feed') {
          H.learnTopic(step.topic);
          for (const t of step.prereq_topics) H.learnTopic(t);
        }
        // What the gate would say about THIS quest at the moment the chain reaches it, before
        // anything is done about it. This is the number the round-1 clamp never looked at.
        const offer = H.questOffers().find((o) => o.id === step.id) || null;
        const o = H.questOpen(step.id);
        if (!o.ok) {
          out.blocked_at = step.id;
          out.why = o.reason;
          out.blocked_offer_why = offer ? offer.why : null;
          break;
        }
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
        st = sampleStanding(); fold(st);
        out.trace.push({ after: step.id, resolution: pick.id, standing: st });
      }
      const qs = H.getQuestState();
      out.journal_n = qs.journal.length;
      out.topics_known = (qs.topicsKnown || []).length;
      out.flags_ending = Object.keys(qs.flags).filter((f) => qs.flags[f] && f.startsWith('ending_'));
      return out;
    };

    const rows = [];
    for (const [race, upbringing] of sigs) {
      const row = { race, upbringing, chains: {} };
      for (const name of ['intended', 'backpath']) {
        H.setSeed(1337);
        H.loadState(STATE);
        H.setRenderRate(0);
        H.setGold(0);
        H.setCharacter({ race, upbringing, class: 'reed-walker', birthsign: 'raj-xul' });
        // THE ONLY THING GRANTED FROM OUTSIDE THE QUEST GRAPH, and it is not granted, it is
        // done: walk up to a carter on the Soulrest quay and be greeted. Everything after this
        // has to arrive through the world's own AddTopic edges.
        const boot = { topics_before: H.getQuestState().topicsKnown.length };
        if (sabotage !== 'no-bootstrap') { H.talkTo(BOOTSTRAP_NPC); H.conversationClose(); }
        boot.topics_after = H.getQuestState().topicsKnown.length;
        row.bootstrap = boot;
        row.chains[name] = runChain(name, plans[name]);
      }
      rows.push(row);
    }
    return { schema: 'elder-souls/mainline-chain-floor@1', harness_version: H.version, gates, rows };
  }, { plans, prefer: PREFER, sigs: SIGS, gateNpcs, gates, sabotage, BOOTSTRAP_NPC, STATE });
} finally { await handle.close(); }

// ---- reduce ---------------------------------------------------------------------------------
const floors = {};                       // npc -> lowest standing anywhere, any signature, any chain
const floorBySig = {};                   // npc -> {sig, value}
for (const row of report.rows) {
  for (const ch of Object.values(row.chains)) {
    for (const [npc, v] of Object.entries(ch.floor)) {
      if (floors[npc] == null || v < floors[npc]) { floors[npc] = v; floorBySig[npc] = `${row.race}/${row.upbringing}`; }
    }
  }
}

const perGate = gates.map((g) => ({
  ...g,
  chain_floor: floors[g.npc] ?? null,
  floor_signature: floorBySig[g.npc] || null,
  chain_margin: (floors[g.npc] ?? 0) - g.min,
})).sort((a, b) => a.chain_margin - b.chain_margin);

const finished = report.rows.filter((r) => !r.chains.intended.blocked_at && !r.chains.backpath.blocked_at);
const failures = [];
for (const r of report.rows) {
  for (const [name, ch] of Object.entries(r.chains)) {
    if (ch.blocked_at) failures.push(`${r.race}/${r.upbringing} ${name}: ${ch.completed.length}/${plans[name].length}, blocked at ${ch.blocked_at} — ${ch.why}`);
  }
}
const violent = [...new Set(report.rows.flatMap((r) => Object.values(r.chains).flatMap((c) => c.violent)))];

const out = {
  tool: 'tools/quests/mainline-chain-floor.mjs',
  schema: 'elder-souls/mainline-chain-floor@1',
  measured_at: new Date().toISOString(),
  sabotage,
  state: STATE,
  bootstrap_npc: sabotage === 'no-bootstrap' ? null : BOOTSTRAP_NPC,
  hand_fed_topics: sabotage === 'hand-feed',
  signatures: SIGS.length,
  signatures_finishing_both_chains: finished.length,
  chain_lengths: { intended: plans.intended.length, backpath: plans.backpath.length },
  bootstrap_sample: report.rows[0] ? report.rows[0].bootstrap : null,
  gates: perGate,
  zero_or_negative_margin_gates: perGate.filter((g) => g.chain_margin <= 0).map((g) => `${g.quest} (${g.npc} floor ${g.chain_floor} vs min ${g.min}, worst ${g.floor_signature})`),
  failures,
  violent_resolutions_taken: violent,
  rows: report.rows,
};
writeJson(path.join(outDir, 'mainline-chain-floor.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nmainline chain floor — ${SIGS.length} signatures x 2 chains, state '${STATE}'${sabotage ? `  [SABOTAGE ${sabotage}]` : ''}`);
  console.log(`bootstrap: ${out.bootstrap_npc ? `greeted ${out.bootstrap_npc}, topics ${out.bootstrap_sample.topics_before} -> ${out.bootstrap_sample.topics_after}` : 'NONE'}; topics hand-fed: ${out.hand_fed_topics}\n`);
  console.log('  quest        act npc                          min  chain floor  margin  floor signature');
  for (const g of perGate) {
    console.log(`  ${g.quest.padEnd(11)} ${String(g.act ?? '-').padEnd(3)} ${g.npc.padEnd(28)} ${String(g.min).padStart(3)}  ${String(g.chain_floor).padStart(11)}  ${String(g.chain_margin).padStart(6)}  ${g.floor_signature || ''}`);
  }
  console.log(`\n  signatures completing both chains  ${finished.length}/${SIGS.length}`);
  console.log(`  gates with margin <= 0             ${out.zero_or_negative_margin_gates.length}`);
  for (const s of out.zero_or_negative_margin_gates) console.log(`     ${s}`);
  for (const f of failures.slice(0, 12)) console.log(`     FAIL ${f}`);
  if (failures.length > 12) console.log(`     ... and ${failures.length - 12} more`);
  console.log(`  violent resolutions taken          ${violent.length}`);
  console.log(`\nwrote ${path.join(outDir, 'mainline-chain-floor.json')}`);
}

const ok = failures.length === 0 && out.zero_or_negative_margin_gates.length === 0;
process.exit(ok ? 0 : 1);
