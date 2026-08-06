#!/usr/bin/env node
// critic-w1-07-r2a.mjs — CRITIC instrument, W1-07 round 2, pass A.
//
// Independent of the builder's tools/harness/w1-07-scene.mjs. What it does differently:
//   * captures BOTH page.screenshot() (what a human/Playwright sees, DOM included) and
//     __HARNESS.screenshot() (canvas.toDataURL) at every node, and diffs them — the builder
//     claims the UI is composited into the WebGL canvas, so the two must agree;
//   * audits the DOM for any element that could be a UI overlay;
//   * measures opaque UI area FROM PIXELS, not from the layout metrics the build self-reports;
//   * measures ink coverage inside the panel (is there legible text, or an empty rectangle).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';

const OUT = path.resolve(process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-07-r2/probeA');
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'canvas'), { recursive: true });

const rec = { generated_by: 'tools/harness/critic-w1-07-r2a.mjs', nodes: [], dom: null, notes: [] };

const h = await launchGame({ width: 1920, height: 1080 });
try {
  // ---- DOM audit: is there any non-canvas visual surface at all? -------------------------
  rec.dom = await h.page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    return {
      body_inner_text: document.body.innerText,
      body_child_tags: Array.from(document.body.children).map((e) => e.tagName),
      element_count: all.length,
      non_canvas: all.filter((e) => e.tagName !== 'CANVAS').map((e) => ({
        tag: e.tagName, id: e.id, cls: e.className,
        rect: (() => { const r = e.getBoundingClientRect(); return [r.width | 0, r.height | 0]; })(),
        text: (e.textContent || '').slice(0, 60),
      })),
      canvases: Array.from(document.querySelectorAll('canvas')).map((c) => ({
        w: c.width, h: c.height, inDom: true,
        rect: (() => { const r = c.getBoundingClientRect(); return [r.width | 0, r.height | 0]; })(),
      })),
    };
  });

  const decode = (buf) => PNG.sync.read(buf);
  const shot = async (name) => {
    const pPage = path.join(OUT, 'shots', `${name}.png`);
    await h.page.screenshot({ path: pPage });
    const dataUrl = await h.page.evaluate(async () => window.__HARNESS.screenshot());
    const b64 = String(dataUrl).split(',')[1];
    const pCanvas = path.join(OUT, 'canvas', `${name}.png`);
    fs.writeFileSync(pCanvas, Buffer.from(b64, 'base64'));
    const pageBuf = fs.readFileSync(pPage), canBuf = fs.readFileSync(pCanvas);
    return {
      page_sha: crypto.createHash('sha256').update(pageBuf).digest('hex'),
      canvas_sha: crypto.createHash('sha256').update(canBuf).digest('hex'),
      page_png: pPage, canvas_png: pCanvas,
      pixels: analyse(decode(pageBuf), decode(canBuf)),
    };
  };

  // Pixel analysis: how much of the frame is dark parchment panel, how much of that panel is
  // ink, and do the two capture paths show the same picture.
  function analyse(pagePng, canPng) {
    const W = pagePng.width, H = pagePng.height;
    let diffPx = 0, maxDiff = 0;
    const same = (canPng.width === W && canPng.height === H);
    if (same) {
      for (let i = 0; i < W * H; i++) {
        const o = i * 4;
        const d = Math.abs(pagePng.data[o] - canPng.data[o]) + Math.abs(pagePng.data[o + 1] - canPng.data[o + 1]) + Math.abs(pagePng.data[o + 2] - canPng.data[o + 2]);
        if (d > 12) diffPx++;
        if (d > maxDiff) maxDiff = d;
      }
    }
    // Panel detection on the page capture: the vellum is rgba(18,15,12,0.86) over the world,
    // so panel pixels are very dark and low-saturation. Find the largest bottom-anchored
    // dark region by row/col profile.
    const dark = new Uint8Array(W * H);
    let darkCount = 0;
    for (let i = 0; i < W * H; i++) {
      const o = i * 4;
      const r = pagePng.data[o], g = pagePng.data[o + 1], b = pagePng.data[o + 2];
      const mx = Math.max(r, g, b);
      if (mx <= 70) { dark[i] = 1; darkCount++; }
    }
    // Bounding box of the dark region in the bottom 60% of the frame.
    let x0 = W, x1 = -1, y0 = H, y1 = -1;
    for (let y = Math.floor(H * 0.40); y < H; y++) {
      let run = 0;
      for (let x = 0; x < W; x++) if (dark[y * W + x]) run++;
      if (run > W * 0.5) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (y1 >= 0) {
      for (let x = 0; x < W; x++) {
        let run = 0;
        for (let y = y0; y <= y1; y++) if (dark[y * W + x]) run++;
        if (run > (y1 - y0) * 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      }
    }
    const panelW = x1 >= x0 ? (x1 - x0 + 1) : 0;
    const panelH = y1 >= y0 ? (y1 - y0 + 1) : 0;
    // Ink coverage inside the panel: pixels notably brighter than the vellum.
    let ink = 0, panelPx = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const o = (y * W + x) * 4;
        panelPx++;
        const lum = 0.299 * pagePng.data[o] + 0.587 * pagePng.data[o + 1] + 0.114 * pagePng.data[o + 2];
        if (lum > 110) ink++;
      }
    }
    // World variety: unique colours outside the panel — is the room actually drawn?
    const seen = new Set();
    for (let y = 0; y < H; y += 3) {
      for (let x = 0; x < W; x += 3) {
        if (y >= y0 && y <= y1 && x >= x0 && x <= x1) continue;
        const o = (y * W + x) * 4;
        seen.add(((pagePng.data[o] >> 3) << 10) | ((pagePng.data[o + 1] >> 3) << 5) | (pagePng.data[o + 2] >> 3));
      }
    }
    // Uniformity: the single most common colour's share of the whole frame.
    const hist = new Map();
    for (let i = 0; i < W * H; i += 7) {
      const o = i * 4;
      const k = ((pagePng.data[o] >> 4) << 8) | ((pagePng.data[o + 1] >> 4) << 4) | (pagePng.data[o + 2] >> 4);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    let top = 0; for (const v of hist.values()) if (v > top) top = v;
    return {
      page_vs_canvas_same_size: same,
      page_vs_canvas_diff_px: diffPx,
      page_vs_canvas_diff_frac: same ? +(diffPx / (W * H)).toFixed(6) : null,
      page_vs_canvas_max_channel_diff: maxDiff,
      panel_bbox: [x0, y0, panelW, panelH],
      panel_area_frac_measured: +(panelW * panelH / (W * H)).toFixed(4),
      panel_height_frac_measured: +(panelH / H).toFixed(4),
      ink_frac_in_panel: panelPx ? +(ink / panelPx).toFixed(4) : 0,
      ink_px: ink,
      dark_frac_whole_frame: +(darkCount / (W * H)).toFixed(4),
      world_unique_colours_outside_panel: seen.size,
      most_common_colour_frac: +(top / Math.ceil(W * H / 7)).toFixed(4),
    };
  }

  await h.h('censusBegin', { race: 'dunmer' });
  const answers = [
    ['censusAnswer', 'Silence-Under-Salt'], ['censusEnter', null], ['censusAnswer', 'correct'],
    ['censusAnswer', 'unrecorded'], ['censusAnswer', 'interior'], ['censusAnswer', 'Neras Athrenil'],
    ['censusAnswer', 'questionnaire'],
    ['censusAnswer', 'a'], ['censusAnswer', 'c'], ['censusAnswer', 'a'], ['censusAnswer', 'b'],
    ['censusAnswer', 'd'], ['censusAnswer', 'a'], ['censusAnswer', 'c'], ['censusAnswer', 'b'],
    ['censusAnswer', 'a'], ['censusAnswer', 'c'], ['censusAnswer', 'nu-ixtu'],
  ];
  const push = async (i, s) => {
    const st = await h.h('getCensusState');
    const ents = await h.h('listEntities');
    const npcs = await h.h('listNPCs');
    rec.nodes.push({
      i, node: st.node, place: st.interior, speaker: st.speaker,
      speaker_entity: st.speaker_entity ? st.speaker_entity.eid : null,
      speaker_dist_m: st.speaker_entity ? st.speaker_entity.dist_m : null,
      npcs_in_sim: npcs.length, npc_ids: npcs.map((n) => n.eid),
      entities: Array.isArray(ents) ? ents.length : null,
      self_reported: st.surface,
      shot: s,
    });
  };
  await h.h('stepFrames', 3);
  let s = await shot('00-boot');
  await push(0, s);
  let i = 0;
  for (const [verb, val] of answers) {
    i++;
    if (val === null) await h.h(verb); else await h.h(verb, val);
    await h.h('stepFrames', 3);
    const st = await h.h('getCensusState');
    s = await shot(`${String(i).padStart(2, '0')}-${st.node || 'stamped'}`);
    await push(i, s);
  }
  rec.character = await h.h('getCharacter');
  rec.writ = await h.h('readWrit');
  rec.derived = await h.h('getDerivedStats');
  rec.page_errors = h.errors;
  const pageHashes = new Set(rec.nodes.map((n) => n.shot.page_sha));
  const canHashes = new Set(rec.nodes.map((n) => n.shot.canvas_sha));
  rec.summary = {
    frames: rec.nodes.length,
    distinct_page_hashes: pageHashes.size,
    distinct_canvas_hashes: canHashes.size,
    max_page_vs_canvas_diff_frac: Math.max(...rec.nodes.map((n) => n.shot.pixels.page_vs_canvas_diff_frac ?? 1)),
    panel_area_frac_measured_range: [
      Math.min(...rec.nodes.map((n) => n.shot.pixels.panel_area_frac_measured)),
      Math.max(...rec.nodes.map((n) => n.shot.pixels.panel_area_frac_measured))],
    ink_frac_range: [
      Math.min(...rec.nodes.map((n) => n.shot.pixels.ink_frac_in_panel)),
      Math.max(...rec.nodes.map((n) => n.shot.pixels.ink_frac_in_panel))],
    world_colours_range: [
      Math.min(...rec.nodes.map((n) => n.shot.pixels.world_unique_colours_outside_panel)),
      Math.max(...rec.nodes.map((n) => n.shot.pixels.world_unique_colours_outside_panel))],
    max_most_common_colour_frac: Math.max(...rec.nodes.map((n) => n.shot.pixels.most_common_colour_frac)),
    npcs_min: Math.min(...rec.nodes.map((n) => n.npcs_in_sim)),
    speaker_resolves: rec.nodes.filter((n) => n.speaker && n.speaker_entity === n.speaker).length,
    speaker_nodes: rec.nodes.filter((n) => n.speaker).length,
  };
  console.log(JSON.stringify(rec.summary, null, 2));
} finally {
  fs.writeFileSync(path.join(OUT, 'probeA.json'), JSON.stringify(rec, null, 2));
  await h.close();
}
