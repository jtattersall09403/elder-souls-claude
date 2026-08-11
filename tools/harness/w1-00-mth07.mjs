#!/usr/bin/env node
// Fail-closed aggregate for W1-00's RI-MTH07 census. This deliberately does not manufacture
// coupling numbers: native producers must have written all four item-native values and coupling.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const value = (flag, fallback) => { const i = argv.indexOf(flag); return i < 0 ? fallback : argv[i + 1]; };
const censusPath = path.resolve(value('--census', path.join(ROOT, 'tools/harness/w1-00-mth07-census.json')));
const outPath = path.resolve(value('--out', path.join(ROOT, 'reports/w1-00-codex-builder-sweep/mth07/aggregate.json')));
const allowMissing = argv.includes('--census-only');
const census = JSON.parse(fs.readFileSync(censusPath, 'utf8'));
const failures = [];
const requiredIds = ['seeded-prng-stream', 'fixed-step-integrator', 'catch-up-cap', 'durable-save-projection'];
for (const id of requiredIds) if (!census.models.some((m) => m.id === id)) failures.push(`census missing ${id}`);
for (const m of census.models) {
  for (const k of ['producer', 'consumer', 'entity_observable', 'treatment', 'null', 'evidence']) if (!m[k]) failures.push(`${m.id}: missing ${k}`);
  if (/trace|probe|census/i.test(m.consumer) || !/game\/src\//.test(m.consumer)) failures.push(`${m.id}: consumer is not a named shipping game/src call site`);
}
if (!Array.isArray(census.declared_instrumentation) || census.declared_instrumentation.length < 3) failures.push('trace/instrumentation debt is not declared');
if (!census.hand_feed_audit || census.hand_feed_audit.result !== 'none') failures.push('hand-feed audit unresolved');
if (!Array.isArray(census.partial_world_harnesses)) failures.push('partial-world census absent');

const evidenceRows = [];
for (const m of census.models) {
  const p = path.resolve(ROOT, m.evidence);
  if (allowMissing) continue;
  if (!fs.existsSync(p)) { if (!allowMissing) failures.push(`${m.id}: missing native evidence ${m.evidence}`); continue; }
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  const native = Array.isArray(doc.rows) ? doc.rows.find((r) => r.id === m.id) : doc;
  if (!native) { failures.push(`${m.id}: native evidence has no matching row`); continue; }
  const flat = JSON.stringify(native);
  const missing = m.required_fields.filter((k) => !flat.includes(`"${k}"`));
  if (missing.length) failures.push(`${m.id}: evidence lacks item-native ${missing.join(', ')}`);
  if (!(Number(native.coupling) > 0) || native.pass === false) failures.push(`${m.id}: zero/failed coupling`);
  evidenceRows.push({
    model: m.id,
    evidence: m.evidence,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
  });
}
const report = { schema: 'elder-souls/w1-00-mth07-aggregate@1', census: path.relative(ROOT, censusPath), models: census.models.length, evidence: evidenceRows, census_only: allowMissing, failures, pass: failures.length === 0 };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = failures.length ? 1 : 0;
