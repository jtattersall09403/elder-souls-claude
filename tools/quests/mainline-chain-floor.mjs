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
//     `H.direct topic API(step.topic)` immediately before asking the gate for that topic —
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
//      `direct topic API()` calls AND — since W1-19 round 3 — zero `direct reveal API()` calls. The only topic granted from outside the quest graph is the one a
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
//   --sabotage hand-feed      call direct topic API() before every step, the way the round-1 tools
//                             did. Completion must NOT change — if it does, the forward AddTopic
//                             graph is not carrying the chain and something else is.
//   --hand-feed-reveals       W1-19 round 3. Restores the round-2 behaviour: call
//                             `H.direct reveal API()` for every reveal each step declares. This is a
//                             HAND-FEED and it is what made round 2 report 40/40; it is off by
//                             default and exists only to reproduce that number.
//
//   --sabotage no-purse       run with 0 gold and no persuasion. The chain must stop where a
//                             character who cannot pay stops, which is what shows that the purse
//                             is what is carrying the low-standing signatures and not the clamp.
//
// THE PURSE. Unless `--sabotage no-purse` is given, a signature refused on `giver
// .disposition_min` does what a player does: stands in front of the giver and tries to talk them
// round — `RI-DLG04` §C's Admire and the three bribe tiers, through `Engine
// .conversationPersuade()`, with a real seeded roll and gold spent either way (seam S15). It
// gets `--attempts` tries per gate and then gives up. This is the difference between a gate that
// prices a background and a gate that excludes one, and it is why the clamp below does not have
// to be lowered until every gate is decorative.

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
// W1-19 round 3: off by default. See the long note at the direct reveal API call site.
const handFeedReveals = false;
if (sabotage && !['no-bootstrap', 'no-purse'].includes(sabotage)) usage(USAGE);
const PURSE = args.purse === undefined ? 2500 : Number(args.purse);
const ATTEMPTS = args.attempts === undefined ? 6 : Number(args.attempts);

const QDIR = path.join(process.cwd(), 'game/data/quests');
const defs = {};
for (const f of fs.readdirSync(QDIR).sort()) {
  if (!f.endsWith('.json') || f === 'hooks.json') continue;
  const doc = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
  for (const q of doc.quests || []) defs[q.id] = q;
}
const mainline = JSON.parse(fs.readFileSync(path.join(QDIR, 'mainline.json'), 'utf8'));
const roads = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/world/roads.json'), 'utf8'));
const travelStations = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/world/travel/stations.json'), 'utf8')).stations;


const npcActions = {};
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/npcs'))) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/npcs', f), 'utf8'));
  for (const n of d.npcs || []) npcActions[n.id] = n.settlement ? { settlement: n.settlement } : (n.post && n.post.site ? { site: n.post.site } : null);
}

// Resolve authored document/mark sources to their production world objects once. The resulting
// table contains locations only; progression still happens exclusively when the player presses
// interact on the spawned prop in the running game.
const documentActions = {};
const knowledgeToBook = {};
for (const f of fs.readdirSync(path.join(process.cwd(), 'game/data/books'))) {
  if (!f.endsWith('.json') || f === 'manifest.json') continue;
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'game/data/books', f), 'utf8'));
  for (const b of d.books || []) if (b.knowledge_key) knowledgeToBook[b.knowledge_key] = b.id;
}
const interiorsDir = path.join(process.cwd(), 'game/data/world/interiors');
for (const f of fs.readdirSync(interiorsDir)) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(interiorsDir, f), 'utf8'));
  for (const r of Array.isArray(d.readable) ? d.readable : []) {
    const key = Object.keys(knowledgeToBook).find((k) => knowledgeToBook[k] === r.book);
    if (key) documentActions[key] = { interior: d.id, eid: `interior-readable:${r.id}`, book: r.book };
  }
}
const markActions = {};
const marksPath = path.join(process.cwd(), 'game/data/world/readables/site-marks.json');
if (fs.existsSync(marksPath)) for (const m of JSON.parse(fs.readFileSync(marksPath, 'utf8')).marks || []) markActions[m.id] = m.at;

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
    reveals: ((q.deceit || {}).revealed_by || []).map((r) => ({ id: r.id, channel: r.channel, source: r.source })),
    notes: (q.journal || []).filter((e) => e.state === 'active' || e.state === 'branch')
      .map((e) => e.index).filter((i) => i > 10),
    resolutions: (q.resolutions || []).filter((r) => !r.violence_required).map((r) => ({ id: r.id, requires_knowing: r.requires_knowing || [] })),
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
let SIGS = [];
for (const r of RACES) for (const u of UPBRINGINGS) SIGS.push([r, u]);
const signatureStart = Number(args['signature-start'] || 0);
const signatureCount = args['signature-count'] == null ? SIGS.length : Number(args['signature-count']);
SIGS = SIGS.slice(signatureStart, signatureStart + signatureCount);

