#!/usr/bin/env node
// Builds the critic-score trajectory chart for the Build status tab.
//
// The question this answers, in the project owner's words: "watch the critic scores ticking up
// over time on each domain ... so I can get a nice sense of how this is progressing at a glance."
//
// Form: SMALL MULTIPLES by default — one panel per domain, one series each, so identity is
// carried by the panel heading rather than by hue, and the seven-domain palette problem does not
// arise. An overlay view is available for cross-domain comparison; it uses the validated
// categorical order (dataviz skill, dark steps, checked against this page's #1b1813 surface:
// worst adjacent CVD dE 8.4, normal-vision 19.3, all seven >= 3:1 contrast) with a legend and
// direct labels, which the 6-8 CVD band requires as secondary encoding.
//
// No dual axes. Score is the only measure; time is the only x. A table view carries the same
// numbers for anyone the chart does not serve.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, extname, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Piece -> the domain a reader thinks in. Deliberately coarser than the piece list: the owner
// asked for "sensible grouping", and a chart per piece would be a chart per builder.
//
// **Every piece in `docs/PLAN.md` §3 is listed, plus the named pieces that are not numbered.**
// The previous version covered fourteen of thirty and dropped the rest — four with a warning
// nobody read, and `w1-save`, `w1-library` and anything else without a numeric second field
// silently, because the id pattern did not match them at all. The visible symptom was a progress
// page whose newest verdict was five hours old while seven newer ones sat on disk. Unmapped is
// now a hard failure in `publish.mjs`; a chart that quietly omits data is worse than no chart.
const DOMAIN = {
  'w1-00': 'Engine & harness',
  'w1-01': 'The world',
  'w1-02': 'The world',
  'w1-03': 'The world',
  'w1-04': 'Settlements & people',
  'w1-05': 'The world',
  'w1-06': 'Camera',
  'w1-07': 'Character & opening',
  'w1-08': 'Controls & interface',
  'w1-09': 'Combat',
  'w1-10': 'Weapons',
  'w1-11': 'Combat',
  'w1-12': 'Enemy behaviour',
  'w1-13': 'Death & progression',
  'w1-14': 'Magic',
  'w1-15': 'Stealth & crime',
  'w1-16': 'Death & progression',
  'w1-17': 'Dialogue',
  'w1-18': 'Quests',
  'w1-19': 'Quests',
  'w1-20': 'Quests',
  'w1-21': 'Controls & interface',
  'w1-22': 'Audio',
  'w1-23': 'Lore & the library',
  'w1-24': 'Visuals',
  'w1-25': 'The first hour',
  'w1-26': 'The first hour',
  'w1-27': 'The world',
  'w1-28': 'The first hour',
  'w1-29': 'Controls & interface',
  // Named pieces, dispatched outside the numbered plan.
  'w1-save': 'Engine & harness',
  'w1-souls': 'Death & progression',
  'w1-population': 'Enemy behaviour',
  'w1-library': 'Lore & the library',
  'w1-prose': 'Dialogue',
  'w1-tools': 'Engine & harness',
  'w1-factions': 'Quests',
  // The discovery map (ARBITRATION S35, the owner's overrule of S30). Same domain as `w1-21`,
  // which owns the rest of the interface — the map is a screen, and its verdicts belong on the
  // same line as the journal's and the HUD's. Added by critic-w1-map-r2 because `publish.mjs`
  // fails closed on an unmapped verdict and W1-MAP-r2 was the first verdict to carry a
  // `piece_id` in this series.
  'w1-map': 'Controls & interface',
  // Not mine, and pre-existing: `W1-READABLES-r2` (committed at 402d01a) was already failing
  // `publish.mjs` before this round started, so the shared gate was red for everyone. Its
  // subsystem paths are `quests.*` and `lore.book.*`; the quest reveals are what it grades.
  'w1-readables': 'Quests',
  // `W1-CROSSING` — the fourth named piece in as many sessions to arrive here unmapped. Same
  // domain as `w1-01`/`w1-05`/`w1-27`: it is the traversal budget and the road network, and its
  // verdicts belong on the same line as the province streamer's. Added by critic-w1-crossing for
  // the reason below, and declared in orchestration/status/critic-w1-crossing.json.
  'w1-crossing': 'The world',
  // Also not mine: `W1-ROAD-JOIN` landed from another agent mid-round and red-lined the same gate.
  // Added for the same reason as `w1-readables` — a domain mapping cannot conflict with its
  // owner's work, and a shared gate left red costs the next agent a diagnosis.
  //
  // NOTE FOR WHOEVER OWNS THIS FILE: three pieces in one session arrived here unmapped, because
  // every new named piece fails publish.mjs closed until someone edits this table by hand. The
  // fail-closed default is right for a chart that must not silently omit data, but the burden is
  // landing on whichever critic happens to publish next. Worth a `DOMAIN_DEFAULT` plus a warning,
  // or a check in `dispatchable.mjs` that refuses to dispatch a named piece with no domain.
  'w1-road': 'The world',
};

