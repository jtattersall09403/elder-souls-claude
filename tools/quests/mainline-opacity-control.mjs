#!/usr/bin/env node
// W1-19 mystery-opacity control. The authoritative Python consumer is run green, then against
// an isolated game/data copy whose ending data states one sealed answer and one assembled fact,
// then green again on the restored tree. The repository is never mutated by the control.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, writeJson, ensureDir } from '../lib/cli.mjs';

const args = parseArgs();
if (wantsHelp(args) || !args.out || !args.python) usage('mainline-opacity-control.mjs --out <report.json> --python <python executable>');
const root = process.cwd(), outPath = path.resolve(String(args.out));
const scratch = path.join(path.dirname(outPath), 'opacity-control-copy');
const sourceRel = 'game/data/quests/mainline-act5.json', sourcePath = path.join(root, sourceRel);
const audit = path.join(root, 'corpus/80-methods/opacity-audit.py');
const python = path.resolve(String(args.python));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const source = fs.readFileSync(sourcePath, 'utf8'), changedDoc = JSON.parse(source);
const ending = (changedDoc.quests || []).find((quest) => quest.id === 'Q-MAIN-28');
const endingEntry = ending?.journal?.find((entry) => entry.state === 'success');
if (!endingEntry || typeof endingEntry.text !== 'string') throw new Error('Q-MAIN-28 has no player-visible success journal text for the opacity control');
endingEntry.text += " The Counting Obelisk is a tally of dead Hist. The drowned tally's omissions trace a deliberate levy rather than losses to weather.";
const changedSource = `${JSON.stringify(changedDoc, null, 2)}\n`;

function consume(label, gameDir) {
  const json = path.join(path.dirname(outPath), `${label}.json`);
  const run = spawnSync(python, [audit, '--leak-scan', '--assembled', '--game', gameDir, '--json', json], {
    cwd: root, encoding: 'utf8', timeout: Number(args.timeout || 300000), maxBuffer: 8 * 1024 * 1024,
  });
  const report = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null;
  return { label, exit:run.status, consumer_executed:true, stdout:run.stdout, stderr:run.stderr, report };
}

ensureDir(path.dirname(outPath));
const greenBefore = consume('opacity-green-before', path.join(root, 'game/data'));
if (fs.existsSync(scratch)) fs.rmSync(scratch, { recursive:true, force:true });
fs.cpSync(path.join(root, 'game/data'), path.join(scratch, 'game/data'), { recursive:true });
fs.writeFileSync(path.join(scratch, sourceRel), changedSource);
const red = consume('opacity-red-leaked-ending', path.join(scratch, 'game/data'));
fs.rmSync(scratch, { recursive:true, force:true });
const greenRestored = consume('opacity-green-restored', path.join(root, 'game/data'));

const redRows = [...(red.report?.leaks?.hard || []), ...(red.report?.leaks?.fuzzy || []), ...(red.report?.assembled?.failures || [])];
const sealedRed = redRows.find((row) => /^LEAK\s+M-01:/.test(row) && row.includes('tally of dead hist')) || null;
const assembledRed = redRows.find((row) => row.startsWith('STATED   A-01:')) || null;
const green = (arm) => arm.exit === 0 && arm.report?.leaks?.hard?.length === 0
  && arm.report?.leaks?.fuzzy?.length === 0 && arm.report?.assembled?.failures?.length === 0;
const report = {
  schema:'elder-souls/mainline-opacity-control@1',
  method:'authoritative consumer green; isolated ending leak; exact red rows; restored green',
  source:sourceRel, source_hash:`sha256:${sha(source)}`, changed_source_hash:`sha256:${sha(changedSource)}`,
  changed_hash:sha(source) !== sha(changedSource),
  consumer:'corpus/80-methods/opacity-audit.py --leak-scan --assembled', consumer_calls:3,
  non_zero_support:{sealed_mysteries:24,assembled_facts:12},
  expected_red_rows:[
    { id:'sealed mystery explained in ending text', expected:'LEAK M-01', actual:sealedRed },
    { id:'assembled fact stated in ending text', expected:'STATED A-01', actual:assembledRed },
  ],
  arms:[
    {label:greenBefore.label,exit:greenBefore.exit,green:green(greenBefore)},
    {label:red.label,exit:red.exit,red:!!sealedRed&&!!assembledRed,rows:redRows},
    {label:greenRestored.label,exit:greenRestored.exit,green:green(greenRestored)},
  ],
  pass:false,
};
report.pass=report.changed_hash && report.consumer_calls===3
  && report.non_zero_support.sealed_mysteries>0 && report.non_zero_support.assembled_facts>0
  && report.arms[0].green && report.arms[1].exit!==0 && report.arms[1].red && report.arms[2].green;
writeJson(outPath, report);
console.log(JSON.stringify(report, null, 2));
process.exitCode=report.pass?0:1;
