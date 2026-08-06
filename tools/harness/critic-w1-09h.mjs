#!/usr/bin/env node
// critic-w1-09h.mjs — RI-CMB04 M1 (bone attachment), M5 (de-dup), M6 (resolution order),
// M7 (render decoupling). Written by the W1-09 critic.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09/critic-cmb04rest.json');
const handle = await launchGame(args);
const out = { m7: [] };

const SWEEP = `(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState(); const o=[];
  for (const off of [1.100,1.110,1.115,1.120,1.125,1.130,1.140]){
    H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({weapon:'straight-sword'});
    H.spawn('dummy_passive',off,1.6,{as:'T'}); H.stepFrames(6);
    H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
    let hp0=null,hit=false;
    for(let k=0;k<110;k++){ H.stepFrames(1); const e=cs().enemies.find(y=>y.id==='T'); if(!e)break;
      if(hp0===null)hp0=e.hp; if(e.hp<hp0){hit=true;break;} }
    o.push(hit?1:0); }
  return o; })()`;

for (const rate of [0, 30, 144]) {
  await handle.hOpt('setRenderRate', rate);
  const r = await handle.page.evaluate(SWEEP);
  out.m7.push({ render_rate: rate, offsets: [1.100,1.110,1.115,1.120,1.125,1.130,1.140], vector: r.join('') });
  console.log('rate', rate, r.join(''));
}
await handle.hOpt('setRenderRate', 0);

const rest = await handle.page.evaluate(`(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState(); const R={};
  // M1 — hurtbox capsule midpoint vs its declared parent bone origin, over a full roll
  H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(4);
  H.queueInputs([{f:0,move:[0,1]},{f:1,press:['roll']},{f:3,release:['roll']}]);
  const drift={}, travel={}, prev={}; const poses=[];
  for(let i=0;i<56;i++){ H.stepFrames(1);
    const g=H.getHitGeometry(); const me=g.actors.find(a=>a.id==='P');
    const bones={}; for(const b of me.bones) bones[b.id]=b.o;
    const sig=[];
    for(const h of me.hurtboxes){
      const mid=[(h.a[0]+h.b[0])/2,(h.a[1]+h.b[1])/2,(h.a[2]+h.b[2])/2];
      const o=bones[h.parent_bone];
      const d=Math.hypot(mid[0]-o[0],mid[1]-o[1],mid[2]-o[2]);
      (drift[h.id]=drift[h.id]||[]).push(d);
      if(prev[h.id]) travel[h.id]=(travel[h.id]||0)+Math.hypot(mid[0]-prev[h.id][0],mid[1]-prev[h.id][1],mid[2]-prev[h.id][2]);
      prev[h.id]=mid; sig.push(mid.map(v=>+v.toFixed(3)).join(','));
    }
    poses.push(sig.join('|'));
  }
  R.m1 = Object.keys(drift).map(id=>({hurtbox:id,min_m:+Math.min(...drift[id]).toFixed(6),
    variation_m:+(Math.max(...drift[id])-Math.min(...drift[id])).toFixed(6),
    world_travel_m:+(travel[id]||0).toFixed(3)}));
  R.m1_distinct_poses = new Set(poses).size; R.m1_frames = poses.length;
  // M5 — one swing over a fat target, then a 3-hit chain
  H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({weapon:'ultra-greatsword'});
  H.spawn('dummy_passive',0,1.6,{as:'T'}); H.stepFrames(6);
  H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
  let prevHp=null; const ev1=[];
  for(let k=1;k<=250;k++){ H.stepFrames(1); const e=cs().enemies.find(y=>y.id==='T');
    if(prevHp!==null&&e.hp!==prevHp) ev1.push({f:k,dmg:+(prevHp-e.hp).toFixed(2)}); prevHp=e.hp; }
  R.m5_single = ev1;
  H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({weapon:'straight-sword'});
  H.spawn('dummy_passive',0,1.6,{as:'T'}); H.stepFrames(6);
  H.queueInputs([{f:1,press:['light']},{f:3,release:['light']},{f:70,press:['light']},{f:72,release:['light']},{f:145,press:['light']},{f:147,release:['light']}]);
  prevHp=null; const ev3=[];
  for(let k=1;k<=400;k++){ H.stepFrames(1); const e=cs().enemies.find(y=>y.id==='T');
    if(prevHp!==null&&e.hp!==prevHp) ev3.push({f:k,dmg:+(prevHp-e.hp).toFixed(2)}); prevHp=e.hp; }
  R.m5_chain = ev3;
  // M6 — resolution order: block on axis, at 45 deg, at 75 deg, and i-frames plus a raised guard
  const face=(yawDeg, roll)=>{
    H.setSeed(1337); H.loadState('arena_flat'); H.teleport(0,0,{yaw:yawDeg});
    H.spawn('inf_trash',0,1.5,{as:'E'}); H.stepFrames(4);
    const q=[{f:1,press:['block']},{f:400,release:['block']}];
    if(roll) q.push({f:60,move:[0,1]},{f:61,press:['roll']},{f:63,release:['roll']});
    H.queueInputs(q); H.queueEnemyScript('E',[{f:5,move:'chop'}]);
    let s0=null,h0=null; const ev=[];
    for(let i=1;i<=200;i++){ H.stepFrames(1); const c=cs();
      if(s0!==null&&(Math.abs(s0-c.player.stamina)>0.4||h0!==c.player.hp))
        ev.push({f:i,dS:+(s0-c.player.stamina).toFixed(2),dHP:+(h0-c.player.hp).toFixed(2),st:c.player.state});
      s0=c.player.stamina; h0=c.player.hp; }
    return ev.slice(0,4);
  };
  R.m6 = { block_0deg: face(0,false), block_45deg: face(45,false), block_75deg: face(75,false), iframe_plus_block: face(0,true) };
  return R; })()`);
Object.assign(out, rest);
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log('M7 identical:', new Set(out.m7.map(r => r.vector)).size === 1);
console.log('M1 distinct poses', out.m1_distinct_poses, '/', out.m1_frames,
  'max variation_m', Math.max(...out.m1.map(x => x.variation_m)),
  'max min_m', Math.max(...out.m1.map(x => x.min_m)));
console.log('M5 single', JSON.stringify(out.m5_single), 'chain', JSON.stringify(out.m5_chain));
console.log('M6', JSON.stringify(out.m6));
await handle.close();
