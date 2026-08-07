#!/usr/bin/env node
/**
 * cam-death-in-lock.mjs — the moment nothing in this project had measured.
 *
 * WHY THIS EXISTS. Every camera measurement in W1-06 so far has been taken against a target
 * that stays alive for the whole run and a player that stands still. Both are the failure
 * AGENT-PROTOCOL names: "a still target hides every steering defect", and "a control that
 * cannot exhibit the failure is not a control". The specific moment a Souls camera is judged
 * on is the one where the thing it is pointing at STOPS EXISTING — you land the killing blow,
 * the lock has nothing to hold, and what the camera does in the next fifteen frames is the
 * difference between a fight that ends and a fight that throws you.
 *
 * `game/data/combat/lockon.json` declares the answer in two lines:
 *
 *     "break_on_target_death": "on the target's death frame"
 *     "auto_reacquire": false        (…"steals the player's decision at the most dangerous
 *                                       moment of a group fight")
 *
 * Neither had a probe. This is that probe, and it measures four things across the death
 * frame, all of them things a player would describe without knowing a number:
 *
 *   D1  the lock releases on the death frame, not later and not never;
 *   D2  it does not hop to the second enemy standing right there;
 *   D3  the camera does not CUT — no single frame turns the view more than a human turn, and
 *       the heading the camera had at the death frame is still roughly the heading it has a
 *       quarter of a second later. A camera that snaps back to behind the player on the kill
 *       is the single most complained-about failure in this genre;
 *   D4  it does not go rigid either: the player is still moving, the pivot must still follow
 *       the body, and the mode must be back to `free` so look input works again.
 *
 * AND THE SUBJECT MOVES. The player runs and strafes for the whole run; the target is aggroed
 * and steered by the game's own perception and enemy AI, never teleported. A run in which the
 * player never moved would pass D3 by arithmetic.
 *
 * --selftest IS THE PROOF THE CUT DETECTOR CAN FAIL. It feeds the same detector a trace that
 * contains a deliberate 40-degree-per-frame slam of the view — the exact defect D3 exists to
 * catch — and requires it to go red. A detector that stays green on that is measuring nothing.
 *
 *   node tools/camera/cam-death-in-lock.mjs
 *   node tools/camera/cam-death-in-lock.mjs --selftest
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cam-death-in-lock.mjs — what the camera does when the thing it is framing dies.

  --selftest   also run the cut detector over a trace containing a deliberate 40 deg/frame
               view slam, and require it to report the cut. Proves the detector can fail.
  --out <path> write JSON here (default reports/w1-06/cam-death-in-lock.json)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

/* eslint-disable no-undef */
function runInPage(opts) {
  const H = window.__HARNESS;
  const R = { report: [], checks: {}, scenarios: {}, selftest: null };
  const ang180 = (d) => { let x = d % 360; if (x > 180) x -= 360; if (x < -180) x += 360; return x; };
  const r3 = (n) => +Number(n).toFixed(3);
  const chk = (k, pass, note) => { R.checks[k] = { pass: !!pass, note: note || null }; };
  const cam = () => H.getCameraFrame().camera;

  const CELLS = {};
  for (const c of H.getCameraRig().cells_meta) CELLS[c.id] = c;
  function place(cellId, x, z, yaw) {
    H.setCameraCell(cellId);
    H.teleport(x, z, { y: CELLS[cellId].ground_y, yaw: yaw || 0 });
  }

  /**
   * THE CUT DETECTOR. Given consecutive camera rows, the largest single-frame change in the
   * view direction, and the total heading change across a window. Used both on the real run
   * and — in --selftest — on a trace built to contain a cut.
   */
  function cuts(rows) {
    let worst = 0, worstAt = -1;
    for (let i = 1; i < rows.length; i++) {
      const dy = Math.abs(ang180(rows[i].yaw_deg - rows[i - 1].yaw_deg));
      const dp = Math.abs(rows[i].pitch_deg - rows[i - 1].pitch_deg);
      const d = Math.hypot(dy, dp);
      if (d > worst) { worst = d; worstAt = i; }
    }
    return { max_deg_per_frame: r3(worst), at_index: worstAt };
  }

  if (opts.selftest) {
    // A trace that IS the failure: fifteen calm frames, then the view slammed 40 degrees in
    // one frame, then calm again. If `cuts()` does not report it, D3 is decorative.
    const fake = [];
    for (let i = 0; i < 15; i++) fake.push({ yaw_deg: 10 + i * 0.5, pitch_deg: -8 });
    fake.push({ yaw_deg: fake[fake.length - 1].yaw_deg + 40, pitch_deg: -8 });
    for (let i = 0; i < 15; i++) fake.push({ yaw_deg: fake[fake.length - 1].yaw_deg + 0.5, pitch_deg: -8 });
    const c = cuts(fake);
    R.selftest = { injected_cut_deg: 40, detector_reported: c.max_deg_per_frame, at_index: c.at_index };
    chk('selftest_detector_sees_a_40deg_cut', c.max_deg_per_frame >= 39.5 && c.max_deg_per_frame <= 40.5,
      `injected a 40.000 deg/frame slam; detector reported ${c.max_deg_per_frame} at frame ${c.at_index}`);
    // And the converse: a clean trace must NOT trip it, or the detector is a rubber stamp.
    const clean = fake.slice(0, 15);
    chk('selftest_detector_quiet_on_clean_trace', cuts(clean).max_deg_per_frame < 1.0,
      `clean 15-frame ramp reported ${cuts(clean).max_deg_per_frame} deg/frame`);
    return R;
  }

  // =======================================================================================
  // The duel. Two enemies, both aggroed, both driven by the game's own AI; the player runs
  // and strafes throughout. At the chosen frame the locked one dies — with the other one
  // standing three metres away, which is what makes D2 a real question.
  // =======================================================================================
  const SCENARIOS = [
    { id: 'levy-dies-while-player-runs', arch: 'cam_levy', second: 'cam_levy', d: 4.0, drive: 'run' },
    // d was 3.5 and the aggroed levy then stood still for the whole run: already inside its own
    // reach, it swung on the spot and never took a step, so the lock spring was tracking a
    // stationary object and the run proved nothing. 5.5 m makes it close the distance.
    { id: 'levy-dies-while-player-strafes', arch: 'cam_levy', second: 'cam_levy', d: 5.5, drive: 'strafe' },
    { id: 'boss-dies-while-player-runs', arch: 'cam_boss_mid', second: 'cam_levy', d: 6.0, drive: 'run' },
    // POSITIVE CONTROL, and the reason it is here. The three runs above all report a heading
    // swing of exactly 0.000 deg after the kill, which is correct — RI-CAM02 §D forbids the
    // camera from following the body, so with no look input the yaw simply does not change —
    // but a check whose quantity is structurally pinned at zero is a check that cannot fail,
    // and this project has shipped several. This run holds SPRINT after the kill, which is
    // the ONE thing RI-CAM02 §E lets turn the camera for you. Its heading swing must be
    // clearly non-zero, and still inside the recentre's own 90 deg/s clamp. If this run also
    // reported zero, D3b would be measuring nothing in the other three.
    { id: 'levy-dies-then-player-sprints', arch: 'cam_levy', second: 'cam_levy', d: 4.0, drive: 'run', sprintAfter: true },
  ];
  const KILL_AT = 240;            // frames of live fight before the killing blow
  const AFTER = 150;              // 2.5 s of watching what the camera does next
  // The sprint control needs longer: 5 frames to swing the view off the body's heading, then
  // 20 clear frames for RI-CAM02 §E's gate (it requires no look input at all), then enough
  // frames for the recentre to visibly close the error.
  const SPRINT_AFTER = 330;
  const SWING_F = 5;              // frames of look input used to build the yaw error
  const SETTLE_F = 40;            // kill + this = the frame the swing window starts at

  for (const S of SCENARIOS) {
    H.setSeed(20260807);
    H.loadState('default');
    H.setRenderRate(0);
    place('cam-boss-arena', 0, 0, 0);

    const eid = H.spawn(S.arch, 0, -S.d);
    const other = H.spawn(S.second, 3.0, -S.d);
    H.aggro(eid); H.aggro(other);           // the game's own perception drives them from here
    H.lockOn(eid);
    H.stepFrames(2);

    const rows = [];
    let playerMoved = 0, targetMoved = 0;
    let lastP = H.getCameraFrame().player_pos.slice();
    let lastT = null;
    const drive = (f) => {
      // Real movement input, every frame. `move` is the left stick; the body turns and the
      // pivot follows it rigidly in XZ, which is the thing a stationary run cannot exercise.
      const t = f / 60;
      const ev = { f: 0 };
      if (S.drive === 'run') ev.move = [Math.sin(t * 1.7) * 0.8, 0.9];
      else ev.move = [Math.cos(t * 2.3) * 0.95, Math.sin(t * 0.9) * 0.4];
      // The sprint control: held from the kill onward, straight forward, which is what
      // RI-CAM02 §E's 20-frame gate wants (speed ≥ 0.90 of sprint, forward dominance ≥ 0.70).
      if (S.sprintAfter && f >= KILL_AT) {
        ev.move = [0, 1];
        if (f === KILL_AT) ev.press = ['sprint'];
        // RI-CAM02 §E closes the CAMERA yaw onto the PLAYER yaw. Running straight forward with
        // the camera already behind the body leaves nothing to close — which is exactly why the
        // first version of this control reported 0 deg and looked like the game was at fault.
        // So: swing the view 100 deg off the heading first, then stop looking entirely.
        if (f < KILL_AT + SWING_F) ev.look = [20, 0];
      }
      H.queueInputs([ev]);
    };

    let killFrame = -1, releaseFrame = -1, hoppedTo = null;
    const after_n = S.sprintAfter ? SPRINT_AFTER : AFTER;
    for (let f = 0; f < KILL_AT + after_n; f++) {
      if (f === KILL_AT) { H.killEntity(eid); killFrame = rows.length; }
      drive(f);
      H.stepFrames(1);
      const c = cam();
      const p = H.getCameraFrame().player_pos;
      playerMoved += Math.hypot(p[0] - lastP[0], p[2] - lastP[2]);
      lastP = p.slice();
      // How far the TARGET travelled under the game's own perception and enemy AI. Recorded
      // because a lock spring measured against a target that never moved is measuring nothing:
      // AGENT-PROTOCOL's "a still target hides every steering defect", in this piece's own run.
      const te = f <= KILL_AT ? H.listEntities().find((x) => x.eid === eid) : null;
      const tp = te && te.pos ? te.pos : null;
      if (tp) { if (lastT) targetMoved += Math.hypot(tp[0] - lastT[0], tp[2] - lastT[2]); lastT = tp.slice(); }
      rows.push({
        yaw_deg: c.yaw_deg, pitch_deg: c.pitch_deg, mode: c.mode,
        lock_target: c.lock_target === undefined ? null : c.lock_target,
        clip: !!c.clip_through, arm: c.arm_len_m,
        pivot_dy: c.pivot[1] - p[1],
        pivot_dxz: Math.hypot(c.pivot[0] - p[0], c.pivot[2] - p[2]),
        recentre_active: !!c.recentre_active,
      });
      if (releaseFrame < 0 && killFrame >= 0 && rows[rows.length - 1].lock_target === null) releaseFrame = rows.length - 1;
      if (releaseFrame >= 0 && hoppedTo === null && rows[rows.length - 1].lock_target) hoppedTo = rows[rows.length - 1].lock_target;
    }

    const before = rows.slice(Math.max(0, killFrame - 60), killFrame);
    const across = rows.slice(Math.max(0, killFrame - 2), Math.min(rows.length, killFrame + 30));
    const after = rows.slice(killFrame, rows.length);
    const cutAcross = cuts(across);
    const cutAfter = cuts(after);
    // How far the heading drifted in the quarter-second after the kill. A camera that whips
    // back to behind the player shows up here even if it does it smoothly over 15 frames,
    // which is exactly the failure a per-frame cut test alone would miss.
    const headingSwing15 = Math.abs(ang180(rows[Math.min(rows.length - 1, killFrame + 15)].yaw_deg - rows[killFrame].yaw_deg));
    const headingSwing60 = Math.abs(ang180(rows[Math.min(rows.length - 1, killFrame + 60)].yaw_deg - rows[killFrame].yaw_deg));
    // The sprint control's own window: from after the deliberate swing to the end of the run.
    const swingStart = Math.min(rows.length - 1, killFrame + SETTLE_F);
    const recentreSwing = Math.abs(ang180(rows[rows.length - 1].yaw_deg - rows[swingStart].yaw_deg));
    const recentreWindow = rows.slice(swingStart);
    const recentreCut = cuts(recentreWindow);

    const rec = {
      target: S.arch, second_enemy_present: true, sprint_after_kill: !!S.sprintAfter,
      player_path_m: r3(playerMoved),
      target_path_m: r3(targetMoved),
      lock_held_before_kill: before.every((r) => r.lock_target === eid),
      locked_mode_before_kill: before.filter((r) => r.mode === 'locked').length,
      kill_frame: killFrame,
      release_frame: releaseFrame,
      release_latency_frames: releaseFrame < 0 ? null : releaseFrame - killFrame,
      hopped_to: hoppedTo,
      mode_after_release: releaseFrame < 0 ? null : rows[Math.min(rows.length - 1, releaseFrame + 5)].mode,
      cut_across_death_deg_per_frame: cutAcross.max_deg_per_frame,
      cut_after_death_deg_per_frame: cutAfter.max_deg_per_frame,
      heading_swing_15f_deg: r3(headingSwing15),
      heading_swing_60f_deg: r3(headingSwing60),
      recentre_window_swing_deg: r3(recentreSwing),
      recentre_window_cut_deg_per_frame: recentreCut.max_deg_per_frame,
      recentre_active_frames: recentreWindow.filter((r) => r.recentre_active).length,
      pivot_dxz_p100_after: r3(Math.max(...after.map((r) => r.pivot_dxz))),
      pivot_dy_p100_after: r3(Math.max(...after.map((r) => Math.abs(r.pivot_dy)))),
      clip_frames_after: after.filter((r) => r.clip).length,
      arm_min_after: r3(Math.min(...after.map((r) => r.arm))),
    };
    R.scenarios[S.id] = rec;
    R.report.push(`${S.id}: player walked ${rec.player_path_m} m; lock released ` +
      `${rec.release_latency_frames} f after the kill; largest single-frame view change across ` +
      `the death ${rec.cut_across_death_deg_per_frame} deg; heading drifted ` +
      `${rec.heading_swing_15f_deg} deg in 15 f, ${rec.heading_swing_60f_deg} deg in 60 f`);
  }

  const V = Object.values(R.scenarios);
  // The run has to have been a real one before any of the rest means anything.
  chk('subject_actually_moved', V.every((v) => v.player_path_m > 8),
    `player path per run: ${V.map((v) => v.player_path_m).join(', ')} m (a run under 8 m is a ` +
    'stationary subject and hides every steering defect)');
  chk('locked_before_the_kill', V.every((v) => v.lock_held_before_kill && v.locked_mode_before_kill > 55),
    `frames in mode 'locked' in the second before the kill: ${V.map((v) => v.locked_mode_before_kill).join(', ')}/60`);
  // D1
  chk('D1_lock_releases_on_the_death_frame',
    V.every((v) => v.release_latency_frames !== null && v.release_latency_frames <= 1),
    `release latency: ${V.map((v) => v.release_latency_frames).join(', ')} frames ` +
    '(lockon.json: "on the target\'s death frame")');
  // D2
  chk('D2_no_auto_hop_to_the_next_enemy', V.every((v) => v.hopped_to === null),
    `hopped to: ${V.map((v) => v.hopped_to || 'nothing').join(', ')} (lockon.json auto_reacquire: false)`);
  // D3 — two separate ways of being thrown
  chk('D3a_no_cut_across_the_death_frame', V.every((v) => v.cut_across_death_deg_per_frame <= 7.5),
    `worst single-frame view change across the death = ` +
    `${Math.max(...V.map((v) => v.cut_across_death_deg_per_frame))} deg (CMB06 clamps the ` +
    'locked yaw spring at 7.000 deg/frame; a release must not exceed what the lock itself could)');
  const quiet = V.filter((v) => !v.sprint_after_kill);
  const sprinted = V.filter((v) => v.sprint_after_kill);
  chk('D3b_no_whip_back_behind_the_player', quiet.every((v) => v.heading_swing_15f_deg <= 15),
    `heading drift in the 15 frames after the kill: ${quiet.map((v) => v.heading_swing_15f_deg).join(', ')} deg ` +
    '(a recentre-on-kill shows up here even when it is smooth enough to pass D3a)');
  // The control that makes the line above mean something.
  chk('D3b_control_sprint_DOES_move_the_heading',
    sprinted.length > 0 && sprinted.every((v) => v.recentre_window_swing_deg > 20.0 && v.recentre_active_frames > 30),
    `after the kill, swinging the view 100 deg off the heading and then holding sprint drove the ` +
    `camera back by ${sprinted.map((v) => v.recentre_window_swing_deg).join(', ')} deg over ` +
    `${sprinted.map((v) => v.recentre_active_frames).join(', ')} frames of active recentre. ` +
    'This is the control: the quantity D3b measures IS able to move, so the zeros above are the ' +
    'game declining to turn the camera for you rather than the probe failing to look.');
  chk('D3b_control_recentre_stays_inside_its_clamp',
    sprinted.every((v) => v.recentre_window_cut_deg_per_frame <= 1.5 + 1e-6),
    `worst single-frame view change while the sprint recentre runs = ` +
    `${sprinted.map((v) => v.recentre_window_cut_deg_per_frame).join(', ')} deg (RI-CAM02 §E clamps ` +
    'the recentre at 90 deg/s = 1.500 deg/frame)');
  chk('the_target_was_alive_and_moving_before_the_kill',
    V.every((v) => v.target_path_m > 1.0),
    `target path under the game's own AI: ${V.map((v) => v.target_path_m).join(', ')} m ` +
    '(a lock spring measured against a target that never moved measures nothing)');
  // D4
  chk('D4_camera_returns_to_free_and_keeps_following',
    V.every((v) => v.mode_after_release === 'free' && v.pivot_dxz_p100_after < 0.02),
    `mode 5 frames after release: ${V.map((v) => v.mode_after_release).join(', ')}; worst ` +
    `horizontal pivot lag afterwards ${Math.max(...V.map((v) => v.pivot_dxz_p100_after))} m ` +
    '(RI-CAM01 §B: the XZ pivot is RIGID)');
  chk('no_clip_through_after_the_kill', V.every((v) => v.clip_frames_after === 0),
    `Σ clip_through after the kill = ${V.reduce((a, v) => a + v.clip_frames_after, 0)}`);
  chk('arm_floor_holds_after_the_kill', V.every((v) => v.arm_min_after >= 0.90 - 1e-6),
    `shortest boom after the kill = ${Math.min(...V.map((v) => v.arm_min_after))} m (RI-CAM05 §F floor 0.90)`);
  return R;
}
/* eslint-enable no-undef */

