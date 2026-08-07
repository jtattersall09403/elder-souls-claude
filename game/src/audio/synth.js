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

export function dbToGain(db) { return Math.pow(10, db / 20); }
export function gainToDb(g) { return 20 * Math.log10(Math.max(1e-9, g)); }

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
export function makeNoiseBuffer(ctx, colour, seconds, rng, width = 0.5) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  const a = buf.getChannelData(0);
  const b = buf.getChannelData(1);
  const w = Math.min(1, Math.max(0, width));
  const corr = 1 - w;
  const mix = Math.sqrt(Math.max(0, 1 - corr * corr));

  const gen = makeColouredGen(colour);
  const gen2 = makeColouredGen(colour);
  for (let i = 0; i < n; i++) {
    const x = gen(rng);
    const y = gen2(rng);
    a[i] = x;
    b[i] = corr * x + mix * y;
  }
  // Normalise to ±0.9 so `gain_db` in the data means the same thing for every colour. Without
  // this, brown noise (which integrates, so its peak wanders) is 20 dB quieter than white at
  // the same declared gain and every level in the bed data would be a lie about that colour.
  let peak = 0;
  for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(a[i]), Math.abs(b[i])); }
  if (peak > 0) { const k = 0.9 / peak; for (let i = 0; i < n; i++) { a[i] *= k; b[i] *= k; } }
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
 */
export function buildContinuous(ctx, synth, dest, rng, t0 = 0) {
  const out = ctx.createGain();
  out.gain.value = dbToGain(synth.gain_db || 0);
  out.connect(dest);

  const started = [];
  let filter = null;
  let oscs = null;

  if (synth.kind === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, synth.colour, 6, rng, synth.width === undefined ? 0.5 : synth.width);
    src.loop = true;
    filter = applyFilter(ctx, src, synth.filter);
    filter.connect(out);
    src.start(t0);
    started.push(src);
  } else if (synth.kind === 'drone') {
    oscs = [];
    const sum = ctx.createGain();
    sum.gain.value = 1;
    const partials = synth.partials_hz || [];
    const gains = synth.partial_gains_db || [];
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
      o.connect(g); g.connect(sum);
      o.start(t0);
      oscs.push(o);
      started.push(o);
    }
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
  if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); bus.connect(panner); panner.connect(dest); }
  else bus.connect(dest);

  let last = t;
  for (let i = 0; i < (reps.n || 1); i++) {
    const jitter = reps.gap_jitter_s ? (rng.next() * 2 - 1) * reps.gap_jitter_s : 0;
    const at = i === 0 ? t : last + (reps.gap_s || 0) + jitter;
    last = at;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, dbToGain(s.gain_db || -12)), at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + atk + dec);
    g.connect(bus);

    if (s.source === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = makeNoiseBuffer(ctx, s.colour || 'white', Math.max(0.25, atk + dec + 0.05), rng, 0.6);
      const f = applyFilter(ctx, src, s.filter);
      f.connect(g);
      src.start(at);
      src.stop(at + atk + dec + 0.02);
    } else {
      const freqs = s.partials_hz && s.partials_hz.length ? s.partials_hz : [s.freq_hz || 440];
      const pre = s.filter ? ctx.createGain() : g;
      if (s.filter) { const f = applyFilter(ctx, pre, s.filter); f.connect(g); }
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
        o.connect(og); og.connect(pre);
        o.start(at);
        o.stop(at + atk + dec + 0.02);
      }
    }
  }
  return { bus, panner, endsAt: last + atk + dec + 0.02 };
}
