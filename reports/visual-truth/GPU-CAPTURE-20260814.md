# The capture tools can now use the GPU — 2026-08-14

Two things in this repo both worked and had never been joined.

**The transport is proven.** `reports/runpod-gpu/TRANSPORT-20260814.md`: two live runs, RTX A4500 and
A5000, the game rendering under `ANGLE (NVIDIA, Vulkan 1.4.312)` rather than SwiftShader, a full run
in 2 m 51 s at $0.25/hr, artefacts returned as one tar over ordinary HTTPS.

**The visual programme never used it.** The `W1-30V` agent reported *"no hardware GPU frame"* after
two Pods and two GPU types, because it was trying **SSH** — which cannot work in this container and
never will (raw TCP is blocked, and the agent proxy's `CONNECT` re-terminates TLS while SSH is not
TLS). The HTTPS route landed afterwards and nobody pointed the capture tools at it. Every screenshot
this project has ever taken has been SwiftShader.

This is the join.

---

## 1. What is new

| file | what it is |
|---|---|
| `tools/visual/lib/renderer-class.mjs` | the one place that decides HARDWARE vs SOFTWARE, from the renderer string the browser reported and from nothing else |
| `tools/visual/lib/gpu-launch.mjs` | launches the game on whichever renderer was asked for, walking the measured GL-backend ladder, and attests what actually drew |
| `tools/visual/deck-motion.mjs` | **the twelve motion sequences the Deck has declared since it was generated and nobody had ever captured** |
| `tools/visual/gpu-deck.mjs` | one batched Pod job: stills + motion + contact sheets, one tar back, with the cost in dollars and minutes before and after |

Changed: `tools/visual/deck.mjs` (`--gpu hardware`, `--require-hardware`, evidence class through the
shared classifier), and `tools/harness/vt-play.mjs`, `vt-seethrough.mjs`, `vt-world.mjs` — which now
write a `renderer.json` beside their frames instead of leaving the evidence class to a human caveat.

## 1a. And it ran — the whole Deck, on a real GPU, twice

| | proving run | **the full Deck** |
|---|---|---|
| Pod / GPU | `ji4npp76y25f51` — RTX A4500 | `y7kvxe5sggeqhj` — **RTX A5000** |
| renderer the browser reported | `ANGLE (NVIDIA, Vulkan 1.4.312 … RTX A4500)` | `ANGLE (NVIDIA, Vulkan 1.4.312 … RTX A5000)` |
| stills | 6 ok, 0 red | **288 ok, 0 red, in 143 s** |
| motion | 1 sequence, 180 frames | **11 of 12 sequences, 2,220 frames, in 318 s** |
| wall clock | 3.34 min | **10.02 min** |
| cost | **$0.014** | **$0.045** |
| Pod afterwards | terminated, deletion API-confirmed | terminated, deletion API-confirmed |

Artefacts: `reports/runpod-gpu/runs/deck-hw-{smoke,full}/artifacts/`. The committable parts —
manifests with their per-frame hashes, and the eleven contact sheets — were lifted into
`reports/visual-truth/deck/hw-full/` and `reports/visual-truth/deck-motion/hw-full/` by
`node tools/visual/collect-run.mjs`, because the run directories are gitignored and evidence that
only exists in a gitignored directory does not exist.

**The one red is the tool working.** `spell` reddened with
`setCatalyst('root-speakers-rod'): unknown. Known: great_staff, rod, enchanted_weapon, none` — a
catalyst *kind* is wanted, not an item id. That is a named reason and a one-word fix, in place of
180 frames of a character standing still filed under "spell". The default is now `rod`; the next run
will settle it.

### What the sequences show, from the manifest rather than from an impression

- **`walk` really walks now.** The first hardware capture came back `state: RUN, anim: run,
  3.2 m/s` — because `game/src/sim/player.js:188` puts the WALK/RUN threshold at stick
  magnitude > 0.55 and the script was pushing 1.0. A full-stick "walk" sequence is a run sequence
  with the wrong label. At 0.55 it is `IDLE → WALK`, `anim: walk`, 5.23 m travelled.
