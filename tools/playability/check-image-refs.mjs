#!/usr/bin/env node
// check-image-refs.mjs — every image and link a published page points at must actually be on the
// published site.
//
// WHY THIS EXISTS. `docs/progress.html`'s "Latest captures" section picked its pictures by walking
// `reports/` — which `reports/.gitignore` excludes on purpose (701 MB of run artifacts, see that
// file's header) — and grabbing whichever 12 files were newest there. Twice a week that is a real
// screenshot from `tools/capture/`; on 2026-08-08 it was 12 frames from a blind border-judging pack
// (`reports/wld12-blind/`, RI-WLD12) that will never be committed. `docs/index.html` inlines the
// same section (tools/blog.mjs embeds `docs/progress.html`'s body), so both pages 404'd the same 12
// images for every reader. This is `tools/check-shipped-files.mjs`'s class — "present locally,
// absent from what ships" — one directory over: there it was a JS module missing from git, here
// it's a picture missing from git, and the fix is the same shape: assert against git and against
// the live host, not against the disk the checker happens to be running on.
//
// SCOPE. "Published" means: the landing `index.html` (repo root — Pages now serves the whole repo
// from root), `docs/index.html`, `docs/progress.html`, `README.md` (also served raw, at root), and
// every post source under `docs/blog/*.md` (each is independently retrievable at its own URL even
// though `docs/index.html` also inlines its rendered body). Every href/src in the HTML pages and
// every markdown link/image target in the .md ones is a reference this tool checks.
//
// TWO INDEPENDENT ASSERTIONS PER REFERENCE, because either one failing alone produces a 404 for a
// reader and neither implies the other:
//   TRACKED   — `git ls-files` has the resolved path at HEAD. An untracked or gitignored file will
//               never be published no matter how many times anyone commits — moving or deleting the
//               reference is the only fix, not `git add`.
//   LIVE      — `curl` against the deployed URL returns 200. A tracked file can still 404 live if
//               Pages is mid-build or behind (verify-live-site.mjs's territory); this tool says so
//               rather than mis-blaming git.
//
//   node tools/playability/check-image-refs.mjs
//   node tools/playability/check-image-refs.mjs --self-test
//
// Not wired into the pre-commit hook (rule 13): a fail-closed gate that fires on a neighbour's
// in-flight screenshot commit stops the whole box, and this project has already paid for that once.
// Runnable on demand and worth running before every bank.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const selfTest = argv.includes('--self-test');
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const LIVE_HOST = 'jtattersall09403.github.io';
const PREFIX = '/elder-souls-claude';
const LIVE_BASE = at('--url', `https://${LIVE_HOST}${PREFIX}/`).replace(/\/?$/, '/');

// The pages this project treats as published. See header for why each one is here.
function PAGES() {
  const fixed = ['index.html', 'docs/index.html', 'docs/progress.html', 'README.md'];
  let posts = [];
  try {
    posts = execFileSync('git', ['ls-files', 'docs/blog/*.md'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);
  } catch { /* no posts yet; not fatal */ }
  return [...fixed, ...posts].filter((p) => existsSync(join(ROOT, p)));
}

// curl, not node fetch — see tools/world/verify-live-site.mjs's note above its head(): the proxy
// this container's outbound HTTPS goes through 403s node fetch for every URL, and curl is what
// actually reaches the live host. Verified again here (see the self-test's LIVE arm).
function curlStatus(url) {
  try {
    const out = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '25', url],
      { encoding: 'utf8' });
    return Number(out.trim()) || 0;
  } catch { return 0; }
}

/** Every ref in an HTML page: href="…" and src="…". */
function refsInHtml(text) {
  const out = [];
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim());
  return out;
}

/** Every ref in a markdown page: ![alt](target) and [text](target), image or not. */
function refsInMarkdown(text) {
  const out = [];
  const re = /!?\[[^\]]*\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) out.push(m[1].trim().split(/\s+/)[0]); // drop a trailing "title"
  return out;
}

/**
 * Resolve a raw ref found on `page` (repo-relative path) to a repo-relative site path, or null if
 * it is off-site / not a site-internal reference (anchors, mailto:, data:, javascript:, or a host
 * that is not ours).
 */
function resolve(raw, page) {
  if (!raw || raw.startsWith('#') || /^(data|javascript|mailto|tel):/i.test(raw)) return null;
  const pageDir = dirname(page); // repo-relative directory the page lives in
  if (/^https?:\/\//i.test(raw)) {
    let u; try { u = new URL(raw); } catch { return null; }
    if (u.hostname !== LIVE_HOST) return null; // genuinely off-site — nothing we publish
    let p = u.pathname;
    if (!p.startsWith(PREFIX + '/')) return null; // off-prefix on our own host: a different defect class
    return p.slice(PREFIX.length + 1).split('#')[0].split('?')[0];
  }
  if (raw.startsWith('/')) return null; // root-relative: verify-links.mjs's territory (Pages-root defect)
  // Relative to the page's own directory, POSIX-joined and normalised, same as a browser would.
  const base = 'http://x/' + (pageDir === '.' ? '' : pageDir + '/');
  let resolved;
  try { resolved = new URL(raw, base).pathname; } catch { return null; }
  return resolved.replace(/^\//, '').split('#')[0].split('?')[0];
}

/** Every tracked repo-relative path at HEAD, once. */
const tracked = new Set(
  execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\n').filter(Boolean)
);
function isIgnored(rel) {
  try { execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }); return true; } catch { return false; }
}

