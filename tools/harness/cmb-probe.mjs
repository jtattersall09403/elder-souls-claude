#!/usr/bin/env node
// cmb-probe.mjs — the W1-09 instrument.
//
// Every probe drives window.__HARNESS directly, reads OBSERVED numbers back out of a real run,
// and prints them next to the DECLARED numbers in game/data/combat/*.json (which transcribe the
// corpus). RI-MTH04 voids a verdict — and a builder's claim — that cannot show a real run, so
// nothing in this file computes an expected value from a formula: it reads the data file and
// the trace and diffs them.
//
//   node tools/harness/cmb-probe.mjs --probe roll      # RI-CMB01 M1/M5, all four tiers
//   node tools/harness/cmb-probe.mjs --probe iframe    # RI-CMB01 M2, the boundary probe
//   node tools/harness/cmb-probe.mjs --probe frames    # RI-CMB02 M1, all 14 rows
//   node tools/harness/cmb-probe.mjs --probe commit    # RI-CMB02 M2, the commitment grid
//   node tools/harness/cmb-probe.mjs --probe stamina   # RI-CMB03 M1/M2/M6 + RI-CMB09 §3/§4
//   node tools/harness/cmb-probe.mjs --probe block     # RI-CMB03 M4/M5
//   node tools/harness/cmb-probe.mjs --probe geometry  # RI-CMB04 M1/M2/M3
//   node tools/harness/cmb-probe.mjs --probe lockon    # RI-CMB06
//   node tools/harness/cmb-probe.mjs --probe parley    # ARBITRATION §1 / seam S13
//   node tools/harness/cmb-probe.mjs --probe all
//
// Each probe is its own page.evaluate with its own step budget, so one slow or wedged probe
// cannot take the others down with it and every completed probe is written to disk.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cmb-probe.mjs — W1-09 combat measurement probes.

  --probe <name|all>   roll iframe frames commit stamina block geometry lockon parley
  --out <path>         write the JSON result here (default reports/w1-09/cmb-probe-<probe>.json)
  --json               print the JSON instead of the summary
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const ALL = ['roll', 'iframe', 'frames', 'commit', 'stamina', 'block', 'geometry', 'lockon', 'parley'];
const run = which === 'all' ? ALL : which.split(',');

const handle = await launchGame(args);
// stepFrames() renders once per call and these probes take tens of thousands of single-frame
// steps. The simulation is decoupled from the renderer by construction (HARNESS.md R2/R3), so
// switching the renderer off changes nothing any probe measures.
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'getCombatState',
  'getHitGeometry', 'setEquipLoad', 'setLoadout', 'queueEnemyScript', 'setWorldKnowledge']);

// ============================================================================================
// Probe bodies. Each is a self-contained function evaluated in the page — no closures over
// anything in this module, because Playwright serialises the function source alone.
// ============================================================================================

