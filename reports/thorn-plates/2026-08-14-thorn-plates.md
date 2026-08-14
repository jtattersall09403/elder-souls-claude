# Thorn — the target, and the gap to it (W1-THORN-PLATES, chunk 1)

**2026-08-14.** Chunk 1 of two. This chunk establishes *what Thorn should look like*, evidenced by
plates that exist on disk, and measures the distance from there to what the game renders today.
**It builds nothing.** Chunk 2 builds against the target named in §6.

Why this town: `reports/spawn-truth/2026-08-14-spawn-truth.md` settled that clicking **New** at the
title screen puts the player in **Thorn** — barge hold, then the Writ House at Tidewrack, both tagged
`"settlement": "thorn"`. And `docs/art-direction/ART.md` §3 records Thorn as the settlement with
**n=0 composition-valid plates**, the worst coverage of the eight. The town every player's first
minutes happen in is the one town with no picture to build against.

---

## 0. What I could not do — first, not last

1. **No hardware frames.** Every frame in this pass is **software-rendered (SwiftShader)** through
   the shared capture daemon. They are valid for *consistency* claims (is this the same silhouette
   from eight yaws? does the roofline read?) and **must not be cited for appearance** — material
   response, specular, shadow softness, tonemapping. Any "material response" row below is therefore
   **not measured**, and is named as such rather than estimated.
   A GPU pod was attempted and is described in finding (2).
2. **`node tools/visual/gpu-deck.mjs --help` does not print help — it rents a Pod and starts
   running.** It printed a plan, then provisioned Pod `97gp1tfdgmyy43`, waited on `/healthz`, and my
   120 s command timeout SIGTERM'd it mid-provision. Its own cleanup path ran correctly and the
   deletion was confirmed twice by API lookup (`Deletion confirmed: subsequent API lookup for Pod
   97gp1tfdgmyy43 returned not found`), so **no Pod was orphaned and no sibling's Pod was touched**
   — I never ran a bare `cleanup`. Cost roughly $0.02. This is worth someone's five minutes: a
   `--help` flag that spends money is a trap, and it is the second time this piece's tooling has
   surprised on a flag.
3. **`tools/visual/deck-motion.mjs` could not launch**, dying in `launchGame()` with `page.evaluate:
   Target page, context or browser has been closed`. Contention was green at the time
   (3 instances, ceiling 6). So the **motion sequences** the owner's directive §2 asks for are
   **partly absent**: I have the played opening sequence (part A, which does drive real input) and
   many-angle stills, but no orbiting motion clip of the town. Recorded as a gap, not glossed.
4. **The deployed build is still unreachable from a browser in this container**
   (`net::ERR_CONNECTION_RESET` on `jtattersall09403.github.io`), exactly as
   `reports/spawn-truth/2026-08-14-spawn-truth.md` §5 reported. The capture fell back to the local
   build and says so in its own log. So these frames describe **this working tree**, not the page
   the owner plays.
5. **I did not re-derive the art-direction board.** `docs/art-direction/board.json` and `ART.md` are
   generated and owned elsewhere (`W1-30K`); §6 states the one-line edit that would fill Thorn's two
   unset rows and leaves it for that owner or for chunk 2, rather than editing a generated file
   under another piece.

---

## 1. What the fiction commits us to

From the game's own data, not from memory.

`game/data/world/settlements/thorn.json`:

- **tier** `village`, **region** `thornmarsh`, radius **52 m**, 18 buildings, 7 named interiors.
- **identity** — *"A kingdom that shrank. Thorn's king is an old Argonian holding court in a rotted
  hall with eleven subjects and a genuine, legally valid Imperial charter. Industry: thornwood cut
  for Dunmer bows and Imperial spears."*
- **power reading** — *"The hall is central and everything else leans against it. Built for a court
  that no longer exists."*
- **architecture_kit.material_rule** — *"Thatch of black thorn over a rotted Argonian great-hall;
  the whole village is a thicket you walk into and cannot see out of. **Every structure is a lean-to
  and none is free-standing.**"*
- **architecture_kit.silhouette** — *"the thorn thatch — black needle-wood laid in courses, **which
  no other settlement uses**"*
- **quarters** — `rotted-hall`, `the-boards`, `sapwell`, **plus `tidewrack-quay`**, which is not in
  the `quarters` array but is the quarter both opening buildings declare.

