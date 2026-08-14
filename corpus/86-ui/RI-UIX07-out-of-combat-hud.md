---
id: RI-UIX07
title: The out-of-combat HUD — what persists when nothing is trying to kill you, and how the two sets change hands
kind: number
side: morrowind
judges: [ui.hud.world]
provenance: measured
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`, and it exists because `RI-UIX01` is `souls` and said so.**
> `RI-UIX01` declares `side: souls`, and its own header gives the reason: *"The combat HUD is
> **inside the fight** and Souls is authoritative."* Its §A table is scoped, in its own words, to
> elements *"Persistent, always present **in combat**"*. **It therefore does not govern the HUD
> outside a fight** — which is most of the game, and which the supreme law of the corpus assigns to
> Morrowind: *inside the fight Souls wins; everywhere else Morrowind wins.* This item is
> `RI-UIX01`'s counterpart on the other side of that line, and **`ARBITRATION` S54 is the row that
> settles how the two sets change hands.** Neither item may be read without the other.
>
> **Found by the project's owner, reading the corpus.** Verbatim: *"a doc says combat HUD is being
> based on souls, which is broadly right but remember the HUD persists outside of combat too, so it
> will need its Morrowind style HUD elements too."* They were right and `RI-UIX01` proves it: 306
> lines about the fight, and not one sentence about the ninety-odd minutes of an hour-wide world you
> spend not fighting.
>
> **What this item does NOT judge, so it does not overlap its neighbours (rule 10):**
> the **art** of these elements is `RI-UIX06` §A/§B under `JUDGEMENT SIDE: ART_DIRECTION`, and their
> **rendering quality** is `RI-UIX06` §D/§E/§F — cited, not restated. The **marker detectors** are
> `RI-UIX02` §C/§D/§E; this item adds one new element to their sweep and re-uses their machinery
> rather than building a second one. The **map screen** is `ARBITRATION` S35 and `RI-UIX03`; §B4
> below refuses a HUD minimap and hands the need to them. The **positive obligations that make a
> markerless world navigable** — landmark sightlines, signposted junctions, prose directions — are
> `RI-WLD06` and `RI-DLG05`, and this item creates none of them.

## The bar

**Morrowind's HUD is four small things in two corners and an empty screen between them.** That is
not an impression; it is measured below from two independent sources that agree, and it is the whole
bar in one sentence.

The failure this item exists to prevent is not that someone builds a bad out-of-combat HUD. It is
that **nobody builds one at all**, because `RI-UIX01` is the only HUD item in the corpus and it is
complete, confident and closed — so a builder reads it, satisfies it, ships a Souls HUD, and the
game then wears that Souls HUD through every conversation, every market, every mile of road and
every hour of the world's hour. The Souls HUD is *correct in a fight and silent everywhere else*: it
tells you your stamina while you are walking down a road, which you did not need, and it tells you
nothing about where you are, which is the only question the world poses.

The second failure is the opposite one and is likelier to be argued for: **that the out-of-combat
HUD becomes the place everything goes.** A HUD that is only ever measured against combat frames has
a budget in a fight and no budget outside one, and "it's not in combat, so the census doesn't see
it" is an argument that ends with a quest tracker. §C sets the out-of-combat budget so the sentence
has a number to lose to, and §C's composition rule is the point of it: **the budgets loosen at the
fight boundary; the hard fails do not.**

The third is the transition, and it is the one a builder genuinely cannot guess. Does the Souls set
appear on aggro and withdraw on disengage? Is it always present with the Morrowind set added? Does
anything fade? `ARBITRATION` **S54** rules it and §E below is that ruling in this item's own units.

## The reference artifact

### §0 — Two sources, and they agree, so the geometry here is `measured` and not recalled

This is the first Morrowind *interface* evidence the project has ever held, and it arrived twice.

**Source A — the owner's own screenshot.**
`sha256: e9a0531c5a09e41214ce96136af2c60e11c2ca45b65b6e46c2473b32f66cba6a`, 2376 × 1069, delivered
2026-08-14 at `corpus/86-ui/com.google.android.keep_20260814145039.jpg` — which is **a PNG despite
the extension** (`W1-MW-UI-REFS`'s finding, not this item's). **The sha is the durable handle and the
path is not:** `W1-MW-UI-REFS` is vendoring this file into the standard reference structure as
**`corpus/70-visual/refs/morrowind/REF-A12c/`**, alongside the `REF-A12` layout that is Source B, and
is manifesting it in `refs/MANIFEST.json`. Cite the sha; read the blob with
`git show <rev>:<path>` if the working tree does not have it (at the time of writing it is tracked in
git and absent from the working tree, which is its own small trap). It shows a dialogue window open
over the world **with the HUD still drawn in the corners**, which is precisely the evidence this
item needed and precisely the thing a screenshot of a menu usually crops away.

> **Three things in that image are NOT Morrowind and must never be counted as HUD elements.** It is
> the **OpenMW Android port**. The hamburger at top-left, the pause bars and the pack icon at
> top-right, and the large translucent ring across the bottom-right are the **mobile touch
> overlay and virtual stick**. A census taken off this image that counts them will report a
> nine-element Morrowind HUD, and the true figure is six. Our own touch controls are `RI-JRN04` §G
> and are declared as `touch_button` / `touch_stick`; they are not this item's subject.

**Source B — an exact layout, already vendored in this corpus and never cited by any UI item.**
`corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_hud.layout` is OpenMW's HUD layout: every
widget's rect, anchor and skin in a 300 × 200 design canvas. It has been on disk since the visual
acquisition and the six `RI-UIX*` items were all written without it.

**They corroborate each other and that is what makes this section `measured`.** Measured off Source
A against the rects in Source B, every ratio lands on a single UI scale of **exactly 2.0**:

| quantity | Source B (layout units) | Source A (measured px) | implied scale |
|---|---|---|---|
| resource-bar pitch | 15 | 29.5 | 1.97 |
| resource-bar width (incl. skin) | 65 | ~130 | 2.00 |
| icon box ÷ bar width | 36 / 65 = 0.554 | 70 / 126 = 0.556 | — (ratio, scale-free) |
| minimap panel height | 65 | ~125–130 | ~1.95 |
| weapon box left edge | 81 | 251 (= 81×2 + 90 px port inset) | 2.00 |

Two artefacts produced years and platforms apart returning one scale factor is a stronger provenance
than either alone, and it is why the numbers in §A are stated as fractions rather than hedged.

**Source B contains one element we must refuse and it is worth naming before anyone reuses the
file:** `EnemyHealth` (`12 132 65 12`, `Visible: false`) is OpenMW's *optional* enemy health bar. It
is not vanilla Morrowind and it is `RI-UIX01` §B **X2**. A build that imports this layout wholesale
imports a forbidden element that ships hidden and is one settings toggle from visible.

### §A — The Morrowind reference set, measured

Everything Morrowind's HUD contains, from Source B, corroborated against Source A. Rects are given
as fractions of a 1920 × 1080 frame at UI scale 2.0 — the scale the owner is actually playing at,
taken from their own screenshot rather than assumed.

| # | Morrowind element | Where | Layout rect | @1080p, scale 2.0 | Persistent? |
|---|---|---|---|---|---|
| M1 | Health bar (red) | bottom-left rail | `12 147 65 12` | 130 × 24 | yes |
| M2 | Magicka bar (blue) | bottom-left rail | `12 162 65 12` | 130 × 24 | yes |
| M3 | Fatigue bar (green) | bottom-left rail | `12 177 65 12` | 130 × 24 | yes |
| M4 | Equipped-weapon icon **+ a condition bar under it** | right of the bars | `81 147 36 41` | 72 × 82 | yes |
| M5 | Selected-spell icon **+ a cast-chance bar under it** | right of M4 | `121 147 36 41` | 72 × 82 | yes |
| M6 | Local map panel, **with the compass rose rotating inside it** | bottom-right | `223 124 65 65`, containing `Compass` 32×32 `RotatingSkin` on `textures\compass.dds` | 130 × 130 | yes |
| M7 | Sneak indicator | right of M5 | `161 147 36 36` | 72 × 72 | only while sneaking |
| M8 | Active-magic-effect strip | bottom, inboard of M6 | `EffectBox 199 169 20 20`, grows leftward | 40 tall × *n* | only while ≥1 effect |
| M9 | Cell-name announcement | above the bars, right-aligned | `0 87 285 24` | 570 × 48 | transient on cell change |
| M10 | Weapon/spell name flash | above the bars | `14 117 270 24` | 540 × 48 | transient on change |
| M11 | Breath / drowning meter | top-centre | `230 58` | 460 × 116 | only while submerged |
| M12 | Crosshair | dead centre | `27 27` | 54 × 54 | **deleted by S18** |

**Coverage, computed from the table.** Persistent = M1–M6 = 39,628 px² at scale 2.0 =
**1.911 % of 1920 × 1080**. At OpenMW's default scale 1.0 the same set is **0.478 %**. Persistent
element count is **6**.

Three facts fall straight out of that and they are the design, not the arithmetic:

1. **Morrowind's persistent HUD is smaller than `RI-UIX01` budgets for the Souls one** (≤ 4.0 %),
   and it has exactly `RI-UIX01` §C's ≤ 6 persistent elements. The two traditions independently
   arrived at the same size. Nothing in this item needs to fight `RI-UIX01`'s budget; it needs to
   say how the two compose.
2. **Morrowind's HUD carries zero numerals.** (The `100/100` in Source A is the *dialogue window's*
   disposition bar — a menu, not the HUD.) `RI-UIX01` §C caps combat numerals at 1; the world frame
   inherits that cap and the world set contributes none of it.
3. **The centre of the screen is empty.** Everything is anchored to the bottom-left or bottom-right
   corner. The only Morrowind element that ever occupies the middle is M12, the first-person
   crosshair, and **S18 deletes it outright** — the game is third-person at all times. Morrowind
   passes `RI-UIX01` §C's empty-centre rule on its own, which is worth saying because that rule is
   usually described as a Souls property.

### §B — The world set we take, and the four we refuse

`RI-UIX01`'s Souls set already carries Morrowind counterparts for four of the six persistent
elements above: **M1 = E1** (health), **M3 ≈ E2** (fatigue/stamina — S4 splits them and both are a
bar you spend), **M2 ≈ E3** (magicka/focus, S19), **M4+M5 ⊂ E5** (the quick-slot cluster is the
weapon and spell icons plus two more). **So most of Morrowind's HUD is already on screen.** What is
genuinely missing is small, and that is the whole reason S54 can be a superset rule rather than a
swap.

**The world set (the delta) is closed at six elements.**

| # | Element | Kind | Shown | Max px @1920×1080 | Source |
|---|---|---|---|---|---|
| W1 | **Bearing dial** — cardinal and intercardinal points, no ticks, no places, no quest state | `bearing_dial` | out of combat, always | **96 × 96** | M6's compass rose, taken *out* of M6's map panel |
| W2 | **Active-effect strip** — one glyph per effect currently on you, ≤ 12 concurrent | `effect_strip` | out of combat, only while ≥ 1 effect | **360 × 32** | M8 |
| W3 | **Sneak state** — are you hidden, right now | `sneak_state` | **both** phases, only while sneaking | **40 × 40** | M7 |
| W4 | **Condition / charge marks on the quick slots** — weapon condition, spell cast-chance | *(no new kind — drawn inside E5's rect)* | **both** phases, always | **0 added** | M4, M5 |
| W5 | **Place-name announcement** — the name of the cell you just entered, ≤ 3 s | `place_name` | out of combat, transient | **520 × 36** | M9 |
| W6 | **Breath meter** | `breath_meter` | **both** phases, only while submerged | **400 × 24** | M11 |

**W4 is the cheapest element in this item and the one most likely to be skipped.** Morrowind draws a
condition bar under the weapon icon and a cast-chance bar under the spell icon; both are visible in
Source A as thin red rules beneath the two icons. Ours has a quick-slot cluster with no marks under
it at all. Adding them costs **zero additional screen coverage** because they are drawn inside a
rect `RI-UIX01` §A already grants — and a weapon whose condition you cannot see is a Morrowind
economy (repair, smiths, gold) with no readout, which is a systems gap wearing a UI costume.

**The four refusals, each with its reason and each reversible:**

- **B1 — no HUD minimap (M6's map half).** `RI-UIX01` X5, S8 and AR-2 forbid it; `minimap` is in
  `game/src/ui/surface.js` `FORBIDDEN_KINDS` and stays there. **S35 already gave us the map the
  owner asked for — as a screen you open.** `RI-UIX02` §F's named permitted substitute is *"a
  carried compass **item** readable in the inventory screen … an item you must stop and look at is
  not a HUD element"*, and a map screen is that argument's larger sibling. This is the one place
  this item deliberately departs from its own reference, and it says so rather than pretending
  Morrowind agreed. *Reversible; falsifier in §F.*
- **B2 — no enemy health bar.** Source B contains one (`EnemyHealth`, hidden). `RI-UIX01` X2. Not
  taken, in either phase.
- **B3 — no crosshair (M12).** S18: third-person at all times. A crosshair is also the only
  Morrowind element that would violate the empty-centre rule.
- **B4 — no numerals anywhere in the world set.** Morrowind has none; §C row 7 makes it a check.

### §C — The out-of-combat budget, and how it composes with `RI-UIX01` §C

**The composition rule, stated once because everything below is an instance of it: *the budgets
loosen at the fight boundary; the hard fails do not.*** A world frame may carry more than a combat
frame, because the fight is not asking for the screen. It may never carry *more than a combat frame
is allowed to fail at*, because a HUD that is worse than the combat hard fail is a bad HUD in the
place the player spends most of their time. Every hard-fail column below is either `RI-UIX01` §C's
own number or stricter.

Measured on a **world frame**: `getUIState().combat_phase == 'world'`, at 1920 × 1080.

| # | Metric | Budget | Hard fail | Composes with |
|---|---|---|---|---|
| C1 | World-set persistent elements (W1, W3, W4, W6 when present) | ≤ **4** | > 6 | new |
| C2 | Total persistent elements on a world frame (`RI-UIX01` E1–E5, E9 **+** the world set) | ≤ **10** | > 13 | `RI-UIX01` ≤ 6 / > 9 |
| C3 | World-set persistent coverage (union of W1, W3, W4, W6 rects) | ≤ **1.5 %** | > 3.0 % | new |
| C4 | **Union** persistent coverage on a world frame | ≤ **5.0 %** | > **8.0 %** | `RI-UIX01` ≤ 4.0 % / > 8.0 % — **hard fail unchanged** |
| C5 | Peak coverage on any world frame (persistent + conditional + transient, both sets) | ≤ **7.0 %** | > **10 %** | `RI-UIX01` ≤ 6.5 % / > 10 % — **hard fail unchanged** |
| C6 | Coverage of the central 50 % × 50 % on a world frame | **0.0 %** | any element | `RI-UIX01` allows E7 only; **the world set has no exception at all** |
| C7 | Numeric text on a world frame | ≤ **1**, and **0** of it from the world set | ≥ 2, or any from the world set | `RI-UIX01` ≤ 1 |
| C8 | World-anchored elements on a world frame | **0** | any | `RI-UIX01` allows E7 (lock-on) — there is no lock-on out of combat, so the exception has nothing to cover |

**C4 is deliberately less than the sum.** `RI-UIX01` grants the Souls set 4.0 % and C3 grants the
world set 1.5 %, which sums to 5.5 %; C4 is 5.0 %. The two sets are permitted to coexist only on
condition that coexisting costs them something, because otherwise "we are both individually within
budget" is how a screen fills up with two compliant halves. The shipped Souls set measures
**≈2.05 %** persistent (`game/src/ui/hud.js` header) and the world set as specified measures
**0.52 %** (W1 96×96 = 0.444 % + W3 40×40 = 0.077 %; W4 adds 0), for a union of **≈2.57 %** — so C4
is a real ceiling with real headroom, not a formality.

**C6 is the row that will be argued with and it does not move.** The empty centre is not a Souls
convention that lapses when the fight ends; Morrowind keeps the middle empty too, measured in §A,
and for the same reason with a different subject — that is where the *world* is.

**The small-viewport clause.** On a landscape-phone viewport `RI-JRN04` H10 imposes a physical CSS
text floor, and a round element carrying eight labels cannot be both legible and small on a 390 px
axis. C1–C8 are stated at 1920 × 1080, as `RI-UIX01` §C is. Below **900 px of frame height**, C3
relaxes to **≤ 3.0 %** and C4 to **≤ 7.0 %**, and **the hard fails do not move**. The mechanism and
the measured worst case (2.24 % for the dial alone at 844 × 390) are `HUD-MORROWIND` D6's, already
derived; this row adopts that derivation rather than repeating it.

### §D — Placement, and it is a check rather than a preference

**D1 — the world set lives on the bottom half of the frame.** No world-set element's rect may lie
wholly in the top half (`y + h ≤ H/2`). Measured from Source A and Source B: every persistent
Morrowind HUD element is anchored `Left Bottom` or `Right Bottom`; the top of the screen is
**entirely empty** in the owner's screenshot except for the Android port's own chrome. A dial in the
top-right corner is where a modern action-RPG puts its minimap, and that is the register `RI-UIX06`
§B G10 exists to keep us out of.

**D2 — the bearing dial anchors bottom-right; if a Souls element already occupies that corner, the
Souls element keeps it and the dial sits immediately inboard on the same bottom rail.** Stated
relatively on purpose: `RI-UIX01` §A fixes element *sizes* and not *positions*, our build puts the
quick slots (E5) and the equip-load gauge (E9) bottom-right, and re-anchoring a Souls element is
re-litigating `RI-UIX01`, which this item may not do.

**D3 — the effect strip (W2) grows leftward along the bottom edge from the dial**, as M8 does from
M6, and stops before it would enter the central box (C6) or overlap E5.

**D4 — no world-set element may overlap any `RI-UIX01` element's rect**, W4 excepted, which is
defined as being inside one.

### §E — The transition (`ARBITRATION` S54, in this item's units)

**The Souls set is resident. The world set is additive. The world set withdraws at the fight
boundary. The timing is asymmetric.**

| # | Rule | Requirement |
|---|---|---|
| E-T1 | **The Souls set never withdraws** | `RI-UIX01` E1–E5, E9 are declared on every frame the HUD is up, in both phases, with `RI-UIX01` §D's correctness properties holding in both. There is no frame of the game on which the player cannot read their stamina. |
| E-T2 | **The world set withdraws on the entry frame** | W1, W2, W5 declare **nothing** from the first frame of the fight (`ARBITRATION` §1's boundary: first frame of hostile intent). W3, W4, W6 persist in both phases — see E-T6. |
| E-T3 | **Withdrawal is instantaneous. Return may fade.** | No fade, no tween, no easing, no opacity ramp on **entry**. On **exit**, a fade of ≤ **250 ms** is permitted and nothing more. |
| E-T4 | **One clock, and it is `ARBITRATION` §1's** | The phase flips on §1's boundary exactly: entry at the first frame of hostile intent; exit when all hostiles in the encounter volume are dead, dormant, or de-aggroed for > 5 s. No second timer, no per-element hold, no separate "combat music" state. |
| E-T5 | **The census-identity test** | `RI-UIX01` §C's combat census, run on this build and on a copy with the entire world-set module deleted, must return **identical element lists — id for id, frame for frame** — across the whole combat trace. |
| E-T6 | **The three that stay, and why** | W3 (sneak) stays because *whether you are still hidden* is at its most load-bearing during the fight you are trying not to have; W4 stays because it is inside E5's rect and adds nothing to any count; W6 (breath) stays because drowning does not pause for a fight. All three are conditional, so on an ordinary dry standing fight the delta is exactly zero. |

**Why the withdrawal must be instant and the return may not be — this is the whole of E-T3 and it is
a measurement argument, not a taste one.** `RI-UIX01` §C's census is taken *over combat frames*. A
dial that fades out over twelve frames is a dial **present in twelve combat frames**, and the census
counts it: the coverage budget is then blown by an animation nobody thinks of as an element, and the
build fails `RI-UIX01` U2 for a reason its author will not find. Symmetrically, a fade on *return*
is measured against nothing, so it is free. The player experience happens to point the same way —
the thing that must be immediate is the moment a fight starts — but E-T3 would hold even if it did
not.

**Why superset and not swap.** The alternative ruling — Souls set appears on aggro, Morrowind set
withdraws — was considered and rejected on three grounds, in descending order of force:

1. **`RI-UIX01` §D1 makes the stamina bar a same-frame correctness property**, tolerance ±0.005 on
   100 % of frames. An element that fades in **has no defined fill on its fade frames**, and the
   frames it is fading in on are the opening frames of a fight, which is when a stamina misread is
   most expensive. A swap ruling would put the corpus's most absolute numerical requirement behind
   an animation.
2. **The boundary has five seconds of hysteresis by doctrine.** A HUD that swaps its whole
   composition on §1's boundary re-composes on every leash and re-aggro. In a marsh with ranged
   enemies and enemies that pursue and give up, that is a corner of the screen that never settles.
3. **Four of Morrowind's six persistent elements already have a Souls counterpart on screen**
   (§B). Swapping would replace measured elements — the ones carrying §D1–D6 — with unmeasured ones,
   for a delta that is 0.52 % of the frame. The gain is not worth the loss and the arithmetic is in
   §A.

### §F — What would overturn each ruling here

This section exists so that no ruling in this item has to be re-argued from scratch, and so that
each one names the evidence that beats it rather than being defended on authority.

| Ruling | Falsifier |
|---|---|
| §E superset, not swap | A played gate (§G) in which judges report the world frame as *cluttered* while the combat frame reads clean, **and** the world set measures within C3 — i.e. the clutter is the resident Souls set, present when nothing needs it. Then residency is the defect, and E-T1 should narrow to E1/E2 with the loadout readouts moving into the world set. |
| §E-T3 asymmetric timing | A build whose withdrawal is instant and which judges describe as *snapping* or *flickering* at the boundary, where `RI-UIX01`'s census demonstrably has headroom. Then the census argument is not binding for that build and a ≤ 120 ms entry fade may be traded for it — but only with the census re-run and quoted. |
| §B1 no HUD minimap | The owner asking for one. It is their world and they overruled S30 by reading; this row is written so that overturning it is a one-line change (add `map_panel` to §B, add a row to §C, delete B1) and **not** a re-derivation. Absent that: a played gate in which players who have the map *screen* still cannot answer "where am I" from the world, which would mean `RI-WLD06`'s obligations are unmet and the honest fix is a landmark, not a corner panel (`RI-UIX02` §How-we-lose says this in full). |
| §D1 bottom half | A viewport where the bottom rail is genuinely unavailable — a phone with a gesture bar consuming it — measured, not asserted. Then D1 becomes "the edge furthest from the player's thumbs" and the check reads the safe-area inset. |
| §C4's 5.0 % union | The first census on a compliant build returning > 5.0 % *without* any element exceeding its own row. Then the sum-is-less-than-the-parts rule is too tight and C4 should rise to 5.5 %, which is the plain sum. `RI-UIX01`'s own provenance note flags exactly this risk for its 4.0 %, and this item inherits it. |
| §A being `measured` | A vanilla-Morrowind (not OpenMW) capture whose element rects disagree with Source B by more than 10 %. Then Source B is an OpenMW reconstruction rather than a faithful layout and §A drops to `canonical-recall`, `confidence: low`. |

## Reconciliation with what has already been built

A Morrowind HUD with a compass **landed before any of this was written down**
(`game/src/ui/compass.js`, 328 lines; `game/src/ui/hud.js`; wired through `game/src/ui/system.js`;
piece `HUD-MORROWIND`). It was read in full before this item was written. **Where it and this item
disagree, this item is the authority and the difference is a named remediation — the item is not
rewritten to match the code.**

**What it got right, and these are passes rather than debt:**

- **The withdrawal, exactly.** `drawCompass()` returns without declaring anything while
  `m.inCombat`. That is E-T2 and E-T3's entry half, built, with no fade, before either was written.
  Its header's reasoning — that `RI-UIX01` is `souls` *because* the combat HUD is inside the fight,
  so X6 governs where X6 governs — is S54's reasoning, reached independently.
- **No markers, structurally.** The model is `{bearing_deg}` and nothing else: no place list, no
  quest field, no world position. `RI-UIX02` §A names this exact temptation by name and the
  implementation removed the mount point rather than promising not to use it.
- **`kind: 'bearing_dial'`, with `compass` left in `FORBIDDEN_KINDS`,** and the rename said out loud
  in its own header rather than hidden. Same precedent as `map_terrain`/`map_place`/`map_player`
  after S35.
- **The minimal/full switch is a player switch and is orthogonal to the phase.** `hud.js` draws the
  dial in both modes and drops the Souls loadout readouts in minimal. That is the right way round
  and this item confirms it: minimal means *less chrome*, not *less Morrowind*.

**The remediations, named and owed. `HUD-MORROWIND` owns those files; none of them were edited
here.**

| # | Gap | Item authority | Size |
|---|---|---|---|
| **R1** | **The dial is in the top-right.** `dialGeometry()` computes `cy = max(84·s + r, margin + r)` — the top edge. §D1 requires the bottom half of the frame and §D2 requires the bottom-right corner or the rail inboard of it. Source A shows Morrowind's entire HUD along the bottom edge and its top empty. | §D1, §D2 | two lines in `dialGeometry()`, plus its overlap check against E5/E9 |
| **R2** | **Five of the six world-set elements do not exist**: W2 (effect strip), W3 (sneak state), W4 (condition/charge marks), W5 (place-name), W6 (breath). Only W1 is built. `ui.hud.world` therefore scores **1 / 6** on element presence today, and **W4 is free** — it is drawn inside a rect E5 already owns. | §B | W4 is small and should go first; W2/W3 need simulation reads that exist |
| **R3** | **A factual error in `compass.js`'s header, and it is the sentence a future edit would cite.** It states *"Morrowind's own compass carries a red quest arrow."* **It does not. Morrowind has no quest markers at all** — that is the whole of S8's premise, and the red-arrow compass is Oblivion (2006) and Skyrim. Source B's rotating overlay is `textures\compass.dds`, a compass **rose** on the local map; Source A's bottom-right panel carries a player facing-arrow on a local map and nothing else. Left uncorrected, the file's own comment is a standing argument that Morrowind fidelity requires a quest marker. | §A M6, §0 | one comment line |
| **R4** | **No `combat_phase` in the harness.** Nothing a critic can read tells it which phase a captured frame is in, so E-T5's census-identity test cannot be run and C1–C8 cannot be scored on the right frames. This is the gap that makes the whole item `unmeasurable` today. | §Harness additions | one field |
| **R5** | **The world set is outside every AR-2 detector.** `RI-UIX02`'s `ui-layer.mjs` sweeps `ui-combat` and `ui-world` viewpoints; `ui-census.mjs` is run on combat traces. Neither has a world-phase pass that knows the world set exists — which is the same defect `GAP-W1-ui-map-outside-the-ar2-detectors` already records against the map screen, recurring for the same reason. | §Comparison method | add `ui-world` to the existing sweeps; **no new tool** |

## Comparison method

**No new analysis tool is commissioned by this item, deliberately.** `RI-UIX02`'s detectors already
do all of this and are already owed; every step below is an existing script run on a world-phase
capture set. Commissioning a seventh UI tool when five of the existing six do not run yet
(`RI-UIX02` §How-we-lose) would be building the thing that fails rather than the thing that measures.

1. **Capture the world phase.** A new viewpoint set `ui-world` appended to
   `tools/harness/viewpoints.json`, and it must include the cases where a HUD hides:
   `ui_world_road_day`, `ui_world_road_night`, `ui_world_settlement_street`,
   `ui_world_deepmarsh_night`, `ui_world_saltstorm`, `ui_world_interior_firelit`,
   `ui_world_underwater`, `ui_world_sneaking`.
   ```bash
   node tools/harness/run-headless.mjs --scenario ui-world-sweep --seed 1337 \
        --ui-visible --ui-state --trace
   node tools/harness/shoot.mjs --viewpoints ui-world --ui-visible \
        --out reports/runs/<runId>/shots-ui-world
   ```

2. **§C census on world frames.** `ui-census.mjs`, unchanged, restricted to frames where
   `combat_phase == 'world'`. Coverage is the **union** of rects, never the sum.
   ```bash
   node tools/analysis/ui-census.mjs --run reports/runs/<runId> --phase world
   ```

3. **§E-T5, the census-identity test — the one check that cannot be faked by a self-report.**
   Build a copy with the world-set module deleted (`RI-MTH04`'s deletion discipline: delete it, do
   not flag it off). Run `RI-UIX01`'s combat census on both. Diff the element lists frame by frame.
   **Any difference is an E-T2 failure**, and a difference that appears only in the first few frames
   of a fight is specifically an E-T3 fade.

4. **§E-T3 timing, from the trace, not from a screenshot.** For the aggro entry frame `f`: assert
   every withdrawing element's `visible` is `false` and its declaration absent at `f`, and present
   at `f-1`. For the exit frame `g`: permitted to ramp, and `opacity` must reach 1.0 by `g + 15`
   (250 ms at 60 Hz). A build that ramps on entry shows as a monotone opacity series across `f`.

5. **§D placement**, from `getUIState()` rects: assert `y + h > H/2` for every world-set element, and
   zero rect intersection with any `RI-UIX01` element except W4.

6. **AR-2 detectors, extended to the world phase (R5).** `RI-UIX02` §C's pixel sweep and §E's
   quest-state differential, run over `ui-world` as well as `ui-combat`. **The differential is the
   important one here**: the world set is where a quest-conditioned element would actually be added,
   because that is where the player is lost. Any non-empty `D` in the UI layer on a world frame is
   `RI-UIX02` K3 and is AR-2.

7. **Record the counts.** As `RI-UIX02` §Comparison-method 6 requires and for the same reason: the
   number of world viewpoints swept, phases captured, and frames censused. "The world HUD is clean"
   with no counts is indistinguishable from not having looked.

### §G — The played gate (Ruling W2), and it is what decides this item

**Every number above can fail a build and none of them can pass one.** A world frame with four
elements at 2.5 % coverage is a *count*; whether the game looks like Morrowind when you are walking
down a road is a question only a person answers. Per **Ruling W2** — *"a human gate must show the
artefact as a player meets it, and ask whether it is good"* — and per the owner's 2026-08-14
directive that **static inspection is not evidence**, this gate is not optional and it is not a
still.

**Stimulus.** Production render, shipped HUD, no debug overlay, no annotations, **the world visible**
(this is the opposite of `RI-UIX06` §G, which crops the world *out* — that test asks whether the
panel is a UI kit; this one asks whether the HUD belongs on the screen it is on).

- **Eight world stills**, one per `ui-world` viewpoint, day and night, interior and exterior.
- **A motion sequence across the boundary**, both directions: frames `f-30 … f+30` around aggro
  entry and around exit, rendered as a sequence and shown as one, not as two stills.
- **Ten minutes of driven play** through a settlement and a stretch of road, no combat, HUD on.

**Judges.** Fresh agents, one per stimulus, that have read neither this item nor the plan nor the
source. **Questions, verbatim, asked in this order and recorded before any reveal:**

```
1. You are walking through this world. What does the screen tell you that
   you could not work out by looking at it?
