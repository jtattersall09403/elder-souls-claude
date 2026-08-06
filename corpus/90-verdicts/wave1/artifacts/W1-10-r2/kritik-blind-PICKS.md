# Blind picks — recorded BEFORE the key was opened

Pack generated at runtime through `setLoadout()` + one 1 200-frame input script
(`kritik-blindpack.mjs`). Columns: frame, player x/z/yaw, weapon socket A and B world
positions, target hp, input stream. **No clip id, slot id, shape, arc, reach, frame count,
class, weapon name or damage number appears anywhere in the pack** (asserted programmatically).
All features below are derived by me from those columns only.

## RI-WPN03 M6 — twelve traces into three groups

**Groups:**
- **G1 = {T2, T6, T7, T12}**
- **G2 = {T1, T4, T9, T11}**
- **G3 = {T3, T5, T8, T10}**

**On what.** G1 separates without ambiguity: peak tip speed 77.5–79.5 m/s against 26.9–40.4
for everything else, maximum tip radius 2.38–2.78 m against 1.38–1.72 m, tip vertical range
2.86–3.70 m. It is long, fast and tall and nothing else in the pack is any of those.
Splitting the remaining eight took a second axis — tip vertical range against
lateral/radial ratio. G2 sits at tip-Y 1.73–2.33 with lat/rad 0.68–0.81; G3 sits at
tip-Y 2.33–3.01 with lat/rad 0.86–0.98. G3 swings wider across the body and higher over it;
G2 keeps the weapon in front. I hold G1 with high confidence and the G2/G3 split with
moderate confidence — the margin is one trace wide (T11 at 0.80/2.33 against T10 at
0.86/2.33).

**Within-group differences named from motion alone** (floor is three of six):

1. *G1, T12 vs T7* — T12 reaches 2.78 m and sweeps 3.70 m of vertical range against T7's
   2.52 m and 3.08 m, and lands 4 hits to T7's 2 with a minimum gap of 158 f against 320 f.
   T12 is the longer, faster-repeating weapon of the pair.
2. *G1, T6 vs T7* — T6's maximum lateral excursion is 2.16 m against T7's 1.85 m at almost
   the same radius, and its hit cadence is 112 f against 320 f. T6 crosses the body; T7
   extends along it.
3. *G1, T2 vs the rest of G1* — T2 reaches 2.38 m and lands **zero** hits on a stationary
   target at 2.2 m, where its three classmates all connect. From motion alone that reads as
   a swing whose damaging window does not coincide with where the blade actually is.
4. *G2, T11 vs T1* — same reach and tip speed band, but T11 lands 3 hits at a 229 f cadence
   against T1's 2 at 405 f. T11 repeats roughly twice as often for the same motion.
5. *G2, T9 vs T4* — T9's lateral excursion is 0.94 m (lat/rad 0.68), the most linear motion
   in the pack; T4 holds the tip furthest out (median radius 1.29 m) and sweeps 1.39 m.
6. *G3, T5 vs T10* — T5 peaks at 40.4 m/s and lands 3 hits; T10 peaks at 29.9 m/s and lands
   **none**. Same group, same reach band, and only one of them connects.

## RI-WPN02 — three traces, three fighting styles

- **A** — shortest reach of the three (1.46 m) but lat/rad 0.98: the tip travels almost
  entirely sideways. Lands 3 hits at a 98 f cadence, the fastest repeat in the pack, and
  covers the most ground (43.5 m). *Circle at close range and sweep flat and often; never
  commit to one big swing.*
- **B** — reach 2.48 m and peak tip 71.8 m/s, both roughly double A's, over the biggest
  vertical range (3.03 m), and it travels the least (37.8 m). *Stand still and hold a lane;
  hit from outside where the other two can reach.*
- **C** — the shortest reach of the three (1.37 m) and yet the highest peak tip speed in the
  pack (81.6 m/s), over the smallest vertical range (2.39 m). Mass accelerated through a
  short arc. *Get inside everyone else's range; the whole proposition is the impact.*

## The observation the pack forced that no number asked for

Across twelve traces of ~10 scripted attacks each against a **stationary** dummy at 2.2 m,
the hit counts are 0–4. **T2 and T10 land nothing at all.** Whatever the fingerprint says,
a majority of scripted swings at a motionless target at a very ordinary spacing do not
connect.
