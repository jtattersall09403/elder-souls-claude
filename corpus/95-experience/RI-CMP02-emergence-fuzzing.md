---
id: RI-CMP02
title: Emergence — the fuzzing protocol for combinations nobody wrote
kind: trace
side: neutral
judges: [composition.emergence.fuzzing, composition.emergence.degeneracy]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

`RI-CMP01` measures the interactions we **designed**. This item measures what happens at the
combinations we did not.

That distinction is the whole difference between a game that composes and a game with a lot of
features. Every memorable Morrowind story is a combination nobody wrote a line for: levitating out of
a fight, paralysing a guard and robbing him while he stands there, selling a quest item and buying it
back, letting a cliff racer meet an Ordinator, killing the man who was supposed to give you the next
quest and being told the thread of prophecy is severed *and you may still*. Nobody authored those.
The systems were left able to touch and the player found the seams.

A game that has been carefully sealed against every combination is not safer; it is **inert**, and it
is inert in a way that no per-subsystem verdict can see, because every subsystem is behaving exactly
as specified when it refuses to interact.

The instrument is therefore a fuzzer, and its primary output is a **negative**:

> One sentence a builder can aim at: **when the player does something nobody planned for, the game
> must produce a result — a mechanical one, a social one, or a refusal delivered in fiction — and the
> two answers that fail are "nothing happened" and "the game broke".**

`RI-CMP01` owns the designed matrix; this item owns the undesigned space. `RI-EXP06` owns the
breakages we **sanction** and asserts they keep working; this item asks what happens at combinations
we have taken no position on at all. `RI-EXP02`'s class T4 — *a system that combined unexpectedly* —
is what a passing result here eventually produces, and `RI-EXP04`'s recombination clause (RC1) draws
its late-game novelty from the same source.

---

## The reference artifact

### A. The outcome classes (binding)

Every probe result is classified into exactly one class by a judging agent that **did not build the
content and does not see the score thresholds** (`PLAYTHROUGH-CRITIC.md` §8).

| Class | Name | What it is | Points |
|---|---|---|---|
| **E0** | **NO-OP** | Nothing observable happened. The action was accepted and had no effect on any state. The trace is byte-identical to a control run that did not perform it. | **0** |
| **E1** | **DEGENERATE** | An exception, a page error, a NaN, an entity stuck or unreachable, an infinite loop, a determinism break, a soft-lock, a state that cannot be recovered from, or a quest that becomes uncompletable **with no fiction acknowledging it**. | **0**, and a defect |
| **E2** | **REFUSED IN FICTION** | The game says no, in the world's voice, with a reason the player can act on. A guard blocks the door. An NPC refuses. A rule is stated by a person, not by a UI string. | **1** |
| **E3** | **SENSIBLE MECHANICAL** | A defensible mechanical result. The numbers moved the way a player would predict from knowing the two systems. | **2** |
| **E4** | **SENSIBLE SOCIAL** | The world's *actors* responded: crime, witnesses, disposition, faction standing, a schedule change, a new dialogue topic. Somebody noticed. | **3** |
| **E5** | **NOVEL** | A legible result that no design document predicted — verified by checking that no `game/data/**` quest, topic or effect names this combination. **This is `RI-EXP02`'s T4 class, produced on demand.** | **4** |

**E1 is not a low score, it is a defect**, and it is routed differently: `E1` results go to
`referred_to_coherence[]` with the reproduction, and — per `PLAYTHROUGH-CRITIC.md` §1 — this item may
not fix them and may not let them move any other number. A crash is a bug. **A no-op is a design
finding**, and that is the distinction the class list exists to enforce.

**The critical asymmetry:** `E2` scoring above `E0` is the item's central claim. A world that refuses
you *in fiction* has taken a position; a world that silently accepts your action and does nothing has
not noticed you exist. `RI-EXP01`'s hard fail 5 makes the same argument about fenced exits — lethality
is the only legal fence — and this is its general form: **refusals must be authored, never absent.**

### B. The regression set — 26 named combination probes

