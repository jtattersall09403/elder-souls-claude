// CRITIC W1-10 probe F — AR-1 on the weapon path, the stance switch, and RI-WPN01 M6.
//
// WEAPON-CRITIC §7: "AR-1 here means: any randomness on the weapon path... AR-1 here also means:
// any attack cancellable during startup or active frames, including a stance switch (RI-WPN06 §A)
// or a charge release used as a cancel."
// RI-WPN01 M6: diff every numeric field in the declared moveset against the trace measurement.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeF-ar1-stance-m6.json';
const h = await launch();
const out = { probe: 'F — AR-1 / stance / M6', build: await h.h('getBuildInfo') };

// ---- AR-1 A2: 50 identical swings, damage stdev, rng draws during resolution -------------
out.ar1_damage = await h.ev(async () => {
  const H = window.__HARNESS;
  const dmg = [], rngDelta = [];
  for (let n = 0; n < 50; n++) {
    H.setSeed(1337 + 0); H.loadState('arena_duel');
    H.setLoadout({ weapon: 'straight-sword' });
    const es = H.listEntities().filter((e) => e.eid !== 'player');
    const target = es[0] && es[0].eid;
    if (target) { try { H.aggro(target); } catch {} }
    const f0 = H.getFrame();
    H.queueInputs([{ f: f0 + 4, press: ['light'] }, { f: f0 + 6, release: ['light'] }]);
    H.traceStart({}); H.stepFrames(150); const recs = H.traceDrain() || []; H.traceStop();
    const hits = [];
    let r0 = null, r1 = null;
    for (const r of recs) {
      if (r.rng && r0 === null) r0 = r.rng.draws;
      if (r.rng) r1 = r.rng.draws;
      for (const e of (r.events || [])) if (/hit|damage/i.test(e.type || '')) hits.push(e);
    }
    dmg.push(hits.map((x) => x.damage !== undefined ? x.damage : (x.amount !== undefined ? x.amount : null)));
    rngDelta.push(r1 - r0);
  }
  const flat = dmg.map((d) => d[0]).filter((x) => x !== null && x !== undefined);
  const mu = flat.reduce((a, b) => a + b, 0) / (flat.length || 1);
  const sd = Math.sqrt(flat.reduce((a, b) => a + (b - mu) ** 2, 0) / (flat.length || 1));
  return { swings: 50, hits_recorded: flat.length, damage_values: [...new Set(flat)], mean: mu, stdev: sd, rng_draws_per_run: [...new Set(rngDelta)] };
});

// ---- AR-1 A5 / RI-WPN06 M3: cancel an attack with a stance switch --------------------------
async function seqOf(script) {
  return h.ev(async (script) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: 'straight-sword' });
    const f0 = H.getFrame();
    H.queueInputs(script.map((s) => ({ f: f0 + s.f, ...(s.press ? { press: s.press } : {}), ...(s.release ? { release: s.release } : {}) })));
    H.traceStart({}); H.stepFrames(220); const recs = H.traceDrain() || []; H.traceStop();
    const seq = []; let prev = null;
    for (const r of recs) { const p = r.player; if (!p) continue; const k = p.state + '|' + p.anim; if (k !== prev) { seq.push({ f: r.f, state: p.state, anim: p.anim, phase: p.phase }); prev = k; } }
    return seq;
  }, script);
}
out.stance = {
  bare_two_hand_tap: await seqOf([{ f: 4, press: ['two_hand'] }, { f: 6, release: ['two_hand'] }]),
  two_hand_during_startup: await seqOf([{ f: 4, press: ['light'] }, { f: 6, release: ['light'] }, { f: 14, press: ['two_hand'] }, { f: 16, release: ['two_hand'] }]),
  two_hand_during_active: await seqOf([{ f: 4, press: ['light'] }, { f: 6, release: ['light'] }, { f: 32, press: ['two_hand'] }, { f: 34, release: ['two_hand'] }]),
  two_hand_during_roll: await seqOf([{ f: 4, press: ['roll'] }, { f: 6, release: ['roll'] }, { f: 14, press: ['two_hand'] }, { f: 16, release: ['two_hand'] }]),
  roll_during_attack_startup: await seqOf([{ f: 4, press: ['light'] }, { f: 6, release: ['light'] }, { f: 12, press: ['roll'] }, { f: 14, release: ['roll'] }]),
};

