# Verdict — W1-01 province streaming pump, round 1

**Wave 1 · gate 7.0 · overall 6 / 10 · STATUS: FAIL (narrowly), with the headline claim UPHELD**
Critic run `crit-w1-01-provstream-r1-3c19`, commit `8734986`, 2026-08-07.
Artifacts: `corpus/90-verdicts/wave1/artifacts/W1-01-province-stream-r1/`.

**AR-1 fail (see §4) · AR-2 pass · AR-3 `seam_sterile: false` · CONSUMPTION demonstrated ·
round-0 gap CLOSED · a new one named: `GAP-W1-provstream-arrival-burst`.**

> The world now follows the player. **It does not follow them cheaply, and the frame it is most
> expensive on is the frame you get up after dying.** The builder measured the walk and shipped it;
> the walk is the one thing about this that was already fine.

---

<!-- WIP: §5 (release hysteresis / leak), §6 (rAF accumulator), §8 (falsification table) outstanding -->

## 0. The tree I measured on, and why it is not the working tree

`node tools/harness/boot-check.mjs` on `/home/user/elder-souls-claude` **exits 12**:

```
[harness] ERROR: harness ready() failed:
  TypeError: this._installTopicSupply is not a function
    at Engine._boot (game/src/engine.js:320)
```

`game/src/engine.js` line 321 calls `this._installTopicSupply()` and nothing in the tree defines it.
This is a concurrent agent's in-flight edit (`game/src/character/converse.js` modified,
`game/src/sim/quest/topic-supply.js` untracked, `engine.js` modified after my first `git status`) and
has nothing to do with the province. **Every number in this verdict was therefore taken on a shadow
tree pinned at `HEAD = 8734986`** — `git archive HEAD | tar -x`, with `tools/node_modules`
symlinked — which boot-checks **PASS** before and after every measurement. The province fix is
present at that commit: `_streamProvince` appears 4× in `engine.js`, `KEEP = RADIUS + 1` once in
`world/province.js`.

That is worth one more sentence than it looks. **The build on disk right now does not start**, so
any agent that runs `smoke.mjs` (which never boots the engine) and calls it a boot check will report
green against a build no player could launch.

---

## 1. The builder's claims, attacked one at a time

I wrote my own probe rather than re-running the builder's. `tools/world/critic-prov-r1.mjs` reads
`province.tiles`, `province.focus` and the four camera-following discs and **never** calls
`request()`, `pump()`, `drain()` or `__HARNESS.streamAround()` — the same self-denial the builder's
probe makes, for the same reason: the harness's own `streamAround` is why this defect survived ten
waves of capture.

| Claim | Verdict | My measurement |
|---|---|---|
| ring 25/25 and 0 unbuilt after a walked 3 km | **holds, and on a path the builder never tried** | raw stick + `stepFrames(1)`, 1,500 m, 45,019 frames, 75 checks: **0 samples with no ground**, worst near-3×3 unbuilt **0**, ring **25/25**, two regions |
| the crossing is walked, not placed | **holds** | `walkRoute` teleports **once**, to `pts[0]`, and only on (re)start (`engine.js:4586`). The artifact's speed histogram is **33,074 of 33,078 samples in the 1.99–2.01 m/s band**; `walk.done: true`, `path_m 6615.1`, `minutes 55.131`. Legitimate arrival evidence under S34(b). |
| p50/p99 0.05 / 0.32 ms | **holds** | independently, over a 303.9 m teleport-then-walk: p50 **0.085**, p99 **0.28**, mean 0.231 ms over 12,000 steps |
| max 133.8 ms, 0.32 % of steps over 16.7 ms | **holds as a floor, and is not the worst case** | my own 14,689-step walk: max **144.23 ms**, 39 over 16.7 ms (**0.27 %**), 38 over 50 ms. Same shape, same cadence — one hitch per ~10.1 m against `SKIN_REBUILD_M = 11`. |
| consumption `radiusTiles` 1/2/3 → 9/25/49, coupling 1.00 | **holds** | re-derived independently: `look()` recomputes the want-ring from `stats().residentRadiusTiles` and `tileSizeM`, and the ring closes to exactly (2R+1)² in every run |
| focus follows the posed camera eye | **holds at the eye; see §3 for what it costs** | 5 posed eyes along the crossing, all 5 went `underfoot false / ring 0–15 of 25` → `underfoot true / ring 25/25`, `province.focus` equal to the eye to 0.1 m |
| delete-the-fix returns 0 tiles built | **reproduced** (§8) | |
| "one unit of streaming work per step" | **FALSE on the path that matters** — see §2 | |
| the ~59 ms skin rebuild "is W1-01's, not mine" | **not a fair boundary** — see §4 | |

