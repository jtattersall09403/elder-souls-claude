/**
 * critic-w1-13-r3.mjs — the three things W1-13 round 3 claims that no artifact in the round
 * actually demonstrates, put on trial by a critic who did not build it.
 *
 * C1  CONSUMPTION for the pool fix (RULES.md 5, mandatory under ARBITRATION §3).
 *     `reports/runs/W1-13-R3/levelling*.json` proves that a spend MOVES A NUMBER: `hp_max`
 *     620 -> 828 on the shipped characterless state, 0 with the fix deleted. Every figure in
 *     that file is a field read. RULES.md 5 asks for something else — "name the world-side
 *     consumer and demonstrate it by perturbing the model and watching an ENTITY CHANGE
 *     BEHAVIOUR". So: buy 8 points of VIGOUR, then hit the body with a fixed blow that the
 *     UNLEVELLED body cannot survive, and see whether it is standing.
 *       arm A shipped      -> the blow must be survived
 *       arm B fix deleted  -> the same blow, the same frames, must kill
 *     If both arms die, the level bought a number and nothing else.
 *
 * C2  `projectPoint` under a POSED CAMERA. `tools/harness/w1-13-r3-bloom-sight.mjs` advertises
 *     its projection read as "a shape that cannot lie the way a single count can", and every
 *     one of its 96 rows — including the sixteen scored 8/8 visible at up to 27,134 px over
 *     control — carries `projected: {on_screen: false}`. Either the pixels or the projection is
 *     wrong. This decides which, by posing a camera whose look vector is known and comparing
 *     `projectPoint` against the pose the harness was handed.
 *
 * C3  `path_to_ten` item 8, which the build declares untouched: is the drawn purse still a
 *     constant zero? Read off the DRAWN element, not off the field.
 *
 * C4  CONSUMPTION for the clock hold, which `reports/runs/W1-13-R3/clock.json` reports as
 *     `T5_consumer_moved: false` with `phase_before: night`, `phase_after: night` and
 *     `settlement: null` — i.e. the round's own consumer read came back empty and the arm was
 *     shipped anyway. The consumer exists and is one query away. `sim/souls.js` pays
 *     `NIGHT_MULTIPLIER 1.35x` for every kill inside `isNight()`, whose window opens at
 *     **21:00** — and the builder's own fixture dies at **20:58** and burns the clock to
 *     **21:31** with the fix deleted. So the same enemy is worth 1.35x more in the arm where
 *     dying moved the clock. Four deaths is enough to cross the hour; forty are not needed.
 *
 * Usage: node tools/harness/critic-w1-13-r3.mjs [--out <file>] [--only c1,c2,c3,c4]
 */
'use strict';

import { PNG } from 'pngjs';
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson, gitInfo } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-r3.mjs [--out <file>] [--only c1,c2,c3]'); process.exit(0); }
const ONLY = args.only ? String(args.only).split(',').map((s) => s.trim()) : ['c1', 'c2', 'c3', 'c4'];

const out = {
  schema: 'critic/w1-13-r3@1',
  git: gitInfo(),
  taken_at: new Date().toISOString(),
  judges: 'W1-13 round 3',
  checks: {},
};

function amberPixels(png) {
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
    if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
  }
  return n;
}