// ---- RI-WPN01 M6: declared vs observed, over the frame fields we CAN observe ---------------
const SPINE = { dagger: 'DGR', 'straight-sword': 'SSW', spear: 'SPR', axe: 'AXE', halberd: 'HLB', greatsword: 'GSW', 'ultra-greatsword': 'UGS' };
const ROSTER_BASELINE = { DGR: 'dgr_shell_knife', SSW: 'ssw_garrison_sword', SPR: 'spr_fishers_gig', AXE: 'axe_shell_splitter', HLB: 'hlb_garrison_bill', GSW: 'gsw_memorial_blade', UGS: 'ugs_golem_sword' };
const dir = 'game/data/combat/movesets';
const declared = {};
for (const [k, id] of Object.entries(ROSTER_BASELINE)) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, id + '.json'), 'utf8'));
  declared[k] = m;
}
const observed = await h.ev(async (spine) => {
  const H = window.__HARNESS; const r = {};
  for (const w of Object.keys(spine)) {
    r[w] = {};
    for (const [slot, btn] of [['r1.1', 'light'], ['r2', 'heavy']]) {
      H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: w });
      const f0 = H.getFrame();
      H.queueInputs([{ f: f0 + 4, press: [btn] }, { f: f0 + 6, release: [btn] }]);
      H.traceStart({}); H.stepFrames(320); const recs = H.traceDrain() || []; H.traceStop();
      const a = recs.find((x) => x.player && /^ATK/.test(x.player.state));
      if (!a) { r[w][slot] = null; continue; }
      const run = recs.filter((x) => x.player && x.player.anim === a.player.anim && /^ATK/.test(x.player.state));
      const ph = { windup: 0, active: 0, recovery: 0 };
      for (const x of run) if (ph[x.player.phase] !== undefined) ph[x.player.phase]++;
      r[w][slot] = { anim: a.player.anim, startup_f: ph.windup, active_f: ph.active, recovery_f: ph.recovery };
    }
  }
  return r;
}, SPINE);
out.m6 = { rows: [], fields_total: 0, fields_matching: 0 };
for (const [w, cls] of Object.entries(SPINE)) {
  for (const slot of ['r1.1', 'r2']) {
    const d = declared[cls].slots[slot], o = observed[w][slot];
    const row = { live_weapon: w, roster_baseline: ROSTER_BASELINE[cls], slot, declared_anim: d.anim, observed_anim: o && o.anim, fields: {} };
    for (const f of ['startup_f', 'active_f', 'recovery_f']) {
      out.m6.fields_total++;
      const match = o && o[f] === d[f];
      if (match) out.m6.fields_matching++;
      row.fields[f] = { declared: d[f], observed: o && o[f], match: !!match };
    }
    out.m6.fields_total++; // the anim field itself
    if (o && o.anim === d.anim) out.m6.fields_matching++;
    row.anim_match = !!(o && o.anim === d.anim);
    out.m6.rows.push(row);
  }
}
out.m6.agreement = +(out.m6.fields_matching / out.m6.fields_total).toFixed(4);

// ---- determinism, five seeds --------------------------------------------------------------
out.determinism = await h.ev(async () => {
  const H = window.__HARNESS; const sigs = [];
  for (const s of [1337, 1, 2, 99, 424242]) {
    H.setSeed(s); H.loadState('arena_probe'); H.setLoadout({ weapon: 'straight-sword' });
    const f0 = H.getFrame();
    H.queueInputs([{ f: f0 + 4, press: ['light'] }, { f: f0 + 6, release: ['light'] }]);
    H.traceStart({}); H.stepFrames(200); const recs = H.traceDrain() || []; H.traceStop();
    sigs.push({ seed: s, sig: recs.filter((r) => r.player).map((r) => r.player.state + r.player.anim + r.player.anim_frame).join('|').length + ':' + recs.filter((r) => r.player && /^ATK/.test(r.player.state)).length });
  }
  return { sigs, identical: new Set(sigs.map((x) => x.sig)).size === 1 };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
console.log('damage stdev', out.ar1_damage.stdev, 'values', JSON.stringify(out.ar1_damage.damage_values).slice(0, 120),
  '| M6 agreement', out.m6.agreement, '| determinism', out.determinism.identical);
await h.close();
