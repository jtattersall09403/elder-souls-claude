#!/usr/bin/env node
// cmb-poise.mjs — RI-CMB05 M3–M7, the checks the W1-09 verdict scored `partial`.
//
// The verdict scored RI-CMB05 23/100 with "M3 fails on measurement (staggers 50 f / 70 f
// against 44 f / 64 f); M4–M7 (hyperarmour, backstab, parry window, riposte) were not
// exercised". M3 is fixed in the engine (hitstop now lives outside the hitstun state — see
// CombatBody.queueReaction). This tool measures M3 at BOTH tiers and then runs M4–M7, all of
// which the harness already supported.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'reports/w1-09/poise.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);

const res = await handle.page.evaluate(`(function(){
  const H = window.__HARNESS; const cs = () => H.getCombatState(); const R = {};
  const runs = (a) => { const o=[]; let cur=null,n=0;
    for (const x of a){ if(x===cur) n++; else { if(cur!==null) o.push([cur,n]); cur=x; n=1; } }
    if(cur!==null) o.push([cur,n]); return o; };

  // ---- M3, MEDIUM (44 f@60). The player's pool is 20 + armour_poise 28 = 48 and a chop's 32
  //      poise damage is 24.5 after resist, so ONE chop cannot break it. RI-CMB09 §4 halves
  //      poise while exhausted, which doubles the incoming figure to 49.1 — so the fight's own
  //      rules give a medium stagger to a player who ran the bar to zero and then got hit.
  //      That is the path the exemplar's failure beat takes and it is measured here directly.
  R.m3_medium = (function(){
    H.setSeed(5); H.loadState('arena_champion'); H.lockOn('E1');
    H.teleport(0, 4.6-1.5, {yaw:0}); H.stepFrames(4);
    // sprint the bar to exactly 0
    H.queueInputs([{f:0,move:[0,1]},{f:1,press:['sprint']}]);
    for(let i=0;i<20;i++) H.stepFrames(1);
    H.queueInputs([{f:0,move:[0,0]},{f:0,release:['sprint']}]);
    let guard=0;
    while (cs().player.stamina > 0 && guard++ < 2000) { H.queueInputs([{f:0,move:[0,1]},{f:0,press:['sprint']}]); H.stepFrames(1); }
    H.queueInputs([{f:0,move:[0,0]},{f:0,release:['sprint']}]);
    H.teleport(0, 4.6-1.5, {yaw:0});
    const st0 = cs();
    H.queueEnemyScript('E1', [{f:6, move:'chop'}]);
    const st=[]; let pd=null;
    for(let i=1;i<=260;i++){ H.stepFrames(1); const c=cs(); st.push(c.player.state); if(pd===null && c.player.state==='STAGGER') pd=c.player.poise_health; }
    return { stamina_at_impact: st0.player.stamina, exhausted: st0.player.exhausted,
             state_runs: runs(st).slice(0,6), spec_f: 44 };
  })();

  // ---- M3, HEAVY (64 f@60): a greatsword R1 into the champion (poise damage 42) -----------
  R.m3_heavy = (function(){
    const out=[];
    for (const w of ['greatsword','ultra-greatsword']) {
      H.setSeed(5); H.loadState('arena_champion'); H.setLoadout({weapon:w}); H.lockOn('E1');
      H.teleport(0, 4.6-1.2, {yaw:0}); H.stepFrames(4);
      // The old cadence was one R1 every 200 frames. The champion's poise pool is 48 and it
      // REGENERATES between hits, so no two hits ever accumulated and 'stagger_lengths_f' came
      // back '[]' for both weapons — the 64 f spec was scored as measured when nothing had
      // staggered at all. A probe that passes on a broken build is worse than no probe. The
      // press is now a chain at the weapon's own cadence, and the probe FAILS LOUDLY if the
      // enemy never staggers rather than returning an empty list that reads like a pass.
      const q=[{f:1,move:[0,1]}]; for(let k=0;k<10;k++) q.push({f:2+k*60,press:['light']},{f:4+k*60,release:['light']});
      H.queueInputs(q);
      const st=[]; for(let i=1;i<=900;i++){ H.stepFrames(1); const e=cs().enemies[0]; st.push(e?e.state:'-'); }
      const rr = runs(st).filter((x)=>x[0]==='STAGGER');
      out.push({ weapon:w, stagger_lengths_f: rr.map((x)=>x[1]), spec_f: 64,
                 vacuous: rr.length === 0,
                 vacuous_note: rr.length === 0
                   ? 'NO STAGGER PRODUCED. This row measures nothing and must be read as a FAIL of RI-CMB05 M3 heavy, not as a pass.'
                   : null });
    }
    return out;
  })();

  // ---- M3's other half: a target ALREADY staggered takes damage but the timer does NOT
  //      restart (RI-CMB05 §B, "what prevents infinite stunlock") ------------------------
  R.stunlock = (function(){
    H.setSeed(5); H.loadState('arena_champion'); H.setLoadout({weapon:'ultra-greatsword'}); H.lockOn('E1');
    H.teleport(0, 4.6-1.2, {yaw:0}); H.stepFrames(4);
    H.queueInputs([{f:1,press:['light']},{f:3,release:['light']},{f:170,press:['light']},{f:172,release:['light']},
                   {f:200,press:['light']},{f:202,release:['light']}]);
    const st=[]; let hits=0, prevHp=null;
    for(let i=1;i<=700;i++){ H.stepFrames(1); const e=cs().enemies[0];
      if(prevHp!==null && e.hp<prevHp) hits++; prevHp=e.hp; st.push(e.state); }
    return { enemy_state_runs: runs(st).slice(0,10), hits_landed: hits };
  })();

  // ---- M4 hyperarmour (RI-CMB05 §C): inside a declared window an R2 does not flinch ------
  R.m4_hyperarmour = (function(){
    const out=[];
    for (const inside of [true,false]) {
      H.setSeed(5); H.loadState('arena_champion'); H.setLoadout({weapon:'straight-sword'}); H.lockOn('E1');
      H.teleport(0, 4.6-1.6, {yaw:0}); H.stepFrames(4);
      // ss R2 hyperarmour window is f30-f62; the champion's chop lands on its own frame 69.
      const press = inside ? 69-40 : 69-100;
      H.queueEnemyScript('E1',[{f:6,move:'chop'}]);
      H.queueInputs([{f:Math.max(1,press),press:['heavy']},{f:Math.max(3,press+2),release:['heavy']}]);
      const st=[]; for(let i=1;i<=300;i++){ H.stepFrames(1); st.push(cs().player.state); }
      const hpEnd = cs().player.hp;
      out.push({ case: inside?'hit inside the HA window':'hit outside it', press_f: press,
                 states:[...new Set(st)], staggered: st.indexOf('STAGGER')>=0, hp: hpEnd,
                 // THE CONTROL HAS TO LAND. Round 2: "m4_hyperarmour's control case — 'hit
                 // outside the HA window' — reports hp: 620 of 620. The hit never landed. The
                 // probe cannot tell working hyperarmour from none." It was S26's hole showing
                 // up inside the hyperarmour instrument. The control is now asserted.
                 hit_landed: hpEnd < 620,
                 vacuous: !inside && hpEnd >= 620,
                 vacuous_note: (!inside && hpEnd >= 620)
                   ? 'CONTROL DID NOT LAND. With no hit outside the window there is nothing to compare the inside case against, so M4 measures nothing and must be read as a FAIL.'
                   : null });
    }
    return out;
  })();

  // ---- M5 backstab (RI-CMB05 §D): geometry + state, never a probability -----------------
  R.m5_backstab = (function(){
    const out=[];
    for (const [name, yaw, dist] of [['behind, 0.9 m', 0, 0.9], ['behind, 1.6 m', 0, 1.6],
                                     ['side, 0.9 m', 90, 0.9], ['front, 0.9 m', 180, 0.9]]) {
      H.setSeed(5); H.loadState('arena_champion'); H.lockOn(null); H.stepFrames(2);
      const rad = yaw*Math.PI/180;
      H.teleport(0 + Math.sin(rad)*dist, 4.6 + Math.cos(rad)*dist, { yaw: (yaw+180)%360 });
      H.stepFrames(4);
      H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
      const st=[]; let dmg=0, hp0=null;
      for(let i=1;i<=200;i++){ H.stepFrames(1); const e=cs().enemies[0]; if(hp0===null)hp0=e.hp; dmg=hp0-e.hp; st.push(cs().player.state); }
      out.push({ case:name, crit: st.indexOf('CRIT_ATTACK')>=0, states:[...new Set(st)], damage:+dmg.toFixed(1) });
    }
    return out;
  })();

  // ---- M6/M7 parry, the PARRIED state and the riposte -----------------------------------
  R.m6_parry = (function(){
    const out=[];
    for (const lead of [0, 6, 12, 18, 24, 30, 40]) {
      H.setSeed(5); H.loadState('arena_champion'); H.setLoadout({weapon:'straight-sword', shield:'marsh_oak_medium'}); H.lockOn('E1');
      H.teleport(0, 4.6-1.6, {yaw:0}); H.stepFrames(4);
      H.queueEnemyScript('E1',[{f:6,move:'chop'}]);
      // chop's first active frame is its own anim frame 69, i.e. absolute frame 6+68
      const p = 6 + 68 - lead;
      H.queueInputs([{f:p,press:['parry']},{f:p+2,release:['parry']}]);
      const es=[], ps=[]; let hp0=null, dmg=0, pressed=false, minD=99, kAtPress=null, kf=0;
      for(let i=1;i<=300;i++){
        // A PARRIER STEPS IN. RI-CMB05 §D prices the riposte at 'backstab.max_distance_m'
        // = 1.20 m and this probe starts the player at 1.60 m; the old version pressed R1 from
        // where it stood, 'criticalAvailable()' returned null on distance, and the row read
        // 'riposted: false' for a build in which the riposte works. Measured: availability
        // turns on at exactly k=7 (the window's own first frame) once the player is inside
        // 1.20 m. Walking in is what a player does and it is what the probe does.
        const c0 = cs(); const e0 = c0.enemies[0];
        if (e0 && e0.state === 'PARRIED') kf++; 
        if (e0 && e0.state === 'PARRIED' && !pressed) {
          const d = e0.dist_m;
          // The window is f7..f52 of the PARRIED state. Pressing before f7 does not fire a
          // riposte, it fires an ordinary R1 — which is what the previous version measured
          // (damage 63, riposted false) and mistook for "the riposte does not exist".
          if (d > 1.10) H.queueInputs([{f:0, move:[0,1]}]);
          else if (kf >= 7 && c0.player.move === null) { H.queueInputs([{f:0, move:[0,0], press:['light']}, {f:1, release:['light']}]); pressed = true; kAtPress = kf; }
          else H.queueInputs([{f:0, move:[0,0]}]);
        }
        H.stepFrames(1); const c=cs(); const e=c.enemies[0];
        if(hp0===null)hp0=e.hp; dmg=hp0-e.hp; es.push(e.state); ps.push(c.player.state);
        if(e.dist_m<minD) minD=e.dist_m;
      }
      const parried = runs(es).filter((x)=>x[0]==='PARRIED');
      out.push({ press_lead_f: lead, parried: parried.length>0, parried_len_f: parried.length?parried[0][1]:null,
                 spec_parried_f: 56, riposted: ps.indexOf('CRIT_ATTACK')>=0, damage:+dmg.toFixed(1),
                 closed_to_m: +minD.toFixed(2), riposte_max_distance_m: 1.20,
                 pressed_at_parried_frame: kAtPress, riposte_window_f: [7,52] });
    }
    return out;
  })();
  return R;
})()`);

fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res, null, 1));
await handle.close();
