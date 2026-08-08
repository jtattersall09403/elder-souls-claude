// The guard ladder, the arrest interaction and the jail ledger — RI-CRM01 §4 §5 §6.
//
// Race terms are NOT restated here. `raceLawFactor` and `raceSuspicion` are W1-07's, read from
// game/data/progression/race-reactions.json §guards. Faction terms are RI-CRM02 §5's, read from
// game/data/crime/sanction.json. This module composes the two and does not own either — which
// is the only way the RI-CRM02 method 6 assertion ("run as a live behavioural probe across all
// 15 cells, never as a formula read") can be about one number rather than three.
'use strict';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * arrestThreshold = base[authority] x raceLawFactor[race] x factionLawFactor[standing]
 * attackThreshold = 4 x arrestThreshold
 */
export function thresholds(raceData, sanctionData, justiceData, { race, authority = 'imperial_authority', standing = 'none' }) {
  const g = raceData.guards;
  const base = g.base[authority];
  if (base === null || base === undefined) {
    return { base: null, race_law: null, faction_law: null, arrest_at: null, attack_at: null, note: g.interior_note };
  }
  const rl = g.law_factor[race];
  if (!rl) throw new Error(`thresholds: unknown race ${JSON.stringify(race)}`);
  const row = sanctionData.faction_law_factor.rows.find((r) => r.standing === standing);
  if (!row) throw new Error(`thresholds: unknown standing ${JSON.stringify(standing)}; expected one of ${sanctionData.faction_law_factor.rows.map((r) => r.standing).join(', ')}`);
  const fl = authority === 'settlement_militia' ? row.militia_law : row.imperial_law;
  const arrest = base * rl.lawFactor * fl;
  return {
    base, race_law: rl.lawFactor, faction_law: fl,
    arrest_at: Math.round(arrest),
    attack_at: Math.round(arrest * justiceData.attack_threshold_multiplier),
    suspicion: rl.suspicion * (authority === 'settlement_militia' ? 1.0 : row.imperial_suspicion),
  };
}

/** RI-CRM01 §4's three bands, plus the two location overrides. */
export function guardBand(justiceData, bounty, th, { insideLegionFort = false, insideProvincialOffice = false } = {}) {
  if (bounty > 0 && (insideLegionFort || insideProvincialOffice)) {
    return { band: 2, behaviour: 'arrest_dialogue', override: insideLegionFort ? 'legion_fort' : 'provincial_office' };
  }
  if (bounty <= 0) return { band: 0, behaviour: 'none' };
  if (bounty < th.arrest_at) return { band: 1, ...pick(justiceData.guard_ladder, 1) };
  if (bounty < th.attack_at) return { band: 2, ...pick(justiceData.guard_ladder, 2) };
  return { band: 3, ...pick(justiceData.guard_ladder, 3) };
}

function pick(ladder, band) {
  const r = ladder.find((x) => x.band === band);
  return { behaviour: r.behaviour, arrest: r.arrest, draws_weapon: r.draws_weapon, parley: r.parley || null };
}

/**
 * The arrest interaction. Three answers, two escape hatches, and a refusal that names the
 * shortfall — *"a greyed-out option that does not explain itself is a UI failure, not a design
 * one."* Returns the topic list a dialogue renderer draws; it never draws a menu overlay.
 */
export function arrestTopics(justiceData, { bounty, gold, factionRank, factionHasStanding, factionInvocationsLeft, speechcraft, guardDisposition }) {
  const a = justiceData.arrest;
  const topics = [];
  const payRow = a.answers.find((x) => x.id === 'pay');
  const canPay = gold >= bounty;
  topics.push({
    id: 'pay', text: payRow.text, available: true, refused: !canPay,
    refusal: canPay ? null : a.insufficient_gold.line.replace('{shortfall}', `${bounty - gold} gold`),
    shortfall_g: canPay ? 0 : bounty - gold,
  });
  topics.push({ id: 'resist', text: a.answers.find((x) => x.id === 'resist').text, available: true, refused: false });
  topics.push({ id: 'serve', text: a.answers.find((x) => x.id === 'serve').text, available: true, refused: false });
  const inv = a.escape_hatches.find((h) => h.id === 'faction_invocation');
  if (factionRank >= 4 && factionHasStanding && factionInvocationsLeft > 0) {
    topics.push({ id: 'faction_invocation', text: 'You know who I answer to.', available: true, refused: false, uses_left: factionInvocationsLeft, cost: inv.cost });
  }
  const sp = a.escape_hatches.find((h) => h.id === 'speechcraft');
  if (speechcraft >= 60 && guardDisposition >= 55) {
    topics.push({ id: 'persuade', text: 'There is another way to read this.', available: true, refused: false, reduction: sp.reduction, retryable: false, keeps_die: true });
  }
  return topics;
}

