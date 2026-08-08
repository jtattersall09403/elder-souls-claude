// The quest book: every quest definition under game/data/quests/**, loaded, cross-checked and
// indexed. Quests are DATA (RI-QST04 "How we lose": "Quests in code ... the schema must be the
// only home for quest content; behaviour hooks belong in a separate systems layer keyed by
// world_flags"). Nothing in this directory contains a quest; it contains the machine that runs
// one.
//
// The load is FAIL-LOUD. Every integrity rule RI-QST04's comparison method checks offline
// (checks 2-5) and every prohibition RI-DLG05 §D greps for is checked here, at boot, and
// throws. The reason is stated plainly in RI-DLG05: "one hit fails the item". A rule that only
// a critic's grep enforces is a rule that gets broken between critic runs; a rule that stops
// the game booting does not.
'use strict';

import { BANNED, scanProse } from './prohibitions.js';

/** Journal index bands — RI-QST04 §B, binding. */
export const BANDS = {
  rumour: [1, 9],
  accepted: [10, 10],
  progress: [11, 39],
  post_reveal: [40, 69],
  failure: [70, 89],
  success: [90, 99],
  closed: [100, 100],
};

// GAP-FCT-02, W1-FACTIONS round 3. This set used to be the ONLY thing the violence guard below
// consulted, and it worked by membership — so a `method` value it had never heard of was silently
// waved through. Round 2 introduced five (`comply`, `expose`, `lie`, `sabotage`, `investigate`)
// covering 38 of the build's 383 resolutions, and the round-2 critic demonstrated the blindness
// with a control: mutating a `refuse` resolution to `violence_required: true` went RED, the same
// mutation on a `comply` resolution went GREEN.
//
// Adding the five would fix today and fail again the next time the vocabulary drifts. So the
// vocabulary is now CLOSED: every method must be declared either non-violent or violent, and a
// method in neither set is a problem in its own right. A drifting vocabulary now fails loud at
// boot instead of quietly disarming the guard.
const RES_METHODS_NONVIOLENT = new Set([
  'persuade', 'intimidate', 'bribe', 'sneak', 'steal', 'lore_knowledge', 'trade',
  'alchemy', 'magic_utility', 'refuse', 'betray', 'confess', 'wait',
  // round 2's five, all non-violent: you do the thing, you tell someone, you say the untrue
  // thing, you break the machine, you go and look.
  'comply', 'expose', 'lie', 'sabotage', 'investigate',
]);

/** Methods that may legitimately demand violence. `combat` is the only one that must. */
const RES_METHODS_VIOLENT = new Set(['combat']);

/**
 * `betray` and `steal` are non-violent by default and are the two the guard has always allowed to
 * carry `violence_required: true` — a betrayal that ends in a knife and a theft that goes wrong
 * are both authored in this build. Everything else in RES_METHODS_NONVIOLENT means it.
 */
const RES_METHODS_MAY_TURN_VIOLENT = new Set(['betray', 'steal']);

/** The whole declared vocabulary. Anything outside it is a problem, not a pass. */
export const RES_METHODS_KNOWN = new Set([...RES_METHODS_NONVIOLENT, ...RES_METHODS_VIOLENT]);

export class QuestBook {
  /**
   * @param {object} docs  engine.data.quests — id -> parsed game/data/quests/*.json
   */
  constructor(docs) {
    this.byId = new Map();
    this.sourceOf = new Map();
    this.problems = [];
    for (const key of Object.keys(docs || {}).sort()) {
      const doc = docs[key];
      const list = Array.isArray(doc && doc.quests) ? doc.quests : (doc && doc.id && doc.journal ? [doc] : null);
      if (!list) continue;
      for (const q of list) this._add(q, key);
    }
    this._check();
    if (this.problems.length) {
      throw new Error(`QuestBook: ${this.problems.length} integrity failure(s) in game/data/quests/**\n  - ${this.problems.slice(0, 24).join('\n  - ')}`);
    }
    this.ids = [...this.byId.keys()].sort();
  }

  _add(q, source) {
    if (!q || typeof q.id !== 'string') { this.problems.push(`${source}: a quest with no id`); return; }
    if (this.byId.has(q.id)) { this.problems.push(`${q.id}: defined twice (${this.sourceOf.get(q.id)} and ${source})`); return; }
    this.byId.set(q.id, q);
    this.sourceOf.set(q.id, source);
  }

  get(id) {
    const q = this.byId.get(id);
    if (!q) throw new Error(`quest ${JSON.stringify(id)} is not in game/data/quests/**`);
    return q;
  }
  has(id) { return this.byId.has(id); }
  all() { return this.ids.map((id) => this.byId.get(id)); }

  // ---- integrity ---------------------------------------------------------------------------

