// CRITIC W1-10 probe C — the Wgrid and the live CFS.
//
// RI-WPN04 M2: "inject the `light` press at every frame k of the enclosing state, in separate
// runs, and record which slot fired. Build Wgrid[slot][k] in {none, contextual, standard,
// buffered}." Here `contextual` means the trace's player.anim differs from the same weapon's
// standing r1.1 anim; `standard` means it is byte-identical to it. Nothing is inferred from a
// data file: the classification is a string comparison on two observed traces.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeC-wgrid-cfs.json';
const WEAPONS = ['dagger', 'straight-sword', 'axe', 'ultra-greatsword'];  // one per weight tier, WEAPON-CRITIC §3.4

const h = await launch();
const out = { probe: 'C — Wgrid + live CFS', build: await h.h('getBuildInfo'), baseline_anim: {}, wgrid: {}, cfs: {} };

// baseline: the standing r1.1 / r2 anim id per weapon
for (const w of WEAPONS) {
  out.baseline_anim[w] = await h.ev(async (w) => {
    const H = window.__HARNESS; const r = {};
    for (const [k, btn] of [['r1.1', 'light'], ['r2', 'heavy']]) {
      H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: w });
      const f0 = H.getFrame();
      H.queueInputs([{ f: f0 + 4, press: [btn] }, { f: f0 + 6, release: [btn] }]);
      H.traceStart({}); H.stepFrames(200); const recs = H.traceDrain() || []; H.traceStop();
      const a = recs.find((x) => x.player && /^ATK/.test(x.player.state));
      const run = a ? recs.filter((x) => x.player && x.player.anim === a.player.anim && /^ATK/.test(x.player.state)) : [];
      const ph = { windup: 0, active: 0, recovery: 0 };
      for (const x of run) if (ph[x.player.phase] !== undefined) ph[x.player.phase]++;
      r[k] = a ? { anim: a.player.anim, startup_f: ph.windup, active_f: ph.active, recovery_f: ph.recovery } : null;
    }
    return r;
  }, w);
}

// Wgrid: for each enclosing state, press `light` at frame k of that state
const STATES = {
  ROLL:     { setup: 'roll_move', frames: 46 },
  BACKSTEP: { setup: 'roll_still', frames: 46 },
  SPRINT:   { setup: 'sprint', frames: 40 },
  AIRBORNE: { setup: 'jump', frames: 40 },
  BLOCK:    { setup: 'block', frames: 40 },
};

for (const w of WEAPONS) {
  out.wgrid[w] = {};
  for (const [st, cfg] of Object.entries(STATES)) {
    const grid = await h.ev(async ({ w, setup, frames }) => {
      const H = window.__HARNESS;
      const res = [];
      for (let k = 1; k <= frames; k++) {
        H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: w });
        const f0 = H.getFrame();
        const q = [];
        let stateStart = f0 + 4;
        if (setup === 'roll_move') q.push({ f: f0 + 2, move: [0, 1] }, { f: f0 + 4, press: ['roll'], move: [0, 1] }, { f: f0 + 6, release: ['roll'], move: [0, 1] });
        else if (setup === 'roll_still') q.push({ f: f0 + 4, press: ['roll'] }, { f: f0 + 6, release: ['roll'] });
        else if (setup === 'sprint') { q.push({ f: f0 + 2, move: [0, 1], press: ['sprint'] }); stateStart = f0 + 2; }
        else if (setup === 'jump') q.push({ f: f0 + 4, press: ['jump'] }, { f: f0 + 6, release: ['jump'] });
        else if (setup === 'block') q.push({ f: f0 + 2, press: ['block'] });
        const pressF = stateStart + k;
        q.push({ f: pressF, press: ['light'] }, { f: pressF + 2, release: ['light'] });
        q.sort((a, b) => a.f - b.f);
        H.queueInputs(q);
        H.traceStart({}); H.stepFrames(200); const recs = H.traceDrain() || []; H.traceStop();
        const a = recs.find((x) => x.player && /^ATK/.test(x.player.state) && x.f >= pressF);
        res.push(a ? { k, anim: a.player.anim, started_f: a.f, lag: a.f - pressF, state_at_press: (recs.find((x) => x.f === pressF) || { player: {} }).player.state } : { k, anim: null, state_at_press: (recs.find((x) => x.f === pressF) || { player: {} }).player.state });
      }
      return res;
    }, { w, setup: cfg.setup, frames: cfg.frames });
    out.wgrid[w][st] = grid;
  }
}

// live CFS: contextual slot instances whose observed anim differs from the standing r1.1/r2 anim
const cfs = { instances: 0, distinct: 0, fallback: 0, absent: 0, detail: [] };
for (const w of WEAPONS) {
  const base1 = out.baseline_anim[w]['r1.1'] && out.baseline_anim[w]['r1.1'].anim;
  for (const [st, grid] of Object.entries(out.wgrid[w])) {
    const fired = grid.filter((g) => g.anim && g.state_at_press && g.state_at_press !== 'IDLE');
    const inState = grid.filter((g) => g.state_at_press && g.state_at_press !== 'IDLE');
    cfs.instances++;
    if (fired.length === 0) { cfs.absent++; cfs.detail.push({ weapon: w, state: st, verdict: 'absent — no attack fires from any frame of this state', in_state_frames: inState.length }); continue; }
    const anims = [...new Set(fired.map((g) => g.anim))];
    if (anims.length === 1 && anims[0] === base1) { cfs.fallback++; cfs.detail.push({ weapon: w, state: st, verdict: 'FALLBACK — plays the standing r1.1 clip', anim: anims[0], standing_r1_1: base1 }); }
    else { cfs.distinct++; cfs.detail.push({ weapon: w, state: st, verdict: 'distinct', anims }); }
  }
}
cfs.CFS_live = cfs.instances ? cfs.distinct / cfs.instances : 0;
out.cfs = cfs;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT, 'CFS_live =', cfs.CFS_live.toFixed(4), 'fallback', cfs.fallback, 'absent', cfs.absent, 'distinct', cfs.distinct, '/', cfs.instances);
await h.close();
