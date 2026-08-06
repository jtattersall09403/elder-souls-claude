#!/usr/bin/env node
// critic-w1-14-r2g.mjs — W1-14 round 2: the projectile arc (RI-MAG01 AP-M3 + M8's declared-vs-
// observed) and the anti-homing assertion the round-2 fix put at risk (RI-MAG01 M4).
//
// Round 1 measured 0.000 deg/s and PASSED AR-1 A7 on "no player homing exists". Round 2 added
// target acquisition inside a 20-degree release cone. That closes M8 and opens M4: a projectile
// that curves onto a target the player did not aim at is the homing attack M4 fails a build for.
import path from 'node:path';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r2');
ensureDir(outDir);
const handle = await launchGame(args);
let R;
try {
  R = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const out = {};
    const arena = (ex, ez) => {
      H.setSeed(77); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      H.setWillpower(99); H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.setGold(2000000); H.hearthRest();
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      return H.spawn('inf_trash', ex, ez);
    };
    const run = (spellId, ex, ez) => {
      const eid = arena(ex, ez);
      const hp0 = H.getCombatState().enemies[0].hp;
      H.setAttuned([spellId]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      // `hitboxRecords()` is not reachable through getHitGeometry(), so the arc cannot be read
      // from outside. The ENTITY-SIDE question is the one that matters anyway and needs no
      // internal read: does the spell hit a body the player did not aim at?
      const arc = [];
      for (let i = 0; i < 220; i++) H.stepFrames(1);
      const e = H.getCombatState().enemies[0];
      const g = D.spells.spells.find((s) => s.id === spellId).geometry;
      const cutoffF = Math.round(g.tracking_cutoff * g.lifetime_s * 60);
      return {
        spell: spellId, target_at: [ex, 0, ez],
        bearing_deg: Math.round(Math.atan2(ex, ez) * 180 / Math.PI * 100) / 100,
        declared_turn_dps: g.turn_rate_dps, declared_cutoff_f: cutoffF,
        arc_readable_from_harness: false,
        hit: hp0 - e.hp > 0, damage: Math.round((hp0 - e.hp) * 100) / 100,
        geometry: g,
      };
    };
    const proj = D.spells.spells.filter((s) => s.geometry && s.geometry.kind === 'projectile' && s.geometry.turn_rate_dps > 0);
    const straight = D.spells.spells.filter((s) => s.geometry && s.geometry.kind === 'projectile' && !s.geometry.turn_rate_dps);
    out.on_axis = run(proj[0].id, 0, 14);
    // 15 deg off axis (inside the 20-deg acquisition cone) — does the spell curve onto a target
    // the player did not aim at?
    out.off_axis_15 = run(proj[0].id, 14 * Math.sin(15 * Math.PI / 180), 14 * Math.cos(15 * Math.PI / 180));
    out.off_axis_30 = run(proj[0].id, 14 * Math.sin(30 * Math.PI / 180), 14 * Math.cos(30 * Math.PI / 180));
    if (straight.length) out.declared_zero_turn = run(straight[0].id, 0, 14);
    out.cone_deg = D['cast-classes'] ? (D['cast-classes'].commitment || {}).acquire_cone_deg : null;
    // AR-1 A2: damage determinism across 30 identical casts.
    {
      const dmgs = [];
      for (let i = 0; i < 30; i++) { const r = run(proj[0].id, 0, 6); dmgs.push(r.damage); }
      const mean = dmgs.reduce((a, b) => a + b, 0) / dmgs.length;
      const sd = Math.sqrt(dmgs.reduce((a, b) => a + (b - mean) ** 2, 0) / dmgs.length);
      out.ar1_a2_damage = { n: dmgs.length, distinct: [...new Set(dmgs)], mean: Math.round(mean * 100) / 100, stdev: Math.round(sd * 1e6) / 1e6 };
    }
    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-ballistics.json'), R);
for (const k of ['on_axis', 'off_axis_15', 'off_axis_30', 'declared_zero_turn']) {
  const v = R[k]; if (!v) continue;
  log(k, `bearing ${v.bearing_deg}deg declared ${v.declared_turn_dps}dps cutoff ${v.declared_cutoff_f}f | hit=${v.hit} dmg=${v.damage}`);
}
log('AR-1 A2:', JSON.stringify(R.ar1_a2_damage));
console.log(path.join(outDir, 'critic-ballistics.json'));
