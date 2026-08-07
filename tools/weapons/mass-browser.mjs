#!/usr/bin/env node
// mass-browser.mjs — RI-WPN05 §E `weapon.feel.mass`, measured in the BROWSER, on the DRAWN blade.
//
// Why this exists rather than another node census. `tools/weapons/motion-census.mjs` walks the
// combat modules in bare Node and is the right instrument for frame-level geometry, but per
// AGENT-PROTOCOL it "runs no perception and diverges on long fights": the node arena never sets
// `alertState = AGGRO`, so the character never STEERS. Peak tip speed is the composition of the
// clip's own angular rate with the character's root yaw rate, and a probe that never turns can
// only ever see one of the two terms. This probe measures the second.
//
// Everything here is read from the SHIPPING build through `window.__HARNESS.getDrawnGeometry()`,
// so what is measured is the tip the PLAYER SEES, not a socket the fight computed. The renderer
// and the hit socket agree to 0.0008 mm (reports/render/render-probe-baseline.json), which is
// what makes a wrong tip speed a wrong tip speed you can watch.
//
//   P0  BOOT      — page loads, no errors, the weapon is drawn and rigged.
//   P1  MOVING    — peak DRAWN tip speed across one swing, THREE series: target parked dead
//                   ahead, target orbiting the live player, and the still control reported
//                   alongside so the gap between them is the artifact. AGENT-PROTOCOL: "a still
//                   target hides every steering defect"; here the defect it hides is that the
//                   character's own turn ADDS to the blade's angular rate.
//   P2  FOLLOW    — RI-WPN05 §E's follow-through fraction, measured live off the drawn tip.
//                   Run this tool twice, once with `swing.js`'s follow band at [S+A+2, T] and
//                   once reverted to [S+A, T], and diff: that is the delete-the-fix control.
//   P3  CONSUME   — RI-MTH07. The perturbation happens ON DISK between two runs (--tag), never
//                   on an in-page object, because patching in the page would only prove the
//                   library reaches the renderer and not that the DATA FILE does.
//
// USAGE
//   node tools/weapons/mass-browser.mjs --tag shipped [--weapon whp_hist_bindings] [--out dir]
//                                       [--shot docs/shots/<name>.png]
//
//   P4  SHOT      — one picture, over a real frame at the measured peak, captioned from the
//                   run's own numbers. `--weapon` picks the subject of the picture.
//
// CONTENTION: this tool steps the simulation, so it launches its own browser (RULES.md 20) and
// keeps the one it launched for every phase (RULES.md 21). Every figure it reports is a speed,
// a fraction, a count or a boolean — none is a wall-clock timing — so a run taken under load is
// still a run, and the load is recorded in the report as `taken_under`.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'mass-browser.mjs — RI-WPN05 §E mass, measured on the drawn blade in the browser';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const tag = String(args.tag || 'run');
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-mass');
ensureDir(outDir);

// Two subjects, chosen because they sit on opposite sides of the defect:
//   whp_hist_bindings  the worst clip in the game (the census's 163.34 m/s), follow_scale was 0
//   ssw_garrison_sword the render baseline's own subject, whose follow-through was already fine
const SUBJECTS = [
  { id: 'whp_hist_bindings', cls: 'WHP', tier: 'medium' },
  { id: 'ssw_garrison_sword', cls: 'SSW', tier: 'light' },
];
const BAND_TOP = { light: 20, medium: 26, heavy: 32, ultra: 40, ranged: 20 };
const FOLLOW_MIN = { light: 0.20, medium: 0.20, heavy: 0.25, ultra: 0.30, ranged: 0.20 };

const SHOT = args.shot ? String(args.shot) : null;
const SHOT_SUBJECT = String(args.weapon || SUBJECTS[0].id);

