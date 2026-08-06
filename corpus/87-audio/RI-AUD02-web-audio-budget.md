---
id: RI-AUD02
title: Web Audio constraints, scheduling discipline and the voice budget
kind: number
side: modern-fidelity
judges: [audio.combat.impact, platform.determinism.harness]
provenance: constructed
confidence: high
blind_pair: no
---

> **SIDE DECLARATION: this item is `modern-fidelity`.** It judges the *platform*, not the
> design. Nothing here is a Morrowind or a Souls question — it is the question of whether a
> browser can deliver RI-AUD01's ≤1-frame contract at all. It cites no reference imagery and
> no reference game. A build can satisfy every design item in `87-audio/` and still fail this
> one, and if it fails this one, **RI-AUD01 M1 cannot pass**, because the design bar is
> unreachable through a badly built graph.

## The bar

RI-AUD01 requires an impact sound to land within one 16.67 ms frame of the hitbox-connect
frame. The Web Audio API can do this comfortably — and the naive implementation cannot do it at
all. The gap between those two facts is this document.

Three structural rules carry almost all of it. **The AudioContext must be unlocked and in
`interactive` latency mode before the first fight** — a context created at page load is
`suspended` until a user gesture, and a game that discovers this on the first swing has already
lost the encounter's first three hits. **Scheduling must be ahead-of-time and must not be
coupled to `requestAnimationFrame`** — rAF is a *render* signal, it is throttled in background
tabs, it is capped by the compositor, and on this project's software renderer it can be
hundreds of milliseconds apart; scheduling audio from it makes latency a function of triangle
count. **Every sample must be a pre-decoded `AudioBuffer`** — `new Audio()` per hit is the
canonical anti-pattern and it fails on both axes at once, adding an unbounded network/decode
latency *and* allocating a garbage-collectable media element on every swing, so the GC pause it
causes lands, on average, in the middle of the next fight.

The budget is not "as fast as possible". It is a **stated ceiling that a critic can measure**,
and a set of anti-patterns whose *detection* is specified so that "we don't do that" is a
checkable claim rather than an assurance.

## The reference artifact

### §A — The context contract

| # | Property | Required value | Why |
|---|---|---|---|
| A1 | `AudioContext` count | exactly **1** for the lifetime of the page | multiple contexts do not share a clock; cross-context scheduling is unmeasurable |
| A2 | `latencyHint` | `'interactive'` | `'playback'` buys buffer headroom at the cost of ~2–5× latency. Explicitly wrong for this game |
| A3 | `ctx.state` before first `stepFrames` in a combat scenario | `'running'` | a `suspended` context silently swallows every `start()` |
| A4 | `ctx.baseLatency` | ≤ **0.020 s** (20 ms) | the graph's own buffering; `interactive` should give ~128–512 frames |
| A5 | `ctx.outputLatency` | ≤ **0.040 s** (40 ms) where reported | device-side; not fully in our control, but a value above this means the hint was ignored |
| A6 | `ctx.sampleRate` | device default, recorded, **not** forced | forcing a rate inserts a resampler on every buffer |
| A7 | Unlock path | a single documented gesture handler that calls `ctx.resume()` and plays a 1-sample silent buffer | the silent-buffer trick is what actually unlocks iOS Safari; `resume()` alone is not sufficient there |

**Unlock and the harness.** In harness mode there is no user gesture. The game MUST therefore
accept `?harness=1` (HARNESS.md R3) as an unlock authorisation and construct the context
immediately, or expose `audioUnlock()`. A game whose audio only works after a click is a game
whose audio is never measured, and per RI-AUD01 that scores 0.

### §B — The scheduling contract

```
  FORBIDDEN                                  REQUIRED
  ---------                                  --------
  requestAnimationFrame(() => {              setInterval(tick, TICK_MS)   // or AudioWorklet
    if (hitThisFrame) sfx.play();            function tick() {
  });                                          const horizon = ctx.currentTime + LOOKAHEAD;
                                                while (q.length && q[0].playAt < horizon)
                                                  fire(q.shift());        // source.start(playAt)
                                              }
```

| # | Property | Required value |
|---|---|---|
| B1 | Scheduler driver | a timer independent of rAF: `setInterval`, `setTimeout` chain, or an `AudioWorklet` message. **Never** rAF |
| B2 | `TICK_MS` (scheduler period) | ≤ **10 ms** |
| B3 | `LOOKAHEAD` (scheduling horizon) | **25 ms** ≤ LOOKAHEAD ≤ **100 ms** |
| B4 | Start call form | `source.start(playAt)` with an explicit absolute time. **Never** bare `source.start()` |
| B5 | `playAt` derivation | `frameTime(f) + LOOKAHEAD_OFFSET`, where `frameTime(f)` is anchored to a single recorded `(frame, ctx.currentTime)` pair, not to `performance.now()` per event |
| B6 | Behaviour when the sim outruns the audio clock | drop the event and count it in `audioStats().scheduleMisses`; **never** call `start()` with a past time and never `start()` bare as a fallback |

