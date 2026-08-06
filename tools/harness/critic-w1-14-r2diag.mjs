#!/usr/bin/env node
// Diagnostic: why did touch-range custom spells fail to resolve in critic-w1-14-r2a?
import path from 'node:path';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r2');
ensureDir(outDir);
const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready();
    const D = H.getMagicData();
    const out = {};
    const arena = (withEnemy, dist) => {
      H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      H.setWillpower(99); H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.setEquipLoad(50); H.setGold(2000000); H.hearthRest();
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      let eid = null;
      if (withEnemy) { eid = H.spawn('inf_trash', 0, dist === undefined ? 1.4 : dist); H.aggro(eid); }
      return eid;
    };
    const trial = (effect, range, mag, dur, dist, aggro) => {
      const eid = arena(range !== 'self', dist);
      if (eid && aggro === false) { /* leave idle */ }
      const mk = H.makeSpell({ class: 'LIGHT', range, effects: [{ effect, magnitude: mag, duration_s: dur, area_r_m: 0 }] }, 'diag');
      if (mk.refused) return { refused: mk.reason || mk.gate };
      H.setAttuned([mk.spell.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(240);
      const ev = H.magicEventsDrain();
      return {
        geometry: mk.spell.geometry,
        events: ev.map((e) => ({ f: e.frame, kind: e.kind, effect: e.effect, consumer: e.consumer, changed: e.changed, target: e.target, reason: e.reason })).slice(0, 30),
        status: H.getStatusState(),
        world_locks: H.getMagicWorld().locks,
        combat: H.getCombatState().enemies.map((x) => ({ id: x.id, hp: x.hp, state: x.state, dead: x.dead })),
      };
    };
    out.paralyse_touch = trial('paralyse', 'touch', 20, 20, 1.4, true);
    out.fire_touch = trial('fire_damage', 'touch', 20, 0, 1.4, true);
    out.shield_self = trial('shield', 'self', 60, 20, undefined, true);
    out.open_lock_touch = trial('open_lock', 'touch', 80, 0, 1.4, true);
    out.paralyse_projectile = trial('paralyse', 'projectile', 20, 20, 6, true);
    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'diag-touch.json'), report);
for (const [k, v] of Object.entries(report)) {
  log(k, JSON.stringify(v.geometry), 'events=', (v.events || []).map((e) => e.kind + (e.effect ? ':' + e.effect : '')).join(','));
}
console.log(path.join(outDir, 'diag-touch.json'));
