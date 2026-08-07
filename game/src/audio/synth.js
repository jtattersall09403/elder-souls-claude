// The ambience synthesiser. W1-22, `audio.ambience.region`. Spec: RI-AUD03 §A.
//
// WHY THIS FILE EXISTS AT ALL, AND WHY IT SYNTHESISES.
//
// The survey that opened W1-22 found the following, and it is worth writing down because
// every audio number this project has ever quoted was quoted against it:
//
//   * `grep -rn 'AudioContext|createOscillator|createGain|decodeAudioData' game/src` returned
//     NOTHING. There was no audio code in this build of any kind.
//   * There is not one .ogg/.wav/.mp3/.opus file in the repository. `audioMB: 0` was true.
//   * The only thing in the engine with 'sound' in its name is `sim/stealth/detection.js`'s
//     `soundRadius()`, which is a PERCEPTION model — how far a guard can hear you — and emits
//     no audio whatsoever. An agent grepping for 'sound' finds a live, well-instrumented
//     subsystem and can easily mistake it for the audio system. It is not one.
//   * `game/data/world/regions.json` gives each of thirteen regions an `audio: [...]` array of
//     three identifier strings — 39 strings in total — and a prose `ambient_text`. NOTHING IN
//     THE BUILD READ EITHER. That is the whole of the evidence on which eight of nine audio
//     axes were previously scored.
//
// So the choice was between shipping another declaration and shipping something that makes a
// sample. Streaming thirteen distinct 30-second loops is not available: RI-AUD02's whole
// subject is the byte and voice budget, and thirteen loops is tens of megabytes of assets that
// do not exist and cannot be authored here. The alternative is to SYNTHESISE the bed, and it
// turns out to be the better answer rather than the cheaper one:
//
//   1. **It costs 67 KB of JSON for the entire province** — versus roughly half a megabyte for
//      one 30-second stereo Vorbis loop. RI-AUD02's budget stops being a constraint.
//   2. **A synth spec is inspectable, so a probe can perturb it.** RI-MTH07 requires a named
//      world-side consumer demonstrated by perturbing the model and watching behaviour change.
//      You cannot perturb an .ogg. You can move an L1 partial from 110 Hz to 220 Hz and watch
//      the rendered spectrum move, which is exactly what `tools/analysis/ambience-render.mjs`
//      does.
//   3. **It renders offline.** The same graph builder runs in an `OfflineAudioContext`, so the
//      evidence for "this region is audible and different from that one" is a PCM buffer and
//      its spectrum — not an event count. An event count is not a sound.
//
// The code is deliberately written against `BaseAudioContext`, never against `AudioContext`,
// so that the live path (a speaker) and the measurement path (an offline render) are THE SAME
// CODE. A measurement path that is a second implementation measures the second implementation.
'use strict';

/** Attack/decay envelopes shorter than this are inaudible clicks; clamp rather than reject. */
const MIN_ENV_S = 0.0005;

/**
 * RI-AUD03 §A, the L1 row: "looped, gapless, **≥30 s of material**". Round 1 used 6.
 *
 * Six seconds of brown noise is not six seconds of texture — it is one random walk with two or
 * three large slow excursions in it, and looping it repeats those excursions on a six-second
 * cycle for as long as the region is loaded. `tools/analysis/ambience-onsets.mjs` caught it in
 * the Stone Wastes, whose L1 is the quietest in the game with `L2: null` behind it: the same two
 * swells arrived at 0.77 s and 3.12 s past every single buffer boundary — 0.77, 3.12, 6.77, 9.12,
 * 15.12, 21.12 — and muting L1 removed every one of them. That is the loop being audible AS a
 * loop, which is the exact failure the "≥30 s" clause exists to prevent, and it was in every
 * region with a noise layer rather than only the one quiet enough to expose it.
 *
 * The cost is memory: 30 s of stereo float at 48 kHz is ~11.5 MB per noise layer, against ~2.3 MB
 * at six. A bed holds one to three of them and the old ones are released after the 4 s region
 * crossfade. That is real and it is the item's own number; RI-AUD02's budget is about SHIPPED
 * BYTES, and this costs none — the buffer is generated, not loaded.
 */
const LOOP_SECONDS = 30;

export function dbToGain(db) { return Math.pow(10, db / 20); }
export function gainToDb(g) { return 20 * Math.log10(Math.max(1e-9, g)); }

// ---- deterministic summation (RI-AUD03 R3) ---------------------------------------------------

