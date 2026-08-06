import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h=await launchGame({width:320,height:180});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const WALK=0.55-1e-9;
const out={schema:'critic/w1-01-r2-misc@1',measured_at:new Date().toISOString(),probes:{}};
try{
 await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
 // H1 — do the 19 declared hazards fire? stand in each hazard's own region for 30 s.
 const haz=JSON.parse(fs.readFileSync('game/data/world/hazards.json','utf8'));
 out.hazards_declared=(haz.hazards||haz).length!==undefined?(haz.hazards||haz).length:null;
 const list=(haz.hazards||[]).slice(0,20);
 out.probes.H1=[];
 for(const z of list.slice(0,8)){
   const x=z.x!==undefined?z.x:(z.pos&&z.pos[0]), zz=z.z!==undefined?z.z:(z.pos&&z.pos[1]);
   if(x===undefined) continue;
   const r=await ev(({x,z})=>{const H=window.__HARNESS;H.teleport(x,z);const a=H.getPlayerStats();H.stepFrames(1800);const b=H.getPlayerStats();
     return {hp:[a.hp,b.hp],stam:[a.stamina,b.stamina],state:b.state,effects:b.effects||b.status||null};},{x,z:zz});
   out.probes.H1.push({id:z.id,kind:z.kind||z.class,at:[x,zz],...r});
   console.log('H1',z.id,JSON.stringify(r.hp),'stam',JSON.stringify(r.stam));
 }
 // H2 — burden outside the fight (RI-PRG07)
 out.probes.H2=[];
 for(const pct of [10,45,69,85,95,101,120]){
   const r=await ev(({pct,m})=>{const H=window.__HARNESS;H.teleport(3915.5,2111.6);
     let set=null; try{ set=H.setBurden(pct/100); }catch(e){ try{ set=H.setBurden({pct}); }catch(e2){ set={error:String(e2.message||e2)}; } }
     const a=H.getPlayerStats(); const s=[];for(let i=0;i<300;i++)s.push({f:i,move:[m,0]});
     H.queueInputs(s);H.stepFrames(300);const b=H.getPlayerStats();
     return {set,mps:+(Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2])/5).toFixed(4),burden:H.getBurden?H.getBurden():null};},{pct,m:WALK});
   out.probes.H2.push({pct,...r});
   console.log('H2 burden',pct+'%','->',r.mps,'m/s', JSON.stringify(r.burden).slice(0,120));
 }
 // H3 — breath clock: 60 s in W5 water
 const br=await ev(({m})=>{const H=window.__HARNESS;H.teleport(2702.7,4810.3);H.stepFrames(4);
   const w=H.getWaterAt(2702.7,4810.3);const a=H.getPlayerStats();
   H.stepFrames(3600);const b=H.getPlayerStats();
   return {water:w,hp:[a.hp,b.hp],stam:[a.stamina,b.stamina],state:b.state,pos:b.pos};},{m:WALK});
 out.probes.H3_breath=br;
 console.log('H3 breath 60 s in',br.water.depth_m,'m',br.water.band,'hp',JSON.stringify(br.hp),'stam',JSON.stringify(br.stam),'state',br.state);
 // H4 — AR-2 B1: HUD frame while exploring
 await ev(()=>{const H=window.__HARNESS;H.camera({mode:'gameplay'});H.teleport(2766.5,5011);H.setTimeOfDay(12);H.setUIVisible(true);H.stepFrames(20);});
 const url=await h.h('screenshot'); fs.writeFileSync(OUT+'ar2-b1-hud-exploring.png',Buffer.from(String(url).split(',')[1],'base64'));
 console.log('H4 hud frame written');
} finally{ await h.close(); }
fs.writeFileSync(OUT+'critic-misc-probe.json',JSON.stringify(out,null,1)+'\n');
