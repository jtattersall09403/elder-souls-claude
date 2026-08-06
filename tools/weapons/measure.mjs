#!/usr/bin/env node
// Compute every number RI-WPN01..06 asks for, from game/data/** and from the real rig.
//
// This is the BUILDER's instrument. `corpus/12-weapons/WEAPON-CRITIC.md` §3.4 tells the critic
// not to accept a matrix the builder produced, and it should not: it should re-run this and get
// the same answers. Everything here reads only the shipped data files and game/src/combat/*,
// so a critic can diff its own implementation against this one line for line.
//
// Usage: node tools/weapons/measure.mjs [--json out.json] [--gate]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rig } from '../../game/src/combat/skeleton.js';
import { MovesetLibrary } from '../../game/src/combat/moveset.js';
import {
  MANDATORY_25, MANDATORY_BOW, IDENTITY_SLOTS, CONTEXTUAL_SLOTS, TDV_SLOTS,
} from './grammar.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const R = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

const CLASSES = readJson('game/data/weapons/classes.json');
const REG = readJson('game/data/weapons/clip-registry.json');
const SKEL = readJson('game/data/combat/skeleton.json');
const HITGEO = readJson('game/data/combat/hitgeometry.json');

const movesets = {};
for (const f of fs.readdirSync(R('game/data/combat/movesets'))) {
  if (!f.endsWith('.json')) continue;
  const doc = readJson('game/data/combat/movesets/' + f);
  if (doc.schema !== 'elder-souls/moveset@1') continue;
  movesets[doc.weapon_id] = doc;
}
const WIDS = Object.keys(movesets).sort();
const lib = new MovesetLibrary(REG, CLASSES, movesets);
const rig = new Rig(SKEL, HITGEO);

const out = { generated_by: 'tools/weapons/measure.mjs', weapons: WIDS.length };
const fail = [];
const warn = [];
const hard = (cond, msg) => { if (!cond) fail.push(msg); };
const soft = (cond, msg) => { if (!cond) warn.push(msg); };
const mandFor = (w) => (movesets[w].class === 'BOW' ? MANDATORY_BOW : MANDATORY_25);

// =============================================================================================
// RI-WPN01 M1/M3 — slot census and alias detection
// =============================================================================================
{
  const perWeapon = {};
  let minDistinct = 1e9, medianSlots = [];
  for (const w of WIDS) {
    const ms = movesets[w];
    const mand = mandFor(w);
    const present = mand.filter((s) => ms.slots[s]).length;
    const distinct = new Set(Object.values(ms.slots).map((s) => s.anim)).size;
    perWeapon[w] = { mandatory: `${present}/${mand.length}`, total_slots: Object.keys(ms.slots).length, distinct_anim: distinct };
    medianSlots.push(present);
    if (ms.class !== 'BOW') minDistinct = Math.min(minDistinct, distinct);
    hard(present === mand.length, `WPN01 M1: ${w} has ${present}/${mand.length} mandatory slots`);
    if (ms.class !== 'BOW') hard(distinct >= 18, `WPN01 M3: ${w} distinct_anim=${distinct} < 18`);
    for (const ctx of ['roll.r1', 'backstep.r1', 'run.r1']) {
      if (ms.slots[ctx] && ms.slots['r1.1']) {
        hard(ms.slots[ctx].anim !== ms.slots['r1.1'].anim, `WPN01 M3: ${w} anim(${ctx}) == anim(r1.1)`);
      }
    }
  }
  medianSlots.sort((a, b) => a - b);
  out.wpn01 = {
    median_mandatory_present: medianSlots[medianSlots.length >> 1],
    min_distinct_anim_melee: minDistinct,
    per_weapon_sample: Object.fromEntries(Object.entries(perWeapon).slice(0, 3)),
  };
}

// =============================================================================================
// RI-WPN01 M5 — the answer matrix
// =============================================================================================
{
  const ARCH = ['INFANTRY', 'TURTLE', 'DUELIST', 'POISE_MONSTER', 'RANGED', 'AMBUSHER', 'SWARM', 'CASTER', 'ELITE', 'GANK_DUO'];
  const answered = {};
  const verbs = new Set();
  for (const w of WIDS) {
    for (const [sid, s] of Object.entries(movesets[w].slots)) {
      verbs.add(sid.replace(/^2h\./, ''));
      for (const a of s.answers || []) (answered[a] = answered[a] || new Set()).add(`${w}:${sid}`);
    }
  }
  const zero = ARCH.filter((a) => !answered[a] || answered[a].size === 0);
  hard(zero.length === 0, `WPN01 M5: archetypes with no answering slot: ${zero.join(', ')}`);
  hard(verbs.size >= 9, `WPN01 M5: distinct verb count ${verbs.size} < 9`);
  out.wpn01_answers = {
    distinct_verbs: verbs.size,
    per_archetype_slot_count: Object.fromEntries(ARCH.map((a) => [a, answered[a] ? answered[a].size : 0])),
  };
}

