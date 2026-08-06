#!/usr/bin/env node
// critic-w1-09.mjs — INDEPENDENT critic instrument for W1-09.
// Written by the W1-09 critic. Shares no code with tools/harness/cmb-probe.mjs beyond
// the common browser launcher. Every number it prints is read back out of a real run.
//
//   node tools/harness/critic-w1-09.mjs --probe <name|all> --out <path>
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
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'getHitGeometry', 'setEquipLoad', 'setLoadout', 'queueEnemyScript', 'spawn']);

const PROBES = {

// ---------------------------------------------------------------------------------------
// C1 — roll census, all four tiers, all eight directions, backstep.  RI-CMB01 M1/M5.
// ---------------------------------------------------------------------------------------
roll() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const DIRS = [[0,1],[0.7071,0.7071],[1,0],[0.7071,-0.7071],[0,-1],[-0.7071,-0.7071],[-1,0],[-0.7071,0.7071]];
  const measure = (loadPct, dir) => {
    H.setSeed(4242); H.loadState('arena_flat'); H.setEquipLoad(loadPct); H.stepFrames(4);
    H.queueInputs([{f:0, move: dir}, {f:1, press:['roll']}, {f:3, release:['roll']}]);
    let f = 0, invulnFrames = [], states = [], pos = [], total = null, runs = [];
    let prevInv = false;
    while (f < 300) {
      H.stepFrames(1); f++;
      const c = cs();
      const p = c.player;
      states.push(p.state);
      pos.push(p.pos.slice());
      if (p.invuln && !prevInv) runs.push([f, f]);
      else if (p.invuln) runs[runs.length-1][1] = f;
      prevInv = !!p.invuln;
      if (p.invuln) invulnFrames.push(f);
      if (f > 2 && !p.move) { total = f - 1; break; }
    }
    // per-frame displacement
    const d = [];
    for (let i = 1; i < pos.length; i++) d.push(Math.hypot(pos[i][0]-pos[i-1][0], pos[i][2]-pos[i-1][2]));
    const disp = Math.hypot(pos[Math.min(total,pos.length)-1][0]-pos[0][0], pos[Math.min(total,pos.length)-1][2]-pos[0][2]);
    return {
      load_pct: loadPct, dir,
      total_f60: total,
      iframe_runs: runs,
      iframes: invulnFrames.length,
      startup_f60: runs.length ? runs[0][0] - 1 : null,   // press lands on the frame after queue f1
      recovery_f60: total !== null && runs.length ? total - runs[runs.length-1][1] : null,
      displacement_m: +disp.toFixed(4),
      max_step_m: +Math.max(...d).toFixed(4),
      min_step_m: +Math.min(...d.filter(x=>x>0)).toFixed(5),
      step_stdev: +(() => { const m = d.reduce((a,b)=>a+b,0)/d.length; return Math.sqrt(d.reduce((a,b)=>a+(b-m)*(b-m),0)/d.length); })().toFixed(5),
      per_frame_steps: d.map(x=>+x.toFixed(4)),
    };
  };
  const R = { tiers: [], directions: [], backstep: [], cliff: [] };
  for (const [name, pct] of [['LIGHT',15],['MEDIUM',50],['HEAVY',85],['OVERLOADED',120]]) {
    const m = measure(pct, [0,1]); m.tier_name = name; R.tiers.push(m);
  }
  for (const dir of DIRS) { const m = measure(15, dir); R.directions.push({dir, total: m.total_f60, iframes: m.iframes, startup: m.startup_f60, disp: m.displacement_m}); }
  // backstep = dodge press with no stick
  for (const [name, pct] of [['LIGHT',15],['MEDIUM',50],['HEAVY',85],['OVERLOADED',120]]) {
    const m = measure(pct, [0,0]); m.tier_name = name; R.backstep.push(m);
  }
  // M5 cliff, 0.1% steps
  for (const [lo, hi] of [[29.0,31.0],[69.0,71.0],[99.0,101.0]]) {
    for (let v = lo; v <= hi + 1e-9; v += 0.1) {
      const pct = +v.toFixed(2);
      const m = measure(pct, [0,1]);
      R.cliff.push({ load_pct: pct, iframes: m.iframes, total: m.total_f60, disp: m.displacement_m });
    }
  }
  return R;
},

