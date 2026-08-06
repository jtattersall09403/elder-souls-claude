#!/usr/bin/env node
// critic-w1-14-r2c.mjs — W1-14 round 2: the progression / quest-reachability probe.
//
//   A. TWO SKILL REGISTERS.  `MagicSystem.skills` gates attunement, Focus cost and spellmaking.
//      `sim.progression.skills` is what a quest resolution's `requires.skills` reads and what
//      RI-PRG03 advances by use. Are they the same numbers? Does casting move either?
//   B. THE MAGIC RESOLUTION, PLAYED.  Open Q-MAG-01, reach the magic resolution the way a
//      player would, and record every gate that refuses and why.
//   C. THE THINGS THE CENSUS ARENA COULD NOT SEE: detect_life with a body in range, frenzy with
//      a second body to turn on, mark->recall as a pair.
//   D. VFX draw-call series, measured off getWorldStats() at four named sample points.
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
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const skillsOf = () => {
      const sheet = H.getSkillSheet();
      const rows = Array.isArray(sheet) ? sheet : (sheet.skills || []);
      const m = {};
      for (const r of rows) m[r.id || r.skill] = r.value;
      return m;
    };
    const arena = (opts = {}) => {
      H.setSeed(7331); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      H.setWillpower(99); H.setCatalyst('great_staff');
      H.setGold(2000000); H.hearthRest();
      if (opts.learnAll !== false) for (const s of D.spells.spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      const eids = [];
      for (let i = 0; i < (opts.enemies || 0); i++) eids.push(H.spawn('inf_trash', i * 2.0 - 1.0, opts.dist === undefined ? 1.4 : opts.dist));
      if (opts.aggro) for (const e of eids) H.aggro(e);
      return eids;
    };
    const cast = (sid, frames) => { H.setAttuned([sid]); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(frames || 200); };
    const make = (effect, mag, range, dur, cls) => {
      const mk = H.makeSpell({ class: cls || 'LIGHT', range: range || 'self', effects: [{ effect, magnitude: mag, duration_s: dur || 0, area_r_m: 0 }] }, `p_${effect}`);
      if (mk.refused) return { refused: mk.reason || mk.gate };
      return mk.spell.id;
    };

    // =========================================================================================
    // A. TWO SKILL REGISTERS
    // =========================================================================================
    {
      arena({ enemies: 1, dist: 1.4, aggro: true });
      const before = { progression: skillsOf(), magic: H.getMagicState().skills || null, magic_via_data: null };
      // cast a SORCERY spell 20 times and a WARDING spell 20 times, at a live target
      const fire = make('fire_damage', 8, 'touch', 0);
      const sh = make('shield', 20, 'self', 10);
      const casts = [];
      for (let i = 0; i < 20; i++) { cast(fire, 90); H.hearthRest(); }
      const midS = skillsOf();
      for (let i = 0; i < 20; i++) { cast(sh, 90); H.hearthRest(); }
      const afterS = skillsOf();
      const ev = H.traceDrain ? null : null;
      out.skill_registers = {
        progression_before: before.progression,
        progression_after_20_sorcery_casts: midS,
        progression_after_20_more_warding_casts: afterS,
        magic_skills_after_40_casts: (() => { const st = H.getMagicState(); return st.skills || 'not reported by getMagicState()'; })(),
        magic_skill_gate_probe: H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 100, duration_s: 20, area_r_m: 0 }] }),
        note: 'MagicSystem.skills is a private object; getMagicState() may not report it. The quote above reports skill_req and attunable_now, which read it.',
      };
      // Does the character sheet's magic skill reach the magic system at all? Set it high on
      // progression and see whether the magic-side gate moves.
      H.setSkills({ warding: 100, sorcery: 100, veiling: 100, 'root-speech': 100 });
      out.skill_registers.quote_after_setSkills_100 = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 100, duration_s: 20, area_r_m: 0 }] });
      H.setMagicSkills({ warding: 100 });
      out.skill_registers.quote_after_setMagicSkills_100 = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 100, duration_s: 20, area_r_m: 0 }] });
    }

    // =========================================================================================
    // B. THE MAGIC RESOLUTION, PLAYED
    // =========================================================================================
    {
      const Q = 'Q-MAG-01';
      arena({});
      const offers0 = H.questOffers().filter((o) => o.id === Q);
      // give the player everything the offer gate asks for, one refusal at a time
      const openTry = [];
      let opened = H.questOpen(Q);
      openTry.push({ step: 'cold', result: opened });
      if (!opened.ok) {
        // satisfy whatever it named
        H.learnTopic && H.learnTopic('the ledger');
        opened = H.questOpen(Q);
        openTry.push({ step: 'after learnTopic', result: opened });
      }
      H.setSkills({ warding: 100, sorcery: 100 });
      H.setMagicSkills({ warding: 100, sorcery: 100, veiling: 100, root_speech: 100 });
      const gate0 = H.questResolutions(Q).find((x) => x.method === 'magic_utility');
      // cast the two effects — deliberately at a target that has NOTHING to do with the quest:
      // magnitude high enough to resolve on the arena's own registers.
      const ol = make('open_lock', 100, 'touch', 0);
      const sh = make('shatter', 120, 'touch', 0);
      H.spawn('inf_trash', 0, 1.4);
      cast(ol, 160); cast(sh, 160);
      const gate1 = H.questResolutions(Q).find((x) => x.method === 'magic_utility');
      const res = H.questResolve(Q, 'mag_the_warded_ledger__magic');
      out.quest_played = {
        offers_cold: offers0,
        open_attempts: openTry,
        gate_before_casting: gate0,
        cast_effects: H.getCastEffects(),
        gate_after_casting: gate1,
        resolve: res,
        journal_tail: H.getQuestState().journal.slice(-3),
        player_pos_at_resolution: H.getPlayerStats().pos,
        completed: H.getQuestState().completed,
      };
      // The location question: is the resolution reachable from anywhere?
      out.quest_played.note = 'the resolution above was taken standing in arena_flat, not in the Lilmoth customs loft';
    }

    // =========================================================================================
    // C. WHAT THE CENSUS ARENA COULD NOT SEE
    // =========================================================================================
    {
      // detect_life with a body inside the radius
      arena({ enemies: 2, dist: 4.0 });
      const dl = make('detect_life', 60, 'self', 20);
      const w0 = H.getMagicWorld();
      cast(dl, 140);
      const w1 = H.getMagicWorld();
      out.detect_life = { markers_before: w0.markers, markers_after: w1.markers, hud_elements: w1.hud_elements };

      // frenzy with a second body to turn on
      const eids = arena({ enemies: 2, dist: 3.0, aggro: true });
      H.stepFrames(30);
      const fr = make('frenzy', 30, 'target', 20);
      const st0 = H.getStatusState();
      cast(fr, 240);
      out.frenzy = { status_before: st0, status_after: H.getStatusState(),
        enemies_after: H.getCombatState().enemies.map((e) => ({ id: e.id, hp: e.hp, state: e.state, dead: e.dead })) };

      // mark -> recall as a pair, out of combat, both RITUAL (as shipped)
      arena({});
      H.setMagicSkills({ warding: 100, sorcery: 100, veiling: 100, root_speech: 100 });
      const mk = D.spells.spells.find((s) => s.effects.some((t) => t.effect === 'mark'));
      const rc = D.spells.spells.find((s) => s.effects.some((t) => t.effect === 'recall'));
      const p0 = H.getPlayerStats().pos.slice();
      cast(mk.id, 260);
      H.teleport(60, 60);
      const p1 = H.getPlayerStats().pos.slice();
      cast(rc.id, 300);
      const p2 = H.getPlayerStats().pos.slice();
      out.mark_recall = { at_mark: p0.map(r3), moved_to: p1.map(r3), after_recall: p2.map(r3),
        moved_m: Math.round(Math.hypot(p2[0] - p1[0], p2[2] - p1[2]) * 100) / 100,
        shipped: { mark: mk.id + '/' + mk.class, recall: rc.id + '/' + rc.class } };
    }

    // =========================================================================================
    // D. VFX draw calls at four sample points
    // =========================================================================================
    {
      arena({ enemies: 1, dist: 8.0 });
      H.setRenderRate(1);
      const sample = () => { H.renderFrame(); const w = H.getWorldStats(); return { drawCalls: w.drawCalls, triangles: w.triangles, vfx: w.vfx || null }; };
      const idle = sample();
      const proj = D.spells.spells.find((s) => s.geometry && s.geometry.kind === 'projectile');
      H.setAttuned([proj.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(26);
      const release = sample();
      H.stepFrames(10);
      const inflight = sample();
      H.stepFrames(1200);
      const residue = sample();
      out.vfx = { idle, release, inflight, residue_20s: residue, feature_report: H.getSpellVFXReport ? H.getSpellVFXReport() : null };
      H.setRenderRate(0);
    }

    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-progression-quest.json'), R);
log('skills:', JSON.stringify(R.skill_registers.progression_before), '->', JSON.stringify(R.skill_registers.progression_after_20_more_warding_casts));
log('quest resolve:', JSON.stringify(R.quest_played.resolve).slice(0, 300));
log('vfx:', JSON.stringify({ i: R.vfx.idle.drawCalls, r: R.vfx.release.drawCalls, f: R.vfx.inflight.drawCalls, s: R.vfx.residue_20s.drawCalls }));
console.log(path.join(outDir, 'critic-progression-quest.json'));