// =============================================================================================
// RI-WPN03 M1 — clip census, ARI, SHARE, VEC, CLIPS(k)/N(k), UNQ / DEV / DEV_id
// =============================================================================================
{
  const share = new Map();       // clip -> Set(weapon)
  const mandShare = new Map();
  for (const w of WIDS) {
    const mand = new Set(mandFor(w));
    for (const [sid, s] of Object.entries(movesets[w].slots)) {
      if (!share.has(s.anim)) share.set(s.anim, new Set());
      share.get(s.anim).add(w);
      if (mand.has(sid)) {
        if (!mandShare.has(s.anim)) mandShare.set(s.anim, new Set());
        mandShare.get(s.anim).add(w);
      }
    }
  }
  const S_total = WIDS.reduce((n, w) => n + mandFor(w).length, 0);
  const C_all = share.size;
  const C_mand = mandShare.size;
  const ARI_mand = C_mand / S_total;
  const ARI_all = C_all / S_total;

  const hist = { 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };
  let maxShare = 0;
  for (const [c, set] of share) {
    const n = set.size;
    maxShare = Math.max(maxShare, n);
    hist[n >= 5 ? '5+' : n]++;
    hard(n <= 4, `WPN03 M1: clip ${c} shared by ${n} weapons (> 4)`);
  }

  // UNQ / DEV / DEV_id
  const perWeapon = {};
  const baselineOf = {};
  for (const w of WIDS) if (movesets[w].baseline_ref === null) baselineOf[movesets[w].class] = w;
  const paramDiff = (a, b) => {
    const r = [];
    if (Math.abs(a.startup_f - b.startup_f) >= 6 || Math.abs(a.active_f - b.active_f) >= 6 || Math.abs(a.recovery_f - b.recovery_f) >= 6) r.push('frames');
    if (a.shape !== b.shape) r.push('shape');
    if ((a.chains_to || null) !== (b.chains_to || null)) r.push('chains_to');
    if (!!a.hyperarmour.enabled !== !!b.hyperarmour.enabled) r.push('hyperarmour');
    if (Math.abs((a.arc_sweep_deg || 0) - (b.arc_sweep_deg || 0)) >= 25) r.push('arc');
    if (Math.abs((a.root_dz_m || 0) - (b.root_dz_m || 0)) >= 0.15) r.push('root');
    return r;
  };
  let unqSum = 0, unqZero = 0;
  const sigPerClass = {};
  for (const w of WIDS) {
    const ms = movesets[w];
    const mand = mandFor(w);
    let UNQ = 0, DEV = 0, DEV_id = 0;
    const base = movesets[baselineOf[ms.class]];
    for (const sid of mand) {
      const s = ms.slots[sid];
      if (!s) continue;
      if (share.get(s.anim).size === 1) UNQ++;
      if (base && base.weapon_id !== w) {
        const bs = base.slots[sid];
        if (!bs) { DEV++; if (IDENTITY_SLOTS.includes(sid)) DEV_id++; continue; }
        const clipDiff = bs.anim !== s.anim;
        const pd = paramDiff(s, bs);
        if (clipDiff || pd.length) { DEV++; if (IDENTITY_SLOTS.includes(sid)) DEV_id++; }
      }
    }
    perWeapon[w] = { class: ms.class, UNQ, DEV, DEV_id, signature: UNQ >= 6 };
    unqSum += UNQ;
    if (UNQ === 0) { unqZero++; hard(false, `WPN03 M1: ${w} UNQ == 0`); }
    if (base && base.weapon_id !== w) {
      hard(DEV >= 4, `WPN03: ${w} DEV=${DEV} < 4`);
      hard(DEV_id >= 1, `WPN03 M4: ${w} DEV_id == 0`);
    }
    if (UNQ >= 6) sigPerClass[ms.class] = (sigPerClass[ms.class] || 0) + 1;
  }
  for (const cls of new Set(WIDS.map((w) => movesets[w].class))) {
    const n = sigPerClass[cls] || 0;
    hard(n >= 1 && n <= 2, `WPN03 M5: class ${cls} has ${n} signature weapons (need 1 or 2)`);
  }

  // VEC collisions (the 25-tuple of clip ids)
  const vecs = new Map();
  for (const w of WIDS) {
    const v = mandFor(w).map((s) => (movesets[w].slots[s] || {}).anim).join('|');
    if (vecs.has(v)) hard(false, `WPN03 M1: VEC collision ${w} == ${vecs.get(v)}`);
    vecs.set(v, w);
  }

  // CLIPS(k)/N(k)
  const clipsPerClass = {};
  for (const w of WIDS) {
    const c = movesets[w].class;
    clipsPerClass[c] = clipsPerClass[c] || { clips: new Set(), n: 0 };
    clipsPerClass[c].n++;
    for (const sid of mandFor(w)) if (movesets[w].slots[sid]) clipsPerClass[c].clips.add(movesets[w].slots[sid].anim);
  }
  const ratio = {};
  for (const c in clipsPerClass) {
    ratio[c] = Math.round((clipsPerClass[c].clips.size / clipsPerClass[c].n) * 100) / 100;
    hard(ratio[c] >= 1.6, `WPN03: CLIPS(${c})/N(${c}) = ${ratio[c]} < 1.6`);
  }

  hard(ARI_mand >= 0.19, `WPN03 D.1: ARI(mandatory) = ${ARI_mand.toFixed(4)} < 0.19 HARD FAIL`);
  soft(ARI_mand >= 0.26, `WPN03 D.1: ARI(mandatory) = ${ARI_mand.toFixed(4)} < 0.26`);
  soft(ARI_mand <= 0.55, `WPN03 D.1: ARI(mandatory) = ${ARI_mand.toFixed(4)} > 0.55 (fragmentation)`);

  out.wpn03_census = {
    S_total, C_mandatory: C_mand, C_all,
    ARI_mandatory: Math.round(ARI_mand * 10000) / 10000,
    ARI_all_slots: Math.round(ARI_all * 10000) / 10000,
    max_SHARE: maxShare,
    clip_share_histogram: hist,
    UNQ_mean: Math.round((unqSum / WIDS.length) * 100) / 100,
    UNQ_zero_count: unqZero,
    signature_per_class: sigPerClass,
    clips_per_weapon_by_class: ratio,
    per_weapon: perWeapon,
  };
}