**Two small discrepancies, recorded not weaponised.** The status file says the crossing took *35*
samples; `AFTER-crossing.json`'s own `summary.samples` says **34**. And the builder's `radiusTiles`
sweep is honest, but `province.tileM` — added beside `radiusTiles` in the same commit as a
"consumption knob" — is **dead**: `request()` computes `tx0`/`tz0` from the module constant
`TILE_M`, while `stats()` reports `tileSizeM: this.tileM`. Perturbing it would desynchronise the
reported geometry from the built geometry and no probe would notice.

---

## 2. "One unit of streaming work per step" is true for the trickle and false for the burst

The guard is real:

```js
if (pv.queue[0].d <= STREAM_NEAR_D2) { s.urgent++; s.built += pv.pump(STREAM_URGENT_TILES); s.since = 0; return; }
…
if (discWork) return;
if (s.since >= STREAM_BUILD_EVERY) { s.built += pv.pump(1); s.since = 0; }
```

`if (discWork) return` guarantees that a frame which rebuilt the ground skin does not *also* build a
trickle tile. But the **urgent** branch is above it and returns before it. So on any frame where the
nearest missing ground is inside the 3×3, the engine pays, in one fixed step:

* the release of every tile outside `KEEP` of the new focus, plus
* `updateSkin` (15,625 vertices) + `updateCover` + `updateNear`, plus
* **two** `_buildTile()` calls, unbudgeted.

The builder never saw this because it only fires when the body **arrives** somewhere rather than
walking there, and every one of the builder's runs was a walk. It does not merely move cost to the
next frame; it stacks three costs onto one.

---

## 3. The gap — `GAP-W1-provstream-arrival-burst`

`world.province.streaming` · **blocking**

> **The most expensive frame in the build is the frame you stand up on after dying, and it is
> 484 ms — 3.6× the builder's headline worst case, which it never measured.**

`critic-prov-r1.mjs --mode displace`. Walk 300 m into the province so the streamer is in its steady
state (ring 25/25, near-3×3 complete), then set `combat.player.hp = 0` and let `_deathTick()` run:

| frame after death | body jump | step cost | underfoot | 3×3 unbuilt | ring unbuilt |
|---:|---:|---:|:--|---:|---:|
| 6 | **4,142.6 m** | **337.01 ms** | yes | 7 | 18 |
| 7 | **1,864.2 m** | **405.43 ms** | yes | 7 | 23 |
| 8 | 0 | **483.96 ms** | yes | 5 | 21 |
| 9 | 0 | **361.98 ms** | yes | 3 | 19 |
| 10 | 0 | **222.64 ms** | yes | 1 | 17 |
| 11 | 0 | **472.46 ms** | yes | 0 | 15 |
| 12 | 0 | 0.37 ms | yes | 0 | 15 |

Six consecutive frames totalling **≈2,283 ms**. `FixedLoop.MAX_CATCHUP` is **5**, so in mode `play`
the accumulator cannot make that up: it takes five steps and *drops the rest* into
`stats.catchupDroppedMs`. Two and a quarter seconds of wall clock become at most five simulated
frames. **The world stops for two seconds at the exact moment a Souls player is looking for their
bloodstain.**

What it is *not*: a hole. `pump()` drains a queue sorted nearest-first, so the tile under the body is
built on the arrival frame itself — `frames_standing_on_no_ground: 0`, and `underfoot` is `true` on
every one of the 900 frames I sampled. The builder's central promise survives. It is the **cost**
that is unbudgeted, and the urgent branch is where it is unbudgeted.

