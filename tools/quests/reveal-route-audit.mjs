#!/usr/bin/env node
// reveal-route-audit.mjs — is there a route in PLAY that produces each reveal a resolution demands,
// and does the hook table that is supposed to carry them actually fire?
//
// Written by the W1-19 ROUND-3 builder. It exists because two instruments in this tree disagreed
// about the same commit and both were internally honest:
//
//   * `tools/quests/mainline-chain-floor.mjs` reported 40/40 signatures completing both chains.
//   * `tools/quests/viability-walk.mjs` reported 40/40 signatures stopping at `Q-MAIN-06`,
//     because both non-violent resolutions refuse with "you do not know rev_the_curve_predates".
//
// The chain-floor tool eliminated the TOPIC hand-feed with great care — it has a `--sabotage
// hand-feed` arm to prove the topic graph carries the chain on its own — and then, four lines
// below the gate it was protecting, called `H.questReveal(step.id, r)` for every reveal the step
// declares. Removing that one line turns its 40/40 into 0/40 at exactly `Q-MAIN-06` with exactly
// the message the walk prints. So: THE WALK IS TRUE OF THE GAME AND THE 40/40 WAS TRUE OF THE
// INSTRUMENT. This tool is the standing check that stops the question being asked a fourth time.
//
// It asks two questions, and the second is the one that matters:
//
//   A. THE STATIC CENSUS (no engine). For every `(quest, reveal)` pair some resolution names in
//      `requires_knowing`, is there ANY authored route that could produce it? Two routes exist in
//      `game/src/`:
//        1. `hooks.json` row carrying BOTH `quest` and `reveal` — fired from `setFlag()`;
//        2. `channel: 'book'` with a `source` that is a real book id — `Engine
//           ._bookKnowledgeIndex()` unions it into `ctx.knowledge` when the book is read.
//        3. `channel: 'talk_to_target' | 'rival_npc'` with a `source` that is a real NPC —
//           `QuestEngine.learnFrom('person', eid)`, called from `Engine.talkTo()`. ADDED by
//           W1-18 ROUND 2; see `game/src/sim/quest/reveal-routes.js` for why these two channels
//           and not the other four.
//      `ledger`, `letter`, `environment` and `eavesdrop` (and the single `corpse` row) still have
//      no reader in `game/src/` at all, and the first three cannot get one until their sources
//      exist: 34 of the 37 `ledger` rows, all 10 `letter` rows and all 27 `environment` rows name
//      an `item_*`/`loc_*` id — or a sentence — that is not an object anywhere in `game/data/`.
//
//      A ROUTE TO NOBODY IS NOT A ROUTE. A `person` row whose `source` is not a row in
//      `game/data/npcs/**` is counted UNROUTED and listed, because `Engine.talkTo()` throws on
//      somebody who is not in the world. Ten of the 28 `talk_to_target` sources are in that
//      state today and the tool says so rather than scoring them green.
//
//   B. THE COUPLING TEST (real QuestEngine, bare Node, no grants). Does a world flag raised the
//      way the WORLD raises it — by playing a resolution whose `consequences.world_flags` names
//      it — actually reach the hook table? This is the question that decides whether authoring
//      more `hooks.json` rows would repair anything, and the answer on this tree is NO:
//      `_applyConsequences` writes `q.flags[wf] = 1` DIRECTLY and never calls `setFlag()`, so
//      the hook table is unreachable from the one thing a player does.
//
// CONTROLS (a probe that cannot fail is worse than no probe — RULES.md rule 4):
//
//   --falsify no-router     empty `QuestEngine.revealRoutes` and re-run section D. Every leg must
//                           go red. This is the delete-the-fix arm for W1-18 round 2's whole
//                           change: it separates "the reveals arrive because the router runs"
//                           from "the reveals were arriving anyway".
//   --falsify plant-route   plant a synthetic hooks row for a reveal that has no route and
//                           confirm section A's count moves. If it does not, A is not reading
//                           the route table it claims to read.
//   --falsify plant-flag    raise the same flag through `setFlag()` instead of through a played
//                           resolution and confirm the hook DOES fire. This is what separates
//                           "the hook table is broken" from "the hook table is never called":
//                           the table works, and nothing in play calls it.
//
// Exit 0 only when every demanded reveal has a route AND the coupling test passes. On this tree
// it exits 1 and says which of the two failed.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const QDIR = path.join(ROOT, 'game/data/quests');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const FALSIFY = arg('--falsify');
const JSON_OUT = argv.includes('--json');

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`reveal-route-audit.mjs — can play produce the reveals the resolutions demand?

USAGE
  node tools/quests/reveal-route-audit.mjs [--json] [--falsify plant-route|plant-flag]

  A. static census of every (quest,reveal) a resolution demands vs the routes game/src/ can read
  B. live coupling test: does a played resolution's world_flag reach the hooks table?

  Exit 0 only when A has no unroutable reveal and B couples.`);
  process.exit(0);
}

