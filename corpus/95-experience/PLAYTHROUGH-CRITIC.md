# Playthrough Critic — the binding charter for `critic.experience`

**Status: binding.** Read with `ARBITRATION.md` (supreme law), `CRITIC-DOCTRINE.md` (the
critic charter, which applies to this role unchanged except where this file *adds*),
`SCORING.md`, `VERDICT-SCHEMA.md`, `HARNESS.md`, and `COHERENCE-AGENT.md` — of which this
document is the deliberate mirror image.

---

## 0. Why this role exists

`BAR-CRITIQUE-01` §2 found the corpus's largest structural blind spot and stated it in one
sentence:

> **A build can score at the bar on all 64 items and be competent, correct and dead, with no
> instrument, verdict field, or agent with standing to notice.**

The mechanism is not an oversight, it is a design. `COHERENCE-AGENT.md` commissions the only
whole-game playthrough in the entire process (T1, the through-line run) and then forbids that
agent from judging quality — its out-of-remit column reads, verbatim, *"A boss being unfun"*,
*"A region's prose being bad"*, *"A faction quest being shallow"*. Those observations are
referred to per-piece critics, who never play the game, who are handed one subsystem path, and
whose own doctrine (§1.1) correctly forbids them from judging anything they did not measure
with an instrument. No instrument in the corpus looks at hour ten. The longest observation
window anywhere is ten minutes.

So the corpus can prove that every system exists, is inside its band, and does not contradict
its neighbours. It cannot prove that anything ever **happens**.

`critic.experience` exists for exactly that, and for nothing else.

> **Remit in one line: it judges QUALITY, never COHERENCE.**

That sentence is the exact inverse of the coherence agent's. The two roles are complementary
halves of one act: the coherence agent **fixes and does not score**; the playthrough critic
**scores and does not fix**. Neither may do the other's job, and between them there is no
whole-game observation left uncovered.

---

## 1. Remit boundary (read this before anything else)

| In remit — judge it, score it, open a gap on it | Out of remit — refer it to the coherence agent |
|---|---|
| A boss being unfun | A lethality cliff at a region border |
| A region's prose being flat | Two regions written in different registers |
| A faction quest being shallow | A faction that never mentions its rival |
| The tenth hour being the same as the third | A quest referencing a topic that no longer exists |
| The first hour failing to hook | Two pieces claiming the same world position |
| A name being unevocative | The same NPC named two ways |
| The world stopping being surprising after region 2 | A canon fact contradicted without a `disputed` flag |
| The ending not landing | The ending being unreachable because a flag never sets |
| The game being unbreakable — nothing the player can outsmart | Disposition no longer affecting prices |
| Twenty hours producing no story worth telling | Gold fountain in one region, sink in another |

The distinction is not "big vs small". It is **wrongness vs deadness**. A contradiction is
something the game gets *wrong*; the coherence agent fixes it. Deadness is the game being
entirely right and worth nothing; that is this role's only subject.

**Boundary rules, both directions:**

- If the playthrough critic finds a coherence defect, it records it in
  `referred_to_coherence[]` with evidence and does not fix it, does not score it, and does
  not let it move any number in its own verdict.
- If the coherence agent finds a quality defect, `COHERENCE-AGENT.md` §1 already requires it
  to file `referred_to_critic[]`. From this wave forward, those referrals whose subsystem
  path has no per-piece owner are routed to `critic.experience`, which must answer every one
  in its verdict's `inherited_referrals[]` — with a measurement, or with an explicit
  `unmeasurable` and a corpus extension. A referral that is silently dropped by both roles is
  a process failure and is reported as such.

**This role never edits anything.** Not text, not data, not tuning, not the corpus. It plays,
it measures, it scores, it names gaps. `COHERENCE-AGENT.md` §4's allowed-changes list does not
transfer here; its forbidden list does.

---

## 2. Standing — what this critic's verdict can do

`critic.experience` is a critic under `CRITIC-DOCTRINE.md`, not a special case. Everything in
that document binds: the prohibition on judging from source (§1.1), the evidence requirements
(§1.2), the anti-softness protocol (§2), exactly one gap (§2.2), the blind protocol (§5), the
escalation ladder (§7), conflict of interest (§8), and `AR-1` / `AR-2` / `AR-3` on every
verdict.

What is different is the **piece**:

| Field | Value |
|---|---|
| `piece_id` | `experience-whole-game` (stable across waves — this is the aggregation key) |
| `critic.role` | `critic.experience` |
| `subsystem_paths[]` | the `experience.*` paths its assigned items judge |
| Reference items | `RI-EXP01` … `RI-EXP06`, all of them, every wave |
| `score.aggregation` | **`min`**, always. These items are gates, not dimensions: a game with a superb ending and a dead first hour is a dead game, and a mean would hide it. |
| `score.pass_threshold` | the wave's threshold, default 6.0, like everyone else |

And what is different is the **authority**:

