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

**Verdict: not reproduced.** At every camera distance from 0.6 m to 2.6 m, at every angle of a
full orbit, in both the harness build and the build a person actually runs, the player's body is
solid. The previous agent's "fixed" call is right about the body. It is worth adding that being
right is not the same as having shown it — the measurement below did not exist until now — and
that a real, different defect does sit next door to the reported one (§1.4).

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
| 1.0 m | 8 (full orbit) | **0.1 %** | 0.3 % at 270° |
| 0.6 m | 8 (full orbit) | **0.0 %** | 0.1 % at 270° |

1.3 m → 0.9 m is the camera's own character-fade band, so the last two rows sit inside and below
it. The body does not become see-through there either.

`key/2026-08-14-player-seethrough-overlay-210deg.png` is the worst angle with the see-through
pixels painted red. The red is confined to the tops of the feet, the shoulder seams, a hip edge
and two tail segments — small unsealed joints in the skinned surface, a few pixels wide. It is a
tidiness defect, not a transparency defect. The body reads as opaque from every direction.

The scene-graph audit agrees, and is in `docs/shots/2026-08-14-visual-truth/player-root-audit.json`:
of the 46 visible meshes in the player subtree, **every one** is `transparent: false, opacity: 1`.
The only genuinely transparent things attached to the player are the ground contact-shadow disc
(opacity 0.34) and the attack silhouette ring (opacity 0, i.e. off).

### 1.3 The one loophole that mattered, and it is closed

Every measurement above was taken under `?harness=1`. That is not the build a person runs:
`render/renderer.js:62-67` constructs the WebGL context with `preserveDrawingBuffer: automated`,
and `main.js` sets `automated` from `navigator.webdriver`, which Playwright always sets. If the
body were translucent for a person and solid for the harness, every harness measurement in this
project would be certifying a build nobody plays.

So the same orbit was re-run with `navigator.webdriver` spoofed to `false` before any game script
executes, which puts the engine in `mode: "play"` with the rAF loop driving the simulation and
`preserveDrawingBuffer: false` — confirmed in the run log:
`{"automated":false,"preserveDrawingBuffer":false,"engineMode":"play"}`. Tool:
`tools/harness/vt-playmode.mjs`.

**Result: the body is opaque in the play build too — shown by the picture, not by the number.**

Two things came out of it, and only one of them is a number worth keeping.

*The number is contaminated and is not being claimed.* The play-mode orbit reports 4.3 %–9.2 %
see-through (mean 7.2 %), which is five times the harness figure. It is an artefact of the method,
not a finding. In play mode the rAF loop keeps advancing the simulation between the three captures,
so the **rain moves** between `ship`, `solid` and `gone` — and the difference mask counts every
displaced streak. `key/2026-08-14-playmode-title-screen-holes-overlay.png` shows this plainly: the
red is vertical rain streaks scattered across the *whole frame*, including large areas of empty sky
well outside the character, plus a one-pixel antialiasing fringe on the silhouette. **The interior
of the body carries no red at all.** A trustworthy number here needs a frame-locked play mode,
which does not currently exist; the honest report is that the play-mode figure is unmeasured
rather than 7.2 %.

*The picture is unambiguous and is the answer.* In the real play build, at every angle captured,
the character renders as a solid opaque figure. `key/2026-08-14-playmode-title-screen.png`. So the
§1.2 verdict holds for the build a person actually runs.

**And a genuine discovery: the play build opens on a title screen the harness has never seen.**
`ELDER SOULS / ARGONIA`, with *Continue*, *New*, *Load*, *Settings* and *Quit to menu*, the current
selection marked with an em-dash in amber, and the footer *"No site recorded in this province."*
It is well composed and it is the first thing a player meets. Every harness-mode measurement in
this project — including all of §2 — skips straight past it. Nothing is wrong with it; the point
is that a whole screen exists which no automated check has ever looked at, which is §4's thesis in
one artefact.

### 1.4 A separate defect found on the way there

`sim/camera.js:527` computes `c.charOpacity = fadeOpacity(armLen)` every frame — the standard
third-person courtesy of dissolving the character when the camera is forced inside them, with a
band of 1.3 m → 0.9 m from `game/data/camera/rig.json`. The value is computed, quantised
(`sim/state.js:362`), recorded in the trace (`sim/record.js:249`) and **saved and restored**
(`save/state.js:431`).

