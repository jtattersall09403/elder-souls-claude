#!/usr/bin/env node
// stl-live.mjs — W1-15 asked of the RUNNING game, through window.__HARNESS.
//
// stl-probe.mjs imports the same modules the game imports, which is the right check for
// arithmetic and the wrong check for WIRING: it would pass unchanged if the engine never
// stepped any of it and the harness never exposed it. This probe boots the real build in
// headless Chromium and drives it a frame at a time, so "the game does this" and "a module on
// disk computes this" are separately evidenced (RI-MTH04).
//
// USAGE
//   node tools/harness/stl-live.mjs [--json <path>]
import { parseArgs, wantsHelp, usage, writeJson, log } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `stl-live.mjs — RI-STL01/02 and RI-CRM01/02 asked of the live game.\n\nUSAGE\n  node tools/harness/stl-live.mjs [--json <path>]\n`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const h = await launchGame(args);
const R = [];
const say = (s) => process.stdout.write(s + '\n');
const A = (id, name, got, pass, target) => { R.push({ id, name, got: String(got), target, pass }); say(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(10)} ${name}\n              got ${got}\n              target ${target}`); };

try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');

  // ---- 0. the blocking dependency ------------------------------------------------------
  const actions = await h.h('getActionSet');
  A('LIVE-BTN', 'the closed action set contains `crouch`', `${actions.actions.length} buttons: ...${actions.actions.slice(-2).join(', ')}; crouch bound to ${JSON.stringify(actions.bindings.crouch)}`,
    actions.actions.includes('crouch') && !!actions.bindings.crouch, 'present and bound — without it no stealth scenario is scriptable (RI-STL01)');
  A('LIVE-AUD', 'binding audit is clean', JSON.stringify(actions.audit), Array.isArray(actions.audit) && actions.audit.length === 0, '[]');

  // ---- 1. crouch really changes the simulation ------------------------------------------
  await h.h('setStealthState', { sneak: 45, load: 'light', surface: 'mud', inCover: false, zone: null, race: 'saxhleel' });
  await h.h('setTimeOfDay', 1.5);
  const before = await h.h('getStealthState');
  await h.h('queueInputs', [{ f: 0, press: ['crouch'] }, { f: 2, release: ['crouch'] }]);
  await h.h('stepFrames', 6);
  const after = await h.h('getStealthState');
  A('LIVE-CRO', 'pressing `crouch` toggles the sim state', `crouched ${before.crouched} -> ${after.crouched}`, !before.crouched && after.crouched, 'false -> true');

  // ---- 2. light is SAMPLED, not assumed ---------------------------------------------------
  await h.h('setStealthState', { zone: 'probe-room' });
  await h.h('setZoneAmbient', 'probe-room', 'unlit');
  await h.h('addLightSource', { id: 'probe.lamp', pos: [0, 1.6, 0], intensity: 0.55, snuffable: true, zone: 'probe-room' });
  const samples = [];
  for (const d of [0, 1, 2, 4, 9, 18]) samples.push({ d, L: await h.h('getLightAt', d, 1.2, 0, 'probe-room') });
  say(`   L along a line from a single 0.55 lamp: ${samples.map((s) => `${s.d} m -> ${s.L.toFixed(3)}`).join('   ')}`);
  A('LIVE-LGT', 'getLightAt() returns a real falloff, not a constant', `${samples[0].L.toFixed(3)} at the lamp, ${samples[5].L.toFixed(3)} at 18 m`,
    samples[0].L > samples[2].L && samples[2].L > samples[5].L, 'monotonic falloff');
  const cov = await h.h('darkCoverage', { x: [-20, 20], z: [-20, 20] }, 'probe-room', 0.10);
  A('LIVE-DRK', 'DARK-COVERAGE of the probe room at L <= 0.10', `${(cov.share * 100).toFixed(1)}% of ${cov.total} samples`, cov.share >= 0.30, '>= 30%');
  await h.h('snuffLight', 'probe.lamp', 90);
  const snuffed = await h.h('getLightAt', 0, 1.2, 0, 'probe-room');
  A('LIVE-SNF', 'snuffing the lamp changes L at the lamp', `${samples[0].L.toFixed(3)} -> ${snuffed.toFixed(3)}`, snuffed < samples[0].L, 'falls');

  // ---- 3. the trace carries the block RI-STL01 asked for --------------------------------
  await h.h('setStealthState', { zone: null });
  await h.h('traceStart', { shape: 'frame', events: true });
  await h.h('stepFrames', 30);
  const drained = await h.h('traceDrain');
  const frame = drained.frames ? drained.frames[0] : (Array.isArray(drained) ? drained[0] : null);
  const blk = frame && frame.player && frame.player.stealth;
  A('LIVE-TRC', 'trace player.stealth block present with RI-STL01\'s named fields', blk ? Object.keys(blk).join(',') : 'ABSENT',
    !!blk && ['crouched', 'light', 'V', 'sound_r_m', 'surface', 'in_cover'].every((k) => k in blk), 'crouched, light, V, sound_r_m, surface, in_cover');
  await h.h('traceStop');

  // ---- 4. the five worked rows, computed by the running game -----------------------------
  say('\n   RI-STL01 §2 worked rows, computed by the LIVE build via __HARNESS.visibilityAt():');
  const rows = [
    { label: 'sprinting, torchlit, heavy, Sneak 5', L: 0.85, motion: 'sprint', sneak: 5, load: 'heavy', inCover: false, wantV: 1.30, wantT: 1.03 },
    { label: 'walking, dim, medium, Sneak 5', L: 0.35, motion: 'walk', sneak: 5, load: 'medium', inCover: false, wantV: 0.3373, wantT: 3.94 },
    { label: 'crouched, dim, light, Sneak 45', L: 0.35, motion: 'crouch_move', sneak: 45, load: 'light', inCover: false, wantV: 0.1576, wantT: 8.5 },
    { label: 'crouched, unlit, light, Sneak 45, in cover', L: 0.06, motion: 'crouch_move', sneak: 45, load: 'light', inCover: true, wantV: 0.05, wantT: 26.7 },
    { label: 'still, unlit, light, Sneak 100, in cover', L: 0.06, motion: 'still', sneak: 100, load: 'light', inCover: true, wantV: 0.05, wantT: 26.7 },
  ];
  let worstV = 0, worstT = 0;
  for (const r of rows) {
    const v = await h.h('visibilityAt', { L: r.L, motion: r.motion, sneak: r.sneak, load: r.load, inCover: r.inCover });
    const fill = 150 * v.V * (1 - 8 / 16);
    const t = 100 / fill;
    worstV = Math.max(worstV, Math.abs(v.V - r.wantV));
    worstT = Math.max(worstT, Math.abs(t - r.wantT) / r.wantT);
    say(`     ${r.label.padEnd(46)} V ${v.V.toFixed(4)} (raw ${v.raw.toFixed(4)}${v.clamped ? ', CLAMPED' : ''})  fill ${fill.toFixed(2)}/s  t ${t.toFixed(3)} s (item ${r.wantT})`);
  }
  A('LIVE-VFO', 'the five worked rows against the live build', `worst V error ${worstV.toExponential(1)}, worst time error ${(worstT * 100).toFixed(2)}%`, worstT <= 0.05, 'within 5% (RI-STL01 method 2)');
  const clampLo = await h.h('visibilityAt', { L: 0.01, motion: 'still', sneak: 100, load: 'light', inCover: true });
  const clampHi = await h.h('visibilityAt', { L: 1.0, motion: 'sprint', sneak: 5, load: 'overloaded', inCover: false });
  A('LIVE-CLP', 'both clamps fire in the live build', `floor: raw ${clampLo.raw.toExponential(2)} -> ${clampLo.V};  ceiling: raw ${clampHi.raw.toFixed(3)} -> ${clampHi.V}`,
    clampLo.V === 0.05 && clampHi.V === 1.30, '0.05 and 1.30');
  const reed = await h.h('soundRadiusFor', { motion: 'sprint', sneak: 5, load: 'heavy', surface: 'dry_reed' });
  const mud = await h.h('soundRadiusFor', { motion: 'crouch_move', sneak: 100, load: 'light', surface: 'mud' });
  A('LIVE-SND', 'the loud and quiet ends of the live sound model', `dry-reed sprint at Sneak 5/heavy: ${reed.toFixed(2)} m;  mud crouch at Sneak 100/light: ${mud.toFixed(2)} m`,
    reed > 30 && mud < 1.5, '> 30 m and < 1.5 m — a 55x range that level geometry controls');

  // ---- 5. the ward-collar, driven by `interact` in the running game -----------------------
  const zones = await h.h('listPropertyZones', 'gideon');
  A('LIVE-PRP', 'property data reaches the running game', `${zones.length} zones in Gideon, first: ${zones[0].id} (${zones[0].class}, owner ${zones[0].owner_name || zones[0].owner}, ${zones[0].objects} objects, ${zones[0].locks} lock)`,
    zones.length > 0 && zones[0].objects > 0, '> 0 zones with owned objects');
  const owned = await h.h('listOwnedObjects', zones[0].id);
  const distinctOwners = new Set(owned.map((o) => o.owner)).size;
  A('LIVE-OWN', 'listOwnedObjects on one room', `${owned.length} objects, ${distinctOwners} distinct owners, e.g. ${owned[0].name} (${owned[0].owner}, ${owned[0].value_g} g)`,
    owned.every((o) => 'owner' in o) && distinctOwners > 1, 'every object owned; more than one owner in the room');

  // Find a tier-3 lock in the loaded world and pick it, timing every press off the live collar.
  const t3 = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.setStealthState({ security: 70, agility: 40, picks: 12 });
    for (const z of H.listPropertyZones()) {
      if (!z.locks) continue;
      try { const g = H.lockBegin(z.id + '.lock'); if (g.tier === 3) return { zone: z.id, lock: z.id + '.lock', block: g }; } catch (e) { /* no tier-3 lock here */ }
    }
    return null;
  });
  if (t3) {
    A('LIVE-LCK', 'a tier-3 ward-collar exists in the running world', JSON.stringify(t3.block),
      t3.block.tier === 3 && t3.block.wards === 3 && t3.block.W_deg > 0, 'tier 3, 3 wards, a non-zero tolerance window');
    // Drive a whole interaction and read the engine's OWN rng draw counter before and after.
    const det = await h.page.evaluate((lockId) => {
      const H = window.__HARNESS;
      H.setStealthState({ security: 70, agility: 40, picks: 12 });
      H.lockBegin(lockId);
      const d0 = H.snapshot().rng.draws;
      let presses = 0, frames = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const s = H.lockState();
        if (!s || s.open || s.failed) break;
        // The player's job, scripted: press when the collar is inside the window.
        // Press only when the collar is inside the tolerance window — the player's job.
        if (Math.abs(s.delta_deg) <= s.W_deg / 2) { H.lockPress(); presses++; }
        H.stepFrames(1); frames++;
      }
      const s = H.lockState();
      return { d0, d1: H.snapshot().rng.draws, open: !!(s && s.open), set: s && s.set, broken: s && s.broken, presses, frames, W: s && s.W_deg };
    }, t3.lock);
    say(`     the live interaction: ${det.presses} presses over ${det.frames} f@60, W = ${det.W} deg, ${det.set}/3 wards set, ${det.broken} picks broken`);
    A('LIVE-RNG', 'RNG draws across a whole live lock interaction', `${det.d1 - det.d0} (counter ${det.d0} -> ${det.d1})`,
      det.d1 === det.d0, '0 — the counter must not move at all (RI-STL02 method 3)');
    A('LIVE-OPN', 'the collar opens under timed `interact` presses', `open=${det.open}, ${det.set}/3 wards`, det.open, 'open — it is an interaction, not a keypress and not a die');
    // NOTE, stated rather than hidden: the 100-seed determinism sweep is run HEADLESS in
    // tools/harness/stl-probe.mjs (STL02-M3a), not here. A live loop that reseeded the engine
    // and replayed the collar dozens of times inside one page.evaluate hung the Playwright
    // bridge reproducibly, and I could not diagnose it inside this piece's budget. What the
    // live probe proves is the WIRING — that the collar exists in the loaded world, opens under
    // timed `interact` presses, and moves the engine's own RNG counter by zero. The
    // cross-seed invariance is proved against the same module, headless, at 100 seeds.
  } else {
    A('LIVE-LCK', 'a tier-3 ward-collar in the running world', 'none found', false, 'a tier-3 lock reachable by id');
  }

  // ---- 5b. the pickpocket, and the ONE draw seam S21 keeps ---------------------------------
  // The lock's "0 draws" above is only meaningful if the counter can move at all. It can, in
  // exactly one place in this piece, and this is that place.
  const pp = await h.page.evaluate(() => {
    const H = window.__HARNESS;
    H.setSeed(20250806);
    H.setStealthState({ sneak: 45, race: 'saxhleel', crouched: true });
    H.setCrimeContext('crouched_public');
    const q = { targetCivState: 'CALM', dist: 1.0, bearingDeg: 180, moving: false, ownerId: 'npc:mark' };
    const begin = H.pickpocketBegin(q);
    const d0 = H.snapshot().rng.draws;
    // Hold `interact` for the whole of T. Releasing early costs nothing at all.
    H.queueInputs([{ f: 0, press: ['interact'] }]);
    H.stepFrames(begin.need_f + 4);
    const d1 = H.snapshot().rng.draws;
    // The geometry gates, asked of the live build.
    const refusals = [];
    for (const bad of [{ dist: 1.5 }, { bearingDeg: 99 }, { moving: true }, { targetCivState: 'WATCHING' }]) {
      try { H.pickpocketBegin({ ...q, ...bad }); refusals.push('OFFERED(' + JSON.stringify(bad) + ')'); }
      catch (e) { refusals.push(String(e.message).replace('pickpocket not offered: ', '')); }
    }
    return { need_f: begin.need_f, T_s: begin.T_s, draws: d1 - d0, refusals };
  });
  say(`     the four geometry refusals, live: ${pp.refusals.map((r) => '"' + r + '"').join('; ')}`);
  A('LIVE-PPK', 'a completed pickpocket hold draws from the seeded PRNG exactly once (seam S21)',
    `T = ${pp.T_s.toFixed(2)} s = ${pp.need_f} f@60, draws moved by ${pp.draws}`, pp.draws === 1,
    '1 — the die S21 keeps, and the counter that stayed at 0 through the whole lock interaction');
  A('LIVE-PPG', 'all four geometry gates refuse, live, with a reason', `${pp.refusals.length} refusals`,
    pp.refusals.length === 4 && pp.refusals.every((r) => !r.startsWith('OFFERED')), '4 refusals, each naming what was wrong');

  // ---- 6. the crime ledger, in the running game -------------------------------------------
  const c0 = await h.h('getCrimeState');
  const take = await h.h('takeObject', owned[0].instance, { observedBy: [] });
  const c1 = await h.h('getCrimeState');
  A('LIVE-THF', 'taking an owned object unobserved', `stolen_from=${take.stolen_from}, bounty ${c0.bounty.imperial} -> ${c1.bounty.imperial}`,
    take.stolen_from === owned[0].owner && c1.bounty.imperial === 0, 'flagged, and NO bounty — a crime does not create one, a report does');

  await h.h('spawnCivilian', { eid: 'witness0', group: 'civilian', race: 'saxhleel', pos: [1, 0, 1], yaw: 180 });
  const crime = await h.h('commitCrime', 'theft', { value_g: 200, settlement: 'gideon' });
  await h.h('addWitness', crime.id, { eid: 'witness0', identified: true });
  const pre = await h.h('getCrimeState');
  const landed = await h.h('landReport', 0, 'unlawful');
  const post = await h.h('getCrimeState');
  A('LIVE-RPT', 'the report chain moves the bounty and the crime does not', `crime quote ${crime.quote} g; bounty ${pre.bounty.imperial} before the report, ${post.bounty.imperial} after`,
    pre.bounty.imperial === 0 && post.bounty.imperial === 225, '0 then 225');

  // Persistence: seam S6.
  const death = await h.h('playerDeath', { killedByGuardDuringArrest: false });
  const afterDeath = await h.h('getCrimeState');
  A('LIVE-S6a', 'bounty after a death', `${afterDeath.bounty.imperial} g, ledger unchanged=${death.crime_state_unchanged}`,
    afterDeath.bounty.imperial === 225 && death.crime_state_unchanged, '225, unchanged — dying does not launder your crimes');
  const arrestDeath = await h.h('playerDeath', { killedByGuardDuringArrest: true });
  A('LIVE-S6b', 'dying to a guard mid-arrest', `${arrestDeath.wake}`, arrestDeath.wake === 'jail', 'jail, not the sapwell');

  // A save/load round trip through the REAL save system.
  const saved = await h.h('saveState');
  const roundtrip = await h.h('saveRoundTrip');
  A('LIVE-SAV', 'the engine\'s own save round trip with a live bounty', `equal=${roundtrip.equal}, diff keys ${Object.keys(roundtrip.diff || {}).length}`, roundtrip.equal, 'byte-identical state hash');

  // ---- 7. the guard ladder and the arrest, live -------------------------------------------
  const band1 = await h.h('getGuardBand', { race: 'imperial', standing: 'none', bounty: 200 });
  const band2 = await h.h('getGuardBand', { race: 'imperial', standing: 'none', bounty: 600 });
  const band3 = await h.h('getGuardBand', { race: 'imperial', standing: 'none', bounty: 2000 });
  A('LIVE-BND', 'the guard ladder for an Imperial with no faction (arrest 405, attack 1620)',
    `200 g -> ${band1.behaviour}; 600 g -> ${band2.behaviour}; 2,000 g -> ${band3.behaviour}`,
    band1.band === 1 && band2.band === 2 && band3.band === 3, 'greeting / arrest dialogue / attack on sight');
  const topics = await h.h('arrestTopics', { bounty: 800, gold: 700 });
  A('LIVE-ARR', 'the arrest offers three answers and explains the one it refuses',
    topics.map((t) => t.id + (t.refused ? '(refused)' : '')).join(', ') + ` — "${topics[0].refusal}"`,
    topics.length >= 3 && topics[0].refused && /100 gold/.test(topics[0].refusal || ''), 'pay(refused, naming the shortfall), resist, serve');

  // ---- 8. AR-3, live: a crime changes whether a fight starts --------------------------------
  await h.h('setBounty', 'imperial', 0);
  const s0 = await h.h('getSanctionState');
  await h.h('setBounty', 'imperial', 3000);
  const s1 = await h.h('getSanctionState');
  A('LIVE-AR3a', 'Deep-Kin regard as a function of the player\'s Imperial bounty',
    `0 g -> +${s0.deep_kin_regard};  3,000 g -> +${s1.deep_kin_regard}`, s0.deep_kin_regard === 0 && s1.deep_kin_regard === 12, '+0 then +12 (capped)');
  await h.h('setFactionStandings', { 'xul-aneekh': 4 });
  const s2 = await h.h('getSanctionState');
  A('LIVE-AR3b', 'war-brood hostile_below_disposition shift at Xul-Aneekh rank 4', `${s2.warbrood_shift} (standing key ${s2.standing_key})`,
    s2.warbrood_shift === -40, '-40 — the encounter table empties without one enemy statblock changing');
  const cov2 = await h.h('getSanctionState');
  A('LIVE-SAN', 'no sanctioning authority is honoured in all three jurisdictions', `${cov2.coverage.universal.length} universal of ${cov2.coverage.rows.length} authorities`,
    cov2.coverage.universal.length === 0, '0 — the Morag Tong problem, solved by jurisdiction');

  // ---- 9. NO-METER (AR-2) --------------------------------------------------------------------
  const stealthNow = await h.h('getStealthState');
  A('LIVE-HUD', 'stealth HUD elements', stealthNow.hud_elements, stealthNow.hud_elements === 0, '0 — no eye icon, no bar, no hidden/detected word');

  const det2 = await h.h('getDeterminismReport');
  A('LIVE-DET', 'determinism guard violations across the whole probe', det2.violations, det2.violations === 0, '0');
} finally {
  await h.close();
}

const failed = R.filter((r) => !r.pass);
say(`\n${'='.repeat(70)}\n${R.length - failed.length}/${R.length} live assertions pass` + (failed.length ? `\nFAILED: ${failed.map((f) => f.id).join(', ')}` : ''));
if (args.json) writeJson(String(args.json), { results: R, passed: R.length - failed.length, total: R.length });
process.exit(failed.length ? 20 : 0);
