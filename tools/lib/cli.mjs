// Shared CLI helpers for the Elder Souls measurement harness.
// Spec: corpus/80-methods/HARNESS.md
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TOOLS_DIR = path.resolve(HERE, '..');
export const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
export const GAME_DIR = path.join(REPO_ROOT, 'game');
export const DATA_DIR = path.join(GAME_DIR, 'data');
export const REPORTS_DIR = path.join(REPO_ROOT, 'reports');
export const RUNS_DIR = path.join(REPORTS_DIR, 'runs');

/** Trace schema version. Bump only via an amendment to HARNESS.md. */
export const TRACE_SCHEMA = 'elder-souls/trace@1';
/** Minimum window.__HARNESS.version this toolchain accepts. */
export const HARNESS_API_VERSION = 1;

/** Parse `--key value`, `--key=value`, `--flag`, and positional args. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { out._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

export function wantsHelp(args) {
  return args.help === true || args.h === true || args._.includes('help');
}

/** Print usage and exit 0. Every tool must support --help without touching the game. */
export function usage(text, code = 0) {
  process.stdout.write(text.trimStart() + '\n');
  process.exit(code);
}

/** Structured, greppable failure. Exit codes are part of the contract (HARNESS.md §9). */
export const EXIT = {
  OK: 0,
  USAGE: 2,
  MISSING_GAME: 10,     // the game / data is not present yet
  HARNESS_ABSENT: 11,   // page loaded but window.__HARNESS missing or wrong version
  HARNESS_ERROR: 12,    // harness call threw / page error
  MEASUREMENT_FAIL: 20, // ran fine, but the measured artifact is unusable
  INTERNAL: 70,
};

export function die(code, msg, extra) {
  const payload = { ok: false, error: msg, exit: code, ...(extra || {}) };
  process.stderr.write('[harness] ERROR: ' + msg + '\n');
  if (extra) process.stderr.write('[harness] ' + JSON.stringify(extra) + '\n');
  process.stderr.write(JSON.stringify(payload) + '\n');
  process.exit(code);
}

export function log(...a) { process.stderr.write('[harness] ' + a.join(' ') + '\n'); }

export function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }

export function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

/** Deterministic run id: <utc>-<scenario>-s<seed>-<rand6>. Recorded in every artifact. */
export function makeRunId(scenario, seed) {
  const rnd = crypto.randomBytes(3).toString('hex');
  return `${utcStamp()}-${String(scenario || 'run').replace(/[^\w.-]+/g, '_')}-s${seed}-${rnd}`;
}

export function gitInfo(cwd = REPO_ROOT) {
  const run = (args) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return null; }
  };
  return {
    commit: run(['rev-parse', 'HEAD']),
    branch: run(['rev-parse', '--abbrev-ref', 'HEAD']),
    dirty: (run(['status', '--porcelain']) || '').length > 0,
  };
}

/** Hash of the whole content data tree, so a critic can prove which content it measured. */
export function hashDataTree(dir = DATA_DIR) {
  if (!fs.existsSync(dir)) return null;
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(json|jsonl|ndjson|csv|md|txt)$/i.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  const h = crypto.createHash('sha256');
  for (const f of files) { h.update(path.relative(dir, f)); h.update(fs.readFileSync(f)); }
  return { files: files.length, sha256: h.digest('hex') };
}

export function readJson(p, fallback = undefined) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { if (fallback !== undefined) return fallback; throw e; }
}

export function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
  return p;
}

/** Read a JSONL file into records, skipping blank lines. Throws on malformed JSON with line no. */
export function readJsonl(p) {
  const txt = fs.readFileSync(p, 'utf8');
  const out = [];
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    try { out.push(JSON.parse(l)); }
    catch (e) { throw new Error(`${p}:${i + 1}: malformed JSONL — ${e.message}`); }
  }
  return out;
}

/** Small deterministic PRNG (mulberry32) — used by tooling that needs randomness (blind pairs). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- statistics helpers shared by trace-stats / image-metrics / content-stats ----
export function mean(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0; }
export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}
export function quantile(a, q) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
}
export function summarise(a) {
  return a.length ? {
    n: a.length, min: Math.min(...a), max: Math.max(...a),
    mean: +mean(a).toFixed(4), stdev: +stdev(a).toFixed(4),
    p05: +quantile(a, 0.05).toFixed(4), p50: +quantile(a, 0.5).toFixed(4),
    p95: +quantile(a, 0.95).toFixed(4),
  } : { n: 0 };
}
export function entropyOf(counts) {
  const total = Object.values(counts).reduce((s, x) => s + x, 0);
  if (!total) return 0;
  let h = 0;
  for (const c of Object.values(counts)) { if (c > 0) { const p = c / total; h -= p * Math.log2(p); } }
  return h;
}
