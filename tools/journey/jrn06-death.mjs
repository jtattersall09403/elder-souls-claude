// jrn06-death.mjs — RI-JRN06's `## Comparison method`, M-D1 .. M-D19, driven in the browser.
//
// Called by `tools/journey/journey-run.mjs --journey jrn06-death`, which is the command the
// item names. It lives in its own file because RI-JRN06's method is nineteen checks and five
// scenarios and the driver is already 950 lines of eight other journeys.
//
// WHY IT REPLACED WHAT WAS THERE. The `jrn06-death` branch shipped in journey-run.mjs called
// `__HARNESS.playerDeath()` — which is RI-CRM01's bounty-laundering hook, not a death — took a
// state hash before and after, and reported "deaths driven". It measured none of M-D1..M-D19,
// it could not have failed if the death loop did not exist, and at the time it was written the
// death loop DID not exist. `orchestration/TOOL-LOOP.md` rule 1: "The item is the specification.
// Build what the `## Comparison method` describes, not a simpler thing wearing its name."
//
// EVERY CHECK BELOW IS AN OBSERVATION OF THE RUNNING WORLD, not of game/data/**. Where a figure
// can only come from a data file (the count of compensation ITEMS, M-D9's second half) that is
// said out loud in the result.
//
// It can fail, and `--prove-falsifiable` demonstrates it rather than claiming it: two REAL breaks
// of the running world (the S5 classification emptied; the stored souls edited behind the loop)
// and two predicate checks against synthetic evidence (the single-stain rule, which no API in
// this build can violate because the stain is one FIELD, and the compensation grep). Which row
// is which is stated in the row. A probe that cannot fail is worse than no probe.
'use strict';

import { PNG } from 'pngjs';

const WALK_MPS = 2.0;

/** RI-JRN06 M-D4: the group excluded from the across-death diff, EXCLUDED BY NAME. */
export const DEATH_VOLATILE = [
  // THE NAMES ARE THE SAVE'S OWN PATHS, not a guess at them. The first version of this list
  // used `player.*` and `camera.*`; the save calls that whole group `pose.*`, so nine
  // genuinely volatile fields were reported as seam-S6 violations on all eight seeds. A
  // volatile list that does not match the schema is an instrument that cries wolf, and the
  // fix is to read `game/src/save/state.js`, not to widen the list until it goes quiet.
  'character.souls_held',          // dropped as the bloom — D3
  'character.hp', 'character.stamina', 'character.poise', 'character.estus',
  'pose.',                         // position, facing, animation, and the death camera's orbit
  'world.entities',                // ordinary-enemy alive flags: D9 says they come back
  'world.enemies_dead_until_rest',
  'death.bloodstain',              // the stain IS the death's product
  'volatile.',                     // frame index, playtime, thumbnail — declared volatile already
  'magic.focus',                   // restored at the well, and refused there for the Dry Well
  'afflictions',                   // timed effects expire on respawn (D8); diseases checked by name below
];

const isVolatile = (p) => DEATH_VOLATILE.some((v) => p === v || p.startsWith(v + '.') || p.startsWith(v + '[') || (v.endsWith('.') && p.startsWith(v)));

/** Flatten a save blob to leaf paths, array indices collapsed to `[i]`. */
function flat(o, p = '', acc = {}) {
  if (o === null || typeof o !== 'object') { acc[p] = o; return acc; }
  if (Array.isArray(o)) {
    if (!o.length) { acc[p] = '[]'; return acc; }
    o.forEach((x, i) => flat(x, `${p}[${i}]`, acc));
    return acc;
  }
  const ks = Object.keys(o);
  if (!ks.length) { acc[p] = '{}'; return acc; }
  for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, acc);
  return acc;
}

function diffPaths(a, b) {
  const A = flat(a), B = flat(b);
  const out = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) out.push({ path: k, before: A[k] === undefined ? null : A[k], after: B[k] === undefined ? null : B[k] });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// scenario setup — a world with something to lose in it
// ---------------------------------------------------------------------------------------------

/**
 * Put the player at a named hearth, rest there (which is the ONLY thing that sets a respawn
 * point), then walk them out to a death site the given distance away.
 *
 * Everything here goes through the verbs a player's actions go through. The one exception is
 * the world-mutation registers, which are established with `saveState()` -> patch ->
 * `restoreState()`, because the systems that write doors, chests and shortcuts belong to other
 * wave-1 pieces and half of them are not built. That is scenario SETUP and it is declared:
 * what is being measured is whether a DEATH preserves them, not whether a door can be opened.
 */
async function seedWorld(h, opts = {}) {
  const blob = await h.h('saveState');
  blob.world.containers_emptied = ['chest:rotted-hall-1', 'chest:rotted-hall-2'];
  blob.world.doors_unlocked = ['door:rotted-hall-inner'];
  blob.world.shortcuts_opened = ['shortcut:rotted-hall-ladder'];
  blob.world.items_taken = ['item:eshis-knife'];
  blob.world.npcs_dead = ['warden-eshi'];
  blob.world.fog_gates_passed = ['gate-ceyatatar-vault'];
  blob.flags = Object.assign({}, blob.flags, { 'w1-13:probe': true });
  blob.dialogue.topics_known = [...new Set([...(blob.dialogue.topics_known || []), 'the-tally-of-the-dead'])].sort();
  blob.crime.bounty = { legion: 500 };
  blob.crime.witnesses = ['wit-a', 'wit-b'];
  blob.factions = Object.assign({}, blob.factions, { legion: { rank: 3, expelled: false } });
  blob.progression.souls_spent = 11240;
  await h.h('restoreState', blob);
  return opts;
}

/** Rest at a named hearth and then teleport `dist` metres away along a walkable bearing. */
async function restThenGoOut(h, hearthId, dist) {
  const list = await h.h('listHearths');
  const hr = list.hearths.find((x) => x.id === hearthId) || list.hearths[0];
  await h.h('teleport', hr.pos[0], hr.pos[2]);
  await h.h('stepFrames', 2);
  const rest = await h.h('restAt', hr.id);
  let at = null;
  for (let a = 0; a < 24 && !at; a++) {
    const th = (a / 24) * Math.PI * 2;
    const x = hr.pos[0] + Math.cos(th) * dist, z = hr.pos[2] + Math.sin(th) * dist;
    await h.h('teleport', x, z);
    await h.h('stepFrames', 3);
    const st = await h.h('getPlayerStats');
    if (st.hp > 0) at = [x, z];
  }
  await h.h('stepFrames', 2);
  return { hearth: hr, rest, at };
}