- **`turn-180` turns the camera and not the body**: 177° of camera yaw, `0 m` travelled, and the
  player's own state and anim stay `IDLE`/`idle` for the whole sequence. Worth a look by whoever
  owns the third-person rig — and it is exactly the kind of thing no still can show.
- **`block-hit` found a sparring partner**: `inf_trash` spawned as `e1`, and the player passes
  through `ATK_RECOVER` and `BLOCK_HOLD` with `idle_guard` in the anim list.

### SwiftShader against hardware, on the same six setups

The same six shots were captured locally on SwiftShader (`reports/visual-truth/deck/sw-smoke`,
442 s — against 28 s for the same six on the Pod) and compared with `deck-compare.mjs`:

```
0 identical, 6 changed  (of 288 shots)
eye-deep-marshes      edge -0.0059  span -23  dom  0.0116
char-player           edge -0.0006  span  -3  dom -0.0599
approach-lilmoth      edge  0.0001  span  -4  dom -0.0158
vista-deep-marshes    edge  0.0002  span   0  dom -0.0031
```

Two things follow, and only two. **No frame is byte-identical across renderers**, so a determinism
gate may never compare a SwiftShader capture with a hardware one — determinism is a within-renderer
property. And **the composition statistics agree closely** on these six, which is consistent with
W1-30-EVIDENCE §4's fallback bullet that *deltas* taken under SwiftShader compare like with like. It
is six shots at one time of day and one weather; it is not a licence to make appearance claims from
SwiftShader, and it says nothing about MSAA or anisotropic filtering, which are exactly the rows §4
leaves CARRIED. The picture is
`docs/shots/2026-08-14-gpu-deck/2026-08-14-swiftshader-vs-hardware-same-three-setups.png`.

## 2. The default is still this box, on SwiftShader

Hardware is an option, not a requirement. A Pod bills by the minute; cheap local iteration is how
builders work. So:

```
node tools/visual/deck.mjs --profile wide --tag before        # local, SwiftShader, free
node tools/visual/deck-motion.mjs --only walk --frames 60     # local, SwiftShader, free
node tools/visual/gpu-deck.mjs --estimate --profile full      # prints the bill, spends nothing
node tools/visual/gpu-deck.mjs --profile full --tag hw-full   # rents a Pod, returns one tar
```

`--gpu hardware` on `deck.mjs` or `deck-motion.mjs` asks for a real GPU, which in practice only
exists on a Pod, so `gpu-deck.mjs` is the way in. `--require-hardware` refuses to capture at all
rather than quietly produce software frames on a run somebody is paying for.

## 3. The evidence class is now read, not asserted

Every manifest already had an `evidence_class` field. It was computed from a probe that had once
**failed open** — the probe threw, the `catch` returned a message matching no software pattern, and
the manifest recorded `software_renderer: false` **on a SwiftShader run**. That is why every frame to
date needed a manual caveat.

`classifyRenderer()` fixes the shape of the question:

- it takes **the string the browser reported**, and the request never votes. Ask for hardware, get
  SwiftShader, and the manifest says `SOFTWARE` and additionally `fell_back: true`;
- it **fails closed**: a probe that threw, an empty string, or a string naming no GPU vendor at all
  is SOFTWARE with the reason recorded. The historical defect string is in the self-test by name;
- `mesa` counts as software here **deliberately** — conservative rather than correct in general,
  because on this project hardware always arrives as ANGLE/NVIDIA and a `mesa` string means the Pod
  fell back. Revisit when an AMD or Intel Pod is in scope.

## 4. Motion — the gap that stills cannot cover

`tools/visual/deck.json` has declared twelve sequences since it was generated: walk, run,
sprint-stop, turn-180, roll-4dir, jump-land, attack-light, attack-heavy, block-hit, spell,
boundary-walk, day-night. Every profile lists them. **Nothing had ever read the list**, so no gate in
the tree is motion-satisfied — and aliasing, crawling silhouettes, foot-slide and blend pops only
exist in motion.

