#!/usr/bin/env node
// Renders docs/index.html — a two-tab page (Progress | Blog) served by GitHub Pages from /docs.
// Progress numbers come from docs/status.json (written by tools/progress.mjs).
// Blog posts are markdown files in docs/blog/ with YAML-ish front matter.
// Run: node tools/progress.mjs && node tools/blog.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...a) => join(ROOT, ...a);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- tiny markdown ----------
// Image markdown whose alt text is hard-wrapped spans several source lines, and everything below
// works a line at a time — so `![a long caption\nthat wrapped](../shots/x.png)` matched nothing and
// was published as literal text. The brief *tells* writers to hard-wrap, so this is the renderer's
// bug and not theirs. Join any `![…](…)` back onto one line before parsing, leaving fenced code
// alone so a literal example still shows as written.
function joinWrappedImages(src) {
  const out = [];
  const lines = src.split('\n');
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('```')) { fence = !fence; out.push(l); continue; }
    if (fence || !l.includes('![')) { out.push(l); continue; }
    let joined = l;
    // Keep pulling in lines until the construct closes: an alt that never hit `]`, or a `](` whose
    // parenthesis is still open. A run-on with no terminator stops at a blank line rather than
    // swallowing the rest of the post.
    while (i + 1 < lines.length
      && (/!\[[^\]]*$/.test(joined) || /!\[[^\]]*\]\([^)]*$/.test(joined))
      && lines[i + 1].trim() !== '') {
      joined += ' ' + lines[++i].trim();
    }
    out.push(joined);
  }
  return out.join('\n');
}

