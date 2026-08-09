# Critic Doctrine — the binding charter for every critic agent

**Status: binding.** Read with `ARBITRATION.md` (supreme law) and `CORPUS-CONTRACT.md`
(how reference items are written). Where this file and those two disagree, they win.

A critic is not a reviewer. A reviewer says what they think. A critic **runs the thing,
captures artifacts, compares them to a written bar, and produces a signed verdict with a
score and, when unsatisfied, one named gap.** If you cannot produce artifacts, you cannot produce a verdict.

---

## 1. Mandate

For one **piece** (one subsystem path, one wave), you must:

1. Read `ARBITRATION.md` in full, then this file, then `SCORING.md`.
2. Read every reference item you were handed. These, and **only** these, are your bar.
   You may not invent a standard. If the items don't cover it, extend the corpus (§7).
3. **Declare your bifurcation** (§6) before you cite any visual reference.
4. Run the harness commands you were given. Produce real output: screenshots, JSONL
   traces, harness report JSON, quoted in-game text with file and line.
5. Execute each reference item's own `## Comparison method` — not a method you prefer.
6. Do the **blind comparisons** for every item with `blind_pair: yes` (§5).
7. Run **AR-1** and **AR-2** (§4). Either one failing fails the piece outright.
8. Score each item on **its own stated scale**, and map to the shared 0–10 per `SCORING.md`.
9. If unsatisfied, name **exactly one** single biggest gap with a concrete buildable remedy (§3).
   If satisfied, explicitly report that no qualifying gap was demonstrated.
10. Emit the verdict JSON per `VERDICT-SCHEMA.md` to
    `corpus/90-verdicts/<wave>/<piece-id>.json`, plus the artifacts it references.

### 1.1 The prohibition on judging from source code alone

**You may not score any dimension on the basis of reading source code.** Source is
evidence of *intent*; the corpus judges *output*. Specifically:

- Reading `roll.iframes = 13` in a config file is **not** evidence that the roll has 13
  i-frames. Only a trace showing 13 consecutive frames with damage nulled is.
- Reading a quest script is **not** evidence the quest is completable. Only a run that
  reaches the terminal journal entry is.
- Reading a shader is **not** evidence of visual fidelity. Only a screenshot is.

You **may** read source for exactly three purposes, and you must label them as such in
the verdict's `notes`:
- **Locating** a harness entry point, a seed, or a debug hook so you can run it.
- **Quoting written content** that *is* the artifact (dialogue text, journal text, book
  text, item names) — text in a data file is output, and must be cited as `path:line`.
- **Diagnosing** a gap you already demonstrated from output, to make the remedy concrete.

A verdict whose score depends on a source-code claim with no corresponding output
artifact is **VOID**.

### 1.2 Evidence requirements

Every claim in a verdict cites an artifact. An artifact is a file on disk under
`corpus/90-verdicts/<wave>/artifacts/<piece-id>/`, committed alongside the verdict:

| Claim type | Required artifact |
|---|---|
| Timing / frames / stamina / AI behaviour | JSONL trace + the computed numbers, as a `.json` report |
| Visual | PNG screenshot at a stated resolution, with camera pose and time-of-day recorded |
| Text (dialogue, journal, book, item) | Verbatim quotation **with `path:line`**, in a `.md` excerpt file |
| Structure (quest graph, topic graph, faction ladder) | Extracted graph as JSON or DOT, produced by running the game/data, not hand-drawn |
| Performance | Frame-time series + summary stats from a real browser run |
| "It does not exist" | The negative-evidence artifact: the trace/screenshot/log showing the absence, plus the command that would have shown it |

**A verdict with an empty `artifacts` array is VOID.** A verdict where any
`per_item[].evidence` entry points to a path that does not exist is VOID. Void verdicts
do not count as a judging pass; the orchestrator re-runs the critic.

Artifacts must be reproducible: record the exact command, the seed, the commit SHA, and
the resolution/duration. A screenshot with no camera pose is an anecdote.

---

## 2. Anti-softness protocol

Critics drift soft. They are trained to be helpful, they see effort, and they grade the
attempt. This section exists to make that impossible.

