import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skillsDoc=JSON.parse(fs.readFileSync(ROOT+'/game/data/progression/skills.json','utf8'));
const SK=skillsDoc.skills.map(s=>s.id||s);
const ATTRS=['strength','intelligence','willpower','agility','speed','endurance','personality','luck'];

// Which factions the quest book actually references. Nothing is invented that nothing asks for.
const fac=new Set();
for(const f of fs.readdirSync(ROOT+'/game/data/quests')){
  if(f==='faction-gates.json'||f==='hooks.json') continue;
  const d=JSON.parse(fs.readFileSync(ROOT+'/game/data/quests/'+f,'utf8'));
  for(const q of (Array.isArray(d.quests)?d.quests:[])){
    if(q.faction) fac.add(q.faction);
    if(q.rank_gate) fac.add(q.rank_gate.faction);
    for(const r of q.resolutions||[]) if(r.requires&&r.requires.faction_rank) fac.add(r.requires.faction_rank.faction);
    for(const k of Object.keys((q.consequences||{}).faction_reputation||{})) fac.add(k);
    for(const r of q.resolutions||[]) for(const k of Object.keys((r.consequences||{}).faction_reputation||{})) fac.add(k);
  }
}

// RI-QST03 §B: reputation, one of two favoured attributes, two distinct favoured skills from a
// set of six, and a world state. Never level, souls, gold-on-hand or a quest counter.
const PROFILE={
  the_rootkeepers:{name:'The Rootkeepers',attrs:['willpower','personality'],skills:['root-speech','warding','alchemy','survival','speechcraft','veiling'],ranks:['Supplicant','Leaf','Green Hand','Sapwright','Root-Speaker','Deep Root','Hist-Marked','Voice of the Hist']},
  the_dockhands:{name:'The Dockhands',attrs:['strength','endurance'],skills:['athletics','mercantile','blades','shieldcraft','speechcraft','security'],ranks:['Casual','Hand','Rope','Ganger','Foreman','Wharf-Master','Ledger-Keeper','Harbourmaster']},
  the_imperial_assize:{name:'The Imperial Assize',attrs:['personality','intelligence'],skills:['speechcraft','mercantile','blades','marksman','security','alchemy'],ranks:['Clerk','Notary','Assessor','Adjutant','Assizer','Senior Assizer','Prefect','Legate of the Assize']},
  the_wet_ledger:{name:'The Wet Ledger',attrs:['agility','personality'],skills:['security','sneak','mercantile','speechcraft','veiling','acrobatics'],ranks:['Runner','Fence','Ledger-Hand','Quiet Partner','Book-Keeper','Underwriter','Silent Partner','The Ledger']},
  the_drowned_court:{name:'The Drowned Court',attrs:['willpower','endurance'],skills:['sorcery','warding','root-speech','survival','veiling','alchemy']  ,ranks:['Wader','Knee-Deep','Waist-Deep','Chest-Deep','Drowned','Deep-Drowned','Court-Sworn','The Drowned Crown']},
  the_xul_aneekh:{name:'The Xul-Aneekh',attrs:['intelligence','willpower'],skills:['sorcery','veiling','warding','alchemy','security','sneak'],ranks:['Unnamed','Taken','Bound','Debtor','Keeper','Gem-Cutter','Sap-Drinker','Xul-Aneekh']},
  xul_aneekh:{alias:'the_xul_aneekh'},
  ixtu_vakh:{alias:'the_ixtu_vakh'},
  the_ixtu_vakh:{name:'The Ixtu-Vakh',attrs:['endurance','strength'],skills:['claw-fang','survival','athletics','axes-maces','marksman','acrobatics'],ranks:['Egg','Hatchling','Runner','Hunter','Pack-Hunter','Spear-Kin','War-Kin','Ixtu-Vakh']},
  deep_kin:{name:'The Deep Kin',attrs:['willpower','intelligence'],skills:['root-speech','sorcery','survival','warding','veiling','alchemy'],ranks:['Stranger','Guest','Known','Kin-Named','Deep Kin','Elder Kin','Root-Kin','The Deep']},
};

const REP=[0,10,25,40,55,70,85,100];
const ATTR=[null,25,30,35,45,55,65,75];
const S1=[null,20,30,40,50,60,70,80];
const S2=[null,null,20,25,35,45,55,65];

const factions=[];
for(const id of [...fac].sort()){
  let p=PROFILE[id];
  if(p&&p.alias) p=PROFILE[p.alias];
  if(!p) throw new Error('no profile for faction '+id);
  for(const s of p.skills) if(!SK.includes(s)) throw new Error(`${id}: '${s}' is not a skill in game/data/progression/skills.json`);
  for(const a of p.attrs) if(!ATTRS.includes(a)) throw new Error(`${id}: '${a}' is not an attribute`);
  factions.push({
    id, name:p.name,
    favoured_attributes:p.attrs,
    favoured_skills:p.skills,
    ranks:p.ranks.map((n,i)=>({
      rank:i, name:n, reputation:REP[i], attribute:ATTR[i], skill_1:S1[i], skill_2:S2[i],
      world_state: i>=6 ? {flag:`${id}:trusted`, text:'the faction has trusted you with something it cannot take back'} : null,
    })),
  });
}

const doc={
  schema:'elder-souls/faction-gates@1',
  id:'faction-gates',
  corpus_item:'RI-QST03 §A (two favoured attributes, six favoured skills) and §B (the four-part rank statement)',
  generated_by:'tools/analysis/gen-faction-gates.mjs',
  note:[
    'The rank ladders for every faction the quest book references, and no others.',
    'RI-QST03 §B repeats one rule three times: "No rank may reference character level, souls,',
    'gold-on-hand, or a raw quest counter." game/src/sim/quest/gate.js enforces that at',
    'construction and throws — a level gate here is a build that does not start, not a low score.',
    '',
    'This file did not exist. QuestEngine requires it, which is one of the two reasons the quest',
    'runtime was never instantiated and RI-MAG04 M6 scored 0. Wave-1 pieces W1-2x own the CONTENT',
    'of these ladders and should re-derive every number; what is binding here is the SHAPE.',
  ],
  factions,
  exclusivity:{
    hard_groups:[{id:'the_two_courts',members:['the_drowned_court','the_imperial_assize'],why:'You cannot swear to a drowned crown and to the Assize that would hang it.'}],
    enemy_pairs:[['the_xul_aneekh','deep_kin'],['the_wet_ledger','the_imperial_assize']],
    soft:[{a:'the_dockhands',b:'the_wet_ledger',penalty:-15,why:'The wharf knows who fences its cargo.'}],
  },
};
fs.writeFileSync(ROOT+'/game/data/quests/faction-gates.json', JSON.stringify(doc,null,2)+'\n');
console.log('wrote faction-gates.json —', factions.length, 'factions');