// ---------------------------------------------------------------------------------------
// C2 — the i-frame boundary probe. RI-CMB01 M2. Written from the item, not from the builder.
// ---------------------------------------------------------------------------------------
iframe() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { tiers: [], calibration: null };

  // ---- calibrate: on which frame after queueEnemyScript does the pulse hitbox go active? ----
  H.setSeed(99); H.loadState('arena_flat');
  H.spawn('probe_pulse', 0, 1.0, { as: 'PULSE' });
  H.stepFrames(4);
  H.queueEnemyScript('PULSE', [{ f: 150, move: 'pulse' }]);
  let activeAt = null, hpDropAt = null, hp0 = null;
  for (let i = 1; i <= 260; i++) {
    H.stepFrames(1);
    const g = H.getHitGeometry();
    const e = g.actors.find(a => a.id === 'PULSE');
    const c = cs();
    if (hp0 === null) hp0 = c.player.hp;
    if (e && e.hitbox_active && activeAt === null) activeAt = i;
    if (hpDropAt === null && c.player.hp < hp0) hpDropAt = i;
  }
  R.calibration = { pulse_scheduled_rel_f: 150, hitbox_active_rel_f: activeAt, player_hp_drop_rel_f: hpDropAt };
  const FA = hpDropAt;   // the frame (relative to queue) on which damage lands with no dodge

  for (const [name, pct, kMax] of [['LIGHT',15,100],['MEDIUM',50,100],['HEAVY',85,120],['OVERLOADED',120,140]]) {
    const Hv = [];
    for (let k = -12; k <= kMax; k++) {
      const pressAt = FA - k;                 // roll press frame so that the pulse lands on press+k
      if (pressAt < 2) { Hv.push({ k, hit: null, skipped: true }); continue; }
      H.setSeed(99); H.loadState('arena_flat'); H.setEquipLoad(pct);
      H.spawn('probe_pulse', 0, 1.0, { as: 'PULSE' });
      H.stepFrames(4);
      H.queueInputs([{ f: pressAt - 1, move: [0, 1] }, { f: pressAt, press: ['roll'] }, { f: pressAt + 2, release: ['roll'] }]);
      H.queueEnemyScript('PULSE', [{ f: 150, move: 'pulse' }]);
      let base = null, hit = false;
      for (let i = 1; i <= FA + 160; i++) {
        H.stepFrames(1);
        const c = cs();
        if (base === null) base = c.player.hp;
        if (c.player.hp < base) { hit = true; break; }
      }
      Hv.push({ k, hit });
    }
    const V = Hv.filter(x => !x.skipped);
    let transitions = 0;
    for (let i = 1; i < V.length; i++) if (V[i].hit !== V[i-1].hit) transitions++;
    const negated = V.filter(x => !x.hit).map(x => x.k);
    const holes = negated.filter((k,i,a) => i > 0 && k !== a[i-1] + 1);
    R.tiers.push({ tier: name, load_pct: pct, vector: Hv, transitions,
      first_negated_k: negated.length ? negated[0] : null,
      last_negated_k: negated.length ? negated[negated.length-1] : null,
      negated_count: negated.length, holes,
      leaks_outside_window: negated.filter(k => k < 0) });
  }
  return R;
},

// ---------------------------------------------------------------------------------------
// C3 — weapon arc kinematics measured off the geometry channel, all 7 classes.
//      Compares MEASURED peak tip travel against RI-CMB04 §B's declared column.
// ---------------------------------------------------------------------------------------
arc() {
  const H = window.__HARNESS;
  const R = { classes: [] };
  const WEAPONS = ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword'];
  for (const w of WEAPONS) {
    for (const mv of ['light','heavy']) {
      H.setSeed(7); H.loadState('arena_flat');
      let lo;
      try { lo = H.setLoadout({ weapon: w }); } catch (e) { R.classes.push({ weapon: w, error: String(e.message||e) }); continue; }
      H.stepFrames(4);
      H.queueInputs([{f:1, press:[mv]}, {f:3, release:[mv]}]);
      const samples = [];
      for (let i = 0; i < 120; i++) {
        H.stepFrames(1);
        const g = H.getHitGeometry();
        const me = g.actors.find(a => a.id === 'P');
        const cst = H.getCombatState();
        const wp = me.weapon;
        const tipNow = [wp.now[3], wp.now[4], wp.now[5]];
        const tipPrev = [wp.prev[3], wp.prev[4], wp.prev[5]];
        const gA = [wp.now[0], wp.now[1], wp.now[2]];
        const gP = [wp.prev[0], wp.prev[1], wp.prev[2]];
        samples.push({
          f: i, state: cst.player.state, af: cst.player.anim_frame, active: !!me.hitbox_active,
          tip_travel_m: +Math.hypot(tipNow[0]-tipPrev[0], tipNow[1]-tipPrev[1], tipNow[2]-tipPrev[2]).toFixed(5),
          guard_travel_m: +Math.hypot(gA[0]-gP[0], gA[1]-gP[1], gA[2]-gP[2]).toFixed(5),
          capsule_len_m: +Math.hypot(tipNow[0]-gA[0], tipNow[1]-gA[1], tipNow[2]-gA[2]).toFixed(4),
          r: wp.r, substeps: g.substeps,
        });
        if (i > 4 && cst.player.state === 'IDLE') break;
      }
      const act = samples.filter(s => s.active);
      const peak = act.length ? Math.max(...act.map(s => s.tip_travel_m)) : null;
      const peakAll = Math.max(...samples.map(s => s.tip_travel_m));
      R.classes.push({ weapon: w, move: mv, moveset: lo && lo.weapon, r: samples[0] && samples[0].r,
        capsule_len_m: act.length ? act[0].capsule_len_m : null,
        substeps: samples[0] && samples[0].substeps,
        active_frames: act.length,
        peak_tip_travel_active_m: peak,
        peak_tip_travel_any_m: +peakAll.toFixed(5),
        peak_tip_speed_mps: peak === null ? null : +(peak * 60).toFixed(2),
        radii_per_frame: peak === null ? null : +(peak / (samples[0].r)).toFixed(3),
        radii_per_substep: peak === null ? null : +(peak / 4 / (samples[0].r)).toFixed(3),
        active_travel: act.map(s => s.tip_travel_m),
      });
    }
  }
  return R;
},

