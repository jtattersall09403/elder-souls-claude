# The standing visual defect inventory

**Owner:** W1-30V. **Never closed.** Opened 2026-08-14.

Every row names the shot that shows it. A row with no evidence is not a row — it is an opinion,
and this file does not carry opinions. A row moves to `verified-fixed` only when it has been
reproduced as fixed **from three angles or three points in a motion sequence, by someone other
than whoever fixed it** (`W1-30-EVIDENCE.md` §3).

**How to reproduce anything here:**

```
node tools/visual/build-deck.mjs                      # regenerate the shot list from world data
node tools/visual/deck.mjs --profile wide --tag mine  # the sweep these rows came from
node tools/visual/frame-stats.mjs --run reports/visual-truth/deck/mine
node tools/visual/contact-sheet.mjs --in reports/visual-truth/deck/mine/frames --out /tmp/sheet.png
```

**Evidence class of everything below: SOFTWARE (SwiftShader).** The RunPod GPU path is broken in
this container — see `NOT-YET-MEASURED` at the foot of this file. Geometry, layout, composition,
placement, scale, fog extent and colour are faithful under SwiftShader and are claimed. Anything
that depends on MSAA quality, driver filtering or true HDR resolve is **not** measured and is not
claimed by any row here.

---

## Severity vocabulary

| severity | means |
|---|---|
| `blocks-demo` | a player or a viewer meets this in the first few minutes and it reads as unfinished |
| `noticeable` | visible in normal play, does not stop a demo |
| `polish` | real, but nobody would mention it unprompted |

---

## Open

