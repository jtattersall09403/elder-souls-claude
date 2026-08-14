---
id: RI-JRN09
title: The opening as an exchange — did the scene reach the player, were the answers consumed, and did anyone say what you are
kind: number
side: morrowind
judges: [journey.opening.exchange, journey.opening.legibility]
provenance: constructed
confidence: medium
blind_pair: no
---

> **This item judges a JOURNEY, not a subsystem.** It is the ninth in `corpus/88-journeys/`.
>
> **Division of labour, binding.** `RI-JRN01` owns the opening's **structure** — how many surfaces,
> how much of the frame is UI, which entity is speaking, which routes are offered, whether a marker
> appeared. This item owns whether the scene was **played**: whether the authored text reached the
> frame, whether the player's answers were used by the person who asked for them, and whether the
> moment the questionnaire exists for occurred. `RI-CHR01` owns the *content* of the eight inputs
> and the fourteen classes; this item owns only whether that content was **delivered and
> consumed**. `RI-EXP01` owns the first **hour** as beats — `T_found`, `T_lie`, `T_refusal`,
> `N_odd` — and this item cites those numbers and never restates them. `RI-PLT03` owns
> `T_control`, cited and never redefined.

## The bar

The user's question, as asked, is the whole of this item:

> *"is the new game flow good enough Vs Morrowind's famously brilliant opening scenes"*

Morrowind's opening is not remembered for having few surfaces. It is remembered because **somebody
asked you your name and then said it back to you**; because ten questions about wounded dogs and
inheritance disputes were **printed where you could read them**; because at the end of them a bored
functionary **told you what you apparently were**; and because he then stamped a form, handed it to
you, and you walked out with it into a place nobody had explained. Every one of those is an
*exchange*: the player put something in and the world visibly took it.

**`corpus/88-journeys/` and `corpus/22-character/` between them measured none of that.** They
measured distinct screenshot hashes, UI area fractions, entity counts, speaker records, token
purity in a data file, and gamepad reachability. Those are necessary and they are demonstrably not
sufficient, and the demonstration is not an argument — it is the `W1-07` record:

| Round 2 measured | Result | What the bars said |
|---|---|---|
| distinct creation frames | 19 of 19, both capture paths | pass |
| speaker resolves to a live NPC in a named interior | 18 of 18 | pass |
| opaque UI share of frame | 0.14–0.34 against a 0.55 ceiling | pass |
| a walkable room, a present interlocutor, ≥ 1 NPC at every node | yes | pass |
| **authored dilemma questions that reached the player** | **0 of 10** | *no check owned this* |
| **named professions the mandatory route ever produced** | **0 of 14, over 240 runs** | one axis, in another item |
| **the writ's text drawn at the node that stamps it** | **`rendered_text: []`** | passed as an API string |

A build can hold every structural bar in this corpus and still be a form with a room painted behind
it. The bar this item sets:

> **Every authored string the scene computes for a node must reach the frame at that node; at least
> seven of the eight character-defining answers must be used, inside the scene, by the person who
> asked for them, before the player leaves the room; and the questionnaire must end with somebody
> saying a profession out loud.**

## The reference artifact

### A. `MW/EXCHANGE` — what Morrowind's opening actually does with what you give it (canonical-recall)

Not the beat list — `RI-JRN01` §A owns that. This is the narrower question of **consumption**: for
each thing the player supplies, what the world visibly does with it, inside the scene.

| # | Player supplies | Consumed by, in the scene | Latency |
|---|---|---|---|
| 1 | a name, typed | **Jiub repeats it and remarks on it** | immediate, same exchange |
| 2 | a race | Socucius Ergalla **writes it on the form** and reads the form back | same exchange |
| 3 | a birthsign | written on the same form, confirmed aloud | same exchange |
| 4 | ten dilemma answers | **Ergalla names a profession out loud** — *"…you are a Battlemage"* | end of the route |
| 5 | all of the above | the form is **stamped and handed to you as an object you carry out** | end of the scene |
| 6 | a class chosen or inferred | Sellus Gravius does **not** mention it — the world moves on | — |

**Answers consumed inside the scene: 5 of 6. Authored question text delivered to the player: 10 of
10.** Neither number is impressive; both are the entire reason the scene is remembered, and both
were unmeasured by this corpus until this item existed.

