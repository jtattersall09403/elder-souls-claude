# `game/data/magic/` — seam S19 as data

**Corpus:** `RI-MAG01`..`RI-MAG05`, seam **S19** (`corpus/00-doctrine/ARBITRATION.md`).
**Every frame figure in this directory is `f@60`.** Seam S22: a Souls community frame count is
`t@30` and is *half* of ours. A bare frame count is a defect.

> *Inside the fight, Souls owns casting. Outside it, Morrowind owns spellmaking, enchanting and
> utility magic as first-class systems.*

## The files

| File | What it is | Owner item |
|---|---|---|
| `effects.json` | The **55 effects**, mirrored verbatim from `corpus/25-magic/data/effects.json`. This is the content. The named spells are not. | RI-MAG02 |
| `cast-classes.json` | `ES-CAST/1` — five weight classes, their frames, commitment constants, ballistics, catalysts, and the levitation numbers. | RI-MAG01 |
| `cast-clips.json` | Five class silhouettes × four school hand-shapes. AP-M6's answer: distinctness is in the bones, not the particle colour. | RI-MAG01 §F |
| `spells.json` | 70 coordinates in the parameter space. **Only `effects` + `range` + `class` are authored**; every number is computed. | RI-MAG02 §D |
| `enchanting.json` | Enchanters, capacities, soul gems, the **S15 firewall** (SG-1…SG-6) and the eleven sanctioned breakages. | RI-MAG03 |
| `vfx.json` | The binding palette and the eight design-language rules, **with the fidelity gap declared**. | RI-MAG05 |
| `traversal-routes.json` | Seven routes reachable only-or-most-easily by `levitate`/`slowfall`, each with its non-magic alternative. | RI-MAG04 Q10 |
| `../quests/magic-utility.json` | 24 quests, one magic route each, always with a non-magic route. | RI-MAG04 |
| `../combat/movesets/spell-*.json` | One per spell. The second, independent declaration HARNESS §7 rule 4 diffs against the measured trace. | RI-MAG01 M8 |

## The one formula

`game/src/sim/magic/cost.js` is the **only** implementation of RI-MAG02 §D in the project. The
game imports it to charge the player; `tools/analysis/magic-audit.mjs` imports the same file to
recompute every shipped price. A "the shipped cost recomputes exactly" check that ran against a
second copy of the formula would prove only that the two copies agree.

It reproduces every figure RI-MAG02 publishes outright: nuke/balanced `73/25 = 2.92`,
`levitate` 8 / 25 / 66 at 15 / 60 / 180 s, `slowfall` 3 at 20 s, Spark-Dart 7, and the
WILLPOWER Focus curve 30 / 46 / 62 / 94 / 103 / 112 / 124.

## The three things this directory exists to keep true

1. **Focus never regenerates.** Two functions in the whole project raise it —
   `MagicSystem.hearthRest()` and `MagicSystem.respawn()` — plus the `RITUAL` abort refund,
   which is the only refund RI-MAG01 permits. Every bound in RI-MAG02 §F (levitation altitude,
   1.5 Focus per metre) and §G (recall range, computed from distance) is denominated in a
   resource that does not come back. A 0.5 FP/s trickle added anywhere makes levitation free
   flight and recall free travel *in the same commit*.
2. **Zero PRNG draws.** No damage, magnitude, duration, contact, status, resist or cost value in
   this area is drawn. There is no magnitude range, no spell-failure chance, no resist roll and
   no proc chance. `mag-probe.mjs MAG01_M5` casts the same spell 201 times across three seeds
   and reads one damage value.
3. **No prohibition flags.** There is no `no_levitation_zone`, no altitude clamp, no
   `can_cast_in_combat` boolean. `RITUAL` cannot complete in a fight because it is 210 f@60 long
   and aborts on damage, on `COMBAT` and on movement. **The clock does it.**
   `magic-audit.mjs MAG02_M4_2_no_fence` greps for all of them and every hit is prose saying
   they do not exist.

## Running the measurements

```
node tools/analysis/magic-audit.mjs      # static: RI-MAG02 M1/M2/M3/M4.2, RI-MAG03 M3/M8, RI-MAG04 M2/M3
node tools/harness/mag-probe.mjs         # live:   RI-MAG01 M1-M6/M8, RI-MAG02 M4/M5, RI-MAG03 M1/M2/M4
node tools/analysis/gen-spells.mjs --check
```

## Declared gaps (read these before concluding a number is missing by accident)

- **Spell VFX is data only.** No meshes, particles or decals exist. RI-MAG05 PART 2 (fidelity)
  is unmeasurable in this build and scores **0, fail-closed**. `vfx.json` says so in its own
  `declared_state` block.
- **RI-MAG04 M4's live traversal check** needs the exterior collision mesh, which is W1-01..W1-05's.
  The routes are declared with their geometry; the two-pass run is not executed.
- **9 of the 11 breakage-register probes are not run live** — they need the crime system, the
  upgrade path, constant-effect item slots and world data. RI-MAG03 M7 scores unrun probes as
  zero and this build does not pretend otherwise. MB-3 and a partial MB-10 do run.
- **`game/data/progression/birthsigns.json` declares a Focus-absorption power** ("The Dry Well"),
  which RI-MAG01 §A makes an automatic fail. It is **not implemented** here and the conflict is
  filed as its own failing check in `magic-audit.mjs`. It needs a ruling, not a builder.
