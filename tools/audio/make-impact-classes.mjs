#!/usr/bin/env node
// Authoring tool for `game/data/audio/impact/classes.json` — RI-AUD01 §A/§C, W1-11.
//
// WHY A GENERATOR AND NOT 900 HAND-WRITTEN LINES.
//
// RI-AUD01 §A demands twelve resolution classes and M5 demands **>= 4 sample variants per
// class, never immediately repeating**. That is 48 variants. Hand-authoring 48 blocks invites
// the one failure the item names first — "one `sword.wav`" — because the cheapest way to fill
// 48 blocks is to paste one twelve times. Here each class is one DESIGN ROW (the sonic brief
// out of §A, transcribed), and the four variants are derived from it by a stated, bounded
// perturbation of pitch/decay/filter. The variance is therefore *auditable*: you can read the
// row and know how far apart the four variants are.
//
// The output is DATA and is the thing the game reads. Nothing regenerates it at runtime, so
// perturbing `classes.json` perturbs the fight's sound — which is the CONSUMPTION property
// (RI-MTH07) this whole area is judged on.
//
// `norm_db` is filled in by `tools/audio/calibrate-impact.mjs`, which renders each variant
// offline and solves for the trim that puts its measured peak on §C's declared `peak_dbfs`.
// That is a mix bus in one place, which is RI-AUD02 "How we lose" #7's named remedy.
'use strict';

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// §C — dBFS peak, measured on the class's loudest variant, dry, at 1 m, no distance
// attenuation. The RELATIONSHIPS are binding; the absolute calibration is not.
const PEAK_DBFS = {
  parried: -3.0, riposte: -4.5, backstab: -5.0, hit_flesh_heavy: -6.0,
  hit_flesh_light: -8.0, hit_chitin_light: -8.0, player_hurt: -8.5,
  guard_break: -9.0, blocked: -12.0, stamina_break: -16.0, whiff: -20.0,
  // C12 is not in §C's table; it is scored by M4 (coverage) not M3 (range). Set between
  // riposte and a light hit so a death reads as terminal without out-shouting a parry.
  death: -7.0,
};

/**
 * One layer of an impact voice.
 * role      'transient' | 'body' | 'tail' | 'pre' | 'air' | 'voice'
 * source    'noise' | 'osc'
 * The envelope is attack -> (hold) -> decay, all seconds. A transient has an attack in the
 * low milliseconds; `whiff` deliberately has none, which is what "no transient peak" means.
 */
const L = (o) => o;

