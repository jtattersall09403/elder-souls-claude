#!/usr/bin/env node
// W1-09 round-2 critic: independent recomputation of the RI-CMB07 §D statistics
// straight off the raw per-frame JSONL. Written from the reference item, NOT from
// tools/harness/cmb-exemplar.mjs. Round 1's whole finding was that a shipped
// statistics file said one thing and the fight was another, so nothing here reads
// RI-CMB07-exemplar-statistics.json.
import fs from 'node:fs';

const COMMITTED = new Set(['ATK_STARTUP','ATK_ACTIVE','ATK_RECOVER','ROLL_STARTUP','ROLL_IFRAME',
  'ROLL_RECOVER','HEAL_STARTUP','HEAL_ACTIVE','HEAL_RECOVER','STAGGER','GUARD_BREAK','CRIT_ATTACK']);
const FREE = new Set(['IDLE','WALK','RUN','SPRINT']);

function load(path) {
  const lines = fs.readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const meta = JSON.parse(lines[0]);
  const frames = lines.slice(1).map(l => JSON.parse(l));
  return { meta, frames };
}

function median(a) { const s=[...a].sort((x,y)=>x-y); const n=s.length;
  return n===0?null:(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2); }
function quartiles(a){ const s=[...a].sort((x,y)=>x-y);
  const q=(p)=>{const i=(s.length-1)*p; const lo=Math.floor(i),hi=Math.ceil(i);
    return s[lo]+(s[hi]-s[lo])*(i-lo);};
  return [q(0.25), q(0.75)]; }

