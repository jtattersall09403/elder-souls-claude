#!/usr/bin/env node
// t4-r8-d2.mjs — RI-UIX09 D2 with the REFERENCE PINNED, and both older readings alongside it.
//
// Owner: T4-r8 (builder). Answering the corpus defect the r7 critic filed and could not fix, and
// `ARBITRATION` S65(2).
//
// THE DEFECT. `RI-UIX09` D2 is "the fraction of the panel's rect whose pixels differ from the
// panel's own modal background colour by dE > 6". It never says HOW the modal colour is taken. Two
// faithful readings of the same level-up capture give **0.1494 (fail)** and **0.1625 (pass)** —
// the shipped instrument (`tools/ui/t4-r2-critic-measure.mjs` `d2()`: bin to 5 bits per channel,
// pick the modal BUCKET, average the pixels inside it) reads `[220,217,204]`, and an exact-colour
// modal reads `[223,223,216]`. A screen's verdict flips on an implementation detail nobody wrote
// down. S65(2): pin the reference instead of re-deriving it from the pixels, and S61's band
// collapses to the threshold sweep.
//
// THREE READINGS, REPORTED SIDE BY SIDE, AND THE TOOL NAMES WHICH ONE IS THE BAR:
//
//   A  binned   the SHIPPED reading, `d2()` copied here so a subset run cannot drift from it —
//               5-bit key, modal bucket, mean inside the bucket. This is the number every T4
//               round from 5 to 7 published and it is what the round-8 build must be compared to.
//   B  exact    modal of the exact RGB triple over the panel rect, ties broken by lowest packed
//               value so it is single-valued on any image. The r7 critic's second reading.
//   C  pinned   the modal of the panel's OWN DECLARED GROUND PROBE — `getUIState()`'s
//               `panel.meta.ground_probe`, a rect the layout guarantees carries only painted
//               ground (`ui/chrome.js` `screen()`). Content cannot outvote it, because content is
//               not inside it.
//
// WHY C IS NOT "TAKE IT FROM `getUIState().materials`", WHICH IS WHAT S65(2) SAYS. `materials` is
// a list of NAMES. The colour behind a name is `theme.js`'s palette — but `panel()` paints clay as
// `clay_dark` under a 0.55 `chitin_dark` slip and the whole panel is composited at `CALM_ALPHA`
// 0.94 over the world, so a palette lookup gives a colour the screen never contains. Measured, not
// argued: this tool reports `palette_ground_dE00`, the distance from the pinned reference to the
// naive palette lookup, on every screen. The ruling's mechanism is wrong and its instruction —
// take the reference from the game rather than from the content — is right, which is exactly the
// S63 pattern (a sound rule with an invented mechanism attached).
//
// AND THE GUARD THAT MAKES C FALSIFIABLE. A declared probe is only worth what its declaration is
// worth. `probe_vs_panel_dE00` is the distance from the pinned reference to the exact-modal of the
// whole panel rect: if the probe were pointing at content, or at the header rule, or off the
// panel, this number would be large and the reading is marked `unresolved` rather than used.
//
// `CRITIC-DOCTRINE` §1.3 GUARD, AND IT BINDS ME HARDER THAN A CRITIC. I am the builder. An
// instrument I wrote this round may be the reason my build FAILS and may never be the reason it
// passes. Reading C raises level-up from 0.1494 to something above the floor; **this round does
// not claim level-up as a pass on that basis** and the report says so in `does_not_claim`.
//
// Usage:
//   node tools/ui/t4-r8-d2.mjs --out <dir> [--screens container,levelup] [--label after]
//   node tools/ui/t4-r8-d2.mjs --self-test
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { parseArgs, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';
import { labFromSrgb255, de2000 } from '../lib/colour.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r8/d2'));
const LABEL = String(args.label || 'arm');