// ---------------------------------------------------------------- load the shipped quest data
const docs = {};
for (const f of fs.readdirSync(QDIR).filter((x) => x.endsWith('.json'))) {
  docs[f] = JSON.parse(fs.readFileSync(path.join(QDIR, f), 'utf8'));
}
const hooksDoc = docs['hooks.json'];
const quests = [];
for (const [file, j] of Object.entries(docs)) for (const q of (j.quests || [])) quests.push({ file, q });
if (!quests.length) { console.error('reveal-route-audit: no quests loaded — the data moved. Refusing to report.'); process.exit(2); }

// ---------------------------------------------------------------- route table 1: hooks.json
const hookRows = [...(hooksDoc.hooks || []), ...(hooksDoc.entry_topics || [])];
const hookRouted = new Set(hookRows.filter((r) => r.quest && r.reveal).map((r) => `${r.quest}|${r.reveal}`));
if (FALSIFY === 'plant-route') {
  // plant a route for the first unroutable reveal we can find, WITHOUT writing to disk.
  const victim = quests.flatMap(({ q }) => {
    const need = new Set();
    for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) need.add(k);
    return [...need].map((k) => `${q.id}|${k}`);
  }).find((k) => !hookRouted.has(k));
  if (victim) { hookRouted.add(victim); console.log(`[falsify plant-route] planted a synthetic hooks route for ${victim}`); }
}

// ------------------------------------------------- route table 3: people (W1-18 round 2)
// `Engine.talkTo(eid)` -> `QuestEngine.learnFrom('person', eid)`. A row is only a route if the
// person can actually be stood in front of, so the source must be an NPC record.
const { CHANNEL_READERS, buildRevealRoutes } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/reveal-routes.js')).href);
const npcIds = new Set();
try {
  for (const f of fs.readdirSync(path.join(ROOT, 'game/data/npcs')).filter((x) => x.endsWith('.json'))) {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/npcs', f), 'utf8'));
    for (const n of (Array.isArray(j) ? j : (j.npcs || j.entries || []))) if (n && n.id) npcIds.add(n.id);
  }
} catch { /* no npc tree */ }
const personRouted = new Set();
const personSourceMissing = [];
for (const { q } of quests) {
  for (const rev of ((q.deceit && q.deceit.revealed_by) || [])) {
    if (CHANNEL_READERS[rev.channel] !== 'person') continue;
    if (npcIds.has(rev.source)) personRouted.add(`${q.id}|${rev.id}`);
    else personSourceMissing.push({ quest: q.id, reveal: rev.id, channel: rev.channel, source: rev.source });
  }
}

// ---------------------------------------------------------------- route table 2: books
const bookIds = new Set();
const walkBooks = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walkBooks(p); continue; }
    if (!e.name.endsWith('.json')) continue;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const b of (Array.isArray(j) ? j : (j.books || []))) { if (b.id) bookIds.add(b.id); if (b.knowledge_key) bookIds.add(b.knowledge_key); }
  }
};
try { walkBooks(path.join(ROOT, 'game/data/books')); } catch { /* no books tree */ }

