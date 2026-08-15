#!/usr/bin/env node
/**
 * w1-water-lane-owner.mjs — WHICH MESH CLASS owns the axis-aligned marsh lanes?
 *
 * WHY THIS TOOL EXISTS, AND WHY IT IS NOT `w1-water-lane-terms.mjs` AGAIN.
 * That tool ablated nine separate terms of the water fragment shader — including `flat-water`,
 * which replaces the ENTIRE water output with one constant colour — and the lanes survived every
 * one of them (rho 0.925-0.989 against a 0.945-0.955 floor). The same run's positive control,
 * hiding the water, collapses them (rho 0.199-0.336). Those two facts cannot both be about the
 * water surface shader: a pattern that survives constant-colouring a surface is not painted by
 * that surface's shader.
 *
 * The resolution is a class of mesh the terms tool structurally could not see. `applyEdits()`
 * there selects materials by `userData.waterUniforms`, and `visual-foundation.js:714` installs the
 * water shader only when `family==='water'`. The wet-bank deposit built in `province.js`
 * `_buildTile` uses `worldMaterial('wet_mud', ...)` — no water uniforms, therefore invisible to
 * every shader arm — but it is named `water:shoreline:<region>`, so `hide(['water'])` prefix-
 * matched it and the positive control took it out along with the surface.
 *
 * THE METHOD. A 2x2 over mesh class, not over shader terms:
 *      neither hidden .......... floor (site nondeterminism)
 *      surface only hidden ..... the water table itself
 *      shoreline only hidden ... the wet-bank bands            <- the hypothesis
 *      both hidden ............. the positive control the r1 critic already ran
 * Exactly one cell of that square should collapse the lanes. If BOTH single arms collapse them,
 * the lanes are shared and neither is "the owner"; if NEITHER does while `both` still collapses,
 * the effect is an interaction and this tool says so rather than picking a winner.
 *
 * AND A WORLD-SPACE MEASUREMENT, because the brief is "measure rather than assume". 20 m is a
 * round number and the source says the band lattice should be 25 m (TILE_M 300 / WATER_SEG 24 =
 * 12.5 m, stepped by 2). Neither number is taken on trust: `latticeCensus()` reads the actual
 * vertex positions of the live band geometry out of the page and reports the modal spacing of the
 * distinct axis-aligned coordinates, in metres. A sibling piece this week found a "5.5x too fine"
 * UV defect exactly this way — by measuring metres per texel instead of reading the code.
 *
 * GUARDS (RULES rule 6; a control you have never seen fail is a second copy of the experiment):
 *   - `both-hidden` is the POSITIVE control. It is known red. If it is not red here the
 *     instrument is broken and no other row may be read.
 *   - `nothing` is the floor.
 *   - every arm reports how many meshes it actually hid; an arm that hid 0 is VACUOUS and is
 *     never reported as a negative result.
 *   - arms are classified two-sided: an arm that makes the banding WORSE is flagged as loudly as
 *     one that removes it.
 *
 * Usage:
 *   node tools/visual/w1-water-lane-owner.mjs --site vista-deep-marshes --out <dir>
 *   node tools/visual/w1-water-lane-owner.mjs --site eye-blackwood --time 8 --label after
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));
const SITE = String(args.site || 'vista-deep-marshes');
const TIME = Number(args.time || 13);
const LABEL = String(args.label || 'run');
// No hard-coded output path. HAZARDS 17: three filed verdicts' artefacts were overwritten today
// by a tool whose output path was a constant. The default stays under reports/; a verdict passes
// --out and owns where its own evidence lands.
const OUT = path.resolve(REPO, args.out || `reports/visual-truth/water-lane-owner/${SITE}-${LABEL}`);
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const DEFAULT_CROP = { 'vista-deep-marshes': '560,900,300,470', 'eye-blackwood': '60,420,300,500' };
const CROP = String(args.crop || DEFAULT_CROP[SITE] || '560,900,300,470').split(',').map(Number);

const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

/* --- statistics, lifted verbatim from w1-water-lane-terms.mjs so the numbers stay comparable -- */
function lum(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) {
    y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  }
  return { y, w: p.width, h: p.height };
}
function hp(o, [x0, x1, y0, y1]) {
  const out = [];
  for (let y = y0; y < Math.min(y1, o.h); y++) {
    for (let x = x0; x < Math.min(x1, o.w); x++) {
      let s = 0, c = 0;
      for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
      out.push(o.y[y * o.w + x] - s / c);
    }
  }
  return out;
}
function hpRect(o, [x0, x1, y0, y1]) {
  const X1 = Math.min(x1, o.w), Y1 = Math.min(y1, o.h);
  const w = X1 - x0, hh = Y1 - y0, out = new Float32Array(w * hh);
  for (let y = y0; y < Y1; y++) for (let x = x0; x < X1; x++) {
    let s = 0, c = 0;
    for (let k = -4; k <= 4; k++) { const yy = y + k; if (yy < 0 || yy >= o.h) continue; s += o.y[yy * o.w + x]; c++; }
    out[(y - y0) * w + (x - x0)] = o.y[y * o.w + x] - s / c;
  }
  return { h: out, w, hh };
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const u = a[i] - ma, v = b[i] - mb; sa += u * u; sb += v * v; sab += u * v; }
  return +(sab / Math.sqrt(sa * sb)).toFixed(3);
}
function energy(h) { let s = 0; for (const v of h) s += Math.abs(v); return +(s / h.length).toFixed(3); }
function lanes(h, w, hh) {
  const at = (x, y) => h[y * w + x];
  const stats = [];
  for (let deg = -90; deg < 90; deg += 2) {
    const th = deg * Math.PI / 180, ux = Math.cos(th), uy = Math.sin(th);
    const off = Math.min(0, ux * (w - 1)) + Math.min(0, uy * (hh - 1));
    const nb = Math.ceil(Math.abs(ux) * w + Math.abs(uy) * hh) + 2;
    const acc = new Float64Array(nb), cnt = new Float64Array(nb);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const t = Math.round(ux * x + uy * y - off); if (t < 0 || t >= nb) continue; acc[t] += at(x, y); cnt[t]++; }
    const need = Math.max(8, 0.25 * Math.min(w, hh));
    const prof = []; for (let i = 0; i < nb; i++) if (cnt[i] >= need) prof.push(acc[i] / cnt[i]);
    if (prof.length < 8) continue;
    let m = 0; for (const v of prof) m += v; m /= prof.length;
    let va = 0; for (const v of prof) va += (v - m) * (v - m); va /= prof.length;
    stats.push({ deg, va });
  }
  if (!stats.length) return { lane_power: 0, lane_angle: null, lane_aniso: 1 };
  const sorted = stats.slice().sort((a, b) => b.va - a.va);
  const med = stats.slice().sort((a, b) => a.va - b.va)[Math.floor(stats.length / 2)].va;
  return { lane_power: +sorted[0].va.toFixed(3), lane_angle: sorted[0].deg, lane_aniso: +(sorted[0].va / Math.max(1e-6, med)).toFixed(2) };
}
function changed(a, b) {
  const A = lum(a), B = lum(b); let n = 0;
  for (let i = 0; i < A.y.length; i++) if (Math.abs(A.y[i] - B.y[i]) > 2) n++;
  return +(100 * n / A.y.length).toFixed(2);
}

