# W1-25 — the zero-event divergence, worked to a conclusion

Task `w1-25-divergence-20260814`. Branch `codex/wave1-build-experiment`.
Opened because `reports/ci-triage/EVIDENCE-RECOVERY-20260814.md` §2 found that W1-25-r1's central
evidence no longer reproduces, and correctly declined to decide what that meant.

> **The conclusion, in one line.** The verdict's number was real, its diagnosis was right, and
> nothing about it is void. The frame gap is not a divergence at all — it is the sample the
> recovery agent deliberately took. The event gap is the world, not the instrument: the same
> driver on the old game emits zero and on today's game emits 113, and the old instrument could
> and did fire when something happened in front of it. What has moved since is worth less than
> the count suggests, and §5 is about that.

---

## 0. What was asked, and the order it had to be asked in

Three questions, and the second one is the only one that could have voided the round.

1. **The frames.** 36,000 against 3,600 is a 10× gap and it had to be cleared first, because a
   driver whose frame budget had changed would put every other number in doubt.
2. **Could the original run have produced a non-zero result at all?** "Zero events" is the shape
   of an inert measurement. If the old tree's event channel could not fire, the verdict's central
   claim was never evidence and the round's score is void regardless of today's number.
3. **Only then**: why 113 now.

---

## 1. The frames: not a divergence. Arithmetic, from both manifests

`tools/experience/session-run.mjs:323` — `const totalFrames = Math.round(minutes * 60 * 60);`

| manifest | `minutes_requested` | `frames_stepped` | `minutes_simulated` |
|---|---|---|---|
| `reports/sessions/exp-w1-opening/session.json` (the pinned artifact) | **10** | **36,000** | 10 |
| `reports/sessions/verdict-evidence-20260814-regen-sample/session.json` | **1** | **3,600** | 1 |

10 × 60 s × 60 Hz = 36,000. 1 × 60 × 60 = 3,600. Both manifests record the requested minutes and
both agree with the formula. The recovery agent's own pin says so in `why_a_sample` — *"one
simulated minute rather than ten"* — and its table labels the rows `(10 sim-min)` and `(1 sim-min)`.

**The frame budget has not changed, the seed has not stopped determining the world, and the 10×
explains nothing about the events.** It was the deliberate sample size. Cleared, and it stays
cleared: every run below is at `--minutes 1`, so every count in this report is directly comparable
to the recovery agent's 113.

*This possibility is eliminated, not merely thought unlikely.* Had the frame budget drifted, the
two manifests would disagree with the formula. They do not.

---

## 2. Could the original run have produced a non-zero result at all? **Yes — demonstrated**

This is the question that decides whether the verdict keeps its evidence.

### 2a. The channel existed and was written on every frame

Streaming the pinned 79 MiB trace: the first 2,000 records sampled all carry an `events` key, all
empty, and the record shape is `{f, t_ms, input, player, civilians, camera, enemies, events, rng,
env}`. `records_missing_events_key: 0`. So this is not a trace written before the events channel
existed — the field is present and the value is genuinely `[]`.

That is necessary and *not* sufficient: a field that is always `[]` is exactly what an unwired bus
looks like. So:

### 2b. The positive control — the old tree, driven