// ---------------------------------------------------------------- A. the census
const rows = [];
for (const { file, q } of quests) {
  const declared = ((q.deceit && q.deceit.revealed_by) || []);
  const byId = new Map(declared.map((r) => [r.id, r]));
  const need = new Set();
  for (const r of (q.resolutions || [])) for (const k of (r.requires_knowing || [])) need.add(k);
  for (const revId of need) {
    const d = byId.get(revId);
    const viaHook = hookRouted.has(`${q.id}|${revId}`);
    const viaBook = !!(d && d.channel === 'book' && d.source && bookIds.has(d.source));
    const viaPerson = personRouted.has(`${q.id}|${revId}`);
    rows.push({ file, quest: q.id, reveal: revId, channel: d ? d.channel : '(UNDECLARED)', source: d ? d.source : null, via_hook: viaHook, via_book: viaBook, via_person: viaPerson, routed: viaHook || viaBook || viaPerson });
  }
}
const unrouted = rows.filter((r) => !r.routed);
const byChannel = {};
for (const r of rows) { const c = byChannel[r.channel] ||= { total: 0, routed: 0 }; c.total++; if (r.routed) c.routed++; }

// quests where every resolution is blocked on an unroutable reveal
const routedSet = new Set(rows.filter((r) => r.routed).map((r) => `${r.quest}|${r.reveal}`));
const blockedQuests = [];
for (const { file, q } of quests) {
  const res = q.resolutions || [];
  if (!res.length) continue;
  const open = res.filter((r) => (r.requires_knowing || []).every((k) => routedSet.has(`${q.id}|${k}`)));
  if (!open.length) blockedQuests.push({ file, id: q.id, resolutions: res.length });
}

// ---------------------------------------------------------------- B. the coupling test
// Build a real QuestEngine over the shipped book and play one resolution whose consequences
// name a flag the hook table is keyed to. No grants: the flag is raised by `resolve()` alone.
const { QuestEngine } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/machine.js')).href);
const { QuestBook } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/defs.js')).href);

function freshSim() {
  return {
    frame: 0,
    env: { dayCount: 0, region: 'test' },
    world: { npcsDead: [] },
    inventory: [],
    progression: { attributes: {}, skills: {} },
    magic: null,
    quest: { quests: {}, flags: {}, journal: [], topicsKnown: [], completed: [], factions: {}, dispositions: {}, booksRead: [] },
  };
}

// pick a hook row that (a) carries a payload we can observe and (b) whose flag a shipped
// resolution's consequences raises. That is the exact shape a reveal route would have.
const raisedByConsequence = new Map();
for (const { q } of quests) {
  for (const r of (q.resolutions || [])) {
    for (const wf of ((r.consequences || {}).world_flags) || []) {
      if (!raisedByConsequence.has(wf)) raisedByConsequence.set(wf, []);
      raisedByConsequence.get(wf).push({ quest: q.id, res: r.id });
    }
  }
}
const couplingCandidates = (hooksDoc.hooks || [])
  .filter((h) => raisedByConsequence.has(h.flag) && (h.adds_topics || h.reveal || h.journal != null))
  .map((h) => ({ hook: h, producers: raisedByConsequence.get(h.flag) }));

const coupling = { candidates: couplingCandidates.length, tested: [], via_setflag: [], coupled: false, vacuous: false };

// Did the hook's declared payload actually land in this sim?
function payloadLanded(hook, sim) {
  if ((hook.adds_topics || []).length) return (hook.adds_topics).some((t) => sim.quest.topicsKnown.includes(t));
  if (hook.reveal) return !!(sim.quest.quests[hook.quest] && sim.quest.quests[hook.quest].flags[`know:${hook.reveal}`]);
  if (hook.journal != null) return (sim.quest.journal || []).some((e) => e && e.index === hook.journal);
  return false;
}

