#!/usr/bin/env node
// critic-w1-14-r3.mjs — the critic's own instrument for W1-14 round 3 (magic, seam S19).
//
// It exists to attack the round's headline instrument (`tools/harness/w1-14-r3-dials.mjs`) and
// its two fixes, and it deliberately does NOT import a line of it. Seven independent parts, one
// browser, one report.
//
//  A  THE COMPARATOR'S OWN NULL.  The builder's control arm is `--break=nocast`, and every row
//     under it exits at `NOT_DELIVERED` BEFORE `readDial()` is ever called — so it tests the
//     delivery gate and never once exercises the BLIND/COUPLED comparison it is offered as the
//     control for. The real null for a comparator is TWO IDENTICAL ARMS: cast the same spell
//     twice, at the same dial settings, and demand BLIND on every row. Anything that comes back
//     COUPLED there is arena noise the builder's 33/31/10 COUPLED readings are also carrying.
//     A2/A3 are the positive direction: take a dial confirmed live and remove its reader
//     (`__breakBindMagnitude`, `__breakFleeMotion`), and demand the comparator says BLIND.
//
//  B  AREA ON THE GROUND.  `area_r_m` was pinned at 0 for the whole previous history of this
//     piece, so the ten "live" area dials have never been measured against a second radius by
//     anything except the report under test. Bodies at surveyed distances from the volume's own
//     centre; count how many took damage at r=2 and at r=8. A wider spell must hit more bodies.
//
//  C  THE TWO FIXES, both arms.  Summon strength against magnitude; flee distance against
//     magnitude; and the same pair with the reader removed.
//
//  D  DURATION ON A DAMAGE EFFECT.  "Fire Damage 10 pts for 5 s" is 50 damage in Morrowind.
//     Total damage at duration 1 s and at duration 30 s, same magnitude, same arena.
//
//  E  THE FOUR THINGS THE ROUND FOUND AND DID NOT TOUCH.  absorb_health's caster; the summon's
//     side; frenzy's target; bind_greater's focus ceiling.
//
//  F  AR-1.  Determinism across repeated casts, and whether the clock, the weather, disposition
//     or a bounty can reach a damage number.
//
//  G  SPELL-MAKING.  Can the dials be combined into one spell at all, and is there any surface
//     other than the harness that reaches `makeSpell`.
//
// USAGE  node tools/harness/critic-w1-14-r3.mjs [--out <dir>] [--parts=A,B,C,D,E,F,G]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r3.mjs — independent critic instrument for W1-14 r3
  --out <dir>    report dir (default reports/critic-w1-14-r3)
  --parts=A,B,C  restrict to named parts (default all)
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r3');
ensureDir(outDir);
const parts = args.parts ? String(args.parts).split(',').map((s) => s.trim().toUpperCase()) : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async ({ PARTS }) => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    const out = { schema: 'elder-souls/critic-w1-14-r3@1', harness_version: H.version, parts: PARTS, notes: [] };
    const r2 = (v) => Math.round(v * 100) / 100;
    const r3 = (v) => Math.round(v * 1000) / 1000;

    // ------------------------------------------------------------------ the arena
    // Deliberately NOT the builder's arena verbatim; the bodies are placed by this file for the
    // question each part asks, and every part states where they stand.
    const baseArena = (opts = {}) => {
      H.setSeed(opts.seed === undefined ? 4242 : opts.seed);
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
      H.clearProps();
      H.magicEventsDrain();
    };

    const enemies = () => H.getCombatState().enemies;
    const bodyById = (id) => enemies().find((e) => e.id === id) || null;
    const playerHp = () => H.getPlayerStats().hp;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

    /** Cast one commissioned spell and step. Returns the magic event stream and refusals. */
    const castSpell = (spec, name, frames) => {
      const mk = H.makeSpell(spec, name);
      if (mk.refused) return { refused: mk.reason || mk.gate || 'refused', quote: mk.quote || null };
      H.setAttuned([mk.spell.id]);
      H.stepFrames(2);
      H.magicEventsDrain();
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(frames);
      const ev = H.magicEventsDrain();
      return {
        refused: null, spell: mk.spell.id, focus_cost: mk.spell.focus_cost || (mk.quote && mk.quote.focus_cost) || null,
        kinds: [...new Set(ev.map((e) => e.kind))],
        applied: ev.filter((e) => e.kind === 'effect_apply').length,
        events: ev,
      };
    };

    // =================================================================== PART A
    // The comparator's null and its positive direction.
    if (PARTS.includes('A')) {
      const A = { design: 'two arms, identical dial settings, same seed — every ACTIVE row must read BLIND', rows: [] };
      // The snapshot: the same mechanical flatten the builder uses, re-implemented here so the
      // two are not the same code with two names. Deliberately narrower — the registers a spell
      // can move that a critic can name — because a wider snapshot only makes a null EASIER to
      // pass and this part is trying to make it fail.
      const flat = (o, p, acc) => {
        if (o === null || o === undefined) { acc[p] = null; return acc; }
        if (Array.isArray(o)) { acc[p + '.len'] = o.length; acc[p + '.json'] = JSON.stringify(o); return acc; }
        if (typeof o === 'object') { for (const k of Object.keys(o).sort()) flat(o[k], p ? p + '.' + k : k, acc); return acc; }
        acc[p] = o; return acc;
      };
      const snap = () => {
        const a = {};
        const ps = H.getPlayerStats();
        flat({ hp: ps.hp, hp_max: ps.hp_max, pos: ps.pos.map(r3), in_combat: ps.in_combat }, 'player', a);
        a['enemies.json'] = JSON.stringify(enemies().map((e) => ({ id: e.id, hp: r2(e.hp), hp_max: r2(e.hp_max), state: e.state, dead: e.dead, yielded: e.yielded })));
        a['entities.json'] = JSON.stringify(H.listEntities().map((e) => ({ eid: e.eid, hp: e.hp, pos: (e.pos || []).map(r3) })));
        flat(H.getMagicWorld(), 'world', a);
        flat(H.getStatusState(), 'status', a);
        flat(H.getWorldRegisters(), 'sim_world', a);
        flat(H.getQuestState().dispositions, 'disp', a);
        return a;
      };
      const differing = (x, y) => Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).sort();

      // Twelve effects spanning every shape the catalogue has: damage, heal, control, summon,
      // ward, world verb, buff. Enough to make a null meaningful without paying for 55.
      const SET = ['fire_damage', 'damage_health', 'restore_health', 'paralyse', 'calm_beast',
        'demoralise', 'bind_lesser', 'bind_greater', 'shield', 'feather', 'shatter', 'silence'];

      const runArm = (eid, mag, dur, area, range, breakMode) => {
        baseArena();
        H.damagePlayer(220, { stagger: false });
        const e0 = H.spawn('inf_trash', 0, 1.4);
        const e1 = H.spawn('inf_trash', 2.6, 5.2);
        H.aggro(e0); H.aggro(e1); H.lockOn(e0);
        for (const x of enemies()) H.damageEnemy(x.id, 120);
        if (breakMode === 'bindblind' && H.__breakBindMagnitude) H.__breakBindMagnitude();
        if (breakMode === 'fleeblind' && H.__breakFleeMotion) H.__breakFleeMotion();
        const spec = { class: 'LIGHT', range, effects: [{ effect: eid, magnitude: mag, duration_s: dur, area_r_m: area }] };
        const c = castSpell(spec, `critA_${eid}_${mag}_${dur}_${area}_${breakMode || 'none'}`, 240);
        return { cast: c, after: snap() };
      };

      for (const id of SET) {
        const e = D.effects.effects.find((x) => x.id === id);
        // `bind_*` is `self`-only; a probe that asks for `target` is refused before it measures
        // anything. Prefer `target` where the catalogue allows it and fall back to what it does.
        const range = e.ranges.includes('target') ? 'target' : e.ranges[0];
        const mag = e.magnitude.max > 40 ? 40 : e.magnitude.max;
        const dur = e.duration.allowed ? Math.min(20, e.duration.max_s) : 0;
        const area = e.area.allowed ? Math.min(4, e.area.max_r_m) : 0;
        const a1 = runArm(id, mag, dur, area, range, null);
        const a2 = runArm(id, mag, dur, area, range, null);
        const row = { effect: id, range, mag, dur, area,
          delivered: [a1.cast.applied, a2.cast.applied],
          refused: [a1.cast.refused, a2.cast.refused] };
        const diff = differing(a1.after, a2.after);
        row.null_differing = diff;
        row.null_verdict = a1.cast.refused || a2.cast.refused ? 'NOT_CASTABLE'
          : (!a1.cast.applied ? 'NOT_DELIVERED' : (diff.length === 0 ? 'BLIND(clean null)' : 'COUPLED(NOISE)'));
        A.rows.push(row);
      }
      A.null_noise_rows = A.rows.filter((r) => r.null_verdict === 'COUPLED(NOISE)').map((r) => ({ effect: r.effect, paths: r.null_differing }));

      // A2/A3 — the POSITIVE direction. A dial confirmed live, with its reader removed.
      A.positive = [];
      const magPair = (id, lo, hi, range, dur, breakMode) => {
        const a = runArm(id, lo, dur, 0, range, breakMode);
        const b = runArm(id, hi, dur, 0, range, breakMode);
        return { effect: id, break: breakMode || 'none', lo, hi,
          delivered: [a.cast.applied, b.cast.applied],
          differing: differing(a.after, b.after),
          verdict: differing(a.after, b.after).length ? 'COUPLED' : 'BLIND' };
      };
      A.positive.push(magPair('bind_lesser', 1, 90, 'self', 60, null));
      A.positive.push(magPair('bind_lesser', 1, 90, 'self', 60, 'bindblind'));
      A.positive.push(magPair('bind_greater', 1, 45, 'self', 60, null));
      A.positive.push(magPair('bind_greater', 1, 45, 'self', 60, 'bindblind'));
      A.positive.push(magPair('demoralise', 1, 34, 'target', 30, null));
      A.positive.push(magPair('demoralise', 1, 34, 'target', 30, 'fleeblind'));
      A.break_hooks_present = { bindblind: !!H.__breakBindMagnitude, fleeblind: !!H.__breakFleeMotion };
      out.A = A;
    }

    // =================================================================== PART B
    // Area on the ground. `_geometryFor` gives a `volume` of radius max(area,1); `_spawnVolume`
    // puts its centre a flat 9.0 m in front of the caster for a `resolved_world_point`
    // placement. So the survey is taken from THAT point, not from the caster.
    if (PARTS.includes('B')) {
      const B = { design: 'volume centre is 9.0 m in front of the caster (system.js _spawnVolume dist); bodies surveyed from there', runs: [] };
      // Bodies at 0.3, 2.6, 5.0 and 7.4 m from (0, 9) along +z, i.e. planar distance from the
      // burst centre. r=2 (+0.45 slop) should reach one; r=8 should reach all four.
      const OFFS = [0.3, 2.6, 5.0, 7.4];
      const runArea = (effect, radius, magnitude) => {
        baseArena();
        const ids = [];
        for (const o of OFFS) ids.push(H.spawn('inf_trash', 0, 9.0 + o));
        for (const id of ids) H.damageEnemy(id, 100);   // a wound, so restore_health has work
        const before = Object.fromEntries(ids.map((id) => [id, bodyById(id) ? r2(bodyById(id).hp) : null]));
        const c = castSpell({ class: 'LIGHT', range: 'area_at_range',
          effects: [{ effect, magnitude, duration_s: 0, area_r_m: radius }] }, `critB_${effect}_${radius}`, 200);
        const after = Object.fromEntries(ids.map((id) => [id, bodyById(id) ? r2(bodyById(id).hp) : null]));
        const moved = ids.filter((id) => before[id] !== after[id]);
        return { effect, radius_r_m: radius, magnitude, refused: c.refused, applied: c.applied,
          geometry_radius_m: Math.max(radius, 1),
          bodies_at_m: OFFS, hp_before: before, hp_after: after,
          bodies_hit: moved.length, hit_ids: moved };
      };
      for (const rad of [2, 8]) B.runs.push(runArea('fire_damage', rad, 60));
      for (const rad of [2, 8]) B.runs.push(runArea('frost_damage', rad, 60));
      for (const rad of [2, 6]) B.runs.push(runArea('poison_damage', rad, 60));
      // A CONTROL FOR THE CONTROL: same effect, same radius twice. Must hit the same count.
      B.repeat_null = [runArea('fire_damage', 8, 60), runArea('fire_damage', 8, 60)];
      out.B = B;
    }

    // =================================================================== PART C
    // The two fixes, both arms, on the ground.
    if (PARTS.includes('C')) {
      const C = { summon: [], flee: [], calm_reference: null };
      const summonRun = (effect, magnitude, breakMode) => {
        baseArena();
        if (breakMode === 'bindblind' && H.__breakBindMagnitude) H.__breakBindMagnitude();
        const hp0 = playerHp();
        const c = castSpell({ class: 'LIGHT', range: 'self',
          effects: [{ effect, magnitude, duration_s: 60, area_r_m: 0 }] }, `critC_${effect}_${magnitude}_${breakMode || 'none'}`, 30);
        const ent = H.listEntities().filter((e) => e.kind !== 'object' && e.eid !== 'player');
        const w = H.getMagicWorld();
        const sm = w.summons[0] || null;
        const b = sm ? bodyById(sm.eid) : null;
        // 600 f@60 with the player NOT attacking and NOTHING ELSE IN THE ROOM.
        H.stepFrames(600);
        const hp1 = playerHp();
        return { effect, magnitude, break: breakMode || 'none', refused: c.refused, applied: c.applied,
          focus_cost: c.focus_cost,
          summon: sm ? { eid: sm.eid, power: sm.power, hp: sm.hp, attack_rating: sm.attack_rating, archetype: sm.archetype } : null,
          body_hp_max: b ? r2(b.hp_max) : null, body_state_at_cast: b ? b.state : null,
          bodies_in_room: ent.length, body_ids: ent.map((e) => e.eid),
          player_hp_start: r2(hp0), player_hp_end_600f: r2(hp1), player_damage_taken_600f: r2(hp0 - hp1) };
      };
      for (const m of [1, 90]) C.summon.push(summonRun('bind_lesser', m, null));
      for (const m of [1, 90]) C.summon.push(summonRun('bind_lesser', m, 'bindblind'));
      for (const m of [1, 45]) C.summon.push(summonRun('bind_greater', m, null));
      for (const m of [1, 45]) C.summon.push(summonRun('bind_greater', m, 'bindblind'));

      const fleeRun = (effect, magnitude, breakMode) => {
        baseArena();
        if (breakMode === 'fleeblind' && H.__breakFleeMotion) H.__breakFleeMotion();
        const e0 = H.spawn('inf_trash', 0, 4.0);
        H.aggro(e0); H.lockOn(e0);
        H.stepFrames(30);
        // `getCombatState().enemies[].dist_m` is the engine's own planar distance from the
        // player (engine.js `c.distTo(b)`) — the same number the leash and the aggro radius use.
        // The rows there carry no `pos`, which is why this reads dist_m rather than recomputing.
        const caster0 = H.getPlayerStats().pos.slice();
        const b0 = bodyById(e0);
        const d0 = b0 ? b0.dist_m : null;
        const c = castSpell({ class: 'LIGHT', range: 'target',
          effects: [{ effect, magnitude, duration_s: 30, area_r_m: 0 }] }, `critC_${effect}_${magnitude}_${breakMode || 'none'}`, 900);
        const b1 = bodyById(e0);
        const caster1 = H.getPlayerStats().pos.slice();
        const ent1 = H.listEntities().find((x) => x.eid === e0) || null;
        const fe = c.events ? c.events.filter((e) => e.kind === 'fight_ended') : [];
        return { effect, magnitude, break: breakMode || 'none', refused: c.refused, applied: c.applied,
          declared_leash_m: fe.length ? fe[0].flee_leash_m : null,
          declared_speed_mps: fe.length ? fe[0].flee_speed_mps : null,
          dist_at_cast_m: d0 === null ? null : r2(d0),
          dist_after_900f_m: b1 ? r2(b1.dist_m) : null,
          dist_from_entity_list_m: ent1 && ent1.pos ? r2(dist(ent1.pos, caster1)) : null,
          target_pos: ent1 && ent1.pos ? ent1.pos.map(r2) : null, caster_pos: caster1.map(r2),
          yielded: b1 ? b1.yielded : null, dead: b1 ? b1.dead : null };
      };
      for (const m of [1, 34]) C.flee.push(fleeRun('demoralise', m, null));
      for (const m of [1, 34]) C.flee.push(fleeRun('demoralise', m, 'fleeblind'));
      // WHY 4.04 m: the number the pre-fix demoralise and calm_beast both land on. Measure
      // calm_beast in the SAME arena so the coincidence can be explained rather than noted.
      C.calm_reference = [fleeRun('calm_beast', 1, null), fleeRun('calm_beast', 90, null)];
      out.C = C;
    }

    // =================================================================== PART D
    // Duration on a damage effect. Morrowind: "N pts for M s" is N per second for M seconds.
    if (PARTS.includes('D')) {
      const Dp = { design: 'same magnitude, same target, duration 1 s vs the effect maximum; total damage compared', rows: [] };
      const durRun = (effect, magnitude, dur, frames) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, 3.0);
        H.aggro(e0);
        H.lockOn(e0);
        H.stepFrames(20);
        const b0 = bodyById(e0);
        const hp0 = b0 ? r2(b0.hp) : null;
        const c = castSpell({ class: 'LIGHT', range: 'target',
          effects: [{ effect, magnitude, duration_s: dur, area_r_m: 0 }] }, `critD_${effect}_${dur}`, frames);
        const b1 = bodyById(e0);
        const hp1 = b1 ? r2(b1.hp) : null;
        return { effect, magnitude, duration_s: dur, frames, refused: c.refused, applied: c.applied,
          hp_before: hp0, hp_after: hp1, damage_total: hp0 !== null && hp1 !== null ? r2(hp0 - hp1) : null,
          morrowind_expected_if_per_second: r2(magnitude * (D.effects.effects.find((x) => x.id === effect).magnitude.output_per_point || 1) * dur) };
      };
      for (const e of ['fire_damage', 'frost_damage', 'poison_damage']) {
        Dp.rows.push(durRun(e, 20, 1, 2100));
        Dp.rows.push(durRun(e, 20, 30, 2100));
      }
      Dp.rows.push(durRun('restore_health', 20, 1, 2100));
      Dp.rows.push(durRun('restore_health', 20, 30, 2100));
      out.D = Dp;
    }

    // =================================================================== PART E
    if (PARTS.includes('E')) {
      const E = {};
      // E1 — absorb_health. Does the CASTER gain what the target loses?
      // A `touch` spell's contact volume is 0.30 m of radius at 1.6 m of reach, plus the 0.45 m
      // slop `MagicSystem.step` allows — so the target has to stand inside ~2.0 m or the arm
      // measures the reach and not the handler. 1.2 m, un-aggroed so it does not walk out of it.
      const absorbRun = (effect, magnitude) => {
        baseArena();
        H.damagePlayer(220, { stagger: false });
        const e0 = H.spawn('inf_trash', 0, 1.2);
        H.lockOn(e0);
        H.stepFrames(20);
        const php0 = r2(playerHp());
        const b0 = bodyById(e0); const ehp0 = b0 ? r2(b0.hp) : null;
        const c = castSpell({ class: 'LIGHT', range: 'touch',
          effects: [{ effect, magnitude, duration_s: 0, area_r_m: 0 }] }, `critE_${effect}_${magnitude}`, 120);
        const b1 = bodyById(e0);
        return { effect, magnitude, refused: c.refused, applied: c.applied,
          player_hp: [php0, r2(playerHp())], player_delta: r2(playerHp() - php0),
          enemy_hp: [ehp0, b1 ? r2(b1.hp) : null], enemy_delta: b1 && ehp0 !== null ? r2(b1.hp - ehp0) : null };
      };
      E.absorb = [absorbRun('absorb_health', 60), absorbRun('damage_health', 60), absorbRun('drain_health', 60)];

      // E2 — the summon's side. `engine.spawn` takes `{side:'ally'}` and `_classifyOnSpawn`
      // decides; `CombatSystem.spawnEnemy` is what actually makes the body. Read the body's own
      // team fields, and then let the summon and the caster stand in an empty room.
      baseArena();
      const c2 = castSpell({ class: 'LIGHT', range: 'self',
        effects: [{ effect: 'bind_lesser', magnitude: 40, duration_s: 60, area_r_m: 0 }] }, 'critE_side', 30);
      const w2 = H.getMagicWorld();
      const sid = w2.summons[0] ? w2.summons[0].eid : null;
      const sb = sid ? bodyById(sid) : null;
      const ent2 = H.listEntities().filter((e) => e.kind !== 'object');
      const hpA = r2(playerHp());
      H.stepFrames(900);
      const hpB = r2(playerHp());
      E.summon_side = {
        refused: c2.refused, summon_eid: sid,
        entity_record: ent2.map((e) => ({ eid: e.eid, kind: e.kind, side: e.side === undefined ? '(absent)' : e.side, faction: e.faction === undefined ? '(absent)' : e.faction, summoned: e.summoned === undefined ? '(absent)' : e.summoned })),
        body_fields: sb ? Object.fromEntries(Object.entries(sb).filter(([k]) => /side|team|faction|ally|hostile|summon/i.test(k))) : null,
        bodies_in_room: ent2.length,
        player_hp_before_900f: hpA, player_hp_after_900f: hpB, player_damage_from_own_summon: r2(hpA - hpB),
        summon_state: sid && bodyById(sid) ? bodyById(sid).state : null,
      };

      // E3 — frenzy. Two bodies. Does the frenzied one damage the other?
      baseArena();
      const f0 = H.spawn('inf_trash', 0, 1.2);
      const f1 = H.spawn('inf_trash', 1.1, 1.9);
      H.lockOn(f0);
      H.stepFrames(20);
      const fhp = { [f0]: r2(bodyById(f0).hp), [f1]: r2(bodyById(f1).hp) };
      const c3 = castSpell({ class: 'LIGHT', range: 'touch',
        effects: [{ effect: 'frenzy', magnitude: 34, duration_s: 60, area_r_m: 0 }] }, 'critE_frenzy', 30);
      const st3 = H.getStatusState();
      H.stepFrames(1200);
      E.frenzy = {
        refused: c3.refused, applied: c3.applied,
        frenzy_target_declared: (st3.bodies || st3 || []).length ? JSON.stringify(st3).match(/"frenzy_target":"[^"]*"/g) : null,
        hp_before: fhp,
        hp_after: { [f0]: bodyById(f0) ? r2(bodyById(f0).hp) : null, [f1]: bodyById(f1) ? r2(bodyById(f1).hp) : null },
        other_body_damaged: bodyById(f1) ? r2(fhp[f1] - bodyById(f1).hp) : null,
        frenzied_body_damaged: bodyById(f0) ? r2(fhp[f0] - bodyById(f0).hp) : null,
      };

      // E4 — bind_greater's ceiling. Where does the dial stop being castable?
      baseArena();
      const fmax = H.getMagicState().focus_max;
      const ladder = [];
      for (const m of [1, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90]) {
        const q = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_greater', magnitude: m, duration_s: 60, area_r_m: 0 }] });
        ladder.push({ magnitude: m, refused: !!q.refused, reason: q.reason || null, focus_base: q.focus_base, focus_cost: q.focus_cost, tier: q.tier, skill_req: q.skill_req, affordable: !q.refused && q.focus_cost <= fmax });
      }
      // and the same for the CHEAPEST class the game has, to see if any carrier reaches the top.
      const cheap = [];
      for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY', 'GREAT', 'RITUAL']) {
        const q = H.quoteSpell({ class: cls, range: 'self', effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 60, area_r_m: 0 }] });
        cheap.push({ class: cls, refused: !!q.refused, focus_cost: q.focus_cost, affordable: !q.refused && q.focus_cost <= fmax });
      }
      // and at the SHORTEST legal duration, which is the other lever a player has.
      const shortDur = [];
      for (const d of [1, 5, 10, 60]) {
        const q = H.quoteSpell({ class: 'CANTRIP', range: 'self', effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: d, area_r_m: 0 }] });
        shortDur.push({ duration_s: d, class: 'CANTRIP', refused: !!q.refused, focus_cost: q.focus_cost, affordable: !q.refused && q.focus_cost <= fmax });
      }
      E.bind_greater_ceiling = { focus_max: fmax, ladder, by_class_at_mag90: cheap, cantrip_by_duration_at_mag90: shortDur };
      // What actually happens at the unaffordable setting — a refusal, or silence?
      baseArena();
      const c4 = castSpell({ class: 'LIGHT', range: 'self',
        effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 60, area_r_m: 0 }] }, 'critE_over', 120);
      E.bind_greater_over_reservoir = { refused: c4.refused, kinds: c4.kinds || null, applied: c4.applied === undefined ? null : c4.applied, focus_max: fmax };
      out.E = E;
    }

    // =================================================================== PART F  (AR-1)
    if (PARTS.includes('F')) {
      const F = {};
      const damageRun = (mut) => {
        baseArena();
        if (mut) mut();
        const e0 = H.spawn('inf_trash', 0, 3.0);
        H.aggro(e0); H.lockOn(e0);
        H.stepFrames(20);
        const hp0 = r2(bodyById(e0).hp);
        const before = H.getDeterminismReport();
        const c = castSpell({ class: 'LIGHT', range: 'target',
          effects: [{ effect: 'fire_damage', magnitude: 40, duration_s: 0, area_r_m: 0 }] }, `critF_${Math.random()}`, 240);
        const after = H.getDeterminismReport();
        const b1 = bodyById(e0);
        const cs = H.getCombatState();
        return { damage: b1 ? r2(hp0 - b1.hp) : null, applied: c.applied, refused: c.refused,
          det_violations: after.violations === undefined ? (after.violation_count || 0) : (Array.isArray(after.violations) ? after.violations.length : after.violations),
          rng_draws_delta: (after.rng && before.rng) ? after.rng.draws - before.rng.draws : null,
          frames: c.events ? (c.events.find((e) => e.kind === 'cast_start') || {}) : null,
          player_state: cs.player ? cs.player.state : null };
      };
      // 8 identical casts.
      F.identical = [];
      for (let i = 0; i < 8; i++) F.identical.push(damageRun(null));
      F.identical_damage_set = [...new Set(F.identical.map((x) => x.damage))];
      // Morrowind quantities that must NOT reach a damage number.
      F.perturbations = [
        { name: 'baseline', ...damageRun(null) },
        { name: 'time_of_day_0', ...damageRun(() => H.setTimeOfDay(0)) },
        { name: 'time_of_day_13', ...damageRun(() => H.setTimeOfDay(13)) },
        { name: 'wall_clock_+8h', ...damageRun(() => H.advanceWallClock(8 * 3600 * 1000)) },
        { name: 'disposition_100', ...damageRun(() => { try { H.setDisposition('e0', 100); } catch (e) { /* no such npc in arena */ } }) },
        { name: 'bounty_5000', ...damageRun(() => { try { H.setBounty(5000); } catch (e) { /* */ } }) },
        { name: 'weather_storm', ...damageRun(() => { try { H.setWeather('storm'); } catch (e) { /* */ } }) },
        { name: 'seed_9', ...damageRun(() => H.setSeed(9)) },
      ];
      F.perturbation_damage_set = [...new Set(F.perturbations.map((p) => p.damage))];
      out.F = F;
    }

    // =================================================================== PART G  (spell-making)
    if (PARTS.includes('G')) {
      const G = {};
      baseArena();
      // Can a player build a spell out of all three dials at once, plus range and class?
      const spec = { class: 'HEAVY', range: 'area_at_range', effects: [
        { effect: 'fire_damage', magnitude: 25, duration_s: 6, area_r_m: 5 },
        { effect: 'demoralise', magnitude: 20, duration_s: 10, area_r_m: 5 },
      ] };
      const q = H.quoteSpell(spec);
      G.multi_effect_quote = { refused: !!q.refused, reason: q.reason || null, focus_base: q.focus_base, focus_cost: q.focus_cost, tier: q.tier, gold: q.gold, effects: q.effects };
      const mk = H.makeSpell(spec, 'A critic\'s own spell');
      G.multi_effect_made = { refused: !!mk.refused, id: mk.spell ? mk.spell.id : null, geometry: mk.spell ? mk.spell.geometry : null };
      // The clamp/force behaviour enchanting.json declares.
      const over = H.quoteSpell({ class: 'LIGHT', range: 'target', effects: [{ effect: 'damage_health', magnitude: 999, duration_s: 40, area_r_m: 9 }] });
      G.clamping = { refused: !!over.refused, effects: over.effects };
      // Is there any surface other than the harness? The menus the player can open, and whether
      // any of them is a spell-making screen.
      G.menus = H.listMenus();
      G.ui_modes = (() => { try { return H.getUIState().modes || null; } catch (e) { return null; } })();
      G.custom_spells_in_save = (() => {
        const s = H.saveState();
        const blob = JSON.stringify(s);
        return { has_custom_spells_key: /custom_spells/.test(blob), count: (s.magic && s.magic.custom_spells) ? s.magic.custom_spells.length : null };
      })();
      out.G = G;
    }

    // =================================================================== PART H
    // Three things part E turned up that neither the builder nor the round-2 critic looked at.
    if (PARTS.includes('H')) {
      const Hp = {};
      // H1 — RANGE MULTIPLIES THE EFFECT. `_spawnContact` gives a touch spell
      // `ticksEveryF: 1` over the class's whole `active` window, and the volume loop applies the
      // effect on every tick with no per-target dedupe. So the SAME spell delivers its magnitude
      // once as a projectile and `active` times as a touch. Measured, not read.
      const rangeRun = (effect, magnitude, range, cls) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, range === 'touch' ? 1.2 : 4.0);
        H.lockOn(e0);
        H.stepFrames(20);
        const hp0 = r2(bodyById(e0).hp);
        const c = castSpell({ class: cls, range, effects: [{ effect, magnitude, duration_s: 0, area_r_m: 0 }] },
          `critH_${effect}_${range}_${cls}`, 240);
        const b1 = bodyById(e0);
        return { effect, magnitude, range, class: cls, refused: c.refused, applied: c.applied,
          class_active_f: (D.cast_classes && D.cast_classes.classes && D.cast_classes.classes[cls]) ? D.cast_classes.classes[cls].active : null,
          hp_before: hp0, hp_after: b1 ? r2(b1.hp) : null,
          damage: b1 ? r2(hp0 - b1.hp) : null, dead: b1 ? b1.dead : null,
          declared_output: r2(magnitude * (D.effects.effects.find((x) => x.id === effect).magnitude.output_per_point || 1)) };
      };
      Hp.range_multiplier = [];
      for (const cls of ['CANTRIP', 'LIGHT', 'HEAVY']) {
        for (const rng of ['touch', 'target', 'projectile']) Hp.range_multiplier.push(rangeRun('damage_health', 20, rng, cls));
      }

      // H2 — WHOSE SIDE IS THE SUMMON ON? A hostile body, a summon, and 1200 f@60 in which
      // somebody must hit somebody. Three arms: no summon (control), summon left alone, summon
      // aggroed the way the builder's own consumption arm aggroes it.
      const allegiance = (mode) => {
        baseArena();
        // 2.4 m, not 8 m: an inf_trash spawned 8 m out RUSHes, hits RI-AI01's leash and returns
        // to its anchor without ever reaching anybody, and all three arms read a flat zero.
        const foe = H.spawn('inf_trash', 0, 2.4);
        let sid = null;
        if (mode !== 'control') {
          const c = castSpell({ class: 'LIGHT', range: 'self',
            effects: [{ effect: 'bind_lesser', magnitude: 60, duration_s: 90, area_r_m: 0 }] }, `critH_alleg_${mode}`, 40);
          const w = H.getMagicWorld();
          sid = w.summons[0] ? w.summons[0].eid : null;
          if (mode === 'aggroed' && sid) H.aggro(sid);
          if (c.refused) return { mode, refused: c.refused };
        }
        H.aggro(foe);
        const foe0 = bodyById(foe) ? r2(bodyById(foe).hp) : null;
        const sum0 = sid && bodyById(sid) ? r2(bodyById(sid).hp) : null;
        const php0 = r2(playerHp());
        H.stepFrames(1200);
        const fb = bodyById(foe); const sb = sid ? bodyById(sid) : null;
        return { mode, summon_eid: sid,
          foe_hp: [foe0, fb ? r2(fb.hp) : null], foe_damage_taken: fb ? r2(foe0 - fb.hp) : null,
          summon_hp: [sum0, sb ? r2(sb.hp) : null], summon_damage_taken: sb && sum0 !== null ? r2(sum0 - sb.hp) : null,
          player_hp: [php0, r2(playerHp())], player_damage_taken: r2(php0 - playerHp()),
          foe_state: fb ? fb.state : null, summon_state: sb ? sb.state : null };
      };
      Hp.allegiance = [allegiance('control'), allegiance('left_alone'), allegiance('aggroed')];

      // H3 — THE FOCUS CEILING. Is `focus_max` really 124 at quote time and 88 at the gate?
      baseArena();
      const f0 = H.getMagicState();
      H.stepFrames(120);
      const f1 = H.getMagicState();
      const q90 = H.quoteSpell({ class: 'LIGHT', range: 'self', effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 60, area_r_m: 0 }] });
      const c90 = castSpell({ class: 'LIGHT', range: 'self',
        effects: [{ effect: 'bind_greater', magnitude: 90, duration_s: 60, area_r_m: 0 }] }, 'critH_over', 200);
      const f2 = H.getMagicState();
      const inputs = (() => { try { return H.getInputState(); } catch (e) { return null; } })();
      Hp.focus_ceiling = {
        focus_max_fresh: f0.focus_max, focus_at_fresh: f0.focus,
        focus_max_after_120f: f1.focus_max, focus_after_120f: f1.focus,
        quote_focus_cost: q90.focus_cost, quote_refused: !!q90.refused,
        cast_event_kinds: c90.kinds, cast_applied: c90.applied,
        focus_max_after_cast: f2.focus_max, focus_after_cast: f2.focus,
        input_drop_reason: inputs && inputs.last_drop ? inputs.last_drop : null,
        summons_after: H.getMagicWorld().summons.length,
      };
      // And the highest magnitude that actually PUTS A BODY DOWN, which is the number that
      // matters for "a scaling law you cannot cast".
      Hp.highest_castable = [];
      for (const m of [40, 50, 60, 65, 70, 72, 74, 76, 78, 80, 90]) {
        baseArena();
        const c = castSpell({ class: 'LIGHT', range: 'self',
          effects: [{ effect: 'bind_greater', magnitude: m, duration_s: 60, area_r_m: 0 }] }, `critH_cast_${m}`, 200);
        const w = H.getMagicWorld();
        Hp.highest_castable.push({ magnitude: m, kinds: c.kinds, applied: c.applied,
          summoned: w.summons.length, power: w.summons[0] ? w.summons[0].power : null,
          hp: w.summons[0] ? w.summons[0].hp : null,
          focus_max_at_gate: H.getMagicState().focus_max });
      }
      out.H = Hp;
    }

    // =================================================================== PART I
    // Three re-measurements, each because part D/H's first arena answered the wrong question.
    if (PARTS.includes('I')) {
      const I = {};
      // I1 — DURATION, re-measured in the arena that demonstrably delivers. Part D aggroed the
      // target and lock-on steered the bolt into a body that was walking; every row came back
      // `applied 1, damage 0`. This is H1's arena — un-aggroed body at 4.0 m, `target` range,
      // one application — with duration as the ONLY thing that varies.
      const durRun2 = (effect, magnitude, dur) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, 4.0);
        H.lockOn(e0);
        H.stepFrames(20);
        const hp0 = r2(bodyById(e0).hp);
        const c = castSpell({ class: 'LIGHT', range: 'target',
          effects: [{ effect, magnitude, duration_s: dur, area_r_m: 0 }] }, `critI_${effect}_${dur}`, 2100);
        const b1 = bodyById(e0);
        const st = H.getMagicState();
        const eff = D.effects.effects.find((x) => x.id === effect);
        return { effect, magnitude, duration_s: dur, applied: c.applied, refused: c.refused,
          hp_before: hp0, hp_after: b1 ? r2(b1.hp) : null,
          total_damage: b1 ? r2(hp0 - b1.hp) : null,
          lease_rows_left: st.effects_active ? st.effects_active.length : null,
          morrowind_per_second_total: r2(magnitude * (eff.magnitude.output_per_point || 1) * Math.max(dur, 1)) };
      };
      I.duration = [];
      for (const e of ['fire_damage', 'frost_damage', 'poison_damage']) {
        for (const d of [0, 1, 5, 30]) I.duration.push(durRun2(e, 20, d));
      }

      // I2 — ALLEGIANCE, at the distance where this arena demonstrably produces a fight. At
      // 2.4 m the foe RUSHed, hit RI-AI01's leash and returned to its anchor without ever
      // swinging; at 1.2 m part E's enemy took the player from 80 hp to 1.88 in 120 f@60.
      const alleg2 = (mode) => {
        baseArena();
        let sid = null;
        if (mode !== 'control') {
          const c = castSpell({ class: 'LIGHT', range: 'self',
            effects: [{ effect: 'bind_lesser', magnitude: 60, duration_s: 90, area_r_m: 0 }] }, `critI_alleg_${mode}`, 40);
          if (c.refused) return { mode, refused: c.refused };
          const w = H.getMagicWorld();
          sid = w.summons[0] ? w.summons[0].eid : null;
        }
        const foe = H.spawn('inf_trash', 0, 1.2);
        H.aggro(foe);
        if (mode === 'aggroed' && sid) H.aggro(sid);
        const foe0 = bodyById(foe) ? r2(bodyById(foe).hp) : null;
        const sum0 = sid && bodyById(sid) ? r2(bodyById(sid).hp) : null;
        const php0 = r2(playerHp());
        H.stepFrames(1200);
        const fb = bodyById(foe); const sb = sid ? bodyById(sid) : null;
        return { mode, summon_eid: sid,
          foe_hp: [foe0, fb ? r2(fb.hp) : null], foe_damage_taken: fb && foe0 !== null ? r2(foe0 - fb.hp) : null,
          summon_hp: [sum0, sb ? r2(sb.hp) : null], summon_damage_taken: sb && sum0 !== null ? r2(sum0 - sb.hp) : null,
          player_hp: [php0, r2(playerHp())], player_damage_taken: r2(php0 - playerHp()),
          foe_state: fb ? fb.state : null, summon_state: sb ? sb.state : null,
          foe_dist_m: fb ? r2(fb.dist_m) : null, summon_dist_m: sb ? r2(sb.dist_m) : null };
      };
      I.allegiance = [alleg2('control'), alleg2('left_alone'), alleg2('aggroed')];

      // I3 — WHERE DOES THE PLAYER GO WHEN A CAST IS SILENTLY DROPPED? Part C measured a
      // `calm_beast` at magnitude 90 that delivered nothing (applied 0) and left the caster
      // 3784 m from the origin after 900 f@60. Either the drop leaves the input somewhere it
      // should not be, or that was an artefact; sample the position rather than guess.
      const driftRun = (label, spec) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, 4.0);
        H.aggro(e0); H.lockOn(e0);
        H.stepFrames(30);
        const mk = H.makeSpell(spec, `critI_drift_${label}`);
        const made = !mk.refused;
        if (made) { H.setAttuned([mk.spell.id]); H.stepFrames(2); }
        H.magicEventsDrain();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const series = [];
        for (let i = 0; i < 9; i++) { H.stepFrames(100); const ps = H.getPlayerStats(); series.push({ f: (i + 1) * 100, pos: ps.pos.map(r2), state: H.getCombatState().player.state }); }
        const ev = H.magicEventsDrain();
        return { label, made, refused: mk.refused ? (mk.reason || mk.gate) : null,
          quote_focus_cost: mk.spell ? mk.spell.focus_cost : (mk.quote ? mk.quote.focus_cost : null),
          focus_max: H.getMagicState().focus_max,
          event_kinds: [...new Set(ev.map((x) => x.kind))],
          applied: ev.filter((x) => x.kind === 'effect_apply').length,
          pos_series: series };
      };
      I.drift = [
        driftRun('calm_beast_mag90_dur30', { class: 'LIGHT', range: 'target', effects: [{ effect: 'calm_beast', magnitude: 90, duration_s: 30, area_r_m: 0 }] }),
        driftRun('calm_beast_mag1_dur30', { class: 'LIGHT', range: 'target', effects: [{ effect: 'calm_beast', magnitude: 1, duration_s: 30, area_r_m: 0 }] }),
        driftRun('no_spell_attuned', { class: 'LIGHT', range: 'target', effects: [{ effect: 'bind_lesser', magnitude: 1, duration_s: 1, area_r_m: 0 }] }),
      ];
      out.I = I;
    }

    // =================================================================== PART J
    // Two decisive questions the earlier parts raised and could not settle.
    if (PARTS.includes('J')) {
      const J = {};
      // J1 — WHY DOES A FIRE BOLT DO NOTHING? Part H measured damage_health at `target` range
      // doing 44 to a stationary body; part I measured fire/frost/poison at the SAME range, the
      // SAME arena and the SAME class doing 0, with `effect_apply` firing in every row. The
      // bridge's damage branch is skipped when `target` is null, and `Math.max(1, ...)` means a
      // fully-warded hit would still take 1 hp — so a flat 0 says the body was never the target.
      // Read the spell_hit event itself rather than inferring from hp.
      const boltRun = (effect, magnitude, range) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, 4.0);
        H.lockOn(e0);
        H.stepFrames(20);
        const hp0 = r2(bodyById(e0).hp);
        const c = castSpell({ class: 'LIGHT', range, effects: [{ effect, magnitude, duration_s: 0, area_r_m: range === 'area_at_range' ? 6 : 0 }] },
          `critJ_${effect}_${range}`, 300);
        const hits = (c.events || []).filter((x) => x.kind === 'spell_hit')
          .map((x) => ({ target: x.target, dmg: x.dmg, kind: x.kind_of || x.contact_kind || null, damage_by_kind: x.damage_by_kind, hit_world_object: x.hit_world_object, damage_effects: x.damage_effects }));
        const applies = (c.events || []).filter((x) => x.kind === 'effect_apply')
          .map((x) => ({ effect: x.effect, target: x.target, magnitude: x.magnitude, changed: x.changed, consumer: x.consumer, is_damage_effect: x.is_damage_effect }));
        const b1 = bodyById(e0);
        return { effect, magnitude, range, kinds: c.kinds, hp: [hp0, b1 ? r2(b1.hp) : null], damage: b1 ? r2(hp0 - b1.hp) : null,
          spell_hits: hits, applies };
      };
      J.bolts = [];
      for (const e of ['damage_health', 'fire_damage', 'frost_damage', 'poison_damage', 'shock_damage']) {
        J.bolts.push(boltRun(e, 20, 'target'));
      }
      J.bolts.push(boltRun('fire_damage', 20, 'area_at_range'));
      J.bolts.push(boltRun('fire_damage', 20, 'touch'));

      // J2 — DOES THE SUMMON FIX MUTATE THE ARCHETYPE? `combat/enemy.js` buildEnemyMoves sets
      // `out._weapon = weapon` — the statblock's OWN object, not a copy (the copy in
      // `combat/moves.js` is the PLAYER's roster path). `bindHandler` writes
      // `body.moves._weapon.attack_rating *= power` in place. If that is the shared object, the
      // scaling is cumulative and permanent for every body of that archetype in the session,
      // summoned or not. Five identical casts, then an ORDINARY spawn of the same archetype.
      const mutRun = (effect, archetype, magnitude, n) => {
        baseArena();
        const series = [];
        for (let i = 0; i < n; i++) {
          const c = castSpell({ class: 'LIGHT', range: 'self',
            effects: [{ effect, magnitude, duration_s: 90, area_r_m: 0 }] }, `critJ_mut_${effect}_${i}`, 40);
          const w = H.getMagicWorld();
          const s = w.summons[w.summons.length - 1] || null;
          series.push({ cast: i + 1, refused: c.refused, power: s ? s.power : null, hp: s ? s.hp : null, attack_rating: s ? s.attack_rating : null });
        }
        // An ORDINARY body of the same archetype, spawned by the engine with no magic involved.
        const plain = H.spawn(archetype, 6, 6);
        const pb = bodyById(plain);
        return { effect, archetype, magnitude, casts: series,
          plain_spawn_attack_rating: pb && pb.attack_rating !== undefined ? pb.attack_rating : null,
          plain_spawn_hp_max: pb ? r2(pb.hp_max) : null,
          statblock_attack_rating: (D.enemies && D.enemies[archetype] && D.enemies[archetype].weapon) ? D.enemies[archetype].weapon.attack_rating : null };
      };
      J.archetype_mutation = [
        mutRun('bind_lesser', 'drowned_lesser', 1, 5),
        mutRun('bind_lesser', 'drowned_lesser', 90, 5),
      ];
      // And the same question read straight off the engine's own data object, which is the only
      // place a permanent mutation would be visible after the bodies are gone.
      J.engine_statblock_after = (() => {
        try {
          const d = H.getMagicData();
          return { note: 'read via a fresh spawn above; engine.data.enemies is not on the harness surface', magic_data_keys: Object.keys(d) };
        } catch (e) { return { error: String(e && e.message) }; }
      })();
      out.J = J;
    }

    // =================================================================== PART K
    // Part I's duration rows all read `applied 1, damage 0` and part J proved the same bolts do
    // 27-44 damage over a 300-frame window. The difference is the window: I gave the body
    // 2100 f@60 to stand there, and an out-of-combat body regenerates. So the duration question
    // has to be asked inside a window short enough that regeneration cannot answer it, with the
    // hp curve reported rather than just its endpoints — a per-second tick would be VISIBLE as a
    // staircase and an instantaneous hit is one step.
    if (PARTS.includes('K')) {
      const K = {};
      const durSeries = (effect, magnitude, dur) => {
        baseArena();
        const e0 = H.spawn('inf_trash', 0, 4.0);
        H.lockOn(e0);
        H.stepFrames(20);
        const hp0 = r2(bodyById(e0).hp);
        const mk = H.makeSpell({ class: 'LIGHT', range: 'target',
          effects: [{ effect, magnitude, duration_s: dur, area_r_m: 0 }] }, `critK_${effect}_${dur}`);
        if (mk.refused) return { effect, duration_s: dur, refused: mk.reason || mk.gate };
        H.setAttuned([mk.spell.id]);
        H.stepFrames(2); H.magicEventsDrain();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        const series = [];
        for (let i = 0; i < 30; i++) { H.stepFrames(20); const b = bodyById(e0); series.push(b ? r2(b.hp) : null); }
        const ev = H.magicEventsDrain();
        const b1 = bodyById(e0);
        const st = H.getMagicState();
        return { effect, magnitude, duration_s: dur, refused: null,
          hp_start: hp0, hp_series_every_20f: series, hp_min: Math.min(...series.filter((v) => v !== null)),
          damage_at_trough: r2(hp0 - Math.min(...series.filter((v) => v !== null))),
          hp_at_600f: b1 ? r2(b1.hp) : null,
          applies: ev.filter((x) => x.kind === 'effect_apply').length,
          lease_rows: st.effects_active ? st.effects_active.map((a) => ({ effect: a.effect, remaining_f: a.remaining_f, consumer_leased: a.consumer_leased })) : null };
      };
      K.duration = [];
      for (const d of [0, 5, 30]) K.duration.push(durSeries('fire_damage', 20, d));
      K.duration.push(durSeries('restore_health', 20, 0));
      K.duration.push(durSeries('restore_health', 20, 30));

      // K2 — IDENTICAL CASTS, the check the builder's AR-1 arm made on hp_max only. Focus is
      // topped up between casts so no cast can be refused, and `exclusive` is respected by
      // reading the newest summon record by eid rather than by array position.
      baseArena();
      const mk2 = H.makeSpell({ class: 'LIGHT', range: 'self',
        effects: [{ effect: 'bind_lesser', magnitude: 40, duration_s: 90, area_r_m: 0 }] }, 'critK_identical');
      H.setAttuned([mk2.spell.id]);
      const seen = new Set();
      const casts = [];
      for (let i = 0; i < 6; i++) {
        H.hearthRest();
        H.stepFrames(2); H.magicEventsDrain();
        H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        H.stepFrames(90);
        const w = H.getMagicWorld();
        const fresh = w.summons.filter((x) => !seen.has(x.eid));
        for (const f of fresh) seen.add(f.eid);
        const s = fresh[fresh.length - 1] || null;
        casts.push({ cast: i + 1, eid: s ? s.eid : null, power: s ? s.power : null, hp: s ? s.hp : null, attack_rating: s ? s.attack_rating : null });
      }
      K.identical_casts = { spell: mk2.spell ? mk2.spell.id : null, casts,
        distinct_hp: [...new Set(casts.map((c) => c.hp))],
        distinct_attack_rating: [...new Set(casts.map((c) => c.attack_rating))] };
      out.K = K;
    }

    return out;
  }, { PARTS: parts });
} finally {
  await handle.close();
}

