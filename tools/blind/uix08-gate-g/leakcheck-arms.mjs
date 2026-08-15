#!/usr/bin/env node
// leakcheck-arms.mjs — the gate that must pass BEFORE a judge is handed the pack.
//
// WHY IT EXISTS, AND WHY IT HAS A SELF-TEST THAT BUILDS A BROKEN PACK ON PURPOSE
// ------------------------------------------------------------------------------
// `RULES` rule 6 and `HAZARDS` §0/§0b between them say the same thing four ways: a control you
// have never seen fail is not evidence, it is a second copy of the experiment. So this tool ships
// with `--self-test`, which builds a **deliberately leaky pair** — no redaction, arm-named
// directories, arm-named page titles — and asserts that the gate goes RED on it and GREEN on the
// real one. A guard that has only ever printed "ok" is indistinguishable from a rubber stamp.
//
// WHAT IT CHECKS, and each is a channel somebody could decide the pack through:
//
//   L1  the answer key is not inside the pack, and nothing in the pack points at it
//   L2  the arm directory names carry no meaning — both must come from the neutral codename list
//   L3  the page titles are identical, byte for byte
//   L4  no tell survives in anything a judge could fetch: served JS, HTML, the pack's own
//       metadata and prompt files, and the filenames themselves
//   L5  the two trees differ in EXACTLY the declared way — one file, one line. A wider diff is
//       either a second uncontrolled variable (which makes the contrast uninterpretable) or a
//       redaction that ran on one arm and not the other (which is itself the leak)
//   L6  both arms actually parse — a pack that does not boot is discovered by the judge
//   L7  the arms are NOT identical. An inseparable pair is `inert` and cannot pass, and the most
//       embarrassing way to get one is an ablation that silently failed to apply
//
// L5 and L7 are deliberately opposed: one fails if the arms differ too much, the other if they do
// not differ at all. That is the shape `HAZARDS` §0b asks for — a guard with sight on both halves
// of the number line, rather than one that can only see the deviation its author expected.
//
// USAGE
//   node tools/blind/uix08-gate-g/leakcheck-arms.mjs --pack <dir> [--reveal <dir>] [--json out]
//   node tools/blind/uix08-gate-g/leakcheck-arms.mjs --self-test [--scratch <dir>]
//
// EXIT 0 clean · 3 at least one channel leaks — DO NOT dispatch a judge · 1 usage/IO
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseArgs, wantsHelp, usage, die, log, EXIT, ensureDir, writeJson, REPO_ROOT } from '../../lib/cli.mjs';
import { tellsIn } from './tells.mjs';

