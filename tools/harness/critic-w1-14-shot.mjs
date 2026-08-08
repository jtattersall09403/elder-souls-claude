#!/usr/bin/env node
// critic-w1-14-shot.mjs — one picture for W1-14 round 3's verdict.
//
// WHAT IT SHOWS AND WHY THIS ONE. The round's headline fix makes a summon's strength its
// magnitude, and it works: a 1-point call and a 90-point call put visibly different things on
// the floor. But it scales the body by writing `body.moves._weapon.attack_rating` in place, and
// for an enemy that object is the STATBLOCK's own (combat/enemy.js:47 sets `_weapon: weapon`
// with no copy), so the write is cumulative and permanent. This frame stands two summons side
// by side that came from TWO IDENTICAL CASTS of the same commissioned spell — same magnitude,
// same seed, same arena, nothing perturbed between them — and they are not the same creature.
//
// USAGE  node tools/harness/critic-w1-14-shot.mjs [--out <path>] [--entry <html>]
import path from 'node:path';
import fs from 'node:fs';
import { parseArgs, wantsHelp, usage, log, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-shot.mjs — the verdict's illustrative frame
  --out <path>   PNG path (default docs/shots/2026-08-08-w1-14-r3-critic-two-identical-casts-two-different-summons.png)
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const out = args.out ? path.resolve(String(args.out))
  : path.resolve('docs/shots/2026-08-08-w1-14-r3-critic-two-identical-casts-two-different-summons.png');
ensureDir(path.dirname(out));

const WIDTH = 1920;
const HEIGHT = 1080;

const handle = await launchGame({ ...args, width: WIDTH, height: HEIGHT });
let meta;
try {
  await handle.page.setViewportSize({ width: WIDTH, height: HEIGHT });
  meta = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    H.setSeed(4242);
    H.loadState('arena_flat');
    H.setViewport(1920, 1080);
    H.setRenderRate(1);
    H.resetMagicWorld();
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    H.setWillpower(99);
    H.setCatalyst('great_staff');
    H.setGold(2000000);
    H.hearthRest();
    for (const s of D.spells.spells) H.learnSpell(s.id);
    H.setTimeOfDay(9);

    const mk = H.makeSpell({ class: 'LIGHT', range: 'self',
      effects: [{ effect: 'bind_lesser', magnitude: 40, duration_s: 90, area_r_m: 0 }] }, 'Call the Deep (critic)');
    H.setAttuned([mk.spell.id]);
    const casts = [];
    const seen = new Set();
    for (let i = 0; i < 2; i++) {
      H.hearthRest();
      H.stepFrames(2);
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(110);
      const w = H.getMagicWorld();
      const fresh = w.summons.filter((s) => !seen.has(s.eid));
      for (const f of fresh) seen.add(f.eid);
      const s = fresh[fresh.length - 1] || null;
      casts.push({ cast: i + 1, eid: s ? s.eid : null, power: s ? s.power : null, hp: s ? s.hp : null, attack_rating: s ? s.attack_rating : null });
    }
    H.stepFrames(60);
    const ents = H.listEntities().filter((e) => e.kind !== 'object' && e.eid !== 'player')
      .map((e) => ({ eid: e.eid, pos: e.pos ? e.pos.map((v) => Math.round(v * 100) / 100) : null }));
    H.renderFrame();
    const cam = H.getCameraFrame ? H.getCameraFrame() : null;
    return { spell: mk.spell.id, casts, entities: ents, viewport: H.getViewport(),
      camera: cam ? { pos: cam.pos, look: cam.look || cam.target || null, fov: cam.fov || null, mode: cam.mode || null } : null };
  });
  await handle.page.screenshot({ path: out });
} finally {
  await handle.close();
}

log(`spell ${meta.spell}`);
for (const c of meta.casts) log(`  cast ${c.cast}: eid ${c.eid}  power ${c.power}  hp ${c.hp}  attack_rating ${c.attack_rating}`);
log(`camera ${JSON.stringify(meta.camera)}  viewport ${JSON.stringify(meta.viewport)}`);
fs.writeFileSync(out.replace(/\.png$/, '.json'), JSON.stringify(meta, null, 2));
console.log(out);
