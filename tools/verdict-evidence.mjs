#!/usr/bin/env node
/**
 * verdict-evidence.mjs — A CITATION THAT DOES NOT RESOLVE IN A FRESH CLONE IS NOT A CITATION.
 *
 * `reports/.gitignore` makes everything under `reports/` disposable, on the reasoning that run
 * artifacts are "reproducible by re-running the tool that made them". `verdict-validate.mjs`
 * requires every path a verdict cites to exist, on the reasoning (CRITIC-DOCTRINE §1.2) that a
 * verdict with no artifacts is VOID. Both rules are right and they were never reconciled, so for
 * eight days 74% of Wave-1 verdicts failed a real fresh-checkout validation while passing on the
 * one machine that had produced their evidence. That is exactly the thing `CLAUDE.md`'s "nothing
 * counts because someone says so" forbids: a score whose evidence only exists where it was made.
 *
 * THIS TOOL IS THE RECONCILIATION, and it is deliberately not "commit everything".
 *
 *   ≤ PIN_THRESHOLD  the raw file is committed, force-added past the ignore rule. A reader opens
 *                    it and checks the claim.
 *   >  PIN_THRESHOLD  a PIN is committed instead: the decisive numbers a reader needs, a SHA-256
 *                    of the raw bytes, and the exact command that regenerates it. The pin is what
 *                    travels; the raw file stays disposable.
 *
 * WHY 1 MiB AND NOT A ROUND NUMBER SOMEBODY LIKED. Measured over the 208 cited-but-untracked
 * files that existed on the build container on 2026-08-14 (119.3 MiB total):
 *
 *     p50 11 KiB · p75 34 KiB · p90 112 KiB · p95 285 KiB · p99 3.2 MiB · max 79 MiB
 *
 * Sorted by size, the two largest multiplicative discontinuities in the whole sequence sit at
 * 0.97 MiB -> 3.15 MiB (x3.3) and 3.15 MiB -> 26.8 MiB (x8.5) — the largest gaps anywhere in the
 * distribution. A cut anywhere in that band separates *the same three files* (two raw frame
 * traces and one session trace, 108.9 MiB, 91.4% of all the bytes) from everything else
 * (205 cited paths, 10.4 MiB — every one of them small enough that a human can open it; 203 are
 * files force-added by name and 2 are directory citations that resolve through their contents).
 * 1 MiB is the round number that lands inside that measured gap, not one chosen before looking.
 * Committing the 205 costs ~1% of the tracked tree; committing the 3 would have tripled the
 * smallest useful clone for three files no human will ever read a line of.
 *
 * The pin is strictly MORE rigorous than committing the raw file would have been, which is the
 * argument for it: a committed 79 MiB trace can be silently regenerated and nothing notices,
 * whereas a pin carries the hash that makes drift visible (`--verify`). Same argument
 * `tools/experience/sabotage-corpus.mjs` already makes for its tracked twins.
 *
 * Usage
 *   node tools/verdict-evidence.mjs                 audit (default): what is cited and missing
 *   node tools/verdict-evidence.mjs --recover       git add -f the small ones, write pins for the big
 *   node tools/verdict-evidence.mjs --verify        every pin's shape, and its hash where the raw file is here
 *   node tools/verdict-evidence.mjs --self-test     RULES #4: corrupt a pin on a copy, require --verify to go red
 *
 * EXIT: 0 clean · 1 a pin is malformed or has drifted · 2 usage · 8 a cited file is LOST (audit only)
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');

/** Files strictly larger than this are pinned, not committed. See the header for the measurement. */
export const PIN_THRESHOLD = 1024 * 1024;
export const PIN_SUFFIX = '.pin.json';
/** Every field a pin must carry. A pin missing any of these is not a pin. */
export const PIN_REQUIRED = ['pin_version', 'path', 'bytes', 'sha256', 'produced_by', 'decisive', 'cited_by'];

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/**
 * This repository runs a dozen agents against one working tree, so `.git/index.lock` is contended
 * and a bare `git add` loses that race often enough to have already aborted this recovery once.
 * Retry with a short backoff rather than failing a 200-file recovery on somebody else's commit.
 */
export function gitRetry(args, { attempts = 12, waitMs = 1500 } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString(); }
    catch (e) {
      last = e;
      const msg = String((e.stderr || '') + (e.message || ''));
      if (!/index\.lock/.test(msg)) throw e;
      // busy-wait: Atomics.wait is the only synchronous sleep available without a dependency
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
    }
  }
  throw last;
}

