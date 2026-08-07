#!/usr/bin/env node
// critic-w1-14-r3-ladder.mjs — W1-14 round-3 CRITIC.
//
// Question 5 of the brief: 17/72 attunable is a large drop from round 1's 47/72. The builder
// frames it as the frozen skill register becoming real. This asks whether it is a fix or a new
// gate: CAN A PLAYER REACH THE TIER-3 AND TIER-4 SPELLS BY PLAYING, in a reasonable time?
//
// It measures the ladder with REAL CASTS ONLY — no `setMagicSkills`, no `setSkills`, and no
// `grantSkillUse`, which is the back door the builder's own census arena walks through 2,800
// times. A cast here is a queued `light` press with a catalyst equipped, exactly as a player
// casts, and the only thing that advances the register is the `cast_effective` the delivered
// cast emits.
//
// It also tests the gate for LEAKS: `fortify_skill` is read by `_effectiveSkillFor`, which is
// what `setAttuned` gates on — so a cheap fortify may open every tier at once.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-ladder.mjs — is the magic skill ladder climbable by playing?';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS; await H.ready(); H.setRenderRate(0);
    const D = H.getMagicData();
    const spells = D.spells.spells;
    const out = { notes: [] };

    const skills = () => { const s = H.getSkillSheet();
      return { sorcery: s.sorcery.value, 'root-speech': s['root-speech'].value, warding: s.warding.value, veiling: s.veiling.value }; };

    /** How many of the 72 shipped spells can this character actually attune RIGHT NOW? */
    const attunable = () => {
      let ok = 0; const refused = [];
      for (const s of spells) {
        const got = H.setAttuned([s.id]);
        if (got.length) ok++; else refused.push({ id: s.id, tier: s.tier, req: s.skill_req, school: s.school });
      }
      H.setAttuned([]);
      return { ok, of: spells.length, refused_by_tier: refused.reduce((a, r) => (a[r.tier] = (a[r.tier] || 0) + 1, a), {}) };
    };

    const fresh = (cls) => {
      H.setSeed(99); H.loadState('arena_flat'); H.setRenderRate(0);
      if (cls) H.setCharacter({ race: 'breton', upbringing: 'interior', class: cls, birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' });
      H.setCatalyst('great_staff');
      H.setGold(2000000);
      for (const s of spells) H.learnSpell(s.id);
      H.hearthRest();
    };

    // ---- 1. the shipped states, no character chosen -----------------------------------------
    out.shipped_states = [];
    for (const st of ['default', 'arena_flat', 'dungeon_primary']) {
      H.setSeed(99); H.loadState(st); H.setCatalyst('great_staff');
      for (const s of spells) H.learnSpell(s.id);
      out.shipped_states.push({ state: st, skills: skills(), ...attunable(), focus_max: H.getMagicState().focus_max });
    }
    // ---- 2. every class at creation ---------------------------------------------------------
    out.by_class = [];
    for (const c of H.getCreationData().classes.classes || H.getCreationData().classes) {
      const id = c.id || c;
      try { fresh(id); out.by_class.push({ class: id, skills: skills(), ...attunable(), focus_max: H.getMagicState().focus_max }); }
      catch (e) { out.by_class.push({ class: id, error: String(e.message).slice(0, 80) }); }
    }

    // ---- 3. THE CLIMB, by real casts only ---------------------------------------------------
    // Pick the cheapest tier-1 spell in each school the starting character can attune, cast it
    // at a live target, rest, repeat. Count casts and rests to 45 (tier 3) and 65 (tier 4).
    const climb = (cls, school, maxCasts) => {
      fresh(cls);
      const skillId = { sorcery: 'sorcery', root_speech: 'root-speech', warding: 'warding', veiling: 'veiling' }[school] || school;
      const costOf = (id) => { const c = H.spellCost(id); return typeof c === 'number' ? c : (c && (c.focus_cost !== undefined ? c.focus_cost : c.cost)); };
      const cands = spells.filter((s) => s.school === school && s.skill_req === 0)
        .map((s) => ({ s, cost: costOf(s.id) }))
        .filter((x) => Number.isFinite(x.cost))
        .sort((a, b) => a.cost - b.cost);
      if (!cands.length) return { school, error: `no castable tier-1 spell in this school (candidates ${spells.filter((s) => s.school === school && s.skill_req === 0).length}, costOf sample ${JSON.stringify(H.spellCost((spells.find((s) => s.school === school) || {}).id || 'spark_dart'))})` };
      const sid = cands[0].s.id;
      const got = H.setAttuned([sid]);
      if (!got.length) return { school, error: 'cannot attune even the cheapest tier-1 spell' };
      let e = H.spawn('inf_trash', 0, 3.0);
      const marks = {}; const start = H.getSkillSheet()[skillId].value;
      let casts = 0, rests = 0, effective = 0, frames = 0;
      const targets = [25, 45, 65, 85, 100];
      for (const t of targets) if (H.getSkillSheet()[skillId].value >= t) marks[t] = 0;
      while (casts < maxCasts) {
        // keep a live body in front of the caster so a cast can DELIVER
        const live = H.listEntities().filter((x) => x.kind !== 'object' && x.hp > 0 && x.eid !== 'player');
        if (!live.length) { e = H.spawn('inf_trash', 0, 3.0); }
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(110); frames += 110;
        casts++;
        if (H.getMagicState().focus < (cands[0].cost || 1)) { H.hearthRest(); rests++; }
        const v = H.getSkillSheet()[skillId].value;
        for (const t of targets) if (marks[t] === undefined && v >= t) marks[t] = casts;
        if (v >= 100) break;
      }
      const endSheet = H.getSkillSheet()[skillId];
      return { school, skill: skillId, spell: sid, focus_cost: cands[0].cost,
        start, end: endSheet.value, casts, rests, sim_frames: frames,
        sim_minutes_of_casting: +(frames / 60 / 60).toFixed(1),
        casts_to: marks, attunable_at_end: attunable() };
    };
    out.climb = [];
    for (const sch of ['warding', 'sorcery', 'root_speech', 'veiling']) {
      try { out.climb.push(climb('sap-reader', sch, 1200)); }
      catch (err) { out.climb.push({ school: sch, error: String(err.message).slice(0, 160) }); }
    }

    // ---- 4. THE GATE LEAK: does fortify_skill open every tier at once? -----------------------
    fresh('sap-reader');
    const before = { skills: skills(), ...attunable() };
    const fEff = D.effects.effects.find((x) => x.id === 'fortify_skill');
    const q = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'fortify_skill', magnitude: fEff.magnitude.max, duration_s: Math.min(60, fEff.duration.max_s || 0), area_r_m: 0 }] });
    let leak = { quote: q };
    if (!q.refused) {
      const mk = H.makeSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'fortify_skill', magnitude: fEff.magnitude.max, duration_s: Math.min(60, fEff.duration.max_s || 0), area_r_m: 0 }] }, 'crit fortify');
      if (!mk.refused) {
        H.setAttuned([mk.spell.id]);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(90);
        leak.after_cast = { skills: skills(), magic_state_effects: H.getMagicState().effects_active, ...attunable() };
      } else leak.make_refused = mk;
    }
    // the same at the CHEAPEST affordable fortify magnitude a starting character can attune
    fresh('sap-reader');
    const qlo = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'fortify_skill', magnitude: fEff.magnitude.min, duration_s: Math.min(60, fEff.duration.max_s || 0), area_r_m: 0 }] });
    leak.cheap_quote = qlo;
    if (!qlo.refused) {
      const mk = H.makeSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'fortify_skill', magnitude: fEff.magnitude.min, duration_s: Math.min(60, fEff.duration.max_s || 0), area_r_m: 0 }] }, 'crit fortify lo');
      if (!mk.refused) {
        H.setAttuned([mk.spell.id]);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(90);
        leak.cheap_after_cast = { skills: skills(), ...attunable() };
      }
    }
    out.fortify_leak = { before, ...leak };
    out.fortify_effect_record = { magnitude: fEff.magnitude, duration: fEff.duration, school: fEff.school, min_tier: fEff.min_tier };
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'ladder.json'), report);
log('shipped states: ' + JSON.stringify(report.shipped_states, null, 1));
log('climb: ' + JSON.stringify(report.climb.map((c) => ({ school: c.school, start: c.start, end: c.end, casts: c.casts, to: c.casts_to, min: c.sim_minutes_of_casting, attunable: c.attunable_at_end && c.attunable_at_end.ok })), null, 1));
log('fortify leak: before ' + JSON.stringify(report.fortify_leak.before) + '\n after ' + JSON.stringify(report.fortify_leak.after_cast || report.fortify_leak.make_refused || report.fortify_leak.quote));
console.log(path.join(outDir, 'ladder.json'));
