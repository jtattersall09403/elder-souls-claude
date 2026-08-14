// Draws the roadmap tracker on docs/progress.html, in the cost-report.mjs pattern: this file
// COMPUTES NOTHING. tools/roadmap.mjs is the only thing that verifies a step's evidence and
// decides what counts (rule 10 — one implementation of one system). This reads the summary it
// writes at docs/data/roadmap.json and draws it; a number the summary does not state renders as
// an em dash or an explicit "not published yet" banner, never a guess.
//
// Owner, verbatim: "I MUST always always have a way to instantly check how far through the
// roadmap we are, at any arbitrary point in time, and it must always be correct."
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

function stepRow(s, depth) {
  const indent = depth ? 'style="padding-left:26px"' : '';
  const gaps = (s.failing_evidence || []).length
    ? `<div class="rm-fail">${s.failing_evidence.map(f => `&#10007; ${esc(f)}`).join('<br>')}</div>` : '';
  return `<tr>
    <td ${indent}><code>${esc(s.id)}</code></td>
    <td class="${stateClass(s.effective_state)}">${esc(stateLabel(s.effective_state))}${s.claimed_state !== s.effective_state ? `<div class="rm-claim">claimed: ${esc(s.claimed_state)}</div>` : ''}</td>
    <td>${esc(s.title)}<div class="rm-outcome">${esc(s.visible_outcome || '')}</div>${gaps}</td>
    <td class="rm-closes">${esc(s.closes_when || '')}</td>
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
    const rows = s.steps.map(step => {
      const parent = stepRow(step, 0);
      const kids = Array.isArray(step.substeps) ? step.substeps.map(ss => stepRow(ss, 1)).join('\n') : '';
      return parent + kids;
    }).join('\n');
    const standingRows = (s.standing_work || []).map(st => `<tr>
      <td><code>${esc(st.id)}</code></td>
      <td class="${stateClass(st.effective_state)}">${esc(stateLabel(st.effective_state))}</td>
      <td>${esc(st.title)}${(st.failing_evidence || []).length ? `<div class="rm-fail">${st.failing_evidence.map(f => `&#10007; ${esc(f)}`).join('<br>')}</div>` : ''}</td>
      <td></td>
    </tr>`).join('\n');

    const flags = [];
    if (s.unverified_units) flags.push(`<b class="bad">${s.unverified_units} UNVERIFIED</b> claim(s) &mdash; a step said done or in-progress whose named evidence did not check out. Not counted toward the percentage.`);
    if (s.unevidenced_units) flags.push(`<b class="warn">${s.unevidenced_units} unevidenced</b> &mdash; a claim with no evidence defined at all. Not counted as done, not counted as zero.`);
    const flagBlock = flags.length ? `<div class="rm-flags">${flags.join(' &middot; ')}</div>` : '';

    return `<h2 id="roadmap">Roadmap progress <span class="dimtext">at any arbitrary point in time, and it must always be correct</span></h2>
<div class="rm-hero">
  <div class="rm-hero-n">${s.pct_done}%</div>
  <div class="rm-hero-s">
    <b>${s.done_units}/${s.total_units}</b> steps verified done, at commit <code>${esc((s.commit || '').slice(0, 7) || '?')}</code>, read ${esc(s.generated_at || '')}.<br>
    Currently on <b>${s.current_step ? esc(s.current_step.title) : '&mdash;'}</b> (<code>${s.current_step ? esc(s.current_step.id) : '?'}</code>).<br>
    ${s.in_progress_units} in progress &middot; ${s.not_started_units} not started${s.blocked_units ? ` &middot; ${s.blocked_units} blocked` : ''}.
    ${flagBlock}
  </div>
</div>
<div class="rm-note">Every "done" or "in progress" claim below is verified against named evidence &mdash; a status file, a gate, an instrument &mdash; every time this page regenerates. A step whose evidence is missing reads <b class="bad">UNVERIFIED</b>, not done. Source: <code>orchestration/roadmap.json</code> &middot; instrument: <code>tools/roadmap.mjs</code>.</div>
<div class="rm-scroll"><table><tr><th>id</th><th>state</th><th>step</th><th>closes when</th></tr>
${rows}
</table></div>
<h3 class="rm-standing-h">Standing work <span class="dimtext">(no closing condition by design &mdash; not counted above)</span></h3>
<div class="rm-scroll"><table><tr><th>id</th><th>state</th><th>work</th><th></th></tr>
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
    const flag = s.unverified_units ? ` <b class="bad">${s.unverified_units} UNVERIFIED</b>` : '';
    return `<div class="rm-strip"><a href="#roadmap">Roadmap</a> <b>${s.pct_done}%</b> <span class="rm-strip-dim">(${s.done_units}/${s.total_units} steps) &middot; on ${esc(s.current_step ? s.current_step.title : '?')}</span>${flag}</div>`;
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
.rm-hero{display:grid;grid-template-columns:auto 1fr;gap:20px;align-items:center;background:linear-gradient(180deg,#221d15,#1b1813);border:1px solid var(--gold);border-radius:6px;padding:16px 20px;margin-bottom:10px}
.rm-hero-n{font-size:46px;font-weight:700;color:var(--gold);line-height:1;font-variant-numeric:tabular-nums}
.rm-hero-s{font-size:12px;color:var(--dim);line-height:1.7}
.rm-flags{margin-top:8px;font-size:11px;line-height:1.7}
.rm-note{font-size:11px;color:var(--dim);margin:0 0 12px;line-height:1.6}
.rm-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:18px}
.rm-scroll table{min-width:640px;width:100%}
.rm-outcome{font-size:11px;color:var(--dim);margin-top:3px}
.rm-closes{font-size:11px;color:var(--dim);max-width:280px}
.rm-claim{font-size:10px;color:var(--dim)}
.rm-fail{font-size:11px;color:#e08a76;margin-top:4px}
.rm-standing-h{margin-top:0}
.gold{color:var(--gold)}
`;
