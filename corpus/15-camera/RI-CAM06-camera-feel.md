---
id: RI-CAM06
title: Camera feel — fixed-step coupling, zero inertia, no head-bob, no FOV punch, hitstop, shake, death and fog-gate
kind: number
side: souls
judges: [combat.camera.behaviour, combat.feedback.hitstop, combat.boss.arena, combat.death.corpserun, platform.determinism.harness]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SEAM S18.** "Match Dark Souls' third-person behaviour in ALL respects" includes the
> respects nobody can name. This item turns "feel" into derivative statistics, because feel
> that cannot be measured is feel that cannot be judged (HARNESS §3: a critic may not claim
> anything about feel that is not a per-frame record, a pixel buffer, or a data file).

## The bar

The Souls camera has no personality. It does not lead, lag, bob, breathe, punch, or lurch.
Its position is a pure function of the character's position and two angles; its only motion
is the motion you gave it. That absence is the feel: the frame is a stable window that the
combat happens inside, so that a 3-frame parry window is readable and a boss's silhouette can
be studied. Every effect a modern engine adds by default — damping in the render loop, a
sprint FOV kick, a head-bob "for immersion", a screen shake on every hit — is a subtraction
from that stability, and each one is separately measurable as an increase in a derivative.

The four moments where the camera is *allowed* to do something — hitstop, damage shake, death,
and the fog gate — are bounded to the frame and to the degree, and each is bounded in a way
that keeps it recognisably the same rig. There are no cutscene cameras in this game.

## The reference artifact

### A. Frame coupling (the precondition for everything else)

| Rule | Value |
|---|---|
| Every camera update runs inside the fixed **60 Hz** sim step (HARNESS §2 R2) | binding |
| Camera code in `requestAnimationFrame` / `onBeforeRender` | **none**, for anything that changes state |
| Smoothing form | constant per-frame alpha `α = 1 − 2^(−(1/60)/T½)`, `T½` in seconds, precomputed once |
| `deltaTime` anywhere on the camera path | **forbidden** |
| Render-time interpolation | permitted, and it must be **pure**: it may read the previous and current sim camera states and produce a display transform, and it may write nothing back |
| Determinism | the `camera` trace block is covered by `body_sha256` (HARNESS §5); two runs at the same seed are byte-identical (D5) |

Precomputed alphas for every half-life used in the camera area:

| `T½` | Used by | `α` at 60 Hz |
|---|---|---|
| 0.120 s | lock yaw spring **[CMB06 §B]** | 0.05604 |
| 0.180 s | lock pitch spring **[CMB06 §B]** | 0.03779 |
| 0.250 s | pivot vertical (RI-CAM01 §B); arm length (RI-CAM03 §C) | 0.02734 |
| 0.350 s | sprint recentre yaw (RI-CAM02 §E) | 0.01960 |
| 0.400 s | pivot vertical, airborne (RI-CAM01 §B) | 0.01718 |
| 0.600 s | sprint recentre pitch (RI-CAM02 §E) | 0.01148 |
| 0.080 s | damage shake decay (§E) | 0.08300 |

### B. Derivative statistics (this item owns the definitions)

Over any window of `N` frames, for the camera's world position `p[f]` and its orientation
angles `θ[f] = (yaw, pitch)`:

```
v[f] = p[f] - p[f-1]                      # m/frame
a[f] = v[f] - v[f-1]                      # m/frame^2
j[f] = a[f] - a[f-1]                      # m/frame^3
J_p95   = 95th percentile of |j[f]|
Jang[f] = third difference of θ[f]         # deg/frame^3
Jang_p95 = 95th percentile of |Jang[f]|
```

| Window | `J_p95` pass | `J_p95` fail | `Jang_p95` pass | `Jang_p95` fail |
|---|---|---|---|---|
| Ordinary locomotion, flat, no look input | ≤ **0.0040** | > 0.0150 | ≤ **0.35** | > 1.20 |
| Locked duel, no look input | ≤ **0.0060** | > 0.0200 | ≤ **0.50** | > 1.60 |
| Manual look, constant stick | ≤ 0.0040 | > 0.0150 | ≤ **0.05** | > 0.30 |
| Interior traversal (collision active) | ≤ **0.0120** | > 0.0400 | ≤ 0.35 | > 1.20 |

The third row is the strict one on purpose: a constant look input must produce a constant
angular velocity, so the angular jerk is essentially zero. Anything above 0.30 there is an
easing curve on the look path that RI-CAM02 M3 says must not exist.

### C. Inertia and acceleration — the absence

