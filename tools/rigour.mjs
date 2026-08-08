#!/usr/bin/env node
/**
 * rigour.mjs — G3, the rigour guard, counted as ACTS rather than as WORDS.
 *
 * COST.md §1 names five non-negotiables that no cost saving may reduce:
 *
 *   1. one separate critic with fresh context per piece
 *   2. delete-the-fix
 *   3. the CONSUMPTION check (RI-MTH07)
 *   4. a self-test with arms that genuinely disagree
 *   5. reading the actual file rather than trusting a summary
 *
 * The COST-INSTRUMENT plan (§4.4) found four of the five unmeasurable and shipped them as
 * `null`/`unmeasured`, on the grounds that they live in verdict prose and "a grep counts the word,
 * not the act". That reasoning is right and this tool keeps it. Its conclusion — "the rest are free
 * prose, so there is nothing reliable to parse" — is wrong, and that is why this tool exists:
 * 71 of the 73 wave-1 verdicts carry a machine-readable JSON sibling validated by
 * tools/verdict-validate.mjs, and the acts are already recorded in them. Not under one agreed
 * field — under about two hundred ad-hoc spellings — but with the NUMBERS attached, which is the
 * part that cannot be faked by writing a phrase.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * THE PRINCIPLE: an act leaves a residue that the word cannot leave.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Every recogniser below demands the residue, never the noun:
 *
 *   delete_the_fix   two arms with values that DIFFER, plus a named teardown mechanism.
 *                    A builder who only writes "I did delete-the-fix" has no second number.
 *   consumption      a named world-side consumer that EXISTS ON DISK, a named perturbation, and
 *                    a shipped-vs-perturbed pair of entity observations that DIFFER.
 *   self_test        a self-test command whose SCRIPT FILE EXISTS, with a recorded exit code.
 *                    `--verify` re-executes it: the strongest observable in the set, because the
 *                    tool can reproduce the act rather than read about it.
 *   arms_disagree    a RED arm: a non-zero exit, or a teardown recorded as watched red, ALONGSIDE
 *                    a green one. A self-test that has never been seen to fail is not evidence.
 *   read_the_file    a `path:line` citation whose file resolves and whose quoted text is actually
 *                    at that line, checked against the judged commit. You cannot cite line 506 of
 *                    a file you did not open and have the quote match.
 *   separate_critic  a critic run id, no declared conflict of interest, and a verdict introduced
 *                    in a commit that is NOT the build commit it judges.
 *
 * Three tiers, and the tool publishes all three because the GAP BETWEEN THEM is the finding:
 *
 *   act    — an observable the act itself produced, verified here.      COUNTED.
 *   claim  — a self-reported boolean or a status with no numbers.       published, NOT counted.
 *   word   — the phrase appears in prose and nothing else.              published, NOT counted.
 *
 * `word_only` is the gameability meter. If a wave's `word` count rises while its `act` count falls,
 * the programme is producing verdicts that say the words, which is the exact failure G3 exists to
 * catch. That number is the reason this tool prints three columns instead of one.
 *
 * MEASUREMENT STRENGTH IS DECLARED PER ITEM, and one of the five is weak on purpose:
 * `separate_critic` rests partly on `conflict_of_interest`, a self-reported boolean. It is marked
 * `weak_component` in the output rather than dressed up. Nothing here is stronger than the honesty
 * of the numbers a critic writes down; this tool cannot detect a fabricated pair of arms, and says
 * so in `limits` rather than implying otherwise.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * USAGE
 *   node tools/rigour.mjs                    count every verdict, print the table
 *   node tools/rigour.mjs --json <path>      write the ledger side-car (default docs/data/rigour.json)
 *   node tools/rigour.mjs --detail           per-verdict rows with the evidence that decided each
 *   node tools/rigour.mjs --verify           ALSO execute named self-tests (slow; off by default)
 *   node tools/rigour.mjs --self-test        the control. Arms that genuinely disagree.
 *
 * Exit 0 always in counting mode — this is an instrument, not a gate, and rule 13 forbids a
 * fail-closed check on a shared commit path. `--self-test` exits non-zero when an arm is wrong.
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, relative, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const rel = (p) => relative(ROOT, p).split(sep).join('/');

export const ITEMS = ['separate_critic', 'delete_the_fix', 'consumption', 'self_test', 'arms_disagree', 'read_the_file'];

// The five non-negotiables map onto six counters because COST.md's ledger schema already splits
// "a self-test with arms that genuinely disagree" into `self_test` and `arms_disagree`. Keeping
// both keys means the ledger block this feeds needs no schema change at all.
export const NON_NEGOTIABLE_OF = {
  separate_critic: 'one separate critic with fresh context per piece',
  delete_the_fix: 'delete-the-fix',
  consumption: 'the CONSUMPTION check (RI-MTH07)',
  self_test: 'a self-test with arms that genuinely disagree',
  arms_disagree: 'a self-test with arms that genuinely disagree',
  read_the_file: 'reading the actual file rather than trusting a summary',
};

// ─────────────────────────────────────────────────────────────────── small utilities

function git(args, { allowFail = true } = {}) {
  try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { if (allowFail) return null; throw e; }
}

/** Walk every node of a JSON value. cb(value, pathString, keyName, parentObject). */
function walk(node, cb, path = '', key = '', parent = null) {
  cb(node, path, key, parent);
  if (node && typeof node === 'object') {
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, cb, `${path}[${i}]`, key, node));
    else for (const k of Object.keys(node)) walk(node[k], cb, path ? `${path}.${k}` : k, k, node);
  }
}

/** Every string leaf, joined — used only for phrase (word-tier) detection, never for counting. */
function allText(v) {
  const out = [];
  walk(v, (n) => { if (typeof n === 'string') out.push(n); });
  return out.join('\n');
}

const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]+/g, '_');

