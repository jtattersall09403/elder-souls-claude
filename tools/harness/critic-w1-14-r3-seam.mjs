#!/usr/bin/env node
// critic-w1-14-r3-seam.mjs — W1-14 round-3 CRITIC.
//
// AR-3 and the CONSUMPTION check, end to end. `game/data/quests/hooks.json` is the only file in
// the build that names the flags magic raises (`lock:*:open`, `shatter:*`, `trap:*:disarmed`,
// `fight_ended:calm_beast|demoralise|charm`). This walks one of each from a REFUSED resolution to
// an AVAILABLE one by casting the spell — which is the only demonstration ARBITRATION §3 accepts:
// perturb the model, watch a system that is not the model change what it permits.
//
// It also settles the surviving collision the builder admits: `calm_beast` and `demoralise` both
// set `yielded`, and Morrowind's split is that Calm stops the fight while Demoralise makes the
// target RUN. Positions come from listEntities(), because getCombatState().enemies[] carries no
// `pos` — which is why the first pass could not measure it.
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-seam.mjs — magic flags -> quest resolutions, and does demoralise flee?';
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
    const out = {};
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'U', sex: 'unrecorded' };
    const mage = () => {
      H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint(); H.setCharacter(CH);
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const cast = (effect, magnitude, range, dur, frames) => {
      const eff = D.effects.effects.find((e) => e.id === effect);
      const r = eff.ranges.includes(range) ? range : eff.ranges[0];
      const mk = H.makeSpell({ class: 'LIGHT', range: r, effects: [{ effect, magnitude, duration_s: dur || 0, area_r_m: 0 }] }, 'sm_' + effect);
      if (mk.refused) return { refused: mk.gate || mk.reason, ranges: eff.ranges };
      if (!H.setAttuned([mk.spell.id]).length) return { refused: 'attune' };
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(frames || 140);
      const ev = H.magicEventsDrain();
      return { range: r, delivered: ev.some((x) => x.kind === 'effect_apply'), kinds: [...new Set(ev.map((x) => x.kind))] };
    };

    // ---- A. every resolution in the book whose requires name a magic-raised flag ----------
    const book = H.questBook();
    const wanted = [];
    for (const qid of (book.ids || [])) {
      let rs = [];
      try { rs = H.questResolutions(qid) || []; } catch (e) { continue; }
      for (const r of rs) {
        const rid = r.id || r;
        let req = null;
        try { req = H.questResolutionRequirements(qid, rid); } catch (e) { continue; }
        const s = JSON.stringify(req || {});
        const m = s.match(/"(lock:[^"]+|shatter:[^"]+|trap:[^"]+|fight_ended:[^"]+)"/g);
        if (m) wanted.push({ quest: qid, res: rid, flags: [...new Set(m.map((x) => x.replace(/"/g, '')))], req });
      }
    }
    out.resolutions_gated_on_a_magic_flag = wanted.map((w) => ({ quest: w.quest, res: w.res, flags: w.flags }));

    // ---- B. walk one of each from refused -> available by casting -------------------------
    const walk = (effect, magnitude, range, at) => {
      mage();
      if (at) H.teleport(at[0], at[1]);
      H.stepFrames(4);
      const before = wanted.map((w) => { let req = null; try { req = H.questResolutionRequirements(w.quest, w.res); } catch (e) { req = { err: 1 }; }
        return { quest: w.quest, res: w.res, met: req && (req.met === undefined ? null : req.met), missing: req && req.missing }; });
      const c = cast(effect, magnitude, range, 0, 140);
      const after = wanted.map((w) => { let req = null; try { req = H.questResolutionRequirements(w.quest, w.res); } catch (e) { req = { err: 1 }; }
        return { quest: w.quest, res: w.res, met: req && (req.met === undefined ? null : req.met), missing: req && req.missing }; });
      const flipped = [];
      for (let i = 0; i < before.length; i++) {
        if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) flipped.push({ quest: before[i].quest, res: before[i].res, before: before[i], after: after[i] });
      }
      return { effect, cast: c, flipped_resolutions: flipped };
    };
    out.flag_to_resolution = [
      walk('open_lock', 100, 'touch', [0, 6]),
      walk('shatter', 120, 'touch', [-2, 5]),
      walk('ward_trap', 100, 'touch', [0, 6]),
    ];

    // ---- C. calm_beast vs demoralise: does either MOVE the body? -------------------------
    const control = (effect) => {
      mage(); H.teleport(0, 0);
      const e = H.spawn('beast_slitherfang', 0, 1.3, { as: 'cb' });
      H.aggro(e); H.stepFrames(24); H.setEntityPos('cb', 0, 1.3);
      const posOf = () => { const x = H.listEntities().find((v) => v.eid === 'cb'); return x && x.pos ? [ +x.pos[0].toFixed(2), +x.pos[2].toFixed(2) ] : null; };
      const p0 = posOf();
      const c = effect ? cast(effect, 30, 'touch', 30, 120) : (H.stepFrames(120), { control: true });
      const track = [];
      for (let i = 0; i < 12; i++) { H.stepFrames(60); track.push({ f: (i + 1) * 60, pos: posOf() }); }
      const p1 = posOf();
      const st = H.getStatusState().find((x) => x.id === 'cb') || {};
      return { effect: effect || 'control', cast: c, pos_start: p0, pos_end: p1,
        displacement_m: p0 && p1 ? +Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2) : null,
        distance_from_player_start_m: p0 ? +Math.hypot(p0[0], p0[1]).toFixed(2) : null,
        distance_from_player_end_m: p1 ? +Math.hypot(p1[0], p1[1]).toFixed(2) : null,
        yielded: !!st.yielded, in_combat: H.getPlayerStats().in_combat,
        track: track.filter((_, i) => i % 3 === 0) };
    };
    out.calm_vs_demoralise = [control(null), control('calm_beast'), control('demoralise'), control('charm')];

    // ---- D. bind_lesser vs bind_greater: is the summon the same thing? --------------------
    const bind = (effect, mag) => {
      mage(); H.teleport(0, 0); H.stepFrames(4);
      const e0 = H.listEntities().map((x) => x.eid);
      const c = cast(effect, mag, 'self', 30, 160);
      const e1 = H.listEntities().filter((x) => !e0.includes(x.eid));
      const w = H.getMagicWorld();
      return { effect, magnitude: mag, cast: c,
        new_entities: e1.map((x) => ({ eid: x.eid, kind: x.kind, archetype: x.archetype, hp: x.hp })),
        summons: (w.summons || []).map((s) => ({ ...s })) };
    };
    const bl = D.effects.effects.find((e) => e.id === 'bind_lesser');
    const bg = D.effects.effects.find((e) => e.id === 'bind_greater');
    out.binds = [bind('bind_lesser', bl.magnitude.min), bind('bind_lesser', bl.magnitude.max),
      bind('bind_greater', bg.magnitude.min), bind('bind_greater', bg.magnitude.max)];
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'seam.json'), report);
log('resolutions gated on a magic flag: ' + JSON.stringify(report.resolutions_gated_on_a_magic_flag, null, 1).slice(0, 1800));
log('flag->resolution: ' + JSON.stringify(report.flag_to_resolution, null, 1).slice(0, 2500));
log('calm vs demoralise: ' + JSON.stringify(report.calm_vs_demoralise, null, 1).slice(0, 2500));
log('binds: ' + JSON.stringify(report.binds, null, 1).slice(0, 2000));
console.log(path.join(outDir, 'seam.json'));
