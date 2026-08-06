---
id: RI-UIX05
title: Books and readable text — pagination, legibility, and reading as a real activity
kind: number
side: morrowind
judges: [ui.menu.books, lore.book.structure]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`.** Books are *outside the fight*
> (ARBITRATION §1, "Lore": unreliable in-world books, contradictory accounts).
>
> **Scope, and the three-way split this item depends on.** `RI-LOR03` owns book **content** —
> length distribution, taxonomy, authorship, the refusal to correct contradictions. This item
> owns the **reading experience**, and that splits three ways, which must be kept apart or
> RI-VIS01's bifurcation is violated:
>
> | Property | Category | Judged against | Owner |
> |---|---|---|---|
> | Typeface choice, ink colour, page material, marginalia, binding | **ART DIRECTION** (P09) | Morrowind + RI-VIS05 §H | RI-UIX06 |
> | Glyph sharpness, DPI scaling, no blurry canvas text | **FIDELITY** (F17/F18, proposed) | modern references | RI-UIX06 |
> | Words per page, line length, leading, contrast ratio, page-turn cost, reading time | **LAYOUT CORRECTNESS** | neither reference set — typographic practice and the numbers below | **this item** |
>
> The third row is the one this item scores. It is neither art nor fidelity: a page can be
> beautifully art-directed (P09 passes) and rendered at 4K crispness (F17 passes) and still be
> 400 words in a 22-character column, which is a layout defect and is measured here.

## The bar

Morrowind's books are read. Not skimmed for a lore keyword, not auto-summarised into a codex
entry — opened, turned page by page, and read at the pace of prose, with a median length of
**~520 words** and a tail out past 4,500 (RI-LOR03 §1). That length only works if the reading
surface works: a book that presents 520 words as one wall of small text in a scrolling box is a
book nobody finishes, and a lore vector nobody finishes is not a lore vector.

Two things follow, and they are in tension, which is why this needs numbers. **Reading must be
cheap enough to do often** — a page turn is one input, instant, with no animation you have to
wait through, and the book opens on the frame you interact with it. And **reading must cost
something real** — a 520-word book is four minutes of a player's evening, it is not compressible,
and the game must never offer to compress it. There is no summary, no TL;DR, no "you have
learned: the shrine is south", no codex entry that absorbs the book's content so the book need
not be opened.

AR-2 makes the stakes explicit from the other direction: *item descriptions replacing NPC
dialogue as the primary lore vector* is automatic-fail leakage. RI-UIX03 §C caps item text.
**Books are where that displaced weight is supposed to go**, alongside dialogue — so books
failing as a readable surface does not merely lose books, it pushes lore back toward the two
places it is forbidden to live.

## The reference artifact

### §A — Pagination

RI-LOR03 §1 records a median book of ~520 words at "3–4 in-game pages", which fixes the page
size at roughly 130–175 words. That is the anchor for this whole section.

| # | Property | Value | Hard fail |
|---|---|---|---|
| B1 | Words per page @1920×1080 | **120–180** | < 60 or > 320 |
| B2 | Line length | **45–75 characters** including spaces | < 30 or > 95 |
| B3 | Leading (line height / font size) | **1.35–1.65** | < 1.15 |
| B4 | Body text size | ≥ **18 px** @1080p, and ≥ **1.6% of screen height** at every supported resolution | < 14 px @1080p |
| B5 | Text contrast (ink vs page) | ≥ **7.0:1** | < 4.5:1 |
| B6 | Pages per spread | 1 or 2 (a two-page spread is the Morrowind form and is preferred) | > 2 |
| B7 | Page count visible | current / total shown | absent |
| B8 | Orphan/widow control | no page begins or ends with a single line of a paragraph where avoidable | — |

B2 is the row most likely to be violated in both directions: a full-width 1920 px page gives
~200 characters per line, which is unreadable, and a narrow decorative column gives 25, which is
worse.

### §B — Page turns and interaction

| # | Property | Requirement |
|---|---|---|
| T1 | Open latency | the book is readable on the **frame** `interact` resolves. No fade-in gate, no loading |
| T2 | Turn cost | **one** input per turn (`interact` or a directional press), both directions |
| T3 | Turn latency | the next page's text is fully rendered within **6 frames (100 ms)** of the input |
| T4 | Turn animation | may exist; must be **skippable by the next input** and must never block T3. An unskippable 400 ms page-flip across a 30-page book is 12 seconds of animation |
| T5 | Close and resume | closing and reopening a book returns to the page you were on, per book, persisted in the save |
| T6 | Pause rule | RI-UIX03 §A applies unchanged: reading pauses the world outside combat, and **does not pause it in combat**. Reading a book during a fight is permitted and is a very bad idea |
| T7 | No scroll | pages are pages. A scrolling text box is not a book and fails B6 |
| T8 | Copyable position | the book's identity and page are in `getUIState()` so a critic can assert what is on screen |

### §C — Reading as a real activity (the prohibitions)

| # | Forbidden | Why |
|---|---|---|
| R1 | Any summary, abstract, blurb or "key points" of a book's contents | the words are the content |
| R2 | A codex/lorebook that absorbs read books into digested entries | replaces reading with collecting |
| R3 | "You have learned X" extraction on reading | S8-adjacent: the book gives directions in prose (RI-WLD06 L3); the *player* extracts them |
| R4 | Auto-adding a location, marker or map pin on reading | **S8, AR-2** |
| R5 | Skip-to-end, or a read-time reduction option | |
| R6 | Marking books read/unread, or a collection percentage | turns a library into a checklist (cf. RI-UIX04 Q4) |
| R7 | Audio narration of book text | RI-AUD05 §A: books are text only |
| R8 | Correcting or annotating a book's contradictions | RI-LOR03: *"No book is corrected."* An in-UI note saying another source disagrees destroys the convention |

**R3 has one permitted exception, and it is the Morrowind one:** reading a book may add a
**dialogue topic** to `topicsKnown` — a *name* the player can now ask people about. A topic is a
conversational key, not an objective; it opens a line of enquiry rather than a destination. That
is the same affordance as RI-UIX04 J8 and it is the seam crossing for this item.

**R8's practical form.** Two books in our world disagree about the Hist. Neither may carry a UI
element saying so, neither may link to the other, and the reading screen may not show "see also".
The player notices, or does not.

### §D — Books as a lore vector (the budget)

Measured across `game/data/books/`, `game/data/items/` and `game/data/dialogue/`:

| Metric | Value | Hard fail |
|---|---|---|
| Total book words | per RI-LOR03 §2 targets | below RI-LOR03's floor |
| `Σ book words / Σ item description words` | ≥ **15** | < 4 |
| Books whose text contains a proper noun corroborated in dialogue or another book | ≥ **60%** | < 20% (books are a disconnected lore silo) |
| Books that contradict another book on a named fact | ≥ **8** | 0 (RI-LOR03/RI-LOR06 convention absent) |
| Books that carry a usable prose direction (RI-WLD06 L3 grammar) | ≥ **12** | 0 |
| Books readable **before** the quest that references them | ≥ **10** | — |

The last row is the one that makes books matter mechanically rather than decoratively: a player
who read the right book three regions ago knows a name, and a name is a parley key (S13) or a
topic (R3's exception). RI-LOR03 owns whether the books are good; this row owns whether the
reading surface is connected to anything.

## Comparison method

1. **Layout measurement** (§A). Capture the reading screen at three resolutions:
   ```bash
   node tools/harness/run-headless.mjs --scenario ui-book --seed 1337 --ui-state
   node tools/harness/shoot.mjs --viewpoints ui-book --scales 1280x720,1920x1080,3840x2160 \
        --ui-visible --out reports/runs/<runId>/shots-book
   node tools/analysis/text-metrics.mjs --in reports/runs/<runId>/shots-book
   ```
   `ui-book` opens three books spanning the length distribution: a ~120-word note, a ~520-word
   median book, and a ~2,000-word volume.
   `text-metrics.mjs` reports, per page: word count (from `getUIState().elements[].text`, not
   OCR), characters per line, measured leading and font size in px and in screen fraction, and
   ink/page contrast ratio sampled from the PNG.

2. **B1 across the corpus, not just the fixture.** Compute
   `words_per_page = book_word_count / rendered_page_count` for **every** book in
   `game/data/books/`, by opening each via `openMenu('book', id)` and reading
   `getUIState().book.pages`. Report the distribution, not the mean — a corpus can average 150
   with half its books at 40 and half at 260.

3. **Page-turn timing** (§B). Queue a turn input; assert from the trace and `getUIState()` that
   the new page's full text is present within 6 frames of the input frame. Repeat for 20 turns
   and report max. T4: queue two turns 2 frames apart and assert the second is honoured.

4. **T5 persistence.** Open a book, turn to page 3, close, `saveState()`, `loadState()`, reopen;
   assert page 3.

5. **T6 pause rule.** As RI-UIX03 step 2, with `mode == 'book'`: frame delta 0 out of combat,
   exactly 120 of 120 in combat.

6. **§C prohibitions.** Scan `getUIState()` in `mode == 'book'` for kinds/text matching
   `summary`, `codex`, `key points`, `learned`, `read/unread`, `\d+%`, `see also`, `skip`. Plus
   RI-UIX02 §E's quest-state differential run *on the reading screen*, which catches R4: if the
   act of reading changes anything on screen outside the book, it has extracted something.

7. **§D budget** (no browser):
   ```bash
   node tools/analysis/content-stats.mjs --books game/data/books/ --items game/data/items/ \
        --dialogue game/data/dialogue/ --corroborate
   ```

8. **Blind pair (layout only).** Our median book's first page against a Morrowind book's first
   page, both with typeface and page art **neutralised to a common style** — this is essential,
   and it is what keeps this item out of RI-UIX06's territory. Judge prompt:
   ```
   These are two pages of text from the reading screens of two role-playing
   games, shown with the same typeface and background so that only the layout
   differs.
   1. Which page is easier to read? A or B.
   2. Which looks like a page of a book rather than a box of text? A or B.
   3. One sentence on the difference.
   ```
   Neutralising the art is what makes the answer a layout answer. Running this pair with our own
   art applied would measure art direction under a layout item, which is **CC-5 score fusion**
   (RI-VIS01 §C) and voids the result.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| K1 | Words per page (B1) across all books | median in 120–180, **p90 ≤ 240, p10 ≥ 80** | median outside 60–320 |
| K2 | Line length, leading, size (B2–B4) | all three in band at all three resolutions | B2 outside 30–95, or B4 below 14 px |
| K3 | Contrast (B5) | ≥7.0:1 | <4.5:1 |
| K4 | Spread and page count (B6, B7) | 1–2 pages, count visible | scrolling text box (T7) |
| K5 | Open and turn latency (T1, T2, T3) | open same-frame, 1 input/turn, ≤6 frames | >30 frames, or turn animation unskippable (T4) |
| K6 | Persistence (T5) | resumes on the right page | — |
| K7 | Pause rule (T6) | 0 out of combat, 120/120 in combat | pauses in combat |
| K8 | Prohibitions (§C) | 0 hits R1–R8 | R2 codex, R4 map pin (**AR-2**), or R8 correction |
| K9 | Lore-vector budget (§D) | all six rows in band | book:item ratio < 4 |
| K10 | Blind layout pair | judge prefers ours or is split on Q1 **and** answers "a book" on Q2 | judge answers "a box of text" for ours |

Native scale **checks passed / 10**. 10/10 → meets the bar (ceiling 8). 7–9 → below bar, remedy
required (ceiling 6). ≤6 → loses outright (ceiling 4). Any hard fail caps at 2; R4 additionally
triggers AR-2.

**Unimplemented scores 0.** Books existing as JSON with no reading screen scores 0 here, and a
critic must not borrow RI-LOR03's score to cover it — 330 excellent books nobody can read is a
0 on this item and a good score on that one, and both numbers are correct.

**What we lose looks like:**
```
K1 words_per_page: median 512 (every book is one page), p90 2010
K4 scrolling <div> with a scrollbar                       -> T7 HARD FAIL
K2 line length 187 chars; leading 1.05; size 13 px
K5 open latency 0 frames (good); turn: n/a, there are no pages
K8 declared: "codex_entry_unlocked" toast on first read   -> R2, R3
   quest-state differential on reading: map pin added     -> R4, AR-2
