#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const which = String(args.probe || 'all');
const OUTDIR = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09');
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);

const PROBES = {

// --- motion: does the blade MOVE like a swing?  Per-frame tip travel over the whole clip. ---
motion() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const DECL = { dagger:14.0, 'straight-sword':18.5, spear:21.0, axe:17.0, halberd:22.0, greatsword:23.5, 'ultra-greatsword':26.0 };
  const R = { classes: [] };
  for (const w of Object.keys(DECL)) {
    for (const mv of ['light','heavy']) {
      H.setSeed(3); H.loadState('arena_flat'); H.setLoadout({ weapon: w }); H.stepFrames(6);
      H.queueInputs([{f:1, press:[mv]}, {f:3, release:[mv]}]);
      const rows = [];
      let press = null;
      for (let k = 1; k <= 400; k++) {
        H.stepFrames(1);
        const g = H.getHitGeometry(); const me = g.actors.find(a=>a.id==='P'); const c = cs();
        if (press === null && c.player.state !== 'IDLE') press = k;
        const wp = me.weapon;
        const tipT = Math.hypot(wp.now[3]-wp.prev[3], wp.now[4]-wp.prev[4], wp.now[5]-wp.prev[5]);
        // angle swept by the capsule axis this frame
        const v1=[wp.prev[3]-wp.prev[0],wp.prev[4]-wp.prev[1],wp.prev[5]-wp.prev[2]];
        const v2=[wp.now[3]-wp.now[0],wp.now[4]-wp.now[1],wp.now[5]-wp.now[2]];
        const n1=Math.hypot(...v1), n2=Math.hypot(...v2);
        const dot=(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/(n1*n2||1);
        const ang = Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
        rows.push({ f: press===null?null:k-press+1, state: c.player.state, active: !!me.hitbox_active,
                    tip: +tipT.toFixed(5), ang: +ang.toFixed(3) });
        if (press !== null && k > press && !c.player.move) break;
      }
      const startup = rows.filter(r=>r.state==='ATK_STARTUP');
      const active  = rows.filter(r=>r.active);
      const recover = rows.filter(r=>r.state==='ATK_RECOVER');
      const sum = a => +a.reduce((x,y)=>x+y,0).toFixed(4);
      R.classes.push({ weapon: w, move: mv,
        declared_peak_tip_speed_mps: DECL[w],
        measured_peak_tip_speed_mps: +(Math.max(...active.map(r=>r.tip))*60).toFixed(2),
        ratio_measured_over_declared: +((Math.max(...active.map(r=>r.tip))*60)/DECL[w]).toFixed(3),
        startup_frames: startup.length, active_frames: active.length, recovery_frames: recover.length,
        tip_travel_startup_m: sum(startup.map(r=>r.tip)),
        tip_travel_active_m: sum(active.map(r=>r.tip)),
        tip_travel_recovery_m: sum(recover.map(r=>r.tip)),
        angle_startup_deg: sum(startup.map(r=>r.ang)),
        angle_active_deg: sum(active.map(r=>r.ang)),
        angle_recovery_deg: sum(recover.map(r=>r.ang)),
        mean_tip_recovery_m: recover.length ? +(sum(recover.map(r=>r.tip))/recover.length).toFixed(5) : null,
        mean_tip_active_m: active.length ? +(sum(active.map(r=>r.tip))/active.length).toFixed(5) : null,
        profile: rows.map(r=>r.tip) });
    }
  }
  return R;
},

// --- block, guard break, zero-stamina gate, jump ---
block() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = {};
  // jump: does anything happen at all?
  H.setSeed(9); H.loadState('arena_flat'); H.stepFrames(6);
  const before = cs();
  H.queueInputs([{f:1, press:['jump']}, {f:4, release:['jump']}]);
  const st = [];
  for (let i=1;i<=90;i++){ H.stepFrames(1); const c=cs(); st.push({s:c.player.state, y:+c.player.pos[1].toFixed(4), stam:c.player.stamina}); }
  R.jump = { states: [...new Set(st.map(x=>x.s))], max_y: Math.max(...st.map(x=>x.y)),
             stamina_start: before.player.stamina, stamina_min: Math.min(...st.map(x=>x.stam)) };
  // zero-stamina gate
  H.setSeed(9); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  const ip=[{f:0,move:[0,1]}]; for(let n=0;n<8;n++){ip.push({f:1+n*53,press:['roll']});ip.push({f:3+n*53,release:['roll']});}
  H.queueInputs(ip);
  let minS=999; const drops=[];
  for(let i=1;i<=500;i++){ H.stepFrames(1); const c=cs(); minS=Math.min(minS,c.player.stamina); }
  R.gate_prep = { min_stamina: minS, stamina_drops: cs().player.stamina_drops };
  // drain to (nearly) zero then try every action
  const tryAt = (act) => {
    H.setSeed(9); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
    const q=[{f:0,move:[0,1]}]; for(let n=0;n<6;n++){q.push({f:1+n*53,press:['roll']});q.push({f:3+n*53,release:['roll']});}
    q.push({f:1+6*53, press:[act]}); q.push({f:3+6*53, release:[act]});
    H.queueInputs(q);
    const seen=[]; let stamAt=null;
    for(let i=1;i<=460;i++){ H.stepFrames(1); const c=cs();
      if(i===1+6*53) stamAt=c.player.stamina;
      if(i>=1+6*53) seen.push(c.player.state); }
    return { stamina_at_press: stamAt, states_after: [...new Set(seen)], drops: cs().player.stamina_drops };
  };
  R.gate = {};
  for (const a of ['roll','light','heavy','sprint','jump','parry','use_item','block','interact','lock_on']) R.gate[a] = tryAt(a);
  // block formula + guard break, driven by a scripted enemy attack
  R.block = [];
  for (const shield of ['chitin_buckler','marsh_oak_medium','naga_tower']) {
    H.setSeed(9); H.loadState('arena_flat');
    let lo=null; try { lo = H.setLoadout({ shield }); } catch(e){ R.block.push({shield, error:String(e.message||e)}); continue; }
    H.spawn('inf_trash', 0, 1.6, { as: 'E' });
    H.stepFrames(4);
    H.queueInputs([{f:1, press:['block']}, {f:400, release:['block']}]);
    try { H.queueEnemyScript('E', [{ f: 20, move: 'chop' }]); } catch(e) { /* try any attack */ }
    const rows=[]; let prevS=null, prevH=null;
    for(let i=1;i<=200;i++){ H.stepFrames(1); const c=cs();
      if(prevS!==null && (c.player.stamina!==prevS || c.player.hp!==prevH))
        rows.push({f:i, dS:+(prevS-c.player.stamina).toFixed(3), dHP:+(prevH-c.player.hp).toFixed(3), state:c.player.state});
      prevS=c.player.stamina; prevH=c.player.hp; }
    R.block.push({ shield, loadout: lo, events: rows.filter(r=>Math.abs(r.dS)>0.4||r.dHP!==0).slice(0,10) });
  }
  return R;
},

