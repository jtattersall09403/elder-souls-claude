#!/usr/bin/env node
// impact-probe.mjs — drive `aud-impact-matrix` and write the run artifacts RI-AUD01's
// Comparison method reads. W1-11, `audio.combat.impact`.
//
//   node tools/audio/impact-probe.mjs [--seed 1337] [--out reports/runs/<id>]
//                                     [--sabotage anim|flat|onevariant|nopan|silent]
//
// WHAT IT PRODUCES
//   <out>/trace.jsonl       every combat event, one JSON object per line, with its sim frame
//   <out>/audio-log.json    every voice the fight ASKED FOR, with the sim frame it decided on
//   <out>/audio-stats.json  RI-AUD02 §A/§B/§C/§D/§E's self-report
//
// The two streams are written INDEPENDENTLY — the trace from the event bus, the audio log from
// the driver — and `tools/analysis/audio-sync.mjs` joins them. That separation is the whole
// reason M1 is a measurement rather than a tautology: if the driver ever decided on a frame
// other than the one the geometry decided on, the join would show it.
//
// ── THE SABOTAGES, AND WHY THEY SHIP ────────────────────────────────────────────────────────
// AGENT-PROTOCOL: "A probe that cannot fail is worse than no probe. Break what it measures on
// purpose and confirm it goes red." Each mode below breaks exactly one thing and is expected to
// turn exactly one check red:
//
//   anim        fire off the animation event track instead of off hit resolution
//               — RI-AUD01 §B's named failure.       expect: M1 and M7 red
//   flat        set every class's peak_dbfs to the same value
//               — "twelve samples compressed to one loudness".  expect: M3 red
//   onevariant  keep one variant per class
//               — "one sample per class is repetition fatigue".  expect: M5 red
//   nopan       force every pan to 0
//               — "no panner at all".                 expect: M6 red
//   silent      detach the driver from the fight entirely
//               — the state the build was in before this piece.  expect: everything red
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { NodeArena, loadCombatData } = await import(`${ROOT}/tools/lib/combat-node.mjs`);
const { ImpactAudio } = await import(`${ROOT}/game/src/audio/impact-audio.js`);

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEED = Number(arg('--seed', '1337'));
const SABOTAGE = arg('--sabotage', null);
const RUN_ID = arg('--run-id', `aud-impact-matrix-${SEED}${SABOTAGE ? '-' + SABOTAGE : ''}`);
const OUT = path.resolve(ROOT, arg('--out', `reports/runs/${RUN_ID}`));

const D = loadCombatData();
const CLASSES = JSON.parse(fs.readFileSync(`${ROOT}/game/data/audio/impact/classes.json`, 'utf8'));

/**
 * The sabotages are applied to a DEEP COPY of the shipped data, never to the file on disk.
 * A probe that edits the game's data to make itself fail is a probe that leaves the game broken.
 */
function sabotagedClasses(mode) {
  const c = JSON.parse(JSON.stringify(CLASSES));
  if (mode === 'flat') for (const k of Object.keys(c.classes)) c.classes[k].peak_dbfs = -8.0;
  if (mode === 'onevariant') for (const k of Object.keys(c.classes)) c.classes[k].variants = [c.classes[k].variants[0]];
  if (mode === 'nopan') for (const k of Object.keys(c.classes)) c.classes[k].spatialised = false;
  return c;
}

// ── the fixture ─────────────────────────────────────────────────────────────────────────────
//
// RI-AUD01's `aud-impact-matrix` asks for, "against a chitin-armoured and an unarmoured enemy:
// >=8 landed light hits on each, >=4 heavy hits, >=6 whiffs, >=6 blocks, >=3 guard breaks,
// >=3 parries, >=3 ripostes, >=3 backstabs, >=6 player-hurt events, >=2 deaths."
//
// Not every one of those is reachable in the bare-Node arena, and the honest thing is to say
// which and why rather than to synthesise the event. AGENT-PROTOCOL is explicit that the node
// arena does not run stealth perception, so an enemy there never turns and never aggros; the
// classes that need an enemy to CHOOSE to attack the player (C10 player_hurt) or to be turned
// away from it (C08 backstab) are produced in the browser pass, not here. Each fixture below
// records `produces` so the coverage report can distinguish "absent" from "not exercised".

