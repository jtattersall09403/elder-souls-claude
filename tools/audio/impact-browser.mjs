#!/usr/bin/env node
// impact-browser.mjs — the BROWSER half of `audio.combat.impact` (W1-11).
//
//   node tools/audio/impact-browser.mjs [--calibrate] [--out reports/runs/aud-impact-browser]
//                                       [--shot docs/shots/<name>.png]
//
// WHY THIS EXISTS SEPARATELY FROM `tools/audio/impact-probe.mjs`.
//
// `impact-probe.mjs` runs the combat modules in bare Node and answers M1/M4/M5/M9 five hundred
// times faster than a page can. Three things it structurally cannot answer, and all three are
// the ones a reader should care about most:
//
//   1. IS IT ATTACHED?  The node arena constructs `ImpactAudio` itself and hands it to the
//      arena. That proves the driver works; it proves nothing about the SHIPPED engine. Only
//      `Engine._buildCombat` deciding to call `combat.setAudio(this.impactAudio)` makes the
//      game audible, and only the browser runs `Engine`. AGENT-PROTOCOL: "Do not publish a
//      number that has only ever been seen outside the browser."
//
//   2. IS THERE A WAVEFORM?  An event count is not a sound. `OfflineAudioContext` exists only
//      in the page, so §C's dB ladder — RI-AUD01 M3 — can only be MEASURED here. Everything
//      Node could say about loudness was a restatement of the number in the JSON.
//
//   3. DOES THE ENEMY MOVE?  AGENT-PROTOCOL: "A still target hides every steering defect… if
//      the thing you are measuring responds to motion, the target must move." M6 correlates
//      pan against bearing, and against a target parked dead ahead every pan is 0 and a
//      panner hard-wired to return 0 scores a perfect pass. The node arena has no perception,
//      so nothing there ever turns. §P4 below orbits the enemy and keeps the still target as
//      the CONTROL that demonstrates the moving test is the one that can fail.
//
// PHASES
//   P0  attach          audioStats().attached_to_fight in the real Engine
//   P1  calibrate       render all 48 variants RAW, solve norm_db = -(raw peak dBFS)
//   P2  ladder (M3)     re-render levelled, check every §C relative row to +/-3 dB
//   P3  consume         a real browser fight; perturb the target's MATERIAL and watch the
//                       voice the fight asks for change (RI-MTH07)
//   P4  pan (M6)        Pearson r(pan, sin bearing) with the enemy ORBITING, plus the still
//                       control that proves the moving test can fail
//   P5  sabotage        setAudioTriggerSource('anim') must turn M1 red in the browser too
//   P6  shot            one photograph, renderer on for exactly that frame
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(`${ROOT}/tools/lib/browser.mjs`);

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const CALIBRATE = has('--calibrate');
const OUT = path.resolve(ROOT, arg('--out', 'reports/runs/aud-impact-browser'));
const SHOT = arg('--shot', null);
const CLASSES_PATH = `${ROOT}/game/data/audio/impact/classes.json`;

/** RI-AUD01 §C, the binding column. "The relationships are binding; the absolute is not." */
const REL_TO_C01 = {
  parried: +5.0, riposte: +3.5, backstab: +3.0, hit_flesh_heavy: +2.0,
  hit_flesh_light: 0, hit_chitin_light: 0, player_hurt: -0.5, guard_break: -1.0,
  blocked: -4.0, stamina_break: -8.0, whiff: -12.0,
};
const REL_TOL = 3.0;

fs.mkdirSync(OUT, { recursive: true });
const report = { generated: new Date().toISOString(), commit: null, dirty: null, phases: {} };
try {
  const { execSync } = await import('node:child_process');
  report.commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  report.dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0;
} catch { /* not fatal */ }

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
const save = () => fs.writeFileSync(`${OUT}/browser-report.json`, JSON.stringify(report, null, 2));

async function boot() {
  await page.waitForFunction(() => window.__HARNESS !== undefined, { timeout: 120000 });
  await page.evaluate(() => window.__HARNESS.ready && window.__HARNESS.ready());
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
}

