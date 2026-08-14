# First ten minutes — the numbers, 2026-08-14

`reports/**` is `*`-ignored by policy: run artifacts are reproducible from the tools and do not
belong in history. `reports/.gitignore` §5 records what that cost once — 56 of 76 Wave-1 verdicts
cited evidence a fresh clone did not have. This file is the tracked half (`!**/*.md`), so the
numbers a verdict rests on survive a clone. The frames themselves are 11 MB and regenerate with:

```
node tools/harness/first-ten.mjs --tag <tag> --only d3
node tools/harness/first-ten.mjs --tag <tag> --only d1,d2 --canvas 640x360
```

**Renderer, every run:** `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)),
SwiftShader driver)` — software GL, read fail-closed. Nothing here is evidence about
driver-specific filtering or MSAA.

---

## D3 — people who were not where the conversation was. **FIXED.**

| | before | after | null control (presence fix only) |
|---|---|---|---|
| NPCs in the world | 56 | 56 | 56 |
| at world-origin coordinates | 32 | 29 | 32 |
| **visible bodies at the world origin** | **5** | **0** | **3** |
| **residents drawn in Lilmoth** | **24** | **27** | **24** |

The five, individually:

| eid | before | after |
|---|---|---|
| `blackwood-company-factor` (Corvus Aldeyn) | `[-1.44, 0, 2]`, drawn, **5723 m** from the player | `[2750.1, 2.68, 5031.9]`, drawn, **27 m** |
| `lilmoth-rootkeepers` | `[-2.76, 0, 0.52]`, drawn, 5725 m | `[2719.5, 2.68, 5040.1]`, drawn, **55 m** |
| `lilmoth-yard-brothers` | `[-1.44, 0, 0.64]`, drawn, 5724 m | `[2773.7, 2.68, 5068.6]`, drawn, **58 m** |
| `lilmoth-archivist-ledger` | `[4.11, 0, 1.84]`, **drawn** | same coordinates (correct — they are interior-local), **not drawn** |
| `lilmoth-mudborn-shrine` | `[3.99, 0, 1.98]`, **drawn** | same coordinates, **not drawn** |

**Why the null control is the plausible wrong answer and not the trivial one.** The trivial null is
"delete both halves and watch it break", which only re-runs the before. The plausible one is what a
reasonable person would actually have done on seeing that the bodies at the origin are interior
residents: fix the *presence* half and ship it. The headline number then improves — 5 to 3 — while
`residents_in_town` stays at 24 and Corvus Aldeyn is still 5.7 km away and merely invisible. A fix
that only hid people would have passed a naive gate.

## D1 — the buried camera. **NOT FIXED. Decisively diagnosed.**

`player_visible_px`: the frame rendered twice from one camera pose, once normally and once with the
player's materials set to `colorWrite:false`, differing pixels counted. The method is
`tools/harness/vt-seethrough.mjs` §1.1, so this and the audit agree.

| frame | 0 | 60 | 120 | 180 | 240 | 300 | 360 | 420 | 480 | 540 | 600 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| player pixels | 9766 | 7744 | 9132 | 7243 | 4975 | **1189** | **1** | 7385 | 7385 | 7364 | 7388 |
| % of frame | 4.2 | 3.4 | 4.0 | 3.1 | 2.2 | 0.5 | **0.0** | 3.2 | 3.2 | 3.2 | 3.2 |

At f360 the character is **one pixel**. It is genuine occlusion, not bad framing, and it is
transient. The two burial frames have *different* occluders — f300 is a wooden deck, f360 is a tree
trunk — and the tree one has a named cause in `world/province.js:1230 updateOcclusion()`, whose test
is a proximity bubble rather than a sightline. Full write-up: `orchestration/NEXT-DISPATCH.md` R3.

## D2 — rain through roofs. **NOT FIXED. Built, measured failing, switched off.**

The defect is real: **15 of 192 live streaks are under a roof at the spawn point.**

Surviving streaks per stop, with the cull enabled:

| frame | 0 | 60 | 120 | 180 | 240 | 300 | 360 | 420 | 480 | 540 | 600 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| live | 192 | 1 | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 2 | 1 |
| under cover | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Wrong in both directions at once: nothing culled at f0 where 15 streaks are genuinely covered, and
near-everything culled from f60 on including under open sky. Rain vanishing from the world is worse
than rain through a deck, so `render()` passes `null` and the cull is inert — behaviour is exactly
what it was before, which the `null-d2-unwired` arm confirms by reading an identical 192/15 at f0.
Cause and the one-line re-enable: `orchestration/NEXT-DISPATCH.md` R4.

## charOpacity — the consumption failure. **FIXED.**

`tools/render/consumption-sweep.mjs`, over a stated population: **98** per-frame fields on the four
`sim/state.js` factories, against all **21** files in `game/src/render/`.

| | before | after |
|---|---|---|
| VISUAL fields | 10 | 10 |
| **VISUAL with no consumer** | **1** (`camera.charOpacity`) | **0** |
| AMBER (reaches the frame another way, checked by hand) | 3 | 3 |
| INTERNAL | 85 | 85 |
| tool exit code | **1** | **0** |

The three amber rows are `camera.shakeYaw` and `camera.shakePitch` — which do reach the frame as a
positional wobble via `viewBasis() -> writePose() -> camera.pos`, though the *rotation* RI-CAM06 §G
calls the whole intent is discarded by `camera.lookAt()` — and `camera.clipThrough`, a diagnostic
that was never meant to be drawn from. Recorded as amber rather than red because a tool that cries
wolf on three of its ten rows would not survive its first reader.

**Owed and not delivered:** a photograph of the fade actually happening. The consumer exists and the
sweep is green, but "the metric is green" is precisely the evidence this project has learned not to
trust. It needs the camera driven hard into a wall.
