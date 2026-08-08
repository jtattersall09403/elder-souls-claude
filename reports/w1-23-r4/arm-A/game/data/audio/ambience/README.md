# `elder-souls/ambience-bed@1` — the thirteen regional beds

W1-22, subsystem path `audio.ambience.region`. Spec: `corpus/87-audio/RI-AUD03-regional-ambience.md`.

## What this is, and what it replaced

Before this directory existed, the whole of the province's audio was **39 identifier strings**
in `game/data/world/regions.json` (`"audio": ["amb_insect_wall", ...]`) and a prose
`ambient_text` per region. **Nothing in the build read either.** There was no audio code in
`game/src` of any kind — no `AudioContext`, no oscillator, no decode — and not one `.ogg`,
`.wav` or `.mp3` in the repository. `getWorldStats().audioMB` reported `0` and it was true.

Eight of nine audio axes had nonetheless been *scored*, by reading those strings.

These thirteen files are the bed those strings described. They are consumed by
`game/src/audio/ambience.js`, driven from `Engine._afterStep()`, and rendered to real PCM by
`Engine.ambienceCapture()`.

## Why it is synthesised rather than sampled

There are no audio assets and there is no way to author thirteen distinct 30-second loops here.
More importantly, RI-AUD02's whole subject is the byte and voice budget, and thirteen streamed
loops is roughly **6.5 MB** of Vorbis. **The entire province's ambience in this directory is
36.9 KB of JSON.**

The second reason matters more than the first. **A synth spec can be perturbed and an `.ogg`
cannot.** RI-MTH07 requires a world-side consumer demonstrated by moving the model and watching
behaviour change; with a sampled bed the only available demonstration is "a different file name
was requested", which is an event count wearing a sound's clothes. With a synthesised bed you
can move an L1 partial from 110 Hz to 220 Hz, re-render, and watch the measured spectral
centroid move — which is what `tools/analysis/ambience-render.mjs` does.

## The four layers (RI-AUD03 §A)

| Key | Role | Interval | Notes |
|---|---|---|---|
| `layers.L1` | the floor: one continuous element, never stops while the region is loaded | continuous | **unique across all thirteen regions (R2)** |
| `layers.L2` | the moving texture, selected by weather and time of day | continuous | `sublayers[].when` — R5: night is a *selection*, not a filter |
| `layers.L3` | sparse one-shots that punctuate | `interval_s` within **8–40 s** | `night_interval_s` for rates that change after dusk |
| `layers.L4` | the animals of this region, panned and rare | `interval_s` within **45–180 s** | |

**A layer key is always present and may be `null`.** `null` is a design statement (R1), and a
`null` layer must carry `<L>_null_reason` saying what the silence is for. `stone-wastes.L2` is
the one null layer in the province: the Stone Wastes have no moving texture at all, and the
salt-storm is an L3 *event*, weather-gated, not a continuous mid layer.

## `denies` — absence with teeth

Every bed carries a `denies: [{class, why}]` list. `ambience-census.mjs` C5 asserts that **no
sound anywhere in the region is tagged with a denied class**, so "NO birdsong inside the
thicket" is a rule the build enforces rather than a sentence in a table.

This exists because RI-AUD03 §How we lose predicts the exact failure: *"implementing a bed is
additive work, so both quietly get the standard bird layer because it is already wired up. The
two most distinctive regions become the most generic ones."* Adding one `birdsong`-classed event
to Thornmarsh fails the census by name.

## `voices`

**One voice = one independently audible element**, not one `AudioNode`. A four-partial drone
chord is one voice; it is one instrument. RI-AUD02 V5 caps the ambience bus at **8**, and the
census computes the worst case as `L1 + max-concurrent-L2 + 2 (L3) + 2 (L4) + emitters`.

Max-concurrent-L2 takes **the worse of the day world and the night world**, not the sum of all
sublayers — R5 makes a day selection and a night selection mutually exclusive, and counting them
together would push someone to delete night content to satisfy a cap night content never
breaches. Western Rootlands sits at exactly 8.

## `emitters` — R7, the world-anchored sounds

Four: Marauder's Coast's bell buoy, the Salt Hills' legion horn, the Clay Moor's kiln, and
Western Rootlands' hide-drum. These are **not region-wide layers**. They sit at fixed world
coordinates with an `audible_m` cutoff, and `emitterPlacement()` computes their pan and gain
analytically from the player's position and bearing — analytically rather than through a
`PannerNode` so that a probe can read the numbers and assert monotonicity along a transect.

They are the ambience contribution to **S8 (no markers)**: the world is not allowed to tell you
where you are with an arrow, so it tells you with a bell.

> **The hide-drum is here rather than in L3, and that is a resolved contradiction in RI-AUD03
> itself.** §B puts the drum in the L3 column and gives it "a 90-second beat"; §A caps every L3
> interval at 8–40 s. Both cannot hold. §B is right about the drum and §A is right about L3, so
> the drum became an emitter: it keeps the exact 90-second beat, stops breaking the band, and
> gains a bearing — which is what §C needs from it, since the drum is the discriminator that
> separates Western Rootlands from the three other regions sharing the (wet, open, living) key.

## Synth vocabulary

Interpreted by `game/src/audio/synth.js`. Three kinds:

- **`noise`** — `colour` (`white` | `pink` | `brown`), `filter {type, hz, q}`, `gain_db`,
  `width` 0–1 (channel decorrelation, applied in the buffer), optional
  `mod {target: gain|filter_hz, lfo_hz, depth}`.
- **`drone`** — `waveform`, `partials_hz[]`, `partial_gains_db[]`, `detune_cents` (alternating
  sign across partials, so the chord *beats*), `gain_db`, optional `filter`, optional `mod`
  (`target: gain|pitch`).
- **`grain`** — one-shot. `source` (`noise` | `osc`), `env {attack_s, decay_s}`, `gain_db`,
  optional `filter`, `glide_hz [from, to]`, `partials_hz[]`,
  `repeats {n, gap_s, gap_jitter_s}`.

`mod.depth` is always a **fraction of the target's base value**, so the same field reads the
same way against a gain, a filter cutoff and a pitch.

## Two things carried in sound that no book states (R6)

1. **Stone Wastes' L4 is Stone Forest's L1, broken.** Same four partials (A2 E3 A3 E4), detuned
   47 cents instead of 4, with the amplitude collapsing mid-note. The census asserts the
   partials are identical and the detune is meaningfully wider — "recognisably the same
   instrument" is half the rule and "one of them broken" is the other half. The Hist's decline
   is stated in sound before it is stated in text.
2. **The Deep Marshes' breathing is in no bestiary.** It never resolves to an entity.

## Outstanding

- **Interior beds (R4).** Not written. `getAmbienceState().suppressed` names the cell and the
  bed goes **silent** indoors rather than playing the exterior bed low-passed, which R4 forbids
  outright ("a muffled version of outside is the sound of a hole in the design"). A reported
  absence is work outstanding; a papered-over one is a defect nobody finds.
- **B1/B2/B3**, the blind judge tests, need fresh judge contexts and are a critic's to run.
