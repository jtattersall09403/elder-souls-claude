// Ownership, theft, trespass and the fence economy — RI-STL02 §1 §2 §4 §6.
//
// *"Morrowind's greatest quiet achievement is that every object in the world belongs to
// somebody ... the difference between a room full of props and a room full of SOMEONE'S THINGS
// is one field on every object and one line of checking code, and almost no game has ever paid
// for it."*
//
// The failure this module is written against is RI-STL02's first How-we-lose: *"Ownership is
// declared and never read."* So `take()` below is the only take-verb in the piece, it reads
// `owner` on every call, and it cannot return an item without deciding what taking it was.
'use strict';

export const SCOPES = ['personal', 'shared', 'public', null];

/**
 * Is taking this object theft? RI-STL02 §1's scope table, and the answer depends on `observed`
 * only for the `public` scope — a personal possession is theft whether or not anyone saw.
 */
export function isTheft(obj, { observed, factionRanks = {}, livesHere = false }) {
  if (!('owner' in obj)) throw new Error(`isTheft: object ${obj.instance || obj.id} carries no owner FIELD. RI-STL02 requires the key on 100% of takeable objects, even when its value is null.`);
  if (obj.owner === null) return { theft: false, scope: null, why: 'unowned' };
  switch (obj.owner_scope) {
    case 'personal': return { theft: true, scope: 'personal', why: "one NPC's possession" };
    case 'shared': {
      const f = /^faction:(.+)$/.exec(obj.owner);
      if (f && (factionRanks[f[1]] || 0) >= 2) return { theft: false, scope: 'shared', why: `rank ${factionRanks[f[1]]} in ${f[1]}` };
      if (livesHere) return { theft: false, scope: 'shared', why: 'you live here' };
      return { theft: true, scope: 'shared', why: 'household or faction stock' };
    }
    case 'public': return observed
      ? { theft: true, scope: 'public', why: 'observed taking from a commons' }
      : { theft: false, scope: 'public', why: 'unobserved; petty, and generates no stolen_from' };
    default: throw new Error(`isTheft: unknown owner_scope ${JSON.stringify(obj.owner_scope)}`);
  }
}

/**
 * Take an object. Returns the whole consequence, including the CHALLENGE off-ramp for a cheap
 * item seen only by its owner — the case that keeps a misplaced hand from becoming a fine.
 */
export function take(data, obj, ctx) {
  const t = isTheft(obj, ctx);
  const out = { taken: true, theft: t.theft, scope: t.scope, why: t.why, stolen_from: null, crime: null, challenge: false, disposition_delta: 0, put_back_window_s: 0 };
  if (!t.theft) return out;

  out.stolen_from = obj.owner;
  const onlyOwnerSaw = ctx.observedBy && ctx.observedBy.length === 1 && ctx.observedBy[0] === obj.owner;
  if (ctx.observed && onlyOwnerSaw && obj.value_g < 10) {
    out.challenge = true;
    out.put_back_window_s = data.theft_act.cases.find((c) => c.situation.startsWith('taken, observed only by the owner')).put_back_window_s;
    return out;                                   // CHALLENGE, not CRIME. They tell you to put it back.
  }
  if (ctx.observed) {
    out.crime = obj.value_g < 25 ? 'theft_petty' : 'theft';
    out.disposition_delta = -0.5 * obj.value_g;   // fDispStealing, RI-DLG04 §A, a real Morrowind GMST
    out.disposition_gmst = 'fDispStealing';
    return out;
  }
  // Unobserved: no bounty, no disposition change — but the owner notices, later, at value >= 25.
  out.owner_notices = obj.value_g >= data.theft_act.cases[0].owner_notices_at_value_g;
  out.topic_added = out.owner_notices ? data.theft_act.cases[0].topic_added : null;
  return out;
}

