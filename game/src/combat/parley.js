// Parley — the non-lethal exit from a fight. ARBITRATION §1 as amended (drift ID-01) and
// seam S13 as amended.
//
// The rule this implements, verbatim: "MORROWIND owns the requirement that a fight against
// anything capable of speech has a NON-LETHAL EXIT: a distinct, fast, diegetic parley
// interaction (yield / offer gold / invoke a faction / speak a name you learned) available
// during combat, gated on disposition, reputation, faction rank or knowledge. It resolves the
// fight without a corpse. Beasts and mindless things are exempt. A humanoid faction NPC with
// no parley path is a DEFECT."
//
// AR-1 discipline, because this is the single most likely place for Morrowind to leak into
// the fight:
//   * no menu and no pause — S14 says the inventory does not pause the world during combat,
//     and a topic list would be worse;
//   * no dice — S1 bans them inside the fight, so every ground below is a DETERMINISTIC
//     threshold test against state the player accumulated OUTSIDE the fight;
//   * no instant anything — the parley is a committed animated action with startup, active
//     and recovery frames, and getting hit during it costs you exactly what getting hit
//     during a swing costs you.
//
// AR-3: this is W1-09's seam crossing. A topic learned from a book decides, at 60 Hz, inside
// the fight, whether a hostile can be resolved without killing it.
'use strict';

import { topicsInclude } from '../core/topics.js';

import { bearingDeg, angleDelta } from './geometry.js';

/**
 * Can a parley even be STARTED against this target right now? Returns
 * {ok:true} | {ok:false, reason} — the reason is emitted so a dropped input is never silent.
 */
export function parleyAvailable(player, target, move, frame) {
  if (!target) return { ok: false, reason: 'no_target' };
  if (target.dead) return { ok: false, reason: 'target_dead' };
  if (target.yielded) return { ok: false, reason: 'already_yielded' };
  if (!target.parley) return { ok: false, reason: 'exempt_beast_or_mindless' };
  if (frame < (target.parleyRefusedUntil || 0)) return { ok: false, reason: 'refused_cooldown' };
  const dx = target.pos[0] - player.pos[0], dz = target.pos[2] - player.pos[2];
  const d = Math.hypot(dx, dz);
  if (d > move.range_m) return { ok: false, reason: 'out_of_range' };
  const toTarget = bearingDeg(dx, dz);
  if (Math.abs(angleDelta(player.yaw, toTarget)) > move.arc_deg) return { ok: false, reason: 'not_facing_target' };
  const toPlayer = bearingDeg(-dx, -dz);
  if (Math.abs(angleDelta(target.yaw, toPlayer)) > move.target_must_face_back_deg) {
    return { ok: false, reason: 'target_not_facing_you' };
  }
  return { ok: true };
}

/**
 * Resolve the parley on its resolution frame. Deterministic; consults ONLY out-of-fight state.
 *
 * @param {object} world  {gold, dispositions, factions, topicsKnown, expelled}
 * @returns {{accepted:boolean, ground:string|null, tried:string[], detail:object}}
 */
export function resolveParley(player, target, world, data) {
  const G = data.grounds;
  const cfg = target.parley;
  const tried = [];
  const disposition = (world.dispositions && world.dispositions[cfg.npc_id]) ?? cfg.base_disposition ?? 0;
  const detail = { disposition, gold: world.gold, ground_results: {} };

  // Order matters and is strongest-first: a true name beats a purse.
  const order = ['NAME', 'FACTION', 'GOLD', 'YIELD'];
  for (const key of order) {
    if (!cfg.grounds || cfg.grounds.indexOf(G[key].id) < 0) continue;
    tried.push(G[key].id);
    const r = testGround(key, G[key], player, target, cfg, world, disposition);
    detail.ground_results[G[key].id] = r;
    if (r.pass) return { accepted: true, ground: G[key].id, tried, detail };
  }
  return { accepted: false, ground: null, tried, detail };
}

function testGround(key, def, player, target, cfg, world, disposition) {
  switch (key) {
    case 'NAME': {
      const topic = cfg.true_name_topic;
      if (!topic) return { pass: false, why: 'target declares no true_name_topic' };
      // Folded (core/topics.js): the parley's `true_name_topic` is authored in prose and the
      // AddTopic edges that put a topic into `topicsKnown` are authored as slugs, so an exact
      // indexOf made the NAME ground unwinnable for a player who had genuinely learned the name.
      const known = topicsInclude(world.topicsKnown, topic);
      return { pass: known, why: known ? `knows topic '${topic}'` : `does not know topic '${topic}'`, ignores_disposition: true };
    }
    case 'FACTION': {
      const fac = cfg.faction;
      if (!fac) return { pass: false, why: 'target declares no faction' };
      const rec = (world.factions || {})[fac];
      const rank = rec ? (rec.rank || 0) : 0;
      const expelled = rec ? !!rec.expelled : false;
      const need = cfg.rank_required || 1;
      if (expelled) return { pass: false, why: `expelled from ${fac}` };
      if (cfg.rival_faction && (world.factions || {})[cfg.rival_faction] && (world.factions[cfg.rival_faction].rank || 0) > 0) {
        return { pass: false, why: `holds rank in the rival faction ${cfg.rival_faction}` };
      }
      return { pass: rank >= need, why: `rank ${rank} vs required ${need} in ${fac}` };
    }
    case 'GOLD': {
      const price = cfg.gold_price || 0;
      const enough = (world.gold || 0) >= price;
      const liked = disposition >= 20;
      return { pass: enough && liked, why: `gold ${world.gold || 0} vs ${price}, disposition ${disposition} vs 20`, spends: enough && liked ? price : 0 };
    }
    case 'YIELD': {
      if (cfg.honour_bound) return { pass: false, why: 'honour_bound: will not accept a yield' };
      const frac = target.hp / target.hpMax;
      const hurt = frac <= 0.35;
      const liked = disposition >= 40;
      return { pass: hurt && liked, why: `enemy hp ${(frac * 100).toFixed(0)}% vs <=35%, disposition ${disposition} vs 40` };
    }
    default: return { pass: false, why: 'unknown ground' };
  }
}

/** Apply an accepted parley. The fight ends without a corpse; the world state moves. */
export function applyAccept(target, ground, world, detail) {
  target.yielded = true;
  target.state = 'YIELDED';
  target.aggro = false;
  target.move = null;
  target.hitboxActive = false;
  const spent = ground === 'gold' ? (detail.ground_results.gold && detail.ground_results.gold.spends) || 0 : 0;
  if (spent) world.gold -= spent;
  const fac = target.parley.faction;
  const out = { faction_delta: {}, gold_spent: spent, souls_awarded: 0 };
  if (fac) {
    out.faction_delta[fac] = +2;
    if (target.parley.rival_faction) out.faction_delta[target.parley.rival_faction] = -1;
  }
  return out;
}
