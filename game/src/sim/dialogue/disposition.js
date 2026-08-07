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
/**
 * The quest files, `faction-gates.json` and the NPC records all name factions in an
 * UNDERSCORE vocabulary (`the_xul_aneekh`, `house_dres`, `deep_kin`); `faction-reactions.json`
 * indexes its matrix in a HYPHEN vocabulary with a partly different roster (`xul-aneekh`,
 * `sap-cutters`). Nothing reconciled them, so `factionTerm` would have resolved every live
 * faction id to `undefined` — a silent 0 — the moment anyone wired it up.
 *
 * `aliases` in `faction-reactions.json` is the authored half of the reconciliation and wins;
 * this is the mechanical fallback (`the_` prefix dropped, `_` → `-`) so a faction added later
 * whose name already matches resolves without an entry.
 */
export function normaliseFactionId(id, reactions) {
  if (!id) return null;
  const s = String(id);
  const table = (reactions && reactions.aliases) || null;
  if (table && Object.prototype.hasOwnProperty.call(table, s)) return table[s];
  const m = reactions && reactions.matrix;
  if (m && Object.prototype.hasOwnProperty.call(m, s)) return s;
  const guess = s.replace(/^the_/, '').replace(/_/g, '-');
  if (m && Object.prototype.hasOwnProperty.call(m, guess)) return guess;
  return null;
}

export function factionTerm(npc, player, reactions) {
  const npcFac = normaliseFactionId(npc.faction, reactions);
  const mine = player.factions || {};
  const react = (a, b) => {
    const row = reactions && reactions.matrix ? reactions.matrix[a] : null;
    if (!row) return 0;
    const v = row[b];
    return v === undefined ? 0 : Number(v);
  };
  if (!npcFac) return { reaction: 0, rank: 0, source: null };

  // The player's memberships are keyed in the live (underscore) vocabulary too, so the
  // membership test has to be done on normalised ids or a Xul-Aneekh member reads as a
  // stranger to a Xul-Aneekh NPC.
  //
  // W1-19 ROUND 2 — **ALLEGIANCE IS NOT REPUTATION**, and conflating them closed the main quest.
  //
  // `QuestEngine._applyConsequences()` creates a row the first time a quest grants reputation:
  // `{ member: false, rank: 0, reputation: 0, ... }`. This loop then read that row as a
  // MEMBERSHIP — it never looked at `member` and never looked at `rank` — so one quest paying
  // four points of Drowned Court goodwill made the player, in House Dres's eyes, a Drowned Court
  // man: `(0.5*0 + 1) * 3 * -4 = -12`, on the nose, in one step. Because the fallback is an
  // ARGMIN over every row the player holds, the term is also **monotonically non-increasing in
  // quests completed** — every new relationship can only find a worse enemy, never a better
  // friend — so a standing that started at exactly the gate could only ever fall through it.
  // Measured on the round-1 build: `Q-MAIN-01 / res_carry` drove the term 0 -> -12 and shut
  // `Q-MAIN-23` twenty-two quests later for all eight Saxhleel and Naga signatures, with nothing
  // in the build able to restore a single point of it.
  //
  // The split below is the fix and it is a design decision, argued in the round-2 report:
  //
  //   * **allegiance** — Morrowind's `PCFactionReaction`, transcribed unchanged, applied to what
  //     Morrowind applies it to: a faction the player has actually JOINED. Rank amplifies the
  //     sign in both directions, which is `faction-reactions.json §application` verbatim: the
  //     higher you climb in one house, the more the rival house sees you coming. Joining is a
  //     declared act, so it is allowed to cost you.
  //   * **repute** — `movableTerms()` below. Signed, proportional and summed rather than
  //     argmin'd, so that goodwill you have earned with this NPC's own faction and with the
  //     factions it likes PAYS FOR the goodwill you have earned with the ones it does not. That
  //     is what makes a race that starts thirty points down able to climb, which is the design
  //     the province wanted all along and did not have.
  //
  // Membership is `member === true` AND NOTHING ELSE. This threshold was tried at
  // `rank >= 1` first and measured, because it looked principled — `faction-gates.json` names
  // rank 0 "Stranger" and rank 1 "Guest", so rank 1 reads like admission. It is not admission,
  // and the measurement said so: five quests of ordinary Court work put a Naga at Drowned Court
  // rank 1 on the derived ladder, at which point the Wet Ledger's harbourmaster read the
  // amplified rank-1 penalty `(0.5*1 + 1) * 3 * -4 = -18` — WORSE than the -12 cliff this whole
  // change exists to remove — and completion fell from 29/40 to 0/40. Being made a guest of a
  // house you never joined, and then charged for it by that house's rivals, is the same defect
  // in better clothes.
  //
  // So: allegiance costs you when you have DECLARED it. `member` is set by `QuestEngine
  // .joinFaction()`, which is the only thing in the build that sets it and is what a faction
  // quest calls; the derived ladder rank then amplifies the term exactly as
  // `faction-reactions.json §application` describes, so climbing still makes rivals notice you.
  // Everything short of joining is priced by `reputeTerm` below, signed and in proportion.
  const norm = new Map();
  for (const f of Object.keys(mine)) {
    const m = mine[f];
    if (!m || m.expelled) continue;
    if (m.member !== true) continue;                                 // reputation is not allegiance
    const key = normaliseFactionId(f, reactions);
    if (!key) continue;
    const prev = norm.get(key);
    if (!prev || Number(m.rank || 0) > Number(prev.rank || 0)) norm.set(key, m);
  }

  const mem = norm.get(npcFac);
  if (mem) return { reaction: react(npcFac, npcFac), rank: Number(mem.rank || 0), source: npcFac };

  // argmin over the player's MEMBERSHIPS of factionReaction(npc.faction, f)
  let best = null;
  for (const [f, m] of norm) {
    const r = react(npcFac, f);
    if (best === null || r < best.reaction) best = { reaction: r, rank: Number(m.rank || 0), source: f };
  }
  return best || { reaction: 0, rank: 0, source: null };
}

