# W1-DLG-TOPIC-WEB — topics unlocking topics, as something a player can see happen

Plan-State: draft — awaiting first fresh reviewer-editor round

**Owner's ask, which is what this plan exists to serve:** *in Morrowind, asking about one subject
adds new subjects to your list — the conversation branches outward as you pull threads, and that is
a large part of why it feels like investigating a place rather than reading a FAQ.*

**Do not build from this plan yet.** It is a draft entering the `PLAN-LOOP.md` loop. It commissions
no work until a fresh reviewer-editor marks it satisfied.

---

## 1. The one-paragraph reason this piece is not what it looks like

**The graph is already built and it already has the shape RI-DLG01 asks for.** Run
`node tools/dialogue/build-graph.mjs` on current HEAD and it reports 470 nodes, 1630 edges, mean
non-leaf out-degree **3.98**, `reachable_only_via_another_topic` **0.9809**, `max_depth` **7**,
zero orphans and zero unreachable INFOs. Every headline number RI-DLG01 §D names is green.

**And the mechanism the owner described is 6.7% present.** Of the 1216 `addTopic` edges in
`game/data/dialogue/topics/`, the destination topic's player-visible name appears in the text of
the answer that unlocks it in **81** cases — 6.7% strict, 10.0% under a deliberately generous
matcher that only requires every content word to appear somewhere in the answer. **1135 unlocks are
invisible.** A topic silently appears in the list; the player was never shown the word, so there was
nothing to notice, nothing to click, and nothing to pull. Worse: **14 of 471 topics carry an
explicit player-visible `name` at all (3.0%)** — the rest would render as a slug,
`the-tally-of-the-dead`.

That gap between a green statistic and an absent mechanism is the whole of this piece, and it is
the reason the plan is written the way it is:

> **Statistics can fail this build and can never pass it.** Counting how many topics unlock other
> topics is necessary and nowhere near sufficient — 1630 edges is already true and the thing the
> owner asked for is not. Every numeric acceptance below is a **hard fail / gate**. The only row
> that can return a *pass* is §6, the played gate.

Reproduce both figures before doing anything else; they are the baseline the whole plan is measured
against and they cost one second each:

```
node tools/dialogue/build-graph.mjs --out /tmp/dlg          # the green statistics
# and the visibility census, once §4 has added it to that same tool:
node tools/dialogue/build-graph.mjs --out /tmp/dlg --visibility
```

---

## 2. Authority and reconciled state

**Governing items — read them complete, not summarised here.**

| Item | Owns | What this plan must satisfy |
|---|---|---|
| `corpus/40-dialogue/RI-DLG01-topic-graph.md` | the **graph** — which topics exist, the filter stack, `AddTopic` as the edge, §D's topology targets | §D is already green; this plan must not regress it, and must not treat it as evidence of §6 |
| `corpus/86-ui/RI-UIX08-dialogue-window.md` | the **window** — inline links, the topic column, disposition, the panel | §C1's link precision/recall, §A's six elements, §G's played gate |
| `corpus/40-dialogue/RI-DLG04-disposition-and-persuasion.md` | disposition as a number | unchanged by this plan; the window only displays it |
| `corpus/86-ui/RI-UIX04-journal-ui.md` | the journal screen | RI-UIX08 §E5: the same links appear in journal entries. **Out of scope here**, named so a later piece picks it up |
| `ARBITRATION.md` **S13** | topics are unavailable in combat | nothing here reaches into a fight |
| `ARBITRATION.md` **S52**, **Ruling W2** | the shape of a human gate | §6 adopts it verbatim rather than inventing one |

**What is already landed and must be preserved.** The 470-topic graph, its authored INFO order and
first-match-wins filtering, `tools/dialogue/build-graph.mjs` and its four output files, the nine
root topics, and `W1-DLG-WORDS`'s in-flight rewrite of the answer *text*. **This plan changes no
answer text.** It changes which words in that text are marked, and it commissions new `name` fields.
Coordinate with `W1-DLG-WORDS` (`orchestration/status/W1-DLG-WORDS.json`) before touching
`game/data/dialogue/topics/`.

