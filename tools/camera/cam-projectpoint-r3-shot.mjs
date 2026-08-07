#!/usr/bin/env node
// cam-projectpoint-r3-shot.mjs — W1-06 round 3, browser confirmation.
//
// The fix (game/src/engine.js `camera()`, game/src/sim/camera.js `applyOverride`, exported) is
// already confirmed bit-for-bit in bare Node against the unmodified production module
// (tools/camera/cam-projectpoint-fix.mjs). This script re-confirms it through the REAL browser
// build, via the capture daemon's shared engine (tools/capture/ — no new browser launched;
// RULES.md 20/21), using engine.camera() and engine.projectPoint() exactly as W1-13-r3's
// bloom-sight probe called them: pose, then query, no step in between.
//
// It also produces the one docs/shots/ image this round owes (RULES.md 27): the corrected
// camera's own view of the point it now correctly reports on_screen.
import fs from 'node:fs';
import path from 'node:path';
import { CaptureSession } from '../capture/client.mjs';
import { REPO_ROOT } from '../lib/cli.mjs';

const DATE = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join(REPO_ROOT, 'docs', 'shots');
const OUT_PNG = path.join(OUT_DIR, `${DATE}-w1-06-r3-projectpoint-sees-a-posed-camera.png`);

async function main() {
  const s = new CaptureSession();
  const results = [];
  let fail = false;

  // A landmark: place at a flat spot in the province, pose the camera 12 m out at four
  // bearings around a fixed target point, shoot, and query projectPoint for that exact target
  // right after — same sequence as w1-13-r3-bloom-sight.mjs: camera() then a read, no step.
  const PLACE = { x: 2400, z: 2400 };
  const TARGET_Y = 1.6;
  let shotSpec = null;

  for (const bearing of [0, 90, 180, 270]) {
    const rad = (bearing * Math.PI) / 180;
    const R = 12;
    const target = [PLACE.x, TARGET_Y, PLACE.z];
    const eye = [PLACE.x + Math.sin(rad) * R, TARGET_Y + 1.6, PLACE.z + Math.cos(rad) * R];
    const look = target;

    const spec = {
      place: { x: eye[0], z: eye[2] }, // land the streamer near the eye so the world is built
      camera: { pos: eye, look },
      time: 12, weather: 'clear', width: 960, height: 540,
      evidence_of: 'appearance', claim: 'W1-06 round 3 projectPoint fix — bearing ' + bearing,
      no_cache: true,
    };
    const shot = await s.capture(spec);
    if (bearing === 0) shotSpec = shot;

    // Read projectPoint right after the capture, same engine, same pose, no step — exactly the
    // shape that produced 0/96 on_screen:true before this round's fix.
    const q = await s.query([['projectPoint', target[0], target[1], target[2]]]);
    const r = q.results[0];
    results.push({ bearing_deg: bearing, eye, look, target, query_ok: r.ok, projectPoint: r.value || r.error });
    if (!r.ok || !r.value || r.value.on_screen !== true) {
      fail = true;
      console.error(`FAIL: bearing ${bearing} deg — camera posed straight at its target, projectPoint did not report on_screen:true. ${JSON.stringify(r)}`);
    }
  }

  // Falsifier (RULES 4): pose the SAME camera and ask about a point 90 degrees off its aim,
  // far outside the frustum. Must go red.
  {
    const eye = [PLACE.x, TARGET_Y + 1.6, PLACE.z - 12];
    const look = [PLACE.x, TARGET_Y, PLACE.z];
    await s.capture({ place: { x: eye[0], z: eye[2] }, camera: { pos: eye, look }, time: 12, weather: 'clear', width: 960, height: 540, evidence_of: 'appearance', claim: 'W1-06 r3 falsifier', no_cache: true });
    const sideTarget = [PLACE.x + 40, TARGET_Y, PLACE.z - 12];
    const q = await s.query([['projectPoint', sideTarget[0], sideTarget[1], sideTarget[2]]]);
    const r = q.results[0];
    results.push({ falsifier: '90 deg off-aim, 40 m to the side', query_ok: r.ok, projectPoint: r.value || r.error });
    if (!r.ok || !r.value || r.value.on_screen !== false) {
      fail = true;
      console.error(`FAIL: falsifier did not go red — projectPoint claims an off-frustum point is on-screen. ${JSON.stringify(r)}`);
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (shotSpec && shotSpec.path) {
    fs.copyFileSync(shotSpec.path, OUT_PNG);
  }

  const report = { results, image: shotSpec ? { source: shotSpec.path, saved: OUT_PNG, sha256: shotSpec.sha256 } : null };
  fs.mkdirSync(path.join(REPO_ROOT, 'reports', 'w1-06'), { recursive: true });
  fs.writeFileSync(path.join(REPO_ROOT, 'reports', 'w1-06', 'cam-projectpoint-r3-shot.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(fail ? '\nRESULT: FAIL' : '\nRESULT: PASS');
  s.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
