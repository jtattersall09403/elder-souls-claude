#!/usr/bin/env node
// critic-w1-09b.mjs — INDEPENDENT critic instrument for W1-09, part 2.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const args = parseArgs();
const which = String(args.probe || 'all');
const OUTDIR = path.join(REPO_ROOT, 'corpus/90-verdicts/wave1/artifacts/W1-09');
fs.mkdirSync(OUTDIR, { recursive: true });
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);

const PROBES = {

// ---- RI-CMB02 M1: the 14-row census, measured off hitbox_active in the geometry channel ----
frames() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const WEAPONS = ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword'];
  const R = { rows: [], census_seed_variance: [] };
  const one = (w, mv, seed) => {
    H.setSeed(seed); H.loadState('arena_flat'); H.setLoadout({ weapon: w });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:[mv]}, {f:3, release:[mv]}]);
    let press = null, act = [], total = null, pos = [], stam = [], yaw = [];
    for (let k = 1; k <= 400; k++) {
      H.stepFrames(1);
      const g = H.getHitGeometry();
      const me = g.actors.find(a => a.id === 'P');
      const c = cs();
      pos.push(c.player.pos.slice()); stam.push(c.player.stamina); yaw.push(c.player.yaw_deg);
      if (press === null && c.player.state !== 'IDLE' && c.player.state !== 'WALK' && c.player.state !== 'RUN') press = k;
      if (me.hitbox_active) act.push(k);
      if (press !== null && k > press && !c.player.move) { total = k - press; break; }
    }
    let runs = 0; for (let i = 1; i < act.length; i++) if (act[i] !== act[i-1] + 1) runs++;
    const startup = act.length ? act[0] - press : null;
    const active = act.length;
    const d = []; for (let i = 1; i < pos.length; i++) d.push(+Math.hypot(pos[i][0]-pos[i-1][0], pos[i][2]-pos[i-1][2]).toFixed(5));
    const dz = pos.length ? +(pos[Math.min(total+press,pos.length)-1][2] - pos[0][2]).toFixed(4) : null;
    // yaw during active frames
    const yawActive = act.map(k => yaw[k-1]);
    const yawRange = yawActive.length ? +(Math.max(...yawActive) - Math.min(...yawActive)).toFixed(4) : null;
    return { weapon: w, move: mv, press_f: press, startup_f60: startup, Ps: startup === null ? null : startup + 1,
      active_f60: active, contiguous_runs: runs + (act.length ? 1 : 0), total_f60: total,
      recovery_f60: (total !== null && startup !== null) ? total - startup - active : null,
      root_dz_m: dz, per_frame_step: d.slice(0, 60), max_step: Math.max(...d), step_stdev: +(() => { const m = d.reduce((a,b)=>a+b,0)/d.length; return Math.sqrt(d.reduce((a,b)=>a+(b-m)*(b-m),0)/d.length); })().toFixed(5),
      stamina_spent: +(stam[0] === undefined ? 0 : (120 - Math.min(...stam))).toFixed(3),
      stamina_drop_frame: (() => { for (let i=1;i<stam.length;i++) if (stam[i] < stam[i-1]) return i+1; return null; })(),
      yaw_range_during_active_deg: yawRange,
      active_over_total: total ? +(active/total).toFixed(4) : null };
  };
  for (const w of WEAPONS) for (const mv of ['light','heavy']) R.rows.push(one(w, mv, 1337));
  // M6 determinism: 10 seeds
  for (const seed of [1,2,3,5,8,13,21,34,55,89]) {
    const r = one('straight-sword','light',seed);
    R.census_seed_variance.push({ seed, startup: r.startup_f60, active: r.active_f60, total: r.total_f60, dz: r.root_dz_m });
  }
  return R;
},

