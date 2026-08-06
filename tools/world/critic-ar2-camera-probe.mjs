import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({ width: 960, height: 540 });
const D='/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01/';
const out={schema:'critic/w1-01-ar2@1',measured_at:new Date().toISOString(),probes:{}};
const WALK=0.55-1e-9;
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
  // CAM02 M7 done properly: rotate the SIM camera with look input, not the debug override.
  const r=await h.page.evaluate(({m})=>{const H=window.__HARNESS;const res=[];
    for(const target of [0,45,90,135,180,225,270,315]){
      H.teleport(2210,1100);
      // rotate the gameplay camera with look input until yaw is near target
      let guard=0; let cy=H.getCameraRig?H.getCameraRig():null;
      const readYaw=()=>{const g=H.getCameraRig?H.getCameraRig():null;
        return g&&(g.yaw_deg!==undefined?g.yaw_deg:(g.yaw!==undefined?g.yaw:null));};
      let y=readYaw();
      while(y!==null && guard++<400){
        let d=target-y; while(d>180)d-=360; while(d<-180)d+=360;
        if(Math.abs(d)<0.6) break;
        const step=Math.max(-3,Math.min(3,d));
        H.queueInputs([{f:0,look:[step,0]}]); H.stepFrames(1); y=readYaw();
      }
      const a=H.getPlayerStats();
      const s=[];for(let i=0;i<120;i++)s.push({f:i,move:[0,m]});
      H.queueInputs(s);H.stepFrames(120);
      const b=H.getPlayerStats();
      const bearing=(Math.atan2(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2])*180/Math.PI+360)%360;
      res.push({requested_cam_yaw:target,actual_cam_yaw:y,travel_bearing_deg:+bearing.toFixed(2),
        player_yaw:+b.yaw_deg.toFixed(2),dist_m:+Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]).toFixed(2)});
    } return res;},{m:WALK});
  out.probes.camera_relative_mapping_via_look=r;
  console.log('CAM-REL(look):'); for(const q of r) console.log('   cam',q.requested_cam_yaw,'actual',q.actual_cam_yaw,'-> travel',q.travel_bearing_deg,'player_yaw',q.player_yaw,'d',q.dist_m);
  // CAM02 M5: camera must not auto-follow during ordinary walking
  const af=await h.page.evaluate(({m})=>{const H=window.__HARNESS;H.teleport(2210,1100);
    const g0=H.getCameraRig?H.getCameraRig():null;
    for(let c=0;c<24;c++){const s=[];for(let i=0;i<30;i++){const a=(c*30+i)*Math.PI/180;s.push({f:i,move:[Math.sin(a)*m,Math.cos(a)*m]});}H.queueInputs(s);H.stepFrames(30);}
    const g1=H.getCameraRig?H.getCameraRig():null;
    return {start:g0,end:g1};},{m:WALK});
  const gy=(g)=>g&&(g.yaw_deg!==undefined?g.yaw_deg:g.yaw);
  out.probes.no_auto_follow={start_yaw:gy(af.start),end_yaw:gy(af.end),delta_deg:(gy(af.start)!==undefined&&gy(af.end)!==undefined)?+(gy(af.end)-gy(af.start)).toFixed(4):null};
  console.log('AUTO-FOLLOW delta over a 720-frame circle:',JSON.stringify(out.probes.no_auto_follow));
  // AR-2 B1: HUD pixels while exploring
  await h.h('setUIVisible',true); await h.h('setTimeOfDay',12);
  await h.page.evaluate(()=>{window.__HARNESS.teleport(2766.5,5011);});
  await h.h('renderFrame');
  try{ fs.writeFileSync(D+'ar2-b1-hud-exploring.png', await h.page.screenshot({type:'png',timeout:120000})); console.log('HUD shot written'); }catch(e){ console.log('HUD shot failed',e.message); }
  try{ out.probes.ui_state = await h.h('getUIState'); }catch(e){ out.probes.ui_state={error:e.message}; }
  console.log('UI', JSON.stringify(out.probes.ui_state).slice(0,700));
  const verbs=await h.page.evaluate(()=>Object.keys(window.__HARNESS).sort());
  out.probes.travel_verbs=verbs.filter(v=>/travel|board|strider|boat|barge|fare|station|warp|recall|intervent/i.test(v));
  out.probes.harness_verb_count=verbs.length;
  console.log('TRAVEL VERBS',JSON.stringify(out.probes.travel_verbs));
} catch(e){console.error('ERR',e.stack); out.error=String(e.stack);} finally{ await h.close(); }
fs.writeFileSync(D+'critic-ar2-camera.json',JSON.stringify(out,null,2)+'\n');
console.log('written');
