# W1-DLG-TOPIC-WEB — topics unlocking topics, as something a player can see happen

Plan-State: awaiting-recriticism — materially edited 2026-08-14 by reviewer-editor **round 2**
(`plan-review2-w1-dlg-topic-web`) at `7b05e65e`, on top of round 1's edit at `e2a7a1a8`. Under
`PLAN-LOOP.md` rule 1 the editing task may not also approve; a **third** fresh reviewer-editor
judges this version.

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

## 0b. Reviewer-editor round 2 — what was changed, and what was attacked and survived

Round 2 re-measured every figure round 1 published, at `7b05e65e`, with an independently written
census rather than round 1's. **`game/data/dialogue/` is byte-identical between `e2a7a1a8` and
`7b05e65e`** (`git diff --stat e2a7a1a8..HEAD -- game/data/dialogue/` is empty), so any difference
is a difference of instrument, not of tree.

**Round 1's figures substantially reproduce, which is the opposite of what round 1 found about the
draft, and it should be said plainly.** Independent re-measurement: mean non-leaf out-degree
**3.9836**, leaf **0.2234**, `reachable_only` **0.9809**, max depth **7**, **median depth 2**,
convergence **0.6191**, orphans **0**, unreachable INFOs **0**, `menu_quest_fraction` **0.20** —
identical. Topic→topic mean non-leaf out-degree **3.488**, against round 1's 3.50 — reproduces.
**470** topic ids, **23** `name` fields of which **21** merely restate the de-slugged id —
reproduces. `topicLabel(id)` is `String(id).split('-').join(' ')` and `name` has no reader —
reproduces. **`RI-UIX08`'s aggregation clause exists verbatim** at its `## Scoring` section:
*"§G is a gate, not an axis … once a build exists that can be played, an unrun §G caps this item at
2."* **S51's class-D reading is correct**: S51's own text names *"(D) A within-build ablation
contrast … and **this ruling does not touch it**"*, and the two conditions round 1 added to the
gate's record (generated through the runtime a player uses; design columns stripped) are S51's own
two binding conditions, quoted correctly.

**And the null control's two round-1 repairs both hold in the current text and both are sound.** The
unlock keys on *the answer being displayed*, which both arms share — buildable. The self-check reads
**recall**, and the reasoning given (zero marked spans ⇒ precision `0/0` ⇒ `NaN` or `1.0` ⇒ recorded
as a pass) is correct. Against `HAZARDS` §0b's one-sided-guard test — *what would this print if the
effect went the other way?* — the gate is genuinely two-sided: **worse** is the pass, **same** is
`inert` and cannot pass, **better** overturns §2b and the gate must record the reason. Against
`HAZARDS` §0 — *which input do all arms fabricate identically?* — both arms carry step C's prose
unchanged, so a keyword-list failure in that prose is invisible to this contrast; §6's text pack is
the instrument for it and is correctly placed. The availability asymmetry **is** forced by
construction rather than asserted: under §2b the shipped arm grants on click plus `implied: true`,
the ablated arm grants every `to` on display, so shipped ⊆ ablated for every player and every route.
**No edit was needed anywhere in §6's null.**

Seven material defects were found elsewhere. Each is repaired in place.