const handle = await launchGame({ ...args, width: 320, height: 240 });
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'setRenderRate',
  'setCameraCell', 'teleport', 'getCameraFrame', 'getCameraRig', 'spawn', 'aggro', 'lockOn', 'killEntity', 'listEntities']);

const out = {
  schema: 'elder-souls/cam-death-in-lock@1', unit: 'f@60', piece: 'W1-06',
  generated: new Date().toISOString(),
  subject: 'RI-CAM03 M5 / RI-CMB06 §A — lock release on target death, with the player moving.',
  data_file: 'game/data/combat/lockon.json (break_on_target_death, auto_reacquire)',
};

if (args.selftest) {
  out.selftest_run = await handle.page.evaluate(runInPage, { selftest: true });
}
const live = await handle.page.evaluate(runInPage, { selftest: false });
await handle.close();

out.report = live.report;
out.scenarios = live.scenarios;
out.checks = { ...(out.selftest_run ? out.selftest_run.checks : {}), ...live.checks };
if (out.selftest_run) out.selftest_detail = out.selftest_run.selftest;

const failed = Object.entries(out.checks).filter(([, v]) => !v.pass);
out.summary = { checks: Object.keys(out.checks).length, failed: failed.length,
  failures: failed.map(([k, v]) => `${k}: ${v.note || 'FAIL'}`) };

const dest = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'reports', 'w1-06', 'cam-death-in-lock.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

for (const l of out.report) log(l);
for (const [k, v] of Object.entries(out.checks)) log(`[${v.pass ? ' PASS ' : '*FAIL*'}] ${k}  ${v.note || ''}`);
log(`\n${out.summary.checks - out.summary.failed}/${out.summary.checks} checks pass -> ${dest}`);
process.exit(out.summary.failed ? EXIT.MEASUREMENT_FAIL : 0);
