// CRITIC W1-10 probe E — the second-order motion check (CRITIC-DOCTRINE §2.1 rungs 1 and 4).
//
// RI-WPN03 M2's forgery check compares two clip tracks in ABSOLUTE metres. Two clips that are
// the same motion scaled up — the same curve at a different amplitude, on a longer weapon, over
// more frames — pass it trivially while being, in the hand, one animation. This probe asks the
// second-order question the item does not: after normalising every clip for duration and for
// amplitude, how many DISTINCT SHAPES of motion does the roster actually contain?
//
// Method: resample each clip's tip-speed profile to 32 points, normalise to unit peak, and
// resample the tip's path in the player's local frame to 32 points normalised to unit extent.
// Cluster at a tight tolerance. A roster of 1133 clip ids that collapses to a handful of
// normalised shapes is "forty weapons, three animations" hiding one derivative up.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeE-motion-shape.json';
const DIR = 'game/data/combat/movesets';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];
const ms = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (CLASSES.includes(m.class)) ms[m.weapon_id] = m;
}
const ids = Object.keys(ms).sort();
const rep = new Map();
for (const id of ids) for (const [sid, s] of Object.entries(ms[id].slots)) if (!rep.has(s.anim)) rep.set(s.anim, { clip: s.anim, w: id, s: sid, cls: ms[id].class, shape: s.shape });

const h = await launch();
const list = [...rep.values()];
const shapes = await h.ev(async (list) => {
  const H = window.__HARNESS; const out = [];
  const N = 32;
  for (const it of list) {
    let t;
    try { t = H.weapons.getClipTrack(it.w, it.s); } catch (e) { out.push({ ...it, err: String(e.message || e) }); continue; }
    const tip = t.b;
    if (!tip || tip.length < 4) { out.push({ ...it, err: 'short track' }); continue; }
    // speed profile
    const sp = [];
    for (let i = 1; i < tip.length; i++) sp.push(Math.hypot(tip[i][0] - tip[i - 1][0], tip[i][1] - tip[i - 1][1], tip[i][2] - tip[i - 1][2]));
    const resample = (arr, n) => { const r = []; for (let i = 0; i < n; i++) { const x = i * (arr.length - 1) / (n - 1); const a = Math.floor(x), b = Math.min(arr.length - 1, a + 1), f = x - a; r.push(arr[a] * (1 - f) + arr[b] * f); } return r; };
    const peak = Math.max(...sp) || 1;
    const speedShape = resample(sp, N).map((v) => +(v / peak).toFixed(3));
    // path shape: tip relative to root, normalised to unit extent
    const rel = tip.map((p, i) => [p[0] - t.root[Math.min(i, t.root.length - 1)][0], p[1] - t.root[Math.min(i, t.root.length - 1)][1], p[2] - t.root[Math.min(i, t.root.length - 1)][2]]);
    const c = [0, 1, 2].map((k) => rel.reduce((a, p) => a + p[k], 0) / rel.length);
    const cen = rel.map((p) => [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    const ext = Math.max(...cen.map((p) => Math.hypot(p[0], p[1], p[2]))) || 1;
    const pathShape = [];
    for (let i = 0; i < N; i++) { const x = i * (cen.length - 1) / (N - 1); const a = Math.floor(x), b = Math.min(cen.length - 1, a + 1), f = x - a; for (let k = 0; k < 3; k++) pathShape.push(+(((cen[a][k] * (1 - f) + cen[b][k] * f)) / ext).toFixed(3)); }
    out.push({ ...it, frames: t.frames, peak_step_m: +peak.toFixed(4), speedShape, pathShape });
  }
  return out;
}, list);

const good = shapes.filter((s) => !s.err);
function dist(a, b, key) { let s = 0; for (let i = 0; i < a[key].length; i++) s += (a[key][i] - b[key][i]) ** 2; return Math.sqrt(s / a[key].length); }
function cluster(arr, key, tol) {
  const cent = [];
  const assign = new Array(arr.length).fill(-1);
  for (let i = 0; i < arr.length; i++) {
    let found = -1;
    for (let c = 0; c < cent.length; c++) if (dist(arr[i], arr[cent[c]], key) <= tol) { found = c; break; }
    if (found < 0) { cent.push(i); found = cent.length - 1; }
    assign[i] = found;
  }
  const sizes = new Array(cent.length).fill(0);
  for (const a of assign) sizes[a]++;
  return { n_clusters: cent.length, sizes: sizes.sort((x, y) => y - x), members: cent.map((i, c) => ({ cluster: c, exemplar: arr[i].clip, size: sizes[c] })) };
}

const out = {
  probe: 'E — normalised motion shape (second-order forgery check)',
  build: await h.h('getBuildInfo'),
  clips_analysed: good.length,
  note: 'Every clip resampled to 32 points. speedShape = tip step length per frame / peak. pathShape = tip position relative to root, centred, scaled to unit extent. Two clips in one cluster are the SAME MOTION at a different size and speed.',
  speed_shape_clusters: {},
  path_shape_clusters: {},
};
for (const tol of [0.02, 0.05, 0.10]) {
  out.speed_shape_clusters['tol_' + tol] = cluster(good, 'speedShape', tol);
  out.path_shape_clusters['tol_' + tol] = cluster(good, 'pathShape', tol);
}
// how many distinct pose archetypes appear at all
out.by_declared_shape = {};
for (const g of good) out.by_declared_shape[g.shape] = (out.by_declared_shape[g.shape] || 0) + 1;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
for (const tol of [0.02, 0.05, 0.10]) {
  console.log('tol', tol, 'speed clusters', out.speed_shape_clusters['tol_' + tol].n_clusters, 'path clusters', out.path_shape_clusters['tol_' + tol].n_clusters, 'of', good.length);
}
await h.close();
