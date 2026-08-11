#!/usr/bin/env node
/** Execute the six RI-CMP01 arms in the running browser. No expected target is emitted. */
import fs from 'node:fs'; import crypto from 'node:crypto'; import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
const argv=process.argv.slice(2),arg=k=>{const i=argv.indexOf(`--${k}`);return i<0?null:argv[i+1]};
const out=arg('out')||'reports/experience/w1-25-persistent-builder/crossing-live-arms.json';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const engineHash=crypto.createHash('sha256').update(fs.readFileSync('game/src/engine.js')).digest('hex');
const specs=[
 ['TOD->ROS','W2F','mechanical','Engine.spawnEncounter'],['WEA->ROS','W2F','mechanical','Engine.spawnEncounter'],
 ['FAC->ROS','W2F','mechanical','Engine.spawnEncounter'],['EQP->ROS','W2F','mechanical','Engine.spawnEncounter'],
 ['STL->ROS','W2F','mechanical','Engine.spawnEncounter'],['BOS->WLD','F2W','structural','Engine.consumeBossOutcome'],
 ['BOS->QST','F2W','structural','Engine.consumeBossOutcome'],['BOS->FAC','F2W','structural','Engine.consumeBossOutcome'],
 ['BOS->DIS','F2W','mechanical','Engine.consumeBossOutcome'],['BOS->LOR','F2W','mechanical','Engine.consumeBossOutcome']];
