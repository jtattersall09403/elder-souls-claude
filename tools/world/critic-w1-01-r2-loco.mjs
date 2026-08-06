import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h=await launchGame({width:320,height:180});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const WALK=0.55-1e-9;
const out={schema:'critic/w1-01-r2-loco@1',measured_at:new Date().toISOString(),probes:{}};
try{
 await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');

 // L1 — is there a maximum walkable slope? climb the steepest ground we can find, uphill.
 // Sample a grid, find the steepest cells, then hold the stick straight uphill for 5 s.
 const steep = await ev(({m})=>{
   const H=window.__HARNESS; const res=[];
   // known steep sites from the terrain probe
   const sites=[[2286.3,1360.9],[2220.3,1340.2],[2260.3,1340.2],[2692.9,820.4],[1701.4,1885.6],[1642.6,1617.8]];
   for(const [x,z] of sites){
     H.teleport(x,z); H.stepFrames(2);
     const t=H.getTerrainAt(x,z);
     // uphill direction from central differences
     const e=3; const hx=(H.getTerrainAt(x+e,z).y-H.getTerrainAt(x-e,z).y), hz=(H.getTerrainAt(x,z+e).y-H.getTerrainAt(x,z-e).y);
     const L=Math.hypot(hx,hz)||1; const dx=hx/L, dz=hz/L;
     const a=H.getPlayerStats();
     const s=[]; for(let i=0;i<300;i++) s.push({f:i,move:[m*dx,m*dz]});
     H.queueInputs(s); H.stepFrames(300);
     const b=H.getPlayerStats();
     res.push({at:[x,z],slope_deg:t.slope_deg, uphill:[+dx.toFixed(2),+dz.toFixed(2)],
       horiz_m:+Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]).toFixed(2),
       climbed_m:+(b.pos[1]-a.pos[1]).toFixed(2), state:b.state, hp:[a.hp,b.hp], stam:[a.stamina,b.stamina],
       end_slope_deg:H.getTerrainAt(b.pos[0],b.pos[2]).slope_deg});
   }
   return res;
 },{m:WALK});
 out.probes.L1_uphill=steep;
 for(const r of steep) console.log('L1 slope',r.slope_deg,'deg -> horiz',r.horiz_m,'m climbed',r.climbed_m,'m state',r.state,'hp',r.hp.join('->'));

 // L2 — is there a fall? drop the player from height.
 const fall = await ev(()=>{
   const H=window.__HARNESS; const res=[];
   for(const dy of [5,20,60,150]){
     H.teleport(3915.5,2111.6); H.stepFrames(4);
     const g=H.getTerrainAt(3915.5,2111.6).y;
     let placed=false;
     try{ H.teleport(3915.5,2111.6,{y:g+dy}); placed=true; }catch(e){}
     const a=H.getPlayerStats(); H.stepFrames(180); const b=H.getPlayerStats();
     res.push({drop_m:dy, placed, y0:+a.pos[1].toFixed(2), y1:+b.pos[1].toFixed(2), ground:+g.toFixed(2),
       hp:[a.hp,b.hp], state_before:a.state, state_after:b.state});
   }
   return res;
 });
 out.probes.L2_fall=fall;
 console.log('L2 fall', JSON.stringify(fall));

 // L3 — RI-WLD10 locomotion ladder: does water cost anything now?
 const water = await ev(({m})=>{
   const H=window.__HARNESS; const res=[];
   const sites=[['dry-firm',3915.5,2111.6],['W1-silt',3444.7,3663.0],['W2-suck',3184.6,3463.9],
                ['W2-silt',3254.9,3801.9],['deep-off-road',2702.7,4810.3]];
   for(const [id,x,z] of sites){
     H.teleport(x,z); H.stepFrames(4);
     const w=H.getWaterAt(x,z); const a=H.getPlayerStats();
     const s=[]; for(let i=0;i<300;i++) s.push({f:i,move:[m,0]});
     H.queueInputs(s); H.stepFrames(300);
     const b=H.getPlayerStats();
     res.push({id,x,z,depth_m:w.depth_m,band:w.band,substrate:w.substrate,
       walk_mps:+(Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2])/5).toFixed(4),
       stamina:[a.stamina,b.stamina], hp:[a.hp,b.hp], state:b.state});
   }
   return res;
 },{m:WALK});
 out.probes.L3_water=water;
 for(const r of water) console.log('L3',r.id,'depth',r.depth_m,r.band,r.substrate,'->',r.walk_mps,'m/s stam',r.stamina.join('->'),'hp',r.hp.join('->'),'state',r.state);

 // L4 — AR-2 B13 / B2: board a service.
 const travel = await ev(()=>{
   const H=window.__HARNESS; const net=H.getTravelNetwork();
   const out={modes:Object.keys(net.modes||{}),stations:(net.stations||[]).length,services:(net.services||[]).length,boardings:[]};
   const byMode={};
   for(const s of (net.services||[])) if(!byMode[s.mode]) byMode[s.mode]=s;
   for(const [mode,s] of Object.entries(byMode)){
     let r={mode,service:s.id};
     try{ r.quote=H.travelQuote(s.id); }catch(e){ r.quote_error=String(e.message||e); }
     try{ const b=H.boardTravel(s.id); r.boarded=b; const ride=H.travelRide(600); r.ride=ride; r.after=H.getTravelState(); }
     catch(e){ r.board_error=String(e.message||e); }
     out.boardings.push(r);
   }
   return out;
 });
 out.probes.L4_travel=travel;
 console.log('L4 travel modes',travel.modes.join(','),'stations',travel.stations,'services',travel.services);
 for(const b of travel.boardings) console.log('   ',b.mode,b.service,'quote',JSON.stringify(b.quote).slice(0,160),'board',b.board_error?('ERR '+b.board_error):JSON.stringify(b.boarded).slice(0,160));
} finally { await h.close(); }
fs.writeFileSync(OUT+'critic-loco-probe.json',JSON.stringify(out,null,1)+'\n');
console.log('wrote',OUT+'critic-loco-probe.json');