Note row 6 deliberately. **The bar is not that everything is echoed** — a scene that repeats every
answer back is a receipt, not a conversation. The bar is that the *asker* uses what it asked for.

### B. Where a build loses this without losing anything else

The failure has a shape and the shape has been shipped: the model is correct, the model is
complete, the model is well written, and the surface that draws the scene reads a different field.
`W1-07` round 2 is the worked example and the line is one line:

```
game/src/character/scene.js:267   line: state.line || '',
```

`buildCensusModel()` reads `state.line` and never reads `state.question.text`, so ten nodes draw
one identical stock transition line above four answers with no question attached. Ten distinct
question texts existed in the model. One distinct line was drawn. **Nothing in `RI-JRN01`,
`RI-CHR01` or `RI-EXP01` had a number for that**, and the critic who found it found it by reading
M7's parenthesis *"as presented in play (not from the data file)"* and taking it seriously.

## Comparison method

All three measures are runnable **today**, against the build that exists, with no exemplar, no
naive-agent channel, and no tool that has not been written. That is deliberate: every other quality
instrument pointed at this journey is blocked on `A-JRN1`, `build-viability.mjs` or `session-run.mjs`,
and an item that joins that queue measures nothing for another wave.

### M1 — `ES-LEGIBLE/1`: the delivered-text ratio

For each node of the creation scene, take the set of **distinct authored strings the model computes
for that node** — the dilemma prose, the interlocutor's line, the mis-recording, the answer set, the
writ's body — and the set of **distinct strings actually drawn at that node**, read through the
build's rendered-text accessor (the same accessor `RI-JRN01` M9 requires the critic to name and
demonstrate non-empty).

```
DTR(node)  = |distinct authored strings drawn|  /  |distinct authored strings computed|
DTR_q      = DTR restricted to the questionnaire nodes
DTR_scene  = weighted over all creation nodes by string count
```

| Threshold | Value |
|---|---|
| `DTR_q` | **= 1.00.** Every question the route asks is printed where the player can read it |
| `DTR_scene` | **≥ 0.90** |
| **Hard fail** | `DTR` **< 0.50 on any node class** — the scene computed twice what it showed |
| **Hard fail** | `DTR_q < 1.00` **and** the undrawn strings are the *questions* rather than the answers |

**Distinct counts, never character counts.** Round 2's own instrument passed this scene because it
counted characters drawn and the *answers* differed between nodes while the *question* was the same
stock line at all ten. A length check cannot see this failure and must not be substituted.

**If the build exposes no rendered-text accessor, `DTR` is `unmeasurable ⇒ 0`,** not "assumed
drawn". A scene nobody can prove was drawn is a scene.

### M2 — `ES-ANSWERED/1`: the answers are consumed inside the scene

For each of `RI-CHR01` §1's eight inputs, assert the value the player gave is used **before the
player leaves the creation interior**, in at least one of:

- (a) a line spoken by the interlocutor that contains or responds to the value, **drawn to the
  frame**;
- (b) a visible object in the world that carries it;
- (c) a visible written record — the writ, the ledger — whose text is drawn.

`AC = consumed / 8`. **`sex` is exempt** and scored out of 7, because `RI-CHR01` §2 states it has
zero mechanical terms deliberately and an echo would be an invented consequence.

