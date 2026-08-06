# Scoring — the calibration ladder

**Status: binding.** Read with `CRITIC-DOCTRINE.md`. This file exists for one reason:
**independent critics must produce the same number for the same artifact.** Without shared
anchors, ten critics produce ten scales, all of them drifting upward, and the corpus stops
being a spec and becomes a mood ring.

Two layers of scoring, and they do not replace each other:

1. **Each reference item's own scale** (its `## Scoring` section). This is the real
   measurement — frames, counts, ratios, pass/fail per check. Always record it verbatim
   in the verdict (`native_scale` / `native_score` / `native_verdict`).
2. **The shared 0–10 ladder** below, so results from a frame-count item and a prose item
   can sit in the same table and the same progress page. The ladder is a *translation*,
   never a substitute.

---

## 1. The ladder

| Score | Band | Anchor — what this actually looks like |
|---|---|---|
| **0** | **Absent / unmeasurable** | The thing does not exist, or could not be measured. Fail-closed: unmeasurable is **0**, never "unknown", never omitted. |
| **1** | **Placeholder** | A stub that exists only so something exists. A cube that plays a sound. A journal that prints "quest updated". Nobody could mistake it for the thing. |
| **2** | **Wrong shape** | Implemented, but built on a model the reference rejects outright. Dice-roll to-hit. A quest that is one fetch step. Aggro that is a distance check. Effort was spent; it was spent on the wrong design. |
| **3** | **Skeleton** | The right structure with almost nothing in it: correct state machine, one state used; a topic list with three topics; a region with a floor and two rocks. A player sees the intention and immediately sees it is unfinished. |
| **4** | **Recognisable but wrong** | Fully the right idea, executed with values or content far from the bar. Roll exists but the window is half the reference. Dialogue exists but every NPC says the same thing. It survives 30 seconds of play, not 60. |
| **5** | **Recognisably attempting the thing — and clearly worse than the reference in a way a player would notice within a minute.** | **The pivot anchor.** The mechanic is present and behaves in the right category. A player who knows the reference identifies the deficit inside one minute of ordinary play, without instrumentation. This is where honest early work lands. Most Wave 1–2 pieces should score 4–5. |
| **6** | **Competent but thin** | The deficit is no longer obvious in the first minute; it shows up in the tenth. Enough content/tuning to be played rather than demoed. **This is the default `pass_threshold`** — a 6 is a pass, and it is still visibly not the bar. |
| **7** | **Close** | An expert playing side-by-side prefers the reference, and can say why in one sentence. Every measured check passes or is marginal; the remaining gap is refinement, not construction. **Requires a written `justification` naming the artifact that proves it.** |
| **8** | **Blind-indistinguishable to a non-expert** | In a fair blind pack on this dimension, a non-expert cannot reliably tell ours from the reference; an expert still can, on a specific named property. All of the item's checks pass outright. Requires `justification` **and** a passed blind comparison (or a recorded `not_possible` reason). |
| **9** | **Beats the reference on this dimension** | Ours is measurably better on the dimension the item judges, and the improvement does not violate arbitration (a "better" that breaks the Souls fight or the Morrowind world is a **fail**, not a 9). Requires artifacts showing the reference losing. |
| **10** | **Beats it and there is no residual deficit** | 9, plus a genuine attempt to find a deficit that failed, documented with the escalation ladder (CRITIC-DOCTRINE §2.1) applied in full. |

### 1.1 Rules that stop inflation

- **9–10 requires beating the reference on that dimension, and is expected to be
  rare-to-never.** If your wave produced several 9s, the wave is mis-scored, not brilliant.
- **Any score ≥ 7 requires `justification` naming a specific artifact.** The aggregator
  clamps unjustified ≥ 7 to **6** and records `unjustified_high_score`.
- **A score may never exceed the item's own verdict band.** If the item's `## Scoring`
  says "Below bar — named remedy required", the shared score cannot be ≥ 7. The native
  band is a ceiling; the ladder can only be more pessimistic, never more generous.
- **Any triggered hard fail caps the whole item at 2**, no matter how many other checks
  passed. A hard fail means the piece is built on a rejected model.
- **`measured: "unmeasurable"` ⇒ 0.** Not skipped, not averaged out, not "N/A".
- **Roundness is fine.** Score in whole numbers. Half-points are false precision and are
  usually a critic negotiating with itself.
