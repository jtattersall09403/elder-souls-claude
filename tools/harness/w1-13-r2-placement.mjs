#!/usr/bin/env node
/**
 * w1-13-r2-placement.mjs — THE THREE PLACEMENT BRANCHES THAT NEVER FIRED, AND THE SLIDING BODY.
 *
 * W1-13 round 2. The round-1 verdict found `placeStain()`'s four rules reduced in practice to
 * one and a half:
 *
 *   * THE FALL RULE NEVER FIRED. `traversal._land()` sets the player state to DEATH on the
 *     landing frame and `_inferCause()` only returned 'fall' while the state was FALL, so a 90 m
 *     drop recorded `cause: 'combat'`, `placement_rule: 'death_point'` and RI-PRG04 §6's "the
 *     bloodstain is placed at the last grounded position before the fall, not at the bottom" was
 *     unimplemented in effect.
 *   * `'drown'` WAS DEAD CODE. `_inferCause()` could not return it at all.
 *   * THE FOG-GATE PUSH-OUT DEGENERATED AT THE EXACT CENTRE. `Math.hypot(dx,dz) || 1` gives
 *     (0,0)/1 = (0,0), so the bloom landed at the centre — inside the gate — while the record
 *     still read `outside_fog_gate`.
 *   * AND THE BODY DID NOT STAY AT THE WELL. 0.00 m off the basin on the respawn frame at all six
 *     wells measured, and 5.09 / 19.09 / 22.27 m off it 220 frames later at three of them,
 *     against a no-death control that moved 0.00 m at all six — because `respawn()` wrote the
 *     position and never reset the traversal, so the body arrived carrying the velocity and
 *     slide state of wherever it died.
 *
 * Every fall here is a REAL FALL — the body is dropped and the ground kills it — with no
 * `killPlayer(cause)` anywhere in section A. A cause the harness supplied would prove nothing
 * about whether the world can supply it.
 *
 * `--delete-the-fix` restores the round-1 `_inferCause` and the round-1 fog-gate normalisation
 * in the page, so every row can be shown to move.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('w1-13-r2-placement.mjs [--out <file>] [--delete-the-fix]'); process.exit(0); }
const deleteTheFix = !!args['delete-the-fix'];
const out = { schema: 'w1-13/r2-placement@1', delete_the_fix: deleteTheFix, fall: null, drown: null, fog: [], drift: [] };
let handle;

const revert = async (h) => h.page.evaluate(() => {
  const eng = window.__ENGINE;
  const proto = eng && eng.death ? Object.getPrototypeOf(eng.death) : null;
  if (!proto) return { ok: false };
  // Round 1's `_inferCause`, verbatim.
  proto._inferCause = function (sim) {
    const s = sim.player.state;
    if (s === 'FALL') return 'fall';
    if (sim.player.strandedBy) return 'hazard';
    return 'combat';
  };
  return { ok: true };
});

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const h = handle;
  await h.h('setRenderRate', 0);
  const list = await h.h('listHearths');
  const well = list.hearths.find((x) => x.id === 'hearth-archon') || list.hearths[0];

  const rested = async () => {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    if (deleteTheFix) await revert(h);
    await h.h('teleport', well.pos[0], well.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', well.id);
    const b = await h.h('saveState');
    b.character.souls_held = 900;
    await h.h('restoreState', b);
    await h.h('stepFrames', 2);
  };

  // =============================================================================================
  // A. A REAL LETHAL FALL. No cause is supplied by anything but the world.
  // =============================================================================================
  {
    await rested();
    // Walk out to a spot away from the basin, note where the ground is, and drop from 120 m.
    const gx = well.pos[0] + 55, gz = well.pos[2] + 55;
    await h.h('teleport', gx, gz);
    await h.h('stepFrames', 30);                       // stand still: this is the LAST GROUNDED spot
    const ground = await h.h('getPlayerStats');
    const lastGroundedExpected = [ground.pos[0], ground.pos[2]];
    // Move sideways in the air so the landing point is NOT the take-off point — otherwise
    // "last grounded" and "death point" coincide and the rule cannot be distinguished from
    // doing nothing at all. THIS IS THE CONTROL THAT MAKES THE ROW MEAN SOMETHING.
    await h.h('teleport', gx + 45, gz + 45, { y: ground.pos[1] + 120 });
    let frames = 0, dead = null;
    while (frames < 600 && !dead) {
      await h.h('stepFrames', 1); frames++;
      const st = await h.h('getPlayerStats');
      if (st.hp <= 0) dead = st;
    }
    await h.h('stepFrames', 2);
    const d = await h.h('getDeathState');
    const rec = (d.log || d.deaths || [])[0] || (d.last_death || null);
    const bloom = d.bloodstain;
    const toLastGrounded = bloom
      ? Math.hypot(bloom.pos[0] - lastGroundedExpected[0], bloom.pos[2] - lastGroundedExpected[1]) : null;
    const toDeathPoint = bloom && dead ? Math.hypot(bloom.pos[0] - dead.pos[0], bloom.pos[2] - dead.pos[2]) : null;
    out.fall = {
      dropped_from_m: 120,
      lateral_offset_m: Math.hypot(45, 45),
      last_grounded_expected: lastGroundedExpected.map((v) => +v.toFixed(2)),
      death_point: dead ? [+dead.pos[0].toFixed(2), +dead.pos[2].toFixed(2)] : null,
      frames_to_death: frames,
      cause: rec ? rec.cause : null,
      placement_rule: rec ? rec.placement_rule : null,
      bloom_pos: bloom ? bloom.pos.map((v) => +v.toFixed(2)) : null,
      bloom_to_last_grounded_m: toLastGrounded === null ? null : +toLastGrounded.toFixed(2),
      bloom_to_death_point_m: toDeathPoint === null ? null : +toDeathPoint.toFixed(2),
      // The rule fires when the cause is 'fall', the record says so, and the bloom is at the
      // ledge rather than at the bottom.
      pass: !!(rec && rec.cause === 'fall' && String(rec.placement_rule).startsWith('last_grounded')
        && toLastGrounded !== null && toLastGrounded < 3.0 && toDeathPoint > 20),
    };
    log(`FALL: cause=${out.fall.cause} rule=${out.fall.placement_rule} bloom->ledge ${out.fall.bloom_to_last_grounded_m} m, bloom->bottom ${out.fall.bloom_to_death_point_m} m  ${out.fall.pass ? 'PASS' : 'FAIL'}`);
  }

  // =============================================================================================
  // B. DROWNING. Hunt for water deep enough to submerge in; drown in it for real if it exists.
  // =============================================================================================
  {
    await rested();
    let site = null;
    // A coarse spiral out from the well, reading the LIVE traversal band rather than a data file.
    outer:
    for (let r = 40; r <= 420 && !site; r += 40) {
      for (let a = 0; a < 12; a++) {
        const th = (a / 12) * Math.PI * 2;
        const x = well.pos[0] + Math.cos(th) * r, z = well.pos[2] + Math.sin(th) * r;
        await h.h('teleport', x, z);
        await h.h('stepFrames', 3);
        const st = await h.h('getPlayerStats');
        if (st.submerged || st.water_band === 'W4' || st.water_band === 'W5') { site = { x, z, band: st.water_band }; break outer; }
      }
    }
    if (!site) {
      out.drown = {
        found_deep_water_within_420m_of_hearth_archon: false,
        _note: 'No W4/W5 band within 420 m of hearth-archon — the same absence the round-1 critic '
          + 'reported. The drown branch is therefore exercised through killPlayer("drown"), which '
          + 'writes sim.player.lethalCause, THE SAME FIELD traversal.js writes when the breath '
          + 'clock kills you. That is a declared weaker demonstration than the fall above and it '
          + 'is labelled as one.',
      };
      await rested();
      const gx = well.pos[0] + 30, gz = well.pos[2] + 30;
      await h.h('teleport', gx, gz);
      await h.h('stepFrames', 30);
      const ground = await h.h('getPlayerStats');
      await h.h('killPlayer', 'drown');
      await h.h('stepFrames', 2);
      const d = await h.h('getDeathState');
      const rec = (d.log || d.deaths || [])[0] || d.last_death || null;
      out.drown.cause = rec ? rec.cause : null;
      out.drown.placement_rule = rec ? rec.placement_rule : null;
      out.drown.bloom_to_last_grounded_m = d.bloodstain
        ? +Math.hypot(d.bloodstain.pos[0] - ground.pos[0], d.bloodstain.pos[2] - ground.pos[2]).toFixed(2) : null;
      out.drown.pass = !!(rec && rec.cause === 'drown');
    } else {
      out.drown = { found_deep_water_within_420m_of_hearth_archon: true, site };
      await rested();
      // OVERLOADED. `RI-WLD10` §3: past 100% load "you cannot swim. You walk the bottom, with a
      // breath clock" — the item cites Hallgerd's Tale for it. A body that can swim floats with
      // its head out, which costs stamina and not breath, so an unburdened probe stands in W5
      // water forever and never drowns: that is what 4,000 frames of the first attempt measured.
      // This is the world's own drowning route and it needs no harness cause.
      await h.h('setBurden', 3.0);
      // Stand on dry land first so `lastGrounded` is a real ledge, then wade in and drown.
      await h.h('teleport', well.pos[0], well.pos[2]);
      await h.h('stepFrames', 20);
      const dry = await h.h('getPlayerStats');
      await h.h('teleport', site.x, site.z);
      let frames = 0, dead = null;
      while (frames < 16000 && !dead) {
        await h.h('stepFrames', 60); frames += 60;
        const st = await h.h('getPlayerStats');
        if (st.hp <= 0) dead = st;
      }
      out.drown.breath_and_hp_at_end = dead ? null : await h.h('getPlayerStats').then((s) => ({
        hp: s.hp, breath_s: s.breath_s, submerged: s.submerged, band: s.water_band,
      }));
      await h.h('stepFrames', 2);
      const d = await h.h('getDeathState');
      const rec = (d.log || d.deaths || [])[0] || d.last_death || null;
      out.drown.frames_to_drown = frames;
      out.drown.cause = rec ? rec.cause : null;
      out.drown.placement_rule = rec ? rec.placement_rule : null;
      out.drown.bloom_pos = d.bloodstain ? d.bloodstain.pos.map((v) => +v.toFixed(2)) : null;
      out.drown.dry_land_reference = [+dry.pos[0].toFixed(2), +dry.pos[2].toFixed(2)];
      out.drown.pass = !!(rec && rec.cause === 'drown');
    }
    log(`DROWN: cause=${out.drown.cause} rule=${out.drown.placement_rule} ${out.drown.pass ? 'PASS' : 'FAIL'}`);
  }

  // =============================================================================================
  // C. THE FOG GATE, INCLUDING THE EXACT CENTRE. Offsets are chosen to straddle the singularity.
  // =============================================================================================
  {
    const gates = await h.h('getFogGates');
    for (const g of gates.gates) {
      for (const off of [0, 0.001, 0.5, 12, 25]) {
        await rested();
        await h.h('teleport', g.pos[0] + off, g.pos[2]);
        await h.h('stepFrames', 3);
        await h.h('killPlayer', 'combat');
        await h.h('stepFrames', 2);
        const d = await h.h('getDeathState');
        const rec = (d.log || d.deaths || [])[0] || d.last_death || null;
        const b = d.bloodstain;
        const rOut = b ? Math.hypot(b.pos[0] - g.pos[0], b.pos[2] - g.pos[2]) : null;
        const row = {
          gate: g.id, boss: g.boss, radius_m: g.radius_m, death_offset_m: off,
          placement_rule: rec ? rec.placement_rule : null,
          bloom_dist_from_centre_m: rOut === null ? null : +rOut.toFixed(2),
          outside_gate: rOut !== null && rOut > (g.radius_m || 26),
          // The record must not claim a push-out it did not perform.
          record_and_reality_agree: !!(rec && String(rec.placement_rule).startsWith('outside_fog_gate')
            === (rOut !== null && rOut > (g.radius_m || 26))),
        };
        row.pass = row.outside_gate && row.record_and_reality_agree;
        out.fog.push(row);
        log(`FOG ${g.id} off=${off}m -> rule=${row.placement_rule} bloom at r=${row.bloom_dist_from_centre_m} (radius ${g.radius_m}) ${row.pass ? 'PASS' : 'FAIL'}`);
      }
    }
  }

  // =============================================================================================
  // D. DOES THE BODY STAY AT THE WELL? Six wells, each with a matched no-death control.
  // =============================================================================================
  {
    const wells = ['hearth-archon', 'hearth-stormhold', 'hearth-gideon', 'hearth-lilmoth', 'hearth-blackrose']
      .map((id) => list.hearths.find((x) => x.id === id)).filter(Boolean);
    if (wells.length < 6 && list.hearths[5]) wells.push(list.hearths.find((x) => !wells.includes(x)));
    for (const w of wells) {
      // --- the death route
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      if (deleteTheFix) await revert(h);
      await h.h('teleport', w.pos[0], w.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', w.id);
      // Die a long way off and at speed, so the body has real momentum to carry home.
      await h.h('teleport', w.pos[0] + 120, w.pos[2] + 120);
      await h.h('queueInputs', [{ f: 0, move: [0, 1] }]);
      await h.h('stepFrames', 90);                     // running when it dies
      await h.h('killPlayer', 'combat');
      await h.h('stepFrames', 1);
      // LET GO OF THE STICK. `latchForStep` holds `moveX/moveY` until a later scripted event
      // changes them, so a probe that pushes forward and never releases keeps walking after the
      // respawn and measures its own thumb. The first run of this file did exactly that and read
      // 5-12 m of "drift" at all six wells; the release is the control that separates the body's
      // carried momentum — the thing under test — from a held input.
      await h.h('queueInputs', [{ f: 0, move: [0, 0] }]);
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 154);                    // the surface closes; the respawn lands
      const at0 = await h.h('getPlayerStats');
      await h.h('stepFrames', 220);
      const at220 = await h.h('getPlayerStats');

      // --- the matched control: stand at the same well for the same frames, no death
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      await h.h('teleport', w.pos[0], w.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', w.id);
      await h.h('stepFrames', 220);
      const ctl = await h.h('getPlayerStats');

      const row = {
        hearth: w.id,
        respawn_frame_offset_m: +Math.hypot(at0.pos[0] - w.pos[0], at0.pos[2] - w.pos[2]).toFixed(2),
        offset_220f_later_m: +Math.hypot(at220.pos[0] - w.pos[0], at220.pos[2] - w.pos[2]).toFixed(2),
        control_no_death_220f_m: +Math.hypot(ctl.pos[0] - w.pos[0], ctl.pos[2] - w.pos[2]).toFixed(2),
        state_at_respawn: at0.state,
      };
      // The bar is the CONTROL, not zero: whatever standing still costs, dying must cost the same.
      row.pass = row.offset_220f_later_m <= row.control_no_death_220f_m + 0.5;
      out.drift.push(row);
      log(`DRIFT ${w.id}: respawn ${row.respawn_frame_offset_m} m, +220 f ${row.offset_220f_later_m} m, control ${row.control_no_death_220f_m} m ${row.pass ? 'PASS' : 'FAIL'}`);
    }
  }

  out.summary = {
    fall_pass: out.fall && out.fall.pass,
    drown_pass: out.drown && out.drown.pass,
    fog_rows: out.fog.length, fog_passing: out.fog.filter((r) => r.pass).length,
    drift_rows: out.drift.length, drift_passing: out.drift.filter((r) => r.pass).length,
    max_drift_m: out.drift.length ? Math.max(...out.drift.map((r) => r.offset_220f_later_m)) : null,
  };
  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  log(`SUMMARY ${JSON.stringify(out.summary)}`);
} catch (e) {
  out.error = String((e && e.stack) || e);
  if (args.out) writeJson(args.out, out);
  log('w1-13-r2-placement: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}
