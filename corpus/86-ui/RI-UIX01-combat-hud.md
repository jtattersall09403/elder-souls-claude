---
id: RI-UIX01
title: The combat HUD — what it shows, what it must never show, and stamina as a correctness property
kind: number
side: souls
judges: [ui.hud.combat, combat.stamina.regen]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `souls`.** The combat HUD is *inside the fight* and Souls is
> authoritative (ARBITRATION §1, "Stamina", "Lock-on"). The **art** of these elements is not
> judged here — that is `ui.style.diegesis` (RI-UIX06) and it is judged against Morrowind under
> `JUDGEMENT SIDE: ART_DIRECTION`. This item judges **what elements exist, how much screen they
> take, and whether they are readable and truthful under pressure.** A beautiful chitin-framed
> stamina bar that lags the simulation by four frames fails this item at any art score.
>
> **AND THIS ITEM STOPS AT THE FIGHT BOUNDARY — READ `RI-UIX07` BEFORE BUILDING ANY HUD.** Added
> 2026-08-14 by **ARBITRATION S54**, after the project's owner read this file and found the gap:
> §A's table is scoped, in its own words, to elements *"persistent, always present **in combat**"*,
> and **the HUD persists for the rest of the game too** — which is most of an hour-wide world, and
> which the supreme law assigns to Morrowind. `RI-UIX07` is this item's counterpart on the other side
> of that line: the Morrowind out-of-combat element set, its own budget, and the transition.
> **Nothing in this item is changed by it** — no threshold, no band, no §B row — and S54's clause (3)
> is what keeps that true: the out-of-combat set declares nothing on a combat frame, asserted by
> `RI-UIX07` V7's census-identity test, so §C's census reads exactly what it read before that set
> existed. A build that satisfies this item and then leaves its HUD up for the rest of the game has
> **not** satisfied `RI-UIX07`; it has declined to notice that the game continues after the fight.

## The bar

A Souls HUD is small, permanent, and tells you exactly the things you cannot deduce from the
world. Health, stamina, healing charges, what is locked on, what is building up on you. It does
not narrate. It does not float numbers off enemies, it does not label them, it does not draw a
map, and it does not put an arrow anywhere.

**Stamina is the load-bearing element and it is a combat-correctness property, not a
presentation one.** ARBITRATION §1 gives Souls "stamina as the universal action currency; regen
delay after spend". A player deciding whether to roll is reading the bar; if the bar is a frame
behind, or tweened, or low-contrast against wet black mud at night, the player is making
stamina decisions on stale or invisible information and the combat model has been silently
broken by the renderer. **A stamina bar that does not update on the same frame as the
simulation is the same class of defect as a hitbox that lags its animation.**

The second half of the bar is subtractive and is where a modern-UI instinct will break this.
Everything a contemporary action game adds for "clarity" — damage numbers, hit markers,
directional damage indicators, floating enemy nameplates, a compass, a minimap, threat arrows,
XP popups — is forbidden here, and most of them are forbidden **twice**: by Souls convention
inside the fight, and by S8/AR-2 outside it. RI-UIX02 owns the marker enforcement; this item
owns the count.

## The reference artifact

### §A — The permitted element set (closed)

Persistent, always present in combat:

| # | Element | Shown | Max px @1920×1080 | Note |
|---|---|---|---|---|
| E1 | Health bar | always | 430 × 16 | absolute fill, no numeric readout by default |
| E2 | Stamina bar | always | 430 × 10 | §B applies |
| E3 | Magic/focus resource (S19) | always if the build can cast | 430 × 10 | |
| E4 | Healing-charge count (Estus-equivalent) | always | 96 × 96 | discrete pips or a numeral; finite charges are the point |
| E5 | Equipped quick-slots (L/R hand, item, spell) | always | 220 × 220 | bounding box; art is mostly transparent |
| E6 | Status buildup meters (poison, disease, curse, frost — S11) | **only while > 0** | 240 × 12 each, ≤3 concurrent | fills and drains; disappears at 0 |
| E7 | Lock-on reticle | only while locked on | 48 × 48 | world-anchored on the target |
| E8 | Boss health bar + name | only in a fog-gated boss fight | 900 × 34 | the *only* enemy health readout in the game |
| E9 | Equip-load / weight state indicator | always | 120 × 24 | drives roll distance (combat.dodge.equipload) |

