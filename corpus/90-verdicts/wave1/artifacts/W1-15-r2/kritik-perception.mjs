#!/usr/bin/env node
// kritik-perception.mjs — the W1-15 ROUND-2 CRITIC's OWN instrument.
//
// Deliberately NOT tools/harness/w1-15-coupling.mjs. The builder shipped the tool that grades
// its own headline number (coupling 0.9986), which is exactly what RI-MTH07 exists to police.
// This file is written from RI-STL01 §2/§3/§4 and RI-AI01 §B, drives the running world, and
// observes ENTITY-SIDE quantities only (alert meter, alert_state, los, positions).
//
// It also does the thing the brief asks and the builder's probe does not: it perturbs EACH
// INPUT OF V INDEPENDENTLY. A coupling of 1.0 against V is also consistent with alert being a
// pure function of V with distance, facing and occlusion folded in wrongly.
//
// USAGE: node .../kritik-perception.mjs [--json <path>]
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson } from '../../../../../tools/lib/cli.mjs';
import { launchGame } from '../../../../../tools/lib/browser.mjs';

const USAGE = 'kritik-perception.mjs — RI-STL01 §2/§4 asked of entities, by the critic.\n';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
args.width = args.width || 320;
args.height = args.height || 240;

const h = await launchGame(args);
const R = { schema: 'elder-souls/critic-probe@1', piece: 'W1-15', round: 2, blocks: {} };
const say = (s) => process.stdout.write(s + '\n');
const rec = (k, v) => { R.blocks[k] = v; say(`--- ${k}\n${JSON.stringify(v, null, 1)}`); };

// Independent re-implementation of RI-STL01 §2, from the ITEM not from game/src.
const DET = JSON.parse(fs.readFileSync('game/data/stealth/detection.json', 'utf8'));
const ITEM_M = { still: 0.55, crouch_move: 1.00, walk: 1.45, sprint: 2.10 };
const ITEM_E = { light: 0.90, medium: 1.00, heavy: 1.25, overloaded: 1.55 };
function itemV({ L, motion, sneak, load, inCover }) {
  const S = Math.max(0.40, 1.00 - 0.006 * sneak);
  const A = inCover ? 0.80 : 1.00;
  const raw = Math.pow(Math.max(0, Math.min(1, L)), 0.7) * ITEM_M[motion] * S * ITEM_E[load] * A;
  return Math.max(0.05, Math.min(1.30, raw));
}
// RI-AI01 §B geometry as RI-STL01 §2's worked table pins it: 150 x V x (1 - d/R).
function itemFillPerS(V, dist, R, cone) {
  if (dist >= R) return 0;
  const g = 150 * (1 - dist / R) * V;
  return cone === 'peripheral' ? g * 0.35 : cone === 'primary' ? g : 0;
}

