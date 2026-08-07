---
id: RI-UIX04
title: The journal screen — chronological, append-only, and not a quest tracker
kind: structure
side: morrowind
judges: [ui.menu.journal, journal.entry.numbering]
provenance: constructed
confidence: high
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`.** The journal is *outside the fight*
> (ARBITRATION §1, "Journal": *numbered, dated, first-person-authored journal entries; no
> objective markers*), and S8 governs it.
>
> **NOTICE — JU8 IS SUPERSEDED IN PART. NOTHING IN THIS ITEM HAS BEEN EDITED.**
> On 2026-08-07 the project's owner overruled seam **S30** ("there is no map") with seam **S35**
> ("there is a map, and it has no quest markers on it"). Under `ARBITRATION.md` §5 a seam ruling
> outranks an item's comparison method, so **JU8's existence clause — *"`map` … non-existent"*,
> and method 7's *"the map must not exist at all"* — no longer states the bar.** S35 requires the
> amendment to be filed rather than the clause worked around; it is
> `corpus/00-doctrine/AMENDMENT-W1-MAP-01.md`, and it is **proposed**, not applied.
>
> This block is a signpost, not a change. **Every prohibition in §B stands verbatim, Q7
> included** — Q7 forbids a map *in or reachable from the journal*, and that half is unamended
> and is still a hard fail that triggers AR-2. A critic scoring this item should read the
> amendment before scoring JU8, and should read S35 before accepting the amendment. A critic who
> scores JU8's existence clause as written will fail a build that the ruling above it requires.
>
> **Scope.** `RI-DLG05` owns the journal's **content** — the entry schema, the first-person
> voice, length distribution, and the prohibition on coordinates in the text. **This item owns
> the screen**: what order entries appear in, what index exists, what may be searched, and —
> mostly — what the screen must refuse to do. It fills the `ui.menu.journal` corpus hole. No
> requirement here overrides RI-DLG05; where they touch, RI-DLG05 wins on text and this item
> wins on presentation.

## The bar

**This is where a modern-UI instinct most badly breaks Morrowind, and the break is a single
design decision made in an afternoon: grouping entries by quest.**

Morrowind's journal is one continuous document, written in date order, with every quest
interleaved exactly as the player lived them. Entry 30 of the murder investigation sits between
a Mages Guild errand and a note about a book somebody mentioned, because that is the order the
week happened in. It reads like a person's notebook and it produces a specific and irreplaceable
experience: **you have to remember what you were doing.** Going back to find out what Ree-Vaska
told you means reading past three other things you were also doing, which is how a player builds
a mental model of a week in their own life rather than a checklist.

Group those same entries by quest and you have a quest log. Add the newest entry of each open
quest at the top and you have a quest tracker. Add a "current objective" line and you have
rebuilt the thing S8 exists to forbid, without ever drawing a marker. **Every one of those steps
is an improvement in usability and each one is a loss of the game.**

The bar, therefore: the default and primary view is **chronological and interleaved**; a
quest-name index exists **only as a jump target into that chronology**; and the screen never at
any point tells the player what to do next.

## The reference artifact

### §A — Required structure

| # | Property | Requirement |
|---|---|---|
| J1 | **Default view** | strictly chronological, all quests interleaved, ordered by `(date_written, index)` ascending. This is the view the journal opens to, every time |
| J2 | Entry rendering | `index`, `date_written` and `text` verbatim from the data (RI-DLG05 §A). The text is rendered whole — never truncated, never summarised, never given a UI-authored headline |
| J3 | **Append-only** | an entry once rendered is byte-identical forever. Later entries never rewrite, correct, strike through or hide earlier ones — **including entries that turned out to be wrong**, which is the point (RI-DLG05: "it records what you were told, including the parts that were wrong") |
| J4 | Quest index | a secondary index listing **quest display names only** (the `quest_name`-flagged entry per `journal_id`, RI-DLG05 §A). Selecting one **scrolls the chronological view** to that quest's first entry. It does not open a separate per-quest page |
| J5 | Index ordering | the index is ordered by the date of the quest's **most recent** entry, or alphabetically. It carries **no** state decoration — no "active"/"complete" badge, no colour, no count |
| J6 | Finished quests | remain in the index and in the chronology, unmarked in the index. `quest_finished` may be reflected *in the chronology* only as the entry's own text saying so, in the character's words |
| J7 | Search | free-text search across all entry text, returning matches **in chronological order** with surrounding context. Matches are highlighted; the chronological view is preserved |
| J8 | Topic cross-reference | a proper noun in an entry that is also a known dialogue topic (`getQuestState().topicsKnown`) may be visually marked, and selecting it opens the topic — the Morrowind hyperlink affordance. It must **not** open a map, a location, or a marker |
| J9 | Pagination | page-based with visible page turns (shared with RI-UIX05's book renderer) or continuous scroll. Either is acceptable; a fixed viewport with a scrollbar and no sense of length is not |
| J10 | Extent is visible | the player can see how long the journal is — a page count or a scroll extent. The journal accumulating is part of what it is |
| J11 | Pause | the journal screen obeys RI-UIX03 §A: paused outside combat, running in combat |

### §B — The prohibitions (each a hard fail)

| # | Forbidden | What it turns the journal into |
|---|---|---|
| Q1 | **Grouping by quest as the default or only view** | a quest log |
| Q2 | An "active quests" / "current quests" list | a quest tracker |
| Q3 | A per-quest **objective** line, checklist, or next-step summary — anything the UI authored rather than the character wrote | a to-do list; **S8/AR-2** |
| Q4 | Checkboxes, ticks, progress bars, "3/5 collected", completion % | a checklist |
| Q5 | Sorting or filtering by completion state | |
| Q6 | A "tracked quest" concept of any kind, or any link between the journal and the HUD | the mount point for a marker; **RI-UIX02 K3** |
| Q7 | Any map, minimap, or map page in or reachable from the journal | **S8** |
| Q8 | Location names rendered as links that reveal a position | **S8** |
| Q9 | Entry text edited, hidden, struck through or re-ordered after the fact | **J3** |
| Q10 | A UI-authored headline or summary above an entry ("Objective: find the shrine") | **J2** |
| Q11 | Notifications: "Journal updated", "New objective", a HUD toast on entry | announces quest state on the HUD; **RI-UIX01 X7** |
| Q12 | Newest-first ordering as the default | inverts J1; a feed, not a notebook |

**Q11 has one narrow exemption**, because the player must know an entry was written or the
journal becomes invisible: a **single, silent, non-textual** indicator — one glyph, ≤32×32 px,
≤3 s, no words, no quest name, appearing at most once per entry. It says *something was
written*, never *what*. Anything with text in it is Q11.

**Q3 is the one to watch.** It will not arrive as "an objective line". It will arrive as a
helpful bolding of the last sentence, or a "latest" pin at the top of a quest's entries, or a
tooltip. All three are the UI authoring the player's next step, and all three are Q3.

### §C — Worked example: the same four entries, right and wrong

**Right (J1, chronological, interleaved):**

```
  20 — 3rd of Sun's Height
  Ree-Vaska will not say the shrine's name. From the fish-drying racks at
  Lilmoth's southern gate I am to follow the boardwalk until it ends, then
  keep the black water on my left until the trees give out.

  10 — 4th of Sun's Height
  The Legion factor at Stormhold wants three crates counted. Counted. I have
  walked eleven days for this.

  30 — 4th of Sun's Height
  There was no shrine where she said. There was a xanmeer, and it was not
  drowned, and the water was on the wrong side. Either she has never been
  there or she wanted me somewhere else.
