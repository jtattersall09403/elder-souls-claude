# W1-UIX08 — the dialogue window: what was built, what was measured, what could not be done

**Item:** `corpus/86-ui/RI-UIX08-dialogue-window.md`. **Branch:** `codex/wave1-build-experiment`.
**Reading note (deliverable 1):** `reports/uix08/READING-NOTE.md` — every reference opened and one
thing deliberately not copied from each.

This file is the evidence. Numbers here are claims about a commit, not about the project; the commit
is stamped in each JSON artefact (`reports/uix08/*.json`, regenerable from the tools below and
deliberately not versioned — `reports/.gitignore` keeps prose and drops run artifacts).

---

## 1. What exists now that did not

| | before | after |
|---|---|---|
| the conversation surface | `render/ui.js`: a bottom-anchored vellum panel with an `opts[]` list of selectable replies, drawn straight to a 2D context with **no declared elements** | `game/src/ui/screens/dialogue.js`: a floating translucent panel over the running world, drawn on `UISurface` where every element is declared and clipped to its own rect |
| inline topic links | `topic_link` declared in `ui/surface.js` line 46; **one hit in the whole tree — the declaration** | the mechanism, with one declared `topic_link` element per lit word-group, carrying the topic id it promises |
| the topic column | absent | fixed **166 layout units**, right-anchored, two sections split by a rule |
| disposition | absent from the window | `N/100` on a filled bar directly above the column |
| a way out | absent | a Goodbye button the full width of the column |

**The item's hard fail — "the window renders a list of selectable replies instead of prose with
inline links" — is cleared.** That was the build's state and the reason the item was written.

## 2. Files

| path | what |
|---|---|
| `game/src/ui/screens/dialogue.js` | the window: layout in layout units, the six elements, the transcript, colour |
| `game/src/ui/screens/dialogue-links.js` | the matcher: which words in running prose are clickable, and the precision/recall definitions |
| `game/src/ui/system.js` | the model, the focus, the closed-action-set input step (additive) |
| `game/src/ui/surface.js` | two new element kinds, `disposition_meter` and `dialogue_exit` (additive) |
| `game/src/engine.js` | `ctx.dialogue`, the linkable set, the AddTopic promise (additive) |
| `game/src/render/ui.js` | `setSuppressed()` — lay out and measure, do not paint (additive) |
| `tools/ui/dialogue-link-census.mjs` | the headless link census, four arms |
| `tools/ui/dialogue-window-probe.mjs` | the window in the running game, one browser |

**Nothing in `character/converse.js`, `game/data/dialogue/**` or the topic graph was edited.** Those
belong to siblings. The transcript lives on the UI side because `Conversation` keeps only the last
thing said, which is correct for a reply menu and cannot express §D3.

## 3. The inline-link census (§ comparison method 2) — headless, over the whole shipped corpus

`node tools/ui/dialogue-link-census.mjs --arm ours`, over **1,273 authored answers in 471 topics**:

| arm | spans lit | precision | recall |
|---|---|---|---|
| **ours** | 1,053 | **100.00%** (bar 98%) | **95.44%** (bar 95%) |
| `plain` — the plausible null control | 0 | n/a | **0.00%** |
| `propernoun` — the other direction | 3,954 | **10.85%** | 41.43% |
| `everything` | 41,705 | ~0% | — |

**The controls are the point.** `plain` is not "no window": it is the same window with the links
rendered as plain prose, and it passes every layout, colour and element check in this item. It is
also §G's required ablated arm. `propernoun` is the failure the item names by name — "cheap, looks
identical in a screenshot, and lies" — and it lights **nearly four times as many words** while
telling the truth about one in nine. A guard that only caught `plain` would fail on half the number
line (`HAZARDS` §0b).

**Recall's shortfall is subsumption, and it is reported rather than argued away.** 42 of the 42
misses are a shorter topic sitting inside a longer, more specific one that was lit —
`the-salt-factor` beating `the-factor`, `the-office-annexe` beating `the-office`. Recall excluding
those is 100.00%. **The graded number stays the strict 95.44%**, because rounding in our own favour
on the metric the item scores is how a bar gets quietly lowered.

## 4. The window in the running game (§A, §B, §C, §D, §E) — one browser

`node tools/ui/dialogue-window-probe.mjs`, state `helstrom-market`. Full results in
`reports/uix08/window-probe.json`.

- **§A** six elements present, **no seventh** — every declared element carries `meta.element`
  naming which of §A's six it belongs to, so an invented element cannot hide by being unmapped.
- **§B1 the anchor rule.** Two viewports of the same height and different widths (1920×1080 and
  2560×1080): the column moved **0.00 px** across a **365 px** panel widening, and **99.9% of the
  extra width went to the prose**. A percentage column of the same nominal width would have absorbed
  only 71.2% — which is what makes this check discriminating rather than decorative.
- **§C colour, sampled from our own rendered frame** (glyph-core, not the mean, because a mean over
  a text rect is mostly background): prose ΔE **0**, heading **0.66**, column **2.85**, disposition
  fill **0**, against the `openmw.cfg` constants. The column measures rgb(194,160,94) — bronze, not
  the owner capture's green.