2. Is there anything on this screen you would want removed? Name it.
3. Is there anything you kept wanting to know and the screen never told you?
4. [motion sequence only] Something changed on screen. What changed, and
   did it surprise you?
5. Would you say this interface belongs to this world, to a different game,
   or to no game in particular? One sentence.
```

**Answer key.** Q4 is the transition's real test and the one the numbers cannot reach: *"the
compass went away when the fight started"* is a **pass**; *"something disappeared and I don't know
what"* is a **fail on E-T3** regardless of what the trace says; *"nothing changed"* is a fail on
E-T2 — the delta did not withdraw, or there was no delta. Q3 naming *where am I* or *which way is
north* on a build that has W1 is a **fail on §D** (the element exists and is not being found, which
at 96 × 96 in the wrong corner is exactly what R1 predicts). Q2 naming a world-set element is a
finding against §C; Q2 naming a Souls element on a world frame is §F's falsifier for E-T1 firing,
and must be reported as such rather than dismissed.

**A gate whose judges all say "fine" is `inert` and does not pass.** Run it against an ablated arm —
the same capture with the world set deleted — and if the two are indistinguishable, the world set is
not doing anything and the honest score is 0 on §G, not a pass (`HAZARDS` §0; S51 class D).

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| V1 | World-set element presence (§B W1–W6, refusals B1–B4 held) | all 6 present and correctly conditioned; 0 refused elements | any of B1–B4 present (**B1/B2 are also AR-2**) |
| V2 | Element counts (§C C1, C2) | both within budget | either above the hard-fail column |
| V3 | Coverage (§C C3, C4, C5) | all three within budget | any above the hard-fail column |
| V4 | Centre clear and no world anchors (§C C6, C8) | 0.0 % and 0 | any |
| V5 | Numerals (§C C7) | ≤ 1 total, 0 from the world set | any world-set numeral |
| V6 | Placement (§D D1–D4) | all four | a world-set element wholly in the top half, or overlapping an `RI-UIX01` rect |
| V7 | **Withdrawal (§E E-T2, E-T5)** | census-identity holds, id for id, across the whole combat trace | any world-set element declared on any combat frame (**also `RI-UIX01` X5/X6 ⇒ AR-2**) |
| V8 | **Transition timing (§E E-T3, E-T4)** | instant on entry; ≤ 250 ms on exit; one clock | a monotone opacity ramp across the entry frame |
| V9 | Residency (§E E-T1) | Souls set declared on 100 % of HUD-up frames in both phases | any frame with the HUD up and no stamina bar |
| V10 | AR-2 detectors run on the world phase (R5) | `RI-UIX02` §C and §E over `ui-world`, counts recorded | detector not run, or counts not recorded |
| V11 | **Played gate (§G)** | judges answer Q4 with the actual change; Q3 does not name direction on a build with W1; ablated arm reads worse | Q4 answers are *"something disappeared and I don't know what"*, or the arms are indistinguishable (`inert`) |

Native scale **checks passed / 11**. Any hard fail caps the piece at 2. **V7's hard fail additionally
triggers AR-2** (`ARBITRATION` §3) — a compass or an effect strip on a combat frame is `RI-UIX01`
X5/X6, and X5/X6 are AR-2 by `RI-UIX01` U4.

**§G caps, as `RI-UIX06` §G caps ART:** V11 `inert` → cap **4**; V11 hard fail → cap **2**; V11 pass
→ no cap. **A build cannot reach the top band on counts alone**, which is the point of Ruling W2 and
the reason V11 is a cap rather than a row worth one eleventh.

**Unimplemented scores 0.** No out-of-combat HUD ⇒ every check 0 — *including* a build that ships a
perfect `RI-UIX01` HUD and simply leaves it up. That build has not built a minimal world HUD; it has
declined to notice that the game continues after the fight.

**Unmeasurable scores 0, and today it is unmeasurable.** Without `combat_phase` in `getUIState()`
(R4) V7 and V8 cannot be run at all, so the honest verdict for this item at the time of writing is
**0, `corpus_debt`-flagged on R4**, and not "probably fine, the compass withdraws".

**What we lose looks like:**
```
V1  world set: 1 of 6 present (W1 only). W4 free and absent.
V6  W1 rect [1758,84,96,96] -- top-right. y+h = 180 <= H/2 = 540.  FAIL
V7  census-identity: PASS. 1800 combat frames, element lists identical.
V10 ui-world sweep: not run (no ui-world viewpoint set).            FAIL
V11 played gate, Q3, four of six judges: "which way am I going?"
    -- on a build that HAS a compass, in the corner nobody looked at.