const book = new QuestBook(Object.values(docs).filter((d) => d && d.quests));
for (const cand of couplingCandidates) {
  const { quest, res } = cand.producers[0];
  // ---- LEG 1: the WORLD's write path. `resolve()` refuses here for gate reasons that belong to
  // other pieces (standing, prerequisite quests, topics), and a probe that reported "no coupling"
  // off a refused resolve would be measuring the gate, not the write. So the leg exercises the
  // exact function `resolve()` calls — `_applyConsequences` — with the SHIPPED def and the
  // SHIPPED resolution. Nothing is granted and no consequence is invented: this is line 762 of
  // machine.js running on real data. If the flag does not go up, the leg is marked NOT RUN and
  // the tool fails rather than passing vacuously.
  const sim = freshSim();
  const qe = new QuestEngine(book, null, hooksDoc, sim);
  qe.presenceMode = 'off';
  if (cand.hook.quest) qe.rec(cand.hook.quest, true).opened = true;
  const def = book.get(quest);
  const resDef = (def.resolutions || []).find((r) => r.id === res);
  let err = null;
  try { qe._applyConsequences(def, resDef); } catch (e) { err = String(e && e.message || e); }
  const flagUp = !!sim.quest.flags[cand.hook.flag];
  coupling.tested.push({
    flag: cand.hook.flag, raised_by: `${quest}/${res}`, via: '_applyConsequences (the resolve path)',
    error: err, flag_raised: flagUp, hook_payload_landed: flagUp ? payloadLanded(cand.hook, sim) : null,
    leg_ran: flagUp,
    payload: (cand.hook.adds_topics || []).join(',') || cand.hook.reveal || `journal ${cand.hook.journal}`,
  });

  // ---- LEG 2 (control): raise the SAME flag through setFlag(), which IS wired to the table.
  const sim2 = freshSim();
  const qe2 = new QuestEngine(book, null, hooksDoc, sim2);
  qe2.presenceMode = 'off';
  if (cand.hook.quest) qe2.rec(cand.hook.quest, true).opened = true;
  qe2.setFlag(cand.hook.flag, true);
  coupling.via_setflag.push({ flag: cand.hook.flag, flag_raised: !!sim2.quest.flags[cand.hook.flag], hook_payload_landed: payloadLanded(cand.hook, sim2) });
}
// NON-VACUOUS: a leg that never raised its flag proves nothing. If no leg ran, the verdict is
// withheld and the tool fails.
//
// The verdict compares LEG 1 AGAINST LEG 2, not against perfection. A hook that does not fire
// from `setFlag()` either cannot fire at all — `point_of_no_return_crossed` points at a journal
// entry whose state is `success`, and the journal branch of `setFlag()` deliberately refuses to
// write terminal entries, so that row is unfireable by construction — and that is an authoring
// defect in the row, not a coupling defect in the write path. Holding the write path responsible
// for it would make this test unpassable and therefore uninformative.
const ran = coupling.tested.filter((t) => t.leg_ran);
const ctlById = new Map(coupling.via_setflag.map((t) => [t.flag, t]));
coupling.legs_run = ran.length;
coupling.vacuous = ran.length === 0;
coupling.unfireable_rows = coupling.via_setflag.filter((t) => !t.hook_payload_landed).map((t) => t.flag);
const comparable = ran.filter((t) => (ctlById.get(t.flag) || {}).hook_payload_landed === true);
coupling.comparable_legs = comparable.length;
coupling.coupled = !coupling.vacuous && comparable.length > 0 && comparable.every((t) => t.hook_payload_landed === true);
coupling.setflag_works = coupling.via_setflag.some((t) => t.hook_payload_landed === true);

if (FALSIFY === 'plant-flag') {
  console.log('[falsify plant-flag] the control leg IS the plant-flag arm: it raises the same flag through setFlag() rather than through a played resolution.');
}

