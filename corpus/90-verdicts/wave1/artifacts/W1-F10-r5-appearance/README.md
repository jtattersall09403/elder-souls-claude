# `W1-F10-r5-appearance` — the characters, photographed in the running game, on real hardware

**Roadmap item `F10`. This is a capture-and-judgement piece, not a build piece: no game geometry was
changed.** It exists because round 4 landed real, measured character work and then wrote, first in its
own status file:

> *"I TOOK NO FRAME OF THE ACTUAL GAME, AND THAT IS THE CHARACTER DIRECTIVE'S REQUIREMENT #3 UNMET…
> EVERY APPEARANCE CLAIM I MAKE COMES FROM OFFLINE RENDERS OF THE BUILT GEOMETRY."*

Those frames now exist. **Open `sheets/` first.**

---

## What is here

| Path | What it is |
| --- | --- |
| `sheets/` | Before-and-after pair sheets, one per question. This is the deliverable. |
| `stills/` | A small number of full-resolution frames where the tile in a sheet is too small to settle the point. |
| `metrics/` | The capture manifests (per-frame hash, liveness verdict, projected subject box, camera pose) and the walk-cycle measurement. |

Raw PNG sequences are **not** committed — `orchestration/plans/W1-30-EVIDENCE.md` §5. They live in
`reports/runpod-gpu/runs/f10-r5-appearance-r2/artifacts/{after,before}/frames/` on the box that ran
them, and every one is reproducible from the commands below.

---

## Provenance — every arm, and how to check it yourself

**Both arms ran in one process, on one Pod, on one GPU.** An earlier round ran its arms on an A5000
and an A4500 and weakened its own claims; this run cannot, because there is only one card.

| | |
| --- | --- |
| Pod | `62ug0qier3s75u`, **NVIDIA RTX A4500**, driver 550.127.05, SECURE, $0.25/hr |
| Renderer, both arms | `ANGLE (NVIDIA, Vulkan 1.3.277 (NVIDIA NVIDIA RTX A4500 (0x00002232)), NVIDIA)` — hardware, not SwiftShader |
| Snapshot revision | `0a258604ececd0be637d04a297cbca5ccf61cee7`, pinned with `--revision` (HAZARDS §15a) |
| AFTER arm | `game/src/render/actor.js` as committed |
| BEFORE arm | the same file replaced by `tools/visual/fixtures/f10-r5-control-actor.js`, which is `b175da8e:game/src/render/actor.js`, sha256 `555d7fb132a2e086251582e118e76e5c408a3257e1cff283cb98e9bd30e01300` |
| Everything else | identical between arms — engine, UI, data, capture tool, GPU, driver, process, seed |

**Why `b175da8e` and not `HEAD~1`** — HAZARDS §12. Two orchestrator whole-tree banks (`08fe44d8`,
`1e60f58d`) carried round 4's edit into `HEAD` before it landed under its own headline, so a `HEAD~1`
control would already contain the fix. The pin is **checked, not assumed**:

```sh
git show b175da8e:game/src/render/actor.js | grep -c 'clawed\|CLAW'   # -> 0
git show HEAD:game/src/render/actor.js      | grep -c 'claw'          # -> 16
git show b175da8e:game/src/render/actor.js | sha256sum                # -> 555d7fb1…
```

**Reproduce:**

```sh
node tools/runpod/cli.mjs run --revision <sha> --max-runtime 30 \
  --artifact-dir reports/runpod-gpu/runs/f10-r5-appearance-r2 \
  --command "$(cat <the pod script, reproduced in the status file>)"
```

---

## What was shot, per subject

Five subjects — the player and four NPCs, **both body families and four races** (saxhleel, argonian,
dunmer, imperial), chosen by `selectByProximity` so the camera orbits a person and not open sea.

| Slot | Frames | Question it answers |
| --- | --- | --- |
| `C4` | 8 | the directive's eight-angle orbit, whole figure |
| `FA` | 4 | the face at head scale — *are the heads still eggs?* |
| `H1` | 8 | the hand at hand scale, four bearings, each shot to both sides of the body axis |
| `H2` | 4 | the hand from below and from above |
| `F1` | 3 | the feet, from the front, the side and above |
| `M` / `MF` | 24 | the walk, whole figure and feet, **with the stick actually held** |


---

## Does it look better? Yes for the hands, no for the feet, and the humans have no faces.

Written after opening the sheets and the full-resolution frames, not after reading the numbers.

### 1. The hands. This is a real, visible win, and it is the round-4 work.

Open `stills/hand-BEFORE-an-egg-with-stubs.png` and `stills/hand-AFTER-four-clawed-digits.png` —
the same NPC, the same camera, the same GPU, the same process, one file different.

**BEFORE:** a smooth dark ovoid hanging off the wrist with three short stubs poking out of the
bottom. It is an egg. **AFTER:** a narrow wrist, a palm, four digits that hang free with the room
visible between them, each curling through a knuckle to a pale pointed claw.

