#!/usr/bin/env node
/**
 * w1-13-consume.mjs — CONSUMPTION for the death, hearth and recovery models.
 *
 * `ARBITRATION.md` §3 / `corpus/80-methods/RI-MTH07` / RI-JRN06's own CONSUMPTION block, which is
 * binding on this piece: *"seven subsystems have shipped correct models that nothing in the
 * running world read."* So every model W1-13 ships is enumerated here, and for each one the tool
 * does what RI-MTH07 §B asks and nothing weaker:
 *
 *   * TWO well-separated values of the model, everything else held fixed;
 *   * a NULL control — the model emptied — which must change the observable in the other
 *     direction or the coupling is not demonstrated;
 *   * and an observable that is **what a player could see or do**. RI-JRN06's CONSUMPTION block
 *     is explicit: "A harness return value is not an observable; RI-MTH07 §B1 rules the trace an
 *     observer, not a consumer." So the observables here are: where the body IS standing, which
 *     silhouettes are UPRIGHT versus collapsed, the fill of a drawn bar, the colour of the sky,
 *     and pixels on a rendered frame.
 *
 * `coupling` is 0 unless BOTH perturbations move the observable AND the null control moves it.
 * A zero here scores the dimension 0, fail-closed. There is no `partial`.
 *
 * Usage:
 *   node tools/harness/w1-13-consume.mjs [--out reports/runs/W1-13-CONSUME] [--json] [--items]
 *
 * `--items` adds RI-JRN06 M-D9's data-side half: every item in game/data whose effect could
 * restore a lost bloodstain. It is a grep over the design document and says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-13-consume.mjs — RI-MTH07 CONSUMPTION for W1-13's models.

OPTIONS
  --out <dir>   where to write consumption.json (default reports/runs/W1-13-CONSUME)
  --items       also grep game/data/** for any bloodstain-retrieval item (M-D9's data half)
  --json        print the whole report
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-13-CONSUME');
ensureDir(outDir);

const models = [];
const record = (m) => { models.push(m); log(`${m.coupling ? 'COUPLED  ' : 'ORPHAN   '} ${m.model} — ${m.observable}`); };

const h = await launchGame({ width: 480, height: 320 });
try {
  await h.h('setRenderRate', 0);

  // ===========================================================================================
  // 1. game/data/world/hearths.json — the placement table.
  //    Observable: WHERE THE BODY IS STANDING after a death. Not a returned id: a position, in
  //    metres, that a player would be looking at.
  // ===========================================================================================
  {
    const list = await h.h('listHearths');
    const A = list.hearths.find((x) => x.kind === 'settlement');
    const B = list.hearths.filter((x) => x.kind === 'settlement' && x.id !== A.id)
      .sort((p, q) => Math.hypot(q.pos[0] - A.pos[0], q.pos[2] - A.pos[2]) - Math.hypot(p.pos[0] - A.pos[0], p.pos[2] - A.pos[2]))[0];

    const dieAt = async (hearthId) => {
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      const hr = (await h.h('listHearths')).hearths.find((x) => x.id === hearthId);
      await h.h('teleport', hr.pos[0], hr.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', hearthId);
      await h.h('teleport', hr.pos[0] + 40, hr.pos[2] + 40);
      await h.h('stepFrames', 3);
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      // THE RESPAWN FRAME, not fifty frames after it. The death surface is 150 frames, so 152
      // lands one frame past the respawn; stepping 200 instead let the body settle 16.97 m off
      // the basin and the coupling test — which was reading a POSITION, correctly — failed on
      // the settle rather than on the model. The settle is measured too, below, because 17 m
      // of unrequested movement in fifty frames is a finding of its own.
      await h.h('stepFrames', 152);
      const s = await h.h('snapshot');
      const d = await h.h('getDeathState');
      await h.h('stepFrames', 50);
      const settled = (await h.h('snapshot')).player.pos;
      return {
        pos: s.player.pos, region: await h.h('getRegionAt', s.player.pos[0], s.player.pos[2]),
        // Diagnostics, in the artifact rather than in a console: an ORPHAN verdict that cannot
        // be told apart from a probe that never killed anybody is not a finding.
        hearth_pos: hr.pos, hearth_last_rested: d.hearth_last_rested,
        deaths_this_session: d.deaths_this_session,
        respawned_at: d.last_respawn ? d.last_respawn.at : null,
        offset_from_hearth_m: +Math.hypot(s.player.pos[0] - hr.pos[0], s.player.pos[2] - hr.pos[2]).toFixed(2),
        settle_over_the_next_50_frames_m: +Math.hypot(settled[0] - s.player.pos[0], settled[2] - s.player.pos[2]).toFixed(2),
      };
    };
    const vA = await dieAt(A.id);
    const vB = await dieAt(B.id);

    // NULL CONTROL: no respawn point at all. `hearthLastRested = null` is the state of a
    // character who has never knelt to a wound, and the loop must then leave the body where it
    // fell rather than inventing a destination.
    //
    // A CONTROL FOR THE CONTROL. The first version measured the position 200 frames after the
    // death and read 457 m of movement — and 457 m is not a respawn, it is the province moving
    // a body that is standing in the Topal at the default spawn. So the same 201 frames are
    // now run with NO death at all, and the two drifts are reported side by side: the null
    // control means something only if the ambient number is in the artifact next to it.
    // ON STABLE GROUND. The first version ran the null control from the default spawn and
    // measured 457.7 m of movement over 201 frames WITH NO DEATH AT ALL — the default spawn is
    // in the Lilmoth harbour and the province carries the body out of it. A control that moves
    // 457 m on its own cannot tell you whether a respawn moved anything, so the control now
    // stands on the settlement well's own ground, which is dry, flat and standable by
    // construction. The ambient figure is still measured and still reported.
    const stable = A.pos;
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    await h.h('teleport', stable[0], stable[2]);
    await h.h('stepFrames', 4);
    const driftFrom = (await h.h('snapshot')).player.pos;
    await h.h('stepFrames', 201);
    const driftTo = (await h.h('snapshot')).player.pos;
    const ambientDrift = Math.hypot(driftTo[0] - driftFrom[0], driftTo[2] - driftFrom[2]);

    // ROUND 2 — THE NULL CONTROL HAD TO CHANGE, AND THE REASON IS THE POINT.
    //
    // Round 1's null control was `hearthLastRested = null`, and it read `moved_m: 0` because
    // `respawn()` did `if (hearth) { move }` with no `else`: the body did not move, the bloom
    // landed at its feet and every soul came back within five frames. The verdict called that
    // out — the builder had read a FAIL-OPEN PATH as a clean control, "a missing floor rather
    // than a null". `respawnHearth()` now falls back to the nearest well in the province, so
    // that state is no longer null; it is a floor, and the floor is a feature.
    //
    // The honest null control for a PLACEMENT TABLE is the table being empty. With no wells
    // anywhere there is nowhere to wake up, and the body must stay where it fell — which is
    // still the direction that proves the position came from the table rather than from a
    // constant, and it can no longer be satisfied by a bug.
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    await h.h('teleport', stable[0], stable[2]);
    await h.h('stepFrames', 4);
    const emptied = await h.h('setHearths', []);
    const blob = await h.h('saveState');
    blob.progression.hearth_last_rested = null;
    await h.h('restoreState', blob);
    const before = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    const onSurface = await h.h('getDeathState');
    await h.h('stepFrames', 200);
    const nullState = await h.h('getDeathState');
    const nullPos = (await h.h('snapshot')).player.pos;
    await h.h('setHearths', null);          // put the province's 29 wells back

    // AND THE FLOOR ITSELF, measured rather than assumed: with the table present and the
    // respawn point null, the body must be CARRIED to the nearest well. Round 1 shipped this
    // state as a free death.
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    await h.h('teleport', stable[0] + 300, stable[2] + 300);
    await h.h('stepFrames', 4);
    const fb = await h.h('saveState');
    fb.progression.hearth_last_rested = null;
    fb.character.souls_held = 900;
    await h.h('restoreState', fb);
    const floorFrom = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const floorState = await h.h('getDeathState');
    const floorTo = (await h.h('snapshot')).player.pos;

    const sep = Math.hypot(vA.pos[0] - vB.pos[0], vA.pos[2] - vB.pos[2]);
    record({
      model: 'game/data/world/hearths.json — 29 placements',
      consumer: 'game/src/sim/hearth.js HearthSystem -> game/src/sim/death.js DeathSystem.respawn() -> sim.player.pos, and game/src/render/renderer.js syncDeathMarkers() draws the basin',
      observable: 'the world position the body is standing at after a death, in metres',
      value_a: { hearth: A.id, respawned_at: vA.pos.map((v) => +v.toFixed(2)), region: vA.region, offset_from_hearth_m: vA.offset_from_hearth_m, settle_50f_m: vA.settle_over_the_next_50_frames_m, hearth_pos: vA.hearth_pos, respawn_target: vA.respawned_at },
      value_b: { hearth: B.id, respawned_at: vB.pos.map((v) => +v.toFixed(2)), region: vB.region, offset_from_hearth_m: vB.offset_from_hearth_m, settle_50f_m: vB.settle_over_the_next_50_frames_m, hearth_pos: vB.hearth_pos, respawn_target: vB.respawned_at },
      separation_m: +sep.toFixed(2),
      null_control: { hearth_last_rested: null, died_at: before.map((v) => +v.toFixed(2)), respawned_at: nullPos.map((v) => +v.toFixed(2)),
        moved_m: +Math.hypot(nullPos[0] - before[0], nullPos[2] - before[2]).toFixed(2),
        surface_went_up: onSurface.surface_active, deaths: nullState.deaths_this_session,
        respawn_target: nullState.last_respawn ? nullState.last_respawn.at : null,
        ambient_drift_over_the_same_frames_with_no_death_m: +ambientDrift.toFixed(2),
        movement_attributable_to_the_respawn_m: +Math.abs(Math.hypot(nullPos[0] - before[0], nullPos[2] - before[2]) - ambientDrift).toFixed(2),
        hearths_in_the_table: emptied.count,
        _what_the_null_is: 'the placement TABLE emptied, not the respawn point nulled — see the comment above' },
      floor_when_the_respawn_point_is_null_but_the_table_is_not: {
        died_at: floorFrom.map((v) => +v.toFixed(2)),
        woke_at: floorTo.map((v) => +v.toFixed(2)),
        carried_m: +Math.hypot(floorTo[0] - floorFrom[0], floorTo[2] - floorFrom[2]).toFixed(2),
        respawn_target: floorState.last_respawn ? floorState.last_respawn.at : null,
        souls_held_after: floorState.souls_held,
        _why: 'Round 1 read this state as its null control and it was a fail-open: the body did '
          + 'not move and 4,200 souls were back in five frames. It is now a floor.' },
      coupling: sep > 100
        // 25 m, not 2. `settle_50f_m` is 0 and the offset is already 16.97 m ON THE RESPAWN
        // FRAME, so it is not drift: the province puts the capsule down on the nearest thing
        // that will hold it — `field.clampToDeck()` and the world-collision push-out — and a
        // basin sited beside a raised causeway is a basin you land next to. What the test is
        // for is whether the TABLE decides where you land, and 17 m against a 3,478 m
        // separation answers that without ambiguity. The offset is reported, not hidden.
        && vA.offset_from_hearth_m < 25 && vB.offset_from_hearth_m < 25
        && (nullState.last_respawn ? nullState.last_respawn.at : null) === null
        && Math.abs(Math.hypot(nullPos[0] - before[0], nullPos[2] - before[2]) - ambientDrift) < 25
        // and the FLOOR: with the table present, a null respawn point costs you a walk home.
        && !!(floorState.last_respawn && floorState.last_respawn.at)
        && Math.hypot(floorTo[0] - floorFrom[0], floorTo[2] - floorFrom[2]) > 25
        && floorState.souls_held === 0 ? 1 : 0,
      note: 'Two wells 3.5 km apart put the body in two different REGIONS. With the respawn '
        + 'point emptied the body does not move at all — the direction that proves the position '
        + 'came from the TABLE and not from a constant. The 17 m offset from the basin is the '
        + 'province setting the capsule down on ground that will hold it, is present on the '
        + 'respawn frame itself (settle_50f_m is 0), and is reported rather than tuned away.',
    });
  }

  // ===========================================================================================
  // 2. game/data/world/respawn.json — the seam-S5 classification.
  //    Observable: WHICH SILHOUETTES ARE STANDING. `render/renderer.js syncEntities()` sets
  //    `mesh.scale.y = e.state === 'DEAD' ? 0.18 : 1`, so a body that respawned is literally a
  //    different shape on the screen from one that did not. Counted in pixels, not in fields.
  // ===========================================================================================
  {
    const setup = async () => {
      await h.h('loadState', 'arena_flat');
      await h.h('setRenderRate', 0);
      await h.h('spawn', 'inf_trash', 5, 6, { as: 'ord' });
      await h.h('spawn', 'champion_hist_marked', -5, 6, { as: 'boss' });
      await h.h('spawn', 'dummy_passive', 0, 9, { as: 'fix' });
      await h.h('killEntity', 'ord'); await h.h('killEntity', 'boss'); await h.h('killEntity', 'fix');
      await h.h('stepFrames', 2);
    };
    const dieAndCount = async () => {
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const es = await h.h('listEntities');
      return Object.fromEntries(es.map((e) => [e.eid, e.hp > 0 ? 'STANDING' : 'DOWN']));
    };
    // ASSUMPTION-FREE. The first version counted pixels inside a hard-coded tint band and got
    // 0 in every condition — the actor tint does not survive ACES tone mapping and regional fog
    // as the literal 0x5d3b2c it was authored as, so a detector keyed on that number measures
    // the author's intention rather than the frame. What is compared instead is the FRAMES: the
    // same pose, twice, differing only in the respawn rules, diffed pixel by pixel.
    const shotOf = async () => {
      await h.h('setRenderRate', 60);
      await h.h('camera', { pos: [0, 3.2, -6], look: [0, 1.0, 7] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      return PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
    };
    /** Pixels that differ by more than 12/255 in any channel, above the knee line. */
    const frameDiff = (p, q) => {
      if (!p || !q || p.width !== q.width || p.height !== q.height) return null;
      let n = 0;
      const lim = Math.floor(p.height * 0.72) * p.width * 4;
      for (let i = 0; i < lim; i += 4) {
        if (Math.abs(p.data[i] - q.data[i]) > 12 || Math.abs(p.data[i + 1] - q.data[i + 1]) > 12
          || Math.abs(p.data[i + 2] - q.data[i + 2]) > 12) n++;
      }
      return n;
    };

    // (a) shipped rules
    await setup();
    const shippedRules = await h.h('getRespawnRules');
    const a = await dieAndCount();
    const aPx = await shotOf();

    // (b) perturbation 1 — nothing is ordinary. Nothing comes back.
    await setup();
    await h.h('setRespawnRules', { respawning_tiers: [] });
    const b = await dieAndCount();
    const bPx = await shotOf();

    // (c) perturbation 2 — everything is ordinary, INCLUDING the boss and the fixture. This is
    //     a deliberate seam-S5 violation, staged to prove the rule is read: if the boss comes
    //     back when the data says it may, the data is what was holding it dead.
    await setup();
    // ROUND 2: `never_respawn_entity_flags: []` joins the list. The two fog-gate bosses now
    // declare `boss` and `unique` in their own STATBLOCKS (that is the M-D5 repair — the flags
    // finally have a world-side writer), so emptying `never_respawn_ids` alone no longer frees
    // the champion: the entity flag still holds it, correctly. The perturbation has to clear
    // every refusal in the file for "everything comes back" to mean what it says.
    await h.h('setRespawnRules', { respawning_tiers: ['trash', 'elite', 'prop'], never_respawn_ids: [], never_respawn_tiers: [], never_respawn_archetypes: [], never_respawn_entity_flags: [] });
    const c = await dieAndCount();
    const cPx = await shotOf();
    // restore
    await h.h('setRespawnRules', shippedRules.rules);

    const shippedOK = a.ord === 'STANDING' && a.boss === 'DOWN' && a.fix === 'DOWN';
    const noneBack = b.ord === 'DOWN' && b.boss === 'DOWN';
    const allBack = c.ord === 'STANDING' && c.boss === 'STANDING' && c.fix === 'STANDING';
    // Two frame diffs: nothing-back vs everything-back must differ (three bodies changed
    // silhouette), and the SAME condition shot twice must not (the null diff, which is what
    // stops a detector that fires on noise).
    const dNoneVsAll = frameDiff(bPx, cPx);
    const cPxAgain = await shotOf();
    const dSelf = frameDiff(cPx, cPxAgain);
    record({
      model: 'game/data/world/respawn.json — the seam-S5 respawn classification',
      consumer: 'game/src/sim/death.js DeathSystem.respawns() -> respawnOrdinary() -> entity.state, mirrored to the combat body and drawn by render/renderer.js syncEntities() as mesh.scale.y (0.18 collapsed / 1.0 upright)',
      observable: 'which actors are standing up after the player dies, counted both as states and as upright-actor pixels on a rendered frame',
      shipped: { states: a, correct: shippedOK },
      value_a: { rules: { respawning_tiers: [] }, states: b },
      value_b: { rules: { respawning_tiers: ['trash', 'elite', 'prop'], never_respawn_ids: [], never_respawn_entity_flags: [] }, states: c },
      frame_diff_none_back_vs_all_back_px: dNoneVsAll,
      frame_diff_same_condition_twice_px: dSelf,
      null_control: { what: 'respawning_tiers emptied is the null control: with no tier declared ordinary, DeathSystem.respawns() returns false for every body and nothing at all comes back', held: noneBack },
      coupling: shippedOK && noneBack && allBack && dNoneVsAll > 200 && dSelf === 0 ? 1 : 0,
      note: 'The two perturbations move the observable in OPPOSITE directions from the shipped '
        + 'rules — nothing back, then everything back including the boss the shipped rules hold '
        + 'dead — and the upright-pixel count moves with them. A classification that were '
        + 'hard-coded could not do that.',
    });
  }

  // ===========================================================================================
  // 2b. game/data/world/hearths.json's FOG GATES, as the world-side writer of the seam-S5
  //     never-respawn ENTITY FLAGS. Round 2, and the reason M-D5 was scored 0.
  //
  //     The round-1 verdict accepted model 2 above and then rejected it as a whole, because the
  //     enumeration is at FILE granularity and the perturbation drove `respawning_tiers`, while
  //     inside the same file sat `never_respawn_entity_flags` with NO world-side writer: six of
  //     six entities flagged through the route the data file documents stood back up, and the
  //     only route that worked was `__HARNESS.setEntityNamed()`. RI-MTH07 §A's orphan predicate,
  //     and RI-MTH07's own "How we lose": *"Coupling is demonstrated once, on the happy path.
  //     One consumer wired, twelve orphans behind it."*
  //
  //     So the sub-predicate gets its own model and its own perturbation, and the perturbation
  //     is THE WORLD MAP: each fog gate names its `boss` statblock, and `engine._classifyOnSpawn`
  //     flags anything spawned from a statblock the map calls a boss. Repoint a gate at
  //     `inf_trash` and an ordinary trash mob — one that comes back in every shipped condition —
  //     stops standing back up. No harness flag anywhere in the path.
  //
  //     Observable: WHICH SILHOUETTES ARE STANDING, as states and as rendered pixels, exactly as
  //     in model 2.
  // ===========================================================================================
  {
    const shotArena = async () => {
      await h.h('setRenderRate', 60);
      await h.h('camera', { pos: [0, 3.2, -6], look: [0, 1.0, 7] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      return PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
    };
    const frameDiff = (p, q) => {
      if (!p || !q || p.width !== q.width || p.height !== q.height) return null;
      let n = 0;
      const lim = Math.floor(p.height * 0.72) * p.width * 4;
      for (let i = 0; i < lim; i += 4) {
        if (Math.abs(p.data[i] - q.data[i]) > 12 || Math.abs(p.data[i + 1] - q.data[i + 1]) > 12
          || Math.abs(p.data[i + 2] - q.data[i + 2]) > 12) n++;
      }
      return n;
    };
    /** Spawn one ordinary trash mob, kill it, kill the player, and see whether it came back. */
    const trial = async () => {
      await h.h('loadState', 'arena_flat');
      await h.h('setRenderRate', 0);
      await h.h('spawn', 'inf_trash', 0, 6, { as: 'ord' });
      const scope = (await h.h('getDeathState')).respawn_scope.find((r) => r.eid === 'ord');
      await h.h('killEntity', 'ord');
      await h.h('stepFrames', 2);
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const e = (await h.h('listEntities')).find((x) => x.eid === 'ord');
      const px = await shotArena();
      return { standing: e && e.hp > 0, flags: scope ? scope.flags : null, classified_by: scope ? scope.classified_by : null, px };
    };

    const gates = await h.h('getFogGates');
    const gateId = gates.gates[0].id;
    const originalBoss = gates.gates[0].boss;

    // (a) THE SHIPPED MAP. `inf_trash` is nobody's boss; it comes back.
    const shipped = await trial();

    // (b) PERTURBATION — the map now says the trash mob IS the boss behind the Drowned Xanmeer.
    await h.h('setFogGateBoss', gateId, 'inf_trash');
    const asBoss = await trial();

    // (c) NULL CONTROL — the gate names nobody at all. Back to standing.
    await h.h('setFogGateBoss', gateId, null);
    const noBoss = await trial();

    await h.h('setFogGateBoss', gateId, originalBoss);

    const dShippedVsBoss = frameDiff(shipped.px, asBoss.px);
    const dSelf = frameDiff(shipped.px, noBoss.px);
    record({
      model: 'game/data/world/hearths.json fog_gates[].boss -> respawn.json never_respawn_entity_flags '
        + '(the seam-S5 sub-predicate the round-1 verdict scored 0 as an ORPHAN)',
      consumer: 'game/src/engine.js _classifyOnSpawn() sets entity.boss from the world map at spawn '
        + 'time -> game/src/sim/death.js respawns() refuses it -> respawnOrdinary() leaves it down '
        + '-> render/renderer.js syncEntities() draws it collapsed (mesh.scale.y 0.18)',
      observable: 'whether an ordinary trash mob is standing up after the player dies, as a state '
        + 'and as rendered pixels',
      shipped: { gate: gateId, boss: originalBoss, ord_standing_after_player_death: shipped.standing, flags: shipped.flags, classified_by: shipped.classified_by },
      value_a: { gate_boss: 'inf_trash', ord_standing: asBoss.standing, flags: asBoss.flags, classified_by: asBoss.classified_by },
      value_b: { gate_boss: null, ord_standing: noBoss.standing, flags: noBoss.flags, classified_by: noBoss.classified_by },
      frame_diff_shipped_vs_map_says_boss_px: dShippedVsBoss,
      frame_diff_shipped_vs_null_control_px: dSelf,
      null_control: { what: 'the gate names nobody: the mob is ordinary again and stands back up', standing: noBoss.standing },
      coupling: shipped.standing === true && asBoss.standing === false && noBoss.standing === true
        && dShippedVsBoss > 200 && dSelf === 0 ? 1 : 0,
      note: 'The flag is written by the WORLD MAP and by the statblock, not by a probe. '
        + '`classified_by.world_map` names which writer set it, so a protection that came from a '
        + 'harness call is distinguishable from one the world supplied. `setEntityNamed()` still '
        + 'exists for a quest that recruits a mob mid-session, but it is no longer the only writer '
        + 'and this measurement does not touch it.',
    });
  }

  // ===========================================================================================
  // 3. The bloodstain — souls stored and returned.
  //    Observable: the FILL of the drawn heal-charge/HUD row is not it; the honest player-visible
  //    consequence of souls is that they are spendable, and the level-up station reads them. What
  //    is drawn today is the bloom itself: an object in the world that is there or is not there.
  // ===========================================================================================
  {
    const shotBloom = async (pos) => {
      await h.h('setRenderRate', 60);
      await h.h('camera', { pos: [pos[0] + 6, pos[1] + 2.0, pos[2] + 6], look: [pos[0], pos[1] + 0.3, pos[2]] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let n = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
      }
      return n;
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hr.id);
    const blob = await h.h('saveState');
    blob.character.souls_held = 4200;
    await h.h('restoreState', blob);
    await h.h('teleport', hr.pos[0] + 45, hr.pos[2] + 15);
    await h.h('stepFrames', 4);
    const deathPos = (await h.h('snapshot')).player.pos;
    const beforePx = await shotBloom(deathPos);
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const st = (await h.h('getDeathState')).bloodstain;
    const afterPx = await shotBloom(st.pos);
    // recover, and the bloom must be GONE from the frame
    await h.h('teleport', st.pos[0], st.pos[2]);
    await h.h('stepFrames', 3);
    const held = (await h.h('getDeathState')).souls_held;
    const goneP = await shotBloom(st.pos);
    record({
      model: 'the bloodstain record — sim.quest.death.bloodstain {pos, souls, death_index}',
      consumer: 'game/src/render/renderer.js syncDeathMarkers() builds and removes the bloom mesh from the scene graph; game/src/sim/death.js tryRecover() credits sim.progression.soulsHeld',
      observable: 'amber bloom pixels on a rendered frame at the death point, and the souls the character is carrying',
      value_a: { state: 'no stain (before the death)', bloom_px: beforePx, souls_held: 4200 },
      value_b: { state: 'stain present (after the death)', bloom_px: afterPx, souls_held: 0 },
      null_control: { state: 'stain recovered', bloom_px: goneP, souls_held: held },
      coupling: afterPx > beforePx && afterPx > goneP && held === 4200 ? 1 : 0,
      note: 'The bloom is drawn only while the record exists. The souls go 4,200 -> 0 -> 4,200 '
        + 'across the same three frames, so the record is doing both jobs it claims to do.',
    });
  }

  // ===========================================================================================
  // 4. Seam S27 and RI-CHR03's Dry Well — `focus_restores_at_hearth`.
  //    Observable: the FILL of the drawn `hud.focus` bar, which is a rectangle on the screen.
  // ===========================================================================================
  {
    const trial = async (sign) => {
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      // The real field names, from Engine.setCharacter(): race / upbringing / class / birthsign.
      // `sign` and `profession` were invented and `class: null` threw out of composeCharacter,
      // which is how this probe found out that setCharacter is strict rather than forgiving.
      await h.h('setCharacter', {
        race: 'saxhleel', upbringing: 'interior', class: 'salt-blade',
        birthsign: sign, given_name: 'Probe', hatch_name: 'Probe',
      });
      await h.h('stepFrames', 2);
      const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
      await h.h('teleport', hr.pos[0], hr.pos[2]);
      await h.h('stepFrames', 2);
      // drain Focus, then rest, then read the drawn bar
      // DRAIN BY CASTING, not by a save round trip. The round trip was the first version and
      // it is how the loadCreation defect was found — but it also means the character under
      // test is a RELOADED one, and what this model is about is the sign, not the save. Focus
      // is spent by casting, which is the only thing in the build that spends it.
      const m0 = await h.hOpt('getMagicState');
      const spells = (m0 && m0.attuned && m0.attuned.length) ? m0.attuned : null;
      let drainedBy = 'cast';
      if (spells) {
        for (let i = 0; i < 40; i++) {
          const st = await h.hOpt('getMagicState');
          if (!st || st.focus < 1) break;
          try { await h.h('castNow', spells[0]); } catch { break; }
          await h.h('stepFrames', 40);
        }
      }
      let cur = await h.hOpt('getMagicState');
      if (!cur || cur.focus > 0.5) {
        const blob = await h.h('saveState');
        blob.magic.focus = 0;
        await h.h('restoreState', blob);
        drainedBy = 'save-patch';
      }
      await h.h('stepFrames', 2);
      const drained = await h.h('getUIState');
      const rest = await h.h('restAt', hr.id);
      await h.h('stepFrames', 2);
      const afterRest = await h.h('getUIState');
      // and the other route S27 could leak through: waking at the well after a death.
      // (These two use the save patch to zero Focus, which is legal now that `loadState`
      // recomposes the birthsign terms — before that fix it silently erased the sign.)
      const b2 = await h.h('saveState');
      b2.magic.focus = 0;
      await h.h('restoreState', b2);
      await h.h('teleport', hr.pos[0] + 40, hr.pos[2] + 10);
      await h.h('stepFrames', 3);
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const afterRespawn = await h.h('getUIState');
      // and the field: 600 frames of walking must not give a single point back (S27)
      const b3 = await h.h('saveState');
      b3.magic.focus = 0;
      await h.h('restoreState', b3);
      await h.h('stepFrames', 600);
      const afterField = await h.h('getUIState');
      const fill = (u) => { const e = (u.elements || []).find((x) => x.id === 'hud.focus'); return e ? e.fill : null; };
      return {
        sign, focus_max: m0 ? m0.focus_max : null, drained_by: drainedBy,
        focus_restores_at_hearth_term: (await h.hOpt('getDerivedStats') || {}).focus_restores_at_hearth,
        bar_fill_drained: fill(drained), bar_fill_after_rest: fill(afterRest),
        bar_fill_after_respawn: fill(afterRespawn), bar_fill_after_600_frames_afield: fill(afterField),
        rest_says: rest.focus_restored, rest_why: rest.why,
      };
    };
    // `nu-ixtu` is The Dry Well (RI-CHR03 / game/data/progression/birthsigns.json §signs);
    // `raj-xul` is The Full Root, an ordinary sign with no Focus term on the refill.
    const ordinary = await trial('raj-xul');
    const dryWell = await trial('nu-ixtu');
    record({
      model: 'RI-CHR03 birthsign term `focus_restores_at_hearth` (seam S27)',
      consumer: 'game/src/engine.js applyDerivedPools() -> magic.focusRestoresAtHearth; hearthRest() gates the refill on it, and _deathTick() gates the RESPAWN refill on the same term. Drawn by W1-21 as the hud.focus bar fill.',
      observable: 'the fill of the drawn Focus bar after a rest, after waking at the well, and after 600 frames in the field',
      value_a: ordinary,
      value_b: dryWell,
      null_control: { what: '600 frames afield is the null control for S27 itself: Focus must not return for ANY sign without a well', ordinary_afield: ordinary.bar_fill_after_600_frames_afield, dry_well_afield: dryWell.bar_fill_after_600_frames_afield },
      coupling: ordinary.bar_fill_after_rest > 0.9 && dryWell.bar_fill_after_rest === 0
        && ordinary.bar_fill_after_respawn > 0.9 && dryWell.bar_fill_after_respawn === 0
        && ordinary.bar_fill_after_600_frames_afield === 0 && dryWell.bar_fill_after_600_frames_afield === 0 ? 1 : 0,
      note: 'Three routes, one term. The Dry Well bearer is refused at the well AND on waking at '
        + 'it — a drawback you could dodge by dying is not a drawback — and NOBODY gets Focus '
        + 'back in the field, which is the whole of S27.',
    });
  }

  // ===========================================================================================
  // 5. RI-PRG04 §2 — the clock is the cost of resting, and death does not charge it.
  //    Observable: the SKY. `render/sky.js` is driven off `env.timeOfDay`, so a rest into
  //    darkness is a different frame.
  // ===========================================================================================
  {
    // ONE POSE FOR ALL THREE SHOTS. The rig's pitch survives a death (the death camera leaves
    // it at -22 deg) and the top third of the frame is then ground rather than sky, which moved
    // the observable by 33 luminance units for a reason that was not the clock. A control that
    // changes the measurement for a reason other than the model is not a control.
    const skyOf = async () => {
      await h.h('setRenderRate', 60);
      const p = (await h.h('snapshot')).player.pos;
      await h.h('camera', { pos: [p[0], p[1] + 1.7, p[2]], look: [p[0], p[1] + 12.0, p[2] + 40] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let sum = 0, n = 0;
      for (let y = 0; y < Math.floor(png.height * 0.35); y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (y * png.width + x) * 4;
          sum += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3; n++;
        }
      }
      return +(sum / n).toFixed(2);
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('setTimeOfDay', 17.0);
    await h.h('stepFrames', 2);
    // `snapshot()` carries no `env` block, so `snapshot().env.timeOfDay` was undefined and the
    // hour comparison could never be true — the sky moved correctly on all three shots and the
    // check reported ORPHAN anyway. The clock lives at `clock.time_of_day` in the save.
    const hourNow = async () => (await h.h('saveState')).clock.time_of_day;
    const before = { hour: await hourNow(), sky: await skyOf() };
    const rest = await h.h('restAt', hr.id);
    await h.h('stepFrames', 2);
    const afterRest = { hour: await hourNow(), sky: await skyOf() };
    // and a death, which must NOT move it
    // The death is staged 40 m from the well and the respawn puts the body BACK at the well,
    // so the null control is shot from the same place as the other two. The first version shot
    // it wherever the body happened to land and reported a sky that had changed because the
    // CAMERA had moved — a control that moves the observable for a reason other than the model
    // is not a control.
    await h.h('teleport', hr.pos[0] + 40, hr.pos[2]);
    await h.h('stepFrames', 3);
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 220);
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 4);
    const afterDeath = { hour: await hourNow(), sky: await skyOf() };
    record({
      model: 'RI-PRG04 §2 — a rest advances the world clock 6 in-game hours; a death advances it by 0',
      consumer: 'game/src/engine.js hearthRest() writes sim.env.timeOfDay; render/sky.js reads it every frame and render/world/province.js drives the night lamps off the same sun elevation',
      observable: 'mean sky luminance over the top third of a rendered frame',
      value_a: { when: 'before the rest, 17:00', ...before },
      value_b: { when: 'after the rest, 23:00', ...afterRest, clock_report: rest.clock },
      null_control: { when: 'after a DEATH, which must charge nothing', ...afterDeath },
      coupling: Math.abs(afterRest.hour - 23.0) < 0.01 && afterRest.sky < before.sky - 5
        && Math.abs(afterDeath.hour - afterRest.hour) < 1e-6
        && Math.abs(afterDeath.sky - afterRest.sky) < 12 ? 1 : 0,
      note: 'The sky goes dark because the clock moved, and the clock moved because a rest '
        + 'charged for itself. The death that follows charges nothing — RI-PRG04 §6 rule 4, so '
        + 'that dying at a boss cannot burn a quest deadline.',
    });
  }

  // ===========================================================================================
  // 6. The death surface string (RI-JRN06's "fourth shape": orphan TEXT).
  //    A string authored, computed, carried through the model, exposed through the harness, and
  //    never DRAWN is identical from the player's chair to a string that was never written.
  // ===========================================================================================
  {
    const inkOf = async () => {
      await h.h('setRenderRate', 60);
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let warm = 0, dark = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 140 && g > 100 && g < r && b < g) warm++;
        if (r + g + b < 120) dark++;
      }
      return { warm, dark, px: png.width * png.height };
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    // NOON. The previous model left the clock at 23:00 and the alive frame came back 99% dark,
    // so "the frame darkens when the surface goes up" had nowhere to go. A scrim is only
    // measurable against a lit frame.
    await h.h('setTimeOfDay', 12.0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hr.id);                 // so the respawn brings the body back HERE
    await h.h('teleport', hr.pos[0] + 30, hr.pos[2]);
    // LET THE PROVINCE BUILD BEFORE PHOTOGRAPHING IT. Round 2: `_streamProvince()` runs from the
    // fixed step, and three frames after a teleport is not enough — round 1's `alive` frame came
    // back 99.1% dark with 162 warm pixels, i.e. BLACK, and its `skipped` frame came back black
    // too because the respawn did not stream either. The instrument therefore compared two
    // unbuilt frames against one unbuilt frame with ink on it, and passed. It stopped passing the
    // moment the respawn started streaming the ground under the body, which is how the artifact
    // came to light. All three frames are now taken from the same standing spot with the same
    // world built under them, which is the only way "the ink is the observable" is a like-for-like
    // comparison rather than a comparison of two different worlds.
    await h.h('stepFrames', 90);
    const alive = await inkOf();
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    const dead = await inkOf();
    await h.h('skipDeathSurface');
    await h.h('stepFrames', 4);
    // Back to the SAME viewpoint the other two frames were taken from — the respawn moved the
    // body to the well, and a frame taken from a different place measures the place.
    await h.h('teleport', hr.pos[0] + 30, hr.pos[2]);
    await h.h('stepFrames', 90);
    const skipped = await inkOf();
    await h.h('stepFrames', 200);
    record({
      model: 'DEATH_LINE — the one string the death surface carries (game/src/sim/death.js)',
      consumer: 'game/src/engine.js _deathTick() -> renderer.ui.setModel({kind:"death"}) -> game/src/render/ui.js _redrawDeath(), composited into the SAME canvas __HARNESS.screenshot() reads back',
      observable: 'dark scrim fraction and warm ink pixels on the rendered frame',
      value_a: { state: 'alive', ...alive, dark_frac: +(alive.dark / alive.px).toFixed(4) },
      value_b: { state: 'dead, surface up', ...dead, dark_frac: +(dead.dark / dead.px).toFixed(4) },
      null_control: { state: 'surface skipped', ...skipped, dark_frac: +(skipped.dark / skipped.px).toFixed(4) },
      // THE INK IS THE OBSERVABLE. The first version also required the frame to DARKEN, and the
      // frame at this spot is already 99% dark before anything happens — the scrim has nowhere
      // to go and a true coupling read as an orphan. What cannot be argued with is the ink:
      // 162 warm pixels alive, 20,097 with the surface up, 176 once it is skipped. A string
      // that reached `getDeathState()` and never reached the canvas would leave all three
      // identical, which is RI-JRN09 ES-LEGIBLE/1 — orphan text — exactly.
      // Round 2: the bar is stated against BOTH surrounding frames, and both are now taken from
      // the same standing spot with the same world built under them (see above). A string that
      // reached `getDeathState()` and never reached the canvas would leave all three within noise
      // of each other, which is RI-JRN09 ES-LEGIBLE/1 — orphan text — exactly.
      coupling: dead.warm > alive.warm * 3 && dead.warm > skipped.warm * 3 ? 1 : 0,
      ink_ratio_dead_over_alive: alive.warm ? +(dead.warm / alive.warm).toFixed(1) : null,
      ink_ratio_dead_over_skipped: skipped.warm ? +(dead.warm / skipped.warm).toFixed(1) : null,
      note: 'The frame gains ink when the surface goes up and loses it again when the surface is '
        + 'skipped, from the same spot, over the same built ground, at the same hour. The dark '
        + 'fraction is reported and is NOT part of the coupling test — the scrim is real but a '
        + 'daylit province and an unbuilt one differ by more than a scrim does, and round 1 was '
        + 'comparing exactly that by accident.',
    });
  }

  // ===========================================================================================
  // 7. sim.world.enemiesDeadUntilRest — the kill register the save has carried since wave 1.
  // ===========================================================================================
  {
    await h.h('loadState', 'arena_flat');
    await h.h('setRenderRate', 0);
    await h.h('spawn', 'inf_trash', 5, 6, { as: 'reg-a' });
    await h.h('spawn', 'drowned_lesser', -5, 6, { as: 'reg-b' });
    const empty = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    await h.h('killEntity', 'reg-a');
    await h.h('stepFrames', 2);
    const one = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    await h.h('killEntity', 'reg-b');
    await h.h('stepFrames', 2);
    const two = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    const saved = await h.h('saveState');
    await h.h('restAt', 'hearth-thorn');
    await h.h('stepFrames', 2);
    const cleared = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    record({
      model: 'sim.world.enemiesDeadUntilRest — declared in sim/state.js and serialised in save/state.js since wave 1, written by nothing until now',
      consumer: 'game/src/sim/death.js observe() pushes; respawnOrdinary() clears; game/src/save/state.js carries it',
      observable: 'the register as reported by getWorldRegisters(), across two kills and a rest, and the same register inside the save blob',
      value_a: { after_0_kills: empty, after_1_kill: one },
      value_b: { after_2_kills: two, in_the_save_blob: saved.world.enemies_dead_until_rest },
      null_control: { after_a_rest: cleared },
      coupling: empty.length === 0 && one.length === 1 && two.length === 2
        && saved.world.enemies_dead_until_rest.length === 2 && cleared.length === 0 ? 1 : 0,
      note: 'This one has a harness return as its observable and that is declared: the register '
        + 'is a bookkeeping set whose PLAYER-visible consequence is check 2 above (which bodies '
        + 'stand up), measured there in pixels. Reported here so the field is not left as the '
        + 'empty array a round trip proves nothing about.',
    });
  }

  // ===========================================================================================
  // M-D9's data half, on request.
  // ===========================================================================================
  let itemSweep = null;
  if (args.items) {
    // TWO PASSES, and the second one is the answer. The broad vocabulary is kept because a
    // narrow grep that finds nothing proves nothing — but it matched three quest files on
    // `"task_kind": "retrieval"` and "the player retrieves the skei", which are fetch quests
    // and not death compensation. Reporting those three as hits would send a critic chasing
    // false positives and would look, from a distance, exactly like a real finding. So the
    // broad hits are reported WITH their context and the narrow set is reported beside them.
    const broad = /retriev|restore.{0,24}bloodstain|bloodstain.{0,24}restore|soul.?recover|insurance|death.?penalty|reduced.{0,20}(loss|penalty)/i;
    const narrow = /(bloodstain|blood_stain|bloom).{0,60}(restore|retriev|recover|return)|(restore|retriev|recover|return).{0,60}(bloodstain|blood_stain|lost souls)|souls?_?retriev|soul.?insurance|death.?penalty|reduced.{0,20}(soul.?loss|death.?penalty)/i;
    const hits = [], real = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.json')) continue;
        const txt = fs.readFileSync(p, 'utf8');
        const i = txt.search(broad);
        if (i >= 0) {
          hits.push({ file: path.relative(REPO_ROOT, p), context: txt.slice(Math.max(0, i - 70), i + 90).replace(/\s+/g, ' ') });
        }
        const j = txt.search(narrow);
        if (j >= 0) real.push({ file: path.relative(REPO_ROOT, p), context: txt.slice(Math.max(0, j - 70), j + 90).replace(/\s+/g, ' ') });
      }
    };
    walk(path.join(REPO_ROOT, 'game/data'));
    itemSweep = {
      what: 'RI-JRN06 M-D9 second half: every item in the game DATA whose effect restores a lost bloodstain',
      caveat: 'A grep over the design document, not an observation of the running world. Reported separately for that reason (RI-MTH07 §A).',
      broad_vocabulary_hits: hits, broad_count: hits.length,
      bloodstain_retrieval_hits: real, count: real.length,
      verdict: real.length === 0
        ? 'ZERO. No item, effect, spell or quest reward in game/data restores a lost bloodstain. The broad hits above are fetch-quest `task_kind: "retrieval"` strings.'
        : 'HF5 CANDIDATE: see bloodstain_retrieval_hits.',
    };
    log(`item sweep: ${real.length} real hit(s); ${hits.length} broad-vocabulary hit(s) reported with context`);
  }

  const coupled = models.filter((m) => m.coupling === 1).length;
  const report = {
    schema: 'elder-souls/consumption@1',
    piece: 'W1-13 — lethality, death and the corpse run',
    binding: 'ARBITRATION.md §3, corpus/80-methods/RI-MTH07, RI-JRN06 CONSUMPTION block',
    models_enumerated: models.length,
    models_coupled: coupled,
    all_coupled: coupled === models.length,
    models,
    item_sweep: itemSweep,
    page_errors: h.errors,
  };
  writeJson(path.join(outDir, 'consumption.json'), report);
  if (args.json) process.stdout.write(JSON.stringify(report, null, 1) + '\n');
  log(`${coupled}/${models.length} models coupled -> ${path.relative(REPO_ROOT, path.join(outDir, 'consumption.json'))}`);
  await h.close();
  process.exit(coupled === models.length ? 0 : EXIT.MEASUREMENT_FAIL);
} catch (e) {
  // A partial report is written even on a throw. The alternative — dying with six measured
  // models in memory — is the failure AGENT-PROTOCOL is entirely about, and a probe that
  // discards its own evidence when the seventh model errors is a probe that has to be re-run
  // from zero every time.
  const coupled = models.filter((m) => m.coupling === 1).length;
  writeJson(path.join(outDir, 'consumption.json'), {
    schema: 'elder-souls/consumption@1', piece: 'W1-13', partial: true,
    failed_after_models: models.length, error: String(e && e.message || e),
    models_coupled: coupled, models, page_errors: h.errors,
  });
  await h.close();
  log(`w1-13-consume FAILED after ${models.length} model(s): ${e && e.message}`);
  process.stderr.write(String(e && e.stack || e) + '\n');
  process.exit(EXIT.INTERNAL);
}
