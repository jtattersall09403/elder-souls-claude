#!/usr/bin/env node
// Focused W1-19 production-input diagnostic for leaving a saved interior checkpoint.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
if (wantsHelp(args) || !args['resume-state'] || !args.out) usage(`
mainline-door-egress-diagnostic.mjs --resume-state <state.json> --out <report.json>
  [--chromium <executable>]
`);
const resumeState = JSON.parse(fs.readFileSync(path.resolve(String(args['resume-state'])), 'utf8'));
const outPath = path.resolve(String(args.out));
const handle = await launchGame({ ...args, width: 320, height: 240, timeout: Number(args.timeout || 180000) });
let report;
try {
  report = await handle.page.evaluate(async ({ resumeState }) => {
    const H = window.__HARNESS;
    await H.ready(); H.setRenderRate(0); H.restoreState(resumeState); H.setRenderRate(0); H.stepFrames(2);
    const snap = label => {
      const w=H.whereAmI(),p=H.getCombatState().player||{};
      return {label,where:w,player:{state:p.state,move:p.move||null,anim:p.anim,anim_frame:p.anim_frame,speed_mps:p.speed_mps},input:H.getInputState(),collision:H.solidAt(w.pos[0],w.pos[1]+.9,w.pos[2]),ui:H.getUIState()};
    };
    const trace=[snap('restored')];
    H.clearInputs();H.stepFrames(180);trace.push(snap('settled-inside'));
    const exitWalk=H.walkPath([[0,4.595]],{fromCurrent:true,speed:'walk',maxFrames:1800,stuckAbort:1800,arrive_m:.5,lookahead_m:.25,survival:false,defensive:false});
    H.clearInputs();H.stepFrames(2);trace.push(snap('at-interior-door'));
    const inside=H.whereAmI().interior, prompt=H.whereAmI().door_in_reach;
    H.queueInputs([{f:1,press:['interact']},{f:3,release:['interact']}]);H.stepFrames(8);trace.push(snap('after-interact'));
    if(H.getUIState().dialogue_surface?.open){H.queueInputs([{f:0,release:['interact']},{f:1,press:['block']},{f:3,release:['block']}]);H.stepFrames(8);}
    H.clearInputs();H.stepFrames(2);trace.push(snap('after-production-dialogue-close'));
    H.clearInputs();H.stepFrames(180);trace.push(snap('settled-outside'));
    const start=H.whereAmI().pos.slice(), rays=[];
    for(let k=0;k<24;k++){
      const a=k*Math.PI/12,target=[start[0]+Math.sin(a)*4,start[2]+Math.cos(a)*4],samples=[];
      for(let s=1;s<=8;s++){const x=start[0]+(target[0]-start[0])*s/8,z=start[2]+(target[1]-start[2])*s/8;samples.push({x,z,...H.solidAt(x,start[1]+.9,z),water:H.getWaterAt(x,z)});}
      rays.push({k,angle_deg:k*15,target,samples,clear:samples.every(s=>!s.solid&&!(Number(s.distance_m)<.42)&&Number(s.water.depth_m??s.water.depth??0)<=1.05)});
    }
    const attempts=[];
    for(const ray of rays.filter(r=>r.clear)){
      const before=H.whereAmI().pos.slice();
      const walk=H.walkPath([ray.target],{fromCurrent:true,speed:'walk',maxFrames:120,stuckAbort:120,arrive_m:.2,lookahead_m:.25,survival:false,defensive:false});
      H.clearInputs();H.stepFrames(2);const after=H.whereAmI().pos.slice();
      attempts.push({ray:ray.k,before,after,distance_m:Math.hypot(after[0]-before[0],after[2]-before[2]),walk,final:snap(`ray-${ray.k}`)});
      if(attempts.at(-1).distance_m>.2)break;
    }
    return {schema:'elder-souls/mainline-door-egress-diagnostic@1',inside,exitWalk,prompt,trace,rays,attempts,pass:!H.whereAmI().interior&&attempts.some(a=>a.distance_m>.2)};
  }, { resumeState });
} finally { await handle.close(); }
writeJson(outPath, report); console.log(JSON.stringify({out:outPath,pass:report.pass,attempts:report.attempts.map(a=>({ray:a.ray,distance_m:a.distance_m,aborted:a.walk.aborted}))},null,2));
process.exitCode=report.pass?0:1;