**Nothing else is permitted on screen during combat.** Contextual prompts (E10: "Interact",
≤200×32, only when a valid interactable is in range) and transient system toasts (E11: item
acquired, ≤400×48, ≤3 s, ≤1 concurrent) are permitted but are **not combat elements** and are
counted separately; a build showing E11 during an active fight fails §C.

### §B — The forbidden set (each is a hard fail)

| # | Forbidden | Also forbidden by |
|---|---|---|
| X1 | Floating damage numbers | — |
| X2 | Floating enemy nameplates / health bars over ordinary enemies | — (E8 is the sole exception) |
| X3 | Hit markers / crosshair confirmation | — |
| X4 | Directional damage indicators ("you are being hit from the left") | — |
| X5 | Minimap | **S8, AR-2** |
| X6 | Compass strip | **S8, AR-2** |
| X7 | Objective text / quest tracker overlay | **S8, AR-2**; RI-UIX04 |
| X8 | Any world-anchored marker, waypoint, arrow or pin | **S8, AR-2**; RI-UIX02 |
| X9 | XP / souls-gained popups | — (souls are shown in the menu, not as a killfeed) |
| X10 | Enemy "danger" telegraph rings drawn on the ground | — (the telegraph is the *animation*; a ground decal replaces reading the enemy with reading the floor) |
| X11 | Combo counters, style meters, DPS readouts | — |
| X12 | Interact prompts on things that are not in range | — |

X10 deserves its own line because it is the one that gets argued for on accessibility grounds
and it is genuinely load-bearing: ARBITRATION §1 gives Souls "telegraphed windups" as an
*animation* property. A ground ring makes the animation redundant, which makes enemy design
redundant, which is the fight becoming a rhythm game.

### §C — The budget