// The one world action the trace is allowed. `bone-ladder-carter` is named in Q-MAIN-01's own
// `opens_by.overheard_from`, and greeting somebody is the cheapest thing a player can do.
const BOOTSTRAP_NPC = 'bone-ladder-carter';
const STATE = 'soulrest-quay';

const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 900000) });
let report;
try {
  report = await handle.page.evaluate(async ({ plans, prefer, sigs, gateNpcs, gates, sabotage, handFeedReveals, BOOTSTRAP_NPC, STATE, PURSE, ATTEMPTS, documentActions, markActions, npcActions, roads, travelStations }) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);

    const walkTo = (x, z, reach = 1.0) => {
      const started = H.whereAmI().pos.slice();
      // Follow the authored road graph between the nearest settlements. The short joins at
      // each end are walked too; no pose is written and walkPath reports any discontinuity.
      const here = started;
      const nearest = (px, pz) => [...travelStations].sort((a,b) => Math.hypot(a.x-px,a.z-pz)-Math.hypot(b.x-px,b.z-pz))[0];
      const from = nearest(here[0], here[2]), to = nearest(x, z);
      const dist = Object.fromEntries(travelStations.map(q => [q.id, Infinity])); dist[from.id]=0;
      const prev = {}, unused = new Set(travelStations.map(q => q.id));
      while (unused.size) {
        const u=[...unused].sort((a,b)=>dist[a]-dist[b])[0]; unused.delete(u); if(u===to.id || !Number.isFinite(dist[u])) break;
        for (const leg of roads.legs.filter(l=>l.from.toLowerCase()===u||l.to.toLowerCase()===u)) { const v=(leg.from.toLowerCase()===u?leg.to:leg.from).toLowerCase(), nd=dist[u]+leg.built_path_m; if(nd<dist[v]){dist[v]=nd;prev[v]={u,leg};} }
      }
      const hops=[]; let cur=to.id; while(cur!==from.id && prev[cur]) { hops.unshift({from:prev[cur].u,to:cur,leg:prev[cur].leg});cur=prev[cur].u; }
      const route=[];
      for (const h of hops) { const pts=h.leg.from.toLowerCase()===h.from?h.leg.points:[...h.leg.points].reverse(); for(const q of pts) if(!route.length||q[0]!==route.at(-1)[0]||q[1]!==route.at(-1)[1]) route.push([q[0],q[1]]); }
      route.push([x,z]);
      const walked = H.walkPath(route, {
        fromCurrent: true,
        speed: 'jog',
        maxFrames: 5000,
        arrive_m: reach,
        stuckAbort: 1800,
        miredAbort: 36000,
      });
      return {
        ok: walked.arrived && walked.arrival_is_clean,
        frames: walked.frames,
        left_m: walked.offset_m,
        started,
        ended: H.whereAmI().pos.slice(),
        production_input: true,
        walk: walked,
      };
    };

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
        floor: {},
        // per QUEST: the standing at this quest's own giver at the instant the chain arrives at
        // it, before anything is done about it.
        //
        // SUCCESSOR ADDITION, and it is the number a clamp should be set from. `floor` is the
        // minimum over EVERY step, which is more conservative than a gate needs: a gate only has
        // to be passable at the moment you walk up to it, and a standing that dipped in Act I and
        // recovered by Act IV is not evidence against an Act IV gate. Setting a clamp from
        // `floor` prices gates that nothing is actually short at; setting it from the cold start
        // (round 1) prices nothing and leaves a margin of exactly zero. `arrival` is the
        // measured form of the round-1 verdict's own prescription — "worst cold-start standing
        // minus the largest cumulative negative faction term the mainline can itself produce at
        // that giver" — with the subtraction performed by the running build rather than by an
        // author's arithmetic.
        arrival: {},
        trace: [],
      };
      const fold = (s) => { for (const [k, v] of Object.entries(s)) { if (v == null) continue; if (out.floor[k] == null || v < out.floor[k]) out.floor[k] = v; } };
      // Frame zero counts: it is a step of the chain like any other.
      let st = sampleStanding(); fold(st);
      out.trace.push({ after: '(cold start)', standing: st });

      for (const step of plan) {
        // What the gate would say about THIS quest at the moment the chain reaches it, before
        // anything is done about it. This is the number the round-1 clamp never looked at.
        const offer = H.questOffers().find((o) => o.id === step.id) || null;
        // The standing at THIS quest's own giver, at the instant the chain arrives. Sampled
        // before `direct open API`, so a gate that the purse then buys open is still recorded at the
        // standing the character actually walked up with.
        {
          const g = (H.questDef(step.id).giver || {}).npc_id;
          if (g) {
            const v = H.getGateDispositions()[g];
            if (v != null) out.arrival[step.id] = v;
          }
        }
        // ---- GAP-W1-quest-givers-not-in-the-world -------------------------------------------
        // Walk to the town this quest's giver lives in, BEFORE asking the gate. This used to
        // happen only on a standing refusal, and it happened by conjuring:
        //
        //     H.direct spawn API({ from_record: giver, pos: [0, 0, 2] })
        //
        // with a comment conceding that `direct open API` already assumed the person was there,
        // "since the gate has never had a proximity term". So the instrument manufactured the
        // one thing it was supposed to be measuring, and 40/40 signatures completed both chains
        // in a world where nine of ninety-four givers existed. `travelToGiver` runs the world's
        // own `populateSettlement`/`populateSite` — the call walking across a town boundary
        // makes — and returns `present: false` when the person's record names no place at all,
        // which is the failure the old line could not express.
        const trip = H.travelToGiver(step.id);
        if (!trip.present) { out.giver_absent = out.giver_absent || []; out.giver_absent.push(trip); }
        // Accept through the production conversation choice published by talkTo().  The runner
        // never calls QuestEngine/open or a harness quest verb: if the giver does not publish the
        // choice, play stops here.
        let o = { ok: false, reason: 'acceptance choice absent' };
        const giver = (H.questDef(step.id).giver || {}).npc_id;
        const acceptThroughConversation = () => {
          const c = H.talkTo(giver);
          const choice = (c.topics || c.list || []).find((x) => x.id === `quest-accept:${step.id}`);
          if (!choice) { H.conversationClose(); return { ok: false, reason: 'production acceptance choice absent' }; }
          const said = H.conversationSay(choice.id);
          H.conversationClose();
          const qa = said && said.quest_action;
          return qa && qa.act === 'accept' ? qa.result : { ok: false, reason: (said && said.refused) || 'production acceptance refused' };
        };
        try { o = acceptThroughConversation(); } catch (e) { o = { ok: false, reason: String(e && e.message || e) }; }
        // Refused on standing? Go and talk them round, then retry the published choice.
        if (!o.ok && sabotage !== 'no-purse' && /disposition \d/.test(String((offer && offer.why) || o.reason || ''))) {
          if (giver) {
            try {
              H.talkTo(giver);
              const attempt = { quest: step.id, npc: giver, tries: [] };
              for (let k = 0; k < ATTEMPTS && !o.ok; k++) {
                const gold = H.getGold ? H.getGold() : PURSE;
                const verb = gold >= 1000 ? 'bribe1000' : gold >= 100 ? 'bribe100' : gold >= 10 ? 'bribe10' : 'admire';
                const r = H.conversationPersuade(verb);
                attempt.tries.push({ verb, success: !!r.success, standing: r.standing_now, gold_left: r.gold_left });
                H.conversationClose();
                o = acceptThroughConversation();
                if (!o.ok && k + 1 < ATTEMPTS) H.talkTo(giver);
              }
              attempt.opened = o.ok;
              out.persuasion = out.persuasion || [];
              out.persuasion.push(attempt);
              H.conversationClose();
            } catch (e) { out.persuasion_error = String(e && e.message || e); }
          }
        }
        if (!o.ok) {
          out.blocked_at = step.id;
          out.why = o.reason;
          out.blocked_offer_why = offer ? offer.why : null;
          break;
        }
        // Perform every authored reveal through its shipped player-facing world action.
        // Talking/eavesdropping/examining are production verbs. Documents and marks require the
        // same interact input a player presses after walking to the spawned prop.
        out.world_actions = out.world_actions || [];
        const preferredId = prefer[name] && prefer[name][step.id];
        const preferredResolution = step.resolutions.find((x) => x.id === preferredId)
          || [...step.resolutions].sort((a, b) => a.requires_knowing.length - b.requires_knowing.length)[0];
        const neededReveals = new Set((preferredResolution && preferredResolution.requires_knowing) || []);
        for (const r of step.reveals.filter((x) => neededReveals.has(x.id))) {
          const a = { reveal: r.id, channel: r.channel, source: r.source, ok: false };
          try {
            if (r.channel === 'talk_to_target' || r.channel === 'rival_npc') {
              const loc = npcActions[r.source]; if (loc && loc.settlement) H.populateSettlement(loc.settlement); else if (loc && loc.site) H.populateSite(loc.site);
              const st = H.talkTo(r.source); const learned = Array.isArray(st.learned) ? st.learned : (st.learned && st.learned.learned) || []; a.ok = learned.some((x) => x.reveal === r.id && x.ok); H.conversationClose();
            } else if (r.channel === 'eavesdrop') {
              const loc = npcActions[r.source]; if (loc && loc.settlement) H.populateSettlement(loc.settlement); else if (loc && loc.site) H.populateSite(loc.site);
              const st = H.eavesdrop(r.source); const learned = Array.isArray(st) ? st : (st.learned || []); a.ok = learned.some((x) => x.reveal === r.id && x.ok);
            } else if (r.channel === 'corpse') {
              const loc = npcActions[r.source]; if (loc && loc.settlement) H.populateSettlement(loc.settlement); else if (loc && loc.site) H.populateSite(loc.site);
              const st = H.examineCorpse(r.source); const learned = Array.isArray(st) ? st : (st.learned || []); a.ok = learned.some((x) => x.reveal === r.id && x.ok);
            } else if (['book', 'ledger', 'letter'].includes(r.channel) && documentActions[r.source]) {
              const d = documentActions[r.source]; H.enterInterior(d.interior); H.stepFrames(2);
              const prop = H.listEntities().find((x) => x.eid === d.eid);
              if (prop) {
                // The ordinary book surface fires the same onBookOpened consumer as interacting
                // with this verified, present, non-takeable prop. No knowledge flag is supplied.
                H.openMenu('book', { id: d.book });
                const ui = H.getUIState(); a.ok = ui.mode === 'book' && ui.book && ui.book.id === d.book;
                if (a.ok) H.closeMenu();
              }
            } else if (r.channel === 'environment' && markActions[r.source]) {
              const at = markActions[r.source];
              if (at.interior) H.enterInterior(at.interior); else { const w=H.whereAmI(); if (w.interior) H.exitInterior(); }
              H.stepFrames(3);
              let prop = H.listEntities().find((x) => x.eid === `mark:${r.source}` || x.eid === `mark:${r.source}#0`);
              if (!prop && at.world) { a.walk = walkTo(at.world[0], at.world[1], 2.0); H.stepFrames(3); prop = H.listEntities().find((x) => x.eid === `mark:${r.source}` || x.eid === `mark:${r.source}#0`); }
              if (prop) { a.walk = walkTo(prop.pos[0], prop.pos[2], Math.min(prop.reach_m || 1.6,1.2)); if (a.walk.ok) { H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]); H.stepFrames(8); a.ok = true; } }
            }
          } catch (e) { a.error = String(e && e.message || e); }
          out.world_actions.push(a);
        }

        const want = prefer[name] && prefer[name][step.id];
        const ordered = [...step.resolutions].sort((a, b) => (a.id === want ? -1 : b.id === want ? 1 : 0));
        // Select an actually published shipped resolution choice in the giver's ordinary
        // conversation. Absence is a production gate refusal, not something the runner repairs.
        let res;
        let pick = null;
        try {
          H.travelToGiver(step.id);
          const c = H.talkTo(giver);
          const topics = c.topics || c.list || [];
          for (const candidate of ordered) {
            const choice = topics.find((x) => x.id === `quest-resolve:${step.id}:${candidate.id}`);
            if (choice) { pick = { id: candidate.id, violence_required: false }; break; }
          }
          const choice = pick && topics.find((x) => x.id === `quest-resolve:${step.id}:${pick.id}`);
          if (!choice) res = { ok: false, reason: 'no nonviolent production resolution choice available' };
          else {
            const said = H.conversationSay(choice.id);
            res = said && said.quest_action && said.quest_action.act === 'resolve'
              ? said.quest_action.result : { ok: false, reason: (said && said.refused) || 'production resolution refused' };
          }
          H.conversationClose();
        } catch (e) { res = { ok: false, reason: String(e && e.message || e) }; }
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
        H.setGold(sabotage === 'no-purse' ? 0 : PURSE);
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
  }, { plans, prefer: PREFER, sigs: SIGS, gateNpcs, gates, sabotage, handFeedReveals, BOOTSTRAP_NPC, STATE, PURSE, ATTEMPTS, documentActions, markActions, npcActions, roads, travelStations });
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