const FIXTURES = [];

/** Light and heavy hits on every material — C01, C02, C03 and the deflect route into C02. */
const MATERIALS = ['flesh', 'chitin', 'stone', 'metal', 'wood', 'water', 'plant'];
const byTier = {};
for (const [id, m] of Object.entries(D.weaponMovesets)) (byTier[m.weight_tier] ||= []).push(id);
for (const t of Object.keys(byTier)) byTier[t].sort();

for (const tier of ['light', 'medium', 'heavy', 'ultra']) {
  const w = (byTier[tier] || [])[0];
  if (!w) continue;
  for (const mat of MATERIALS) {
    FIXTURES.push({
      name: `hit.${tier}.${mat}`, weapon: w, target: `mat_${mat}`, dist: 1.2,
      inputs: [{ f: 3, press: ['light'] }, { f: 5, release: ['light'] }], frames: 200,
      produces: ['IMPACT'],
    });
  }
}

/** Whiffs — C09. The identical input thrown at empty air, which is RI-WPN05 M4's control too. */
for (const tier of ['light', 'medium', 'heavy', 'ultra']) {
  const w = (byTier[tier] || [])[0];
  if (!w) continue;
  FIXTURES.push({
    name: `whiff.${tier}`, weapon: w, target: null,
    inputs: [{ f: 3, press: ['light'] }, { f: 5, release: ['light'] },
             { f: 90, press: ['light'] }, { f: 92, release: ['light'] }],
    frames: 220, produces: ['WHIFF'],
  });
}

/** Deaths — C12. A light dummy under an ultra greatsword. */
{
  const w = (byTier.ultra || byTier.heavy || [])[0];
  if (w) FIXTURES.push({
    name: 'death.flesh', weapon: w, target: 'mat_flesh', dist: 1.2, killable: true,
    inputs: Array.from({ length: 14 }, (_, i) => [
      { f: 3 + i * 70, press: ['light'] }, { f: 5 + i * 70, release: ['light'] }]).flat(),
    frames: 1000, produces: ['IMPACT', 'DEATH'],
  });
}

