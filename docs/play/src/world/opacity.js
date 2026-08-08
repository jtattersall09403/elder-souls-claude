// The opacity register, world-side.
//
// Owner: W1-OPACITY. Binding sources: RI-WLD09 §B1 (the 24 sealed mysteries), RI-MTH07 /
// ARBITRATION §3 (CONSUMPTION), RI-WLD09 §C (what may NOT be opaque).
//
// WHY THIS FILE EXISTS.
// `game/data/world/opacity.json` is a list of twenty-four things this world refuses to explain.
// A list nobody reads is a text file, and RI-MTH07 says so in as many words. There are three
// separate readers here and each one is the answer to a different way the register could be
// fake:
//
//   1. `resolve()` — every anchor, evidence id and false-account id must name a record that is
//      actually in the build. The engine calls this at boot and THROWS on a dangle. This is the
//      same defect class as the 74 unsatisfiable `opens_by.topic` gates (`core/topics.js`): a
//      mystery whose evidence is a dangling id is worse than no mystery, because it scores.
//   2. `refusalFor()` — the world DECLINES, in authored words, about exactly the things the
//      register lists, and only those. Before this, putting `the-thing-in-the-cistern` to
//      somebody who had no info on it produced `{refused:'no_info'}` — which from inside the
//      game is indistinguishable from nobody having written anything, which is precisely the
//      failure RI-WLD09 exists to prevent. Delete a mystery from the register and its topic
//      goes back to silence; that is the perturbation.
//   3. `met()` / `state()` — which mysteries the character has actually run into, by which
//      route. RI-WLD09 M-OP2's discovery diff is not computable without this, and `getQuestState`
//      cannot answer it because a mystery is not a quest and must never become one.
//
// WHAT IS DELIBERATELY NOT HERE. No answers. The sealed half lives in
// `corpus/50-world/sealed/SEALED-ANSWERS.md`, is never shipped, and this module could not state
// an answer if it wanted to: all it has is a sha256. There is also no `explain()`, no
// `hint()`, and no way to mark a mystery solved — a mystery that can be closed by code is a
// quest, and §B1 caps rewarded mysteries at 6 of 24 for exactly that reason.
'use strict';

import { topicKey } from '../core/topics.js';

/** The id prefixes the register may use, and the content class each one denotes. */
export const EVIDENCE_CLASS = {
  book: 'book', dialogue: 'dialogue', npc: 'dialogue',
  poi: 'geometry', region: 'observation', item: 'item', enemy: 'observation',
};

/** How a mystery came to be met. RI-WLD09 M-OP2's route attribution vocabulary. */
export const ROUTE = ['unprompted', 'overheard', 'book', 'npc', 'signposted', 'journal'];

export class OpacityRegister {
  /**
   * @param {object} doc `game/data/world/opacity.json`. A build with no such file gets an
   *   EMPTY register rather than a thrown error, because `present()` reporting false is a
   *   measurement and a boot failure is not — but `resolve()` still fails it, so a build that
   *   silently dropped the file cannot pass as a build that never had one.
   */
  constructor(doc) {
    this.doc = doc || null;
    this.mysteries = (doc && Array.isArray(doc.mysteries)) ? doc.mysteries : [];
    this.byId = new Map();
    /** folded topic key -> mystery id. One topic routes to at most one mystery. */
    this.byTopic = new Map();
    for (const m of this.mysteries) {
      this.byId.set(m.id, m);
      for (const t of (m.refusal_topics || [])) {
        const k = topicKey(t);
        if (!this.byTopic.has(k)) this.byTopic.set(k, m.id);
      }
    }
    /** mystery id -> Set of evidence ids the character has actually met. */
    this.seen = new Map();
    /** mystery id -> Set of routes by which it was met. */
    this.routes = new Map();
    /** mystery id -> count of refusals heard. */
    this.refused = new Map();
  }

  get size() { return this.mysteries.length; }
  present() { return this.mysteries.length > 0; }
  get(id) { return this.byId.get(id) || null; }