const USAGE = `
leakcheck-arms.mjs — gate a §G arm pair before a judge sees it.

  --pack <dir>     pack directory built by build-arms.mjs   (required unless --self-test)
  --reveal <dir>   where the key is, so L1 can prove it is NOT in the pack
  --json <file>    write the full table
  --self-test      build a deliberately leaky pair and prove this gate goes red on it
  --scratch <dir>  where --self-test builds its two throwaway packs

EXIT 0 clean · 3 leaking · 1 usage/IO.
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

/** Every text file under `dir` a judge could plausibly fetch or open. */
function textFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        // `game/data` and `game/assets` are the world itself — in-fiction prose the player is
        // MEANT to read, identical in both arms, and redacting it would change the game. It is
        // excluded on purpose and the exclusion is stated rather than silent.
        if (/[/\\]game[/\\](data|assets|vendor)$/.test(p)) continue;
        stack.push(p);
      } else if (/\.(js|mjs|html|json|txt|md|css)$/.test(e.name)) out.push(p);
    }
  }
  return out;
}

function checkPack(packDir, revealDir) {
  const rows = [];
  const add = (id, pass, detail) => rows.push({ id, pass, detail });
  const pack = JSON.parse(fs.readFileSync(path.join(packDir, 'pack.json'), 'utf8'));
  const arms = pack.arms;

  // ---- L1 the key is outside the pack, and nothing inside points at it ----------------------
  const keyInside = fs.existsSync(path.join(packDir, 'mapping.json'))
    || textFiles(packDir).some((p) => /mapping\.json$/.test(p));
  const pointers = textFiles(packDir).filter((p) => /\.(json|txt|md)$/.test(p))
    .filter((p) => /mapping|reveal|ablated_arm|our_arm/i.test(fs.readFileSync(p, 'utf8')));
  add('L1 key not in pack', !keyInside && pointers.length === 0,
    `mapping inside=${keyInside} pointers=${pointers.map((p) => path.relative(packDir, p)).join(',') || 'none'}`);
  if (revealDir) {
    const rel = path.relative(path.resolve(packDir), path.resolve(revealDir));
    add('L1b key dir is outside pack', rel.startsWith('..') || path.isAbsolute(rel), `reveal=${revealDir}`);
  }

  // ---- L2 the codenames carry no meaning ----------------------------------------------------
  const NEUTRAL = /^[a-z]+$/;
  const meaningful = arms.filter((a) => !NEUTRAL.test(a.dir) || tellsIn(a.dir).length);
  add('L2 arm names neutral', meaningful.length === 0,
    `dirs=${arms.map((a) => a.dir).join(',')}${meaningful.length ? ' MEANINGFUL=' + meaningful.map((a) => a.dir).join(',') : ''}`);

  // ---- L3 identical page titles -------------------------------------------------------------
  const titles = arms.map((a) => {
    const html = fs.readFileSync(path.join(packDir, a.dir, 'game', 'index.html'), 'utf8');
    const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
    return m ? m[1] : '(none)';
  });
  add('L3 titles identical', new Set(titles).size === 1, `titles=${JSON.stringify(titles)}`);

  // ---- L4 no tell survives in anything fetchable ---------------------------------------------
  //
  // Reported as a table of WHICH tell in WHICH file, never as a bare count. The `[NAME-n]` leak
  // that voided a whole wave-1 pack was found by a judge enumerating channels, and a detector
  // that only prints a total is one nobody can audit.
  //
  // AND IT IS SPLIT THREE WAYS, BECAUSE ONE COUNT WOULD BE WRONG IN BOTH DIRECTIONS.
  //
  // A tell that appears IDENTICALLY IN BOTH ARMS cannot tell a judge which arm it is playing —
  // it is the same bytes on both ports. What it can do is name the subject, which is a different
  // and lesser harm. Reporting those two as one number would either fail every honest pack (the
  // engine calls a variable `dialogueArm` in code that both arms ship) or, if the threshold were
  // relaxed to accommodate them, would stop seeing the one hit that actually decides the pack.
  //
  //   L4a  ASYMMETRIC tells — present in one arm's bytes and not the other's. These DECIDE the
  //        pack. Zero, minus one declared exception: the ablation token itself, which cannot be
  //        removed without removing the ablation.
  //   L4b  THIS ITEM named anywhere. Fatal, because RI-UIX08 §G prints the ablation recipe, so a
  //        judge who learns the item id derives the arm in one step (ARBITRATION S51).
  //   L4c  everything else — reported with counts, never red, so the residual is visible rather
  //        than laundered.
  const perArm = new Map();
  const hits = [];
  for (const a of arms) {
    const set = new Set();
    for (const p of textFiles(path.join(packDir, a.dir))) {
      const rel = path.relative(path.join(packDir, a.dir), p);
      for (const t of tellsIn(rel)) { hits.push({ arm: a.dir, where: rel, kind: 'filename', tell: t }); set.add(`filename:${rel}:${t}`); }
      const lines = fs.readFileSync(p, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const t of tellsIn(lines[i])) {
          hits.push({ arm: a.dir, where: `${rel}:${i + 1}`, kind: 'content', tell: t, line: lines[i].trim().slice(0, 120) });
          set.add(`content:${rel}:${lines[i].trim()}:${t}`);
        }
      }
    }
    perArm.set(a.dir, set);
  }
  const [sA, sB] = arms.map((a) => perArm.get(a.dir));
  const asym = [...sA].filter((x) => !sB.has(x)).concat([...sB].filter((x) => !sA.has(x)));
  // The one declared exception, named in full so it cannot widen quietly.
  const ALLOWED_ASYMMETRY = /ui\/system\.js:this\.dialogueArm = \{ links: (true|false), opaque: false \};:dialoguearm/;
  const unexplained = asym.filter((x) => !ALLOWED_ASYMMETRY.test(x));
  add('L4a no unexplained asymmetric tell', unexplained.length === 0,
    `asymmetric=${asym.length} explained_by_the_ablation_token=${asym.length - unexplained.length} unexplained=${unexplained.length}`);

  // Narrowed after the first run, and the narrowing is itself the finding: `null control` fired on
  // `render/sky.js` and `render/post/grade.js`, which carry unrelated visual arms of their own and
  // ship in BOTH arms identically. A row that reds on a phrase present on both ports is measuring
  // the codebase's habits, not this pack's blindness. What stays is what names THIS item or THIS
  // gate, plus `ablat`, which no unrelated file in the tree uses.
  const ITEM = /(uix08|ri-uix08|human gate|gate g|§g|ablat)/i;
  const named = [];
  for (const a of arms) {
    for (const p of textFiles(path.join(packDir, a.dir))) {
      const src = fs.readFileSync(p, 'utf8');
      if (ITEM.test(src) || ITEM.test(p)) named.push(path.relative(packDir, p));
    }
  }
  // The handouts a judge is given on purpose are held to the same bar.
  for (const p of fs.readdirSync(packDir).filter((n) => /\.(json|txt|md)$/.test(n))) {
    if (ITEM.test(fs.readFileSync(path.join(packDir, p), 'utf8')) || ITEM.test(p)) named.push(p);
  }
  add('L4b this item is never named', named.length === 0, named.slice(0, 6).join(',') || 'not named anywhere a judge can reach');

  add('L4c residual subject tells (informational, never red)', true,
    `${hits.length} hit(s) across both arms, identical on both ports — they name the SUBJECT, not the ARM`);

  // ---- L5/L7 the diff is exactly one line in exactly one file --------------------------------
  let diffFiles = [], diffLines = -1;
  try {
    execFileSync('diff', ['-rq', path.join(packDir, arms[0].dir), path.join(packDir, arms[1].dir)], { encoding: 'utf8' });
    diffFiles = [];
  } catch (e) {
    diffFiles = String(e.stdout || '').trim().split('\n').filter(Boolean);
  }
  if (diffFiles.length === 1) {
    const m = /^Files (.+) and (.+) differ$/.exec(diffFiles[0]);
    if (m) {
      try { execFileSync('diff', [m[1], m[2]], { encoding: 'utf8' }); diffLines = 0; }
      catch (e) { diffLines = String(e.stdout || '').split('\n').filter((l) => /^[<>]/.test(l)).length; }
    }
  }
  add('L5 arms differ in one file, one line pair', diffFiles.length === 1 && diffLines === 2,
    `files=${diffFiles.length} changed_lines=${diffLines}`);
  add('L7 arms are NOT identical', diffFiles.length > 0,
    diffFiles.length ? 'the ablation applied' : 'IDENTICAL — the ablation did not apply; the pair is inert and cannot pass');

  // ---- L6 both arms parse ---------------------------------------------------------------------
  const unparsable = [];
  for (const a of arms) {
    const dir = path.join(packDir, a.dir, 'game', 'src');
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (p.endsWith('.js')) {
          try { execFileSync(process.execPath, ['--check', p], { stdio: 'pipe' }); }
          catch { unparsable.push(path.relative(packDir, p)); }
        }
      }
    }
  }
  add('L6 both arms parse', unparsable.length === 0, unparsable.slice(0, 5).join(',') || 'all files parse');

  return { rows, hits: hits.slice(0, 60), hit_total: hits.length, titles, diff_files: diffFiles.length, diff_lines: diffLines };
}

// ---- self-test ----------------------------------------------------------------------------------
if (args['self-test']) {
  const scratch = path.resolve(String(args.scratch || path.join(REPO_ROOT, '.leakcheck-selftest')));
  fs.rmSync(scratch, { recursive: true, force: true });
  ensureDir(scratch);
  const builder = path.join(REPO_ROOT, 'tools/blind/uix08-gate-g/build-arms.mjs');
  const build = (name, extra) => execFileSync(process.execPath,
    [builder, '--out', path.join(scratch, name, 'pack'), '--reveal', path.join(scratch, name, 'key'),
      '--seed', '99', '--force', ...extra], { stdio: 'pipe', encoding: 'utf8' });

  log('self-test: building the deliberately LEAKY pair...');
  build('leaky', ['--leaky']);
  const leaky = checkPack(path.join(scratch, 'leaky', 'pack'), path.join(scratch, 'leaky', 'key'));
  log('self-test: building the real pair...');
  build('clean', []);
  const clean = checkPack(path.join(scratch, 'clean', 'pack'), path.join(scratch, 'clean', 'key'));

  const leakyFails = leaky.rows.filter((r) => !r.pass).map((r) => r.id);
  const cleanFails = clean.rows.filter((r) => !r.pass).map((r) => r.id);
  log('');
  log(`  LEAKY pair: ${leakyFails.length} check(s) red — ${leakyFails.join(', ') || 'NONE, which is the failure'}`);
  log(`  CLEAN pair: ${cleanFails.length} check(s) red — ${cleanFails.join(', ') || 'none'}`);
  log(`  leaky tell hits: ${leaky.hit_total}   clean tell hits: ${clean.hit_total}`);
  const ok = leakyFails.length > 0 && cleanFails.length === 0;
  log('');
  log(ok
    ? 'SELF-TEST PASSES: the gate goes red on a pack built to leak and green on the real one.'
    : 'SELF-TEST FAILS: a gate that cannot separate a leaky pack from a clean one is not a gate.');
  if (args.json) writeJson(path.resolve(String(args.json)), { leaky, clean, ok });
  process.exit(ok ? 0 : 3);
}

if (!args.pack) usage(USAGE, EXIT.USAGE);
const packDir = path.resolve(String(args.pack));
if (!fs.existsSync(path.join(packDir, 'pack.json'))) die(EXIT.USAGE, `no pack.json in ${packDir}`);
const res = checkPack(packDir, args.reveal ? path.resolve(String(args.reveal)) : null);
for (const r of res.rows) log(`  ${r.pass ? 'ok  ' : 'LEAK'} ${r.id}  ${r.detail}`);
for (const hh of res.hits.slice(0, 20)) log(`       ${hh.kind} ${hh.where} :: '${hh.tell}'${hh.line ? '  ' + hh.line : ''}`);
if (args.json) writeJson(path.resolve(String(args.json)), res);
const red = res.rows.filter((r) => !r.pass);
log(red.length ? `\n${red.length} channel(s) leak — DO NOT dispatch a judge.` : '\nclean — the pack may be dispatched.');
process.exit(red.length ? 3 : 0);
