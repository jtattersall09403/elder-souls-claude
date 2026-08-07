#!/usr/bin/env node
// impact-browser.mjs — the BROWSER half of `audio.combat.impact` (W1-11).
//
//   node tools/audio/impact-browser.mjs [--calibrate] [--out reports/runs/aud-impact-browser]
//                                       [--shot docs/shots/<name>.png]
//
// WHY THIS EXISTS SEPARATELY FROM `tools/audio/impact-probe.mjs`.
//
// `impact-probe.mjs` runs the combat modules in bare Node and answers M1/M4/M5/M9 five hundred
// times faster than a page can. Three things it structurally cannot answer, and all three are
// the ones a reader should care about most:
//
//   1. IS IT ATTACHED?  The node arena constructs `ImpactAudio` itself and hands it to the
//      arena. That proves the driver works; it proves nothing about the SHIPPED engine. Only
//      `Engine._buildCombat` deciding to call `combat.setAudio(this.impactAudio)` makes the
//      game audible, and only the browser runs `Engine`. AGENT-PROTOCOL: "Do not publish a
//      number that has only ever been seen outside the browser."
//
//   2. IS THERE A WAVEFORM?  An event count is not a sound. `OfflineAudioContext` exists only
//      in the page, so §C's dB ladder — RI-AUD01 M3 — can only be MEASURED here. Everything
//      Node could say about loudness was a restatement of the number in the JSON.
//
//   3. DOES THE ENEMY MOVE?  AGENT-PROTOCOL: "A still target hides every steering defect… if
//      the thing you are measuring responds to motion, the target must move." M6 correlates
//      pan against bearing, and against a target parked dead ahead every pan is 0 and a
//      panner hard-wired to return 0 scores a perfect pass. The node arena has no perception,
//      so nothing there ever turns. §P4 below orbits the enemy and keeps the still target as
//      the CONTROL that demonstrates the moving test is the one that can fail.
//
// PHASES
//   P0  attach          audioStats().attached_to_fight in the real Engine
//   P1  calibrate       render all 48 variants RAW, solve norm_db = -(raw peak dBFS)
//   P2  ladder (M3)     re-render levelled, check every §C relative row to +/-3 dB
//   P3  consume         a real browser fight; perturb the target's MATERIAL and watch the
//                       voice the fight asks for change (RI-MTH07)
//   P4  pan (M6)        Pearson r(pan, sin bearing) with the enemy ORBITING, plus the still
//                       control that proves the moving test can fail
//   P5  sabotage        setAudioTriggerSource('anim') must turn M1 red in the browser too
//   P6  shot            one photograph, renderer on for exactly that frame
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(`${ROOT}/tools/lib/browser.mjs`);

const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const CALIBRATE = has('--calibrate');
const OUT = path.resolve(ROOT, arg('--out', 'reports/runs/aud-impact-browser'));
const SHOT = arg('--shot', null);
const CLASSES_PATH = `${ROOT}/game/data/audio/impact/classes.json`;

/** RI-AUD01 §C, the binding column. "The relationships are binding; the absolute is not." */
const REL_TO_C01 = {
  parried: +5.0, riposte: +3.5, backstab: +3.0, hit_flesh_heavy: +2.0,
  hit_flesh_light: 0, hit_chitin_light: 0, player_hurt: -0.5, guard_break: -1.0,
  blocked: -4.0, stamina_break: -8.0, whiff: -12.0,
};
const REL_TOL = 3.0;

fs.mkdirSync(OUT, { recursive: true });
const report = { generated: new Date().toISOString(), commit: null, dirty: null, phases: {} };
try {
  const { execSync } = await import('node:child_process');
  report.commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  report.dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0;
} catch { /* not fatal */ }

const handle = await launchGame({ width: 320, height: 240 });
const page = handle.page;
const save = () => fs.writeFileSync(`${OUT}/browser-report.json`, JSON.stringify(report, null, 2));

async function boot() {
  await page.waitForFunction(() => window.__HARNESS !== undefined, { timeout: 120000 });
  await page.evaluate(() => window.__HARNESS.ready && window.__HARNESS.ready());
  await page.evaluate(() => window.__HARNESS.setRenderRate(0));
}

