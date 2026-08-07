#!/usr/bin/env node
// CRITIC W1-23 r1. Every distinct answer the province gives to `slavery`, per player race,
// and which of the 227 Argonian NPCs has any answer at all. Artifact: artifacts/W1-23-r1/voices.txt
import fs from 'node:fs';
import { CanonRegistry } from '/home/user/elder-souls-claude/game/src/world/canon.js';
import { buildTopicIndex, infoFor } from '/home/user/elder-souls-claude/game/src/character/converse.js';
const R='/home/user/elder-souls-claude/'; const rd=p=>JSON.parse(fs.readFileSync(R+p,'utf8'));
const idx=buildTopicIndex(fs.readdirSync(R+'game/data/dialogue/topics').map(f=>rd('game/data/dialogue/topics/'+f)));
const reg=new CanonRegistry(rd('game/data/lore/canon.json'));
const pop=[]; for(const f of fs.readdirSync(R+'game/data/npcs')) for(const n of (rd('game/data/npcs/'+f).npcs||[])) pop.push(n);
for(const race of ['saxhleel','argonian','naga','dunmer','imperial']){
  const seen=new Map();
  for(const n of pop){ const i=infoFor(idx,'slavery',n,{race,upbringing:null},reg); if(i&&i.text&&!seen.has(i.text)) seen.set(i.text,`${n.actor}/${n.race||'-'}`); }
  console.log(`PLAYER RACE ${race}: ${seen.size} distinct answers to "slavery" in the whole province`);
  for(const [x,who] of seen) console.log('   ['+who+'] '+x);
  console.log();
}
// who among the SPEAKERS is argonian and says anything on slavery?
const arg=pop.filter(n=>['saxhleel','naga','argonian'].includes(n.race));
console.log('argonian-race NPCs in the province:',arg.length);
let spoke=0; const texts=new Set();
for(const n of arg){ const i=infoFor(idx,'slavery',n,{race:'saxhleel'},reg); if(i&&i.text){spoke++;texts.add(i.text);} }
console.log('  of whom have ANY answer to `slavery`:',spoke,'->',texts.size,'distinct:');
for(const t of texts) console.log('     '+t);