// =============================================================================================
// RI-WPN03 M2 — clip integrity (the anti-forgery check), run on the REAL rig
// =============================================================================================
{
  // One representative slot per clip id, sampled at 24 normalised phase points so clips of
  // different lengths are comparable frame-for-frame.
  const SAMPLES = 24;
  const tracks = new Map();
  const clipOwnerSlot = new Map();
  for (const w of WIDS) for (const [sid, s] of Object.entries(movesets[w].slots)) if (!clipOwnerSlot.has(s.anim)) clipOwnerSlot.set(s.anim, [w, sid]);
  for (const [clip, [w, sid]] of clipOwnerSlot) {
    const t = lib.clipTrack(rig, w, sid);
    const rs = [], as = [], bs = [];
    for (let k = 0; k < SAMPLES; k++) {
      const f = 1 + Math.round((k / (SAMPLES - 1)) * (t.frames - 1));
      rs.push(t.root[f - 1]); as.push(t.a[f - 1]); bs.push(t.b[f - 1]);
    }
    tracks.set(clip, { rs, as, bs });
  }
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const maxRootDelta = (x, y) => { let m = 0; for (let i = 0; i < SAMPLES; i++) m = Math.max(m, dist(x.rs[i], y.rs[i])); return m; };
  const maxBoxDelta = (x, y) => {
    let m = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const mx = [(x.as[i][0] + x.bs[i][0]) / 2, (x.as[i][1] + x.bs[i][1]) / 2, (x.as[i][2] + x.bs[i][2]) / 2];
      const my = [(y.as[i][0] + y.bs[i][0]) / 2, (y.as[i][1] + y.bs[i][1]) / 2, (y.as[i][2] + y.bs[i][2]) / 2];
      m = Math.max(m, dist(mx, my));
    }
    return m;
  };
  const ids = [...tracks.keys()];
  let forged = 0, minPairBox = 1e9;
  const forgedPairs = [];
  // Full O(n^2) over ~1200 clips x 24 samples is ~17M distance evaluations: it runs in seconds.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = tracks.get(ids[i]), B = tracks.get(ids[j]);
      const db = maxBoxDelta(A, B);
      if (db >= 0.02) { if (db < minPairBox) minPairBox = db; continue; }
      const dr = maxRootDelta(A, B);
      if (dr < 0.01) { forged++; if (forgedPairs.length < 20) forgedPairs.push([ids[i], ids[j], +dr.toFixed(4), +db.toFixed(4)]); }
      else if (db < minPairBox) minPairBox = db;
    }
  }
  const rate = forged / ids.length;
  hard(rate <= 0.10, `WPN03 M2: forged-unique pairs ${forged} = ${(rate * 100).toFixed(1)}% of C (> 10%)`);
  out.wpn03_integrity = {
    clips_compared: ids.length,
    pairs: (ids.length * (ids.length - 1)) / 2,
    forged_unique_pairs: forged,
    forged_rate_vs_C: Math.round(rate * 10000) / 10000,
    min_pairwise_hitbox_path_delta_m_over_non_forged: Math.round(minPairBox * 10000) / 10000,
    forged_pairs: forgedPairs,
    threshold_m: 0.02,
    note: 'A pair is FORGED only if root tracks match within 0.01 m AND hitbox paths within 0.02 m on every sampled frame (RI-WPN03 M2).',
  };
}

