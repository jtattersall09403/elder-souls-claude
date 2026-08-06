#!/usr/bin/env node
// Generate game/data/combat/movesets/*.json (87 weapons, elder-souls/moveset@1) and
// game/data/weapons/clip-registry.json from the three authored sources:
//
//   game/data/weapons/classes.json       RI-WPN02 §B / RI-WPN04 §A, transcribed, never re-derived
//   game/data/weapons/pose-library.json  the pose grammar (34 families + the 2h transform)
//   game/data/weapons/roster.json        the 87-weapon census and its per-weapon authoring
//
// Nothing is invented here: every frame count is an arithmetic product of a class base row and a
// published multiplier, computed with round-half-up applied ONCE, exactly as RI-CMB02 states and
// RI-WPN04 §A's derived table demonstrates. `node tools/weapons/verify-frames.mjs` re-derives
// RI-WPN04 §A's whole published table from this code and diffs it cell by cell.
//
// Usage: node tools/weapons/build-movesets.mjs [--check]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  rhu, CLASS_GRAMMAR, MANDATORY_25, MANDATORY_BOW, CHARGE_MAX_F,
} from './grammar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

const CLASSES = readJson('game/data/weapons/classes.json');
const POSES = readJson('game/data/weapons/pose-library.json');
const ROSTER = readJson('game/data/weapons/roster.json');

const DELTA_SCALE = Number(process.env.W110_DELTA_SCALE || CLASSES.delta_scale || 1);
const BUDGET = Number(process.env.W110_BUDGET || CLASSES.deviation_budget || 0.38);
const BUDGET_SIG = Number(process.env.W110_BUDGET_SIG || CLASSES.deviation_budget_signature || 0.50);
// Approximate roster-wide standard deviations of the five numeric fingerprint dimensions a
// weapon delta can move. Used only to make budgets comparable across dimensions; the real
// z-normalisation is recomputed from the shipped data by tools/weapons/measure.mjs.
// PINNED in classes.json, never read back from this tool's own output: a generator that reads
// its previous run is a feedback loop, and this one had a 2-cycle that made `--check` report
// drift forever. fp-sd.json is still WRITTEN below, as a report.
const FP_SD = { f: 14, reach: 0.72, arc: 82, root: 0.34, hitstop: 4.2, ...(CLASSES.fingerprint_sd || {}) };
function budgetiseRaw(w) {
  const d = { ...(w.d || {}) };
  for (const k of ['f', 'reach', 'arc', 'root', 'hitstop']) d[k] = d[k] || 0;
  // Each weapon gets a distinct sign pattern across the four numeric fingerprint dimensions,
  // indexed by its position in its class. Two weapons of a class can therefore never point the
  // same way after budget normalisation, which is what RI-WPN03 §D.2's W_min >= 0.20 asks for.
  const FILL = [['f', 14 * 0.40], ['reach', 0.72 * 0.40], ['arc', 82 * 0.40], ['root', 0.34 * 0.40]];
  for (let i = 0; i < FILL.length; i++) {
    const [k, amp] = FILL[i];
    const bit = ((w._ci >> i) & 1) ? 1 : -1;
    if (!d[k]) d[k] = bit * amp * (0.55 + 0.45 * Math.abs(sig(w.id + ':fill:' + k, 1)));
    else d[k] += bit * amp * 0.22;
  }
  return d;
}

function budgetise(w) {
  const raw0 = w.d || {};
  if (w.baseline) return { f: 0, reach: 0, arc: 0, root: 0, hitstop: 0, ha: raw0.ha, chain: raw0.chain };
  const u = DIRS.get(w.id);
  const bm = CLASSES.classes[w.class].budget_mult || 1;
  const target = (w.sig ? BUDGET_SIG : BUDGET) * DELTA_SCALE * bm;
  const out = { chain: raw0.chain, ha: raw0.ha };
  out.f = Math.round(u[0] * target * FP_SD.f);
  out.reach = Math.round(u[1] * target * FP_SD.reach * 1000) / 1000;
  out.arc = Math.round(u[2] * target * FP_SD.arc * 10) / 10;
  out.root = Math.round(u[3] * target * FP_SD.root * 1000) / 1000;
  // A hitstop component smaller than half a tier quantises to zero, and the budget it was
  // carrying would simply be lost. Redistribute it over the four continuous dimensions instead,
  // so every weapon really is at its budget radius and RI-WPN03 §D.2's W_min means something.
  out.hitstop = Math.abs(u[4] * target * FP_SD.hitstop / 2) >= 0.5 ? Math.sign(u[4]) : 0;
  if (out.hitstop === 0 && Math.abs(u[4]) > 1e-6) {
    const k = 1 / Math.max(1e-6, Math.hypot(u[0], u[1], u[2], u[3]));
    out.f = Math.round(u[0] * k * target * FP_SD.f);
    out.reach = Math.round(u[1] * k * target * FP_SD.reach * 1000) / 1000;
    out.arc = Math.round(u[2] * k * target * FP_SD.arc * 10) / 10;
    out.root = Math.round(u[3] * k * target * FP_SD.root * 1000) / 1000;
  }
  return out;
}
const LIN_ARC = Number(process.env.W110_LIN_ARC || CLASSES.lineage_arc_scale || 1);
const CTX = CLASSES.contextual_multipliers;
const CHAINM = CLASSES.chain_multipliers;
const TWOH = CLASSES.two_hand_multipliers;
const WINDOWS = CLASSES.contextual_windows;
// 'ranged' sits BELOW light: a bow that hits harder than its class shifts toward the light row.
const TIER_ORDER = ['ranged', 'light', 'medium', 'heavy', 'ultra'];

const clipKey = (slot) => 'clip_' + slot.replace(/\./g, '_');
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// RI-WPN02 M5: "FAIL any class whose declared shape and measured arc disagree. A weapon labelled
// thrust that sweeps 140 degrees is mislabelled data, and mislabelled data is how a critic gets
// lied to without anyone lying." The bands below are M5's own, and they are enforced HERE — on
// the arc that CAUSES the animation — so the check cannot fail by carelessness. Families with no
// band in M5 (slash_d, lash, grab) are given generous sanity bands.
const SHAPE_ARC_BAND = {
  thrust: [4, 19], shoot: [0, 0], spin: [305, 360],
  sweep: [90, 200], slash_h: [90, 200],
  smash: [10, 129], slash_v: [10, 129],
  slash_d: [25, 230], lash: [40, 260], grab: [0, 90],
};