**What is stale.** Any statement that the topic web is done because the graph metrics are green.
`docs/PLAN.md`'s dialogue rows and `orchestration/plans/W1-17.md` both predate the visibility
census in §1 and neither knew the figure was 6.7%.

---

## 3. The references the builder and the critic will actually look at

**The owner asked directly whether the builder and critic of this UI work would look at a Morrowind
reference. The honest answer for every previous round is no — they had nothing to look at, because
`RI-VIS09` §2's routing table gave `RI-UIX*` only the OpenMW layout XML and said in terms it must
not be cited for appearance, and `RI-VIS09` §3.5 and `REF-A12/README.md` both still stated the
appearance reference did not exist. It did. It has since 2026-08-06.**

So this is structural rather than a hope. **`RI-UIX08` §0 is a table of five reference paths with
what each may and may not be cited for, and it is a prerequisite of this plan, not background
reading:**

- `corpus/70-visual/refs/morrowind/REF-A12c/REF-A12c-dialogue__mw-owner-20260814.png` — the owner's
  own capture, and the highest-resolution dialogue reference we hold.
- `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-dialogue__mw-3296790844.jpg` — the
  native-engine control, and the authority wherever it and the owner's capture disagree.
- the other four `REF-A12b/REF-A12b-dialogue__*.jpg`.
- `corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_dialogue_window.layout` — the exact rects.
- `corpus/70-visual/refs/morrowind/REF-A12/config/openmw.cfg` lines 71–115 — the colour table.

**Enforcement, so this cannot be skipped quietly:**

1. **The builder's first deliverable is a one-page reading note** naming each of the five files, one
   sentence on what it took from each, and one thing in the reference it decided *not* to copy. It
   lands before any code. A builder that cannot write it has not opened them.
2. **The critic's verdict must record which of the five it opened.** `RI-VIS09`'s own compliance
   check already hard-fails a visual claim that cannot resolve a reference path; this makes the
   check apply to the reading rather than only to the citation.
3. **Two named traps are in the references themselves** and a builder who has not read `RI-UIX08`
   §E will fall into both: the owner's topic list renders **green**, which matches no vanilla
   `[FontColor]` entry and is a mod or a setting — build it bronze `#CAA560`; and the top-corner and
   lower-right chrome in that frame is the **OpenMW-for-Android touch front-end**, not Morrowind.

---

## 4. The work, in the cheapest order that can invalidate the rest

Ordered so a cheap headless gate can kill an expensive branch. Nothing opens a browser before D.

**A. Names, first, because everything downstream needs them (data; no browser).**
Give every topic reachable in play an explicit player-visible `name`. Baseline 14/471. This is a
content edit inside `game/data/dialogue/topics/` and it collides with `W1-DLG-WORDS`; agree the seam
before starting.

**B. Extend the existing instrument — do not write a second one (rule 10).**
`tools/dialogue/build-graph.mjs` already parses every INFO, its text and its `addTopic` array, and
already emits the `via` column. Add a `--visibility` mode that, per edge, reports whether the
destination's `name` occurs in the source answer's text, under both the strict and the loose matcher
in §1, and writes `visibility.tsv` plus three fields in `metrics.json`. **It must be able to fail:**
run it against current HEAD first and confirm it reports 6.7% / 10.0%, not 100%. A visibility probe
that cannot report today's tree as broken is not a probe.

**C. Author the missing links (content; no browser).**
For every edge whose destination is invisible, either write the destination's name into the source
answer's prose, or **delete the edge**. Deleting is a legitimate outcome and sometimes the right
one: an unlock the player cannot see is a promise the window cannot keep, and RI-DLG01's topology
targets have enough headroom (out-degree 3.98 against a floor of 2) to lose edges without
regressing. Re-run `build-graph.mjs` after this step and confirm §D's topology is still green — this
is the regression gate on A.

**D. The window renders the links (code; browser).**
Implement `RI-UIX08` §A–§D in the dialogue surface. The seam already exists and is unused:
`game/src/ui/surface.js` line 46 declares a `topic_link` surface role and **nothing in `game/src/`
references it**. The current panel (`game/src/render/ui.js`) draws a bottom-anchored list of
selectable replies and must be replaced by the window `RI-UIX08` specifies, not decorated.

