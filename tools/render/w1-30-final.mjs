#!/usr/bin/env node
'use strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const commands=[
 ['node',['tools/render/w1-30-package2.mjs']],
 ['node',['tools/render/w1-30-package3.mjs']],
 ['node',['tools/render/w1-30-package4.mjs']],
 ['node',['tools/render/w1-30-gate.mjs']],
 ['node',['tools/render/w1-30-aggregate.mjs']],
 ['npm',['run','metrics:selftest']],
 ['node',['corpus/80-methods/palette-selfcheck.mjs','--json']],
];
const rows=[];let green=true;
for(const [cmd,args] of commands){try{execFileSync(cmd,args,{stdio:'pipe'});rows.push({command:[cmd,...args].join(' '),result:'GREEN'});}catch(e){green=false;rows.push({command:[cmd,...args].join(' '),result:'RED',detail:String(e.stderr||e.message).slice(0,500)});}}
let testedCommit='unknown';try{testedCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const livePath=process.env.W130_LIVE_MANIFEST||'/tmp/w1-30-live-proof/manifest.json';let live={result:'RED',reason:`missing ${livePath}`};if(fs.existsSync(livePath)){try{const d=JSON.parse(fs.readFileSync(livePath,'utf8'));live={result:d.result,shots:(d.rows||[]).length,path:livePath};}catch(e){live={result:'RED',reason:String(e.message)}}}if(live.result!=='GREEN'||live.shots!==9)green=false;rows.push({command:`W130_LIVE_MANIFEST=${livePath}`,result:live.result,shots:live.shots,detail:live.reason});
console.log(JSON.stringify({schema:'elder-souls/w1-30-final-builder@1',testedCommit,rows,result:green?'GREEN':'RED',criticOwned:['complete native populations','blind/fresh judgement','final aggregation','two 7/10 verdicts']},null,2));
if(!green)process.exit(1);
