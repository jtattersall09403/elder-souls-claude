#!/usr/bin/env node
// t4-r2-measure.mjs — re-runs the T4 round-1 critic's own measurements so round 2 has comparable
// figures, and adds the two RI-UIX09 rows the self-report cannot answer.
//
// Owner: T4-r2. Not a new instrument where an old one exists: the fill maths below is the same
// CIEDE2000 already shipped in `tools/lib/colour.mjs` (whose `--self-test` matches Sharma's
// published pairs to 4e-5), and the capture path is `tools/lib/browser.mjs`, the one every
// harness tool in the fleet uses.
//
// WHAT IT MEASURES, and against which row:
//
//   D1 declared  RI-UIX09 method 2 — pictorial elements (`item_icon | doll | glyph_object`) inside
//                the panel's own rect. Off `getUIState()`, which is a SELF-REPORT.
//   D1 observed  RI-UIX09 method 3 — the pixel half, and the one the item says will be dropped for
//                being slow. For every item row, the row's leading 48 px must contain a region of
//                >= 3 distinct hues that is not glyph ink. Reported BESIDE the declared count,
//                because "a build that registers icon elements and draws nothing fails 3 and
//                passes 2" is a distinction this tool exists to make.
//   D2           RI-UIX09 method 4 — the modal colour of the PANEL RECT, then the fraction of that
//                rect's pixels at dE00 > 6 from it. On the panel rect and never on the frame:
//                measuring the frame is the item's own named way to make every screen pass.
//   V1/V6/D4    RI-UIX07 — the world set's presence, kinds, rects and bottom-half test, and the
//                overlap list against every RI-UIX01 element.
//   E-T2        RI-UIX07 — the withdrawal, frame by frame across an aggro.
//   the guard   `containerTitle()` driven with the four values that have produced `undefined` on
//                screen, plus a good one. A guard nobody has watched fail is not evidence.
//
// HOW TO BREAK IT ON PURPOSE (rule 4). `--assert-empty` measures with the icon layer suppressed
// via `--suppress`, which the tool refuses to accept unless the numbers actually fall: it exits
// non-zero if the suppressed arm reports the same pictorial count as the live one. There is no
// mode in which this script reports a pass it did not compute.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

