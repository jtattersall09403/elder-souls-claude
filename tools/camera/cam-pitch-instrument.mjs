// W1-06 round 2 — INSTRUMENT THE PITCH PIN.
//
// Round 1 left the pitch pinned at exactly −50.000 (pitch_min_locked_deg) in a mid-fight lock
// and was explicit that it had NOT attributed it: pitchBias(6, 4.5) = −9.2 tilts UP and the aim
// point sits ABOVE the pivot, so neither explains a downward pin. Its instruction was to
// instrument aimPoint() and the pitch spring TARGET directly before changing anything.
//
// This runs the REAL game/src/sim/camera.js — the same module the browser loads — against a
// synthetic sim, so the pitch law can be read frame by frame for free. camera.js imports only
// core/rng.js and sim/collision.js, both pure. Every behavioural conclusion is confirmed in the
// browser afterwards (AGENT-PROTOCOL: never publish a number only seen outside the browser);
// what THIS tool establishes is the arithmetic, which is identical in both.
//
// Usage:
//   node tools/camera/cam-pitch-instrument.mjs             # the pin, decomposed
//   node tools/camera/cam-pitch-instrument.mjs --basis     # the handedness check alone
//   node tools/camera/cam-pitch-instrument.mjs --moving    # target orbits, player strafes

import { makeCamera, makePlayer } from '../../game/src/sim/state.js';
import {
  stepCamera, CAMERA_CONST, pitchBias, projectNDC, cameraBasis, cameraViewBasis,
} from '../../game/src/sim/camera.js';

const RAD = 180 / Math.PI;

// ---------------------------------------------------------------------------------------
// A synthetic sim with exactly the surface stepCamera() touches.
// ---------------------------------------------------------------------------------------
function makeSim({ targetH = 4.5, d = 6.0, groundY = 0 } = {}) {
  const player = makePlayer();
  player.pos = [0, groundY, 0];
  player.yaw = 0;
  player.grounded = true;
  player.lockOn = 't1';
  player.state = 'IDLE';
  player.speedMps = 0;
  player.moveData = null;

  const target = { eid: 't1', archetype_id: 'cam_boss_mid', pos: [0, groundY, d], height_m: targetH };

  const cam = makeCamera();
  cam.pivot = [0, groundY + CAMERA_CONST.pivot_height_m, 0];
  cam.pos = [0, groundY + CAMERA_CONST.pivot_height_m, -4.1];

  return {
    frame: 0,
    hitstopUntil: -1,
    cell: null,
    camera: cam,
    player,
    input: { lookX: 0, lookY: 0, moveX: 0, moveY: 0, lookXConsumed: 0, lookYConsumed: 0 },
    cameraTargets: { cam_boss_mid: targetH, _default: 1.9 },
    _target: target,
    findEntity(eid) { return eid === 't1' ? target : null; },
  };
}

// ---------------------------------------------------------------------------------------
// The decomposition. lockOrientation() is not exported, so the three terms of the pitch
// target are recomputed here from the SAME inputs the module uses, and cross-checked against
// the pitch the module actually produced.
// ---------------------------------------------------------------------------------------
function decompose(sim) {
  const c = sim.camera, p = sim.player, t = sim._target;
  const h = c.lockHeight;
  const k = Math.max(0, Math.min(CAMERA_CONST.aim_k_max,
    (h - CAMERA_CONST.size_bias_ref_h_m) / CAMERA_CONST.aim_k_div_m));
  const wy = CAMERA_CONST.aim_base_w + k * CAMERA_CONST.aim_k_span;
  const pcy = p.pos[1] + CAMERA_CONST.chest_height_m;
  const tcy = t.pos[1] + h * 0.72;
  const thy = t.pos[1] + h * 0.94;
  const aim = [
    p.pos[0] + (t.pos[0] - p.pos[0]) * CAMERA_CONST.aim_base_w,
    pcy + ((k > 0 ? thy : tcy) - pcy) * wy + 0.25,
    p.pos[2] + (t.pos[2] - p.pos[2]) * CAMERA_CONST.aim_base_w,
  ];
  // Mirrors lockOrientation()'s pitch reference exactly: elevation of A above the PIVOT over a
  // baseline of boom + pivot-to-A run. Pitch-independent, so this is a decomposition and not a
  // second guess. `geom_from_camera` is the old, looped quantity, kept so the two are readable
  // side by side — it is the one whose gain is ≈ +2.5.
  const aimRun = Math.hypot(aim[0] - c.pivot[0], aim[2] - c.pivot[2]);
  const geom = Math.atan2(aim[1] - c.pivot[1], c.armLen + aimRun) * RAD;
  const ay = aim[1] - c.pos[1];
  const geomCam = Math.atan2(ay, Math.hypot(aim[0] - c.pos[0], aim[2] - c.pos[2])) * RAD;
  const d = Math.hypot(t.pos[0] - p.pos[0], t.pos[2] - p.pos[2]);
  const bias = pitchBias(d, h);
  return {
    aimY: aim[1], camY: c.pos[1], pivotY: c.pivot[1],
    aim_above_camera_m: +(aim[1] - c.pos[1]).toFixed(4),
    geom: +geom.toFixed(3),
    geom_from_camera: +geomCam.toFixed(3),
    armLen: +c.armLen.toFixed(3),
    bias: +bias.toFixed(3),
    contain: +c.containPitch.toFixed(3),
    pitchTarget: +(geom + bias + c.containPitch).toFixed(3),
    pitch: +c.pitch.toFixed(3),
  };
}