/**
 * Blocks and guard breaks — C04, C05. The ENEMY blocks: `mat_shield` is the seven-material
 * fixture's shield dummy and a blow into a raised guard reads off the `shield` column of
 * RI-WPN05 §A, which is exactly what makes C04 a distinct class rather than a quiet C01.
 */
{
  const w = (byTier.heavy || byTier.medium || [])[0];
  if (w) FIXTURES.push({
    name: 'block.shield', weapon: w, target: 'mat_shield', dist: 1.2, guard: true,
    inputs: Array.from({ length: 10 }, (_, i) => [
      { f: 3 + i * 60, press: ['light'] }, { f: 5 + i * 60, release: ['light'] }]).flat(),
    frames: 700, produces: ['IMPACT', 'BLOCK', 'GUARD_BREAK'],
  });
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────

function runFixture(fx, audioData, opts) {
  const a = new NodeArena({ data: D, loadout: { weapon: fx.weapon } });
  const audio = new ImpactAudio(audioData, {
    seed: opts.seed, playerId: 'player',
    trigger_source: opts.sabotage === 'anim' ? 'anim' : 'resolution',
  });
  if (opts.sabotage !== 'silent') a.cs.setAudio(audio);

  let e = null;
  if (fx.target) {
    e = a.spawn('t', fx.target, 0, fx.dist, 180);
    a.lockOn('t');
    if (fx.guard) { e.guardRaised = true; e.shield = e.shield || a.cs.shieldFor('kite_garrison'); e.shieldId = 'kite_garrison'; }
    // RI-WPN05 M1's census dummies carry 9999 poise so hitstop is isolated from stagger.
    // Here the opposite is wanted for the death fixture: the target must actually die.
    if (!fx.killable) e.hp = 1e9;
  }
  a.queueInputs(fx.inputs);

  const trace = [];
  for (let i = 0; i < fx.frames; i++) {
    a.step();
    if (fx.guard && e && !e.dead) e.guardRaised = true;   // hold the guard up all run
    for (const ev of a.drain()) trace.push({ ...ev, fixture: fx.name });
  }
  return { trace, log: audio.audioLog({}), stats: audio.audioStats(), audio };
}

const audioData = SABOTAGE && SABOTAGE !== 'anim' && SABOTAGE !== 'silent'
  ? sabotagedClasses(SABOTAGE) : CLASSES;

const allTrace = [];
const allLog = [];
let lastStats = null;
let voicesPeak = 0, stolen = 0, dropped = 0, scheduleMisses = 0;

for (const fx of FIXTURES) {
  const r = runFixture(fx, audioData, { seed: SEED, sabotage: SABOTAGE });
  for (const t of r.trace) allTrace.push(t);
  for (const l of r.log) allLog.push({ ...l, fixture: fx.name });
  lastStats = r.stats;
  voicesPeak = Math.max(voicesPeak, r.stats.voicesPeak);
  stolen += r.stats.stolen; dropped += r.stats.dropped; scheduleMisses += r.stats.scheduleMisses;
}

// One crowded fixture for RI-AUD02 V7 — six attackers, so the impact bus goes over its cap of
// eight and the steal policy has to choose. V7 is a CORRECTNESS rule: a footstep must never
// steal a parry, and a naive global cap drops the parry chime in exactly the fights that matter.
{
  const w = (byTier.medium || [])[0];
  if (w) {
    const a = new NodeArena({ data: D, loadout: { weapon: w } });
    const audio = new ImpactAudio(audioData, { seed: SEED, playerId: 'player' });
    if (SABOTAGE !== 'silent') a.cs.setAudio(audio);
    for (let k = 0; k < 6; k++) {
      const b = a.spawn(`t${k}`, 'mat_flesh', (k - 2.5) * 0.45, 1.15, 180);
      b.hp = 1e9;
    }
    a.lockOn('t0');
    a.queueInputs(Array.from({ length: 12 }, (_, i) => [
      { f: 3 + i * 50, press: ['light'] }, { f: 5 + i * 50, release: ['light'] }]).flat());
    for (let i = 0; i < 650; i++) {
      a.step();
      for (const ev of a.drain()) allTrace.push({ ...ev, fixture: 'voice-storm' });
    }
    for (const l of audio.audioLog({})) allLog.push({ ...l, fixture: 'voice-storm' });
    const s = audio.audioStats();
    voicesPeak = Math.max(voicesPeak, s.voicesPeak);
    stolen += s.stolen; dropped += s.dropped; scheduleMisses += s.scheduleMisses;
    lastStats = s;
  }
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'trace.jsonl'), allTrace.map((e) => JSON.stringify(e)).join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'audio-log.json'), JSON.stringify(allLog, null, 1));

const stats = {
  ...(lastStats || {}),
  run_id: RUN_ID, seed: SEED, sabotage: SABOTAGE || null,
  // Aggregated across fixtures, because the per-fixture driver is fresh each time and the
  // budget question is about the worst moment in the run, not about the last one.
  voicesPeak, stolen, dropped, scheduleMisses,
  fixtures: FIXTURES.length + 1,
  trace_events: allTrace.length, audio_events: allLog.length,
  // The node arena does not run stealth perception, so an enemy never aggros and never attacks.
  // These three classes are therefore NOT EXERCISED here and must be confirmed in the browser;
  // saying so is the difference between an absent class and an unexercised one.
  not_exercised_in_node: ['player_hurt', 'parried', 'riposte', 'backstab', 'stamina_break'],
  not_exercised_why: 'the bare-Node arena runs CombatSystem.step alone; stealth perception, which is what sets alertState=AGGRO and makes an enemy attack or turn its back, runs in Engine only (AGENT-PROTOCOL). Classes requiring an enemy to choose to attack (player_hurt), the player to parry an incoming swing (parried/riposte), an enemy to be facing away (backstab) or the player to run dry (stamina_break) are produced in the browser pass.',
};
fs.writeFileSync(path.join(OUT, 'audio-stats.json'), JSON.stringify(stats, null, 2));

const byClass = {};
for (const l of allLog) byClass[l.class] = (byClass[l.class] || 0) + 1;
process.stdout.write(`${OUT}\n  trace ${allTrace.length} events, audio ${allLog.length} voices\n`);
process.stdout.write(`  classes: ${JSON.stringify(byClass)}\n`);
if (SABOTAGE) process.stdout.write(`  SABOTAGE: ${SABOTAGE}\n`);
