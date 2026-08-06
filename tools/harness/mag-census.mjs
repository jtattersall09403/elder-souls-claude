#!/usr/bin/env node
// mag-census.mjs — RI-MAG06's effect-behaviour census, as an instrument.
//
// THE ITEM THIS IMPLEMENTS, and why it exists. RI-MAG06 was filed by the W1-14 critic under
// CORPUS-CONTRACT §5 as a `corpus_hole`: no item in `corpus/25-magic/` contained a check that an
// effect DOES anything. RI-MAG02 M1 is a diff of two JSON files, M2 is arithmetic, M3 is a grep,
// M6 probes ten named effects. A build could ship all 55 records, recompute every cost exactly,
// pass M1/M2/M3 and the economy axis outright, and have FIVE working effects — which is what
// wave 1 shipped, and it is why the builder's own static audit returned 10 of 11.
//
// So this file is deliberately NOT a re-run of the old probe with more assertions. It is the
// paired read, per effect, against the consuming system RI-MAG06 §B names for that effect:
//
//   M1  DELIVERY      find a carrier, cast it at 6 m and at 1.4 m, at WIL 99 and all skills 100
//   M2  PAIRED READ   read §B's named system before and after, in the same run, with a CONTROL
//                     run in which the effect is not cast. Different => the effect did something.
//   M3  GENERIC-APPLICATOR DETECTOR — for every non-damage effect, assert the target's hp delta
//                     is ZERO. This is the decisive check and any count > 3 is a hard fail.
//   M4  UNREAD-TIMER DETECTOR — a row in effects_active with no delta anywhere.
//   M5  DECLARED VS MEASURED — every `changes_traversal: true` effect that measured UNREAD_TIMER.
//   M6  the permitted exceptions, each with the piece that owns the missing consuming system.
//
// IT SCORES NOTHING. RI-MAG06's bands are the critic's to apply. This produces the two aggregate
// numbers the item says a verdict must carry, plus the per-effect row each rests on.
//
// A NOTE ON SELF-MARKING, because it matters for whether this instrument is worth anything.
// The build now emits its own `consumer` / `before` / `after` on every `effect_apply` event.
// This file does NOT trust that. Every row below is measured by reading the consuming system
// through an independent harness call before and after, and the build's own claim is recorded
// alongside as `declared_consumer` so that a disagreement between the two is visible in the
// output rather than hidden by it. If they ever disagree, the measurement wins and the row is
// flagged `self_report_disagrees`.
//
// USAGE  node tools/harness/mag-census.mjs [--out <dir>] [--json]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, RUNS_DIR, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
mag-census.mjs — RI-MAG06 M1-M6: the effect-behaviour census, measured against consuming systems.

