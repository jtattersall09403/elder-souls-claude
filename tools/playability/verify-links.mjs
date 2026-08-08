#!/usr/bin/env node
// verify-links.mjs — do the OTHER two links work, and does every link inside them resolve?
//
// WHY. GitHub Pages was switched to publish this repository from its root. That changed the
// meaning of every relative path on the site at once: a page that used to sit at `/docs/` now
// sits at `/elder-souls-claude/docs/`, and an href written as `/game/index.html` — which was
// right before — now points at a path that does not exist. Nothing in the repo would notice.
// A 404 on the blog is not a black screen, but it is the owner clicking a link and getting
// nothing, which is the same experience.
//
// It walks the three owner-facing entry points, extracts every href/src that stays on the site,
// resolves it the way a browser would, and fetches it. Off-site links are reported, not fetched.
//
//   node tools/playability/verify-links.mjs
//   node tools/playability/verify-links.mjs --local        # the working tree, same path shape
//   node tools/playability/verify-links.mjs --self-test    # rule 4
//   node tools/playability/verify-links.mjs --json reports/playability/links.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fetchLive, OWNER_LINKS, LIVE_BASE } from './live-mirror.mjs';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const argv = process.argv.slice(2);
const at = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const LOCAL = argv.includes('--local');
const SELF_TEST = argv.includes('--self-test');
const PREFIX = '/elder-souls-claude';

/**
 * Fetch a site path either from the live host or from the working tree at the same path shape.
 *
 * RETRIES ON 5xx, AND ONLY ON 5xx. A sweep of a hundred paths makes Pages' CDN answer the odd
 * 503, and the first run of this tool reported a picture that is demonstrably there as a broken
 * link because of one. A checker that cries wolf gets ignored, which costs more than the check is
 * worth. A 404 is never retried — it is an answer, not a hiccup.
 */
async function get(p) {
  if (!LOCAL) {
    let r = await fetchLive(p);
    for (let i = 0; r.status >= 500 && i < 2; i++) {
      await new Promise((s) => setTimeout(s, 800 * (i + 1)));
      r = await fetchLive(p);
    }
    return { status: r.status, body: r.body.toString('utf8'), bytes: r.body.length };
  }
  let rel = p.startsWith(PREFIX) ? p.slice(PREFIX.length) : p;
  rel = rel.split('#')[0].split('?')[0];
  if (rel.endsWith('/') || rel === '') rel += 'index.html';
  const f = path.join(ROOT, decodeURIComponent(rel));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return { status: 404, body: '', bytes: 0 };
  const b = fs.readFileSync(f);
  // A FILE ON THIS DISK IS NOT A FILE ON THE SITE. Run live, this tool finds twelve images the
  // blog embeds that 404 for every visitor; run locally on the same tree it finds nothing, because
  // the files are all there — they have simply never been committed, so Pages has never had them.
  // That is precisely how `game/src/input/hold-gate.js` reached the owner as a black screen: every
  // check on the build machine passed and the deployed module graph 404'd in silence. A local
  // check that cannot see it is a local check that will let it happen again, so: untracked is a
  // 404 here, with its own status so the message can say which kind of missing it is.
  const relNoSlash = rel.replace(/^\//, '');
  if (tracked && !tracked.has(relNoSlash)) {
    // IGNORED IS NOT THE SAME AS FORGOTTEN, and the fix is completely different. A file somebody
    // has not committed yet gets committed. A file inside a deliberately-ignored directory will
    // NEVER be published no matter how many times anyone commits, so a page that links to it is
    // structurally broken and has to link somewhere else. `reports/.gitignore` excludes every
    // artifact on purpose — they are large and reproducible — and the blog embeds twelve images
    // from under it.
    let ignored = false;
    try { execFileSync('git', ['check-ignore', '-q', relNoSlash], { cwd: ROOT }); ignored = true; } catch { ignored = false; }
    return { status: ignored ? 'gitignored' : 'untracked', body: b.toString('utf8'), bytes: b.length };
  }
  return { status: 200, body: b.toString('utf8'), bytes: b.length };
}

/** Everything git knows about, repo-relative. Null when git is unavailable (then we cannot tell). */
const tracked = (() => {
  if (!LOCAL) return null;
  try {
    return new Set(execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\n').filter(Boolean));
  } catch { return null; }
})();

/** Every href/src in the document, resolved against the page's own URL, as a browser would. */
function linksIn(html, pageUrl) {
  const out = [];
  const re = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('#') || /^(data|javascript|mailto|tel):/i.test(raw)) continue;
    if (/^https?:\/\//i.test(raw)) {
      out.push({ raw, offsite: !raw.startsWith(LIVE_BASE), resolved: raw.startsWith(LIVE_BASE) ? raw.slice(LIVE_BASE.length) : raw });
      continue;
    }
    // Resolve exactly as the browser does, relative to the PAGE's directory.
    const base = 'http://x' + pageUrl;
    let resolved;
    try { resolved = new URL(raw, base).pathname + (new URL(raw, base).search || ''); } catch { continue; }
    out.push({ raw, offsite: false, resolved });
  }
  return out;
}