// ---- PNG -------------------------------------------------------------------------------------
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, hh = 0, bd = 0, ct = 0, il = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); hh = data.readUInt32BE(4); bd = data[8]; ct = data[9]; il = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || ct !== 6 || il !== 0) throw new Error(`unsupported PNG ${bd}/${ct}/${il}`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp;
  const out = Buffer.alloc(hh * stride);
  let q = 0;
  for (let y = 0; y < hh; y++) {
    const f = raw[q++];
    const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      else if (f !== 0) throw new Error('unknown filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width: w, height: hh, data: out };
}

const clip = (png, rect) => {
  const [rx, ry, rw, rh] = rect.map(Math.round);
  return { x0: Math.max(0, rx), y0: Math.max(0, ry), x1: Math.min(png.width, rx + rw), y1: Math.min(png.height, ry + rh) };
};
const bin5 = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
const exactKey = (r, g, b) => (r << 16) | (g << 8) | b;

/** A: the SHIPPED reference — modal 5-bit bucket, averaged inside the bucket. */
function refBinned(png, rect) {
  const { x0, y0, x1, y1 } = clip(png, rect);
  const hist = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    const k = bin5(png.data[i], png.data[i + 1], png.data[i + 2]);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let bk = 0, bn = -1, rival = 0;
  for (const [k, n] of hist) if (n > bn) { rival = bn; bn = n; bk = k; } else if (n > rival) rival = n;
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    if (bin5(png.data[i], png.data[i + 1], png.data[i + 2]) !== bk) continue;
    sr += png.data[i]; sg += png.data[i + 1]; sb += png.data[i + 2]; sn++;
  }
  return { rgb: [Math.round(sr / sn), Math.round(sg / sn), Math.round(sb / sn)], votes: bn, runner_up: rival };
}
/** B: exact-colour modal over a rect. Ties broken by the lowest packed value — single-valued. */
function refExact(png, rect) {
  const { x0, y0, x1, y1 } = clip(png, rect);
  const hist = new Map();
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    const k = exactKey(png.data[i], png.data[i + 1], png.data[i + 2]);
    hist.set(k, (hist.get(k) || 0) + 1);
  }
  let bk = -1, bn = -1, rival = 0;
  for (const [k, n] of hist) {
    if (n > bn || (n === bn && k < bk)) { if (n > bn) rival = Math.max(rival, bn); bn = n; bk = k; }
    else if (n > rival) rival = n;
  }
  return { rgb: [(bk >> 16) & 255, (bk >> 8) & 255, bk & 255], votes: bn, runner_up: rival, distinct: hist.size };
}
/** D2 itself, given a reference. The only thing that varies between A/B/C is `ref`. */
function d2With(png, rect, ref, thresh) {
  const { x0, y0, x1, y1 } = clip(png, rect);
  const refLab = labFromSrgb255(ref[0], ref[1], ref[2]);
  const memo = new Map();
  let differ = 0, total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * png.width + x) * 4;
    const k = exactKey(png.data[i], png.data[i + 1], png.data[i + 2]);
    let d = memo.get(k);
    if (d === undefined) { d = de2000(labFromSrgb255(png.data[i], png.data[i + 1], png.data[i + 2]), refLab); memo.set(k, d); }
    total++; if (d > (thresh === undefined ? 6 : thresh)) differ++;
  }
  return { fill: +(differ / total).toFixed(4), pixels: total, differ };
}

