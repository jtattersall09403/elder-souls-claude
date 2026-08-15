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
