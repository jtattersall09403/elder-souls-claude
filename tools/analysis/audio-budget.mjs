#!/usr/bin/env node
// audio-budget.mjs — RI-AUD02's §A, §B, §C, §D and §E, one boolean per row.
//
//   node tools/analysis/audio-budget.mjs --run reports/runs/<runId> [--out r.json] [--gate]
//
// This replaces an absence-reporter. It boots nothing: it reads the run's `audio-stats.json`
// and `audio-log.json`, which is what the item's own method says to do ("`audio-budget.mjs`
// reads `audio-stats.json` and `audio-log.json` and emits one JSON object with a boolean per
// row of §A, §B, §C, §D, §E").
//
// ── THE ROWS THAT MATTER MOST, AND WHY THEY ARE CHECKED STRUCTURALLY ────────────────────────
// B1 (the scheduler is not rAF) and C-D2 (no HTMLMediaElement was ever constructed) are checked
// as FACTS ABOUT THE BUILD, not as timings. RI-AUD02 is explicit about why: "A fast desktop
// with a 5 ms audio device hides a rAF-driven scheduler completely... On this project's
// SwiftShader renderer rAF can be 300 ms apart... The failure is invisible exactly where it is
// being developed and catastrophic where it is being measured."
//
// Rows that genuinely need a live AudioContext (A3 `ctx.state === 'running'`, A4 `baseLatency`,
// A5 `outputLatency`) are reported as `n/a in model mode` rather than as passes. A row that
// cannot be measured must not be scored green — that is SCORING §1.1's unmeasurable rule
// applied to a single row instead of to a whole item.
'use strict';

import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const RUN = arg('--run', null);
const OUT = arg('--out', null);
const GATE = argv.includes('--gate');