/* --- the page ---------------------------------------------------------------------------------
 * ONE browser for the whole run (RULES rule 21). Killed by pid at the end, never by pkill. */
const g = await launchGame({ entry: 'game/index.html', width: CW, height: CH });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view'); c.width = w; c.height = h;
  const r = window.__ENGINE.renderer;
  if (r.renderer && r.renderer.setPixelRatio) r.renderer.setPixelRatio(1);
  r.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
const step = (n) => g.h('stepFrames', n);

const s = DECK.setups.find((x) => x.id === SITE);
if (!s) { console.error(`no Deck setup '${SITE}'`); await g.close(); process.exit(2); }
await g.h('teleport', s.place.x, s.place.z);
await step(40);
const snap = await g.h('snapshot');
const [px, py, pz] = snap.player.pos;
const c = s.camera;
const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
const height = c.height_m || 1.7, fwd = 60;
await g.h('camera', { pos: [px, py + height, pz], look: [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd] });
await g.h('setWeather', 'clear');
await g.h('setTimeOfDay', TIME);
await step(20);

async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}

/* --- the world-space lattice census -----------------------------------------------------------
 * Reads the LIVE geometry, not the source. For every mesh class, collect the distinct X and Z
 * vertex coordinates and report the modal gap between consecutive distinct values. A lattice
 * shows up as one dominant gap; a shoreline that follows the actual water contour does not. */