=> 2/11. The one element that exists is in the wrong corner and the
   detectors that would have said so were never pointed at the world.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2.** Derived from this item's own
bands. No threshold in any other item was changed by this file.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 7 / 11 checks, V11 not `inert` | 9 / 11 checks, V11 pass | 11 / 11 checks, V11 pass |

**Aggregation (a property of this item, not of the critic):** count of passing checks; any hard fail
caps the piece at 2; V11 caps independently at 4 (`inert`) or 2 (hard fail) regardless of the count.

## How we lose

- **The item is written and the world set is never built,** because it is not in anyone's plan and
  `RI-UIX01` is. This is the likeliest outcome and it is a failure of dispatch rather than of a
  build. R2 is five elements, four of which are small and one of which (W4) costs nothing; the
  visible symptom will be `ui.hud.world` sitting at 1/6 through a wave while `ui.hud.combat` scores
  8, and a roll-up that reports "UI: good".
- **The withdrawal quietly acquires a fade,** added by someone making the boundary feel smoother,
  and it is *right* that it feels smoother. It costs `RI-UIX01` U2 twelve frames of coverage the
  census counts, and the failure surfaces in the combat item with no obvious cause. V8 and E-T5 are
  both here because either one alone can be argued around.
- **The dial acquires a tick.** `RI-UIX02` §A predicted this in advance and named the exact sentence
  — *"a compass added 'just for cardinal direction, not for objectives'"* — and `compass.js` closed
  the structural hole. The remaining route is R3: the file's own header currently asserts that
  Morrowind's compass carried a quest arrow, which is false, and which is precisely the citation a
  well-meaning future edit would lean on. **A factual error in a comment is a design argument left
  loaded.**