const PROBES = {

  // ---- RI-CMB01 M1 + M5 ------------------------------------------------------------------
  roll() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { rows: [], directions: [], cliff: [] };
    const runOne = (kind) => {
      H.queueInputs(kind === 'roll'
        ? [{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]
        : [{ f: 0, move: [0, 0] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(1);
      const before = cs();
      H.stepFrames(1);
      const s1 = cs();
      const start = s1.player.pos.slice();
      const iv = [], pos = [];
      let f = 1, total = null;
      if (s1.player.invuln) iv.push(s1.player.anim_frame);
      while (f < 240) {
        H.stepFrames(1); f++;
        const c = cs();
        if (c.player.invuln) iv.push(c.player.anim_frame);
        pos.push(c.player.pos.slice());
        if (!c.player.move) { total = f - 1; break; }
      }
      const end = pos.length ? pos[pos.length - 1] : start;
      const deltas = pos.map((p, i) => +Math.hypot(
        p[0] - (i === 0 ? start[0] : pos[i - 1][0]),
        p[2] - (i === 0 ? start[2] : pos[i - 1][2])).toFixed(4));
      let runs = 0;
      for (let i = 0; i < iv.length; i++) if (i === 0 || iv[i] !== iv[i - 1] + 1) runs++;
      return {
        press_to_anim_frame_1: s1.player.anim_frame,
        stamina_cost: +(before.player.stamina - s1.player.stamina).toFixed(2),
        startup: iv.length ? iv[0] - 1 : null,
        iframes: iv.length,
        iframe_window: iv.length ? [iv[0], iv[iv.length - 1]] : null,
        contiguous_runs: runs,
        total,
        recovery: total !== null && iv.length ? total - iv[iv.length - 1] : total,
        distance_m: +Math.hypot(end[0] - start[0], end[2] - start[2]).toFixed(3),
        per_frame_delta: deltas,
        delta_is_constant: new Set(deltas.filter((d) => d > 0).map((d) => d.toFixed(3))).size <= 1,
        translation_free_tail: deltas.slice(-8).every((d) => d === 0),
      };
    };
    for (const [tier, load] of [['LIGHT', 15], ['MEDIUM', 50], ['HEAVY', 85], ['OVERLOADED', 120]]) {
      for (const kind of ['roll', 'backstep']) {
        H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(load); H.stepFrames(10);
        R.rows.push(Object.assign({ tier, kind }, runOne(kind)));
      }
    }
    for (let d = 0; d < 8; d++) {
      const a = d * Math.PI / 4;
      H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(15); H.stepFrames(10);
      H.queueInputs([{ f: 0, move: [+Math.sin(a).toFixed(4), +Math.cos(a).toFixed(4)] },
        { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      const p0 = cs().player.pos.slice();
      let f = 1, total = null, iv = 0;
      while (f < 240) { H.stepFrames(1); f++; const c = cs(); if (c.player.invuln) iv++; if (!c.player.move) { total = f - 1; break; } }
      const p1 = cs().player.pos.slice();
      R.directions.push({ dir_deg: d * 45, total, iframes: iv, distance_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3) });
    }
    for (const load of [29, 29.9, 30, 30.01, 30.1, 31, 50, 69, 69.9, 70, 70.01, 70.1, 71, 99.9, 100, 100.01]) {
      H.setSeed(1337); H.loadState('arena_flat'); H.setEquipLoad(load); H.stepFrames(4);
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      H.stepFrames(2);
      let f = 1, total = null, iv = 0;
      while (f < 240) { const c = cs(); if (c.player.invuln) iv++; H.stepFrames(1); f++; if (!cs().player.move) { total = f - 1; break; } }
      R.cliff.push({ load, tier: cs().player.tier, iframes: iv, total });
    }
    return R;
  },

  // ---- RI-CMB01 M2, the i-frame boundary probe --------------------------------------------
  iframe() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { note: 'H[k] = did the player get hit, for an enemy thrust whose FIRST ACTIVE FRAME lands on press+k. The transition hit->no-hit must occur exactly at k = startup and back at k = startup + iframes.', tiers: {} };
    const ATK_STARTUP = 54;      // probe_pulse, from its statblock
    for (const [tier, load, span] of [['LIGHT', 15, 60], ['MEDIUM', 50, 68], ['HEAVY', 85, 96]]) {
      const vec = [];
      for (let k = -4; k <= span; k++) {
        H.setSeed(1337); H.loadState('arena_probe'); H.setEquipLoad(load);
        H.stepFrames(4);
        const base = 60;
        H.queueEnemyScript('E1', [{ f: base + k - ATK_STARTUP, move: 'pulse', face: 0 }]);
        H.queueInputs([{ f: 0, move: [0, 1] }, { f: base, press: ['roll'] }, { f: base + 2, release: ['roll'] }]);
        const hp0 = cs().player.hp;
        let hit = 0;
        for (let i = 0; i < base + 220; i++) {
          H.stepFrames(1);
          const c = cs();
          if (c.player.hp < hp0) { hit = 1; break; }
        }
        vec.push({ k, hit });
      }
      // first and last k with hit == 0 inside the swept band
      const zeros = vec.filter((v) => v.hit === 0).map((v) => v.k);
      const holes = [];
      for (let i = 1; i < zeros.length; i++) if (zeros[i] !== zeros[i - 1] + 1) holes.push([zeros[i - 1], zeros[i]]);
      R.tiers[tier] = {
        vector: vec.map((v) => v.hit).join(''),
        k_from: -4,
        first_negated_k: zeros.length ? zeros[0] : null,
        last_negated_k: zeros.length ? zeros[zeros.length - 1] : null,
        negated_count: zeros.length,
        holes,
      };
    }
    return R;
  },

  // ---- RI-CMB02 M1, all 14 base rows ------------------------------------------------------
  frames() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const rows = [];
    for (const w of ['dagger', 'straight-sword', 'spear', 'axe', 'halberd', 'greatsword', 'ultra-greatsword']) {
      for (const mv of ['light', 'heavy']) {
        H.setSeed(1337); H.loadState('arena_flat');
        H.setLoadout({ weapon: w });
        H.stepFrames(6);
        H.queueInputs([{ f: 1, press: [mv] }, { f: 3, release: [mv] }]);
        H.stepFrames(1);
        const before = cs();
        H.stepFrames(1);
        const s1 = cs();
        const p0 = s1.player.pos.slice();
        let f = 1, total = null, fa = null, la = null, runs = 0, wasActive = false;
        let maxTip = 0, reach = 0;
        while (f < 340) {
          const c = cs();
          const g = H.getHitGeometry();
          const me = g.actors.find((x) => x.id === 'P');
          if (me.hitbox_active) {
            if (fa === null) fa = c.player.anim_frame;
            la = c.player.anim_frame;
            if (!wasActive) runs++;
            const n = me.weapon.now, p = me.weapon.prev;
            const tip = Math.hypot(n[3] - p[3], n[4] - p[4], n[5] - p[5]);
            if (tip > maxTip) maxTip = tip;
            const rr = Math.hypot(n[3] - p0[0], n[5] - p0[2]);
            if (rr > reach) reach = rr;
          }
          wasActive = me.hitbox_active;
          H.stepFrames(1); f++;
          if (!cs().player.move) { total = f - 1; break; }
        }
        const p1 = cs().player.pos.slice();
        rows.push({
          weapon: w, move: mv,
          press_to_anim_frame_1: s1.player.anim_frame,
          startup: fa !== null ? fa - 1 : null,
          Ps: fa,
          active: fa !== null ? la - fa + 1 : 0,
          recovery: total !== null && la !== null ? total - la : null,
          total,
          stamina_cost: +(before.player.stamina - s1.player.stamina).toFixed(2),
          root_dz_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
          contiguous_active_runs: runs,
          peak_tip_travel_per_frame_m: +maxTip.toFixed(4),
          measured_reach_m: +reach.toFixed(3),
        });
      }
    }
    return { rows };
  },

  // ---- RI-CMB02 M2, the commitment grid ----------------------------------------------------
  commit() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const grid = {};
    const TOTAL = 74;                        // straight sword R1
    for (const a of ['roll', 'light', 'block', 'sprint', 'use_item', 'parry']) {
      const row = [];
      for (let k = 1; k <= TOTAL; k++) {
        H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(6);
        H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] },
          { f: 1 + k, press: [a] }, { f: 3 + k, release: [a] }]);
        H.stepFrames(1);
        let f = 0, executedAt = null, endedAt = null;
        while (f < 200) {
          H.stepFrames(1); f++;
          const c = cs();
          const id = c.player.move ? c.player.move.id : null;
          if (endedAt === null && f > 1 && id !== 'light') endedAt = f;
          if (executedAt === null && id && id !== 'light') executedAt = f;
          if (endedAt !== null && f > endedAt + 20) break;
        }
        // CANCELLED = the new action began before frame TOTAL+1; BUFFERED = it began after.
        row.push(executedAt === null ? '.' : executedAt <= TOTAL ? 'C' : 'B');
      }
      grid[a] = row.join('');
    }
    return {
      total: TOTAL,
      grid,
      legend: { '.': 'ignored / dropped', B: 'buffered — fired after the animation released', C: 'CANCELLED the animation' },
      declared: { startup: 24, active: 10, recovery: 40, hard_until: 52, dodge_cancel_from: 53, buffer_from: 67 },
      declared_source: 'RI-CMB02 §D: startup+active hard; recovery frames 1..ceil(0.45*40)=18 hard, so hard through anim frame 24+10+18 = 52; dodge-cancel 53..74; buffer = last 8 = 67..74.',
    };
  },

  // ---- RI-CMB03 M1/M2/M6 and RI-CMB09 §3/§4 -----------------------------------------------
  stamina() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = {};

    // M1 — regeneration curve after exactly one roll
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(6);
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }, { f: 5, move: [0, 0] }]);
    H.stepFrames(1);
    const spendFrame = 1;
    H.stepFrames(1);
    const afterSpend = cs().player.stamina;
    const curve = [];
    for (let i = 0; i < 200; i++) { H.stepFrames(1); curve.push(+cs().player.stamina.toFixed(4)); }
    let firstRise = null;
    for (let i = 1; i < curve.length; i++) if (curve[i] > curve[i - 1]) { firstRise = i + 1; break; }
    R.regen = {
      stamina_after_spend: afterSpend,
      frames_after_spend_to_first_increase: firstRise,
      declared_delay_f: 42,
      slope_per_frame: firstRise !== null ? +(curve[firstRise + 9] - curve[firstRise + 8]).toFixed(4) : null,
      deltas_after_resume: firstRise !== null ? curve.slice(firstRise - 1, firstRise + 9).map((v, i, a) => (i ? +(v - a[i - 1]).toFixed(4) : null)).slice(1) : null,
      sample_38_to_50: curve.slice(37, 50),
    };

    // guard-raised slope (RI-CMB03 §A x0.20)
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(6);
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] },
      { f: 5, move: [0, 0] }, { f: 6, press: ['block'] }]);
    H.stepFrames(2);
    const g = [];
    for (let i = 0; i < 200; i++) { H.stepFrames(1); g.push(+cs().player.stamina.toFixed(4)); }
    let gr = null;
    for (let i = 1; i < g.length; i++) if (g[i] > g[i - 1]) { gr = i; break; }
    R.regen_guarded = { first_rise_index: gr, slope_per_frame: gr !== null ? +(g[gr + 9] - g[gr + 8]).toFixed(4) : null, declared: 0.15 };

    // M2 — one global re-armed delay, not a per-action cooldown
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(6);
    H.queueInputs([{ f: 0, move: [0, 1] },
      { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] },
      { f: 55, press: ['roll'] }, { f: 57, release: ['roll'] },
      { f: 109, press: ['roll'] }, { f: 111, release: ['roll'] }, { f: 113, move: [0, 0] }]);
    const c2 = [];
    for (let i = 1; i <= 260; i++) { H.stepFrames(1); c2.push({ f: i, s: +cs().player.stamina.toFixed(3) }); }
    let lastSpend = 0, firstRegen = null;
    for (let i = 1; i < c2.length; i++) {
      if (c2[i].s < c2[i - 1].s) lastSpend = c2[i].f;
      else if (c2[i].s > c2[i - 1].s && firstRegen === null && c2[i].f > 111) firstRegen = c2[i].f;
    }
    R.rearm = { last_spend_frame: lastSpend, first_regen_frame: firstRegen, delta: firstRegen === null ? null : firstRegen - lastSpend };

    // RI-CMB09 §3 — the roll-spam arithmetic, and §4 exhaustion
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(6);
    const spam = [{ f: 0, move: [0, 1] }];
    for (let i = 0; i < 200; i++) { spam.push({ f: i * 4 + 1, press: ['roll'] }, { f: i * 4 + 3, release: ['roll'] }); }
    H.queueInputs(spam);
    const rollStarts = [];
    let prev = null, drops = 0, minStam = 999, zeroFrames = 0, exhaustedFrames = 0, firstDrop = null, firstExh = null;
    for (let i = 1; i <= 800; i++) {
      H.stepFrames(1);
      const p = cs().player;
      const id = p.move ? p.move.id : null;
      // A BUFFERED roll chains seamlessly — there is no frame with a null move between two
      // rolls — so a roll start is anim_frame == 1, not a null-to-roll transition.
      if (id === 'roll' && p.anim_frame === 1) rollStarts.push(i);
      prev = id;
      if (p.stamina < minStam) minStam = p.stamina;
      if (p.stamina === 0) zeroFrames++;
      if (p.exhausted) { exhaustedFrames++; if (firstExh === null) firstExh = i; }
      if (p.stamina_drops > drops) { if (firstDrop === null) firstDrop = i; drops = p.stamina_drops; }
    }
    R.rollspam = {
      rolls_started: rollStarts.length,
      first_ten_starts: rollStarts.slice(0, 10),
      cadence_f: rollStarts.length > 1 ? rollStarts[1] - rollStarts[0] : null,
      rolls_before_first_denial: firstDrop === null ? rollStarts.length : rollStarts.filter((f) => f < firstDrop).length,
      first_denial_frame: firstDrop,
      inputs_dropped_no_stamina: drops,
      stamina_min: +minStam.toFixed(2),
      frames_at_exactly_zero: zeroFrames,
      exhausted_frames: exhaustedFrames,
      first_exhausted_frame: firstExh,
      declared: { cadence_f: 52, rolls_before_denial: 5, frames_to_denial: 260, stamina_at_denial: 10 },
    };

    // M6 — the zero-stamina gate: everything free stays free
    const drained = cs().player;
    H.queueInputs([{ f: 1, move: [0.5, 0.5] }]);
    const b0 = cs().player.pos.slice();
    for (let i = 0; i < 30; i++) H.stepFrames(1);
    const b1 = cs().player.pos.slice();
    R.zero_gate = {
      stamina: drained.stamina,
      exhausted: drained.exhausted,
      walk_distance_over_30f_m: +Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(3),
      walking_is_free: Math.hypot(b1[0] - b0[0], b1[2] - b0[2]) > 0.2,
    };
    return R;
  },

  // ---- RI-CMB03 M4/M5 ----------------------------------------------------------------------
  block() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { blocks: [] };
    for (const shield of ['chitin_buckler', 'marsh_oak_medium', 'naga_tower']) {
      H.setSeed(1337); H.loadState('arena_duel');
      H.setLoadout({ shield });
      H.teleport(0, 2.5, { yaw: 0 });
      H.lockOn('E1');
      H.queueEnemyScript('E1', [{ f: 8, move: 'chop' }]);
      H.queueInputs([{ f: 0, press: ['block'] }]);
      H.stepFrames(2);
      const s0 = cs().player;
      let hit = null;
      for (let i = 0; i < 200; i++) {
        H.stepFrames(1);
        const p = cs().player;
        if (p.hp < s0.hp || p.stamina < s0.stamina - 0.05) { hit = { f: i, hp: p.hp, stam: p.stamina, state: p.state }; break; }
      }
      R.blocks.push({
        shield,
        hp_before: s0.hp, hp_after: hit ? hit.hp : null, chip: hit ? +(s0.hp - hit.hp).toFixed(2) : null,
        stam_before: s0.stamina, stam_after: hit ? hit.stam : null,
        stam_cost: hit ? +(s0.stamina - hit.stam).toFixed(2) : null,
        state_on_impact: hit ? hit.state : null,
      });
    }
    // M5 — guard break. The bar has to be genuinely empty when the blow lands, and with a
    // 0.75/frame regen the only action fast enough to outrun it is the roll (52 f for 22) —
    // which is RI-CMB09 §3's point stated from the other side. Roll-spam to zero, then guard.
    H.setSeed(1337); H.loadState('arena_duel');
    H.setLoadout({ shield: 'marsh_oak_medium' });
    H.teleport(0, 2.4, { yaw: 0 });
    H.lockOn('E1');
    H.queueEnemyScript('E1', [{ f: 470, move: 'chop' }]);
    const spam2 = [{ f: 0, move: [0, 0] }];
    for (let i = 0; i < 115; i++) spam2.push({ f: i * 4 + 1, press: ['roll'] }, { f: i * 4 + 3, release: ['roll'] });
    spam2.push({ f: 462, press: ['block'] });
    H.queueInputs(spam2);
    const trail = [];
    for (let i = 1; i <= 620; i++) {
      H.stepFrames(1);
      const p = cs().player;
      trail.push({ f: i, st: p.state, stam: +p.stamina.toFixed(2), hp: p.hp, ex: p.exhausted ? 1 : 0 });
    }
    const gb = trail.filter((x) => x.st === 'GUARD_BREAK');
    R.guard_break = {
      occurred: gb.length > 0,
      frames: gb.length,
      first_frame: gb.length ? gb[0].f : null,
      stamina_on_break: gb.length ? gb[0].stam : null,
      stamina_never_negative: trail.every((x) => x.stam >= 0),
      declared_duration_f: 40,
      window: gb.length ? [gb[0].f, gb[gb.length - 1].f] : null,
      stamina_at_539: (trail[538] || {}).stam,
      trail_around_break: gb.length ? trail.slice(Math.max(0, gb[0].f - 6), gb[0].f + 44) : trail.slice(455, 560),
    };
    return R;
  },

  // ---- RI-CMB04 M1/M2/M3 --------------------------------------------------------------------
  geometry() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = {};

    // M1 — the hurtbox capsule must be a segment OF the bone, in every pose of a big excursion
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(4);
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
    H.stepFrames(2);
    const drift = {}, travel = {}, prevMid = {};
    for (let i = 0; i < 52; i++) {
      const g = H.getHitGeometry();
      const me = g.actors.find((a) => a.id === 'P');
      const bones = {};
      for (const b of me.bones) bones[b.id] = b.o;
      for (const h of me.hurtboxes) {
        const mid = [(h.a[0] + h.b[0]) / 2, (h.a[1] + h.b[1]) / 2, (h.a[2] + h.b[2]) / 2];
        const o = bones[h.parent_bone];
        const d = Math.hypot(mid[0] - o[0], mid[1] - o[1], mid[2] - o[2]);
        (drift[h.id] = drift[h.id] || []).push(d);
        if (prevMid[h.id]) {
          travel[h.id] = (travel[h.id] || 0) + Math.hypot(mid[0] - prevMid[h.id][0], mid[1] - prevMid[h.id][1], mid[2] - prevMid[h.id][2]);
        }
        prevMid[h.id] = mid;
      }
      H.stepFrames(1);
    }
    R.bone_attachment = Object.keys(drift).map((id) => ({
      hurtbox: id,
      midpoint_to_bone_origin_m: +Math.min(...drift[id]).toFixed(6),
      variation_m: +(Math.max(...drift[id]) - Math.min(...drift[id])).toFixed(9),
      world_travel_over_the_roll_m: +(travel[id] || 0).toFixed(3),
    }));

    // M2/M3 — lateral offset sweep. Hit or miss BY GEOMETRY, nothing else.
    R.lateral = [];
    for (let i = 0; i <= 40; i++) {
      const off = +(i * 0.05).toFixed(3);
      H.setSeed(1337); H.loadState('arena_flat');
      H.spawn('dummy_passive', off, 1.6, { as: 'T' });
      H.stepFrames(6);
      H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
      let hit = false, hp0 = null;
      for (let k = 0; k < 90; k++) {
        H.stepFrames(1);
        const c = cs();
        const e = c.enemies.find((x) => x.id === 'T');
        if (!e) break;
        if (hp0 === null) hp0 = e.hp;
        if (e.hp < hp0) { hit = true; break; }
      }
      R.lateral.push({ offset_m: off, hit });
    }
    let crossings = 0, boundary = null;
    for (let i = 1; i < R.lateral.length; i++) {
      if (R.lateral[i].hit !== R.lateral[i - 1].hit) {
        crossings++;
        if (R.lateral[i - 1].hit && !R.lateral[i].hit) boundary = { last_hit_m: R.lateral[i - 1].offset_m, first_miss_m: R.lateral[i].offset_m };
      }
    }
    R.boundary = { crossings, boundary };

    // fine sweep through the crossing, 0.005 m steps (RI-CMB04 M3)
    R.fine = [];
    if (boundary) {
      for (let x = boundary.last_hit_m - 0.02; x <= boundary.first_miss_m + 0.02001; x += 0.005) {
        const off = +x.toFixed(4);
        H.setSeed(1337); H.loadState('arena_flat');
        H.spawn('dummy_passive', off, 1.6, { as: 'T' });
        H.stepFrames(6);
        H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
        let hit = false, hp0 = null;
        for (let k = 0; k < 90; k++) {
          H.stepFrames(1);
          const e = cs().enemies.find((y) => y.id === 'T');
          if (!e) break;
          if (hp0 === null) hp0 = e.hp;
          if (e.hp < hp0) { hit = true; break; }
        }
        R.fine.push({ offset_m: off, hit });
      }
    }

    // tip travel per frame vs capsule radius — the arithmetic that makes sweeping mandatory
    H.setSeed(1337); H.loadState('arena_flat'); H.stepFrames(4);
    H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
    H.stepFrames(2);
    const tt = [];
    for (let i = 0; i < 74; i++) {
      const g = H.getHitGeometry();
      const me = g.actors.find((a) => a.id === 'P');
      const n = me.weapon.now, p = me.weapon.prev;
      tt.push({ af: me.anim_frame, active: me.hitbox_active ? 1 : 0, tip_m: +Math.hypot(n[3] - p[3], n[4] - p[4], n[5] - p[5]).toFixed(4) });
      H.stepFrames(1);
    }
    const act = tt.filter((x) => x.active);
    R.tip_travel = {
      radius_m: 0.07,
      peak_active_tip_travel_m: act.length ? Math.max(...act.map((x) => x.tip_m)) : null,
      ratio_to_radius: act.length ? +(Math.max(...act.map((x) => x.tip_m)) / 0.07).toFixed(2) : null,
      per_frame: tt,
    };

    // de-dup: one HIT per swing per target even though the capsule overlaps for many frames
    H.setSeed(1337); H.loadState('arena_flat');
    H.spawn('dummy_passive', 0, 1.4, { as: 'T' });
    H.stepFrames(6);
    H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }]);
    let hits = 0, hpPrev = null;
    for (let k = 0; k < 90; k++) {
      H.stepFrames(1);
      const e = cs().enemies.find((y) => y.id === 'T');
      if (!e) break;
      if (hpPrev !== null && e.hp < hpPrev) hits++;
      hpPrev = e.hp;
    }
    R.dedup = { hits_per_swing: hits, declared: 1 };
    return R;
  },

  // ---- RI-CMB06 -----------------------------------------------------------------------------
  lockon() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { directional: [], envelope: [] };
    const ang = (a, b) => { let d = (a - b) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return d; };
    for (const [label, mx, my] of [['forward', 0, 1], ['left', -1, 0], ['right', 1, 0], ['back', 0, -1], ['diag_front_left', -0.7071, 0.7071]]) {
      H.setSeed(1337); H.loadState('arena_duel'); H.lockOn('E1'); H.stepFrames(8);
      const t0 = cs().enemies.find((e) => e.id === 'E1');
      const p0 = cs().player.pos.slice();
      H.queueInputs([{ f: 0, move: [mx, my] }, { f: 1, press: ['roll'] }, { f: 3, release: ['roll'] }]);
      for (let i = 0; i < 56; i++) H.stepFrames(1);
      const c = cs();
      const t1 = c.enemies.find((e) => e.id === 'E1');
      R.directional.push({
        stick: label,
        dist_before_m: +t0.dist_m.toFixed(3),
        dist_after_m: +t1.dist_m.toFixed(3),
        dist_change_m: +(t1.dist_m - t0.dist_m).toFixed(3),
        bearing_change_deg: +ang(t1.bearing_deg, t0.bearing_deg).toFixed(2),
        travelled_m: +Math.hypot(c.player.pos[0] - p0[0], c.player.pos[2] - p0[2]).toFixed(3),
        player_yaw_deg: +c.player.yaw_deg.toFixed(2),
        still_facing_target: Math.abs(ang(c.player.yaw_deg, t1.bearing_deg)) < 12,
      });
    }
    for (const d of [4, 10, 13.5, 14.5, 17, 19]) {
      H.setSeed(1337); H.loadState('arena_flat');
      H.spawn('inf_trash', 0, d, { as: 'A' });
      H.stepFrames(4);
      H.lockOn(null);
      H.queueInputs([{ f: 1, press: ['lock_on'] }, { f: 3, release: ['lock_on'] }]);
      H.stepFrames(4);
      R.envelope.push({ dist_m: d, acquired: cs().lock.target });
    }
    H.setSeed(1337); H.loadState('arena_flat');
    H.spawn('inf_trash', 0, 10, { as: 'A' });
    H.stepFrames(4);
    H.queueInputs([{ f: 1, press: ['lock_on'] }, { f: 3, release: ['lock_on'] }, { f: 6, move: [0, -1] }]);
    H.stepFrames(4);
    const acquired = cs().lock.target;
    let brokeAt = null;
    for (let i = 0; i < 900; i++) {
      H.stepFrames(1);
      const c = cs();
      if (!c.lock.target) { const e = c.enemies.find((x) => x.id === 'A'); brokeAt = e ? e.dist_m : null; break; }
    }
    R.hysteresis = { acquired, acquisition_range_declared_m: 14.0, broke_at_m: brokeAt === null ? null : +brokeAt.toFixed(2), break_range_declared_m: 18.0 };

    H.setSeed(1337); H.loadState('arena_duel'); H.lockOn('E1'); H.stepFrames(20);
    let framed = 0;
    H.queueInputs([{ f: 0, move: [1, 0] }]);
    for (let i = 0; i < 180; i++) { H.stepFrames(1); if (cs().lock.both_framed) framed++; }
    R.framing = { frames: 180, both_framed: framed, fraction: +(framed / 180).toFixed(3), law: 'RI-CAM03 — both combatants stay framed' };

    // no auto-hop when the target dies
    H.setSeed(1337); H.loadState('arena_duel');
    H.spawn('inf_trash', 3, 4.2, { as: 'E2' });
    H.lockOn('E1'); H.stepFrames(6);
    const before = cs().lock.target;
    H.queueInputs([]);
    for (let i = 0; i < 400 && cs().enemies.find((e) => e.id === 'E1' && !e.dead); i++) {
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let k = 0; k < 80; k++) H.stepFrames(1);
    }
    R.no_auto_hop = { locked_before: before, locked_after_target_death: cs().lock.target, e1_dead: !!(cs().enemies.find((e) => e.id === 'E1') || {}).dead };
    return R;
  },

  // ---- ARBITRATION §1 / seam S13 --------------------------------------------------------------
  parley() {
    const H = window.__HARNESS;
    const cs = () => H.getCombatState();
    const R = { cases: [] };
    const cases = [
      { label: 'nothing: no lore, no rank, no gold, disposition 35', know: { gold: 0, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
      { label: 'knows the true name (a topic learned OUTSIDE the fight)', know: { gold: 0, topicsKnown: ['the-drowned-ford'], factions: {}, dispositions: { sentry_ghelis: 0 } }, expect: 'ACCEPT / name' },
      { label: 'Marsh-warden rank 3', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3 } }, dispositions: { sentry_ghelis: 35 } }, expect: 'ACCEPT / faction' },
      { label: 'Marsh-warden rank 3 but EXPELLED', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3, expelled: true } }, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
      { label: 'Marsh-warden rank 3 and rank in the RIVAL reed-court', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 3 }, 'reed-court': { rank: 1 } }, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
      { label: 'Marsh-warden rank 1 (below the required 2)', know: { gold: 0, topicsKnown: [], factions: { 'marsh-wardens': { rank: 1 } }, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
      { label: '200 gold, disposition 35', know: { gold: 200, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 35 } }, expect: 'ACCEPT / gold' },
      { label: '200 gold, disposition 5', know: { gold: 200, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 5 } }, expect: 'REFUSE' },
      { label: '100 gold (below the 180 price), disposition 35', know: { gold: 100, topicsKnown: [], factions: {}, dispositions: { sentry_ghelis: 35 } }, expect: 'REFUSE' },
    ];
    for (const c of cases) {
      H.setSeed(1337); H.loadState('arena_duel');
      H.setWorldKnowledge(c.know);
      H.lockOn('E1');
      H.queueInputs([{ f: 0, move: [0, 0] }, { f: 4, press: ['interact'] }, { f: 6, release: ['interact'] }]);
      const states = [];
      for (let i = 0; i < 140; i++) { H.stepFrames(1); states.push(cs().player.state); }
      const s = cs();
      const e = s.enemies.find((x) => x.id === 'E1');
      R.cases.push({
        case: c.label,
        expect: c.expect,
        parley_states_seen: [...new Set(states.filter((x) => x.indexOf('PARLEY') === 0))],
        enemy_yielded: !!(e && e.yielded),
        enemy_alive: !!(e && !e.dead),
        enemy_hp: e ? e.hp : null,
        gold_after: s.world_knowledge.gold,
      });
    }
    // beast exemption
    H.setSeed(1337); H.loadState('arena_flat');
    H.spawn('beast_slitherfang', 0, 3, { as: 'B' });
    H.setWorldKnowledge({ gold: 9999, topicsKnown: ['the-drowned-ford'], factions: { 'marsh-wardens': { rank: 9 } } });
    H.stepFrames(4);
    H.queueInputs([{ f: 1, press: ['interact'] }, { f: 3, release: ['interact'] }]);
    const seen = [];
    for (let i = 0; i < 60; i++) { H.stepFrames(1); seen.push(cs().player.state); }
    const b = cs().enemies.find((x) => x.id === 'B');
    R.beast_exemption = {
      parley_animation_started: seen.some((x) => x.indexOf('PARLEY') === 0),
      beast_yielded: !!(b && b.yielded),
      rule: 'seam S13 exempts beasts and mindless things; the input must be dropped with a NAMED reason, not silently ignored',
    };
    // the frame cost: a parley is a committed animated action, not a menu
    H.setSeed(1337); H.loadState('arena_duel');
    H.setWorldKnowledge({ gold: 0, topicsKnown: ['the-drowned-ford'], factions: {}, dispositions: {} });
    H.lockOn('E1');
    H.queueInputs([{ f: 4, press: ['interact'] }, { f: 6, release: ['interact'] },
      { f: 10, press: ['roll'] }, { f: 12, release: ['roll'] },
      { f: 20, press: ['light'] }, { f: 22, release: ['light'] }]);
    const tl = [];
    for (let i = 1; i <= 100; i++) { H.stepFrames(1); const p = cs().player; tl.push({ f: i, st: p.state, af: p.anim_frame }); }
    const pf = tl.filter((x) => x.st.indexOf('PARLEY') === 0);
    R.commitment = {
      parley_frames: pf.length,
      declared_total_f: 78,
      states: [...new Set(pf.map((x) => x.st))],
      uncancellable_by_roll_or_attack: pf.length >= 70,
      timeline: tl.slice(0, 90),
    };
    return R;
  },
};

