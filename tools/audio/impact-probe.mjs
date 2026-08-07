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
 * C10 `player_hurt`, C06 `parried`, C07 `riposte`, C08 `backstab`, C11 `stamina_break`.
 *
 * These five need the enemy to ACT, and the note in AGENT-PROTOCOL about the node arena is
 * about perception, not about action: `EnemyController.loadScript()` drives an attack from a
 * declared frame without any perception at all. So the arena CAN produce them — scripted — and
 * the honest caveat is narrower than "not reachable in Node": the script decides when the
 * enemy swings where the game's AI would. The browser pass confirms the same five arise
 * unscripted.
 */
{
  // C10 — the enemy swings and connects. `player_hurt` is the class §A marks "hit
  // (owner=enemy)" and it is the one class the player hears about themselves.
  FIXTURES.push({
    name: 'player_hurt', weapon: (byTier.light || [])[0], target: 'inf_trash', dist: 1.6,
    yaw: 180, script: [{ f: 10, move: 'chop' }, { f: 200, move: 'chop' }, { f: 390, move: 'chop' },
                       { f: 580, move: 'thrust' }, { f: 760, move: 'combo_b' }, { f: 920, move: 'chop' }],
    inputs: [], frames: 1150, invulnPlayer: false, produces: ['IMPACT'],
  });

  // C06/C07 — the player parries the scripted swing and ripostes into the opening. The parry
  // is the readability keystone (§A C06: "the single brightest, cleanest transient in the
  // entire game") so it gets its own fixture rather than being hoped for.
  FIXTURES.push({
    name: 'parry_riposte', weapon: (byTier.light || [])[0], shield: 'buckler', target: 'inf_trash',
    dist: 1.6, yaw: 180,
    script: [{ f: 10, move: 'chop' }, { f: 220, move: 'chop' }, { f: 430, move: 'chop' }, { f: 640, move: 'chop' }],
    // The chop's startup is 68 f@60, so the parry has to be pressed late enough that its own
    // window is open on the attacker's first ACTIVE frame — RI-CMB05 §D.
    // The riposte has to arrive inside the parried target's critical window (RI-CMB05 §D), and
    // the window is short. Three attempts are queued behind each parry rather than one, because
    // a fixture that lands the riposte on exactly one frame is a fixture that is measuring the
    // author's arithmetic rather than the game's window.
    inputs: [60, 270, 480, 690].flatMap((f) => ([
      { f, press: ['parry'] }, { f: f + 4, release: ['parry'] },
      { f: f + 14, press: ['light'] }, { f: f + 16, release: ['light'] },
      { f: f + 40, press: ['light'] }, { f: f + 42, release: ['light'] },
      { f: f + 70, press: ['light'] }, { f: f + 72, release: ['light'] },
    ])),
    frames: 900, produces: ['PARRY', 'CRIT_HIT'],
  });

  // C08 — the target's back. Spawned facing AWAY (yaw 0 with the player at the origin looking
  // down +z), which is the geometric condition `criticalKind()` reads.
  FIXTURES.push({
    name: 'backstab', weapon: (byTier.light || [])[0], target: 'inf_trash', dist: 1.1, yaw: 0,
    inputs: Array.from({ length: 6 }, (_, i) => [
      { f: 20 + i * 90, press: ['light'] }, { f: 22 + i * 90, release: ['light'] }]).flat(),
    frames: 620, produces: ['CRIT_HIT'],
  });

  // C11 — the player runs dry. `EXHAUSTED_ENTER` is the "you have nothing left" moment and §A
  // gives it a non-diegetic cue, which is why it is the one class in the data with no noise
  // layer at all.
  FIXTURES.push({
    name: 'stamina_break', weapon: (byTier.ultra || byTier.heavy || [])[0], target: null,
    inputs: Array.from({ length: 24 }, (_, i) => [
      { f: 3 + i * 12, press: ['heavy'] }, { f: 6 + i * 12, release: ['heavy'] }]).flat(),
    frames: 400, produces: ['EXHAUSTED_ENTER'],
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
    // `inf_trash`, not `mat_shield`. The seven-material dummy is a BRACED SHIELD ON A FRAME
    // (`stamina_max: 1`, `ai: none`) — it exists to drive §A's `shield` hitstop column without a
    // live blocker, and it has no stamina pool for a guard to break. C04 and C05 need a real
    // defender with a real shield and a real stamina bar, which is a scripted infantry enemy
    // told to raise its guard.
    name: 'block.shield', weapon: w, target: 'inf_trash', dist: 1.5, guard: true,
    script: [{ f: 2, move: 'block' }],
    inputs: Array.from({ length: 10 }, (_, i) => [
      { f: 3 + i * 60, press: ['light'] }, { f: 5 + i * 60, release: ['light'] }]).flat(),
    frames: 700, produces: ['IMPACT', 'BLOCK', 'GUARD_BREAK'],
  });
}