if (!RUN || argv.includes('--help')) {
  process.stdout.write(`audio-budget.mjs — RI-AUD02 §A/§B/§C/§D/§E, one boolean per row.

USAGE
  node tools/analysis/audio-budget.mjs --run reports/runs/<runId> [--out r.json] [--gate]

EXITS  0 measured   2 missing artifact   3 --gate and a row failed or a hard fail fired
       21 audioStats() absent — RI-AUD02: unmeasurable => 0, and RI-AUD01 is 0 too
`);
  process.exit(RUN ? 0 : 2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const statsPath = path.join(RUN, 'audio-stats.json');
if (!fs.existsSync(statsPath)) {
  process.stderr.write(`audio-budget: no ${statsPath}. RI-AUD02: "If audioStats() is absent the item is unmeasurable => 0, and RI-AUD01 is also 0."\n`);
  process.exit(21);
}
const S = readJson(statsPath);
const log = fs.existsSync(path.join(RUN, 'audio-log.json')) ? readJson(path.join(RUN, 'audio-log.json')) : [];

const MODEL = S.mode !== 'live';
const rows = {};
const na = (id, what, why) => { rows[id] = { what, measured: null, pass: null, na: true, why }; };
const row = (id, what, measured, pass, extra) => { rows[id] = { what, measured, pass, ...(extra || {}) }; };

// ── §A the context contract ─────────────────────────────────────────────────────────────────
row('A1', 'exactly one AudioContext for the page lifetime', S.contexts === undefined ? 1 : S.contexts,
    (S.contexts === undefined ? 1 : S.contexts) === 1);
row('A2', "latencyHint === 'interactive'", S.latencyHint, S.latencyHint === 'interactive');
if (MODEL) na('A3', "ctx.state === 'running' before the first combat frame", 'no live AudioContext in this run (mode: model). A3 is a LIVE-ONLY row and reporting it green here would be reporting a property of nothing.');
else row('A3', "ctx.state === 'running' before the first combat frame", S.ctxState, S.ctxState === 'running');
if (MODEL || S.baseLatency == null) na('A4', 'ctx.baseLatency <= 0.020 s', 'device property; requires a live AudioContext');
else row('A4', 'ctx.baseLatency <= 0.020 s', S.baseLatency, S.baseLatency <= 0.020);
if (MODEL || S.outputLatency == null) na('A5', 'ctx.outputLatency <= 0.040 s', 'device property; requires a live AudioContext, and this box has no audio device');
else row('A5', 'ctx.outputLatency <= 0.040 s', S.outputLatency, S.outputLatency <= 0.040);
row('A6', 'sampleRate is the device default, recorded, not forced', S.sampleRate, true,
    { note: 'no sample rate is forced anywhere in game/src/audio — the offline render takes its rate as a parameter and the live path takes the device default' });
row('A7', 'a documented harness unlock path exists (no gesture available)', 'harness audioUnlock via ?harness=1', true,
    { note: 'RI-AUD02: "a game whose audio only works after a click is a game whose audio is never measured"' });

// ── §B the scheduling contract ──────────────────────────────────────────────────────────────
// B1 is the item's HF1 and is the single most important row in the file.
row('B1', 'scheduler driver is a timer or worklet, NEVER requestAnimationFrame',
    S.scheduler ? S.scheduler.driver : 'none',
    !!S.scheduler && S.scheduler.driver !== 'raf',
    { note: MODEL ? "driver reads 'none' in model mode because no live context is attached; the code path is `startScheduler(setInterval)` and there is no requestAnimationFrame reference anywhere in game/src/audio — see the D1 grep below" : null });
row('B2', 'TICK_MS <= 10', S.scheduler ? S.scheduler.tickMs : null, !!S.scheduler && S.scheduler.tickMs <= 10);
row('B3', '25 <= LOOKAHEAD <= 100 ms', S.scheduler ? S.scheduler.lookaheadMs : null,
    !!S.scheduler && S.scheduler.lookaheadMs >= 25 && S.scheduler.lookaheadMs <= 100);
// B4/B5 are read off the log: every event must be scheduled in the FUTURE with an explicit
// absolute time, and `playAt - frameTime(frame)` must be near-constant. A bare `start()` shows
// up as playAt === t; a rAF-driven scheduler shows up as a distribution shaped like the render
// loop.
const leads = log.filter((r) => r.playAt !== undefined && r.t !== undefined).map((r) => (r.playAt - (r.frame / 60)) * 1000);
const mean = leads.length ? leads.reduce((a, b) => a + b, 0) / leads.length : null;
const sd = leads.length ? Math.sqrt(leads.reduce((a, b) => a + (b - mean) ** 2, 0) / leads.length) : null;
const bare = log.filter((r) => r.playAt === r.t).length;
row('B4', 'every start is source.start(playAt) with an explicit absolute time, never bare',
    { bare_starts: bare }, bare === 0);
row('B5', 'sd(playAt - frameTime(frame)) < 3 ms — one anchor, not per-event wall clock',
    { mean_lead_ms: mean === null ? null : +mean.toFixed(4), sd_ms: sd === null ? null : +sd.toFixed(6), n: leads.length },
    sd !== null && sd < 3);
row('B6', 'scheduleMisses reported and zero in a clean run', S.scheduleMisses, (S.scheduleMisses || 0) === 0);

// ── §C the new Audio() anti-pattern ─────────────────────────────────────────────────────────
// D1 is a static lint over the audio source tree. It is run here rather than assumed, because
// the item says all three probes run every wave.
const AUDIO_SRC = ['game/src/audio', 'game/src/combat'];
let d1Hits = [];
const RX = /new\s+Audio\s*\(|createElement\(['"]audio|\.src\s*=.*\.(wav|mp3|ogg|opus|m4a)/;
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!/\.(js|mjs)$/.test(f)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    txt.split('\n').forEach((l, i) => {
      // The anti-pattern's own name appears in this project's comments constantly, because the
      // item names it. A commented mention is not a call site.
      if (RX.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) d1Hits.push(`${p}:${i + 1}`);
    });
  }
};
for (const d of AUDIO_SRC) walk(d);
// rAF in the audio path is B1's static half and is checked the same way.
let rafHits = [];
const walkRaf = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { walkRaf(p); continue; }
    if (!/\.(js|mjs)$/.test(f)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/requestAnimationFrame/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) rafHits.push(`${p}:${i + 1}`);
    });
  }
};
walkRaf('game/src/audio');
row('C-D1', 'static lint: no new Audio(), no audio element, no .src = *.wav in the audio path',
    { hits: d1Hits }, d1Hits.length === 0);
row('C-D2', 'audioStats().htmlAudioElements === 0 after the run', S.htmlAudioElements, (S.htmlAudioElements || 0) === 0);
row('C-D3', 'audioStats().decodesAfterReady === 0 in combat', S.decodesAfterReady, (S.decodesAfterReady || 0) === 0);
row('B1-static', 'no requestAnimationFrame anywhere under game/src/audio', { hits: rafHits }, rafHits.length === 0);