// ---- RI-CMB02 M2: the commitment grid, per action per frame ----
commit() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const ACTIONS = ['roll','light','block','sprint','use_item','parry','two_hand','jump'];
  const R = { grids: [] };
  const base = (w, mv) => {
    H.setSeed(4242); H.loadState('arena_flat'); H.setLoadout({ weapon: w }); H.stepFrames(6);
    H.queueInputs([{f:1, press:[mv]}, {f:3, release:[mv]}]);
    let press = null, total = null, states = [];
    for (let k = 1; k <= 400; k++) {
      H.stepFrames(1); const c = cs(); states.push(c.player.state);
      if (press === null && c.player.state !== 'IDLE') press = k;
      if (press !== null && k > press && !c.player.move) { total = k - press; break; }
    }
    return { press, total, states };
  };
  for (const [w, mv] of [['straight-sword','light'],['straight-sword','heavy'],['ultra-greatsword','light'],['dagger','light']]) {
    const b = base(w, mv);
    const grid = {};
    for (const act of ACTIONS) {
      const row = [];
      for (let k = 1; k <= b.total; k++) {
        H.setSeed(4242); H.loadState('arena_flat'); H.setLoadout({ weapon: w }); H.stepFrames(6);
        H.queueInputs([{f:1, press:[mv]}, {f:3, release:[mv]},
                       {f:1+k, press:[act]}, {f:3+k, release:[act]}]);
        let press = null, actionable = null, sawOther = null;
        for (let i = 1; i <= 500; i++) {
          H.stepFrames(1); const c = cs();
          if (press === null && c.player.state !== 'IDLE') press = i;
          if (press !== null && i > press) {
            const st = c.player.state;
            if (sawOther === null && !st.startsWith('ATK_') && st !== 'IDLE' && st !== 'WALK' && st !== 'RUN') sawOther = { f: i - press, st };
            if (actionable === null && !c.player.move && !st.startsWith('ATK_')) { actionable = i - press; }
          }
          if (actionable !== null && i - press > actionable + 4) break;
        }
        let verdict;
        if (sawOther && sawOther.f <= b.total) verdict = 'cancelled';
        else if (sawOther && sawOther.f > b.total) verdict = 'buffered';
        else verdict = 'ignored';
        row.push({ k, verdict, at: sawOther ? sawOther.f : null, state: sawOther ? sawOther.st : null, actionable_at: actionable });
      }
      grid[act] = row;
    }
    R.grids.push({ weapon: w, move: mv, total: b.total, grid,
      ascii: Object.fromEntries(Object.entries(grid).map(([a, row]) => [a, row.map(x => x.verdict === 'cancelled' ? 'C' : x.verdict === 'buffered' ? 'B' : '.').join('')])) });
  }
  return R;
},

