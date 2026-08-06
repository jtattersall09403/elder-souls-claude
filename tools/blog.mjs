#!/usr/bin/env node
// Renders docs/index.html — a two-tab page (Progress | Blog) served by GitHub Pages from /docs.
// Progress numbers come from docs/status.json (written by tools/progress.mjs).
// Blog posts are markdown files in docs/blog/ with YAML-ish front matter.
// Run: node tools/progress.mjs && node tools/blog.mjs

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...a) => join(ROOT, ...a);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- tiny markdown ----------
function md(src) {
  const lines = src.split('\n');
  let out = '', inCode = false, inList = false, inQuote = false;
  let para = [];
  const flushPara = () => { if (para.length) { out += `<p>${inline(para.join(' '))}</p>\n`; para = []; } };
  const inline = t => esc(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) =>
      `<figure><img src="${src.replace(/^\.\.\//, '')}" alt="${alt}" loading="lazy"><figcaption>${alt}</figcaption></figure>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const closeList = () => { if (inList) { out += '</ul>\n'; inList = false; } };
  const closeQuote = () => { if (inQuote) { out += '</blockquote>\n'; inQuote = false; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (l.startsWith('```')) { flushPara(); inCode = !inCode; out += inCode ? '<pre><code>' : '</code></pre>\n'; continue; }
    if (inCode) { out += esc(raw) + '\n'; continue; }
    if (/^\s*$/.test(l)) { flushPara(); closeList(); closeQuote(); continue; }
    if (l.startsWith('> ')) { flushPara(); if (!inQuote) { out += '<blockquote>\n'; inQuote = true; } out += `<p>${inline(l.slice(2))}</p>\n`; continue; }
    closeQuote();
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); closeList(); out += `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>\n`; continue; }
    if (/^[-*]\s+/.test(l)) { flushPara(); if (!inList) { out += '<ul>\n'; inList = true; } out += `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>\n`; continue; }
    closeList();
    // an image on its own line becomes a figure, not a paragraph
    if (/^!\[/.test(l)) { flushPara(); out += inline(l) + '\n'; continue; }
    // Accumulate consecutive prose lines into ONE paragraph. Source markdown is hard-wrapped
    // for readability; without this every wrapped line became its own <p>, which put line
    // breaks in the middle of sentences on the rendered page.
    para.push(l);
  }
  flushPara(); closeList(); closeQuote();
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

// ---------- gather ----------
const posts = [];
if (existsSync(P('docs', 'blog'))) {
  for (const f of readdirSync(P('docs', 'blog')).filter(f => f.endsWith('.md'))) {
    const [fm, body] = frontMatter(readFileSync(P('docs', 'blog', f), 'utf8'));
    posts.push({
      slug: basename(f, '.md'),
      title: fm.title || basename(f, '.md'),
      date: fm.date || basename(f, '.md').slice(0, 10),
      summary: fm.summary || '',
      html: md(body),
    });
  }
}
posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));

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
.post code{color:var(--blue);font-size:13px}
.post strong{color:#fff}
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
console.log(`blog: ${posts.length} post(s), status ${st.verdicts ?? 0} verdict(s) -> docs/index.html`);