async function walk(entryName, entryPath) {
  const page = await get(entryPath);
  const rec = { entry: entryName, path: entryPath, status: page.status, bytes: page.bytes, links: [], broken: [], offsite: [] };
  if (page.status !== 200) { rec.broken.push(`${page.status} ${entryPath} (the entry point itself)`); return rec; }
  rec.bytes = page.bytes;
  const seen = new Set();
  for (const l of linksIn(page.body, entryPath)) {
    if (l.offsite) { if (!rec.offsite.includes(l.raw)) rec.offsite.push(l.raw); continue; }
    if (seen.has(l.resolved)) continue;
    seen.add(l.resolved);
    // A path that does not start with the Pages prefix cannot exist on this site at all. Say so
    // without a round trip, and say WHY, because "root-relative href after a root-publish switch"
    // is the exact defect class the Pages change created.
    if (!l.resolved.startsWith(PREFIX + '/') && l.resolved !== PREFIX) {
      rec.broken.push(`off-prefix "${l.raw}" → ${l.resolved} (root-relative; the site lives under ${PREFIX}/)`);
      rec.links.push({ ...l, status: 'off-prefix' });
      continue;
    }
    const r = await get(l.resolved);
    rec.links.push({ ...l, status: r.status, bytes: r.bytes });
    if (r.status === 'gitignored') rec.broken.push(`GITIGNORED "${l.raw}" → ${l.resolved} — on this disk, and inside a directory git is told to ignore, so NO commit will ever publish it. The page has to link somewhere tracked (docs/) or not link at all.`);
    else if (r.status === 'untracked') rec.broken.push(`UNTRACKED IN GIT "${l.raw}" → ${l.resolved} (on this disk, never committed, so the live site has never had it)`);
    else if (r.status !== 200) rec.broken.push(`${r.status} "${l.raw}" → ${l.resolved}`);
  }
  return rec;
}

if (SELF_TEST) {
  // Rule 4, two arms that must disagree. A link checker that fetches nothing reports zero broken
  // links on a site that is entirely broken, and looks identical to a clean pass.
  const good = linksIn('<a href="docs/index.html">x</a>', '/elder-souls-claude/');
  const bad = await get('/elder-souls-claude/definitely-not-here-' + Date.now() + '.html');
  const real = await get(OWNER_LINKS.landing);
  const rootRel = linksIn('<a href="/game/index.html">x</a>', '/elder-souls-claude/docs/index.html');
  const okResolve = good[0].resolved === '/elder-souls-claude/docs/index.html';
  const okRootRel = rootRel[0].resolved === '/game/index.html';    // must be SEEN as off-prefix
  console.log(`verify-links --self-test: relative resolve = ${okResolve} (${good[0].resolved})`);
  console.log(`verify-links --self-test: root-relative href resolves off-prefix = ${okRootRel} (${rootRel[0].resolved})`);
  console.log(`verify-links --self-test: absent path = ${bad.status}, real path = ${real.status}`);
  const ok = okResolve && okRootRel && bad.status === 404 && real.status === 200;
  console.log(ok ? 'verify-links --self-test: PASS' : 'verify-links --self-test: FAIL');
  process.exit(ok ? 0 : 1);
}

console.log(`verify-links: ${LOCAL ? 'LOCAL working tree' : LIVE_BASE} (path shape ${PREFIX}/…)`);
const out = { source: LOCAL ? 'local' : LIVE_BASE, when: new Date().toISOString(), entries: [] };
let broken = 0;
for (const [name, p] of Object.entries(OWNER_LINKS)) {
  const rec = await walk(name, p);
  out.entries.push(rec);
  broken += rec.broken.length;
  console.log(`  ${rec.broken.length ? 'BROKEN' : 'OK    '}  ${name.padEnd(8)} ${rec.status} ${String(rec.bytes).padStart(7)} b  ${rec.links.length} internal link(s), ${rec.offsite.length} off-site`);
  for (const b of rec.broken.slice(0, 12)) console.log(`          ! ${b}`);
  if (rec.broken.length > 12) console.log(`          ! … and ${rec.broken.length - 12} more`);
}
const JSON_OUT = at('--json', null);
if (JSON_OUT) { fs.mkdirSync(path.dirname(path.join(ROOT, JSON_OUT)), { recursive: true });
                fs.writeFileSync(path.join(ROOT, JSON_OUT), JSON.stringify(out, null, 2));
                console.log(`  wrote ${JSON_OUT}`); }
console.log(broken ? `verify-links: FAIL — ${broken} broken link(s).` : 'verify-links: PASS — every internal link resolves.');
process.exit(broken ? 1 : 0);