- **The world phase is never captured,** so every check here is run on combat frames, finds nothing,
  and reports clean. This is R5, and it is the same shape as
  `GAP-W1-ui-map-outside-the-ar2-detectors`: the detectors exist, they are good, and they are
  pointed at the wrong screen. V10 exists to make "we ran the detectors" false when the world was
  not among them.
- **`combat_phase` is self-reported and drifts from the simulation.** If the field is computed in
  the UI layer rather than read from the encounter state, a build can be in a fight and report
  `world`, and every check in §C then measures the wrong frames — while V7 passes, because the
  census-identity test would also be comparing the wrong frames. The harness note below requires it
  to be **the same value the AI reads**, not a UI-side inference.
- **The budget becomes the target.** C3's 1.5 % is a ceiling derived from a Morrowind HUD that
  measures 1.911 % *including a map panel we refuse*; a build that spends its way up to 1.5 % has
  built something larger than the thing it is imitating. The measured reference figures are in §A
  precisely so a critic can say "Morrowind did this in 0.52 % of what you spent".
- **Someone reads §A and imports `openmw_hud.layout` wholesale.** It contains `EnemyHealth`
  (`RI-UIX01` X2) and a crosshair (S18), both hidden, both one flag from visible. B2 and B3 are
  written as refusals rather than omissions for exactly this reason.
