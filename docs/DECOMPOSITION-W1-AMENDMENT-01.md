# DECOMPOSITION-W1-AMENDMENT-01 — who owns the paths nobody owned

**Author:** decomposition-architect. **Date:** 2026-08-07.
**Referral:** `corpus/88-journeys/BAR-CRITIQUE-W1-07-R1.md` §R7 and Condition 5 —
*"37 of 38 `journey.*`/`input.*`/`experience.*` paths are owned by nobody."*
**Governing text:** `corpus/00-doctrine/INTENT-AUDIT-CHARTER.md` (wide before deep),
`CORPUS-CONTRACT.md` §4 as amended (item sets are built from `judges:`, never from a directory;
a piece's declared path set must cover what it ships), `SCORING.md` §0 (the bar is 10).
**Applied to:** `docs/PLAN.md` §3, §3b, §4, §5, §5b.

**No bar is lowered here and nothing is deferred.** Every change either gives an unowned path an
owner, moves a path to the piece whose item set already judges it, or promotes a path *into*
wave 1. Wave 1 gets bigger. That is the finding, not a side effect.

---

## 1. The count, verified

The referral's figure is **confirmed exactly**, and it means something more specific than it says.

`corpus/00-doctrine/subsystems.json` defines **13** `journey.*`, **10** `input.*` and **15**
`experience.*` paths — **38**. Across every `subsystem_paths` array in
`corpus/90-verdicts/wave1/*.json`, exactly one appears: `journey.chargen.diegesis`, claimed by
`W1-07`. **37 of 38. Verified.**

But "owned by nobody" resolves into **two different failures that need two different fixes**, and
conflating them would have produced the wrong remedy:

| | Count | What it is |
|---|---:|---|
| **A. In no piece definition at all** | **4** wave-1 paths | A hole in the decomposition. `docs/PLAN.md` never assigned them. Fixed in §3 below. |
| **B. In a piece definition that has never been dispatched** | **34** of the 38 | Not a plan hole. `W1-08` (all ten `input.*`), `W1-26` (eleven `journey.*`), `W1-25` (seven `experience.*`) and `W1-19` (three `experience.ending.*`) all exist in `PLAN.md` §3 — and **none of them has a status file, a brief, or a verdict.** Fixed in §5 below, and it is the more serious of the two. |

**A is a paperwork error. B is the project having gone deep before it went wide**, and it has a
number:

> **79 of 144 reference items own no path declared by any dispatched wave-1 verdict.**
> Seven of twenty-eight pieces have been dispatched. Two of those seven (`W1-01`, `W1-09`) have
> each been round-tripped **four times**.

The corpus has been asked the same seven questions repeatedly and fifty-five per cent of it has
never been asked anything. `journey.*` was the family where a bar critic happened to look.

---

## 2. Every unowned path, enumerated

### 2a. Wave-1 paths in **no** piece — the real orphans (4)

| Path | Wave | Judged by | Assigned to |
|---|---|---|---|
| `journey.opening.exchange` | 1 | `RI-JRN09` | **W1-26** (redefined, §3) |
| `journey.opening.legibility` | 1 | `RI-JRN09` | **W1-26** (redefined, §3) |
| `combat.exchange.reactability` | 1 | `RI-CMB12` | **W1-09** (amended, §4) |
| `combat.exchange.divergence` | 1 | `RI-CMB12` | **W1-09** (amended, §4) |

Both pairs have the same cause and it is not carelessness: **`RI-JRN09` and `RI-CMB12` were both
filed by bar critics after `PLAN.md` was written, each registered two new taxonomy paths, and
nothing in the process assigns a path an owner when an item is added.** `CORPUS-CONTRACT.md` §5
tells a critic to extend the corpus and to record that it did. It does not tell anyone to extend
the *plan*. That is the process defect behind all four, and §6 closes it.

### 2b. The promotion required by the owner's own words (1)

| Path | Was | Now | Judged by | Assigned to |
|---|---|---|---|---|
| `platform.mobile.viewport` | wave 2, no piece | **wave 1** | `RI-JRN04` | **W1-29** (new, §3) |

The owner's brief: *"I want them to work both on desktop **and** on mobile with a controller
attached — I have this one GameSir X2s Type-C Mobile Gaming [controller]."* A path that decides
whether the game renders and accepts input on the owner's named device cannot be wave 2 while the
constraint is *"the world traversable and the main quest completable from an early wave."*
`RI-JRN04` is the item that judges it and `RI-JRN04` has never been scored.

**This edit changes a `wave` field in `subsystems.json` from 2 to 1.** It is not a rename or a
renumber, it is within the append-only rule, and it is the field `PLAN.md` §4 defines as *"the
wave a builder first owns the path"* — which after this amendment is 1. Flagged for CRT.

### 2c. Paths in no piece that are correctly not in one (75)

Eighty paths sit in no `PLAN.md` piece. Seventy-five of them are **wave 2, 3 or 4 and are
supposed to be**: `PLAN.md` §6 decomposes later waves at the wave boundary, from the same `wave`
field. They are listed here so the number is not mistaken for a hole:

`render.*` 21 (w4) · `progression.*` 6 (w2/w3) · `platform.*` 6 (w2) · `combat.*` 3 (w2) ·
`quests.*` 5 (w2/w3) · `magic.*` 5 (w2) · `weapon.*` 5 (w2) · `world.*` 5 (w2/w3) ·
`experience.*` 5 (w2/w3) · `composition.*` 4 (w2) · `dialogue.*` 2 (w2/w3) · `lore.*` 2 (w3) ·
`audio.*` 2 (w3) · `crime.*` 2 (w2) · `ui.*` 1 (w3) · `process.*` 2 (w0).

### 2d. Paths no reference item judges — **none**

Six paths have no `RI-*` in their `judges:` set. **All six are judged by a doctrine document and
all six are declared as such in `INDEX.md` §3b**, which the contract permits:

`coherence.faction.crossref`, `coherence.difficulty.continuity`, `coherence.economy.balance`,
`coherence.progression.pacing` → `COHERENCE-AGENT.md` §3; `journey.process.fleet`,
`journey.process.naive` → `JOURNEY-CRITIC-FLEET.md` §1–§6.

**Corpus holes: 0.** No new reference item needs to be written to close an ownership gap. Every
gap found by this pass is a *plan* gap, which is the better of the two problems to have.

---

## 3. `W1-26` is dissolved and rebuilt — it was the worst-cut piece in the plan

`W1-26 — The first hour, as a piece in its own right` declared **eleven** `journey.*` paths: the
first launch, chargen diegesis, onboarding, the first hour's interaction and competence, an
unmarked quest, the save round trip, death and recovery, returning after a week, and two *process*
paths. That is **six separate journeys judged by six different reference items, plus two paths
that are a critic's deliverable and not a builder's**, in one piece with one builder and one
critic.

It is exactly the shape `CORPUS-CONTRACT.md` §4 was amended against. Two consequences already
happened:

1. **`W1-07` absorbed `journey.chargen.diegesis` because W1-26 did not exist**, and was thereby
   charged 45 of `RI-JRN01`'s 100 points for the Flow and Restraint blocks — which measure
   `journey.firstlaunch.flow` and `journey.onboarding.explanation`, paths it does not own. The
   bar critic found this and it is §R7 of the referral.
2. **The save round trip, death recovery and the unmarked quest each had a natural owner already
   scoring the item that judges them**, and were sitting in W1-26 instead. `W1-00`'s "Judged by"
   list already names `RI-JRN05`. `W1-13`'s already names `RI-JRN06`. `W1-18`'s already names
   `RI-JRN07` and `RI-JRN08`. **Three pieces were being scored against journey items whose journey
   path they did not declare** — `CORPUS-CONTRACT.md` §4 rule 2, three times, silently.

**Re-homing, every row justified by `judges:` and by nothing else:**

| Path | From | To | Why that piece |
|---|---|---|---|
| `journey.firstlaunch.flow` | W1-26 | **W1-26** (redefined) | `RI-JRN01` |
| `journey.chargen.diegesis` | W1-26 | **W1-26** | `RI-JRN01` |
| `journey.onboarding.explanation` | W1-26 | **W1-26** | `RI-JRN01` |
| `journey.opening.exchange` | *nowhere* | **W1-26** | `RI-JRN09` |
| `journey.opening.legibility` | *nowhere* | **W1-26** | `RI-JRN09` |
| `experience.opening.hook` | W1-25 | **W1-26** | `RI-EXP01` judges these two paths **and no others** |
| `experience.opening.beats` | W1-25 | **W1-26** | idem |
| `journey.firsthour.interaction` | W1-26 | **W1-28** (new) | `RI-JRN02` |
| `journey.firsthour.competence` | W1-26 | **W1-28** (new) | `RI-JRN02` |
| `journey.save.roundtrip` | W1-26 | **W1-00** | `RI-JRN05` judges it + `platform.save.persistence` + `platform.save.storage`, **both already W1-00's**, and `RI-JRN05` is already in W1-00's item set |
| `journey.death.recovery` | W1-26 | **W1-13** | `RI-JRN06` judges it + `combat.death.corpserun` + `combat.death.worldreset`, **both already W1-13's**, and `RI-JRN06` is already in W1-13's item set |
| `journey.quest.unmarked` | W1-26 | **W1-18** | `RI-JRN07` judges it + `quests.discovery.hooks` + `journal.navigation.nomarkers`, **both already W1-18's** |
| `journey.reentry.orientation` | W1-26 | **W1-18** | `RI-JRN08` judges it + `journal.entry.voice` + `journal.navigation.nomarkers`, **both already W1-18's** |
| `journey.process.naive` | W1-26 | **§3b, critic process** | judged by `JOURNEY-CRITIC-FLEET.md` §4. It is a rule binding the critic, not code a builder writes |
| `journey.process.fleet` | W1-26 | **§3b, critic process** | judged by `JOURNEY-CRITIC-FLEET.md` §1–3, §5, §6 |

Four of these fifteen rows required **no new piece at all** — the right owner was already scoring
the right item and had simply never declared the path. That is what a decomposition audit is
supposed to find.

---

## 4. The three new and two redefined pieces

### `W1-26` — **The opening, as a played scene** *(redefined; was "The first hour")*

The owner's first named question — *"is the new game flow good enough vs Morrowind's famously
brilliant opening scenes"* — has never had a builder. `RI-EXP01`, the corpus's only pre-existing
instrument that asks whether the opening is any good, **has never been run on any build** because
its two paths lived in the experience-instrument piece rather than in the piece that builds the
opening.

**Subsystem paths (7):** `journey.firstlaunch.flow`, `journey.chargen.diegesis`,
`journey.onboarding.explanation`, `journey.opening.exchange`, `journey.opening.legibility`,
`experience.opening.hook`, `experience.opening.beats`

**Judged by (3), by `judges:`:** `RI-JRN01`, `RI-JRN09`, `RI-EXP01`

**Cited, never scored into this piece:** `RI-PLT03` (`T_control`, `TTFP` — `platform.load.ttfp` is
W1-00's), `RI-CHR01` (the *content* of the eight inputs — `character.*` is W1-07's).

**Depends on:** W1-00 (harness), W1-07 (creation content), W1-08 (the action set), W1-04 (the
interior the scene happens in).

**Wave 1**, and not arguably otherwise: a game whose opening does not exist cannot be started.

**Measurement risk, flagged as the brief requires:** `RI-JRN01` is 33/100 `corpus_debt` until
`tools/journey/journey-run.mjs` and `beat-extract.mjs` exist, and **all five of `RI-EXP01`'s tools
are phantom** (`session-run.mjs`, `beat-diff.mjs`, `beat-extract.mjs`, `beats-from-md.mjs`,
`isolation-check.mjs`). `RI-JRN09` is runnable **today** and is by design the one instrument on
this piece that does not wait for `W1-TOOLS`. **This piece may be dispatched now**; two of its
three items will be partly `corpus_debt` until the tools land, and `RI-JRN09` will not be.

### `W1-28` — **The first hour as interaction** *(new)*

`RI-JRN02` — the verb grammar, the order verbs are acquired in, the interval between meaningful
inputs, and the point at which the player is *competent* rather than *informed* — judges these two
paths and has never been scored.

**Subsystem paths (2):** `journey.firsthour.interaction`, `journey.firsthour.competence`

**Judged by (1):** `RI-JRN02`

**Declared seam:** `RI-JRN02` also judges `input.discoverability`, which is **W1-08's**. Under
`CORPUS-CONTRACT.md` §4 rule 1 that leg is a **cross-piece coupling debt recorded at the
W1-28 ↔ W1-08 seam**, scored against W1-08 and cited by W1-28. It is not dropped.

**Depends on:** W1-08 (bindings), W1-09/W1-12 (something to be competent *at*), W1-18 (a quest to
be doing), W1-26 (the opening it begins from).

**Thin by path count, heavy by item weight** — two paths, one item, and that item owns
minutes 0–60 across every other piece. Said plainly rather than merged into W1-26 to look tidier:
`RI-JRN01` and `RI-JRN02` publish a *binding* division of labour and merging them would put one
builder on both sides of it.

**Wave 1.** `RI-EXP01` B01–B18 cannot be hit by a build where the first hour has no owner.

### `W1-29` — **Mobile, touch and the attached gamepad** *(new; split from W1-08)*

**Subsystem paths (5):** `input.gamepad.mapping`, `input.gamepad.analog`,
`input.gamepad.lifecycle`, `input.touch.fallback`, `platform.mobile.viewport` *(promoted from
wave 2, §2b)*

**Judged by (1):** `RI-JRN04`

**Declared seam:** `RI-JRN04` also judges `input.modality.parity`, kept in **W1-08** because
`RI-JRN03` owns the parity *model* and the canonical action set. Coupling debt at the
W1-29 ↔ W1-08 seam.

**Depends on:** W1-08 (the action set, which this piece consumes and may not redefine).

**Why split from W1-08 rather than left in it.** `RI-JRN03` and `RI-JRN04` publish a binding
division of labour — desktop path and action set here, gamepad and touch profile data there — and
a single builder owning both does the mobile half last and worst. That prediction is already on
disk: `platform.mobile.viewport` was filed at wave 2 while every desktop input path was filed at
wave 1, by the same taxonomy pass. The owner named one desktop and one mobile device. Two pieces.

**Wave 1**, on the owner's explicit instruction and on wide-before-deep. A journey that cannot be
completed on a gamepad alone is a hard fail in `RI-JRN04` and `RI-JRN01` HF5 — and round 2 of
`W1-07` completed **two of four** input modalities, which is how HF5 came to fire.

### `W1-08` — **Desktop controls and the action set** *(narrowed)*

**Subsystem paths (6, was 10):** `input.action.set`, `input.desktop.keyboard`,
`input.desktop.pointerlock`, `input.rebinding.model`, `input.discoverability`,
`input.modality.parity`

**Judged by (4):** `RI-JRN03`, `RI-JRN02`, `RI-JRN04`, `RI-DLG09`

**Declared seam:** `RI-JRN03` also judges `platform.input.pipeline`, which stays in **W1-00** —
W1-00 has declared and shipped it across two rounds and moving a path out from under a scored
verdict is churn with no measurement gain. Coupling debt at the W1-08 ↔ W1-00 seam.

### `W1-25` — **The experience instrument and the seam crossings** *(narrowed)*

**Subsystem paths (7, was 9):** `experience.memory.anecdote`, `experience.memory.recall`,
`experience.permissiveness.register`, `experience.permissiveness.durability`,
`experience.session.shape`, `composition.seam.crossings`, `composition.matrix.coverage`

**Judged by (4, was 5):** `RI-EXP02`, `RI-EXP03`, `RI-EXP06`, `RI-CMP01`. `RI-EXP01` moves to
W1-26 with its two paths.

---

## 5. Three amendments to pieces that already exist, each closing a §4 rule-2 defect

| Piece | Add | Item already in its set that judges it |
|---|---|---|
| **W1-00** — Harness, determinism and persistence | `journey.save.roundtrip` (7 → 8 paths) | **`RI-JRN05`**, listed in W1-00's "Judged by" since the plan was written. W1-00 owns `platform.save.persistence` and `platform.save.storage` and has shipped a save system across two rounds **without declaring the round trip** — the owner's *"does saving and loading work correctly"* has never been a declared path. |
| **W1-13** — Lethality, death and the corpse run | `journey.death.recovery` (6 → 7 paths) | **`RI-JRN06`**, already listed. W1-13 owns `combat.death.corpserun` and `combat.death.worldreset`; `RI-JRN06`'s third path was in W1-26. |
| **W1-18** — The quest engine and the journal | `journey.quest.unmarked`, `journey.reentry.orientation` (16 → 18 paths) | **`RI-JRN07`** and **`RI-JRN08`**, both already listed. W1-18 owns four of the six paths those two items judge. |
| **W1-09** — The combat core | `combat.exchange.reactability`, `combat.exchange.divergence` (28 → 30 paths) | **`RI-CMB12`**, which was *written against W1-09's three-round failure* and judges these two paths and nothing else. It has never been scored because its paths existed in no piece. |

**W1-18 is already in flight** (`orchestration/status/W1-18.json`, state `building`). Its builder
must be handed the two added paths and `RI-JRN07`/`RI-JRN08` before its verdict, or the verdict
repeats `W1-09`'s error of being scored against items whose paths it never declared.

---

## 6. The process defect that produced all four orphans, and its fix

`CORPUS-CONTRACT.md` §5 requires a critic that extends the corpus to write the item, add it to
`INDEX.md`, and record the extension. **It does not require anyone to give the item's paths an
owner.** So a new item arrives, `corpus-index.mjs` reports zero corpus holes because the path is
judged, and the path is judged by an item that no piece will ever be scored against. `RI-JRN09`
and `RI-CMB12` are both in that state today; `RI-EXP01` has been in it since wave 0.

**Proposed, as a check rather than a paragraph** — because the referral's own finding is that
*"every rule they broke was already binding, and not one of them had an instrument"*:

> **C9 — orphaned-ownership sweep.** For every canonical path with `wave == <current wave>`,
> assert that some piece in `docs/PLAN.md` §3 declares it. Report `unowned wave-N paths: K`.
> `warn` in wave 1, **`error` from wave 2**, matching C8's escalation exactly.

C9 is not written by this pass — writing it is `tools/`-owner work and `W1-TOOLS` is live. It
would have caught all four orphans the day the items were filed, and it will catch the next one.
The four are fixed in `PLAN.md` today regardless of whether C9 is built.

---

## 7. Plan-versus-verdict drift, measured

Separate from ownership, and found while measuring it: **the declared path set of a dispatched
piece routinely disagrees with its plan entry, in both directions.** This is the same defect as
the ownership gap seen from the other end — a piece that ships a path it did not declare has
escaped the item that judges it (`CORPUS-CONTRACT.md` §4 rule 2), and a piece that declares less
than the plan gives it has silently deferred the remainder.

| Piece | Claimed beyond its plan entry (plan owner) | Dropped from its plan entry |
|---|---|---|
| `W1-01` | `world.region.identity` (W1-02) | — |
| `W1-07` | `progression.level.attributes`, `progression.skill.usegrowth`, `progression.build.identity` (all W1-16); `journey.chargen.diegesis` (W1-26) | `character.race.access`, `character.race.dialogue` |
| `W1-09` | `platform.determinism.harness` (W1-00); `combat.encounter.exit` (W1-12); `combat.encounter.parley` (**no owner, wave 2**) | `combat.attack.charge`, `combat.damage.model`, `combat.damage.scaling`, `combat.heal.charges`, `combat.pause.policy` |
| `W1-10` | `weapon.feel.hitstop`, `weapon.feel.mass`, `weapon.feel.material`, `weapon.feel.whiff` (all W1-11); `combat.attack.charge` (W1-09); `weapon.class.differentiation`, `weapon.identity.withinclass`, `weapon.animation.reuse`, `weapon.context.aerial` (**no owner, wave 2**) | — |
| `W1-09-combat-core` | 19 paths under a `piece_id` that is not a piece in the plan | — |

Two things follow and neither is cosmetic:

- **Five wave-2 paths have been built and scored by wave-1 pieces.** `PLAN.md` §4 defines `wave`
  as *"the wave a builder first owns the path"*, so for those five the field is now wrong.
  Recorded in `PLAN.md` §5b; the `subsystems.json` correction is CRT's.
- **Seven paths are in a plan piece, that piece has been dispatched, and no verdict declares
  them.** `character.race.access` and `character.race.dialogue` are the sharpest:
  `RI-CHR02` judges them, `RI-CHR02` was scored into `W1-07` three times, and the two paths that
  carry *"the Argonian-in-Black-Marsh premise pays mechanically"* were never on a declared set.

This amendment does **not** rewrite the piece path lists to match the drift — a verdict's
over-declaration is not a decomposition decision. It records the drift in `PLAN.md` §5b so the
next verdict on each piece has to reconcile it.

---

## 8. What wave 1 costs after this

| | Before | After |
|---|---:|---:|
| Canonical paths | 330 | 330 |
| Wave-1 paths | 254 | **255** (+1 promoted: `platform.mobile.viewport`) |
| Wave-1 paths assigned to a piece | 250 | **255** |
| **Unowned wave-1 paths** | **4** | **0** |
| Wave-1 pieces | 28 | **30** |
| Reference items owning no wave-1 path | 14 | **12** (`RI-CMB12` and `RI-JRN09` become scoreable) |
| Pieces dispatched | 7 | 7 — **unchanged, and this is the finding** |

**Wave 1 grew by one path, two pieces, and two newly-scoreable reference items.** That is a small
number and it should not be allowed to look like the answer, because the ownership hole was never
the expensive part:

> **Twenty-three of thirty wave-1 pieces have never been dispatched, and they include every piece
> that owns a path deciding whether the game can be played at all** — the opening (`W1-26`),
> desktop controls (`W1-08`), mobile and the gamepad (`W1-29`), the first hour (`W1-28`), the
> quest engine and journal (`W1-18`, in flight), the main quest (`W1-19`), settlements (`W1-04`),
> dialogue (`W1-17`, in flight), the UI (`W1-21`), and death and the corpse run (`W1-13`).

Meanwhile `W1-01` and `W1-09` have each run four rounds and `W1-10` and `W1-14` three. **The plan
said wide before deep and the dispatch order did deep before wide.** No amendment to a path list
fixes that; only dispatching the pieces does.

**Recommended dispatch order, on wide-before-deep and on nothing else** — every one of these is a
piece a player would notice the absence of within sixty seconds of starting the game:

1. **`W1-08` + `W1-29`** — controls. Nothing else can be honestly judged on a build the critic
   cannot drive on the modalities the owner named. `RI-JRN01` HF5 is currently firing because two
   of four modalities have never been run.
2. **`W1-26`** — the opening. Runnable against `RI-JRN09` today with no tool dependency.
3. **`W1-00` round 3** — the save round trip, now declared.
4. **`W1-13`** — death and recovery, now declared.
5. **`W1-04`, `W1-21`, `W1-19`** — the settlements, the UI, and the main quest end to end.

---

## Provenance

`provenance: measured`, confidence **high** on every count.

- The 38-path family census, the single verdict-declared path, the 4 plan-orphans, the 80
  paths in no piece, the 6 doctrine-judged paths, the 14 items owning no wave-1 path, the
  79 items owning no verdict-declared path, and the full plan-versus-verdict drift table are
  **direct reads** of `corpus/00-doctrine/subsystems.json`, `docs/PLAN.md` §3 and every
  `corpus/90-verdicts/wave1/*.json`, resolved through the 226-entry alias table. Reproducible with
  `node tools/corpus-index.mjs` and the two scripts recorded in
  `orchestration/status/decomposition-architect.json`.
- The `judges:` sets driving every assignment in §3 and §5 are read from reference-item
  front-matter, **never from a directory listing** — `CORPUS-CONTRACT.md` §4 as amended.
- The dispatch counts are read from `orchestration/status/*.json` and the verdict filenames.
- The quoted owner brief is `corpus/00-doctrine/INTENT-AUDIT-CHARTER.md`.
- **No threshold, band, gate or hard fail is changed by this document.** It moves ownership only.
