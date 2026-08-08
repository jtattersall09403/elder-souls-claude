import { readFileSync } from 'node:fs';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
globalThis.atob=globalThis.atob||((s)=>Buffer.from(s,'base64').toString('binary'));
const R='/home/user/elder-souls-claude/'; const rd=(p)=>JSON.parse(readFileSync(R+p,'utf8'));
const f=new WorldField(rd('game/data/world/terrain.json'),rd('game/data/world/regions.json'),rd('game/data/world/water.json'));
f.setRoads(rd('game/data/world/roads.json'));
// province.js: TILE_M 300, WATER_SEG 24 -> a 12.5 m water quad, DROPPED if any corner is dry.
const TILE_M=300, WATER_SEG=24, step=TILE_M/WATER_SEG;
function tileAudit(px,pz,label){
  const ox=Math.floor(px/TILE_M)*TILE_M, oz=Math.floor(pz/TILE_M)*TILE_M;
  let wetPts=0,total=0,quads=0,kept=0;
  for(let iz=0;iz<WATER_SEG;iz++)for(let ix=0;ix<WATER_SEG;ix++){
    const x0=ox+ix*step,z0=oz+iz*step;
    const corners=[[x0,z0],[x0+step,z0],[x0+step,z0+step],[x0,z0+step]];
    const surf=corners.map(([cx,cz])=>f.waterSurfaceAt(cx,cz));
    quads++;
    if(!surf.some(s=>s===null)) kept++;
  }
  // how much of the tile is actually WET, sampled finely
  for(let i=0;i<60;i++)for(let j=0;j<60;j++){
    const x=ox+(i+0.5)*TILE_M/60, z=oz+(j+0.5)*TILE_M/60;
    total++; if(f.depthAt(x,z)>0) wetPts++;
  }
  console.log(`${label}  tile origin (${ox},${oz})`);
  console.log(`  wet area (fine 5 m sample): ${(100*wetPts/total).toFixed(1)}% of the tile`);
  console.log(`  water QUADS kept by province.js (12.5 m, all four corners wet): ${kept}/${quads} = ${(100*kept/quads).toFixed(1)}%`);
  console.log(`  -> drawn water covers ${(100*kept/quads).toFixed(1)}% of a tile that is ${(100*wetPts/total).toFixed(1)}% wet\n`);
}
tileAudit(2226.9,4376.1,'ROUND-1/2 SHOT POINT (western-rootlands, paddy+channel, WCI 0.47)');
tileAudit(2620,4362,'EASTERN ROOTLANDS tidal delta point');
tileAudit(2782.7,4248.5,'OPEN WATER 900 m out');
// and the point itself
for(const [x,z,n] of [[2226.9,4376.1,'shot point']]){
  console.log(`${n}: depth=${f.depthAt(x,z).toFixed(3)} surf=${f.waterSurfaceAt(x,z)}`);
  const ox=Math.floor(x/step)*step, oz=Math.floor(z/step)*step;
  const corners=[[ox,oz],[ox+step,oz],[ox+step,oz+step],[ox,oz+step]];
  console.log('  its own 12.5 m quad corners surface_y:',corners.map(([a,b])=>f.waterSurfaceAt(a,b)));
  console.log('  -> this quad is', corners.map(([a,b])=>f.waterSurfaceAt(a,b)).some(s=>s===null)?'DROPPED (no water drawn)':'kept');
}