| id | what you see | evidence | owner | severity | state |
|---|---|---|---|---|---|
| **V01** | The middle distance is gone. Past roughly 30–40 m everything is a pale wash: trees are white silhouettes, buildings are grey slabs, hills are flat paper. `FogExp2(0x9aa79a, 0.0022)` in `sky.js`. | `deck/wide-r1` every `vista-*` frame; worst on the flat regions | W1-30B | blocks-demo | open |
| **V02** | Nothing casts a directional shadow at noon — not the player, not posts, not buildings. `shadowMap.enabled` and `sun.castShadow` are both true, so this is a bug, not a missing feature. `sky.js:141` sets the shadow camera's `near = 40`, which will clip the whole scene depending on where the light is placed. | 24 noon orbit frames in `docs/shots/2026-08-14-visual-truth/`, plus every `deck/wide-r1` t1300 frame | W1-30B | blocks-demo | open |
| **V03** | The ground is one flat green surface with a legible repeating tile and hard quad seams running to the horizon. Player Y did not change over 40 m of walking. No undergrowth, no rock, no colour break, no path wear. This is the *"walking over samey landscape"* the owner named. | `key/2026-08-14-gameplay-camera-spawn-view.png`; `deck/wide-r1` `eye-*` frames across regions | W1-30F | blocks-demo | open |
| **V04** | Settlements read as thin flat boards lying on a lawn — roughly forty tan and grey quads with no vertical construction between the player and the horizon. | `key/2026-08-14-walk-f0180-lilmoth-town.png`, `deck/wide-r1 approach-*` | W1-30E | blocks-demo | open |
| **V05** | Walking forward from the spawn for ten seconds buries the camera: a wooden deck fills the bottom 55% of the frame at point-blank range and the player is a few dozen pixels high behind it. The camera arm resolves itself; nothing notices the resulting frame is unusable. | `key/2026-08-14-walk-f0300-camera-buried.png`, sequence `play/001`→`play/005`; independently re-hit by the Deck at `street-lilmoth` | W1-30 (camera; not in a child's owned paths — see note) | blocks-demo | open |
| **V06** | Rain falls indoors, through solid roofs, in front of the ceiling geometry. Precipitation has no occlusion test against anything overhead. | `key/2026-08-14-under-structure-rain-indoors.png`, every frame `play/016`→`play/032` | W1-30B | noticeable | open |
| **V07** | Precipitation reads as scratches on the lens: 10–15 hard white lines, 300+ px, uniform width at every depth, no distance attenuation, no splash, no surface response. | as V06 | W1-30B | noticeable | open |
| **V08** | Geometry hanging in the sky with clear sky beneath a flat underside — including a colonnade whose columns end in mid-air. Some cases may be stilt-built structures lost in the haze; at least two are not. | `key/2026-08-14-gameplay-camera-spawn-view.png`, `key/2026-08-14-player-orbit-270-right.png` | W1-30F / W1-30E | noticeable | open |
| **V09** | Roads are a checkerboard of alternating grey and tan rectangles with hard edges, no blend into the grass, no verge, and a clearly legible repeat. | `key/2026-08-14-gameplay-camera-spawn-view.png` | W1-30F | noticeable | open |
| **V10** | Characters are legible as primitives: a barrel torso, two flat discs for shoulders, ribbed tubes for arms, a flat rectangular skirt, spheres for feet. The held sword is about as long as the character is tall and hangs away from the hand. The shield is an untextured dark slab. | `key/2026-08-14-player-isolated-210deg.png`, `deck/wide-r1 char-player` | W1-30D | blocks-demo | open |
| **V11** | **The third-person character fade is dead code.** `sim/camera.js:527` computes `charOpacity` every frame from a 1.3 m → 0.9 m band; it is quantised (`sim/state.js:362`), traced (`sim/record.js:249`) and **saved and restored** (`save/state.js:431`). `grep -rn "charOpacity" game/src/render/` returns nothing. `sim/state.js:148` even carries the comment *"the renderer consumes, never decides"*. The renderer does not consume it. Confirmed by measurement, not by reading: at a 0.6 m orbit radius — well inside the fade band, where the character should be almost invisible — see-through is **0.04%**, i.e. fully opaque. So when the camera is forced inside the player, the body does not dissolve; the near plane cuts into it and, because the body is `side: FrontSide`, you look out through the inside of the head. | `seethrough/close-r0.6-seethrough.json` (8 angles), `close-r1.0`, `close-r1.6` | W1-30D | noticeable | open |
| **V12** | An NPC renders at a wrong scale or position — a doll-sized figure in mid-air. | `key/` orbit set | W1-30D | noticeable | open |
| **V13** | Character proportions: legs roughly twice the torso, no neck, cylinder hands. | `key/2026-08-14-player-isolated-210deg.png` | W1-30D | noticeable | open |
| **V14** | Intermittent hard boot failure: `cardinalOf()` → `POINTS[NaN].label` at `ui/compass.js:109`, reached when camera yaw is non-finite. `ui/system.js:799` guards with `ctx.cameraYaw \|\| 0`, which catches `NaN` but not `Infinity`. Seen once in ~20 boots; a ten-viewport sweep did not reproduce it, so it is timing-related. | stack trace in `2026-08-14-visual-truth.md` §D10 | (owned by another agent) | noticeable | open |
| **V15** | `sim.env.region` does not track a teleport. Every frame of a 13-region sweep reported `region: western-rootlands` while the player was demonstrably elsewhere (ground height differed per region, and the frames show different places). `getTerrainAt(x,z).region` is correct; the cached `sim.env.region` is not. Anything that reads the cached value — region music, region art selection, region weather — is at risk of being selected for the wrong region after a fast traversal. | `deck/wide-r1` manifest, `region_reported` column vs `getTerrainAt` | W1-30F / W1-02 | noticeable | open |

**Note on V05's owner.** The camera is not inside any W1-30 child's owned paths. It is recorded
here rather than dropped, because it is the single most visible defect in the first ten seconds of
play and it belongs to someone. The orchestrator should assign it.

---

## Resolved, and worth stating plainly

| id | claim | verdict |
|---|---|---|
| **V00** | *"The player character body is transparent — rotate the camera and it is obvious."* | **Not reproduced as body translucency.** Measured at four radii over 36 camera angles: 0.6 m mean 0.04%, 1.0 m mean 0.09%, 1.6 m mean 0.17%, 2.6 m mean 1.4% see-through, worst single angle 2.3%. Every one of the 46 visible meshes in the player subtree is `transparent:false, opacity:1`. The residual pixels are unsealed joints a few pixels wide at the tops of the feet, the shoulder seams, a hip edge and two tail segments — a tidiness defect, not a transparency defect. **The most likely thing the owner actually saw is V11**, which is angle- and distance-dependent, does not appear in a screenshot taken at a comfortable distance, and is a genuine unfixed defect. Method: `tools/harness/vt-seethrough.mjs`, which renders each angle three times with only the player's materials swapped, so the number does not depend on anyone's eye. **Reversible:** reproduce body-wide translucency at a normal camera distance and this verdict is overturned — run `node tools/harness/vt-seethrough.mjs --steps 24` and post the number. |

An earlier reading of a world-hidden capture appeared to show sky between the shoulder plate and
the arm, and it reached the parent plan as *"the defect is geometric — the body parts are disjoint
primitives that do not join."* **That reading was void and is withdrawn.** The reference frame it
used hid the world by setting `visible = false`, and `actor.js:988` reasserts `mesh.visible` on the
body every frame, so the "player absent" reference still contained the player. The material-swap
method above replaced it. Recorded because a withdrawn finding that stays quietly in a plan is how
a wrong priority survives three rounds.

---

## What already looks good

Not a courtesy section. These measured well or photographed well, and a demo can lean on them.

1. **Interiors are the best-looking thing in the game right now.** `deck/wide-r1 interior-thorn-hall`
   is a warm, dark, panelled room with two lit torches carrying real flame, windows reading as light
   sources, and a doorway with depth. It is the only frame in the set with a tonal range worth the
   name (luma span 119 of 255 against 35 for the worst exterior). Whatever W1-30G does next, it is
   building on something that already works.
2. **The player character is solid, sealed and readable**, and recognisably an armoured Argonian with
   a tail that follows the rig. `key/2026-08-14-player-isolated-210deg.png` is a presentable
   character shot today.
3. **Equipment and race variants are correctly gated.** Three armour sets and two body families are
   built per actor and exactly one of each is shown — 2,470 of 2,945 actor meshes correctly hidden at
   boot. Nothing bleeds through, nothing is doubled. That is the hard part of a wardrobe system.
4. **Trees have trunks.** The parent plan's *"canopies floating with no trunks"* does not reproduce at
   eye level: `deck/wide-r1 eye-deep-marshes` shows a full trunk with branches and a layered canopy.
   The floating-geometry cases in V08 are a separate and narrower problem than the plan assumed.
5. **The HUD is quiet and in the right register** — three slim bars, a gold count, a legible
   Morrowind-style compass rose, and it stays out of the way.
6. **The engine boots clean and fast**: 586 data files, Three r180, no console errors, no failed
   requests, and a real boot-failure screen with a stack trace rather than a black rectangle.
7. **The renderer's bones are right** — HDR-linear until one tone-map, a live off-switch per visual
   feature, and a semantic material registry world builders request from. It means these fixes land
   in one place rather than fifty.

---

## NOT-YET-MEASURED

Stated as plainly as the findings, per `CLAUDE.md`.

- **No hardware GPU frame exists.** RunPod provisioning works and was independently re-verified
  today: two Pods, two GPU types (RTX A5000/SECURE, RTX 3090/SECURE), two clouds, both API-confirmed
  `RUNNING` with a public IP and SSH port. Every SSH attempt died at
  `Connection closed by UNKNOWN port 65535`. Raw outbound TCP is blocked in this container and the
  agent HTTP proxy re-terminates TLS, which SSH is not. Both Pods were terminated with deletion
  API-confirmed. **Consequence: no row in this file makes an antialiasing, bloom, AO or IBL claim,
  and none should be added until a hardware frame exists.** Two environment fixes are still required
  and are worth keeping: `apt-get install openssh-client`, and `NODE_USE_ENV_PROXY=1` because Node's
  global `fetch` ignores `HTTPS_PROXY` in this container.
- **Combat, spells and dialogue are photographed by a sibling agent, not by this sweep.** Its output
  lands in `docs/shots/2026-08-14-visual-truth/play2/`. Deliberately not duplicated.
- **Night and rain across all regions.** The `night` and `weather` deck profiles exist and are one
  command each; they had not run when this was written.
- **The 12 motion sequences.** Declared in `tools/visual/deck.json`, not yet captured. Until they
  are, no gate in this tree should be treated as motion-satisfied.
- **Naive human judgement.** The Deck produces the frames; nobody outside this project has scored
  them, so there is no Craft or Place number and no anchored ladder position yet.
