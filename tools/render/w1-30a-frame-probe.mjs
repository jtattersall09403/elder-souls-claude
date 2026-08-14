#!/usr/bin/env node
/**
 * w1-30a-frame-probe.mjs — measure what W1-30A changed, on the same frames, in one process.
 *
 * WHAT IT IS FOR. The two defects this piece fixes are (1) the game has no antialiasing of any
 * kind and (2) the colour grade is a no-op. The first is a MOTION defect: a silhouette that looks
 * fine in a still and crawls when the camera pans. So the instrument has to move the camera, and
 * it has to move it by well under a pixel per frame, because that is the regime in which aliasing
 * actually costs you something.
 *
 * WHAT IT REFUSES TO DO, and each refusal is a specific past failure of this project:
 *
 *  - It never compares two Pod runs. `post/baseline-composite.js` holds the pre-A compositor, so
 *    "before" and "after" are the SAME frames on the SAME GPU inside one process. Two runs differ
 *    by driver state and wall clock as much as by the change.
 *  - It never reports a number without its null control, and no null control here is the trivial
 *    one. The grade's null is not "grade off" but every region pinned to ONE REAL GRADE — the
 *    plausible wrong answer. An empty input passes almost any check by accident (directive §6).
 *  - It never claims GPU. `renderer_string` is read from the live context and stamped on the
 *    report, exactly as `tools/visual/deck.mjs` does. A SwiftShader run says so.
 *
 * WHAT IT REUSES (directive §3). The camera stops are `tools/visual/deck.json` — W1-30V's shot
 * deck — not a private list, so every number here is on a camera stop another child can re-shoot.
 * The Deck itself captures stills only; the pan is added here because no motion runner exists yet.
 *
 * Usage:
 *   node tools/render/w1-30a-frame-probe.mjs --out reports/w1-30a/probe --stops 6 --pan 48
 *   node tools/render/w1-30a-frame-probe.mjs --hardware-gpu        (on the Pod)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(REPO, args.out || 'reports/w1-30a/probe');
const FRAMES = path.join(OUT, 'frames');
fs.mkdirSync(FRAMES, { recursive: true });
const HW = args.hardwareGpu === true || args['hardware-gpu'] === true || process.env.VT_HARDWARE_GPU === '1';
const PAN = Number(args.pan || 48);            // frames per pan
const PAN_STEP = Number(args.panStep || 0.05); // degrees of yaw per frame — ~0.5 px at 960 wide
const STOPS = args.stops ? Number(args.stops) : 6;
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
const SEED = Number(args.seed || 20260814);
const KEEP = Number(args.keepFrames || 8);     // PNGs written per variant per stop, for humans

const DECK = JSON.parse(fs.readFileSync(path.join(REPO, 'tools/visual/deck.json'), 'utf8'));

// Camera stops, taken from the Deck. Vistas and eye-level stops first: those are the frames with
// long silhouettes against sky, which is where aliasing is worst and where a grade has the most
// surface to act on. `char-player` and a street are pulled in explicitly because the plan's
// falsification audit says the human read must include them (good light on a capsule character is
// still a capsule character) — they are here so that fact is visible rather than avoided.
const WANT = ['vista-blackwood', 'vista-stone-wastes', 'eye-deep-marshes', 'vista-salt-hills',
  'street-lilmoth', 'char-player', 'vista-clay-moor', 'eye-hive', 'interior-thorn-hall',
  'vista-valus-ridge', 'vista-crimson-coast', 'eye-eastern-rootlands'];
const stops = WANT.map((id) => DECK.setups.find((s) => s.id === id)).filter(Boolean).slice(0, STOPS);
if (!stops.length) { console.error('no deck setups matched'); process.exit(2); }

// The variants. Each is a page-side reconfiguration of the SHIPPING renderer, applied through the
// same `setVisualFeature` / `registerComposite` surface a player's settings screen would use.
const VARIANTS = [
  { id: 'baseline', why: 'the pre-A compositor, verbatim: no MSAA anywhere, depth-blur standing in for AA, saturation x1.035' },
  { id: 'after', why: 'shipping: MSAA + FXAA + per-region grade + dither' },
  { id: 'after-nomsaa', why: 'null control for MSAA alone — everything else stays on' },
  { id: 'after-nofxaa', why: 'null control for the post edge pass alone' },
  { id: 'after-noaa', why: 'null control for both AA paths: must return to the baseline figure' },
  { id: 'after-nodither', why: 'null control for dither — banding must come back' },
  { id: 'after-flatgrade', why: 'NULL CONTROL FOR THE GRADE, and the plausible wrong answer: every region pinned to ONE REAL grade, not to no grade' },
];

const t0 = Date.now();
const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720, hardwareGpu: HW });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
await g.h('ready');
await g.page.evaluate(({ w, h }) => {
  const c = document.getElementById('view');
  c.width = w; c.height = h;
  window.__ENGINE.renderer.setSize(w, h);
}, { w: CW, h: CH });
await g.h('setSeed', SEED);
await g.h('setUIVisible', false);

const renderer_string = await g.page.evaluate(() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'unavailable: no webgl2 context';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  } catch (e) { return `unavailable: ${e.message}`; }
});
const software = /^unavailable|^unknown/i.test(renderer_string) || /swiftshader|llvmpipe|software|mesa/i.test(renderer_string);
console.log(`renderer: ${renderer_string}${software ? '   *** SOFTWARE — not valid for an appearance claim (W1-30-EVIDENCE §4) ***' : ''}`);

// ---- the page-side instrument -------------------------------------------------------------
// Everything below runs in the browser so that a 48-frame pan costs 48 GPU frames and zero PNG
// round-trips. Reading the canvas back through a 2D context needs `preserveDrawingBuffer`, which
// `renderer.js` turns on only under `__ES_AUTOMATED` — the harness sets it, so this works and a
// player still does not pay for a second copy of the framebuffer.
await g.page.evaluate(() => {
  const view = document.getElementById('view');
  const scratch = document.createElement('canvas');
  let ctx = null;
  let prev = null;

  function luma() {
    scratch.width = view.width; scratch.height = view.height;
    ctx = ctx || scratch.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(view, 0, 0);
    const d = ctx.getImageData(0, 0, view.width, view.height).data;
    const n = view.width * view.height;
    const L = new Float32Array(n);
    for (let i = 0, p = 0; i < n; i++, p += 4) L[i] = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
    return { L, w: view.width, h: view.height, data: d };
  }

  /** Crawl: what fraction of the frame changed by more than 24/255 since the previous frame.
   * This is the number aliasing costs you. A resolved edge slides; an aliased edge pops from
   * one pixel to the next, and every pop lands in this count. */
  function crawlAgainstPrev(L) {
    if (!prev || prev.length !== L.length) { prev = L; return null; }
    let n = 0;
    const thr = 24 / 255;
    for (let i = 0; i < L.length; i++) if (Math.abs(L[i] - prev[i]) > thr) n++;
    prev = L;
    return n / L.length;
  }

  /**
   * Silhouette transition width, in pixels, at strong horizontal luma steps: the 10%-to-90% rise
   * distance, averaged over every edge found. A hard-aliased edge is 1.0 by construction — the
   * value goes from plateau to plateau between two adjacent pixels. Anything above ~1.5 means
   * something is actually resolving the edge rather than choosing a side.
   */
  function edgeWidth(L, w, h) {
    let sum = 0, count = 0;
    for (let y = 4; y < h - 4; y += 2) {
      const row = y * w;
      for (let x = 6; x < w - 6; x++) {
        const step = L[row + x + 1] - L[row + x];
        if (Math.abs(step) < 0.12) continue;
        // local maximum only, so a wide ramp is not counted once per pixel
        if (Math.abs(L[row + x + 2] - L[row + x + 1]) > Math.abs(step)) continue;
        if (Math.abs(L[row + x] - L[row + x - 1]) > Math.abs(step)) continue;
        // plateaus either side: walk out until the run stops moving in the same direction
        const dir = Math.sign(step);
        let a = x, b = x + 1;
        for (let k = 0; k < 6 && a > 1; k++) { if (Math.sign(L[row + a] - L[row + a - 1]) !== dir) break; a--; }
        for (let k = 0; k < 6 && b < w - 2; k++) { if (Math.sign(L[row + b + 1] - L[row + b]) !== dir) break; b++; }
        const lo = L[row + a], hi = L[row + b], span = hi - lo;
        if (Math.abs(span) < 0.12) continue;
        const t10 = lo + 0.1 * span, t90 = lo + 0.9 * span;
        let i10 = -1, i90 = -1;
        for (let i = a; i <= b; i++) {
          const v = L[row + i];
          if (i10 < 0 && (dir > 0 ? v >= t10 : v <= t10)) i10 = i;
          if (dir > 0 ? v >= t90 : v <= t90) { i90 = i; break; }
        }
        if (i10 < 0 || i90 < 0 || i90 < i10) continue;
        sum += (i90 - i10) + 1; count++;
      }
    }
    return count ? { width_px: sum / count, edges: count } : { width_px: null, edges: 0 };
  }

  /** Banding: the longest run of one identical 8-bit green value down a column, over the top
   * 45% of the frame, which is where the sky gradient lives. Dither's whole job is to break
   * these runs, so this is the one number that must get WORSE when dither is switched off. */
  function bandRun(data, w, h) {
    const top = Math.floor(h * 0.45);
    let longest = 0, sumTop = 0, cols = 0;
    for (let x = 4; x < w; x += 8) {
      let run = 1, best = 1, last = -1;
      for (let y = 0; y < top; y++) {
        const v = data[(y * w + x) * 4 + 1];
        if (v === last) { run++; if (run > best) best = run; } else { run = 1; }
        last = v;
      }
      if (best > longest) longest = best;
      sumTop += best; cols++;
    }
    return { longest_run_px: longest, mean_run_px: cols ? sumTop / cols : 0 };
  }

  /** Where the frame sits in colour: circular-mean hue, mean saturation, mean value. This is the
   * pair the plan's "grade separates places" row compares between regions. */
  function colourPoint(data, w, h) {
    let sx = 0, sy = 0, ss = 0, sv = 0, n = 0;
    for (let i = 0; i < w * h; i += 7) {
      const p = i * 4, r = data[p] / 255, gg = data[p + 1] / 255, b = data[p + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
      let hDeg = 0;
      if (d > 1e-6) {
        if (mx === r) hDeg = 60 * (((gg - b) / d) % 6);
        else if (mx === gg) hDeg = 60 * ((b - r) / d + 2);
        else hDeg = 60 * ((r - gg) / d + 4);
      }
      const rad = hDeg * Math.PI / 180, s = mx > 0 ? d / mx : 0;
      sx += Math.cos(rad) * s; sy += Math.sin(rad) * s; ss += s; sv += mx; n++;
    }
    const hue = (Math.atan2(sy / n, sx / n) * 180 / Math.PI + 360) % 360;
    return { hue_deg: hue, chroma: Math.hypot(sx / n, sy / n), saturation: ss / n, value: sv / n };
  }

  window.__W130A = {
    resetSeq() { prev = null; },
    sample(withStills) {
      const f = luma();
      const crawl = crawlAgainstPrev(f.L);
      if (!withStills) return { crawl };
      return {
        crawl,
        ...edgeWidth(f.L, f.w, f.h),
        ...bandRun(f.data, f.w, f.h),
        ...colourPoint(f.data, f.w, f.h),
      };
    },
  };
  return true;
});