// ─────────────────────────────────────────────────────────────────── arm detection
//
// The load-bearing primitive. "Delete-the-fix" and "CONSUMPTION" are both, structurally, the same
// claim: I ran the world twice, once with the thing and once without, and the two readings differ.
// A phrase cannot produce two readings. So the recogniser looks for a container object holding at
// least one POSITIVE-arm key and one NEGATIVE-arm key whose leaf values are comparable and unequal.

const POSITIVE_ARM = /^(arm_?full|full|shipped|with|with_fix|new|new_new|fixed|fix|on|before_teardown|present|live|real|current|baseline_with|arm_a|a)$/;
const NEGATIVE_ARM = /^(arm_?(ablated|deleted|removed|null|off|none)|ablated|deleted|removed|reverted|without|without_fix|no_fix|old|old_old|pre_?fix|control|null|nulled|off|absent|stub|inert|perturbed|broken|teardown|arm_b|b|no_[a-z0-9_]+)$/;

function comparableLeaf(v) {
  if (v === null) return null;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  return null;
}

/**
 * Find containers with a positive and a negative arm whose values DIFFER.
 * Returns [{ at, positive: {k,v}, negative: {k,v} }].
 */
export function findDisagreeingArms(root) {
  const found = [];
  walk(root, (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const keys = Object.keys(node);
    const pos = keys.filter((k) => POSITIVE_ARM.test(norm(k)));
    const neg = keys.filter((k) => NEGATIVE_ARM.test(norm(k)));
    if (!pos.length || !neg.length) return;
    for (const pk of pos) for (const nk of neg) {
      // Both arms may be objects of readings (path_m / end / frames). Compare their serialisations.
      const pv = node[pk], nv = node[nk];
      const ps = typeof pv === 'object' && pv !== null ? JSON.stringify(pv) : comparableLeaf(pv);
      const ns = typeof nv === 'object' && nv !== null ? JSON.stringify(nv) : comparableLeaf(nv);
      if (ps === null || ns === null) continue;
      if (ps === ns) continue;                 // identical arms — an INERT CONTROL, not evidence
      found.push({ at: path, positive: { key: pk, value: String(ps).slice(0, 160) }, negative: { key: nk, value: String(ns).slice(0, 160) } });
      return;
    }
  });
  return found;
}

/** Arms that are present and IDENTICAL — reported separately, because rule 6 calls that an inert control. */
export function findIdenticalArms(root) {
  const found = [];
  walk(root, (node, path) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const keys = Object.keys(node);
    const pos = keys.filter((k) => POSITIVE_ARM.test(norm(k)));
    const neg = keys.filter((k) => NEGATIVE_ARM.test(norm(k)));
    if (!pos.length || !neg.length) return;
    for (const pk of pos) for (const nk of neg) {
      const pv = node[pk], nv = node[nk];
      const ps = typeof pv === 'object' && pv !== null ? JSON.stringify(pv) : comparableLeaf(pv);
      const ns = typeof nv === 'object' && nv !== null ? JSON.stringify(nv) : comparableLeaf(nv);
      if (ps === null || ns === null) continue;
      if (ps === ns) { found.push({ at: path, keys: [pk, nk], value: String(ps).slice(0, 120) }); return; }
    }
  });
  return found;
}

// ─────────────────────────────────────────────────────────────────── a run of a real script
//
// The second act-residue, and in this corpus the more common one. The project's method builds a
// TOOL per act — 38 files under tools/ match /consum/ alone — so "I ran the CONSUMPTION check" is
// not only a sentence: it is a script that exists on disk, invoked with an exit code beside it.
// A phrase cannot name a file that exists. (It can name someone ELSE'S file without running it,
// which is why `--verify` exists and why this route is called strong, not proof.)

/** Every string anywhere that invokes a repo script matching `pattern`, with any exit code beside it. */
function findRunOfScript(v, pattern) {
  const rows = [];
  walk(v, (n, path, key, parent) => {
    const s = typeof n === 'string' ? n : (typeof key === 'string' && /^node |\.mjs/.test(key) ? key : null);
    if (!s) return;
    const script = resolveCommand(s);
    if (!script || !pattern.test(script)) return;
    let exit = null;
    if (parent && !Array.isArray(parent) && typeof parent.exit_code === 'number') exit = parent.exit_code;
    else if (parent && !Array.isArray(parent) && typeof parent.exit === 'number') exit = parent.exit;
    else {
      const m = s.match(/exit(?:\s*code)?\s*[:=]?\s*(\d+)/i);
      if (m) exit = Number(m[1]);
    }
    rows.push({ script, at: path, text: s.slice(0, 180), exit_code: exit });
  });
  return rows;
}

/**
 * A numeric contrast recorded in prose, but ONLY inside a field whose own key already declares it
 * to be about a teardown, a control or a perturbation. Deliberately narrow: it needs an explicit
 * contrast marker AND two different numbers. "2 of 2 arms" is not a contrast; "0 -> 8" is.
 */
const ARM_FIELD = /teardown|control|arm|delete.?the.?fix|deletefix|ablat|revert|perturb|consum|break|null|gates_run/i;
const CONTRAST = /(-?\d[\d,.]*)\s*(?:→|->|=>|–>|\bvs\.?\b|\bversus\b|\bagainst\b|\bbecomes\b|\bfell to\b|\brose to\b|\bcollapse[sd]? to\b)\s*(-?\d[\d,.]*)/i;
// The shape the corpus actually uses when it reports a teardown in one line:
//   "node tools/check-building-fits-room.mjs -> 0; --self-break -> 112 of 112 red"
// Two readings of the same instrument, arrow-marked, in one string. Requires them to DIFFER.
const TWO_READINGS = /(?:->|→|=>|\bexit\b|:)\s*(-?\d[\d,.]*)\b[\s\S]{0,120}?(?:->|→|=>|\bexit\b)\s*(-?\d[\d,.]*)\b/;

