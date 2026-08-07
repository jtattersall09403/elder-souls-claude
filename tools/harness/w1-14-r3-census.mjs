#!/usr/bin/env node
// w1-14-r3-census.mjs — RI-MAG06 M7 (`DISTINCT-VERBS`) and M8 (the arena audit), re-run.
//
// THIS FILE IS THE ROUND-2 CRITIC'S OWN INSTRUMENT (`critic-w1-14-r2a.mjs`), changed in exactly
// three places and in no others, so that the number it reports is comparable to the 33/55 it
// reported against the round-2 build:
//
//   1. **The arena no longer calls `setMagicSkills`.** RI-MAG06 §E was added because every
//      magic probe in this tree — including this one — opened by granting itself the gate under
//      test. The caster is now a mage by CLASS (chosen at the Writ House) and by PRACTICE (the
//      same `cast_effective` grant a delivered cast emits). If a spell cannot be attuned, the
//      census says so instead of the arena hiding it.
//   2. **The scripted hit has a KIND.** The one read that could not tell `resist_disease` from
//      `shield` was "damage taken from an identical scripted hit", because both moved it. It is
//      now one probe per damage channel, which is what makes the mitigation quartet's four
//      different behaviours four different signatures.
//   3. **The snapshot reads the registers the orphaned effects were rehomed onto** — prop
//      reach, the traversal breath clock and water band, inventory condition, the sap-taint
//      band — because a signature computed over a snapshot that cannot see the consumer is a
//      signature that says the effect did nothing.
//
// Everything else — the flattener, the treatment-vs-control diff, the two magnitudes, the null
// control, the signature grouping — is the critic's, unchanged, deliberately.
//
// TWO QUESTIONS mag-census.mjs cannot answer, both required of this critic:
//
//   Q1  CONSUMPTION (RI-MTH07 §B).  mag-census asks "did the named system move at all".
//       RI-MTH07 asks the harder question: PERTURB the model and watch an entity change.
//       So every effect is cast TWICE, from an identical arena, at two well-separated
//       magnitudes, plus a null control in which nothing is cast. A consumer that reads the
//       magnitude produces two different observations; a consumer that merely *fires* produces
//       the same observation twice, which is the round-1 failure at one remove.
//
//   Q2  DISTINGUISHABILITY.  55 handlers is not 55 verbs. For each effect this records the
//       SIGNATURE — the sorted set of world-side leaf paths that moved, and their signs —
//       computed mechanically from a flattened snapshot of every consuming system, with no
//       per-effect probe table anywhere in this file. Effects that share a signature are
//       indistinguishable to a player no matter how many code paths produced them.
//
// The snapshot is deliberately taken through calls that are NOT magic's own bookkeeping:
// magic.focus, magic.effects_active and the effect_apply event stream are all EXCLUDED, because
// they are the model reporting on itself. What is counted is player/enemy/stealth/quest/world
// state — RI-MTH07 §B2's "entity-side quantity".
//
// USAGE  node tools/harness/critic-w1-14-r2a.mjs [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r2a.mjs — magnitude-coupling + observable-signature census (RI-MTH07 §B, RI-MAG06)`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async () => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    const effects = D.effects.effects;
    const notes = [];

    // ---------------------------------------------------------------------------------------
    // The snapshot. Flattened to leaf paths so nothing per-effect is hand-written.
    // ---------------------------------------------------------------------------------------
    const flat = (obj, prefix, out) => {
      if (obj === null || obj === undefined) { out[prefix] = null; return out; }
      if (Array.isArray(obj)) {
        // ROUND-1 LESSON APPLIED TO MY OWN INSTRUMENT: the first version of this line recorded
        // only each element's `id`, so a register whose rows changed *state* (a lock going
        // `locked: true -> false`) was invisible and 22 effects read as "moved nothing". Record
        // the whole array, verbatim, in order.
        out[prefix + '.len'] = obj.length;
        out[prefix + '.json'] = JSON.stringify(obj);
        // ROUND-3 LESSON, SAME SHAPE, ONE LEVEL DOWN. Stopping at the array boundary makes the
        // whole array ONE leaf path, and §D's signature is a set of PATHS — so `fire_damage`,
        // `frost_damage` and `shock_damage` all reduce to `status.json` and collide, although
        // they advance three different buildup meters and a player can see the difference in one
        // hit. Same for `corrode` (armour rating), `burden` (equip load), `silence` (silenced)
        // and `paralyse` (paralysed), which are four different fields inside one blob.
        // A blob is not a leaf. Recurse. `.json` and `.len` are KEPT so nothing that used to be
        // visible stops being visible, and so the round-2 number stays computable from the same
        // record (`distinct_signatures_blob` below).
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
      flat({ hp: ps.hp, hp_max: ps.hp_max, pos: ps.pos.map((v) => Math.round(v * 1e3) / 1e3),
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
      // `world.*` is `getMagicWorld()` — MAGIC'S OWN BOOKKEEPING. M7 forbids computing a
      // signature from it, so it is kept (it is the only readout of a conjured wall or a summon)
      // but every path under it is tagged, and the headline DISTINCT-VERBS below is recomputed
      // with the whole prefix dropped. A build whose verbs are distinguishable only in magic's
      // private notes has not shipped 55 verbs.
      flat(H.getMagicWorld(), 'world', o);
      // The WORLD SIDE of the same verbs: sim.world, the durable register save/state.js persists.
      // `open_lock` -> doors_unlocked, `shatter` -> shortcuts_opened, a taken prop -> items_taken.
      flat(H.getWorldRegisters(), 'sim_world', o);
      flat(H.getStatusState(), 'status', o);
      flat(H.getFallState(), 'fall', o);
      // The registers the eight orphaned effects were rehomed onto in round 3. Without these
      // the census cannot see `telekinesis`, `buoyancy`, `breathe_water`, `mend_item`,
      // `corrode`'s second half or `sap_ward` at all — which is how they scored as verbs while
      // writing tables only the magic module read.
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
      // RI-MAG06 §B judges every mitigation effect by "the damage taken from an identical
      // scripted hit". Nothing else in the harness reports `body.mitigation` for a body with no
      // status meter, so the ONLY honest read of shield/resist_*/sap_ward is the damage number.
      // Taken AFTER every other read, identically in treatment and control, at the end of a run.
      // ONE PROBE PER DAMAGE CHANNEL. Round 2 took a single un-kinded 100-damage hit, and that
      // single number is exactly why `shield`, `resist_element` and `resist_disease` collapsed
      // into one signature: all three moved it. A ward is a different verb from the ward next
      // to it precisely when the SET of channels it moves is different.
      // READ-ONLY (`probeWard`), not `damagePlayer`. Seven real 100-damage hits taken twice per
      // run killed the caster before it could cast: a snapshot must not perturb the thing it is
      // snapshotting. The arithmetic is the resolver's own `mitigate()`, unchanged.
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

    // ---------------------------------------------------------------------------------------
    // The arena. Identical every time, seeded identically, magic world reset.
    // ---------------------------------------------------------------------------------------
    const arena = (withEnemy) => {
      H.setSeed(4242);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.resetMagicWorld();
      // RI-MAG06 §E: NO `setMagicSkills`, and no `setSkills`. A mage by class and by practice.
      // ORDER MATTERS AND IT IS NOT COSMETIC: `setCharacter` re-derives the pools from the
      // sheet's own WILLPOWER, and practising grants attribute points which re-derive them
      // again. `setWillpower` is a harness override and the real derivation RECLAIMS it — which
      // is correct, and which silently cut the reservoir to 43 and made every commissioned
      // spell unaffordable when this ran with the round-2 ordering. Character first, practice
      // second, the override last.
      // NOT an Argonian. Round 3's first census ran a `saxhleel` and `sap_ward` came back
      // "moved nothing" — correctly, because the effect's own record rules that an Argonian has
      // no taint to lower. An arena that makes one of the 55 effects a no-op by the caster's
      // RACE is measuring the caster, not the effect.
      H.setCharacter({ race: 'imga', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
      for (let i = 0; i < 700; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true });
      H.setEquipLoad(50);           // MEDIUM: leaves room for feather AND burden to move a tier
      H.setGold(2000000);
      H.hearthRest();
      // Preconditions, identical in treatment and control, so the restorative effects have
      // something to restore. Without these `restore_health` on a full-health body and
      // `cure_*` on a body with no affliction are unobservable for want of a wound, not for
      // want of a handler — and a critic must not confuse the two.
      H.damagePlayer(220, { stagger: false });
      H.addAffliction('marsh_rot', 'disease');
      H.addAffliction('sap_blight', 'poison');
      H.addAffliction('stiff_limb', 'paralysis');
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.magicEventsDrain();
      let eid = null;
      if (withEnemy) { eid = H.spawn('inf_trash', 0, 1.4); H.aggro(eid); }
      return eid;
    };

    const FOCUS_MAX = (() => { arena(false); return H.getMagicState().focus_max; })();

    /** Cast one made spell and let it resolve. Returns the events for the record. */
    const castOnce = (spellId, frames) => {
      H.setAttuned([spellId]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      H.stepFrames(frames === undefined ? 240 : frames);
    };

    const rangeFor = (e) => {
      // Prefer the range that puts the effect where its own system lives, with no per-effect
      // special-casing: self if it has one, else touch (an enemy is standing at 1.4 m), else
      // target, else whatever it accepts.
      for (const r of ['self', 'touch', 'target', 'projectile', 'area_at_range']) if (e.ranges.includes(r)) return r;
      return e.ranges[0];
    };

    const rows = [];
    for (const e of effects) {
      const row = { effect: e.id, school: e.school, mag_min: e.magnitude.min, mag_max: e.magnitude.max };
      const range = rangeFor(e);
      const wantsEnemy = range !== 'self';
      const dur = e.duration.allowed ? Math.min(20, e.duration.max_s) : 0;

      // Two well-separated magnitudes, both inside the reservoir.
      const lo = e.magnitude.min;
      let hi = e.magnitude.max;
      const spec = (m) => ({ class: 'LIGHT', range, effects: [{ effect: e.id, magnitude: m, duration_s: dur, area_r_m: 0 }] });
      arena(false);
      // Back hi off until the spell fits the reservoir; record what we settled on.
      let guard = 0;
      while (hi > lo && guard++ < 40) {
        const q = H.quoteSpell(spec(hi));
        if (!q.refused && q.focus_cost <= FOCUS_MAX) break;
        hi = Math.max(lo, Math.floor(hi / 2));
      }
      row.range = range; row.duration_s = dur; row.mag_lo = lo; row.mag_hi = hi;
      row.binary_by_data = (hi === lo);

      const runOne = (m, cast) => {
        const eid = arena(wantsEnemy);
        let sid = null;
        if (cast) {
          const mk = H.makeSpell(spec(m), `crit_${e.id}_${m}`);
          if (mk.refused) return { refused: mk.reason || mk.gate, before: null, after: null };
          sid = mk.spell.id;
        }
        H.stepFrames(4);
        const before = snap(eid);
        if (cast) castOnce(sid, 240); else H.stepFrames(240);
        const after = snap(eid);
        return { before, after, spell: sid, diff: diff(before, after) };
      };

      let ctl, a, b;
      try {
        ctl = runOne(lo, false);
        a = runOne(lo, true);
        b = row.binary_by_data ? null : runOne(hi, true);
      } catch (err) {
        row.class = 'THREW'; row.note = String(err && err.message); rows.push(row); continue;
      }
      if (a.refused) { row.class = 'NOT_CASTABLE'; row.note = a.refused; rows.push(row); continue; }

      // TREATMENT-AFTER vs CONTROL-AFTER. Two runs, same seed, same inputs, same frame count;
      // the ONLY difference is that one of them cast the spell. Everything that differs is the
      // spell's footprint. (An earlier version of this file diffed before/after and subtracted
      // the control by key, which silently deleted every hp-moving effect because the control's
      // own scripted hit also moved hp. Recorded here because it is exactly the class of
      // instrument error this verdict charges other people with.)
      const netA = diff(ctl.after, a.after);
      const netB = b && !b.refused ? diff(ctl.after, b.after) : null;

      row.moved_paths = Object.keys(netA).sort();
      row.moved_paths_hi = netB ? Object.keys(netB).sort() : null;
      // The SIGNATURE is the union over both magnitudes: an effect whose low magnitude is below
      // its own threshold (open_lock at 1 opens no tier-3 collar) still has the verb.
      const union = new Set([...Object.keys(netA), ...(netB ? Object.keys(netB) : [])]);
      row.signature = [...union].sort().join('|');
      row.detail_lo = netA;
      if (netB) row.detail_hi = netB;

      // ---- RI-MTH07 §B2: does the OBSERVATION move when the MODEL moves? -------------------
      if (row.binary_by_data) {
        row.magnitude_coupling = 'N/A_BINARY';
      } else if (!netB) {
        row.magnitude_coupling = 'HI_REFUSED';
      } else {
        const differing = [];
        for (const k of union) {
          if (JSON.stringify(a.after[k]) !== JSON.stringify(b.after[k])) differing.push(k);
        }
        row.magnitude_differing_paths = differing.sort();
        row.magnitude_coupling = differing.length > 0 ? 'COUPLED' : 'MAGNITUDE_IGNORED';
      }
      row.moved_anything = union.size > 0;
      rows.push(row);
    }

    // ---- distinguishability: group by signature ------------------------------------------
    const bySig = {};
    for (const r of rows) {
      if (!r.signature) continue;
      (bySig[r.signature] = bySig[r.signature] || []).push(r.effect);
    }
    const collisions = Object.entries(bySig).filter(([, v]) => v.length > 1)
      .map(([sig, v]) => ({ signature: sig, effects: v }));

    return {
      schema: 'elder-souls/w1-14-r3-census@1',
      harness_version: H.version,
      focus_max: FOCUS_MAX,
      summary: {
        total: rows.length,
        moved_anything: rows.filter((r) => r.moved_anything).length,
        moved_nothing: rows.filter((r) => r.moved_anything === false).map((r) => r.effect),
        not_castable: rows.filter((r) => r.class === 'NOT_CASTABLE').map((r) => r.effect),
        magnitude_ignored: rows.filter((r) => r.magnitude_coupling === 'MAGNITUDE_IGNORED').map((r) => r.effect),
        magnitude_coupled: rows.filter((r) => r.magnitude_coupling === 'COUPLED').length,
        binary_by_data: rows.filter((r) => r.binary_by_data).map((r) => r.effect),
        distinct_signatures: Object.keys(bySig).length,
        signature_collisions: collisions,
      },
      rows, notes,
    };
  });
} finally {
  await handle.close();
}

const s = report.summary;
log(`moved_anything ${s.moved_anything}/${s.total}   distinct signatures ${s.distinct_signatures}   magnitude_ignored ${s.magnitude_ignored.length}`);
log(`moved nothing: ${s.moved_nothing.join(', ') || '(none)'}`);
log(`magnitude ignored: ${s.magnitude_ignored.join(', ') || '(none)'}`);
for (const c of s.signature_collisions) log(`  COLLISION [${c.effects.join(', ')}] -> ${c.signature.slice(0, 160)}`);
writeJson(path.join(outDir, 'census.json'), report);
console.log(path.join(outDir, 'census.json'));
