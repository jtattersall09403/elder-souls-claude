// Gating. RI-QST03 §B, and the single rule that item repeats three times:
//
//   "No rank may reference character level, souls, gold-on-hand, or a raw quest counter."
//
// So this file cannot express one. `LEVEL_WORDS` is checked against every key of every gate
// table at construction time and throws — a level gate is not a low score here, it is a build
// that does not start. The positive form of the same rule is that a gate is always a
// four-part statement — **reputation, attribute, two distinct favoured skills, world state** —
// and that `explain()` renders it as numbers the player can read *before* they fail, which is
// what makes advancement a build statement rather than a wait.
'use strict';

const LEVEL_WORDS = /^(level|char_?level|player_?level|souls|soul_?count|xp|experience|quests_completed|quest_count)$/i;

/** Throws on any gate expressed in a currency this game does not gate on. */
export function assertNoLevelGate(obj, where) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (LEVEL_WORDS.test(k)) throw new Error(`${where}: gate key ${JSON.stringify(k)} is forbidden — RI-QST03 §B bans level, souls, gold-on-hand and raw quest counters as advancement gates`);
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) assertNoLevelGate(v, `${where}.${k}`);
  }
}

/**
 * The faction rank ladders, in RI-QST03 §B's fixed column format.
 * @param {object} doc  game/data/quests/faction-gates.json
 */
export class FactionGates {
  constructor(doc) {
    this.factions = new Map();
    for (const f of (doc && doc.factions) || []) {
      assertNoLevelGate(f, `faction-gates:${f.id}`);
      if (!Array.isArray(f.favoured_attributes) || f.favoured_attributes.length !== 2) {
        throw new Error(`faction-gates:${f.id}: exactly 2 favoured attributes required (RI-QST03 §A)`);
      }
      if (!Array.isArray(f.favoured_skills) || f.favoured_skills.length !== 6) {
        throw new Error(`faction-gates:${f.id}: exactly 6 favoured skills required (RI-QST03 §A)`);
      }
      if (!Array.isArray(f.ranks) || f.ranks.length !== 8) {
        throw new Error(`faction-gates:${f.id}: exactly 8 ranks (index 0-7) required (RI-QST03 §B)`);
      }
      for (const r of f.ranks) {
        for (const k of ['skill_1', 'skill_2']) {
          if (r[k] != null && typeof r[k] !== 'number') throw new Error(`faction-gates:${f.id} rank ${r.rank}: ${k} must be a number or null`);
        }
      }
      this.factions.set(f.id, f);
    }
    this.exclusivity = (doc && doc.exclusivity) || { hard_groups: [], enemy_pairs: [], soft: [] };
  }

  get(id) {
    const f = this.factions.get(id);
    if (!f) throw new Error(`faction ${JSON.stringify(id)} has no rank table in game/data/quests/faction-gates.json`);
    return f;
  }
  ids() { return [...this.factions.keys()].sort(); }

  /** The row a player would read on the wall of the hall. */
  row(factionId, rank) {
    const f = this.get(factionId);
    const r = f.ranks[rank];
    if (!r) throw new Error(`faction ${factionId} has no rank ${rank}`);
    return r;
  }

  /**
   * Can this character hold `rank` in `factionId` right now?
   * @returns {{allowed:boolean, rank:number, faction:string, terms:object[], unmet:string[]}}
   *   `terms` is the full four-part statement with the player's own numbers in it, so a UI can
   *   render the requirement and the shortfall together and never has to invent either.
   */
  evaluate(factionId, rank, ctx) {
    const f = this.get(factionId);
    const row = this.row(factionId, rank);
    const rep = num((ctx.reputation || {})[factionId]);
    const terms = [];
    const unmet = [];

    terms.push({ kind: 'reputation', what: factionId, need: row.reputation, have: rep, met: rep >= row.reputation });
    if (rep < row.reputation) unmet.push(`${f.name} reputation ${rep}/${row.reputation}`);

    if (row.attribute != null) {
      const best = f.favoured_attributes
        .map((a) => ({ a, v: num((ctx.attributes || {})[a]) }))
        .sort((x, y) => y.v - x.v)[0];
      terms.push({ kind: 'attribute', what: f.favoured_attributes, need: row.attribute, have: best.v, best: best.a, met: best.v >= row.attribute });
      if (best.v < row.attribute) unmet.push(`${f.favoured_attributes.join(' or ')} ${best.v}/${row.attribute}`);
    }

    // Two DISTINCT favoured skills, the player's choice of which (RI-QST03 §B note 1).
    const skills = f.favoured_skills
      .map((s) => ({ s, v: num((ctx.skills || {})[s]) }))
      .sort((x, y) => y.v - x.v);
    for (const [slot, need] of [['skill_1', row.skill_1], ['skill_2', row.skill_2]]) {
      if (need == null) continue;
      const pick = slot === 'skill_1' ? skills[0] : skills[1];
      const ok = pick && pick.v >= need;
      terms.push({ kind: slot, what: f.favoured_skills, need, have: pick ? pick.v : 0, best: pick ? pick.s : null, met: !!ok });
      if (!ok) unmet.push(`a ${slot === 'skill_1' ? 'first' : 'second'} favoured skill at ${need} (best available ${pick ? `${pick.s} ${pick.v}` : 'none'})`);
    }

    if (row.world_state) {
      const have = (ctx.worldFlags instanceof Set ? ctx.worldFlags.has(row.world_state.flag) : !!(ctx.worldFlags || {})[row.world_state.flag]);
      terms.push({ kind: 'world_state', what: row.world_state.flag, need: row.world_state.text, have, met: have });
      if (!have) unmet.push(row.world_state.text);
    }

    return { allowed: unmet.length === 0, faction: factionId, rank, rank_name: row.name, terms, unmet };
  }