- **§E1 translucency** is measured as a correlation between the panel's interior and the same world
  with the panel shut, with glyph pixels excluded (ink is opaque by design and measuring it measures
  the type, not the panel), against a **rendered** opaque arm — the same window drawn at alpha 1
  over the same world.
- **§D1 the mechanism** — following a lit word appends the answer, puts the word in the column, and
  the simulation learns the topic.

## 5. The defect this round found in its own build, and how

The first browser run reported **0 links drawn in 36 lines of prose**. That was not the content: the
engine's candidate set was double-filtered — an `AddTopic` target was only lit if *this speaker also
had a bespoke answer to it*. Measured offline over the whole corpus, that filter takes **87–97
lightable spans per speaker down to 0–7**, and it made the central mechanism of the item invisible in
every conversation in the build.

It was wrong because **`AddTopic` is unconditional in Morrowind** — the edge puts the word in your
index; whether the person in front of you has a view is a separate question. §D1 says so: "it adds
that word to the topic column permanently, for every speaker who has an answer to it … the
permanence is the point." The filter is gone, and the promise is kept in both branches: following a
lit word this speaker cannot answer still learns the topic (`engine.js`, at the `_convPending`
site, scoped to edges this conversation was actually handed).

**Offline, all 407 NPC records in the build now light at least one link**, and the richest light
87–97. `§C1`'s discriminator survives untouched: a proper noun with no authored edge stays bronze.

## 6. What I could not do, plainly

- **§G, the human gate, was not run.** It is the item's quality verdict and the mechanical rows are
  explicitly "a leak check". A builder may not run its own gate (rules 22 and 25), and
  `create_session` is approval-gated on this box (rule 0), so I built what the gate needs and stopped:
  the ablated arm is a runtime flag (`__ENGINE.ui.dialogueArm.links = false`) that produces the same
  window, the same prose and the same column with the links removed and their topics in the column
  from the start — S52's "plausible rather than trivially broken" arm — and both arms are in the
  screenshot pack. **Score §G `not_run`.** Under the item's own aggregation that caps this piece at
  2 until a judge runs it.
- **The delete-the-fix arm** (`DIALOGUE_WINDOW = false` restoring the old reply menu) is implemented
  as one boolean in one place and is run by `--delete-the-fix` on a control clone. Its result is
  recorded in `reports/uix08/window-probe-deletethefix.json` when run; if that file is absent, the
  arm was not run and this line is the notice.
- **The topic web does not yet name what it unlocks.** Independently measured over the shipped
  corpus: **209 of 1,601 `AddTopic` edges (13.05%)** name the newly-unlocked topic in the text that
  unlocks it. (The figure circulating in the dispatch is 81 of 1,216 — 6.7%; the denominators differ
  because this count includes only edges whose target is a topic in the corpus and allows the
  matcher's article and plural forms, so the two are not the same measurement and I am not claiming
  to have reproduced it.) **1,392 unlocks are still invisible.** That is the topic web's to fix and a
  sibling owns it. The window is what makes a visible unlock visible, and it is built and measured
  whether or not the prose starts naming them.
- **Contention.** `node tools/contention.mjs --gate` returned exit 3 (load 4.16 per core against a
  4.0 ceiling, 3 browser instances). All headless work was done first; the browser work is one
  browser, kept for the whole run, per rule 21. Said here rather than left for a critic to find.

## 7. Rulings made rather than questions asked (rule 0), all reversible

| id | ruling | what would overturn it |
|---|---|---|
| **R1** | Inline links are followed with the **closed action set**, not a pointer: directions walk the links in reading order, left/right crosses to the column, `interact` follows, `roll` is Goodbye. Morrowind uses a mouse; this interface has no pointer path and the owner tests on a GameSir X2s. | a pointer path landing in this interface generally — the hit rects are already published in `getUIState()`, so it is ~20 lines |
| **R2** | The disposition meter shows `N/100` per §A5/§D4 despite `RI-UIX06` **G8** ("progress bars with a percentage numeral"). G8 governs a *task completing*; this is a relationship statistic, and UIX08's arbitration header gives this item the arrangement of this window. The kind is `disposition_meter`, **not** `progress_bar`, which stays in `FORBIDDEN_KINDS` so the forbidden-name sweep still reads 0. | an RI-UIX06 ruling that G8 covers any numeral on any fill |
| **R3** | **Read/unread marking is off and there is no setting for it** (§F1). Vanilla marks nothing; OpenMW's own default is `false`. | the §G gate returning, from more than one participant, that they could not tell which topics they had already asked |
| **R4** | The transcript lives in the UI, not in `converse.js`. | nothing — this is a boundary, not a trade-off |
| **R5** | The old reply panel is suppressed from **painting** but still laid out and still reported, so every probe reading `getUIState()`'s conversation fields keeps its answer. `setVisible(false)` would have zeroed them. | a decision to retire those fields |
| **R6** | A word is lit when it is an `AddTopic` target of an answer already heard **or** a topic this speaker answers, and following it always enters the index. See §5. | a measurement that a lit word which produces no spoken answer reads as a broken promise to a player — the §G gate is where that would show |