/**
 * ROUND 3. WHY THE MIXING TOPOLOGY IS PART OF THE SPECIFICATION AND NOT AN IMPLEMENTATION DETAIL.
 *
 * RI-AUD03 R3 gives up HARNESS.md §8's permission for non-simulation code to use unseeded
 * randomness, in its own words, so that "two runs of the same scenario produce the same ambience"
 * — because otherwise "audioLog diverges between runs and the blind pack is not reproducible".
 * Every blind measurement this piece is scored on (B1, B2, B3) is a comparison between
 * recordings, so all of them rest on that rule.
 *
 * Round 2 found, and honestly declined to explain, that two interior beds (`street` and `well`)
 * did not render reproducibly at a fixed seed with no perturbation at all between the captures.
 * Round 3 measured it. Every PRNG in this subsystem was already seeded and the schedules were
 * identical; the divergence was in the rendered floats, at 3e-8 (about −150 dBFS), on roughly
 * half of all samples, starting at sample 0.
 *
 * THE CAUSE IS NOT IN THIS FILE, and it was proved from outside it before a line was changed.
 * `tools/analysis/ambience-determinism.mjs --only-control` renders bare `OscillatorNode` →
 * `GainNode` graphs containing no Elder Souls code at all, twice each, and compares the floats:
 *
 *     1 source into one node   identical
 *     2 sources into one node  identical
 *     3 sources into one node  DIVERGES, max 1.49e-8
 *     8 sources into one node  DIVERGES, max 4.47e-8
 *
 * One and two are exact because IEEE-754 addition is commutative: `a + b` and `b + a` are the
 * same bits, and `x + 0` is `x`. Three is where it breaks, because addition is NOT associative —
 * `(a + b) + c` and `a + (b + c)` differ by up to one unit in the last place. So the platform is
 * summing a node's inputs in an order that is not fixed by the graph, and the run-to-run
 * difference is exactly one float32 ULP. It is also INTERMITTENT — a width that diverges on one
 * run can come out clean on the next — which is why nothing in rounds 1 or 2 caught it and why a
 * single green from a flat topology is worth nothing.
 *
 * THE REMEDY IS TOPOLOGICAL. If no node ever receives more than two connections that are
 * simultaneously non-zero, the sum is exact whatever order the platform picks, because the only
 * orders available are `a + b` and `b + a`. So every place in this subsystem where three or more
 * signals meet now meets them two at a time, in an order the graph fixes. The same control tool
 * proves the remedy at every width it proves the defect at.
 *
 * The audio cost is one unity `GainNode` per extra input and a change to the output of at most
 * one ULP — far below the precision of any level, spectrum or loudness this project reports, so
 * no calibrated number in the bed data is invalidated by it.
 */

/**
 * Connect `nodes` so that they sum into one output without any node receiving more than two
 * connections. Returns the tail of the chain, which the caller connects onward.
 *
 * Left-leaning rather than balanced on purpose: the order is then a plain function of the array,
 * so two builds of the same bed produce the same tree and a reader can predict it.
 */
export function joinChain(ctx, nodes) {
  if (!nodes.length) return null;
  // DELETE-THE-FIX, and it must cover BOTH sites or the arm is only half an arm. The first
  // version of this control gated the bus ladder alone; `street` (three layers summing on the
  // bus) went red under it and `well` (a four-partial chord summing in one node) stayed green,
  // because the chord chain was still in place. Two beds, two halves of one defect. The flag now
  // restores a flat N-input summation everywhere the fix chained.
  if (globalThis.__ES_AUDIO_FLAT_MIX) {
    const flat = ctx.createGain();
    flat.gain.value = 1;
    for (const n of nodes) n.connect(flat);
    return flat;
  }
  let acc = nodes[0];
  for (let i = 1; i < nodes.length; i++) {
    const j = ctx.createGain();
    j.gain.value = 1;
    acc.connect(j);
    nodes[i].connect(j);
    acc = j;
  }
  return acc;
}

