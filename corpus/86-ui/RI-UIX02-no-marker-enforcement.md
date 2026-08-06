---
id: RI-UIX02
title: No-marker enforcement — the automated detector for S8
kind: structure
side: morrowind
judges: [ui.hud.minimalism, journal.navigation.nomarkers]
provenance: constructed
confidence: high
blind_pair: no
---

> **ARBITRATION: this item is `morrowind`.** Seam **S8** is settled and is not re-litigated
> here: *no compass markers, no objective arrows, directions are given in prose.* A marker on
> screen is **AR-2 leakage** (a Souls/modern convention contaminating the world) and is an
> automatic fail of the piece.
>
> **Scope, stated so this item does not overlap its neighbours.** `RI-WLD06` owns the
> *positive* obligations that make markerlessness survivable — landmark sightlines, signposted
> junctions, prose-direction grammar — and `RI-DLG05` owns the journal's prose and its
> no-marker rule as *text*. **This item owns the enforcement mechanism only**: the automated
> detectors that catch a marker that has appeared anyway. It adds no design requirement and
> removes none. It fills the `ui.hud.minimalism` corpus hole.

## The bar

S8 is the ruling most likely to be violated by accident, and the least likely to be violated
visibly. Nobody will add a quest arrow on purpose. What will happen is smaller and harder to
see: a debug marker left enabled in a release path; a "nearest objective" indicator added to
help a playtester who got lost; a `target_pos` field added to a quest record because the code
needed somewhere to put the destination, which then becomes trivially available to any UI that
wants it; a compass added "just for cardinal direction, not for objectives" which then acquires
a single tick for the active quest.

The bar is therefore not "we agreed not to add markers". The bar is that **a marker cannot
survive one wave undetected**, via three detectors that fail in different ways and so cannot all
be defeated by the same mistake:

1. a **pixel** detector, which does not care whether the marker was registered as a UI element;
2. a **data** detector, which catches a marker before it is drawn, at the point where a quest
   acquires a coordinate the HUD could consume;
3. a **differential** detector, which catches anything on screen that changes when quest state
   changes and nothing else does — which is the definition of an objective marker, regardless of
   what it looks like.

Detector 3 is the one that matters most and it is the cheapest of the three.

## The reference artifact

### §A — What counts as a marker (closed definition)

A **marker** is any on-screen element with **either** of these properties:

- **M-def-1 (world-tracked):** its screen position is a function of a world position — it moves
  when the camera yaws, translates or the player walks, in a way that keeps it visually
  associated with a place or entity.
- **M-def-2 (quest-conditioned):** its presence, position, text or appearance is a function of
  quest state — it appears, moves or changes when a quest stage advances.

**Exemptions, exhaustive.** Exactly four elements may satisfy M-def-1, and none may satisfy
M-def-2:

| Exempt | Why |
|---|---|
| The lock-on reticle (RI-UIX01 E7) | inside the fight; Souls-authoritative; targets an entity the player has explicitly selected |
| Interact prompts on an in-range interactable (RI-UIX01 E10) | range-gated, not destination-bearing; ≤ interaction range |
| Diegetic world objects rendered in 3D (signposts, milestones, cairns, lit windows) | these are **the world**, not UI — RI-WLD06 L2. A signpost is a mesh with a texture, not a screen-space element |
| Status buildup meters (RI-UIX01 E6) | screen-space fixed, not world-tracked; listed only because they appear conditionally and a naive detector flags them |

Anything else satisfying either definition is a violation.

**Not a marker, and must not be flagged:** the 3D world itself. A quest destination that is
*visible because it is a tower* is RI-WLD06 working correctly. The distinction is
screen-space overlay vs. world geometry, and detector 1 draws the line at the UI layer.

### §B — Forbidden data shapes

`game/data/quests/**.json` and `game/data/dialogue/**.json` may reference destinations **only by
id**: `poi_id`, `settlement_id`, `interior_id`, `npc_id`, `region_id`. Those ids resolve to
positions in `game/data/world/` — that is legitimate and necessary, because the world must place
things.

What is forbidden is a **coordinate on the quest record**, because a coordinate on a quest
record has exactly one plausible consumer.

