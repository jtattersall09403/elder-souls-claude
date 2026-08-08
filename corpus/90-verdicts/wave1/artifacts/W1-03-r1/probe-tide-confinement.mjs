import { readFileSync } from 'node:fs';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
globalThis.atob=globalThis.atob||((s)=>Buffer.from(s,'base64').toString('binary'));
const R='/home/user/elder-souls-claude/'; const rd=(p)=>JSON.parse(readFileSync(R+p,'utf8'));
const REG=rd('game/data/world/regions.json');
function mk(){const f=new WorldField(rd('game/data/world/terrain.json'),REG,rd('game/data/world/water.json'));f.setRoads(rd('game/data/world/roads.json'));return f;}
const f=mk();
// spot check: find one wet cell in each offending region and report id + swing
for(const name of ['The Deep Marshes','Thornmarsh','Valus Ridge']){
  const r=REG.regions.find(x=>x.name===name), ri=REG.regions.indexOf(r);
  const bx=r.bounds_m.x,bz=r.bounds_m.z;
  outer: for(let i=0;i<200;i++)for(let j=0;j<200;j++){
    const x=bx[0]+(bx[1]-bx[0])*(i+0.5)/200, z=bz[0]+(bz[1]-bz[0])*(j+0.5)/200;
    if(f.regionIndexAt(x,z)!==ri) continue;
    const a=f.waterSurfaceAt(x,z,0.25), b=f.waterSurfaceAt(x,z,0.75);
    if(a===null||b===null||Math.abs(a-b)<0.02) continue;
    const reg=f.regionAt(x,z);
    console.log(`${name}: point (${x.toFixed(0)},${z.toFixed(0)}) regionAt.id=${reg.id} declared_tidal=${reg.water&&reg.water.tidal} sea=${reg.water&&reg.water.sea}`);
    console.log(`   surface HIGH=${a.toFixed(3)} LOW=${b.toFixed(3)} swing=${Math.abs(a-b).toFixed(3)} m   isLandAt=${f.isLandAt(x,z)}`);
    break outer;
  }
}
// RULE 4: break the instrument on purpose. Zero every tide range -> the check must go silent.
const g=mk(); g.tideRange[1]=0; g.tideRange[2]=0;
let worst=0;
for(const r of REG.regions){
  const wd=(rd('game/data/world/water.json').regions||[]).find(w=>w.region===r.name);
  if(wd&&wd.tidal) continue;
  const ri=REG.regions.indexOf(r), bx=r.bounds_m.x,bz=r.bounds_m.z;
  for(let i=0;i<40;i++)for(let j=0;j<40;j++){
    const x=bx[0]+(bx[1]-bx[0])*(i+0.5)/40, z=bz[0]+(bz[1]-bz[0])*(j+0.5)/40;
    if(g.regionIndexAt(x,z)!==ri) continue;
    const a=g.waterSurfaceAt(x,z,0.25), b=g.waterSurfaceAt(x,z,0.75);
    if(a!==null&&b!==null) worst=Math.max(worst,Math.abs(a-b));
  }
}
console.log(`\nRULE 4 CONTROL — tideRange zeroed: worst non-tidal amplitude = ${worst.toFixed(4)} m (must be 0.0000; if it were not, my instrument would be measuring something other than the tide)`);

// SECOND ARM (rule 6, the two arms must differ): restore the ranges and confirm the number comes back.
const h=mk(); let worst2=0;
for(const r of REG.regions){
  const wd=(rd('game/data/world/water.json').regions||[]).find(w=>w.region===r.name);
  if(wd&&wd.tidal) continue;
  const ri=REG.regions.indexOf(r), bx=r.bounds_m.x,bz=r.bounds_m.z;
  for(let i=0;i<40;i++)for(let j=0;j<40;j++){
    const x=bx[0]+(bx[1]-bx[0])*(i+0.5)/40, z=bz[0]+(bz[1]-bz[0])*(j+0.5)/40;
    if(h.regionIndexAt(x,z)!==ri) continue;
    const a=h.waterSurfaceAt(x,z,0.25), b=h.waterSurfaceAt(x,z,0.75);
    if(a!==null&&b!==null) worst2=Math.max(worst2,Math.abs(a-b));
  }
}
console.log(`SECOND ARM  — ranges restored: worst non-tidal amplitude = ${worst2.toFixed(4)} m`);
// and the one-line cause
const src=readFileSync(R+'game/src/world/field.js','utf8');
const m=src.match(/const tidalHere = .*/);
console.log('\ncause, quoted from game/src/world/field.js:');
console.log('   ', m && m[0]);