// ---------- GFM tables ----------
// Split a `| a | b\|c | `d|e` |` row into cells on UNESCAPED pipes only. Two kinds of pipe must
// survive a naive split-on-'|': one inside a backtick code span (GFM never treats that as a
// separator, same as a code span protects it from every other inline construct) and one written
// `\|` on purpose. Both are unescaped back to a literal `|` here, before `inline()` ever runs, so
// a cell's markdown formatting is applied to the whole cell text exactly like any other inline
// content — this is also why a pipe inside a code span must NOT be split on: doing it naively
// (as a bare `.split('|')`) silently cuts a table cell in half without any error, which is exactly
// the class of defect this file is being fixed for, not just the missing table itself.
function splitTableRow(line) {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) {
    // don't strip a trailing pipe that is itself escaped, e.g. `...cell\|`
    let bs = 0;
    for (let i = l.length - 2; i >= 0 && l[i] === '\\'; i--) bs++;
    if (bs % 2 === 0) l = l.slice(0, -1);
  }
  const cells = [];
  let cur = '', inCode = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '\\' && l[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '`') { inCode = !inCode; cur += c; continue; }
    if (c === '|' && !inCode) { cells.push(cur); cur = ''; continue; }
    cur += c;
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}
// A delimiter row is what makes the line above it a header, not a paragraph that happens to
// contain a pipe: GFM requires every cell to be dashes only, optionally colon-flanked for
// alignment (`---`, `:---`, `---:`, `:---:`). Anything else and the whole block is not a table.
function isDelimiterRow(line) {
  const l = line.trim();
  if (!/\|/.test(l)) return false;
  const cells = splitTableRow(l);
  return cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c));
}
function cellAlign(delim) {
  const l = delim.startsWith(':'), r = delim.endsWith(':');
  return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
}
// `inline` is passed in rather than closed over: it is `md()`'s local formatter (bold/italic/
// code/links), and a table cell gets exactly the same inline treatment as any other line.
function renderTable(header, aligns, rows, inline) {
  const attr = i => aligns[i] ? ` style="text-align:${aligns[i]}"` : '';
  let h = '<div class="tblwrap"><table><thead><tr>'
    + header.map((c, i) => `<th${attr(i)}>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
  for (const r of rows) {
    h += '<tr>' + header.map((_, i) => `<td${attr(i)}>${inline(r[i] ?? '')}</td>`).join('') + '</tr>';
  }
  return h + '</tbody></table></div>\n';
}

function md(src) {
  const lines = joinWrappedImages(src).split('\n');
  let out = '', inCode = false, inList = false, inQuote = false;
  let para = [], quote = [];
  const flushPara = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
      `<figure><img src="${src.replace(/^\.\.\//, '')}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  // List items are buffered so that hard-wrapped continuation lines (indented under a bullet)
  // join into the same <li> instead of falling out of the list as stray paragraphs.
  let liBuf = null;
  const flushLi = () => { if (liBuf) { out += `<li>${inline(liBuf.join(' '))}</li>\n`; liBuf = null; } };
  const closeList = () => { flushLi(); if (inList) { out += '</ul>\n'; inList = false; } };
  const flushQuote = () => { if (quote.length) { out += `<p>${inline(quote.join(' '))}</p>\n`; quote = []; } };
  const closeQuote = () => { if (inQuote) { flushQuote(); out += '</blockquote>\n'; inQuote = false; } };
  // ::: compare blocks — a labelled side-by-side row of images with one shared caption.
  // Used for critic comparisons (ours vs the reference it lost to), before/after fixes, and
  // region contrast sets. Any number of images; two or three read best.
  //   :::compare Optional caption, may wrap over several lines
  //   ![Ours — Lilmoth, 14:00](../shots/x.png)
  //   ![Reference — RI-VIS03](../shots/ref-x.jpg)
  //   :::
  let cmp = null;
  const flushCmp = () => {
    if (!cmp) return;
    const n = Math.max(1, cmp.items.length);
    out += `<figure class="cmp"><div class="cmp-row" style="grid-template-columns:repeat(${n},minmax(0,1fr))">`
      + cmp.items.map(i => `<a class="cmp-cell" href="${i.src}" target="_blank" rel="noopener">`
        + `<img src="${i.src}" alt="${esc(i.label)}" loading="lazy"><span>${inline(i.label)}</span></a>`).join('')
      + `</div>${cmp.caption ? `<figcaption>${inline(cmp.caption)}</figcaption>` : ''}</figure>\n`;
    cmp = null;
  };
  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const l = raw.trimEnd();
    if (l.startsWith('```')) { flushPara(); flushCmp(); inCode = !inCode; out += inCode ? '<pre><code>' : '</code></pre>\n'; continue; }
    if (inCode) { out += esc(raw) + '\n'; continue; }
    if (/^:::compare\b/.test(l)) { flushPara(); closeList(); closeQuote(); flushCmp(); cmp = { caption: l.replace(/^:::compare\s*/, '').trim(), items: [] }; continue; }
    if (cmp) {
      if (/^:::\s*$/.test(l)) { flushCmp(); continue; }
      const im = l.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
      if (im) cmp.items.push({ label: im[1], src: im[2].replace(/^\.\.\//, '') });
      else if (l.trim()) cmp.caption += (cmp.caption ? ' ' : '') + l.trim();
      continue;
    }
    if (/^\s*$/.test(l)) { flushPara(); closeList(); closeQuote(); continue; }
    // A GFM table: this line has a pipe and the very next line is nothing but dashes/colons in
    // pipe-separated cells. That second line is the only thing that tells a table apart from an
    // ordinary sentence that happens to contain a `|` — so a table is never recognised on a line
    // by itself, only on a header line whose successor proves it.
    if (l.trim() !== '' && /\|/.test(l) && li + 1 < lines.length && isDelimiterRow(lines[li + 1])) {
      flushPara(); closeList(); closeQuote(); flushCmp();
      const header = splitTableRow(l);
      const aligns = splitTableRow(lines[li + 1]).map(cellAlign);
      li++; // consume the delimiter row
      const rows = [];
      while (li + 1 < lines.length && lines[li + 1].trim() !== '' && /\|/.test(lines[li + 1])) {
        li++;
        rows.push(splitTableRow(lines[li]));
      }
      out += renderTable(header, aligns, rows, inline);
      continue;
    }
    // Blockquotes are buffered exactly like paragraphs. They used to emit one <p> per source
    // line, which broke twice over on a hard-wrapped quote: the reader got a paragraph per line,
    // and any *emphasis* spanning a line break published as literal asterisks, because the
    // opening and closing markers were never in the same string to match. Both symptoms, one
    // cause. A blank line ends the quote, as it always did.
    if (l.startsWith('>')) {
      flushPara();
      if (!inQuote) { out += '<blockquote>\n'; inQuote = true; }
      quote.push(l.replace(/^>\s?/, ''));
      continue;
    }
    closeQuote();
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); closeList(); out += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>\n`; continue; }
    if (/^[-*]\s+/.test(l)) { flushPara(); flushLi(); if (!inList) { out += '<ul>\n'; inList = true; } liBuf = [l.replace(/^[-*]\s+/, '')]; continue; }
    // indented continuation of the bullet above — same <li>, not a new paragraph
    if (inList && liBuf && /^\s+\S/.test(l)) { liBuf.push(l.trim()); continue; }
    closeList();
    // an image on its own line becomes a figure, not a paragraph
    if (/^!\[/.test(l)) { flushPara(); out += inline(l) + '\n'; continue; }
    // Accumulate consecutive prose lines into ONE paragraph. Source markdown is hard-wrapped
    // for readability; without this every wrapped line became its own <p>, which put line
    // breaks in the middle of sentences on the rendered page.
    para.push(l);
  }
  flushPara(); closeList(); closeQuote(); flushCmp();
  return out;
}

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return [{}, text];
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return [fm, text.slice(m[0].length)];
}

// ---------- when was this published? ----------
// Posts used to carry a date and nothing else, so several posts written hours apart on the same
// day sorted arbitrarily against each other and the reader could not tell what came after what.
// Order of preference, most trustworthy first:
//   1. `time:` in the front matter (the writer says so)
//   2. a `date:` that already carries a time
//   3. the commit that first added the file — when it actually went out
//   4. the file's mtime, which is only a guess because editing a post moves it
const addedAt = new Map();
try {
  const log = execFileSync('git', ['log', '--diff-filter=A', '--format=%x00%aI', '--name-only', '--', 'docs/blog'],
    { cwd: ROOT, encoding: 'utf8' });
  for (const chunk of log.split('\0').slice(1)) {
    const lines = chunk.split('\n').filter(Boolean);
    const when = lines.shift();
    // git lists newest first, so the FIRST time we see a file is its latest add; keep walking so
    // the oldest add wins — a file deleted and restored should keep its original publication.
    for (const path of lines) addedAt.set(basename(path, '.md'), when);
  }
} catch { /* no git, or a fresh checkout — fall through to mtime */ }

function publishedAt(slug, fm, file) {
  const day = fm.date || slug.slice(0, 10);
  if (fm.time) return `${day}T${String(fm.time).trim()}`;
  if (/\d\d:\d\d/.test(String(fm.date || ''))) return String(fm.date);
  if (addedAt.has(slug)) return addedAt.get(slug);
  try { return new Date(statSync(file).mtime).toISOString(); } catch { return `${day}T00:00:00Z`; }
}

/** "2026-08-07 13:42" — the day, and enough of the clock to order a busy one. */
function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso).slice(0, 10);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// ---------- leaked/mangled markdown detector ----------
// The renderer's actual defect was never "no tables" by itself — it was that an unsupported (or
// half-supported) construct reaches the published page with no signal that anything went wrong.
// A dropped table is at least visible as a wall of pipes; a MANGLED one — or a footnote marker, or
// an <img> whose src swallowed its own title attribute, or a link whose URL lost its closing paren
// — reads as normal prose to anyone who isn't diffing against the source. This scans rendered HTML
// for the signatures of each known gap so a run can say so, instead of staying quiet. It is run
// against every post during a normal build (a warning, not a failure — rule 13: this file is a
// generator, not a fail-closed check) and against fixed fixtures by --self-test (an assertion).
function stripPre(html) { return html.replace(/<pre>[\s\S]*?<\/pre>/g, ''); }
function detectMarkdownLeakage(html) {
  const scan = stripPre(html);
  const found = [];
  // a paragraph carrying two-or-more literal pipes is what an unparsed table row looks like once
  // it falls through to plain text — this is the regression guard for the exact original bug.
  for (const m of scan.match(/<p>[^<]*\|[^<]*\|[^<]*<\/p>/g) || [])
    found.push({ kind: 'table-leak', snippet: m.slice(0, 140) });
  // footnote syntax (`[^id]`) has no handler at all; it passes through as literal brackets.
  for (const m of scan.match(/\[\^[^\]\s]+\]/g) || [])
    found.push({ kind: 'footnote-marker', snippet: m });
  // `![alt](src "title")` — the image regex's `[^)]+` swallows the quoted title into `src`, which
  // `esc()` then turns into a literal `&quot;` sitting inside the attribute value.
  for (const m of scan.match(/<img[^>]*&quot;[^>]*>/g) || [])
    found.push({ kind: 'mangled-image-title', snippet: m.slice(0, 140) });
  // `[text](http://x/a(b))` — the link regex's `[^)]+` stops at the URL's own first `)`, so the
  // rendered link's href is truncated and the source's closing paren is stranded right after </a>.
  for (const m of scan.match(/<\/a>\)/g) || [])
    found.push({ kind: 'broken-link-parens', snippet: m });
  return found;
}

// ---------- gather ----------
function build() {
const posts = [];
if (existsSync(P('docs', 'blog'))) {
  for (const f of readdirSync(P('docs', 'blog')).filter(f => f.endsWith('.md'))) {
    const [fm, body] = frontMatter(readFileSync(P('docs', 'blog', f), 'utf8'));
    // A post is a file with front matter. Bookkeeping that lives alongside the posts —
    // COVERED.md, notes, anything a writing agent leaves behind — has none, and was
    // otherwise being published verbatim as a post of its own.
    if (!fm.title) continue;
    const slug = basename(f, '.md');
    const at = publishedAt(slug, fm, P('docs', 'blog', f));
    posts.push({
      slug,
      title: fm.title || slug,
      date: stamp(at),
      at,
      summary: fm.summary || '',
      html: md(body),
    });
  }
}
// Newest first, to the minute. Ties break on slug so the order is stable between runs.
posts.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || a.slug.localeCompare(b.slug));

let st = {};
try { st = JSON.parse(readFileSync(P('docs', 'status.json'), 'utf8')); } catch { }

let progressBody = '';
try {
  const ph = readFileSync(P('docs', 'progress.html'), 'utf8');
  const m = ph.match(/<body>([\s\S]*)<\/body>/i);
  progressBody = m ? m[1] : '';
  progressBody = progressBody.replace(/<header>[\s\S]*?<\/header>/i, '');
} catch { }

const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + 'Z';

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Elder Souls — Argonia</title>
<meta name="description" content="Building a browser game: Morrowind's world, Dark Souls' combat, set in Black Marsh.">
<style>
:root{--bg:#12100d;--panel:#1b1813;--ink:#e8ddc8;--dim:#9a8f79;--line:#332d24;--gold:#c8a253;--green:#7d9a5a;--red:#b4553f;--blue:#5f7f96}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 ui-monospace,"SF Mono",Menlo,monospace}
header{padding:24px 28px 0;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#1e1a14,#141109)}
h1{margin:0;font-size:21px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:600}
.sub{color:var(--dim);font-size:12px;margin-top:6px}
nav{margin-top:18px;display:flex;gap:2px}
nav button{background:none;border:1px solid var(--line);border-bottom:none;color:var(--dim);font:inherit;font-size:12px;
 letter-spacing:.12em;text-transform:uppercase;padding:9px 20px;cursor:pointer;border-radius:5px 5px 0 0}
nav button[aria-selected=true]{background:var(--bg);color:var(--gold);border-color:var(--line)}
.wrap{padding:24px 28px;max-width:1500px}
.post{max-width:760px;margin:0 auto 64px;border-bottom:1px solid var(--line);padding-bottom:44px}
.post:last-child{border-bottom:none}
.post h2{font-size:25px;color:var(--gold);letter-spacing:0;text-transform:none;border:none;margin:0 0 6px;line-height:1.25}
.post .meta{color:var(--dim);font-size:12px;margin-bottom:26px}
.post h3{font-size:17px;color:var(--ink);margin:34px 0 10px;letter-spacing:0;text-transform:none;border:none}
.post p{margin:0 0 16px}
.post ul{margin:0 0 16px;padding-left:20px}.post li{margin-bottom:8px}
.post blockquote{margin:22px 0;padding:14px 20px;border-left:3px solid var(--gold);background:var(--panel);color:var(--ink)}
.post blockquote p{margin:0}
.post figure{margin:26px 0;background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.post figure img{width:100%;display:block}
.post figcaption{font-size:11px;color:var(--dim);padding:9px 12px}
.post figure.cmp{background:none;border:none;border-radius:0;margin:26px 0}
.cmp-row{display:grid;gap:8px}
.cmp-cell{display:block;background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden;text-decoration:none}
/* contain, not cover: comparison images come in whatever aspect the source game shipped
   (a 320x320 reference next to a 1920x1080 capture), and cropping one to match the other
   would quietly remove the part being compared. Letterboxing is the honest option. */
.cmp-cell img{width:100%;display:block;aspect-ratio:16/9;object-fit:contain;background:#0d0b09}
.cmp-cell span{display:block;font-size:11px;color:var(--dim);padding:7px 10px;line-height:1.45}
.cmp-cell:hover{border-color:var(--gold)}
.post figure.cmp figcaption{padding:10px 2px 0;font-size:11.5px;line-height:1.6}
@media(max-width:560px){.cmp-row{grid-template-columns:1fr !important}}
.post code{color:var(--blue);font-size:13px}
.post strong{color:#fff}
/* Wide tables (many columns, long inline-code cells) scroll inside their own box on a phone
   instead of pushing the whole page sideways — the wrapper is the scroll container, never body. */
.post .tblwrap{overflow-x:auto;margin:22px 0;-webkit-overflow-scrolling:touch}
.post .tblwrap table{margin:0;width:100%}
.post .tblwrap code{white-space:nowrap}
h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:8px;margin:30px 0 14px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;color:var(--dim);font-weight:500;padding:6px 10px;border-bottom:1px solid var(--line);text-transform:uppercase;font-size:10px;letter-spacing:.08em}
td{padding:6px 10px;border-bottom:1px solid #241f19;vertical-align:top}
tr:hover td{background:#191510}
.tag{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;border:1px solid var(--line);color:var(--dim)}
.souls{color:#d08b6a;border-color:#5c3a2c}.morrowind{color:#9fb87a;border-color:#42502f}
.modern-fidelity{color:#7fa8c4;border-color:#33505f}.neutral,.dimtext{color:var(--dim)}
.ok{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--gold)}
.empty{color:var(--dim);font-style:italic;padding:14px 0}
.bar{height:5px;background:#241f19;border-radius:3px;overflow:hidden;margin-top:8px}.bar>i{display:block;height:100%;background:var(--gold)}
code{color:var(--blue);font-size:11px}.gapq{color:var(--ink)}.rem{color:var(--dim);font-size:11px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:26px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px}
.card .n{font-size:26px;color:var(--gold);font-weight:600;line-height:1.1}
.card .l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:6px}
.gate{border-radius:6px;padding:18px 20px;margin-bottom:8px;border:1px solid var(--line);background:var(--panel)}
.gate-bad{border-color:#6b2f22;background:linear-gradient(180deg,#241512,#1b1813)}
.gate-ok{border-color:#3f5230;background:linear-gradient(180deg,#161d12,#1b1813)}
.verdict{font-size:30px;font-weight:700;letter-spacing:.1em;line-height:1}
.gate-bad .verdict{color:var(--red)}.gate-ok .verdict{color:var(--green)}
.gsub{color:var(--dim);font-size:12px;margin-top:10px;line-height:1.7}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.shots figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.shots img{width:100%;display:block}.shots figcaption{font-size:10px;color:var(--dim);padding:6px 8px;word-break:break-all}
footer{color:var(--dim);font-size:11px;padding:24px 28px;border-top:1px solid var(--line);margin-top:30px}
@media(max-width:640px){.wrap{padding:18px 14px}.post h2{font-size:21px}}
</style></head><body>
<header>
  <h1>Elder Souls &mdash; Argonia</h1>
  <div class="sub">A browser game: Morrowind's world, Dark Souls' combat, in Black Marsh &middot; updated ${esc(now)}</div>
  <nav role="tablist">
    <button role="tab" id="t-blog" aria-selected="true" aria-controls="p-blog">Blog</button>
    <button role="tab" id="t-prog" aria-selected="false" aria-controls="p-prog">Build status</button>
  </nav>
</header>

<section id="p-blog" role="tabpanel"><div class="wrap">
${posts.length ? posts.map(p => `<article class="post" id="${esc(p.slug)}">
  <h2>${esc(p.title)}</h2>
  <div class="meta">${esc(p.date)}${p.summary ? ' &middot; ' + esc(p.summary) : ''}</div>
  ${p.html}
</article>`).join('\n') : '<p class="empty">No posts yet.</p>'}
</div></section>

<section id="p-prog" role="tabpanel" hidden><div class="wrap">
${progressBody || '<p class="empty">Run <code>node tools/progress.mjs</code> to generate the build status.</p>'}
</div></section>

<footer>
Inside the fight, Souls wins &mdash; frames, stamina, hitboxes, animation, enemy behaviour.<br>
Everywhere else, Morrowind wins &mdash; progression, faction gating, dialogue, journal, world structure.<br>
Art direction is judged against Morrowind. Visual fidelity is judged against current-generation games, never against 2002.
</footer>

<script>
const tabs=[['t-blog','p-blog'],['t-prog','p-prog']];
function show(id){for(const [t,p] of tabs){const on=t===id;
  document.getElementById(t).setAttribute('aria-selected',on);document.getElementById(p).hidden=!on;}
  history.replaceState(null,'',id==='t-prog'?'#status':'#blog');}
for(const [t] of tabs)document.getElementById(t).onclick=()=>show(t);
if(location.hash==='#status')show('t-prog');
</script>
</body></html>`;

mkdirSync(P('docs'), { recursive: true });
writeFileSync(P('docs', 'index.html'), html);
// GitHub Pages: don't run Jekyll over our files (it would skip _-prefixed paths)
writeFileSync(P('docs', '.nojekyll'), '');

// Sweep every rendered post for the gap signatures above. Non-fatal (this is a generator, not a
// pre-commit check — rule 13) but printed loudly: silence is the defect this exists to end.
let leakCount = 0;
for (const p of posts) {
  const found = detectMarkdownLeakage(p.html);
  if (found.length) {
    leakCount += found.length;
    console.warn(`blog: LEAK in ${p.slug}.md — ${found.map(f => f.kind).join(', ')}`);
    for (const f of found) console.warn(`  [${f.kind}] ${f.snippet}`);
  }
}
console.log(`blog: ${posts.length} post(s), status ${st.verdicts ?? 0} verdict(s), ${leakCount} leak(s) -> docs/index.html`);
return { posts, leakCount };
}

// ---------- self-test ----------
// Two fixtures, one detector, and they must disagree: the supported-construct document renders
// clean (detectMarkdownLeakage finds nothing), and the unsupported-construct document is caught
// by name, not silently accepted. If either fixture stopped disagreeing with the other — the
// gap doc came back clean, or the clean doc started tripping the detector — that is exactly the
// silent-failure mode this file exists to end, and --self-test must go red, not green.
function selfTest() {
  let pass = true;
  const check = (label, ok, detail) => {
    pass = pass && ok;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ' — ' + detail : ''}`);
  };

  console.log('ARM A — supported constructs (must render correctly, zero leaks detected)');
  const supportedSrc = [
    '# Heading',
    '',
    'A **bold** word, an *italic* word, `inline code`, a [link](http://example.com/x) and a',
    'paragraph that hard-wraps',
    'onto a second line.',
    '',
    '> A blockquote',
    '> that wraps too.',
    '',
    '- one',
    '- two',
    '  still two, indented continuation',
    '',
    '```js',
    'const x = 1;',
    '```',
    '',
    '![An image](../shots/x.png)',
    '',
    '| left | center | right | code |',
    '|:---|:---:|---:|---|',
    '| a | b | c | `x|y` |',
    '| escaped \\| pipe | plain | 3 | none |',
  ].join('\n');
  const armAHtml = md(supportedSrc);
  check('heading renders', /<h2>Heading<\/h2>/.test(armAHtml));
  check('bold renders', /<strong>bold<\/strong>/.test(armAHtml));
  check('italic renders', /<em>italic<\/em>/.test(armAHtml));
  check('inline code renders', /<code>inline code<\/code>/.test(armAHtml));
  check('link renders', /<a href="http:\/\/example\.com\/x">link<\/a>/.test(armAHtml));
  check('hard-wrapped paragraph joins onto one line', /paragraph that hard-wraps onto a second line\./.test(armAHtml));
  check('blockquote renders and joins its wrapped line', /<blockquote>[\s\S]*A blockquote that wraps too\.[\s\S]*<\/blockquote>/.test(armAHtml));
  check('list renders with wrapped continuation joined', /<li>one<\/li>/.test(armAHtml) && /<li>two still two, indented continuation<\/li>/.test(armAHtml));
  check('fenced code renders', /<pre><code>const x = 1;/.test(armAHtml));
  check('image renders as figure', /<figure><img src="shots\/x\.png" alt="An image"/.test(armAHtml));
  check('table wrapper + table present', /<div class="tblwrap"><table>/.test(armAHtml));
  check('table alignment: left/center/right on <th>', /<th style="text-align:left">left<\/th>/.test(armAHtml)
    && /<th style="text-align:center">center<\/th>/.test(armAHtml)
    && /<th style="text-align:right">right<\/th>/.test(armAHtml));
  check('table default (unaligned) column has no style attr', /<th>code<\/th>/.test(armAHtml));
  check('table has exactly 2 body rows', (armAHtml.match(/<tbody>[\s\S]*<\/tbody>/)[0].match(/<tr>/g) || []).length === 2);
  check('pipe inside a code span in a cell does NOT split the cell', /<code>x\|y<\/code>/.test(armAHtml));
  check('escaped pipe in a cell renders as a literal pipe, one cell', /<td>escaped \| pipe<\/td>/.test(armAHtml));
  const armALeaks = detectMarkdownLeakage(armAHtml);
  check('detector finds zero leaks in a clean, fully-supported document', armALeaks.length === 0,
    armALeaks.length ? JSON.stringify(armALeaks) : undefined);

  console.log('ARM B — unsupported constructs (must be REPORTED, not silently passed through)');
  const gapSrc = [
    'A footnote reference[^1] that the renderer has no handler for.',
    '',
    '[^1]: The definition, also unhandled.',
    '',
    '![alt text](../shots/x.png "a title the renderer was not written for")',
    '',
    'A link to [somewhere](http://example.com/wiki/Foo_(disambiguation)) with parens in the URL.',
  ].join('\n');
  const armBHtml = md(gapSrc);
  const armBLeaks = detectMarkdownLeakage(armBHtml);
  const kinds = armBLeaks.map(f => f.kind);
  check('footnote marker is reported, not silently dropped', kinds.includes('footnote-marker'));
  check('image title mangling is reported, not silently dropped', kinds.includes('mangled-image-title'));
  check('link with parens in URL is reported, not silently dropped', kinds.includes('broken-link-parens'));
  check('arm B is non-empty overall (the two arms genuinely disagree)', armBLeaks.length > 0 && armALeaks.length === 0);

  console.log(pass ? 'SELF-TEST: PASS' : 'SELF-TEST: FAIL');
  return pass;
}

// ---------- CLI ----------
if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
} else {
  build();
}
