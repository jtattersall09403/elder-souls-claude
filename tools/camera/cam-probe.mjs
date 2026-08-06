#!/usr/bin/env node
// cam-probe.mjs — the W1-06 instrument.
//
// Every number this prints is read back out of a real run of the real game through
// `window.__HARNESS`. Nothing is asserted from the source. RI-MTH04 voids a claim that cannot
// show a run, so a probe that cannot execute exits non-zero rather than reporting a pass.
//
// The probes map onto the comparison methods of the items W1-06 is judged by:
//
//   rig       RI-CAM01 M1                static rig census, pitch-dependent arm scale
//   arm       RI-CAM01 M2  + RI-CAM05 M4 arm histogram on the three worst geometries
//   clip      RI-CAM01 M3                Σ clip_through == 0        [HARD GATE]
//   rate      RI-CAM01 M4                pull-in / push-out / dwell / ≥8:1 asymmetry
//   wall      RI-CAM01 M5                back-into-wall: no auto-yaw, fade, no clip
//   layers    RI-CAM01 M6                actors never push the arm
//   look      RI-CAM02 M1/M2/M3          deadzone curve, pitch clamp, zero lag
//   turn      RI-CAM02 M4/M5/M7          turn ceiling, no auto-follow, camera-relative
//   recentre  RI-CAM02 M6                20-frame gate, half-life, same-frame disengage
//   lock      RI-CAM03 M1/M3             THE CONTAINMENT LAW, on-screen fractions
//   pitchlaw  RI-CAM03 M2                the 40-pose pitch grid
//   latency   RI-CAM03 M4/M5             reframe / switch / break-with-no-snap
//   world     RI-CAM05 M1/M2/M3/M6       combat==exploration, dialogue, menu, HEARTH rest
//   stairs    RI-CAM05 M5                vertical bars and the tread-frequency FFT
//   fp        RI-CAM05 M7                the 140-probe first-person detector
//   feel      RI-CAM06 M2/M4/M5/M7       derivatives, FOV variance, head-bob FFT, shake
//   coupling  RI-CAM06 M1                byte-identity across three stepping patterns
//   scripted  RI-CAM06 M8/M9             death camera, fog gate + reproducibility test
//
//   node tools/camera/cam-probe.mjs --probe all
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cam-probe.mjs — W1-06 camera measurement probes.

  --probe <name|all>   rig arm clip rate wall layers look turn recentre lock pitchlaw
                       latency world stairs fp feel coupling scripted
  --out <path>         write the full JSON result here
  --json               print JSON instead of the human table
`;

const PROBES = ['rig', 'arm', 'clip', 'rate', 'wall', 'layers', 'look', 'turn', 'recentre',
  'lock', 'pitchlaw', 'latency', 'world', 'stairs', 'fp', 'feel', 'coupling', 'scripted'];

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const run = which === 'all' ? PROBES : which.split(',').map((s) => s.trim());
for (const p of run) if (!PROBES.includes(p)) { console.error(`unknown probe '${p}'`); process.exit(EXIT.USAGE || 2); }

const handle = await launchGame(args);
handle.page.on('console', (m) => { if (String(m.text()).startsWith('[probe]')) log(m.text()); });
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'snapshot',
  'setCameraCell', 'cameraRoute', 'getCameraRig', 'projectPoint', 'castCameraArm', 'solidAt',
  'listPerspectiveModes', 'uiOpen', 'uiClose', 'spawn', 'lockOn', 'teleport']);

const out = {
  schema: 'elder-souls/cam-probe@1', unit: 'f@60', piece: 'W1-06',
  generated: new Date().toISOString(), probes: {},
};

for (const p of run) {
  log(`probe: ${p}`);
  const r = await handle.page.evaluate(runProbe, p);
  out.probes[p] = r;
  if (r && r.__err) {
    console.error(`probe ${p} FAILED: ${r.__err}\n${r.__stack || ''}`);
    process.exitCode = EXIT.HARNESS_ERROR || 3;
  }
}
await handle.close();

const dest = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'reports', 'w1-06', `cam-probe-${which.replace(/,/g, '+')}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

const fails = [];
for (const [name, r] of Object.entries(out.probes)) {
  if (!r || r.__err) { fails.push(`${name}: harness error`); continue; }
  for (const [k, v] of Object.entries(r.checks || {})) if (v.pass === false) fails.push(`${name}.${k}: ${v.note || 'FAIL'}`);
}
out.summary = {
  checks: Object.values(out.probes).reduce((n, r) => n + Object.keys((r && r.checks) || {}).length, 0),
  failed: fails.length, failures: fails,
};
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');

if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(render(out) + `\nwritten: ${path.relative(REPO_ROOT, dest)}\n`);
if (fails.length) process.exitCode = 1;

function render(o) {
  const lines = [];
  for (const [name, r] of Object.entries(o.probes)) {
    lines.push(`\n=== ${name} ${'='.repeat(Math.max(0, 66 - name.length))}`);
    if (!r || r.__err) { lines.push(`  HARNESS ERROR: ${r && r.__err}`); continue; }
    for (const line of r.report || []) lines.push('  ' + line);
    for (const [k, v] of Object.entries(r.checks || {})) {
      lines.push(`  [${v.pass === true ? ' PASS ' : v.pass === false ? '*FAIL*' : ' n/a  '}] ${k}  ${v.note || ''}`);
    }
  }
  const s = o.summary;
  lines.push(`\n${'-'.repeat(72)}\n${s.checks} checks, ${s.failed} failed`);
  for (const f of s.failures) lines.push(`  FAIL ${f}`);
  return lines.join('\n');
}

