// Draws the roadmap tracker on docs/progress.html, in the cost-report.mjs pattern: this file
// COMPUTES NOTHING. tools/roadmap.mjs is the only thing that verifies an item's evidence and
// decides what counts (rule 10 — one implementation of one system). This reads the summary it
// writes at docs/data/roadmap.json (schema elder-souls/roadmap-summary@2 — a FLAT item list, each
// carrying a `phase`) and draws it; a number the summary does not state renders as an explicit
// "not published yet" banner, never a guess.
//
// Owner, verbatim: "I MUST always always have a way to instantly check how far through the
// roadmap we are, at any arbitrary point in time, and it must always be correct." And, in
// ROADMAP.md itself: "Anyone quoting a completion percentage should quote it against this list
// [every phase], not against Phase A, or it means nothing." So the headline number here is always
// the full-roadmap percentage; Phase A gets its own clearly-labelled sub-total beside it.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const SUMMARY_PATH = 'docs/data/roadmap.json';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function loadSummary({ root = ROOT, path = SUMMARY_PATH } = {}) {
  const p = join(root, path);
  if (!existsSync(p)) return { state: 'missing', summary: null };
  try { return { state: 'ok', summary: JSON.parse(readFileSync(p, 'utf8')) }; }
  catch (e) { return { state: 'malformed', summary: null, error: e.message }; }
}

function stateClass(s) {
  if (s === 'done') return 'ok';
  if (s === 'UNVERIFIED') return 'bad';
  if (s === 'unevidenced') return 'warn';
  if (s === 'in_progress') return 'gold';
  if (s === 'blocked') return 'bad';
  return 'dimtext';
}
function stateLabel(s) {
  if (s === 'not_started') return 'not started';
  if (s === 'UNVERIFIED') return 'UNVERIFIED';
  return s;
}

function itemRow(it) {
  const gaps = (it.failing_evidence || []).length
    ? `<div class="rm-fail">${it.failing_evidence.map(f => `&#10007; ${esc(f)}`).join('<br>')}</div>` : '';
  const note = !it.has_evidence && it.unevidenced_note ? `<div class="rm-vague">${esc(it.unevidenced_note)}</div>` : '';
  return `<tr>
    <td><code>${esc(it.id)}</code></td>
    <td class="${stateClass(it.effective_state)}">${esc(stateLabel(it.effective_state))}${it.claimed_state !== it.effective_state ? `<div class="rm-claim">claimed: ${esc(it.claimed_state)}</div>` : ''}</td>
    <td>${esc(it.title)}<div class="rm-outcome">${esc(it.visible_outcome || '')}</div>${gaps}${note}</td>
    <td class="rm-closes">${esc(it.closes_when || '')}</td>
  </tr>`;
}

