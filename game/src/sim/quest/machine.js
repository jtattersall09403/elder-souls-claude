// The quest state machine.
//
// A quest here is a small, explicit, side-effect-declaring automaton over data it does not
// own. Every transition is one of six verbs — `open`, `note`, `reveal`, `takeBranch`,
// `resolve`, `fail` — and every one of them is (a) deterministic, (b) idempotent where that is
// meaningful, and (c) journal-writing, because a stage the journal does not record is a stage
// the player cannot see.
//
// Two design rules, both from the corpus rather than from taste:
//
//   * **The machine never invents text.** Journal prose comes from the quest file, verbatim
//     (journal.js). The machine chooses *which* entry; it never composes one. This is what
//     keeps RI-DLG05's voice and RI-QST04's structure from drifting apart.
//   * **Nothing is announced.** There is no "quest started" event on the HUD, no toast, no
//     "objective updated". RI-JRN07 HF4 makes an acknowledgement a hard fail and RI-UIX04 Q11
//     allows exactly one silent, wordless, <=3 s glyph. `glyph` below is that glyph and it
//     carries no text by construction — it is a frame counter and nothing else.
//
// Time: everything is in frames at 60 Hz (`f@60`, seam S22) or in whole simulated days. There
// is no wall clock anywhere in this file.
'use strict';

import { Journal } from './journal.js';
import { canOffer, canResolve } from './gate.js';
import { dateOf } from './calendar.js';
import { PONR_FLAG } from './reveal-routes.js';
import { SAP_TAINT_DISPOSITION } from '../dialogue/disposition.js';

/** The identifying half of a reveal route row, for a refusal line that says which row refused. */
const pick = (row) => ({ quest: row.quest, reveal: row.reveal, channel: row.channel, source: row.source });

/** Morrowind's `fDispDiseaseMod`, per active disease. Cure it and the door opens again. */
const DISEASE_DISPOSITION_PER = -12;

/** RI-UIX04 Q11's exemption: one glyph, <= 3 s. 3 s at 60 Hz = 180 f@60. */
export const GLYPH_FRAMES = 180;

/**
 * Quest-level consequences union resolution-level consequences. Additive for maps and arrays;
 * the resolution wins on nothing, because a resolution that could CANCEL a quest-level
 * consequence would make the census in tools/analysis/quest-audit.mjs unsound.
 */
export function mergeConsequences(base, extra) {
  if (!extra) return base;
  const out = {
    faction_reputation: { ...(base.faction_reputation || {}) },
    npc_disposition: { ...(base.npc_disposition || {}) },
    unlocks: [...(base.unlocks || [])],
    locks: [...(base.locks || [])],
    world_flags: [...(base.world_flags || [])],
    kills_npc: [...(base.kills_npc || [])],
    // W1-19 round 2. The one consequence that makes the RI-DLG04 §B faction term reachable by
    // playing: a resolution where the player TAKES THE RANK is a resolution where the player
    // joins. Before this, `sim.quest.factions[f].member` was created `false` by this very
    // function and set true by nothing in the build, so `factionTerm`'s membership branch was
    // unreachable from the world and the term had to be faked out of a reputation row instead.
    joins_faction: [...(base.joins_faction || [])],
  };
  for (const [k, v] of Object.entries(extra.faction_reputation || {})) out.faction_reputation[k] = (out.faction_reputation[k] || 0) + v;
  for (const [k, v] of Object.entries(extra.npc_disposition || {})) out.npc_disposition[k] = (out.npc_disposition[k] || 0) + v;
  for (const k of ['unlocks', 'locks', 'world_flags', 'kills_npc', 'joins_faction']) {
    for (const v of extra[k] || []) if (!out[k].includes(v)) out[k].push(v);
  }
  return out;
}

