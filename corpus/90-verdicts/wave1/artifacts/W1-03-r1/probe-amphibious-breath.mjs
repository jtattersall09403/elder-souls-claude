import { readFileSync } from 'node:fs';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
import { Traversal } from '/home/user/elder-souls-claude/game/src/sim/traversal.js';
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const R='/home/user/elder-souls-claude/';
const rd=(p)=>JSON.parse(readFileSync(R+p,'utf8'));
const field=new WorldField(rd('game/data/world/terrain.json'),rd('game/data/world/regions.json'),rd('game/data/world/water.json'));
const TRAV=rd('game/data/world/traversal.json');
console.log('breath_max_s in shipped traversal.json =', TRAV.water.breath_max_s);
function dive(race,frames){
  const t=new Traversal(JSON.parse(JSON.stringify(TRAV)),field);
  const x=20,z=20;
  const p={pos:[x,field.heightAt(x,z),z],yaw:0,hp:1000,hpMax:1000,stamina:1e9,staminaMax:1e9,state:'IDLE',frameNow:0,regenBlockUntil:0};
  const trace=[];
  for(let i=0;i<frames;i++){p.frameNow=i;const px=p.pos[0],pz=p.pos[2];t.step(p,px,pz,0,false,null,race);
    if(i%1200===0||i===frames-1)trace.push({f:i,sub:t.submerged,breath:+t.breath.toFixed(2),hp:+p.hp.toFixed(1),state:p.state});}
  return {trace,band:t.band,depth:+t.depth.toFixed(1)};
}
const F=60*70; // 70 s -- past a 60 s meter
const n=dive('nord',F), s=dive('saxhleel',F);
console.log('NORD    ',JSON.stringify(n));
console.log('SAXHLEEL',JSON.stringify(s));
console.log('\nprivilege 1 (breath_max = infinity):',
  n.trace.at(-1).breath===0 && s.trace.at(-1).breath===TRAV.water.breath_max_s ? 'HELD' : 'CHECK',
  ' nord_breath_end='+n.trace.at(-1).breath, ' sax_breath_end='+s.trace.at(-1).breath,
  ' nord_hp='+n.trace.at(-1).hp, ' sax_hp='+s.trace.at(-1).hp);
// RI-WLD10 §3: breath_max = 40 + 2*(END-10), capped 100. Shipped is a flat constant.
console.log('\nEND-scaling check: is breath_max derived from a sheet anywhere in game/src?');
