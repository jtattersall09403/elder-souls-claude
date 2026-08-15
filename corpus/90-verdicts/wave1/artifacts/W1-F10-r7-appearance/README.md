# `W1-F10-r7-appearance` — the hardware frames round 7 owed

Roadmap item **`F10`**. This directory is the evidence for one question: **does what round 7 changed
look better in the running game?** Round 7 landed three changes and photographed none of them; its
own first `what_i_could_not_do` says so — *"I TOOK NO HARDWARE FRAMES AND SO I CANNOT SAY IT LOOKS
BETTER."*

## What is on trial

| # | Claim | Where it is visible | Slot |
|---|---|---|---|
| 1 | NPC ground placement: 12 of 31 buried (worst 2.31 m), 15 airborne (worst +35.39 m) → 0 and 0 | a **wide** frame of the Lilmoth crowd | `W` |
| 2 | The eye is a dark recess with a bright iris, as a fraction of each actor's own skin | a **face close-up** | `FA`, `FP` |
| 3 | The foot conform now reaches NPCs | ground where the **feet stand at different heights** | `FS`, `FSF` |

## The three things this round did differently, and why

**1. The stands were chosen, not inherited.** Round 7 measured that the three stands every earlier
round used offer **at most 0.034 m** of per-foot ground difference — *"a capture there is
predetermined to be a null, whatever the GPU."* `tools/visual/f10-r7a-slope-scan.mjs` scanned
**361,201 points** around Lilmoth for walkable, dry ground where the two feet stand at different
heights, and the two stands used here carry **0.68 m** and **0.24 m** — 20× and 7× the old stands.
The capture re-measures that at the actual foot bones and writes the number into its manifest.

**2. Subjects were chosen BY VARIANT.** `hum.imperial-clerk` had never been in frame across four
rounds, because subjects were picked by proximity to three fixed stands and both humanoids near
those stands hash to `hum.dunmer-lean`. `tools/visual/f10-r7a-shotlist.mjs` re-derives
`characterFor()`'s hash offline and finds **14 of the 16 shipped variants within 60 m** of the
Lilmoth stand. The capture then reads each drawn NPC's own `userData.actor.characterId` out of the
live scene and fills a variant quota from it.

**3. Every camera is a pure function of a coordinate.** The change under test moves characters by
up to 35 m, so a camera that follows its subject would silently re-frame between the arms and the
pair would be measuring the camera. Faces are therefore shot at **both hypotheses** — once where
the authored height puts the person (where the BEFORE arm draws them) and once where the ground
does (where the AFTER arm draws them).

## The control

Both arms run **back to back in one Pod, on one GPU, in one process tree**. The BEFORE arm is
`game/src/render/renderer.js` and `game/src/render/actor.js` reverted to the pinned baseline blob
`bb65607a`, **verified by sha256 on the Pod** — not a tree checkout, so every other file stays
byte-identical between the arms (HAZARDS §11, §12). See `tools/visual/fixtures/README.md` for the
two shas and the import/export diff that says the swap is safe.

`pod-command.sh` is the exact command the Pod ran. `arm-proof.txt` is its own record of which file
each arm rendered.

## Reproduce

```sh
node tools/visual/f10-r7a-slope-scan.mjs --centre 2766,5011 --radius 300 --step 1.0
node tools/visual/f10-r7a-shotlist.mjs   --stand 2766,5011 --radius 60
node tools/runpod/cli.mjs run --revision <sha> --max-runtime 25 \
     --command "$(cat corpus/90-verdicts/wave1/artifacts/W1-F10-r7-appearance/pod-command.sh)"
node tools/visual/f10-r7-appearance-read.mjs --run <run-dir>/artifacts --out <dir>
bash corpus/90-verdicts/wave1/artifacts/W1-F10-r7-appearance/build-sheets.sh <run-dir>/artifacts <sheets-dir>
```

Every tool above carries `--self-test` with arms required to disagree.

## Written verdict

`orchestration/status/W1-F10-r7-appearance.json`, with what could not be done stated first.