function findProseArms(root) {
  const found = [];
  walk(root, (n, path, key) => {
    if (typeof n !== 'string') return;
    if (!ARM_FIELD.test(`${key} ${path}`)) return;
    const same = (a, b) => a.replace(/[,.]/g, '') === b.replace(/[,.]/g, '');
    const m = n.match(CONTRAST);
    if (m && !same(m[1], m[2])) { found.push({ at: path, contrast: `${m[1]} → ${m[2]}`, text: n.slice(0, 160) }); return; }
    // Two arrow-marked readings only count when the string ALSO names a teardown mechanism,
    // otherwise "23/23 CONSUMED, 9 paths" and similar tallies would read as a pair of arms.
    if (!TEARDOWN_FLAG.test(n) && !/\bgit (revert|stash)\b/i.test(n)) return;
    const t = n.match(TWO_READINGS);
    if (t && !same(t[1], t[2])) found.push({ at: path, contrast: `${t[1]} → ${t[2]}`, text: n.slice(0, 160) });
  });
  return found;
}

// ─────────────────────────────────────────────────────────────────── teardown mechanism

const TEARDOWN_FLAG = /--(self[-_]?break|break|teardown|ablate|ablation|null|no[-_][a-z0-9-]+|revert|delete[-_]?fix|disable)\b/i;
const TEARDOWN_PROSE = /\b(git revert|git stash|reverted the (fix|change)|deleted the (fix|line|change)|removed the fix|on a copy|teardown|ablat(e|ed|ion))\b/i;

function findTeardownMechanism(v) {
  const hits = [];
  // A MECHANISM is a teardown flag on a script that exists on disk, or a git reversal naming a
  // commit. Anything else is a description of a teardown, which is the word tier by another name.
  const push = (text, kind) => {
    const s = String(text);
    if (TEARDOWN_FLAG.test(s)) {
      const script = resolveCommand(s);
      hits.push({ kind, text: s.slice(0, 160), script, executable: !!script });
    } else if (/\bgit (revert|stash|checkout)\b/i.test(s)) {
      hits.push({ kind, text: s.slice(0, 160), script: null, executable: true });
    }
  };
  for (const hc of v?.build?.harness_commands || []) push(hc?.command || hc?.cmd || '', 'build.harness_commands');
  for (const a of v?.artifacts || []) push(a?.produced_by || '', 'artifacts.produced_by');
  walk(v, (n, path, key) => {
    if (typeof n !== 'string') return;
    if (path.startsWith('build.harness_commands') || path.startsWith('artifacts')) return;
    // A REMEDY IS NOT A TEARDOWN. `biggest_gap.remedy.targets` saying "add an --ablate mode so the
    // weapon volume can be graded on its own" is future work the critic is asking for; counting it
    // as an executed reversal credited two verdicts with a delete-the-fix that had not happened.
    // Exactly the act/word confusion this tool exists to remove, one level up.
    if (/^(biggest_gap|other_gaps|rulings|gap_closure)\b/.test(path) || /remedy|acceptance|next_round|recommend/i.test(path)) return;
    push(n, path || key);
  });
  // Executable mechanisms first, so the strongest evidence is the one reported.
  return hits.sort((a, b) => Number(b.executable) - Number(a.executable));
}

// ─────────────────────────────────────────────────────────────────── self-tests

const SELFTEST_FLAG = /--(self[-_]?test|self[-_]?check|self[-_]?break|break|selftest)\b/i;

/** An arm STATED to have gone red. Deliberately narrow — "failed" on its own is not this. */
const RED_ARM = /(watch|watched|went|goes|going|came out|turned|read|reads)\s+red\b|\bred\s*[-—–]\s*OK\b|\b\d+\s*(?:of|\/)\s*\d+\s+red\b|\ball (?:arms|checks|probes)\s+red\b|\bcontrol (?:arm )?(?:went|goes|is) red\b|\bred on both arms\b/i;

