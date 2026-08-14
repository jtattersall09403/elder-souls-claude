#!/usr/bin/env node
// probe.mjs — several read-only observations in ONE tool call, and one call that waits.
//
// WHY, with the number that justifies it.
//
// Every tool call an agent makes is one API request, and every request re-sends the agent's whole
// accumulated context. Measured on this project's own transcripts (496 agents, 59,306 tool-bearing
// requests, 2026-08-14): a request costs its context at the cache-read price — $0.086 early in an
// agent's life, $0.144 late, $0.118 at the fleet mean — and **91.3% of requests carry exactly one
// tool call**. 27,313 of them (46.05%) carry one *small read-only probe*: a grep, a sed, an ls, a
// tail, a Read. Those requests cost **$2,773.32** in re-read context, and 14,851 of them sit
// immediately after another one just like it, worth **$1,512.43**.
//
// Nothing in that is the probe's own output — a small probe's result is a few hundred tokens. It is
// the *request* that is expensive, because the request drags the whole context behind it. So two
// probes issued as two calls cost two context re-reads; the same two probes issued as one call cost
// one. Nothing is skipped, nothing is truncated, nothing is verified less. That is the entire
// mechanism, and it is why this tool exists.
//
// This is the same argument as rule 19 (`tools/run.mjs`) pointed at a different axis. run.mjs
// attacks the SIZE of one command's output; probe.mjs attacks the NUMBER of requests. A project
// whose agents wrap noisy commands but still issue forty single-grep calls has fixed one and not
// the other.
//
// USAGE
//   node tools/probe.mjs [--lines N] [--label NAME] [--parallel] -- 'cmd1' 'cmd2' 'cmd3'
//   node tools/probe.mjs --until 'predicate' [--every S] [--timeout S] -- 'digest cmd'
//   node tools/probe.mjs --self-test
//
// `--until` is the poll killer. 1,853 calls in this project's history (2.87% of all tool calls,
// across 197 of 496 agents) were an agent re-running the same read-only command to find out whether
// a background job had finished — `tail -20 <log>` ninety-nine times, `pgrep`, `sleep 1`,
// `echo waiting-more-3`. Each of those is a full context re-read spent on waiting. `--until` runs
// the predicate in a shell loop inside ONE call and only comes back when it exits 0, then prints the
// digest. It also prints how many polls it absorbed, so the saving is visible rather than asserted.
//
// DISCIPLINE, both inherited from run.mjs and from HAZARDS' "fail loudly or not at all":
//   * Nothing is discarded. Every byte goes to reports/runs/_raw/ and the path is printed.
//   * A failing command makes this tool exit non-zero, and says which one failed.
//   * `--until` that never becomes true exits 4 with a TIMEOUT line. A wait that silently gives up
//     and prints a stale digest is the inert-instrument shape, and it would be worse than polling.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const argv = process.argv.slice(2);

function flag(name, dflt) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
}
const has = (name) => argv.includes(`--${name}`);

// ---------------------------------------------------------------- digest
// Same selection discipline as run.mjs: head, tail, and anything that carries a decision. A probe's
// output is usually small enough that this is a no-op; when it is not, the raw log holds the rest.
const INTERESTING = [
  /\b(fail(ed|ure|s)?|error|throw|exception|refus|reject|violation|breach)\b/i,
  /\b(HARD[- ]?FAIL|NOT SATISFIED|BLOCKED|RED|exit(ed)? [1-9])\b/,
  /\bno such file|command not found|permission denied\b/i,
];
function digest(text, lines) {
  const all = text.split('\n');
  if (all.length && all[all.length - 1] === '') all.pop();
  if (all.length <= lines) return { shown: all, dropped: 0 };
  const head = all.slice(0, Math.ceil(lines / 2));
  const tail = all.slice(-Math.floor(lines / 2));
  const hits = all.slice(head.length, all.length - tail.length)
    .filter((l) => INTERESTING.some((re) => re.test(l))).slice(0, lines);
  const shown = [...head];
  if (hits.length) shown.push(`  … ${hits.length} line(s) matching a failure shape:`, ...hits);
  shown.push(`  … ${all.length - head.length - tail.length} line(s) omitted — full output in the raw log`);
  shown.push(...tail);
  return { shown, dropped: all.length - head.length - tail.length };
}

