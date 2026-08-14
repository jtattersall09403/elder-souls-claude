import fs from 'node:fs';
const j=JSON.parse(fs.readFileSync('/home/user/elder-souls-claude/reports/runpod-gpu/runs/shadow-budget/artifacts/shadow-casters/hw-budget/shadow-casters.json','utf8'));
const by={};
for(const r of j.rows){ if(!r.frame_ms) continue; (by[r.site]=by[r.site]||{})[r.arm]={ms:r.frame_ms.median,tris:r.shadow_load.casterTriangles,cast:r.flagged.cast}; }
console.log('SAME-CONFIGURATION REPEATS (identical casterTriangles AND identical flagged.cast)');
const pairs=[['base','terrain'],['terrain+canopy','terrain+canopy+geology']];
let spreads=[];
for(const site of Object.keys(by)){
  for(const [a,b] of pairs){
    const A=by[site][a],B=by[site][b];
    const same = A.tris===B.tris && A.cast===B.cast;
    const d=Math.abs(A.ms-B.ms);
    if(same) spreads.push(d);
    console.log(`  ${site.padEnd(18)} ${a} vs ${b}  identical-config=${same}  ${A.tris} tris  ${A.ms} vs ${B.ms} ms  spread ${d.toFixed(2)}`);
  }
}
spreads.sort((x,y)=>x-y);
console.log(`\n  same-config spreads: ${spreads.map(x=>x.toFixed(2)).join(', ')}   median ${spreads[Math.floor(spreads.length/2)].toFixed(2)}   max ${spreads[spreads.length-1].toFixed(2)} ms`);
console.log('\nWHAT THE CANOPY ACTUALLY COSTS, against the pair means');
for(const site of Object.keys(by)){
  const b=(by[site].base.ms+by[site].terrain.ms)/2;
  const c=(by[site]['terrain+canopy'].ms+by[site]['terrain+canopy+geology'].ms)/2;
  const e=by[site].everything.ms;
  const dt=by[site]['terrain+canopy'].tris-by[site].base.tris;
  const de=by[site].everything.tris-by[site].base.tris;
  console.log(`  ${site.padEnd(18)} base-pair ${b.toFixed(2)}  canopy-pair ${c.toFixed(2)}  delta ${(c-b>=0?'+':'')}${(c-b).toFixed(2)} ms for +${dt} tris   |  everything ${e.toFixed(2)} delta ${(e-b>=0?'+':'')}${(e-b).toFixed(2)} ms for +${de} tris`);
}
