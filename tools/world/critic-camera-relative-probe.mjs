import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({ width: 320, height: 180 });
const WALK=0.55-1e-9;
try{
  await h.h('setSeed',1337); await h.h('loadState','default');
  const rig=await h.h('getCameraRig'); console.log('RIG', JSON.stringify(rig).slice(0,400));
  const r=await h.page.evaluate(({m})=>{const H=window.__HARNESS;const res=[];
    const yawOf=()=>{const g=H.getCameraRig(); return g.yaw_deg!==undefined?g.yaw_deg:(g.yaw!==undefined?g.yaw:(g.camera&&g.camera.yaw_deg));};
    for(const nlook of [0,15,30,45,60,90]){
      H.teleport(2210,1100);
      if(nlook>0){const s=[];for(let i=0;i<nlook;i++)s.push({f:i,look:[2,0]});H.queueInputs(s);H.stepFrames(nlook);}
      const cy=yawOf();
      const a=H.getPlayerStats();
      const s2=[];for(let i=0;i<120;i++)s2.push({f:i,move:[0,m]});H.queueInputs(s2);H.stepFrames(120);
      const b=H.getPlayerStats();
      const bearing=(Math.atan2(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2])*180/Math.PI+360)%360;
      res.push({look_frames:nlook,camera_yaw:cy,travel_bearing:+bearing.toFixed(2),player_yaw:+b.yaw_deg.toFixed(2),dist:+Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]).toFixed(2)});
    } return res;},{m:WALK});
  console.log(JSON.stringify(r,null,1));
  fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01/critic-camera-relative.json',JSON.stringify({rig,runs:r},null,2)+'\n');
} finally{ await h.close(); }
