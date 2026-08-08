#!/usr/bin/env node
// w1-14-r3-summon.mjs — CONSUMPTION (RI-MTH07 §B) for the summon magnitude dial, and AR-1.
//
// The dial census (`w1-14-r3-dials.mjs`) answers a set question: does the world's leaf-path
// snapshot differ when the dial moves. That is necessary and it is not sufficient. RI-MTH07 §B2
// asks for something stricter and it asks for it in words: **perturb the model and watch an
// ENTITY CHANGE BEHAVIOUR.** A summon whose `hpMax` field differs between two casts has moved a
// number. A summon that kills you in half the time has changed behaviour.
//
// So this file does not read `hpMax` and stop. It stands the summoned body in front of the
// player, at two magnitudes off the same arena and the same seed, and measures what the body
// DOES over 600 f@60:
//
//   OFFENCE   the player's hp curve, sampled every 30 f@60, with the player not attacking.
//             A magnitude the world reads makes this curve steeper. A magnitude it does not
//             read makes the two curves lie on top of each other.
//   DEFENCE   the summon's hp curve, with the player attacking on a fixed input script.
//             Identical inputs, identical frames; the only difference is the number the spell
//             was made with.
//   CONTROL   the same arena with NOTHING SUMMONED. Player hp over the same 600 f@60. Without
//             this arm "the player lost hp" is not evidence that a summon did it, and the
//             offence figure is unattributed.
//
// THREE MORE THINGS THIS FILE ESTABLISHES, each of which the census cannot:
//
//  * EXCLUSIVITY. `bind_greater`'s catalogue note has read "One at a time, game-wide. A second
//    cast dismisses the first" for two rounds and nothing enforced it. Cast twice, count bodies:
//    `bind_greater` must leave one and `bind_lesser` must leave two.
//  * AR-1 (ARBITRATION §3). Magic that leaks Morrowind's dice into the fight is an automatic
//    fail of the piece. Two readings: `rng.draws` across a magic-heavy fight, which must not
//    move for the cast; and 20 identical casts from an identical arena, which must produce 20
//    identical outcomes. A chance-to-cast roll or a skill check deciding whether the spell fires
//    would show up as a spread. A REFUSAL is not a roll — a gate that refuses 20 times out of 20
//    is a rule; one that refuses 7 times out of 20 is Morrowind's dice in the fight.
//  * THE SIDE DEFECT, reported rather than fixed: `engine.spawn(..., {side:'ally'})` is passed
//    by the summon handler and IGNORED by `engine.spawn`, which hands every body to
//    `CombatSystem.spawnEnemy` as side 'E'. The bound thing fights the caster. That is a combat
//    file (`game/src/combat/system.js`, owned by W1-12) and this piece does not touch it; it is
//    measured here so the number is on the record.
//
// USAGE  node tools/harness/w1-14-r3-summon.mjs [--out <dir>] [--break=bindblind]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r3-summon.mjs — summon magnitude CONSUMPTION + exclusivity + AR-1

  --out <dir>      report directory (default reports/w1-14-r3)
  --break=bindblind  restore the magnitude-blind handler; the two hp curves must collapse onto
                     each other and the arms must stop differing
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);
const breakMode = args.break ? String(args.break) : null;

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (BREAK) => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    const notes = [];
    const out = { break_mode: BREAK || null };

    const arena = () => {
      H.setSeed(4242);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.resetMagicWorld();
      H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
      for (let i = 0; i < 700; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setEquipLoad(50);
      H.setGold(2000000);
      H.hearthRest();
      for (const s of D.spells.spells) H.learnSpell(s.id);
      if (BREAK === 'bindblind') H.__breakBindMagnitude();
      if (BREAK === 'fleeblind') H.__breakFleeMotion();
      H.magicEventsDrain();
    };

    /** Commission and cast one single-effect spell. Returns the effect_apply record. */
    const castBind = (effect, magnitude, duration_s) => {
      // AFFORDABILITY, CHECKED RATHER THAN ASSUMED. `bind_greater` at magnitude 90 for 60 s
      // quotes over the whole reservoir, so the spell is MADE (spellmaking never refuses a legal
      // tuple for Focus — RI-MAG03 §A) and then never fires. The first run of this file read that
      // as "the mag-90 greater summon did 0 damage", which is a measurement of the reservoir, not
      // of the dial. Back the DURATION off until the quote fits and record what was settled on.
      let d = duration_s;
      const spec = () => ({ class: 'LIGHT', range: 'self', effects: [{ effect, magnitude, duration_s: d, area_r_m: 0 }] });
      const fits = () => { const q = H.quoteSpell(spec()); return !q.refused && q.castable_now; };
      let guard = 0;
      while (d > 5 && guard++ < 20 && !fits()) d = Math.max(5, Math.floor(d / 2));
      const mk = H.makeSpell(spec(), `sum_${effect}_${magnitude}`);
      if (mk.refused) return { refused: mk.reason || mk.gate };
      if (!fits()) return { refused: 'over_reservoir', quote: H.quoteSpell(spec()) };
      H.setAttuned([mk.spell.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(70);
      const ev = H.magicEventsDrain();
      const ap = ev.find((x) => x.kind === 'effect_apply' && x.effect === effect);
      // THE SUMMON REGISTER, not the event. `applyEffects` emits only consumer/before/after/
      // changed, so the handler's own `power` / `hp` / `attack_rating` never reach the event
      // stream — the first run of this file read them as `undefined` and reported a model with
      // no numbers in it. `getMagicWorld().summons` is where the handler wrote them.
      const w = H.getMagicWorld();
      const reg = (w.summons || []).slice(-1)[0] || null;
      return { spell: mk.spell.id, applied: !!ap, record: ap || null, duration_s: d, register: reg,
               event_kinds: [...new Set(ev.map((x) => x.kind))],
               refusals: ev.filter((x) => /refus|denied|dropped|abort/i.test(String(x.kind)))
                 .map((x) => ({ kind: x.kind, reason: x.reason || x.gate || null, need: x.need, had: x.had })),
               quote: H.quoteSpell(spec()),
               // `effect_apply` carries only consumer/before/after/changed — the handler's extra
               // fields are dropped by `applyEffects`. `fight_ended` is where `demoralise` puts
               // its leash, so a reader that wants the MODEL's own number reads that event.
               fight_ended: ev.find((x) => x.kind === 'fight_ended') || null,
               dismissed: ev.filter((x) => x.kind === 'summon_dismissed') };
    };

    /** Who is on the floor that the player did not put there, and how strong is it. */
    const bodies = () => H.getCombatState().enemies.map((e) => ({ id: e.id, hp: e.hp, hp_max: e.hp_max, state: e.state, dead: e.dead }));

    // ==========================================================================================
    // A. OFFENCE + DEFENCE: what the summoned body DOES, at two magnitudes and with none at all.
    // ==========================================================================================
    const FRAMES = 600;
    const SAMPLE = 30;

    const arm = (effect, magnitude, playerAttacks) => {
      arena();
      const p0 = H.getPlayerStats();
      let cast = null;
      let sid = null;
      if (effect) {
        cast = castBind(effect, magnitude, 60);
        if (cast.refused) return { refused: cast.refused };
        const bs = bodies();
        sid = bs.length ? bs[bs.length - 1].id : null;
        // A CATALYST IN THE HAND MAKES `light` A CAST, NOT A SWING. The arena equips
        // `great_staff` because casting requires one, and the first run of this file then held
        // `light` down for 600 f@60 calling it "the player attacking" while the player recast
        // the same summon spell — which is why the summon's hp curve was flat at 1040 for the
        // whole run and the defence arm measured nothing. Staff down, attunement cleared, and
        // only then is `light` a weapon.
        if (sid) {
          H.aggro(sid);
          if (playerAttacks) { H.setAttuned([]); H.setCatalyst(null); H.lockOn(sid); }
        }
      } else {
        H.stepFrames(70);       // the same 70 f the cast consumes, so the arms line up in time
      }
      const summon0 = sid ? bodies().find((b) => b.id === sid) : null;
      const player_hp = [];
      const summon_hp = [];
      let f = 0;
      while (f < FRAMES) {
        if (playerAttacks) H.queueInputs([{ f: 1, press: ['light'] }, { f: 3, release: ['light'] }, { f: 16, press: ['light'] }, { f: 18, release: ['light'] }]);
        H.stepFrames(SAMPLE);
        f += SAMPLE;
        const ps = H.getPlayerStats();
        player_hp.push(Math.round(ps.hp));
        const s = sid ? bodies().find((b) => b.id === sid) : null;
        summon_hp.push(s ? Math.round(s.hp) : null);
      }
      const pEnd = H.getPlayerStats();
      const sEnd = sid ? bodies().find((b) => b.id === sid) : null;
      return {
        effect, magnitude, player_attacks: playerAttacks,
        // WHAT THE MODEL SAYS — the handler's own census record, for cross-checking against
        // what the body then did. A model that reports a scale it did not apply is caught here.
        model: cast && cast.register ? { power: cast.register.power, hp: cast.register.hp, attack_rating: cast.register.attack_rating,
                                         archetype: cast.register.archetype, magnitude: cast.record ? cast.record.magnitude : null } : null,
        cast_duration_s: cast ? cast.duration_s : null,
        cast_applied: cast ? cast.applied : null,
        cast_event_kinds: cast ? cast.event_kinds : null,
        cast_refusals: cast ? cast.refusals : null,
        cast_quote: cast && !cast.applied ? cast.quote : null,
        summon_id: sid,
        summon_hp_max: summon0 ? summon0.hp_max : null,
        player_hp_start: Math.round(p0.hp), player_hp_end: Math.round(pEnd.hp),
        player_damage_taken: Math.round(p0.hp - pEnd.hp),
        player_hp_series: player_hp,
        player_zero_at_f: (() => { const i = player_hp.findIndex((v) => v <= 0); return i < 0 ? null : (i + 1) * SAMPLE; })(),
        summon_hp_series: summon_hp,
        summon_hp_end: sEnd ? Math.round(sEnd.hp) : null,
        summon_dead: sEnd ? !!sEnd.dead : null,
        summon_damage_taken: summon0 && sEnd ? Math.round(summon0.hp_max - sEnd.hp) : null,
        summon_dead_at_f: (() => { const i = summon_hp.findIndex((v) => v !== null && v <= 0); return i < 0 ? null : (i + 1) * SAMPLE; })(),
      };
    };

    out.offence = {
      control_no_summon: arm(null, 0, false),
      lesser_mag_1: arm('bind_lesser', 1, false),
      lesser_mag_90: arm('bind_lesser', 90, false),
      greater_mag_1: arm('bind_greater', 1, false),
      greater_mag_90: arm('bind_greater', 90, false),
    };
    out.defence = {
      lesser_mag_1: arm('bind_lesser', 1, true),
      lesser_mag_90: arm('bind_lesser', 90, true),
      greater_mag_1: arm('bind_greater', 1, true),
      greater_mag_90: arm('bind_greater', 90, true),
    };

    // ==========================================================================================
    // B. EXCLUSIVITY. `bind_greater` says one at a time; `bind_lesser` says nothing of the kind.
    // ==========================================================================================
    const twice = (effect) => {
      arena();
      const n0 = H.getCombatState().enemies.length;
      const a = castBind(effect, 20, 60);
      H.stepFrames(120);
      const n1 = H.getCombatState().enemies.length;
      const b = castBind(effect, 20, 60);
      H.stepFrames(120);
      const n2 = H.getCombatState().enemies.length;
      return { effect, bodies_before: n0, after_first: n1, after_second: n2,
               net_summons: n2 - n0,
               dismissed_events: (b.dismissed || []).map((x) => ({ eids: x.eids, why: x.why })),
               first_applied: !!a.applied, second_applied: !!b.applied };
    };
    out.exclusivity = { greater: twice('bind_greater'), lesser: twice('bind_lesser') };

    // ==========================================================================================
    // B2. THE OTHER COLLISION: `calm_beast` vs `demoralise`.
    //
    // Same shape as the summon dial and measured the same way. `demoralise` wrote `fleeingUntil`
    // and `c.fleeing` and NOTHING read either, so a routed body stood still and the two effects
    // were one verb with two names. CONSUMPTION is the body's own position over time — not a
    // field, a distance — and the magnitude dial is what buys it.
    // ==========================================================================================
    const controlArm = (effect, magnitude) => {
      arena();
      const eid = H.spawn('beast_slitherfang', 0, 6.0);
      H.aggro(eid);
      H.stepFrames(30);
      // `dist_m` is the ENGINE's own distance from the player (`CombatSystem.distTo`), not a
      // number this file recomputes from two position arrays — `getCombatState()` does not
      // expose a body's position at all, and inventing one from `listEntities()` would be a
      // second implementation of a measurement the engine already publishes.
      const b0 = H.getCombatState().enemies.find((e) => e.id === eid);
      const d0 = b0.dist_m;
      let applied = false;
      let rec = null;
      let fe = null;
      if (effect) {
        const mk = H.makeSpell({ class: 'LIGHT', range: 'target', effects: [{ effect, magnitude, duration_s: 30, area_r_m: 0 }] }, `ctl_${effect}_${magnitude}`);
        if (mk.refused) return { refused: mk.reason || mk.gate };
        H.setAttuned([mk.spell.id]);
        H.lockOn(eid);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(90);
        const ev = H.magicEventsDrain();
        rec = ev.find((x) => x.kind === 'effect_apply' && x.effect === effect) || null;
        fe = ev.find((x) => x.kind === 'fight_ended') || null;
        applied = !!rec;
      } else H.stepFrames(90);
      H.stepFrames(600);
      const b1 = H.getCombatState().enemies.find((e) => e.id === eid);
      const d1 = b1 ? b1.dist_m : null;
      return {
        effect, magnitude, applied,
        model: fe ? { flee_leash_m: fe.flee_leash_m, flee_speed_mps: fe.flee_speed_mps, by: fe.by, deaths: fe.deaths } : null,
        status: (() => { const st = H.getStatusState(); const r = (st.bodies || st).find ? (st.bodies || st).find((b) => b.id === eid) : null;
                         return r ? { fleeing: r.fleeing, flee_leash_m: r.flee_leash_m, flee_dist_m: r.flee_dist_m, flee_arrived: r.flee_arrived, yielded: r.yielded } : null; })(),
        distance_before_m: Math.round(d0 * 100) / 100,
        distance_after_m: d1 === null ? null : Math.round(d1 * 100) / 100,
        moved_away_m: d1 === null ? null : Math.round((d1 - d0) * 100) / 100,
        enemy_hp: b1 ? b1.hp : null, enemy_dead: b1 ? !!b1.dead : null, enemy_yielded: b1 ? !!b1.yielded : null,
        enemy_state: b1 ? b1.state : null,
      };
    };
    out.control_verbs = {
      control_no_spell: controlArm(null, 0),
      calm_beast: controlArm('calm_beast', 30),
      demoralise_mag_1: controlArm('demoralise', 1),
      demoralise_mag_34: controlArm('demoralise', 34),
    };

    // ==========================================================================================
    // C. AR-1. Morrowind's dice, inside the fight.
    // ==========================================================================================
    // C1. The PRNG counter across a magic-heavy sequence. Nothing in the cast path may draw.
    arena();
    // WHAT THIS ACTUALLY READS. `getDeterminismReport()` has no draw counter (`rngDraws` is
    // `undefined` by construction); what it has is `violations`, and the guards it counts THROW
    // rather than tally — `Math.random`, `Date.now`, `performance.now` and `new Date()` are armed
    // for exactly one fixed step. So zero violations across a magic-heavy sequence is the
    // stronger statement, not the weaker one: not "no die was rolled that we counted" but "a die
    // could not have been rolled without the step failing loudly". The PRNG draw count is read
    // separately, off the trace, which is where `sim/record.js` publishes it.
    H.traceStart({ enemies: false, events: false });
    const d0 = H.getDeterminismReport();
    const mk = H.makeSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_lesser', magnitude: 45, duration_s: 30, area_r_m: 0 }] }, 'ar1_probe');
    H.setAttuned([mk.spell.id]);
    let casts = 0;
    for (let i = 0; i < 12; i++) {
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(90);
      casts += H.magicEventsDrain().filter((x) => x.kind === 'effect_apply').length;
    }
    const d1 = H.getDeterminismReport();
    const tr = H.traceDrain();
    const frames = Array.isArray(tr) ? tr : (tr.frames || []);
    const withRng = frames.filter((f) => f && f.rng);
    out.ar1_prng = {
      determinism_violations_before: d0.violations, determinism_violations_after: d1.violations,
      guards: d1.guards, armed_during: d1.armedDuring,
      trace_frames: frames.length,
      rng_draws_first: withRng.length ? withRng[0].rng.draws : null,
      rng_draws_last: withRng.length ? withRng[withRng.length - 1].rng.draws : null,
      rng_draws_delta: withRng.length ? withRng[withRng.length - 1].rng.draws - withRng[0].rng.draws : null,
      casts_applied: casts,
      note: 'Entity spawn draws once per body per lifetime (sim/entities.js), so the delta is compared against the number of BODIES SUMMONED, not against zero. What must be zero is the determinism violation count: the guards throw, so a Math.random() anywhere under the cast path would have killed the step rather than been counted.',
    };

    // C2. TWENTY IDENTICAL CASTS FROM AN IDENTICAL ARENA. A chance-to-cast roll or a skill check
    // deciding whether the spell fires produces a SPREAD. A rule produces 20/20 or 0/20.
    const repeat = (effect, magnitude, n) => {
      const results = [];
      for (let i = 0; i < n; i++) {
        arena();
        const r = castBind(effect, magnitude, 30);
        const b = bodies();
        results.push({ applied: !!r.applied, refused: r.refused || null,
                       hp_max: b.length ? b[b.length - 1].hp_max : null });
      }
      const applied = results.filter((r) => r.applied).length;
      const hps = [...new Set(results.map((r) => r.hp_max))];
      return { n, applied, refused: n - applied, distinct_hp_max: hps, deterministic: applied === 0 || applied === n };
    };
    out.ar1_determinism = {
      // The spell the caster can afford and is skilled enough for: must be 20/20.
      permitted: repeat('bind_lesser', 20, 20),
      // The same effect at a magnitude the reservoir cannot pay for: must be 0/20, by a NAMED
      // refusal, never a coin.
      over_reservoir: (() => {
        const results = [];
        for (let i = 0; i < 20; i++) {
          arena();
          const q = H.quoteSpell({ class: 'GREAT', range: 'self', effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 90, area_r_m: 0 }] });
          const st = H.getMagicState();
          results.push({ cost: q.refused ? null : q.focus_cost, focus_max: st.focus_max, castable: q.refused ? false : q.castable_now });
        }
        const castables = [...new Set(results.map((r) => r.castable))];
        const costs = [...new Set(results.map((r) => r.cost))];
        return { n: 20, distinct_castable: castables, distinct_cost: costs, deterministic: castables.length === 1 && costs.length === 1 };
      })(),
    };

    // C3. Does a SKILL CHECK decide whether the spell fires? Attunement is a shelf gate, and it
    // must refuse OUT of the fight, categorically, not roll INSIDE it.
    // Two arms, because a gate that never refuses proves nothing and a gate that always refuses
    // proves nothing either. UNDER-SKILLED: a fresh sheet that has never practised. PRACTISED:
    // the arena's own caster. The same six tier-4 spells, ten attempts each, in both.
    const attuneRuns = (setup) => {
      setup();
      const rows = [];
      for (const s of D.spells.spells.filter((x) => x.tier === 4).slice(0, 6)) {
        let accepted = 0;
        for (let i = 0; i < 10; i++) { H.setAttuned([]); const r = H.setAttuned([s.id]); if (Array.isArray(r) && r.includes(s.id)) accepted++; }
        rows.push({ spell: s.id, skill_req: s.skill_req, accepted_of_10: accepted });
      }
      return { rows, all_or_nothing: rows.every((r) => r.accepted_of_10 === 0 || r.accepted_of_10 === 10),
               accepted_total: rows.reduce((a, r) => a + r.accepted_of_10, 0) };
    };
    out.ar1_skill_gate = {
      under_skilled: attuneRuns(() => {
        H.setSeed(4242); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
        H.setCharacter({ race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
        H.setWillpower(99); H.setCatalyst('great_staff');
        for (const s of D.spells.spells) H.learnSpell(s.id);
      }),
      practised: attuneRuns(arena),
      note: 'AR-1 asks whether a die decides the fight. An attunement gate is a SHELF rule: it refuses the same spell every time, out of the fight, before the cast begins. 0/10 or 10/10 is a rule; 6/10 is Morrowind\'s dice.',
    };

    out.notes = notes;
    return out;
  }, breakMode);
} finally {
  await handle.close();
}