/**
 * The ambience bus, as a fixed ladder of lanes that sum two at a time.
 *
 * A chain built lazily as sources arrive would work offline — every grain in an offline render is
 * created before `startRendering()` — but the live driver schedules grains while audio is
 * flowing, and re-plumbing a running graph for every drip would both click and grow without
 * bound. So the ladder is allocated once, at a fixed width, and callers take a lane:
 *
 *   `reserve()` — a permanent lane, for a voice that runs for as long as the bed does (L1, each
 *                 L2 sublayer, a continuous emitter). Reset on a region swap, so the outgoing and
 *                 incoming generations share a lane during the 4 s crossfade. That is two
 *                 simultaneously non-zero signals in one node, which is exact.
 *   `lane()`    — the next rotating lane, for a transient grain. Grains in the same lane are
 *                 separated by every other rotating lane before it comes round again, and the
 *                 longest grain in the province is under two seconds against event intervals of
 *                 eight seconds and up, so a lane never carries two sounding grains at once. A
 *                 grain that is not sounding contributes exactly 0.0, and `x + 0` is `x`.
 *
 * The width is twice RI-AUD02 §D V5's eight-voice cap for the ambience bus, so the structure
 * cannot be the thing that runs out before the budget does.
 *
 * DELETE-THE-FIX (RULES.md rule 6). Setting `globalThis.__ES_AUDIO_FLAT_MIX` makes every lane the
 * destination itself, which is exactly the round-2 topology, on the same tree and the same commit
 * with no file edited and nothing staged. `tools/analysis/ambience-determinism.mjs --sabotage
 * flatmix` is the arm that uses it, and D1 must go red under it or the check is inert.
 */
export const MIX_LANES = 16;

export class DeterministicMixer {
  constructor(ctx, dest, lanes = MIX_LANES) {
    this.ctx = ctx;
    this.dest = dest;
    this.flat = !!globalThis.__ES_AUDIO_FLAT_MIX;
    this.reserved = 0;
    this.rotating = 0;
    this.lanes = [];
    if (this.flat) return;
    for (let i = 0; i < lanes; i++) {
      const g = ctx.createGain();
      g.gain.value = 1;
      this.lanes.push(g);
    }
    const tail = joinChain(ctx, this.lanes);
    if (tail) tail.connect(dest);
  }

  /** A lane held for the lifetime of a continuous voice. */
  reserve() {
    if (this.flat) return this.dest;
    return this.lanes[Math.min(this.reserved++, this.lanes.length - 1)];
  }

  /** The next rotating lane, for a one-shot. */
  lane() {
    if (this.flat) return this.dest;
    const base = Math.min(this.reserved, this.lanes.length - 1);
    const span = Math.max(1, this.lanes.length - base);
    const g = this.lanes[base + (this.rotating % span)];
    this.rotating++;
    return g;
  }

  /** A region swap starts a new generation of continuous voices. See the class note. */
  resetReservations() { this.reserved = 0; }
}

/**
 * Resolve a destination that may be a `DeterministicMixer` or a plain `AudioNode`. Keeping both
 * shapes legal means a caller that has no mixer (a unit test, a probe rendering one layer) does
 * not have to build one to use `buildContinuous` or `buildGrain`.
 */
export function sinkFor(dest, transient = false) {
  if (dest && typeof dest.reserve === 'function') return transient ? dest.lane() : dest.reserve();
  return dest;
}

// ---- noise ---------------------------------------------------------------------------------

/**
 * A stereo noise buffer with CONTROLLED CORRELATION between the channels.
 *
 * `width` 0 gives two identical channels (a point source, dead centre — Thornmarsh's dead-air
 * room tone, which must have no distance in it at all); `width` 1 gives two independent
 * channels (Marauder's Coast's open sea floor, which is the widest thing in the game). This is
 * done at buffer-build time rather than with a panner because it is the honest way to widen
 * noise: panning a mono source only moves it, it never makes it bigger.
 *
 * Brown and pink are integrated/filtered white rather than approximated, so their spectral
 * slopes are real (−6 dB and −3 dB per octave) and a spectral-centroid measurement over the
 * rendered PCM means what it says.
 */