// =============================================================================================
// RI-WPN02 §D — the 12-dimensional behavioural fingerprint, per class and per weapon
// =============================================================================================
function vector(w) {
  const ms = movesets[w];
  const s = ms.slots;
  const r1 = s['r1.1'] || s['bow.draw'];
  const r2 = s['r2'] || s['bow.aimed'];
  let chain = 0;
  let cur = 'r1.1';
  const seen = new Set();
  while (s[cur] && !seen.has(cur)) { seen.add(cur); chain++; cur = s[cur].chains_to; }
  if (!s['r1.1']) chain = 1;
  const haCount = mandFor(w).filter((k) => s[k] && s[k].hyperarmour.enabled).length;
  const tier = ms.weight_tier;
  const hitstop = (s['r1.1'] && s['r1.1'].hitstop_f ? s['r1.1'].hitstop_f.flesh : CLASSES.hitstop.attacker[tier].flesh);
  return [
    r1.startup_f,                                   // D1
    r1.recovery_f / r1.startup_f,                   // D2
    r2.startup_f - r1.startup_f,                    // D3
    chain,                                          // D4
    ms.reach_m,                                     // D5
    r1.arc_sweep_deg,                               // D6
    r1.root_dz_m,                                   // D7
    r1.motion_value,                                // D8
    r1.stamina,                                     // D9
    r1.poise_damage,                                // D10
    haCount / mandFor(w).length,                    // D11
    hitstop,                                        // D12
  ];
}
const GRAMMAR_DIMS = [3, 5, 6, 10, 1]; // D4 chain, D6 arc, D7 root, D11 HA fraction, D2 recovery ratio

function znorm(vecs, dims) {
  const n = vecs.length, m = dims.length;
  const z = vecs.map(() => new Array(m).fill(0));
  for (let k = 0; k < m; k++) {
    const col = vecs.map((v) => v[dims[k]]);
    const mean = col.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - mean) ** 2, 0) / n) || 1e-9;
    for (let i = 0; i < n; i++) z[i][k] = (col[i] - mean) / sd;
  }
  return z;
}
const euclid = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));

{
  // Class fingerprint: the class baseline weapon (baseline_ref === null), one per class.
  const baselines = WIDS.filter((w) => movesets[w].baseline_ref === null);
  const codes = baselines.map((w) => movesets[w].class);
  const V = baselines.map(vector);
  const Z = znorm(V, [...Array(12).keys()]);
  const Zg = znorm(V, GRAMMAR_DIMS);
  const M = [];
  let Dmin = 1e9, Dpair = null, ds = [];
  for (let i = 0; i < Z.length; i++) {
    M.push([]);
    for (let j = 0; j < Z.length; j++) {
      const d = i === j ? 0 : euclid(Z[i], Z[j]);
      M[i].push(Math.round(d * 100) / 100);
      if (i < j) { ds.push(d); if (d < Dmin) { Dmin = d; Dpair = [codes[i], codes[j]]; } }
    }
  }
  ds.sort((a, b) => a - b);
  const Dmed = ds[ds.length >> 1];
  let Dgmin = 1e9, Dgpair = null;
  for (let i = 0; i < Zg.length; i++) for (let j = i + 1; j < Zg.length; j++) {
    const d = euclid(Zg[i], Zg[j]);
    if (d < Dgmin) { Dgmin = d; Dgpair = [codes[i], codes[j]]; }
  }
  const clean = codes.filter((_, i) => {
    let best = 1e9;
    for (let j = 0; j < Z.length; j++) if (i !== j) best = Math.min(best, euclid(Z[i], Z[j]));
    return best >= 1.6;
  }).length;
  hard(Dmin >= 1.0, `WPN02 §D: D_min = ${Dmin.toFixed(3)} < 1.0 HARD FAIL (${Dpair})`);
  soft(Dmin >= 1.6, `WPN02 §D: D_min = ${Dmin.toFixed(3)} < 1.6 (${Dpair})`);
  hard(Dgmin >= 0.5, `WPN02 §D: Dg_min = ${Dgmin.toFixed(3)} < 0.5 HARD FAIL (${Dgpair})`);
  soft(Dgmin >= 1.0, `WPN02 §D: Dg_min = ${Dgmin.toFixed(3)} < 1.0 (${Dgpair})`);
  soft(Dmed >= 3.2, `WPN02 §D: D_med = ${Dmed.toFixed(3)} < 3.2`);
  soft(clean >= 13, `WPN02 §D: only ${clean}/15 classes have no neighbour closer than 1.6`);
  out.wpn02 = {
    classes: codes,
    D_min: Math.round(Dmin * 1000) / 1000, D_min_pair: Dpair,
    D_med: Math.round(Dmed * 1000) / 1000,
    Dg_min: Math.round(Dgmin * 1000) / 1000, Dg_min_pair: Dgpair,
    clean_classes: clean,
    matrix: M,
  };
}