So the brief is unusually specific and unusually buildable: a **thicket you cannot see out of**, a
**tidewater quay** you arrive at by barge, **lean-tos leaning on one rotted hall**, and a **black
needle-thatch roof nothing else in the game has**.

### 1a. Thorn's architecture is described three different ways, and only one of them renders

| source | what it says Thorn is built like |
|---|---|
| `thorn.json` `architecture_kit` | black thorn thatch over a rotted great hall; every structure a lean-to |
| `thorn.json` `architecture_grammar.primary` **and all 18 `buildings[].grammar`** | `salt-block` |
| `game/src/render/world-art.js:30` | `grammar:'spiral-palisade'` |

`game/data/world/architecture.json` defines nine grammars. **`salt-block` is the grammar of the
`stone-wastes`** — *"salt crust and bone, flat weighted roofline, shuttered slot"*. Thorn is in
`thornmarsh`, which is one of **four regions with no grammar of its own** (thornmarsh,
crimson-coast, valus-ridge, hive). **`spiral-palisade` is not one of the nine grammars at all.**

The renderer resolves none of these three: `game/src/render/lib/kits.js` keys `GRAMMARS` by
**settlement id**, so Thorn draws with a `thorn` grammar entry whose roof set is
`["roof.reed","roof.hip"]` — reed and hip, the same two Lilmoth and Helstrom use. **The one thing
the town's own document says is unique to it — black needle-wood thatch — does not exist as a roof
profile anywhere in the renderer.**

This is not a scandal; it is an unbuilt thing, and it is the single most useful thing chunk 2 can
build, because it is the town's declared signature and it is one kit part.

---

## 2. The plates. They were already on disk

**RI-VIS09's composition-valid rule, unchanged and not loosened:** a plate is composition-valid iff
`framing == "full frame, native aspect, uncropped"` **and** manifest `sky_visible == true`
(`docs/art-direction/ART.md` §5; the rule exists because RI-VIS09 §3.3 records that the square crop
destroyed original framing on ~92% of the preview set).

**Thorn's n=0 is not an acquisition failure. It is an anchor-choice failure**, and the plates that
fix it have been on disk the whole time.

`docs/art-direction/board.json` anchors Thorn on **REF-A3** — *"Telvanni architecture — grown
mushroom towers"* — with the judgement *"world-art.js grammar 'spiral-palisade' against the slot's
grown, spiralling tower architecture."* Two problems compound:

1. **All five REF-A3 plates are square crops.** Composition-valid count: **0 of 5.** Any settlement
   anchored there gets `unset` rows automatically, whatever the town looks like.
2. **The anchor reads the one source of the three in §1a that describes something that does not
   exist.** `spiral-palisade` is not a grammar in `architecture.json`, and the town's own kit
   document describes lean-tos under thatch on a tidewater quay — the opposite of a grown spiralling
   tower.

### 2a. The plates that do qualify, already committed

| slot | what it depicts | composition-valid n |
|---|---|---|
| **REF-A19** | *"Waterside settlement at Hla Oad: a moored longboat with a green-and-white striped sail beside stilted shacks"* | **6** |
| **REF-A11** | *"Bitter Coast swamp — boardwalks, standing water, mist"* (Seyda Neen) | **3** |
| REF-A8 | *"Town street and settlement density"* (Pelagiad) | 2 |
| REF-A1 | Ascadian Isles / Bitter Coast exterior vista | 4 |
| REF-A18 | Sunset exterior over water, specular track | 4 |
| REF-A3 (current anchor) | Telvanni grown mushroom towers | **0** |

The qualifying files are the `mw-fullframe-*` acquisitions, e.g.
`corpus/70-visual/refs/morrowind/REF-A19/REF-A19__mw-fullframe-406086561.jpg` — six of them, all
`framing = "full frame, native aspect, uncropped"`, all `sky_visible = true`.

**REF-A19 alone clears the board's own ≥3 threshold at n=6.** Re-anchoring Thorn from REF-A3 to
REF-A19 fills both of Thorn's `unset` rows without acquiring a single new byte.

`refs/morrowind/REF-A21-regions/bitter_coast__*.jpg` (3 plates) and
`REF-A23-ground/bitter_coast__mw-56965694.jpg` are also composition-valid and are the closest
*landscape* match — the Bitter Coast is Morrowind's own tidewater swamp. They ground the ground and
the water, not the built form.

### 2b. Where n=0 is honest and stays n=0