export function stats(path) {
  const { meta, frames } = load(path);
  const MAXHP = frames[0].p[4];
  const MAXSTAM = frames[0].p[3];
  const N = frames.length;

  // ---- events, mirrors dropped -------------------------------------------------
  const evs = [];
  for (const fr of frames) if (fr.v) for (const e of fr.v) if (!e.mirrors) evs.push({ ...e, _f: fr.f });

  // ---- 22/23/24/25 state occupancy --------------------------------------------
  let committed=0, block=0, free=0, run=0, longest=0;
  for (const fr of frames) {
    const st = fr.p[0];
    if (COMMITTED.has(st)) { committed++; run++; if (run>longest) longest=run; }
    else { run=0; }
    if (st === 'BLOCK_HOLD' || st === 'BLOCK_IMPACT') block++;
    if (FREE.has(st)) free++;
  }

  // ---- stamina ----------------------------------------------------------------
  const stam = frames.map(f => f.p[3]);
  const zeroFrames = stam.filter(v => v === 0).length;
  const below25 = stam.filter(v => v < 0.25*MAXSTAM).length;
  const above90 = stam.filter(v => v > 0.90*MAXSTAM).length;
  const meanStam = stam.reduce((a,b)=>a+b,0)/N;
  const floor = Math.min(...stam);

  // ---- player attacks / whiffs -------------------------------------------------
  const playerAttackStarts = evs.filter(e => e.type==='ACTION_START' && !e.who &&
      (e.tag==='attack'||e.tag==='chain2'||e.tag==='punish'||e.tag==='heavy'||e.tag==='jump_attack'));
  const anyPlayerAction = evs.filter(e => e.type==='ACTION_START' && !e.who);
  const whiffs = evs.filter(e => e.type==='WHIFF' && e.src==='P');
  const playerHits = evs.filter(e => (e.type==='HIT'||e.type==='CRIT_HIT') && e.src==='P');
  const rolls = evs.filter(e => e.type==='ACTION_START' && !e.who && e.tag==='dodge');

  // ---- enemy swings: contiguous runs of enemy hitbox_active --------------------
  // e is an array of per-enemy 5+-tuples: [state, anim, anim_frame, hp, hitbox_active, ...]
  const swings = [];
  let cur = null;
  for (const fr of frames) {
    const e0 = fr.e && fr.e[0];
    const hb = e0 ? e0[4] : 0;
    if (hb) { if (!cur) { cur = { f0: fr.f, f1: fr.f, anim: e0[1] }; swings.push(cur); }
              else cur.f1 = fr.f; }
    else cur = null;
  }
  // outcomes
  const inSwing = (f) => swings.find(s => f >= s.f0 && f <= s.f1);
  for (const s of swings) { s.hit=0; s.block=0; s.negate=0; }
  for (const e of evs) {
    const s = inSwing(e._f);
    if (!s) continue;
    if (e.type==='HIT' && e.src==='E1') s.hit++;
    if (e.type==='BLOCK') s.block++;
    if (e.type==='IFRAME_NEGATE') s.negate++;
  }
  // events landing 1 frame outside a run are still attributed to the nearest run
  for (const e of evs) {
    if (inSwing(e._f)) continue;
    if (!(e.type==='IFRAME_NEGATE' || e.type==='BLOCK' || (e.type==='HIT'&&e.src==='E1'))) continue;
    let best=null, bd=Infinity;
    for (const s of swings) { const d = e._f < s.f0 ? s.f0-e._f : (e._f > s.f1 ? e._f-s.f1 : 0);
      if (d<bd) { bd=d; best=s; } }
    if (best && bd<=2) { if (e.type==='HIT') best.hit++; else if (e.type==='BLOCK') best.block++;
      else best.negate++; best._loose=true; }
  }
  const nSw = swings.length;
  const negated = swings.filter(s=>s.negate>0).length;
  const blocked = swings.filter(s=>s.block>0 && s.negate===0).length;
  const taken   = swings.filter(s=>s.hit>0).length;

  // ---- damage taken ------------------------------------------------------------
  let dmgTaken = 0;
  for (const e of evs) if ((e.type==='HIT'||e.type==='CRIT_HIT') && e.dst==='P') dmgTaken += (e.dmg||0);

  // ---- roll timing delta -------------------------------------------------------
  // iframe window start = first frame of the roll with p[5]==1
  // enemy hitbox activation = f0 of the nearest enemy swing
  const iframeStarts = [];
  {
    let prev = 0;
    for (const fr of frames) { const iv = fr.p[5];
      if (iv===1 && prev===0 && fr.p[0].startsWith('ROLL')) iframeStarts.push(fr.f);
      prev = iv; }
  }
  const deltas = [];
  let dodgeRolls = 0;
  // per RI-CMB07 row 6: a roll counts as a *dodge* roll if it is within 20 f of an enemy hitbox
  for (const r of rolls) {
    // the i-frame window opening for this roll
    const w = iframeStarts.find(f => f >= r._f && f <= r._f + 12);
    let near = null, nd = Infinity;
    for (const s of swings) { const d = Math.min(Math.abs(s.f0 - r._f), Math.abs(s.f0 - (w ?? r._f)));
      if (d < nd) { nd = d; near = s; } }
    if (near && nd <= 20) { dodgeRolls++; if (w!=null) deltas.push(w - near.f0); }
  }
  const mean = deltas.length ? deltas.reduce((a,b)=>a+b,0)/deltas.length : null;
  const sd = deltas.length ? Math.sqrt(deltas.reduce((a,b)=>a+(b-mean)**2,0)/deltas.length) : null;

  // ---- punish windows ----------------------------------------------------------
  const enemyStarts = evs.filter(e => e.type==='ACTION_START' && e.who==='E1');
  let used = 0;
  for (const a of enemyStarts) {
    const [w0, w1] = a.punish_window || [];
    if (w0 == null) continue;
    const abs0 = a._f + w0, abs1 = a._f + w1;
    if (playerHits.some(h => h._f >= abs0 && h._f <= abs1)) used++;
  }

  const dropped = evs.filter(e => e.type==='INPUT_DROPPED').length;
  const estus = evs.filter(e => e.type==='ESTUS_START').length;
  const gbreaks = evs.filter(e => e.type==='GUARD_BREAK' || (e.type==='BLOCK' && e.guard_break)).length;
  const staggers = evs.filter(e => e.type==='STAGGER').length;
  const death = evs.find(e => e.type==='DEATH');

  const mins = N/60/60;
  const R = {};
  R[1]  = { s:'Fight duration (s)', v: +(N/60).toFixed(2), band:[70,220] };
  R[2]  = { s:'Attack animations started / min', v: +(playerAttackStarts.length/mins).toFixed(2), band:[7,17] };
  R[3]  = { s:'Hits landed', v: playerHits.length, band:null };
  R[4]  = { s:'Whiff rate', v: +(whiffs.length/Math.max(1,playerAttackStarts.length)).toFixed(4), band:[0.03,0.25] };
  R[5]  = { s:'Rolls / min', v: +(rolls.length/mins).toFixed(2), band:[4,13] };
  R[6]  = { s:'Dodge rolls within 20f of enemy hitbox', v: +(dodgeRolls/Math.max(1,rolls.length)).toFixed(4), band:[0.70,1.0] };
  R[7]  = { s:'Roll timing delta mean (f)', v: mean===null?null:+mean.toFixed(2), band:[-16,-2] };
  R[8]  = { s:'Roll timing delta sd (f)', v: sd===null?null:+sd.toFixed(2), band:[0,8] };
  R[9]  = { s:'Roll timing delta range', v: deltas.length?[Math.min(...deltas),Math.max(...deltas)]:null, band:[-24,8] };
  R[10] = { s:'Enemy swings faced', v: nSw, band:null };
  R[11] = { s:'Swings negated by i-frames', v: +(negated/Math.max(1,nSw)).toFixed(4), band:[0.40,0.80] };
  R[12] = { s:'Swings blocked', v: +(blocked/Math.max(1,nSw)).toFixed(4), band:[0,0.35] };
  R[13] = { s:'Swings taken', v: +(taken/Math.max(1,nSw)).toFixed(4), band:[0.05,0.35] };
  R[14] = { s:'Damage taken / max HP', v: +(dmgTaken/MAXHP).toFixed(4), band:[0.4,1.6] };
  R[15] = { s:'Stamina floor (fraction)', v: +(floor/MAXSTAM).toFixed(4), band:[0,0.15] };
  R[16] = { s:'Frames at exactly 0 stamina', v: zeroFrames, band:[20,600] };
  R[17] = { s:'% frames below 25% stamina', v: +(below25/N).toFixed(4), band:[0.03,0.20] };
  R[18] = { s:'% frames above 90% stamina', v: +(above90/N).toFixed(4), band:[0.12,0.45] };
  R[19] = { s:'Mean stamina (fraction)', v: +(meanStam/MAXSTAM).toFixed(4), band:[0.55,0.80] };
  R[20] = { s:'Guard breaks suffered', v: gbreaks, band:[0,3] };
  R[21] = { s:'Estus charges used', v: estus, band:[1,5] };
  R[22] = { s:'Committed-frame ratio', v: +(committed/N).toFixed(4), band:[0.34,0.56] };
  R[23] = { s:'Block-hold ratio', v: +(block/N).toFixed(4), band:[0,0.20] };
  R[24] = { s:'Free-frame ratio', v: +(free/N).toFixed(4), band:[0.28,0.62] };
  R[25] = { s:'Longest unbroken committed run (f)', v: longest, band:[180,520] };
  R[26] = { s:'Punish windows offered', v: enemyStarts.filter(a=>a.punish_window).length, band:null };
  R[27] = { s:'Punish-window usage rate', v: +(used/Math.max(1,enemyStarts.filter(a=>a.punish_window).length)).toFixed(4), band:[0.50,0.95] };
  R[28] = { s:'Inputs dropped for insufficient stamina', v: dropped, band:[1,Infinity] };
  R[29] = { s:'Player hp at fight end', v: frames[frames.length-1].p[4], band:null };

  for (const k of Object.keys(R)) {
    const r = R[k];
    if (!r.band || r.v===null) { r.in_band = null; continue; }
    if (Array.isArray(r.v)) { r.in_band = r.v[0] >= r.band[0] && r.v[1] <= r.band[1]; continue; }
    r.in_band = r.v >= r.band[0] && r.v <= r.band[1];
  }
  const banded = Object.values(R).filter(r=>r.in_band!==null);
  return { path, frames: N, ended_in_death: !!death, staggers,
    rows: R, banded: banded.length, in_band: banded.filter(r=>r.in_band).length,
    out_of_band: Object.entries(R).filter(([,r])=>r.in_band===false).map(([n,r])=>({n:+n,s:r.s,v:r.v,band:r.band})),
    swings, deltas, enemyStarts: enemyStarts.length };
}