  /** The highest rank this character currently qualifies for. */
  highestQualifying(factionId, ctx) {
    let best = -1;
    for (let r = 0; r < 8; r++) if (this.evaluate(factionId, r, ctx).allowed) best = r; else break;
    return best;
  }

  /** X1/X4: which factions this membership permanently closes. */
  closedBy(factionId) {
    const out = new Set();
    for (const g of this.exclusivity.hard_groups || []) {
      if (g.members.includes(factionId)) for (const m of g.members) if (m !== factionId) out.add(m);
    }
    for (const p of this.exclusivity.enemy_pairs || []) {
      if (p.includes(factionId)) for (const m of p) if (m !== factionId) out.add(m);
    }
    return [...out].sort();
  }
}

function num(v) { return Number.isFinite(v) ? v : 0; }

/**
 * Is this quest offerable to this character right now?
 * Every reason is returned, not just the first — a giver who says "not yet" should be able to
 * say why, in fiction, and a critic should be able to see the whole predicate.
 */
export function canOffer(def, ctx, gates) {
  const why = [];
  if (ctx.completed && ctx.completed.has(def.id)) why.push('already completed');
  if (ctx.locked && ctx.locked.has(def.id)) why.push('closed by an earlier choice');
  for (const other of def.mutually_exclusive_with || []) {
    if (ctx.completed && ctx.completed.has(other)) why.push(`mutually exclusive with ${other}, which is done`);
  }
  for (const pq of (def.opens_by && def.opens_by.prerequisite_quests) || []) {
    if (!(ctx.completed && ctx.completed.has(pq))) why.push(`requires ${pq} first`);
  }
  for (const t of (def.opens_by && def.opens_by.prerequisite_topics) || []) {
    if (!(ctx.topicsKnown && ctx.topicsKnown.has(t))) why.push(`the topic "${t}" has not come up yet`);
  }
  if (def.opens_by && def.opens_by.topic && ctx.topicsKnown && !ctx.topicsKnown.has(def.opens_by.topic)) {
    why.push(`the topic "${def.opens_by.topic}" has not come up yet`);
  }
  if (def.giver && def.giver.disposition_min != null) {
    const d = num((ctx.dispositions || {})[def.giver.npc_id]);
    if (d < def.giver.disposition_min) why.push(`${def.giver.npc_id} disposition ${d}/${def.giver.disposition_min}`);
  }
  let gate = null;
  if (def.rank_gate && gates) {
    const rank = num((ctx.ranks || {})[def.rank_gate.faction]);
    if (rank < def.rank_gate.min_rank) why.push(`${def.rank_gate.faction} rank ${rank}/${def.rank_gate.min_rank}`);
    if (def.rank_gate.min_reputation != null) {
      const rep = num((ctx.reputation || {})[def.rank_gate.faction]);
      if (rep < def.rank_gate.min_reputation) why.push(`${def.rank_gate.faction} reputation ${rep}/${def.rank_gate.min_reputation}`);
    }
    gate = gates.evaluate(def.rank_gate.faction, Math.max(0, Math.min(7, def.rank_gate.min_rank)), ctx);
  }
  return { offerable: why.length === 0, why, gate };
}

/**
 * Is this resolution available? RI-JRN07 M-Q14: "the gate is decorative" is a hard fail, so a
 * knowledge requirement is enforced against what the character has actually learned, not
 * against what the quest data knows.
 */
export function canResolve(res, ctx) {
  const why = [];
  const req = res.requires || {};
  for (const [s, v] of Object.entries(req.skills || {})) {
    if (num((ctx.skills || {})[s]) < v) why.push(`${s} ${num((ctx.skills || {})[s])}/${v}`);
  }
  for (const [a, v] of Object.entries(req.attributes || {})) {
    if (LEVEL_WORDS.test(a)) throw new Error(`resolution ${res.id}: attribute gate ${JSON.stringify(a)} is forbidden (RI-QST03 §B)`);
    if (num((ctx.attributes || {})[a]) < v) why.push(`${a} ${num((ctx.attributes || {})[a])}/${v}`);
  }
  for (const it of req.items || []) if (!(ctx.items && ctx.items.has(it))) why.push(`you are not carrying ${it}`);
  for (const k of req.knowledge || []) if (!(ctx.knowledge && ctx.knowledge.has(k))) why.push(`you have not learned ${k}`);
  for (const e of req.spell_effects || []) if (!(ctx.spellEffects && ctx.spellEffects.has(e))) why.push(`you cannot bring ${e} to bear`);
  if (req.disposition != null && num((ctx.disposition)) < req.disposition) why.push(`disposition ${num(ctx.disposition)}/${req.disposition}`);
  if (req.gold != null && num(ctx.gold) < req.gold) why.push(`${req.gold} gold`);
  if (req.faction_rank && req.faction_rank.faction) {
    const r = num((ctx.ranks || {})[req.faction_rank.faction]);
    if (r < num(req.faction_rank.min_rank)) why.push(`${req.faction_rank.faction} rank ${r}/${req.faction_rank.min_rank}`);
  }
  for (const k of res.requires_knowing || []) if (!(ctx.knowledge && ctx.knowledge.has(k))) why.push(`you do not know ${k}`);
  return { available: why.length === 0, why };
}