**No plate in the set shows black needle-thatch, and none ever will** — it is our invention, not
Morrowind's. The thatch target cannot be evidenced by a plate and **must not be** (that would be
folder laundering by another name). It is evidenced by the town's own document (§1) and judged by a
person looking at the town. Likewise **material response** — texel density, specular, AA — is
`pixel_metrics_valid: false` on every Morrowind plate (RI-VIS09 §3.3), so that axis has **no
reference target at all** and is recorded `n=0` rather than filled with a number.

### 2c. The measured target bands (the instrument that produced ART.md's own numbers)

Computed by re-running `docs/art-direction/measure-plates.mjs`'s output
(`docs/art-direction/plate-metrics.json`) over the composition-valid plates only.

| statistic | **REF-A19** (n=6) p10 … p50 … p90 | REF-A19+A11+A8 pool (n=11) |
|---|---|---|
| median L\* | 10.23 … 12.23 … 20.56 | 11.43 … 18.74 … 48.57 |
| p95 C\* | 5.99 … 7.52 … 11.95 | 6.00 … 8.03 … 16.05 |
| **roofline relief σ** (fraction of frame height) | **0.231 … 0.297 … 0.326** | 0.151 … 0.235 … 0.318 |
| **sky fraction** | **0.321 … 0.661 … 0.799** | 0.236 … 0.589 … 0.827 |
| value split top/bottom | 1.94 … 3.06 … 20.2 | 1.39 … 3.39 … 30.4 |
| shadow/lit ratio | 1.62 … 1.91 … 2.07 | 1.34 … 1.89 … 2.08 |
| aerial perspective ratio | 0.47 … 0.85 … 0.96 | 0.50 … 0.93 … 1.64 |

The two rows in bold are exactly the two `ART.md` §4 lists as **unset for Thorn**. They are
fillable today.

**Ruling W2 binds and is not being dodged.** None of these numbers says Thorn is good. They say
Thorn is *in the family*. The quality verdict is a person looking at the place from a player's eye
height and saying whether it is good, and chunk 2 owes that.

---

## 3. What Thorn looks like now

### 3a. The real opening path, played

`tools/harness/spawn-truth-thorn.mjs` drives the actual input pipeline — `titleActivate('new')`,
then `censusEnter`/`censusAnswer` through every character-creation question — and screenshots each
stage. Not `?state=default`, which is Lilmoth and is what every previous "first ten minutes"
measurement in this project booted into.

### 3b. Silhouette and roofline, measured offline against Ruling E1

**Ruling E1: "≥5 roof profiles" counts silhouettes, not parts.** Measured with the renderer's own
`planSettlement` → `assignVariantSalts` → `previewSilhouette`, i.e. the code that decides what the
skyline is:

| settlement | buildings | **distinct roof profiles** | distinct silhouettes | roof mix |
|---|---|---|---|---|
| **thorn** | 18 | **2** | 17 | reed ×13, hip ×5 |
| lilmoth | 33 | **3** | 30 | reed ×14, shell ×10, hip ×9 |
| archon | 22 | 2 | 21 | hip ×13, shell ×9 |
| helstrom | 40 | 2 | 30 | shell ×30, reed ×10 |
| soulrest | 15 | 2 | 14 | shell ×10, hip ×5 |
| blackrose | 22 | **1** | 17 | hip ×22 |
| gideon | 22 | **1** | 15 | hip ×22 |
| stormhold | 33 | **1** | 16 | hip ×33 |

**Thorn ships 2 roof profiles against E1's ≥5. No settlement in the game reaches 5**; the best,
Lilmoth, has 3. This is a whole-game finding that happens to bite hardest in the starting town, and
it is arithmetically capped: `GRAMMARS` defines only **three roof ids in total** — `roof.reed`,
`roof.hip`, `roof.shell` — so **≥5 is currently unreachable by construction**, not merely unmet.
Chunk 2 cannot satisfy E1 without adding roof profiles to the kit.

**The instrument was checked against the failure it is most likely to have.** A first run passed a
constant seed to `previewSilhouette` and reported **1 roof profile for all eight settlements** —
`roofChoice` returns `gram.roofs[0]` for a fixed seed, so the number was an artefact of my seeding,
not a fact about the game. Feeding the real per-building salts (`assignVariantSalts`, the same call
the renderer makes) moves six of the eight towns and leaves three at 1. The constant-seed arm is
therefore a working negative control: it collapses every town to one profile, and the live arm does
not. The roofline **heights** are unaffected by seeding and are the same in both arms.

