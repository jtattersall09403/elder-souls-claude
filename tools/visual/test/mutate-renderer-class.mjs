#!/usr/bin/env node
/**
 * mutate-renderer-class.mjs — prove the renderer self-test arms are load-bearing.
 *
 * "Nothing counts because someone says so… a fix is not a fix until it has been deleted on a copy
 * and the old number has come back." A green suite proves nothing on its own; a suite that stays
 * green when you break the thing it is watching proves it was decoration.
 *
 * So this breaks `tools/visual/lib/renderer-class.mjs` two different ways, runs the suite after
 * each, prints which arms went red, and restores the file byte-for-byte. It touches nothing else
 * and it needs no network and no Pod.
 *
 *   node tools/visual/test/mutate-renderer-class.mjs
 *
 * Measured 2026-08-14:
 *   M1 (fail open again)    → 1 arm red: fail-open/the-2026-08-14-defect-string-is-software
 *   M2 (the request decides) → 4 arms red, including the red control and the manifest arm
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGET = path.join(REPO, 'tools/visual/lib/renderer-class.mjs');
const ORIGINAL = fs.readFileSync(TARGET, 'utf8');

const MUTATIONS = [
  {
    name: 'M1: fail OPEN again — anything not matching a software pattern is hardware (the 2026-08-14 defect)',
    apply: (s) => s
      .replace(/  } else if \(HARDWARE_VENDOR_PATTERN\.test\(trimmed\)\) \{\n    hardware = true;/,
        '  } else if (true) {\n    hardware = true;')
      .replace(/  if \(!trimmed\) \{\n    unknown = true;/, '  if (false) {\n    unknown = true;')
      .replace(/  \} else if \(UNAVAILABLE_PATTERN\.test\(trimmed\)\) \{\n    unknown = true;/,
        '  } else if (false) {\n    unknown = true;'),
  },
  {
    name: 'M2: let the REQUEST decide — hardware if hardware was asked for',
    apply: (s) => s.replace(
      /    hardware,\n    software_renderer: !hardware,/,
      '    hardware: hardware || hardwareRequested,\n    software_renderer: !(hardware || hardwareRequested),',
    ),
  },
];

let allRed = true;
for (const mutation of MUTATIONS) {
  const mutated = mutation.apply(ORIGINAL);
  if (mutated === ORIGINAL) {
    console.log(`SKIP (the mutation no longer applies — this file has drifted): ${mutation.name}`);
    allRed = false;
    continue;
  }
  fs.writeFileSync(TARGET, mutated);
  let output = '';
  let code = 0;
  try {
    output = execFileSync(process.execPath, [path.join(REPO, 'tools/visual/gpu-deck.mjs'), '--self-test'], { encoding: 'utf8', cwd: REPO });
  } catch (error) {
    output = `${error.stdout || ''}${error.stderr || ''}`;
    code = error.status;
  } finally {
    fs.writeFileSync(TARGET, ORIGINAL);
  }
  const failed = output.split('\n').filter((line) => line.startsWith('FAIL'));
  console.log(`\n### ${mutation.name}`);
  console.log(`exit ${code}; ${failed.length} arm(s) red:`);
  for (const line of failed) console.log(`   ${line}`);
  if (!failed.length) allRed = false;
}

const restored = fs.readFileSync(TARGET, 'utf8') === ORIGINAL;
console.log(`\nrestored byte-identically: ${restored}`);
if (!restored) {
  console.error('THE FILE WAS NOT RESTORED. Recover it from git before doing anything else.');
  process.exitCode = 2;
} else if (!allRed) {
  console.error('A mutation left the suite green: those arms are not testing what they claim to.');
  process.exitCode = 1;
}