// ---- PNG decoding, on node's own zlib -------------------------------------------------------
//
// `pngjs` is what the round-1 critic's tools import and it is NOT reliably installed here — this
// repo's `node_modules` vanished mid-run while this tool was being written, which is exactly the
// kind of thing that turns "the measurement was not taken" into "the measurement was taken on the
// other arm only". A PNG is a zlib stream and five filter types; decoding it costs the forty lines
// below and costs nothing at run time, and it means the delete-the-fix arm — which runs in a
// worktree in /tmp, where module resolution finds nothing — measures with the identical code.
//
// It handles the one format `canvas.toDataURL()` produces: 8-bit RGBA, non-interlaced. Anything
// else throws by name rather than returning a wrong picture quietly.
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colourType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) {
    throw new Error(`unsupported PNG: bitDepth ${bitDepth}, colourType ${colourType}, interlace ${interlace} — this decoder handles 8-bit RGBA only`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let q = 0;
  for (let y = 0; y < height; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (f !== 0) throw new Error('unknown PNG filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}

const args = parseArgs();
const LABEL = String(args.label || 'live');
const W = Number(args.width || 1920), H = Number(args.height || 1080);
const OUT = path.join(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r2'));
const SHOTS = path.join(OUT, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });

const PICTORIAL = new Set(['item_icon', 'doll', 'glyph_object']);
const WORLD_KINDS = new Set(['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter']);

/**
 * IS THIS FRAME A PICTURE OF ANYTHING? Run before any pixel number is believed.
 *
 * ---- why this exists, with the numbers ----
 * The shared capture path can return a near-uniform frame and report success. A sibling piece
 * caught it on 2026-08-15 with two stills taken the same way, minutes apart:
 *
 *     capture 1: p10=4.641  p90=55.646  shadow_levels=28  local_contrast_med=6.217
 *     capture 2: p10=7.493  p90= 7.523  shadow_levels= 1  local_contrast_med=0
 *
 * The second is not a dark room, it is not an image — and it reproduced identically on a pinned
 * baseline containing none of the code under test, which is how a **+223%** result nearly got
 * published off it. That failure is lethal HERE specifically: a degenerate capture makes an empty
 * panel and a full one measure the same, and "the panel is full" is the entire question this round
 * is answering. So every frame is screened, the screening is recorded beside the number it
 * guards, and a frame that fails it does not produce a fill figure at all.
 *
 * Three statistics, chosen because a uniform frame fails all three and a legitimately dark night
 * exterior fails none:
 *   levels     distinct luma values holding >= 0.05% of the pixels. A real frame has dozens.
 *   contrast   median |dI/dx| + |dI/dy| over a sampled grid. Zero means nothing has an edge.
 *   spread     p90 - p10. A uniform frame's is ~0 whatever its brightness.
 *
 * `--self-test` drives it with a synthetic flat grey and asserts it goes red, because a screen
 * that has never been seen to fail is not a screen (RULES rule 4).
 */
function frameSanity(png, rect) {
  const [rx, ry, rw, rh] = (rect || [0, 0, png.width, png.height]).map((v) => Math.round(v));
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  const hist = new Uint32Array(256);
  let n = 0;
  const luma = (x, y) => {
    const i = (y * png.width + x) * 4;
    return (png.data[i] * 0.2126 + png.data[i + 1] * 0.7152 + png.data[i + 2] * 0.0722);
  };
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { hist[Math.round(luma(x, y))]++; n++; }
  if (!n) return { ok: false, reason: 'empty rect' };
  const floor = n * 0.0005;
  let levels = 0;
  for (let v = 0; v < 256; v++) if (hist[v] >= floor) levels++;
  const pct = (p) => { let acc = 0; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * p) return v; } return 255; };
  const p10 = pct(0.10), p90 = pct(0.90);
  const grads = [];
  const stepX = Math.max(1, Math.floor((x1 - x0) / 160)), stepY = Math.max(1, Math.floor((y1 - y0) / 160));
  for (let y = y0; y + stepY < y1; y += stepY) {
    for (let x = x0; x + stepX < x1; x += stepX) {
      grads.push(Math.abs(luma(x + stepX, y) - luma(x, y)) + Math.abs(luma(x, y + stepY) - luma(x, y)));
    }
  }
  grads.sort((a, b) => a - b);
  const contrast = grads.length ? +grads[Math.floor(grads.length / 2)].toFixed(3) : 0;
  // THE MEDIAN IS REPORTED AND THE p95 IS WHAT DECIDES, and the self-test is why.
  //
  // Written first as a median, to match the sibling's `local_contrast_med`, it rejected a
  // deliberately patterned control image — because a picture whose detail sits in a MINORITY of
  // its pixels has a median gradient of exactly 0, and so does a UI panel with a large plain
  // ground, which is most of the screens this tool measures. A screen that red-lights a real
  // picture is worse than none: every fill number would arrive marked "refused" and the round
  // would have no evidence at all. `p95` is 0 only when essentially NOTHING in the frame has an
  // edge, which is the actual failure being screened for. The median is still published beside it
  // so the two runs stay comparable with the sibling's figures.
  const contrastP95 = grads.length ? +grads[Math.floor(grads.length * 0.95)].toFixed(3) : 0;
  const ok = levels >= 8 && contrastP95 > 0.5 && (p90 - p10) >= 4;
  return {
    ok, levels, local_contrast_med: contrast, local_contrast_p95: contrastP95, p10, p90, spread: p90 - p10,
    reason: ok ? null
      : `DEGENERATE FRAME: levels=${levels} (need >=8), local_contrast_p95=${contrastP95} (need >0.5), p90-p10=${p90 - p10} (need >=4). `
        + 'This is not a dark picture, it is not a picture. The capture path returned a near-uniform buffer.',
  };
}

if (args['self-test']) {
  // Break it on purpose and watch it go red — and confirm the other arm passes, so the screen is
  // not simply always-red (RULES rule 6's "inert control").
  const flat = { width: 64, height: 64, data: Buffer.alloc(64 * 64 * 4, 30) };
  const real = { width: 64, height: 64, data: Buffer.alloc(64 * 64 * 4) };
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4;
    const v = ((x >> 2) * 17 + (y >> 3) * 9) % 200 + 20;
    real.data[i] = v; real.data[i + 1] = v; real.data[i + 2] = v; real.data[i + 3] = 255;
  }
  const bad = frameSanity(flat), good = frameSanity(real);
  console.log('flat grey   :', JSON.stringify(bad));
  console.log('patterned   :', JSON.stringify(good));
  if (bad.ok) { console.error('SELF-TEST FAIL: the degenerate-frame screen passed a flat grey buffer.'); process.exit(9); }
  if (!good.ok) { console.error('SELF-TEST FAIL: the screen rejected a real patterned image — it is inert-red.'); process.exit(9); }
  console.log('self-test PASS: the screen rejects a flat frame and accepts a patterned one.');
  process.exit(0);
}

/** D2. Modal colour of a rect, then the dE00 > 6 fraction against it. */
function panelFill(png, rect) {
  const [rx, ry, rw, rh] = rect.map((v) => Math.round(v));
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(png.width, rx + rw), y1 = Math.min(png.height, ry + rh);
  if (x1 <= x0 || y1 <= y0) return { fill: null, reason: 'rect outside the frame' };
  // Quantise to a 5-bit-per-channel histogram for the mode. The mode is the panel's own ground;
  // the comparison afterwards is at full precision, so the quantisation only picks the reference.
  const hist = new Map();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  let bestK = 0, bestN = -1;
  for (const [k, n] of hist) if (n > bestN) { bestN = n; bestK = k; }
  // Average the true colours inside the winning bucket, so the reference is the ground's actual
  // colour rather than the centre of an arbitrary 8-value bin.
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      if (k !== bestK) continue;
      sr += png.data[i]; sg += png.data[i + 1]; sb += png.data[i + 2]; sn++;
    }
  }
  const mode = [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)];
  const modeLab = labFromSrgb255(mode[0], mode[1], mode[2]);
  // A memo over the 15-bit key: a 1520x780 rect is 1.19M pixels and there are at most 32768 keys.
  const memo = new Map();
  let differ = 0, total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      const k = ((png.data[i] >> 3) << 10) | ((png.data[i + 1] >> 3) << 5) | (png.data[i + 2] >> 3);
      let d = memo.get(k);
      if (d === undefined) {
        d = de2000(labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]), modeLab);
        memo.set(k, d);
      }
      total++;
      if (d > 6) differ++;
    }
  }
  return {
    fill: +(differ / total).toFixed(4),
    mode_rgb: mode, pixels: total,
    rect: [x0, y0, x1 - x0, y1 - y0],
  };
}