  _check() {
    const P = this.problems;
    for (const id of [...this.byId.keys()].sort()) {
      const q = this.byId.get(id);
      const at = (s) => `${id}: ${s}`;

      // --- RI-QST04 §D: directions are 100% or it is a quest that needs a marker (AR-2).
      if (!q.directions || String(q.directions).trim().length < 20) P.push(at('no `directions` — a quest without prose wayfinding is a quest that needs a marker (AR-2)'));

      // --- journal: ascending, unique, banded (RI-QST04 §B, check 5).
      const idx = (q.journal || []).map((e) => e.index);
      for (let i = 1; i < idx.length; i++) if (idx[i] <= idx[i - 1]) P.push(at(`journal index ${idx[i]} does not ascend past ${idx[i - 1]}`));
      if (new Set(idx).size !== idx.length) P.push(at('duplicate journal index'));
      for (const e of q.journal || []) {
        if (e.state === 'success' && (e.index < 90 || e.index > 99)) P.push(at(`journal ${e.index} is state success, outside band 90-99`));
        if (e.state === 'failure' && (e.index < 70 || e.index > 89)) P.push(at(`journal ${e.index} is state failure, outside band 70-89`));
        if (e.state === 'active' && e.index >= 70 && e.index !== 100) P.push(at(`journal ${e.index} is state active, inside a terminal band`));
        // RI-QST04 §B: "no entry begins with an imperative verb".
        if (/^\s*(Go|Head|Travel|Return|Kill|Find|Talk|Speak|Bring|Take|Deliver|Collect|Retrieve)\b/.test(e.text)) {
          P.push(at(`journal ${e.index} begins with an imperative — the character does not issue orders to the player`));
        }
        const hits = scanProse(e.text);
        if (hits.length) P.push(at(`journal ${e.index} contains banned prose: ${hits.map((h) => `${h.rule}:${JSON.stringify(h.match)}`).join(', ')}`));
      }
      const dirHits = scanProse(q.directions || '');
      if (dirHits.length) P.push(at(`directions contain banned prose: ${dirHits.map((h) => `${h.rule}:${JSON.stringify(h.match)}`).join(', ')}`));

      // --- ids present and unique inside the file.
      const resIds = (q.resolutions || []).map((r) => r.id);
      const failIds = (q.failure_states || []).map((f) => f.id);
      const brIds = (q.branches || []).map((b) => b.id);
      const revIds = ((q.deceit && q.deceit.revealed_by) || []).map((r) => r.id);
      const local = new Set([...resIds, ...failIds, ...brIds, ...revIds]);
      if (local.size !== resIds.length + failIds.length + brIds.length + revIds.length) P.push(at('an id is reused inside the file'));

      // --- check 2: one distinct success index per resolution.
      const ji = resIds.map((_, i) => q.resolutions[i].journal_index);
      if (new Set(ji).size !== ji.length) P.push(at('resolutions share a success journal index (RI-QST04 check 2)'));
      for (const r of q.resolutions || []) {
        if (!idx.includes(r.journal_index)) P.push(at(`resolution ${r.id} names journal index ${r.journal_index}, which the journal does not contain`));
        const je = (q.journal || []).find((e) => e.index === r.journal_index);
        if (je && je.state !== 'success') P.push(at(`resolution ${r.id} points at journal ${r.journal_index}, which is state ${je.state}`));
        if (r.violence_required === false && r.method === 'combat') P.push(at(`resolution ${r.id} is method combat and violence_required false`));
        // GAP-FCT-02: the vocabulary is closed. An unrecognised method is reported HERE, before
        // the membership test below, because a membership test cannot say no to a word it does
        // not know — which is exactly how 38 resolutions became invisible to this guard.
        if (r.method != null && !RES_METHODS_KNOWN.has(r.method)) {
          P.push(at(`resolution ${r.id} has method ${JSON.stringify(r.method)}, which is not in the declared method vocabulary — the violence guard cannot see it (GAP-FCT-02). Declare it in RES_METHODS_NONVIOLENT or RES_METHODS_VIOLENT in sim/quest/defs.js.`));
        }
        if (r.violence_required === true && RES_METHODS_NONVIOLENT.has(r.method) && !RES_METHODS_MAY_TURN_VIOLENT.has(r.method)) {
          P.push(at(`resolution ${r.id} is method ${r.method} and violence_required true`));
        }
      }
      for (const f of q.failure_states || []) {
        if (!idx.includes(f.journal_index)) P.push(at(`failure ${f.id} names journal index ${f.journal_index}, which the journal does not contain`));
      }

      // --- check 3: every branch target resolves.
      for (const b of q.branches || []) {
        if (!idx.includes(b.at_journal_index)) P.push(at(`branch ${b.id} sits at journal index ${b.at_journal_index}, which does not exist`));
        for (const t of b.leads_to || []) if (!local.has(t)) P.push(at(`branch ${b.id} points at unknown target ${t} (RI-QST04 check 3)`));
      }

      // --- check 4: requires_knowing references a declared reveal.
      for (const r of q.resolutions || []) {
        for (const k of r.requires_knowing || []) if (!revIds.includes(k)) P.push(at(`${r.id} requires unknown reveal ${k} (RI-QST04 check 4)`));
      }

      // --- deceit: a deceitful giver must have a deceit block with a pre-commit reveal.
      if (q.giver && q.giver.honest === false) {
        if (!q.deceit) P.push(at('giver.honest is false with no deceit block'));
        else if (!(q.deceit.revealed_by || []).some((r) => r.before_point_of_no_return)) {
          P.push(at('deceit has no reveal reachable before the point of no return'));
        }
      }

      // --- RI-QST09: exclusivity must be symmetric and must resolve.
      for (const r of q.resolutions || []) {
        for (const x of r.exclusive_with || []) {
          if (!resIds.includes(x)) { P.push(at(`${r.id} is exclusive_with ${x}, which is not a resolution of this quest`)); continue; }
          const other = q.resolutions.find((o) => o.id === x);
          if (!(other.exclusive_with || []).includes(r.id)) P.push(at(`exclusivity is asymmetric: ${r.id} excludes ${x} but not the reverse (RI-QST09 M1)`));
        }
      }

      // --- RI-QST03: gating is NEVER by character level. This is checked as a hard structural
      //     rule rather than a review note because it is the single easiest thing to add.
      const gate = q.rank_gate;
      if (gate) {
        for (const k of Object.keys(gate)) {
          if (/level|souls|xp/i.test(k)) P.push(at(`rank_gate.${k}: gating by level/souls is forbidden (RI-QST03 §B)`));
        }
      }
      for (const r of q.resolutions || []) {
        for (const k of Object.keys((r.requires && r.requires.attributes) || {})) {
          if (/^level$/i.test(k)) P.push(at(`${r.id}.requires.attributes.level: there is no level gate in this game (RI-QST03 §B)`));
        }
      }
    }

    // --- cross-file: unlocks / locks / mutually_exclusive_with must name real quests, and
    //     mutual exclusion between quests must be declared on both sides.
    for (const id of [...this.byId.keys()].sort()) {
      const q = this.byId.get(id);
      const c = q.consequences || {};
      for (const other of [...(c.unlocks || []), ...(c.locks || [])]) {
        if (other.startsWith('Q-') || other.startsWith('mag_') || other.startsWith('q_')) {
          if (!this.byId.has(other)) this.problems.push(`${id}: consequences name quest ${other}, which does not exist`);
        }
      }
      for (const other of q.mutually_exclusive_with || []) {
        if (!this.byId.has(other)) { this.problems.push(`${id}: mutually_exclusive_with ${other}, which does not exist`); continue; }
        const back = this.byId.get(other).mutually_exclusive_with || [];
        if (!back.includes(id)) this.problems.push(`${id}: mutual exclusion with ${other} is not declared on ${other} (RI-QST09 M1)`);
      }
    }
  }

