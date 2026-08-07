#!/usr/bin/env node
// isolation-check.mjs — RI-EXP01 step 0 / RI-EXP02: did the driving agent stay in its box?
//
// Named by RI-EXP01 step 0, verbatim:
//   "The driving agent is invoked at level `enforced`: a materialised inbox containing this
//    item's §C list ONLY (never §D — AN AGENT THAT HAS READ THE BEAT SHEET CANNOT MEASURE
//    T_found), the game URL, and nothing from game/data/**.
//    `tools/experience/isolation-check.mjs` diffs the tool-call log against the inbox manifest.
//    `attested` isolation caps this item at 6."
//
// WHY THIS IS THE FIRST STEP AND NOT A FORMALITY. RI-EXP01's headline metric is `T_found` —
// minutes to the first content DISCOVERED, not handed. An agent that has read §D knows the
// found thing is in a sack in the Writ House at minute 8, walks to it, and reports T_found = 8.
// The number is then a measurement of the agent's reading, not of the build's discoverability.
// Every metric in that item has the same property. So isolation is not hygiene; it is the
// precondition that makes the numbers mean anything, and it must be CHECKED rather than
// attested — which is why the item caps `attested` at 6.
//
// WHAT IT ACTUALLY DIFFS. Two things, and it is honest about the difference:
//   * READS: every file the agent's tool-call log shows it opening, against the inbox manifest.
//     A read outside the manifest is a leak, named, with the call that made it.
//   * CONTENT: the leaked file's own content against the forbidden sections. A read of
//     RI-EXP01.md is a leak even if the agent claims it only wanted §C, because §D is in the
//     same file — so the manifest must materialise §C into its OWN file, and this tool says so
//     when it sees the whole item in the inbox.
//
// EXIT: 0 isolation holds at the requested level; 1 it does not (with the leaks named); 2 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, readJson, die, EXIT, sha256 } from '../lib/cli.mjs';

const USAGE = `
isolation-check.mjs — diff a driving agent's tool-call log against its inbox manifest.

USAGE
  node tools/experience/isolation-check.mjs --inbox reports/sessions/<id>/inbox.json \\
       --log reports/sessions/<id>/tool-calls.jsonl --level enforced
  node tools/experience/isolation-check.mjs --self-test

OPTIONS
  --inbox PATH   the materialised inbox manifest: { "level":"enforced", "files":[{path,sha256}],
                 "urls":[...], "forbidden":[glob,...] }
  --log PATH     the agent's tool-call log, JSONL, one call per line:
                 {"tool":"Read","input":{"file_path":"..."}}  or  {"tool":"Bash","input":{"command":"..."}}
  --level L      enforced | attested | none   (default: read from the inbox)
  --out PATH     write the result
  --self-test    prove the checker catches a leak, including one hidden inside a Bash command,
                 and that a CLEAN log passes

LEVELS
  enforced   every read must be in the manifest. A single unlisted read fails.
  attested   the agent asserts isolation; this tool records that no log was checkable.
             RI-EXP01 step 0: attested isolation CAPS THE ITEM AT 6.
  none       no isolation claim. Recorded, not checked.

DEFAULT FORBIDDEN SET (added to the inbox's own)
  game/data/**, corpus/**, reports/**, game/src/**
  — plus, always, the beat sheet itself: an agent that has read §D cannot measure T_found.
`;

// Paths a driving agent must never read, whatever the inbox says. `corpus/**` is here because
// every reference item contains the thresholds the agent is being measured against.
const ALWAYS_FORBIDDEN = [
  'game/data/', 'game/src/', 'corpus/', 'reports/', 'orchestration/',
];

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args['self-test']) process.exit(selfTest());

const inboxPath = args.inbox ? path.resolve(String(args.inbox)) : null;
if (!inboxPath) die(EXIT.USAGE, '--inbox <manifest.json> is required');
if (!fs.existsSync(inboxPath)) die(EXIT.MEASUREMENT_FAIL, `${path.relative(REPO_ROOT, inboxPath)} does not exist`);
const inbox = readJson(inboxPath);
const level = String(args.level || inbox.level || 'none');

const logPath = args.log ? path.resolve(String(args.log)) : null;
let calls = [];
if (logPath && fs.existsSync(logPath)) {
  for (const line of fs.readFileSync(logPath, 'utf8').split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try { calls.push(JSON.parse(s)); } catch { /* tolerate */ }
  }
}