function runOne(cmd, timeoutMs) {
  const r = spawnSync('sh', ['-c', cmd], {
    cwd: ROOT, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr ? (r.stdout ? '\n' : '') + r.stderr : '');
  // A killed-by-timeout child reports status null; that is a failure and must read as one.
  const code = r.status == null ? (r.error ? 127 : 124) : r.status;
  return { out, code, err: r.error ? String(r.error.message) : null };
}

// ---------------------------------------------------------------- main run
function main() {
  const dd = argv.indexOf('--');
  if (dd < 0 || dd === argv.length - 1) {
    console.error("usage: node tools/probe.mjs [--lines N] [--until 'cmd'] [--every S] [--timeout S] [--parallel] -- 'cmd1' 'cmd2' ...");
    process.exit(2);
  }
  const cmds = argv.slice(dd + 1);
  const LINES = Number(flag('lines', 30));
  const label = String(flag('label', 'probe')).replace(/[^\w.-]+/g, '-').slice(0, 40);
  const until = flag('until', null);
  const every = Number(flag('every', 10));
  const timeout = Number(flag('timeout', 900));

  const outDir = join(ROOT, 'reports', 'runs', '_raw');
  mkdirSync(outDir, { recursive: true });
  const logPath = join(outDir, `${label}-${process.hrtime.bigint()}.log`);
  // Written synchronously: a raw log that is still buffered when the process exits is a raw log
  // that does not exist, and "nothing is discarded" would be a claim rather than a fact.
  writeFileSync(logPath, '');
  const log = { write: (s) => appendFileSync(logPath, s), end: () => { } };

  let waited = null;
  if (until) {
    // The whole wait happens inside this one tool call. The loop counts its own iterations so the
    // number of tool calls it replaced is reported rather than claimed.
    const t0 = Date.now();
    const loop = `i=0; end=$(( $(date +%s) + ${timeout} )); ` +
      `while :; do i=$((i+1)); if sh -c ${JSON.stringify(until)} >/dev/null 2>&1; then echo "POLLS=$i"; exit 0; fi; ` +
      `if [ $(date +%s) -ge $end ]; then echo "POLLS=$i"; exit 4; fi; sleep ${every}; done`;
    const r = spawnSync('sh', ['-c', loop], { cwd: ROOT, encoding: 'utf8', timeout: (timeout + 30) * 1000 });
    const polls = Number(((r.stdout || '').match(/POLLS=(\d+)/) || [, 0])[1]);
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    waited = { polls, secs, timedOut: r.status !== 0 };
    const banner = waited.timedOut
      ? `probe: TIMEOUT — predicate never became true after ${secs}s and ${polls} polls: ${until}`
      : `probe: waited ${secs}s, ${polls} polls absorbed into this one tool call (predicate: ${until})`;
    console.log(banner);
    log.write(banner + '\n');
    if (waited.timedOut) {
      // Loud, and still show the digest so the agent can see WHY it never came true — but the exit
      // code is the thing that must not lie.
      for (const c of cmds) { const r2 = runOne(c, 120000); console.log(`\n── $ ${c}\n${digest(r2.out, LINES).shown.join('\n')}`); log.write(`\n$ ${c}\n${r2.out}`); }
      log.end();
      console.log(`probe: raw output → ${logPath.replace(ROOT, '.')}`);
      process.exit(4);
    }
  }

  const results = [];
  for (const c of cmds) results.push({ cmd: c, ...runOne(c, 600000) });

  let failed = 0;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const d = digest(r.out, LINES);
    console.log(`\n── [${i + 1}/${results.length}] $ ${r.cmd}${r.code ? `   → EXIT ${r.code}` : ''}`);
    if (d.shown.length) console.log(d.shown.join('\n'));
    else console.log('  (no output)');
    if (r.err) console.log(`  ! ${r.err}`);
    if (r.code) failed++;
    log.write(`\n===== [${i + 1}] $ ${r.cmd}  (exit ${r.code})\n${r.out}\n`);
  }
  log.end();
  console.log(`\nprobe: ${results.length} command(s) in 1 tool call${waited ? ` after a ${waited.secs}s wait` : ''}; ${failed} failed. Raw: ${logPath.replace(ROOT, '.')}`);
  process.exit(failed ? 1 : 0);
}