export class QuestEngine {
  /**
   * @param {import('./defs.js').QuestBook} book
   * @param {import('./gate.js').FactionGates} gates
   * @param {object} hooks  game/data/quests/hooks.json — the systems layer keyed by world_flags
   *   that RI-QST04 "How we lose" requires quest *behaviour* to live in, so that the quest
   *   files stay pure data.
   * @param {object} sim
   */
  constructor(book, gates, hooks, sim) {
    this.book = book;
    this.gates = gates;
    this.sim = sim;
    this.journal = new Journal(sim.quest.journal);
    this.events = [];
    this.glyphUntilFrame = -1;

    // GAP-W1-quest-givers-not-in-the-world. Three settings, and the middle one is the reason
    // this is a field rather than an `if`:
    //
    //   'on'      a quest whose giver is nowhere cannot be opened.       (the shipped behaviour)
    //   'report'  the term is evaluated and counted but never refuses.   (measure before arming)
    //   'off'     the term is not evaluated at all.
    //
    // `report` exists because landing this fail-closed before the world had people in it would
    // have refused every quest in the build, and taking the engine down is how four previous
    // rounds were lost. The order that works is: author the population, run the whole tree in
    // `report` and read the misses, then arm. `presenceMisses`/`presenceMissed` are what a probe
    // reads in that middle mode, and they keep accumulating in `on` so a run can say WHICH quest
    // was refused for want of a person rather than just that something was.
    this.presenceMode = 'on';
    this.presenceMisses = 0;
    this.presenceMissed = [];

    // W1-07 round 4. The register (`sim.quest.dispositions`) is what the WORLD has written
    // down about you — the giver's authored base plus every delta a quest or a Charm has
    // added. It is not what the person in front of you feels, because it contains no term for
    // who you are. `Engine` installs that term here; see `_dispositionToward`.
    this.dispositionModel = null;

    // W1-LIBRARY round 2. book id -> the knowledge ids that READING it confers. Installed by
    // `Engine._bookKnowledgeIndex()` from `game/data/books/**` and the quest book.
    //
    // Before this, `ctx.knowledge` unioned only per-quest `know:` flags, whose sole writer is
    // `reveal()`, which throws unless the id is in that quest's `deceit.revealed_by` — and none
    // of the three book keys named by a `requires.knowledge` appears in any `revealed_by` in any
    // quest file. `book.knowledge_key` had zero readers in `game/src/`. Three of the game's
    // non-violent exits were therefore permanently closed, and the round-1 critic measured them
    // closed in a real browser after reading each book to its last page.
    //
    // Two authored linkages feed it, and the index is where they are reconciled:
    //   * `requires.knowledge: ["book_the_court_and_the_tide"]` names the key directly (3 books);
    //   * `deceit.revealed_by: [{id, channel:'book', source:'book_the_seventh_recension'}]` names
    //     the key as the SOURCE of a reveal id, and the resolution gates on that id through
    //     `requires_knowing` (5 books). All eight shipped `knowledge_key`s are one or the other.
    //
    // This widens the DERIVED context; it does not write flags. `reveal()` remains the only
    // writer of a `know:` flag, and therefore the only thing that emits a `reveal` event. The
    // consequence is deliberate and is the point of RI-UIX05 §D's *"books readable BEFORE the
    // quest that references them"* row: a book read three regions before the quest opens still
    // counts, because `booksRead` is durable and the union is recomputed every time a gate runs.
    //
    // Left empty this changes nothing: an engine that installs no index behaves exactly as it
    // did before, which is what keeps it out of the "fail-closed before its data exists" trap.
    this.bookKnowledge = new Map();

    // W1-18 round 2. `"<kind>:<source>"` -> the `deceit.revealed_by` rows that source produces.
    // Installed by `Engine._installRevealRoutes()` from `sim/quest/reveal-routes.js`, which is
    // also where the reasoning about which channels are routable lives. Left empty this changes
    // nothing: `learnFrom()` finds no rows and returns an empty result, so an engine that
    // installs no index behaves exactly as it did before.
    this.revealRoutes = new Map();

    this.flagHooks = new Map();     // world flag -> hook[]
    this.entryTopics = new Map();   // "questId#index" -> topic ids (RI-DLG05 §A.3 AddTopic edge)
    this.deadlines = [];
    for (const h of (hooks && hooks.hooks) || []) {
      if (!this.flagHooks.has(h.flag)) this.flagHooks.set(h.flag, []);
      this.flagHooks.get(h.flag).push(h);
    }
    for (const t of (hooks && hooks.entry_topics) || []) {
      this.entryTopics.set(`${t.quest}#${t.index}`, t.adds_topics.slice());
    }
    for (const d of (hooks && hooks.deadlines) || []) this.deadlines.push(d);

    // Every hook must name a quest and an index that exist, or the hook silently does nothing
    // and the quest dead-ends — the failure RI-QST04 check 3 exists to catch, one layer out.
    // These are CONTENT integrity checks, and content integrity is not the engine's job to
    // enforce at construction. Four times in one day a hook or a call site landed minutes ahead
    // of the data it names, the engine refused to construct, and every other agent on the box
    // went down with it — they all boot-check before they measure. The check itself is right and
    // is not being weakened: it now runs fail-loud in `tools/check-quests.mjs`, which the commit
    // hook runs over the JSON with no browser at all, so a dangling reference fails the *commit*
    // rather than everybody's boot. Here they are collected and reported.
    this.integrity = [];
    for (const hs of this.flagHooks.values()) {
      for (const h of hs) {
        if (!h.quest) continue;
        if (!this.book.has(h.quest)) { this.integrity.push(`hooks.json: ${h.flag} -> ${h.quest}, which is not a quest`); continue; }
        const q = this.book.get(h.quest);
        if (h.journal != null && !(q.journal || []).some((e) => e.index === h.journal)) {
          this.integrity.push(`hooks.json: ${h.flag} -> ${h.quest}#${h.journal}, which the quest file does not contain`);
        }
      }
    }
    for (const t of this.entryTopics.keys()) {
      const [qid, ix] = t.split('#');
      if (!this.book.has(qid)) { this.integrity.push(`hooks.json entry_topics: ${t} names no quest`); continue; }
      const q = this.book.get(qid);
      if (!(q.journal || []).some((e) => e.index === Number(ix))) this.integrity.push(`hooks.json entry_topics: ${t} does not exist`);
    }
    // RI-DLG05 §A.3: "Every quest chain must have >= 1 such edge."
    //
    // DOWNGRADED TO A WARNING BY THE ORCHESTRATOR, 2026-08-07. It landed fail-closed before the
    // hooks it demands were authored, and took the engine — and therefore all eleven agents then
    // running, every one of which boot-checks — down with it. This is the second time a builder
    // has shipped an assertion ahead of its own data; the rule is: author the data, prove the
    // assertion is silent on the shipped tree, and only then arm it.
    //
    // RE-ARM by setting STRICT_ENTRY_TOPICS = true, once `node tools/harness/boot-check.mjs`
    // passes with it on. Whoever finishes the main-quest topic seeding owns that.
    const seeded = new Set([...this.entryTopics.keys()].map((k) => k.split('#')[0]));
    const missing = this.book.ids.filter((id) => !seeded.has(id));
    if (missing.length) {
      this.integrity.push(`hooks.json: ${missing.length} quest(s) seed no topic from a journal write (RI-DLG05 §A.3): ${missing.slice(0, 8).join(', ')}`);
    }
    if (this.integrity.length) console.warn(`[quest] ${this.integrity.length} content-integrity problem(s); tools/check-quests.mjs has the list`);
  }

  // ---- observation -------------------------------------------------------------------------

  rec(id, create = false) {
    const m = this.sim.quest.quests;
    if (!m[id] && create) m[id] = { stage: 0, branch: null, failed: false, opened: false, giverDispositionDelta: 0, timeLimitInFrames: null, flags: {} };
    return m[id] || null;
  }

  /**
   * GAP-FCT-01. `opened` is set by `open()` alone. A row minted by `reveal()` (foreknowledge) or
   * by `fail()` (a severed thread you never accepted) is NOT an open quest and may not be
   * resolved, noted or branched. Old saves have no `opened`; the loader derives it from `stage`.
   */
  isOpen(id) { const r = this.rec(id); return !!r && !!r.opened && !r.failed && !this.sim.quest.completed.includes(id); }
  isClosed(id) { const r = this.rec(id); return !!r && (!!r.failed || this.sim.quest.completed.includes(id)); }

