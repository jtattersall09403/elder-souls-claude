#!/usr/bin/env node
// critic-w1-14-r3-regress.mjs — W1-14 round-3 CRITIC.
//
// "Re-check what rounds 1 and 2 passed." A later round on this piece has repeatedly found an
// earlier pass broken, so every check that scored PASS in the round-1 or round-2 verdict is
// re-taken here from scratch: the cast census and its commitment window, AR-1 A2 (no dice),
// levitation's six assertions, S27 (Focus never regenerates; the Dry Well), S29 (the travel
// fence), the ward x kind matrix by a REAL scripted hit rather than the read-only probe, the
// five status procs, spellmaking, and enemy casters (RI-MAG01 §F, scored 0 in round 1 and never
// re-measured since).
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-regress.mjs — re-take every check rounds 1 and 2 passed';
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
    const mage = (state, sign) => {
      H.setSeed(5150); H.loadState(state || 'arena_flat'); H.setRenderRate(0);
      H.resetMagicWorld(); H.resetSapTaint();
      H.setCharacter({ ...CH, birthsign: sign || CH.birthsign });
      for (let i = 0; i < 700; i++) { for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk }); H.hearthRest(); }
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest(); H.magicEventsDrain();
    };
    const make = (spec, name) => { const m = H.makeSpell(spec, name); if (m.refused) return null; if (!H.setAttuned([m.spell.id]).length) return null; return m.spell; };

    // ---- 1. AR-1 A2 — NO DICE. 40 identical casts, one damage value. --------------------
    {
      const dmgs = [];
      for (let i = 0; i < 40; i++) {
        mage('arena_flat');
        const s = make({ class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 'dice');
        if (!s) { dmgs.push('refused'); continue; }
        const e = H.spawn('inf_trash', 0, 8, { as: 'd' + i });
        H.stepFrames(4);
        const hp0 = H.getCombatState().enemies.find((x) => x.id === 'd' + i).hp;
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(160);
        const en = H.getCombatState().enemies.find((x) => x.id === 'd' + i);
        if (en) dmgs.push(+(hp0 - en.hp).toFixed(4));
      }
      out.no_dice = { n: dmgs.length, distinct: [...new Set(dmgs)], pass: new Set(dmgs).size === 1 };
    }

    // ---- 2. cast census: frames per class, and the commitment window -------------------
    {
      mage('arena_flat');
      const rows = [];
      for (const cls of Object.keys(D.cast_classes.classes || D.cast_classes)) {
        const c = (D.cast_classes.classes || D.cast_classes)[cls];
        rows.push({ cls, declared: { startup: c.startup, active: c.active, recovery: c.recovery, hard_until: c.hard_until } });
      }
      // measure LIGHT: inject a roll on each frame of the cast and find the first that executes
      let firstRoll = null;
      for (let inject = 1; inject <= 70 && firstRoll === null; inject++) {
        mage('arena_flat');
        const s = make({ class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 20, duration_s: 0, area_r_m: 0 }] }, 'commit');
        if (!s) break;
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }, { f: 2 + inject, press: ['roll'] }, { f: 4 + inject, release: ['roll'] }]);
        let sawRoll = false, iframeSeen = false;
        for (let f = 0; f < 90; f++) {
          H.stepFrames(1);
          const cs = H.getCombatState();
          if (/ROLL|BACKSTEP/i.test(String(cs.player.state)) || (cs.player.move && /roll|backstep/i.test(String(cs.player.move.id)))) sawRoll = true;
          if (cs.player.invuln && /CAST/i.test(String(cs.player.state))) iframeSeen = true;
        }
        if (sawRoll) firstRoll = inject;
        out.cast_iframe_seen = out.cast_iframe_seen || iframeSeen;
      }
      out.cast_census = { classes: rows, first_frame_a_roll_executes: firstRoll, cast_iframes_observed: !!out.cast_iframe_seen };
    }

    // ---- 3. LEVITATION — six assertions --------------------------------------------------
    {
      mage('arena_flat');
      const walk = (() => { mage('arena_flat'); const p0 = H.getPlayerStats().pos.slice();
        H.queueInputs([{ f: 1, move: [0, 1] }]); H.stepFrames(120);
        const p1 = H.getPlayerStats().pos.slice();
        return +(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 2).toFixed(3); })();
      mage('arena_flat');
      const f0 = H.getMagicState().focus;
      H.setLevitating(true);
      const y0 = H.getPlayerStats().pos[1];
      H.queueInputs([{ f: 1, move: [0, 1] }]);
      const drops = []; let iframeFrames = 0;
      for (let f = 0; f < 240; f++) {
        H.stepFrames(1);
        if (H.getCombatState().player.invuln) iframeFrames++;
      }
      const y1 = H.getPlayerStats().pos[1];
      const f1 = H.getMagicState().focus;
      const p0 = H.getPlayerStats().pos.slice();
      H.stepFrames(120);
      const p1 = H.getPlayerStats().pos.slice();
      const drift = +(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 2).toFixed(3);
      // the five denied buttons
      const denied = {};
      for (const btn of ['light', 'heavy', 'block', 'roll', 'parry']) {
        const st0 = H.getCombatState().player.state;
        H.queueInputs([{ f: 1, press: [btn] }, { f: 3, release: [btn] }]);
        H.stepFrames(20);
        denied[btn] = { state_before: st0, state_after: H.getCombatState().player.state };
      }
      const hpBefore = H.getPlayerStats().hp;
      H.damagePlayer(37, { stagger: true });
      H.stepFrames(10);
      out.levitation = { altitude_gain_m: +(y1 - y0).toFixed(3), focus_spent: +(f0 - f1).toFixed(2),
        focus_per_metre: (y1 - y0) > 0.01 ? +((f0 - f1) / (y1 - y0)).toFixed(3) : null,
        drift_mps: drift, walk_mps: walk, iframe_frames_of_240: iframeFrames,
        buttons: denied, still_levitating_after_hit: H.getFallState().levitating,
        hp_lost_to_hit: +(hpBefore - H.getPlayerStats().hp).toFixed(1) };
    }

    // ---- 4. S27 — Focus never regenerates; the Dry Well takes the hearth ------------------
    {
      mage('arena_flat');
      const series = [];
      const f0 = H.getMagicState().focus;
      series.push({ at: 'start', focus: f0 });
      const s = make({ class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 30, duration_s: 0, area_r_m: 0 }] }, 's27');
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(120);
      series.push({ at: 'after cast', focus: H.getMagicState().focus });
      H.stepFrames(3600);
      series.push({ at: 'after 3600 idle frames', focus: H.getMagicState().focus });
      H.setTimeOfDay(3); H.stepFrames(600);
      series.push({ at: 'after time change + 600', focus: H.getMagicState().focus });
      const rest = H.hearthRest();
      series.push({ at: 'after hearth rest', focus: H.getMagicState().focus, rest });
      const monotone = series.slice(0, 4).every((v, i, a) => i === 0 || v.focus <= a[i - 1].focus);
      // the Dry Well
      mage('arena_flat', 'nu-ixtu');
      const dwSign = H.getCharacter && H.getCharacter().birthsign;
      const dw0 = H.getMagicState().focus;
      const s2 = make({ class: 'LIGHT', range: 'projectile', effects: [{ effect: 'fire_damage', magnitude: 30, duration_s: 0, area_r_m: 0 }] }, 's27dw');
      if (s2) H.setAttuned([s2.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); H.stepFrames(120);
      const dw1 = H.getMagicState().focus;
      const dwRest = H.hearthRest();
      const dw2 = H.getMagicState().focus;
      out.s27 = { series, monotone_non_increasing: monotone,
        dry_well: { sign: dwSign, focus_before: dw0, after_cast: dw1, after_hearth: dw2, rest: dwRest,
          hearth_restored: dw2 > dw1 } };
    }

    // ---- 5. S29 — the travel fence -------------------------------------------------------
    {
      const trial = (mode) => {
        mage('arena_flat');
        H.setTravelMark([60, 0, 60]);
        H.teleport(0, 0);
        const s = make({ class: 'LIGHT', range: 'self', effects: [{ effect: 'recall', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 's29_' + mode);
        if (!s) return { mode, refused: 'could not commission' };
        if (mode === 'fight') { const e = H.spawn('inf_trash', 1, 2); H.aggro(e); H.stepFrames(60); }
        else if (mode === 'cooldown') { H.damagePlayer(10, { stagger: false }); H.stepFrames(60); }
        else { H.stepFrames(400); }
        const p0 = H.getPlayerStats().pos.slice();
        H.magicEventsDrain();
        const pr = H.pressCast(200);
        const p1 = H.getPlayerStats().pos.slice();
        return { mode, moved_m: +Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(3),
          drops: pr.drops.slice(0, 3), travel_refused: pr.travel_refused.slice(0, 2) };
      };
      out.s29 = ['fight', 'cooldown', 'quiet'].map(trial);
      // and with the fence deliberately broken — the probe must be able to go red
      mage('arena_flat'); H.setTravelMark([60, 0, 60]); H.teleport(0, 0);
      H.__breakTravelFence();
      const s = make({ class: 'LIGHT', range: 'self', effects: [{ effect: 'recall', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, 's29_break');
      const e = H.spawn('inf_trash', 1, 2); H.aggro(e); H.stepFrames(60);
      const b0 = H.getPlayerStats().pos.slice();
      H.pressCast(200);
      const b1 = H.getPlayerStats().pos.slice();
      out.s29_break = { moved_m: +Math.hypot(b1[0] - b0[0], b1[2] - b0[2]).toFixed(3) };
    }

    // ---- 6. WARD x KIND, by a REAL scripted hit (not probeWard) ---------------------------
    {
      const KINDS = ['physical', 'fire', 'frost', 'shock', 'poison', 'disease', 'magic'];
      const row = (ward, mag) => {
        const o = { ward: ward || 'control' };
        for (const k of KINDS) {
          mage('arena_flat');
          if (ward) {
            const s = make({ class: 'LIGHT', range: 'self', effects: [{ effect: ward, magnitude: mag, duration_s: 30, area_r_m: 0 }] }, 'w_' + ward);
            if (!s) { o[k] = 'refused'; continue; }
            H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
            H.stepFrames(90);
          }
          const r = H.damagePlayer(100, { stagger: false, kind: k });
          o[k] = r.applied;
        }
        return o;
      };
      out.ward_matrix_real_hits = [row(null), row('shield', 80), row('resist_element', 85), row('resist_disease', 85), row('sap_ward', 1)];
    }

    // ---- 7. STATUS PROCS — five, treatment vs control on identical bodies -----------------
    {
      const proc = (kind) => {
        const measure = (apply) => {
          mage('arena_flat');
          const e = H.spawn('inf_trash', 0, 3, { as: 'sp' });
          H.aggro(e); H.stepFrames(30);
          if (apply) H.addStatusBuildup('sp', kind, 300);
          H.stepFrames(180);
          const st = H.getStatusState().find((x) => x.id === 'sp');
          const cs = H.getCombatState().enemies.find((x) => x.id === 'sp');
          return st ? { hp: st.hp, stamina_max: st.stamina_max, poise_health: st.poise_health,
            move_speed_mult: st.move_speed_mult, heal_blocked: st.heal_blocked,
            frostbitten: st.frostbitten, concussed: st.concussed, paralysed: st.paralysed,
            state: cs && cs.state, procs: st.procs } : null;
        };
        const t = measure(true), c = measure(false);
        return { kind, treatment: t, control: c, differs: JSON.stringify(t) !== JSON.stringify(c) };
      };
      out.status_procs = ['fire', 'frost', 'shock', 'poison', 'paralysis'].map(proc);
    }

    // ---- 8. ENEMY CASTERS (RI-MAG01 §F). Round 1: "Enemy casting does not exist." ---------
    {
      mage('arena_flat');
      const e = H.spawn('cst_sap_speaker', 0, 9, { as: 'caster' });
      H.aggro(e);
      H.combatTraceStart({});
      const states = new Set(); let castEvents = 0, playerHp0 = H.getPlayerStats().hp;
      for (let f = 0; f < 1200; f++) {
        H.stepFrames(1);
        const en = H.getCombatState().enemies.find((x) => x.id === 'caster');
        if (en) states.add(en.state + (en.anim ? '/' + en.anim : ''));
      }
      const recs = H.combatTraceStop();
      const ev = H.magicEventsDrain();
      castEvents = ev.filter((x) => /cast/i.test(String(x.kind))).length;
      out.enemy_casters = { archetype: 'cst_sap_speaker', frames: 1200,
        distinct_states: [...states].slice(0, 20), magic_cast_events: castEvents,
        player_hp_lost: +(playerHp0 - H.getPlayerStats().hp).toFixed(1),
        trace_records: recs.length };
    }

    // ---- 9. SPELLMAKING — unauthored tuples ----------------------------------------------
    {
      mage('arena_flat');
      const tuples = [
        { class: 'LIGHT', range: 'projectile', effects: [{ effect: 'frost_damage', magnitude: 37, duration_s: 0, area_r_m: 0 }, { effect: 'burden', magnitude: 22, duration_s: 12, area_r_m: 0 }] },
        { class: 'HEAVY', range: 'area_at_range', effects: [{ effect: 'shock_damage', magnitude: 61, duration_s: 0, area_r_m: 4 }] },
        { class: 'RITUAL', range: 'self', effects: [{ effect: 'levitate', magnitude: 12, duration_s: 45, area_r_m: 0 }, { effect: 'night_eye', magnitude: 30, duration_s: 45, area_r_m: 0 }, { effect: 'feather', magnitude: 40, duration_s: 45, area_r_m: 0 }] },
        { class: 'CANTRIP', range: 'touch', effects: [{ effect: 'silence', magnitude: 1, duration_s: 8, area_r_m: 0 }] },
        { class: 'LIGHT', range: 'self', effects: [{ effect: 'chameleon', magnitude: 79, duration_s: 20, area_r_m: 0 }] },
        { class: 'HEAVY', range: 'projectile', effects: [{ effect: 'soul_trap', magnitude: 1, duration_s: 20, area_r_m: 0 }, { effect: 'damage_health', magnitude: 55, duration_s: 0, area_r_m: 0 }] },
      ];
      out.spellmaking = tuples.map((t, i) => {
        const q = H.quoteSpell(t);
        const mk = q.refused ? null : H.makeSpell(t, 'sm' + i);
        let cast = null;
        if (mk && !mk.refused) {
          const att = H.setAttuned([mk.spell.id]);
          if (att.length) {
            H.magicEventsDrain();
            H.spawn('inf_trash', 0, 6);
            H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
            H.stepFrames(200);
            const ev = H.magicEventsDrain();
            cast = { applied: ev.filter((x) => x.kind === 'effect_apply').map((x) => x.effect) };
          } else cast = { attune: 'refused' };
        }
        return { tuple: t.effects.map((x) => x.effect).join('+') + '@' + t.class + '/' + t.range,
          quote_refused: q.refused || false, gate: q.gate || null, tier: q.tier, focus_cost: q.focus_cost, gold: q.gold, cast };
      });
      out.spellmaking_survives_save = (() => {
        const before = H.getMagicState();
        const blob = H.saveState();
        H.loadState('arena_flat');
        H.restoreState(blob);
        const after = H.getMagicState();
        return { custom_before: (before.custom || []).length, custom_after: (after.custom || []).length };
      })();
    }
    return out;
  });
} finally { await handle.close(); }

writeJson(path.join(outDir, 'regress.json'), report);
for (const k of Object.keys(report)) log(`== ${k}\n${JSON.stringify(report[k], null, 1).slice(0, 2500)}`);
console.log(path.join(outDir, 'regress.json'));