// Each class: the §A sonic brief transcribed into layers, plus the variant spread.
// `spread` fields are FRACTIONAL perturbations applied across the four variants at
// [-1, -0.33, +0.33, +1] of the stated amount, so v1..v4 walk the range rather than jitter.
const CLASSES = [
  {
    id: 'hit_flesh_light', code: 'C01', mandatory: true, event: 'HIT',
    brief: 'Wet, short, low-mid body (200-800 Hz), fast decay <120 ms',
    not_confusable_with: ['hit_chitin_light', 'whiff'],
    layers: [
      L({ role: 'transient', source: 'noise', colour: 'pink', gain_db: -9,
          filter: { type: 'bandpass', hz: 900, q: 0.9 },
          env: { attack_s: 0.0015, decay_s: 0.035 } }),
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 210, glide_hz: [260, 120],
          gain_db: -2, env: { attack_s: 0.002, decay_s: 0.085 } }),
      L({ role: 'tail', source: 'noise', colour: 'brown', gain_db: -14,
          filter: { type: 'lowpass', hz: 620, q: 0.7 },
          env: { attack_s: 0.004, decay_s: 0.095 } }),
    ],
    spread: { pitch_frac: 0.12, decay_frac: 0.18, filter_frac: 0.15 },
  },
  {
    id: 'hit_chitin_light', code: 'C02', mandatory: true, event: 'HIT',
    brief: 'Bright hard skid, high transient (2-6 kHz), ringing tail, less low body than C01',
    not_confusable_with: ['hit_flesh_light', 'blocked'],
    layers: [
      L({ role: 'transient', source: 'noise', colour: 'white', gain_db: -3,
          filter: { type: 'highpass', hz: 2600, q: 0.8 },
          env: { attack_s: 0.0008, decay_s: 0.022 } }),
      L({ role: 'tail', source: 'osc', waveform: 'triangle',
          partials_hz: [3400, 4810, 6120], gain_db: -8,
          filter: { type: 'bandpass', hz: 4200, q: 3.0 },
          env: { attack_s: 0.001, decay_s: 0.21 } }),
      // Deliberately 8 dB below C01's body: "*less* low body than C01" is the whole
      // discrimination and it is a level, not a filter.
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 320, gain_db: -18,
          env: { attack_s: 0.002, decay_s: 0.04 } }),
    ],
    spread: { pitch_frac: 0.14, decay_frac: 0.22, filter_frac: 0.18 },
  },
  {
    id: 'hit_flesh_heavy', code: 'C03', mandatory: false, event: 'HIT',
    brief: 'C01 an octave down, longer decay, a crack layer underneath',
    not_confusable_with: ['hit_flesh_light'],
    layers: [
      L({ role: 'transient', source: 'noise', colour: 'pink', gain_db: -8,
          filter: { type: 'bandpass', hz: 520, q: 0.8 },
          env: { attack_s: 0.002, decay_s: 0.055 } }),
      // The octave down. 210 -> 105.
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 105, glide_hz: [130, 62],
          gain_db: -1, env: { attack_s: 0.003, decay_s: 0.19 } }),
      L({ role: 'crack', source: 'noise', colour: 'white', gain_db: -11,
          filter: { type: 'bandpass', hz: 1800, q: 2.2 },
          env: { attack_s: 0.0008, decay_s: 0.045 } }),
      L({ role: 'tail', source: 'noise', colour: 'brown', gain_db: -13,
          filter: { type: 'lowpass', hz: 380, q: 0.7 },
          env: { attack_s: 0.006, decay_s: 0.26 } }),
    ],
    spread: { pitch_frac: 0.10, decay_frac: 0.20, filter_frac: 0.15 },
  },
  {
    id: 'blocked', code: 'C04', mandatory: true, event: 'BLOCK',
    brief: 'Damped thud, absorbed — energy present but NO high transient; shield timbre',
    not_confusable_with: ['hit_chitin_light', 'guard_break'],
    layers: [
      // No transient layer at all. That absence is the class.
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 148, glide_hz: [172, 96],
          gain_db: -2, env: { attack_s: 0.006, decay_s: 0.13 } }),
      L({ role: 'tail', source: 'noise', colour: 'brown', gain_db: -9,
          filter: { type: 'lowpass', hz: 300, q: 0.9 },
          env: { attack_s: 0.008, decay_s: 0.16 } }),
      // Shield timbre: a small wood/hide knock, still under 900 Hz.
      L({ role: 'timbre', source: 'osc', waveform: 'triangle', partials_hz: [430, 640],
          gain_db: -16, filter: { type: 'lowpass', hz: 900, q: 0.7 },
          env: { attack_s: 0.004, decay_s: 0.085 } }),
    ],
    spread: { pitch_frac: 0.13, decay_frac: 0.20, filter_frac: 0.16 },
  },
  {
    id: 'guard_break', code: 'C05', mandatory: true, event: 'GUARD_BREAK',
    brief: 'The block timbre failing: thud that collapses into a scrape and a body sound',
    not_confusable_with: ['blocked'],
    layers: [
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 148, glide_hz: [172, 74],
          gain_db: -4, env: { attack_s: 0.005, decay_s: 0.12 } }),
      // The scrape: a filter that OPENS after the thud is what "collapses into" sounds like.
      L({ role: 'scrape', source: 'noise', colour: 'white', gain_db: -7,
          filter: { type: 'bandpass', hz: 1500, q: 1.1 },
          filter_sweep_hz: [700, 2600],
          env: { attack_s: 0.03, decay_s: 0.30 } }),
      L({ role: 'voice', source: 'osc', waveform: 'sawtooth', partials_hz: [190, 285],
          gain_db: -15, filter: { type: 'lowpass', hz: 1100, q: 0.8 },
          env: { attack_s: 0.02, decay_s: 0.24 } }),
    ],
    spread: { pitch_frac: 0.11, decay_frac: 0.24, filter_frac: 0.20 },
  },
  {
    id: 'parried', code: 'C06', mandatory: true, event: 'PARRY',
    brief: 'The single brightest, cleanest transient in the game. Metallic chime 3-8 kHz',
    not_confusable_with: ['everything — this is the readability keystone'],
    layers: [
      L({ role: 'transient', source: 'noise', colour: 'white', gain_db: -6,
          filter: { type: 'highpass', hz: 4200, q: 0.7 },
          env: { attack_s: 0.0004, decay_s: 0.012 } }),
      // INHARMONIC partials — a struck bell, not a note. This is what makes it read as metal
      // rather than as a UI beep, and it is the one class that must survive a bad speaker.
      L({ role: 'chime', source: 'osc', waveform: 'sine',
          partials_hz: [3180, 4890, 6410, 7720], gain_db: 0,
          filter: { type: 'bandpass', hz: 5200, q: 1.4 },
          env: { attack_s: 0.0006, decay_s: 0.55 } }),
      L({ role: 'tail', source: 'osc', waveform: 'sine', partials_hz: [1590],
          gain_db: -17, env: { attack_s: 0.002, decay_s: 0.34 } }),
    ],
    spread: { pitch_frac: 0.06, decay_frac: 0.14, filter_frac: 0.10 },
  },
  {
    id: 'riposte', code: 'C07', mandatory: true, event: 'RIPOSTE',
    brief: 'Deep single impact with a long tail; deliberately SLOWER than C01',
    not_confusable_with: ['hit_flesh_light', 'backstab'],
    layers: [
      // "Slower than C01" is an ATTACK TIME, and it is the only thing separating C07 from a
      // loud C03. C01's transient attacks in 1.5 ms; this one takes 9.
      L({ role: 'transient', source: 'noise', colour: 'pink', gain_db: -8,
          filter: { type: 'bandpass', hz: 430, q: 0.9 },
          env: { attack_s: 0.009, decay_s: 0.09 } }),
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 88, glide_hz: [112, 52],
          gain_db: 0, env: { attack_s: 0.008, decay_s: 0.42 } }),
      L({ role: 'tail', source: 'noise', colour: 'brown', gain_db: -12,
          filter: { type: 'lowpass', hz: 260, q: 0.7 },
          env: { attack_s: 0.02, decay_s: 0.62 } }),
    ],
    spread: { pitch_frac: 0.09, decay_frac: 0.16, filter_frac: 0.14 },
  },
  {
    id: 'backstab', code: 'C08', mandatory: true, event: 'BACKSTAB',
    brief: 'Like C07 but drier and with a distinct PRE-transient (the blade entering)',
    not_confusable_with: ['riposte'],
    layers: [
      // The pre-transient. `pre_delay_s` is NEGATIVE: it plays 28 ms BEFORE the impact
      // instant, which is the whole of the C07/C08 discrimination and is a timing fact, not
      // a timbre fact.
      L({ role: 'pre', source: 'noise', colour: 'white', gain_db: -13, pre_delay_s: -0.028,
          filter: { type: 'bandpass', hz: 2400, q: 1.6 },
          env: { attack_s: 0.004, decay_s: 0.030 } }),
      L({ role: 'transient', source: 'noise', colour: 'pink', gain_db: -7,
          filter: { type: 'bandpass', hz: 620, q: 1.2 },
          env: { attack_s: 0.003, decay_s: 0.055 } }),
      // Drier: the body decays in 0.20 where C07's runs 0.42, and there is no brown tail.
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 96, glide_hz: [120, 58],
          gain_db: -1, env: { attack_s: 0.004, decay_s: 0.20 } }),
    ],
    spread: { pitch_frac: 0.10, decay_frac: 0.16, filter_frac: 0.15 },
  },
  {
    id: 'whiff', code: 'C09', mandatory: true, event: 'WHIFF',
    brief: 'Air only. Broadband swish, NO transient peak. Quietest class in the table',
    not_confusable_with: ['hit_flesh_light'],
    layers: [
      // A 40 ms attack is what "no transient peak" is. Anything under ~10 ms puts a click on
      // the front and the class stops being air.
      L({ role: 'air', source: 'noise', colour: 'white', gain_db: -2,
          filter: { type: 'bandpass', hz: 1400, q: 0.8 },
          filter_sweep_hz: [600, 3200],
          env: { attack_s: 0.040, decay_s: 0.090 } }),
      L({ role: 'air_low', source: 'noise', colour: 'pink', gain_db: -10,
          filter: { type: 'bandpass', hz: 520, q: 0.7 },
          env: { attack_s: 0.055, decay_s: 0.075 } }),
    ],
    spread: { pitch_frac: 0.18, decay_frac: 0.22, filter_frac: 0.28 },
  },
  {
    id: 'player_hurt', code: 'C10', mandatory: true, event: 'HIT',
    brief: 'Player-side: impact + a vocal effort layer',
    not_confusable_with: ['hit_flesh_light'],
    layers: [
      L({ role: 'transient', source: 'noise', colour: 'pink', gain_db: -10,
          filter: { type: 'bandpass', hz: 760, q: 0.9 },
          env: { attack_s: 0.002, decay_s: 0.04 } }),
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 180, glide_hz: [220, 110],
          gain_db: -5, env: { attack_s: 0.003, decay_s: 0.09 } }),
      // The effort. Two formant-ish partials on a saw, band-limited to a voice range, with a
      // downward glide — a grunt, not a scream (RI-AUD05 owns real vocalisation).
      L({ role: 'voice', source: 'osc', waveform: 'sawtooth', partials_hz: [148, 610],
          gain_db: -3, glide_hz: [168, 122],
          filter: { type: 'bandpass', hz: 780, q: 1.3 },
          env: { attack_s: 0.012, decay_s: 0.26 } }),
    ],
    spread: { pitch_frac: 0.15, decay_frac: 0.20, filter_frac: 0.16 },
  },
  {
    id: 'stamina_break', code: 'C11', mandatory: false, event: 'STAMINA_EMPTY',
    brief: 'Non-diegetic dull negative cue; the "you have nothing left" sound',
    not_confusable_with: ['blocked'],
    layers: [
      // Two tones a minor sixth apart, gliding DOWN. Non-diegetic, so no noise at all — it is
      // the only class in the table with no noise layer, which is what "non-diegetic" is here.
      L({ role: 'tone', source: 'osc', waveform: 'sine', freq_hz: 196, glide_hz: [196, 138],
          gain_db: -3, env: { attack_s: 0.015, decay_s: 0.34 } }),
      L({ role: 'tone2', source: 'osc', waveform: 'sine', freq_hz: 311,
          gain_db: -11, filter: { type: 'lowpass', hz: 900, q: 0.7 },
          env: { attack_s: 0.02, decay_s: 0.28 } }),
    ],
    spread: { pitch_frac: 0.08, decay_frac: 0.14, filter_frac: 0.10 },
  },
  {
    id: 'death', code: 'C12', mandatory: false, event: 'DEATH',
    brief: 'Class-appropriate collapse; terminal, no loop',
    not_confusable_with: [],
    layers: [
      L({ role: 'body', source: 'osc', waveform: 'sine', freq_hz: 74, glide_hz: [96, 44],
          gain_db: -2, env: { attack_s: 0.010, decay_s: 0.55 } }),
      L({ role: 'collapse', source: 'noise', colour: 'brown', gain_db: -6,
          filter: { type: 'lowpass', hz: 420, q: 0.8 },
          filter_sweep_hz: [700, 160],
          env: { attack_s: 0.05, decay_s: 0.80 } }),
      L({ role: 'tail', source: 'noise', colour: 'pink', gain_db: -16,
          filter: { type: 'bandpass', hz: 1100, q: 1.0 },
          env: { attack_s: 0.09, decay_s: 0.65 } }),
    ],
    spread: { pitch_frac: 0.12, decay_frac: 0.18, filter_frac: 0.18 },
  },
];

