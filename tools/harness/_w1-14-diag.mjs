import { parseArgs } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const handle = await launchGame(parseArgs());
const r = await handle.page.evaluate(async () => {
  const H = window.__HARNESS; await H.ready();
  const D = H.getMagicData();
  const variants = { base: {}, dmg: { dmg: 1 }, spawn: { spawn: 1 }, both: { dmg: 1, spawn: 1 }, full: { dmg: 1, spawn: 1, props: 1, aff: 1, stealth: 1 } };
  const out = {};
  for (const [name, v] of Object.entries(variants)) {
    H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' });
    for (let i = 0; i < 700; i++) { for (const sk of ['sorcery','root-speech','warding','veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
    H.setWillpower(99); H.setCatalyst('great_staff');
    if (v.stealth) { H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true }); H.setEquipLoad(50); }
    H.setGold(2000000); H.hearthRest();
    if (v.dmg) H.damagePlayer(220, { stagger: false });
    if (v.aff) { H.addAffliction('marsh_rot','disease'); H.addAffliction('sap_blight','poison'); H.addAffliction('stiff_limb','paralysis'); }
    H.setTravelMark([37, 0, -24]);
    if (v.props) { H.clearProps(); H.spawnProp({ eid: 'n', name: 'bowl', pos: [0.9,0,0.6], reach_m: 2.2 }); H.spawnProp({ eid: 'f', name: 'censer', pos: [0,0,6.5], reach_m: 2.2 }); }
    for (const s of D.spells.spells) H.learnSpell(s.id);
    H.stepFrames(320);
    if (v.spawn) { H.spawn('inf_trash', 0, 18.0); H.spawn('inf_trash', 2.6, 22.0); }
    H.magicEventsDrain();
    H.stepFrames(4);
    H.magicEventsDrain();
    const mk = H.makeSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'recall', magnitude: 1, duration_s: 0, area_r_m: 0 }] }, `d_${name}`);
    if (mk.refused) { out[name] = { makeRefused: mk }; continue; }
    H.setAttuned([mk.spell.id]);
    H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
    H.stepFrames(240);
    out[name] = { pos: H.getPlayerStats().pos.map((x) => Math.round(x * 100) / 100),
                  events: H.magicEventsDrain().map((e) => e.kind + (e.reason ? ':' + e.reason : '') + (e.fence ? ':' + e.fence : '')) };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1));
await handle.close();
