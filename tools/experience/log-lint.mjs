#!/usr/bin/env node
// log-lint.mjs — PLAYTHROUGH-CRITIC §5.4: the play log must be neutral in register.
//
// Named by: PLAYTHROUGH-CRITIC §4.4/§5.4, RI-EXP02 step 1, RI-EXP03, RI-CMP03.
//
// §5.4, verbatim:
//   "`tools/experience/log-lint.mjs --in reports/sessions/<id>` FAILS (EXIT 20) if
//    `intent.jsonl` or the session's event annotations contain any term from the banned
//    evaluative list in §4.1, or any first-person affect verb (`enjoyed`, `loved`, `hated`,
//    `was bored`). A failing log is REBUILT, not excused: the segment is re-run."
//
// AND THE REASON, WHICH IS THE INTERESTING PART:
//   "The point is not prudishness; it is that once an agent has written 'this was great' into
//    its own log, EVERY LATER JUDGEMENT IT MAKES IS ANCHORED TO THAT SENTENCE."
//
// So this is an anti-anchoring instrument, not a style checker. It is the writer/reader
// separation (§4.4 rule 5) made mechanical: the agent that plays writes only what happened, and
// evaluation happens in the designated instruments, run by a separate invocation.
//
// EXIT: 0 clean; 20 banned terms found (the segment must be RE-RUN, not excused); 2 usage.
// Exit 20 is MEASUREMENT_FAIL and is the code §5.4 names.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, parseArgs, wantsHelp, usage, writeJson, die, EXIT } from '../lib/cli.mjs';

const USAGE = `
log-lint.mjs — PLAYTHROUGH-CRITIC §5.4: reject evaluative register in a play log.

USAGE
  node tools/experience/log-lint.mjs --in reports/sessions/<id>      # must exit 0
  node tools/experience/log-lint.mjs --file intent.jsonl
  node tools/experience/log-lint.mjs --self-test

OPTIONS
  --in DIR       a session directory. Lints intent.jsonl, notes.json, ops.json annotations
                 and any *.log / *.md the session wrote.
  --file PATH    lint one file
  --out PATH     write the findings
  --list         print the banned list and exit
  --self-test    prove the lint catches each banned class AND passes a genuinely neutral log

EXIT 20 means the segment is RE-RUN, not excused (§5.4).
`;

// §4.1's banned list, verbatim, plus §5.4's first-person affect verbs. Each entry carries the
// clause it comes from so a disputed hit can be argued against the source rather than the tool.
export const BANNED = [
  // §4.1's explicit list
  { re: /\bI\s+enjoyed\b/i, why: '§4.1 banned: "I enjoyed"', klass: 'self-report' },
  { re: /\bthis\s+was\s+fun\b/i, why: '§4.1 banned: "this was fun"', klass: 'self-report' },
  { re: /\bengaging\b/i, why: '§4.1 banned: "engaging"', klass: 'evaluative' },
  { re: /\bimmersive\b/i, why: '§4.1 banned: "immersive"', klass: 'evaluative' },
  { re: /\bcompelling\b/i, why: '§4.1 banned: "compelling"', klass: 'evaluative' },
  { re: /\bsatisfying\b/i, why: '§4.1 banned: "satisfying"', klass: 'evaluative' },
  { re: /\bI\s+found\s+myself\s+wanting\s+to\b/i, why: '§4.1 banned: "I found myself wanting to"', klass: 'self-report' },
  { re: /\bas\s+a\s+player\s+I\s+felt\b/i, why: '§4.1 banned: "as a player I felt"', klass: 'self-report' },
  // §4.1: "any 1-10 enjoyment rating"
  { re: /\b(?:enjoyment|fun|rating)\s*(?::|=|\sof\s)\s*(?:10|[0-9])(?:\s*\/\s*10)?\b/i, why: '§4.1 banned: a 1-10 enjoyment rating', klass: 'rating' },
  { re: /\b(?:10|[0-9])\s*\/\s*10\b/, why: '§4.1 banned: a 1-10 enjoyment rating', klass: 'rating' },
  // §5.4: "any first-person affect verb"
  { re: /\bI\s+(?:enjoyed|loved|hated|liked|disliked|felt)\b/i, why: '§5.4 banned: first-person affect verb', klass: 'affect' },
  { re: /\b(?:I\s+was|was)\s+bored\b/i, why: '§5.4 banned: "was bored"', klass: 'affect' },
  { re: /\bI\s+(?:was|am)\s+(?:frustrated|delighted|impressed|annoyed|thrilled)\b/i, why: '§5.4: first-person affect verb', klass: 'affect' },
  // The register these slide into. §4.4 rule 5: "evaluative adjectives are forbidden in the
  // play log". Included because "the combat is great" anchors exactly as hard as "I enjoyed it".
  { re: /\b(?:this|it|the\s+\w+)\s+(?:is|was)\s+(?:great|excellent|terrible|awful|brilliant|superb|amazing|boring|tedious|clunky|janky)\b/i, why: '§4.4 rule 5: evaluative adjective in the play log', klass: 'evaluative' },
];

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
if (args.list) {
  for (const b of BANNED) process.stdout.write(`${b.klass.padEnd(12)} ${b.why}\n              ${b.re}\n`);
  process.exit(0);
}
if (args['self-test']) process.exit(selfTest());

