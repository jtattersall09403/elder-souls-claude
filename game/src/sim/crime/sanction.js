// Faction crime — RI-CRM02. Writs, jurisdictional legality, interception, and the AR-3 numbers.
//
// THE MORAG TONG PROBLEM and its answer, in one function: `honoursIn()`. An institution of
// sanctioned murder either trivialises the crime system or is not worth having, and the answer
// is that **legality is jurisdictional and partial** — no authority in Argonia holds everywhere,
// so no writ works everywhere. The assertion RI-CRM02 method 1 makes is that the 4x3 matrix this
// file computes contains no all-jurisdiction row, and `coverageMatrix()` below is that matrix.
//
// RI-CRM02 "How we lose" predicts the failure precisely: *"It happens by accretion, not by
// decision ... Nobody ever makes the decision to trivialise the crime system — it is trivialised
// by three reasonable patches."* So the matrix is DATA, and the assertion is a one-line check
// that can be re-run every wave.
'use strict';

export function authority(data, id) {
  const a = data.authorities.find((x) => x.id === id);
  if (!a) throw new Error(`unknown sanctioning authority ${JSON.stringify(id)}`);
  return a;
}

export function coverageMatrix(data) {
  const juris = ['imperial', 'settlement', 'interior'];
  const rows = data.authorities.map((a) => ({
    authority: a.id,
    imperial: a.honoured_in.includes('imperial'),
    settlement: a.honoured_in.includes('settlement'),
    interior: a.honoured_in.includes('interior'),
    covers_all: juris.every((j) => a.honoured_in.includes(j)),
  }));
  return { rows, universal: rows.filter((r) => r.covers_all).map((r) => r.authority), jurisdictions: juris };
}

/**
 * The five things a writ NEVER does (RI-CRM02 §2). This function returns a RESOLUTION for one
 * killing, and it is deliberately incapable of expressing "suppress the witness" — the witness
 * argument is not an input.
 */
export function resolveKilling(data, { writ, jurisdiction, victimIsTarget, victimRace, victimNamed, victimIsOfficial, targetYielded, yieldWitnessed }) {
  const out = {
    lawful: false, report_kind: 'unlawful', crime: null,
    witnesses_suppressed: false,               // never, by construction — there is no branch that sets it
    collateral: !victimIsTarget,
    faction_standing_lost: [],
    note: null,
  };
  out.crime = victimIsOfficial ? 'murder_official' : victimNamed ? 'murder_named' : 'murder_unnamed';

  if (!writ) return out;
  const a = authority(data, writ.authority);

  if (!victimIsTarget) {
    out.note = 'collateral. RI-CRM02 §2: a writ does not cover it, and the bounty lands on the frame it happens.';
    return out;
  }
  // Morag Tong: legally worthless everywhere in Argonia. Social weight with RG-DRES only.
  if (a.id === 'morag-tong') {
    out.note = 'a Morag Tong writ carries no legal weight in Argonia; only RG-DRES and Dunmer witnesses decline to report, and only for Dunmer targets';
    out.social_only = true;
    out.social_applies = victimRace === 'dunmer';
    return out;
  }
  if (!a.honoured_in.includes(jurisdiction)) {
    out.note = `${a.instrument} is void in the ${jurisdiction} jurisdiction (RI-CRM02 §2: it does not travel)`;
    return out;
  }
  out.lawful = true;
  out.report_kind = 'lawful';
  if (targetYielded && yieldWitnessed) {
    out.faction_standing_lost = data.mid_fight.kill_yielded_target.faction_standing_lost.slice();
    out.note = 'lawful, and it cost standing with three factions: the authority asked for a death and not for a performance';
  }
  return out;
}

/** Does a RG-DRES / Dunmer witness decline to report this? (RI-CRM02 §6, the Tong row.) */
export function witnessDeclinesToReport(data, { playerStandings, witnessGroup, crimeKey, victimRace }) {
  for (const row of data.interception) {
    if (row.standing === 'morag-tong:contact' && playerStandings['morag-tong']) {
      const murder = crimeKey === 'murder_named' || crimeKey === 'murder_unnamed' || crimeKey === 'murder_official';
      if ((witnessGroup === 'RG-DRES' || witnessGroup === 'dunmer') && murder && victimRace === 'dunmer') {
        return { declines: true, why: row.effect };
      }
    }
  }
  return { declines: false };
}

