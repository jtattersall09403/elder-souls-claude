#!/usr/bin/env node
// Builder instrument for ARBITRATION S49. Exercises the shipping stepCamera path and derives
// necessity/maximality independently from the emitted flags.
import { makeCamera, makePlayer } from '../../game/src/sim/state.js';
import { stepCamera, CAMERA_CONST, cameraViewBasis } from '../../game/src/sim/camera.js';
import { CollisionCell, EMPTY_CELL } from '../../game/src/sim/collision.js';

const player = makePlayer();
player.pos = [0, 0, 0]; player.yaw = 0; player.grounded = true; player.lockOn = null;
player.state = 'IDLE'; player.speedMps = 0; player.moveData = null;
const camera = makeCamera();
camera.pitch = 0; camera.yaw = 0; camera.pivot = [0, CAMERA_CONST.pivot_height_m, 0];
const sim = {
  frame: 0, hitstopUntil: -1, player, camera, cell: EMPTY_CELL,
  input: { lookX: 0, lookY: 0, moveX: 0, moveY: 0, lookXConsumed: 0, lookYConsumed: 0 },
  findEntity() { return null; },
};

function clear(cell, len) {
  const c = sim.camera;
  const yaw = c.yaw * Math.PI / 180, pitch = c.pitch * Math.PI / 180;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  const ratio = len / Math.max(c.armDesired, 1e-6);
  const p = [c.pivot[0] - f[0] * len + r[0] * c.shoulderR * ratio + u[0] * c.shoulderU * ratio,
    c.pivot[1] - f[1] * len + r[1] * c.shoulderR * ratio + u[1] * c.shoulderU * ratio,
    c.pivot[2] - f[2] * len + r[2] * c.shoulderR * ratio + u[2] * c.shoulderU * ratio];
  if (cell.contains(...p)) return false;
  const vf = [0, 0, 0], vr = [0, 0, 0], vu = [0, 0, 0];
  cameraViewBasis(c, vf, vr, vu);
  const hh = CAMERA_CONST.near_m * Math.tan(CAMERA_CONST.fov_deg * Math.PI / 360);
  const hw = hh * CAMERA_CONST.aspect;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    if (cell.contains(p[0] + vf[0] * CAMERA_CONST.near_m + vr[0] * hw * sx + vu[0] * hh * sy,
      p[1] + vf[1] * CAMERA_CONST.near_m + vr[1] * hw * sx + vu[1] * hh * sy,
      p[2] + vf[2] * CAMERA_CONST.near_m + vr[2] * hw * sx + vu[2] * hh * sy)) return false;
  }
  return true;
}

function step(cell) { sim.cell = cell; sim.frame++; stepCamera(sim); }
const checks = [];
const check = (id, pass, observed) => checks.push({ id, pass: !!pass, observed });

step(EMPTY_CELL);
check('open_world_refuses_emergency', !camera.armGuard && !camera.armFloorEmergency && camera.armLen >= 0.9,
  { arm: camera.armLen, guard: camera.armGuard, emergency: camera.armFloorEmergency });

const wall = new CollisionCell('s49-wall', [
  { k: 'box', c: [0, 1.6, -2.50], h: [3, 2, 2.00] },
], {});
step(wall);
let anyNormalClear = false;
for (let x = CAMERA_CONST.arm_min_m; x <= camera.armDesired + 1e-9; x += 0.005) anyNormalClear ||= clear(wall, x);
check('emergency_necessity', camera.armGuard && camera.armFloorEmergency && !anyNormalClear,
  { arm: camera.armLen, desired: camera.armDesired, any_normal_clear: anyNormalClear });
check('emergency_zero_clip', !camera.clipThrough && clear(wall, camera.armLen),
  { clip_through: camera.clipThrough, arm: camera.armLen });
check('emergency_maximality', clear(wall, camera.armLen) && !clear(wall, camera.armLen + 0.001),
  { chosen: camera.armLen, next_millimetre_clear: clear(wall, camera.armLen + 0.001) });

for (let i = 0; i < 30; i++) step(EMPTY_CELL);
check('late_return_to_normal_floor', !camera.armFloorEmergency && camera.armLen >= CAMERA_CONST.arm_min_m,
  { frame: sim.frame, arm: camera.armLen, emergency: camera.armFloorEmergency });

const ok = checks.every(c => c.pass);
console.log(JSON.stringify({ ok, population: checks.length, checks }, null, 2));
process.exit(ok ? 0 : 1);
