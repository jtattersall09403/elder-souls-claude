#!/usr/bin/env node
// critic-w1-14-r2b.mjs — the W1-14 round-2 critic's targeted probe.
//
// Every block below tests ONE claim the round-2 checkpoint makes, by driving the running game
// and reading an entity-side quantity. Nothing here calls a magic method and reports its return
// value as a measurement (RI-MTH07 §B2).
//
//  1. MITIGATION KIND        shield / resist_element / resist_disease against the SAME hit.
//  2. STATUS PROC CONSUMERS  what BURNING / FROSTBITE / CONCUSSED / POISONED change, vs PARALYSED.
//  3. LEVITATION DENIAL      the five buttons, pressed for real; i-frames; drift; Focus/m; pos[1].
//  4. QUEST GATE             own-vs-cast; and whether the gate cares WHERE or on WHAT you cast.
//  5. THE TWO STRUCTURAL BUGS  `_emit` kind collision; `SimState.reset()` journal detachment.
//  6. CONTROL VERBS          calm_beast on an aggroed beast: deaths, in_combat, hp.
//  7. ROUND-1 PASSES         cast frames, zero PRNG on the cast path, ballistics, tracking arc.
//  8. HAND-FEED AUDIT        can the cure/restore effects' preconditions arise without a harness call?
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

    const arena = (opts = {}) => {
      H.setSeed(9001); H.loadState('arena_flat'); H.setRenderRate(0); H.resetMagicWorld();
      H.setWillpower(99); H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.setEquipLoad(opts.load === undefined ? 50 : opts.load);
      H.setGold(2000000); H.hearthRest();
      if (opts.learnAll !== false) for (const s of D.spells.spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      let eid = null;
      if (opts.enemy) { eid = H.spawn(opts.archetype || 'inf_trash', 0, opts.dist === undefined ? 1.4 : opts.dist); if (opts.aggro !== false) H.aggro(eid); }
      return eid;
    };
    const make = (effect, mag, range, dur, cls) => {
      const mk = H.makeSpell({ class: cls || 'LIGHT', range: range || 'self', effects: [{ effect, magnitude: mag, duration_s: dur || 0, area_r_m: 0 }] }, `probe_${effect}`);
      if (mk.refused) throw new Error(`makeSpell(${effect}) refused: ${mk.reason || mk.gate}`);
      return mk.spell.id;
    };
    const cast = (sid, frames) => { H.setAttuned([sid]); H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(frames || 200); };

    // =========================================================================================
    // 1. MITIGATION — three handlers, one field? Same scripted PHYSICAL hit under each.
    // =========================================================================================
    {
      const trial = (effect, mag) => {
        arena({});
        if (effect) { const s = make(effect, mag, 'self', 20); cast(s, 120); }
        return H.damagePlayer(100, { stagger: false });
      };
      const M = 20;
      out.mitigation_kind = {
        note: 'IDENTICAL scripted PHYSICAL hit of 100. A resist-DISEASE buff must not blunt a sword.',
        magnitude_used: M,
        baseline: trial(null),
        shield: trial('shield', M),
        resist_element: trial('resist_element', M),
        resist_disease: trial('resist_disease', M),
        sap_ward: trial('sap_ward', 1),
      };
      // And the converse: does `shield` (physical) blunt a FIRE spell? Cast shield on an enemy,
      // then hit that enemy with a fire spell, against a no-shield control.
      const fireAt = (buff) => {
        const eid = arena({ enemy: true, dist: 1.4, aggro: false });
        const hp0 = H.getCombatState().enemies[0].hp;
        if (buff) { const s = make(buff, 20, 'touch', 20); cast(s, 120); }
        const f = make('fire_damage', 40, 'touch', 0); cast(f, 160);
        const e = H.getCombatState().enemies[0];
        return { hp_before: hp0, hp_after: e.hp, taken: r3(hp0 - e.hp) };
      };
      out.mitigation_kind.fire_vs_physical_shield = { none: fireAt(null), shield_physical: fireAt('shield'), resist_element: fireAt('resist_element') };
    }

    // =========================================================================================
    // 2. STATUS PROCS — the S11 meter procs. Does anything read the proc other than paralysis?
    // =========================================================================================
    {
      const proc = (effect, kind, mag) => {
        const eid = arena({ enemy: true, dist: 1.4, aggro: true });
        const s = make(effect, mag, 'touch', 0);
        H.setAttuned([s]);
        const seen = [];
        for (let i = 0; i < 12; i++) {
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          H.stepFrames(70);
          const st = H.getStatusState();
          const e = H.getCombatState().enemies[0];
          seen.push({ i, meters: st.map((x) => ({ id: x.id, meters: x.meters, procs: x.procs, paralysed: x.paralysed })), state: e ? e.state : null, hp: e ? e.hp : null, dead: e ? e.dead : null });
          if (!e || e.dead) break;
        }
        const ev = H.magicEventsDrain().filter((x) => x.kind === 'status_proc' || x.kind === 'status_buildup');
        return { kind, samples: seen, proc_events: ev.filter((x) => x.kind === 'status_proc').map((x) => ({ f: x.frame, status_kind: x.status_kind, proc: x.proc, until_f: x.until_f })) };
      };
      out.status_procs = {
        fire: proc('fire_damage', 'fire', 6),
        paralysis: proc('paralyse', 'paralysis', 8),
      };
      // The decisive read: with BURNING active, does the enemy behave differently at all?
      out.status_procs.note = 'compare enemy.state across the samples once the proc fires';
    }

    // =========================================================================================
    // 3. LEVITATION — press the five denied buttons for real and read the body, not a flag.
    // =========================================================================================
    {
      arena({ enemy: true, dist: 3.0, aggro: false });
      const lev = make('levitate', 1, 'self', 60);
      const focus0 = H.getMagicState().focus;
      cast(lev, 90);
      // climb: hold jump
      H.queueInputs([{ f: 1, press: ['jump'] }]);
      H.stepFrames(420);
      const midFocus = H.getMagicState().focus;
      const fs = H.getFallState();
      const cs0 = H.getCombatState();
      const buttons = ['light', 'heavy', 'block', 'roll', 'parry'];
      const per = [];
      for (const btn of buttons) {
        const before = H.getCombatState().player;
        H.queueInputs([{ f: 1, press: [btn] }, { f: 3, release: [btn] }]);
        H.stepFrames(20);
        const after = H.getCombatState().player;
        per.push({ button: btn, state_before: before.state, state_after: after.state, move_after: after.move || null, iframe_after: !!after.iframe });
      }
      // i-frames across the whole flight, and whether a hit actually lands while airborne.
      let anyIframe = false;
      for (let i = 0; i < 60; i++) { H.stepFrames(1); if (H.getCombatState().player.iframe) anyIframe = true; }
      const hpBefore = H.getPlayerStats().hp;
      const hit = H.damagePlayer(37, { stagger: false });
      out.levitation = {
        focus_at_cast: focus0, focus_after_climb: midFocus,
        fall: fs, pos_y_m: fs.pos_y_m, altitude_state: H.getMagicState().levitation || null,
        state_during: cs0.player.state,
        buttons: per,
        any_iframe_true_over_60_frames: anyIframe,
        damage_while_airborne: { hp_before: hpBefore, applied: hit.applied, hp_after: hit.hp },
        magic_after_hit: { levitating: H.getMagicState().levitating, pos_y: H.getFallState().pos_y_m },
      };
      // drift vs walk, both measured the same way
      const drift = () => {
        arena({});
        const s = make('levitate', 1, 'self', 60); cast(s, 90);
        H.queueInputs([{ f: 1, press: ['jump'] }]); H.stepFrames(180);
        const p0 = H.getPlayerStats().pos.slice();
        H.clearInputs(); H.queueInputs([{ f: 1, move: [0, 1] }]); H.stepFrames(120);
        const p1 = H.getPlayerStats().pos.slice();
        return { from: p0.map(r3), to: p1.map(r3), mps: r3(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 2), state: H.getCombatState().player.state };
      };
      const walk = () => {
        arena({});
        const p0 = H.getPlayerStats().pos.slice();
        H.queueInputs([{ f: 1, move: [0, 1] }]); H.stepFrames(120);
        const p1 = H.getPlayerStats().pos.slice();
        return { mps: r3(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 2), state: H.getCombatState().player.state };
      };
      out.levitation.drift = drift();
      out.levitation.walk_control = walk();
    }

    // =========================================================================================
    // 4. THE QUEST GATE — owning vs casting, and whether the gate cares where/on what.
    // =========================================================================================
    {
      const Q = 'Q-MAG-01';
      const reqs = H.questResolutionRequirements(Q, 'mag_the_warded_ledger__magic');
      // (a) OWN the spells, never cast them.
      arena({});
      H.questOpen(Q);
      const owned = H.questResolutions(Q);
      const castSet0 = H.getCastEffects();
      // (b) cast open_lock and shatter — but at NOTHING relevant: at an enemy body, in an arena
      //     with the ward registers reset, standing nowhere near the customs house.
      const s1 = make('open_lock', 1, 'touch', 0);      // magnitude 1 opens NO lock (tier*20 > 1)
      cast(s1, 120);
      const s2 = make('shatter', 1, 'touch', 0);        // hardness 25 > 1: shatters nothing
      cast(s2, 120);
      const afterCast = H.questResolutions(Q);
      const world = H.getMagicWorld();
      const resolved = H.questResolve(Q, 'mag_the_warded_ledger__magic');
      out.quest_gate = {
        requirements: reqs,
        owned_only: owned.find((x) => x.method === 'magic_utility'),
        cast_effects_before: castSet0,
        cast_effects_after: H.getCastEffects(),
        after_futile_casts: afterCast.find((x) => x.method === 'magic_utility'),
        locks_after: world.locks,
        breakables_after: world.breakables,
        player_pos: H.getPlayerStats().pos,
        resolve: resolved,
        journal_tail: H.getQuestState().journal.slice(-2),
      };
    }

    // =========================================================================================
    // 4b. S19 / AR-2: teleport out of a fight. The SHIPPED recall/intervention are RITUAL and a
    //     ritual cannot finish in a fight. Spellmaking sets the class, so: make a LIGHT-class
    //     Intervention, aggro something, and see whether the escape button exists.
    // =========================================================================================
    {
      const eid = arena({ enemy: true, dist: 3.0, aggro: true });
      H.stepFrames(40);
      const before = { pos: H.getPlayerStats().pos.slice(), in_combat: H.getPlayerStats().in_combat };
      const s = make('intervention', 45, 'self', 0, 'LIGHT');
      cast(s, 200);
      const after = { pos: H.getPlayerStats().pos.slice(), in_combat: H.getPlayerStats().in_combat };
      const ev = H.magicEventsDrain().filter((x) => x.kind === 'teleport' || x.kind === 'intervention_refused' || x.kind === 'cast_interrupt');
      // and the same with mark/recall
      const eid2 = arena({ enemy: true, dist: 3.0, aggro: false });
      const mk = make('mark', 1, 'self', 0, 'LIGHT'); cast(mk, 120);
      H.teleport(60, 60);
      H.aggro(eid2); H.stepFrames(40);
      const rp0 = H.getPlayerStats().pos.slice();
      const rc = make('recall', 45, 'self', 0, 'LIGHT'); cast(rc, 200);
      const rp1 = H.getPlayerStats().pos.slice();
      out.teleport_in_fight = {
        intervention: { before, after, events: ev.map((x) => ({ f: x.frame, kind: x.kind, from: x.from, to: x.to, cause: x.cause })),
          moved_m: Math.round(Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]) * 100) / 100 },
        recall: { from: rp0.map(r3), to: rp1.map(r3), in_combat_at_cast: true,
          moved_m: Math.round(Math.hypot(rp1[0] - rp0[0], rp1[2] - rp0[2]) * 100) / 100 },
        shipped_classes: D.spells.spells.filter((x) => x.effects.some((t) => ['recall', 'intervention', 'mark'].includes(t.effect))).map((x) => ({ id: x.id, class: x.class })),
      };
    }

    // =========================================================================================
    // 5. THE TWO STRUCTURAL BUGS
    // =========================================================================================
    {
      // (a) `_emit(frame, kind, fields)` spreading a field literally named `kind`.
      const eid = arena({ enemy: true, dist: 1.4, aggro: true });
      const s = make('fire_damage', 30, 'touch', 0); cast(s, 160);
      const ev = H.magicEventsDrain();
      const kinds = {};
      for (const e of ev) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
      out.emit_kind_bug = {
        event_kinds: kinds,
        status_buildup_events: ev.filter((x) => x.kind === 'status_buildup').slice(0, 3),
        any_event_kind_is_an_element: Object.keys(kinds).filter((k) => ['fire', 'frost', 'shock', 'poison', 'paralysis'].includes(k)),
      };
      // (b) SimState.reset() replacing sim.quest — a QuestEngine writing into a detached journal.
      arena({});
      const j0 = H.getQuestState().journal.length;
      H.loadState('arena_flat');                     // the reset that detached it in round 1
      const j1 = H.getQuestState().journal.length;
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(2000000); H.hearthRest();
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      for (const sp of D.spells.spells) H.learnSpell(sp.id);
      const hs = make('hist_sight', 4, 'self', 20);
      cast(hs, 260);
      const j2 = H.getQuestState().journal.length;
      // and a quest transition after the same reset
      H.questOpen('Q-MAG-02');
      const j3 = H.getQuestState().journal.length;
      out.quest_detachment = { journal_before_reset: j0, after_reset: j1, after_hist_sight: j2, after_questOpen: j3, tail: H.getQuestState().journal.slice(-2) };
    }

    // =========================================================================================
    // 6. CONTROL VERBS — a fight that ends without a corpse (AR-3 X1, B12 clause c).
    // =========================================================================================
    {
      const verb = (effect, mag, archetype) => {
        const eid = arena({ enemy: true, archetype, dist: 4.0, aggro: true });
        H.stepFrames(30);
        const before = { in_combat: H.getPlayerStats().in_combat, e: H.getCombatState().enemies[0] };
        const s = make(effect, mag, 'target', 30);
        cast(s, 300);
        const ev = H.traceDrain ? [] : [];
        const e = H.getCombatState().enemies[0];
        return {
          hp_before: before.e ? before.e.hp : null, hp_after: e ? e.hp : null,
          in_combat_before: before.in_combat, in_combat_after: H.getPlayerStats().in_combat,
          state_after: e ? e.state : null, dead: e ? e.dead : null, yielded: e ? e.yielded : null,
          entities: H.listEntities().length,
        };
      };
      out.control_verbs = {
        calm_beast_on_beast: verb('calm_beast', 60, 'beast_slitherfang'),
        demoralise: verb('demoralise', 30, 'inf_trash'),
        charm: verb('charm', 30, 'inf_trash'),
      };
    }

    // =========================================================================================
    // 7. ROUND-1 PASSES, re-checked.
    // =========================================================================================
    {
      // cast frames per class, from the trace, and zero PRNG draws on the cast path
      const frames = {};
      for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT', 'RITUAL']) {
        arena({});
        const s = make('fire_damage', 10, 'touch', 0, cls);
        const d0 = H.getDeterminismReport();
        H.setAttuned([s]);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(260);
        const ev = H.magicEventsDrain();
        const st = ev.find((x) => x.kind === 'cast_start');
        const rel = ev.find((x) => x.kind === 'cast_release');
        frames[cls] = { start_f: st ? st.frame : null, release_f: rel ? rel.frame : null,
          declared: D['cast-classes'] ? null : null,
          rng_before: d0.draws === undefined ? d0 : d0.draws, rng_after: (() => { const d = H.getDeterminismReport(); return d.draws === undefined ? d : d.draws; })() };
      }
      out.cast_frames = frames;
      // ballistics + tracking arc, measured off the projectile
      const track = (spellId) => {
        const eid = arena({ enemy: true, dist: 14, aggro: false });
        H.setAttuned([spellId]);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const head = [];
        for (let i = 0; i < 200; i++) {
          H.stepFrames(1);
          const ms = H.getMagicState();
          const p = (ms.projectiles || [])[0];
          if (p) head.push({ f: H.getFrame(), heading: p.heading_deg, speed: p.speed_mps, target: p.target || null, tracking: p.tracking });
        }
        const rates = [];
        for (let i = 1; i < head.length; i++) {
          let d = head[i].heading - head[i - 1].heading;
          while (d > 180) d -= 360; while (d < -180) d += 360;
          rates.push({ f: head[i].f, dps: Math.round(Math.abs(d) * 60 * 100) / 100, tracking: head[i].tracking });
        }
        return { samples: head.length, max_dps: rates.length ? Math.max(...rates.map((x) => x.dps)) : null, rates: rates.slice(0, 90), speed: head.length ? head[0].speed : null };
      };
      const spellIds = D.spells.spells.filter((s) => s.geometry && s.geometry.kind === 'projectile').map((s) => s.id);
      out.tracking = {};
      for (const id of spellIds.slice(0, 3)) out.tracking[id] = track(id);
    }

    // =========================================================================================
    // 8. HAND-FEED AUDIT (RI-MTH07 §C3): can the preconditions arise without a harness call?
    // =========================================================================================
    {
      arena({});
      const p0 = H.getPlayerStats();
      H.addAffliction('marsh_rot', 'disease');
      const afterAdd = { quest_afflictions: H.getQuestState().afflictions, player_afflictions: H.getPlayerStats().afflictions };
      const s = make('cure_disease', 5, 'self', 0); cast(s, 140);
      out.hand_feed = {
        player_afflictions_field: p0.afflictions,
        after_addAffliction: afterAdd,
        after_cure: { quest_afflictions: H.getQuestState().afflictions, player_afflictions: H.getPlayerStats().afflictions },
        note: 'getPlayerStats().afflictions is the hazard system register (VECTOR hazards write it). getQuestState().afflictions is what cure_* splices.',
      };
      // restore_attribute: is there any reachable state where an attribute is below base?
      arena({});
      const a0 = { ...H.getPlayerStats().attributes };
      const ra = make('restore_attribute', 40, 'self', 0); cast(ra, 140);
      out.hand_feed.restore_attribute = { before: a0, after: { ...H.getPlayerStats().attributes } };
    }

    return out;
  });
} finally { await handle.close(); }
writeJson(path.join(outDir, 'critic-targeted.json'), R);
log('mitigation:', JSON.stringify(Object.fromEntries(Object.entries(R.mitigation_kind).filter(([k]) => ['baseline', 'shield', 'resist_element', 'resist_disease', 'sap_ward'].includes(k)).map(([k, v]) => [k, v.applied]))));
log('fire vs shield:', JSON.stringify(R.mitigation_kind.fire_vs_physical_shield));
log('levitation buttons:', JSON.stringify(R.levitation.buttons));
log('quest gate owned:', JSON.stringify(R.quest_gate.owned_only), '| after futile casts:', JSON.stringify(R.quest_gate.after_futile_casts), '| resolve:', JSON.stringify(R.quest_gate.resolve).slice(0, 200));
console.log(path.join(outDir, 'critic-targeted.json'));
