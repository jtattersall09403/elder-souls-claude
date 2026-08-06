#!/usr/bin/env node
// critic-w1-07a.mjs — W1-07 CRITIC probe A: the Writ House scene, screenshotted node by node.
// Judges RI-JRN01 M5/M6/M7/M8 and RI-CHR01 §1 from OUTPUT, not from source.
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07/probeA');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const h = await launchGame({ width: 1920, height: 1080 });
const rec = { url: h.url, harness_version: h.harnessVersion, build: h.buildInfo, nodes: [], notes: [] };

async function shot(name) {
  const p = path.join(OUT, 'shots', name + '.png');
  await h.page.screenshot({ path: p });
  return path.relative(process.cwd(), p);
}

// What fraction of the frame is opaque non-world UI? Measure the DOM, then measure pixels.
async function uiMetrics() {
  return h.page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight, area = vw * vh;
    const out = { viewport: [vw, vh], canvases: [], opaque_overlays: [], full_viewport_opaque: 0, dom_text: '' };
    for (const c of document.querySelectorAll('canvas')) {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      out.canvases.push({ w: r.width, h: r.height, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, z: cs.zIndex });
    }
    // every element that covers >= 20% of the viewport with a non-transparent background
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      const a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (a / area < 0.2) continue;
      const bg = cs.backgroundColor || '';
      const m = bg.match(/rgba?\(([^)]+)\)/);
      const alpha = m ? (m[1].split(',')[3] !== undefined ? Number(m[1].split(',')[3]) : 1) : 0;
      if (alpha >= 0.85 && el.tagName !== 'CANVAS') {
        out.opaque_overlays.push({ tag: el.tagName, cls: el.className && String(el.className).slice(0, 60), frac: +(a / area).toFixed(3), bg, z: cs.zIndex });
        if (a / area >= 0.9) out.full_viewport_opaque++;
      }
    }
    out.dom_text = (document.body.innerText || '').slice(0, 4000);
    return out;
  });
}

// Pixel-level: how much of the frame is a single flat colour (a black background)?
async function pixelFlatness(pngPath) {
  const buf = fs.readFileSync(pngPath);
  return { bytes: buf.length };
}

try {
  rec.pre_census = { character: await h.h('getCharacter'), entities: (await h.hOpt('listEntities') || []).length };
  await shot('00-boot');
  rec.boot_ui = await uiMetrics();

  // Drive the scene exactly as the shipped scenario does, but screenshot at every node.
  const first = await h.h('censusBegin', { race: 'dunmer' });
  rec.nodes.push({ step: 'censusBegin', ret: first });
  rec.censusState_0 = await h.h('getCensusState');
  await h.h('stepFrames', 5);
  rec.shots_0 = await shot('01-censusBegin');
  rec.ui_0 = await uiMetrics();

  const answers = [
    ['censusAnswer', 'Silence-Under-Salt'],
    ['censusEnter', null],
    ['censusAnswer', 'correct'],
    ['censusAnswer', 'unrecorded'],
    ['censusAnswer', 'interior'],
    ['censusAnswer', 'Neras Athrenil'],
    ['censusAnswer', 'questionnaire'],
    ['censusAnswer', 'a'], ['censusAnswer', 'c'], ['censusAnswer', 'a'], ['censusAnswer', 'b'],
    ['censusAnswer', 'd'], ['censusAnswer', 'a'], ['censusAnswer', 'c'], ['censusAnswer', 'b'],
    ['censusAnswer', 'a'], ['censusAnswer', 'c'],
    ['censusAnswer', 'nu-ixtu'],
  ];
  let i = 1;
  for (const [verb, val] of answers) {
    const st = await h.h('getCensusState');
    const ret = val === null ? await h.h(verb) : await h.h(verb, val);
    await h.h('stepFrames', 3);
    const ui = await uiMetrics();
    const png = await shot(String(i).padStart(2, '0') + '-' + verb + (val ? '-' + String(val).replace(/[^a-z0-9]/gi, '_').slice(0, 20) : ''));
    rec.nodes.push({ i, verb, value: val, state_before: st, ret, ui: { canvases: ui.canvases.length, opaque_overlays: ui.opaque_overlays, full_viewport_opaque: ui.full_viewport_opaque }, shot: png });
    i++;
  }

  rec.censusState_end = await h.hOpt('getCensusState');
  rec.writ = await h.hOpt('readWrit');
  rec.character = await h.h('getCharacter');
  rec.entities_after = await h.hOpt('listEntities');
  await h.h('stepFrames', 30);
  rec.shot_end = await shot('99-after');
  rec.ui_end = await uiMetrics();
} catch (e) {
  rec.error = String(e && e.stack || e);
} finally {
  rec.console = h.console.slice(-40);
  rec.page_errors = h.errors.slice(0, 10);
  await h.close();
}
fs.writeFileSync(path.join(OUT, 'probeA.json'), JSON.stringify(rec, null, 2));
console.log('wrote', path.join(OUT, 'probeA.json'));
console.log('nodes:', rec.nodes.length, 'error:', rec.error ? rec.error.slice(0, 400) : 'none');
