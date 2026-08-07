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
  const ax = aim[0] - c.pos[0], ay = aim[1] - c.pos[1], az = aim[2] - c.pos[2];
  const flat = Math.hypot(ax, az);
  const geom = Math.atan2(ay, flat) * RAD;
  const d = Math.hypot(t.pos[0] - p.pos[0], t.pos[2] - p.pos[2]);
  const bias = pitchBias(d, h);
  return {
    aimY: aim[1], camY: c.pos[1], pivotY: c.pivot[1],
    aim_above_camera_m: +(aim[1] - c.pos[1]).toFixed(4),
    geom: +geom.toFixed(3),
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

// ---------------------------------------------------------------------------------------
const arg = process.argv[2] || '';

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
