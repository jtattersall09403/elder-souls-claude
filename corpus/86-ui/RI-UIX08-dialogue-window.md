---
id: RI-UIX08
title: The dialogue window — a floating index of keywords you find by reading, not a menu of replies
kind: structure
side: morrowind
judges: [ui.dialogue.presentation, dialogue.topics.discovery, dialogue.disposition]
provenance: measured
confidence: high
blind_pair: yes
---

> **ARBITRATION: this item is `morrowind`.** Talking is not fighting. `RI-DLG01` §A already
> settles that the topic graph is a peacetime structure and that `Topic` and `Greeting` are
> unavailable while `COMBAT` is active (seam S13), so no clause here ever competes with a Souls
> ruling. Where this item and `RI-UIX06` (diegesis and UI style) touch, UIX06 wins on house style
> and this item wins on the arrangement of *this* window.
>
> **Scope.** `RI-DLG01` owns the **graph** — which topics exist, what filters pick an answer, how
> `AddTopic` wires one topic to the next. `RI-DLG04` owns **disposition** as a number and what
> changes it. **This item owns the window**: what is on screen, where, in what colour, and what a
> click does. It states no requirement about what any character *says*; that is `RI-DLG02`,
> `RI-DLG03` and `RI-DLG06`.

## The bar

**Morrowind's dialogue window is not a list of things you may say. It is a page of prose with the
useful words lit up inside it, and an index of every word you have lit so far.** You do not pick a
reply. You read an answer, notice that `netch leather` and `Sadrith Mora` and `Mages Guild` are a
different colour from the sentence around them, and click one — and now that word is in your index
forever, for every person in the world who has an opinion about it. The conversation branches
because you *read* it, not because the game offered you three buttons.

That distinction is the whole difference between investigating a place and reading a FAQ, and it is
a property of the **window**, not of the writing. Perfect Morrowind prose rendered into a
three-option reply bar is a FAQ. Ordinary prose rendered into this window still rewards reading.

**The bar this item sets:** our dialogue window presents (1) the speaker's name, (2) the response
history as continuous scrollable prose, (3) clickable topic keywords **coloured inline inside that
prose**, (4) a scrollable index of every topic held for this speaker, (5) disposition as a number,
and (6) a way out — as a **floating panel over a still-visible world**, with the topic index a
fixed-width column beside the prose rather than a replacement for it.

**What we ship today does not do this.** `game/src/render/ui.js` draws a bottom-anchored vellum
panel: speaker name upper-left, an `opts[]` list of selectable replies with a scroll counter, no
topic column, no disposition, no inline links. `game/src/ui/surface.js` line 46 declares a
`topic_link` surface role and **nothing in `game/src/` references it** — the seam for the central
mechanism was cut and never used. `game/src/ui/screens/` has `inventory`, `map`, `progress`,
`text`, `wait` and no dialogue screen. That is a reply menu with a Morrowind palette, which is
precisely the failure `RI-DLG01`'s "we have built a quest menu with a Morrowind skin" warns about,
one layer up in the UI.

## The reference artifact

### §0 — The references, by path. A builder or critic who has not opened these has not done the work.

This section exists because of a specific, documented failure: **the dialogue window was built with
nothing to look at, in a corpus that held the pictures the whole time.** `RI-VIS09` §2's routing
table gives `RI-UIX*` only REF-A12 (the OpenMW layout XML) and says in terms that REF-A12 "must not
be cited for look"; `RI-VIS09` §3.5 still reads "no pixel of Morrowind's UI art is in the set"; and
`REF-A12/README.md` still ends "one 1024×768 vanilla screenshot each … is the only thing that
would" close the gap. All three were written before REF-A12b landed on 2026-08-06 and none was
updated. A builder who obeyed the register was **told the reference did not exist.**

