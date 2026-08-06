#!/usr/bin/env node
// w1-14-r3-wards.mjs — the three round-2 findings that are not the skill register.
//
//   A. KIND-AWARE MITIGATION. RI-MAG06 §D. The round-2 critic measured a resist-DISEASE buff
//      taking a scripted physical 100 down to 15, and a physical shield cutting fire damage
//      from 405 to 5 identically to a resist-element ward. The read that could not tell them
//      apart was "damage taken from an identical scripted hit" — because both moved it. So the
//      read here is a MATRIX: every ward against every damage kind, and a ward is only
//      demonstrated when the hits it names are blunted AND the hits it does not name are not.
//
//   B. STATUS PROCS. Four of five were written and never read. For each, the consuming system
//      is named and then PERTURBED (ARBITRATION §3 / RI-MTH07): the proc is forced and an
//      entity's behaviour is watched changing.
//
//   C. S29. A commissioned LIGHT-class Recall took the critic 84.7 m out of a live fight.
//      Refused outright in combat and for 300 f after the last hostile action, and permitted
//      once the marsh is quiet — because a fence that never opens is a deletion, not a rule.
//
// Built to fail: `--break=kindblind` restores one shared multiplier, `--break=nofence` opens
// the travel gate. Both must turn the matrix and the fence red.
import path from 'node:path';
import { parseArgs, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const args = parseArgs();
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);
const breakMode = args.break ? String(args.break) : null;
const handle = await launchGame(args);
let R;
try {
  R = await handle.page.evaluate(async (BREAK) => {
    const H = window.__HARNESS; await H.ready();
    const out = { break_mode: BREAK };
    let skillsReached = null;
    const KINDS = ['physical', 'fire', 'frost', 'shock', 'poison', 'disease', 'magic'];

    const D = H.getMagicData();
    const shipped = D.spells.spells;
    const MAGE = { race: 'saxhleel', upbringing: 'interior', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' };

    // The arena. No `setMagicSkills` and no `setSkills` anywhere in this file (RI-MAG06 §E):
    // the character picks a mage class at the Writ House, then PRACTISES — `grantSkillUse` is
    // the same `cast_effective` grant a delivered cast emits, and `hearthRest` clears
    // RI-PRG03 §4's per-rest clamp. Both are things a player does.
    const arena = (opts) => {
      H.setSeed(31); H.loadState((opts && opts.state) || 'arena_flat'); H.setRenderRate(0);
      H.setCharacter((opts && opts.character) || MAGE);
      H.setWillpower(99); H.setCatalyst('great_staff'); H.setGold(5000000);
      for (const s of shipped) H.learnSpell(s.id);      // buying spells is legal and skill-free
      // practise until the schools are journeyman-grade, so a commissioned spell is attunable
      for (let i = 0; i < 900; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        H.hearthRest();
      }
      H.magicEventsDrain();
      return H.getSkills();
    };
    // Commission a spell and put it in the loadout. Returns its id, or throws with the reason.
    const commission = (spec, name) => {
      const m = H.makeSpell(spec, name);
      if (m.refused) throw new Error(`makeSpell(${name}) refused: ${m.gate} — ${m.reason}`);
      const at = H.setAttuned([m.spell.id]);
      if (!at.length) throw new Error(`setAttuned(${name}) refused: needs ${m.spell.skill_req}`);
      return m.spell.id;
    };

    // ================= A. the ward x damage-kind matrix =====================================
    // One row per ward, one column per damage kind. The control row is the same scripted hit
    // with nothing cast, so every cell is a treatment-against-control delta.
    {
      const WARDS = [
        { id: 'control', effects: null },
        { id: 'shield', effects: [{ effect: 'shield', magnitude: 20, duration_s: 60, area_r_m: 0 }] },
        { id: 'resist_element', effects: [{ effect: 'resist_element', magnitude: 20, duration_s: 60, area_r_m: 0 }] },
        { id: 'resist_disease', effects: [{ effect: 'resist_disease', magnitude: 20, duration_s: 60, area_r_m: 0 }] },
      ];
      const matrix = {};
      for (const w of WARDS) {
        matrix[w.id] = {};
        for (const kind of KINDS) {
          skillsReached = arena();
          if (w.effects) {
            const id = commission({ class: 'LIGHT', range: 'self', effects: w.effects }, `probe_${w.id}`);
            H.castNow(id);               // resolve it on the caster, no geometry involved
          }
          if (BREAK === 'kindblind') H.__breakKindBlindWards();
          const r = H.damagePlayer(100, { stagger: false, kind });
          matrix[w.id][kind] = r.applied;
        }
      }
      // A ward is DISTINGUISHABLE when the set of kinds it moves differs from every other ward's.
      const movedBy = {};
      for (const w of WARDS) {
        if (w.id === 'control') continue;
        movedBy[w.id] = KINDS.filter((k) => matrix[w.id][k] !== matrix.control[k]);
      }
      const sigs = Object.entries(movedBy).map(([k, v]) => [k, v.join('+')]);
      out.ward_matrix = {
        skills_reached_by_practice: skillsReached,
        matrix, moved_kinds: movedBy,
        distinct_signatures: new Set(sigs.map((s) => s[1])).size,
        wards_measured: sigs.length,
        // the exact two readings the round-2 verdict turned on
        resist_disease_vs_a_sword: { control: matrix.control.physical, warded: matrix.resist_disease.physical },
        shield_vs_fire: { control: matrix.control.fire, warded: matrix.shield.fire },
        resist_element_vs_fire: { control: matrix.control.fire, warded: matrix.resist_element.fire },
        shield_vs_a_sword: { control: matrix.control.physical, warded: matrix.shield.physical },
      };
    }

    // ================= A2. sap_ward is not a damage ward at all ==============================
    {
      // A non-Argonian, so there is a taint to lower at all. `arena()` already rested 900
      // times to practise, so the band is pinned at 4 — reload cleanly and count from zero.
      arena({ character: { race: 'dunmer', upbringing: 'foreign-born', class: 'sap-reader', birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' } });
      const sw = commission({ class: 'RITUAL', range: 'self', effects: [{ effect: 'sap_ward', magnitude: 1, duration_s: 0, area_r_m: 0 }] }, 'probe_sapward');
      H.resetSapTaint();
      const rests = [];
      for (let i = 0; i < 16; i++) rests.push(H.hearthRest().sap_taint.band);
      const bandAfterRests = rests[rests.length - 1];
      const dmgBefore = H.damagePlayer(100, { stagger: false, kind: 'physical' }).applied;
      const bandBeforeWard = H.hearthRest().sap_taint.band;
      const wardCast = H.castNow(sw);
      const afterOne = H.hearthRest().sap_taint;
      const dmgAfter = H.damagePlayer(100, { stagger: false, kind: 'physical' }).applied;
      const uses = [wardCast, H.castNow(sw), H.castNow(sw), H.castNow(sw)];   // the 4th must refuse
      out.sap_ward = {
        band_by_rest: rests, band_after_16_rests: bandAfterRests, band_before_ward: bandBeforeWard,
        band_after_one_ward: afterOne.band, ward_uses_left: afterOne.ward_uses_left,
        physical_damage_before: dmgBefore, physical_damage_after: dmgAfter,
        is_a_damage_ward: dmgBefore !== dmgAfter,
        four_uses: uses.map((u) => (u && u.cast ? 'cast' : (u && u.refused) || 'refused')),
        band_after_four_uses: H.hearthRest().sap_taint.band,
      };
    }

    // ================= B. the four unread status procs =======================================
    {
      const PROCS = [
        { kind: 'fire', proc: 'BURNING', consumer: 'hp' },
        { kind: 'poison', proc: 'POISONED', consumer: 'hp + heal denial' },
        { kind: 'frost', proc: 'FROSTBITE', consumer: 'stamina_max + stamina regen + move speed' },
        { kind: 'shock', proc: 'CONCUSSED', consumer: 'poise_health + poise regen' },
        { kind: 'paralysis', proc: 'PARALYSED', consumer: 'enemy state' },
      ];
      const rows = {};
      for (const P of PROCS) {
        // CONTROL: an identical enemy, identical frames, no buildup applied.
        const run = (applyBuildup) => {
          arena();
          H.spawn('inf_trash', 0, 3.0);
          const eid = H.getCombatState().enemies[0].id;
          const read = () => {
            const b = H.getStatus().find((x) => x.id === eid) || {};
            const e = H.getCombatState().enemies.find((x) => x.id === eid) || {};
            return { hp: b.hp, stamina_max: b.stamina_max, poise: b.poise_health, state: e.state, procs: b.procs || {} };
          };
          if (applyBuildup) H.addStatusBuildup(eid, P.kind, 200);
          const t0 = read();
          H.stepFrames(90);
          const t1 = read();
          return { t0, t1 };
        };
        const control = run(false);
        const treat = run(true);
        rows[P.proc] = {
          consumer: P.consumer,
          control: { hp: control.t0.hp + ' -> ' + control.t1.hp, stamina_max: control.t1.stamina_max, poise: control.t1.poise, state: control.t1.state },
          treatment: { hp: treat.t0.hp + ' -> ' + treat.t1.hp, stamina_max: treat.t1.stamina_max, poise: treat.t1.poise, state: treat.t1.state, procs: treat.t0.procs },
          hp_delta_control: +(control.t0.hp - control.t1.hp).toFixed(2),
          hp_delta_treatment: +(treat.t0.hp - treat.t1.hp).toFixed(2),
          stamina_max_differs: control.t1.stamina_max !== treat.t1.stamina_max,
          poise_differs: control.t1.poise !== treat.t1.poise,
          state_differs: control.t1.state !== treat.t1.state,
        };
        rows[P.proc].consumed = rows[P.proc].hp_delta_treatment !== rows[P.proc].hp_delta_control
          || rows[P.proc].stamina_max_differs || rows[P.proc].poise_differs || rows[P.proc].state_differs;
      }
      out.status_procs = rows;
      out.status_procs_consumed = Object.values(rows).filter((r) => r.consumed).length;
    }

    // ================= C. S29 — travel is not an escape button ================================
    {
      const effRecall = [{ effect: 'recall', magnitude: 45, duration_s: 0, area_r_m: 0 }];
      const effMark = [{ effect: 'mark', magnitude: 1, duration_s: 0, area_r_m: 0 }];
      const effInt = [{ effect: 'intervention', magnitude: 45, duration_s: 0, area_r_m: 0 }];

      // --- LIGHT-class Recall, exactly the spell the round-2 critic commissioned ------------
      arena();
      if (BREAK === 'nofence') H.__breakTravelFence();
      const recall = commission({ class: 'LIGHT', range: 'self', effects: effRecall }, 'probe_recall');
      const mark = commission({ class: 'LIGHT', range: 'self', effects: effMark }, 'probe_mark');
      H.castNow(mark);                                        // set the mark, out of combat
      H.teleport(60, 60);
      const posBeforeFight = H.getPlayerStats().pos.slice();
      H.spawn('inf_trash', 60, 62);                            // a hostile, 2 m from the player
      // Make it a FIGHT, not merely a proximity: S29's clock runs from the last hostile ACTION,
      // so there has to be one for the second half of the rule to be under test at all.
      const foe = H.getCombatState().enemies[0].id;
      H.queueEnemyScript(foe, [{ f: 2, move: 'chop' }]);
      H.stepFrames(30);
      const inFight = H.getWorldStats ? null : null;
      H.setAttuned([recall]);
      H.magicEventsDrain();
      const pressed = H.pressCast(60);                         // the real input path, not castNow
      const posAfterPress = H.getPlayerStats().pos.slice();
      const moved = Math.hypot(posAfterPress[0] - posBeforeFight[0], posAfterPress[2] - posBeforeFight[2]);

      // --- the fence opens once the marsh is quiet -------------------------------------------
      // A fence that never opens is a deletion, not a rule: S29 must be shown PERMITTING the
      // spell out of combat, or Recall has simply been removed and S7 broken instead.
      H.getCombatState().enemies.forEach((e) => H.despawn(e.id));
      H.stepFrames(60);
      H.hearthRest(); H.setAttuned([recall]);
      const midCooldown = H.pressCast(40);          // still inside the 300-frame clock
      const posMid = H.getPlayerStats().pos.slice();
      const movedMid = Math.hypot(posMid[0] - posBeforeFight[0], posMid[2] - posBeforeFight[2]);
      H.stepFrames(400);                            // let the clock run out
      H.hearthRest(); H.setAttuned([recall]);
      const afterCooldown = H.pressCast(120);
      const posAfter = H.getPlayerStats().pos.slice();
      const movedAfter = Math.hypot(posAfter[0] - posMid[0], posAfter[2] - posMid[2]);

      out.s29 = {
        spell: recall, cast_class: 'LIGHT',
        in_fight: {
          pos_before: posBeforeFight, pos_after: posAfterPress, metres_moved: +moved.toFixed(3),
          drops: pressed.drops, travel_refused: pressed.travel_refused,
        },
        mid_cooldown: { drops: midCooldown.drops, travel_refused: midCooldown.travel_refused, metres_moved: +movedMid.toFixed(3) },
        after_cooldown: { drops: afterCooldown.drops, pos: posAfter, metres_moved: +movedAfter.toFixed(3) },
        refused_in_fight: moved < 0.5,
        permitted_when_quiet: movedAfter > 1,
      };

      // --- and the other two travel effects, same fence ---------------------------------------
      const others = {};
      for (const [name, eff] of [['mark', effMark], ['intervention', effInt]]) {
        arena();
        if (BREAK === 'nofence') H.__breakTravelFence();
        commission({ class: 'LIGHT', range: 'self', effects: eff }, `probe_${name}2`);
        H.spawn('inf_trash', 0, 2.0); H.stepFrames(4);
        H.magicEventsDrain();
        const p = H.pressCast(60);
        others[name] = { drops: p.drops, travel_refused: p.travel_refused };
      }
      out.s29.other_travel_effects = others;
    }

    // ================= S27 — Focus comes back at the hearth and nowhere else ==================
    {
      arena();
      const f0 = H.getMagicState().focus;
      H.spawn('inf_trash', 0, 3.0);
      H.stepFrames(1200);                                   // 20 s of world, in and out of a fight
      const f1 = H.getMagicState().focus;
      H.getCombatState().enemies.forEach((e) => H.despawn(e.id));
      H.stepFrames(1800);                                   // 30 s of peace
      const f2 = H.getMagicState().focus;
      const spent = (() => {
        const id = commission({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 20, duration_s: 5, area_r_m: 0 }] }, 'probe_focus');
        H.castNow(id);
        return H.getMagicState().focus;
      })();
      H.stepFrames(3600);                                   // a minute of standing still
      const f3 = H.getMagicState().focus;
      const rested = H.hearthRest().focus;
      // The Dry Well: the one sign whose hearth rest does not restore Focus at all.
      arena({ character: { race: 'saxhleel', upbringing: 'interior', class: 'sap-reader', birthsign: 'nu-ixtu', given_name: 'Unwritten', sex: 'unrecorded' } });
      const dryBefore = H.getMagicState().focus;
      const dryId = commission({ class: 'LIGHT', range: 'self', effects: [{ effect: 'shield', magnitude: 20, duration_s: 5, area_r_m: 0 }] }, 'probe_focus_dry');
      H.castNow(dryId);
      const drySpent = H.getMagicState().focus;
      const dryRest = H.hearthRest();
      out.s27 = {
        focus_start: f0, after_1200f_in_fight: f1, after_1800f_of_peace: f2,
        after_a_cast: spent, after_3600f_standing_still: f3,
        regenerated_anywhere: (f1 > f0) || (f2 > f1) || (f3 > spent),
        hearth_rest_restores: rested,
        dry_well: { before: dryBefore, after_cast: drySpent, after_hearth_rest: dryRest.focus, restored: dryRest.focus_restored, why: dryRest.why },
      };
    }
    return out;
  }, breakMode);
} finally { await handle.close(); }

const tag = breakMode ? `-break-${breakMode}` : '';
writeJson(path.join(outDir, `wards${tag}.json`), R);
if (R.ward_matrix) {
  log('WARD x KIND matrix (identical scripted 100-damage hit):');
  const kinds = Object.keys(R.ward_matrix.matrix.control);
  log('  ' + 'ward'.padEnd(16) + kinds.map((k) => k.padStart(9)).join(''));
  for (const [w, row] of Object.entries(R.ward_matrix.matrix)) {
    log('  ' + w.padEnd(16) + kinds.map((k) => String(row[k]).padStart(9)).join(''));
  }
  log('  moved_kinds', JSON.stringify(R.ward_matrix.moved_kinds));
  log('  distinct ward signatures', R.ward_matrix.distinct_signatures + '/' + R.ward_matrix.wards_measured);
}
if (R.sap_ward) log('sap_ward', JSON.stringify(R.sap_ward));
if (R.status_procs) {
  log('STATUS PROCS consumed:', R.status_procs_consumed + '/5');
  for (const [k, v] of Object.entries(R.status_procs)) log('  ' + k.padEnd(11), JSON.stringify({ consumed: v.consumed, consumer: v.consumer, hp_c: v.hp_delta_control, hp_t: v.hp_delta_treatment, stam: v.stamina_max_differs, poise: v.poise_differs, state: v.state_differs }));
}
if (R.s29) log('S29', JSON.stringify(R.s29, null, 0));
if (R.s27) log('S27', JSON.stringify(R.s27));
console.log(path.join(outDir, `wards${tag}.json`));
