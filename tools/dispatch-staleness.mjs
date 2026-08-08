#!/usr/bin/env node
// dispatch-staleness.mjs — re-run the MECHANICALLY CHECKABLE claims in a dispatch file and
// report which ones no longer hold.
//
// =============================================================================================
// WHY THIS EXISTS
//
// `orchestration/NEXT-DISPATCH.md` carried a bullet reading "`gamepad-shim.mjs` — does not run,
// 3/3 crash". It was true when TOOL-COVERAGE-R1 wrote it. TOOL-COVERAGE-**R2** recorded the tool
// repaired; TOOL-COVERAGE-**R3** line 370 said "Accept, 12/12". The bullet stayed. A round was
// dispatched against it, and the agent's first action — running the self-test before touching
// anything — returned PASS 12/12. The bullet was stale by two rounds and it cost a whole dispatch.
//
// AUDIT-R1-LIST then checked the other four bullets of that same list. All four were dead too:
// one superseded by a rename nobody had propagated, three fixed one or two rounds earlier. Five
// of five. The cost of noticing was minutes; the cost of not noticing was rounds.
//
// So: make it cheap to notice. This tool re-runs the small subset of dispatch claims a machine
// can decide, and says which no longer hold.
//
// =============================================================================================
// WHAT IT CANNOT DO — READ THIS BEFORE YOU TRUST A GREEN RUN
//
// Most of a dispatch file is prose, judgement, design rulings, cross-piece reasoning and
// acceptance bars written in English. NONE of that is checkable by this tool and none of it ever
// will be. A tool that pretended otherwise would be worse than nothing, because a green run would
// read as "the dispatch is current" when it means "the ~5% of it I can decide is current".
//
// So the coverage fraction is computed from the file itself and PRINTED ON EVERY RUN, in the
// output, not in this comment. If you ever find this tool reporting 100% coverage, it is broken.
//
// =============================================================================================
// THE FOUR CLAIM KINDS IT DECIDES
//
//   K1  PATH        a file path named in the file that is not on disk. This is the one that
//                   catches a rename: `build-viability.mjs` was `git mv`d to
//                   `impossibility-screen.mjs` and the bullet naming it went on being dispatched.
//   K2  ABSENT      "<path> does not exist" — stale the moment somebody writes the file.
//   K3  BROKEN      a bullet naming a tool with a brokenness phrase ("does not run", "crash",
//                   "self-test fails"). Under --run, executes `<tool> --self-test`; a clean
//                   exit falsifies the claim. This is the gamepad shape exactly.
//   K4  SCORE       "self-test reports N/M" — under --run, compared against the number the
//                   tool's own self-test prints today.
//
// A bullet containing a `~~strikethrough~~` is SKIPPED and counted separately. A struck bullet is
// a resolved one; re-reporting it is how a checker teaches people to ignore it. This is also why
// the strike convention is worth keeping: it is machine-readable.
//
// =============================================================================================
// USAGE
//
//   node tools/dispatch-staleness.mjs              fast: K1+K2 only, no subprocesses, <1s
//   node tools/dispatch-staleness.mjs --run        also K3+K4: runs each named tool's self-test
//   node tools/dispatch-staleness.mjs --json       machine-readable
//   node tools/dispatch-staleness.mjs --quiet      one line when clean, full report when not
//                                                  (this is what .githooks/pre-commit runs)
//   node tools/dispatch-staleness.mjs --self-test  RULE 4: proves it calls a stale claim stale
//                                                  AND a live claim live, by feeding it both
//   --file PATH        dispatch file to check   (default orchestration/NEXT-DISPATCH.md)
//   --root DIR         tree to resolve paths against (default the repo root)
//   --timeout MS       per-self-test budget under --run (default 240000)
//
// EXIT  0 nothing stale · 2 stale claims found · 1 the tool itself could not run
// =============================================================================================

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ---------------------------------------------------------------------------------------------
// Vocabulary. Kept closed and short on purpose: a fuzzy matcher here produces false staleness
// reports, and a checker that cries wolf is ignored inside a day.
// ---------------------------------------------------------------------------------------------
const BROKEN_PHRASES = [
  'does not run', 'do not run', 'crash', 'crashes', 'cannot run', 'fails to run',
  'self-test fails', 'self test fails', 'does not execute', 'throws on startup',
];
const ABSENT_PHRASES = [
  'does not exist', 'do not exist', 'does not exist on disk', 'is absent', 'are absent',
  'no such file', 'was never written', 'never written',
];
// Extensions are ordered LONGEST FIRST and anchored with a negative lookahead. Written the
// obvious way (`js|…|json`) the alternation matched `present.js` inside `present.json` and the
// tool reported a file that exists as missing — caught by its own self-test before it ever ran
// on the real dispatch, which is the entire argument for rule 4.
const PATH_RE = /(?:^|[\s`(\[])((?:tools|game|corpus|orchestration|reports|docs)\/[A-Za-z0-9._\-/*]*\.(?:jsonl|json|html|mjs|cjs|js|py|md))(?![A-Za-z0-9])/g;
const BARE_TOOL_RE = /`([A-Za-z0-9._-]+\.(?:mjs|cjs|py))`/g;
const SCORE_RE = /self[- ]test[^.\n]{0,40}?(\d+)\s*\/\s*(\d+)/i;

// ---------------------------------------------------------------------------------------------
// Statement splitting. A "statement" is the unit a dispatcher acts on: one list bullet, or one
// prose paragraph. The coverage fraction is computed over these, so the denominator is something
// a reader can re-derive by eye rather than a number this tool invented.
// ---------------------------------------------------------------------------------------------
function statementsOf(text) {
  const lines = text.split('\n');
  const out = [];
  let fence = false;
  let cur = null;
  const flush = () => { if (cur && cur.text.trim()) out.push(cur); cur = null; };

  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*```/.test(ln)) { fence = !fence; flush(); continue; }
    if (fence) continue;
    if (/^\s*#{1,6}\s/.test(ln)) { flush(); continue; }          // headings carry no claims
    if (/^\s*\|/.test(ln)) { flush(); continue; }                 // table rows: out of scope
    if (!ln.trim()) { flush(); continue; }

    if (/^\s{0,3}[-*]\s/.test(ln)) {                              // a new bullet
      flush();
      cur = { kind: 'bullet', line: i + 1, text: ln };
    } else if (cur) {
      cur.text += '\n' + ln;                                      // continuation
    } else {
      cur = { kind: 'paragraph', line: i + 1, text: ln };
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tool resolution. A dispatch names tools two ways: by full path, and by bare basename
// (`gamepad-shim.mjs`). Both must resolve or the claim cannot be checked.
// ---------------------------------------------------------------------------------------------
function walkTools(root) {
  const found = new Map();                                        // basename -> [relpaths]
  // Scan EVERY directory a tool has ever been written into, not just `tools/`. The first version
  // scanned `tools/` and `corpus/80-methods` and duly reported `kritik3-motion-focused.mjs` as a
  // missing path — it is a critic's own probe, committed beside its verdict under
  // `corpus/90-verdicts/wave1/artifacts/W1-10-r3/`. A checker whose search is narrower than the
  // tree invents staleness, which is the failure it exists to prevent. `reports/` is excluded
  // deliberately: it holds ~700 MB of run artifacts and no source.
  const roots = ['tools', 'corpus', 'game', 'orchestration', 'docs'];
  const visit = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '__pycache__') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) visit(p);
      else if (/\.(mjs|cjs|py)$/.test(e.name)) {
        const rel = path.relative(root, p);
        if (!found.has(e.name)) found.set(e.name, []);
        found.get(e.name).push(rel);
      }
    }
  };
  for (const r of roots) visit(path.join(root, r));
  return found;
}