K9 book:item word ratio 2.1
=> AR-2. Capped at 2. Books are a scrolling text box that feeds a codex, and
   the lore has drifted into item descriptions because nobody reads the box.
```

## How we lose

- **The book is a scrolling div.** It is the default behaviour of every text container ever
  written, it requires no pagination logic, and it works. It also makes a 520-word median book
  into an undifferentiated wall, removes the page-turn rhythm that makes reading feel like
  reading, and quietly signals that this text is UI rather than an object. T7/K4 is a hard fail
  rather than a deduction because there is no partial version of this mistake.
- **The codex.** Someone reasonably observes that players cannot re-find a book they read six
  hours ago, and builds a lore compendium. Within two waves the compendium has summaries,
  because full text in a compendium is unreadable, and the summaries become what people read.
  R2 forbids the compendium; the legitimate need it answers is met instead by **owning the
  physical book** (books are items with weight, RI-UIX03 C2) and by search (RI-UIX04 J7's
  machinery pointed at book text), which preserves the words.
- **Reading extracts.** "You have learned the location of the Drowned Shrine." It is one line of
  code, it is helpful, and it is a map pin wearing a sentence. R3/R4, and it is caught by
  pointing RI-UIX02's quest-state differential at the reading screen — which is a check nobody
  will think to run there unless it is written down, which is why step 6 names it.
- **Words per page is set once, on the shortest book.** Someone tunes pagination against a
  150-word note, it looks perfect, and the 2,000-word volume becomes 13 pages of 154 words with a
  400 ms unskippable flip between each — 5 seconds of animation to read one book. K1 measures
  the distribution over every book and K5 checks skippability for exactly this compound failure.
- **Legibility is judged on a 27-inch monitor.** 14 px looks fine at arm's length and is
  unreadable at 1280×720 or on a laptop. B4's dual requirement (absolute px *and* screen
  fraction) exists because either alone passes a build that fails at some real resolution.
- **The contradiction gets a footnote.** A well-meaning content pass adds "(see also: *The Hist
  Refuted*)" to reconcile two books. It is a small, generous, editorial act and it deletes
  RI-LOR03's central convention. R8.
- **The art is judged here.** A critic opens the reading screen, finds it gorgeous, and scores
  this item an 8 while the line length is 190 characters. This is the bifurcation failing inside
  a single screen — the typeface is P09 and belongs to RI-UIX06's ART pass, the crispness is
  F17 and belongs to its FIDELITY pass, and the 190 characters belong here. Step 8's
  art-neutralised blind pair is the specific guard, and it will feel like an odd amount of
  trouble to go to right up until someone scores a beautiful unreadable page.

## Seam (AR-3)

**Not sterile.** R3's exception is the crossing and it is a strong one: reading a book adds a
**dialogue topic**, and under S13 a topic can be a **parley key** — a name learned from a
century-old volume ends a fight without a corpse. A Morrowind-side reading activity therefore
produces a legitimate resolution to a Souls-side encounter. §D's last two rows exist to make this
countable rather than aspirational: ≥12 books carrying prose directions (RI-WLD06 L3) and ≥10
readable before the quest that needs them.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **anchor is derived, not invented**: RI-LOR03 §1 records a ~520-word median book rendered as
"3–4 in-game pages", which yields 130–175 words per page, and B1's 120–180 band is that figure
with rounding. Everything else in §A is `constructed` from ordinary typographic practice — the
45–75 character measure and 1.35–1.65 leading are conventional book-typography ranges rather than
anything specific to this project or its references, and the 7.0:1 contrast is WCAG 2.1 AAA for
body text, which is the right standard here (unlike RI-UIX01 §D3's 4.5:1 on a bar, where AA was
being deliberately over-applied to a non-text element).

**Constructed with no derivation:** the 6-frame turn latency, the ≥15 book:item word ratio, the
60% corroboration rate, the ≥8 contradictory books, ≥12 direction-carrying books and ≥10
read-before-quest books in §D. The ≥15 ratio is the one to challenge first: it is set as the
complement of RI-UIX03 §C's ≤0.05 item:dialogue cap and shares that cap's weakness — it is a
ratio, so it passes trivially if item descriptions are simply absent, and a critic seeing K9 pass
should check the absolute book word count against RI-LOR03's floor before believing the lore
vector is where it should be.

Confidence is `medium` principally because B1's band inherits RI-LOR03's own "3–4 pages" figure,
which is a recalled approximation of Morrowind's book renderer rather than a measurement, and
because the §D counts (8, 12, 10) are round numbers chosen for auditability rather than derived
from the content plan in RI-LOR03 §2 — they should be reconciled against that section's actual
taxonomy targets when it is next touched.

**Harness additions requested:** `openMenu('book', id)` (RI-UIX03), and `getUIState().book`:
```js
book: { id, page, pages, wordsOnPage, spread: 1|2 } | null
```
`pages` and `wordsOnPage` are what make K1 measurable across the whole corpus without OCR; without
them, pagination can only be checked on the three fixture books and the distribution check in
step 2 cannot run.
