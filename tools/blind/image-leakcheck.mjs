#!/usr/bin/env node
/**
 * image-leakcheck.mjs — the pre-judge gate for an IMAGE blind pack (RI-VIS06 §D, asserted
 * mechanically rather than promised in prose).
 *
 * WHY A SECOND FILE AND NOT tools/blind/leakcheck.mjs
 * --------------------------------------------------
 * leakcheck.mjs is the right gate and the wrong medium. Every one of its forty-odd rules is a
 * statistic over TEXT — `redaction_tokens`, `mean_sentence_words`, `semicolon_density` — and its
 * pack loader reads `reports/packs/<name>` trials made of prose. Pointed at a directory of PNGs
 * it does not fail informatively; it has nothing to compute. Its DOCTRINE is what transfers, and
 * this file transfers all of it verbatim:
 *
 *   * every rule is reported with its score, hit or miss, because a battery that only prints
 *     hits cannot be told from a rubber stamp;
 *   * rules are split into ones the pack builder actively equalised (`matched: true`, a pass is
 *     BY CONSTRUCTION and is not evidence) and ones held out (`matched: false`, a pass IS
 *     evidence);
 *   * the gate runs BEFORE the judge and fails closed.
 *
 * THE ONE THING THAT IS GENUINELY DIFFERENT ABOUT IMAGES, AND IT MATTERS
 * ---------------------------------------------------------------------
 * In a prose pack every statistic that separates the arms is a leak. In a fidelity pack it is
 * not: `edge_energy` separating the arms may be the very finding Protocol A exists to produce.
 * A battery that gated on "any statistic separates the arms" would refuse to run precisely when
 * our render is worse, which is the one outcome the protocol is for. So the rules are split by
 * WHAT THEY MEASURE, not by how well they score:
 *
 *   PROVENANCE channels — properties of the FILE and its handling, which carry no information
 *     about how well anything was rendered: byte length, dimensions, distinct luma levels, the
 *     8-pixel blocking signature of a JPEG quantiser, flat letterbox borders, duplicated rows.
 *     If one of these decides the pack, the judge can sort the images without looking at the
 *     render. THESE GATE.
 *   QUALITY statistics — edge energy, tonal spread, shadow detail, local contrast. These are
 *     what the judge is being asked about. THEY ARE REPORTED AND NEVER GATE, and the report says
 *     so on every line, so nobody later reads a separating quality statistic as a leak or a
 *     non-separating one as a pass.
 *
 * POWER, STATED UP FRONT BECAUSE IT IS WEAK
 * -----------------------------------------
 * Protocol A runs five pairs. Five trials is five bits at most: a clean sweep by chance is
 * p = 1/32 one-sided per rule, and with a dozen rules the family-wise chance of some rule
 * sweeping is not small. This battery therefore catches only channels that are BLATANT, and it
 * is honest about that in its own output. It is not a proof of blindness; it is the mechanical
 * floor under one, and the reason to keep the crop construction conservative rather than to
 * trust the number this file prints.
 *
 * USAGE
 *   node tools/blind/image-leakcheck.mjs --packs <dir> --reveals <dir> [--json out.json]
 *   node tools/blind/image-leakcheck.mjs --self-test
 *
 * <dir> holds one subdirectory per pair, each with A.png and B.png; <reveals> holds the matching
 * <pair>.reveal/mapping.json written by make-pair.mjs.
 *
 * EXIT CODES
 *   0  no provenance channel decides the pack — the judges may be dispatched
 *   3  a provenance channel decides the pack — DO NOT dispatch
 *   4  structural defect (a key inside a pack directory, a pack without a key, mismatched counts)
 *   1  usage / IO error
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  args[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
}

function logChoose(n, k) { let r = 0; for (let i = 1; i <= k; i++) r += Math.log(n - k + i) - Math.log(i); return r; }
function binomTail(k, n) {
  if (k <= 0) return 1; if (k > n) return 0;
  let s = 0; for (let i = k; i <= n; i++) s += Math.exp(logChoose(n, i) - n * Math.LN2);
  return Math.min(1, s);
}

/** Per-image statistics, computed once per file by one Pillow pass. */
const MEASURE = `
import sys, json, math
from PIL import Image
out = {}
for p in sys.argv[1:]:
    raw = open(p, 'rb').read()
    im = Image.open(p).convert('RGB')
    w, h = im.size
    g = im.convert('L'); px = g.load()
    on = off = non = noff = 0.0
    for yy in range(h):
        row = [px[xx, yy] for xx in range(w)]
        for xx in range(1, w):
            d = abs(row[xx] - row[xx - 1])
            if xx % 8 == 0: on += d; non += 1
            else: off += d; noff += 1
    blockiness = (on / max(non, 1)) / max(off / max(noff, 1), 1e-9)
    lap = 0.0; n = 0
    for yy in range(1, h - 1):
        for xx in range(1, w - 1):
            lap += abs(4 * px[xx, yy] - px[xx-1, yy] - px[xx+1, yy] - px[xx, yy-1] - px[xx, yy+1]); n += 1
    hist = g.histogram(); tot = sum(hist)
    mean = sum(i * c for i, c in enumerate(hist)) / tot / 255.0
    var = sum(((i / 255.0) - mean) ** 2 * c for i, c in enumerate(hist)) / tot
    # shadow detail: distinct luma levels present below the 25th percentile of the frame
    cum = 0; q25 = 255
    for i, c in enumerate(hist):
        cum += c
        if cum >= tot * 0.25: q25 = i; break
    shadow_levels = sum(1 for i, c in enumerate(hist) if i <= q25 and c)
    # flat border: rows/cols at the edge whose whole span is one value (letterbox / matte)
    border = 0
    for yy in (0, h - 1):
        if len(set(px[xx, yy] for xx in range(w))) == 1: border += 1
    for xx in (0, w - 1):
        if len(set(px[xx, yy] for yy in range(h))) == 1: border += 1
    # duplicated scanlines: a resampler or an upscaler leaves these; a native render does not
    seen = set(); dup = 0
    for yy in range(h):
        t = bytes(px[xx, yy] for xx in range(w))
        if t in seen: dup += 1
        seen.add(t)
    # local contrast: median over 32x32 tiles of the tile standard deviation
    tiles = []
    for ty in range(0, h - 31, 32):
        for tx in range(0, w - 31, 32):
            vals = [px[tx + a, ty + b] for b in range(0, 32, 2) for a in range(0, 32, 2)]
            m = sum(vals) / len(vals)
            tiles.append(math.sqrt(sum((v - m) ** 2 for v in vals) / len(vals)))
    tiles.sort()
    out[p] = {
        'bytes': len(raw), 'w': w, 'h': h, 'pixels': w * h,
        'blockiness_8px': blockiness,
        'distinct_levels': sum(1 for c in hist if c),
        'flat_border_edges': border, 'duplicate_rows': dup,
        'edge_energy': lap / max(n, 1),
        'sd_luma': math.sqrt(var), 'mean_luma': mean,
        'shadow_levels': shadow_levels,
        'local_contrast_med': (tiles[len(tiles)//2] if tiles else 0.0),
    }
print(json.dumps(out))
`;

