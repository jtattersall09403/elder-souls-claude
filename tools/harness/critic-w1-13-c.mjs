#!/usr/bin/env node
/**
 * critic-w1-13-c.mjs — W1-13 round-1 critic, probe C: THE PLACEMENT RULES NOBODY DROVE.
 *
 * `DeathSystem.placeStain()` has four branches. The builder's 20-death session reports
 * `placement_rule: death_point` for all twenty and a stain offset of 0.000 m on every one,
 * because every death was taken on flat standable ground reached by `teleport`. Three of the
 * four branches were therefore never executed by a death the world produced.
 *
 * `RI-PRG04` §6 makes two of them binding, in words:
 *   "Falling / instant-death hazards: bloodstain is placed at the LAST GROUNDED POSITION
 *    before the fall, not at the bottom."
 *   "Death inside a boss arena: bloodstain is placed OUTSIDE the fog gate."
 *
 * `DeathSystem._inferCause()` is the only supplier of `cause`, so this probe drives real falls
 * and real drownings through the traversal model and asks what rule actually fired.
 *
 * C1  fall death   — drop the body from height onto ground that kills it
 * C2  drown death  — hold the body under until the breath clock runs out
 * C3  arena death  — die inside a declared fog-gate volume
 * C4  souls conservation, INCLUDING the doubled deaths the builder's M-D1 filters out
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage('critic-w1-13-c.mjs [--out <file>]'); process.exit(0); }

const out = { schema: 'critic/w1-13-c@1', placement: [], conservation: null, notes: [] };
let handle;
const SOULS = 4200;

async function restAtWell(h, id) {
  const list = await h.h('listHearths');
  const w = list.hearths.find((x) => x.id === id) || list.hearths[0];
  await h.h('teleport', w.pos[0], w.pos[2]);
  await h.h('stepFrames', 2);
  await h.h('restAt', w.id);
  return w;
}
async function bank(h, souls) {
  const b = await h.h('saveState');
  b.character.souls_held = souls;
  await h.h('restoreState', b);
  await h.h('stepFrames', 1);
}

try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ---- C1: a REAL fall death -------------------------------------------------------------
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    // stand on solid ground; this is the position RI-PRG04 §6 says the bloom must land on
    await h.h('teleport', w.pos[0] + 30, w.pos[2] + 30);
    await h.h('stepFrames', 6);
    const ledge = (await h.h('snapshot')).player.pos.slice();
    // lift the body high above the same column and let the traversal model drop it
    await h.h('teleport', w.pos[0] + 30, w.pos[2] + 30, { y: ledge[1] + 90 });
    let landed = null, frames = 0;
    for (let i = 0; i < 400 && !landed; i++) {
      await h.h('stepFrames', 1); frames++;
      const s = await h.h('snapshot');
      if (s.player.hp <= 0) landed = s.player.pos.slice();
    }
    const dstate0 = await h.h('getDeathState');
    await h.h('stepFrames', 220);
    const d = await h.h('getDeathState');
    const rec = d.deaths.length ? d.deaths[d.deaths.length - 1] : null;
    const t = {
      id: 'C1_real_fall_death',
      ledge_pos: ledge, hp0_pos: landed, frames_to_hp0: frames,
      died: !!rec,
      cause_recorded: rec ? rec.cause : null,
      placement_rule: rec ? rec.placement_rule : null,
      death_pos: rec ? rec.death_pos : null,
      stain_pos: rec ? rec.stain_pos : null,
      stain_offset_from_death_point_m: rec ? rec.stain_offset_m : null,
      // The number RI-PRG04 §6 actually constrains: how far the bloom is from the ledge the
      // body last stood on. `last_grounded` is the rule; `death_point` is not.
      stain_offset_from_last_grounded_m: rec
        ? +Math.hypot(rec.stain_pos[0] - ledge[0], rec.stain_pos[2] - ledge[2]).toFixed(3) : null,
      surface_up_before_step: dstate0.surface_active,
      expected_rule: 'last_grounded',
      pass: !!rec && rec.placement_rule === 'last_grounded',
    };
    out.placement.push(t);
    log(`C1 fall: cause=${t.cause_recorded} rule=${t.placement_rule} (expected last_grounded) -> ${t.pass ? 'PASS' : 'FAIL'}`);
  }

  // ---- C2: a REAL drown death -------------------------------------------------------------
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    // find deep water by asking the traversal model, not by guessing
    let wet = null, dry = null;
    for (let r = 40; r <= 600 && !wet; r += 30) {
      for (let a = 0; a < 24 && !wet; a++) {
        const th = (a / 24) * Math.PI * 2;
        const x = w.pos[0] + Math.cos(th) * r, z = w.pos[2] + Math.sin(th) * r;
        await h.h('teleport', x, z);
        await h.h('stepFrames', 3);
        const s = await h.h('snapshot');
        const tv = s.traversal || s.player;
        const band = tv.waterBand || tv.water_band;
        const depth = tv.waterDepth !== undefined ? tv.waterDepth : tv.water_depth_m;
        if (band && (band === 'W4' || band === 'W5')) wet = { x, z, band, depth };
        else if (!dry && (!band || band === 'W0')) dry = { x, z };
      }
    }
    if (!wet) {
      out.placement.push({ id: 'C2_real_drown_death', skipped: 'no W4/W5 water within 600 m of hearth-archon' });
      log('C2 drown: skipped (no deep water found)');
    } else {
      if (dry) { await h.h('teleport', dry.x, dry.z); await h.h('stepFrames', 6); }
      const lastLand = (await h.h('snapshot')).player.pos.slice();
      await h.h('teleport', wet.x, wet.z);
      let dead = false, fr = 0;
      for (let i = 0; i < 4000 && !dead; i += 30) { await h.h('stepFrames', 30); fr += 30; dead = (await h.h('snapshot')).player.hp <= 0; }
      const d0 = await h.h('getDeathState');
      await h.h('stepFrames', 220);
      const d = await h.h('getDeathState');
      const rec = d.deaths.length ? d.deaths[d.deaths.length - 1] : null;
      const t = {
        id: 'C2_real_drown_death', water: wet, last_land_pos: lastLand, frames_to_hp0: fr,
        drowned: dead, died: !!rec,
        cause_recorded: rec ? rec.cause : null,
        placement_rule: rec ? rec.placement_rule : null,
        stain_pos: rec ? rec.stain_pos : null,
        stain_offset_m: rec ? rec.stain_offset_m : null,
        surface_up: d0.surface_active,
        // `placeStain` tests `cause === 'drown'`; `_inferCause` can only ever return
        // 'fall' | 'hazard' | 'combat'. If this row reads 'combat' the branch is dead code.
        expected_rule: 'last_grounded',
        pass: !!rec && rec.placement_rule === 'last_grounded',
      };
      out.placement.push(t);
      log(`C2 drown: drowned=${dead} cause=${t.cause_recorded} rule=${t.placement_rule} -> ${t.pass ? 'PASS' : 'FAIL'}`);
    }
  }

  // ---- C3: death inside a boss arena -------------------------------------------------------
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    const list = await h.h('listHearths');
    const gate = list.fog_gates && list.fog_gates[0];
    if (!gate) { out.placement.push({ id: 'C3_death_in_boss_arena', skipped: 'no fog gates declared' }); }
    else {
      await h.h('teleport', gate.pos[0], gate.pos[2]);
      await h.h('stepFrames', 6);
      const inside = (await h.h('snapshot')).player.pos.slice();
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 220);
      const d = await h.h('getDeathState');
      const rec = d.deaths[d.deaths.length - 1];
      const dOut = Math.hypot(rec.stain_pos[0] - gate.pos[0], rec.stain_pos[2] - gate.pos[2]);
      const t = {
        id: 'C3_death_in_boss_arena', gate: { id: gate.id, pos: gate.pos, radius_m: gate.radius_m },
        death_pos: inside, placement_rule: rec.placement_rule, stain_pos: rec.stain_pos,
        stain_dist_from_gate_centre_m: +dOut.toFixed(2),
        outside_the_gate: dOut > (gate.radius_m || 26),
        pass: rec.placement_rule === 'outside_fog_gate' && dOut > (gate.radius_m || 26),
      };
      out.placement.push(t);
      log(`C3 arena: rule=${t.placement_rule} stain ${t.stain_dist_from_gate_centre_m} m from centre (r=${gate.radius_m}) -> ${t.pass ? 'PASS' : 'FAIL'}`);
    }
  }

  // ---- C4: souls conservation, EVERY death, including the doubled ones ---------------------
  // The builder's M-D1 does `rows.filter(r => !r.second_death)` and reports 14/14. Two of the
  // three legs — banked == held and held == stored — are checkable on a doubled death too, and
  // dropping the row drops them with the third.
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    const rows = [];
    for (let i = 0; i < 12; i++) {
      const souls = 313 + i * 421;
      await h.h('teleport', w.pos[0], w.pos[2]);
      await h.h('stepFrames', 2);
      await h.h('restAt', w.id);
      await bank(h, souls);
      const th = (i / 12) * Math.PI * 2;
      await h.h('teleport', w.pos[0] + Math.cos(th) * 55, w.pos[2] + Math.sin(th) * 55);
      await h.h('stepFrames', 4);
      const held = (await h.h('getDeathState')).souls_held;
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 220);
      const d1 = await h.h('getDeathState');
      const rec = d1.deaths[d1.deaths.length - 1];
      const doubled = i % 3 === 2;
      let secondBloomSouls = null, firstDestroyed = null;
      if (doubled) {
        const stainBefore = d1.bloodstain ? d1.bloodstain.souls : null;
        await h.h('damagePlayer', 100000, { stagger: false });
        await h.h('stepFrames', 1);
        await h.h('stepFrames', 220);
        const d2 = await h.h('getDeathState');
        secondBloomSouls = d2.bloodstain ? d2.bloodstain.souls : null;
        firstDestroyed = stainBefore !== null && secondBloomSouls === 0;
      }
      // recover whatever is on the ground
      const st = (await h.h('getDeathState')).bloodstain;
      let returned = 0;
      if (st) {
        await h.h('teleport', st.pos[0], st.pos[2]);
        await h.h('stepFrames', 4);
        const dr = await h.h('getDeathState');
        returned = dr.last_recovery ? dr.last_recovery.souls : 0;
      }
      rows.push({
        i, doubled, banked: souls, held_at_death: held,
        stored_in_bloom: rec.souls_in_stain,
        second_bloom_souls: secondBloomSouls, first_destroyed: firstDestroyed,
        returned,
        leg1_banked_eq_held: souls === held,
        leg2_held_eq_stored: held === rec.souls_in_stain,
        // On a doubled death the item's own D16 says the first bloom is gone forever, so
        // `returned` is legitimately 0. Leg 3 is only meaningful on a single death.
        leg3_stored_eq_returned: doubled ? null : rec.souls_in_stain === returned,
      });
    }
    const l1 = rows.filter((r) => !r.leg1_banked_eq_held);
    const l2 = rows.filter((r) => !r.leg2_held_eq_stored);
    const l3 = rows.filter((r) => r.leg3_stored_eq_returned === false);
    out.conservation = {
      deaths: rows.length,
      doubled: rows.filter((r) => r.doubled).length,
      leg1_banked_eq_held: `${rows.length - l1.length}/${rows.length}`,
      leg2_held_eq_stored: `${rows.length - l2.length}/${rows.length}`,
      leg3_stored_eq_returned: `${rows.filter((r) => r.leg3_stored_eq_returned === true).length}/${rows.filter((r) => r.leg3_stored_eq_returned !== null).length}`,
      first_bloom_destroyed_on_every_double: rows.filter((r) => r.doubled).every((r) => r.first_destroyed === true),
      mismatches: [...l1, ...l2, ...l3].slice(0, 5),
      rows,
      pass: !l1.length && !l2.length && !l3.length,
    };
    log(`C4 conservation over ${rows.length} deaths (${out.conservation.doubled} doubled): leg1 ${out.conservation.leg1_banked_eq_held}, leg2 ${out.conservation.leg2_held_eq_stored}, leg3 ${out.conservation.leg3_stored_eq_returned}`);
  }

  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
} catch (e) {
  out.error = String(e && e.stack || e);
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-c: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}
