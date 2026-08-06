# Blind comparison record — W1-00

Packs built by `.critic-tmp/blindpack.mjs`, A/B assigned by a flip seeded on `20260806`
(`mapping.json`). **Both questions were written before any series was looked at, and both
picks and rationales below were written before `mapping.json` was opened.**

---

## RI-CAM06 — camera height residual

**Question (written first):** *Which of these two 900-frame camera height residual series is a
camera bolted to a character, and which is a camera bolted to a walk cycle? The tell is a
spectral peak at the footfall frequency.*

**Observed, blind:**

| | stdev (m) | FFT peak | FFT median | peak/median | peak bin |
|---|---|---|---|---|---|
| A | 0.000000 | 0 | 0 | — | 0.0667 Hz |
| B | 7.08e-07 | 4.6e-08 | 2.1e-08 | 2.19 | 2.0667 Hz |

**Blind pick: TIE — neither is a camera bolted to a walk cycle.**

**Rationale (blind):** B's spectrum has a 2.19× peak-over-median at 2.07 Hz, which is in the
plausible footfall band, but its absolute magnitude is 4.6e-08 m — 46 nanometres. That is
quantisation, not motion; a walk-cycle bob is a millimetre-to-centimetre quantity. A is
bit-exactly zero at all 900 samples with a flat spectrum. On the item's own discriminator
(§E: peak ≤ 1.5× median *and* stdev ≤ 0.004 m) both pass, and neither carries a footfall
signature, so the question does not separate them.

**Secondary identification guess (blind, recorded for honesty):** A looked *synthetic* — a
bit-exact zero residual over 900 samples is what an analytic series produces, whereas a
simulation reading a float pivot usually carries ULP noise. So I guessed A = reference.

**Reveal:** `A = ours`, `B = reference`. → `picked: "tie"`.

**Result.** The pick did not land on ours, so §2.5's rerun is not triggered. The
identification guess was **wrong**, and the reason it was wrong is itself a finding: our
camera height is *identically constant* over 900 frames of running, which passes RI-CAM06 §E
by having no vertical camera behaviour at all rather than by damping one. That is recorded as
a secondary observation, not as the piece's gap.

---

## RI-CAM02 — `angle(input_direction, character_facing)` on a 180° reversal at run speed

**Question (written first):** *Which of these two series for the same scripted 180° reversal at
run speed is a character with mass? A series that goes 180 → 0 in one frame is the tell.*

**Observed, blind** (frames 175–215 of a 400-frame run; the reversal is injected at frame 180):

```
A: 45 45 45 45 45 127 119 111 103 95 87 79 71 63 55 47 39 31 23 15 7 1 9 17 25 33 41 45 45 …
B:  0  0  0  0  0 168 156 144 132 120 108  96  84  72  60 48 36 24 12  0 0 0 0 0 0 0 0 0 0 …
```

| | max one-frame change | frames to alignment |
|---|---|---|
| A | 8.0°/frame | never reaches < 1° and settles at 45° |
| B | 12.0°/frame | 14 |

**Blind pick: B.**

**Rationale (blind):** neither snaps, so both have mass — but B is the series a rate-limited
turn law produces: an exactly-linear ramp at 12.0 °/frame (RI-CAM02 §C's *moving* cap of
720 °/s), closing 168° in exactly 14 frames and holding at 0. A ramps at 8.0 °/frame — §C's
*stationary* cap — and then plateaus at a residual 45° that never closes, which is either a
character being turned by the stationary law while running or a constant offset between the
two quantities being differenced.

**Reveal:** `A = ours`, `B = reference`. → `picked: "reference"`.

**Instrument caveat, recorded rather than hidden.** After the reveal I checked A's constant
45° pedestal and it is **my instrument's artifact, not the build's**: §C defines
`dir_world = normalize(cam_right·sx + cam_fwd·sy)`, i.e. camera-relative, and my series
differenced the *stick-space* bearing against world facing, so any non-zero camera yaw appears
as a constant offset. The claim I therefore make from this pack is only the offset-invariant
one: **our observed peak turn rate during a 180° reversal at run speed is 8.0 °/frame** where
§C's moving law permits 12.0 °/frame. RI-CAM02 M4's stated FAIL conditions are all
*upper* bounds (`p100 > 12.00`), so this does not fail M4 — it is reported as measured.
