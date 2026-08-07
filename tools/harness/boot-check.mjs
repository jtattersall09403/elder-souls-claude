#!/usr/bin/env node
// boot-check.mjs — does the GAME come up? Not the environment: the game.
//
// This exists because `smoke.mjs` is honest about being an *environment* self-test — its own
// header says "It does not touch the game" — and the orchestrator was nonetheless using it as a
// post-commit boot check. So a build could ship with the engine failing to construct and smoke
// would pass 6/6, which is exactly what happened: a data file violating its own assertion threw
// out of input setup before `window.__HARNESS` was ever assigned, and three separate agents lost
// measurement rounds to it while every boot check on the tree stayed green.
//
// The single assertion that matters: `window.__HARNESS` exists after the page has had time to
// construct. Everything else here is diagnosis for when it does not.
//
// Run: node tools/harness/boot-check.mjs   (wired into .githooks/pre-commit and the orchestration tick)

import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson } from '../lib/cli.mjs';

const USAGE = `
boot-check.mjs — prove the engine actually constructs.

USAGE
  node tools/harness/boot-check.mjs [--timeout <ms>] [--out <file>]

OPTIONS
  --timeout <ms>  How long to wait for window.__HARNESS (default 30000)
  --out <path>    Write a JSON report here
  --help          This message

Exit 0 = the engine came up. Non-zero = the build is broken and every measurement
taken against it is void. Page errors and failed requests are printed on failure.
`;

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const timeout = Number(args.timeout ?? 30000);
const errors = [];
let handle;

try {
  handle = await launchGame({ ...args, width: 320, height: 240 });
  const page = handle.page;
  page.on('pageerror', e => errors.push({ kind: 'pageerror', text: String(e).slice(0, 400) }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ kind: 'console', text: m.text().slice(0, 400) }); });
  page.on('requestfailed', r => errors.push({ kind: 'requestfailed', text: r.url().slice(-120) }));

  const up = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout })
    .then(() => true).catch(() => false);

  // A harness object that exists but cannot answer is not a booted game.
  const alive = up && await page.evaluate(() => {
    try { return typeof window.__HARNESS.getState === 'function' || typeof window.__HARNESS.snapshot === 'function'; }
    catch { return false; }
  }).catch(() => false);

  const report = { ok: !!alive, harness_present: up, harness_responsive: !!alive, errors, timeout_ms: timeout };
  if (args.out) writeJson(args.out, report);

  if (!alive) {
    log(`boot-check: FAIL — window.__HARNESS ${up ? 'present but unresponsive' : 'never appeared'} within ${timeout} ms`);
    if (!errors.length) log('boot-check: no page errors captured — suspect a rejected promise or a throw inside module setup');
    for (const e of errors.slice(0, 8)) log(`  ${e.kind}: ${e.text}`);
    log('boot-check: every measurement taken against this build is void until this passes.');
    process.exitCode = EXIT.HARNESS_ABSENT;
  } else {
    log('boot-check: PASS — the engine constructed and the harness answers.');
  }
} catch (e) {
  log(`boot-check: FAIL — could not launch: ${e.message}`);
  process.exitCode = EXIT.HARNESS_ABSENT;
} finally {
  try { await handle?.close?.(); } catch { }
}