- **The played gate is replaced by a same/different pack.** *"Can you tell the world HUD from the
  combat HUD?"* is easy, it is cheap, it will pass, and it is the substitution Ruling W2 convicts by
  name. **Distinguishable is not good.** §G asks whether the screen is good and what it fails to
  tell you; those two questions are the item.

## Seam (AR-3)

**Not sterile, and the crossing is the item's whole subject.** This item exists on the seam: it is
the Morrowind half of a HUD whose other half is Souls, and §E is a boundary-crossing interaction by
construction — the fight's own state (`ARBITRATION` §1's encounter boundary, a Souls-owned notion)
decides what a Morrowind interface draws. Two further crossings are real rather than nominal: **W4**
puts a Morrowind repair-and-condition economy (S12, gold, smiths) inside `RI-UIX01` **E5**, a Souls
quick-slot cluster, at zero coverage cost; and **W3** makes a Morrowind stealth state
(`RI-STL01`) legible during a Souls fight, which is the case where sneaking and fighting are the
same activity. A critic should record `seam_sterile: false` on §E and W4 together.

## Provenance note

`provenance: measured`, `confidence: medium`.

**`measured` is claimed for §A only and it is claimed carefully.** Every rect in §A comes from
`corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_hud.layout`, a vendored artefact, and every one
of them is corroborated against the owner's screenshot (sha
`e9a0531c…`) at a single consistent UI scale of 2.0 — the five-row table in §0 is the corroboration
and it is reproducible from the two files. Two independent artefacts agreeing on one scale factor is
why this is not `canonical-recall`. **The known weakness is that both sources are OpenMW rather than
vanilla Morrowind**, and §F names the falsifier: a vanilla capture disagreeing by > 10 % drops §A to
`canonical-recall`, `confidence: low`. The coverage percentages derived from §A are arithmetic on
those rects and inherit their status.

