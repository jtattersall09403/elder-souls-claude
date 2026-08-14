#!/usr/bin/env node
// W1-30C's cheap gate. Content integrity belongs in a check, not a constructor (RULES.md rule 14).
//
//   node tools/assets/check-material-coverage.mjs           # check, exit non-zero on any failure
//   node tools/assets/check-material-coverage.mjs --write   # also regenerate the asset manifest
//
// It answers the coverage row of W1-30C's bar without a browser: does every one of the twenty
// families have albedo + normal + roughness on disk, does the shipped table in visual-foundation.js
// agree with the build spec, does every set carry provenance and a redistributable licence, and is
// the whole library inside the texture-memory budget.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/assets/material-library.json'), 'utf8'));
const ASSETS = path.join(ROOT, 'game/assets/w1-30/materials');
const WRITE = process.argv.includes('--write');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const fails = [], warns = [];
const fail = (m) => fails.push(m);

// --- the shipped table must agree with the build spec ----------------------
const src = fs.readFileSync(path.join(ROOT, 'game/src/render/visual-foundation.js'), 'utf8');
const shippedBlock = src.slice(src.indexOf('const FAMILY_SET=Object.freeze({'));
const shipped = Object.fromEntries([...shippedBlock.slice(0, shippedBlock.indexOf('});')).matchAll(/(\w+)\s*:\s*'([\w.-]+)'/g)].map(m => [m[1], m[2]]));
const families = [...(src.slice(src.indexOf('const FAMILY = Object.freeze({')).slice(0, 900).matchAll(/^\s*(\w+):\s*\{ roughness/gm))].map(m => m[1]);
const declared = [...new Set([...families, ...Object.keys(shipped)])];

for (const [fam, spec] of Object.entries(SPEC.families)) {
  const want = spec.kind === 'variant' ? SPEC.families[spec.of].slug : spec.slug;
  if (shipped[fam] !== want) fail(`family '${fam}': visual-foundation FAMILY_SET says '${shipped[fam] ?? '(absent)'}', material-library.json says '${want}'`);
}
for (const fam of Object.keys(shipped)) if (!SPEC.families[fam]) fail(`family '${fam}' is shipped but has no entry in material-library.json — it has no provenance`);

// --- every family needs albedo + normal + roughness ------------------------
const setBytes = new Map();
for (const [fam, slug] of Object.entries(shipped)) {
  for (const [role, file] of [['albedo', `${slug}_albedo_1k.jpg`], ['normal', `${slug}_normal_1k.jpg`], ['rough', `${slug}_rough_512.jpg`]]) {
    const p = path.join(ASSETS, slug, file);
    if (!fs.existsSync(p)) { fail(`family '${fam}' has no ${role} map (${path.relative(ROOT, p)})`); continue; }
    setBytes.set(`${slug}/${file}`, fs.statSync(p).size);
  }
}

// --- the shared assets -----------------------------------------------------
for (const tile of Object.keys(SPEC.detail_normals.tiles)) {
  const p = path.join(ASSETS, 'detail', `detail_normal_${tile}_512.jpg`);
  if (!fs.existsSync(p)) fail(`detail-normal tile '${tile}' missing (${path.relative(ROOT, p)})`);
  else setBytes.set(`detail/${tile}`, fs.statSync(p).size);
}
for (const f of [SPEC.trim_atlas.file, SPEC.trim_atlas.normal, 'trim/trim_atlas_rough_2k.jpg']) {
  const p = path.join(ASSETS, f);
  if (!fs.existsSync(p)) fail(`trim atlas file missing (${path.relative(ROOT, p)})`);
  else setBytes.set(f, fs.statSync(p).size);
}

// --- licence and provenance -------------------------------------------------
for (const [fam, spec] of Object.entries(SPEC.families)) {
  if (spec.kind === 'cc0' && SPEC.cc0.licence !== 'CC0-1.0') fail(`family '${fam}': declared licence is not redistributable`);
  if (spec.kind === 'synth' && !spec.why) fail(`family '${fam}': a synthesised substitution must record why no CC0 set was usable`);
  if (spec.kind === 'variant' && !SPEC.families[spec.of]) fail(`family '${fam}': variant of unknown family '${spec.of}'`);
}

// --- texture memory budget --------------------------------------------------
// Decompressed GPU cost, which is what the budget is about: a JPEG's disk size is irrelevant once
// it is uploaded. RGBA8 + the full mip chain (x1.334).
const uniqueSlugs = [...new Set(Object.values(shipped))];
const px = (w) => w * w * 4 * 4 / 3;
const highBytes = uniqueSlugs.length * (px(1024) * 2 + px(512))            // albedo + normal + rough
  + Object.keys(SPEC.detail_normals.tiles).length * px(512)
  + 3 * (2048 * 1536 * 4 * 4 / 3);
const mediumBytes = highBytes / 4;                                          // half-resolution tier
const MB = (b) => b / 1048576;
if (MB(highBytes) > 320) fail(`texture memory at high is ${MB(highBytes).toFixed(0)} MB, over the 320 MB budget`);
if (MB(mediumBytes) > 120) fail(`texture memory at medium is ${MB(mediumBytes).toFixed(0)} MB, over the 120 MB budget`);

// --- no family left on the noise fallback ----------------------------------
for (const fam of declared) if (!shipped[fam]) fail(`family '${fam}' has no authored texture set — it would ship on the procedural fallback`);

// --- manifest ---------------------------------------------------------------
if (WRITE) {
  const assets = [];
  for (const slug of uniqueSlugs.sort()) {
    const spec = Object.values(SPEC.families).find(f => f.slug === slug);
    const maps = {};
    for (const [role, file] of [['albedo', `${slug}_albedo_1k.jpg`], ['normal', `${slug}_normal_1k.jpg`], ['rough', `${slug}_rough_512.jpg`]]) {
      const p = path.join(ASSETS, slug, file);
      if (fs.existsSync(p)) maps[role] = { file, sha256: sha256(fs.readFileSync(p)), bytes: fs.statSync(p).size };
    }
    assets.push({
      id: slug,
      kind: spec.kind,
      licence: spec.kind === 'cc0' ? 'CC0-1.0' : 'project-generated (tools/assets/synth-materials.mjs)',
      source: spec.kind === 'cc0' ? `https://polyhaven.com/a/${slug}` : 'tools/assets/synth-materials.mjs',
      author: spec.author || (spec.kind === 'cc0' ? 'Poly Haven contributor' : 'Elder Souls W1-30C'),
      why: spec.why || null,
      consumers: Object.entries(shipped).filter(([, s]) => s === slug).map(([f]) => f),
      maps,
    });
  }
  const shared = {};
  for (const tile of Object.keys(SPEC.detail_normals.tiles)) {
    const p = path.join(ASSETS, 'detail', `detail_normal_${tile}_512.jpg`);
    if (fs.existsSync(p)) shared[`detail_normal_${tile}`] = { file: `detail/detail_normal_${tile}_512.jpg`, sha256: sha256(fs.readFileSync(p)), bytes: fs.statSync(p).size, note: SPEC.detail_normals.tiles[tile] };
  }
  for (const f of [SPEC.trim_atlas.file, SPEC.trim_atlas.normal, 'trim/trim_atlas_rough_2k.jpg']) {
    const p = path.join(ASSETS, f);
    if (fs.existsSync(p)) shared[path.basename(f, '.jpg')] = { file: f, sha256: sha256(fs.readFileSync(p)), bytes: fs.statSync(p).size };
  }
  const manifest = {
    schema: 'elder-souls/production-asset-manifest@2',
    generated_by: 'node tools/assets/check-material-coverage.mjs --write',
    build_spec: 'tools/assets/material-library.json',
    licence: SPEC.cc0,
    conversion: SPEC.conversion,
    ktx2: {
      state: 'deferred',
      reason: 'Neither basisu nor toktx is installed on this host and neither is vendorable as a build dependency here. The budget is met without them by keeping roughness at 512 (see conversion.why_rough_at_512); the measured high-tier figure is recorded below. Reversal is one command per file once a KTX2 encoder exists.',
      measured_high_mb: +MB(highBytes).toFixed(1),
      measured_medium_mb: +MB(mediumBytes).toFixed(1),
      budget_high_mb: 320, budget_medium_mb: 120,
    },
    families: shipped,
    assets,
    shared,
  };
  fs.writeFileSync(path.join(ASSETS, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`manifest: ${assets.length} sets, ${Object.keys(shared).length} shared assets`);
}

const line = `material-coverage: ${Object.keys(shipped).length}/${declared.length} families authored, `
  + `${uniqueSlugs.length} texture sets, ${MB(highBytes).toFixed(0)} MB high / ${MB(mediumBytes).toFixed(0)} MB medium `
  + `— ${fails.length ? 'FAIL' : 'PASS'}`;
for (const w of warns) console.warn(`  warn  ${w}`);
for (const f of fails) console.error(`  FAIL  ${f}`);
console.log(line);
process.exit(fails.length ? 1 : 0);