  /**
   * Every id this register points at must name a record in the build.
   *
   * @param {object} world  { books:Set, topics:Set, npcs:Set, pois:Set, regions:Set, items:Set,
   *                          enemies:Set } — folded ids, built by `Engine._opacityWorldIndex()`.
   * @returns {{ok:boolean, checked:number, unresolved:string[], notes:string[]}}
   *
   * Topic ids are compared through `topicKey()` because the dialogue layer writes slugs and the
   * quest layer writes prose and both are load-bearing spellings of the same keyword. Comparing
   * them raw is how 63 gates came to be unsatisfiable.
   */
  resolve(world) {
    const unresolved = [];
    const notes = [];
    let checked = 0;
    const has = (id, whereFrom, mid) => {
      checked++;
      const i = String(id).indexOf(':');
      if (i < 0) { unresolved.push(`${mid} ${whereFrom} ${id}: no kind prefix`); return; }
      const kind = id.slice(0, i);
      const rest = id.slice(i + 1);
      const set = {
        book: world.books, dialogue: world.topics, npc: world.npcs,
        poi: world.pois, region: world.regions, item: world.items, enemy: world.enemies,
      }[kind];
      if (!set) { unresolved.push(`${mid} ${whereFrom} ${id}: unknown kind ${JSON.stringify(kind)}`); return; }
      const key = kind === 'dialogue' ? topicKey(rest) : rest;
      if (!set.has(key)) unresolved.push(`${mid} ${whereFrom} ${id}: no such ${kind} in the build`);
    };
    for (const m of this.mysteries) {
      for (const a of (m.anchors || [])) has(a, 'anchor', m.id);
      for (const e of (m.evidence || [])) has(e, 'evidence', m.id);
      for (const f of (m.false_accounts || [])) has(f, 'false_account', m.id);
      for (const t of (m.refusal_topics || [])) has(`dialogue:${t}`, 'refusal_topic', m.id);
      // §B1's own floors, checked here rather than only in the Python auditor, because the
      // auditor is not in the boot path and a build can ship without anyone having run it.
      if ((m.evidence || []).length < 3) notes.push(`THIN ${m.id}: ${(m.evidence || []).length} evidence < 3`);
      const cls = new Set((m.evidence || []).map((e) => EVIDENCE_CLASS[String(e).split(':')[0]]));
      cls.delete(undefined);
      if (cls.size < 2) notes.push(`CLASSES ${m.id}: evidence spans ${cls.size} content class(es) < 2`);
      if (!/^[0-9a-f]{64}$/.test(String(m.seal || ''))) notes.push(`NOSEAL ${m.id}: seal is not a sha256`);
      if (!m.resolution || !m.resolution.stays_open) notes.push(`NOSPLIT ${m.id}: no resolution.stays_open`);
    }
    return { ok: unresolved.length === 0 && notes.length === 0, checked, unresolved, notes };
  }

  /** The composition RI-WLD09 §B1 scores, computed from the live register rather than restated. */
  composition() {
    const by = {};
    for (const m of this.mysteries) by[m.kind] = (by[m.kind] || 0) + 1;
    return {
      total: this.mysteries.length,
      by_kind: by,
      settleable: this.mysteries.filter((m) => m.resolution && m.resolution.kind === 'settleable').length,
      sealed: this.mysteries.filter((m) => !m.resolution || m.resolution.kind === 'sealed').length,
      encounterable: this.mysteries.filter((m) => m.encounterable).length,
      within_three_hours: this.mysteries.filter((m) => Number(m.reachable_hours) <= 3).length,
      with_reward: this.mysteries.filter((m) => m.has_reward).length,
      with_two_false_accounts: this.mysteries.filter((m) => (m.false_accounts || []).length >= 2).length,
    };
  }

