#!/usr/bin/env node
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const r = await handle.page.evaluate(`(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState(); const R=[];
  for (const mv of ['chop','thrust','combo_a'])
  for (const d0 of [3.2,3.6,4.0,4.4,4.8])
  for (const lead of [4,6,8,10,12,14,16,18,20]) {
    H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
    H.teleport(0, 4.6-d0, {yaw:0}); H.stepFrames(4);
    H.combatTraceStart({scenario:'diag'});
    const st = mv==='chop'?68:mv==='thrust'?54:44;
    H.queueEnemyScript('E1',[{f:10,move:mv}]);
    H.queueInputs([{f:10+st-lead, move:[0,1]},{f:10+st-lead+1, press:['roll']},{f:10+st-lead+3, release:['roll']}]);
    const ev={};
    for(let i=1;i<=200;i++){ H.stepFrames(1);
      for(const rr of H.combatTraceDrain()) if(rr.v) for(const e of rr.v) ev[e.type]=(ev[e.type]||0)+1; }
    H.combatTraceStop();
    R.push({mv,d0,lead,neg:ev.IFRAME_NEGATE||0,hit:ev.HIT||0});
  }
  return R;
})()`);
const by={};
for(const x of r){const k=x.mv+'|'+x.d0;(by[k]=by[k]||[]).push(x);}
for(const k of Object.keys(by)) console.log(k.padEnd(14), by[k].map(x=>`${x.lead}:${x.neg?'N':(x.hit?'H':'.')}`).join(' '));
await handle.close();