// ---------------------------------------------------------------------------------------
// C4 — THE TUNNELLING TEST. RI-CMB04 M2, run properly against a THIN target.
//      No 0.06 m pole fixture exists, so the thin target is synthesised from the
//      dummy's own thinnest capsules AND from an analytic test computed off the
//      dumped socket transforms. Sim vs analytic, per class, 24 offsets.
// ---------------------------------------------------------------------------------------
tunnel() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { classes: [], note: '' };
  const WEAPONS = ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword'];

  // --- helpers: analytic swept-hull test against a vertical pole of radius rp at (x,z) ---
  // The pole is a vertical segment from y=0 to y=2.0. We test segment-segment distance
  // between the weapon capsule axis (at a continuum of interpolation times) and the pole axis.
  const segSegDist = (p1,q1,p2,q2) => {
    const d1=[q1[0]-p1[0],q1[1]-p1[1],q1[2]-p1[2]], d2=[q2[0]-p2[0],q2[1]-p2[1],q2[2]-p2[2]];
    const r=[p1[0]-p2[0],p1[1]-p2[1],p1[2]-p2[2]];
    const a=d1[0]*d1[0]+d1[1]*d1[1]+d1[2]*d1[2], e=d2[0]*d2[0]+d2[1]*d2[1]+d2[2]*d2[2];
    const f=d2[0]*r[0]+d2[1]*r[1]+d2[2]*r[2];
    let s,t;
    const c=d1[0]*r[0]+d1[1]*r[1]+d1[2]*r[2];
    const b=d1[0]*d2[0]+d1[1]*d2[1]+d1[2]*d2[2];
    const den=a*e-b*b;
    if (den>1e-12) s=Math.min(1,Math.max(0,(b*f-c*e)/den)); else s=0;
    t=(b*s+f)/e; 
    if (t<0){t=0;s=Math.min(1,Math.max(0,-c/a));} else if (t>1){t=1;s=Math.min(1,Math.max(0,(b-c)/a));}
    const c1=[p1[0]+d1[0]*s,p1[1]+d1[1]*s,p1[2]+d1[2]*s];
    const c2=[p2[0]+d2[0]*t,p2[1]+d2[1]*t,p2[2]+d2[2]*t];
    return Math.hypot(c1[0]-c2[0],c1[1]-c2[1],c1[2]-c2[2]);
  };

  for (const w of WEAPONS) {
    // 1) record the weapon socket track for one swing, with NO target present.
    H.setSeed(11); H.loadState('arena_flat');
    let lo; try { lo = H.setLoadout({ weapon: w }); } catch (e) { R.classes.push({weapon:w, error:String(e.message||e)}); continue; }
    H.stepFrames(4);
    H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']}]);
    const track = [];
    for (let i = 0; i < 120; i++) {
      H.stepFrames(1);
      const g = H.getHitGeometry();
      const me = g.actors.find(a => a.id === 'P');
      const c = cs();
      track.push({ f: i, active: !!me.hitbox_active, r: me.weapon.r,
                   now: me.weapon.now.slice(), prev: me.weapon.prev.slice(), state: c.player.state });
      if (i > 4 && c.player.state === 'IDLE') break;
    }
    const active = track.filter(t => t.active);
    const rw = active.length ? active[0].r : (track[0] ? track[0].r : 0);

    // 2) analytic: for a pole of radius rp at lateral offset x, forward z, does the
    //    CONTINUOUS swept hull of the active frames touch it?  Densely sampled at 1/64 frame.
    const analytic = (x, z, rp) => {
      const pole0 = [x, 0.0, z], pole1 = [x, 2.0, z];
      for (const t of active) {
        for (let s = 0; s <= 64; s++) {
          const u = s / 64;
          const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
          const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
          if (segSegDist(a,b,pole0,pole1) <= rw + rp) return true;
        }
      }
      return false;
    };
    // discrete N-substep model, for comparison (what a sampling implementation would give)
    const discrete = (x, z, rp, N) => {
      const pole0 = [x, 0.0, z], pole1 = [x, 2.0, z];
      for (const t of active) {
        for (let s = 0; s <= N; s++) {
          const u = s / N;
          const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
          const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
          if (segSegDist(a,b,pole0,pole1) <= rw + rp) return true;
        }
      }
      return false;
    };

    // 3) SIM: run the same swing against the dummy at 24 lateral offsets and read hit/miss.
    //    The dummy's thinnest capsule is forearm r=0.065; we compare the SIM answer against
    //    the analytic answer computed with the dummy's OWN capsules, below, in `sim_vs_analytic`.
    const OFFS = [];
    for (let i = 0; i < 24; i++) OFFS.push(+(i * 0.075).toFixed(4));
    const rows = [];
    for (const off of OFFS) {
      H.setSeed(11); H.loadState('arena_flat'); H.setLoadout({ weapon: w });
      H.spawn('dummy_passive', off, 1.4, { as: 'T' });
      H.stepFrames(6);
      H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']}]);
      let hp0 = null, hit = false;
      for (let k = 0; k < 120; k++) {
        H.stepFrames(1);
        const e = cs().enemies.find(y => y.id === 'T');
        if (!e) break;
        if (hp0 === null) hp0 = e.hp;
        if (e.hp < hp0) { hit = true; break; }
      }
      // analytic against the dummy's real capsules, taken at rest (it never moves)
      H.setSeed(11); H.loadState('arena_flat'); H.setLoadout({ weapon: w });
      H.spawn('dummy_passive', off, 1.4, { as: 'T' }); H.stepFrames(6);
      const g = H.getHitGeometry();
      const tgt = g.actors.find(a => a.id === 'T');
      let ana = false, anaN1 = false, minGap = Infinity;
      if (tgt) {
        for (const hb of tgt.hurtboxes) {
          for (const t of active) {
            for (let s = 0; s <= 64; s++) {
              const u = s/64;
              const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
              const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
              const dd = segSegDist(a,b,hb.a,hb.b) - (rw + hb.r);
              if (dd < minGap) minGap = dd;
              if (dd <= 0) { ana = true; }
            }
          }
        }
        for (const hb of tgt.hurtboxes) {
          for (const t of active) {
            for (let s = 0; s <= 1; s++) {
              const u = s;
              const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
              const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
              if (segSegDist(a,b,hb.a,hb.b) <= rw + hb.r) anaN1 = true;
            }
          }
        }
      }
      rows.push({ offset_m: off, sim_hit: hit, analytic_hit: ana, analytic_substep1_hit: anaN1,
                  min_gap_m: +minGap.toFixed(5), agree: hit === ana });
    }

    // 4) THE THIN-TARGET QUESTION, answered analytically off the same track:
    //    for a pole of radius rp, how wide is the widest un-sampled gap between the
    //    5 sampled poses of the declared 4-substep model, along the tip's path?
    let worstGap = 0, worstFrame = null;
    for (const t of active) {
      const d = Math.hypot(t.now[3]-t.prev[3], t.now[4]-t.prev[4], t.now[5]-t.prev[5]);
      if (d > worstGap) { worstGap = d; worstFrame = t.f; }
    }
    const substepTravel = worstGap / 4;
    // A pole of radius rp tunnels between two sampled poses iff substepTravel > 2*(rw+rp)
    const tunnelRadiusThreshold = substepTravel / 2 - rw;   // rp below this can slip through
    R.classes.push({
      weapon: w, hitbox_r_m: rw, active_frames: active.length,
      peak_tip_travel_m: +worstGap.toFixed(5),
      peak_tip_travel_frame: worstFrame,
      per_substep_travel_m_at_4: +substepTravel.toFixed(5),
      substep_travel_in_radii: +(substepTravel / rw).toFixed(3),
      declared_substep_travel_radii: 1.0,
      pole_radius_that_tunnels_below_m: +tunnelRadiusThreshold.toFixed(5),
      pole_006_tunnels: (0.06 < tunnelRadiusThreshold),
      offsets: rows,
      disagreements: rows.filter(r => !r.agree),
    });
  }
  return R;
},