export function makeNoiseBuffer(ctx, colour, seconds, rng, width = 0.5, loop = false) {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * seconds));
  // ROUND 2 — THE LOOP SEAM. `loop` buffers are generated LONGER than they are returned and the
  // tail is cross-faded back over the head, so that sample `n-1` runs into sample `0` smoothly.
  //
  // Round 1 generated exactly `n` samples and set `src.loop = true`. Brown noise is an integrated
  // random walk, so its first and last values are uncorrelated and typically far apart: wrapping
  // stepped, and a step is a click. RI-AUD03 §A requires L1 to be "looped, GAPLESS"; it was not,
  // and the click landed once per buffer length, forever, in every region with a noise layer.
  //
  // It was invisible because it was masked — until `tools/analysis/ambience-onsets.mjs` measured
  // the Stone Wastes, whose L1 is a brown drone at −16 dB with L2 declared `null`. With no bed to
  // hide behind, the seam read as a discrete sound event 10 dB over the floor, arriving at 3.12,
  // 9.12, 15.12, 21.12, 27.12 s — exactly the 6.0 s buffer period. The one region quiet enough to
  // expose the defect was also the one region reporting transients, and they were all this.
  //
  // The fade is 0.25 s, which is long relative to the correlation time of even brown noise, so
  // the wrap is smooth rather than merely continuous. It costs one extra `xf` samples of
  // generation and nothing at playback.
  const xf = loop ? Math.min(n >> 1, Math.round(sr * 0.25)) : 0;
  const gen = makeColouredGen(colour);
  const gen2 = makeColouredGen(colour);
  const w = Math.min(1, Math.max(0, width));
  const corr = 1 - w;
  const mix = Math.sqrt(Math.max(0, 1 - corr * corr));

  const ta = new Float64Array(n + xf), tb = new Float64Array(n + xf);
  for (let i = 0; i < n + xf; i++) {
    const x = gen(rng), y = gen2(rng);
    ta[i] = x;
    tb[i] = corr * x + mix * y;
  }
  for (let i = 0; i < xf; i++) {
    const f = i / xf;                       // 0 at the head, 1 by the end of the fade
    ta[i] = ta[i] * f + ta[n + i] * (1 - f);
    tb[i] = tb[i] * f + tb[n + i] * (1 - f);
  }
  // Brown noise wanders off zero, and a DC offset in a looped buffer is a second way to click —
  // the offset itself is inaudible but the step from it to the next layer's is not. Remove it
  // before normalising, so the peak normalisation below measures signal rather than offset.
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += ta[i]; mb += tb[i]; }
  ma /= n; mb /= n;

  const buf = ctx.createBuffer(2, n, sr);
  const a = buf.getChannelData(0);
  const b = buf.getChannelData(1);
  // Normalise to ±0.9 so `gain_db` in the data means the same thing for every colour. Without
  // this, brown noise (which integrates, so its peak wanders) is 20 dB quieter than white at
  // the same declared gain and every level in the bed data would be a lie about that colour.
  let peak = 0;
  for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(ta[i] - ma), Math.abs(tb[i] - mb)); }
  const k = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < n; i++) { a[i] = (ta[i] - ma) * k; b[i] = (tb[i] - mb) * k; }
  return buf;
}

function makeColouredGen(colour) {
  if (colour === 'white') return (rng) => rng.next() * 2 - 1;
  if (colour === 'brown') {
    let last = 0;
    return (rng) => { last = (last + 0.02 * (rng.next() * 2 - 1)) / 1.02; return last * 3.5; };
  }
  // pink — Paul Kellet's economical filter, −3 dB/octave.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return (rng) => {
    const white = rng.next() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const out = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
    return out;
  };
}

// ---- graph pieces --------------------------------------------------------------------------

function applyFilter(ctx, node, spec) {
  if (!spec) return node;
  const f = ctx.createBiquadFilter();
  f.type = spec.type;
  f.frequency.value = spec.hz;
  f.Q.value = spec.q === undefined ? 1 : spec.q;
  node.connect(f);
  return f;
}

/**
 * A modulation LFO. `depth` is a FRACTION of the target's base value in every case, which is
 * what makes the same field in the bed data readable across three different kinds of target.
 *
 * The gain case deliberately biases the base down by half the depth and swings by half, so a
 * `depth: 1.0` gain modulation reaches silence at the trough rather than clipping at the peak.
 * Ambience that modulates ABOVE its declared level is how a bed eats RI-AUD01's combat headroom
 * without any single number in the data looking wrong (RI-AUD03 §How we lose, item 3).
 *
 * ROUND 2, AND THIS IS THE BUG THE ROUND-1 CRITIC ROOT-CAUSED. `amt.gain.value` is an ABSOLUTE
 * number and `amt.connect(targets.gain.gain)` is an ADDITIVE AudioParam connection, so the swing
 * is not a fraction of anything once someone multiplies the static term afterwards. Round 1's
 * `buildBedContinuous()` did exactly that — it scaled `h.gain.gain.value` by `level_db` and the
 * bed trim AFTER this function had run — so the layer's instantaneous gain was
 *
 *     base·(1 − d/2)·L·trim   +   sin(2πft)·base·(d/2)
 *     └── follows the trim ──┘       └── did not ──────┘
 *
 * A declared 42 % tremolo on Valus Ridge was running at an effective 155 % and the gain parameter
 * went NEGATIVE at every trough, phase-inverting the rock-flute chord once every nine seconds; and
 * `bed_gain_db` was a scalar on one term and a no-op on the other, which is why `--calibrate`'s
 * one-shot `target − measured` correction under-corrected and had to be iterated.
 *
 * The fix is the `gainMul` argument to `buildContinuous()`: every static factor is folded into
 * `out.gain.value` BEFORE this function reads it, so `base` is the layer's true final level and
 * the swing scales with it. Nothing downstream may touch `out.gain.value` again.
 */