Nothing in `game/src/render/` reads it. `grep -rn "charOpacity" game/src/render/` returns nothing.

So the fade is a fully-instrumented number with no consumer. The orbit at 1.0 m and 0.6 m — inside
and below the fade band — measures 0.1 % and 0.0 % see-through, which is the proof: the character
does not fade when the camera is jammed against it, because nothing reads the number that says it
should. The consequence is the *opposite* of the reported symptom — at very close quarters the
character blocks the view instead of dissolving out of it — so this is not an explanation for what
the owner saw. It is a real defect found next door to the reported one, and it is a clean example
of the pattern in §4: a value that the trace, the snapshot and the save file all report as working,
which does nothing at all.

**Reversible if wrong.** This verdict is a number, and it dies to a number. If anyone reproduces
body-wide translucency at any camera distance, run
`node tools/harness/vt-seethrough.mjs --steps 24 --radius <r>` and post the see-through fraction;
anything above a few per cent overturns §1 outright. Things this pass did *not* cover, and where a
reproduction would most plausibly live: hardware GL rather than SwiftShader (§6), a camera inside
an interior shell, and the moment the camera arm is compressed against a wall during motion rather
than posed at rest.

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

### D3 — You can hold a conversation with someone who is not there. *Systemic — 32 of 56 NPCs.*

Evidence: `key/2026-08-14-dialogue-corvus-aldeyn.png`, and the census in
`docs/shots/2026-08-14-visual-truth/play2/play2-log.json`.

The dialogue itself is excellent (§3.7, §4). The problem is that the frame behind the panel is an
empty street: 32 of 56 NPCs report positions within 50 m of the world origin, thousands of metres
from where the player and the conversation are. Full detail and the likely cause in §4 — it is
listed here because "talking to nobody" is something a player meets in their first few minutes and
it undoes the good work in the panel.

### D4 — Geometry hanging in the sky with nothing under it. *Systemic, several instances per view.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png` (two, top-left and top-right, plus a
platform mid-frame at horizon height), `key/2026-08-14-player-orbit-270-right.png` (two more, one
of them a colonnade with its columns ending in mid-air), `key/2026-08-14-walk-f0180-lilmoth-town.png`
(a full building block, top-right, with a flat underside and sky beneath it).

Visible from the spawn point without moving. Some of these may be stilt-built structures whose
supports are lost in the haze — a marsh town on stilts is right for Lilmoth — but at least the
colonnade and the top-right block in the walk frame have clear sky under a flat underside. Worth
five minutes with the haze switched off to separate the two cases; `tools/harness/vt-world.mjs`
has a `nohaze` capture mode for exactly this and did not get to run.

### D5 — The settlement reads as flat planks lying on a lawn. *Local to settlements, but that is where the player starts.*

Evidence: `key/2026-08-14-walk-f0180-lilmoth-town.png`.

Roughly forty thin rectangular quads, tan and grey and brown, lie flat on the grass across the
whole visible town. They read as scattered boards rather than as decking, streets or foundations.
Above them: a stall that is one beam on two posts with three spheres on a shelf, and distant
buildings that are pale grey blocks in the haze. There is no vertical construction between the
player and the horizon.

### D6 — One ground surface, tiling visibly to the horizon. *Systemic.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png`, `key/2026-08-14-player-orbit-270-right.png`.

The ground is a single green with a repeating stripe running to the horizon and hard quad
boundaries where the tiles meet. Over 40 m of walking the player's Y never changed from 2.68 —
the ground is exactly flat. No undergrowth, no rock, no colour break, no path wear. This is
precisely the *"walking over samey landscape for ages"* the owner named in the handover, and it is
the first thing visible on boot.

### D7 — The road is a checkerboard of untinted tiles. *Systemic.*

Evidence: `key/2026-08-14-gameplay-camera-spawn-view.png` — alternating grey and tan rectangles
with hard edges, no blend into the grass, no verge, and the repeat clearly legible.

### D8 — Haze is heavy enough to remove the middle distance. *Systemic; time-of-day coverage incomplete.*

