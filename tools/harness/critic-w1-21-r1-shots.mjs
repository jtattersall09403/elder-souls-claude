#!/usr/bin/env node
// critic-w1-21-r1-shots.mjs — the W1-21 critic's picture, taken through `tools/capture/`.
//
// THE CONTROL AND THE FINDING, SIDE BY SIDE.
//
//   LEFT   the honest map: the body walked to seven real place centres and the map records that
//          and nothing else. This one is taken through the POOLED CAPTURE SERVICE
//          (`tools/capture/client.mjs`), so it is subject to the settle gate and the build key.
//   RIGHT  the same screen after a forged save is loaded through `loadState()` — the whole
//          province rendered and forty-two place squares, thirty-five of them for places the
//          body has never stood in. This one cannot come from the capture service, because it
//          requires a hand-edited save blob; it is taken by this tool's own browser, and this
//          comment is the declaration that it was (RULES rule 20).
//
// AND THE GATE. A blank map and a working map are both "a PNG arrived", and this project has
// produced blank shots and nearly cited them. So this tool reads `getUIState().map` on the very
// page it photographs and REFUSES to write a frame whose place count contradicts the caption.
//
// USAGE  node tools/harness/critic-w1-21-r1-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { capture } from '../capture/client.mjs';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, parseArgs, log } from '../lib/cli.mjs';

const args = parseArgs();
const W = 900, H = 620;
const decode = (u) => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));

// The same seven places both halves use, read from the world rather than typed here.
const pois = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/world/pois.json'), 'utf8'));
const seven = pois.pois.slice(0, 7);
const ops = [];
for (const p of seven) { ops.push(['teleport', p.pos[0], p.pos[2], {}]); ops.push(['stepFrames', 3]); }

// ---- LEFT: the pooled capture service -------------------------------------------------------
log('capture service: the honest map');
const shot = await capture({
  state: 'default',
  width: W, height: H,
  ui: true,
  menu: { name: 'map' },
  ops,
  evidence_of: 'menu',
  settle_frames: 24,
});
log(`  ${shot.path} cached=${shot.cached} settled=${shot.settle && shot.settle.settled}`);
const honest = PNG.sync.read(fs.readFileSync(shot.path.startsWith('/') ? shot.path : path.join(REPO_ROOT, shot.path)));

// ---- RIGHT: this tool's own browser, because a forged save cannot come from the pool ---------
log('own browser (stepping + a hand-edited save): the forged map');
const h = await launchGame({ ...args, width: W, height: H, timeout: 240000 });
let forged, report;
try {
  await h.h('setRenderRate', 0);
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  await h.h('stepFrames', 4);
  for (const p of seven) { await h.h('teleport', p.pos[0], p.pos[2], {}); await h.h('stepFrames', 3); }
  const honestState = await h.h('mapState');
  report = { stood_in: honestState.places.length };
  await h.page.evaluate(() => {
    const H2 = window.__HARNESS, eng = window.__ENGINE, d = eng.sim.discovery;
    const blob = JSON.parse(JSON.stringify(H2.saveState()));
    const bytes = new Uint8Array(Math.ceil((d.cols * d.rows) / 8)).fill(255);
    let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    blob.world.discovery.cells = btoa(s);
    blob.world.discovery.places = (eng.data.pois.pois || []).map((p) => p.id);
    blob.world.discovery.revealed = d.cols * d.rows;
    H2.loadState(blob);
  });
  await h.h('openMenu', 'map');
  await h.h('stepFrames', 1);
  await h.h('renderFrame');
  const ui = await h.h('getUIState');
  report.forged_places_drawn = ui.map.places_drawn;
  report.forged_drawn_cells = ui.map.drawn_cells;
  report.forged_total_cells = ui.map.total_cells;
  forged = decode(await h.h('screenshot'));
} finally { await h.close(); }

// ---- THE GATE -------------------------------------------------------------------------------
// The caption claims: left shows a handful of places, right shows all of them. Refuse to write a
// picture that does not carry its own subject.
const fail = [];
if (report.forged_places_drawn <= report.stood_in) fail.push(`forged frame draws ${report.forged_places_drawn} squares and the body stood in ${report.stood_in} — the finding is not in the picture`);
if (report.forged_drawn_cells < report.forged_total_cells * 0.9) fail.push(`forged frame painted only ${report.forged_drawn_cells}/${report.forged_total_cells} cells — the province is not revealed in it`);
// The honest frame must NOT be blank and must NOT be the whole province.
const inkFrac = (png) => {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (!(Math.abs(png.data[i] - 0x0b) <= 3 && Math.abs(png.data[i + 1] - 0x0a) <= 3 && Math.abs(png.data[i + 2] - 0x09) <= 3)) n++;
  }
  return n / (png.width * png.height);
};
const hf = inkFrac(honest), ff = inkFrac(forged);
if (hf < 0.05) fail.push(`honest frame is ${(hf * 100).toFixed(1)}% non-ground — it is blank`);
if (fail.length) { log('REFUSED:\n  ' + fail.join('\n  ')); process.exit(1); }

// ---- compose ---------------------------------------------------------------------------------
const GAP = 8, TOP = 0;
const out = new PNG({ width: honest.width + forged.width + GAP, height: Math.max(honest.height, forged.height) + TOP });
out.data.fill(0x12);
const blit = (src, ox) => {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const a = (y * src.width + x) * 4, b = ((y + TOP) * out.width + x + ox) * 4;
      out.data[b] = src.data[a]; out.data[b + 1] = src.data[a + 1]; out.data[b + 2] = src.data[a + 2]; out.data[b + 3] = 255;
    }
  }
};
blit(honest, 0);
blit(forged, honest.width + GAP);
const dest = path.join(REPO_ROOT, 'docs/shots/2026-08-07-w1-21-critic-map-forged-save.png');
fs.writeFileSync(dest, PNG.sync.write(out));
log(`\nwrote ${dest}`);
log(`  left  (pooled capture service, evidence_of=menu): the body stood in ${report.stood_in} places`);
log(`  right (own browser, forged save through loadState): ${report.forged_places_drawn} squares, ${report.forged_drawn_cells}/${report.forged_total_cells} cells painted`);
log(`  non-ground fraction: honest ${(hf * 100).toFixed(1)}%  forged ${(ff * 100).toFixed(1)}%`);