The same shape appears on the un-posing of a capture camera (§3b) and on any future fast-travel
arrival, hearth warp, cutscene relocation or scripted knockback. Anything that moves the body more
than three tiles in one step lands in this branch.

**Remedy.** Two lines, and neither of them changes the promise:

1. **Split the urgent budget by what the frame has already spent.** Move `if (discWork) return`
   *above* the urgent branch, or make the urgent budget `discWork ? 1 : STREAM_URGENT_TILES`. The
   tile under the body is `queue[0]` with `d === 0` and one `pump(1)` places it; the other eight
   tiles of the 3×3 are 150–450 m away and can wait a frame each. Measured cost of that change:
   the 3×3 closes at frame ~11 instead of frame 5, and the worst frame drops from three units of
   work to two.
2. **Declare the arrival.** `Engine.teleport()` and the respawn path already know the body is about
   to move a long way. Call `_boundaryBegin('province_stream')` around it, as `RI-PLT03 §B` already
   requires for a region border, so the hitch is a *declared load boundary* with a loading state
   rather than an undeclared 484 ms frame. A boundary you announce is not a hitch.

**Acceptance.** `critic-prov-r1.mjs --mode displace` reports `worst_step_ms_after_jump ≤ 120` on a
box at loadavg < 4, with `frames_standing_on_no_ground` still `0` and
`frames_until_near9_complete ≤ 16`.

### 3b. A posed capture camera demolishes the player's own world

With an override eye posed 2.4 km from the body and the **24-frame settle `shoot.mjs` actually
uses**, at the body: `underfoot false`, 3×3 **9 of 9 unbuilt**, ring **0 / 25**, `tiles_resident 10`.
`request()` releases everything outside `KEEP` of the *eye*, and the eye is not the body. Clearing
the pose recovers the ground underfoot on frame 0 and the 3×3 by frame 4, but the ring takes **454**
frames.

`sim.camera.override` is written only by `Engine.camera()` (`engine.js:3823/3837/3873`); `deathCamera()`
sets `camera.deathFrame`, not `override`. So **this is not player-reachable** and it is not the
gap. It matters because the capture daemon is a *pooled warm browser*: any settle proof or residency
read taken at the body between two posed requests sees a demolished province. Worth one guard in
`tools/capture/settle.mjs`.

---

## 4. AR-1 — a Souls-side leak, and the "it is W1-01's" boundary is not fair

**ARBITRATION §1: inside the fight, Souls wins.** The builder assigns the residual ~59 ms
skin+cover rebuild to W1-01's `updateSkin` calibration and declares it out of scope. That would be a
fair boundary if the rebuild fired at a time of `updateSkin`'s choosing. It does not — **it fires
when `_streamProvince()` decides to call `request()`, which is now every 2 m of movement, which the
builder chose.** Before this change `request()` ran on a teleport. `updateSkin` did not get more
expensive; it got *called during fights*.

`critic-prov-r1.mjs --mode fight` — a real fight in the province: four spawned hostiles
(`champion_hist_marked`, 2× `inf_trash`, `drowned_lesser`), all aggroed, 9,000 fixed steps, the body
walking the crossing road the whole time (a still fighter hides every steering defect —
`AGENT-PROTOCOL` failure mode 4), light attack every 40 frames, heavy every 173, roll every 97 —
coprime, so every phase eventually meets every streaming frame.

| | |
|---|---:|
| frames that did streaming work | **33 / 9,000** (0.37 %) |
| those 33 frames: mean / p50 / max | **138.39 / 142.16 / 448.95 ms** |
| those 33 frames over 50 ms | **25 / 33** |
| `ROLL_IFRAME` frames observed | 1,040 |
| `ROLL_IFRAME` frames over 16.7 ms | **17** |
| **worst single frame in the run, and its phase** | **448.95 ms, inside `ROLL_IFRAME`**, `did = 5` (ground skin + cover disc) |

Phases seen: `ROLL_STARTUP` 160, `ROLL_IFRAME` 1,040, `ROLL_RECOVER` 572, `ATK_STARTUP` 1,741,
`ATK_ACTIVE` 902, `ATK_RECOVER` 3,573, `WALK` 1,012 — so this is a fight, not a walk with a sword
out. Worst frame by phase: `ROLL_IFRAME` 448.95, `ROLL_RECOVER` 235.94, `ATK_RECOVER` 225.64,
`ATK_STARTUP` 189.23, `ROLL_STARTUP` 178.42, `ATK_ACTIVE` 23.91.

