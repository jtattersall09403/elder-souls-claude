#!/usr/bin/env node
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {NodeArena} from '../lib/combat-node.mjs';
import {CollisionCell} from '../../game/src/sim/collision.js';
import {stepNPCWorldCollision} from '../../game/src/sim/world-collision.js';
import {
  interiorCollisionShapes, interiorShellPlan,
} from '../../game/src/render/interior.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const idir=path.join(ROOT,'game/data/world/interiors');
const rooms=[];
for(const file of fs.readdirSync(idir).filter(x=>x.endsWith('.json')).sort()){
  const doc=JSON.parse(fs.readFileSync(path.join(idir,file),'utf8'));
  rooms.push(...(Array.isArray(doc)?doc:(Array.isArray(doc.interiors)?doc.interiors:[doc])));
}
const failures=[];
const check=(ok,msg)=>{if(!ok)failures.push(msg);};

function jumpRun(deleteBase=false){
  const arena=new NodeArena({loadout:{weapon:'straight-sword'}}),launchY=8.75;
  arena.player.pos[1]=launchY;
  arena.queueInputs([{f:2,press:['jump']},{f:4,release:['jump']}]);
  const rows=[];
  for(let i=0;i<70;i++){
    arena.step();
    if(deleteBase&&arena.player.move&&arena.player.move.kind==='jump')arena.player.jumpBaseY=0;
    rows.push({f:arena.frame,y:arena.player.pos[1],state:arena.player.state,airborne:arena.player.airborne});
  }
  const action=rows.filter(r=>r.state.startsWith('JUMP'));
  return {launchY,rows,action,min:Math.min(...action.map(r=>r.y)),max:Math.max(...action.map(r=>r.y)),end:rows.at(-1).y};
}

const jump=jumpRun(false),jumpDeleted=jumpRun(true);
check(jump.action.length===46,`jump action length ${jump.action.length}, expected 46 f@60`);
check(jump.min>=jump.launchY-1e-9,`jump fell below launch floor: ${jump.min} < ${jump.launchY}`);
check(jump.max>=jump.launchY+0.60&&jump.max<=jump.launchY+0.63,
  `jump apex ${jump.max} outside launch-relative 0.60..0.63 m`);
check(Math.abs(jump.end-jump.launchY)<1e-9,`jump ended at ${jump.end}, not launch floor ${jump.launchY}`);
check(jumpDeleted.min<1&&jumpDeleted.end<1,
  `jump-base delete arm did not fail floor-relative height: min=${jumpDeleted.min} end=${jumpDeleted.end}`);

let wallSamples=0,doorSamples=0,npcSamples=0,doorDeleteReleased=0,allDeleteReleased=0;
for(const rec of rooms){
  const plan=interiorShellPlan(rec),shapes=interiorCollisionShapes(rec);
  check(!!plan,`${rec.id}: no shell plan`);
  check(shapes.length===plan.parts.length+2,
    `${rec.id}: collision ${shapes.length} != shell parts ${plan.parts.length}+floor/ceiling`);
  const cell=new CollisionCell(`interior:${rec.id}`,shapes,{}),y=plan.by[0]+0.90,r=.35;
  // A fixed-step body first breaches its clearance radius while its centre remains on the room
  // side of the 0.30 m slab. Probing the mathematical centre of a solid would exercise the
  // solver's documented centre-of-column fallback, not a walk into a wall.
  const clearance=side=>side===plan.entry?.409:.499;
  const probes=[
    {id:'north',p:[(plan.bx[0]+plan.bx[1])/2,y,plan.bz[0]+.40],inside:q=>q[2]>=plan.bz[0]+clearance('north')},
    {id:'south',p:[(plan.bx[0]+plan.bx[1])/2,y,plan.bz[1]-.40],inside:q=>q[2]<=plan.bz[1]-clearance('south')},
    {id:'west',p:[plan.bx[0]+.40,y,(plan.bz[0]+plan.bz[1])/2],inside:q=>q[0]>=plan.bx[0]+clearance('west')},
    {id:'east',p:[plan.bx[1]-.40,y,(plan.bz[0]+plan.bz[1])/2],inside:q=>q[0]<=plan.bx[1]-clearance('east')},
  ];
  for(const q of probes){
    // Entry-wall centre is the closed door; the other three/four centres are wall slabs.
    const p=q.p.slice(),moved=cell.resolveSphere(p,r,8);
    check(moved&&q.inside(p),`${rec.id}:${q.id} did not contain body (${p.join(',')})`);
    wallSamples++;
  }
  const door=plan.parts.find(p=>p.role==='door');
  check(!!door,`${rec.id}: no door leaf in shared shell plan`);
  if(door){
    const before=door.side==='north'
      ? [door.c[0],y,door.c[2]+.25]
      : door.side==='south'
        ? [door.c[0],y,door.c[2]-.25]
        : door.side==='west'
          ? [door.c[0]+.25,y,door.c[2]]
          : [door.c[0]-.25,y,door.c[2]];
    const p=before.slice();
    const moved=cell.resolveSphere(p,r,8);
    check(moved&&Math.hypot(p[0]-before[0],p[2]-before[2])>.03,
      `${rec.id}: closed door did not resolve body`);
    doorSamples++;
    const openCell=new CollisionCell(`door-deleted:${rec.id}`,interiorCollisionShapes(rec,{door:false}),{});
    const clear=openCell.distance(before[0],before[1],before[2])>r;
    if(clear)doorDeleteReleased++;
    check(clear,`${rec.id}: door delete arm did not release threshold`);
    // Ordinary NPCs have no CombatBody, so exercise their dedicated shared-cell consumer at
    // the same closed threshold with the NPC's slightly smaller 0.32 m body radius.
    const npc={eid:'control-npc',present:true,pos:[before[0],plan.by[0],before[2]]};
    const sim={cell,npcs:[npc]},npcMoved=stepNPCWorldCollision(sim);
    check(npcMoved&&cell.distance(npc.pos[0],npc.pos[1]+.9,npc.pos[2])>=.319,
      `${rec.id}: NPC escaped shared shell`);
    npcSamples++;
  }
  const empty=new CollisionCell(`all-deleted:${rec.id}`,[],{}),ep=probes[0].p.slice();
  if(!empty.resolveSphere(ep,r,8))allDeleteReleased++;
}
check(rooms.length===115,`shipped interior population ${rooms.length}, expected 115`);
check(doorDeleteReleased===rooms.length,`door delete control released ${doorDeleteReleased}/${rooms.length}`);
check(allDeleteReleased===rooms.length,`shell delete control released ${allDeleteReleased}/${rooms.length}`);

const report={
  schema:'elder-souls/w1-30-traversal-controls@1',
  result:failures.length?'RED':'GREEN',
  jump:{frames:jump.action.length,launchY:jump.launchY,minY:+jump.min.toFixed(4),maxY:+jump.max.toFixed(4),endY:+jump.end.toFixed(4),
    deleteControlMinY:+jumpDeleted.min.toFixed(4),deleteControlEndY:+jumpDeleted.end.toFixed(4)},
  interiors:{population:rooms.length,wallSamples,doorSamples,npcSamples,doorDeleteReleased,allDeleteReleased},
  failures,
};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
