// CRITIC W1-10 probe A — the live runtime.
//
// RI-WPN01 M2/M6, RI-WPN04 M1/M2 and RI-WPN02 M1 all require the OBSERVED trace, not the
// declared data. `game/src/harness/weapons.js` is a pure function of the same JSON the verdict
// judges, so it is a second reader of the declaration, not an observation. This probe drives
// the real simulation.
//
// Three questions:
//   A1  Which weapons can the live player equip? (RI-WPN03 §A census, RI-WPN02 §A taxonomy)
//   A2  Drive every contextual context — idle / roll / backstep / sprint / airborne / plunge /
//       block-success / two-hand — and record the anim id the player actually plays.
//       RI-WPN04 §D T1: `anim(X) == anim(r1.1)` is the fallback and a HARD FAIL.
//   A3  Two-handing: is it a distinct moveset or a multiplier? (RI-WPN06 M1/M3)
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeA-live-runtime.json';
const MOVEDIR = 'game/data/combat/movesets';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];

const ms = {};
for (const f of fs.readdirSync(MOVEDIR)) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(MOVEDIR, f), 'utf8'));
  if (CLASSES.includes(m.class)) ms[m.weapon_id] = m;
}
const ids = Object.keys(ms).sort();

const h = await launch();
const out = {
  probe: 'A — the live runtime',
  build: await h.h('getBuildInfo'),
  method: 'window.__HARNESS driven in headless Chromium; every figure below is read out of getPlayerStats()/traceDrain(), never out of a data file.',
  roster_declared_in_data: ids.length,
  A1_equip: {}, A2_contextual: {}, A3_twohand: {},
};

// ---- A1: which weapons can the live player equip? --------------------------------------
const eq = [];
for (const id of ids) {
  const r = await h.ev(async (w) => {
    try { return { ok: await window.__HARNESS.setLoadout({ weapon: w }) }; }
    catch (e) { return { err: String(e && e.message || e) }; }
  }, id);
  eq.push({ weapon_id: id, class: ms[id].class, ...r });
}
out.A1_equip = {
  attempted: eq.length,
  equipped_ok: eq.filter((x) => x.ok).length,
  rejected: eq.filter((x) => x.err).length,
  distinct_errors: [...new Set(eq.filter((x) => x.err).map((x) => x.err))],
  classes_with_zero_equippable: CLASSES.filter((c) => !eq.some((x) => x.class === c && x.ok)),
  per_class: Object.fromEntries(CLASSES.map((c) => [c, {
    in_data: eq.filter((x) => x.class === c).length,
    equippable: eq.filter((x) => x.class === c && x.ok).length,
  }])),
};

// what DOES the live sim accept?
const spineTry = ['axe', 'dagger', 'greatsword', 'halberd', 'spear', 'straight-sword', 'ultra-greatsword',
  'curved-sword', 'thrusting-sword', 'fist', 'mace', 'whip', 'curved-greatsword', 'great-hammer', 'bow'];
const spine = [];
for (const w of spineTry) {
  const r = await h.ev(async (w) => {
    try { return { ok: await window.__HARNESS.setLoadout({ weapon: w }) }; }
    catch (e) { return { err: String(e && e.message || e) }; }
  }, w);
  spine.push({ id: w, ...r });
}
out.A1_equip.live_moveset_ids = spine;

// ---- A2: drive every contextual context and read the anim the player plays -------------
// scripts are absolute-frame input lists; the enclosing state and the press frame are chosen
// so the press lands inside RI-WPN04 §B's window for the LIGHT equip-load tier.
const SCRIPTS = {
  'r1.1':        [{ d: 2, tap: 'light' }],
  'r2':          [{ d: 2, tap: 'heavy' }],
  'r2.charged':  [{ d: 2, hold: 'heavy', until: 60 }],
  'r1.2':        [{ d: 2, tap: 'light' }, { d: 40, tap: 'light' }],
  'r1.3':        [{ d: 2, tap: 'light' }, { d: 40, tap: 'light' }, { d: 78, tap: 'light' }],
  'roll.r1':     [{ d: 2, tap: 'roll' }, { d: 35, tap: 'light' }],
  'roll.r2':     [{ d: 2, tap: 'roll' }, { d: 35, tap: 'heavy' }],
  'backstep.r1': [{ d: 2, tap: 'roll' }, { d: 16, tap: 'light' }],
  'run.r1':      [{ d: 2, hold: 'sprint', until: 60 }, { d: 40, tap: 'light' }],
  'run.r2':      [{ d: 2, hold: 'sprint', until: 60 }, { d: 40, tap: 'heavy' }],
  'jump.r1':     [{ d: 2, tap: 'jump' }, { d: 22, tap: 'light' }],
  'jump.r2':     [{ d: 2, tap: 'jump' }, { d: 22, tap: 'heavy' }],
  'plunge':      [{ d: 2, tap: 'jump' }, { d: 22, tap: 'heavy' }],
  'guardbreak':  [{ d: 2, hold: 'block', until: 8 }, { d: 12, tap: 'light', move: [0, 1] }],
  'guard.counter': [{ d: 2, hold: 'block', until: 40 }, { d: 30, tap: 'light' }],
  'art.1':       [{ d: 2, hold: 'two_hand', until: 50 }, { d: 30, tap: 'heavy' }],
  '2h.r1.1':     [{ d: 2, tap: 'two_hand' }, { d: 45, tap: 'light' }],
  '2h.r2':       [{ d: 2, tap: 'two_hand' }, { d: 45, tap: 'heavy' }],
};

