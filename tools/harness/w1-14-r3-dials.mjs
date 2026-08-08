#!/usr/bin/env node
// w1-14-r3-dials.mjs — THE THREE DIALS. Which of magnitude / duration / area has a reader?
//
// WHY THIS EXISTS, AND WHY IT IS NOT `w1-14-r3-census.mjs`.
//
// The census asks two questions: does an effect move anything world-side (`moved_anything`), and
// is its footprint distinguishable from its neighbour's (`DISTINCT-VERBS`). It asks ONE
// perturbation question — magnitude — and it asks it with `duration_s` pinned at 20 and
// `area_r_m` pinned at **0** for all 55 rows. So the census has never varied two of the three
// dials Morrowind's spell system is built out of, and cannot have found a defect in either.
//
// That matters because the shape this project has now found in eighteen-plus subsystems is
// *an authored model with no reader*. `game/data/magic/effects.json` authors, per effect, a
// magnitude range, a duration allowance and an area allowance — 55 magnitude dials, 37 duration
// dials, 12 area dials, 104 dials in all. Every one is a claim that the player can turn it and
// the world will answer. `bind_lesser` and `bind_greater` were handed to this round as two dials
// that do not answer. This probe asks the question of all 104 rather than of the two.
//
// THE DESIGN: one base and three knock-downs, plus a null control.
//
//   CONTROL   nothing is cast at all
//   BASE      (magnitude HI, duration HI, area HI)
//   MAG_LO    (magnitude LO, duration HI, area HI)   <- only magnitude differs from BASE
//   DUR_LO    (magnitude HI, duration LO, area HI)   <- only duration  differs from BASE
//   AREA_LO   (magnitude HI, duration HI, area LO)   <- only area      differs from BASE
//
// and then, for each dial, `BLIND` iff the world after the knock-down arm is byte-identical to
// the world after BASE across every leaf path either of them moved.
//
// FOUR THINGS THAT MAKE THIS AN INSTRUMENT RATHER THAN A TABLE OF NUMBERS:
//
//  1. THE CONTROL IS LOAD-BEARING, NOT DECORATIVE. `BLIND` is only meaningful for an effect that
//     moved something in the first place. An inert effect is blind on all three dials trivially,
//     and counting it would let a build improve its dial score by breaking handlers. Every row
//     is therefore classified against CONTROL first: `INERT` (BASE == CONTROL) is reported
//     separately and is never counted as blind or as coupled.
//  2. DELIVERY IS CHECKED ON EVERY ARM. A knock-down arm that was refused — for Focus, for
//     attunement, by S29's travel fence — produces a world that differs from BASE at every path,
//     i.e. a perfect false `COUPLED`. This is not hypothetical: it is the defect that made the
//     round-3 census's first magnitude number untrustworthy. An arm with no `effect_apply` is
//     `UNMEASURED`, never `COUPLED` and never `BLIND`.
//  3. DURATION IS READ INSIDE THE WINDOW. A duration dial can only be observed by looking at a
//     moment when the short lease has expired and the long one has not. `DUR_LO` is 1 s (60 f@60)
//     and the snapshot is taken at 240 f@60, with `duration_hi` forced above the snapshot frame;
//     a probe that snapshots after both leases have run out would report every effect in the
//     catalogue as duration-blind and be wrong about all of them.
//  4. AREA IS READ WITH TWO BODIES AND NEITHER RADIUS IS ZERO. `area_r_m: 0` and `area_r_m: 8`
//     are not two settings of one dial — 0 changes the spell's GEOMETRY KIND from `volume` to
//     `projectile` (`MagicSystem._geometryFor`). Both arms are volumes; only the radius differs.
//     A second body stands 4.6 m from the first, inside the wide radius and outside the narrow.
//
// SELF-TEST (rule 4 — a probe that cannot fail is worse than no probe). **REWRITTEN IN ROUND 4,
// and the reason is RULES.md #6's second shape.** The round-3 verdict §2 found that the declared
// self-test had never been run and that one of its arms could not have said anything:
//
//   * `--break=nocast` skips the cast in EVERY arm, so `base.delivered` is false and all 55 rows
//     hit `if (!base.delivered) { row.verdict = 'NOT_DELIVERED'; continue; }` **before
//     `readDial()` is ever called**. "55/55 NOT_DELIVERED with coupled 0" is a statement that the
//     DELIVERY GATE works — which it does — and says nothing about whether the BLIND/COUPLED
//     comparison can manufacture a coupling out of arena noise, because that comparison never
//     ran. It is kept, because a delivery control is worth having, and it is now LABELLED as
//     what it is instead of standing in for the comparator's control.
//   * `--break=nulldial` is the comparator's control and is new in round 4. Every knock-down arm
//     casts the BASE TUPLE — two identical arms, same seed, same arena, differing in nothing.
//     Every ACTIVE row must therefore read BLIND on every separable dial. Any row that comes back
//     COUPLED under this is a row whose "coupling" is arena noise, and the tool names it.
//   * `--break=bindblind` restores the pre-fix summon handler, which ignored `rec.magnitude`.
//     `bind_lesser`/`bind_greater` must go COUPLED -> BLIND.
//   * `--break=fleeblind` restores round 3's `demoralise`. THE HOOK ITSELF WAS A PARTIAL TEARDOWN
//     until round 4: it disabled the flee loop in `MagicSystem.step` and left `h_demoralise`'s
//     `b.fleeLeashM = clamp(magnitude x 0.9, 6, 45)` standing, so a pure function of the dial was
//     still published through `statusReport()` and `demoralise` stayed COUPLED with the motion
//     gone. `sim/magic/apply.js` now suppresses those four writes under the break, so the arm can
//     go red. `demoralise` must go COUPLED -> BLIND.
//
// `--assert` turns each arm's expectation into an exit code, so "the control was run" and "the
// control went red" are the same claim rather than two.
//
// USAGE  node tools/harness/w1-14-r3-dials.mjs [--out <dir>] [--break=<mode>] [--only=a,b,c] [--assert]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r3-dials.mjs — magnitude / duration / area consumption census (RI-MTH07 §B, RI-MAG02 §E)

  --out <dir>     report directory (default reports/w1-14-r3)
  --break=<mode>  nulldial | bindblind | fleeblind | nocast — deliberate sabotage, so the
                  instrument can be watched red. See the SELF-TEST block in the header for what
                  each one breaks and what it must therefore do to the numbers.
  --only=a,b,c    restrict to named effect ids (for iteration; the headline needs all 55)
  --assert        exit non-zero unless the arm broke what it names
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);
const breakMode = args.break ? String(args.break) : null;
const only = args.only ? String(args.only).split(',').map((s) => s.trim()).filter(Boolean) : null;

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async ({ BREAK, ONLY }) => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    const effects = D.effects.effects.filter((e) => !ONLY || ONLY.includes(e.id));
    const notes = [];

    // ------------------------------------------------------------------------------------
    // The snapshot. Lifted VERBATIM from w1-14-r3-census.mjs so the two reports are directly
    // comparable and so this file cannot quietly redefine "the world moved" in its own favour.
    // Nothing per-effect is hand-written anywhere in it.
    // ------------------------------------------------------------------------------------
    const flat = (obj, prefix, out) => {
      if (obj === null || obj === undefined) { out[prefix] = null; return out; }
      if (Array.isArray(obj)) {
        out[prefix + '.len'] = obj.length;
        out[prefix + '.json'] = JSON.stringify(obj);
        for (let i = 0; i < obj.length; i++) flat(obj[i], prefix + '.' + i, out);
        return out;
      }
      if (typeof obj === 'object') {
        for (const k of Object.keys(obj).sort()) flat(obj[k], prefix ? prefix + '.' + k : k, out);
        return out;
      }
      out[prefix] = obj;
      return out;
    };

    const snap = (eid) => {
      const o = {};
      const ps = H.getPlayerStats();
      flat({ hp: ps.hp, hp_max: ps.hp_max, pos: ps.pos.map((v) => Math.round(v)),
             equip_load_pct: ps.equip_load_pct, roll_class: ps.roll_class, attributes: ps.attributes,
             in_combat: ps.in_combat, stamina: Math.round(ps.stamina) }, 'player', o);
      const cs = H.getCombatState();
      const en = cs.enemies.find((x) => x.id === eid) || cs.enemies[0] || null;
      flat(en ? { hp: en.hp, hp_max: en.hp_max, state: en.state, dead: en.dead, yielded: en.yielded } : null, 'enemy', o);
      const st = H.getStealthState();
      flat({ V: st.V, V_raw: st.V_raw, sound_r_m: st.sound_r_m, light: st.light, race: st.race,
             hud_elements: st.hud_elements, magic: st.magic }, 'stealth', o);
      const qs = H.getQuestState();
      flat({ journal: qs.journal.length, topics: qs.topicsKnown, flags: Object.keys(qs.flags).filter((k) => qs.flags[k]),
             dispositions: qs.dispositions, afflictions: (qs.afflictions || []).map((a) => a.id),
             mark: qs.travel && qs.travel.mark ? qs.travel.mark : null }, 'quest', o);
      flat(H.getMagicWorld(), 'world', o);
      flat(H.getWorldRegisters(), 'sim_world', o);
      flat(H.getStatusState(), 'status', o);
      flat(H.getFallState(), 'fall', o);
      o['props.json'] = JSON.stringify(H.listEntities().filter((x) => x.kind === 'object')
        .map((x) => ({ eid: x.eid, taken: x.taken, reach_m: x.reach_m })));
      try {
        const tr = H.getTraversalReport();
        flat({ band: tr.band, breath_s: tr.breath_s, breathes_water: tr.breathes_water,
               buoyant: tr.buoyant, submerged: tr.submerged, stamina_drain_per_s: tr.stamina_drain_per_s }, 'traversal', o);
      } catch (err) { o['traversal.unavailable'] = String(err && err.message).slice(0, 60); }
      o['inventory.json'] = JSON.stringify(H.getInventory ? H.getInventory() : []);
      flat(H.getSapTaint(), 'sap_taint', o);
      o['entities.len'] = H.listEntities().length;
      o['entities.json'] = JSON.stringify(H.listEntities().map((e) => ({ eid: e.eid, hp: e.hp, pos: e.pos.map((v) => Math.round(v * 1e3) / 1e3) })));
      o['gold'] = H.getGold();
      o['xul_hesh'] = H.getXulHesh().xul_hesh;
      for (const kind of ['physical', 'fire', 'frost', 'shock', 'poison', 'disease', 'magic']) {
        o['probe.ward_applied.' + kind] = H.probeWard(100, kind);
      }
      return o;
    };

    const diff = (a, b) => {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      const out = {};
      for (const k of keys) {
        if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
        out[k] = { from: a[k], to: b[k] };
      }
      return out;
    };

    // `gold` is the commission price and `player.stamina` the cast's stamina spend: both move
    // under all 55 effects and under nothing else, so neither can distinguish anything. Dropped
    // from every comparison, exactly as the census drops them.
    const NOISE = (k) => k === 'gold' || k === 'player.stamina';

    // ------------------------------------------------------------------------------------
    // The arena. Byte-identical to the census's, including the S29 settle and the two bodies,
    // with ONE addition: the far body stands where an 8 m volume reaches it and a 1 m volume
    // does not, so the area dial has something to be wrong about.
    // ------------------------------------------------------------------------------------
    const arena = (withEnemy) => {
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
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true });
      H.setEquipLoad(50);
      H.setGold(2000000);
      H.hearthRest();
      H.damagePlayer(220, { stagger: false });
      H.addAffliction('marsh_rot', 'disease');
      H.addAffliction('sap_blight', 'poison');
      H.addAffliction('stiff_limb', 'paralysis');
      H.setTravelMark([37, 0, -24]);
      H.clearProps();
      H.spawnProp({ eid: 'dials_near_bowl', name: 'clay bowl', pos: [0.9, 0, 0.6], reach_m: 2.2 });
      H.spawnProp({ eid: 'dials_far_censer', name: 'brass censer', pos: [0, 0, 6.5], reach_m: 2.2 });
      for (const s of D.spells.spells) H.learnSpell(s.id);
      let eid = null;
      if (!withEnemy) H.stepFrames(320);
      // THE NEAR BODY at 1.4 m is what a `touch`/`target` spell resolves on. THE FAR BODY at
      // (2.6, 5.2) is 4.61 m from the near one: inside an 8 m burst centred on the near body,
      // outside a 1 m one. That separation is the whole area measurement.
      const e0 = H.spawn('inf_trash', 0, withEnemy ? 1.4 : 34.0);
      const e1 = H.spawn('inf_trash', 2.6, withEnemy ? 5.2 : 38.0);
      // LOCK ON, which the census does not do. A `volume` spell at `area_at_range` is placed at
      // the RESOLVED WORLD POINT (`MagicSystem._geometryFor`), and an unaimed cast resolves it
      // wherever the aim ray happens to land — so the narrow-radius arm was failing to deliver
      // for want of an aim rather than for want of a radius. Identical in every arm including
      // the control, so it cannot be the difference between two arms.
      // TWO MORE BODIES, AND THE REASON IS A CONSTANT IN THE ENGINE. A `volume` spell whose
      // placement is `resolved_world_point` is not resolved against anything: `MagicSystem.step`
      // puts the centre a FLAT 9.0 m in front of the caster (system.js §_beginVolume, `dist`).
      // So a 2 m burst cast at `area_at_range` encloses a sphere around (0, 9) and the bodies at
      // 1.4 m and 5.8 m are both outside it — which is why the narrow arm delivered nothing for
      // every area effect whose only area-capable range is `area_at_range`. e2 sits 0.5 m from
      // that fixed centre (inside 2 m) and e3 sits 5.0 m from it (inside 8 m, outside 2 m), so
      // the dial has a near body and a far body at BOTH placements. Left un-aggroed on purpose:
      // an aggroed body walks, and a body that walks between arms is noise in the one register
      // (`entities.json`) the area reading is taken from.
      if (withEnemy) {
        H.spawn('inf_trash', 0, 9.5);
        H.spawn('inf_trash', 0, 14.0);
        eid = e0; H.aggro(e0); H.aggro(e1); H.lockOn(e0);
        // A WOUND ON THE BODIES, for the same reason the arena already puts one on the player:
        // `restore_health` at an area range can only reach `side === 'E'` bodies, so in a room
        // where everything is at full health an area heal is unobservable for want of a wound.
        // Identical in every arm including the control.
        for (const x of H.getCombatState().enemies) H.damageEnemy(x.id, 120);
      }
      if (BREAK === 'bindblind' && H.__breakBindMagnitude) H.__breakBindMagnitude();
      if (BREAK === 'fleeblind' && H.__breakFleeMotion) H.__breakFleeMotion();
      H.magicEventsDrain();
      return eid;
    };

    const FOCUS_MAX = (() => { arena(false); return H.getMagicState().focus_max; })();
    if (BREAK === 'bindblind' && !H.__breakBindMagnitude) {
      notes.push('BREAK bindblind requested but H.__breakBindMagnitude is absent — the sabotage did NOT happen.');
    }
    if (BREAK === 'fleeblind' && !H.__breakFleeMotion) {
      notes.push('BREAK fleeblind requested but H.__breakFleeMotion is absent — the sabotage did NOT happen.');
    }

    const FRAMES = 240;   // the snapshot frame; also the flight+resolve budget.

    // Range preference. Two orders, because the two questions want different geometry:
    //   - an AREA-capable effect must be cast at a range whose volume lands on a BODY, or the
    //     radius has nothing to enclose;
    //   - everything else keeps the census's order, so the magnitude numbers stay comparable.
    const rangeFor = (e) => {
      const order = e.area.allowed
        ? ['area_at_range', 'target', 'projectile', 'touch', 'self']
        : ['self', 'touch', 'target', 'projectile', 'area_at_range'];
      for (const r of order) if (e.ranges.includes(r)) return r;
      return e.ranges[0];
    };

    const rows = [];
    for (const e of effects) {
      const row = { effect: e.id, school: e.school };
      const range = rangeFor(e);
      const wantsEnemy = range !== 'self';
      row.range = range;

      const magLo = e.magnitude.min;
      const durAllowed = !!e.duration.allowed;
      const areaAllowed = !!e.area.allowed;
      const durLo = durAllowed ? 1 : 0;
      // AREA_LO IS 2 m, NOT 1 m, AND THE REASON IS MEASURED. At 1 m the volume was DELIVERED IN
      // NEITHER ARM for every area effect in the smoke run — `area_lo` came back
      // UNMEASURED_NOT_DELIVERED with an empty refusal list, i.e. the burst simply enclosed
      // nothing. A 1 m sphere resolved at an aim point has to land within ~1.3 m of a body's
      // centre to touch it, so the arm was measuring the aim ray and not the dial. 2 m reaches
      // the near body and still falls 2.6 m short of the far one, which is the separation the
      // whole area reading rests on.
      const areaLo = areaAllowed ? Math.min(2, e.area.max_r_m) : 0;

      const spec = (m, d, a) => ({ class: 'LIGHT', range, effects: [{ effect: e.id, magnitude: m, duration_s: d, area_r_m: a }] });

      arena(false);
      // BASE is the most expensive tuple in the design, so it is the one that has to be made
      // affordable; every knock-down arm is cheaper and therefore affordable too. Magnitude is
      // backed off first (halving) and duration only if magnitude alone will not do it, because
      // a duration backed below the snapshot frame would make the duration arm unreadable.
      let magHi = e.magnitude.max;
      let durHi = durAllowed ? Math.min(20, e.duration.max_s) : 0;
      const areaHi = areaAllowed ? e.area.max_r_m : 0;
      let guard = 0;
      const fits = () => { const q = H.quoteSpell(spec(magHi, durHi, areaHi)); return !q.refused && q.focus_cost <= FOCUS_MAX; };
      while (magHi > magLo && guard++ < 40 && !fits()) magHi = Math.max(magLo, Math.floor(magHi / 2));
      while (durHi > 5 && guard++ < 80 && !fits()) durHi = Math.max(5, Math.floor(durHi / 2));
      row.mag = { lo: magLo, hi: magHi };
      row.duration_s = durAllowed ? { lo: durLo, hi: durHi } : null;
      row.area_r_m = areaAllowed ? { lo: areaLo, hi: areaHi } : null;
      row.snapshot_f = FRAMES;

      // Is each dial SEPARABLE at all, from the data alone? A dial whose min equals its max is
      // not a dial, and saying it is "blind" would charge the build for the catalogue's honesty.
      row.mag_separable = magHi > magLo;
      row.dur_separable = durAllowed && durHi * 60 > FRAMES && durLo * 60 < FRAMES;
      row.area_separable = areaAllowed && areaHi > areaLo;

      const runOne = (m, d, a, cast) => {
        const eid = arena(wantsEnemy);
        let sid = null;
        if (cast && BREAK !== 'nocast') {
          const mk = H.makeSpell(spec(m, d, a), `dial_${e.id}_${m}_${d}_${a}`);
          if (mk.refused) return { refused: mk.reason || mk.gate, before: null, after: null };
          sid = mk.spell.id;
        }
        H.stepFrames(4);
        H.magicEventsDrain();
        if (sid) {
          H.setAttuned([sid]);
          H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
        }
        H.stepFrames(FRAMES);
        const after = snap(eid);
        const ev = H.magicEventsDrain();
        const applied = ev.filter((x) => x.kind === 'effect_apply' && (x.effect === undefined || x.effect === e.id));
        const refusals = ev.filter((x) => /refus|denied|dropped|abort/i.test(String(x.kind)))
          .map((x) => ({ kind: x.kind, reason: x.reason || x.gate || x.fence || null }));
        return { after, spell: sid, delivered: cast ? applied.length > 0 : null, refusals };
      };

      let ctl, base, mlo, dlo, alo;
      try {
        ctl = runOne(magHi, durHi, areaHi, false);
        base = runOne(magHi, durHi, areaHi, true);
        mlo = row.mag_separable ? runOne(magLo, durHi, areaHi, true) : null;
        dlo = row.dur_separable ? runOne(magHi, durLo, areaHi, true) : null;
        alo = row.area_separable ? runOne(magHi, durHi, areaLo, true) : null;
      } catch (err) { row.verdict = 'THREW'; row.note = String(err && err.message).slice(0, 300); rows.push(row); continue; }

      if (base.refused) { row.verdict = 'NOT_CASTABLE'; row.note = base.refused; rows.push(row); continue; }
      row.delivered = { base: base.delivered, mag_lo: mlo && !mlo.refused ? mlo.delivered : null,
                        dur_lo: dlo && !dlo.refused ? dlo.delivered : null, area_lo: alo && !alo.refused ? alo.delivered : null };
      row.refusals_base = base.refusals;

      // ---- CONTROL FIRST. Everything below is only meaningful if the spell did something.
      const footprint = Object.keys(diff(ctl.after, base.after)).filter((k) => !NOISE(k)).sort();
      row.footprint = footprint;
      row.footprint_n = footprint.length;
      if (!base.delivered) { row.verdict = 'NOT_DELIVERED'; row.note = JSON.stringify(base.refusals).slice(0, 200); rows.push(row); continue; }
      if (footprint.length === 0) { row.verdict = 'INERT'; rows.push(row); continue; }
      row.verdict = 'ACTIVE';

      // ---- the three dial readings, all by the same rule -------------------------------
      const readDial = (arm, separable, why) => {
        if (!separable) return { coupling: why, differing: null };
        if (!arm || arm.refused) return { coupling: 'UNMEASURED_REFUSED', differing: null, reason: arm ? arm.refused : null };
        if (!arm.delivered) return { coupling: 'UNMEASURED_NOT_DELIVERED', differing: null, refusals: arm.refusals };
        // The comparison set is the union of what BASE moved and what the ARM moved, so an arm
        // that moves something BASE did not is caught too — a dial can be read in either
        // direction and "the low arm did MORE" is still a reader.
        const armFoot = Object.keys(diff(ctl.after, arm.after)).filter((k) => !NOISE(k));
        const union = new Set([...footprint, ...armFoot]);
        const differing = [...union].filter((k) => JSON.stringify(base.after[k]) !== JSON.stringify(arm.after[k])).sort();
        return { coupling: differing.length ? 'COUPLED' : 'BLIND', differing };
      };

      row.magnitude = readDial(mlo, row.mag_separable, 'N/A_FIXED_BY_DATA');
      row.duration = readDial(dlo, row.dur_separable, durAllowed ? 'N/A_UNSEPARABLE' : 'N/A_INSTANTANEOUS');
      row.area = readDial(alo, row.area_separable, 'N/A_NO_AREA');
      rows.push(row);
    }

    const dialCount = (dial, coupling) => rows.filter((r) => r[dial] && r[dial].coupling === coupling).map((r) => r.effect);
    const declared = (pred) => effects.filter(pred).map((e) => e.id);

    return {
      schema: 'elder-souls/w1-14-r3-dials@1',
      harness_version: H.version,
      break_mode: BREAK || null,
      focus_max: FOCUS_MAX,
      snapshot_f: FRAMES,
      summary: {
        total: rows.length,
        // WHAT THE CATALOGUE CLAIMS. The denominator of every number below.
        declared_magnitude_dials: declared((e) => e.magnitude.max > e.magnitude.min).length,
        declared_duration_dials: declared((e) => e.duration.allowed).length,
        declared_area_dials: declared((e) => e.area.allowed).length,
        // THE CONTROL ARM'S OWN OUTPUT — the rows for which "blind" would be a vacuous reading.
        inert: rows.filter((r) => r.verdict === 'INERT').map((r) => r.effect),
        not_delivered: rows.filter((r) => r.verdict === 'NOT_DELIVERED').map((r) => r.effect),
        not_castable: rows.filter((r) => r.verdict === 'NOT_CASTABLE').map((r) => r.effect),
        threw: rows.filter((r) => r.verdict === 'THREW').map((r) => ({ effect: r.effect, note: r.note })),
        active: rows.filter((r) => r.verdict === 'ACTIVE').length,
        magnitude_blind: dialCount('magnitude', 'BLIND'),
        magnitude_coupled: dialCount('magnitude', 'COUPLED').length,
        magnitude_unmeasured: [...dialCount('magnitude', 'UNMEASURED_REFUSED'), ...dialCount('magnitude', 'UNMEASURED_NOT_DELIVERED')],
        duration_blind: dialCount('duration', 'BLIND'),
        duration_coupled: dialCount('duration', 'COUPLED').length,
        duration_unmeasured: [...dialCount('duration', 'UNMEASURED_REFUSED'), ...dialCount('duration', 'UNMEASURED_NOT_DELIVERED')],
        area_blind: dialCount('area', 'BLIND'),
        area_coupled: dialCount('area', 'COUPLED').length,
        area_unmeasured: [...dialCount('area', 'UNMEASURED_REFUSED'), ...dialCount('area', 'UNMEASURED_NOT_DELIVERED')],
      },
      rows, notes,
    };
  }, { BREAK: breakMode, ONLY: only });
} finally {
  await handle.close();
}