const p = path.join(outDir, 'critic-w1-14-r3.json');
writeJson(p, report);

if (report.A) {
  log(`A  null (identical arms): ${report.A.rows.filter((r) => r.null_verdict.startsWith('BLIND')).length}/${report.A.rows.length} clean; NOISE rows ${report.A.null_noise_rows.length}`);
  for (const r of report.A.null_noise_rows) log(`   NOISE ${r.effect}: ${r.paths.slice(0, 6).join(', ')}`);
  for (const p2 of report.A.positive) log(`   positive ${p2.effect} break=${p2.break} lo=${p2.lo} hi=${p2.hi} -> ${p2.verdict} (${p2.differing.length} paths)`);
}
if (report.B) for (const r of report.B.runs) log(`B  ${r.effect} r=${r.radius_r_m} -> bodies hit ${r.bodies_hit}/4  applied=${r.applied}`);
if (report.C) {
  for (const s of report.C.summon) log(`C  ${s.effect} mag ${s.magnitude} break=${s.break} -> hp_max ${s.body_hp_max} power ${s.summon && s.summon.power} | player took ${s.player_damage_taken_600f} from ${s.bodies_in_room} body(ies)`);
  for (const f of report.C.flee) log(`C  ${f.effect} mag ${f.magnitude} break=${f.break} -> ended ${f.dist_after_900f_m} m out (leash ${f.declared_leash_m})`);
  for (const f of report.C.calm_reference) log(`C  calm_beast mag ${f.magnitude} -> ended ${f.dist_after_900f_m} m out`);
}
if (report.D) for (const r of report.D.rows) log(`D  ${r.effect} dur ${r.duration_s}s -> total damage ${r.damage_total} (Morrowind per-second would be ${r.morrowind_expected_if_per_second})`);
if (report.E) {
  for (const a of report.E.absorb) log(`E1 ${a.effect}: player ${a.player_delta >= 0 ? '+' : ''}${a.player_delta}, enemy ${a.enemy_delta}`);
  log(`E2 summon side: ${JSON.stringify(report.E.summon_side.entity_record)} | player took ${report.E.summon_side.player_damage_from_own_summon} from its own summon in 900 f@60`);
  log(`E3 frenzy: other body damaged ${report.E.frenzy.other_body_damaged}, frenzied body damaged ${report.E.frenzy.frenzied_body_damaged}`);
  log(`E4 focus_max ${report.E.bind_greater_ceiling.focus_max}; affordable magnitudes: ${report.E.bind_greater_ceiling.ladder.filter((x) => x.affordable).map((x) => x.magnitude).join(',')}`);
}
if (report.F) {
  log(`F  identical casts damage set: ${JSON.stringify(report.F.identical_damage_set)}; perturbation damage set: ${JSON.stringify(report.F.perturbation_damage_set)}`);
}
if (report.G) {
  log(`G  multi-dial spell made: ${!report.G.multi_effect_made.refused} (${report.G.multi_effect_made.id}); menus: ${report.G.menus.join(', ')}`);
}
if (report.H) {
  for (const r of report.H.range_multiplier) log(`H1 ${r.class} ${r.range}: applied ${r.applied}x, damage ${r.damage} (declared output ${r.declared_output})`);
  for (const a of report.H.allegiance) log(`H2 ${a.mode}: foe took ${a.foe_damage_taken}, summon took ${a.summon_damage_taken}, player took ${a.player_damage_taken}`);
  log(`H3 focus_max fresh ${report.H.focus_ceiling.focus_max_fresh} -> after 120 f ${report.H.focus_ceiling.focus_max_after_120f}; quote ${report.H.focus_ceiling.quote_focus_cost}; cast kinds ${JSON.stringify(report.H.focus_ceiling.cast_event_kinds)}`);
  for (const h of report.H.highest_castable) log(`H3 bind_greater mag ${h.magnitude}: summoned ${h.summoned} power ${h.power} hp ${h.hp} (focus_max at gate ${h.focus_max_at_gate})`);
}
if (report.I) {
  for (const r of report.I.duration) log(`I1 ${r.effect} dur ${r.duration_s}s -> applied ${r.applied}, total damage ${r.total_damage} (Morrowind per-second total ${r.morrowind_per_second_total})`);
  for (const a of report.I.allegiance) log(`I2 ${a.mode}: foe took ${a.foe_damage_taken}, summon took ${a.summon_damage_taken}, player took ${a.player_damage_taken}`);
  for (const d of report.I.drift) log(`I3 ${d.label}: made=${d.made} applied=${d.applied} kinds=${JSON.stringify(d.event_kinds)} final pos ${JSON.stringify(d.pos_series[d.pos_series.length - 1])}`);
}
if (report.J) {
  for (const b of report.J.bolts) log(`J1 ${b.effect} @${b.range}: damage ${b.damage}; spell_hit ${JSON.stringify(b.spell_hits)}`);
  for (const m of report.J.archetype_mutation) log(`J2 ${m.effect} mag ${m.magnitude}: attack_rating series ${JSON.stringify(m.casts.map((c) => c.attack_rating))}; hp series ${JSON.stringify(m.casts.map((c) => c.hp))}`);
}
if (report.K) {
  for (const d of report.K.duration) log(`K1 ${d.effect} dur ${d.duration_s}s -> applies ${d.applies}, trough damage ${d.damage_at_trough}, hp at 600f ${d.hp_at_600f}, series ${JSON.stringify(d.hp_series_every_20f)}`);
  log(`K2 identical casts: attack_rating ${JSON.stringify(report.K.identical_casts.casts.map((c) => c.attack_rating))}, hp ${JSON.stringify(report.K.identical_casts.casts.map((c) => c.hp))}`);
}
console.log(p);
