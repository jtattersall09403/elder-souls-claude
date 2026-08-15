# W1-F10 round 3 — the material work, before and after, on hardware

**Open `pairs-before/` and `pairs-after/` side by side. The clearest single pair is
`B3__npc-gideon-smith-10__yaw060.png`.** Same subject, same camera, same pose, same lighting, same
seed, both arms hardware-attested.

## The two arms

| | revision | GPU | renderer string |
|---|---|---|---|
| **after** | `1a3151ff64c7987644f36013f3bd02ad8821fc38` | NVIDIA RTX A5000, SECURE, $0.270/hr | `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A5000 (0x00002231)), NVIDIA)` |
| **before** | `5572193ea53ebe81b49465193b61f7e47375fd7d`, kept at `refs/control/f10-r3-control` | NVIDIA RTX A4500, COMMUNITY, $0.190/hr | `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A4500 (0x00002232)), NVIDIA)` |

**The before arm is a real delete-the-fix and only of the code under test.** It is `HEAD`'s tree with
`game/src/render/actor.js` swapped for `f86acd5b`'s, built with `git commit-tree` against a temporary
index so the working tree was never touched. `git diff --name-status HEAD 5572193e` returns exactly
one path: `M game/src/render/actor.js`. Every sibling's work, the world, the data and the capture
tool itself are byte-identical in both arms.

**`f86acd5b` and not `HEAD~1`, and this matters.** HAZARDS §12 happened to this piece: commit
`c148fca9` — a sibling's whole-tree "In-flight agent work" bank — carried this piece's *uncommitted*
`actor.js` into `HEAD` before it was landed. `git show d72481fc:game/src/render/actor.js | grep -c
'paintBody\|bodyMaterialBase'` returns **5**; the same command against `f86acd5b` returns **0**. A
control taken from `HEAD~1` would have contained the fix and come back green.

**The one confound, stated rather than buried: the two arms ran on different GPU models.** RunPod's
availability ranking gave the after arm an A5000 and the before arm an A4500. Mip selection and
anisotropic filtering are driver-side, and this piece's change is *about* texel density, so the
finest-grain claims are the ones this weakens. It does not touch the readable claims — a sash, a
bone toggle, cord lashing, a hem and a shoulder yoke are geometry and vertex colour, and no driver
invents them.

## What the pair shows

**Before:** each figure is one uninterrupted tone from shoulder to ankle, marked only by two faint
horizontal hairlines where the limb tubes join. No sash, no yoke, no hem, no fitting, no seam.

**After, on the same figure:** a wrapped sash reads as a dark band at the waist with a pale bone
toggle at its front; cord lashing steps three times up each forearm and twice up each shin; the
tunic hem and the legging cuff read as bands; the shoulder yoke is a second tone; the trunk has
tonal variation instead of one wash. On the reptilian family the hide carries scale rows and pale
ventral countershading.

**Look at the background NPC in the same frame.** The small figure at the left of
`B3__npc-gideon-smith-10__yaw060.png` also gained a sash. Nobody targeted it. That is the shared body
plan working: one edit, seventeen characters, 408 NPCs.

## Metrics

`metrics/texel-density-control-arm.json` and `metrics/texel-density-treatment-arm.json`, both from
`tools/visual/character-texel-density.mjs`:

| surface | target m/tile | control | treatment |
|---|---|---|---|
| saxhleel:skin | 0.700 | 0.127 (**5.52x too dense**) | 0.627 (1.12x) |
| humanoid:skin | 0.700 | 0.138 (5.06x) | 0.622 (1.13x) |
| saxhleel:cloth | 0.550 | 0.218 (2.53x) | 0.504 (1.09x) |
| humanoid:cloth | 0.550 | 0.234 (2.35x) | 0.503 (1.09x) |
| \*:bone (new) | 0.800 | — | 0.693 (1.15x) |

Control arm exits 1 (FAIL, 4 of 4 surfaces outside 2x); treatment arm exits 0 (PASS, worst 1.15x).

`metrics/manifest-{after,before}.json` carry the renderer attestation, all 76 frames per arm with
per-frame liveness statistics, the subject offsets, and the 148 rejected subjects.

## Cost

Two Pods, ~4.5 min and ~2 min of wall time, **about $0.026 in total**. Both terminated in the
mandatory cleanup path with deletion confirmed by a subsequent API lookup returning not found, and
both ephemeral templates deleted and confirmed too.