- **Never score relative to our previous wave.** The reference is the bar (CRITIC-DOCTRINE
  §2.4). Progress is visible in the *trend* of scores; it is not an input to a score.

### 1.2 Translating a native scale to the ladder

Do not linearly rescale the native number. Rescaling is how 12/18 becomes "6.7 ≈ 7" when
the item itself calls 12/18 "below bar". Instead:

1. Take the item's **own verdict band** for your native score. That sets the ceiling:
   - "Meets the bar" → ceiling 8 (9–10 only with beat-the-reference evidence)
   - "Below bar — named remedy required" → ceiling 6
   - "Loses outright" → ceiling 4
2. Within that ceiling, place the score using the §1 anchors and what you actually saw.
3. Apply the caps in §1.1.
4. Record both numbers. The native one is the measurement; the ladder one is the summary.

> **AMENDED wave 0 (corpus-audit) — BAR-CRITIQUE-01 W7. The mapping is now MANDATORY and
> TABULATED PER ITEM, not left to the critic.**
>
> Score scales across areas were never comparable while `pass_threshold: 6.0` was applied to
> all of them. `10-combat` uses **weighted sums** where 70/100 is "gap named, remediable" and
> <70 is "we lose". `20-progression` uses **min over axes**, where any axis below 6 fails the
> item. `70-visual` uses `min(ART, FIDELITY)` with hard caps. `30-quests` uses bands.
> `50-world` uses 0–10 with "WE LOSE" clauses. **A "6" therefore meant five different
> things**, and §3 below additionally let the critic pick `mean` / `min` / `weighted-mean`
> per piece — so the aggregate progress number was noise.
>
> **Every reference item's `## Scoring` section MUST now contain this row, verbatim, with its
> own native numbers filled in:**
>
> ```
> | Ladder | 4 | 6 | 8 |
> |---|---|---|---|
> | Native | <native score that maps to 4> | <…to 6> | <…to 8> |
> ```
>
> - **Aggregation is a property of the item, not of the critic's mood.** Each item also states
>   its own aggregation rule (`weighted-sum`, `min-over-axes`, `band`) in that section. §3's
>   choice applies only to combining *items*, never to computing one.
> - **An item with no ladder row is `unmeasurable` and scores 0**, fail-closed. This is
>   deliberately harsh: without the row the ladder is a translation nobody can check, and a
>   translation nobody can check is how every number in the corpus quietly becomes a 7.
> - **Enforcement:** this is a per-item obligation on the item's owner, and it is the one
>   wave-0 amendment that could not be applied by the audit — see `CORPUS-COHERENCE-01.md` §7,
>   "edits not made", for why filling in 126 items' anchor rows is authorship rather than
>   coherence repair, and for the ledger entry tracking it.

### 1.2a AMENDED wave-1-prep — BAR-CRITIQUE-02 **C1 / N1**. The row is now enforced.

The W7 amendment above was live for an entire wave and **109 of 137 items never carried an
anchor row**, because nothing could see whether they did. Every one of them was
`unmeasurable ⇒ 0` as written, including `RI-QST06` (the main quest), all six `86-ui` items
and `RI-UIX02` (the AR-2 enforcement point). That is exactly the false-enforcement pattern
W5 named: a mandatory, fail-closed rule with no instrument behind it.

Three things change, and **no threshold anywhere in the corpus changes**:

1. **The anchor block is machine-checked.** `node tools/corpus-index.mjs --check` now fails
   with an **error** on any reference item whose `## Scoring` section contains no anchor
   block. It is check **C6** of `RI-MTH05`. `--check` reports `ladder anchors : N/137`.

2. **Three forms satisfy the rule** (the corpus had independently invented the second and
   third, and reconciling 109 items to a single orientation would have been churn with no
   measurement value):

   - **Form A — the mandated row.** Preferred for new items.

     ```
     | Ladder | 4 | 6 | 8 |
     |---|---|---|---|
     | Native | <native that maps to 4> | <…to 6> | <…to 8> |
     ```

   - **Form B — a transposed or band table with a column titled `Ladder` (or
     `Ladder ceiling`) whose values cover 4, 6 and 8.** The `12-weapons` and `88-journeys`
     forms.
   - **Form C — a prose anchor line** binding native values to ladder 4, 6 **and** 8, e.g.
     *"native 55 → ladder 4; native 75 → ladder 6; native 88 → ladder 8"*.

   **A verdict-band table on its own is not an anchor block.** It fixes a *ceiling* under
   step 1 above; it does not say which native score is a 6 rather than a 4. That distinction
   is the whole point of the row, and it is why "102 items are substantively compliant" was
   not good enough.

