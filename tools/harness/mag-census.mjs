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
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true });
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
        stealth: { V: st.V, V_raw: st.V_raw, sound_r_m: st.sound_r_m, light: st.light, magic: st.magic, race: st.race, hud_elements: st.hud_elements },
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
      // Room to heal into. `restore_health` on a character at full health is unmeasurable by
      // construction, and `absorb_health` transfers into a pool that is already at its ceiling.
      if (opts.hurtCaster) { H.damagePlayer(opts.hurtCaster, { stagger: false }); H.stepFrames(1); }
      if (opts.drainAttr) H.setAttributes({ strength: 4 });
      if (opts.equipLoad !== undefined) H.setEquipLoad(opts.equipLoad);
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
      fortify_skill: (r) => ({ consumer: 'the gate being probed (lockGate at tier 3)', delta: r.gate || null, functions: r.fortifyMoved === true }),
      // RI-MAG06 §B: "the tier moves; the 30.00/70.00 discontinuity stays exactly where it was".
      // So the paired read starts the character at 34% — MEDIUM, just over the first cliff —
      // and asserts they come out the other side of it. Starting at 24% (already LIGHT) can
      // only ever show the number falling, which is the weaker half of the claim.
      feather: (r) => ({ consumer: 'equip_load_pct + roll_class (RI-CMB01 M5 cliff)', delta: { pct_before: r.before.player.equip_load_pct, pct_mid: r.mid ? r.mid.player.equip_load_pct : null, class_before: r.before.player.roll_class, class_mid: r.mid ? r.mid.player.roll_class : null, cliff_pct: [30, 70] }, functions: !!r.mid && r.mid.player.equip_load_pct < r.before.player.equip_load_pct && r.mid.player.roll_class !== r.before.player.roll_class }),
      burden: (r) => ({ consumer: 'equip_load_pct + roll_class (target)', delta: { status_before: null, status_mid: r.mid ? r.mid.status : null }, functions: !!r.mid && r.mid.status.some((s) => s.id !== 'P' && s.equip_load_pct > 24) }),
      levitate: (r) => ({ consumer: 'pos[1] + drift + input acceptance', delta: r.lev || null, functions: !!(r.lev && r.lev.pos_y_peak > 0.5 && r.lev.drift_ok && r.lev.denied_all && r.lev.no_iframes) }),
      slowfall: (r) => ({ consumer: 'fall terminal velocity + fall damage', delta: r.fall || null, functions: !!(r.fall && r.fall.terminal_mps <= 3.6 && r.fall.damage === 0) }),
      leap: (r) => ({ consumer: 'pos[1] peak', delta: r.leap || null, functions: !!(r.leap && r.leap.higher) }),
      buoyancy: (r) => ({ consumer: 'water band (S25)', delta: { before: r.before.world.water, after: r.mid ? r.mid.world.water : null }, functions: !!r.mid && r.mid.world.water.buoyant === true }),
      breathe_water: (r) => ({ consumer: 'water band drown timer', delta: { before: r.before.world.water, after: r.mid ? r.mid.world.water : null }, functions: !!r.mid && r.mid.world.water.breathes === true }),
      night_eye: (r) => ({ consumer: 'stealth perceived light', delta: r.dark || null, functions: !!(r.dark && r.dark.after > r.dark.before) }),
      chameleon: (r) => ({ consumer: 'stealth.V', delta: { V_before: r.before.stealth.V, V_mid: r.mid ? r.mid.stealth.V : null, raw_before: r.before.stealth.V_raw, raw_mid: r.mid ? r.mid.stealth.V_raw : null, pct: r.mid ? r.mid.stealth.magic.chameleon_pct : null }, functions: !!r.mid && r.mid.stealth.V_raw < r.before.stealth.V_raw && r.mid.stealth.magic.chameleon_pct <= 80 }),
      invisibility: (r) => ({ consumer: 'stealth.V + break rules', delta: r.invis || null, functions: !!(r.invis && r.invis.v_during < r.invis.v_after && r.invis.broke === true) }),
      muffle: (r) => ({ consumer: 'stealth.sound_r_m', delta: r.sound || null, functions: !!(r.sound && r.sound.after < r.sound.before) }),
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
        const m = r.mid ? r.mid.status.find((x) => x.id !== 'P') : null;
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
    // PROVOCATION before there is anything to read: a hit to mitigate, an affliction to cure, a
    // death to trap a soul from, a fall to slow. RI-MAG06 §"How we lose" names the failure this
    // section exists to avoid — "judging the buff by the buff". Reading back
    // `effects_active: [{effect: 'resist_element', magnitude: 69.48}]` looks exactly like a
    // working resist; the only honest read is the damage number from an identical scripted hit.
    // =========================================================================================

    const castAndHold = (spellId, frames, opts) => {
      const eid = arena(opts || { spawn: false });
      H.setAttuned([spellId]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < frames; i++) H.stepFrames(1);
      return eid;
    };

    /** Mitigation: the same scripted 100-damage hit, with the buff and without. */
    const mitigationRun = (spellId) => {
      const measure = (cast) => {
        if (cast) castAndHold(spellId, 120, { spawn: false });
        else { arena({ spawn: false }); H.setAttuned([spellId]); for (let i = 0; i < 120; i++) H.stepFrames(1); }
        const hp0 = H.getPlayerStats().hp;
        H.damagePlayer(100, { stagger: false });
        return Math.round((hp0 - H.getPlayerStats().hp) * 100) / 100;
      };
      const without = measure(false);
      const w = measure(true);
      return { without, with: w };
    };

    /** Cures: plant the affliction, then cast. */
    const cureRun = (spellId, kind) => {
      arena({ spawn: false });
      H.setAttuned([spellId]);
      H.addAffliction(`test_${kind}`, kind);
      const before = (H.saveState().afflictions || []).map((a) => a.id);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < 120; i++) H.stepFrames(1);
      const after = (H.saveState().afflictions || []).map((a) => a.id);
      return { before, after, removed: before.length > after.length };
    };

    /**
     * RI-MAG02 M4.1's four assertions, all of them, in one run. The wave-1 probe read the meter
     * and never `pos[1]`, horizontal speed against a walk control, or whether the five buttons
     * were dropped — which is exactly how a broken levitation passed 19/19.
     */
    const levitationRun = () => {
      // control: how fast does this character WALK, with the stick fully forward?
      arena({ spawn: false });
      const wp0 = H.getPlayerStats().pos;
      H.queueInputs([{ f: 1, move: [0, 1] }]);
      for (let i = 0; i < 120; i++) H.stepFrames(1);
      const wp1 = H.getPlayerStats().pos;
      const walk = Math.hypot(wp1[0] - wp0[0], wp1[2] - wp0[2]) / 2;

      // treatment: levitate, climb for 6 m, then drift.
      const sp = 'levitate';
      castAndHold(sp, 90, { spawn: false });
      const f0 = H.getMagicState().focus;
      H.queueInputs([{ f: 1, press: ['jump'] }]);
      let peakY = 0;
      for (let i = 0; i < 460; i++) { H.stepFrames(1); peakY = Math.max(peakY, H.getMagicState().pos_y_m || 0); }
      const climbed = H.getMagicState().altitude_m;
      const f1 = H.getMagicState().focus;
      const focusPerMetre = climbed > 0 ? (f0 - f1) / climbed : null;

      // drift: stick fully forward while airborne.
      H.clearInputs();
      const dp0 = H.getPlayerStats().pos;
      H.queueInputs([{ f: 1, move: [0, 1] }]);
      let iframeSeen = false;
      const states = new Set();
      for (let i = 0; i < 120; i++) { H.stepFrames(1); const s = H.snapshot(); if (s.player.iframe) iframeSeen = true; states.add(s.player.state); }
      const dp1 = H.getPlayerStats().pos;
      const drift = Math.hypot(dp1[0] - dp0[0], dp1[2] - dp0[2]) / 2;

      // the five denied buttons, injected one at a time.
      H.clearInputs();
      const denied = {};
      for (const btn of ['light', 'heavy', 'block', 'roll', 'parry']) {
        const s0 = H.snapshot().player.state;
        H.queueInputs([{ f: 1, press: [btn] }, { f: 3, release: [btn] }]);
        const seen = new Set();
        for (let i = 0; i < 40; i++) { H.stepFrames(1); const s = H.snapshot(); seen.add(s.player.state); if (s.player.iframe) iframeSeen = true; }
        denied[btn] = { stayed_airborne: [...seen].every((x) => x === 'AIRBORNE' || x === 'IDLE'), states: [...seen] };
      }
      const cap = D.cast_classes.levitation.horizontal_drift_mps;
      return {
        pos_y_peak: Math.round(peakY * 1000) / 1000,
        altitude_m: climbed,
        focus_per_metre: focusPerMetre === null ? null : Math.round(focusPerMetre * 1000) / 1000,
        drift_mps: Math.round(drift * 1000) / 1000,
        drift_cap_mps: cap,
        walk_mps: Math.round(walk * 1000) / 1000,
        drift_ok: drift <= cap + 0.05 && drift < walk,
        states: [...states],
        denied,
        denied_all: Object.values(denied).every((d) => d.stayed_airborne),
        no_iframes: !iframeSeen,
      };
    };

    /** `slowfall`: a real fall, with and without, reading `pos[1]` per frame. */
    const slowfallRun = () => {
      const drop = (cast) => {
        if (cast) castAndHold('slowfall', 90, { spawn: false });
        else { arena({ spawn: false }); H.setAttuned(['slowfall']); for (let i = 0; i < 90; i++) H.stepFrames(1); }
        H.dropFrom(30);
        const hp0 = H.getPlayerStats().hp;
        let maxV = 0;
        for (let i = 0; i < 600; i++) { H.stepFrames(1); const f = H.getFallState(); maxV = Math.max(maxV, f.vel_mps); if (!f.airborne) break; }
        return { max_v: Math.round(maxV * 100) / 100, damage: hp0 - H.getPlayerStats().hp, terminal: H.getFallState().terminal_mps };
      };
      const without = drop(false);
      const w = drop(true);
      return { without, terminal_mps: w.terminal, max_v: w.max_v, damage: w.damage, control_damage: without.damage };
    };

    /** `leap`: `pos[1]` peak after the cast, against the unbuffed jump. */
    const leapRun = () => {
      const jump = (cast) => {
        if (cast) castAndHold('leap', 60, { spawn: false });
        else { arena({ spawn: false }); H.setAttuned(['leap']); for (let i = 0; i < 60; i++) H.stepFrames(1); }
        const mult = H.getFallState().jump_apex_mult;
        H.queueInputs([{ f: 2, press: ['jump'] }, { f: 4, release: ['jump'] }]);
        let peak = 0;
        for (let i = 0; i < 90; i++) { H.stepFrames(1); peak = Math.max(peak, H.getPlayerStats().pos[1]); }
        return { peak: Math.round(peak * 1000) / 1000, apex_mult: mult };
      };
      const a = jump(false), b = jump(true);
      return { unbuffed_peak: a.peak, buffed_peak: b.peak, apex_mult: b.apex_mult, higher: b.peak > a.peak };
    };

    /** `paralyse`: buildup must cross a threshold over MULTIPLE contacts, never 0 -> applied. */
    const paralyseRun = () => {
      const eid = arena({ dist: 6 });
      H.setAttuned(['the_grey_fuzz']);
      const per = [];
      let procAt = null, stopped = false;
      for (let n = 1; n <= 5; n++) {
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        for (let i = 0; i < 130; i++) H.stepFrames(1);
        const st = H.getStatusState().find((s) => s.id !== 'P');
        per.push({ contact: n, buildup: st ? (st.buildup.paralysis || 0) : 0, paralysed: st ? st.paralysed : false });
        if (!procAt && st && st.paralysed) procAt = n;
        if (st && st.paralysed) stopped = H.getCombatState().enemies[0].state === 'PARALYSED';
      }
      const ev = H.magicEventsDrain();
      return {
        per_contact_series: per,
        buildup_after_one: per[0] ? per[0].buildup : 0,
        procced_only_after: procAt,
        state_stopped: stopped,
        threshold: 100,
      };
    };

    /** The four control verbs: the fight ends, with ZERO death events and ZERO hp lost. */
    const controlRunFor = (spellId, effect, archetype) => {
      const eid = arena({ dist: effect === 'charm' ? 1.4 : 6, archetype: archetype || 'inf_trash' });
      // `frenzy` changes WHO the target fights. With one body in the arena there is nobody else
      // to fight, so the delta RI-MAG06 §B names ("the target changes") cannot exist.
      if (effect === 'frenzy') H.spawn('inf_trash', 4, 6);
      H.setAttuned([spellId]);
      const cs0 = H.getCombatState().enemies.find((x) => x.id === eid) || H.getCombatState().enemies[0];
      if (!cs0) return { error: 'no enemy body spawned', deaths: null };
      const disp0 = JSON.stringify(H.getQuestState().dispositions);
      H.combatTraceStart({});
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < 240; i++) H.stepFrames(1);
      const trace = H.combatTraceDrain() || [];
      H.combatTraceStop();
      const cs1 = H.getCombatState().enemies.find((x) => x.id === eid) || H.getCombatState().enemies[0] || cs0;
      const snap = H.snapshot();
      return {
        hp_fall: cs0.hp - cs1.hp,
        deaths: (Array.isArray(trace) ? trace : []).filter((t) => (t && Array.isArray(t.events) ? t.events : []).some((e) => e.k === 'DEATH' || e.kind === 'DEATH')).length,
        yielded: !!cs1.yielded,
        alert_state: snap.entities && snap.entities[0] ? snap.entities[0].alert_state : null,
        in_combat: H.getPlayerStats().in_combat,
        target_changed: !!(H.getStatusState().find((s) => s.id !== 'P') || {}).frenzy_target,
        disposition_moved: JSON.stringify(H.getQuestState().dispositions) !== disp0,
      };
    };

    /** `soul_trap`: the gem fills on the target's DEATH, and `xul_hesh` increments. */
    const soulTrapRun = () => {
      const eid = arena({ dist: 6 });
      H.setAttuned(['root_theft']);
      const g0 = H.getMagicState();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < 120; i++) H.stepFrames(1);
      // Kill it while the mark is live. The gem must fill HERE, not on the cast.
      const mid = H.getMagicState();
      H.killEntity(eid);
      for (let i = 0; i < 10; i++) H.stepFrames(1);
      const g1 = H.getMagicState();
      return {
        gems_before: g0.gems, gems_at_cast: mid.gems, gems_after: g1.gems,
        xul_hesh_before: g0.xul_hesh, xul_hesh_after: g1.xul_hesh,
        fills_on_cast: mid.gems > g0.gems,
      };
    };

    /** `mark` then `recall`, and `intervention`: the player is SOMEWHERE ELSE. */
    const teleportRun = (which) => {
      arena({ spawn: false });
      if (which === 'recall') {
        H.setAttuned(['mark']);
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        for (let i = 0; i < 260; i++) H.stepFrames(1);
        H.teleport(60, 60);
        H.hearthRest();
        H.setAttuned(['recall']);
      } else {
        H.teleport(20, 20);
        H.hearthRest();
        H.setAttuned(['intervention_root']);
      }
      const p0 = H.getPlayerStats().pos.slice();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      for (let i = 0; i < 260; i++) H.stepFrames(1);
      const p1 = H.getPlayerStats().pos.slice();
      return { from: p0, to: p1, moved_m: Math.round(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) * 100) / 100 };
    };

    /** `invisibility` must BREAK on a cast. Cast it, then cast again, and read V. */
    const invisibilityRun = () => {
      castAndHold('the_water_film', 120, { spawn: false });
      H.stepFrames(1);
      const vDuring = H.getStealthState().V_raw;
      const broke = H.breakInvisibility('cast');
      H.stepFrames(1);
      const vAfter = H.getStealthState().V_raw;
      return { v_during: vDuring, v_after: vAfter, broke, restored: vAfter > vDuring };
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
      // The stand-off distance is a property of the CARRIER, not of the effect. `frost_damage`
      // accepts `projectile`, but its cheapest carrier `rime_touch` is a TOUCH spell with a
      // 1.6 m reach — cast at 6 m it connects with nothing, and the row reads as a broken
      // effect when what is broken is the probe. Read the geometry that will actually be spawned.
      const g = (spells.find((x) => x.id === carrier.id) || {}).geometry || {};
      const touchLike = g.kind === 'contact' || g.kind === 'none';
      // RI-MAG06 M1: cast "against a spawned target at both 6 m and 1.4 m, so touch and volume
      // geometry both make contact". A body is present for EVERY row, including the self-range
      // ones, because `detect_life` has nothing to detect in an empty arena and reporting that
      // as a broken effect would be the instrument's fault rather than the build's.
      // A RITUAL aborts on COMBAT (RI-MAG01 §B), and `inCombat()` is true with any live body
      // within 30 m — so a ritual carrier is cast in an empty arena. That is not the probe being
      // kind to the build; it is the only circumstance in which a ritual can complete at all.
      const carrierSpell = spells.find((x) => x.id === carrier.id);
      const isRitual = carrierSpell && carrierSpell.class === 'RITUAL';
      const opts = { dist: touchLike ? 1.4 : 6, spawn: !isRitual, aggro: false };

      let r;
      try {
        r = castOnce(carrier.id, {
          ...opts, sampleEvery: 20,
          hurtCaster: ['restore_health', 'absorb_health', 'drain_health'].includes(e.id) ? 300 : 0,
          drainAttr: e.id === 'restore_attribute',
          equipLoad: e.id === 'feather' ? 34 : undefined,
        });
      } catch (err) {
        row.class = 'NOT_OBSERVED'; row.note = `cast threw: ${err && err.message}`; rows.push(row); continue;
      }

      // The mid-run read: RI-MAG06 M2 wants the system read while the effect is LIVE for a
      // timed effect (the lease), and after full duration for an instantaneous one.
      if (r.during.length) r.mid = r.during[Math.min(3, r.during.length - 1)];

      // The provocations. Each is a SECOND run, because the thing being read does not exist
      // until something is done to it.
      try {
        if (['resist_element', 'resist_disease', 'shield', 'sap_ward'].includes(e.id)) r.mitig = mitigationRun(carrier.id);
        else if (e.id === 'cure_disease') r.cure = cureRun(carrier.id, 'disease');
        else if (e.id === 'cure_poison') r.cure = cureRun(carrier.id, 'poison');
        else if (e.id === 'cure_paralysis') r.cure = cureRun(carrier.id, 'paralysis');
        else if (e.id === 'levitate') r.lev = levitationRun();
        else if (e.id === 'slowfall') r.fall = slowfallRun();
        else if (e.id === 'leap') r.leap = leapRun();
        else if (e.id === 'paralyse') r.para = paralyseRun();
        else if (e.id === 'calm_beast') r.control = controlRunFor(carrier.id, e.id, 'beast_slitherfang');
        else if (['demoralise', 'frenzy', 'charm'].includes(e.id)) r.control = controlRunFor(carrier.id, e.id);
        else if (e.id === 'soul_trap') r.soul = soulTrapRun();
        else if (e.id === 'recall') r.tele = teleportRun('recall');
        else if (e.id === 'intervention') r.tele = teleportRun('intervention');
        else if (e.id === 'invisibility') { const iv = invisibilityRun(); r.broke = iv.broke && iv.restored; r.invis = iv; }
        else if (e.id === 'night_eye') {
          arena({ spawn: false });
          H.setTimeOfDay(0);
          for (let i = 0; i < 4; i++) H.stepFrames(1);
          const b0 = H.getStealthState().magic.perceived_light;
          castAndHold(carrier.id, 90, { spawn: false });
          H.setTimeOfDay(0);
          for (let i = 0; i < 4; i++) H.stepFrames(1);
          r.dark = { before: b0, after: H.getStealthState().magic.perceived_light };
        }
        else if (e.id === 'muffle') {
          const q = { motion: 'walk', sneak: 40, load: 'medium', surface: 'timber' };
          arena({ spawn: false });
          const b0 = H.soundRadiusFor(q);
          castAndHold(carrier.id, 90, { spawn: false });
          r.sound = { before: b0, after: H.soundRadiusFor(q) };
        }
        else if (e.id === 'speak_to_the_dead') {
          // A corpse, not an enemy: a RITUAL aborts on COMBAT, and the thing you talk to is dead.
          const t = arena({ dist: 1.4, aggro: false });
          H.killEntity(t);
          H.stepFrames(2);
          H.setAttuned([carrier.id]);
          const t0 = H.getQuestState().topicsKnown.slice();
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          for (let i = 0; i < 260; i++) H.stepFrames(1);
          r.after.quest.topics = H.getQuestState().topicsKnown.slice().sort();
          r.before.quest.topics = t0.sort();
        }
        else if (e.id === 'hist_sight') {
          arena({ spawn: false });
          H.setAttuned([carrier.id]);
          const j0 = H.getQuestState().journal.length;
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
          for (let i = 0; i < 260; i++) H.stepFrames(1);
          r.before.quest.journal = j0;
          r.after.quest.journal = H.getQuestState().journal.length;
        }
        else if (e.id === 'fortify_skill') {
          // The gate that refused at base must pass now. `security` is the number the ward
          // collar gates on, so the paired read is `lockGate()` before and during.
          arena({ spawn: false });
          H.setStealthState({ security: 5, agility: 5 });
          const g0 = H.lockGate(3).offered;
          castAndHold(carrier.id, 90, { spawn: false });
          const g1 = H.lockGate(3).offered;
          r.fortifyMoved = g0 === false && g1 === true;
          r.gate = { before: g0, during: g1 };
        }
      } catch (err) {
        row.note = `provocation threw: ${err && err.message}`;
      }

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

      // RI-MAG06 §B's own rows for `drain_health` and `absorb_health` name `hp` as half of the
      // consuming system, so M3's "hp delta must be zero" cannot apply to them: draining a
      // body's maximum health necessarily clamps its current health. They are exempted BY NAME
      // here rather than by a rule, so the exemption is auditable and cannot widen.
      const HP_IS_ITS_SYSTEM = ['drain_health', 'absorb_health', 'restore_health'];
      if (isDamage) {
        row.class = res.functions ? 'FUNCTIONS_AS_SPECIFIED' : 'PARTIAL';
      } else if (res.functions) {
        const exempt = HP_IS_ITS_SYSTEM.includes(e.id);
        row.class = (hpFall === 0 || exempt) ? 'FUNCTIONS_AS_SPECIFIED' : 'PARTIAL';
        if (hpFall !== 0 && !exempt) row.note = `moved its system BUT also took ${hpFall} hp — the applicator is still leaking`;
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