/** Trespass: a class lookup and a contextWeight. It is NOT a crime and generates NO bounty. */
export function trespass(data, zone, { factionRanks = {}, invitedByQuest = false, isArgonian = false, rootkeeperDisposition = 0, shopOpen = true }) {
  const cls = data.trespass.classes.find((c) => c.id === zone.class);
  if (!cls) throw new Error(`trespass: unknown zone class ${JSON.stringify(zone.class)}`);
  let trespassing;
  switch (cls.id) {
    case 'shop_open': trespassing = false; break;
    case 'shop_closed': trespassing = !shopOpen; break;
    case 'dwelling': trespassing = !invitedByQuest; break;
    case 'faction_interior': trespassing = (factionRanks[zone.faction] || 0) < 1; break;
    case 'sapwell_precinct': trespassing = !isArgonian && rootkeeperDisposition < 60; break;
    default: trespassing = true;
  }
  return {
    trespassing,
    zone_class: cls.id,
    context_weight: trespassing ? cls.context_weight : 0,
    escalation: trespassing ? cls.escalation : null,
    alarm_on_sight: trespassing && cls.escalation === 'ALARM on sight, no CHALLENGE',
    bounty_now: 0,
    refusal_hours: cls.refusal_hours || 0,
    note: 'Being inside a trespass zone is not itself a crime and generates no bounty. It generates suspicion; the crime is what a witness reports.',
  };
}

// ---- fencing -------------------------------------------------------------------------------

/**
 * Will this buyer take the item? The refusal is the whole reason fences exist, and it must be
 * BY NAME — a merchant who silently greys out an item has not been told the world is inhabited.
 */
export function willBuy(data, buyer, item, world) {
  if (!item.stolen_from) return { buys: true };
  const ownerNpc = world.npcById ? world.npcById(item.stolen_from) : null;
  const ownerSettlement = ownerNpc ? ownerNpc.settlement : (/^settlement:(.+)$/.exec(item.stolen_from) || [])[1] || null;
  const ownerFaction = (/^faction:(.+)$/.exec(item.stolen_from) || [])[1] || (ownerNpc && ownerNpc.faction) || null;
  const name = (ownerNpc && ownerNpc.name) || item.stolen_from;

  if (ownerSettlement && ownerSettlement === buyer.settlement) {
    return { buys: false, reason: 'same_settlement', line: `That belongs to ${name}. I drink with ${name}. Take it elsewhere.` };
  }
  if (ownerFaction && ownerFaction === buyer.faction) {
    return { buys: false, reason: 'same_faction', line: `${name} and I answer to the same people. No.` };
  }
  const disp = world.dispositionBetween ? world.dispositionBetween(item.stolen_from, buyer.id) : 0;
  if (disp >= 60) {
    return { buys: false, reason: 'friend_of_the_owner', line: `${name} is a friend of mine. I will pretend I did not see that.` };
  }
  if (!buyer.is_fence) return { buys: false, reason: 'not_a_fence', line: 'I do not deal in other people\'s property.' };
  return { buys: true };
}

/** price = 0.35 x value_g x mercantileTerm x fenceGreed. Unique items are 0.20x, once. */
export function fencePrice(data, fence, item, mercantileTerm) {
  const f = data.fences;
  const rate = item.unique ? f.unique_items.rate : f.base_rate;
  const price = rate * item.value_g * mercantileTerm * (item.unique ? 1.0 : fence.greed);
  return {
    price_g: Math.round(price),
    multiplier: price / item.value_g,
    unique: !!item.unique,
    delayed_bounty: item.unique ? { g: Math.round(f.unique_items.delayed_bounty_multiplier * item.value_g), in_days: f.unique_items.delay_days, settlement: item.stolen_settlement || null } : null,
    clears_stolen_from: true,
    laundered_from: item.stolen_from,
  };
}

/**
 * RI-PRG05's mercantileTerm. The item's own worked case pins the top: at Mercantile 100 the
 * best fence must pay in [0.58, 0.62] x value.  0.35 x 1.71 x 1.02 = 0.6105.
 */
export function mercantileTerm(mercantile) { return 1.00 + 0.0071 * mercantile; }
