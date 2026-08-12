#!/usr/bin/env node
// RI-VIS08 authority entry point. The canonical harness owns browser lifecycle and manifests.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const argv=process.argv.slice(2), si=argv.indexOf('--scenario');
if(argv.includes('--help')||argv.includes('-h')){console.log('USAGE: node corpus/80-methods/capture-trace.mjs --scenario <locomotion_flat|locomotion_slope20|locomotion_stairs|attack_chain|hit_reactions> [--frames n] [--out dir]');process.exit(0);}
if(si<0||!argv[si+1]){console.error('missing --scenario');process.exit(2);}
const allowed=new Set(['locomotion_flat','locomotion_slope20','locomotion_stairs','attack_chain','hit_reactions']);
const id=argv[si+1];if(!allowed.has(id)){console.error(`RI-VIS08 refuses unregistered scenario: ${id}`);process.exit(2);}
if(!argv.includes('--out')) argv.push('--out',path.resolve('traces/w03',id));
const r=spawnSync(process.execPath,[path.resolve('tools/harness/trace.mjs'),...argv],{stdio:'inherit'});
process.exit(r.status===null?1:r.status);