/** The frame of peak DRAWN tip speed in the MOVING series — where the picture is taken. */
function shotFrame(rep, wid) {
  const s = (rep.series || []).find((x) => x.weapon === wid && x.moving);
  if (!s || !s.speed_series) return 40;
  let bi = 1, bv = -1;
  for (let i = 1; i < s.speed_series.length; i++) {
    if (s.speed_series[i] !== null && s.speed_series[i] > bv) { bv = s.speed_series[i]; bi = i; }
  }
  return bi;
}

/**
 * The caption, built from `rep` and nothing else. Three columns, because the finding IS the
 * three-way comparison: the still control cannot tell a fast blade from a slow one, and the
 * §E ceiling is the line both are measured against.
 */
function buildPanel(rep, wid) {
  const esc = (x) => String(x).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = (rep.series || []).filter((s) => s.weapon === wid);
  const still = rows.find((s) => !s.moving), move = rows.find((s) => s.moving);
  const tier = (move || still || {}).tier || 'medium';
  const ceil = (BAND_TOP[tier] || 26) * 1.25;
  const spark = (s, colour) => {
    if (!s || !s.speed_series) return '';
    const v = s.speed_series, n = v.length;
    const hi = Math.max(ceil * 1.15, ...v.filter((x) => x !== null));
    const W = 470, Hh = 108;
    let d = '';
    for (let i = 1; i < n; i++) {
      if (v[i] === null) continue;
      const x = (i / (n - 1)) * W, y = Hh - (v[i] / hi) * Hh;
      d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    // Shade the ACTIVE window, so "the whole arc lives in the live frames" is visible and not
    // merely asserted.
    let ax0 = null, ax1 = null;
    (s.phase_series || []).forEach((p, i) => { if (p === 'active') { if (ax0 === null) ax0 = i; ax1 = i; } });
    const band = ax0 === null ? '' :
      `<rect x="${((ax0 / (n - 1)) * W).toFixed(1)}" y="0" width="${(((ax1 - ax0) / (n - 1)) * W).toFixed(1)}" height="${Hh}" fill="#ffffff" opacity="0.10"/>`;
    const cy = Hh - (ceil / hi) * Hh;
    return `<svg width="${W}" height="${Hh}" style="display:block">${band}`
      + `<line x1="0" y1="${cy.toFixed(1)}" x2="${W}" y2="${cy.toFixed(1)}" stroke="#ff5a5a" stroke-width="1.5" stroke-dasharray="5 4"/>`
      + `<path d="${d}" fill="none" stroke="${colour}" stroke-width="2"/></svg>`;
  };
  const col = (s, label, colour) => {
    if (!s) return `<div style="flex:1"><b>${esc(label)}</b><br><i>not measured</i></div>`;
    const ok = s.peak_drawn_tip_mps <= ceil;
    return `<div style="flex:1;min-width:0">
      <div style="font:600 13px/1.4 system-ui;color:${colour}">${esc(label)}</div>
      <div style="font:26px/1.15 system-ui;color:${ok ? '#7fdc7f' : '#ff5a5a'}">${s.peak_drawn_tip_mps} m/s</div>
      <div style="font:11px/1.5 system-ui;color:#c8c8c8">character turned ${s.player_yaw_travel_deg_during_active}&deg; while the blade was live<br>
      follow-through ${s.follow_through_frac === null ? 'n/a' : s.follow_through_frac} of ${s.recovery_frames_observed} recovery f@60</div>
      ${spark(s, colour)}</div>`;
  };
  return `<div style="position:fixed;left:0;right:0;bottom:0;padding:14px 18px;background:rgba(8,10,14,0.90);
      border-top:2px solid #444;color:#eee;font:12px/1.5 system-ui;z-index:99999">
    <div style="font:600 15px/1.3 system-ui;margin-bottom:2px">${esc(wid)} &middot; ${esc((move || still || {}).move_id || '')} &middot; RI-WPN05 &sect;E peak tip speed, measured on the DRAWN blade</div>
    <div style="font:11px/1.4 system-ui;color:#aaa;margin-bottom:10px">dashed red = the &sect;E.2 ceiling for tier <b>${esc(tier)}</b> (${ceil.toFixed(1)} m/s = 1.25 &times; the band top). Pale band = the active window. Every sample is the tip the renderer drew, which agrees with the hit socket to 0.0008 mm.</div>
    <div style="display:flex;gap:26px">${col(still, 'STILL target (the easy fixture)', '#8ab4ff')}${col(move, 'MOVING target (the character steers)', '#ffb347')}</div>
  </div>`;
}

const handle = await launchGame({
  ...args,
  width: Number(args.width || 320),
  height: Number(args.height || 240),
});
const report = { schema: 'elder-souls/wpn05-mass-browser@1', tag, generated: new Date().toISOString() };
// RULES.md 26: "say under what load every timing figure was taken, or publish no timing figure."
// This tool publishes none, but the load belongs in the artifact anyway — a successor comparing
// two runs needs to know which box each was taken on.
try {
  report.taken_under = {
    headless_shell: Number(execSync('pgrep -c headless_shell || true').toString().trim()) || 0,
    loadavg: fs.readFileSync('/proc/loadavg', 'utf8').trim().split(' ').slice(0, 3).join(' '),
    git_head: execSync('git rev-parse --short HEAD').toString().trim(),
    swing_js_sha1: execSync('git hash-object game/src/combat/swing.js').toString().trim(),
  };
} catch (e) { report.taken_under = { error: String(e && e.message).slice(0, 120) }; }

try {
  Object.assign(report, await handle.page.evaluate(async (SUBJ) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setSeed(1337);
    H.setRenderRate(0);
    const out = { boot: null, series: [], errors: [] };
    const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    // ---- P0. boot -----------------------------------------------------------------------
    H.loadState('arena_duel');
    H.setLoadout({ weapon: SUBJ[0].id });
    H.stepFrames(2);
    H.renderFrame();
    const p0 = H.getDrawnGeometry().actors.find((a) => a.id === 'player');
    out.boot = {
      player_built: p0 ? p0.built : false,
      player_rigged: p0 ? p0.rigged : false,
      weapon_key: p0 ? p0.weapon_key : null,
      tip_vs_socket_b_mm: p0 ? p0.tip_vs_socket_b_mm : null,
      drawn_length_m: p0 ? p0.drawn_length_m : null,
    };

    // One swing, sampling the DRAWN tip every frame. `moving` orbits a live enemy around the
    // player's own position and facing, so the character is steering while the blade travels.
    //
    // THE ACTIVE WINDOW COMES FROM THE FIGHT, NOT FROM A DECLARATION FILE. `getCombatState()
    // .player.move` is the move the engine is EXECUTING this frame and carries its own
    // {startup, active, recovery} in f@60; `anim_frame` is the frame counter inside it. The
    // phase convention is clips.js `Clip.phaseAt`: phase 1.0 is the FIRST active frame,
    // f = startup+1, so the active window is anim_frame in (startup, startup+active] and
    // recovery is anim_frame > startup+active. Reading it here rather than from the moveset
    // JSON is what makes the consumption test in P3 mean anything — if the on-disk edit did
    // not reach the engine, `active` here does not move either.
    //
    // NOTE FOR A SUCCESSOR: the player state during an attack is `ATTACK_RECOVERY` for the
    // WHOLE move (player.js:702) — startup, active and recovery alike. There is no 'ATTACK'
    // state. Filtering frames on `state === 'ATTACK'` matches nothing, yields an empty active
    // window, and reports follow_through_frac null — a check that reports neither pass nor
    // fail. That is how the first cut of this tool was wrong.
    const swing = (wid, moving, heavy) => {
      H.setSeed(1337);
      H.loadState('arena_duel');
      H.setLoadout({ weapon: wid });
      H.setRenderRate(0);
      H.stepFrames(4);
      for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
      const eid = H.spawn('mat_flesh', 0, 1.6, { as: 'MASS' });
      const R = 1.6;
      let theta = moving ? -40 : 0, dir = 1;
      H.queueInputs([{ f: 1, press: [heavy ? 'heavy' : 'light'] }, { f: 4, release: [heavy ? 'heavy' : 'light'] }]);
      const tips = [], yaws = [], frames = [];
      let sawMove = false;
      for (let f = 0; f < 260; f++) {
        if (moving) { theta += 2.2 * dir; if (theta > 40) { theta = 40; dir = -1; } else if (theta < -40) { theta = -40; dir = 1; } }
        const cs0 = H.getCombatState();
        const rad = ((cs0.player.yaw_deg + theta) * Math.PI) / 180;
        H.setEntityPos(eid, cs0.player.pos[0] + R * Math.sin(rad), cs0.player.pos[2] + R * Math.cos(rad));
        H.stepFrames(1);
        H.renderFrame();
        const P = H.getDrawnGeometry().actors.find((a) => a.id === 'player');
        const cs = H.getCombatState();
        const m = cs.player.move;
        tips.push(P && P.drawn_tip ? P.drawn_tip.slice() : null);
        yaws.push(cs.player.yaw_deg);
        frames.push({
          st: cs.player.state, af: cs.player.anim_frame,
          move: m ? m.id : null,
          startup: m ? m.startup : null, active: m ? m.active : null,
          recovery: m ? m.recovery : null, total: m ? m.total : null,
        });
        if (m) sawMove = true;
        // Stop one full move after it retires, not on a state name.
        if (sawMove && !m) break;
      }
      return { tips, yaws, frames };
    };

    for (const s of SUBJ) {
      for (const moving of [false, true]) {
        try {
          const r = swing(s.id, moving, true);
          const { tips, yaws, frames } = r;
          // Per-frame DRAWN tip speed, in the world frame the player watches. `spd[i]` is the
          // step INTO frame i, so it is indexed alongside frames[]/tips[] with spd[0] = null.
          const spd = [null];
          for (let i = 1; i < tips.length; i++) {
            spd.push(tips[i] && tips[i - 1] ? d3(tips[i], tips[i - 1]) * 60 : null);
          }
          // Phase classification from the engine's own move record (see swing()).
          const mv = frames.find((x) => x.move) || null;
          const act = [], rec = [];
          for (let i = 0; i < frames.length; i++) {
            const F = frames[i];
            if (!F.move) continue;
            if (F.af > F.startup && F.af <= F.startup + F.active) act.push(i);
            else if (F.af > F.startup + F.active) rec.push(i);
          }
          const a0 = act.length ? act[0] : null, a1 = act.length ? act[act.length - 1] : null;
          // §E's peak tip speed is "max over the animation" — the whole clip, so the startup
          // wander and the recovery are in scope, not only the live window.
          let peak = 0;
          for (const v of spd) if (v !== null && v > peak) peak = v;
          let peakActive = 0;
          for (const i of act) if (spd[i] !== null && spd[i] > peakActive) peakActive = spd[i];
          // §E follow-through, on the DRAWN tip: the reference direction is the INSTANTANEOUS
          // tip direction on the last active frame (not the mean over the window — on a wide
          // arc the tangent rotates most of the way round and the mean points somewhere the
          // tip never goes; that error is recorded in W1-MASS's findings). Recovery frames are
          // counted up to the first reversal. Same rule as tools/weapons/motion-census.mjs.
          let folN = 0, folD = 0, dirOut = null;
          if (a1 !== null && a1 >= 1 && tips[a1] && tips[a1 - 1]) {
            const v = [tips[a1][0] - tips[a1 - 1][0], tips[a1][1] - tips[a1 - 1][1], tips[a1][2] - tips[a1 - 1][2]];
            const n = Math.hypot(v[0], v[1], v[2]);
            if (n > 1e-9) dirOut = [v[0] / n, v[1] / n, v[2] / n];
          }
          if (dirOut) {
            let broke = false;
            for (const i of rec) {
              if (!tips[i] || !tips[i - 1]) continue;
              const v = [tips[i][0] - tips[i - 1][0], tips[i][1] - tips[i - 1][1], tips[i][2] - tips[i - 1][2]];
              folD++;
              if (!broke && (v[0] * dirOut[0] + v[1] * dirOut[1] + v[2] * dirOut[2]) > 0) folN++; else broke = true;
            }
          }
          // How much the character TURNED while the blade was live. This is the term the node
          // arena cannot produce and the still target cannot exhibit.
          let yawTravel = 0;
          if (a0 !== null) {
            for (let i = a0 + 1; i <= a1 && i < yaws.length; i++) {
              let d = yaws[i] - yaws[i - 1];
              while (d > 180) d -= 360; while (d < -180) d += 360;
              yawTravel += Math.abs(d);
            }
          }
          const spdA = spd.filter((v) => v !== null);
          out.series.push({
            weapon: s.id, class: s.cls, tier: s.tier, moving,
            frames_sampled: tips.length,
            move_id: mv ? mv.move : null,
            declared_f60: mv ? { startup: mv.startup, active: mv.active, recovery: mv.recovery, total: mv.total } : null,
            active_frames_observed: act.length,
            recovery_frames_observed: rec.length,
            peak_drawn_tip_mps: +peak.toFixed(2),
            peak_drawn_tip_mps_active_window: +peakActive.toFixed(2),
            mean_drawn_tip_mps: spdA.length ? +(spdA.reduce((a, b) => a + b, 0) / spdA.length).toFixed(2) : null,
            player_yaw_travel_deg_during_active: +yawTravel.toFixed(2),
            follow_through_frac: folD ? +(folN / folD).toFixed(3) : null,
            recovery_frames_counted: folD,
            recovery_frames_moving: rec.filter((i) => spd[i] !== null && spd[i] > 0.05).length,
            // Kept so the picture is drawn from the measurement rather than from a second
            // reading of the same fixture. Indexed alongside frames[]; spd[0] is null.
            speed_series: spd.map((v) => (v === null ? null : +v.toFixed(2))),
            phase_series: frames.map((F) => (!F.move ? 'idle'
              : F.af <= F.startup ? 'startup'
                : F.af <= F.startup + F.active ? 'active' : 'recovery')),
          });
        } catch (e) { out.errors.push(`${s.id} moving=${moving}: ` + String(e && e.message).slice(0, 200)); }
      }
    }

    // ---- P3. the DECLARED side of the consumption test ------------------------------------
    // Paired with the drawn side above. The perturbation is on disk, between runs.
    // The LIVE side: what the engine actually loaded, read back out of the fight rather than
    // off disk. `getHitGeometry()` reports the weapon capsule the hit test will sweep, and
    // getCombatState().player.move reports the frame counts the move is executing. If an
    // on-disk edit does not reach these, it did not reach the game.
    try {
      out.live = {};
      for (const s of SUBJ) {
        H.setSeed(1337); H.loadState('arena_duel'); H.setLoadout({ weapon: s.id }); H.stepFrames(4);
        const g = H.getHitGeometry().actors.find((a) => a.id === 'P') || H.getHitGeometry().actors[0];
        H.renderFrame();
        const P = H.getDrawnGeometry().actors.find((a) => a.id === 'player');
        out.live[s.id] = {
          weapon_loaded: H.getCombatState().player.weapon,
          weapon_class: H.getCombatState().player.weapon_class,
          socket_a_dist_m: g ? g.weapon.socket_a : null,
          socket_b_dist_m: g ? g.weapon.socket_b : null,
          drawn_length_m: P ? P.drawn_length_m : null,
          tip_vs_socket_b_mm: P ? P.tip_vs_socket_b_mm : null,
        };
      }
    } catch (e) { out.errors.push('live: ' + String(e && e.message).slice(0, 200)); }

    return out;
  }, SUBJECTS));

  report.page_errors = handle.errors.length;
  report.page_error_sample = handle.errors.slice(0, 3);

  // ---- P4. one picture, drawn from the numbers above and over a real frame ------------------
  // RULES.md 27. The panel is built from `report.series` — the measurement — and laid over a
  // REAL rendered frame of the subject mid-swing, so the picture cannot drift from the run that
  // produced it. This tool steps the simulation, so it launches its own browser (RULES.md 20)
  // and this is the same one, kept.
  if (SHOT) {
    try {
      const shotPath = path.resolve(SHOT);
      ensureDir(path.dirname(shotPath));
      await handle.page.setViewportSize({ width: 1100, height: 620 });
      await handle.page.evaluate(async (payload) => {
        const H = window.__HARNESS;
        const { subject, atFrame, panelHTML } = payload;
        // Re-run the moving swing and stop ON the peak frame, so the blade in the picture is
        // the blade at the speed the caption claims.
        H.setSeed(1337); H.loadState('arena_duel'); H.setLoadout({ weapon: subject });
        H.setRenderRate(0); H.stepFrames(4);
        for (const e of H.listEntities()) if (e.kind === 'enemy') H.despawn(e.eid);
        const eid = H.spawn('mat_flesh', 0, 1.6, { as: 'MASS' });
        let theta = -40, dir = 1;
        H.queueInputs([{ f: 1, press: ['heavy'] }, { f: 4, release: ['heavy'] }]);
        for (let f = 0; f <= atFrame; f++) {
          theta += 2.2 * dir; if (theta > 40) { theta = 40; dir = -1; } else if (theta < -40) { theta = -40; dir = 1; }
          const cs = H.getCombatState();
          const rad = ((cs.player.yaw_deg + theta) * Math.PI) / 180;
          H.setEntityPos(eid, cs.player.pos[0] + 1.6 * Math.sin(rad), cs.player.pos[2] + 1.6 * Math.cos(rad));
          H.stepFrames(1);
        }
        H.renderFrame();
        const d = document.createElement('div');
        d.id = '__mass_panel';
        d.innerHTML = panelHTML;
        document.body.appendChild(d);
        await new Promise((r) => setTimeout(r, 120));
      }, { subject: SHOT_SUBJECT, atFrame: shotFrame(report, SHOT_SUBJECT), panelHTML: buildPanel(report, SHOT_SUBJECT) });
      await handle.page.screenshot({ path: shotPath });
      report.shot = path.relative(process.cwd(), shotPath);
    } catch (e) { report.shot_error = String(e && e.message).slice(0, 300); }
  }
} finally {
  await handle.close();
}

