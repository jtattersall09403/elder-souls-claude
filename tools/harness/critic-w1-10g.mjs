// CRITIC W1-10 probe G — RI-WPN06 M2 (offhand configuration verb probe) and the answer matrix.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './critic-w1-10-launch.mjs';

const OUT = process.argv[2] || 'corpus/90-verdicts/wave1/artifacts/W1-10/probeG-offhand-answers.json';
const h = await launch();
const out = { probe: 'G — offhand configs, verb sets, answer matrix', build: await h.h('getBuildInfo') };

// which named loadout states exist?
out.scenario_fixtures = await h.ev(async () => {
  const H = window.__HARNESS; const r = {};
  for (const s of ['wpn-dummy-arena', 'wpn-material-range', 'wpn-loadout-o1_sword_shield', 'wpn-loadout-o2_dual', 'wpn-loadout-o3_twohand', 'arena_probe']) {
    try { H.loadState(s); r[s] = 'exists'; } catch (e) { r[s] = 'ABSENT: ' + String(e.message || e).slice(0, 90); }
  }
  return r;
});

// can the offhand be configured at all, live?
out.offhand_setLoadout = await h.ev(async () => {
  const H = window.__HARNESS; const r = {};
  for (const p of [{ shield: 'marsh_oak_medium' }, { shield: null }, { shield: 'greatshield' }, { offhand: 'dagger' }, { offhand: null }, { stance: 'two_hand' }, { left: 'buckler' }]) {
    try { r[JSON.stringify(p)] = H.setLoadout(p); } catch (e) { r[JSON.stringify(p)] = 'THREW: ' + String(e.message || e).slice(0, 140); }
  }
  return r;
});

// verb probe: which buttons produce something, per configuration reachable live
async function verbs(loadout) {
  return h.ev(async (loadout) => {
    const H = window.__HARNESS;
    const BUTTONS = ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump', 'two_hand', 'swap_left', 'swap_right', 'crouch', 'interact', 'use_item', 'lock_on'];
    const seen = new Set();
    for (const b of BUTTONS) {
      H.setSeed(1337); H.loadState('arena_probe');
      try { H.setLoadout(loadout); } catch (e) { return { err: String(e.message || e) }; }
      const f0 = H.getFrame();
      H.queueInputs([{ f: f0 + 4, press: [b] }, { f: f0 + 8, release: [b] }]);
      H.traceStart({}); H.stepFrames(160); const recs = H.traceDrain() || []; H.traceStop();
      for (const r of recs) if (r.player && r.player.state !== 'IDLE') seen.add(b + ':' + r.player.state);
    }
    return { verbs: [...seen].sort() };
  }, loadout);
}
out.verb_sets = {
  o1_sword_shield: await verbs({ weapon: 'straight-sword', shield: 'marsh_oak_medium' }),
  o3_twohand_attempt: await verbs({ weapon: 'ultra-greatsword' }),
};

// RI-WPN01 M5 answer matrix: is there a placement dump to join against?
out.answer_matrix_join = { placement_dump_paths_checked: [], found: null };
for (const p of ['game/data/combat/placement.json', 'game/data/world/encounters.json', 'game/data/combat/encounters.json']) {
  out.answer_matrix_join.placement_dump_paths_checked.push({ path: p, exists: fs.existsSync(p) });
}
// the live verb count: how many DISTINCT attacks can a player produce at all?
out.live_distinct_verbs = await h.ev(async () => {
  const H = window.__HARNESS;
  const anims = new Set();
  for (const w of ['axe', 'dagger', 'greatsword', 'halberd', 'spear', 'straight-sword', 'ultra-greatsword']) {
    for (const script of [
      [{ f: 4, press: ['light'] }, { f: 6, release: ['light'] }],
      [{ f: 4, press: ['heavy'] }, { f: 6, release: ['heavy'] }],
      [{ f: 4, press: ['two_hand'] }, { f: 6, release: ['two_hand'] }, { f: 50, press: ['light'] }, { f: 52, release: ['light'] }],
      [{ f: 4, press: ['two_hand'] }, { f: 6, release: ['two_hand'] }, { f: 50, press: ['heavy'] }, { f: 52, release: ['heavy'] }],
    ]) {
      H.setSeed(1337); H.loadState('arena_probe'); H.setLoadout({ weapon: w });
      const f0 = H.getFrame();
      H.queueInputs(script.map((s) => ({ f: f0 + s.f, ...s, f: f0 + s.f })));
      H.traceStart({}); H.stepFrames(240); const recs = H.traceDrain() || []; H.traceStop();
      for (const r of recs) if (r.player && /^ATK/.test(r.player.state)) anims.add(w + '::' + r.player.anim);
    }
  }
  return { distinct_attack_anims_across_the_whole_kit: anims.size, per_weapon: 4, list: [...anims].sort() };
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
console.log('fixtures', JSON.stringify(out.scenario_fixtures));
console.log('live distinct attack anims', out.live_distinct_verbs.distinct_attack_anims_across_the_whole_kit);
await h.close();