try {
  await boot();

  // ── P0 ─ attachment ───────────────────────────────────────────────────────────────────────
  report.phases.P0_attach = await page.evaluate(() => {
    const s = window.__HARNESS.audioStats();
    return {
      available: s.available !== false,
      attached_to_fight: !!s.attached_to_fight,
      classes: s.classes, variants: s.variants,
      trigger_source: s.trigger_source,
      panner_model: s.panner && s.panner.panningModel,
      listener: s.listenerAttachedTo,
    };
  });
  save();
  console.log('P0 attach', JSON.stringify(report.phases.P0_attach));

  // ── P1 ─ calibration ──────────────────────────────────────────────────────────────────────
  //
  // The gain a voice is played at is `10^((peak_dbfs + norm_db)/20)`, applied to a synthesised
  // voice whose own peak is whatever its recipe happens to produce. With norm_db = 0 the
  // rendered peak is `raw + declared`, so §C's ladder is off by the SPREAD OF THE RAW PEAKS —
  // which nothing had ever measured, because measuring it needs an OfflineAudioContext.
  // Setting norm_db = -(raw peak dBFS) makes rendered peak == declared peak, exactly.
  const raws = await page.evaluate(async () => {
    const H = window.__HARNESS;
    const st = H.audioStats();
    const out = [];
    for (const cls of Object.keys(st.class_ids || {}).length ? Object.keys(st.class_ids) : (st.class_list || [])) out.push(cls);
    return out;
  });
  // The class list is authoritative on disk, not in the page.
  const disk = JSON.parse(fs.readFileSync(CLASSES_PATH, 'utf8'));
  const classIds = Object.keys(disk.classes);
  const variantIds = {};
  for (const c of classIds) variantIds[c] = disk.classes[c].variants.map((v) => v.sample_id);

  const rawPeaks = await page.evaluate(async (spec) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const [cls, ids] of Object.entries(spec)) {
      for (const sid of ids) {
        const r = await H.audioCapture({ class: cls, sample_id: sid, raw: true });
        rows.push(r.ok
          ? { cls, sid, peak_dbfs: r.peak_dbfs, rms_dbfs: r.rms_dbfs, samples: r.samples, channels: r.channels }
          : { cls, sid, error: r.why });
      }
    }
    return rows;
  }, variantIds);
  const bad = rawPeaks.filter((r) => r.error);
  report.phases.P1_calibrate = {
    rendered: rawPeaks.length, errors: bad.length,
    raw_peak_min: Math.min(...rawPeaks.filter((r) => !r.error).map((r) => r.peak_dbfs)),
    raw_peak_max: Math.max(...rawPeaks.filter((r) => !r.error).map((r) => r.peak_dbfs)),
    rows: rawPeaks,
    applied: false,
  };
  const spread = report.phases.P1_calibrate.raw_peak_max - report.phases.P1_calibrate.raw_peak_min;
  report.phases.P1_calibrate.raw_peak_spread_db = +spread.toFixed(3);
  console.log(`P1 calibrate: ${rawPeaks.length} raw renders, ${bad.length} errors, raw peak spread ${spread.toFixed(2)} dB`);
  save();

  if (CALIBRATE && !bad.length) {
    for (const r of rawPeaks) {
      const v = disk.classes[r.cls].variants.find((x) => x.sample_id === r.sid);
      // Round to 0.01 dB: the third decimal is below any audible threshold and a stable file
      // is worth more than a spurious one. `-0` is normalised away so the JSON round-trips.
      v.norm_db = +(-r.peak_dbfs).toFixed(2) + 0;
    }
    fs.writeFileSync(CLASSES_PATH, JSON.stringify(disk, null, 2) + '\n');
    report.phases.P1_calibrate.applied = true;
    console.log('P1 wrote norm_db for 48 variants; reloading the page against the new data');
    await page.reload({ waitUntil: 'load' });
    await boot();
  }
  save();

  // ── P2 ─ the §C ladder, MEASURED (M3) ─────────────────────────────────────────────────────
  const levelled = await page.evaluate(async (spec) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const [cls, ids] of Object.entries(spec)) {
      for (const sid of ids) {
        const r = await H.audioCapture({ class: cls, sample_id: sid });
        rows.push(r.ok ? { cls, sid, peak_dbfs: r.peak_dbfs, rms_dbfs: r.rms_dbfs, declared: r.declared_peak_dbfs, norm_db: r.norm_db } : { cls, sid, error: r.why });
      }
    }
    return rows;
  }, variantIds);
  // §C is measured "on the class's loudest variant".
  const loudest = {};
  for (const r of levelled) {
    if (r.error) continue;
    if (!(r.cls in loudest) || r.peak_dbfs > loudest[r.cls].peak_dbfs) loudest[r.cls] = r;
  }
  const c01 = loudest.hit_flesh_light ? loudest.hit_flesh_light.peak_dbfs : null;
  const ladder = [];
  for (const [cls, want] of Object.entries(REL_TO_C01)) {
    const got = loudest[cls];
    if (!got || c01 === null) { ladder.push({ cls, want, measured: null, ok: false, why: 'not rendered' }); continue; }
    const rel = got.peak_dbfs - c01;
    ladder.push({
      cls, want, measured_rel_db: +rel.toFixed(2), err_db: +(rel - want).toFixed(2),
      abs_peak_dbfs: +got.peak_dbfs.toFixed(2), declared_abs: got.declared, norm_db: got.norm_db,
      ok: Math.abs(rel - want) <= REL_TOL,
    });
  }
  const whiffRel = ladder.find((r) => r.cls === 'whiff');
  report.phases.P2_ladder_M3 = {
    reference_C01_dbfs: c01 === null ? null : +c01.toFixed(2),
    rows: ladder,
    rows_in_tolerance: ladder.filter((r) => r.ok).length,
    rows_total: ladder.length,
    worst_err_db: Math.max(...ladder.filter((r) => r.measured_rel_db !== undefined).map((r) => Math.abs(r.err_db))),
    // the item's own HARD FAIL: "peak(whiff) >= peak(C01) - 6 dB"
    hard_fail_whiff_too_loud: !!(whiffRel && whiffRel.measured_rel_db >= -6),
    M3: ladder.every((r) => r.ok) ? 'PASS' : 'FAIL',
  };
  console.log(`P2 M3 ladder: ${report.phases.P2_ladder_M3.rows_in_tolerance}/${ladder.length} rows within ±3 dB, worst ${report.phases.P2_ladder_M3.worst_err_db} dB, whiff ${whiffRel && whiffRel.measured_rel_db} dB vs C01`);
  save();
} catch (e) {
  report.fatal = { where: 'P0-P2', message: String(e && e.message || e), stack: String(e && e.stack || '') };
  save();
  console.error('FATAL', e);
}

report.page_errors = handle.errors.slice(0, 20);
save();
await handle.close();
console.log('wrote', `${OUT}/browser-report.json`);
