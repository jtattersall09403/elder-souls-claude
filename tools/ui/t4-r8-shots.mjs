#!/usr/bin/env node
// t4-r8-shots.mjs — LOOK AT THE PICTURE. The gap this round closes was found by cropping the
// container at 2x and reading it, not by any metric, and the round is not finished until the same
// crop is on disk for the next reader.
//
// Owner: T4-r8 (builder). Captures, at 1920x1080 DPR 1:
//   * the container at rest, full panel and a 3x crop of the LIST HEAD — the exact region where
//     `Carried` was printed through `Bog-iron m…`;
//   * the container with the reading view open (one `lock_on`), full panel and a 3x crop of the
//     text column, on the record with the LONGEST description in the fixture;
//   * the same two at 1280x720, because `RI-UIX06` FD4 is measured at both.
// Nothing here scores anything. It exists so a critic can disagree with the numbers by looking.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, log, REPO_ROOT, ensureDir, writeJson } from '../lib/cli.mjs';

const args = parseArgs();
const OUT = path.isAbsolute(String(args.out || '')) ? String(args.out)
  : path.resolve(REPO_ROOT, String(args.out || 'corpus/90-verdicts/wave1/artifacts/T4-r8/shots'));
ensureDir(OUT);
const STATE = String(args.state || 'ui-journal');
const CARRIED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'game/data/items/carried.json'), 'utf8'));
const RECORDS = Array.isArray(CARRIED) ? CARRIED : (CARRIED.items || Object.values(CARRIED)[0]);
const LONGEST = RECORDS.slice().sort((a, b) => String(b.description || '').length - String(a.description || '').length)[0];

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, hh = 0, bd = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); hh = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || ct !== 6) throw new Error('unsupported PNG');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp, out = Buffer.alloc(hh * stride);
  let q = 0;
  for (let y = 0; y < hh; y++) {
    const f = raw[q++]; const line = raw.subarray(q, q + stride); q += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
  }
  return { width: w, height: hh, data: out };
}
const crc = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
})();
function encodePNG(w, h, rgba) {
  const chunk = (type, data) => {
    const b = Buffer.alloc(8 + data.length + 4);
    b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8);
    b.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
    return b;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** Nearest-neighbour zoom — no smoothing, so a glyph edge is the glyph's edge and not a blur. */
function cropZoom(png, [x, y, w, h], z) {
  const cx = Math.max(0, Math.round(x)), cy = Math.max(0, Math.round(y));
  const cw = Math.min(png.width - cx, Math.round(w)), ch = Math.min(png.height - cy, Math.round(h));
  const ow = cw * z, oh = ch * z, out = Buffer.alloc(ow * oh * 4);
  for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) {
    const si = ((cy + Math.floor(j / z)) * png.width + (cx + Math.floor(i / z))) * 4;
    const di = (j * ow + i) * 4;
    out[di] = png.data[si]; out[di + 1] = png.data[si + 1]; out[di + 2] = png.data[si + 2]; out[di + 3] = 255;
  }
  return encodePNG(ow, oh, out);
}

const report = {
  schema: 'elder-souls/t4-r8-shots@1', at: new Date().toISOString(),
  commit: execSync('git rev-parse HEAD', { cwd: REPO_ROOT }).toString().trim(),
  longest_record: LONGEST ? { id: LONGEST.id, chars: String(LONGEST.description || '').length } : null,
  frames: [],
};
for (const [W, H] of [[1920, 1080], [1280, 720]]) {
  const h = await launchGame({ width: W, height: H, timeout: 300000, state: STATE });
  try {
    await h.h('setMode', 'play-instrumented');
    await h.h('setRenderRate', 0);
    await h.h('setDevicePixelRatio', 1);
    await h.h('loadState', STATE);
    await h.h('setMode', 'play-instrumented');
    await h.h('stepFrames', 4);
    const got = await h.page.evaluate(async (id) => {
      const A = window.__HARNESS;
      const press = async (code) => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
        await A.stepFrames(2);
        window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
        await A.stepFrames(2);
      };
      const geom = () => {
        const st = A.getUIState();
        const els = (st.elements || []).filter((e) => e.visible);
        const g = (i) => { const e = els.find((x) => x.id === i); return e ? e.rect : null; };
        return {
          panel: g('container.panel'), head: g('container.mine.head'), head2: g('container.theirs.head'),
          firstRow: (els.find((e) => e.kind === 'list_row') || {}).rect || null,
          band: g('container.band'), read: g('container.read'),
          read_meta: (els.find((e) => e.id === 'container.read') || {}).meta || null,
        };
      };
      A.openContainer('Reed Creel', [{ id, count: 1 }]);
      await A.stepFrames(3);
      await press('ArrowRight');
      const rest = { geom: geom(), shot: await A.screenshot() };
      await press('Tab');
      const open = { geom: geom(), shot: await A.screenshot() };
      return { rest, open };
    }, LONGEST.id);

    for (const [name, r] of Object.entries(got)) {
      const buf = Buffer.from(String(r.shot).split(',')[1], 'base64');
      const png = decodePNG(buf);
      const tag = `${W}x${H}-${name}`;
      fs.writeFileSync(path.join(OUT, `${tag}-full.png`), buf);
      const p = r.geom.panel;
      if (p) fs.writeFileSync(path.join(OUT, `${tag}-panel.png`), cropZoom(png, p, 1));
      // The list head: the exact band where the collision was. Both side headers plus the first
      // row's full height, at 3x.
      if (r.geom.head && p) {
        const hd = r.geom.head;
        const rowH = r.geom.firstRow ? r.geom.firstRow[3] : hd[3];
        fs.writeFileSync(path.join(OUT, `${tag}-listhead-3x.png`),
          cropZoom(png, [p[0] + 10, hd[1] - 6, p[2] - 20, hd[3] + rowH + 12], 3));
      }
      if (r.geom.read) fs.writeFileSync(path.join(OUT, `${tag}-reading-3x.png`), cropZoom(png, r.geom.read, 3));
      if (r.geom.band) fs.writeFileSync(path.join(OUT, `${tag}-band-3x.png`), cropZoom(png, r.geom.band, 3));
      report.frames.push({ tag, geom: r.geom });
      log(`  ${tag}: panel ${JSON.stringify(p)} head ${JSON.stringify(r.geom.head)} firstRow ${JSON.stringify(r.geom.firstRow)}`
        + (r.geom.read_meta ? `  reading shown/needed ${r.geom.read_meta.description_lines_shown}/${r.geom.read_meta.description_lines_needed}` : ''));
    }
  } catch (e) { report.frames.push({ threw: String((e && e.stack) || e) }); log(`THREW ${e}`); }
  finally { try { await Promise.race([h.close(), new Promise((r) => setTimeout(r, 20000))]); } catch { /* reaped */ } }
}
writeJson(path.join(OUT, 't4-r8-shots.json'), report);
log(`-> ${OUT}`);