function attachMod(ctx, mod, targets, t0) {
  if (!mod) return null;
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = mod.lfo_hz;
  const amt = ctx.createGain();
  lfo.connect(amt);
  if (mod.target === 'gain') {
    const base = targets.gain.gain.value;
    targets.gain.gain.value = base * (1 - mod.depth * 0.5);
    amt.gain.value = base * mod.depth * 0.5;
    amt.connect(targets.gain.gain);
  } else if (mod.target === 'filter_hz' && targets.filter) {
    amt.gain.value = targets.filter.frequency.value * mod.depth;
    amt.connect(targets.filter.frequency);
  } else if (mod.target === 'pitch' && targets.oscs) {
    amt.gain.value = mod.depth * 1200;
    for (const o of targets.oscs) amt.connect(o.detune);
  }
  lfo.start(t0);
  return lfo;
}

/**
 * Build one CONTINUOUS layer (L1, or an L2 sublayer) and connect it to `dest`.
 * Returns a handle whose `gain` node is the layer's fader — the crossfade in `ambience.js`
 * ramps that and nothing else, so a region change is one automatable parameter per layer.
 *
 * `gainMul` is every STATIC factor the caller wants applied to this layer — `level_db` and the
 * bed's master trim — and it must be passed here rather than multiplied into `gain` afterwards,
 * because `attachMod()` below splits `out.gain.value` into a biased static term and an absolute
 * LFO swing and a later multiplication only reaches the first of the two. See `attachMod`.
 */
export function buildContinuous(ctx, synth, dest, rng, t0 = 0, gainMul = 1) {
  const out = ctx.createGain();
  out.gain.value = dbToGain(synth.gain_db || 0) * gainMul;
  // A continuous layer holds its lane for as long as the bed does. See `DeterministicMixer`.
  out.connect(sinkFor(dest, false));

  const started = [];
  let filter = null;
  let oscs = null;

  if (synth.kind === 'noise') {
    const src = ctx.createBufferSource();
    // `loop: true` on the LAST argument, not just on the source: the buffer has to be built to
    // wrap (see `makeNoiseBuffer`) or `src.loop` clicks once per period for as long as the
    // region is loaded.
    src.buffer = makeNoiseBuffer(ctx, synth.colour, LOOP_SECONDS, rng,
                                 synth.width === undefined ? 0.5 : synth.width, true);
    src.loop = true;
    filter = applyFilter(ctx, src, synth.filter);
    filter.connect(out);
    src.start(t0);
    started.push(src);
  } else if (synth.kind === 'drone') {
    oscs = [];
    const partials = synth.partials_hz || [];
    const gains = synth.partial_gains_db || [];
    const voices = [];
    for (let i = 0; i < partials.length; i++) {
      const o = ctx.createOscillator();
      o.type = synth.waveform || 'sine';
      o.frequency.value = partials[i];
      // Detune alternates sign across partials so the chord BEATS rather than merely sitting
      // sharp. Stone Wastes' dying Hist is Stone Forest's chord with this widened to 47 cents;
      // the beating is what makes it audibly the same instrument, broken (RI-AUD03 R6).
      o.detune.value = (synth.detune_cents || 0) * (i % 2 === 0 ? 1 : -1);
      const g = ctx.createGain();
      g.gain.value = dbToGain(gains[i] === undefined ? -12 : gains[i]);
      o.connect(g);
      voices.push(g);
      o.start(t0);
      oscs.push(o);
      started.push(o);
    }
    // ROUND 3 — the chord sums TWO PARTIALS AT A TIME. Four partials into one gain node is the
    // exact shape `--only-control` shows diverging by a float ULP run to run, and the well's L1
    // (a four-partial shaft resonance) was one of the two beds that would not render twice the
    // same. See the `DeterministicMixer` note above.
    const sum = joinChain(ctx, voices) || (() => { const g = ctx.createGain(); g.gain.value = 1; return g; })();
    filter = applyFilter(ctx, sum, synth.filter);
    filter.connect(out);
  } else {
    throw new Error(`buildContinuous: unknown synth kind ${JSON.stringify(synth.kind)}`);
  }

  const lfo = attachMod(ctx, synth.mod, { gain: out, filter, oscs }, t0);
  if (lfo) started.push(lfo);
  return { gain: out, filter, oscs, started, stop(t) { for (const s of started) { try { s.stop(t); } catch { /* already stopped */ } } } };
}

