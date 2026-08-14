# W1-DLG-TOPIC-WEB — topics unlocking topics, as something a player can see happen

Plan-State: awaiting-recriticism — materially edited 2026-08-14 by a fresh reviewer-editor at
`e2a7a1a8`. Under `PLAN-LOOP.md` rule 1 the editing task may not also approve; a **different**
fresh reviewer-editor judges this version.

**Owner's ask, which is what this plan exists to serve:** *in Morrowind, asking about one subject
adds new subjects to your list — the conversation branches outward as you pull threads, and that is
a large part of why it feels like investigating a place rather than reading a FAQ.*

**Do not build from this plan yet.** It commissions no work until a fresh reviewer-editor marks it
satisfied.

---

## 0. Reviewer-editor round 1 — what was changed and why, so the next reviewer can attack it

The draft's central design decision — *every numeric row is a gate that can only fail, because an
edge count would have passed this build today* — is upheld and is the best thing in it. Nine
material defects were found underneath it. Each is repaired in place; each is listed here so the
next reviewer can start with the repairs rather than rediscover the draft.

| # | Defect in the draft | Repair |
|---|---|---|
| **R1** | **Every figure in §1 was unreproducible and no commit was stamped**, in a plan whose own §5 says "All figures are claims about a commit; stamp it". At `e2a7a1a8` the census is **1,605 `addTopic` occurrences / 1,277 distinct edges** (draft: 1216), **10.5% strict** (draft: 6.7%), **15.9% loose** (draft: 10.0%), **470 topics** (draft: 471), **23 `name` fields** (draft: 14). | §1 re-measured and stamped, with the command that reproduces each figure and the unit each is in. |
| **R2** | **"Every headline number RI-DLG01 §D names is green" is false.** `median_depth` is **2**; §D's row reads target ≥ 3, **fail below … 2**. The plan's premise sentence overstates the health of the thing it is about. | §1 corrected; median depth added to the regression gate. |
| **R3** | **"the rest would render as a slug, `the-tally-of-the-dead`" is false.** `converse.js topicLabel()` is the only labeller in the tree and it is `String(id).split('-').join(' ')` — the player already sees *the tally of the dead*. Worse for the draft's A2: **`t.name` is read by nothing in `game/src/`**. Authoring 447 `name` fields would have shipped an eighteenth model nothing reads, in the plan whose §4E exists to prevent exactly that. | A2 rewritten: it now binds on **labels that are wrong**, not on a field that is absent, and its first deliverable is the reader that makes `name` load-bearing. |
| **R4** | **Step D duplicated a live sibling.** `orchestration/status/W1-UIX08-dialogue-window.json` is a **builder in flight** owning "the dialogue WINDOW (chrome/layout/topic-link mechanism)". The draft's step D implements `RI-UIX08` §A–§D and its A3/A4 are `RI-UIX08` §C1's own rows. Two builders in `game/src/render/ui.js` is Ruling O1's exact failure. | **Seam ruled in §2a.** Step D, rows A3/A4 and the played gate leave this plan. This is also the single largest cost saving available here. |
| **R5** | **The unlock's firing moment was never stated**, and it decides everything. Today `to` auto-grants on *reading* the answer (`conversationSay → learnTopics`). Whether the repair is editorial (write more words) or structural (grant on the *click*) turns on this, and so does the seam with the window. | **Ruled in §2b, reversible, with a falsifier.** |
| **R6** | **Step C authorised deleting edges with no budget**, and the "headroom" argument is thinner than it reads. Measured: of 1,115 invisible edges, **770 can be deleted without creating an orphan**, and taking that headroom lands topic→topic mean non-leaf out-degree at **2.02** against §D's floor of 2.0 — while visibility still only reaches **32%**. Deletion cannot reach A1 and can eat the whole margin. | §4C carries a **hard deletion budget of 200 edges**, derived and shown. |
| **R7** | **A5's regression gate named 3 of §D's 13 rows.** A step that may remove hundreds of edges was to be checked on out-degree, depth and orphans only. | A5 now re-runs the **whole** §D table, and names median depth, leaf fraction, convergence and per-settlement answerable explicitly. |
| **R8** | **`via` is not a source span.** `build-graph.mjs` writes the literal strings `AddTopic` / `greeting_text` into that column. The draft's §7 and `RI-UIX08`'s own comparison-method step 2 both describe it as "the edge's source span"; a builder would look for spans there and find none. The text is in `infos.tsv`'s `text` column. | §7 corrected; the corpus error named in §9 as an owed edit. |
| **R9** | **A whole failure mode was missing, and it is the owner's complaint in its most direct form.** Through the shipping reader, with the nine roots known: **217 of 408 NPC records (53.2%) offer no topic of their own** — the median person in the province advertises **zero** subjects beyond the nine you started with, and **3 offer nothing at all**. A build can pass every row the draft wrote and still hand the player nine words and a province of people who only echo them. `W1-DLG-WORDS`'s handoff line ("257 of 336 … belongs to whoever owns reachability") is this, and it is **ruled into this piece** (§2c). | New acceptance row **A7**. |