try {
  await boot();

  // ── P0 ─ attachment ───────────────────────────────────────────────────────────────────────
  report.phases.P0_attach = await page.evaluate(() => {
    const s = window.__HARNESS.audioStats();
    return {
      available: s.available !== false,
      attached_to_fight: !!s.attached_to_fight,
      classes: s.classes, variants: s.variants,
      trigger_source: s.trigger_source,
      panner_model: s.panner && s.panner.panningModel,
      listener: s.listenerAttachedTo,
    };
  });
  save();
  console.log('P0 attach', JSON.stringify(report.phases.P0_attach));

  // ── P1 ─ calibration ──────────────────────────────────────────────────────────────────────
  //
  // The gain a voice is played at is `10^((peak_dbfs + norm_db)/20)`, applied to a synthesised
  // voice whose own peak is whatever its recipe happens to produce. With norm_db = 0 the
  // rendered peak is `raw + declared`, so §C's ladder is off by the SPREAD OF THE RAW PEAKS —
  // which nothing had ever measured, because measuring it needs an OfflineAudioContext.
  // Setting norm_db = -(raw peak dBFS) makes rendered peak == declared peak, exactly.
  const raws = await page.evaluate(async () => {
    const H = window.__HARNESS;
    const st = H.audioStats();
    const out = [];
    for (const cls of Object.keys(st.class_ids || {}).length ? Object.keys(st.class_ids) : (st.class_list || [])) out.push(cls);
    return out;
  });
  // The class list is authoritative on disk, not in the page.
  const disk = JSON.parse(fs.readFileSync(CLASSES_PATH, 'utf8'));
  const classIds = Object.keys(disk.classes);
  const variantIds = {};
  for (const c of classIds) variantIds[c] = disk.classes[c].variants.map((v) => v.sample_id);

  const rawPeaks = await page.evaluate(async (spec) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const [cls, ids] of Object.entries(spec)) {
      for (const sid of ids) {
        const r = await H.audioCapture({ class: cls, sample_id: sid, raw: true });
        rows.push(r.ok
          ? { cls, sid, peak_dbfs: r.peak_dbfs, rms_dbfs: r.rms_dbfs, samples: r.samples, channels: r.channels }
          : { cls, sid, error: r.why });
      }
    }
    return rows;
  }, variantIds);
  const bad = rawPeaks.filter((r) => r.error);
  report.phases.P1_calibrate = {
    rendered: rawPeaks.length, errors: bad.length,
    raw_peak_min: Math.min(...rawPeaks.filter((r) => !r.error).map((r) => r.peak_dbfs)),
    raw_peak_max: Math.max(...rawPeaks.filter((r) => !r.error).map((r) => r.peak_dbfs)),
    rows: rawPeaks,
    applied: false,
  };
  const spread = report.phases.P1_calibrate.raw_peak_max - report.phases.P1_calibrate.raw_peak_min;
  report.phases.P1_calibrate.raw_peak_spread_db = +spread.toFixed(3);
  console.log(`P1 calibrate: ${rawPeaks.length} raw renders, ${bad.length} errors, raw peak spread ${spread.toFixed(2)} dB`);
  save();

  if (CALIBRATE && !bad.length) {
    for (const r of rawPeaks) {
      const v = disk.classes[r.cls].variants.find((x) => x.sample_id === r.sid);
      // Round to 0.01 dB: the third decimal is below any audible threshold and a stable file
      // is worth more than a spurious one. `-0` is normalised away so the JSON round-trips.
      v.norm_db = +(-r.peak_dbfs).toFixed(2) + 0;
    }
    fs.writeFileSync(CLASSES_PATH, JSON.stringify(disk, null, 2) + '\n');
    report.phases.P1_calibrate.applied = true;
    console.log('P1 wrote norm_db for 48 variants; reloading the page against the new data');
    await page.reload({ waitUntil: 'load' });
    await boot();
  }
  save();

  // ── P2 ─ the §C ladder, MEASURED (M3) ─────────────────────────────────────────────────────
  const levelled = await page.evaluate(async (spec) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const [cls, ids] of Object.entries(spec)) {
      for (const sid of ids) {
        const r = await H.audioCapture({ class: cls, sample_id: sid });
        rows.push(r.ok ? { cls, sid, peak_dbfs: r.peak_dbfs, rms_dbfs: r.rms_dbfs, declared: r.declared_peak_dbfs, norm_db: r.norm_db } : { cls, sid, error: r.why });
      }
    }
    return rows;
  }, variantIds);
  // §C is measured "on the class's loudest variant".
  const loudest = {};
  for (const r of levelled) {
    if (r.error) continue;
    if (!(r.cls in loudest) || r.peak_dbfs > loudest[r.cls].peak_dbfs) loudest[r.cls] = r;
  }
  const c01 = loudest.hit_flesh_light ? loudest.hit_flesh_light.peak_dbfs : null;
  const ladder = [];
  for (const [cls, want] of Object.entries(REL_TO_C01)) {
    const got = loudest[cls];
    if (!got || c01 === null) { ladder.push({ cls, want, measured: null, ok: false, why: 'not rendered' }); continue; }
    const rel = got.peak_dbfs - c01;
    ladder.push({
      cls, want, measured_rel_db: +rel.toFixed(2), err_db: +(rel - want).toFixed(2),
      abs_peak_dbfs: +got.peak_dbfs.toFixed(2), declared_abs: got.declared, norm_db: got.norm_db,
      ok: Math.abs(rel - want) <= REL_TOL,
    });
  }
  const whiffRel = ladder.find((r) => r.cls === 'whiff');
  report.phases.P2_ladder_M3 = {
    reference_C01_dbfs: c01 === null ? null : +c01.toFixed(2),
    rows: ladder,
    rows_in_tolerance: ladder.filter((r) => r.ok).length,
    rows_total: ladder.length,
    worst_err_db: Math.max(...ladder.filter((r) => r.measured_rel_db !== undefined).map((r) => Math.abs(r.err_db))),
    // the item's own HARD FAIL: "peak(whiff) >= peak(C01) - 6 dB"
    hard_fail_whiff_too_loud: !!(whiffRel && whiffRel.measured_rel_db >= -6),
    M3: ladder.every((r) => r.ok) ? 'PASS' : 'FAIL',
  };
  console.log(`P2 M3 ladder: ${report.phases.P2_ladder_M3.rows_in_tolerance}/${ladder.length} rows within ±3 dB, worst ${report.phases.P2_ladder_M3.worst_err_db} dB, whiff ${whiffRel && whiffRel.measured_rel_db} dB vs C01`);
  save();
  // ── P3 ─ consumption (RI-MTH07) ────────────────────────────────────────────────────────────
  //
  // "Perturb and watch an entity change behaviour." The behaviour of an audio driver is the
  // voice it asks for, so the perturbation is the WORLD, not the driver: the same player, the
  // same input script, the same frame — against enemies made of different stuff, and against an
  // enemy moved out of reach. If the class does not move when the world moves, nothing in the
  // running game is reading the material.
  report.phases.P3_consume = await page.evaluate(({ mats }) => {
    const H = window.__HARNESS;
    const runOne = (spawnId, z) => {
      H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(4);
      for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
      // `spawn()` returns the eid as a plain STRING; naming it explicitly removes the guess.
      const eid = H.spawn(spawnId, 0, z, { as: 'AUD' });
      H.stepFrames(2);
      const from = H.audioLog().length;
      for (let k = 0; k < 8; k++) {
        H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
        H.stepFrames(46);
        // keep the target pinned: this phase is about MATERIAL, not steering
        H.setEntityPos(eid, 0, z);
      }
      const rows = H.audioLog().slice(from);
      const classes = {};
      for (const r of rows) classes[r.class] = (classes[r.class] || 0) + 1;
      return { spawnId, z, voices: rows.length, classes, materials: [...new Set(rows.map((r) => r.material).filter(Boolean))] };
    };
    const out = { in_reach: [], out_of_reach: null };
    for (const m of mats) { try { out.in_reach.push(runOne(m, 1.4)); } catch (e) { out.in_reach.push({ spawnId: m, error: String(e.message || e) }); } }
    try { out.out_of_reach = runOne(mats[0], 6.0); } catch (e) { out.out_of_reach = { error: String(e.message || e) }; }
    return out;
  }, { mats: ['mat_flesh', 'mat_chitin', 'mat_stone', 'mat_metal'] });
  {
    const ir = report.phases.P3_consume.in_reach.filter((r) => !r.error);
    const distinct = new Set(ir.map((r) => Object.keys(r.classes).filter((c) => c !== 'whiff').sort().join('+')));
    report.phases.P3_consume.distinct_hit_class_sets = [...distinct];
    report.phases.P3_consume.material_changes_the_voice = distinct.size > 1;
    const oor = report.phases.P3_consume.out_of_reach;
    report.phases.P3_consume.reach_changes_the_voice =
      !!(oor && oor.classes && Object.keys(oor.classes).length === 1 && oor.classes.whiff);
  }
  console.log('P3 consume:', JSON.stringify({
    sets: report.phases.P3_consume.distinct_hit_class_sets,
    material_changes_the_voice: report.phases.P3_consume.material_changes_the_voice,
    reach_changes_the_voice: report.phases.P3_consume.reach_changes_the_voice,
  }));
  save();

  // ── P4 ─ M6 spatialisation, WITH A MOVING TARGET ──────────────────────────────────────────
  //
  // AGENT-PROTOCOL: "A still target hides every steering defect… A control that cannot exhibit
  // the failure is not a control." So this runs the SAME script twice: once with the enemy
  // orbiting the player through the swing arc, once with it parked dead ahead. The still run is
  // not the measurement — it is the demonstration that the moving run is the one that can fail.
  //
  // The bearing is taken from the WORLD (the enemy's own position on the frame the voice was
  // decided on), never from the audio row, so the correlation is a join between two independent
  // streams rather than a restatement of one.
  const panRun = async (moving, panSource) => page.evaluate(({ mv, ps }) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(4);
    H.setAudioPanSource(ps);
    for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
    const eid = H.spawn('mat_flesh', 0, 1.4, { as: 'AUD' });
    const R = 1.4;
    const from = H.audioLog().length;
    const world = [];              // independent stream: where the enemy actually was, per frame
    // The still control is parked DEAD AHEAD (theta 0) — that is the target a probe reaches for
    // by default, and the one that cannot exhibit the failure. The moving run sweeps the target
    // through the swing arc so that hits land at a spread of real bearings.
    // The orbit is anchored to the PLAYER'S LIVE POSITION AND FACING each frame, not to the
    // world origin. Anchored to the origin the player drifts out from under the circle and
    // four swings in five miss, which starved M6 of the >= 20 events it asks for. Placing the
    // target at (player + R at bearing pyaw+theta) keeps it inside the arc and makes `theta`
    // the relative bearing the pan is supposed to track.
    let theta = mv ? -40 : 0;
    for (let k = 0; k < 64; k++) {
      H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
      for (let f = 0; f < 46; f++) {
        if (mv) { theta += 0.9; if (theta > 40) theta = -40; }
        const cs0 = H.getCombatState();
        const rad = ((cs0.player.yaw_deg + theta) * Math.PI) / 180;
        const ex = cs0.player.pos[0] + R * Math.sin(rad), ez = cs0.player.pos[2] + R * Math.cos(rad);
        H.setEntityPos(eid, ex, ez);
        H.stepFrames(1);
        const cs = H.getCombatState();
        world.push({ frame: cs.frame, ex, ez, px: cs.player.pos[0], pz: cs.player.pos[2], pyaw: cs.player.yaw_deg, theta });
      }
    }
    const rows = H.audioLog().slice(from);
    H.setAudioPanSource('impact');
    return { rows, world, moving: mv, pan_source: ps };
  }, { mv: moving, ps: panSource });

  const pearson = (xs, ys) => {
    const n = xs.length; if (n < 2) return null;
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
    if (sxx === 0 || syy === 0) return null;     // a constant series has no correlation at all
    return sxy / Math.sqrt(sxx * syy);
  };
  const analysePan = (r) => {
    const byFrame = new Map(r.world.map((w) => [w.frame, w]));
    const pts = [];
    for (const row of r.rows) {
      if (row.class === 'whiff') continue;             // no victim, no impact point
      const w = byFrame.get(row.frame);
      if (!w) continue;
      let rel = (Math.atan2(w.ex - w.px, w.ez - w.pz) * 180) / Math.PI - w.pyaw;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      pts.push({ frame: row.frame, cls: row.class, pan: row.pan, dist: row.distance_m, pan_src: row.pan_src || null, bearing_deg: +rel.toFixed(2), sinb: Math.sin((rel * Math.PI) / 180) });
    }
    const pans = pts.map((p) => p.pan);
    return {
      impacts: pts.length,
      bearing_spread_deg: pts.length ? +(Math.max(...pts.map((p) => p.bearing_deg)) - Math.min(...pts.map((p) => p.bearing_deg))).toFixed(1) : 0,
      pan_distinct: new Set(pans.map((p) => p.toFixed(4))).size,
      pan_nonzero: pans.filter((p) => Math.abs(p) > 1e-6).length,
      pan_min: pans.length ? Math.min(...pans) : null,
      pan_max: pans.length ? Math.max(...pans) : null,
      distance_m_max: pts.length ? Math.max(...pts.map((p) => p.dist)) : null,
      r_pan_vs_sin_bearing: (() => { const v = pearson(pts.map((p) => p.sinb), pans); return v === null ? null : +v.toFixed(4); })(),
      sample: pts.slice(0, 8),
    };
  };
  // Three series, and the three of them together are the argument:
  //   moving + impact    the shipped rule against a target that moves        -> must pass
  //   moving + attacker  the rule this build had, same fixture               -> must fail
  //   still  + impact    the fixture a probe reaches for by default          -> cannot decide
  const mvRun = await panRun(true, 'impact');
  const mvLegacy = await panRun(true, 'attacker');
  const stRun = await panRun(false, 'impact');
  report.phases.P4_pan_M6 = {
    moving_shipped: analysePan(mvRun),
    moving_legacy_attacker_position: analysePan(mvLegacy),
    still_control: analysePan(stRun),
  };
  {
    const m = report.phases.P4_pan_M6.moving_shipped;
    const l = report.phases.P4_pan_M6.moving_legacy_attacker_position;
    const st = report.phases.P4_pan_M6.still_control;
    report.phases.P4_pan_M6.M6 = (m.r_pan_vs_sin_bearing !== null && m.r_pan_vs_sin_bearing >= 0.8 && m.impacts >= 20) ? 'PASS' : 'FAIL';
    report.phases.P4_pan_M6.events_ge_20 = m.impacts >= 20;
    // The detector must be seen going red. The legacy rule on the SAME fixture is the red.
    report.phases.P4_pan_M6.detector_goes_red =
      l.r_pan_vs_sin_bearing === null || l.r_pan_vs_sin_bearing < 0.8;
    // And the point of the still control: with the target parked, pan is a CONSTANT, Pearson r
    // is undefined, and a panner hard-wired to 0 is indistinguishable from a correct one.
    report.phases.P4_pan_M6.still_control_is_degenerate =
      st.pan_distinct <= 1 && st.r_pan_vs_sin_bearing === null;
  }
  console.log('P4 M6 shipped :', JSON.stringify(report.phases.P4_pan_M6.moving_shipped).slice(0, 300));
  console.log('P4 M6 legacy  :', JSON.stringify(report.phases.P4_pan_M6.moving_legacy_attacker_position).slice(0, 300));
  console.log('P4 M6 still   :', JSON.stringify(report.phases.P4_pan_M6.still_control).slice(0, 300));
  console.log('P4 verdict    :', report.phases.P4_pan_M6.M6, 'red-on-legacy', report.phases.P4_pan_M6.detector_goes_red, 'still-degenerate', report.phases.P4_pan_M6.still_control_is_degenerate);
  save();

  // ── P5 ─ the sabotage, in the browser ─────────────────────────────────────────────────────
  //
  // The node probe's `--sabotage anim` turns M1 red against the node arena. That proves the
  // CHECK works; it does not prove the SHIPPED driver is wired to resolution rather than to the
  // animation track, because the node arena builds its own driver. `setAudioTriggerSource` is
  // the same switch thrown on the engine's own instance.
  report.phases.P5_sabotage = await page.evaluate(() => {
    const H = window.__HARNESS;
    const fight = (mode) => {
      H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(4);
      H.setAudioTriggerSource(mode);
      for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
      const eid = H.spawn('mat_flesh', 0, 1.4, { as: 'AUD' });
      const from = H.audioLog().length;
      H.combatTraceStart({});
      for (let k = 0; k < 10; k++) {
        H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
        H.stepFrames(46);
        H.setEntityPos(eid, 0, 1.4);
      }
      const trace = H.combatTraceDrain(); H.combatTraceStop();
      const rows = H.audioLog().slice(from);
      // M1: the offset between the frame the GEOMETRY decided and the frame the voice was
      // decided on. The two streams are independent; the join is the measurement.
      //
      // The combat trace is COLUMNAR, not an event list: `t:'F'` frame records carrying the
      // player and enemy state vectors, plus `t:'E'` event records. Filtering it for a row
      // whose `type` is `'hit'` — which is what a first pass assumed — silently matches
      // nothing and yields `joined: 0`, i.e. a check that reports neither pass nor fail. The
      // geometry's own witness of a landed blow is the frame on which an enemy's HP DROPS,
      // which is read out of the frame records and owes the audio driver nothing. The enemy
      // vector is `[state, anim, anim_frame, hp, hitbox_active, poise, stamina, yaw, dist]`
      // (combat/trace.js#combatFrame), so HP is index 3.
      const hitFrames = [];
      let prevHp = null;
      for (const t of trace) {
        if (t.t !== 'F' || !Array.isArray(t.e) || !t.e.length) continue;
        const hp = t.e[0][3];
        if (prevHp !== null && hp < prevHp) hitFrames.push(t.f);
        prevHp = hp;
      }
      const offsets = [];
      for (const r of rows) {
        if (r.class === 'whiff') continue;
        let best = null;
        for (const hf of hitFrames) { const d = Math.abs(hf - r.frame); if (best === null || d < best) best = d; }
        if (best !== null) offsets.push(best);
      }
      offsets.sort((a, b) => a - b);
      const q = (p) => (offsets.length ? offsets[Math.min(offsets.length - 1, Math.floor(p * offsets.length))] : null);
      const classes = {}; for (const r of rows) classes[r.class] = (classes[r.class] || 0) + 1;
      return {
        mode, voices: rows.length, hit_events: hitFrames.length, joined: offsets.length,
        via: [...new Set(rows.map((r) => r.via))],
        offset_p50: q(0.5), offset_p99: q(0.99), offset_max: offsets.length ? offsets[offsets.length - 1] : null,
        classes,
        trigger_source: H.audioStats().trigger_source,
      };
    };
    const shipped = fight('resolution');
    const broken = fight('anim');
    window.__HARNESS.setAudioTriggerSource('resolution');
    return { shipped, broken };
  });
  {
    const a = report.phases.P5_sabotage.shipped, b = report.phases.P5_sabotage.broken;
    report.phases.P5_sabotage.detector_goes_red =
      !!(a && b && a.offset_p50 === 0 && (b.offset_p50 === null || b.offset_p50 > 1 || b.voices !== a.voices || Object.keys(b.classes).join() !== Object.keys(a.classes).join()));
  }
  console.log('P5 sabotage:', JSON.stringify(report.phases.P5_sabotage));
  save();
  // ── P6 ─ one photograph ───────────────────────────────────────────────────────────────────
  //
  // The renderer is off for every phase above (AGENT-PROTOCOL: a stepping loop that renders is
  // the most expensive thing in this project). It goes on for exactly the frames photographed.
  if (SHOT) {
    const shotPath = path.resolve(ROOT, SHOT);
    fs.mkdirSync(path.dirname(shotPath), { recursive: true });
    await page.setViewportSize({ width: 1280, height: 720 });
    report.phases.P6_shot = await page.evaluate(() => {
      const H = window.__HARNESS;
      H.setSeed(1337); H.loadState('arena_duel'); H.stepFrames(4);
      for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
      const eid = H.spawn('mat_flesh', 0, 1.4, { as: 'AUD' });
      const from = H.audioLog().length;
      // Walk up to the frame the blow lands on and stop ON it — hitstop means the frame you
      // were on is the frame you look at, so that is the frame worth photographing.
      H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
      let hitFrame = null;
      for (let f = 0; f < 46 && hitFrame === null; f++) {
        H.setEntityPos(eid, 0.55, 1.15);
        H.stepFrames(1);
        if (H.audioLog().length > from) hitFrame = H.getCombatState().frame;
      }
      const rows = H.audioLog().slice(from);
      H.setRenderRate(60); H.renderFrame();
      return { hitFrame, voices: rows.map((r) => ({ frame: r.frame, class: r.class, pan: r.pan, distance_m: r.distance_m, pan_src: r.pan_src, gain: r.gain })) };
    });
    await page.screenshot({ path: shotPath });
    report.phases.P6_shot.path = path.relative(ROOT, shotPath);
    await page.evaluate(() => window.__HARNESS.setRenderRate(0));
    console.log('P6 shot ->', report.phases.P6_shot.path, JSON.stringify(report.phases.P6_shot.voices));
    save();
  }
} catch (e) {
  report.fatal = { where: 'phases', message: String(e && e.message || e), stack: String(e && e.stack || '') };
  save();
  console.error('FATAL', e);
}

report.page_errors = handle.errors.slice(0, 20);
save();
await handle.close();
console.log('wrote', `${OUT}/browser-report.json`);
