// Is the street stand in a street? 16 horizontal rays at eye height + 1 straight up.
import fs from 'node:fs';
import * as THREE from '/home/user/elder-souls-claude/game/vendor/three/three.module.js';
import { planSettlement, buildSettlementExterior } from '/home/user/elder-souls-claude/game/src/render/exterior.js';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
const ROOT = process.argv[3] || '/home/user/elder-souls-claude';
process.chdir(ROOT);
const rd=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const deck=rd('tools/visual/deck.json');
const field=new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));
const groundY=(x,z)=>field.heightAt(x,z);
const towns = process.argv[2] ? [process.argv[2]] : [...new Set(deck.setups.filter(s=>s.block==='settlement-street').map(s=>s.settlement))].sort();
for (const town of towns) {
  const setup=deck.setups.find(s=>s.block==='settlement-street'&&s.settlement===town);
  const rec=rd(`game/data/world/settlements/${town}.json`);
  const interiors={}; for(const b of rec.buildings) if(b.interior){const p=`game/data/world/interiors/${b.interior}.json`; if(fs.existsSync(p)) interiors[b.interior]=rd(p);}
  const root=new THREE.Group();
  buildSettlementExterior(root, planSettlement(rec, interiors, {}), groundY, { settlementBatch:false, buildingBatch:false });
  root.updateMatrixWorld(true);
  const px=setup.place.x, pz=setup.place.z; const py=groundY(px,pz);
  const rc=new THREE.Raycaster(); rc.far=200;
  const ds=[]; let overhead=null;
  for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    rc.set(new THREE.Vector3(px, py+1.6, pz), new THREE.Vector3(Math.sin(a),0,Math.cos(a)));
    const h=rc.intersectObject(root,true);
    ds.push(h.length? h[0].distance : Infinity);
  }
  rc.set(new THREE.Vector3(px, py+1.6, pz), new THREE.Vector3(0,1,0));
  const up=rc.intersectObject(root,true);
  overhead = up.length ? { d:+up[0].distance.toFixed(2), kit: up[0].object.userData.kitId||up[0].object.name||'(untagged)' } : null;
  // The THIRD-PERSON CAMERA's own point: sim/camera.js rest_arm_m = 4.9 m back along -forward,
  // and it is the camera that takes the picture, not the player. `build-deck.mjs` gates the stand
  // on this point's footprint clearance; nothing gated on what is ABOVE it.
  const yaw = (setup.camera && setup.camera.yaw_deg || 0) * Math.PI/180;
  const cx = px - Math.sin(yaw)*4.9, cz = pz - Math.cos(yaw)*4.9;
  rc.set(new THREE.Vector3(cx, py+2.2, cz), new THREE.Vector3(0,1,0));
  const cu=rc.intersectObject(root,true);
  const camOver = cu.length ? `${cu[0].distance.toFixed(2)}m [${cu[0].object.userData.kitId||cu[0].object.name||'(untagged)'}]` : 'open sky';
  let camNear=Infinity, camNearName='-';
  for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; rc.set(new THREE.Vector3(cx,py+2.2,cz), new THREE.Vector3(Math.sin(a),0,Math.cos(a)));
    const h=rc.intersectObject(root,true); if(h.length&&h[0].distance<camNear){camNear=h[0].distance; camNearName=h[0].object.userData.kitId||h[0].object.name||'(untagged)';} }
  const blocked = ds.filter(d=>d<3).length;
  const open = ds.filter(d=>!Number.isFinite(d)).length;
  console.log(`${town.padEnd(11)} y${py.toFixed(1)} rays<3m ${String(blocked).padStart(2)}/16  fully open ${String(open).padStart(2)}/16  nearest ${Math.min(...ds).toFixed(2)}m  median ${ds.slice().sort((a,b)=>a-b)[8].toFixed(2)}m  OVER-PLAYER ${overhead? overhead.d+'m ['+overhead.kit+']' : 'open sky'}  OVER-CAMERA ${camOver}  cam nearest ${camNear.toFixed(2)}m [${camNearName}]`);
}
