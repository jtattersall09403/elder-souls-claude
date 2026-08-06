import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h=await launchGame({width:320,height:180});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const out={schema:'critic/w1-01-r2-travel@1',measured_at:new Date().toISOString()};
try{
 await h.h('setSeed',1337); await h.h('loadState','default');
 const r=await ev(()=>{
  const H=window.__HARNESS; const net=H.getTravelNetwork();
  const st=net.stations||[], sv=net.services||[];
  const res={modes:net.modes,counts:net.counts,stations:st.length,services:sv.length,
    station_sample:st.slice(0,3), boardings:[], state0:H.getTravelState()};
  const byMode={}; for(const s of sv) if(!byMode[s.mode]) byMode[s.mode]=s;
  for(const [mode,s] of Object.entries(byMode)){
    const row={mode,service:s.id,from:s.from,to:s.to};
    const station=st.find(x=>x.id===s.from||x.settlement===s.from||x.at===s.from);
    row.station=station?{id:station.id,pos:[station.x,station.z]}:null;
    try{
      if(station && station.x!==undefined) H.teleport(station.x, station.z);
      H.stepFrames(4);
      row.quote=H.travelQuote(s.id);
      const b=H.boardTravel(s.id); row.board=b;
      const before=H.getPlayerStats(); const t0=H.getTime?H.getTime():null;
      let ride=null; for(let k=0;k<20 && (!ride||!ride.done);k++) ride=H.travelRide(600);
      row.ride=ride;
      const after=H.getPlayerStats();
      row.moved_m=+Math.hypot(after.pos[0]-before.pos[0],after.pos[2]-before.pos[2]).toFixed(1);
      row.end_pos=[+after.pos[0].toFixed(1),+after.pos[2].toFixed(1)];
      row.state=H.getTravelState();
    }catch(e){ row.error=String(e.message||e); }
    res.boardings.push(row);
  }
  return res;
 });
 out.result=r;
 console.log('stations',r.stations,'services',r.services,'counts',JSON.stringify(r.counts));
 console.log('station sample',JSON.stringify(r.station_sample).slice(0,400));
 for(const b of r.boardings) console.log(b.mode,'|',b.service,'| station',JSON.stringify(b.station),'| fare',b.quote&&b.quote.fare_gold,'| board',b.error?('ERR '+b.error):JSON.stringify(b.board||null).slice(0,200),'| moved',b.moved_m,'| ride',JSON.stringify(b.ride||null).slice(0,200));
} finally{ await h.close(); }
fs.writeFileSync(OUT+'critic-travel-probe.json',JSON.stringify(out,null,1)+'\n');
