#!/usr/bin/env node
// controls-authoring-leak.mjs — the negative-control battery for W1-DIALOGUE-AUTHORING-LEAK,
// as a COMMITTED, RE-RUNNABLE TOOL rather than a paragraph in a status file.
//
// =========================================================================================
// WHY THIS EXISTS AS A FILE
// =========================================================================================
// Rounds 1 and 2 both described their controls in prose and ran them from a shell script that
// lived inside a verdict's artefact directory — which `HAZARDS` §17 makes immutable, so nobody
// could re-run them without copying the script out. The round-2 critic re-ran all seven by
// hand, which is exactly the work a tool should have saved. This is that tool.
//
// `HAZARDS` §31 rule 4 is the standard every arm is written to: *a self-test against a fixture
// proves the predicate; only hand-authoring the defect into the SHIPPED artefact proves the
// pipeline.* Every arm below mutates a real shipped file inside a throwaway clone
// (`tools/control-clone.mjs`, §5a) and then runs the real check against it.
//
// =========================================================================================
// WHAT ROUND 3 ADDED, AND WHY
// =========================================================================================
// The round-2 critic falsified round 2's evidence-mutation tripwire. Round 2 hashed the
// evidence inside `main()`, so it fired only for round 1's *placement* of the generator import
// (inside a function). **A static top-level `import` — the ordinary ESM form, and the one
// `HAZARDS` §31 literally describes — exited 0 printing PASS with the leak deleted**, because
// ESM evaluates every import before the importing module's body. Round 2's battery had no arm
// for it, which is why it shipped.
//
// Arms `H1`–`H3` are that missing battery: the generator import placed at each of the three
// positions the critic tested, plus the position that would defeat a module-scope seal by
// sitting above it. **All four must now exit 4 and leave the leak in the file.** `H1` is the
// arm that was green in round 2 and must be red now; it is the reason this file exists.
//
// Arm `I` is the same idea for the round-3 writing defect: restore `Local. Useful.` as the
// RG-BWC/saxhleel ADDRESS and the voice check must go red on the ADDRESS half. It could not
// have gone red in round 2 — round 2 gated only the composed line, which borrowed its
// exclusivity from the STANCE half.
//
// Arm `D` is kept as the anchor: it is the control that failed in round 1 (the check deleted
// the evidence and reported its absence) and the one that proves evidence SURVIVAL, not just
// a red exit code. Round 2's arms A, B, B2, C, E, F, G1 were re-run and reproduced exactly by
// the round-2 critic and are recorded as settled in that verdict; they are not re-run here and
// this file says so rather than implying a completeness it does not have.
//
// Usage:
//   node tools/dialogue/controls-authoring-leak.mjs            # run every arm
//   node tools/dialogue/controls-authoring-leak.mjs --only H1,D
//   node tools/dialogue/controls-authoring-leak.mjs --keep      # leave the clone for inspection
//   node tools/dialogue/controls-authoring-leak.mjs --json <path>
//
// Exit codes: 0 every arm behaved as required · 1 an arm did not · 2 harness/IO error.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };

/** The leaked string exactly as the blind judge saw it. */
const LEAK = 'Say it in one line. Local. Useful.';
/** The ADDRESS half, which rounds 1 and 2 both left in place. */
const ADDRESS_LEAK = 'Local. Useful.';

const WRITABLE = [
  'game/data/dialogue/greetings.json',
  'game/data/dialogue/faction-refusals.json',
  'tools/dialogue/gen-greetings.mjs',
  'tools/dialogue/check-authoring-leaks.mjs',
  'tools/dialogue/check-greeting-voice.mjs',
  'tools/lib/evidence-seal.mjs',
];

// -----------------------------------------------------------------------------------------
// clone plumbing
// -----------------------------------------------------------------------------------------
function makeClone(label) {
  const out = execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'make',
    '--label', label, '--writable', WRITABLE.join(',')], { cwd: ROOT, encoding: 'utf8' });
  return out.trim().split('\n').pop().trim();
}