3. **Gate and cap items.** A few items emit no score of their own: they either gate the wave
   (`RI-UIX02`, `RI-VIS09`, `RI-MTH05`) or cap another item's score (`RI-VIS06`, `RI-VIS07`).
   These still carry the row — a reader must be able to see *at the item* that it contributes
   no ladder number — but a cell may read `n/a` where the item's native scale genuinely has
   no rung at that ladder position, and the aggregation line must say `gate` or `cap` and
   name what it gates or caps. **`n/a` is only admissible for a declared gate/cap item.** An
   ordinary scored item with `n/a` in its row is the same failure as having no row.

Every item's aggregation rule (`weighted-sum`, `min-over-axes`, `band`, `count-of-checks`,
`gate`, `cap`) is stated immediately under its row. §3's choice of aggregation applies only
to combining *items*, never to computing one.

---

## 2. Worked calibration examples

These four are the anchors. When two critics disagree, they resolve it against these,
not against each other.

### 2.1 Dimension: a combat trace (`combat.enemy.movement`)

Bar (paraphrasing RI-AI01): the enemy negotiates distance — approach, hold a band,
strafe, feint, then commit. Measured from a 60 s trace: `spacing_variance ≥ 0.8 m`,
`min_dist_dwell ≤ 0.10`, `state_entropy ≥ 1.5 bits`.

**A 3 looks like:**
```
dist_m: 14.0 → 12.1 → 9.8 → 7.2 → 4.9 → 2.4 → 0.9 → 0.8 → 0.8 → 0.8 → 0.8 …
state:  APPROACH ×  all frames.  spacing_variance 0.06 m after contact.
min_dist_dwell 0.94. state_entropy 0.0 bits.
```
A straight line into the player's capsule, then a swing from inside it. The state machine
exists in name (one state is used). Nothing about distance matters.

**A 5 looks like:**
```
dist_m oscillates 0.7 ↔ 2.6 with a 1.4 s period, sawtooth, identical every cycle.
state:  APPROACH / ATTACK / BACKSTEP, cycling in fixed order.
spacing_variance 0.71 m. min_dist_dwell 0.28. state_entropy 1.05 bits.
inter-COMMIT interval CV = 0.04.
```
There is a loop, and it is a metronome. A player notices within a minute that the enemy
attacks on a timer and that standing at 3 m is identical to standing at 5 m. Right
category, visibly mechanical. **This is the pivot anchor.**

**A 7 looks like:**
```
dist_m wanders 2.4–4.6 with irregular dwell; occasional step-in to 1.9 that does not commit.
state histogram: APPROACH .21 CIRCLE .38 STEP_IN .11 COMMIT .14 RECOVER .12 REPOSITION .04
spacing_variance 0.94 m. min_dist_dwell 0.07. state_entropy 1.9 bits.
inter-COMMIT interval CV = 0.31. Feint ratio T14/(T13+T14) = 0.19.
```
All checks pass. The expert's one sentence: "it always steps in from the same bearing, so
after ten minutes you can bait every commit by standing at 4 m on its left."

---

### 2.2 Dimension: a journal entry (`journal.entry.voice`)

Bar: numbered, dated, first-person, written by the character; carries the directions in
prose because there are no markers; sounds like a person recording events, not a UI.

**A 3:**
> **12. The Drowned Shrine**
> Objective: Find the shrine. Speak to Ree-Vaska.

A UI string wearing a journal's clothes. Second person implied, no voice, no date, and it
tells you nothing you could navigate by.

**A 5:**
> **12 — 4th of Sun's Height**
> Ree-Vaska in Lilmoth told me to find the drowned shrine south of the town and to bring
> back what I find there. She said to be careful of the water.