// ---------------------------------------------------------------------------------------
// C5 — the boundary sharpness sweep in 0.005 m steps, straight sword. RI-CMB04 M3.
// ---------------------------------------------------------------------------------------
sharp() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { fine: [], coarse: [] };
  const run = (off, z) => {
    H.setSeed(1337); H.loadState('arena_flat'); H.setLoadout({ weapon: 'straight-sword' });
    H.spawn('dummy_passive', off, z, { as: 'T' });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']}]);
    let hp0 = null, hit = false;
    for (let k = 0; k < 110; k++) {
      H.stepFrames(1);
      const e = cs().enemies.find(y => y.id === 'T');
      if (!e) break;
      if (hp0 === null) hp0 = e.hp;
      if (e.hp < hp0) { hit = true; break; }
    }
    return hit;
  };
  for (let i = 0; i <= 60; i++) { const off = +(i*0.05).toFixed(3); R.coarse.push({ offset_m: off, hit: run(off, 1.6) }); }
  for (let x = 0.90; x <= 1.40001; x += 0.005) { const off = +x.toFixed(4); R.fine.push({ offset_m: off, hit: run(off, 1.6) }); }
  // and the FORWARD axis: reach along z at zero lateral offset
  for (let z = 0.6; z <= 3.20001; z += 0.005) { const zz = +z.toFixed(4); R.coarse.push({ forward_m: zz, hit: run(0, zz) }); }
  let cross = 0;
  const f = R.fine;
  for (let i = 1; i < f.length; i++) if (f[i].hit !== f[i-1].hit) cross++;
  R.fine_crossings = cross;
  return R;
},