```

**Wrong (Q1 + Q2 + Q3 + Q4):**

```
  ACTIVE QUESTS (2)
  ▸ The Drowned Shrine                              [ 2/4 ]
      Current objective: Find the drowned shrine south of Lilmoth
      ✓ Speak to Ree-Vaska
      ✓ Travel to the southern gate
      ☐ Find the shrine
      ☐ Return to Ree-Vaska
  ▸ Legion Inventory                                [ 0/1 ]
      Current objective: Count the crates at Stormhold
```

The second version contains no coordinates and no map marker, so it passes RI-DLG05's grep and
RI-UIX02's pixel sweep. It has still destroyed the journal — the doubt in entry 30 has become a
checkbox, and the player is now executing a list instead of reconstructing a week. That is
precisely why this item exists separately from both of them.

## Comparison method

1. **Static structure check** (no browser):
   ```bash
   node tools/corpus/dump-journal.mjs --data game/data/quests/ --json > reports/journal.json
   node tools/analysis/journal-ui.mjs --in reports/journal.json
   ```
   Asserts one `quest_name`-flagged entry per `journal_id` (J4) and that indices are ascending.

2. **J1 — the interleaving test.** This is the central measurement.
   ```bash
   node tools/harness/run-headless.mjs --scenario ui-journal --seed 1337 --ui-state
   ```
   `ui-journal` loads a state with **≥4 quests started on overlapping dates and ≥12 entries**,
   opens the journal via `openMenu('journal')`, and captures `getUIState()`.

   From the rendered element order compute:
   - `chronological = (rendered order == sort by (date_written, index))` → must be **true**;
   - **`interleave_ratio`** = (number of adjacent rendered pairs whose `journal_id` differs) /
     (total adjacent pairs). With 4 quests interleaved by date this must be ≥ **0.5**. A
     quest-grouped view yields ≈ `(n_quests − 1) / (n_entries − 1)` ≈ 0.27 with 12 entries, and
     with 40 entries it collapses toward 0.08. **This single number distinguishes a journal from
     a quest log**, and it does so without any judgement call.

3. **§B prohibitions — declared.** Scan `getUIState().elements` in `mode == 'journal'` for
   kinds/text matching: `objective`, `tracker`, `active_quest`, `progress`, `checkbox`, `track`,
   `complete`, `%`, `\d+/\d+`, `▸ ✓ ☐ ✔`. Any hit is the corresponding Q-row.

4. **§B prohibitions — observed.** RI-UIX02 §C's UI-layer difference over the journal screen,
   plus OCR of the rendered page. Search the OCR text for `Objective`, `Current`, `Tracked`,
   `Complete`, `Active Quests`, and for the `n/m` pattern. This catches a canvas-rendered
   objective line that never registers as an element.

5. **J3 append-only.** Capture the full rendered journal text at frame `f`; advance the quest
   through ≥3 more stages; capture again. Every entry present in the first capture must be
   **byte-identical** in the second, and the second must be a strict superset.
   ```bash
   node tools/analysis/journal-ui.mjs --diff capture_a.json capture_b.json --expect append-only
   ```

6. **J7 search / J8 topics.** Search for a proper noun appearing in 3 entries across 2 quests;
   assert 3 results in chronological order. For J8, assert a marked proper noun's activation
   changes `mode` to `dialogue`/`topic` and **never** to `map`, and emits no `worldAnchor`.

7. **Q7 map reachability.** From `mode == 'journal'`, enumerate every reachable mode via
   `getUIState().navigable`; assert `map` is not among them. Then assert globally that no
   `openMenu` name resolves to a map screen — the map must not exist at all.

8. **Blind pair (structure).** Render 20 of our entries as the screen displays them, against 20
   Morrowind journal entries as Morrowind displays them, both stripped of attribution, per
   RI-MTH03. Judge prompt:
   ```
   These are two pages from the in-game journals of two role-playing games.
   1. Which one was written by the player's character, and which was written
      by the game's interface? Answer A, B, BOTH, or NEITHER.
   2. In one sentence, what is the difference?
   ```
   The interesting failure is `BOTH` — it means our screen has UI voice in it.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| JU1 | Chronological default (J1) | `chronological == true` | false |
| JU2 | **Interleaving** | `interleave_ratio ≥ 0.5` on the 4-quest fixture | ≤ 0.30 (grouped by quest) → **Q1** |
| JU3 | Prohibitions, declared (§B) | 0 hits | any of Q2, Q3, Q4, Q6, Q7 |
| JU4 | Prohibitions, observed (OCR) | 0 hits | any hit not also declared (a hidden objective line) |
| JU5 | Append-only (J3) | byte-identical superset | any entry changed or removed |
| JU6 | Quest index (J4, J5, J6) | names only, scrolls chronology, no state decoration | index opens a separate per-quest page |
| JU7 | Search + topics (J7, J8) | both, chronological results, no map | topic link reveals a position |
| JU8 | No map anywhere (Q7) | `map` unreachable and non-existent | a map exists |
| JU9 | Entry rendering (J2, J9, J10) | verbatim, untruncated, extent visible | UI-authored headlines |
| JU10 | Notification discipline (Q11) | silent glyph only, or nothing | textual "Journal updated" toast |
| JU11 | Pause rule (J11) | per RI-UIX03 §A | — |
| JU12 | Blind pair | judge distinguishes ours as character-written | judge answers `BOTH` or picks ours as the interface |

Native scale **checks passed / 12**. 12/12 → meets the bar (ceiling 8). 8–11 → below bar, remedy
required (ceiling 6). ≤7 → loses outright (ceiling 4). Any hard fail caps at 2. Q3, Q6 and Q7
hits additionally trigger **AR-2** (ARBITRATION §3).

**Unimplemented scores 0.** A journal that exists as a data structure but has no screen scores 0
here even if RI-DLG05 passes — the entries being well written does not mean they are readable.

**What we lose looks like:**
```
JU1 chronological: false (newest-first within quest groups)
JU2 interleave_ratio: 0.09                     -> Q1 HARD FAIL
JU3 declared: active_quest_list, objective_line, progress "2/4", checkbox x4
JU8 map reachable from journal via "Show on map"  -> Q7, S8, AR-2
JU12 blind judge: "BOTH — A is a notebook, B is a quest log with a diary
     stapled to it. B is obviously the interface."