if (process.argv[2] !== '--lib') {
  const files = ['F1','F2','F3','F4','F5'].map(f =>
    `reports/w1-09/exemplar/RI-CMB07-exemplar-${f}-frames.jsonl`);
  const all = files.map(stats);
  const out = { generated: new Date().toISOString(), method: 'independent recompute from raw per-frame JSONL', per_fight: {}, median: {} };
  all.forEach((a,i) => { out.per_fight['F'+(i+1)] = {
    frames: a.frames, ended_in_death: a.ended_in_death, in_band: a.in_band, banded: a.banded,
    out_of_band: a.out_of_band,
    rows: Object.fromEntries(Object.entries(a.rows).map(([n,r])=>[n,{s:r.s,v:r.v,band:r.band,in_band:r.in_band}])) }; });
  for (let n=1;n<=29;n++) {
    const vs = all.map(a=>a.rows[n].v).filter(v=>v!==null && !Array.isArray(v));
    const band = all[0].rows[n].band;
    const m = vs.length===5 ? median(vs) : null;
    const iqr = vs.length===5 ? quartiles(vs) : null;
    const ib = (m===null||!band) ? null : (m>=band[0] && m<=band[1]);
    out.median[n] = { s: all[0].rows[n].s, median: m===null?null:+m.toFixed(4), band, in_band: ib, iqr };
  }
  out.banded_rows_in_band_median = Object.values(out.median).filter(r=>r.in_band===true).length;
  out.banded_rows_total = Object.values(out.median).filter(r=>r.in_band!==null).length;
  out.fights_ending_in_death = all.filter(a=>a.ended_in_death).length;
  console.log(JSON.stringify(out,null,1));
}
