// AR-3: the seam crossing. What the Warden-Scribe wrote down decides, at 60 Hz, whether a
// fight starts at all.
//
// Owner: W1-07. Binding source: RI-CHR02 §4e (three mechanisms), method 8 (the assertion).
//
// THE DISCIPLINE, because this is the exact place the corpus says a well-meaning builder
// breaks AR-1: the ONLY levers this module touches are
//     * whether an encounter opens hostile,
//     * at what distance it latches,
//     * whether it offers a parley instead,
//     * what happens to the player on defeat (capture vs death).
// It never touches hp, poise, damage, reach, frame data, archetype, moveset or attack
// selection. Those come from game/data/combat/enemies/<statblock>.json, one file per
// statblock, loaded once, with no per-race field anywhere in the schema. "The Dres raiders
// are weaker against Dunmer" would be Morrowind reaching into the fight and an automatic
// AR-1 fail; this module could not express it if it wanted to.
'use strict';

import { derivedDisposition } from './reaction.js';
import { bearingDeg, angleDelta } from '../combat/geometry.js';

/** Distance at which a non-hostile raid party hails you and offers the purchase. */
export const HAIL_RANGE_M = 24.0;

/**
 * THE ENGAGEMENT CONSTANTS, and the reason they are one table rather than ten fields.
 *
 * Round-1's verdict: "Across all three 1,800-frame runs the player takes zero damage and the
 * party never closes: distance to the lead raider is frozen at 18.20 m from f900 to f1800.
 * After the Saxhleel AGGRO the six raiders sit in `REPOSITION` for 1,657 consecutive frames
 * ... 0 `attack_start` events; the net-throwers never throw a net."
 *
 * The cause was not this module: `game/src/combat/enemy.js` implements `hold_ground` (turn to
 * face, never move, never attack) and `scripted` (execute a scenario's action list). Enemy
 * DECISION-MAKING is RI-AI01..07 / wave-1 piece W1-12 and is correctly refused there. But an
 * encounter whose entire claim is "race decides whether this becomes a fight" is unmeasurable
 * if the fight cannot happen at all, so W1-07 owns the behaviour of ITS OWN encounter members
 * and nothing else: a raid party closes, swings, and throws nets.
 *
 * **The AR-1 discipline is unchanged and is what makes this legal.** Every number below is a
 * CONSTANT — it is not indexed by race, it cannot be indexed by race, and the same table runs
 * for a Saxhleel and a Khajiit. Race decides `opening`, `aggro_at_m`, `parley_offer` and
 * `on_player_defeat`; it does not decide how hard anybody hits, how fast they close, or which
 * move they pick. The statblock is `game/data/combat/enemies/inf_trash.json` for all ten races.
 */
export const ENGAGE = {
  advance_mps: 2.20,           // a jog under armour, not a sprint
  engage_range_m: 2.30,        // inside a chop's 2.4 m reach
  min_standoff_m: 1.45,        // and NOT closer: a body standing inside yours swings over you
  disengage_range_m: 2.80,     // hysteresis, so nobody vibrates on the boundary
  attack_cadence_f: 78,        // f@60 between one member's attacks; the roster rotates
  party_stagger_f: 26,         // f@60 offset per member, so six raiders are not one raider
  net_range_m: 9.0,
  net_cadence_f: 300,
  net_hold_f: 180,             // f@60 a landed net holds you
  net_hit_radius_m: 1.6,
  rotation: ['chop', 'thrust', 'combo_a', 'combo_b'],
};

export function encounterById(data, id) {
  const e = data.encounters.encounters.find((x) => x.id === id);
  if (!e) throw new Error(`unknown encounter: ${JSON.stringify(id)}`);
  return e;
}

/**
 * The behaviour this encounter will show THIS character. Pure — the audit tool calls it with
 * ten races and prints the table without touching a browser.
 */
