#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const OUTDIR = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09');
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const PROBES = {

rollspam() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  const q = [{f:0, move:[0,1]}];
  for (let f = 1; f <= 900; f++) q.push({ f, press:['roll'] }, { f: f+0.5|0, release:['roll'] });
  H.queueInputs(q.map(e=>({...e, f: Math.round(e.f)})));
  const rolls=[], stam=[], drops=[];
  let prevState='IDLE', prevDrops=0;
  for (let i=1;i<=900;i++){ H.stepFrames(1); const c=cs();
    stam.push(+c.player.stamina.toFixed(3));
    if (c.player.state==='ROLL_STARTUP' && prevState!=='ROLL_STARTUP') rolls.push(i);
    if (c.player.stamina_drops > prevDrops) drops.push(i);
    prevDrops = c.player.stamina_drops; prevState = c.player.state; }
  const cad=[]; for(let i=1;i<rolls.length;i++) cad.push(rolls[i]-rolls[i-1]);
  return { roll_start_frames: rolls, cadence: cad, first_drop_frame: drops[0]||null,
           drops_total: drops.length, stamina_at_frames: { f262: stam[261], f314: stam[313], f366: stam[365] },
           stamina_min: Math.min(...stam), stamina_series_head: stam.slice(0,400),
           exhausted_ever: null };
},

guardbreak() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = {};
  const run = (preSpend) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({ shield: 'marsh_oak_medium' });
    H.spawn('inf_trash', 0, 1.6, { as: 'E' }); H.stepFrames(4);
    const q=[{f:0,move:[0,1]}];
    for (let n=0;n<preSpend;n++){ q.push({f:1+n*53, press:['roll']}, {f:3+n*53, release:['roll']}); }
    q.push({f:1+preSpend*53, press:['block']}, {f:400, release:['block']});
    H.queueInputs(q);
    H.queueEnemyScript('E', [{ f: 10 + preSpend*53, move: 'chop' }]);
    const rows=[]; let prevS=null, prevSt=null;
    for(let i=1;i<=400;i++){ H.stepFrames(1); const c=cs();
      if (prevSt!==c.player.state) rows.push({f:i, st:c.player.state, stam:+c.player.stamina.toFixed(2)});
      prevSt=c.player.state; prevS=c.player.stamina; }
    const gb = rows.filter(r=>r.st==='GUARD_BREAK');
    const after = gb.length ? rows.find(r=>r.f>gb[0].f) : null;
    return { pre_rolls: preSpend, transitions: rows.slice(0,24),
             guard_break_at: gb.length?gb[0].f:null,
             guard_break_len: (gb.length&&after)?after.f-gb[0].f:null,
             min_stamina: Math.min(...rows.map(r=>r.stam)) };
  };
  R.no_prespend = run(0);
  R.four_rolls = run(4);
  R.five_rolls = run(5);
  return R;
},

zerogate() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = { drain: null, tries: {} };
  // drain to EXACTLY 0 with rolls then attacks
  const drain = (extra) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setEquipLoad(15); H.setLoadout({weapon:'dagger'});
    H.stepFrames(6);
    const q=[{f:0,move:[0,0]}];
    for (let n=0;n<12;n++) q.push({f:1+n*43, press:['light']}, {f:3+n*43, release:['light']});
    if (extra) { q.push({f:1+12*43, press:[extra]}, {f:3+12*43, release:[extra]}); }
    H.queueInputs(q);
    const states=[]; let minS=999, atPress=null;
    for(let i=1;i<=700;i++){ H.stepFrames(1); const c=cs(); minS=Math.min(minS,c.player.stamina);
      if(i===1+12*43) atPress=+c.player.stamina.toFixed(3);
      if(i>=1+12*43) states.push(c.player.state); }
    return { min_stamina: minS, stamina_at_press: atPress, states_after:[...new Set(states)],
             drops: cs().player.stamina_drops, pos_moved: cs().player.pos };
  };
  R.drain = drain(null);
  for (const a of ['light','heavy','roll','sprint','parry','block','use_item','jump'])
    R.tries[a] = drain(a);
  // free actions at low stamina: walking / turning
  H.setSeed(9); H.loadState('arena_flat'); H.setLoadout({weapon:'dagger'}); H.stepFrames(6);
  const q2=[{f:0,move:[0,0]}];
  for (let n=0;n<12;n++) q2.push({f:1+n*43, press:['light']}, {f:3+n*43, release:['light']});
  q2.push({f:1+12*43, move:[0,1]});
  H.queueInputs(q2);
  const p0=[]; for(let i=1;i<=700;i++){ H.stepFrames(1); if(i>=1+12*43) p0.push(cs().player.pos.slice()); }
  R.walk_at_low = { moved_m: +Math.hypot(p0[p0.length-1][0]-p0[0][0], p0[p0.length-1][2]-p0[0][2]).toFixed(3) };
  return R;
},

