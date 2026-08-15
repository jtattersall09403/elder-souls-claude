---
id: RI-UIX09
title: Populated density and object iconography — a Morrowind screen is full of drawn things, and nothing in this corpus could fail a screen that is empty of them
kind: number
side: morrowind
judges: [ui.style.diegesis]
provenance: measured
confidence: medium
blind_pair: yes
---

> **Written by a critic, mid-critique, under `CRITIC-DOCTRINE.md` §1.3.** The piece under review
> was `T4` (the Morrowind screens), run 1, 2026-08-14. **It is not the reason that piece passed or
> failed anything** — §1.3's second guard forbids that, and the piece failed on rows that predate
> this file. It is recorded as **owed for the next round**.
>
> **Why it exists, in one sentence.** Our inventory screen and Morrowind's inventory screen score
> **identically** on every row the corpus currently holds, and one of them is a wall of sixty drawn
> objects with a dressed figure in the corner while the other is a text table with one row in it.
>
> **What it does NOT judge, so it does not overlap its neighbours.** The *materials* a panel is made
> of and the *forbidden UI-kit forms* are `RI-UIX06` §A/§B and are cited, not restated. *Rendering
> quality* of whatever is drawn is `RI-UIX06` §D/§E/§F. *Which* items exist and what they weigh is
> `RI-UIX03` §B/§C. *What the journal says* is `RI-DLG05`. This item judges one property only:
> **how much drawn matter is on the screen, and whether the things on it are objects or labels.**

## The bar

**A Morrowind menu is a container of things.** Open the inventory and you are looking at sixty small
painted objects — bottles, hides, hammers, folded clothes, ingots, a coil of rope — arranged in a
grid beside a figure wearing what you have equipped. Open the journal and you are looking at a
double page of dense ink with red date headings and blue links in it. Open the map and it is a
painted terrain. In every case the screen is **full**, and what fills it is **pictures of things**.

Our screens are lists of words. That is not a materials failure — the panels are genuinely reed,
parchment, chitin and clay — and it is not a fidelity failure — the glyphs are crisp and the layout
holds. It is a third thing, and until this file the corpus had no name for it.

**The failure state this item exists to prevent** is the one that has already happened: a screen
that satisfies every structural requirement (categories, weights, sort, detail panel, chronology,
page count) and every style requirement (no bootstrap panel, no system font, no UI blue) and is
still, to look at, **a spreadsheet in a nice frame**. `RI-UIX06`'s §G Bootstrap test cannot catch it,
because "a spreadsheet in a hand-made frame" is not a website and a judge will say so.

### Why the existing rows cannot fail it — the check that shows the hole is real

| Row | What it says | Why an empty screen passes it |
|---|---|---|
| `RI-UIX06` **A6 / AD5** | *"Iconography is **objects**, not pictograms… a drawn stoppered gourd, not a flask glyph"*; AD5's hard fail is a *"pictogram icon set"* | It fires on a **wrong** icon set. A screen with **no** icons has no pictograms, so it passes vacuously. This is the whole hole in one row. |
| `RI-VIS05` **§H** | *"Icons are carved or scrimshawed, never flat-vector"* | A positive obligation with **no count, no threshold and no row in that item's `## Scoring`**. Nothing computes it. |
| `RI-UIX03` **§Comparison method 8** | a blind pair judged on *"density, category breadth…"* | "Density" appears once, inside a judge's prompt, with **no number, no plate path and no scoring row**. It is also explicitly *"structure only"*. |
| `RI-VIS09` **§2** (row added 2026-08-14) | routes `RI-UIX*` to `REF-A12b` *"for bevel, sheen, wear, type, **iconography and populated density**"* | **The only place the phrase "populated density" appears in the corpus, and no item consumes the route.** A road was built to a door nobody has opened. |
| `RI-UIX04` **J2/J9/J10** | entries verbatim, pagination, extent visible | All satisfied by an empty journal showing "1 of 1". |

