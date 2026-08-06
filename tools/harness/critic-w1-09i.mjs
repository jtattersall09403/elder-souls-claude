#!/usr/bin/env node
// critic-w1-09i.mjs — RI-CMB06 M4 REDONE. The first pass rotated the camera with
// camera({mode:'orbit'}), which is not in CAMERA_MODES and threw into a swallowed catch, so the
// camera never moved and the "camera-invariant" result was an artefact of the fixture. This
// version yaws the camera with the `look` input channel and verifies the yaw actually changed.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09/critic-lockon3.json');
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const res = await handle.page.evaluate(`(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState();
  const DIRS=[[0,1],[0.7071,0.7071],[1,0],[0.7071,-0.7071],[0,-1],[-0.7071,-0.7071],[-1,0],[-0.7071,0.7071]];
  const R={ locked:[], unlocked:[], camera_yaws_seen:[] };
  const camYaw=()=>{ try{ const c=H.camera({}); return c && (c.yaw_deg!==undefined?c.yaw_deg:(c.yaw!==undefined?c.yaw:null)); }catch(e){ return null; } };
  const run=(lock, spinFrames, di)=>{
    H.setSeed(77); H.loadState('arena_flat'); H.teleport(0,0,{yaw:0});
    H.spawn('dummy_passive',0,6,{as:'T'}); H.stepFrames(4);
    if(lock){ try{H.lockOn('T');}catch(e){} }
    // yaw the camera with the look channel: 6 deg/frame for spinFrames frames
    if(spinFrames>0){ H.queueInputs([{f:0,look:[6,0]}]); H.stepFrames(spinFrames); H.queueInputs([{f:0,look:[0,0]}]); H.stepFrames(2); }
    const camBefore=camYaw();
    const p0=cs().player.pos.slice();
    H.queueInputs([{f:0,move:DIRS[di]},{f:1,press:['roll']},{f:3,release:['roll']},{f:4,move:[0,0]}]);
    let end=null;
    for(let i=1;i<=120;i++){ H.stepFrames(1); const c=cs(); if(i>4 && !c.player.move){ end=c.player.pos.slice(); break; } }
    const p1=end||cs().player.pos.slice();
    const dx=p1[0]-p0[0], dz=p1[2]-p0[2];
    return { cam_yaw: camBefore, dir: di, locked: !!cs().lock.target,
      angle:+(((Math.atan2(dx,dz)*180/Math.PI)+360)%360).toFixed(2), dist:+Math.hypot(dx,dz).toFixed(4) };
  };
  for (const spin of [0, 7, 15, 22, 30, 37, 45, 52]) {
    for (let di=0; di<8; di++) R.locked.push(run(true, spin, di));
  }
  for (const spin of [0, 15, 30, 45]) {
    for (let di=0; di<8; di++) R.unlocked.push(run(false, spin, di));
  }
  R.camera_yaws_seen = [...new Set(R.locked.map(r=>r.cam_yaw))];
  return R; })()`);
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log('camera yaws actually observed:', JSON.stringify(res.camera_yaws_seen));
const by = {};
for (const r of res.locked) (by[r.dir] = by[r.dir] || []).push(r.angle);
for (const [d, a] of Object.entries(by))
  console.log('LOCKED dir', d, 'angles', JSON.stringify(a), 'spread', (Math.max(...a) - Math.min(...a)).toFixed(2));
const bu = {};
for (const r of res.unlocked) (bu[r.dir] = bu[r.dir] || []).push(r.angle);
for (const [d, a] of Object.entries(bu))
  console.log('UNLOCKED dir', d, 'angles', JSON.stringify(a), 'spread', (Math.max(...a) - Math.min(...a)).toFixed(2));
console.log('locked dists', JSON.stringify([...new Set(res.locked.map(r => r.dist))].slice(0, 8)));
await handle.close();
