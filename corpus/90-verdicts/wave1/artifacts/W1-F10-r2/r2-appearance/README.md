# W1-F10 round 2 — the appearance evidence

**Open `sheets/00-summary.png` first.** Left of every pair is the tree *before* the round-2 character
work; right of every pair is the tree *after* it. Same world seed, same subjects, same camera
bearings, same GPU model. The only difference between the two arms is the four files under
`game/src/render/`.

## What was run

| | |
|---|---|
| after arm | `84ebc58c1e4b2a216c5dee1ca8712c112a9ec7e3` (branch HEAD at capture time) |
| before arm | `4dcd26d01ffb2d5118594843da9bd714737978f9` — HEAD with `game/src/render/` reverted to `f8f6b44b`, which is the last commit before any round-2 character work. Built with `git commit-tree`, kept at `refs/control/f10-r2-baseline`. `git diff --name-status HEAD 4dcd26d0` returns exactly four paths: `actor.js` M, `lib/race-art.js` D, `lib/rigs.js` M, `renderer.js` M. |
| renderer, after | `ANGLE (NVIDIA, Vulkan 1.3.277 (NVIDIA NVIDIA RTX A4500 (0x00002232)), NVIDIA)` — HARDWARE |
| renderer, before | `ANGLE (NVIDIA, Vulkan 1.4.303 (NVIDIA NVIDIA RTX A4500 (0x00002232)), NVIDIA)` — HARDWARE |
| where | two RunPod Pods, `9bymy8m84fmdqf` and `m5vs5laruljozp`, both RTX A4500 SECURE at $0.250/hr, both terminated and deletion-confirmed |
| frames | 166 per arm, 332 total, 960×540 |
| tool | `tools/visual/f10-r2-appearance.mjs`, identical in both arms |

## The sheets

| file | what it shows |
|---|---|
| `sheets/00-summary.png` | one pair per subject — start here |
| `sheets/orbit-gideon.png` | **the clearest single result.** Belliene's stand in Gideon holds four or five people in frame. Before: chrome skeletons. After: people in clothes. |
| `sheets/orbit-corvus.png` | Corvus Aldeyn, the `imperial` NPC the round-1 critic called *"a bald egg head… a wooden artist's mannequin"*. Eight angles, both arms. He rides `base.humanoid`, the family that had no eye geometry at all before this round. |
| `sheets/orbit-player.png` | the player, eight angles |
| `sheets/orbit-weeja.png` | Weeja-Sen, a `saxhleel` NPC — the reptilian body |
| `sheets/faces.png` | close-up heads, seven subjects, two bearings each |
| `sheets/walk-player.png` | the walk cycle, every sixth sim frame, camera tracking |
| `sheets/street.png` | four settlement streets at 9 m |

Each `sheets/*.stats.json` carries the per-frame luma p10/p50/p90, span, distinct shadow levels and
median local contrast for **both** arms — the HAZARDS §15 "is this a picture at all" numbers,
computed rather than asserted.

## What the frames do not show — read before citing them

* **47 of the 166 frames in each arm contain no subject.** Two NPCs selected at Gideon and Thorn
  (`Archein Salts-Her-Own-Reeds`, `Dead-Water Koor-Nakh`) are reported by `listEntities()` at
  positions within four metres of the world origin, which in Black Marsh is open sea; every frame of
  them is water and sky. A further seven orbit angles put the camera inside a building wall
  (Weeja-Sen 3, Halvo Nirith 4). These were found by opening the frames, not by a gate.
* **`renderCpuMs` is refused.** `getPerfStats()._unmeasurable` hard-codes *"This container is
  SwiftShader"* and returns 0 — on a run whose own WebGL context reports an RTX A4500. See
  `metrics/perf-before-after.json`.
* Nothing here is a blind comparison against a Skyrim or ESO reference plate. `RI-VIS08`'s comparison
  method needs the character reference set that `I5` is still acquiring.
