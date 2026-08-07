#!/usr/bin/env node
// critic-w1-14-r3-qmag.mjs — W1-14 r3 CRITIC. RI-MAG04 M6, the only surface that answers it:
// questResolutions() reports `available` and `why` per resolution. Read it BEFORE and AFTER the
// spell the resolution names, for every Q-MAG quest.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
const args = parseArgs();
if (wantsHelp(args)) usage('critic-w1-14-r3-qmag.mjs');
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);
const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const D = H.getMagicData();
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };
    const mage = () => {
      H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery','root-speech','warding','veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const bk = H.questBook(); const all = Array.isArray(bk) ? bk.map((q) => q.id || q) : (bk.ids || Object.keys((bk.quests) || {})); const offers = (H.questOffers() || []).map((q) => q.id || q); const ids = [...new Set([...(all || []), ...offers])].filter((x) => /^Q-MAG-/.test(String(x)));
    const snap = () => { const o = {}; for (const q of ids) { try { o[q] = (H.questResolutions(q) || []).map((r) => ({ id: r.id, method: r.method, available: r.available, why: r.why })); } catch (e) { o[q] = 'err'; } } return o; };
    mage(); H.teleport(0, 6); H.stepFrames(4);
    const before = snap();
    // cast every world verb from inside reach
    const casts = [];
    for (const [eff, mag, at] of [['open_lock',100,[0,6]],['shatter',120,[-2,5]],['ward_trap',100,[0,6]],['detect_key',60,[0,0]]]) {
      H.teleport(at[0], at[1]); H.stepFrames(4);
      const mk = H.makeSpell({ class: 'LIGHT', range: 'touch', effects: [{ effect: eff, magnitude: mag, duration_s: 0, area_r_m: 0 }] }, 'q_' + eff);
      if (mk.refused) { casts.push({ eff, refused: mk.gate }); continue; }
      H.setAttuned([mk.spell.id]); H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(180);
      casts.push({ eff, kinds: [...new Set(H.magicEventsDrain().map((x) => x.kind))] });
    }
    const after = snap();
    const flipped = [];
    for (const q of ids) {
      const b = before[q], a = after[q];
      if (JSON.stringify(b) !== JSON.stringify(a)) flipped.push({ quest: q, before: b, after: a });
    }
    const availBefore = ids.flatMap((q) => (before[q] || []).filter((r) => r.available).map((r) => q + '/' + r.id));
    const availAfter = ids.flatMap((q) => (after[q] || []).filter((r) => r.available).map((r) => q + '/' + r.id));
    const nonviolentAfter = ids.flatMap((q) => (after[q] || []).filter((r) => r.available && r.method !== 'combat').map((r) => q + '/' + r.id + ':' + r.method));
    return { q_mag_quests: ids.length, casts, flipped_count: flipped.length, flipped: flipped.slice(0, 4),
      available_before: availBefore.length, available_after: availAfter.length,
      nonviolent_available_after: nonviolentAfter, sample_before: before[ids[0]] };
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'qmag.json'), report);
log(JSON.stringify(report, null, 1).slice(0, 3000));
console.log(path.join(outDir, 'qmag.json'));