// ---- variant application --------------------------------------------------------------------
await g.page.evaluate(async () => {
  const m = await import('./src/render/post/baseline-composite.js');
  window.__W130A_BASELINE = m.buildBaselineCompositor;
});

async function applyVariant(id) {
  return g.page.evaluate(async (v) => {
    const r = window.__ENGINE.renderer;
    // Always come back to the shipping compositor first: `registerComposite` swaps the module
    // wholesale, so a variant that installed the baseline must be undone before the next one or
    // every later "after" number is silently a baseline number.
    r.forceGradeRegion = null;
    for (const f of ['msaa', 'antialias', 'grade', 'dither', 'postprocess', 'ao']) r.setVisualFeature(f, true);
    r._buildCompositorForTier();
    if (v === 'baseline') {
      // Dispose the shipping compositor `_buildCompositorForTier` just made, or a seven-variant
      // sweep leaks one ~90 MB multisample target per stop and dies of it half way through.
      const orphan = r._composite;
      const mod = window.__W130A_BASELINE(r.worldTarget.width, r.worldTarget.height);
      r.registerComposite(mod);
      r.disposeComposite(orphan);
    }
    if (v === 'after-nomsaa') r.setVisualFeature('msaa', false);
    if (v === 'after-nofxaa') r.setVisualFeature('antialias', false);
    if (v === 'after-noaa') { r.setVisualFeature('msaa', false); r.setVisualFeature('antialias', false); }
    if (v === 'after-nodither') r.setVisualFeature('dither', false);
    if (v === 'after-flatgrade') r.forceGradeRegion = 'neutral';
    return r.qualityReport();
  }, id);
}

