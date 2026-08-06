// Disposition and persuasion — RI-DLG04 §B, §C, §D implemented verbatim.
//
// This is Morrowind's second combat system and it is Morrowind-authoritative territory under
// ARBITRATION §1 ("Outside the fight ... Dialogue: topic-list dialogue, keyword discovery,
// disposition, rumours that differ per town"). Three rules govern this file:
//
//  1. **The formulas are transcribed, not designed.** Every arithmetic line below corresponds
//     to a line of RI-DLG04 §B/§C/§D, which in turn transcribes OpenMW's
//     `getDerivedDisposition`, `getPersuasionRatings`, `getPersuasionDispositionChange` and
//     `getBarterOffer`. Where the reference and OpenMW differ the reference wins and the
//     divergence is named in a comment. `tools/dialogue/disposition-oracle.py` re-implements
//     §B/§C from the reference text in a different language and the conformance sweep diffs
//     the two — see tools/dialogue/README.md.
//
//  2. **The die survives, and it is thrown OUTSIDE the fight.** Seam S21: "a persuasion attempt
//     that lowers disposition keeps its roll: the uncertainty is real and the outcome is a
//     story." Seam S1/AR-1 bans dice inside the fight. `persuade()` therefore takes its roll
//     from the caller and `dialogue/system.js` refuses to call it while the speaker is in
//     COMBAT. `derivedDisposition()` has no roll at all, which is exactly why RI-DLG09's
//     parley can read it on frame 43 of a fight without touching AR-1.
//
//  3. **fatigueTerm is not stubbed.** Seam S4 keeps Morrowind's Fatigue alive as a non-combat
//     condition precisely because it feeds persuasion and barter. RI-DLG04 §E rule 7: "if
//     fatigueTerm is stubbed to 1.0 the S4 ruling is unimplemented."
'use strict';

/** RI-DLG04 §E: the five bands. Returns 1..5. */
/**
 * RI-LOR05 §4a's five taint bands, priced as disposition. Ordinary people find you increasingly
 * wrong to be near; rootkeepers find you increasingly interesting, which the item is explicit is
 * worse. Band 0 is absent from both tables because band 0 is nothing happening.
 */
export const SAP_TAINT_DISPOSITION = Object.freeze({ 1: -4, 2: -10, 3: -18, 4: -30 });
export const SAP_TAINT_ROOTKEEPER = Object.freeze({ 1: +5, 2: +12, 3: +18, 4: +25 });

export function band(d) {
  const x = Math.max(0, Math.min(100, Math.trunc(d)));
  if (x < 20) return 1;
  if (x < 40) return 2;
  if (x < 60) return 3;
  if (x < 80) return 4;
  return 5;
}

export const BAND_NAMES = { 1: 'hostile', 2: 'cold', 3: 'neutral', 4: 'friendly', 5: 'warm' };

/**
 * RI-DLG04 §B — fatigueTerm. Range 0.75 … 1.25.
 *   norm = 1.0 if floor(max) == 0 else max(0, current/max)
 *   return fFatigueBase - fFatigueMult * (1 - norm)
 */
export function fatigueTerm(actor, G) {
  const max = Number(actor.fatigueMax ?? actor.fatigue_max ?? 0);
  const cur = Number(actor.fatigue ?? actor.fatigueCurrent ?? 0);
  const norm = Math.floor(max) === 0 ? 1.0 : Math.max(0.0, cur / max);
  return G.fFatigueBase - G.fFatigueMult * (1 - norm);
}

/**
 * The faction term's `reaction` and `rank`, RI-DLG04 §B.
 *
 * "Faction reaction is a matrix, not a flag." When the player belongs to several factions the
 * engine picks the WORST reaction the npc's faction has toward any of them — joining a rival
 * costs you. Expelled memberships are skipped on BOTH branches.
 */
export function factionTerm(npc, player, reactions) {
  const npcFac = npc.faction || null;
  const mine = player.factions || {};
  const react = (a, b) => {
    const row = reactions && reactions.matrix ? reactions.matrix[a] : null;
    if (!row) return 0;
    const v = row[b];
    return v === undefined ? 0 : Number(v);
  };
  if (!npcFac) return { reaction: 0, rank: 0, source: null };

  const mem = mine[npcFac];
  if (mem && !mem.expelled) {
    return { reaction: react(npcFac, npcFac), rank: Number(mem.rank || 0), source: npcFac };
  }
  // argmin over the player's factions of factionReaction(npc.faction, f)
  let best = null;
  for (const f of Object.keys(mine)) {
    const m = mine[f];
    if (!m || m.expelled) continue;
    const r = react(npcFac, f);
    if (best === null || r < best.reaction) best = { reaction: r, rank: Number(m.rank || 0), source: f };
  }
  return best || { reaction: 0, rank: 0, source: null };
}