/** The whole section, as HTML. Never throws — this runs on the commit path. */
export function roadmapHtml(opts = {}) {
  try {
    const { state, summary, error } = loadSummary(opts);
    if (state === 'missing') {
      return `<h2 id="roadmap">Roadmap progress</h2>
<div class="rm-banner rm-wait">The roadmap tracker has not run yet. This section renders <code>${esc(SUMMARY_PATH)}</code>, written by <code>node tools/roadmap.mjs</code>, and computes nothing of its own.</div>`;
    }
    if (state === 'malformed') {
      return `<h2 id="roadmap">Roadmap progress</h2>
<div class="rm-banner rm-bad">${esc(SUMMARY_PATH)} exists but does not parse (${esc(error)}). No progress figure is shown rather than guessing.</div>`;
    }

    const s = summary;
    const phaseA = (s.by_phase || []).find(p => p.phase === 'A');
    const otherPhases = (s.by_phase || []).filter(p => p.phase !== 'A');

    const flags = [];
    if (s.unverified_items) flags.push(`<b class="bad">${s.unverified_items} UNVERIFIED</b> claim(s) &mdash; an item said done or in-progress whose named evidence did not check out. Not counted toward the percentage.`);
    flags.push(`<b class="warn">${s.unevidenced_items} unevidenced</b> of ${s.total_items} &mdash; no evidence defined at all (this is the expected, honest state for everything in Phases B-F, which are deliberately not planned to step level yet). Not counted as done, not counted as zero.`);
    const flagBlock = `<div class="rm-flags">${flags.join(' &middot; ')}</div>`;

    const phaseChips = otherPhases.map(p => `<div class="rm-chip"><b>${esc(p.phase)}</b> ${p.done}/${p.total} <span class="dimtext">${esc(p.label)}</span></div>`).join('');

    const rowsByPhase = {};
    for (const it of s.items || []) (rowsByPhase[it.phase] ||= []).push(it);
    const phaseOrder = (s.by_phase || []).map(p => p.phase);
    const bodySections = phaseOrder.map(ph => {
      const rows = (rowsByPhase[ph] || []).map(itemRow).join('\n');
      const meta = (s.by_phase || []).find(p => p.phase === ph);
      return `<h3 class="rm-phase-h">Phase ${esc(ph)} <span class="dimtext">${esc(meta ? meta.label : '')} &mdash; ${meta ? `${meta.done}/${meta.total}` : ''}</span></h3>
<div class="rm-scroll"><table><tr><th>id</th><th>state</th><th>item</th><th>closes when</th></tr>
${rows}
</table></div>`;
    }).join('\n');

    const standingRows = (s.standing_work || []).map(st => `<tr>
      <td><code>${esc(st.id)}</code></td>
      <td class="${stateClass(st.effective_state)}">${esc(stateLabel(st.effective_state))}</td>
      <td>${esc(st.title)}${(st.failing_evidence || []).length ? `<div class="rm-fail">${st.failing_evidence.map(f => `&#10007; ${esc(f)}`).join('<br>')}</div>` : ''}</td>
    </tr>`).join('\n');

    return `<h2 id="roadmap">Roadmap progress <span class="dimtext">at any arbitrary point in time, and it must always be correct</span></h2>
<div class="rm-hero">
  <div class="rm-hero-main">
    <div class="rm-hero-n">${s.pct_done}%</div>
    <div class="rm-hero-s">
      <b>${s.done_items}/${s.total_items}</b> items verified done, across every phase &mdash; the whole roadmap, not a slice of it.<br>
      At commit <code>${esc((s.commit || '').slice(0, 7) || '?')}</code>, read ${esc(s.generated_at || '')}.<br>
      Currently on <b>${s.current_item ? esc(s.current_item.title) : '&mdash;'}</b> (<code>${s.current_item ? esc(s.current_item.id) : '?'}</code>, phase ${s.current_item ? esc(s.current_item.phase) : '?'}).
    </div>
  </div>
  <div class="rm-hero-side">
    <div class="rm-subtotal"><div class="rm-subtotal-n">${phaseA ? phaseA.pct : '&mdash;'}%</div><div class="rm-subtotal-l">Phase A only <span class="rm-weak">sub-total, in flight &mdash; NOT the whole roadmap</span></div><div class="rm-subtotal-s">${phaseA ? `${phaseA.done}/${phaseA.total}` : ''}</div></div>
    <div class="rm-chips">${phaseChips}</div>
  </div>
</div>
${flagBlock}
<div class="rm-note">Every "done" or "in progress" claim below is verified against named evidence &mdash; a status file, a gate, an instrument &mdash; every time this page regenerates. An item whose evidence is missing reads <b class="bad">UNVERIFIED</b>, not done. Phase B-F items are named and scoped only (ROADMAP.md: "resolution deliberately drops with distance"); they carry no evidence on purpose, not by omission. Source: <code>orchestration/roadmap.json</code> &middot; instrument: <code>tools/roadmap.mjs</code> &middot; drift between this page and <code>ROADMAP.md</code>'s prose fails the publish step loudly.</div>
${bodySections}
<h3 class="rm-standing-h">Standing work <span class="dimtext">(no closing condition by design &mdash; not counted above)</span></h3>
<div class="rm-scroll"><table><tr><th>id</th><th>state</th><th>work</th></tr>
${standingRows}
</table></div>`;
  } catch (e) {
    return `<h2 id="roadmap">Roadmap progress</h2><div class="rm-banner rm-bad">Could not render &mdash; ${esc(e.message)}.</div>`;
  }
}