| Path | n | What it is | Cite it for | Do **not** cite it for |
|---|---|---|---|---|
| `corpus/70-visual/refs/morrowind/REF-A12c/REF-A12c-dialogue__mw-owner-20260814.png` | 1 | **The owner's own capture**, 2376×1069, OpenMW for Android. The highest-resolution dialogue reference we hold and the one the owner supplied to settle this question. | Everything in §A–§E below. Every measurement in this item was taken from it. | Its **green topic list** (see §E4) and its **top-corner and lower-right chrome**, which are the Android touch front-end and not Morrowind. |
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-dialogue__mw-3296790844.jpg` | 1 | **The native-engine control.** Same window, unmodified colours, showing the two-section topic list and a disposition of 93/100. | The vanilla topic-list colour; the section rule; the greeting-then-answer stacking. | Pixel statistics — `pixel_metrics_valid: false`, as on every file in `refs/morrowind/`. |
| `corpus/70-visual/refs/morrowind/REF-A12b/` (the other four `*-dialogue__*`, plus `*-journal__*`) | 4 + 3 | Four more native dialogue frames; three journal spreads. | Cross-checking any claim below; the journal spreads show the **same blue links in a different surface** (§E5). | Any claim about a window they do not show. |
| `corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_dialogue_window.layout` | 1 | The exact widget rects and anchors. | Every geometry number in §B, which is quoted from it verbatim. | Appearance, type, or populated density. It is text. |
| `corpus/70-visual/refs/morrowind/REF-A12/config/openmw.cfg` lines 71–115 | 1 | The 45-entry `[FontColor]` table. | Every colour constant in §C. | Any colour not in the table — including the green in §E4. |

**A critic scoring this item must record, in its verdict, which of these files it opened.** A
verdict on a visual arrangement that names no opened reference is an opinion, and `RI-VIS09`'s
compliance check already hard-fails a visual claim that cannot resolve a path.

### §A — What is on screen. Six elements, no more.

Measured from REF-A12c, corroborated against `openmw_dialogue_window.layout`.

1. **A floating panel** over the running world, roughly centred, occupying about **57% of the frame
   width and 76% of its height** (1362×808 in a 2376×1069 frame). Not fullscreen, not letterboxed,
   not a scene change.
2. **A title strip** across the top of the panel carrying the **speaker's name, centred** —
   `Anarenen` in REF-A12c, `Arangaer` in the native control. Name only: no portrait, no faction, no
   disposition word, no location.
3. **The history pane**, left, the large majority of the panel: the running transcript of this
   conversation as **continuous prose**, oldest at top, scrolled to the bottom, with its own
   vertical scrollbar on its right edge.
4. **The topic column**, right: a bordered, scrollable list of every topic currently held for this
   speaker, one per line, left-aligned, **lower-case as authored** (`netch leather`, `latest
   rumors`, `guild guide`) except where the topic is a proper noun (`Retort`, `Big Helende`).
5. **The disposition bar**: a filled horizontal bar directly above the topic column, the same width
   as it, carrying the number **as `N/100`** centred on the fill — `100/100` in REF-A12c, `93/100`
   in the native control.
6. **The Goodbye button**, below the topic column, **the full width of that column**, caption
   centred.

There is no seventh element. No portrait, no relationship meter, no reply-tone icons, no timer, no
"[Persuade]" chrome — persuasion is an ordinary line at the top of the topic list (§D2).

### §B — Where it all is. Geometry, from the layout file, verbatim.

`openmw_dialogue_window.layout`, window nominal **588 × 433**, `MinSize` **380 × 230**:

| Widget | Rect (x y w h) | Anchor | Consequence |
|---|---|---|---|
| history box (`MW_Box`) | `8 8 381 381` | `Stretch` | grows in both axes |
| history text (`BookPage`) | `15 15 364 370` | `Left Top Stretch` | a further **7 px** inset inside the box |
| history scrollbar (`MW_VScroll`) | `370 13 14 371` | `Right VStretch` | **14 px wide**, `Visible=false` until the text overflows |
| disposition (`MW_Progress_Blue`) | `398 8 166 18` | `Right Top` | **fixed width, right-anchored** |
| topic list (`MWList`/`MW_SimpleList`) | `398 31 166 328` | `Right VStretch` | **fixed width, right-anchored** |
| Goodbye (`Button`/`MW_Button`) | `398 366 166 23` | `Right Bottom` | **fixed size, pinned to the corner** |

**The single most important line in that table is the anchor column, and `REF-A12/README.md` gets
it wrong.** That README states "Both columns `align` to stretch, so the ratio holds as the window
is resized." They do not. The history box is `Stretch`; the disposition bar, topic list and Goodbye
button are `Right *` at a **fixed 166 px**. The topic column is 28.2% of the nominal window and
**shrinks as a fraction whenever the window is widened.**

**REF-A12c is the proof, and it is why an owner screenshot was worth acquiring.** The owner's window
is wider than nominal. Measured on the frame: panel 1362 px wide, topic column 325 px — **23.9%,
not 28.2%.** The disposition bar measures 320 px and the layout declares 166, giving a UI scale of
1.93; at that scale the panel is ~707 layout units wide against a nominal 588. The extra width went
entirely to the prose. That is the anchor rule visible in pixels, and it is the correction the
picture bought us over the XML.

**Requirement B1.** Our topic column is a **fixed width in layout units, right-anchored**, and the
prose pane absorbs every pixel of extra width. A column specified as a percentage is a fail: it
makes the prose narrower on a phone, where the prose is the thing being read.

### §C — Colour. The whole scheme is four families and it is load-bearing.

From `openmw.cfg` lines 71–115, cross-checked against measured glyph-core colour in REF-A12c:

| Role | Constant | Hex | Measured in REF-A12c | Where it appears |
|---|---|---|---|---|
| ordinary prose | `normal` | `#CAA560` | ~(195,174,132) | the body of every answer; the speaker's name in the title strip |
| block heading | `header` / `normal_over` | `#DFC99F` | ~(228,217,195) | the topic name repeated as a heading above its answer |
| **clickable topic keyword** | `link` | `#707ECF` | ~(110,120,180) | **inline, inside the prose** |
| link hover / press | `link_over` / `link_pressed` | `#8F9BDA` / `#AFB8E4` | — | a two-step ramp, not a single hover colour |
| disposition fill | `magic` family | `#35459F` | ~(30,50,120) | the bar |
| the world behind | — | — | — | visible through the panel (§E1) |