// ---- RI-CMB03 M1/M2/M3/M4/M5/M6 + RI-CMB09 chained-roll regen ----
stamina() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = {};
  // M1 regen curve
  H.setSeed(5); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['roll']}, {f:3, release:['roll']}]);
  const s = []; for (let i = 1; i <= 400; i++) { H.stepFrames(1); s.push(+cs().player.stamina.toFixed(4)); }
  let spendF = null; for (let i = 1; i < s.length; i++) if (s[i] < s[i-1]) { spendF = i + 1; break; }
  let resumeF = null; for (let i = spendF; i < s.length; i++) if (s[i] > s[i-1]) { resumeF = i + 1; break; }
  const slope = []; for (let i = resumeF; i < Math.min(resumeF + 60, s.length); i++) slope.push(+(s[i] - s[i-1]).toFixed(4));
  R.m1 = { spend_frame: spendF, first_regen_frame: resumeF, delta: resumeF - spendF,
           slope_samples: slope.slice(0, 20), slope_mean: +(slope.reduce((a,b)=>a+b,0)/slope.length).toFixed(5),
           slope_distinct: [...new Set(slope)], series_head: s.slice(0, 120) };
  // guarded regen
  H.setSeed(5); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['roll']}, {f:3, release:['roll']}, {f:60, press:['block']}]);
  const sg = []; for (let i = 1; i <= 300; i++) { H.stepFrames(1); sg.push(+cs().player.stamina.toFixed(4)); }
  const gslope = []; for (let i = 120; i < 200; i++) gslope.push(+(sg[i]-sg[i-1]).toFixed(4));
  R.m1_guarded = { slope_distinct: [...new Set(gslope)], slope_mean: +(gslope.reduce((a,b)=>a+b,0)/gslope.length).toFixed(5) };
  // M2 re-arming: three rolls 20 f apart
  H.setSeed(5); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['roll']}, {f:3, release:['roll']},
                 {f:53, press:['roll']}, {f:55, release:['roll']},
                 {f:105, press:['roll']}, {f:107, release:['roll']}]);
  const s2 = []; for (let i = 1; i <= 400; i++) { H.stepFrames(1); s2.push(+cs().player.stamina.toFixed(4)); }
  const spends = []; const regens = [];
  for (let i = 1; i < s2.length; i++) { if (s2[i] < s2[i-1]) spends.push(i+1); if (s2[i] > s2[i-1]) regens.push(i+1); }
  R.m2 = { spend_frames: spends, first_regen_frame: regens[0] || null,
           last_spend: spends[spends.length-1], gap: regens[0] ? regens[0] - spends[spends.length-1] : null,
           series: s2.slice(0, 220) };
  // RI-CMB09 §3 chained rolls: does any regen occur BETWEEN two chained LIGHT rolls?
  H.setSeed(5); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(6);
  const ip = [{f:0, move:[0,1]}];
  for (let n = 0; n < 5; n++) { ip.push({f: 1 + n*53, press:['roll']}); ip.push({f: 3 + n*53, release:['roll']}); }
  H.queueInputs(ip);
  const s3 = []; for (let i = 1; i <= 320; i++) { H.stepFrames(1); s3.push(+cs().player.stamina.toFixed(4)); }
  const ups = []; for (let i = 1; i < s3.length; i++) if (s3[i] > s3[i-1]) ups.push({ f: i+1, d: +(s3[i]-s3[i-1]).toFixed(4) });
  R.cmb09_chained = { series: s3, regen_frames_between_rolls: ups.filter(u => u.f < 265), total_regen_events: ups.length,
                      min_stamina: Math.min(...s3), rolls_completed: null };
  // M3 cost census
  R.m3 = [];
  const cost = (setup, presses) => {
    H.setSeed(5); H.loadState('arena_flat'); setup(); H.stepFrames(6);
    H.queueInputs(presses);
    const ss = []; for (let i = 1; i <= 200; i++) { H.stepFrames(1); ss.push(+cs().player.stamina.toFixed(4)); }
    const first = ss[0];
    let dropAt = null, dropTo = null;
    for (let i = 1; i < ss.length; i++) if (ss[i] < ss[i-1]) { dropAt = i+1; dropTo = ss[i]; break; }
    let steps = 0; for (let i = 1; i < 60; i++) if (ss[i] < ss[i-1]) steps++;
    return { start: first, drop_frame: dropAt, after: dropTo, spent: +(first - dropTo).toFixed(3), drop_steps_in_60f: steps };
  };
  for (const [name, load] of [['roll_LIGHT',15],['roll_MEDIUM',50],['roll_HEAVY',85],['roll_OVERLOADED',120]])
    R.m3.push({ action: name, ...cost(() => H.setEquipLoad(load), [{f:0,move:[0,1]},{f:1,press:['roll']},{f:3,release:['roll']}]) });
  for (const [name, load] of [['backstep_LIGHT',15],['backstep_MEDIUM',50],['backstep_HEAVY',85],['backstep_OVERLOADED',120]])
    R.m3.push({ action: name, ...cost(() => H.setEquipLoad(load), [{f:0,move:[0,0]},{f:1,press:['roll']},{f:3,release:['roll']}]) });
  for (const w of ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword']) {
    R.m3.push({ action: 'R1_'+w, ...cost(() => H.setLoadout({weapon:w}), [{f:1,press:['light']},{f:3,release:['light']}]) });
    R.m3.push({ action: 'R2_'+w, ...cost(() => H.setLoadout({weapon:w}), [{f:1,press:['heavy']},{f:3,release:['heavy']}]) });
  }
  R.m3.push({ action: 'jump', ...cost(() => {}, [{f:1,press:['jump']},{f:3,release:['jump']}]) });
  R.m3.push({ action: 'parry', ...cost(() => {}, [{f:1,press:['parry']},{f:3,release:['parry']}]) });
  // sprint per-frame
  H.setSeed(5); H.loadState('arena_flat'); H.stepFrames(6);
  H.queueInputs([{f:0, move:[0,1]}, {f:1, press:['sprint']}, {f:200, release:['sprint']}]);
  const sp = []; for (let i = 1; i <= 220; i++) { H.stepFrames(1); sp.push(+cs().player.stamina.toFixed(4)); }
  const spd = []; for (let i = 40; i < 120; i++) spd.push(+(sp[i-1]-sp[i]).toFixed(4));
  R.sprint = { per_frame_distinct: [...new Set(spd)], mean: +(spd.reduce((a,b)=>a+b,0)/spd.length).toFixed(5) };
  return R;
},

};

const list = which === 'all' ? Object.keys(PROBES) : which.split(',');
for (const name of list) {
  if (!PROBES[name]) { console.error('no such probe: ' + name); continue; }
  const t0 = Date.now();
  process.stderr.write(`[criticB] running ${name} ...\n`);
  const res = await handle.page.evaluate(`(function ${PROBES[name].toString()})()`);
  const p = path.join(OUTDIR, `critic-${name}.json`);
  fs.writeFileSync(p, JSON.stringify(res, null, 1));
  process.stderr.write(`[criticB] ${name} -> ${p} (${((Date.now()-t0)/1000).toFixed(1)}s)\n`);
}
await handle.close();