  /** Everything the gate functions need, assembled from live sim state. */
  context() {
    const q = this.sim.quest;
    const know = new Set();
    for (const id of Object.keys(q.quests)) {
      for (const k of Object.keys(q.quests[id].flags || {})) if (k.startsWith('know:')) know.add(k.slice(5));
    }
    // ...and what you have READ. `book.knowledge_key` had zero readers in `game/src/`; this is
    // the reader. It is a union rather than a second gate so that `requires.knowledge` does not
    // have to know where the knowledge came from — a truth learned from a person and the same
    // truth learned from a book satisfy the same clause, which is the point of a lore gate.
    for (const bid of q.booksRead || []) {
      for (const k of this.bookKnowledge.get(bid) || []) know.add(k);
    }
    const reputation = {}, ranks = {};
    for (const f of Object.keys(q.factions)) {
      reputation[f] = q.factions[f].reputation || 0;
      ranks[f] = q.factions[f].rank || 0;
    }
    const attributes = this.sim.progression.attributes;
    const skills = Object.fromEntries(Object.entries(this.sim.progression.skills || {}).map(([k, v]) => [k, v && v.value != null ? v.value : v]));
    const worldFlags = new Set(Object.keys(q.flags).filter((k) => q.flags[k]));
    // RI-QST03 §B: a rank is *"a four-part statement — reputation, attribute, two distinct
    // favoured skills, world state"*, which is to say a rank is EARNED and therefore DERIVED.
    // `q.factions[f].rank` is written by nothing in the build (`_applyConsequences` writes
    // reputation and never rank), so every `rank_gate` read 0 and `FactionGates
    // .highestQualifying()` — which exists precisely to answer this — was dead code. The
    // stored rank still wins where something ever sets it; the ladder fills the gap.
    if (this.gates) {
      const lite = { reputation, attributes, skills, worldFlags };
      for (const f of this.gates.ids()) {
        const earned = this.gates.highestQualifying(f, lite);
        if (earned > (ranks[f] || 0)) ranks[f] = earned;
      }
    }
    // W1-FACTIONS. RI-QST03 §C's exclusivity — X1 hard groups, X4 enemy pairs and X2 earned
    // locks — had **no world-side consumer anywhere in the running game**. `FactionGates
    // .closedBy()` was written, tested and called by nothing; `_applyConsequences` initialised
    // `rivalry_locked: []` on every standing row and never wrote to it. So the property the
    // brief calls "the thing Morrowind does that almost nothing else does, and the point of the
    // whole system" was a JSON file: a player could hold rank 7 in the Wet Ledger and rank 7 in
    // the Assize that exists to hang it, in one save, and nothing in the build objected.
    //
    // This is the reader. It is a DERIVATION rather than a write, for two reasons: a read cannot
    // be bypassed by anything that sets standing directly (including the harness, which is what
    // makes the perturbation test honest), and RI-QST03 §C X1 says the lock lands "permanently,
    // at join time", so it must hold on the very first `offers()` call after the rank exists.
    // WHAT COUNTS AS "YOU ARE ONE OF THEM". This was `Math.max(ranks[f], member ? 1 : 0)` —
    // a DERIVED rank alone was enough to close every rival. Derived rank asks only for
    // reputation, an attribute and a skill, and reputation is paid sideways all over the book:
    // `Q-ASSZ-04 res_hide_vell` pays the Drowned Court 20 for hiding a witness. Driving the
    // Imperial Assize line through `questOffers()` from a cold start, that single favour derived
    // Drowned Court rank 1 and the Assize then refused its OWN rank-5 quest — "The Imperial
    // Assize will not deal with you: you are The Drowned Court" — to a player who had never
    // joined the Drowned Court and had done the favour on the Assize's own instructions. 4 of 9
    // quests on the line went unreachable.
    //
    // So a rank closes a rival only where the player actually JOINED: `joins_faction`, an
    // authored act with a scene around it. Reputation without membership is a qualification —
    // it is what makes you *eligible* to join — and RI-QST03 §C X1's "permanently, at join time"
    // says the same thing in four words. Standing you were paid is not a career you chose.
    const heldRank = (f) => ((q.factions[f] && q.factions[f].member) ? Math.max(ranks[f] || 0, 1) : 0);
    const rivalryLocked = new Set();
    if (this.gates) {
      const ex = this.gates.exclusivity || {};
      for (const f of this.gates.ids()) {
        const held = heldRank(f);
        if (held < 1) continue;
        // X1 + X4: holding any rank at all closes these outright.
        for (const other of this.gates.closedBy(f)) rivalryLocked.add(other);
        // X2: compatible until a declared rank, then closed. RI-CRM02 §4's exclusion table.
        for (const row of ex.earned || []) {
          if (row.a === f && row.a_locks_b_at_rank != null && held >= row.a_locks_b_at_rank) rivalryLocked.add(row.b);
          if (row.b === f && row.b_locks_a_at_rank != null && held >= row.b_locks_a_at_rank) rivalryLocked.add(row.a);
        }
      }
      rivalryLocked.delete(undefined);
    }
    // A closed faction's quests are closed. `locked` is the set `canOffer()` already consults,
    // so the refusal arrives through the same path as every other one and reads the same way.
    const locked = new Set(Object.keys(q.flags).filter((k) => k.startsWith('locked:') && q.flags[k]).map((k) => k.slice(7)));
    const lockedReason = new Map();

    // ---- EXPULSION — RI-QST03 §D, absent in round 1 ------------------------------------------
    // A faction throws you out for something you did to it while you were inside it. It arrives
    // through `locked`, exactly as a rivalry lock does, so `canOffer()` speaks the sentence a
    // giver would speak and no second refusal path had to be invented. `discipline` is
    // game/data/progression/faction-discipline.json, installed by the engine; left uninstalled
    // this loop does nothing, which is what keeps it out of the fail-closed-before-its-data trap.
    //
    // NEVER a refusal. RI-QST02 D4 says a refusal must be a way to win, and round 1 already had
    // refusals capping the ladder at rank six; making them expel as well would ship the same
    // defect twice. Every declared cause is an act against the house from inside it.
    this.expelled = new Map();
    for (const row of (this.discipline && this.discipline.factions) || []) {
      const readmitted = row.readmission && q.flags[row.readmission.flag];
      if (readmitted) continue;
      const hit = (row.expelled_by || []).find((c) => q.flags[c.flag]);
      if (!hit) continue;
      this.expelled.set(row.faction, { reason: hit.reason, on_flag: hit.flag, readmission: row.readmission || null });
      for (const def of this.book.all()) {
        const fid = def.faction || (def.rank_gate && def.rank_gate.faction);
        if (fid !== row.faction || q.completed.includes(def.id)) continue;
        locked.add(def.id);
        lockedReason.set(def.id, hit.reason);
      }
    }
    if (rivalryLocked.size) {
      for (const def of this.book.all()) {
        const fid = def.faction || (def.rank_gate && def.rank_gate.faction);
        if (fid && rivalryLocked.has(fid) && !q.completed.includes(def.id)) {
          locked.add(def.id);
          const by = this.gates.ids().filter((x) => heldRank(x) >= 1
            && (this.gates.closedBy(x).includes(fid) || (this.gates.exclusivity.earned || []).some((r) => (r.a === x && r.b === fid) || (r.b === x && r.a === fid))));
          const nm = (id) => { try { return this.gates.get(id).name; } catch { return id; } };
          lockedReason.set(def.id, `${nm(fid)} will not deal with you: you are ${by.map(nm).join(' and ')}`);
        }
      }
      // Mirror onto the standing rows so a save, a UI and a probe can all see WHY, rather than
      // only that the quest went away. This is bookkeeping, not the gate: the gate is `locked`.
      for (const f of Object.keys(q.factions)) {
        if (rivalryLocked.has(f)) {
          const row = q.factions[f];
          if (!Array.isArray(row.rivalry_locked)) row.rivalry_locked = [];
          for (const by of this.gates.ids()) {
            const held = heldRank(by);
            if (held >= 1 && this.gates.closedBy(by).includes(f) && !row.rivalry_locked.includes(by)) row.rivalry_locked.push(by);
          }
        }
      }
    }
    return {
      reputation, ranks, attributes, skills, worldFlags,
      rivalry_locked: rivalryLocked,
      topicsKnown: new Set(q.topicsKnown),
      // NOT the raw register. `_dispositionToward` is the whole of what this person feels
      // about this character, and the offer gate reads the same number the resolution gate
      // does. Before W1-07 round 4 this line was `q.dispositions`, so no race term, no
      // upbringing term and no faction term ever reached `canOffer`.
      dispositions: this.dispositionView(),
      completed: new Set(q.completed),
      locked, lockedReason,
      knowledge: know,
      items: new Set((this.sim.inventory || []).map((i) => i.id)),
      // RI-MAG06 / RI-MAG04 M6: a `requires.spell_effects` gate is satisfied by an effect the
      // player has CAST, not by one they own a spell for. Owning `open_lock` and never casting
      // it is intent; `CRITIC-DOCTRINE` §1.1 says intent is not output. `knownEffects` remains
      // the SPELLMAKING gate (you may only combine effects you own a spell for), which is a
      // different question and stays where it was.
      spellEffects: new Set(this.sim.magic ? [...(this.sim.magic.castEffects || [])] : []),
      knownSpellEffects: new Set(this.sim.magic ? [...(this.sim.magic.knownEffects || [])] : []),
      magicWorld: this.sim.magic ? this.sim.magic.world : null,
      gold: this.sim.progression.gold || 0,
    };
  }