| Metric | Value | Hard fail |
|---|---|---|
| Persistent combat elements (E1–E5, E9) | ≤ **6** | > 9 |
| Total elements on screen at any combat frame | ≤ **9** | > 12 |
| Persistent HUD screen coverage (union of E1–E5, E9 bounding boxes) | ≤ **4.0%** of 1920×1080 | > 8.0% |
| Coverage including E6–E8 at maximum | ≤ **6.5%** | > 10% |
| Coverage of the central 50% × 50% of screen (the fight area) | **0.0%** — E7 reticle excepted | any element other than E7 |
| Elements anchored to a world position | **E7 only** | any other |
| Numeric text visible during combat | ≤ **1** (E4's charge count) | ≥ 3 |

The central-region rule is the one that catches "small but everywhere" HUDs. Souls keeps the
middle of the screen empty because that is where the fight is.

### §D — Stamina readability (the correctness half)

| # | Check | Requirement |
|---|---|---|
| D1 | **Same-frame truth** | The rendered stamina fill fraction at frame `f` equals `trace.player.stamina / stamina_max` at frame `f`, to within **±0.005**, for **100%** of frames. No tween, no lerp, no easing, no "smoothing". |
| D2 | **Regen-delay state is visible** | While `stamina_regen_blocked == true` the bar is rendered in a visually distinct state (colour shift, desaturation, or a marker at the spend point) distinguishable from the regenerating state at ≥3:1 contrast between the two states. |
| D3 | **Contrast under worst-case backgrounds** | Bar-fill vs bar-empty contrast ratio ≥ **4.5:1**, and bar vs *background* ≥ **3.0:1**, measured against the game's three worst backgrounds: night in the Deep Marshes, firelit interior, and the salt-storm in the Stone Wastes. |
| D4 | **Minimum size** | Bar height ≥ **8 px** at 1920×1080 and ≥ 0.9% of screen height at every supported resolution (RI-UIX06 F18). |
| D5 | **Spend is visible at the moment of spend** | The bar's decrease begins on the frame of the `stamina_spend` event, not on the animation's first frame and not on its recovery frame. |
| D6 | **Exhaustion is unmistakable** | At `stamina == 0` the bar enters a third distinct state, and RI-AUD05 §C `exhausted` fires on the same frame. |

D1 is stated absolutely on purpose. A tweened bar is the single most common "juice" addition in
game UI and it is *wrong here*: the player is timing a roll against a threshold, and an eased
bar shows them a value the simulation does not have. 100% of frames, ±0.005, no exceptions.

## Comparison method

1. **Capture with the HUD on.** The RI-VIS screenshot contract turns the HUD *off*
   (HARNESS.md §6) because fidelity metrics must not measure UI. This item needs the opposite,
   so it uses its own capture set:

   ```bash
   node tools/harness/run-headless.mjs --scenario cmb-duel-infantry --seed 1337 \
        --ui-visible --ui-state --trace
   node tools/harness/shoot.mjs --viewpoints ui-combat --ui-visible \
        --out reports/runs/<runId>/shots-ui
   ```

   Viewpoint set `ui-combat` (append to `tools/harness/viewpoints.json`, HARNESS.md §6):
   `ui_combat_neutral`, `ui_combat_lockon`, `ui_combat_lowstam`, `ui_combat_status`,
   `ui_combat_boss`, `ui_night_deepmarsh`, `ui_firelit_interior`, `ui_saltstorm`.

2. **§C element census.** From `getUIState()` sampled every frame of the combat trace:
   ```bash
   node tools/analysis/ui-census.mjs --run reports/runs/<runId>
   # -> {persistent, peak_total, coverage_pct, coverage_center_pct,
   #     world_anchored:[...], numeric_text:[...], unknown_kinds:[...]}
   ```
   Coverage is the union area of element `rect`s over screen area — union, not sum, so
   overlapping elements are not double-counted.

3. **§B forbidden-set detection.** Two independent probes, because `getUIState()` is a
   self-report:
   - **Declared:** any element whose `kind` is in the X1–X12 vocabulary, or any element with a
     `worldAnchor` that is not the lock-on reticle.
   - **Observed:** a pixel probe. For X1/X2, run `cmb-duel-infantry` with 6 enemies, capture at
     the frame after a `hit` event, and OCR the frame region within 200 px of each enemy's
     projected screen position. Any digit glyph found there is X1.
     ```bash
     node tools/analysis/ui-forbidden.mjs --run reports/runs/<runId> --ocr
     ```
   The observed probe exists because a game that draws damage numbers directly to the canvas
   without registering them as UI elements is invisible to `getUIState()` — and that is exactly
   how they would be drawn.

4. **§D1 same-frame truth.** This is the check that needs the harness most. For every frame of a
   1800-frame trace, compare `getUIState().elements['stamina'].fill` against
   `trace.player.stamina / player.stamina_max`. Report max absolute error, the frame of the max,
   and the count of frames exceeding ±0.005. A tween shows up as a characteristic exponential
   error curve after each spend, which the analyser reports as `tween_detected: true`.

5. **§D2/D3 contrast.** From the eight `ui-combat` shots, sample the bar's fill region, its
   empty region and a 20 px annulus around it; compute WCAG relative-luminance contrast ratios.
   Do this at three stamina values (100%, 40%, 0%) and in both regen states.

6. **§D5 spend timing.** From the trace, for each `stamina_spend` event at frame `f`, assert
   `uiState.stamina.fill` at `f` < at `f-1`.

7. **§D4 size across resolutions.** Re-capture `ui_combat_neutral` at 1280×720, 1920×1080 and
   3840×2160 and assert the bar's height in *screen fraction* is constant to ±10% (this is the
   RI-UIX06 F18 scaling check applied to the one element where it is a correctness matter).

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| U1 | Element counts (§C rows 1–2) | both within budget | either above hard-fail column |
| U2 | Coverage (§C rows 3–4) | both within budget | either above hard-fail column |
| U3 | Centre-screen clear | 0.0% non-reticle | any persistent element in the centre 50%×50% |
| U4 | Forbidden set, declared | 0 hits X1–X12 | any of X5, X6, X7, X8 (these are also AR-2 fails) |
| U5 | Forbidden set, observed (OCR/pixel) | 0 hits | any digit within 200 px of an enemy after a hit |
| U6 | Stamina same-frame truth (D1) | 100% of frames within ±0.005 | `tween_detected` or >1% of frames out of tolerance |
| U7 | Regen-delay state visible (D2) | ≥3:1 between states | states identical |
| U8 | Contrast (D3) | ≥4.5:1 fill/empty and ≥3.0:1 vs background in **all three** worst backgrounds | <2.0:1 in any |
| U9 | Bar size and scaling (D4) | ≥8 px @1080p, ±10% screen-fraction across resolutions | bar invisible or absent at any supported resolution |
| U10 | Spend/exhaustion timing (D5, D6) | both exact | spend visible only after the animation completes |

