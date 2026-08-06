#!/usr/bin/env node
// critic-w1-14-r2a.mjs — the W1-14 round-2 critic's OWN instrument. Deliberately not a re-run
// of tools/harness/mag-census.mjs, which the builder wrote and which grades the builder.
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
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r2');
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
      flat(H.getMagicWorld(), 'world', o);
      flat(H.getStatusState(), 'status', o);
      flat(H.getFallState(), 'fall', o);
      o['entities.len'] = H.listEntities().length;
      o['entities.json'] = JSON.stringify(H.listEntities().map((e) => ({ eid: e.eid, hp: e.hp, pos: e.pos.map((v) => Math.round(v * 1e3) / 1e3) })));
      o['gold'] = H.getGold();
      o['xul_hesh'] = H.getXulHesh().xul_hesh;
      // RI-MAG06 §B judges every mitigation effect by "the damage taken from an identical
      // scripted hit". Nothing else in the harness reports `body.mitigation` for a body with no
      // status meter, so the ONLY honest read of shield/resist_*/sap_ward is the damage number.
      // Taken AFTER every other read, identically in treatment and control, at the end of a run.
      o['probe.scripted_hit_applied'] = H.damagePlayer(100, { stagger: false }).applied;
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
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setMagicSkills({ sorcery: 100, root_speech: 100, warding: 100, veiling: 100 });
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
      schema: 'elder-souls/critic-w1-14-r2a@1',
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
writeJson(path.join(outDir, 'critic-consumption-census.json'), report);
console.log(path.join(outDir, 'critic-consumption-census.json'));