let handle;
try {
  handle = await launchGame({ width: 320, height: 240 });
  const h = handle;

  // ---- C1: does 208 more hp_max keep a body alive? -----------------------------------------
  if (ONLY.includes('c1')) {
    const ARM = async ({ deleteTheFix, blow }) => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      let restore = null;
      try {
        H.loadState('default'); H.setRenderRate(0); H.stepFrames(2);
        if (deleteTheFix) {
          const orig = eng.applyDerivedPools;
          restore = () => { eng.applyDerivedPools = orig; };
          eng.applyDerivedPools = function (o) {
            if (!this.sim.character) return null;
            return orig.call(this, o);
          };
        }
        const b0 = H.saveState(); b0.character.souls_held = 400000; H.restoreState(b0); H.stepFrames(1);
        const list = H.listHearths();
        const w = (list.hearths || []).find((x) => x.id === 'hearth-archon') || list.hearths[0];
        H.teleport(w.pos[0], w.pos[2]); H.stepFrames(10); H.restAt(w.id); H.stepFrames(2);

        const body = () => eng.combat && eng.combat.player;
        const hpMaxBefore = body() ? body().hpMax : null;

        // Buy 8 points of VIGOUR through the drawn screen and the real input path, exactly as
        // the build's own levelling probe does.
        for (let n = 0; n < 8; n++) {
          H.openMenu('levelup');
          const s = H.getUIState();
          const rows = (s.elements || []).filter((e) => e.kind === 'attribute_row');
          const cur = Math.max(0, rows.findIndex((e) => e.focused));
          const want = rows.findIndex((e) => e.meta && e.meta.attribute === 'vigour');
          if (want < 0) return { fatal: 'no vigour row on the level-up screen' };
          const steps = want - cur, dir = steps >= 0 ? -1 : 1;
          for (let k = 0; k < Math.abs(steps); k++) {
            H.queueInputs([{ f: 0, move: [0, dir] }]); H.stepFrames(1);
            H.queueInputs([{ f: 0, move: [0, 0] }]); H.stepFrames(1);
          }
          for (const k of ['press', 'release', 'press', 'release']) {
            H.queueInputs([{ f: 0, [k]: ['interact'] }]); H.stepFrames(1);
          }
          H.closeMenu(); H.stepFrames(20);
        }
        H.stepFrames(60);
        const hpMaxAfter = body() ? body().hpMax : null;
        const hpAfter = body() ? body().hp : null;

        // THE BEHAVIOUR. One blow, the same number in both arms, chosen to sit between the
        // unlevelled ceiling and the levelled one. Then step past the frame the death system
        // observes, and ask the WORLD whether the player is dead — not the pool.
        H.damagePlayer(blow, { stagger: false });
        H.stepFrames(2);
        const d = H.getDeathState();
        const after = body();
        H.stepFrames(30);
        const d2 = H.getDeathState();
        return {
          has_character: !!eng.sim.character,
          vigour: eng.sim.progression.attributes.vigour,
          hp_max_before: hpMaxBefore, hp_max_after: hpMaxAfter, hp_at_full_after: hpAfter,
          blow,
          hp_after_the_blow: after ? after.hp : null,
          died: !!(d.surface_active || d2.surface_active || (after && after.hp <= 0)),
          death_surface_came_up: !!(d.surface_active || d2.surface_active),
          deaths_this_session: d2.deaths_this_session ?? null,
        };
      } catch (e) {
        return { fatal: String((e && e.stack) || e) };
      } finally { if (restore) restore(); }
    };

    // The blow: strictly between the unlevelled ceiling (620) and the levelled one (828).
    const BLOW = 700;
    const shipped = await h.page.evaluate(ARM, { deleteTheFix: false, blow: BLOW });
    const deleted = await h.page.evaluate(ARM, { deleteTheFix: true, blow: BLOW });
    out.checks.c1_pool_consumption = {
      question: 'RULES.md 5 — does the pool fix change what an ENTITY DOES, or only what a field says?',
      blow: BLOW,
      shipped, fix_deleted: deleted,
      the_level_bought_survival: shipped.died === false && deleted.died === true,
      both_arms_agree: shipped.died === deleted.died,
      note: 'One blow, one browser, identical frames. The only difference between the arms is '
        + 'the round-2 body of applyDerivedPools, monkeypatched back.',
    };
    log(`C1 shipped died=${shipped.died} (hp_max ${shipped.hp_max_before}->${shipped.hp_max_after}) | `
      + `fix deleted died=${deleted.died} (hp_max ${deleted.hp_max_before}->${deleted.hp_max_after})`);
  }

  // ---- C2: does projectPoint see the posed camera? -----------------------------------------
  if (ONLY.includes('c2')) {
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 60);
    const list = await h.h('listHearths');
    const hearth = list.hearths.find((x) => x.kind === 'settlement') || list.hearths[0];
    await h.h('teleport', hearth.pos[0], hearth.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hearth.id);
    const blob = await h.h('saveState');
    blob.character.souls_held = 4200;
    await h.h('restoreState', blob);
    await h.h('teleport', hearth.pos[0] + 50, hearth.pos[2] + 18);
    await h.h('stepFrames', 4);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 260);
    const st = (await h.h('getDeathState')).bloodstain;
    const rows = [];
    for (let a = 0; a < 4; a++) {
      const th = (a / 4) * Math.PI * 2;
      const x = st.pos[0] + Math.cos(th) * 12, z = st.pos[2] + Math.sin(th) * 12;
      await h.h('teleport', x, z);
      await h.h('stepFrames', 3);
      await h.h('renderFrame');
      const snap = await h.hOpt('snapshot');
      const groundY = snap && snap.player && snap.player.pos ? snap.player.pos[1] : st.pos[1];
      const drawn = await h.hOpt('getDrawnMarkers');
      const target = drawn && drawn.stain && drawn.stain.pos ? drawn.stain.pos : st.pos;
      const eye = [x, groundY + 1.6, z];
      const look = [target[0], target[1] + 0.9, target[2]];
      const camBefore = await h.h('camera', {});
      const camState = await h.h('camera', { pos: eye, look });
      await h.h('renderFrame');
      const px = amberPixels(PNG.sync.read(Buffer.from(String(await h.h('screenshot')).replace(/^data:image\/png;base64,/, ''), 'base64')));
      const proj = await h.h('projectPoint', look[0], look[1], look[2]);
      // The camera the projection actually uses, read back off the sim.
      const cam = await h.page.evaluate(() => {
        const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
        const c = eng.sim.camera;
        return {
          pos: [c.pos[0], c.pos[1], c.pos[2]], pivot: [c.pivot[0], c.pivot[1], c.pivot[2]],
          yaw: c.yaw, pitch: c.pitch, has_override: !!c.override,
        };
      });
      // What the yaw WOULD be if it followed the pose we handed in.
      const wantYaw = (Math.atan2(look[0] - eye[0], look[2] - eye[2]) * 180) / Math.PI;
      rows.push({
        bearing_deg: Math.round((a / 4) * 360),
        eye, look, amber_px: px,
        projected: proj,
        sim_camera_after_the_pose: cam,
        yaw_implied_by_the_pose_deg: +wantYaw.toFixed(2),
        yaw_the_projection_used_deg: +Number(cam.yaw).toFixed(2),
        yaw_error_deg: +Math.abs(((wantYaw - cam.yaw + 540) % 360) - 180).toFixed(2),
        pos_was_applied: Math.abs(cam.pos[1] - eye[1]) < 1e-6,
        yaw_was_applied: Math.abs(((wantYaw - cam.yaw + 540) % 360) - 180) < 1,
        cam_state_returned: camState && camState.yaw !== undefined ? { yaw: camState.yaw, pitch: camState.pitch } : camState,
        cam_before: camBefore && camBefore.yaw !== undefined ? { yaw: camBefore.yaw } : null,
      });
      await h.h('camera', null);
    }
    out.checks.c2_projectpoint_under_a_posed_camera = {
      question: 'bloom-sight.json reports on_screen:false on all 96 rows, including 16 rows with '
        + 'up to 27,134 amber px. Which observable is lying?',
      rows,
      pixels_say_visible_on: rows.filter((r) => r.amber_px > 400).length,
      projection_says_on_screen_on: rows.filter((r) => r.projected && r.projected.on_screen).length,
      every_row_has_the_eye_applied: rows.every((r) => r.pos_was_applied),
      no_row_has_the_yaw_applied: rows.every((r) => !r.yaw_was_applied),
      finding: 'engine.camera({pos,look}) writes c.pos and c.pivot and NEVER writes c.yaw/c.pitch; '
        + 'engine.projectPoint -> sim/camera.js project() -> viewBasis(c) builds the view basis '
        + 'from c.yaw/c.pitch alone. So projectPoint is blind to every posed camera in the project.',
    };
    log(`C2 pixels-visible ${out.checks.c2_projectpoint_under_a_posed_camera.pixels_say_visible_on}/4, `
      + `projection-on-screen ${out.checks.c2_projectpoint_under_a_posed_camera.projection_says_on_screen_on}/4`);
  }

  // ---- C3: the drawn purse, path_to_ten item 8 ---------------------------------------------
  if (ONLY.includes('c3')) {
    out.checks.c3_drawn_purse = await h.page.evaluate(async () => {
      const eng = window.__ENGINE || (window.__HARNESS && window.__HARNESS._engine);
      const H = window.__HARNESS;
      H.loadState('settlement_primary_street'); H.setRenderRate(0); H.stepFrames(4);
      const read = () => {
        H.openMenu('inventory');
        const s = H.getUIState();
        const el = (s.elements || []).find((e) => e.id === 'inventory.gold');
        H.closeMenu(); H.stepFrames(2);
        return {
          drawn: el ? el.text : null,
          progression_gold: eng.sim.progression.gold,
          stealth_gold: eng.sim.stealth && eng.sim.stealth.p ? eng.sim.stealth.p.gold : null,
          magic_gold: eng.magic ? eng.magic.gold : null,
          combat_world_gold: eng.combat && eng.combat.world ? eng.combat.world.gold : null,
          sim_loadout_gold: eng.sim.loadout ? eng.sim.loadout.gold : '(sim.loadout undefined)',
          sim_gold: eng.sim.gold === undefined ? '(sim.gold undefined)' : eng.sim.gold,
        };
      };
      const before = read();
      try { H.setGold(777); } catch (e) { /* verb may not exist */ }
      H.stepFrames(2);
      const after = read();
      return {
        question: 'path_to_ten item 8 — is the drawn purse still a constant zero?',
        before, after,
        drawn_moved: before.drawn !== after.drawn,
        still_zero: String(after.drawn || '').trim().startsWith('0'),
      };
    });
    log(`C3 drawn purse before=${JSON.stringify(out.checks.c3_drawn_purse.before.drawn)} `
      + `after setGold(777)=${JSON.stringify(out.checks.c3_drawn_purse.after.drawn)}`);
  }

  // ---- C4: the clock's world-side consumer, driven ------------------------------------------
  if (ONLY.includes('c4')) {
    const CLOCK_ARM = async ({ del, deaths }) => {
      const H = window.__HARNESS;
      const eng = window.__ENGINE || (H && H._engine);
      const envSys = eng.sim.environment;
      let restore = null;
      if (del) {
        // The round-2 clock, restored on the instance: the tick runs during the death surface.
        const FPD = 259200;
        const orig = envSys.step.bind(envSys);
        restore = envSys.step;
        envSys.step = function (sim, bus) {
          const env = sim.env;
          const held = !!(sim._death && sim._death.active);
          const r = orig(sim, bus);
          if (held && !this.paused) {
            env._clockFrames = (env._clockFrames + 1) % FPD;
            if (env._clockFrames === 0) env.dayCount = (env.dayCount | 0) + 1;
            env.timeOfDay = Math.round((env._clockFrames % FPD) * 24 / FPD * 1e6) / 1e6;
          }
          return r;
        };
      }
      try {
        H.loadState('default'); H.setRenderRate(0);
        const wells = H.listHearths().hearths || [];
        const well = wells.find((x) => x.kind === 'settlement') || wells[0];
        H.teleport(well.pos[0], well.pos[2]); H.stepFrames(2);
        H.restAt(well.id); H.stepFrames(2);
        H.setTimeOfDay(20.966666);                 // 20:58, two minutes off the night window
        H.teleport(well.pos[0] + 60, well.pos[2] + 20); H.stepFrames(6);
        const hourBefore = eng.sim.env.timeOfDay;
        for (let i = 0; i < deaths; i++) {
          H.damagePlayer(100000, { stagger: false });
          H.stepFrames(1);
          let g = 0;
          while (H.getDeathState().surface_active && g < 400) { H.stepFrames(1); g++; }
        }
        const hourAfter = eng.sim.env.timeOfDay;

        // THE CONSUMER, driven through the world: spawn an ordinary enemy, kill it, and read
        // what the purse was actually paid. `sim/souls.js awardFor()` multiplies by 1.35 inside
        // the night window, which opens at 21:00 — the hour these deaths do or do not cross.
        const soulsBefore = H.getDeathState().souls_held;
        H.spawn('inf_trash', 4, 4, { as: 'crit-night-probe' });
        H.stepFrames(2);
        H.killEntity('crit-night-probe');
        H.stepFrames(20);
        const soulsAfter = H.getDeathState().souls_held;
        return {
          deaths, hour_before: hourBefore, hour_after: hourAfter,
          hours_burned: +(hourAfter - hourBefore).toFixed(6),
          crossed_the_night_window_at_21h: hourBefore < 21 && hourAfter >= 21,
          souls_before: soulsBefore, souls_after: soulsAfter,
          souls_paid_for_one_ordinary_kill: soulsAfter - soulsBefore,
          phase: H.getEnvironment().phase,
        };
      } catch (e) {
        return { fatal: String((e && e.stack) || e) };
      } finally { if (restore) envSys.step = restore; }
    };
    const DEATHS = Number(args.deaths || 4);
    const shipped = await h.page.evaluate(CLOCK_ARM, { del: false, deaths: DEATHS });
    const deleted = await h.page.evaluate(CLOCK_ARM, { del: true, deaths: DEATHS });
    out.checks.c4_clock_consumption = {
      question: 'RULES.md 5 for the clock hold — does an ENTITY behave differently, or does only '
        + 'the clock field differ? clock.json read getEnvironment().phase (night on both sides) '
        + 'and getWorldStats().settlement (null) and concluded nothing.',
      night_window_opens_at_h: 21,
      shipped, fix_deleted: deleted,
      the_same_enemy_paid_differently: shipped.souls_paid_for_one_ordinary_kill
        !== deleted.souls_paid_for_one_ordinary_kill,
      only_the_unheld_arm_crossed_the_hour: shipped.crossed_the_night_window_at_21h === false
        && deleted.crossed_the_night_window_at_21h === true,
    };
    log(`C4 shipped ${shipped.hour_before}->${shipped.hour_after} paid ${shipped.souls_paid_for_one_ordinary_kill} | `
      + `deleted ${deleted.hour_before}->${deleted.hour_after} paid ${deleted.souls_paid_for_one_ordinary_kill}`);
  }

  out.ok = true;
} catch (err) {
  out.error = String(err && err.stack ? err.stack : err);
  out.ok = false;
  log(`ERROR ${out.error}`);
} finally {
  if (handle) await handle.close();
}

writeJson(args.out || 'reports/runs/critic-W1-13-R3/critic-probe.json', out);
process.exit(out.ok ? 0 : 1);