  // ---- census ------------------------------------------------------------------------------
  // The numbers RI-QST04 §D and RI-QST09 §2 are scored on, computed from the same objects the
  // running game uses. tools/analysis/quest-audit.mjs recomputes them offline from the JSON so
  // the two can be diffed; if they ever disagree, the game is lying.

  census() {
    const qs = this.all();
    const n = qs.length || 1;
    const sum = (f) => qs.reduce((a, q) => a + f(q), 0);
    const failStates = qs.flatMap((q) => q.failure_states || []);
    const exclusiveQuests = qs.filter((q) => (q.resolutions || []).some((r) => (r.exclusive_with || []).length));
    return {
      n: qs.length,
      mean_resolutions: sum((q) => (q.resolutions || []).length) / n,
      single_solution_pct: qs.filter((q) => (q.resolutions || []).length === 1).length / n * 100,
      mean_branches: sum((q) => (q.branches || []).length) / n,
      with_failures_pct: qs.filter((q) => (q.failure_states || []).length > 0).length / n * 100,
      can_fail_false_pct: qs.filter((q) => q.can_fail === false).length / n * 100,
      silent_failure_pct: failStates.length ? failStates.filter((f) => f.silent).length / failStates.length * 100 : 0,
      mean_journal: sum((q) => (q.journal || []).length) / n,
      directions_pct: qs.filter((q) => (q.directions || '').length >= 20).length / n * 100,
      multi_faction_consequence_pct: qs.filter((q) => Object.keys((q.consequences || {}).faction_reputation || {}).length >= 2).length / n * 100,
      zero_kill_pct: qs.filter((q) => ((q.kill_required_npcs || []).length === 0)).length / n * 100,
      noncombat_resolution_pct: qs.filter((q) => (q.resolutions || []).some((r) => !r.violence_required)).length / n * 100,
      deceit_pct: qs.filter((q) => q.deceit).length / n * 100,
      exclusive_pct: exclusiveQuests.length / n * 100,
      banned_prose_hits: 0,
      banned_rules: BANNED.map((b) => b.rule),
    };
  }
}
