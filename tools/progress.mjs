#!/usr/bin/env node
// Regenerates docs/progress.html from the live state of the repo.
// Reads: corpus reference items (front-matter), verdicts, gap ledger, game data files.
// Run: node tools/progress.mjs   (or `node tools/progress.mjs --watch`)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const P = (...a) => join(ROOT, ...a);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    let st; try { st = statSync(f); } catch { continue; }
    if (st.isDirectory()) walk(f, out); else out.push(f);
  }
  return out;
}

function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else v = v.replace(/^["']|["']$/g, '');
    fm[kv[1]] = v;
  }
  return fm;
}

// ---------- gather ----------
const corpusFiles = walk(P('corpus')).filter(f => extname(f) === '.md');
const items = [];
for (const f of corpusFiles) {
  if (!/RI-[A-Z]+\d+/.test(basename(f))) continue;
  let fm = null;
  try { fm = frontMatter(readFileSync(f, 'utf8')); } catch { }
  if (!fm) continue;
  items.push({
    id: fm.id || basename(f).split('-').slice(0, 2).join('-'),
    title: fm.title || basename(f, '.md'),
    kind: fm.kind || '?', side: fm.side || '?',
    judges: Array.isArray(fm.judges) ? fm.judges : (fm.judges ? [fm.judges] : []),
    provenance: fm.provenance || '?', confidence: fm.confidence || '?',
    blind: fm.blind_pair || 'no',
    path: relative(ROOT, f),
  });
}
items.sort((a, b) => String(a.id).localeCompare(String(b.id)));

const verdicts = [];
for (const f of walk(P('corpus', '90-verdicts')).filter(f => extname(f) === '.json')) {
  try {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    if (j && (j.piece || j.piece_id)) verdicts.push({ ...j, _path: relative(ROOT, f) });
  } catch { }
}

let gaps = [];
for (const cand of ['corpus/90-verdicts/GAP-LEDGER.json', 'corpus/90-verdicts/gap-ledger.json']) {
  if (existsSync(P(cand))) { try { const j = JSON.parse(readFileSync(P(cand), 'utf8')); gaps = j.gaps || j; } catch { } }
}

// ---------- bar critique (the gate) ----------
// The bar critic judges whether the BAR is good enough, not whether the game is.
// Its verdict gates the whole project: no build wave proceeds while INSUFFICIENT.
let critiques = [];
for (const f of walk(P('corpus', '00-doctrine')).filter(f => /BAR-CRITIQUE-\d+\.json$/.test(basename(f)))) {
  try {
    const j = JSON.parse(readFileSync(f, 'utf8'));
    j._n = parseInt((basename(f).match(/(\d+)/) || [, '0'])[1], 10);
    j._path = relative(ROOT, f);
    j._md = j._path.replace(/\.json$/, '.md');
    critiques.push(j);
  } catch { }
}
critiques.sort((a, b) => a._n - b._n);
const critique = critiques[critiques.length - 1] || null;

// A gate condition is "met" when the corpus artifacts it names now exist.
// Heuristic but honest: we resolve RI-* ids and file paths mentioned in the text.
const haveIds = new Set(items.map(i => String(i.id).toUpperCase()));
const allCorpusPaths = walk(P('corpus')).map(f => relative(ROOT, f));
function gateStatus(text) {
  const t = String(text || '');
  const ids = t.match(/RI-[A-Z]+\d+/g) || [];
  const dirs = t.match(/corpus\/[\w./-]+/g) || [];
  const roots = t.match(/\b([a-z]+)\.\*/g) || [];
  let need = 0, got = 0;
  for (const id of new Set(ids)) { need++; if (haveIds.has(id.toUpperCase())) got++; }
  for (const d of new Set(dirs)) { need++; if (allCorpusPaths.some(p => p.startsWith(d.replace(/\/$/, '')))) got++; }
  for (const r of new Set(roots)) {
    need++;
    const root = r.slice(0, -2);
    if (items.some(i => i.judges.some(j => j.startsWith(root + '.')))) got++;
  }
  if (!need) return { state: 'manual', got, need };
  if (got === need) return { state: 'met', got, need };
  if (got === 0) return { state: 'open', got, need };
  return { state: 'partial', got, need };
}
const gates = (critique?.gate_conditions || []).map(c => {
  const text = typeof c === 'string' ? c : (c.condition || c.title || JSON.stringify(c));
  return { text, ...gateStatus(text) };
});
const gatesMet = gates.filter(g => g.state === 'met').length;