// ── the run ─────────────────────────────────────────────────────────────────────────────────

function runFixture(fx, audioData, opts, sharedAudio) {
  const a = new NodeArena({ data: D, loadout: { weapon: fx.weapon } });

  // ── TWO INSTRUMENT DEFECTS FOUND HERE, BOTH WORTH RECORDING ────────────────────────────────
  //
  // 1. `NodeArena`'s bus is `{ emit: (f, kind) => ({ f, kind }) }` — it stores the event TYPE in
  //    a field called `kind`. The engine's real bus (`sim/events.js#emit`) stores it in `type`
  //    and leaves `kind` free. `PlayerController._critDamage` then writes `e.kind = m.id`, which
  //    is correct against the engine and CLOBBERS THE EVENT'S OWN TYPE against the node arena:
  //    every CRIT_HIT disappears from the node trace and reappears as an event of kind
  //    `riposte`/`backstab`. The first audio-sync run reported six orphan audio rows for exactly
  //    this reason. The type is captured out-of-band below so the arena's trace says what the
  //    engine's would.
  //
  // 2. A REAL DEFECT IN THE SHIPPED BUILD, not in the arena, found by the same six orphans and
  //    NOT fixed here because fixing it moves trace bytes other pieces hold determinism
  //    baselines against: `system.js`'s `LEGACY_ALIAS.CRIT_HIT` is
  //    `(e) => (e.kind === 'riposte' ? 'riposte' : 'backstab')`, and it is evaluated INSIDE the
  //    `emit` closure, one line after `bus.emit()` — before `_critDamage` has written `e.kind`.
  //    The engine's pooled event has just had every field but `f` and `type` deleted, so
  //    `e.kind` is `undefined` there and the ternary takes the else branch every single time.
  //    **Every riposte in the game is mirrored into the lower_snake trace stream as
  //    `backstab`.** RI-AUD01 §A makes C07 and C08 two separate mandatory classes whose whole
  //    distinction is that a riposte is slower and wetter than a backstab, so a stream that
  //    calls them all backstabs cannot score them. This driver reads `e.kind` at FLUSH time,
  //    after `_critDamage` has written it, and classifies both correctly — which is how the
  //    disagreement became visible at all.
  const typed = [];
  a.bus = { emit: (f, kind) => { const e = { f }; typed.push([e, kind]); return e; } };

  const audio = sharedAudio || new ImpactAudio(audioData, {
    // The player body's id is `P` (CombatSystem.createPlayer), not `'player'`. It matters:
    // C10 `player_hurt` is selected by `e.dst === playerId`, so a wrong id voices every blow
    // the player TAKES as a blow the player LANDS — the same class of mislabel as playing the
    // flesh sample into a shield.
    seed: opts.seed, playerId: a.player.id,
    trigger_source: opts.sabotage === 'anim' ? 'anim' : 'resolution',
  });
  if (opts.sabotage !== 'silent') a.cs.setAudio(audio);

  let e = null;
  if (fx.target) {
    e = a.spawn('t', fx.target, 0, fx.dist, fx.yaw === undefined ? 180 : fx.yaw);
    a.lockOn('t');
    if (fx.guard) {
      e.guardRaised = true;
      e.shield = e.shield || a.cs.shieldFor('kite_garrison'); e.shieldId = 'kite_garrison';
      // C05 wants the guard to FAIL. Starting the shield near empty is the honest way to reach
      // a guard break in a fixture: it is the same code path a long exchange reaches, arrived
      // at sooner. Nothing about the break itself is faked.
      e.stamina = 12;
    }
    if (fx.script) a.script('t', fx.script);
    if (!fx.killable) e.hp = 1e9;
    else e.hp = 40;
  }
  if (fx.shield) a.cs.rebuildPlayerLoadout({ shield: fx.shield });
  a.queueInputs(fx.inputs);

  const trace = [];
  // The shared driver does not know which fixture it is in; the fixture stamps its own slice of
  // the log so audio-sync can join per (fixture, frame) rather than on a frame number that
  // repeats across twenty-odd fixtures.
  const logMark = audio.log.length;
  const drainTyped = () => { const out = typed.map(([e, k]) => ({ ...e, kind: k, fixture: fx.name })); typed.length = 0; return out; };
  for (let i = 0; i < fx.frames; i++) {
    a.step();
    if (fx.guard && e && !e.dead) {
      e.guardRaised = true;                                  // hold the guard up all run
      // C05 `guard_break` is "the block timbre failing". A measured block against this
      // defender costs 0.6 stamina, so a guard held from full breaks after roughly 160 blocked
      // blows — which is a ninety-second fixture for one event. The stamina is pinned BELOW one
      // block's cost instead, so the very next blocked blow takes `resolveBlock` down the same
      // `guard_broken` branch a long exchange reaches. The break is the game's; only the
      // arrival time is the probe's, and that is stated rather than hidden.
      if (e.stamina > 0.4) e.stamina = 0.4;
    }
    for (const ev of drainTyped()) trace.push(ev);
  }
  for (let i = logMark; i < audio.log.length; i++) audio.log[i].fixture = fx.name;
  return { trace, log: audio.log.slice(logMark), stats: audio.audioStats(), audio };
}