/** A command string → { script, flag } if it names a script that exists in the repo. */
function resolveCommand(cmd) {
  if (typeof cmd !== 'string') return null;
  const m = cmd.match(/([A-Za-z0-9_./-]+\.mjs|[A-Za-z0-9_./-]+\.js|\.\/[A-Za-z0-9_.-]+\.sh)/);
  if (!m) return null;
  const p = m[1].replace(/^\.\//, '');
  return existsSync(join(ROOT, p)) ? p : null;
}

function findSelfTests(v) {
  const green = [], red = [], unresolved = [];
  const consider = (cmd, exit, where, note) => {
    if (typeof cmd !== 'string' || !SELFTEST_FLAG.test(cmd)) return;
    const script = resolveCommand(cmd);
    const row = { command: cmd.slice(0, 200), script, exit_code: exit ?? null, at: where, note: note ? String(note).slice(0, 200) : null };
    if (!script) { unresolved.push(row); return; }
    const isBreak = /--(self[-_]?break|break)\b/i.test(cmd);
    // A red arm is an OBSERVED failure, not the word "fail" somewhere in a note. The loose version
    // of this line counted a note containing "failed" as a red arm and inflated arms_disagree by
    // four; the tight version requires a non-zero exit or an explicit statement that the arm went
    // red. Rule 6: a control you have never seen fail is not evidence.
    const wentRed = (typeof exit === 'number' && exit !== 0) || (note && RED_ARM.test(String(note)));
    if (isBreak && wentRed) red.push(row);
    else if (isBreak) { row.red_unproven = true; green.push(row); }
    else if (typeof exit === 'number' && exit === 0) green.push(row);
    else green.push(row);
  };

  for (const hc of v?.build?.harness_commands || []) {
    consider(hc?.command || hc?.cmd, typeof hc?.exit_code === 'number' ? hc.exit_code : (typeof hc?.exit === 'number' ? hc.exit : null),
      'build.harness_commands', hc?.stdout_artifact || hc?.note || hc?.result);
  }
  for (const a of v?.artifacts || []) consider(a?.produced_by, null, 'artifacts.produced_by', a?.note);
  // The ad-hoc spellings: `self_tests: { "<command>": "<result>" }` and friends.
  walk(v, (n, path, key, parent) => {
    if (path.startsWith('build.harness_commands') || path.startsWith('artifacts')) return;
    if (typeof n === 'string' && SELFTEST_FLAG.test(key)) consider(key, null, path, n);
    if (typeof n === 'string' && SELFTEST_FLAG.test(n) && parent && !Array.isArray(parent)) {
      consider(n, typeof parent.exit_code === 'number' ? parent.exit_code : null, path, parent.result || parent.note || parent.observed);
    }
  });
  return { green, red, unresolved };
}

/**
 * The strongest observable available: re-run the named self-test and read the exit code.
 * Off by default — it executes repo tools, and rule 13 keeps that off any shared path.
 */
function verifySelfTest(script, cmd, timeoutMs = 60000) {
  try {
    const argv = cmd.split(/\s+/).slice(cmd.split(/\s+/).findIndex((t) => t.includes(script)) + 1)
      .filter((t) => t.startsWith('--')).slice(0, 4);
    execFileSync(process.execPath, [join(ROOT, script), ...argv], { cwd: ROOT, timeout: timeoutMs, stdio: 'ignore' });
    return { ran: true, exit_code: 0 };
  } catch (e) {
    if (e.killed || e.signal) return { ran: false, reason: 'timeout' };
    return { ran: true, exit_code: typeof e.status === 'number' ? e.status : null };
  }
}

// ─────────────────────────────────────────────────────────────────── consumption

const CONSUMER_PATH = /\b(game\/src\/[A-Za-z0-9_./-]+\.(?:js|mjs))\b/;

const CONSUMPTION_SCRIPT = /consum|couple/i;

function findConsumption(v, fileIndex) {
  // ROUTE A — the aggregation RAN. A consumption harness that exists on disk, with an exit code.
  // This is the shape the project actually produced: one tool per piece, named in the verdict.
  const runs = findRunOfScript(v, CONSUMPTION_SCRIPT).filter((r) => r.exit_code === 0);
  if (runs.length) return { tier: 'act', route: 'harness', evidence: [{ ran: runs[0].script, at: runs[0].at, exit_code: 0, note: runs[0].text }] };

  // ROUTE B — the perturbation is written down with both readings.
  // Any object anywhere that is *about* consumption. RI-MTH07 has been spelled ~30 ways.
  const blocks = [];
  walk(v, (n, path, key) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return;
    if (!/consum|coupling|ablation/i.test(key)) return;
    blocks.push({ at: path, node: n });
  });
  if (!blocks.length) return { tier: 'absent', evidence: [] };

  let bestTier = 'word';
  const evidence = [];
  for (const b of blocks) {
    const text = allText(b.node);
    // 1. a named world-side consumer that EXISTS
    let consumer = null;
    walk(b.node, (n, p, k) => {
      if (typeof n !== 'string' || consumer) return;
      if (!/consumer|reader|read_by|coupled_to|only_consumer/i.test(k) && !CONSUMER_PATH.test(n)) return;
      const m = n.match(CONSUMER_PATH);
      if (m && fileIndex.has(m[1])) consumer = { path: m[1], at: p };
    });
    // 2. a perturbation named
    const perturbed = /perturb|ablat|pinned to|forced to|suspend|nulled|deleted|set to/i.test(text)
      || Object.keys(b.node).some((k) => /perturb|ablat/i.test(k));
    // 3. two entity observations that differ
    const arms = [...findDisagreeingArms(b.node), ...findProseArms(b.node)];
    if (consumer && perturbed && arms.length) {
      bestTier = 'act';
      evidence.push({ at: b.at, route: 'arms', consumer: consumer.path, arms: arms[0] });
    } else if (bestTier !== 'act' && (perturbed || consumer)) {
      bestTier = 'claim';
      evidence.push({ at: b.at, consumer: consumer ? consumer.path : null, perturbation_named: perturbed, arms: null });
    }
  }
  if (bestTier === 'word' && blocks.length) evidence.push({ at: blocks[0].at, note: 'a consumption block exists but names no surviving consumer, no perturbation and no disagreeing arms' });
  return { tier: bestTier, evidence };
}

// ─────────────────────────────────────────────────────────────────── read-the-file

const CITE = /`?([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:mjs|js|json|md|html|css|jsonl))(?::|#L)(\d+)(?:\s*[-–]\s*\d+)?`?/g;

function buildFileIndex() {
  const out = new Map();       // repo-relative path -> true, plus suffix map
  const suffix = new Map();    // basename or tail -> [paths]
  const skip = new Set(['node_modules', '.git', 'tmp', 'home']);
  const rec = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) rec(p);
      else {
        const r = rel(p);
        out.set(r, true);
        for (const tail of tails(r)) {
          if (!suffix.has(tail)) suffix.set(tail, []);
          suffix.get(tail).push(r);
        }
      }
    }
  };
  const tails = (r) => {
    const parts = r.split('/');
    const t = [];
    for (let i = parts.length - 1; i >= 0 && parts.length - i <= 4; i--) t.push(parts.slice(i).join('/'));
    return t;
  };
  rec(ROOT);
  return { has: (p) => out.has(p), resolve: (p) => (out.has(p) ? p : ((suffix.get(p) || []).length === 1 ? suffix.get(p)[0] : null)) };
}

const blobCache = new Map();
function fileAt(commit, path) {
  const key = `${commit || 'WT'}:${path}`;
  if (blobCache.has(key)) return blobCache.get(key);
  let text = null;
  if (commit) text = git(['show', `${commit}:${path}`]);
  if (text === null) { try { text = readFileSync(join(ROOT, path), 'utf8'); } catch { text = null; } }
  blobCache.set(key, text);
  return text;
}

/**
 * A citation verifies when the file resolves, the cited line EXISTS at the judged commit, and —
 * where the verdict quotes the line — the quote is actually within a few lines of it.
 * The quote is what makes this an act rather than a claim: a summary does not carry line 506's text.
 */
