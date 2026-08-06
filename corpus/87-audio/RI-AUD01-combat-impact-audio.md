---
id: RI-AUD01
title: Combat impact audio as frame-critical feedback
kind: number
side: souls
judges: [audio.combat.impact, combat.feedback.hitstop]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `souls`.** Impact audio is *inside the fight* and Souls is
> authoritative (ARBITRATION §1, "Damage resolution", "Frames & timing"). Impact sound is not
> decoration and is not art direction — it is the **feedback channel that tells the player what
> the geometry decided**. A hit that the player cannot hear is a hit the player did not get
> told about, and a deterministic hit-or-miss system that is not reported is indistinguishable
> from a dice roll.
>
> **This item claims `combat.feedback.hitstop` as a judge.** Before this item existed that path
> was judged by RI-CAM06 and by **RI-MTH03 — a blind-comparison protocol document, not an
> impact specification.** A protocol cannot be a bar. That mis-map is BAR-CRITIQUE-01 **G5**;
> this item partially closes it (the visual/hitstop half is owed by RI-CMB09).

## The bar

When a swing resolves, the player must know **which of twelve things happened** without looking
at the health bar, and must know it **on the frame the geometry decided it**. Souls' combat is
legible because every resolution class has its own transient: the wet crunch of steel into
flesh, the bright ringing skid of steel off chitin, the muffled thud into a raised shield, the
unmistakable *chime* of a parry, the embarrassing airy swish of a whiff. A player with the
screen off can call a Souls fight. That is the bar, stated literally: **blindfold the critic and
it must still score the fight.**

Two properties make it work and both are measurable. **Latency**: the sound is emitted at the
hitbox-connect frame, not at animation start, not "some time after" — an audio event that
drifts from its frame turns a 12-frame punish window into a guess, and is a correctness bug of
the same class as a hitbox that lags its animation. **Dynamic range**: a whiff must not be as
loud as a hit. If every resolution arrives at the same level, the mix has erased the information
the classes exist to carry, and twelve distinct samples become one undifferentiated noise.

Souls audio is also **sparse by construction**. Footsteps, breathing, armour rattle and the room
tone are what make the boss roar land. A mix that is busy at rest has nowhere to go when
something matters. Sparseness is not an aesthetic here; it is headroom.

**Unimplemented audio scores 0, not "not assessed".** See §Scoring.

## The reference artifact

### §A — The twelve resolution classes

Every one of these is a **distinct sample set** with a distinct spectral signature. The nine
marked **M** are mandatory; a missing mandatory class is a hard fail.

| # | Class id | Trace `event.type` | M? | Sonic brief | Must NOT be confusable with |
|---|---|---|---|---|---|
| C01 | `hit_flesh_light` | `hit` | **M** | Wet, short, low-mid body (200–800 Hz), fast decay <120 ms | C02, C09 |
| C02 | `hit_chitin_light` | `hit` | **M** | Bright hard skid, high transient (2–6 kHz), ringing tail, *less* low body than C01 | C01, C04 |
| C03 | `hit_flesh_heavy` | `hit` | – | C01 an octave down, longer decay, a crack layer underneath | C01 |
| C04 | `blocked` | `block` | **M** | Damped thud, absorbed — energy present but *no* high transient; shield timbre | C02, C05 |
| C05 | `guard_break` | `stagger` | **M** | The block timbre failing: thud that collapses into a scrape and a body sound | C04 |
| C06 | `parried` | `parry` | **M** | The single brightest, cleanest transient in the entire game. Metallic chime, 3–8 kHz, unmissable | everything — this is the readability keystone |
| C07 | `riposte` | `riposte` | **M** | Deep single impact with a long tail; deliberately *slower* than C01 | C01, C08 |
| C08 | `backstab` | `backstab` | **M** | Like C07 but drier and with a distinct pre-transient (the blade entering) | C07 |
| C09 | `whiff` | `attack_start`+no hit | **M** | Air only. Broadband swish, no transient peak. **Quietest class in the table** | C01 |
| C10 | `player_hurt` | `hit` (owner=enemy) | **M** | Player-side: impact + a vocal effort layer (see RI-AUD05 §C) | C01 |
| C11 | `stamina_break` | `stamina_spend` at 0 | – | Non-diegetic dull negative cue; the "you have nothing left" sound | C04 |
| C12 | `death` | `death` | – | Class-appropriate collapse; terminal, no loop | – |

