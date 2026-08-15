# W1-F10-r8 — the body, the hat, and the player's own eye

Roadmap item **F10**. Round 8. Written **only** into this directory (HAZARDS §17).

## What is in here

| Path | What it is |
|---|---|
| `frames/` | 9 frames from the **running game**, SwiftShader, both arms in the same tool at the same seed and camera. `BEFORE__*` was rendered with `game/src/render/actor.js` at sha256 `f48b8e95…` — which is the same blob `W1-F10-r7.json` records as *its* after arm, derived independently — and `AFTER__*` with this round's. |
| `sheets/offline-*` | Offline shaded renders of the built geometry (`f10-r6-visible-surface.mjs --shade`), head and whole figure, before and after. No lighting claim may be made from these; they are shape previews. |
| `measurements/headgear-{before,after}.json` | `f10-r8-headgear.mjs`, 96 bearings over 2 families × 3 equipment sets. |
| `measurements/torso-{before,after}.json` | `f10-r8-torso.mjs`, 11 shipped figures. |
| `measurements/frame-liveness.json` | The five-test battery over all 9 frames. |
| `measurements/probe-local-swiftshader.json` | `f10-r7-appearance.mjs --probe-only` against the live game **after** all three changes — the regression check that the world still builds, places and conforms. |

## The control that makes the frame pair readable

Two of the four `shipwright-oleen` pairs are **byte-identical between the arms**:

```
91e77e6e…  BEFORE/AFTER  FA__npc-shipwright-oleen__record__b000.png
716957a0…  BEFORE/AFTER  FA__npc-shipwright-oleen__record__b090.png
```

Those two cameras are aimed at the subject's *authored* height, where nobody is drawn since round 7's
placement fix — so they are empty scenery, and their being identical is the proof that the capture is
deterministic and that the difference in the `ground__*` pair is geometry rather than noise.

## The two frames to open first

`frames/BEFORE__FA__npc-shipwright-oleen__ground__b000.png` against `AFTER__…`. Same person, same
camera, same process. The before frame carries the flat olive plank across the eyebrows that
`W1-F10-r7-appearance` §4 called *"more disfiguring than either thing round 7 fixed"*; the after frame
has a band on the crown and a face under it. The saxhleel NPC on the right of the same frame carries
the bright amber bead eye in the before and does not in the after.

## What these frames are not

**SwiftShader, so they are not valid for an appearance claim** (W1-30-EVIDENCE §4) — no colour,
material or light finding may be made from them. What they establish is *where the geometry is*, which
is what all three of this round's changes are about. No hardware frames were taken; see
`orchestration/status/W1-F10-r8.json`, first entry.