// ---- posing, taken from tools/visual/deck.mjs so the stops are the Deck's stops ---------------
const call = async (m, ...a) => { try { return { ok: true, v: await g.h(m, ...a) }; } catch (e) { return { ok: false, e: String(e.message).split('\n')[0].slice(0, 160) }; } };

async function goTo(setup) {
  const p = setup.place;
  if (p.kind === 'interior') {
    if (!p.id) return 'no interior id';
    const r = await call('enterInterior', p.id);
    if (!r.ok) return `enterInterior refused: ${r.e}`;
  } else {
    const where = await call('whereAmI');
    if (where.ok && where.v && where.v.interior) await call('exitInterior');
    const r = await call('teleport', p.x, p.z);
    if (!r.ok) return `teleport refused: ${r.e}`;
    await call('stepFrames', 4);
  }
  await g.h('stepFrames', 12);
  return null;
}

/** The eye and the look-at for a setup, plus a yaw offset. Same arithmetic as deck.mjs's
 * `poseCamera`, restated here because deck.mjs is a script and exports nothing.
 *
 * `anchor` is the player position, read ONCE per stop and passed in. The first version asked the
 * harness for a snapshot on every frame of the pan, which is 48 extra round-trips per variant per
 * stop and — worse — makes the camera path depend on anything that nudges the player, so two
 * variants would not have been panning over the same ground. */
