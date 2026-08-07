#!/usr/bin/env node
// critic-w1-07-r3d.mjs — CRITIC's independent RI-JRN01 M5 (pixel readback), M20/HF9 (title),
// M8 (the writ as a readable object) and the screenshots the verdict is judged on.
//
// WHY THIS EXISTS. `RI-JRN01` M5 as amended wave 1 reads: *"the UI-area fraction is measured
// from a readback of the frame and never taken from the build's own layout report… A number
// the party under measurement computes is a free parameter, and this item had one for two
// rounds."* Round 3 raised `PANEL_MAX_FRAC` 0.42 → 0.48 and `OPTION_WINDOW` 5 → 9 to buy
// delivery, and its counter-check reads `getCensusState().surface.opaque_area_frac` — which is
// `UILayer.metrics()`, the build's own layout report, i.e. **the exact number M5 now forbids.**
// Round 2's record: build self-report 0.136–0.336, critic pixel readback 0.17–0.49 on the same
// frames. So the trade has never been checked with the instrument the item requires.
//
// The pixel method is the round-2 critic's, unchanged, so the two rounds are comparable:
// vellum is rgba(18,15,12,0.86) over the world, so panel pixels are max(r,g,b) <= 70; find the
// bottom-anchored dark region by row/column profile and report its area fraction.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.resolve('corpus/90-verdicts/wave1/artifacts/W1-07-r3');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const say = (s) => process.stdout.write(s + '\n');
const rec = { generated_by: 'tools/harness/critic-w1-07-r3d.mjs', m5: [], m20: null, m8: null, m9: null };

function panelArea(png) {
  const W = png.width, H = png.height;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    if (Math.max(png.data[o], png.data[o + 1], png.data[o + 2]) <= 70) dark[i] = 1;
  }
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let y = Math.floor(H * 0.40); y < H; y++) {
    let run = 0;
    for (let x = 0; x < W; x++) if (dark[y * W + x]) run++;
    if (run > W * 0.5) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (y1 >= 0) for (let x = 0; x < W; x++) {
    let run = 0;
    for (let y = y0; y <= y1; y++) if (dark[y * W + x]) run++;
    if (run > (y1 - y0) * 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  const pw = x1 >= x0 ? x1 - x0 + 1 : 0, ph = y1 >= y0 ? y1 - y0 + 1 : 0;
  // world variety outside the panel — is the room actually behind the text (O8)?
  const seen = new Set();
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
    if (y >= y0 && y <= y1 && x >= x0 && x <= x1) continue;
    const o = (y * W + x) * 4;
    seen.add((png.data[o] >> 3) * 1024 + (png.data[o + 1] >> 3) * 32 + (png.data[o + 2] >> 3));
  }
  let ink = 0, px = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = (y * W + x) * 4; px++;
    if (0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2] > 110) ink++;
  }
  return {
    panel_px: [pw, ph],
    pixel_area_frac: +((pw * ph) / (W * H)).toFixed(4),
    panel_height_frac: +(ph / H).toFixed(4),
    ink_frac_in_panel: px ? +(ink / px).toFixed(4) : 0,
    world_colours_outside_panel: seen.size,
  };
}