**Requirement C1 — the inline link is the mechanism, not decoration.** In REF-A12c, `Animal
products`, `alit hide`, `crab meat`, `netch leather`, `Sload soap`, `Mages Guild`, `Imperial cult`
and about sixty other spans are blue; the words between them — `of commercial value on Vvardenfell
include the following:`, `and`, `steward,` — are bronze. In the same paragraph `Mages Guild` is blue
and `Fighters Guild` is bronze, because one is a topic here and one is not. **The colour is a
truthful statement about what is clickable, made at word granularity, inside running prose.** A
build that colours whole sentences, colours every proper noun, or renders links in the body colour
has removed the mechanism while keeping the layout.

**Requirement C2 — the topic column and the prose share one vocabulary.** `netch leather` appears
blue in the prose and, once taken, as a line in the column. A word that is blue in the prose and
absent from the column after clicking it is a fail.

### §D — What it does. Behaviour, in the order a player meets it.

**D1 — Clicking a blue word in the prose does two things at once**: it adds that word to the topic
column *permanently, for every speaker who has an answer to it*, and it appends the answer to the
bottom of the history pane. It does not clear the pane, it does not open a sub-window, and it does
not close the conversation. This is `AddTopic` (`RI-DLG01` §A) surfacing in the UI, and the
permanence is the point: the index is the player's accumulated vocabulary for the whole world.

**D2 — The topic column has two sections separated by a horizontal rule.** Visible in
`REF-A12b-dialogue__mw-3296790844.jpg`: above the rule, the **actions available with this person**
— `Persuasion`, `Barter` — and below it, alphabetically, the **topics**: `Background`, `Big
Helende`, `Gateway`, `guild guide`, `Imperial cult`, `latest rumors`, `little advice`, `little
secret`, … . Neither the coordinator's description of this window nor the layout XML records this;
it is only in the picture. A build that mixes `Barter` into the alphabetical run has lost the
distinction between *doing something with this person* and *asking them about the world*.

**D3 — The history accumulates and scrolls; it is never cleared mid-conversation.** In REF-A12c the
pane is scrolled such that a previous answer is clipped at the top edge (`latest rumors come to
Ald'ruhn:` is half-visible), three full answer blocks follow, and the scrollbar thumb sits near the
bottom. Each answer is preceded by its topic name as a heading in `header` colour. The greeting has
no heading.

**D4 — Disposition is a number out of 100 and it is never a word.** No "Friendly", no five hearts,
no colour-coded face. `RI-DLG04` owns what moves it.

**D5 — Goodbye is a button, at the foot of the topic column, the full width of that column.** It is
the only way out that the window advertises.

**D6 — The window takes input, and the world keeps existing behind it.** The panel is translucent
(§E1). Morrowind is not paused in the Souls sense here; `RI-UIX03`'s pause rule governs, and this
item adds nothing to it.

