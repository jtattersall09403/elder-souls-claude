#!/usr/bin/env node
// W1-30C critic — the AUTOMATIC arm of the `families are distinguishable` gate.
//
// READ THIS BEFORE QUOTING THE NUMBER. The plan's gate is a NAIVE HUMAN JUDGE shown twenty
// unlabelled close-ups, and this is not that. RULES.md rule 25 is explicit that a pack of features
// tests the features; an audio pack was voided for exactly this. So this tool is demoted to the
// same role W1-30-EVIDENCE.md gives M1-M12: **it can fail the build and it can never pass one.**
// The human gate is reported separately and is `not_run` until a judge who did not build the pack
// answers it.
//
// What it does: reads the 5x4 contact sheet, cuts the twenty tiles, builds a small appearance
// vector per tile, and asks two questions with a null control on both.
//
//   1. nearest-neighbour purity — is each family's closest-looking sibling in its declared class?
//   2. 6-way clustering agreement against MATERIAL_CLASSES, best-permutation matched.
//
// The null control is the noise-fallback sheet from the same run: if grouping does NOT fall on
// that arm, the measure is not measuring the materials and its result must be discarded.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import jpeg from '../../node_modules/jpeg-js/index.js';

const dir = path.resolve(process.argv[2] || 'reports/w1-30/C-critic/gpu2/artifacts/closeup');
const FAMILIES = ['mud', 'wet_mud', 'bark', 'leaf', 'reed', 'root', 'timber', 'clay', 'stone', 'salt',
  'bone', 'chitin', 'resin', 'cloth', 'skin', 'metal', 'water', 'shell', 'thorn', 'wet_chitin'];
const CLASSES = {
  soil: ['mud', 'wet_mud', 'clay'], wood: ['bark', 'root', 'timber', 'thorn'],
  foliage: ['leaf', 'reed'], mineral: ['stone', 'salt', 'metal'],
  carapace: ['chitin', 'wet_chitin', 'shell', 'bone', 'resin'], pliant: ['cloth', 'skin', 'water'],
};
const CLASS_OF = {};
for (const [c, fs_] of Object.entries(CLASSES)) for (const f of fs_) CLASS_OF[f] = c;

function tiles(file) {
  const im = jpeg.decode(fs.readFileSync(file), { useTArray: true });
  const TW = Math.round(im.width / 5), TH = Math.round(im.height / 4);
  return FAMILIES.map((fam, i) => {
    const cx = (i % 5) * TW, cy = Math.floor(i / 5) * TH;
    const px = [];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const o = ((cy + y) * im.width + (cx + x)) * 4;
      px.push([im.data[o], im.data[o + 1], im.data[o + 2]]);
    }
    return { fam, w: TW, h: TH, px };
  });
}
function vector(t) {
  const L = t.px.map(p => (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255);
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const mr = mean(t.px.map(p => p[0])) / 255, mg = mean(t.px.map(p => p[1])) / 255, mb = mean(t.px.map(p => p[2])) / 255;
  const mu = mean(L), sd = Math.sqrt(mean(L.map(v => (v - mu) ** 2)));
  // gradient energy at three scales: the crude "how fine is the grain" axis a person uses first
  const at = (x, y) => L[y * t.w + x];
  const grad = (step) => {
    let s = 0, n = 0;
    for (let y = step; y < t.h - step; y += step) for (let x = step; x < t.w - step; x += step) {
      s += Math.abs(at(x, y) - at(x - step, y)) + Math.abs(at(x, y) - at(x, y - step)); n++;
    }
    return s / (2 * n);
  };
  const chroma = Math.max(mr, mg, mb) - Math.min(mr, mg, mb);
  return [mu * 2, sd * 6, grad(1) * 30, grad(4) * 12, grad(16) * 8, chroma * 4, (mr - mb) * 3, (mg - (mr + mb) / 2) * 3];
}
const dist = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

function analyse(file) {
  if (!fs.existsSync(file)) return { error: `missing ${file}` };
  const V = tiles(file).map(t => ({ fam: t.fam, v: vector(t) }));
  // 1. nearest neighbour purity
  let pure = 0;
  const nn = {};
  for (const a of V) {
    let best = null, bd = Infinity;
    for (const b of V) { if (b.fam === a.fam) continue; const d = dist(a.v, b.v); if (d < bd) { bd = d; best = b.fam; } }
    nn[a.fam] = { nearest: best, d: +bd.toFixed(4), sameClass: CLASS_OF[best] === CLASS_OF[a.fam] };
    if (CLASS_OF[best] === CLASS_OF[a.fam]) pure++;
  }
  // chance rate for nearest-neighbour purity: mean over families of (classSize-1)/19
  const chance = FAMILIES.reduce((s, f) => s + (CLASSES[CLASS_OF[f]].length - 1) / 19, 0) / 20;
  // 2. deterministic 6-way agglomerative clustering (average linkage), then best-permutation match
  let clusters = V.map(a => [a]);
  while (clusters.length > 6) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      let s = 0, n = 0;
      for (const a of clusters[i]) for (const b of clusters[j]) { s += dist(a.v, b.v); n++; }
      if (s / n < bd) { bd = s / n; bi = i; bj = j; }
    }
    clusters[bi] = clusters[bi].concat(clusters[bj]); clusters.splice(bj, 1);
  }
  // greedy best assignment of clusters to declared classes by overlap.
  //
  // THIS NUMBER ALONE IS DEGENERATE AND THE FIRST VERSION OF THIS TOOL SHIPPED ON IT. On the noise
  // arm the clustering collapses to one 14-member blob plus five singletons — visibly a failure to
  // group — and greedy overlap still scored it 0.45, exactly the authored arm's number, because a
  // giant blob is guaranteed to contain most of whichever class it is matched to. Both arms agreed
  // about a false premise. It is kept, reported, and NOT used: the adjusted Rand index below is the
  // one that reads a degenerate partition as degenerate.
  const names = Object.keys(CLASSES);
  const pairs = [];
  for (let ci = 0; ci < clusters.length; ci++) for (const cl of names) {
    pairs.push({ ci, cl, hit: clusters[ci].filter(a => CLASS_OF[a.fam] === cl).length });
  }
  pairs.sort((a, b) => b.hit - a.hit);
  const usedC = new Set(), usedL = new Set(); let correct = 0;
  for (const p of pairs) { if (usedC.has(p.ci) || usedL.has(p.cl)) continue; usedC.add(p.ci); usedL.add(p.cl); correct += p.hit; }
  // Adjusted Rand index against the declared classes. 0 = chance, 1 = identical partition.
  const nC2 = n => (n * (n - 1)) / 2;
  let sumIJ = 0;
  const ai = clusters.map(c => c.length), bj = names.map(cl => CLASSES[cl].length);
  for (const c of clusters) for (const cl of names) sumIJ += nC2(c.filter(a => CLASS_OF[a.fam] === cl).length);
  const sumA = ai.reduce((s, n) => s + nC2(n), 0), sumB = bj.reduce((s, n) => s + nC2(n), 0);
  const exp = (sumA * sumB) / nC2(20), max = (sumA + sumB) / 2;
  const ari = (sumIJ - exp) / (max - exp);
  return {
    nn_purity: +(pure / 20).toFixed(3), nn_chance: +chance.toFixed(3), nn,
    cluster_agreement_DEGENERATE: +(correct / 20).toFixed(3),
    adjusted_rand_index: +ari.toFixed(3),
    largest_cluster: Math.max(...ai),
    clusters: clusters.map(c => c.map(a => a.fam).sort()),
  };
}

