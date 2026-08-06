#!/usr/bin/env node
// CRITIC-OWNED probe: save round-trip sweep at critic-chosen seeds.
// Round trip is re-derived host-side from saveState()'s own bytes; canonicalisation and
// diffing are implemented here, independent of anything in game/ or tools/harness/.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const methods = await page.evaluate(() => Object.keys(window.__HARNESS).sort());

// critic-chosen seeds: primes, powers of two, adversarial bit patterns. None of these
// appear in tools/harness/seed-sweep.mjs (checked: that tool's list is builder-chosen).
const SEEDS = [90210, 8675309, 271828, 999983, 1, 2, 3, 2147483647, 4294967295, 65536,
               123456789, 31337, 777, 5150, 24601, 112358, 999999937, 42424242, 7, 100003];
const STATES = ['arena_flat', 'swamp_canopy'];

function canon(v) {
  // deterministic JSON: sorted keys, no whitespace
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
function flat(o, p, out) {
  if (o === null || typeof o !== 'object') { out[p] = o; return out; }
  if (Array.isArray(o)) { o.forEach((x, i) => flat(x, `${p}[${i}]`, out)); if (!o.length) out[p] = '[]'; return out; }
  const ks = Object.keys(o); if (!ks.length) { out[p] = '{}'; return out; }
  for (const k of ks) flat(o[k], p ? `${p}.${k}` : k, out); return out;
}
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

const VOLATILE = ['volatile.'];
const results = [];
for (const seed of SEEDS) {
  for (const state of STATES) {
    const r = await page.evaluate(async ({ seed, state }) => {
      const H = window.__HARNESS;
      H.setSeed(seed);
      H.loadState(state);
      H.stepFrames(120);
      const blob0 = JSON.parse(JSON.stringify(H.saveState()));
      const hash0 = H.getStateHash ? H.getStateHash() : null;
      H.loadState(blob0);
      const blob1 = JSON.parse(JSON.stringify(H.saveState()));
      const hash1 = H.getStateHash ? H.getStateHash() : null;
      H.loadState(blob1);
      const blob2 = JSON.parse(JSON.stringify(H.saveState()));
      const hash2 = H.getStateHash ? H.getStateHash() : null;
      return { blob0, blob1, blob2, hash0, hash1, hash2 };
    }, { seed, state });

    const c0 = canon(r.blob0), c1 = canon(r.blob1), c2 = canon(r.blob2);
    const f0 = flat(r.blob0, '', {}), f1 = flat(r.blob1, '', {});
    const keys = new Set([...Object.keys(f0), ...Object.keys(f1)]);
    const diff = {};
    for (const k of keys) if (JSON.stringify(f0[k]) !== JSON.stringify(f1[k])) diff[k] = [f0[k], f1[k]];
    const nonVolatileDiff = Object.fromEntries(Object.entries(diff).filter(([k]) => !VOLATILE.some(v => k.startsWith(v))));
    // find the rng words wherever they live
    const rngWords = Object.entries(f0).filter(([k]) => /rng.*\.[abcd]$/.test(k)).map(([k, v]) => [k, v]);
    results.push({
      seed, state,
      host_canon_sha_trip1: sha(c0) === sha(c1),
      host_canon_sha_trip2: sha(c1) === sha(c2),
      game_hash_equal_trip1: r.hash0 === r.hash1,
      game_hash_equal_trip2: r.hash1 === r.hash2,
      hashes: [r.hash0, r.hash1, r.hash2],
      diff_fields: Object.keys(diff),
      non_volatile_diff: nonVolatileDiff,
      live_rng_words: rngWords,
      live_words_all_uint32: rngWords.every(([, v]) => typeof v === 'number' && v >= 0 && v <= 4294967295 && Number.isInteger(v)),
    });
  }
}
const summary = {
  methods_count: methods.length,
  methods,
  seeds: SEEDS, states: STATES,
  trials: results.length,
  first_trip_mismatches_hostcanon: results.filter(r => !r.host_canon_sha_trip1).length,
  first_trip_mismatches_gamehash: results.filter(r => !r.game_hash_equal_trip1).length,
  second_trip_mismatches_gamehash: results.filter(r => !r.game_hash_equal_trip2).length,
  trials_live_words_all_uint32: results.filter(r => r.live_words_all_uint32).length,
  trials_with_non_volatile_diff: results.filter(r => Object.keys(r.non_volatile_diff).length).length,
  results,
};
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  methods_count: summary.methods_count,
  trials: summary.trials,
  first_trip_mismatches_hostcanon: summary.first_trip_mismatches_hostcanon,
  first_trip_mismatches_gamehash: summary.first_trip_mismatches_gamehash,
  second_trip_mismatches_gamehash: summary.second_trip_mismatches_gamehash,
  trials_live_words_all_uint32: summary.trials_live_words_all_uint32,
  trials_with_non_volatile_diff: summary.trials_with_non_volatile_diff,
}, null, 2));
await h.close();