// `matched: true` = the pack builder equalised this on purpose, so a pass is by construction.
const RULES = [
  { id: 'bytes',              class: 'provenance', matched: false, why: 'file length; a PNG of a JPEG-sourced crop compresses differently from a PNG of a render' },
  { id: 'w',                  class: 'provenance', matched: true,  why: 'width — equalised by the crop box' },
  { id: 'h',                  class: 'provenance', matched: true,  why: 'height — equalised by the crop box' },
  { id: 'blockiness_8px',     class: 'provenance', matched: true,  why: 'the 8x8 DCT signature; equalised by the shared JPEG round trip, and this row is the check that it worked' },
  { id: 'distinct_levels',    class: 'provenance', matched: false, why: 'a quantised or palette-reduced arm has fewer luma levels' },
  { id: 'flat_border_edges',  class: 'provenance', matched: false, why: 'letterbox or matte edges; one arm bordered and the other not is a label' },
  { id: 'duplicate_rows',     class: 'provenance', matched: false, why: 'a resampled or upscaled arm repeats scanlines; a native crop does not' },
  { id: 'edge_energy',        class: 'quality',    matched: false, why: 'sharpness / detail — this is the finding, not a leak' },
  { id: 'sd_luma',            class: 'quality',    matched: false, why: 'tonal spread — the finding' },
  { id: 'mean_luma',          class: 'quality',    matched: false, why: 'exposure — the finding' },
  { id: 'shadow_levels',      class: 'quality',    matched: false, why: 'readable detail in shadow — the finding' },
  { id: 'local_contrast_med', class: 'quality',    matched: false, why: 'local micro-contrast — the finding' },
];

function loadPairs(packsDir, revealsDir) {
  const pairs = [];
  for (const name of fs.readdirSync(packsDir).sort()) {
    const dir = path.join(packsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const a = path.join(dir, 'A.png'); const b = path.join(dir, 'B.png');
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (/mapping|reveal|key/i.test(f)) {
        console.error(`STRUCTURAL: ${path.join(dir, f)} sits inside the pack the judge reads`);
        process.exit(4);
      }
    }
    const keyFile = path.join(revealsDir, `${name}.reveal`, 'mapping.json');
    if (!fs.existsSync(keyFile)) { console.error(`STRUCTURAL: no reveal key for pair ${name} at ${keyFile}`); process.exit(4); }
    const key = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
    pairs.push({ name, a, b, refSide: key.A === 'reference' ? 'A' : 'B' });
  }
  return pairs;
}