// The sim-side NDC of the target chest, and the TRUE screen-space y computed from an
// independently constructed, unambiguously right-handed view basis.
function trueNdcY(sim) {
  const c = sim.camera, t = sim._target;
  const h = c.lockHeight;
  const w = [t.pos[0], t.pos[1] + h * 0.72, t.pos[2]];
  const yaw = (c.yaw + c.shakeYaw) / RAD, pitch = (c.pitch + c.shakePitch) / RAD;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const fwd = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  // up = fwd × right — the handedness that makes +y point at the sky.
  const up = [
    fwd[1] * right[2] - fwd[2] * right[1],
    fwd[2] * right[0] - fwd[0] * right[2],
    fwd[0] * right[1] - fwd[1] * right[0],
  ];
  const dx = w[0] - c.pos[0], dy = w[1] - c.pos[1], dz = w[2] - c.pos[2];
  const z = dx * fwd[0] + dy * fwd[1] + dz * fwd[2];
  if (z <= CAMERA_CONST.near_m) return null;
  const yu = dx * up[0] + dy * up[1] + dz * up[2];
  return yu / (z * Math.tan(CAMERA_CONST.fov_deg / RAD / 2));
}

// ---------------------------------------------------------------------------------------
function basisCheck() {
  const out = [];
  for (const pitch of [0, -8, -25, -50, 20, 38]) {
    for (const yaw of [0, 90, 217]) {
      const f = [0, 0, 0], r = [0, 0, 0], u = [0, 0, 0];
      cameraBasis({ yaw, pitch }, f, r, u);
      out.push({ yaw, pitch, up_y: +u[1].toFixed(6), points_at_sky: u[1] > 0 });
    }
  }
  return out;
}

function run(mode) {
  const sim = makeSim();
  const trace = [];
  const FRAMES = mode === 'moving' ? 300 : 240;
  for (let f = 0; f < FRAMES; f++) {
    sim.frame = f;
    if (mode === 'moving') {
      // AGENT-PROTOCOL: a still target hides every steering defect. Target orbits the player
      // at 60 °/s; the player strafes. Both move every frame.
      const th = (f * 1.0) / RAD;
      sim._target.pos[0] = Math.sin(th) * 6.0;
      sim._target.pos[2] = Math.cos(th) * 6.0;
      sim.player.pos[0] = Math.sin(f * 0.02) * 1.5;
      sim.player.speedMps = 2.0;
    }
    stepCamera(sim);
    if (f % 20 === 0 || f === FRAMES - 1) {
      const dc = decompose(sim);
      dc.f = f;
      dc.ndcY_sim = +sim.camera.onscreen.tNdc[1].toFixed(4);
      const tn = trueNdcY(sim);
      dc.ndcY_true = tn === null ? null : +tn.toFixed(4);
      dc.tBandY = +sim.camera.onscreen.tBandY.toFixed(4);
      dc.onscreen_t = sim.camera.onscreen.t;
      dc.onscreen_p = sim.camera.onscreen.p;
      trace.push(dc);
    }
  }
  return { sim, trace };
}