| # | Defect | Repair |
|---|---|---|
| **P1** | **§2a's ownership table forbids the edit §4A commissions.** The table row reads *"Never edits — anything under `game/src/`"*; §4A step 1 says *"This is the one edit this piece makes under `game/src/`"* and **A2's hard fail depends on it** (`topicLabel` must read `name`). A builder obeying the table cannot pass A2; a builder obeying §4A has broken the seam table. In a plan whose central ruling is about file ownership under Ruling O1, this is the one contradiction that must not survive. | §2a's table now names the excluded paths precisely and carries the one declared exception. `node tools/ownership.mjs --for game/src/character/converse.js` returns one **done** piece (`W1-DLG-S37`) and no live claimant; the sibling claims `engine.js`, `ui/**` and `tools/ui/**`, not `converse.js`. |
| **P2** | **§2a blocked step C on another agent replying** — *"does not begin step C until that agent has acknowledged"*. `CLAUDE.md` rule 0 and `RULES.md` rule 0: **no work parked pending an answer**, and a question asked may not be answered for hours. Ruling O1 requires the *message*; it nowhere requires an acknowledgement. | §2a rewritten: send it, record it, proceed. The protection against collision is the ownership check and the sibling's status file, both of which are one-sided and cost nothing. |
| **P3** | **The concession to the sibling was written in §10, which is a self-doubt section a builder does not take orders from.** §10.5 said *"If it has already built against the draft's step D, this plan concedes the overlap"* — true, and unobeyable where it sat. | Promoted into §2a as a numbered rule with the exact check and the exact action. Sibling status at `7b05e65e`: `state: building`, `files_touched` is its status file and a reading note only — **it has not yet written the window**, so the seam is live rather than already lost. |
| **P4** | **Ten topics are unreachable from any greeting, and no gate in this plan or in §D can see it.** `build-graph.mjs` at `7b05e65e` reports `unreachable_from_greeting`: `warden-eshi`, `the-one-path`, `the-blight-storms`, `the-ash-cough`, `the-xul-teekh`, `the-soul-trade`, `the-tolls`, `the-ninth-column`, `the-bond-berth`, `the-man-off-the-quay`. **Every one has in-degree ≥ 1, so none is an orphan; none is advertised by any `npc.topics`; so no player can reach any of them by any route.** §1 called the graph healthy without naming them, which is R2's own error recurring. Worse, **§4C's deletion budget is guarded by the wrong invariant**: "deletable without orphaning" tests in-degree ≥ 1, which by construction cannot detect a subtree cut off from every greeting — a 200-edge deletion pass can multiply this failure and leave all 13 §D rows green. This is the owner's complaint in its purest form: content no thread reaches. | §1 corrected; **new row A5c**; §4C's deletion test replaced with a reachability test. |
| **P5** | **A7's number is the most flattering corner of an unstated player space, and its prose gloss names the wrong defect.** *"the median person in the province advertises zero subjects"* is false: **all 408 records carry a `topics` array and only one is empty.** They advertise; the advertised subject does not resolve. Measured through the shipping reader over the corpus's own player space (10 races × 4 upbringings × {0,40,100} disposition = 120 shapes): records offering nothing of their own runs **215–250 of 408 (52.7%–61.3%)**, worst `orc/3/d0`, best `dunmer/0/d40` = **215 (52.7%)**. Round 1's **217** sits one record off the best corner. Under **Ruling W1** the player is the constituent and a bar over such a population binds on the **worst**, never on one unnamed member. Round 1 also reported *"3 offer nothing at all"*; at no shape tried does that reproduce — it is **0** with the roots known and **27** with them unknown. | A7 restated: player space named, gate binds on the **worst** player, "nothing at all" clause re-baselined and its population fixed. |
| **P6** | **Step D commissions the wrong repair, and it is the expensive one.** Of the 225 records offering nothing at `argonian/0/d40`, **208 do advertise a non-root topic** — the wiring step D would build already exists. Classifying the 221 dead advertisements: **17** name a string that is not a topic id at all (`the drowned tally`, `the vats or the people`, `the lease` — prose form where the corpus uses slugs; only **1** would be fixed by slugifying), and **204** name a real topic id, concentrated in just **23 distinct topics**, for which **no INFO passes the filter stack** for that player. So the job is 23 topics' filter stacks plus 17 broken references — not a rehoming pass over 200+ NPC records. | §4D rewritten with the measured decomposition and the cheap order. |
| **P7** | **The §G cap is quoted but never bound to this piece's verdict, and §2a is what unbinds it.** `RI-UIX08`'s clause caps **`RI-UIX08`** — and §2a hands every `RI-UIX08` row to the sibling, leaving this piece's numeric rows anchored on `RI-DLG01`, whose published aggregation is *"count of passing §D rows, gated"* with **no human gate anywhere in it**. A critic could therefore score this piece green on statistics with §G unrun and break no stated rule. That is precisely the failure the plan's own framing paragraph forbids. | §5 now states the cap as a **verdict requirement** naming the item and the subsystem it applies to, and what to record when §G has not run. |

**One thing deliberately not repaired**, so this review stays one-step reversible and does not
re-home somebody else's number: **A1's floor of 90% is left exactly as round 1 set it.** It is
argued, it is checkable against REF-A12c, and round 1 explicitly invited the argument. Round 2 has
no measurement that beats it and declines to invent one.

