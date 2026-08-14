#!/usr/bin/env node
// stale-canonical-census.mjs — which canonical artifacts are older than the code that feeds them?
//
//   node tools/composition/stale-canonical-census.mjs
//   node tools/composition/stale-canonical-census.mjs --tree /path/to/other/checkout
//   node tools/composition/stale-canonical-census.mjs --json reports/composition/stale-census.json
//   node tools/composition/stale-canonical-census.mjs --self-test      (no git, no repo)
//
// WHY THIS EXISTS. W1-25 round 2 did real live work and wrote it to NEW paths while the canonical
// one rotted: `reports/composition/w1/matrix.json` read `ran:false, 0 crossings, both hard fails`
// from 2026-08-08 for six days, while a side artifact three days newer recorded 12 demonstrated
// crossings. Nobody was careless — the canonical file was a fail-closed CONTENTION REFUSAL that the
// tool wrote on purpose, and re-running it needed a browser the box never had. The failure is that
// nothing anywhere went red about the gap. This tool is that red light.
//
// THE POPULATION, stated rather than implied. Every tool under `tools/**/*.mjs` that names a
// DEFAULT output path — `arg('out', '<literal>')` and its `OUT = ...` variants. A tool whose `out`
// defaults to `null` has no canonical path to rot and is listed separately as `no_default_path`;
// that is the better-behaved design and the census says so rather than hiding it.
//
// THE TEST, and why it is this one. RULES #12: "a measurement is a claim about a commit, not about
// the project." So the sharp, non-arbitrary question is not "is this file old" — old is fine for a
// stable subsystem — but: HAS THE CODE THAT PRODUCES IT MOVED SINCE IT WAS WRITTEN? If the last
// commit touching the producing tool is newer than the artifact, the artifact is not this commit's
// answer and no reader can tell. Bank commits are excluded from that history (they carry other
// agents' work mid-edit under one message and would date every tool to today); `git log
// --invert-grep --grep=Orchestrator-Bank` is the same technique RULES #17 gives for finding a
// file's authored history.
//
// FOUR VERDICTS, worst first. Any of the first three exits 2.
//   REFUSAL       the artifact records `ran:false` — an instrument that refused, being read as a
//                 measurement of the world. This is the W1-25 shape exactly.
//   BEHIND_SIDE   a NEWER artifact of the same `schema` exists at a different path. The real run
//                 happened and went somewhere else.
//   STALE_VS_TOOL the producing tool has been committed since the artifact was written.
//   FRESH         the artifact postdates the last authored change to its tool.
// ABSENT and UNTRACKED are reported alongside rather than as failures: many of these paths are
// covered by `reports/.gitignore`, which is a deliberate decision about size, not a defect — but
// an untracked canonical path is worth seeing, because it exists only on the container that made
// it and a fresh clone reads nothing there at all.
//
// SELF-TEST (RULES #4). The assessment is a pure function over rows, so it is tested against a
// fixture whose right answers are known, with NO git and NO filesystem. The negative arm is a
// PLAUSIBLE healthy tree — real timestamps, real schemas, tool commits that genuinely predate
// their artifacts — not an empty one. An empty fixture would pass by accident, which is how a
// landform instrument recently reported 71% coverage of a world containing none of the thing it
// measured.
//
// EXIT: 0 nothing stale · 2 at least one REFUSAL / BEHIND_SIDE / STALE_VS_TOOL · 5 self-test failed
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const has = (k) => argv.some((a) => a === `--${k}` || a.startsWith(`--${k}=`));
const arg = (k, d) => { const i = argv.findIndex((a) => a === `--${k}` || a.startsWith(`--${k}=`)); if (i < 0) return d; const a = argv[i]; return a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[i + 1]; };
const say = (s) => process.stdout.write(s + '\n');

// --------------------------------------------------------------------------------------------
// THE PURE CORE. Everything git- and disk-shaped is resolved by the caller and handed in, so the
// self-test exercises the same decision code the real run does rather than a lookalike.

export const VERDICT = {
  REFUSAL: 'REFUSAL',
  BEHIND_SIDE: 'BEHIND_SIDE',
  STALE_VS_TOOL: 'STALE_VS_TOOL',
  FRESH: 'FRESH',
  ABSENT: 'ABSENT',
};

/**
 * @param {{tool:string, out:string, exists:boolean, ran:boolean|null, artifactAt:number|null,
 *          toolCommitAt:number|null, schema:string|null,
 *          siblings:{path:string, at:number}[]}} row
 */