  /** Which quests a giver could offer right now, and for the rest, exactly why not. */
  offers() {
    const ctx = this.context();
    return this.book.all().map((def) => {
      const r = canOffer(def, ctx, this.gates);
      return { id: def.id, title: def.title, giver: def.giver && def.giver.npc_id, offerable: r.offerable && !this.rec(def.id), why: r.why, gate: r.gate };
    });
  }

  /**
   * How this person actually feels about you, which is the register plus everything the world
   * knows about you that the register does not carry.
   *
   * W1-14 round 3 adds RI-LOR05 §4a's sap-taint term. The tithe-curse is hard canon (CF-006) and
   * had no implementation: a non-Argonian who rests at the hearths — which is to say, who plays
   * the game — accumulates it, and "NPCs notice your eyes". This is where it bites, on the
   * disposition a `requires.disposition` gate reads, which makes `sap_ward` the only thing in
   * the build that can buy a closed door back open. It touches nothing inside the fight, so
   * AR-1 is untouched: no frame, no hitbox, no telegraph and no damage number reads it.
   */
  _dispositionToward(npcId) {
    let d = (this.sim.quest.dispositions || {})[npcId] || 0;
    // W1-07 round 4 — THE fix. `derivedDisposition()` never touched this path: the register
    // went to `canOffer` raw, so six character signatures produced byte-identical disposition
    // clauses and race was invisible to every quest in the build. The model is installed by
    // `Engine` (`_questDispositionModel`) because the arithmetic belongs to
    // `character/reaction.js` (RI-CHR02 §3, the 12x10 matrix) and `sim/dialogue/disposition.js`
    // (RI-DLG04 §B, the movable terms) and the quest machine owns neither.
    const model = this.dispositionModel;
    if (model) {
      const r = model(npcId, d);
      if (r && Number.isFinite(r.value)) d = r.value;
    }
    const t = this.sim.progression && this.sim.progression.sapTaint;
    if (t && t.band) d += SAP_TAINT_DISPOSITION[t.band] || 0;
    // Morrowind's own `fDispDiseaseMod`: a visibly sick stranger is a worse guest. This is the
    // world-side consumer that makes `cure_disease` worth casting on yourself — and, since
    // W1-14 round 3 unified the two affliction arrays, the disease it reads is the one the
    // hazards actually gave you rather than one only the harness could write.
    const sick = (this.sim.quest.afflictions || []).filter((a) => a.kind === 'disease').length;
    if (sick) d += DISEASE_DISPOSITION_PER * sick;
    return Math.max(0, Math.min(100, d));
  }

  /**
   * The disposition table as the gates read it: every person the register knows about, plus
   * every quest giver in the book, each run through `_dispositionToward`.
   *
   * The givers are included even when the register is silent about them, because
   * `num(undefined) === 0` in `gate.js` and a giver with no entry is a hard, race-invariant,
   * unpassable gate that reports itself as a disposition shortfall. Better to name them: a
   * giver with no NPC record now shows a `0/N` clause whose reason `Engine` asserts against at
   * boot, rather than one that looks like an ordinary standing problem.
   */
  dispositionView() {
    const out = {};
    for (const id of Object.keys(this.sim.quest.dispositions || {})) out[id] = this._dispositionToward(id);
    for (const def of this.book.all()) {
      const g = def.giver && def.giver.npc_id;
      if (g && out[g] === undefined) out[g] = this._dispositionToward(g);
    }
    return out;
  }

  /** The same number with its terms shown, for the harness and for a critic. */
  explainDisposition(npcId) {
    const base = (this.sim.quest.dispositions || {})[npcId];
    const r = this.dispositionModel ? this.dispositionModel(npcId, base || 0) : null;
    return {
      npc: npcId,
      register: base === undefined ? null : base,
      value: this._dispositionToward(npcId),
      modelled: !!r,
      ...(r || {}),
    };
  }

  /** The resolutions reachable right now, with the shortfall spelled out for each that is not. */
  resolutionsFor(id) {
    const def = this.book.get(id);
    const ctx = this.context();
    ctx.disposition = this._dispositionToward(def.giver && def.giver.npc_id);
    return (def.resolutions || []).map((r) => {
      const c = canResolve(r, ctx);
      return { id: r.id, method: r.method, violence_required: r.violence_required, available: c.available, why: c.why, excludes: r.exclusive_with || [] };
    });
  }

  // ---- transitions ---------------------------------------------------------------------------