First person, dated, numbered, gives a direction. But it is a summary of a quest state,
not a person's account: no attitude towards Ree-Vaska, no doubt, no detail a player could
actually navigate by ("south of the town" is a compass, not a landmark), and it reads the
same as every other entry in the game. A player notices the flatness within a minute of
reading two entries.

**A 7:**
> **12 — 4th of Sun's Height**
> Ree-Vaska would not say the shrine's name, only that it is "under the water where the
> mangroves stop." From the fish-drying racks at Lilmoth's southern gate I am to follow the
> boardwalk until it ends, then keep the black water on my left until the trees give out.
> She was very careful to tell me twice not to drink there. I did not ask what happened to
> the last person she sent.

Navigable from the text alone, in the character's voice, carries the NPC's evasiveness
and the player's suspicion. The expert's sentence: "Morrowind would have let the entry be
*wrong* — this one is accurate, so the world never lies to me in my own handwriting."

---

### 2.3 Dimension: a screenshot (`render.fidelity.lighting` — **fidelity axis**)

Bar: current-generation references only (ARBITRATION §4). Same camera pose, same
time-of-day, stated resolution. **Citing a 2002 Morrowind screenshot here voids the
verdict** — that comparison belongs to `render.art.*`.

**A 3:** Flat unlit-looking scene: one directional light, no shadows or a single hard
shadow map with visible acne, ambient as a constant grey term so every surface reads the
same brightness regardless of orientation. Materials are diffuse-only; wet mud and dry
stone have the same response. Sky is a gradient with no relationship to the light
direction. Nothing in the frame tells you where the sun is except the shadowless glare.

**A 5:** Directional light plus a shadow map, PBR materials, tonemapping. Recognisably a
modern renderer's output. But: one cascade, so shadows are blocky within 15 m and gone by
40 m; no indirect bounce, so shadowed sides of objects sink to near-black; no aerial
perspective, so a tree at 200 m has the same contrast as a tree at 5 m and the depth
collapses. A player notices the "cardboard cut-out" look in the first minute of walking.

**A 7:** Multi-cascade shadows with acceptable transitions, sky-light IBL giving coloured
ambient from above and bounce from below, distance fog with height falloff so the marsh
recedes properly, sensible exposure and no bloom bleeding. Expert's sentence: "contact
shadows are missing, so every object floats a few centimetres above the ground when you
look at its base."

---

### 2.4 Dimension: a questline structure (`quests.faction.escalation`)

Bar: errands escalate to politics escalate to power over the faction; branch points that
close doors; at least one quest-giver with an agenda of their own.

**A 3:** Five quests in a fixed line. Each is "go to X, kill/fetch Y, return". Rank
increases by one per completion, with no requirement beyond completion. Nobody in the
faction refers to any other quest. Extracted graph is a path of five nodes with no edges
out.

**A 5:** Eight quests, still a line, but three have two ways to finish (fight or bribe),
rank requires a skill threshold, and one quest-giver is characterised. Extracted graph
shows branches that reconverge one node later and never change any later node's content.
A player notices within a minute of the second quest that their choice did not matter,
because the next giver's dialogue is identical either way.

**A 7:** Twelve quests across three tiers. Tier 2 requires rank + a skill + an attribute.
Two quests are mutually exclusive with a rival faction's quests, and taking one visibly
locks the other in dialogue. One giver lies about the target; the truth is discoverable
from a third party before you act, and acting on it changes the tier-3 opening. Extracted
graph has a real diamond that stays split for four nodes. Expert's sentence: "the
escalation is in the *stakes* but not in the *player's authority* — at the top of the
faction you are still running errands for someone."

---

## 3. Scoring the piece overall

`score.overall_0_10` combines per-item scores:

- **`mean`** (default) when the reference items measure different dimensions of the same
  piece.
- **`min`** when the items are gates rather than dimensions (e.g. an AR-critical item):
  the piece is as good as its worst gate.
- **`weighted-mean`** only with explicit `weights` recorded in the verdict, and only when
  a weighting is defensible from the item list itself, never from importance-to-us.

Then apply, in order: item ceilings (§1.2), hard-fail caps (§1.1), unjustified-≥7 clamp.

**The choice above applies only to combining *items* into a piece score.** Computing a single
item's native score uses **that item's own stated aggregation rule** (§1.2, amended wave 0) and
the critic has no discretion over it.
`pass_threshold` defaults to **6.0** and is raised by the orchestrator in later waves;
whatever it is, record it in the verdict — a threshold that is not written down is a
threshold that drifts.