/**
 * The Wet Ledger's product: it buys the REPORT CHAIN. Four interceptions, then a refusal, and
 * every interception creates a favour the Ledger calls in at a time it chooses. *"A silence that
 * costs nothing is not a system, it is a cheat code with a faction attached."*
 */
export function interception(data, { standings, settlement, quoteG, used }) {
  const row = data.interception.find((r) => r.standing === 'wet-ledger>=3');
  const rank = standings['wet-ledger'] || 0;
  if (rank < 3) return { intercepts: false, why: 'Ledger rank below 3' };
  if (!row.where.includes(settlement)) return { intercepts: false, why: `the Ledger's reach is ${row.where.join(' and ')}, not ${settlement}` };
  if (quoteG > row.bounty_cap) return { intercepts: false, why: `${quoteG} g exceeds the Ledger's ${row.bounty_cap} g ceiling` };
  if (used >= row.uses) return { intercepts: false, refused: true, why: 'the fifth is refused', line: "We bought your silence four times. The fifth would be a partnership, and we are not partners." };
  return { intercepts: true, favour_owed: true, uses_left: row.uses - used - 1 };
}

/** RI-CRM02 §4. Exhaustive: no reachable state holds three sanctioning authorities. */
export function canJoin(data, standings, factionId, rank) {
  const blocks = [];
  for (const row of data.exclusivity) {
    const [holdF, holdR] = parseStanding(row.hold);
    const have = standings[holdF] || 0;
    if (holdR !== null && have < holdR) continue;
    if (holdR === null && !have) continue;
    for (const c of row.cannot_hold) {
      const [f, r] = parseStanding(c);
      if (f === factionId && (r === null || rank >= r)) blocks.push({ because: row.hold, why: row.why });
    }
  }
  // Symmetric: joining X when X's own row forbids what you already hold.
  for (const row of data.exclusivity) {
    const [f, r] = parseStanding(row.hold);
    if (f !== factionId) continue;
    if (r !== null && rank < r) continue;
    for (const c of row.cannot_hold) {
      const [cf, cr] = parseStanding(c);
      const have = standings[cf] || 0;
      if (have && (cr === null || have >= cr)) blocks.push({ because: c, why: row.why });
    }
  }
  return { allowed: blocks.length === 0, blocked_by: blocks };
}

function parseStanding(s) {
  const m = /^([a-z-]+)(?:>=(\d+))?$/.exec(s);
  if (!m) return [s, null];
  return [m[1], m[2] === undefined ? null : Number(m[2])];
}

/**
 * The standing key the `faction_law_factor` table is indexed by.
 *
 * The ORDER is the design and not an accident: a player can hold two standings at once, and the
 * guard reads the one that changes their behaviour most. Declared allegiances to the Empire come
 * first (they buy the most rope), then the interior kin (they cost the most), then the trades.
 *
 * W1-FACTIONS round 3, AR-3. Three joinable factions were missing entirely. `the_imperial_assize`
 * — eighteen quests ending with a court's seal in the player's hand — was in no branch here and
 * no entry of `standing_ids`, so the whole line moved no guard in the province by one point. So
 * were `the_ixtu_vakh` and `the_dockhands`, both joinable through the mainline. Only 2 of the 5
 * joinable factions reached this function at all.
 *
 * `tools/check-data.mjs` now asserts BOTH directions — every row of the table must be returnable
 * by this function, and every faction with a `joins_faction` anywhere in the quest book must have
 * a `standing_ids` entry — so the next faction to ship cannot quietly miss the crossing.
 */