const result = check(inbox, calls, level, !!logPath && fs.existsSync(logPath));
writeJson(args.out ? String(args.out) : path.join(path.dirname(inboxPath), 'isolation.json'), result);
report(result);
process.exit(result.ok ? 0 : 1);

// ---------------------------------------------------------------------------------------------
/** Every filesystem path a tool call touched, however it touched it. */
export function pathsTouchedBy(call) {
  const out = [];
  const i = call.input || call.args || {};
  for (const k of ['file_path', 'path', 'notebook_path', 'filePath']) if (i[k]) out.push(String(i[k]));
  if (i.paths && Array.isArray(i.paths)) out.push(...i.paths.map(String));
  // A Bash command is where a leak actually hides: `cat corpus/...` never appears in a
  // `file_path` field. Anything that looks like a repo path in the command line counts.
  const cmd = String(i.command || i.cmd || '');
  if (cmd) {
    for (const m of cmd.match(/(?:^|[\s'"=({|&;])((?:\.\/)?(?:game|corpus|reports|tools|orchestration)\/[\w./*-]+)/g) || []) {
      out.push(m.replace(/^[\s'"=({|&;]+/, ''));
    }
  }
  // A fetch of a file:// URL is a read.
  const url = String(i.url || '');
  if (url.startsWith('file://')) out.push(url.slice('file://'.length));
  return out.map((p) => p.replace(/^\.\//, '')).map((p) => (path.isAbsolute(p) ? path.relative(REPO_ROOT, p) : p));
}

export function check(inbox, calls, level, logPresent) {
  const allowed = new Set((inbox.files || []).map((f) => String(f.path || f).replace(/^\.\//, '')));
  const forbidden = [...ALWAYS_FORBIDDEN, ...(inbox.forbidden || [])];

  const leaks = [];
  const reads = [];
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    for (const p of pathsTouchedBy(c)) {
      reads.push({ call: i, tool: c.tool || c.name || '?', path: p });
      if (allowed.has(p)) continue;
      const hit = forbidden.find((f) => p.startsWith(f) || p.includes(f));
      if (hit) {
        leaks.push({ call: i, tool: c.tool || c.name || '?', path: p, matched_forbidden: hit, raw: JSON.stringify(c).slice(0, 240) });
      } else if (level === 'enforced') {
        // Under `enforced`, anything not in the manifest is a leak even if it is not on the
        // forbidden list — "a materialised inbox containing this item's §C list ONLY".
        leaks.push({ call: i, tool: c.tool || c.name || '?', path: p, matched_forbidden: '(not in inbox manifest)', raw: JSON.stringify(c).slice(0, 240) });
      }
    }
  }

  // The manifest itself can be the leak: if it materialises a whole reference item rather than
  // the extracted §C, the agent has §D in its inbox and the isolation is void by construction.
  const manifestDefects = [];
  for (const f of inbox.files || []) {
    const p = String(f.path || f);
    if (/corpus\/.*RI-[A-Z]{3}\d{2}.*\.md$/.test(p)) {
      manifestDefects.push({
        path: p,
        why: 'the inbox materialises a WHOLE reference item. RI-EXP01 step 0 requires §C ONLY, ' +
             'never §D — and §D is in this file. An agent that has read the beat sheet cannot ' +
             'measure T_found, so this isolation is void by construction, not by the agent\'s conduct.',
      });
    }
    // Integrity: a listed file whose hash has moved is not the file the agent was given.
    if (f.sha256) {
      const abs = path.join(REPO_ROOT, p);
      if (fs.existsSync(abs)) {
        const actual = sha256(fs.readFileSync(abs));
        if (actual !== f.sha256) manifestDefects.push({ path: p, why: `sha256 mismatch: manifest ${f.sha256.slice(0, 12)}, on disk ${actual.slice(0, 12)}` });
      } else {
        manifestDefects.push({ path: p, why: 'listed in the inbox manifest but absent from disk' });
      }
    }
  }

  const attestedOnly = level === 'attested' || (level === 'enforced' && !logPresent);
  return {
    schema: 'elder-souls/isolation@1',
    tool: 'tools/experience/isolation-check.mjs',
    item: 'RI-EXP01 step 0 / RI-EXP02',
    level_requested: level,
    level_achieved: manifestDefects.length ? 'void'
      : (!logPresent ? 'attested' : (leaks.length ? 'breached' : 'enforced')),
    log_present: logPresent,
    calls: calls.length, reads: reads.length,
    inbox_files: (inbox.files || []).length,
    leaks, manifest_defects: manifestDefects,
    caps_item_at: (!logPresent || level === 'attested') ? 6 : null,
    caps_reason: (!logPresent || level === 'attested')
      ? 'RI-EXP01 step 0: "`attested` isolation caps this item at 6." No tool-call log was ' +
        'checkable, so isolation is asserted rather than demonstrated.'
      : null,
    ok: manifestDefects.length === 0 && leaks.length === 0 && (level !== 'enforced' || logPresent),
  };
}

function report(r) {
  process.stdout.write(`isolation-check: requested ${r.level_requested}, achieved ${r.level_achieved}\n`);
  process.stdout.write(`  ${r.calls} tool calls, ${r.reads} path reads, ${r.inbox_files} inbox files\n`);
  for (const d of r.manifest_defects) process.stdout.write(`  MANIFEST DEFECT ${d.path}\n    ${d.why}\n`);
  for (const l of r.leaks.slice(0, 20)) process.stdout.write(`  LEAK [${l.tool}] ${l.path}  (${l.matched_forbidden})\n`);
  if (r.leaks.length > 20) process.stdout.write(`  ... and ${r.leaks.length - 20} more\n`);
  if (r.caps_item_at) process.stdout.write(`  CAPS ITEM AT ${r.caps_item_at}: ${r.caps_reason}\n`);
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  const inbox = { level: 'enforced', files: [{ path: 'reports/sessions/x/brief.md' }], urls: ['http://127.0.0.1:8080/'] };

  // A clean log passes.
  const clean = [
    { tool: 'Read', input: { file_path: 'reports/sessions/x/brief.md' } },
    { tool: 'Bash', input: { command: 'echo hello' } },
  ];
  const cleanR = check(inbox, clean, 'enforced', true);
  ok('a clean log passes enforced isolation', cleanR.ok && cleanR.leaks.length === 0,
    `leaks=${cleanR.leaks.length}, achieved=${cleanR.level_achieved}`);

  // THE FALSIFICATION: a direct read of the beat sheet must be caught.
  const leaky = [...clean, { tool: 'Read', input: { file_path: 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md' } }];
  const leakyR = check(inbox, leaky, 'enforced', true);
  ok('a direct read of the beat sheet is caught (falsification)',
    !leakyR.ok && leakyR.leaks.some((l) => l.path.includes('RI-EXP01')),
    leakyR.leaks.map((l) => l.path).join(', ') || 'NOT CAUGHT');

  // THE HARDER FALSIFICATION: the same leak hidden inside a Bash command. This is where a leak
  // actually hides — `cat corpus/...` never appears in a file_path field.
  const bashLeak = [...clean, { tool: 'Bash', input: { command: "cat corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md | head -50" } }];
  const bashR = check(inbox, bashLeak, 'enforced', true);
  ok('a leak hidden inside a Bash command is caught (falsification)',
    !bashR.ok && bashR.leaks.some((l) => l.path.includes('RI-EXP01')),
    bashR.leaks.map((l) => `${l.tool}:${l.path}`).join(', ') || 'NOT CAUGHT — grep of the command line failed');

  // And a game/data read.
  const dataLeak = [...clean, { tool: 'Bash', input: { command: 'node -e "require(\'./game/data/quests/hooks.json\')"' } }];
  const dataR = check(inbox, dataLeak, 'enforced', true);
  ok('a game/data read is caught', !dataR.ok && dataR.leaks.some((l) => l.path.startsWith('game/data')),
    dataR.leaks.map((l) => l.path).join(', ') || 'NOT CAUGHT');

  // A manifest that materialises the whole item is VOID regardless of the agent's conduct.
  const badInbox = { level: 'enforced', files: [{ path: 'corpus/95-experience/RI-EXP01-first-hour-beat-sheet.md' }] };
  const badR = check(badInbox, clean, 'enforced', true);
  ok('an inbox containing the whole reference item is VOID by construction',
    badR.level_achieved === 'void' && badR.manifest_defects.length > 0,
    badR.manifest_defects.map((d) => d.path).join(', ') || 'NOT DETECTED');

  // No log under `enforced` cannot silently pass — it degrades to attested and caps at 6.
  const noLog = check(inbox, [], 'enforced', false);
  ok('enforced with no log degrades to attested and caps the item at 6',
    !noLog.ok && noLog.level_achieved === 'attested' && noLog.caps_item_at === 6,
    `achieved=${noLog.level_achieved}, caps=${noLog.caps_item_at}, ok=${noLog.ok}`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nisolation-check self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
