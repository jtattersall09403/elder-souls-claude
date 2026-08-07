#!/usr/bin/env node
// critic-w1-14-r3-motion.mjs — W1-14 round-3 CRITIC.
//
// AGENT-PROTOCOL failure mode 3, applied to the whole piece rather than to the one place it was
// found: **if the thing being measured responds to motion, the target must move.** Round 3 found
// the tracking-cutoff defect only because a strafing target exposed it. The same trap applies to
// reach, aggro, perception and hit resolution, so each is re-run here against a MOVING target and
// against a stationary control, and the two are reported side by side.
//
// It also re-derives AP-M3 independently: the turn rate is recomputed from consecutive projectile
// HEADINGS in `getHitGeometry()`, never read out of the model's own `turn_rate_dps` field, and the
// fence is recomputed from `0.35 x travel_f` per RI-MAG01's own anti-pattern table rather than from
// whatever the record calls `cutoff`.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-motion.mjs — magic measured against targets that move';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const D = H.getMagicData();
    const out = {};
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };
    const mage = (state) => {
      H.setSeed(31337); H.loadState(state || 'arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };

    // =====================================================================================
    // A. AP-M3 re-derived. Heading is differenced by the CRITIC; the fence is 0.35 x travel_f
    //    from RI-MAG01's own table, applied to the flight the bolt ACTUALLY had.
    // =====================================================================================
    const apm3 = (cls, motion, breakIt) => {
      mage('arena_flat');
      if (breakIt) H.__breakTrackingCutoff();
      const dist = 30;
      const e = H.spawn('inf_trash', motion ? 8 : 0, dist, { as: 'tgt' });
      H.stepFrames(4);
      const spec = { class: cls, range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 30, duration_s: 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, 'apm3_' + cls);
      if (mk.refused) return { cls, refused: mk.gate || mk.reason };
      if (!H.setAttuned([mk.spell.id]).length) return { cls, refused: 'attune' };
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      const heads = [], samples = [];
      let x = motion ? 8 : 0;
      for (let f = 0; f < 400; f++) {
        if (motion) { x += 3 / 60 * (Math.floor(f / 90) % 2 === 0 ? -1 : 1); H.setEntityPos('tgt', x, dist); }
        H.stepFrames(1);
        const g = H.getHitGeometry();
        const sg = g && g.spell_geometry;
        const p = sg && (Array.isArray(sg) ? sg[0] : (sg.projectiles ? sg.projectiles[0] : sg));
        if (p && p.heading_deg !== undefined && p.heading_deg !== null) {
          heads.push({ f, heading: p.heading_deg, travel_f: p.travel_f, cutoff: p.cutoff_f !== undefined ? p.cutoff_f : p.cutoff, journey_f: p.journey_f });
        } else if (heads.length) break;
      }
      if (heads.length < 2) return { cls, motion: !!motion, break: !!breakIt, note: 'no projectile heading samples', n: heads.length };
      const travel = heads[heads.length - 1].travel_f !== undefined ? heads[heads.length - 1].travel_f : heads.length;
      const fenceF = 0.35 * heads.length;            // RI-MAG01 AP-M3: 0.35 x the flight it HAD
      let maxBefore = 0, maxAfter = 0, violating = 0;
      for (let i = 1; i < heads.length; i++) {
        let d = heads[i].heading - heads[i - 1].heading;
        while (d > 180) d -= 360; while (d < -180) d += 360;
        const dps = Math.abs(d) * 60;
        const age = i;
        samples.push({ i, dps: +dps.toFixed(3) });
        if (age <= fenceF) maxBefore = Math.max(maxBefore, dps);
        else { maxAfter = Math.max(maxAfter, dps); if (dps > 2) violating++; }
      }
      return { cls, motion: !!motion, break: !!breakIt, flight_frames: heads.length,
        model_travel_f: travel, model_cutoff_f: heads[heads.length - 1].cutoff,
        fence_f_recomputed: +fenceF.toFixed(2),
        max_dps_before_fence: +maxBefore.toFixed(3), max_dps_after_fence: +maxAfter.toFixed(3),
        violating_frames_after_fence: violating, AP_M3_PASS: violating === 0 };
    };
    out.apm3 = [];
    for (const cls of ['LIGHT', 'HEAVY', 'CANTRIP']) {
      out.apm3.push(apm3(cls, true, false));
      out.apm3.push(apm3(cls, false, false));
    }
    out.apm3_break = [apm3('LIGHT', true, true), apm3('HEAVY', true, true)];

    // =====================================================================================
    // B. HIT RESOLUTION against a moving target. A bolt aimed at where a body WAS.
    // =====================================================================================
    const hitTest = (speed) => {
      mage('arena_flat');
      const e = H.spawn('inf_trash', 0, 18, { as: 'mv' });
      H.stepFrames(4);
      const spec = { class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, 'hit_' + speed);
      if (mk.refused) return { speed, refused: mk.gate };
      H.setAttuned([mk.spell.id]);
      const hp0 = H.getCombatState().enemies.find((x) => x.id === 'mv').hp;
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      let x = 0;
      for (let f = 0; f < 260; f++) { x += speed / 60; H.setEntityPos('mv', x, 18); H.stepFrames(1); }
      const en = H.getCombatState().enemies.find((x2) => x2.id === 'mv');
      const ev = H.magicEventsDrain();
      return { speed_mps: speed, hp_before: hp0, hp_after: en ? en.hp : null,
        damage: en ? +(hp0 - en.hp).toFixed(1) : null, lateral_travel_m: +x.toFixed(2),
        events: [...new Set(ev.map((v) => v.kind))] };
    };
    out.hit_resolution_vs_speed = [0, 1.5, 3, 5, 7].map(hitTest);

    // =====================================================================================
    // C. AGGRO + PERCEPTION of a CAST, moving vs still. Does a cast that misses still betray
    //    the caster? Does a moving enemy notice at the same range as a still one?
    // =====================================================================================
    const aggroTest = (moving, range) => {
      mage('arena_flat');
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true });
      const e = H.spawn('inf_trash', 0, range, { as: 'ag' });
      H.stepFrames(30);
      const s0 = H.getCombatState().enemies.find((x) => x.id === 'ag');
      const spec = { class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 10, duration_s: 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, 'ag_' + range + (moving ? 'm' : 's'));
      H.setAttuned([mk.spell.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      let x = 0;
      for (let f = 0; f < 240; f++) { if (moving) { x += 3 / 60; H.setEntityPos('ag', x, range); } H.stepFrames(1); }
      const s1 = H.getCombatState().enemies.find((x2) => x2.id === 'ag');
      const st = H.getStealthState();
      return { moving, range_m: range, state_before: s0 && s0.state, state_after: s1 && s1.state,
        alert_after: s1 && (s1.alert_state || s1.alert), V: st.V, sound_r_m: st.sound_r_m };
    };
    out.aggro_on_cast = [];
    for (const r of [8, 18, 30]) { out.aggro_on_cast.push(aggroTest(false, r)); out.aggro_on_cast.push(aggroTest(true, r)); }

    // =====================================================================================
    // D. TOUCH REACH against a moving target — the `touch` range spells, whose whole geometry
    //    is a 1.6 m contact. Moving away at walk speed should break it.
    // =====================================================================================
    const touchTest = (speed) => {
      mage('arena_flat');
      const e = H.spawn('inf_trash', 0, 1.4, { as: 'tc' });
      H.stepFrames(4);
      const spec = { class: 'LIGHT', range: 'touch', effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: 0 }] };
      const mk = H.makeSpell(spec, 'tc_' + speed);
      H.setAttuned([mk.spell.id]);
      const hp0 = H.getCombatState().enemies.find((x) => x.id === 'tc').hp;
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      let z = 1.4;
      for (let f = 0; f < 120; f++) { z += speed / 60; H.setEntityPos('tc', 0, z); H.stepFrames(1); }
      const en = H.getCombatState().enemies.find((x) => x.id === 'tc');
      return { retreat_speed_mps: speed, final_distance_m: +z.toFixed(2), damage: en ? +(hp0 - en.hp).toFixed(1) : null };
    };
    out.touch_reach_vs_retreat = [0, 1, 3, 6].map(touchTest);
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'motion.json'), report);
log('AP-M3: ' + JSON.stringify(report.apm3, null, 1));
log('AP-M3 --break: ' + JSON.stringify(report.apm3_break, null, 1));
log('hit resolution: ' + JSON.stringify(report.hit_resolution_vs_speed));
log('aggro on cast: ' + JSON.stringify(report.aggro_on_cast));
log('touch reach: ' + JSON.stringify(report.touch_reach_vs_retreat));
console.log(path.join(outDir, 'motion.json'));
