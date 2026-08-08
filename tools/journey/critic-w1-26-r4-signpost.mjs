#!/usr/bin/env node
// critic-w1-26-r4-signpost.mjs — ATTACKING THE DECLARED LIST.
//
// Owner: the W1-26 round-4 CRITIC. Declared under `method_deviations`. No browser: every
// assertion here is over `tools/journey/signposting.mjs`'s exported functions and over the
// SHIPPED dialogue JSON, so it can be run on a loaded box and is not a claim about a frame.
//
// The round-4 builder replaced P9's start-anchored imperative regex with two clauses:
// instruction (budget 0) and wayfinding (budget = a DECLARED list of sentences with reasons).
// That is a better instrument. This file is the attack on it, in four parts:
//
//   S1  THE TOLERANCE. `isDeclared()` is "prefix-tolerant in BOTH directions". Only ONE of
//       those directions is justified by the stated reason (the panel wraps, so the frame
//       carries a PREFIX of the authored line). The other direction — "the drawn row carries
//       the declared sentence and continues" — admits arbitrary trailing text. Try to get an
//       undeclared signposting sentence past it.
//
//   S2  THE DETECTOR. The declared list is only as good as the thing that decides what needs
//       declaring. Eight regexes decide. Write signposting sentences in the register this game
//       actually uses and count how many reach the frame without ever needing a declaration.
//
//   S3  THE DECLARATION'S SCOPE. Each entry carries `node` and `speaker`. Are they read? If
//       they are not, a declared sentence is licensed in ANY mouth at ANY node forever, which
//       is rule 7's shape (a field written and never read back) inside the check itself.
//
//   S4  GROWTH. Is there anything in the check that goes red when the list gets longer? A
//       budget that only a human diff can see is a budget that grows.
//
// EXIT: non-zero if any bypass succeeds. A bypass is a finding, not a failure of this tool, so
// the exit code is inverted relative to how it reads: `S1_BYPASSED` etc. are recorded as
// findings and the tool exits 1 to make them impossible to miss in a log.
//
// USAGE
//   node tools/journey/critic-w1-26-r4-signpost.mjs [--json <path>]
'use strict';

import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir, gitInfo } from '../lib/cli.mjs';
import { judge, DECLARED_WAYFINDING, wayfindingHits, instructionHits, sentencesOf } from './signposting.mjs';