export function openingFor(data, encounter, character) {
  if (encounter.race_behaviour) {
    const r = encounter.race_behaviour[character.race];
    if (!r) throw new Error(`encounter ${encounter.id} has no rule for race ${character.race}`);
    return { ...r, source: 'race_behaviour' };
  }
  // W1-POPULATION, added additively. The two rules below decide an opening from WHO THE PLAYER IS
  // — a race table, or a derived disposition. A slitherfang on the Rootway does neither: it is
  // hostile to everyone and there is nothing to negotiate with. Without a third rule this function
  // THROWS for any encounter that declares neither, and it is called once per encounter member per
  // frame from stepEncounters(), so a wilderness roster without this would kill the fixed step for
  // every probe in the project the first time the player walked near one.
  // Nothing here reads race, level, or elapsed time: the opening is a constant.
  if (encounter.behaviour_rule === 'always_hostile') {
    return {
      opening: 'hostile',
      aggro_at_m: encounter.aggro_at_m,
      net_behaviour: 'kill',
      parley_offer: false,
      on_player_defeat: 'death',
      source: 'always_hostile',
    };
  }
  if (encounter.behaviour_rule === 'hostile_below_disposition') {
    const d = derivedDisposition(data, {
      group: encounter.reaction_group, race: character.race, upbringing: character.upbringing,
      baseDisposition: 50, birthsign: character.birthsign,
    });
    const hostile = d.value < encounter.hostile_below_disposition;
    return {
      opening: hostile ? 'hostile' : 'neutral',
      aggro_at_m: hostile ? encounter.aggro_at_m : null,
      net_behaviour: 'kill',
      parley_offer: false,
      on_player_defeat: 'death',
      disposition: d.value,
      band: d.band,
      source: 'hostile_below_disposition',
    };
  }
  throw new Error(`encounter ${encounter.id} declares no behaviour rule`);
}

/**
 * One fixed step of encounter behaviour. Called from stepOnce AFTER the fight has run, so it
 * reads the post-physics positions the trace will report on this frame.
 *
 * Emits `enemy_state` on every alert-state transition (HARNESS.md §5 vocabulary) and
 * `parley_offer` when a non-hostile opening hails the player.
 */
