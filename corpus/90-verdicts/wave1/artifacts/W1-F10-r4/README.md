# W1-F10-r4 — the hands and feet were not missing; they were buried

**Roadmap item `F10`. Builder round 4. Read `orchestration/status/W1-F10-r4.json` first — its
`what_i_could_not_do` list is the honest half and it is deliberately at the top.**

## Shas

| | |
|---|---|
| pinned baseline / control | **`b175da8e9323ed8149fe1fda5fe7ccfdf5244a33`** |
| how it was verified free of this work | `git show b175da8e:game/src/render/actor.js \| grep -c "clawed\|CLAW"` → **0** |
| treatment | `73ee7f47` (and the two orchestrator whole-tree banks `08fe44d8`, `1e60f58d` that carried it early — HAZARDS §14) |
| control tree | a real `git worktree add --detach <dir> b175da8e`, with `node_modules` and `tools/node_modules` symlinked in per HAZARDS §7 |

`HEAD~1` was **not** used as the control, deliberately: two sibling whole-tree banks titled
*"In-flight: … F10 r4 …"* carried this piece's uncommitted `actor.js` into `HEAD` before it landed,
which is exactly the failure HAZARDS §12 describes. The pinned sha was checked, not assumed.

## The premise this round was given, and why it was wrong

The brief and `W1-F10-r3-materials.json` both open with *"HANDS AND FEET ARE STILL ABSENT … no
fingers, no palm, no toes, no sole"*. A palm ellipsoid, three fingers, an opposed thumb, a sole and
three toes have been in `game/src/render/actor.js` since commit **`fdd41f0a`, 2026-08-12**
(`git log -L 989,1008:game/src/render/actor.js`). They were present at r3's own baseline.

They were **buried** — inside the `PLAN` leaf tubes, inside oversized palm/sole ellipsoids, and, on
the player and every combatant, inside a `hands` equipment guard that was a **15.6 cm-diameter,
19 cm-long closed cylinder over the entire hand**.

## Open these first

- **`geometry/hand-before-after.png`** — four views, same geometry pipeline, control on top.
  The BEFORE is an egg with three stubs. The AFTER is a narrowing wrist, a palm plate, a knuckle
  ridge, three curling clawed fingers and an opposed clawed thumb.
- **`geometry/foot-before-after.png`** — three views. BEFORE is one fat lozenge with three
  toe-stubs; AFTER has a heel, a sole, a ball and three clawed toes.

**These are offline shaded renders of the built actor geometry, not game frames**, and must never be
cited as game frames: no game lighting, no materials, no post chain. They exist because the browser
capture did not finish (see the status file). What they are evidence *of* is the geometry, which is
what this round changed.

## The numbers, both arms, same instrument

`tools/visual/character-digit-read.mjs` was copied INTO the control worktree so the instrument is
held constant and only the code under test differs.

| measurement | control `b175da8e` | treatment |
|---|---|---|
| hand, civilian — `separated_fraction` | 0.341 – 0.346, **12 of 12 fail** | 0.441 – 0.567, **0 of 12 fail** |
| hand, combatant (guard visible) | 0.003 – 0.335, **12 of 12 fail** | 0.423 – 0.566, **0 of 12 fail** |
| foot | 0.063 – 0.067, **12 of 12 fail** | 0.236 – 0.294, **0 of 12 fail** |
| head `buried_fraction` | 0.747 | 0.747 (untouched, by design) |
| triangles per biped actor | 25,404 | 27,788 (**+2,384, +9.4%**) |
| draw calls per actor | 29 | **29 — unchanged** |

Reference anchor: ~**0.59** separated fraction, **eyeballed** (not computed) off
`corpus/70-visual/refs/context/ESO-argonian_character__steam-1634540211.jpg` opened at native
1920×1080 with both hands cropped and enlarged 3×. The hand gate is set slacker, at 0.40.

## Reproduce

```
node tools/visual/character-digit-read.mjs --self-test        # must pass
node tools/visual/character-digit-read.mjs --sample=5
node tools/visual/character-digit-read.mjs --sample=5 --equipped
node tools/visual/character-digit-read.mjs --sample=5 --part=foot
node tools/visual/character-face-relief.mjs --self-test        # three arms, must disagree
node tools/visual/character-face-relief.mjs --sample=5 --bone=head
node tools/visual/character-texel-density.mjs --sample=5       # r3's guard, still PASS
node tools/visual/mesh-winding.mjs                             # 0 of 744 inverted
node tools/visual/actor-orbit-holes.mjs --angles=8 --json=/tmp/h.json
```

## What a critic should attack first

1. **`metrics/orbit-holes-*.json`.** Crack pixels rose from 566 to 1,942 (8-angle) and 1,736 to
   5,758 (24-angle). I argue most of that is the daylight between digits that this round exists to
   create — the detector's depth-spread heuristic cannot tell two adjacent fingers from two sides of
   a crack, and `skin/hand_r` went 559 → 47,637 border-weighted px. **I cannot prove all of it is
   legitimate** and `cloth/calf_l` moving 8,881 → 61,788 is not explained by fingers. Settle it.
2. **Open `geometry/hand-before-after.png` and disagree.** If the after does not read as a hand to
   you, say so; the levers are all named constants in one block.
3. **The foot gate of 0.18 is anatomical, not photographic** — no bare-foot reference exists in
   `refs/characters/`. Overturn it with a plate.
4. **`refs/characters/INDEX.md` §1 calls the C4 slot "Full-body humanoid, head to foot".** All 25
   `character_fullbody/` plates were opened this turn and every one is a **cuirass render with no
   head, no hands and no feet**. That is a bar defect, not a build defect, and it is not mine to fix.