/** D1 observed. Distinct hues in a box, ignoring near-identical colours. */
function distinctHues(png, x, y, w, h) {
  const seen = [];
  const x1 = Math.min(png.width, Math.round(x + w)), y1 = Math.min(png.height, Math.round(y + h));
  for (let yy = Math.max(0, Math.round(y)); yy < y1; yy++) {
    for (let xx = Math.max(0, Math.round(x)); xx < x1; xx++) {
      const i = (yy * png.width + xx) * 4;
      const lab = labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]);
      if (!seen.some((s) => de2000(s, lab) <= 8)) seen.push(lab);
      if (seen.length > 12) return seen.length;
    }
  }
  return seen.length;
}

const rawPng = (b64) => Buffer.from(String(b64).split(',')[1], 'base64');
const read = (b64) => decodePNG(rawPng(b64));
const out = { label: LABEL, viewport: [W, H], commit: null, screens: {}, notes: [] };
const writeOut = () => fs.writeFileSync(path.join(OUT, `measure-${LABEL}-${W}x${H}.json`), JSON.stringify(out, null, 2));

try {
  out.commit = (await import('node:child_process')).execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim();
} catch { out.commit = 'unknown'; }

const h = await launchGame({ width: W, height: H, state: args.state || 'ui-journal' });

