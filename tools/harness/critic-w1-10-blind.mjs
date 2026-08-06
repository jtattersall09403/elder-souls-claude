// CRITIC W1-10 — the two mandatory blind packs (WEAPON-CRITIC §6).
//
// METHOD DEVIATION, recorded: both tests specify 20-second LIVE combat traces. Probe A showed
// the live simulation will not equip any of the 87 roster weapons and knows only 7 of the 15
// classes, so a live 12-weapon within-class pack is impossible. The packs below are built from
// the strongest available substitute: each weapon's per-slot behaviour as the real rig evaluates
// it (frame phases, hitbox arc, root displacement, chain graph, hyperarmour, and the normalised
// tip-speed profile). Every name, id, class code, damage number, motion value and poise value is
// stripped. Assignment is by a seeded shuffle whose seed is recorded.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUTDIR = 'corpus/90-verdicts/wave1/artifacts/W1-10';
const SEED = 20260806;
let s = SEED >>> 0;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

const DIR = 'game/data/combat/movesets';
const CLASSES = ['DGR', 'SSW', 'CSW', 'TSW', 'FST', 'SPR', 'AXE', 'MCE', 'WHP', 'HLB', 'GSW', 'CGS', 'GHM', 'UGS', 'BOW'];
const ms = {};
for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  const m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  if (CLASSES.includes(m.class)) ms[m.weapon_id] = m;
}

const SLOTS = ['r1.1', 'r1.2', 'r1.3', 'r2', 'r2.charged', 'roll.r1', 'backstep.r1', 'run.r1', 'jump.r1', 'guard.counter', 'art.1', '2h.r1.1', '2h.r2'];

const h = await launch();
async function profile(id) {
  return h.ev(async ({ id, SLOTS }) => {
    const H = window.__HARNESS;
    const m = H.weapons.getMoveset(id);
    const rows = [];
    for (const sl of SLOTS) {
      const d = m.slots[sl];
      if (!d) { rows.push({ slot_index: SLOTS.indexOf(sl), present: false }); continue; }
      let peak = null, anti = null;
      try {
        const t = H.weapons.weaponTipTrack(id, sl);
        peak = Math.max(...t.tip_speed_mps);
        const net = [t.tip[t.tip.length - 1][0] - t.tip[0][0], t.tip[t.tip.length - 1][2] - t.tip[0][2]];
        const nl = Math.hypot(net[0], net[1]) || 1;
        let a = 0;
        for (let i = 1; i <= Math.min(d.startup_f, t.tip.length - 1); i++) {
          const dd = [t.tip[i][0] - t.tip[i - 1][0], t.tip[i][2] - t.tip[i - 1][2]];
          if ((dd[0] * net[0] + dd[1] * net[1]) / nl < 0) a++;
        }
        anti = +(a / d.startup_f).toFixed(3);
      } catch (e) { /* leave null */ }
      rows.push({
        slot_index: SLOTS.indexOf(sl), present: true,
        startup_f: d.startup_f, active_f: d.active_f, recovery_f: d.recovery_f,
        arc_deg: d.arc_sweep_deg, root_dz_m: d.root_dz_m, shape: d.shape,
        hyperarmour: !!(d.hyperarmour || {}).enabled,
        chains: d.chains_to ? SLOTS.indexOf(d.chains_to) : null,
        peak_tip_speed_mps: peak === null ? null : +peak.toFixed(2),
        anticipation_fraction: anti,
      });
    }
    return { reach_m: m.reach_m, rows };
  }, { id, SLOTS });
}

// pack 1 — RI-WPN02: three classes, one baseline each
const P1CLASSES = ['MCE', 'HLB', 'CSW'];
const p1 = [];
for (const c of P1CLASSES) {
  const id = Object.keys(ms).find((i) => ms[i].class === c && ms[i].baseline_ref === null);
  p1.push({ id, class: c, profile: await profile(id) });
}
const p1order = p1.map((_, i) => i).sort(() => rnd() - 0.5);
fs.writeFileSync(path.join(OUTDIR, 'blind1-pack.json'), JSON.stringify({
  test: 'RI-WPN02 blind pair — three unlabelled behavioural traces from three classes. Describe three fighting styles.',
  assignment_seed: SEED,
  traces: p1order.map((i, n) => ({ label: 'ABC'[n], ...p1[i].profile })),
}, null, 1));
fs.writeFileSync(path.join(OUTDIR, 'blind1-key.json'), JSON.stringify({ key: p1order.map((i, n) => ({ label: 'ABC'[n], weapon: p1[i].id, class: p1[i].class })) }, null, 1));

// pack 2 — RI-WPN03 M6: 12 weapons, four each from three classes
const P2CLASSES = ['SPR', 'GHM', 'TSW'];
const p2 = [];
for (const c of P2CLASSES) {
  const inC = Object.keys(ms).filter((i) => ms[i].class === c).slice(0, 4);
  for (const id of inC) p2.push({ id, class: c, profile: await profile(id) });
}
const p2order = p2.map((_, i) => i).sort(() => rnd() - 0.5);
fs.writeFileSync(path.join(OUTDIR, 'blind2-pack.json'), JSON.stringify({
  test: 'RI-WPN03 M6 blind clustering — twelve unlabelled behavioural traces, four each from three classes. (a) sort into three groups; (b) name a concrete behavioural difference for >=3 of 6 within-group pairs.',
  assignment_seed: SEED,
  traces: p2order.map((i, n) => ({ label: 'T' + (n + 1), ...p2[i].profile })),
}, null, 1));
fs.writeFileSync(path.join(OUTDIR, 'blind2-key.json'), JSON.stringify({ key: p2order.map((i, n) => ({ label: 'T' + (n + 1), weapon: p2[i].id, class: p2[i].class })) }, null, 1));

console.log('wrote blind packs (seed', SEED, ')');
await h.close();