It is not a subtle change and it does not need a metric to see, but here is one anyway: across
`H1`/`H2`, **52 of 60 hand close-ups differ between the arms, median 5.6–7.2% of the whole frame,
and up to 55.9%** (`metrics/arm-pixel-diff.json`). And it survives at distance: at whole-figure
framing `C4` still differs on **40 of 40** frames.

**What is still wrong with them.** The digits are thin sausages of near-constant thickness and the
claws are proportionally enormous — from below (`H2`) the hand reads as a raptor's foot or a
mechanical gripper rather than a hand, because the claw is nearly as long as the segment carrying
it. The palm does not read as a plate from any angle I looked at; from three of the six bearings the
largest mass in the hand is still a rounded knuckle cluster. It is a hand now. It is not yet a
*good* hand.

### 2. The feet. Round 4's foot work is invisible. Not "subtle" — invisible.

`sheets/04-feet-player.png` and `sheets/05-feet-walking.png`.

The player's legs end in **flat-bottomed cylinders** — a blue trouser tube with a yellow cuff,
resting on the ground. There is no heel, no sole, no ball, no toe and no claw. Round 4 built a heel,
a sole, a ball and three clawed toes; **none of it is on screen.**

The measurement agrees exactly and it is the strongest single number in this pack: on the
player's foot close-ups, **not one pixel differs between the two arms.** All three static `F1`
player frames are byte-identical, and **7 of 8 walking foot frames are byte-identical** (the eighth
differs by 0.053%). Every one of those frames is `LIVE` with a luma span of 156–176, so this is not
a dark frame hiding a change — it is a live picture of a leg with no foot on it.

**Do not read the NPC feet as confirming this.** 10 of 15 NPC foot frames are also identical, but
they are dark interior frames — `shadow_levels: 0`, gated `NO_SUBJECT`. **NPC feet are unjudged**,
not unchanged, and saying otherwise would be the mistake this whole round exists to stop.

The likely mechanism, stated as a hypothesis for the next builder rather than a finding: the leg
clothing volume is a solid tapered tube whose bottom rim sits at or below the ankle, and the foot is
built *inside* it. That is the same defect class as round 4's own headline — *"the hands were not
missing, they were buried"* — one joint further down, and it was not looked for because nobody had
taken a frame.

### 3. The faces. The reptiles read. The humans are literally featureless eggs.

`sheets/07-faces-after.png`, twenty head-scale frames, five subjects, four bearings each.

- **Reptilian (saxhleel, argonian — rows 2, 3 and the player):** a snout, two yellow eyes, a
  nostril, a horned crest. Not detailed, but it is a face and it reads at conversation distance.
- **Humanoid (imperial, dunmer — rows 1 and 4):** a bald ovoid on a neck. **No eyes, no nose, no
  mouth, no ears, no brow, no jaw, no hair.** From all four bearings. See
  `stills/face-AFTER-humanoid-is-a-featureless-egg.png`.

**How many characters this is: 148 of 408.** Counted this turn, not remembered —
`game/data/npcs/*.json`, 18 files, 408 records carrying a race: argonian 181, saxhleel 77
(reptilian, 260 total) against imperial 59, dunmer 57, nord 12, breton 10, khajiit 6, redguard 1,
orsimer 1 (humanoid, 148). The six khajiit are counted humanoid here and get a human egg, which is
its own gap.

So round 4's honest "I did not fix the heads" understates it. The heads are not merely
under-detailed; on **36.3% of the cast the face is absent geometry**, and that is the single most
disfiguring thing in these frames.

### 4. The walk. It is not a rigid glide — but nothing plants, because there is nothing to plant.

This is the first time the player has actually been made to walk for a capture. **See §7 for why
that sentence is not hyperbole.**

`sheets/06-walk-cycle.png` — 16 frames over 64 simulated frames, the player travelling **3.315 m**
with the stick held at 0.55, the camera re-aimed at the body from a fixed bearing so the only thing
that can change in frame is the pose.

**The legs do scissor.** `metrics/walk-silhouette-AFTER.json`: mean per-row silhouette XOR of
**27.8 px in the leg band against 7.8 px in the head band, a ratio of 3.56**. The null control is a
capture of the same scene with the stick never applied, which returns leg 2.8 / head 1.4, ratio
1.92. So there is a leg cycle above the noise, and "rigid glide" is too strong.

**But the impression on screen is a stiff shuffle**, and the reason is §2: the legs are two tubes
that end in flat bottoms, so there is no heel strike, no toe-off and no foot angle — the thing that
reads as a walk is missing its two loudest cues. `sheets/05-feet-walking.png` is eight frames of the
ground passing under a pair of cylinders.

**One caveat on my own instrument, stated because it cuts against the tidiness of the number:** the
torso band scores 47.0 px, *higher* than the leg band. I believe that is the shield and sword
swinging inside that band rather than torso motion, but I did not isolate it, so the leg/torso ratio
of 0.59 should not be read as "the torso moves more than the legs".