const latticeCensus = () => g.page.evaluate(() => {
  const R = window.__ENGINE.renderer;
  const classes = {};
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.geometry) return;
    const n = o.name || '';
    if (!/^water/.test(n)) return;
    const cls = /^water:shoreline:/.test(n) ? 'shoreline-band' : (/^water:/.test(n) ? 'water-surface' : 'water-other');
    const p = o.geometry.attributes.position;
    if (!p) return;
    const C = classes[cls] || (classes[cls] = { meshes: 0, verts: 0, xs: new Set(), zs: new Set(), axisAlignedQuads: 0, quads: 0 });
    C.meshes++; C.verts += p.count;
    for (let i = 0; i < p.count; i++) { C.xs.add(Math.round(p.getX(i) * 100) / 100); C.zs.add(Math.round(p.getZ(i) * 100) / 100); }
    // A quad is axis-aligned if all four of its vertices share one X or share one Z.
    for (let i = 0; i + 3 < p.count; i += 4) {
      const X = [p.getX(i), p.getX(i + 1), p.getX(i + 2), p.getX(i + 3)];
      const Z = [p.getZ(i), p.getZ(i + 1), p.getZ(i + 2), p.getZ(i + 3)];
      const sx = Math.max(...X) - Math.min(...X), sz = Math.max(...Z) - Math.min(...Z);
      C.quads++;
      if (sx < 1.2 || sz < 1.2) C.axisAlignedQuads++;
    }
  });
  const out = {};
  for (const [k, C] of Object.entries(classes)) {
    const gaps = (set) => {
      const v = [...set].sort((a, b) => a - b), h = {};
      for (let i = 1; i < v.length; i++) { const d = Math.round((v[i] - v[i - 1]) * 100) / 100; if (d > 0.001) h[d] = (h[d] || 0) + 1; }
      const top = Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => ({ gap_m: +d, count: n }));
      return { distinct: v.length, span_m: v.length ? +(v[v.length - 1] - v[0]).toFixed(2) : 0, top_gaps: top };
    };
    out[k] = { meshes: C.meshes, verts: C.verts, quads: C.quads, axis_aligned_quads: C.axisAlignedQuads,
      axis_aligned_pct: C.quads ? +(100 * C.axisAlignedQuads / C.quads).toFixed(1) : null,
      x: gaps(C.xs), z: gaps(C.zs) };
  }
  return out;
});

/* --- hiding by mesh class ---------------------------------------------------------------------
 * `include` and `exclude` are regex SOURCE strings, so the 2x2 can address a class by what it is
 * rather than by a prefix that happens to catch two classes at once. */
const hideClass = (include, exclude) => g.page.evaluate(({ include, exclude }) => {
  const R = window.__ENGINE.renderer;
  const inc = new RegExp(include), exc = exclude ? new RegExp(exclude) : null;
  window.__OWNER_HIDDEN = [];
  let hidden = 0; const names = {};
  R.scene.traverse((o) => {
    if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
    const n = o.name || '';
    if (!inc.test(n) || (exc && exc.test(n))) return;
    window.__OWNER_HIDDEN.push(o); o.visible = false; hidden++;
    names[n] = (names[n] || 0) + 1;
  });
  return { hidden, names };
}, { include, exclude: exclude || null });
const unhide = () => g.page.evaluate(() => { for (const o of (window.__OWNER_HIDDEN || [])) o.visible = true; window.__OWNER_HIDDEN = []; });