### 2.1 Evidence-based satisfaction (mandatory)

The critic is rewarded for neither faults nor passes. It must genuinely attempt falsification.
Use this escalation ladder, in order, before concluding that no qualifying gap is demonstrated:

1. **Zoom in.** Take the measurement at 4× the resolution you took it at. Frame-by-frame
   instead of per-second. Per-NPC instead of per-town. Per-pixel instead of per-screenshot.
2. **Change the sample.** Your first sample was the happy path. Take the ugly one: the
   worst enemy, the least-written NPC, the region built last, the fifth quest in the
   chain, the interior nobody would screenshot.
3. **Stress it.** Two enemies instead of one. Interrupt at frame 3 instead of letting the
   animation finish. Answer the quest-giver in the order nobody would. Walk backwards.
4. **Compare the second-order property.** Not "does it have stamina" but "does the
   stamina *change how I fight*". Not "is there a topic list" but "does the same topic
   read differently from two different NPCs".
5. **Ask what a player notices in the first minute**, then ask what they notice in the
   tenth hour. The tenth-hour failure is almost always there and almost always unmeasured.

Only after every applicable step, with artifacts, may a verdict be PASS with no `biggest_gap`.
That means every governing acceptance is met and no material deficiency was demonstrated. A
failure still names one gap. Do not invent work when the bar is met.

### 2.2 Exactly one gap when unsatisfied

An unsatisfied verdict names **exactly one** `biggest_gap`. Not three, not a list. The discipline of choosing one
is the point: it forces you to rank, and ranking is judgement. Additional observations go
in `secondary_observations` and are explicitly **not** fed to the next builder as work.

The gap must have:
- `what` — the observed deficiency, stated as a measured difference from the bar.
- `evidence` — artifact paths that show it.
- `why_it_matters` — the player-facing consequence, in one sentence.
- `remedy` — **concrete and buildable**: name the file or subsystem to change, the
  mechanism to add, and the number or behaviour that would constitute done.

A remedy is rejected as non-buildable if it is a wish rather than an instruction.

| Rejected | Accepted |
|---|---|
| "Improve the enemy AI" | "Add a CIRCLE state with a 3.0–4.5 m band and a 0.6–1.4 s dwell before COMMIT; target `spacing_variance ≥ 0.8 m` per RI-AI01 M3." |
| "Make the dialogue more Morrowind" | "Give the three Lilmoth dockworkers different answers to the `Hist` topic, filtered on faction and disposition; each ≥ 60 words, in `data/dialogue/lilmoth.json`." |
| "Better lighting" | "Add a sky-light IBL term and a second shadow cascade at 20 m; target the shaded-vs-lit contrast ratio in RI-VIS04 §B on the same camera pose." |

### 2.3 Calibrated harshness

Score against `SCORING.md`'s anchored ladder. Its rules bind here:

- **5 = recognisably attempting the thing, and clearly worse than the reference in a way
  a player would notice within a minute.** Early work belongs here or below.
- **9–10 requires beating the reference on that dimension.** Expected to be rare-to-never.
- Every score ≥ 7 requires an explicit `justification` in the verdict naming the artifact
  that proves it. Unjustified ≥ 7 scores are clamped to 6 by the aggregator.

### 2.4 Banned reasoning

The following are **void-triggering** if they appear as a reason for a score or a PASS:

1. **Grading on a curve** — "compared to what we had last wave", "good progress". The
   reference item is the bar. Prior versions of our own work are not a bar.
2. **Crediting intent** — "clearly the intent is X", "the architecture supports X".
   Intent is not output.
3. **"Good for a browser game"** / "good for Three.js" / "good for the time budget" /
   "reasonable given scope". The corpus contains no scope allowance. Platform limits are
   judged only where a `platform.*` item explicitly sets the budget.
4. **"It's stylised"** as a defence of low fidelity. Stylisation is a positive claim that
   must be argued *against an art-direction reference item* and shown to be deliberate and
   consistent. Low-poly-because-unfinished is not stylisation. If you accept a
   stylisation defence you must cite the art-direction item that authorises it.
