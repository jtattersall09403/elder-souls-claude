// People, as simulation objects.
//
// Owner: W1-07. The round-1 verdict on this piece: "`writ-house` — the piece's own interior
// — instantiates **0 entities**. There is no NPC whose disposition could be derived." That
// is what this file is for. An NPC here is not an enemy without a weapon: `sim.entities`
// holds combat entities built from statblocks in `game/data/combat/enemies/`, and an NPC
// has no statblock, no hitbox, no alert state and no archetype. It is a person standing in
// a room with a name, a race, an upbringing, a disposition and a list of topics, and it is
// the thing `getReaction()` and `getPriceQuote()` were computing numbers about with nobody
// in the world to attach them to.
//
// Behaviour is deliberately small and entirely deterministic — no PRNG draws, no clock:
//
//   * `stand`   — the Warden-Scribe behind her desk. Turns to face whoever is in front of
//                 her, at a fixed rate, and does nothing else. Bureaucrats do not pace.
//   * `attend`  — Jeeh-Ei in the hold. Faces the player, and follows them with her head
//                 only, which is what a sick person on a bunk does.
//   * `post`    — a guard at a gate. Faces down the street, turns to face the player inside
//                 her notice radius, and reports a loiter clock so RI-CHR02's law-factor
//                 table has something to be a factor OF.
//   * `tend`    — a stallholder behind a counter. Faces out.
//
// None of these is enemy AI. Enemy decision-making remains RI-AI01..07 / wave-1 piece W1-12
// and is not implemented here or anywhere else in this build.
'use strict';

const DEG = 180 / Math.PI;
export const NPC_BEHAVIOURS = new Set(['stand', 'attend', 'post', 'tend']);

/** Turn rates, degrees per second. A person is not a turret. */
const TURN_DPS = { stand: 90, attend: 60, post: 120, tend: 80 };

export function makeNPC(spec) {
  if (!spec || !spec.eid) throw new Error('makeNPC: an NPC needs an eid (its record id in game/data/npcs/*.json)');
  const behaviour = spec.behaviour || 'stand';
  if (!NPC_BEHAVIOURS.has(behaviour)) {
    throw new Error(`makeNPC('${spec.eid}'): behaviour '${behaviour}' is not one of ${[...NPC_BEHAVIOURS].join(', ')}. ` +
      'Refusing to spawn a person who would look like they had a routine and stand still.');
  }
  return {
    eid: String(spec.eid),
    kind: 'npc',
    name: spec.name || spec.eid,
    title: spec.title || null,
    race: spec.race || 'saxhleel',
    faction: spec.faction || null,
    reaction_group: spec.reaction_group || null,
    settlement: spec.settlement || null,
    interior: spec.interior || null,
    behaviour,
    // Disposition as WRITTEN DOWN — the base, before the race matrix moves it. The derived
    // number is computed live by Engine.npcDisposition() so that changing the player's race
    // changes what this person thinks without anything being re-spawned.
    base_disposition: spec.disposition === undefined ? 40 : spec.disposition,
    topics: (spec.topics || []).slice(),
    // The `a` row this person answers a topic with (character/converse.js infoFor).
    actor: spec.actor || null,
    // Hand-written lines on the record — the fallback when a person is outside the reaction
    // matrix and `greetings.json` therefore has no cell for them.
    lines: spec.lines || null,
    services: (spec.services || []).slice(),
    pos: [Number(spec.pos ? spec.pos[0] : 0), Number(spec.pos ? spec.pos[1] : 0), Number(spec.pos ? spec.pos[2] : 0)],
    homePos: [Number(spec.pos ? spec.pos[0] : 0), Number(spec.pos ? spec.pos[1] : 0), Number(spec.pos ? spec.pos[2] : 0)],
    yaw: Number(spec.yaw === undefined ? 180 : spec.yaw),
    homeYaw: Number(spec.yaw === undefined ? 180 : spec.yaw),
    height_scale: Number(spec.height_scale === undefined ? 1 : spec.height_scale),
    notice_radius_m: Number(spec.notice_radius_m === undefined ? 6 : spec.notice_radius_m),
    visible: spec.visible !== false,
    // `post` only. Frames the player has been standing inside the notice radius, which is
    // what RI-CHR02's guard tolerance is measured in.
    loiter_frames: 0,
    noticing: false,
    speaking: false,
  };
}

/** One fixed step for every person in the world. No draws, no allocation. */
export function stepNPCs(sim, bus) {
  const p = sim.player;
  const list = sim.npcs;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    const dx = p.pos[0] - n.pos[0], dz = p.pos[2] - n.pos[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    const near = d <= n.notice_radius_m;
    const want = near || n.speaking ? norm360(Math.atan2(dx, dz) * DEG) : n.homeYaw;
    const maxTurn = (TURN_DPS[n.behaviour] || 90) / 60;
    let t = norm180(want - n.yaw);
    if (t > maxTurn) t = maxTurn; else if (t < -maxTurn) t = -maxTurn;
    n.yaw = norm360(n.yaw + t);

    if (n.behaviour === 'post') {
      const wasNoticing = n.noticing;
      n.noticing = near;
      if (near) n.loiter_frames++; else n.loiter_frames = 0;
      if (near !== wasNoticing && bus) {
        const ev = bus.emit(sim.frame, 'npc_notice');
        ev.npc = n.eid; ev.noticing = near; ev.dist_m = Math.round(d * 1000) / 1000;
      }
    }
  }
}

function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }
function norm180(a) { a = norm360(a); return a > 180 ? a - 360 : a; }