// ---------------------------------------------------------------- C. the end-to-end leg
// The two legs above test the WRITE PATH. This one tests the whole sentence a player lives:
// resolve an earlier quest -> its consequence raises a world flag -> the hook table confers a
// reveal on a LATER quest -> that later quest's resolution stops refusing on that ground.
//
// `questReveal` is never called. `questSetFlag` is never called. The only verb used is
// `resolve()`, which is gated, and the gate is left armed — the leg asserts on the REFUSAL
// STRING moving, not on the resolution becoming available, because the other clauses of that
// gate (standing, prerequisites, topics) belong to other pieces and are legitimately still shut.
const e2e = { cases: [], ok: false };
for (const row of (hooksDoc.hooks || []).filter((h) => h.quest && h.reveal)) {
  const producers = raisedByConsequence.get(row.flag) || [];
  const questLevel = quests.filter(({ q }) => (((q.consequences || {}).world_flags) || []).includes(row.flag)).map(({ q }) => ({ quest: q.id, res: '(every ending)' }));
  const src = producers[0] || questLevel[0];
  if (!src) { e2e.cases.push({ reveal: row.reveal, on: row.quest, error: 'no producer for ' + row.flag }); continue; }
  const sim = freshSim();
  const qe = new QuestEngine(book, null, hooksDoc, sim);
  qe.presenceMode = 'off';
  qe.rec(row.quest, true).opened = true;                    // the later quest is under way
  const targetDef = book.get(row.quest);
  const demanding = (targetDef.resolutions || []).filter((r) => (r.requires_knowing || []).includes(row.reveal));
  // refusal strings BEFORE, straight off the shipped gate
  const { canResolve } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/gate.js')).href);
  const before = demanding.map((r) => ({ res: r.id, why: (canResolve(r, qe.context()).why || []).filter((w) => w.includes(row.reveal)) }));
  // ---- the played act: the SOURCE quest's consequences, through the shipping write path
  const srcDef = book.get(src.quest);
  const srcRes = src.res === '(every ending)' ? (srcDef.resolutions || [])[0] : (srcDef.resolutions || []).find((r) => r.id === src.res);
  qe.rec(src.quest, true).opened = true;                   // you were doing the earlier quest too
  qe._applyConsequences(srcDef, srcRes);
  const knowFlag = !!(sim.quest.quests[row.quest] && sim.quest.quests[row.quest].flags[`know:${row.reveal}`]);
  const after = demanding.map((r) => ({ res: r.id, why: (canResolve(r, qe.context()).why || []).filter((w) => w.includes(row.reveal)) }));
  e2e.cases.push({
    reveal: row.reveal, on: row.quest, learned_by_playing: `${src.quest}/${src.res}`, flag: row.flag,
    know_flag_written: knowFlag,
    refusals_before: before.reduce((n, b) => n + b.why.length, 0),
    refusals_after: after.reduce((n, b) => n + b.why.length, 0),
    sample_refusal: (before.find((b) => b.why.length) || {}).why || [],
    // A reveal that no resolution names cannot demonstrate a gate opening, because there is no
    // gate. That is not a failed route — the `know:` flag is written either way — so it is
    // classified rather than scored, and the verdict is taken over the demonstrable cases only.
    demanding_resolutions: demanding.length,
    passed: knowFlag && before.some((b) => b.why.length) && after.every((a) => a.why.length === 0),
    no_gate_demands_it: demanding.length === 0,
  });
}
const demonstrable = e2e.cases.filter((c) => !c.error && !c.no_gate_demands_it);
e2e.demonstrable = demonstrable.length;
e2e.undemanded = e2e.cases.filter((c) => c.no_gate_demands_it).map((c) => c.reveal);
e2e.ok = demonstrable.length > 0 && demonstrable.every((c) => c.passed);

// ------------------------------------------------- D. the people channel, end to end
//
// W1-18 round 2. The same question section C asks of the hook table, asked of the route this
// round built: play the thing a player does, and watch the gate stop refusing.
//
// THE ACT IS `learnFrom('person', <npc>)`, which is the exact function `Engine.talkTo()` calls
// and the only thing it does with the result. `questReveal` and `questNote` are never called.
// The offer gate is not touched: the quest is put in the OPEN state directly, because whether
// this player could have been offered this quest is a different measurement that belongs to
// `mainline-findability.mjs`, and half these quests are rank-gated behind a ladder.
//
// NON-VACUOUS, and this is the whole reason the section is written this way. The obvious version
// — "call learnFrom, assert the refusals are gone" — passes trivially for a quest whose gate
// never named the reveal, and passes silently for a leg where `learnFrom` refused everything. So:
//
//   * a leg is only RUN if the gate refused BY NAME before the act. If it did not, there was
//     nothing to open and the leg is classified, not scored.
//   * a leg that ran and learned nothing is a FAILURE, not a skip.
//   * `--falsify no-router` empties the index and every run leg must go red. If it does not,
//     this section is not measuring the router.
const { canResolve: canResolveD } = await import(url.pathToFileURL(path.join(ROOT, 'game/src/sim/quest/gate.js')).href);
const allDefs = book.ids.map((id) => book.get(id));
const routeIndex = buildRevealRoutes(allDefs);
const NO_ROUTER = FALSIFY === 'no-router';

