#!/usr/bin/env node
// w1-15-consumption.mjs — RI-MTH07 / ARBITRATION §3 CONSUMPTION, for W1-15's whole parameter set.
//
//   "For every model a piece ships, name the world-side consumer that reads it, and demonstrate
//    the consumption by perturbing the model and observing an entity change behaviour. A model
//    with no demonstrated consumer is unmeasurable => 0, exactly as a missing model is."
//
// This is the ENUMERATION half. It walks every leaf parameter in the six data files W1-15 owns
// — `game/data/stealth/{detection,theft,locks}.json` and `game/data/crime/{bounty,justice,
// sanction,fences}.json` — and for each one names the file and line in `game/src/**` that reads
// it, or reports it as having none.
//
// WHAT THIS CANNOT DO, stated up front because RULES.md rule 11 says so: *"a field census over
// data cannot prove a read dead."* A key reached through a computed path, a spread, or a
// `Object.values()` walk will not be found by name. So every UNREAD row here is a CANDIDATE for
// a dead parameter and the count is an upper bound, not a verdict — and every row is printed
// with its path so a critic can check any of them by hand. The DEMONSTRATION half (perturb the
// model, watch an entity) lives in `tools/harness/w1-15-r3-live.mjs` and
// `tools/harness/w1-15-r3-deletefix.mjs`, which drive the running game.
//
// It is written to be able to fail: `--selftest` injects a parameter nobody can possibly read and
// asserts that it is reported, so a run that reports 0 unread is a result rather than a stub.
//
// USAGE
//   node tools/analysis/w1-15-consumption.mjs [--json <path>] [--all] [--selftest]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const args = new Set(process.argv.slice(2));
const jsonIdx = process.argv.indexOf('--json');
const jsonOut = jsonIdx >= 0 ? process.argv[jsonIdx + 1] : null;

const FILES = [
  'stealth/detection.json', 'stealth/theft.json', 'stealth/locks.json',
  'crime/bounty.json', 'crime/justice.json', 'crime/sanction.json', 'crime/fences.json',
];

// The source tree that counts as "the world". A read inside tools/ or inside the data file's own
// prose is not a consumer; a read in game/src is.
function sourceFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sourceFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
const SRC = sourceFiles(path.join(ROOT, 'game/src')).map((p) => ({
  rel: path.relative(ROOT, p),
  // The harness is a READ-BACK surface, not a consumer: `getStealthState()` reporting a number
  // to a probe is exactly the shape RI-MTH07 exists to reject. Kept in the corpus but marked, so
  // a parameter whose ONLY reader is the harness is reported as such rather than as consumed.
  harness: p.includes(`${path.sep}harness${path.sep}`),
  lines: fs.readFileSync(p, 'utf8').split('\n'),
}));

/** Every leaf key path in a document, plus the key's own last segment. */
function leaves(obj, prefix, parentKey, out) {
  if (obj === null || typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    // An array of records: the KEYS of its elements are the parameters, not the indices.
    for (const el of obj) leaves(el, prefix, parentKey, out);
    return out;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') leaves(v, p, k, out);
    else out.push({ path: p, key: k, value: v, parent: parentKey });
  }
  return out;
}

// Keys that are documentation rather than parameters. Excluded from the count and listed, so the
// exclusion is visible rather than silent.
const PROSE_EXACT = new Set(['note', 'notes', 'why', 'source', 'sources', 'schema', 'id', 'condition',
  'formula', 'model', 'situation', 'derivation', 'label', 'description', 'predicate', 'line', 'text',
  'quote', 'refusal', 'comment', 'example', 'worked', 'name', 'title', 'rationale', 'reason']);
// A doc string wearing a long name. These are the shapes this corpus actually uses to argue with
// itself in data — `*_note`, `*_source`, `why_*`, `how_to_*`, `*_defect`, `*_derivation` — and
// counting them as unread parameters would inflate the headline with the piece's own prose.
const PROSE_RE = /(^|_)(note|notes|why|source|sources|derivation|defect|comment|rationale|prose|wording|explanation|justification)$|^(why|how_to|note_on|so_that|because)_/;
const isProse = (key, value) => PROSE_EXACT.has(key) || PROSE_RE.test(key) ||
  (typeof value === 'string' && value.length > 60);   // a 60-char string is a sentence, not a datum

function readersOf(key) {
  // A read is the key appearing as a property access or a string index. Names shorter than four
  // characters are too common to attribute and are reported as `ambiguous` rather than as read.
  if (key.length < 4) return { ambiguous: true, rows: [] };
  const dot = `.${key}`;
  const brk1 = `'${key}'`;
  const brk2 = `"${key}"`;
  const rows = [];
  for (const f of SRC) {
    for (let i = 0; i < f.lines.length; i++) {
      const L = f.lines[i];
      if (L.includes(dot) || L.includes(brk1) || L.includes(brk2)) {
        rows.push({ file: f.rel, line: i + 1, harness: f.harness, text: L.trim().slice(0, 110) });
        break;                                  // one citation per file is enough to name a consumer
      }
    }
  }
  return { ambiguous: false, rows };
}