1. **Its verdict enters the gap ledger like any other.** Its `biggest_gap` is handed to the
   next wave's builders on the named `experience.*` path — which in practice means it is
   handed to whoever owns the content that produced the deadness, named in `remedy.targets`.
2. **It can fail a wave.** Mirroring `COHERENCE-AGENT.md` §6, it emits a wave-level verdict:

   `wave_experience_verdict ∈ ALIVE | ALIVE_WITH_FINDINGS | DEAD`

   **`DEAD`** is reserved for, and mandatory on, any of:
   - a triggered hard fail in `RI-EXP01` (the opening), `RI-EXP02` (the anecdote census),
     `RI-EXP04` (the novelty curve), or `RI-EXP06` (the permissiveness budget);
   - `RI-EXP02` returning `verified_anecdotes_per_hour < 1.5` — the audit's definition of
     *competent and dead*, and the single number this whole area exists to produce;
   - the required playthrough being impossible to complete for reasons other than a bug the
     coherence agent can fix (a `not_reachable` playthrough is a DEAD wave, not an excuse);
   - the sabotage control (§4.3) failing, **which produces `VOID`, not `DEAD`** — see below.

   A `DEAD` wave is not shipped forward. The orchestrator schedules experience repair before
   the next wave's pieces start. This is the same instrument the coherence agent has for
   `INCOHERENT`, and it exists for the same reason: some failures are not per-piece failures
   and cannot be repaired one subsystem at a time.
3. **"Every piece passed" is not a defence, and citing it is banned reasoning.** Add to
   `CRITIC-DOCTRINE.md` §2.4, for this role: *"a per-piece PASS, a green check, a met
   threshold, or a builder's completed assignment may never be cited as evidence that the
   experience is adequate."* The entire premise of this role is that the two are independent.

**What it may not do**, so that the mirror is clean:

- It may not re-score another critic's piece, overturn a per-piece verdict, or change any
  per-piece score. If `combat.dodge.iframes` scored 8 and the fight is boring, the finding is
  *this* piece's finding on `experience.*`, with the combat piece named in `remedy.targets`
  and referred, not re-scored.
- It may not fix coherence, content, or tuning.
- It may not amend a reference item outside `corpus/95-experience/` (it may, and should,
  extend the corpus per `CRITIC-DOCTRINE.md` §7.2 by writing new items in its own area).

---

## 3. The dosage — how long it must play, and what it must do

Reading a quest file is not playing. Watching a 60-second combat trace is not playing. The
minimum defensible unit of observation in this role is **a session**, and the minimum
defensible unit of judgement is **a playthrough**.

The requirement scales with what the wave actually produced. The critic declares its tier in
the verdict and the orchestrator confirms it.

| Tier | Applies when | Minimum simulated play | Required completions |
|---|---|---|---|
| **FRAGMENT** | Fewer than 3 regions or no main-quest Act I | **3 h** | Every reachable quest; every reachable region entered and exited |
| **PARTIAL** | Main quest incomplete, ≥ 3 regions | **8 h** | All available main-quest acts; one faction line as far as it goes |
| **FULL** | Main quest completable end to end | **20 h** | Main quest completed; one faction line to its top rank; the backpath at least once per project |

At every tier, all of the following are mandatory. Each has an evidence artifact and each is
a check in the verdict.

| # | Activity | Minimum | Why it is here |
|---|---|---|---|
| P1 | **Finish the main quest** (FULL tier) | 1 complete route + the backpath once per project | `RI-EXP05` cannot be scored otherwise, and the ending is the least-played content in any project |
| P2 | **Take one faction line to the top** | all ranks of 1 faction | The escalation bar (`RI-QST01`) is a structure claim; only a full climb tests whether it is *felt* |
| P3 | **Get lost on purpose** | ≥ 90 min contiguous with **no active objective**, journal closed, moving away from known objectives | The single most Morrowind-shaped activity in the game and the only way to measure whether the world rewards attention |
| P4 | **Fight the same boss three times** | 3 encounters: (a) blind, (b) after learning it, (c) with a materially different build/weapon class | Souls' core loop is *learning*. One kill measures difficulty; three measure whether there was anything to learn |
| P5 | **Talk to N NPCs** | ≥ 60 distinct NPCs; topic list **exhausted** on ≥ 20 of them | `RI-DLG02`'s word counts can be met by duplication; exhaustion is where that shows |
| P6 | **Die** | ≥ 25 deaths, ≥ 1 failed corpse run | A playthrough with no deaths measured a different game than the one players will play |
| P7 | **Read** | ≥ 12 in-world books read to the end; ≥ 1 acted on | `RI-LOR03`'s books exist to be read, not counted |
| P8 | **Be refused** | ≥ 5 refusals (disposition, rank, faction, knowledge) | Tests whether the world has social locks or only physical ones |
| P9 | **Run the breakage register** | every `RI-EXP06` probe attempted | The register is asserted-to-work; unrun probes score 0 |
| P10 | **Choose when to stop** | every session ends at a stopping point the agent selects and *preregisters* before stopping | The stop-point is a measurement (§4.2, VOLITION-4), not a convenience |
| P11 | **Refuse the intended solution** | ≥ 5 quests attempted first by a route the quest-giver did not suggest | Measures whether the game has more than one road, from the player's side |