// ---- the ON-DISK declaration, paired with the live read above -------------------------------
// P3's perturbation happens HERE, between two runs of this tool, and this block records which
// bytes were in place for the run. `peak_tip_speed_mps_implied` is build-movesets' own §E guard
// (W1-MASS P3): it is written only onto slots already over §E.2's ceiling, so its ABSENCE is
// the pass condition and its presence is a slot carrying its own indictment.
report.on_disk = {};
for (const s of SUBJECTS) {
  try {
    const j = JSON.parse(fs.readFileSync(path.resolve('game/data/combat/movesets/' + s.id + '.json'), 'utf8'));
    const slot = j.slots && j.slots['r2'];
    report.on_disk[s.id] = {
      class: j.class, weight_tier: j.weight_tier, reach_m: j.reach_m,
      r2: slot ? {
        startup_f60: slot.startup_f, active_f60: slot.active_f, recovery_f60: slot.recovery_f,
        arc_sweep_deg: slot.arc_sweep_deg, shape: slot.shape,
        peak_tip_speed_mps_implied: slot.peak_tip_speed_mps_implied === undefined ? null : slot.peak_tip_speed_mps_implied,
      } : null,
    };
  } catch (e) { report.on_disk[s.id] = { error: String(e && e.message).slice(0, 160) }; }
}

