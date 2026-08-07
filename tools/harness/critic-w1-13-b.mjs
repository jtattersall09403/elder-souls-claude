#!/usr/bin/env node
/**
 * critic-w1-13-b.mjs — W1-13 round-1 critic, probe B: TRY TO LOSE SOULS, AND TRY TO BREAK S5.
 *
 * Written by the critic under `orchestration/TOOL-LOOP.md` rule 1 and declared under
 * `method_deviations`. It does not re-run the builder's checks; it attacks them.
 *
 * SOUL-LOSS ATTACKS (each one is a way the loop could destroy souls that no rule permits):
 *   B1  die twice in quick succession — a second lethal hit while the surface is still up
 *   B2  die with a respawn point that does not resolve (a save naming a hearth id that is
 *       not in hearths.json — `game/data/states/sv5-journal-bloodstain.json` does exactly this)
 *   B3  die in water
 *   B4  die falling
 *   B5  die on the frame of a hearth rest
 *   B6  die having never rested at all
 *
 * S5 ATTACKS (the named-NPC guarantee, attacked rather than demonstrated):
 *   N1  what is actually IN `sim.entities` in the shipped province — is any real merchant,
 *       trainer or quest actor at risk from respawn logic at all, or is the guarantee free?
 *   N2  a REST (not a death) after killing named actors — `hearthRest` calls the same
 *       `respawnOrdinary`, and the builder's evidence is all on the death path
 *   N3  an ordinary-tier entity spawned with each never-respawn flag in turn, killed, rested
 *   N4  the fail-open probe: an entity of a respawning tier with NO flag at all must come back,
 *       so that N3's "did not come back" means something
 *
 * Everything is read off the live world (`getDeathState`, `snapshot`), never off a data file.
 */
import { launchGame } from '../lib/browser.mjs';
import { parseArgs, wantsHelp, usage, log, writeJson } from '../lib/cli.mjs';

const USAGE = `critic-w1-13-b.mjs — soul-loss and S5 attacks. [--out <file>]`;
const args = parseArgs(process.argv.slice(2));
if (wantsHelp(args)) { usage(USAGE); process.exit(0); }

const out = { schema: 'critic/w1-13-b@1', soul_loss: [], s5: [], notes: [] };
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
  return (await h.h('getDeathState')).souls_held;
}
/** Walk onto whatever bloom exists and report what the purse holds afterwards. */
async function collect(h) {
  const d = await h.h('getDeathState');
  if (!d.bloodstain) return { bloom: null, souls_held: d.souls_held };
  await h.h('teleport', d.bloodstain.pos[0], d.bloodstain.pos[2]);
  await h.h('stepFrames', 4);
  const e = await h.h('getDeathState');
  return { bloom_pos: d.bloodstain.pos, bloom_souls: d.bloodstain.souls, souls_held: e.souls_held, bloom_after: e.bloodstain_count };
}

