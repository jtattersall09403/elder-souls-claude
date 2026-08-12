#!/usr/bin/env node
// W1-19 checkpoint tamper/staleness control. The validator is the executed consumer in every arm.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';

const args=parseArgs();
if(wantsHelp(args)||!args.manifest||!args.out)usage('mainline-checkpoint-control.mjs --manifest <manifest.json> --out <report.json>');
const root=process.cwd(),manifestPath=path.resolve(String(args.manifest)),outPath=path.resolve(String(args.out));
const scratch=path.join(path.dirname(outPath),'checkpoint-control-copy');
const validator=path.join(root,'tools/quests/validate-mainline-checkpoint.mjs');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const fixturePath=path.resolve(path.dirname(manifestPath),manifest.fixture);
const fixtureBytes=fs.readFileSync(fixturePath),manifestBytes=fs.readFileSync(manifestPath);
const hash=(b)=>crypto.createHash('sha256').update(b).digest('hex');
const consume=(p)=>{const r=spawnSync(process.execPath,[validator,p],{cwd:root,encoding:'utf8'});return{exit:r.status,stdout:r.stdout||'',stderr:r.stderr||'',calls:1};};
const greenBefore=consume(manifestPath);
if(fs.existsSync(scratch))fs.rmSync(scratch,{recursive:true,force:true});ensureDir(scratch);

const local={...manifest,fixture:'fixture.json'};
const fixture=JSON.parse(fixtureBytes.toString('utf8'));
fixture.meta={...fixture.meta,checkpoint_control_tamper:'one-byte-equivalent semantic addition'};
const tamperedBytes=Buffer.from(JSON.stringify(fixture,null,2)+'\n');
const tamperManifest=path.join(scratch,'tamper.manifest.json');
fs.writeFileSync(path.join(scratch,'fixture.json'),tamperedBytes);fs.writeFileSync(tamperManifest,JSON.stringify(local,null,2)+'\n');
const tamper=consume(tamperManifest);

fs.writeFileSync(path.join(scratch,'fixture.json'),fixtureBytes);
const stale={...local,input_hashes:{...local.input_hashes,quests:`sha256:${'0'.repeat(64)}`}};
const staleManifest=path.join(scratch,'stale.manifest.json');fs.writeFileSync(staleManifest,JSON.stringify(stale,null,2)+'\n');
const staleRun=consume(staleManifest),greenRestored=consume(manifestPath);

const report={
  schema:'elder-souls/mainline-checkpoint-control@1',manifest:path.relative(root,manifestPath).split(path.sep).join('/'),
  consumer:'tools/quests/validate-mainline-checkpoint.mjs',consumer_calls:4,non_zero_support:2,
  source_hashes:{fixture:`sha256:${hash(fixtureBytes)}`,manifest:`sha256:${hash(manifestBytes)}`},
  controls:[
    {id:'checkpoint-tampering',changed_hash:`sha256:${hash(tamperedBytes)}`,hash_changed:hash(tamperedBytes)!==hash(fixtureBytes),exit:tamper.exit,expected_red_row:'checkpoint invalid: fixture hash mismatch',observed:(tamper.stderr+tamper.stdout).trim()},
    {id:'checkpoint-staleness',changed_hash:`sha256:${hash(Buffer.from(JSON.stringify(stale)))}`,hash_changed:stale.input_hashes.quests!==manifest.input_hashes.quests,exit:staleRun.exit,expected_red_row:'checkpoint invalid: quests input hash changed',observed:(staleRun.stderr+staleRun.stdout).trim()},
  ],
  green_before:{exit:greenBefore.exit,observed:(greenBefore.stdout+greenBefore.stderr).trim()},
  green_restored:{exit:greenRestored.exit,observed:(greenRestored.stdout+greenRestored.stderr).trim()},pass:false,
};
report.pass=greenBefore.exit===0&&greenRestored.exit===0&&report.controls.every((c)=>c.hash_changed&&c.exit!==0&&c.observed.includes(c.expected_red_row));
fs.rmSync(scratch,{recursive:true,force:true});writeJson(outPath,report);console.log(JSON.stringify(report,null,2));process.exitCode=report.pass?0:1;