/**
 * The W1-07 seam. `game/data/progression/race-reactions.json` §application is explicit:
 * "raceReaction[group][race] is added to npc.baseDisposition inside RI-DLG04 §B's
 * derivedDisposition BEFORE every other term. The upbringing term stacks on top of it."
 * This function is that sentence. It is what makes RI-DLG04 §E rule 5 ("race and faction terms
 * must bite") true by construction rather than by hand-tuning base dispositions.
 */
export function raceTerm(npc, player, rr) {
  if (!rr || !rr.matrix) return { race: 0, upbringing: 0 };
  const group = npc.reaction_group || npc.reactionGroup || null;
  if (!group) return { race: 0, upbringing: 0 };
  const row = rr.matrix[group] || {};
  const race = Number(row[player.race] ?? 0);
  let upb = 0;
  if (player.upbringing && Array.isArray(rr.upbringings)) {
    const u = rr.upbringings.find((x) => x.id === player.upbringing);
    if (u && u.mods && u.mods[group] !== undefined) upb = Number(u.mods[group]);
  }
  return { race, upbringing: upb };
}

/**
 * RI-DLG04 §B — derivedDisposition. Returns clamp(trunc(x), 0, 100).
 *
 * `explain` carries every term so the harness can show a critic why a number is what it is,
 * which is the difference between a disposition system and a disposition number.
 */
export function derivedDisposition(npc, player, ctx = {}) {
  const G = ctx.gmst;
  const rr = ctx.raceReactions || null;
  const reactions = ctx.factionReactions || null;

  const rt = raceTerm(npc, player, rr);
  const terms = [];
  let x = Number(npc.baseDisposition ?? npc.disposition ?? 40);
  terms.push(['base', x]);
  // W1-07's pre-term, applied before every other term exactly as race-reactions.json declares.
  if (rt.race) { x += rt.race; terms.push(['race_reaction', rt.race]); }
  if (rt.upbringing) { x += rt.upbringing; terms.push(['upbringing', rt.upbringing]); }

  const crimeMod = Number(npc.crimeDispositionModifier ?? 0);
  if (crimeMod) { x += crimeMod; terms.push(['crimeDispositionModifier', crimeMod]); }

  if (npc.race && player.race && npc.race === player.race) { x += G.fDispRaceMod; terms.push(['fDispRaceMod', G.fDispRaceMod]); }

  const pers = G.fDispPersonalityMult * (Number(player.Personality || 0) - G.fDispPersonalityBase);
  x += pers; terms.push(['personality', pers]);

  const ft = factionTerm(npc, player, reactions);
  const fac = (G.fDispFactionRankMult * ft.rank + G.fDispFactionRankBase) * G.fDispFactionMod * ft.reaction;
  x += fac; terms.push(['faction', fac]);

  const bountyTerm = -G.fDispCrimeMod * Number(player.bounty || 0);
  if (bountyTerm) { x += bountyTerm; terms.push(['bounty', bountyTerm]); }

  if (player.hasCommonDisease || player.hasBlightDisease) { x += G.fDispDiseaseMod; terms.push(['fDispDiseaseMod', G.fDispDiseaseMod]); }
  if (player.weaponDrawn) { x += G.fDispWeaponDrawn; terms.push(['fDispWeaponDrawn', G.fDispWeaponDrawn]); }

  // RI-DLG09 §C, binding: "fDispAttacking = -10 applies once you have landed a hit on this NPC
  // in this encounter", so that "opening with a swing and then asking to talk is 15 disposition
  // points harder than asking first". Vanilla applies this GMST as a one-off permanent change on
  // being attacked; RI-DLG09 makes it a live term, and RI-DLG09 is the owner of the parley gate.
  const attacked = ctx.attacked !== undefined ? ctx.attacked
    : (player.attackedNpcs ? !!player.attackedNpcs[npc.id] : false);
  if (attacked) { x += G.fDispAttacking; terms.push(['fDispAttacking', G.fDispAttacking]); }

  const charm = Number(player.charmMagnitude || 0);
  if (charm) { x += charm; terms.push(['charm', charm]); }

  // RI-LOR05 §4a, the tithe-curse, made observable. "NPCs notice your eyes" at band 1;
  // "Rootkeepers will now speak to you, which is worse" at band 2; at band 4 "certain NPCs will
  // not be in the same room as you". A non-Argonian who uses the hearths — which is to say, who
  // plays the game — carries this, and it is the ONLY thing `sap_ward` lowers. It touches
  // nothing inside the fight, which is what keeps it legal under AR-1: no frame, no hitbox, no
  // telegraph and no damage number reads it.
  const taint = Number(player.sapTaintBand || 0);
  if (taint > 0) {
    const isRootkeeper = !!(npc.rootkeeper || (npc.tags && npc.tags.includes('rootkeeper')));
    const t = isRootkeeper ? SAP_TAINT_ROOTKEEPER[taint] : SAP_TAINT_DISPOSITION[taint];
    if (t) { x += t; terms.push([isRootkeeper ? 'sap_taint_rootkeeper' : 'sap_taint', t]); }
  }

  const out = Math.max(0, Math.min(100, Math.trunc(x)));
  return ctx.explain ? { value: out, raw: x, terms, faction: ft, race: rt } : out;
}