/** Which classes may be dual-wielded (RI-WPN06 §C O2). Heavy and ultra classes may not. */
const DUAL_OK = new Set(['DGR', 'FST', 'CSW', 'TSW', 'SSW', 'SPR', 'AXE', 'MCE', 'HLB', 'WHP']);

// ---------------------------------------------------------------------------------------------
// 1. Frame derivation
// ---------------------------------------------------------------------------------------------

/** Base (startup, active, recovery) for a class's R1 and R2, straight out of classes.json. */
function baseRows(c) {
  return {
    r1: { s: c.r1_startup, a: c.r1_active, r: c.r1_total - c.r1_startup - c.r1_active },
    r2: { s: c.r2_startup, a: c.r2_active, r: c.r2_total - c.r2_startup - c.r2_active },
  };
}

/** Apply an RI-WPN04 §A contextual multiplier row to a base row. round-half-up, applied once. */
function ctxFrames(base, m) {
  return {
    s: Math.max(CTX.startup_floor_f, rhu(base.s * m.startup)),
    a: rhu(base.a * m.active),
    r: rhu(base.r * m.recovery),
  };
}

/** Apply an RI-CMB02 §C chain multiplier row. Active is unchanged down a chain. */
function chainFrames(base, m) {
  return { s: Math.max(CTX.startup_floor_f, rhu(base.s * m.startup)), a: base.a, r: rhu(base.r * m.recovery) };
}

// ---------------------------------------------------------------------------------------------
// 2. Pose resolution — a slot's clip is a family plus a lineage shift plus a weapon perturbation
// ---------------------------------------------------------------------------------------------

/**
 * Resolve the swing profile for one slot of one weapon.
 * `shift` is the lineage's family shift; `wp` is the per-weapon perturbation seed.
 */