**E. CONSUMPTION (`RI-MTH07`, mandatory under `ARBITRATION.md` §3).**
Name the world-side consumer and demonstrate it by perturbation: delete one `addTopic` edge on a
control clone and show that the corresponding word stops being a link in the running game and that
the topic stops appearing in the column. Sixteen subsystems here have shipped a correct model that
nothing in the running world reads; this is the check that this is not the seventeenth.

**F. The played gate, §6.** Last, because it is the only expensive thing and everything above can
invalidate it.

---

## 5. Acceptance — every row here is a **gate**, and no row here can return a pass

Predicate, units and population, so a build critic is never arguing about what was meant. All
figures are claims about a commit; stamp it (rule 12).

| # | Predicate | Units | Population / denominator | Baseline at HEAD | Gate |
|---|---|---|---|---|---|
| **A1** | destination topic's `name` occurs in the source answer's rendered text, per `addTopic` edge, strict matcher | % of edges | every `addTopic` edge in `game/data/dialogue/topics/` (**1216** at the measured commit) | **6.7%** (81/1216) | **≥ 90%**; below 90% is a hard fail |
| **A2** | topic carries an explicit player-visible `name` | % of topics | every topic reachable in play (**471**) | **3.0%** (14/471) | **100%**; any slug rendered to a player is a hard fail |
| **A3** | rendered link precision — marked spans that are real topics | ratio | every link span drawn in the played population | n/a — no links are drawn | **≥ 0.98** (`RI-UIX08` §C1) |
| **A4** | rendered link recall — real topics in the text that got marked | ratio | as A3 | n/a | **≥ 0.95** (`RI-UIX08` §C1) |
| **A5** | RI-DLG01 §D topology after step C | as §D defines | the whole graph | out-degree 3.98, depth 7, 0 orphans | **no regression**: out-degree ≥ 2, depth ≥ 6, orphans 0 |
| **A6** | CONSUMPTION: perturbing one edge changes what the running window draws | boolean | one edge, one clone | not demonstrated | **must change**; unchanged = the model is not read |

**A1's 90% is a floor and not a target, and here is the reasoning so a reviewer can attack it:**
100% is wrong because some edges legitimately model a topic learned by *implication* rather than by
a word — Morrowind does this, and forcing every unlock to be a visible keyword would flatten prose
into a list of nouns. 90% leaves roughly 120 edges of that kind and makes the invisible unlock the
exception a writer has to choose, which is the opposite of today. **If a reviewer thinks the right
number is 80% or 95%, that argument is worth having now** — it costs a paragraph here and a build
round later.

---

## 6. The null control — the arm that must come out worse, and what "inert" looks like

**The played gate is the only thing in this plan that can return a pass**, and per Ruling W2 it
shows the artefact as a player meets it and asks whether it is *good*. "Can you tell these apart?"
is a leak check and is never the verdict. `ARBITRATION.md` **S52** fixes the binding shape and this
section adopts it rather than inventing a second one.

**The ablated arm.** The same build, the same prose, the same topic column, the same disposition and
the same window — **with the inline link marking removed, and every topic the player would have
unlocked granted into the column at exactly the moment it would have been unlocked.**

**Why that arm and not a simpler one.** Availability is held identical on purpose. Three tempting
nulls are all broken and would have been shipped here before:

- *Links removed and topics never granted.* Then the ablated player has an empty column and fails
  because the content is gone, not because the mechanism is. That is a trivially broken null.
- *All 470 topics granted at the start.* Then the ablated player drowns and fails for a third
  reason. Also trivially broken.
- *The prose deleted.* Not a null at all.

Only "identical availability, visibility removed" isolates the mechanism the owner named. It is also
**a build a reasonable team could ship** — it is what most dialogue systems do — which is exactly
`HAZARDS` §0's requirement that the null be *plausible* rather than *trivially* broken.

**What it looks like if the control is inert.** The two arms read the same to the judges. That
result is **`inert`, and it cannot pass** — it is a statement that the inline link is doing no work,
and the correct response is to fix the instrument or the build, never to record a pass. `S52`
requires the separability check by a **third** fresh reader, with arm identity quarantined, for
exactly this reason. Rule 6's second failure mode — a control you have never seen fail — is the one
this project has already been caught by; before the gate runs, confirm the ablation actually
executed by running A3/A4 against the ablated build and watching them go to zero.

