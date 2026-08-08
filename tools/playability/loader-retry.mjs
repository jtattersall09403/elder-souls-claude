#!/usr/bin/env node
// loader-retry.mjs — does the game survive a server having a bad moment, and does it still fail
// loudly when a file is genuinely not there?
//
// WHY THIS EXISTS. The playability agent opened the owner's own link twice, on a real network,
// and both runs died on `world/hazards.json` answering **503** from GitHub Pages' CDN. The data
// loader had no retry: one non-200 on any of 569 files threw, and the boot notice told the player
// *"A file the game needs is missing."* The file was not missing. This is the black screen a
// phone on a flaky connection produces and that this build machine — localhost, one client, no
// CDN — essentially never will, which is exactly why it reached the owner and no check here saw
// it. Pages wobbled again unprompted during a later run: 1 retried 5xx across 2828 requests.
//
// A RETRY YOU CANNOT WATCH WORK IS NOT A FIX. So this tool serves the real game from the real
// tree through a server that can be told to fail on demand, and drives a real browser at it.
//
//   node tools/playability/loader-retry.mjs --self-test        # all eight arms, the deliverable
//   node tools/playability/loader-retry.mjs --arm flaky        # one arm
//   node tools/playability/loader-retry.mjs --json <path>      # report (default reports/playability/loader-retry.json)
//   node tools/playability/loader-retry.mjs --shot <path.png>  # screenshot the persistent-503 notice
//
// THE ARMS. Each names what must be true and what would make it red.
//
//   1 clean          no faults                  -> boots. Baseline: proves the fixture serves the
//                                                  real game, so a red arm below is the fault and
//                                                  not the fixture.
//   2 flaky          503 on the first 2 requests -> boots ANYWAY, the server sees 3 requests for
//                    for world/hazards.json,        that one path, the loader's own log records a
//                    200 thereafter                 recovery on attempt 3, and the boot notice
//                                                  NEVER said "missing".
//   3 persistent-5xx 503 for ever                -> gives up, and the message on the glass names
//                                                  the STATUS, the URL and the ATTEMPT COUNT and
//                                                  does not say the file is missing. The device
//                                                  line is still there.
//   4 permanent-404  404 for ever                -> fails on the FIRST request. Exactly one
//                                                  request for that path: a retried 404 would
//                                                  bury the one word that names the bug, and
//                                                  `tools/check-shipped-files.mjs` exists because
//                                                  that bug is the other black-screen class here.
//   5 null-control   arm 2's faults, with the    -> MUST FAIL. Rule 6. If this is green the retry
//                    retry deleted from the         is not what carried arm 2.
//                    served engine.js
//   6 control-sane   no faults, with the retry   -> MUST BOOT. Without this, arm 5 going red
//                    deleted                        proves only that the deletion broke the file
//                                                  — an inert control wearing a result's clothes,
//                                                  which is the shape rule 6 says to assume you
//                                                  have until you have seen it go red for the
//                                                  right reason.
//
//   7 instrument-404 404 for ever, with the      -> arm 4's check MUST GO RED. A green arm is not
//                    loader sabotaged to retry      evidence until you have watched it fail for
//                    a 404                          the wrong behaviour (rule 4), and "the 404 was
//                                                   retried" is the exact wrong behaviour this
//                                                   fix could have introduced.
//   8 instrument-lie  arm 2's faults, with the     -> arm 2's check MUST GO RED. This one puts the
//                    boot notice sabotaged back      ORIGINAL DEFECT back — a 503 announced as a
//                    to calling every non-200 a      missing file — and requires the truthfulness
//                    missing file                    check to catch it.
//
// The deletion in arms 5 and 6, and both sabotages in 7 and 8, happen on the BYTES THIS SERVER
// SENDS, never on disk. Each is asserted to have applied — one match, the retry identifiers gone,
// the pre-fix line back — and the tool exits 2 if it did not, because a control that silently
// failed to remove the fix is the failure mode rule 6 is written about. Arms 7 and 8 further
// require their arm to go red FOR THE NAMED REASON, not just to go red.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT, REPORTS_DIR, ensureDir, writeJson, gitInfo } from '../lib/cli.mjs';

