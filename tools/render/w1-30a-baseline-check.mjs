#!/usr/bin/env node
/**
 * w1-30a-baseline-check.mjs — prove that the "before" really is the before.
 *
 * `game/src/render/post/baseline-composite.js` holds the pre-A compositor so that A/B can be
 * measured in one GPU run on identical frames. That is only worth anything if the copy is the
 * original. This re-extracts the fragment shader from git at the recorded commit and compares it
 * to the copy, byte for byte.
 *
 * THE NULL CONTROL IS THE POINT OF THIS FILE, so it is not the trivial one. Comparing against an
 * empty string would pass for the wrong reason. `--null` compares against the CURRENT composite's
 * shader — a real, plausible, wrong answer: it is a working compositor from the same file at the
 * same path, and the check must reject it.
 *
 *   node tools/render/w1-30a-baseline-check.mjs
 *   node tools/render/w1-30a-baseline-check.mjs --null      (must exit 1)
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NULL_MODE = process.argv.includes('--null');

const mod = await import(path.join(REPO, 'game/src/render/post/baseline-composite.js'));

/** Pull the template literal assigned to `fragmentShader:` out of a composite module's source. */
function extractFragment(src) {
  const i = src.indexOf('fragmentShader:');
  if (i < 0) throw new Error('no fragmentShader: in source');
  // GLSL contains no backticks, so the literal ends at the next one. Deliberately not a regex
  // over the whole file: the old delimiter (`` `}); ``) was a formatting accident and broke the
  // moment the file was reformatted, which is exactly the kind of check that fails open later.
  const start = src.indexOf('`', i) + 1;
  const end = src.indexOf('`', start);
  if (start <= 0 || end < 0) throw new Error('could not delimit the fragment shader literal');
  return src.slice(start, end);
}

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

let gitSrc;
try {
  gitSrc = execFileSync('git', ['show', `${mod.BASELINE_COMMIT}:game/src/render/post/composite.js`], { cwd: REPO, encoding: 'utf8' });
} catch (e) {
  console.error(`FAIL: cannot read composite.js at ${mod.BASELINE_COMMIT}: ${e.message}`);
  process.exit(2);
}

const fromGit = extractFragment(gitSrc);
const held = NULL_MODE
  ? extractFragment(fs.readFileSync(path.join(REPO, 'game/src/render/post/composite.js'), 'utf8'))
  : mod.BASELINE_FRAGMENT;

const out = {
  check: 'W1-30A baseline fidelity',
  mode: NULL_MODE ? 'NULL CONTROL — compares the CURRENT compositor, must fail' : 'live',
  baseline_commit: mod.BASELINE_COMMIT,
  recorded_sha: mod.BASELINE_SHA,
  git_sha: sha(fromGit),
  held_sha: sha(held),
  git_matches_recorded: sha(fromGit) === mod.BASELINE_SHA,
  held_matches_git: sha(held) === sha(fromGit),
};
out.result = (out.git_matches_recorded && out.held_matches_git) ? 'GREEN' : 'RED';
console.log(JSON.stringify(out, null, 2));
if (out.result !== 'GREEN') process.exit(1);