Thorn's roofline heights, 18 buildings: 3.4 ×5, 4.2 ×3, 4.4, 4.8, 5.0 ×2, 5.2, 6.0, 6.2, 6.8, 8.4,
9.0 m — a genuine spread, and the one axis of verticality the town already has.

### 3c. The kit Thorn already owns, and the kit next door

`game/src/render/exterior.js`'s `EXT_KIT` holds **37 bespoke exterior parts**. Every settlement
declares 8–10 mesh ids in `architecture_kit.meshes`; by design the first four are **interior prop
meshes reused outdoors** (the file's own comment: a second, divergent set of kits is how a building
stops matching what is behind its door), and the rest are exterior-only parts.

| town | interior-prop meshes reused outdoors | bespoke `EXT_KIT` parts |
|---|---|---|
| **thorn** | `tho_rotted_hall`, `tho_thorn_thatch`, `tho_lean_to`, `tho_stilt_house` | `tho_needle_stack`, `tho_charter_post`, `tho_bow_rack`, `tho_sapwell_kerb` — **4, and not one of them is a building** |
| **lilmoth** | `lil_sunk_facade`, `lil_drowned_window`, `lil_stilt_platform`, `lil_reed_shack` | `lil_salvage_stair`, `lil_wet_arcade`, `lil_tide_mark`, `lil_pile_cluster`, `lil_customs_hall`, `lil_boom_chain` — **6, including a whole building and a full quay vocabulary** |
| soulrest | 4 | `sou_grey_hist`, `sou_silt_quay`, `sou_salt_pan`, `sou_drowned_court_step` |

Thorn's four bespoke exterior parts are a woodpile, a signpost, a bow rack and a well kerb —
**props**. Its buildings are drawn from the generic grammar massing (`mesh_id` `hall-0`, `tavern-1`,
`shop-2`, …), and the two buildings the player meets first reuse other meshes outright:
`barge-hold` → `tavern-1-barge-hold`, `writ-house` → `shop-2-writ-house`.

**That is the reuse opportunity the owner's directive §3 asks for, and it is sitting one town over.**
Lilmoth already owns `lil_pile_cluster` (seven driven piles under a deck), `lil_tide_mark` (a stained
wall with tide courses), `lil_boom_chain` (a chain across the water between two bollards),
`lil_stilt_platform` and `lil_customs_hall`; Soulrest owns `sou_silt_quay` (a stone quay with piles,
bollards and a moored hull). **Thorn's Tidewrack quay — the first exterior in the game — currently
has none of them**, and every one is a tweak-and-place rather than a rebuild.

---

## 4. The gap, on axes that can be built against

Ruling W2 binds: *a chart is not the thing; telling apart is not liking.* Every row below is a
buildable difference, not a score. **A statistic may fail this town and can never pass it.**

| axis | target, and where it comes from | Thorn today | the gap, stated as work |
|---|---|---|---|
| **roof profiles** (Ruling E1 — silhouettes, not parts) | ≥ 5 | **2** (`roof.reed` ×13, `roof.hip` ×5) | The whole renderer defines **three** roof ids (`roof.reed`, `roof.hip`, `roof.shell`), so ≥5 is **unreachable by construction** for every town. Thorn's own document names the profile that is missing and that nothing else would share: **black needle-wood thatch laid in courses.** |
| **tideline treatment** | REF-A19: stilted shacks standing in water, piles, a moored hull, a wet line on everything | **none.** `tideline` is a real grammar property in `lib/kits.js` and **only `lilmoth` sets it** (`tideline: 1.45`, `drownedRole: 'stone'`) | The first exterior in the game is a **quay**, and it has no tideline. The code path exists, is proven on Lilmoth, and is a two-field grammar change plus materials. `exterior.js:1608`'s comment — *"it is deliberately the starting town's"* — was written when Lilmoth was believed to be the starting town. |
| **quay vocabulary** | REF-A19 (moored longboat, stilts), REF-A11 (boardwalks, standing water) | `tidewrack-quay` holds **2 buildings and no props at all**; both buildings reuse other meshes (`tavern-1-barge-hold`, `shop-2-writ-house`) | Six ready parts exist next door: `lil_pile_cluster`, `lil_stilt_platform`, `lil_tide_mark`, `lil_boom_chain`, `lil_customs_hall`, `sou_silt_quay`. Directive §3 reuse, not a rebuild. |
| **silhouette variety** | REF-A19's built form: shacks of visibly different heights and lean | 17 distinct silhouettes over 18 buildings, but from 2 roofs and 2 storey counts | The variety is in footprint and height, not in **profile**. From a distance the skyline is one shape repeated. |
| **verticality** | REF-A19 plates run sky fraction 0.32–0.80 with relief σ 0.23–0.33 | the quay sits at **y ≈ 0** and the town at **y = 13.31 m**, about 50 m apart — a ~15% grade the player climbs on their first walk; roofline heights span **3.4 – 9.0 m** | The verticality is **already in the data and nothing makes it read**. Free win: frame the approach so the town stands above the quay. |
| **the thicket** | the town's own document: *"a thicket you walk into and cannot see out of"* | `thornmarsh` terrain is `thorn-islands` with `depth: 'hook-arch-thickets'` (`world-art.js:17`); no settlement-scale enclosure | Nothing currently closes the sky over the streets. This is the town's single strongest identity line and it is unbuilt. |
| **material response** | **n = 0, and honestly so** | not measurable here | `pixel_metrics_valid: false` on all 89 Morrowind plates (RI-VIS09 §3.3), so **no plate may ever be a material-response target**, and my frames are software-rendered. This axis has **no reference and no measurement** and is recorded unset rather than guessed. |
| **the read from eye height** | REF-A19 is eye-height waterside framing | frames captured, §3a/§5 | Ruling W2: this is the row a person answers, and chunk 2 owes it. |