| Threshold | Value |
|---|---|
| `AC` | **≥ 6 of 7** |
| Pass floor | ≥ 5 of 7 |
| **Hard fail** | **< 4 of 7** — the scene is a form with an NPC drawn next to it (`RI-JRN01` How-we-lose #3) |

**A `getCensusState()` field is not consumption.** Per `RI-MTH07` §B1 the trace is an observer; the
observable here is what the player could see. This is the check that credits writing without asking
a critic for an opinion: a line that is *responsive to what the player just said* is a thing no
generator produces and no template survives. Round 2's Warden-Scribe observing race and
mis-recording it — *"Altmer. — No, of course not, you are not tall enough and you are not smug
enough. Dunmer. I will write Dunmer."* — is a full credit under (a), and it is a better idea than
Morrowind's own. **This item exists partly to make that scoreable**, because two verdicts have now
called this build's writing better than the reference's with no bar that could say so.

### M3 — `ES-NAMED/1`: the naming moment

`RI-CHR01` §4 states the questionnaire's purpose in its own words: *"The questionnaire may produce a
configuration identical to a named class, and when it does the Warden-Scribe says the name aloud —
**which is the moment the route is for.**"* No method in the corpus asserted that the line fires.
`RI-CHR01` M4 enumerates `4^10` answer combinations **against the data file** and asserts
reachability *in principle*; a route can be reachable in principle and never taken.

Run a sweep of **≥ 240 questionnaire completions** covering all 10 races × 4 upbringings, with a
**published, verified answer histogram** (report the a/b/c/d counts; a sweep whose answer pattern is
biased is void — round 2 withdrew one of its own probes for exactly this and was right to).

| Quantity | Threshold |
|---|---|
| `NAMED_distinct` — distinct named `class_id` values produced | **≥ 10 of 14** for full marks, **≥ 6** to pass |
| `NAMED_line` — sweeps in which `on_match_named_class`'s line **reached the frame** on a named match | **100%** |
| `NAMED_rate` — fraction of runs ending in a named profession | reported, not banded; **an honest unnamed band is legitimate** and the item does not require every run to be named |
| **Hard fail** | `NAMED_distinct == 0` — the mandatory route cannot produce the thing it exists to produce |

`NAMED_rate` is deliberately unbanded. *"I do not have a word for what you are"* is a good answer
for a customs officer to give and forcing it to zero would be worse design; what may not happen is
the answer never existing.

### M4 — the citations

A verdict scoring this item must additionally record, or state why it cannot:

1. `RI-PLT03` P1's measured `T_control` for the same build.
2. `RI-EXP01`'s `N_found`, `T_lie`, `T_refusal` and `N_odd`. That item is the corpus's only
   quality instrument for the opening, its paths are declared by no wave-1 piece,
   ~~its tool (`tools/experience/session-run.mjs`) does not exist~~ — **CORRECTED 2026-08-14
   (AUDIT-CITATION-STALENESS): `tools/experience/session-run.mjs` IS on disk, 47 182 bytes.**
   The clause is struck rather than deleted because it is the reason a verdict was allowed to
   answer `blocked_on`, and that excuse is now gone: **the tool exists, so a verdict that wants
   to record `blocked_on: RI-MTH06` must first say what happened when it ran the tool.** Whether
   it has ever been run on a build is a separate question this correction does not answer, and
   the sentence below still stands until somebody measures it.
   Recording `blocked_on: RI-MTH06` is an acceptable answer only with that run attached; silence
   is not. *(Stamped at commit `5bbde201`; re-derive with `ls -l tools/experience/session-run.mjs`.)*

## Scoring

Native scale **0–100**, `weighted-sum`, plus hard fails.

| Check | Weight | Full marks |
|---|---:|---|
| **M1 `DTR`** | **45** | `DTR_q = 1.00` and `DTR_scene ≥ 0.90` |
| **M2 `AC`** | **30** | ≥ 6 of 7 answers consumed in-scene, each with the drawn evidence quoted |
| **M3 `NAMED`** | **20** | ≥ 10 of 14 distinct named classes reached in a published-histogram sweep, naming line drawn 100% of the time |
| **M4 citations** | **5** | all four numbers cited or their debt named |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 45–69 | Recognisably attempting it | 5 |
| < 45 | **We lose** | 4 |

**Native → ladder anchors:** native 30 → ladder **2**; native 50 → ladder **4**; native 75 → ladder
**6**; native 92 → ladder **8**. Native **0–20 → ladder 0–1**.

**Hard fails (any one caps the item at 2 and sets `status: FAIL`):**

- **HF1** — `DTR < 0.50` on any node class. *The failure this item exists to prevent.*
- **HF2** — `AC < 4 of 7`.
- **HF3** — `NAMED_distinct == 0`.
- **HF4** — the sweep's answer histogram is unpublished or biased. A measurement whose input
  distribution is unstated is not a measurement, and this project has already voided one.

**Aggregation (a property of this item, not of the critic):** `weighted-sum`.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3)

This whole item **is** a consumption check, applied to the one model class `RI-MTH07` did not
cover: a model consumed by the **frame** rather than by an entity. `RI-MTH07` §A's three shapes are
orphan model, orphan data and orphan predicate; this journey produced a fourth and it needs a name.

> **Orphan text** — a string authored, computed correctly, carried through the model, exposed
> through the harness, and **never drawn**. From the player's chair it is identical to a string
> that was never written. `greetings.json`'s 1,500 lines and the ten dilemma questions are the same
> failure at two different distances from the screen.