Native scale **checks passed / 10**. 10/10 → meets the bar (ceiling 8). 7–9 → below bar, remedy
required (ceiling 6). ≤6 → loses outright (ceiling 4). Any hard fail caps at 2, and U4 hits on
X5–X8 additionally trigger **AR-2** (automatic fail of the piece, ARBITRATION §3).

**Unimplemented scores 0.** No HUD ⇒ every check 0. A build with no stamina bar has not built a
minimal HUD; it has failed to build the one element the combat model requires the player to
read.

**What we lose looks like:**
```
U1 persistent 14, peak 19.    U2 coverage 11.3%, centre 2.1% (compass strip)
U4 declared: minimap, compass, objective_tracker, damage_number -> AR-2 FAIL
U5 observed: 47 digit glyphs within 200px of enemies
U6 tween_detected: true, max error 0.34 at f=812, 61% of frames out of tolerance
U8 night_deepmarsh: bar vs background 1.4:1
=> AR-2 automatic fail. Capped at 2. The HUD is a modern action-RPG HUD, the
   stamina bar is decorative, and at night you cannot see it at all.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 7 / 10 checks | 8 / 10 checks | 10 / 10 checks |

**Aggregation (a property of this item, not of the critic):** count of passing checks; any hard fail caps the piece at 2.

## How we lose

- **The stamina bar is tweened for feel.** It will look better. It will be added by someone who
  is right about every other bar in the game. And it makes the single most timing-critical
  readout in the fight display a value the simulation does not hold. U6 is the detector and it
  is stated as an absolute (100% of frames) specifically so that "it's only a few frames"
  cannot be negotiated.
- **The HUD grows one useful element at a time.** Nobody adds a modern HUD; people add a
  "small" enemy health bar because playtesters could not tell if they were making progress,
  then damage numbers to debug the damage formula, and the debug numbers ship. U1/U2's counts
  and the *observed* probe in U5 exist because the debug path is the likeliest origin and it
  never goes through `getUIState()`.
- **Contrast is checked in daylight.** The bar is designed against a mid-grey mock-up, looks
  fine, and vanishes against the Deep Marshes at night — which, being tier 5, is exactly where
  the player most needs to read stamina. U8 names three worst-case backgrounds rather than
  saying "test on real backgrounds", because "real backgrounds" always means the one the
  developer had open.
- **Accessibility is used to reintroduce the forbidden set.** A legitimate concern ("some
  players cannot read the windup") produces ground telegraph rings (X10), damage numbers, and a
  threat compass. The honest resolution is elsewhere and is already in the corpus: RI-AUD01's
  twelve distinguishable impact classes and RI-AUD05 §C's `effort_heavy` and `exhausted` cues
  are the accessibility answer, because they add a *channel* rather than replacing the enemy
  animation with a floor decal.
- **`getUIState()` becomes the definition of the UI.** Everything registered is measured;
  everything drawn straight to canvas is invisible. Half the HUD ends up unmeasured, passes by
  omission, and the census reports a clean 6 elements on a screen with fourteen. U5's pixel
  probe is the only guard, and it will be the first check dropped for being slow.
- **The boss bar generalises.** E8 exists, works, looks good, and someone reuses it for
  mini-bosses, then for named enemies, then for anything with more than 400 HP. X2 is then
  violated by a component that was legitimately built, and the moment-to-moment fight becomes
  an HP-watching exercise instead of a body-language-reading one.
- **Resolution scaling is a `zoom` on a fixed 1920×1080 layout.** It passes U9's screen-fraction
  check trivially while producing a blurry upscaled bar at 4K — which is RI-UIX06's F17, on the
  fidelity side, and is precisely why the two items are separate. U9 checks *size*; it cannot
  check *sharpness*, and reading it as though it could is the bifurcation failing.

## Seam (AR-3)

**Not sterile, but weakly.** The crossing is E6: S11 splits the affliction economy (Morrowind:
named diseases with in-world causes and cures) from the in-fight buildup meter (Souls). E6 is
the Souls meter, and the disease it fills toward is a Morrowind object with a name, a cause and
a cure that exists in the world — so the same bar that governs a fight is the entry point to a
quest-shaped system. Beyond that this item is largely internal, and a critic should record
`seam_sterile: false` on the strength of E6 alone rather than claim more.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **element set and the forbidden set** are `canonical-recall` of Dark Souls/Elden Ring HUD
composition — bars top-left, finite flask charges, no damage numbers, no nameplates, boss bar
bottom-centre in fog-gated fights only — and are high-confidence as a *set*. The pixel
dimensions in §A are recalled approximations of a 1920×1080 Souls HUD and are the weakest
recalled figures here; they function as ceilings rather than targets, so being wrong by 20%
does not change any verdict.

Everything in §C and §D is **constructed**: the ≤6 persistent / ≤9 total counts, the 4.0% and
6.5% coverage budgets, the empty-centre rule, the ±0.005 same-frame tolerance, the 4.5:1 and
3.0:1 contrast ratios (borrowed in form from WCAG 2.1 AA, which is a text-legibility standard
and is being applied here to a bar — a deliberate over-application, chosen because it is a
published, computable threshold rather than because it is the right one for a health bar), the
8 px minimum height, and the three named worst-case backgrounds.

Confidence is `medium` chiefly because the coverage budgets have not been checked against a
real HUD layout; if the E5 quick-slot cluster is drawn at the recalled 220×220 it alone is 2.4%
of screen and the 4.0% persistent budget becomes tight. That is a plausible early failure of
this item's own numbers rather than of a build, and the first census run should be used to
confirm the budget is achievable before any build is failed on it.

**Harness additions requested:**

```js
getUIState(): {
  mode: 'world'|'dialogue'|'inventory'|'journal'|'book'|'levelup'|'map'|'paused',
  screen: {w, h, dpr},
  elements: [{
    id, kind,                  // kind from a closed vocabulary incl. the X1-X12 names
    rect: [x, y, w, h],        // CSS px
    visible, opacity,
    text: string|null,         // for numeric-text and OCR cross-checks
    fill: number|null,         // 0..1 for bars -- D1 depends on this
    worldAnchor: string|null   // eid if world-anchored (E7 only)
  }],
  coveragePct: number
}
```
plus promotion of the existing optional `setUIVisible` to **mandatory for UI items**
(HARNESS.md §3 tier table), and the `ui-combat` viewpoint set appended to
`tools/harness/viewpoints.json`.