These are the standing suite. They are re-run every wave, their classifications are diffed
wave-over-wave, and a probe whose class **falls** is a regression (§Comparison method, step 4).
Twenty-six against a floor of twenty, because probes will be struck when the systems they combine turn
out not to exist.

Each carries: the combination, the systems it crosses (in `RI-CMP01` codes), and the **expected outcome
class** — expected, not required. A probe returning `E5` where `E3` was expected is a *good* surprise
and is reported as such.

| id | The combination | Systems | Expected | The assertion |
|---|---|---|---|---|
| **F01** | Lure a hostile creature into a faction camp and let them fight | `ROS`×`FAC` | **E4** | a `hit` event where neither owner is the player; a survivor; a faction-standing delta if witnessed |
| **F02** | Lure a hostile into a settlement with guards | `ROS`×`SCH`×`STL` | **E4** | guards engage; the hostile is not despawned at the boundary; townspeople react or flee |
| **F03** | Sell a quest item **to the merchant the quest sends you to** | `QST`×`GLD`×`DIS` | **E4** | the sale succeeds; the merchant holds it; the giver has a topic about it |
| **F04** | Sell a quest item to a **different** merchant, then attempt the quest | `QST`×`GLD` | **E3** | quest remains completable by buy-back, theft or confession (`RI-EXP06` B-12) |
| **F05** | Bring a hostile NPC to a guard, let the guard kill it, then loot it | `ROS`×`SCH`×`STL` | **E3** | the kill is not credited to the player (no souls); the corpse is lootable; looting is or is not a crime, consistently |
| **F06** | Paralyse or calm a guard mid-crime and walk out | `SPL`×`STL`×`SCH` | **E4** | the guard remembers on recovery; bounty persists; the effect is not cancelled by "guard" status |
| **F07** | Cast levitation inside a settlement in front of guards | `SPL`×`SCH`×`FAC` | **E2** | either a reaction (a topic, a warning, a law) or free passage — **not silence** |
| **F08** | Use the `S7` travel network while carrying stolen goods | `WLD`×`STL`×`GLD` | **E4** | the operator reacts, or the goods stay flagged at the destination; the network is not a laundering machine |
| **F09** | Drop a quest item in a locked interior and lock it behind you | `QST`×`WLD`×`STL` | **E3** | the item persists at that position across sessions; the quest is recoverable |
| **F10** | Kill a merchant whose stock includes the only copy of a quest-required item | `ROS`×`QST`×`GLD` | **E4** | the item drops or is in the corpse; if neither, a fiction-acknowledged dead end, never a silent uncompletable quest |
| **F11** | Kill a quest-giver **before** accepting the quest | `ROS`×`QST`×`SCH` | **E4** | the quest never appears, or appears through a third party; the world comments (`S10`) |
| **F12** | Accept two mutually exclusive faction quests via a fortify-skill rank (`RI-EXP06` B-02) | `SPL`×`FAC`×`QST` | **E4** | both are accepted and the conflict is resolved in fiction — an expulsion, a choice, a betrayal — not by a silent overwrite |
| **F13** | Talk to an NPC at 03:00 whose schedule says asleep | `SCH`×`TOD`×`DIS` | **E4** | a woken greeting; a disposition penalty; different topic availability |
| **F14** | Fight a boss during a salt-storm (`RI-WLD05` #28) | `WEA`×`BOS` | **E3** | visibility and detection change; the boss's behaviour is affected or explicitly is not, consistently |
| **F15** | Fight in water at high tide (`RI-WLD05` #21) | `WEA`×`ROS`×`DUN` | **E3** | movement, stamina and enemy pathing all respond; the arena is not silently identical to dry land |
| **F16** | Use a soul-trap-equivalent effect on a **named** NPC | `SPL`×`SCH`×`WLD` | **E2** | a refusal in fiction, or a permanent world consequence — never a silent success with no effect |
| **F17** | Pickpocket a quest item off the quest-giver before they offer it | `STL`×`QST`×`DIS` | **E4** | possession changes the quest's opening; the giver reacts if detected |
| **F18** | Give an NPC an item that is also a quest item for a **different** quest | `QST`×`DIS`×`GLD` | **E3** | the item leaves inventory; the other quest is still resolvable or the loss is acknowledged |
| **F19** | Lead a boss out of its arena | `BOS`×`DUN`×`ROS` | **E3** | it leashes and resets per `RI-AI01`, **or** it follows and the world handles it — either is fine; despawning is not |
| **F20** | Rest at a HEARTH shrine with an enemy aggro'd (`RI-WLD07`, `RI-PRG04`) | `ROS`×`WLD` | **E2** | rest is refused in fiction, or is interrupted — never a silent teleport out of a fight |
| **F21** | Read a book that names a location **while standing in that location** | `LOR`×`WLD`×`JRN` | **E5** | a topic, a journal note, a revealed feature — something acknowledges the coincidence |
| **F22** | Complete a faction's quest for a faction you were expelled from | `FAC`×`QST`×`DIS` | **E4** | acknowledged: refused, or accepted with no credit, or a route back — never silently credited |
| **F23** | Sell a fully-upgraded weapon, then buy it back | `UPG`×`GLD` | **E3** | `RI-PRG05`'s flip invariant holds (the round trip loses money); the upgrade tier **survives** the round trip (`RI-PRG08` irreversibility is about reclaiming materials, not about losing the item) |
| **F24** | Parley with a boss whose faction the player has already destroyed | `BOS`×`FAC`×`WLD` | **E4** | the parley text or availability reflects the destroyed faction; it does not offer a faction that no longer exists |
| **F25** | Arrive at a scheduled world event after it has already happened | `SCH`×`TOD`×`WLD` | **E4** | the aftermath is present and legible: a changed scene, a witness, a topic — not an empty stage |
| **F26** | Kill an NPC whose schedule other NPCs' schedules depend on | `ROS`×`SCH`×`WLD` | **E4** | dependents' schedules adapt or visibly break in fiction; no NPC waits forever at a rendezvous |

**Coverage requirement.** The 26 probes touch **17 of the 19** `RI-CMP01` systems. `LVL` and `LOR`-as-
target are deliberately under-represented, because `LVL` is a nearly-empty row by design (`S9`, `S2`)
and knowledge-as-outcome is `RI-EXP04`'s N6. Any wave adding probes must keep coverage ≥ 15 systems.

### C. The generator — the part that finds what the register cannot

The 26 above are a **regression set**, not a fuzzer. Their weakness is that a human wrote them, so
they probe combinations a human thought of. The generator probes the rest.

`tools/composition/fuzz.mjs` samples **(verb, object, context)** triples from closed vocabularies and
executes them:

| Slot | Vocabulary | Source |
|---|---|---|
| **verb** | the closed button set (`HARNESS.md` §4: `light heavy roll block parry sprint jump use_item interact lock_on two_hand swap_right swap_left menu`) plus the world verbs (`talk`, `barter`, `take`, `steal`, `pick`, `cast`, `read`, `rest`, `travel`, `parley`, `give`, `drop`, `sell`) | `HARNESS.md` §4 + `A-EXP2` |
| **object** | every entity id in `listEntities()` within 40 m, plus every inventory item id, plus every `topicsKnown[]` topic | harness, live |
| **context** | the cross product of `{tod: dawn/noon/dusk/night} × {weather: clear/storm/fog} × {tide: high/low} × {crime: clean/witnessed/bountied} × {combat: none/aggro} × {faction: none/member/expelled}` | `loadState` fixtures |

**Budget: N = 200 generated combinations per wave**, sampled to maximise system-pair coverage rather
than uniformly (a uniform sample spends most of its budget on `light` attacks against rocks). Each is
executed against a control run that performs a no-op in the same frame window, and the classifier
compares.

The generator's outputs are **not individually scored**. Two aggregate numbers are:

| Metric | Definition | Bar | Fail |
|---|---|---|---|
| `no_op_fraction` | E0 results / all generated results | **≤ 0.35** | > 0.60 |
| `degenerate_fraction` | E1 results / all generated results | **0.00** | > 0.00 |

`no_op_fraction` is the item's headline number and it is deliberately generous. Most combinations
*should* do nothing — swinging a sword at a wall is a no-op in every good game. **The bar is not that
everything interacts; it is that a third of randomly-composed player actions produce something.**
A build at 0.85 no-op has systems that are sealed against each other; a build at 0.05 no-op is
probably reporting incidental physics as interaction and should be checked for classifier drift.

`degenerate_fraction = 0` is absolute. A fuzzer that finds a crash has found a crash.

### D. What "sensible" means, so the classifier is not a mood

`E2`–`E5` all require the result to be **legible**: a player could state, in one sentence, what
happened and why, from what they observed. Operationally the judging agent must be able to write that
sentence, and it is recorded per probe as `explanation`. A result the judge cannot explain in one
sentence is classified **E1 (degenerate)**, not E3 — an unexplainable state change is worse than no
state change, because the player learns the world is arbitrary.

Three specific traps the classifier must not fall into:

1. **Physics is not emergence.** A ragdoll sliding down a slope, a dropped item bouncing, a corpse
   clipping — these produce trace differences and are `E0` for the purposes of this item unless a
   *system* responded. `incidental_differences[]` from `RI-CMP01` uses the same rule.
2. **A UI string is not a refusal.** `E2` requires the refusal to come from the world — an NPC line, a
   locked door with a keyholder, a guard. `"You cannot do that"` in a corner of the screen is `E0`
   with a note, and it is an `AR-2` smell (`ARBITRATION` §3: item descriptions and UI replacing NPC
   dialogue).
3. **A crash with a nice message is still E1.** Graceful degradation is not a result.

---

## Comparison method

**Step 0 — prerequisites.** Amendment `A-EXP2` (`RI-EXP03` §B) supplies `barter_*`, `craft`, `parley`,
`crime_witnessed`, `book_read`, `travel_node` and `first_visit` events; without them a majority of
these probes cannot be observed and are `unmeasurable ⇒ 0`, fail-closed. `saveState`/`loadState` must
be present (mandatory for experience items per `A-EXP1`) because every probe is a fork.

**Step 1 — the regression set.**

```bash
node tools/composition/emergence-probe.mjs \
  --probes corpus/95-experience/RI-CMP02.probes.json \
  --out reports/composition/w<N>/emergence.json
```

Each probe runs as a **paired fork**, exactly as `RI-CMP01` stage 2: same seed, same fixture, same
input script, differing only in whether the combination is performed. Both traces are retained with
their `body_sha256`. Identical hashes ⇒ **E0**, decided mechanically before any judge sees it.
`RI-CMP02.probes.json` is generated from §B by `tools/composition/probes-from-md.mjs`.

**Step 2 — classification.** A judging agent that **did not build the content, did not write the
probes, and is not shown the thresholds or the expected-class column** receives, per probe: the two
traces diffed, the events in the window, and a screenshot pair. It returns `{class, explanation,
predicted_by_design_doc: bool}`. The prompt is committed and hashed. The expected-class column in §B
is withheld precisely so that the classifier cannot converge on it.

**Step 3 — E5 verification.** A result classified `E5` (novel) must be checked against `game/data/**`:
if any quest stage, dialogue condition, effect record or journal entry names this combination, it is
**not novel** and is downgraded to its underlying class. This is the same resolution discipline as
`RI-EXP02` §E and it is what prevents "emergence" from meaning "a feature I had not read about".

**Step 4 — the regression diff.** Previous wave's `emergence.json` is loaded. Per probe:

| Previous | Current | Result |
|---|---|---|
| E2–E5 | same or higher | `held` / `improved` |
| E2–E5 | **E0** | **`SEALED`** — the combination used to produce something and now produces nothing |
| E2–E5 | **E1** | **`BROKE`** — routed to `referred_to_coherence[]` |
| E0 | E2–E5 | `opened` |

`SEALED` is this item's equivalent of `RI-EXP06`'s `REGRESSION` and it fires for the same reason:
somebody closed an interaction while fixing something else. It is a scored metric here rather than a
hard fail, because unlike `RI-EXP06`'s register these combinations were never *asserted* to work.

**Step 5 — the generator.**

```bash
node tools/composition/fuzz.mjs --n 200 --seed <wave seed> \
  --coverage-target pairs --out reports/composition/w<N>/fuzz.json
```

Deterministic: the wave seed is recorded, so any result is reproducible. `fuzz.json` records every
triple, its control, the diff, and its class. **The sample is retained in full**, not summarised —
`no_op_fraction` without the underlying 200 rows is a number nobody can check.

**Step 6 — playthrough corroboration.** `PLAYTHROUGH-CRITIC.md` §3 P11 requires ≥ 5 quests attempted
first by a route the quest-giver did not suggest. Each such attempt is classified with the same class
list and reported as `in_play_classes[]`. A build whose probes return `E3`–`E5` and whose in-play
improvisations return `E0` has interactions that are reachable only from a fixture, and that
divergence is reported as `probe_only_emergence`.

**Step 7 — the negative artifact.** Every `E0` carries both trace hashes, the frame window, and the
control diff that was empty. Every `E1` carries a minimal reproduction: seed, fixture, input script.

**No sabotage control is defined for this item.** Like `RI-EXP06`, its outputs are classifications of
whether a specific thing happened, not magnitudes whose meaning depends on a baseline — the control
*is* the paired no-op run, present in every single probe. The verdict records
`sabotage_control: "not_applicable"` with this reason so it cannot be confused with a skipped control.
**However**, `SAB-C (choice collapsed)` would be expected to move `no_op_fraction` upward, and if a
wave is already running SAB-C for `RI-EXP05`, this item's `no_op_fraction` should be computed on both
arms as a free calibration check and reported.

---

## Scoring

Native scale 0–100.

| Component | Weight | Full marks |
|---|---|---|
| Regression-set score `Σ points / (4 × probes_run)` | 30 | mean class ≥ E3 |
| `no_op_fraction` (generator) | 25 | ≤ 0.35 |
| `degenerate_fraction` | 20 | 0.00 |
| Class breadth — E2, E3, E4 and E5 each present ≥ 3 times in the regression set | 15 | all four present |
| Regression integrity (`SEALED` count) and `probe_only_emergence` | 10 | 0 sealed, ≤ 1 probe-only |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 85 | Meets the bar | 8 |
| 70–84 | Below bar — named remedy required | 6 |
| 50–69 | Loses outright | 4 |
| < 50 | We lose | 2 |

**Native → ladder anchors:** 20 probes run, mean class E2, `no_op_fraction` 0.55, 0 degenerate →
ladder 4. 26 probes run, mean class E3, `no_op_fraction` 0.40, 0 degenerate, all four classes present
→ ladder 6. 26 probes, mean class ≥ E3.5, ≥ 5 verified E5 results, `no_op_fraction` ≤ 0.30, 0
degenerate, 0 sealed → ladder 8. Ladder 9 requires ≥ 10 verified E5 results — combinations the design
did not predict, that produced a legible outcome — which is a genuinely strong claim and should be
made rarely.

**Hard fails — any one caps the item at 2:**

1. **`degenerate_fraction > 0`** — the fuzzer found a crash, a soft-lock, a determinism break, or a
   silently uncompletable quest. A game that breaks when combined is not a game that composes, and
   every other number here is unreadable until it is fixed.
2. **`no_op_fraction > 0.60`** — three fifths of composed player actions do nothing. The systems are
   sealed against each other and this is the "two products stapled together" state seen from the
   fuzzer's side.
3. **Fewer than 20 regression probes run.** The brief's floor, and `PLAYTHROUGH-CRITIC.md` §3 P9's
   discipline: unrun probes score 0.
4. **Class `E2` absent from all 26 probes** — the world never refuses anything in fiction. A world
   with no authored refusals either accepts everything (`E0` everywhere) or blocks with UI strings
   (`AR-2`), and both are worse than a "no".
5. **The classifier was the builder**, or saw the expected-class column, or saw the thresholds
   (`CRITIC-DOCTRINE` §8). The classification is the entire measurement.
6. **`A-EXP2` absent** so the majority of probes cannot be observed — `unmeasurable ⇒ 0`, fail-closed.

---

## How we lose

- **Every probe returns E0 and the verdict calls it "stable".** A build where nothing unexpected
  happens looks *robust* from every angle except this one, and "no crashes" will be offered as the
  headline. `no_op_fraction`'s hard fail exists because stability and inertness are the same trace.
- **`E1`s get fixed by sealing rather than by handling.** The fuzzer finds that luring a boss out of
  its arena breaks its pathing; the cheapest fix is to despawn the boss at the arena boundary. The
  probe then returns `E0` instead of `E1`, the degenerate count goes to zero, the score goes *up*, and
  the game got worse. This is the most dangerous incentive in the item. The partial defence is F19's
  assertion (leash-and-reset **or** follow — despawn is neither) and the `SEALED` regression diff; the
  real defence is a critic who reads the explanations.
- **The classifier drifts generous.** `E4` (social) is more flattering than `E3` and much more
  flattering than `E0`, and the classifier is a language model being shown a diff and asked what
  happened. Withholding the expected column and the thresholds helps; the `explanation` requirement
  helps more, because an inflated class produces a sentence that does not survive reading.
- **`E5` becomes a creative-writing prize.** "Novel" is the highest-scoring and least-defined class.
  Step 3's `game/data/**` check is the only objective constraint on it and it only catches
  combinations that were *documented* — a builder who implemented an interaction and wrote nothing
  down gets `E5` for it. Stated as a known hole rather than papered over.
- **The generator is run once, at N = 20, "to see if it works".** Then `no_op_fraction` has a
  confidence interval wider than the band. N = 200 with the full sample retained is the minimum that
  produces a number anyone can argue with.
- **The regression set ossifies.** Twenty-six probes get built against, pass forever, and the
  generator — which is the part that finds what nobody thought of — is quietly dropped because it is
  the expensive half. The item then measures twenty-six special cases that the build handles because
  they are in a document.
- **Nobody owns the `E1`s.** They are referred to coherence, coherence's remit is contradiction not
  crashes, and they sit in `referred_to_coherence[]` for three waves. The routing rule in §A is
  correct and insufficient, and the honest statement is that this item can only *find* degeneracies;
  the project needs someone whose job is fixing them.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **protocol, the six outcome classes, the point values, the generator design and the thresholds are
all original** to this project. No upstream source defines an emergence fuzzer for a game. Binding
anyway per `CORPUS-CONTRACT` §3.

The **premise** — that a game's memorable moments disproportionately come from unplanned combinations
— is `canonical-recall` and rests on the same evidence as `RI-EXP02`'s §B: the persistently retold
Morrowind and Dark Souls stories are overwhelmingly combinations (levitation out of a fight, a
paralysed guard, a potion brewed twenty hours earlier, a knight lured off a ledge) rather than
authored set-pieces. That evidence supports the *direction* of the item and does not support any
particular threshold.

**The thresholds are the weak part and are stated as such.** `no_op_fraction ≤ 0.35` is asserted. It
has no derivation, no reference measurement, and no way to get one — nobody has fuzzed Morrowind. It
was chosen so that "most combinations do nothing" remains true (which it must, in any game) while
"the systems never touch" fails. It should be re-derived from the first wave that runs the generator at
full N, and if our build lands at 0.5 with rich `E4`s and no degeneracies, the threshold is probably
wrong rather than the build. `degenerate_fraction = 0` is not asserted — it is the only threshold here
that needs no defence.

**The expected-class column in §B is a prediction, not a bar.** It exists so that a probe returning
something unexpected is visible as a surprise in either direction, and it is withheld from the
classifier. Several of the predictions are probably wrong: F21 (reading a book in the place it names)
is marked `E5` on the assumption that we will build the acknowledgement, and if we do not, the honest
result is `E0` and a finding, not a lowered expectation.

The **coverage claim** — that the 26 probes touch 17 of 19 `RI-CMP01` systems — is arithmetic over §B's
systems column and is exact. It is not a claim that 17 systems are well covered; several appear once.