export function standingKey(standings) {
  if ((standings['ninth-cohort'] || 0) >= 4) return 'ninth-cohort:4+';
  if ((standings['ninth-cohort'] || 0) >= 1) return 'ninth-cohort:1-3';
  if ((standings['imperial-assize'] || 0) >= 4) return 'imperial-assize:4+';
  if ((standings['imperial-assize'] || 0) >= 1) return 'imperial-assize:1-3';
  if ((standings['xul-aneekh'] || 0) >= 4) return 'xul-aneekh:4+';
  if ((standings['xul-aneekh'] || 0) >= 1) return 'xul-aneekh:1-3';
  if ((standings['ixtu-vakh'] || 0) >= 4) return 'ixtu-vakh:4+';
  if ((standings['ixtu-vakh'] || 0) >= 1) return 'ixtu-vakh:1-3';
  // W1-20. The Rootkeepers and the Drowned Court, added when they became joinable at all.
  // They sit here — after the interior kin, before the trades — because both are read by a
  // guard as a religious standing rather than as a trade, and because a player who is both a
  // keeper and a Deep-Kin is being watched for the Deep-Kin. The Rootkeepers come first of the
  // two: a keeper's habit is recognised everywhere in the province and an undertaker's is
  // recognised at Soulrest.
  if ((standings['rootkeepers'] || 0) >= 4) return 'rootkeepers:4+';
  if ((standings['rootkeepers'] || 0) >= 1) return 'rootkeepers:1-3';
  if ((standings['drowned-court'] || 0) >= 4) return 'drowned-court:4+';
  if ((standings['drowned-court'] || 0) >= 1) return 'drowned-court:1-3';
  if ((standings['wet-ledger'] || 0) >= 3) return 'wet-ledger:3+';
  if ((standings['wet-ledger'] || 0) >= 1) return 'wet-ledger:1-2';
  if (standings['dockhands']) return 'dockhands:any';
  if (standings['sap-cutters']) return 'sap-cutters:any';
  if (standings['morag-tong']) return 'morag-tong:known';
  if (standings['ku-vastei']) return 'ku-vastei:petitioner';
  return 'none';
}

/**
 * THE AR-3 CROSSING, and the one number it rests on.
 *
 * A faction rank shifts the disposition threshold at which an interior war-brood camp opens
 * hostile. Nothing about the enemies changes — same archetype id, same statblock, same moveset,
 * same frames. RI-CRM02 "How we lose" is explicit that changing the enemies instead would be an
 * AR-1 failure: *"the legal lever is ONLY hostile_below_disposition and the disposition the
 * player carries."* This function returns a number that is added to the player's disposition,
 * and it has no other output.
 */
export function warbroodDispositionShift(data, standings) {
  const row = data.faction_law_factor.rows.find((r) => r.standing === standingKey(standings));
  return row ? row.warbrood_disposition_shift : 0;
}

/**
 * THE SECOND AR-3 CROSSING, and this one starts in the crime system: an Imperial BOUNTY raises
 * Deep-Kin regard. RI-CRM01 §7's Xul-Aneekh row — *"Being wanted by the Empire is a reference."*
 * A crime committed in Gideon changes whether a camp in the Stone Forest opens hostile.
 */
export function deepKinRegard(justiceData, imperialBounty) {
  const row = justiceData.faction_reactions.find((r) => r.faction === 'xul-aneekh');
  const steps = Math.floor(imperialBounty / row.disposition_step_gold);
  return Math.min(row.disposition_cap, steps * row.disposition_step);
}

/** RI-CRM01 §7's other three tracking factions. Five of nine do not track Imperial crime at all. */
export function factionConsequences(justiceData, { imperialBounty, deathFlagsInSettlement, theftFromLedger, killedLegionSoldier }) {
  const out = [];
  for (const r of justiceData.faction_reactions) {
    if (r.faction === 'xul-aneekh') { const d = deepKinRegard(justiceData, imperialBounty); if (d > 0) out.push({ faction: r.faction, consequence: r.consequence, disposition_delta: d, flag: r.flag }); continue; }
    if (r.reacts_to === 'any imperial bounty' && imperialBounty >= r.threshold) out.push({ faction: r.faction, consequence: r.consequence, flag: r.flag, line: r.line || null });
    if (r.reacts_to === 'murder of a Legion soldier' && killedLegionSoldier) out.push({ faction: r.faction, consequence: r.consequence, flag: r.flag });
    if (r.reacts_to.startsWith('theft from a Ledger') && theftFromLedger) out.push({ faction: r.faction, consequence: r.consequence, flag: r.flag });
    if (r.reacts_to.startsWith('death_flag') && deathFlagsInSettlement >= r.threshold) out.push({ faction: r.faction, consequence: r.consequence, flag: r.flag });
  }
  return out;
}