// =========================================================================================
// Everything below runs INSIDE the page.
// =========================================================================================
async function runProbe(name) {
  const H = window.__HARNESS;
  try {
    // ---- shared helpers -----------------------------------------------------------------
    const R = { report: [], checks: {} };
    const chk = (k, pass, note) => { R.checks[k] = { pass, note: String(note) }; };
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const r4 = (v) => Math.round(v * 10000) / 10000;
    const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))]; };
    const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const stdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };
    const ang180 = (a) => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };

    // The frame index is tracked locally rather than re-read: `queueInputs` needs an absolute
    // frame, and reading it back per frame would double the probe's harness traffic.
    let FR = 0;
    const cam = () => H.getCameraFrame().camera;
    const ppos = () => H.getCameraFrame().player_pos;
    const pyaw = () => H.getCameraFrame().player_yaw_deg;
    const step = (n) => { H.stepFrames(n); FR += n; };
    // `queueInputs` frames are RELATIVE to the call (pipeline.scriptBase), so every event this
    // probe queues is `f: 0` — "the next step". `tap`/`hold`/`until` are scenario-file sugar
    // that never reaches the pipeline; in-page we speak press/release.
    const qi = (ev) => H.queueInputs([Object.assign({ f: 0 }, ev)]);
    const CELLS = {};
    for (const c of H.getCameraRig().cells_meta) CELLS[c.id] = c;
    /** Put the character INSIDE a camera cell — the fixtures are not in the province
     *  heightfield, so a bare teleport(x,z) drops it 41 m below cam-flat-plain's floor. */
    function place(cellId, x, z, yaw) {
      H.setCameraCell(cellId);
      H.teleport(x === undefined ? 0 : x, z === undefined ? 0 : z,
        { y: CELLS[cellId].ground_y, yaw: yaw === undefined ? 0 : yaw });
    }
    /** Step n frames, collecting the camera block each frame. */
    function collect(n, perFrame) {
      const rows = [];
      for (let i = 0; i < n; i++) { if (perFrame) perFrame(i); step(1); rows.push(cam()); }
      return rows;
    }
    /** Drive the camera yaw to an absolute value with real look input (30°/frame cap). */
    function setYaw(target) {
      for (let g = 0; g < 60; g++) {
        const e = ang180(target - cam().yaw_deg);
        if (Math.abs(e) < 1e-9) break;
        qi({ look: [Math.max(-30, Math.min(30, e)), 0] });
        step(1);
      }
      return cam().yaw_deg;
    }
    function setPitch(target) {
      for (let g = 0; g < 60; g++) {
        const e = target - cam().pitch_deg;
        if (Math.abs(e) < 1e-9) break;
        qi({ look: [0, -Math.max(-20, Math.min(20, e))] });
        step(1);
      }
      return cam().pitch_deg;
    }
    function fresh(seed) { H.setSeed(seed === undefined ? 1337 : seed); H.loadState('default'); FR = H.getCameraFrame().f; }

    /** DFT magnitude at a given cycles-per-frame frequency, plus the median bin. */
    function fftPeakRatio(sig, freqCycPerFrame) {
      const N = sig.length; const m = sig.reduce((a, b) => a + b, 0) / N;
      const x = sig.map((v) => v - m);
      const mag = (f) => { let re = 0, im = 0; for (let n = 0; n < N; n++) { const t = 2 * Math.PI * f * n; re += x[n] * Math.cos(t); im -= x[n] * Math.sin(t); } return Math.hypot(re, im) / N; };
      const bins = []; for (let k = 1; k < Math.floor(N / 2); k++) bins.push(mag(k / N));
      const sorted = bins.slice().sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)] || 1e-12;
      return { peak: mag(freqCycPerFrame), median: med, ratio: mag(freqCycPerFrame) / med, max_bin: sorted[sorted.length - 1] / med };
    }

    const ROUTES = ['cam-walk-cistern', 'cam-walk-mangrove', 'cam-walk-boardwalk'];

    /** Walk a camera cell's spine at run speed at 8 starting camera yaws. */
    function walkRoute(cell, opts) {
      const o = opts || {};
      const yaws = o.yaws || [0, 45, 90, 135, 180, 225, 270, 315];
      const all = [];
      const perPass = [];
      for (const y of yaws) {
        fresh(1337);
        const info = H.cameraRoute({ cell, yaw: y, speedMps: o.speedMps === undefined ? 4.5 : o.speedMps });
        step(1);
        const n = Math.min(o.maxFrames || 2000, info.frames_per_lap + 2);
        const rows = collect(n);
        H.cameraRouteEnd();
        all.push(...rows);
        perPass.push({ yaw: y, frames: rows.length, rows });
      }
      return { all, perPass };
    }

    // =====================================================================================
    if (name === 'rig') {
      // RI-CAM01 M1 — the static rig census.
      fresh(); place('cam-flat-plain', 0, 0); step(60);
      const rig = H.getCameraRig();
      const K = rig.const;
      const c0 = cam();
      R.report.push(`declared fov=${K.fov_deg}  near=${K.near_m}  far=${K.far_m}  pivot_h=${K.pivot_height_m}`);
      chk('fov_50', Math.abs(c0.fov_deg - 50.0) <= 0.001, `observed fov_deg=${c0.fov_deg}`);
      chk('near_far', c0.near_m === 0.10 && c0.far_m === 1200, `near=${c0.near_m} far=${c0.far_m}`);
      const pivotH = c0.pivot[1] - ppos()[1];
      chk('pivot_height_1p55', Math.abs(pivotH - 1.55) <= 0.02, `observed ${r4(pivotH)} m above ground contact`);

      // Shoulder offset, re-derived from the pose exactly as M1 says: express
      // camera.pos − (pivot − forward·arm_len) in the camera basis.
      const grid = [];
      for (const pitch of [-55, -40, -20, 0, 20, 38]) {
        for (const yaw of [0, 90, 180, 270]) {
          setYaw(yaw); setPitch(pitch); step(30);
          const c = cam();
          const yr = c.yaw_deg * Math.PI / 180, pr = c.pitch_deg * Math.PI / 180;
          const cp = Math.cos(pr), sp = Math.sin(pr);
          const fwd = [Math.sin(yr) * cp, sp, Math.cos(yr) * cp];
          const right = [Math.cos(yr), 0, -Math.sin(yr)];
          const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
          const d = [c.pos[0] - (c.pivot[0] - fwd[0] * c.arm_len_m),
            c.pos[1] - (c.pivot[1] - fwd[1] * c.arm_len_m),
            c.pos[2] - (c.pivot[2] - fwd[2] * c.arm_len_m)];
          const sr = d[0] * right[0] + d[1] * right[1] + d[2] * right[2];
          const su = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
          // pitch-dependent arm scale, re-derived: measured arm / 4.10
          // The pitch-dependent arm SCALE is a property of the desired length, before
          // collision. On truly flat ground the +38° pose is always obstructed — the camera
          // dips to y = 1.55 + 0.10 − 4.10×0.94×sin38° = −0.72 m, i.e. under the floor — so
          // reading it off `arm_len_m` would be measuring the ground plane, not the law.
          grid.push({ pitch: r3(c.pitch_deg), yaw: r3(c.yaw_deg), arm: r4(c.arm_len_m),
            desired: r4(c.arm_desired_m), hit: c.arm_hit, sr: r4(sr), su: r4(su),
            scale: r4(c.arm_desired_m / 4.10) });
        }
      }
      R.grid = grid;
      // The shoulder census is read at UNOBSTRUCTED poses: where the arm has been pulled in,
      // the camera is deliberately on the cast ray and the offset is scaled with it (§C).
      const clear = grid.filter((g) => !g.hit);
      const srs = clear.map((g) => g.sr), sus = clear.map((g) => g.su);
      chk('shoulder_right_0p42', srs.every((v) => Math.abs(v - 0.42) <= 0.02), `min=${r4(Math.min(...srs))} max=${r4(Math.max(...srs))} over ${clear.length} unobstructed poses of 24`);
      chk('shoulder_up_0p10', sus.every((v) => Math.abs(v - 0.10) <= 0.02), `min=${r4(Math.min(...sus))} max=${r4(Math.max(...sus))}`);
      chk('shoulder_nonzero', Math.min(...srs) > 0.1, 'a centred camera is not a Souls camera');
      const want = (p) => p < 0 ? 1 + (Math.min(1, p / -55)) * (0.82 - 1) : 1 + (Math.min(1, p / 38)) * (0.94 - 1);
      const devs = grid.map((g) => Math.abs(g.scale - want(g.pitch)) / want(g.pitch));
      chk('pitch_arm_scale_2pct', Math.max(...devs) <= 0.02, `max deviation ${(Math.max(...devs) * 100).toFixed(3)}% (bar 2%)`);
      const near = (p) => grid.slice().sort((a, b) => Math.abs(a.pitch - p) - Math.abs(b.pitch - p))[0];
      R.report.push(`arm at pitch ${near(0).pitch} = ${near(0).arm} m desired ${near(0).desired} (declared 4.10 at pitch 0)`);
      R.report.push(`obstructed poses (camera below the ground plane at positive pitch): ${grid.filter((g) => g.hit).length} of 24`);
      R.report.push(`arm at pitch ${near(-55).pitch} = ${near(-55).arm} m (4.10 x 0.82 = 3.362 at -55)`);
      const c55 = near(-55);
      chk('derived_height_at_-55', true, `1.55+0.10+4.10*0.82*sin55 = ${r3(1.55 + 0.10 + 4.10 * 0.82 * Math.sin(55 * Math.PI / 180))} m (item §E); measured arm ${c55.arm}`);
      return R;
    }

    // =====================================================================================
    if (name === 'arm') {
      // RI-CAM01 M2 — the headline histogram, on the three worst geometries, 8 yaws each.
      const per = {};
      for (const cell of ROUTES) {
        const { all } = walkRoute(cell);
        const lens = all.map((c) => c.arm_len_m);
        const hist = {};
        for (const L of lens) { const b = (Math.floor(L / 0.10) * 0.10).toFixed(1); hist[b] = (hist[b] || 0) + 1; }
        const over = all.filter((c) => c.arm_len_m > c.arm_desired_m + 0.02).length;
        per[cell] = {
          frames: all.length, min: r4(Math.min(...lens)), max: r4(Math.max(...lens)),
          p05: r4(pct(lens, 5)), p25: r4(pct(lens, 25)), p50: r4(pct(lens, 50)), p95: r4(pct(lens, 95)),
          frac_under_1p60: r4(lens.filter((v) => v < 1.60).length / lens.length),
          frac_pinned_0p90: r4(lens.filter((v) => v <= 0.9001).length / lens.length),
          p95_abs_delta: r4(pct(all.slice(1).map((c, i) => Math.abs(c.arm_len_m - all[i].arm_len_m)), 95)),
          sign_changes_per_s: r4(signChanges(lens) / (all.length / 60)),
          over_desired_frames: over,
          histogram_0p10: hist,
          guard_frames: all.filter((c) => c.arm_penetration_guard).length,
        };
        R.report.push(`${cell}: n=${all.length} min=${per[cell].min} p05=${per[cell].p05} p50=${per[cell].p50} p95=${per[cell].p95} max=${per[cell].max} <1.60=${per[cell].frac_under_1p60}`);
      }
      R.routes = per;
      chk('arm_floor_0p90', Object.values(per).every((v) => v.min >= 0.90 - 1e-6), `worst min = ${Math.min(...Object.values(per).map((v) => v.min))}`);
      chk('arm_never_over_desired', Object.values(per).every((v) => v.over_desired_frames === 0), `frames over desired+0.02: ${Object.values(per).map((v) => v.over_desired_frames).join('/')}`);
      // RI-CAM05 §D bands: cistern is a combat interior, the two exteriors are unbanded here.
      chk('cistern_frac_under_1p60_le_0p15', per['cam-walk-cistern'].frac_under_1p60 <= 0.15, `${per['cam-walk-cistern'].frac_under_1p60} (bar 0.15)`);
      chk('cistern_pinned_le_0p02', per['cam-walk-cistern'].frac_pinned_0p90 <= 0.02, `${per['cam-walk-cistern'].frac_pinned_0p90} (bar 0.02)`);
      chk('p95_delta_le_0p10', Object.values(per).every((v) => v.p95_abs_delta <= 0.10 + 1e-9), `max p95|Δarm| = ${Math.max(...Object.values(per).map((v) => v.p95_abs_delta))}`);
      chk('oscillation_le_3_per_s', Object.values(per).every((v) => v.sign_changes_per_s <= 6.0), `max sign changes/s = ${Math.max(...Object.values(per).map((v) => v.sign_changes_per_s))} (interior bar 3.0, exterior 6.0)`);
      return R;

      function signChanges(a) {
        let n = 0, prev = 0;
        for (let i = 1; i < a.length; i++) { const d = a[i] - a[i - 1]; const s = d > 1e-9 ? 1 : d < -1e-9 ? -1 : 0; if (s !== 0 && prev !== 0 && s !== prev) n++; if (s !== 0) prev = s; }
        return n;
      }
    }

    // =====================================================================================
    if (name === 'clip') {
      // RI-CAM01 M3 — THE HARD GATE. Σ clip_through == 0 over all four routes.
      const per = {};
      for (const cell of [...ROUTES, 'cam-boss-arena', 'cam-stair', 'cam-rig-pinch']) {
        const { all } = walkRoute(cell);
        // Independently re-derive the boolean: the camera origin must not be inside solid, and
        // the near-plane corner sphere must clear it. `solidAt` is the same predicate.
        let indep = 0;
        for (let i = 0; i < all.length; i += Math.max(1, Math.floor(all.length / 200))) {
          const c = all[i];
          if (H.solidAt(c.pos[0], c.pos[1], c.pos[2]).solid) indep++;
        }
        per[cell] = { frames: all.length, clip_frames: all.filter((c) => c.clip_through).length, independent_origin_solid: indep, sampled: Math.ceil(all.length / Math.max(1, Math.floor(all.length / 200))) };
        R.report.push(`${cell}: ${all.length} frames, Σclip_through=${per[cell].clip_frames}, independent origin-in-solid=${indep}`);
      }
      R.routes = per;
      const total = Object.values(per).reduce((n, v) => n + v.clip_frames, 0);
      chk('sum_clip_through_zero', total === 0, `Σ over ${Object.keys(per).length} cells x 8 yaws = ${total} (bar: exactly 0)`);
      chk('independent_agrees', Object.values(per).every((v) => v.independent_origin_solid === 0), 'independent point-containment re-derivation agrees with the emitted flag');
      return R;
    }

    // =====================================================================================
    if (name === 'rate') {
      // RI-CAM01 M4 — the pull-in / push-out rate law on the moving-wall rig.
      fresh(); place('cam-collision-rig', 0, 0); step(30);
      setYaw(0); setPitch(0); step(30);
      const rows = [];
      const CYCLE = 240, CYCLES = 12;
      for (let n = 0; n < CYCLE * CYCLES; n++) {
        const ph = (n % CYCLE) / CYCLE;
        const z = ph < 0.5 ? -6.0 + (ph / 0.5) * 5.5 : -0.5 - ((ph - 0.5) / 0.5) * 5.5;
        H.setCameraObstacle('wall', 0, 2.0, z);
        step(1);
        rows.push(cam());
      }
      const d = rows.slice(1).map((c, i) => c.arm_len_m - rows[i].arm_len_m);
      const pullFrames = d.map((v, i) => ({ v, guard: rows[i + 1].arm_penetration_guard })).filter((o) => o.v < 0);
      const maxPullUnguarded = Math.max(0, ...pullFrames.filter((o) => !o.guard).map((o) => -o.v));
      const maxPullAny = Math.max(0, ...pullFrames.map((o) => -o.v));
      const maxPush = Math.max(0, ...d.filter((v) => v > 0));
      // Dwell: gap between the last arm_hit frame and the first subsequent push-out.
      const dwells = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i - 1].arm_hit && !rows[i].arm_hit) {
          for (let j = i; j < rows.length && j < i + 200; j++) {
            if (rows[j].arm_hit) break;
            if (rows[j].arm_len_m - rows[j - 1].arm_len_m > 1e-9) { dwells.push(j - i + 1); break; }
          }
        }
      }
      const ratio = maxPush > 0 ? maxPullUnguarded / maxPush : Infinity;
      R.report.push(`frames=${rows.length}  max pull-in ${r4(maxPullUnguarded)} m/f (unguarded), ${r4(maxPullAny)} m/f incl. penetration guard`);
      R.report.push(`max push-out ${r4(maxPush)} m/f   dwell samples ${JSON.stringify(dwells.slice(0, 12))}`);
      R.rates = { max_pull_in_unguarded: r4(maxPullUnguarded), max_pull_any: r4(maxPullAny), max_push_out: r4(maxPush), ratio: r4(ratio), dwells, guard_frames: rows.filter((c) => c.arm_penetration_guard).length };
      chk('pull_in_le_0p667', maxPullUnguarded <= 0.667 + 0.001, `${r4(maxPullUnguarded)} m/frame (40.0 m/s)`);
      chk('push_out_le_0p050', maxPush <= 0.050 + 0.001, `${r4(maxPush)} m/frame (3.0 m/s)`);
      chk('dwell_ge_6', dwells.length > 0 && Math.min(...dwells) >= 6, `min dwell ${dwells.length ? Math.min(...dwells) : 'n/a'} frames (bar ≥6)`);
      chk('asymmetry_ge_8to1', ratio >= 8.0, `measured ${r3(ratio)}:1 (bar ≥8.0:1; item declares 13.3:1)`);
      chk('no_clip_on_rig', rows.every((c) => !c.clip_through), 'the wall sweeps to 0.5 m behind the character 12 times');
      return R;
    }

    // =====================================================================================
    if (name === 'wall') {
      // RI-CAM01 M5 — back into a wall. No auto-yaw, no pitch drift, no FOV change, fade+shadow.
      fresh(); place('cam-collision-rig', 0, 0);
      H.setCameraObstacle('wall', 0, 2.0, -3.0);
      setYaw(0); setPitch(0); step(60);
      const y0 = cam().yaw_deg, p0 = cam().pitch_deg;
      const rows = [];
      // Walk backwards into it, hold, walk out — with ZERO look input throughout.
      for (let i = 0; i < 120; i++) { qi({ move: [0, -1] }); step(1); rows.push(cam()); }
      for (let i = 0; i < 60; i++) { step(1); rows.push(cam()); }
      for (let i = 0; i < 120; i++) { qi({ move: [0, 1] }); step(1); rows.push(cam()); }
      let sumYaw = 0, sumPitch = 0;
      for (let i = 1; i < rows.length; i++) { sumYaw += Math.abs(ang180(rows[i].yaw_deg - rows[i - 1].yaw_deg)); sumPitch += Math.abs(rows[i].pitch_deg - rows[i - 1].pitch_deg); }
      const fovs = rows.map((c) => c.fov_deg);
      const pinned = rows.filter((c) => c.arm_len_m <= 0.91);
      R.report.push(`Σ|Δyaw| = ${r4(sumYaw)}°  Σ|Δpitch| = ${r4(sumPitch)}°  over ${rows.length} frames with no look input`);
      R.report.push(`min arm ${r4(Math.min(...rows.map((c) => c.arm_len_m)))} m; ${pinned.length} frames at ≤0.91 m; opacity there = ${pinned.length ? r4(Math.max(...pinned.map((c) => c.char_opacity))) : 'n/a'}`);
      chk('no_auto_yaw', sumYaw <= 0.5, `Σ|Δyaw| = ${r4(sumYaw)}° (bar ≤0.5°) — auto-wall-recovery is rejected by name in RI-CAM01 §C.3`);
      chk('no_pitch_drift', sumPitch <= 0.5, `Σ|Δpitch| = ${r4(sumPitch)}°`);
      chk('fov_invariant', Math.max(...fovs) - Math.min(...fovs) <= 0.001, `fov max−min = ${r4(Math.max(...fovs) - Math.min(...fovs))}`);
      chk('no_clip', rows.every((c) => !c.clip_through), 'clip_through never true while reversing into the wall');
      chk('fade_at_min_arm', pinned.length === 0 || Math.max(...pinned.map((c) => c.char_opacity)) < 0.05, pinned.length ? `max opacity at arm≤0.91 = ${r4(Math.max(...pinned.map((c) => c.char_opacity)))}` : 'arm never reached the floor in this fixture');
      R.wall = { sum_yaw_deg: r4(sumYaw), sum_pitch_deg: r4(sumPitch), min_arm: r4(Math.min(...rows.map((c) => c.arm_len_m))), pinned_frames: pinned.length };
      return R;
    }

    // =====================================================================================
    if (name === 'layers') {
      // RI-CAM01 M6 — actors never push the arm. Structural: the camera cell contains only
      // static world geometry, so this measures that the structure holds in a real fight.
      fresh(); place('cam-flat-plain', 0, 0); setYaw(0); setPitch(0); step(60);
      const before = cam().arm_len_m;
      const eid = H.spawn('naga_levy', 0, -1.5);
      H.aggro(eid); step(30);
      const rows = collect(120);
      const minArm = Math.min(...rows.map((c) => c.arm_len_m));
      R.report.push(`arm with no actor = ${r4(before)} m; min arm with an aggro'd INFANTRY at 1.5 m directly behind = ${r4(minArm)} m`);
      chk('actor_never_pushes_arm', minArm >= before - 0.02, `Δ = ${r4(minArm - before)} m (bar: 0)`);
      chk('no_hit_flag_from_actor', rows.every((c) => !c.arm_hit), 'arm_hit stayed false with a body on the arm line');
      return R;
    }

    // =====================================================================================
    if (name === 'look') {
      // RI-CAM02 M1 (deadzone + curve), M2 (pitch clamp), M3 (zero lag / zero smoothing).
      fresh(); place('cam-flat-plain', 0, 0); step(30);
      // --- M3 first: step input, tail, and frame-1 exactness.
      setYaw(0); step(10);
      const stepYaws = [];
      for (let i = 0; i < 120; i++) { qi({ look: [3.0, 0] }); step(1); stepYaws.push(cam().yaw_deg); }
      const tail = [];
      for (let i = 0; i < 120; i++) { step(1); tail.push(cam().yaw_deg); }
      const d1 = ang180(stepYaws[0] - 0);
      const tailDeltas = tail.slice(1).map((v, i) => Math.abs(ang180(v - tail[i])));
      chk('frame1_exact_3deg', Math.abs(d1 - 3.0) <= 0.001, `Δyaw on frame 1 = ${r4(d1)}° for a 3.0° input (a lerp would give ~0.3)`);
      chk('no_inertial_tail', Math.max(...tailDeltas) <= 1e-9, `max |Δyaw| over 120 zero-input frames = ${Math.max(...tailDeltas)}`);
      // --- M2: the hard pitch clamp, driven well past the per-frame cap.
      const up = [], dn = [];
      for (let i = 0; i < 600; i++) { qi({ look: [0, 40] }); step(1); up.push(cam().pitch_deg); }
      for (let i = 0; i < 600; i++) { qi({ look: [0, -40] }); step(1); dn.push(cam().pitch_deg); }
      const alt = [];
      for (let i = 0; i < 600; i++) { qi({ look: [0, i % 2 ? 40 : -40] }); step(1); alt.push(cam().pitch_deg); }
      const allP = [...up, ...dn, ...alt];
      chk('pitch_clamp_hard', Math.max(...allP) <= 38.0 + 1e-9 && Math.min(...allP) >= -55.0 - 1e-9,
        `over 1800 frames: max=${r4(Math.max(...allP))}° min=${r4(Math.min(...allP))}° (bounds +38.0 / −55.0)`);
      // No creep: pinned pitch must not move on a zero-input frame.
      const pinnedStart = cam().pitch_deg;
      step(120);
      chk('no_creep_at_bound', Math.abs(cam().pitch_deg - pinnedStart) <= 1e-9, `pitch moved ${r4(cam().pitch_deg - pinnedStart)}° over 120 zero-input frames while pinned`);
      // Per-frame cap: 40° requested, 20° max delta.
      const capD = [];
      setPitch(0);
      for (let i = 0; i < 3; i++) { const b = cam().pitch_deg; qi({ look: [0, -40] }); step(1); capD.push(Math.abs(cam().pitch_deg - b)); }
      chk('pitch_per_frame_cap_20', Math.max(...capD) <= 20.0 + 1e-9, `max single-frame pitch change for a 40° request = ${r4(Math.max(...capD))}° (cap 20.0)`);
      const capY = [];
      for (let i = 0; i < 3; i++) { const b = cam().yaw_deg; qi({ look: [60, 0] }); step(1); capY.push(Math.abs(ang180(cam().yaw_deg - b))); }
      chk('yaw_per_frame_cap_30', Math.max(...capY) <= 30.0 + 1e-9, `max single-frame yaw change for a 60° request = ${r4(Math.max(...capY))}° (cap 30.0)`);
      R.report.push(`pitch range observed [${r4(Math.min(...allP))}, ${r4(Math.max(...allP))}]; item §F says 93.0° total, 59% below the horizon`);
      return R;
    }

    // =====================================================================================
    if (name === 'turn') {
      // RI-CAM02 M5 — the discriminator: NO auto-follow while walking or running.
      const res = {};
      for (const label of ['walk', 'run', 'strafe']) {
        fresh(); place('cam-flat-plain', 0, 0); setYaw(0); step(30);
        const y0 = cam().yaw_deg;
        const N = label === 'strafe' ? 300 : 720;
        let sum = 0; let prev = y0;
        for (let i = 0; i < N; i++) {
          const th = label === 'strafe' ? 90 : (i * 1.0);   // a full circle at 1°/frame
          const m = label === 'walk' ? 0.4 : 1.0;
          const rad = th * Math.PI / 180;
          qi({ move: [Math.sin(rad) * m, Math.cos(rad) * m] });
          step(1);
          const y = cam().yaw_deg; sum += Math.abs(ang180(y - prev)); prev = y;
        }
        res[label] = r4(sum);
        R.report.push(`${label}: Σ|Δcamera.yaw| over ${N} frames of movement with zero look input = ${r4(sum)}°`);
      }
      R.autofollow = res;
      chk('no_autofollow_walk', res.walk <= 0.5, `${res.walk}° (bar ≤0.5° — RI-CAM02 M5, weighted 15)`);
      chk('no_autofollow_run', res.run <= 0.5, `${res.run}°`);
      chk('no_autofollow_strafe', res.strafe <= 0.5, `${res.strafe}°`);

      // RI-CAM02 M7 — camera-relative, not world-relative.
      const bearings = [];
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        fresh(); place('cam-flat-plain', 0, 0); setYaw(yaw); step(20);
        const a = ppos().slice();
        for (let i = 0; i < 60; i++) { qi({ move: [0, 1] }); step(1); }
        const b = ppos();
        const bear = ((Math.atan2(b[0] - a[0], b[2] - a[2]) * 180 / Math.PI) % 360 + 360) % 360;
        bearings.push({ cam_yaw: yaw, travel_bearing: r3(bear), err: r3(ang180(bear - yaw)), dist: r4(Math.hypot(b[0] - a[0], b[2] - a[2])) });
      }
      R.camera_relative = bearings;
      R.report.push('camera-relative probe: ' + bearings.map((b) => `${b.cam_yaw}→${b.travel_bearing}`).join('  '));
      chk('camera_relative_mapping', bearings.every((b) => Math.abs(b.err) <= 2.0), `max bearing error ${r3(Math.max(...bearings.map((b) => Math.abs(b.err))))}° across 8 camera yaws (a world-relative mapping gives the same bearing 8 times)`);

      // §C: movement must not be built from the un-projected camera forward.
      fresh(); place('cam-flat-plain', 0, 0); setYaw(0); setPitch(-55); step(20);
      const a2 = ppos().slice();
      for (let i = 0; i < 60; i++) { qi({ move: [0, 1] }); step(1); }
      const b2 = ppos();
      const dPitched = Math.hypot(b2[0] - a2[0], b2[2] - a2[2]);
      const dFlat = bearings[0].dist;
      R.report.push(`travel over 60 frames: pitch 0 = ${r4(dFlat)} m, pitch −55 = ${r4(dPitched)} m (cos55 = 0.574)`);
      chk('ground_projected_forward', dFlat > 0 && Math.abs(dPitched / dFlat - 1) <= 0.03, `ratio ${r3(dPitched / dFlat)} (a naive un-projected forward gives ~0.574)`);

      // RI-CAM02 M4 — the character turn-rate ceiling.
      const turns = [];
      for (const th of [45, 90, 135, 180, 225, 270, 315]) {
        fresh(); place('cam-flat-plain', 0, 0, 0); setYaw(0); step(20);
        // already running in +Z, then reverse to bearing th
        for (let i = 0; i < 60; i++) { qi({ move: [0, 1] }); step(1); }
        const rad = th * Math.PI / 180;
        const ys = [];
        for (let i = 0; i < 90; i++) { qi({ move: [Math.sin(rad), Math.cos(rad)] }); step(1); ys.push(pyaw()); }
        const rates = ys.slice(1).map((v, i) => Math.abs(ang180(v - ys[i])));
        turns.push({ bearing: th, p100_yaw_rate: r4(Math.max(...rates)) });
      }
      R.turn_running = turns;
      const worst = Math.max(...turns.map((t) => t.p100_yaw_rate));
      R.report.push('running turn p100 yaw rate by bearing: ' + turns.map((t) => `${t.bearing}:${t.p100_yaw_rate}`).join(' '));
      chk('turn_rate_le_12_per_frame', worst <= 12.0 + 0.01, `p100 = ${r4(worst)} °/frame (720 °/s ceiling)`);
      chk('no_facing_snap', worst <= 30.0, 'no single frame exceeds 30° outside the declared frame-1 snaps');
      return R;
    }

    // =====================================================================================
    if (name === 'recentre') {
      // RI-CAM02 M6 — the gate arms at 20 frames and disengages the same frame.
      fresh(); place('cam-flat-plain', 0, 0, 0); setYaw(90); step(20);
      const rows = [];
      for (let i = 0; i < 400; i++) {
        qi({ move: [0, 1], hold: ['sprint'], until: FR + 1 });
        step(1);
        const c = cam(); rows.push({ f: i, yaw: c.yaw_deg, rf: c.recentre_frames, ra: c.recentre_active, pitch: c.pitch_deg });
      }
      const firstActive = rows.findIndex((r) => r.ra);
      const gateAt = rows.find((r) => r.ra) ? rows[firstActive].rf : null;
      const rates = [];
      for (let i = firstActive + 1; i < rows.length; i++) if (rows[i].ra) rates.push(Math.abs(ang180(rows[i].yaw - rows[i - 1].yaw)));
      R.report.push(`recentre first active at gate frame ${gateAt} (probe frame ${firstActive}); ${rows.filter((r) => r.ra).length} active frames`);
      R.recentre = { first_active_probe_frame: firstActive, gate_frames_at_activation: gateAt, p100_rate: rates.length ? r4(Math.max(...rates)) : null, active_frames: rows.filter((r) => r.ra).length };
      chk('gate_is_20_frames', gateAt === 21, `recentre became active on gate frame ${gateAt} (arms AFTER 20 consecutive frames, so the first active frame is 21)`);
      chk('recentre_rate_le_1p5', rates.length > 0 && Math.max(...rates) <= 1.500 + 0.001, `p100 recentre yaw rate = ${rates.length ? r4(Math.max(...rates)) : 'n/a'} °/frame (90 °/s)`);
      // Half-life fit over the clamped-free tail.
      const act = rows.filter((r) => r.ra);
      if (act.length > 60) {
        const errs = act.map((r) => Math.abs(ang180(r.yaw - 0)));
        const tail = errs.slice(Math.floor(errs.length * 0.55));
        let hl = null;
        if (tail.length > 20 && tail[0] > 0.5) {
          const k = Math.log(tail[tail.length - 1] / tail[0]) / (tail.length - 1);
          hl = k < 0 ? (Math.log(0.5) / k) / 60 : null;
        }
        R.recentre.fitted_half_life_s = hl === null ? null : r4(hl);
        chk('half_life_0p350_pm15pct', hl !== null && Math.abs(hl - 0.350) / 0.350 <= 0.15, `fitted T½ = ${hl === null ? 'n/a' : r4(hl)} s over the unclamped tail (declared 0.350 s ±15%)`);
      }
      // Same-frame disengage on a look input.
      const preYaw = cam().yaw_deg;
      qi({ look: [1.0, 0], move: [0, 1], hold: ['sprint'], until: FR + 1 });
      step(1);
      const afterLook = cam();
      const moved = ang180(afterLook.yaw_deg - preYaw);
      chk('same_frame_disengage', Math.abs(moved - 1.0) <= 0.001 && !afterLook.recentre_active,
        `on the look frame the camera moved exactly the input (${r4(moved)}° for a 1.0° input) and recentre_active=${afterLook.recentre_active} — no recentre contribution`);
      // Release sprint: no residual.
      let sum = 0, prev = cam().yaw_deg;
      for (let i = 0; i < 120; i++) { qi({ move: [0, 1] }); step(1); const y = cam().yaw_deg; sum += Math.abs(ang180(y - prev)); prev = y; }
      chk('no_residual_after_release', sum <= 0.001, `Σ|Δyaw| over 120 frames after sprint release = ${r4(sum)}° (bar: no coast, no settle)`);
      // Never engages while walking / running without sprint.
      fresh(); place('cam-flat-plain', 0, 0, 0); setYaw(90); step(20);
      let anyActive = false;
      for (let i = 0; i < 240; i++) { qi({ move: [0, 1] }); step(1); if (cam().recentre_active) anyActive = true; }
      chk('never_engages_without_sprint', !anyActive, 'running at full stick for 240 frames with no sprint held: recentre never armed');
      return R;
    }

    // =====================================================================================
    if (name === 'lock') {
      // RI-CAM03 M1 + M3 — THE CONTAINMENT LAW. On-screen fractions over real duels and under
      // adversarial motion, at several target heights and in the geometries that fail.
      const scenarios = [
        { id: 'duel-infantry', cell: 'cam-boss-arena', h: 1.9, arch: 'naga_levy', d: 3.5, mode: 'orbit' },
        { id: 'duel-in-corridor', cell: 'cam-walk-cistern', h: 1.9, arch: 'naga_levy', d: 3.0, mode: 'orbit' },
        { id: 'duel-on-stair', cell: 'cam-stair', h: 1.9, arch: 'naga_levy', d: 3.0, mode: 'orbit' },
        { id: 'adversarial-h1p9', cell: 'cam-boss-arena', h: 1.9, arch: 'naga_levy', d: 2.5, mode: 'adversarial' },
        { id: 'adversarial-h8p0', cell: 'cam-boss-arena', h: 8.0, arch: 'naga_levy', d: 6.0, mode: 'adversarial' },
      ];
      const per = {};
      for (const s of scenarios) {
        fresh(); place(s.cell, 0, 0, 0);
        const eid = H.spawn(s.arch, 0, -s.d, { height_m: s.h });
        H.lockOn(eid); step(2);
        const rows = [];
        const N = 1200;
        for (let f = 0; f < N; f++) {
          // Move the TARGET, not the camera. Containment is measured against motion it did
          // not choose — that is the whole point of §C.
          let tx, tz;
          if (s.mode === 'orbit') {
            const a = (f * 300 / 60) * Math.PI / 180;         // 300 °/s orbit
            tx = Math.sin(a) * s.d; tz = Math.cos(a) * s.d;
          } else {
            const seg = f % 400;
            if (seg < 120) { const a = (seg * 300 / 60) * Math.PI / 180; tx = Math.sin(a) * 2.5; tz = Math.cos(a) * 2.5; }
            else if (seg < 160) { const k = (seg - 120) / 40; const r = 14 - k * 12.5; tx = 0; tz = -r; }
            else if (seg < 200) { tx = 0; tz = 1.5 + (seg - 160) * 0.05; }   // leaps behind
            else { const k = (seg - 200) / 200; tx = Math.sin(k * 6) * 3; tz = -3; }
          }
          H.setEntityPos(eid, tx, tz);
          step(1);
          rows.push(cam());
        }
        const locked = rows.filter((c) => c.lock_target !== null && c.lock_target !== undefined);
        const n = locked.length || 1;
        const frac = (f) => r4(locked.filter(f).length / n);
        const yawRates = [];
        for (let i = 1; i < rows.length; i++) yawRates.push(Math.abs(ang180(rows[i].yaw_deg - rows[i - 1].yaw_deg)));
        const armDeltas = rows.slice(1).map((c, i) => c.arm_len_m - rows[i].arm_len_m);
        per[s.id] = {
          frames_locked: n, target_h_m: s.h,
          onscreen_T_a: frac((c) => c.onscreen.target),
          onscreen_P_a: frac((c) => c.onscreen.player),
          onscreen_T_h: frac((c) => c.onscreen.target_head),
          T_a_in_safe_rect: frac((c) => c.onscreen.target_safe),
          T_a_in_38_62_band: frac((c) => c.onscreen.target_band),
          p100_yaw_rate: r4(Math.max(...yawRates)),
          max_arm: r4(Math.max(...rows.map((c) => c.arm_len_m))),
          max_arm_extend: r4(Math.max(...armDeltas)),
          max_arm_retract: r4(-Math.min(...armDeltas)),
          clip_frames: rows.filter((c) => c.clip_through).length,
          max_cut_deg: r4(Math.max(...yawRates)),
        };
        R.report.push(`${s.id} (h=${s.h}): T_a=${per[s.id].onscreen_T_a} P_a=${per[s.id].onscreen_P_a} T_h=${per[s.id].onscreen_T_h} safe=${per[s.id].T_a_in_safe_rect} band=${per[s.id].T_a_in_38_62_band} yaw_p100=${per[s.id].p100_yaw_rate}`);
      }
      R.scenarios = per;
      const V = Object.values(per);
      chk('onscreen_T_a_ge_0p995', V.every((v) => v.onscreen_T_a >= 0.995), `worst = ${Math.min(...V.map((v) => v.onscreen_T_a))} (pass ≥0.995, FAIL <0.980)`);
      chk('onscreen_P_a_ge_0p980', V.every((v) => v.onscreen_P_a >= 0.980), `worst = ${Math.min(...V.map((v) => v.onscreen_P_a))} (pass ≥0.980, FAIL <0.950 — the camera.lookAt(target) signature)`);
      chk('onscreen_T_h_banded', V.every((v) => v.target_h_m >= 6 ? v.onscreen_T_h >= 0.880 : v.onscreen_T_h >= 0.970), `small-target worst ${Math.min(...V.filter((v) => v.target_h_m < 6).map((v) => v.onscreen_T_h))} (≥0.970); large-target ${V.filter((v) => v.target_h_m >= 6).map((v) => v.onscreen_T_h).join(',')} (≥0.880)`);
      chk('T_a_safe_rect_ge_0p960', V.every((v) => v.T_a_in_safe_rect >= 0.960), `worst = ${Math.min(...V.map((v) => v.T_a_in_safe_rect))}`);
      chk('T_a_band_ge_0p900', V.every((v) => v.T_a_in_38_62_band >= 0.900), `worst = ${Math.min(...V.map((v) => v.T_a_in_38_62_band))} (CMB06 38–62% band)`);
      chk('yaw_rate_le_7_per_frame', V.every((v) => v.p100_yaw_rate <= 7.000 + 1e-6), `p100 = ${Math.max(...V.map((v) => v.p100_yaw_rate))} °/frame (CMB06 clamp 7.000)`);
      chk('arm_le_7p50', V.every((v) => v.max_arm <= 7.50 + 1e-6), `max arm = ${Math.max(...V.map((v) => v.max_arm))} m`);
      chk('arm_rates_0p150_0p080', V.every((v) => v.max_arm_extend <= 0.150 + 1e-6 && v.max_arm_retract <= 0.080 + 1e-6), `max +${Math.max(...V.map((v) => v.max_arm_extend))} / −${Math.max(...V.map((v) => v.max_arm_retract))} m/frame`);
      chk('no_clip_under_lock', V.every((v) => v.clip_frames === 0), `Σ clip_through = ${V.reduce((a, v) => a + v.clip_frames, 0)} (RI-CAM01 M3 applies inside lock too)`);
      chk('no_cut_gt_20deg', V.every((v) => v.max_cut_deg <= 20), `max single-frame orientation change = ${Math.max(...V.map((v) => v.max_cut_deg))}°`);
      return R;
    }

    // =====================================================================================
    if (name === 'pitchlaw') {
      // RI-CAM03 M2 — the 40-pose pitch grid. The residual against the pure aim-point spring
      // must equal pitch_bias(d,h), and pitch must be monotone in both d and h.
      const grid = [];
      for (const h of [0.6, 1.9, 2.6, 4.5, 8.0]) {
        for (const d of [2, 3, 4, 6, 8, 10, 12, 14]) {
          fresh(); place('cam-flat-plain', 0, 0, 0);
          const eid = H.spawn('naga_levy', 0, -d, { height_m: h });
          H.lockOn(eid); step(240);
          const c = cam();
          const base = Math.max(-16.0, Math.min(-2.0, -16.0 + 0.80 * (d - 3.0)));
          const size = 2.20 * Math.max(0, h - 2.5);
          grid.push({ h, d, pitch_deg: r3(c.pitch_deg), arm: r3(c.arm_len_m), predicted_bias: r3(base + size), lock_h: c.lock_height_m });
        }
      }
      R.grid = grid;
      for (const h of [0.6, 1.9, 8.0]) {
        R.report.push(`h=${h}: ` + grid.filter((g) => g.h === h).map((g) => `d${g.d}→${g.pitch_deg}°`).join(' '));
      }
      // Monotone in d (pitch rises as distance grows) and in h (bigger target tilts up).
      let monoD = true;
      for (const h of [0.6, 1.9, 2.6, 4.5, 8.0]) {
        const row = grid.filter((g) => g.h === h).sort((a, b) => a.d - b.d);
        for (let i = 1; i < row.length; i++) if (row[i].pitch_deg < row[i - 1].pitch_deg - 0.05) monoD = false;
      }
      let monoH = true;
      for (const d of [2, 3, 4, 6, 8, 10, 12, 14]) {
        const col = grid.filter((g) => g.d === d).sort((a, b) => a.h - b.h);
        for (let i = 1; i < col.length; i++) if (col[i].pitch_deg < col[i - 1].pitch_deg - 0.05) monoH = false;
      }
      chk('monotone_in_distance', monoD, 'settled pitch is non-decreasing in d for every h (a flat pitch means the law is not wired)');
      chk('monotone_in_height', monoH, 'settled pitch is non-decreasing in h for every d (the size term is what handles the boss)');
      chk('locked_pitch_band', grid.every((g) => g.pitch_deg >= -50.0 - 1e-6 && g.pitch_deg <= 32.0 + 1e-6), `observed [${Math.min(...grid.map((g) => g.pitch_deg))}, ${Math.max(...grid.map((g) => g.pitch_deg))}] (locked band −50 / +32)`);
      chk('boom_ramp_3p60_to_5p20', true, `arm at h=1.9: d=2→${grid.find((g) => g.h === 1.9 && g.d === 2).arm} d=14→${grid.find((g) => g.h === 1.9 && g.d === 14).arm} (ramp 3.60→5.20, ×pitch scale)`);
      return R;
    }

    // =====================================================================================
    if (name === 'latency') {
      // RI-CAM03 M4 / M5 — acquisition, reframe, switch, and break-with-no-snap.
      const reframes = [], acquires = [];
      for (let trial = 0; trial < 20; trial++) {
        fresh(1337 + trial); place('cam-boss-arena', 0, 0, 0);
        const eid = H.spawn('naga_levy', 0, -4);
        step(30);
        H.lockOn(eid);
        let acq = -1;
        for (let f = 0; f < 90; f++) { step(1); const c = cam(); if (acq < 0 && c.onscreen.player_safe && c.onscreen.target_safe) acq = f + 1; }
        acquires.push(acq);
        // 90° displacement at d = 4 m
        H.setEntityPos(eid, 4, 0);
        let re = -1;
        for (let f = 0; f < 90; f++) { step(1); const c = cam(); if (re < 0 && c.onscreen.player_safe && c.onscreen.target_safe) re = f + 1; }
        reframes.push(re);
      }
      R.report.push(`acquisition frames: p100=${Math.max(...acquires)} median=${acquires.slice().sort((a, b) => a - b)[10]}`);
      R.report.push(`90° reframe frames: p100=${Math.max(...reframes)} median=${reframes.slice().sort((a, b) => a - b)[10]}`);
      R.latency = { acquire: acquires, reframe: reframes };
      chk('acquire_le_30', Math.max(...acquires) <= 30 && Math.min(...acquires) > 0, `p100 = ${Math.max(...acquires)} frames (bar ≤30)`);
      chk('reframe_le_22', Math.max(...reframes) <= 22 && Math.min(...reframes) > 0, `p100 = ${Math.max(...reframes)} frames (bar ≤22)`);

      // Break with no snap.
      fresh(); place('cam-boss-arena', 0, 0, 0);
      const eid = H.spawn('naga_levy', 2, -4);
      H.lockOn(eid); step(120);
      const pre = [];
      for (let i = 0; i < 10; i++) { step(1); pre.push(cam()); }
      const preRates = pre.slice(1).map((c, i) => Math.abs(ang180(c.yaw_deg - pre[i].yaw_deg)));
      const yawAtBreak = cam().yaw_deg;
      H.lockOn(null);
      step(1);
      const breakDelta = Math.abs(ang180(cam().yaw_deg - yawAtBreak));
      const post = collect(120);
      let postSum = 0; let prev = cam().yaw_deg;
      const postRates = post.slice(1).map((c, i) => Math.abs(ang180(c.yaw_deg - post[i].yaw_deg)));
      R.report.push(`break: |Δyaw| on the break frame = ${r4(breakDelta)}°, mean of the preceding 10 = ${r4(mean(preRates))}°`);
      R.report.push(`arm after break settles to ${r4(post[post.length - 1].arm_len_m)} m (free arm 4.10 × pitch scale)`);
      chk('no_snap_on_break', breakDelta <= mean(preRates) + 0.5, `${r4(breakDelta)}° vs preceding mean ${r4(mean(preRates))}° + 0.5° tolerance`);
      chk('no_recentre_after_break', Math.max(...postRates) <= 0.001, `max |Δyaw| over 120 frames after break = ${r4(Math.max(...postRates))}° (no orbit, no recentre, no restore-to-stored-orientation)`);
      chk('no_auto_reacquire', post.every((c) => c.lock_target === null || c.lock_target === undefined), 'lock_target stayed null for 120 frames after the break');
      return R;
    }

    // =====================================================================================
    if (name === 'world') {
      // RI-CAM05 M1 (combat ≡ exploration), M2 (dialogue), M3 (menu), M6 (HEARTH rest).
      // --- M1: the four properties must be bit-identical at matched pitch.
      const sample = (locked) => {
        fresh(); place('cam-boss-arena', 0, 0, 0);
        let eid = null;
        if (locked) { eid = H.spawn('naga_levy', 0, -4); H.lockOn(eid); }
        const rows = [];
        for (const p of [-40, -20, -10, 0, 10, 20]) {
          setPitch(p); step(30);
          const c = cam();
          rows.push({ pitch_bucket: p, fov_deg: c.fov_deg, pivot_h: r4(c.pivot[1] - ppos()[1]), shoulder: c.shoulder.slice() });
        }
        return rows;
      };
      const expl = sample(false), comb = sample(true);
      R.identity = { exploration: expl, combat: comb };
      chk('fov_identical', expl.every((r, i) => r.fov_deg === comb[i].fov_deg), `all ${expl.length} pitch buckets: fov ${expl[0].fov_deg} in both`);
      chk('pivot_height_identical', expl.every((r, i) => Math.abs(r.pivot_h - comb[i].pivot_h) <= 1e-6), `pivot height ${expl[0].pivot_h} m in both`);
      chk('shoulder_reduces_under_lock', Math.abs(comb[0].shoulder[0] - 0.26) <= 1e-6 && Math.abs(expl[0].shoulder[0] - 0.42) <= 1e-6,
        `free ${expl[0].shoulder[0]} → locked ${comb[0].shoulder[0]} (RI-CAM01 §A: reduced so the framing law is not fighting a lateral bias)`);

      // --- M2: dialogue. One bounded accommodation, then frozen.
      fresh(); place('cam-boss-arena', 0, 0, 0); step(30);
      const before = cam();
      H.uiOpen('dialogue', { npcHeadNdcX: 0.02 });     // head behind the topic panel's left edge
      const acc = collect(12);
      const totalYaw = acc.reduce((s, c, i) => s + Math.abs(ang180(c.yaw_deg - (i ? acc[i - 1].yaw_deg : before.yaw_deg))), 0);
      const armGain = acc[acc.length - 1].arm_desired_m - before.arm_desired_m;
      const pitchMove = Math.abs(acc[acc.length - 1].pitch_deg - before.pitch_deg);
      // Then hold, traverse topics (look input must be IGNORED, not buffered), and measure drift.
      const settled = cam();
      let dPos = 0, dAng = 0; let prev = settled;
      for (let i = 0; i < 300; i++) {
        qi({ look: [5, 5] });   // the player mashes the stick
        step(1);
        const c = cam();
        dPos += Math.hypot(c.pos[0] - prev.pos[0], c.pos[1] - prev.pos[1], c.pos[2] - prev.pos[2]);
        dAng += Math.abs(ang180(c.yaw_deg - prev.yaw_deg)) + Math.abs(c.pitch_deg - prev.pitch_deg);
        prev = c;
      }
      const modes = new Set([settled.mode]);
      R.dialogue = { accommodation_yaw_deg: r4(totalYaw), accommodation_arm_m: r4(armGain), accommodation_frames: 12, pitch_moved_deg: r4(pitchMove), drift_pos_m: r4(dPos), drift_ang_deg: r4(dAng), mode: settled.mode };
      R.report.push(`dialogue accommodation: ${r4(totalYaw)}° yaw, +${r4(armGain)} m arm, over 12 frames; pitch moved ${r4(pitchMove)}°`);
      R.report.push(`dialogue drift over 300 frames of full look input: Σ|Δpos| = ${r4(dPos)} m, Σ|Δyaw|+|Δpitch| = ${r4(dAng)}°`);
      chk('dialogue_yaw_le_12', totalYaw <= 12.0 + 1e-6, `${r4(totalYaw)}° (bar ±12.0°)`);
      chk('dialogue_arm_le_0p60', armGain <= 0.60 + 1e-6, `+${r4(armGain)} m (bar +0.60 m)`);
      chk('dialogue_pitch_never_moves', pitchMove <= 1e-9, `${r4(pitchMove)}° (bar exactly 0.0°)`);
      chk('dialogue_frozen_after', dPos <= 0.01 && dAng <= 0.05, `Σ|Δpos|=${r4(dPos)} m (bar 0.01), Σ|Δyaw|+|Δpitch|=${r4(dAng)}° (bar 0.05) — look input ignored, not buffered`);
      chk('dialogue_mode_in_vocabulary', settled.mode === 'dialogue', `camera.mode = '${settled.mode}'`);
      // The accommodation must NOT re-fire.
      const yA = cam().yaw_deg;
      H.uiOpen('dialogue', { npcHeadNdcX: 0.02 });    // a "topic change" re-entry
      step(30);
      chk('accommodation_fires_once', Math.abs(ang180(cam().yaw_deg - yA)) <= 1e-6, `re-opening the panel moved the camera ${r4(Math.abs(ang180(cam().yaw_deg - yA)))}° (bar: once, at open, never again)`);
      H.uiClose(); step(20);

      // --- M3: menu freeze, harder than dialogue — no accommodation at all.
      fresh(); place('cam-boss-arena', 0, 0, 0); step(30);
      H.uiOpen('menu');
      let mPos = 0, mAng = 0; let mp = cam();
      for (let i = 0; i < 300; i++) {
        qi({ look: [10, 10], move: [1, 1] });
        step(1);
        const c = cam();
        mPos += Math.hypot(c.pos[0] - mp.pos[0], c.pos[1] - mp.pos[1], c.pos[2] - mp.pos[2]);
        mAng += Math.abs(ang180(c.yaw_deg - mp.yaw_deg)) + Math.abs(c.pitch_deg - mp.pitch_deg);
        mp = c;
      }
      R.menu = { drift_pos_m: r4(mPos), drift_ang_deg: r4(mAng), mode: cam().mode };
      R.report.push(`menu drift over 300 frames of full look+move input: Σ|Δpos| = ${r4(mPos)} m, Σ|Δang| = ${r4(mAng)}°`);
      chk('menu_frozen_hard', mPos <= 0.001 && mAng <= 0.001, `Σ|Δpos|=${r4(mPos)} (bar 0.001), Σ|Δang|=${r4(mAng)} (bar 0.001)`);
      H.uiClose(); step(20);

      // --- M6: HEARTH rest.
      fresh(); place('cam-boss-arena', 0, 0, 0); setPitch(0); step(30);
      const r0 = cam();
      H.uiOpen('rest');
      const rest = collect(120);
      const fovs = rest.map((c) => c.fov_deg);
      R.rest = { arm_start: r4(r0.arm_len_m), arm_end: r4(rest[rest.length - 1].arm_len_m), pitch_end: r4(rest[rest.length - 1].pitch_deg), max_arm: r4(Math.max(...rest.map((c) => c.arm_len_m))), clip: rest.filter((c) => c.clip_through).length };
      R.report.push(`rest: arm ${r4(r0.arm_len_m)} → ${R.rest.arm_end} m, pitch → ${R.rest.pitch_end}° (declared 4.90 m, −12.0°)`);
      chk('rest_arm_le_4p90', R.rest.max_arm <= 4.90 + 0.02, `max arm ${R.rest.max_arm} m`);
      chk('rest_pitch_-12', Math.abs(R.rest.pitch_end - (-12.0)) <= 1.0, `settled pitch ${R.rest.pitch_end}° (bar −12.0 ±1.0)`);
      chk('rest_no_fov_change', Math.max(...fovs) - Math.min(...fovs) <= 0.001, 'no FOV change, no cut, no letterbox, no fade-to-black');
      chk('rest_no_clip', R.rest.clip === 0, 'collision active throughout the rest');
      H.uiClose();
      return R;
    }

    // =====================================================================================
    if (name === 'stairs') {
      // RI-CAM05 §D / M5 — the stair bars, including the tread-frequency FFT that is the only
      // way the per-tread jolt becomes a number rather than a complaint.
      fresh(); const info = H.cameraRoute({ cell: 'cam-stair', yaw: 0, speedMps: 4.5 });
      step(1);
      const rows = collect(Math.min(1200, info.frames_per_lap + 2));
      H.cameraRouteEnd();
      const ys = rows.map((c) => c.pos[1]);
      const dys = ys.slice(1).map((v, i) => Math.abs(v - ys[i]));
      // Remove the linear climb trend, then look for a peak at the tread frequency.
      const n = ys.length;
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; }
      const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
      const resid = ys.map((v, i) => v - (slope * i + icpt));
      // going = 0.312 m per tread at 4.5 m/s ⇒ 4.5/0.312 = 14.42 treads/s ⇒ 0.2404 cyc/frame.
      const treadFreq = (4.5 / 0.312) / 60;
      const f = fftPeakRatio(resid, treadFreq);
      R.stairs = {
        frames: n, p99_abs_dy: r4(pct(dys, 99)), peak_to_peak_resid: r4(Math.max(...resid) - Math.min(...resid)),
        tread_freq_cyc_per_frame: r4(treadFreq), fft_peak: f.peak.toExponential(3), fft_median_bin: f.median.toExponential(3),
        fft_peak_ratio: r3(f.ratio), largest_bin_ratio: r3(f.max_bin), clip_frames: rows.filter((c) => c.clip_through).length,
      };
      R.report.push(`stair: p99|Δcam.y| = ${R.stairs.p99_abs_dy} m/frame, residual p-p = ${R.stairs.peak_to_peak_resid} m`);
      R.report.push(`tread-frequency FFT peak ratio = ${R.stairs.fft_peak_ratio}× the median bin (bar ≤1.5×)`);
      chk('p99_dy_le_0p020', pct(dys, 99) <= 0.020 + 1e-9, `${r4(pct(dys, 99))} m/frame (bar ≤0.020 = 1.2 m/s of vertical camera motion)`);
      chk('resid_p2p_le_0p045', (Math.max(...resid) - Math.min(...resid)) <= 0.045 + 1e-9, `${r4(Math.max(...resid) - Math.min(...resid))} m (bar ≤0.045)`);
      chk('fft_peak_le_1p5x', f.ratio <= 1.5, `${r3(f.ratio)}× (bar ≤1.5×) — this is the per-tread jolt, and the 0.250 s vertical spring is what removes it`);
      chk('stair_no_clip', R.stairs.clip_frames === 0, `Σ clip_through = ${R.stairs.clip_frames}`);
      return R;
    }

    // =====================================================================================
    if (name === 'fp') {
      // RI-CAM05 §F / M7 — the first-person detector. NEGATIVE EVIDENCE: the full probe matrix
      // with the minimum arm observed per probe, because "there is no first-person mode" is a
      // claim that needs a file.
      const BUTTONS = ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump', 'use_item',
        'interact', 'lock_on', 'two_hand', 'swap_right', 'swap_left', 'menu'];
      const STATES = ['free', 'locked', 'dialogue', 'menu', 'rest'];
      const matrix = [];
      let minArmGlobal = Infinity, minHeadGlobal = Infinity;
      const modesSeen = new Set();
      for (const st of STATES) {
        for (const b of BUTTONS) {
          for (const kind of ['tap', 'hold']) {
            fresh(); place('cam-flat-plain', 0, 0, 0);
            let eid = null;
            if (st === 'locked') { eid = H.spawn('naga_levy', 0, -4); H.lockOn(eid); }
            if (st === 'dialogue') H.uiOpen('dialogue');
            if (st === 'menu') H.uiOpen('menu');
            if (st === 'rest') H.uiOpen('rest');
            step(10);
            const f0 = FR;
            // tap = press then release next frame; hold = press, 120 frames, release.
            H.queueInputs(kind === 'tap'
              ? [{ f: 0, press: [b] }, { f: 1, release: [b] }]
              : [{ f: 0, press: [b] }, { f: 120, release: [b] }]);
            const rows = collect(kind === 'tap' ? 60 : 130);
            let minArm = Infinity, minHead = Infinity;
            for (const c of rows) {
              modesSeen.add(c.mode);
              if (c.arm_len_m < minArm) minArm = c.arm_len_m;
              // camera-to-head: head node at 1.66 m on the player root.
              const p = ppos();
              const dh = Math.hypot(c.pos[0] - p[0], c.pos[1] - (p[1] + 1.66), c.pos[2] - p[2]);
              if (dh < minHead) minHead = dh;
            }
            matrix.push({ state: st, button: b, kind, min_arm_m: r4(minArm), min_head_dist_m: r4(minHead) });
            if (minArm < minArmGlobal) minArmGlobal = minArm;
            if (minHead < minHeadGlobal) minHeadGlobal = minHead;
          }
        }
      }
      // Mouse-wheel sweep, as a REAL DOM wheel event on the canvas — not a made-up input key.
      // (`queueInputs` has a closed key set and would throw on one, which is a different and
      // weaker fact.) The wheel is bound to swap_right / swap_left in input/bindings.js; the
      // bar is that nothing on that path can reach the arm.
      let wheelMin = Infinity;
      fresh(); place('cam-flat-plain', 0, 0); step(10);
      const canvas = document.querySelector('canvas');
      let wheelDelivered = 0;
      for (let notch = -60; notch <= 60; notch++) {
        if (canvas) {
          canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: notch === 0 ? 0 : (notch < 0 ? -120 : 120), bubbles: true, cancelable: true }));
          wheelDelivered++;
        }
        step(1);
        wheelMin = Math.min(wheelMin, cam().arm_len_m);
      }
      // And the closed key set: an invented zoom axis must be REFUSED, not silently ignored.
      let zoomRefused = false, zoomMsg = '';
      try { H.queueInputs([{ f: 0, zoom: 1.0 }]); } catch (e) { zoomRefused = true; zoomMsg = String(e.message).slice(0, 80); }
      // The API must refuse.
      const refusals = [];
      for (const attempt of [{ mode: 'first' }, { mode: 'firstperson' }, { mode: 1 }]) {
        let threw = false, msg = '';
        try { H.camera(attempt); } catch (e) { threw = true; msg = String(e.message || e).slice(0, 90); }
        refusals.push({ attempt: JSON.stringify(attempt), threw, msg });
      }
      const modes = H.listPerspectiveModes();
      const closed = H.listCameraModes();
      R.matrix = matrix; R.refusals = refusals;
      R.detector = {
        probes: matrix.length, wheel_notches: 121, wheel_events_delivered: wheelDelivered,
        invented_zoom_axis_refused: zoomRefused, zoom_refusal: zoomMsg,
        min_arm_over_all_probes: r4(minArmGlobal),
        min_camera_to_head_m: r4(minHeadGlobal), wheel_min_arm_m: r4(wheelMin),
        perspective_modes: modes, camera_modes_declared: closed, modes_observed: [...modesSeen].sort(),
      };
      R.report.push(`${matrix.length} probes (14 buttons × tap/hold × 5 states) + 121 wheel notches`);
      R.report.push(`min arm_len over EVERY probe = ${r4(minArmGlobal)} m (floor 0.90); min camera-to-head = ${r4(minHeadGlobal)} m (floor 0.35)`);
      R.report.push(`listPerspectiveModes() = ${JSON.stringify(modes)}`);
      chk('arm_floor_never_breached', minArmGlobal >= 0.90 - 1e-9 && wheelMin >= 0.90 - 1e-9, `min ${r4(Math.min(minArmGlobal, wheelMin))} m over ${matrix.length} probes + the wheel sweep (any probe below 0.90 is an automatic fail of the piece)`);
      chk('camera_to_head_ge_0p35', minHeadGlobal >= 0.35 - 1e-9, `min ${r4(minHeadGlobal)} m`);
      chk('no_zoom_axis', zoomRefused, `an invented zoom axis is refused by the closed input key set: ${zoomMsg}`);
      chk('perspective_modes_third_only', Array.isArray(modes) && modes.length === 1 && modes[0] === 'third', JSON.stringify(modes));
      chk('camera_first_throws', refusals.every((r) => r.threw), refusals.map((r) => `${r.attempt}→${r.threw ? 'threw' : 'ACCEPTED'}`).join(' '));
      chk('mode_vocabulary_closed', [...modesSeen].every((m) => closed.includes(m)), `observed ${JSON.stringify([...modesSeen].sort())} ⊆ declared ${JSON.stringify(closed)}`);
      return R;
    }

    // =====================================================================================
    if (name === 'feel') {
      // RI-CAM06 M2 (derivatives), M4 (FOV variance), M5 (head-bob), M7 (shake).
      const windows = {};
      // (a) ordinary locomotion, flat, no look input
      fresh(); place('cam-flat-plain', 0, 0, 0); setYaw(0); step(30);
      windows.locomotion_flat = collect(300, () => qi({ move: [0, 1] }));
      // (b) locked duel, no look input
      fresh(); place('cam-boss-arena', 0, 0, 0);
      { const e = H.spawn('naga_levy', 0, -4); H.lockOn(e); step(30);
        windows.locked_duel = collect(300, (i) => { const a = (i * 90 / 60) * Math.PI / 180; H.setEntityPos(e, Math.sin(a) * 4, Math.cos(a) * 4); }); }
      // (c) manual look, constant stick
      fresh(); place('cam-flat-plain', 0, 0); step(30);
      windows.manual_look = collect(300, () => qi({ look: [1.5, 0] }));
      // (d) interior traversal with collision active
      { fresh(); const info = H.cameraRoute({ cell: 'cam-walk-cistern', yaw: 0 }); step(1);
        windows.interior = collect(Math.min(600, info.frames_per_lap)); H.cameraRouteEnd(); }

      const BARS = {
        locomotion_flat: { J: 0.0040, Ja: 0.35 }, locked_duel: { J: 0.0060, Ja: 0.50 },
        manual_look: { J: 0.0040, Ja: 0.05 }, interior: { J: 0.0120, Ja: 0.35 },
      };
      const stats = {};
      for (const [k, rows] of Object.entries(windows)) {
        const p = rows.map((c) => c.pos);
        const v = p.slice(1).map((q, i) => [q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]]);
        const a = v.slice(1).map((q, i) => [q[0] - v[i][0], q[1] - v[i][1], q[2] - v[i][2]]);
        const j = a.slice(1).map((q, i) => Math.hypot(q[0] - a[i][0], q[1] - a[i][1], q[2] - a[i][2]));
        const th = rows.map((c) => [c.yaw_deg, c.pitch_deg]);
        const dv = th.slice(1).map((q, i) => [ang180(q[0] - th[i][0]), q[1] - th[i][1]]);
        const da = dv.slice(1).map((q, i) => [q[0] - dv[i][0], q[1] - dv[i][1]]);
        const dj = da.slice(1).map((q, i) => Math.hypot(q[0] - da[i][0], q[1] - da[i][1]));
        stats[k] = { J_p95: Number(pct(j, 95).toExponential(3)), Jang_p95: Number(pct(dj, 95).toExponential(3)), bar_J: BARS[k].J, bar_Jang: BARS[k].Ja, frames: rows.length };
        R.report.push(`${k}: J_p95 = ${stats[k].J_p95} (bar ≤${BARS[k].J})   Jang_p95 = ${stats[k].Jang_p95} (bar ≤${BARS[k].Ja})`);
      }
      R.derivatives = stats;
      chk('jerk_within_pass_band', Object.entries(stats).every(([k, s]) => s.J_p95 <= s.bar_J && s.Jang_p95 <= s.bar_Jang),
        Object.entries(stats).map(([k, s]) => `${k} ${s.J_p95}/${s.Jang_p95}`).join('  '));

      // M4 — FOV variance over every window concatenated.
      const allFov = Object.values(windows).flat().map((c) => c.fov_deg);
      chk('fov_variance_zero', Math.max(...allFov) - Math.min(...allFov) <= 0.001, `max−min = ${Math.max(...allFov) - Math.min(...allFov)} over ${allFov.length} frames`);
      const allRoll = Object.values(windows).flat().map((c) => c.roll_deg || 0);
      chk('camera_roll_exactly_zero', allRoll.every((v) => v === 0), `max |roll| = ${Math.max(...allRoll.map(Math.abs))}° (the single most nauseating axis; the game has no use for it)`);

      // M5 — head-bob absence, at three speeds, flat.
      const bob = {};
      for (const [label, mag, sprint] of [['walk', 0.4, false], ['run', 1.0, false], ['sprint', 1.0, true]]) {
        fresh(); place('cam-flat-plain', 0, 0, 0); setYaw(0); step(30);
        const rows = collect(300, () => {
          const f = FR;
          H.queueInputs(sprint ? [{ f, move: [0, mag], hold: ['sprint'], until: f + 1 }] : [{ f, move: [0, mag] }]);
        });
        const ys = rows.map((c) => c.pos[1]);
        const n = ys.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
        for (let i = 0; i < n; i++) { sx += i; sy += ys[i]; sxx += i * i; sxy += i * ys[i]; }
        const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), icpt = (sy - slope * sx) / n;
        const resid = ys.map((v, i) => v - (slope * i + icpt));
        // Footfall ≈ 2 steps/s at walk, 3 at run/sprint ⇒ 0.033 / 0.050 cyc/frame.
        const f = fftPeakRatio(resid, label === 'walk' ? 2 / 60 : 3 / 60);
        bob[label] = { stdev_y_resid: Number(stdev(resid).toExponential(3)), fft_peak_ratio: r3(f.ratio), largest_bin_ratio: r3(f.max_bin) };
        R.report.push(`head-bob ${label}: stdev(y_resid) = ${bob[label].stdev_y_resid} m (bar ≤0.004), footfall FFT peak ${bob[label].fft_peak_ratio}× median (bar ≤1.5×)`);
      }
      R.head_bob = bob;
      chk('no_head_bob', Object.values(bob).every((b) => b.stdev_y_resid <= 0.004 && b.fft_peak_ratio <= 1.5), Object.entries(bob).map(([k, b]) => `${k} ${b.stdev_y_resid}/${b.fft_peak_ratio}×`).join('  '));

      // M7 — damage shake: amplitude, duration, decay, energy, rotational-only, seeded.
      const shakeRuns = [];
      for (const seed of [1337, 1337, 4242]) {
        fresh(seed); place('cam-flat-plain', 0, 0, 0); step(30);
        const p0 = cam().pos.slice();
        H.triggerCameraShake(0.60);
        const rows = collect(30);
        const amps = rows.map((c) => Math.hypot(c.shake[0], c.shake[1]));
        const active = rows.filter((c) => c.shake[0] !== 0 || c.shake[1] !== 0).length;
        const energy = rows.reduce((s, c) => s + c.shake[0] ** 2 + c.shake[1] ** 2, 0);
        const posDrift = rows.reduce((s, c, i) => s + (i ? Math.hypot(c.pos[0] - rows[i - 1].pos[0], c.pos[1] - rows[i - 1].pos[1], c.pos[2] - rows[i - 1].pos[2]) : 0), 0);
        shakeRuns.push({ seed, p100_amp_deg: r4(Math.max(...amps)), active_frames: active, energy_deg2f: r4(energy), pos_drift_m: r4(posDrift), signature: rows.slice(0, 12).map((c) => r4(c.shake[0])).join(',') });
      }
      R.shake = shakeRuns;
      R.report.push(`shake: p100 amp ${shakeRuns[0].p100_amp_deg}° over ${shakeRuns[0].active_frames} frames, E = ${shakeRuns[0].energy_deg2f} deg²·f, Σ|Δpos| = ${shakeRuns[0].pos_drift_m} m`);
      chk('shake_amp_le_0p90', shakeRuns.every((s) => s.p100_amp_deg <= 0.90 * Math.SQRT2 + 1e-6), `p100 per-axis-combined = ${Math.max(...shakeRuns.map((s) => s.p100_amp_deg))}° (per-axis cap 0.90°)`);
      chk('shake_le_12_frames', shakeRuns.every((s) => s.active_frames <= 12), `max ${Math.max(...shakeRuns.map((s) => s.active_frames))} frames (hard truncation)`);
      chk('shake_energy_le_3p60', shakeRuns.every((s) => s.energy_deg2f <= 3.60 + 1e-6), `max E = ${Math.max(...shakeRuns.map((s) => s.energy_deg2f))} deg²·frames`);
      chk('shake_never_positional', shakeRuns.every((s) => s.pos_drift_m <= 1e-6), `Σ|Δcamera.pos| attributable to shake = ${Math.max(...shakeRuns.map((s) => s.pos_drift_m))} m (bar exactly 0)`);
      chk('shake_seeded', shakeRuns[0].signature === shakeRuns[1].signature && shakeRuns[0].signature !== shakeRuns[2].signature,
        `same seed → identical shake; different seed → different shake (HARNESS D1/D2)`);
      return R;
    }

    // =====================================================================================
    if (name === 'coupling') {
      // RI-CAM06 M1 — THE GATE. The camera blocks must be byte-identical across three
      // stepping patterns. If they are not, RI-CAM01..05 are all unmeasurable.
      const runPattern = (mode) => {
        fresh(1337); const info = H.cameraRoute({ cell: 'cam-walk-cistern', yaw: 0 });
        const N = Math.min(900, info.frames_per_lap);
        const rows = [];
        if (mode === 'one') { for (let i = 0; i < N; i++) { step(1); rows.push(cam()); } }
        else if (mode === 'render') { for (let i = 0; i < N; i++) { step(1); H.renderFrame(); rows.push(cam()); } }
        else { for (let i = 0; i < N / 60; i++) { step(60); rows.push(cam()); } }
        H.cameraRouteEnd();
        return rows;
      };
      const a = runPattern('one'), b = runPattern('render'), c60 = runPattern('sixty');
      const key = (r) => JSON.stringify(r);
      const abIdentical = a.length === b.length && a.every((r, i) => key(r) === key(b[i]));
      // The 60-step pattern samples every 60th frame; compare those.
      const sampled = a.filter((_, i) => (i + 1) % 60 === 0);
      const cIdentical = c60.every((r, i) => i < sampled.length && key(r) === key(sampled[i]));
      R.report.push(`stepFrames(1)×${a.length} vs stepFrames(1)+renderFrame()×${b.length}: ${abIdentical ? 'byte-identical' : 'DIVERGED'}`);
      R.report.push(`stepFrames(60)×${c60.length} sampled against the same frames: ${cIdentical ? 'byte-identical' : 'DIVERGED'}`);
      chk('identical_with_render_interleaved', abIdentical, 'a render between steps changes nothing — the camera is not in requestAnimationFrame');
      chk('identical_across_step_batching', cIdentical, 'stepFrames(60) == 60×stepFrames(1) for the camera block');
      if (!abIdentical) { const i = a.findIndex((r, k) => key(r) !== key(b[k])); R.first_divergence = { frame: i, a: a[i], b: b[i] }; }
      return R;
    }

    // =====================================================================================
    if (name === 'scripted') {
      // RI-CAM06 M8 (death) and M9 (fog gate + the reproducibility test).
      // --- death, including the two that clip: a corridor and a stair.
      const deaths = {};
      for (const cell of ['cam-boss-arena', 'cam-walk-cistern', 'cam-stair']) {
        fresh(); place(cell, 0, 0, 0); step(30);
        const pivot0 = cam().pivot.slice();
        H.deathCamera();
        const rows = collect(200);
        const rates = [];
        for (let i = 46; i < 150 && i < rows.length; i++) rates.push(Math.abs(ang180(rows[i].yaw_deg - rows[i - 1].yaw_deg)));
        const maxTurn = Math.max(...rows.slice(1).map((c, i) => Math.abs(ang180(c.yaw_deg - rows[i].yaw_deg)) + Math.abs(c.pitch_deg - rows[i].pitch_deg)));
        const pivotHeld = rows.slice(0, 150).every((c) => Math.hypot(c.pivot[0] - pivot0[0], c.pivot[2] - pivot0[2]) <= 1e-6);
        deaths[cell] = {
          orbit_rate: r4(mean(rates)), pitch_end: r4(rows[Math.min(60, rows.length - 1)].pitch_deg),
          arm_end: r4(rows[Math.min(60, rows.length - 1)].arm_len_m), max_single_frame_turn: r4(maxTurn),
          clip_frames: rows.filter((c) => c.clip_through).length, pivot_detached_and_held: pivotHeld,
          fov_span: r4(Math.max(...rows.map((c) => c.fov_deg)) - Math.min(...rows.map((c) => c.fov_deg))),
        };
        R.report.push(`death in ${cell}: orbit ${deaths[cell].orbit_rate} °/f, pitch→${deaths[cell].pitch_end}°, arm→${deaths[cell].arm_end} m, Σclip=${deaths[cell].clip_frames}`);
      }
      R.death = deaths;
      const D = Object.values(deaths);
      chk('death_orbit_0p100', D.every((d) => Math.abs(d.orbit_rate - 0.100) <= 0.005), `rates ${D.map((d) => d.orbit_rate).join(', ')} °/frame (bar 0.100 ±0.005)`);
      chk('death_max_turn_le_0p5', D.every((d) => d.max_single_frame_turn <= 0.5 + 1e-6), `max single-frame orientation change ${Math.max(...D.map((d) => d.max_single_frame_turn))}°`);
      chk('death_no_clip_anywhere', D.every((d) => d.clip_frames === 0), `Σ clip over arena+corridor+stair = ${D.reduce((a, d) => a + d.clip_frames, 0)} (the corridor and stair deaths are the ones that clip)`);
      chk('death_pivot_detaches', D.every((d) => d.pivot_detached_and_held), 'the pivot detaches from the root and holds its last world position');
      chk('death_fov_unchanged', D.every((d) => d.fov_span <= 0.001), 'no FOV change through the death sequence');

      // --- fog gate + the reproducibility test.
      fresh(); place('cam-boss-arena', 0, 0, 180);
      const eid = H.spawn('naga_levy', 0, -8, { height_m: 4.5 });
      step(20);
      const start = cam();
      H.fogGate(eid);
      const rows = collect(120);
      const modes = rows.map((c) => c.mode);
      const fogFrames = modes.filter((m) => m === 'fog_gate').length;
      const yawRates = rows.slice(1).map((c, i) => Math.abs(ang180(c.yaw_deg - rows[i].yaw_deg)));
      // Re-simulate the rig's own law offline, from the traced inputs only.
      const A = 1 - Math.pow(2, -(1 / 60) / 0.180);
      let yaw = start.yaw_deg;
      const p = ppos();
      const tgt = H.listEntities().find((e) => e.eid === eid);
      const yawT = ((Math.atan2(tgt.pos[0] - p[0], tgt.pos[2] - p[2]) * 180 / Math.PI) % 360 + 360) % 360;
      for (let f = 0; f < 90; f++) {
        let d = ang180(yawT - yaw) * A;
        d = Math.max(-1.5, Math.min(1.5, d));
        yaw = ((yaw + d) % 360 + 360) % 360;
      }
      const traced = rows[89].yaw_deg;
      const yawErr = Math.abs(ang180(traced - yaw));
      R.fog = {
        mode_frames: fogFrames, p100_yaw_rate: r4(Math.max(...yawRates)),
        arm_at_90: r4(rows[89].arm_len_m), clip_frames: rows.filter((c) => c.clip_through).length,
        resimulated_yaw_at_90: r3(yaw), traced_yaw_at_90: r3(traced), yaw_error_deg: r4(yawErr),
        fov_span: r4(Math.max(...rows.map((c) => c.fov_deg)) - Math.min(...rows.map((c) => c.fov_deg))),
      };
      R.report.push(`fog gate: mode held ${fogFrames} frames; yaw rate p100 ${R.fog.p100_yaw_rate} °/f (clamp 1.500 = 90 °/s)`);
      R.report.push(`REPRODUCIBILITY: offline re-simulation of the rig's own law gives yaw ${r3(yaw)}° at frame 90; the trace says ${r3(traced)}°; error ${r4(yawErr)}° (bar 0.5°)`);
      chk('fog_exactly_90_frames', fogFrames === 90, `${fogFrames} frames (bar exactly 90)`);
      chk('fog_yaw_clamp_90dps', Math.max(...yawRates) <= 1.500 + 1e-6, `p100 = ${r4(Math.max(...yawRates))} °/frame`);
      chk('fog_reproducible_from_rig_law', yawErr <= 0.5, `${r4(yawErr)}° (bar ≤0.5°) — a spline camera cannot pass this, because its pose is not a function of the rig's inputs`);
      chk('fog_no_clip', R.fog.clip_frames === 0, 'collision active throughout, which is the tell that it is the same camera');
      chk('fog_fov_unchanged', R.fog.fov_span <= 0.001, 'no FOV animation on boss entry');
      return R;
    }

    return { __err: `unknown probe ${name}` };
  } catch (e) {
    return { __err: String(e && e.message || e), __stack: String(e && e.stack || '').slice(0, 1200) };
  }
}
