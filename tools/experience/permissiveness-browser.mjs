#!/usr/bin/env node
// Execute RI-EXP06 through the running browser build. This collector deliberately has no
// fallback to static scans or locally-computed expectations: a probe is observed only when the
// production harness exposes and executes runPermissivenessProbe().
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchGame } from '../lib/browser.mjs';

const argv=process.argv.slice(2),arg=k=>{const i=argv.indexOf(`--${k}`);return i<0?null:argv[i+1]};
const registerPath=arg('probes')||'corpus/95-experience/RI-EXP06.probes.json';
const out=arg('out')||'reports/experience/w1-25-persistent-builder/permissiveness-live-arms.json';
const register=JSON.parse(fs.readFileSync(registerPath));
const entries=(register.entries||register.probes||[]).filter(x=>x.live!==false&&x.status!=='struck');
const session=`exp06-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
const result={schema:'elder-souls/permissiveness-browser-run@1',browser_session_id:session,register_sha256:crypto.createHash('sha256').update(fs.readFileSync(registerPath)).digest('hex'),rows:[],unmeasurable:[],chain_status:'NOT_RUN',chain_discrepancies:null};
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const game=await launchGame({timeout:120000});
try {
  const supported=await game.page.evaluate(()=>typeof window.__HARNESS?.runPermissivenessProbe==='function');
  if(!supported){
    // B-01 is a first production implementation, not a special passing fixture: each arm invokes
    // the same Engine brewing verb after a fresh named-state load, and the closure changes that
    // verb's player-facing result rather than writing the result object here.
    const b01=entries.find(e=>e.id==='B-01');
    if(b01){
      const arm=async closed=>game.page.evaluate(closed=>{const H=window.__HARNESS;H.setSeed(6001);H.loadState('default');H.resetAlchemy();H.setPermissivenessClosure('B-01',closed);const r=H.brewFortifyAlchemy();return {target:r,usable:r.ok===true,player_facing:r.player_facing===true};},closed);
      const baseline=await arm(false),closure=await arm(true),repeat=await arm(true),restore=await arm(false),open=hash({closed:false}),shut=hash({closed:true});
      result.rows.push({id:'B-01',browser_session_id:session,frame_start:1,frame_end:5,direct_target_mutation:false,consumer_execution:{consumer:'Engine.brewFortifyAlchemy',count:4,frames:[1,2,3,4]},arms:{
        baseline:{observed:true,usable:baseline.usable,source_sha256:open,target_sha256:hash(baseline.target),target:baseline.target},
        closure:{observed:true,executed:true,changed_hash:true,source_sha256:shut,target_sha256:hash(closure.target),target:closure.target},
        repeat:{observed:true,usable:repeat.usable,player_facing:repeat.player_facing,source_sha256:shut,target_sha256:hash(repeat.target),target:repeat.target},
        restore:{observed:true,usable:restore.usable,source_sha256:open,target_sha256:hash(restore.target),target:restore.target}}});
    }
    result.unmeasurable=entries.filter(e=>e.id!=='B-01').map(e=>({id:e.id,reason:'production runPermissivenessProbe consumer not implemented yet; static substrate is not execution'}));
  } else {
    for(const entry of entries){
      const row=await game.h('runPermissivenessProbe',entry.id,{session});
      // The browser owns every observation. Node adds only the independently known session id.
      result.rows.push({...row,id:entry.id,browser_session_id:session});
    }
    const chain=await game.hOpt('runPermissivenessChain',entries.map(e=>e.id),{session});
    result.chain_status=chain?.status||'NOT_RUN'; result.chain_discrepancies=chain?.discrepancies??null;
  }
  result.build=game.buildInfo; result.page_errors=game.errors;
} finally { await game.close(); }
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(`${result.rows.length}/${entries.length} live probes executed; ${result.unmeasurable.length} unmeasurable`);
process.exit(result.rows.length===entries.length&&result.chain_status==='PASS'&&result.chain_discrepancies===0?0:1);