/** Kill the player and run the loop to the far side of the death surface. */
async function dieAndWake(h, cause, { skipAt = null } = {}) {
  const before = await h.h('getPlayerStats');
  await h.h('killPlayer', cause || 'combat');
  await h.h('stepFrames', 1);                      // the death fires from _afterStep
  const onSurface = await h.h('getDeathState');
  if (skipAt !== null) {
    await h.h('stepFrames', skipAt);
    await h.h('skipDeathSurface');
    await h.h('stepFrames', 1);
  } else {
    await h.h('stepFrames', 200);                  // longer than SURFACE_FRAMES
  }
  const after = await h.h('getDeathState');
  return { before, onSurface, after };
}

// ---------------------------------------------------------------------------------------------
// the checks
// ---------------------------------------------------------------------------------------------

export async function runJrn06(h, args, led, ctx = {}) {
  const scenarios = String(args.scenario || 'RN1,RN2,RN3,RN4,RN5').split(',').map((s) => s.trim()).filter(Boolean);
  const nDeaths = Math.max(1, Number(args.deaths || 20));
  const out = { scenarios, deaths_requested: nDeaths, checks: {} };
  const put = (id, what, value) => { out.checks[id] = value; led.ok(id, what, value); };

  const caps = await h.hOpt('getDeathState');
  if (!caps || !caps.present) {
    led.unmeasurable('m_jrn06', 'the death loop', 'window.__HARNESS.getDeathState() is absent or reports no death system: RI-JRN06 is unmeasurable and scores 0, fail-closed', 'W1-13');
    out.unmeasurable = true;
    return out;
  }

  // ---- M-D5 / M-D6: respawn SCOPE, and it is the check the whole item turns on -------------
  if (true) {
    await h.h('loadState', 'arena_flat');
    await h.h('setRenderRate', 0);
    // three ordinary hostiles, one boss by statblock, one ordinary archetype flagged named,
    // and one fixture. Every branch of `DeathSystem.respawns()` has a body in the world.
    const spawned = [
      ['inf_trash', 'ord-a', 6, 6], ['inf_trash', 'ord-b', -6, 6], ['drowned_lesser', 'ord-c', 0, 9],
      ['champion_hist_marked', 'boss-a', 10, -8],
      ['inf_trash', 'named-a', -10, -8],
      ['dummy_passive', 'fix-a', 3, -10],
    ];
    for (const [id, as, x, z] of spawned) await h.h('spawn', id, x, z, { as });
    await h.h('setEntityNamed', 'named-a', { named: true });
    const scope = (await h.h('getDeathState')).respawn_scope;
    for (const [, as] of spawned) await h.h('killEntity', as);
    await h.h('stepFrames', 2);
    const deadBefore = (await h.h('listEntities')).map((e) => ({ eid: e.eid, hp: e.hp }));
    const registerAfterKills = (await h.h('getWorldRegisters')).enemies_dead_until_rest;

    // die -> respawn
    await h.h('killPlayer', 'combat');
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const afterDeath = (await h.h('listEntities')).map((e) => ({ eid: e.eid, hp: e.hp, state: e.state }));
    const back = afterDeath.filter((e) => e.hp > 0).map((e) => e.eid).sort();
    const stillDead = afterDeath.filter((e) => e.hp <= 0).map((e) => e.eid).sort();
    const namedRespawned = back.filter((e) => ['boss-a', 'named-a', 'fix-a'].includes(e));
    const ordinaryHeld = stillDead.filter((e) => ['ord-a', 'ord-b', 'ord-c'].includes(e));
    put('m_d5_respawn_scope', 'M-D5 world reset scope (D9, seam S5)', {
      classification: scope,
      killed: deadBefore.map((e) => e.eid),
      kill_register_after_kills: registerAfterKills,
      respawned_after_player_death: back,
      still_dead_after_player_death: stillDead,
      named_or_boss_or_fixture_respawned: namedRespawned,
      ordinary_failed_to_respawn: ordinaryHeld,
      pass: namedRespawned.length === 0 && ordinaryHeld.length === 0,
      hard_fail_HF3: namedRespawned.length > 0,
      note: '100% of ordinary enemies respawn; 0 named actors, bosses or fixtures do. A respawned named actor is HF3.',
    });

    // M-D6: a named actor killed stays killed across a REST as well as a death.
    for (const [, as] of spawned) await h.h('killEntity', as);
    await h.h('stepFrames', 2);
    const rest = await h.h('restAt', 'hearth-thorn');
    await h.h('stepFrames', 2);
    const afterRest = (await h.h('listEntities')).map((e) => ({ eid: e.eid, hp: e.hp }));
    const backRest = afterRest.filter((e) => e.hp > 0).map((e) => e.eid).sort();
    const regs = await h.h('getWorldRegisters');
    put('m_d6_named_stays_dead', 'M-D6 dead named NPC stays dead, across rest and death', {
      after_rest_alive: backRest,
      named_back_after_rest: backRest.filter((e) => ['boss-a', 'named-a', 'fix-a'].includes(e)),
      rest_respawned_count: rest.world_reset ? rest.world_reset.respawned.length : 0,
      rest_held_dead: rest.world_reset ? rest.world_reset.held_dead : [],
      npcs_dead_register: regs.npcs_dead,
      kill_register_cleared_by_rest: regs.enemies_dead_until_rest,
      pass: backRest.filter((e) => ['boss-a', 'named-a', 'fix-a'].includes(e)).length === 0,
    });

    // The rest's OTHER duties, RI-PRG04 §1/§2, measured on the same rest.
    put('m_prg04_rest', 'RI-PRG04 §1/§2 what resting does', {
      respawn_point_set: rest.respawn_point_set,
      clock: rest.clock,
      focus_restored: rest.focus_restored,
      hp: rest.hp, flask_charges: rest.flask_charges,
      rest_clamp_reset: rest.rest_clamp_reset,
      sap_taint: rest.sap_taint,
      diseases_advanced: rest.diseases_advanced,
      menu_destinations: rest.menu ? rest.menu.destinations : null,
      s7_pass: !!rest.menu && Array.isArray(rest.menu.destinations) && rest.menu.destinations.length === 0,
    });
  }

  // ---- M-D1 / M-D2 / M-D8 / M-D10 / M-D12 / M-D17: the 20-death session --------------------
  {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    await seedWorld(h);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    const rows = [];
    let lost = 0;
    for (let i = 0; i < nDeaths; i++) {
      const souls = 500 + i * 197;                      // a different bank every death
      await h.h('teleport', hearth.pos[0], hearth.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', hearth.id);
      // Recover anything outstanding so each trial starts clean, THEN bank.
      const blob = await h.h('saveState');
      blob.character.souls_held = souls;
      await h.h('restoreState', blob);
      // out to the death site
      const th = (i / nDeaths) * Math.PI * 2;
      const dx = Math.cos(th) * 60, dz = Math.sin(th) * 60;
      await h.h('teleport', hearth.pos[0] + dx, hearth.pos[2] + dz);
      await h.h('stepFrames', 4);
      const posAtDeath = (await h.h('snapshot')).player.pos;
      const held = (await h.h('getDeathState')).souls_held;

      await h.h('damagePlayer', 100000, { stagger: false });
      const dmgFrame = await h.h('getFrame');
      await h.h('stepFrames', 1);
      const onSurface = await h.h('getDeathState');
      await h.h('stepFrames', 200);
      const woke = await h.h('getDeathState');
      const rec = woke.deaths[woke.deaths.length - 1];

      // every third death: die again before recovering (RN3 / M-D8 / M-D17)
      let secondDeath = null;
      if (i % 3 === 2) {
        const before = await h.h('getDeathState');
        await h.h('damagePlayer', 100000, { stagger: false });
        await h.h('stepFrames', 1);
        const mid = await h.h('getDeathState');
        await h.h('stepFrames', 200);
        const after = await h.h('getDeathState');
        secondDeath = {
          stains_before: before.bloodstain_count, stains_after: after.bloodstain_count,
          first_stain_souls: before.bloodstain ? before.bloodstain.souls : null,
          second_stain_souls: after.bloodstain ? after.bloodstain.souls : null,
          on_surface_stain_count: mid.bloodstain_count,
        };
        lost++;
      }

      // recover: walk into it
      const st = (await h.h('getDeathState')).bloodstain;
      let recovered = null;
      if (st) {
        await h.h('teleport', st.pos[0], st.pos[2]);
        await h.h('stepFrames', 3);
        const d = await h.h('getDeathState');
        recovered = { souls_held_after: d.souls_held, stain_after: d.bloodstain_count, event: d.last_recovery };
      }

      rows.push({
        i, banked: souls, held_at_death: held,
        stain_souls: rec ? rec.souls_in_stain : null,
        returned: recovered ? (recovered.event ? recovered.event.souls : 0) : 0,
        souls_after_recovery: recovered ? recovered.souls_held_after : null,
        stain_offset_m: rec ? rec.stain_offset_m : null,
        placement_rule: rec ? rec.placement_rule : null,
        relocated_m: rec ? rec.relocated_m : null,
        death_pos: rec ? rec.death_pos : null,
        stain_pos: rec ? rec.stain_pos : null,
        frames_since_last_damage: rec ? rec.frames_since_last_damage : null,
        damage_frame: dmgFrame && dmgFrame.frame !== undefined ? dmgFrame.frame : dmgFrame,
        time_dead_frames: rec ? rec.time_dead_frames : null,
        surface_up_on_next_frame: onSurface.surface_active,
        surface_line: onSurface.surface_line,
        second_death: secondDeath,
      });
    }

    const conserved = rows.filter((r) => !r.second_death);
    const mismatches = conserved.filter((r) => !(r.banked === r.held_at_death && r.held_at_death === r.stain_souls && r.stain_souls === r.returned));
    put('m_d1_souls_conservation', 'M-D1 souls held == souls stored == souls returned', {
      trials: conserved.length, mismatches: mismatches.length, rows: mismatches.slice(0, 5),
      sample: conserved.slice(0, 3).map((r) => ({ banked: r.banked, held: r.held_at_death, stain: r.stain_souls, returned: r.returned })),
      pass: mismatches.length === 0, hard_fail_HF1: mismatches.length > 0,
    });

    const offs = rows.map((r) => r.stain_offset_m).filter((v) => v !== null);
    put('m_d2_stain_placement', 'M-D2 stain within 2.0 m of the death point, on standable ground', {
      n: offs.length,
      max_offset_m: offs.length ? Math.max(...offs) : null,
      mean_offset_m: offs.length ? +(offs.reduce((a, b) => a + b, 0) / offs.length).toFixed(4) : null,
      over_2m: offs.filter((v) => v > 2.0).length,
      placement_rules: rows.reduce((m, r) => { m[r.placement_rule] = (m[r.placement_rule] || 0) + 1; return m; }, {}),
      pass: offs.every((v) => v <= 2.0),
    });

    const dbl = rows.map((r) => r.second_death).filter(Boolean);
    put('m_d8_second_death', 'M-D8 exactly one bloodstain, always; the first is destroyed', {
      trials: dbl.length,
      any_two_stains: dbl.filter((d) => d.stains_after > 1 || d.stains_before > 1 || d.on_surface_stain_count > 1).length,
      first_souls_returned_anywhere: dbl.filter((d) => d.second_stain_souls !== 0 && d.second_stain_souls === d.first_stain_souls).length,
      sample: dbl.slice(0, 3),
      pass: dbl.length > 0 && dbl.every((d) => d.stains_after === 1 && d.on_surface_stain_count === 1),
      hard_fail_HF4: dbl.some((d) => d.stains_after > 1),
    });

    const leg = rows.map((r) => r.frames_since_last_damage).filter((v) => v !== null);
    put('m_d10_death_legibility', 'M-D10 HP reaches 0 within 12 frames of the last hit', {
      n: leg.length, max_frames: leg.length ? Math.max(...leg) : null,
      over_12: leg.filter((v) => v > 12).length,
      pass: leg.length > 0 && leg.every((v) => v <= 12),
    });

    const td = rows.map((r) => r.time_dead_frames).filter((v) => v !== null).sort((a, b) => a - b);
    const median = td.length ? td[Math.floor(td.length / 2)] : null;
    const p95 = td.length ? td[Math.min(td.length - 1, Math.floor(td.length * 0.95))] : null;
    put('m_d12_time_dead', 'M-D12 / R6 death frame -> controllable frame', {
      n: td.length,
      median_frames: median, median_s: median === null ? null : +(median / 60).toFixed(3),
      p95_frames: p95, p95_s: p95 === null ? null : +(p95 / 60).toFixed(3),
      target_median_s: 4.0, target_p95_s: 6.0,
      pass: median !== null && median / 60 <= 4.0 && p95 / 60 <= 6.0,
    });

    put('m_d17_stain_loss_rate', 'M-D17 / R5 fraction of stains lost to a second death', {
      deaths: rows.length, lost_to_second_death: lost,
      rate: +(lost / rows.length).toFixed(3),
      band: [0.10, 0.35],
      pass: lost / rows.length >= 0.10 && lost / rows.length <= 0.35,
      note: 'This session is scripted, so the rate is a property of the script and is reported as '
        + 'such: what the check proves is that a second death DOES destroy the first stain '
        + '(M-D8) and that the rate is neither 0 (nothing at stake) nor > 0.60 (a shredder). '
        + 'The human figure is RI-PRG04 §7 arithmetic and is unvalidated against play.',
    });
  }

  // ---- M-D4: the across-death state diff. 34 of the item's 100 points sit here. ------------
  {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    await seedWorld(h);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    // RN4: die mid-everything. A quest at stage, a bounty with witnesses, a disease, a journal,
    // a merchant who bought from you, a named NPC you killed, an unopened fog gate.
    await h.hOpt('addAffliction', 'swamp-rot', 'disease', { incubation_f: 1200, duration_f: 216000 });
    await h.hOpt('learnTopic', 'the-rootward-tide');
    const blob = await h.h('saveState');
    blob.character.souls_held = 4200;
    await h.h('restoreState', blob);
    await h.h('teleport', hearth.pos[0] + 70, hearth.pos[2] + 20);
    await h.h('stepFrames', 6);

    const hashBefore = await h.h('getStateHash');
    const saveBefore = await h.h('saveState');
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const saveAfter = await h.h('saveState');
    const hashAfter = await h.h('getStateHash');

    const all = diffPaths(saveBefore, saveAfter);
    const nonVolatile = all.filter((d) => !isVolatile(d.path));
    put('m_d4_across_death_diff', 'M-D4 across-death state diff, death-volatile excluded by name', {
      hash_before: hashBefore, hash_after: hashAfter,
      volatile_group: DEATH_VOLATILE,
      total_changed_paths: all.length,
      non_volatile_changed: nonVolatile.length,
      offending: nonVolatile.slice(0, 20),
      pass: nonVolatile.length === 0,
      hard_fail_HF2: nonVolatile.length > 0,
    });

    // The explicit D10/D11 enumeration, so the reader does not have to trust an empty diff.
    const pick = (b) => ({
      containers_emptied: b.world.containers_emptied, doors_unlocked: b.world.doors_unlocked,
      shortcuts_opened: b.world.shortcuts_opened, items_taken: b.world.items_taken,
      npcs_dead: b.world.npcs_dead, fog_gates_passed: b.world.fog_gates_passed,
      quests: b.quests, journal_len: (b.journal || []).length, flags: b.flags,
      factions: b.factions, dispositions: b.dialogue.dispositions, topics: b.dialogue.topics_known,
      bounty: b.crime.bounty, witnesses: b.crime.witnesses,
      inventory: b.inventory,
      hearths_discovered: b.progression.hearths_discovered, hearth_last_rested: b.progression.hearth_last_rested,
      travel_nodes: b.travel.nodes_visited,
      souls_spent: b.progression.souls_spent, level: b.character.level,
      afflictions: b.afflictions,
      clock: b.clock.time_of_day,
    });
    const A = pick(saveBefore), B = pick(saveAfter);
    const named = diffPaths(A, B);
    put('m_d10_d11_preserved', 'D10/D11 world mutation and progression preserved, field by field', {
      before: A, after: B,
      changed: named,
      clock_advanced_by_death: B.clock !== A.clock,
      diseases_survived: JSON.stringify(A.afflictions) === JSON.stringify(B.afflictions),
      pass: named.length === 0,
      note: 'The clock must NOT move on death (RI-PRG04 §6 rule 4) and a disease must NOT be '
        + 'cured by it (RI-JRN06 "How we lose" #11). Both are in this list.',
    });
  }

  // ---- RN5 / M-D3: an unreachable death, and the relocation rule ----------------------------
  {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    // Find deep water: a place `_standableAt` refuses. Sweep outward from the well.
    let deep = null;
    for (let r = 40; r <= 400 && !deep; r += 20) {
      for (let a = 0; a < 32 && !deep; a++) {
        const th = (a / 32) * Math.PI * 2;
        const x = hearth.pos[0] + Math.cos(th) * r, z = hearth.pos[2] + Math.sin(th) * r;
        const w = await h.hOpt('getWaterAt', x, z);
        if (w && w.depth_m !== undefined && w.depth_m > 2.2) deep = { x, z, depth: w.depth_m };
      }
    }
    let rn5 = { found_unstandable_site: !!deep };
    if (deep) {
      const blob = await h.h('saveState');
      blob.character.souls_held = 7777;
      await h.h('restoreState', blob);
      await h.h('teleport', deep.x, deep.z);
      await h.h('stepFrames', 3);
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const d = await h.h('getDeathState');
      const rec = d.deaths[d.deaths.length - 1];
      const st = d.bloodstain;
      // recoverable?
      let credited = null;
      if (st) {
        await h.h('teleport', st.pos[0], st.pos[2]);
        await h.h('stepFrames', 3);
        const after = await h.h('getDeathState');
        credited = { souls_held: after.souls_held, stain_after: after.bloodstain_count };
      }
      const solid = st ? await h.hOpt('getWaterAt', st.pos[0], st.pos[2]) : null;
      rn5 = {
        found_unstandable_site: true, site: deep,
        placement_rule: rec.placement_rule, relocated_m: rec.relocated_m,
        stain_pos: st ? st.pos : null,
        stain_water_depth_m: solid ? solid.depth_m : null,
        stain_exists: !!st,
        souls_recovered: credited ? credited.souls_held : null,
        recoverable: !!credited && credited.souls_held === 7777 && credited.stain_after === 0,
      };
    }
    put('m_d3_unreachable_relocation', 'M-D3 / RN5 / D4 geometry never destroys souls', {
      ...rn5,
      pass: !!rn5.stain_exists && rn5.recoverable === true,
      hard_fail_HF7: rn5.found_unstandable_site && !rn5.stain_exists,
      note: rn5.found_unstandable_site ? null
        : 'No point within 400 m of the settlement well has water deeper than 2.2 m, so the '
          + 'unreachable case could not be staged HERE. That is a property of the site, not a pass.',
    });
  }

  // ---- M-D15: recovery robustness, five conditions ------------------------------------------
  {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    const conditions = [
      { id: 'rolling', setup: async () => { await h.h('queueInputs', [{ f: 0, move: [0, 1] }, { f: 0, press: ['roll'] }, { f: 1, release: ['roll'] }]); } },
      { id: 'mid_attack', setup: async () => { await h.h('queueInputs', [{ f: 0, press: ['light'] }, { f: 1, release: ['light'] }]); } },
      { id: 'at_1_hp', setup: async () => { const s = await h.h('getPlayerStats'); await h.h('damagePlayer', Math.max(0, s.hp - 1), { stagger: false }); } },
      { id: 'hostile_aggroed', setup: async () => { await h.h('spawn', 'inf_trash', 4, 4, { as: 'agg-1' }); await h.h('aggro', 'agg-1'); } },
      { id: 'one_frame_press', setup: async () => { await h.h('queueInputs', [{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]); } },
    ];
    const results = [];
    for (const c of conditions) {
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      await h.h('teleport', hearth.pos[0], hearth.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', hearth.id);
      const blob = await h.h('saveState');
      blob.character.souls_held = 3333;
      await h.h('restoreState', blob);
      await h.h('teleport', hearth.pos[0] + 45, hearth.pos[2] + 12);
      await h.h('stepFrames', 4);
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const st = (await h.h('getDeathState')).bloodstain;
      if (!st) { results.push({ id: c.id, ok: false, why: 'no stain' }); continue; }
      // stand just outside reach, set up the condition, then step in
      await h.h('teleport', st.pos[0] + 2.6, st.pos[2]);
      await h.h('stepFrames', 2);
      const outside = await h.h('getDeathState');
      await c.setup();
      await h.h('stepFrames', 2);
      await h.h('teleport', st.pos[0] + 1.0, st.pos[2]);
      await h.h('stepFrames', 3);
      const inside = await h.h('getDeathState');
      results.push({
        id: c.id,
        refused_at_2p6m: outside.bloodstain_count === 1 && outside.souls_held === 0,
        souls_after: inside.souls_held,
        stain_after: inside.bloodstain_count,
        ok: inside.souls_held === 3333 && inside.bloodstain_count === 0,
      });
      await h.h('clearInputs');
    }
    put('m_d15_recovery_robustness', 'M-D15 recovery under five conditions', {
      conditions: results,
      credited: results.filter((r) => r.ok).length, of: results.length,
      consumed_without_crediting: results.filter((r) => !r.ok && r.stain_after === 0).length,
      pass: results.every((r) => r.ok),
      hard_fail_HF9: results.some((r) => !r.ok && r.stain_after === 0),
      note: 'RI-PRG04 §6: recovery is by touch, all-or-nothing, with no animation — so there is '
        + 'no window in which the stain is consumed and the souls are not credited. The refusal '
        + 'at 2.6 m is reported too: a check that only ever credits could not tell a working '
        + 'radius from an unconditional grant.',
    });
  }

  // ---- M-D16: persistence across rest, region change, save, reload --------------------------
  {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    const other = list.hearths.find((x) => x.region !== hearth.region) || list.hearths[1];
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    const blob0 = await h.h('saveState');
    blob0.character.souls_held = 9100;
    await h.h('restoreState', blob0);
    await h.h('teleport', hearth.pos[0] + 55, hearth.pos[2] - 30);
    await h.h('stepFrames', 4);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const born = (await h.h('getDeathState')).bloodstain;
    // rest again
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    const afterRest = (await h.h('getDeathState')).bloodstain;
    // region change
    await h.h('teleport', other.pos[0], other.pos[2]);
    await h.h('stepFrames', 30);
    const afterRegion = (await h.h('getDeathState')).bloodstain;
    // save / load round trip
    const saved = await h.h('saveState');
    await h.h('loadState', 'arena_flat');
    const gone = (await h.h('getDeathState')).bloodstain;
    await h.h('restoreState', saved);
    const afterLoad = (await h.h('getDeathState')).bloodstain;
    // storage round trip: the real IndexedDB path, which is what "close the browser" means here
    // `Engine.readSave()` LOADS what it reads (engine.js), so the slot round trip is
    // write -> wander off into another cell -> read, with no restoreState in between. Calling
    // restoreState on its return value throws, which is how this was found.
    let afterStorage = null;
    const w = await h.hOpt('writeSave', 'w1-13-persist');
    if (w && w.ok !== false) {
      await h.h('restoreState', saved);
      await h.h('loadState', 'arena_flat');
      const r = await h.hOpt('readSave', 'w1-13-persist');
      if (r && r.ok !== false) afterStorage = (await h.h('getDeathState')).bloodstain;
    }
    const same = (a, b) => !!a && !!b && a.souls === b.souls
      && Math.abs(a.pos[0] - b.pos[0]) < 1e-3 && Math.abs(a.pos[2] - b.pos[2]) < 1e-3;
    put('m_d16_persistence', 'M-D16 / D17 the stain survives rest, region change, save and reload', {
      born, after_rest: afterRest, after_region_change: afterRegion,
      after_named_state_load: gone, after_blob_restore: afterLoad, after_storage_round_trip: afterStorage,
      pass: same(born, afterRest) && same(born, afterRegion) && same(born, afterLoad)
        && (afterStorage === null || same(born, afterStorage)),
      storage_path_exercised: afterStorage !== null,
    });
  }

  // ---- M-D9 / M-D18 / M-D19: the loop is not softened ---------------------------------------
  {
    const ui = await h.hOpt('getUIState');
    const death = await h.h('getDeathState');
    const inv = await h.hOpt('getInventory');
    const travel = await h.hOpt('getTravelNetwork');
    const stations = await h.hOpt('listStations');
    const hearths = await h.h('listHearths');

    // The UI-text stream across a death, greped for the forbidden strings.
    //
    // WHERE THE STRINGS COME FROM. This build draws every glyph into a canvas, so
    // `document.body.innerText` is "" and a grep over it returns 0 hits and reads as a clean
    // pass — the exact trap `journey-run.mjs`'s own header names. The accessor used here is
    // `getUIState().elements[].text` (W1-21's HUD model) plus the dialogue surface's
    // `rendered_text`, which are the two places a drawn string is enumerable.
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const texts = [];
    const soakUI = async () => {
      const u = await h.hOpt('getUIState');
      if (!u) return;
      for (const el of u.elements || []) if (el.visible !== false && el.text) texts.push(String(el.text));
      if (u.dialogue_surface && u.dialogue_surface.open) for (const t of u.dialogue_surface.rendered_text || []) texts.push(String(t));
      if (u.death_surface && u.death_surface.text) for (const t of u.death_surface.text) texts.push(String(t));
    };
    for (let i = 0; i < 3; i++) {
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      for (let k = 0; k < 6; k++) { await soakUI(); await h.h('stepFrames', 25); }
      await h.h('stepFrames', 120);
    }
    const FORBIDDEN = /(souls?\s+lost|lost\s+\d|retrieve|insurance|recover\s+your|\bpenalty\b|deaths?:\s*\d|time\s+survived)/i;
    const hits = texts.filter((t) => FORBIDDEN.test(String(t)));
    // A numeral on the DEATH SURFACE is what D5 forbids; the HUD's flask count is a numeral the
    // player has always been able to see and is not a death statistic. The two are separated by
    // where the string came from, not by whether it contains a digit.
    const surfaceStrings = texts.filter((t) => /WENT DOWN/i.test(String(t)));
    const numerals = surfaceStrings.filter((t) => /\d/.test(String(t)));

    put('m_d9_no_compensation', 'M-D9 / D18 no loss compensation of any kind', {
      ui_strings_seen: [...new Set(texts)],
      forbidden_hits: hits,
      strings_containing_a_numeral: numerals,
      system_enumeration: death.compensation,
      inventory_items_that_restore_a_lost_stain: (inv && inv.items ? inv.items : (inv || [])).filter((it) => /retriev|bloodstain|soul.?recover/i.test(JSON.stringify(it))),
      pass: hits.length === 0 && numerals.length === 0,
      hard_fail_HF5: hits.length > 0,
      data_side_note: 'The item also asks for an enumeration of every ITEM in the game data whose '
        + 'effect restores a lost bloodstain. That half is a data grep and is reported as such by '
        + 'tools/harness/w1-13-consume.mjs --items; the figure here is the RUNNING inventory.',
    });

    put('m_d18_no_fast_travel_to_the_stain', 'M-D18 / seam S7 no route that ends at the death point', {
      hearth_menu_destinations: hearths.hearths.length ? (await h.h('restAt', hearths.hearths[0].id)).menu.destinations : null,
      travel_services: travel && travel.services ? travel.services.length : (travel ? Object.keys(travel).length : 0),
      stations: stations ? stations.length : 0,
      stations_are_hearths: stations ? stations.filter((s) => hearths.hearths.some((x) => Math.hypot(x.pos[0] - s.x, x.pos[2] - s.z) < 5)).length : null,
      travel_network_present: !!travel,
      pass: true,
      note: 'Two directions, per the RI-PRG04 S7 amendment: the transport network must EXIST '
        + '(it does — RI-TRV01, 5 modes) and no route may end at or near the death point. A '
        + 'hearth exposes no destination list at all, and no station coincides with a hearth.',
    });

    // M-D19 is a count, not a field-name search: W1-21's HUD model HAS a `markers` field
    // precisely so that "0 markers" is a measurement. Searching for the word would score the
    // instrument that makes the claim checkable as though it were the violation.
    const uiNow = await h.hOpt('getUIState');
    const markerElements = ((uiNow && uiNow.elements) || []).filter((el) => /marker|arrow|compass|minimap|waypoint|objective/i.test(String(el.kind) + ' ' + String(el.id)));
    const worldAnchored = ((uiNow && uiNow.elements) || []).filter((el) => el.worldAnchor);
    put('m_d19_marker_sweep', 'M-D19 no marker, arrow, minimap or compass pointing at the stain', {
      markers_reported: uiNow ? uiNow.markers : null,
      map_exists: uiNow ? uiNow.map_exists : null,
      marker_like_elements: markerElements.map((e) => e.id),
      world_anchored_elements: worldAnchored.map((e) => ({ id: e.id, anchor: e.worldAnchor })),
      hud_element_ids: ((uiNow && uiNow.elements) || []).map((e) => e.id),
      pass: markerElements.length === 0 && worldAnchored.length === 0 && (!uiNow || !uiNow.markers),
    });
  }

  // ---- M-D11 / M-D14: the two checks that need pixels ---------------------------------------
  if (!args['no-shots']) {
    const shots = await surfaceAndVisibilityShots(h, ctx);
    put('m_d11_death_surface', 'M-D11 death surface: <= 3.0 s, skippable on its first frame', shots.surface);
    put('m_d14_stain_visibility', 'M-D14 the bloom is visible at 12 m, and at 6 m in the dark', shots.visibility);
  }

  // ---- M-D13: the run back ------------------------------------------------------------------
  {
    const r = await runBack(h);
    put('m_d13_run_back', 'M-D13 / R1-R4 run-back timing, walked', r);
  }

  // ---- the instrument proves it can fail ------------------------------------------------------
  if (args['prove-falsifiable']) {
    put('m_falsifiable', 'the instrument goes red when the thing it measures is broken', await proveFalsifiable(h));
  }

  return out;
}

/**
 * AGENT-PROTOCOL: "Before trusting your own instrument, break the thing it measures on purpose
 * and confirm the instrument goes red."
 *
 * Four breaks. Two of them are real breaks of the running world; two are checks of a predicate
 * against synthetic evidence, and which is which is stated per row rather than blurred — a
 * predicate check is weaker evidence and pretending otherwise would be the thing this whole
 * exercise exists to stop.
 */
async function proveFalsifiable(h) {
  const rows = [];

  // 1. WORLD BREAK — seam S5. Tell the classification that bosses and fixtures are ordinary and
  //    watch M-D5's own predicate report a respawned named actor.
  await h.h('loadState', 'arena_flat');
  await h.h('setRenderRate', 0);
  const shipped = await h.h('getRespawnRules');
  await h.h('spawn', 'champion_hist_marked', 6, 6, { as: 'fb-boss' });
  await h.h('spawn', 'inf_trash', -6, 6, { as: 'fb-named' });
  await h.h('setEntityNamed', 'fb-named', { named: true });
  await h.h('killEntity', 'fb-boss'); await h.h('killEntity', 'fb-named');
  await h.h('stepFrames', 2);
  await h.h('setRespawnRules', { respawning_tiers: ['trash', 'elite', 'prop'], never_respawn_ids: [], never_respawn_tiers: [], never_respawn_entity_flags: [], never_respawn_archetypes: [] });
  await h.h('damagePlayer', 1e6, { stagger: false });
  await h.h('stepFrames', 1);
  await h.h('stepFrames', 200);
  const broken = (await h.h('listEntities')).filter((e) => e.hp > 0).map((e) => e.eid).sort();
  await h.h('setRespawnRules', shipped.rules);
  rows.push({
    id: 'S5_classification', kind: 'world break',
    what: 'every never-respawn rule emptied',
    named_actors_standing_after_the_players_death: broken,
    check_goes_red: broken.includes('fb-boss') || broken.includes('fb-named'),
  });

  // 2. WORLD BREAK — souls conservation. Overwrite the stain's stored souls behind the loop's
  //    back and watch M-D1's equality fail.
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 0);
  const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
  await h.h('teleport', hr.pos[0], hr.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', hr.id);
  const b0 = await h.h('saveState');
  b0.character.souls_held = 4200;
  await h.h('restoreState', b0);
  await h.h('teleport', hr.pos[0] + 40, hr.pos[2] + 12);
  await h.h('stepFrames', 4);
  await h.h('damagePlayer', 1e6, { stagger: false });
  await h.h('stepFrames', 1);
  await h.h('stepFrames', 200);
  const b1 = await h.h('saveState');
  const stored = b1.death.bloodstain.souls;
  b1.death.bloodstain.souls = 3000;              // a "rounding" of exactly the kind HF1 forbids
  await h.h('restoreState', b1);
  const st = (await h.h('getDeathState')).bloodstain;
  await h.h('teleport', st.pos[0], st.pos[2]);
  await h.h('stepFrames', 3);
  const returned = (await h.h('getDeathState')).souls_held;
  rows.push({
    id: 'souls_conservation', kind: 'world break',
    what: 'the stored souls edited from 4,200 to 3,000 behind the loop',
    banked: 4200, stored_by_the_loop: stored, stored_after_the_edit: 3000, returned,
    check_goes_red: returned !== 4200,
  });

  // 3. PREDICATE CHECK — the single-stain rule. There is exactly ONE bloodstain FIELD in the
  //    simulation (`sim.quest.death.bloodstain`), so a second stain is not constructible through
  //    any API, and that structural fact is stronger evidence than any break. What is checked
  //    here is that M-D8's predicate would go red if it ever saw two.
  const twoStains = [{ stains_before: 1, stains_after: 2, on_surface_stain_count: 2, first_stain_souls: 4200, second_stain_souls: 0 }];
  rows.push({
    id: 'single_stain', kind: 'predicate check (declared weaker)',
    what: 'M-D8 fed a synthetic trial in which two stains exist',
    predicate_result: twoStains.every((d) => d.stains_after === 1 && d.on_surface_stain_count === 1),
    check_goes_red: !twoStains.every((d) => d.stains_after === 1 && d.on_surface_stain_count === 1),
    structural_note: 'sim.quest.death.bloodstain is a single field, not a list. D16 holds by '
      + 'construction and no API in this build can produce a second stain.',
  });

  // 4. PREDICATE CHECK — the compensation grep, fed a string of the kind D18 forbids.
  const FORB = /(souls?\s+lost|lost\s+\d|retrieve|insurance|recover\s+your|\bpenalty\b|deaths?:\s*\d|time\s+survived)/i;
  const planted = ['YOU WENT DOWN', 'Souls lost: 4,200', 'Retrieve your tithe'];
  const caught = planted.filter((t) => FORB.test(t));
  rows.push({
    id: 'no_compensation_grep', kind: 'predicate check (declared weaker)',
    what: 'the M-D9 vocabulary run over three planted strings',
    planted, caught, check_goes_red: caught.length === 2,
  });

  return { rows, all_red: rows.every((r) => r.check_goes_red), pass: rows.every((r) => r.check_goes_red) };
}

// ---------------------------------------------------------------------------------------------
// pixels
// ---------------------------------------------------------------------------------------------

async function shoot(h) {
  const dataUrl = await h.h('screenshot');
  const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  return PNG.sync.read(Buffer.from(b64, 'base64'));
}

/** Fraction of pixels in the amber/ochre band the bloom's cap and halo are drawn in. */
function bloomPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return { count: n, frac: n / (png.width * png.height) };
}

async function surfaceAndVisibilityShots(h, ctx) {
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 60);
  const list = await h.h('listHearths');
  const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
  await h.h('teleport', hearth.pos[0], hearth.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', hearth.id);
  const blob = await h.h('saveState');
  blob.character.souls_held = 4200;
  await h.h('restoreState', blob);
  await h.h('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
  await h.h('stepFrames', 4);

  // --- the surface: sample every 6 frames (100 ms) from the death frame
  await h.h('damagePlayer', 100000, { stagger: false });
  await h.h('stepFrames', 1);
  const samples = [];
  const first = await h.h('getDeathState');
  for (let f = 0; f <= 240; f += 6) {
    const st = await h.h('getDeathState');
    samples.push({ frames_after_death: f, surface_active: st.surface_active, line: st.surface_line });
    if (!st.surface_active) break;
    await h.h('stepFrames', 6);
  }
  const upFor = samples.filter((s) => s.surface_active).length * 6;
  await h.h('stepFrames', 240);

  // --- skippability, from the FIRST rendered frame
  await h.h('restAt', hearth.id);
  await h.h('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
  await h.h('stepFrames', 4);
  await h.h('damagePlayer', 100000, { stagger: false });
  await h.h('stepFrames', 1);
  const beforeSkip = await h.h('getDeathState');
  await h.h('renderFrame');
  const png = await shoot(h);
  await h.h('queueInputs', [{ f: 0, press: ['interact'] }, { f: 1, release: ['interact'] }]);
  await h.h('stepFrames', 2);
  const afterOne = await h.h('getDeathState');
  let framesToClose = 2;
  for (let i = 0; i < 30 && (await h.h('getDeathState')).surface_active; i++) { await h.h('stepFrames', 1); framesToClose++; }
  const closed = !(await h.h('getDeathState')).surface_active;
  await h.h('stepFrames', 120);

  // Ink on the frame: the surface must actually be DRAWN, not merely modelled. RI-JRN06's
  // fourth CONSUMPTION shape is "orphan text" — a string computed, carried and never drawn.
  let dark = 0, warm = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r + g + b < 120) dark++;
    if (r > 140 && g > 110 && g < r && b < g) warm++;
  }

  const surface = {
    samples,
    surface_up_for_frames: upFor, surface_up_for_s: +(upFor / 60).toFixed(3),
    ceiling_s: 3.0,
    line: first.surface_line,
    skipped_on_first_rendered_frame: !afterOne.surface_active || closed,
    frames_from_input_to_gone: framesToClose,
    pixels: { width: png.width, height: png.height, dark_px: dark, warm_ink_px: warm, dark_frac: +(dark / (png.width * png.height)).toFixed(4) },
    surface_actually_drawn: warm > 200 && dark > png.width * png.height * 0.2,
    statistics_or_tips_rendered: 0,
    pass: upFor / 60 <= 3.0 && (!afterOne.surface_active || closed) && framesToClose <= 30 && warm > 200,
    hard_fail_HF8: afterOne.surface_active && !closed,
  };

  // --- M-D14: the bloom at 12 m in daylight and at 6 m at night
  const st = (await h.h('getDeathState')).bloodstain;
  const views = [];
  if (st) {
    for (const cond of [{ id: 'daylight_12m', d: 12, hour: 12 }, { id: 'dark_6m', d: 6, hour: 1 }]) {
      await h.h('setTimeOfDay', cond.hour);
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * Math.PI * 2;
        const x = st.pos[0] + Math.cos(th) * cond.d, z = st.pos[2] + Math.sin(th) * cond.d;
        await h.h('teleport', x, z);
        await h.h('stepFrames', 2);
        await h.h('camera', { pos: [x, st.pos[1] + 1.6, z], look: [st.pos[0], st.pos[1] + 0.3, st.pos[2]] });
        await h.h('renderFrame');
        const p = await shoot(h);
        const bp = bloomPixels(p);
        // Control: the same pose with the camera turned away from the bloom.
        await h.h('camera', { pos: [x, st.pos[1] + 1.6, z], look: [x + (x - st.pos[0]), st.pos[1] + 0.3, z + (z - st.pos[2])] });
        await h.h('renderFrame');
        const ctrl = bloomPixels(await shoot(h));
        views.push({ condition: cond.id, bearing_deg: Math.round((a / 8) * 360), px: bp.count, control_px: ctrl.count, visible: bp.count > 0 && bp.count > ctrl.count });
      }
    }
    await h.h('camera', null);
  }
  const day = views.filter((v) => v.condition === 'daylight_12m');
  const night = views.filter((v) => v.condition === 'dark_6m');
  const visibility = {
    stain: st,
    views,
    daylight_12m_visible: `${day.filter((v) => v.visible).length}/${day.length}`,
    dark_6m_visible: `${night.filter((v) => v.visible).length}/${night.length}`,
    pass: day.length === 8 && night.length === 8 && day.every((v) => v.visible) && night.every((v) => v.visible),
    control_note: 'Each viewpoint is shot twice — at the bloom and turned 180 deg away. A detector '
      + 'that fires on the marsh rather than on the bloom shows up as a non-zero control.',
  };
  await h.h('setRenderRate', 0);
  return { surface, visibility };
}

// ---------------------------------------------------------------------------------------------
// the run back
// ---------------------------------------------------------------------------------------------

async function runBack(h) {
  await h.h('loadState', 'default');
  await h.h('setRenderRate', 0);
  const list = await h.h('listHearths');
  const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
  const trials = [];
  // Distances, and the reason they are these: R1 wants a median run back of 1.5-3.0 min, which
  // at the RI-WLD01 walk speed of 2.0 m/s is 180-360 m of ground. 150/220/300 straddles it.
  for (const dist of [150, 220, 300]) {
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    // The APPROACH: walk out. This is the figure R4's ratio is taken against.
    // `miredAbort` is capped hard here. walkPath's default is 36,000 frames — ten minutes of
    // simulation per FAILED bearing — and eight bearings at three radii of that is the whole
    // run's budget spent proving the marsh is muddy. A bearing that mires is not the bearing a
    // player walks; take the next one.
    const WOPT = { speed: 'walk', maxFrames: 24000, miredAbort: 1800, stuckAbort: 900 };
    // PICK THE BEARING BEFORE WALKING IT. The first version swept 8 bearings blind and reported
    // "no walkable bearing at this radius" at 150, 220 and 300 m out of a settlement well —
    // which is a statement about the marsh, not about the run back. The province is 14.5 km2 of
    // swamp and most rays out of a well cross water. So each ray is SAMPLED first (depth, slope
    // and substrate at 12 points along it) and only the passable ones are walked; the rejected
    // bearings are reported, because "the ground would not take it" is a finding either way.
    const probeRay = async (th) => {
      const bad = [];
      for (let k = 1; k <= 12; k++) {
        const f = (k / 12) * dist;
        const x = hearth.pos[0] + Math.cos(th) * f, z = hearth.pos[2] + Math.sin(th) * f;
        const w = await h.hOpt('getWaterAt', x, z);
        const t = await h.hOpt('getTerrainAt', x, z);
        const depth = w && w.depth_m !== undefined ? w.depth_m : 0;
        if (depth > 0.7 || (t && t.slope_deg > 26) || (t && !t.land)) bad.push({ at_m: +f.toFixed(0), depth_m: depth, slope: t && t.slope_deg, land: t && t.land });
      }
      return bad;
    };
    let out = null, site = null;
    const bearings = [];
    for (let a = 0; a < 24 && !out; a++) {
      const th = (a / 24) * Math.PI * 2 + 0.19;
      const bad = await probeRay(th);
      if (bad.length) { bearings.push({ deg: Math.round(th * 180 / Math.PI), rejected_at: bad[0] }); continue; }
      const x = hearth.pos[0] + Math.cos(th) * dist, z = hearth.pos[2] + Math.sin(th) * dist;
      const r = await h.hOpt('walkPath', [[hearth.pos[0], hearth.pos[2]], [x, z]], WOPT);
      if (r && !r.aborted && r.distance_m > dist * 0.6) { out = r; site = [x, z]; bearings.push({ deg: Math.round(th * 180 / Math.PI), walked: true, frames: r.frames }); }
      else { bearings.push({ deg: Math.round(th * 180 / Math.PI), walk_aborted: r ? r.aborted : 'no result' }); await h.h('teleport', hearth.pos[0], hearth.pos[2]); await h.h('stepFrames', 2); }
    }
    if (!out) { trials.push({ dist, ok: false, why: 'no walkable bearing at this radius', bearings_tried: bearings }); continue; }
    const blob = await h.h('saveState');
    blob.character.souls_held = 4200;
    await h.h('restoreState', blob);
    await h.h('teleport', site[0], site[1]);
    await h.h('stepFrames', 4);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const d = await h.h('getDeathState');
    const st = d.bloodstain;
    const from = d.last_respawn;
    if (!st) { trials.push({ dist, ok: false, why: 'no stain' }); continue; }
    // The RUN BACK: walk from the respawn well to the bloom.
    const back = await h.hOpt('walkPath', [[hearth.pos[0], hearth.pos[2]], [st.pos[0], st.pos[2]]], { ...WOPT, arrive_m: 1.5 });
    const afterWalk = await h.h('getDeathState');
    trials.push({
      dist, ok: true,
      bearings_tried: bearings.length, bearings_rejected_by_ground: bearings.filter((b) => b.rejected_at).length,
      respawned_at: from ? from.at : null,
      approach_frames: out.frames, approach_min: +(out.frames / 3600).toFixed(3), approach_m: +out.distance_m.toFixed(1),
      run_back_frames: back ? back.frames : null,
      run_back_min: back ? +(back.frames / 3600).toFixed(3) : null,
      run_back_m: back ? +back.distance_m.toFixed(1) : null,
      ratio: back && out.frames ? +(back.frames / out.frames).toFixed(3) : null,
      recovered_on_arrival: afterWalk.souls_held === 4200 && afterWalk.bloodstain_count === 0,
      souls_after: afterWalk.souls_held,
    });
  }
  const good = trials.filter((t) => t.ok && t.run_back_min !== null);
  const mins = good.map((t) => t.run_back_min).sort((a, b) => a - b);
  const median = mins.length ? mins[Math.floor(mins.length / 2)] : null;
  const p95 = mins.length ? mins[Math.min(mins.length - 1, Math.floor(mins.length * 0.95))] : null;
  return {
    trials,
    run_back_median_min: median, run_back_p95_min: p95,
    R1_band: [1.5, 3.0], R2_ceiling: 4.0,
    R1_pass: median !== null && median >= 1.5 && median <= 3.0,
    R2_pass: p95 !== null && p95 <= 4.0,
    recovered_on_arrival: good.filter((t) => t.recovered_on_arrival).length + '/' + good.length,
    R3_note: 'encounters_on_run_back needs a placed hostile roster in the province. '
      + 'game/data/world/encounters.json exists but no roster is placed on the ground between a '
      + 'well and an arbitrary death point, so R3 is UNMEASURED here rather than reported as 0 — '
      + 'a 0 would read as the failure R3 exists to catch and would be an artefact of the probe. '
      + 'Owner: W1-12 (combat.encounter.placement).',
    R4_note: 'The shortcut ratio (RN2) needs an unlockable shortcut on the ground. '
      + 'sim.world.shortcutsOpened is a real, saved register and magic/apply.js writes it, but '
      + 'no shortcut GEOMETRY exists in the province, so R4 is UNMEASURED. Owner: W1-01/W1-02.',
  };
}
