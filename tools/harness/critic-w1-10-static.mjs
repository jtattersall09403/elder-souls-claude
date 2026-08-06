// CRITIC W1-10 — the declared-data census, recomputed independently of tools/weapons/measure.mjs.
// WEAPON-CRITIC §3.4: "Do not accept a matrix the builder produced. Do not accept `ARI` reported
// by a tool the builder wrote." Everything here is recomputed from game/data/combat/movesets/*.json
// by this file alone. It measures the DECLARATION; probes A/B/C measure the OBSERVATION.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/static-census.json';
const DIR = 'game/data/combat/movesets';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];

const MAND = ['r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'run.r1', 'run.r2', 'roll.r1', 'backstep.r1',
  'jump.r1', 'plunge', 'guard.counter', 'guardbreak', 'art.1',
  '2h.r1.1', '2h.r1.2', '2h.r1.3', '2h.r2', '2h.r2.charged', '2h.run.r1', '2h.run.r2',
  '2h.roll.r1', '2h.backstep.r1', '2h.jump.r1', '2h.guard.counter'];
const BOW_MAND = ['bow.draw', 'bow.quick', 'bow.aimed', 'bow.roll', 'plunge', 'guardbreak', 'art.1'];

const ms = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (CLASSES.includes(m.class)) ms[m.weapon_id] = m;
}
const ids = Object.keys(ms).sort();
const R = { generated_by: 'tools/harness/critic-w1-10-static.mjs (critic-owned)', weapons: ids.length };

// ---- census vs RI-WPN03 §A --------------------------------------------------------------
const REQ = { DGR: 6, SSW: 8, CSW: 6, TSW: 5, FST: 4, SPR: 7, AXE: 6, MCE: 6, WHP: 4, HLB: 6, GSW: 8, CGS: 5, GHM: 5, UGS: 6, BOW: 5 };
R.census = Object.fromEntries(CLASSES.map((c) => {
  const w = ids.filter((i) => ms[i].class === c);
  return [c, { present: w.length, required_min: REQ[c], baselines: w.filter((i) => ms[i].baseline_ref === null).length }];
}));

// ---- RI-WPN01 M1: slot census ------------------------------------------------------------
R.slots = {};
const slotFail = [];
for (const id of ids) {
  const m = ms[id];
  const need = m.class === 'BOW' ? BOW_MAND : MAND;
  const have = Object.keys(m.slots);
  const missing = need.filter((s) => !have.includes(s));
  R.slots[id] = { declared: have.length, mandatory_present: need.length - missing.length, mandatory_required: need.length, missing };
  if (missing.length) slotFail.push({ id, missing });
}
R.slots_summary = {
  weapons_missing_a_mandatory_slot: slotFail.length,
  median_mandatory_present: (() => { const v = ids.map((i) => R.slots[i].mandatory_present).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; })(),
  detail: slotFail.slice(0, 20),
};

// ---- RI-WPN01 M3: alias detection --------------------------------------------------------
R.alias = { distinct_anim: {}, under_18: [], roll_eq_r1: [], backstep_eq_r1: [], run_eq_r1: [] };
for (const id of ids) {
  const m = ms[id];
  const anims = new Set(Object.values(m.slots).map((s) => s.anim));
  R.alias.distinct_anim[id] = anims.size;
  if (m.class !== 'BOW' && anims.size < 18) R.alias.under_18.push({ id, distinct: anims.size });
  const g = (s) => (m.slots[s] || {}).anim;
  if (g('roll.r1') && g('roll.r1') === g('r1.1')) R.alias.roll_eq_r1.push(id);
  if (g('backstep.r1') && g('backstep.r1') === g('r1.1')) R.alias.backstep_eq_r1.push(id);
  if (g('run.r1') && g('run.r1') === g('r1.1')) R.alias.run_eq_r1.push(id);
}

