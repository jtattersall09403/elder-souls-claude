#!/usr/bin/env node
// W1-09 r2: why is row 11 (swings negated by i-frames) 0.111 against a band of 0.40-0.80?
// Three candidate causes, each a different defect:
//   (a) the player never rolls into the swing            -> spacing / bot
//   (b) the i-frame window is not where it should be     -> engine
//   (c) negation happens and is not counted              -> telemetry
// This separates them from the raw trace.
import fs from 'node:fs';

const out = { generated: new Date().toISOString(), fights: {} };

for (const F of ['F1','F2','F3','F4','F5']) {
  const lines = fs.readFileSync(`reports/w1-09/exemplar/RI-CMB07-exemplar-${F}-frames.jsonl`,'utf8').split('\n').filter(Boolean);
  const meta = JSON.parse(lines[0]);
  const frames = lines.slice(1).map(l=>JSON.parse(l));
  const reach = {};
  for (const a of meta.enemies[0].attacks) reach[a.id] = a;

  // enemy swings = contiguous runs of e[4]
  const swings = []; let cur=null;
  for (const fr of frames) {
    const e = fr.e[0]; const hb = e[4];
    if (hb) { if(!cur){ cur={f0:fr.f,f1:fr.f,anim:e[1],dist:[],pinv:0,pstates:new Set()}; swings.push(cur);} else cur.f1=fr.f;
      cur.dist.push(e[8]); if (fr.p[5]===1) cur.pinv++; cur.pstates.add(fr.p[0]); }
    else cur=null;
  }
  // outcome tags
  const tag = new Map();
  for (const fr of frames) if (fr.v) for (const ev of fr.v) { if (ev.mirrors) continue;
    if (['HIT','CRIT_HIT','BLOCK','IFRAME_NEGATE','WHIFF'].includes(ev.type)) {
      const s = swings.find(s=>fr.f>=s.f0-2 && fr.f<=s.f1+2);
      if (s) { s.ev = s.ev||[]; s.ev.push(ev.type + (ev.src?(':'+ev.src):'')); } } }

  const rows = swings.map(s => ({
    f0: s.f0, len: s.f1-s.f0+1, anim: s.anim,
    dist_min: +Math.min(...s.dist).toFixed(2),
    dist_at_activation: +s.dist[0].toFixed(2),
    reach_m: reach[s.anim] ? (reach[s.anim].reach_m ?? reach[s.anim].range_m ?? null) : null,
    player_invuln_frames: s.pinv,
    pstates: [...s.pstates].join('|'),
    outcome: (s.ev||[]).join(',') || 'NOTHING'
  }));

  const nothing = rows.filter(r=>r.outcome==='NOTHING');
  // (c) telemetry test: any swing where the player had i-frames up during the active window
  //     AND was inside the closest distance the enemy ever hits from, yet no negate fired
  const hitDists = rows.filter(r=>/HIT/.test(r.outcome)).map(r=>r.dist_min);
  const maxHitDist = hitDists.length ? Math.max(...hitDists) : null;
  const uncountedNegates = rows.filter(r =>
    r.player_invuln_frames > 0 && !/IFRAME_NEGATE/.test(r.outcome) &&
    maxHitDist !== null && r.dist_min <= maxHitDist);

  out.fights[F] = {
    hold_band_m: meta.bot_profile.hold,
    eatRate: meta.bot_profile.eatRate, blockRate: meta.bot_profile.blockRate,
    rollLead: meta.bot_profile.rollLead, wobble: meta.bot_profile.wobble,
    swings: rows.length,
    outcome_census: rows.reduce((a,r)=>{a[r.outcome]=(a[r.outcome]||0)+1;return a;},{}),
    swings_with_no_outcome: nothing.length,
    swings_with_no_outcome_pct: +(nothing.length/rows.length).toFixed(3),
    dist_at_activation_median: (()=>{const d=rows.map(r=>r.dist_at_activation).sort((a,b)=>a-b);return d[Math.floor(d.length/2)];})(),
    dist_min_median: (()=>{const d=rows.map(r=>r.dist_min).sort((a,b)=>a-b);return d[Math.floor(d.length/2)];})(),
    max_distance_a_hit_landed_from: maxHitDist,
    swings_with_player_iframes_up: rows.filter(r=>r.player_invuln_frames>0).length,
    swings_negated: rows.filter(r=>/IFRAME_NEGATE/.test(r.outcome)).length,
    candidate_uncounted_negations: uncountedNegates.length,
    detail: rows
  };
}

// aggregate
const agg = { swings:0, nothing:0, negated:0, iframes_up:0, uncounted:0 };
for (const F of Object.keys(out.fights)) { const f=out.fights[F];
  agg.swings+=f.swings; agg.nothing+=f.swings_with_no_outcome; agg.negated+=f.swings_negated;
  agg.iframes_up+=f.swings_with_player_iframes_up; agg.uncounted+=f.candidate_uncounted_negations; }
out.aggregate = { ...agg,
  pct_swings_that_simply_missed: +(agg.nothing/agg.swings).toFixed(3),
  pct_swings_negated: +(agg.negated/agg.swings).toFixed(3),
  pct_swings_with_iframes_up: +(agg.iframes_up/agg.swings).toFixed(3) };
fs.writeFileSync('corpus/90-verdicts/wave1/artifacts/W1-09-r2/critic-r2-spacing.json', JSON.stringify(out,null,1));
console.log(JSON.stringify({aggregate: out.aggregate, per_fight: Object.fromEntries(Object.entries(out.fights).map(([k,v])=>[k,{
  hold:v.hold_band_m, swings:v.swings, missed:v.swings_with_no_outcome, missed_pct:v.swings_with_no_outcome_pct,
  dist_at_activation_median:v.dist_at_activation_median, dist_min_median:v.dist_min_median,
  max_hit_dist:v.max_distance_a_hit_landed_from, iframes_up:v.swings_with_player_iframes_up,
  negated:v.swings_negated, uncounted:v.candidate_uncounted_negations, census:v.outcome_census }]))},null,1));
