#!/usr/bin/env node
// blog-threads.mjs — which stories the blog has started and not finished.
//
// The owner's instruction: some posts must come back to defects earlier posts reported and show
// them fixed, with screenshot evidence. That only works if a writer can see, cheaply, which
// defects were told to the reader and which of those have since been repaired. Otherwise every
// writer reads the whole archive or, worse, writes a follow-up about something still broken.
//
// Sources, all already on disk and none of them needing a browser:
//   * docs/blog/COVERED.md      — one line per published post: what the reader was told
//   * reports/blog-feed.jsonl   — one line per finding, written by the agent that found it
//   * corpus/90-verdicts/**.json — scores over time, so a piece's direction is visible
//
// Usage:
//   node tools/blog-threads.mjs            # the report
//   node tools/blog-threads.mjs --json     # machine-readable
//   node tools/blog-threads.mjs --self-test
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...p) => join(ROOT, ...p);

/** A post's own record of what it told the reader. */
function covered() {
  const f = P('docs', 'blog', 'COVERED.md');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n')
    .map(l => l.replace(/^[-*]\s*/, '').trim())
    .filter(l => /^\d{4}-\d{2}-\d{2}-/.test(l))
    .map(l => {
      const i = l.indexOf(' ');
      const slug = i < 0 ? l : l.slice(0, i).replace(/[—–-]$/, '').trim();
      return { slug: slug.replace(/\s*[—–]\s*$/, ''), text: i < 0 ? '' : l.slice(i + 1).replace(/^[—–-]\s*/, '') };
    });
}

/** What builders and critics have banked since. */
function feed() {
  const f = P('reports', 'blog-feed.jsonl');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

/** Verdict scores, newest last, so a piece that has moved is visible. */
function verdicts() {
  const out = [];
  const walk = d => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'artifacts') walk(p); continue; }
      if (extname(p) !== '.json') continue;
      try {
        const v = JSON.parse(readFileSync(p, 'utf8'));
        const score = v.score?.overall_0_10 ?? v.score_0_10;
        const piece = String(v.piece_id || v.piece || '');
        if (piece && typeof score === 'number') {
          out.push({ piece: piece.toLowerCase().match(/^(w\d+-[a-z0-9]+)/)?.[1] || piece.toLowerCase(),
            score, at: Date.parse(v.critic?.finished_at || v.critic?.started_at || 0) || 0, file: basename(p) });
        }
      } catch { }
    }
  };
  walk(P('corpus', '90-verdicts'));
  return out.sort((a, b) => a.at - b.at);
}

/** Which piece a post or feed line is about, if it says. */
const pieceOf = s => (String(s).toLowerCase().match(/\bw1-[a-z0-9]+/) || [])[0] || null;

export function threads() {
  const posts = covered();
  const lines = feed();
  const vs = verdicts();

  // A post that reported a defect is a story. `kind: fix` lines and rising verdicts are endings.
  const told = posts.filter(p => /fail|broke|broken|no |never|nobody|cannot|could not|drop|lost|empt|underground|refus|zero|0 of|missing/i.test(p.text));
  const fixes = lines.filter(l => l.kind === 'fix');
  const followups = posts.filter(p => /again|now|since|fixed|closed|revisit/i.test(p.text));

  const byPiece = new Map();
  for (const v of vs) {
    if (!byPiece.has(v.piece)) byPiece.set(v.piece, []);
    byPiece.get(v.piece).push(v);
  }

  const rows = told.map(p => {
    const piece = pieceOf(p.slug) || pieceOf(p.text);
    const series = piece ? (byPiece.get(piece) || []) : [];
    const moved = series.length > 1 ? +(series[series.length - 1].score - series[0].score).toFixed(1) : null;
    const fix = fixes.filter(f => piece && String(f.piece || '').toLowerCase().includes(piece));
    return {
      slug: p.slug, piece, told: p.text.slice(0, 140),
      score_now: series.length ? series[series.length - 1].score : null,
      score_moved: moved,
      fixes_since: fix.map(f => f.headline).slice(0, 3),
      shots: fix.flatMap(f => f.shots || []).slice(0, 4),
      owed: fix.length > 0 || (moved != null && moved > 0),
    };
  });

  return { posts: posts.length, defect_posts: told.length, followups: followups.length, rows };
}

if (process.argv.includes('--self-test')) {
  // A report that cannot be wrong is not a report. These assert the shape rather than the content,
  // because the content is whatever the project happens to have done today.
  const t = threads();
  const checks = [
    ['reads COVERED.md', t.posts > 0],
    ['finds defect posts', t.defect_posts > 0],
    ['every row has a slug', t.rows.every(r => !!r.slug)],
    ['owed implies evidence', t.rows.every(r => !r.owed || r.fixes_since.length > 0 || r.score_moved > 0)],
  ];
  let bad = 0;
  for (const [name, ok] of checks) if (!ok) { console.error(`blog-threads --self-test: ${name} FAILED`); bad++; }
  console.log(`blog-threads --self-test: ${checks.length - bad}/${checks.length}`);
  process.exit(bad ? 1 : 0);
}

const t = threads();
if (process.argv.includes('--json')) { console.log(JSON.stringify(t, null, 2)); process.exit(0); }

console.log(`\n${t.posts} posts, ${t.defect_posts} of them reporting something broken, ${t.followups} reading as follow-ups.\n`);
const owed = t.rows.filter(r => r.owed);
const open = t.rows.filter(r => !r.owed);

console.log(`OWED AN ENDING — a defect the reader was told about, with a fix banked since (${owed.length}):\n`);
for (const r of owed) {
  console.log(`  ${r.slug}${r.piece ? `  [${r.piece}${r.score_now != null ? ` now ${r.score_now}/10` : ''}${r.score_moved ? `, moved ${r.score_moved > 0 ? '+' : ''}${r.score_moved}` : ''}]` : ''}`);
  console.log(`    told: ${r.told}`);
  for (const f of r.fixes_since) console.log(`    since: ${f}`);
  for (const s of r.shots) console.log(`    shot: ${s}`);
  console.log('');
}

console.log(`STILL OPEN — do not write a follow-up about these yet (${open.length}):\n`);
for (const r of open) console.log(`  ${r.slug}${r.piece ? `  [${r.piece}]` : ''}`);
console.log('');