export function stepEncounters(sim, combat, bus, data) {
  const ch = sim.character;
  if (!ch || !ch.race) return;
  const p = sim.player;
  // The net you are already in. It is a real restraint: locomotion is zero while it holds,
  // which is visible in the trace as `speed_mps: 0` and not as a string in an event field.
  if (sim.nettedUntil && sim.frame >= sim.nettedUntil) {
    sim.nettedUntil = 0;
    const ev = bus.emit(sim.frame, 'restrain_end'); ev.who = 'player'; ev.kind = 'net';
  }

  // ---- what a defeat actually IS -----------------------------------------------------------
  // Round 1: "`capture` and `kill` are strings in a trace event's `net_behaviour` field. There
  // is no capture, no net, no transport to Archon's holds, and no fight." A defeat now branches
  // the world: a `death` respawns you at a well with your tithe on the ground where you fell;
  // a `capture-transport-archon` does not kill you at all — it takes the writ, takes the purse,
  // and puts you somewhere else. Two different states, and a save can tell them apart.
  // A CAPTURE is what the nets are for, so it is reachable by being netted rather than only
  // by being killed. RI-CHR02 §4e: the Dres take Saxhleel and Naga alive because they are
  // worth more that way, which is the whole point of the two net-throwers in the party.
  // Three landed nets and you are not walking out of this.
  const pb0 = combat && combat.player;
  if (pb0 && !sim.encounterDefeatResolved && (sim.netsLanded || 0) >= 3) {
    const liveN = sim.entities.find((x) => x.encounterId && x.hp > 0);
    if (liveN) {
      const encN = encounterById(data, liveN.encounterId);
      const ruleN = openingFor(data, encN, ch);
      if (ruleN.net_behaviour === 'capture') {
        sim.encounterDefeatResolved = true;
        sim.netsLanded = 0;
        sim.captured = { by: liveN.encounterId, frame: sim.frame, destination: 'archon-hold', writ_confiscated: true, how: 'netted' };
        const ev = bus.emit(sim.frame, 'capture');
        ev.encounter = liveN.encounterId; ev.by = liveN.eid; ev.destination = 'archon-hold';
        ev.outcome = ruleN.on_player_defeat; ev.died = false; ev.how = 'three nets landed';
        ev.taken = ['stamped-writ', 'gold'];
        ev.because = `race=${ch.race}: this party sells people, and you are one of the kinds they sell`;
        sim.captureRequest = { encounter: liveN.encounterId };
      }
    }
  }

  const pb = combat && combat.player;
  if (pb && pb.hp <= 0 && !sim.encounterDefeatResolved) {
    const live = sim.entities.find((x) => x.encounterId && x.hp > 0);
    if (live) {
      sim.encounterDefeatResolved = true;
      const enc = encounterById(data, live.encounterId);
      const outcome = openingFor(data, enc, ch).on_player_defeat;
      if (outcome === 'capture-transport-archon') {
        pb.hp = Math.max(1, Math.round(pb.hpMax * 0.25));
        pb.dead = false; pb.state = 'IDLE'; pb.move = null;
        sim.captured = { by: live.encounterId, frame: sim.frame, destination: 'archon-hold', writ_confiscated: true };
        const ev = bus.emit(sim.frame, 'capture');
        ev.encounter = live.encounterId; ev.by = live.eid; ev.destination = 'archon-hold';
        ev.outcome = outcome; ev.died = false; ev.hp_after = pb.hp;
        ev.taken = ['stamped-writ', 'gold'];
        ev.because = `race=${ch.race}: this party sells people, and you are one of the kinds they sell`;
        sim.captureRequest = { encounter: live.encounterId };
      } else {
        const ev = bus.emit(sim.frame, 'death_flag');
        ev.who = 'player'; ev.encounter = live.encounterId; ev.outcome = outcome; ev.died = true;
        ev.because = `race=${ch.race}: this party is not selling, so this is the other thing`;
      }
    }
  }
  if (pb && pb.hp > 0) sim.encounterDefeatResolved = false;
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    if (!e.encounterId) continue;
    if (e.hp <= 0) continue;
    const enc = encounterById(data, e.encounterId);
    const rule = openingFor(data, enc, ch);
    const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    // ---- W1-12 ---------------------------------------------------------------------------
    // The latch below is `dist <= aggro_at_m` and nothing else: a bare circle, with no cone, no
    // line of sight, no light and no Sneak. RI-AI01 M1 fails a build outright for it — "FAIL if
    // the acquisition set is a circle: that is proximity aggro wearing a cone costume" — and M2
    // fails it again for jumping IDLE straight to AGGRO with no SUSPICIOUS. It is also the
    // reason nothing in this world can be sneaked past, which is RI-STL01's problem as much as
    // this piece's: two of the shipped circles are LARGER than the archetype's own eyes
    // (wl-slitherfang-* aggro at 20 m on a statblock that sees 16; wl-drowned-straggler at 16 m
    // on one that sees 14), so those enemies notice you from behind, through geometry, in the
    // dark, from beyond their own sight radius.
    //
    // The narrowest honest fix, and it is deliberately narrow. Only `always_hostile` — the
    // WILDERNESS roster, which is this piece's — is gated. W1-07's two AR-3 rules,
    // `race_behaviour` and `hostile_below_disposition`, are untouched: they are a different
    // question (does this party open hostile ON YOU) and re-deciding them here would move a
    // measurement that belongs to another piece. What is added is the cone and the sight line
    // the archetype already declares, so an enemy has to be able to SEE you before it decides
    // it has seen you. The radius itself is left exactly as the population data set it.
    const wild = rule.source === 'always_hostile';
    const perceives = !wild || (inSightCone(e, dx, dz) && e.percept_los !== false);
    if (rule.opening === 'hostile' && !e.encAggroed && dist <= rule.aggro_at_m && perceives) {
      e.encAggroed = true;
      const ctl = combat.enemies.get(e.eid);
      const body = combat.bodyOf(e.eid);
      if (ctl) { ctl.alert = 100; ctl.alertState = 'AGGRO'; }
      if (body) body.aggro = true;
      const prev = e.alertState;
      e.alert = 100; e.alertState = 'AGGRO';
      const ev = bus.emit(sim.frame, 'enemy_state');
      ev.eid = e.eid; ev.from = prev; ev.to = 'AGGRO'; ev.channel = 'alert_state';
      ev.dist_m = round3(dist); ev.encounter = enc.id; ev.role = e.encounterRole;
      ev.because = `race=${ch.race} opening=hostile aggro_at_m=${rule.aggro_at_m}`;
      ev.net_behaviour = rule.net_behaviour;
    }

    // ---- the fight, once it is a fight ---------------------------------------------------
    if (e.encAggroed) engageMember(sim, combat, bus, e, enc, rule, dist, dx, dz);

    if ((rule.opening === 'hail') && !e.encHailed && e.encounterRole === 'infantry' && e.encLeader && dist <= HAIL_RANGE_M) {
      e.encHailed = true;
      const ev = bus.emit(sim.frame, 'parley_offer');
      ev.eid = e.eid; ev.encounter = enc.id; ev.dist_m = round3(dist);
      ev.kind = rule.parley_kind || 'purchase';
      ev.line = enc.hail_line;
      ev.because = `race=${ch.race} opening=hail`;
      ev.race_independent_route = enc.parley ? enc.parley.race_independent_route : null;
    }
  }
}