**A third owed corpus edit is added to §9** and is not performed here: `game/data/dialogue/topics/thorn.json`
(`declared_incomplete: true`) carries **four records in a second, undeclared schema** — `topic` /
`text` / `links` instead of `id` / `infos` / `to`. They are invisible to every `id`/`to` instrument
in `tools/dialogue/`, and they are the whole of the 4-occurrence gap between round 1's **1,605** and
this round's independently measured **1,601**. §5 now fixes A1's denominator against the definition
rather than against either count.

---

## 1. The one-paragraph reason this piece is not what it looks like — re-measured at `7b05e65e`

**The graph is already built and it has most of the shape RI-DLG01 asks for.**
`node tools/dialogue/build-graph.mjs` at `7b05e65e` (identical at `e2a7a1a8`): **470** nodes,
**1,630** edges, mean non-leaf out-degree **3.98**, `reachable_only_via_another_topic` **0.9809**,
`max_depth` **7**, leaf fraction **0.223**, convergence **0.619**, **zero** orphans, **zero**
unreachable INFOs, `menu_quest_fraction` **0.20**.

**Two things in that paragraph are not green, and a plan that names only the first is repeating the
error it convicted the draft of.**

1. **`median_depth` is 2**, against §D's *"Median depth from greeting — our target ≥ 3 — fail below
   2"*. It clears the hard floor and misses the target, so §D scores 12 of 13 and `RI-DLG01`'s
   *"12/13 or better"* still reads PASS. Nothing in this plan repairs it and nothing here may make
   it worse.
2. **Ten topics cannot be reached from any greeting, by any player, by any route** —
   `unreachable_from_greeting` at `7b05e65e` is `warden-eshi`, `the-one-path`, `the-blight-storms`,
   `the-ash-cough`, `the-xul-teekh`, `the-soul-trade`, `the-tolls`, `the-ninth-column`,
   `the-bond-berth`, `the-man-off-the-quay`. **Every one has in-degree ≥ 1, so §D's orphan row
   passes them; and none is named in any `npc.topics`, so `build-graph.mjs`'s own documented "fourth
   door" does not save them either.** They are a pocket that only points at itself. Ten topics
   written and unreachable is this piece's subject, not a footnote to it, and **§D has no row that
   can see it** — the figure is printed by `RI-DLG01`'s own comparison-method step 2 and then
   scored by nothing. Row **A5c** below closes it, and §4C's deletion test is rewritten because the
   orphan test it used cannot detect this class at all.

`reachable_only_via_another_topic` deserves one warning, because it reads like a reachability
guard and is not one: `build-graph.mjs` computes it as *"nodes that are neither a root nor
journal-added, over all nodes"*. **Deleting edges cannot move it.** It is a shape statistic, and
A5's regression gate must not be read as covering reachability because that row is green.

**And the mechanism the owner described is about 10.5% present.** Counting every `to` entry of every
INFO in `game/data/dialogue/topics/` — **1,601** occurrences over **1,273** distinct
source→destination pairs — the destination's player-visible label occurs literally in the text of
the answer that unlocks it in **167** cases: **10.4%** of occurrences, **12.6%** of distinct pairs,
and **15.9%** under a deliberately generous matcher that only requires every content word to appear
somewhere in the answer. **About 1,434 unlocks are invisible.** A topic silently appears in the
list; the player was never shown the word, so there was nothing to notice, nothing to click, and
nothing to pull.

