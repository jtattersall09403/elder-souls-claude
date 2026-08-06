#!/usr/bin/env node
// cmb-actions.mjs — the five buttons the W1-09 verdict §2.3 found "accepted and inert".
//
//   "Jump costs 0, because jump does not exist. stamina.json:43 declares jump: 18. Measured:
//    pressing `jump` from ACTIONABLE produces no state change, max_y = 0.0000 over 90 frames,
//    and no stamina deduction. `two_hand`, `swap_right`, `swap_left` and `menu` are likewise
//    accepted and inert. This makes RI-CMB02 §C's jump-attack and two-handed modifier rows,
//    and RI-CMB01 §B's OVERLOADED jump-attack prohibition, structurally unmeasurable."
//
// Every probe below is written from the reference item, not from the implementation, and each
// one is a check that could not be run at all before.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const OUT = path.join(REPO_ROOT, 'reports/w1-09/actions.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);

const res = await handle.page.evaluate(`(function(){
  const H = window.__HARNESS; const cs = () => H.getCombatState();
  const R = {};
  const boot = (patch) => { H.setSeed(11); H.loadState('arena_flat'); if (patch) H.setLoadout(patch); H.stepFrames(4); };

  // ---- 1. jump: a real state, a real arc, a real cost, at all four equip-load tiers -------
  R.jump_by_tier = [];
  for (const [tier, load] of [['LIGHT',15],['MEDIUM',45],['HEAVY',85],['OVERLOADED',120]]) {
    boot(); H.setEquipLoad(load);
    const s0 = cs().player.stamina;
    H.queueInputs([{f:1,press:['jump']},{f:3,release:['jump']}]);
    const st=[], ys=[];
    for(let i=1;i<=90;i++){ H.stepFrames(1); const c=cs(); st.push(c.player.state); ys.push(+c.player.pos[1].toFixed(4)); }
    R.jump_by_tier.push({ tier, declared_tier: cs().player.tier, states:[...new Set(st)],
      state_frames: countRuns(st), max_y_m: Math.max(...ys), stamina_spent: +(s0-Math.min(...[s0].concat([]))).toFixed(2),
      stamina_after_press: null });
  }
  // exact cost + exact state lengths, LIGHT
  boot(); H.setEquipLoad(15);
  H.queueInputs([{f:1,press:['jump']},{f:3,release:['jump']}]);
  { const rows=[]; let s=null;
    for(let i=1;i<=90;i++){ H.stepFrames(1); const c=cs(); rows.push({f:i,st:c.player.state,y:+c.player.pos[1].toFixed(4),stam:c.player.stamina});
      if(s===null&&i===1) s=c.player.stamina; }
    R.jump_detail = { stamina_at_frame1: rows[0].stam, stamina_before: 120,
      spent: +(120-rows[0].stam).toFixed(2), state_frames: countRuns(rows.map(r=>r.st)),
      apex_m: Math.max(...rows.map(r=>r.y)), apex_frame: rows.findIndex(r=>r.y===Math.max(...rows.map(x=>x.y)))+1,
      y_at_end: rows[rows.length-1].y, iframes_any: rows.some(r=>cs().player.invuln) };
  }

  // ---- 2. RI-WPN04 §B: a jump attack is legal on DESCENDING frames only ------------------
  //         RI-CMB01 §B / RI-CMB02 §C: forbidden entirely at OVERLOADED.
  R.jump_attack = [];
  for (const [label, load, at] of [['rising',15,12],['descending',15,32],['descending_overloaded',120,32]]) {
    boot(); H.setEquipLoad(load);
    H.queueInputs([{f:1,press:['jump']},{f:3,release:['jump']},{f:at,press:['light']},{f:at+2,release:['light']}]);
    const st=[]; let mv=null;
    for(let i=1;i<=140;i++){ H.stepFrames(1); const c=cs(); st.push(c.player.state);
      if(c.player.move && c.player.move.id && c.player.move.id.indexOf('light')===0 && !mv) mv=c.player.move; }
    R.jump_attack.push({ case: label, press_at_anim_frame: at, tier: cs().player.tier,
      attack_started: !!mv, move: mv, states: [...new Set(st)] });
  }
  // the jump-attack multipliers, RI-CMB02 §C: startup x1.30, active x1.25, recovery x1.20,
  // stamina x1.30, motion value x1.35, poise damage x1.80 off the straight sword's 24/10/40.
  boot({weapon:'straight-sword'}); H.setEquipLoad(15);
  H.queueInputs([{f:1,press:['jump']},{f:3,release:['jump']},{f:32,press:['light']},{f:34,release:['light']}]);
  { let m=null, sBefore=null, sAfter=null, prev=null;
    for(let i=1;i<=200;i++){ H.stepFrames(1); const c=cs();
      if(c.player.state==='ATK_STARTUP' && !m){ m=c.player.move; sAfter=c.player.stamina; sBefore=prev; }
      prev=c.player.stamina; }
    R.jump_attack_frames = { move:m, stamina_spent: sBefore===null?null:+(sBefore-sAfter).toFixed(2),
      expected: { startup: Math.round(24*1.30), active: Math.round(10*1.25), recovery: Math.round(40*1.20), stamina: Math.round(20*1.30) } };
  }

  // ---- 3. RI-WPN06 §A: the stance switch -------------------------------------------------
  boot({weapon:'straight-sword'});
  const w1h = cs().player.weapon;
  H.queueInputs([{f:1,press:['two_hand']},{f:3,release:['two_hand']}]);
  { const st=[];
    for(let i=1;i<=80;i++){ H.stepFrames(1); st.push(cs().player.state); }
    const c=cs();
    R.stance = { from: w1h, to: c.player.weapon, two_handed: c.player.two_handed,
      state_frames: countRuns(st), stamina_after: c.player.stamina }; }
  // uncancellable: roll and light during the switch do nothing
  boot({weapon:'straight-sword'});
  H.queueInputs([{f:1,press:['two_hand']},{f:3,release:['two_hand']},{f:10,move:[0,1]},{f:11,press:['roll']},{f:13,release:['roll']},{f:20,press:['light']},{f:22,release:['light']}]);
  { const st=[]; for(let i=1;i<=80;i++){ H.stepFrames(1); st.push(cs().player.state); }
    R.stance_uncancellable = { states: [...new Set(st)], state_frames: countRuns(st) }; }
  // illegal from a committed state (RI-WPN06 §A "Illegal from: any ATTACK phase")
  boot({weapon:'straight-sword'});
  H.queueInputs([{f:1,press:['light']},{f:3,release:['light']},{f:10,press:['two_hand']},{f:12,release:['two_hand']}]);
  { const st=[]; for(let i=1;i<=120;i++){ H.stepFrames(1); st.push(cs().player.state); }
    R.stance_illegal_from_attack = { states:[...new Set(st)], two_handed: cs().player.two_handed }; }
  // two-handed: block and parry are gone (offhand stowed)
  boot({weapon:'straight-sword'});
  H.queueInputs([{f:1,press:['two_hand']},{f:3,release:['two_hand']},{f:60,press:['block']},{f:90,release:['block']},{f:100,press:['parry']},{f:102,release:['parry']}]);
  { const st=[]; for(let i=1;i<=200;i++){ H.stepFrames(1); st.push(cs().player.state); }
    R.two_handed_offhand = { two_handed: cs().player.two_handed, states:[...new Set(st)] }; }

  // ---- 4. two-hand DIVERGENCE, RI-WPN06 §B: the 2h attack is a different attack ----------
  R.two_hand_divergence = [];
  for (const w of ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword']) {
    const grab = (twoHand) => {
      boot({weapon:w});
      if (twoHand) { H.queueInputs([{f:1,press:['two_hand']},{f:3,release:['two_hand']}]); for(let i=0;i<40;i++) H.stepFrames(1); }
      H.queueInputs([{f:1,press:['light']},{f:3,release:['light']}]);
      let anim=null, m=null, s0=null, s1=null, prev=null;
      const geo=[];
      for(let i=1;i<=260;i++){ H.stepFrames(1); const c=cs();
        if(c.player.state==='ATK_STARTUP'&&!m){ m=c.player.move; anim=c.player.anim; s1=c.player.stamina; s0=prev; }
        prev=c.player.stamina;
        const g=H.getHitGeometry().actors.find(a=>a.id==='P');
        if (c.player.state==='ATK_ACTIVE'||c.player.state==='ATK_STARTUP'||c.player.state==='ATK_RECOVER') geo.push(g.weapon.now.slice());
        if(m && c.player.state==='IDLE' && geo.length) break; }
      let arc=0;
      for(let i=1;i<geo.length;i++){
        const a=geo[i-1], b=geo[i];
        const v1=[a[3]-a[0],a[4]-a[1],a[5]-a[2]], v2=[b[3]-b[0],b[4]-b[1],b[5]-b[2]];
        const n1=Math.hypot(v1[0],v1[1],v1[2]), n2=Math.hypot(v2[0],v2[1],v2[2]);
        arc += Math.acos(Math.max(-1,Math.min(1,(v1[0]*v2[0]+v1[1]*v2[1]+v1[2]*v2[2])/((n1*n2)||1))))*180/Math.PI;
      }
      return { anim, move:m, stamina: s0===null?null:+(s0-s1).toFixed(2), arc_sweep_deg:+arc.toFixed(1), weapon: cs().player.weapon };
    };
    const a = grab(false), b = grab(true);
    R.two_hand_divergence.push({ weapon: w, one_hand: a, two_hand: b,
      anim_differs: a.anim !== b.anim,
      arc_delta_deg: +(b.arc_sweep_deg - a.arc_sweep_deg).toFixed(1),
      frames_identical: JSON.stringify([a.move&&a.move.startup,a.move&&a.move.active,a.move&&a.move.recovery])
                     === JSON.stringify([b.move&&b.move.startup,b.move&&b.move.active,b.move&&b.move.recovery]),
      stamina_ratio: a.stamina ? +(b.stamina/a.stamina).toFixed(3) : null });
  }

  // ---- 5. swap_right / swap_left ---------------------------------------------------------
  boot({weapon:'straight-sword'});
  { const before = cs().player.weapon;
    H.queueInputs([{f:1,press:['swap_right']},{f:3,release:['swap_right']}]);
    const st=[]; for(let i=1;i<=60;i++){ H.stepFrames(1); st.push(cs().player.state); }
    R.swap_right = { from: before, to: cs().player.weapon, state_frames: countRuns(st) }; }
  boot({weapon:'straight-sword'});
  { const before = cs().player.shield;
    H.queueInputs([{f:1,press:['swap_left']},{f:3,release:['swap_left']}]);
    const st=[]; for(let i=1;i<=60;i++){ H.stepFrames(1); st.push(cs().player.state); }
    R.swap_left = { from: before, to: cs().player.shield, state_frames: countRuns(st) }; }
  // a swap must not restore hp or stamina
  boot({weapon:'straight-sword'});
  H.queueInputs([{f:0,move:[0,1]},{f:1,press:['sprint']},{f:200,release:['sprint']},{f:200,move:[0,0]},{f:206,press:['swap_right']},{f:208,release:['swap_right']}]);
  { let before=null, after=null;
    for(let i=1;i<=300;i++){ H.stepFrames(1); if(i===205) before=cs().player.stamina; if(i===240) after=cs().player.stamina; }
    R.swap_is_not_a_heal = { stamina_before: +before.toFixed(2), stamina_after: +after.toFixed(2), restored: after>before+8 }; }

  // ---- 6. AR-1 A3: the menu does NOT pause ----------------------------------------------
  H.setSeed(11); H.loadState('arena_flat'); H.spawn('inf_trash', 0, 1.6, {as:'E'}); H.stepFrames(4);
  H.queueEnemyScript('E', [{f:20, move:'chop'}]);
  H.queueInputs([{f:1,press:['menu']},{f:3,release:['menu']}]);
  { const f0 = H.getFrame(); const es=[]; let hp0=null, hpN=null, stam0=null, stamN=null;
    for(let i=1;i<=200;i++){ H.stepFrames(1); const c=cs(); const e=c.enemies.find(x=>x.id==='E');
      es.push(e?e.state:null); if(i===5){hp0=c.player.hp; stam0=c.player.stamina;} if(i===200){hpN=c.player.hp; stamN=c.player.stamina;} }
    R.menu_does_not_pause = { menu: cs().menu, frames_advanced: H.getFrame()-f0,
      enemy_states_while_open: [...new Set(es)], player_hp_5: hp0, player_hp_200: hpN,
      player_damaged_while_menu_open: hpN < hp0 }; }

  function countRuns(a){ const o=[]; let cur=null,n=0;
    for(const x of a){ if(x===cur) n++; else { if(cur!==null) o.push([cur,n]); cur=x; n=1; } }
    if(cur!==null) o.push([cur,n]); return o; }
  return R;
})()`);

fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
console.log(JSON.stringify(res, null, 1));
await handle.close();
