# The standing visual defect inventory

**Owner:** W1-30V. **Never closed.** Opened 2026-08-14.

Every row names the shot that shows it. A row with no evidence is not a row — it is an opinion,
and this file does not carry opinions. A row moves to `verified-fixed` only when it has been
reproduced as fixed **from three angles or three points in a motion sequence, by someone other
than whoever fixed it** (`W1-30-EVIDENCE.md` §3).

**How to reproduce anything here:**

```
node tools/visual/build-deck.mjs                       # regenerate the shot list from world data
node tools/visual/deck.mjs --profile wide --tag mine   # the sweep these rows came from
node tools/visual/frame-stats.mjs --run reports/visual-truth/deck/mine
node tools/visual/contact-sheet.mjs --in reports/visual-truth/deck/mine/frames --out /tmp/sheet.png --cols 8 --scale 0.3
```

**Evidence class of everything below: SOFTWARE (SwiftShader).** The RunPod GPU path is broken in
this container — see NOT-YET-MEASURED at the foot. Geometry, layout, composition, placement, scale,
fog extent and colour are faithful under SwiftShader and are claimed. Anything depending on MSAA
quality, driver filtering or true HDR resolve is **not** measured and is claimed by no row here.

| severity | means |
|---|---|
| `blocks-demo` | a player or a viewer meets this in the first few minutes and it reads as unfinished |
| `noticeable` | visible in normal play, does not stop a demo |
| `polish` | real, but nobody would mention it unprompted |

---

## Open

