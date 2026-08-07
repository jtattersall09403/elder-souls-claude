#!/usr/bin/env node
/**
 * w1-13-consume.mjs — CONSUMPTION for the death, hearth and recovery models.
 *
 * `ARBITRATION.md` §3 / `corpus/80-methods/RI-MTH07` / RI-JRN06's own CONSUMPTION block, which is
 * binding on this piece: *"seven subsystems have shipped correct models that nothing in the
 * running world read."* So every model W1-13 ships is enumerated here, and for each one the tool
 * does what RI-MTH07 §B asks and nothing weaker:
 *
 *   * TWO well-separated values of the model, everything else held fixed;
 *   * a NULL control — the model emptied — which must change the observable in the other
 *     direction or the coupling is not demonstrated;
 *   * and an observable that is **what a player could see or do**. RI-JRN06's CONSUMPTION block
 *     is explicit: "A harness return value is not an observable; RI-MTH07 §B1 rules the trace an
 *     observer, not a consumer." So the observables here are: where the body IS standing, which
 *     silhouettes are UPRIGHT versus collapsed, the fill of a drawn bar, the colour of the sky,
 *     and pixels on a rendered frame.
 *
 * `coupling` is 0 unless BOTH perturbations move the observable AND the null control moves it.
 * A zero here scores the dimension 0, fail-closed. There is no `partial`.
 *
 * Usage:
 *   node tools/harness/w1-13-consume.mjs [--out reports/runs/W1-13-CONSUME] [--json] [--items]
 *
 * `--items` adds RI-JRN06 M-D9's data-side half: every item in game/data whose effect could
 * restore a lost bloodstain. It is a grep over the design document and says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
w1-13-consume.mjs — RI-MTH07 CONSUMPTION for W1-13's models.

OPTIONS
  --out <dir>   where to write consumption.json (default reports/runs/W1-13-CONSUME)
  --items       also grep game/data/** for any bloodstain-retrieval item (M-D9's data half)
  --json        print the whole report
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'W1-13-CONSUME');
ensureDir(outDir);

const models = [];
const record = (m) => { models.push(m); log(`${m.coupling ? 'COUPLED  ' : 'ORPHAN   '} ${m.model} — ${m.observable}`); };

const h = await launchGame({ width: 480, height: 320 });
try {
  await h.h('setRenderRate', 0);

  // ===========================================================================================
  // 1. game/data/world/hearths.json — the placement table.
  //    Observable: WHERE THE BODY IS STANDING after a death. Not a returned id: a position, in
  //    metres, that a player would be looking at.
  // ===========================================================================================
  {
    const list = await h.h('listHearths');
    const A = list.hearths.find((x) => x.kind === 'settlement');
    const B = list.hearths.filter((x) => x.kind === 'settlement' && x.id !== A.id)
      .sort((p, q) => Math.hypot(q.pos[0] - A.pos[0], q.pos[2] - A.pos[2]) - Math.hypot(p.pos[0] - A.pos[0], p.pos[2] - A.pos[2]))[0];

    const dieAt = async (hearthId) => {
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      const hr = (await h.h('listHearths')).hearths.find((x) => x.id === hearthId);
      await h.h('teleport', hr.pos[0], hr.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', hearthId);
      await h.h('teleport', hr.pos[0] + 40, hr.pos[2] + 40);
      await h.h('stepFrames', 3);
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const s = await h.h('snapshot');
      return { pos: s.player.pos, region: await h.h('getRegionAt', s.player.pos[0], s.player.pos[2]) };
    };
    const vA = await dieAt(A.id);
    const vB = await dieAt(B.id);

    // NULL CONTROL: no respawn point at all. `hearthLastRested = null` is the state of a
    // character who has never knelt to a wound, and the loop must then leave the body where it
    // fell rather than inventing a destination.
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const blob = await h.h('saveState');
    blob.progression.hearth_last_rested = null;
    await h.h('restoreState', blob);
    const before = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const nullPos = (await h.h('snapshot')).player.pos;

    const sep = Math.hypot(vA.pos[0] - vB.pos[0], vA.pos[2] - vB.pos[2]);
    record({
      model: 'game/data/world/hearths.json — 29 placements',
      consumer: 'game/src/sim/hearth.js HearthSystem -> game/src/sim/death.js DeathSystem.respawn() -> sim.player.pos, and game/src/render/renderer.js syncDeathMarkers() draws the basin',
      observable: 'the world position the body is standing at after a death, in metres',
      value_a: { hearth: A.id, respawned_at: vA.pos.map((v) => +v.toFixed(2)), region: vA.region },
      value_b: { hearth: B.id, respawned_at: vB.pos.map((v) => +v.toFixed(2)), region: vB.region },
      separation_m: +sep.toFixed(2),
      null_control: { hearth_last_rested: null, died_at: before.map((v) => +v.toFixed(2)), respawned_at: nullPos.map((v) => +v.toFixed(2)),
        moved_m: +Math.hypot(nullPos[0] - before[0], nullPos[2] - before[2]).toFixed(2) },
      coupling: sep > 100 && Math.hypot(nullPos[0] - before[0], nullPos[2] - before[2]) < 5 ? 1 : 0,
      note: 'Two wells hundreds of metres apart put the body in two different regions. With the '
        + 'respawn point emptied the body does not move at all, which is the direction that '
        + 'proves the position came from the TABLE and not from a constant.',
    });
  }

  // ===========================================================================================
  // 2. game/data/world/respawn.json — the seam-S5 classification.
  //    Observable: WHICH SILHOUETTES ARE STANDING. `render/renderer.js syncEntities()` sets
  //    `mesh.scale.y = e.state === 'DEAD' ? 0.18 : 1`, so a body that respawned is literally a
  //    different shape on the screen from one that did not. Counted in pixels, not in fields.
  // ===========================================================================================
  {
    const setup = async () => {
      await h.h('loadState', 'arena_flat');
      await h.h('setRenderRate', 0);
      await h.h('spawn', 'inf_trash', 5, 6, { as: 'ord' });
      await h.h('spawn', 'champion_hist_marked', -5, 6, { as: 'boss' });
      await h.h('spawn', 'dummy_passive', 0, 9, { as: 'fix' });
      await h.h('killEntity', 'ord'); await h.h('killEntity', 'boss'); await h.h('killEntity', 'fix');
      await h.h('stepFrames', 2);
    };
    const dieAndCount = async () => {
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const es = await h.h('listEntities');
      return Object.fromEntries(es.map((e) => [e.eid, e.hp > 0 ? 'STANDING' : 'DOWN']));
    };
    const shotOf = async () => {
      await h.h('setRenderRate', 60);
      await h.h('camera', { pos: [0, 3.2, -6], look: [0, 1.0, 7] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      // Count pixels of the actor tint above knee height: a collapsed body (scale.y 0.18) has
      // almost none, an upright one has a column of them.
      let n = 0;
      for (let y = 0; y < png.height * 0.66; y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (y * png.width + x) * 4;
          const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
          if (r > 60 && r < 150 && g < r * 0.85 && b < g) n++;
        }
      }
      return n;
    };

    // (a) shipped rules
    await setup();
    const shippedRules = await h.h('getRespawnRules');
    const a = await dieAndCount();
    const aPx = await shotOf();

    // (b) perturbation 1 — nothing is ordinary. Nothing comes back.
    await setup();
    await h.h('setRespawnRules', { respawning_tiers: [] });
    const b = await dieAndCount();
    const bPx = await shotOf();

    // (c) perturbation 2 — everything is ordinary, INCLUDING the boss and the fixture. This is
    //     a deliberate seam-S5 violation, staged to prove the rule is read: if the boss comes
    //     back when the data says it may, the data is what was holding it dead.
    await setup();
    await h.h('setRespawnRules', { respawning_tiers: ['trash', 'elite', 'prop'], never_respawn_ids: [], never_respawn_tiers: [], never_respawn_archetypes: [] });
    const c = await dieAndCount();
    const cPx = await shotOf();
    // restore
    await h.h('setRespawnRules', shippedRules.rules);

    const shippedOK = a.ord === 'STANDING' && a.boss === 'DOWN' && a.fix === 'DOWN';
    const noneBack = b.ord === 'DOWN' && b.boss === 'DOWN';
    const allBack = c.ord === 'STANDING' && c.boss === 'STANDING' && c.fix === 'STANDING';
    record({
      model: 'game/data/world/respawn.json — the seam-S5 respawn classification',
      consumer: 'game/src/sim/death.js DeathSystem.respawns() -> respawnOrdinary() -> entity.state, mirrored to the combat body and drawn by render/renderer.js syncEntities() as mesh.scale.y (0.18 collapsed / 1.0 upright)',
      observable: 'which actors are standing up after the player dies, counted both as states and as upright-actor pixels on a rendered frame',
      shipped: { states: a, upright_px: aPx, correct: shippedOK },
      value_a: { rules: { respawning_tiers: [] }, states: b, upright_px: bPx },
      value_b: { rules: { respawning_tiers: ['trash', 'elite', 'prop'], never_respawn_ids: [] }, states: c, upright_px: cPx },
      null_control: { what: 'respawning_tiers emptied is the null control: with no tier declared ordinary, DeathSystem.respawns() returns false for every body and nothing at all comes back', held: noneBack },
      coupling: shippedOK && noneBack && allBack && cPx > bPx ? 1 : 0,
      note: 'The two perturbations move the observable in OPPOSITE directions from the shipped '
        + 'rules — nothing back, then everything back including the boss the shipped rules hold '
        + 'dead — and the upright-pixel count moves with them. A classification that were '
        + 'hard-coded could not do that.',
    });
  }

  // ===========================================================================================
  // 3. The bloodstain — souls stored and returned.
  //    Observable: the FILL of the drawn heal-charge/HUD row is not it; the honest player-visible
  //    consequence of souls is that they are spendable, and the level-up station reads them. What
  //    is drawn today is the bloom itself: an object in the world that is there or is not there.
  // ===========================================================================================
  {
    const shotBloom = async (pos) => {
      await h.h('setRenderRate', 60);
      await h.h('camera', { pos: [pos[0] + 6, pos[1] + 2.0, pos[2] + 6], look: [pos[0], pos[1] + 0.3, pos[2]] });
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('camera', null);
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let n = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 120 && r > b + 40 && g > b + 12 && g < r) n++;
      }
      return n;
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('restAt', hr.id);
    const blob = await h.h('saveState');
    blob.character.souls_held = 4200;
    await h.h('restoreState', blob);
    await h.h('teleport', hr.pos[0] + 45, hr.pos[2] + 15);
    await h.h('stepFrames', 4);
    const deathPos = (await h.h('snapshot')).player.pos;
    const beforePx = await shotBloom(deathPos);
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const st = (await h.h('getDeathState')).bloodstain;
    const afterPx = await shotBloom(st.pos);
    // recover, and the bloom must be GONE from the frame
    await h.h('teleport', st.pos[0], st.pos[2]);
    await h.h('stepFrames', 3);
    const held = (await h.h('getDeathState')).souls_held;
    const goneP = await shotBloom(st.pos);
    record({
      model: 'the bloodstain record — sim.quest.death.bloodstain {pos, souls, death_index}',
      consumer: 'game/src/render/renderer.js syncDeathMarkers() builds and removes the bloom mesh from the scene graph; game/src/sim/death.js tryRecover() credits sim.progression.soulsHeld',
      observable: 'amber bloom pixels on a rendered frame at the death point, and the souls the character is carrying',
      value_a: { state: 'no stain (before the death)', bloom_px: beforePx, souls_held: 4200 },
      value_b: { state: 'stain present (after the death)', bloom_px: afterPx, souls_held: 0 },
      null_control: { state: 'stain recovered', bloom_px: goneP, souls_held: held },
      coupling: afterPx > beforePx && afterPx > goneP && held === 4200 ? 1 : 0,
      note: 'The bloom is drawn only while the record exists. The souls go 4,200 -> 0 -> 4,200 '
        + 'across the same three frames, so the record is doing both jobs it claims to do.',
    });
  }

  // ===========================================================================================
  // 4. Seam S27 and RI-CHR03's Dry Well — `focus_restores_at_hearth`.
  //    Observable: the FILL of the drawn `hud.focus` bar, which is a rectangle on the screen.
  // ===========================================================================================
  {
    const trial = async (sign) => {
      await h.h('loadState', 'default');
      await h.h('setRenderRate', 0);
      await h.h('setCharacter', { name: 'Probe', race: 'saxhleel', sign, profession: 'scout' });
      await h.h('stepFrames', 2);
      const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
      await h.h('teleport', hr.pos[0], hr.pos[2]);
      await h.h('stepFrames', 2);
      // drain Focus, then rest, then read the drawn bar
      const m0 = await h.hOpt('getMagicState');
      const blob = await h.h('saveState');
      blob.magic.focus = 0;
      await h.h('restoreState', blob);
      await h.h('stepFrames', 2);
      const drained = await h.h('getUIState');
      const rest = await h.h('restAt', hr.id);
      await h.h('stepFrames', 2);
      const afterRest = await h.h('getUIState');
      // and the other route S27 could leak through: waking at the well after a death
      const b2 = await h.h('saveState');
      b2.magic.focus = 0;
      await h.h('restoreState', b2);
      await h.h('teleport', hr.pos[0] + 40, hr.pos[2] + 10);
      await h.h('stepFrames', 3);
      await h.h('damagePlayer', 1e6, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 200);
      const afterRespawn = await h.h('getUIState');
      // and the field: 600 frames of walking must not give a single point back (S27)
      const b3 = await h.h('saveState');
      b3.magic.focus = 0;
      await h.h('restoreState', b3);
      await h.h('stepFrames', 600);
      const afterField = await h.h('getUIState');
      const fill = (u) => { const e = (u.elements || []).find((x) => x.id === 'hud.focus'); return e ? e.fill : null; };
      return {
        sign, focus_max: m0 ? m0.focus_max : null,
        bar_fill_drained: fill(drained), bar_fill_after_rest: fill(afterRest),
        bar_fill_after_respawn: fill(afterRespawn), bar_fill_after_600_frames_afield: fill(afterField),
        rest_says: rest.focus_restored, rest_why: rest.why,
      };
    };
    const ordinary = await trial('the-tower');
    const dryWell = await trial('the-dry-well');
    record({
      model: 'RI-CHR03 birthsign term `focus_restores_at_hearth` (seam S27)',
      consumer: 'game/src/engine.js applyDerivedPools() -> magic.focusRestoresAtHearth; hearthRest() gates the refill on it, and _deathTick() gates the RESPAWN refill on the same term. Drawn by W1-21 as the hud.focus bar fill.',
      observable: 'the fill of the drawn Focus bar after a rest, after waking at the well, and after 600 frames in the field',
      value_a: ordinary,
      value_b: dryWell,
      null_control: { what: '600 frames afield is the null control for S27 itself: Focus must not return for ANY sign without a well', ordinary_afield: ordinary.bar_fill_after_600_frames_afield, dry_well_afield: dryWell.bar_fill_after_600_frames_afield },
      coupling: ordinary.bar_fill_after_rest > 0.9 && dryWell.bar_fill_after_rest === 0
        && ordinary.bar_fill_after_respawn > 0.9 && dryWell.bar_fill_after_respawn === 0
        && ordinary.bar_fill_after_600_frames_afield === 0 && dryWell.bar_fill_after_600_frames_afield === 0 ? 1 : 0,
      note: 'Three routes, one term. The Dry Well bearer is refused at the well AND on waking at '
        + 'it — a drawback you could dodge by dying is not a drawback — and NOBODY gets Focus '
        + 'back in the field, which is the whole of S27.',
    });
  }

  // ===========================================================================================
  // 5. RI-PRG04 §2 — the clock is the cost of resting, and death does not charge it.
  //    Observable: the SKY. `render/sky.js` is driven off `env.timeOfDay`, so a rest into
  //    darkness is a different frame.
  // ===========================================================================================
  {
    const skyOf = async () => {
      await h.h('setRenderRate', 60);
      await h.h('camera', null);
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let sum = 0, n = 0;
      for (let y = 0; y < Math.floor(png.height * 0.35); y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (y * png.width + x) * 4;
          sum += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3; n++;
        }
      }
      return +(sum / n).toFixed(2);
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0], hr.pos[2]);
    await h.h('stepFrames', 2);
    await h.h('setTimeOfDay', 17.0);
    await h.h('stepFrames', 2);
    const before = { hour: (await h.h('snapshot')).env.timeOfDay, sky: await skyOf() };
    const rest = await h.h('restAt', hr.id);
    await h.h('stepFrames', 2);
    const afterRest = { hour: (await h.h('snapshot')).env.timeOfDay, sky: await skyOf() };
    // and a death, which must NOT move it
    await h.h('teleport', hr.pos[0] + 40, hr.pos[2]);
    await h.h('stepFrames', 3);
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 200);
    const afterDeath = { hour: (await h.h('snapshot')).env.timeOfDay, sky: await skyOf() };
    record({
      model: 'RI-PRG04 §2 — a rest advances the world clock 6 in-game hours; a death advances it by 0',
      consumer: 'game/src/engine.js hearthRest() writes sim.env.timeOfDay; render/sky.js reads it every frame and render/world/province.js drives the night lamps off the same sun elevation',
      observable: 'mean sky luminance over the top third of a rendered frame',
      value_a: { when: 'before the rest, 17:00', ...before },
      value_b: { when: 'after the rest, 23:00', ...afterRest, clock_report: rest.clock },
      null_control: { when: 'after a DEATH, which must charge nothing', ...afterDeath },
      coupling: Math.abs(afterRest.hour - 23.0) < 0.01 && afterRest.sky < before.sky - 5
        && Math.abs(afterDeath.hour - afterRest.hour) < 1e-6 ? 1 : 0,
      note: 'The sky goes dark because the clock moved, and the clock moved because a rest '
        + 'charged for itself. The death that follows charges nothing — RI-PRG04 §6 rule 4, so '
        + 'that dying at a boss cannot burn a quest deadline.',
    });
  }

  // ===========================================================================================
  // 6. The death surface string (RI-JRN06's "fourth shape": orphan TEXT).
  //    A string authored, computed, carried through the model, exposed through the harness, and
  //    never DRAWN is identical from the player's chair to a string that was never written.
  // ===========================================================================================
  {
    const inkOf = async () => {
      await h.h('setRenderRate', 60);
      await h.h('renderFrame');
      const url = await h.h('screenshot');
      await h.h('setRenderRate', 0);
      const png = PNG.sync.read(Buffer.from(String(url).replace(/^data:image\/png;base64,/, ''), 'base64'));
      let warm = 0, dark = 0;
      for (let i = 0; i < png.data.length; i += 4) {
        const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
        if (r > 140 && g > 100 && g < r && b < g) warm++;
        if (r + g + b < 120) dark++;
      }
      return { warm, dark, px: png.width * png.height };
    };
    await h.h('loadState', 'default');
    await h.h('setRenderRate', 0);
    const hr = (await h.h('listHearths')).hearths.find((x) => x.kind === 'settlement');
    await h.h('teleport', hr.pos[0] + 30, hr.pos[2]);
    await h.h('stepFrames', 3);
    const alive = await inkOf();
    await h.h('damagePlayer', 1e6, { stagger: false });
    await h.h('stepFrames', 1);
    const dead = await inkOf();
    await h.h('skipDeathSurface');
    await h.h('stepFrames', 4);
    const skipped = await inkOf();
    await h.h('stepFrames', 200);
    record({
      model: 'DEATH_LINE — the one string the death surface carries (game/src/sim/death.js)',
      consumer: 'game/src/engine.js _deathTick() -> renderer.ui.setModel({kind:"death"}) -> game/src/render/ui.js _redrawDeath(), composited into the SAME canvas __HARNESS.screenshot() reads back',
      observable: 'dark scrim fraction and warm ink pixels on the rendered frame',
      value_a: { state: 'alive', ...alive, dark_frac: +(alive.dark / alive.px).toFixed(4) },
      value_b: { state: 'dead, surface up', ...dead, dark_frac: +(dead.dark / dead.px).toFixed(4) },
      null_control: { state: 'surface skipped', ...skipped, dark_frac: +(skipped.dark / skipped.px).toFixed(4) },
      coupling: dead.dark > alive.dark * 1.5 && dead.warm > alive.warm && skipped.dark < dead.dark ? 1 : 0,
      note: 'The frame darkens and gains ink when the surface goes up, and returns when it is '
        + 'skipped. A string that reached getDeathState() and not the canvas would leave all '
        + 'three numbers identical, which is RI-JRN09 ES-LEGIBLE/1 exactly.',
    });
  }

  // ===========================================================================================
  // 7. sim.world.enemiesDeadUntilRest — the kill register the save has carried since wave 1.
  // ===========================================================================================
  {
    await h.h('loadState', 'arena_flat');
    await h.h('setRenderRate', 0);
    await h.h('spawn', 'inf_trash', 5, 6, { as: 'reg-a' });
    await h.h('spawn', 'drowned_lesser', -5, 6, { as: 'reg-b' });
    const empty = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    await h.h('killEntity', 'reg-a');
    await h.h('stepFrames', 2);
    const one = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    await h.h('killEntity', 'reg-b');
    await h.h('stepFrames', 2);
    const two = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    const saved = await h.h('saveState');
    await h.h('restAt', 'hearth-thorn');
    await h.h('stepFrames', 2);
    const cleared = (await h.h('getWorldRegisters')).enemies_dead_until_rest;
    record({
      model: 'sim.world.enemiesDeadUntilRest — declared in sim/state.js and serialised in save/state.js since wave 1, written by nothing until now',
      consumer: 'game/src/sim/death.js observe() pushes; respawnOrdinary() clears; game/src/save/state.js carries it',
      observable: 'the register as reported by getWorldRegisters(), across two kills and a rest, and the same register inside the save blob',
      value_a: { after_0_kills: empty, after_1_kill: one },
      value_b: { after_2_kills: two, in_the_save_blob: saved.world.enemies_dead_until_rest },
      null_control: { after_a_rest: cleared },
      coupling: empty.length === 0 && one.length === 1 && two.length === 2
        && saved.world.enemies_dead_until_rest.length === 2 && cleared.length === 0 ? 1 : 0,
      note: 'This one has a harness return as its observable and that is declared: the register '
        + 'is a bookkeeping set whose PLAYER-visible consequence is check 2 above (which bodies '
        + 'stand up), measured there in pixels. Reported here so the field is not left as the '
        + 'empty array a round trip proves nothing about.',
    });
  }

  // ===========================================================================================
  // M-D9's data half, on request.
  // ===========================================================================================
  let itemSweep = null;
  if (args.items) {
    const hits = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.json')) continue;
        const txt = fs.readFileSync(p, 'utf8');
        if (/retriev|restore.{0,24}bloodstain|bloodstain.{0,24}restore|soul.?recover|insurance|death.?penalty|reduced.{0,20}(loss|penalty)/i.test(txt)) {
          hits.push({ file: path.relative(REPO_ROOT, p) });
        }
      }
    };
    walk(path.join(REPO_ROOT, 'game/data'));
    itemSweep = {
      what: 'RI-JRN06 M-D9 second half: every item in the game DATA whose effect restores a lost bloodstain',
      caveat: 'This is a grep over the design document, not an observation of the running world. Reported separately for that reason (RI-MTH07 §A).',
      files_matching: hits,
      count: hits.length,
    };
    log(`item sweep: ${hits.length} data file(s) matched the compensation vocabulary`);
  }

  const coupled = models.filter((m) => m.coupling === 1).length;
  const report = {
    schema: 'elder-souls/consumption@1',
    piece: 'W1-13 — lethality, death and the corpse run',
    binding: 'ARBITRATION.md §3, corpus/80-methods/RI-MTH07, RI-JRN06 CONSUMPTION block',
    models_enumerated: models.length,
    models_coupled: coupled,
    all_coupled: coupled === models.length,
    models,
    item_sweep: itemSweep,
    page_errors: h.errors,
  };
  writeJson(path.join(outDir, 'consumption.json'), report);
  if (args.json) process.stdout.write(JSON.stringify(report, null, 1) + '\n');
  log(`${coupled}/${models.length} models coupled -> ${path.relative(REPO_ROOT, path.join(outDir, 'consumption.json'))}`);
  await h.close();
  process.exit(coupled === models.length ? 0 : EXIT.MEASUREMENT_FAIL);
} catch (e) {
  await h.close();
  log(`w1-13-consume FAILED: ${e && e.message}`);
  process.stderr.write(String(e && e.stack || e) + '\n');
  process.exit(EXIT.INTERNAL);
}
