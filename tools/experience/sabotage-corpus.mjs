#!/usr/bin/env node
// sabotage-corpus.mjs — KEEP THE REPLAY CORPUS, BECAUSE HISTORY THAT IS NOT TRACKED IS NOT HISTORY.
//
// `tools/experience/sabotage.mjs --cases` replays nine artifacts that other agents wrote, and
// that replay is the only reason the facility is evidence rather than assertion: every number in
// it is corroborated by a TRACKED verdict written by somebody else (252/342 in
// `corpus/90-verdicts/wave1/W1-SOULS-r3.json`, 67 -> 0 in `W1-04-r3.md`, the empty `roster_n` in
// `W1-13-r4.md`).
//
// All nine were excluded by `reports/.gitignore`'s `*`. On a fresh clone `--cases` reported
// ABSENT and exited 8 — honest, and useless (W1-25-r1 §C).
//
// THE GITIGNORE'S OWN REASONING IS THAT RUN ARTIFACTS ARE "reproducible by re-running the tool
// that made them". That is FALSE for exactly these files, and the file already carries the
// exemption and the argument for it (`!**/*baseline*.json`, added by the W1-MASS builder because
// "a baseline exists to be yesterday's, so regenerating it destroys the only thing it was for").
// These are baselines by that definition and stronger:
//
//   * `reports/w1-04-r3-collision.json` §0_goes_red is the PRE-FIX `__w1_04_townSolids`. The fix
//     landed. That verb does not exist at HEAD and cannot be re-run.
//   * the four `critic-souls-r3-DELETED-*.json` are four browser runs with guards deleted from
//     `sim/souls.js` and `engine.js`. Both guards are present at HEAD.
//   * `dials-break-nocast.json` is W1-14-r3's control arm, which a human critic then ruled inert.
//
// So: a TRACKED TWIN, following the precedent `critic-w1-25.mjs` set for its own evidence (its
// JSON is gitignored and it shipped `reports/experience/critic-w1-25.md` beside it). The twins
// are byte-for-byte copies under `reports/experience/sabotage-corpus/sabotage-case-*.json`,
// matched by a `!**/sabotage-case-*.json` line in `reports/.gitignore`. 392 KB for nine files —
// the r1 verdict estimated "under 100 KB" and that was low; the real figure is recorded here
// rather than rounded down.
//
// A COPY THAT NOBODY CHECKS IS A SECOND WAY TO BE WRONG. So the twin carries a SHA-256 manifest
// and `--verify` fails on three separate things: a twin that is missing, a twin whose bytes no
// longer match its own manifest hash, and a twin that has drifted from an origin still present
// on this container. The third is the one that matters — it is the only way to notice that
// somebody regenerated an origin artifact and the corpus is now replaying yesterday's file
// against today's claim.
//
//   node tools/experience/sabotage-corpus.mjs            verify (default). exit 8 = a twin is absent
//   node tools/experience/sabotage-corpus.mjs --sync     copy origins -> twins, rewrite manifest
//   node tools/experience/sabotage-corpus.mjs --self-test  RULES #4: corrupt a twin on a scratch
//                                                        copy and require the verifier to go red
//
// EXIT: 0 verified · 1 drift or a corrupt twin · 8 a twin is absent · 9 usage.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..', '..');
export const CORPUS_DIR = 'reports/experience/sabotage-corpus';
export const MANIFEST = `${CORPUS_DIR}/sabotage-case-manifest.json`;

/**
 * The nine. `origin` is where the agent that produced it wrote it; `twin` is the tracked copy
 * `sabotage-cases.mjs` prefers. Never edit a twin by hand — `--sync` writes them.
 */
export const CORPUS = [
  { origin: 'reports/w1-04-r3-collision.json', case: 'w1-04 collision',
    why: '§0_goes_red is the pre-fix __w1_04_townSolids, re-created in the page at e37d327. The fix landed; the verb does not exist at HEAD.' },
  { origin: 'reports/critic-souls-r3-INTACT.json', case: 'w1-souls guards',
    why: 'the intact cell of the 2x2 over {identity, boundary}.' },
  { origin: 'reports/critic-souls-r3-DELETED-identity.json', case: 'w1-souls guards',
    why: 'a browser run with the `_alive` identity guard deleted from game/src/sim/souls.js. Present at HEAD.' },
  { origin: 'reports/critic-souls-r3-DELETED-boundary.json', case: 'w1-souls guards',
    why: 'a browser run with the souls.reset() boundary call deleted from game/src/engine.js. Present at HEAD.' },
  { origin: 'reports/critic-souls-r3-DELETED-identity-boundary.json', case: 'w1-souls guards',
    why: 'both guards deleted — the only cell that pays 0, and the one that makes the pair MASKED rather than two inert halves.' },
  { origin: 'reports/runs/W1-13-R4/clock-consequences.json', case: 'w1-13 empty control',
    why: 'checks.a_method_8: npcs_moved 25 vs control 0, with roster_n 0 in the control arm. Under reports/runs/, which the gitignore excludes twice over.' },
  { origin: 'reports/journeys/w1-13-r4-jrn06/journey.json', case: 'w1-13 empty control',
    why: 'the same clause rolled up, with roster {} in EVERY arm.' },
  { origin: 'reports/w1-14-r3/dials.json', case: 'w1-14 nocast',
    why: 'the intact arm of W1-14-r3\'s magnitude-dial census: 55 effects active, 33 magnitude_coupled.' },
  { origin: 'reports/w1-14-r3/dials-break-nocast.json', case: 'w1-14 nocast',
    why: 'the control arm a human critic ruled inert: 55 NOT_DELIVERED, active 0, coupled 0. The teardown exits before readDial().' },
];

