// Critic's own recomputation of RI-CMB07 §D rows 7/8/9 (roll timing delta) and row 28,
// straight off the raw per-frame JSONL. Never opens RI-CMB07-exemplar-statistics.json.
import fs from 'node:fs';

const files = process.argv.slice(2);
const out = {};
for (const p of files) {
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(Boolean);
  const frames = lines.slice(1).map((l) => JSON.parse(l));
  // enemy hitbox-active runs: [first_active_frame, last_active_frame] per swing
  const active = [];
  let cur = null;
  for (const fr of frames) {
    const e = fr.e && fr.e[0];
    const on = e && e[4] === 1;
    if (on && !cur) cur = { start: fr.f, end: fr.f };
    else if (on && cur) cur.end = fr.f;
    else if (!on && cur) { active.push(cur); cur = null; }
  }
  if (cur) active.push(cur);
  // player i-frame runs
  const iruns = [];
  cur = null;
  for (const fr of frames) {
    const on = fr.p[5] === 1;
    if (on && !cur) cur = { start: fr.f, end: fr.f };
    else if (on && cur) cur.end = fr.f;
    else if (!on && cur) { iruns.push(cur); cur = null; }
  }
  if (cur) iruns.push(cur);
  // RI-CMB07 §D rows 7-9: for every roll that occurs within 20 f of an enemy hitbox-active
  // window, delta = (i-frame window start) - (enemy first active frame).
  const deltas = [];
  for (const r of iruns) {
    let best = null;
    for (const a of active) {
      const d = r.start - a.start;
      if (Math.abs(d) <= 20 && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
    if (best !== null) deltas.push(best);
  }
  const mean = deltas.reduce((s, x) => s + x, 0) / (deltas.length || 1);
  const sd = Math.sqrt(deltas.reduce((s, x) => s + (x - mean) ** 2, 0) / (deltas.length || 1));
  // row 28
  let dropStam = 0, dropAny = 0;
  const reasons = {};
  for (const fr of frames) for (const v of (fr.v || [])) {
    if (v.mirrors) continue;
    if (v.type === 'INPUT_DROPPED') { dropAny++; reasons[v.reason || '?'] = (reasons[v.reason || '?'] || 0) + 1; if (v.reason === 'no_stamina') dropStam++; }
  }
  out[p.replace(/.*exemplar-/, '')] = {
    n_iframe_runs: iruns.length, n_enemy_swings: active.length,
    n_deltas: deltas.length,
    row7_mean: +mean.toFixed(3), row8_sd: +sd.toFixed(3),
    row9_range: deltas.length ? [Math.min(...deltas), Math.max(...deltas)] : null,
    row9_in_band: deltas.length ? (Math.min(...deltas) >= -24 && Math.max(...deltas) <= 8) : null,
    row28_no_stamina: dropStam, row28_any_drop: dropAny, drop_reasons: reasons,
    deltas,
  };
}
console.log(JSON.stringify(out, null, 1));
