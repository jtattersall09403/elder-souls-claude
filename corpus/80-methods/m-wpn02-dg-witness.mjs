#!/usr/bin/env node
// m-wpn02-dg-witness.mjs
//
// The reachability witness for RI-WPN02 §D's `Dg_min >= 1.0`, ruled by
// BAR-CRITIQUE-W1-10-R1 §R1. Run it whenever RI-WPN02 §B is retuned:
//
//     node corpus/80-methods/m-wpn02-dg-witness.mjs
//
// It reproduces, from RI-WPN02 §B and RI-WPN04 §A alone:
//   * the four defect measurements the ruling rests on
//   * the witness Dg_min = 1.4445 under the repaired nine-dimension set
//
// It is NOT a measurement of the build. It measures the BAR. A bar critic that
// rules a threshold reachable without producing a witness has done the same thing
// as a builder who curve-fits, so the witness lives in the corpus, executable.

// code: [r1 startup, r1 active, r1 recovery, arc(r1.1), max_chain, root(r1.1), reach, MV, poise, stamina, tier]
const B = {
DGR:[12, 6,24, 70,4,0.15,1.05,0.72, 8,12,1], FST:[14, 4,26, 45,5,0.10,0.90,0.55, 5, 9,1],
CSW:[20,10,34,155,4,0.30,1.75,0.90,16,17,1], TSW:[22, 8,36, 10,3,0.65,2.20,0.95,12,16,1],
SSW:[24,10,40,110,3,0.35,1.95,1.00,22,20,1], SPR:[28, 8,44,  8,3,0.55,3.10,1.00,18,18,2],
AXE:[32,12,48,130,3,0.30,1.80,1.15,28,24,2], MCE:[34,12,50, 95,3,0.28,1.70,1.20,32,25,2],
HLB:[38,14,56,145,3,0.45,2.85,1.25,34,28,2], WHP:[40,10,58,200,3,0.20,3.60,0.80, 6,22,2],
GSW:[44,16,66,175,3,0.85,2.60,1.45,42,32,3], CGS:[48,18,70,340,2,0.70,2.75,1.35,38,34,3],
GHM:[52,16,80,120,2,0.60,2.30,1.60,52,38,3], UGS:[58,20,88,210,3,1.40,2.95,1.75,58,42,4],
};
// The witness chain design. Consistent with every §A role and §C class rule; nothing
// here contradicts a published §B cell. Arcs, roots and shapes per chain link.
const CHAIN = {
DGR:[[70,60,85,55],[0.15,0.12,0.20,0.10],['slash_d','thrust','slash_d','thrust']],
FST:[[45,45,50,45,60],[0.10,0.10,0.08,0.10,0.25],['smash','smash','smash','smash','smash']],
CSW:[[155,165,145,180],[0.30,0.25,0.30,0.45],['slash_h','slash_h','slash_d','sweep']],
TSW:[[10,10,14],[0.65,0.60,0.85],['thrust','thrust','thrust']],
SSW:[[110,105,95],[0.35,0.30,0.40],['slash_h','slash_h','slash_v']],
SPR:[[8,8,12],[0.55,0.50,0.75],['thrust','thrust','thrust']],
AXE:[[130,135,90],[0.30,0.28,0.55],['slash_d','slash_d','slash_v']],
MCE:[[95,90,110],[0.28,0.26,0.30],['smash','smash','smash']],
HLB:[[145,150,20],[0.45,0.40,0.90],['sweep','sweep','thrust']],
WHP:[[200,210,190],[0.20,0.18,0.22],['lash','lash','lash']],
GSW:[[175,180,150],[0.85,0.75,0.95],['slash_d','slash_d','slash_v']],
CGS:[[340,360],[0.70,0.55],['spin','spin']],
GHM:[[120,80],[0.60,1.05],['smash','smash']],
UGS:[[210,200,160],[1.40,1.20,1.90],['slash_v','slash_h','slash_v']],
};
const N = Object.keys(B);
const z = v => { const m = v.reduce((a,b)=>a+b,0)/v.length;
  const s = Math.sqrt(v.reduce((a,b)=>a+(b-m)**2,0)/v.length);
  return s===0 ? v.map(()=>0) : v.map(x=>(x-m)/s); };