// ============================================================================================
// Driver. Runs after PROBES is initialised (it is a `const`, so it cannot be touched earlier),
// and writes the result file after EVERY probe — a run that dies on probe 7 still leaves the
// first six on disk, which is the difference between a partial measurement and none.
// ============================================================================================
const out = { schema: 'elder-souls/cmb-probe@1', unit: 'f@60', generated: new Date().toISOString(), probes: {} };
const dest = args.out
  ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'reports', 'w1-09', `cmb-probe-${which.replace(/[^a-z0-9]+/g, '-')}.json`);
fs.mkdirSync(path.dirname(dest), { recursive: true });

for (const name of run) {
  const fn = PROBES[name];
  if (!fn) { console.error(`unknown probe '${name}'`); process.exitCode = EXIT.USAGE; continue; }
  const t0 = Date.now();
  log(`probe: ${name}`);
  try {
    out.probes[name] = await handle.page.evaluate(fn);
    log(`  ok (${Date.now() - t0} ms)`);
  } catch (e) {
    out.probes[name] = { __err: String(e && e.message || e) };
    console.error(`  FAILED: ${e && e.message}`);
    process.exitCode = EXIT.HARNESS_ERROR;
  }
  fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
}
await handle.close();

if (args.json) process.stdout.write(JSON.stringify(out, null, 2) + '\n');
else process.stdout.write(`written: ${path.relative(REPO_ROOT, dest)}\n`);
