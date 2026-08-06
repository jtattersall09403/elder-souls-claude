// CRITIC W1-10 probe B — drive every contextual slot in the LIVE simulation.
//
// RI-WPN04 §D T1..T4 and the piece brief: "Drive every slot of every weapon — rolling,
// backstep, running, jumping, plunging, guard-counter — and check each produces a distinct
// animation id, not a fallback." The instrument is the real trace's `player.anim`, per frame.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeB-contextual-live.json';

const SCRIPTS = {
  'r1.1':          [{ d: 4, tap: 'light' }],
  'r1.2':          [{ d: 4, tap: 'light' }, { d: 46, tap: 'light' }],
  'r1.3':          [{ d: 4, tap: 'light' }, { d: 46, tap: 'light' }, { d: 92, tap: 'light' }],
  'r2':            [{ d: 4, tap: 'heavy' }],
  'r2.charged':    [{ d: 4, hold: 'heavy', until: 70 }],
  'roll.r1':       [{ d: 4, tap: 'roll' }, { d: 38, tap: 'light' }],
  'roll.r2':       [{ d: 4, tap: 'roll' }, { d: 38, tap: 'heavy' }],
  'backstep.r1':   [{ d: 4, tap: 'roll', nomove: true }, { d: 20, tap: 'light' }],
  'run.r1':        [{ d: 2, hold: 'sprint', until: 80 }, { d: 50, tap: 'light' }],
  'run.r2':        [{ d: 2, hold: 'sprint', until: 80 }, { d: 50, tap: 'heavy' }],
  'jump.r1':       [{ d: 4, tap: 'jump' }, { d: 24, tap: 'light' }],
  'jump.r2':       [{ d: 4, tap: 'jump' }, { d: 24, tap: 'heavy' }],
  'plunge':        [{ d: 4, tap: 'jump' }, { d: 30, tap: 'heavy' }],
  'guardbreak':    [{ d: 4, tap: 'light', move: [0, 1] }],
  'guard.counter': [{ d: 2, hold: 'block', until: 80 }, { d: 50, tap: 'light' }],
  'art.1':         [{ d: 2, hold: 'two_hand', until: 90 }, { d: 50, tap: 'heavy' }],
  '2h.r1.1':       [{ d: 4, tap: 'two_hand' }, { d: 56, tap: 'light' }],
  '2h.r2':         [{ d: 4, tap: 'two_hand' }, { d: 56, tap: 'heavy' }],
  '2h.roll.r1':    [{ d: 4, tap: 'two_hand' }, { d: 56, tap: 'roll' }, { d: 90, tap: 'light' }],
  '2h.run.r1':     [{ d: 4, tap: 'two_hand' }, { d: 50, hold: 'sprint', until: 130 }, { d: 100, tap: 'light' }],
  'parry':         [{ d: 4, tap: 'parry' }],
  'shield.bash':   [{ d: 2, hold: 'block', until: 40 }, { d: 20, tap: 'light', move: [0, 1] }],
};

const h = await launch();
const out = {
  probe: 'B — every contextual slot, driven in the live sim',
  build: await h.h('getBuildInfo'),
  weapons: {},
  note: 'The seven ids below are the only movesets the live simulation will equip (probe A). The 87-weapon roster in game/data/combat/movesets/ is unreachable from the running game, so this is the whole of what a player can actually press.',
};

const WEAPONS = ['straight-sword', 'dagger', 'ultra-greatsword', 'axe', 'halberd', 'spear', 'greatsword'];

for (const w of WEAPONS) {
  const per = {};
  for (const [slot, script] of Object.entries(SCRIPTS)) {
    per[slot] = await h.ev(async ({ w, script }) => {
      const H = window.__HARNESS;
      H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: w });
      const f0 = H.getFrame();
      const q = [];
      for (const s of script) {
        if (s.tap) {
          const rec = { f: f0 + s.d, press: [s.tap] };
          if (s.move) rec.move = s.move;
          q.push(rec, { f: f0 + s.d + 2, release: [s.tap] });
        }
        if (s.hold) q.push({ f: f0 + s.d, press: [s.hold] }, { f: f0 + s.until, release: [s.hold] });
      }
      q.sort((a, b) => a.f - b.f);
      H.queueInputs(q);
      H.traceStart({}); H.stepFrames(280);
      const recs = H.traceDrain() || []; H.traceStop();
      const seq = []; let prev = null;
      const attacks = [];
      for (const r of recs) {
        const p = r.player; if (!p) continue;
        const k = p.state + '|' + p.anim;
        if (k !== prev) {
          seq.push({ f: r.f, state: p.state, anim: p.anim, phase: p.phase, anim_len: p.anim_len });
          if (/^ATK/.test(p.state) && p.phase === 'startup') attacks.push({ f: r.f, anim: p.anim, anim_len: p.anim_len });
          prev = k;
        }
      }
      const anims = [...new Set(recs.filter((r) => r.player && /^ATK/.test(r.player.state)).map((r) => r.player.anim))];
      // frame census of the FIRST attack that started
      let census = null;
      const first = recs.find((r) => r.player && /^ATK/.test(r.player.state));
      if (first) {
        const a = first.player.anim;
        const run = recs.filter((r) => r.player && r.player.anim === a && /^ATK/.test(r.player.state));
        const ph = { startup: 0, active: 0, recovery: 0 };
        for (const r of run) if (ph[r.player.phase] !== undefined) ph[r.player.phase]++;
        census = { anim: a, ...ph, total: run.length, hit_frames: run.filter((r) => (r.player.hitboxes || []).length > 0).length };
      }
      return { attack_anims: anims, first_attack: census, states: [...new Set(recs.map((r) => r.player && r.player.state).filter(Boolean))], seq: seq.slice(0, 24) };
    }, { w, script });
  }
  out.weapons[w] = per;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
await h.close();
