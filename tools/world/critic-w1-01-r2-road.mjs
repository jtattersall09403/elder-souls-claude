// W1-01 round-2 critic instrument. Judged from the running capsule, not from reports/.
import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h = await launchGame({ width: 1280, height: 720 });
const WALK = 0.55 - 1e-9;
const out = { schema:'critic/w1-01-r2-road@1', measured_at:new Date().toISOString(), probes:{} };
const ev=(fn,arg)=>h.page.evaluate(fn,arg);
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
  out.build = await h.h('getBuildInfo');

  // --- R1: the 58.6-degree ramp on stormhold-helstrom, walked ------------------------------
  // roads.json: points ... [2104.44,1235.65,248.70] preceded by y=229.07 over 11.99 m run.
  const ramp = await ev(({m})=>{
    const H=window.__HARNESS;
    const A=[2092.6,1233.5], B=[2104.44,1235.65];
    H.teleport(A[0],A[1]);
    const t0=H.getTerrainAt(A[0],A[1]), t1=H.getTerrainAt(B[0],B[1]);
    const s0=H.getPlayerStats();
    // aim the stick at B
    const dx=B[0]-A[0], dz=B[1]-A[1], L=Math.hypot(dx,dz);
    const script=[]; for(let i=0;i<240;i++) script.push({f:i,move:[m*dx/L, m*dz/L]});
    const samples=[];
    H.queueInputs(script);
    for(let i=0;i<240;i++){ H.stepFrames(1); const p=H.getPlayerStats();
      samples.push([+p.pos[0].toFixed(3),+p.pos[1].toFixed(3),+p.pos[2].toFixed(3),p.state]); }
    const s1=H.getPlayerStats();
    return {terrain_A:t0, terrain_B:t1, p0:s0.pos, p1:s1.pos, stam:[s0.stamina,s1.stamina], hp:[s0.hp,s1.hp], samples};
  },{m:WALK});
  {
    const s=ramp.samples; let horiz=0, rise=0, maxStep=0;
    for(let i=1;i<s.length;i++){ horiz+=Math.hypot(s[i][0]-s[i-1][0],s[i][2]-s[i-1][2]);
      const dy=s[i][1]-s[i-1][1]; rise+=dy; if(Math.abs(dy)>maxStep) maxStep=Math.abs(dy); }
    out.probes.R1_ramp={ note:'held walk stick along the steepest built road segment (grade 1.637 declared)',
      terrain_A:ramp.terrain_A, terrain_B:ramp.terrain_B,
      start:ramp.p0, end:ramp.p1, seconds:4.0,
      horizontal_m:+horiz.toFixed(2), vertical_m:+rise.toFixed(2),
      horizontal_mps:+(horiz/4).toFixed(4), max_dy_per_frame_m:+maxStep.toFixed(3),
      stamina:ramp.stam, hp:ramp.hp, states:[...new Set(ramp.samples.map(x=>x[3]))],
      samples_every_10f: s.filter((_,i)=>i%10===0) };
    console.log('R1 ramp horiz',horiz.toFixed(2),'m rise',rise.toFixed(2),'m  hspeed',(horiz/4).toFixed(3),'m/s  states',out.probes.R1_ramp.states.join(','));
  }

  // --- R2: can you leave the road? perpendicular walk-off at the tallest embankment ---------
  const sites=[
    ['fill-17.5m-stormhold-helstrom',2240.3,1340.2],
    ['fill-13.7m-blackrose-lilmoth',2689.5,4810.3],
    ['fill-8.0m-stormhold-thorn',2692.0,815.0],
    ['flat-archon-thorn',3915.5,2111.6],
  ];
  out.probes.R2_walkoff=[];
  for(const [id,x,z] of sites){
    const r = await ev(({x,z,m})=>{
      const H=window.__HARNESS;
      const res={on_road:null,sides:[]};
      H.teleport(x,z); const a=H.getPlayerStats(); res.on_road={pos:a.pos,terrain:H.getTerrainAt(x,z),water:H.getWaterAt(x,z)};
      for(const dir of [[1,0],[-1,0],[0,1],[0,-1]]){
        H.teleport(x,z);
        const s0=H.getPlayerStats();
        const sc=[]; for(let i=0;i<600;i++) sc.push({f:i,move:[m*dir[0],m*dir[1]]});
        H.queueInputs(sc); H.stepFrames(600);
        const s1=H.getPlayerStats();
        res.sides.push({dir, moved_m:+Math.hypot(s1.pos[0]-s0.pos[0],s1.pos[2]-s0.pos[2]).toFixed(2),
          dy:+(s1.pos[1]-s0.pos[1]).toFixed(2), end:[+s1.pos[0].toFixed(1),+s1.pos[2].toFixed(1)],
          hp:[s0.hp,s1.hp], end_state:s1.state,
          end_terrain:H.getTerrainAt(s1.pos[0],s1.pos[2]), end_water:H.getWaterAt(s1.pos[0],s1.pos[2])});
      }
      return res;
    },{x,z,m:WALK});
    out.probes.R2_walkoff.push({site:id,x,z,...r});
    console.log('R2',id, r.sides.map(s=>`${s.dir}=${s.moved_m}m dy${s.dy}`).join('  '));
  }

  // --- R3: frames --------------------------------------------------------------------------
  const shots=[
    ['embankment-stormhold-helstrom', 2240.3, 1340.2, 12, 'clear', {yaw:90,pitch:-8,arm:14}],
    ['embankment-side-on',            2265.0, 1340.2, 12, 'clear', {yaw:180,pitch:-4,arm:20}],
    ['ramp-58deg',                    2098.0, 1234.5, 12, 'clear', {yaw:12,pitch:-2,arm:10}],
    ['old-drowned-point',             2182.5, 2214.6, 12, 'clear', {yaw:90,pitch:-5,arm:4}],
    ['tideway-lilmoth-archon',        3444.7, 3663.0, 12, 'clear', {yaw:45,pitch:-5,arm:6}],
    ['viaduct-blackrose-lilmoth',     2689.5, 4810.3, 12, 'clear', {yaw:180,pitch:-6,arm:18}],
  ];
  out.probes.R3_shots=[];
  for(const [id,x,z,tod,wx,pose] of shots){
    await ev(({x,z,tod,wx,pose})=>{const H=window.__HARNESS;H.teleport(x,z);H.setTimeOfDay(tod);H.setWeather(wx);H.stepFrames(4);H.camera(pose);H.stepFrames(1);},{x,z,tod,wx,pose});
    const url=await h.h('screenshot');
    const b=Buffer.from(String(url).split(',')[1],'base64');
    fs.writeFileSync(OUT+`shot-${id}.png`,b);
    const w=await ev(({x,z})=>({terrain:window.__HARNESS.getTerrainAt(x,z),water:window.__HARNESS.getWaterAt(x,z)}),{x,z});
    out.probes.R3_shots.push({id,x,z,tod,weather:wx,pose,file:`shot-${id}.png`,bytes:b.length,...w});
    console.log('R3 shot',id,b.length,'bytes');
  }

  // --- R4: travel network (AR-2 B13 / B2) ---------------------------------------------------
  try{
    const net=await h.h('getTravelNetwork');
    out.probes.R4_travel={stations:(net.stations||[]).length, services:(net.services||[]).length, modes:net.modes?Object.keys(net.modes).length:null, keys:Object.keys(net)};
    console.log('R4 travel', JSON.stringify(out.probes.R4_travel));
  }catch(e){ out.probes.R4_travel={error:String(e.message||e)}; }

  out.probes.world = await h.h('getWorldStats');
} finally { await h.close(); }
fs.writeFileSync(OUT+'critic-road-probe.json', JSON.stringify(out,null,1)+'\n');
console.log('\nwrote '+OUT+'critic-road-probe.json');