async function pose(setup, yawOffsetDeg, anchor) {
  const cam = setup.camera;
  const [px, py, pz] = anchor;
  const yaw = ((Number(cam.yaw_deg || 0)) + yawOffsetDeg) * Math.PI / 180;
  const pitch = (Number(cam.pitch_deg || 0)) * Math.PI / 180;
  const dist = Number(cam.distance_m || 0), height = Number(cam.height_m || 0);
  const eye = dist > 0
    ? [px + Math.sin(yaw) * Math.cos(pitch) * dist, py + 1.5 - Math.sin(pitch) * dist, pz + Math.cos(yaw) * Math.cos(pitch) * dist]
    : [px, py + height, pz];
  const fwd = 60;
  const look = dist > 0 ? [px, py + 1.1, pz]
    : [px + Math.sin(yaw) * fwd, py + height + Math.tan(pitch) * fwd, pz + Math.cos(yaw) * fwd];
  const r = await call('camera', { pos: eye, look });
  return r.ok ? null : `camera refused: ${r.e}`;
}

async function shoot(file) {
  const d = await g.h('screenshot');
  const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(path.join(FRAMES, file), buf);
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

// ---- the run ----------------------------------------------------------------------------------
const rows = [];
const reports = {};
console.log(`probe: ${stops.length} stops x ${VARIANTS.length} variants, pan ${PAN} frames @ ${PAN_STEP} deg/frame, ${CW}x${CH}`);

for (const setup of stops) {
  const err = await goTo(setup);
  if (err) { console.log(`  RED  ${setup.id} — ${err}`); rows.push({ stop: setup.id, status: 'red', reason: err }); continue; }
  await call('setWeather', 'clear');
  await call('setTimeOfDay', 13);
  const snap = await call('snapshot');
  if (!snap.ok) { console.log(`  RED  ${setup.id} — snapshot failed`); rows.push({ stop: setup.id, status: 'red', reason: 'snapshot failed' }); continue; }
  const anchor = snap.v.player.pos;
  for (const variant of VARIANTS) {
    reports[variant.id] = await applyVariant(variant.id);
    const perr = await pose(setup, 0, anchor);
    if (perr) { rows.push({ stop: setup.id, variant: variant.id, status: 'red', reason: perr }); continue; }
    await g.h('stepFrames', 10);

    // 1. the still, and the still statistics
    await g.h('renderFrame');
    await g.page.evaluate(() => window.__W130A.resetSeq());
    const still = await g.page.evaluate(() => window.__W130A.sample(true));
    const stillHash = await shoot(`${setup.id}__${variant.id}__still.png`);

    // 2. the static control: no camera motion at all. Whatever crawl this reports is animation
    //    (foliage, water, particles) and NOT aliasing, so it is the floor every pan number has to
    //    be read against. Without it a windy tree would be scored as an aliasing win.
    await g.page.evaluate(() => window.__W130A.resetSeq());
    let staticCrawl = 0, staticN = 0;
    for (let f = 0; f < 8; f++) {
      await g.h('renderFrame');
      const s = await g.page.evaluate(() => window.__W130A.sample(false));
      if (s.crawl !== null) { staticCrawl += s.crawl; staticN++; }
    }

    // 3. the pan: sub-pixel yaw, which is the regime where aliasing crawls
    await g.page.evaluate(() => window.__W130A.resetSeq());
    let panCrawl = 0, panN = 0;
    for (let f = 0; f < PAN; f++) {
      await pose(setup, f * PAN_STEP, anchor);
      await g.h('renderFrame');
      const s = await g.page.evaluate(() => window.__W130A.sample(false));
      if (s.crawl !== null) { panCrawl += s.crawl; panN++; }
      if (f % Math.max(1, Math.floor(PAN / KEEP)) === 0 && f < KEEP * Math.floor(PAN / KEEP)) {
        await shoot(`${setup.id}__${variant.id}__pan${String(f).padStart(3, '0')}.png`);
      }
    }

    rows.push({
      stop: setup.id, block: setup.block, region: setup.region || null, variant: variant.id,
      status: 'ok', still_hash: stillHash,
      msaa_in_force: reports[variant.id].msaaInForce, grade_recipe: reports[variant.id].grade,
      edge_width_px: still.width_px, edges_found: still.edges,
      band_longest_px: still.longest_run_px, band_mean_px: still.mean_run_px,
      hue_deg: still.hue_deg, chroma: still.chroma, saturation: still.saturation, value: still.value,
      crawl_static: staticN ? staticCrawl / staticN : null,
      crawl_pan: panN ? panCrawl / panN : null,
    });
    const r = rows[rows.length - 1];
    console.log(`  ${setup.id.padEnd(24)} ${variant.id.padEnd(16)} edge=${(r.edge_width_px || 0).toFixed(2)}px  crawl=${((r.crawl_pan || 0) * 100).toFixed(2)}%  band=${r.band_longest_px}px  hue=${(r.hue_deg || 0).toFixed(0)}deg  msaa=${r.msaa_in_force}`);
  }
}

// A second pass for the grade, which is the one thing a single time of day cannot show: the plan's
// row is "distinguishable between any two regions AT THE SAME time/weather", and a grade driven by
// `lighting.js` also has to move when the light does.
const gradeRows = [];
for (const setup of stops.filter((s) => s.region)) {
  const err = await goTo(setup);
  if (err) continue;
  const gsnap = await call('snapshot');
  if (!gsnap.ok) continue;
  const ganchor = gsnap.v.player.pos;
  for (const variant of ['after', 'after-flatgrade']) {
    await applyVariant(variant);
    for (const [tid, hour] of [['t0800', 8], ['t1300', 13], ['t1930', 19.5], ['t0100', 1]]) {
      for (const wid of ['clear', 'rain']) {
        await call('setWeather', wid);
        await call('setTimeOfDay', hour);
        await pose(setup, 0, ganchor);
        await g.h('stepFrames', 12);
        await g.h('renderFrame');
        await g.page.evaluate(() => window.__W130A.resetSeq());
        const s = await g.page.evaluate(() => window.__W130A.sample(true));
        gradeRows.push({ region: setup.region, stop: setup.id, variant, time: tid, weather: wid,
          hue_deg: s.hue_deg, chroma: s.chroma, saturation: s.saturation, value: s.value });
      }
    }
  }
}

const manifest = {
  schema: 'elder-souls/w1-30a-frame-probe@1',
  piece: 'W1-30A', commit: process.env.GIT_COMMIT || null,
  renderer_string, software_renderer: software,
  evidence_class: software
    ? 'SOFTWARE — valid for determinism, plumbing and the sabotage matrix. NOT valid for an antialiasing or appearance claim (W1-30-EVIDENCE §4).'
    : 'HARDWARE — valid for appearance claims.',
  canvas: [CW, CH], seed: SEED, pan_frames: PAN, pan_step_deg: PAN_STEP,
  variants: VARIANTS, quality_reports: reports,
  stops: stops.map((s) => s.id),
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  rows, grade_rows: gradeRows,
};
fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${rows.filter((r) => r.status === 'ok').length} ok, ${rows.filter((r) => r.status === 'red').length} red, ${manifest.seconds}s`);
console.log(`report: ${path.relative(REPO, path.join(OUT, 'probe.json'))}`);
await g.close();