const h = await launchGame({ ...args, width: 1920, height: 1080 });
try {
  await h.h('setSeed', 1337);

  // ---- M20 / HF9: is there a title surface, and does a returning player reach a save? -----
  say('== M20 / HF9 — the title surface ==');
  const t0 = await h.h('getTitleState');
  say(`  harness-mode boot: title present=${t0 && t0.present} shown=${t0 && t0.shown}`);
  await h.h('writeSave', 'slot-a');
  const shown = await h.h('titleShow');
  const t1 = await h.h('getTitleState');
  await h.h('renderFrame');
  const b64 = String(await h.page.evaluate(() => window.__HARNESS.screenshot())).split(',')[1];
  fs.writeFileSync(path.join(OUT, 'shots', 'title.png'), Buffer.from(b64, 'base64'));
  const titleText = await h.h('getRenderedText', { surface: 'title' });
  say(`  after titleShow(): shown=${t1 && t1.shown}  rows=${(t1 && t1.rows || []).map((r) => r.id + (r.enabled ? '' : '(disabled)')).join(', ')}`);
  say(`  drawn strings on the title surface: ${JSON.stringify(titleText.distinct)}`);
  let contOk = null;
  try { const a = await h.h('titleActivate', 'continue'); contOk = a; } catch (e) { contOk = { error: String(e).slice(0, 200) }; }
  say(`  titleActivate('continue') -> ${JSON.stringify(contOk).slice(0, 220)}`);
  rec.m20 = { harness_boot: t0, after_show: t1, drawn: titleText.distinct, continue_result: contOk, screenshot: 'shots/title.png' };

  // Now the honest question: a real player. mode=play, fresh page, no ?title flag.
  await h.page.goto(h.url.replace(/\?.*$/, '') + '?mode=play', { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  const tPlay = await h.h('getTitleState');
  await h.h('renderFrame');
  const b64p = String(await h.page.evaluate(() => window.__HARNESS.screenshot())).split(',')[1];
  fs.writeFileSync(path.join(OUT, 'shots', 'title-play-mode.png'), Buffer.from(b64p, 'base64'));
  const playText = await h.h('getRenderedText', {});
  say(`  PLAY MODE, no flags: title shown=${tPlay && tPlay.shown}; drawn strings: ${JSON.stringify(playText.distinct).slice(0, 400)}`);
  rec.m20.play_mode = { state: tPlay, drawn: playText.distinct, screenshot: 'shots/title-play-mode.png' };

  // ---- M9: the instruction grep, through the named accessor -------------------------------
  const BAD = ['Press ', 'Tap ', 'Click ', 'Tutorial', 'Objective', 'Quest added', 'New quest', 'Tip:'];
  const nonDialogue = await h.h('getRenderedText', { notSurface: ['dialogue'] });
  const hits = (nonDialogue.distinct || []).filter((s) => BAD.some((b) => s.includes(b)));
  say(`\n== M9 — instruction grep over ${(nonDialogue.distinct || []).length} distinct non-dialogue strings: ${hits.length} hits ${JSON.stringify(hits)}`);
  rec.m9 = { accessor: '__HARNESS.getRenderedText({notSurface:["dialogue"]})', searched: (nonDialogue.distinct || []).length, hits };

  // ---- M5: the census, node by node, from PIXELS -------------------------------------------
  await h.page.goto(h.url, { waitUntil: 'load' });
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.h('setSeed', 1337);
  await h.h('loadState', 'barge-hold');
  await h.h('censusBegin', { race: 'saxhleel' });
  say('\n== M5 — opaque UI area, from a readback of the frame (never the build\'s layout report) ==');
  say(`  ${'node'.padEnd(26)} ${'selfrep'.padEnd(8)} ${'pixel'.padEnd(8)} panel_h  ink   world_cols`);
  let st = await h.h('getCensusState'); let guard = 0, qi = 0, entered = false;
  while (st && !st.done && guard++ < 40) {
    await h.h('renderFrame');
    const url = String(await h.page.evaluate(() => window.__HARNESS.screenshot()));
    const png = PNG.sync.read(Buffer.from(url.split(',')[1], 'base64'));
    const a = panelArea(png);
    const self = st.surface ? st.surface.opaque_area_frac : 0;
    const name = `${String(guard).padStart(2, '0')}-${st.node}`;
    if (['hold.hatch-name', 'writ.given-name', 'writ.class-questions', 'writ.stamp', 'hold.wake'].includes(st.node) && guard < 14) {
      fs.writeFileSync(path.join(OUT, 'shots', name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    }
    rec.m5.push({ node: st.node, kind: st.input ? st.input.kind : null, self_reported: self, ...a });
    say(`  ${String(st.node).padEnd(26)} ${String(self).padEnd(8)} ${String(a.pixel_area_frac).padEnd(8)} ${a.panel_height_frac}   ${a.ink_frac_in_panel}  ${a.world_colours_outside_panel}`);
    const inp = st.input;
    if (!inp) { if (!entered) { entered = true; st = await h.h('censusEnter'); continue; } break; }
    let v;
    if (inp.kind === 'text') v = 'Silence-Under-Salt';
    else if (inp.kind === 'pick') v = (inp.options || []).slice(0, inp.count || 2).map((o) => o.id);
    else if (inp.kind === 'questionnaire') { v = (inp.options || [])[qi % inp.options.length].id; qi++; }
    else if (st.node === 'writ.class-routes') v = 'questionnaire';
    else v = (inp.options || [])[0] && (inp.options || [])[0].id;
    if (v == null) break;
    st = await h.h('censusAnswer', v);
  }
  const maxSelf = Math.max(...rec.m5.map((r) => r.self_reported));
  const maxPix = Math.max(...rec.m5.map((r) => r.pixel_area_frac));
  say(`\n  MAX self-reported ${maxSelf}   MAX pixel readback ${maxPix}   M5 ceiling 0.55`);
  say(`  ${maxPix > 0.55 ? 'M5 FAIL — the pixel readback exceeds the ceiling' : 'M5 pass on the pixel readback'}`);
  say(`  understatement of the build's own report: ${(maxPix - maxSelf).toFixed(4)} of frame area`);

  // ---- M8: the writ, opened by the input path a player has ---------------------------------
  say('\n== M8 — the carried writ, opened and drawn ==');
  const writ = await h.h('readWrit');
  const opened = await h.h('openWrit');
  await h.h('renderFrame');
  const wr = await h.h('getWritReaderState');
  const wtext = await h.h('getRenderedText', {});
  const wUrl = String(await h.page.evaluate(() => window.__HARNESS.screenshot()));
  fs.writeFileSync(path.join(OUT, 'shots', 'writ-open.png'), Buffer.from(wUrl.split(',')[1], 'base64'));
  const wpng = PNG.sync.read(Buffer.from(wUrl.split(',')[1], 'base64'));
  const wa = panelArea(wpng);
  say(`  readWrit() lines: ${(writ && writ.lines || []).length}; reader window ${wr && wr.window ? wr.window.length : 0} of ${wr && wr.lines ? wr.lines.length : 0}`);
  say(`  rendered rows at the open node: ${(wtext.entries || []).length}, distinct ${wtext.distinct.length}`);
  for (const s of wtext.distinct.slice(0, 14)) say(`     "${s.slice(0, 96)}"`);
  say(`  writ-reader pixel area ${wa.pixel_area_frac} (M5 ceiling 0.55), world colours behind ${wa.world_colours_outside_panel}`);
  rec.m8 = { writ_lines: (writ && writ.lines || []).length, reader: wr, drawn_distinct: wtext.distinct, opened, pixels: wa };
  rec.m5_summary = { max_self_reported: maxSelf, max_pixel: maxPix, ceiling: 0.55, understatement: +(maxPix - maxSelf).toFixed(4) };
} finally {
  fs.writeFileSync(path.join(OUT, 'm5-title-writ-critic.json'), JSON.stringify(rec, null, 2));
  await h.close();
}