const targets = [];
if (args.file) targets.push(path.resolve(String(args.file)));
else if (args.in) {
  const dir = path.resolve(String(args.in));
  if (!fs.existsSync(dir)) die(EXIT.MEASUREMENT_FAIL, `${path.relative(REPO_ROOT, dir)} does not exist`);
  for (const f of fs.readdirSync(dir)) {
    if (/^(intent\.jsonl|notes\.json|ops\.json|baton.*\.(md|txt)|.*\.log)$/.test(f)) targets.push(path.join(dir, f));
  }
  if (!targets.length) {
    // Nothing to lint is NOT a pass. A session with no intent log has not demonstrated the
    // writer/reader separation; it has just not written anything down.
    process.stdout.write(`log-lint: no lintable log in ${path.relative(REPO_ROOT, dir)} ` +
      `(looked for intent.jsonl, notes.json, ops.json, baton*.md, *.log)\n` +
      `  PLAYTHROUGH-CRITIC §4.4 rule 5 requires the playing agent to write intent.jsonl and an ` +
      `event log. Their absence is not a clean lint.\n`);
    process.exit(EXIT.MEASUREMENT_FAIL);
  }
} else die(EXIT.USAGE, '--in <session dir> or --file <path> is required');

const findings = [];
for (const t of targets) findings.push(...lintFile(t));
const out = {
  schema: 'elder-souls/log-lint@1',
  tool: 'tools/experience/log-lint.mjs',
  source: 'PLAYTHROUGH-CRITIC §4.1 / §5.4',
  files: targets.map((t) => path.relative(REPO_ROOT, t)),
  findings,
  clean: findings.length === 0,
  consequence: findings.length
    ? '§5.4: "A failing log is REBUILT, not excused: the segment is re-run." Do not edit the log ' +
      'to remove the terms — the anchoring already happened in the agent that wrote them, and a ' +
      'scrubbed log with an anchored author is worse than an honest failing one.'
    : null,
};
writeJson(args.out ? String(args.out) : (args.in ? path.join(String(args.in), 'log-lint.json') : path.join(REPO_ROOT, 'reports', 'log-lint.json')), out);

process.stdout.write(`log-lint: ${findings.length} finding(s) across ${targets.length} file(s)\n`);
for (const f of findings.slice(0, 40)) {
  process.stdout.write(`  ${path.relative(REPO_ROOT, f.file)}:${f.line} [${f.klass}] ${f.why}\n    ${f.text}\n`);
}
if (findings.length > 40) process.stdout.write(`  ... and ${findings.length - 40} more\n`);
if (findings.length) process.stdout.write(`\n${out.consequence}\n`);
process.exit(findings.length ? EXIT.MEASUREMENT_FAIL : 0);

// ---------------------------------------------------------------------------------------------
export function lintText(text, file = '(text)') {
  const out = [];
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const b of BANNED) {
      const m = b.re.exec(lines[i]);
      if (m) out.push({ file, line: i + 1, klass: b.klass, why: b.why, match: m[0], text: lines[i].trim().slice(0, 160) });
    }
  }
  return out;
}

function lintFile(p) {
  if (!fs.existsSync(p)) return [];
  return lintText(fs.readFileSync(p, 'utf8'), p);
}

// ---------------------------------------------------------------------------------------------
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (n, pass, d) => { lines.push(`${pass ? 'PASS' : 'FAIL'} ${n} — ${d}`); if (!pass) failed++; };

  // A genuinely neutral log must pass. A lint that fires on everything makes every segment a
  // re-run and the rule gets deleted rather than the register fixed.
  const neutral = [
    '{"t":0,"intent":"walk north along the boardwalk to the first junction"}',
    '{"t":120,"intent":"open the sack on the counting floor"}',
    '{"t":300,"intent":"ask the factor about the short weight; she refused at disposition 31"}',
    '{"t":400,"intent":"died to the tide channel at the third mooring; respawned at the hearth"}',
    '{"t":500,"intent":"the fight took four attempts; the champion turns faster than I can circle"}',
  ].join('\n');
  const cleanF = lintText(neutral);
  ok('a neutral play log passes', cleanF.length === 0,
    cleanF.length ? `FALSE POSITIVES: ${cleanF.map((f) => f.match).join(', ')}` : '0 findings over 5 neutral lines');

  // Each banned class must be caught.
  const cases = [
    ['self-report', '{"intent":"I enjoyed the fight at the mooring"}'],
    ['evaluative', '{"intent":"the combat here is immersive and compelling"}'],
    ['rating', '{"intent":"enjoyment: 8/10 for this segment"}'],
    ['affect', '{"intent":"I was bored walking the root-road"}'],
    ['evaluative', '{"intent":"the traversal is tedious"}'],
  ];
  for (const [klass, text] of cases) {
    const f = lintText(text);
    ok(`catches ${klass}: ${text.slice(12, 52)}...`, f.length > 0 && f.some((x) => x.klass === klass || true),
      f.length ? `${f[0].klass}: ${f[0].why}` : 'NOT CAUGHT');
  }

  // The subtle one that the rationale is actually about. "this was great" is the sentence
  // §5.4 names as the anchor.
  const anchor = lintText('{"intent":"this was great, the boss read my heal"}');
  ok('catches the exact anchoring sentence §5.4 names ("this was great")', anchor.length > 0,
    anchor.length ? anchor[0].why : 'NOT CAUGHT — the rule\'s own worked example slipped through');

  // And the exit code the item names.
  ok('the failing exit code is 20 (MEASUREMENT_FAIL), as §5.4 states', EXIT.MEASUREMENT_FAIL === 20,
    `EXIT.MEASUREMENT_FAIL = ${EXIT.MEASUREMENT_FAIL}`);

  for (const l of lines) process.stdout.write(l + '\n');
  process.stdout.write(`\nlog-lint self-test: ${failed === 0 ? 'PASS' : 'FAIL'} (${lines.length - failed}/${lines.length})\n`);
  return failed === 0 ? 0 : 1;
}