| id | what you see | evidence | owner | severity | state |
|---|---|---|---|---|---|
| **V01** | The middle distance is gone. Past roughly 30–40 m everything is a pale wash: trees are white silhouettes, buildings grey slabs, hills flat paper. `FogExp2(0x9aa79a, 0.0022)` in `sky.js`. | `deck/wide-r1` every `vista-*` frame | W1-30B | blocks-demo | open |
| **V02** | Nothing casts a directional shadow at noon — not the player, not posts, not buildings. `shadowMap.enabled` and `sun.castShadow` are both true, so this is a bug, not a missing feature. `sky.js:141` sets the shadow camera's `near = 40`, which will clip the scene depending on where the light sits. | 24 noon orbit frames in `docs/shots/2026-08-14-visual-truth/`; every `deck/wide-r1` t1300 frame | W1-30B | blocks-demo | open |
| **V03** | The ground is one flat green surface with a legible repeating tile and hard quad seams running to the horizon. Player Y did not change over 40 m of walking. No undergrowth, no rock, no colour break, no path wear. This is the *"walking over samey landscape"* the owner named. | `key/2026-08-14-gameplay-camera-spawn-view.png`; `deck/wide-r1` `eye-*` frames across regions | W1-30F | blocks-demo | open |
| **V04** | Settlements read as thin flat boards lying on a lawn — roughly forty tan and grey quads, with no vertical construction between the player and the horizon. | `key/2026-08-14-walk-f0180-lilmoth-town.png`, `deck/wide-r1 approach-*` | W1-30E | blocks-demo | open |
| **V05** | Walking forward from the spawn for ten seconds buries the camera: a wooden deck fills the bottom 55% of the frame at point-blank range, the player a few dozen pixels high behind it. The camera arm resolves itself; nothing notices the resulting frame is unusable. | `key/2026-08-14-walk-f0300-camera-buried.png`, sequence `play/001`→`play/005`; independently re-hit by the Deck at `street-lilmoth` | unassigned — see note | blocks-demo | open |
| **V06** | Rain falls indoors, through solid roofs, in front of the ceiling geometry. Precipitation has no occlusion test against anything overhead. | `key/2026-08-14-under-structure-rain-indoors.png`, every frame `play/016`→`play/032` | W1-30B | noticeable | open |
| **V07** | Precipitation reads as scratches on the lens: 10–15 hard white lines, 300+ px, uniform width at every depth, no distance attenuation, no splash, no surface response. | as V06 | W1-30B | noticeable | open |
| **V08** | Geometry hanging in the sky with clear sky beneath a flat underside — including a colonnade whose columns end in mid-air. Some cases may be stilt-built structures lost in the haze; at least two are not. | `key/2026-08-14-gameplay-camera-spawn-view.png`, `key/2026-08-14-player-orbit-270-right.png` | W1-30E / W1-30F | noticeable | open |
| **V09** | Roads are a checkerboard of alternating grey and tan rectangles: hard edges, no blend into the grass, no verge, a clearly legible repeat. | `key/2026-08-14-gameplay-camera-spawn-view.png` | W1-30F | noticeable | open |
| **V10** | Characters are legible as primitives: barrel torso, two flat discs for shoulders, ribbed tubes for arms, a flat rectangular skirt, spheres for feet. The held sword is about as long as the character is tall and hangs away from the hand. The shield is an untextured dark slab. | `key/2026-08-14-player-isolated-210deg.png`, `deck/wide-r1 char-player` | W1-30D | blocks-demo | open |
| **V11** | **The third-person character fade is dead code.** `sim/camera.js:527` computes `charOpacity` every frame from a 1.3 m → 0.9 m band; it is quantised (`sim/state.js:362`), traced (`sim/record.js:249`) and **saved and restored** (`save/state.js:431`). `grep -rn "charOpacity" game/src/render/` returns nothing. `sim/state.js:148` even carries the comment *"the renderer consumes, never decides"* — the renderer does not consume it. Confirmed by measurement, not by reading: at a **0.6 m** orbit radius, well inside the fade band where the character should be almost invisible, see-through is **0.04%** — fully opaque. So when the camera is forced inside the player the body does not dissolve; the near plane cuts into it, and because the body is `side: FrontSide` you look out through the inside of the head. | `seethrough/close-r0.6-seethrough.json` (8 angles), `close-r1.0`, `close-r1.6` | W1-30D | noticeable | open |
| **V12** | An NPC renders at a wrong scale or position — a doll-sized figure in mid-air. | `key/` orbit set | W1-30D | noticeable | open |
| **V13** | Character proportions: legs roughly twice the torso, no neck, cylinder hands. | `key/2026-08-14-player-isolated-210deg.png` | W1-30D | noticeable | open |
| **V14** | Intermittent hard boot failure: `cardinalOf()` → `POINTS[NaN].label` at `ui/compass.js:109`, reached when camera yaw is non-finite. `ui/system.js:799` guards with `ctx.cameraYaw \|\| 0`, which catches `NaN` but not `Infinity`. Seen once in ~20 boots; a ten-viewport sweep did not reproduce it, so it is timing-related. Did **not** block this child's work. | stack trace in `2026-08-14-visual-truth.md` §D10 | owned by another agent | noticeable | open |
| **V16** | **A gaol, an inn, an apothecary and a hall are the same room.** The four named interiors in the Deck render one shared shell: identical wall panelling, identical window count and placement, identical doorway, identical torch-stand positions, and the same NPC standing in the same spot. Only about 25% of pixels differ between any two of them, and that difference is dressing and tint. 115 interior records exist in `game/data/world/interiors/`; four differently-named ones are visually one room. This is the interior half of the owner's *"exploring should never feel samey"* concern, and it is the flip side of the good news that interiors are otherwise the best-looking block in the game. | `docs/shots/2026-08-14-deck/2026-08-14-deck-interiors-and-characters.png` — bottom two rows, all four at both times | W1-30G / W1-30E | blocks-demo | open |
| **V17** | **Three regions are effectively empty**, not merely samey. Ranked by mean edge density over their vista and eye-level frames, `crimson-coast` (0.012), `marauders-coast` (0.012) and `stone-wastes` (0.018) are pale washes with almost nothing in them — 1 of 12 frames usable across the three. The other ten regions run 0.031–0.093 and seven of them score 4 of 4 usable. The problem is not uniform sameyness; it is three specific regions with nothing built in them. | `deck/wide-r1` per-region table in `W1-30V-STATUS.md`; `2026-08-14-deck-region-vistas.png` | W1-30F | blocks-demo | open |
| **V18** | **Landform does not reach the picture.** Every one of the 13 region vistas is a flat horizontal band with a dead-level horizon — including Valus Ridge, whose data says `amp_m: 286`, and Salt Hills at `amp_m: 168`. Regions differ strongly in palette and prop scatter and not at all in the shape of the land. This is the most likely mechanical cause of *"walking over samey landscape for ages"*: the eye reads silhouette before it reads colour. | `2026-08-14-deck-region-vistas.png` — all 26 tiles | W1-30F | blocks-demo | open |
| **V19** | The starting town is the weakest of the eight settlements. Lilmoth's approach reads as pale blocks behind reeds with no vertical construction, while Helstrom (domed buildings, a hist tree with a real canopy, banners, boardwalk) and Soulrest (a domed lattice on sand) have genuine silhouettes. The first settlement a player ever sees is the one that most looks unfinished. | `2026-08-14-deck-settlement-approaches.png` | W1-30E | blocks-demo | open |
| **V15** | **`sim.env.region` does not track a teleport.** Across a 13-region sweep every frame reported `region: western-rootlands` while the player was demonstrably elsewhere — ground height differed per region and the frames show different places. `getTerrainAt(x,z).region` is correct; the cached `sim.env.region` is not. Anything reading the cached value — region art selection, region ambience, region weather — risks being chosen for the wrong region after a fast traversal. Found by the Deck recording both values per frame, which is why it recorded both. | `deck/wide-r1/manifest.json`, `region_reported` vs `getTerrainAt` | W1-02 / W1-30F | noticeable | open |

