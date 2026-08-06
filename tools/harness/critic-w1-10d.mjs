// CRITIC W1-10 probe D — clip integrity (RI-WPN03 M2, the anti-forgery check), the hitstop
// grid + ILS (RI-WPN05 M1/M6), the mass census (RI-WPN05 §E), and the charge ramp (RI-WPN01 M4).
//
// These use H.weapons.getClipTrack / weaponTipTrack / impactFor / chargeState. Those are pure
// functions of the weapon data evaluated on the real rig — they are NOT a live trace, and that
// limitation is recorded. What they can prove is negative: if two distinct clip ids evaluate to
// the same track on the real rig, the ids are cosmetic no matter what the runtime does.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeD-integrity-impact.json';
const DIR = 'game/data/combat/movesets';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];
const ms = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (CLASSES.includes(m.class)) ms[m.weapon_id] = m;
}
const ids = Object.keys(ms).sort();

const h = await launch();
const out = { probe: 'D — clip integrity, impact grid, mass, charge', build: await h.h('getBuildInfo') };

// ---- clip integrity: one representative (weapon, slot) per clip id -----------------------
const rep = new Map();
for (const id of ids) for (const [sid, s] of Object.entries(ms[id].slots)) if (!rep.has(s.anim)) rep.set(s.anim, [id, sid]);
const clipList = [...rep.entries()].map(([clip, [w, s]]) => ({ clip, w, s }));
out.clip_count = clipList.length;

const tracks = await h.ev(async (list) => {
  const H = window.__HARNESS;
  const res = [];
  for (const it of list) {
    try {
      const t = H.weapons.getClipTrack(it.w, it.s);
      res.push({ clip: it.clip, frames: t.frames, root: t.root, a: t.a, b: t.b });
    } catch (e) { res.push({ clip: it.clip, err: String(e && e.message || e) }); }
  }
  return res;
}, clipList);
out.track_errors = tracks.filter((t) => t.err).length;

// forged-unique pairs: distinct ids, identical root track (<=0.01 m every frame) AND
// identical hitbox path (<=0.02 m every frame)
const good = tracks.filter((t) => !t.err && t.root && t.b);
function sameTrack(x, y) {
  if (x.frames !== y.frames) return false;
  for (let i = 0; i < x.root.length; i++) {
    for (let k = 0; k < 3; k++) if (Math.abs(x.root[i][k] - y.root[i][k]) > 0.01) return false;
  }
  for (let i = 0; i < x.b.length; i++) {
    const d = Math.hypot(x.b[i][0] - y.b[i][0], x.b[i][1] - y.b[i][1], x.b[i][2] - y.b[i][2]);
    if (d > 0.02) return false;
    const da = Math.hypot(x.a[i][0] - y.a[i][0], x.a[i][1] - y.a[i][1], x.a[i][2] - y.a[i][2]);
    if (da > 0.02) return false;
  }
  return true;
}
// bucket by (frames, rounded endpoint) so the O(n^2) is tractable
const bucket = new Map();
for (const t of good) {
  const k = t.frames + '|' + t.b.map((p) => p.map((c) => Math.round(c * 20)).join(',')).slice(0, 3).join(';');
  if (!bucket.has(k)) bucket.set(k, []);
  bucket.get(k).push(t);
}
const forged = [];
for (const arr of bucket.values()) {
  for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (sameTrack(arr[i], arr[j])) forged.push([arr[i].clip, arr[j].clip]);
}
out.clip_integrity = {
  clips_tracked: good.length,
  forged_unique_pairs: forged.length,
  fraction_of_C: +(forged.length / good.length).toFixed(4),
  hard_fail_threshold: '> 10% of C',
  examples: forged.slice(0, 10),
};