const s = report.summary;
log(`break=${report.break_mode || '(none)'}   rows ${s.total}   ACTIVE ${s.active}   INERT ${s.inert.length}   NOT_DELIVERED ${s.not_delivered.length}`);
log(`MAGNITUDE  declared ${s.declared_magnitude_dials}  coupled ${s.magnitude_coupled}  BLIND ${s.magnitude_blind.length}  unmeasured ${s.magnitude_unmeasured.length}`);
log(`DURATION   declared ${s.declared_duration_dials}  coupled ${s.duration_coupled}  BLIND ${s.duration_blind.length}  unmeasured ${s.duration_unmeasured.length}`);
log(`AREA       declared ${s.declared_area_dials}  coupled ${s.area_coupled}  BLIND ${s.area_blind.length}  unmeasured ${s.area_unmeasured.length}`);
log(`magnitude blind: ${s.magnitude_blind.join(', ') || '(none)'}`);
log(`duration  blind: ${s.duration_blind.join(', ') || '(none)'}`);
log(`area      blind: ${s.area_blind.join(', ') || '(none)'}`);
if (s.inert.length) log(`INERT (control arm says the spell moved nothing): ${s.inert.join(', ')}`);
for (const n of report.notes) log(`NOTE: ${n}`);

const tag = report.break_mode ? `-break-${report.break_mode}` : '';
const p = path.join(outDir, `dials${tag}.json`);
writeJson(p, report);
console.log(p);