**Everything in §C, §D and §E is `constructed`**: the ≤ 4 / ≤ 10 counts, the 1.5 % and 5.0 % and
7.0 % budgets, the 250 ms return fade, the 900 px small-viewport threshold, the ≤ 12 concurrent
effect glyphs, and the §G question set. Of these, **C4's 5.0 % is the one to challenge** — it is
deliberately less than the plain sum of the two items' budgets (5.5 %), on a principle rather than a
measurement, and §F names what would overturn it. The hard-fail columns are **not** constructed:
C4's 8.0 % and C5's 10 % are `RI-UIX01` §C's own numbers, adopted unchanged so that the world frame
can never be permitted to be worse than a combat frame is permitted to fail at.

**`confidence: medium`** rather than high, for three reasons stated so a critic does not have to
find them: (1) both references are OpenMW; (2) the budgets have never been run against a world-phase
census because no such census exists yet (R4/R5) — the same honest caveat `RI-UIX01`'s own provenance
note carries about its 4.0 %, and the first census should be used to confirm the budget is
achievable **before any build is failed on it**; (3) §E's superset ruling is settled by
`ARBITRATION` S54 and marked reversible there, and this item follows S54 rather than deciding for
itself.

**Coordination note, recorded because half of it could not be performed.** `W1-MW-UI-REFS` owns the
reference structure and is vendoring Source A as `REF-A12c`; it is separately writing `RI-UIX08` (the
dialogue window), which is the *other* half of the owner's screenshot and does not overlap this item.
**`SendMessage` could not reach that agent from this session and `ListAgents` is not available here**,
so the coordination was done by reading its status file rather than by talking to it, and three
findings that belong to it were **not** delivered: (a) the touch-overlay exclusion in §0, (b) that
`REF-A12/mygui/openmw_hud.layout` already carries Morrowind's exact HUD geometry and corroborates the
screenshot at scale 2.0, and (c) the `compass.js` factual error in R3. This item therefore cites
Source A **by sha256 first and path second**, and the sha is the handle that must survive the
vendoring. If `REF-A12c` lands under a different id, only §0's path line changes.