**Why B3 has a lower bound and an upper bound.** Below 25 ms the scheduler races the tick and
events land late unpredictably. Above 100 ms the sound arrives a perceptible beat after the
hitstop, and — worse — the event can no longer be cancelled if the frame is invalidated, which
matters when a parry retroactively changes what happened.

**B5 is the subtle one.** The correct anchor is a single pair captured once per run, because
`ctx.currentTime` and the sim frame counter are two different clocks that drift. Re-deriving
`playAt` from `performance.now()` at each event re-imports wall-clock jitter into a fixed-step
simulation and violates HARNESS.md D3 in spirit. Audio may use wall clock (HARNESS.md §8 permits
it for non-simulation code) — but only where it cannot influence a traced value, and the
*decision* to play is traced.

### §C — The `new Audio()` anti-pattern, and how to detect it

```js
// THE ANTI-PATTERN. Do not do this.
function playHit() { new Audio('sfx/hit.wav').play(); }
```

Four separate failures in one line: an HTTP request or cache lookup per hit; a decode per hit;
an unbounded, un-poolable `HTMLMediaElement` allocated per hit (GC churn — hundreds per fight);
and `play()` returning a promise that resolves *whenever*, so latency is unbounded and
unmeasurable. It also cannot be panned, cannot be bussed, and cannot be captured by
`audioCapture()`, so it is invisible to every other check in this area.

**Detection is specified, not assumed** — three independent probes, because each alone is
evadable:

| Probe | Method | Threshold |
|---|---|---|
| D1 static | `grep -rnE "new Audio\(|\.src *=.*\.(wav|mp3|ogg)|createElement\(['\"]audio" game/` | any hit in a gameplay path = fail |
| D2 runtime census | `audioStats().htmlAudioElements` — count of `HTMLMediaElement`s the game has ever constructed | must be **0** after a 3600-frame combat scenario |
| D3 decode census | `audioStats().decodesAfterReady` — `decodeAudioData` calls after `ready()` resolved | must be **0** in combat; ambience streaming may decode, and must declare itself via `bus:"ambience"` |

D2 is the authoritative one. D1 is a lint that a `const A = Audio; new A()` defeats, and D3
catches the half-fix where someone pools the elements but still decodes per hit.

### §D — The voice budget

| # | Property | Value | Note |
|---|---|---|---|
| V1 | Total concurrent voices | ≤ **32** | hard cap; above this, browsers begin to distort and Safari drops nodes silently |
| V2 | `sfx` bus voices | ≤ **16** | |
| V3 | Impact-class voices (RI-AUD01 §A) | ≤ **8** | more than 8 simultaneous impacts is a mix, not information |
| V4 | `voice` bus (RI-AUD05) | ≤ **6** | |
| V5 | `ambience` bus | ≤ **8** | RI-AUD03's bed layers |
| V6 | `music` bus | ≤ **4** | RI-AUD04 layers |
| V7 | Steal policy | **oldest-first within the same class**, never across classes | a footstep must never steal a parry |
| V8 | Node lifecycle | every `AudioBufferSourceNode` gets an `onended` that disconnects it | source nodes are one-shot; undisconnected ones leak until GC |
| V9 | Same-frame same-class collapse | ≥2 events of the same class on the same frame play **once** at `gain * (1 + 0.3*(n-1))`, capped | prevents the "10 hitboxes overlapped" volume spike |

**V7 is a correctness rule, not a performance rule.** A steal policy that treats all voices as
equal will, in a busy fight, drop the parry chime — RI-AUD01's readability keystone — to make
room for the fourth footstep.

### §E — Spatialisation

| # | Property | Value |
|---|---|---|
| S1 | Impact/creature sources | `PannerNode`, `panningModel:'equalpower'`, `distanceModel:'inverse'` |
| S2 | `refDistance` / `maxDistance` / `rolloffFactor` | 1 m / 40 m / 1.0 |
| S3 | HRTF | **not** used — `'HRTF'` costs ~4× CPU per node and the game is not headphone-mandated |
| S4 | Player-originated sounds (own footsteps, own effort, UI) | no panner; direct to bus |
| S5 | Ambience beds | `StereoPannerNode` or static stereo buffers, **never** per-bed `PannerNode` |
| S6 | Listener update | once per sim frame from the camera pose (S18: third-person — the listener is at the **character**, not the camera; a listener at the orbit camera makes sounds swing as you rotate) |