`deck-motion.mjs` captures them through the real input pipeline (`queueInputs` → ACTIONS → the same
bindings a keyboard drives), one PNG per simulated frame, a hash per frame, an animation trace per
sequence, and a contact sheet at every 6th frame — because W1-30-EVIDENCE §1 says a reviewer who
looked at one frame of a sequence has not reviewed it, and the sheet is what makes that checkable.

Three refusals are built in, each with a past failure behind it:

- **a sequence that cannot be set up goes red, with the reason.** No enemy to be hit by, no catalyst
  to cast with, no border to walk across — the row says so. A shorter report is not a better result.
- **a cast that never fired is not a spell sequence.** `spell` drains the magic event stream and goes
  red if nothing happened, rather than shipping 180 frames of a character standing still.
- **a sequence whose frames are all identical is one still repeated.** `distinct_frames` is in every
  row and `moving: false` is a red. This is the check a still can never make.

## 5. What a run costs

`node tools/visual/gpu-deck.mjs --estimate --profile <name>` prints it without spending anything.

**Every constant in the model is measured**, on the run in `reports/runpod-gpu/runs/deck-hw-smoke/`
(Pod `ji4npp76y25f51`, RTX A4500, $0.25/hr, 3.34 min wall, **$0.014 spent**):

| phase | measured |
|---|---|
| Pod create → agent answers through the RunPod proxy | **60 s** (the earlier transport runs saw up to 90 s, and the model keeps the slower figure) |
| bootstrap: apt, Node 22, Playwright, Xvfb | **62 s** |
| GL-backend probe + Playwright launch + the game's own `ready()` | **13 s**, per browser |
| a Deck still | **2.55 s** |
| a motion frame | **0.154 s** |
| a captured PNG at 960×540 | **~880 KB** |

So the whole thing, priced:

| profile | frames | minutes | dollars |
|---|---|---|---|
| `smoke` — 6 stills, 1 sequence | 186 | **3.3 measured** | **$0.014 measured** |
| `wide` — 96 stills, no motion | 96 | 6.0 | $0.027 |
| **`full` — 288 stills, all 12 sequences** | **2,688** | **10.0 measured** | **$0.045 measured** |

**A full Deck on real hardware costs four and a half cents and ten minutes.** That is the number the
fleet needs in order to decide when it is worth it, and at that price the answer is: whenever a
verdict is going to rest on appearance. It is cheaper than the argument about whether SwiftShader
counts.

Two runs also let the model separate two costs one run could not. A **setup** — teleport, leave an
interior, settle, pose — costs 2.46 s; each further **still** off that same setup costs 0.086 s. That
is why the full Deck is not forty-eight times the smoke run: the six lights per setup are nearly
free once the camera is standing there. The first estimate said 21.9 min / $0.091 against an actual
10.0 min / $0.045, and the model now carries the fitted constants, so `--estimate` should be close
from here.

**What comes home is bounded on purpose.** The controller buffers the whole tar in memory, and a
full motion capture returned frame-for-frame is ~2 GB in one HTTP response. `--return sheets` (the
one used for the full run) brings back every still, every manifest and the twelve contact sheets and
leaves the raw sequences on the Pod: ~242 MB. `--return sample` keeps every 6th motion frame
(~577 MB, printed with a warning), `--return all` keeps everything. The estimate prints the size
before you spend.

## 6. Self-test

`node tools/visual/gpu-deck.mjs --self-test`

HAZARDS §0's fifth failure shape was found on this box today: **every arm of a suite fabricated the
disputed input identically**, so it could never falsify its own premise. Ask which input all the arms
supply by hand. Here that input is obviously the renderer string, so the two arms that matter do not
invent one:

- the **software** arm launches a real browser on this box and reads the string off the live page;
- the **hardware** arm reads the string out of `docs/shots/2026-08-14-gpu-transport/gpu-smoke.json`,
  which was written by an RTX A5000 on a live Pod and committed as evidence.

Neither string is typed into the test. A third arm asserts the two **differ**, so if a later edit
made both arms read the same source the suite goes red instead of passing vacuously. A fourth arm is
the red control: it feeds each string to the opposite expectation and requires the verdict to flip —
if the classifier were reading the request rather than the string, that arm fails.

## 7. Three defects this work found in the tools it was connecting