export function assess(row) {
  if (!row.exists) return { verdict: VERDICT.ABSENT, why: 'no file at the tool’s documented default path' };
  if (row.ran === false) {
    return { verdict: VERDICT.REFUSAL, why: 'the artifact records ran:false — the instrument refused and this is not a measurement of the world' };
  }
  const newerSibling = (row.siblings || [])
    .filter((s) => row.artifactAt != null && s.at > row.artifactAt)
    .sort((a, b) => b.at - a.at)[0];
  if (newerSibling) {
    return {
      verdict: VERDICT.BEHIND_SIDE,
      why: `a newer artifact of schema ${row.schema} is at ${newerSibling.path}`,
      side: newerSibling.path,
    };
  }
  if (row.artifactAt != null && row.toolCommitAt != null && row.toolCommitAt > row.artifactAt) {
    return { verdict: VERDICT.STALE_VS_TOOL, why: `${row.tool} was committed after this artifact was written` };
  }
  return { verdict: VERDICT.FRESH, why: 'postdates the last authored change to its producing tool' };
}

const BAD = new Set([VERDICT.REFUSAL, VERDICT.BEHIND_SIDE, VERDICT.STALE_VS_TOOL]);

/**
 * Is this artifact a MEASUREMENT of the world, or a control/refusal wearing the same schema?
 *
 * Added after the census's first live run flagged its own author. The two `--null-control` runs
 * written on 2026-08-14 carry `schema: elder-souls/cmp01-matrix@1` and are newer than the canonical
 * matrix, so the canonical came back BEHIND_SIDE against a file that measures NOTHING by design.
 * A control is not a competing measurement and must never displace one. `ran:false` is excluded on
 * the same principle — a refusal record elsewhere cannot be "the newer answer" either.
 *
 * Narrowed by FIELD, not by path: special-casing `reports/**\/null-control-*.json` would have made
 * this census pass on exactly the tree it was written against and nowhere else.
 */
export function isMeasurement(j) {
  if (!j || typeof j !== 'object') return false;
  if (j.null_control) return false;
  if (j.ran === false) return false;
  return true;
}

// --------------------------------------------------------------------------------------------

function walk(dir, out = [], skip = /node_modules|\.git$/) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (skip.test(p)) continue;
    if (e.isDirectory()) walk(p, out, skip);
    else out.push(p);
  }
  return out;
}

