#!/usr/bin/env node
// t4-r8-critic-crop.mjs — crop a rect out of a captured PNG and upscale it, so a critic can LOOK.
// Owner: crit-t4-r8. The r7 gap was found this way and by nothing else; every metric said clean.
// Usage: node t4-r8-critic-crop.mjs --in <png> --rect x,y,w,h --scale 3 --out <png> [--pad 8]
'use strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

const A = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean)
  .map((s) => { const i = s.trim().indexOf(' '); return i < 0 ? [s.trim(), true] : [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));

function decodePNG(buf) {
  let p = 8, width = 0, height = 0, bitDepth = 0, colourType = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colourType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colourType !== 6 || interlace !== 0) throw new Error(`unsupported PNG ${bitDepth}/${colourType}/${interlace}`);
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
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev ? prev[x] : 0, c = (prev && x >= bpp) ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      else if (f !== 0) throw new Error('unknown filter ' + f);
      cur[x] = v & 255;
    }
  }
  return { width, height, data: out };
}
function crc32(buf) {
  let c, t = [];
  for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function encodePNG(w, hgt, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(hgt, 4); ihdr[8] = 8; ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc(hgt * (stride + 1));
  for (let y = 0; y < hgt; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const png = decodePNG(fs.readFileSync(String(A.in)));
const pad = Number(A.pad || 8);
const [rx, ry, rw, rh] = String(A.rect).split(',').map(Number);
const x0 = Math.max(0, Math.round(rx - pad)), y0 = Math.max(0, Math.round(ry - pad));
const w = Math.min(png.width - x0, Math.round(rw + pad * 2)), hh = Math.min(png.height - y0, Math.round(rh + pad * 2));
const k = Math.max(1, Math.round(Number(A.scale || 3)));
const out = Buffer.alloc(w * k * hh * k * 4);
for (let y = 0; y < hh * k; y++) for (let x = 0; x < w * k; x++) {
  const si = (((y0 + Math.floor(y / k)) * png.width) + (x0 + Math.floor(x / k))) << 2;
  const di = ((y * w * k) + x) << 2;
  out[di] = png.data[si]; out[di + 1] = png.data[si + 1]; out[di + 2] = png.data[si + 2]; out[di + 3] = 255;
}
fs.writeFileSync(String(A.out), encodePNG(w * k, hh * k, out));
console.log(`${A.in} [${x0},${y0},${w},${hh}] x${k} -> ${A.out} (${w * k}x${hh * k})`);