### 5. Round 4's open regression: I could not see it, and here is what I can say instead.

Round 4 left one guard red — `actor-orbit-holes.mjs` went from 1,736 crack pixels in 1,002 of 5,760
frames to 5,758 in 2,502, and its author could not explain `cloth/calf_l` moving 8,881 → 61,788.

**In the game frames I cannot find a hole that should not be there.** The daylight the detector is
counting is visible in `stills/hand-AFTER-four-clawed-digits.png` — the room shows *between the
digits*, which is the entire point of the round and exactly the "legitimate through-gap" r4 guessed
the depth heuristic could not tell from a crack. At the wrist and along the forearm I found no seam
in any of the 60 hand close-ups I looked at.

**On the ankle hypothesis specifically, the evidence is unusually clean:** the player is `saxhleel`,
the same body whose `cloth/calf_l` tally moved, and **its foot frames are byte-identical between the
arms**. A new ankle seam that produced 53,000 border pixels offline produces **zero** changed pixels
in a live 960×540 frame pointed at that ankle. That does not prove the offline number is wrong — it
proves the regression is **not visible**, which is the question I was asked.

### 6. Overall — would the owner think the characters look good if they loaded the game now?

No. They would think the hands got much better and everything else is still wrong. The figures read
as slabs: the torso is a broad flat-fronted box, the legs merge into a single column at most
bearings, the shoulders have no deltoid — the arms leave the body as plain tubes — and each surface
is one uninflected colour (`sheets/01-player-orbit.png`, `sheets/08-npc-orbits.png`). The head sits
on a cylinder of neck nearly as wide as the skull, and at head scale the snout carries a hard
specular highlight that reads as wet plastic. Half the cast has no face.

A capture note that is a finding in itself: the three NPCs at `street-gideon` are **indoors and very
dim** — 10 of their 15 foot close-ups come back with `shadow_levels: 0`. `sheets/08-npc-orbits.png`
is a dark sheet, and that is what the room looks like, not a capture fault. But it does mean the
NPC-side close-up evidence in this pack is weaker than the player-side evidence, and I have not
claimed otherwise anywhere above.

The honest one-line version: **round 4 fixed the hands, and the hands were never the first thing you
look at.**

### 7. Two tooling defects found on the way, both of which had silently voided earlier evidence.

Neither is a game bug. Both are reasons earlier F10 rounds could not have produced what they
believed they were producing, and both were found by paying for a Pod and reading what came back.

**(a) `setInput` is not a harness verb, so no capture of this project has ever photographed a moving
player.** `grep -rn setInput game/` returns **0 matches**. `f10-r3-materials.mjs:341` and
`f10-r4-digits.mjs:267` both open their motion block with `await call('setInput', {forward: 1})`,
and `call()` turns a missing method into `{ok: false}` that neither tool checks. The frames still
differ from one another — water and foliage move — so nothing looked wrong. Proof rather than
inference, and measured rather than eyeballed: across the whole of r3's "walk", the outer 6% border
ring of the frame — pure background, since the camera tracks the body — changes on **0.2%** of its
pixels (185 of 91,904, first frame against last). The same measurement on this round's walk, same
camera rule, same canvas: **71.35%** (65,576 of 91,904). The player never left the spot. The real path is `queueInputs`, whose `move` event sets
`moveX/moveY` and lets them persist (`game/src/input/pipeline.js:211-213`), and it is what this
round used to move the player 3.315 m.

**(b) The liveness gate has been called with argument names it does not have.**
`frame-liveness.mjs` exports `gateBuffer(buf, {box, subject, label, throwOnDegenerate})`. r3 and r4
both call it as `gateBuffer(buf, {framing, canvas})`. Neither key exists, so `box` was `null` and
`subject` was `false` on **every frame either tool ever took** — the *"is the thing I am measuring in
it"* half of HAZARDS §15 never ran. This round passes a projected box on **159 of 159** frames and
records the verdict; 18 came back `NO_SUBJECT` and are named rather than counted as evidence.

**(c) And the one that cost money: importing `f10-r3-materials.mjs` runs r3's entire capture.**
That file has no main-module guard, so `import { selectByProximity }` executes its whole 76-frame
sweep and then `process.exit()`s before the importer runs a line. The first Pod of this round was
told to run `f10-r5-appearance.mjs` and the manifest that came home says
`"tool": "f10-r3-materials"`. **$0.019.** `f10-r4-digits.mjs:40` carries the identical import, so
round 4's tool could never have produced its own `H1`/`H2`/`F1` shot list either — a second,
independent reason that round reported *"ZERO frames in over thirty minutes"*. The function now
lives in `tools/visual/lib/subject-proximity.mjs`, a real library, whose `sourceMatchesR3()` proves
the two copies have not drifted. **The proper repo fix — a main-module guard in
`f10-r3-materials.mjs` — was NOT made here**, because `node tools/ownership.mjs --for tools/visual/`
returns live piece `W1-30V` holding a claim on that directory.