S6 is a real trap with a specific symptom: put the listener on the camera and every sound in the
world pans back and forth as the player orbits a stationary enemy.

## Comparison method

1. **Boot and read the context.**
   ```bash
   node tools/harness/run-headless.mjs --scenario aud-impact-matrix --seed 1337 \
        --audio-log --audio-stats
   node tools/analysis/audio-budget.mjs --run reports/runs/<runId>
   ```
   `audio-budget.mjs` reads `audio-stats.json` and `audio-log.json` and emits one JSON object
   with a boolean per row of §A, §B, §C, §D, §E.

2. **§A** — assert A1–A6 directly from `audioStats()`. A3 is checked *before* the first
   `stepFrames` of the combat portion, not at the end.

3. **§B** — B1/B2/B3 are read from `audioStats().scheduler = {driver, tickMs, lookaheadMs}`.
   B4/B5 are verified from the audio log: for every event, `playAt > t` (scheduled in the
   future, never bare) and `playAt − frameTime(frame)` has **standard deviation < 3 ms** across
   the run. A bare `start()` shows up as `playAt === t`, and a rAF-driven scheduler shows up as
   a `playAt − frameTime` distribution with the shape of the render loop.
   B6: `scheduleMisses` is reported and must be 0 in a clean run; a nonzero value with any
   `playAt < t` event present is a hard fail.

4. **§C** — run D1, D2, D3 as written. All three, every wave.

5. **§D** — from `audioStats()`: `voicesPeak` overall and per bus. V7 is checked by forcing a
   crowded scenario (`aud-voice-storm`: 6 enemies, all attacking) containing ≥2 parries, and
   asserting every parry appears in the audio log with no `stolen: true`.

6. **§E** — S1/S2/S3 from `audioStats().panner`. S6 is checked from the trace: orbit the camera
   180° around a stationary sound-emitting enemy with the player not moving (`look` inputs only)
   and assert `audioLog.pan` for that enemy's sounds changes by **< 0.1** across the sweep. A
   listener wrongly attached to the camera produces a swing of ~2.0.

## Scoring

Native scale: **rows passed / 30** (A1–A7, B1–B6, C-D1/D2/D3, V1–V9, S1–S6 counted as
7+6+3+9+6 = 31 rows; S4 and S5 are advisory and excluded, giving **29** scored rows).

| Band | Native | Ladder ceiling |
|---|---|---|
| Meets the bar | 29/29 with zero hard fails | 8 |
| Below bar, remedy required | 22–28 | 6 |
| Loses outright | ≤21 | 4 |

**Hard fails (each caps the piece at 2, SCORING §1.1):**

- **HF1** — scheduler driven by `requestAnimationFrame` (B1). This makes RI-AUD01 M1
  unachievable by construction; no amount of sample design recovers it.
- **HF2** — `audioStats().htmlAudioElements > 0` (C-D2). The anti-pattern is present.
- **HF3** — `ctx.state !== 'running'` at the first combat frame (A3). The game is silent and
  does not know it.
- **HF4** — any `start()` called with no argument or with a time in the past (B4/B6).
- **HF5** — `latencyHint` is `'playback'` or unset while impact audio exists (A2).

**Unimplemented scores 0.** If `audioStats()` is absent the item is `unmeasurable` ⇒ **0**
(SCORING §1.1), and RI-AUD01 is also 0. This is deliberate double-jeopardy: an unmeasurable
audio platform makes the audio design unmeasurable too, and both zeros should be visible.

**What we lose looks like:**
```
A2 latencyHint: (unset)          A3 ctx.state at first combat frame: "suspended"
B1 driver: "raf"                 B5 sd(playAt - frameTime): 41.7 ms
C-D2 htmlAudioElements: 428      D3 decodesAfterReady: 428
V1 voicesPeak: 61                V7: 2 of 3 parries stolen by footsteps
=> HF1, HF2, HF3, HF5. Capped at 2. RI-AUD01 also 0 (M1 unreachable).
Diagnosis: sounds are `new Audio()` fired from the render loop, and the context
was never unlocked, so in the harness the game is silent AND badly built.
```

## How we lose

- **It works on the dev machine.** A fast desktop with a 5 ms audio device hides a rAF-driven
  scheduler completely — rAF fires every 16 ms there, so latency looks fine. On this project's
  SwiftShader renderer rAF can be 300 ms apart, and audio latency becomes a function of scene
  complexity. The failure is invisible exactly where it is being developed and catastrophic
  where it is being measured. B1 is checked structurally, not by timing, for this reason.
