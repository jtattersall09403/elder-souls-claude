#!/usr/bin/env node
/** Build the RI-WLD03 M13 blind pack as text SVGs; never writes binary evidence. */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto'; import { execFileSync } from 'node:child_process';
const ROOT=path.resolve(import.meta.dirname,'../..'), OUT=path.join(ROOT,'reports/packs/w1-04-m13'), REV=path.join(ROOT,'reports/packs/w1-04-m13.reveal');
fs.rmSync(OUT,{recursive:true,force:true}); fs.rmSync(REV,{recursive:true,force:true}); fs.mkdirSync(OUT,{recursive:true}); fs.mkdirSync(REV,{recursive:true});
const docs=fs.readdirSync(path.join(ROOT,'game/data/world/settlements')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(ROOT,'game/data/world/settlements',f))));
const labels=['A','B','C','D','E','F','G','H']; const order=[3,0,6,2,7,4,1,5];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const rows=[];
for(let n=0;n<8;n++){
 const d=docs[order[n]], bs=d.buildings.filter(b=>Array.isArray(b.door)); const xs=bs.map(b=>b.door[0]),zs=bs.map(b=>b.door[2]); const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2, span=Math.max(20,Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs))*1.25;
 const rects=bs.map((b,i)=>{const x=256+(b.door[0]-cx)*440/span,z=256+(b.door[2]-cz)*440/span,w=8+(i%4)*3,h=7+((i*3)%5)*2;return `<rect x="${(x-w/2).toFixed(1)}" y="${(z-h/2).toFixed(1)}" width="${w}" height="${h}" transform="rotate(${b.yaw_deg||0} ${x.toFixed(1)} ${z.toFixed(1)})"/>`}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f2eee4"/><g fill="#292a27" stroke="#f2eee4" stroke-width="1">${rects}</g></svg>\n`;
 const file=`plan-${labels[n]}.svg`; fs.writeFileSync(path.join(OUT,file),svg); rows.push({slot:labels[n],file,sha256:crypto.createHash('sha256').update(svg).digest('hex'),bytes:Buffer.byteLength(svg)});
}
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim();
const manifest={schema:'RI-WLD03-M13-blind-pack-v1',commit,prompt:'For each plan, in one sentence: who holds power here, and what does this place make or do?',instructions:['Judge plan-A.svg through plan-H.svg without opening the reveal directory.','Record one sentence per slot. Do not inspect filenames outside this pack.','A separate reference-sort fixture is sibling/reference-owned and is explicitly pending; do not infer its score from these eight.'],ours:rows,judgement:{status:'not_run',required_correct:6,total:8,independent_judge_required:true},tell_audit:{labels_icons_ui:'absent',settlement_names:'absent',slot_filenames_only:true,uniform_canvas:'512x512',uniform_palette:true,svg_metadata:'none'}};
fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(OUT,'JUDGE.md'),'# RI-WLD03 M13 independent judgement\n\nOpen only this directory. Review `manifest.json`, then the eight SVG plans. Write one sentence per slot answering the prompt. Do not open `../w1-04-m13.reveal/` until answers are locked. Score substantial agreement against the reveal; ≥6/8 passes the owned layout-reading leg. The 16-way Morrowind median-rank leg remains `not_run` until the separately licensed reference fixture is supplied; do not self-fill it.\n');
fs.writeFileSync(path.join(REV,'mapping.json'),JSON.stringify({commit,mapping:Object.fromEntries(labels.map((x,i)=>[x,{id:docs[order[i]].id,power_reading:docs[order[i]].power_reading}]))},null,2)+'\n');
for(const dir of [OUT,REV]){const hashes=fs.readdirSync(dir).sort().map(f=>`${crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex')}  ${f}`).join('\n')+'\n';fs.writeFileSync(path.join(dir,'SHA256SUMS'),hashes)}
console.log(`built ${rows.length}/8 blind plans at ${path.relative(ROOT,OUT)}; judgement not_run`);
