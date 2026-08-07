#!/usr/bin/env node
// w1-14-r3-apm3.mjs — RI-MAG01 AP-M3, "the homing orb", made reproducible.
//
// The round-2 verdict recorded AP-M3 `not_run`:
//
//   > `MagicSystem.hitboxRecords()` computes per-projectile `turn_rate_dps` and `travel_f`, but
//   > `engine.getHitGeometry()` does not include it and no other harness surface exposes a
//   > projectile's heading. The checkpoint's headline — "60.00 deg/s before the cutoff at
//   > travel_f 53 and 0.000 after" — cannot be reproduced by a critic.
//
// `getHitGeometry().spell_geometry` now carries the whole record. This file is the check the
// critic could not run, and it is written so that it does not have to trust the number the model
// reports about itself:
//
//   * `turn_rate_dps` is the SIMULATION'S OWN claim about how far it steered this frame.
//   * `observed_dps` is computed here, from the DIFFERENCE BETWEEN TWO CONSECUTIVE `heading_deg`
//     samples times 60. It is what a critic with a ruler would measure and it is the number the
//     verdict should carry. Both are reported; a disagreement between them is itself a finding.
//
// AP-M3: "a projectile still turning past its tracking cutoff — `turn_rate_dps > 2` on any
// projectile frame past `0.35 x travel_f`". `travel_f` is read as the projectile's FULL observed
// flight, not the model's declared cutoff, so a build that moved its own cutoff later cannot
// pass by redefining the fence.
//
// THE PROBE MUST BE ABLE TO FAIL. Two ways it is made able to:
//   1. `--break=nocutoff` disables the cutoff (`__breakTrackingCutoff`), so the bolt steers for
//      its whole life. The probe must go RED. A run that cannot produce the homing orb has not
//      looked for it.
//   2. The arena puts the target OFF THE RELEASE AXIS, inside the acquisition cone. A projectile
//      fired straight down the barrel at a stationary target turns 0 deg/s everywhere and passes
//      AP-M3 vacuously — which is exactly the 0.000 deg/s wave 1 measured and called a pass.
//      `arc_deg_before_cutoff` must be non-trivial or the run is reported INCONCLUSIVE.
//
// RI-MAG06 §E: the arena does NOT call `setMagicSkills`. The caster is a mage by class and by
// practice.
//
// USAGE  node tools/harness/w1-14-r3-apm3.mjs [--break=nocutoff] [--out <dir>]
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `w1-14-r3-apm3.mjs — RI-MAG01 AP-M3 tracking-arc census (--break=nocutoff)`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const brk = args.break ? String(args.break) : null;
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/w1-14-r3');
ensureDir(outDir);