| Property | Bar | Measured as |
|---|---|---|
| Manual look is 1:1 | `corr(input.look.yaw, Δcamera.yaw)` at **lag 0** ≥ **0.999**, and `argmax_lag corr = 0` | RI-CAM02 M3, re-run here over a 3600-frame free-look scenario |
| No coast | after look input returns to zero, `Δcamera.yaw` is 0 on the **next** frame | |
| No acceleration ramp | the first frame of a step look input produces the full per-frame rate | |
| No camera lead | `corr` at negative lag must not exceed `corr` at lag 0 | |
| Pivot horizontal lag | `\|camera_pivot.xz − controller.xz\|` ≤ **0.001 m** on every frame (RI-CAM01 §B) | |

### D. FOV — the variance is zero

| Rule | Value |
|---|---|
| `fov_deg` | **50.0°**, in every state, on every frame, in every scenario |
| Sprint FOV punch | **none**. Not 2°, not 1°. Zero. |
| Hit / crit / boss-entry / death FOV change | **none** |
| Permitted FOV animation anywhere in the game | **none** |
| Measurable | `stdev(fov_deg) ≤ 0.001` and `max − min ≤ 0.001` over every run in the corpus, concatenated |

This is the simplest bar in the camera area and the one most likely to be broken by three
different people independently. It is a single line in a trace-stats report and it is either
zero or it is not.

### E. Head-bob — the absence, measured

Run the character in a straight line on flat ground at run speed for 300 frames, no look
input, unlocked.

```
y_resid[f] = camera.pos.y[f] - linear_fit(camera.pos.y)[f]
```

| Quantity | Pass | Fail |
|---|---|---|
| `stdev(y_resid)` | ≤ **0.004 m** | > 0.012 m |
| FFT of `y_resid`: peak magnitude at the footfall frequency, relative to the median bin | ≤ **1.5×** | > 3.0× |
| Same, lateral residual `x_resid` in camera-right space | ≤ 0.004 m / ≤ 1.5× | > 0.012 m / > 3.0× |
| Roll (camera Z rotation) at any point in the game | **exactly 0.000°** | any non-zero value |

Camera **roll is not used for anything, ever** — not for bob, not for shake, not for damage,
not for death. It is the single most nauseating axis and the game has no use for it.

### F. Hitstop

Hitstop duration and trigger are owned by `combat.feedback.hitstop` / RI-CMB05. The camera
rule:

| Rule | Value |
|---|---|
| During a hitstop frame the camera **freezes** | pivot follow, arm spring, lock springs, recentre — all hold |
| Position drift during hitstop | `\|Δcamera.pos\| ≤ 0.001 m` per frame |
| Orientation drift during hitstop | `\|Δyaw\| + \|Δpitch\| ≤ 0.010°` per frame |
| Manual look input during hitstop | **buffered**, not dropped: the summed look delta is applied on the first non-hitstop frame |
| Buffer application latency | **1 frame** |
| Shake during hitstop | permitted (§G) — it is the one thing that moves, which is what sells the impact |
| FOV during hitstop | unchanged (§D) |

### G. Damage shake