const people = { cases: [], ok: false, journal_writes: 0 };
for (const def of allDefs) {
  const personRows = ((def.deceit && def.deceit.revealed_by) || []).filter((r) => CHANNEL_READERS[r.channel] === 'person' && npcIds.has(r.source));
  if (!personRows.length) continue;
  const demanded = new Set();
  for (const r of (def.resolutions || [])) for (const k of (r.requires_knowing || [])) demanded.add(k);
  const sources = [...new Set(personRows.map((r) => r.source))].sort();
  const sim = freshSim();
  const qe = new QuestEngine(book, null, hooksDoc, sim);
  qe.presenceMode = 'off';
  qe.revealRoutes = NO_ROUTER ? new Map() : routeIndex;
  qe.rec(def.id, true).opened = true;
  // A row marked `before_point_of_no_return: false` is a truth that only arrives after the
  // crossing, and `learnFrom()` holds it back until the flag is up. The leg therefore has to be
  // stood in the world where that row is reachable — and it gets there by PLAYING the quest whose
  // consequences raise it, through the same `_applyConsequences` path sections B and C use.
  // Nothing is granted.
  let crossedPonr = false;
  if (personRows.some((r) => r.before_point_of_no_return === false)) {
    const p = (raisedByConsequence.get('point_of_no_return_crossed') || [])[0];
    if (p) {
      const pDef = book.get(p.quest);
      qe.rec(p.quest, true).opened = true;
      qe._applyConsequences(pDef, (pDef.resolutions || []).find((r) => r.id === p.res));
      crossedPonr = !!sim.quest.flags['point_of_no_return_crossed'];
    }
  }
  const targets = (def.resolutions || []).filter((r) => (r.requires_knowing || []).some((k) => personRows.some((p) => p.id === k)));
  const namesBefore = (r) => (canResolveD(r, qe.context()).why || []).filter((w) => personRows.some((p) => w.includes(p.id)));
  const before = targets.reduce((n, r) => n + namesBefore(r).length, 0);
  const sample = targets.map((r) => namesBefore(r)).find((w) => w.length) || [];
  // ---- THE ACT
  let learned = 0, journal = 0, refusals = [];
  for (const s of sources) {
    const r = qe.learnFrom('person', s);
    learned += r.learned.length; journal += r.journal.length;
    for (const x of r.refused) if (x.quest === def.id) refusals.push(`${x.reveal}: ${x.why}`);
  }
  const after = targets.reduce((n, r) => n + namesBefore(r).length, 0);
  const wroteJournal = (sim.quest.journal || []).filter((e) => e.quest === def.id).map((e) => e.n);
  people.journal_writes += journal;
  const ran = before > 0;
  people.cases.push({
    quest: def.id, sources, reveals: personRows.map((r) => r.id),
    demanded_by_a_resolution: personRows.filter((r) => demanded.has(r.id)).map((r) => r.id),
    learned, journal_entries_written: wroteJournal, refusals, crossed_ponr: crossedPonr,
    refusals_before: before, refusals_after: after,
    sample_refusal: sample[0] || null,
    leg_ran: ran,
    passed: ran && learned > 0 && after === 0,
  });
}
const peopleRun = people.cases.filter((c) => c.leg_ran);
people.legs_run = peopleRun.length;
people.legs_total = people.cases.length;
people.not_run = people.cases.filter((c) => !c.leg_ran).map((c) => c.quest);
people.ok = peopleRun.length > 0 && peopleRun.every((c) => c.passed);