The consequence is `RI-MTH07`'s, unchanged and binary: a `coupling == 0` on any model this item
requires to act scores that dimension **0**, fail-closed. There is no `partial`.

## How we lose

- **The build draws the questions and nothing else changes.** `DTR_q` goes to 1.00, the item scores
  45, and the scribe still never names a profession, the writ is still a return value, and the
  Warden-Scribe still says the same thing to a Dunmer and a Saxhleel. M1 is the largest weight
  because it is the largest failure; it is not the whole item, and a builder who closes only it
  lands at 45/100 — "we lose" by construction.
- **`AC` is satisfied by echoing.** Every answer read back verbatim — *"You said Dunmer. You said
  Silence-Under-Salt."* — scores 7 of 7 and is worse writing than not doing it. The mitigation is
  in the evidence requirement: the critic quotes the drawn line for each of the seven, and a
  verdict whose seven quotes are seven templates should say so in prose and score the axis at its
  floor. This is the one place in the item where a critic must exercise judgement, and it is
  declared here rather than hidden.
- **`NAMED` is met by widening the matcher until everything is named.** A matcher with no unnamed
  band produces 14 of 14 and destroys the honest *"I do not have a word for that"* answer.
  `NAMED_rate` is reported precisely so a suspicious 1.00 is visible; a wave-2 band on it must come
  from the measured distribution and not by analogy.
- **The item is read as "score the prose".** It is not, and it must not become that. Every one of
  the three measures is a count of strings, answers or runs. The *only* judgement it asks for is
  whether seven quoted lines are seven templates, and that judgement is bounded, evidenced and
  declared.
- **It joins the blocked queue.** The single most likely way this item becomes worthless is a
  builder or critic deciding it needs a `tools/journey/exchange-run.mjs` first. It does not. Every
  number here was produced by hand, by the round-2 critic, with Playwright and `window.__HARNESS`,
  before this item existed.

## Provenance note

**`constructed`, confidence medium**, and binding on that basis: `DTR`, `AC`, `NAMED`, the weights
45/30/20/5, the four hard fails and every threshold in this file. They are conventions defined by
this item, in the same class as `RI-MTH07`'s `[0.95, 1.05]` coupling band, and they are declared as
such rather than presented as derived.

**The thresholds that are set by argument rather than by measurement, named so they can be
re-derived:** `DTR_q = 1.00` is not a taste judgement — a question the player cannot read is not a
question, and there is no defensible fraction below 1 — but `DTR_scene ≥ 0.90` **is** taste, chosen
to leave room for authored strings a scene legitimately holds back. `AC ≥ 6 of 7` is argued from
`MW/EXCHANGE`'s 5 of 6 plus one, on the ground that a constructed bar should exceed the recalled
reference it is built from. `NAMED_distinct ≥ 10` is **inherited unchanged** from `RI-CHR01` §5's
existing target and is not a new threshold. All three must be re-derived from wave 2's first full
run, and this item's own scoring is not exempt from the discipline it applies to others.

**§A (`MW/EXCHANGE`) is `canonical-recall`, confidence medium** — Jiub repeating the name, Ergalla
writing race and birthsign onto the form and reading it back, the profession spoken aloud at the end
of the ten questions, and the stamped document handed over are recalled sequences from Morrowind
(2002), consistent with `RI-JRN01` §A's independent recall of the same scene. **No threshold in this
item is derived from a Morrowind timing**, and none compares our numbers to theirs.

**Every figure quoted about the build is `measured` and attributed rather than re-measured here:**
0 of 10 questions drawn, 10 distinct question texts against 1 distinct drawn line, 0 of 14 named
classes over 240 runs with an a/b/c/d histogram of 600/600/600/600, `rendered_text: []` at the
stamped node, 19 of 19 distinct frame hashes and 18 of 18 speaker resolutions are all quoted from
`corpus/90-verdicts/wave1/W1-07-r2.md` and its artifacts. **This item's author did not re-run the
build**; it judges standards, not code.

**Filed by** `BAR-CRITIQUE-W1-07-R1` §R3, as the opening's counterpart to `RI-CMB12` on the fight
side and `RI-WPN07` on the weapon side. Three bar critics working independently on three areas have
now each found the same hole: **this corpus systematically verifies the artifact and not the
artifact's effect.**
