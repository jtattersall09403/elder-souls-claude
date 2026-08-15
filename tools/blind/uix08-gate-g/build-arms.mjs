#!/usr/bin/env node
// build-arms.mjs — seal the two playable arms of the RI-UIX08 §G human gate.
//
// WHAT THIS BUILDS, AND WHY IT IS TWO WHOLE TREES RATHER THAN ONE TREE AND A SWITCH
// ---------------------------------------------------------------------------------
// `HAZARDS` §11: four different agents changed four files under `game/` in 45 seconds, and an
// experiment that serves an arm from the live repo is measuring a moving target. The remedy that
// was tried and failed was a *detector* that aborts when the tree moves — it fired on both of its
// real runs, neither time for the reason it was built. So both arms are frozen by construction:
// copied out of a real `git worktree` checkout pinned to one commit, never read from the live
// tree, and never re-read after the pack is sealed.
//
// THE ABLATION, AND THE ONE SENTENCE IT TURNS ON
// ----------------------------------------------
// The gate's own words: *the same window, the same prose, the same topic column, with the inline
// links removed and the topics they would have added present in the column from the start.*
//
// That is not a broken null and it is not a weaker build. It is **strictly no less generous**:
// every topic the player could reach by following a lit word inside the prose is in the column
// in both arms, from the moment the answer that grants it is DISPLAYED — which is a moment both
// arms share. (An earlier formulation keyed the grant on *the click that would have unlocked it*,
// and a plan reviewer correctly refused it: in an arm with no links, that click does not exist,
// so the arm was unbuildable as written. This is the repaired version and the difference matters:
// keying on display is what makes the two columns comparable at all.)
//
// So what is removed is exactly one thing — the affordance of finding a word by reading. That is
// what most dialogue systems ship, which is what makes it plausible, which is what makes a judge
// who cannot separate it informative rather than embarrassing.
//
// WHAT QUARANTINE MEANS HERE, STATED HONESTLY INCLUDING WHAT IT DOES NOT COVER
// ----------------------------------------------------------------------------
// Covered by construction: the two trees are byte-identical apart from ONE token; the codenames
// are drawn from a neutral list and carry no ordering; the ports are assigned by the OS; the page
// titles are identical; every comment naming the item, the gate or the arm is redacted, and
// redacted IDENTICALLY in both arms so the redaction itself is not a channel.
//
// NOT covered, and it is dishonest to imply otherwise: a judge that fetches
// `/src/ui/system.js` from both ports and diffs them can identify the arms in one command. No
// static site served over HTTP can prevent that. It is prevented by protocol, not by code — and
// it is DETECTABLE after the fact, because `play.mjs` records every HTTP path the browser asked
// for, and a module fetched twice in one session is a fetch the engine did not make.
//
// USAGE
//   node tools/blind/uix08-gate-g/build-arms.mjs --out <packdir> --reveal <dir> [--seed N]
//   node tools/blind/uix08-gate-g/build-arms.mjs ... --leaky     # for the leak-check self-test
//
// EXIT 0 built · 1 usage/IO · 2 could not run
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  parseArgs, wantsHelp, usage, die, log, EXIT, ensureDir, writeJson, sha256, mulberry32, REPO_ROOT,
} from '../../lib/cli.mjs';
import { TELLS, hasTell } from './tells.mjs';