// ---------------------------------------------------------------------------------------
// C6 — determinism / no dice. RI-CMB04 M4. 200 seeds, identical damage tuples.
// ---------------------------------------------------------------------------------------
dice() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const R = { seeds: [], distinct_hashes: 0, rng_draws: [] };
  const hashes = {};
  for (let s = 0; s < 200; s++) {
    const seed = 1000 + s * 7919;
    H.setSeed(seed); H.loadState('arena_flat');
    H.spawn('dummy_passive', 0, 1.5, { as: 'T' });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']},
                   {f:40, press:['heavy']}, {f:43, release:['heavy']},
                   {f:90, press:['light']}, {f:92, release:['light']}]);
    const tuples = [];
    let prev = null;
    for (let k = 0; k < 180; k++) {
      H.stepFrames(1);
      const c = cs();
      const e = c.enemies.find(y => y.id === 'T');
      if (!e) break;
      if (prev !== null && e.hp !== prev) tuples.push(`${k}:${(prev - e.hp).toFixed(6)}`);
      prev = e.hp;
    }
    const key = tuples.join('|');
    hashes[key] = (hashes[key] || 0) + 1;
    if (s < 3 || !R.sample) R.sample = key;
    R.seeds.push({ seed, tuples: tuples.length, key: s < 3 ? key : undefined });
  }
  R.distinct_hashes = Object.keys(hashes).length;
  R.hash_histogram = Object.entries(hashes).map(([k,v]) => ({ key: k.slice(0,200), count: v }));
  return R;
},