The old tree was reconstructed with `git archive 0756be2 | tar -x` into an empty directory
(`0756be2`, 2026-08-07 08:12 — the last commit before the pinned artifact's 08:15 mtime), and never
measured against this populated working tree.

Same tree. Same seed 1337. Same `first-hour` profile. Same brief. The **only** change is that a
15-op input script walks, turns, strafes and swings instead of `--drive none`:

| arm | drive | frames | events | kinds |
|---|---|---|---|---|
| **A** — old tree, undriven | `none` | 3,600 | **0** | 0 |
| **A2** — old tree, driven | `script:` 15 ops | 3,600 | **4** | 4 — `first_input`, `first_control`, `ACTION_START`, `attack_start` |

**The old instrument could fire, and did, the moment something happened in front of it.**

This is the control the method asks for, and it is deliberately not the trivial one. The trivial
positive control would have been to call `bus.emit` from the page, which proves only that a
function exists. A2 is the *plausible* wrong answer: an ordinary player doing ordinary things
through the ordinary input path, on the same tree, in the same profile, at the same seed. Had that
produced zero as well, the pinned 0 would have been inert and this round would be reporting a void
score instead of a conclusion.

**Verdict on question 2: W1-25-r1's "36,000 frames, zero events" was a real measurement of a still
world. Its evidence stands. The round is not void.**

Corroborating from the other side: `git grep -c "bus.emit(" 0756be2 -- game/src` counts **96 emit
sites across 12 files** at that commit (124 across 16 at HEAD). The bus was not a stub.

---

## 3. Why 113 now: a 2×2 that puts the whole effect in the world

Four runs, all `--minutes 1 --seed 1337 --profile first-hour --drive none`, crossing the driver
against the game. The two mixed trees were built by extracting `tools/` from one commit and
`game/` from the other into the same directory.

| | **old game** (`0756be2`) | **HEAD game** |
|---|---|---|
| **old driver** (`0756be2`) | **A — 0 events** | **C — 113 events, 5 kinds** |
| **HEAD driver** | **B — 0 events** | **D — 113 events, 5 kinds** |

Read down the columns: the game decides. Read across the rows: the driver contributes nothing.
C and D are not merely both non-zero, they are **identical to the event**:

```
weather_change 1 · spawn 56 · settlement_enter 1 · npc_schedule 28 · npc_presence 27
```

— the same 113, the same 5 kinds, the same per-kind counts, and the same as the recovery agent's
independently-taken number. A and B are likewise identically zero. The effect is total, it is
deterministic under the seed, and **100% of it is attributable to `game/`.**

Raw counts: `reports/experience/w1-25-r2-divergence/session-2x2.json`.

### The mechanism, dated

Four of the five kinds did not exist as emitters when the artifact was recorded. `git log -S` on
each emit string, first appearance, against the artifact's 2026-08-07 08:15:

| kind | emitter | first appears | relative to the run |
|---|---|---|---|
| `npc_schedule` | `game/src/sim/npc.js:252` | `23fd1dc` 08-07 **13:53** | +5h41m |
| `npc_presence` | `game/src/sim/npc.js:285` | `23fd1dc` 08-07 **13:53** | +5h41m |
| `settlement_enter` | `game/src/sim/settlement.js:167` | `b7d249a` 08-07 **13:56** | +5h44m |
| `weather_change` | `game/src/sim/environment.js:272` | `38efe37` 08-07 **16:37** | +8h25m |
| `spawn` | `game/src/engine.js:2234,2283` | `b88e439` 08-06 21:16 | **−11h — already existed** |

`spawn` is the interesting row, because it is the one that was already there. It fires 56 times
today and zero times then, and the reason is visible in §4's intact arm: **there are 56 NPCs in the
world now.** `EventBus.clear()` runs per frame and `traceStart` is called after world load, so a
spawn that happens during boot is never in any trace record; a spawn that happens because the world
streams a person in during the run is. The old world had nobody to stream.

**So three of the four candidates the task named are ruled out and the fourth is confirmed.**
Not the frame budget (§1). Not the seed (§1, §3 — C and D agree to the event at the same seed).
Not a broken original run (§2). It is *"events that were previously never fired are now firing
because the systems that emit them were built in the interim"*, and the interim is five to eight
hours on the afternoon of the same day.

---

## 4. CONSUMPTION on the state those events mirror (`RI-MTH07`)

An event count that rose is not a world that changed. `sim/camera.js` computes a character-opacity
fade every frame, traces it, writes it to disk, and nothing in the renderer reads it — and every
static check called that working. 55 of the 113 new events are `npc_schedule`/`npc_presence`, so the
question is whether the state they mirror is read by anything a player meets.

`tools/experience/npc-presence-consumption.mjs`, written for this round.
Artifact: `reports/experience/w1-25-r2-divergence/npc-presence-consumption.json`.

- **Model** — `sim.npcs[].present` / `.visible`, written by `stepSchedule()` in
  `game/src/sim/npc.js`, on the same line that emits `npc_presence`.
- **Consumers, by path** — `game/src/render/renderer.js:548` (`mesh.visible = n.visible !== false`);
  `game/src/sim/world-collision.js:121` (`if (!n.present) continue`);
  `game/src/sim/stealth/system.js:949` (`if (!n.present) continue`).

**Two perturbations, and the difference between them is the finding.**

The obvious one — write `present`/`visible` false directly — is **weak, and it is reported rather
than quietly dropped.** `stepSchedule()` recomputes `present` from `n.at === sim.env.interior` at
the end of *every frame*, so a direct write is undone by its own writer within one step and the
census moves by exactly 1 (27 → 26 drawn). Directionally right; far too small to rest a claim on.
A round that published that number as its consumption evidence would have been overstating it.

The one the claim rests on perturbs **`n.at`, the input the schedule reads.** `at` is rewritten only
when the schedule *slot* changes (`if (i !== n._slot)`), so the perturbation is durable — and it is
faithful, because the world's own code then computes the absence, emits its own `npc_presence`, and
each consumer reads a value the world produced rather than one the probe forced in behind it.
`stepNPCWorldCollision` runs at `sim/step.js:185`, immediately after `stepNPCs` at 182.

**The null arm is generic, not empty.** An empty NPC list would collapse every observable here by
accident and prove nothing — precisely the mistake that let a recent landform instrument report 71%
coverage of a world containing none of the thing it measured. So the null arm restores `at` and
instead perturbs `activity`: written by the same slot block, on the same objects, at the same
moment, of the same shape, through the same route. Every observable must return to its intact value.

### The result — 6/6, `CONSUMPTION: DEMONSTRATED`

| arm | what it does | drawn NPC meshes | collidable | perceivers |
|---|---|---|---|---|
| **INTACT** | nothing | 27 → **27** | 27 → 27 | 27 |
| **ONE-SHOT(present)** | write `present`/`visible` false | 27 → **26** | 27 → 26 | 26 |
| **VIA-AT(broken)** | put every scheduled cell somewhere the player is not | 26 → **0** | 26 → **0** | **0** |
| **VIA-AT(null: activity)** | restore `at`, perturb `activity` instead | 0 → **26** | 0 → **26** | **26** |

```
one_shot_drawn_delta 1  ·  via_at_drawn_delta 26  ·  via_at_null_drawn_delta 0
```

- **C0** the intact arm ranged over **56 NPCs and 56 meshes** — a zero here would have made every
  other check on the page vacuous, which is the first thing to establish and the easiest to skip.
- **C2** the renderer stops drawing every one of them. It still *holds* 56 mesh objects and draws
  none of them, so this is the visibility flag being read rather than the scene being torn down.
- **C3** collision and perception both go to zero, **and the world computed that itself** from the
  perturbed input rather than having it forced in behind them.
- **C4** the null arm returns every observable to exactly its pre-break value. **Effect size 0.**
- **C5** the null perturbation is not a no-op — its string is on the live objects.

**Conclusion: the state `npc_presence` mirrors is genuinely consumed** by the renderer, by collision
and by perception. The 55 new schedule/presence events per simulated minute are not the
`sim/camera.js` failure — they track something a player would actually meet.

**Two things I got wrong, both recorded rather than tidied away.**

1. **The obvious perturbation was nearly inert and I nearly published it.** Writing `present`
   directly moved the census by **1**. If that had been the round's consumption evidence it would
   have been a real claim resting on a 3.7% effect, and the honest reading of that arm is "the
   probe is fighting the writer", not "the consumer is weak". It is kept in the tool as `C1`, with
   its own explanation, because the gap between 1 and 26 *is* the lesson.
2. **The null arm's first version compared against the wrong baseline** and reported FAIL: 26
   against INTACT's 27. That was a defect in the check, not in the world — the ONE-SHOT arm leaves
   one person absent for good, because their schedule slot does not turn over inside the arm so
   `at` is never rewritten. The control for an arm is the arm that ran before it, and the check now
   says so in a comment next to the fix. Both runs are consistent; only the comparison changed.

---

## 5. Judging the piece as it stands now

The plan (`orchestration/plans/W1-25.md`) is the current-state bar. Measured at HEAD today.

### 5a. The canonical artifacts are still fed by the dead trace

This is the divergence's real consequence and it has the shortest path to a fix. Round 2 did
substantial live work — but it wrote to new paths and **never replaced the canonical ones**, which
are the paths the tools document and a scorer would read.

| canonical artifact | dated | input | what it says |
|---|---|---|---|
| `reports/experience/w1/anecdote-trace.json` | — | `reports/sessions/exp-w1-opening/trace.jsonl` | `frames 36000, event_count 0`, every metric 0 |
| `reports/experience/w1/event-histogram.json` | 2026-08-08 | the same trace | `IDLE 36000`, `unclassified_fraction 1`, `voids_the_histogram true` |
| `reports/composition/w1/matrix.json` | 2026-08-08 | never ran | `ran: false`, `demonstrated_crossings: 0`, **both hard fails true** |

`matrix.json` is the sharpest case. `tools/composition/matrix-probe.mjs:494` documents and defaults
to `reports/composition/w1/matrix.json`. That file still records the 2026-08-08 contention refusal.
But `reports/composition/w1-25-persistent-builder/matrix-live.json`, written 2026-08-11 by the same
tool under an explicit `--out`, records **`ran: true`, 12 demonstrated crossings, 12 live cells,
5 W→F and 7 F→W, all four W1 floor rows met, both hard fails false.**

**Two artifacts of the same tool disagree by the whole width of the item's hard fail.** Plan §3.B is
explicit that *"discrepancies are errors, not majority votes."* This one is not a genuine
disagreement, though — it is a stale default path. The 12 look real on inspection: the probes
perturb *source-side* through ordinary verbs (`commitCrime` plus a witness, `equipItem`,
`killEntity`) and read a *target-side* observable back out of the running engine, which is the A/B
the item asks for rather than a harness flag set against itself.

**Ruling (reversible): the canonical path is the one that counts, and it is stale rather than
right.** The remedy is to re-run `matrix-probe.mjs` to its documented default and let the number
stand or fall on that run — not to copy the side artifact over it. *Reversal:* the side artifact is
untouched and remains the record of the 08-11 run. *Falsifier:* a re-run to the canonical path that
does **not** reproduce 12 would mean the 08-11 run was conditioned on something its manifest does
not capture — the same shape as the divergence this round was opened to settle — and it would then
be that run, not this ruling, that needs explaining.

### 5b. RI-EXP02 — the fixture is no longer the blocker, and the reason has changed

W1-25-r1 §E diagnosed the zero as the fixture: *"a ten-minute session that never enters combat,
opens dialogue, writes a journal entry, takes anything or dies."* That diagnosis was correct, and
round 2 acted on both of its remedies. The result is worth recording precisely:

| fixture | frames | events | candidate moments | **tellable** | proper nouns |
|---|---|---|---|---|---|
| the old still session | 36,000 | 0 | 0 | 0 | 0 |
| `w1-25-r2-active` | 10,800 | **121,085** | 62 | **0** | **0** |
| W1-09 `RI-CMB07` exemplar F3 | 8,945 | 530 | 7 | **0** | **0** |

The event count rose by four orders of magnitude and `verified_anecdotes_per_hour` did not move off
zero. **The blocker has moved from the fixture to the naming** — which is exactly the finding r1
predicted the exemplar would produce (*"it will score near zero on A2 and A4 because it is an
arena — and that is the finding RI-EXP02 wants"*).

**And I checked that this zero can fire, because that is the whole lesson of this round.**
`node tools/experience/anecdote-trace.mjs --self-test` passes 5/5 including a `rich` case returning
`tellable=14, shapes=3, nouns=18`. The A2 proper-noun test is not inert.

**But the 121,085 is not richness, and this is a new finding.** Its histogram:

```
enemy_state 40,323 · search_start 40,320 · detect 20,158 · search_end 20,156
… then a cliff: spawn 55 · npc_schedule 30 · npc_presence 27 · souls_awarded 4 …
```

80,476 of 121,085 events are one enemy oscillating between `search_start` and `search_end` — about
3.7 search starts *per frame* over 10,800 frames. That is an AI thrash defect, owned by W1-12 and
not by W1-25, but it matters here twice: it inflates any event-count-based claim about this build,
and it makes RI-EXP03's class histogram over that trace 99.9% one oscillation. A piece whose job is
to *measure* experience should be the one that names it, and the number worth publishing is not
"121,085 events" but "62 candidate moments, 0 tellable".

### 5c. RI-EXP03 — `unclassified_fraction: 1` is live, not a stale artifact

The canonical histogram's void could have been an artifact of its dead input, so I re-measured the
cause directly at HEAD. All ten `A-EXP2` event names are **absent from the closed vocabulary in
`game/src/sim/events.js` and emitted nowhere in `game/src/`**:

`book_read`, `barter_open`, `barter_close`, `menu_open`, `menu_close`, `craft`, `parley`,
`crime_witnessed`, `travel_node`, `first_visit` — 0/10 in the vocabulary, 0/10 emitted.

So READ, TRADE, CRAFT, MENU and TRAVEL_NODE remain unmeasurable and collapse into IDLE by the item's
own fail-closed rule. **RI-EXP03's hard fail 7 stands on a current measurement**, independent of the
stale trace. This is a not-yet-built dependency on the UI and trade pieces rather than a W1-25
defect — but the item cannot pass while it holds.

### 5d. RI-EXP06 — the live probes now run, and 1 of 15 passes

`reports/experience/w1-25-persistent-builder/permissiveness-live-report.json` is a real advance on
r1's static checks: it has the eight-column live shape plan §3.E asks for (`baseline_open`,
`executed`, `player_facing_refusal`, `real_consumer_execution`, `restored`,
`no_direct_target_mutation`). The numbers:

```
declared 15 · passed 1 (B-01 only) · probes_run_fraction 0.067 · pass false · chain_status NOT_RUN
```

The plan requires **100%** of live entries plus the playthrough chain cross-check. 6.7% and
`NOT_RUN`. Hard fail 6 stands. The honesty is genuine — the file reports its own 1/15 rather than
rounding up — and it is the same self-reporting quality r1 credited.

### 5e. A live defect this round found by accident, in the tool's own logs

`session-run.mjs` at HEAD prints, on every boot of the `first-hour` profile:

```
profile first-hour: 204 of 448 harness methods refused … 77 UNCLASSIFIED and refused fail-closed
```

The same line on the old game reads `106 of 316 … classification covers the whole surface`.
77 methods — `castSpellAt`, `enterInterior`, `equipItem`, `commitCrime`, `grantInventoryItem`,
`setPermissivenessClosure` among them — have arrived since without capability declarations.

The plan's builder allocation is explicit: *"A session observed with unclassified capability-bearing
methods cannot satisfy the builder smoke."* Every session recorded at HEAD, including the one that
produced the 113 events in §3, is observed with 77. **The builder smoke cannot be satisfied today**,
and nothing was going red about it — the tool says so in a line nobody reads.

---

## 6. What this changes about W1-25-r1

- **Its evidence is not withdrawn.** §2 demonstrates the old instrument could fire. The 0 was real.
- **Its diagnosis was right** and has since been acted on: r1 §E blamed the fixture and named the
  exemplar as the cheapest real number. Both were done, and both returned 0 tellable (§5b).
- **One finding is superseded by work, not by error**: *"zero seam crossings demonstrated"* was true
  at `fdef3d6`, and a live run on 08-11 demonstrates 12 — but the canonical artifact a scorer reads
  still says 0 (§5a).
- **Its generalisation is still false, and now for a second reason.** r1 already conceded that
  *"`verified_anecdotes_per_hour` is 0 by construction on every trace this project has ever
  recorded"* was false as written. It is now false twice over: traces exist carrying 121,085 events.
  The true statement is narrower and more useful — *no trace on this tree yet carries a consequence
  with a proper noun attached to it.*
- **Nothing here reopens the 2.0/10.** Three of four items still hold a live hard fail measured
  today (§5b, §5c, §5d), and the fourth turns on a stale file rather than on a missing run.

**No old artifact was rewritten.** `trace.jsonl.pin.json` still records 36,000/0 with the recovery
agent's divergence note inside it, which is what the verdict read and should stay that way. This
round's runs are new artifacts under `reports/experience/w1-25-r2-divergence/`.

---

## 7. What I could not do

- **No new W1-25 verdict is filed.** This round answers the divergence and re-measures the current
  state; it does not carry the matched ≥90-minute A/B sessions, the isolated 500-word baton chain,
  the blind pair or the complete permissiveness population that plan §3.C/§3.D make critic-owned.
  Those remain unrun, so `RI-EXP02`'s `verified_anecdotes_per_hour` is still *unmeasured* rather
  than measured-and-zero.
- **I did not re-run `matrix-probe.mjs` to its canonical path.** It is the highest-value remaining
  action (§5a) and needs a browser window this box did not have; the ruling names what it would
  settle and what would overturn it.
- **I did not fix the 77 unclassified harness methods** (§5e). They belong to the pieces that
  shipped them, and classifying another piece's capability is a judgement about what that method is
  allowed to do.
- **I did not chase the `search_start`/`search_end` thrash** (§5b). It is W1-12's, and it is named
  here so it has somewhere to be picked up.
- **A rebase by a concurrent agent destroyed this report, the status file, the probe and the blog
  line mid-round**, roughly an hour in; the gitignored JSON artifacts survived because they were
  never in the index. All were rewritten from working notes and banked immediately. Nothing was
  measured twice or reported from memory: every number here is read back out of an artifact on
  disk.
- **Contention.** `tools/contention.mjs` reported 3–5 browser instances and 4.6–6.5 load per core
  against a 4.0 per-core ceiling throughout, i.e. over the per-core ceiling and at or under the
  6-instance one. I proceeded, one browser at a time, and say so here as the rule requires. The
  justification is that every number in §1–§3 is a **deterministic event count at a fixed seed**,
  not a timing measurement: C and D agreeing to the event across two different trees under
  different load is itself the evidence that contention did not touch these figures. Any wall-clock
  number taken today would be worthless, and none is reported. The one cost it did impose was real
  — the first design of §4's probe re-applied its perturbation before every step and could not
  finish a 30-frame loop inside a 30-minute budget under load 6.5, which is what sent me looking
  for the cheaper and better perturbation it now uses.
- **Frames are SwiftShader.** No screenshot is offered in support of any claim here, because every
  claim is a count or a state read rather than something to look at. §4's renderer check reads the
  scene graph's own visibility flags rather than pixels, for the same reason.
