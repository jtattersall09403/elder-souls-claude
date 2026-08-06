#!/usr/bin/env node
// critic-owned field-level trace diff. No builder code involved.
import fs from 'node:fs';

function readTrace(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const header = lines[0];
  const footer = lines[lines.length - 1];
  const body = lines.slice(1, -1);
  return { header, footer, body };
}

function flatten(o, prefix, out) {
  if (o === null || typeof o !== 'object') { out[prefix] = o; return out; }
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) flatten(o[i], `${prefix}[${i}]`, out);
    if (o.length === 0) out[prefix] = '[]';
    return out;
  }
  for (const k of Object.keys(o)) flatten(o[k], prefix ? `${prefix}.${k}` : k, out);
  if (Object.keys(o).length === 0) out[prefix] = '{}';
  return out;
}

const [a, b] = process.argv.slice(2);
const A = readTrace(a), B = readTrace(b);
const n = Math.min(A.body.length, B.body.length);
const fieldCounts = {};
let framesDiffAny = 0, framesDiffExclSeed = 0;
const firstExample = {};
for (let i = 0; i < n; i++) {
  const fa = flatten(A.body[i], '', {});
  const fb = flatten(B.body[i], '', {});
  const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
  let any = false, exclSeed = false;
  for (const k of keys) {
    if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k])) {
      const norm = k.replace(/\[\d+\]/g, '[]');
      fieldCounts[norm] = (fieldCounts[norm] || 0) + 1;
      if (!firstExample[norm]) firstExample[norm] = { frame: i, a: fa[k], b: fb[k] };
      any = true;
      if (norm !== 'rng.seed') exclSeed = true;
    }
  }
  if (any) framesDiffAny++;
  if (exclSeed) framesDiffExclSeed++;
}
const maxDraws = t => t.body.reduce((m, r) => Math.max(m, (r.rng && r.rng.draws) || 0), 0);
const sumDraws = t => t.body.reduce((m, r) => m + ((r.rng && r.rng.draws) || 0), 0);
console.log(JSON.stringify({
  a, b,
  frames_compared: n,
  body_sha256: { a: A.footer.body_sha256, b: B.footer.body_sha256 },
  differing_fields: fieldCounts,
  first_example: firstExample,
  frames_differing_any: framesDiffAny,
  frames_differing_excluding_rng_seed: framesDiffExclSeed,
  pct_excluding_rng_seed: +(100 * framesDiffExclSeed / n).toFixed(3),
  max_rng_draws: { a: maxDraws(A), b: maxDraws(B) },
  sum_rng_draws: { a: sumDraws(A), b: sumDraws(B) },
}, null, 2));