/* --- the 2x2 ---------------------------------------------------------------------------------- */
const ARMS = [
  { id: 'both-hidden', kind: 'positive-control',
    what: 'every water mesh, surface and shoreline band together — the r1 critic arm, known red. If it is not red here, no other row is readable',
    include: '^water', exclude: null },
  { id: 'surface-only-hidden', kind: 'cell',
    what: 'the water TABLE hidden, the wet-bank bands left standing',
    include: '^water', exclude: '^water:shoreline:' },
  { id: 'shoreline-only-hidden', kind: 'cell',
    what: 'the wet-bank BANDS hidden, the water table left standing — the hypothesis',
    include: '^water:shoreline:', exclude: null },
  { id: 'nothing-restore-control', kind: 'floor', what: 'nothing — the site nondeterminism floor',
    include: '^__nothing_matches_this__', exclude: null },
];

const base = await shot('00-baseline');
const baseL = lum(base), baseH = hp(baseL, CROP), baseR = hpRect(baseL, CROP);
const out = {
  tool: 'w1-water-lane-owner', site: SITE, time: TIME, label: LABEL, crop: CROP, canvas: [CW, CH], seed: SEED,
  commit: null, baseline_band_energy: energy(baseH), baseline_lane: lanes(baseR.h, baseR.w, baseR.hh),
  lattice_census: null, arms: [], checks: {}, pageErrors: [],
};
try { out.commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch {}
out.lattice_census = await latticeCensus();
console.log(`commit ${out.commit}  site ${SITE} t${TIME}  baseline lane ${JSON.stringify(out.baseline_lane)}  energy ${out.baseline_band_energy}`);
console.log('lattice census (world metres, read off the live geometry):');
console.log(JSON.stringify(out.lattice_census, null, 1));

for (const arm of ARMS) {
  const applied = await hideClass(arm.include, arm.exclude);
  await step(4);
  const buf = await shot(arm.id);
  const L = lum(buf), h = hp(L, CROP), r = hpRect(L, CROP), ln = lanes(r.h, r.w, r.hh);
  out.arms.push({
    arm: arm.id, kind: arm.kind, what: arm.what,
    meshes_hidden: applied.hidden, hidden_names: applied.names,
    rho_vs_baseline: corr(baseH, h), band_energy: energy(h),
    band_energy_pct_of_baseline: +(100 * energy(h) / out.baseline_band_energy).toFixed(1),
    ...ln,
    lane_power_pct_of_baseline: +(100 * ln.lane_power / Math.max(1e-6, out.baseline_lane.lane_power)).toFixed(1),
    whole_frame_changed_pct: changed(base, buf),
    vacuous: arm.kind !== 'floor' && applied.hidden === 0,
  });
  await unhide();
  await step(4);
}

/* --- reading the square, two-sided ------------------------------------------------------------ */
const byId = Object.fromEntries(out.arms.map((a) => [a.arm, a]));
const floor = byId['nothing-restore-control'], pos = byId['both-hidden'];
const sur = byId['surface-only-hidden'], sho = byId['shoreline-only-hidden'];
out.floor_rho = floor.rho_vs_baseline;
out.checks['INSTRUMENT-CAN-SEE-LANES'] = (pos.rho_vs_baseline < floor.rho_vs_baseline - 0.2)
  ? `PASS — both-hidden rho ${pos.rho_vs_baseline} against floor ${floor.rho_vs_baseline}`
  : `FAIL — both-hidden rho ${pos.rho_vs_baseline} did not collapse against floor ${floor.rho_vs_baseline}; every other row in this run is void`;
out.checks['NO-ARM-IS-VACUOUS'] = out.arms.filter((a) => a.vacuous).length === 0
  ? 'PASS — every non-floor arm hid at least one mesh'
  : `FAIL — vacuous arms hid nothing: ${out.arms.filter((a) => a.vacuous).map((a) => a.arm).join(', ')}`;
const collapsed = (a) => a.rho_vs_baseline < floor.rho_vs_baseline - 0.2;
out.checks['WHICH-CELL-OWNS-THE-LANES'] = (() => {
  if (sur.vacuous || sho.vacuous) return 'INDETERMINATE — a cell of the square is vacuous';
  if (collapsed(sho) && !collapsed(sur)) return `SHORELINE BANDS OWN THE LANES — shoreline-only rho ${sho.rho_vs_baseline}, surface-only rho ${sur.rho_vs_baseline}, floor ${floor.rho_vs_baseline}`;
  if (collapsed(sur) && !collapsed(sho)) return `WATER SURFACE OWNS THE LANES — surface-only rho ${sur.rho_vs_baseline}, shoreline-only rho ${sho.rho_vs_baseline}, floor ${floor.rho_vs_baseline}`;
  if (collapsed(sur) && collapsed(sho)) return `SHARED — both single arms collapse the lanes (surface ${sur.rho_vs_baseline}, shoreline ${sho.rho_vs_baseline}); neither is the sole owner`;
  return `INTERACTION — neither single arm collapses the lanes (surface ${sur.rho_vs_baseline}, shoreline ${sho.rho_vs_baseline}) while both together does (${pos.rho_vs_baseline}); this is the two-guards-for-one-defect shape, not an owner`;
})();
const F = floor.lane_power, FA = floor.lane_aniso;
out.arms.forEach((a) => {
  if (a.vacuous) { a.verdict = 'VACUOUS'; return; }
  const d = 100 * (a.lane_power - F) / Math.max(1e-6, F), da = 100 * (a.lane_aniso - FA) / Math.max(1e-6, FA);
  a.lane_power_vs_floor_pct = +d.toFixed(1); a.lane_aniso_vs_floor_pct = +da.toFixed(1);
  a.energy_vs_floor_pct = +(100 * (a.band_energy - floor.band_energy) / floor.band_energy).toFixed(1);
  a.verdict = (d < -35 && da < -20) ? 'REMOVES THE LANES'
    : (d < -35 ? 'weaker banding, same anisotropy — dimmed the crop rather than unbanding it'
      : (d > 35 ? 'MAKES THE BANDING WORSE' : 'no effect on the lanes'));
});
out.pageErrors = g.errors.slice(0, 20);
fs.writeFileSync(path.join(OUT, 'lane-owner.json'), JSON.stringify(out, null, 2));
console.log('');
for (const [k, v] of Object.entries(out.checks)) console.log(`${k}: ${v}`);
console.log('');
for (const a of out.arms) console.log(`  ${a.arm.padEnd(26)} hid ${String(a.meshes_hidden).padStart(4)}  rho ${String(a.rho_vs_baseline).padStart(6)}  lane_power ${String(a.lane_power).padStart(8)} (${String(a.lane_power_vs_floor_pct).padStart(7)}% vs floor)  aniso ${String(a.lane_aniso).padStart(6)} @${String(a.lane_angle).padStart(4)}  energy ${String(a.band_energy).padStart(7)} (${String(a.energy_vs_floor_pct).padStart(7)}%)  chg ${String(a.whole_frame_changed_pct).padStart(6)}%  ${a.verdict}`);
console.log(`\nwrote ${path.join(OUT, 'lane-owner.json')}`);
await g.close();
process.exit(String(out.checks['INSTRUMENT-CAN-SEE-LANES']).startsWith('PASS') && String(out.checks['NO-ARM-IS-VACUOUS']).startsWith('PASS') ? 0 : 3);