| # | Forbidden in quest/dialogue/journal data | Rationale |
|---|---|---|
| F1 | Any key matching `/^(marker|waypoint|pin|map_pin|objective_pos|target_pos|hud_.*)$/i` | named for its destination |
| F2 | Any numeric triple/pair under a key matching `/(pos|coord|location|xyz|latlon)/i` | a coordinate by shape |
| F3 | Any bare `x`/`y`/`z` sibling triple inside a quest stage | ditto |
| F4 | `compass_bearing`, `distance_m`, `direction_deg` on a quest stage | a bearing is a marker with fewer pixels |
| F5 | A journal entry string containing a coordinate-shaped substring (`/\(?\s*-?\d{3,5}\s*,\s*-?\d{3,5}\s*\)?/`) | the journal is prose (RI-DLG05); "go to (2752, 425)" is a marker in a sentence |

**F4 is the sly one.** "The shrine is 400 m north-east" on the *quest record* is a HUD feed. The
same sentence written by the character in a journal entry — "she said it was a half-morning's
walk with the black water on my left" — is RI-DLG05's prose direction and is required. The
difference is a machine-readable field versus authored text, and F4 is scoped to fields.

### §C — Detector 1: the pixel sweep

Detects markers that were never registered with `getUIState()` — i.e. anything drawn straight to
the canvas, which is how a debug marker is drawn.

```
For each of the 8 ui-combat + 6 ui-world viewpoints:
  a) capture with setUIVisible(true)   -> A.png
  b) capture with setUIVisible(false)  -> B.png
  c) UI_LAYER = A - B                  (the exact set of pixels the UI owns)
  d) connected-component label UI_LAYER; each component is a candidate element
  e) reconcile against getUIState().elements rects
     -> any component not covered by a declared rect is an UNDECLARED ELEMENT
```

An undeclared element is not automatically a marker, but it is automatically a **finding**, and
it must be identified before the wave can pass. The reconciliation step is what makes the
`getUIState()` self-report trustworthy: a game cannot hide a marker by not declaring it, because
the pixels are differenced independently.