### §E — Five things the picture shows that the written description of it did not

This section exists because the orchestrator's brief described this window from memory of a
screenshot, and asked to be corrected. Each row is what the brief said, and what the file shows.

**E1 — "A parchment-coloured frame."** *Half right, and the wrong half is the important one.* The
**frame** is a coarse mottled tan-ochre band with a fine beaded edging, tiled rather than stretched
(REF-A12's `TileRect` with `TileH`/`TileV` true), mean colour ~`#805F3E`, reading as cast metal or
tooled stone. The **panel interior is not parchment at all — it is near-black and translucent**,
and the world is visible through it. Brightened 3.2×, REF-A12c shows the NPC's own face and
shoulders clearly through the prose pane, behind the text. OpenMW's `menu transparency` default is
**0.84**. *The parchment in Morrowind is the **journal**, which is a different surface entirely:
`REF-A12b-journal__*.jpg` shows cream paper, near-black ink, red date headings and a painted book
spine. Conflating the two would give us a dialogue window that looks like a book and a book that
looks like nothing.*

**E2 — "The speaker's name centred in a title bar."** *Right, and the construction is worth
copying.* There is no separate bar and no plate behind the name. The tiled border strip runs the
full width and is **interrupted** — a gap is cut in the tiling — and the name sits in that gap in
`normal` bronze. The strip's beaded edging continues past the gap on both sides.

**E3 — "Blue for available, a different colour once used."** *The second half is not in either
reference and is not vanilla.* Every inline link in REF-A12c is one blue. Every topic-column entry
in the native control is one bronze. **Morrowind does not mark a topic read.** OpenMW added an
opt-in setting for it — `color topic enable`, **default `false`**, with `color topic specific`
`0.45 0.5 0.8` and `color topic exhausted` `0.3 0.3 0.3` — i.e. blue-ish and grey, and only when
you switch it on. If we want read/unread marking we are choosing a post-2002 affordance, and we
should choose it deliberately and say so, not import it as if it were Morrowind. §F1 rules on it.

**E4 — "A topic list down the right-hand side in green."** *The position is right. The green is not
Morrowind.* Measured over the whole column in REF-A12c, glyph-core RGB is ~(144,196,146): R and B
within 2 of each other, G about 50 above both. **No entry in the 45-entry `[FontColor]` table is
that colour** — the nearest green is `fatigue` `#00963C`, far darker and far more saturated — and
OpenMW's own topic colouring ships blue-ish/grey, not green. Every native-engine capture in REF-A12b
renders the same list in `normal` bronze `#CAA560`. **The green is a user setting or a mod on the
owner's device.** The record in `_provenance.json` says `modded: "unresolved"` and
`vanilla_confidence: "medium"` for this reason. **Build the column in `#CAA560`.**

**E5 — Something neither description mentions: the same blue links appear in the journal.**
`REF-A12b-journal__mw-147283027.jpg` shows `The Seven Curses`, `Red Mountain`, `Nerevarine`, `the
moon-and-star` and `Nerevarine prophecies` in blue inside journal entries, on parchment, in the same
role. **The topic vocabulary is a property of the world, not of the conversation** — which is
exactly why a topic learned from one person opens doors with another. Any build that implements
inline links only inside the dialogue window has implemented half of it. `RI-UIX04` owns the journal
screen; this is a note to it, not a requirement on it.

### §F — Rulings this item makes, both reversible

**F1 — Read/unread marking is OFF by default, and it is a setting, not a design.** Vanilla marks
nothing; OpenMW's own default is `false`. Marking read topics grey converts the column from a
*vocabulary* into a *checklist*, and a checklist is the FAQ failure this item exists to prevent —
the player stops reading the prose and starts clearing the list. **Ruling: ship unmarked.**
*Reversible; the evidence that would overturn it is the human gate in §G returning "I could not tell
which of these I had already asked, and it made me stop wanting to ask" from more than one
participant.*

**F2 — The topic column is right-anchored at a fixed width, and the prose takes the remainder
(§B1).** *Reversible; the evidence that would overturn it is a legibility measurement on the
narrowest supported viewport showing the fixed column starves the prose below `RI-UIX06`'s
readability floor — in which case the column gets a min/max clamp, not a percentage.*

## Comparison method

1. **Static, no browser.** Open the six files in §0. For each of §A's six elements, name the
   element's rect in our build and the reference's rect in layout units, and state the anchor. Any
   element absent from our build is a row scored 0; there is no partial credit for "the information
   is available elsewhere in the UI".
2. **The inline-link census, over the shipped answer corpus, headless.** For every answer string our
   build will render, count the spans it marks as links and compare against the set of topics the
   answer's text actually contains. Reuse `tools/dialogue/build-graph.mjs` — it already parses every
   `INFO` and its `AddTopic` edges — and read `topic_graph.tsv`'s `via` column, which is the edge's
   source span. Report **link precision** (marked spans that are real topics) and **link recall**
   (real topics in the text that got marked).
3. **Colour, sampled from our own rendered frame**, not from source constants: five samples each of
   prose body, heading, link, column entry, disposition fill, taken from a captured frame at two
   viewports, reported as ΔE against §C. A source constant that is correct and a render that is not
   is the defect `RI-UIX06` F17–F19 exist to catch.
4. **The translucency check.** Capture the same scene with and without the panel open and confirm
   the panel region is a blend, not a fill. A panel drawn opaque passes every colour check in §C and
   fails §E1.
5. **The human gate, §G.** This is the quality verdict. Everything above it is a leak check.

## Scoring

| Row | 0 | 4 | 8 |
|---|---|---|---|
| §A elements present | ≤3 of 6 | 5 of 6 | 6 of 6, none invented |
| §B anchors | column is a percentage | fixed but not right-anchored | fixed width, right-anchored, prose absorbs the remainder |
| §C1 inline links | no inline links | links present, precision or recall < 0.9 | precision ≥ 0.98 **and** recall ≥ 0.95 |
| §C colour ΔE | any family wrong | ΔE ≤ 8 on all five | ΔE ≤ 4 on all five |
| §D2 two-section column | actions mixed into the alphabetical run | separated, no rule drawn | separated by a rule, actions above |
| §E1 translucency | opaque | translucent, no measurement | measured blend, alpha within 0.05 of 0.84 |
| §G human gate | see §G — this row **cannot be scored by a statistic** | | |

**Hard fail (caps the item at 2 regardless of every other row):** the window renders a list of
selectable *replies* instead of prose with inline links. That is the current build's state, it is
the reason this item was written, and no amount of correct palette redeems it.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 and §1.2a.** The native scale is
the six mechanical rows above (0/4/8 each, so a native 0–48) **capped by §G**. Derived from this
item's own rows; no threshold above was changed to produce it.

| Ladder | 0 | 2 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| Native | the hard fail is met — the window renders selectable replies, so the mechanism is absent whatever else scores | native ≤ 16, or §G not run and the mechanical rows below 24 | native 17–28: the arrangement is recognisable, the inline link is missing or unreliable (§C1 below 0.9) | native 29–40 with §G run and no participant naming a thread at Q3 | native ≥ 41 **and** §G returns, from more than one participant, a named thing they now want to ask about (Q3) with the ablated arm read as worse |

**Aggregation: `min-over-axes`, then gated by §G.** §G is a gate, not an axis: a build may fail on
§G with every mechanical row green; it may never pass on the mechanical rows alone. §G's absence is
`corpus_debt` only until a build exists that can be played — once one does, an unrun §G caps this
item at 2.

### §G — The human gate (Ruling W2 form)

Ruling W2, landed today: **a human gate must show the artefact as a player meets it and ask whether
it is *good*. "Can you tell these apart?" is a leak check and is never the quality verdict.**
`ARBITRATION.md` **S52** then fixes the binding shape of such a gate, and this section adopts it
rather than inventing a second one: **a class-D within-build contrast** — production render,
shipped HUD, no debug overlay; a fresh agent that has read neither this item nor the plan nor the
source, receiving only the URL, the driver protocol and one sentence of premise; the item's own
quality question asked **verbatim** after playing and recorded before any reveal; **an ablated arm
that must read worse**, arm identity quarantined; and a separability check by a **third** fresh
reader, because an inseparable pair is `inert` and cannot pass.

**The ablated arm, and it must be plausible rather than trivially broken** (S52's own binding
clause, and `HAZARDS` §0): *the same window, the same prose, the same topic column, with the inline
links removed and the topics they would have added present in the column from the start.* That is a
build a reasonable team could ship — it is in fact what most dialogue systems do — so a judge who
cannot separate it from ours has told us the inline link is doing no work. An arm with the prose
deleted, or with the column empty, is a broken null and proves nothing.

**S52 also binds the scope:** one played gate per feel system, not one per citing piece. This gate
is the dialogue system's, and `RI-DLG01`, `RI-DLG02`, `RI-DLG03` and `RI-DLG06` read its result
rather than each commissioning their own.

The gate itself: a participant who has not read this item plays **ten minutes** of each arm,
reaching at least three conversations, and is asked, in these words:

1. *Did you find out something you were not told to look for? What was it?*
2. *When you clicked a coloured word, did it feel like following something, or like pressing a
   button?*
3. *Is there anything in this town you now want to ask someone about? Name it.*
4. *Would you want to read another one of these conversations?*
5. *What was the worst thing about it?*

Question 3 is the load-bearing one: it asks whether the window handed the player a **thread they
chose to pull**, which is the whole claim. Answers are recorded verbatim. **A participant who names
nothing for Q3 has met a FAQ**, whatever the link-precision number says.

## How we lose

- **Building the palette and not the mechanism.** Bronze prose, blue links that are decorative, and
  a reply menu underneath. Every colour check passes. This is the current build plus a repaint, and
  the §Scoring hard fail exists for it alone.
- **Colouring by proper noun instead of by topic.** Cheap, looks identical in a screenshot, and
  lies: `Fighters Guild` is bronze in REF-A12c precisely because it is *not* a topic there. A link
  that is not a promise is worse than no link.
- **Turning the column into a checklist** by marking read topics — §F1, and it is the most likely
  thing a modern-UI instinct adds "for usability".
- **Copying the owner's green** because it is in the reference we were handed. §E4. This is the
  standing `RI-VIS09` §6 hazard — *silently improving by improving the reference* — arriving from
  the other direction: silently *degrading* by copying a reference's known defect.
- **Copying the Android chrome.** The hamburger, the pause glyph, the backpack glyph and the
  translucent stick ring in REF-A12c's corners are the OpenMW-for-Android front-end. A census that
  counts them reports nine persistent elements where Morrowind's true figure is six —
  `HUD-OUT-OF-COMBAT` found the same trap from the HUD side and recorded it in `RI-UIX07`.
- **Making the panel fullscreen** because the prose needs room. The world staying visible behind a
  translucent panel is what makes a conversation happen *in a place*. §E1.
- **Scoring this item green off the mechanical rows** without running §G. The rows are a leak check.

## Seam (AR-3)

None. `RI-DLG01` §A already places the entire topic graph outside combat under S13, so this window
never competes with a Souls ruling. `RI-UIX03`'s pause rule governs whether the world steps while
the window is open and is not restated here.

## Provenance note

`provenance: measured`, `confidence: high`.

**Measured** means measured. Every geometry figure in §B is quoted verbatim from
`openmw_dialogue_window.layout`; every colour constant in §C is quoted verbatim from `openmw.cfg`
lines 71–115; and every pixel figure — the 1362×808 panel, the 325 px column, the 320 px
disposition bar, the 23.9%, the glyph-core RGB in §E4, the 3.2× brightening in §E1 — was taken by
script from `REF-A12c-dialogue__mw-owner-20260814.png`, sha256
`e9a0531c5a09e41214ce96136af2c60e11c2ca45b65b6e46c2473b32f66cba6a`, and cross-checked by eye at
full resolution against the five native-engine captures in REF-A12b.

**Where the three sources disagree, this item says so rather than averaging them:** §B records that
`REF-A12/README.md`'s anchor claim is contradicted by both the layout file and the screenshot; §E4
records that the owner's capture has one non-vanilla colour and that the native captures are the
authority for it.

**Confidence is `high` on §A–§D and lower on two specific things**, stated here rather than in the
header so they cannot be skipped: the **UI scale** of REF-A12c (1.93, derived from one 166 px
element) is a single-element estimate and should not be used to derive any other absolute size; and
the **0.84 transparency** in §E1 is OpenMW's documented default, not a value measured from this
frame — the frame shows *that* the panel is translucent, not by how much.

**Untested.** No build has been scored against this item and §G has never been run. The most likely
correction is that §C1's recall floor of 0.95 is too strict for authored prose, where a topic name
can appear in a grammatical form the matcher does not recognise; if so, the fix is a stemming rule
in the matcher and a stated floor, not a lowered number.