// ---- hitstop grid + ILS (RI-WPN05 §A / §F) ------------------------------------------------
const MATS = ['flesh', 'chitin', 'stone', 'metal', 'shield', 'wood', 'water'];
const TIER_REP = { light: 'ssw_garrison_sword', medium: 'axe_shell_splitter', heavy: 'gsw_memorial_blade', ultra: 'ugs_golem_sword', ranged: 'bow_horn_sinew' };
const grid = await h.ev(async ({ TIER_REP, MATS }) => {
  const H = window.__HARNESS; const g = {};
  for (const [tier, w] of Object.entries(TIER_REP)) {
    g[tier] = {};
    const slot = tier === 'ranged' ? 'bow.quick' : 'r1.1';
    for (const m of MATS) {
      try { g[tier][m] = H.weapons.impactFor(w, slot, m); } catch (e) { g[tier][m] = { err: String(e.message || e) }; }
    }
  }
  return g;
}, { TIER_REP, MATS });
out.hitstop_grid = grid;
const REF = {
  light: { flesh: 4, chitin: 6, stone: 10, metal: 8, shield: 8, wood: 4, water: 2 },
  medium: { flesh: 8, chitin: 10, stone: 16, metal: 12, shield: 14, wood: 6, water: 2 },
  heavy: { flesh: 12, chitin: 16, stone: 22, metal: 18, shield: 20, wood: 10, water: 4 },
  ultra: { flesh: 16, chitin: 20, stone: 28, metal: 24, shield: 26, wood: 12, water: 4 },
  ranged: { flesh: 2, chitin: 4, stone: 6, metal: 4, shield: 6, wood: 2, water: 2 },
};
const hs = [];
for (const t of Object.keys(REF)) for (const m of MATS) {
  const got = grid[t][m] && grid[t][m].attacker_hitstop_f;
  if (got !== REF[t][m]) hs.push({ tier: t, material: m, observed: got, required: REF[t][m] });
}
out.hitstop_conformance = { cells: 35, mismatches: hs.length, detail: hs };
// ILS: nearest-neighbour over the observable triple
let correct = 0; const ilsDetail = [];
const cells = [];
for (const t of Object.keys(REF)) for (const m of MATS) {
  const c = grid[t][m];
  cells.push({ t, m, v: [c.attacker_hitstop_f, c.camera_shake_deg, c.knockback_m] });
}
for (const c of cells) {
  let best = null, bd = Infinity;
  for (const o of cells) {
    const d = Math.abs(c.v[0] - o.v[0]) / 28 + Math.abs(c.v[1] - o.v[1]) / 1.0 + Math.abs(c.v[2] - o.v[2]) / 0.6;
    if (o === c) continue;
    if (d < bd) { bd = d; best = o; }
  }
  // a cell is recovered iff no OTHER cell has an identical observable triple
  const ties = cells.filter((o) => o !== c && o.v[0] === c.v[0] && o.v[1] === c.v[1] && o.v[2] === c.v[2]);
  if (ties.length === 0) correct++; else ilsDetail.push({ cell: c.t + '/' + c.m, indistinguishable_from: ties.map((x) => x.t + '/' + x.m), triple: c.v });
}
out.ILS = { cells: 35, uniquely_recoverable: correct, ILS: +(correct / 35).toFixed(4), collisions: ilsDetail };

// ---- mass census (RI-WPN05 §E) --------------------------------------------------------------
const massW = ['dgr_shell_knife', 'ssw_garrison_sword', 'csw_naga_sickle', 'tsw_xanmeer_needle', 'fst_wrapped_fists',
  'spr_fishers_gig', 'axe_shell_splitter', 'mce_bog_iron_mace', 'whp_hide_lash', 'hlb_garrison_bill',
  'gsw_memorial_blade', 'cgs_drowned_reaper', 'ghm_pile_driver', 'ugs_golem_sword'];
const BAND = { light: [14, 20], medium: [18, 26], heavy: [22, 32], ultra: [26, 40] };
out.mass = await h.ev(async ({ massW, BAND }) => {
  const H = window.__HARNESS; const r = [];
  for (const w of massW) {
    try {
      const t = H.weapons.weaponTipTrack(w, 'r1.1');
      const m = H.weapons.getMoveset(w);
      const peak = Math.max(...t.tip_speed_mps);
      const band = BAND[m.weight_tier];
      // anticipation: fraction of startup frames where the tip moves AGAINST the net swing dir
      const s = m.slots['r1.1'].startup_f;
      const net = [t.tip[t.tip.length - 1][0] - t.tip[0][0], t.tip[t.tip.length - 1][2] - t.tip[0][2]];
      const nl = Math.hypot(net[0], net[1]) || 1;
      let anti = 0;
      for (let i = 1; i <= Math.min(s, t.tip.length - 1); i++) {
        const d = [t.tip[i][0] - t.tip[i - 1][0], t.tip[i][2] - t.tip[i - 1][2]];
        if ((d[0] * net[0] + d[1] * net[1]) / nl < 0) anti++;
      }
      r.push({ weapon: w, tier: m.weight_tier, frames: t.frames, peak_tip_speed_mps: +peak.toFixed(2), band, in_band: peak >= band[0] && peak <= band[1], anticipation_fraction: +(anti / s).toFixed(3), startup_f: s });
    } catch (e) { r.push({ weapon: w, err: String(e.message || e) }); }
  }
  return r;
}, { massW, BAND });

// ---- charge ramp (RI-WPN01 M4) ---------------------------------------------------------------
out.charge = await h.ev(async () => {
  const H = window.__HARNESS; const r = {};
  for (const w of ['ssw_garrison_sword', 'ugs_golem_sword', 'bow_horn_sinew']) {
    const slot = w.startsWith('bow') ? 'bow.aimed' : 'r2.charged';
    const m = H.weapons.getMoveset(w);
    const max = m.slots[slot].charge_max_f;
    const pts = [0, 1, Math.ceil(max / 4), Math.ceil(max / 2), Math.ceil(3 * max / 4), max, max + 20];
    r[w] = { slot, charge_max_f: max, ramp: pts.map((c) => { try { return { c, ...H.weapons.chargeState(w, slot, c) }; } catch (e) { return { c, err: String(e.message || e) }; } }) };
  }
  return r;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
console.log('forged pairs', out.clip_integrity.forged_unique_pairs, '/', out.clip_integrity.clips_tracked,
  '| hitstop mismatches', out.hitstop_conformance.mismatches, '| ILS', out.ILS.ILS,
  '| mass in band', out.mass.filter((x) => x.in_band).length, '/', out.mass.length);
await h.close();