---

## 5. Evidence index

| what | where |
|---|---|
| The plates that are the target | `corpus/70-visual/refs/morrowind/REF-A19/REF-A19__mw-fullframe-*.jpg` (6), `REF-A11/REF-A11__mw-fullframe-*.jpg` (3) |
| Supporting landscape plates | `corpus/70-visual/refs/morrowind/REF-A21-regions/bitter_coast__*.jpg` (3), `REF-A23-ground/bitter_coast__mw-56965694.jpg` |
| The composition-valid rule | `docs/art-direction/ART.md` §5; RI-VIS09 §3.3 |
| Silhouette / roof-profile census, all eight towns | `reports/thorn-plates/thorn-baseline.json` |
| Our Thorn frames, statistics | `reports/thorn-plates/thorn-frames-baseline.json` |
| Our Thorn frames, PNGs | `reports/thorn-plates/frames/` (untracked by `reports/.gitignore`), selection copied to `docs/shots/2026-08-14-thorn-plates/` |
| The played opening | `reports/thorn-plates/frames/opening/` and `reports/thorn-plates/capture.log` |

---

## 6. What chunk 2 builds

Ordered by size of gap. Every item names what to **reuse** rather than rebuild, per directive §3.

### 6.1 The target plates — use these, and no others, as the art-direction reference

- **Primary:** `corpus/70-visual/refs/morrowind/REF-A19/REF-A19__mw-fullframe-{218645104,406086561,406086586,406086610,406086656,406086696}.jpg` — n=6, all composition-valid. *Waterside settlement at Hla Oad: a moored longboat with a green-and-white striped sail beside stilted shacks.*
- **Secondary:** `corpus/70-visual/refs/morrowind/REF-A11/REF-A11__mw-fullframe-{2853909059,440609688,451884823}.jpg` — n=3, boardwalks, standing water, mist.
- **Ground and water only:** `REF-A21-regions/bitter_coast__mw-{114528470,21736767,659245370}.jpg`, `REF-A23-ground/bitter_coast__mw-56965694.jpg`.
- **Do not** cite REF-A3 (Telvanni towers, 0 composition-valid), anything under `refs/modern/`, or any Morrowind plate for texture, sharpness or anti-aliasing (`pixel_metrics_valid: false` on all of them).

Measured bands from those plates are in §2c. **They are a floor for "in the family", never a pass.**

### 6.2 The largest gap: the first exterior in the game is a quay with no quay on it

`tidewrack-quay` contains exactly two buildings — `barge-hold` and `writ-house` — and nothing else.
The player walks out of the writ house onto it. Build, in this order:

1. **Give `thorn`'s grammar a tideline.** `game/src/render/lib/kits.js` `GRAMMARS.thorn` currently has
   no `tideline` and no `drownedRole`; `lilmoth` has `tideline: 1.45, drownedRole: 'stone'` and the
   whole drowned-storey path in `exterior.js:1613` already works against it. Thorn's is a *rotted
   timber* tideline rather than a drowned colonial one — `drownedRole: 'timber'` or a thorn-specific
   wet role — but the code path is reuse, not new code.
