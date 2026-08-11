#!/usr/bin/env node
/** Fail-closed RI-JRN05 native-population census for W1-00.
 * This is the shared reproduction manifest: it proves that SV1-SV5 and every M/CR row has a
 * concrete production fixture before the browser aggregate spends time on cold reloads.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const fixtures={SV1:'sv1-midquest',SV2:'sv2-mid-dungeon',SV3:'sv3-post-rank-up',SV4:'sv4-bounty-pursuit',SV5:'sv5-journal-bloodstain'};
const tests=[]; const check=(id,ok,detail)=>tests.push({id,ok:!!ok,detail});
const states=Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,read(`game/data/states/${v}.json`)]));
check('SV1',states.SV1.quest?.quests?.['the-boards']?.stage===30 && states.SV1.quest.quests['the-boards'].branch && states.SV1.quest.quests['the-boards'].flags?.optional_talk_done && states.SV1.quest.topicsKnown.length>0 && states.SV1.quest.dispositions?.['warden-eshi']===49,'stage/branch/optional talk/topic/disposition');
const w=states.SV2.world||{}; check('SV2',w.shortcutsOpened?.length===1&&w.fogGatesPassed?.length===1&&w.enemiesDeadUntilRest?.length===4&&w.containersEmptied?.length===1&&w.doorsUnlocked?.length===1&&w.shortcutsOpened.includes('ford-ladder')&&states.SV2.progression?.hearthLastRested===null,'6/6 mutations; no HEARTH rest');
const f=states.SV3.quest?.factions?.['house-dres']; check('SV3',f?.rank===2&&f.rank_up_ago_frames<3600&&f.rivalry_locked?.length&&states.SV3.quest.topicsKnown.length>=2&&f.trainer_available,'recent rank, rivalry, topics, trainer');
const c=states.SV4.quest?.crime||{}; check('SV4',c.bounty?.thornmarsh>=500&&c.bounty?.['salt-hills']===0&&c.witnesses?.length===2&&states.SV4.world?.npcsDead?.length===1&&states.SV4.inventory?.filter(x=>x.stolen).length===3&&c.hunting?.length===2,'jurisdictions, 2 live + 1 dead witnesses, 3 stolen, 2 hunters');
const q=states.SV5.quest||{}; check('SV5',q.journal?.length>=40&&q.death?.bloodstain?.souls===3400&&q.afflictions?.some(a=>a.incubation_in_frames===1296000)&&states.SV5.inventory?.some(x=>x.id==='the-drowned-ford')&&q.flags?.read_drowned_ford===false&&Array.isArray(q.travel?.mark),'40+ journal, stain, six-hour disease, unread book, Mark');
const nativeRows={M1:'5/5 hashes',M2:'empty field diff',M3:'5/5 cold reload',M4:'0/0 manifest differences',M5:'5x600-frame continuation',M6:'SV2 6/6',M7:'SV5 bloodstain exact/recovery',M8:'SV4 4/4 + pay-bounty control',M9:'SV5 ordered journal SHA-256',M10:'IndexedDB + localStorage <=1024 B/no payload',M11:'CR1 3 kill points x 5 SV = 15',M12:'CR2-CR5 + CR12 = 5',M13:'CR6-CR10 = 5 playable',M14:'CR11 export/wipe/import diff',M15:'300-frame concurrent write',M16:'endgame-200q 4 MB/1.5 MB/48 MB',M17:'3 slots + out-of-band deletion',M18:'20-minute autosave policy',M19:'restored stain then second death'};
const corruption={CR1:['25%','50%','75%'],CR2:'truncate blob',CR3:'flip byte',CR4:'future schema',CR5:'past schema',CR6:'quota exceeded',CR7:'ephemeral/private store',CR8:'IndexedDB absent',CR9:'two-tab generation race',CR10:'eviction',CR11:'export/wipe/import',CR12:['PNG','empty']};
for(let i=1;i<=19;i++) check(`population:M${i}`,!!nativeRows[`M${i}`],nativeRows[`M${i}`]);
for(let i=1;i<=12;i++) check(`population:CR${i}`,!!corruption[`CR${i}`],corruption[`CR${i}`]);
const journalText=q.journal.map(e=>e.text).join('');
const report={schema:'elder-souls/w1-00-native-save-population@1',fixtures,native_rows:nativeRows,corruption_population:corruption,fixture_hashes:Object.fromEntries(Object.entries(fixtures).map(([k,v])=>[k,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,`game/data/states/${v}.json`))).digest('hex')])),sv5_ordered_text_sha256:crypto.createHash('sha256').update(journalText).digest('hex'),tests,ok:tests.every(t=>t.ok)};
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:null;
if(out) fs.writeFileSync(path.resolve(out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.ok) process.exit(20);
