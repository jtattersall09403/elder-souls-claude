#!/usr/bin/env node
// critic-w1-14-r3-recon.mjs — W1-14 round-3 CRITIC. Reconnaissance, not a verdict number.
// Establishes: default sheet skills, focus pool, what the builder's arena "practice" loop
// actually writes, and whether the census can run without it (RI-MAG06 M8).
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-recon.mjs — arena reconnaissance for the W1-14 r3 critic';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const out = { steps: [] };
    const D = H.getMagicData();
    out.effects_count = D.effects.effects.length;
    out.spells_count = D.spells.spells.length;

    const read = (label) => {
      const sh = H.getSkillSheet();
      const pick = {};
      for (const k of ['sorcery', 'root-speech', 'warding', 'veiling']) {
        const r = sh[k] || (sh.skills && sh.skills[k]);
        pick[k] = r ? (r.value !== undefined ? r.value : r) : null;
      }
      const ms = H.getMagicState();
      return {
        label, skills: pick, magic_skills: ms.skills || null,
        focus: ms.focus, focus_max: ms.focus_max,
        attunable: (ms.attunable !== undefined ? ms.attunable : null),
      };
    };

    // --- 1. the shipped default sheet, four states, NO harness skill call at all -----------
    for (const st of ['default', 'arena_flat', 'dungeon_primary']) {
      try { H.setSeed(4242); H.loadState(st); out.steps.push(read('state:' + st)); }
      catch (e) { out.steps.push({ label: 'state:' + st, error: String(e.message).slice(0, 120) }); }
    }

    // --- 2. after setCharacter(sap-reader) at creation, still no harness skill call --------
    H.setSeed(4242); H.loadState('arena_flat');
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    out.steps.push(read('sap-reader@creation'));

    // --- 3. the builder census arena's PRACTICE loop, measured -----------------------------
    const t0 = Date.now();
    for (let i = 0; i < 700; i++) {
      for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
      H.hearthRest();
    }
    out.practice_loop_ms = Date.now() - t0;
    out.steps.push(read('after builder practice loop (2800 grants + 700 hearth rests)'));
    out.sap_taint_after_practice = H.getSapTaint();

    // how much of that loop was needed? bisect by re-running at smaller counts
    const ladder = [];
    for (const n of [0, 1, 5, 10, 25, 50, 100, 200, 400, 700]) {
      H.setSeed(4242); H.loadState('arena_flat');
      H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
      for (let i = 0; i < n; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      const r = read('practice:' + n);
      // how many shelf spells can be attuned at this point?
      let ok = 0, refused = 0;
      for (const s of D.spells.spells) {
        H.learnSpell(s.id);
        const res = H.setAttuned([s.id]);
        if (res && res.refused) refused++; else ok++;
      }
      r.attunable_of = ok + '/' + (ok + refused);
      ladder.push(r);
    }
    out.practice_ladder = ladder;

    // --- 4. real casting: does one delivered cast advance the register, and by how much? ---
    H.setSeed(4242); H.loadState('arena_flat');
    H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
    H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000);
    H.hearthRest();
    const before = read('before real casts');
    // cheapest warding spell we can actually attune, cast repeatedly with hearth rests
    const cheap = D.spells.spells
      .filter((s) => (s.school === 'warding'))
      .map((s) => ({ s, c: H.spellCost(s.id) }))
      .sort((a, b) => (a.c.focus_cost || 1e9) - (b.c.focus_cost || 1e9));
    out.cheapest_warding = cheap.slice(0, 4).map((x) => ({ id: x.s.id, cost: x.c.focus_cost, tier: x.s.tier, skill_req: x.s.skill_req }));
    let casts = 0, delivered = 0;
    if (cheap.length) {
      const sid = cheap[0].s.id;
      H.learnSpell(sid);
      const att = H.setAttuned([sid]);
      out.attune_cheapest = att;
      const e = H.spawn('inf_trash', 0, 3.0);
      for (let i = 0; i < 60; i++) {
        H.magicEventsDrain();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(120);
        const ev = H.magicEventsDrain();
        casts++;
        if (ev.some((x) => x.kind === 'cast_effective')) delivered++;
        H.hearthRest();
      }
      H.despawn(e);
    }
    out.real_cast_probe = { casts, delivered, ...read('after ' + casts + ' real casts') };
    out.real_cast_before = before;
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'recon.json'), report);
log(JSON.stringify(report.steps, null, 1));
log('practice ladder: ' + report.practice_ladder.map((r) => `${r.label}=${JSON.stringify(r.skills)} ${r.attunable_of}`).join('\n  '));
log('real casts: ' + JSON.stringify({ casts: report.real_cast_probe.casts, delivered: report.real_cast_probe.delivered, before: report.real_cast_before.skills, after: report.real_cast_probe.skills }));
console.log(path.join(outDir, 'recon.json'));
