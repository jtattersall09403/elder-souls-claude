#!/usr/bin/env node
// W1-12's BROWSER half — the claims `ai-probe.mjs` is not allowed to make.
//
// `tools/lib/combat-node.mjs` runs the combat modules in bare Node about 500x faster and it is
// the right instrument for frame geometry. It is the WRONG instrument for everything on this
// page, and the reason is one line in its own scope: **it runs no stealth perception.** The
// alert meter is filled by `sim/stealth/system.js::stepPerception()`, which lives outside the
// combat modules, so in the arena an enemy's `alertState` is whatever the probe assigned it.
// Every check about how an enemy NOTICES you is therefore unmeasurable there, and `ai-probe.mjs`
// scores RI-AI01 M1 and M2 as a fail-closed 0 with `browser_required: true` rather than
// computing them off a meter it set itself.
//
// This tool measures, in the shipping game:
//
//   B1  the souls AI steers in the real engine as it does in the arena (the arena's own header
//       says that if the two disagree, the disagreement is a defect in the arena and the
//       browser wins). Same seed, same fixture, same nine numbers, diffed.
//   B2  RI-AI01 M1 — acquisition geometry. Eight bearings x four radii, a real player, real
//       perception. PASS needs the acquisition set NOT to be a circle.
//   B3  RI-AI01 M2 — the alert ladder: SUSPICIOUS for >= 30 f before AGGRO.
//   B4  the wilderness sight-cone gate this piece added to `character/encounter.js`, measured
//       from BEHIND a sentry — which before this piece aggroed anyway, from four metres beyond
//       its own sight radius, through geometry, in the dark.
//   B5  CONSUMPTION (RI-MTH07 / ARBITRATION §3): perturb `game/data/combat/ai.json` and watch
//       an entity in the running world change behaviour. Not a field census — a live ablation.
//
// RULE 8 is enforced here the same way it is in the arena: the player MOVES. A fixture in which
// the player stands still cannot tell a spacing loop from a beeline, because both end up
// standing in front of a statue.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
ai-browser.mjs — W1-12, the claims bare Node may not make.

  --probe <name|all>  b1 b2 b3 b4 b5
  --out <path>        default reports/w1-12/ai-browser.json
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const which = String(args.probe || 'all');
const ALL = ['b1', 'b2', 'b3', 'b4', 'b5'];
const run = which === 'all' ? ALL : which.split(',');

const handle = await launchGame(args);
await handle.hOpt('setRenderRate', 0);
await requireMethods(handle, ['setSeed', 'stepFrames', 'spawn', 'despawn', 'listEntities',
  'teleport', 'getCombatState', 'aggro', 'perceptionState', 'snapshot', 'spawnEncounter']);