export function trackedPaths() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  return new Set(out.split('\n').filter(Boolean));
}

/** Every path any Wave-N verdict cites, with the citing verdict and the command that made it. */
export function citations(verdictRoot = path.join(ROOT, 'corpus', '90-verdicts')) {
  const rows = [];
  if (!fs.existsSync(verdictRoot)) return rows;
  for (const wave of fs.readdirSync(verdictRoot)) {
    const wd = path.join(verdictRoot, wave);
    if (!fs.statSync(wd).isDirectory()) continue;
    for (const f of fs.readdirSync(wd)) {
      if (!f.endsWith('.json') || f === 'COHERENCE.json') continue;
      let v;
      try { v = JSON.parse(fs.readFileSync(path.join(wd, f), 'utf8')); } catch { continue; }
      const verdict = rel(path.join(wd, f));
      for (const a of v.artifacts || []) {
        if (a && a.path) rows.push({ verdict, path: a.path, where: 'artifacts', produced_by: a.produced_by || null, note: a.note || null });
      }
      for (const r of v.reference_items || []) {
        if (r && r.path) rows.push({ verdict, path: r.path, where: 'reference_items', produced_by: null, note: r.role || null });
      }
    }
  }
  return rows;
}

export function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

/**
 * The decisive numbers for a trace. Generic on purpose: a pin that carried only a hash would let
 * a reader confirm the bytes and learn nothing, and the claims these traces carry are always
 * counts — W1-25-r1's whole finding is "36,000 frames, zero events" against "8,945 frames, 530
 * events, 28 kinds". So: frames, events, and the kind histogram, computed from the file rather
 * than copied out of the verdict that is being checked.
 */
export function decisiveForJsonl(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').filter((l) => l.trim().length);
  let frames = 0, events = 0, meta = 0, unparseable = 0;
  const kinds = {};
  for (const l of lines) {
    let o;
    try { o = JSON.parse(l); } catch { unparseable++; continue; }
    if (o && o.t === 'META') { meta++; continue; }
    frames++;
    for (const e of (Array.isArray(o && o.events) ? o.events : [])) {
      events++;
      const k = (e && (e.type || e.kind)) || '(untyped)';
      kinds[k] = (kinds[k] || 0) + 1;
    }
  }
  return {
    lines: lines.length, meta_lines: meta, frames, events,
    event_kinds: Object.keys(kinds).length,
    events_by_kind: Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1])),
    unparseable_lines: unparseable,
  };
}

export function decisiveFor(file) {
  if (file.endsWith('.jsonl')) return decisiveForJsonl(file);
  const st = fs.statSync(file);
  return { bytes: st.size, note: 'no structured extractor for this file type — the hash and the regeneration command are the pin' };
}

export function writePin(relPath, { produced_by, cited_by, note }) {
  const abs = path.join(ROOT, relPath);
  const st = fs.statSync(abs);
  const pin = {
    pin_version: 1,
    path: relPath,
    bytes: st.size,
    sha256: sha256(abs),
    produced_by,
    regeneration_verified: null,
    decisive: decisiveFor(abs),
    cited_by,
    pinned_at: new Date().toISOString(),
    pinned_by: 'verdict-evidence-20260814',
    note: note || `Raw file exceeds the ${(PIN_THRESHOLD / 1048576).toFixed(0)} MiB pin threshold and is not tracked. `
      + 'This pin is its citation: the decisive numbers, the SHA-256 of the bytes they were read from, '
      + 'and the command that regenerates it. `node tools/verdict-evidence.mjs --verify` re-checks the '
      + 'hash on any machine that still holds the raw file.',
  };
  const dest = abs + PIN_SUFFIX;
  fs.writeFileSync(dest, JSON.stringify(pin, null, 1) + '\n');
  return rel(dest);
}

export function findPins() {
  const out = [];
  const walk = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(PIN_SUFFIX)) out.push(p);
    }
  };
  walk(path.join(ROOT, 'reports'));
  walk(path.join(ROOT, 'corpus'));
  return out;
}