2. **Place the quay props that already exist**, tweaked rather than rebuilt:
   `lil_pile_cluster` (driven piles under a deck), `lil_stilt_platform`, `lil_tide_mark` (a stained
   wall with tide courses), `lil_boom_chain`, `sou_silt_quay` (stone quay with piles, bollards and a
   moored hull). REF-A19's moored longboat is the one thing none of them supplies and is worth one
   new part.
3. **Change `thorn`'s `support` from `'post'` to `'pier'`** for the two quay buildings at least —
   the `pier` support in `exterior.js` draws splayed piles and is what a building standing in water
   needs. Lilmoth already uses it.

### 6.3 The town's declared signature does not exist: black needle-thatch

`thorn.json` `architecture_kit.silhouette` promises *"black needle-wood laid in courses, which no
other settlement uses"*. The renderer offers three roof ids in total — `roof.reed`, `roof.hip`,
`roof.shell` — and Thorn draws reed and hip like everyone else.

**Add `roof.needle` to the kit and give Thorn `roofs: ['roof.needle','roof.reed','roof.hip']`.** That
is one new roof profile, it is the town's own written identity, it moves Thorn from 2 profiles to 3,
and it is the first new roof the game has had — every other town can then draw on it too, which is
what directive §3 means by publishing something for reuse.

**Ruling E1's ≥5 is not reachable in chunk 2 and should not be pretended.** It needs roof profiles
the kit does not have; Thorn going 2 → 3 is the honest step and the report should say so.

### 6.4 Make the verticality read

The quay is at `y ≈ 0` and the town centre at `y = 13.31 m`, about 50 m apart. That climb is already
in the data and nothing composes around it. The cheapest win in this whole list: place the town so it
stands *above* the quay in the frame a player sees on the walk in from `[3812, 885]` toward
`[3819, 867]`.

### 6.5 The thicket

*"The whole village is a thicket you walk into and cannot see out of."* `thornmarsh`'s terrain entry
already declares `depth: 'hook-arch-thickets'` (`world-art.js:17`). Nothing closes the sky over
Thorn's streets. This is the identity line with the largest payoff and the least existing scaffolding
— treat it as the stretch item, after 6.2 and 6.3.

### 6.6 Fix the board's anchor (one line, someone else's file)

`docs/art-direction/board.json` should anchor `thorn` on **REF-A19**, not REF-A3, with the judgement
*"Thorn's `tidewrack-quay` is a tidewater quay of stilted lean-tos; REF-A19 is Morrowind's own
waterside settlement, and it has 6 composition-valid plates where REF-A3 has 0."* Both
`ART-SET-ROOFLINE-RELIEF-thorn` and `ART-SET-SKY-FRACTION-thorn` then ship **set** instead of unset,
at the bands in §2c. `board.json` is generated by `build-board.mjs` and owned by `W1-30K`, so this is
a change to that generator's slot routing, not a hand edit — **reversible**, and the evidence that
would overturn it is a slot whose built form matches Thorn better *and* has ≥3 composition-valid
plates.

**`stormhold` is in exactly the same position (n=0)** and is not this piece's job; whoever fixes
Thorn's anchor should look at it in the same pass.

### 6.7 What evidence chunk 2 must produce

1. **Many frames, many angles, several times of day, from the real opening path** — not
   `?state=default`. The sweep in `reports/thorn-plates/frames/` is the before; reproduce it exactly
   as the after. One still from one angle is not evidence (directive §2).
2. **Motion.** `tools/visual/deck-motion.mjs` failed to launch here; whatever route works, chunk 2
   owes at least one sequence walking the quay-to-town approach, because a still cannot show whether
   the thicket closes over you.
3. **A person looks at it and says whether it is good** (Ruling W2). The statistics in §2c can fail
   the result; they cannot pass it.
4. **A delete-the-fix on the tideline and the needle roof**: remove each on a control clone
   (`node tools/control-clone.mjs make --label thorn-r2 --writable game/src/render/lib/kits.js`) and
   confirm the frames go back. Check the control actually goes red — RULES rule 6's second failure.
5. **CONSUMPTION**: name the world-side consumer of every new kit part and show a frame changing when
   it is perturbed. A roof profile nothing draws is worth nothing.
6. **State what was published for reuse** (directive §3): `roof.needle` and a Thorn tideline are both
   things the other seven towns can then use.