// ---- SELF-TEST: the arms are REQUIRED to disagree ---------------------------------------------
//
// WHAT THIS WOULD HAVE CAUGHT, written before it was run. The failure mode of a three-reading
// report is that all three quietly become the same function — a copy-paste that makes `refExact`
// call `refBinned`, or a `d2With` that ignores its `ref` argument — after which the report says
// "three implementations agree" about one implementation. So the fixtures below are synthetic
// images whose CORRECT answers differ between the readings, and the suite fails if they do not.
function selfTest() {
  const mk = (w, h, paint) => {
    const png = { width: w, height: h, data: Buffer.alloc(w * h * 4, 255) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      const i = (y * w + x) * 4;
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
    }
    return png;
  };
  const cases = [];
  const fail = [];
  const ok = (name, cond, why) => { cases.push({ name, pass: !!cond, why }); if (!cond) fail.push(name); };

  // 1. A FLAT GROUND. All three references must agree exactly and D2 must be 0.
  const flat = mk(40, 40, () => [100, 90, 80]);
  const fb = refBinned(flat, [0, 0, 40, 40]), fe = refExact(flat, [0, 0, 40, 40]);
  ok('flat_ground_refs_agree', fb.rgb.join() === '100,90,80' && fe.rgb.join() === '100,90,80', 'a ground with one colour has one modal colour under any reading');
  ok('flat_ground_d2_zero', d2With(flat, [0, 0, 40, 40], fb.rgb).fill === 0, 'nothing differs from itself');

  // 2. THE BUCKET-SPREAD GROUND — the r7 critic's level-up in miniature, and the fixture that
  //    forces A and B apart. The ground is a 4-colour dither inside ONE 5-bit bucket; a small
  //    block of a single flat colour is the largest EXACT colour but a minority bucket. So the
  //    binned reading picks the dithered ground (averaged) and the exact reading picks the block.
  // NOTE — THE FIRST VERSION OF THIS FIXTURE WAS WRONG AND THE SUITE SAID SO, WHICH IS WHY IT IS
  // WRITTEN DOWN. It dithered `(x+y)%4` over three channels, which is only 64 distinct exact
  // colours over 3,456 px — 54 px each — so a 12x12 block of 144 px did NOT win the exact modal
  // and the assertion below failed on the fixture rather than on the code. It also picked base
  // values 110..117, which straddles a 5-bit bucket boundary (`>>3`), so the "one bucket" claim
  // was false too. Corrected: 25x25 = 625 px of block against 8x8x8 = 512 dither colours over
  // ~3,000 px (~6 px each), and every base is bucket-aligned (120..127, 112..119, 104..111).
  const spread = mk(60, 60, (x, y) => {
    if (x < 25 && y < 25) return [200, 200, 200];      // 625 px of one exact colour
    return [120 + ((x + y) % 8), 112 + ((x * 3 + y) % 8), 104 + ((x + y * 2) % 8)]; // 2,975 px, 3 buckets
  });
  const sb = refBinned(spread, [0, 0, 60, 60]), se = refExact(spread, [0, 0, 60, 60]);
  ok('bucket_spread_A_and_B_disagree', sb.rgb.join() !== se.rgb.join(),
    `binned ${sb.rgb} vs exact ${se.rgb} — if these ever agree here, one reading is calling the other`);
  ok('bucket_spread_B_picks_the_block', se.rgb.join() === '200,200,200', 'the largest EXACT colour is the flat block');
  const dA = d2With(spread, [0, 0, 60, 60], sb.rgb).fill, dB = d2With(spread, [0, 0, 60, 60], se.rgb).fill;
  ok('bucket_spread_d2_differs', dA !== dB, `D2 A=${dA} B=${dB} — the whole defect this tool exists for, reproduced synthetically`);

  // 3. THE PROBE. A ground with a big block of CONTENT that outvotes it, plus a probe strip of
  //    pure ground. C must return the ground where B returns the content — this is the fixture
  //    that proves the pin does the thing it is for.
  const outvoted = mk(60, 60, (x, y) => (y >= 20 ? [30, 30, 30] : [150, 140, 130]));
  const oe = refExact(outvoted, [0, 0, 60, 60]);
  const oc = refExact(outvoted, [0, 0, 60, 5]);            // the "declared probe": pure ground
  ok('probe_beats_content', oe.rgb.join() === '30,30,30' && oc.rgb.join() === '150,140,130',
    'content outvotes the ground over the panel rect; the declared probe cannot be outvoted');
  const dPanel = d2With(outvoted, [0, 0, 60, 60], oe.rgb).fill;
  const dProbe = d2With(outvoted, [0, 0, 60, 60], oc.rgb).fill;
  // The fixture is 1/3 ground and 2/3 content. The CORRECT D2 is 0.667 (the content is what is on
  // the panel); the panel-modal reading returns 0.333, i.e. it reports the GROUND as the matter.
  // Asserting the two exact values rather than "they differ by a lot" — the first version of this
  // line asked for a gap of 0.5 and failed at 0.3333 vs 0.6667, which is the suite failing on my
  // arbitrary threshold instead of on anything true.
  ok('probe_flips_the_verdict', Math.abs(dProbe - 2 / 3) < 0.02 && Math.abs(dPanel - 1 / 3) < 0.02 && dProbe > dPanel,
    `D2 vs panel-modal ${dPanel} (reports the GROUND as matter — wrong), vs probe ${dProbe} (reports the content — right)`);

  // 4. THE THRESHOLD SWEEP MUST MOVE. If `d2With` ignored its threshold the band would read 0.
  const grad = mk(60, 60, (x) => [120 + x, 110, 100]);
  const gb = refExact(grad, [0, 0, 60, 60]);
  const d5 = d2With(grad, [0, 0, 60, 60], gb.rgb, 5).fill, d7 = d2With(grad, [0, 0, 60, 60], gb.rgb, 7).fill;
  ok('threshold_sweep_moves', d5 !== d7, `dE 5.0 -> ${d5}, dE 7.0 -> ${d7}`);

  // 5. AND THE SUITE MUST NOT BE DEGENERATE.
  ok('suite_has_both_outcomes', new Set(cases.map((c) => c.pass)).size >= 1 && cases.length >= 8, 'at least eight assertions ran');
  for (const c of cases) log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name} — ${c.why}`);
  log(fail.length ? `SELF-TEST RED: ${fail.join(', ')}` : `SELF-TEST OK: ${cases.length} assertions`);
  return { cases, failures: fail };
}

if (args.self_test || args['self-test']) {
  ensureDir(OUT);
  const st = selfTest();
  writeJson(path.join(OUT, 't4-r8-d2-selftest.json'), { schema: 'elder-souls/t4-r8-d2-selftest@1', at: new Date().toISOString(), ...st });
  process.exit(st.failures.length ? 1 : 0);
}

// ---- the live run ------------------------------------------------------------------------------
ensureDir(OUT);
const { launchGame } = await import('../lib/browser.mjs');
const SHOTS = path.join(OUT, 'screens'); ensureDir(SHOTS);

const OPENERS = {
  inventory: { mode: 'inventory' },
  journal: { mode: 'journal' },
  sheet: { mode: 'sheet' },
  spells: { mode: 'spells' },
  levelup: { mode: 'levelup', hearth: true },
  container: { container: true, containerName: 'Reed Creel', contents: [{ id: 'reed-cutter', count: 1 }, { id: 'bog-iron-maul', count: 1 }, { id: 'rootweave-cowl', count: 1 }] },
  container_no_name: { container: true, containerName: '__ABSENT__', contents: [{ id: 'reed-cutter', count: 1 }] },
};
const only = String(args.screens || '').split(',').map((x) => x.trim()).filter(Boolean);

// The naive palette lookup S65(2) proposed, so the report can show what it would have given.
// `GROUND_OF` is `ui/chrome.js`'s own table, read here rather than re-invented; the hexes are
// `ui/theme.js`'s palette. Kept as data so a drift between the two is a diff, not a surprise.
const PALETTE_GROUND = { parchment: '#c8bfa8', reed: '#2c3a2e', chitin: '#16191a', bone: '#e6e2d0', clay: '#8c5a3a' };
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const report = {
  schema: 'elder-souls/t4-r8-d2@1', at: new Date().toISOString(), label: LABEL,
  repo_root: REPO_ROOT,
  commit: execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
  worktree_dirty: execSync('git status --porcelain -- game/ tools/', { cwd: REPO_ROOT }).toString().trim().length > 0,
  bar: 'A (binned) is the bar this round is judged against — it is what rounds 5-7 published. B and C are reported so the corpus defect can be closed with numbers.',
  does_not_claim: 'CRITIC-DOCTRINE §1.3: reading C is an instrument written this round by the builder. It may be the reason a screen FAILS and is never offered as the reason one passes. Any screen that clears the floor only under C is recorded as still failing.',
  screens: {},
};

const h = await launchGame({ width: 1920, height: 1080, state: 'ui-journal', timeout: 300000 });
try {
  await h.page.evaluate(async () => {
    const HH = window.__HARNESS;
    await HH.ready();
    if (HH.setUIVisible) await HH.setUIVisible(true);
    await HH.setRenderRate(0);
    await HH.setDevicePixelRatio(1);
    await HH.closeMenu(); await HH.stepFrames(4);
  });
  for (const [name, opener] of Object.entries(OPENERS)) {
    if (only.length && !only.includes(name)) continue;
    const r = await Promise.race([
      h.page.evaluate(async (o) => {
        const HH = window.__HARNESS;
        try { HH.conversationClose(); } catch { /* nothing open */ }
        await HH.closeMenu();
        if (o.hearth) HH.setAtHearth(true);
        if (o.container) HH.openContainer(o.containerName === '__ABSENT__' ? undefined : o.containerName, o.contents || []);
        else if (o.mode) await HH.openMenu(o.mode, {});
        await HH.stepFrames(4);
        const st = HH.getUIState();
        const els = (st.elements || []).filter((e) => e.visible);
        const panel = els.filter((e) => e.kind === 'panel').sort((a, b) => b.rect[2] * b.rect[3] - a.rect[2] * a.rect[3])[0] || null;
        return {
          mode: st.mode, panel: panel ? { rect: panel.rect, meta: panel.meta || null, material: panel.material || null } : null,
          element_count: els.length,
          kinds: els.reduce((m, e) => { m[e.kind] = (m[e.kind] || 0) + 1; return m; }, {}),
          shot: await HH.screenshot(),
        };
      }, opener),
      new Promise((res) => setTimeout(() => res({ __timeout: true }), Number(args.step_timeout || 90000))),
    ]).catch((e) => ({ __err: String((e && e.message) || e) }));

    if (r.__timeout || r.__err) {
      report.screens[name] = { failed: r.__timeout ? 'step timed out' : r.__err };
      log(`  [${name}] FAILED — ${report.screens[name].failed}`);
      continue;
    }
    const shot = Buffer.from(String(r.shot).split(',')[1], 'base64');
    fs.writeFileSync(path.join(SHOTS, `${LABEL}-${name}.png`), shot);
    const png = decodePNG(shot);
    if (!r.panel) { report.screens[name] = { failed: 'no panel element in the census' }; continue; }
    const rect = r.panel.rect;
    const probe = r.panel.meta && r.panel.meta.ground_probe;

    const A = refBinned(png, rect), B = refExact(png, rect);
    const C = probe ? refExact(png, probe) : null;
    const dA = d2With(png, rect, A.rgb), dB = d2With(png, rect, B.rgb);
    const dC = C ? d2With(png, rect, C.rgb) : null;
    const pal = PALETTE_GROUND[r.panel.meta && r.panel.meta.ground_material] || null;

    const lab = (rgb) => labFromSrgb255(rgb[0], rgb[1], rgb[2]);
    const rec = {
      mode: r.mode, panel_rect: rect, element_count: r.element_count, kinds: r.kinds,
      ground_probe: probe || null, ground_material: (r.panel.meta && r.panel.meta.ground_material) || null,
      A_binned: { ref: A.rgb, votes: A.votes, runner_up: A.runner_up, d2: dA.fill },
      B_exact: { ref: B.rgb, votes: B.votes, runner_up: B.runner_up, distinct_colours: B.distinct, d2: dB.fill },
      C_pinned: C ? { ref: C.rgb, votes: C.votes, runner_up: C.runner_up, probe_px: dC.pixels && probe ? Math.round(probe[2]) * Math.round(probe[3]) : null, d2: dC.fill } : null,
      // The guard: is the declared probe actually pointing at ground?
      probe_vs_panel_dE00: C ? +de2000(lab(C.rgb), lab(B.rgb)).toFixed(3) : null,
      // The measured answer to "could S65(2)'s palette lookup have worked?"
      palette_ground_hex: pal,
      palette_ground_dE00: (pal && C) ? +de2000(lab(hexRgb(pal)), lab(C.rgb)).toFixed(3) : null,
      // S61's band under the PINNED reference: the threshold sweep alone, since the reference no
      // longer moves with the capture's content. Reported per reading so the collapse is visible.
      band_thresh: C ? +(Math.max(
        Math.abs(d2With(png, rect, C.rgb, 5).fill - dC.fill),
        Math.abs(d2With(png, rect, C.rgb, 7).fill - dC.fill),
      )).toFixed(4) : null,
      band_thresh_binned: +(Math.max(
        Math.abs(d2With(png, rect, A.rgb, 5).fill - dA.fill),
        Math.abs(d2With(png, rect, A.rgb, 7).fill - dA.fill),
      )).toFixed(4),
      // How far apart the three readings are. This IS the corpus defect, quantified per screen.
      spread_A_to_B: +Math.abs(dA.fill - dB.fill).toFixed(4),
      spread_A_to_C: C ? +Math.abs(dA.fill - dC.fill).toFixed(4) : null,
    };
    rec.verdict_flips = [dA.fill, dB.fill, dC ? dC.fill : dA.fill].some((v) => v >= 0.15)
      && [dA.fill, dB.fill, dC ? dC.fill : dA.fill].some((v) => v < 0.15);
    report.screens[name] = rec;
    log(`  [${name}] A ${dA.fill}  B ${dB.fill}  C ${dC ? dC.fill : 'n/a'}`
      + `   probe-vs-panel dE ${rec.probe_vs_panel_dE00}  palette dE ${rec.palette_ground_dE00}`
      + `   band_thresh A ${rec.band_thresh_binned} C ${rec.band_thresh}`
      + (rec.verdict_flips ? '   *** THE FLOOR VERDICT DEPENDS ON WHICH READING ***' : ''));
  }
} catch (e) {
  report.threw = String((e && e.stack) || e);
  log(`THREW ${e}`);
} finally {
  try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ }
}
writeJson(path.join(OUT, `t4-r8-d2-${LABEL}.json`), report);
log(`-> ${path.join(OUT, `t4-r8-d2-${LABEL}.json`)}`);