A 14-frame i-frame window is **233 ms**. A 449 ms frame is longer than the entire window it landed
in. With `MAX_CATCHUP = 5` the player's roll and the enemy's swing both freeze and then resume with
whatever the input pipeline sampled once. **That is a non-Souls frame inside the fight, produced by
a world-streaming decision, and ARBITRATION says the fight wins that argument.** I record it as an
**AR-1 fail** — not because a Morrowind *mechanic* leaked, but because a Morrowind-side subsystem
was given the right to stop the fight for a quarter of a second, which S26 does not let me dilute
away and §1 does not let the builder hand off.

> **This run was taken at loadavg 13.2–15.4 and the absolute milliseconds are inflated.** The
> structure is not: on the same run, the 8,967 frames that did *no* streaming work have a p50 of
> 0.125 ms, and the 33 that did have a p50 of 142.16 ms — a **1,137×** separation that no amount of
> box contention creates. A quiet re-run is in §7.

The honest boundary is: `updateSkin`'s **cost** is W1-01's, its **schedule** is now
`_streamProvince`'s, and a subsystem that owns a schedule owns the frames it lands on. The cheapest
correct fix is not to make `updateSkin` faster — it is to **not call `request()` while
`combat.player.state` is inside an attack or a roll**, deferring the refocus by the handful of
frames the action lasts. `SKIN_REBUILD_M` is 11 m and a rolling body covers ~5 m; nothing visible
moves.

---

## 5. The other ways of moving — one at a time

`critic-prov-r1.mjs --mode modality`, six modalities in one page, each driven by the engine's own
verb rather than by `walkRoute`.

| Modality | Residency | Cost |
|---|---|---|
| **raw stick + `stepFrames(1)`**, 1,500 m, 45,019 frames | **pass** — 0/75 samples with no ground, worst 3×3 unbuilt 0, ring 25/25 | fine |
| **`walkPath`**, 59,873 m | **pass** — ends ring 25/25, underfoot true | fine |
| **`travelRide`** (rootspeak, 40 m/s) | **pass** — 0/82 samples with no ground, worst 3×3 unbuilt 0, end ring 25/25 | **FAIL — see below** |
| **teleport then walk**, 303.9 m | **pass** — 25/25 on arrival and throughout | max 77.19 ms, 30/12,000 over 16.7 ms |
| **walk on past released ground**, 4,437.8 m | **pass** — 0/122 samples with no ground | max 144.23 ms, 39/14,689 over 16.7 ms |
| **still body, camera orbiting** (`override` null, as in play) | **pass** — 0 tiles built, ring stays 25/25 | free, correctly |
| **still body, posed override eye 2.4 km away** | streams the eye (25 tiles built, 25/25) and **destroys the body's ring** (§3b) | — |
| **death respawn** | ground underfoot never missing; 3×3 closes at frame 5 | **484 ms — §3** |

### The vehicle is where the fix breaks

`svc-065-rootspeak-helstrom-lilmoth`, **40 m/s**, 3,293.7 m, 4,940 fixed steps:

| | walking (builder, 60,000 steps) | riding (mine, 4,940 steps) |
|---|---:|---:|
| mean | 0.267 ms | **8.06 ms** |
| p99 | 0.32 ms | **212.67 ms** |
| p99.9 | 66.8 ms | **399.79 ms** |
| max | 133.8 ms | **674.76 ms** |
| steps over 16.7 ms | 194 (**0.32 %**) | 327 (**6.62 %**) |
| steps over 50 ms | — | 273 (**5.53 %**) |

3,293.7 m ÷ `SKIN_REBUILD_M` (11 m) = **299** predicted ground-skin rebuilds; **327** frames observed
over 16.7 ms. The hitch count *is* the skin-rebuild count. Every budget constant in
`_streamProvince` was sized against a 2.0 m/s walk — `STREAM_REFOCUS_M = 2.0` is described in its own
comment as "one `request()` per 60 frames at the 2.0 m/s walk"; on a rootspeak it is one per **3**
frames. **The whole 82-second ride is a continuous stutter, and the streamer is the cause.** The
world is drawn correctly the entire way; it is drawn at about 12 fps.

