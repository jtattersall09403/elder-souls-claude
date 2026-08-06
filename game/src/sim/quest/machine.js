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
  };
  for (const [k, v] of Object.entries(extra.faction_reputation || {})) out.faction_reputation[k] = (out.faction_reputation[k] || 0) + v;
  for (const [k, v] of Object.entries(extra.npc_disposition || {})) out.npc_disposition[k] = (out.npc_disposition[k] || 0) + v;
  for (const k of ['unlocks', 'locks', 'world_flags', 'kills_npc']) {
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
    for (const hs of this.flagHooks.values()) {
      for (const h of hs) {
        if (!h.quest) continue;
        const q = this.book.get(h.quest);
        if (h.journal != null && !(q.journal || []).some((e) => e.index === h.journal)) {
          throw new Error(`hooks.json: ${h.flag} -> ${h.quest}#${h.journal}, which the quest file does not contain`);
        }
      }
    }
    for (const t of this.entryTopics.keys()) {
      const [qid, ix] = t.split('#');
      const q = this.book.get(qid);
      if (!(q.journal || []).some((e) => e.index === Number(ix))) throw new Error(`hooks.json entry_topics: ${t} does not exist`);
    }
    // RI-DLG05 §A.3: "Every quest chain must have >= 1 such edge."
    const seeded = new Set([...this.entryTopics.keys()].map((k) => k.split('#')[0]));
    const missing = this.book.ids.filter((id) => !seeded.has(id));
    if (missing.length) {
      throw new Error(`hooks.json: ${missing.length} quest(s) seed no topic from a journal write (RI-DLG05 §A.3): ${missing.slice(0, 8).join(', ')}`);
    }
  }

  // ---- observation -------------------------------------------------------------------------

  rec(id, create = false) {
    const m = this.sim.quest.quests;
    if (!m[id] && create) m[id] = { stage: 0, branch: null, failed: false, giverDispositionDelta: 0, timeLimitInFrames: null, flags: {} };
    return m[id] || null;
  }

  isOpen(id) { const r = this.rec(id); return !!r && !r.failed && !this.sim.quest.completed.includes(id); }
  isClosed(id) { const r = this.rec(id); return !!r && (!!r.failed || this.sim.quest.completed.includes(id)); }

  /** Everything the gate functions need, assembled from live sim state. */
  context() {
    const q = this.sim.quest;
    const know = new Set();
    for (const id of Object.keys(q.quests)) {
      for (const k of Object.keys(q.quests[id].flags || {})) if (k.startsWith('know:')) know.add(k.slice(5));
    }
    const reputation = {}, ranks = {};
    for (const f of Object.keys(q.factions)) {
      reputation[f] = q.factions[f].reputation || 0;
      ranks[f] = q.factions[f].rank || 0;
    }
    return {
      reputation, ranks,
      attributes: this.sim.progression.attributes,
      skills: Object.fromEntries(Object.entries(this.sim.progression.skills || {}).map(([k, v]) => [k, v && v.value != null ? v.value : v])),
      worldFlags: new Set(Object.keys(q.flags).filter((k) => q.flags[k])),
      topicsKnown: new Set(q.topicsKnown),
      dispositions: q.dispositions,
      completed: new Set(q.completed),
      locked: new Set(Object.keys(q.flags).filter((k) => k.startsWith('locked:') && q.flags[k]).map((k) => k.slice(7))),
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

  /** The resolutions reachable right now, with the shortfall spelled out for each that is not. */
  resolutionsFor(id) {
    const def = this.book.get(id);
    const ctx = this.context();
    ctx.disposition = (this.sim.quest.dispositions || {})[def.giver && def.giver.npc_id] || 0;
    return (def.resolutions || []).map((r) => {
      const c = canResolve(r, ctx);
      return { id: r.id, method: r.method, violence_required: r.violence_required, available: c.available, why: c.why, excludes: r.exclusive_with || [] };
    });
  }

  // ---- transitions ---------------------------------------------------------------------------

  /** Accept the quest. Writes the lowest `active` index >= 10 the file declares. */
  open(id) {
    const def = this.book.get(id);
    if (this.rec(id)) return { ok: false, reason: 'already opened' };
    const ctx = this.context();
    const c = canOffer(def, ctx, this.gates);
    if (!c.offerable) return { ok: false, reason: c.why.join('; '), gate: c.gate };
    this.rec(id, true);
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
    if (!r) return { ok: false, reason: 'quest not open' };
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
    if (!r) return { ok: false, reason: 'quest not open' };
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

  /** Close the quest through one of its declared resolutions, and apply its consequences. */
  resolve(id, resolutionId) {
    const def = this.book.get(id);
    const r = this.rec(id);
    if (!r) return { ok: false, reason: 'quest not open' };
    if (this.isClosed(id)) return { ok: false, reason: 'quest is closed' };
    const res = (def.resolutions || []).find((x) => x.id === resolutionId);
    if (!res) throw new Error(`${id}: no resolution ${resolutionId}`);
    const ctx = this.context();
    ctx.disposition = (this.sim.quest.dispositions || {})[def.giver && def.giver.npc_id] || 0;
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
      if (h.quest && h.reveal) { const r = this.reveal(h.quest, h.reveal); if (r.ok) fired.push({ reveal: h.reveal, quest: h.quest }); }
      if (h.quest && h.journal != null && this.rec(h.quest) && !this.isClosed(h.quest)) {
        const e = (this.book.get(h.quest).journal || []).find((x) => x.index === h.journal);
        if (e && e.state !== 'success' && e.state !== 'failure') {
          const w = this.note(h.quest, h.journal);
          if (w.ok) fired.push({ quest: h.quest, journal: h.journal });
        }
      }
      if (h.quest && h.fail) { const r = this.fail(h.quest, h.fail); if (r.ok) fired.push({ quest: h.quest, failed: h.fail }); }
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
    const changed = { faction_reputation: {}, world_flags: [], unlocked: [], locked: [], npc_disposition: {}, kills_npc: [] };
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
    for (const wf of c.world_flags || []) { if (!q.flags[wf]) { q.flags[wf] = 1; changed.world_flags.push(wf); } }
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
