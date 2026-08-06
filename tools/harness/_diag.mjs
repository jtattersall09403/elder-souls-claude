#!/usr/bin/env node
import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
const r = await handle.page.evaluate(`(function(){
  const H=window.__HARNESS; const cs=()=>H.getCombatState(); const R=[];
  for (const d0 of [1.6,2.0,2.4])
  for (const lead of [2,4,5,6,8,10,12,16,20])
  for (const dir of [[0,1],[0,-1],[1,0],[0.7,0.7],[0.7,-0.7]]) {
    H.setSeed(0); H.loadState('arena_champion'); H.lockOn('E1');
    H.teleport(0, 4.6-d0, {yaw:0}); H.stepFrames(4);
    H.combatTraceStart({scenario:'diag'});
    H.queueEnemyScript('E1',[{f:10,move:'chop'}]);
    H.queueInputs([{f:10+68-lead, move:dir},{f:10+68-lead+1, press:['roll']},{f:10+68-lead+3, release:['roll']}]);
    const ev={};
    let hp0=null,hpN=null;
    for(let i=1;i<=220;i++){ H.stepFrames(1); const c=cs(); if(hp0===null)hp0=c.player.hp; hpN=c.player.hp;
      for(const rr of H.combatTraceDrain()) if(rr.v) for(const e of rr.v) ev[e.type]=(ev[e.type]||0)+1; }
    H.combatTraceStop();
    R.push({d0, lead, dir:dir.join(','), dmg:+(hp0-hpN).toFixed(1),
      neg: ev.IFRAME_NEGATE||0, hit: ev.HIT||0, whiff: ev.WHIFF||0});
  }
  return R;
})()`);
const by = {};
for (const x of r) { const k = x.d0+'|'+x.dir; (by[k]=by[k]||[]).push(x); }
for (const k of Object.keys(by)) console.log(k.padEnd(12), by[k].map(x=>`L${x.lead}:${x.neg?'NEG':(x.hit?'HIT':'--')}`).join(' '));
await handle.close();