**Corpus ids checked before declaring the hole** (§1.3's second guard): `RI-UIX01`, `RI-UIX02`,
`RI-UIX03`, `RI-UIX04`, `RI-UIX05`, `RI-UIX06`, `RI-UIX07`, `RI-UIX08`; `RI-VIS01`–`RI-VIS10`;
`RI-WLD06`; `RI-CAM05`; `RI-LOR03`; `RI-JRN04`. None carries a row that a screen with zero drawn
objects fails.

## The reference artifact

**No image is acquired by this item. Every plate it uses is already on disk** and has been since
2026-08-06 — which is itself the finding `RI-UIX08` §0 records.

| Plate | What it establishes |
|---|---|
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-inventory__mw-15538700.jpg` | the inventory as an object grid: ~60 painted items in a 6-row grid, an equipped paper-doll figure at the left, an encumbrance bar, four category tabs |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-inventory__mw-1789640279.jpg` `-650771459` `-768107784` | three more, cross-checking that the grid and the doll are not one capture's accident |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-journal__mw-147283027.jpg` (+2) | the journal as a **full double page**: red date headings, black ink prose, blue inline links, a painted spine, page numbers at the foot |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-character_sheet__mw-*.jpg` ×4 | the sheet as two dense stacked blocks, every attribute and both skill lists on screen at once |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-book_reader__mw-*.jpg` ×4 | the book as a filled page, not a paragraph in a frame |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-tooltip__mw-*.jpg` ×2 | the item tooltip: **a drawn object at the top of it**, then name, weight, value |

**These are `side: morrowind` art-direction references.** A critic citing them must be in an
`ART_DIRECTION` pass (`RI-VIS01` §B, `RI-UIX06`'s bifurcation). **Citing them under `FIDELITY`
voids the verdict**, and nothing in this item is a fidelity claim: *how many drawn objects* is a
design decision, *how sharply they resolve* is `RI-UIX06` F17–F19.

### §A — The two numbers

Measured on a **populated** state — the shipped `game/data/states/ui-journal.json` fixture or any
state with a carried inventory and a started journal — at 1920 × 1080, on the panel's own rect
(the largest `kind: 'panel'` element in `getUIState()`), **not** on the whole frame.

| # | Metric | Definition | Morrowind (measured off the plates above) |
|---|---|---|---|
| **D1** | **Drawn-object count** | number of distinct rendered pictorial elements inside the panel rect — an icon, a painted item, a paper doll, a map, a drawn glyph that stands for a thing. **Text is not a drawn object, and neither is a rule, a bar or a frame.** | inventory ≈ **60**; tooltip **1**; character sheet **0** (correctly: it is a text screen); journal **0** pictorial, but see D2 |
| **D2** | **Panel fill fraction** | fraction of the panel's rect whose pixels differ from the panel's own modal background colour by ΔE > 6 — i.e. how much of the panel has *anything* on it | inventory **0.61**; journal spread **0.48**; character sheet **0.42**; book page **0.44** |

**D2 is the row that carries the journal and the sheet**, which have no icons and are not supposed
to. A Morrowind screen with no pictures on it is still *full*, of text. Ours can be empty of both,
and D2 is the number that says so.

### §B — The requirements

| # | Requirement | Pass | Hard fail |
|---|---|---|---|
| **P1** | **Inventory: items are drawn objects** | every item row carries a rendered depiction of that object, ≥ 32 × 32 CSS px at 1080p; `D1 ≥ 0.8 ×` the number of item rows on screen | **`D1 == 0` on a populated inventory** — the screen names its contents and shows none of them |
| **P2** | **The equipped figure** | the inventory shows what the character is wearing and holding, as a figure or as occupied slots that are drawn rather than labelled | equipped state is legible only as text |
| **P3** | **Quick slots carry objects** | the HUD's quick-slot cluster (`RI-UIX01` E5) draws the item and the spell, not their names | a slot whose only content is a **truncated text label** — the exact defect the T4 run photographed at `crops/world-hud-quickslots-4x.png` |
| **P4** | **Fill** | `D2 ≥ 0.35` on every populated screen | `D2 < 0.15` — a panel that is more than 85% its own blank ground |
| **P5** | **The tooltip / detail panel opens with the thing** | the item-detail panel leads with a depiction, as `REF-A12b-tooltip__*` does | detail panel is text only |
| **P6** | **Objects are drawn, not vectorised** | per `RI-VIS05` §H: carved, painted or scrimshawed forms, one visual family with the world's own materials | flat-vector / material-design glyph set (this is `RI-UIX06` G5 and is restated only so P6 has a floor as well as a ceiling) |

**P4 is deliberately low.** 0.35 is *half* Morrowind's inventory and below its sheet. This item is
not asking for clutter; it is asking that a screen not be mostly nothing. A build that fills a panel
to 0.9 has made a different mistake and `RI-UIX06` A2/G1 already owns it.

## Comparison method

1. **Capture populated.** `node tools/harness/critic-t4-lean.mjs --state ui-journal` (or any tool
   that boots `states/ui-journal.json`) and photograph inventory, journal, sheet, book, container
   and the world HUD at 1920 × 1080, DPR 1. **An empty state is not a sample**: the first T4 run
   photographed a journal with nothing in it and a one-item inventory, and every density question is
   unanswerable on those frames.
2. **D1, declared.** From `getUIState().elements` inside the panel rect, count elements whose kind
   is pictorial (`icon`, `item_icon`, `doll`, `portrait`, `map_terrain`, `glyph_object`, …). Record
   the kind vocabulary you counted, because a build with no such kinds at all must report **0** and
   not "not applicable".
3. **D1, observed.** The declared count is a self-report. Crop the panel, and for each item row
   assert that the row's leading 48 px contains a region of ≥ 3 distinct hues that is not glyph
   ink. A build that draws icons straight to canvas without registering elements passes 3 and fails
   2; a build that registers icon elements and draws nothing fails 3 and passes 2. **Report both.**
4. **D2.** Modal colour of the panel rect, then the ΔE > 6 fraction. `tools/ui/critic-t4-palette.mjs`
   already does the quantisation half.
5. **Blind pair (`blind_pair: yes`).** Our populated inventory against
   `REF-A12b-inventory__mw-15538700.jpg`, both cropped to the panel, both downscaled to the same
   width, attribution stripped. **Question, written before looking:** *"One of these two screens is
   showing you the things you are carrying. Which one, and how do you know?"* An answer that names
   ours is a genuine pass on this item; `BOTH` is the interesting failure and means our text list is
   doing the work; naming the reference is the expected wave-1 result.
6. **Do not run the §G Bootstrap test in place of this.** `RI-UIX06` §G crops the world out and asks
   whether the panel is a UI kit. It is a different question and it passes a sparse screen.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| DN1 | P1 inventory objects | `D1 ≥ 0.8 ×` rows | `D1 == 0` on a populated inventory |
| DN2 | P2 equipped figure | present and drawn | text only |
| DN3 | P3 quick slots | objects | truncated text label |
| DN4 | P4 fill, worst screen | `D2 ≥ 0.35` | `D2 < 0.15` |
| DN5 | P5 detail panel | leads with a depiction | text only |
| DN6 | P6 object family | carved/painted, one family | flat-vector set |
| DN7 | Blind pair (method 5) | judge names ours, or `BOTH` | judge names the reference |

Native **/7**. Any hard fail caps the item at **2**. **Unimplemented scores 0** — a build with no
drawn objects anywhere in its interface scores 0 here, and that is the intended reading, not a
harshness.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 7, no hard fail | 6 / 7, no hard fail | 7 / 7 with DN7 passed |

**Aggregation (a property of this item):** count of passing checks; any hard fail caps at 2.

**What we lose looks like** — and this is the T4 run's own measurement, recorded here as the
worked example rather than invented:

```
DN1 inventory, populated: 29 declared elements, 0 pictorial. D1 = 0.      HARD FAIL
DN3 quick slots: four empty plates; the spell slot reads "Spark-Da...".   HARD FAIL
DN5 detail panel: name, weight, gold, condition, prose. No depiction.
=> 0/7, capped at 2. Every RI-UIX03 structural row passed on the same frame.
```

## How we lose

- **This item is written and then read as "add icons".** It is not. D2 exists so that the journal
  and the character sheet — which have no icons in Morrowind either — are still judged on whether
  they are *full*. A build that bolts a flat-vector icon set onto the item list satisfies DN1 and
  fails DN6, and has made the screen worse.
- **D1 is scored off `getUIState()` alone.** Every UI item in this corpus has the same weakness and
  `RI-UIX01` §B states it in terms: a self-report cannot see a canvas draw. Method step 3 is the
  observed half and it is the one that will be dropped for being slow.
- **The plates are cited for the wrong axis.** They are Morrowind captures. Citing them while
  judging *rendering quality* is a bifurcation violation and voids the verdict (`RI-VIS01` §B).
  This item's whole subject is a design decision, and the sentence to keep saying is: *how many
  drawn things, not how sharply they resolve.*
- **Someone measures D2 on the whole frame** instead of the panel rect, the visible world behind a
  translucent panel fills it, and every screen passes. The rect is `getUIState()`'s own and there is
  no reason to use another.
- **It is measured on an empty save.** The T4 run's first pass photographed a one-item inventory and
  a zero-entry journal, on which D1 and D2 are both meaningless. `states/ui-journal.json` exists
  precisely for this and had never been used by any UI measurement before that run.

## Seam (AR-3)

**Sterile.** Nothing here crosses the Souls/Morrowind line: the quick-slot cluster in P3 is a Souls
element (`RI-UIX01` E5) and this item asks only that what is *in* it be drawn rather than named,
which is a presentation property both traditions share. `RI-UIX07` W4 separately asks for condition
and charge marks inside the same rect; the two do not conflict and should be built together.

## Provenance note

`provenance: measured`, `confidence: medium`.

**`measured` is claimed for §A's Morrowind column only.** The counts and fill fractions are read off
the six named plates in `corpus/70-visual/refs/morrowind/REF-A12b/`, which `RI-VIS09` §2 already
authorises `RI-UIX*` to cite for *"iconography and populated density"* — this item is the consumer
that route was missing. `pixel_metrics_valid: false` holds for that folder, so **the fill fractions
are stated to two decimals and must not be treated as photometry**; they are area counts on
JPEG-compressed captures and the honest tolerance on them is ±0.05. D1 counts are integers off
visual inspection and are robust to that.

**Everything in §B is constructed**: the 32 × 32 px floor, the `0.8 ×` ratio, `D2 ≥ 0.35`, and the
`D2 < 0.15` hard fail. **The number to challenge is 0.35.** It was chosen as *half of Morrowind's
inventory*, deliberately far below the reference, so that this item cannot be the thing that fails
a build on a matter of taste; the hard fail at 0.15 is the number that does real work and it sits
below anything either reference set produces. *Reversible: the evidence that would overturn 0.35 is
a build measuring 0.30 that the played gate in `RI-UIX07` §G reports as full rather than sparse.*

**`confidence: medium`, and the reason is stated so a critic does not have to find it:** DN7's blind
pair has never been run, and DN1's hard fail is the only check here with a demonstrated instance.
The rest are derivations from five plates and one build.

**Harness additions requested:** a pictorial-kind vocabulary in `getUIState().elements[].kind`
(`item_icon`, `doll`, `glyph_object`) so method step 2 has something to count, and
`getUIState().panel_rect` so step 4 does not have to re-derive the panel from the element list.
