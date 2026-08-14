# What the game actually looks like when you play it — 2026-08-14

**What this is.** A ground-truth pass. Not a fix, not a plan: evidence and an honest inventory,
taken by booting the shipping build and driving it, under
`orchestration/OWNER-DIRECTIVES-2026-08-14.md` §2 — *"static inspection is not evidence."*

**Where the pictures are.** `docs/shots/2026-08-14-visual-truth/`. The curated set with dated
names is in `key/`; the full sequences are in `play/` (a driven session), `seethrough/` (the
transparency measurement, with its overlays) and the `start-noon-*` orbit at the top level.

**How things were driven.** Every input goes through the real input pipeline — `queueInputs` →
the closed `ACTIONS` set → the same bindings a keyboard drives. Nothing is a fixture. Where a
camera is posed rather than driven, the shot is labelled *orbit* and says so.

**Rendering caveat, stated up front.** Everything here is **SwiftShader** (software GL), not a
GPU. The GPU path was attempted and does not work from this container; the exact failure is in
§6 so nobody has to rediscover it. Geometry, materials, transparency, layout and composition are
faithful under SwiftShader. Anything that depends on driver-specific filtering or MSAA quality is
not measured here and is not claimed.

---

## 1. The transparency claim, judged

**Verdict: not reproduced.** At normal and close camera distances the player's body is solid.
The previous agent's "fixed" call happens to be right about the body — though, as §1.3 notes, it
was almost certainly right by luck rather than by measurement, and there is a real and different
defect sitting next to it.

### 1.1 What was measured, and why it cannot be fudged

Orbiting and eyeballing is what produced the disputed claim in the first place, so this is a
number, taken at every angle of a full orbit. For each angle the player is rendered three times
from the identical camera pose, with only the player's **materials** swapped:

| render | materials | what its mask means |
|---|---|---|
| `ship` | the shipping materials | what a player actually sees |
| `solid` | flat opaque colour, `side: DoubleSide` | the body's true outline |
| `gone` | `colorWrite: false`, depth off | the same frame with no player in it |

`A` = pixels where `ship` differs from `gone`. `B` = pixels where `solid` differs from `gone`.
**See-through = B \ A**: pixels inside the body's own outline where the backdrop comes through.
A solid character scores ≈0 at every angle. The tool is `tools/harness/vt-seethrough.mjs`, and it
writes a red overlay per angle so the number can be looked at rather than believed.

### 1.2 The result

| camera radius | angles | mean see-through | worst angle |
|---|---|---|---|
| 2.6 m | 12 (full orbit) | **1.4 %** | 2.3 % at 210° |
| 1.6 m | 8 (full orbit) | **0.2 %** | 0.3 % at 225° |

`key/2026-08-14-player-seethrough-overlay-210deg.png` is the worst angle with the see-through
pixels painted red. The red is confined to the tops of the feet, the shoulder seams, a hip edge
and two tail segments — small unsealed joints in the skinned surface, a few pixels wide. It is a
tidiness defect, not a transparency defect. The body reads as opaque from every direction.

The scene-graph audit agrees, and is in `docs/shots/2026-08-14-visual-truth/player-root-audit.json`:
of the 46 visible meshes in the player subtree, **every one** is `transparent: false, opacity: 1`.
The only genuinely transparent things attached to the player are the ground contact-shadow disc
(opacity 0.34) and the attack silhouette ring (opacity 0, i.e. off).

### 1.3 The real defect that lives where the reported one was

`sim/camera.js:527` computes `c.charOpacity = fadeOpacity(armLen)` every frame — the standard
third-person courtesy of dissolving the character when the camera is forced inside them, with a
band of 1.3 m → 0.9 m from `game/data/camera/rig.json`. The value is computed, quantised
(`sim/state.js:362`), recorded in the trace (`sim/record.js:249`) and **saved and restored**
(`save/state.js:431`).

Nothing in `game/src/render/` reads it. `grep -rn "charOpacity" game/src/render/` returns nothing.

So the fade is a fully-instrumented number with no consumer: when the camera is pushed inside the
player the character does not fade, the near plane cuts into the body, and — because the body is
`side: FrontSide` — the interior culls away and you are looking out of the inside of a head. That
is *also* fairly described as "the player character body is transparent", it is angle- and
distance-dependent, and it will not appear in a screenshot taken at a comfortable distance. It is
a strong candidate for what was actually seen. Marked as a lead rather than a proven cause: the
close-radius orbit that would settle it was still running when this was written.