  /**
   * Accept the quest. Writes the lowest `active` index >= 10 the file declares.
   *
   * GAP-FCT-01 (W1-FACTIONS r1 §5): the test used to be "does a record exist", which conflated
   * *a quest you are doing* with *a quest the machine happens to have a row for*. `reveal()` and
   * `fail()` both mint rows with `rec(id, true)`, so foreknowledge of a quest silently made it
   * unopenable forever. The row is now a container; `opened` is the state.
   */
  open(id) {
    const def = this.book.get(id);
    const existing = this.rec(id);
    if (this.isClosed(id)) return { ok: false, reason: 'quest is closed' };
    if (existing && existing.opened) return { ok: false, reason: 'already opened' };
    // ---- THE PRESENCE TERM. GAP-W1-quest-givers-not-in-the-world. --------------------------
    //
    // W1-19 round 2 §2: *"nine of the ninety-four quest givers in this build exist anywhere a
    // player can stand"*, and the gate did not care. Every findability number this project has
    // published was taken by asking `open()` whether a quest could be accepted, and `open()` had
    // no term for whether the person it names is in the world — so a quest given by nobody
    // reported `ok: true`, a probe wrote it down, and the player walked to the town and found
    // the room empty. `mainline-chain-floor.mjs` conceded it in a comment and then spawned the
    // giver out of nothing so the run could continue.
    //
    // A quest is a thing a person asks you to do. If there is no person, there is no quest.
    const giverId = (def.giver && def.giver.npc_id) || null;
    if (giverId && this.presenceMode !== 'off') {
      const present = !!(this.sim.findNPC && this.sim.findNPC(giverId));
      if (!present) {
        this.presenceMisses = (this.presenceMisses || 0) + 1;
        (this.presenceMissed || (this.presenceMissed = [])).push({ quest: id, giver: giverId });
        if (this.presenceMode !== 'report') {
          return { ok: false, reason: `giver absent: ${giverId} is not in this world`, gate: 'giver_presence', giver: giverId };
        }
      }
    }
    const ctx = this.context();
    const c = canOffer(def, ctx, this.gates);
    if (!c.offerable) return { ok: false, reason: c.why.join('; '), gate: c.gate };
    this.rec(id, true).opened = true;
    const first = (def.journal || []).filter((e) => e.state === 'active' && e.index >= 10).map((e) => e.index).sort((a, b) => a - b)[0];
    if (first == null) throw new Error(`${id}: no active journal entry at index >= 10 to open with (RI-QST04 §B)`);
    this._write(def, first, {});
    this._emit('quest_stage', { quest: id, stage: first, transition: 'open' });
    return { ok: true, quest: id, stage: first };
  }

  /** Record a discovery. `index` must be an `active`/`branch` entry the file declares. */
  note(id, index) {
    const def = this.book.get(id);
    const r = this.rec(id);
    if (!r || !r.opened) return { ok: false, reason: 'quest not open' };
    if (this.isClosed(id)) return { ok: false, reason: 'quest is closed' };
    const e = (def.journal || []).find((x) => x.index === index);
    if (!e) throw new Error(`${id}: no journal entry ${index}`);
    if (e.state === 'success' || e.state === 'failure') throw new Error(`${id}: index ${index} is terminal — use resolve()/fail()`);
    if (this.journal.has(id, index)) return { ok: false, reason: 'already written' };
    this._write(def, index, {});
    this._emit('quest_stage', { quest: id, stage: index, transition: 'note' });
    return { ok: true, quest: id, stage: index };
  }

  /**
   * The player learned a truth. This is the ONLY way `requires_knowing` is satisfied, which is
   * what makes the knowledge gate real rather than decorative (RI-JRN07 M-Q14).
   */
  reveal(id, revealId) {
    const def = this.book.get(id);
    const r = this.rec(id, true);
    const rev = ((def.deceit && def.deceit.revealed_by) || []).find((x) => x.id === revealId);
    if (!rev) throw new Error(`${id}: no reveal ${revealId}`);
    if (r.flags[`know:${revealId}`]) return { ok: false, reason: 'already known' };
    r.flags[`know:${revealId}`] = 1;
    this._emit('reveal', { quest: id, reveal: revealId, channel: rev.channel, source: rev.source });
    return { ok: true, quest: id, reveal: revealId, channel: rev.channel };
  }

  /** Take a fork. Irreversible branches record themselves and cannot be retaken. */
  takeBranch(id, branchId) {
    const def = this.book.get(id);
    const r = this.rec(id);
    if (!r || !r.opened) return { ok: false, reason: 'quest not open' };
    const b = (def.branches || []).find((x) => x.id === branchId);
    if (!b) throw new Error(`${id}: no branch ${branchId}`);
    if (r.flags[`branch:${branchId}`]) return { ok: false, reason: 'branch already taken' };
    if (r.stage < b.at_journal_index) return { ok: false, reason: `branch ${branchId} sits at journal ${b.at_journal_index}; the journal is at ${r.stage}` };
    r.flags[`branch:${branchId}`] = 1;
    r.branch = branchId;
    if (b.irreversible) r.flags[`irreversible:${branchId}`] = 1;
    this._emit('quest_branch', { quest: id, branch: branchId, irreversible: !!b.irreversible, leads_to: b.leads_to.slice() });
    return { ok: true, quest: id, branch: branchId, irreversible: !!b.irreversible, leads_to: b.leads_to.slice() };
  }

  /**
   * Close the quest through one of its declared resolutions, and apply its consequences.
   *
   * GAP-FCT-01, W1-FACTIONS r1 §5. This used to gate on `rec(id)` alone — "is there a row" — and
   * `reveal()` mints a row. So a character who had joined nothing, held reputation 0 and whom
   * `canOffer` refused BY NAME could call `questReveal` once and then apply a rank-7 succession
   * ending in full: four world flags, an unlocked rank-7 quest, and +40 reputation with the rival
   * it is excluded from. The offer gate was enforced at `open()` and nowhere else, so every route
   * into the machine that did not go through `open()` was outside every gate this system has.
   *
   * Two gates now, and they answer different questions:
   *   1. `r.opened` — did you ACCEPT this quest? (structural; closes the minted-row hole)
   *   2. `canOffer` — would the world still offer it to you? (substantive; means a rivalry lock,
   *      an expulsion or a lost rank reaches a quest already in your journal, instead of only
   *      the ones you have not started)
   * The refusal carries the gate's own sentences, so the reason a resolve is refused is the same
   * reason a giver would speak.
   */
  resolve(id, resolutionId) {
    const def = this.book.get(id);
    const r = this.rec(id);
    if (!r || !r.opened) return { ok: false, reason: 'quest not open' };
    if (this.isClosed(id)) return { ok: false, reason: 'quest is closed' };
    const res = (def.resolutions || []).find((x) => x.id === resolutionId);
    if (!res) throw new Error(`${id}: no resolution ${resolutionId}`);
    const ctx = this.context();
    const gate = canOffer(def, ctx, this.gates);
    if (!gate.offerable) return { ok: false, reason: gate.why.join('; '), gate: gate.gate, refused_by: 'offer_gate' };
    ctx.disposition = this._dispositionToward(def.giver && def.giver.npc_id);
    const c = canResolve(res, ctx);
    if (!c.available) return { ok: false, reason: c.why.join('; ') };
    for (const x of res.exclusive_with || []) {
      if (r.flags[`resolution:${x}`]) return { ok: false, reason: `${x} was already taken and it excludes ${resolutionId}` };
    }

    r.flags[`resolution:${resolutionId}`] = 1;
    r.flags.resolution = resolutionId;
    this._write(def, res.journal_index, { finished: true });
    if (!this.sim.quest.completed.includes(id)) this.sim.quest.completed.push(id);
    r.stage = res.journal_index;
    const applied = this._applyConsequences(def, res);
    this._emit('quest_resolve', { quest: id, resolution: resolutionId, method: res.method, violence_required: !!res.violence_required, ...applied });
    return { ok: true, quest: id, resolution: resolutionId, journal_index: res.journal_index, ...applied };
  }