// ---- verdict lines, computed out here so the page stays a pure measurement ------------------
report.verdict = report.series.map((s) => ({
  weapon: s.weapon, moving: s.moving,
  ceiling_mps: +(BAND_TOP[s.tier] * 1.25).toFixed(2),
  peak_vs_ceiling: +(s.peak_drawn_tip_mps / (BAND_TOP[s.tier] * 1.25)).toFixed(2),
  tip_speed_ok: s.peak_drawn_tip_mps <= BAND_TOP[s.tier] * 1.25,
  follow_min: FOLLOW_MIN[s.tier],
  follow_ok: s.follow_through_frac === null ? null : s.follow_through_frac >= FOLLOW_MIN[s.tier],
}));
const still = report.series.filter((s) => !s.moving);
const move = report.series.filter((s) => s.moving);
report.still_target_understates_peak_by = move.map((m) => {
  const s = still.find((x) => x.weapon === m.weapon);
  return s ? { weapon: m.weapon, still_mps: s.peak_drawn_tip_mps, moving_mps: m.peak_drawn_tip_mps,
    ratio: +(m.peak_drawn_tip_mps / (s.peak_drawn_tip_mps || 1)).toFixed(3),
    still_yaw_travel_deg: s.player_yaw_travel_deg_during_active,
    moving_yaw_travel_deg: m.player_yaw_travel_deg_during_active } : null;
});