/** Shape + drift. Returns a list of problems; empty means clean. */
export function verifyPin(absPin, { root = ROOT } = {}) {
  const problems = [];
  let pin;
  try { pin = JSON.parse(fs.readFileSync(absPin, 'utf8')); }
  catch (e) { return [`${rel(absPin)}: unparseable — ${e.message}`]; }
  for (const k of PIN_REQUIRED) {
    if (pin[k] === undefined || pin[k] === null || pin[k] === '') problems.push(`${rel(absPin)}: missing required pin field \`${k}\` — a pin without it does not stand in for anything`);
  }
  if (pin.pin_version !== 1) problems.push(`${rel(absPin)}: pin_version must be 1`);
  if (typeof pin.sha256 === 'string' && !/^[0-9a-f]{64}$/.test(pin.sha256)) problems.push(`${rel(absPin)}: sha256 is not a 64-hex digest`);
  if (pin.path && absPin !== path.join(root, pin.path + PIN_SUFFIX)) {
    problems.push(`${rel(absPin)}: pin.path "${pin.path}" does not match where the pin lives`);
  }
  // The check that matters: the raw file is still here and has drifted from what was pinned.
  if (pin.path) {
    const raw = path.join(root, pin.path);
    if (fs.existsSync(raw)) {
      const actual = sha256(raw);
      if (actual !== pin.sha256) {
        problems.push(`${rel(absPin)}: DRIFT — the raw file on this machine hashes ${actual.slice(0, 16)}… but the pin records ${String(pin.sha256).slice(0, 16)}…. Somebody regenerated the artifact and the verdict now cites numbers taken from a different file. Re-run the pin (\`--recover\`) only after confirming the verdict's claims still hold.`);
      }
      if (fs.statSync(raw).size !== pin.bytes) problems.push(`${rel(absPin)}: byte count differs from the pin`);
    }
  }
  return problems;
}

// ------------------------------------------------------------------ classification
export function classify() {
  const tracked = trackedPaths();
  const rows = citations();
  const byPath = new Map();
  for (const r of rows) {
    if (tracked.has(r.path)) continue;
    const abs = path.join(ROOT, r.path);
    let exists = false, size = 0, isDir = false;
    try { const st = fs.statSync(abs); exists = true; size = st.size; isDir = st.isDirectory(); } catch { }
    // A directory citation resolves once its contents are tracked; git cannot track a directory.
    if (isDir) {
      const any = [...tracked].some((t) => t.startsWith(r.path.replace(/\/?$/, '/')));
      if (any) continue;
    }
    const pinPath = r.path + PIN_SUFFIX;
    if (tracked.has(pinPath)) continue;
    const cur = byPath.get(r.path) || { path: r.path, exists, size, isDir, cited_by: [], produced_by: null };
    cur.cited_by.push(r.verdict);
    if (!cur.produced_by && r.produced_by) cur.produced_by = r.produced_by;
    byPath.set(r.path, cur);
  }
  const recover = [], pin = [], lost = [];
  for (const c of byPath.values()) {
    if (!c.exists) lost.push(c);
    else if (c.isDir) recover.push(c);
    else if (c.size > PIN_THRESHOLD) pin.push(c);
    else recover.push(c);
  }
  const bySize = (a, b) => b.size - a.size;
  return { recover: recover.sort(bySize), pin: pin.sort(bySize), lost: lost.sort((a, b) => a.path.localeCompare(b.path)) };
}

// ------------------------------------------------------------------ cli
const argv = process.argv.slice(2);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

function cmdAudit() {
  const { recover, pin, lost } = classify();
  const mb = (n) => (n / 1048576).toFixed(2) + ' MiB';
  const sum = (l) => l.reduce((a, b) => a + b.size, 0);
  console.log(`cited but not in \`git ls-files\`:  ${recover.length + pin.length + lost.length} paths`);
  console.log(`  RECOVER (<= ${(PIN_THRESHOLD / 1048576).toFixed(0)} MiB, on disk): ${recover.length} files, ${mb(sum(recover))}`);
  console.log(`  PIN     (>  ${(PIN_THRESHOLD / 1048576).toFixed(0)} MiB, on disk): ${pin.length} files, ${mb(sum(pin))}`);
  for (const p of pin) console.log(`      ${mb(p.size).padStart(10)}  ${p.path}   <- ${p.cited_by.join(' ')}`);
  console.log(`  LOST    (nowhere on this machine): ${lost.length}`);
  for (const l of lost) console.log(`      ${l.path}   <- ${l.cited_by.join(' ')}`);
  return lost.length ? 8 : 0;
}