  /** Close the quest without resolution. `silent` failures write the entry and say nothing. */
  fail(id, failureId) {
    const def = this.book.get(id);
    const r = this.rec(id, true);
    if (this.isClosed(id)) return { ok: false, reason: 'quest is closed' };
    const f = (def.failure_states || []).find((x) => x.id === failureId);
    if (!f) throw new Error(`${id}: no failure state ${failureId}`);
    r.failed = true;
    r.flags.failure = failureId;
    this._write(def, f.journal_index, { finished: true, silent: !!f.silent });
    r.stage = f.journal_index;
    const applied = this._applyConsequences(def, null, f);
    this._emit('quest_fail', { quest: id, failure: failureId, recoverable: !!f.recoverable, silent: !!f.silent, ...applied });
    return { ok: true, quest: id, failure: failureId, silent: !!f.silent, recoverable: !!f.recoverable, ...applied };
  }

  /**
   * Seam S10 — the quest-giver is dead. Morrowind's "the thread of prophecy is severed" is the
   * model: the world does not rewind and the quest does not quietly vanish. Any quest whose
   * giver or `kill_required_npcs` set includes this NPC fails through its declared
   * non-recoverable failure state, and stays failed through death, rest, save and reload
   * (RI-QST09 M8).
   */
  npcDied(npcId) {
    const out = [];
    for (const def of this.book.all()) {
      if (this.isClosed(def.id)) continue;
      const isGiver = def.giver && def.giver.npc_id === npcId;
      const named = (def.failure_states || []).find((f) => f.cause && f.cause.includes(npcId));
      if (!isGiver && !named) continue;
      const f = named || (def.failure_states || []).find((x) => !x.recoverable) || (def.failure_states || [])[0];
      if (!f) continue;
      if (!this.rec(def.id)) continue;    // never opened: nothing to sever
      out.push(this.fail(def.id, f.id));
    }
    return { npc: npcId, severed: out };
  }

  // ---- the systems layer ---------------------------------------------------------------------

  /**
   * READMISSION — RI-QST03 §D's other half, and it is a price rather than a timer.
   *
   * Each house asks for the thing it deals in: the Ledger lodges a bond in coin, the Assize takes
   * an amended filing and the standing that goes with it, the Xul-Aneekh takes a blood-price under
   * the ku-vastei. The refusal names its own shortfall, because `RI-CRM01`'s rule about a
   * greyed-out option that does not explain itself applies here too.
   *
   * `spend` is the purse, handed in by the engine, so this module still owns no gold.
   */
  readmit(factionId, { gold = 0, spend = null } = {}) {
    const q = this.sim.quest;
    this.context();                                   // refresh this.expelled
    const e = this.expelled.get(factionId);
    if (!e) return { ok: false, reason: `${factionId} has not expelled you` };
    const r = e.readmission;
    if (!r) return { ok: false, reason: `${factionId} has no way back and says so` };
    const rep = (q.factions[factionId] && q.factions[factionId].reputation) || 0;
    if (rep < r.reputation_floor) return { ok: false, reason: `${factionId} reputation ${rep}/${r.reputation_floor}`, line: r.line };
    if (gold < r.price_gold) {
      return { ok: false, reason: `${r.price_gold - gold} gold short`, shortfall_g: r.price_gold - gold,
        line: String(r.refusal_line_no_gold || '').replace('{shortfall}', `${r.price_gold - gold}`) };
    }
    if (spend) spend(r.price_gold);
    this.setFlag(r.flag, true);
    if (q.factions[factionId]) q.factions[factionId].reputation = Math.max(0, rep - (r.costs_reputation || 0));
    this._emit('faction_readmit', { faction: factionId, paid_g: r.price_gold, reputation_cost: r.costs_reputation || 0, cleared: e.on_flag });
    return { ok: true, faction: factionId, paid_g: r.price_gold, reputation_after: q.factions[factionId] ? q.factions[factionId].reputation : null, line: r.line };
  }

  /**
   * Set a world flag. This is the ONLY coupling between quest content and the rest of the
   * simulation: the world says "the ledger burned" and the hook table decides which journal
   * entry that is. RI-QST04: "behaviour hooks belong in a separate systems layer keyed by
   * world_flags".
   */
  setFlag(flag, value = true) {
    const prev = !!this.sim.quest.flags[flag];
    this.sim.quest.flags[flag] = value ? 1 : 0;
    if (prev || !value) return { flag, fired: [] };
    const fired = [];
    for (const h of this.flagHooks.get(flag) || []) {
      if (h.requires_flag && !this.sim.quest.flags[h.requires_flag]) continue;
      // GAP-FCT-01: guarded exactly as the journal branch below it already was. Unguarded, a world
      // flag could mint a quest row for a quest nobody had accepted — the world-side half of the
      // same hole. 0 of 110 hooks.json rows carry a quest+reveal pair today, so this was latent
      // rather than live; the schema permits it and this line already read it.
      if (h.quest && h.reveal && this.rec(h.quest) && !this.isClosed(h.quest)) { const r = this.reveal(h.quest, h.reveal); if (r.ok) fired.push({ reveal: h.reveal, quest: h.quest }); }
      if (h.quest && h.journal != null && this.rec(h.quest) && !this.isClosed(h.quest)) {
        const e = (this.book.get(h.quest).journal || []).find((x) => x.index === h.journal);
        if (e && e.state !== 'success' && e.state !== 'failure') {
          const w = this.note(h.quest, h.journal);
          if (w.ok) fired.push({ quest: h.quest, journal: h.journal });
        }
      }
      if (h.quest && h.fail) { const r = this.fail(h.quest, h.fail); if (r.ok) fired.push({ quest: h.quest, failed: h.fail }); }
      // W1-19: a quest whose `discovery` is "consequence" is opened by the world, not offered by
      // a giver — and the only thing that makes a quest offerable is knowing its topic. Without
      // this branch `discovery: "consequence"` is a value the schema permits and nothing in the
      // build can produce, so Q-MAIN-30 (seam S10's severance quest) would have been reachable
      // only from the harness. Additive: a hook with no `adds_topics` behaves exactly as before.
      for (const t of h.adds_topics || []) {
        if (!this.sim.quest.topicsKnown.includes(t)) {
          this.sim.quest.topicsKnown.push(t);
          this._emit('topic_add', { quest: h.quest || null, flag, topic: t, source: 'WORLD_FLAG' });
          fired.push({ flag, topic: t });
        }
      }
    }
    return { flag, fired };
  }

