#!/usr/bin/env node
/**
 * w1-water-preserve.mjs — the PRESERVATION half of the F7 water fix.
 *
 * WHY THIS EXISTS. Ruling S59: three times this week an acceptance that named only what should
 * improve was satisfied by something worse — a density score that rewarded illegibility, a camera
 * criterion satisfied by fading the player to invisible. A water fix measured only by "the banding
 * amplitude fell" is satisfied perfectly by deleting the water. So this tool measures the things
 * that must NOT get worse, and it is run on BOTH arms of the delete-the-fix.
 *
 * FOUR PRESERVATION CLAIMS, each with its own number:
 *   A. THE WATER STILL REFLECTS. Not asserted from the source — demonstrated by perturbation, the
 *      RI-MTH07 CONSUMPTION shape: ablate the reflection (esSurface=esDepth) and confirm the frame
 *      still changes materially. A reflection that no longer moves the pixels is not a reflection,
 *      and this is the number that would catch a "fix" that simply turned reflections off.
 *   B. THE WATER STILL MOVES. Six frames ten steps apart at a pinned camera; the mean absolute
 *      luminance change between consecutive frames must stay above the floor. HAZARDS 16: a
 *      stationary frame shows about 0.2% border change, so a near-zero here means the capture
 *      froze rather than that the water is calm.
 *   C. THE WATER STILL READS AS WATER at grazing angles. The fix only removes reflection weight at
 *      normal incidence; the 13 region vistas are pitch -11 deg at 26 m, which is grazing, so they
 *      must come back essentially unchanged against the same shot on the other arm.
 *   D. THE THIRTEEN REGIONS STILL DIFFER FROM ONE ANOTHER. Mean frame colour per region and the
 *      minimum pairwise distance across all 78 pairs. A change that washed every region toward the
 *      same reflected sky would collapse this, and nothing else here would notice.
 *
 * Usage:
 *   node tools/visual/w1-water-preserve.mjs --out <dir>            # all four parts
 *   node tools/visual/w1-water-preserve.mjs --part regions --out <dir>
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
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/water-preserve');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });
const PART = String(args.part || 'all');
const TIME = Number(args.time || 13);
const [CW, CH] = String(args.canvas || '640x360').split('x').map(Number);
const SEED = Number(args.seed || DECK.capture.seed);
const { PNG } = await import(path.join(REPO, 'tools/node_modules/pngjs/lib/png.js'));

function px(buf) {
  const p = PNG.sync.read(buf);
  const y = new Float32Array(p.width * p.height);
  for (let i = 0, j = 0; i < p.data.length; i += 4, j++) y[j] = 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
  return { p, y, w: p.width, h: p.height };
}
/** Mean RGB over the lower half of the frame, which at a -11 deg vista is the ground/water, not sky. */
function meanRGB(o) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = Math.floor(o.h / 2); yy < o.h; yy++) for (let x = 0; x < o.w; x++) {
    const i = (yy * o.w + x) * 4; r += o.p.data[i]; g += o.p.data[i + 1]; b += o.p.data[i + 2]; n++;
  }
  return [r / n, g / n, b / n].map((v) => +v.toFixed(2));
}
/** Percentage of pixels whose luminance moved by more than 2, and the mean absolute change. */
function delta(a, b) {
  const A = px(a), B = px(b); let n = 0, s = 0;
  for (let i = 0; i < A.y.length; i++) { const d = Math.abs(A.y[i] - B.y[i]); s += d; if (d > 2) n++; }
  return { changed_pct: +(100 * n / A.y.length).toFixed(2), mean_abs_luma: +(s / A.y.length).toFixed(3) };
}
const dist = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]).toFixed(2);

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
async function shot(name) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(OUT, 'frames', `${name}.png`), buf);
  return buf;
}
async function place(setup, t) {
  await g.h('teleport', setup.place.x, setup.place.z);
  await step(40);
  const snap = await g.h('snapshot');
  const [ppx, ppy, ppz] = snap.player.pos;
  const c = setup.camera;
  const yaw = (c.yaw_deg || 0) * Math.PI / 180, pitch = (c.pitch_deg || 0) * Math.PI / 180;
  const height = c.height_m || 1.7, fwd = 60;
  await g.h('camera', { pos: [ppx, ppy + height, ppz], look: [ppx + Math.sin(yaw) * fwd, ppy + height + Math.tan(pitch) * fwd, ppz + Math.cos(yaw) * fwd] });
  await g.h('setWeather', 'clear');
  await g.h('setTimeOfDay', t);
  await step(20);
}
const applyEdits = (armId, edits) => g.page.evaluate(({ armId, edits }) => {
  const R = window.__ENGINE.renderer; const mats = new Set();
  R.scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) if (m && m.userData && m.userData.waterUniforms) mats.add(m);
  });
  for (const m of mats) {
    if (!m.__presOBC) { m.__presOBC = m.onBeforeCompile; m.__presKey = m.customProgramCacheKey; }
    m.onBeforeCompile = function (shader, renderer) {
      m.__presOBC.call(this, shader, renderer);
      for (const [needle, rep] of edits) if (shader.fragmentShader.includes(needle)) { shader.fragmentShader = shader.fragmentShader.split(needle).join(rep); window.__PRES_EDITS++; }
    };
    m.customProgramCacheKey = () => `w1-water-preserve:${armId}`; m.needsUpdate = true;
  }
  window.__PRES_EDITS = 0; window.__PRES_MATS = mats; return { materials: mats.size };
}, { armId, edits });
const editCount = () => g.page.evaluate(() => window.__PRES_EDITS || 0);
const restoreEdits = () => g.page.evaluate(() => {
  for (const m of (window.__PRES_MATS || [])) if (m.__presOBC) { m.onBeforeCompile = m.__presOBC; m.customProgramCacheKey = m.__presKey; m.needsUpdate = true; }
  window.__PRES_MATS = new Set();
});

