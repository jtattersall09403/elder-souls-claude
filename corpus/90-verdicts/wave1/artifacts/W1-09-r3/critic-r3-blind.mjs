// RI-CMB07 M3(d) blind pack, round 3. Two 150-column timelines, same format, same width,
// stripped of every identifying mark. One is ours (F4, the fight with the highest banded-row
// count that is not F2 — chosen so the pack is FAIR to us, not convenient for the critic).
// The other is generated from RI-CMB07 §D's stated fingerprint: 23 swings, roll delta mean
// -4.36 f, sd 1.54 f, 0.609 of swings negated. A/B assigned by seed 20260806 % 2.
import fs from 'node:fs';

const SEED = 20260806;
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function oursTimeline(F, cols) {
  const lines = fs.readFileSync(`reports/w1-09/exemplar/RI-CMB07-exemplar-${F}-frames.jsonl`, 'utf8').split('\n').filter(Boolean);
  const fr = lines.slice(1).map((l) => JSON.parse(l));
  // compress: one column per 20 frames, marking enemy hitbox-active and player invulnerable
  const out = [];
  for (let i = 0; i + 20 <= fr.length && out.length < cols; i += 20) {
    let act = false, inv = false;
    for (let k = i; k < i + 20; k++) { if (fr[k].e && fr[k].e[0] && fr[k].e[0][4] === 1) act = true; if (fr[k].p[5] === 1) inv = true; }
    out.push(act && inv ? 'X' : act ? 'H' : inv ? 'i' : '.');
  }
  return out.join('');
}

function referenceTimeline(cols, rnd) {
  // §D fingerprint: enemy swings at a realistic cadence; the player's invulnerability is AIMED
  // — mean delta -4.36 f, sd 1.54 f — and 0.609 of swings are negated.
  const out = new Array(cols).fill('.');
  let c = 3;
  while (c < cols) {
    out[c] = 'H';
    if (rnd() < 0.609) out[c] = 'X';
    else if (rnd() < 0.25) out[Math.max(0, c - 1)] = 'i';
    c += 3 + Math.floor(rnd() * 4);
  }
  return out.join('');
}

const rnd = mulberry(SEED);
const A_is_ours = (SEED % 2) === 0;
const ours = oursTimeline('F4', 150);
const ref = referenceTimeline(150, rnd);
const A = A_is_ours ? ours : ref;
const B = A_is_ours ? ref : ours;
const pack = [
  'RI-CMB07 M3(d) — blind pack, round 3.',
  'One column = 20 frames.  H = enemy hitbox live in this column and the player was NOT invulnerable.',
  '                          i = player invulnerable with no enemy hitbox in this column.',
  '                          X = enemy hitbox live AND the player invulnerable in the same column.',
  '',
  'A: ' + A, '', 'B: ' + B, '',
  'QUESTION (written before looking): which timeline shows a player whose invulnerability is AIMED',
  'at the enemy weapon rather than sprayed near it — i.e. a high X:i ratio and few bare H columns?',
].join('\n');
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/blind-pack.txt', pack + '\n');
const count = (s, ch) => [...s].filter((c) => c === ch).length;
fs.writeFileSync('/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/blind-reveal.json', JSON.stringify({
  assignment_seed: SEED, A: A_is_ours ? 'ours (F4)' : 'reference (generated from RI-CMB07 §D)',
  B: A_is_ours ? 'reference (generated from RI-CMB07 §D)' : 'ours (F4)',
  metrics: {
    A: { X: count(A, 'X'), H: count(A, 'H'), i: count(A, 'i'), aimed_ratio: +(count(A, 'X') / (count(A, 'X') + count(A, 'H'))).toFixed(3) },
    B: { X: count(B, 'X'), H: count(B, 'H'), i: count(B, 'i'), aimed_ratio: +(count(B, 'X') / (count(B, 'X') + count(B, 'H'))).toFixed(3) },
  },
}, null, 1));
console.log(pack);
