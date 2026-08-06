import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';
import fs from 'node:fs';
const h = await launchGame({ width: 320, height: 180 });
const WALK = 0.55 - 1e-9;
const out = { schema:'critic/locomotion@1', measured_at:new Date().toISOString(), note:'W1-01 critic instrument: S17 tested from the side RI-WLD01 M3 cannot see.', probes:{} };
const ev = (fn, arg) => h.page.evaluate(fn, arg);
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');

  // P1 — realized walk speed on ten kinds of ground, 300 frames each, batched.
  const sites=[['road-stormhold-helstrom',2210,1200],['valus-ridge-high',1701.4,1885.6],['valus-ridge-steep',1642.6,1617.8],
    ['deep-marshes-water',3184.6,3463.9],['deep-marshes-water2',3254.9,3801.9],['blackwood-offroad',1558.9,3432.7],
    ['salt-hills-slope',2426.4,737.2],['stone-wastes-flat',853.3,5047.4],['eastern-rootlands',3147.0,4723.7],['clay-moor',3650.7,2098.6],
    ['lilmoth-start',2766.5,5011],['marauders-coast',552.5,4271.9]];
  out.probes.P1=[];
  for(const [id,x,z] of sites){
    const r = await ev(({x,z,m})=>{
      const H=window.__HARNESS; H.teleport(x,z);
      const w0=H.getWaterAt(x,z), t0=H.getTerrainAt(x,z), rg=H.getRegionAt(x,z);
      const a=H.getPlayerStats();
      const s=[]; for(let i=0;i<300;i++) s.push({f:i,move:[m,0]});
      H.queueInputs(s); H.stepFrames(300);
      const b=H.getPlayerStats();
      return {water:w0,terrain:t0,region:rg,a:a.pos,b:b.pos,
        d:Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]), dy:b.pos[1]-a.pos[1],
        stam_a:a.stamina, stam_b:b.stamina, hp_a:a.hp, hp_b:b.hp, state:b.state};
    },{x,z,m:WALK});
    const sp=+(r.d/5).toFixed(4);
    out.probes.P1.push({site:id,x,z,region:r.region&&(r.region.id||r.region),
      water_depth_m:r.water&&(r.water.depth_m!==undefined?r.water.depth_m:r.water.depth),
      water:r.water, terrain:r.terrain, walk_mps_over_5s:sp, dy_m:+r.dy.toFixed(2),
      stamina:[r.stam_a,r.stam_b], hp:[r.hp_a,r.hp_b], end_state:r.state});
    console.log(`P1 ${id.padEnd(26)} ${sp} m/s  dy ${r.dy.toFixed(1)} m  stam ${r.stam_a}->${r.stam_b}  hp ${r.hp_a}->${r.hp_b}  water ${JSON.stringify(r.water)}`);
  }

  // P2 — acceleration ramp: distance after k frames from a standing start.
  {const rows=[];
   for(const k of [1,2,3,4,5,6,8,10,15,20,30,60]){
     const r=await ev(({k,m})=>{const H=window.__HARNESS;H.teleport(2210,1200);
       const a=H.getPlayerStats();const s=[];for(let i=0;i<k;i++)s.push({f:i,move:[m,0]});
       H.queueInputs(s);H.stepFrames(k);const b=H.getPlayerStats();
       return Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]);},{k,m:WALK});
     rows.push({frames:k,dist_m:+r.toFixed(4),mean_mps:+(r/(k/60)).toFixed(4)});}
   out.probes.P2={ramp:rows,note:'mean m/s from a standing start; a flat 2.0 at k=1 means no acceleration model at all'};
   console.log('P2 ramp',rows.map(r=>`${r.frames}f=${r.mean_mps}`).join(' '));}

  // P3 — turn rate on a 180 reversal.
  {const yaws=[];
   for(const k of [0,1,2,3,4,6,8,12,20,40,80]){
     const y=await ev(({k,m})=>{const H=window.__HARNESS;H.teleport(2210,1200);
       const s=[];for(let i=0;i<60;i++)s.push({f:i,move:[m,0]});H.queueInputs(s);H.stepFrames(60);
       if(k>0){const s2=[];for(let i=0;i<k;i++)s2.push({f:i,move:[-m,0]});H.queueInputs(s2);H.stepFrames(k);}
       return H.getPlayerStats().yaw_deg;},{k,m:WALK});
     yaws.push({frames_after_reversal:k,yaw_deg:+y.toFixed(2)});}
   out.probes.P3={reversal:yaws,note:'yaw after k frames of a full 180-degree stick reversal'};
   console.log('P3 reversal',yaws.map(y=>`${y.frames_after_reversal}f=${y.yaw_deg}`).join(' '));}

  // P4 — stamina and HP over 60 s of continuous walking.
  {const r=await ev(({m})=>{const H=window.__HARNESS;H.teleport(2210,1200);
     const a=H.getPlayerStats();
     for(let c=0;c<12;c++){const s=[];for(let i=0;i<300;i++)s.push({f:i,move:[m,0]});H.queueInputs(s);H.stepFrames(300);}
     const b=H.getPlayerStats();
     return {a,b,d:Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2])};},{m:WALK});
   out.probes.P4={stamina:[r.a.stamina,r.b.stamina],hp:[r.a.hp,r.b.hp],dist_m:+r.d.toFixed(1),
     mean_mps_over_60s:+(r.d/60).toFixed(4)};
   console.log('P4 60s walk',JSON.stringify(out.probes.P4));}

  // P5 — the declared speed table, realized.
  {out.probes.P5=[];
   for(const [label,mag,x,z] of [['walk',WALK,2210,1200],['jog',1.0,2210,1200],['quarter-stick',0.1375,2210,1200],
      ['half-walk-band',0.275,2210,1200],['walk-in-deep-marsh-water',WALK,3184.6,3463.9],['jog-in-deep-marsh-water',1.0,3184.6,3463.9]]){
     const r=await ev(({x,z,m})=>{const H=window.__HARNESS;H.teleport(x,z);
       const a=H.getPlayerStats();const s=[];for(let i=0;i<300;i++)s.push({f:i,move:[m,0]});
       H.queueInputs(s);H.stepFrames(300);const b=H.getPlayerStats();
       return {d:Math.hypot(b.pos[0]-a.pos[0],b.pos[2]-a.pos[2]),state:b.state,stam:b.stamina,water:H.getWaterAt(b.pos[0],b.pos[2])};},{x,z,m:mag});
     out.probes.P5.push({label,stick_mag:mag,mps:+(r.d/5).toFixed(4),end_state:r.state,end_stamina:r.stam,end_water:r.water});
     console.log(`P5 ${label.padEnd(26)} ${(r.d/5).toFixed(4)} m/s  state ${r.state}  stam ${r.stam}`);}}
} catch(e){ console.error('ERROR',e&&e.stack); out.error=String(e&&e.stack||e); }
finally{ await h.close(); }
fs.writeFileSync('/home/user/elder-souls-claude/corpus/90-verdicts/wave1/artifacts/W1-01/critic-locomotion.json', JSON.stringify(out,null,2)+'\n');
console.log('written');