**Reversible if wrong:** if someone reproduces body-wide translucency at a normal camera distance,
this verdict is overturned — run `node tools/harness/vt-seethrough.mjs --steps 24` and post the
number.

---

## 2. Defect inventory, ranked by what a player meets in the first ten minutes

Ranking is by *how early and how hard it hits*, not by how hard it is to fix.

### D1 — Walking forward from the spawn point for ten seconds buries the camera. *Systemic.*

Evidence: `key/2026-08-14-walk-f0300-camera-buried.png`, and the sequence
`play/001-walk-f0060.png` → `play/005-walk-f0300.png`.

Holding forward from the start position for 300 frames (5 s, 15.0 m at 3.2 m/s) walks under a
raised structure. The camera follows and ends up with a wooden deck filling the bottom 55 % of the
frame at point-blank range; the player character is a few dozen pixels high behind it. Continuing
(`play/016`–`play/032`) leaves the player in a dark enclosed volume for the rest of the sequence.

This is the first thing a player does and it is the first thing that goes wrong. The camera's arm
collision resolves the arm but nothing prevents a large near-field occluder owning the frame.

### D2 — Rain falls indoors, through solid roofs. *Systemic.*

Evidence: `key/2026-08-14-under-structure-rain-indoors.png` and every frame from `play/016` to
`play/032`.

Under a roofed structure the precipitation streaks continue at full density, in front of the
ceiling geometry. Ten-plus streaks per frame, uninterrupted. Precipitation has no occlusion test
against overhead geometry.

### D3 — Geometry hanging in the sky with nothing under it. *Systemic, several instances per view.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png` (two, top-left and top-right, plus a
platform mid-frame at horizon height), `key/2026-08-14-player-orbit-270-right.png` (two more, one
of them a colonnade with its columns ending in mid-air), `key/2026-08-14-walk-f0180-lilmoth-town.png`
(a full building block, top-right, with a flat underside and sky beneath it).

Visible from the spawn point without moving. Some of these may be stilt-built structures whose
supports are lost in the haze — a marsh town on stilts is right for Lilmoth — but at least the
colonnade and the top-right block in the walk frame have clear sky under a flat underside. Worth
five minutes with the haze switched off to separate the two cases; `tools/harness/vt-world.mjs`
has a `nohaze` capture mode for exactly this and did not get to run.

### D4 — The settlement reads as flat planks lying on a lawn. *Local to settlements, but that is where the player starts.*

Evidence: `key/2026-08-14-walk-f0180-lilmoth-town.png`.

Roughly forty thin rectangular quads, tan and grey and brown, lie flat on the grass across the
whole visible town. They read as scattered boards rather than as decking, streets or foundations.
Above them: a stall that is one beam on two posts with three spheres on a shelf, and distant
buildings that are pale grey blocks in the haze. There is no vertical construction between the
player and the horizon.

### D5 — One ground surface, tiling visibly to the horizon. *Systemic.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png`, `key/2026-08-14-player-orbit-270-right.png`.

The ground is a single green with a repeating stripe running to the horizon and hard quad
boundaries where the tiles meet. Over 40 m of walking the player's Y never changed from 2.68 —
the ground is exactly flat. No undergrowth, no rock, no colour break, no path wear. This is
precisely the *"walking over samey landscape for ages"* the owner named in the handover, and it is
the first thing visible on boot.

### D6 — The road is a checkerboard of untinted tiles. *Systemic.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png` — alternating grey and tan rectangles
with hard edges, no blend into the grass, no verge, and the repeat clearly legible.

### D7 — Haze is heavy enough to remove the middle distance. *Systemic; time-of-day coverage incomplete.*

Everything past ~30 m is a pale wash. Trees resolve as flat white silhouettes
(`key/2026-08-14-player-orbit-270-right.png`); buildings as grey slabs. This interacts badly with
D3 — the haze is what makes it ambiguous whether a structure is floating or on stilts. Captured at
noon only; the multi-hour sweep did not complete.

### D8 — Precipitation reads as scratches. *Systemic.*

Ten to fifteen hard white lines, 300+ px long, uniform width, no splash, no surface response,
drawn over the haze so they are the highest-contrast thing on screen. Visible in every exterior
frame in this set.

### D9 — Character construction is legible as primitives. *Systemic — the same actor builds the NPCs.*