function findVerifiedCitations(text, commit, fileIndex, max = 40) {
  const rows = [];
  let m; CITE.lastIndex = 0;
  let n = 0;
  while ((m = CITE.exec(text)) !== null && n < max) {
    n++;
    const raw = m[1], line = Number(m[2]);
    const path = fileIndex.resolve(raw);
    if (!path) { rows.push({ raw, line, status: 'unresolved' }); continue; }
    const blob = fileAt(commit, path);
    if (blob === null) { rows.push({ raw, path, line, status: 'no-blob' }); continue; }
    const lines = blob.split('\n');
    if (line > lines.length) { rows.push({ raw, path, line, status: 'line-out-of-range' }); continue; }
    // Look for a backticked quote in the 240 characters after the citation.
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 240);
    const q = after.match(/`([^`\n]{8,120})`/);
    if (q) {
      const needle = q[1].trim();
      const window = lines.slice(Math.max(0, line - 9), Math.min(lines.length, line + 8)).join('\n');
      const hit = window.includes(needle) || window.replace(/\s+/g, ' ').includes(needle.replace(/\s+/g, ' '));
      rows.push({ raw, path, line, status: hit ? 'quote-verified' : 'quote-mismatch', quote: needle.slice(0, 80) });
    } else {
      rows.push({ raw, path, line, status: 'line-in-range' });
    }
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────── separate critic

function judgeSeparateCritic(v, verdictPath) {
  const run = v?.critic?.run_id;
  const coi = v?.critic?.conflict_of_interest;
  const buildSha = v?.build?.commit_sha;
  if (!run) return { tier: 'absent', evidence: [{ note: 'no critic.run_id' }] };
  if (coi === true) return { tier: 'word', evidence: [{ note: 'critic declares a conflict of interest' }] };
  if (!buildSha) return { tier: 'claim', evidence: [{ run_id: run, note: 'critic.run_id present, no build.commit_sha to separate it from' }] };
  // The act: the verdict file was introduced by a commit that is NOT the build it judges.
  const intro = git(['log', '--diff-filter=A', '--format=%H', '--', verdictPath]);
  const introSha = intro ? intro.trim().split('\n').filter(Boolean).pop() : null;
  if (!introSha) return { tier: 'claim', evidence: [{ run_id: run, note: 'verdict file has no introducing commit in git (uncommitted)' }] };
  const full = git(['rev-parse', buildSha]);
  const buildFull = full ? full.trim() : null;
  if (!buildFull) return { tier: 'claim', evidence: [{ run_id: run, build_commit: buildSha, note: 'build.commit_sha does not resolve in this repo' }] };
  if (introSha === buildFull) {
    return { tier: 'word', evidence: [{ run_id: run, note: 'the verdict landed in the very commit it judges — builder and critic are the same act' }] };
  }
  return { tier: 'act', evidence: [{ run_id: run, build_commit: buildFull.slice(0, 7), verdict_commit: introSha.slice(0, 7), coi_self_reported: coi === false }] };
}

// ─────────────────────────────────────────────────────────────────── the phrase (word tier)

const PHRASE = {
  delete_the_fix: /delete[-\s]?the[-\s]?fix|deleted the fix|teardown|delete-the-fix/i,
  consumption: /\bCONSUMPTION\b|RI-MTH07/,
  self_test: /self[-\s]?test/i,
  arms_disagree: /arms? (that )?(genuinely )?(dis)?agree|went red|watched red/i,
  read_the_file: /read the (actual )?file|source_reads|read the source/i,
  separate_critic: /separate critic|fresh context/i,
};

// ─────────────────────────────────────────────────────────────────── the scorer

export function scoreVerdict({ json, jsonPath, prose, fileIndex }) {
  const v = json;
  const commit = v?.build?.commit_sha || null;
  const text = [prose || '', allText(v || {})].join('\n');
  const out = { piece_id: v?.piece_id || (jsonPath ? basename(jsonPath, '.json') : '?'), path: jsonPath ? rel(jsonPath) : null, commit, items: {} };

  const say = (item, tier, evidence) => { out.items[item] = { tier, evidence: evidence || [] }; };
  const wordTier = (item) => (PHRASE[item].test(text) ? 'word' : 'absent');

  // 1 — separate critic
  say('separate_critic', ...(() => { const r = judgeSeparateCritic(v || {}, out.path || ''); return [r.tier, r.evidence]; })());

  // 2 — delete the fix: a named teardown AND two readings that differ.
  // The teardown must be a MECHANISM (a flag on a script that exists, or a git reversal), and the
  // two readings must actually differ. Either half alone is a claim; a phrase is neither half.
  {
    const teardown = findTeardownMechanism(v || {}).filter((t) => t.executable !== false);
    const arms = [...findDisagreeingArms(v || {}), ...findProseArms(v || {})];
    const inert = findIdenticalArms(v || {});
    if (teardown.length && arms.length) say('delete_the_fix', 'act', [{ teardown: teardown[0], arms: arms[0], arm_pairs: arms.length }]);
    else if (arms.length) say('delete_the_fix', 'claim', [{ arms: arms[0], note: 'two arms differ but no teardown mechanism is named — the reversal is believed, not executed' }]);
    else if (teardown.length) say('delete_the_fix', 'claim', [{ teardown: teardown[0], note: 'a teardown is named but no pair of disagreeing readings is recorded' }]);
    else {
      // A teardown recorded under a key that NAMES it a teardown, with a stated outcome, is more
      // than a phrase and less than a residue: the reversal is described but nothing here can
      // re-derive it. `claim`, not `word`, and not counted either way.
      const declared = [];
      walk(v || {}, (n, p, k) => {
        if (typeof n !== 'string' || n.length < 20) return;
        if (/teardown|delete.?the.?fix|deletefix|rule_?6|reversal|ablation|null_control/i.test(k)) declared.push({ at: p, text: n.slice(0, 160) });
      });
      if (declared.length) say('delete_the_fix', 'claim', [{ note: 'a teardown is declared in a teardown-named field but names no command and no pair of readings — described, not re-derivable', first: declared[0] }]);
      else say('delete_the_fix', wordTier('delete_the_fix'), inert.length ? [{ note: 'arms are present and IDENTICAL — rule 6 calls that an inert control, not a result', inert: inert[0] }] : []);
    }
    if (inert.length && out.items.delete_the_fix.tier === 'act') out.items.delete_the_fix.inert_control_warning = inert[0];
  }

  // 3 — consumption
  {
    const c = findConsumption(v || {}, fileIndex);
    say('consumption', c.tier === 'absent' ? wordTier('consumption') : c.tier, c.evidence);
  }

  // 4/5 — self-test, and a red arm
  {
    const st = findSelfTests(v || {});
    if (st.green.length || st.red.length) say('self_test', 'act', [{ green: st.green.length, red: st.red.length, first: st.green[0] || st.red[0] }]);
    else if (st.unresolved.length) say('self_test', 'claim', [{ note: 'a self-test command is named but its script does not exist in this repo', first: st.unresolved[0] }]);
    else say('self_test', wordTier('self_test'), []);

    // arms_disagree: a RED arm observed, or a teardown recorded as watched red beside a green one.
    const redProse = [];
    walk(v || {}, (n, p, k) => {
      if (typeof n !== 'string') return;
      if (RED_ARM.test(n) && /teardown|break|control|arm|self.?test|instrument|gates_run/i.test(`${k} ${p}`)) {
        redProse.push({ at: p, text: n.slice(0, 140) });
      }
    });
    if (st.red.length) say('arms_disagree', 'act', [{ red_exit: st.red[0], green: st.green.length }]);
    else if (redProse.length && (st.green.length || findTeardownMechanism(v || {}).length)) say('arms_disagree', 'act', [{ red_arm_recorded: redProse[0], green_selftests: st.green.length }]);
    else if (v?.self_audit?.instrument_self_break_watched_red === true || v?.self_audit?.did_my_instrument_go_red === true || v?.self_audit?.broke_what_i_measured_on_purpose === true) {
      say('arms_disagree', 'claim', [{ note: 'a self-audit boolean asserts the instrument went red; no red arm is recorded anywhere with it' }]);
    } else say('arms_disagree', wordTier('arms_disagree'), []);
  }

  // 6 — read the file
  {
    const cites = findVerifiedCitations(text, commit, fileIndex);
    const verified = cites.filter((c) => c.status === 'quote-verified');
    const inRange = cites.filter((c) => c.status === 'line-in-range');
    const mismatch = cites.filter((c) => c.status === 'quote-mismatch');
    if (verified.length) say('read_the_file', 'act', [{ verified: verified.length, cited: cites.length, first: verified[0], quote_mismatches: mismatch.length }]);
    else if (inRange.length) say('read_the_file', 'claim', [{ note: 'lines are cited and exist at the judged commit, but nothing is quoted, so a summary could have produced them', in_range: inRange.length, cited: cites.length }]);
    else if ((v?.source_reads || []).some((s) => s?.path && fileIndex.resolve(s.path))) say('read_the_file', 'claim', [{ note: 'source_reads[] names files that exist — a self-report, not a residue of reading' }]);
    else say('read_the_file', wordTier('read_the_file'), cites.length ? [{ note: `${cites.length} citation(s), none verifiable`, first: cites[0] }] : []);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────── corpus sweep

function verdictFiles() {
  const out = [];
  const vd = join(ROOT, 'corpus', '90-verdicts');
  if (!existsSync(vd)) return out;
  for (const w of readdirSync(vd)) {
    const wd = join(vd, w);
    if (!statSync(wd).isDirectory()) continue;      // GAP-LEDGER.* live at the top and are not verdicts
    for (const f of readdirSync(wd)) {
      if (!f.endsWith('.json') || f === 'COHERENCE.json') continue;
      out.push({ json: join(wd, f), prose: join(wd, f.replace(/\.json$/, '.md')), wave: w });
    }
  }
  // A verdict may be prose-only (2 of 73 in wave 1). Counted, and it will score low, honestly.
  for (const w of readdirSync(vd)) {
    const wd = join(vd, w);
    if (!statSync(wd).isDirectory()) continue;
    for (const f of readdirSync(wd)) {
      if (!f.endsWith('.md')) continue;
      const j = join(wd, f.replace(/\.md$/, '.json'));
      if (!existsSync(j)) out.push({ json: null, prose: join(wd, f), wave: w });
    }
  }
  return out.sort((a, b) => String(a.prose).localeCompare(String(b.prose)));
}

export function sweep({ verify = false } = {}) {
  const fileIndex = buildFileIndex();
  const rows = [];
  for (const f of verdictFiles()) {
    let json = null;
    if (f.json) { try { json = JSON.parse(readFileSync(f.json, 'utf8')); } catch { json = null; } }
    let prose = '';
    try { prose = readFileSync(f.prose, 'utf8'); } catch { /* prose is optional */ }
    const r = scoreVerdict({ json, jsonPath: f.json, prose, fileIndex });
    r.wave = f.wave;
    r.has_structured_json = !!json;
    r.prose_path = rel(f.prose);
    if (!r.commit) r.commit = null;
    if (verify && json) {
      const st = findSelfTests(json);
      const cand = (st.green[0] || st.red[0]);
      if (cand && cand.script) r.self_test_verified = { ...verifySelfTest(cand.script, cand.command), script: cand.script };
    }
    rows.push(r);
  }
  return rows;
}

export function tally(rows) {
  const counts = {}, claims = {}, words = {};
  for (const it of ITEMS) { counts[it] = 0; claims[it] = 0; words[it] = 0; }
  for (const r of rows) for (const it of ITEMS) {
    const t = r.items[it]?.tier;
    if (t === 'act') counts[it]++;
    else if (t === 'claim') claims[it]++;
    else if (t === 'word') words[it]++;
  }
  return { counts, claimed_only: claims, word_only: words, verdicts: rows.length };
}

// ─────────────────────────────────────────────────────────────────── the ledger side-car

function buildLedger(rows, { verified = false } = {}) {
  const t = tally(rows);
  const head = git(['rev-parse', 'HEAD']);
  const byWave = {};
  for (const r of rows) {
    const w = r.wave || 'unknown';
    byWave[w] ||= { verdicts: 0, counts: Object.fromEntries(ITEMS.map((i) => [i, 0])) };
    byWave[w].verdicts++;
    for (const it of ITEMS) if (r.items[it]?.tier === 'act') byWave[w].counts[it]++;
  }
  return {
    schema: 'elder-souls/rigour@1',
    generated_at: new Date().toISOString(),
    generator: 'tools/rigour.mjs',
    commit: head ? head.trim().slice(0, 7) : null,
    // What this measures, in one line, because a guard nobody can read is how a programme loses it.
    measures: 'the five non-negotiables of COST.md §1, counted as ACTS (an observable the act produced) rather than as WORDS (the phrase in prose)',
    population: { verdicts: rows.length, with_structured_json: rows.filter((r) => r.has_structured_json).length, source: 'corpus/90-verdicts/<wave>/*.json + .md' },
    tiers: {
      act: 'an observable the act itself produced, re-derived here from the verdict and the repo. COUNTED.',
      claim: 'a self-report — a boolean or a status with no numbers behind it. Published, NOT counted.',
      word: 'the phrase appears and nothing else. Published as the gameability meter, NOT counted.',
    },
    counts: t.counts,
    claimed_only: t.claimed_only,
    word_only: t.word_only,
    // The number the whole piece exists to expose. If this rises the programme is producing
    // verdicts that say the words, which is exactly the degradation G3 is meant to catch.
    word_to_act_gap: Object.fromEntries(ITEMS.map((i) => [i, t.word_only[i] + t.claimed_only[i] - 0])),
    by_wave: byWave,
    strength: {
      separate_critic: 'medium — the commit separation is structural, but `conflict_of_interest` is self-reported',
      delete_the_fix: 'strong — two recorded readings that differ cannot be produced by writing a phrase',
      consumption: 'strong — the consumer path is checked against disk and the arms must differ',
      self_test: verified ? 'strongest — the named self-test was RE-EXECUTED here' : 'strong — the script must exist on disk and carry an exit code (run with --verify to re-execute)',
      arms_disagree: 'medium-strong — a non-zero exit is strong; a "watched red" note beside a green run is weaker',
      read_the_file: 'strong where a quote verifies at the judged commit; weak where only a line number is cited',
    },
    weak: ['separate_critic'],
    limits: [
      'No instrument here can detect a FABRICATED pair of arms. It can only detect their absence. Rigour ultimately rests on the honesty of the numbers a critic writes down.',
      'Backfilled counts read ~200 ad-hoc key spellings and will under-count acts that were recorded in prose only. An under-count is the safe direction for a guard; it is never inflated to compensate.',
      'A verdict predating the rigour block is scored by recognisers, not by its own declaration. Forward verdicts carrying `rigour` are scored from it directly and are strictly more reliable.',
    ],
    status: 'measured',
  };
}

// ─────────────────────────────────────────────────────────────────── self-test
//
// Arms that genuinely disagree. Arm A is a verdict where the ACTS occurred and must COUNT.
// Arm B is the whole point of the exercise: the same five PHRASES, in a verdict where nothing was
// done, which must NOT count. Arm B is built from a real historical verdict — see below.

const FIXTURE_ACT = {
  piece_id: 'FIXTURE-ACT',
  critic: { run_id: 'crit-fixture-act', conflict_of_interest: false },
  build: {
    commit_sha: 'HEAD',
    harness_commands: [
      { command: 'node tools/rigour.mjs --self-test', exit_code: 0 },
      { command: 'node tools/rigour.mjs --self-break', exit_code: 3 },
    ],
  },
  arbitration: {
    consumption: {
      status: 'pass',
      world_side_consumer: 'game/src/sim/souls.js',
      perturbation: 'level_curve multiplied by 4 in the loaded model',
      shipped: 'enemy dies at 3 hits',
      perturbed: 'enemy dies at 11 hits',
    },
  },
  measurements: {
    deletefix_arms: { with_fix: 0, without_fix: 115 },
  },
  teardown: 'node tools/rigour.mjs --self-break restores the pre-fix branch on a copy',
};

// Arm B: the words, no deeds. Every phrase from the five non-negotiables is present.
const FIXTURE_WORD = {
  piece_id: 'FIXTURE-WORD',
  critic: { run_id: 'crit-fixture-word', conflict_of_interest: false },
  build: { commit_sha: 'HEAD' },
  notes: [
    'I ran delete-the-fix and the old number came back.',
    'The CONSUMPTION check (RI-MTH07) passes: the model has a world-side consumer.',
    'My instrument has a self-test and I watched it go red, so the arms genuinely disagree.',
    'I read the actual file rather than trusting a summary, and a separate critic with fresh context reviewed this.',
  ],
  arbitration: { consumption: { status: 'pass', note: 'consumption is demonstrated.' } },
};

// A third arm, because rule 6 says a control you have never seen fail is not evidence: arms that
// are PRESENT and IDENTICAL. That is an inert control, and it must not count as delete-the-fix.
const FIXTURE_INERT = {
  piece_id: 'FIXTURE-INERT',
  critic: { run_id: 'crit-fixture-inert', conflict_of_interest: false },
  build: { commit_sha: 'HEAD', harness_commands: [{ command: 'node tools/x.mjs --teardown', exit_code: 0 }] },
  measurements: { arms: { with_fix: 442141, without_fix: 442141 } },
};

function selfTest() {
  const fileIndex = buildFileIndex();
  const results = [];
  const check = (name, got, want) => { results.push({ name, got, want, pass: got === want }); };

  const act = scoreVerdict({ json: FIXTURE_ACT, jsonPath: null, prose: '', fileIndex });
  const word = scoreVerdict({ json: FIXTURE_WORD, jsonPath: null, prose: '', fileIndex });
  const inert = scoreVerdict({ json: FIXTURE_INERT, jsonPath: null, prose: '', fileIndex });

  // ARM A — the acts occurred. They must count.
  check('A1 act: delete_the_fix counts', act.items.delete_the_fix.tier, 'act');
  check('A2 act: consumption counts', act.items.consumption.tier, 'act');
  check('A3 act: self_test counts', act.items.self_test.tier, 'act');
  check('A4 act: arms_disagree counts', act.items.arms_disagree.tier, 'act');

  // ARM B — ONLY THE PHRASE. This is the arm that makes the instrument worth anything.
  check('B1 word: delete_the_fix does NOT count', word.items.delete_the_fix.tier, 'word');
  check('B2 word: consumption does NOT count as an act', word.items.consumption.tier === 'act', false);
  check('B3 word: self_test does NOT count', word.items.self_test.tier, 'word');
  check('B4 word: arms_disagree does NOT count', word.items.arms_disagree.tier, 'word');
  check('B5 word: read_the_file does NOT count', word.items.read_the_file.tier === 'act', false);

  // ARM C — an inert control: arms present, arms identical. Not a delete-the-fix.
  check('C1 inert: identical arms do NOT count', inert.items.delete_the_fix.tier === 'act', false);

  // ARM D — the corpus itself must be non-degenerate. An instrument that scores everything the same
  // is a second copy of the experiment. Both of these have been seen to fail during development.
  const rows = sweep();
  const t = tally(rows);
  check('D1 corpus: some verdict counts an act', ITEMS.some((i) => t.counts[i] > 0), true);
  check('D2 corpus: not every verdict counts every act', ITEMS.some((i) => t.counts[i] < rows.length), true);
  check('D3 corpus: the word tier is non-empty (words without deeds exist)', ITEMS.some((i) => t.word_only[i] > 0), true);

  // ARM E — the real historical verdict that says the words without the deed.
  // Found by sweeping wave 1 for a verdict whose prose carries a non-negotiable's phrase while its
  // structure carries no residue of the act. Asserted by name so that if the corpus changes under
  // us, this arm reports the change instead of silently passing.
  const realWord = rows.find((r) => r.items.delete_the_fix.tier === 'word');
  check('E1 a real verdict says "delete-the-fix" and shows no arms', !!realWord, true);
  if (realWord) results[results.length - 1].detail = realWord.path || realWord.prose_path;

  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  (got ${JSON.stringify(r.got)}, want ${JSON.stringify(r.want)})`}${r.detail ? `  — ${r.detail}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} pass`);
  if (failed.length) { console.log('\nSELF-TEST RED.'); process.exit(1); }
  console.log('\nSelf-test green. Break a recogniser and re-run: arms B* and C1 are the ones that must go red.');
  process.exit(0);
}