/**
 * RI-DLG04 §C — persuasionRatings. Returns [r1, r2, r3].
 * The player and the NPC use DIFFERENT formulas; that asymmetry is in the reference and is the
 * reason a high-level player is better at Intimidate than at Admire.
 */
export function persuasionRatings(actor, isPlayer, G) {
  const persTerm = Number(actor.Personality || 0) / G.fPersonalityMod;
  const luckTerm = Number(actor.Luck || 0) / G.fLuckMod;
  const repTerm = Number(actor.Reputation || 0) * G.fReputationMod;
  const levelTerm = Number(actor.level || 0) * G.fLevelMod;
  const ft = fatigueTerm(actor, G);
  const speech = Number(actor.Speechcraft || 0);
  const merc = Number(actor.Mercantile || 0);

  const r1 = (repTerm + luckTerm + persTerm + speech) * ft;
  let r2, r3;
  if (isPlayer) {
    r2 = r1 + levelTerm;
    r3 = (merc + luckTerm + persTerm) * ft;
  } else {
    r2 = (levelTerm + repTerm + luckTerm + persTerm + speech) * ft;
    r3 = (merc + repTerm + luckTerm + persTerm) * ft;
  }
  return [r1, r2, r3];
}

export const VERBS = ['admire', 'intimidate', 'taunt', 'bribe10', 'bribe100', 'bribe1000'];

/** The bribe tier's gold cost and its flat target bonus. */
export function bribeSpec(type, G) {
  if (type === 'bribe10') return { gold: 10, mod: G.fBribe10Mod };
  if (type === 'bribe100') return { gold: 100, mod: G.fBribe100Mod };
  if (type === 'bribe1000') return { gold: 1000, mod: G.fBribe1000Mod };
  return { gold: 0, mod: 0 };
}

/**
 * RI-DLG04 §C — the four verbs.
 *
 * `roll` is supplied by the caller (an integer 0..99 drawn from the seeded PRNG). This function
 * is pure: same inputs, same outputs, no clock, no Math.random. That is what lets the oracle
 * sweep 100,000 cases and lets the harness replay a persuasion attempt exactly.
 *
 * `d = 1 - 0.02*|D-50|` is THE design (RI-DLG04 §C): persuasion is easiest in the middle and
 * nearly impossible at the extremes. Deleting it turns Admire into a progress bar.
 */