Evidence: `key/2026-08-14-player-isolated-210deg.png` (the player isolated against sky, from a
full orbit), plus the four orbit quadrants in `key/`.

From the front the figure reads as: a barrel torso, two flat discs for shoulders, ribbed tubes for
arms, a flat rectangular plane for the skirt, two spheres for feet, and eyes that are two bright
discs. The held sword is roughly as long as the character is tall and hangs away from the hand.
The shield is an untextured dark slab. This is the already-diagnosed root cause — `W1-30`'s own
review names it: *"there is not one authored 3D model in the repository"* — and it is recorded here
as observed rather than as news.

**Not a defect, and worth saying:** the actor is *correct* in the ways that are easy to get wrong.
Equipment sets are properly gated (of the three sets built per actor, only the equipped one is
visible — chitin and xanmeer sit at 0 visible meshes while reed is worn); the saxhleel head, brow
horns, spine scales and tail are all present and animate; and the body is sealed, per §1.

### D10 — Intermittent hard boot failure. *Systemic, low frequency, total when it hits.*

Seen once in roughly twenty boots:

```
BOOT FAILED
TypeError: Cannot read properties of null (reading 'label')
    at cardinalOf (game/src/ui/compass.js:109)
    at drawCompass (game/src/ui/compass.js:207)
    at drawHUD (game/src/ui/hud.js:378)
    at UISystem.build (game/src/ui/system.js:661)
```

`cardinalOf` does `POINTS[Math.round(norm360(b)/45) % 8].label`, which can only be `undefined` if
the bearing is non-finite. `norm360` returns `NaN` for `±Infinity`, and `ui/system.js:799` guards
with `ctx.cameraYaw || 0` — which catches `NaN` (falsy) but **not** `Infinity` (truthy). So the
camera yaw reaching `±Infinity` during boot takes the whole game down to a stack trace.

A ten-viewport sweep (1920×1080 down to 360×640) did **not** reproduce it, so it is timing-related
rather than size-related. Two cheap mitigations, independent of the root cause: make `cardinalOf`
fall back rather than index blindly, and make the guard `Number.isFinite(ctx.cameraYaw) ? … : 0`.

---

## 3. What already looks good

This is not a courtesy section; these are things that measured well and that a demo can lean on.

1. **The player character is solid, sealed and readable.** 98.6 % solid across a full orbit, 99.8 %
   at close range, and it is recognisably an armoured Argonian with a tail that follows the rig.
   `key/2026-08-14-player-isolated-210deg.png` is a perfectly presentable character shot.
2. **Equipment and race variants are correctly gated.** Three armour sets and two body families are
   built per actor and exactly one of each is shown — 2,470 of 2,945 actor meshes correctly hidden
   at boot. Nothing is bleeding through, nothing is doubled. That is the hard part of a wardrobe
   system and it is done.
3. **The HUD is quiet and in the right register.** Three slim bars top-left, a gold count, a compass
   rose top-right with the eight points legible, a spell name and a light meter bottom-right. It
   stays out of the way and it does not shout. The Morrowind-style compass the owner asked for is
   present and working.
4. **Locomotion states are real and read correctly.** Walk 3.2 m/s → `RUN`; sprint 5.0 m/s →
   `SPRINT` with stamina drawing down 120 → 75 and regenerating to full when released. The state
   machine, the animation names and the stamina economy all agree with each other.
5. **The engine boots clean and fast.** 586 data files, Three r180, no console errors, no failed
   requests, and a real boot-failure screen with a stack trace instead of a black rectangle. The
   harness seam is genuinely excellent — everything in this report was measurable *because* the
   seam is honest about what it can and cannot do.
6. **The renderer's bones are right.** HDR-linear until one tone-map, a live off-switch per visual
   feature, and a semantic material registry that world builders request from. `W1-30`'s own review
   says the same; from the outside, it means the fixes below land in one place rather than fifty.

---

## 4. Is the static-inspection failure confined to graphics?

Partly answered. What was reached:

- **Locomotion and stamina — healthy.** See §3.4. Driven, not inspected.
- **Camera and collision — the weak one.** D1 is a collision/occlusion failure that no static check
  would have caught, and it is ten seconds from spawn. The camera's *own* arm logic is well
  instrumented (arm length, penetration guard, floor emergency, clip-through flag are all in the
  snapshot); what is missing is anything that notices the resulting frame is unusable.