> `boardTravel` refuses every service at a cold start — *"You have not walked the stormhold-helstrom
> road. No one sells passage over ground you have not crossed."* I granted `travel.walked` for all
> legs to open the fare gate (declared under `method_deviations`). It opens a door; it does not touch
> the streamer. It also means a player only reaches this modality after walking the road once — which
> bounds the exposure but does not remove it.

---

## 6. The release hysteresis does not leak — 8 laps, 3.9 simulated hours

`critic-prov-r1.mjs --mode loop --laps 8`: a closed 1.4 km circuit walked eight times, 834,176 fixed
steps, sampled at the end of each lap.

| lap | frame | resident | meshes | built total | heap (B) | underfoot |
|---:|---:|---:|---:|---:|---:|:--|
| 1 | 71,876 | 28 | 180 | 130 | 109,000,000 | yes |
| 2 | 180,776 | 34 | 228 | 172 | 109,000,000 | yes |
| 3 | 289,676 | 34 | 230 | 208 | 109,000,000 | yes |
| 4 | 398,576 | 29 | 184 | 244 | 109,000,000 | yes |
| 5 | 507,476 | 29 | 184 | 280 | 109,000,000 | yes |
| 6 | 616,376 | 29 | 184 | 317 | 109,000,000 | yes |
| 7 | 725,276 | 29 | 183 | 353 | 109,000,000 | yes |
| 8 | 834,176 | 34 | 229 | 394 | 109,000,000 | yes |

Residency is flat at 28–34 against the theoretical ceiling of `(2·KEEP+1)² = 49`, mesh count is flat,
heap is flat (Chromium quantises `usedJSHeapSize`, so this is a coarse instrument that would still
have caught a monotone climb over 834k frames). **`KEEP` cannot leak by construction** — it is an
absolute Chebyshev distance from the *current* focus tile, not a decay — and the measurement agrees.

What it does show is **churn**: 36–42 tile builds per 1.4 km lap, i.e. the same tiles destroyed and
rebuilt every time round. At the ~69 ms the builder attributes to a tile build that is ~2.6 s of
rebuild work per lap of a circuit a player might walk daily. Not a defect; a knob (`KEEP`) that is
currently set to the smallest value that stops the edge thrash and no larger.

---

## 7. The rAF accumulator — where a 133 ms frame stops being a dropped frame and becomes lost time

Every number the builder took came from `stepFrames`, which advances the sim regardless of how long
a step costs. **Nobody plays that way.** `FixedLoop._tick` in mode `play` runs at most
`MAX_CATCHUP = 5` steps per animation frame and then *drops* the surplus into `stats.catchupDroppedMs`
(`game/src/core/loop.js`).

`critic-prov-r1.mjs --mode raf` — mode `play`, `loop.start()`, real wall clock, the stick held down,
rendering off so what is measured is the sim and the streamer rather than SwiftShader:

| 25 s of real-time walking | fix live | fix neutered |
|---|---:|---:|
| simulated frames advanced | 1,492 | 1,497 |
| frames expected from wall clock | 1,500 | 1,500 |
| **simulated frames lost** | **8** | **3** |
| catch-up clamps | **3** | 1 |
| catch-up dropped | **129 ms** | 25.9 ms |

Small in absolute terms — 25 s at 2 m/s is 50 m, four or five skin rebuilds, and it never crosses a
tile — but the mechanism is confirmed: **the streamer's hitches are converted into lost simulation
time, not into late frames.** Applied to §3's respawn, the arithmetic is not small: 2,283 ms of
arrears, `MAX_CATCHUP` 5 → at most 83 ms of world advanced and **~2.2 s dropped**.

> Taken at loadavg 14.2–17.4 (several agents running). The *difference* between the two columns was
> taken back to back at the same load and is the load-robust part.

---

## 8. Falsification — I broke it on purpose and the instrument went red

`AGENT-PROTOCOL` failure mode 2. `--break-fix` replaces `Engine._streamProvince` with an empty
function in the page, one call and nothing else, and the identical run is repeated.