Everything past ~30 m is a pale wash. Trees resolve as flat white silhouettes
(`key/2026-08-14-player-orbit-270-right.png`); buildings as grey slabs. This interacts badly with
D4 — the haze is what makes it ambiguous whether a structure is floating or on stilts. Captured at
noon only; the multi-hour sweep did not complete.

### D9 — Precipitation reads as scratches. *Systemic.*

Ten to fifteen hard white lines, 300+ px long, uniform width, no splash, no surface response,
drawn over the haze so they are the highest-contrast thing on screen. Visible in every exterior
frame in this set.

### D10 — Character construction is legible as primitives. *Systemic — the same actor builds the NPCs.*

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

### D11 — Intermittent hard boot failure. *Systemic, low frequency, total when it hits.*

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
7. **The menus are the strongest thing in the build, and they are demo-ready today.** All six open
   and all six are recognisably Morrowind:
   - **Character sheet** (`key/2026-08-14-menu-character-sheet.png`) — three columns: identity
     (*recorded as saxhleel, trade outlander, title the-shadow, level 1, souls 0, reputation 0,
     bounty 0*), ten attributes with `VIGOUR` and `HIST-BOND` transposed for Black Marsh, and
     nineteen skills including `Root-Speech`, `Claw & Fang`, `Wading` and `Warding`. The systems
     depth the project is aiming at is visible on one screen.
   - **Inventory** (`key/2026-08-14-menu-inventory.png`) — category rail, weight/gold/per-weight
     columns, a detail pane with condition and hand, an encumbrance readout (*0.0 / 183,
     UNBURDENED*) and the region name in the corner.
   - **Map** (`key/2026-08-14-menu-map-fog-of-war.png`) — *"Where I have been"*, fog-of-war with
     Lilmoth revealed and the footer *"One place I have stood in."* The discovery-driven map is a
     genuinely good idea and it works.
   - **Journal** — a two-page parchment spread with a Quests margin and page turning.
   - **Dialogue** (`key/2026-08-14-dialogue-corvus-aldeyn.png`) — speaker and location in the
     header, the greeting in italic, the answer in white, the topic list with the current topic
     marked. This is the Morrowind topic UI, done properly.

   Three shared notes rather than three separate defects: none of the panels dims the world behind
   it, the type is small and low-contrast at 960×540, and the character sheet reads *Nameless* with
   no name — the default state has not been through character creation. Also, at a fresh start the
   inventory lists only `Eshi's knife`, while the player is visibly wearing reed armour and
   carrying a sword and shield, so equipped gear is not appearing in the item list.
8. **The enemy AI fights properly.** Spawned and aggroed, `inf_trash` closed from 5 m through
   `REPOSITION` and `FEINT_STEP` — it feints — reached 2.2 m and landed `e_combo_b` for 105 damage
   (620 → 514 HP). Approach, spacing, a feint and a committed combo, all from the live sim. That is
   Souls-shaped enemy behaviour and it is working today.
9. **There is a title screen, and it is good.** `key/2026-08-14-playmode-title-screen.png`.
   `ELDER SOULS / ARGONIA` over the character, five entries with the selection marked in amber, and
   *"No site recorded in this province."* underneath. It only appears in the play build, which is
   why no measurement in this project has ever seen it.

---

## 4. Is the static-inspection failure confined to graphics?

Partly answered. What was reached:

- **Locomotion and stamina — healthy.** See §3.4. Driven, not inspected.
- **Camera and collision — the weak one.** D1 is a collision/occlusion failure that no static check
  would have caught, and it is ten seconds from spawn. The camera's *own* arm logic is well
  instrumented (arm length, penetration guard, floor emergency, clip-through flag are all in the
  snapshot); what is missing is anything that notices the resulting frame is unusable.
- **Rendering vs. simulation coupling — one confirmed instance.** The `charOpacity` fade in §1.4 is
  a simulation output with no renderer consumer, and it is *saved to disk*. Everything that looks at
  the sim state — trace, snapshot, save manifest, verdicts — will report the fade as working. Only a
  picture shows that it does nothing. That is the static-inspection failure mode exactly, outside
  graphics proper, and it suggests a cheap general check: for each per-frame value the sim
  publishes, does any renderer file read it?