// --- lock-on M4 (directional roll, camera-invariant) + M8 (no aim assist) ---
lockon() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { m4: [], m8: null, m3: null };
  const DIRS = [[0,1],[0.7071,0.7071],[1,0],[0.7071,-0.7071],[0,-1],[-0.7071,-0.7071],[-1,0],[-0.7071,0.7071]];
  for (const camYaw of [0,45,90,135,180,225,270,315]) {
    for (let di = 0; di < 8; di++) {
      H.setSeed(77); H.loadState('arena_flat');
      const eid = H.spawn('dummy_passive', 0, 5, { as: 'T' });
      H.stepFrames(4);
      try { H.camera({ mode: 'orbit', yaw: camYaw }); } catch(e){}
      try { H.lockOn('T'); } catch(e){}
      H.stepFrames(2);
      const p0 = cs().player.pos.slice();
      H.queueInputs([{f:0, move: DIRS[di]}, {f:1, press:['roll']}, {f:3, release:['roll']}]);
      for (let i=0;i<60;i++) H.stepFrames(1);
      const p1 = cs().player.pos.slice();
      const dx = p1[0]-p0[0], dz = p1[2]-p0[2];
      R.m4.push({ cam_yaw: camYaw, dir_index: di,
        angle_deg: +(((Math.atan2(dx, dz)*180/Math.PI)+360)%360).toFixed(2),
        dist_m: +Math.hypot(dx,dz).toFixed(4), locked: cs().lock.target });
    }
  }
  // M8: boundary sharpness locked vs unlocked
  const sweep = (lock) => {
    const out=[];
    for (let x = 1.05; x <= 1.20001; x += 0.005) {
      const off=+x.toFixed(4);
      H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({weapon:'straight-sword'});
      H.spawn('dummy_passive', off, 1.6, {as:'T'}); H.stepFrames(6);
      if (lock) { try { H.lockOn('T'); } catch(e){} H.stepFrames(1); }
      H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
      let hp0=null,hit=false;
      for(let k=0;k<110;k++){ H.stepFrames(1); const e=cs().enemies.find(y=>y.id==='T'); if(!e)break;
        if(hp0===null)hp0=e.hp; if(e.hp<hp0){hit=true;break;} }
      out.push({offset_m:off, hit});
    }
    return out;
  };
  const un = sweep(false), lk = sweep(true);
  R.m8 = { unlocked: un, locked: lk, identical: JSON.stringify(un.map(x=>x.hit))===JSON.stringify(lk.map(x=>x.hit)) };
  return R;
},