// ---- RI-WPN03 M1: clip census, ARI, SHARE, UNQ, DEV, DEV_id, VEC --------------------------
const share = new Map();
let S_total = 0;
for (const id of ids) {
  const m = ms[id];
  const need = m.class === 'BOW' ? BOW_MAND : MAND;
  S_total += need.length;
  for (const s of need) { const a = (m.slots[s] || {}).anim; if (!a) continue; share.set(a, (share.get(a) || 0) + 1); }
}
const allClips = new Set();
for (const id of ids) for (const s of Object.values(ms[id].slots)) allClips.add(s.anim);
const C_mandatory = share.size;
R.ARI = {
  S_total,
  C_over_mandatory_slots: C_mandatory,
  C_over_all_declared_slots: allClips.size,
  ARI_mandatory: +(C_mandatory / S_total).toFixed(4),
  ARI_all_declared: +(allClips.size / ids.reduce((a, i) => a + Object.keys(ms[i].slots).length, 0)).toFixed(4),
  thresholds: { pass: '>= 0.26', hard_fail: '< 0.19', over_fragmented: '> 0.55' },
};
const hist = { 1: 0, 2: 0, 3: 0, 4: 0, '5+': 0 };
for (const n of share.values()) hist[n >= 5 ? '5+' : n]++;
R.clip_share_histogram = hist;
R.share_over_4 = [...share.entries()].filter(([, n]) => n > 4).map(([c, n]) => ({ clip: c, weapons: n }));

const UNQ = {}, DEV = {}, DEVid = {};
const IDLIST = ['r1.1', 'r1.3', 'r2', 'art.1', '2h.r2'];
for (const id of ids) {
  const m = ms[id];
  const need = m.class === 'BOW' ? BOW_MAND : MAND;
  UNQ[id] = need.filter((s) => { const a = (m.slots[s] || {}).anim; return a && share.get(a) === 1; }).length;
}
for (const id of ids) {
  const m = ms[id];
  if (m.baseline_ref === null) { DEV[id] = null; DEVid[id] = null; continue; }
  const b = ms[m.baseline_ref];
  if (!b) { DEV[id] = 'BASELINE_MISSING'; continue; }
  let d = 0, di = 0;
  for (const s of Object.keys(m.slots)) {
    const A = m.slots[s], B = b.slots[s];
    if (!B) { d++; if (IDLIST.includes(s)) di++; continue; }
    const clipOverride = A.anim !== B.anim;
    const paramOverride = Math.abs((A.startup_f || 0) - (B.startup_f || 0)) >= 6
      || Math.abs((A.active_f || 0) - (B.active_f || 0)) >= 6
      || Math.abs((A.recovery_f || 0) - (B.recovery_f || 0)) >= 6
      || A.shape !== B.shape || A.chains_to !== B.chains_to
      || !!(A.hyperarmour || {}).enabled !== !!(B.hyperarmour || {}).enabled
      || Math.abs((A.arc_sweep_deg || 0) - (B.arc_sweep_deg || 0)) >= 25
      || Math.abs((A.root_dz_m || 0) - (B.root_dz_m || 0)) >= 0.15;
    if (clipOverride || paramOverride) { d++; if (IDLIST.includes(s)) di++; }
  }
  DEV[id] = d; DEVid[id] = di;
}
R.UNQ = { per_weapon: UNQ, min: Math.min(...Object.values(UNQ)), mean: +(Object.values(UNQ).reduce((a, b) => a + b, 0) / ids.length).toFixed(3), zero: ids.filter((i) => UNQ[i] === 0) };
R.DEV = { per_weapon: DEV, under_4: ids.filter((i) => typeof DEV[i] === 'number' && DEV[i] < 4) };
R.DEV_id = { per_weapon: DEVid, zero: ids.filter((i) => typeof DEVid[i] === 'number' && DEVid[i] === 0) };
R.signature = Object.fromEntries(CLASSES.map((c) => [c, ids.filter((i) => ms[i].class === c && UNQ[i] >= 6).length]));
R.clips_per_class = Object.fromEntries(CLASSES.map((c) => {
  const w = ids.filter((i) => ms[i].class === c);
  const cl = new Set(); for (const i of w) for (const s of Object.values(ms[i].slots)) cl.add(s.anim);
  return [c, +(cl.size / w.length).toFixed(2)];
}));
// VEC collisions
const vec = new Map();
for (const id of ids) {
  const need = ms[id].class === 'BOW' ? BOW_MAND : MAND;
  const key = need.map((s) => (ms[id].slots[s] || {}).anim || 'MISSING').join('|');
  if (!vec.has(key)) vec.set(key, []);
  vec.get(key).push(id);
}
R.VEC_collisions = [...vec.values()].filter((v) => v.length > 1);