| Check | fix live | fix neutered |
|---|---:|---:|
| raw stick 1,500 m — samples with no ground underfoot | **0 / 75** | **25 / 75** |
| raw stick 1,500 m — worst near-3×3 unbuilt | 0 | **9** |
| raw stick 1,500 m — ring at the end | **25 / 25** | **5 / 25** |
| raw stick 1,500 m — ground underfoot at the end | **true** | **false** |
| tiles built during the walk | 25 | **0** |
| ground-skin / cover disc lag at the end | 9.66 m | **1,083.62 m** |
| 4,437.8 m continued walk — samples with no ground | **0 / 122** | **28 / 122** |
| posed eye 2.4 km out — tiles built | 25 | **0** |
| posed eye 2.4 km out — ring | **25 / 25** | **0 / 25** |
| teleport-then-walk — steps over 16.7 ms | 30 | **6** |

Every residency check inverts, and the cost checks invert the other way — which is the shape a real
fix has, and the shape a probe that cannot fail does not.

---

## 9. CONSUMPTION (`ARBITRATION` §3 / `RI-MTH07`)

The model this piece ships is **the streaming budget** — `radiusTiles`, `skinRadiusM`,
`STREAM_REFOCUS_M`, `STREAM_BUILD_EVERY`, `STREAM_NEAR_D2`, `STREAM_URGENT_TILES` — and the
world-side consumer is `Engine._afterStep() → _streamProvince() → Province.request()/pump()`,
observed as **tiles that exist in `province.tiles` under a body that walked there**.

| Knob | Consumer demonstrated | How |
|---|---|---|
| `radiusTiles` | yes, coupling **1.00** | 1/2/3 → ring built 9/25/49 against predicted (2R+1)², over identical walks; re-derived here from `stats()` rather than from the constant |
| `skinRadiusM` | yes | 34 → 17 moves skin vertices 15,625 → 3,969 and leaves ring/resident/built-total byte-identical (the builder's null control, which I accept: it is a *negative* control and its value is that it changed nothing) |
| `STREAM_URGENT_TILES` / `STREAM_NEAR_D2` | yes | the settle curve: 3×3 unbuilt 7 → 5 → 1 → 0 over frames 1, 2, 4, 8 — exactly 2 tiles per frame |
| `STREAM_BUILD_EVERY` | yes | ring closes 10 → 25 over frames 24 → 512, one tile per ~30 frames |
| **`province.tileM`** | **NO — orphan** | `request()` computes `tx0`/`tz0` from the module constant `TILE_M`; `stats()` reports `tileSizeM: this.tileM`. Perturbing it desynchronises the *reported* geometry from the *built* geometry and nothing would notice. `unmeasurable ⇒ 0` for that one field. |

Not a scoring event on its own — four of five knobs couple — but it is the fifth orphan field this
project has shipped beside a working one, and it was introduced *in this change*, as a knob.

---

## 10. AR-3 — `seam_sterile: false`

This piece carries a boundary-crossing interaction in both directions and both are measured here:
the world's streaming schedule now reaches **into** the fight (§4 — the ground-skin rebuild landing
inside `ROLL_IFRAME`), and the fight's own displacement reaches **out** into the world (§3 — the
respawn's 4,142.6 m jump driving the arrival burst). That is the opposite of sterile. It is also
exactly why the seam has to be arbitrated rather than admired: the two halves are now genuinely
touching, and where they touch, Souls has to win.

---

## 11. Score

| Dimension | Score | Why |
|---|---:|---|
| The defect it was sent to fix | **10** | the province follows a walking body on every modality; falsified and re-derived independently |
| Arrival cost | **2** | 484 ms on respawn; the urgent branch is exempt from the budget it sits above |
| Steady-state cost while walking | **7** | 0.32 % of steps over one frame; real, bounded, honestly reported by the builder |
| Cost on a vehicle | **2** | 6.6 % of steps over one frame, max 674.76 ms; every constant sized for 2 m/s |
| Behaviour inside the fight | **3** | AR-1: a 448.95 ms frame inside a roll's i-frame window |
| Residency management | **9** | no leak over 834k frames; the hysteresis is correct and well argued |
| Posed-camera / capture path | **6** | focus follows the eye correctly, but at `settleFrames: 24` the ring is 10/25 |
| Measurement honesty | **9** | the builder measured and published its own residual rather than hiding it; the crossing is genuinely walked |

