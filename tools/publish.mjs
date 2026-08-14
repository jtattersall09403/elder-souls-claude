#!/usr/bin/env node
// Regenerates the published site: build status + blog -> docs/index.html
// Wired into .githooks/pre-commit so the page never goes stale.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

// Refresh the cost ledger BEFORE the page that draws it, so the published cost figure is never
// more than one bank old (COST.md §6). cost-refresh.mjs runs the instrument with a timeout and
// always exits 0 — a cost report that stops the fleet has cost more than it saves (rule 13) — and
// publishes its own failure as a banner on the page rather than letting a stale number pass as
// current. Wrapped anyway: nothing about cost may break the site build.
try { process.stdout.write(execFileSync('node', [join(ROOT, 'tools/cost-refresh.mjs')], { cwd: ROOT }).toString()); }
catch (e) { console.error('publish: cost-refresh failed —', e.message, '(the page reports this itself; continuing)'); }

// The roadmap tracker. Refreshed BEFORE progress.mjs renders it, same reason as cost-refresh
// above — the published percentage must never be older than this bank. Unlike cost-refresh, a
// DRIFT between ROADMAP.md and orchestration/roadmap.json is a real defect (two sources of truth
// disagreeing silently is the exact thing this project keeps finding) and this DOES fail the
// build: printed loudly, exit code carried through. An UNVERIFIED step claim inside a clean,
// non-drifted roadmap.json is reported on the page itself (rule: print it loudly) but does not
// stop the commit — the tracker is meant to run constantly and a false "done" claim is everyone's
// problem to see, not a reason to block a neighbour's unrelated commit.
try {
  execFileSync('node', [join(ROOT, 'tools/roadmap.mjs')], { cwd: ROOT, stdio: 'inherit' });
} catch (e) {
  console.error('publish: tools/roadmap.mjs exited non-zero —', e.message);
  console.error('publish: this is either ROADMAP.md/roadmap.json drift or the tool itself erroring; run `node tools/roadmap.mjs` directly to see which.');
  process.exitCode = 1;
}

for (const t of ['tools/progress.mjs', 'tools/blog.mjs']) {
  try { process.stdout.write(execFileSync('node', [join(ROOT, t)], { cwd: ROOT }).toString()); }
  catch (e) { console.error(`publish: ${t} failed —`, e.message); process.exitCode = 1; }
}

// A verdict that no chart plots is a verdict the owner cannot see. The score charts used to
// `console.warn` about a piece they had no domain for and carry on, and for ids that did not
// match the pattern at all they said nothing — so seven verdicts sat on disk while the page's
// newest reading was five hours old. Silence is the defect; make it fail here.
try {
  const { collect } = await import('./scores.mjs');
  const { unmapped, rows } = collect();
  if (unmapped && unmapped.length) {
    console.error(`publish: ${unmapped.length} verdict(s) plot on no chart because their piece id maps to no domain:`);
    for (const p of [...new Set(unmapped)]) console.error(`  ${p}`);
    console.error('Add the piece to DOMAIN in tools/scores.mjs. Do not rename the verdict.');
    process.exitCode = 1;
  } else {
    console.log(`publish: ${rows.length} verdict(s), all plotted.`);
    // Name the verdicts sitting on an inferred time. `scores.mjs` falls back to the file's git-add
    // time so an unstamped verdict is no longer drawn at the start of the project, but a fallback
    // that works silently is a fallback nobody fixes: the third unstamped verdict landed nine
    // minutes after that one was written. Printing the names on every publish is the pressure.
    const noClock = rows.filter(r => r.inferred).map(r => r.piece);
    if (noClock.length) {
      console.log(`publish: ${noClock.length} verdict(s) stamped no critic.finished_at, so their dots sit on the commit time instead: ${[...new Set(noClock)].join(', ')}`);
    }
  }
} catch (e) { console.error('publish: score check failed —', e.message); process.exitCode = 1; }

// Every image the page references must exist under docs/, because that is all GitHub Pages
// serves. A writing agent that references a corpus/ path, or copies its image after writing
// the post, gets a broken image on a public page and no error anywhere — so check it here.
// Unrendered markdown on the published page. An image whose alt text was hard-wrapped used to
// come out as literal `![caption](../shots/x.png)` text in the middle of a post — visible to any
// reader and to nobody checking. If the renderer cannot parse something, that must be an error
// here rather than a paragraph of source code on a public page.
const pageForLint = join(ROOT, 'docs', 'index.html');
if (existsSync(pageForLint)) {
  const h = readFileSync(pageForLint, 'utf8');
  const raw = [...h.matchAll(/!\[[^\]]*\]\([^)]*\)/g)].map(m => m[0]);
  if (raw.length) {
    console.error(`publish: ${raw.length} unrendered image tag(s) reached docs/index.html:`);
    for (const r of raw.slice(0, 5)) console.error(`  ${r.replace(/\s+/g, ' ').slice(0, 120)}`);
    console.error('The markdown renderer did not parse these. Fix tools/blog.mjs — do not reword the post.');
    process.exitCode = 1;
  }
}

// How many verdicts are still standing on the code at HEAD, reported as a NUMBER — never a gate.
// The precedent is tools/check-quests.mjs's own header comment: content checks used to throw
// from inside the engine constructor, so ANY agent's dangling reference took down every OTHER
// agent's measurement, on content none of them touched. Staleness has the identical shape: on
// any given day some other piece's commit will invalidate somebody's verdict, and if that failed
// `publish` for everybody, a dozen concurrent agents would spend their round fighting a check
// that is honestly reporting a fact about a piece they do not own. So this never sets
// process.exitCode — a stale verdict is not wrong and is not downgraded, it is information for
// whoever dispatches the next round (see tools/verdict-staleness.mjs's own header).
try {
  const { computeReport, discoverVerdicts } = await import('./verdict-staleness.mjs');
  const { summary } = computeReport(discoverVerdicts());
  console.log(`publish: verdict-staleness — ${summary.fresh}/${summary.total} fresh, ${summary.stale}/${summary.total} stale, ${summary.unknown}/${summary.total} unknown (reported only; not a gate — run \`node tools/verdict-staleness.mjs\` for the detail).`);
} catch (e) {
  console.error('publish: verdict-staleness could not run —', e.message, '(reported only; not a gate, so this does not fail the build).');
}

const page = join(ROOT, 'docs', 'index.html');
if (existsSync(page)) {
  const html = readFileSync(page, 'utf8');
  const missing = [...new Set([...html.matchAll(/<img [^>]*src="([^"]+)"/g)].map(m => m[1]))]
    .filter(s => !/^https?:/.test(s) && !existsSync(join(ROOT, 'docs', s)));
  if (missing.length) {
    console.error(`publish: ${missing.length} image(s) referenced by docs/index.html do not exist under docs/:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exitCode = 1;
  }
}