/**
 * Build one GRAIN (an L3 or L4 one-shot, or an emitter strike) scheduled at absolute time `t`.
 *
 * `pan` and `gainMul` are passed in rather than read from the spec because the positional
 * emitters (RI-AUD03 R7) compute both analytically from the player's position and bearing —
 * see `ambience.js#emitterPlacement`. Doing it here with a `PannerNode` would hide the numbers
 * inside the audio graph, and B6 has to be able to assert that pan and gain vary monotonically
 * along a 200 m transect. A number a probe cannot read is a number a probe cannot fail on.
 */
export function buildGrain(ctx, ev, dest, rng, t, pan = 0, gainMul = 1) {
  const s = ev.synth;
  const env = s.env || { attack_s: 0.01, decay_s: 0.2 };
  const atk = Math.max(MIN_ENV_S, env.attack_s || MIN_ENV_S);
  const dec = Math.max(MIN_ENV_S, env.decay_s || MIN_ENV_S);
  const reps = s.repeats || { n: 1, gap_s: 0, gap_jitter_s: 0 };
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const bus = ctx.createGain();
  bus.gain.value = dbToGain((ev.level_db || 0)) * gainMul;
  // ROUND 3 — a grain is transient, so it takes a ROTATING lane rather than reserving one. See
  // `DeterministicMixer`: the whole point is that the ambience bus never sums three simultaneously
  // sounding signals in an order the graph has not fixed.
  const sink = sinkFor(dest, true);
  if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); bus.connect(panner); panner.connect(sink); }
  else bus.connect(sink);

  const strikes = [];
  let last = t;
  for (let i = 0; i < (reps.n || 1); i++) {
    const jitter = reps.gap_jitter_s ? (rng.next() * 2 - 1) * reps.gap_jitter_s : 0;
    const at = i === 0 ? t : last + (reps.gap_s || 0) + jitter;
    last = at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, dbToGain(s.gain_db || -12)), at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + atk + dec);
    strikes.push(g);

    if (s.source === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, s.colour || 'white', Math.max(0.25, atk + dec + 0.05), rng, 0.6);
      const f = applyFilter(ctx, src, s.filter);
      f.connect(g);
      src.start(at);
      src.stop(at + atk + dec + 0.02);
    } else {
      const freqs = s.partials_hz && s.partials_hz.length ? s.partials_hz : [s.freq_hz || 440];
      const partialGains = [];
      for (let k = 0; k < freqs.length; k++) {
        const o = ctx.createOscillator();
        o.type = s.waveform || 'sine';
        o.frequency.setValueAtTime(freqs[k], at);
        if (s.glide_hz && k === 0) {
          o.frequency.setValueAtTime(s.glide_hz[0], at);
          o.frequency.linearRampToValueAtTime(s.glide_hz[1], at + atk + dec);
        }
        const og = ctx.createGain();
        og.gain.value = k === 0 ? 1 : 0.4 / k;
        o.connect(og);
        partialGains.push(og);
        o.start(at);
        o.stop(at + atk + dec + 0.02);
      }
      // Same rule as the drone chord: partials meet two at a time.
      const summed = joinChain(ctx, partialGains);
      if (summed) {
        if (s.filter) { const f = applyFilter(ctx, summed, s.filter); f.connect(g); }
        else summed.connect(g);
      }
    }
  }
  // The repeats of one grain (`roof_rat` is six taps 0.09 s apart with a 0.10 s decay, so they DO
  // overlap) meet two at a time as well, for the same reason.
  const strikeTail = joinChain(ctx, strikes);
  if (strikeTail) strikeTail.connect(bus);
  return { bus, panner, endsAt: last + atk + dec + 0.02 };
}