// ARRIVAL: the worst standing any signature walks up to THIS gate with, on either chain. A gate
// only has to be passable when you reach it, so this — not `chain_floor` — is the number a clamp
// is set from. A quest no signature ever reaches has no arrival and reports null; that is a
// completion failure and shows up in `failures`, not here.
const arrivals = {};
const arrivalBySig = {};
for (const row of report.rows) {
  for (const ch of Object.values(row.chains)) {
    for (const [quest, v] of Object.entries(ch.arrival || {})) {
      if (arrivals[quest] == null || v < arrivals[quest]) { arrivals[quest] = v; arrivalBySig[quest] = `${row.race}/${row.upbringing}`; }
    }
  }
}

const perGate = gates.map((g) => ({
  ...g,
  chain_floor: floors[g.npc] ?? null,
  floor_signature: floorBySig[g.npc] || null,
  chain_margin: (floors[g.npc] ?? 0) - g.min,
  arrival_floor: arrivals[g.quest] ?? null,
  arrival_signature: arrivalBySig[g.quest] || null,
  arrival_margin: arrivals[g.quest] == null ? null : arrivals[g.quest] - g.min,
})).sort((a, b) => (a.arrival_margin ?? -1e9) - (b.arrival_margin ?? -1e9));

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
  // A gate whose measured chain floor sits BELOW its `disposition_min` is not a broken gate; it
  // is a PRICED one — some signature has to reach for the purse to get through it. That is the
  // design (see the re-clamp note on `giver.disposition_min_note`). What would be broken is a
  // gate nothing can pay past, and that shows up in `failures`, not here.
  priced_gates: perGate.filter((g) => g.chain_floor < g.min).map((g) => `${g.quest} (${g.npc} floor ${g.chain_floor} vs min ${g.min}, worst ${g.floor_signature})`),
  // The gates somebody actually walks up to short. Under `--sabotage no-purse` this is the set
  // that decides whether a penniless character can finish, and it is a much smaller set than
  // `priced_gates` — most of those dips happen in acts the gate is not in.
  arrival_short: perGate.filter((g) => g.arrival_margin != null && g.arrival_margin < 0)
    .map((g) => `${g.quest} (${g.npc}: arrives ${g.arrival_floor} vs min ${g.min}, short ${Math.round(-g.arrival_margin * 1000) / 1000}, worst ${g.arrival_signature})`),
  gates_never_short: perGate.filter((g) => g.chain_floor >= g.min).length,
  persuasion: report.rows.flatMap((r) => Object.entries(r.chains).flatMap(([n, c]) => (c.persuasion || []).map((p) => ({ sig: `${r.race}/${r.upbringing}`, chain: n, ...p })))),
  failures,
  violent_resolutions_taken: violent,
  rows: report.rows,
};
writeJson(path.join(outDir, 'mainline-chain-floor.json'), out);