| Parameter | Value |
|---|---|
| Trigger | the player taking damage (not dealing it; dealing damage is hitstop only) |
| Form | **rotational only** — additive yaw and pitch offsets applied *after* the rig, *before* the projection. **Never** positional (a positional shake pushes the camera into geometry that RI-CAM01's collision already resolved). **Never** roll (§E). |
| Amplitude | `A = 0.90° × min(1, dmg / (0.25 × hp_max))` |
| Maximum amplitude, any hit | **0.90°** |
| Decay | exponential, half-life **0.080 s** (α = 0.08300) |
| Maximum duration | **12 frames**, hard-truncated |
| Noise source | the **seeded** global PRNG (HARNESS §8 D1/D2). Shake is in the trace and in `body_sha256`. |
| Shake energy `E = Σ_f (yaw_off² + pitch_off²)` over one event | ≤ **3.60 deg²·frames** |
| Effect on `camera.pos` | **none**. `Σ\|Δcamera.pos\|` attributable to shake = 0. |
| Shake on: blocking, parrying, enemy death, landing, boss stomp | **none**, unless a reference item elsewhere authorises it with a number. Ambient/environmental shake is not authorised by this corpus. |

### H. Death camera

| Frame (relative to the death frame) | Behaviour |
|---|---|
| 0 | lock breaks **[CMB06 §A]**, with no yaw impulse (RI-CAM03 §F) |
| 0 | the pivot **detaches** from the character root and holds its last world position (the pivot's height spring is frozen with it) |
| 0 → 45 | arm eases from current to **5.20 m**; pitch eases to **−22.0°**; both critically damped, `T½ = 0.250 s`, rate-clamped to +0.150 m/frame and 1.5 °/frame |
| 0 → 150 | camera orbits the held pivot at a constant **6.0 °/s** (0.100 °/frame) |
| throughout | FOV unchanged; collision **active**; player look input ignored; no cut, no letterbox, no fade-to-black until the death UI's own fade at frame 150 |
| 150 | death UI; camera continues to orbit until the respawn load |

| Measurable | Bar |
|---|---|
| Orbit rate over frames 45–150 | 0.100 °/frame ±0.005 |
| Max single-frame orientation change | ≤ **0.5°** |
| `Σ clip_through` over the sequence | **0** |
| `stdev(fov_deg)` | ≤ 0.001 |

### I. Fog-gate / boss-entry move (the only scripted camera in the game)

It is the **same rig**, driven to a different target. That is the whole design, and the test
for it is that the resulting pose is reproducible from the rig's own laws.

| Parameter | Value |
|---|---|
| `camera.mode` | `fog_gate`, for **exactly 90 frames**, then `free` or `locked` |
| Player input lockout | exactly **90 frames**, returned instantly on frame 91 (no ease-back on input authority) |
| Yaw target | the boss's chest bearing, driven with `T½ = 0.180 s`, rate-clamped to **90 °/s** |
| Pitch target | RI-CAM03 §D's `pitch_bias(d, h)` for that boss |
| Arm target | eases to **6.40 m** over 40 frames, then hands off to RI-CAM03's boom ramp |
| FOV | unchanged (§D) |
| Collision | **active throughout** — the spring arm still pulls in, which is the tell that it is the same camera |
| Forbidden | a spline/dolly camera; a second camera object; a cut; letterbox; slow-motion; FOV animation; the camera passing through the boss's collision; a fixed "boss intro" position |

**The reproducibility test.** Take the camera state at fog-gate frame 0 and the boss/player
transforms per frame from the trace. Re-simulate RI-CAM01 §C + RI-CAM03 §C/§D + this
section's targets, offline, in a plain script. The re-simulated pose at frame 90 must match
the traced pose within **0.5°** and **0.05 m**. A build using a separate cinematic camera
cannot pass this, because its pose is not a function of the rig's inputs.

## Comparison method

Method script: **`corpus/80-methods/m-cam06-feel.mjs`**.

**M1 — Fixed-step coupling (the gate; everything else is meaningless without it).**
Run `cam-walk-cistern` at seed 1337 three ways: (a) 5400 × `stepFrames(1)`;
(b) 90 × `stepFrames(60)`; (c) 5400 × `stepFrames(1)` with a `renderFrame()` after each.
- **FAIL** if the per-frame `camera` blocks are not byte-identical across (a), (b), (c).
- **FAIL** if the run's `body_sha256` differs across the three (HARNESS §8 D5).
- Then re-run (a) with the page throttled via CDP to ~15 fps render.
  **FAIL** if anything changes. This is the direct test for camera smoothing in the render
  loop, and it subsumes every argument about `deltaTime`.

**M2 — Derivative statistics.** Compute §B over four windows: `wld-walk-lilmoth` (flat),
`cmb-duel-infantry` (locked), a 900-frame constant-stick free-look, and
`cam-walk-cistern` (interior).
- **FAIL** on any window landing in its Fail column. Report all eight numbers.

**M3 — Inertia absence.** §C's five rows over a 3600-frame free-look scenario with step,
ramp, and impulse look inputs.
- **FAIL** on any row breached. Report the cross-correlation function, not just its peak.

**M4 — FOV variance.** Concatenate `fov_deg` from every scenario the critic ran this wave —
duels, boss, exploration, interior, dialogue, menu, rest, death, fog gate.
- **FAIL** if `max − min > 0.001` over the concatenation.

**M5 — Head-bob absence.** §E's 300-frame straight run, at walk, run and sprint speeds, on
flat ground and on a 5° slope. Six runs.
- **FAIL** on any `stdev` or FFT-peak bar breached, or on any non-zero camera roll.
- Produce the FFT plot as an artifact; "no bob" is a claim that needs a spectrum.

**M6 — Hitstop.** Land 20 scripted hits with a straight sword on a stationary `INFANTRY`,
with a constant look input held throughout.
- Identify hitstop frames from the trace's hitstop flag / `events`.
- **FAIL** if `|Δcamera.pos|` or `|Δyaw|+|Δpitch|` exceed §F's bars on any hitstop frame.
- **FAIL** if the buffered look delta is not applied within 1 frame of hitstop ending, or if
  it is dropped (compare `Σ input.look` with `Σ Δcamera.yaw` across the window: they must
  agree to 0.01°).

**M7 — Damage shake.** Take 20 scripted hits spanning 5% to 60% of `hp_max`.
- Extract the shake offsets (requested trace field `camera.shake`).
- **FAIL** if `p100(amplitude) > 0.90°`, if any event exceeds 12 frames, if the fitted decay
  half-life differs from 0.080 s by > 20%, if `E > 3.60 deg²·frames`, if any positional
  component is non-zero, or if camera roll is non-zero.
- **FAIL** if shake fires on block, parry, enemy death, or landing.
- **FAIL** if two runs at the same seed produce different shake (unseeded noise; also D1/D2).

**M8 — Death camera.** Die 5 times: to a trash hit, to a boss, on a stair, in a corridor, and
falling off a ledge.
- **FAIL** on any §H bar breached. The corridor and ledge deaths are the ones that clip;
  running only the open-arena death is not running the method.

**M9 — Fog gate.** Enter each boss arena in the build.
- **FAIL** if `camera.mode == "fog_gate"` for any duration other than exactly 90 frames.
- **FAIL** if input lockout differs from 90 frames.
- **FAIL** on any letterbox, cut, FOV change, or slow-motion (compare sim frame indices: they
  must advance by exactly 1 per frame throughout).
- **FAIL** if `clip_through` is ever true, or if the camera enters the boss's collision.
- Run the §I **reproducibility test**. **FAIL** if the re-simulated frame-90 pose differs by
  > 0.5° or > 0.05 m.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 fixed-step coupling | **25** | Byte-identical across three stepping patterns and a throttled render |
| M2 derivative statistics | 15 | All four windows in the Pass band |
| M3 inertia absence | 10 | Lag-0 correlation ≥ 0.999, no coast, no lead |
| M4 FOV variance | 10 | `max − min ≤ 0.001` across every scenario |
| M5 head-bob absence | 10 | stdev and FFT bars held; zero camera roll |
| M6 hitstop | 10 | Freeze bars held; look buffered and applied in 1 frame |
| M7 damage shake | 10 | Amplitude, duration, decay, energy, rotational-only, seeded |
| M8 death camera | 5 | Rates and continuity held; zero clipping in all 5 deaths |
| M9 fog gate | 5 | 90 frames exactly; reproducible from the rig's own laws |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. **70–89** — gap named. **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - any camera state updated outside the fixed 60 Hz step (M1) — this also makes RI-CAM01
    through RI-CAM05 unmeasurable and drags the whole area to 0;
  - `fov_deg` varying at all;
  - non-zero camera roll anywhere;
  - positional camera shake;
  - unseeded shake noise (HARNESS D1/D2, and it breaks D5 for every trace containing a hit);
  - a separate cinematic/spline camera object used for the fog gate, death, or anything else;
  - letterbox bars, slow-motion, or a fade-to-black in ordinary play;
  - hitstop that freezes the world but not the camera (or vice versa).

**Blind pair:** two 900-frame `camera.pos.y` residual traces from the same straight run —
ours and one generated from §A/§E — plotted as time series **and** as FFT spectra,
unlabelled. Discriminating question, written first: *which of these is a camera bolted to a
character, and which is a camera bolted to a walk cycle?* The tell is a peak at the footfall
frequency. Record the pick before the reveal.

## How we lose

1. **Smoothing in the render loop.** `camera.position.lerp(target, 0.1)` inside the rAF
   callback. It is what every Three.js third-person tutorial does. At 60 fps it matches the
   spec by accident; at 144 fps the camera is 2.4× stiffer; at 20 fps it is soggy; and every
   trace in the entire corpus stops being reproducible. M1 is weighted 25 and gated because
   nothing else in this file survives it.
2. **`lerp(a, b, 0.1 * delta * 60)`.** The "fixed" version, which is still frame-rate
   dependent (exponential smoothing is not linear in `dt`) and still runs in the render loop.
   §A's precomputed-alpha table exists so there is nothing to compute at runtime.
3. **Sprint FOV punch.** Universal in modern third-person games, two lines of code, and it
   makes the fidelity capture set non-comparable because a shot's FOV now depends on whether
   the player was sprinting. §D's answer is zero, measured as a variance.
4. **Head-bob.** Added "for immersion", usually by driving `camera.position.y` from the walk
   clip's hip height. In a spring-arm rig it also modulates the collision cast, so the arm
   pumps in time with the footsteps. M5's FFT peak sees both effects at once.
5. **Camera roll.** Someone will add a small roll on strafe, or on damage, or on death. It is
   the axis players have no tolerance for and the game has no use for.
6. **Positional shake.** Shake the camera's world position and it enters the wall behind it —
   the collision already ran. Then either it clips (RI-CAM01 M3 fails) or it is re-collided
   and the shake becomes a directional shove. Rotational-only is not a stylistic preference.
7. **Unseeded shake.** `Math.random()` in the shake, which HARNESS D2 forbids and which makes
   every trace containing a hit non-reproducible — silently, because the shake is small and
   nobody looks at it until `body_sha256` stops matching and a whole wave of verdicts is void.
8. **Shake on everything.** A shake on block, on parry, on landing, on enemy death, on the
   boss's footsteps. Individually tiny, collectively a permanent tremor, and it raises
   `Jang_p95` across the board so M2 fails without a single obvious culprit.
9. **Hitstop that freezes the sim but not the camera**, so the world stops and the camera
   keeps drifting toward its spring targets — the exact opposite of the intended read, which
   is that the whole frame locks up for 4 frames and then releases.
10. **Look input dropped during hitstop** rather than buffered, so a player holding a turn
    through a combo loses a fraction of it on every hit and the camera ends somewhere they
    did not aim.
11. **A cutscene camera for the fog gate.** A dolly along a spline, a letterbox, a lens flare.
    It is the most tempting five minutes of work in the project and it introduces a second
    camera object that then has to be kept in sync with the first forever. §I's
    reproducibility test is specifically designed so that a spline camera cannot pass it.
12. **A death camera that cuts.** A hard cut to an orbiting shot of the corpse. Souls holds
    the rig. The cut is also the thing that lets a build get away with clipping through the
    corridor wall it just died in, because nobody screenshots the death.
13. **Slow-motion on the killing blow.** It breaks HARNESS R2's integer frame index, which is
    the single assumption every combat item in the corpus rests on.
14. **"It only happens for a few frames."** Every item in this file is a per-frame bar for
    exactly this reason. A 3-frame FOV kick is a non-zero `stdev(fov_deg)`.

## Provenance note

- **`constructed`, confidence high, and binding:** every number in §A–§I. The jerk bands in
  §B, the correlation bars in §C, the zero-FOV-variance rule in §D, the head-bob thresholds
  and the 1.5× FFT peak ratio in §E, the hitstop freeze tolerances and the 1-frame look
  buffer in §F, the entire shake spec in §G (0.90° cap, 0.080 s half-life, 12-frame
  truncation, 3.60 deg²·frames energy, rotational-only), the death sequence in §H (45/150
  frames, 5.20 m, −22.0°, 6.0 °/s), and the fog-gate spec in §I (90 frames, 6.40 m, 90 °/s
  clamp, the reproducibility test) are ours.
- **Derived:** the α column in §A is computed from `α = 1 − 2^(−(1/60)/T½)` and should be
  recomputed, not quoted. The half-lives themselves are adopted from RI-CMB06 §B
  (0.120/0.180), RI-CAM01 §B (0.250/0.400), RI-CAM02 §E (0.350/0.600) and §G (0.080).
- **Adopted, not restated:** hitstop duration and triggers belong to
  `combat.feedback.hitstop`; this item owns only what the camera does during them. The
  fixed-60 Hz requirement, `body_sha256`, and D1–D7 are HARNESS §2/§8 and are enforced here
  rather than redefined.
- **`canonical-recall`, confidence medium:** that the Souls camera has no head-bob, no roll,
  no sprint FOV change, a small rotational damage shake, a held-pivot orbiting death camera,
  and a fog-gate move performed by the ordinary camera rather than a cinematic one. Recalled,
  not measured; no frame-exact FromSoft data was consulted or cited.
- **A deliberate divergence, recorded:** upstream Souls games *do* use short cinematic
  cameras for some boss introductions. This corpus forbids them (§I), because a second camera
  object is the mechanism by which every other rule in this file gets bypassed "just this
  once", and because §I's reproducibility test is only possible if there is one camera. This
  is the corpus exercising precedence order item 3 (CORPUS-CONTRACT / ARBITRATION §5): the
  reference item's stated method decides.
- **Harness dependency:** requires the `camera` trace channel including `camera.shake`,
  `camera.mode`, and `camera.hitstop`, plus the ability to throttle render rate from the
  tooling. Absent them, M1 and M7 score **0**, fail-closed — and a fail-closed M1 caps the
  whole camera area at 0, because unmeasurable frame coupling means no camera number in the
  corpus is trustworthy.