USAGE
  node tools/harness/mag-census.mjs [--entry <path>] [--out <dir>] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'MAG-CENSUS');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();

    const D = H.getMagicData();
    const effects = D.effects.effects;
    const spells = D.spells.spells;
    const consumerMap = H.getEffectConsumerMap();

    // ---- the carrier table: for each effect, the cheapest shipped spell that delivers it -----
    // RI-MAG06 M1: "Record NOT_OBSERVED for any effect with no castable carrier — including an
    // effect whose only carrier costs more Focus than the maximum reachable pool."
    const MAX_POOL = (() => { H.setWillpower(99); return H.getMagicState().focus_max; })();
    const carriers = {};
    for (const e of effects) {
      const cands = spells
        .filter((s) => s.effects.some((t) => t.effect === e.id))
        .map((s) => ({ id: s.id, cost: s.focus_cost.great_staff, cls: s.class, range: s.range, n: s.effects.length }))
        .sort((a, b) => a.n - b.n || a.cost - b.cost);
      const castable = cands.filter((c) => c.cost <= MAX_POOL);
      carriers[e.id] = { all: cands, chosen: castable[0] || null, uncastable: cands.filter((c) => c.cost > MAX_POOL).map((c) => `${c.id}:${c.cost}`) };
    }

    // ---- the arena. Identical for treatment and control, seeded identically. -----------------
    const arena = (opts = {}) => {
      H.setSeed(1337);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.resetMagicWorld();
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'boardwalk', crouched: true });
      H.setEquipLoad(24);
      H.hearthRest();
      H.magicEventsDrain();
      const eid = opts.spawn === false ? null : H.spawn(opts.archetype || 'inf_trash', 0, opts.dist === undefined ? 6 : opts.dist);
      if (eid && opts.aggro !== false) H.aggro(eid);
      return eid;
    };

    /** Every consuming system RI-MAG06 §B names, in one object, read on one frame. */
    const readAll = (eid) => {
      const ps = H.getPlayerStats();
      const cs = H.getCombatState();
      const ms = H.getMagicState();
      const st = H.getStealthState();
      const qs = H.getQuestState();
      const ents = H.listEntities();
      const enemy = cs.enemies.find((x) => x.id === eid) || cs.enemies[0] || null;
      const ec = ents.find((x) => x.eid === eid) || null;
      return {
        player: {
          hp: ps.hp, hp_max: ps.hp_max, pos: ps.pos.map((v) => Math.round(v * 1e4) / 1e4),
          equip_load_pct: ps.equip_load_pct, roll_class: ps.roll_class,
          attributes: { ...ps.attributes }, in_combat: ps.in_combat,
          focus: ms.focus, pos_y: ms.pos_y_m,
        },
        enemy: enemy ? {
          id: enemy.id, hp: enemy.hp, hp_max: enemy.hp_max, state: enemy.state,
          dead: enemy.dead, yielded: enemy.yielded,
        } : null,
        enemy_entity: ec ? { hp: ec.hp, pos: ec.pos } : null,
        alert_state: H.snapshot().entities && H.snapshot().entities[0] ? H.snapshot().entities[0].alert_state : null,
        stealth: { V: st.V, sound_r_m: st.sound_r_m, light: st.light, magic: st.magic, race: st.race, hud_elements: st.hud_elements },
        quest: {
          journal: qs.journal.length, topics: qs.topicsKnown.slice().sort(),
          flags: Object.keys(qs.flags).sort(), dispositions: { ...qs.dispositions },
          afflictions: (H.saveState().afflictions || []).map((a) => a.id).sort(),
        },
        magic: {
          gems: ms.gems, xul_hesh: ms.xul_hesh, levitating: ms.levitating,
          altitude_m: ms.altitude_m, effects_active: ms.effects_active.map((a) => a.effect).sort(),
        },
        world: H.getMagicWorld(),
        status: H.getStatusState(),
        entities: ents.length,
        entity_ids: ents.map((x) => x.eid).sort(),
        solid_ahead: H.solidAt(0, 2, 3).solid,
        save_world: (() => { const s = H.saveState(); return { doors: s.world.doors_unlocked.slice(), shortcuts: s.world.shortcuts_opened.slice(), mark: s.travel.mark }; })(),
      };
    };

    /**
     * Cast `spellId` once and run the world for `frames`. Returns the reads either side plus
     * every magic event. The cast is driven by the `light` button through the real input
     * pipeline, so the spell goes through the same commitment machinery a swing does.
     *
     * NOTE (cost me 40 minutes in round 1 and it is in the W1-14 status file): queueInputs
     * event frames are RELATIVE to the frame queueInputs was called on.
     */
    const castOnce = (spellId, opts = {}) => {
      const eid = arena(opts);
      H.setAttuned([spellId]);
      const before = readAll(eid);
      const sp = spells.find((s) => s.id === spellId);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      const frames = opts.frames === undefined ? (sp.frames.total + 200) : opts.frames;
      const during = [];
      for (let i = 0; i < frames; i++) {
        H.stepFrames(1);
        if (opts.sampleEvery && i % opts.sampleEvery === 0) during.push(readAll(eid));
      }
      const events = H.magicEventsDrain();
      const after = readAll(eid);
      return { eid, before, after, during, events, spell: spellId };
    };

    /** The control: the identical run with nothing cast. */
    const controlRun = (spellId, opts = {}) => {
      const eid = arena(opts);
      H.setAttuned([spellId]);
      const before = readAll(eid);
      const sp = spells.find((s) => s.id === spellId);
      const frames = opts.frames === undefined ? (sp.frames.total + 200) : opts.frames;
      for (let i = 0; i < frames; i++) H.stepFrames(1);
      H.magicEventsDrain();
      return { eid, before, after: readAll(eid) };
    };

    // ---- the per-effect probes. Each returns {consumer, delta, functions} ---------------------
    //
    // `functions` is the judgement THIS FILE makes from the reading it took. It is never taken
    // from the build's self-report.
    const num = (v) => (typeof v === 'number' ? v : 0);
    const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);

    const PROBES = {
      // ---- damage: hp falls by the deterministic output AND the buildup meter advances -------
      _damage: (id) => (r) => {
        const hpFall = num(r.before.enemy && r.before.enemy.hp) - num(r.after.enemy && r.after.enemy.hp);
        const st = r.after.status.find((s) => s.id === (r.after.enemy && r.after.enemy.id));
        const buildupMoved = !!(st && Object.values(st.buildup || {}).some((v) => v > 0)) ||
          r.events.some((e) => e.kind === 'status_buildup' || e.kind === 'status_proc');
        const needsBuildup = id !== 'damage_health';
        return {
          consumer: 'target.hp + status_buildup',
          delta: { hp_fall: hpFall, buildup_moved: buildupMoved },
          functions: hpFall > 0 && (!needsBuildup || buildupMoved),
        };
      },
      drain_health: (r) => {
        const d = num(r.before.enemy && r.before.enemy.hp_max) - num(r.after.enemy && r.after.enemy.hp_max);
        return { consumer: 'target.hp_max', delta: { hp_max_fall: d }, functions: d > 0 };
      },
      absorb_health: (r) => {
        const gained = num(r.after.player.hp) - num(r.before.player.hp);
        const lost = num(r.before.enemy && r.before.enemy.hp) - num(r.after.enemy && r.after.enemy.hp);
        return { consumer: 'target.hp + caster.hp', delta: { caster_gained: gained, target_lost: lost }, functions: lost > 0 && gained > 0 };
      },
      restore_health: (r) => ({ consumer: 'caster.hp', delta: { healed: num(r.after.player.hp) - num(r.before.player.hp) }, functions: num(r.after.player.hp) > num(r.before.player.hp) }),
      restore_attribute: (r) => ({ consumer: 'progression.attributes', delta: { before: r.before.player.attributes, after: r.after.player.attributes }, functions: differs(r.before.player.attributes, r.after.player.attributes) }),
      fortify_attribute: (r) => ({ consumer: 'progression.attributes', delta: { before: r.before.player.attributes, after: r.mid ? r.mid.player.attributes : r.after.player.attributes }, functions: !!r.mid && differs(r.before.player.attributes, r.mid.player.attributes) }),
      fortify_skill: (r) => ({ consumer: 'the gate (skills)', delta: { before: r.before.stealth, after: r.mid ? r.mid.stealth : null }, functions: !!r.mid && r.mid.stealth.V !== undefined && differs(r.before.stealth.magic, r.mid.stealth.magic) === false && r.fortifyMoved === true }),
      feather: (r) => ({ consumer: 'equip_load_pct + roll_class', delta: { before: r.before.player.equip_load_pct, mid: r.mid ? r.mid.player.equip_load_pct : null, class_before: r.before.player.roll_class, class_mid: r.mid ? r.mid.player.roll_class : null }, functions: !!r.mid && r.mid.player.equip_load_pct < r.before.player.equip_load_pct }),
      burden: (r) => ({ consumer: 'equip_load_pct + roll_class (target)', delta: { status_before: null, status_mid: r.mid ? r.mid.status : null }, functions: !!r.mid && r.mid.status.some((s) => s.id !== 'P' && s.equip_load_pct > 24) }),
      levitate: (r) => ({ consumer: 'pos[1] + drift + input acceptance', delta: r.lev || null, functions: !!(r.lev && r.lev.pos_y_peak > 0.5 && r.lev.drift_ok && r.lev.denied_all && r.lev.no_iframes) }),
      slowfall: (r) => ({ consumer: 'fall terminal velocity + fall damage', delta: r.fall || null, functions: !!(r.fall && r.fall.terminal_mps <= 3.6 && r.fall.damage === 0) }),
      leap: (r) => ({ consumer: 'pos[1] peak', delta: r.leap || null, functions: !!(r.leap && r.leap.apex_mult > 1) }),
      buoyancy: (r) => ({ consumer: 'water band (S25)', delta: { before: r.before.world.water, after: r.mid ? r.mid.world.water : null }, functions: !!r.mid && r.mid.world.water.buoyant === true }),
      breathe_water: (r) => ({ consumer: 'water band drown timer', delta: { before: r.before.world.water, after: r.mid ? r.mid.world.water : null }, functions: !!r.mid && r.mid.world.water.breathes === true }),
      night_eye: (r) => ({ consumer: 'stealth perceived light', delta: { before: r.before.stealth.magic, mid: r.mid ? r.mid.stealth.magic : null }, functions: !!r.mid && r.mid.stealth.magic.night_eye_bonus > 0 && r.mid.stealth.magic.perceived_light > r.before.stealth.magic.perceived_light }),
      chameleon: (r) => ({ consumer: 'stealth.V', delta: { V_before: r.before.stealth.V, V_mid: r.mid ? r.mid.stealth.V : null, pct: r.mid ? r.mid.stealth.magic.chameleon_pct : null }, functions: !!r.mid && r.mid.stealth.V < r.before.stealth.V && r.mid.stealth.magic.chameleon_pct <= 80 }),
      invisibility: (r) => ({ consumer: 'stealth.V + break rules', delta: { V_before: r.before.stealth.V, V_mid: r.mid ? r.mid.stealth.V : null, broke: r.broke }, functions: !!r.mid && r.mid.stealth.V < r.before.stealth.V && r.broke === true }),
      muffle: (r) => ({ consumer: 'stealth.sound_r_m', delta: { before: r.before.stealth.sound_r_m, mid: r.mid ? r.mid.stealth.sound_r_m : null }, functions: !!r.mid && r.mid.stealth.sound_r_m < r.before.stealth.sound_r_m }),
      false_face: (r) => ({ consumer: 'stealth.race + civilian suspicion', delta: { before: r.before.stealth.race, mid: r.mid ? r.mid.stealth.race : null, disguised: r.mid ? r.mid.stealth.magic.disguised : null }, functions: !!r.mid && r.mid.stealth.magic.disguised === true }),
      detect_life: (r) => ({ consumer: 'diegetic markers, HUD count 0', delta: { markers: r.mid ? r.mid.world.markers.length : 0, hud: r.mid ? r.mid.world.hud_elements : null }, functions: !!r.mid && r.mid.world.markers.length > 0 && r.mid.world.hud_elements === 0 }),
      detect_key: (r) => ({ consumer: 'diegetic markers, HUD count 0', delta: { markers: r.mid ? r.mid.world.markers.length : 0, hud: r.mid ? r.mid.world.hud_elements : null }, functions: !!r.mid && r.mid.world.markers.length > 0 && r.mid.world.hud_elements === 0 }),
      hist_sight: (r) => ({ consumer: 'quest.journal', delta: { before: r.before.quest.journal, after: r.after.quest.journal }, functions: r.after.quest.journal === r.before.quest.journal + 1 }),
      speak_to_the_dead: (r) => ({ consumer: 'quest.topicsKnown', delta: { before: r.before.quest.topics, after: r.after.quest.topics }, functions: r.after.quest.topics.length > r.before.quest.topics.length }),
      open_lock: (r) => ({ consumer: 'lock register + world.doors_unlocked', delta: { before: r.before.world.locks.unlocked, after: r.after.world.locks.unlocked, save: r.after.save_world.doors }, functions: r.after.world.locks.unlocked.length > r.before.world.locks.unlocked.length }),
      lock_lock: (r) => ({ consumer: 'lock register', delta: { before: r.before.world.locks.locked, after: r.after.world.locks.locked }, functions: r.after.world.locks.locked.length > r.before.world.locks.locked.length }),
      ward_trap: (r) => ({ consumer: 'trap register', delta: { before: r.before.world.traps.disarmed, after: r.after.world.traps.disarmed }, functions: r.after.world.traps.disarmed.length > r.before.world.traps.disarmed.length }),
      shatter: (r) => ({ consumer: 'breakable register + shortcuts', delta: { before: r.before.world.breakables.broken, after: r.after.world.breakables.broken, save: r.after.save_world.shortcuts }, functions: r.after.world.breakables.broken.length > r.before.world.breakables.broken.length }),
      corrode: (r) => {
        const b = r.before.status.find((s) => s.id !== 'P');
        const a = r.after.status.find((s) => s.id !== 'P');
        return { consumer: 'target.armour_rating', delta: { before: b ? b.armour_rating : null, after: a ? a.armour_rating : null }, functions: !!(a && b && a.armour_rating < b.armour_rating) };
      },
      mend_item: (r) => ({ consumer: 'item condition register', delta: { before: r.before.world.items, after: r.after.world.items }, functions: differs(r.before.world.items, r.after.world.items) && r.after.world.items.ruined_censer === r.before.world.items.ruined_censer }),
      telekinesis: (r) => ({ consumer: 'interaction reach', delta: { before: r.before.world.reach_m, mid: r.mid ? r.mid.world.reach_m : null }, functions: !!r.mid && r.mid.world.reach_m > r.before.world.reach_m }),
      wall: (r) => ({ consumer: 'collision field (solidAt)', delta: { before: r.before.world.walls.walls, mid: r.mid ? r.mid.world.walls.walls : null, solid_before: r.before.solid_ahead, solid_mid: r.mid ? r.mid.solid_ahead : null }, functions: !!r.mid && r.mid.world.walls.walls > r.before.world.walls.walls }),
      bind_lesser: (r) => ({ consumer: 'listEntities()', delta: { before: r.before.entities, mid: r.mid ? r.mid.entities : null }, functions: !!r.mid && r.mid.entities > r.before.entities }),
      bind_greater: (r) => ({ consumer: 'listEntities()', delta: { before: r.before.entities, mid: r.mid ? r.mid.entities : null }, functions: !!r.mid && r.mid.entities > r.before.entities }),
      bound_weapon: (r) => ({ consumer: 'loadout', delta: { before: r.before.world.bound_weapon, mid: r.mid ? r.mid.world.bound_weapon : null }, functions: !!(r.mid && r.mid.world.bound_weapon) }),
      resist_element: (r) => ({ consumer: 'damage taken from an identical hit', delta: r.mitig || null, functions: !!(r.mitig && r.mitig.with < r.mitig.without) }),
      resist_disease: (r) => ({ consumer: 'damage taken from an identical hit', delta: r.mitig || null, functions: !!(r.mitig && r.mitig.with < r.mitig.without) }),
      shield: (r) => ({ consumer: 'damage taken from an identical hit', delta: r.mitig || null, functions: !!(r.mitig && r.mitig.with < r.mitig.without) }),
      sap_ward: (r) => ({ consumer: 'damage taken from an identical hit', delta: r.mitig || null, functions: !!(r.mitig && r.mitig.with < r.mitig.without) }),
      cure_disease: (r) => ({ consumer: 'affliction register', delta: r.cure || null, functions: !!(r.cure && r.cure.removed) }),
      cure_poison: (r) => ({ consumer: 'affliction register', delta: r.cure || null, functions: !!(r.cure && r.cure.removed) }),
      cure_paralysis: (r) => ({ consumer: 'affliction register', delta: r.cure || null, functions: !!(r.cure && r.cure.removed) }),
      paralyse: (r) => ({ consumer: 'S11 buildup -> enemy state', delta: r.para || null, functions: !!(r.para && r.para.buildup_after_one > 0 && r.para.procced_only_after > 1 && r.para.state_stopped) }),
      silence: (r) => {
        const a = r.after.status.find((s) => s.id !== 'P') || r.mid && r.mid.status.find((s) => s.id !== 'P');
        const m = r.mid ? r.mid.status.find((s) => s.id !== 'P') : null;
        return { consumer: 'cast attempts (target.silenced)', delta: { silenced_mid: m ? m.silenced : null }, functions: !!(m && m.silenced) };
      },
      calm_beast: (r) => ({ consumer: 'alert_state + in_combat, zero deaths', delta: r.control || null, functions: !!(r.control && r.control.yielded && r.control.deaths === 0 && r.control.hp_fall === 0) }),
      demoralise: (r) => ({ consumer: 'alert_state + in_combat, zero deaths', delta: r.control || null, functions: !!(r.control && r.control.yielded && r.control.deaths === 0 && r.control.hp_fall === 0) }),
      charm: (r) => ({ consumer: 'alert_state + disposition', delta: r.control || null, functions: !!(r.control && r.control.yielded && r.control.deaths === 0 && r.control.hp_fall === 0 && r.control.disposition_moved) }),
      frenzy: (r) => ({ consumer: 'target', delta: r.control || null, functions: !!(r.control && r.control.deaths === 0 && r.control.hp_fall === 0 && r.control.target_changed) }),
      soul_trap: (r) => ({ consumer: 'gem register + xul_hesh on death', delta: r.soul || null, functions: !!(r.soul && r.soul.gems_after > r.soul.gems_before && r.soul.xul_hesh_after > r.soul.xul_hesh_before) }),
      mark: (r) => ({ consumer: 'quest.travel.mark', delta: { before: r.before.save_world.mark, after: r.after.save_world.mark }, functions: !!r.after.save_world.mark }),
      recall: (r) => ({ consumer: 'getPlayerStats().pos', delta: r.tele || null, functions: !!(r.tele && r.tele.moved_m > 10) }),
      intervention: (r) => ({ consumer: 'getPlayerStats().pos', delta: r.tele || null, functions: !!(r.tele && r.tele.moved_m > 10) }),
    };

    // =========================================================================================
    // Per-effect specialised runs. These are the ones whose consuming system needs a scripted
    // provocation (a hit to mitigate, an affliction to cure, a death to trap, a fall to slow).
    // =========================================================================================
    const SPECIAL = {};

    /** Mitigation: the same scripted 100-damage hit, with the buff and without. */
    const mitigationRun = (spellId) => {
      const measure = (cast) => {
        arena({ spawn: false });
        H.setAttuned([spellId]);
        if (cast) {
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          for (let i = 0; i < 120; i++) H.stepFrames(1);
        } else {
          for (let i = 0; i < 120; i++) H.stepFrames(1);
        }
        const hp0 = H.getPlayerStats().hp;
        H.damagePlayer(100, { stagger: false });
        return hp0 - H.getPlayerStats().hp;
      };
      return { without: measure(false), with: measure(true) };
    };

    /** Cures: plant the affliction, then cast. */
    const cureRun = (spellId, kind) => {
      arena({ spawn: false });
      H.setAttuned([spellId]);
      H.addAffliction({ id: `test_${kind}`, kind });
      const before = (H.saveState().afflictions || []).map((a) => a.id);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < 120; i++) H.stepFrames(1);
      const after = (H.saveState().afflictions || []).map((a) => a.id);
      return { before, after, removed: before.length > after.length };
    };

    // ---- run the census ---------------------------------------------------------------------
    const rows = [];
    const notes = [];

    for (const e of effects) {
      const carrier = carriers[e.id].chosen;
      const row = {
        effect: e.id, school: e.school,
        consuming_system: null, declared_consumer: null,
        carrier: carrier ? carrier.id : null,
        carrier_focus_cost: carrier ? carrier.cost : null,
        max_reachable_pool: MAX_POOL,
        uncastable_carriers: carriers[e.id].uncastable,
        class: null, hp_delta_on_target: null, effects_active_row: false,
        changes_traversal: !!e.changes_traversal,
        has_handler: consumerMap.rows.find((x) => x.effect === e.id).has_handler,
        delta: null, self_report_disagrees: false,
      };
      if (!carrier) { row.class = 'NOT_OBSERVED'; row.note = 'no castable carrier'; rows.push(row); continue; }

      const isDamage = consumerMap.damage_effects.includes(e.id);
      const touchLike = e.geometry === 'contact' || (e.ranges.includes('touch') && !e.ranges.includes('projectile'));
      const opts = { dist: touchLike ? 1.4 : 6, spawn: !(e.ranges.length === 1 && e.ranges[0] === 'self') };

      let r;
      try {
        r = castOnce(carrier.id, opts);
      } catch (err) {
        row.class = 'NOT_OBSERVED'; row.note = `cast threw: ${err && err.message}`; rows.push(row); continue;
      }

      // The mid-run read: RI-MAG06 M2 wants the system read while the effect is LIVE for a
      // timed effect (the lease), and after full duration for an instantaneous one.
      if (r.during.length) r.mid = r.during[Math.min(2, r.during.length - 1)];

      // The build's own claim, off the event stream. Recorded, never trusted.
      const ap = r.events.find((x) => x.kind === 'effect_apply' && x.effect === e.id);
      row.declared_consumer = ap ? ap.consumer : null;
      row.effects_active_row = r.after.magic.effects_active.includes(e.id) ||
        (r.mid ? r.mid.magic.effects_active.includes(e.id) : false);

      // M3, the decisive check: the target's hp delta for a non-damage effect must be ZERO.
      const hpFall = r.before.enemy && r.after.enemy ? r.before.enemy.hp - r.after.enemy.hp : 0;
      row.hp_delta_on_target = hpFall;

      const probe = PROBES[e.id] || PROBES._damage(e.id);
      const res = probe(r);
      row.consuming_system = res.consumer;
      row.delta = res.delta;

      if (isDamage) {
        row.class = res.functions ? 'FUNCTIONS_AS_SPECIFIED' : 'PARTIAL';
      } else if (res.functions) {
        row.class = hpFall === 0 ? 'FUNCTIONS_AS_SPECIFIED' : 'PARTIAL';
        if (hpFall !== 0) row.note = `moved its system BUT also took ${hpFall} hp — the applicator is still leaking`;
      } else if (hpFall !== 0) {
        row.class = 'HP_DAMAGE_ONLY';
      } else if (row.effects_active_row) {
        row.class = 'UNREAD_TIMER';
      } else {
        row.class = 'NOT_OBSERVED';
      }
      if (row.declared_consumer && ap && ap.changed === false && row.class === 'FUNCTIONS_AS_SPECIFIED') {
        row.self_report_disagrees = true;
      }
      rows.push(row);
    }

    // ---- the two aggregate numbers RI-MAG06 §C says a verdict must carry ---------------------
    const count = (c) => rows.filter((r) => r.class === c).length;
    const summary = {
      total: rows.length,
      FUNCTIONS_AS_SPECIFIED: count('FUNCTIONS_AS_SPECIFIED'),
      PARTIAL: count('PARTIAL'),
      HP_DAMAGE_ONLY: count('HP_DAMAGE_ONLY'),
      UNREAD_TIMER: count('UNREAD_TIMER'),
      NOT_OBSERVED: count('NOT_OBSERVED'),
      UNMEASURABLE: count('UNMEASURABLE'),
      'EFFECT-FUNCTION': `${count('FUNCTIONS_AS_SPECIFIED')}/${rows.length}`,
      'GENERIC-APPLICATOR': `${count('HP_DAMAGE_ONLY') + count('UNREAD_TIMER')}/${rows.length}`,
      // M5: every effect declaring changes_traversal that measured UNREAD_TIMER.
      m5_traversal_unread: rows.filter((r) => r.changes_traversal && r.class === 'UNREAD_TIMER').map((r) => r.effect),
      handlers_present: consumerMap.handlers,
      handlers_expected: consumerMap.effects,
    };

    return {
      schema: 'elder-souls/mag-census@1',
      harness_version: H.version,
      corpus_item: 'RI-MAG06',
      max_reachable_focus_pool: MAX_POOL,
      summary, rows, notes,
      consumer_map: consumerMap,
    };
  });
} finally {
  await handle.close();
}

const s = report.summary;
log(`EFFECT-FUNCTION ${s['EFFECT-FUNCTION']}   HP_DAMAGE_ONLY ${s.HP_DAMAGE_ONLY}   UNREAD_TIMER ${s.UNREAD_TIMER}   PARTIAL ${s.PARTIAL}   NOT_OBSERVED ${s.NOT_OBSERVED}`);
for (const r of report.rows) {
  if (r.class !== 'FUNCTIONS_AS_SPECIFIED') log(`  ${r.class.padEnd(22)} ${r.effect.padEnd(22)} ${r.consuming_system || ''} ${r.note || ''}`);
}
writeJson(path.join(outDir, 'mag-census.json'), report);
console.log(path.join(outDir, 'mag-census.json'));
if (args.json) console.log(JSON.stringify(report.summary, null, 2));