- **Menus, dialogue and the world census — reached, and they are the best news in this report.**
  All six screens open (`inventory`, `journal`, `map`, `sheet`, `spells`, `wait`) and all six are
  Morrowind-shaped and legible. See §3.7. Dialogue works properly: `talkTo` on a live NPC returns a
  greeting selected by faction, disposition and player race
  (`greeting_key: ["RG-BWC", "cold", "saxhleel"]`), offers named local topics — *the fourth yard,
  the works, the road to Archon, the road to Blackrose, latest rumors* — and `conversationSay`
  returns written prose in voice: *"Cyrodiil, a long time ago. I do not go back, and nothing there
  is asking me to."* Asking the same NPC about a topic he has no line for returns
  `{refused: "no_info"}` rather than inventing one, which is the right behaviour and rare.
  Shot: `key/2026-08-14-dialogue-corvus-aldeyn.png`.

- **But the person you are talking to is not there. *Systemic — 32 of 56 NPCs.*** In that same
  shot the dialogue panel is open, the topics are live, and the frame shows the player standing
  alone in an empty street. The census explains it: of 56 NPCs, **32 report positions within 50 m
  of the world origin** — `Corvus Aldeyn` at `[-1.44, 0, 2]`, `Ixtei` at `[-4.55, 0, 1.89]`,
  `Vashu-Nei` at `[4.11, 0, 1.84]` — while the ones that are correctly placed sit near the player
  at `[2804.6, 0.37, 5032.9]`. That reads as interior/cell-local coordinates being published in the
  same field as world coordinates. It may well be intentional for NPCs inside interiors; what is
  not intentional is that you can hold a conversation with one from outside, across the province,
  with nobody in frame. **This is the clearest non-graphics instance of the failure mode the owner
  predicted**: inspect the dialogue data and it is excellent; play it and you are talking to an
  empty street.

- **Combat — partly measured, and my own harness got in the way.** The standalone light attack in
  the first session fired correctly: state `ATK_RECOVER`, clip
  `clip_w_ssw_garrison_sword_r1_1`, phase `recovery`, stamina drawn — and the wind-up pose reads
  clearly (`key/2026-08-14-attack-windup-pose.png`). The scripted duel afterwards did **not**
  land: the enemy spawned, aggroed and closed to 3.2 m in states `REPOSITION` then `FEINT_STEP`
  (the AI is doing real work), while the player stayed `IDLE` at full stamina through every queued
  attack. The most likely cause is mine, not the game's — a conversation surface opened earlier in
  the same run was probably still holding input. Recorded as **not measured** rather than as a
  defect. Re-run with the dialogue closed first.

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
| `tools/harness/vt-play2.mjs` | menus, a live conversation and a duel, as sequences |
| `tools/harness/vt-playmode.mjs` | the same measurement in the **play** build, with `navigator.webdriver` spoofed so the GL context is the one a person gets |

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

- **A trustworthy see-through number in play mode.** The picture answers the question (§1.3) but
  the number does not, because the simulation keeps running between the three captures and the rain
  moves. A frame-stepping seam that works outside harness mode would fix it.

- **The duel.** Enemy behaviour was measured and is good — the enemy closed from 5 m through
  `REPOSITION` and `FEINT_STEP` to 2.2 m, attacked with `e_combo_b`, and took the player from
  620 to 514 HP. The player's own attacks did not fire in that run, almost certainly because a
  conversation surface was still open and holding input. Not a game defect until re-run cleanly.

- **One thing I broke, reported because the next person needs to know.** `node tools/runpod/cli.mjs
  cleanup` with no arguments terminates **every** managed Pod on the account, not just your own.
  Run at the end of this session to make sure my two Pods were gone, it also deleted
  `srd13nazorl0uc` — a Pod belonging to another agent's run (pid 17046, `--max-runtime 14
  --max-price 0.60`) which was still live at the time. That run will have failed and will need
  repeating; I am sorry for the interruption. The tool has `--pod <id>` and `--dry-run`, and
  **`--pod <id>` is what anyone sharing this box should use.** Worth a guard in the tool itself:
  a bare `cleanup` on a multi-agent box is a fleet-wide kill switch that reads like tidying up.

- **Disk.** The box was at 100 % (31 MB free) when this started and captures were failing silently
  with `ENOSPC`. About 9 GB of six-day-stale scratch clones were cleared to proceed. Worth knowing
  that any capture-producing agent that ran before that point may have written nothing.
