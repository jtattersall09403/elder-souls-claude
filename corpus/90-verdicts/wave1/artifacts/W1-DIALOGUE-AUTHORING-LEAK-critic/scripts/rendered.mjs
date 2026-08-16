import fs from 'node:fs'; import path from 'node:path';
const R='/home/user/elder-souls-claude/';
// Strings the player can actually READ, collected by the shape the consumer reads them in.
// Traced in: game/src/character/converse.js (greetingFor/say/topics/extras),
// game/src/sim/quest/refusal.js (FactionRefusals.speak), game/src/ui/screens/text.js (books).
const out=[];
function J(p){return JSON.parse(fs.readFileSync(R+p,'utf8'));}
function walk(d,out=[]){for(const f of fs.readdirSync(R+d)){const rel=d+'/'+f; if(fs.statSync(R+rel).isDirectory())walk(rel,out); else if(f.endsWith('.json'))out.push(rel);}return out;}
// greetings.json pools
for(const [i,p] of J('game/data/dialogue/greetings.json').pools.entries())
  (p.lines||[]).forEach((l,j)=>out.push({src:`greetings.json pools[${i}].lines[${j}]`,t:l}));
// greetings/** .x
for(const f of walk('game/data/dialogue/greetings')){const d=J(f);
  (function rec(v,kp){if(typeof v==='string')return; if(Array.isArray(v))v.forEach((x,i)=>rec(x,`${kp}[${i}]`)); else if(v&&typeof v==='object'){for(const k of Object.keys(v)){ if(k==='x'&&typeof v[k]==='string')out.push({src:`${f}${kp}.x`,t:v[k]}); else rec(v[k],`${kp}.${k}`);} }})(d,'');}
// topics/** infos[].x and topic .name
for(const f of walk('game/data/dialogue/topics')){const d=J(f);
  for(const t of (d.topics||[])){ if(typeof t.name==='string')out.push({src:`${f} ${t.id}.name`,t:t.name});
    for(const [k,inf] of (t.infos||[]).entries()) if(typeof inf.x==='string')out.push({src:`${f} ${t.id}.infos[${k}].x`,t:inf.x}); }}
// rumours .x, road-directions .text, creation-questions .text, slavery-lines
for(const f of ['game/data/dialogue/rumours.json','game/data/dialogue/road-directions.json','game/data/dialogue/creation-questions.json','game/data/dialogue/creation-names.json','game/data/dialogue/slavery-lines.json','game/data/dialogue/topic-graph.json'])
  { if(!fs.existsSync(R+f))continue; (function rec(v,kp){ if(typeof v==='string'){ if(/\.(x|text|line|lines|a)(\[\d+\])?$/.test(kp)) out.push({src:f+kp,t:v}); return;} if(Array.isArray(v))v.forEach((x,i)=>rec(x,`${kp}[${i}]`)); else if(v&&typeof v==='object')for(const k of Object.keys(v))rec(v[k],`${kp}.${k}`);})(J(f),''); }
// faction-refusals spoken lines (keys NOT in the builder's whitelist)
{const d=J('game/data/dialogue/faction-refusals.json');
 for(const [fid,rec] of Object.entries(d.factions||{})) for(const [k,v] of Object.entries(rec)) if(typeof v==='string')out.push({src:`faction-refusals.json factions.${fid}.${k}`,t:v});
 for(const [k,v] of Object.entries(d.not_joinable||{})) if(typeof v==='string')out.push({src:`faction-refusals.json not_joinable.${k}`,t:v});
 if(typeof d.unknown_faction==='string')out.push({src:'faction-refusals.json unknown_faction',t:d.unknown_faction});}
// books: text/title/author on real records
for(const f of walk('game/data/books')){const d=J(f); for(const b of (d.books||[])) for(const k of ['text','title','author']) if(typeof b[k]==='string')out.push({src:`${f} ${b.id}.${k}`,t:b[k]});}
// npc greetings / spoken fields
for(const f of walk('game/data/npcs')){const d=J(f); (function rec(v,kp,key){ if(typeof v==='string'){ if(/^(greeting|line|lines|x|text|say|barks?)$/.test(key))out.push({src:f+kp,t:v}); return;} if(Array.isArray(v))v.forEach((x,i)=>rec(x,`${kp}[${i}]`,key)); else if(v&&typeof v==='object')for(const k of Object.keys(v))rec(v[k],`${kp}.${k}`,k);})(d,'','');}

console.log(`RENDERED STRINGS COLLECTED: ${out.length}`);
const PAT=[
 [/\bsay it in one line\b/i,'the known leak'],
 [/\b(TODO|FIXME|XXX|HACK|WIP|TBD)\b/,'marker'],
 [/\bplaceholder\b|\blorem ipsum\b|\bdummy text\b/i,'placeholder'],
 [/[\[<]\s*(insert|todo|fill|xxx)\b/i,'template bracket'],
 [/\bas an? (ai|language model|assistant)\b/i,'model self-reference'],
 [/\b(stay|remain) in character\b/i,'roleplay instruction'],
 [/\b(note|instruction|brief|guidance) (to|for) (the )?(writer|author|builder|editor)\b/i,'note to writer'],
 [/\bwriter'?s? note\b/i,'note to writer'],
 [/\bkeep (it|this|them) (short|brief|tight|concise|punchy|terse|snappy)\b/i,'brevity brief'],
 [/\bundefined\b|\[object Object\]|\bNaN\b/,'runtime artefact'],
 [/\bRI-[A-Z]{3}\d{2}\b|\bW1-\d+\b|§\d|\bAR-[12]\b/,'corpus/meta id'],
 [/\b(reference item|the corpus|the verdict|the critic|the builder|the roadmap|blind pair|disposition band|reaction group)\b/i,'project vocabulary'],
 [/\bgame\/(data|src)\/|\.json\b|\.mjs\b/,'file path in prose'],
 [/\b(no more than|at most|max(imum)?|up to)\s+\d+\s*(word|char|line|sentence)/i,'numeric length brief'],
 [/\b(in|under)\s+(one|two|a single|\d+)\s+(line|lines|sentence|sentences|words?)\b/i,'length phrasing'],
 [/\b(rewrite|reword|rephrase|redraft)\b/i,'editing verb'],
 [/\{\{|\}\}|\$\{/,'template syntax'],
];
let n=0;
for(const o of out){ for(const [re,why] of PAT) if(re.test(o.t)){ n++; console.log(`\n[${why}] ${o.src}\n    ${JSON.stringify(o.t.slice(0,240))}`); break; } }
console.log(`\nHITS ON RENDERED SURFACE: ${n}`);