- **`new Audio()` because it is three characters shorter.** It is the first thing anyone
  reaches for, it works immediately in a prototype, and it is never revisited because the game
  *does* make noise. §C's three probes exist because the single static grep is trivially
  evaded, and because by the time anyone profiles the GC, the pattern is in forty call sites.
- **The context is unlocked by a click that the harness never performs.** Every human playtest
  has audio; every measured run is silent; the audio log is empty; RI-AUD01 scores 0 and
  everybody argues that the score is an artifact of the harness. It is not — a game that cannot
  make a sound without a gesture cannot be measured, and unmeasurable is 0.
- **The voice cap is enforced globally.** Someone adds `if (voices > 32) return;` at the top of
  the play function. It is correct, it is cheap, and it silently drops the parry chime in the
  exact fights that matter, because busy fights are where voices peak. V7's per-class steal
  policy is the fix and it is more code than the naive cap, which is why it does not get written.
- **The lookahead grows to fix a crackle.** Audio glitches under load; someone raises
  `LOOKAHEAD` to 250 ms; the crackle stops; RI-AUD01 M1 now fails by 15 frames and nobody
  connects the two changes. B3's *upper* bound exists solely to catch this, and it will be the
  most-argued-with number in this file.
- **`ctx.currentTime` is used as a game clock.** It is monotonic and convenient and it is not
  the sim clock. Anything derived from it that feeds a traced value breaks HARNESS.md D5's
  byte-identical-trace requirement, and the symptom is an intermittently non-reproducible trace
  that gets blamed on the AI.
- **The listener rides the camera.** S6. Symptom is unmistakable once you know it — the world
  pans as you orbit — and completely unnoticed until someone names it, because it feels like
  "3D audio working".
- **Nobody owns the mix bus.** Buses are added ad hoc (`sfx`, `sfx2`, `music`, `ui`), gains are
  set at call sites, and RI-AUD01 §C's dB relationships become unenforceable because no single
  place knows what a class's level is. Detection: `audioLog.bus` containing a value not in the
  six-name closed set.

## Provenance note

`provenance: constructed`, `confidence: high`.

The Web Audio API behaviours cited — `latencyHint`, `baseLatency`/`outputLatency`, the
suspended-until-gesture rule, the iOS silent-buffer unlock, one-shot `AudioBufferSourceNode`
semantics, `PannerNode` HRTF cost, and the lookahead-scheduler pattern (the standard
"A Tale of Two Clocks" approach: a timer-driven scheduler with a lookahead window calling
`start(absoluteTime)`) — are `canonical-recall` of documented platform behaviour and are
high-confidence.

The **numbers are constructed**: `TICK_MS ≤ 10`, `25 ≤ LOOKAHEAD ≤ 100`, `baseLatency ≤ 20 ms`,
`outputLatency ≤ 40 ms`, the 32/16/8/6/8/4 voice caps, the 3 ms scheduling standard deviation,
`refDistance 1 m` / `maxDistance 40 m`, and the 0.1 pan-swing threshold. They are derived from
the one number that is *not* free — RI-AUD01's ≤1-frame (16.67 ms) offset requirement — by
working backwards: a 10 ms tick plus a 25 ms floor on lookahead keeps the scheduler's own
contribution to jitter well inside one frame, and a 100 ms ceiling keeps the total inside the
window where a hitstop still feels simultaneous. Confidence is `high` because the derivation is
arithmetic rather than aesthetic, and because §C and §B1 are structural checks that do not
depend on any threshold being exactly right.

**Harness additions requested** (with RI-AUD01's `audioLog` and `audioCapture`):

```js
audioStats(): {
  ctxState, sampleRate, latencyHint, baseLatency, outputLatency,   // §A
  scheduler: { driver: 'interval'|'raf'|'worklet'|'none',
               tickMs, lookaheadMs },                              // §B
  scheduleMisses,                                                  // B6
  htmlAudioElements, decodesAfterReady,                            // §C
  voicesActive, voicesPeak, voicesPeakByBus: {sfx, music, ambience, voice, ui},
  stolen,                                                          // §D
  panner: { model, distanceModel, refDistance, maxDistance, rolloffFactor },
  listenerAttachedTo: 'character'|'camera'                         // S6
}
audioUnlock(): Promise<'running'>   // harness-mode unlock without a gesture (A3)
```

`listenerAttachedTo` is a self-report and is therefore only a hint — S6 is scored by the
camera-orbit pan measurement, which cannot be self-reported wrongly.