export function answerArrest(justiceData, crimeWorld, answer, ctx) {
  const a = justiceData.arrest;
  const bounty = ctx.bounty;
  switch (answer) {
    case 'pay': {
      if (ctx.gold < bounty) return { ok: false, refused: true, shortfall_g: bounty - ctx.gold, line: a.insufficient_gold.line.replace('{shortfall}', `${bounty - ctx.gold} gold`) };
      crimeWorld.setBounty(ctx.jurisdiction || 'imperial', 0, ctx.settlement);
      crimeWorld.log.push({ type: 'arrest', answer: 'pay', gold_delta: -bounty, bounty_after: 0, frame: ctx.frame, confiscated: ctx.stolenItems ? ctx.stolenItems.length : 0 });
      return { ok: true, gold_delta: -bounty, bounty_after: 0, confiscate_stolen: true, guard_disposition: 5, time_passes_days: 0 };
    }
    case 'resist': {
      const add = a.answers.find((x) => x.id === 'resist').bounty_delta;
      crimeWorld.commit('resist_arrest', { frame: ctx.frame, jurisdiction: ctx.jurisdiction || 'imperial', settlement: ctx.settlement });
      crimeWorld.addBounty(ctx.jurisdiction || 'imperial', add, ctx.settlement);
      crimeWorld.log.push({ type: 'arrest', answer: 'resist', bounty_after: crimeWorld.bountyIn(ctx.jurisdiction || 'imperial', ctx.settlement), frame: ctx.frame });
      return { ok: true, bounty_after: crimeWorld.bountyIn(ctx.jurisdiction || 'imperial', ctx.settlement), aggro_radius_m: 40, aggro_within_f: 30 };
    }
    case 'serve': {
      const ledger = serve(justiceData, bounty, ctx.skills);
      crimeWorld.setBounty(ctx.jurisdiction || 'imperial', 0, ctx.settlement);
      crimeWorld.jail = { began_f: ctx.frame, days: ledger.days, released_at: ledger.released_at };
      crimeWorld.log.push({ type: 'jail_serve', days: ledger.days, frame: ctx.frame, ...ledger.summary });
      return { ok: true, ...ledger, bounty_after: 0, confiscate_stolen: true };
    }
    case 'faction_invocation':
      crimeWorld.log.push({ type: 'arrest', answer: 'faction_invocation', frame: ctx.frame, rank_progress_delta: -1 });
      return { ok: true, deferred: true, rank_progress_delta: -1, bounty_after: bounty };
    case 'persuade': {
      // S21: this attempt keeps its die because failing it is permanent — RI-DLG04 owns the
      // roll and hands us its result. Retryable never.
      const red = justiceData.arrest.escape_hatches.find((h) => h.id === 'speechcraft').reduction;
      if (!ctx.persuadeSucceeded) return { ok: false, retryable: false, bounty_after: bounty };
      const after = Math.round(bounty * (1 - red));
      crimeWorld.setBounty(ctx.jurisdiction || 'imperial', after, ctx.settlement);
      return { ok: true, bounty_after: after, reduction: red, retryable: false };
    }
    default:
      throw new Error(`answerArrest: unknown answer ${JSON.stringify(answer)}; the three are pay | resist | serve (+ faction_invocation, persuade)`);
  }
}

/**
 * RI-CRM01 §6. Deterministic and legible: you lose your BEST cell-blocked skill, not a random
 * point. *"'You lose your best social skill' is a punishment a player can understand, resent and
 * plan around, and 'you lost a point of something' is noise."*
 */
export function serve(justiceData, bounty, skills) {
  const j = justiceData.jail;
  const days = Math.max(j.days_min, Math.min(j.days_max, Math.ceil(bounty / 100)));
  const lost = Math.floor(days / j.loss.levels_per_days[1]) * j.loss.levels_per_days[0];
  const s = { ...skills };
  const order = j.loss.cell_blocked_skills;
  const removals = [];
  for (let i = 0; i < lost; i++) {
    // Highest among the six; ties broken by the declared list order, which is what makes this
    // reproducible across seeds — the S21 assertion in RI-CRM01 method 9.
    let best = null;
    for (const k of order) {
      const v = s[k] ?? 0;
      if (v <= j.loss.floor) continue;
      if (best === null || v > s[best]) best = k;
    }
    if (best === null) break;
    s[best] -= 1;
    removals.push(best);
  }
  const gains = {};
  for (const g of j.gain) {
    const n = Math.floor(days / g.levels_per_days[1]) * g.levels_per_days[0];
    if (n > 0) { gains[g.skill] = n; s[g.skill] = (s[g.skill] ?? 0) + n; }
  }
  return {
    days,
    skills_after: s,
    levels_lost: removals.length,
    lost_from: removals,
    gained: gains,
    confiscated: j.confiscated,
    returned: j.returned_at_the_gate,
    not_touched: j.not_touched,
    time_passes_days: days,
    released_at: days >= j.release_location.imperial_sentence_days_gte ? j.release_location.released_at : null,
    summary: { levels_lost: removals.length, lost_from: removals.join(','), sneak: gains.sneak || 0, security: gains.security || 0 },
  };
}

/** Bribing a witness, and its deliberate 2x premium (RI-CRM01 §3b). */
export function bribeCost(justiceData, wouldBeBounty) {
  const r = justiceData.report_chain.responses.find((x) => x.id === 'bribe');
  return Math.round(wouldBeBounty * r.multiplier);
}

export { clamp };