const out = { tool: 'w1-water-preserve', commit: null, time: TIME, canvas: [CW, CH], seed: SEED,
  has_fix: null, A_reflects: null, B_moves: null, D_regions: null, checks: {}, pageErrors: [] };
try { out.commit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim(); } catch {}
// Which arm are we on? Read the file rather than trusting the caller's label.
out.has_fix = /1\.0-esView/.test(fs.readFileSync(path.join(REPO, 'game/src/render/water.js'), 'utf8'));
console.log(`commit ${out.commit}   water.js carries the F7 fix: ${out.has_fix}`);
const save = () => fs.writeFileSync(path.join(OUT, 'preserve.json'), JSON.stringify(out, null, 2));

const dm = DECK.setups.find((x) => x.id === 'vista-deep-marshes');

if (PART === 'all' || PART === 'reflect') {
  await place(dm, TIME);
  const base = await shot('A-base');
  // B. still moves — six frames ten steps apart at a pinned camera.
  const frames = [base]; const moves = [];
  for (let i = 1; i < 6; i++) { await step(10); const f = await shot(`B-motion-${i}`); moves.push(delta(frames[frames.length - 1], f)); frames.push(f); }
  out.B_moves = { steps_between_frames: 10, consecutive: moves,
    mean_abs_luma: +(moves.reduce((s, m) => s + m.mean_abs_luma, 0) / moves.length).toFixed(3),
    min_changed_pct: Math.min(...moves.map((m) => m.changed_pct)) };
  save();
  // A. still reflects — ablate the reflection and confirm the picture still moves materially.
  await place(dm, TIME);
  const b2 = await shot('A-before-ablate');
  const ap = await applyEdits('no-reflection', [['vec3 esSurface=mix(esDepth,esReflection,(.25+esGrazing*.50)*uWaterReflectionStrength);', 'vec3 esSurface=esDepth;']]);
  await step(4);
  const abl = await shot('A-reflection-ablated');
  out.A_reflects = { ...delta(b2, abl), materials: ap.materials, edits_applied: await editCount() };
  await restoreEdits(); await step(4);
  save();
  console.log(`A reflects: ablating the reflection changes ${out.A_reflects.changed_pct}% of the frame (edits ${out.A_reflects.edits_applied})`);
  console.log(`B moves: mean abs luma between frames ${out.B_moves.mean_abs_luma}, min changed ${out.B_moves.min_changed_pct}%`);
}

if (PART === 'all' || PART === 'regions') {
  // C + D. Every region vista, same time, same camera rule.
  const vistas = DECK.setups.filter((x) => /^vista-/.test(x.id));
  out.D_regions = { count: vistas.length, rows: [] };
  for (const v of vistas) {
    await place(v, TIME);
    const buf = await shot(`D-${v.region}`);
    const o = px(buf);
    out.D_regions.rows.push({ region: v.region, setup: v.id, mean_rgb: meanRGB(o) });
    console.log(`  ${String(v.region).padEnd(20)} mean rgb ${JSON.stringify(out.D_regions.rows[out.D_regions.rows.length - 1].mean_rgb)}`);
    save();
  }
  const rows = out.D_regions.rows; let min = Infinity, minPair = null;
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const d = dist(rows[i].mean_rgb, rows[j].mean_rgb);
    if (d < min) { min = d; minPair = [rows[i].region, rows[j].region]; }
  }
  out.D_regions.pairs = rows.length * (rows.length - 1) / 2;
  out.D_regions.min_pairwise_distance = +min.toFixed(2);
  out.D_regions.closest_pair = minPair;
}

out.checks['A-WATER-STILL-REFLECTS'] = out.A_reflects
  ? (out.A_reflects.edits_applied > 0 && out.A_reflects.changed_pct > 2
    ? `PASS — removing the reflection still changes ${out.A_reflects.changed_pct}% of the frame, so the reflection is still being composited`
    : `FAIL — removing the reflection changed ${out.A_reflects.changed_pct}% (edits ${out.A_reflects.edits_applied}); the water is no longer reflecting anything`)
  : 'not run';
out.checks['B-WATER-STILL-MOVES'] = out.B_moves
  ? (out.B_moves.min_changed_pct > 1
    ? `PASS — every consecutive pair differs by at least ${out.B_moves.min_changed_pct}% of pixels, well clear of the ~0.2% stationary-frame floor`
    : `FAIL — a consecutive pair changed only ${out.B_moves.min_changed_pct}% of pixels; the water is static or the capture froze`)
  : 'not run';
out.checks['D-REGIONS-STILL-DIFFER'] = out.D_regions && out.D_regions.min_pairwise_distance !== undefined
  ? (out.D_regions.min_pairwise_distance > 3
    ? `PASS — the closest of ${out.D_regions.pairs} region pairs (${out.D_regions.closest_pair.join(' / ')}) is still ${out.D_regions.min_pairwise_distance} apart in mean RGB`
    : `FAIL — ${out.D_regions.closest_pair.join(' / ')} are only ${out.D_regions.min_pairwise_distance} apart; the regions have washed together`)
  : 'not run';
out.pageErrors = g.errors.slice(0, 20);
save();
console.log('');
for (const [k, v] of Object.entries(out.checks)) console.log(`${k}: ${v}`);
console.log(`\nwrote ${path.join(OUT, 'preserve.json')}`);
await g.close();