**Shape lint (advisory only).** Over `UI_LAYER`, flag components whose contour is a chevron,
triangle, diamond, teardrop-pin or ring-with-dot at ≥0.8 template correlation. This is a
tripwire, not a judge (RI-VIS01 §C's "the lint becomes the judge" failure applies verbatim): a
marker shaped like a chitin sigil defeats it, and a legitimate chevron in a menu trips it.

### §D — Detector 2: the data scan

```bash
node tools/analysis/marker-scan.mjs game/data/
# exits 1 on any F1-F5 hit, prints file:jsonpath:key
```

Runs with no browser, in under a second, and is the cheapest of the three. It should be a
**blocking CI gate**, in the same class as `node tools/corpus-index.mjs --check`.

### §E — Detector 3: the quest-state differential (the important one)

This is the detector that catches a marker of *any* appearance, including one deliberately
disguised, and it catches nothing else.

```
Pin everything that is not quest state:
  reset(seed=1337); teleport(P); camera(fixed pose); setTimeOfDay(13); setWeather('clear')
  stepFrames(24)                                   # settle

  loadState('quest_none')     -> stepFrames(24) -> shot_A.png, uiA = getUIState()
  loadState('quest_stage_3')  -> stepFrames(24) -> shot_B.png, uiB = getUIState()
  loadState('quest_stage_7')  -> stepFrames(24) -> shot_C.png, uiC = getUIState()

  D_AB = pixel_diff(shot_A, shot_B) restricted to UI_LAYER
  D_AC = pixel_diff(shot_A, shot_C) restricted to UI_LAYER
```

**Any non-empty `D` in the UI layer is a quest-conditioned on-screen element** (M-def-2) and is a
violation, with exactly two permitted exceptions, which must be declared and are checked
positively:

- the **journal screen itself**, when `getUIState().mode == 'journal'` (RI-UIX04) — the journal
  is *supposed* to change with quest state; that is what it is for;
- a **transient toast** (RI-UIX01 E11) at the frame a stage advances, which must be absent 180
  frames later. The differential is taken 24 frames after a settled load, so a correctly
  transient toast is already gone.

The world may differ between A, B and C — an NPC moved, a door opened, a corpse exists. That is
quest state changing the world, which is the game working. The restriction to `UI_LAYER` is what
separates "the world reflects the quest" from "the HUD tells you about the quest".

**Camera-yaw sweep (M-def-1).** With one quest state fixed, sweep the camera yaw 0°→360° in 24
steps, capturing `getUIState()` at each. Any element whose `rect` centre moves by >2 px across
the sweep, and which is not one of the four §A exemptions, is world-tracked and is a violation.

### §F — The compass question, settled

A compass is banned (RI-UIX01 X6, S8), and the argument for a "bare" compass — cardinal
direction only, no objective ticks — will be made, because it is genuinely useful and genuinely
not an objective marker. It is still banned, for a reason that is about failure modes rather
than purity: a compass strip is the *mount point*. Every objective marker in every game that has
one is a tick on a compass, and a compass with no ticks is one merge away from a compass with
ticks — whereas a game with no compass has nowhere to put them.

The permitted substitute is **diegetic and in the world**: the sun and the moons, the salt-storm
always coming from the west, the Border Falls audible from a distance (RI-AUD03 R7), a
carried compass *item* readable in the inventory screen (RI-UIX03) rather than on the HUD. That
last one is the honest compromise and it is allowed: an item you must stop and look at is not a
HUD element.

## Comparison method

1. **Data scan first** — it is free and it fails fastest.
   ```bash
   node tools/analysis/marker-scan.mjs game/data/ --json > reports/marker-scan.json
   ```

2. **Capture the UI layer** across the fourteen viewpoints:
   ```bash
   node tools/harness/run-headless.mjs --scenario ui-sweep --seed 1337 --ui-state
   node tools/analysis/ui-layer.mjs --run reports/runs/<runId> \
        --viewpoints ui-combat,ui-world --out reports/runs/<runId>/ui-layer
   ```
   `ui-layer.mjs` performs §C steps (a)–(e) and emits `undeclared_components[]` with bounding
   boxes and PNG crops. The crops are the artifact a verdict cites — a bounding box is not
   evidence, a picture of the thing is.

3. **Quest-state differential** (§E). Requires three named scenario states per tested quest.
   Test **≥5 quests**, chosen to include the main quest and at least two faction quests, and at
   least one quest whose destination the player has not yet visited (the case where a marker is
   most tempting).
   ```bash
   node tools/analysis/marker-diff.mjs --quests mq01,mq04,fac_shad02,fac_leg01,side_lilmoth03 \
        --run reports/runs/<runId>
   ```

4. **Camera-yaw sweep** (§E, M-def-1) at three positions: a settlement street, an open marsh
   vista, and inside a dungeon.

5. **Journal and dialogue text scan** (F5) — run over the *rendered* journal too, not only the
   source data, because a coordinate can be interpolated at render time:
   ```bash
   node tools/corpus/dump-journal.mjs --run reports/runs/<runId> | \
     grep -nE '\(?\s*-?[0-9]{3,5}\s*,\s*-?[0-9]{3,5}\s*\)?' && echo "F5 HIT"
   ```

6. **Record the negative result explicitly.** A verdict on this item must state the number of
   viewpoints swept, quests differentialled and files scanned. "No markers found" with no counts
   is not a result — it is indistinguishable from not having run the detectors, which is the
   most likely way this item silently stops working.

## Scoring

This item is a **gate**, not a dimension. It is scored `min()`, not averaged, and its native
scale is pass/fail per detector.

| ID | Detector | Pass | Fail |
|---|---|---|---|
| K1 | Data scan (§B/§D) | 0 hits on F1–F5 across all of `game/data/` | ≥1 hit |
| K2 | Undeclared UI components (§C) | 0 unreconciled components, or all identified and benign with crops in the verdict | ≥1 unidentified component |
| K3 | Quest-state differential (§E) | `D` empty in the UI layer for all 5 quests, outside the two declared exceptions | any non-empty `D` |
| K4 | Camera-yaw sweep (M-def-1) | 0 non-exempt world-tracked elements | ≥1 |
| K5 | Rendered journal/dialogue text (F5) | 0 coordinate-shaped substrings | ≥1 |
| K6 | Coverage of the run itself | ≥14 viewpoints, ≥5 quests, full `game/data/` scan, counts recorded | any detector not run, or counts not recorded |

**All six must pass.** Native verdict is binary:

- **PASS** → this item does not raise any score; it removes a cap. Ladder translation: not
  scored on the 0–10 ladder at all (it is a gate). Record `S8_enforced: true`.
- **FAIL on K1, K2, K4, K5, or K6** → the piece is **below bar, remedy required**, ceiling 6.
- **FAIL on K3** → a quest-conditioned on-screen element exists. This is a marker by definition.
  **AR-2 automatic fail of the piece** (ARBITRATION §3), score capped at 2, and the wave's
  `ui.hud.minimalism` score is 0.

**Unimplemented scores 0.** If the detectors cannot be run — `getUIState()` absent, no named
quest states to load, `setUIVisible` missing — then S8 compliance is **unmeasurable**, which per
SCORING §1.1 is **0**, and the correct verdict is not "probably fine, we didn't see any
markers". A build that cannot be checked for markers is scored as though it has them.

**What we lose looks like:**
```
K1 marker-scan: game/data/quests/mq04.json  stages[2].target_pos = [2752.5, 0, 425.0]
                game/data/quests/fac_leg01.json  stages[0].compass_bearing = 47
K3 marker-diff mq04: D_AB non-empty, 412 px, bbox [948,38,24,24], top-centre
   crop: a small chevron. Not present in getUIState(). Not in any menu.
K2 undeclared component at [948,38,24,24] -- same object
=> AR-2 automatic fail. Capped at 2.  The chevron was added in wave 2 "for
   playtesting" behind a flag whose default was flipped in wave 3.
```

## How we lose

- **The detectors are never built.** By far the most likely failure of this item, and it is a
  failure of the item rather than of the game. `marker-scan.mjs`, `ui-layer.mjs` and
  `marker-diff.mjs` are all owed and none exist. Until they do, K6 fails and this item scores 0
  — which is correct and should be visible in the wave roll-up rather than quietly excused as
  tooling debt.
- **"No markers found" without counts.** A critic writes the sentence, means it honestly, and has
  run nothing. K6 exists solely to make that verdict invalid, and it is the check most likely to
  be treated as bureaucratic.
- **The debug marker ships.** A world-space debug overlay is added in week one, gated behind
  `?debug=1`, and then someone needs it in a normal build to reproduce a bug and inverts the
  default. It is drawn straight to canvas so `getUIState()` never sees it. Only §C's pixel
  difference catches it, and §C is the slowest detector.
- **The coordinate arrives before the marker does.** `target_pos` is added to a quest record
  because the quest system needs to know where the destination is. No marker is drawn. The scan
  fires anyway and is dismissed as a false positive — "there's no UI reading it". Six weeks
  later there is. §B is deliberately strict at the *data* layer for this reason: the id-only
  rule costs a lookup and removes the mount point entirely.
- **The compass returns as a "direction indicator".** Renamed, defended as not-an-objective-
  marker, and correct on its own terms. §F is the pre-decided answer; the substitute (a compass
  *item* in the inventory) is offered so that the legitimate need has somewhere to go.
- **A marker is added to fix a genuine navigation failure.** Playtesters get lost, and the
  cheapest fix is an arrow. This is the honest version of the failure and it deserves an honest
  answer: getting lost means RI-WLD06's L1/L2/L3 obligations are unmet — no landmark visible, no
  signpost at the junction, or a journal entry that does not describe a route. The remedy is a
  landmark or a signpost, and a marker added here is a **defect being papered over in a
  different subsystem**. A verdict that fails K3 should check RI-WLD06's M27–M30 in the same
  wave, because the two failures will be the same failure.
- **The differential is run against a quest whose destination the player has already been
  told about in prose**, so nothing changes on screen and it passes trivially. The test set must
  include a quest with an unvisited destination — that is when a marker is worth adding, and so
  that is when it exists.

## Provenance note

`provenance: constructed`, `confidence: high`.

Nothing here is recalled. S8 is doctrine (ARBITRATION §2) and RI-WLD06 already carries the
positive obligations; this item constructs the enforcement layer only. Confidence is `high`
because every check is structural rather than threshold-dependent — K1, K3, K4 and K5 have no
tunable numbers at all, and the only tunables in the file (the ≥14 viewpoints, ≥5 quests, the
2 px yaw-sweep tolerance, the 0.8 template correlation on the advisory shape lint) do not change
any verdict's direction if they are wrong by a factor of two.

The §E quest-state differential is the one genuinely novel construction here and is worth
flagging for scrutiny: it is a strong detector precisely because it defines a marker by its
*behaviour* rather than its appearance, which is the only definition that survives someone
deliberately disguising one. Its weakness is that it requires named scenario states per quest
stage (`loadState('quest_stage_3')`), which is a real burden on the quest builder and is not
currently in the HARNESS.md scenario list.

**Harness additions requested:** `getUIState()` (see RI-UIX01), promotion of `setUIVisible` to
mandatory-for-UI-items, the `ui-combat` and `ui-world` viewpoint sets in
`tools/harness/viewpoints.json`, and — the burden noted above — **named per-quest-stage scenario
states loadable via `loadState()`**, without which §E cannot run and K3 cannot be scored.
