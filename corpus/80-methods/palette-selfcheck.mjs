#!/usr/bin/env node
import fs from 'node:fs';import {hexLab,deltaE2000} from './lib/colour.mjs';
const vfx=JSON.parse(fs.readFileSync('game/data/magic/vfx.json','utf8'));
const forbidden=vfx.forbidden_anchors.flatMap(x=>x.match(/^#[0-9a-f]{6}/i)||[]);
const bi=process.argv.indexOf('--break-core');const broken=bi>=0?String(process.argv[bi+1]||''):null;
if(broken){if(!vfx.palette[broken]){console.error(`unknown --break-core school: ${broken}`);process.exit(2);}vfx.palette[broken].core=forbidden[0];}
// MAG05's hard fail says "any spell CORE"; decay/residue deliberately approach dark surface
// colours and are not cores. VIS05's region self-check is independently guarded by its three
// recorded tightest pairs, reproduced here to detect formula or swatch drift.
const declared=Object.entries(vfx.palette).map(([id,p])=>({source:`MAG05:${id}`,slot:'core',hex:p.core}));
const visKnown=[['#6A745E','#808080',13.4],['#8E9377','#808080',13.9],['#554636','#8B4513',17.2]];
const pairs=declared.map(d=>{let nearest=null;for(const f of forbidden){const de=deltaE2000(hexLab(d.hex),hexLab(f));if(!nearest||de<nearest.deltaE2000)nearest={forbidden:f,deltaE2000:+de.toFixed(3)};}return{...d,...nearest,pass:nearest.deltaE2000>13};});
for(const [hex,f,expected] of visKnown){const de=deltaE2000(hexLab(hex),hexLab(f));pairs.push({source:'VIS05:recorded-tightest',slot:'declared self-check',hex,forbidden:f,deltaE2000:+de.toFixed(3),expected,pass:de>13&&Math.abs(de-expected)<.2});}
const report={schema:'elder-souls/palette-selfcheck@1',metric:'CIEDE2000 D65',threshold:'strictly > 13',activeSabotage:broken,declared_n:declared.length,forbidden_n:forbidden.length,tightest:pairs.sort((a,b)=>a.deltaE2000-b.deltaE2000).slice(0,12),failures:pairs.filter(x=>!x.pass),result:pairs.every(x=>x.pass)?'GREEN':'RED'};console.log(JSON.stringify(report,null,process.argv.includes('--json')?2:0));process.exit(report.result==='GREEN'?0:20);