function restore(dir, rels) {
  for (const rel of rels) fs.copyFileSync(path.join(ROOT, rel), path.join(dir, rel));
}

function runCheck(dir, tool) {
  const r = spawnSync('node', [path.join(dir, tool)], { cwd: dir, encoding: 'utf8', timeout: 180000 });
  return { exit: r.status === null ? -1 : r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

/** How many times the leak string appears in the clone's shipped greetings file. */
function grepLeak(dir, needle = LEAK) {
  const p = path.join(dir, 'game/data/dialogue/greetings.json');
  if (!fs.existsSync(p)) return -1;
  return (fs.readFileSync(p, 'utf8').split(needle).length - 1);
}

/** Hand-author the leak into the SHIPPED artefact — §31 rule 4, not into a fixture. */
function injectIntoShipped(dir) {
  const p = path.join(dir, 'game/data/dialogue/greetings.json');
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  doc.pools[180].lines[3] = LEAK;
  fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
  return '.pools[180].lines[3]';
}

/** Strip the generator's RUN_DIRECTLY guard so importing it writes again, as in round 1. */
function stripRunDirectlyGuard(dir) {
  const p = path.join(dir, 'tools/dialogue/gen-greetings.mjs');
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = s.replace(/if\s*\(\s*RUN_DIRECTLY\s*\)\s*\{/, 'if (true) {');
  if (s === before) {
    s = s.replace(/^(\s*)if\s*\(RUN_DIRECTLY\)/m, '$1if (true)');
  }
  if (s === before) throw new Error('could not strip the RUN_DIRECTLY guard — the generator changed shape; fix this arm rather than trusting a green');
  fs.writeFileSync(p, s);
}

/**
 * Put an import of the generator into the check, at one of the placements the round-2 critic
 * measured. `where`:
 *   'static-after-seal'  a top-level `import` below the seal — THE ORDINARY FORM, green in r2
 *   'static-before-seal' a top-level `import` ABOVE the seal — defeats a naive module seal
 *   'top-of-main'        first statement of main()            — green in r2
 *   'in-function'        inside scanAuthoredSource()          — round 1's actual placement
 */
function injectGeneratorImport(dir, where) {
  const p = path.join(dir, 'tools/dialogue/check-authoring-leaks.mjs');
  let s = fs.readFileSync(p, 'utf8');
  const sealLine = "import { verifySeal, reportSeal } from '../lib/evidence-seal.mjs';";
  if (!s.includes(sealLine)) throw new Error('the seal import is not where this arm expects it — fix the arm');
  if (where === 'static-after-seal') {
    s = s.replace(sealLine, `${sealLine}\nimport './gen-greetings.mjs';`);
  } else if (where === 'static-before-seal') {
    s = s.replace(sealLine, `import './gen-greetings.mjs';\n${sealLine}`);
  } else if (where === 'top-of-main') {
    s = s.replace(/function main\(\) \{\n/, "function main() {\n  await import('./gen-greetings.mjs');\n");
    s = s.replace(/^function main\(\) \{/m, 'async function main() {');
  } else if (where === 'in-function') {
    s = s.replace(/function scanAuthoredSource\(\) \{\n/, "async function scanAuthoredSource() {\n  await import('./gen-greetings.mjs');\n");
    s = s.replace(/const source = scanAuthoredSource\(\);/, 'const source = await scanAuthoredSource();');
    s = s.replace(/^function main\(\) \{/m, 'async function main() {');
  } else throw new Error(`unknown placement ${where}`);
  fs.writeFileSync(p, s);
}

/** Put the ADDRESS-half defect back: the fragment rounds 1 and 2 both left in place. */
function restoreAddressLeak(dir) {
  const p = path.join(dir, 'tools/dialogue/gen-greetings.mjs');
  let s = fs.readFileSync(p, 'utf8');
  const re = /( *)saxhleel: "You're a local\. The works will want you before the season's out\.",/;
  if (!re.test(s)) throw new Error("could not find the RG-BWC saxhleel ADDRESS to revert — fix this arm");
  s = s.replace(re, `$1saxhleel: '${ADDRESS_LEAK}',`);
  fs.writeFileSync(p, s);
  // Regenerate so the shipped file carries the reverted address, as it did for two rounds.
  const r = spawnSync('node', [path.join(dir, 'tools/dialogue/gen-greetings.mjs')], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`regeneration failed in the clone: ${r.stderr}`);
}

// -----------------------------------------------------------------------------------------
// the arms
// -----------------------------------------------------------------------------------------
const ARMS = [
  {
    id: 'baseline',
    why: 'the clone, untouched: every check must be green, or every red below is meaningless',
    requires: 'leaks 0, voice 0',
    run(dir) {
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const voice = runCheck(dir, 'tools/dialogue/check-greeting-voice.mjs');
      return { ok: leaks.exit === 0 && voice.exit === 0, observed: `leaks ${leaks.exit}, voice ${voice.exit}`, log: leaks.out };
    },
  },
  {
    id: 'D',
    why: 'ANCHOR. Hand-author the leak into shipped greetings.json. Round 1: exit 0 and the leak '
      + 'was DELETED by the check. The evidence must survive the run.',
    requires: 'leaks exit 1, grep before 1 -> grep after 1',
    run(dir) {
      const at = injectIntoShipped(dir);
      const before = grepLeak(dir);
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const after = grepLeak(dir);
      return {
        ok: leaks.exit === 1 && before === 1 && after === 1 && leaks.out.includes(at),
        observed: `leaks exit ${leaks.exit}, grep ${before} -> ${after}, names ${at}: ${leaks.out.includes(at)}`,
        log: leaks.out,
      };
    },
  },
  {
    id: 'H1',
    why: 'THE ARM ROUND 2 DID NOT HAVE. Generator guard stripped and the generator imported as a '
      + 'STATIC TOP-LEVEL `import` below the seal — the ordinary ESM form, and the one HAZARDS §31 '
      + 'describes. In round 2 this exited 0 printing PASS with the leak deleted.',
    requires: 'exit 4, and the leak SURVIVES in the file',
    run(dir) {
      injectIntoShipped(dir);
      stripRunDirectlyGuard(dir);
      injectGeneratorImport(dir, 'static-after-seal');
      const before = grepLeak(dir);
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const after = grepLeak(dir);
      return {
        ok: leaks.exit === 4,
        observed: `exit ${leaks.exit}, grep ${before} -> ${after}`,
        note: after === 0 ? 'the generator DID rewrite the file (leak gone) — the seal is what reports it' : 'file unchanged',
        log: leaks.out,
      };
    },
  },
  {
    id: 'H2',
    why: 'The placement that would defeat a naive module-scope seal: the generator imported ABOVE '
      + 'the seal, so it runs first and the seal fingerprints the damage. Caught by the '
      + "first-import assertion instead of by the hashes.",
    requires: 'exit 4, and the failure names IMPORT ORDER',
    run(dir) {
      injectIntoShipped(dir);
      stripRunDirectlyGuard(dir);
      injectGeneratorImport(dir, 'static-before-seal');
      const before = grepLeak(dir);
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const after = grepLeak(dir);
      return {
        ok: leaks.exit === 4 && /Import-order assertion FAILED/.test(leaks.out),
        observed: `exit ${leaks.exit}, grep ${before} -> ${after}, import-order named: ${/Import-order assertion FAILED/.test(leaks.out)}`,
        log: leaks.out,
      };
    },
  },
  {
    id: 'H3',
    why: 'Generator imported at the top of main(). Green in round 2.',
    requires: 'exit 4',
    run(dir) {
      injectIntoShipped(dir);
      stripRunDirectlyGuard(dir);
      injectGeneratorImport(dir, 'top-of-main');
      const before = grepLeak(dir);
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const after = grepLeak(dir);
      return { ok: leaks.exit === 4, observed: `exit ${leaks.exit}, grep ${before} -> ${after}`, log: leaks.out };
    },
  },
  {
    id: 'H4',
    why: "Round 1's actual placement — the import inside scanAuthoredSource(). Round 2's tripwire "
      + 'already caught this one; it must stay caught.',
    requires: 'exit 4',
    run(dir) {
      injectIntoShipped(dir);
      stripRunDirectlyGuard(dir);
      injectGeneratorImport(dir, 'in-function');
      const before = grepLeak(dir);
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      const after = grepLeak(dir);
      return { ok: leaks.exit === 4, observed: `exit ${leaks.exit}, grep ${before} -> ${after}`, log: leaks.out };
    },
  },
  {
    id: 'I',
    why: 'THE ROUND-3 DEFECT. Put `Local. Useful.` back as the RG-BWC/saxhleel ADDRESS and '
      + 'regenerate. This is the state the game shipped in for two rounds. The voice check must '
      + 'go red on the ADDRESS half; in round 2 it was green, because it gated only the composed '
      + 'line and the composed line borrowed `leyawiin` from the STANCE half.',
    requires: 'voice exit 1, and the ADDRESS gate is what names it',
    run(dir) {
      restoreAddressLeak(dir);
      const voice = runCheck(dir, 'tools/dialogue/check-greeting-voice.mjs');
      const leaks = runCheck(dir, 'tools/dialogue/check-authoring-leaks.mjs');
      return {
        ok: voice.exit === 1 && /ADDRESS/.test(voice.out),
        observed: `voice exit ${voice.exit}, leaks exit ${leaks.exit} (leaks correctly stays green: two words are not a pattern match)`,
        log: voice.out,
      };
    },
  },
];

// -----------------------------------------------------------------------------------------
function main() {
  const only = arg('--only') ? new Set(arg('--only').split(',').map((s) => s.trim())) : null;
  const arms = ARMS.filter((a) => !only || only.has(a.id));
  if (arms.length === 0) { console.error('no arms selected'); process.exit(2); }

  const dir = makeClone('authoring-leak-controls');
  console.log(`clone: ${dir}`);
  console.log(`arms:  ${arms.map((a) => a.id).join(', ')}\n`);

  const results = [];
  let failed = 0;
  for (const a of arms) {
    restore(dir, WRITABLE);
    let r;
    try { r = a.run(dir); } catch (e) { r = { ok: false, observed: `ARM THREW: ${e.message}`, log: '' }; }
    // The tail of the log is kept in the JSON: which LAYER reported the failure is the whole
    // finding for H1–H4, and "exit 4" alone does not say whether it was the module-scope seal
    // or the older in-main() fingerprint that fired.
    results.push({ id: a.id, why: a.why, requires: a.requires, ...r, log: (r.log || '').slice(-1200) });
    if (argv.includes('--verbose')) console.log(`--- ${a.id} log ---\n${r.log}\n---`);
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${a.id.padEnd(9)} required: ${a.requires}`);
    console.log(`              observed: ${r.observed}`);
    if (r.note) console.log(`              note:     ${r.note}`);
  }

  const jsonOut = arg('--json');
  if (jsonOut) {
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
    fs.writeFileSync(jsonOut, `${JSON.stringify({
      what: 'W1-DIALOGUE-AUTHORING-LEAK round 3 negative-control battery',
      clone: dir, arms: results, failed,
      not_rerun: ['A', 'B', 'B2', 'C', 'E', 'F', 'G1'],
      not_rerun_why: 'reproduced exactly by the round-2 critic and recorded as settled in that verdict',
    }, null, 2)}\n`);
    console.log(`\nwrote ${jsonOut}`);
  }

  if (!argv.includes('--keep')) {
    try { execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'cleanup', '--dir', dir], { cwd: ROOT }); }
    catch { console.error(`(could not clean up ${dir} — remove it by hand)`); }
  } else console.log(`\n(clone kept at ${dir})`);

  if (failed) {
    console.log(`\nFAIL: ${failed} of ${arms.length} arm(s) did not behave as required.`);
    console.log('An arm that stays green is a check that cannot see the defect it was built for.');
    process.exit(1);
  }
  console.log(`\nPASS: ${arms.length} of ${arms.length} arms behaved as required.`);
  process.exit(0);
}

main();