  /**
   * The line somebody gives when a registered-opaque topic is put to them and they have nothing
   * to say. Returns null when the topic is not in the register — which is the whole point: this
   * is not a generic fallback, it fires for the twenty-four things and for nothing else.
   *
   * Precedence is the same shape `converse.js infoFor()` uses: an actor-matched refusal beats an
   * actorless one. Which of several matching lines you get is a pure function of (npc id, count),
   * so a replay says the same words.
   */
  refusalFor(topicId, npc) {
    const mid = this.byTopic.get(topicKey(topicId));
    if (!mid) return null;
    const m = this.byId.get(mid);
    if (!m || !Array.isArray(m.refusals) || !m.refusals.length) return null;
    const actor = (npc && npc.actor) || null;
    let best = null, bestScore = -1;
    for (const r of m.refusals) {
      if (r.a && r.a !== actor) continue;
      const score = r.a ? 2 : 1;
      if (score > bestScore) { best = r; bestScore = score; }
    }
    if (!best) return null;
    return {
      topic: topicId, mystery: mid, actor: best.a || null, text: best.x,
      kind: m.kind,
      settleable: !!(m.resolution && m.resolution.kind === 'settleable'),
    };
  }

  /** Record that a refusal was heard. Counted by `state()`; nothing else reads it. */
  noteRefusal(mid) {
    this.refused.set(mid, (this.refused.get(mid) || 0) + 1);
    this.met(`__refusal__`, 'npc', mid);
    return this;
  }

  /**
   * The character has met an artifact. If it is evidence for any mystery, that mystery is now
   * partly met. Returns the mystery ids touched, so a caller can emit one trace event each.
   *
   * @param {string} artifactId  e.g. `book:on-the-tally-stones`, `poi:the-glassed-crater`
   * @param {string} route       one of ROUTE
   * @param {string} [only]      restrict to one mystery (used by `noteRefusal`)
   */
  met(artifactId, route, only) {
    const touched = [];
    // Topic ids are folded before comparison for the reason `core/topics.js` exists: the
    // dialogue layer writes slugs and the quest layer writes prose, both are authored, and a raw
    // string compare here would make every `dialogue:` evidence id unreachable from a run while
    // still resolving from static data — a consumer that is present and silently never fires.
    const fold = (id) => {
      const i = String(id).indexOf(':');
      if (i < 0) return String(id);
      const kind = String(id).slice(0, i);
      return kind === 'dialogue' ? `dialogue:${topicKey(String(id).slice(i + 1))}` : String(id);
    };
    const want = fold(artifactId);
    for (const m of this.mysteries) {
      if (only && m.id !== only) continue;
      const isEvidence = only
        ? true
        : (m.evidence || []).some((e) => fold(e) === want)
          || (m.anchors || []).some((a) => fold(a) === want);
      if (!isEvidence) continue;
      let s = this.seen.get(m.id);
      if (!s) { s = new Set(); this.seen.set(m.id, s); }
      if (!only) s.add(artifactId);
      let r = this.routes.get(m.id);
      if (!r) { r = new Set(); this.routes.set(m.id, r); }
      if (ROUTE.indexOf(route) >= 0) r.add(route);
      touched.push(m.id);
    }
    return touched;
  }

  /**
   * The harness view. RI-WLD09 M-OP2 diffs a blind agent's discovery log against this.
   *
   * It reports `evidence_met` and NEVER `explained`, because there is nothing in this process
   * that could set such a flag: the answers are not in the build.
   */
  state() {
    return {
      present: this.present(),
      schema: this.doc ? this.doc.schema : null,
      composition: this.composition(),
      mysteries: this.mysteries.map((m) => ({
        id: m.id, name: m.name, kind: m.kind,
        reachable_hours: m.reachable_hours,
        has_reward: !!m.has_reward,
        encounterable: !!m.encounterable,
        resolution: m.resolution ? m.resolution.kind : null,
        stays_open: m.resolution ? m.resolution.stays_open : null,
        evidence_total: (m.evidence || []).length,
        evidence_met: (this.seen.get(m.id) || new Set()).size,
        routes: [...(this.routes.get(m.id) || new Set())].sort(),
        refusals_heard: this.refused.get(m.id) || 0,
        seal: m.seal,
      })),
      encountered: this.mysteries.filter((m) => (this.seen.get(m.id) || new Set()).size > 0
        || (this.refused.get(m.id) || 0) > 0).length,
    };
  }
}