const USAGE = `
loader-retry.mjs — prove the data loader retries a 503, never retries a 404, and says which.

USAGE
  node tools/playability/loader-retry.mjs --self-test
  node tools/playability/loader-retry.mjs --arm <clean|flaky|persistent|notfound|null-control|control-sane|instrument-404|instrument-lie>

OPTIONS
  --self-test        Run every arm. Exit 0 only if all of them land on their expected side.
  --arm <name>       Run one arm.
  --file <rel>       Data file to fault, relative to game/data (default world/hazards.json —
                     the file that actually died on the live site, twice).
  --json <path>      Report path (default reports/playability/loader-retry.json)
  --shot <path>      Screenshot the persistent-503 boot notice here
  --timeout <ms>     Per-arm ceiling (default 120000)
  --help             This message

EXIT
  0  every arm landed where it must
  1  an arm landed on the wrong side — read the report
  2  the fixture or the control could not be set up (nothing was measured)
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const FAULT_FILE = String(args.file || 'world/hazards.json');
const FAULT_URL_PATH = '/game/data/' + FAULT_FILE;
const ENGINE_URL_PATH = '/game/src/engine.js';
const HTML_URL_PATH = '/game/index.html';
const TIMEOUT = Number(args.timeout || 120000);
const ENGINE_FILE = path.join(REPO_ROOT, 'game', 'src', 'engine.js');
const HTML_FILE = path.join(REPO_ROOT, 'game', 'index.html');

// ---------------------------------------------------------------------------------------------
// The delete-the-fix transform (rule 6). Applied to the served bytes only.
// ---------------------------------------------------------------------------------------------

// The anchors are the first and last lines of the retrying `fetchJson`. The replacement is the
// code that was there before P10, verbatim — so the null control is the actual old bug and not an
// invented one.
const RETRY_HEAD = '  const fetchJson = async (rel) => {\n    const url = new URL(rel, root);';
const RETRY_TAIL = '      await sleep(delay);\n    }\n  };';
const PRE_FIX_FETCHJSON = [
  '  const fetchJson = async (rel) => {',
  '    const res = await fetch(new URL(rel, root));',
  '    if (!res.ok) throw new Error(`data file missing: ${rel} (${res.status})`);',
  '    const text = await res.text();',
  '    onBytes(text.length);',
  '    return JSON.parse(text);',
  '  };',
].join('\n');

/**
 * Strip the retry out of engine.js source text.
 * @returns {{ok:true, src:string, removedBytes:number} | {ok:false, why:string}}
 */
export function deleteTheFix(src) {
  const i = src.indexOf(RETRY_HEAD);
  if (i < 0) return { ok: false, why: 'anchor RETRY_HEAD not found in engine.js — the retry has been rewritten and this control is stale' };
  if (src.indexOf(RETRY_HEAD, i + 1) >= 0) return { ok: false, why: 'anchor RETRY_HEAD matched more than once' };
  const j = src.indexOf(RETRY_TAIL, i);
  if (j < 0) return { ok: false, why: 'anchor RETRY_TAIL not found after RETRY_HEAD' };
  const out = src.slice(0, i) + PRE_FIX_FETCHJSON + src.slice(j + RETRY_TAIL.length);
  // The control must be verified, not assumed. Every one of these is a way the teardown could
  // have done nothing while looking like it worked.
  if (out.length >= src.length) return { ok: false, why: 'the stripped source is not smaller than the original' };
  if (out.includes('log.retries++')) return { ok: false, why: 'retry accounting survived the strip' };
  // `!isTransientStatus(...)`, not `isTransientStatus(...)` — the latter also matches the
  // function's own declaration, which stays behind (unused) and is not the thing under test.
  if (out.includes('!isTransientStatus(status)')) return { ok: false, why: 'the transient/permanent branch survived the strip' };
  if (!out.includes('data file missing: ${rel} (${res.status})')) return { ok: false, why: 'the pre-fix throw is not present after the strip' };
  return { ok: true, src: out, removedBytes: src.length - out.length };
}

// ---------------------------------------------------------------------------------------------
// Sabotages (rule 4). A green arm proves nothing until you have watched it go red for the wrong
// behaviour, so two arms below deliberately reintroduce a defect and REQUIRE the check that is
// supposed to catch it to fail. Both are one-token edits to the served bytes, and both assert
// their anchor matched exactly once — a sabotage that silently did not apply would turn an
// instrument proof into a second copy of the passing arm.
// ---------------------------------------------------------------------------------------------

function mutateOnce(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) return { ok: false, why: `sabotage anchor matched ${n} times (expected 1): ${from.slice(0, 80)}` };
  return { ok: true, src: src.split(from).join(to) };
}

/** Make the loader retry a 404, which is the failure this fix could plausibly have introduced. */
export function sabotageRetry404(engineSrc) {
  return mutateOnce(engineSrc, 'if (res && !isTransientStatus(status)) {', 'if (res && false) {');
}

/** Put the original lie back in the boot notice: every non-200 reported as a missing file. */
export function sabotageNoticeLie(htmlSrc) {
  return mutateOnce(htmlSrc,
    'if (res.status >= 500 || res.status === 408 || res.status === 429) {',
    'if (false) {');
}

// ---------------------------------------------------------------------------------------------
// The fault-injecting static server.
// ---------------------------------------------------------------------------------------------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serve the repository, faulting one path on demand.
 *
 * @param {object} o
 * @param {string} [o.faultPath]   URL path to fault (exact match)
 * @param {number} [o.faultStatus] status to answer with
 * @param {number} [o.faultTimes]  how many of the first requests to fault (Infinity = always)
 * @param {string} [o.engineSrc]   replacement body for /game/src/engine.js (the null control)
 * @param {string} [o.htmlSrc]     replacement body for /game/index.html (a sabotage)
 */
async function faultServer(o = {}) {
  const counts = new Map();
  const served = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const n = (counts.get(p) || 0) + 1;
    counts.set(p, n);

    if (o.faultPath && p === o.faultPath && n <= (o.faultTimes ?? Infinity)) {
      served.push({ path: p, n, status: o.faultStatus });
      res.writeHead(o.faultStatus, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      res.end(`${o.faultStatus} injected by loader-retry.mjs (request ${n} for this path)`);
      return;
    }

    const override = (o.engineSrc && p === ENGINE_URL_PATH) ? { src: o.engineSrc, type: TYPES['.js'] }
      : (o.htmlSrc && p === HTML_URL_PATH) ? { src: o.htmlSrc, type: TYPES['.html'] }
      : null;
    if (override) {
      const body = Buffer.from(override.src, 'utf8');
      served.push({ path: p, n, status: 200, note: 'substituted source' });
      res.writeHead(200, { 'content-type': override.type, 'content-length': body.length, 'cache-control': 'no-store' });
      res.end(body);
      return;
    }

    const file = path.join(REPO_ROOT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(REPO_ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      served.push({ path: p, n, status: 404, note: 'genuinely absent on disk' });
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404 ' + p);
      return;
    }
    const body = fs.readFileSync(file);
    served.push({ path: p, n, status: 200 });
    res.writeHead(200, {
      'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': 'no-store',
    });
    res.end(body);
  });
  await new Promise((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', r); });
  const port = server.address().port;
  return {
    origin: `http://127.0.0.1:${port}`,
    counts, served,
    countOf: (p) => counts.get(p) || 0,
    close: () => new Promise((r) => server.close(r)),
  };
}