/** One line for the site header/strip — same data, shorter view, same honesty rules. */
export function roadmapStripHtml(opts = {}) {
  try {
    const { state, summary } = loadSummary(opts);
    if (state !== 'ok' || !summary) return `<div class="rm-strip"><a href="#roadmap">Roadmap</a> <span class="rm-strip-dim">&mdash; tracker not run yet</span></div>`;
    const s = summary;
    const flag = s.unverified_items ? ` <b class="bad">${s.unverified_items} UNVERIFIED</b>` : '';
    return `<div class="rm-strip"><a href="#roadmap">Roadmap</a> <b>${s.pct_done}%</b> <span class="rm-strip-dim">(${s.done_items}/${s.total_items} items, all phases) &middot; on ${esc(s.current_item ? s.current_item.title : '?')}</span>${flag}</div>`;
  } catch { return ''; }
}

export const ROADMAP_CSS = `
.rm-strip{font-size:11px;color:var(--dim);margin-top:4px;line-height:1.6}
.rm-strip a{color:var(--gold);text-decoration:none;border-bottom:1px dotted var(--gold)}
.rm-strip b{color:var(--ink)}
.rm-strip-dim{color:var(--dim)}
.rm-banner{border:1px solid var(--line);border-radius:6px;padding:12px 15px;font-size:12px;line-height:1.7;margin-bottom:14px}
.rm-wait{background:var(--panel);color:var(--dim)}
.rm-bad{border-color:#6b2f22;background:linear-gradient(180deg,#241512,#1b1813);color:#e8b6a6}
.rm-hero{display:grid;grid-template-columns:minmax(240px,1.3fr) minmax(0,2fr);gap:14px;align-items:stretch;margin-bottom:10px}
.rm-hero-main{background:linear-gradient(180deg,#221d15,#1b1813);border:1px solid var(--gold);border-radius:6px;padding:16px 20px}
.rm-hero-n{font-size:46px;font-weight:700;color:var(--gold);line-height:1;font-variant-numeric:tabular-nums}
.rm-hero-s{font-size:12px;color:var(--dim);line-height:1.7;margin-top:6px}
.rm-hero-side{display:flex;flex-direction:column;gap:10px}
.rm-subtotal{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 15px}
.rm-subtotal-n{font-size:24px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.rm-subtotal-l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
.rm-weak{text-transform:none;letter-spacing:0;color:#c8a253}
.rm-subtotal-s{font-size:11px;color:var(--dim);margin-top:3px}
.rm-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px}
.rm-chip{background:var(--panel);border:1px solid var(--line);border-radius:5px;padding:6px 9px;font-size:11px;color:var(--ink)}
.rm-flags{margin-bottom:8px;font-size:11px;line-height:1.7}
.rm-note{font-size:11px;color:var(--dim);margin:0 0 14px;line-height:1.6}
.rm-phase-h{margin:22px 0 8px}
.rm-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:10px}
.rm-scroll table{min-width:640px;width:100%}
.rm-outcome{font-size:11px;color:var(--dim);margin-top:3px}
.rm-closes{font-size:11px;color:var(--dim);max-width:280px}
.rm-claim{font-size:10px;color:var(--dim)}
.rm-fail{font-size:11px;color:#e08a76;margin-top:4px}
.rm-vague{font-size:11px;color:var(--dim);margin-top:4px;font-style:italic}
.rm-standing-h{margin-top:24px}
.gold{color:var(--gold)}
`;