**Mean 6.0 → 6 / 10. FAIL against a wave-1 gate of 7.0, with an AR-1 fail on top.**

That is a harsh-looking number for a change that unambiguously works, and it should be read the way
it is meant: **the piece it was asked to fix is fixed, and the piece it created is smaller than the
one it closed but is not nothing.** A player who walks now has a world. A player who dies, or who
buys a ticket, or who rolls at the wrong moment, pays for it.

---

## 12. `path_to_ten`

1. **Move `if (discWork) return` above the urgent branch**, or make the urgent budget
   `discWork ? 1 : STREAM_URGENT_TILES`. One line. Takes the respawn's worst frame from three units
   of work to two.
2. **Gate the refocus on combat action.** `if (combat.player.state` is `ATK_*` or `ROLL_*`, skip the
   `request()` this step and let `s.since` keep counting. A roll covers ~5 m against
   `SKIN_REBUILD_M = 11`; nothing visible moves, and the i-frame window stops containing a 449 ms
   frame. This is the AR-1 remedy and it is cheaper than making `updateSkin` fast.
3. **Scale `STREAM_REFOCUS_M` and the disc rebuild distances by speed**, or budget by *metres since
   the last rebuild* rather than by frames. `travelRide` at 40 m/s currently gets the same per-frame
   budget as a walk at 2 m/s and needs 20× the throughput.
4. **Declare the arrival as a load boundary.** `_boundaryBegin('province_stream')` around a teleport
   or a respawn, per `RI-PLT03 §B`. An announced boundary is not a hitch.
5. **Raise `settleFrames` for the province viewpoints to ≥ 512, or drain on pose.** At the declared
   24 the ring is 10 of 25 with 15 still queued, and the tool believes it photographed a settled
   world.
6. **Delete `province.tileM` or make `request()` read it.** A knob that is reported and not consumed
   is the failure this project has now shipped five times.
7. Then re-run: `--mode displace` `worst_step_ms_after_jump ≤ 120`; `--mode ride`
   `over_16_7 ≤ 1 %`; `--mode fight` `iframe_frames_over_16_7 = 0`; `--mode loop` unchanged.

---

## 13. Tools written for this verdict (`orchestration/TOOL-LOOP.md`, declared)

| Tool | Why it had to exist |
|---|---|
| `tools/world/critic-prov-r1.mjs` | the only province-streaming probe in the tree is the builder's own, and it measures walking. Modes `modality`, `raf`, `fight`, `displace`, `loop`, `posed`, `settle`, `ride`; `--break-fix` is the falsification control. |
| `tools/world/critic-prov-shot.mjs` | nothing photographs the same spot 750 m into a **walked** approach with and without the pump. Never teleports to the spot (S34(b)). |

---

## 14. `unmeasured`

- **Quiet-box absolute milliseconds.** `--mode fight`, `--mode ride` and `--mode displace` were taken
  at loadavg 12–17 with several agents running. The *rates* (6.62 % of ride steps over 16.7 ms; 33 of
  9,000 fight frames streaming) and the *within-run separations* (streaming p50 142.16 ms vs
  non-streaming p50 0.125 ms) are load-robust; the absolute worst-case figures are an upper bound and
  are stated as such wherever they appear.
- **Whether the 449 ms i-frame frame is visible to a player as a missed input.** That needs the input
  pipeline's own latency instrument through the rAF path, which does not exist.
- **The province viewpoints' `anchor: region_*` states**, which the builder noted do not exist in
  `game/data/states`. Not this change's; unverified here.
- **`walkPath`'s own correctness.** Fed a 1,200 m slice of the crossing spline it ran to
  `maxFrames = 400000`, covered 59,873.7 m at a mean 8.98 m/s — 4.5× walking speed — and never
  arrived, `offset_m 686.43`. Residency was fine throughout, so it does not affect this verdict, but
  every `walkPath`-based reachability number in the tree is worth re-reading.