**Note on V05's owner.** The camera is inside no W1-30 child's owned paths. It is recorded here
rather than dropped, because it is the most visible defect in the first ten seconds of play and it
belongs to someone. The orchestrator should assign it.

---

## Resolved, and worth stating plainly

**V00 — *"the player character body is transparent; rotate the camera and it is obvious."***

**Not reproduced as body translucency.** Measured at four radii over 36 camera angles:

| radius | angles | mean see-through | worst |
|---|---|---|---|
| 0.6 m | 8 | 0.04% | 0.14% |
| 1.0 m | 8 | 0.09% | 0.26% |
| 1.6 m | 8 | 0.17% | 0.31% |
| 2.6 m | 12 | 1.4% | 2.3% |

All 46 visible meshes in the player subtree are `transparent:false, opacity:1`. The residual pixels
are unsealed joints a few pixels wide — tops of the feet, shoulder seams, a hip edge, two tail
segments. A tidiness defect, not a transparency defect.

**The most likely thing the owner actually saw is V11**, which is angle- and distance-dependent,
does not appear in a screenshot taken at a comfortable distance, and is a genuine unfixed defect.

Method: `tools/harness/vt-seethrough.mjs` renders each angle three times with only the player's
*materials* swapped, so the number does not depend on anyone's eye. **Reversible:** reproduce
body-wide translucency at a normal camera distance and this verdict is overturned — run
`node tools/harness/vt-seethrough.mjs --steps 24` and post the number.

**A withdrawn reading, recorded so it does not come back.** An earlier world-hidden capture appeared
to show sky between the shoulder plate and the arm, and reached the parent plan as *"the defect is
geometric — the body parts are disjoint primitives that do not join."* **That reading was void.**
The reference frame hid the world with `visible = false`, and `actor.js:988` reasserts `mesh.visible`
on the body every frame, so the "player absent" reference still contained the player. The
material-swap method above replaced it. Written down because a withdrawn finding that stays quietly
in a plan is how a wrong priority survives three rounds.

---

## The first wide sweep, in numbers

`deck/wide-r1` — 48 setups × 2 times (13:00, 19:30) × clear = **96 frames, 0 red, 29 amber, 67 ok**,
2,317 s on SwiftShader. `amber` means the frame was captured but the usability screen judged it not
worth a human's time. Determinism PASS (6/6 byte-identical across independent launches); time-axis
red control PASS (48/48 pairs moved).

| block | usable | flagged | what the flags were |
|---|---|---|---|
| **interiors** | **8** | **0** | — the only block with a clean sheet |
| settlement approach | 14 | 2 | flat tone |
| region eye-level | 20 | 6 | mostly no-detail |
| character close-ups | 2 | 2 | the NPC shot buried the camera at both times |
| settlement street | 9 | 7 | camera inside geometry — see V05 |
| region vista | 14 | 12 | **the worst block in the game** — no-detail and flat-tone |

Read plainly: **you are standing in a decent interior, walking through a passable settlement
approach, and looking at a vista that is not there yet.**

## What already looks good

Not a courtesy section. These measured well or photographed well, and a demo can lean on them.

1. **Interiors are the best-looking thing in the game right now, and it is not close.** Eight of
   eight interior frames passed the usability screen — the only block in the Deck with a clean
   sheet. `interior-thorn-hall` is a warm, dark, panelled room with two lit torches carrying real
   flame, windows reading as light sources, and a doorway with depth. It has the widest tonal range
   in the set — a luma span of 119 of 255 against 35 for the worst exterior. The shell is shared
   across all four (V16) and that is a real defect, but the shell itself is good. Whatever W1-30G
   does next, it builds on something that already works.
2. **The player character is solid, sealed and readable**, and recognisably an armoured Argonian with
   a tail that follows the rig. `key/2026-08-14-player-isolated-210deg.png` is a presentable
   character shot today.