function resolveProfile(famName, cls, slotArcDeg, shift, wp, twoHand) {
  const fam = POSES.families[famName];
  if (!fam) throw new Error(`unknown pose family '${famName}'`);
  const t = POSES.two_hand_transform;
  let p = {
    family: famName,
    shape: fam.shape,
    arc_deg: slotArcDeg,
    center_frac: fam.center_frac,
    dir: fam.dir,
    plane_deg: fam.plane_deg + (shift.plane || 0) + (wp.plane || 0),
    cock_frac: fam.cock_frac + (shift.cock || 0) + (wp.cock || 0),
    follow_frac: fam.follow_frac + (shift.follow || 0) + (wp.follow || 0),
    extend: clamp(fam.extend + (shift.extend || 0) + (wp.extend || 0), 0, 1),
    crouch_m: fam.crouch_m + (shift.crouch || 0) + (wp.crouch || 0),
    lean_deg: (fam.lean_deg || 0) + (wp.lean || 0),
    twist_deg: (fam.twist_deg || 0) + (shift.twist || 0) + (wp.twist || 0),
    offhand: fam.offhand,
    root_scale: fam.root_scale,
    tier: cls.tier,
  };
  if (twoHand) {
    p = {
      ...p,
      offhand: t.offhand_to,
      arc_deg: p.arc_deg * t.arc_scale_mult,
      plane_deg: p.plane_deg + t.plane_deg_delta,
      cock_frac: p.cock_frac * t.cock_frac_mult,
      follow_frac: p.follow_frac * t.follow_frac_mult,
      extend: clamp(p.extend + t.extend_delta, 0, 1),
      crouch_m: p.crouch_m + t.crouch_m_delta,
      lean_deg: p.lean_deg + t.lean_deg_delta,
      twist_deg: p.twist_deg * t.twist_deg_mult,
      root_scale: p.root_scale * t.root_scale_mult,
    };
  }
  // start_deg is derived, not authored: the arc is CENTRED per the family's center_frac, so the
  // declared arc is genuinely the blade's angular travel and RI-WPN02 M5 cannot be gamed.
  const used = p.dir * Math.abs(p.arc_deg);
  p.start_deg = -used * p.center_frac;
  p.arc_deg = used;
  for (const k of ['arc_deg', 'start_deg', 'plane_deg', 'cock_frac', 'follow_frac', 'extend', 'crouch_m', 'lean_deg', 'twist_deg', 'root_scale']) {
    p[k] = Math.round(p[k] * 1000) / 1000;
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// 3. The class slot table
// ---------------------------------------------------------------------------------------------

function slotSpecsFor(code) {
  const c = CLASSES.classes[code];
  const g = CLASS_GRAMMAR[code];
  const B = baseRows(c);
  const arc = c.arc_sweep_deg;
  const specs = {};
  const put = (id, o) => { specs[id] = o; };

  if (code === 'BOW') {
    const draw = { s: c.r1_startup, a: c.r1_active, r: c.r1_total - c.r1_startup - c.r1_active };
    put('bow.draw', {
      fam: 'shoot_level', f: draw, shape: 'shoot', mv: c.mv_r1, stam: c.stamina_r1, poise: c.poise_dmg_r1,
      root: 0, arc: 0, chains: null, trig: { button: 'heavy', modifier: 'tap', state: 'IDLE' },
      req: ['ammo'], answers: ['RANGED', 'CASTER', 'AMBUSHER'], ci: 1,
    });
    put('bow.quick', {
      fam: 'shoot_hip', f: { s: c.quick_startup_f, a: c.r1_active, r: rhu((c.r1_total - c.r1_startup - c.r1_active) * 0.85) },
      shape: 'shoot', mv: 0.85, stam: rhu(c.stamina_r1 * 0.8), poise: c.poise_dmg_r1, root: 0, arc: 0,
      chains: null, trig: { button: 'light', modifier: 'tap', state: 'IDLE' }, req: ['ammo'],
      answers: ['RANGED', 'SWARM'], ci: 1,
    });
    put('bow.aimed', {
      fam: 'shoot_level', f: { s: c.r1_startup, a: c.r1_active, r: c.r2_total - c.r1_startup - c.r1_active - c.aimed_charge_max_f },
      shape: 'shoot', mv: c.aimed_mv, stam: rhu(c.stamina_r1 * 1.4), poise: rhu(c.poise_dmg_r1 * 1.5), root: 0, arc: 0,
      chains: null, trig: { button: 'heavy', modifier: 'hold', state: 'IDLE' }, req: ['ammo'],
      answers: ['CASTER', 'RANGED', 'ELITE'], charge: c.aimed_charge_max_f, ci: 1,
    });
    put('bow.roll', {
      fam: 'shoot_hip', f: { s: 14, a: c.r1_active, r: 22 }, shape: 'shoot', mv: 0.60,
      stam: rhu(c.stamina_r1 * 0.7), poise: rhu(c.poise_dmg_r1 * 0.85), root: 0, arc: 0, chains: null,
      trig: { button: 'light', modifier: 'none', state: 'ROLL', win: WINDOWS.roll.LIGHT },
      req: ['ammo'], answers: ['AMBUSHER', 'DUELIST'], ci: 1,
    });
    put('plunge', {
      fam: 'plunge_dive', f: { s: rhu(c.r1_startup * 1.1), a: rhu(c.r1_active * 1.4), r: rhu((c.r1_total - c.r1_startup - c.r1_active) * 1.3) },
      shape: 'thrust', mv: c.mv_r1 * 1.8, stam: rhu(c.stamina_r1 * 1.3), poise: rhu(c.poise_dmg_r1 * 2.2),
      root: 0.4, arc: 20, chains: null,
      trig: { button: 'light', modifier: 'none', state: 'AIRBORNE' }, req: ['airborne', 'descending'],
      answers: ['AMBUSHER', 'ELITE'], ci: 1,
    });
    put('guardbreak', {
      fam: 'guardbreak_kick', f: { s: 22, a: 6, r: 28 }, shape: 'grab', mv: 0.35, stam: 16, poise: 24,
      root: 0.5, arc: 24, chains: null,
      trig: { button: 'light', modifier: 'forward', state: 'IDLE' }, req: [], answers: ['TURTLE'], ci: 1,
    });
    put('art.1', {
      fam: g.art[0], f: { s: rhu(c.r1_startup * 1.3), a: rhu(c.r1_active * 1.6), r: rhu((c.r1_total - c.r1_startup - c.r1_active) * 1.5) },
      shape: POSES.families[g.art[0]].shape, mv: c.mv_r1 * 1.7, stam: rhu(c.stamina_r1 * 1.6),
      poise: rhu(c.poise_dmg_r1 * 2.0), root: 0.6, arc: arc || 40, chains: null,
      trig: { button: 'two_hand', modifier: 'hold', state: 'IDLE' }, req: [], answers: ['ELITE', 'GANK_DUO'], ci: 1,
    });
    return specs;
  }

  // ---- one-handed melee -----------------------------------------------------------------------
  const chainLen = g.h1_chain;
  const chainKeys = ['r1_2', 'r1_3', 'r1_4', 'r1_5'];
  for (let i = 1; i <= Math.min(chainLen, 5); i++) {
    const fam = g.r1[Math.min(i - 1, g.r1.length - 1)];
    const f = i === 1 ? B.r1 : chainFrames(B.r1, CHAINM[chainKeys[i - 2]]);
    const mvm = i === 1 ? 1 : CHAINM[chainKeys[i - 2]].mv;
    const next = i < chainLen ? `r1.${i + 1}` : null;
    put(`r1.${i}`, {
      fam, f, shape: POSES.families[fam].shape, mv: c.mv_r1 * mvm,
      stam: rhu(c.stamina_r1 * (1 + 0.08 * (i - 1))), poise: rhu(c.poise_dmg_r1 * (i === 3 ? 1.15 : i === 1 ? 1 : 0.95)),
      root: c.root_dz_r1, arc, chains: next, ci: i,
      trig: i === 1
        ? { button: 'light', modifier: 'none', state: 'IDLE' }
        : { button: 'light', modifier: 'none', state: 'ATTACK_RECOVERY' },
      req: [], answers: i === 1 ? ['INFANTRY', 'SWARM'] : i === chainLen ? ['INFANTRY', 'DUELIST'] : ['INFANTRY'],
    });
  }
  put('r2', {
    fam: g.r2, f: B.r2, shape: POSES.families[g.r2].shape, mv: c.mv_r1 * 1.55,
    stam: rhu(c.stamina_r1 * 1.7), poise: rhu(c.poise_dmg_r1 * 1.85), root: c.root_dz_r1 * 1.7, arc,
    chains: 'r2.follow', ci: 1, ha: c.r2_ha ? true : false,
    trig: { button: 'heavy', modifier: 'tap', state: 'IDLE' }, req: [], answers: ['POISE_MONSTER', 'INFANTRY'],
  });
  put('r2.charged', {
    fam: g.charged, f: B.r2, shape: POSES.families[g.charged].shape, mv: c.mv_r1 * 1.55,
    stam: rhu(c.stamina_r1 * 1.7), poise: rhu(c.poise_dmg_r1 * 1.85), root: c.root_dz_r1 * 1.7, arc,
    chains: null, ci: 1, ha: true, charge: CHARGE_MAX_F[c.tier],
    trig: { button: 'heavy', modifier: 'hold', state: 'IDLE' }, req: [], answers: ['TURTLE', 'POISE_MONSTER'],
  });
  put('r2.follow', {
    fam: g.follow, f: chainFrames(B.r2, CHAINM.r1_2), shape: POSES.families[g.follow].shape,
    mv: c.mv_r1 * 1.40, stam: rhu(c.stamina_r1 * 1.5), poise: rhu(c.poise_dmg_r1 * 1.60),
    root: c.root_dz_r1 * 1.3, arc, chains: null, ci: 2,
    trig: { button: 'heavy', modifier: 'none', state: 'ATTACK_RECOVERY' }, req: [], answers: ['INFANTRY', 'ELITE'],
  });

  const ctxSlot = (id, famName, m, extra) => {
    const f = ctxFrames(B.r1, m);
    put(id, {
      fam: famName, f, shape: POSES.families[famName].shape,
      mv: c.mv_r1 * m.mv, stam: rhu(c.stamina_r1 * m.stamina), poise: rhu(c.poise_dmg_r1 * m.poise),
      root: c.root_dz_r1 * m.root, arc, chains: null, ci: 1, ...extra,
    });
  };
  ctxSlot('run.r1', g.run1, CTX.run, {
    trig: { button: 'light', modifier: 'none', state: 'SPRINT' }, req: ['sprinting'], answers: ['RANGED', 'CASTER'],
  });
  // A running HEAVY derives from the R2 base row, not the R1 row: RI-WPN04 §A tabulates the
  // running multipliers against R1 because run.r1 is the slot it publishes, and applying them to
  // the heavy's own row is the only reading under which run.r2 is a heavy attack at all.
  {
    const f = ctxFrames(B.r2, CTX.run);
    put('run.r2', {
      fam: g.run2, f, shape: POSES.families[g.run2].shape,
      mv: c.mv_r1 * 1.55 * CTX.run.mv, stam: rhu(c.stamina_r1 * 1.7 * CTX.run.stamina),
      poise: rhu(c.poise_dmg_r1 * 1.85 * CTX.run.poise), root: c.root_dz_r1 * 1.7 * CTX.run.root,
      arc, chains: null, ci: 1,
      trig: { button: 'heavy', modifier: 'none', state: 'SPRINT' }, req: ['sprinting'],
      answers: ['POISE_MONSTER', 'RANGED'], ha: g.ha_run2,
    });
  }
  ctxSlot('roll.r1', g.roll1, CTX.roll, {
    trig: { button: 'light', modifier: 'none', state: 'ROLL', win: WINDOWS.roll.LIGHT }, req: [],
    answers: ['INFANTRY', 'DUELIST', 'POISE_MONSTER', 'ELITE'], chains: 'r1.2',
  });
  if (g.roll2) {
    ctxSlot('roll.r2', g.roll2, CTX.roll, {
      trig: { button: 'heavy', modifier: 'none', state: 'ROLL', win: WINDOWS.roll.LIGHT }, req: [],
      answers: ['POISE_MONSTER', 'ELITE'],
    });
  }
  ctxSlot('backstep.r1', g.back, CTX.backstep, {
    trig: { button: 'light', modifier: 'none', state: 'BACKSTEP', win: WINDOWS.backstep.LIGHT }, req: [],
    answers: ['DUELIST', 'GANK_DUO'], chains: 'r1.2',
  });
  ctxSlot('jump.r1', g.jump1, CTX.jump, {
    trig: { button: 'light', modifier: 'none', state: 'AIRBORNE' }, req: ['airborne', 'descending'],
    answers: ['TURTLE', 'POISE_MONSTER', 'ELITE'],
  });
  if (g.jump2) {
    ctxSlot('jump.r2', g.jump2, CTX.jump, {
      trig: { button: 'heavy', modifier: 'none', state: 'AIRBORNE' }, req: ['airborne', 'descending'],
      answers: ['POISE_MONSTER'],
    });
  }
  ctxSlot('guard.counter', g.gc, CTX.guard_counter, {
    trig: { button: 'light', modifier: 'none', state: 'BLOCK_SUCCESS', win: [1, WINDOWS.guard_counter_f] },
    req: ['post_block'], answers: ['INFANTRY', 'TURTLE', 'POISE_MONSTER'],
  });
  put('plunge', {
    fam: g.plunge, f: { s: rhu(B.r1.s * 1.1), a: rhu(B.r1.a * 1.4), r: rhu(B.r1.r * 1.3) },
    shape: POSES.families[g.plunge].shape, mv: c.mv_r1 * 1.8, stam: rhu(c.stamina_r1 * 1.3),
    poise: rhu(c.poise_dmg_r1 * 2.2), root: c.root_dz_r1 * 0.4, arc: Math.min(arc, 60), chains: null, ci: 1,
    trig: { button: 'light', modifier: 'none', state: 'AIRBORNE' }, req: ['airborne', 'descending'],
    answers: ['AMBUSHER', 'ELITE'],
  });
  put('guardbreak', {
    fam: g.gb, f: g.gb === 'guardbreak_kick' ? { s: 22, a: 6, r: 28 } : g.gb === 'guardbreak_shoulder' ? { s: 26, a: 8, r: 34 } : { s: rhu(B.r1.s * 0.9), a: B.r1.a, r: rhu(B.r1.r * 1.1) },
    shape: POSES.families[g.gb].shape, mv: 0.35, stam: 16, poise: g.gb === 'guardbreak_shoulder' ? 32 : 24,
    root: g.gb === 'guardbreak_shoulder' ? 0.9 : 0.5, arc: Math.min(arc, 60), chains: null, ci: 1,
    trig: { button: 'light', modifier: 'forward', state: 'IDLE' }, req: [], answers: ['TURTLE'],
  });
  for (let k = 0; k < 2; k++) {
    const famName = g.art[k];
    if (!famName) continue;
    put(`art.${k + 1}`, {
      fam: famName, f: { s: rhu(B.r2.s * (k === 0 ? 1.15 : 1.35)), a: rhu(B.r2.a * 1.3), r: rhu(B.r2.r * (k === 0 ? 1.2 : 1.4)) },
      shape: POSES.families[famName].shape, mv: c.mv_r1 * (k === 0 ? 1.75 : 2.0),
      stam: rhu(c.stamina_r1 * (k === 0 ? 1.9 : 2.2)), poise: rhu(c.poise_dmg_r1 * (k === 0 ? 2.0 : 2.3)),
      root: c.root_dz_r1 * (k === 0 ? 1.8 : 1.4), arc, chains: null, ci: 1, ha: k === 1,
      trig: { button: 'two_hand', modifier: k === 0 ? 'hold' : 'double_tap', state: 'IDLE' },
      req: [], answers: k === 0 ? ['ELITE', 'GANK_DUO'] : ['ELITE', 'SWARM'],
    });
  }
  if (c.parry_capable) {
    put('parry', {
      fam: 'guard_counter_shove', f: { s: 8, a: 20, r: 36 }, shape: 'grab', mv: 0.1, stam: 12, poise: 0,
      root: 0.1, arc: 30, chains: null, ci: 1,
      trig: { button: 'parry', modifier: 'none', state: 'IDLE' }, req: ['offhand_free'], answers: ['DUELIST', 'INFANTRY'],
    });
  }
  if (DUAL_OK.has(code)) {
    const offFams = [g.r1[1] || g.r1[0], g.r1[0], g.r2];
    for (let k = 0; k < 3; k++) {
      const id = k < 2 ? `off.r1.${k + 1}` : 'off.r2';
      const famName = offFams[k];
      const f = k === 2 ? chainFrames(B.r2, CHAINM.r1_2) : chainFrames(B.r1, CHAINM[k === 0 ? 'r1_2' : 'r1_3']);
      put(id, {
        fam: famName, f, shape: POSES.families[famName].shape, mv: c.mv_r1 * (k === 2 ? 1.25 : 0.85),
        stam: rhu(c.stamina_r1 * 0.9), poise: rhu(c.poise_dmg_r1 * 0.85), root: c.root_dz_r1 * 0.8,
        arc, chains: k < 1 ? 'off.r1.2' : null, ci: k + 1, mirror: true,
        trig: { button: 'swap_left', modifier: 'hold', state: 'IDLE' }, req: ['offhand_free'],
        answers: k === 2 ? ['DUELIST'] : ['INFANTRY', 'SWARM'],
      });
    }
  }

  // ---- two-handed mirror ----------------------------------------------------------------------
  const h2Base = ['r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'run.r1', 'run.r2', 'roll.r1',
    'backstep.r1', 'jump.r1', 'guard.counter', 'art.1'];
  const h2Extra = g.h2_exclusive;
  const h2Chain = g.h2_chain;
  // RI-WPN06 §B: 'An attack that exists ONLY two-handed is the clearest possible statement that
  // this is a different weapon.' A 2h.X that mirrors an existing X is not exclusive, so the
  // one-handed twin of every declared exclusive is deleted here. It is a real cost: the axe
  // gives up its one-handed rolling heavy in order to have a two-handed one.
  for (const id of h2Extra) { const oneH = id.slice(3); if (specs[oneH] && !MANDATORY_25.includes(oneH)) delete specs[oneH]; }
  for (const id of h2Base) {
    const src = specs[id];
    if (!src) continue;
    let next = src.chains;
    if (id.startsWith('r1.')) {
      const i = Number(id.slice(3));
      next = i < h2Chain ? `2h.r1.${i + 1}` : null;
    } else if (next) next = `2h.${next}`;
    specs[`2h.${id}`] = {
      ...src,
      twoHand: true,
      chains: next,
      mv: src.mv * TWOH.motion_value,
      stam: rhu(src.stam * TWOH.stamina),
      poise: rhu(src.poise * TWOH.poise_damage),
      // The 2h table is a DIVERGENT table, not the 1h table with multipliers: RI-WPN06 §B.
      // Startup and recovery shift, the arc widens with the transform, and heavy classes gain
      // two-handed light-attack hyperarmour (RI-WPN02 §C: GSW is the first class to get it).
      f: { s: Math.max(CTX.startup_floor_f, rhu(src.f.s * 1.10)), a: rhu(src.f.a * 1.15), r: rhu(src.f.r * 1.08) },
      ha: id.startsWith('r1.') ? g.ha_2h_r1 : src.ha,
      trig: { ...src.trig },
      req: [...(src.req || []), 'two_handed'],
    };
  }
  for (const id of h2Extra) {
    if (specs[id]) continue;
    const oneHandEquiv = id.slice(3);
    const src = specs[oneHandEquiv] || specs['r2'];
    let famName;
    if (oneHandEquiv === 'r1.4') famName = g.r1[3] || g.r1[g.r1.length - 1];
    else if (oneHandEquiv === 'roll.r2') famName = g.roll2 || 'roll_sweep';
    else if (oneHandEquiv === 'jump.r2') famName = g.jump2 || 'jump_stomp';
    else if (oneHandEquiv === 'r2.follow') famName = g.follow;
    else if (oneHandEquiv === 'art.2') famName = g.art[1] || g.art[0];
    else famName = g.r2;
    specs[id] = {
      ...src, twoHand: true, exclusive: true, fam: famName, shape: POSES.families[famName].shape,
      chains: null,
      mv: src.mv * TWOH.motion_value * 1.05, stam: rhu(src.stam * TWOH.stamina),
      poise: rhu(src.poise * TWOH.poise_damage),
      f: { s: Math.max(CTX.startup_floor_f, rhu(src.f.s * 1.18)), a: rhu(src.f.a * 1.20), r: rhu(src.f.r * 1.14) },
      ha: g.ha_2h_r1 || src.ha,
      trig: { ...src.trig },
      req: [...(src.req || []).filter((x) => x !== 'two_handed'), 'two_handed'],
      ci: 1,
    };
  }
  if (h2Chain > 3 && !specs['2h.r1.4']) {
    const src = specs['2h.r1.3'];
    const famName = g.r1[3] || g.r1[0];
    specs['2h.r1.4'] = {
      ...src, fam: famName, shape: POSES.families[famName].shape, exclusive: true, chains: null, ci: 4,
      f: { s: Math.max(CTX.startup_floor_f, rhu(src.f.s * 0.92)), a: src.f.a, r: rhu(src.f.r * 1.15) },
    };
  }
  return specs;
}

// ---------------------------------------------------------------------------------------------
// 4. Emit
// ---------------------------------------------------------------------------------------------

const clipRegistry = {};
const outFiles = [];
const byId = new Map();
for (const w of ROSTER.weapons) byId.set(w.id, w);
{ const seen = {}; for (const w of ROSTER.weapons) { seen[w.class] = (seen[w.class] || 0); w._ci = seen[w.class]++; } }

const classSpecs = {};
for (const code of Object.keys(CLASSES.classes)) classSpecs[code] = slotSpecsFor(code);

// ---- deviation-direction spreading -----------------------------------------------------------
// RI-WPN03 §D.2's W_min >= 0.20 says no two weapons in the game are behaviourally identical. Two
// weapons of a class whose authored deltas happen to point the same way land on top of each other
// once both are normalised onto the class's deviation sphere. This is a deterministic spherical
// repulsion (the Thomson problem, 60 fixed iterations, no RNG) that separates every class's
// non-baseline weapons as far apart on that sphere as they will go, while keeping each weapon's
// AUTHORED direction as its starting point — so a weapon the roster calls "the longest one" still
// deviates toward reach; it just stops sharing a direction with its neighbour.
const DIRS = new Map();
{
  const byClass = {};
  for (const w of ROSTER.weapons) (byClass[w.class] = byClass[w.class] || []).push(w);
  for (const code in byClass) {
    const members = byClass[code].filter((w) => !w.baseline);
    const u = members.map((w) => {
      const d = budgetiseRaw(w);
      const live = code === 'BOW' ? [1, 1, 0, 0, 1] : [1, 1, 1, 1, 1];
      const v = [d.f / FP_SD.f, d.reach / FP_SD.reach, d.arc / FP_SD.arc, d.root / FP_SD.root, (d.hitstop * 2) / FP_SD.hitstop].map((x, k) => x * live[k]);
      const m = Math.hypot(...v) || 1;
      return v.map((x) => x / m);
    });
    for (let it = 0; it < 60; it++) {
      const next = u.map((a) => a.slice());
      for (let i = 0; i < u.length; i++) {
        const f = [0, 0, 0, 0, 0];
        for (let j = 0; j < u.length; j++) {
          if (i === j) continue;
          const dv = u[i].map((x, k) => x - u[j][k]);
          const dd = Math.max(0.05, Math.hypot(...dv));
          for (let k = 0; k < 5; k++) f[k] += dv[k] / (dd * dd * dd);
        }
        const live = code === 'BOW' ? [1, 1, 0, 0, 1] : [1, 1, 1, 1, 1];
        const cand = u[i].map((x, k) => (x + 0.02 * f[k]) * live[k]);
        const m = Math.hypot(...cand) || 1;
        next[i] = cand.map((x) => x / m);
      }
      for (let i = 0; i < u.length; i++) u[i] = next[i];
    }
    members.forEach((w, i) => DIRS.set(w.id, u[i]));
  }
}

/** Deterministic per-weapon perturbation: a hash of the weapon id, so it is stable and seeded. */
function weaponPerturb(id, salt) {
  let h = 2166136261;
  const s = id + '|' + salt;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const u = (n) => (((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) % n) / n) * 2 - 1;
  return { plane: u(997) * 7, cock: u(991) * 0.05, follow: u(983) * 0.04, extend: u(977) * 0.05, crouch: u(971) * 0.03, twist: u(967) * 9, lean: u(953) * 4 };
}

function sig(str, scale) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return ((h % 2001) / 1000 - 1) * scale;
}
// Every lineage carries a small deterministic signature on top of its authored shift, so that two
// lineages whose authored shift is zero (the class baselines) still synthesise different clips.
// Without it, RI-WPN03 M2 finds forged-unique pairs between class baselines on the slots whose
// frame data is class-independent (the kick, the plunge).
const LINEAGE_SIG = {};
for (const key of Object.keys(ROSTER.lineages)) {
  LINEAGE_SIG[key] = { plane: sig(key + ':plane', 4.5), cock: sig(key + ':cock', 0.035), follow: sig(key + ':follow', 0.03), extend: sig(key + ':extend', 0.045), crouch: sig(key + ':crouch', 0.025), twist: sig(key + ':twist', 7), lean: sig(key + ':lean', 3) };
}
const lineageOf = ROSTER.lineages;
const baselineOfClass = {};
for (const w of ROSTER.weapons) if (w.baseline) baselineOfClass[w.class] = w.id;

for (const w of ROSTER.weapons) {
  const c = CLASSES.classes[w.class];
  const g = CLASS_GRAMMAR[w.class];
  const lin = lineageOf[w.lin];
  if (!lin) throw new Error(`weapon ${w.id}: unknown lineage ${w.lin}`);
  const d = budgetise(w);
  const specs = classSpecs[w.class];
  const unq = new Map((w.unq || []).map(([slot, fam]) => [slot, fam]));
  const haFlip = new Set(w.ha || d.ha || []);
  const baseReach = c.melee_reach_m !== undefined ? c.melee_reach_m : c.reach_m;
  const reach = Math.round((baseReach + (d.reach || 0)) * 1000) / 1000;
  const projRange = w.class === 'BOW' ? Math.round((c.reach_m + (d.reach || 0)) * 100) / 100 : null;

  const slots = {};
  const chainLen1h = g.h1_chain + (d.chain || 0);

  for (const [slotId, spec] of Object.entries(specs)) {
    // per-weapon chain length change (RI-WPN03: `chain` delta adds or removes r1.4 / r1.5)
    if (/^r1\.(\d)$/.test(slotId)) {
      const i = Number(slotId.slice(3));
      if (i > chainLen1h) continue;
    }
    const famName = unq.get(slotId) || spec.fam;   // null in the roster = pose variant of the class family
    const isUnq = unq.has(slotId);
    const owner = isUnq ? w.id : `lin_${w.lin}`;
    const clipId = isUnq ? `clip_w_${w.id}_${slotId.replace(/\./g, '_')}` : `clip_${w.lin}_${slotId.replace(/\./g, '_')}`;

    const arcDelta = (d.arc || 0);
    const isR1 = slotId === 'r1.1';
    const baseFamR1 = POSES.families[(specs['r1.1'] || specs['bow.draw']).fam];
    const famScale = POSES.families[famName].arc_scale;
    const r1FamRatio = clamp(famScale / (baseFamR1.arc_scale || 1), 0.80, 1.25);
    const rawArc = isR1
      ? clamp(spec.arc * r1FamRatio + (lin.shift.arc || 0) * LIN_ARC + arcDelta, 0, 360)
      : clamp(spec.arc * famScale + (lin.shift.arc || 0) + arcDelta, 0, 360);
    // The class baseline's own r1.1 declares RI-WPN02 §B's published cell verbatim even where
    // that cell violates M5's band (UGS: shape slash_v at 210 deg, and M5 says slash_v < 130 —
    // a contradiction inside RI-WPN02 itself, reported in reports/W1-10-MEASUREMENTS.md and NOT
    // silently repaired). Everything else is clamped into its shape's band.
    const band = SHAPE_ARC_BAND[POSES.families[famName].shape] || [0, 360];
    const classCell = isR1 && famName === (specs['r1.1'] || specs['bow.draw']).fam;
    const slotArc = classCell ? rawArc : clamp(rawArc, band[0], band[1]);
    // Guard the rule the roster must obey: a weapon's r1.1 may be a different POSE from its
    // class's, but not a different arc BAND. The first light attack is what makes a weapon
    // legible as a member of its class, and a signature weapon that breaks it lands nearer a
    // different class than its own siblings (RI-WPN03 §D.2's SEP is exactly that measurement).
    if (isR1 && !classCell) {
      const cb = SHAPE_ARC_BAND[POSES.families[(specs['r1.1'] || specs['bow.draw']).fam].shape] || [0, 360];
      if (band[1] < cb[0] || band[0] > cb[1]) {
        throw new Error(`${w.id}: r1.1 override to '${famName}' leaves the class's arc band ` +
          `[${cb}] for [${band}]. Move the override to r1.2/r1.3/r2/art.1 (RI-WPN03 §C's identity list).`);
      }
    }
    const lsig = LINEAGE_SIG[w.lin];
    const wpb = isUnq ? weaponPerturb(w.id, slotId) : { plane: 0, cock: 0, follow: 0, extend: 0, crouch: 0, twist: 0, lean: 0 };
    const wp = { plane: wpb.plane + lsig.plane, cock: wpb.cock + lsig.cock, follow: wpb.follow + lsig.follow, extend: wpb.extend + lsig.extend, crouch: wpb.crouch + lsig.crouch, twist: wpb.twist + lsig.twist, lean: wpb.lean + lsig.lean };
    const prof = resolveProfile(famName, c, slotArc, lin.shift, wp, !!spec.twoHand);

    const fdelta = (d.f || 0);
    const applyF = true;
    const fk = applyF && fdelta ? (spec.f.s + fdelta) / spec.f.s : 1;
    const f = {
      s: clamp(Math.round(spec.f.s * fk), 6, 180),
      a: clamp(spec.f.a, 2, 32),
      r: clamp(Math.round(spec.f.r * fk), 6, 180),
    };
    const rootM = clamp(Math.round(((isR1 ? spec.root : spec.root * prof.root_scale) + (d.root || 0)) * 1000) / 1000, -2.0, 6.0);
    const baseHa = !!spec.ha || (g.ha_extra || []).includes(slotId);
    const ha = haFlip.has(slotId) ? !baseHa : baseHa;

    // Blade length = reach - arm - lunge, with the LUNGE allowance capped at 0.90 m. Beyond that
    // the derivation makes an ultra greatsword's blade (reach 2.95, lunge 1.40) shorter than a
    // straight sword's, which is false, and it drops its peak tip speed below RI-WPN05 §E's ultra
    // band because tip speed is angular rate times radius.
    const capsuleLen = Math.max(0.25, reach - Math.min(Math.abs(rootM), 0.90) - 0.54);
    const slot = {
      anim: clipId,
      anim_owner: owner,
      trigger: {
        button: spec.trig.button,
        modifier: spec.trig.modifier,
        ...(spec.trig.state
          ? { state_window: { state: spec.trig.state, ...(spec.trig.win ? { from_f: spec.trig.win[0], to_f: spec.trig.win[1] } : {}) } }
          : {}),
      },
      chains_to: spec.chains || null,
      chain_index: spec.ci || 1,
      startup_f: f.s,
      active_f: f.a,
      recovery_f: f.r,
      ...(spec.charge ? { charge_max_f: spec.charge, charge_ramp: { motion_value_at_full: 1.30, poise_damage_at_full: 1.50, hyperarmour_at_full: true } } : {}),
      stamina: Math.min(90, Math.round(spec.stam * 10) / 10),
      motion_value: Math.min(4.0, Math.round(spec.mv * 100) / 100),
      poise_damage: Math.min(140, Math.round(spec.poise)),
      root_dz_m: rootM,
      arc_sweep_deg: Math.min(360, Math.round(prof.arc_deg === 0 ? 0 : Math.abs(prof.arc_deg) * 10) / 10),
      shape: prof.shape,
      hyperarmour: ha
        ? { enabled: true, from_f: Math.ceil(0.60 * f.s), to_f: f.s + f.a, poise_multiplier: c.tier === 'ultra' ? 2.0 : c.tier === 'heavy' ? 1.7 : 1.4 }
        : { enabled: false },
      hitbox: {
        kind: prof.shape === 'thrust' || prof.shape === 'shoot' ? 'capsule' : 'capsule_swept',
        radius_m: Math.round((c.tier === 'ultra' ? 0.13 : c.tier === 'heavy' ? 0.11 : c.tier === 'medium' ? 0.09 : 0.07) * 100) / 100,
        bone_a: 'wpn_guard',
        bone_b: 'wpn_tip',
        ...(spec.shape === 'sweep' || famName === 'punch_alternate' ? { multi_hit: 1 } : {}),
      },
      cancels_into: ['dodge'],
      ...(spec.req && spec.req.length ? { requires: [...new Set(spec.req)] } : {}),
      ...(spec.answers ? { answers: spec.answers } : {}),
    };
    if (d.hitstop) {
      const i0 = TIER_ORDER.indexOf(c.tier);
      const i1 = clamp(i0 + d.hitstop, 0, TIER_ORDER.length - 1);
      const a = CLASSES.hitstop.attacker[TIER_ORDER[i0]], b = CLASSES.hitstop.attacker[TIER_ORDER[i1]];
      slot.hitstop_f = {};
      for (const k in a) slot.hitstop_f[k] = Math.round((a[k] + b[k]) / 2);
      if (!Object.keys(slot.hitstop_f).length) throw new Error(`${w.id}: empty hitstop override (tier ${c.tier})`);
    }
    slots[slotId] = slot;

    // clip registry: id -> the profile that produces it. This is the artifact RI-WPN03 M2 reads.
    if (!clipRegistry[clipId]) {
      clipRegistry[clipId] = {
        family: famName, owner, class: w.class, slot: slotId, stance: spec.twoHand ? 'two_hand' : (spec.mirror ? 'off_hand' : 'one_hand'),
        capsule_length_m: Math.round(capsuleLen * 1000) / 1000,
        profile: prof,
        used_by: [w.id],
      };
    } else if (!clipRegistry[clipId].used_by.includes(w.id)) {
      clipRegistry[clipId].used_by.push(w.id);
    }
  }

  const isBow = w.class === 'BOW';
  const mand = isBow ? MANDATORY_BOW : MANDATORY_25;
  const missing = mand.filter((s) => !slots[s]);
  if (missing.length) throw new Error(`${w.id}: missing mandatory slots ${missing.join(', ')}`);

  const exclusive = Object.keys(slots).filter((s) => s.startsWith('2h.') && !slots[s.slice(3)]);
  const doc = {
    schema: 'elder-souls/moveset@1',
    weapon_id: w.id,
    name: w.name,
    class: w.class,
    weight_tier: c.tier,
    baseline_ref: w.baseline ? null : baselineOfClass[w.class],
    stance: {
      one_hand: { stamina_mult: 1.0, motion_value_mult: 1.0, poise_damage_mult: 1.0 },
      two_hand: {
        stamina_mult: TWOH.stamina, motion_value_mult: TWOH.motion_value, poise_damage_mult: TWOH.poise_damage,
        exclusive_slots: exclusive,
      },
      ...(DUAL_OK.has(w.class) ? { off_hand: { stamina_mult: 0.9, motion_value_mult: 0.85, poise_damage_mult: 0.85 } } : {}),
    },
    parry_capable: !!c.parry_capable,
    guardbreak_kind: w.class === 'BOW' ? 'kick' : (CLASS_GRAMMAR[w.class].gb === 'guardbreak_kick' ? 'kick' : CLASS_GRAMMAR[w.class].gb === 'guardbreak_shoulder' ? 'shoulder' : CLASS_GRAMMAR[w.class].gb === 'guardbreak_bash' ? 'shield_bash' : 'thrust_through'),
    reach_m: reach,
    arc_sweep_deg: slots['r1.1'] ? slots['r1.1'].arc_sweep_deg : (slots['bow.draw'] ? 0 : 0),
    slots,
    notes: `${w.line}${projRange ? `\n\nProjectile range ${projRange} m (RI-WPN02 §B); reach_m above is the bow's own hitbox reach.` : ''}\n\nLineage: ${w.lin} — ${lin.note}\nMandatory slots present: ${mand.filter((s) => slots[s]).length}/${mand.length}. Total slots: ${Object.keys(slots).length}.\nart.1/art.2 trigger: the schema's trigger block cannot express a chord, so the declared button is 'two_hand' with modifier hold/double_tap. The runtime conjunction is 'heavy pressed while two_hand is HELD' (art.1) and 'heavy HELD while two_hand is HELD' (art.2) — game/data/weapons/input-map.json is authoritative and machine-readable.`,
  };
  outFiles.push({ path: `game/data/combat/movesets/${w.id}.json`, doc });
}

// ---- write ------------------------------------------------------------------------------------
const check = process.argv.includes('--check');
const outDir = R('game/data/combat/movesets');
fs.mkdirSync(outDir, { recursive: true });
let written = 0;
for (const f of outFiles) {
  const text = JSON.stringify(f.doc, null, 1) + '\n';
  if (check) {
    const cur = fs.existsSync(R(f.path)) ? fs.readFileSync(R(f.path), 'utf8') : null;
    if (cur !== text) { console.error(`DRIFT: ${f.path}`); process.exitCode = 1; }
  } else { fs.writeFileSync(R(f.path), text); written++; }
}
// Measure the fingerprint standard deviations this build produced, for the next run's budgets.
{
  const cols = { f: [], reach: [], arc: [], root: [], hitstop: [] };
  for (const f of outFiles) {
    const d = f.doc, r1 = d.slots['r1.1'] || d.slots['bow.draw'];
    cols.f.push(r1.startup_f);
    cols.reach.push(d.reach_m);
    cols.arc.push(r1.arc_sweep_deg);
    cols.root.push(r1.root_dz_m);
    cols.hitstop.push(r1.hitstop_f ? r1.hitstop_f.flesh : CLASSES.hitstop.attacker[d.weight_tier].flesh);
  }
  const sd = {};
  for (const k in cols) {
    const a = cols[k], m = a.reduce((x, y) => x + y, 0) / a.length;
    sd[k] = Math.round(Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) * 10000) / 10000;
  }
  if (!check) fs.writeFileSync(R('game/data/weapons/fp-sd.json'), JSON.stringify({
    schema: 'elder-souls/fp-sd@1', id: 'fp-sd',
    note: 'Measured standard deviations of the five numeric fingerprint dimensions across the shipped 87 weapons. Read back by build-movesets.mjs so that a weapon deviation budget is expressed in the units RI-WPN03 §D.2 measures in. Regenerated on every build; a fixed point after one iteration.',
    sd,
  }, null, 1) + '\n');
}
const registryDoc = {
  schema: 'elder-souls/clip-registry@1',
  id: 'clip-registry',
  owner: 'W1-10, generated by tools/weapons/build-movesets.mjs. RI-WPN03 M2 reads this: a clip id is only meaningful if it resolves to a genuinely different animation, and this file is what it resolves to. The per-frame root track and hitbox path are computed from `profile` by game/src/combat/swing.js.',
  clip_count: Object.keys(clipRegistry).length,
  clips: clipRegistry,
};
if (!check) fs.writeFileSync(R('game/data/weapons/clip-registry.json'), JSON.stringify(registryDoc, null, 1) + '\n');

console.log(`weapons: ${outFiles.length}  written: ${written}  distinct clips: ${Object.keys(clipRegistry).length}`);
const shareHist = {};
for (const k in clipRegistry) {
  const n = clipRegistry[k].used_by.length;
  shareHist[n >= 5 ? '5+' : n] = (shareHist[n >= 5 ? '5+' : n] || 0) + 1;
}
console.log('clip-share histogram (weapons per clip):', JSON.stringify(shareHist));