**Variants.** Each class carries **≥ 4 sample variants**, selected round-robin with the seeded
PRNG (D1), never immediately repeating the previous variant. One sample per class is repetition
fatigue and is a fail (M5).

### §B — The frame contract

```
frame f:  hitbox becomes active, sweep tests, geometry decides -> events[] gets {"f":f,"type":"hit",...}
frame f:  audio scheduler is handed (class, gain, pan, f)          <- SAME FRAME, no deferral
          scheduler computes playAt = ctx.currentTime + lead      <- lead is a fixed constant
          source.start(playAt)                                    <- ahead-of-time, see RI-AUD02
```

The rule in one line: **`audio.frame` for an impact event MUST equal the `f` of the trace event
that caused it.** Not the animation-start frame. Not the next frame. Not "whenever the rAF
callback got round to it".

The single most common way this breaks is real and specific: the sound is triggered from the
**animation event track** (`atk_light` frame 7, "play swing sound") rather than from the
**hit resolution**. That plays the impact even when the swing whiffs, plays it before the
geometry has decided, and plays the same sound whether the target was flesh, chitin, or a raised
shield. It is the exact failure this item exists to detect, and it is scored by M1 and M7.

### §C — The gain table (dynamic range)

Levels are dBFS peak, measured on the class's loudest variant, dry, at 1 m, no distance
attenuation. The **relationships** are binding; the absolute calibration is not.

| Class | Peak dBFS | Relative to C01 |
|---|---|---|
| C06 `parried` | −3.0 | **+5 dB** |
| C07 `riposte` | −4.5 | +3.5 |
| C08 `backstab` | −5.0 | +3.0 |
| C03 `hit_flesh_heavy` | −6.0 | +2.0 |
| C01 `hit_flesh_light` | −8.0 | 0 (reference) |
| C02 `hit_chitin_light` | −8.0 | 0 |
| C10 `player_hurt` | −8.5 | −0.5 |
| C05 `guard_break` | −9.0 | −1.0 |
| C04 `blocked` | −12.0 | −4.0 |
| C11 `stamina_break` | −16.0 | −8.0 |
| **C09 `whiff`** | **−20.0** | **−12.0** |

The load-bearing rows are the top and the bottom. `parried` is the loudest event in the game
because it is the highest-information event in the game. `whiff` is 12 dB below a landed hit
because **"I hit nothing" and "I hit something" must not arrive at the same volume** — that is
the entire dynamic-range requirement in one comparison.

### §D — The sparseness budget (headroom)

| Context | Concurrent non-combat voices | Sustained LUFS-S |
|---|---|---|
| Exploration, no enemies | ≤ 6 (ambience beds + footsteps + cloth) | −26 to −22 |
| Ordinary combat | ≤ 12 | −22 to −18 |
| Boss fight | ≤ 20 (music included) | −18 to −14 |

An exploration mix louder than −22 LUFS-S has spent the headroom the boss needs. This is the
audio statement of the same principle as RI-AUD04's music budget: **silence is a resource.**

## Comparison method

Requires the harness audio extensions requested in §Provenance note. If they are absent, stop
and score **0** (fail-closed, HARNESS.md §5).

1. **Produce a combat trace with audio.** Run a scenario that forces every mandatory class:

   ```bash
   node tools/harness/run-headless.mjs --scenario aud-impact-matrix --seed 1337 \
        --audio-log --audio-capture
   # writes reports/runs/<runId>/{trace.jsonl,audio-log.json,audio.wav,audio-stats.json}
   ```

   `aud-impact-matrix` must contain, against a chitin-armoured and an unarmoured enemy:
   ≥8 landed light hits on each, ≥4 heavy hits, ≥6 whiffs, ≥6 blocks, ≥3 guard breaks,
   ≥3 parries, ≥3 ripostes, ≥3 backstabs, ≥6 player-hurt events, ≥2 deaths.

2. **M1 — frame offset.** Join `audio-log.json` to `trace.jsonl` on causing event:

   ```bash
   node tools/analysis/audio-sync.mjs --run reports/runs/<runId>
   # -> {n, offset_frames:{p50,p95,p99,max}, fired_on_anim_start:<count>, orphans:<count>}
   ```

   For every trace event in {`hit`,`block`,`parry`,`riposte`,`backstab`,`stagger`,`death`},
   compute `|audioLog.frame − event.f|`. Record p50, p95, p99, max.
   Also count **`fired_on_anim_start`**: audio events whose frame equals an `attack_start`
   frame and which have no corresponding resolution event within ±1 frame.