async function driveOne(weapon, slot, script) {
  return h.ev(async ({ weapon, script }) => {
    const H = window.__HARNESS;
    await H.setSeed(1337);
    try { H.loadState('arena_probe'); } catch (e) { H.reset({ seed: 1337 }); }
    try { await H.setLoadout({ weapon }); } catch (e) { return { err: String(e.message || e) }; }
    const f0 = H.getFrame();
    const q = [];
    for (const s of script) {
      if (s.tap) {
        const rec = { f: f0 + s.d, press: [s.tap] };
        if (s.move) rec.move = s.move;
        q.push(rec);
        q.push({ f: f0 + s.d + 2, release: [s.tap] });
      }
      if (s.hold) {
        q.push({ f: f0 + s.d, press: [s.hold] });
        q.push({ f: f0 + s.until, release: [s.hold] });
      }
    }
    q.sort((a, b) => a.f - b.f);
    H.queueInputs(q);
    H.traceStart({});
    H.stepFrames(260);
    H.traceStop();
    const recs = H.traceDrain() || [];
    const seq = [];
    let prev = null;
    for (const r of recs) {
      if (!r.p) continue;
      const key = r.p[0] + '|' + r.p[1];
      if (key !== prev) { seq.push({ state: r.p[0], anim: r.p[1] }); prev = key; }
    }
    return { seq, attack_anims: [...new Set(seq.filter((s) => /ATK/.test(s.state)).map((s) => s.anim))] };
  }, { weapon, script });
}

const ctxWeapons = ['straight-sword', 'ultra-greatsword', 'dagger'];
for (const w of ctxWeapons) {
  const per = {};
  for (const [slot, script] of Object.entries(SCRIPTS)) per[slot] = await driveOne(w, slot, script);
  out.A2_contextual[w] = per;
}

// ---- A3: two-handing ---------------------------------------------------------------------
out.A3_twohand.stance_switch = await h.ev(async () => {
  const H = window.__HARNESS;
  await H.setSeed(1337);
  try { H.loadState('arena_probe'); } catch (e) { H.reset({ seed: 1337 }); }
  await H.setLoadout({ weapon: 'straight-sword' });
  const f0 = H.getFrame();
  H.queueInputs([{ f: f0 + 2, press: ['two_hand'] }, { f: f0 + 4, release: ['two_hand'] }]);
  H.traceStart({}); H.stepFrames(120); H.traceStop();
  const recs = H.traceDrain() || [];
  const seq = []; let prev = null;
  for (const r of recs) { if (!r.p) continue; const k = r.p[0] + '|' + r.p[1]; if (k !== prev) { seq.push({ f: r.f, state: r.p[0], anim: r.p[1] }); prev = k; } }
  return { seq };
});
// stance switch during an attack — RI-WPN06 M3: must be illegal
out.A3_twohand.switch_during_attack = await h.ev(async () => {
  const H = window.__HARNESS;
  await H.setSeed(1337);
  try { H.loadState('arena_probe'); } catch (e) { H.reset({ seed: 1337 }); }
  await H.setLoadout({ weapon: 'straight-sword' });
  const f0 = H.getFrame();
  H.queueInputs([{ f: f0 + 2, press: ['light'] }, { f: f0 + 4, release: ['light'] }, { f: f0 + 12, press: ['two_hand'] }, { f: f0 + 14, release: ['two_hand'] }]);
  H.traceStart({}); H.stepFrames(160); H.traceStop();
  const recs = H.traceDrain() || [];
  const seq = []; let prev = null;
  for (const r of recs) { if (!r.p) continue; const k = r.p[0] + '|' + r.p[1]; if (k !== prev) { seq.push({ f: r.f, state: r.p[0], anim: r.p[1] }); prev = k; } }
  return { seq };
});

out.page_errors = h.errors.slice(0, 5);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
console.log('equipped_ok', out.A1_equip.equipped_ok, '/', out.A1_equip.attempted);
await h.close();