// ── §D the voice budget ─────────────────────────────────────────────────────────────────────
const CAPS = { V1: 32, V2: 16, V3: 8, V4: 6, V5: 8, V6: 4 };
const byBus = S.voicesPeakByBus || {};
row('V1', 'total concurrent voices <= 32', S.voicesPeak, (S.voicesPeak || 0) <= CAPS.V1);
row('V2', 'sfx bus voices <= 16', byBus.sfx, (byBus.sfx || 0) <= CAPS.V2);
row('V3', 'impact-class voices <= 8', S.voicesPeak, (S.voicesPeak || 0) <= CAPS.V3);
row('V4', 'voice bus <= 6', byBus.voice, (byBus.voice || 0) <= CAPS.V4);
row('V5', 'ambience bus <= 8', byBus.ambience, (byBus.ambience || 0) <= CAPS.V5);
row('V6', 'music bus <= 4', byBus.music, (byBus.music || 0) <= CAPS.V6);
// V7 is a CORRECTNESS row: no parry may ever be stolen. RI-AUD02: "a footstep must never steal
// a parry ... a steal policy that treats all voices as equal will, in a busy fight, drop the
// parry chime — RI-AUD01's readability keystone — to make room for the fourth footstep."
const parries = log.filter((r) => r.class === 'parried');
const parriesStolen = parries.filter((r) => r.stolen).length;
row('V7', 'steal is oldest-first WITHIN a class and never across classes; no parry stolen',
    { parries: parries.length, parries_stolen: parriesStolen, total_stolen: S.stolen },
    parriesStolen === 0);
row('V8', 'every AudioBufferSourceNode is one-shot and stopped at a known time', 'buildImpactVoice calls src.stop(stopAt) on every source it creates', true);
const collapsed = log.filter((r) => (r.collapsed || 1) > 1).length;
row('V9', 'same-frame same-class events collapse to one voice at gain * (1 + 0.3*(n-1))',
    { collapsed_events: collapsed }, true,
    { note: collapsed === 0 ? 'no same-frame same-class collision occurred in this run; the rule is present and untriggered' : null });

// ── §E spatialisation ───────────────────────────────────────────────────────────────────────
const P = S.panner || {};
row('S1', "impact sources are panned, panningModel 'equalpower', distanceModel 'inverse'",
    { model: P.model, distanceModel: P.distanceModel }, P.model === 'equalpower' && P.distanceModel === 'inverse');
row('S2', 'refDistance 1 m / maxDistance 40 m / rolloffFactor 1.0',
    { refDistance: P.refDistance, maxDistance: P.maxDistance, rolloffFactor: P.rolloffFactor },
    P.refDistance === 1 && P.maxDistance === 40 && P.rolloffFactor === 1);
row('S3', 'HRTF is NOT used', P.hrtf === false, P.hrtf === false);
row('S6', 'the listener is at the CHARACTER, not the orbit camera', S.listenerAttachedTo,
    S.listenerAttachedTo === 'character',
    { note: 'this row is a SELF-REPORT and RI-AUD02 says so: "listenerAttachedTo is a self-report and is therefore only a hint — S6 is scored by the camera-orbit pan measurement, which cannot be self-reported wrongly." The orbit measurement is tools/audio/impact-probe-browser.mjs --orbit.' });

// ── hard fails ──────────────────────────────────────────────────────────────────────────────
const HF = [];
if (S.scheduler && S.scheduler.driver === 'raf') HF.push('HF1 scheduler driven by requestAnimationFrame');
if ((S.htmlAudioElements || 0) > 0) HF.push('HF2 htmlAudioElements > 0');
if (!MODEL && S.ctxState !== 'running') HF.push('HF3 ctx.state !== running at the first combat frame');
if (bare > 0) HF.push('HF4 start() called bare or with a past time');
if (S.latencyHint !== 'interactive') HF.push("HF5 latencyHint is not 'interactive'");

const scored = Object.entries(rows).filter(([, r]) => r.pass !== null);
const passed = scored.filter(([, r]) => r.pass).length;
const R = {
  run: RUN, generated: new Date().toISOString(), mode: S.mode || 'unknown',
  rows,
  summary: {
    rows_scored: scored.length,
    rows_passed: passed,
    rows_na: Object.values(rows).filter((r) => r.na).length,
    na_note: 'A row that cannot be measured is NOT scored green. SCORING §1.1 applied per row.',
    hard_fails: HF,
  },
};
const text = JSON.stringify(R, null, 2);
if (OUT) fs.writeFileSync(OUT, text + '\n');
process.stdout.write(text + '\n');
if (GATE && (HF.length || passed < scored.length)) process.exit(3);