**The gate itself.** A fresh agent that has read neither this plan nor `RI-UIX08` nor the source,
given only the URL, the driver protocol and one sentence of premise, plays **ten minutes of each
arm**, reaching at least three conversations, and is asked `RI-UIX08` §G's five questions verbatim,
recorded before any reveal. **Question 3 — *"Is there anything in this town you now want to ask
someone about? Name it."* — is the load-bearing one:** it asks whether the window handed the player
a thread they chose to pull. **A participant who names nothing for Q3 has met a FAQ**, whatever A1
says.

**Pass condition, stated so it cannot be softened later:** more than one participant names something
concrete at Q3 on the shipped arm, **and** the ablated arm reads worse, **and** the third reader can
separate them. Any of the three missing is not a pass.

---

## 7. Instruments reused, by path — and the one extension

| Instrument | Path | Role | New? |
|---|---|---|---|
| topic-graph dump and topology | `tools/dialogue/build-graph.mjs` | RI-DLG01 §D metrics; A5's regression gate; the parser A1 needs | **existing** — extended with `--visibility` (§4B), not duplicated |
| delete-the-fix clone | `tools/control-clone.mjs` | A6's CONSUMPTION perturbation and §6's ablated arm, hard-linked rather than copied | existing |
| played-gate driver | `tools/harness/critic-first-ten-play.mjs` | §6's ten minutes of driven play; it already drives a ten-minute session and captures | existing — reuse the driver, not the question set |
| blind pack construction | `tools/blind/make-pair.mjs` | only if §6's separability check wants a packaged pair | existing |
| the unused seam | `game/src/ui/surface.js` (`topic_link`, line 46) | the surface role D must finally use | existing, unreferenced |
| the current panel | `game/src/render/ui.js` | what D replaces | existing |

**No new tool is commissioned by this plan.** If a reviewer finds one is genuinely needed,
`orchestration/TOOL-LOOP.md` governs and it must be able to fail (rule 24).

---

## 8. Builder / critic execution allocation

Per `orchestration/plans/BUILDER-EXECUTION-CONTRACT.md`.

**The builder owns:** steps A–E; the `--visibility` extension including its red-arm demonstration
against current HEAD; the reading note in §3.1; all content edits; the window implementation; A1,
A2, A5 and A6 run to green; A3/A4 on a **smallest representative live population** through the
shipping path; the ablated build; and text-only reproduction evidence. The builder keeps repairing
until those rows pass in the run.

**The fresh critic owns:** the full A3/A4 population; the complete capture matrix for `RI-UIX08`
§C's colour sampling and §E1's translucency check at two viewports; the played gate §6 in full,
including recruiting all three fresh readers; independent replay of A1/A2/A5; hard-fail assessment;
score and verdict. **Any empirical run over about fifteen minutes is the critic's by default** —
§6 is squarely that.

**The critic does not repair game code** (`PLAN-LOOP.md`, rule 23). On FAIL it leaves an executable
remediation specification covering every material gap, not only the one the verdict schema ranks
`biggest_gap`.

**Model choice** (`PLAN-LOOP.md` §4): step A is mechanical content editing with a machine-checkable
acceptance and belongs on **Sonnet**. Step B, step D, the plan reviewer-editor and the critic are
Opus.

---

## 9. What this plan does not do, said plainly

- **It does not touch what characters say.** `W1-DLG-WORDS` owns the words; this owns whether the
  useful ones are marked. The seam is `game/data/dialogue/topics/` and it must be agreed, not
  assumed.
- **It does not implement journal links.** `RI-UIX08` §E5 records that Morrowind puts the same blue
  links inside journal entries — `REF-A12b-journal__mw-147283027.jpg` shows five of them — and that
  a build with links only in the dialogue window has implemented half the idea. `RI-UIX04` owns the
  journal screen; this is a named handoff, not scope creep absorbed here.
- **It does not settle read/unread marking.** `RI-UIX08` §F1 already rules it off by default and
  reversibly, and names the evidence that would overturn it. This plan inherits that ruling.
- **It does not claim the graph is bad.** The graph is good and its author should be told so. What
  is missing is the half a player can see.