try {
  handle = await launchGame({ ...args, width: 640, height: 400 });
  const h = handle;
  await h.h('setRenderRate', 0);

  // ============================ SOUL-LOSS ATTACKS ==========================================

  // B1 — a second lethal hit while the death surface is still up.
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    await h.h('teleport', w.pos[0] + 40, w.pos[2] + 40);
    await h.h('stepFrames', 3);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    const mid = await h.h('getDeathState');
    // hit the corpse again, twice, while the surface is up
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    const mid2 = await h.h('getDeathState');
    await h.h('stepFrames', 220);
    const woke = await h.h('getDeathState');
    const got = await collect(h);
    out.soul_loss.push({
      id: 'B1_double_hit_during_surface',
      bloom_on_surface: mid.bloodstain ? mid.bloodstain.souls : null,
      bloom_after_two_more_hits: mid2.bloodstain ? mid2.bloodstain.souls : null,
      deaths_this_session: woke.deaths_this_session,
      stains_lost: woke.stains_lost_to_second_death,
      recovered: got.souls_held,
      pass: got.souls_held === SOULS && woke.deaths_this_session === 1,
    });
  }

  // B2 — a respawn point that does not resolve. `hearthLastRested` is a free-form string in
  // the save and `game/data/states/sv5-journal-bloodstain.json` ships two ids that are not in
  // `hearths.json`. What does a death do then?
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    const b = await h.h('saveState');
    b.character.souls_held = SOULS;
    b.progression.hearth_last_rested = 'hearth-thorn';   // an id that does not exist
    await h.h('restoreState', b);
    await h.h('stepFrames', 1);
    const before = await h.h('getDeathState');
    const p0 = (await h.h('snapshot')).player.pos;
    await h.h('teleport', w.pos[0] + 40, w.pos[2] + 40);
    await h.h('stepFrames', 3);
    const deathPos = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 220);
    const woke = await h.h('getDeathState');
    const respawnPos = (await h.h('snapshot')).player.pos;
    const moved = Math.hypot(respawnPos[0] - deathPos[0], respawnPos[2] - deathPos[2]);
    const d2 = await h.h('getDeathState');
    // did the player pick the bloom straight back up without moving?
    const distToBloom = d2.bloodstain
      ? Math.hypot(d2.bloodstain.pos[0] - respawnPos[0], d2.bloodstain.pos[2] - respawnPos[2]) : null;
    await h.h('stepFrames', 5);
    const d3 = await h.h('getDeathState');
    out.soul_loss.push({
      id: 'B2_unresolvable_respawn_point',
      hearth_last_rested_before: before.hearth_last_rested,
      hearth_last_rested_after: woke.hearth_last_rested,
      respawn_hearth_reported: woke.last_respawn ? woke.last_respawn.at : null,
      death_pos: deathPos, respawn_pos: respawnPos,
      respawn_moved_m: +moved.toFixed(2),
      dist_respawn_to_bloom_m: distToBloom === null ? null : +distToBloom.toFixed(2),
      souls_held_5_frames_after_respawn: d3.souls_held,
      bloom_after_5_frames: d3.bloodstain_count,
      // D6: the respawn is the last HEARTH rested at. Standing back up on your own corpse and
      // drinking your own tithe is a death that costs nothing at all.
      death_was_free: d3.souls_held === SOULS,
      pass: moved > 5 && d3.souls_held === 0,
      _p0: p0,
    });
  }

  // B3 — die in water. `lastGrounded` drives the fall/hazard rule; if it is stale the bloom
  // lands wherever the body last stood on land, which may be far from the death point.
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    // find water: sweep out from the well for a cell the traversal model calls deep
    let wet = null;
    const list = await h.h('listHearths');
    for (let r = 60; r <= 400 && !wet; r += 40) {
      for (let a = 0; a < 24 && !wet; a++) {
        const th = (a / 24) * Math.PI * 2;
        const x = w.pos[0] + Math.cos(th) * r, z = w.pos[2] + Math.sin(th) * r;
        await h.h('teleport', x, z);
        await h.h('stepFrames', 3);
        const s = await h.h('snapshot');
        const depth = (s.player.waterDepth !== undefined ? s.player.waterDepth : (s.traversal && s.traversal.waterDepth));
        const band = s.player.waterBand || (s.traversal && s.traversal.waterBand);
        if ((depth !== undefined && depth > 1.3) || band === 'W4' || band === 'W5') wet = { x, z, depth, band };
      }
    }
    if (!wet) { out.soul_loss.push({ id: 'B3_die_in_water', skipped: 'no water band W4/W5 found within 400 m of hearth-archon' }); }
    else {
      const deathPos = (await h.h('snapshot')).player.pos;
      await h.h('damagePlayer', 100000, { stagger: false });
      await h.h('stepFrames', 1);
      await h.h('stepFrames', 220);
      const d = await h.h('getDeathState');
      const rec = d.deaths[d.deaths.length - 1];
      const got = await collect(h);
      out.soul_loss.push({
        id: 'B3_die_in_water', water: wet, death_pos: deathPos,
        placement_rule: rec.placement_rule, stain_offset_m: rec.stain_offset_m,
        stain_pos: rec.stain_pos, cause: rec.cause,
        recovered: got.souls_held,
        pass: got.souls_held === SOULS,
        within_2m: rec.stain_offset_m <= 2.0,
      });
    }
  }

  // B4 — die falling. D3's fall rule puts the bloom at the last grounded position.
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    await h.h('teleport', w.pos[0] + 30, w.pos[2] + 30);
    await h.h('stepFrames', 3);
    const grounded = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 100000, { stagger: false, cause: 'fall' });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 220);
    const d = await h.h('getDeathState');
    const rec = d.deaths[d.deaths.length - 1];
    const got = await collect(h);
    out.soul_loss.push({
      id: 'B4_die_falling', grounded_pos: grounded, cause: rec.cause,
      placement_rule: rec.placement_rule, stain_offset_m: rec.stain_offset_m,
      recovered: got.souls_held, pass: got.souls_held === SOULS,
    });
  }

  // B5 — die on the frame of a hearth rest.
  {
    await h.h('loadState', 'default');
    const w = await restAtWell(h, 'hearth-archon');
    await bank(h, SOULS);
    await h.h('damagePlayer', 100000, { stagger: false });
    const rest = await h.h('restAt', w.id);       // rest with HP already at 0, before the tick
    await h.h('stepFrames', 1);
    const mid = await h.h('getDeathState');
    await h.h('stepFrames', 220);
    const d = await h.h('getDeathState');
    const got = await collect(h);
    out.soul_loss.push({
      id: 'B5_die_during_hearth_rest',
      rest_hp: rest.hp,
      surface_went_up: mid.surface_active,
      deaths_this_session: d.deaths_this_session,
      bloom: d.bloodstain ? d.bloodstain.souls : null,
      recovered: got.souls_held,
      // If the rest healed the corpse before `_deathTick` ran, no death happened at all and
      // the souls were never at risk. Either outcome is legal; losing them is not.
      pass: got.souls_held === SOULS,
    });
  }

  // B6 — die having never rested at all.
  {
    await h.h('loadState', 'default');
    const b = await h.h('saveState');
    b.character.souls_held = SOULS;
    b.progression.hearth_last_rested = null;
    await h.h('restoreState', b);
    await h.h('stepFrames', 2);
    const before = await h.h('getDeathState');
    const deathPos = (await h.h('snapshot')).player.pos;
    await h.h('damagePlayer', 100000, { stagger: false });
    await h.h('stepFrames', 1);
    await h.h('stepFrames', 220);
    const after = await h.h('getDeathState');
    const respawnPos = (await h.h('snapshot')).player.pos;
    await h.h('stepFrames', 5);
    const d3 = await h.h('getDeathState');
    out.soul_loss.push({
      id: 'B6_never_rested',
      hearth_last_rested: before.hearth_last_rested,
      respawn_hearth: after.last_respawn ? after.last_respawn.at : null,
      respawn_moved_m: +Math.hypot(respawnPos[0] - deathPos[0], respawnPos[2] - deathPos[2]).toFixed(2),
      souls_held_after: d3.souls_held,
      death_was_free: d3.souls_held === SOULS,
    });
  }

  // ============================ S5 ATTACKS =================================================

  // N1 — what is actually at risk? Enumerate the province's live entity roster by archetype
  // and tier, and count how many real merchants / trainers / quest actors are IN `sim.entities`.
  {
    await h.h('loadState', 'default');
    await h.h('stepFrames', 3);
    const d = await h.h('getDeathState');
    const scope = d.respawn_scope || [];
    const byTier = {}, byArch = {};
    for (const e of scope) {
      byTier[e.tier || 'none'] = (byTier[e.tier || 'none'] || 0) + 1;
      byArch[e.archetype || 'none'] = (byArch[e.archetype || 'none'] || 0) + 1;
    }
    const snap = await h.h('snapshot');
    out.s5.push({
      id: 'N1_who_is_at_risk_in_the_shipped_province',
      entities_total: scope.length,
      respawning: scope.filter((e) => e.respawns).length,
      never_respawning: scope.filter((e) => !e.respawns).length,
      by_tier: byTier, by_archetype: byArch,
      entities_carrying_a_never_respawn_flag: scope.filter((e) => e.flags && e.flags.length).length,
      npcs_in_sim_npcs: snap.npcs ? snap.npcs.length : (snap.world && snap.world.npcs ? snap.world.npcs.length : null),
      _note: 'sim.npcs is a different array from sim.entities. If every merchant and quest actor '
        + 'lives there, no respawn code path can reach them and the S5 guarantee costs nothing '
        + 'to keep — which is a good design and weak evidence.',
    });
  }

  // N2/N3/N4 — spawn a roster, kill it, and try BOTH triggers (rest and death).
  {
    for (const trigger of ['rest', 'death']) {
      await h.h('loadState', 'default');
      const w = await restAtWell(h, 'hearth-archon');
      await h.h('teleport', w.pos[0] + 25, w.pos[2] + 25);
      await h.h('stepFrames', 2);
      const p = (await h.h('snapshot')).player.pos;
      const spawnIds = [];
      const roster = [
        { tag: 'plain_trash', opts: {} },
        { tag: 'flag_named', opts: { named: true } },
        { tag: 'flag_merchant', opts: { merchant: true } },
        { tag: 'flag_questActor', opts: { questActor: true } },
        { tag: 'flag_boss', opts: { boss: true } },
        { tag: 'flag_trainer', opts: { trainer: true } },
        { tag: 'flag_unique', opts: { unique: true } },
      ];
      // Which archetype ids exist? Ask the build rather than guess.
      // `inf_trash` is a declared ordinary archetype in game/data/combat/enemies/*.json.
      const archId = 'inf_trash';
      // TWO ROUTES TO THE SAME FLAG, and the difference between them is the point.
      //  * `via_spawn_opts` is the route `game/data/world/respawn.json` documents:
      //    "Set per SPAWN (engine.spawn(id, x, z, {named: true}))".
      //  * `via_harness_verb` is `__HARNESS.setEntityNamed()`, which is what the builder's own
      //    M-D5 fixture uses. RI-MTH07 method 3 (the hand-feed audit) asks whether the rule is
      //    reachable WITHOUT a critic telling the engine what it should have observed.
      for (let i = 0; i < roster.length; i++) {
        const r = roster[i];
        for (const route of ['via_spawn_opts', 'via_harness_verb']) {
          const th = ((i * 2 + (route === 'via_spawn_opts' ? 0 : 1)) / (roster.length * 2)) * Math.PI * 2;
          const as = `${r.tag}__${route}`;
          try {
            await h.h('spawn', archId, p[0] + Math.cos(th) * 7, p[2] + Math.sin(th) * 7,
              route === 'via_spawn_opts' ? { as, ...r.opts } : { as });
            if (route === 'via_harness_verb' && Object.keys(r.opts).length) {
              await h.h('setEntityNamed', as, r.opts);
            }
            spawnIds.push({ tag: r.tag, route, eid: as });
          } catch (e) { spawnIds.push({ tag: r.tag, route, error: String(e.message || e).slice(0, 160) }); }
        }
      }
      await h.h('stepFrames', 2);
      // kill them all
      const pre = (await h.h('getDeathState')).respawn_scope;
      for (const s of spawnIds) if (s.eid) { try { await h.h('killEntity', s.eid); } catch { /* */ } }
      await h.h('stepFrames', 2);
      const killed = (await h.h('getDeathState')).respawn_scope.filter((e) => spawnIds.some((s) => s.eid === e.eid));
      if (trigger === 'rest') {
        await h.h('teleport', w.pos[0], w.pos[2]);
        await h.h('stepFrames', 2);
        await h.h('restAt', w.id);
        await h.h('stepFrames', 2);
      } else {
        await h.h('damagePlayer', 100000, { stagger: false });
        await h.h('stepFrames', 1);
        await h.h('stepFrames', 220);
      }
      const post = (await h.h('getDeathState')).respawn_scope;
      const rows = spawnIds.map((s) => {
        const b = killed.find((e) => e.eid === s.eid);
        const a = post.find((e) => e.eid === s.eid);
        return {
          tag: s.tag, route: s.route, eid: s.eid, error: s.error || null,
          classified_respawns: b ? b.respawns : (a ? a.respawns : null),
          alive_after_kill: b ? b.alive : null,
          alive_after_trigger: a ? a.alive : null,
          stood_back_up: !!(b && b.alive === false && a && a.alive === true),
        };
      });
      out.s5.push({
        id: `N_roster_${trigger}`, trigger, archetype_used: archId,
        pre_count: pre.length, rows,
        ordinary_came_back: rows.filter((r) => r.tag === 'plain_trash' && r.stood_back_up).length,
        protected_that_stood_back_up: rows.filter((r) => r.tag !== 'plain_trash' && r.stood_back_up).map((r) => `${r.tag}/${r.route}`),
        // The hand-feed audit, stated as a number: how many flags are honoured when set the
        // way the DATA FILE says they are set, versus only when a harness verb sets them.
        flags_honoured_via_spawn_opts: rows.filter((r) => r.tag !== 'plain_trash' && r.route === 'via_spawn_opts' && r.classified_respawns === false).map((r) => r.tag),
        flags_honoured_via_harness_verb: rows.filter((r) => r.tag !== 'plain_trash' && r.route === 'via_harness_verb' && r.classified_respawns === false).map((r) => r.tag),
      });
    }
  }

  out.page_errors = handle.errors.slice(0, 10);
  if (args.out) writeJson(args.out, out); else console.log(JSON.stringify(out, null, 1));
  for (const t of out.soul_loss) log(`${t.id}: ${JSON.stringify({ pass: t.pass, recovered: t.recovered, free: t.death_was_free, skipped: t.skipped })}`);
  for (const t of out.s5) log(`${t.id}: ${JSON.stringify({ back: t.protected_that_stood_back_up, ordinary: t.ordinary_came_back, n: t.entities_total })}`);
} catch (e) {
  out.error = String(e && e.stack || e);
  if (args.out) writeJson(args.out, out);
  log('critic-w1-13-b: ' + out.error);
  process.exitCode = 2;
} finally {
  try { await handle?.close?.(); } catch { /* ignore */ }
}