*(Round 1 published 1,605 / 1,277 / 168. The four-occurrence gap is not tree movement —
`game/data/dialogue/` is byte-identical between `e2a7a1a8` and `7b05e65e` — it is the four
second-schema records in `thorn.json` carrying `links` instead of `to`. §5 fixes A1's population
against the definition; §9 records the corpus edit owed.)*

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
node tools/dialogue/critic-reach.mjs                        # A7's player space, already enumerated
```

**One trap in `topicsFor()` that will cost the builder and the critic a confused hour each if it is
not written down: `player.knows` must be a `Set`.** `converse.js:214` calls `knows.has(k)`; an array
throws `TypeError: knows.has is not a function` from inside `infoFor`, and a census that swallows
that exception silently drops the record rather than counting it. Any A7 measurement must assert
zero throws over the population and publish that count.

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
| `orchestration/OWNER-DIRECTIVES-2026-08-14.md` **Ruling W1** | *"an aggregate may never be the binding predicate for something a player meets one at a time … bind on the worst constituent or a stated quantile, never the mean"* | **A7 binds on the worst player, not on one unnamed one (§5). A1 is already per-constituent and the argument is made explicitly below rather than assumed.** |

**Ruling W1 applied to this plan's two ratio rows, because the directives file records that no plan
outside the `W1-30` tree cites it and that is how superseded predicates get built against.**

- **A1 complies as written, and here is why rather than an assertion.** Its constituent is the
  *unlock*, not the settlement: A1 is a percentage over occurrences, and **A1b is the worst-
  constituent clause** — *every single* occurrence that fails A1 must carry `implied: true`, with no
  budget and no ratio. There is no configuration in which A1+A1b passes while some individual unlock
  is silently invisible. The settlement is not a meaningful constituent here either, and that is
  measured rather than argued: `metrics.json`'s `per_settlement.answerable` runs **395–411 of 470**
  in all nine settlements, so the population a player meets is very nearly the whole graph wherever
  they stand.
- **A7 did not comply and now does.** Its constituent is the *player build*, the figure moves
  **215–250 of 408** across the corpus's own player space, and round 1 bound it on one unnamed
  member near the best end. See §5.

### 2a. The seam with `W1-UIX08-dialogue-window` — ruled, because a sibling is already building

`orchestration/status/W1-UIX08-dialogue-window.json` is a **live builder** owning the window and,
in its own words, "the topic-link mechanism". The draft's step D implemented the same section of
the same item into the same files. Under Ruling O1 that is the dispatch error that has silently
reverted three agents' work. **Ruling, and it is the answer to "which piece owns what":**

> **This piece owns making an unlock visible *in the text*. `W1-UIX08` owns *rendering it as a
> link*.** Content and instrument here; pixels and interaction there.

| | This piece (`W1-DLG-TOPIC-WEB`) | `W1-UIX08-dialogue-window` |
|---|---|---|
| Owns files | `game/data/dialogue/topics/**`, `tools/dialogue/**`, **and `game/src/character/converse.js` for exactly the `topicLabel` change in §4A step 1** | `game/src/ui/**`, `game/src/render/ui.js`, `game/src/engine.js`, `tools/ui/**`, the `topic_link` surface role |
| Owns rows | A1, A1b, A2, A5, A5b, A5c, A6, A7 (below) | `RI-UIX08` §A/§B/§C/§D/§E1, and §C1's link precision ≥ 0.98 / recall ≥ 0.95 |
| Owns the played gate | **no** — reads its result, and records the cap when there is none (§5) | **yes** — `RI-UIX08` §G, one gate for the dialogue system (S52) |
| Never edits | `game/src/ui/**`, `game/src/render/ui.js`, `game/src/engine.js`, `tools/ui/**` — **and nothing else under `game/src/` beyond the one declared `converse.js` change** | anything under `game/data/dialogue/` |

**The one `game/src/` exception is declared here rather than left as a contradiction between this
table and §4A.** `node tools/ownership.mjs --for game/src/character/converse.js` at `7b05e65e`
returns one piece, `W1-DLG-S37`, state **done**, and no live claimant; the sibling's own
`files_claimed` lists `game/src/engine.js`, `game/src/ui/**` and `tools/ui/**` and **not**
`converse.js`. A2's hard fail (*`topicLabel` reads `name`*) is unreachable without it, so a table
that forbade it would have made this plan unbuildable on its own terms.

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

**Handoff mechanics — decide, record, proceed. Nothing here waits for a reply.** Round 1 wrote *"does
not begin step C until that agent has acknowledged"*, and that is work parked pending an answer,
which `CLAUDE.md` rule 0 and `RULES.md` rule 0 forbid in terms. Ruling O1 requires the **message**;
it nowhere requires an acknowledgement, and a sibling agent may be finished, dead or unreachable by
the time this builds. The rule is therefore three one-sided checks, all of which cost seconds and
none of which needs anybody to answer:

1. **Send the seam contract to the live `W1-UIX08` agent by `SendMessage`** (Ruling O1: the message,
   not a new agent), record in the status file that it was sent and when — **and continue
   immediately**. An acknowledgement, if it arrives, is recorded and may narrow the seam; its
   absence changes nothing.
2. **Before writing any file, run `node tools/ownership.mjs --for <path>` and re-read
   `orchestration/status/W1-UIX08-dialogue-window.json`.** If the sibling has claimed or touched a
   path this plan is about to write, that path is theirs; say so in the status file and route the
   work over the seam instead of taking it.
3. **If the sibling has already built the visible-unlock text side** — i.e. its `files_touched`
   includes anything under `game/data/dialogue/`, or it has landed its own visibility/link census
   under `tools/dialogue/` — **this plan concedes the overlap and keeps only the contract file.**
   Say that plainly in the verdict; do not fight for the row. *(At `7b05e65e` the sibling is
   `state: building` with `files_touched` = its own status file and `reports/uix08/READING-NOTE.md`
   only, so nothing is conceded yet and the seam is live.)*

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
belongs to whoever owns reachability."*

**Re-measured at `7b05e65e` through the shipping reader, over the corpus's own player space rather
than one unnamed player** (10 races × 4 upbringings × disposition {0, 40, 100} = 120 shapes, roots
known, `knows` as a `Set`): records offering **no topic of their own** run **215–250 of 408**, i.e.
**52.7% – 61.3%**; best `dunmer/upbringing 0/disposition 40` = 215, worst `orc/upbringing 3/
disposition 0` = 250. Median own-topics is **0** at every shape. **Round 1's 217 (53.2%) is one
record off the best corner of that space and did not say which player it was.** Round 1's *"3 offer
nothing at all"* does not reproduce at any shape tried: it is **0** with the nine roots known and
**27** with them unknown.

> **Ruling: it belongs here, not to the dialogue-text piece.** The words exist; what is missing is a
> route from a person to them, which is the topic web. It lands as row **A7**.

**And the defect is not the one round 1 described, which changes the work.** Round 1 wrote *"the
median person in the province advertises zero subjects beyond the nine you started with"*. That is
false: **all 408 records carry a `topics` array and exactly one of them is empty.** They advertise;
the advertisement does not resolve. Measured at `argonian/0/d40`, of the 225 records offering
nothing, **208 advertise at least one non-root topic**, and the 221 dead advertisements decompose:

| cause | count | distinct | what it actually is |
|---|---|---|---|
| the advertised string is **not a topic id at all** | **17** | 17 | prose form where the corpus uses slugs — `the drowned tally`, `the vats or the people`, `the lease`, `a phial for the blind man`. **Only 1 of the 17 would be fixed by slugifying**; the rest name subjects that do not exist. A dangling reference, and nothing in the corpus lints for it. |
| the id **exists** but **no INFO passes the filter stack** for that player | **204** | **23** | the answers are authored and gated — by race, class, faction or disposition — with no fallback INFO. Twenty-three topics carry the whole of it. |

> **Sub-ruling, reversible: this is a filter-stack and dangling-reference repair, not a rehoming
> job.** Twenty-three topics plus seventeen broken strings is a bounded, cheap, mostly-mechanical
> fix; rewiring 200+ NPC records is a large content pass that would leave the same 23 topics
> unanswerable for the same players. **Falsifier:** if adding a fallback INFO to those 23 topics
> moves A7's worst-player figure by less than 10 points, the concentration argument is wrong and
> the work is a broader authoring pass after all — measure it after the first five topics, not
> after all 23.

**Reversible.** **Falsifier for the row as a whole:** if the repair turns out to require new
*answers* rather than fallback INFOs and corrected references for answers that already exist, the
work is `W1-DLG-WORDS`'s successor's and this row becomes a handoff with a number attached.

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
   `game/src/character/converse.js`, it is the declared exception in §2a's ownership table, it is
   outside `W1-UIX08`'s claimed files (verified at `7b05e65e`), and it is announced over the seam
   before it lands — announced, not waited on (§2a).*
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

**It must be able to fail: run it against the unmodified tree first and confirm it reports ~10.4% /
15.9%, not 100%.** A visibility probe that cannot report today's tree as broken is not a probe.
State the matcher's fold rules (case, apostrophes, hyphens) in the tool's header, because
`RI-UIX08`'s own "Untested" note predicts the recall floor will be argued over morphology.

**The same run carries two cheap lints that nothing in the tree performs today**, both of which are
one pass over data the tool already parses, and both of which must exit non-zero when they fire:

- **Dangling `npc.topics` reference** — an advertised string that matches no topic id. **17 at
  `7b05e65e`** (§2c). Publish the list.
- **`unreachable_from_greeting`** — already computed by `build-graph.mjs` and scored by nothing.
  **10 at `7b05e65e`** (§1). Publish the list; row A5c gates it.

**C. Author the missing links — with a budget (content; no browser).**
For every edge whose destination is invisible: write the destination's label into the source
answer's prose, mark the `to` entry `implied: true`, or **delete the edge**.

**The deletion budget is 200 distinct edges and it is a hard cap.** Measured at `e2a7a1a8` and
unchanged at `7b05e65e`: of the ~1,112 invisible distinct edges, 770 can be deleted without
orphaning their destination, and taking that headroom lands topic→topic mean non-leaf out-degree at
**2.02** against §D's floor of **2.0** — while visibility still only reaches **32%**. So deletion
cannot reach A1 and can consume the entire margin. *(Round 2 reproduces the baseline this table
starts from: topic→topic distinct edges **1,273**, mean non-leaf out-degree **3.488**.)*

**The safety test on a deletion is reachability, not orphaning, and this is a correction not a
refinement.** "Does not orphan" tests in-degree ≥ 1. **Ten topics at HEAD already have in-degree ≥ 1
and are reachable from no greeting** (§1), so the orphan test demonstrably cannot see this failure —
it is a guard with one eye in exactly `HAZARDS` §0b's sense, and a 200-edge pass could multiply the
pocket while every §D row stayed green. **An edge may be deleted only if, after the deletion, its
destination is still reachable from some greeting node** — recompute, do not assume. Row **A5c**
gates the result.

| edges deleted | topic→topic mean non-leaf out-degree | visibility |
|---|---|---|
| 0 (today) | 3.50 | 12.7% |
| 200 (**the cap**) | 2.96 | 15.0% |
| 500 | 2.57 | 20.8% |
| 770 (max without orphaning) | 2.02 | 32.0% |

*(These are topic→topic edges only. `build-graph.mjs`'s headline 3.98 includes greeting, rumour and
journal edges; the two numbers are in different populations and a builder must not compare them.)*

Re-run `build-graph.mjs` after this step — **the whole §D table, per A5.**

**D. Make the advertisements resolve (data; no browser). Cheapest first, and the order matters
because the first branch may make the second unnecessary.** §2c measured the decomposition: the
`npc.topics` wiring largely **already exists** and does not resolve.

1. **The 17 dangling references first** — advertised strings that are not a topic id at all
   (`the drowned tally`, `the lease`, …). One of the 17 is a slug/prose mismatch; the other 16 name
   subjects that do not exist and must either be pointed at a real topic or removed. **Land a lint
   for this class** in the `--visibility` extension (§4B): an `npc.topics` entry with no matching
   topic id is an error and exits non-zero. It costs nothing and there is no check for it today.
2. **Then the 23 topics carrying 204 of the 221 dead advertisements** — a real topic id whose filter
   stack admits no INFO for the player. The repair is a fallback INFO per topic, authored last in
   the file so first-match-wins and the S37 scoring reader both reach it only when nothing more
   specific does. **Re-measure A7's worst player after the first five** (§2c's falsifier): if the
   worst-player figure has not moved materially, stop and report, rather than authoring 18 more.
3. **Only then, rehoming**, and only for whatever residue survives 1 and 2.
   `tools/dialogue/rehome-actors.mjs` already exists for that shape of edit — read it before
   writing anything.

**Do not run this step against one player.** A7 binds on the worst of the corpus's player space
(§5), and `tools/dialogue/critic-reach.mjs` already enumerates that space and reads its domains out
of the corpus rather than assuming them — reuse it rather than writing a second enumerator (rule 10).

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
