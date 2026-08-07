#!/usr/bin/env node
// critic-w1-14-r3-census.mjs — W1-14 round-3 CRITIC's OWN RI-MAG06 §D / M7 / M8 census.
//
// Written from RI-MAG06 §D and §E directly. It is NOT the builder's `w1-14-r3-census.mjs` and it
// is not the round-2 critic's `critic-w1-14-r2a.mjs`. Three things it does that neither does:
//
//  A. STABILITY. Every treatment is run TWICE from an identically-seeded arena. A leaf path that
//     differs between two identical treatment runs is NOISE, not signature, and noise is what
//     inflates `DISTINCT-VERBS`: 55 chaotic diff-sets are 55 distinct signatures. The signature
//     is the INTERSECTION of the two runs, and the symmetric difference is reported per effect.
//     A census with no repeat cannot tell a verb from a butterfly.
//
//  B. THE ARENA AUDIT DONE PROPERLY (§E / M8). The builder replaced `setMagicSkills({...100})`
//     with 700 iterations of `grantSkillUse('cast_effective', {cost: 40})` x 4 schools. Measured,
//     that loop ends at sorcery 100 / root-speech 99 / warding 100 / veiling 100 — it IS
//     `setMagicSkills({...100})`, with more lines. M8 requires the census be re-run WITHOUT the
//     gating call and the delta reported, so `--practice=N` runs the whole census at any point on
//     that ladder and `--practice=0` is a character who has only ever chosen a class.
//
//  C. AN EMPTY-EMPTY CONTROL. Two null runs are diffed against each other before anything is
//     cast. If that is not empty, every number below is noise and the run says so and stops.
//
// The signature excludes magic's own bookkeeping per M7: `focus`, `effects_active`, the
// `effect_apply` stream, and `getMagicWorld()` (magic's private lock/trap/summon register) are
// tagged `m:` and dropped from the strict number. Everything read through `getStatusState()` is
// kept as world-side because those fields live on the CombatBody, not in the magic module.
//
// USAGE  node tools/harness/critic-w1-14-r3-census.mjs [--practice N] [--out DIR] [--tag NAME]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = 'critic-w1-14-r3-census.mjs — the W1-14 r3 critic\'s own DISTINCT-VERBS census';
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('corpus/90-verdicts/wave1/artifacts/W1-14-r3');
ensureDir(outDir);
const PRACTICE = args.practice === undefined ? 0 : Number(args.practice);
const TAG = String(args.tag || `practice${PRACTICE}`);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (PRACTICE) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    const D = H.getMagicData();
    const effects = D.effects.effects;

    // ---- mechanical flatten. No per-effect table exists anywhere in this file. ------------
    const flat = (obj, prefix, out) => {
      if (obj === null || obj === undefined) { out[prefix] = obj === undefined ? '__undef__' : null; return out; }
      if (Array.isArray(obj)) {
        out[prefix + '#len'] = obj.length;
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
    const r2 = (v) => Math.round(v * 100) / 100;

    // ---- the snapshot. `w:` world-side. `m:` magic's own bookkeeping (M7 drops these). ----
    const snap = () => {
      const o = {};
      const ps = H.getPlayerStats();
      flat({
        hp: r2(ps.hp), hp_max: r2(ps.hp_max),
        pos_m: ps.pos.map((v) => Math.round(v)),          // metre resolution: a cast's 0.15 m
        pos_y_cm: Math.round(ps.pos[1] * 100),            // shuffle rounds away, a teleport does not
        equip_load_pct: r2(ps.equip_load_pct), roll_class: ps.roll_class,
        attributes: ps.attributes, in_combat: ps.in_combat,
      }, 'w:player', o);
      const cs = H.getCombatState();
      flat(cs.enemies.map((e) => ({
        id: e.id, hp: r2(e.hp), state: e.state, dead: !!e.dead,
        pos_q: e.pos ? e.pos.map((v) => Math.round(v * 4) / 4) : null,
      })), 'w:enemies', o);
      flat(H.getStatusState(), 'w:status', o);            // CombatBody fields, read via magic
      flat(H.getStealthState(), 'w:stealth', o);
      const qs = H.getQuestState();
      flat({ journal: qs.journal.length, topics: (qs.topicsKnown || []).slice().sort(),
             flags: Object.keys(qs.flags || {}).filter((k) => qs.flags[k]).sort(),
             dispositions: qs.dispositions || {},
             afflictions: (qs.afflictions || []).map((a) => (a && a.id) || a).sort(),
             mark: qs.travel && qs.travel.mark ? qs.travel.mark.map((v) => Math.round(v)) : null }, 'w:quest', o);
      flat(H.getWorldRegisters(), 'w:sim_world', o);
      flat(H.listEntities().map((e) => ({ eid: e.eid, kind: e.kind, hp: e.hp === undefined ? null : r2(e.hp),
        taken: e.taken === undefined ? null : !!e.taken, reach_m: e.reach_m === undefined ? null : e.reach_m })), 'w:entities', o);
      flat(H.getInventory(), 'w:inventory', o);
      try {
        const tr = H.getTraversalReport();
        flat({ band: tr.band, breath_s: tr.breath_s, breathes_water: tr.breathes_water,
               buoyant: tr.buoyant, submerged: tr.submerged,
               stamina_drain_per_s: tr.stamina_drain_per_s }, 'w:traversal', o);
      } catch (e) { o['w:traversal#err'] = String(e.message).slice(0, 60); }
      flat(H.getSapTaint(), 'w:sap_taint', o);
      o['w:xul_hesh'] = H.getXulHesh().xul_hesh;
      const sh = H.getSkillSheet();
      for (const k of ['sorcery', 'root-speech', 'warding', 'veiling', 'security', 'sneak'])
        o['w:skill.' + k] = sh[k] ? sh[k].value : null;
      // RI-MAG06 §B: a ward is judged by the damage an identical scripted hit costs. Read-only
      // through the resolver's own mitigate(), one probe per damage channel — a ward is a
      // different verb from its neighbour exactly when the SET of channels it moves differs.
      for (const kind of ['physical', 'fire', 'frost', 'shock', 'poison', 'disease', 'magic'])
        o['w:hit.' + kind] = H.probeWard(100, kind);
      // magic's OWN register. Kept so a conjured wall / summon is visible at all, tagged so the
      // strict M7 number can drop the whole prefix.
      flat(H.getMagicWorld(), 'm:world', o);
      const fs = H.getFallState();
      flat({ levitating: fs.levitating, airborne: fs.airborne, terminal: fs.terminal_mps,
             fall_damage: fs.fall_damage_enabled, jump_apex: fs.jump_apex_mult }, 'm:fall', o);
      return o;
    };

    const diffKeys = (a, b) => {
      const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
      const out = [];
      for (const k of ks) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
      return out.sort();
    };

    // ---- the arena ------------------------------------------------------------------------
    const CH = { race: 'breton', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' };
    const arena = (withEnemy) => {
      H.setSeed(4242);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.resetMagicWorld();
      H.resetSapTaint();
      H.setCharacter(CH);
      // §E/M8: THE GATING CALL, isolated behind one number. 0 = a character who has only chosen
      // a class. Anything above 0 is the census measuring an arena.
      for (let i = 0; i < PRACTICE; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setStealthState({ sneak: 40, security: 40, agility: 40, load: 'medium', surface: 'timber', crouched: true });
      H.setEquipLoad(50);
      H.setGold(5000000);
      H.hearthRest();
      // PRECONDITIONS — identical in treatment and control. Not gates: a wound, three
      // afflictions, a travel mark and two objects on the floor.
      H.damagePlayer(200, { stagger: false });
      H.addAffliction('marsh_rot', 'disease');
      H.addAffliction('sap_blight', 'poison');
      H.addAffliction('stiff_limb', 'paralysis');
      H.setTravelMark([37, 0, -24]);
      H.clearProps();
      H.spawnProp({ eid: 'crit_near_bowl', name: 'clay bowl', pos: [0.9, 0, 0.6], reach_m: 2.2 });
      H.spawnProp({ eid: 'crit_far_censer', name: 'brass censer', pos: [0, 0, 6.5], reach_m: 2.2 });
      for (const s of D.spells.spells) H.learnSpell(s.id);
      // S29's 300-frame fence is armed by damagePlayer(); settle it out with the room EMPTY.
      if (!withEnemy) H.stepFrames(320);
      const e0 = H.spawn('inf_trash', 0, withEnemy ? 1.4 : 34.0);
      const e1 = H.spawn('inf_trash', 2.6, withEnemy ? 5.2 : 38.0);
      if (withEnemy) { H.aggro(e0); H.aggro(e1); }
      H.magicEventsDrain();
      return e0;
    };

    const notes = [];
    // ---- C: the empty-empty control. If two null runs differ, nothing below means anything.
    const nullPair = [];
    for (let i = 0; i < 2; i++) { arena(false); H.stepFrames(4); H.stepFrames(240); nullPair.push(snap()); }
    const nullDriftSelf = diffKeys(nullPair[0], nullPair[1]);
    const nullPairE = [];
    for (let i = 0; i < 2; i++) { arena(true); H.stepFrames(4); H.stepFrames(240); nullPairE.push(snap()); }
    const nullDriftSelfE = diffKeys(nullPairE[0], nullPairE[1]);
    notes.push(`null-vs-null drift, empty room: ${nullDriftSelf.length} paths`);
    notes.push(`null-vs-null drift, aggroed room: ${nullDriftSelfE.length} paths`);

    const rangeFor = (e) => {
      for (const r of ['self', 'touch', 'target', 'projectile', 'area_at_range']) if (e.ranges.includes(r)) return r;
      return e.ranges[0];
    };

    const runOne = (e, spec, cast) => {
      const wantsEnemy = spec ? spec.range !== 'self' : false;
      arena(wantsEnemy);
      let sid = null, made = null;
      if (cast) {
        made = H.makeSpell(spec, `crit3_${e.id}`);
        if (made.refused) return { refused: made.gate || made.reason };
        sid = made.spell.id;
        const att = H.setAttuned([sid]);
        if (!att.length) return { refused: 'attune', attune: H.getMagicState().last_attune_refusals || 'skill' };
      }
      H.stepFrames(4);
      H.magicEventsDrain();
      if (cast) { H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]); }
      H.stepFrames(240);
      const after = snap();
      const ev = cast ? H.magicEventsDrain() : [];
      const applied = ev.filter((x) => x.kind === 'effect_apply' && (x.effect === undefined || x.effect === e.id));
      const refusals = ev.filter((x) => /refus|denied|dropped|abort/i.test(String(x.kind)))
        .map((x) => ({ kind: x.kind, reason: x.reason || x.gate || x.fence || null }));
      return { after, delivered: cast ? applied.length > 0 : null, refusals, quote: made ? made.quote : null };
    };

    const rows = [];
    for (const e of effects) {
      const row = { effect: e.id, school: e.school };
      const range = rangeFor(e);
      const dur = e.duration.allowed ? Math.min(20, e.duration.max_s) : 0;
      const lo = e.magnitude.min;
      const hiMax = e.magnitude.max;
      const spec = (m) => ({ class: 'LIGHT', range, effects: [{ effect: e.id, magnitude: m, duration_s: dur, area_r_m: 0 }] });
      row.range = range; row.duration_s = dur; row.mag_lo = lo;

      // pick the largest magnitude this caster can actually AFFORD AND ATTUNE, honestly.
      arena(false);
      const fmax = H.getMagicState().focus_max;
      let hi = hiMax, guard = 0, hiQuote = null;
      while (hi > lo && guard++ < 60) {
        const q = H.quoteSpell(spec(hi));
        if (!q.refused && q.focus_cost <= fmax && q.attunable_now) { hiQuote = q; break; }
        hi = Math.max(lo, Math.floor(hi / 2));
      }
      row.mag_hi = hi; row.binary_by_data = (hi === lo);
      row.hi_tier = hiQuote ? hiQuote.tier : null;
      row.focus_max = fmax;

      let ctl, a1, a2, b1;
      try {
        ctl = runOne(e, spec(lo), false);
        a1 = runOne(e, spec(lo), true);
        a2 = runOne(e, spec(lo), true);           // THE REPEAT — A above
        b1 = row.binary_by_data ? null : runOne(e, spec(hi), true);
      } catch (err) { row.class = 'THREW'; row.note = String(err && err.message).slice(0, 200); rows.push(row); continue; }

      if (a1.refused) { row.class = 'NOT_CASTABLE'; row.note = String(a1.refused); rows.push(row); continue; }
      row.delivered_lo = a1.delivered;
      row.delivered_lo_repeat = a2.refused ? null : a2.delivered;
      row.delivered_hi = b1 && !b1.refused ? b1.delivered : null;
      row.refusals_lo = a1.refusals;
      if (!a1.delivered) { row.class = 'NOT_DELIVERED'; row.note = JSON.stringify(a1.refusals).slice(0, 160); }

      const d1 = new Set(diffKeys(ctl.after, a1.after));
      const d2 = a2.refused ? d1 : new Set(diffKeys(ctl.after, a2.after));
      const stable = [...d1].filter((k) => d2.has(k));
      const flaky = [...new Set([...d1, ...d2])].filter((k) => !(d1.has(k) && d2.has(k)));
      row.unstable_paths = flaky.sort();
      const dh = b1 && !b1.refused && b1.delivered ? new Set(diffKeys(ctl.after, b1.after)) : null;
      // the union over both magnitudes, restricted to paths that survived the repeat
      const union = new Set(stable);
      if (dh) for (const k of dh) if (d1.has(k) || d2.has(k) || dh.has(k)) union.add(k);
      // ...but a hi-only path must also not be flaky at lo; keep hi paths only if the lo pair
      // agrees about them or the lo pair never saw them at all.
      for (const k of [...union]) if (flaky.includes(k)) union.delete(k);
      const sig = [...union].sort();
      row.signature_all = sig.join('|');
      row.signature_world = sig.filter((k) => !k.startsWith('m:')).join('|');
      row.signature_noward = sig.filter((k) => !k.startsWith('m:') && !k.startsWith('w:hit.')).join('|');
      row.moved_anything = sig.length > 0;
      row.n_paths = sig.length;

      if (row.binary_by_data) row.magnitude_coupling = 'N_A_BINARY';
      else if (!b1 || b1.refused) row.magnitude_coupling = 'HI_REFUSED';
      else if (!b1.delivered) row.magnitude_coupling = 'HI_NOT_DELIVERED';
      else {
        const differing = sig.filter((k) => JSON.stringify(a1.after[k]) !== JSON.stringify(b1.after[k]));
        row.magnitude_differing_paths = differing;
        row.magnitude_coupling = differing.length ? 'COUPLED' : 'MAGNITUDE_IGNORED';
      }
      rows.push(row);
    }

    const group = (field) => {
      const by = {};
      for (const r of rows) { if (!r[field]) continue; (by[r[field]] = by[r[field]] || []).push(r.effect); }
      return { distinct: Object.keys(by).length,
        collisions: Object.entries(by).filter(([, v]) => v.length > 1)
          .map(([sig, v]) => ({ effects: v, signature: sig.slice(0, 400) }))
          .sort((x, y) => y.effects.length - x.effects.length) };
    };
    const gA = group('signature_all'), gW = group('signature_world'), gN = group('signature_noward');
    return {
      schema: 'elder-souls/critic-w1-14-r3-census@1',
      practice: PRACTICE,
      skills_in_arena: (() => { arena(false); const sh = H.getSkillSheet();
        return { sorcery: sh.sorcery.value, 'root-speech': sh['root-speech'].value, warding: sh.warding.value, veiling: sh.veiling.value }; })(),
      control_integrity: {
        null_vs_null_empty_room_paths: nullDriftSelf,
        null_vs_null_aggroed_room_paths: nullDriftSelfE,
      },
      summary: {
        total: rows.length,
        not_castable: rows.filter((r) => r.class === 'NOT_CASTABLE').map((r) => ({ effect: r.effect, why: r.note })),
        not_delivered: rows.filter((r) => r.class === 'NOT_DELIVERED').map((r) => ({ effect: r.effect, why: r.note })),
        threw: rows.filter((r) => r.class === 'THREW').map((r) => ({ effect: r.effect, why: r.note })),
        moved_anything: rows.filter((r) => r.moved_anything).length,
        moved_nothing: rows.filter((r) => r.moved_anything === false).map((r) => r.effect),
        with_unstable_paths: rows.filter((r) => (r.unstable_paths || []).length).map((r) => ({ effect: r.effect, n: r.unstable_paths.length })),
        magnitude_ignored: rows.filter((r) => r.magnitude_coupling === 'MAGNITUDE_IGNORED').map((r) => r.effect),
        hi_refused: rows.filter((r) => r.magnitude_coupling === 'HI_REFUSED').map((r) => r.effect),
        hi_not_delivered: rows.filter((r) => r.magnitude_coupling === 'HI_NOT_DELIVERED').map((r) => r.effect),
        binary_by_data: rows.filter((r) => r.binary_by_data).map((r) => r.effect),
        DISTINCT_VERBS_all: gA.distinct,
        DISTINCT_VERBS_world: gW.distinct,
        DISTINCT_VERBS_world_no_wardprobe: gN.distinct,
        collisions_all: gA.collisions,
        collisions_world: gW.collisions,
      },
      rows, notes,
    };
  }, PRACTICE);
} finally { await handle.close(); }

const s = report.summary;
log(`practice=${report.practice} arena skills ${JSON.stringify(report.skills_in_arena)}`);
log(`null-vs-null drift: empty ${report.control_integrity.null_vs_null_empty_room_paths.length}, aggroed ${report.control_integrity.null_vs_null_aggroed_room_paths.length}`);
log(`moved_anything ${s.moved_anything}/${s.total}  not_castable ${s.not_castable.length}  not_delivered ${s.not_delivered.length}`);
log(`DISTINCT-VERBS  all ${s.DISTINCT_VERBS_all}/${s.total}   world ${s.DISTINCT_VERBS_world}/${s.total}   world-minus-wardprobe ${s.DISTINCT_VERBS_world_no_wardprobe}/${s.total}`);
log(`magnitude_ignored ${s.magnitude_ignored.length}: ${s.magnitude_ignored.join(', ')}`);
log(`unstable-path effects: ${s.with_unstable_paths.length}`);
for (const c of s.collisions_world) log(`  COLLISION(world) [${c.effects.join(', ')}]`);
const p = path.join(outDir, `census-${TAG}.json`);
writeJson(p, report);
console.log(p);