// Validated categorical order (dark steps). Used only by the overlay view.
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];

export function collect() {
  const dir = join(ROOT, 'corpus', '90-verdicts');
  const files = [];
  const walk = d => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p); else if (extname(p) === '.json') files.push(p);
    }
  };
  walk(dir);

  // When a verdict file was first committed, from git. A critic is supposed to stamp
  // `critic.finished_at`, and 37 of 39 do — but the two that do not were being plotted at x = 0,
  // i.e. at the extreme left of the whole project timeline, as though a verdict filed today were
  // the oldest measurement its domain has. That is worse than not plotting them: it drags a domain
  // line backwards through time and the page gives no sign anything is wrong. Git knows when the
  // file arrived, so use that and say how often we had to.
  const addedAt = (() => {
    const map = new Map();
    try {
      const out = execFileSync('git', ['log', '--diff-filter=A', '--format=%x00%aI', '--name-only',
        '--', 'corpus/90-verdicts'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      let when = null;
      for (const line of out.split('\n')) {
        if (line.startsWith('\0')) { when = line.slice(1).trim(); continue; }
        const p = line.trim();
        if (p && when && !map.has(p)) map.set(p, when);
      }
    } catch { /* no git, or no history — the fallback simply does not fire */ }
    return map;
  })();
  let inferredTimes = 0;

  const rows = [];
  const unmapped = [];
  for (const f of files) {
    let v; try { v = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    const piece = String(v.piece_id || v.piece || '');
    const score = v.score?.overall_0_10 ?? v.score_0_10;
    if (!piece || typeof score !== 'number') continue;
    // Piece ids are not uniform — "W1-09", "w1-09-combat-core-r2" and "w1-09-r3" all name the
    // same piece. Match the wave-and-key prefix rather than stripping a suffix, which silently
    // dropped a third of the combat series. The key is not always numeric: "W1-SAVE" and
    // "W1-LIBRARY" are real pieces and used not to match at all, so they vanished without even a
    // warning — which is how the page came to be five hours stale while the disk was current.
    const m = piece.toLowerCase().match(/^(w\d+-[a-z0-9]+)/);
    if (!m) { unmapped.push(piece); continue; }
    const base = m[1];
    const domain = DOMAIN[base];
    if (!domain) { unmapped.push(piece); continue; }
    let t = v.critic?.finished_at || v.critic?.started_at;
    let inferred = false;
    if (!t) {
      t = addedAt.get(relative(ROOT, f).split(sep).join('/')) || null;
      if (t) { inferred = true; inferredTimes++; }
    }
    rows.push({
      domain, piece: base, inferred,
      round: Number((piece.match(/-r(\d+)$/) || [, 1])[1]),
      score, t: t ? Date.parse(t) : null,
      status: /pass/i.test(String(v.status || '')) ? 'pass' : 'fail',
      gap: v.biggest_gap?.gap_id || '',
    });
  }
  rows.sort((a, b) => (a.t ?? 0) - (b.t ?? 0) || a.round - b.round);

  // One series per domain, one point per verdict, and **the height of the point is the domain's
  // mean at that moment** — not the raw score of the verdict that landed. A domain covers several
  // pieces, so plotting raw scores made the line jump between pieces and read as a domain
  // collapsing when in fact a different, weaker piece had simply reported. The mean is taken over
  // the *latest* score of every piece in the domain that has reported by then, so a piece that
  // improves lifts the line and a piece reporting for the first time moves it by its own weight.
  const byDomain = new Map();
  for (const r of rows) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, []);
    byDomain.get(r.domain).push(r);
  }
  const series = [...byDomain.entries()]
    .map(([name, verdicts]) => {
      const latest = new Map();  // piece -> its most recent score so far
      const pts = verdicts.map(r => {
        latest.set(r.piece, r.score);
        const vals = [...latest.values()];
        return {
          ...r,
          raw: r.score,                                     // what this critic actually scored
          score: +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),  // the domain, now
          pieces: vals.length,
        };
      });
      return { name, pts };
    })
    .filter(s => s.pts.length)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { series, rows, unmapped, inferredTimes };
}