3. **Equipment and race variants are correctly gated.** Three armour sets and two body families are
   built per actor and exactly one of each shows — 2,470 of 2,945 actor meshes correctly hidden at
   boot. Nothing bleeds through, nothing is doubled. That is the hard part of a wardrobe system.
4. **Several settlements have a genuine silhouette.** Helstrom reads as a town — domed tan
   buildings, a hist tree with a full canopy, banners, a boardwalk — and Soulrest's domed lattice on
   sand looks like nowhere else in the game. Fourteen of sixteen approach frames were usable. The
   parent plan's *"settlements are flat planks on a lawn"* was true of Lilmoth and is not true of the
   set (see V19).
5. **The regions do have their own palettes.** Clay Moor is warm orange rock, the Hive is pale sand
   with yellow bloom and white stone, Stone Forest is a field of tall pale mushroom-trees, Thornmarsh
   is dense brown grass. Colour identity is real and landed; what is missing is landform (V18).
6. **The day genuinely changes the light.** Every one of 48 setups produced different pixels at 13:00
   and at 19:30 — Clay Moor at dusk is an orange sunset, Stone Forest at dusk is blue-grey with
   silhouetted crowns, Archon at dusk has a lit beacon over red ground. Whatever is true of the
   composite grade, the sky and sun are doing real work.
7. **Trees have trunks.** The parent plan's *"canopies floating with no trunks"* does not reproduce at
   eye level: `eye-deep-marshes` shows a full trunk with branches and a layered canopy. The
   floating-geometry problem (V08) is real but it is buildings, and narrower than assumed.
8. **The HUD is quiet and in the right register** — three slim bars, a gold count, a legible
   Morrowind-style compass rose, and it stays out of the way.
9. **The engine boots clean and fast**: 586 data files, Three r180, no console errors, no failed
   requests, and a real boot-failure screen with a stack trace rather than a black rectangle.
10. **The renderer's bones are right** — HDR-linear until one tone-map, a live off-switch per visual
   feature, and a semantic material registry world builders request from. It means these fixes land
   in one place rather than fifty.
11. **The capture path is deterministic.** Two independent browser launches at the same commit
   produced 6 of 6 byte-identical frames. Every before/after in this programme rests on that, and it
   is now measured rather than assumed.

---

## NOT-YET-MEASURED

Stated as plainly as the findings, per `CLAUDE.md`.

- **No hardware GPU frame exists.** RunPod provisioning works and was independently re-verified
  today: two Pods, two GPU types (RTX A5000/SECURE $0.27/hr, RTX 3090/SECURE $0.50/hr), two clouds,
  both API-confirmed `RUNNING` with a public IP and SSH port. Every SSH attempt died at
  `Connection closed by UNKNOWN port 65535`, then `Connection timed out`. Raw outbound TCP is blocked
  in this container and the agent HTTP proxy re-terminates TLS, which SSH is not. `gpu:doctor` is
  all-green, so the failure is the container's network, not the tooling or the account. Both Pods
  terminated, deletion API-confirmed. **Consequence: no row here makes an antialiasing, bloom, AO or
  IBL claim, and none should be added until a hardware frame exists.**
- **The 12 motion sequences** are declared in `tools/visual/deck.json` and not captured. Until they
  are, no gate in this tree should be treated as motion-satisfied.
- **Night and rain across all regions.** The `night` and `weather` deck profiles exist and are one
  command each; they had not run.
- **Combat, spells and dialogue** are photographed by a sibling agent into
  `docs/shots/2026-08-14-visual-truth/play2/`. Deliberately not duplicated here.
- **No naive human judgement.** The Deck makes the frames; nobody outside the project has scored
  them, so there is no Craft or Place number and no anchored ladder position yet.
- **The bar's seed red control cannot fire.** `W1-30V`'s acceptance asks for "change the seed;
  ≥ 95% of hashes must change". Measured: seeds 20260814 and 987654 produced 6 of 6 **identical**
  frames. That is not a broken harness — the province is generated from `game/data/**` and a posed
  still of a settled scene contains no RNG. The seed is the wrong knob, so that control can never go
  red on a healthy build and is useless as written. Replaced with an in-run time-of-day axis control
  (`deck-compare.mjs --run <dir> --axis time`), which a genuinely broken capture can fail. **This is
  a correction to the bar and it is reversible** — name a shot whose pixels should depend on the
  seed and it goes back.