=> AR-2 automatic fail. Capped at 2. Every entry is well written (RI-DLG05
   passes at 7) and the screen has thrown all of it away.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 8 / 12 checks | 10 / 12 checks | 12 / 12 checks |

**Aggregation (a property of this item, not of the critic):** count of passing checks; any hard fail caps the piece at 2.

## How we lose

- **Grouping by quest, in an afternoon, for good reasons.** Somebody with 40 entries across 9
  quests cannot find the murder investigation. Grouping fixes it in twenty lines and every
  playtester prefers it. It is the correct usability decision and it is the death of the
  journal. The honest remedy is J4 + J7 — an index and a search that *jump into* the chronology
  rather than replacing it — and that is more work than grouping, which is why grouping wins
  unless a number forbids it. JU2 is that number.
- **The objective line arrives as a summary.** Not "Objective:", but the last entry's first
  sentence in bold at the top of the quest's group. It is helpful; it is UI-authored; it is Q3.
  And it is invisible to every check except JU4's OCR, because bolding a substring does not
  create an element with a suspicious kind.
- **Retroactive correction.** A quest turns out differently and someone updates the earlier
  entry so the journal is not "wrong". This is the most well-intentioned failure available and
  it deletes the property that makes a Morrowind journal worth reading — entry 30 in §C is
  valuable *because* entry 20 was wrong. JU5 is a byte comparison for this reason.