3. **M2 — blind class distinguishability.** Slice `audio.wav` at each audio-log timestamp into
   600 ms clips, strip filenames to hashes, shuffle:

   ```bash
   node tools/blind/audio-pack.mjs --run reports/runs/<runId> --out packs/aud-w<N>
   ```

   Spawn **one fresh judge per clip** (no project context, has not read this file). Prompt
   verbatim:

   ```
   Listen to this short sound effect from a video game combat system.
   In one line, answer: which of these happened?

   A weapon hitting unarmoured flesh / a weapon hitting armour or shell /
   a heavy weapon hitting flesh / a blow absorbed by a raised shield /
   a guard being broken / a parry / a riposte or critical / a backstab /
   a weapon swinging through empty air / the player being hurt /
   running out of stamina / something dying

   Answer with exactly one of those phrases and nothing else.
   ```

   Build the 12×12 confusion matrix. Report overall accuracy and the worst confused pair.

4. **M3 — dynamic range.** From `audio.wav` and the audio log, take per-class peak dBFS and
   RMS over the clip. Compute `peak(C09 whiff) − peak(C01)` and check every row of §C to
   ±3 dB tolerance on the *relative* column.

5. **M5 — variants.** From `audio-log.json`, count distinct `sample_id` per class, and count
   immediate repeats (same `sample_id` twice in a row within a class).

6. **M6 — spatialisation.** For enemy-sourced impacts, correlate `audioLog.pan` against the
   enemy's bearing from the player in the trace frame. Pearson r over ≥20 events.

7. **M8 — sparseness.** From `audio-stats.json`, `voicesPeak` per context, and integrated
   LUFS-S from `audio.wav` over exploration / combat / boss windows.

## Scoring

Nine checks. Native scale is **checks passed / 9**.

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| M1 | Frame offset | `offset_frames.p99 ≤ 1` **and** `max ≤ 2` | `p50 > 1` |
| M2 | Blind distinguishability | accuracy ≥ 0.85, no pair confused > 15% | accuracy < 0.50 |
| M3 | Dynamic range | every §C relative value within ±3 dB | `peak(whiff) ≥ peak(C01) − 6 dB` |
| M4 | Class coverage | all 9 mandatory classes present, distinct assets | any mandatory class missing or aliased to another |
| M5 | Variants | ≥4 per class, 0 immediate repeats | ≤1 variant on any mandatory class |
| M6 | Spatialisation | r ≥ 0.8 pan vs bearing | no panner at all |
| M7 | Source of truth | `fired_on_anim_start == 0` | any animation-track-triggered impact |
| M8 | Sparseness | all three §D rows in band | exploration LUFS-S > −18 |
| M9 | Determinism | two runs, same seed, identical audio-log `sample_id` sequence | unseeded variant choice |

**Verdict bands.** 9/9 → meets the bar (ladder ceiling 8). 6–8/9 → below bar, named remedy
required (ceiling 6). ≤5/9 → loses outright (ceiling 4). **Any hard fail caps the piece at 2**
(SCORING §1.1).

**Unimplemented audio scores 0, not "not assessed".** If `window.__HARNESS.audioLog` is absent,
if `audioLog()` returns `[]` across a scenario that produced ≥20 resolution events, or if the
game plays no sound at all, this item scores **0** on every check, the piece's `audio.*` score
is **0**, and the critic records `measured: "unmeasurable"` (SCORING §1.1: unmeasurable ⇒ 0).
A build with no audio does not get a pass on the grounds that audio was out of scope this wave.
It gets a zero, and the zero appears in the roll-up until sound exists.

**What we lose looks like:**
```
M1 offset_frames: p50 7, p99 19, max 34   fired_on_anim_start: 61
M2 accuracy 0.31   worst pair: hit_flesh_light <-> whiff (72% confused)
M3 peak(whiff) -8.4 dBFS, peak(C01) -8.0 dBFS   -> delta 0.4 dB
=> M1 HARD FAIL (animation-track triggered), M3 HARD FAIL. Piece capped at 2.
Diagnosis: one "sword.wav" fires from the swing animation. The game has one
combat sound and it plays whether or not anything was hit.
```

## How we lose

- **One `sword.wav`.** The single most likely outcome. Impact audio is added late, from a
  free sample pack, triggered off the animation. It fires on whiffs, it is the same on flesh
  and chitin, and it is at the same level as everything else. M1, M2, M3, M4 and M7 all fail
  together, and they fail *as one bug*, which is why they are separate checks: fixing the
  trigger source without adding classes still leaves M2 at 0.31.
