import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({ width: 1280, height: 720 });
const D='/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01/';
const meta=[];
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
  await h.h('setTimeOfDay',12);
  await h.h('setUIVisible', false);
  const sites=[
    ['drowned-road-stormhold-helstrom',2182.52,2214.63,90],
    ['drowned-road-stormhold-helstrom-b',2182.52,2214.63,0],
    ['drowned-road-helstrom-gideon',1657.99,2758.75,90],
    ['tideway-lilmoth-archon-LOW',3207.0,4367.4,90],
  ];
  for(const [id,x,z,yaw] of sites){
    const info = await h.page.evaluate(({x,z,yaw})=>{
      const H=window.__HARNESS; H.teleport(x,z);
      const w=H.getWaterAt(x,z); const t=H.getTerrainAt(x,z);
      const s=[];for(let i=0;i<120;i++)s.push({f:i,move:[0,0],look:[0,0]});
      H.queueInputs(s);H.stepFrames(120);
      const p=H.getPlayerStats();
      return {water:w,terrain:t,player:{pos:p.pos,state:p.state,hp:p.hp,stamina:p.stamina}};
    },{x,z,yaw});
    await h.h('camera',{yaw_deg:yaw,pitch_deg:-5,dist_m:4.0});
    await h.h('renderFrame');
    const buf = await h.page.screenshot({type:'png'});
    fs.writeFileSync(D+'shot-'+id+'.png', buf);
    meta.push({id,x,z,camera_pose:{yaw_deg:yaw,pitch_deg:-5,dist_m:4.0,eye:'3rd-person orbital'},time_of_day_h:12,tide:'LOW',...info});
    console.log(id, JSON.stringify(info.water), 'player y',info.player.pos[1],'state',info.player.state,'hp',info.player.hp);
  }
} catch(e){console.error('ERR',e.stack);} finally{ await h.close(); }
fs.writeFileSync(D+'critic-shots.json',JSON.stringify(meta,null,2)+'\n');
console.log('done');