- **The map appears somewhere else and the journal links to it.** The journal itself stays
  clean, so JU3 passes; a "show on map" affordance leaks S8 through a screen this item does not
  own. JU8 checks reachability *and* existence, and the existence half is the one that matters —
  as with RI-UIX02 §F's compass, the fix is that there is nowhere to put a pin.
- **The "Journal updated" toast.** Universal, expected, and it puts quest state on the HUD.
  Q11's silent-glyph exemption exists because the alternative — no feedback at all — leads
  straight back to a toast within one playtest round.
- **Search is never built, so the index has to do search's job**, so the index acquires
  objectives and states, and Q2–Q5 follow one at a time. J7 is load-bearing infrastructure, not
  a nicety: it is what makes a 40-entry chronological journal navigable at all, and every
  prohibition in §B gets easier to hold once it exists.
- **The screen is judged by reading it rather than by measuring it.** A critic opens the
  journal, sees the entries are well written, and scores the *content* — which RI-DLG05 already
  scored. JU2 is a single number computed from render order and it is what makes this item
  independent of the one next door.

## Seam (AR-3)

**Largely internal — a critic should record `seam_sterile: false` on one crossing only, and
weakly.** J8's topic cross-reference is the crossing: a proper noun the character wrote down
becomes a dialogue topic (`topicsKnown`), so reading your own notes is how you acquire
conversational leverage. Under S13's parley requirement that leverage can end a fight — a name
learned from a journal entry is a valid non-lethal exit. The journal is otherwise, and
correctly, a Morrowind-internal system.

## Provenance note

`provenance: constructed`, `confidence: high`.

The **structural claims about Morrowind's journal** — one continuous chronological document,
quests interleaved by date, numbered indices with gaps, a quest-name index added in later
releases that jumps into the chronology, no objective list, no tracker, no pins — are
`canonical-recall` and are high-confidence; they are also already carried by RI-DLG05 §A, whose
schema this item renders and does not restate.

**Constructed:** everything in §B, §C's wrong-example, and every threshold in §Scoring. The
`interleave_ratio ≥ 0.5` bar is the load-bearing construction and its derivation is worth
recording so it can be checked rather than believed: with `n` entries drawn from `q` quests, a
quest-grouped view produces exactly `q − 1` adjacent pairs with differing `journal_id` out of
`n − 1` pairs, so the ratio is bounded by `(q−1)/(n−1)` — 0.27 for the 4-quest/12-entry fixture
and falling as the journal grows. A genuinely date-interleaved view of 4 concurrent quests
approaches `1 − 1/q` = 0.75. The 0.5 threshold sits between the two with room on both sides, and
the 0.30 hard-fail line sits just above the grouped-view ceiling for the fixture size. The
fixture size is therefore part of the measurement and must not be changed without re-deriving
both numbers — a critic running JU2 on a 40-entry state and comparing against 0.5 is using the
wrong bar.

Confidence is `high` despite those being constructed numbers, because JU2's derivation is
arithmetic rather than aesthetic and because the remaining checks (JU1, JU5, JU8) are structural
booleans with no tunables at all.

**Harness additions requested:** `getUIState()` with element **render order preserved** — JU2 is
computed from order, so an implementation that returns elements in an arbitrary or z-sorted
order makes this item unmeasurable — plus `openMenu`/`closeMenu` (RI-UIX03) and a
`getUIState().navigable: string[]` field listing modes reachable from the current one (JU8).