**Prohibitions during play.** All are recorded in the verdict and all are wave-blocking if
violated:

- **No debug teleport, no god mode, no `spawn`, no `aggro`, no state injection**, except to
  recover from a hard block; every use is logged with its frame and its reason, and more than
  two uses in a playthrough downgrades that playthrough to `PROVISIONAL`.
- **No reading `game/data/**` before or during play.** This is unique to this role and it is
  absolute. The discovery instruments (`RI-EXP01` T-found, `RI-EXP02`, `RI-EXP04`'s
  first-encounter timestamps, `RI-WLD09`'s opacity register if it exists) all measure *what a
  player finds*, and an agent that has read the content files cannot find anything. Data files
  may be opened **only** in the verification stage, after every recall and first-person
  instrument has been captured and hashed. The ordering is recorded in `notes` and the hashes
  prove it.
- **No prior verdicts, no gap ledger, no builder notes, no design documents for this wave's
  content** until after raw measurement (`CRITIC-DOCTRINE.md` §8, applied at playthrough
  scale). The reference items in `corpus/95-experience/` are the exception — those are the
  bar and are read first.

---

## 4. The measurement problem: how an agent can honestly report on fun

This is the hard part and it is not going to be dodged. Everything above is logistics. This
section is the reason the role can exist at all, and if it is wrong then the whole area is
theatre.

### 4.1 State the problem properly

An agent cannot report on fun the way a person can, for five separate reasons, and they fail
in different directions:

1. **No hedonic ground truth.** There is nothing it is like for the agent to play the game.
   An enjoyment rating from an agent is a prediction of what a human would say, filtered
   through the agent's priors about games — not an observation.
2. **Trained agreeableness.** The agent is optimised to be helpful to whoever is asking. Ask
   "was it fun?" of a system that has spent three hours cooperating with a project, and the
   answer drifts positive for reasons that have nothing to do with the game.
3. **Confabulation under narrative pressure.** Asked for a story, a language model will
   produce a story. The failure is not lying; it is that a plausible account is cheaper to
   generate than an accurate one, and nothing in the prompt distinguishes them.
4. **No scarcity.** Human boredom is the felt cost of spending finite time badly. The agent
   has no alternative use for the hour and therefore no boredom. This is why *"did you want to
   keep playing"* is meaningless and *"where did you choose to spend a fixed budget"* is not.
5. **No body and no ears.** Tactile feel, impact, audio, music, animation weight, motion
   discomfort — none of it reaches the agent through the harness at all (`HARNESS.md` §3 says
   so explicitly). Any claim about those is fabrication.

**Therefore, and without exception: no absolute subjective self-report is admissible evidence
for any score in this role.** The following are banned as evidence, and their appearance in a
verdict is a void-triggering defect exactly like the banned reasoning in
`CRITIC-DOCTRINE.md` §2.4:

> "I enjoyed", "this was fun", "engaging", "immersive", "compelling", "satisfying", "I found
> myself wanting to", any 1–10 enjoyment rating, any "as a player I felt".

What replaces them is three families of instrument, plus one rule that makes all three
trustworthy.

### 4.2 Family A — revealed preference under latitude

You do not ask the agent whether it wanted to keep going. You give it a real choice, make both
options equally cheap, do not tell it which choice is being scored, and **log what it did**.
This is the only family that produces something like a preference, and it is only valid under
three conditions, all of which must be recorded per instrument:

- **Latitude.** The alternative behaviour was available and no more expensive. (An agent told
  "explore thoroughly" that then explores has told you nothing.)
- **Instruction neutrality.** The session prompt does not name the behaviour being measured.
  The prompt says *"reach Thorn; how you get there is yours"*, never *"look around on the
  way"*. Prompt text is an artifact and is committed with the run.
- **Preregistration.** Before acting, the agent writes its intent to `intent.jsonl`
  (§5.3) — what it is about to do and why, in one line, with no evaluative adjectives. The
  measurement is the divergence between the preregistered intent and the observed behaviour,
  which cannot be produced by writing a nice summary afterwards.

The six standing instruments:

| Id | Instrument | Measurement | What it is a proxy for |
|---|---|---|---|
| **V1** | **Detour rate** | With a preregistered destination, `detour_events / hour` = departures ≥ 40 m from the shortest known route lasting ≥ 45 s, and `detour_time_fraction` | The world being worth looking at while you have somewhere to be |
| **V2** | **Retry after death** | After each death: retried the same challenge vs left. `retry_fraction`, and `retries_before_abandon` per challenge | The Souls property. A game whose deaths do not produce retries has failed the only loop it has |
| **V3** | **Voluntary return** | Revisits to a location with no active objective there and nothing left to take | A place being a place rather than a container |
| **V4** | **Stop-point selection** | At each session end, where the agent chose to stop, preregistered ≥ 3 min before stopping, and whether an unfinished thread existed at that point | `RI-EXP03`'s "a reason to start the next session", measured as a decision rather than asserted |
| **V5** | **Free-budget allocation** | Given exactly 30 optional minutes and no objective, the distribution of that time across activity classes | Where the game's gravity actually is. A build where free time goes to inventory management has a finding |
| **V6** | **Pursued surprise** | Of the preregistered expectations in `intent.jsonl` that the world violated, the fraction the agent then *investigated* rather than routed around | The difference between a world that is confusing and a world that is interesting |

None of these is fun. Each is a behaviour that, in humans, co-occurs with interest, and each
is produced by a decision the agent made when it had a cheaper option. That is the strongest
honest claim available and it is the claim the verdict must make — in those words.

### 4.3 Family B — structural necessity (and its asymmetry)

The second family does not ask the agent anything. It measures properties of the run that are
**necessary conditions** for a memorable experience, off the trace, with no judgement in the
loop:

| Id | Instrument | Measurement |
|---|---|---|
| **S1** | **System co-occurrence** | Distinct systems participating in the same 30 s window, binned per hour (combat, stamina, disposition, faction, gold, alchemy, magic, stealth, crime, weather, tide, time-of-day, terrain, quest state) |
| **S2** | **Consequence persistence** | Decisions taken whose effect is still observable ≥ 30 min later in dialogue, world flags, or availability |
| **S3** | **Outcome variety** | Fraction of encounters/quests ending in something other than "died" or "scripted success" |
| **S4** | **Intention revision** | Preregistered intents abandoned or replaced because of something encountered — not because of failure |
| **S5** | **First-time events** | `RI-EXP04`'s instrument, reused here as a pacing input |
| **S6** | **Silence** | Longest window with no event of any authored class — the negative measure, and the one that finds hour ten |

**The asymmetry is the whole point and must be stated in the verdict:** the absence of these
properties is proof of deadness; their presence is **not** proof of life. S1–S6 fail closed
and never pass upward. A build that scores well on all six has earned the right to be judged
by Family A and C, and nothing more.

### 4.4 Family C — adversarial first-person protocols

Subjective reports are admissible **only** in forms that are robust to §4.1's five problems.
Six rules, all mandatory whenever a first-person judgement enters a score:

1. **Comparative, never absolute.** Never "rate this hour". Always "rank these six hours worst
   to best" or "which of these two 20-minute windows would you cut". Forced-choice ordering
   is dramatically more stable across runs than Likert output, and the verdict records the
   full ordering, not a mean.
2. **Negative first.** The first question asked of any session is always: *"Name the worst
   twenty minutes. Give its timestamps and say what happened in it."* This is asked before any
   positive question, and a session with no nominated worst twenty minutes is a defective
   report, not a good session. It is also the single most useful line in the whole verdict for
   the next builder.
3. **Blind wherever a reference exists.** `RI-EXP01`, `RI-EXP03` and `RI-EXP05` carry
   `blind_pair: yes` and are packed per `CRITIC-DOCTRINE.md` §5 by a *different* agent than
   the one judging. Beat sheets, hour histograms and final conversations all strip to
   comparable forms.
4. **Preregistered bets, with the answer recorded before the reveal.** Before entering a new
   region: *"predict the three things you will remember from this hour"*. After: score the
   prediction. A world whose surprises are all predicted from its first minute has a finding;
   a world where nothing is predictable has a different one.
5. **Writer/reader separation.** The agent that plays writes only `intent.jsonl` and the
   event log, in neutral register. **Evaluative adjectives are forbidden in the play log and
   are linted** (`tools/experience/log-lint.mjs`, §5.4); a log that fails the lint is rebuilt
   before any judging step. Evaluation happens only in the designated instruments, run by a
   separate invocation with a separate prompt.
6. **The judge is not the player.** Any Family C judgement that determines a score is made by
   an agent that did not produce the artifact it is judging, per §8.

### 4.5 The rule that makes any of this trustworthy: the sabotage control

Every one of the instruments above produces a number. None of those numbers means anything on
its own, because nobody knows what `detour_rate = 2.1/h` is supposed to be. **The battery is
therefore never interpreted as an absolute; it is only ever interpreted as a difference from a
control.**

> **Calibration rule (binding).** Every wave, the battery is run over a **control pair**: the
> real build, and a deliberately sabotaged variant produced from the same commit by a data
> filter. The critic is not told which is which. **If the battery cannot separate the two at
> the stated margin, the instrument is void and the verdict is `VOID` — not `FAIL`.** A
> failure of calibration is a defect in the measuring apparatus, and scoring the build with a
> broken instrument is worse than not scoring it.

Four standard sabotages, all produced by the **orchestrator** (never the critic — conflict of
interest), all from the same commit, all by config or data filter so no hand-authoring is
involved:

| Id | Sabotage | Mechanism | Which instruments must detect it | Required margin |
|---|---|---|---|---|
| **SAB-N** | Novelty stripped | The nth distinct instance of each novel element class is replaced by the 1st; no new element classes after minute 30 | `RI-EXP04` curve fit; S5; V6 | first-time events/hour in hours 2–4 lower by ≥ 60% |
| **SAB-E** | Encounters cloned | Every encounter in the run replaced by the modal one at that difficulty tier | `RI-EXP03` histograms; V2; S3 | encounter-composition entropy lower by ≥ 50% |
| **SAB-P** | Prose flattened | Every dialogue/journal/book string replaced by its own first sentence | `RI-EXP02` anecdote count; C-ranking | verified anecdotes/hour lower by ≥ 50% |
| **SAB-C** | Choice collapsed | Every quest reduced to its first resolution; refusals removed | S2, S3, V6, `RI-EXP05` | consequence-persistence count lower by ≥ 70% |

At minimum, **one** sabotage per wave, rotating, run over a **90-minute matched segment**
(same seed, same start state, same route brief) rather than a full playthrough — that keeps
the cost bounded. The critic receives segments labelled `A` and `B` with the assignment from a
recorded coin flip, exactly like a blind pack, and must state which is sabotaged and how it
knew **before** the reveal.

This is the honest answer to "how can an agent report on fun": *it cannot, and it does not
have to.* It has to detect the difference between a live build and a dead one, on a run where
the truth is known, and then apply the same instruments where the truth is not known. An
instrument that demonstrably discriminates is evidence. An instrument that has never been
shown to discriminate is an opinion with a number attached.

### 4.6 The memory problem, and enforced forgetting

`RI-EXP02` depends on an agent reporting what it *remembers*. Two naive designs both fail:

- **The same agent, full transcript.** It is not remembering, it is transcribing. Everything
  is recalled equally well, salience is invisible, and the measurement is of the log's length.
- **A fresh agent, given the artifacts.** It is not remembering either — it is *reconstructing
  from residue*. That is a genuinely useful measurement (does the run leave legible traces?)
  but it is not recall and must never be called recall.

The corpus therefore defines memory **structurally**, as what survives a bottleneck. A
playthrough is run in segments (§5). Between segments the outgoing agent hands the incoming
agent a **baton**: at most **500 words**, free-form, its only inheritance. The incoming agent
never sees the previous segment's log, transcript, or intent file. A twenty-hour playthrough
is roughly 13 segments and therefore 12 bottlenecks, and what reaches the end has survived
twelve deliberate compressions by twelve agents who each chose what was worth carrying.

That is a real analogue of remembering, because it is the same operation: **retelling under
scarcity**. It is also self-scoring — what an agent chooses to spend its 500 words on, when
those words are its successor's entire world, is a preference expressed at cost.

Three instruments follow, and `RI-EXP02` uses all three:

- **M1 — Baton survival.** Which events are still named in the final baton, and after how many
  hand-offs. `hops_survived` per event.
- **M2 — Reconstruction.** A fresh agent given only screenshots and a bare route log (no
  journal, no prose, no baton) writes what it can describe. Measures legibility of residue.
- **M3 — Terminal recall.** The final segment's agent, before touching any artifact, answers
  the recall prompt from its baton and its own segment alone.

**Confabulation penalty (anti-gaming, binding).** Every recalled item is checked against the
trace by `tools/experience/anecdote-verify.mjs`. An item that cannot be located in the trace
within ±2 minutes, and whose proper nouns do not resolve against `game/data/**`, is scored
**−1**, not 0. Recall is scored as `verified − unverified`, so inventing memories is strictly
worse than having none. This is the rule that keeps `RI-EXP02` from being a creative writing
exercise.

### 4.7 The limits, stated plainly

The following are **outside this instrument's reach**, and any claim about them in a verdict is
a fabrication under `CRITIC-DOCTRINE.md` §1.2:

- **Audio, music, and impact sound.** Not reachable through the harness at all.
- **Tactile feel, weight, hitstop, input latency.** `HARNESS.md` §3 excludes them by design;
  they belong to `RI-CMB09`/`RI-AUD01` (proposed) and to a human.
- **Frame rate and physical comfort.** Software renderer; excluded by `HARNESS.md` §1.
- **Beauty.** Art direction is `critic.artdirection`'s, on its own bifurcated axis.
- **Frustration and fatigue.** The agent does not tire, does not rage, and does not have
  another way to spend the evening. Difficulty *legibility* is measurable; difficulty
  *feeling* is not.
- **Attachment over weeks.** The thing that makes people talk about Morrowind for twenty years
  includes a duration this project cannot simulate.

Where one of these bites, the affected check is scored **`unmeasurable` → 0**, fail-closed per
`CRITIC-DOCTRINE.md` §7.3 — never guessed, never averaged away. And the escape hatch is named
rather than pretended away: **the ultimate instrument for those properties is a human playing
the game, and this corpus should say so.** The playthrough critic's job is to build the packs
that make a human's twenty minutes decisive: the worst-twenty-minutes clips, the blind first
hours, the two endings, the sabotage pair. It is a machine for pointing a human at the right
five percent of the game — not a replacement for one.

### 4.8 The two ways this role fails

- **The enthusiast.** Plays for twenty hours, writes a warm narrative account with proper
  nouns in it, scores 7s, names a gap about polish. Symptoms: no worst-twenty-minutes, no
  sabotage control, adjectives in the play log, Family A instruments absent, and a `biggest_gap`
  that a builder cannot act on. **Void.**
- **The abstainer.** Correctly observes that it cannot experience fun and therefore declines to
  judge, marking everything `unmeasurable`. This is the failure that looks like rigour. The
  corpus's answer is §4.5: the instrument's validity is an empirical question, and the
  abstainer has not run the experiment that would settle it. Marking a check `unmeasurable`
  without having attempted the control pair is **void**, not humility.

---

## 5. Mechanics — how the playthrough is actually produced

### 5.1 The session driver (harness amendment `A-EXP1`, required)

`HARNESS.md` §3 gives every primitive this needs — `stepFrames`, `queueInputs`, `snapshot`,
`traceStart`/`traceDrain`/`traceStop`, `saveState`/`loadState`, `setSeed`, `getQuestState`,
`getWorldStats`, `screenshot` — but `tools/harness/run-headless.mjs` only knows how to run a
fixed scenario to a fixed frame count. Long agent-driven play needs one new tool and one
harness amendment. Both are named here so a builder can produce them and so a critic can
fail closed until they exist.

**Amendment `A-EXP1` (to be appended to `HARNESS.md` §10):**
- `traceDrain()` becomes **mandatory**, not "strongly expected" — a 20-hour trace cannot be
  held in memory.
- `saveState()` / `loadState()` become **mandatory for experience items**: a playthrough is
  resumable across segments and processes, and the state blob is the segment boundary.
- A run may declare `render_policy: "on-demand"`: rendering only on `renderFrame()` /
  screenshot calls, so simulated hours are not bounded by SwiftShader's fill rate.
- No new gameplay surface, no new determinism relaxation: `D5` (byte-identical traces) still
  holds *per segment*, keyed by `(scenario, seed, input script)`.

**`tools/experience/session-run.mjs`** — the driver.

```
node tools/experience/session-run.mjs --session <id> [--resume <state.json>]
                                      --brief <brief.md> --seed <n>
                                      [--minutes <n>] [--render-policy on-demand]
```
- Boots the game (`?harness=1`), restores state if resuming, and exposes a step/observe loop
  to the driving agent over stdio: `OBSERVE` → a `snapshot()`+`getQuestState()` digest;
  `INPUT <script>` → `queueInputs`; `STEP <n>` → `stepFrames`; `SHOOT <label>` → screenshot;
  `INTENT <json>` → append to `intent.jsonl`; `END` → `saveState` + trace footer.
- Writes `reports/sessions/<sessionId>/`: `manifest.json`, `trace.jsonl`
  (`elder-souls/trace@1`, drained continuously), `intent.jsonl` (`elder-souls/intent@1`),
  `state-in.json` / `state-out.json`, `shots/`, `prompt.md` (the exact brief given), `baton-in.md`,
  `baton-out.md`, `console.log`.
- Exit codes per `HARNESS.md` §9. Absent tool ⇒ every experience item is `unmeasurable` ⇒ **0**,
  and the wave's experience verdict is `DEAD` for unmeasurability, not excused.

### 5.2 Segments, batons and the state chain

| Property | Value |
|---|---|
| Segment length | 90 simulated minutes (matches `RI-EXP03`'s session unit) |
| Boundary | `saveState()` → `state-out.json` → next segment's `--resume` |
| Inheritance | `baton-out.md`, **≤ 500 words**, hard-truncated by the driver |
| Forbidden inheritance | the previous `trace.jsonl`, `intent.jsonl`, transcript, screenshots, journal export, or any design document |
| Agent identity | a fresh invocation per segment; the segment agent is told the game's premise, its brief, and nothing else |
| Chain integrity | each segment's manifest records `parent_session`, `state_in_sha256`, `baton_in_sha256` |

The journal is in-fiction and is **not** contraband: the player character's journal is
readable in-game by the segment agent exactly as a player would read it. The distinction is
that the journal is *the game's* memory, offered diegetically, while the trace and the notes
are the *process's* memory and are withheld. Whether the journal alone is enough to resume a
game after a bottleneck is itself a finding, and `RI-DLG05` will want to know.

### 5.3 `elder-souls/intent@1` — the preregistration sidecar

One JSONL file per segment; one line per decision; written **before** the action.

```json
{"_":"intent","seg":4,"f":118440,"t_min":32.9,
 "intent":"reach the drowned shrine south of Lilmoth",
 "options_considered":["boardwalk south","hire the root-network","ask Ree-Vaska first"],
 "chosen":"boardwalk south","expect":"the boardwalk continues to the mangrove line",
 "why":"the fish-racks were named in the journal entry",
 "preregistered":true}
```

Header line: `{"_":"header","schema":"elder-souls/intent@1","session":"…","seed":…}`.
`expect` is what makes V6 (pursued surprise) and C4 (preregistered bets) computable.
`why` is one line and carries **no evaluative adjectives** — see the lint.

### 5.4 The log lint

`tools/experience/log-lint.mjs --in reports/sessions/<id>` fails (exit 20) if `intent.jsonl` or
the session's event annotations contain any term from the banned evaluative list in §4.1, or
any first-person affect verb (`enjoyed`, `loved`, `hated`, `was bored`). A failing log is
**rebuilt**, not excused: the segment is re-run. The point is not prudishness; it is that once
an agent has written "this was great" into its own log, every later judgement it makes is
anchored to that sentence.

### 5.5 Context isolation — how it is actually enforced

Every instrument that depends on an agent not having seen something must state which of these
two levels it achieved, and the level is recorded per instrument in the verdict:

| Level | Mechanism | Score effect |
|---|---|---|
| **`enforced`** | The agent is invoked with a **materialised inbox**: a directory containing copies of exactly the permitted files, and no path outside it. Its tool-call log is captured and diffed against the inbox manifest by `tools/experience/isolation-check.mjs`; any read outside the inbox voids that instrument's output. `context-manifest.json` records every permitted file with its sha256. | full |
| **`attested`** | The isolation is procedural (a separate invocation, an instruction not to read certain paths) with a tool-call log but no sandbox. | the affected item is **capped at 6** |

`isolation: "assumed"` is not a level. An instrument whose isolation is neither enforced nor
attested-with-a-tool-log produces **no admissible evidence** and its checks score 0.

---

## 6. Evidence it produces

Same standard as any critic (`CRITIC-DOCTRINE.md` §1.2). Everything lands under
`corpus/90-verdicts/<wave>/artifacts/experience-whole-game/`.

| Claim | Required artifact |
|---|---|
| "The playthrough happened" | The session chain: every `reports/sessions/<id>/manifest.json`, with `parent_session` links resolving into one chain, plus the concatenated trace footers |
| A beat occurred at time T | The trace line(s), quoted, plus `beat-diff.json` from `RI-EXP01` |
| An anecdote is real | `anecdote-verify.json`: the anecdote, its trace frame range, its proper nouns resolved to `game/data/**` paths |
| A first-time event | `novelty-curve.json` with the element id and its first-encounter frame |
| The hour was shaped like this | `event-histogram.json` per hour, from the trace's `events[]` |
| The agent chose X over Y | The `intent.jsonl` line (preregistered) **and** the trace frames showing what it then did |
| A first-person judgement | The exact prompt given (committed), the response verbatim, the isolation level, and the judging agent's run id |
| The instrument works | `sabotage-control.json`: the blind pick, the rationale written before reveal, the margin achieved |
| "It does not exist" | The negative artifact: the search that would have found it, and its empty output |

Screenshots follow `HARNESS.md` §6 for anything compared to a reference; for narrative
evidence (a beat, a place, a moment) the pose need not be canonical but must be recorded.

---

## 7. Scoring, and the wave verdict

1. Score each `RI-EXP0x` on its own scale, record `native_*`, translate to the ladder per
   `SCORING.md` §1.2.
2. Aggregate with **`min`** (§2). Record it.
3. Apply hard-fail caps, the unjustified-≥7 clamp, and item ceilings as normal.
4. `AR-1`, `AR-2` and **`AR-3` (seam sterility)** on every verdict. `AR-3` is unusually
   important here: this role plays the whole game and is the only agent positioned to observe
   that the fight and the world never touch. If it reports `seam_sterile: true` for the game
   as a whole, that is a finding of at least `major` severity and `RI-CMP01`'s floor governs.
5. Emit `wave_experience_verdict` per §2.
6. Name **exactly one** `biggest_gap`, with a remedy a builder can act on. For this role the
   remedy will usually name content owned by someone else — that is correct and expected. The
   remedy must name the file or subsystem, the mechanism, and the observable that would
   constitute done.

**The one-gap discipline is harder here and matters more.** Twenty hours of play produces
dozens of observations. Ranking them into one is the judgement the project is buying.

---

## 8. Conflict of interest

Everything in `CRITIC-DOCTRINE.md` §8 applies, plus three additions specific to a role that
both produces and judges its own evidence:

- **The playthrough agent and the judging agent are different invocations.** The agent that
  plays a segment may not score any item. The agent that scores may not have played. The
  ranking, blind, and sabotage judgements are made by a third invocation that has seen neither
  the play brief nor the batons.
- **The sabotage variants are produced by the orchestrator**, and the critic may not know
  which variant it is playing. A critic that builds its own control has built a control it
  knows the answer to.
- **The critic must not have authored any content in the wave**, and must not have authored
  the `corpus/95-experience/` items it is applying if it also wrote them in the same wave —
  in that case it recuses on those items and the orchestrator assigns a different agent
  (`CORPUS-CONTRACT.md` §5 growth is fine; judging your own new bar in the same wave is not).

---

## 9. The verdict extension

A `critic.experience` verdict is an ordinary verdict per `VERDICT-SCHEMA.md` plus one
additional top-level object. Adding an object is schema-compatible; the aggregator ignores
what it does not know, and `tools/verdict-validate.mjs` should be extended to check it.

```jsonc
{
  "experience": {
    "tier": "FULL",                              // FRAGMENT | PARTIAL | FULL
    "simulated_hours": 20.4,
    "sessions": ["exp-w3-s01", "…"],             // the chain, in order
    "batons": 12,
    "activities": {                              // §3, P1..P11, each with evidence
      "P1_main_quest_completed": true, "P1_backpath_completed": false,
      "P2_faction_top_rank": "salt-kin", "P3_lost_minutes": 96,
      "P4_boss_three_ways": "hollow-of-thorn", "P5_npcs_talked": 71,
      "P5_topic_lists_exhausted": 23, "P6_deaths": 31, "P7_books_read": 14,
      "P8_refusals": 7, "P9_breakage_probes_run": 14, "P10_stop_points": 12,
      "P11_unintended_routes": 6
    },
    "prohibitions": { "debug_teleports": 0, "data_read_before_play": false,
                      "data_read_first_at": "2026-08-05T19:22:00Z" },
    "volition": { "V1_detours_per_hour": 2.4, "V2_retry_fraction": 0.81,
                  "V3_voluntary_returns": 9, "V4_stop_points_with_open_thread": 11,
                  "V5_free_budget_split": { "explore": 0.44, "talk": 0.21, "fight": 0.19,
                                            "menus": 0.05, "travel": 0.11 },
                  "V6_pursued_surprise_fraction": 0.62 },
    "structural": { "S1_cooccurrence_per_hour": 6.1, "S2_persistent_consequences": 14,
                    "S3_outcome_variety": 0.38, "S4_intention_revisions": 11,
                    "S5_first_times_total": 79, "S6_longest_silence_min": 7.5 },
    "worst_twenty_minutes": { "session": "exp-w3-s07", "t_start_min": 41,
                              "what": "…", "evidence": ["…"] },
    "sabotage_control": { "id": "SAB-N", "blind_pick": "B", "picked_correctly": true,
                          "margin_required": "≥60% fewer first-times in h2-4",
                          "margin_observed": "71%", "artifacts": ["…"] },
    "isolation": { "M2_reconstruction": "enforced", "M3_terminal_recall": "enforced",
                   "C_ranking": "attested" },
    "referred_to_coherence": [ { "what": "…", "evidence": ["…"] } ],
    "inherited_referrals": [ { "from_wave": 2, "subsystem_path": "dialogue.voice.register",
                               "answered_with": "RI-EXP02 M3", "result": "finding" } ],
    "wave_experience_verdict": "ALIVE_WITH_FINDINGS"
  }
}
```

Self-audit gains four booleans on top of `CRITIC-DOCTRINE.md` §2.6, each requiring a note if
false:

`played_the_required_dosage`, `read_no_content_data_before_play`,
`sabotage_control_passed`, `named_the_worst_twenty_minutes`.

---

## 10. How this role loses

Written pessimistically and in advance, like every reference item, because this document will
be graded by whether the failures below happened.

- **It becomes a travelogue.** Twenty hours of pleasant narration, no instrument, no control,
  no number a builder can move. The §4 battery exists to make this impossible to submit.
- **It becomes a second coherence agent.** The findings drift toward the things that are easy
  to see and easy to fix — a name spelled two ways, a border cliff — because deadness is hard
  to point at and inconsistency is not. The remit table in §1 is the defence, and a verdict
  whose `biggest_gap` is a coherence defect is out of process.
- **The dosage gets cut.** Twenty hours is expensive; someone runs three and extrapolates. The
  tier declaration and the session chain make the shortcut visible, and a `PARTIAL` tier on a
  `FULL` build is itself a finding against the wave.
- **The agent reads the data files "just to check something".** Once, early, in segment two.
  Every discovery number in the wave is then worthless and nothing in the artifacts says so.
  The hash-and-ordering requirement in §3 exists solely for this.
- **The control is never run** because it is the most expensive thing here and the least
  obviously necessary. Then the numbers are decoration. This is the most likely single
  failure, and it is why calibration failure produces `VOID` rather than a low score.
- **The batons become notes.** Someone widens 500 words to 5,000 "for continuity", the
  bottleneck disappears, and `RI-EXP02` silently becomes a transcription exercise that always
  passes. The driver hard-truncates for exactly this reason.
- **The role is captured by the project.** It plays every wave, it sees improvement, and it
  starts grading the trend. `CRITIC-DOCTRINE.md` §2.4.1 already bans this and it will happen
  anyway, because this is the one role that experiences the project as a story with a
  protagonist.
- **It is given standing and then routed around.** A `DEAD` wave is enormously expensive to
  honour. The first time it fires, the pressure will be to reclassify it as
  `ALIVE_WITH_FINDINGS` and carry on. If that happens once, this document is decorative and
  the corpus is back to where `BAR-CRITIQUE-01` found it.
