# `tools/visual/fixtures/` — frozen inputs for delete-the-fix control arms

A control arm needs the *old* code, and a rented Pod has no `.git`: the RunPod snapshot ships only
`game`, `tools`, `package.json` and `play.sh` (`tools/runpod/config.json` → `snapshotPaths`). So a
before/after pair that runs **both arms in one Pod process, on one GPU**, has to carry the baseline
file with it. That is what lives here.

## `f10-r5-control-actor.js`

- **What it is:** `game/src/render/actor.js` exactly as it stood at commit **`b175da8e`**.
- **How it was made:** `git show b175da8e:game/src/render/actor.js > tools/visual/fixtures/f10-r5-control-actor.js`
- **Proof it is byte-identical:** `sha256 555d7fb132a2e086251582e118e76e5c408a3257e1cff283cb98e9bd30e01300`,
  which is the sha256 of `git show b175da8e:game/src/render/actor.js` on stdout. Re-check with:

  ```sh
  git show b175da8e:game/src/render/actor.js | sha256sum
  sha256sum tools/visual/fixtures/f10-r5-control-actor.js
  ```

- **Why `b175da8e` and not `HEAD~1`:** HAZARDS §12. Two orchestrator whole-tree banks (`08fe44d8`,
  `1e60f58d`) carried the F10 round-4 edit into `HEAD` *before* it landed under its own headline, so
  a `HEAD~1` control would already contain the fix and come back green. `b175da8e` is pinned and
  **checked**: `git show b175da8e:game/src/render/actor.js | grep -c 'clawed\|CLAW'` → `0`, against
  `16` matches for `claw` at `HEAD`. (The baseline's single lowercase `claw` hit is line 1451, the
  `FST` fist-weapon model — a different thing entirely.)
- **Why a file swap rather than a whole-tree control:** it holds everything else constant. Between
  `b175da8e` and `HEAD`, `game/` also moved in `engine.js`, `ui/screens/inventory.js`,
  `ui/screens/text.js` and `ui/system.js` — none of it character work, all of it a sibling's. A
  whole-tree control would revert those too and put four extra variables into a character
  comparison. The swap is safe because the two versions have **identical import and export sets**
  (4 imports, 7 exports, checked with `grep -E '^(import|export)'` on both).

Consumer: `tools/visual/f10-r5-appearance.mjs`, driven by the Pod command recorded in
`corpus/90-verdicts/wave1/artifacts/W1-F10-r5-appearance/README.md`.

## `f10-r7-control-renderer.js` and `f10-r7-control-actor.js`

- **What they are:** `game/src/render/renderer.js` and `game/src/render/actor.js` exactly as they
  stood at commit **`bb65607a`** — the baseline `orchestration/status/W1-F10-r7.json` pins, and the
  same one its own delete-the-fix control used.
- **How they were made:**
  `git show bb65607a:game/src/render/renderer.js > tools/visual/fixtures/f10-r7-control-renderer.js`
  and the same for `actor.js`.
- **Proof they are byte-identical**, both checked on 2026-08-15 rather than asserted:
  - renderer `sha256 86924aec71d6c39db15aa2282b1b6e555394503762c569d51e9dbbb91f738aa9` — which is
    also the sha the r7 status file records for its own control arm, derived independently.
  - actor `sha256 38fc78c2d9a66f154b63b17df44f48ba6cd845e37755a80344f4721a5450d39d` — which is the
    sha `W1-F10-r6-appearance/measurements/arm-shas-at-start.txt` records as round 6's **after**
    arm. The two rounds agree about what `bb65607a` contains.

  ```sh
  git show bb65607a:game/src/render/renderer.js | sha256sum
  sha256sum tools/visual/fixtures/f10-r7-control-renderer.js
  ```

- **Why BOTH files, where r5 and r6 swapped one:** round 7's three changes span the pair. The NPC
  ground placement and the three conform call sites are in `renderer.js`; the eye and
  `poseStatic`'s new `water` parameter are in `actor.js`. Reverting one alone would photograph a
  tree that never existed.
- **Why the swap is safe:** the two files' import/export sets were diffed, not assumed.
  `renderer.js` is **identical** on both (18 lines). `actor.js` gains exactly two things at HEAD —
  `export function footConformDelta(...)` and a fifth `water` parameter on `poseStatic` — and
  `grep -rn footConformDelta game/ tools/` outside `actor.js` and these fixtures returns **0**, so
  nothing else in the tree consumes either. The baseline `renderer.js` calls `poseStatic` with
  four arguments, which the baseline `actor.js` accepts.

Consumer: `tools/visual/f10-r7-appearance.mjs`, driven by
`corpus/90-verdicts/wave1/artifacts/W1-F10-r7-appearance/pod-command.sh`.