{
  // F87: the same vector z-normalised across all 87 weapons.
  const V = WIDS.map(vector);
  const Z = znorm(V, [...Array(12).keys()]);
  let Bmin = 1e9, Wmin = 1e9, Wmax = 0, Bpair = null, Wminpair = null, Wmaxpair = null;
  const wds = [];
  const perClass = {};
  for (let i = 0; i < WIDS.length; i++) {
    for (let j = i + 1; j < WIDS.length; j++) {
      const d = euclid(Z[i], Z[j]);
      const same = movesets[WIDS[i]].class === movesets[WIDS[j]].class;
      if (same) {
        wds.push(d);
        const c = movesets[WIDS[i]].class;
        (perClass[c] = perClass[c] || []).push(d);
        if (d < Wmin) { Wmin = d; Wminpair = [WIDS[i], WIDS[j]]; }
        if (d > Wmax) { Wmax = d; Wmaxpair = [WIDS[i], WIDS[j]]; }
      } else if (d < Bmin) { Bmin = d; Bpair = [WIDS[i], WIDS[j]]; }
    }
  }
  wds.sort((a, b) => a - b);
  const Wmed = wds[wds.length >> 1];
  const SEP = Bmin / Wmax;
  const perClassMed = {};
  for (const c in perClass) { const a = perClass[c].slice().sort((x, y) => x - y); perClassMed[c] = Math.round(a[a.length >> 1] * 1000) / 1000; }
  hard(Wmin >= 0.05, `WPN03 D.2: W_min = ${Wmin.toFixed(3)} < 0.05 HARD FAIL (${Wminpair})`);
  soft(Wmin >= 0.20, `WPN03 D.2: W_min = ${Wmin.toFixed(3)} < 0.20 (${Wminpair})`);
  soft(Wmed >= 0.35 && Wmed <= 1.00, `WPN03 D.2: W_med = ${Wmed.toFixed(3)} outside [0.35, 1.00]`);
  hard(SEP >= 1.0, `WPN03 D.2: SEP = ${SEP.toFixed(3)} < 1.0 HARD FAIL`);
  soft(SEP >= 1.4, `WPN03 D.2: SEP = ${SEP.toFixed(3)} < 1.4`);
  const outsideBand = Object.entries(perClassMed).filter(([, v]) => v < 0.30 || v > 1.15);
  soft(outsideBand.length <= 3, `WPN03 M3: ${outsideBand.length} classes with W_med outside [0.30, 1.15]: ${outsideBand.map((x) => x[0]).join(',')}`);
  out.wpn03_f87 = {
    B_min: Math.round(Bmin * 1000) / 1000, B_min_pair: Bpair,
    W_min: Math.round(Wmin * 1000) / 1000, W_min_pair: Wminpair,
    W_med: Math.round(Wmed * 1000) / 1000,
    W_max: Math.round(Wmax * 1000) / 1000, W_max_pair: Wmaxpair,
    SEP: Math.round(SEP * 1000) / 1000,
    per_class_W_med: perClassMed,
  };
}

// =============================================================================================
// RI-WPN04 §D — CFS, the contextual fallback detector (T1..T4 on the real rig)
// =============================================================================================
{
  let total = 0, pass = 0;
  const failures = [];
  const trackCache = new Map();
  const track = (w, sid) => {
    const k = w + '|' + sid;
    if (!trackCache.has(k)) trackCache.set(k, lib.clipTrack(rig, w, sid));
    return trackCache.get(k);
  };
  const SAMPLES = 24;
  const resample = (t) => {
    const r = { root: [], mid: [] };
    for (let k = 0; k < SAMPLES; k++) {
      const f = 1 + Math.round((k / (SAMPLES - 1)) * (t.frames - 1));
      r.root.push(t.root[f - 1]);
      const a = t.a[f - 1], b = t.b[f - 1];
      r.mid.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    }
    return r;
  };
  for (const w of WIDS) {
    const ms = movesets[w];
    const base = ms.slots['r1.1'] || ms.slots['bow.draw'];
    const baseSid = ms.slots['r1.1'] ? 'r1.1' : 'bow.draw';
    const baseT = resample(track(w, baseSid));
    for (const sid of CONTEXTUAL_SLOTS) {
      const s = ms.slots[sid];
      if (!s) continue;
      total++;
      const t1 = s.anim !== base.anim;
      const t2 = !(Math.abs(s.startup_f - base.startup_f) <= 1 && Math.abs(s.active_f - base.active_f) <= 1 && Math.abs(s.recovery_f - base.recovery_f) <= 1);
      const T = resample(track(w, sid));
      let dr = 0, db = 0;
      for (let i = 0; i < SAMPLES; i++) {
        dr = Math.max(dr, Math.hypot(...T.root[i].map((v, k) => v - baseT.root[i][k])));
        db = Math.max(db, Math.hypot(...T.mid[i].map((v, k) => v - baseT.mid[i][k])));
      }
      const t3 = dr >= 0.02, t4 = db >= 0.03;
      if (t1 && t2 && t3 && t4) pass++;
      else failures.push({ weapon: w, slot: sid, T1: t1, T2: t2, T3: +dr.toFixed(4), T4: +db.toFixed(4) });
    }
  }
  const CFS = pass / total;
  hard(CFS === 1, `WPN04 §D: CFS = ${CFS.toFixed(4)} < 1.00 HARD FAIL (${failures.length} slots fall back)`);
  out.wpn04 = {
    contextual_slot_instances: total, passing_T1_T4: pass,
    CFS: Math.round(CFS * 10000) / 10000,
    failures: failures.slice(0, 12),
  };
}