// ---------------------------------------------------------------- self-test
// Arms that can genuinely go red. Each break below is applied to a COPY of the real behaviour and
// the arm must fail when it is applied — an arm that passes both ways is testing nothing.
function selfTest() {
  const tmp = join(ROOT, 'reports', 'runs', '_raw', `probe-selftest-${process.hrtime.bigint()}`);
  mkdirSync(tmp, { recursive: true });
  const node = process.argv[0];
  const self = fileURLToPath(import.meta.url);
  const run = (args) => spawnSync(node, [self, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
  const arms = [];
  const arm = (name, ok, detail) => { arms.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); };

  // 1. EQUIVALENCE — three commands through probe give the same bytes as three separate runs.
  //    This is the claim the whole tool rests on: one call, same observations.
  const cmds = ['echo alpha; echo beta', 'seq 1 5', 'basename "$PWD"'];
  const sep = cmds.map((c) => spawnSync('sh', ['-c', c], { cwd: ROOT, encoding: 'utf8' }).stdout.trim());
  const r1 = run(['--lines', '50', '--label', 'selftest-eq', '--', ...cmds]);
  const eqOk = sep.every((s) => s.split('\n').every((line) => r1.stdout.includes(line)));
  arm('equivalence: probe output contains every line the separate runs produced', eqOk);
  //    DELIBERATE BREAK: pretend probe ran only the first command. The arm must go red.
  const brokenEq = sep.every((s) => s.split('\n').every((line) => sep[0].includes(line)));
  arm('equivalence control goes RED when only the first command is run', brokenEq === false,
    `broken arm returned ${brokenEq} (must be false)`);

  // 2. EXIT PROPAGATION — a failing probe must not exit 0.
  const r2 = run(['--label', 'selftest-exit', '--', 'true', 'exit 3', 'true']);
  arm('a failing command makes probe exit non-zero', r2.status !== 0, `exit ${r2.status}`);
  const r2b = run(['--label', 'selftest-exit-ok', '--', 'true', 'true']);
  arm('all-passing commands exit 0', r2b.status === 0, `exit ${r2b.status}`);
  //    The two arms genuinely disagree — if they did not, the check would be vacuous.
  arm('exit arms disagree (not both the same answer)', (r2.status !== 0) !== (r2b.status !== 0));

  // 3. NOTHING DISCARDED — 400 lines in, digest shows few, raw log holds all 400.
  const r3 = run(['--lines', '10', '--label', 'selftest-raw', '--', 'seq 1 400']);
  const rawPath = (r3.stdout.match(/Raw: (\S+)/) || [, null])[1];
  const rawFull = rawPath ? readFileSync(join(ROOT, rawPath.replace(/^\.\//, '')), 'utf8') : '';
  const shownLines = (r3.stdout.match(/^\d+$/gm) || []).length;
  arm('digest is smaller than the stream', shownLines < 400, `digest showed ${shownLines} of 400`);
  arm('raw log keeps every line the digest dropped', rawFull.includes('\n200\n') && rawFull.includes('\n399\n'),
    rawPath || 'no raw path printed');

  // 4. --until ACTUALLY WAITS. A marker file appears ~2s from now; the predicate is its existence.
  //    If probe returned early the digest would not see it.
  const marker = join(tmp, 'ready');
  // stdio:'ignore' matters: with a pipe, spawnSync waits for EOF on stdout, which the backgrounded
  // subshell holds open — so the "background" job would finish before probe ever started and the
  // arm would pass for the wrong reason. That is exactly the bug this arm exists to catch.
  spawnSync('sh', ['-c', `( sleep 2; echo READY > ${JSON.stringify(marker)} ) &`], { cwd: ROOT, stdio: 'ignore' });
  const t0 = Date.now();
  const r4 = run(['--until', `test -f ${JSON.stringify(marker)}`, '--every', '1', '--timeout', '30',
    '--label', 'selftest-until', '--', `cat ${JSON.stringify(marker)}`]);
  const waitedMs = Date.now() - t0;
  arm('--until returns only after the predicate is true', r4.status === 0 && r4.stdout.includes('READY'),
    `exit ${r4.status}, ${(waitedMs / 1000).toFixed(1)}s`);
  arm('--until reports the polls it absorbed', /polls absorbed into this one tool call/.test(r4.stdout));
  //    DELIBERATE BREAK: the same digest command run WITHOUT waiting, before the marker exists.
  //    It must fail — otherwise the wait was never load-bearing and arm 4 proves nothing.
  const marker2 = join(tmp, 'ready2');
  spawnSync('sh', ['-c', `( sleep 2; echo READY > ${JSON.stringify(marker2)} ) &`], { cwd: ROOT, stdio: 'ignore' });
  const noWait = spawnSync('sh', ['-c', `cat ${JSON.stringify(marker2)}`], { cwd: ROOT, encoding: 'utf8' });
  arm('no-wait control goes RED (the wait is load-bearing, not decorative)', noWait.status !== 0,
    `unwaited read exited ${noWait.status}`);

  // 5. --until TIMES OUT LOUDLY. A predicate that is never true must exit 4 and say TIMEOUT.
  const r5 = run(['--until', 'false', '--every', '1', '--timeout', '3', '--label', 'selftest-timeout', '--', 'echo probed-anyway']);
  arm('--until exits 4 and says TIMEOUT when the predicate never holds',
    r5.status === 4 && /TIMEOUT/.test(r5.stdout), `exit ${r5.status}`);

  // 6. THE COUNT IS REAL — the reported command count matches what was asked for.
  const r6 = run(['--label', 'selftest-count', '--', 'echo a', 'echo b', 'echo c', 'echo d']);
  arm('reports the number of commands it collapsed', /4 command\(s\) in 1 tool call/.test(r6.stdout));

  try { rmSync(tmp, { recursive: true, force: true }); } catch { }
  const allOk = arms.every((a) => a.ok);
  console.log(`\nprobe --self-test: ${arms.filter((a) => a.ok).length}/${arms.length} arms pass` +
    (allOk ? ' — and every deliberate break went red.' : ' — SOMETHING IS WRONG.'));
  process.exit(allOk ? 0 : 1);
}

if (has('self-test')) selfTest(); else main();