export function persuade(npc, player, type, roll, ctx = {}) {
  const G = ctx.gmst;
  const D = derivedDisposition(npc, player, ctx);
  const [n1, n2, n3] = persuasionRatings(npc, false, G);
  const [p1, p2, p3] = persuasionRatings(player, true, G);

  const d = 1 - 0.02 * Math.abs(D - 50);
  const bs = bribeSpec(type, G);
  let target1 = d * (p1 - n1 + 50);
  let target2 = d * (p2 - n2 + 50);
  let target3 = d * (p3 - n3 + 50) + bs.mod;

  const minChance = G.iPerMinChance;
  const minChange = G.iPerMinChange;
  const mult = G.fPerDieRollMult;
  const temp = G.fPerTempMult;

  let success = false, x = 0, y = 0;
  const ai = { fight: 0, flee: 0 };

  if (type === 'admire') {
    target1 = Math.max(minChance, target1);
    success = roll <= target1;
    const c = Math.floor(mult * (target1 - roll));
    x = success ? Math.max(minChange, c) : c;
  } else if (type === 'intimidate') {
    target2 = Math.max(minChance, target2);
    success = roll <= target2;
    const mag = Math.abs(Math.floor(target2 - roll));
    if (success) {
      const s = Math.max(minChange, Math.floor(mag * mult * temp));
      ai.flee = +s; ai.fight = -s;
    }
    const c = -Math.abs(Math.floor((target2 - roll) * mult));
    if (success) {
      // RI-DLG04 provenance note: on a MARGINAL win vanilla applies x = 0, y = -iPerMinChange —
      // widely held to be a bug and fixed by the Morrowind Code Patch. OpenMW applies
      // x = iPerMinChange. "We take the fixed behaviour."
      if (Math.abs(c) < minChange) { x = minChange; y = -minChange; }
      else { x = -Math.trunc(c * temp); y = c; }   // temp POSITIVE, perm NEGATIVE
    } else {
      x = Math.trunc(c * temp); y = c;             // both negative
    }
  } else if (type === 'taunt') {
    target1 = Math.max(minChance, target1);
    success = roll <= target1;
    const mag = Math.abs(Math.floor(target1 - roll));
    if (success) {
      const s = Math.max(minChange, Math.floor(mag * mult * temp));
      ai.fight = +s; ai.flee = -s;
    }
    // "x = floor(-c * fPerDieRollMult), always NEGATIVE; on success at least -iPerMinChange"
    x = -Math.floor(mag * mult);
    if (success) x = Math.min(x, -minChange);
  } else {
    target3 = Math.max(minChance, target3);
    success = roll <= target3;
    const c = Math.floor((target3 - roll) * mult);
    x = success ? Math.max(minChange, c) : c;
  }

  // RI-DLG04 §C, the temp/perm split applied after the verb.
  let tempChange, permChange;
  if (type === 'intimidate') {
    tempChange = clampToRange(Math.trunc(x), D);
    permChange = success ? -Math.trunc(tempChange / temp) : Math.trunc(y);
  } else {
    tempChange = clampToRange(Math.trunc(x * temp), D);
    permChange = Math.trunc(tempChange / temp);
  }

  return {
    type, roll, success,
    disposition_before: D,
    d, target1, target2, target3,
    target_used: type === 'intimidate' ? target2 : (type.startsWith('bribe') ? target3 : target1),
    tempChange, permChange,
    ai_fight_delta: ai.fight, ai_flee_delta: ai.flee,
    gold_cost: bs.gold,   // "spent either way" — RI-DLG04 §C's bribe row
    ratings: { npc: [n1, n2, n3], player: [p1, p2, p3] },
  };
}

function clampToRange(change, D) {
  if (D + change > 100) return 100 - D;
  if (D + change < 0) return -D;
  return change;
}

/**
 * RI-DLG04 §D — barter. "Every point of disposition is worth 0.5% off the buy price."
 * This is what makes bribing a merchant a rational economic act rather than a flavour button.
 */
export function offerPrice(npc, player, basePrice, buying, ctx = {}) {
  const G = ctx.gmst;
  const a = Math.min(Number(player.Mercantile || 0), 100);
  const b = Math.min(0.1 * Number(player.Luck || 0), 10);
  const c = Math.min(0.2 * Number(player.Personality || 0), 10);
  const dd = Math.min(Number(npc.Mercantile || 0), 100);
  const e = Math.min(0.1 * Number(npc.Luck || 0), 10);
  const f = Math.min(0.2 * Number(npc.Personality || 0), 10);
  const D = derivedDisposition(npc, player, ctx);
  const pcTerm = (D - 50 + a + b + c) * fatigueTerm(player, G);
  const npcTerm = (dd + e + f) * fatigueTerm(npc, G);
  const buyTerm = 0.01 * (100 - 0.5 * (pcTerm - npcTerm));
  const sellTerm = 0.01 * (50 - 0.5 * (npcTerm - pcTerm));
  return Math.max(1, Math.trunc(basePrice * (buying ? buyTerm : sellTerm)));
}