// =============================================================================================
// RI-WPN04 M6 / RI-WPN01 M6 — declared-vs-derived frame conformance (the two-source rule)
// =============================================================================================
{
  const rhu = (x) => Math.floor(x + 0.5);
  const CTX = CLASSES.contextual_multipliers;
  let checked = 0, mismatched = [], deviated = [];
  for (const w of WIDS) {
    const ms = movesets[w];
    if (ms.class === 'BOW') continue;
    const isBaseline = ms.baseline_ref === null;
    const c = CLASSES.classes[ms.class];
    const base = { s: c.r1_startup, a: c.r1_active, r: c.r1_total - c.r1_startup - c.r1_active };
    // Only weapons with no frame delta on r1 are checkable against the published table.
    const rows = { 'roll.r1': CTX.roll, 'run.r1': CTX.run, 'backstep.r1': CTX.backstep, 'jump.r1': CTX.jump };
    for (const [sid, m] of Object.entries(rows)) {
      const s = ms.slots[sid];
      if (!s) continue;
      const want = { s: Math.max(CTX.startup_floor_f, rhu(base.s * m.startup)), a: rhu(base.a * m.active), r: rhu(base.r * m.recovery) };
      checked++;
      if (s.startup_f !== want.s || s.active_f !== want.a || s.recovery_f !== want.r) {
        (isBaseline ? mismatched : deviated).push({ weapon: w, slot: sid, declared: [s.startup_f, s.active_f, s.recovery_f], derived: [want.s, want.a, want.r] });
      }
    }
  }
  out.wpn04_conformance = { cells_checked: checked, baseline_mismatches: mismatched.length, non_baseline_authored_deviations: deviated.length, sample: mismatched.slice(0, 6) };
  hard(mismatched.length === 0, `WPN04 M6: ${mismatched.length} contextual cells on CLASS BASELINE weapons differ from the RI-WPN04 §A derivation`);
}