function runSelfTest(root, rel, timeout) {
  const r = spawnSync(process.execPath, [rel, '--self-test'], {
    cwd: root, timeout, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  // A tool's own last score line, in the shape every self-test in this project prints.
  let score = null;
  const m = [...out.matchAll(/(?:PASS|FAIL|pass|fail)\s*\((\d+)\s*\/\s*(\d+)\)/g)];
  if (m.length) score = { got: Number(m[m.length - 1][1]), of: Number(m[m.length - 1][2]) };
  return {
    exit: r.status, timedout: !!r.error && /ETIMEDOUT|timed out/i.test(String(r.error.message || r.error)),
    error: r.error ? String(r.error.message || r.error).split('\n')[0] : null,
    score, tail: out.trim().split('\n').slice(-3).join(' | ').slice(0, 400),
  };
}

// ---------------------------------------------------------------------------------------------
// The check itself.
// ---------------------------------------------------------------------------------------------
function check({ file, root, run, timeout }) {
  const text = fs.readFileSync(file, 'utf8');
  const stmts = statementsOf(text);
  const tools = walkTools(root);
  const claims = [];
  let struck = 0;
  let quoted = 0;

  for (const s of stmts) {
    if (s.text.includes('~~')) { struck++; continue; }            // resolved: do not re-report
    // A statement that REPORTS a stale claim necessarily restates it, so the checker flags the
    // report as if it were the claim. This bit me immediately: the audit note pointing at §2b's
    // dead "…main-quest-argument.json does not exist" was itself reported as a stale claim about
    // that path. The strike convention handles bullets; prose needs its own opt-out, so:
    //
    //     <!-- dispatch-staleness: quoted -->
    //
    // means "this statement quotes a claim, it does not make one". Deliberately ugly and
    // deliberately greppable — `grep -c 'dispatch-staleness: quoted'` is how you audit the
    // auditor, because this marker is also the obvious way to silence a claim you do not want
    // checked.
    if (/<!--\s*dispatch-staleness:\s*quoted\s*-->/.test(s.text)) { quoted++; continue; }
    const body = s.text;
    const lower = body.toLowerCase();

    // ---- resolve every path and bare tool name this statement mentions -----------------------
    const named = new Map();                                      // display -> {rel|null, why}
    for (const m of body.matchAll(PATH_RE)) {
      const p = m[1];
      if (p.includes('*')) continue;                              // a glob is not a claim
      named.set(p, { rel: fs.existsSync(path.join(root, p)) ? p : null, form: 'path' });
    }
    for (const m of body.matchAll(BARE_TOOL_RE)) {
      const base = m[1];
      if ([...named.keys()].some((k) => k.endsWith('/' + base))) continue;
      const hits = tools.get(base) || [];
      named.set(base, { rel: hits.length === 1 ? hits[0] : null, form: 'basename',
        ambiguous: hits.length > 1, candidates: hits });
    }

    // ---- which paths does this statement claim are MISSING? ----------------------------------
    // PROXIMITY, not statement scope. The first version asked only whether an absence phrase
    // appeared anywhere in the same bullet, and on the real dispatch that produced two false
    // positives out of three: "`…/arbiter-dlg-s37.json`. … `res` … is absent from the return
    // literal" is a claim about a FIELD, and the tool read it as a claim about the JSON file. A
    // staleness checker that cries wolf is ignored within a day, so the phrase must attach to the
    // path: it has to start within ABSENT_WINDOW characters of the path and with no other path
    // intervening. 40 is calibrated on the real file — the true positives read
    // "`<path>` **does not exist**" with the phrase 1-3 characters away, and the false positive
    // had 95 characters of unrelated prose in between.
    const ABSENT_WINDOW = 40;
    const absentPaths = new Set();
    for (const m of body.matchAll(PATH_RE)) {
      const end = m.index + m[0].length;
      let window = body.slice(end, end + ABSENT_WINDOW);
      const nextPath = window.search(/(?:tools|game|corpus|orchestration|reports|docs)\//);
      if (nextPath >= 0) window = window.slice(0, nextPath);
      const w = window.toLowerCase().replace(/[*`_]/g, '');
      if (ABSENT_PHRASES.some((p) => w.includes(p))) absentPaths.add(m[1]);
    }
    const claimsAbsence = absentPaths.size > 0;

    // ---- K1 PATH — a named path that is not on disk ------------------------------------------
    for (const [disp, info] of named) {
      if (info.rel) continue;
      if (info.ambiguous) continue;                               // ambiguity is not absence
      // A statement that SAYS the path is missing is K2's business. Without this the tool
      // reported "the dispatch names a path that is gone" against a bullet whose whole point was
      // that the path is gone — a self-fulfilling finding, and pure noise.
      if (absentPaths.has(disp)) continue;
      claims.push({
        kind: 'K1_PATH', line: s.line, subject: disp,
        claim: `this statement names \`${disp}\``,
        verdict: 'STALE',
        evidence: `\`${disp}\` does not resolve on disk. A dispatch that names a path the tree no `
          + 'longer has is a dispatch nobody can act on — check for a rename before assuming a sweep.',
      });
    }

    // ---- K2 ABSENT — "<path> does not exist" -------------------------------------------------
    if (claimsAbsence) {
      for (const [disp, info] of named) {
        if (info.form !== 'path' || !absentPaths.has(disp)) continue;
        claims.push(info.rel
          ? { kind: 'K2_ABSENT', line: s.line, subject: disp,
              claim: `\`${disp}\` does not exist`, verdict: 'STALE',
              evidence: `\`${disp}\` IS on disk now (${fs.statSync(path.join(root, disp)).size} bytes). `
                + 'Somebody wrote it and the dispatch was never updated.' }
          : { kind: 'K2_ABSENT', line: s.line, subject: disp,
              claim: `\`${disp}\` does not exist`, verdict: 'LIVE',
              evidence: `confirmed absent: \`test -e ${disp}\` fails.` });
      }
    }

    // ---- K3 BROKEN / K4 SCORE — needs a subprocess, so only under --run ----------------------
    const brokenPhrase = BROKEN_PHRASES.find((p) => lower.includes(p));
    const scoreM = body.match(SCORE_RE);
    if (!brokenPhrase && !scoreM) continue;

    for (const [disp, info] of named) {
      if (!info.rel || !/\.(mjs|cjs)$/.test(info.rel)) continue;
      if (!run) {
        if (brokenPhrase) claims.push({ kind: 'K3_BROKEN', line: s.line, subject: disp,
          claim: `\`${disp}\` ${brokenPhrase}`, verdict: 'NOT_RUN',
          evidence: 'needs a subprocess — re-run with --run.' });
        if (scoreM) claims.push({ kind: 'K4_SCORE', line: s.line, subject: disp,
          claim: `\`${disp}\` self-test reports ${scoreM[1]}/${scoreM[2]}`, verdict: 'NOT_RUN',
          evidence: 'needs a subprocess — re-run with --run.' });
        continue;
      }
      const r = runSelfTest(root, info.rel, timeout);
      const cmd = `node ${info.rel} --self-test`;
      if (brokenPhrase) {
        claims.push(r.exit === 0
          ? { kind: 'K3_BROKEN', line: s.line, subject: disp,
              claim: `\`${disp}\` ${brokenPhrase}`, verdict: 'STALE',
              evidence: `\`${cmd}\` exits 0${r.score ? ` (${r.score.got}/${r.score.of})` : ''}. `
                + 'It runs. This is the gamepad-shim shape: the claim was true once and a later '
                + 'round repaired it without striking the bullet.' }
          : { kind: 'K3_BROKEN', line: s.line, subject: disp,
              claim: `\`${disp}\` ${brokenPhrase}`, verdict: 'LIVE',
              evidence: `\`${cmd}\` exits ${r.exit}${r.timedout ? ' (TIMED OUT)' : ''}. ${r.tail}` });
      }
      if (scoreM && r.score) {
        const want = { got: Number(scoreM[1]), of: Number(scoreM[2]) };
        claims.push(r.score.got === want.got && r.score.of === want.of
          ? { kind: 'K4_SCORE', line: s.line, subject: disp,
              claim: `\`${disp}\` self-test reports ${want.got}/${want.of}`, verdict: 'LIVE',
              evidence: `\`${cmd}\` still reports ${r.score.got}/${r.score.of}.` }
          : { kind: 'K4_SCORE', line: s.line, subject: disp,
              claim: `\`${disp}\` self-test reports ${want.got}/${want.of}`, verdict: 'STALE',
              evidence: `\`${cmd}\` reports ${r.score.got}/${r.score.of} today, not `
                + `${want.got}/${want.of}. The battery moved under the claim.` });
      }
    }
  }

  const checkedLines = new Set(claims.map((c) => c.line));
  return {
    file: path.relative(root, file), statements: stmts.length,
    bullets: stmts.filter((s) => s.kind === 'bullet').length,
    paragraphs: stmts.filter((s) => s.kind === 'paragraph').length,
    struck_skipped: struck,
    quoted_skipped: quoted,
    statements_with_a_checkable_claim: checkedLines.size,
    coverage_fraction: stmts.length ? checkedLines.size / stmts.length : 0,
    deep: !!run, claims,
    stale: claims.filter((c) => c.verdict === 'STALE'),
  };
}

// ---------------------------------------------------------------------------------------------
// Reporting. The coverage sentence is not optional and not suppressible — the whole argument for
// shipping a 5%-coverage checker is that it says so, out loud, every single time.
// ---------------------------------------------------------------------------------------------
function report(res, quiet) {
  const pct = (res.coverage_fraction * 100).toFixed(1);
  // --quiet is for the pre-commit hook, which runs on every commit and must not add 25 lines of
  // noise to a clean one. It still states the coverage fraction, because the honesty clause is
  // not something a flag may switch off — it is the only thing that keeps a 2.8%-coverage
  // checker from reading as a guarantee.
  if (quiet && !res.stale.length) {
    return `pre-commit: dispatch-staleness — no stale claim in ${res.file} `
      + `(checked ${res.statements_with_a_checkable_claim}/${res.statements} statements, ${pct}%; `
      + 'the other 97% is prose and is NOT checked).';
  }
  const L = [];
  L.push(`dispatch-staleness: ${res.file}`);
  L.push('');
  L.push(`  COVERAGE: ${res.statements_with_a_checkable_claim} of ${res.statements} statements `
    + `(${pct}%) carry a claim this tool can decide by machine.`);
  L.push(`  The other ${res.statements - res.statements_with_a_checkable_claim} are prose, judgement, `
    + 'design rulings and acceptance bars written in English.');
  L.push('  THIS TOOL DOES NOT CHECK THOSE AND CANNOT. A clean run here means the small mechanical');
  L.push('  slice is current. It is NOT a statement that the dispatch as a whole is current.');
  L.push(`  (${res.bullets} bullets, ${res.paragraphs} paragraphs; ${res.struck_skipped} struck `
    + `statements skipped — a struck bullet is a resolved one and is deliberately not re-reported; `
    + `${res.quoted_skipped} marked \`<!-- dispatch-staleness: quoted -->\`, which is also how you `
    + 'would hide a claim from this tool — grep for it.)');
  if (!res.deep) L.push('  MODE: fast (K1 paths, K2 absence). --run adds K3 self-tests and K4 scores.');
  else L.push('  MODE: deep (--run) — self-tests executed.');
  L.push('');

  const order = ['STALE', 'LIVE', 'NOT_RUN'];
  for (const v of order) {
    const rows = res.claims.filter((c) => c.verdict === v);
    if (!rows.length) continue;
    L.push(`  ${v} (${rows.length}):`);
    for (const c of rows) {
      L.push(`    ${res.file}:${c.line}  [${c.kind}] ${c.claim}`);
      L.push(`        ${c.evidence}`);
    }
    L.push('');
  }
  if (!res.stale.length) L.push('  No mechanically checkable claim in this file has gone stale.');
  else L.push(`  ${res.stale.length} claim(s) no longer hold. Strike them in place with the evidence `
    + '— do not delete them.');
  return L.join('\n');
}

// =============================================================================================
// RULE 4 — the self-test. It must show this tool calling a STALE claim stale AND a LIVE claim
// live, by feeding it both. A checker that can only say "fine" is not an instrument.
//
// Everything is built in a throwaway tree so the battery is hermetic: two fixture tools (one that
// self-tests clean, one that does not), one file that exists and one that does not, and two
// dispatch files making the same four claim kinds against them in opposite directions.
// =============================================================================================
function selfTest() {
  const lines = [];
  let failed = 0;
  const ok = (name, cond, detail) => {
    lines.push(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    if (!cond) failed++;
  };

  const root = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'dispatch-staleness-'));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(root, 'game/data'), { recursive: true });

  // A tool that runs and self-tests clean at 4/4.
  fs.writeFileSync(path.join(root, 'tools/fixture-good.mjs'),
    'console.log("fixture-good self-test: PASS (4/4)"); process.exit(0);\n');
  // A tool that is genuinely broken, the way R1 found gamepad-shim.
  fs.writeFileSync(path.join(root, 'tools/fixture-bad.mjs'),
    'console.error("boom"); process.exit(1);\n');
  fs.writeFileSync(path.join(root, 'game/data/present.json'), '{}\n');

  // Every claim here is FALSE of the fixture tree. Each must come back STALE.
  fs.writeFileSync(path.join(root, 'STALE.md'), [
    '# fixture', '',
    '- **`fixture-good.mjs`** — does not run, 3/3 crash.', '',
    '- `game/data/present.json` **does not exist** — never written.', '',
    '- **`tools/fixture-gone.mjs`** — the tool this bullet names.', '',
    '- **`fixture-good.mjs`** — its self-test reports 3/3.', '',
  ].join('\n'));

  // Every claim here is TRUE of the fixture tree. None may come back STALE.
  // The last bullet is copied in shape from the real false positive this tool produced on its
  // first run against NEXT-DISPATCH.md: a path, then an absence phrase 60 characters later that
  // is about a FIELD, not about the path. It must stay silent.
  fs.writeFileSync(path.join(root, 'game/data/note.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'LIVE.md'), [
    '# fixture', '',
    '- **`fixture-bad.mjs`** — does not run, crashes.', '',
    '- `game/data/missing.json` **does not exist** — never written.', '',
    '- **`tools/fixture-good.mjs`** — the tool this bullet names.', '',
    '- **`fixture-good.mjs`** — its self-test reports 4/4.', '',
    '- Reproduce with the one-liner in `game/data/note.json`. **Two layers, not one.**',
    '  `infoFor()` never carries `res` out of the reader — it is absent from the return literal.', '',
  ].join('\n'));

  // A struck bullet must be skipped, not re-reported. This is the gamepad regression guard.
  fs.writeFileSync(path.join(root, 'STRUCK.md'), [
    '# fixture', '',
    '- ~~**`fixture-good.mjs`** — does not run, 3/3 crash.~~ STRUCK: repaired, see `tools/fixture-gone.mjs`.', '',
  ].join('\n'));

  const opts = { root, run: true, timeout: 30000 };
  const S = check({ ...opts, file: path.join(root, 'STALE.md') });
  const V = check({ ...opts, file: path.join(root, 'LIVE.md') });
  const K = check({ ...opts, file: path.join(root, 'STRUCK.md') });
  const find = (r, kind, verdict) => r.claims.filter((c) => c.kind === kind && c.verdict === verdict);

  // ---- STALE direction: the instrument must go red on all four kinds ------------------------
  ok('K3 BROKEN reported STALE when the tool actually runs (the gamepad shape)',
    find(S, 'K3_BROKEN', 'STALE').length === 1,
    find(S, 'K3_BROKEN', 'STALE')[0]?.evidence.slice(0, 90));
  ok('K2 ABSENT reported STALE when the "missing" file is on disk',
    find(S, 'K2_ABSENT', 'STALE').length === 1,
    find(S, 'K2_ABSENT', 'STALE')[0]?.evidence.slice(0, 90));
  ok('K1 PATH reported STALE when a named tool path is gone (the build-viability rename shape)',
    find(S, 'K1_PATH', 'STALE').some((c) => c.subject === 'tools/fixture-gone.mjs'));
  ok('K4 SCORE reported STALE when the self-test count moved under the claim',
    find(S, 'K4_SCORE', 'STALE').length === 1,
    find(S, 'K4_SCORE', 'STALE')[0]?.evidence.slice(0, 90));
  ok('and the stale fixture exits non-zero overall', S.stale.length >= 4, `${S.stale.length} stale`);

  // ---- LIVE direction: the SAME checks must stay silent on claims that still hold -----------
  // Without this half the tool is a rubber stamp in the other direction: something that flags
  // everything is as useless as something that flags nothing.
  ok('K3 BROKEN reported LIVE — a tool that really is broken is NOT called stale',
    find(V, 'K3_BROKEN', 'LIVE').length === 1 && find(V, 'K3_BROKEN', 'STALE').length === 0,
    find(V, 'K3_BROKEN', 'LIVE')[0]?.evidence.slice(0, 90));
  ok('K2 ABSENT reported LIVE — a file that really is missing is NOT called stale',
    find(V, 'K2_ABSENT', 'LIVE').length === 1 && find(V, 'K2_ABSENT', 'STALE').length === 0);
  ok('K1 PATH silent — a named path that IS on disk raises nothing',
    !V.claims.some((c) => c.kind === 'K1_PATH'));
  ok('K4 SCORE reported LIVE — a score that still matches is NOT called stale',
    find(V, 'K4_SCORE', 'LIVE').length === 1 && find(V, 'K4_SCORE', 'STALE').length === 0);
  ok('and the live fixture reports nothing stale at all', V.stale.length === 0,
    V.stale.map((c) => c.kind).join(',') || 'none');

  // ---- a tool committed beside a verdict, not under tools/, must still resolve ---------------
  // The second false positive on the real file: a critic's probe lives in
  // corpus/90-verdicts/**/artifacts/ and the basename search did not look there.
  fs.mkdirSync(path.join(root, 'corpus/90-verdicts/wave1/artifacts/x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'corpus/90-verdicts/wave1/artifacts/x/probe-beside-a-verdict.mjs'), '\n');
  fs.writeFileSync(path.join(root, 'ELSEWHERE.md'),
    '# fixture\n\n- The critic used `probe-beside-a-verdict.mjs` for this.\n');
  const E = check({ ...opts, run: false, file: path.join(root, 'ELSEWHERE.md') });
  ok('a tool committed beside a verdict (not under tools/) resolves and raises nothing',
    E.claims.length === 0, E.claims.map((c) => c.subject).join(',') || 'silent');

  // ---- the quoted marker: it must silence, and it must be counted so it can be audited -------
  fs.writeFileSync(path.join(root, 'QUOTED.md'), [
    '# fixture', '',
    '<!-- dispatch-staleness: quoted -->',
    'Section 2b claims `game/data/missing-elsewhere.json` **does not exist**, and that is now false.', '',
    'The same sentence without the marker: `game/data/present.json` **does not exist**.', '',
  ].join('\n'));
  const Q = check({ ...opts, run: false, file: path.join(root, 'QUOTED.md') });
  ok('a statement marked `<!-- dispatch-staleness: quoted -->` is skipped — an audit note that '
    + 'reports a stale claim must restate it, and must not be flagged for doing so',
    Q.quoted_skipped === 1 && !Q.claims.some((c) => c.subject === 'game/data/missing-elsewhere.json'));
  ok('but the marker silences only the statement it is in — the UNMARKED one beside it still fires',
    Q.stale.some((c) => c.subject === 'game/data/present.json'),
    'a per-statement opt-out, not a per-file one');

  // ---- the false positive it actually produced, kept as a regression -------------------------
  ok('an absence phrase about a FIELD near a path does not raise a K2 (the real false positive)',
    !V.claims.some((c) => c.subject === 'game/data/note.json'),
    'proximity window is 100 chars and stops at the next path');

  // ---- would it have caught the bullet that cost the dispatch? -------------------------------
  // The verbatim R1 line, as it stood in NEXT-DISPATCH.md before W1-GAMEPAD struck it, pointed at
  // a fixture tool that runs. If this assertion ever fails, the tool has stopped catching the
  // exact thing it was built for.
  fs.writeFileSync(path.join(root, 'GAMEPAD.md'), [
    '# fixture', '',
    '- **`fixture-good.mjs`** — does not run, 3/3 crash. This is the GameSir path the owner tests on.', '',
  ].join('\n'));
  const G = check({ ...opts, file: path.join(root, 'GAMEPAD.md') });
  ok('THE ORIGINAL BULLET: the verbatim R1 gamepad line, against a tool that runs, comes back STALE',
    G.stale.length === 1 && G.stale[0].kind === 'K3_BROKEN',
    G.stale[0]?.evidence.slice(0, 80));

  // ---- the strike convention, which is the whole reason bullets are struck not deleted -------
  ok('a struck bullet is SKIPPED, never re-reported (the gamepad line must stay quiet)',
    K.claims.length === 0 && K.struck_skipped === 1,
    `${K.claims.length} claim(s), ${K.struck_skipped} struck`);

  // ---- the honesty clause --------------------------------------------------------------------
  const real = check({ file: path.join(REPO, 'orchestration/NEXT-DISPATCH.md'), root: REPO, run: false, timeout: 1000 });
  ok('coverage over the REAL dispatch file is reported and is well under 100% (it must never claim to check prose)',
    real.coverage_fraction > 0 && real.coverage_fraction < 0.5,
    `${(real.coverage_fraction * 100).toFixed(1)}% of ${real.statements} statements`);
  ok('the coverage sentence is printed in the human report, every run',
    /THIS TOOL DOES NOT CHECK THOSE AND CANNOT/.test(report(real)));

  fs.rmSync(root, { recursive: true, force: true });
  process.stdout.write(lines.join('\n') + '\n\n'
    + `dispatch-staleness self-test: ${failed ? 'FAIL' : 'PASS'} (${lines.length - failed}/${lines.length})\n`);
  return failed ? 1 : 0;
}

// ---------------------------------------------------------------------------------------------
function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    args[k] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
  }
  if (args.help) {
    process.stdout.write(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n').filter((l) => l.startsWith('//')).map((l) => l.replace(/^\/\/ ?/, '')).join('\n') + '\n');
    return 0;
  }
  if (args['self-test']) return selfTest();

  const root = args.root === undefined || args.root === true ? REPO : path.resolve(String(args.root));
  const file = args.file === undefined || args.file === true
    ? path.join(root, 'orchestration/NEXT-DISPATCH.md') : path.resolve(String(args.file));
  if (!fs.existsSync(file)) {
    process.stderr.write(`dispatch-staleness: no such dispatch file: ${file}\n`);
    return 1;
  }
  const res = check({ file, root, run: !!args.run, timeout: Number(args.timeout) || 240000 });
  process.stdout.write(args.json ? JSON.stringify(res, null, 2) + '\n' : report(res, !!args.quiet) + '\n');
  return res.stale.length ? 2 : 0;
}

process.exit(main(process.argv.slice(2)));