// game data stats
// Content layout is mandated by corpus/80-methods/HARNESS.md §5: game/data/**
const dataFiles = walk(P('game', 'data')).filter(f => extname(f) === '.json');
let dataStats = { files: dataFiles.length, quests: 0, npcs: 0, topics: 0, books: 0, dialogueWords: 0, settlements: 0 };
for (const f of dataFiles) {
  let j; try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  const b = basename(f);
  const arr = Array.isArray(j) ? j : (j.entries || j.items || null);
  const n = arr ? arr.length : (j && typeof j === 'object' ? Object.keys(j).length : 0);
  if (/quest/i.test(b)) dataStats.quests += n;
  else if (/npc|actor/i.test(b)) dataStats.npcs += n;
  else if (/topic|dialog/i.test(b)) dataStats.topics += n;
  else if (/book|lore/i.test(b)) dataStats.books += n;
  else if (/settlement|town|city/i.test(b)) dataStats.settlements += n;
  const words = JSON.stringify(j).match(/[A-Za-z']+/g);
  if (/dialog|topic|journal|book/i.test(b) && words) dataStats.dialogueWords += words.length;
}

const srcFiles = walk(P('game')).filter(f => ['.js', '.mjs', '.ts'].includes(extname(f)));
let loc = 0;
for (const f of srcFiles) { try { loc += readFileSync(f, 'utf8').split('\n').length; } catch { } }

const shots = walk(P('reports')).filter(f => ['.png', '.jpg'].includes(extname(f)));

// ---------- derive ----------
const bySide = {}; for (const i of items) bySide[i.side] = (bySide[i.side] || 0) + 1;
const byArea = {};
for (const i of items) { const a = (String(i.id).match(/RI-([A-Z]+)/) || [, '?'])[1]; byArea[a] = (byArea[a] || 0) + 1; }
const judged = new Set(); for (const i of items) for (const j of i.judges) judged.add(j);

const passed = verdicts.filter(v => /pass/i.test(String(v.status || v.verdict || ''))).length;
const failed = verdicts.length - passed;
const openGaps = (Array.isArray(gaps) ? gaps : []).filter(g => !/closed|resolved/i.test(String(g.status || 'open')));

const AREA_NAMES = { CMB: 'Souls combat', AI: 'Enemy behaviour', PRG: 'Progression & economy', QST: 'Quests & factions', DLG: 'Dialogue & journal', WLD: 'World design', LOR: 'Lore & canon', VIS: 'Visual', MTH: 'Measurement' };

const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const html = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="20">
<title>Elder Souls — build progress</title>
<style>
:root{--bg:#12100d;--panel:#1b1813;--ink:#e8ddc8;--dim:#9a8f79;--line:#332d24;--gold:#c8a253;--green:#7d9a5a;--red:#b4553f;--blue:#5f7f96}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 ui-monospace,"SF Mono",Menlo,monospace}
header{padding:22px 28px;border-bottom:1px solid var(--line);background:linear-gradient(180deg,#1e1a14,#141109)}
h1{margin:0;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:600}
.sub{color:var(--dim);font-size:12px;margin-top:6px}
.wrap{padding:22px 28px;max-width:1500px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:26px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:14px 16px}
.card .n{font-size:26px;color:var(--gold);font-weight:600;line-height:1.1}
.card .l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:6px}
h2{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);padding-bottom:8px;margin:30px 0 14px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;color:var(--dim);font-weight:500;padding:6px 10px;border-bottom:1px solid var(--line);text-transform:uppercase;font-size:10px;letter-spacing:.08em}
td{padding:6px 10px;border-bottom:1px solid #241f19;vertical-align:top}
tr:hover td{background:#191510}
.tag{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;border:1px solid var(--line);color:var(--dim)}
.souls{color:#d08b6a;border-color:#5c3a2c}.morrowind{color:#9fb87a;border-color:#42502f}
.modern-fidelity{color:#7fa8c4;border-color:#33505f}.neutral{color:var(--dim)}
.ok{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--gold)}
.empty{color:var(--dim);font-style:italic;padding:14px 0}
.bar{height:5px;background:#241f19;border-radius:3px;overflow:hidden;margin-top:8px}
.bar>i{display:block;height:100%;background:var(--gold)}
code{color:var(--blue);font-size:11px}
.gapq{color:var(--ink)}.rem{color:var(--dim);font-size:11px}
.dimtext{color:var(--dim)}
.gate{border-radius:6px;padding:18px 20px;margin-bottom:8px;border:1px solid var(--line);background:var(--panel)}
.gate-bad{border-color:#6b2f22;background:linear-gradient(180deg,#241512,#1b1813)}
.gate-ok{border-color:#3f5230;background:linear-gradient(180deg,#161d12,#1b1813)}
.verdict{font-size:30px;font-weight:700;letter-spacing:.1em;line-height:1}
.gate-bad .verdict{color:var(--red)}.gate-ok .verdict{color:var(--green)}
.gsub{color:var(--dim);font-size:12px;margin-top:10px;line-height:1.7}
footer{color:var(--dim);font-size:11px;padding:24px 28px;border-top:1px solid var(--line);margin-top:30px}
.shots{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.shots figure{margin:0;background:var(--panel);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.shots img{width:100%;display:block}
.shots figcaption{font-size:10px;color:var(--dim);padding:6px 8px;word-break:break-all}
</style></head><body>
<header>
  <h1>Elder Souls &mdash; Argonia</h1>
  <div class="sub">Morrowind everywhere else &middot; Dark Souls inside the fight &middot; live build status &middot; regenerated ${esc(now)} &middot; auto-refresh 20s</div>
</header>
<div class="wrap">

<div class="grid">
  <div class="card"><div class="n">${items.length}</div><div class="l">Reference items</div></div>
  <div class="card"><div class="n">${judged.size}</div><div class="l">Subsystems judged</div></div>
  <div class="card"><div class="n">${verdicts.length}</div><div class="l">Verdicts filed</div></div>
  <div class="card"><div class="n ${failed ? 'bad' : 'ok'}">${passed}/${verdicts.length || 0}</div><div class="l">Verdicts passing</div></div>
  <div class="card"><div class="n ${openGaps.length ? 'warn' : 'ok'}">${openGaps.length}</div><div class="l">Open gaps</div></div>
  <div class="card"><div class="n">${loc.toLocaleString()}</div><div class="l">Game LOC</div></div>
  <div class="card"><div class="n">${dataStats.quests}</div><div class="l">Quests</div></div>
  <div class="card"><div class="n">${dataStats.dialogueWords.toLocaleString()}</div><div class="l">Dialogue words</div></div>
  <div class="card"><div class="n ${critique && /INSUF/i.test(critique.verdict) ? 'bad' : 'ok'}">${critique ? `${gatesMet}/${gates.length}` : '&mdash;'}</div><div class="l">Bar gates met</div></div>
</div>

${critique ? `
<h2>The gate &mdash; is our bar good enough?</h2>
<div class="gate ${/INSUF/i.test(critique.verdict) ? 'gate-bad' : 'gate-ok'}">
  <div class="verdict">${esc(critique.verdict)}</div>
  <div class="gsub">Bar critique #${critique._n} &middot; judges whether passing every bar would actually produce the thing that was asked for &middot;
  <b>${gatesMet}/${gates.length}</b> gate conditions met &middot; ${(critique.gaps || []).length} gaps &middot; ${(critique.wrong_bars || []).length} wrong bars &middot; ${(critique.thin_spots || []).length} thin spots<br>
  <span class="dimtext">No build wave proceeds while this reads INSUFFICIENT. Full argument: <code>${esc(critique._md)}</code></span></div>
  <div class="bar" style="margin-top:12px"><i style="width:${gates.length ? Math.round(100 * gatesMet / gates.length) : 0}%"></i></div>
</div>

<h2>Gate conditions</h2>
<table><tr><th style="width:90px">Status</th><th>What must be true before building starts</th></tr>
${gates.map(g => `<tr><td class="${g.state === 'met' ? 'ok' : g.state === 'partial' ? 'warn' : g.state === 'manual' ? 'dimtext' : 'bad'}">${g.state === 'met' ? '&#10003; met' : g.state === 'partial' ? `${g.got}/${g.need}` : g.state === 'manual' ? 'review' : 'open'}</td><td>${esc(g.text)}</td></tr>`).join('\n')}
</table>

<h2>Gaps the bar could not see <span class="dimtext">(ranked by the critic)</span></h2>
<table><tr><th style="width:34px">#</th><th>Gap</th><th>Proposed item</th><th>Threshold</th></tr>
${(critique.gaps || []).map(g => `<tr><td>${esc(g.rank)}</td><td class="gapq">${esc(g.title)}<div class="rem">${esc((g.why || '').slice(0, 260))}</div></td><td><code>${esc(g.proposed_id || '')}</code><div class="rem">${esc(g.area || '')}</div></td><td class="rem">${esc((g.threshold || '').slice(0, 200))}</td></tr>`).join('\n')}
</table>

<h2>Wrong or gameable bars <span class="dimtext">(a bar that can be gamed is worse than no bar)</span></h2>
<table><tr><th>Item</th><th>Problem</th><th>Required change</th></tr>
${(critique.wrong_bars || []).map(w => `<tr><td><code>${esc(w.item || w.id || '')}</code></td><td class="gapq">${esc((w.problem || w.title || '').slice(0, 300))}</td><td class="rem">${esc((w.change || w.fix || '').slice(0, 260))}</td></tr>`).join('\n')}
</table>
` : ''}

<h2>Corpus coverage by area</h2>
<table><tr><th>Area</th><th>Domain</th><th>Items</th><th></th></tr>
${Object.entries(byArea).sort().map(([a, n]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(AREA_NAMES[a] || '')}</td><td>${n}</td><td style="width:40%"><div class="bar"><i style="width:${Math.min(100, n * 12)}%"></i></div></td></tr>`).join('\n') || '<tr><td colspan=4 class="empty">no reference items yet</td></tr>'}
</table>

<h2>Reference items &mdash; the bars we must clear</h2>
<table><tr><th>ID</th><th>Title</th><th>Kind</th><th>Side</th><th>Prov.</th><th>Blind</th><th>Judges</th></tr>
${items.map(i => `<tr><td><code>${esc(i.id)}</code></td><td>${esc(i.title)}</td><td>${esc(i.kind)}</td><td><span class="tag ${esc(i.side)}">${esc(i.side)}</span></td><td>${esc(i.provenance)}</td><td>${i.blind === 'yes' ? '<span class="ok">yes</span>' : '&mdash;'}</td><td><code>${esc(i.judges.join(' '))}</code></td></tr>`).join('\n') || '<tr><td colspan=7 class="empty">corpus wave in progress&hellip;</td></tr>'}
</table>

<h2>Verdicts</h2>
<table><tr><th>Wave</th><th>Piece</th><th>Subsystem</th><th>Result</th><th>Single biggest gap</th></tr>
${verdicts.map(v => `<tr><td>${esc(v.wave)}</td><td>${esc(v.piece || v.piece_id)}</td><td><code>${esc(v.subsystem || v.subsystem_path)}</code></td><td class="${/pass/i.test(String(v.status || v.verdict)) ? 'ok' : 'bad'}">${esc(v.status || v.verdict)}</td><td class="gapq">${esc((v.biggest_gap && (v.biggest_gap.summary || v.biggest_gap.gap)) || v.gap || '')}<div class="rem">${esc((v.biggest_gap && v.biggest_gap.remedy) || '')}</div></td></tr>`).join('\n') || '<tr><td colspan=5 class="empty">no verdicts yet &mdash; nothing has been built to judge</td></tr>'}
</table>

<h2>Open gap ledger</h2>
<table><tr><th>Gap</th><th>Subsystem</th><th>Remedy</th><th>Status</th></tr>
${openGaps.map(g => `<tr><td class="gapq">${esc(g.summary || g.gap || g.title)}</td><td><code>${esc(g.subsystem || '')}</code></td><td class="rem">${esc(g.remedy || '')}</td><td class="warn">${esc(g.status || 'open')}</td></tr>`).join('\n') || '<tr><td colspan=4 class="empty">ledger empty</td></tr>'}
</table>

<h2>Content built</h2>
<table><tr><th>Metric</th><th>Count</th></tr>
${Object.entries(dataStats).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${typeof v === 'number' ? v.toLocaleString() : esc(v)}</td></tr>`).join('\n')}
<tr><td>source files</td><td>${srcFiles.length}</td></tr>
</table>

<h2>Latest captures</h2>
${shots.length ? `<div class="shots">${shots.slice(-12).map(s => `<figure><img src="${esc(relative(P('docs'), s))}"><figcaption>${esc(basename(s))}</figcaption></figure>`).join('')}</div>` : '<div class="empty">no screenshots captured yet</div>'}

</div>
<footer>
Inside the fight, Souls wins &mdash; frames, stamina, hitboxes, animation, enemy behaviour.<br>
Everywhere else, Morrowind wins &mdash; progression, faction gating, dialogue, journal, world structure.<br>
Art direction judged against Morrowind. Visual fidelity judged against current-generation references, never against 2002.
</footer>
</body></html>`;

mkdirSync(P('docs'), { recursive: true });
writeFileSync(P('docs', 'progress.html'), html);
writeFileSync(P('docs', 'status.json'), JSON.stringify({
  generated: now, items: items.length, subsystems_judged: judged.size,
  verdicts: verdicts.length, passing: passed, open_gaps: openGaps.length,
  loc, data: dataStats, areas: byArea, sides: bySide,
}, null, 2));

console.log(`progress: ${items.length} reference items, ${verdicts.length} verdicts, ${openGaps.length} open gaps, ${loc} LOC -> docs/progress.html`);