/** v1..v4 walk the spread rather than jitter around it — see the header. */
const WALK = [-1, -0.3333333333, 0.3333333333, 1];

function scaled(base, frac, w) {
  return +(base * (1 + frac * w)).toFixed(4);
}

function makeVariant(cls, vi) {
  const w = WALK[vi];
  const sp = cls.spread;
  const layers = cls.layers.map((ly) => {
    const out = { ...ly };
    if (out.freq_hz !== undefined) out.freq_hz = scaled(out.freq_hz, sp.pitch_frac, w);
    if (out.glide_hz) out.glide_hz = out.glide_hz.map((h) => scaled(h, sp.pitch_frac, w));
    if (out.partials_hz) out.partials_hz = out.partials_hz.map((h) => scaled(h, sp.pitch_frac, w));
    if (out.filter) out.filter = { ...out.filter, hz: scaled(out.filter.hz, sp.filter_frac, w) };
    if (out.filter_sweep_hz) out.filter_sweep_hz = out.filter_sweep_hz.map((h) => scaled(h, sp.filter_frac, w));
    out.env = {
      ...out.env,
      // Decay walks the OPPOSITE way to pitch: a brighter variant is a shorter one, which is
      // what a real strike does and what keeps four variants from sounding like four takes of
      // the same one detuned.
      decay_s: scaled(out.env.decay_s, sp.decay_frac, -w),
    };
    return out;
  });
  return {
    sample_id: `${cls.id}.v${vi + 1}`,
    // Filled by tools/audio/calibrate-impact.mjs. 0 means "not yet calibrated" and the
    // calibration tool exits non-zero if any variant is still 0 when it is asked to verify.
    norm_db: 0,
    layers,
  };
}