**Harness additions requested** — extending `RI-UIX01`'s and `RI-UIX06`'s `getUIState()`:

```js
getUIState(): {
  // ... RI-UIX01 and RI-UIX06 fields unchanged ...

  // R4. THE ONE FIELD THIS ITEM CANNOT BE MEASURED WITHOUT.
  // It must be READ FROM THE ENCOUNTER STATE the AI uses -- ARBITRATION §1's boundary,
  // the same value that gates roll i-frames and stamina regen -- and never recomputed
  // in the UI layer. A UI-side inference can disagree with the simulation, and then
  // every check in RI-UIX07 §C measures the wrong frames while reporting that it did not.
  combat_phase: 'world' | 'fight',
  combat_phase_source: 'encounter',        // asserted, so a UI-side reimplementation is visible
  frames_since_phase_change: number,       // E-T3's ramp detector reads this

  elements: [{
    // ... existing fields ...
    withdrawn_because: null | 'combat_phase',   // E-T2: declared absence, not silent absence
  }],
}
```

plus the **`ui-world` viewpoint set** appended to `tools/harness/viewpoints.json` (eight poses, §
Comparison method 1) and a `--phase` filter on the existing `tools/analysis/ui-census.mjs`. **No new
analysis tool is requested**, and that is deliberate: `RI-UIX02` already owes five that do not exist,
and a sixth would be a sixth thing that does not run.
