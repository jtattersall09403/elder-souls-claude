// decode.mjs — one image decoder for the whole fidelity harness.
//
// RI-VIS03 §0 says the input is a PNG. The reference set in corpus/70-visual/refs/ is not:
// it is 90 AVIF and 37 JPEG. ACQUISITION-REPORT §9 records that every reference file had to
// be transcoded to PNG in a scratch directory before it could be measured. That step is a
// silent risk (the transcoder becomes part of the instrument) and it is removed here.
//
// All four decoders are pure-JS or WASM — no native compilation, no system binaries:
//   PNG   pngjs
//   JPEG  jpeg-js
//   AVIF  @jsquash/avif  (libavif compiled to wasm)
//   WebP  @jsquash/webp  (libwebp compiled to wasm)
//
// IMPORTANT wasm note: @jsquash's default entry points `fetch()` their .wasm at runtime and
// therefore fail outright under Node ("fetch failed"). We import the codec module directly and
// hand it the wasm bytes off disk, which is deterministic and works offline.
//
// Output is always {width, height, data: Uint8Array RGBA8, format}. Decoding is lossless with
// respect to the stored pixels for every format here, so the statistics computed downstream are
// the statistics of the committed bytes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = path.resolve(HERE, '..', '..');

export const SUPPORTED_EXT = ['.png', '.jpg', '.jpeg', '.avif', '.webp'];

let _png = null, _jpeg = null, _avif = null, _webp = null;

async function loadPng() {
  if (!_png) ({ PNG: _png } = await import('pngjs'));
  return _png;
}
async function loadJpeg() {
  if (!_jpeg) _jpeg = (await import('jpeg-js')).default ?? (await import('jpeg-js'));
  return _jpeg;
}
async function loadJsquash(pkg, wasmRel) {
  const mod = await import(`${pkg}/decode.js`);
  const wasmPath = path.join(TOOLS_DIR, 'node_modules', pkg, wasmRel);
  const wasmBinary = fs.readFileSync(wasmPath);
  await mod.init(undefined, { wasmBinary });
  return mod.default ?? mod.decode;
}
async function loadAvif() {
  if (!_avif) _avif = await loadJsquash('@jsquash/avif', 'codec/dec/avif_dec.wasm');
  return _avif;
}
async function loadWebp() {
  if (!_webp) _webp = await loadJsquash('@jsquash/webp', 'codec/dec/webp_dec.wasm');
  return _webp;
}

/** True if this path has an extension the harness can decode. */
export function isDecodable(p) {
  return SUPPORTED_EXT.includes(path.extname(p).toLowerCase());
}

/**
 * Decode any supported image to RGBA8.
 * @returns {Promise<{width:number,height:number,data:Uint8Array,format:string,bytes:number}>}
 */
export async function decodeImage(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  let out;
  if (ext === '.png') {
    const PNG = await loadPng();
    const png = PNG.sync.read(buf);
    out = { width: png.width, height: png.height, data: new Uint8Array(png.data), format: 'png' };
  } else if (ext === '.jpg' || ext === '.jpeg') {
    const jpeg = await loadJpeg();
    // useTArray keeps it a Uint8Array; formatAsRGBA is the default but pinned for clarity.
    const raw = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048 });
    out = { width: raw.width, height: raw.height, data: new Uint8Array(raw.data), format: 'jpeg' };
  } else if (ext === '.avif') {
    const dec = await loadAvif();
    const img = await dec(new Uint8Array(buf).buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    out = { width: img.width, height: img.height, data: new Uint8Array(img.data), format: 'avif' };
  } else if (ext === '.webp') {
    const dec = await loadWebp();
    const img = await dec(new Uint8Array(buf).buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    out = { width: img.width, height: img.height, data: new Uint8Array(img.data), format: 'webp' };
  } else {
    throw new Error(`unsupported image extension "${ext}" (supported: ${SUPPORTED_EXT.join(', ')})`);
  }
  out.bytes = buf.length;
  out.buffer = buf;
  return out;
}

/** Write an RGBA8 plane out as a PNG (used for mask artefacts — RI-VIS03 "How we lose" §masking). */
export async function writePng(file, width, height, rgba) {
  const PNG = await loadPng();
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  fs.writeFileSync(file, PNG.sync.write(png));
  return file;
}

/** Encode a boolean mask as a black/white PNG. */
export async function writeMaskPng(file, width, height, mask) {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const v = mask[i] ? 255 : 0;
    rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
  }
  return writePng(file, width, height, rgba);
}