- **The parry chime is not special.** C06 is scored like any other hit. The single most
  information-dense moment in Souls combat arrives at the same volume as a light hit, and
  players stop parrying because they cannot tell whether it worked. Detection: M3 row C06.
- **Audio is scheduled from rAF.** The sound fires "next frame, when we render". On this
  machine's software renderer, "next frame" can be 300 ms. M1's p99 explodes and nobody
  connects it to the renderer because it sounds fine on a fast desktop. RI-AUD02 §B is the
  structural fix; M1 is the detector.
- **Latency is measured in the wrong place.** Someone measures `ctx.outputLatency`, finds
  12 ms, and declares the budget met. `outputLatency` is device latency; it says nothing about
  whether the game *asked* on the right frame. M1 measures the game's decision, which is the
  part we control.
- **Distance attenuation eats the whiff distinction.** Whiff is quiet by design (§C); apply
  distance rolloff on top and it becomes inaudible entirely, so the player gets *no* feedback
  on a miss rather than *quiet* feedback. "I heard nothing" and "the game is broken" are the
  same experience. Guard: C09 has a floor, not just a ceiling — it must be audible above the
  §D exploration bed at 1 m.
- **We score audio by listening to it ourselves.** The critic plays the game, says the hits
  sound punchy, and writes a 7. No capture, no confusion matrix, no frame offset. This is
  RI-MTH04 fraud: a verdict with no artifact. The blind confusion matrix in M2 exists because
  "sounds punchy" and "carries twelve distinguishable states" are unrelated properties, and
  only the second one is the bar.
- **The classes exist as files but collapse in the mix.** Twelve well-designed samples, all
  compressed to the same loudness by a master limiter set too hard. M3 catches it; the fix is
  a mix bus, not new samples. Expect this one, because a limiter is the standard reflex for a
  mix that clips in boss fights, and it silently destroys §C.
- **Sparseness is read as "not much audio yet".** An empty mix in wave 1 scores well on §D by
  accident, then fills up with ambience and never comes back down. §D is a *budget*, and a
  budget that is only ever approached from below has not been tested.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **structure** — impact audio as frame-critical feedback, per-resolution-class sample sets,
parry as the loudest transient, whiff well below a landed hit, sparse beds to leave headroom —
is `canonical-recall` from the Souls series' design and is high-confidence as a *principle*.
The **numbers** are `constructed`: the §C dB table, the ±3 dB tolerance, the 0.85 confusion
accuracy, the ≥4 variants, the §D LUFS bands and the ≤1 frame offset are all authored here
because no upstream published figures exist. Per CORPUS-CONTRACT §3 they are binding anyway —
a constructed bar we can measure beats a real number we cannot. Confidence is `medium` rather
than `high` because the §C relative levels have not been validated against a mix that exists,
and the 0.85 confusion threshold is a guess at what a fresh judge can do on 600 ms clips; both
should be re-tuned after the first real run and the amendment recorded here.

**Harness additions requested** (HARNESS.md §10 amendment, owed by the harness owner). Note
that HARNESS.md §3 currently lists audio under "**Cannot, and must not be claimed**" — that
sentence is what this item is asking to amend, and until it is amended every audio item is
correctly scored 0.

```js
audioLog(opts?: {sinceFrame?: number}): [{
  t: number,           // ctx.currentTime at schedule call, seconds
  frame: number,       // SIM frame at which the game decided to play this
  playAt: number,      // ctx.currentTime the source was scheduled to start
  event: string,       // trace event type that caused it, or "ambience"|"music"|"foley"
  class: string,       // §A class id, e.g. "hit_chitin_light"
  sample_id: string,   // which variant (M5, M9)
  gain: number,        // linear, pre-bus
  pan: number,         // -1..1 (M6)
  voice_id: string,    // for voice-count accounting (RI-AUD02)
  bus: string          // "sfx"|"music"|"ambience"|"voice"|"ui"
}]

audioCapture(opts: {fromFrame, toFrame}): Promise<{
  sampleRate, channels, pcm_b64   // OfflineAudioContext render of the same graph
}>
```

`audioCapture` is the load-bearing one and is easy to underestimate: this machine has **no
audio device**, so without an offline render there is no waveform, and M2/M3/M8 are permanently
unmeasurable. The requirement it imposes on the builder is real and should be stated up front —
the audio graph must be constructible against an `OfflineAudioContext` as well as a live one,
which means no direct dependence on `AudioContext` singletons at module scope.
