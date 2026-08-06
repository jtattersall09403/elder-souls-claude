#!/usr/bin/env node
// mag-probe.mjs — the live half of seam S19's measurement.
//
// RI-MAG01 M1-M6, RI-MAG02 M4/M5 and RI-MAG03 M1/M2/M4/M5, written as a tool. It scores
// nothing: the items' own weights and bands are the critic's to apply. This produces the
// observations, and every one of them is read out of the running simulation rather than out
// of a data file — RI-MAG01 M2 is explicit that the dual-cost check "must be run as a trace
// read, not a code read".
//
// USAGE  node tools/harness/mag-probe.mjs [--out <dir>] [--json]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mag-probe.mjs — RI-MAG01 M1-M6, RI-MAG02 M4/M5, RI-MAG03 M1/M2/M4/M5 against the live sim.

USAGE
  node tools/harness/mag-probe.mjs [--entry <path>] [--out <dir>] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'MAG-PROBE');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const out = { schema: 'elder-souls/mag-probe@1', harness_version: H.version, checks: {}, notes: [] };
    const rec = (id, pass, detail) => { out.checks[id] = { pass, ...detail }; };

    const D = H.getMagicData();
    const classById = Object.fromEntries(D.cast_classes.classes.map((c) => [c.id, c]));
    const spellById = Object.fromEntries(D.spells.spells.map((s) => [s.id, s]));

    /** Arena, no enemy, caster loadout, full reservoir. */
    const arena = (opts = {}) => {
      H.setSeed(opts.seed === undefined ? 1337 : opts.seed);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.setWillpower(opts.wil === undefined ? 30 : opts.wil);
      H.setCatalyst(opts.catalyst === undefined ? 'rod' : opts.catalyst);
      H.setMagicSkills({ sorcery: 85, root_speech: 85, warding: 85, veiling: 85 });
      H.hearthRest();
      H.setAttuned(opts.attuned || ['spark_dart']);
      H.magicEventsDrain();
    };

    /** Cast once, sampling the frame record every frame. */
    const castAndSample = (spellId, frames, extraInputs) => {
      arena({ attuned: [spellId], catalyst: 'rod' });
      const f0 = H.getFrame();
      // NOTE: queueInputs event frames are RELATIVE to the frame queueInputs was called on
      // (InputPipeline.scriptBase). Every offset in this file is relative for that reason.
      const script = [{ f: 2, press: ['light'] }];
      if (extraInputs) for (const e of extraInputs) script.push({ f: 2 + e.at, press: [e.button] });
      H.queueInputs(script);
      const rows = [];
      for (let i = 0; i < frames; i++) {
        H.stepFrames(1);
        const s = H.snapshot();
        rows.push({
          f: s.f - f0, state: s.player.state, phase: s.player.phase,
          anim_frame: s.player.anim_frame, anim: s.player.anim,
          focus: s.player.focus, stamina: s.player.stamina,
          regen_blocked: s.player.stamina_regen_blocked,
          iframe: s.player.iframe, cast: s.player.cast,
          hitboxes: s.player.hitboxes.length,
          spell_hitboxes: s.player.hitboxes.filter((h) => h.spell !== undefined).length,
          speed: s.player.speed_mps, yaw: s.player.yaw_deg,
        });
      }
      return { rows, events: H.magicEventsDrain() };
    };

    // ================= RI-MAG01 M1 — cast census ==============================================
    const census = [];
    for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT', 'RITUAL']) {
      // The cheapest spell of the class: RI-MAG01 M1 measures FRAMES, and a cast that drops
      // for want of Focus measures nothing. (`GREAT` × 4.4 makes most GREAT spells
      // uncastable at WIL 30, which is itself the point of RI-MAG02 §D's class multiplier.)
      const spell = D.spells.spells.filter((s) => s.class === cls).sort((a, b) => a.focus_base - b.focus_base)[0];
      const r = castAndSample(spell.id, classById[cls].total + 20);
      const castRows = r.rows.filter((x) => x.cast);
      const windup = castRows.filter((x) => x.phase === 'windup').length;
      const active = castRows.filter((x) => x.phase === 'active').length;
      const lastActive = castRows.filter((x) => x.phase === 'active').pop();
      const firstActionable = r.rows.find((x) => lastActive && x.f > lastActive.f && !x.cast);
      const recovery = lastActive && firstActionable ? firstActionable.f - lastActive.f - 1 : null;
      const declared = classById[cls];
      const moveset = D.spell_movesets[spell.id];
      census.push({
        class: cls, spell: spell.id,
        measured: { startup: windup, active, recovery, total: windup + active + (recovery || 0) },
        declared: { startup: declared.startup, active: declared.active, recovery: declared.recovery, total: declared.total },
        Ps_measured: windup + 1, Ps_declared: declared.Ps,
        moveset_declared: moveset ? { startup: moveset.startup, active: moveset.active, recovery: moveset.recovery, total: moveset.total } : null,
        exact: windup === declared.startup && active === declared.active && recovery === declared.recovery,
        moveset_agrees: !!moveset && moveset.startup === declared.startup && moveset.active === declared.active
          && moveset.recovery === declared.recovery && moveset.total === declared.total,
      });
    }
    rec('MAG01_M1_cast_census', census.every((c) => c.exact), { rows: census, note: 'startup = frames with phase=="windup"; active = frames with a live spell hitbox phase; recovery = frames from last active to first ACTIONABLE. f@60 throughout.' });
    rec('MAG01_M8_declared_vs_observed', census.every((c) => c.moveset_agrees), {
      rows: census.map((c) => ({ class: c.class, spell: c.spell, moveset: c.moveset_declared, measured: c.measured, agrees: c.moveset_agrees })),
      note: 'HARNESS §7 rule 4: game/data/combat/movesets/spell-<id>.json and the measured trace are two independent sources that must agree.',
    });

    // ================= RI-MAG01 M2 — dual cost ================================================
    {
      arena({ attuned: ['spark_dart'] });
      const before = H.snapshot().player;
      const expectFocus = H.spellCost('spark_dart');       // at this caster's LIVE skill discount
      const expectStam = classById.CANTRIP.stamina;
      H.queueInputs([{ f: 1, press: ['light'] }]);
      const trail = [];
      for (let i = 0; i < 80; i++) {
        H.stepFrames(1);
        const s2 = H.snapshot().player;
        trail.push({ focus: s2.focus, stamina: s2.stamina, blocked: s2.stamina_regen_blocked });
      }
      const castIdx = trail.findIndex((t) => t.focus < before.focus);
      const at1 = trail[castIdx];
      const at0 = castIdx > 0 ? trail[castIdx - 1] : before;
      const at2 = trail[castIdx + 1];
      let blocked = 0;
      for (let i = castIdx; i < trail.length && trail[i].blocked; i++) blocked++;

      // CONTROL: the same measurement against a WEAPON swing, so the regen-delay figure is
      // compared to the thing it is supposed to equal rather than to a number in a document.
      // (The frame record is stamped after `sim.frame++`, so a 42 f@60 delay is observed as 41
      // blocked records for BOTH actions. What RI-MAG01 M2 asserts is that a cast re-arms the
      // delay exactly as a swing does, and that is what this pair shows.)
      arena({ attuned: ['spark_dart'] });
      H.setCatalyst(null);                     // no catalyst -> `light` is a sword swing again
      const sBefore = H.snapshot().player;
      H.queueInputs([{ f: 1, press: ['light'] }]);
      const strail = [];
      for (let i = 0; i < 80; i++) { H.stepFrames(1); const s3 = H.snapshot().player; strail.push({ stamina: s3.stamina, blocked: s3.stamina_regen_blocked }); }
      const swingIdx = strail.findIndex((t) => t.stamina < sBefore.stamina);
      let swingBlocked = 0;
      for (let i = swingIdx; i < strail.length && strail[i].blocked; i++) swingBlocked++;

      rec('MAG01_M2_dual_cost', at1.focus === before.focus - expectFocus
        && Math.abs((at0.stamina - at1.stamina) - expectStam) < 0.001
        && blocked === swingBlocked && blocked >= 41, {
        focus_before: before.focus, focus_frame_before_cast: at0.focus, focus_after_frame1: at1.focus,
        focus_frame2: at2 ? at2.focus : null, focus_expected_spend: expectFocus,
        stamina_frame_before_cast: at0.stamina, stamina_after_frame1: at1.stamina, stamina_expected_spend: expectStam,
        regen_blocked_frames_from_cast_frame_inclusive: blocked,
        regen_blocked_frames_after_a_WEAPON_SWING: swingBlocked,
        regen_delay_declared_f: 42,
        regen_record_convention: 'The frame record is built after sim.frame++, so a 42 f@60 delay armed on frame F is observed as blocked on records F+1..F+41 = 41 records. A weapon swing measures the same 41 under the same convention; the assertion is cast == swing.',
        note: 'Both resources on frame 1. The regen-delay re-arm is the assertion that stops "cast, roll, cast" being the correct play forever.',
      });

      // interrupt during startup: Focus gone, no geometry ever appeared
      arena({ attuned: ['the_unmaking'] });
      const fb = H.snapshot().player.focus;
      const g0 = H.getFrame();
      H.queueInputs([{ f: 1, press: ['light'] }]);
      H.stepFrames(18);                       // 18 of 36 startup frames
      const mid = H.snapshot().player;
      H.damagePlayer(400);                    // hurt mid-startup
      H.stepFrames(90);
      const after = H.snapshot();
      const sawSpellHitbox = after.player.hitboxes.some((h) => h.spell !== undefined);
      rec('MAG01_M2_interrupt_keeps_focus', mid.focus < fb && after.player.focus === mid.focus && !sawSpellHitbox, {
        focus_before: fb, focus_mid_startup: mid.focus, focus_after: after.player.focus,
        spell_hitbox_after: sawSpellHitbox,
        note: 'RI-MAG01 §D: interrupted during startup the Focus is consumed and never refunded, and the spell did not happen.',
      });

      // starvation: the input is DROPPED, not queued, and does not fire later.
      // WIL 10 is a 30-Focus reservoir; a GREAT-class spell costs more than that outright.
      arena({ attuned: ['call_the_deep_drowned'], wil: 10 });
      const st = H.getMagicState();
      const need = st.focus + 1;
      const liveCost = H.quoteSpell({ effects: spellById.call_the_deep_drowned.effects, range: 'self', class: 'GREAT' });
      const hf = H.getFrame();
      H.magicEventsDrain();
      H.queueInputs([{ f: 1, press: ['light'] }]);
      H.stepFrames(300);
      const ev = H.magicEventsDrain();
      const started = ev.some((e) => e.kind === 'cast_start');
      const focusAfter = H.getMagicState().focus;
      rec('MAG01_M2_starvation_drops', !started && focusAfter === st.focus, {
        focus: st.focus, focus_max: st.focus_max, cost: liveCost.focus_cost,
        cast_started_within_300f: started, focus_unchanged: focusAfter === st.focus,
        note: 'No partial cast, no debt, no queue, and the input does not fire later.',
      });
    }

    // ================= RI-MAG01 M3 — Focus never regenerates ==================================
    {
      arena({ attuned: ['spark_dart'] });
      // Spend first, so that the ONE legitimate rise (a HEARTH rest) is observable at the end.
      for (let k = 0; k < 6; k++) { const g = H.getFrame(); H.queueInputs([{ f: 1, press: ['light'] }]); H.stepFrames(45); }
      const f0 = H.getFrame();
      // walk, sprint, roll, block, heal, wait, pass time — 3,600 frames of everything.
      const script = [];
      for (let k = 0; k < 30; k++) {
        script.push({ f: k * 120 + 5, press: ['roll'] });
        script.push({ f: k * 120 + 30, press: ['use_item'] });
        script.push({ f: k * 120 + 60, press: ['sprint'], move: [0, 1] });
        script.push({ f: k * 120 + 90, press: ['jump'] });
        script.push({ f: k * 120 + 110, release: ['sprint'] });
      }
      H.queueInputs(script);
      let prev = H.snapshot().player.focus;
      let rises = 0; let minF = prev; let maxF = prev;
      for (let i = 0; i < 3600; i++) {
        H.stepFrames(1);
        const f = H.snapshot().player.focus;
        if (f > prev + 1e-9) rises++;
        prev = f; minF = Math.min(minF, f); maxF = Math.max(maxF, f);
      }
      H.setTimeOfDay(23.9); H.stepFrames(600); H.advanceWallClock(60 * 60 * 1000);
      const afterMidnight = H.snapshot().player.focus;
      if (afterMidnight > prev + 1e-9) rises++;
      const beforeRest = H.snapshot().player.focus;
      H.hearthRest();
      H.stepFrames(1);                       // snapshot() reads the mirrored view, refreshed in a step
      const afterRest = H.snapshot().player.focus;
      rec('MAG01_M3_focus_never_regenerates', rises === 0 && afterRest > beforeRest, {
        frames_observed: 4200, unexplained_rises: rises,
        focus_start: maxF, focus_end: prev, focus_after_midnight: afterMidnight,
        focus_before_hearth: beforeRest, focus_after_hearth: afterRest,
        note: 'Monotonic non-increase across the whole trace except on a HEARTH rest. The only two functions in the project that raise focus are hearthRest() and respawn().',
      });
    }

    // ================= RI-MAG01 M4 — commitment, i-frames, aim latch ==========================
    {
      const commit = [];
      for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT']) {
        const spell = D.spells.spells.find((s) => s.class === cls && s.geometry.kind !== 'none');
        const c = classById[cls];
        // Try to interrupt with EVERY button, one frame at a time, across the whole clip.
        const perButton = {};
        for (const button of ['light', 'heavy', 'roll', 'block', 'parry', 'sprint', 'jump', 'use_item', 'menu', 'spell_cycle']) {
          let earliestAccepted = null;
          for (let k = 1; k <= c.total; k += 3) {
            const r = castAndSample(spell.id, c.total + 8, [{ at: k, button }]);
            // "accepted" = the cast ended before its declared total
            const last = r.rows.filter((x) => x.cast).pop();
            const endedAt = last ? last.f : null;
            const declaredEnd = 2 + c.total;
            if (endedAt !== null && endedAt < declaredEnd - 1) { earliestAccepted = k; break; }
          }
          perButton[button] = earliestAccepted;
        }
        // i-frames: never, at any frame of any cast
        const r2 = castAndSample(spell.id, c.total + 8);
        const anyIframe = r2.rows.some((x) => x.cast && x.iframe);
        commit.push({
          class: cls, spell: spell.id, hard_until: c.hard_until, total: c.total,
          earliest_accepted_input_frame: perButton,
          any_iframe_during_cast: anyIframe,
          only_roll_cancels: Object.entries(perButton).every(([b, v]) => b === 'roll' || v === null),
          roll_cancel_after_hard_until: perButton.roll === null || perButton.roll > c.hard_until,
        });
      }
      rec('MAG01_M4_commitment', commit.every((c) => !c.any_iframe_during_cast && c.only_roll_cancels && c.roll_cancel_after_hard_until), {
        rows: commit,
        note: 'Every button injected on every 3rd frame of every class. Only `roll`, and only strictly after hard_until = startup + active + ceil(0.60 × recovery), may end a cast early. A cast never grants an i-frame at any class under any catalyst.',
      });

      // Aim latch: script a target to strafe from Tc+1 and measure residual aim error.
      const errs = [];
      for (let trial = 0; trial < 30; trial++) {
        arena({ attuned: ['the_unmaking'], seed: 1000 + trial });
        H.spawn('inf_trash', 0, 12, { as: 'T' });
        const c = classById.HEAVY;
        const f0 = H.getFrame();
        H.lockOn('T');
        H.queueInputs([{ f: 1, press: ['light'] }]);
        H.stepFrames(c.Tc + 1);
        // Move the target hard sideways AFTER the latch frame.
        const dx = 6 * (trial % 2 === 0 ? 1 : -1);
        H.setEntityPos('T', dx, 12, {});
        H.stepFrames(c.startup - c.Tc + 2);
        const s = H.snapshot();
        const proj = s.player.hitboxes.find((h) => h.kind === 'projectile');
        const ents = H.listEntities();
        const t = ents.find((e) => e.eid === 'T');
        if (proj && t) {
          const pv = [proj.a[0] - s.player.pos[0], proj.a[2] - s.player.pos[2]];
          const tv = [t.pos[0] - s.player.pos[0], t.pos[2] - s.player.pos[2]];
          const ang = (v) => Math.atan2(v[0], v[1]) * 180 / Math.PI;
          let d = Math.abs(((ang(pv) - ang(tv) + 540) % 360) - 180);
          errs.push(d);
        }
      }
      errs.sort((a, b) => a - b);
      const median = errs.length ? errs[Math.floor(errs.length / 2)] : null;
      rec('MAG01_M4_aim_latch', median !== null && median >= 25, {
        trials: errs.length, median_residual_aim_error_deg: median === null ? null : Math.round(median * 100) / 100,
        all: errs.map((e) => Math.round(e * 10) / 10),
        fail_below_deg: 10, pass_at_or_above_deg: 25,
        note: 'FAIL below 10 deg means the player\'s spells home. The enemy predicts a rolling player; the player must predict a rolling enemy.',
      });
    }

    // ================= RI-MAG01 M5 — geometry, not dice =======================================
    {
      const dmgs = [];
      let rngBefore = null, rngAfter = null;
      for (const seed of [1, 2, 3]) {
        for (let i = 0; i < 67; i++) {
          arena({ attuned: ['spark_dart'], seed });
          H.spawn('inf_trash', 0, 6, { as: 'T' });
          const hp0 = H.listEntities().find((e) => e.eid === 'T').hp;
          const f0 = H.getFrame();
          if (rngBefore === null) rngBefore = H.getDeterminismReport().rngSeed;
          H.queueInputs([{ f: 1, press: ['light'] }]);
          H.stepFrames(60);
          const t = H.listEntities().find((e) => e.eid === 'T');
          if (t && t.hp < hp0) dmgs.push(hp0 - t.hp);
        }
      }
      const uniq = [...new Set(dmgs)];
      rec('MAG01_M5_no_dice', uniq.length === 1 && dmgs.length >= 150, {
        casts_that_hit: dmgs.length, distinct_damage_values: uniq, seeds: [1, 2, 3],
        note: '200 casts of the same spell at the same dummy from the same pose at three seeds. Any variance is a magnitude range and an automatic fail.',
      });
    }

    // ================= RI-MAG01 M6 — ballistics ===============================================
    {
      const rows = [];
      for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT']) {
        const spell = D.spells.spells.find((s) => s.class === cls && s.geometry.kind === 'projectile');
        if (!spell) continue;
        arena({ attuned: [spell.id] });
        const c = classById[cls];
        const f0 = H.getFrame();
        H.queueInputs([{ f: 1, press: ['light'] }]);
        H.stepFrames(c.startup + 2);
        const samples = [];
        for (let i = 0; i < 40; i++) {
          H.stepFrames(1);
          const p = H.snapshot().player.hitboxes.find((h) => h.kind === 'projectile');
          if (p) samples.push({ pos: p.a, r: p.r, turn: p.turn_rate_dps, travel: p.travel_f });
        }
        let speed = null;
        if (samples.length >= 3) {
          const a = samples[1].pos, b = samples[samples.length - 1].pos;
          const n = samples.length - 2;
          speed = Math.hypot(b[0] - a[0], b[2] - a[2]) / n * 60;
        }
        const decl = D.cast_classes.ballistics.classes[cls];
        rows.push({
          class: cls, spell: spell.id, frames_sampled: samples.length,
          measured_speed_mps: speed === null ? null : Math.round(speed * 100) / 100,
          declared_speed_mps: decl.speed_mps,
          measured_radius_m: samples.length ? samples[0].r : null, declared_radius_m: decl.radius_m,
          max_turn_rate_dps: samples.length ? Math.max(...samples.map((s) => s.turn)) : null,
          within_tolerance: speed !== null && Math.abs(speed - decl.speed_mps) <= 0.2,
        });
      }
      const overCeiling = D.spells.spells.filter((s) => s.geometry.speed_mps > 30);
      rec('MAG01_M6_ballistics', rows.every((r) => r.within_tolerance) && overCeiling.length === 0, {
        rows, spells_over_30mps: overCeiling.map((s) => s.id),
        note: 'Above 30 m/s a projectile is hitscan in a costume and the player has no reaction budget.',
      });
    }

    // ================= RI-MAG02 M4 — the levitation bounds ====================================
    {
      arena({ attuned: ['levitate', 'slowfall'], wil: 50 });
      H.setLevitating(true);
      const start = H.getMagicState();
      const f0 = H.getFrame();
      // hold jump: ascend. Measure focus per metre.
      H.queueInputs([{ f: 1, press: ['jump'] }]);
      H.stepFrames(300);
      const climbed = H.getMagicState();
      const dAlt = climbed.altitude_m - start.altitude_m;
      const dFocus = start.focus - climbed.focus;
      const perMetre = dAlt > 0 ? dFocus / dAlt : null;
      // horizontal drift cap vs walk speed
      const drift = D.cast_classes.levitation.horizontal_drift_mps;
      const walk = D.cast_classes.levitation.walk_speed_reference_mps;
      // AIRBORNE denies everything
      H.magicEventsDrain();
      const g0 = H.getFrame();
      H.queueInputs([{ f: 1, press: ['light'] }, { f: g0 + 6, press: ['roll'] }, { f: g0 + 12, press: ['parry'] }]);
      H.stepFrames(40);
      const evs = H.magicEventsDrain();
      const castedWhileAirborne = evs.some((e) => e.kind === 'cast_start');
      let iframeSeen = false;
      for (let i = 0; i < 30; i++) { H.stepFrames(1); if (H.snapshot().player.iframe) iframeSeen = true; }
      // any damage ends it
      const beforeDmg = H.getMagicState().levitating;
      H.damagePlayer(1);
      const afterDmg = H.getMagicState().levitating;
      rec('MAG02_M4_levitation', perMetre !== null && Math.abs(perMetre - 1.5) < 0.05
        && drift < walk && !castedWhileAirborne && !iframeSeen && beforeDmg && !afterDmg, {
        altitude_gained_m: Math.round(dAlt * 1000) / 1000,
        focus_spent_on_ascent: Math.round(dFocus * 1000) / 1000,
        focus_per_metre_measured: perMetre === null ? null : Math.round(perMetre * 10000) / 10000,
        focus_per_metre_declared: 1.5,
        drift_mps: drift, walk_mps: walk, drift_slower_than_walking: drift < walk,
        airborne_accepted_a_cast: castedWhileAirborne,
        airborne_iframe_seen: iframeSeen,
        levitating_before_1_damage: beforeDmg, levitating_after_1_damage: afterDmg,
        note: 'RI-MAG02 §F: the four bounds are drift slower than walking, 1.5 Focus per metre out of a reservoir that never refills, AIRBORNE being defenceless, and real ceilings. None of them is a rule the player can read.',
      });
    }

    // ================= RI-MAG02 M5 — the teleport bounds ======================================
    {
      const teleports = ['mark', 'recall', 'intervention_root', 'intervention_imperial'];
      const allRitual = teleports.every((id) => spellById[id] && spellById[id].class === 'RITUAL');
      const aborts = {};
      for (const cause of ['damage', 'combat', 'movement']) {
        arena({ attuned: ['recall'], wil: 50 });
        const before = H.getMagicState().focus;
        const f0 = H.getFrame();
        const posBefore = H.snapshot().player.pos.slice();
        H.queueInputs([{ f: 1, press: ['light'] }]);
        H.stepFrames(40);
        const spent = H.getMagicState().focus;
        if (cause === 'damage') H.damagePlayer(1);
        else if (cause === 'combat') { H.spawn('inf_trash', 0, 5, { as: 'T' }); H.aggro('T'); H.stepFrames(1); }
        else { H.queueInputs([{ f: 1, press: ['roll'] }]); H.stepFrames(2); }
        H.stepFrames(4);
        const after = H.getMagicState();
        const posAfter = H.snapshot().player.pos.slice();
        aborts[cause] = {
          focus_before: before, focus_during: spent, focus_after: after.focus,
          refunded: Math.abs(after.focus - before) < 0.001,
          cast_still_running: after.cast !== null,
          position_changed: Math.hypot(posAfter[0] - posBefore[0], posAfter[2] - posBefore[2]) > 0.5,
        };
      }
      // recall's magnitude is COMPUTED, not authored
      const W = D.effects.effects.find((e) => e.id === 'recall').weight;
      const quotes = [[0, 500], [0, 1500], [0, 3000], [0, 4000]].map(([x, z]) => {
        const q = H.recallQuote(x, z);
        const formula = Math.ceil(W * Math.pow(q.M, 1.30) * 0.70 / 10);
        return { mark_at_m: z, M: q.M, focus_base: q.focus_base, formula, corpus_published: { 500: 6, 1500: 26, 3000: 57, 4000: 77 }[z] };
      });
      // NOTE: RI-MAG02 §G's published table (6 / 26 / 57 / 77) does not reproduce from
      // RI-MAG02 §D's own formula at two of its four points. `ceil(9.0 × M^1.30 × 0.70 / 10)`
      // gives 6 / 22 / 53 / 77 for M = 5 / 15 / 30 / 40; the M=5 and M=40 rows agree exactly
      // and the M=15 and M=30 rows are 4 low. This build follows the FORMULA, because
      // RI-MAG02 M2 asserts every shipped cost recomputes from §D exactly and a table that
      // disagrees with the formula cannot also be satisfied. Reported, not fudged.
      const formulaAgrees = quotes.every((q) => Math.abs(q.focus_base - q.formula) < 1e-9);
      rec('MAG02_M5_teleport', allRitual
        && Object.values(aborts).every((a) => a.refunded && !a.cast_still_running)
        && formulaAgrees, {
        all_ritual_class: allRitual,
        aborts,
        recall_computed_magnitude: quotes,
        corpus_table_vs_corpus_formula: 'RI-MAG02 §G publishes 6/26/57/77; RI-MAG02 §D\'s formula gives 6/22/53/77. Two of four rows in the item disagree with the item. This build follows the formula (RI-MAG02 M2 requires it) and files the discrepancy.',
        note: 'RI-MAG02 §G: `RITUAL` is 210 f@60 with zero hyperarmour and zero movement, and aborts on damage, on COMBAT and on movement with the Focus refunded. "No recall out of a fight" is a consequence of the clock, not a flag anyone had to remember to write.',
      });
    }

    // ================= RI-MAG03 M1 — the unauthored-spell assertion ===========================
    {
      const shipped = new Set(D.spells.spells.map((s) => JSON.stringify({
        e: s.effects.map((e) => [e.effect, e.magnitude, e.duration_s, e.area_r_m]).sort(),
        r: s.range, c: s.class,
      })));
      // Teach every effect so the knowledge gate is not what we are testing here.
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      const tuples = [
        { effects: [{ effect: 'fire_damage', magnitude: 37, duration_s: 13, area_r_m: 2 }], range: 'projectile', class: 'HEAVY' },
        { effects: [{ effect: 'frost_damage', magnitude: 3, duration_s: 29, area_r_m: 0 }], range: 'touch', class: 'CANTRIP' },
        { effects: [{ effect: 'invisibility', magnitude: 17, duration_s: 17, area_r_m: 0 }, { effect: 'fire_damage', magnitude: 9, duration_s: 3, area_r_m: 4 }], range: 'target', class: 'LIGHT', why: 'deliberately nonsensical' },
        { effects: [{ effect: 'open_lock', magnitude: 100, duration_s: 0, area_r_m: 0 }], range: 'target', class: 'LIGHT', why: 'at magnitude.max' },
        { effects: [{ effect: 'chameleon', magnitude: 27, duration_s: 300, area_r_m: 0 }], range: 'self', class: 'LIGHT', why: 'at duration.max_s' },
        { effects: [{ effect: 'damage_health', magnitude: 200, duration_s: 0, area_r_m: 0 }], range: 'projectile', class: 'GREAT', why: 'focus_cost exceeds focus_max' },
        { effects: [{ effect: 'restore_health', magnitude: 11, duration_s: 0, area_r_m: 0 }, { effect: 'cure_poison', magnitude: 4, duration_s: 0, area_r_m: 0 }, { effect: 'resist_element', magnitude: 7, duration_s: 41, area_r_m: 0 }], range: 'self', class: 'LIGHT', why: '3-effect' },
        { effects: [{ effect: 'paralyse', magnitude: 3, duration_s: 3, area_r_m: 2 }], range: 'area_at_range', class: 'HEAVY' },
        { effects: [{ effect: 'shock_damage', magnitude: 71, duration_s: 0, area_r_m: 5 }], range: 'area_at_range', class: 'GREAT' },
        { effects: [{ effect: 'telekinesis', magnitude: 23, duration_s: 47, area_r_m: 0 }], range: 'self', class: 'CANTRIP' },
        { effects: [{ effect: 'burden', magnitude: 133, duration_s: 11, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' },
        { effects: [{ effect: 'night_eye', magnitude: 9, duration_s: 517, area_r_m: 0 }], range: 'self', class: 'CANTRIP', why: 'duration over max -> clamped, not refused' },
        { effects: [{ effect: 'feather', magnitude: 199, duration_s: 7, area_r_m: 0 }], range: 'touch', class: 'LIGHT' },
        { effects: [{ effect: 'silence', magnitude: 13, duration_s: 13, area_r_m: 3 }], range: 'area_at_range', class: 'HEAVY' },
        { effects: [{ effect: 'demoralise', magnitude: 31, duration_s: 19, area_r_m: 7 }], range: 'area_at_range', class: 'LIGHT' },
        { effects: [{ effect: 'bound_weapon', magnitude: 87, duration_s: 87, area_r_m: 0 }], range: 'self', class: 'LIGHT' },
        { effects: [{ effect: 'mend_item', magnitude: 63, duration_s: 0, area_r_m: 0 }], range: 'touch', class: 'CANTRIP' },
        { effects: [{ effect: 'detect_life', magnitude: 60, duration_s: 120, area_r_m: 0 }], range: 'self', class: 'LIGHT', why: 'both axes at max' },
        { effects: [{ effect: 'drain_health', magnitude: 91, duration_s: 23, area_r_m: 0 }], range: 'touch', class: 'HEAVY' },
        { effects: [{ effect: 'levitate', magnitude: 1, duration_s: 97, area_r_m: 0 }], range: 'self', class: 'LIGHT' },
      ];
      const made = [];
      for (const t of tuples) {
        const key = JSON.stringify({ e: t.effects.map((e) => [e.effect, e.magnitude, e.duration_s, e.area_r_m]).sort(), r: t.range, c: t.class });
        const absent = !shipped.has(key);
        const q = H.quoteSpell(t);
        made.push({ tuple: t, absent_from_shipped: absent, refused: !!q.refused, gate: q.gate || null, focus_base: q.focus_base, tier: q.tier, gold: q.gold, notes: q.notes, over_reservoir: q.over_reservoir });
      }
      const produced = made.filter((m) => !m.refused).length;
      rec('MAG03_M1_unauthored_spells', produced >= 19 && made.every((m) => m.absent_from_shipped), {
        tuples: made.length, produced, refused: made.filter((m) => m.refused).map((m) => ({ gate: m.gate })),
        all_absent_from_shipped_list: made.every((m) => m.absent_from_shipped),
        rows: made,
        note: 'FAIL if any legal combination is refused for any reason other than the four declared gates. A whitelist of designer-approved combinations is an automatic fail of RI-MAG03; there is no such list in this build.',
      });

      // MB-3, end to end: commission a coordinate that appears nowhere in spells.json, save it,
      // attune it, cast it, and load it back. A clean arena FIRST, because loadState('<named>')
      // rebuilds the fight and therefore the MagicSystem; a spell commissioned before that call
      // would not survive it. One commissioned AFTER it survives a save/load round trip, which
      // is what RI-MAG03 M1 actually requires ("assert each appears in saveState()").
      arena({});
      H.setGold(50000);
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      for (const s2 of D.spells.spells) H.learnSpell(s2.id);
      const mk = H.makeSpell(tuples[6], 'Traveller\'s Remedy');
      let castOk = false, inSave = false, roundTrips = false;
      if (!mk.refused) {
        const blob = H.saveState();
        inSave = !!(blob.magic && blob.magic.custom_spells.some((c) => c.id === mk.spell.id));
        const att = H.setAttuned([mk.spell.id]);
        H.magicEventsDrain();
        H.queueInputs([{ f: 1, press: ['light'] }]);
        H.stepFrames(80);
        const ev = H.magicEventsDrain();
        castOk = att.includes(mk.spell.id) && ev.some((e) => e.kind === 'cast_start' && e.spell === mk.spell.id)
          && ev.some((e) => e.kind === 'effect_apply');
        H.loadState(blob);
        roundTrips = H.getMagicState().custom_spells > 0;
      }
      rec('MAG03_MB3_commissioned_spell_casts', castOk && inSave && roundTrips, {
        made: mk.refused ? null : { id: mk.spell.id, focus_base: mk.spell.focus_base, tier: mk.spell.tier, effects: mk.spell.effects },
        refusal: mk.refused ? mk : null,
        cast_and_applied: castOk, present_in_saveState: inSave, survives_save_load_round_trip: roundTrips,
        note: 'MB-3: the breakage that IS the system. A three-effect spell that appears nowhere in spells.json, commissioned, attuned and cast in one run.',
      });
    }

    // ================= RI-MAG03 M2 — gate determinism =========================================
    {
      H.setMagicSkills({ sorcery: 49, root_speech: 49, warding: 49, veiling: 49 });
      let below = 0, at = 0;
      for (let i = 0; i < 100; i++) {
        H.setMagicSkills({ sorcery: 49 });
        const q1 = H.quoteSpell({ effects: [{ effect: 'fire_damage', magnitude: 20, duration_s: 5, area_r_m: 0 }, { effect: 'shock_damage', magnitude: 20, duration_s: 0, area_r_m: 0 }, { effect: 'frost_damage', magnitude: 20, duration_s: 5, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' });
        if (q1.refused && q1.gate === 'effect_count') below++;
        H.setMagicSkills({ sorcery: 50 });
        const q2 = H.quoteSpell({ effects: [{ effect: 'fire_damage', magnitude: 20, duration_s: 5, area_r_m: 0 }, { effect: 'shock_damage', magnitude: 20, duration_s: 0, area_r_m: 0 }, { effect: 'frost_damage', magnitude: 20, duration_s: 5, area_r_m: 0 }], range: 'projectile', class: 'LIGHT' });
        if (!q2.refused) at++;
      }
      rec('MAG03_M2_gate_determinism', below === 100 && at === 100, {
        trials: 100, refused_at_skill_49: below, allowed_at_skill_50: at,
        note: 'max_effects = 1 + floor(skill/25). Failure is total below the threshold and success is total at it. Any probabilistic gate reintroduces the dice S1 abolished.',
      });
    }

    // ================= RI-MAG03 M4 — the S15 firewall =========================================
    {
      arena({});
      const before = H.getPlayerStats();
      const soulsBefore = before.souls === undefined ? (H.getQuestState().souls || 0) : before.souls;
      const t1 = H.trapSoul('named_wamasu_01', 'greater', false);
      const t2 = H.trapSoul('named_wamasu_01', 'greater', false);   // respawned: one grade lower
      const t3 = H.trapSoul('named_wamasu_01', 'greater', false);
      const npc = H.trapSoul('innkeeper_gideon', 'grand', true);
      const after = H.getPlayerStats();
      const soulsAfter = after.souls === undefined ? (H.getQuestState().souls || 0) : after.souls;
      const q = H.enchantQuote({ itemClass: 'ring', kind: 'on_use', range: 'target', soulGrade: 'greater', enchanter: 'journeyman_gideon', effects: [{ effect: 'open_lock', magnitude: 40, duration_s: 0, area_r_m: 0 }] });
      const qConstantPetty = H.enchantQuote({ itemClass: 'medium_armour', kind: 'constant', range: 'self', soulGrade: 'petty', enchanter: 'master_blackrose', effects: [{ effect: 'resist_element', magnitude: 10, duration_s: 30, area_r_m: 0 }] });
      const xh = H.getXulHesh();
      rec('MAG03_M4_s15_firewall', soulsBefore === soulsAfter && !npc.trapped
        && t1.grade === 'greater' && t2.grade === 'common' && t3.grade === 'lesser'
        && !qConstantPetty.ok && q.adds_sale_value === 0, {
        souls_before: soulsBefore, souls_after: soulsAfter, souls_unchanged: soulsBefore === soulsAfter,
        trap_1: t1.grade, trap_2_after_respawn: t2.grade, trap_3: t3.grade,
        npc_soul_trapped: npc.trapped, npc_reason: npc.reason,
        filled_gem_sell_value: null,
        enchantment_adds_sale_value: q.adds_sale_value,
        constant_from_petty_soul_refused: !qConstantPetty.ok, constant_refusal: qConstantPetty.problems,
        xul_hesh: xh,
        note: 'SG-1: the souls quantity is never read or written on any gem path. SG-3: a filled gem has sell_value null. SG-4: an enchantment adds zero sale value. SG-5: a respawned individual yields one grade lower, floored at petty.',
      });

      // enchant arithmetic
      const rows = [];
      for (const [itemClass, kind, expectFit] of [['ring', 'on_use', true], ['ring', 'on_strike', false], ['medium_armour', 'constant', true], ['two_handed_weapon', 'on_strike', true]]) {
        const qq = H.enchantQuote({ itemClass, kind, range: 'target', soulGrade: 'grand', enchanter: 'master_blackrose', effects: [{ effect: 'open_lock', magnitude: 40, duration_s: 0, area_r_m: 0 }] });
        const mult = D.enchanting.enchantment_kinds[kind].points_multiplier;
        rows.push({ itemClass, kind, focus_base: qq.focus_base, points: qq.points, expected_points: Math.ceil(qq.focus_base * mult), capacity: qq.capacity, ok: qq.ok, problems: qq.problems, gold: qq.gold, charge_per_activation: qq.charge_per_activation });
      }
      rec('MAG03_M3_enchant_arithmetic', rows.every((r) => r.points === r.expected_points), {
        rows, note: 'points = ceil(focus_base × {2.5, 4.0, 18}) exactly, and the capacity table is enforced.',
      });
    }

    // ================= AR-3 — the seam crossing, demonstrated in a trace ======================
    {
      // X1: a spell learned outside the fight ends a fight without a corpse.
      arena({ attuned: ['still_the_beast'] });
      H.setMagicSkills({ root_speech: 85 });
      H.spawn('inf_trash', 0, 7, { as: 'B' });
      H.aggro('B');
      H.stepFrames(4);
      const combatBefore = H.getCombatState();
      H.lockOn('B');
      const f0 = H.getFrame();
      H.magicEventsDrain();
      H.queueInputs([{ f: 1, press: ['light'] }]);
      H.stepFrames(120);
      const ev = H.magicEventsDrain();
      const ent = H.listEntities().find((e) => e.eid === 'B');
      rec('AR3_X1_calm_ends_fight_without_a_corpse', ev.some((e) => e.kind === 'effect_apply' && e.effect === 'calm_beast') && ent && ent.hp > 0, {
        effect_applied: ev.filter((e) => e.kind === 'effect_apply').map((e) => e.effect),
        target_hp_after: ent ? ent.hp : null, target_alive: !!(ent && ent.hp > 0),
        note: 'ARBITRATION §1\'s "right to disengage" made mechanical: a Morrowind effect authored outside the fight resolves inside it and the fight ends with the enemy alive.',
      });

      // X4: feather moves the player across RI-CMB01's roll cliff MID-FIGHT.
      arena({ attuned: ['feather'] });
      H.setEquipLoad(31.0);
      const tierBefore = H.snapshot().player.roll_class;
      const f1 = H.getFrame();
      H.queueInputs([{ f: 1, press: ['light'] }]);
      H.stepFrames(60);
      const st = H.getMagicState();
      const featherMag = (st.effects_active.find((a) => a.effect === 'feather') || {}).magnitude;
      rec('AR3_X4_feather_crosses_the_roll_cliff', featherMag !== undefined, {
        equip_load_pct: 31.0, roll_class_before: tierBefore,
        feather_magnitude_kg: featherMag === undefined ? null : featherMag,
        effects_active: st.effects_active,
        note: 'W1-16 owns the encumbrance -> equip-load-percent conversion, so this probe demonstrates the effect ARRIVING with a magnitude in kilograms; the tier move itself is asserted by RI-CMB01 M5 once that conversion lands. Declared, not claimed.',
      });
    }

    return out;
  });
} finally {
  await handle.close();
}

writeJson(path.join(outDir, 'mag-probe.json'), report);
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(report.checks)) {
  log(`${v.pass ? 'PASS' : 'FAIL'} ${k}`);
  if (v.pass) pass++; else fail++;
}
log(`${pass} pass, ${fail} fail`);
if (args.json) console.log(JSON.stringify(report, null, 1));
console.log(path.join(outDir, 'mag-probe.json'));
process.exit(0);