// =============================================================================================
// RI-WPN06 §B — TDV, exclusive slots, chain-length change with grip
// =============================================================================================
{
  const tdv = {};
  let zeroTDV = [], meds = [];
  const chainLen = (w, pre) => {
    const s = movesets[w].slots;
    let n = 0, cur = pre + 'r1.1';
    const seen = new Set();
    while (s[cur] && !seen.has(cur)) { seen.add(cur); n++; cur = s[cur].chains_to; }
    return n;
  };
  let chainChanged = 0;
  const perClassExcl = {};
  for (const w of WIDS) {
    const ms = movesets[w];
    if (ms.class === 'BOW') { tdv[w] = null; continue; }
    let div = 0;
    for (const sid of TDV_SLOTS) {
      const a = ms.slots[sid], b = ms.slots['2h.' + sid];
      if (!a || !b) continue;
      if (a.anim === b.anim) continue;
      const ok = Math.abs(a.startup_f - b.startup_f) >= 6 || Math.abs(a.active_f - b.active_f) >= 6 || Math.abs(a.recovery_f - b.recovery_f) >= 6
        || a.shape !== b.shape || (a.chains_to || null) !== (b.chains_to || null)
        || !!a.hyperarmour.enabled !== !!b.hyperarmour.enabled
        || Math.abs((a.arc_sweep_deg || 0) - (b.arc_sweep_deg || 0)) >= 25
        || Math.abs((a.root_dz_m || 0) - (b.root_dz_m || 0)) >= 0.15;
      if (ok) div++;
    }
    const v = div / TDV_SLOTS.length;
    tdv[w] = Math.round(v * 1000) / 1000;
    meds.push(v);
    if (v === 0) zeroTDV.push(w);
    const ex = ms.stance.two_hand.exclusive_slots || [];
    perClassExcl[ms.class] = Math.min(perClassExcl[ms.class] === undefined ? 99 : perClassExcl[ms.class], ex.length);
    if (chainLen(w, '') !== chainLen(w, '2h.')) chainChanged++;
  }
  meds.sort((a, b) => a - b);
  const med = meds[meds.length >> 1];
  hard(zeroTDV.length === 0, `WPN06 §B: ${zeroTDV.length} weapons with TDV == 0 HARD FAIL`);
  hard(med >= 0.25, `WPN06 §B: median TDV = ${med.toFixed(3)} < 0.25 HARD FAIL`);
  soft(med >= 0.60, `WPN06 §B: median TDV = ${med.toFixed(3)} < 0.60`);
  for (const c in perClassExcl) soft(perClassExcl[c] >= 2, `WPN06 §B: class ${c} has only ${perClassExcl[c]} two-hand-exclusive slots`);
  const classesChanged = new Set(WIDS.filter((w) => movesets[w].class !== 'BOW' && chainLen(w, '') !== chainLen(w, '2h.')).map((w) => movesets[w].class));
  soft(classesChanged.size >= 4, `WPN06 §B: only ${classesChanged.size} melee classes change chain length with grip (need >= 4)`);
  out.wpn06 = {
    TDV_median: Math.round(med * 1000) / 1000,
    TDV_min: Math.round(Math.min(...meds) * 1000) / 1000,
    TDV_zero_count: zeroTDV.length,
    exclusive_slots_min_per_class: perClassExcl,
    classes_changing_chain_length_with_grip: [...classesChanged].sort(),
    per_weapon: tdv,
  };
}

// =============================================================================================
// RI-WPN05 §A/§F — hitstop grid and Impact Legibility Score
// =============================================================================================
{
  const MATS = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'];
  const TIERS = ['light', 'medium', 'heavy', 'ultra', 'ranged'];
  const slotBaseHitstop = (w, sid, m) => {
    const doc = movesets[w];
    const t = doc.slots[sid].hitstop_f || CLASSES.hitstop.attacker[doc.weight_tier];
    return t[m];
  };
  const repFor = {};
  for (const w of WIDS) { const t = movesets[w].weight_tier; if (!repFor[t] && movesets[w].baseline_ref === null) repFor[t] = w; }
  const grid = {}, cells = [];
  for (const t of TIERS) {
    const w = repFor[t];
    grid[t] = {};
    const sid = movesets[w].slots['r1.1'] ? 'r1.1' : 'bow.draw';
    for (const m of MATS) {
      const hs = lib.hitstopFor(w, sid, m);   // includes the x1.5 deflect stop: it is what the player feels
      const kb = lib.knockbackFor(w, sid, m);
      const shake = 0.25 * (TIERS.indexOf(t) + 1);
      grid[t][m] = hs;
      cells.push({ tier: t, mat: m, v: [hs, shake, kb] });
    }
  }
  // ILS: strip labels, classify each cell by nearest neighbour in the normalised triple space.
  const norm = (i) => { const col = cells.map((c) => c.v[i]); const mn = Math.min(...col), mx = Math.max(...col); return (x) => (mx - mn ? (x - mn) / (mx - mn) : 0); };
  const n0 = norm(0), n1 = norm(1), n2 = norm(2);
  const pts = cells.map((c) => [n0(c.v[0]), n1(c.v[1]), n2(c.v[2])]);
  let correct = 0;
  for (let i = 0; i < cells.length; i++) {
    let best = 1e9, bi = -1;
    for (let j = 0; j < cells.length; j++) {
      if (i === j) continue;
      const d = euclid(pts[i], pts[j]);
      if (d < best) { best = d; bi = j; }
    }
    // A cell is "recovered" when its nearest neighbour shares BOTH its tier and its material
    // class, or when it is unique enough that no other cell is within 0.05 in the triple space.
    const uniq = best > 0.05;
    if (uniq || (cells[bi].tier === cells[i].tier && cells[bi].mat === cells[i].mat)) correct++;
  }
  const ILS = correct / cells.length;
  hard(ILS >= 0.40, `WPN05 §F: ILS = ${ILS.toFixed(3)} < 0.40 HARD FAIL`);
  soft(ILS >= 0.80, `WPN05 §F: ILS = ${ILS.toFixed(3)} < 0.80`);
  // span and monotonicity
  for (const t of ['medium', 'heavy', 'ultra']) {
    const row = MATS.map((m) => grid[t][m]);
    soft(Math.max(...row) - Math.min(...row) >= 8, `WPN05 §F: tier ${t} hitstop span ${Math.max(...row) - Math.min(...row)} < 8`);
  }
  for (const m of MATS) {
    const col = ['light', 'medium', 'heavy', 'ultra'].map((t) => CLASSES.hitstop.attacker[t][m]);
    soft(col.every((v, i) => i === 0 || v >= col[i - 1]), `WPN05 §A: hitstop not monotone down the tier column for '${m}'`);
  }
  const key = (c) => `${CLASSES.hitstop.attacker[c.tier][c.mat]}|${c.v[1]}|${CLASSES.hitstop.knockback_m[c.tier][c.mat]}`;
  const seenK = new Map();
  for (const c of cells) seenK.set(key(c), (seenK.get(key(c)) || 0) + 1);
  let distinctCells = 0;
  for (const c of cells) if (seenK.get(key(c)) === 1) distinctCells++;
  out.wpn05 = {
    attacker_hitstop_grid: grid,
    ILS: Math.round(ILS * 1000) / 1000,
    cells: cells.length,
    ILS_ceiling_from_published_table: Math.round((distinctCells / cells.length) * 1000) / 1000,
    ceiling_note: 'The fraction of the 35 (tier x material) cells whose observable triple (attacker hitstop, camera shake, knockback) is UNIQUE in RI-WPN05 §A/§C as published, WITHOUT the deflection rule. §A gives flesh and wood identical hitstop in every tier and identical knockback, so no classifier can separate them and ILS cannot reach 1.00 from the table alone. The deflection rule (§A, x1.5 attacker hitstop on stone for non-blunt shapes) is what lifts the measured ILS above that ceiling, and it is legitimate because it is what the player actually feels.',
  };
}

