// W1-10 builder-side live probe. Drives the RUNNING GAME through window.__HARNESS and reports
// what the player actually plays, per slot, per weapon, per stance.
//
// This exists because the round-1 checkpoint measured the piece with a tool that read the same
// JSON the verdict was judging. Every number below comes out of `traceDrain()`; nothing here
// opens game/data.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'reports/W1-10-live.json';
const WEAPONS = (process.argv[3] || 'dagger,straight-sword,axe,ultra-greatsword').split(',');

const SCRIPTS = {
  'r1.1': [{ d: 4, tap: 'light' }],
  'r1.2': [{ d: 4, tap: 'light' }, { d: 70, tap: 'light' }],
  'r1.3': [{ d: 4, tap: 'light' }, { d: 70, tap: 'light' }, { d: 140, tap: 'light' }],
  r2: [{ d: 4, tap: 'heavy' }],
  'r2.charged': [{ d: 4, hold: 'heavy', until: 200 }],
  'roll.r1': [{ d: 4, tap: 'roll' }, { d: 38, tap: 'light' }],
  'roll.r2': [{ d: 4, tap: 'roll' }, { d: 38, tap: 'heavy' }],
  'backstep.r1': [{ d: 4, tap: 'roll' }, { d: 20, tap: 'light' }],
  'run.r1': [{ d: 2, hold: 'sprint', until: 120, move: [0, 1] }, { d: 40, tap: 'light', move: [0, 1] }],
  'run.r2': [{ d: 2, hold: 'sprint', until: 120, move: [0, 1] }, { d: 40, tap: 'heavy', move: [0, 1] }],
  'jump.r1': [{ d: 4, tap: 'jump' }, { d: 30, tap: 'light' }],
  'jump.r2': [{ d: 4, tap: 'jump' }, { d: 30, tap: 'heavy' }],
  guardbreak: [{ d: 4, tap: 'light', move: [0, 1] }],
  'shield.bash': [{ d: 2, hold: 'block', until: 200 }, { d: 20, tap: 'light' }],
  'art.1': [{ d: 2, hold: 'two_hand', until: 200 }, { d: 20, tap: 'heavy' }],
  '2h.r1.1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'light' }],
  '2h.r1.2': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'light' }, { d: 130, tap: 'light' }],
  '2h.r2': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'heavy' }],
  '2h.roll.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'roll' }, { d: 94, tap: 'light' }],
  '2h.backstep.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'roll' }, { d: 76, tap: 'light' }],
  '2h.run.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, hold: 'sprint', until: 200, move: [0, 1] }, { d: 100, tap: 'light', move: [0, 1] }],
  '2h.jump.r1': [{ d: 4, tap: 'two_hand' }, { d: 60, tap: 'jump' }, { d: 86, tap: 'light' }],
};

const h = await launch();
const out = { probe: 'W1-10 live', build: await h.h('getBuildInfo'), per_weapon: {} };

async function drive(weapon, script, frames) {
  return h.ev(async ({ weapon, script, frames }) => {
    const H = window.__HARNESS;
    H.setSeed(1337);
    H.loadState('arena_probe');
    H.setLoadout({ weapon });
    const f0 = H.getFrame();
    const q = [];
    for (const s of script) {
      if (s.tap) {
        q.push({ f: f0 + s.d, press: [s.tap], ...(s.move ? { move: s.move } : {}) });
        q.push({ f: f0 + s.d + 2, release: [s.tap], ...(s.move ? { move: s.move } : {}) });
      }
      if (s.hold) {
        q.push({ f: f0 + s.d, press: [s.hold], ...(s.move ? { move: s.move } : {}) });
        q.push({ f: f0 + s.until, release: [s.hold] });
      }
    }
    q.sort((a, b) => a.f - b.f);
    H.queueInputs(q);
    H.traceStart({});
    H.stepFrames(frames);
    const recs = H.traceDrain() || [];
    H.traceStop();
    const seq = [];
    let prev = null;
    for (const r of recs) {
      const p = r.player;
      if (!p) continue;
      const k = p.state + '|' + p.anim + '|' + p.anim_slot;
      if (k !== prev) { seq.push({ f: r.f, state: p.state, anim: p.anim, slot: p.anim_slot, stance: p.stance, tier: p.roll_tier }); prev = k; }
    }
    const ev = [];
    for (const r of recs) for (const e of (r.events || [])) if (/ACTION_START|INPUT_DROPPED|BLOCK_SUCCESS|CHARGE_RELEASE/.test(e.type)) ev.push(e);
    const atk = seq.filter((s) => /^ATK/.test(s.state));
    return {
      slots: [...new Set(atk.map((s) => s.slot))],
      anims: [...new Set(atk.map((s) => s.anim))],
      first: atk[0] || null,
      dropped: [...new Set(ev.filter((e) => e.type === 'INPUT_DROPPED').map((e) => e.reason))],
      tip_frames: recs.filter((r) => r.player && r.player.weapon_tip).length,
      hitstop_max: Math.max(0, ...recs.map((r) => (r.player && r.player.hitstop_f) || 0)),
    };
  }, { weapon, script, frames });
}

for (const w of WEAPONS) {
  const per = {};
  for (const [slot, script] of Object.entries(SCRIPTS)) per[slot] = await drive(w, script, 340);
  const all = new Set();
  for (const r of Object.values(per)) for (const a of r.anims) all.add(a);
  out.per_weapon[w] = { slots: per, distinct_anim: all.size, distinct_anim_list: [...all].sort() };
  console.log(w, 'distinct_anim', all.size,
    'missing:', Object.entries(per).filter(([, r]) => !r.slots.length).map(([k]) => k).join(',') || 'none');
}
out.page_errors = h.errors.slice(0, 8);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT, 'page_errors', out.page_errors.length);
await h.close();