  /**
   * One simulated day passed. Deadlines are in DAYS, not frames, because that is the unit the
   * fiction uses ("fourteen days after") and because a frame deadline drifts with the frame
   * rate the moment anyone changes the loop.
   */
  onDay(dayCount) {
    const out = [];
    for (const d of this.deadlines) {
      const r = this.rec(d.quest);
      if (!r || this.isClosed(d.quest)) continue;
      const openedOn = r.flags['opened_day'];
      if (openedOn == null) continue;
      if (dayCount - openedOn >= d.days) out.push(this.fail(d.quest, d.failure));
    }
    return out;
  }

  // ---- internals ------------------------------------------------------------------------------

  _write(def, index, opts) {
    const day = Math.floor(this.sim.env.dayCount || 0);
    const e = this.journal.write(def, index, day, opts);
    if (!e) return null;
    const r = this.rec(def.id, true);
    r.stage = Math.max(r.stage || 0, index);
    if (r.flags['opened_day'] == null) r.flags['opened_day'] = day;
    // RI-UIX04 Q11: something was written. One glyph, no words, no quest name. A silent
    // failure writes nothing to the glyph at all — the journal simply gains a line.
    if (!opts.silent) this.glyphUntilFrame = (this.sim.frame || 0) + GLYPH_FRAMES;
    // RI-DLG05 §A.3 — the AddTopic edge. Writing a name down is how it becomes askable.
    for (const t of this.entryTopics.get(`${def.id}#${index}`) || []) {
      if (!this.sim.quest.topicsKnown.includes(t)) {
        this.sim.quest.topicsKnown.push(t);
        this._emit('topic_add', { quest: def.id, journal: index, topic: t, source: 'JOURNAL' });
      }
    }
    this._emit('journal_write', { quest: def.id, index, date: e.date, day: e.day, flags: e.flags.slice(), words: e.text.split(/\s+/).length });
    return e;
  }

  _applyConsequences(def, res, fail) {
    // Quest-level consequences are what EVERY ending does; resolution-level consequences are
    // what THIS ending does. RI-QST09 X7 (">= 3 differing world_flags, a differing reward and
    // >= 1 differing world entity, for 100% of exclusive pairs") is only expressible with the
    // second, which is why AM-QST04-W1-18-01 added `resolutions[].consequences`.
    const c = mergeConsequences(def.consequences || {}, res && res.consequences);
    const q = this.sim.quest;
    const changed = { faction_reputation: {}, world_flags: [], unlocked: [], locked: [], npc_disposition: {}, kills_npc: [], joined: [] };
    // Joining is applied BEFORE reputation, so that the reputation this same resolution pays
    // lands on a row that already knows it is a membership.
    for (const f of c.joins_faction || []) {
      if (!q.factions[f]) q.factions[f] = { member: false, rank: 0, reputation: 0, expelled: false, rivalry_locked: [] };
      if (!q.factions[f].member) { q.factions[f].member = true; changed.joined.push(f); }
    }
    for (const n of c.kills_npc || []) {
      if (!this.sim.world.npcsDead.includes(n)) { this.sim.world.npcsDead.push(n); changed.kills_npc.push(n); }
    }
    for (const [f, d] of Object.entries(c.faction_reputation || {})) {
      if (!q.factions[f]) q.factions[f] = { member: false, rank: 0, reputation: 0, expelled: false, rivalry_locked: [] };
      q.factions[f].reputation += d;
      changed.faction_reputation[f] = q.factions[f].reputation;
    }
    for (const [n, d] of Object.entries(c.npc_disposition || {})) {
      q.dispositions[n] = (q.dispositions[n] || 0) + d;
      changed.npc_disposition[n] = q.dispositions[n];
    }
    // W1-19 round 3. THIS LINE USED TO BE `q.flags[wf] = 1`, and that direct write is why the
    // whole hook table was unreachable from the one thing a player does.
    //
    // `hooks.json` is the systems layer RI-QST04 requires, keyed by world flag: a row says "when
    // this becomes true of the world, add this topic / write this journal entry / reveal this
    // truth". `setFlag()` is what consults it. But every world flag a QUEST raises was written
    // straight into `q.flags` here, so the table was consulted only by the magic system, by
    // `readmit()`, and by the harness verb `questSetFlag` — i.e. by everything except playing a
    // quest. Five shipped rows were keyed to flags only a resolution can raise and all five were
    // dead: `the_eleven_roots_are_cut` (the mainline backpath), and the three faction
    // "second refusal" routes authored against GAP path_to_ten #6, which is why refusing at rank
    // 6 still capped the ladder at 6 after that gap was reported fixed.
    //
    // Routing through `setFlag()` is additive: it writes the same value under the same
    // "only on the false -> true edge" condition, and a flag with no hook row behaves exactly as
    // it did. `tools/quests/reveal-route-audit.mjs` is the standing check, with the direct-write
    // behaviour available as its control leg.
    //
    // RE-ENTRANCY. `setFlag()` can fire a row carrying `fail`, `fail()` calls back into this
    // method, and that consequence can raise another hooked flag. The depth guard makes the
    // cascade finite without making it invisible: flags raised beyond the guard are still
    // written, they simply stop firing further hooks. A cycle in the hook table is a content
    // defect and belongs to `tools/check-quests.mjs`, not to a stack overflow at run time.
    this._flagDepth = (this._flagDepth || 0);
    for (const wf of c.world_flags || []) {
      if (q.flags[wf]) continue;
      changed.world_flags.push(wf);
      if (this._flagDepth >= 8) { q.flags[wf] = 1; continue; }
      this._flagDepth++;
      try { this.setFlag(wf, true); } finally { this._flagDepth--; }
    }
    for (const u of c.unlocks || []) { q.flags[`unlocked:${u}`] = 1; changed.unlocked.push(u); }
    for (const l of c.locks || []) { q.flags[`locked:${l}`] = 1; changed.locked.push(l); }
    for (const other of def.mutually_exclusive_with || []) { q.flags[`locked:${other}`] = 1; changed.locked.push(other); }
    // Resolution-scoped closure: the doors THIS ending shut, not the doors the quest can shut.
    if (res) for (const x of res.exclusive_with || []) this.rec(def.id).flags[`closed:${x}`] = 1;
    if (fail && !fail.recoverable) this.rec(def.id).flags['unrecoverable'] = 1;
    return changed;
  }