const twinFor = (origin) => `${CORPUS_DIR}/sabotage-case-${path.basename(origin, '.json')}.json`;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const abs = (rel) => path.join(REPO, rel);

/** The tracked path a case should read, or null if neither twin nor origin is on disk. */
export function resolveCase(origin) {
  const t = twinFor(origin);
  if (fs.existsSync(abs(t))) return { path: t, tracked: true };
  if (fs.existsSync(abs(origin))) return { path: origin, tracked: false };
  return null;
}

export function readManifest() {
  const p = abs(MANIFEST);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

/**
 * Verify the corpus. Returns rows and a summary; the CLI turns that into an exit code.
 * `root` exists so `--self-test` can point the whole check at a scratch copy of the tree.
 */
export function verifyCorpus({ root = REPO } = {}) {
  const A = (rel) => path.join(root, rel);
  const man = (() => { try { return JSON.parse(fs.readFileSync(A(MANIFEST), 'utf8')); } catch { return null; } })();
  const byTwin = new Map((man && man.files || []).map((f) => [f.twin, f]));
  const rows = [];
  for (const e of CORPUS) {
    const twin = twinFor(e.origin);
    const row = { case: e.case, origin: e.origin, twin, why: e.why, state: null, detail: null };
    if (!fs.existsSync(A(twin))) {
      row.state = 'ABSENT';
      row.detail = 'the tracked twin is not on the tree — run --sync, or the corpus is lost';
    } else {
      const tb = fs.readFileSync(A(twin));
      row.bytes = tb.length;
      row.sha256 = sha(tb);
      const rec = byTwin.get(twin);
      if (!rec) { row.state = 'UNMANIFESTED'; row.detail = 'the twin exists and the manifest does not list it'; }
      else if (rec.sha256 !== row.sha256) { row.state = 'CORRUPT'; row.detail = `twin bytes do not match the manifest hash (${rec.sha256.slice(0, 12)} expected, ${row.sha256.slice(0, 12)} found)`; }
      else if (fs.existsSync(A(e.origin))) {
        const ob = fs.readFileSync(A(e.origin));
        if (sha(ob) !== row.sha256) { row.state = 'DRIFTED'; row.detail = 'the origin artifact still exists on this container and no longer matches the twin — somebody regenerated it, and the corpus is now replaying a different file from the one the claim was made against'; }
        else row.state = 'OK';
      } else { row.state = 'OK-ORPHAN'; row.detail = 'origin gone from this container; the twin is the only copy, which is the whole point'; }
    }
    rows.push(row);
  }
  const absent = rows.filter((r) => r.state === 'ABSENT');
  const bad = rows.filter((r) => r.state === 'CORRUPT' || r.state === 'DRIFTED' || r.state === 'UNMANIFESTED');
  return { rows, absent, bad, ok: absent.length === 0 && bad.length === 0, manifest: man };
}

function sync() {
  fs.mkdirSync(abs(CORPUS_DIR), { recursive: true });
  const files = [], missing = [];
  for (const e of CORPUS) {
    if (!fs.existsSync(abs(e.origin))) { missing.push(e.origin); continue; }
    const buf = fs.readFileSync(abs(e.origin));
    const twin = twinFor(e.origin);
    fs.writeFileSync(abs(twin), buf);
    files.push({ case: e.case, origin: e.origin, twin, bytes: buf.length, sha256: sha(buf), why: e.why });
  }
  const man = {
    schema: 'sabotage-corpus/1',
    what: 'Byte-for-byte tracked twins of the nine artifacts tools/experience/sabotage.mjs --cases replays. ' +
      'The originals are excluded by reports/.gitignore and several cannot be regenerated at all: the pre-fix ' +
      '__w1_04_townSolids verb and the two deleted souls guards do not exist at HEAD.',
    synced_at: new Date().toISOString(),
    total_bytes: files.reduce((s, f) => s + f.bytes, 0),
    missing_origins: missing,
    files,
  };
  fs.writeFileSync(abs(MANIFEST), JSON.stringify(man, null, 2) + '\n');
  return man;
}

/**
 * RULES #4 applied to this tool. A verifier that has never been watched fail is a second copy of
 * the assertion. Three teardowns on a scratch copy of the corpus, each of which MUST go red:
 * flip a byte in a twin, delete a twin, and edit an origin so it no longer matches.
 */
function selfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sabotage-corpus-'));
  const put = (rel, buf) => { fs.mkdirSync(path.join(tmp, path.dirname(rel)), { recursive: true }); fs.writeFileSync(path.join(tmp, rel), buf); };
  const seed = () => {
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const e of CORPUS) {
      const t = twinFor(e.origin);
      if (fs.existsSync(abs(t))) put(t, fs.readFileSync(abs(t)));
      if (fs.existsSync(abs(e.origin))) put(e.origin, fs.readFileSync(abs(e.origin)));
    }
    if (fs.existsSync(abs(MANIFEST))) put(MANIFEST, fs.readFileSync(abs(MANIFEST)));
  };
  const rows = [];
  const trial = (name, mutate, wantState) => {
    seed();
    mutate();
    const v = verifyCorpus({ root: tmp });
    const hit = v.rows.some((r) => r.state === wantState);
    rows.push({ trial: name, want: wantState, red: !v.ok && hit, states: [...new Set(v.rows.map((r) => r.state))] });
  };
  const first = twinFor(CORPUS[0].origin);
  trial('clean corpus verifies', () => {}, 'OK');
  rows[0].red = (() => { seed(); return verifyCorpus({ root: tmp }).ok; })();   // this one must be GREEN
  trial('a twin has a byte flipped', () => {
    const p = path.join(tmp, first);
    const b = fs.readFileSync(p); b[b.length - 2] ^= 0x01; fs.writeFileSync(p, b);
  }, 'CORRUPT');
  trial('a twin is deleted', () => fs.rmSync(path.join(tmp, first)), 'ABSENT');
  trial('an origin was regenerated and no longer matches its twin', () => {
    const p = path.join(tmp, CORPUS[0].origin);
    fs.writeFileSync(p, fs.readFileSync(p).toString() + '\n');
  }, 'DRIFTED');
  fs.rmSync(tmp, { recursive: true, force: true });
  return rows;
}

// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const has = (k) => argv.includes(`--${k}`);
const say = (s) => process.stdout.write(s + '\n');

if (import.meta.url === `file://${process.argv[1]}`) {
  if (has('help')) { say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n')); process.exit(0); }

  if (has('self-test')) {
    const rows = selfTest();
    say('SELF-TEST — the verifier must go red on each of three corruptions, and green on none of them.\n');
    let bad = 0;
    for (const r of rows) {
      const ok = r.red;
      if (!ok) bad++;
      say(`  ${ok ? 'ok  ' : 'FAIL'}  ${r.trial.padEnd(52)} states=${r.states.join(',')}` +
        (ok ? '' : `   <-- STILL GREEN: this check does no work`));
    }
    say(`\nSELF-TEST ${bad ? 'FAIL' : 'PASS'} — ${rows.length - bad}/${rows.length}.`);
    process.exit(bad ? 1 : 0);
  }

  if (has('sync')) {
    const man = sync();
    say(`synced ${man.files.length}/${CORPUS.length} artifacts into ${CORPUS_DIR} (${(man.total_bytes / 1024).toFixed(0)} KB)`);
    for (const f of man.files) say(`  ${String(f.bytes).padStart(7)}  ${f.sha256.slice(0, 12)}  ${f.twin}`);
    for (const m of man.missing_origins) say(`  MISSING ORIGIN  ${m} — not on this container, twin not refreshed`);
    say(`wrote ${MANIFEST}`);
    process.exit(man.files.length === CORPUS.length ? 0 : 1);
  }

  const v = verifyCorpus();
  say('SABOTAGE REPLAY CORPUS — nine artifacts the --cases replay depends on.\n');
  for (const r of v.rows) {
    say(`  ${r.state.padEnd(13)} ${r.twin}`);
    if (r.detail) say(`                ${r.detail}`);
  }
  const kb = v.rows.filter((r) => r.bytes).reduce((s, r) => s + r.bytes, 0) / 1024;
  say(`\n${v.ok ? 'OK' : 'FAIL'} — ${v.rows.length - v.absent.length - v.bad.length}/${v.rows.length} twins verified, ${kb.toFixed(0)} KB tracked.`);
  if (v.absent.length) { say(`${v.absent.length} twin(s) absent. Run --sync on a container that still has the originals; there is no other way back.`); process.exit(8); }
  process.exit(v.bad.length ? 1 : 0);
}