const USAGE = `
critic-w1-26-r4-signpost.mjs — can an undeclared signposting sentence reach the frame?

USAGE
  node tools/journey/critic-w1-26-r4-signpost.mjs [--json <path>]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json))
  : path.join(REPORTS_DIR, 'critic-w1-26-r4', 'signpost.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const out = {
  schema: 'elder-souls/critic-signpost@1',
  piece: 'W1-26-r4', role: 'critic',
  commit: (gitInfo() || {}).commit || null,
  findings: [], clean: [], sections: {},
};
const finding = (id, what, d) => { out.findings.push(id); out.sections[id] = { bypassed: true, what, ...d }; say(`  FINDING ${id}  ${what}`); };
const clean = (id, what, d) => { out.clean.push(id); out.sections[id] = { bypassed: false, what, ...d }; say(`  clean   ${id}  ${what}`); };

const D = (text, surface = 'dialogue') => judge([{ text, surface }]);

// =============================================================================================
// S1 — the tolerance
// =============================================================================================
say('');
say('S1. THE PREFIX TOLERANCE, IN THE DIRECTION THE STATED REASON DOES NOT COVER.');
say('    The reason is "wrapping only ever truncates; it never invents". That justifies');
say('    accepting a drawn row that is a PREFIX of a declared sentence. It does not justify');
say('    accepting a drawn row that BEGINS with a declared sentence and then continues.');
say('');

const declaredSentences = DECLARED_WAYFINDING.map((d) => d.sentence);
const s1 = { attempts: [], bypasses: [] };

// Every attempt is a string that (a) fires a wayfinding pattern with a MEANING the declared
// sentence does not have, and (b) is not what the panel would produce by truncation.
const attempts = [
  {
    id: 'no-space-continuation',
    why: '`sentencesOf` splits on /(?<=[.!?])\\s+/ — a period with NO space after it does not '
      + 'split. So one "sentence" can carry a declared line plus a fresh instruction, and '
      + '`s.startsWith(n)` accepts the whole thing.',
    text: 'The light up there is bad, but it is light.Up the ladder, then.',
  },
  {
    id: 'em-dash-continuation',
    why: 'An em dash is not sentence punctuation to `sentencesOf`, so the continuation rides '
      + 'on the declared sentence inside one "sentence".',
    text: 'The door behind me is the one you want. — the way out is up the companionway, past the crates.',
  },
  {
    id: 'declared-then-semicolon',
    why: 'A semicolon is not in the sentence splitter either.',
    text: 'The door behind me is the one you want; the desk is up the ladder and they are waiting for you.',
  },
  {
    id: 'trailing-clause-comma',
    why: 'A comma continuation on a declared sentence, which is how a writer would actually '
      + 'extend a line.',
    text: 'The door behind me is the one you want, then go up the stairs behind me.',
  },
];
for (const a of attempts) {
  const v = D(a.text);
  const row = { ...a, judged_ok: v.ok, undeclared: v.wayfinding_undeclared.length, instruction: v.instruction.length,
    declared_matched: v.wayfinding_declared.map((w) => (w.matched_declared || {}).how) };
  s1.attempts.push(row);
  say(`    ${v.ok ? 'PASSES THE CHECK' : 'red'}  ${a.id}`);
  say(`        ${JSON.stringify(a.text)}`);
  if (v.ok) s1.bypasses.push(a.id);
}
// The declared entry does not contain the words that fired; prove the continuation really is
// undeclared signposting on its own.
s1.continuations_alone = attempts.map((a) => {
  const tail = a.text.slice(a.text.indexOf('.') + 1).replace(/^[\s—;,]+/, '');
  return { id: a.id, tail, red_alone: !D(tail).ok };
});
if (s1.bypasses.length) {
  finding('S1_BYPASSED', `${s1.bypasses.length} of ${attempts.length} continuation attempts reach the frame with the check GREEN — the "carries the declared sentence and continues" branch of isDeclared() is not covered by the wrapping argument that justifies the tolerance`, s1);
} else {
  clean('S1_BYPASSED', `all ${attempts.length} continuation attempts go red`, s1);
}

// =============================================================================================
// S2 — the detector
// =============================================================================================
say('');
say('S2. THE DETECTOR. A declared list only constrains what the detector fires on.');
say('    Twelve sentences that hand a player a route, written the way THIS GAME writes.');
say('    None is on the declared list. Each one the detector misses is a signposting');
say('    sentence that can be shipped without anybody ever writing a reason down.');
say('');
const blind = [
  'Her desk is on the deck above.',
  'They keep the ledger one deck higher than this one.',
  'Tuleeh-Ma sits where the light comes in.',
  'You will find the Warden-Scribe at the top of the companionway.',
  'Nobody is written down on this deck.',
  'The stamp is not given down here.',
  'I would not look for her among the crates.',
  'Everyone who comes aboard climbs eventually.',
  'The hatch is open, if that means anything to you.',
  'She does not come down for anyone.',
  'Two ladders and a door, and then you are somebody.',
  'The rain gets in at the top, which is how you know you are close.',
];
const s2 = { of: blind.length, missed: [], caught: [] };
for (const line of blind) {
  const v = D(line);
  if (v.ok) s2.missed.push(line); else s2.caught.push({ line, why: v.why });
  say(`    ${v.ok ? 'MISSED ' : 'caught '} ${JSON.stringify(line)}`);
}
if (s2.missed.length) {
  finding('S2_DETECTOR_BLIND', `${s2.missed.length} of ${blind.length} plainly-signposting sentences pass the rewritten P9 with no declaration required at all`, s2);
} else {
  clean('S2_DETECTOR_BLIND', 'the detector fired on all twelve', s2);
}

// =============================================================================================
// S3 — the scope of a declaration
// =============================================================================================
say('');
say('S3. WHAT A DECLARATION ACTUALLY LICENCES.');
say('    Each entry names a `node` and a `speaker`. isDeclared() compares SENTENCES only.');
say('');
const s3 = { entries: DECLARED_WAYFINDING.map((d) => ({ sentence: d.sentence, node: d.node, speaker: d.speaker })) };
// Read every declared sentence back out of the shipped data and check it is actually authored
// at the node it is declared against.
const topicsDir = path.join(REPO_ROOT, 'game/data/dialogue/topics');
const allText = [];
const walkJson = (o, file) => {
  if (Array.isArray(o)) return o.forEach((v) => walkJson(v, file));
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) walkJson(o[k], file); return; }
  if (typeof o === 'string' && o.length > 20) allText.push({ file, text: o });
};
for (const f of fs.readdirSync(topicsDir)) {
  if (!f.endsWith('.json')) continue;
  walkJson(JSON.parse(fs.readFileSync(path.join(topicsDir, f), 'utf8')), f);
}
s3.authored_locations = DECLARED_WAYFINDING.map((d) => ({
  sentence: d.sentence,
  declared_node: d.node,
  found_in_files: [...new Set(allText.filter((t) => t.text.includes(d.sentence)).map((t) => t.file))],
}));
// The bypass: the same sentence in a DIFFERENT mouth at a DIFFERENT node is still green.
const impostorSpeaker = judge([{ text: 'The door behind me is the one you want.', surface: 'dialogue' }]);
s3.same_sentence_any_speaker_ok = impostorSpeaker.ok;
s3.node_field_read_by_check = false;   // proven by inspection below
const src = fs.readFileSync(path.join(REPO_ROOT, 'tools/journey/signposting.mjs'), 'utf8');
const declBlockUses = /\.node\b|\.speaker\b/.test(src.slice(src.indexOf('function isDeclared')));
s3.isDeclared_reads_node_or_speaker = declBlockUses;
if (!declBlockUses) {
  finding('S3_DECLARATION_UNBOUND', 'the `node` and `speaker` fields on every declared entry are never read by the check — a declaration licences that exact sentence in any mouth, at any node, on any dialogue surface, permanently. Rule 7\'s shape, inside the instrument.', s3);
} else {
  clean('S3_DECLARATION_UNBOUND', 'isDeclared() binds the declaration to a node or a speaker', s3);
}

// =============================================================================================
// S4 — growth
// =============================================================================================
say('');
say('S4. IS THERE ANYTHING THAT GOES RED WHEN THE LIST GETS LONGER?');
say('');
const s4 = {
  declared_count: DECLARED_WAYFINDING.length,
  ceiling_in_source: /DECLARED_WAYFINDING\.length\s*(<=|<|>|>=)\s*\d/.test(src),
  baseline_file: null,
  self_test_asserts_count: /check\((['"]).*count/i.test(src),
};
const baselines = ['reports/w1-26-r4/signposting-baseline.json', 'tools/journey/signposting-baseline.json'];
for (const b of baselines) if (fs.existsSync(path.join(REPO_ROOT, b))) s4.baseline_file = b;
if (!s4.ceiling_in_source && !s4.baseline_file) {
  finding('S4_NO_RATCHET', `the declared list has ${s4.declared_count} entries, no numeric ceiling asserted anywhere in the check, and no committed baseline to ratchet against — adding a fourth entry is a green build`, s4);
} else {
  clean('S4_NO_RATCHET', 'the list has a ceiling or a ratchet', s4);
}

// =============================================================================================
// S5 — the writ.stamp line, read in place (item A)
// =============================================================================================
say('');
say('S5. `writ.stamp` IN PLACE — the line the third declaration is cut out of.');
const writ = JSON.parse(fs.readFileSync(path.join(topicsDir, 'writ-house.json'), 'utf8'));
const stampNode = (writ.nodes || []).find((n) => /stamp/.test(n.id || '') || (n.line || '').includes('Reed-case, stamped'));
const s5 = { node_id: stampNode ? stampNode.id : null, line: stampNode ? stampNode.line : null };
if (s5.line) {
  s5.sentences = sentencesOf(s5.line);
  s5.declared_index = s5.sentences.findIndex((x) => x.includes('The door behind me'));
  s5.next_sentence = s5.sentences[s5.declared_index + 1] || null;
  s5.next_sentence_pronoun_refers_to_the_door =
    !!s5.next_sentence && /^Past it\b/.test(s5.next_sentence);
  say(`    node ${JSON.stringify(s5.node_id)}`);
  for (const [i, x] of s5.sentences.entries()) say(`      ${i}. ${x}`);
  say('');
  say(`    the declared sentence sits at index ${s5.declared_index}; the sentence after it is`);
  say(`    ${JSON.stringify(s5.next_sentence)} — its "it" is the door, so a straight deletion`);
  say(`    leaves a dangling pronoun: ${s5.next_sentence_pronoun_refers_to_the_door}`);
}
// The teaching clause really is gone.
s5.teaching_clause_present = JSON.stringify(writ).includes('So ask them what they do');
s5.teaching_clause_present_outside_the_cut_note =
  (writ.nodes || []).some((n) => typeof n.line === 'string' && n.line.includes('So ask them what they do'));
out.sections.S5 = s5;
if (s5.teaching_clause_present_outside_the_cut_note) {
  finding('S5_TEACHING_STILL_DRAWN', 'the teaching clause is still on an authored line', s5);
} else {
  clean('S5_TEACHING_CUT', 'the teaching clause is gone from every authored line (it survives only inside a `_w1_26_r4_cut` note field, which is not drawn)', s5);
}

// =============================================================================================
say('');
say(`  ${out.findings.length} finding(s), ${out.clean.length} clean.`);
writeJson(jsonPath, out);
say(`  -> ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.findings.length ? 1 : 0);
