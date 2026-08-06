import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h=await launchGame({width:320,height:180});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const out={schema:'critic/w1-01-r2-b13@1',measured_at:new Date().toISOString(),note:'AR-2 B13 + B2: board every modality from a settlement, verify station arrival, gold price, in-world time, walked-it-once gate.'};
try{
 await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
 await h.h('setWorldKnowledge',{gold:5000});
 // walk the legs the services require, using walkPath along each leg's own points
 const roads=JSON.parse(fs.readFileSync('game/data/world/roads.json','utf8'));
 const legs=['stormhold-thorn','stormhold-helstrom','blackrose-lilmoth','helstrom-blackrose'];
 out.walks=[];
 for(const id of legs){
   const leg=roads.legs.find(l=>l.id===id);
   const pts=leg.points.map(p=>[p[0],p[1]]);
   const r=await ev(({pts})=>{ const H=window.__HARNESS; H.teleport(pts[0][0],pts[0][1]);
     let res=H.walkPath(pts,{speed:'jog',restart:true,chunkFrames:1}); let g=0;
     while(!res.done && g++<400) res=H.walkPath(pts,{speed:'jog',chunkFrames:30000});
     return {done:res.done,minutes:res.minutes,path_m:res.path_m}; },{pts});
   out.walks.push({leg:id,...r});
   console.log('walked',id,JSON.stringify(r));
 }
 const res=await ev(()=>{
  const H=window.__HARNESS; const net=H.getTravelNetwork(); const st=net.stations||[], sv=net.services||[];
  const state=H.getTravelState();
  const rows=[]; const byMode={};
  for(const s of sv){ const q=(()=>{try{return H.travelQuote(s.id);}catch(e){return null;}})();
    if(q&&q.purchasable&&!byMode[s.mode]) byMode[s.mode]=s; }
  for(const [mode,s] of Object.entries(byMode)){
    const row={mode,service:s.id,from:s.from,to:s.to};
    const stn=st.find(x=>x.id===s.from);
    if(stn) H.teleport(stn.x,stn.z); H.stepFrames(2);
    const g0=H.getTravelState().gold, t0=H.getPlayerStats();
    const clock0=H.getWorldStats().timeOfDay;
    try{
      const b=H.boardTravel(s.id); row.board={boarded:b.boarded,arrived:b.arrived,done:b.done,frames:b.frames,gold_spent:b.spent||b.gold_spent};
      let ride=b; let k=0; while(ride && !ride.done && k++<40) ride=H.travelRide(3000);
      row.ride={done:ride&&ride.done, arrived_at:ride&&ride.arrived_at, game_min:ride&&ride.game_min};
      const t1=H.getPlayerStats(); const g1=H.getTravelState().gold;
      row.gold=[g0,g1]; row.end_pos=[+t1.pos[0].toFixed(1),+t1.pos[2].toFixed(1)];
      const dest=st.find(x=>x.id===s.to);
      row.dest_station=dest?{id:dest.id,pos:[dest.x,dest.z],arrive_at:dest.arrive_at}:null;
      row.dist_to_dest_station_m=dest?+Math.hypot(t1.pos[0]-dest.x,t1.pos[2]-dest.z).toFixed(1):null;
      row.moved_m=+Math.hypot(t1.pos[0]-t0.pos[0],t1.pos[2]-t0.pos[2]).toFixed(1);
    }catch(e){ row.error=String(e.message||e); }
    rows.push(row);
  }
  return {state,modes_boardable:Object.keys(byMode),rows,final_state:H.getTravelState()};
 });
 out.result=res;
 console.log('legs walked:',JSON.stringify(res.state.legs_walked),'purchasable:',res.state.purchasable.length,'refused:',res.state.refused);
 for(const r of res.rows) console.log(r.mode,'|',r.service,'| gold',JSON.stringify(r.gold),'| moved',r.moved_m,'m | to station',r.dist_to_dest_station_m,'m | err',r.error||'-');
} finally{ await h.close(); }
fs.writeFileSync(OUT+'critic-b13-travel.json',JSON.stringify(out,null,1)+'\n');
