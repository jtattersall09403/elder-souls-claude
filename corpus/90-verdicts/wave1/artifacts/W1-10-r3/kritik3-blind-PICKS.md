# W1-10 round 3 — blind picks, RECORDED BEFORE THE REVEAL

Pack: `reports/w1-10-blind-r3/` (builder-generated, headless Chromium, motion columns only:
`f, px, pz, yaw, ax, ay, az, bx, by, bz, target_hp`).
`blind-KEY-SEALED.json` has **not** been opened at the time this file is written.

Features computed by the critic from the trace rows alone
(`corpus/90-verdicts/wave1/artifacts/W1-10-r3/kritik3-blind-features.txt`), with swings detected
at an absolute 8 m/s tip-speed threshold so no trace's own outlier sets its own threshold.

## RI-WPN03 M6 — the clustering test (12 traces, 3 classes, 4 each)

| trace | tip radius max (m) | tip y min (m) | frac of frames tip below y=0 | peak tip speed (m/s) | swings | median gap (f) | median arc (deg) | hits |
|---|---|---|---|---|---|---|---|---|
| T3 | 2.25 | −0.88 | 0.40 | 52.0 | 40 | 11 | 5.8 | 3 |
| T4 | 2.32 | −1.01 | 0.39 | 50.7 | 27 | 11 | 82.9 | 3 |
| T8 | 2.38 | −1.10 | 0.41 | 54.1 | 28 | 11 | 48.3 | 3 |
| T10 | 2.50 | −1.13 | 0.47 | 56.3 | 11 | 34 | 112.8 | 2 |
| T1 | 2.69 | −1.57 | 0.52 | 72.3 | 6 | 50 | 114.2 | 2 |
| T11 | 3.02 | −2.11 | 0.62 | 45.4 | 12 | 25 | 85.0 | 4 |
| T9 | 3.23 | −2.02 | 0.65 | 144.7 | 9 | 53 | 122.4 | 3 |
| T5 | 3.34 | −2.44 | 0.61 | 96.9 | 13 | 36 | 22.9 | 4 |
| T12 | 3.57 | −2.30 | 0.63 | 189.5 | 10 | 45 | 63.8 | 3 |
| T2 | 3.62 | −2.48 | 0.63 | 200.9 | 9 | 39 | 64.4 | 3 |
| T6 | 3.91 | −2.77 | 0.68 | 137.5 | 8 | 45 | 76.6 | 3 |
| T7 | 3.97 | −2.83 | 0.67 | 124.9 | 8 | 38 | 77.0 | 3 |

**PICK — grouping:**

- **Group I: T3, T4, T8, T10** — shortest reach (2.25–2.50 m), fastest cadence (three of the four
  re-swing every ~11 frames), lowest peak tip speed.
- **Group II: T1, T11, T9, T5** — mid reach (2.69–3.34 m), cadence 25–53 f.
- **Group III: T12, T2, T6, T7** — longest reach (3.57–3.97 m), slowest and heaviest, and the
  three fastest tips in the pack.

**PICK — within-group behavioural differences, three required, named from motion only:**

1. **T3 vs T4 (group I).** T3's swings sweep a median **5.8°** of bearing — it does not sweep at
   all, it extends and retracts along one line; T4 sweeps **82.9°** across the same cadence. One
   thrusts, one cuts.
2. **T10 vs T3 (group I).** T10 commits: 11 swings in 1 200 frames at a 34-frame gap and a 113°
   arc, against T3's 40 swings at an 11-frame gap. Same reach, opposite tempo.
3. **T5 vs T9 (group II).** T5's median swing arc is **22.9°** and its tip peaks at 96.9 m/s over
   an 11-frame burst; T9's is **122.4°** over a 34-frame burst. T5 stabs on the spot, T9 winds a
   long horizontal cut.

**PICK — the pair I CANNOT tell apart, declared before the reveal:**
**T6 and T7.** Frame by frame these are the same motion offset by one to two frames: tip radius
3.91/3.97, tip-Y profile −1.05 → +0.82 → −2.6 in both, peak speeds 137.5/124.9, median arc
76.6°/77.0°, identical hit count and identical 79 damage. I can name no behavioural difference
between them. Under `WEAPON-CRITIC` §6 that is a **FAIL of the M6 blind test**, and it is recorded
here *before* the reveal so it cannot be retro-fitted.

## RI-WPN02 — the three-trace test (A, B, C): describe three fighting styles

- **A.** A short, fast, straight-line weapon. Tip radius peaks at **1.92 m**, median swing arc
  **9.1°**, 28 bursts at a 29-frame cadence, peak tip 42.7 m/s — the calmest tip in the pack. This
  fights by repeated short jabs from close range; it never sweeps sideways and it never commits for
  long. It also keeps its blade above the ground far more than anything else here (13% of frames
  below y = 0 against 39–68% for every other trace).
- **B.** A long, heavy, sweeping weapon. Tip radius **3.51 m**, median arc **111.6°**, only 10
  bursts in 1 200 frames with 24-frame commitments and 41 frames of recovery between them, and a
  peak tip of 160 m/s. This fights by spacing: one committed horizontal cut at a distance nothing
  else in the pack can reach, then a long wait.
- **C.** The shortest thing in the pack and the strangest. Tip radius **1.84 m**, median arc
  **0.0°** — no bearing travel at all — 29 bursts at a 30-frame cadence, and a single-frame tip
  jump of 133 m/s. This is a straight-line strike from the fist or a very short blade, and the
  single-frame jump is a pose discontinuity rather than a swing.

## Something the pack shows that no headline number asks

Independent of the grouping, and recorded here because it is a blind observation:

- **The weapon tip is below the floor plane (`by < 0`) on 13%–68% of every trace's frames**, and
  reaches **−2.83 m** in T7 — 2.8 m under the character's own feet. Eight of the twelve M6 traces
  have the tip underground for more than half the trace.
- **Peak tip speeds of 200.9, 189.5, 160.3, 144.7 and 137.5 m/s** appear in the pack, against
  `RI-WPN05` §E's widest band ceiling of **40 m/s** for an ultra greatsword.
- **2 to 4 hits land per trace, from 8 to 40 swings.** The pack itself measures the connect rate,
  and it is between 5% and 27%.