const o = report.offence, d = report.defence;
log(`break=${report.break_mode || '(none)'}`);
log(`OFFENCE (player not attacking, 600 f@60) — damage the player took:`);
log(`  control (no summon)  ${o.control_no_summon.player_damage_taken}`);
log(`  bind_lesser  mag 1  ${o.lesser_mag_1.player_damage_taken}   mag 90  ${o.lesser_mag_90.player_damage_taken}   (summon hp_max ${o.lesser_mag_1.summon_hp_max} vs ${o.lesser_mag_90.summon_hp_max})`);
log(`  bind_greater mag 1  ${o.greater_mag_1.player_damage_taken}   mag 90  ${o.greater_mag_90.player_damage_taken}   (summon hp_max ${o.greater_mag_1.summon_hp_max} vs ${o.greater_mag_90.summon_hp_max})`);
log(`DEFENCE (player on a fixed attack script) — damage the summon took / dead:`);
log(`  bind_lesser  mag 1  ${d.lesser_mag_1.summon_damage_taken} dead=${d.lesser_mag_1.summon_dead}@${d.lesser_mag_1.summon_dead_at_f}   mag 90  ${d.lesser_mag_90.summon_damage_taken} dead=${d.lesser_mag_90.summon_dead}@${d.lesser_mag_90.summon_dead_at_f}`);
log(`  bind_greater mag 1  ${d.greater_mag_1.summon_damage_taken} dead=${d.greater_mag_1.summon_dead}@${d.greater_mag_1.summon_dead_at_f}   mag 90  ${d.greater_mag_90.summon_damage_taken} dead=${d.greater_mag_90.summon_dead}@${d.greater_mag_90.summon_dead_at_f}`);
log(`EXCLUSIVITY  greater: ${report.exclusivity.greater.net_summons} body(ies) after two casts   lesser: ${report.exclusivity.lesser.net_summons}`);
const cv = report.control_verbs;
log(`CONTROL VERBS (distance from the caster, before -> after 600 f@60):`);
for (const k of Object.keys(cv)) {
  const r = cv[k];
  log(`  ${k.padEnd(20)} ${r.refused ? 'REFUSED ' + r.refused : `${r.distance_before_m} -> ${r.distance_after_m} m (moved ${r.moved_away_m}); yielded=${r.enemy_yielded} state=${r.enemy_state} leash=${r.model ? r.model.flee_leash_m : '-'}`}`);
}

log(`AR-1 repeat  permitted ${report.ar1_determinism.permitted.applied}/${report.ar1_determinism.permitted.n} applied, distinct hp_max ${JSON.stringify(report.ar1_determinism.permitted.distinct_hp_max)}`);
const g = report.ar1_skill_gate;
log(`AR-1 gate    under-skilled ${g.under_skilled.accepted_total} accepted of 60, all-or-nothing ${g.under_skilled.all_or_nothing};  practised ${g.practised.accepted_total} of 60, all-or-nothing ${g.practised.all_or_nothing}`);
log(`AR-1 prng    determinism violations ${report.ar1_prng.determinism_violations_before} -> ${report.ar1_prng.determinism_violations_after};  rng draws delta ${report.ar1_prng.rng_draws_delta} over ${report.ar1_prng.casts_applied} applied casts`);

const tag = report.break_mode ? `-break-${report.break_mode}` : '';
const p = path.join(outDir, `summon${tag}.json`);
writeJson(p, report);
console.log(p);