/**
 * The reputation this NPC's faction can see, priced as disposition. W1-19 round 2.
 *
 * Every `faction_reputation` number the quest files author — 96 of them across the mainline
 * alone, from -30 to +20 — reached the offer gate through exactly one channel before this
 * function existed: `factionTerm`'s argmin, which read a reputation row as a membership and
 * could only ever subtract. This is the channel that can add.
 *
 * For each faction the player has standing with, the NPC's own faction weighs it by how it feels
 * about that faction (`faction-reactions.json`, -4..+4) and by how much standing there is
 * (`REP_FULL` points is "as much as this matters"). The contributions are SUMMED, not argmin'd,
 * because the point of the whole exercise is that a person can be several things at once and
 * that serving one house is a way to pay for having served another. The total is clamped so that
 * no amount of accumulated reputation can substitute for who somebody is, or bury it.
 *
 * Three properties this has and the argmin did not, each load-bearing:
 *
 *   1. **Signed.** Being hated by the Drowned Court is a recommendation to House Dres.
 *   2. **Proportional.** Four points of goodwill costs a rival a point, not twelve.
 *   3. **Repairable.** Every gate on the main spine is now reachable by doing work for someone,
 *      which is the difference between "your background costs you" and "your background locks
 *      you out".
 */
export const REP_FULL = 40;          // reputation at which a faction's opinion is fully expressed
export const REACTION_MAX = 4;       // faction-reactions.json `range`
export const REPUTE_MOD = 15;        // disposition points at a wholly approved / wholly disliked record

/**
 * IT IS A WEIGHTED MEAN, NOT A SUM, and that is the whole of the design.
 *
 * The first draft summed the contributions and clamped the total. Measured over the chain, that
 * reproduced the original defect one layer down: a character who has done business with six
 * factions accumulates six terms, most NPCs dislike most factions, and the total walks to the
 * negative clamp — so "having played the game" was still a penalty and Q-MAIN-23 still shut for
 * every Saxhleel (measured: 18/40 signatures finished).
 *
 * A mean asks the question that a person actually asks, which is not *"how many of my enemies
 * have you helped"* but *"on the whole, whose work do you do?"* A player who serves the cutters
 * as much as the Court reads as mixed; a player who serves only the Court reads as the Court's.
 * Weighting by |reputation| means a large standing speaks louder than a small one, which is why
 * one errand does not define you and a whole act does.
 */