// RI-CAM03 §E M2's own bar: settle a lock at each (h, d) and report the pitch. M2 fails the
// piece if the settled pitch is monotone in NEITHER d NOR h ("a flat pitch means the law is
// not being applied") and fails it if the locked band [−50, +32] is exceeded. A pin AT a clamp
// is the degenerate case of both.
function settle(h, d) {
  const sim = makeSim({ targetH: h, d });
  sim.cameraTargets = { cam_boss_mid: h, _default: h };
  sim._target.archetype_id = 'cam_boss_mid';
  for (let f = 0; f < 400; f++) { sim.frame = f; stepCamera(sim); }
  const dc = decompose(sim);
  return { pitch: +sim.camera.pitch.toFixed(3), camY: +sim.camera.pos[1].toFixed(3),
    unclamped: dc.pitchTarget,
    tBandY: +sim.camera.onscreen.tBandY.toFixed(3), tOn: sim.camera.onscreen.t,
    pOn: sim.camera.onscreen.p, bias: +pitchBias(d, h).toFixed(2) };
}

function table() {
  // The seven worked rows of RI-CAM03 §D, plus a d-sweep and an h-sweep for the monotonicity bar.
  const rows = [
    ['marsh rat', 0.6, 2.0], ['naga levy', 1.9, 3.5], ['naga levy far', 1.9, 8.0],
    ['elite', 2.6, 4.0], ['mid boss', 4.5, 6.0], ['great boss', 8.0, 10.0],
    ['great boss hugged', 8.0, 2.5],
  ];
  console.log('name\th\td\tbias\tsettled_pitch\tunclamped_target\tcamY\ttBandY\ttOn\tpOn\tat_clamp');
  let diverged = 0;
  for (const [n, h, d] of rows) {
    const r = settle(h, d);
    const atClamp = r.pitch <= CAMERA_CONST.pitch_min_locked_deg + 0.001
      || r.pitch >= CAMERA_CONST.pitch_max_locked_deg - 0.001;
    // A clamp REACHED BY THE LAW and a clamp reached by a runaway look identical in the settled
    // pitch and are completely different defects. The unclamped target separates them: the law
    // overshooting its own declared band by a few degrees is RI-CAM03 §D's documented
    // degradation; a target tens of degrees past the band is the feedback loop.
    if (atClamp && Math.abs(r.pitch - r.unclamped) > 20) diverged++;
    console.log(`${n}\t${h}\t${d}\t${r.bias}\t${r.pitch}\t${r.unclamped}\t${r.camY}\t${r.tBandY}\t${r.tOn}\t${r.pOn}\t${atClamp}`);
  }
  const dSweep = [2, 3, 4, 5, 6, 8, 10, 12, 14].map((d) => settle(1.9, d).pitch);
  const hSweep = [0.6, 1.2, 1.9, 2.6, 3.5, 4.5, 6.0, 8.0].map((h) => settle(h, 6.0).pitch);
  const mono = (a) => a.every((v, i) => i === 0 || v >= a[i - 1] - 1e-6)
    || a.every((v, i) => i === 0 || v <= a[i - 1] + 1e-6);
  console.log(`\npitch vs d (h=1.9): ${dSweep.join(', ')}\n  monotone: ${mono(dSweep)}`);
  console.log(`pitch vs h (d=6.0): ${hSweep.join(', ')}\n  monotone: ${mono(hSweep)}`);
  const pinned = [...dSweep, ...hSweep].filter(
    (v) => v <= CAMERA_CONST.pitch_min_locked_deg + 0.001 || v >= CAMERA_CONST.pitch_max_locked_deg - 0.001);
  console.log(`samples pinned at a locked clamp: ${pinned.length} of ${dSweep.length + hSweep.length}`);
  console.log(`rows pinned by DIVERGENCE (target >20° past the band): ${diverged} of ${rows.length}`);
  return { dSweep, hSweep, monoD: mono(dSweep), monoH: mono(hSweep), pinned: pinned.length, diverged };
}