const outPath = path.join(outDir, `mass-browser-${tag}.json`);
writeJson(outPath, report);
console.log(`mass-browser [${tag}] — page errors ${report.page_errors}, boot tip_vs_socket_b_mm ${report.boot && report.boot.tip_vs_socket_b_mm}`);
for (const s of report.series) {
  const d = s.declared_f60;
  console.log(`  ${s.weapon.padEnd(20)} moving=${String(s.moving).padEnd(5)} ${String(s.move_id).padEnd(10)}`
    + ` S/A/R ${d ? d.startup + '/' + d.active + '/' + d.recovery : '-'} f@60`
    + `  act_obs ${String(s.active_frames_observed).padStart(3)} rec_obs ${String(s.recovery_frames_observed).padStart(3)}`);
  console.log(`  ${' '.repeat(20)} peak_drawn ${String(s.peak_drawn_tip_mps).padStart(7)} m/s`
    + `  yaw_during_active ${String(s.player_yaw_travel_deg_during_active).padStart(6)} deg`
    + `  follow_frac ${s.follow_through_frac}  (recovery frames moving ${s.recovery_frames_moving}/${s.recovery_frames_counted})`);
}
for (const v of report.verdict) {
  console.log(`  VERDICT ${v.weapon.padEnd(20)} moving=${String(v.moving).padEnd(5)}`
    + ` tip ${v.tip_speed_ok ? 'PASS' : 'FAIL'} (x${v.peak_vs_ceiling} of ${v.ceiling_mps} m/s)`
    + `  follow ${v.follow_ok === null ? 'N/A' : v.follow_ok ? 'PASS' : 'FAIL'} (>= ${v.follow_min})`);
}
for (const r of report.still_target_understates_peak_by) {
  if (r) console.log(`  STILL-vs-MOVING ${r.weapon}: ${r.still_mps} -> ${r.moving_mps} m/s (x${r.ratio}), yaw ${r.still_yaw_travel_deg} -> ${r.moving_yaw_travel_deg} deg`);
}
if (report.errors && report.errors.length) for (const e of report.errors) console.log('  ERROR ' + e);
console.log(`  written ${outPath}`);