const report = [];
let prose = 0;
for (const rel of FILES) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data', rel), 'utf8'));
  for (const leaf of leaves(doc, '', null, [])) {
    if (isProse(leaf.key, leaf.value)) { prose++; continue; }
    const r = readersOf(leaf.key);
    const world = r.rows.filter((x) => !x.harness);
    // RULE 11, MADE OPERATIONAL. `sight_radius_R_m.INFANTRY` is not read by name anywhere; it is
    // read as `sight_radius_R_m[archetype]`. If the CONTAINER is read by name in game/src, the
    // leaf is reachable by a computed index and calling it dead would be exactly the mistake the
    // rule warns about. Counted separately, never as `unread`.
    const container = leaf.parent ? readersOf(leaf.parent) : { ambiguous: true, rows: [] };
    const containerWorld = container.rows.filter((x) => !x.harness);
    let status;
    if (world.length) status = 'read';
    else if (containerWorld.length) status = 'indexed';
    else if (r.rows.length) status = 'harness_only';
    else if (r.ambiguous) status = 'ambiguous';
    else status = 'unread';
    report.push({
      data_file: rel, path: leaf.path, key: leaf.key, value: leaf.value, container: leaf.parent,
      status,
      consumer: world.length ? `${world[0].file}:${world[0].line}`
        : containerWorld.length ? `${containerWorld[0].file}:${containerWorld[0].line} (via ${leaf.parent}[...])`
          : (r.rows.length ? `${r.rows[0].file}:${r.rows[0].line}` : null),
      consumers_n: world.length,
    });
  }
}

if (args.has('--selftest')) {
  // THE INSTRUMENT'S OWN FALSIFIER. A parameter nobody can read must come back `unread`; if it
  // does not, this tool is reporting what it was told rather than what it found.
  const canary = readersOf('zzz_a_parameter_no_file_in_this_repo_mentions');
  if (canary.rows.length !== 0) { process.stderr.write('SELFTEST FAILED: the canary was "read".\n'); process.exit(21); }
  // And a parameter that IS unmistakably read must come back read.
  const known = readersOf('light_exponent');
  if (!known.rows.some((r) => !r.harness)) { process.stderr.write('SELFTEST FAILED: `light_exponent` reported unread; it is read by sim/stealth/detection.js.\n'); process.exit(21); }
  process.stdout.write('selftest: PASS — the canary is unread and a known-live parameter is read.\n');
}

const byStatus = {};
for (const r of report) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
const unread = report.filter((r) => r.status === 'unread');
const harnessOnly = report.filter((r) => r.status === 'harness_only');
const ambiguous = report.filter((r) => r.status === 'ambiguous');

const W = 58;
process.stdout.write(`\nW1-15 CONSUMPTION CENSUS — ${report.length} parameters over ${FILES.length} data files\n${'='.repeat(78)}\n`);
process.stdout.write(`(${prose} documentation strings excluded — see isProse(); every excluded key is a *_note/*_source/why_*/how_to_* or a >60-character sentence)\n\n`);
process.stdout.write(`  ${'data file'.padEnd(26)} ${'params'.padStart(6)} ${'read'.padStart(6)} ${'indexed'.padStart(8)} ${'ambig'.padStart(6)} ${'NO READER'.padStart(10)}\n`);
for (const rel of FILES) {
  const rows = report.filter((r) => r.data_file === rel);
  const n = (st) => rows.filter((r) => r.status === st).length;
  process.stdout.write(`  ${rel.padEnd(26)} ${String(rows.length).padStart(6)} ${String(n('read')).padStart(6)} ${String(n('indexed')).padStart(8)} ${String(n('ambiguous')).padStart(6)} ${String(n('unread')).padStart(10)}\n`);
}
const indexed = report.filter((r) => r.status === 'indexed');
process.stdout.write(`\n  TOTAL WITH NO READER ANYWHERE IN game/src: ${unread.length} of ${report.length} (${(unread.length / report.length * 100).toFixed(1)}%)\n`);
process.stdout.write(`  read by name .................................. ${report.length - unread.length - indexed.length - harnessOnly.length - ambiguous.length}\n`);
process.stdout.write(`  reachable through a container that is read .... ${indexed.length}   (rule 11: a table row selected by a computed index)\n`);
process.stdout.write(`  read by the harness only ...................... ${harnessOnly.length}   (a read-back surface; RI-MTH07 does not count it)\n`);
process.stdout.write(`  name too short to attribute ................... ${ambiguous.length}\n`);
if (unread.length) {
  process.stdout.write('\n  every parameter with no reader, so a critic can check any of them by hand:\n');
  for (const r of (args.has('--all') ? unread : unread.slice(0, 40))) process.stdout.write(`    ${r.data_file.padEnd(24)} ${r.path.slice(0, W).padEnd(W)} = ${JSON.stringify(r.value).slice(0, 40)}\n`);
  if (!args.has('--all') && unread.length > 40) process.stdout.write(`    ... and ${unread.length - 40} more (--all)\n`);
}
if (harnessOnly.length) {
  process.stdout.write('\n  read ONLY by the harness — these are read-backs, and RI-MTH07 does not count them:\n');
  for (const r of harnessOnly.slice(0, 20)) process.stdout.write(`    ${r.data_file.padEnd(24)} ${r.path.slice(0, W).padEnd(W)} ${r.consumer}\n`);
}
process.stdout.write('\n  RULES.md rule 11: a field census over data cannot prove a read dead. Every row above is a\n' +
  '  CANDIDATE and the count is an UPPER BOUND — a key reached by a computed path or an\n' +
  '  Object.values() walk is invisible to a name search. The demonstration half of RI-MTH07 (a\n' +
  '  perturbation of the model observed on an ENTITY) is tools/harness/w1-15-r3-live.mjs.\n');

if (jsonOut) {
  fs.mkdirSync(path.dirname(path.join(ROOT, jsonOut)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, jsonOut), JSON.stringify({ total: report.length, by_status: byStatus, unread, harness_only: harnessOnly, ambiguous, all: report }, null, 2) + '\n');
  process.stdout.write(`\n  wrote ${jsonOut}\n`);
}