Stated plainly because each cost something, and the third cost a Pod.

**1. A page-side throw killed the whole sweep, silently.** `browser.mjs`'s `h()` routes an
in-page exception into `die()`, which calls `process.exit`. Both the Deck and the motion runner
wrapped it in `try/catch` and believed they were catching failures; a `try/catch` cannot catch
`process.exit`. On the first local motion run `spawn('pop-0027-infantry')` threw, the process
ended at sequence 9 of 12, and **no manifest was written at all** — the exact "a shorter report
instead of a defect" failure the Deck's own header promises it will not produce. Both tools now
speak to the page directly and return the failure as a value. (The Deck's `goTo()` already
carried a comment about this, worked around case by case for `enterInterior(null)`; this is the
general form of the same fix.)

**2. `pop-0027-infantry` is not an enemy.** It is a population row, not a combat archetype, and the
engine refuses it by name — *"no such archetype… a phantom eid would be a fabricated measurement"*.
`tools/harness/vt-play.mjs` has been asking for it, which means its fight section has been failing
into a `catch` and reporting an error string. The real archetypes are in
`game/data/combat/enemies/`; `inf_trash` is the one this tool spawns.

**3. A 20 MiB upload with no retry ended a paid run before a frame was captured.** The first full
attempt died at 16/20.4 MiB with a bodyless `HTTP 404` — the shape the RunPod proxy returns while it
is still settling, not something the Pod agent said. `PodAgentClient.upload` now retries **the whole
upload**, three times with backoff. A *chunk* cannot be retried safely (a lost response for a
successful append duplicates bytes into the middle of a tarball); restarting at byte 0 with
`append=0` is idempotent by construction, and 20 MiB is cheap next to the Pod-minute it saves.

## 8. What I could not do

- **Nobody has judged these frames.** 288 hardware stills and eleven sequences now exist and no
  human or naive judge has scored one of them. Protocol A (`RI-VIS06`) is the primary instrument and
  running it is a separate piece — but the reason it could not run before was that every frame was
  SwiftShader, and that reason is gone.
- **The `spell` sequence has never been captured.** One word (`--catalyst rod`) and one more run
  will do it; I did not spend a fourth Pod on a single sequence.
- **The orbit gate is not on hardware.** `W1-30-EVIDENCE` §1's 144-frame orbit lives in
  `vt-seethrough.mjs`, which now attests its renderer and accepts `--gpu hardware`, but it is not in
  the batched Pod job and no orbit has been taken on a GPU. That is the obvious next piece and it is
  a two-line addition to `remoteCommand()`.
- **The raw motion frames from the full run are gone.** `--return sheets` deletes them on the Pod so
  the tar stays at 184 MB; the eleven contact sheets and the per-frame hashes came home, the 2,220
  PNGs did not. `--return sample` or `--return all` keeps them, at 577 MB and ~2 GB respectively.
- **I did not run the `night` or `weather` profiles on hardware**, and the full profile covers both
  weathers but only its own three times.
- **`frame-stats.mjs` was not run across the 288 hardware stills.** The Deck's own usability screen
  (buried camera, no-detail, flat-tone) would very likely flag some of them — `street-lilmoth` is
  flagged `occluded,no-detail,flat-tone` in the six-shot comparison above, which is a defect the
  inventory already knows about but has never seen on hardware.
- **Local timings in this session are worthless for comparison.** The box sat at load 13–25 on four
  cores for the whole piece; a single local motion frame took ~30 s while the same frame took 0.15 s
  on the Pod. `tools/contention.mjs` said **WAIT** for most of the session and I proceeded anyway,
  one browser at a time — stated here because the tool asks anyone who does that to say so.
- **The owner-slug caveat still stands.** `cleanup` identified me as `oe9b0d69d` "from
  CLAUDE_CODE_SESSION_ID (container-scoped: sibling agents share it)". My three Pods were each
  terminated by their own run's mandatory cleanup with deletion API-confirmed; the final
  `cleanup --dry-run` showed two live Pods belonging to *other* agents, correctly PROTECTED and left
  alone. **Zero Pods of mine are running.** Total spend for this piece: **$0.066** across three Pods.
