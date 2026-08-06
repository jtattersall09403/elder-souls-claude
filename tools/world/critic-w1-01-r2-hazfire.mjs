import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h=await launchGame({width:320,height:180});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const rows=[];
try{
 await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
 const R=JSON.parse(fs.readFileSync('/home/user/elder-souls-claude/game/data/world/regions.json','utf8')).regions;
 for(const r of R){
   const res=await ev(({x,z})=>{const H=window.__HARNESS;H.teleport(x,z);H.stepFrames(4);
     const a=H.getPlayerStats();H.stepFrames(3600);const b=H.getPlayerStats();
     return {hp:[a.hp,b.hp],stam:[a.stamina,b.stamina],state:b.state,
       keys:Object.keys(b), water:H.getWaterAt(x,z).band, region:H.getRegionAt(x,z).id};},{x:r.centroid_m[0],z:r.centroid_m[1]});
   rows.push({region:r.id,declared_hazard:r.hazard&&r.hazard.id,class:r.hazard&&r.hazard.class,...res});
   console.log(r.id.padEnd(18),'hazard',String(r.hazard&&r.hazard.id).padEnd(18),'60 s stand: hp',res.hp.join('->'),'stam',res.stam.join('->'),'band',res.water);
 }
} finally { await h.close(); }
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01-r2/critic-hazard-fire.json',
 JSON.stringify({schema:'critic/hazard-fire@1',method:'RI-WLD11 M58/M59 negative evidence: 60 s (3600 frames) standing at each region centroid, no input, tide LOW, noon.',rows},null,1)+'\n');