try {
  rec('build', { info: h.buildInfo, harness_version: h.harnessVersion });
  await h.h('setRenderRate', 0);

  // Expose an in-page runner. Everything below steps INSIDE page.evaluate (AGENT-PROTOCOL:
  // one rendered SwiftShader frame per simulation frame otherwise).
  await h.page.evaluate(() => {
    const H = window.__HARNESS;
    window.__K = {
      // Set up an enemy at (0, dist) facing the player at origin, with the given stealth terms.
      arena(o) {
        H.setSeed(1337);
        H.loadState('arena_flat');
        H.setRenderRate(0);
        H.teleport(0, 0);
        if (o.tod !== undefined) H.setTimeOfDay(o.tod);
        const z = o.zone || 'zk';
        const patch = { sneak: o.sneak, load: o.load, surface: o.surface || 'mud', zone: z };
        if (o.inCover !== undefined) patch.inCover = o.inCover;
        H.setStealthState(patch);
        H.setZoneAmbient(z, o.amb);
        H.setPlayerMotion(o.motion || null);
        H.setCrimeContext(o.context || 'public_street_sheathed');
        const eid = o.eid || 'ek';
        H.spawn(o.arch || 'inf_trash', o.ex === undefined ? 0 : o.ex, o.dist, { as: eid });
        if (o.yaw !== undefined) H.setEntityPos(eid, o.ex === undefined ? 0 : o.ex, o.dist, { yaw: o.yaw });
        return eid;
      },
      // Step until the named entity reaches AGGRO, or cap. Returns the frame count and a curve.
      toAggro(eid, capF, sampleEvery) {
        const f0 = H.getFrame();
        const curve = [];
        let hit = null;
        const N = capF || 3600;
        for (let i = 0; i < N; i++) {
          H.stepFrames(1);
          const ps = H.perceptionState();
          const e = ps.find((x) => x.eid === eid);
          if (!e) break;
          if (sampleEvery && (i % sampleEvery === 0)) curve.push({ df: i + 1, alert: e.alert, st: e.alert_state, ch: e.alert_channel, los: e.los });
          if (e.alert_state === 'AGGRO') { hit = H.getFrame() - f0; break; }
        }
        const ps = H.perceptionState();
        const e = ps.find((x) => x.eid === eid) || null;
        const st = H.getStealthState();
        return {
          aggro_f: hit, aggro_s: hit === null ? null : +(hit / 60).toFixed(4),
          final: e, curve,
          V: st.V, L: st.light === undefined ? st.L : st.light, motion: st.motion,
          sound_r_m: st.sound_r_m === undefined ? st.soundR : st.sound_r_m,
          stealth: st,
        };
      },
      // Measure the raw per-second fill rate by watching the meter over n frames from 0.
      fillRate(eid, n) {
        const ps0 = H.perceptionState().find((x) => x.eid === eid);
        const a0 = ps0 ? ps0.alert : 0;
        H.stepFrames(n);
        const ps1 = H.perceptionState().find((x) => x.eid === eid);
        const a1 = ps1 ? ps1.alert : 0;
        return {
          a0, a1, delta: +(a1 - a0).toFixed(4), per_s: +(((a1 - a0) / n) * 60).toFixed(4),
          state: ps1 ? ps1.alert_state : null, channel: ps1 ? ps1.alert_channel : null,
          los: ps1 ? ps1.los : null, dist_m: ps1 ? ps1.dist_m : null,
        };
      },
    };
    return true;
  });

  // =========================================================================================
  // BLOCK 1 — RI-STL01 §2's five worked rows, measured by ME against the RUNNING WORLD.
  // =========================================================================================
  const ROWS = [
    { id: 'r1-sprint-torchlit-heavy-S5', tod: 12, amb: 0.85, motion: 'sprint', sneak: 5, load: 'heavy', inCover: false, item_L: 0.85, item_V: 1.30, item_rate: 97.5, item_s: 1.03 },
    { id: 'r2-walk-dim-medium-S5', tod: 12, amb: 0.35, motion: 'walk', sneak: 5, load: 'medium', inCover: false, item_L: 0.35, item_V: 0.339, item_rate: 25.4, item_s: 3.94 },
    { id: 'r3-crouch-dim-light-S45', tod: 12, amb: 0.35, motion: 'crouch_move', sneak: 45, load: 'light', inCover: false, item_L: 0.35, item_V: 0.157, item_rate: 11.8, item_s: 8.5 },
    { id: 'r4-crouch-unlit-light-S45-cover', tod: 1.5, amb: 0.06, motion: 'crouch_move', sneak: 45, load: 'light', inCover: true, item_L: 0.06, item_V: 0.050, item_rate: 3.75, item_s: 26.7 },
    { id: 'r5-still-unlit-light-S100-cover', tod: 1.5, amb: 0.06, motion: 'still', sneak: 100, load: 'light', inCover: true, item_L: 0.06, item_V: 0.050, item_rate: 3.75, item_s: 26.7 },
  ];
  const m2 = [];
  for (const row of ROWS) {
    const r = await h.page.evaluate((o) => {
      const eid = window.__K.arena({ tod: o.tod, amb: o.amb, motion: o.motion, sneak: o.sneak, load: o.load, inCover: o.inCover, dist: 8, zone: 'z' + o.id, eid: 'e' + o.id });
      window.__HARNESS.stepFrames(1);           // let the stealth step compute V once
      return window.__K.toAggro(eid, 3000, 600);
    }, row);
    const myV = itemV({ L: r.L, motion: row.motion, sneak: row.sneak, load: row.load, inCover: row.inCover });
    const myRate = itemFillPerS(myV, 8, 16, 'primary');
    m2.push({
      ...row,
      measured_L: r.L, measured_V: r.V, measured_motion: r.motion,
      critic_V_from_measured_L: +myV.toFixed(6),
      critic_predicted_rate_per_s: +myRate.toFixed(4),
      critic_predicted_s: myRate > 0 ? +(100 / myRate).toFixed(4) : null,
      observed_aggro_s: r.aggro_s,
      err_vs_item_pct: r.aggro_s === null ? null : +(((r.aggro_s - row.item_s) / row.item_s) * 100).toFixed(3),
      err_vs_critic_model_pct: (r.aggro_s === null || myRate <= 0) ? null : +(((r.aggro_s - 100 / myRate) / (100 / myRate)) * 100).toFixed(3),
      final: r.final, curve: r.curve,
    });
  }
  rec('B1-RI-STL01-M2-five-rows', {
    question: 'RI-STL01 §2 worked table: one INFANTRY (R=16) at 8 m in its primary cone. Time to AGGRO.',
    note: 'critic_V is recomputed from the ITEM formula against the L the world reports, not read back from the engine',
    rows: m2,
  });

  // Coupling on the pair RI-MTH07 §C used: row 1 vs row 4.
  const a = m2[0], b = m2[3];
  const couplingV = (a.observed_aggro_s !== null && b.observed_aggro_s !== null)
    ? Math.abs(b.observed_aggro_s - a.observed_aggro_s) / Math.abs(b.critic_predicted_s - a.critic_predicted_s) : null;
  rec('B2-coupling-V-to-alert', {
    method: 'RI-MTH07 §B: perturb V, hold distance/facing/occlusion fixed, observe an entity-side quantity',
    model_value_a: a.measured_V, model_value_b: b.measured_V,
    predicted_a_s: a.critic_predicted_s, predicted_b_s: b.critic_predicted_s,
    observed_a_s: a.observed_aggro_s, observed_b_s: b.observed_aggro_s,
    coupling: couplingV === null ? null : +couplingV.toFixed(4),
    round1_value: 0.00,
  });

  // =========================================================================================
  // BLOCK 3 — EACH INPUT INDEPENDENTLY. Is alert a function of V *and* of geometry, or has
  // geometry been folded into V wrongly? Vary one term at a time and compare the MEASURED
  // per-second fill against the item's own 150·V·(1−d/R)·cone.
  // =========================================================================================
  const axis = [];
  const BASE = { tod: 12, amb: 0.35, motion: 'walk', sneak: 5, load: 'medium', dist: 8, yaw: 180, cover: false };
  const CASES = [
    { id: 'base', ...BASE },
    // light only
    { id: 'L-sun', ...BASE, amb: 1.00 },
    { id: 'L-unlit', ...BASE, amb: 0.04 },
    // motion only
    { id: 'M-still', ...BASE, motion: 'still' },
    { id: 'M-sprint', ...BASE, motion: 'sprint' },
    // sneak only
    { id: 'S-100', ...BASE, sneak: 100 },
    // load only
    { id: 'E-light', ...BASE, load: 'light' },
    { id: 'E-overloaded', ...BASE, load: 'overloaded' },
    // distance only  (geometry term 1 - d/R)
    { id: 'd-2m', ...BASE, dist: 2 },
    { id: 'd-14m', ...BASE, dist: 14 },
    { id: 'd-15.9m', ...BASE, dist: 15.9 },
    // bearing only: rotate the OBSERVER so the player sits in peripheral / rear arc.
    // enemy at (0,8) with yaw 180 looks at the origin. yaw 180-70 puts the player at 70 deg.
    { id: 'bearing-70-peripheral', ...BASE, yaw: 110 },
    { id: 'bearing-170-rear', ...BASE, yaw: 10 },
    // cover only (forced, as the item's own table states it)
    { id: 'A-cover-forced', ...BASE, cover: true },
  ];
  for (const c of CASES) {
    const r = await h.page.evaluate((o) => {
      const eid = window.__K.arena({
        tod: o.tod, amb: o.amb, motion: o.motion, sneak: o.sneak, load: o.load,
        dist: o.dist, yaw: o.yaw, zone: 'z' + o.id, eid: 'e' + o.id,
        inCover: o.cover ? true : undefined,
      });
      window.__HARNESS.stepFrames(2);
      const f = window.__K.fillRate(eid, 30);
      const st = window.__HARNESS.getStealthState();
      return { f, V: st.V, L: st.light === undefined ? st.L : st.light, motion: st.motion, sound_r_m: st.sound_r_m === undefined ? st.soundR : st.sound_r_m, in_cover: st.in_cover, stealth: st };
    }, c);
    // What cone does the item put the player in?
    const bearing = ((0 - 0) === 0) ? Math.abs(((Math.atan2(0 - 0, 0 - c.dist) * 180 / Math.PI) - c.yaw + 540) % 360 - 180) : null;
    const cone = bearing <= 55 ? 'primary' : bearing <= 100 ? 'peripheral' : 'none';
    const V = itemV({ L: r.L, motion: c.motion, sneak: c.sneak, load: c.load, inCover: !!c.cover });
    const pred = itemFillPerS(V, c.dist, 16, cone);
    axis.push({
      case: c.id, varied: c.id.split('-')[0],
      L: r.L, engine_V: r.V, critic_V: +V.toFixed(6), in_cover: r.in_cover,
      bearing_deg: +bearing.toFixed(1), cone,
      predicted_per_s: +pred.toFixed(4), measured_per_s: r.f.per_s,
      ratio: pred > 0 ? +(r.f.per_s / pred).toFixed(4) : (r.f.per_s === 0 ? 1 : Infinity),
      channel: r.f.channel, los: r.f.los, dist_m: r.f.dist_m, sound_r_m: r.sound_r_m,
    });
  }
  rec('B3-input-independence', {
    question: 'Vary ONE term of V (or of the geometry) at a time, hold the rest. Does the measured fill rate track 150·V·(1−d/R)·cone, or is something folded in wrongly?',
    base: BASE, cases: axis,
  });

  // =========================================================================================
  // BLOCK 4 — NULL CONTROLS. RI-MTH07 §B3.
  // =========================================================================================
  const nulls = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    // (a) beyond R
    let eid = window.__K.arena({ tod: 12, amb: 1.00, motion: 'sprint', sneak: 5, load: 'heavy', dist: 30, zone: 'zn1', eid: 'en1' });
    H.stepFrames(2);
    out.beyond_R_30m = window.__K.fillRate(eid, 600);
    // (b) rear arc AND still (no hearing) at 3 m
    eid = window.__K.arena({ tod: 12, amb: 1.00, motion: 'still', sneak: 5, load: 'heavy', dist: 3, yaw: 0, zone: 'zn2', eid: 'en2' });
    H.stepFrames(2);
    out.rear_arc_still_3m = window.__K.fillRate(eid, 600);
    // (c) M4 no-proximity-leak: crouched, unlit, 1.0 m directly BEHIND a stationary enemy
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'still', sneak: 100, load: 'light', dist: 1.0, yaw: 0, zone: 'zn3', eid: 'en3' });
    H.stepFrames(2);
    out.M4_behind_1m_3600f = window.__K.fillRate(eid, 3600);
    return out;
  });
  rec('B4-null-controls', nulls);

  // =========================================================================================
  // BLOCK 5 — OCCLUSION. A wall between the eyes and the chest.
  // =========================================================================================
  const occ = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    // open control
    let eid = window.__K.arena({ tod: 12, amb: 1.00, motion: 'walk', sneak: 5, load: 'heavy', dist: 8, zone: 'zo1', eid: 'eo1' });
    H.stepFrames(2);
    out.open = window.__K.toAggro(eid, 1200, 0);
    out.open_los = H.losBetween([0, 1.35, 0], [0, 1.55, 8]);
    // walled
    eid = window.__K.arena({ tod: 12, amb: 1.00, motion: 'walk', sneak: 5, load: 'heavy', dist: 8, zone: 'zo2', eid: 'eo2' });
    H.addOccluder({ id: 'wall_k', min: [-6, 0, 3.6], max: [6, 4, 4.4] });
    H.stepFrames(2);
    out.wall_los = H.losBetween([0, 1.35, 0], [0, 1.55, 8]);
    out.walled = window.__K.toAggro(eid, 1200, 0);
    out.occluders = H.listOccluders();
    // and the perturbation-of-a-perturbation: remove nothing, but stand where LOS is clear again
    return out;
  });
  rec('B5-occlusion', occ);

  // =========================================================================================
  // BLOCK 6 — HEARING, at an entity that CANNOT see the player (rear arc), and at a civilian.
  // =========================================================================================
  const hear = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    const out = {};
    // loud: sprint, sneak 5, heavy, dry_reed -> r_eff should be large
    let eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 20, yaw: 0, zone: 'zh1', eid: 'eh1' });
    H.stepFrames(2);
    out.loud = { sound_r_m: H.getStealthState().sound_r_m, run: window.__K.toAggro(eid, 900, 0) };
    // quiet control: crouch, sneak 100, light, mud
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud', dist: 20, yaw: 0, zone: 'zh2', eid: 'eh2' });
    H.stepFrames(2);
    out.quiet = { sound_r_m: H.getStealthState().sound_r_m, fill: window.__K.fillRate(eid, 600) };
    // still control at 3 m behind
    eid = window.__K.arena({ tod: 1.5, amb: 0.04, motion: 'still', sneak: 5, load: 'heavy', surface: 'dry_reed', dist: 3, yaw: 0, zone: 'zh3', eid: 'eh3' });
    H.stepFrames(2);
    out.still_3m = { sound_r_m: H.getStealthState().sound_r_m, fill: window.__K.fillRate(eid, 600) };
    // a civilian who cannot see: facing away at 2 m
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setTimeOfDay(1.5);
    H.setStealthState({ sneak: 5, load: 'heavy', surface: 'dry_reed', zone: 'zc' });
    H.setZoneAmbient('zc', 0.04);
    H.setCrimeContext('public_street_sheathed');
    H.spawnCivilian({ eid: 'civh', pos: [0, 0, 2], yaw: 0 });     // yaw 0 = looking +z, away
    H.setPlayerMotion('sprint');
    H.stepFrames(2);
    out.civ_sound_r_m = H.getStealthState().sound_r_m;
    H.stepFrames(600);
    out.civ_loud = H.listCivilians();
    // control: crouch, sneak 100, light, mud
    H.setSeed(1337); H.loadState('arena_flat'); H.setRenderRate(0); H.teleport(0, 0);
    H.setTimeOfDay(1.5);
    H.setStealthState({ sneak: 100, load: 'light', surface: 'mud', zone: 'zc2' });
    H.setZoneAmbient('zc2', 0.04);
    H.spawnCivilian({ eid: 'civh2', pos: [0, 0, 2], yaw: 0 });
    H.setPlayerMotion('crouch_move');
    H.stepFrames(602);
    out.civ_quiet_sound_r_m = H.getStealthState().sound_r_m;
    out.civ_quiet = H.listCivilians();
    return out;
  });
  rec('B6-hearing', hear);

  rec('page_errors', h.errors);
} finally {
  if (args.json) writeJson(String(args.json), R);
  await h.close();
}
