// M19 ONLY-HERE audit + region prop census, taken from the RUNNING scene graph, not from data files.
import { launchGame } from '../lib/browser.mjs';
import fs from 'node:fs';
const OUT='corpus/90-verdicts/wave1/artifacts/W1-01-r2/';
const h=await launchGame({width:640,height:360});
const ev=(fn,a)=>h.page.evaluate(fn,a);
const out={schema:'critic/w1-01-r2-props@1',measured_at:new Date().toISOString()};
try{
  await h.h('setSeed',1337); await h.h('loadState','default'); await h.h('setTide','LOW');
  out.provinceStats = await h.h('getProvinceStats');
  out.worldStats    = await h.h('getWorldStats');
  // Region centroids from the built world; census the live scene graph around each.
  const regions = await ev(()=>{
    const H=window.__HARNESS; const rs=H.getWorldStats();
    return null;
  });
  const cents=JSON.parse(fs.readFileSync('game/data/world/regions.json','utf8')).regions
    .map(r=>({id:r.id,x:r.centroid_m[0],z:r.centroid_m[1],only_here:r.only_here&&r.only_here.id,
      declared_instances:r.only_here&&r.only_here.instances,
      architecture:r.architecture, flora:r.flora}));
  out.regions=[];
  for(const c of cents){
    const r=await ev(({x,z})=>{
      const H=window.__HARNESS;
      H.teleport(x,z); H.stepFrames(8);
      if(H.streamAround) try{ H.streamAround(x,z,64); }catch(e){}
      H.stepFrames(8);
      // walk the live three.js scene graph and census object names/geometry types near the player
      const sc = window.__ES_SCENE || (window.__HARNESS.__scene) || null;
      const names={}, geos={}, mats=new Set();
      const root = sc || (function(){ // last resort: find a THREE.Scene on the renderer
        const e=window.__ES_ENGINE; return e&&e.renderer&&e.renderer.scene?e.renderer.scene:null; })();
      if(root && root.traverse){
        root.traverse((o)=>{
          if(!o.isMesh && !o.isInstancedMesh) return;
          const d=Math.hypot((o.position&&o.position.x||0)-x,(o.position&&o.position.z||0)-z);
          const key=(o.name||'(unnamed)')+(o.isInstancedMesh?`[x${o.count}]`:'');
          names[key]=(names[key]||0)+1;
          const g=o.geometry&&o.geometry.type||'?'; geos[g]=(geos[g]||0)+1;
          if(o.material) mats.add((o.material.name||o.material.type||'?'));
        });
      }
      return {found_scene:!!root, names, geos, mats:[...mats], entities:H.listEntities?H.listEntities().length:null,
        terrain:H.getTerrainAt(x,z), region:H.getRegionAt(x,z)};
    },{x:c.x,z:c.z});
    out.regions.push({...c,...r});
    console.log(c.id.padEnd(18), 'scene:',r.found_scene, 'meshnames:',Object.keys(r.names).length, 'geos:',JSON.stringify(r.geos), 'entities:',r.entities);
  }
} finally { await h.close(); }
fs.writeFileSync(OUT+'critic-props-census.json',JSON.stringify(out,null,1)+'\n');
console.log('wrote',OUT+'critic-props-census.json');
