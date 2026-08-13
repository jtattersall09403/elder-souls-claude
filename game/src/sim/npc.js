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
    // ---- W1-04: the day. -------------------------------------------------------------------
    // The record's `schedule` was written down by every builder that touched an NPC file and
    // read by nothing — `makeNPC` did not even copy the field. Copying it is the smaller half;
    // `stepSchedule()` below is the half that makes a person go home.
    schedule: normaliseSchedule(spec.schedule),
    // ---- W1-GIVER-PRESENCE: the street. ------------------------------------------------------
    // GAP-W1-quest-givers-not-in-the-world. A quest giver stands OUTSIDE, at a post derived from
    // a real building's door in their own town (`tools/world/build-giver-posts.mjs`). That is a
    // third kind of place, and the schedule model only had two: a named cell, or `null`.
    //
    // `null` already meant "present wherever the player is", which is right for a scenario NPC a
    // state file put in the room by hand and wrong for somebody standing in a market square —
    // without this field a posted person would be visible inside every locked cellar in the
    // province. So `post` is what turns `at: null` from *everywhere* into *outdoors*, and it
    // changes nothing for the 336 records that do not carry one.
    post: spec.post || null,
    home_interior: spec.home_interior || spec.interior || null,
    work_interior: spec.work_interior || spec.interior || null,
    owns_zones: (spec.owns_zones || []).slice(),
    // Where this person IS, right now, according to the clock. Distinct from `interior`, which
    // is where their record says they live: `at` is the answer to "where is she at 3 a.m.".
    at: spec.interior || null,
    activity: null,
    // W1-04 r2. Where this person is WALKING to, and how far they have walked getting there.
    // Round 1 had neither, which is why `stepSchedule`'s docstring could claim "they walk to the
    // slot's anchor" while 0 of 24 people in Thorn moved a millimetre across a whole day.
    goal: [Number(spec.pos ? spec.pos[0] : 0), Number(spec.pos ? spec.pos[1] : 0), Number(spec.pos ? spec.pos[2] : 0)],
    hasGoal: false,
    walked_m: 0,
    // False when the person is in a different cell from the player. A person who is at home
    // while you are in the shop is not standing invisibly in the shop.
    present: true,
    _slot: -1,
  };
}

/** "HH:MM" -> hours as a float. Refuses anything else rather than silently reading 0. */
function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s));
  if (!m) throw new Error(`schedule: ${JSON.stringify(s)} is not "HH:MM"`);
  const h = Number(m[1]) + Number(m[2]) / 60;
  if (!(h >= 0 && h <= 24)) throw new Error(`schedule: ${JSON.stringify(s)} is out of range`);
  return h;
}

/**
 * Turn a record's `[{from,to,at}]` into hour floats once, at spawn, so the step does no parsing
 * and no allocation. A slot that wraps midnight (22:00 -> 04:00) keeps `to < from` and is matched
 * by the OR branch in `slotAt`.
 */
export function normaliseSchedule(rows) {
  if (!rows || !rows.length) return [];
  return rows.map((r) => ({
    from: parseHM(r.from), to: parseHM(r.to), at: r.at || null, activity: r.activity || null,
  }));
}

/** Which slot covers this hour. -1 if the day has a hole in it, which is a data defect. */
export function slotAt(schedule, hour) {
  for (let i = 0; i < schedule.length; i++) {
    const s = schedule[i];
    if (s.from <= s.to ? (hour >= s.from && hour < s.to) : (hour >= s.from || hour < s.to)) return i;
  }
  return -1;
}

/** How fast a person crosses a room. A walk, not a march: 1.35 m/s at 60 Hz. */
const WALK_MPS = 1.35;
const WALK_PER_FRAME = WALK_MPS / 60;