const out = {
  schema: 'elder-souls/w1-30c-grouping-tripwire@2',
  role: 'TRIPWIRE ONLY — it can fail the build and can never pass one. The plan\'s gate is a naive human judge; that gate is reported not_run.',
  bar_for_the_human_gate: 0.80,
  authored: analyse(path.join(dir, 'family-closeup-full.jpg')),
  noise_control: analyse(path.join(dir, 'family-closeup-noise-control.jpg')),
  // The plan's OWN null control for this gate is "render all 20 with one texture set", which the
  // builder's noise arm is not: the noise arm keeps every family's own hash seed, and both arms
  // keep family colour, roughness, metalness and the shared class detail tile. Pass the directory
  // holding a one-texture-set sheet as argv[3] to add the control the plan actually specifies.
  one_texture_set_control: process.argv[3] ? analyse(path.join(path.resolve(process.argv[3]), 'family-closeup-full.jpg')) : null,
};
const ari = a => (a && typeof a.adjusted_rand_index === 'number') ? a.adjusted_rand_index : null;
out.noise_control_falls = (ari(out.authored) != null && ari(out.noise_control) != null)
  ? ari(out.noise_control) < ari(out.authored) : null;
out.one_texture_control_falls = (ari(out.authored) != null && ari(out.one_texture_set_control) != null)
  ? ari(out.one_texture_set_control) < ari(out.authored) : null;
const dest = path.join(dir, '..', 'grouping-tripwire.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
const line = (n, a) => a && !a.error && console.log(`${n.padEnd(22)} nn-same-class ${a.nn_purity} (chance ${a.nn_chance})  ARI ${a.adjusted_rand_index}  largest cluster ${a.largest_cluster}  [degenerate greedy score ${a.cluster_agreement_DEGENERATE}]`);
line('authored', out.authored);
line('noise control', out.noise_control);
line('one-texture-set ctl', out.one_texture_set_control);
console.log(`noise control falls: ${out.noise_control_falls};  one-texture-set control falls: ${out.one_texture_control_falls}`);
console.log('\nfamilies whose nearest look-alike is in a DIFFERENT declared class:');
for (const [f, r] of Object.entries(out.authored.nn)) if (!r.sameClass) console.log(`  ${f.padEnd(12)} -> ${r.nearest} (${CLASS_OF[f]} vs ${CLASS_OF[r.nearest]}), d=${r.d}`);
console.log(`\n-> ${dest}`);
