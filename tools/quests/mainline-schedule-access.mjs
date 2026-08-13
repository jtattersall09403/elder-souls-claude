#!/usr/bin/env node
// Exhaustive cheap W1-19 mainline-giver schedule/access audit.
// Every scheduled interior row is sampled through the shipped SettlementSystem.isOpen consumer;
// a giver who exists behind a locked door is absent for production purposes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SettlementSystem } from '../../game/src/sim/settlement.js';
import { parseArgs, writeJson, ensureDir } from '../lib/cli.mjs';

const args=parseArgs(), root=process.cwd(), sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const questDir=path.join(root,'game/data/quests'), npcDir=path.join(root,'game/data/npcs'), interiorDir=path.join(root,'game/data/world/interiors');
const quests=[];
for(const file of fs.readdirSync(questDir).sort())if(file.endsWith('.json'))for(const q of read(path.join(questDir,file)).quests||[])if(q.category==='main'&&q.giver?.npc_id)quests.push(q);
const npcs=new Map();
for(const file of fs.readdirSync(npcDir).sort())if(file.endsWith('.json'))for(const n of read(path.join(npcDir,file)).npcs||[]){
  if(npcs.has(n.id)&&JSON.stringify(npcs.get(n.id).schedule||[])!==JSON.stringify(n.schedule||[]))throw new Error(`conflicting schedule duplicates for ${n.id}`);
  npcs.set(n.id,n);
}
const interiors={}, sourceBytes=[];
for(const file of fs.readdirSync(interiorDir).sort())if(file.endsWith('.json')){const bytes=fs.readFileSync(path.join(interiorDir,file));const d=JSON.parse(bytes);interiors[d.id]=d;sourceBytes.push(bytes);}
const sourceHash=sha(Buffer.concat(sourceBytes));
if(args.break==='grey-hist-hours')Object.assign(interiors['soulrest-grey-hist'],{open_h:8,close_h:19});
const changedBytes=Buffer.from(JSON.stringify(interiors));
const settlements=new SettlementSystem([],interiors), cv=t=>{const[h,m]=String(t).split(':').map(Number);return h+m/60;};
const giverIds=[...new Set(quests.map(q=>q.giver.npc_id))].sort(), rows=[];
let consumerCalls=0;
for(const npcId of giverIds){
  const npc=npcs.get(npcId);if(!npc){rows.push({npc:npcId,id:'giver_record',pass:false,reason:'missing NPC record'});continue;}
  for(const schedule of npc.schedule||[]){
    if(!schedule.at||!interiors[schedule.at])continue;
    const a=cv(schedule.from),b=cv(schedule.to),samples=[];
    for(let half=0;half<48;half++){const hour=half/2+.25,inRow=b>a?hour>=a&&hour<b:hour>=a||hour<b;if(!inRow)continue;consumerCalls++;samples.push({hour,open:settlements.isOpen(schedule.at,hour)});}
    const closed=samples.filter(x=>!x.open).map(x=>x.hour);
    rows.push({npc:npcId,id:`${schedule.from}-${schedule.to}@${schedule.at}`,activity:schedule.activity||null,interior:schedule.at,open_h:interiors[schedule.at].open_h??0,close_h:interiors[schedule.at].close_h??24,sample_count:samples.length,closed_samples:closed,pass:samples.length>0&&closed.length===0});
  }
}
const failures=rows.filter(r=>!r.pass), expectedRed=rows.find(r=>r.npc==='undersexton-bel-mourne'&&r.id==='19:00-00:00@soulrest-grey-hist')||null;
const report={schema:'elder-souls/w1-19-mainline-schedule-access@1',source:'game/data/world/interiors/*.json',source_hash:`sha256:${sourceHash}`,changed_source_hash:args.break?`sha256:${sha(changedBytes)}`:null,changed_hash:args.break?sourceHash!==sha(changedBytes):null,consumer:'SettlementSystem.isOpen',consumer_calls:consumerCalls,quest_population:quests.length,giver_population:giverIds.length,scheduled_interior_rows:rows.length,non_zero_support:rows.reduce((n,r)=>n+(r.sample_count||0),0),break:args.break||null,expected_red_row:args.break?{npc:'undersexton-bel-mourne',id:'19:00-00:00@soulrest-grey-hist',observed:!!expectedRed&&!expectedRed.pass}:null,failures,rows,pass:failures.length===0};
if(args.out){const out=path.resolve(String(args.out));ensureDir(path.dirname(out));writeJson(out,report);}
console.log(`${report.pass?'PASS':'RED'} mainline schedule access: ${report.giver_population} givers, ${report.scheduled_interior_rows} scheduled interior rows, ${report.non_zero_support} live-hour samples, ${failures.length} inaccessible rows`);
for(const row of failures)console.log(`  RED ${row.npc} ${row.id}: closed at ${row.closed_samples.join(', ')}`);
process.exit(report.pass?0:1);
