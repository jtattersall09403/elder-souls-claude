// The refusal, in voice. W1-20.
//
// RI-QST03 §C: *"a locked faction's members still speak one line explaining why they will not deal
// with the player"*, and §B: *"`explain()` renders it as numbers the player can read BEFORE they
// fail, which is what makes advancement a build statement rather than a wait."*
//
// Both halves already existed and neither reached a person. `FactionGates.evaluate()` computes the
// full four-part statement with the player's own numbers in it; `QuestEngine.open()` refuses on it
// and returns `c.why.join('; ')` — `the_drowned_court rank 0/2; the_drowned_court reputation 0/22`.
// That is a debug string. From the chair, a faction you cannot yet join is a quest that does not
// appear and a person who says nothing about it.
//
// This file has ONE job: take an evaluation gate.js already produced and give the recruiter words
// for it. It never states a threshold. Every number in every line comes from `evaluate()`, which
// reads `game/data/quests/faction-gates.json`, so the ladder stays the single source of the
// numbers and the prose cannot drift away from it — the failure mode that put two rank ladders in
// this build for one body.
'use strict';

/** Display names, for speech. Falls back to the id with its hyphens opened out. */
function pretty(id, skills) {
  const rec = (skills || []).find((s) => s.id === id);
  if (rec && rec.name) return rec.name;
  return String(id || '').replace(/-/g, ' ');
}

/** The order a recruiter speaks in, which is the order gate.js emits the terms. */
const TERM_ORDER = ['reputation', 'attribute', 'skill_1', 'skill_2', 'world_state'];

export class FactionRefusals {
  /**
   * @param {object} doc    game/data/dialogue/faction-refusals.json
   * @param {object[]} skills  game/data/progression/skills.json `.skills`, for display names
   */
  constructor(doc, skills) {
    this.doc = doc || {};
    this.skills = skills || [];
    this.byFaction = (this.doc.factions) || {};
    this.notJoinable = (this.doc.not_joinable) || {};
    this.spoken = 0;
  }

  /** Which factions this file can speak for. A census, so a probe can find a hole. */
  ids() { return Object.keys(this.byFaction).sort(); }

  /**
   * The line a recruiter says about `evaluation`, which must be the return of
   * `FactionGates.evaluate(factionId, rank, ctx)`.
   *
   * @returns {{said:string|null, kind:string|null, faction:string, rank:number,
   *            need:number|null, have:number|null, allowed:boolean}}
   *   `said` is null only when this file has nothing for the faction, and that is a reportable
   *   hole rather than a silent pass — `unknown_faction` covers the case in words.
   */
  speak(factionId, evaluation) {
    const lines = this.byFaction[factionId];
    const base = {
      faction: factionId,
      rank: evaluation ? evaluation.rank : null,
      allowed: !!(evaluation && evaluation.allowed),
      kind: null, need: null, have: null,
    };
    if (!lines) {
      const dead = this.notJoinable[factionId];
      return { ...base, said: dead || this.doc.unknown_faction || null, kind: dead ? 'not_joinable' : 'unknown' };
    }
    if (!evaluation) return { ...base, said: null };

    if (evaluation.allowed) {
      this.spoken++;
      return { ...base, said: lines.welcome || null, kind: 'welcome' };
    }

    // The FIRST unmet term, in the fixed order. A person who lists four reasons is reading a form.
    const terms = evaluation.terms || [];
    for (const kind of TERM_ORDER) {
      const t = terms.find((x) => x.kind === kind && !x.met);
      if (!t) continue;
      const tmpl = lines[kind];
      if (!tmpl) continue;
      const need = t.need;
      const have = t.have;
      const said = String(tmpl)
        .replace(/\{need\}/g, kind === 'world_state' ? String(t.need) : String(need))
        .replace(/\{have\}/g, String(have))
        .replace(/\{short\}/g, String(Math.max(0, Number(need) - Number(have) || 0)))
        .replace(/\{skill\}/g, pretty(t.best, this.skills))
        // `t.what` is an array for the skill and attribute terms and a bare string for the
        // reputation and world-state ones. gate.js has always been like that; a `.map` on the
        // string threw on the first faction the probe reached.
        .replace(/\{skills\}/g, (Array.isArray(t.what) ? t.what : [t.what]).map((s) => pretty(s, this.skills)).join(', '))
        .replace(/\{attr\}/g, pretty(t.best, this.skills))
        .replace(/\{rank\}/g, evaluation.rank_name || `rank ${evaluation.rank}`);
      this.spoken++;
      return { ...base, said, kind, need, have };
    }
    return { ...base, said: null, kind: 'unmet_with_no_line' };
  }
}
