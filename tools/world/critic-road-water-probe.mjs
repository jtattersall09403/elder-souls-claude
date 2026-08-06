import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({ width: 320, height: 180 });
const out={schema:'critic/road-water@1',note:'getWaterAt sampled along every built road point, at the same tide state crossing.mjs uses (LOW), and again at HIGH.',tides:{}};
try{
  await h.h('setSeed',1337); await h.h('loadState','default');
  for(const tide of ['LOW','HIGH']){
    await h.h('setTide',tide);
    const r = await h.page.evaluate(()=>{
      const H=window.__HARNESS; const R=H.getRoutes();
      const legs=R.legs|| (R.roads&&R.roads.legs) || null;
      return {keys:Object.keys(R)};
    });
    const legs = JSON.parse(fs.readFileSync('/home/user/elder-souls-claude/game/data/world/roads.json','utf8')).legs;
    const res=[];
    for(const leg of legs){
      const prof = await h.page.evaluate(({pts})=>{
        const H=window.__HARNESS; const o=[];
        for(const p of pts) { const w=H.getWaterAt(p[0],p[1]); o.push([+w.depth_m.toFixed(3), w.band]); }
        return o;
      },{pts:leg.points});
      let tot=0,prev=null; const bands={W0:0,W1:0,W2:0,W3:0,W4:0,W5:0}; let maxd=0,at=null;
      for(let i=0;i<leg.points.length;i++){
        const p=leg.points[i]; const seg=prev?Math.hypot(p[0]-prev[0],p[1]-prev[1]):0;
        tot+=seg; bands[prof[i][1]]=(bands[prof[i][1]]||0)+seg;
        if(prof[i][0]>maxd){maxd=prof[i][0];at=[p[0],p[1]];}
        prev=p;
      }
      res.push({id:leg.id,total_m:+tot.toFixed(1),max_depth_m:maxd,deepest_at:at,
        band_metres:Object.fromEntries(Object.entries(bands).map(([k,v])=>[k,+v.toFixed(1)]))});
    }
    out.tides[tide]=res;
    const T=res.reduce((a,l)=>a+l.total_m,0);
    const over=res.reduce((a,l)=>a+(l.band_metres.W3||0)+(l.band_metres.W4||0)+(l.band_metres.W5||0),0);
    const w5=res.reduce((a,l)=>a+(l.band_metres.W5||0),0);
    console.log(`TIDE ${tide}: road ${T.toFixed(0)} m; over-knee ${over.toFixed(0)} m (${(over/T*100).toFixed(1)}%); over-chest ${w5.toFixed(0)} m (${(w5/T*100).toFixed(1)}%)`);
    for(const l of res) console.log(`   ${l.id.padEnd(22)} max ${String(l.max_depth_m).padStart(6)} m  W3+ ${((l.band_metres.W3||0)+(l.band_metres.W4||0)+(l.band_metres.W5||0)).toFixed(0)} m  W5 ${(l.band_metres.W5||0).toFixed(0)} m`);
  }
} catch(e){ console.error('ERR',e.stack); out.error=String(e.stack); }
finally{ await h.close(); }
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01/critic-road-water-harness.json',JSON.stringify(out,null,2)+'\n');
console.log('written');