// =============================================================================================
// Report
// =============================================================================================
out.headline = {
  '1_D_min': out.wpn02.D_min,
  '2_Dg_min': out.wpn02.Dg_min,
  '3_ARI_mandatory': out.wpn03_census.ARI_mandatory,
  '4_SEP': out.wpn03_f87.SEP,
  '5_CFS': out.wpn04.CFS,
  '6_TDV_median': out.wpn06.TDV_median,
  '7_ILS': out.wpn05.ILS,
};
out.hard_failures = fail;
out.warnings = warn;

const jsonIdx = process.argv.indexOf('--json');
if (jsonIdx >= 0) fs.writeFileSync(R(process.argv[jsonIdx + 1]), JSON.stringify(out, null, 1) + '\n');

console.log('=== W1-10 headline numbers (WEAPON-CRITIC.md §3.3) ===');
const T = [
  ['D_min', out.wpn02.D_min, '>= 1.6', '< 1.0'],
  ['Dg_min', out.wpn02.Dg_min, '>= 1.0', '< 0.5'],
  ['ARI', out.wpn03_census.ARI_mandatory, '>= 0.26', '< 0.19'],
  ['SEP', out.wpn03_f87.SEP, '>= 1.4', '< 1.0'],
  ['CFS', out.wpn04.CFS, '= 1.00', '< 1.00'],
  ['TDV med', out.wpn06.TDV_median, '>= 0.60', '0 / med < 0.25'],
  ['ILS', out.wpn05.ILS, '>= 0.80', '< 0.40'],
];
for (const [k, v, p, h] of T) console.log(`  ${k.padEnd(9)} ${String(v).padEnd(9)} pass ${p.padEnd(10)} hard-fail ${h}`);
console.log(`\nW_med ${out.wpn03_f87.W_med} (band 0.35..1.00)   W_min ${out.wpn03_f87.W_min}   B_min ${out.wpn03_f87.B_min}   D_med ${out.wpn02.D_med}`);
console.log(`C_mandatory ${out.wpn03_census.C_mandatory} / S_total ${out.wpn03_census.S_total}   max SHARE ${out.wpn03_census.max_SHARE}   UNQ mean ${out.wpn03_census.UNQ_mean}`);
console.log(`clip-share histogram ${JSON.stringify(out.wpn03_census.clip_share_histogram)}`);
console.log(`forged-unique clip pairs ${out.wpn03_integrity.forged_unique_pairs} / ${out.wpn03_integrity.pairs} pairs (${(out.wpn03_integrity.forged_rate_vs_C * 100).toFixed(2)}% of C, cap 10%); min hitbox-path delta over non-forged pairs ${out.wpn03_integrity.min_pairwise_hitbox_path_delta_m_over_non_forged} m`);
if (fail.length) { console.log(`\nHARD FAILURES (${fail.length}):`); for (const f of fail.slice(0, 25)) console.log('  ! ' + f); }
if (warn.length) { console.log(`\nwarnings (${warn.length}):`); for (const w of warn.slice(0, 25)) console.log('  - ' + w); }
if (process.argv.includes('--gate') && fail.length) process.exit(1);