// --- RI-CMB11 M1/M3/M4: zero-frame dispatch, off-by-one, buffer semantics ---
latency() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const BUTTONS = ['light','heavy','roll','block','parry','sprint','jump','use_item','interact','lock_on','two_hand','swap_right','swap_left','menu'];
  const R = { m1: [], m4: {}, m1_repeat: null };
  for (const b of BUTTONS) {
    H.setSeed(31); H.loadState('arena_flat'); H.stepFrames(8);
    const before = cs();
    H.queueInputs([{ f: 0, press: [b] }]);
    H.stepFrames(1);
    const after = cs();
    R.m1.push({ button: b, state_before: before.player.state, state_after: after.player.state,
      anim_frame_after: after.player.anim_frame, changed: before.player.state !== after.player.state,
      move_after: !!after.player.move });
  }
  // repeat the dispatch check at 200 actionable frames for `light`
  let fails = 0, n = 0;
  for (let t = 0; t < 200; t++) {
    H.setSeed(31); H.loadState('arena_flat'); H.stepFrames(8 + t);
    H.queueInputs([{ f: 0, press: ['light'] }]);
    H.stepFrames(1);
    const a = cs(); n++;
    if (a.player.state !== 'ATK_STARTUP' || a.player.anim_frame !== 1) fails++;
  }
  R.m1_repeat = { trials: n, failures: fails };
  // M4 buffer semantics on a LIGHT roll (52 f)
  const bufTest = (pressF, btn) => {
    H.setSeed(31); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(8);
    H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['roll']}, {f:3, release:['roll']},
                   {f:1+pressF, press:[btn]}, {f:3+pressF, release:[btn]}]);
    const seq=[];
    for(let i=1;i<=200;i++){ H.stepFrames(1); seq.push(cs().player.state); }
    const idx = seq.findIndex((s,i)=> i>55 && s!=='IDLE' && s!=='WALK' && s!=='RUN');
    return { press_at_anim_f: pressF, executed_at_anim_f: idx<0?null:idx+1-1, state: idx<0?null:seq[idx] };
  };
  R.m4.press36 = bufTest(36, 'light');
  R.m4.press44 = bufTest(44, 'light');
  R.m4.press45 = bufTest(45, 'light');
  R.m4.press49 = bufTest(49, 'light');
  R.m4.press52 = bufTest(52, 'light');
  // one-slot: roll at 45 then light at 48 -> light wins
  H.setSeed(31); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(8);
  H.queueInputs([{f:0,move:[0,1]},{f:1,press:['roll']},{f:3,release:['roll']},
                 {f:46,press:['roll']},{f:47,release:['roll']},
                 {f:49,press:['light']},{f:50,release:['light']}]);
  const sq=[]; for(let i=1;i<=220;i++){ H.stepFrames(1); sq.push(cs().player.state); }
  R.m4.one_slot = { after_roll: [...new Set(sq.slice(55,140))] };
  // mash the same button 6 times during recovery -> exactly one action
  H.setSeed(31); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(8);
  const mash=[{f:0,move:[0,1]},{f:1,press:['roll']},{f:3,release:['roll']}];
  for(let n2=0;n2<6;n2++){ mash.push({f:45+n2,press:['light']}); mash.push({f:45+n2+0.0,release:['light']}); }
  H.queueInputs(mash.map(e=>({...e,f:Math.round(e.f)})));
  const sq2=[]; for(let i=1;i<=300;i++){ H.stepFrames(1); sq2.push(cs().player.state); }
  let atk=0; for(let i=1;i<sq2.length;i++) if(sq2[i]==='ATK_STARTUP'&&sq2[i-1]!=='ATK_STARTUP') atk++;
  R.m4.mash_attacks = atk;
  return R;
},

