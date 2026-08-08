// The journal. One continuous, dated, append-only document written by the player character.
//
// The three rules this file is built to make structurally impossible to break:
//
//  1. **The journal never composes text.** `write()` copies the entry verbatim out of the
//     quest file. There is no template, no interpolation, no "Objective: " prefix, no
//     summariser. RI-DLG05 "How we lose" names the alternative exactly: "the default output of
//     anything that writes journals from quest metadata instead of from character experience".
//     A journal that cannot be generated cannot be generated wrong.
//  2. **Append-only, byte-identical forever** (RI-UIX04 J3/JU5). Entries are frozen on write.
//     There is no update path, no delete path, and no renumber path — not even a private one.
//  3. **Dated from the simulated calendar** (RI-DLG05 §A.5), never from a wall clock. See
//     calendar.js.
//
// What the journal is NOT, and what no method here will let it become: a tracker. There is no
// `activeQuests()`, no `currentObjective()`, no completion state on an entry, and no count.
// RI-UIX04 §B Q2/Q3/Q4 are enforced by absence, which is the only enforcement that survives a
// future contributor being helpful.
'use strict';

import { dateOf } from './calendar.js';
import { scanProse } from './prohibitions.js';

export const FLAG = {
  QUEST_NAME: 'quest_name',
  QUEST_FINISHED: 'quest_finished',
  QUEST_RESTART: 'quest_restart',
};

export class Journal {
  /**
   * @param {object[]} entries  the live sim.quest.journal array. Owned by the sim, not by us,
   *   because the save serialises it directly and its ORDER IS SEMANTIC (save/state.js).
   */
  constructor(entries) {
    this.entries = entries;
    this.topicsSeeded = [];
  }

  /** Highest index already written for a journal_id, or 0. */
  lastIndexOf(questId) {
    let hi = 0;
    for (const e of this.entries) if (e.quest === questId && e.n > hi) hi = e.n;
    return hi;
  }

  has(questId, index) {
    for (const e of this.entries) if (e.quest === questId && e.n === index) return true;
    return false;
  }

  countFor(questId) {
    let n = 0;
    for (const e of this.entries) if (e.quest === questId) n++;
    return n;
  }

  /**
   * Write one entry. Verbatim text in, frozen entry out.
   *
   * @param {object} q       the quest definition (game/data/quests/**)
   * @param {number} index   a journal index that EXISTS in that definition
   * @param {number} dayCount sim.env.dayCount at the moment of writing
   * @param {object} opts    { finished:boolean, restart:boolean }
   */
  write(q, index, dayCount, opts = {}) {
    const def = (q.journal || []).find((e) => e.index === index);
    if (!def) throw new Error(`journal: quest ${q.id} has no entry at index ${index} — the journal may only write text the quest file contains`);
    if (this.has(q.id, index)) return null;                       // idempotent: never a duplicate
    const last = this.lastIndexOf(q.id);
    if (index <= last && !opts.restart) {
      throw new Error(`journal: ${q.id} index ${index} would go backwards past ${last}. Entries are append-only and monotonic within a quest (RI-DLG05 §A.1).`);
    }
    const hits = scanProse(def.text);
    if (hits.length) {
      throw new Error(`journal: ${q.id}/${index} contains banned prose (${hits.map((h) => h.rule).join(', ')}) — RI-DLG05 §D, one hit fails the item`);
    }

    const flags = [];
    if (this.countFor(q.id) === 0) flags.push(FLAG.QUEST_NAME);   // exactly one per journal_id
    if (opts.finished) flags.push(FLAG.QUEST_FINISHED);
    if (opts.restart) flags.push(FLAG.QUEST_RESTART);

    const d = dateOf(dayCount);
    const entry = Object.freeze({
      seq: this.entries.length,
      n: index,
      quest: q.id,
      title: flags.includes(FLAG.QUEST_NAME) ? q.title : null,
      date: d.text,
      day: Math.floor(dayCount),
      text: def.text,
      flags: Object.freeze(flags.slice()),
      records_belief: !!def.records_belief,
    });
    this.entries.push(entry);
    return entry;
  }

  /**
   * The display name of a quest, taken from its `quest_name`-flagged entry and from nowhere
   * else (RI-UIX04 J4). A quest with no entry has no name in the journal, because the
   * character has not written anything about it.
   */
  displayNames() {
    const out = [];
    for (const e of this.entries) if (e.flags && e.flags.includes(FLAG.QUEST_NAME)) out.push({ quest: e.quest, title: e.title, seq: e.seq, day: e.day, n: e.n });
    return out;
  }

  /**
   * The chronological order the screen renders in: (date_written, index) ascending, exactly as
   * RI-UIX04 J1 specifies, with the write sequence as the final tie-break so the order is
   * total and deterministic.
   */
  chronological() {
    return this.entries.slice().sort((a, b) => (a.day - b.day) || (a.n - b.n) || (a.seq - b.seq));
  }

  /** Free-text search, chronological results (RI-UIX04 J7). Case-insensitive substring. */
  search(needle) {
    const s = String(needle || '').toLowerCase();
    if (!s) return [];
    return this.chronological().filter((e) => e.text.toLowerCase().includes(s));
  }
}

/**
 * Sanity check used by the harness and by tools: every invariant RI-DLG05's step-2 schema lint
 * asserts, computed over live entries.
 */
export function lintJournal(entries) {
  const byQuest = new Map();
  for (const e of entries) {
    if (!byQuest.has(e.quest)) byQuest.set(e.quest, []);
    byQuest.get(e.quest).push(e);
  }
  const problems = [];
  for (const [q, rs] of [...byQuest.entries()].sort()) {
    const idx = rs.map((r) => r.n);
    const sorted = idx.slice().sort((a, b) => a - b);
    if (JSON.stringify(idx) !== JSON.stringify(sorted)) problems.push(`${q}: index not ascending in write order`);
    if (new Set(idx).size !== idx.length) problems.push(`${q}: duplicate index`);
    const names = rs.filter((r) => (r.flags || []).includes(FLAG.QUEST_NAME));
    if (names.length !== 1) problems.push(`${q}: ${names.length} quest_name entries (must be exactly 1)`);
    if (!rs.every((r) => r.date)) problems.push(`${q}: an entry has no date stamp`);
    for (const r of rs) {
      const hits = scanProse(r.text);
      if (hits.length) problems.push(`${q}/${r.n}: ${hits.map((h) => `${h.rule} ${JSON.stringify(h.match)}`).join(', ')}`);
    }
  }
  return {
    quests: byQuest.size,
    entries: entries.length,
    median_entries_per_quest: median([...byQuest.values()].map((v) => v.length)),
    problems,
  };
}

function median(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}