const USAGE = `
build-arms.mjs — seal the two playable arms of the RI-UIX08 §G human gate.

  --out <dir>       pack directory to create (holds both arm roots)        (required)
  --reveal <dir>    where the mapping is written — MUST NOT be inside --out (required)
  --commit <sha>    baseline commit to freeze (default: current HEAD)
  --seed <n>        seed for codenames and arm assignment (default: time-derived, recorded)
  --leaky           build a DELIBERATELY LEAKY pair: no redaction, arm-named directories,
                    arm-named page titles. Only the leak-check self-test should pass this.
  --force           overwrite an existing pack

EXIT 0 built · 1 usage/IO · 2 could not run.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (!args.out || !args.reveal) usage(USAGE, EXIT.USAGE);

const OUT = path.resolve(String(args.out));
const REVEAL = path.resolve(String(args.reveal));
const LEAKY = !!args.leaky;
if (REVEAL === OUT || REVEAL.startsWith(OUT + path.sep)) {
  die(EXIT.USAGE, `--reveal (${REVEAL}) is inside --out (${OUT}). The answer key may never live ` +
    'inside the pack a judge is handed.');
}

const seed = args.seed !== undefined ? Number(args.seed) : (Date.now() % 2147483647);
const rnd = mulberry32(seed);

// ---- the baseline, pinned ---------------------------------------------------------------------
//
// `HAZARDS` §12: on this tree `HEAD` is not your baseline, it is a moving target that a sibling's
// whole-tree bank re-points several times an hour. The commit is resolved ONCE, here, recorded in
// both the pack and the key, and everything else reads the worktree.
const git = (...a) => execFileSync('git', a, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
const COMMIT = String(args.commit || git('rev-parse', 'HEAD'));

/**
 * The pinned `game/` tree, extracted from the COMMIT OBJECT, not copied from the working tree.
 *
 * This started as `git worktree add --detach`, which is the right instrument for a control clone
 * and the wrong one here — it checks out the WHOLE repository, and this repository is 1.8 GB of
 * `reports/` and `corpus/` artefacts. Two of them filled the disk mid-build (`No space left on
 * device`, 96% full), which is the failure `browser.mjs assertCaptureDiskSpace` exists to make
 * loud and which here killed the build instead.
 *
 * `git archive <sha> game` gives exactly the same frozen bytes for exactly the paths we serve —
 * it reads the commit's tree object and never touches the working tree — at 36 MB instead of
 * 1.8 GB. It is not the "hard-link copy of the live tree" that `HAZARDS` §11 forbids; the thing
 * §11 forbids is a copy that MOVES, and a tree object cannot move.
 */
function extractGameAt(commit, dest) {
  ensureDir(dest);
  try {
    execFileSync('bash', ['-c', `git archive ${commit} game | tar -x -C ${JSON.stringify(dest)}`],
      { cwd: REPO_ROOT, stdio: 'pipe' });
  } catch (e) {
    die(EXIT.INTERNAL, `could not extract game/ at ${commit}: ${e.message}`);
  }
  if (!fs.existsSync(path.join(dest, 'game', 'index.html'))) {
    die(EXIT.INTERNAL, `git archive ${commit} produced no game/index.html at ${dest}`);
  }
  return path.join(dest, 'game');
}

// ---- codenames: neutral, orderless, and drawn before anything knows which arm is which ---------
//
// Nothing in a codename may rank, hint or alphabetise toward an arm. These are marsh minerals and
// birds; none is "better" than another, none is a Morrowind or Souls word, and the pair is drawn
// BEFORE the coin decides which is ablated, so the draw cannot be conditioned on the assignment.
const CODENAMES = [
  'cinnabar', 'verdigris', 'kestrel', 'porphyry', 'tessera', 'quillon',
  'marlstone', 'saltpan', 'basalt', 'osprey', 'gypsum', 'heron',
];

function pickTwo() {
  const pool = CODENAMES.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [pool[0], pool[1]];
}

// ---- redaction ---------------------------------------------------------------------------------
//
// PURE COMMENT LINES ONLY. A regex comment-stripper that walks code is a good way to break a
// regex literal or a URL inside a string and ship a pack that does not boot; and a pack that does
// not boot is discovered by the judge, at which point the run is over. So a line is rewritten only
// when everything before the comment marker is whitespace — a line that is nothing but comment.
// Code lines carrying a trailing comment with a tell are NOT rewritten here; they are reported by
// `leakcheck-arms.mjs` instead, so the two tools disagree loudly rather than quietly.
const FILLER = '//';

/**
 * EVERY pure-comment line goes, not only the ones carrying a tell.
 *
 * A tell-list is a one-sided guard (`HAZARDS` §0b) when it is the ONLY filter: it can only see
 * the leaks its author thought of. And the first build of this pack proved it — tell-matching
 * alone left `dialogue.js`'s opening line intact: *"a floating index of keywords you find by
 * reading, not a menu of replies"*. That names the mechanism under test in one sentence. It
 * carries none of the tells because it is a description rather than a label, and a judge reading
 * it learns what the good arm is supposed to do, which is one step from deriving which arm it is
 * playing. So the rule is the complement: nothing that is only prose survives, and the tell-list
 * is demoted to what it is good at — telling `leakcheck-arms.mjs` what to hunt in what is LEFT.
 */
function redactSource(text) {
  const out = [];
  let n = 0;
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const t = raw.trim();
    let line = raw;
    const isLineComment = t.startsWith('//');
    const startsBlock = t.startsWith('/*');
    const isBlockBody = inBlock || startsBlock;
    if (isLineComment || isBlockBody) {
      const indent = raw.slice(0, raw.length - raw.trimStart().length);
      // Keep the block structure — a `*/` that vanishes turns the rest of the file into a comment.
      if (isBlockBody) {
        const closes = t.includes('*/');
        line = indent + (startsBlock ? (closes ? '/* */' : '/*') : (closes ? ' */' : ' *'));
      } else {
        line = indent + FILLER;
      }
      if (line !== raw) n++;
    }
    if (isBlockBody) inBlock = !t.includes('*/');
    out.push(line);
  }
  return { text: out.join('\n'), redacted: n };
}

/**
 * A stripper that walks source is a stripper that will eventually eat a line inside a template
 * literal and ship a pack that does not boot — and a pack discovered not to boot is discovered by
 * the judge, mid-run, which ends the run. So every rewritten file is PARSED, and a file that no
 * longer parses is restored to its original bytes and reported. The guard is per-file, so one
 * awkward template literal costs one file's comments rather than the whole pack.
 */
function parses(file) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); return true; }
  catch { return false; }
}

function walk(dir, filter) {
  const found = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (!filter || filter(p)) found.push(p);
    }
  }
  return found;
}

// ---- build -------------------------------------------------------------------------------------
const base = path.join(path.dirname(OUT), `base-${COMMIT.slice(0, 12)}`);
const baseGame = fs.existsSync(path.join(base, 'game', 'index.html'))
  ? path.join(base, 'game')
  : extractGameAt(COMMIT, base);

if (fs.existsSync(OUT)) {
  if (!args.force && fs.readdirSync(OUT).length) die(EXIT.USAGE, `${OUT} exists and is not empty (use --force)`);
  fs.rmSync(OUT, { recursive: true, force: true });
}
ensureDir(OUT);
ensureDir(REVEAL);

const [codeA, codeB] = pickTwo();
// The coin. One of the two arms gets the ablation; which one is decided here and recorded ONLY in
// the reveal file. Nothing downstream of this line branches on it except the one patched token.
const ablatedIs = rnd() < 0.5 ? codeA : codeB;

const ARM_FLAG_ON = 'this.dialogueArm = { links: true, opaque: false };';
const ARM_FLAG_OFF = 'this.dialogueArm = { links: false, opaque: false };';

const arms = [];
for (const code of [codeA, codeB]) {
  const dirName = LEAKY ? (code === ablatedIs ? 'ablated-arm' : 'ours-arm') : code;
  const root = path.join(OUT, dirName);
  ensureDir(root);
  fs.cpSync(baseGame, path.join(root, 'game'), { recursive: true });

  // --- the ablation, and it is ONE token -----------------------------------------------------
  const sysPath = path.join(root, 'game', 'src', 'ui', 'system.js');
  let sys = fs.readFileSync(sysPath, 'utf8');
  if (!sys.includes(ARM_FLAG_ON)) {
    die(EXIT.INTERNAL, `the arm flag was not found verbatim in ${sysPath}. Expected:\n  ${ARM_FLAG_ON}\n` +
      '  The build refuses to guess: a silently-unapplied ablation produces two identical arms, ' +
      'which is the inseparable pair the gate treats as `inert`.');
  }
  if (code === ablatedIs) sys = sys.replace(ARM_FLAG_ON, ARM_FLAG_OFF);
  fs.writeFileSync(sysPath, sys);

  // --- redaction, applied identically to both arms --------------------------------------------
  let redacted = 0, files = 0;
  const restored = [];
  if (!LEAKY) {
    const srcs = walk(path.join(root, 'game', 'src'), (p) => p.endsWith('.js'));
    for (const p of srcs) {
      const before = fs.readFileSync(p, 'utf8');
      const r = redactSource(before);
      if (!r.redacted) continue;
      fs.writeFileSync(p, r.text);
      if (!parses(p)) { fs.writeFileSync(p, before); restored.push(path.relative(root, p)); continue; }
      redacted += r.redacted; files++;
    }
    // `index.html` and the README are HTML/markdown, so the JS stripper does not apply; they get
    // the tell-based pass, which is what a tell-list is actually for.
    for (const p of [path.join(root, 'game', 'index.html'), path.join(root, 'game', 'README.md')]) {
      if (!fs.existsSync(p)) continue;
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      let n = 0;
      const kept = lines.map((l) => (hasTell(l) && !/[<>{}();=]/.test(l) ? (n++, '') : l));
      if (n) { fs.writeFileSync(p, kept.join('\n')); redacted += n; files++; }
    }
    // The tests directory ships with the game root and is pure prose about the item. It is not
    // needed to play and every line of it is a tell, so it is removed rather than redacted.
    fs.rmSync(path.join(root, 'game', 'test'), { recursive: true, force: true });
  }

  // --- the page title, identical in both arms -------------------------------------------------
  const idx = path.join(root, 'game', 'index.html');
  let html = fs.readFileSync(idx, 'utf8');
  html = html.replace(/<title>[\s\S]*?<\/title>/i, LEAKY
    ? `<title>${code === ablatedIs ? 'Ablated arm (no inline links)' : 'Our build'}</title>`
    : '<title>Build</title>');
  fs.writeFileSync(idx, html);

  arms.push({
    codename: code, dir: dirName, entry: `${dirName}/game/index.html`,
    files_redacted: files, comment_lines_redacted: redacted, files_restored_unparsable: restored,
  });
}

// ---- what a judge is handed ---------------------------------------------------------------------
const promptSrc = path.join(REPO_ROOT, 'reports/blind/uix08-gate-g/PROMPT-G-verbatim.txt');
if (fs.existsSync(promptSrc)) fs.copyFileSync(promptSrc, path.join(OUT, 'PROMPT-verbatim.txt'));
const protoSrc = path.join(REPO_ROOT, 'reports/blind/uix08-gate-g/DRIVER-PROTOCOL.md');
if (fs.existsSync(protoSrc)) fs.copyFileSync(protoSrc, path.join(OUT, 'DRIVER-PROTOCOL.md'));

// pack.json carries NO mapping. Everything in it is safe for a judge to read.
// NOTHING IN HERE MAY BE A ROUTE BACK TO THE REPO. The first build published
// `baseline_commit`, and the commit that seals this pack has a headline naming the ablated arm in
// so many words — so a judge with the sha could `git show` it and be told the answer by our own
// commit message. The sha, the seed and the worktree path live in the KEY, which is outside the
// pack; what is left here is what a judge needs to run the tool and nothing else.
const pack = {
  schema: 'elder-souls/played-pair@1',
  built_at: new Date().toISOString(),
  leaky: LEAKY,
  arms: arms.map((a) => ({ codename: a.codename, dir: a.dir, entry: a.entry })),
  redaction: arms.map((a) => ({
    codename: a.codename, files: a.files_redacted, lines: a.comment_lines_redacted,
    restored_unparsable: a.files_restored_unparsable,
  })),
  tells_used: TELLS.length,
  play_order_note: 'The order the arms are played is assigned per judge by the dispatcher, not here.',
};
writeJson(path.join(OUT, 'pack.json'), pack);

// The key. OUTSIDE the pack, by the same convention `tools/blind/make-pair.mjs` has used since
// wave 0, and it records the seed so the identical pack can be rebuilt after a container restart.
writeJson(path.join(REVEAL, 'mapping.json'), {
  schema: 'elder-souls/uix08-gate-g-key@1',
  built_at: pack.built_at,
  baseline_commit: COMMIT,
  seed,
  ablated_arm: ablatedIs,
  our_arm: ablatedIs === codeA ? codeB : codeA,
  rebuild: `node tools/blind/uix08-gate-g/build-arms.mjs --out <dir> --reveal <dir> --commit ${COMMIT} --seed ${seed}`,
  note: 'Open only after every judge has recorded its five answers verbatim and the separability '
      + 'reader has returned. Reading this before then destroys the run and cannot be undone.',
});

log(`built ${arms.length} arms at ${OUT}`);
for (const a of arms) log(`  ${a.codename}  ${a.entry}  (${a.comment_lines_redacted} comment lines redacted in ${a.files_redacted} files)`);
log(`key: ${path.join(REVEAL, 'mapping.json')}   baseline ${COMMIT.slice(0, 10)}   seed ${seed}`);
log(`pack sha256(pack.json)=${sha256(fs.readFileSync(path.join(OUT, 'pack.json'))).slice(0, 16)}`);