// ---- RI-WPN06 §B: TDV ---------------------------------------------------------------------
const TWELVE = ['r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'run.r1', 'run.r2', 'roll.r1', 'backstep.r1', 'jump.r1', 'guard.counter', 'art.1'];
R.TDV = { per_weapon: {}, per_class: {} };
for (const id of ids) {
  const m = ms[id];
  if (m.class === 'BOW') { R.TDV.per_weapon[id] = null; continue; }
  if (m.class === 'FST') { R.TDV.per_weapon[id] = 'n/a (RI-WPN06 §B FST exception)'; continue; }
  let n = 0;
  for (const s of TWELVE) {
    const A = m.slots[s], B = m.slots['2h.' + s];
    if (!A || !B) continue;
    if (A.anim === B.anim) continue;
    const diverges = Math.abs((A.startup_f || 0) - (B.startup_f || 0)) >= 6
      || Math.abs((A.active_f || 0) - (B.active_f || 0)) >= 6
      || Math.abs((A.recovery_f || 0) - (B.recovery_f || 0)) >= 6
      || A.shape !== B.shape || A.chains_to !== ('2h.' + B.chains_to === B.chains_to ? B.chains_to : String(B.chains_to).replace(/^2h\./, ''))
      || !!(A.hyperarmour || {}).enabled !== !!(B.hyperarmour || {}).enabled
      || Math.abs((A.arc_sweep_deg || 0) - (B.arc_sweep_deg || 0)) >= 25
      || Math.abs((A.root_dz_m || 0) - (B.root_dz_m || 0)) >= 0.15;
    if (diverges) n++;
  }
  R.TDV.per_weapon[id] = +(n / 12).toFixed(4);
}
const tdvVals = Object.values(R.TDV.per_weapon).filter((x) => typeof x === 'number');
tdvVals.sort((a, b) => a - b);
R.TDV.median = tdvVals[Math.floor(tdvVals.length / 2)];
R.TDV.min = tdvVals[0];
R.TDV.zero_weapons = ids.filter((i) => R.TDV.per_weapon[i] === 0);
R.TDV.exclusive_slots_per_class = Object.fromEntries(CLASSES.map((c) => {
  const b = ids.find((i) => ms[i].class === c && ms[i].baseline_ref === null);
  return [c, b && ms[b].stance && ms[b].stance.two_hand ? (ms[b].stance.two_hand.exclusive_slots || []).length : 0];
}));
// chain length change with grip
const chainLen = (m, pre) => {
  let n = 0, s = pre + 'r1.1';
  const seen = new Set();
  while (m.slots[s] && !seen.has(s)) { seen.add(s); n++; s = m.slots[s].chains_to; if (!s) break; }
  return n;
};
R.TDV.chain_change_classes = CLASSES.filter((c) => {
  const b = ids.find((i) => ms[i].class === c && ms[i].baseline_ref === null);
  if (!b || c === 'BOW' || c === 'FST') return false;
  return chainLen(ms[b], '') !== chainLen(ms[b], '2h.');
});

// ---- RI-WPN02 §D: the 12-dim class fingerprint from the DECLARED baselines -----------------
const HITSTOP = { light: 4, medium: 8, heavy: 12, ultra: 16, ranged: 2 };
function vec12(m) {
  const r1 = m.slots['r1.1'] || m.slots['bow.quick'];
  const r2 = m.slots['r2'] || m.slots['bow.aimed'];
  const need = m.class === 'BOW' ? BOW_MAND : MAND;
  const ha = need.filter((s) => m.slots[s] && (m.slots[s].hyperarmour || {}).enabled).length / need.length;
  return [
    r1.startup_f,
    r1.recovery_f / r1.startup_f,
    (r2 ? r2.startup_f : r1.startup_f) - r1.startup_f,
    chainLen(m, '') || 1,
    m.reach_m,
    r1.arc_sweep_deg,
    r1.root_dz_m,
    r1.motion_value,
    r1.stamina,
    r1.poise_damage,
    ha,
    HITSTOP[m.weight_tier],
  ];
}
function zdist(vs, dims) {
  const n = vs.length, k = dims.length;
  const z = vs.map(() => new Array(k).fill(0));
  for (let j = 0; j < k; j++) {
    const col = vs.map((v) => v[dims[j]]);
    const mu = col.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(col.reduce((a, b) => a + (b - mu) ** 2, 0) / n) || 1;
    for (let i = 0; i < n; i++) z[i][j] = (col[i] - mu) / sd;
  }
  const D = [];
  for (let i = 0; i < n; i++) { D.push([]); for (let j = 0; j < n; j++) D[i][j] = Math.sqrt(z[i].reduce((a, _, q) => a + (z[i][q] - z[j][q]) ** 2, 0)); }
  return D;
}
const baselines = CLASSES.map((c) => ids.find((i) => ms[i].class === c && ms[i].baseline_ref === null));
const bv = baselines.map((i) => vec12(ms[i]));
const D = zdist(bv, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
const Dg = zdist(bv, [3, 5, 6, 10, 1]);   // D4 chain, D6 arc, D7 root, D11 HA fraction, D2 recovery ratio
let dmin = Infinity, dpair = null, dgmin = Infinity, dgpair = null; const dall = [], dgall = [];
for (let i = 0; i < 15; i++) for (let j = i + 1; j < 15; j++) {
  dall.push(D[i][j]); dgall.push(Dg[i][j]);
  if (D[i][j] < dmin) { dmin = D[i][j]; dpair = [CLASSES[i], CLASSES[j]]; }
  if (Dg[i][j] < dgmin) { dgmin = Dg[i][j]; dgpair = [CLASSES[i], CLASSES[j]]; }
}
dall.sort((a, b) => a - b); dgall.sort((a, b) => a - b);
R.fingerprint_class = {
  classes: CLASSES,
  D_min: +dmin.toFixed(4), D_min_pair: dpair, D_med: +dall[Math.floor(dall.length / 2)].toFixed(4),
  Dg_min: +dgmin.toFixed(4), Dg_min_pair: dgpair, Dg_med: +dgall[Math.floor(dgall.length / 2)].toFixed(4),
  clean_classes_ge_1_6: CLASSES.filter((_, i) => { let m2 = Infinity; for (let j = 0; j < 15; j++) if (j !== i) m2 = Math.min(m2, D[i][j]); return m2 >= 1.6; }).length,
  matrix: D.map((row) => row.map((x) => +x.toFixed(2))),
  matrix_grammar: Dg.map((row) => row.map((x) => +x.toFixed(2))),
};

// ---- RI-WPN03 §D.2: F87 -------------------------------------------------------------------
const wv = ids.map((i) => vec12(ms[i]));
const D87 = zdist(wv, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
let Bmin = Infinity, Bpair = null, Wmax = -1, Wmaxp = null, Wmin = Infinity, Wminp = null; const wsame = [];
const perClassW = Object.fromEntries(CLASSES.map((c) => [c, []]));
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
  const same = ms[ids[i]].class === ms[ids[j]].class;
  const d = D87[i][j];
  if (same) {
    wsame.push(d); perClassW[ms[ids[i]].class].push(d);
    if (d > Wmax) { Wmax = d; Wmaxp = [ids[i], ids[j]]; }
    if (d < Wmin) { Wmin = d; Wminp = [ids[i], ids[j]]; }
  } else if (d < Bmin) { Bmin = d; Bpair = [ids[i], ids[j]]; }
}
wsame.sort((a, b) => a - b);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
R.fingerprint_F87 = {
  B_min: +Bmin.toFixed(4), B_min_pair: Bpair,
  W_min: +Wmin.toFixed(4), W_min_pair: Wminp,
  W_max: +Wmax.toFixed(4), W_max_pair: Wmaxp,
  W_med: +med(wsame).toFixed(4),
  SEP: +(Bmin / Wmax).toFixed(4),
  W_med_per_class: Object.fromEntries(CLASSES.map((c) => [c, perClassW[c].length ? +med(perClassW[c]).toFixed(4) : null])),
};

// ---- RI-WPN02 §B / RI-WPN04 §A frame conformance -------------------------------------------
const B_TABLE = {
  DGR: [12, 42, 28, 78, 1.05, 70, 0.72, 8, 12, 4, 0.15, 'slash_d'],
  FST: [14, 44, 32, 82, 0.90, 45, 0.55, 5, 9, 5, 0.10, 'smash'],
  CSW: [20, 64, 44, 114, 1.75, 155, 0.90, 16, 17, 4, 0.30, 'slash_h'],
  TSW: [22, 66, 46, 110, 2.20, 10, 0.95, 12, 16, 3, 0.65, 'thrust'],
  SSW: [24, 74, 50, 122, 1.95, 110, 1.00, 22, 20, 3, 0.35, 'slash_h'],
  SPR: [28, 80, 54, 128, 3.10, 8, 1.00, 18, 18, 3, 0.55, 'thrust'],
  AXE: [32, 92, 60, 146, 1.80, 130, 1.15, 28, 24, 3, 0.30, 'slash_d'],
  MCE: [34, 96, 64, 156, 1.70, 95, 1.20, 32, 25, 3, 0.28, 'smash'],
  HLB: [38, 108, 68, 168, 2.85, 145, 1.25, 34, 28, 3, 0.45, 'sweep'],
  WHP: [40, 108, 60, 148, 3.60, 200, 0.80, 6, 22, 3, 0.20, 'lash'],
  GSW: [44, 126, 80, 196, 2.60, 175, 1.45, 42, 32, 3, 0.85, 'slash_d'],
  CGS: [48, 136, 88, 214, 2.75, 340, 1.35, 38, 34, 2, 0.70, 'spin'],
  GHM: [52, 148, 96, 232, 2.30, 120, 1.60, 52, 38, 2, 0.60, 'smash'],
  UGS: [58, 166, 104, 252, 2.95, 210, 1.75, 58, 42, 3, 1.40, 'slash_v'],
};
R.matrix_conformance = [];
for (const c of Object.keys(B_TABLE)) {
  const id = ids.find((i) => ms[i].class === c && ms[i].baseline_ref === null);
  const m = ms[id], t = B_TABLE[c], r1 = m.slots['r1.1'], r2 = m.slots['r2'];
  const errs = [];
  if (r1.startup_f !== t[0]) errs.push(`r1 startup ${r1.startup_f} != ${t[0]}`);
  if (r1.startup_f + r1.active_f + r1.recovery_f !== t[1]) errs.push(`r1 total ${r1.startup_f + r1.active_f + r1.recovery_f} != ${t[1]}`);
  if (r2.startup_f !== t[2]) errs.push(`r2 startup ${r2.startup_f} != ${t[2]}`);
  if (r2.startup_f + r2.active_f + r2.recovery_f !== t[3]) errs.push(`r2 total ${r2.startup_f + r2.active_f + r2.recovery_f} != ${t[3]}`);
  if (Math.abs(m.reach_m - t[4]) > 0.10) errs.push(`reach ${m.reach_m} != ${t[4]}`);
  if (Math.abs(r1.arc_sweep_deg - t[5]) > 10) errs.push(`arc ${r1.arc_sweep_deg} != ${t[5]}`);
  if (Math.abs(r1.motion_value - t[6]) > 0.02) errs.push(`MV ${r1.motion_value} != ${t[6]}`);
  if (Math.abs(r1.poise_damage - t[7]) > 1) errs.push(`poise ${r1.poise_damage} != ${t[7]}`);
  if (r1.stamina !== t[8]) errs.push(`stam ${r1.stamina} != ${t[8]}`);
  if (chainLen(m, '') !== t[9]) errs.push(`chain ${chainLen(m, '')} != ${t[9]}`);
  if (Math.abs(r1.root_dz_m - t[10]) > 0.05) errs.push(`root ${r1.root_dz_m} != ${t[10]}`);
  if (r1.shape !== t[11]) errs.push(`shape ${r1.shape} != ${t[11]}`);
  R.matrix_conformance.push({ class: c, weapon: id, errors: errs });
}
R.matrix_conformance_failing = R.matrix_conformance.filter((x) => x.errors.length).length;

// RI-WPN04 §A contextual derived table
const CTX = {
  DGR: { 'roll.r1': [7, 6, 26], 'run.r1': [8, 6, 24], 'backstep.r1': [8, 6, 23], 'jump.r1': [16, 8, 29] },
  FST: { 'roll.r1': [8, 4, 29], 'run.r1': [10, 4, 26], 'backstep.r1': [9, 4, 25], 'jump.r1': [18, 5, 31] },
  CSW: { 'roll.r1': [12, 10, 37], 'run.r1': [14, 10, 34], 'backstep.r1': [13, 10, 32], 'jump.r1': [26, 13, 41] },
  TSW: { 'roll.r1': [13, 8, 40], 'run.r1': [15, 8, 36], 'backstep.r1': [14, 8, 34], 'jump.r1': [29, 10, 43] },
  SSW: { 'roll.r1': [14, 10, 44], 'run.r1': [17, 10, 40], 'backstep.r1': [16, 10, 38], 'jump.r1': [31, 13, 48] },
  SPR: { 'roll.r1': [17, 8, 48], 'run.r1': [20, 8, 44], 'backstep.r1': [18, 8, 42], 'jump.r1': [36, 10, 53] },
  AXE: { 'roll.r1': [19, 12, 53], 'run.r1': [22, 12, 48], 'backstep.r1': [21, 12, 46], 'jump.r1': [42, 15, 58] },
  MCE: { 'roll.r1': [20, 12, 55], 'run.r1': [24, 12, 50], 'backstep.r1': [22, 12, 48], 'jump.r1': [44, 15, 60] },
  HLB: { 'roll.r1': [23, 14, 62], 'run.r1': [27, 14, 56], 'backstep.r1': [25, 14, 53], 'jump.r1': [49, 18, 67] },
  WHP: { 'roll.r1': [24, 10, 64], 'run.r1': [28, 10, 58], 'backstep.r1': [26, 10, 55], 'jump.r1': [52, 13, 70] },
  GSW: { 'roll.r1': [26, 16, 73], 'run.r1': [31, 16, 66], 'backstep.r1': [29, 16, 63], 'jump.r1': [57, 20, 79] },
  CGS: { 'roll.r1': [29, 18, 77], 'run.r1': [34, 18, 70], 'backstep.r1': [31, 18, 67], 'jump.r1': [62, 23, 84] },
  GHM: { 'roll.r1': [31, 16, 88], 'run.r1': [36, 16, 80], 'backstep.r1': [34, 16, 76], 'jump.r1': [68, 20, 96] },
  UGS: { 'roll.r1': [35, 20, 97], 'run.r1': [41, 20, 88], 'backstep.r1': [38, 20, 84], 'jump.r1': [75, 25, 106] },
};
R.contextual_conformance = [];
for (const [c, tab] of Object.entries(CTX)) {
  const id = ids.find((i) => ms[i].class === c && ms[i].baseline_ref === null);
  for (const [slot, t] of Object.entries(tab)) {
    const s = ms[id].slots[slot];
    if (!s) { R.contextual_conformance.push({ class: c, slot, error: 'slot absent' }); continue; }
    if (s.startup_f !== t[0] || s.active_f !== t[1] || s.recovery_f !== t[2]) {
      R.contextual_conformance.push({ class: c, slot, declared: [s.startup_f, s.active_f, s.recovery_f], required: t });
    }
  }
}

// ---- CFS from the DECLARED data (T1/T2) ----------------------------------------------------
const CTXSLOTS = ['roll.r1', 'roll.r2', 'run.r1', 'run.r2', 'backstep.r1', 'jump.r1', 'jump.r2', 'plunge', 'guard.counter', 'guardbreak',
  '2h.roll.r1', '2h.run.r1', '2h.run.r2', '2h.backstep.r1', '2h.jump.r1', '2h.guard.counter'];
let inst = 0, t1 = 0, t2 = 0;
const cfsFail = [];
for (const id of ids) {
  const m = ms[id];
  if (m.class === 'BOW') continue;
  for (const s of CTXSLOTS) {
    const A = m.slots[s]; if (!A) continue;
    const base = m.slots[s.startsWith('2h.') ? '2h.r1.1' : 'r1.1'];
    inst++;
    if (A.anim === base.anim) { t1++; cfsFail.push({ id, slot: s, test: 'T1' }); continue; }
    if (Math.abs(A.startup_f - base.startup_f) <= 1 && Math.abs(A.active_f - base.active_f) <= 1 && Math.abs(A.recovery_f - base.recovery_f) <= 1) { t2++; cfsFail.push({ id, slot: s, test: 'T2' }); }
  }
}
R.CFS_declared = { instances: inst, T1_failures: t1, T2_failures: t2, CFS: +((inst - t1 - t2) / inst).toFixed(4), examples: cfsFail.slice(0, 10) };

// ---- shape census -------------------------------------------------------------------------
R.shape_census = {};
for (const id of ids) { const s = (ms[id].slots['r1.1'] || ms[id].slots['bow.quick'] || {}).shape; R.shape_census[s] = (R.shape_census[s] || 0) + 1; }
R.distinct_r1_1_shapes = Object.keys(R.shape_census).length;

// ---- M5 shape/arc agreement ----------------------------------------------------------------
R.shape_arc_violations = [];
for (const id of ids) {
  for (const [sid, s] of Object.entries(ms[id].slots)) {
    const a = s.arc_sweep_deg, sh = s.shape;
    let bad = null;
    if (sh === 'thrust' && !(a < 20)) bad = 'thrust requires arc < 20';
    if (sh === 'spin' && !(a > 300)) bad = 'spin requires arc > 300';
    if ((sh === 'sweep' || sh === 'slash_h') && !(a >= 90 && a <= 200)) bad = 'sweep/slash_h requires 90..200';
    if ((sh === 'smash' || sh === 'slash_v') && !(a < 130 && s.root_dz_m < 0.7)) bad = 'smash/slash_v requires arc<130 and root<0.7';
    if (bad) R.shape_arc_violations.push({ id, slot: sid, shape: sh, arc: a, root: s.root_dz_m, rule: bad });
  }
}
R.shape_arc_violation_count = R.shape_arc_violations.length;

// ---- answer matrix -------------------------------------------------------------------------
const ARCH = ['INFANTRY', 'TURTLE', 'DUELIST', 'POISE_MONSTER', 'RANGED', 'AMBUSHER', 'SWARM', 'CASTER', 'ELITE', 'GANK_DUO'];
const ansCount = Object.fromEntries(ARCH.map((a) => [a, 0]));
for (const id of ids) for (const s of Object.values(ms[id].slots)) for (const a of s.answers || []) if (ansCount[a] !== undefined) ansCount[a]++;
R.answer_matrix = { counts: ansCount, unanswered: ARCH.filter((a) => ansCount[a] === 0) };

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log('wrote', OUT);
console.log('ARI', R.ARI.ARI_mandatory, '| D_min', R.fingerprint_class.D_min, dpair.join('-'), '| Dg_min', R.fingerprint_class.Dg_min, dgpair.join('-'),
  '| SEP', R.fingerprint_F87.SEP, '| W_med', R.fingerprint_F87.W_med, '| TDV med', R.TDV.median, '| CFS(declared)', R.CFS_declared.CFS);
