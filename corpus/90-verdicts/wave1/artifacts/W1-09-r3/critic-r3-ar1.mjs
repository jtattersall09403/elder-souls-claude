import { NodeArena, loadCombatData } from '/home/user/elder-souls-claude/tools/lib/combat-node.mjs';
const base = loadCombatData();
const R = {};

// A7 — yaw rate while a hitbox is live, both sides, over a long scripted fight.
{
  const a = new NodeArena({ data: base, loadout: { weapon: 'straight-sword' } });
  a.player.pos[2] = 2.2; a.player.yaw = 180; a.player.evaluateRig(0);
  a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
  a.lockOn('E1');
  const cyc = ['chop', 'combo_a', 'combo_b', 'thrust']; const sc = []; let f = 20;
  for (let i = 0; i < 40; i++) { sc.push({ f, move: cyc[i % 4] }); f += 170; }
  a.script('E1', sc);
  const ins = [{ f: 1, move: [0.6, 0.4] }];
  for (let k = 2; k < 3000; k += 20) ins.push({ f: k, press: ['light'] }, { f: k + 2, release: ['light'] });
  a.queueInputs(ins);
  const P = a.cs.bodyOf('P'), E = a.cs.bodyOf('E1');
  const dd = (x, y) => Math.abs(((x - y) % 360 + 540) % 360 - 180);
  let py = P.yaw, ey = E.yaw;
  const worst = { p_active_recovery: 0, e_active_recovery: 0, p_any: 0, e_any: 0 };
  let pn = 0, en = 0;
  for (let i = 0; i < 3000; i++) {
    a.step(); a.drain();
    const dpy = dd(P.yaw, py) * 60, dey = dd(E.yaw, ey) * 60;
    worst.p_any = Math.max(worst.p_any, dpy); worst.e_any = Math.max(worst.e_any, dey);
    if (P.state === 'ATK_ACTIVE' || P.state === 'ATK_RECOVER') { worst.p_active_recovery = Math.max(worst.p_active_recovery, dpy); pn++; }
    if (E.state === 'ATK_ACTIVE' || E.state === 'ATK_RECOVER') { worst.e_active_recovery = Math.max(worst.e_active_recovery, dey); en++; }
    py = P.yaw; ey = E.yaw;
    if (P.dead || E.dead) break;
  }
  R.A7 = { worst_yaw_rate_dps: worst, player_active_recovery_frames: pn, enemy_active_recovery_frames: en };
}

// A4 — every enemy attack's telegraph: frames from windup start to first live frame.
{
  const st = base._enemies.champion_hist_marked.attacks;
  const rows = [];
  for (const m of Object.keys(st)) {
    const a = new NodeArena({ data: base, loadout: { weapon: 'straight-sword' } });
    a.player.pos[2] = 2.4; a.player.yaw = 180; a.player.evaluateRig(0);
    a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
    a.lockOn('E1'); a.script('E1', [{ f: 5, move: m }]);
    a.queueInputs([{ f: 1, move: [0, 0] }]);
    const E = a.cs.bodyOf('E1');
    let windup = null, active = null;
    for (let i = 0; i < 240; i++) { a.step(); a.drain(); if (E.state === 'ATK_WINDUP' && windup === null) windup = a.frame; if (E.hitboxActive && active === null) active = a.frame; }
    rows.push({ move: m, windup_start_f: windup, first_live_f: active, telegraph_f: active - windup, declared_startup: st[m].startup });
  }
  R.A4 = rows;
}

// A5 — animation cancel: press roll at recovery frames 2/5/10 of a committed R1 and see
// whether the remaining frames vanish.
{
  const rows = [];
  for (const at of [2, 5, 10, 30, 45]) {
    const a = new NodeArena({ data: base, loadout: { weapon: 'straight-sword' } });
    a.player.pos[2] = 3.0; a.player.yaw = 180; a.player.evaluateRig(0);
    a.spawn('E1', 'champion_hist_marked', 0, 0, 0);
    a.lockOn('E1');
    a.queueInputs([{ f: 1, move: [0, 1] }, { f: 4, press: ['light'] }, { f: 6, release: ['light'] },
      { f: 4 + at, press: ['roll'] }, { f: 6 + at, release: ['roll'] }]);
    const P = a.cs.bodyOf('P');
    let atkEnd = null, states = [];
    for (let i = 0; i < 160; i++) { a.step(); a.drain(); states.push(P.state); }
    // first frame after the attack ends
    for (let i = 1; i < states.length; i++) if (states[i - 1].startsWith('ATK') && !states[i].startsWith('ATK')) { atkEnd = i + 1; break; }
    rows.push({ roll_pressed_at_anim_frame: at, attack_ended_at_sim_frame: atkEnd, next_state: atkEnd ? states[atkEnd - 1] : null });
  }
  R.A5 = rows;
}
console.log(JSON.stringify(R, null, 1));
