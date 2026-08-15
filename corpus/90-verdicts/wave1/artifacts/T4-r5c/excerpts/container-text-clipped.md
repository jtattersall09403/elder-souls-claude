# `T4` round 5 critic — verbatim text that the container screen declares and does not render

All quotations are at commit `76cd4848` (`HEAD` when captured), viewport **1920×1080**, DPR 1,
state fixture `game/data/states/ui-journal.json`, container opened with the three-item
`Reed Creel` opener that `tools/ui/t4-r2-measure.mjs` ships.

Captures: `../measure/screens/head-container__1920x1080.png` (LIVE, `frame-liveness.mjs`
`{"LIVE":8}` over the whole sweep — `../reports/frame-liveness-head.txt`).
Crops: `../crops/container-panel-3x.png`, `../crops/container-desc-tail-5x.png`,
`../crops/container-blackwater-8x.png`.

---

## 1. The item description is cut mid-sentence, with no ellipsis — ten words lost

**Source data**, `game/data/items/carried.json:426`:

> "description": "A palm-sized disc of Hist bark with three notches in the rim. Everyone who sees it knows what it means and nobody has yet explained it to you."

**Declared by the running build**, `getUIState()` element `container.band`, read out of
`../measure/measure-head-1920x1080.json` → `screens.container.texts`:

> container.band :: "A palm-sized disc of Hist bark with three notches in the rim. Everyone who sees it knows what it means and nobody has yet explained it to you."

**Rendered on screen** (`../crops/container-desc-tail-5x.png`, 5×), the last line drawn is:

> who sees it knows what it means

`and nobody has yet explained it to you.` is drawn nowhere in the frame — not below the last
line, not over the foot hint, not outside the panel. There is no ellipsis and nothing on screen
tells the player the sentence continues.

**Diagnosis** (`CRITIC-DOCTRINE` §1.1, permitted use 3 — making the remedy concrete, after the
defect was demonstrated from output). `game/src/ui/screens/inventory.js:329` declares
`container.band` with `rect: [ix + 160*s, by, iw - 160*s, bh]`, and
`game/src/ui/surface.js:299` states the rule the clip obeys: *"The declared rect IS the clip. An
element cannot paint outside what it declared."* `inventory.js:354` then calls
`writeLines(c, wrap(csel.description || '', f, size, r[2] * 0.94), r[0], r[1] + 106*s, …)`, which
has no line cap and no ellipsis (`game/src/ui/type.js:221-229`). The fourth wrapped line is
therefore emitted below `by + bh` and discarded by the element's own clip.

---

## 2. The gold column is drawn outside its row's rect and clipped away on every row, both sides

**Declared**, same manifest, `screens.container.texts` — `row()` joins its columns with two
spaces, so the third field in each string is the gold value:

> container.mine.row.hist-bark-token :: "Bark token  0.1  —"
> container.mine.row.black-water-draught :: "Black-water draught  0.4  30"
> container.mine.row.bog-iron-maul :: "Bog-iron maul  11.5  96"
> container.mine.row.boiled-hide-jack :: "Boiled hide jack  4.2  55"
> container.theirs.row.bog-iron-maul :: "Bog-iron maul  11.5  96"
> container.theirs.row.reed-cutter :: "Reed-cutter  3.0  42"
> container.theirs.row.rootweave-cowl :: "Rootweave cowl  0.6  18"

**Rendered** (`../crops/container-panel-3x.png` at 3×, `../crops/container-blackwater-8x.png` at
8×): every row draws its icon, its name and its weight, and **no row draws a gold value** — on
either side of the transfer. Seven rows declare a value column; zero render one.

**Diagnosis.** `inventory.js:296-300` lays the three columns out as `0.60 / 0.19 / 0.19` of
`half`, starting at an inset of `ICON + 10 = 38` units (`inventory.js:65`,
`chrome.js:300`), inside a row rect whose width is `half - 16`. At this box `half = 198`, so the
columns end at `38 + 118.8 + 37.6 + 37.6 = 232` units against a rect 182 units wide: the gold
column *begins* at 194.4, past the rect's own right edge, and `surface.js`'s clip removes all of
it. The `0.60/0.19/0.19` fractions sum to 0.98 of `half` and take no account of the inset that
`row()` adds before the first column, which is what makes them overflow.

---

## 3. Two quest-index names and one carried-item name are ellipsised (reported, NOT scored as clipping)

`../crops/journal-panel-plus-margin-2x.png` shows the journal's quest index rendering
`The Reading of the ...` and `The Count of the Dr...` against the declared
`The Reading of the Count` / `The Count of the Drowned` (manifest `screens.journal.texts`), and
`../crops/container-blackwater-8x.png` shows `Black-water dr...` against
`Black-water draught`.

**These are recorded and deliberately NOT counted under `RI-UIX06` M-F18.1.** `ellipsise()`
(`chrome.js:304`) shortens the string *before* drawing, so the rendered text's bounding box does
**not** exceed its container — which is what M-F18.1 measures. Round 4's verdict bundled these
with real clipping; that bundling is corrected here in the build's favour. `RI-UIX04` J4/J5 place
no untruncated-name requirement on the quest index, and `RI-UIX09` DN3's truncation clause is
scoped to the quick-slot cluster. Nothing in the seven items handed to this critique fails an
ellipsised list name, and that is a hole worth someone's attention, not a score.