// `arg('out', 'reports/…')`, `arg("out", "reports/…")`, and the `const OUT = arg('out', '…')` form.
const DEFAULT_OUT = /arg\(\s*['"]out['"]\s*,\s*(['"`])([^'"`\n]+)\1/g;
const NULL_OUT = /arg\(\s*['"]out['"]\s*,\s*null\s*\)/;

function findPopulation(tree) {
  const withDefault = [];
  const withoutDefault = [];
  for (const file of walk(path.join(tree, 'tools'))) {
    if (!file.endsWith('.mjs')) continue;
    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (src.includes('\u0000')) continue; // a couple of tools under tools/ are binary; skip rather than scan
    const rel = path.relative(tree, file);
    const seen = new Set();
    for (const m of src.matchAll(DEFAULT_OUT)) {
      // A default that is itself a template with a substitution is not one canonical path.
      if (m[2].includes('${')) continue;
      if (seen.has(m[2])) continue;
      seen.add(m[2]);
      withDefault.push({ tool: rel, out: m[2] });
    }
    if (!seen.size && NULL_OUT.test(src)) withoutDefault.push(rel);
  }
  return { withDefault, withoutDefault };
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function stampOf(j, p) {
  const at = j && (j.at || j.generated_at || j.generatedAt || j.when || j.timestamp);
  const t = at ? Date.parse(at) : NaN;
  if (Number.isFinite(t)) return t;
  try { return fs.statSync(p).mtimeMs; } catch { return null; }
}

function lastAuthoredCommit(tree, rel) {
  try {
    const out = execFileSync('git', ['log', '--invert-grep', '--grep=Orchestrator-Bank', '-1', '--format=%ct', '--', rel], { cwd: tree, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return out ? Number(out) * 1000 : null;
  } catch { return null; }
}

function trackedSet(tree) {
  try {
    return new Set(execFileSync('git', ['ls-files', 'reports'], { cwd: tree, stdio: ['ignore', 'pipe', 'ignore'] }).toString().split('\n').filter(Boolean));
  } catch { return new Set(); }
}

// Every JSON under reports/, indexed by `schema`, so a canonical path can be compared against the
// side artifacts that the same tool wrote somewhere else. Big files are skipped: a 79 MiB trace is
// never a roll-up and parsing them all would cost more than the census is worth.
function indexSchemas(tree) {
  const bySchema = new Map();
  for (const p of walk(path.join(tree, 'reports'))) {
    if (!p.endsWith('.json')) continue;
    let st; try { st = fs.statSync(p); } catch { continue; }
    if (st.size > 8 * 1024 * 1024) continue;
    const j = readJson(p);
    if (!j || !j.schema) continue;
    if (!isMeasurement(j)) continue;
    const rel = path.relative(tree, p);
    if (!bySchema.has(j.schema)) bySchema.set(j.schema, []);
    bySchema.get(j.schema).push({ path: rel, at: stampOf(j, p) });
  }
  return bySchema;
}

function inputsReferenced(j, tree) {
  const s = JSON.stringify(j || {});
  const hits = [...new Set(s.match(/reports\/[A-Za-z0-9_\-./]+\.(jsonl|json|md|png)/g) || [])];
  return hits.slice(0, 6).map((rel) => {
    try { const st = fs.statSync(path.join(tree, rel)); return { path: rel, mtime: st.mtime.toISOString(), mib: +(st.size / 1048576).toFixed(1) }; }
    catch { return { path: rel, mtime: null, mib: null }; }
  });
}

function census(tree) {
  const { withDefault, withoutDefault } = findPopulation(tree);
  const bySchema = indexSchemas(tree);
  const tracked = trackedSet(tree);
  const rows = [];
  for (const { tool, out } of withDefault) {
    const abs = path.join(tree, out);
    const exists = fs.existsSync(abs) && fs.statSync(abs).isFile();
    const j = exists && out.endsWith('.json') ? readJson(abs) : null;
    const artifactAt = exists ? stampOf(j, abs) : null;
    const schema = j && j.schema ? j.schema : null;
    const siblings = schema ? (bySchema.get(schema) || []).filter((s) => s.path !== out && s.at != null) : [];
    const row = {
      tool, out, exists,
      tracked: tracked.has(out),
      ran: j && typeof j.ran === 'boolean' ? j.ran : null,
      schema,
      artifact_at: artifactAt ? new Date(artifactAt).toISOString() : null,
      tool_last_commit: null,
      artifactAt, toolCommitAt: lastAuthoredCommit(tree, tool), siblings,
      inputs_referenced: exists ? inputsReferenced(j, tree) : [],
    };
    row.tool_last_commit = row.toolCommitAt ? new Date(row.toolCommitAt).toISOString() : null;
    Object.assign(row, assess(row));
    delete row.artifactAt; delete row.toolCommitAt; delete row.siblings;
    rows.push(row);
  }
  return { rows, withoutDefault };
}

// --------------------------------------------------------------------------------------------

function selfTest() {
  say('SELF-TEST — assess() against a fixture whose right answers are known. No git, no disk.');
  const now = Date.parse('2026-08-14T10:00:00Z');
  const day = 86400000;
  const cases = [
    // THE NEGATIVE ARM IS A PLAUSIBLE HEALTHY TREE, NOT AN EMPTY ONE. Real schema, real siblings
    // that are OLDER (which is the normal case — a side artifact from last week), a tool commit
    // that genuinely predates the artifact. An empty row would go FRESH by accident.
    { want: VERDICT.FRESH, row: { tool: 'tools/a.mjs', out: 'reports/a.json', exists: true, ran: true, schema: 's/a@1', artifactAt: now, toolCommitAt: now - 2 * day, siblings: [{ path: 'reports/side/a.json', at: now - 3 * day }] } },
    // And a second healthy shape: no schema at all, so no sibling comparison is possible, but the
    // tool has not moved. Must still be FRESH rather than defaulting to a failure.
    { want: VERDICT.FRESH, row: { tool: 'tools/b.mjs', out: 'reports/b.json', exists: true, ran: null, schema: null, artifactAt: now, toolCommitAt: now - day, siblings: [] } },
    { want: VERDICT.REFUSAL, row: { tool: 'tools/c.mjs', out: 'reports/c.json', exists: true, ran: false, schema: 's/c@1', artifactAt: now, toolCommitAt: now - day, siblings: [] } },
    // A refusal outranks everything: it must not be masked by a fresh tool or a fresh timestamp.
    { want: VERDICT.REFUSAL, row: { tool: 'tools/c2.mjs', out: 'reports/c2.json', exists: true, ran: false, schema: 's/c@1', artifactAt: now, toolCommitAt: now - 9 * day, siblings: [{ path: 'reports/side/c2.json', at: now + day }] } },
    { want: VERDICT.BEHIND_SIDE, row: { tool: 'tools/d.mjs', out: 'reports/d.json', exists: true, ran: true, schema: 's/d@1', artifactAt: now - 6 * day, toolCommitAt: now - 9 * day, siblings: [{ path: 'reports/side/d.json', at: now - 3 * day }] } },
    { want: VERDICT.STALE_VS_TOOL, row: { tool: 'tools/e.mjs', out: 'reports/e.json', exists: true, ran: true, schema: 's/e@1', artifactAt: now - 6 * day, toolCommitAt: now - day, siblings: [] } },
    { want: VERDICT.ABSENT, row: { tool: 'tools/f.mjs', out: 'reports/f.json', exists: false, ran: null, schema: null, artifactAt: null, toolCommitAt: now, siblings: [] } },
    // THE BOUNDARY THAT MATTERS. A sibling that is OLDER than the canonical is the healthy case —
    // the canonical was re-run last. If this went BEHIND_SIDE the census would flag every tool
    // that had ever been run twice, and nobody would read it.
    { want: VERDICT.FRESH, row: { tool: 'tools/g.mjs', out: 'reports/g.json', exists: true, ran: true, schema: 's/g@1', artifactAt: now, toolCommitAt: now - day, siblings: [{ path: 'reports/side/g.json', at: now - 1 } ] } },
  ];
  // isMeasurement() is the filter that decides which siblings may displace a canonical. It is
  // tested here because the census's own first live run was wrong without it.
  const measurementCases = [
    { want: true, what: 'an ordinary roll-up', j: { schema: 's/a@1', ran: true, roll_up: {} } },
    { want: true, what: 'a roll-up with no `ran` field at all', j: { schema: 's/a@1' } },
    { want: false, what: 'a null control', j: { schema: 's/a@1', ran: true, null_control: 'on' } },
    { want: false, what: 'a refusal record', j: { schema: 's/a@1', ran: false } },
    { want: false, what: 'not an object', j: null },
  ];
  let ok = true;
  for (const c of measurementCases) {
    const got = isMeasurement(c.j);
    const good = got === c.want;
    if (!good) ok = false;
    say(`  ${good ? 'ok  ' : 'FAIL'}  isMeasurement: ${c.what.padEnd(34)} ${got}${good ? '' : ` (wanted ${c.want})`}`);
  }
  for (const c of cases) {
    const got = assess(c.row).verdict;
    const good = got === c.want;
    if (!good) ok = false;
    say(`  ${good ? 'ok  ' : 'FAIL'}  ${c.row.out.padEnd(20)} got ${got}${good ? '' : ` (wanted ${c.want})`}`);
  }
  say(`SELF-TEST ${ok ? 'PASS' : 'FAIL'} — ${cases.length} fixtures.`);
  return ok;
}

// --------------------------------------------------------------------------------------------

function main() {
  if (has('self-test')) process.exit(selfTest() ? 0 : 5);
  const tree = path.resolve(arg('tree', REPO));
  const { rows, withoutDefault } = census(tree);
  const order = [VERDICT.REFUSAL, VERDICT.BEHIND_SIDE, VERDICT.STALE_VS_TOOL, VERDICT.ABSENT, VERDICT.FRESH];
  rows.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.out.localeCompare(b.out));
  say(`stale-canonical census over ${path.relative(process.cwd(), tree) || '.'}`);
  say(`POPULATION: ${rows.length} tool(s) declare a default output path; ${withoutDefault.length} more take --out with no default and cannot rot this way.`);
  say('');
  for (const r of rows) {
    const flags = [r.exists ? (r.tracked ? 'tracked' : 'untracked') : '', r.ran === false ? 'ran:false' : ''].filter(Boolean).join(' ');
    say(`  ${r.verdict.padEnd(14)} ${r.out}`);
    say(`  ${''.padEnd(14)}   ${r.tool}${flags ? `  [${flags}]` : ''}`);
    say(`  ${''.padEnd(14)}   artifact ${r.artifact_at || '(none)'} · tool last committed ${r.tool_last_commit || '(unknown)'}`);
    say(`  ${''.padEnd(14)}   ${r.why}`);
    for (const i of r.inputs_referenced) say(`  ${''.padEnd(14)}   reads ${i.path} ${i.mtime ? `(mtime ${i.mtime.slice(0, 16)}, ${i.mib} MiB)` : '(ABSENT)'}`);
    say('');
  }
  const counts = Object.fromEntries(order.map((v) => [v, rows.filter((r) => r.verdict === v).length]));
  say(`SUMMARY  ${order.map((v) => `${v} ${counts[v]}`).join(' · ')}`);
  const bad = rows.filter((r) => BAD.has(r.verdict));
  const jsonOut = arg('json', null);
  if (jsonOut) {
    // RESOLVED AGAINST THE CALLER, NOT --tree. It used to resolve against `tree`, so surveying
    // another checkout WROTE INTO that checkout — this tool's first run put its own output in the
    // shared tree that a dozen agents are working in. Auditing a tree must never modify it.
    const p = path.resolve(process.cwd(), jsonOut);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({
      schema: 'elder-souls/stale-canonical-census@1', at: new Date().toISOString(), tree,
      population: rows.length, no_default_path: withoutDefault, counts, rows,
    }, null, 2) + '\n');
    say(`wrote ${path.relative(process.cwd(), p)}`);
  }
  process.exit(bad.length ? 2 : 0);
}

if (process.argv[1] && process.argv[1].endsWith('stale-canonical-census.mjs')) main();
