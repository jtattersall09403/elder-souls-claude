#!/usr/bin/env node
// W1-30 shipped-asset gate. Rewritten by W1-30C for production-asset-manifest@2.
//
// The previous version validated the three-texture-set library and the 256 px generated albedo
// atlas that replaced it; both are gone, so it validated files that no longer exist and tokens that
// no longer appear in visual-foundation.js. It is kept at this path because other pieces run it by
// name. What it checks now:
//
//   - the manifest's licence is redistributable and routed to the official source;
//   - every file the manifest names exists and hashes to what the manifest says;
//   - every one of the twenty families resolves to a set, so nothing ships on the noise fallback;
//   - the shipping consumer really reads these maps (token check against visual-foundation.js);
//   - a synthesised substitution records why no CC0 set was usable.
'use strict';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '../..');
const ASSETS = path.join(root, 'game/assets/w1-30/materials');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSETS, 'manifest.json'), 'utf8'));
const fail = [], seen = [];
const hashOf = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

if (manifest.schema !== 'elder-souls/production-asset-manifest@2') fail.push(`unexpected manifest schema '${manifest.schema}'`);
if (manifest.licence?.licence !== 'CC0-1.0' || !String(manifest.licence?.source).startsWith('https://polyhaven.com/')) {
  fail.push('asset licence is absent or not routed to the official source');
}

for (const a of manifest.assets || []) {
  if (a.kind === 'synth' && !a.why) fail.push(`${a.id}: synthesised substitution with no recorded reason`);
  if (!a.consumers?.length) fail.push(`${a.id}: no consumer families — an orphan in the library`);
  for (const [role, row] of Object.entries(a.maps || {})) {
    const file = path.join(ASSETS, a.id, row.file);
    if (!fs.existsSync(file)) { fail.push(`${a.id}:${role} absent (${row.file})`); continue; }
    const hash = hashOf(file);
    if (hash !== row.sha256) fail.push(`${a.id}:${role} hash ${hash} != manifest ${row.sha256}`);
    seen.push({ id: a.id, role, bytes: fs.statSync(file).size, sha256: hash });
  }
  for (const role of ['albedo', 'normal', 'rough']) if (!a.maps?.[role]) fail.push(`${a.id}: no ${role} map — the family would read as flat plastic`);
}

for (const [id, row] of Object.entries(manifest.shared || {})) {
  const file = path.join(ASSETS, row.file);
  if (!fs.existsSync(file)) { fail.push(`shared:${id} absent (${row.file})`); continue; }
  const hash = hashOf(file);
  if (hash !== row.sha256) fail.push(`shared:${id} hash ${hash} != manifest ${row.sha256}`);
  seen.push({ id, role: 'shared', bytes: fs.statSync(file).size, sha256: hash });
}

const foundation = fs.readFileSync(path.join(root, 'game/src/render/visual-foundation.js'), 'utf8');
for (const token of ['FAMILY_SET', 'TextureLoader', 'normalMap: options.normalMap', 'roughnessMap: tiled(', '_albedo_1k.jpg', '_normal_1k.jpg', '_rough_512.jpg', 'detailNormalTile', 'trimAtlasTextures', 'markFamilyAssetFailure']) {
  if (!foundation.includes(token)) fail.push(`shipping material consumer missing ${token}`);
}
const families = Object.keys(manifest.families || {});
if (families.length !== 20) fail.push(`manifest names ${families.length} families, expected 20`);
for (const [fam, slug] of Object.entries(manifest.families || {})) {
  if (!manifest.assets.some(a => a.id === slug)) fail.push(`family '${fam}' points at set '${slug}' which the manifest does not carry`);
}

const budget = manifest.ktx2 || {};
if (budget.measured_high_mb > budget.budget_high_mb) fail.push(`texture memory ${budget.measured_high_mb} MB over the ${budget.budget_high_mb} MB high budget`);

const result = {
  schema: 'elder-souls/w1-30-assets@4',
  result: fail.length ? 'RED' : 'GREEN',
  licence: manifest.licence,
  families: families.length,
  sets: manifest.assets.length,
  files: seen.length,
  bytes: seen.reduce((n, x) => n + x.bytes, 0),
  textureMemoryMB: { high: budget.measured_high_mb, medium: budget.measured_medium_mb },
  consumers: manifest.assets.map(a => ({ id: a.id, kind: a.kind, consumers: a.consumers })),
  failures: fail,
};
console.log(JSON.stringify(result, null, 2));
if (fail.length) process.exit(1);