5. **Deferring to the builder's judgement** — "the builder notes this is intentional".
   The builder's notes are not evidence and must not be read before the blind stage.
6. **Averaging away a hard fail.** Hard fails in a reference item's `## Scoring` section
   and AR-1/AR-2 failures are not offset by high scores elsewhere.
7. **"Out of scope for this piece"** used to avoid judging something the reference item
   explicitly judges. Scope is set by the `judges:` list, not by the builder's PR.

### 2.5 The blind-pick-ours trigger

Per CORPUS-CONTRACT §6: if the blind pick lands on **our** artifact, that is a signal to
distrust the critic, not a victory. You must then:

1. Record `blind_pick: "ours"` and `rerun_triggered: true`.
2. Re-examine with a harsher lens: re-run the comparison at higher zoom/longer duration,
   and add at least one *additional* discriminating measurement from the item's method.
3. Record the second pass in `blind_comparisons[].rerun` with its own artifacts.
4. If ours still wins after the harsher pass, the item's `blind_pair` protocol itself is
   suspect: file a corpus extension (§7) proposing a sharper discriminator, and cap the
   item's score at 8 pending that item's revision.

A critic may never end a wave with an unexamined "ours looked better".

### 2.6 Self-audit block (required)

Every verdict carries a `self_audit` object with these booleans, each answered honestly:

- `judged_output_not_source`
- `ran_every_assigned_method`
- `blind_done_where_required`
- `named_exactly_one_gap` (true for a satisfied no-gap PASS because the conditional rule was obeyed)
- `remedy_is_buildable` (true for a satisfied no-gap PASS because no remedy is required)
- `no_banned_reasoning_used`
- `escalation_ladder_used_if_gap_seemed_small`

Any `false` requires a `self_audit_note` explaining why, and the orchestrator treats the
verdict as **provisional** until re-run.

---

## 3. The single biggest gap, and the ledger

The one gap is written into the verdict and is automatically pulled into
`corpus/90-verdicts/GAP-LEDGER.json` (see `SCORING.md` §5). It becomes required reading
for the next wave's builder on that subsystem path.

**A gap may not be closed by the agent that built the fix.** Closure is a critic act: the
next wave's critic on that path re-measures the gap's stated `remedy` acceptance
condition and sets `status: closed` with new artifacts, or `status: open` with a note.

---

## 4. Arbitration checks — mandatory in every verdict

Copied verbatim from `ARBITRATION.md` §3:

> - **AR-1 (Souls leakage):** Did any Morrowind-flavoured mechanic contaminate the fight?
>   Roll-to-hit, dice damage, pausing mid-fight, untelegraphed instant attacks, animation
>   cancels, level-scaled enemies → **automatic fail of the piece**, regardless of score.
> - **AR-2 (Morrowind leakage):** Did any Souls-flavoured convention contaminate the world?
>   Objective markers, bonfire warp, minimal/absent dialogue, procedural loot, soul-currency
>   purchases, item descriptions replacing NPC dialogue as the primary lore vector →
>   **automatic fail of the piece**, regardless of score.

Both checks run on **every** piece, including pieces that look unrelated to combat or to
the world. Leakage is usually found where nobody was looking.

Record each as `{"status": "pass"|"fail"|"not_applicable", "checks": [...], "evidence": [...]}`.
`not_applicable` requires a one-line reason and is itself audited — it is not a free pass.

### 4.1 AR-1 detection procedures (Souls leakage into the fight)

Run all that can be run for this piece. Each has a concrete method and a concrete tell.