/**
 * WHERE THIS SLOT PUTS THEM. The anchor a person stands at while a schedule slot is live.
 *
 * Three frames of reference, and they are not interchangeable — mixing them is what put the
 * population of every town in a heap at the world origin once already (W1-GIVER-PRESENCE
 * defect 2), so each is derived from the field that actually describes it:
 *
 *   * a named cell   -> INTERIOR-LOCAL, inside that interior's own `bounds_m`;
 *   * `at: null` + a post -> WORLD, at the authored outdoor station;
 *   * `at: null`, no post -> a scenario NPC a state file placed by hand. Not moved.
 *
 * The `activity` is part of the hash, which is what makes a person at work stand somewhere
 * different from the same person at home in the same room: a factor behind her counter at ten
 * and by her hearth at eight is the difference between a schedule and a list of rooms.
 */
function anchorFor(sim, n, at, activity) {
  if (at === null) {
    if (n.post && Array.isArray(n.post.pos)) return n.post.pos;
    return null;
  }
  const S = sim.settlements;
  const d = S ? S.interior(at) : null;
  if (!d || !d.bounds_m) return null;
  const h = hashStr(`${n.eid}|${at}|${activity || ''}`);
  const bx = d.bounds_m.x, bz = d.bounds_m.z;
  // Inset by 1.2 m so nobody stands in a wall, and quantised to a centimetre so the anchor is a
  // stable number a probe can compare across runs.
  const ix = Math.max(0, (bx[1] - bx[0]) / 2 - 1.2);
  const iz = Math.max(0, (bz[1] - bz[0]) / 2 - 1.2);
  const cx = (bx[0] + bx[1]) / 2, cz = (bz[0] + bz[1]) / 2;
  const fx = ((h % 2000) / 1000) - 1;
  const fz = (((h >>> 11) % 2000) / 1000) - 1;
  let x=cx+fx*ix;
  // Keep a human-width navigation/sight corridor through the centre of generated rooms. The
  // prior unconstrained hash regularly placed several inhabitants directly in the doorway and
  // third-person camera arm; this is deterministic layout hygiene, not a capture exception.
  const corridor=Math.min(1.45,ix*.48);
  if(corridor>.35&&Math.abs(x-cx)<corridor)x=cx+(fx<0?-1:1)*corridor;
  return [
    Math.round(x * 100) / 100,
    d.bounds_m.y ? d.bounds_m.y[0] : 0,
    Math.round((cz + fz * iz) * 100) / 100,
  ];
}

/** FNV-1a, the same hash the Engine and render/interior.js use, so all three agree. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * THE CONSUMER. One fixed step of everybody's day.
 *
 * RI-WLD08's whole claim is that people go home at night, and the way this build failed it was
 * the way eleven other subsystems failed RI-MTH07: the field was declared on 5 of 76 records and
 * read by nothing at all. This reads it, on the live step, every frame.
 *
 * ROUND 2, AND THE DOCSTRING IS WHY. This comment used to claim the function changed three
 * things — `at`, `present` and "`pos` (they walk to the slot's anchor)" — and it never touched
 * `pos` at all. Measured in Thorn: 9 of 24 people changed cell across the day and **0 of 24
 * moved**. Positions were assigned once, in `populateSettlement()`, from whichever slot happened
 * to be live at spawn, and were never re-derived; a factor whose 19:00 slot is the tavern kept
 * the offset computed inside her house. The ledger said she went out. Her body never did.
 *
 * So `pos` moves now, and it moves the way a person moves:
 *
 *   * a slot that changes the CELL snaps, because you cannot watch somebody walk out of a room
 *     you are not standing in, and the two cells are different coordinate frames anyway;
 *   * a slot that keeps the cell and changes the anchor WALKS, at 1.35 m/s, so a person going
 *     from her bench to her hearth crosses the floor over about four seconds and a probe
 *     sampling mid-transit catches her between the two.
 *
 * `walked_m` accumulates, so "does anybody move" is a number rather than an impression.
 *
 * Deterministic, allocation-free, no clock and no draws — it runs under the armed sim guard.
 */