/**
 * One aggroed raider's frame. Approach, then swing; or, for a net-thrower, approach to net
 * range and throw.
 *
 * Nothing here reads `character.race`. It reads `e.encAggroed`, which race decided, and then
 * behaves identically for everybody — which is AR-1's whole ruling written as code.
 */
function engageMember(sim, combat, bus, e, enc, rule, dist, dx, dz) {
  const b = combat.bodyOf(e.eid);
  const ctl = combat.enemies.get(e.eid);
  if (!b || b.dead || b.yielded) return;
  // ---- W1-12 -----------------------------------------------------------------------------
  // This function's own header says what it is: an approach-and-swing written by W1-07 so that
  // its AR-3 capture branch could be reached at all, "because enemy DECISION-MAKING is
  // RI-AI01..07 / wave-1 piece W1-12 and is correctly refused there". That piece now exists.
  //
  // A body running `souls` steers itself, so this must not also drive it — two hands on one
  // enemy is the "two parallel implementations of one system" failure, and here it would show
  // up as a body advancing 2.20 m/s in a straight line while its own state machine believed it
  // was strafing. The net-thrower path is deliberately NOT excluded: nets are an encounter
  // verb, not an AI one, and RI-CHR02 §4e's capture branch still needs them thrown.
  const aiDriven = !!(ctl && ctl.ai);
  if (aiDriven && e.encounterRole !== 'net-thrower') return;
  // Committed to an animation: an approach that overrode a swing would delete commitment,
  // which is the one thing seam S1 does not allow anybody to do.
  if (b.move) return;
  if (sim.frame < b.parriedUntil) return;

  const order = e.encOrder === undefined ? (e.encOrder = orderOf(e)) : e.encOrder;
  const isNetter = e.encounterRole === 'net-thrower';
  const want = isNetter ? ENGAGE.net_range_m : ENGAGE.engage_range_m;

  // Face the player, at the controller's own turn rate. An AI-driven body has already faced
  // and moved itself this frame inside `stepCombat`; only its net cadence is decided here.
  if (!aiDriven) {
    const bearing = bearingDeg(dx, dz);
    const maxStep = 240 / 60;
    let t = angleDelta(b.yaw, bearing);
    if (t > maxStep) t = maxStep; else if (t < -maxStep) t = -maxStep;
    b.yaw = norm360(b.yaw + t);
  }

  if (!aiDriven && !isNetter && dist < ENGAGE.min_standoff_m) {
    // Too close to swing. Back off to the standoff rather than stand inside the player and
    // whiff forever — which is what 46 attacks and 46 WHIFFs in one run looks like.
    const step = ENGAGE.advance_mps / 60;
    const ux = dx / (dist || 1), uz = dz / (dist || 1);
    b.pos[0] -= ux * step; b.pos[2] -= uz * step;
    b.state = 'REPOSITION';
    b.speedMps = ENGAGE.advance_mps;
    return;
  }

  if (dist > want && !aiDriven) {
    // Close. Straight-line advance at a constant speed, with a per-member lateral offset so
    // six of them arrive as a line rather than as a stack.
    const step = ENGAGE.advance_mps / 60;
    const ux = dx / (dist || 1), uz = dz / (dist || 1);
    const lateral = ((order % 3) - 1) * 0.55;
    b.pos[0] += ux * step - uz * lateral * step * 0.5;
    b.pos[2] += uz * step + ux * lateral * step * 0.5;
    b.state = 'REPOSITION';
    b.speedMps = ENGAGE.advance_mps;
    return;
  }
  if (!aiDriven) b.speedMps = 0;

  if (isNetter) {
    if (sim.nettedUntil > sim.frame) return;
    const due = e.encNextNetF === undefined ? sim.frame + order * ENGAGE.party_stagger_f : e.encNextNetF;
    if (sim.frame < due) { e.encNextNetF = due; if (!aiDriven) b.state = 'REPOSITION'; return; }
    e.encNextNetF = sim.frame + ENGAGE.net_cadence_f;
    const hit = dist <= ENGAGE.net_range_m;
    const ev = bus.emit(sim.frame, 'net_throw');
    ev.eid = e.eid; ev.encounter = enc.id; ev.dist_m = round3(dist); ev.hit = hit;
    ev.net_behaviour = rule.net_behaviour;
    if (hit) {
      sim.netsLanded = (sim.netsLanded || 0) + 1;
      sim.nettedUntil = sim.frame + ENGAGE.net_hold_f;
      sim.netThrownBy = e.eid;
      sim.netEncounter = enc.id;
      const r = bus.emit(sim.frame, 'restrain_begin');
      r.who = 'player'; r.kind = 'net'; r.frames = ENGAGE.net_hold_f; r.by = e.eid;
      r.consequence = rule.net_behaviour === 'capture'
        ? 'held for the wagon: a capture ends this encounter in a Dres hold, not at a sapwell'
        : 'held to be finished: the net is a prelude to a kill';
    }
    return;
  }

  const due = e.encNextAtkF === undefined ? sim.frame + order * ENGAGE.party_stagger_f : e.encNextAtkF;
  if (sim.frame < due) { e.encNextAtkF = due; b.state = 'REPOSITION'; return; }
  const rot = ENGAGE.rotation.filter((id) => b.moves[id]);
  if (!rot.length) return;
  const mv = b.moves[rot[(e.encSwing = (e.encSwing || 0) + 1) % rot.length]];
  if (mv.stamina && b.stamina < mv.stamina) {
    e.encNextAtkF = sim.frame + 30;
    const d = bus.emit(sim.frame, 'input_dropped_no_stamina');
    d.who = e.eid; d.button = mv.id; d.have = round3(b.stamina); d.need = mv.stamina;
    return;
  }
  b.begin(mv, sim.frame, {});
  if (mv.stamina) b.spend(mv.stamina, sim.frame, combat.d);
  if (ctl) ctl._noteAttack(sim.frame);
  e.encNextAtkF = sim.frame + ENGAGE.attack_cadence_f;
  // Both vocabularies, exactly as game/src/combat/system.js emits them for a scripted enemy,
  // so an existing critic tool reads this fight the same way it reads the control duel.
  const a = bus.emit(sim.frame, 'ACTION_START');
  a.who = e.eid; a.mv = mv.id; a.tag = 'enemy_attack';
  a.startup = mv.startup; a.active = mv.active; a.recovery = mv.recovery; a.total = mv.total;
  a.punish_window = mv.punish_window; a.stam_after = round3(b.stamina);
  const a2 = bus.emit(sim.frame, 'attack_start');
  a2.eid = e.eid; a2.move = mv.id; a2.encounter = enc.id; a2.role = e.encounterRole;
  a2.dist_m = round3(dist); a2.startup = mv.startup; a2.active = mv.active; a2.recovery = mv.recovery;
}

/** A stable per-member index, so the party's cadence is deterministic and offset. */
function orderOf(e) {
  const m = /-(\d+)$/.exec(e.eid);
  return m ? Number(m[1]) : 0;
}

function norm360(a) { a %= 360; return a < 0 ? a + 360 : a; }

/**
 * Is the player inside this entity's own declared sight cone? `dx,dz` is the vector FROM the
 * entity TO the player. The cone is the statblock's `sight_cone_deg` (120-160° across the
 * shipped roster) and it is read rather than re-declared: an encounter file may not give an
 * enemy better eyes than its archetype has.
 */
function inSightCone(e, dx, dz) {
  const cone = e.sight_cone_deg;
  if (!cone) return true;          // a statblock with no cone declared is not made blind by it
  const bearing = bearingDeg(dx, dz);
  return Math.abs(angleDelta(e.yaw, bearing)) <= cone / 2;
}

/** What a defeat means here. Read by the death handler; race-conditioned, moveset-blind. */
export function defeatOutcome(data, encounterId, character) {
  const enc = encounterById(data, encounterId);
  return openingFor(data, enc, character).on_player_defeat;
}

function round3(v) { return Math.round(v * 1000) / 1000; }