const handle = await launchGame(args);
let report;
try {
  report = await handle.page.evaluate(async (BRK) => {
    const H = window.__HARNESS;
    await H.ready();
    const D = H.getMagicData();
    const BAL = D.cast_classes.ballistics;

    const arena = () => {
      H.setSeed(4242);
      H.loadState('arena_flat');
      H.setRenderRate(0);
      H.resetMagicWorld();
      // RI-MAG06 §E. No setMagicSkills, no setSkills. Mage by class, mage by practice.
      H.setCharacter({ race: 'saxhleel', upbringing: 'interior', class: 'sap-reader',
                       birthsign: 'raj-xul', given_name: 'Unwritten', sex: 'unrecorded' });
      for (let i = 0; i < 700; i++) {
        for (const sk of ['sorcery', 'root-speech', 'warding', 'veiling']) {
          H.grantSkillUse('cast_effective', { cost: 40, spell_skill: sk });
        }
        H.hearthRest();
      }
      H.setWillpower(99);
      H.setCatalyst('great_staff');
      H.setGold(2000000);
      for (const s of D.spells.spells) H.learnSpell(s.id);
      H.hearthRest();
      H.magicEventsDrain();
      if (BRK === 'nocutoff') H.__breakTrackingCutoff();
    };

    /**
     * Fire one projectile of class `cls` at a target placed `off_deg` off the release axis at
     * `range_m`, and sample the projectile's own record every frame of its flight.
     */
    const flight = (cls, off_deg, range_m) => {
      arena();
      const rad = off_deg * Math.PI / 180;
      const eid = H.spawn('inf_trash', Math.sin(rad) * range_m, Math.cos(rad) * range_m);
      // Deliberately NOT aggroed: a target walking at the caster confounds the arc with the
      // target's own motion, and AP-M3 is about the projectile, not the fight.
      const mk = H.makeSpell({ class: cls, range: 'projectile',
        effects: [{ effect: 'fire_damage', magnitude: 12, duration_s: 0, area_r_m: 0 }] }, `apm3_${cls}`);
      if (mk.refused) return { cls, refused: mk.reason || mk.gate };
      H.setAttuned([mk.spell.id]);
      H.queueInputs([{ f: 2, press: ['light'] }, { f: 4, release: ['light'] }]);
      const samples = [];
      // THE TARGET STRAFES. This is the difference between a test and a formality. Against a
      // STATIONARY target the bolt closes its 15 deg of acquisition error in 15 frames and then
      // holds a constant heading for the rest of the flight — so `turn_rate_dps` is 0 on every
      // frame past any fence you care to draw, AP-M3 "passes", and it would pass just as well
      // on a build with no cutoff at all. `--break=nocutoff` against a stationary target stays
      // GREEN, which is the definition of an instrument that cannot fail.
      // A target moving across the bolt's path keeps a steering demand alive for the whole
      // flight, so the ONLY thing that can zero the turn rate past the fence is the cutoff.
      const strafeMps = 3.0;
      for (let i = 0; i < 400; i++) {
        const t = i / 60;
        H.setEntityPos(eid, Math.sin(rad) * range_m + strafeMps * t, Math.cos(rad) * range_m);
        H.stepFrames(1);
        const g = H.getHitGeometry();
        const p = (g.spell_geometry || []).find((x) => x.kind === 'projectile');
        if (p) {
          samples.push({
            f: g.frame, travel_f: p.travel_f, heading_deg: p.heading_deg,
            turn_rate_dps: p.turn_rate_dps, heading_rate_dps: p.heading_rate_dps,
            cutoff_f: p.tracking_cutoff_f, cap_dps: p.turn_rate_cap_dps,
            cone_deg: p.acquisition_cone_deg, hits: p.hits.length,
            pos: p.a,
          });
        } else if (samples.length) break;          // it landed, expired or was consumed
      }
      if (!samples.length) return { cls, refused: 'no_projectile_spawned' };

      // The critic's own read: consecutive headings, not the model's self-report.
      let maxObsBefore = 0, maxObsAfter = 0, maxSelfAfter = 0, arcBefore = 0, arcAfter = 0;
      const total = samples[samples.length - 1].travel_f;
      const fence = 0.35 * total;                  // AP-M3's fence, from the OBSERVED flight
      const violations = [];
      for (let i = 1; i < samples.length; i++) {
        const d = ((samples[i].heading_deg - samples[i - 1].heading_deg + 540) % 360) - 180;
        const obs = Math.abs(d) * 60;
        samples[i].observed_dps = Math.round(obs * 100) / 100;
        if (samples[i].travel_f > fence) {
          maxObsAfter = Math.max(maxObsAfter, obs);
          maxSelfAfter = Math.max(maxSelfAfter, samples[i].turn_rate_dps);
          arcAfter += Math.abs(d);
          if (obs > 2) violations.push({ travel_f: samples[i].travel_f, observed_dps: Math.round(obs * 100) / 100, fence: Math.round(fence * 100) / 100 });
        } else {
          maxObsBefore = Math.max(maxObsBefore, obs);
          arcBefore += Math.abs(d);
        }
      }
      const r2 = (x) => Math.round(x * 100) / 100;
      return {
        cls, off_axis_deg: off_deg, range_m,
        declared: { turn_rate_dps: BAL.classes[cls].turn_rate_dps, tracking_cutoff: BAL.classes[cls].tracking_cutoff,
                    lifetime_s: BAL.classes[cls].lifetime_s, speed_mps: BAL.classes[cls].speed_mps,
                    cutoff_f: samples[0].cutoff_f, acquire_cone_deg: samples[0].cone_deg },
        observed_total_travel_f: total,
        apm3_fence_f: r2(fence),
        max_observed_dps_before_fence: r2(maxObsBefore),
        max_observed_dps_after_fence: r2(maxObsAfter),
        max_selfreported_dps_after_fence: r2(maxSelfAfter),
        arc_deg_before_cutoff: r2(arcBefore),
        arc_deg_after_cutoff: r2(arcAfter),
        heading_first_deg: samples[0].heading_deg,
        heading_last_deg: samples[samples.length - 1].heading_deg,
        hit: samples[samples.length - 1].hits > 0,
        violations: violations.slice(0, 12),
        violation_frames: violations.length,
        // A pass requires BOTH: nothing steering past the fence, AND a real arc before it.
        // The second clause is what stops "the projectile never turned at all" reading as
        // compliance — the wave-1 measurement this item exists to reject.
        apm3: violations.length === 0 ? (arcBefore > 1 ? 'PASS' : 'INCONCLUSIVE_no_arc_to_test') : 'FAIL',
        samples: samples.filter((s) => s.travel_f <= 4 || Math.abs(s.travel_f - fence) < 6 || s.travel_f % 20 === 0 || s.travel_f === total),
      };
    };

    const flights = [];
    // The two classes that declare an arc, plus one that declares none — the null control that
    // proves the instrument is reading the projectile and not a constant.
    flights.push(flight('LIGHT', 15, 30));
    flights.push(flight('HEAVY', 15, 30));
    flights.push(flight('CANTRIP', 15, 22));

    const tracked = flights.filter((f) => f.declared && f.declared.turn_rate_dps > 0);
    return {
      schema: 'elder-souls/w1-14-r3-apm3@1',
      broke: BRK,
      flights,
      verdict: {
        classes_declaring_tracking: tracked.map((f) => f.cls),
        apm3_by_class: Object.fromEntries(flights.map((f) => [f.cls, f.apm3 || f.refused])),
        // CANTRIP declares no tracking, so an arc there would be a different defect: geometry
        // steering that no data file asked for.
        untracked_class_arc_deg: (flights.find((f) => f.cls === 'CANTRIP') || {}).arc_deg_before_cutoff,
        pass: tracked.length > 0 && tracked.every((f) => f.apm3 === 'PASS'),
      },
    };
  }, brk);
} finally {
  await handle.close();
}

const name = brk ? `apm3-break-${brk}.json` : 'apm3.json';
writeJson(path.join(outDir, name), report);
for (const f of report.flights) {
  if (f.refused) { log(`${f.cls}: REFUSED ${f.refused}`); continue; }
  log(`${f.cls}  declared ${f.declared.turn_rate_dps} dps cutoff_f ${f.declared.cutoff_f}  | flight ${f.observed_total_travel_f} f, AP-M3 fence ${f.apm3_fence_f} f`);
  log(`      observed max ${f.max_observed_dps_before_fence} dps before / ${f.max_observed_dps_after_fence} dps after   arc ${f.arc_deg_before_cutoff} deg before / ${f.arc_deg_after_cutoff} deg after   -> ${f.apm3}${f.violation_frames ? ` (${f.violation_frames} violating frames)` : ''}`);
}
log(`AP-M3 ${report.verdict.pass ? 'PASS' : 'FAIL'}  ${JSON.stringify(report.verdict.apm3_by_class)}`);
log(path.join(outDir, name));