export function stepSchedule(sim, n, bus) {
  if (!n.schedule.length) return;
  // A person may be built by `makeNPC` OR rehydrated inline by `save/state.js` — two
  // construction paths for one object, which is AGENT-PROTOCOL failure mode 1 and is exactly
  // how this line came to be needed: the load path did not copy `goal`, and the first write to
  // it threw INSIDE the fixed step, which kills every stepping probe in the project (RULES.md
  // rule 15's reasoning). The save path is fixed; this makes a third path harmless too.
  if (!n.goal) { n.goal = [n.pos[0], n.pos[1], n.pos[2]]; n.hasGoal = false; n.walked_m = n.walked_m || 0; }
  const i = slotAt(n.schedule, sim.env.timeOfDay);
  if (i < 0) return;
  const s = n.schedule[i];
  if (i !== n._slot) {
    n._slot = i;
    const from = n.at;
    n.at = s.at;
    n.activity = s.activity;
    // The destination this slot implies, and how they get to it.
    const goal = anchorFor(sim, n, s.at, s.activity);
    if (goal) {
      n.goal[0] = goal[0]; n.goal[1] = goal[1]; n.goal[2] = goal[2];
      n.hasGoal = true;
      if (from !== s.at) {
        // A different cell is a different frame. Snap, and count nothing as walked.
        n.pos[0] = goal[0]; n.pos[1] = goal[1]; n.pos[2] = goal[2];
      }
      n.homeYaw = n.post && s.at === null && n.post.yaw != null ? Number(n.post.yaw) : n.homeYaw;
    } else {
      n.hasGoal = false;
    }
    if (bus && from !== s.at) {
      const ev = bus.emit(sim.frame, 'npc_schedule');
      ev.npc = n.eid; ev.from = from; ev.to = s.at; ev.activity = s.activity;
      ev.hour = Math.round(sim.env.timeOfDay * 100) / 100;
    }
  }
  // THE WALK. Same cell, different spot: cross the floor rather than teleport across it.
  if (n.hasGoal) {
    const dx = n.goal[0] - n.pos[0], dz = n.goal[2] - n.pos[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.05) {
      const k = d <= WALK_PER_FRAME ? 1 : WALK_PER_FRAME / d;
      n.pos[0] += dx * k; n.pos[2] += dz * k;
      n.pos[1] = n.goal[1];
      n.walked_m += d * k;
    } else {
      n.hasGoal = false;
    }
  }
  // Presence. `sim.env.interior` is the cell the player is standing in; a person whose day has
  // them somewhere else is not in the room with you, and `visible` is what the renderer and
  // every perception cast read.
  // W1-GIVER-PRESENCE. Three cases, not two. `at` names a cell -> you are in that cell. `at` is
  // null and the person has a POST -> they are outdoors, so they are in the world when the player
  // is too and not otherwise. `at` is null and they have no post -> the old meaning, kept
  // verbatim: a scenario NPC a state file placed by hand is wherever the scene is.
  // A post with a `settlement` is a spot on that town's street; a post with a `site` is a named
  // place that is not a town at all (the hollow above the sap-line), and the only thing that ever
  // spawns one of those is the state file that names the site — so it keeps the old meaning.
  const here = n.at !== null ? n.at === sim.env.interior
    : (n.post && n.post.settlement ? sim.env.interior === null : true);
  if (here !== n.present) {
    n.present = here;
    n.visible = here;
    if (bus) { const ev = bus.emit(sim.frame, 'npc_presence'); ev.npc = n.eid; ev.present = here; ev.at = n.at; ev.cell = sim.env.interior; }
  }
}

/** One fixed step for every person in the world. No draws, no allocation. */
export function stepNPCs(sim, bus) {
  const p = sim.player;
  const list = sim.npcs;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    // W1-04: the day, before the facing. Where a person IS has to be settled before we ask
    // which way they are looking, or a person who has just gone home turns to face you through
    // a wall for one frame and the trace records it.
    stepSchedule(sim, n, bus);
    // Somebody who is not in this cell does not turn, does not notice and does not loiter.
    if (!n.present) { n.noticing = false; n.loiter_frames = 0; continue; }
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
