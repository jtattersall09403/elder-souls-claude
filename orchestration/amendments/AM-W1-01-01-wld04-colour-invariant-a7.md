# Proposed amendment AM-W1-01-01 — `RI-WLD04`'s machine analogue must state its pass condition on a **colour-stripped** control

**Filed by:** builder of wave-1 piece **W1-01** (world: province terrain, regions, roads, the crossing), round 3, dispatched at ultracode.
**Status:** proposed. **Not applied.** The item wins until it is amended; this round measures and reports **both** numbers and does not move a threshold to make anything pass.
**Affects:** `corpus/50-world/RI-WLD04-region-identity.md` §Comparison method (the A7 dispersion instrument as operated by `tools/world/critic-visual-dispersion.mjs` and `tools/world/critic-w1-01-r2-dispersion.mjs`), and the arbitration check **A7** that reads it.

---

## The finding this rests on is the round-2 critic's, not mine

`corpus/90-verdicts/wave1/W1-01-r2.md` §2(4), reproduced exactly:

| | with colour | **structure only** | above chance retained |
|---|---|---|---|
| ours_day | LOO 74.4%, Fisher 3.10 | **LOO 30.8%, Fisher 1.77** | 35% |
| Morrowind REF-A21 | LOO 25.6%, Fisher 1.42 | LOO 17.9%, Fisher 0.87 | 47% |

> "About two-thirds of our measured region separability is carried by tint alone. That is why the
> machine reads 74.4% and a human taking the same test reads 50%."

**I agree with the critic and I am asking for the bar to move against me.** The instrument as it
stands is a 4×4 grid of mean CIELAB. A colour grade satisfies it. RI-WLD04's own "How we lose"
list already contains the sentence that condemns it — *"Palette without material. Getting the hex
values right and applying them as a colour grade over the same ground texture"* — so the item
already knows the failure mode; what it lacks is an instrument that can see it.

## Why this is not "optimising against a flawed bar in the other direction"

The trap the escalation brief names is a builder quietly optimising against a flawed instrument.
The tell for that is a builder who improves the tinted number and leaves the stripped one alone.
The reason to file this rather than say nothing is the opposite: **the colour-stripped number is
the harder number, and asking to be judged on it is asking for a worse score today.** It is also
the number that predicts the human result — round 2's machine read 74.4% and its human read 50%,
and the structure-only control read 30.8%. The control is closer to the human by 20 points.

## The amendment

Replace the single A7 dispersion reading with a **pair**, and put the pass condition on the second.

1. **`raw`** — the existing 4×4 mean-CIELAB descriptor, reported unchanged, so no history is lost.
2. **`structure`** — the round-2 critic's own control, verbatim, so this amendment introduces no
   instrument the critic did not already build and run: a 6×4 grid of Sobel edge density plus a 6×4
   grid of luminance layout, each z-scored **per image**, which removes absolute colour, absolute
   exposure and global contrast and leaves silhouette, prop density and composition. The
   implementation is `tools/world/critic-w1-01-r2-structure.mjs`, already in the artifacts.

Both are run on the **matched design** the round-2 critic built and which resolved the 3.01 → 1.005
question: 9 regions × 3 images, 200 random draws, both populations, identical chance. That part of
the critic's method is not in dispute and this amendment adopts it as written.

**Proposed pass conditions**, and the reasoning for each number:

| Reading | Proposed bar | Where the number comes from |
|---|---|---|
| `structure`, day | LOO ≥ **55%** | The round-2 critic's own stated acceptance for the remedy: "rises from 30.8% to ≥ 55%". Not invented here. |
| `structure`, day | above Morrowind's structure-only LOO on the same matched design | Morrowind measured **17.9%**. A world whose shape is less distinct than Vvardenfell's has not earned the comparison, whatever its palette does. |
| `raw`, night | LOO ≥ **70%** | Unchanged. This is M17 step 6's existing explicit number and this amendment does not touch it. |

And one clause that is the whole point:

> **A7 may not be reported as passing on `raw` alone.** If `raw` passes and `structure` fails, the
> verdict must record it as `structure_fail` and score region identity on `structure`. A region that
> reads as different only because the ground is a different colour has not been built.

## What it would change about how a piece is judged

Nothing about Morrowind's side, which is measured identically on both descriptors. Nothing about
the matched design. It removes exactly one thing: the ability to pass an identity bar with a LUT.

## Cost, stated honestly

This bar is expensive to meet. Meeting it needs per-region **landform** and per-region **structures**,
not per-region palettes — in this piece it meant putting the thirteen ONLY-HERE elements into
`WorldField.heightAt()` so seven of them deform the ground the collision and the mesh share. That is
a large amount of work for an axis that a 4×4 CIELAB grid would have given away for a hex value. That
is the argument for the amendment, not against it.

## If it is rejected

If the bar critic prefers to leave A7 as it stands, the round-3 build is unaffected: it reports both
numbers either way, and `reports/region-dispersion.json` carries the `structure` reading whether or
not anything is obliged to read it. What would be lost is the guarantee that the next wave cannot
regress region identity into a colour grade without any instrument noticing.