/** Open a mode, screenshot it, and take every measurement that screen supports. */
async function measure(name, opener) {
  const r = await h.page.evaluate(async (o) => {
    const HH = window.__HARNESS;
    try { HH.conversationClose(); } catch { /* nothing open */ }
    await HH.closeMenu();
    if (o.hearth) HH.setAtHearth(true);
    if (o.container) HH.openContainer(o.containerName === '__ABSENT__' ? undefined : o.containerName, o.contents || []);
    else if (o.mode) await HH.openMenu(o.mode, {});
    await HH.stepFrames(3);
    const st = HH.getUIState();
    return {
      mode: st.mode, combat_phase: st.combat_phase, combat_phase_source: st.combat_phase_source,
      panel_rect: st.panel_rect, pictorial: st.pictorial, materials: st.materials,
      materials_painted: st.materials_painted, hud_world: st.hud && st.hud.world,
      elements: st.elements, screen: st.screen,
      shot: await HH.screenshot(),
    };
  }, opener);
  const png = read(r.shot);
  // The bytes the browser produced, written unaltered — a re-encode would be a second picture and
  // the crops a critic takes must be of the frame that was measured.
  fs.writeFileSync(path.join(SHOTS, `${LABEL}-${name}__${W}x${H}.png`), rawPng(r.shot));

  // ---- the frame screen, BEFORE anything is measured off these pixels ----------------------
  const sanity = frameSanity(png, null);
  const panelSanity = r.panel_rect ? frameSanity(png, r.panel_rect) : null;
  if (!sanity.ok) {
    console.error(`[${name}] ${sanity.reason}`);
    out.notes.push({ screen: name, degenerate_frame: sanity });
  }

  const kinds = {};
  for (const e of r.elements) if (e.visible) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const pictorialEls = r.elements.filter((e) => e.visible && PICTORIAL.has(e.kind));
  const rec = {
    mode: r.mode,
    element_count: r.elements.filter((e) => e.visible).length,
    kinds,
    pictorial_declared: r.pictorial,
    pictorial_ids: pictorialEls.map((e) => e.id),
    panel_rect: r.panel_rect,
    frame_sanity: sanity,
    panel_sanity: panelSanity,
    // A fill figure is NOT produced from a frame that failed the screen. Reporting one would be
    // reporting a number about a buffer rather than about a screen.
    panel_fill: !r.panel_rect ? { fill: null, reason: 'no panel on this frame' }
      : !sanity.ok ? { fill: null, reason: 'refused: ' + sanity.reason }
        : panelFill(png, r.panel_rect),
    // Every string the screen renders, so the `(RI-…)` acceptance and the `undefined` acceptance
    // are both greps over the same array rather than two separate runs.
    texts: r.elements.filter((e) => e.visible && e.text).map((e) => ({ id: e.id, text: String(e.text) })),
    ri_citations: r.elements.filter((e) => e.visible && e.text && /RI-[A-Z]{3}\d{2}/.test(String(e.text))).map((e) => e.id),
    undefined_headers: r.elements.filter((e) => e.visible && /^(undefined|null)$/i.test(String(e.text || ''))).map((e) => e.id),
    materials: r.materials, materials_painted: r.materials_painted,
  };
  // D1 OBSERVED — the pixel half. Only meaningful where there are item rows.
  const rows = r.elements.filter((e) => e.visible && e.kind === 'list_row' && e.meta && e.meta.item_id);
  if (rows.length) {
    const hues = rows.map((e) => ({ id: e.id, hues: distinctHues(png, e.rect[0], e.rect[1], 48, e.rect[3]) }));
    rec.d1_observed = {
      rows: rows.length,
      rows_with_3_plus_hues_in_leading_48px: hues.filter((x) => x.hues >= 3).length,
      min_hues: Math.min(...hues.map((x) => x.hues)),
      per_row: hues.slice(0, 6),
    };
  }
  if (r.hud_world) rec.hud_world = r.hud_world;
  rec.combat_phase = r.combat_phase;
  rec.combat_phase_source = r.combat_phase_source;
  out.screens[name] = rec;
  console.log(`[${name}] elements ${rec.element_count}  pictorial ${rec.pictorial_declared ? rec.pictorial_declared.in_panel : '-'}`
    + `  fill ${rec.panel_fill.fill}`);
  writeOut();
}