const PROBES = {

  // ---- B1: does the real engine steer the way the arena said it does? ---------------------
  b1() {
    const H = window.__HARNESS;
    H.setSeed(1337);
    for (const e of H.listEntities()) { try { H.despawn(e.eid); } catch { /* */ } }
    H.teleport(0, 0);
    H.spawn('inf_trash', 0, 12, { as: 'ai_b1' });
    const rows = [];
    // 1,200 frames rather than the arena's 3,600. The tree was carrying 30-48 concurrent
    // headless browsers for the whole of this piece's browser window and never dropped below
    // 30; this is one browser, kept for the whole run (RULES §21), with the budget trimmed so
    // it costs the other agents as little as possible. Nothing measured here is a TIMING —
    // these are fixed-step geometry and state counts, which contention cannot move — but the
    // shorter window does mean fewer attack cycles, so the arena's 3,600-frame figures remain
    // the headline and these are the confirmation that the same code runs in the real engine.
    for (let i = 0; i < 1200; i++) {
      // The same sine the arena drives. RULE 8: the player moves.
      H.teleport(2.6 * Math.sin(i / 140), 1.9 * Math.sin(i / 97 + 1.1));
      H.aggro('ai_b1');
      H.stepFrames(1);
      // `getCombatState().enemies` carries no state machine leaf, no speed and no yaw rate;
      // the trace record does, and it is the artifact RI-AI01 §A's field contract describes.
      const rec = H.snapshot({ hitboxes: false, events: false });
      const en = (rec.enemies || []).find((x) => x.eid === 'ai_b1');
      if (!en) return { __err: 'ai_b1 is absent from the frame record enemies[]' };
      rows.push({ d: en.dist_m, s: en.state, sp: en.speed_mps, yr: en.yaw_rate_dps, ph: en.phase });
    }
    const ds = rows.map((r) => r.d).filter((v) => v !== null);
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
    const sd = Math.sqrt(ds.reduce((a, b) => a + (b - mean) ** 2, 0) / ds.length);
    const hist = {};
    for (const r of rows) hist[r.s] = (hist[r.s] || 0) + 1;
    const entropy = Object.values(hist).map((n) => n / rows.length)
      .reduce((a, p) => a - (p > 0 ? p * Math.log2(p) : 0), 0);
    const OMEGA = 2.4;
    const nonCommit = rows.filter((r) => r.s !== 'COMMIT' && r.ph === 'none');
    const committed = rows.filter((r) => r.ph === 'active' || r.ph === 'recovery');
    return {
      frames: rows.length,
      spacing_variance: +sd.toFixed(4),
      mean_dist_m: +mean.toFixed(3),
      min_dist_dwell: nonCommit.length ? +(nonCommit.filter((r) => r.d < 0.85 * OMEGA).length / nonCommit.length).toFixed(4) : null,
      state_entropy: +entropy.toFixed(4),
      state_histogram: hist,
      // These two are the fields this piece repaired in sim/combat-bridge.js. If either is
      // identically zero across the whole run the repair did not land in the browser.
      max_speed_mps: +Math.max(...rows.map((r) => r.sp || 0)).toFixed(3),
      nonzero_speed_frames: rows.filter((r) => (r.sp || 0) > 0.01).length,
      max_yaw_rate_dps: +Math.max(...rows.map((r) => r.yr || 0)).toFixed(2),
      worst_committed_yaw_rate_dps: committed.length ? +Math.max(...committed.map((r) => r.yr || 0)).toFixed(3) : null,
      committed_frames: committed.length,
    };
  },

  // ---- B2: RI-AI01 M1, acquisition geometry, with the real perception model ----------------
  b2() {
    const H = window.__HARNESS;
    const out = [];
    const R = 16;                                     // inf_trash sight_radius_m
    for (const bearing of [0, 30, 60, 90, 120, 150, 180]) {
      for (const mult of [0.5, 0.9, 1.1, 1.5]) {
        for (const e of H.listEntities()) { try { H.despawn(e.eid); } catch { /* */ } }
        H.setSeed(1337);
        H.spawn('inf_trash', 0, 0, { as: 'ai_b2', yaw: 0 });   // facing +Z
        const rad = bearing * Math.PI / 180;
        const r = R * mult;
        H.teleport(r * Math.sin(rad), r * Math.cos(rad));
        let acquiredAt = -1, suspAt = -1, suspFrames = 0;
        for (let f = 0; f < 180; f++) {                        // 3 s
          H.stepFrames(1);
          const en = H.perceptionState().find((x) => x.eid === 'ai_b2');
          if (!en) break;
          if (en.alert_state === 'SUSPICIOUS') { if (suspAt < 0) suspAt = f; suspFrames++; }
          if (en.alert_state === 'AGGRO') { acquiredAt = f; break; }
        }
        out.push({ bearing, mult, r: +r.toFixed(1), acquired_f: acquiredAt, suspicious_frames: suspFrames });
      }
    }
    // The item's own PASS/FAIL. A circle is the named failure.
    const acqR = {};
    for (const row of out) {
      if (row.acquired_f >= 0) acqR[row.bearing] = Math.max(acqR[row.bearing] || 0, row.r);
    }
    const radii = Object.values(acqR);
    const spread = radii.length ? (Math.max(...radii) - Math.min(...radii)) / R : 0;
    return {
      samples: out,
      acquisition_radius_by_bearing: acqR,
      spread_fraction_of_R: +spread.toFixed(4),
      is_a_circle: radii.length > 1 && spread < 0.15,
      rear_180_never_acquires: !out.some((r) => r.bearing === 180 && r.acquired_f >= 0),
      front_0p9R_always_acquires: out.filter((r) => r.bearing === 0 && r.mult === 0.9).every((r) => r.acquired_f >= 0),
      beyond_1p5R_never_acquires: !out.some((r) => r.mult === 1.5 && r.acquired_f >= 0),
    };
  },

  // ---- B3: RI-AI01 M2, the alert ladder ----------------------------------------------------
  b3() {
    const H = window.__HARNESS;
    const trials = [];
    for (let t = 0; t < 6; t++) {
      for (const e of H.listEntities()) { try { H.despawn(e.eid); } catch { /* */ } }
      H.setSeed(1337 + t);
      H.spawn('inf_trash', 0, 0, { as: 'ai_b3', yaw: 0 });
      H.teleport(0, 12 - t * 0.7);
      let susp = 0, jumped = false, prev = 'IDLE', acq = -1;
      for (let f = 0; f < 600; f++) {
        H.stepFrames(1);
        const en = H.perceptionState().find((x) => x.eid === 'ai_b3');
        if (!en) break;
        if (en.alert_state === 'SUSPICIOUS') susp++;
        if (en.alert_state === 'AGGRO') {
          acq = f;
          if (prev === 'IDLE') jumped = true;
          break;
        }
        prev = en.alert_state;
      }
      trials.push({ suspicious_frames: susp, idle_to_aggro_jump: jumped, acquired_f: acq });
    }
    const s = trials.map((t) => t.suspicious_frames).sort((a, b) => a - b);
    return {
      trials,
      median_suspicious_dwell_f: s[s.length >> 1],
      jump_fraction: +(trials.filter((t) => t.idle_to_aggro_jump).length / trials.length).toFixed(3),
    };
  },

  // ---- B4: the sight-cone gate on wilderness aggro -----------------------------------------
  // Before this piece, `stepEncounters` latched AGGRO on `dist <= aggro_at_m` and nothing else.
  // The test is the one that matters for RI-STL01: stand BEHIND a sentry, inside its circle.
  b4() {
    const H = window.__HARNESS;
    const out = {};
    for (const [name, bearing] of [['in_front', 0], ['behind', 180], ['flank', 90]]) {
      for (const e of H.listEntities()) { try { H.despawn(e.eid); } catch { /* */ } }
      H.setSeed(1337);
      const r = H.spawnEncounter ? H.spawnEncounter('wl-fen-sentry', 0, 0, { yaw: 0 }) : null;
      if (!r) { out[name] = { __err: 'spawnEncounter unavailable' }; continue; }
      const rad = bearing * Math.PI / 180;
      const d = 12;                                    // inside the 16 m aggro circle
      H.teleport(d * Math.sin(rad), d * Math.cos(rad));
      let aggroed = -1;
      for (let f = 0; f < 300; f++) {
        H.stepFrames(1);
        const en = H.perceptionState()[0];
        if (en && en.alert_state === 'AGGRO') { aggroed = f; break; }
      }
      out[name] = { bearing, dist_m: d, aggroed_f: aggroed };
    }
    return out;
  },

  // ---- B5: CONSUMPTION. Perturb the model, watch an entity change behaviour. ---------------
  b5() {
    const H = window.__HARNESS;
    const E = window.__ENGINE;
    if (!E || !E.data || !E.data.combat || !E.data.combat.ai) {
      return { __err: 'game/data/combat/ai.json is not reachable on the running engine, so the '
        + 'model this piece ships has no world-side consumer to demonstrate. That is the '
        + 'RI-MTH07 failure and it is reported, not worked around.' };
    }
    const cfg = E.data.combat.ai;
    // ISOLATION, and it is here because the first run of this probe did not have it and the
    // delete-the-fix leg came back WRONG: run as `--probe=b1,b4,b5` the restored arm reported a
    // mean of 6.49 m and a standard deviation of 137.6 m, and run as `--probe=b5` alone the same
    // arm reproduced the shipped mean to four decimals (3.2409, sd 2.1162). The difference was
    // not the model, it was the world: b4 spawns a `wl-fen-sentry` ENCOUNTER, and what the
    // earlier despawn loop swept was `listEntities()`. A leftover body in the world moved the
    // number this piece's RI-MTH07 claim rests on. RULES §7 in one sentence — audit the running
    // world, not the bytes — and RULES §6, because a delete-the-fix that measures a dirty world
    // measures nothing.
    //
    // The player is healed between arms for the same reason. Across three uninterrupted
    // 1,800-frame arms its HP fell 330 -> 310 -> 21: the enemy is really hitting it, which is
    // the point of the piece, but an arm that ends with a dead player is not the same
    // experiment as one that does not.
    const measure = (label) => {
      for (const e of H.listEntities()) { try { H.despawn(e.eid); } catch { /* */ } }
      if (H.getEncounterState) {
        for (const e of (window.__ENGINE ? window.__ENGINE.sim.entities.slice() : [])) {
          if (e.encounterId) { try { H.despawn(e.eid); } catch { /* */ } }
        }
      }
      H.setSeed(1337);
      H.teleport(0, 0);
      const pb = window.__ENGINE && window.__ENGINE.combat && window.__ENGINE.combat.player;
      if (pb) { pb.hp = pb.hpMax; pb.dead = false; }
      H.spawn('inf_trash', 0, 12, { as: 'ai_b5' });
      const ds = [];
      for (let i = 0; i < 1800; i++) {
        H.teleport(2.6 * Math.sin(i / 140), 1.9 * Math.sin(i / 97 + 1.1));
        H.aggro('ai_b5');
        H.stepFrames(1);
        const en = (H.getCombatState().enemies || []).find((x) => x.id === 'ai_b5');
        if (en && en.dist_m !== undefined) ds.push(en.dist_m);
      }
      const m = ds.reduce((a, b) => a + b, 0) / ds.length;
      const st = H.getCombatState();
      const en = (st.enemies || []).find((x) => x.id === 'ai_b5');
      return {
        label, mean_dist_m: +m.toFixed(4),
        sd: +Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / ds.length).toFixed(4),
        samples: ds.length,
        min_dist_m: +Math.min(...ds).toFixed(3), max_dist_m: +Math.max(...ds).toFixed(3),
        nan_frames: ds.filter((v) => !Number.isFinite(v)).length,
        end_hp: en ? en.hp : null, end_dead: en ? en.dead : null,
        player_hp: st.player.hp,
      };
    };
    const before = measure('shipped');
    // The perturbation: circle at twice the radius. If nothing in the world reads this number,
    // the two means are identical and the model is decorative.
    const was = cfg.circle.preferred_band_multiple;
    cfg.circle.preferred_band_multiple = was * 2;
    const after = measure('preferred_band_multiple x2');
    cfg.circle.preferred_band_multiple = was;
    const restored = measure('restored');
    return {
      before, after, restored,
      delta_mean_m: +(after.mean_dist_m - before.mean_dist_m).toFixed(4),
      // The three things that make this a consumption demonstration rather than a coincidence.
      changed: Math.abs(after.mean_dist_m - before.mean_dist_m) > 0.25,
      restored_matches: Math.abs(restored.mean_dist_m - before.mean_dist_m) < 1e-6,
      isolation: 'each arm despawns every entity INCLUDING encounter members and heals the player; see the comment above measure()',
    };
  },
};

const results = {};
for (const name of run) {
  if (!PROBES[name]) { log(`unknown probe ${name}`); continue; }
  log(`ai-browser: ${name}`);
  try {
    results[name] = await handle.page.evaluate(PROBES[name]);
  } catch (e) {
    results[name] = { __err: String((e && e.message) || e) };
  }
  log(`  ${JSON.stringify(results[name]).slice(0, 420)}`);
}

const out = args.out ? String(args.out) : path.join(REPO_ROOT, 'reports/w1-12/ai-browser.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({
  tool: 'tools/harness/ai-browser.mjs',
  item: 'RI-AI01',
  build: handle.buildInfo,
  console_errors: handle.errors.slice(0, 20),
  results,
}, null, 2)}\n`);
log(`wrote ${path.relative(REPO_ROOT, out)}`);
await handle.close();
process.exitCode = Object.values(results).some((r) => r && r.__err) ? 1 : 0;
