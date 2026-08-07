// analyse.mjs — reads ONLY the pack's trials.json. No reveal, no corpus, no browser.
// Declared under method_deviations for judge-audio-b2.
import { readFileSync } from 'node:fs';

const PACK = '/home/user/elder-souls-claude/reports/w1-22-critic/b2/trials.json';
const trials = JSON.parse(readFileSync(PACK, 'utf8'));

const bandKeys = Object.keys(trials[0].RECORDING_A.band_levels_db_rel_loudest);

function stats(t) {
  const A = t.RECORDING_A, B = t.RECORDING_B;
  const a = bandKeys.map(k => A.band_levels_db_rel_loudest[k]);
  const b = bandKeys.map(k => B.band_levels_db_rel_loudest[k]);
  const diffs = a.map((v, i) => Math.abs(v - b[i]));
  const mad = diffs.reduce((s, v) => s + v, 0) / diffs.length;
  const max = Math.max(...diffs);
  const argmax = bandKeys[diffs.indexOf(max)];
  const cA = A.spectral_centroid_hz, cB = B.spectral_centroid_hz;
  const dcent = Math.abs(cA - cB) / ((cA + cB) / 2);
  return {
    trial: t.trial,
    mad: +mad.toFixed(2), max: +max.toFixed(1), argmax,
    cA, cB, dcent: +dcent.toFixed(4),
    corrA: A.stereo_correlation, corrB: B.stereo_correlation,
    dcorr: +Math.abs(A.stereo_correlation - B.stereo_correlation).toFixed(3),
    crA: A.crest_factor_db, crB: B.crest_factor_db,
    dcrest: +Math.abs(A.crest_factor_db - B.crest_factor_db).toFixed(1),
    nOnA: A.transient_onsets.length, nOnB: B.transient_onsets.length,
    durA: A.duration_s, durB: B.duration_s,
    // signed band profile for reporting where the difference lives
    lowA: +(a.slice(0, 8).reduce((s, v) => s + v, 0) / 8).toFixed(1),
    lowB: +(b.slice(0, 8).reduce((s, v) => s + v, 0) / 8).toFixed(1),
    midA: +(a.slice(8, 16).reduce((s, v) => s + v, 0) / 8).toFixed(1),
    midB: +(b.slice(8, 16).reduce((s, v) => s + v, 0) / 8).toFixed(1),
    hiA: +(a.slice(16, 24).reduce((s, v) => s + v, 0) / 8).toFixed(1),
    hiB: +(b.slice(16, 24).reduce((s, v) => s + v, 0) / 8).toFixed(1),
  };
}

const S = trials.map(stats);

// PRE-REGISTERED RULE
const call = (s) => (s.mad < 1.5 && s.dcent < 0.05) ? 'SAME' : 'DIFFERENT';

console.log('=== per trial, in trial order ===');
console.log('trial  mad_dB  max_dB  dcent   dcorr  dcrest  centA  centB  onA onB  CALL');
for (const s of S) {
  console.log(
    `${s.trial}  ${String(s.mad).padStart(6)}  ${String(s.max).padStart(6)}  ${String(s.dcent).padStart(6)}  ${String(s.dcorr).padStart(5)}  ${String(s.dcrest).padStart(6)}  ${String(s.cA).padStart(5)}  ${String(s.cB).padStart(5)}  ${String(s.nOnA).padStart(2)} ${String(s.nOnB).padStart(3)}   ${call(s)}`);
}

console.log('\n=== sorted by mad_dB (gap inspection) ===');
[...S].sort((x, y) => x.mad - y.mad).forEach(s =>
  console.log(`${s.trial}  mad=${String(s.mad).padStart(6)}  max=${String(s.max).padStart(5)}  dcent=${String(s.dcent).padStart(6)}  -> ${call(s)}`));

const n = S.filter(s => call(s) === 'SAME').length;
console.log(`\nSAME called: ${n} / ${S.length}`);

console.log('\n=== degeneracy / leak audit on the data itself ===');
const durs = new Set(S.flatMap(s => [s.durA, s.durB]));
console.log('distinct duration_s:', [...durs]);
const onsetCounts = S.flatMap(s => [s.nOnA, s.nOnB]);
console.log('onset count range:', Math.min(...onsetCounts), '-', Math.max(...onsetCounts));
// any recording with every band floored?
let floored = 0;
for (const t of trials) for (const R of [t.RECORDING_A, t.RECORDING_B]) {
  const v = bandKeys.map(k => R.band_levels_db_rel_loudest[k]);
  if (v.every(x => x <= -119)) floored++;
}
console.log('recordings with all bands floored:', floored);
// decimal-precision tell: do SAME-ish and DIFFERENT-ish rows differ in float formatting?
const decimals = new Set();
for (const t of trials) for (const R of [t.RECORDING_A, t.RECORDING_B])
  for (const k of bandKeys) { const s = String(R.band_levels_db_rel_loudest[k]); decimals.add(s.includes('.') ? s.split('.')[1].length : 0); }
console.log('band-level decimal places seen:', [...decimals].sort());

console.log('\n=== band-region detail for the closest 12 ===');
[...S].sort((x, y) => x.mad - y.mad).slice(0, 12).forEach(s =>
  console.log(`${s.trial} low ${s.lowA}/${s.lowB}  mid ${s.midA}/${s.midB}  hi ${s.hiA}/${s.hiB}  worstband ${s.argmax} (${s.max} dB)`));

console.log('\n=== JSON ===');
console.log(JSON.stringify(S.map(s => ({ trial: s.trial, mad: s.mad, max: s.max, dcent: s.dcent, dcorr: s.dcorr, dcrest: s.dcrest, call: call(s) }))));