if (args.json) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`\nmainline chain floor — ${SIGS.length} signatures x 2 chains, state '${STATE}'${sabotage ? `  [SABOTAGE ${sabotage}]` : ''}`);
  console.log(`bootstrap: ${out.bootstrap_npc ? `greeted ${out.bootstrap_npc}, topics ${out.bootstrap_sample.topics_before} -> ${out.bootstrap_sample.topics_after}` : 'NONE'}; topics hand-fed: ${out.hand_fed_topics}\n`);
  const n2 = (v) => (v == null ? '  -  ' : (Math.round(v * 100) / 100).toFixed(2));
  console.log('  quest        act npc                          min  arrival  margin  worst signature      | chain floor  margin');
  for (const g of perGate) {
    console.log(`  ${g.quest.padEnd(11)} ${String(g.act ?? '-').padEnd(3)} ${g.npc.padEnd(28)} ${String(g.min).padStart(3)}  ${n2(g.arrival_floor).padStart(7)}  ${n2(g.arrival_margin).padStart(6)}  ${(g.arrival_signature || '').padEnd(20)} | ${n2(g.chain_floor).padStart(11)}  ${n2(g.chain_margin).padStart(6)}`);
  }
  const short = perGate.filter((g) => g.arrival_margin != null && g.arrival_margin < 0);
  console.log(`\n  gates some signature ARRIVES SHORT of  ${short.length}/${perGate.length}${short.length ? '  ' + short.map((g) => `${g.quest} by ${(Math.round(-g.arrival_margin * 100) / 100)}`).join(', ') : ''}`);
  console.log(`\n  signatures completing both chains  ${finished.length}/${SIGS.length}`);
  console.log(`  gates never short of their min     ${out.gates_never_short}/${perGate.length}`);
  console.log(`  PRICED gates (floor below the min, so somebody has to pay)  ${out.priced_gates.length}`);
  for (const s of out.priced_gates) console.log(`     ${s}`);
  const paid = out.persuasion.filter((p) => p.opened).length;
  console.log(`  gate-openings bought with the purse ${paid} across ${new Set(out.persuasion.map((p) => p.sig)).size} signatures`);
  for (const f of failures.slice(0, 12)) console.log(`     FAIL ${f}`);
  if (failures.length > 12) console.log(`     ... and ${failures.length - 12} more`);
  console.log(`  violent resolutions taken          ${violent.length}`);
  console.log(`\nwrote ${path.join(outDir, 'mainline-chain-floor.json')}`);
}

const ok = failures.length === 0;
process.exit(ok ? 0 : 1);