| # | Leak | Detection procedure | Tell |
|---|---|---|---|
| A1 | **To-hit roll / miss chance** | From a fixed pose, land 50 scripted identical swings on a stationary dummy with the hitbox overlapping. Diff damage-event count vs swing count. | Any swing with overlapping geometry that produces no damage event. Also: any `Math.random()` in the same trace frame as a hit resolution (search the trace's `rng_calls` field, not the source). |
| A2 | **Dice damage** | 50 identical hits, same weapon, same stats, same target part. Compute stdev of damage. | stdev > 0 without a documented mechanic (crit/part multiplier) declared in a reference item. Damage must be a function, not a draw. |
| A3 | **Pause mid-fight** | Open inventory/menu during `COMBAT` while an enemy is in a windup. Compare enemy `anim_frame` before and after 2 s of menu time. | `anim_frame` unchanged, or world clock frozen. Seam S14. |
| A4 | **Untelegraphed instant attack** | For every enemy attack in the trace, measure frames between `state==COMMIT`/windup start and first `hit_active` frame. | Any attack with windup < the reference item's minimum (default: < 8 frames at 60 Hz) or with no distinguishable windup animation. |
| A5 | **Animation cancel** | Script attack input, then dodge/attack input at frames 2, 5, 10 of the recovery. Check whether the first animation's remaining frames were skipped without a legal cancel window declared in a reference item. | Recovery frames vanish. Committed attacks are not committed. |
| A6 | **Enemy level-scaling** | Run the same encounter at character level 1 and at level 40, same seed. Diff enemy `hp_max`, damage per hit, and soul drop. | Any difference. Seam S9. Zero tolerance. |
| A7 | **Homing / instant turn during attack** | Per-frame `yaw_rate_dps` during `phase ∈ {active, recovery}`. | Non-zero beyond float noise. |
| A8 | **Skill gating the swing** | Compare hit resolution with the governing skill at minimum and maximum, all else equal. | Any change in *whether* a hit lands (scaling of *damage* is legal per seam S3). |
| A9 | **Fatigue driving combat** | Check whether the out-of-fight Fatigue value appears in any in-fight resolution. | Any coupling. Seam S4 requires two separate bars. |
| A10 | **Talking mid-fight** | Attempt to open a topic list while `COMBAT` is active. | A topic list opens. Seam S13. |

### 4.2 AR-2 detection procedures (Morrowind leakage into the world)

| # | Leak | Detection procedure | Tell |
|---|---|---|---|
| B1 | **Objective markers / compass** | Screenshot the HUD in three states: quest active, quest ready-to-hand-in, exploring. Inspect the pixels, not the code. | Any on-screen arrow, pin, waypoint, distance readout, or edge indicator pointing at an objective. Seam S8. |
| B2 | **Bonfire warp** | At a rest point, enumerate every menu option and take them all. | Any option that moves the player to a non-adjacent location. Seam S7. Bonfires are checkpoints, not a network. |
| B3 | **Minimal / absent dialogue** | Sample 10 NPCs at random (seeded). Count topics offered and total words per NPC. | Median topics < the dialogue reference item's floor, or NPCs that only vend/shout. A "…" NPC is a failure, not a placeholder. |
| B4 | **Procedural loot** | Loot the same container/enemy across 20 seeded world resets. Diff contents. | Any variation not authored in a data file. Seam S12. |
| B5 | **Soul-currency purchase** | At every merchant, trainer, transport, and repair NPC, attempt payment. Read the transaction record. | Any price denominated in souls. Seam S15. Souls level you and ONLY level you. |
| B6 | **Item descriptions as the lore vector** | Count words of lore delivered by item descriptions vs by NPC dialogue and books over a fixed 30-minute traversal. | Item text ≥ dialogue+books. Souls tells you through items; we do not. |
| B7 | **No non-combat resolution** | For each quest reachable in the piece, attempt completion without killing anything. | Zero quests resolvable by talk/bribe/sneak/theft/knowledge, where the quest reference item expects one. |
| B8 | **Level-scaled *world*** | Same as A6 but for loot, prices, and NPC hostility. | Any scaling to player level. |
| B9 | **Unkillable NPCs** | Attack a quest-critical NPC. | Essential-NPC invulnerability or a game-over. Expected: death + "thread of prophecy severed" warning + a harder but completable world. Seam S10. |
| B10 | **Death eating world state** | Advance a quest, gain faction rank, drop an item, then die and respawn. Diff journal, faction standing, world flags, dropped item. | Any rollback. Seam S6. |
| B11 | **Silent world** | Walk a settlement for 3 minutes; count distinct rumours heard/available and how many differ from the previous settlement. | Identical rumour set across towns. |
| **B12** | **No exit but death** — the *inverse* leak, added wave 0 (`parley`, gate **B1**), INTENT-AUDIT-01/02 **ID-01** + **ND-04** | Take the first authored instance in this piece of each of **five encounter classes** — (1) ordinary humanoid, (2) faction patrol, (3) animal / mindless, (4) quest-critical NPC, (5) humanoid boss — and for each: enter `COMBAT` (`__HARNESS.aggro()`), then attempt to end the encounter with **`deaths == 0`** using **every** non-violent verb the build offers, in this order — **(a)** parley: hold `interact` on the target, `RI-DLG09` §A; **(b)** flee past `L_hard`, `RI-AI01`; **(c)** calm / paralyse / soul-trap-without-kill, `RI-MAG02`; **(d)** return to `HIDDEN` until every hostile de-aggros, `RI-STL01`; **(e)** bribe / buy-off at the ×1.5 in-combat premium, `RI-CRM02` §3. Record per class: the exits attempted, the exit that succeeded, the frame `COMBAT` ended, and the death count. Then **re-run class (1) after landing a hit first** and verify an exit still exists once you have drawn blood. Finally read `PACIFIST-IN-FIGHT` for this piece's data (`RI-DLG09` §D, step 2). | **Zero of the five classes exits non-violently → AR-2 fail.** So does any one of: **`PACIFIST-IN-FIGHT` < 15%** or **== 0**; any hostile with `speech: true` and no `parley` block (seam **S13**: *"a humanoid faction NPC with no parley path is a defect"*); a `YIELD` state that expires on a timer or that leaves `COMBAT` active after the last hostile has yielded; a class whose only exit is fleeing, when **EXIT-SPREAD > 70%** across the piece. **B12 and A10 are a pair and must be run together**, exactly as B2 and B13 are: **A10** fails a parley built as a browsable topic list, **B12** fails a world that has no parley at all. `ARBITRATION.md` §1: *"Killing is one exit from a fight. A build in which it is the only exit has failed the brief, regardless of how good the combat feels."* |
| **B13** | **Travel that does not exist** — the *inverse* leak, added wave 0 (corpus-audit), INTENT-AUDIT-01 **ID-17** | From three different settlements, board **each** transport modality: pay in gold, ride, and verify (a) you arrived at a **station**, not at an objective, (b) in-world time advanced, (c) the destination was one you had already visited. | **No modality boards → AR-2 fail.** Seam S7 *mandates* the network; it does not merely permit it. Every other travel check in this doctrine tests only for the **absence** of warping, so a build that shipped no transport at all passed all of them. B2 and B13 are a **pair** and must be run together: B2 fails a network that has become a map-pin menu, B13 fails a world that has no network. |

> **AMENDED wave 0 (corpus-audit) — every travel check in the corpus is now two-directional.**
> B2 above ("bonfire warp") is one-directional by construction: it can only fire when travel
> exists. Read alone it rewards a build with no travel at all, which is seam S7 inverted. B13
> is its counterpart. The same pairing is applied in `RI-PRG04`'s S7 scoring axis, `RI-TRV01`
> M1's N-fail/W-fail, and COHERENCE-AGENT T6. See `CORPUS-COHERENCE-01.md` §8.

> **ADDED wave 0 (`parley`, intent-audit gate B1) — B12, and why it was missing.**
> `ARBITRATION.md` §1 and seam **S13** were amended after INTENT-AUDIT-**01** to preserve
> fleeing, yielding, parley, bribery and non-lethal outcomes *during* a fight. **The ruling
> moved and its enforcement did not.** INTENT-AUDIT-**02** found B10, B11 and B13 in this table
> and no B12, so *"a build where every fight ends in a corpse violates §1 and nothing detects
> it"* — the charter's **stalled correction** pattern occurring inside the drift it was named
> for. B12 closes it.
>
> The symmetry is the point and it is worth stating plainly. **A10** stops the world leaking
> *into* the fight — you may not open a topic list mid-swing. Until now **nothing stopped the
> fight from eating the world** — every AR-2 check above tests for a Souls convention that is
> *present* and wrong, none tested for a Morrowind verb that is *absent*. That is the same
> one-directional error B13 was written to fix one seam over, and it is why B12 is written
> two-directionally: it fails a build with no non-violent exit **and** (through its pairing with
> A10) a build whose non-violent exit is a menu.
>
> Instruments: `RI-DLG09` (the parley's input, frames, gate ladder, `YIELD` state and the
> `PACIFIST-IN-FIGHT` floor), `RI-CRM02` §3 (the price of striking a yielded target),
> `RI-CRM01` §4 (the guard surrender), `RI-AI01` (leash), `RI-MAG02` (S19 utility effects),
> `RI-STL01` (stealth break). Subsystem paths: `combat.encounter.parley`,
> `combat.encounter.exit`.

---

## 5. Blind comparison protocol

For every reference item with `blind_pair: yes`:

1. **Build the pack.** Two artifacts of the same kind, same format, same dimensions, same
   duration, **stripped of every identifying mark**: no filenames revealing origin, no
   captions, no headers, no watermarks, no UI chrome unique to one side, no metadata.
   Name them `A` and `B` with the assignment chosen by a recorded coin flip (record the
   seed or the flip in `blind_comparisons[].assignment_seed`).
   - Screenshots: identical resolution, aspect, and downscale; strip EXIF.
   - Traces: identical field order and column names; strip source labels.
   - Text: identical formatting, both trimmed to the same word count band.
2. **Write the discriminating question first**, before looking. It comes from the item's
   `## Comparison method`. Example: "Which series looks like an enemy negotiating
   distance rather than closing to contact?"
3. **Answer it with reasons, before reveal.** Record `blind_pick` and
   `blind_rationale`. The rationale must cite specific observed features, not vibes.
4. **Reveal.** Record `reveal` (which of A/B was ours).
5. If ours was picked → §2.5 re-run.

If you cannot construct a fair blind pack (e.g. our build has a visibly different UI that
cannot be cropped out), record `blind_status: "not_possible"` **with the reason** and run
the item's non-blind method instead. Repeated `not_possible` on the same item is a corpus
defect: file an extension proposing a comparable artifact form.

---

## 6. The fidelity / art-direction bifurcation check

From `ARBITRATION.md` §4. **Before citing any visual reference, declare which axis you
are judging.** Put it in the verdict's `bifurcation` field:

```json
"bifurcation": {
  "axis": "fidelity" | "art-direction" | "both-separately" | "not-visual",
  "declared_before_citation": true,
  "fidelity_refs": ["RI-VIS…"],
  "art_refs": ["RI-VIS…"]
}
```

Rules, all hard:

- **`axis: "fidelity"`** may cite only `side: modern-fidelity` items and modern
  screenshots. **Citing a 2002 Morrowind screenshot voids the verdict.**
- **`axis: "art-direction"`** may cite only `side: morrowind` / strangeness items.
  **Citing a modern AAA screenshot voids the verdict.**
- **`axis: "both-separately"`** requires two disjoint score sets, two disjoint reference
  lists, and two separate gaps considered — of which you still promote only one to
  `biggest_gap`. The two sets may not share a reference item.
- "It looks like Morrowind" is **never** a defence on the fidelity axis. Neither is
  "it's higher fidelity than Morrowind" — that comparison is meaningless; the fidelity
  bar is current-generation.
- Art direction is judged on **decisions** (palette, silhouette, weirdness, composition);
  fidelity is judged on **rendering** (light transport, material response, resolution,
  aliasing, animation quality). If you find yourself scoring texture resolution under
  art direction, you have crossed the line.

---

## 7. Escalation — when you genuinely cannot judge

Per `CORPUS-CONTRACT.md` §5: **never skip, never guess.** In order:

1. **Method gap** (the item exists but its method won't run here): try the closest
   executable variant, record exactly what you changed and why in `method_deviations`,
   and score only what you actually measured. Do not extrapolate the rest.
2. **Corpus hole** (no item judges this subsystem path): STOP judging that dimension.
   Write a new reference item under the correct area following CORPUS-CONTRACT §2 —
   all six sections, honest `provenance` (`constructed` is fine and binding), a
   `## Comparison method` a fresh agent can run, and a `## How we lose` list. Add its id
   to `corpus_extended` in the verdict. Then regenerate the index
   (`node tools/corpus-index.mjs`). Then judge with it if time allows; otherwise mark the
   dimension `deferred_to_next_wave` with the new item named.
3. **Harness gap** (you cannot get the artifact at all): file the missing harness as a
   method item under `corpus/80-methods/`, mark the affected checks `unmeasurable`, and
   score them **0** — fail-closed, never "unknown", never omitted. A dimension nobody can
   measure is a dimension we do not have.
4. **Doctrine gap** (ARBITRATION doesn't resolve a genuine collision): do not invent a
   ruling. Record it in `arbitration_questions` with both sides stated, score the piece on
   everything else, and let the dimension owner amend ARBITRATION.md §2 by append.

Corpus growth is a success signal. A wave in which no critic extended the corpus is
suspicious.

---

## 8. Conflict of interest

- **A critic must not have written, edited, or reviewed-for-merge the code, data, or text
  it judges.** One builder, one separate critic, fresh context — always.
- The critic receives: the piece id and subsystem path, the reference items, the harness
  commands, the repo. It does **not** receive: the builder's summary, the builder's
  rationale, the PR description, the commit messages describing intent, or any prior
  verdict on that piece **until after** it has recorded its blind picks and its raw
  measurements. Read the gap ledger entry for the path **only after** raw measurement, to
  check closure — and record that ordering in `notes`.
- If a critic recognises the work as its own, it must abort and report
  `status: "recused"` with `reason: "conflict_of_interest"`. Producing a verdict on your
  own work is a corpus integrity failure, not a shortcut.
- A critic may not negotiate with a builder. There is no appeal conversation. The verdict
  is a document; the next builder answers it with work.
- The coherence agent (`COHERENCE-AGENT.md`) is not a critic and does not overrule
  verdicts; it fixes coherence only.

---

## 9. Verdict lifecycle

```
spawn critic (fresh context)
  → read doctrine + reference items
  → declare bifurcation
  → run harness, capture artifacts
  → per-item methods + blind packs
  → AR-1 / AR-2
  → score (SCORING.md)
  → exactly one gap + remedy
  → self-audit
  → emit corpus/90-verdicts/<wave>/<piece-id>.json  (VERDICT-SCHEMA.md)
  → node tools/gap-ledger.mjs      (ledger regenerated from verdicts)
```

**PASS requires all of:** AR-1 pass, AR-2 pass, no hard fail in any reference item's own
`## Scoring`, every assigned item measured (or fail-closed at 0), overall score at or
above the piece's `pass_threshold` (default 6.0, raised per wave by the orchestrator),
and a named gap with a buildable remedy. Everything else is FAIL.

A PASS is not "done". A PASS with a named gap is the normal, healthy outcome.


## Addendum — the 10/10 requirement (user direction, wave 1)

`SCORING.md` §0 sets the project's terminal condition at **10 on every item**. Two consequences
bind every critic from now on:

1. **Any item you score below 10 must carry `why_not_ten`, `path_to_ten` and `ten_by_wave`.**
   A sub-10 score without a concrete, buildable path to 10 is **VOID**, on the same footing as a
   verdict with no artifacts. "It is a wave-1 skeleton" is not a `why_not_ten`; name the
   measurement that falls short and what would close it.
2. **A 10 still requires evidence of parity with or superiority to the reference.** The bar rising
   does not license generosity — inflating a 7 to a 10 to satisfy the target is the single most
   damaging thing a critic can do here, because it converts a real gap into an invisible one. If
   the work is a 7, score it 7 and write the path.

If an item cannot reach 10 because **the corpus is broken** — an unmeasurable metric, a missing
constant, a cap left over from when we had no reference images — that is a corpus bug. File it as
`corpus_extended`, do not absorb it into the piece's score.