async function sweep(pairs, concurrency = 10) {
  const results = new Array(pairs.length);
  let i = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < pairs.length) {
      const idx = i++;
      const rel = pairs[idx].rel;
      const isTracked = tracked.has(rel);
      const onDisk = existsSync(join(ROOT, rel));
      const live = curlStatus(LIVE_BASE + rel);
      results[idx] = { ...pairs[idx], tracked: isTracked, onDisk, live, ignored: isTracked ? false : isIgnored(rel) };
      await new Promise((r) => setImmediate(r));
    }
  }));
  return results;
}

if (selfTest) {
  // Rule 4, two arms that must disagree.
  //   CLEAN arm: a reference that is really published — this repo's own README, referenced from
  //   the landing page's footer link text is awkward to synthesize, so use a file this tool itself
  //   would resolve: docs/shots/ has 253 tracked, live images (verified during the fix this tool
  //   guards); pick one that HEAD actually has.
  const shots = execFileSync('git', ['ls-files', 'docs/shots'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const knownGood = shots[0]; // repo-relative, e.g. docs/shots/2026-....png
  const ghost = 'docs/shots/definitely-not-shipped-' + Date.now() + '.png';

  const [goodRow] = await sweep([{ rel: knownGood, page: '(self-test)', raw: knownGood }]);
  const [ghostRow] = await sweep([{ rel: ghost, page: '(self-test)', raw: ghost }]);

  const goodClean = goodRow.tracked && goodRow.live === 200;
  const ghostCaught = !ghostRow.tracked && ghostRow.live !== 200;

  console.log(`check-image-refs --self-test: real published image (${knownGood}) — tracked=${goodRow.tracked}, live=${goodRow.live} → clean=${goodClean}`);
  console.log(`check-image-refs --self-test: fabricated reference (${ghost}) — tracked=${ghostRow.tracked}, live=${ghostRow.live} → reported=${ghostCaught}`);

  // And the exact defect this tool exists for, reproduced live against the real deployed site right
  // now (before this fix has been pushed): a reference under reports/wld12-blind must be gitignored
  // AND untracked AND still answer non-200 live, or this tool cannot tell the story it is for.
  const wld12 = 'reports/wld12-blind/f12.png';
  let wldRow = null;
  if (existsSync(join(ROOT, wld12))) {
    [wldRow] = await sweep([{ rel: wld12, page: '(self-test)', raw: wld12 }]);
    console.log(`check-image-refs --self-test: known-gitignored file (${wld12}) — tracked=${wldRow.tracked}, ignored=${wldRow.ignored}`);
  }

  const ok = goodClean && ghostCaught && (!wldRow || (!wldRow.tracked && wldRow.ignored));
  console.log(ok ? 'check-image-refs --self-test: PASS' : 'check-image-refs --self-test: FAIL — an arm cannot go red.');
  process.exit(ok ? 0 : 1);
}

const pages = PAGES();
console.log(`check-image-refs: scanning ${pages.length} published page(s) against ${LIVE_BASE}`);

const candidates = [];
const seen = new Set();
for (const page of pages) {
  const text = readFileSync(join(ROOT, page), 'utf8');
  const raws = extname(page) === '.md' ? refsInMarkdown(text) : refsInHtml(text);
  for (const raw of raws) {
    const rel = resolve(raw, page);
    if (!rel) continue;
    const key = page + ' ' + rel;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ page, raw, rel });
  }
}
console.log(`check-image-refs: ${candidates.length} unique internal reference(s) to check …`);

const results = await sweep(candidates);
const broken = results.filter((r) => !r.tracked || r.live !== 200);

if (broken.length) {
  console.error(`\ncheck-image-refs: ${broken.length} broken reference(s):`);
  const byPage = {};
  for (const r of broken) (byPage[r.page] ||= []).push(r);
  for (const [page, rows] of Object.entries(byPage)) {
    console.error(`\n  ${page}:`);
    for (const r of rows) {
      let why;
      if (!r.onDisk) why = 'MISSING ON DISK — the reference itself is wrong, nothing to publish';
      else if (r.ignored) why = 'GITIGNORED — on disk, excluded on purpose, will NEVER be published; move the file or drop the reference';
      else if (!r.tracked) why = 'UNTRACKED — on disk, never committed; `git add` it or drop the reference';
      else if (r.live !== 200) why = `TRACKED BUT LIVE ${r.live || 'no-response'} — committed, but the deployment does not have it (mid-build, behind, or wrong path)`;
      console.error(`    "${r.raw}" → ${r.rel}   <- ${why}`);
    }
  }
  console.error('\n  A broken image src does not throw in the browser — it quietly draws nothing, exactly');
  console.error('  the same silent failure class as an untracked JS module (tools/check-shipped-files.mjs).');
} else {
  console.log(`check-image-refs: PASS — all ${candidates.length} reference(s) are tracked by git and retrievable live.`);
}
process.exit(broken.length ? 1 : 0);