if (args['self-test']) {
  // The gate must go RED on a pack that is decidable, or it is an inert probe (RULES.md 4).
  const tmp = fs.mkdtempSync('/tmp/imgleak-');
  const packs = path.join(tmp, 'packs'); const reveals = path.join(tmp, 'reveals');
  const mk = `
import sys, os
from PIL import Image
import random
root, rev = sys.argv[1], sys.argv[2]
random.seed(7)
for i in range(5):
    d = os.path.join(root, 'p%d' % i); os.makedirs(d, exist_ok=True)
    os.makedirs(os.path.join(rev, 'p%d.reveal' % i), exist_ok=True)
    clean = Image.new('RGB', (64, 64))
    clean.putdata([(random.randrange(256),)*3 for _ in range(64*64)])
    # the "reference" arm is deliberately quantised to 8 luma levels: a blatant provenance channel
    leaky = clean.point(lambda v: (v // 32) * 32)
    clean.save(os.path.join(d, 'A.png')); leaky.save(os.path.join(d, 'B.png'))
    open(os.path.join(rev, 'p%d.reveal' % i, 'mapping.json'), 'w').write('{"A":"ours","B":"reference"}')
`;
  execFileSync('python3', ['-c', mk, packs, reveals]);
  let r = '';
  try {
    r = execFileSync(process.execPath, [process.argv[1], '--packs', packs, '--reveals', reveals], { encoding: 'utf8' }).toString();
  } catch (e) { r = String(e.stdout || ''); }   // exit 3 IS the expected outcome here
  console.log('--- self-test ran the gate on a deliberately decidable pack ---');
  const red = /LEAK/.test(r);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(red ? 'SELF-TEST PASS: the gate flagged a pack it should flag' : 'SELF-TEST FAIL: the gate passed a decidable pack — it is inert');
  process.exit(red ? 0 : 5);
}

if (!args.packs || !args.reveals) {
  console.error('usage: node tools/blind/image-leakcheck.mjs --packs <dir> --reveals <dir> [--json out.json]');
  process.exit(1);
}
const pairs = loadPairs(path.resolve(String(args.packs)), path.resolve(String(args.reveals)));
if (!pairs.length) { console.error('no pairs found'); process.exit(1); }
const files = pairs.flatMap((p) => [p.a, p.b]);
const stats = JSON.parse(execFileSync('python3', ['-c', MEASURE, ...files], { encoding: 'utf8', maxBuffer: 1 << 28 }));

const n = pairs.length;
const results = RULES.map((rule) => {
  let namesRef = 0; let decided = 0; const rows = [];
  for (const p of pairs) {
    const va = stats[p.a][rule.id]; const vb = stats[p.b][rule.id];
    // A TIE IS NOT A LEAK AND IT IS NOT AN ANTI-LEAK. A rule that returns the same value on
    // both arms carries no information either way, so it is excluded from the denominator
    // rather than scored as a miss — otherwise `width`, which the crop box makes identical on
    // purpose, reads as a perfect 0/5 "channel" and the gate cries wolf about its own success.
    if (va === vb) { rows.push({ pair: p.name, A: va, B: vb, larger: null, ref: p.refSide, hit: null }); continue; }
    decided++;
    const larger = va > vb ? 'A' : 'B';
    const hit = larger === p.refSide;
    if (hit) namesRef++;
    rows.push({ pair: p.name, A: va, B: vb, larger, ref: p.refSide, hit });
  }
  const k = Math.max(namesRef, decided - namesRef);
  return {
    ...rule, names_ref: namesRef, decided, of: n,
    extreme: k, sweeps: decided === n && k === n,
    p_one_sided: decided ? +binomTail(k, decided).toFixed(4) : 1, rows,
  };
});

const decisive = results.filter((r) => r.class === 'provenance' && r.sweeps);
const gating = decisive.filter((r) => !r.matched);

const pad = (s, w) => String(s).padEnd(w);
console.log(`image-leakcheck — ${n} pairs, ${RULES.length} rules. Five trials is weak power: a clean sweep by chance is p=${binomTail(n, n).toFixed(4)} per rule, one-sided.\n`);
for (const cls of ['provenance', 'quality']) {
  console.log(cls === 'provenance'
    ? 'PROVENANCE CHANNELS — these GATE. A sweep here means the pack is sortable without judging the render.'
    : '\nQUALITY STATISTICS — reported, never gating. A sweep here is the FINDING Protocol A exists to produce.');
  console.log(`  ${pad('rule', 20)}${pad('matched', 9)}${pad('names ref', 16)}${pad('p', 9)}why`);
  for (const r of results.filter((x) => x.class === cls)) {
    const flag = r.class === 'provenance' && r.sweeps ? (r.matched ? '  (by construction)' : '  <-- LEAK') : '';
    const tied = r.decided < n ? ` (${n - r.decided} tied)` : '';
    console.log(`  ${pad(r.id, 20)}${pad(r.matched ? 'yes' : 'held-out', 9)}${pad(`${r.names_ref}/${r.decided}${tied}`, 16)}${pad(r.p_one_sided, 9)}${r.why}${flag}`);
  }
}
console.log('');
if (args.json) fs.writeFileSync(String(args.json), JSON.stringify({ pairs: pairs.map((p) => p.name), stats, results }, null, 2) + '\n');
if (gating.length) {
  console.log(`GATE: RED — ${gating.map((r) => r.id).join(', ')} decides the pack without reading the render. Do not dispatch a judge.`);
  process.exit(3);
}
console.log('GATE: GREEN — no held-out provenance channel decides the pack. Power is weak (see the header); this is a floor, not a proof.');
process.exit(0);