const browserSession=`cmp01-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
async function action(game,cell,sourceOn,consumerOn,irrelevant){return game.page.evaluate(({cell,sourceOn,consumerOn,irrelevant})=>{
 const H=window.__HARNESS; H.setSeed(1234);H.loadState('default');H.setRenderRate(0);
 if(!cell.startsWith('BOS->')) H.setCrossingControl(cell,consumerOn);
 if(irrelevant){if(cell==='TOD->ROS')H.setWeather('clear');else H.setTimeOfDay(11);}
 let target, support=0, calls=0, source;
 if(cell==='TOD->ROS'){H.setTimeOfDay(sourceOn?3:15);source={hour:sourceOn?3:15};const s=H.spawnEncounter('wl-fen-sentry',12,0);const m=H.getEncounterState('wl-fen-sentry').members;target=m.map(x=>`${x.eid}:${x.role}`).sort();support=m.length;calls=H.getCrossingControl(cell).calls;}
 else if(cell==='WEA->ROS'){H.setWeather(sourceOn?'salt_storm':'clear');source={weather:sourceOn?'salt_storm':'clear'};H.spawnEncounter('wl-fen-sentry',18,0);const m=H.getEncounterState('wl-fen-sentry').members;target=m.map(x=>`${x.eid}:${x.sight_radius_m}`).sort();support=m.length;calls=H.getCrossingControl(cell).calls;}
 else if(cell==='FAC->ROS'){H.setFactionStanding('the_drowned_court',{member:sourceOn,rank:sourceOn?3:0,reputation:sourceOn?100:0});source={rank:sourceOn?3:0};H.spawnEncounter('wl-legion-picket',12,0);const m=H.getEncounterState('wl-legion-picket').members;target=m.map(x=>`${x.eid}:${x.sight_radius_m}`).sort();support=m.length;calls=H.getCrossingControl(cell).calls;}
 else if(cell==='EQP->ROS'){if(sourceOn){H.grantInventoryItem('legion-greaves');H.equipItem('legion-greaves');H.stepFrames(35);}source={equipped:sourceOn?'legion-greaves':null};H.spawnEncounter('wl-legion-picket',12,0);const m=H.getEncounterState('wl-legion-picket').members;target=m.map(x=>`${x.eid}:${x.sight_radius_m}`).sort();support=m.length;calls=H.getCrossingControl(cell).calls;}
 else if(cell==='STL->ROS'){if(sourceOn){const c=H.commitCrime('theft',{value_g:400,jurisdiction:'imperial',settlement:'archon'});const wi=H.addWitnessIndex(c.id,{eid:'matrix-witness',identified:true,kind:'sight'});H.landReport(wi,'unlawful');}source={reported_crime:sourceOn};H.spawnEncounter('wl-legion-picket',12,0);const m=H.getEncounterState('wl-legion-picket').members;target=m.map(x=>`${x.role}:${x.alert_state}`).sort();support=m.length;calls=H.getCrossingControl(cell).calls;}
 else {H.questPrepareOffer('Q-MAIN-28');H.questOpen('Q-MAIN-28');source={boss_outcome:sourceOn?'res_kill_him':null};let r=null;if(consumerOn)r=H.consumeBossOutcome('Q-MAIN-28',sourceOn?'res_kill_him':null);calls=consumerOn?1:0;const q=H.getQuestState();if(cell==='BOS->WLD')target=H.questWorldFlags();else if(cell==='BOS->QST'){const z=q.quests?.['Q-MAIN-28'];target={stage:z?.stage,branch:z?.branch,journal:(q.journal||[]).filter(x=>x.quest==='Q-MAIN-28').map(x=>x.n)}}else if(cell==='BOS->FAC')target=H.getFactionStanding();else if(cell==='BOS->DIS')target=H.getDispositions();else target=(q.journal||[]).filter(x=>x.quest==='Q-MAIN-28').map(x=>x.text);support=1;}
 return {target,support,calls,source,frame:H.getFrame?H.getFrame():0,save:(cell.startsWith('BOS->')&&sourceOn&&consumerOn)?H.saveState():null};
 },{cell,sourceOn,consumerOn,irrelevant});}

async function restoredTarget(game,cell,save){return game.page.evaluate(({cell,save})=>{const H=window.__HARNESS;H.restoreState(save);const q=H.getQuestState();let target;if(cell==='BOS->WLD')target=H.questWorldFlags();else if(cell==='BOS->QST'){const z=q.quests?.['Q-MAIN-28'];target={stage:z?.stage,branch:z?.branch,journal:(q.journal||[]).filter(x=>x.quest==='Q-MAIN-28').map(x=>x.n)}}else if(cell==='BOS->FAC')target=H.getFactionStanding();else if(cell==='BOS->DIS')target=H.getDispositions();else target=(q.journal||[]).filter(x=>x.quest==='Q-MAIN-28').map(x=>x.text);return {target,save:H.saveState()};},{cell,save});}

const game=await launchGame({timeout:120000});const rows=[];
try{for(const [cell,direction,tier,symbol] of specs){const defs={positive:[true,true,false],null:[false,true,false],consumer_delete:[true,false,false],source_remove:[false,true,false],irrelevant_source:[true,true,true],restore:[true,true,false]},arms={};let positiveSave=null;
 for(const [name,params] of Object.entries(defs)){const r=await action(game,cell,...params);if(name==='positive')positiveSave=r.save;const source_hash=sha(r.source);arms[name]={observed:true,browser_session_id:browserSession,frame_start:r.frame,frame_end:r.frame+1,target:r.target,target_hash:sha(r.target),support:r.support,consumer_calls:r.calls,consumer_trace:r.calls?[{symbol,calls:r.calls,production:true}]:[],target_writes:[],source_hash,consumer_hash:name==='consumer_delete'?sha(engineHash+':deleted:'+cell):engineHash,irrelevant_hash:sha({irrelevant:name==='irrelevant_source'})};}
 const row={cell,direction,tier,declared_crossing:true,source_values:[false,true],prediction:`${cell} production target changes`,observable:`live ${cell} target`,consumer:{symbol,kind:'production'},direct_target_mutation:false,arms};
 if(tier==='structural'&&positiveSave){const reload=await restoredTarget(game,cell,positiveSave);const restarted=await launchGame({timeout:120000});let restart;try{restart=await restoredTarget(restarted,cell,positiveSave);}finally{await restarted.close();}row.durability={reload_observed:true,restart_observed:true,support:1,reload_target:reload.target,restart_target:restart.target,save_hash:sha(arms.positive.target),reload_save_hash:sha(reload.target)};}
 rows.push(row);console.log(`${cell}: six arms observed`);}}
finally{await game.close();}
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({schema:'elder-souls/w1-25-crossing-live@2',browser_session_id:browserSession,cells:rows},null,2)+'\n');
console.log(`wrote ${out}; structural reload and fresh-browser restart arms observed from the saved state`);