// ---------------------------------------------------------------------------------------------
// One run of the game against one server.
// ---------------------------------------------------------------------------------------------

// Installed before the game's own scripts. The boot notice's text is overwritten several times a
// second while loading, so a reading taken at the end sees only the last one; this keeps every
// distinct line the player was actually shown.
const NOTICE_RECORDER = `(() => {
  window.__NOTICE_LOG = [];
  const push = () => {
    const el = document.getElementById('boot-notice');
    if (!el) return;
    const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    const L = window.__NOTICE_LOG;
    if (t && (!L.length || L[L.length - 1] !== t)) L.push(t);
  };
  const start = () => { push(); new MutationObserver(push).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;

async function runOnce(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e).slice(0, 300)));
  await page.addInitScript(NOTICE_RECORDER);

  const out = { booted: false, error: null, notice: null, noticeLog: [], diagnostic: null, transient: null, retryLog: null, pageErrors };
  try {
    await page.goto(origin + '/game/index.html', { waitUntil: 'load', timeout: TIMEOUT });
  } catch (e) {
    out.error = 'navigation failed: ' + e.message;
    await context.close();
    return out;
  }

  const sawHarness = await page.waitForFunction(() => !!window.__HARNESS, null, { timeout: TIMEOUT })
    .then(() => true).catch(() => false);
  if (sawHarness) {
    const r = await page.evaluate(async (t) => {
      const H = window.__HARNESS;
      if (!H || typeof H.ready !== 'function') return { booted: false, error: 'no ready()' };
      try {
        await Promise.race([H.ready(), new Promise((_, rej) => setTimeout(() => rej(new Error('ready() timeout')), t))]);
        return { booted: true, error: null };
      } catch (e) { return { booted: false, error: String((e && e.message) || e) }; }
    }, TIMEOUT).catch((e) => ({ booted: false, error: 'evaluate failed: ' + e.message }));
    out.booted = r.booted;
    out.error = r.error;
  } else {
    out.error = 'window.__HARNESS never appeared';
  }

  // Give the notice a beat to react to the rejection before reading it.
  await page.waitForTimeout(1200);
  const seen = await page.evaluate(() => ({
    notice: (document.getElementById('boot-notice')?.textContent || '').replace(/\s+/g, ' ').trim(),
    hidden: document.getElementById('boot-notice')?.className === 'gone',
    log: (window.__NOTICE_LOG || []).slice(0, 40),
    diagnostic: window.__BOOT_DIAGNOSTIC || null,
    transient: window.__BOOT_TRANSIENT || null,
    retries: window.__ES_LOAD_RETRIES ? JSON.parse(JSON.stringify(window.__ES_LOAD_RETRIES)) : null,
  })).catch(() => ({}));
  out.notice = seen.notice ?? null;
  out.noticeHidden = seen.hidden ?? null;
  out.noticeLog = seen.log || [];
  out.diagnostic = seen.diagnostic ?? null;
  out.transient = seen.transient ?? null;
  out.retryLog = seen.retries ?? null;
  out.page = page;
  out.context = context;
  return out;
}

// ---------------------------------------------------------------------------------------------
// The arms.
// ---------------------------------------------------------------------------------------------

const ARMS = {
  clean: {
    what: 'no faults — the fixture serves the real game and it boots',
    server: () => ({}),
    expect: (r) => (r.booted ? null : `expected a boot, got: ${r.error}`),
  },
  flaky: {
    what: `503 on the first 2 requests for ${FAULT_FILE}, 200 after — the game must boot through it`,
    server: () => ({ faultPath: FAULT_URL_PATH, faultStatus: 503, faultTimes: 2 }),
    expect: (r, srv) => {
      const n = srv.countOf(FAULT_URL_PATH);
      if (!r.booted) return `expected a boot through two 503s, got: ${r.error}`;
      // THE LIE THIS WHOLE PIECE EXISTS TO KILL, checked FIRST. Order matters here and it cost a
      // round: with these last, the `instrument-lie` sabotage tripped the transient-count check
      // on its way past and the arm went red for a reason that was not the one under test — which
      // is an instrument proof that proves nothing. The two checks below are the ones arm 8 is
      // entitled to see bite.
      const lied = r.noticeLog.find((t) => t.includes('A file the game needs is missing'));
      if (lied) return `the notice called a 503 a missing file: ${lied}`;
      if (r.diagnostic) return `a failure diagnostic was raised on a boot that succeeded: ${r.diagnostic}`;
      // The number is the proof the retry fired. Without retry the loader asks once; with it, three times.
      if (n !== 3) return `expected exactly 3 requests for ${FAULT_URL_PATH} (2 faulted + 1 good), saw ${n}`;
      const rec = (r.retryLog?.events || []).find((e) => e.file === FAULT_FILE && e.outcome === 'recovered');
      if (!rec) return 'the loader did not record a recovery event for the faulted file';
      if (rec.on_attempt !== 3) return `recovery recorded on attempt ${rec.on_attempt}, expected 3`;
      if ((r.retryLog?.retries || 0) < 2) return `expected >= 2 retries in the loader log, saw ${r.retryLog?.retries}`;
      if (!r.transient || r.transient.count !== 2) return `boot notice saw ${r.transient?.count ?? 0} transient failures, expected 2`;
      return null;
    },
  },
  persistent: {
    what: `503 for ever on ${FAULT_FILE} — must give up and say 503, the URL and the attempt count`,
    server: () => ({ faultPath: FAULT_URL_PATH, faultStatus: 503, faultTimes: Infinity }),
    expect: (r, srv) => {
      const n = srv.countOf(FAULT_URL_PATH);
      if (r.booted) return 'the game booted on a file that never returned 200';
      if (n !== 4) return `expected 4 attempts (1 + 3 retries) for ${FAULT_URL_PATH}, saw ${n}`;
      const text = (r.notice || '') + ' ' + (r.diagnostic || '') + ' ' + (r.error || '');
      if (!text.includes('503')) return 'the failure text never names the status code 503';
      if (!text.includes(FAULT_FILE)) return `the failure text never names ${FAULT_FILE}`;
      if (!/4 attempts/.test(text)) return 'the failure text never names the attempt count';
      if (text.includes('A file the game needs is missing')) return 'the notice still calls a 503 a missing file';
      // Requirement 3: a permanent failure is not swallowed, and the device line goes with it.
      if (!r.diagnostic) return 'no boot diagnostic was raised at all — the failure was swallowed';
      if (!/canvas |ua /.test(r.diagnostic)) return 'the diagnostic carries no device line';
      if (r.noticeHidden) return 'the boot notice hid itself on a boot that never happened';
      return null;
    },
  },
  notfound: {
    what: `404 for ever on ${FAULT_FILE} — must fail on the FIRST request, no retry`,
    server: () => ({ faultPath: FAULT_URL_PATH, faultStatus: 404, faultTimes: Infinity }),
    expect: (r, srv) => {
      const n = srv.countOf(FAULT_URL_PATH);
      if (r.booted) return 'the game booted without a file it needs';
      // THE ARM THAT MUST BE RED FOR THE WRONG BEHAVIOUR. Retrying a 404 is the failure this
      // whole fix would otherwise introduce.
      if (n !== 1) return `a 404 was requested ${n} times — a 404 must never be retried`;
      const text = (r.notice || '') + ' ' + (r.diagnostic || '') + ' ' + (r.error || '');
      if (!text.includes('404')) return 'the failure text never names the status code 404';
      if (!text.includes(FAULT_FILE)) return `the failure text never names ${FAULT_FILE}`;
      if (!/never retried|not published|MISSING/.test(text)) return 'the failure text does not say the file is genuinely absent';
      if (!r.diagnostic) return 'no boot diagnostic was raised at all';
      return null;
    },
  },
  'null-control': {
    what: 'arm 2 with the retry deleted from the served engine.js — MUST FAIL (rule 6)',
    control: true,
    server: (ctl) => ({ faultPath: FAULT_URL_PATH, faultStatus: 503, faultTimes: 2, engineSrc: ctl.src }),
    expect: (r, srv) => {
      const n = srv.countOf(FAULT_URL_PATH);
      if (r.booted) return 'THE CONTROL IS INERT: the game booted through two 503s with the retry deleted, so something other than the retry is carrying arm 2';
      if (n !== 1) return `expected exactly 1 request for ${FAULT_URL_PATH} with no retry, saw ${n}`;
      if (!/data file missing/.test((r.notice || '') + (r.error || ''))) return 'the control failed, but not with the pre-fix message — check the strip landed where it should';
      return null;
    },
    redIsGood: true,
  },
  'control-sane': {
    what: 'no faults, retry deleted — MUST BOOT, or arm 5 proves only that the strip broke the file',
    control: true,
    server: (ctl) => ({ engineSrc: ctl.src }),
    expect: (r) => (r.booted ? null : `the stripped engine cannot boot even with no faults, so arm 5 is meaningless: ${r.error}`),
  },

  // ---- rule 4: the two arms that prove the checks above have teeth ----------------------------
  'instrument-404': {
    what: 'SABOTAGE: make the loader retry a 404 — arm 4 must go RED, or arm 4 cannot see a retried 404 at all',
    sabotage: 'retry404',
    server: (ctl) => ({ faultPath: FAULT_URL_PATH, faultStatus: 404, faultTimes: Infinity, engineSrc: ctl.retry404 }),
    expect: (r, srv) => {
      const why = ARMS.notfound.expect(r, srv);
      if (!why) return `arm 4 stayed green while a 404 was requested ${srv.countOf(FAULT_URL_PATH)} times — its no-retry check is inert`;
      if (!/never be retried/.test(why)) return `arm 4 went red for the wrong reason (${why}) — it is not the no-retry check that bit`;
      return null;
    },
    redIsGood: true,
  },
  'instrument-lie': {
    what: 'SABOTAGE: put the original "A file the game needs is missing" back for 5xx — arm 2 must go RED',
    sabotage: 'noticeLie',
    server: (ctl) => ({ faultPath: FAULT_URL_PATH, faultStatus: 503, faultTimes: 2, htmlSrc: ctl.noticeLie }),
    expect: (r, srv) => {
      const why = ARMS.flaky.expect(r, srv);
      if (!why) return 'arm 2 stayed green while the notice called a 503 a missing file — its truthfulness check is inert';
      if (!/missing file|diagnostic was raised/.test(why)) return `arm 2 went red for the wrong reason (${why}) — it is not the truthfulness check that bit`;
      return null;
    },
    redIsGood: true,
  },
};

// ---------------------------------------------------------------------------------------------

async function main() {
  const wanted = args['self-test'] || args.selfTest
    ? Object.keys(ARMS)
    : [String(args.arm || 'flaky')];
  for (const a of wanted) if (!ARMS[a]) { log(`unknown arm: ${a}`); process.exit(EXIT.USAGE ?? 2); }

  // The control source is prepared ONCE, up front, and a failure to prepare it is fatal before
  // anything is measured — a self-test that quietly skipped its own control would be worthless.
  const ctl = {};
  if (wanted.some((a) => ARMS[a].control)) {
    const res = deleteTheFix(fs.readFileSync(ENGINE_FILE, 'utf8'));
    if (!res.ok) { log('CANNOT BUILD THE NULL CONTROL: ' + res.why); process.exit(2); }
    ctl.src = res.src;
    log(`null control ready: ${res.removedBytes} bytes of retry removed from the served engine.js (disk untouched)`);
  }
  if (wanted.some((a) => ARMS[a].sabotage === 'retry404')) {
    const res = sabotageRetry404(fs.readFileSync(ENGINE_FILE, 'utf8'));
    if (!res.ok) { log('CANNOT BUILD THE 404-RETRY SABOTAGE: ' + res.why); process.exit(2); }
    ctl.retry404 = res.src;
  }
  if (wanted.some((a) => ARMS[a].sabotage === 'noticeLie')) {
    const res = sabotageNoticeLie(fs.readFileSync(HTML_FILE, 'utf8'));
    if (!res.ok) { log('CANNOT BUILD THE NOTICE-LIE SABOTAGE: ' + res.why); process.exit(2); }
    ctl.noticeLie = res.src;
  }

  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS.slice() });
  const results = [];
  let shot = null;

  try {
    for (const name of wanted) {
      const arm = ARMS[name];
      const srv = await faultServer(arm.server(ctl));
      const t0 = Date.now();
      let r;
      try {
        r = await runOnce(browser, srv.origin);
      } catch (e) {
        r = { booted: false, error: 'arm threw: ' + (e && e.message), noticeLog: [] };
      }
      const ms = Date.now() - t0;
      const why = arm.expect(r, srv);
      const rec = {
        arm: name, what: arm.what, pass: !why, why,
        booted: r.booted, elapsed_ms: ms,
        requests_for_faulted_path: srv.countOf(FAULT_URL_PATH),
        loader_error: r.error ? String(r.error).slice(0, 500) : null,
        notice: r.notice ? r.notice.slice(0, 600) : null,
        notice_lines: (r.noticeLog || []).slice(0, 12),
        diagnostic: r.diagnostic ? String(r.diagnostic).slice(0, 500) : null,
        transient_seen_by_notice: r.transient,
        loader_retry_log: r.retryLog,
        page_errors: (r.pageErrors || []).slice(0, 5),
      };
      results.push(rec);
      log(`${why ? 'FAIL' : 'ok  '}  ${name.padEnd(13)} ${arm.what}`);
      if (why) log(`        -> ${why}`);

      if (name === 'persistent' && args.shot && r.page) {
        shot = path.resolve(String(args.shot));
        ensureDir(path.dirname(shot));
        await r.page.screenshot({ path: shot }).catch(() => { shot = null; });
      }
      if (r.context) await r.context.close().catch(() => {});
      await srv.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const report = {
    tool: 'tools/playability/loader-retry.mjs',
    defect: 'P10 — the data loader had no retry; a 503 killed boot and was reported as a missing file',
    commit: gitInfo().commit,
    at: new Date().toISOString(),
    faulted_file: FAULT_FILE,
    retry_policy_under_test: 'engine.js LOAD_RETRY: 4 attempts, 250/750/1750 ms +-40% jitter, 12000 ms whole-load sleep budget, 24 retry ceiling',
    arms: results,
    passed: results.filter((r) => r.pass).length,
    total: results.length,
    screenshot: shot,
  };
  const out = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'playability', 'loader-retry.json');
  ensureDir(path.dirname(out));
  writeJson(out, report);
  log(`${report.passed}/${report.total} arms landed where they must — ${out}`);
  process.exit(report.passed === report.total ? 0 : 1);
}

// Only when run as a tool. `deleteTheFix` is exported so a successor's own control can reuse it
// without launching six browsers as a side effect of the import.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => { log('INTERNAL: ' + (e && e.stack || e)); process.exit(2); });
}