// ---------------------------------------------------------------------------------------
// C7 — same-run analytic. Records the weapon socket track AND the target hurtboxes in the
//      SAME run as the sim's hit/miss answer, so collision push-out and root motion cannot
//      confound the comparison. Executes RI-CMB04 M2 (sim vs analytic, 7 classes x 24
//      offsets) and M3's phantom-range number, and answers the 0.06 m thin-pole question
//      analytically off the measured track.
// ---------------------------------------------------------------------------------------
geo2() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const segSegDist = (p1,q1,p2,q2) => {
    const d1=[q1[0]-p1[0],q1[1]-p1[1],q1[2]-p1[2]], d2=[q2[0]-p2[0],q2[1]-p2[1],q2[2]-p2[2]];
    const r=[p1[0]-p2[0],p1[1]-p2[1],p1[2]-p2[2]];
    const a=d1[0]*d1[0]+d1[1]*d1[1]+d1[2]*d1[2], e=d2[0]*d2[0]+d2[1]*d2[1]+d2[2]*d2[2];
    const f=d2[0]*r[0]+d2[1]*r[1]+d2[2]*r[2];
    const c=d1[0]*r[0]+d1[1]*r[1]+d1[2]*r[2];
    const b=d1[0]*d2[0]+d1[1]*d2[1]+d1[2]*d2[2];
    const den=a*e-b*b;
    let s = den>1e-12 ? Math.min(1,Math.max(0,(b*f-c*e)/den)) : 0;
    let t=(b*s+f)/e;
    if (t<0){t=0;s=Math.min(1,Math.max(0,-c/a));} else if (t>1){t=1;s=Math.min(1,Math.max(0,(b-c)/a));}
    const c1=[p1[0]+d1[0]*s,p1[1]+d1[1]*s,p1[2]+d1[2]*s];
    const c2=[p2[0]+d2[0]*t,p2[1]+d2[1]*t,p2[2]+d2[2]*t];
    return Math.hypot(c1[0]-c2[0],c1[1]-c2[1],c1[2]-c2[2]);
  };
  // one run: swing at a target placed at (x,z); returns sim answer + the recorded track
  const run = (weapon, x, z, move) => {
    H.setSeed(2026); H.loadState('arena_flat'); H.setLoadout({ weapon });
    H.spawn('dummy_passive', x, z, { as: 'T' });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:[move||'light']}, {f:3, release:[move||'light']}]);
    const track = [];
    let hp0 = null, hit = false, hitFrame = null;
    for (let k = 0; k < 130; k++) {
      H.stepFrames(1);
      const g = H.getHitGeometry();
      const me = g.actors.find(a => a.id === 'P');
      const tg = g.actors.find(a => a.id === 'T');
      const c = cs();
      const e = c.enemies.find(y => y.id === 'T');
      if (!e) break;
      if (hp0 === null) hp0 = e.hp;
      if (me.hitbox_active) {
        track.push({ f: k, now: me.weapon.now.slice(), prev: me.weapon.prev.slice(), r: me.weapon.r,
                     hb: tg ? tg.hurtboxes.map(h => ({ id:h.id, a:h.a.slice(), b:h.b.slice(), r:h.r })) : [] });
      }
      if (!hit && e.hp < hp0) { hit = true; hitFrame = k; }
      if (k > 6 && c.player.state === 'IDLE') break;
    }
    return { hit, hitFrame, track };
  };
  // continuous analytic over a track, returns {hit, minGap}
  const analytic = (track, N) => {
    let hit = false, minGap = Infinity;
    for (const t of track) {
      for (let s = 0; s <= N; s++) {
        const u = s / N;
        const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
        const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
        for (const h of t.hb) {
          const d = segSegDist(a,b,h.a,h.b) - (t.r + h.r);
          if (d < minGap) minGap = d;
          if (d <= 0) hit = true;
        }
      }
    }
    return { hit, minGap: +minGap.toFixed(5) };
  };
  const R = { m2: [], phantom: [], thin_pole: [] };
  const WEAPONS = ['dagger','straight-sword','spear','axe','halberd','greatsword','ultra-greatsword'];

  // ---- M2: 7 classes x 24 offsets, sim vs analytic, same run ----
  for (const w of WEAPONS) {
    const rows = [];
    for (let i = 0; i < 24; i++) {
      const off = +(i * 0.09).toFixed(4);
      const r = run(w, off, 1.4);
      const A64 = analytic(r.track, 64);
      const A4  = analytic(r.track, 4);
      const A1  = analytic(r.track, 1);
      rows.push({ offset_m: off, sim_hit: r.hit, analytic_hit: A64.hit, min_gap_m: A64.minGap,
                  analytic4_hit: A4.hit, analytic1_hit: A1.hit,
                  agree_continuous: r.hit === A64.hit, agree_4: r.hit === A4.hit });
    }
    R.m2.push({ weapon: w, rows,
      disagree_continuous: rows.filter(r => !r.agree_continuous),
      disagree_4: rows.filter(r => !r.agree_4) });
  }

  // ---- M3 phantom range: fine sweep around the lateral and forward boundaries ----
  for (const [axis, lo, hi] of [['lateral', 1.05, 1.20], ['forward', 2.15, 2.30]]) {
    for (let v = lo; v <= hi + 1e-9; v += 0.005) {
      const q = +v.toFixed(4);
      const r = axis === 'lateral' ? run('straight-sword', q, 1.6) : run('straight-sword', 0, q);
      const A = analytic(r.track, 64);
      R.phantom.push({ axis, offset_m: q, sim_hit: r.hit, analytic_hit: A.hit, min_gap_m: A.minGap });
    }
  }

  // ---- the 0.06 m thin pole, analytically, off the measured track ----
  //  For each class, march a 0.06 m-radius vertical pole across the arc in 0.005 m steps at
  //  the radius where the tip is fastest, and compare the CONTINUOUS swept-hull answer with
  //  the 4-substep DISCRETE-POSE answer. Any offset where continuous=hit and discrete=miss
  //  is a 0.06 m weapon-vs-pole tunnel.
  for (const w of WEAPONS) {
    const r0 = run(w, 40, 1.4);       // target far away: an unobstructed swing
    const track = r0.track;
    if (!track.length) { R.thin_pole.push({ weapon: w, error: 'no active frames' }); continue; }
    const rw = track[0].r, rp = 0.06;
    const poleHit = (x, z, N) => {
      const p0 = [x, 0.0, z], p1 = [x, 2.0, z];
      for (const t of track) {
        for (let s = 0; s <= N; s++) {
          const u = s / N;
          const a = [t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
          const b = [t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
          if (segSegDist(a,b,p0,p1) <= rw + rp) return true;
        }
      }
      return false;
    };
    const tunnels = [];
    let tested = 0, contHits = 0;
    for (let x = -2.0; x <= 2.0001; x += 0.005) {
      for (let z = 0.4; z <= 2.4001; z += 0.05) {
        const xx = +x.toFixed(4), zz = +z.toFixed(4);
        tested++;
        const c = poleHit(xx, zz, 64);
        if (c) contHits++;
        const d4 = poleHit(xx, zz, 4);
        if (c && !d4) tunnels.push({ x: xx, z: zz });
      }
    }
    R.thin_pole.push({ weapon: w, pole_r_m: rp, weapon_r_m: rw, grid_points: tested,
      continuous_hits: contHits, tunnels_at_4_substeps: tunnels.length,
      tunnel_examples: tunnels.slice(0, 12) });
  }
  return R;
},


// ---------------------------------------------------------------------------------------
// C8 — the decisive discriminator: is the shipped sweep CONTINUOUS (convex hull per substep)
//      or DISCRETE (5 sampled poses)?  Search for target placements where the continuous
//      swept volume contains the target but the 4-substep DISCRETE-POSE model does not,
//      then put a real target there and ask the simulation.
//      A discrete implementation misses them (tunnelling). A hull implementation hits them.
// ---------------------------------------------------------------------------------------
discriminate() {
  const H = window.__HARNESS;
  const cs = () => H.getCombatState();
  const segSegDist = (p1,q1,p2,q2) => {
    const d1=[q1[0]-p1[0],q1[1]-p1[1],q1[2]-p1[2]], d2=[q2[0]-p2[0],q2[1]-p2[1],q2[2]-p2[2]];
    const r=[p1[0]-p2[0],p1[1]-p2[1],p1[2]-p2[2]];
    const a=d1[0]*d1[0]+d1[1]*d1[1]+d1[2]*d1[2], e=d2[0]*d2[0]+d2[1]*d2[1]+d2[2]*d2[2];
    const f=d2[0]*r[0]+d2[1]*r[1]+d2[2]*r[2];
    const c=d1[0]*r[0]+d1[1]*r[1]+d1[2]*r[2];
    const b=d1[0]*d2[0]+d1[1]*d2[1]+d1[2]*d2[2];
    const den=a*e-b*b;
    let s = den>1e-12 ? Math.min(1,Math.max(0,(b*f-c*e)/den)) : 0;
    let t=(b*s+f)/e;
    if (t<0){t=0;s=Math.min(1,Math.max(0,-c/a));} else if (t>1){t=1;s=Math.min(1,Math.max(0,(b-c)/a));}
    const c1=[p1[0]+d1[0]*s,p1[1]+d1[1]*s,p1[2]+d1[2]*s];
    const c2=[p2[0]+d2[0]*t,p2[1]+d2[1]*t,p2[2]+d2[2]*t];
    return Math.hypot(c1[0]-c2[0],c1[1]-c2[1],c1[2]-c2[2]);
  };
  const simRun = (weapon, x, z) => {
    H.setSeed(2026); H.loadState('arena_flat'); H.setLoadout({ weapon });
    H.spawn('dummy_passive', x, z, { as: 'T' });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']}]);
    let hp0=null, hit=false;
    for (let k=0;k<130;k++){ H.stepFrames(1);
      const e = cs().enemies.find(y=>y.id==='T'); if(!e) break;
      if(hp0===null) hp0=e.hp; if(e.hp<hp0){hit=true;break;}
      if (k>6 && cs().player.state==='IDLE') break; }
    return hit;
  };
  const R = { weapons: [] };
  for (const w of ['halberd','spear','straight-sword','ultra-greatsword','greatsword']) {
    // unobstructed track + the target's rest hurtbox rig at a reference spawn
    H.setSeed(2026); H.loadState('arena_flat'); H.setLoadout({ weapon: w });
    H.spawn('dummy_passive', 40, 1.4, { as: 'REF' });
    H.stepFrames(6);
    H.queueInputs([{f:1, press:['light']}, {f:3, release:['light']}]);
    const track = [];
    let ref = null;
    for (let k=0;k<130;k++){
      H.stepFrames(1);
      const g=H.getHitGeometry();
      const me=g.actors.find(a=>a.id==='P');
      const tg=g.actors.find(a=>a.id==='REF');
      if (!ref && tg) ref = tg.hurtboxes.map(h=>({id:h.id,a:h.a.slice(),b:h.b.slice(),r:h.r}));
      if (me.hitbox_active) track.push({ now: me.weapon.now.slice(), prev: me.weapon.prev.slice(), r: me.weapon.r });
      if (k>6 && cs().player.state==='IDLE') break;
    }
    if (!track.length || !ref) { R.weapons.push({weapon:w, error:'no track'}); continue; }
    const rw = track[0].r;
    // hurtboxes translated to a candidate (x,z): the reference was spawned at (40,1.4)
    const cover = (dx, dz, N) => {
      for (const t of track) {
        for (let s=0;s<=N;s++){
          const u=s/N;
          const a=[t.prev[0]+(t.now[0]-t.prev[0])*u, t.prev[1]+(t.now[1]-t.prev[1])*u, t.prev[2]+(t.now[2]-t.prev[2])*u];
          const b=[t.prev[3]+(t.now[3]-t.prev[3])*u, t.prev[4]+(t.now[4]-t.prev[4])*u, t.prev[5]+(t.now[5]-t.prev[5])*u];
          for (const h of ref) {
            const ha=[h.a[0]+dx,h.a[1],h.a[2]+dz], hb=[h.b[0]+dx,h.b[1],h.b[2]+dz];
            if (segSegDist(a,b,ha,hb) <= rw + h.r) return true;
          }
        }
      }
      return false;
    };
    const cands = [];
    for (let x=-2.2; x<=2.2001 && cands.length<400; x+=0.0025) {
      for (let z=0.5; z<=2.5001; z+=0.025) {
        const dx = +(x-40).toFixed(4), dz = +(z-1.4).toFixed(4);
        if (cover(dx,dz,64) && !cover(dx,dz,4)) cands.push({ x:+x.toFixed(4), z:+z.toFixed(4) });
      }
    }
    // ask the simulation at up to 25 of them
    const probed = [];
    for (const c of cands.slice(0, 25)) probed.push({ x:c.x, z:c.z, sim_hit: simRun(w, c.x, c.z) });
    R.weapons.push({ weapon: w, hitbox_r_m: rw,
      candidates_found: cands.length, probed,
      sim_missed_count: probed.filter(p=>!p.sim_hit).length,
      verdict: cands.length === 0 ? 'no discriminating placement exists for this target rig'
        : (probed.every(p=>p.sim_hit) ? 'CONTINUOUS — sim hits every placement the discrete model would miss'
          : 'DISCRETE — sim misses placements the continuous hull covers (TUNNELLING)') });
  }
  return R;
},

};

const list = which === 'all' ? Object.keys(PROBES) : which.split(',');
const results = {};
for (const name of list) {
  if (!PROBES[name]) { console.error('no such probe: ' + name); continue; }
  const t0 = Date.now();
  process.stderr.write(`[critic] running ${name} ...\n`);
  const src = 'function ' + PROBES[name].toString();
  const res = await handle.page.evaluate(`(${src})()`);
  results[name] = res;
  const p = path.join(OUTDIR, `critic-${name}.json`);
  fs.writeFileSync(p, JSON.stringify(res, null, 1));
  process.stderr.write(`[critic] ${name} done in ${((Date.now()-t0)/1000).toFixed(1)}s -> ${p}\n`);
}
fs.writeFileSync(path.join(OUTDIR, 'critic-run-meta.json'), JSON.stringify({
  ran: list, at: new Date().toISOString(), build: handle.buildInfo, url: handle.url,
  pageErrors: handle.errors.slice(0, 20),
}, null, 1));
await handle.close();