// --- parley: S13 / AR-2 B12 / A10 ---
parley() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { classes: [], topic_list_mid_fight: null, frames: null };
  const CLASSES = ['inf_trash','beast_slitherfang','champion_hist_marked','dummy_passive'];
  for (const id of CLASSES) {
    H.setSeed(21); H.loadState('arena_flat');
    let eid; try { eid = H.spawn(id, 0, 2.0, { as: 'E' }); } catch(e) { R.classes.push({id, error:String(e.message||e)}); continue; }
    H.setWorldKnowledge({ gold: 5000, dispositions: { E: 90 }, topicsKnown: ['tribute','the-hist','warden-name'] });
    H.stepFrames(4);
    try { H.aggro('E'); } catch(e){}
    H.stepFrames(4);
    H.queueInputs([{f:1, press:['interact']}, {f:120, release:['interact']}]);
    const seq=[]; let end=null;
    for(let i=1;i<=400;i++){ H.stepFrames(1); const c=cs();
      seq.push(c.player.state);
      const e=c.enemies.find(x=>x.id==='E');
      if(e && (e.state==='YIELDED'||e.state==='DEAD') && end===null) end={f:i, state:e.state}; }
    const startAt = seq.findIndex(s=>s.startsWith('PARLEY'));
    const endAt = (()=>{ for(let i=seq.length-1;i>=0;i--) if(seq[i].startsWith('PARLEY')) return i; return -1; })();
    R.classes.push({ id, parley_states: [...new Set(seq.filter(s=>s.startsWith('PARLEY')))],
      parley_start_f: startAt<0?null:startAt+1, parley_end_f: endAt<0?null:endAt+1,
      parley_len: (startAt<0||endAt<0)?null:endAt-startAt+1,
      resolved: end, deaths: cs().enemies.filter(x=>x.id==='E'&&x.hp<=0).length });
  }
  // uncancellability of parley + the resolving frame
  H.setSeed(21); H.loadState('arena_flat'); H.spawn('inf_trash', 0, 2.0, { as: 'E' });
  H.setWorldKnowledge({ gold: 5000, dispositions: { E: 90 } });
  H.stepFrames(4); try{H.aggro('E');}catch(e){} H.stepFrames(4);
  H.queueInputs([{f:1, press:['interact']}, {f:120, release:['interact']},
                 {f:10, press:['roll']}, {f:12, release:['roll']},
                 {f:30, press:['light']}, {f:32, release:['light']}]);
  const seq2=[]; const ev=[];
  for(let i=1;i<=300;i++){ H.stepFrames(1); const c=cs(); seq2.push(c.player.state);
    const e=c.enemies.find(x=>x.id==='E'); if(e) ev.push(e.state); }
  R.frames = { player_states: [...new Set(seq2)], enemy_states: [...new Set(ev)],
               parley_run: seq2.map((s,i)=>s.startsWith('PARLEY')?i+1:null).filter(x=>x),
               first_yield_f: ev.findIndex(s=>s==='YIELDED')+1 || null };
  return R;
},

};

const list = which === 'all' ? Object.keys(PROBES) : which.split(',');
for (const name of list) {
  if (!PROBES[name]) { console.error('no such probe: ' + name); continue; }
  const t0=Date.now();
  process.stderr.write(`[criticC] ${name} ...\n`);
  let res;
  try { res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`); }
  catch (e) { res = { error: String(e.message || e) }; }
  fs.writeFileSync(path.join(OUTDIR, `critic-${name}.json`), JSON.stringify(res, null, 1));
  process.stderr.write(`[criticC] ${name} done ${(Date.now()-t0)/1000}s\n`);
}
await handle.close();