const audioData = SABOTAGE && SABOTAGE !== 'anim' && SABOTAGE !== 'silent'
  ? sabotagedClasses(SABOTAGE) : CLASSES;

const allTrace = [];
const allLog = [];
let lastStats = null;
let voicesPeak = 0, stolen = 0, dropped = 0, scheduleMisses = 0;

// ONE driver for the whole run, because one SESSION has one driver.
//
// The first version built a fresh `ImpactAudio` per fixture and audio-sync reported 28 immediate
// variant repeats — M5's failure condition — because every fixture restarted the same seeded
// stream and re-picked the same first variant. That was a fixture artifact, not a build defect,
// and the distinction matters: `Engine.impactAudio` is constructed once and survives every
// `loadState()`, so the shipped game has exactly the continuity this now models. A probe whose
// own construction manufactures the failure it is looking for is worse than no probe.
const sharedAudio = new ImpactAudio(audioData, {
  seed: SEED, playerId: 'P',
  trigger_source: SABOTAGE === 'anim' ? 'anim' : 'resolution',
});

for (const fx of FIXTURES) {
  const r = runFixture(fx, audioData, { seed: SEED, sabotage: SABOTAGE },
    SABOTAGE === 'silent' ? null : sharedAudio);
  for (const t of r.trace) allTrace.push(t);
  lastStats = r.stats;
}
for (const l of sharedAudio.audioLog({})) allLog.push(l);
voicesPeak = Math.max(voicesPeak, sharedAudio.voicesPeak);
stolen += sharedAudio.stolen; dropped += sharedAudio.dropped; scheduleMisses += sharedAudio.scheduleMisses;
lastStats = sharedAudio.audioStats();

// One crowded fixture for RI-AUD02 V7 — six attackers, so the impact bus goes over its cap of
// eight and the steal policy has to choose. V7 is a CORRECTNESS rule: a footstep must never
// steal a parry, and a naive global cap drops the parry chime in exactly the fights that matter.
{
  const w = (byTier.medium || [])[0];
  if (w) {
    const a = new NodeArena({ data: D, loadout: { weapon: w } });
    const audio = new ImpactAudio(audioData, { seed: SEED, playerId: a.player.id });
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