// ---- THE CALL SITE. A router with no caller is exactly the inert fix this round exists to
// stop, and section D above drives `learnFrom()` directly, so on its own it cannot tell a wired
// engine from an unwired one. This reads the shipped `Engine.talkTo()` and asserts the call is
// in it. It is a static assertion and it is labelled as one: the WORLD-side proof — a browser,
// `talkTo` through the harness, `getQuestState()` after — is in `reports/runs/W1-18-R2/`.
const engineSrc = fs.readFileSync(path.join(ROOT, 'game/src/engine.js'), 'utf8');
const talkToBody = (engineSrc.split(/\n {2}talkTo\(eid\) \{\n/)[1] || '').split(/\n {2}\}\n/)[0];
people.call_site = {
  where: 'game/src/engine.js#talkTo(eid)',
  calls_learn_from: /questEngine\.learnFrom\(\s*'person'/.test(talkToBody),
  note: 'static assertion; the world-side proof is a browser run under reports/runs/W1-18-R2/',
};

// ---------------------------------------------------------------- report
const report = {
  schema: 'elder-souls/reveal-route-audit@1',
  generated_by: 'tools/quests/reveal-route-audit.mjs',
  quests: quests.length,
  hooks_rows_total: hookRows.length,
  hooks_rows_with_quest_and_reveal: hookRows.filter((r) => r.quest && r.reveal).length,
  demanded_reveals: rows.length,
  routed: rows.length - unrouted.length,
  unrouted: unrouted.length,
  by_channel: byChannel,
  fully_blocked_quests: blockedQuests,
  coupling,
  end_to_end: e2e,
  people_channel: people,
  person_routes_with_no_such_npc: personSourceMissing,
  unrouted_rows: unrouted,
};

if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); }
else {
  console.log(`\nreveal-route-audit — can play produce the reveals the resolutions demand?\n`);
  console.log(`  quests ......................................... ${report.quests}`);
  console.log(`  hooks.json rows ................................ ${report.hooks_rows_total}`);
  console.log(`  ... carrying BOTH a quest and a reveal ......... ${report.hooks_rows_with_quest_and_reveal}`);
  console.log(`\n  A. (quest,reveal) pairs a resolution demands .... ${report.demanded_reveals}`);
  console.log(`     with SOME route a player can walk ........... ${report.routed}`);
  console.log(`     with NO route at all ........................ ${report.unrouted}`);
  console.log(`\n     by channel:`);
  for (const [c, v] of Object.entries(byChannel).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`       ${c.padEnd(16)} ${String(v.total).padStart(3)} demanded, ${String(v.routed).padStart(3)} routed  ${v.routed === 0 ? '<- no reader in game/src/' : ''}`);
  }
  console.log(`\n     quests with EVERY resolution blocked ........ ${blockedQuests.length}`);
  for (const b of blockedQuests) console.log(`       ${b.id.padEnd(12)} ${b.resolutions} resolutions, 0 reachable   [${b.file}]`);
  console.log(`\n  B. coupling test — does a PLAYED world_flag reach the hook table?`);
  console.log(`     hook rows whose flag a resolution raises ..... ${coupling.candidates}`);
  console.log(`     legs that actually raised their flag ......... ${coupling.legs_run} (a leg that did not is NOT RUN, not a pass)`);
  for (const t of coupling.tested) {
    console.log(`       ${t.flag.padEnd(28)} raised by ${t.raised_by.padEnd(30)} flag_raised=${t.flag_raised}  hook_fired=${t.leg_ran ? t.hook_payload_landed : 'NOT RUN'}`);
  }
  console.log(`     control — same flag through setFlag():`);
  for (const t of coupling.via_setflag) console.log(`       ${t.flag.padEnd(28)} flag_raised=${t.flag_raised}  hook_fired=${t.hook_payload_landed}`);
  if (coupling.unfireable_rows.length) {
    console.log(`     rows the control CANNOT fire either (authoring defect, not coupling):`);
    for (const f of coupling.unfireable_rows) console.log(`       ${f}  <- excluded from the verdict, reported here`);
  }
  console.log(`\n     legs comparable against the control ......... ${coupling.comparable_legs}`);
  console.log(`     played-resolution route couples ............. ${coupling.vacuous ? 'WITHHELD (no leg ran)' : coupling.coupled}`);
  console.log(`     setFlag() route couples (the control) ....... ${coupling.setflag_works}`);
  console.log(`\n  C. end-to-end — play the source quest, does the later quest stop refusing?`);
  for (const c of e2e.cases) {
    if (c.error) { console.log(`       ${String(c.reveal).padEnd(26)} ERROR ${c.error}`); continue; }
    console.log(`       ${c.reveal.padEnd(26)} on ${c.on.padEnd(11)} learned by playing ${c.learned_by_playing}`);
    console.log(`         know: flag written by the hook table ... ${c.know_flag_written}`);
    if (c.no_gate_demands_it) { console.log(`         no resolution demands it — route works, nothing to open (not scored)`); continue; }
    console.log(`         gate refusals naming it  before ${c.refusals_before} -> after ${c.refusals_after}   ${c.passed ? 'PASS' : 'FAIL'}`);
    if (c.sample_refusal.length) console.log(`         was: "${c.sample_refusal[0]}"`);
  }
  console.log(`     demonstrable cases (a gate actually demands it)  ${e2e.demonstrable}`);
  console.log(`     all demonstrable end-to-end cases pass ......... ${e2e.ok}`);
  console.log(`\n  D. the people channel — talk to the person the file names, does the gate stop refusing?`);
  console.log(`     quests with a person-channel reveal whose source exists  ${people.legs_total}`);
  console.log(`     legs RUN (the gate refused by name before the act) ..... ${people.legs_run}`);
  for (const c of people.cases.filter((x) => x.leg_ran)) {
    console.log(`       ${c.quest.padEnd(11)} talk to ${c.sources.join(', ').padEnd(26)} refusals ${c.refusals_before} -> ${c.refusals_after}  journal +${c.journal_entries_written.length}  ${c.passed ? 'PASS' : 'FAIL'}`);
    if (!c.passed) console.log(`         learned ${c.learned}; refused: ${c.refusals.join(' | ') || '(nothing)'}`);
  }
  if (people.not_run.length) console.log(`     not run (no resolution names the reveal): ${people.not_run.length} — ${people.not_run.slice(0, 6).join(', ')}${people.not_run.length > 6 ? ' …' : ''}`);
  console.log(`     journal entries written by note() from play .... ${people.journal_writes}`);
  console.log(`     Engine.talkTo() calls questEngine.learnFrom() .. ${people.call_site.calls_learn_from}  (static; browser proof under reports/runs/W1-18-R2/)`);
  console.log(`     every run leg passes ........................... ${people.ok}`);
  if (personSourceMissing.length) {
    console.log(`     person routes naming somebody who is NOT in game/data/npcs/** (counted UNROUTED): ${personSourceMissing.length}`);
    for (const m of personSourceMissing.slice(0, 12)) console.log(`       ${m.quest.padEnd(11)} ${m.reveal.padEnd(26)} ${m.source}`);
  }
  if (NO_ROUTER) {
    const stillPassing = peopleRun.filter((c) => c.passed);
    console.log(`\n     [falsify no-router] revealRoutes emptied. legs still passing: ${stillPassing.length} (MUST be 0)`);
  }
  if (!coupling.coupled && coupling.setflag_works) {
    console.log(`\n     DIAGNOSIS: the hook table WORKS and nothing in play calls it.`);
    console.log(`     QuestEngine._applyConsequences writes q.flags[wf] = 1 directly instead of`);
    console.log(`     calling this.setFlag(wf), so every hook keyed to a flag a quest raises is dead.`);
  }
}

const outDir = path.join(ROOT, 'reports/runs/W1-19-R3');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'reveal-route-audit.json'), JSON.stringify(report, null, 2));
console.log(`\nwrote reports/runs/W1-19-R3/reveal-route-audit.json`);

// `--falsify no-router` INVERTS the verdict for section D: the arm is a success when every leg
// goes red, so a run that still passes there is the failure.
const ok = report.unrouted === 0 && coupling.coupled && e2e.ok
  && (NO_ROUTER ? peopleRun.every((c) => !c.passed) : (people.ok && people.call_site.calls_learn_from));
process.exit(ok ? 0 : 1);
