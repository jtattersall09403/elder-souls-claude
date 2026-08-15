# W1-F2-WHY-NO-VISIBLE-CHANGE — why three measured fixes did not reach the frame

Evidence for `orchestration/status/F2-WHY-NO-VISIBLE-CHANGE.json`. Read that first; it states what
could not be done before it states anything else.

**All frames here are SwiftShader.** This is a differential experiment — every arm of one window runs
in one process, on one renderer, from one unmoved camera — which is the construction `HAZARDS.md` §15
permits. It is not an absolute appearance claim.

## The two images that are the diagnosis

Both are the difference between the shipped frame and one forced configuration, amplified 12x.

| file | what it shows |
|---|---|
| `diffs/pair01__shipped-vs-shadows_off__x12.png` | The **entire sun shadow map** (4096x4096) turned off. Almost entirely black. The only pixels it touches are the player and the boards directly beneath it — nothing on the ground, nothing where the building meets it. |
| `diffs/pair01__shipped-vs-env_off__x12.png` | The **sky's image-based-lighting probe** turned off. The whole frame, every surface, at every distance, blown out. |

That is the answer in two pictures: the light that could carry shape reaches almost nothing, and the
light that reaches everything cannot be shadowed.

## The numbers

Mean absolute RGB difference against the shipped configuration, over the exact 512x512 window the five
blind judges looked at (crop box copied verbatim from the sealed pairing key). 0-255 scale.

**The instrument's own noise floor is 1.25** — that is `shipped_recheck`, the shipped configuration
re-captured after three other arms from an unmoved camera. Nothing below it is an effect.

| arm | delta | |
|---|---:|---|
| `cell_lights_off` | 0.51 | below noise — a hypothesis this piece refuted with its own arm |
| `shadows_off` — the whole sun shadow map | **0.78** | **below noise** |
| `ao_off` — F2 at shipped settings | **0.92** | **below noise** |
| `gi_off` — F3's ambient fill | 1.51 | at the floor |
| `grade_off` | 1.73 | at the floor |
| `post_off` | 1.90 | at the floor |
| `ambient_off` | 4.45 | 3.6x |
| `ao_full` — F2 uncapped | 6.04 | 4.8x, and worse to look at |
| `sun_off` | 10.51 | 8.4x |
| `sun_x3` | 13.20 | 10.6x |
| `env_off` — the sky probe | **21.79** | **17.4x** |
| `indirect_off` | **24.57** | **19.7x** |

Both of the things five judges independently named as absent move the judged pixels **less than
re-taking the same picture does**.

## Open the crops

`crops/pair01__<arm>.png` is the judged window under each forced configuration, so this can be read
with eyes rather than trusted as a number. `crops/pair01__shipped-vs-sun_dominant-vs-REFERENCE.png`
puts the shipped frame, the full rebalance arm, and the reference plate that beat it side by side —
and the honest reading is that the first two are hard to tell apart and both are far from the third.

## Reproducing it

```
node tools/visual/f2-why-probe.mjs                       # live scene state at the pack's five setups
node tools/visual/f2-why-forced.mjs                      # all 16 arms x 5 windows, ~70 min
node tools/visual/f2-why-forced.mjs --configs shipped,sun_off,env_off,shipped_recheck --pairs pair01
node tools/visual/f2-why-forced.mjs --gpu hardware       # the same, on a Pod
```

`data/` carries the raw rows, including every arm's **readback of the live values at capture time**,
so an arm that silently failed to apply is visible as data rather than inferred. Two earlier versions
of this tool produced silent no-op arms; `sun_off`/`sun_x3` are the positive control that proves the
mechanism, and `run1-16arms-pair01.log` is the run they come from.