export function chartHtml() {
  const { series, rows, inferredTimes } = collect();
  if (!series.length) return '';

  const GATE = 7, TARGET = 10;
  const ts = rows.map(r => r.t).filter(Boolean);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const span = Math.max(1, t1 - t0);

  // Latest score per domain, and the distance travelled.
  const cards = series.map((s, i) => {
    const first = s.pts[0], last = s.pts[s.pts.length - 1];
    return {
      name: s.name, colour: SERIES[i % SERIES.length],
      first: first.score, last: last.score, delta: +(last.score - first.score).toFixed(1),
      rounds: s.pts.length,
    };
  });
  const meanLatest = +(cards.reduce((a, c) => a + c.last, 0) / cards.length).toFixed(1);
  const atGate = cards.filter(c => c.last >= GATE).length;

  // Every line starts at zero. Before a domain's first verdict its measured score genuinely was
  // nothing — not "unknown", not "assumed adequate" — so the origin is the honest starting point
  // and it makes the climb legible. The origin carries `origin: true` so the renderer can draw
  // that first segment faded: it is a known starting condition, not a measurement anyone took.
  const data = JSON.stringify(series.map((s, i) => ({
    name: s.name, colour: SERIES[i % SERIES.length],
    pts: [{ x: 0, y: 0, origin: true, round: 0, piece: '', status: '', when: '', day: '' }].concat(
      s.pts.map(p => ({
        x: p.t ? (p.t - t0) / span : 0, y: p.score, round: p.round,
        raw: p.raw, pieces: p.pieces,
        piece: p.piece.toUpperCase(), status: p.status,
        when: p.t ? new Date(p.t).toISOString().slice(11, 16) + 'Z' : '',
        day: p.t ? new Date(p.t).toISOString().slice(5, 10) : '',
      }))),
  })));

  const fmt = ms => new Date(ms).toISOString().slice(5, 16).replace('T', ' ') + 'Z';

  return `
<h2>Critic scores by domain</h2>
<style>
.sc{--gate:#c8a253;--tgt:#7d9a5a;margin-bottom:26px}
.sc-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:18px}
.sc-kpi .card .n{font-size:26px;color:var(--gold);font-weight:600;line-height:1.1}
.sc-kpi .card .l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:6px}
.sc-bar{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
.sc-bar button{background:none;border:1px solid var(--line);color:var(--dim);font:inherit;font-size:11px;
 letter-spacing:.08em;text-transform:uppercase;padding:6px 14px;border-radius:4px;cursor:pointer}
.sc-bar button[aria-pressed=true]{color:var(--gold);border-color:var(--gold)}
.sc-note{color:var(--dim);font-size:11px;line-height:1.6;max-width:70ch}
.sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.sc-panel{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px 8px}
.sc-panel h4{margin:0;font-size:12px;color:var(--ink);font-weight:600;letter-spacing:0;text-transform:none}
.sc-panel .now{font-size:22px;font-weight:600;line-height:1.15;margin-top:4px}
.sc-panel .sub{font-size:10px;color:var(--dim);margin-bottom:6px}
.sc-panel svg,.sc-big svg{display:block;width:100%;overflow:visible}
.sc-big{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:16px 18px 10px}
.sc-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:11px;color:var(--dim)}
.sc-legend span.k{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:baseline}
.sc-tip{position:fixed;pointer-events:none;background:#0d0b09;border:1px solid var(--line);border-radius:5px;
 padding:7px 10px;font-size:11px;color:var(--ink);opacity:0;transition:opacity .1s;z-index:50;line-height:1.5;max-width:250px}
.sc-hide{display:none}
table.sc-tbl td.d{color:var(--ink)}
</style>
<div class="sc" id="sc">
  <div class="sc-kpi">
    <div class="card"><div class="n">${meanLatest}</div><div class="l">Mean latest score</div></div>
    <div class="card"><div class="n">${atGate}/${cards.length}</div><div class="l">Domains at the wave-1 gate</div></div>
    <div class="card"><div class="n">${rows.length}</div><div class="l">Verdicts filed</div></div>
    <div class="card"><div class="n">${(TARGET - meanLatest).toFixed(1)}</div><div class="l">Mean distance to 10</div></div>
  </div>
  <div class="sc-bar">
    <button id="sc-b-small" aria-pressed="true">Per domain</button>
    <button id="sc-b-over" aria-pressed="false">All together</button>
    <button id="sc-b-tbl" aria-pressed="false">Table</button>
    <span class="sc-note">A dot appears every time a critic files a verdict. Its height is that domain's score at that moment — the average across every part of the domain that has been judged so far, using each part's most recent mark. So a dot can move the line down either because a part got worse or because a weaker part reported for the first time; hover a dot to see which verdict moved it and what that verdict scored on its own. The gold line is the wave-1 pass mark of ${GATE} and the target is ${TARGET} everywhere. Every line starts at zero, because before a domain's first verdict nothing had been measured; that opening run-in is dashed since nobody took a reading across it. Scores fall as well as rise, and the page redraws either way — a later critic often measures something the earlier one could not, or finds an earlier mark was given too generously.${inferredTimes ? ` <b>${inferredTimes} verdict${inferredTimes === 1 ? '' : 's'}</b> did not stamp a time, so ${inferredTimes === 1 ? 'its dot sits' : 'those dots sit'} where the file was first committed rather than where the critic finished. That is close but it is not the critic's own reading.` : ''}</span>
  </div>
  <div id="sc-small" class="sc-grid"></div>
  <div id="sc-over" class="sc-big sc-hide"></div>
  <div id="sc-tbl" class="sc-hide">
    <table class="sc-tbl"><thead><tr><th>Domain</th><th>Piece</th><th>Round</th><th>When</th><th>Score</th><th>Result</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="d">${esc(r.domain)}</td><td><code>${esc(r.piece.toUpperCase())}</code></td><td>${r.round}</td><td>${r.t ? esc(fmt(r.t)) : '—'}</td><td>${r.score}</td><td class="${r.status === 'pass' ? 'ok' : 'bad'}">${r.status.toUpperCase()}</td></tr>`).join('\n    ')}
    </tbody></table>
  </div>
  <div class="sc-tip" id="sc-tip"></div>
</div>
<script>
(function(){
  var D=${data}, GATE=${GATE}, TARGET=${TARGET};
  var tip=document.getElementById('sc-tip');
  var NS='http://www.w3.org/2000/svg';
  function el(n,a){var e=document.createElementNS(NS,n);for(var k in a)e.setAttribute(k,a[k]);return e;}
  // y is score 0..10 throughout — one axis, always, in every panel and in the overlay.
  function scaleY(v,h,pad){return pad+(1-v/TARGET)*(h-pad*2);}
  function scaleX(v,w,l,r){return l+v*(w-l-r);}

  function showTip(e,html){tip.innerHTML=html;tip.style.opacity=1;
    var x=e.clientX+14,y=e.clientY+14;
    if(x+250>window.innerWidth)x=e.clientX-250;
    tip.style.left=x+'px';tip.style.top=y+'px';}
  function hideTip(){tip.style.opacity=0;}

  function line(s,w,h,pad,l,r,colour,thin){
    var g=document.createDocumentFragment();
    // gate + target references, recessive
    g.appendChild(el('line',{x1:l,x2:w-r,y1:scaleY(GATE,h,pad),y2:scaleY(GATE,h,pad),stroke:'#c8a253','stroke-width':1,'stroke-dasharray':'3 3','opacity':.5}));
    g.appendChild(el('line',{x1:l,x2:w-r,y1:scaleY(TARGET,h,pad),y2:scaleY(TARGET,h,pad),stroke:'#7d9a5a','stroke-width':1,'opacity':.35}));
    var pts=s.pts.map(function(p){return [scaleX(p.x,w,l,r),scaleY(p.y,h,pad)];});
    // The run-in from the zero origin to the first real verdict is drawn faded — it spans a
    // period nobody measured, and a solid line there would assert a trend that was never taken.
    if(pts.length>1){
      g.appendChild(el('path',{d:'M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1)+'L'+pts[1][0].toFixed(1)+' '+pts[1][1].toFixed(1),
        fill:'none',stroke:colour,'stroke-width':thin?2:2.5,opacity:.32,'stroke-dasharray':'4 4','stroke-linecap':'round'}));
    }
    if(pts.length>2){
      var d=pts.slice(1).map(function(p,i){return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1);}).join(' ');
      g.appendChild(el('path',{d:d,fill:'none',stroke:colour,'stroke-width':thin?2:2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
    }
    s.pts.forEach(function(p,i){
      if(p.origin) return;                       // the origin is a starting condition, not a data point
      var c=el('circle',{cx:pts[i][0],cy:pts[i][1],r:thin?4.5:5,fill:colour,stroke:'#1b1813','stroke-width':2});
      c.style.cursor='pointer';
      c.addEventListener('mousemove',function(e){showTip(e,'<b>'+s.name+'</b> <b>'+p.y+'</b> / 10<br><span style="color:#9a8f79">mean of '+p.pieces+' piece'+(p.pieces===1?'':'s')+' measured so far</span><br>moved by '+p.piece+' round '+p.round+', which scored '+p.raw+'<br><span style="color:#9a8f79">'+p.day+' '+p.when+'</span>');});
      c.addEventListener('mouseleave',hideTip);
      g.appendChild(c);
    });
    return g;
  }

  // ---- small multiples: one domain per panel, single series, identity from the heading ----
  var host=document.getElementById('sc-small');
  D.forEach(function(s){
    // pts[0] is the zero origin, so the first *measured* score is pts[1] and the round count
    // excludes the origin — otherwise every domain would claim one more round than it has.
    var real=s.pts.filter(function(p){return !p.origin;});
    var last=real[real.length-1].y, first=real[0].y, dlt=+(last-first).toFixed(1);
    var div=document.createElement('div');div.className='sc-panel';
    var col=last>=GATE?'#7d9a5a':(last>=4?'#c8a253':'#b4553f');
    div.innerHTML='<h4>'+s.name+'</h4><div class="now" style="color:'+col+'">'+last+
      ' <span style="font-size:11px;color:#9a8f79">/ 10</span></div>'+
      '<div class="sub">'+(dlt>0?'▲ +'+dlt:(dlt<0?'▼ '+dlt:'no change'))+' over '+real.length+' round'+(real.length>1?'s':'')+'</div>';
    var w=230,h=76,pad=10,l=2,r=2;
    var svg=el('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':s.name+' latest score '+last+' out of 10 over '+real.length+' critic rounds'});
    svg.appendChild(line(s,w,h,pad,l,r,col,true));
    div.appendChild(svg);host.appendChild(div);
  });

  // ---- overlay: all domains, one axis, legend + direct labels (secondary encoding) ----
  var big=document.getElementById('sc-over');
  // R reserves room for the direct labels. The longest is "Character & opening 3.8"; at 11px
  // that needs ~150px plus the swatch, so 200 keeps it inside the viewBox rather than clipped.
  var W=980,H=340,PAD=26,L=34,R=200;
  var svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Critic score by domain over time'});
  for(var v=0;v<=TARGET;v+=2){
    svg.appendChild(el('line',{x1:L,x2:W-R,y1:scaleY(v,H,PAD),y2:scaleY(v,H,PAD),stroke:'#332d24','stroke-width':1,opacity:v?.6:1}));
    var t=el('text',{x:L-8,y:scaleY(v,H,PAD)+4,fill:'#9a8f79','font-size':11,'text-anchor':'end'});t.textContent=v;svg.appendChild(t);
  }
  D.forEach(function(s){ svg.appendChild(line(s,W,H,PAD,L,R,s.colour,false)); });
  // direct labels at the right — required as secondary encoding, and easier to read than a legend hunt
  var ends=D.map(function(s){return {n:s.name,c:s.colour,y:scaleY(s.pts[s.pts.length-1].y,H,PAD),v:s.pts[s.pts.length-1].y};})
            .sort(function(a,b){return a.y-b.y;});
  var minGap=15;
  for(var i=1;i<ends.length;i++) if(ends[i].y-ends[i-1].y<minGap) ends[i].y=ends[i-1].y+minGap;
  ends.forEach(function(e){
    var tx=el('text',{x:W-R+12,y:e.y+4,fill:'#9a8f79','font-size':11});
    tx.textContent=e.n+' '+e.v;
    svg.appendChild(el('rect',{x:W-R+1,y:e.y-4,width:7,height:7,rx:2,fill:e.c}));
    svg.appendChild(tx);
  });
  var xl=el('text',{x:L,y:H-4,fill:'#9a8f79','font-size':10});xl.textContent='${esc(fmt(t0))}';svg.appendChild(xl);
  var xr=el('text',{x:W-R,y:H-4,fill:'#9a8f79','font-size':10,'text-anchor':'end'});xr.textContent='${esc(fmt(t1))}';svg.appendChild(xr);
  big.appendChild(svg);
  var lg=document.createElement('div');lg.className='sc-legend';
  lg.innerHTML=D.map(function(s){return '<span><span class="k" style="background:'+s.colour+'"></span>'+s.name+'</span>';}).join('')+
    '<span><span class="k" style="background:#c8a253"></span>wave-1 pass mark</span>'+
    '<span><span class="k" style="background:#7d9a5a"></span>target</span>';
  big.appendChild(lg);

  // ---- view switch ----
  var views=[['sc-b-small','sc-small'],['sc-b-over','sc-over'],['sc-b-tbl','sc-tbl']];
  views.forEach(function(pair){
    document.getElementById(pair[0]).addEventListener('click',function(){
      views.forEach(function(p){
        var on=p[0]===pair[0];
        document.getElementById(p[0]).setAttribute('aria-pressed',on);
        document.getElementById(p[1]).classList.toggle('sc-hide',!on);
      });
      hideTip();
    });
  });
})();
</script>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { series, rows } = collect();
  console.log(`scores: ${rows.length} verdict(s) across ${series.length} domain(s)`);
  for (const s of series) console.log(`  ${s.name.padEnd(22)} ${s.pts.map(p => p.score).join(' -> ')}`);
}