/** The deliberate break, so the self-test can be watched failing (rule 4). */
function selfBreak() {
  console.log('rigour --self-break: this flag exists so the self-test can be SEEN to fail.');
  console.log('Run:  node tools/rigour.mjs --self-test --break-recogniser');
  process.exit(3);
}

// ─────────────────────────────────────────────────────────────────── cli

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f, d) => { const i = argv.indexOf(f); return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

// Importable as a library — the CLI must not run on import, or every consumer of `sweep()` pays
// for a full corpus scan and a printed table it did not ask for.
const IS_MAIN = process.argv[1] && (process.argv[1].endsWith('rigour.mjs'));
if (!IS_MAIN) { /* library use */ }
else if (has('--self-break')) selfBreak();

else if (has('--break-recogniser')) {
  // Rule 6, the inert-control half: prove the control arm goes red by breaking the recogniser.
  // With arm detection disabled, arms B* still pass (they never had arms) but arms A1/A2 must FAIL.
  POSITIVE_ARM.test = () => false;
  selfTest();
}
else if (has('--self-test')) selfTest();
else if (IS_MAIN) {
  const verify = has('--verify');
  const rows = sweep({ verify });
  const t = tally(rows);
  const ledger = buildLedger(rows, { verified: verify });

  const outPath = arg('--json', has('--json') ? 'docs/data/rigour.json' : null);
  if (outPath) {
    const p = join(ROOT, outPath);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ ...ledger, verdicts: rows }, null, 2) + '\n');
    console.log(`wrote ${rel(p)}`);
  }

  console.log(`\nG3 — the five non-negotiables, counted as acts. ${rows.length} verdicts, ${rows.filter((r) => r.has_structured_json).length} with structured JSON.\n`);
  const w = 16;
  console.log(`${'item'.padEnd(20)}${'ACT'.padStart(6)}${'claim'.padStart(8)}${'word'.padStart(7)}${'absent'.padStart(8)}   strength`);
  for (const it of ITEMS) {
    const a = t.counts[it], c = t.claimed_only[it], wd = t.word_only[it];
    console.log(`${it.padEnd(20)}${String(a).padStart(6)}${String(c).padStart(8)}${String(wd).padStart(7)}${String(rows.length - a - c - wd).padStart(8)}   ${ledger.strength[it].split(' —')[0]}`);
  }
  console.log(`\nCOUNTED = ACT only. 'word' is the gameability meter: the phrase with no residue behind it.`);
  console.log(`A guard that cannot tell those two columns apart is decorative, which is the state this replaces.\n`);

  if (has('--detail')) {
    for (const r of rows) {
      // ACT / claim / word / -  — never single letters: `act` and `absent` share a first letter,
      // and an abbreviation that cannot tell the counted tier from the empty one is the exact
      // defect this whole tool exists to remove. It printed `a` for both for one round.
      const glyph = { act: 'ACT ', claim: 'clam', word: 'word', absent: ' -  ' };
      const line = ITEMS.map((i) => `${i}=${glyph[r.items[i]?.tier] || '????'}`).join(' ');
      console.log(`${(r.piece_id || '?').padEnd(24)} ${line}   ${r.path || r.prose_path}`);
    }
  }
  process.exit(0);      // an instrument, never a gate (rule 13)
}
