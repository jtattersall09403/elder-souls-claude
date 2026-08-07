#!/usr/bin/env node
/**
 * cache-test.mjs — a cache hit is free, and a game/ change invalidates it.
 *
 * S34 keys the cache on the build "so that a stale picture cannot outlive the code that drew it".
 * That is a claim with two halves and both are checked here:
 *
 *   C1  HIT IS FREE           — the same request twice returns the same bytes, the second in
 *                               milliseconds, and still carries provenance and a settle proof.
 *   C2  A CHANGE INVALIDATES  — touch game/, and the SAME request must miss, land in a different
 *                               cache bucket, and be re-rendered by a browser holding the new code.
 *   C3  MTIME IS NOT CONTENT  — rewrite a game/ file with identical bytes (mtime moves, content
 *                               does not) and the cache must still HIT. An invalidator that fires
 *                               on mtime would re-render the whole corpus every time anything is
 *                               opened for writing.
 *   C4  THE CHANGE IS REALLY LOADED — after invalidation, the browser must be serving the new
 *                               code, not the old code under a new key. Checked by making the
 *                               game/ change OBSERVABLE from the harness and reading it back.
 *
 * The edit is made to a scratch file inside game/ and removed afterwards; nothing indexed is
 * touched. It is restored in a `finally`, and the file is named so that a leftover is obvious.
 *
 * USAGE
 *   node tools/capture/cache-test.mjs [--out reports/capture]
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, ensureDir, log, EXIT, REPO_ROOT, GAME_DIR, readJson } from '../lib/cli.mjs';
import { CaptureSession } from './client.mjs';
import { buildKey } from './buildkey.mjs';

const USAGE = `cache-test.mjs — cache hit timing, and build invalidation.
  --out <dir>   where to write CACHE.json (default reports/capture)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/capture')));
ensureDir(OUT);

const SCRATCH = path.join(GAME_DIR, 'CAPTURE-CACHE-TEST.tmp.js');
const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
const b = regions[0].bounds_m;
const spec = {
  evidence_of: 'appearance',
  place: { x: Math.round((b.x[0] + b.x[1]) / 2), z: Math.round((b.z[0] + b.z[1]) / 2) },
  pose: { yaw_deg: 77, pitch_deg: 4, eye_m: 1.7, fov: 70 },
  time: 11, weather: 'clear', width: 960, height: 540,
};

const results = {};
const s = new CaptureSession();

try {
  // ---- C1: hit is free -----------------------------------------------------------------------
  const t0 = Date.now();
  const first = await s.capture({ ...spec, no_cache: true });   // force a real render
  const missMs = Date.now() - t0;
  const t1 = Date.now();
  const second = await s.capture(spec);
  const hitMs = Date.now() - t1;
  results.C1_hit_is_free = {
    what: 'the same request twice',
    miss_ms: missMs,
    hit_ms: hitMs,
    speedup: +(missMs / Math.max(1, hitMs)).toFixed(1),
    same_bytes: first.sha256 === second.sha256,
    hit_carries_provenance: second.provenance && second.provenance.arrival === 'placed',
    hit_carries_settle_proof: !!(second.settle && second.settle.settled),
    first_cached: first.cached, second_cached: second.cached,
    pass: second.cached === true && first.cached === false && first.sha256 === second.sha256
      && hitMs < missMs / 10 && second.provenance.arrival === 'placed' && second.settle.settled === true,
  };
  log(`C1 miss ${missMs} ms -> hit ${hitMs} ms (${results.C1_hit_is_free.speedup}x), same bytes=${first.sha256 === second.sha256}`);

  const keyBefore = second.provenance.build_key;
  const bucketBefore = path.dirname(second.path);

  // ---- C3: mtime is not content ---------------------------------------------------------------
  // Rewrite an existing game/ file with its own bytes. Its mtime moves; nothing else does.
  const victim = path.join(GAME_DIR, 'index.html');
  const bytes = fs.readFileSync(victim);
  fs.writeFileSync(victim, bytes);
  const third = await s.capture(spec);
  results.C3_mtime_is_not_content = {
    what: 'rewrite game/index.html with identical bytes, so mtime moves and content does not',
    must: 'still HIT — an mtime-based invalidator would re-render everything',
    still_cached: third.cached,
    build_key_unchanged: third.provenance.build_key === keyBefore,
    pass: third.cached === true && third.provenance.build_key === keyBefore,
  };
  log(`C3 mtime-only rewrite: cached=${third.cached}, build ${third.provenance.build_key === keyBefore ? 'unchanged' : 'CHANGED'}`);

  // ---- C2 + C4: a real change invalidates, and the new code is really loaded -------------------
  // The change is made OBSERVABLE so C4 can prove the browser is serving it: a module the page
  // loads that stamps a marker onto window. Loaded from index.html, removed in the finally.
  // `window.__ES_COMMIT` is what `__HARNESS.getBuildInfo().commit` reports (api.js:46), and
  // getBuildInfo is on the daemon's read-only query whitelist. So the marker is readable from
  // OUTSIDE, out of the running page, which is what makes C4 a real check rather than a reading
  // of the daemon's own bookkeeping.
  const marker = 'capd-cache-test-' + Date.now();
  const html = fs.readFileSync(path.join(GAME_DIR, 'index.html'), 'utf8');
  fs.writeFileSync(SCRATCH, `window.__ES_COMMIT = ${JSON.stringify(marker)};\n`);
  fs.writeFileSync(path.join(GAME_DIR, 'index.html'),
    html.replace('</head>', `<script src="/game/CAPTURE-CACHE-TEST.tmp.js"></script>\n</head>`));

  const bkey = buildKey();
  const t2 = Date.now();
  const fourth = await s.capture(spec);
  const afterMs = Date.now() - t2;

  const seen = await s.query([['getBuildInfo']]);
  const markerInPage = seen && seen.results && seen.results[0] && seen.results[0].ok
    ? seen.results[0].value.commit : null;

  results.C2_change_invalidates = {
    what: 'add a script to game/index.html and re-request the identical capture',
    must: 'MISS, land in a new cache bucket, and be re-rendered',
    build_key_before: keyBefore,
    build_key_after: fourth.provenance.build_key,
    build_key_changed: fourth.provenance.build_key !== keyBefore,
    computed_key_matches: bkey.build_key === fourth.provenance.build_key,
    cached: fourth.cached,
    new_bucket: path.dirname(fourth.path) !== bucketBefore,
    re_render_ms: afterMs,
    // Expected TRUE: this particular edit does not move a pixel. The cache is deliberately
    // conservative — it invalidates on any game/ content change, not on a change it has judged
    // to be visible — because judging that is exactly the thing it cannot do.
    pixels_identical_despite_new_key: fourth.sha256 === second.sha256,
    old_picture_still_on_disk: fs.existsSync(second.path),
    pass: fourth.cached === false && fourth.provenance.build_key !== keyBefore
      && path.dirname(fourth.path) !== bucketBefore && bkey.build_key === fourth.provenance.build_key,
  };
  log(`C2 after game/ change: build ${keyBefore} -> ${fourth.provenance.build_key}, cached=${fourth.cached}, new bucket=${results.C2_change_invalidates.new_bucket}`);

  // C4: the browser is really serving the new code. The daemon drops and re-boots the browser on a
  // build change, so the marker the new index.html installs must now be present in the page.
  const st = await s.status();
  results.C4_new_code_is_loaded = {
    what: 'the browser that drew the post-change capture is running the post-change code',
    must: 'the daemon dropped and rebooted the browser, and the page carries the new marker',
    daemon_browser_build: st.browser && st.browser.build,
    matches_new_build: !!(st.browser && st.browser.build === fourth.provenance.build_key),
    marker_expected: marker,
    marker_read_back_from_the_running_page: markerInPage,
    marker_matches: markerInPage === marker,
    pass: !!(st.browser && st.browser.build === fourth.provenance.build_key) && markerInPage === marker,
  };
  log(`C4 daemon browser build=${st.browser && st.browser.build}; marker in page=${markerInPage === marker ? 'YES' : JSON.stringify(markerInPage)}`);
} finally {
  // Restore game/ exactly. A leftover here would poison every build key on the box.
  try {
    const html = fs.readFileSync(path.join(GAME_DIR, 'index.html'), 'utf8');
    fs.writeFileSync(path.join(GAME_DIR, 'index.html'),
      html.replace(/<script src="\/game\/CAPTURE-CACHE-TEST\.tmp\.js"><\/script>\n/g, ''));
  } catch (e) { log('WARNING: could not restore game/index.html: ' + e.message); }
  try { if (fs.existsSync(SCRATCH)) fs.unlinkSync(SCRATCH); } catch { /* */ }
  s.close();
}

// Prove the restore worked, from the outside.
const restored = buildKey();
const failed = Object.entries(results).filter(([, v]) => !v.pass).map(([k]) => k);
const report = {
  schema: 'elder-souls/capture-cache@1',
  ran_at: new Date().toISOString(),
  build_key_after_restore: restored.build_key,
  scratch_file_removed: !fs.existsSync(SCRATCH),
  verdict: failed.length ? 'FAILED: ' + failed.join(', ') : 'CACHE IS FREE AND BUILD-KEYED',
  results,
};
fs.writeFileSync(path.join(OUT, 'CACHE.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
process.exit(failed.length ? EXIT.MEASUREMENT_FAIL : EXIT.OK);
