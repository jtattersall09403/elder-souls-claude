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

/** Distance at which a non-hostile raid party hails you and offers the purchase. */
export const HAIL_RANGE_M = 24.0;

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
  for (let i = 0; i < sim.entities.length; i++) {
    const e = sim.entities[i];
    if (!e.encounterId) continue;
    if (e.hp <= 0) continue;
    const enc = encounterById(data, e.encounterId);
    const rule = openingFor(data, enc, ch);
    const dx = p.pos[0] - e.pos[0], dz = p.pos[2] - e.pos[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (rule.opening === 'hostile' && !e.encAggroed && dist <= rule.aggro_at_m) {
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

/** What a defeat means here. Read by the death handler; race-conditioned, moveset-blind. */
export function defeatOutcome(data, encounterId, character) {
  const enc = encounterById(data, encounterId);
  return openingFor(data, enc, character).on_player_defeat;
}

function round3(v) { return Math.round(v * 1000) / 1000; }