// THE DEFECT MEASURED DIRECTLY, WITH NO EDIT TO THE MODULE.
//
// The pitch spring is `pitch := pitch + (pitchT − pitch)·α`. If the pitch target is itself a
// function of the pitch with gain G = d(pitchT)/d(pitch), then
//     d(pitch_next)/d(pitch) = 1 + (G − 1)·α
// so G falls out of a finite difference on ONE real step of the real module. G < 1 is a
// contraction and settles; G > 1 diverges to whichever clamp the initial error points at, and
// which clamp that is is decided by rounding, not by the world.
//
// This is the falsifier for fix B and it needs no hand-patching: revert the pitch reference and
// this number goes above 1 on its own.
function loopGain(h, d) {
  const alpha = 1 - Math.pow(2, -(1 / 60) / CAMERA_CONST.lock_pitch_half_life_s);
  const base = makeSim({ targetH: h, d });
  base.cameraTargets = { cam_boss_mid: h, _default: h };
  for (let f = 0; f < 300; f++) { base.frame = f; stepCamera(base); }
  const snap = JSON.parse(JSON.stringify({ c: base.camera, p: base.player.pos }));

  const probe = (p0) => {
    const s = makeSim({ targetH: h, d });
    s.cameraTargets = { cam_boss_mid: h, _default: h };
    Object.assign(s.camera, JSON.parse(JSON.stringify(snap.c)));
    s.camera.pitch = p0;
    // Re-pose at this pitch so c.pos is the position this pitch actually implies — otherwise the
    // difference measures a stale pose rather than the loop.
    s.frame = 300; stepCamera(s);
    const after1 = s.camera.pitch;
    s.frame = 301; stepCamera(s);
    return { after1, after2: s.camera.pitch };
  };
  const eps = 0.5;
  const p0 = snap.c.pitch;
  const a = probe(p0 - eps), b = probe(p0 + eps);
  const dNext = (b.after2 - a.after2) / (2 * eps);
  const G = 1 + (dNext - 1) / alpha;
  return { h, d, settled: +p0.toFixed(3), alpha: +alpha.toFixed(5),
    d_next_d_pitch: +dNext.toFixed(4), gain: +G.toFixed(3), divergent: G > 1 };
}

// ---------------------------------------------------------------------------------------
const arg = process.argv[2] || '';

if (arg === '--gain') {
  const rows = [[0.6, 2.0], [1.9, 3.5], [1.9, 8.0], [2.6, 4.0], [4.5, 6.0], [8.0, 10.0]]
    .map(([h, d]) => loopGain(h, d));
  console.log('h\td\tsettled\td(pitch_next)/d(pitch)\tloop_gain_G\tdivergent');
  for (const r of rows) console.log(`${r.h}\t${r.d}\t${r.settled}\t${r.d_next_d_pitch}\t${r.gain}\t${r.divergent}`);
  const bad = rows.filter((r) => r.divergent).length;
  console.log(`\ndivergent (G > 1): ${bad} of ${rows.length}`);
  process.exit(bad ? 1 : 0);
}

if (arg === '--table') {
  const r = table();
  process.exit(r.diverged === 0 && (r.monoD || r.monoH) ? 0 : 1);
}

if (arg === '--basis') {
  const b = basisCheck();
  console.log(JSON.stringify(b, null, 2));
  const bad = b.filter((r) => !r.points_at_sky).length;
  console.log(`\nup vectors pointing at the ground: ${bad} of ${b.length}`);
  process.exit(bad ? 1 : 0);
}

const mode = arg === '--moving' ? 'moving' : 'still';
const { sim, trace } = run(mode);

console.log(`# cam-pitch-instrument (${mode} target)`);
console.log('# cam_boss_mid h=4.5 at d=6.0, lock held for the whole run\n');
const cols = ['f', 'pivotY', 'camY', 'aimY', 'aim_above_camera_m', 'geom', 'bias', 'contain',
  'pitchTarget', 'pitch', 'ndcY_sim', 'ndcY_true', 'tBandY', 'onscreen_t', 'onscreen_p'];
console.log(cols.join('\t'));
for (const r of trace) {
  console.log(cols.map((k) => (typeof r[k] === 'number' ? (+r[k]).toFixed(3) : String(r[k]))).join('\t'));
}

const last = trace[trace.length - 1];
console.log('\n---- verdict ----');
console.log(`settled pitch          ${last.pitch}   (floor is ${CAMERA_CONST.pitch_min_locked_deg})`);
console.log(`  geometric term       ${last.geom}`);
console.log(`  pitchBias(d,h)       ${last.bias}`);
console.log(`  containPitch         ${last.contain}   (soft cap ±${CAMERA_CONST.contain_pitch_soft_deg}, hard ±${CAMERA_CONST.contain_pitch_max_deg})`);
console.log(`sim NDC y of target    ${last.ndcY_sim}`);
console.log(`TRUE NDC y of target   ${last.ndcY_true}`);
console.log(`sign agreement         ${last.ndcY_true === null ? 'n/a' : (Math.sign(last.ndcY_sim) === Math.sign(last.ndcY_true) ? 'AGREE' : 'INVERTED')}`);
const b = basisCheck();
console.log(`up.y points at ground  ${b.filter((r) => !r.points_at_sky).length} of ${b.length} poses`);
