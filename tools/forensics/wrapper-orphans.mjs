#!/usr/bin/env node
// wrapper-orphans.mjs — AQ-W1-20-B, answered and kept answerable.
//
// THE QUESTION. `game/src/harness/api.js` is a thin forwarding layer: hundreds of
// one-line wrappers of the form `foo(x) { return engine.foo(x); }`. When a merge
// reverts the ENGINE method and keeps the WRAPPER, the harness still loads, still
// enumerates, still answers every structural question asked of it — and throws
// only when that one verb is actually called. `node tools/boot-check.mjs` says
// PASS. `check-data`, `check-content`, `check-quests` say PASS. Nothing goes red.
// That is the shape that makes a partial revert invisible to every existing gate,
// and it is why W1-20's registry model scored 0 for four days while its own
// delivery report named a consumer that no longer existed.
//
// THE ANSWER, measured on this branch 2026-08-14: it has happened repeatedly.
//   * `factionAccess` — orphaned across 43 consecutive commits, 2026-08-10
//     (`091a6cec`) to 2026-08-14. Four days. The `RECOVERY-20260814` pass itself
//     ran inside that window and could not see it.
//   * `e0b03132` (2026-08-11, "Merge current Wave-1 builder flight") orphaned
//     150 wrappers AT ONCE — the entire harness surface pointing at an engine cut
//     down to a stub. That is the damage `669ae9b7` ("Restore executable engine
//     after Wave 1 merge", +11,583 lines) was repairing.
//   * `setLoadout` ×3 commits, `consumeBossOutcome` ×2, `equipItem` ×2.
//   * 150 distinct symbols have been orphaned at some point in this history.
//
// THE CHEAP DETECTOR IS NOT GIT. It is booting the game: the defect surfaced as
// `TypeError: engine.factionAccess is not a function`. This tool is the static
// pre-filter that says WHICH verb to go and call, for a hundredth of the cost of
// a browser.
//
// ---------------------------------------------------------------------------
// TWO CONTROLS, and the null one is the plausible wrong answer.
//
//   POSITIVE — `091a6cec`, the proven instance. If the instrument does not fire
//     there it is vacuous, and this tool exits non-zero saying so rather than
//     reporting a clean sweep. A detector that cannot fail is HAZARDS rule 6's
//     first shape.
//
//   NULL — `9ed28905`, the commit IMMEDIATELY BEFORE the revert, where the same
//     wrapper and the same engine method are both present. This is deliberately
//     not the trivial control ("a symbol that obviously exists"): the plausible
//     wrong answer for a static reader is to key on "a wrapper exists" or on the
//     wrapper's own name shadowing the engine's, both of which fire here. It
//     must stay silent.
//
// KNOWN LIMIT, stated rather than discovered later: this is a static reader, so a
// wrapper reaching a member installed at construction, on a sub-object, or via
// the prototype could read as unresolved. The declared set therefore takes
// `method(){}`, `get x`, `this.x =` and `Engine.prototype.x =`. Anything this
// flags is a CANDIDATE; the decisive test is calling the verb on a live engine.
// At HEAD today the static pass returns zero candidates, so there is nothing to
// take to a browser — which is the correct current answer, not a claim that the
// shape cannot recur.
//
// USAGE
//   node tools/forensics/wrapper-orphans.mjs              # HEAD
//   node tools/forensics/wrapper-orphans.mjs --self-test  # the two controls
//   node tools/forensics/wrapper-orphans.mjs --history    # every commit that
//                                                         # touched either file

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ARGV = process.argv.slice(2);
const git = (a) => { try { return execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return e.stdout != null ? String(e.stdout) : ''; } };

const API = 'game/src/harness/api.js';
const ENG = 'game/src/engine.js';

export function audit(rev) {
  const api = git(['show', `${rev}:${API}`]);
  const eng = git(['show', `${rev}:${ENG}`]);
  if (!api || !eng) return null;

  const called = new Map();
  api.split('\n').forEach((l, i) => {
    for (const m of l.matchAll(/\bengine\.([A-Za-z_$][\w$]*)\s*\(/g)) if (!called.has(m[1])) called.set(m[1], i + 1);
  });

  const declared = new Set();
  for (const m of eng.matchAll(/^\s{2}(?:async\s+|\*\s*)?([A-Za-z_$][\w$]*)\s*\(/gm)) declared.add(m[1]);
  for (const m of eng.matchAll(/^\s{2}get\s+([A-Za-z_$][\w$]*)/gm)) declared.add(m[1]);
  for (const m of eng.matchAll(/\bthis\.([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1]);
  for (const m of eng.matchAll(/\bEngine\.prototype\.([A-Za-z_$][\w$]*)\s*=/g)) declared.add(m[1]);

  const unresolved = [...called].filter(([n]) => !declared.has(n)).map(([symbol, api_line]) => ({ symbol, api_line }));
  return { rev: rev.slice(0, 8), wrappers: called.size, engine_members: declared.size, unresolved };
}

function controls() {
  const pos = audit('091a6cec');
  const nul = audit('9ed28905');
  const posFired = !!pos && pos.unresolved.some((u) => u.symbol === 'factionAccess');
  const nulSilent = !!nul && nul.unresolved.length === 0;
  return { pos, nul, posFired, nulSilent, valid: posFired && nulSilent };
}

if (ARGV.includes('--self-test')) {
  const c = controls();
  console.log(`  ${c.posFired ? 'PASS' : 'FAIL'}  positive control 091a6cec fires on factionAccess  (unresolved=${c.pos ? c.pos.unresolved.length : 'n/a'})`);
  console.log(`  ${c.nulSilent ? 'PASS' : 'FAIL'}  null control 9ed28905 — same wrapper, method present — stays silent  (unresolved=${c.nul ? c.nul.unresolved.length : 'n/a'})`);
  console.log(c.valid ? 'wrapper-orphans --self-test: 2/2 arms pass.' : 'wrapper-orphans --self-test: FAILED — instrument is vacuous.');
  process.exit(c.valid ? 0 : 1);
}

const c = controls();
if (!c.valid) { console.error('wrapper-orphans: controls did not behave — refusing to report a sweep. Run --self-test.'); process.exit(2); }

if (ARGV.includes('--history')) {
  const revs = git(['rev-list', 'HEAD', '--', API, ENG]).split('\n').filter(Boolean);
  const rows = [];
  const tally = new Map();
  for (const r of revs) {
    const a = audit(r);
    if (!a || !a.unresolved.length) continue;
    const [h, date, subject] = git(['log', '-1', '--pretty=%h%x00%ad%x00%s', '--date=short', r]).trim().split('\0');
    rows.push({ commit: h, date, subject, count: a.unresolved.length, symbols: a.unresolved.map((u) => u.symbol) });
    for (const u of a.unresolved) tally.set(u.symbol, (tally.get(u.symbol) || 0) + 1);
  }
  console.log(JSON.stringify({
    commits_swept: revs.length,
    commits_with_an_orphaned_wrapper: rows.length,
    distinct_symbols_ever_orphaned: tally.size,
    worst: rows.slice().sort((a, b) => b.count - a.count).slice(0, 5).map((r) => ({ commit: r.commit, date: r.date, count: r.count, subject: r.subject })),
    by_symbol: [...tally].sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 1),
    rows,
  }, null, 1));
  process.exit(0);
}

const now = audit(ARGV.find((a) => !a.startsWith('--')) || 'HEAD');
console.log(JSON.stringify(now, null, 1));
process.exit(now && now.unresolved.length ? 1 : 0);