export function reputeTerm(npc, player, reactions) {
  const npcFac = normaliseFactionId(npc.faction, reactions);
  if (!npcFac) return { total: 0, parts: [] };
  const matrix = (reactions && reactions.matrix) || null;
  if (!matrix) return { total: 0, parts: [] };
  const row = matrix[npcFac];
  if (!row) return { total: 0, parts: [] };

  const parts = [];
  let x = 0;
  const seen = new Map();
  for (const [f, m] of Object.entries(player.factions || {})) {
    if (!m) continue;
    const rep = Number(m.reputation || 0);
    if (!rep) continue;
    const key = normaliseFactionId(f, reactions);
    if (!key) continue;
    // Two live ids can alias onto one matrix row (`deep_kin` and `the_xul_aneekh` both mean
    // `xul-aneekh`); the standing is the sum, not the last one seen.
    seen.set(key, (seen.get(key) || 0) + rep);
  }
  let weight = 0;
  for (const [key, rep] of seen) {
    // An expelled faction's goodwill is spent, but its enemies do not forget you had it. That is
    // a judgement call and it is made in favour of the simpler rule: expulsion is handled on the
    // allegiance side, and reputation is a record of what you did.
    const reaction = key === npcFac ? Number(row[npcFac] ?? REACTION_MAX) : Number(row[key] ?? 0);
    const w = Math.max(-1, Math.min(1, reaction / REACTION_MAX));
    const r = Math.max(-1, Math.min(1, rep / REP_FULL));
    // A faction this NPC is INDIFFERENT to (reaction 0) still counts toward the weight, because
    // it is part of the record and its neutrality is information: doing a great deal of work
    // nobody here minds is what dilutes the work they do mind.
    weight += Math.abs(r);
    const v = w * r;
    x += v;
    if (v) parts.push([key, Math.round(REPUTE_MOD * v * 100) / 100, rep, reaction]);
  }
  const total = weight > 0 ? REPUTE_MOD * (x / weight) : 0;
  return { total, parts, weighted_sum: x, weight };
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
 * RI-DLG04 §B **minus the base and minus W1-07's race/upbringing pre-term**: everything about
 * this meeting that a character can MOVE. Split out of `derivedDisposition` — same lines, same
 * order, same arithmetic — so that the quest-offer gate can lay these terms on top of
 * `character/reaction.js`'s race arithmetic without either module reimplementing the other.
 *
 * This split is load-bearing, not tidiness. `race-reactions.json` §repair_paths names the
 * faction term as the one path that pays off a -40 race row —
 * *"Deep-Kin rank 6 against a Deep-Kin NPC is +48, which fully covers a Dunmer's -40"* — and a
 * quest gate that applies the race term without the terms that repair it is a gate that
 * differentiates **by subtraction**: real difference, no route through it.
 *
 * @returns {{total:number, terms:Array, faction:object}}
 */
export function movableTerms(npc, player, ctx = {}) {
  const G = ctx.gmst;
  const reactions = ctx.factionReactions || null;
  const terms = [];
  let x = 0;

  const crimeMod = Number(npc.crimeDispositionModifier ?? 0);
  if (crimeMod) { x += crimeMod; terms.push(['crimeDispositionModifier', crimeMod]); }

  if (npc.race && player.race && npc.race === player.race) { x += G.fDispRaceMod; terms.push(['fDispRaceMod', G.fDispRaceMod]); }

  const pers = G.fDispPersonalityMult * (Number(player.Personality || 0) - G.fDispPersonalityBase);
  x += pers; terms.push(['personality', pers]);

  const ft = factionTerm(npc, player, reactions);
  const fac = (G.fDispFactionRankMult * ft.rank + G.fDispFactionRankBase) * G.fDispFactionMod * ft.reaction;
  x += fac; terms.push(['faction', fac]);

  // W1-19 round 2. The reputation channel — see `reputeTerm` above for why it exists and what
  // the argmin it replaces did to the main quest. It is reported as its own term rather than
  // folded into `faction`, so that `explainDisposition()` and every probe can still see the
  // transcribed §B number on its own line.
  const rep = reputeTerm(npc, player, reactions);
  if (rep.total) { x += rep.total; terms.push(['repute', Math.round(rep.total * 100) / 100]); }

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

  return { total: x, terms, faction: ft, repute: rep };
}

/**
 * RI-DLG04 §B — derivedDisposition. Returns clamp(trunc(x), 0, 100).
 *
 * `explain` carries every term so the harness can show a critic why a number is what it is,
 * which is the difference between a disposition system and a disposition number.
 */
export function derivedDisposition(npc, player, ctx = {}) {
  const rr = ctx.raceReactions || null;

  const rt = raceTerm(npc, player, rr);
  const terms = [];
  let x = Number(npc.baseDisposition ?? npc.disposition ?? 40);
  terms.push(['base', x]);
  // W1-07's pre-term, applied before every other term exactly as race-reactions.json declares.
  if (rt.race) { x += rt.race; terms.push(['race_reaction', rt.race]); }
  if (rt.upbringing) { x += rt.upbringing; terms.push(['upbringing', rt.upbringing]); }

  const mv = movableTerms(npc, player, ctx);
  x += mv.total;
  for (const t of mv.terms) terms.push(t);
  const ft = mv.faction;

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