  _emit(kind, payload) {
    this.events.push({ frame: this.sim.frame || 0, day: Math.floor(this.sim.env.dayCount || 0), kind, ...payload });
    if (this.events.length > 4096) this.events.splice(0, this.events.length - 4096);
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  /**
   * A topic entered `topicsKnown` from somewhere that is not a journal entry — somebody said it
   * out loud to you. W1-19 round 2; the callers are `Engine.talkTo()` (an `opens_by
   * .overheard_from` NPC greeting you) and `Engine.conversationSay()` (asking, and every
   * AddTopic on the info you heard). It reports on the QUEST event stream and not on the
   * `sim/events.js` bus, because that bus is a closed vocabulary (HARNESS.md §5 / A-JRN7) and
   * `topic_add` already lives here — the journal AddTopic edge has emitted it since W1-19
   * round 1, and one topic must not have two event names.
   */
  noteTopicLearned(topic, source, npcId = null) {
    this._emit('topic_add', { quest: null, npc: npcId, topic, source: source || 'WORLD' });
    return { topic, source };
  }

  /**
   * THE WORLD PRODUCED A SOURCE. W1-18 round 2, and the world-side reader for
   * `deceit.revealed_by[].channel` / `.source` — 186 authored rows that nothing in `game/src/`
   * had ever read. See `sim/quest/reveal-routes.js` for which channels are routed and why the
   * other four are not.
   *
   * `kind` is the world action that happened (`'person'` today, from `Engine.talkTo()`), `source`
   * is the thing it happened to. Every reveal row the index has for that pair is offered, and
   * each one is REFUSED OR TAKEN for a stated reason — the return value names the refusals as
   * well as the grants, because a route that silently declines is indistinguishable from a route
   * that is not wired, and this whole round exists because six of those went unnoticed.
   *
   * Three conditions, and none of them is decoration:
   *
   *   1. **The quest must be OPEN.** `reveal()` on its own mints a row (`rec(id, true)`) —
   *      foreknowledge — which is right for a harness verb and wrong for the world: without this
   *      line every person in the province would spill the middle of every quest they are named
   *      in to a player who has accepted nothing, and 30 of the 40 routed rows would fire on a
   *      character with an empty journal. GAP-FCT-01 made the same distinction for `resolve()`.
   *   2. **`before_point_of_no_return: false` waits for the crossing.** The schema's own gloss is
   *      *"true if this reveal is reachable while the player can still act on it"*, so a `false`
   *      row is a truth that arrives too late by design. Handing it over early would move an
   *      authored beat, not fix a bug. Three of the routed rows say false.
   *   3. **A `journal` index is written if the row declares one, and only if `note()` accepts
   *      it.** Terminal entries are refused by `note()` and pre-checked here for the same reason
   *      `setFlag()`'s journal branch pre-checks them: an authored index pointing at a `success`
   *      entry is a content defect that belongs in `tools/check-quests.mjs`, not in a throw
   *      inside a world action every agent's boot-check walks through.
   *
   * No new event name. `reveal()` emits `reveal` and `note()` emits `quest_stage`, both already
   * in this stream, and `sim/events.js` is a closed vocabulary (RULES.md rule 15).
   */
  learnFrom(kind, source, opts = {}) {
    const key = `${kind}:${source}`;
    const rows = this.revealRoutes.get(key) || [];
    const out = { kind, source, offered: rows.length, learned: [], journal: [], refused: [] };
    if (!rows.length) return out;
    const ponr = !!this.sim.quest.flags[PONR_FLAG];
    for (const row of rows) {
      if (!this.isOpen(row.quest)) { out.refused.push({ ...pick(row), why: 'quest not open' }); continue; }
      if (!row.before_point_of_no_return && !ponr) { out.refused.push({ ...pick(row), why: 'not until the point of no return is crossed' }); continue; }
      const r = this.reveal(row.quest, row.reveal);
      if (!r.ok) { out.refused.push({ ...pick(row), why: r.reason }); continue; }
      out.learned.push({ quest: row.quest, reveal: row.reveal, channel: row.channel, source: row.source });
      if (row.journal == null) continue;
      const e = (this.book.get(row.quest).journal || []).find((x) => x.index === row.journal);
      if (!e) { out.refused.push({ ...pick(row), why: `journal ${row.journal} does not exist` }); continue; }
      if (e.state === 'success' || e.state === 'failure') { out.refused.push({ ...pick(row), why: `journal ${row.journal} is terminal` }); continue; }
      const w = this.note(row.quest, row.journal);
      if (w.ok) out.journal.push({ quest: row.quest, index: row.journal });
      else out.refused.push({ ...pick(row), why: `journal ${row.journal}: ${w.reason}` });
    }
    if (opts.trace) out.trace = key;
    return out;
  }

  /** The wordless indicator, as a number of frames remaining. Never a string. */
  glyph(frame) {
    const left = this.glyphUntilFrame - (frame || 0);
    return { visible: left > 0, frames_left: Math.max(0, left), max_frames: GLYPH_FRAMES, text: null, kind: 'glyph' };
  }

  /** The whole quest side of the world, for getQuestState(). */
  report() {
    const q = this.sim.quest;
    const active = [], closed = [];
    for (const id of Object.keys(q.quests).sort()) {
      const r = q.quests[id];
      const row = {
        id, stage: r.stage, branch: r.branch || null, failed: !!r.failed,
        resolution: r.flags.resolution || null, failure: r.flags.failure || null,
        knows: Object.keys(r.flags).filter((k) => k.startsWith('know:')).map((k) => k.slice(5)).sort(),
        entries: this.journal.countFor(id),
      };
      (r.failed || q.completed.includes(id) ? closed : active).push(row);
    }
    return {
      today: dateOf(Math.floor(this.sim.env.dayCount || 0)).text,
      quests_defined: this.book.ids.length,
      active, closed,
      completed: [...q.completed].sort(),
      journal_entries: q.journal.length,
      topics_known: [...q.topicsKnown].sort(),
      factions: q.factions,
      flags: q.flags,
    };
  }
}