const corr = (a,b) => { const za=z(a), zb=z(b); return za.reduce((s,x,i)=>s+x*zb[i],0)/a.length; };
const minPair = dims => { const Z=dims.map(z); let best=Infinity, bp=null, all=[];
  for (let i=0;i<N.length;i++) for (let j=i+1;j<N.length;j++) {
    let s=0; for (const d of Z) s+=(d[i]-d[j])**2; const dd=Math.sqrt(s);
    all.push(dd); if (dd<best){best=dd; bp=`${N[i]}-${N[j]}`;} }
  all.sort((a,b)=>a-b); return {min:best, pair:bp, med:all[all.length>>1]}; };

const D2 = N.map(c=>B[c][2]/B[c][0]), D4 = N.map(c=>B[c][4]), D5 = N.map(c=>B[c][6]),
      D6 = N.map(c=>B[c][3]), D7 = N.map(c=>B[c][5]), tier = N.map(c=>B[c][10]);
const G7 = N.map(c=>{const a=CHAIN[c][0]; return Math.max(...a)-Math.min(...a);});
const G8 = N.map(c=>new Set(CHAIN[c][2]).size);
const G9 = N.map(c=>{const r=CHAIN[c][1]; return r.reduce((a,b)=>a+b,0)/(r.length*r[0]);});
// D11: the narratable monotone ladder from the ruling, counts of the mandatory 25.
const LADDER = {FST:0,DGR:0,CSW:0,TSW:2,SSW:4,SPR:6,AXE:8,MCE:8,WHP:8,HLB:10,GSW:14,CGS:16,GHM:18,UGS:20};
const D11 = N.map(c=>LADDER[c]/25);

console.log('DEFECT 1 — what Dg excluded, and how mass-correlated it really is (14 melee):');
console.log('  reach        vs weight tier :', corr(D5, tier).toFixed(3), '  <-- weakest, and it was excluded');
console.log('  motion value vs weight tier :', corr(N.map(c=>B[c][7]), tier).toFixed(3));
console.log('  poise damage vs weight tier :', corr(N.map(c=>B[c][8]), tier).toFixed(3));
console.log('  stamina      vs weight tier :', corr(N.map(c=>B[c][9]), tier).toFixed(3));

const reachAll = D5.concat([22.0]);
const span = v => { const zz=z(v); return Math.max(...zz.slice(0,14))-Math.min(...zz.slice(0,14)); };
console.log('\nDEFECT 2 — BOW inside the z-normalisation population:');
console.log('  melee reach z-span, BOW included :', span(reachAll).toFixed(3));
console.log('  melee reach z-span, BOW excluded :', span(D5).toFixed(3));
console.log('  discrimination lost              :', (span(D5)/span(reachAll)).toFixed(2)+'x');

console.log('\nDEFECT 3 / THE WITNESS — Dg_min over the 14 melee classes:');
const rows = [
  ['as published (D2,D4,D6,D7,D11)      ', [D2,D4,D6,D7,D11]],
  ['+ reach only                        ', [D2,D4,D5,D6,D7,D11]],
  ['+ chain grammar only                ', [D2,D4,D6,D7,D11,G7,G8,G9]],
  ['REPAIRED nine GRAMMAR_DIMS          ', [D2,D4,D5,D6,D7,D11,G7,G8,G9]],
];
for (const [label, dims] of rows) { const r = minPair(dims);
  console.log(`  ${label}: Dg_min ${r.min.toFixed(4)}  (${r.pair})   Dg_med ${r.med.toFixed(3)}`); }
const w = minPair(rows[3][1]);
console.log('\n  PASS BAR Dg_min >= 1.0 :', w.min >= 1.0 ? 'REACHED, with '+(w.min-1.0).toFixed(4)+' of headroom'
  : 'NOT REACHED — the ruling reopens (BAR-CRITIQUE-W1-10-R1 §R1)');
console.log('  chain_shape_count >= 2 :', G8.filter(x=>x>=2).length, 'of 14 (need 7)');
console.log('  chain_arc_range  >= 20 :', G7.filter(x=>x>=20).length, 'of 14 (need 10)');