---

## 4. Anti-inflation audit (per wave)

The orchestrator (or the coherence agent) runs this over the wave's verdicts. Any trigger
means re-run the flagged critics, not celebrate:

| Signal | Threshold | Meaning |
|---|---|---|
| Mean overall score | > 7.0 in waves 1–3 | Critics are grading effort. |
| Share of scores ≥ 8 | > 15% | Anchors are not being used. |
| Share of blind picks landing on ours | > 35% | Soft critics or unfair blind packs. |
| Verdicts with zero `corpus_extended` | 100% of a wave | Nobody hit an edge; suspicious. |
| Gaps with `severity: minor` | > 50% of the wave | The "biggest gap" is being chosen for comfort. |
| Any remedy with no number/observable in `acceptance` | any | Non-buildable remedy; verdict PROVISIONAL. |
| Score rose ≥ 3 in one wave on one item | any | Verify with the artifacts; usually a method change, not an improvement. |

---

## 5. The gap ledger

Every verdict names exactly one gap. The ledger is where those gaps live between waves.

**Files**
- `corpus/90-verdicts/GAP-LEDGER.json` — **canonical, machine-readable.** Generated.
- `corpus/90-verdicts/GAP-LEDGER.md` — human-readable view. Generated from the same data.
- Generator: `node tools/gap-ledger.mjs` (regenerates both from every verdict in
  `corpus/90-verdicts/*/*.json`). **Never hand-edit either file** — edit the verdicts.

**Entry shape** (one per gap, keyed by `gap_id`):

```json
{
  "gap_id": "GAP-W1-combat-dodge-iframe-window",
  "subsystem_path": "combat.dodge.iframes",
  "opened_wave": 1,
  "opened_by": "crit-w1-dodge-3f9a",
  "piece_id": "combat-dodge-core",
  "severity": "blocking",
  "what": "...",
  "why_it_matters": "...",
  "remedy": { "action": "...", "targets": [...], "acceptance": "...", "ref_item": "RI-CMB03", "estimated_size": "S" },
  "evidence": ["..."],
  "status": "open",
  "assigned_to_wave": 2,
  "closure": {
    "closed_wave": null, "closed_by": null,
    "measured_value": null, "evidence": [], "note": null
  },
  "age_waves": 1
}
```

**Lifecycle**

```
critic emits biggest_gap
      → tools/gap-ledger.mjs picks it up, status: "open", assigned_to_wave = opened_wave + 1
      → NEXT WAVE'S BUILDER on that subsystem path is handed the open gaps for that path,
        UP FRONT, as required reading (BUILDER-PROMPT-TEMPLATE.md)
      → builder implements against remedy.acceptance
      → NEXT WAVE'S CRITIC (a different agent) re-measures remedy.acceptance and records
        gap_closure[] in its own verdict
      → ledger regenerates: status becomes closed / partially-closed / open / superseded
```

**Rules**

1. **A gap cannot be closed by the agent that built the fix.** Closure is a critic act, in
   a verdict, with new artifacts. `gap_closure[].closed_by_builder_of_fix: true` makes the
   closure invalid and the generator ignores it and prints a warning.
2. **A gap is closed only against its own `acceptance` string**, re-measured. "Looks better
   now" is not closure. If the acceptance condition was unmeasurable, the gap becomes
   `invalid` and a corpus extension must supply a measurable one.
3. **`partially-closed` is a real state** and keeps the gap open with an updated
   `measured_value`, so slow progress is visible instead of being rounded to done.
4. **`superseded`** is only for gaps replaced by a strictly harder gap on the same path;
   the superseding `gap_id` must be recorded. Superseding is not closing.
5. **Every open gap is handed to the next wave's builder for its subsystem path.** A
   builder that starts without reading its path's open gaps is out of process.
6. **Age is tracked.** `age_waves ≥ 3` on a `blocking` gap is escalated to the dimension
   owner: either the remedy is wrong or the piece needs a rebuild rather than a patch.
7. **One gap per verdict, always.** The ledger grows by one entry per judged piece per
   wave, forever. A shrinking ledger means gaps are closing faster than they open —
   report it, but verify it against §4 before believing it.
