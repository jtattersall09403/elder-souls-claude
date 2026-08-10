#!/usr/bin/env node
// Builder-only RI-DLG07 handoff. This extracts the complete eligible candidate pools; it does
// not sample, normalise, randomise, pair, reveal, or judge them. Those remain critic/judge work.
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const files = d => fs.readdirSync(path.join(root,d)).filter(f=>f.endsWith('.json')).sort();
const out={schema:'elder-souls/ri-dlg07-builder-candidates@1',commit:null,role_boundary:'builder extraction only; critic assembles and seals; fresh context-free judge scores',pools:{greeting:[],rumour:[],questgive:[],lore:[],journal:[],hostile:[]}};
const g=read('game/data/dialogue/greetings.json');
for(const p of g.pools||[]) for(const [i,x] of (p.lines||[]).entries()) {
 const row={id:`${p.cell||p.id||'g'}:${i}`,text:typeof x==='string'?x:x.line,disposition_band:p.disposition_band,source:'game/data/dialogue/greetings.json'};
 out.pools.greeting.push(row); if(/hostile|low|0-19|20-39/i.test(String(p.disposition_band))) out.pools.hostile.push(row);
}
const r=read('game/data/dialogue/rumours.json');
for(const [town, rows] of Object.entries(r.rumours||{})) for(const x of rows||[]) out.pools.rumour.push({id:x.id,text:x.x,settlement:x.settlement||town,false_or_misleading:!!(x.false||x.misleading||x.truth===false),act_gated:!!(x.requires||x.forbids),source:'game/data/dialogue/rumours.json'});
const topics=[];for(const f of files('game/data/dialogue/topics')){const d=read('game/data/dialogue/topics/'+f);for(const t of d.topics||[])for(const [i,x] of (t.infos||[]).entries())topics.push({id:`${t.id}#${i}`,topic:t.id,text:x.x,actor:x.a||null,disposition_min:x.d??null,source:`game/data/dialogue/topics/${f}`});}
const by=new Map;for(const x of topics){if(!by.has(x.topic))by.set(x.topic,[]);by.get(x.topic).push(x)}
for(const xs of by.values())if(new Set(xs.map(x=>x.actor).filter(Boolean)).size>=3)out.pools.lore.push(...xs);
out.pools.hostile.push(...topics.filter(x=>x.disposition_min!==null && x.disposition_min<=20));
const giverIds=new Set;for(const f of files('game/data/quests')){const d=read('game/data/quests/'+f);for(const q of d.quests||[]){if(q.giver?.npc_id)giverIds.add(q.giver.npc_id);for(const e of q.journal||[])out.pools.journal.push({id:`${q.id}#${e.index}`,quest:q.id,index:e.index,state:e.state||null,text:e.text,ignorance:/do not know|don't know|uncertain|cannot tell/i.test(e.text||''),completion:['success','failure'].includes(e.state),source:`game/data/quests/${f}`});}}
for(const f of files('game/data/npcs')){const d=read('game/data/npcs/'+f);for(const n of d.npcs||[])if(giverIds.has(n.id))for(const tid of n.topics||[]){const xs=by.get(String(tid).toLowerCase().replaceAll(' ','-'))||[];for(const x of xs)out.pools.questgive.push({...x,giver:n.id,self_interested:/pay|owe|mine|my |wage|rank|estate|office/i.test(x.text||'')});}}
out.commit=process.env.W1_COMMIT||'WORKTREE';
const census={greeting:out.pools.greeting.length,rumour:out.pools.rumour.length,questgive:out.pools.questgive.length,lore:out.pools.lore.length,journal:out.pools.journal.length,hostile:out.pools.hostile.length};out.census=census;
const fail=census.greeting<3||census.rumour<4||census.questgive<4||census.lore<4||census.journal<4||census.hostile<5;
const dest=process.argv[2];if(dest)fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(census));if(fail)process.exit(1);