- **Rendering vs. simulation coupling — one confirmed instance.** The `charOpacity` fade in §1.3 is
  a simulation output with no renderer consumer, and it is *saved to disk*. Everything that looks at
  the sim state — trace, snapshot, save manifest, verdicts — will report the fade as working. Only a
  picture shows that it does nothing. That is the static-inspection failure mode exactly, outside
  graphics proper, and it suggests a cheap general check: for each per-frame value the sim
  publishes, does any renderer file read it?
- **Combat, dialogue, journal, menus — not reached.** The driven session covers them
  (`tools/harness/vt-play.mjs` §6–§8: spawn, aggro, lock-on, a light-light-heavy chain, all six
  menus, and `talkTo` on a live NPC) but the run did not finish inside the session. The tool is
  committed and re-runnable: `node tools/harness/vt-play.mjs --canvas 960x540`.

**One honest correction, recorded because it is the same mistake this report exists to catch.**
An early sweep appeared to show the camera turning 1° per 12 frames — i.e. 72 seconds to turn
around — and that was nearly written up as a headline defect. It is a harness error: `look` is
**degrees per frame** and `sim/camera.js` zeroes it after consuming it, so an event emitted once
turns the camera once. Emitted every frame it gives the documented 3°/frame. The camera is fine.
The lesson is that "play the game" only helps if you also check that your hands are on the controls.

---

## 5. Tools left behind

All committed, all re-runnable, none of them one-shot.

| tool | what it does |
|---|---|
| `tools/harness/vt-seethrough.mjs` | the §1 measurement: per-angle see-through fraction over a full orbit, with red overlays |
| `tools/harness/vt-play.mjs` | a driven play session — walk, sprint, turn, roll, attack, fight, all six menus, talk — photographed as sequences |
| `tools/harness/vt-world.mjs` | the same place at several hours with the haze on and off, for D3/D7 |
| `tools/harness/visual-truth.mjs` | placed orbit + a correct shipping-path camera turn |

All four take `--canvas WxH`. That matters: in harness mode the canvas backing store stays at
1920×1080 whatever the viewport, so every `screenshot()` pays a 2 Mpx read-back. At 960×540 a
sequence costs about a quarter as much, which is the difference between a sequence and a still —
and taking stills instead of sequences is the habit this report was commissioned to break.

---

## 6. What could not be done

- **GPU rendering.** RunPod provisioning works: a Pod comes up (RTX A5000, SECURE, $0.27/hr,
  API-confirmed `RUNNING` with a public SSH port). Connecting to it does not. Raw outbound TCP is
  blocked in this container (`/dev/tcp/<ip>/<port>` times out); the agent HTTP proxy *will* `CONNECT`
  to that host and port, but `/root/.ccr/README.md` states TLS is re-terminated at the egress proxy,
  and SSH is not TLS, so the tunnelled session dies at
  `kex_exchange_identification: Connection closed by remote host`. Both Pods created were terminated
  via `node tools/runpod/cli.mjs cleanup` with deletion API-confirmed; spend was a few minutes at
  $0.27/hr. **Everything above is SwiftShader and labelled as such.**

  Two environment fixes were needed to get even that far, and they are worth keeping: `ssh`, `scp`
  and `ssh-keygen` were absent (`apt-get install openssh-client`), and Node's global `fetch` does not
  honour `HTTPS_PROXY`, so every RunPod API call returned `403 Host not in allowlist: rest.runpod.io`
  while `curl` to the same URL returned 200. `NODE_USE_ENV_PROXY=1` fixes it and makes
  `npm run gpu:doctor` all-green.

- **Multi-hour and multi-place coverage.** Only noon, only around the spawn settlement. The tool for
  the rest exists (`vt-world.mjs`, five spots × four hours, haze on and off) and did not get a run.
  So D7 in particular is under-evidenced and the interior/exterior contrast is unmeasured.

- **Combat, dialogue, journal and menu screens.** Scripted and committed, not yet photographed. See §4.

- **The close-radius transparency orbit** at 1.0 m and 0.6 m — inside the fade band — which is what
  would confirm or kill the §1.3 lead. It was still running at the end of the session.

- **Disk.** The box was at 100 % (31 MB free) when this started and captures were failing silently
  with `ENOSPC`. About 9 GB of six-day-stale scratch clones were cleared to proceed. Worth knowing
  that any capture-producing agent that ran before that point may have written nothing.