function cmdRecover() {
  const { recover, pin } = classify();
  const add = [];
  for (const r of recover) add.push(r.path);
  // git add -f, in chunks, because an argv of 200 long paths is fine but 2,000 would not be.
  for (let i = 0; i < add.length; i += 100) {
    const chunk = add.slice(i, i + 100);
    if (chunk.length) gitRetry(['add', '-f', '--', ...chunk]);
  }
  console.log(`recovered ${add.length} cited file(s) into the index with \`git add -f\``);
  const pins = [];
  for (const p of pin) {
    const written = writePin(p.path, { produced_by: p.produced_by, cited_by: p.cited_by });
    pins.push(written);
    gitRetry(['add', '-f', '--', written]);
    console.log(`pinned ${p.path}  ->  ${written}`);
  }
  return 0;
}

function cmdVerify() {
  const pins = findPins();
  let problems = 0;
  for (const p of pins) {
    const probs = verifyPin(p);
    if (!probs.length) { console.log(`OK    ${rel(p)}`); continue; }
    problems += probs.length;
    console.log(`FAIL  ${rel(p)}`);
    for (const m of probs) console.log(`   ERROR  ${m}`);
  }
  console.log(`${pins.length} pin(s) checked, ${problems} problem(s)`);
  return problems ? 1 : 0;
}

/**
 * RULES #4 — a fix is not a fix until it has been deleted on a copy and the old number came back.
 * Here that means: build a pin on a scratch copy, confirm it verifies, then change one byte of the
 * raw file and require the verifier to go red. A verifier that cannot be made to fail is decoration.
 */
function cmdSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verdict-evidence-selftest-'));
  try {
    const rawRel = 'reports/selftest/trace.jsonl';
    const raw = path.join(tmp, rawRel);
    fs.mkdirSync(path.dirname(raw), { recursive: true });
    fs.writeFileSync(raw, [
      JSON.stringify({ t: 'META', schema: 'selftest/1' }),
      JSON.stringify({ f: 1, events: [] }),
      JSON.stringify({ f: 2, events: [{ type: 'hit' }, { type: 'parry' }] }),
      JSON.stringify({ f: 3, events: [{ type: 'hit' }] }),
    ].join('\n') + '\n');

    const d = decisiveForJsonl(raw);
    if (d.frames !== 3) throw new Error(`decisive.frames should count frame rows and skip META: got ${d.frames}`);
    if (d.events !== 3) throw new Error(`decisive.events wrong: got ${d.events}`);
    if (d.event_kinds !== 2) throw new Error(`decisive.event_kinds wrong: got ${d.event_kinds}`);

    const pinObj = {
      pin_version: 1, path: rawRel, bytes: fs.statSync(raw).size, sha256: sha256(raw),
      produced_by: 'selftest', decisive: d, cited_by: ['selftest.json'],
    };
    const pinAbs = raw + PIN_SUFFIX;
    fs.writeFileSync(pinAbs, JSON.stringify(pinObj, null, 1));
    let probs = verifyPin(pinAbs, { root: tmp });
    if (probs.length) throw new Error(`a correct pin was rejected: ${probs.join('; ')}`);

    // #4: break it on the copy and require the old red back.
    fs.appendFileSync(raw, JSON.stringify({ f: 4, events: [{ type: 'hit' }] }) + '\n');
    probs = verifyPin(pinAbs, { root: tmp });
    if (!probs.some((m) => /DRIFT/.test(m))) throw new Error('the raw file was changed under the pin and --verify stayed green — the hash check is decoration');

    // a pin missing a required field must be rejected, or a stub could stand in for evidence
    const stub = { ...pinObj }; delete stub.decisive;
    fs.writeFileSync(pinAbs, JSON.stringify(stub, null, 1));
    probs = verifyPin(pinAbs, { root: tmp });
    if (!probs.some((m) => /decisive/.test(m))) throw new Error('a pin with no decisive numbers was accepted — that is a hash with no claim attached');

    console.log('verdict-evidence self-test: decisive extraction correct; drift detected; stub pin rejected.');
    return 0;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (isMain) {
  let code = 0;
  if (argv.includes('--self-test')) code = cmdSelfTest();
  else if (argv.includes('--recover')) code = cmdRecover();
  else if (argv.includes('--verify')) code = cmdVerify();
  else if (argv.length === 0 || argv.includes('--audit')) code = cmdAudit();
  else { console.error('usage: node tools/verdict-evidence.mjs [--audit|--recover|--verify|--self-test]'); code = 2; }
  process.exit(code);
}
