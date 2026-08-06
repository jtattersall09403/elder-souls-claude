import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h = await launchGame({ width: 1280, height: 720 });
const ev=(fn,arg)=>h.page.evaluate(fn,arg);
const rec=[];
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
  // pos/look poses computed explicitly: eye at (x+dx, groundY+dy, z+dz) looking at the site.
  const shots=[
    ['embankment-stormhold-helstrom-air', 2240.3,1340.2, [ 60, 40, 60], 6, 12,'clear'],
    ['embankment-stormhold-helstrom-eye', 2240.3,1340.2, [ 25,  3, 0], 1.6, 12,'clear'],
    ['ramp-58deg-side',                   2104.4,1235.7, [ 30, 12, 25], 2, 12,'clear'],
    ['old-drowned-point-2182-2214',       2182.5,2214.6, [ 40, 25, 40], 4, 12,'clear'],
    ['tideway-lilmoth-archon',            3444.7,3663.0, [ 20,  8, 20], 1.5, 12,'clear'],
    ['viaduct-blackrose-lilmoth',         2689.5,4810.3, [ 45, 25, 45], 3, 12,'clear'],
    ['viaduct-blackrose-lilmoth-eye',     2689.5,4810.3, [ 18,  2.5, 0], 1.6, 12,'clear'],
    ['helstrom-gideon-fill',              1603.7,2827.2, [ 40, 22, 40], 3, 12,'clear'],
  ];
  for(const [id,x,z,off,lookdy,tod,wx] of shots){
    const r = await ev(({x,z,off,lookdy,tod,wx})=>{
      const H=window.__HARNESS;
      H.camera({mode:'gameplay'});
      H.teleport(x,z); H.setTimeOfDay(tod); H.setWeather(wx); H.stepFrames(6);
      const g=H.getTerrainAt(x,z).y;
      H.camera({pos:[x+off[0], g+off[1], z+off[2]], look:[x, g+lookdy, z], fov:55});
      H.stepFrames(1);
      return {ground_y:g, terrain:H.getTerrainAt(x,z), water:H.getWaterAt(x,z), cam:H.getCameraFrame?H.getCameraFrame():null};
    },{x,z,off,lookdy,tod,wx});
    const url=await h.h('screenshot');
    fs.writeFileSync(OUT+`shot-${id}.png`, Buffer.from(String(url).split(',')[1],'base64'));
    rec.push({id,x,z,eye_offset:off,look_dy:lookdy,tod,weather:wx,...r});
    console.log('shot',id,'ground_y',r.ground_y);
  }
} finally { await h.close(); }
fs.writeFileSync(OUT+'critic-shots.json', JSON.stringify({schema:'critic/w1-01-r2-shots@1',res:'1280x720',shots:rec},null,1)+'\n');