const out = {
  id: 'impact-classes',
  schema: 'es-impact-audio/1',
  spec: 'RI-AUD01 §A (twelve resolution classes), §C (the gain table)',
  owner: 'W1-11 — audio.combat.impact',
  note: [
    'Every class is SYNTHESISED. There is not one sampled audio asset in this repository and',
    'RI-AUD02 §D is a budget document, so thirteen megabytes of impact samples were never an',
    'option. The consequence is better than the constraint: a synth spec can be PERTURBED and',
    'the change heard in a rendered buffer, which is what RI-MTH07 asks of a model and what an',
    'opaque .wav can never provide.',
    'The dry peak of every class is measured through the live gain path and normalised to',
    'peak_dbfs by norm_db. That single place is the mix bus RI-AUD02 "How we lose" #7 names.',
  ],
  buses: ['sfx', 'music', 'ambience', 'voice', 'ui'],
  classes: {},
};

for (const cls of CLASSES) {
  const peak = PEAK_DBFS[cls.id];
  if (peak === undefined) throw new Error(`no §C peak for ${cls.id}`);
  out.classes[cls.id] = {
    code: cls.code,
    mandatory: cls.mandatory,
    trace_event: cls.event,
    brief: cls.brief,
    not_confusable_with: cls.not_confusable_with,
    peak_dbfs: peak,
    bus: cls.id === 'stamina_break' ? 'ui' : 'sfx',
    // C11 is non-diegetic (§A) and C10 is the player's own body (RI-AUD02 S4): neither is
    // panned. Everything else is a thing in the world at a bearing.
    spatialised: !(cls.id === 'stamina_break' || cls.id === 'player_hurt'),
    variants: [0, 1, 2, 3].map((i) => makeVariant(cls, i)),
  };
}

const dest = process.argv[2] || 'game/data/audio/impact/classes.json';
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
const nv = Object.values(out.classes).reduce((a, c) => a + c.variants.length, 0);
process.stdout.write(`wrote ${dest}: ${Object.keys(out.classes).length} classes, ${nv} variants\n`);