Two smaller corrections: `ARBITRATION.md` resolves to `corpus/00-doctrine/ARBITRATION.md`, not the
repository root (a path `RI-VIS09`'s compliance check would hard-fail); and `W1-DLG-WORDS` is
`state: complete`, not in flight, so §2's coordination clause is rewritten as a handoff rather than
a live collision.

**What was checked and found sound, so the next reviewer does not re-pay for it:** the rule-10
instrument claim (nothing in `tools/` computes visibility today — `build-graph.mjs` is the right
host and a second implementation would be a duplicate); the S51 disconnected-script test on the
played gate (class D, both arms rendered play, no table encodes the answer — admissible, and S51
explicitly does not touch class D); and the draft's rejection of the three simpler nulls, which is
correct and is kept verbatim.

---

## 1. The one-paragraph reason this piece is not what it looks like — re-measured at `e2a7a1a8`

**The graph is already built and it has most of the shape RI-DLG01 asks for.**
`node tools/dialogue/build-graph.mjs` at `e2a7a1a8`: **470** nodes, **1,630** edges, mean non-leaf
out-degree **3.98**, `reachable_only_via_another_topic` **0.9809**, `max_depth` **7**, leaf fraction
**0.223**, convergence **0.619**, **zero** orphans, **zero** unreachable INFOs, `menu_quest_fraction`
**0.20**.

**One §D row is not green and the draft said they all were:** `median_depth` is **2**, against §D's
*"Median depth from greeting — our target ≥ 3 — fail below 2"*. It sits on the fail value. Nothing
in this plan repairs it directly and nothing here may make it worse; it is named so a reviewer is
not told the graph is clean when it is not.

**And the mechanism the owner described is 10.5% present.** Of the **1,605** `addTopic` occurrences
in `game/data/dialogue/topics/` (**1,277** distinct source→destination pairs), the destination's
player-visible label occurs literally in the text of the answer that unlocks it in **168** cases —
**10.5%** of occurrences, **12.7%** of distinct edges — and **15.9%** under a deliberately generous
matcher that only requires every content word to appear somewhere in the answer. **1,437 unlocks are
invisible.** A topic silently appears in the list; the player was never shown the word, so there was
nothing to notice, nothing to click, and nothing to pull.

**Two corrections to the draft's supporting claims, both load-bearing:**

- **Topics do not render as hyphenated slugs.** `game/src/character/converse.js topicLabel()` is
  the only labeller in the tree and de-slugs: the player sees *the tally of the dead*. What is
  actually broken is narrower and sharper — the label is **lower-cased word-for-word from the id**,
  so every proper noun in the province loses its capital (`RI-UIX08` §A4 requires *"lower-case as
  authored except where the topic is a proper noun"*), and where an id and its intended wording
  differ the wording is lost. **23** topics carry a `name`; 21 of them merely restate the de-slugged
  id; only 2 say something the id does not.
- **`name` is read by nothing.** `grep -rn` over `game/src/` finds no consumer for a topic record's
  `name`. Authoring it wholesale before wiring it is the RI-MTH07 failure this project has committed
  eighteen times.

**The framing the draft got right, and it is kept:**

> **Statistics can fail this build and can never pass it.** Counting how many topics unlock other
> topics is necessary and nowhere near sufficient — 1,630 edges is already true and the thing the
> owner asked for is not. Every numeric acceptance below is a **hard fail / gate**.
>
> **And the enforcement is not this plan's assertion — it is `RI-UIX08`'s aggregation clause**:
> *"§G is a gate, not an axis … once a build exists that can be played, an unrun §G caps this item
> at 2."* A build critic that finds A1–A7 green and no played gate result may not score above 2.
> The draft asserted the same thing without naming what enforces it; a plan-local assertion is not
> a gate.

Reproduce before doing anything else — one second each:

```
node tools/dialogue/build-graph.mjs --out /tmp/dlg          # the §D topology
node tools/dialogue/build-graph.mjs --out /tmp/dlg --visibility   # once §4B has added it
```

---

## 2. Authority and reconciled state

**Governing items — read them complete, not summarised here.**

| Item | Owns | What this plan must satisfy |
|---|---|---|
| `corpus/40-dialogue/RI-DLG01-topic-graph.md` | the **graph** — which topics exist, the filter stack, `AddTopic` as the edge, §D's topology targets | 12 of 13 §D rows are green and must not regress; median depth is already at its fail value; §D is never evidence for §6 |
| `corpus/86-ui/RI-UIX08-dialogue-window.md` | the **window** — inline links, the topic column, disposition, the panel | this plan supplies the window's input and reads its §G result; §C1's precision/recall and §A's six elements are **the window piece's rows**, not this one's |
| `corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md` | disposition as a number | untouched here |
| `corpus/86-ui/RI-UIX04-journal-ui.md` | the journal screen | `RI-UIX08` §E5's journal links — **out of scope**, named so a later piece picks it up |
| `corpus/00-doctrine/ARBITRATION.md` **S13** | topics are unavailable in combat | nothing here reaches into a fight |
| `corpus/00-doctrine/ARBITRATION.md` **S51**, **S52**, **Ruling W2** | admissible counterparts; the shape of a played gate; a human gate asks whether it is *good* | §6 inherits the dialogue system's single played gate rather than commissioning a second |

### 2a. The seam with `W1-UIX08-dialogue-window` — ruled, because a sibling is already building

`orchestration/status/W1-UIX08-dialogue-window.json` is a **live builder** owning the window and,
in its own words, "the topic-link mechanism". The draft's step D implemented the same section of
the same item into the same files. Under Ruling O1 that is the dispatch error that has silently
reverted three agents' work. **Ruling, and it is the answer to "which piece owns what":**

> **This piece owns making an unlock visible *in the text*. `W1-UIX08` owns *rendering it as a
> link*.** Content and instrument here; pixels and interaction there.

| | This piece (`W1-DLG-TOPIC-WEB`) | `W1-UIX08-dialogue-window` |
|---|---|---|
| Owns files | `game/data/dialogue/topics/**`, `tools/dialogue/**` | `game/src/ui/**`, `game/src/render/ui.js`, the `topic_link` surface role |
| Owns rows | A1, A2, A5, A6, A7 (below) | `RI-UIX08` §A/§B/§C/§D/§E1, and §C1's link precision ≥ 0.98 / recall ≥ 0.95 |
| Owns the played gate | **no** — reads its result | **yes** — `RI-UIX08` §G, one gate for the dialogue system (S52) |
| Never edits | anything under `game/src/` | anything under `game/data/dialogue/` |

**The contract between them is machine-checkable and is this piece's deliverable, not a
conversation.** `--visibility` (§4B) emits, for every answer the build will render, the list of
`(destination topic, player-visible label, character span in this answer's text)`. That file is
the window's input.

- **This piece guarantees:** every `to` destination of a rendered answer has a resolvable
  player-visible label, and (subject to A1's exception budget) that label occurs literally in that
  answer's text at a stated span.
- **The window guarantees:** every such span is drawn in the `topic_link` role and nothing else is
  — which is precisely `RI-UIX08` §C1's precision and recall, measured against this file.
- **Neither may satisfy its row by editing the other's files.** A window that reaches recall 0.95 by
  colouring proper nouns has broken the contract from its side; a content edit that raises A1 by
  deleting the window's spans has broken it from this side.

Handoff mechanics: the seam is agreed by `SendMessage` to the live `W1-UIX08` agent (Ruling O1
requires the message, not a new agent), and this plan does not begin step C until that agent has
acknowledged the contract's shape or the orchestrator has ruled otherwise in writing.

### 2b. When does the unlock fire? — ruled, reversible

Unstated in the draft, and it decides whether A1 is a writing job or an architecture job. Today
`Engine.conversationSay()` calls `learnTopics(topicsKnown, [topic, ...to])` — **every `to` grants on
*reading* the answer**, whether or not the player saw the word.

> **Ruling: the unlock fires on the click.** A destination whose label appears in the answer is
> granted when the player clicks that span, not when the answer is read. Auto-grant-on-read survives
> only as A1's stated exception budget — an unlock by *implication* — and each survivor must be
> authored deliberately with an `implied: true` flag on the `to` entry, so the exception is a
> choice a writer made and a number a census can count, rather than the silent default it is today.

Why: it makes A1 **structural instead of editorial**. If clicking is the only route, an invisible
unlock cannot exist by accident, and the 90% floor becomes a budget for the deliberate 10% rather
than a prose-rewriting quota over 1,400 answers. It is also what Morrowind does.

**Reversible.** The reversal is one line — restore the unconditional `learnTopics` call.
**Falsifier:** if the played gate returns participants who found the column *stopped* growing in a
way they disliked — i.e. click-only makes the world feel narrower rather than pulled — then
auto-grant is doing real work and the right shape is grant-on-read *plus* a visible marker, not
click-only. The mechanism change itself is `W1-UIX08`'s file (`game/src/engine.js` / the window);
this plan supplies the data contract and the census that says whether it is honest.

### 2c. Where the "nothing to ask" defect belongs — ruled

`W1-DLG-WORDS` (`state: complete`) closed with: *"whether these lines reach a player's ear is a
reachability question (257 of 336 NPC records carry actor names no root topic is written for) and
belongs to whoever owns reachability."* Re-measured through the shipping reader at `e2a7a1a8`, with
the nine roots known and a neutral player: **217 of 408 NPC records (53.2%) offer no topic of their
own**, median own-topics **0**, and **3 offer nothing at all**.

> **Ruling: it belongs here, not to the dialogue-text piece.** The words exist; what is missing is a
> route from a person to them, which is the topic web. It lands as row **A7**.

**Reversible.** **Falsifier:** if the repair turns out to require new *answers* rather than new
`npc.topics` wiring for answers that already exist, the work is `W1-DLG-WORDS`'s successor's and
this row becomes a handoff with a number attached.

**What is landed and must be preserved.** The 470-topic graph, its authored INFO order and the
S37 scoring reader, `tools/dialogue/build-graph.mjs` and its four outputs, `consume.mjs`'s
field-by-field consumption table, the nine root topics, and `W1-DLG-WORDS`'s landed rewrite of 123
answer lines. **This plan changes no answer's meaning**; it changes which words in that text are
present and marked, and it commissions labels and `npc.topics` wiring.

**What is stale.** Any statement that the topic web is done because the graph metrics are green.
`docs/PLAN.md`'s dialogue rows and `orchestration/plans/W1-17.md` both predate the visibility
census and neither knew the figure.

---

## 3. The references the builder and the critic will actually look at

**The owner asked directly whether the builder and critic of this UI work would look at a Morrowind
reference. The honest answer for every previous round is no — they had nothing to look at, because
`RI-VIS09` §2's routing table gave `RI-UIX*` only the OpenMW layout XML and said in terms it must
not be cited for appearance, and `RI-VIS09` §3.5 and `REF-A12/README.md` both still stated the
appearance reference did not exist. It did. It has since 2026-08-06.**

`RI-UIX08` §0 is a table of five reference paths with what each may and may not be cited for.
**Under the §2a seam, the five appearance references are `W1-UIX08`'s prerequisite, not this
piece's** — this piece renders nothing. What this piece must open is the one that is about
*content*:

- `corpus/70-visual/refs/morrowind/REF-A12c/REF-A12c-dialogue__mw-owner-20260814.png` — for a single
  purpose here, and it is the best evidence we hold of what "good" looks like as *writing*: one
  Morrowind answer carries roughly sixty blue spans inside running prose, and `Mages Guild` is blue
  in the same paragraph in which `Fighters Guild` is bronze. **Count the links per answer in that
  frame and use it as the density this corpus is aiming at** (§5, A1's sanity check).

**Enforcement, so this cannot be skipped quietly:** the builder's first deliverable is a one-page
reading note naming the file, what it took from it, and one thing it decided *not* to copy; it lands
before any content edit. The critic's verdict records whether it opened it. `RI-VIS09`'s compliance
check already hard-fails a claim that cannot resolve a reference path.

**The two named traps** — the owner's green topic list (a mod or a setting; build bronze `#CAA560`)
and the OpenMW-for-Android chrome in the corners — belong to `W1-UIX08` and are repeated here only
so a reader of this plan does not carry them across the seam.

---

## 4. The work, in the cheapest order that can invalidate the rest

Ordered so a cheap headless gate can kill an expensive branch. **Nothing in this piece opens a
browser at all** — that is the §2a seam's largest saving.

**A. Make the label real, then make it right (code seam + data; no browser).**
Two parts, in this order, and the first is small:

1. **Give `name` a reader.** `topicLabel(id)` becomes `topicLabel(record)` — the authored `name`
   when present, the de-slugged id otherwise — and `topicsFor()` passes the record. One function,
   one call site. Until this lands, every `name` in the corpus is decoration. *This is the one edit
   this piece makes under `game/src/`; it is a two-line change in
   `game/src/character/converse.js`, it is outside `W1-UIX08`'s owned files, and it is announced
   over the seam before it lands.*
2. **Author a `name` only where `topicLabel(id)` is wrong** — proper nouns that need their capital,
   and ids whose wording is not what a person would say. Baseline: 23 authored, 21 of them
   redundant. This is a bounded review of 470 ids, not 447 new fields.

**B. Extend the existing instrument — do not write a second one (rule 10).**
Nothing in `tools/` computes visibility today; `tools/dialogue/build-graph.mjs` already parses every
INFO, its `x` text and its `to` array and already emits the text in `infos.tsv`. Add `--visibility`,
reporting per edge whether the destination's label occurs in the source answer's text under both the
strict and the loose matcher, and writing `visibility.tsv` (`src, dst, label, matcher, char_start,
char_end`) plus three fields in `metrics.json`. **`visibility.tsv`'s span columns are the §2a
contract file**, so the window has something to consume.

**It must be able to fail: run it against `e2a7a1a8` first and confirm it reports 10.5% / 15.9%, not
100%.** A visibility probe that cannot report today's tree as broken is not a probe. State the
matcher's fold rules (case, apostrophes, hyphens) in the tool's header, because `RI-UIX08`'s own
"Untested" note predicts the recall floor will be argued over morphology.

**C. Author the missing links — with a budget (content; no browser).**
For every edge whose destination is invisible: write the destination's label into the source
answer's prose, mark the `to` entry `implied: true`, or **delete the edge**.

**The deletion budget is 200 distinct edges and it is a hard cap.** Measured at `e2a7a1a8`: of the
1,115 invisible distinct edges, 770 can be deleted without orphaning their destination, and taking
that headroom lands topic→topic mean non-leaf out-degree at **2.02** against §D's floor of **2.0** —
while visibility still only reaches **32%**. So deletion cannot reach A1 and can consume the entire
margin.

| edges deleted | topic→topic mean non-leaf out-degree | visibility |
|---|---|---|
| 0 (today) | 3.50 | 12.7% |
| 200 (**the cap**) | 2.96 | 15.0% |
| 500 | 2.57 | 20.8% |
| 770 (max without orphaning) | 2.02 | 32.0% |

*(These are topic→topic edges only. `build-graph.mjs`'s headline 3.98 includes greeting, rumour and
journal edges; the two numbers are in different populations and a builder must not compare them.)*

Re-run `build-graph.mjs` after this step — **the whole §D table, per A5.**

**D. `npc.topics` reach (data; no browser).** Wire the 217 records that advertise nothing of their
own to subjects that already have answers. This is a rehoming job over existing content, and
`tools/dialogue/rehome-actors.mjs` already exists for exactly this shape of edit — read it before
writing anything.

**E. CONSUMPTION (`RI-MTH07`, mandatory under `ARBITRATION.md` §3) — extend, do not clone.**
`tools/dialogue/consume.mjs` **already** names the world-side reader of `to` and breaks it
(`to → Engine.conversationSay() → learnTopics`). The draft commissioned a `control-clone` run for a
perturbation an existing headless tool already performs. **Add the new fields to `consume.mjs`'s
table instead:** `name` (reader: `topicLabel`, after A1) and each `to` entry's `implied` flag. Run
it against HEAD **before** step A and confirm it reports `name` as having **no reader** and exits
non-zero — that is the cheapest possible red arm and it is the one the draft's own §4E argument
demands.

**F. Read the played gate's result.** The gate is `W1-UIX08`'s (§6). This piece supplies the arms'
content and consumes the verdict.

---

## 5. Acceptance — every row is a **gate**, and the pass lives in `RI-UIX08` §G

Predicate, units and population, so a build critic is never arguing about what was meant. **All
figures below are claims about `e2a7a1a8`**; a build re-measures and re-stamps.

| # | Predicate | Units | Population / denominator | Baseline at `e2a7a1a8` | Gate |
|---|---|---|---|---|---|
| **A1** | destination topic's player-visible label occurs literally in the source answer's rendered text, strict matcher | % of **`addTopic` occurrences** (each `to` entry of each INFO; **not** distinct pairs) | **1,605** occurrences over `game/data/dialogue/topics/**` | **10.5%** (168/1,605); 12.7% on the 1,277 distinct pairs | **≥ 90%**; below 90% is a hard fail |
| **A1b** | the residue is *authored* as implication, not left silent | count | every occurrence failing A1 | **0** flagged | **every** A1 failure carries `implied: true`; an unflagged invisible unlock is a hard fail |
| **A2** | the player-visible label is correct — authored `name` where the de-slugged id is wrong, and read by `topicLabel` | boolean + % of topics | all **470** topics | `name` has **no reader**; 23 authored, 21 redundant | **`topicLabel` reads `name`** (hard fail if not), **and** 0 topics whose rendered label is wrong under a named review of all 470 |
| **A5** | RI-DLG01 §D topology after steps C and D | as §D defines, **all 13 rows** | the whole graph | out-degree 3.98, max depth 7, **median depth 2**, leaf 0.223, convergence 0.619, orphans 0, unreachable INFOs 0 | **no regression on any row**; specifically out-degree ≥ 3.0, max depth ≥ 6, **median depth ≥ 2**, leaf fraction ≤ 0.50, convergence ≥ 0.20, orphans 0, unreachable INFOs 0 |
| **A5b** | deletions taken in step C | count of distinct edges | the 1,115 invisible edges | 0 | **≤ 200**; above 200 is a hard fail even if A5 is green |
| **A6** | CONSUMPTION: perturbing `to`, `name` and `implied` each changes what the shipping reader returns | boolean per field | `tools/dialogue/consume.mjs` | `to` demonstrated; `name` **has no reader** | **all three must change**; a field that changes nothing is the model nobody reads |
| **A7** | NPC records offering at least one topic of their own (beyond the nine roots), via `topicsFor()` | % of records | **408** records in `game/data/npcs/**`, neutral player, roots known | **46.8%** (191/408); 3 offer nothing at all | **≥ 85%**, **and** 0 records offering nothing at all |

**Rows that left this plan under §2a:** the draft's A3 and A4 (`RI-UIX08` §C1 link precision ≥ 0.98
and recall ≥ 0.95) are the window's, measured against this piece's `visibility.tsv`. They are named
here so a reviewer can see the bar is not lost, only re-homed.

**A1's 90% is a floor, not a target, and here is the reasoning so a reviewer can attack it:**
100% is wrong because some edges legitimately model a topic learned by *implication* — Morrowind
does this, and forcing every unlock to be a visible keyword would flatten prose into a list of
nouns. 90% leaves roughly 160 occurrences of that kind and makes the invisible unlock the exception
a writer has to **flag** (A1b), which is the opposite of today. **The number is also checkable
against a real artefact rather than taste:** REF-A12c shows one Morrowind answer carrying roughly
sixty inline links, and a builder who finds our answers cannot carry that density without reading
like a keyword list has found evidence, and should write it into this file rather than quietly miss
the floor. **If a reviewer thinks the right number is 80% or 95%, that argument is worth having
now** — it costs a paragraph here and a build round later.

---

## 6. The played gate is inherited, not commissioned — and the null control, repaired

**Under S52 there is one played gate per feel system, not one per citing piece.** The dialogue
system's gate is `RI-UIX08` §G and it belongs to `W1-UIX08`, which is building the window a player
would meet. **This plan commissions no played gate.** It supplies the content of both arms, and it
reads the result. That is the §2a seam applied to the most expensive line item in the draft, and it
is the answer to `PLAN-LOOP.md` rule 3's second question: a second ten-minute-per-arm driven gate,
recruiting three fresh readers, to test the same mechanism as the sibling's, is duplicated evidence.

**What this piece owes the gate, and it is the part the draft got right — keep it.** The ablated arm
must be *plausible*, not trivially broken. The draft's rejection of the three tempting nulls is
correct and is preserved verbatim:

- *Links removed and topics never granted.* The ablated player has an empty column and fails because
  the content is gone, not because the mechanism is. Trivially broken.
- *All 470 topics granted at the start.* The ablated player drowns and fails for a third reason.
  Trivially broken.
- *The prose deleted.* Not a null at all.

**The ablation, restated so it is implementable — and this is the draft's one unbuildable
sentence.** The draft asked for topics "granted at exactly the moment it would have been unlocked".
Under §2b that moment is *the player's click*, which does not exist in an arm with no links, so
"the same moment" is undefined and a builder would have to guess. The implementable form:

> **The ablated arm is the same build, the same prose, the same column, the same disposition, with
> the link marking removed — and every `to` destination of an answer granted into the column the
> instant that answer is displayed.** Keyed on *the answer being read*, which both arms share, not
> on a click only one arm has. That is exactly today's `learnTopics`-on-read behaviour with the
> colour turned off, which is why it is a build a reasonable team could ship — it is what most
> dialogue systems do — and it is one revert away, so `tools/control-clone.mjs` builds it as a
> hard-linked clone with `game/data/dialogue/**` declared `--writable`.

**Availability then differs between arms in exactly one direction and it must be reported, not
hidden**: a shipped-arm player who does not click gets *fewer* topics than the ablated player. That
is the mechanism, not a confound — the ablated arm is strictly more generous with availability and
still has to read worse. A judge who prefers the ablated arm *because it had more topics* is the
result that overturns §2b's ruling, and the gate must record the reason, not only the ranking.

**What it looks like if the control is inert, and the check can actually fire.** The two arms read
the same to the judges. That is **`inert`, and it cannot pass** — it says the inline link is doing
no work, and the response is to fix the instrument or the build, never to record a pass. Rule 6's
second failure mode — a control you have never seen fail — is one this project has already been
caught by, so **before the gate runs, confirm the ablation executed** by running the window's link
census against the ablated build. **Report recall, not precision**: with zero marked spans precision
is `0/0`, which reads as `NaN` or as `1.0` depending on the guard and would be recorded as a pass by
either. Recall goes cleanly to 0.

**S51.** The gate is a **class-D within-build ablation contrast** — both arms ours, differing by
exactly the mechanism under test, judged on the artefact as a player meets it. Against the
disconnected-script test — *could a short script that has read the tables reproduce the judge's
answer?* — no: the answers are free text to `RI-UIX08` §G's five questions after ten minutes of
play, and no table encodes *"is there anything in this town you now want to ask someone about?"*
S51 names class D as admissible and says in terms that it does not touch it. **Two conditions from
S51 still bind and must appear in the gate's record:** the arms are generated through the runtime a
player uses, and the design columns are stripped. And a class-D contrast may never be filed as a
reference pair: the honest record for the reference arm is `blind_status: not_possible` with the
reason, because no external Morrowind topic-unlock trace exists in this corpus.

**Ruling W2.** The separability check by a third fresh reader is a **leak check on the ablation, not
the quality verdict**. Question 3 — *"Is there anything in this town you now want to ask someone
about? Name it."* — is the load-bearing one, and **a participant who names nothing for Q3 has met a
FAQ**, whatever A1 says.

**A cheap instrument this piece does own, because the gate is not ours to schedule.** `PLAN-LOOP.md`
rule 3 asks for the minimum sufficient evidence, and this piece can fail cheaply long before the
sibling's browser is free: a **text pack of ten real answers** — the same ten answers before and
after step C, as a player would read them, links shown as they will render — put to a fresh reader
with the single question *"after reading this, name something you would want to ask someone about"*.
Class C under S51 (authored artefacts of the same kind as the thing judged, written independently of
the acceptance thresholds), no browser, and it goes red the moment step C produces prose that reads
like a keyword list — the exact failure A1's floor risks. **It is a leak check and a stop condition,
never a pass**; the pass is `RI-UIX08` §G's.

---

## 7. Instruments reused, by path — and the one extension

| Instrument | Path | Role | New? |
|---|---|---|---|
| topic-graph dump and topology | `tools/dialogue/build-graph.mjs` | §D metrics; A5's regression gate; the parser A1 needs. **The answer text is `infos.tsv`'s `text` column** — the `via` column is the literal string `AddTopic`/`greeting_text` and is **not** a source span, whatever `RI-UIX08`'s comparison method step 2 says | **existing** — extended with `--visibility` (§4B), not duplicated |
| CONSUMPTION harness | `tools/dialogue/consume.mjs` | A6, field by field, headless — already covers `to`; gains `name` and `implied` | existing — extended, not cloned |
| answer census / perturbation | `tools/dialogue/answer-census.mjs` | `--diff` before/after step C, so a content edit that silently changes what people say is visible | existing |
| actor rehoming | `tools/dialogue/rehome-actors.mjs` | A7's `npc.topics` wiring — read it before hand-editing | existing |
| delete-the-fix clone | `tools/control-clone.mjs` | §6's ablated arm, hard-linked with `game/data/dialogue/**` declared `--writable` | existing |
| the unused seam | `game/src/ui/surface.js` (`topic_link`, line 46) | referenced only by `surface.js` and `tools/analysis/ui-census.mjs`; **`W1-UIX08` uses it, not this piece** | existing, unreferenced |

**No new tool is commissioned.** If a reviewer finds one is genuinely needed,
`orchestration/TOOL-LOOP.md` governs and it must be able to fail (rule 24).

---

## 8. Builder / critic execution allocation

Per `orchestration/plans/BUILDER-EXECUTION-CONTRACT.md`.

**The builder owns:** steps A–E; the `--visibility` extension including its red-arm demonstration
against `e2a7a1a8`; the `consume.mjs` red arm on `name` **before** step A; the reading note in §3;
all content edits; A1, A1b, A2, A5, A5b, A6 and A7 run to green; the seam message to the live
`W1-UIX08` agent; the ablated arm's content; and text-only reproduction evidence. The builder keeps
repairing until those rows pass in the run.

**The fresh critic owns:** independent replay of every row over its full population; the §6 text
pack's construction *or* its judging but never both (rule 25); hard-fail assessment; score and
verdict; and reading `RI-UIX08` §G's result across the seam rather than re-running it.

**The critic does not repair game code** (`PLAN-LOOP.md` rule 23). On FAIL it leaves an executable
remediation specification covering every material gap, not only the one the verdict schema ranks
`biggest_gap`.

**Model choice** (`PLAN-LOOP.md` §4): step A2 (label review over 470 ids), step C's writing pass and
step D's rehoming are mechanical content work with machine-checkable acceptance and belong on
**Sonnet**. Step A1's reader change, step B, the seam ruling, the plan reviewer-editor and the critic
are Opus.

**Estimated cost, for the reviewer to attack:** with the browser, the played gate and `RI-UIX08`
§A–§E removed to the sibling, this is a headless content-and-tooling piece. The draft's version
carried a ten-minute-per-arm driven gate, three recruited readers and a full window implementation;
removing them is the single largest saving available and it removes a Ruling O1 file collision at
the same time.

---

## 9. What this plan does not do, said plainly

- **It does not render anything.** `W1-UIX08` owns the window, the `topic_link` role, the colours,
  the two-section column, translucency and §C1's precision/recall. §2a is the seam.
- **It does not commission a played gate.** S52: one per feel system. It reads `RI-UIX08` §G's.
- **It does not touch what characters mean.** `W1-DLG-WORDS` (complete) rewrote 123 lines; this adds
  keywords to prose and must not change an answer's sense. `answer-census.mjs --diff` is the guard.
- **It does not implement journal links.** `RI-UIX08` §E5 records that Morrowind puts the same blue
  links inside journal entries and that a build with links only in the dialogue window has
  implemented half the idea. `RI-UIX04` owns the journal screen; a named handoff, not scope creep.
- **It does not settle read/unread marking.** `RI-UIX08` §F1 rules it off by default and reversibly;
  this plan inherits that ruling.
- **It does not repair `median_depth`.** It is at §D's fail value today, this plan names it and
  guards it, and no step here shortens the distance from a greeting to a quest resolution. That is
  the topic-graph piece's, and it is owed.
- **Two corpus edits are owed and are not performed here**, so this plan stays one-step reversible:
  `RI-UIX08`'s comparison method step 2 describes `topic_graph.tsv`'s `via` column as "the edge's
  source span" and it is not one; and `RI-DLG01` §D's median-depth row has never been enforced by a
  gate. Both are named for their item owners.
- **It does not claim the graph is bad.** The graph is good and its author should be told so. What
  is missing is the half a player can see.

---

## 10. The weakest joints in this plan, named by its reviewer-editor

`PLAN-LOOP.md` asks every plan to end by naming what it is least sure of. The draft had no such
section; here is one.

1. **A1's 90% may be unreachable without prose that reads like a keyword list.** This is the
   likeliest way this piece fails while every row goes green — 1,437 invisible unlocks is a very
   large writing job, and the incentive under a ratio predicate is to stuff nouns. §6's text pack
   exists as the cheap stop condition for exactly this, and it is the thing a next reviewer should
   press hardest. If it fires, the honest repair is a lower floor with a *higher* `implied` bar, not
   worse prose.
2. **§2b's click-only ruling is the biggest single change and it is one call.** It is reversible in
   one line and its falsifier is written, but it changes a shipped behaviour on the strength of a
   reference reading rather than a measurement, and the measurement that would settle it is the
   played gate — which is the sibling's, and later.
3. **The 200-edge deletion cap is derived from a topic→topic graph, not from `build-graph.mjs`'s
   population.** The relationship between the two out-degree figures (3.50 and 3.98) is a fixed
   offset only as long as greeting and rumour edges are untouched. A builder who deletes an edge
   that is *also* a rumour's `adds_topics` breaks that assumption, and this plan does not detect it.
4. **A7's 85% floor is chosen, not derived.** RI-DLG01 §D has no row for "topics a given person
   offers"; Morrowind's own figure is unmeasured here. 85% is the level at which a player stops
   meeting people who only echo the nine roots, and it should be re-derived from the Balmora
   reference by whoever can measure it.
5. **The seam in §2a is ruled, not agreed.** A live sibling has not yet answered. If it has already
   built against the draft's step D, this plan concedes the overlap to the sibling and keeps only
   the contract file — say so plainly rather than fight for the row.
