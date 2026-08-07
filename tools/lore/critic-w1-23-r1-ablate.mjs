#!/usr/bin/env node
// CRITIC W1-23 r1, RULES #6 delete-the-fix: the same topics answered with the register and
// with canon=null, to test whether the register CAUSES the province's disagreements.
import fs from 'node:fs';
import { CanonRegistry } from '/home/user/elder-souls-claude/game/src/world/canon.js';
import { buildTopicIndex, infoFor } from '/home/user/elder-souls-claude/game/src/character/converse.js';
const R='/home/user/elder-souls-claude/'; const rd=p=>JSON.parse(fs.readFileSync(R+p,'utf8'));
const docs=fs.readdirSync(R+'game/data/dialogue/topics').map(f=>rd('game/data/dialogue/topics/'+f));
const idx=buildTopicIndex(docs); const reg=new CanonRegistry(rd('game/data/lore/canon.json'));
const pop=[]; for(const f of fs.readdirSync(R+'game/data/npcs')) for(const n of (rd('game/data/npcs/'+f).npcs||[])) pop.push(n);
const P={race:'dunmer',upbringing:null};
for(const [label,canon] of [['WITH REGISTER',reg],['REGISTER DELETED',null]]){
  console.log('==== '+label);
  for(const t of ['the-thinning','slavery']){
    const seen=new Map();
    for(const n of pop){ const i=infoFor(idx,t,n,P,canon); if(i&&i.text&&!seen.has(i.text)) seen.set(i.text,n.actor+' / '+(n.faction||'-')); }
    console.log('  topic '+t+': '+seen.size+' distinct answers in the province');
    for(const [x,who] of seen) console.log('     ['+who+'] '+x.slice(0,105));
  }
}
