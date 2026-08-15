#!/usr/bin/env node
/**
 * leaky-arms.mjs — build deliberately leaky COPIES of the real r2 pack and prove the gate fires
 * on OUR OWN BYTES, not only on the synthetic 64x64 fixtures in image-leakcheck's --self-test.
 *
 * A guard that has never fired is not evidence. image-leakcheck ships a self-test whose arms are
 * generated squares; passing it shows the code path works, not that it works on a 512x512 crop of
 * a render against a 512x512 crop of an Elden Ring plate. So both injections below are applied to
 * the shipped pack's actual A.png/B.png files, and each is expected at a specific exit code.
 *
 *   leaky-quantised   every pair's REFERENCE arm quantised to 8 luma levels. `distinct_levels` is
 *                     a HELD-OUT provenance channel, so a 5/5 sweep must gate.  expect exit 3.
 *   leaky-resolution  pair01's reference arm downsampled to 256x256 and re-upscaled to 512x512.
 *                     Same dimensions, but duplicated scanlines — RI-VIS06 §D's "resolution /
 *                     aspect mismatch" row arriving as a resampling signature rather than a size
 *                     difference, which is the harder version to catch.  expect exit 3 or 4.
 *
 * The reveal is read to decide WHICH arm is the reference in each pair. That is legitimate here
 * and nowhere else: this script builds a control that is thrown away, never judged, and it runs
 * in the pack builder's own context, which has seen both arms by construction.
 *
 * usage: node leaky-arms.mjs <packs-dir> <reveal-dir> <out-root>
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [packs, reveals, outRoot] = process.argv.slice(2);
if (!packs || !reveals || !outRoot) { console.error('usage: leaky-arms.mjs <packs> <reveals> <out-root>'); process.exit(1); }

const pairs = fs.readdirSync(packs).filter((d) => fs.statSync(path.join(packs, d)).isDirectory()).sort();
const refLetterOf = (pair) => {
  const m = JSON.parse(fs.readFileSync(path.join(reveals, `${pair}.reveal`, 'mapping.json'), 'utf8'));
  return m.A === 'reference' ? 'A' : 'B';
};

function copyPack(dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  for (const p of pairs) {
    fs.mkdirSync(path.join(dst, 'packs', p), { recursive: true });
    for (const f of ['A.png', 'B.png']) fs.copyFileSync(path.join(packs, p, f), path.join(dst, 'packs', p, f));
    fs.mkdirSync(path.join(dst, 'reveal', `${p}.reveal`), { recursive: true });
    fs.copyFileSync(path.join(reveals, `${p}.reveal`, 'mapping.json'), path.join(dst, 'reveal', `${p}.reveal`, 'mapping.json'));
  }
}

// The injections must change ONE channel and nothing else. A first draft of this script re-saved
// through Image.convert('RGB'), which silently changed PNG colour type 6 -> 2 and tripped the
// STRUCTURAL gate before the statistical one could be tested — the guard fired, but for a defect
// the script had introduced by accident rather than the one it meant to inject. Mode is preserved
// below, and file lengths are re-equalised afterwards, so each arm isolates its own channel.
const PY_QUANTISE = `
import sys
from PIL import Image
p = sys.argv[1]
im = Image.open(p)
mode = im.mode
im = im.point(lambda v: (v // 32) * 32)
im.convert(mode).save(p, 'PNG')
`;
const PY_RESAMPLE = `
import sys
from PIL import Image
p = sys.argv[1]
im = Image.open(p)
mode = im.mode
w, h = im.size
im = im.resize((w // 2, h // 2), Image.BILINEAR).resize((w, h), Image.NEAREST)
im.convert(mode).save(p, 'PNG')
`;

// Same padding routine as protocol-a-pack.mjs --equalise-bytes, so `bytes` stays tied and cannot
// be the reason a leaky arm goes red.
const CRC_TABLE = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function padPngTo(file, target) {
  const buf = fs.readFileSync(file);
  const need = target - buf.length - 12;
  if (need < 0) throw new Error(`${file} already ${buf.length} > target ${target}`);
  const iend = buf.length - 12;
  const type = Buffer.from('esPd', 'latin1');
  const data = Buffer.alloc(need, 0);
  const len = Buffer.alloc(4); len.writeUInt32BE(need, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([type, data])), 0);
  fs.writeFileSync(file, Buffer.concat([buf.subarray(0, iend), len, type, data, crc, buf.subarray(iend)]));
}
function equalise(root) {
  for (const p of pairs) {
    const A = path.join(root, 'packs', p, 'A.png'); const B = path.join(root, 'packs', p, 'B.png');
    const target = Math.max(fs.statSync(A).size, fs.statSync(B).size) + 12 + 16;
    padPngTo(A, target); padPngTo(B, target);
  }
}

// --- arm 1: quantised reference on every pair
const q = path.join(outRoot, 'leaky-quantised');
copyPack(q);
for (const p of pairs) {
  const f = path.join(q, 'packs', p, `${refLetterOf(p)}.png`);
  execFileSync('python3', ['-c', PY_QUANTISE, f]);
}
equalise(q);

// --- arm 2: resampled reference on pair01 only
const r = path.join(outRoot, 'leaky-resolution');
copyPack(r);
{
  const p = pairs[0];
  execFileSync('python3', ['-c', PY_RESAMPLE, path.join(r, 'packs', p, `${refLetterOf(p)}.png`)]);
}
equalise(r);

// --- arm 3: the same resampling on EVERY pair.
// Arm 2 is deliberately kept even though it comes back GREEN. The battery gates on a SWEEP, so a
// leak present on one pair of five cannot reach p <= 0.0313 and cannot gate, whatever its size.
// Arm 3 is the same injection made systematic, and the contrast between them is the honest
// statement of what this gate can and cannot see.
const r5 = path.join(outRoot, 'leaky-resolution-all');
copyPack(r5);
for (const p of pairs) execFileSync('python3', ['-c', PY_RESAMPLE, path.join(r5, 'packs', p, `${refLetterOf(p)}.png`)]);
equalise(r5);

console.log(`built ${q} and ${r} from ${pairs.length} real pairs`);