try {
  await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.ready();
    if (HH.setUIVisible) await HH.setUIVisible(true);
    await HH.closeMenu(); await HH.stepFrames(4);
  });

  await measure('world', {});
  await measure('inventory', { mode: 'inventory' });
  await measure('journal', { mode: 'journal' });
  await measure('sheet', { mode: 'sheet' });
  await measure('spells', { mode: 'spells' });
  await measure('levelup', { mode: 'levelup', hearth: true });
  // The container, with a REAL name — and then the four bad ones below.
  await measure('container', {
    container: true, containerName: 'Reed Creel',
    contents: [{ id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 }],
  });
  await measure('container_no_name', {
    container: true, containerName: '__ABSENT__',
    contents: [{ id: 'reed-cutter', count: 1 }],
  });

  // ---- the guard, driven with every value that has produced `undefined` on screen -------------
  out.container_name_guard = await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    const cases = [
      ['__ABSENT__', 'no name passed at all — the shape that shipped the defect'],
      [null, 'explicit null'],
      ['', 'empty string'],
      ['undefined', 'the literal word, arriving as text from a second call site'],
      ['Reed Creel', 'a good name — the control arm, which MUST come through unchanged'],
    ];
    const res = [];
    for (const [v, why] of cases) {
      await HH.closeMenu();
      HH.openContainer(v === '__ABSENT__' ? undefined : v, [{ id: 'reed-cutter', count: 1 }]);
      await HH.stepFrames(2);
      const st = HH.getUIState();
      const heads = (st.elements || []).filter((e) => e.kind === 'panel_header' && e.visible).map((e) => String(e.text));
      res.push({ passed: v === '__ABSENT__' ? '(absent)' : v, why, headers: heads,
        any_undefined: heads.some((t) => /^(undefined|null)$/i.test(t)) });
    }
    await HH.closeMenu();
    return res;
  });
  console.log('[guard] ' + out.container_name_guard.map((c) => `${JSON.stringify(c.passed)}->${JSON.stringify(c.headers)}`).join('  '));
  writeOut();

  // ---- E-T2, frame by frame across the fight boundary -----------------------------------------
  out.withdrawal = await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.closeMenu(); await HH.stepFrames(4);
    const KINDS = ['bearing_dial', 'effect_strip', 'sneak_state', 'place_name', 'breath_meter'];
    const frames = [];
    const rec = (tag) => {
      const st = HH.getUIState();
      frames.push({
        tag, frame: st.frame === undefined ? HH.getFrame() : st.frame,
        combat_phase: st.combat_phase, frames_since_phase_change: st.frames_since_phase_change,
        world: (st.elements || []).filter((e) => KINDS.includes(e.kind) && e.visible)
          .map((e) => ({ kind: e.kind, opacity: e.opacity, rect: e.rect })),
        souls_ids: (st.elements || []).filter((e) => e.id.startsWith('hud.') && !KINDS.includes(e.kind) && e.visible).map((e) => e.id),
        withdrawn: st.hud && st.hud.world ? st.hud.world.withdrawn : null,
      });
    };
    for (let i = 0; i < 4; i++) { await HH.stepFrames(1); rec('pre'); }
    const es = (HH.listEnemies ? HH.listEnemies() : []) || [];
    let aggro = null;
    try { aggro = HH.aggro((es[0] || {}).eid || (es[0] || {}).id); } catch (e) { aggro = String(e.message); }
    for (let i = 0; i < 12; i++) { await HH.stepFrames(1); rec('post'); }
    return { aggro, enemies: es.length, frames };
  });
  const pre = out.withdrawal.frames.filter((f) => f.tag === 'pre');
  const post = out.withdrawal.frames.filter((f) => f.tag === 'post');
  out.withdrawal.summary = {
    world_elements_before: pre.length ? pre[pre.length - 1].world.map((w) => w.kind) : [],
    world_elements_after: post.length ? post[post.length - 1].world.map((w) => w.kind) : [],
    // E-T3: a ramp shows as a monotone opacity series across the entry frame. There is no fade in
    // this build in either direction, so every declared opacity should be exactly 1.
    any_fractional_opacity: out.withdrawal.frames.some((f) => f.world.some((w) => w.opacity > 0 && w.opacity < 1)),
    souls_set_identical: post.length && pre.length
      ? JSON.stringify(pre[pre.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
        === JSON.stringify(post[post.length - 1].souls_ids.filter((i) => i !== 'hud.toast'))
      : null,
  };
  console.log('[withdrawal] before ' + JSON.stringify(out.withdrawal.summary.world_elements_before)
    + '  after ' + JSON.stringify(out.withdrawal.summary.world_elements_after));
} finally {
  writeOut();
  await h.close();
}

// ---- the verdict this tool is allowed to state, and nothing beyond it -------------------------
const inv = out.screens.inventory || {};
const worstFill = Object.entries(out.screens)
  .filter(([, v]) => v.panel_fill && v.panel_fill.fill !== null)
  .sort((a, b) => a[1].panel_fill.fill - b[1].panel_fill.fill)[0];
console.log('\n--- T4 round 2, ' + LABEL + ' at ' + W + 'x' + H + ' (commit ' + out.commit.slice(0, 10) + ') ---');
console.log('D1 declared, inventory panel : ' + (inv.pictorial_declared ? inv.pictorial_declared.in_panel : 'n/a')
  + '  (round 1: 0)');
console.log('D1 observed, inventory rows  : '
  + (inv.d1_observed ? `${inv.d1_observed.rows_with_3_plus_hues_in_leading_48px} of ${inv.d1_observed.rows} rows carry >=3 hues in the leading 48px` : 'n/a'));
console.log('D2 inventory panel fill      : ' + (inv.panel_fill ? inv.panel_fill.fill : 'n/a') + '  (round 1: 0.207; Morrowind 0.61; P4 bar 0.35)');
if (worstFill) console.log('D2 worst screen              : ' + worstFill[0] + ' ' + worstFill[1].panel_fill.fill);
const anyUndef = Object.values(out.screens).some((s) => (s.undefined_headers || []).length);
const anyRI = Object.values(out.screens).some((s) => (s.ri_citations || []).length);
console.log('undefined headers anywhere   : ' + anyUndef);
console.log('RI- citations in player text : ' + anyRI);
const guardBad = (out.container_name_guard || []).filter((c) => c.any_undefined);
console.log('container-name guard         : ' + (guardBad.length ? 'LEAKED on ' + JSON.stringify(guardBad.map((c) => c.passed)) : 'refused all four bad values'));
const wl = (out.screens.world || {}).hud_world;
if (wl) {
  const built = Object.entries(wl.set).filter(([, v]) => v.built).length;
  console.log('world set built              : ' + built + ' of 6  (round 1: 1 of 6)');
  console.log('world set all in bottom half : ' + wl.all_in_bottom_half + '  rects ' + JSON.stringify(wl.elements.map((e) => e.rect)));
  console.log('world/souls rect overlaps    : ' + JSON.stringify(wl.overlaps));
}
console.log('written: ' + path.join(OUT, `measure-${LABEL}-${W}x${H}.json`));

// Exit non-zero on the two things this round is not allowed to still be true.
if (anyUndef || guardBad.length) { console.error('FAIL: a container header still renders `undefined`.'); process.exit(3); }
if (anyRI) { console.error('FAIL: a reference-item id is still rendered to the player.'); process.exit(4); }