lockon2() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const DIRS = [[0,1],[0.7071,0.7071],[1,0],[0.7071,-0.7071],[0,-1],[-0.7071,-0.7071],[-1,0],[-0.7071,0.7071]];
  const R = { m4: [], m8: null };
  for (const camYaw of [0,45,90,135,180,225,270,315]) {
    for (let di=0; di<8; di++) {
      H.setSeed(77); H.loadState('arena_flat');
      H.spawn('dummy_passive', 0, 6, { as: 'T' }); H.stepFrames(4);
      try { H.camera({ mode:'orbit', yaw: camYaw }); } catch(e){}
      try { H.lockOn('T'); } catch(e){}
      H.stepFrames(2);
      const p0 = cs().player.pos.slice();
      H.queueInputs([{f:0, move:DIRS[di]}, {f:1, press:['roll']}, {f:3, release:['roll']}, {f:4, move:[0,0]}]);
      let end=null;
      for(let i=1;i<=120;i++){ H.stepFrames(1); const c=cs(); if(i>4 && !c.player.move){ end=c.player.pos.slice(); break; } }
      const p1 = end || cs().player.pos.slice();
      const dx=p1[0]-p0[0], dz=p1[2]-p0[2];
      R.m4.push({cam_yaw:camYaw, dir:di, angle:+(((Math.atan2(dx,dz)*180/Math.PI)+360)%360).toFixed(2), dist:+Math.hypot(dx,dz).toFixed(4)});
    }
  }
  // M8: compare hit boundary locked vs unlocked WITH THE SAME PLAYER YAW
  const sweep = (lock) => {
    const out=[];
    for (let x=1.05; x<=1.20001; x+=0.005) {
      const off=+x.toFixed(4);
      H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({weapon:'straight-sword'});
      H.spawn('dummy_passive', off, 1.6, {as:'T'}); H.stepFrames(6);
      if (lock) { try{H.lockOn('T');}catch(e){} H.stepFrames(1); }
      const yaw0 = cs().player.yaw_deg;
      H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
      let hp0=null,hit=false,yawA=null;
      for(let k=0;k<110;k++){ H.stepFrames(1); const c=cs();
        const g=H.getHitGeometry(); const me=g.actors.find(a=>a.id==='P');
        if(me.hitbox_active && yawA===null) yawA=c.player.yaw_deg;
        const e=c.enemies.find(y=>y.id==='T'); if(!e)break;
        if(hp0===null)hp0=e.hp; if(e.hp<hp0){hit=true;break;} }
      out.push({offset_m:off, hit, yaw_at_press:+yaw0.toFixed(3), yaw_at_active:yawA===null?null:+yawA.toFixed(3)});
    }
    return out;
  };
  const un=sweep(false), lk=sweep(true);
  R.m8 = { unlocked:un, locked:lk,
    yaw_differs: un.map((u,i)=>Math.abs(u.yaw_at_active-lk[i].yaw_at_active)).filter(d=>d>0.01).length,
    outcome_identical: JSON.stringify(un.map(x=>x.hit))===JSON.stringify(lk.map(x=>x.hit)) };
  return R;
},

a10() {
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = {};
  H.setSeed(5); H.loadState('arena_flat');
  H.spawn('inf_trash', 0, 2.0, { as:'E' }); H.stepFrames(4);
  try { H.aggro('E'); } catch(e){}
  H.stepFrames(4);
  const before = (typeof H.getDialogueState==='function') ? H.getDialogueState() : null;
  H.queueInputs([{f:1, press:['interact']}, {f:2, release:['interact']}]);
  const seq=[]; for(let i=1;i<=60;i++){ H.stepFrames(1); seq.push(cs().player.state); }
  R.tap_interact_in_combat = { states:[...new Set(seq)] };
  R.quest_topics = (()=>{ try { const q=H.getQuestState(); return { topicsKnown:(q.topicsKnown||[]).length }; } catch(e){ return {err:String(e.message||e)}; } })();
  R.dialogue_api = ['getDialogueState','openDialogue','getTopics'].filter(m=>typeof H[m]==='function');
  return R;
},

};
const which = String(args.probe || 'all');
const list = which === 'all' ? Object.keys(PROBES) : which.split(',');
for (const name of list) {
  const t0=Date.now(); process.stderr.write(`[criticD] ${name} ...\n`);
  let res; try { res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`); }
  catch(e){ res = { error: String(e.message||e) }; }
  fs.writeFileSync(path.join(OUTDIR, `critic-${name}.json`), JSON.stringify(res, null, 1));
  process.stderr.write(`[criticD] ${name} ${(Date.now()-t0)/1000}s\n`);
}
await handle.close();
