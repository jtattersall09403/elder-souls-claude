#!/usr/bin/env node
// W1-30C — fetch and convert the CC0 texture sets named in tools/assets/material-library.json.
//
// Reproducible: every step is a recorded ffmpeg command over an unmodified upstream file, and the
// hash of both the upstream file and the converted output lands in the manifest.
//
//   NODE_USE_ENV_PROXY=1 node tools/assets/fetch-cc0-materials.mjs            # fetch what is missing
//   NODE_USE_ENV_PROXY=1 node tools/assets/fetch-cc0-materials.mjs --force    # refetch everything
//   node tools/assets/fetch-cc0-materials.mjs --verify                        # no network: presence check
//
// NODE_USE_ENV_PROXY=1 is required on the RunPod/sandbox hosts: Node's global fetch ignores
// HTTPS_PROXY without it, and the failure reads as a DNS error rather than a proxy one.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/assets/material-library.json'), 'utf8'));
const OUT = path.join(ROOT, 'game/assets/w1-30/materials');
const CACHE = process.env.W1_30C_CACHE || path.join(process.env.TMPDIR || '/tmp', 'w1-30c-source-cache');

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const VERIFY = args.has('--verify');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: ['ignore', 'pipe', 'pipe'] });

// Poly Haven's map keys are not uniform across assets, so resolve by trying names rather than
// assuming one shape, and fail loudly rather than silently shipping a family with no normal map.
function pickMap(files, names) {
  for (const n of names) {
    const node = files[n] ?? files[n.toLowerCase()] ?? files[n[0].toUpperCase() + n.slice(1)];
    const one = node?.['1k']?.jpg;
    if (one?.url) return one;
  }
  return null;
}

async function fetchSource(slug) {
  fs.mkdirSync(CACHE, { recursive: true });
  const meta = { slug, maps: {} };
  const files = await (await fetch(`https://api.polyhaven.com/files/${slug}`)).json();
  for (const [role, names] of [['diff', ['Diffuse']], ['nor_gl', ['nor_gl']], ['rough', ['Rough']]]) {
    const entry = pickMap(files, names);
    if (!entry) throw new Error(`W1-30C ${slug}: no 1k jpg for ${names[0]} — the plan's stop condition applies, record a synth substitution instead`);
    const cached = path.join(CACHE, `${slug}_${role}_src.jpg`);
    if (FORCE || !fs.existsSync(cached)) {
      const bytes = Buffer.from(await (await fetch(entry.url)).arrayBuffer());
      if (entry.md5 && crypto.createHash('md5').update(bytes).digest('hex') !== entry.md5) {
        throw new Error(`W1-30C ${slug}/${role}: upstream md5 mismatch — refusing an asset that is not what the API described`);
      }
      fs.writeFileSync(cached, bytes);
    }
    meta.maps[role] = { url: entry.url, source_sha256: sha256(fs.readFileSync(cached)), cached };
  }
  return meta;
}

function convert(slug, meta, adjust) {
  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = {};
  const step = (role, name, filter, q, src) => {
    const p = path.join(dir, `${slug}_${name}.jpg`);
    ff('-i', src, '-vf', filter, '-q:v', String(q), p);
    out[role] = { file: path.basename(p), sha256: sha256(fs.readFileSync(p)), bytes: fs.statSync(p).size };
  };
  // Albedo: desaturated to 0.55 so the region palette leads. Pigment variation survives;
  // "rusty orange" does not overrule Black Marsh.
  step('albedo', 'albedo_1k', `scale=1024:1024,eq=saturation=0.55${adjust ? ':' + adjust : ''}`, 4, meta.maps.diff.cached);
  // Normal: OpenGL convention, 1k, higher JPEG quality — a quantised normal shows as banded
  // shading, which is exactly the amateur tell this piece exists to remove.
  step('normal', 'normal_1k', 'scale=1024:1024', 3, meta.maps.nor_gl.cached);
  // Roughness: low-frequency, so 512 grayscale. This is what keeps the library inside the budget
  // without a KTX2 toolchain (see the deferral recorded in the manifest).
  step('rough', 'rough_512', 'format=gray,scale=512:512', 5, meta.maps.rough.cached);
  return out;
}

const cc0 = Object.entries(SPEC.families).filter(([, f]) => f.kind === 'cc0');
const slugs = [...new Map(cc0.map(([, f]) => [f.slug, f])).entries()];

if (VERIFY) {
  let bad = 0, total = 0;
  for (const [slug] of slugs) for (const r of ['albedo_1k', 'normal_1k', 'rough_512']) {
    const p = path.join(OUT, slug, `${slug}_${r}.jpg`);
    total++;
    if (!fs.existsSync(p)) { console.error(`MISSING ${path.relative(ROOT, p)}`); bad++; }
  }
  console.log(`fetch-cc0-materials --verify: ${total - bad}/${total} files present`);
  process.exit(bad ? 1 : 0);
}

const report = {};
for (const [slug, spec] of slugs) {
  const dir = path.join(OUT, slug);
  const done = ['albedo_1k', 'normal_1k', 'rough_512'].every(r => fs.existsSync(path.join(dir, `${slug}_${r}.jpg`)));
  if (done && !FORCE) { console.log(`  skip  ${slug} (present)`); continue; }
  process.stdout.write(`  fetch ${slug} ... `);
  const meta = await fetchSource(slug);
  report[slug] = {
    adjust: spec.adjust || null,
    source: `https://polyhaven.com/a/${slug}`, author: spec.author || null, licence: 'CC0-1.0',
    maps: convert(slug, meta, spec.adjust),
    upstream: Object.fromEntries(Object.entries(meta.maps).map(([k, v]) => [k, { url: v.url, sha256: v.source_sha256 }])),
  };
  const kb = Object.values(report[slug].maps).reduce((a, m) => a + m.bytes, 0) / 1024;
  console.log(`ok (${kb.toFixed(0)} KB)`);
}
fs.mkdirSync(CACHE, { recursive: true });
fs.writeFileSync(path.join(CACHE, 'fetch-report.json'), JSON.stringify(report, null, 2));
console.log(`fetch-cc0-materials: ${Object.keys(report).length} set(s) written to ${path.relative(ROOT, OUT)}`);
