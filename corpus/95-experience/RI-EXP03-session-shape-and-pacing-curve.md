---
id: RI-EXP03
title: Session shape and the twenty-hour pacing curve — including the mid-game sag
kind: graph
side: neutral
judges: [experience.session.shape, experience.session.pacing, experience.session.sag]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

A game is not experienced as a corpus of systems. It is experienced as **sittings**, and then as a
**shape made of sittings**. `RI-EXP01` owns the first sitting. This item owns every sitting after
it, and the curve they make.

Two claims, and both are measurable. The first is local: a ninety-minute sitting that is a flat
sequence of similar activities is a sitting a player does not repeat, even if every activity in it
is well built. The second is global: a twenty-hour game is not twenty good hours in a row — **both
reference games sag in the middle, badly, for hours at a time, and both survive it.** A corpus that
demands every hour be a peak specifies a game neither reference game is, and produces the flat
metronome that `SCORING.md` §2.1 calls a 5.

The interesting instrument is therefore not "is every hour good". It is: **does the sitting have an
arc, does the run have a shape, and when the shape dips — because it will — is the dip survivable
by the mechanism both reference games use?**

> One sentence a builder can aim at: **every ninety minutes must contain an intention the player
> formed, a thing that changed it, a risk, an outcome, and an unfinished thread at the stop point —
> and the hours where the main quest stops pushing must be the hours where the player has the most
> other things they could be doing.**

This item is the **shape** view. `RI-EXP04` owns the *novelty* input to the shape and is cited, not
duplicated, here; `RI-EXP02` owns whether anything in the shape was worth remembering;
`coherence.progression.pacing` owns whether power and danger are continuous across region borders,
which is a coherence question and not this item's. Where this item and `RI-EXP04` disagree about the
same hour, `CORPUS-CONTRACT` §4 precedence applies: EXP04 owns `experience.novelty.*`, EXP03 owns
`experience.session.*`.

---

## The reference artifact

### A. The six-beat session template (the local claim)

Derived from `BAR-CRITIQUE-01` §2.3's sketch and made binding here. A **session** is 90 simulated
minutes — the segment length in `PLAYTHROUGH-CRITIC.md` §5.2, chosen so that the session unit and
the memory-bottleneck unit are the same unit and cannot drift apart.

| id | Beat | What it is | How it is detected in the trace |
|---|---|---|---|
| **SS1** | **An intention is formed** | The player decides where they are going and why, and it is theirs — not read off a marker (S8). | An `intent.jsonl` line with `preregistered: true` and a destination, within the first 12 min of the segment |
| **SS2** | **An interruption** | Something the player did not choose happens on the way. Not a random spawn: an authored encounter, an NPC, a world event, a lethality surprise. | An authored `events[]` entry ≥ 40 m off the preregistered route, or a `death` before the destination |
| **SS3** | **A discovery that changes the intention** | The player learns something and *revises the plan*. This is the beat that separates a world from a corridor. | An `intent.jsonl` line whose `intent` differs from the previous line, with an intervening `topic`/`journal`/`item`/`load` event it cites |
| **SS4** | **A risk taken** | A choice made under uncertainty with a real downside: an unlit route, a fight above tier, a lie told, gold spent that cannot be recovered. | A frame window whose `player.hp` drops below 40%, or a `topic` flagged `refused`-adjacent, or a gold delta ≥ 25% of holdings |
| **SS5** | **A resolution or a memorable failure** | The session produces an outcome. A failure counts — a *repeated* failure with no progress does not. | A `quest_stage` advance, a boss `death` (either owner), a `journal` entry, **or** a `death` followed by a retry that reached further than the previous attempt |
| **SS6** | **A reason to start the next session** | An unfinished thread exists at the stop point, and the player knows what it is. | ≥ 1 active quest with a stage the player has read, or an `intent.jsonl` line at `END` naming an unreached destination |

`session_beats_present` = count of SS1–SS6 detected. **Bar: ≥ 5 of 6, in ≥ 2 of every 3 consecutive
sessions.** A session missing SS3 is the diagnostic case and is called out separately as
`corridor_sessions` — a session in which the player's plan was never changed by the world is a
session in which the world was scenery.

**The stop point is a measurement, not a convenience** (`PLAYTHROUGH-CRITIC.md` §4.2, V4). The
segment agent preregisters where it intends to stop at least 3 minutes before stopping. A stop point
chosen because the clock ran out is recorded as `stop_kind: "budget"`; a stop point chosen because
the agent reached a place it wanted to stop is `stop_kind: "chosen"`. Both are legal; the *ratio* is
the finding.

### B. The activity histogram — the closed class list

Every simulated frame is assigned exactly one activity class. Classes are derived from the trace, not
declared by anyone.

| Class | Definition from `elder-souls/trace@1` |
|---|---|
| `FIGHT` | any enemy in `enemies[]` with `alert_state == "AGGRO"` and `dist_m ≤ 30`, or the player in `ATTACK`/`ROLL`/`BLOCK` state |
| `TRANSIT` | `input.move` non-zero, no AGGRO enemy, player position advancing along a road/boardwalk/travel-network segment |
| `EXPLORE` | `input.move` non-zero, no AGGRO enemy, **off** the road network, or inside an interior whose `load` is its first ever |
| `TALK` | inside a `topic` event window (first `topic` to last `topic` + 5 s) |
| `READ` | inside a `book_read` window (**needs amendment `A-EXP2`**) |
| `TRADE` | inside a `barter_open` → `barter_close` window (`A-EXP2`) |
| `CRAFT` | inside a `craft` window — alchemy, enchanting, repair (`A-EXP2`) |
| `MENU` | inside a `menu_open` → `menu_close` window (`A-EXP2`) |
| `REST` | `bonfire_rest`, `level_up`, and the frames between them |
| `TRAVEL_NODE` | inside a `travel_node` window — the S7 diegetic network in motion (`A-EXP2`) |
| `DEAD` | between a `death` event with `owner == "player"` and the next `load` |
| `IDLE` | none of the above |

**Amendment `A-EXP2` (to be appended to `HARNESS.md` §10, required by this item and `RI-CMP02`).**
Extend the `events[]` closed vocabulary with: `book_read`, `barter_open`, `barter_close`,
`menu_open`, `menu_close`, `craft`, `parley`, `crime_witnessed`, `travel_node`, `first_visit`.
No new gameplay surface; each is an observation of a thing the game already does. Until `A-EXP2`
lands, `READ`/`TRADE`/`CRAFT`/`MENU`/`TRAVEL_NODE` are **`unmeasurable` ⇒ 0** for their checks and
the classes collapse into `IDLE`, which fails this item's `idle_fraction` bar — fail-closed, as
`CRITIC-DOCTRINE` §7.3 requires. That is deliberate: an unobservable menu is an unbounded menu.

### C. Reference shape — Morrowind, ~20 h main-quest-and-a-guild run (canonical-recall)

**These fractions are estimates from memory of how the game plays, not measurements, and no critic
may cite them as measured.** What is *not* soft is the qualitative shape: the direction of each
curve, and the position and cause of the sag. Both are the binding part.

| Hour | Dominant activity | Est. `FIGHT` | Est. `TRANSIT`+`EXPLORE` | Est. `TALK`+`READ` | What is happening |
|---|---|---|---|---|---|
| 1 | arrival | .12 | .48 | .28 | Seyda Neen; the census; the road to Balmora |
| 2–3 | errands | .20 | .45 | .25 | Caius' small jobs; the town becomes legible |
| 4–6 | guild work | .30 | .40 | .20 | Fighters/Mages/Thieves lines; the first caves |
| **7–12** | **the informants** | **.18** | **.44** | **.30** | **Act II. Read four people's books. Walk a lot. Nothing escalates.** |
| 13–14 | the Sixth House base | .38 | .32 | .20 | The first real horror set-piece |
| 15–16 | corprus / Tel Fyr | .22 | .34 | .36 | **The largest single revelation in the game** |
| 17–18 | the Ashlanders, the trials | .24 | .38 | .30 | The prophecy is re-read as politics |
| 19–20 | Red Mountain | .46 | .28 | .18 | The approach, and a conversation |

**The sag is hours 7–12** and it is roughly a third of the run. It is a *reading* act: four
informants, a citadel of books, and a main quest that keeps telling you to come back later.

### D. Reference shape — Dark Souls, ~20 h first playthrough (canonical-recall)

| Hour | Dominant activity | Est. `FIGHT` | Est. `TRANSIT`+`EXPLORE` | Est. `TALK` | What is happening |
|---|---|---|---|---|---|
| 1 | asylum + Firelink | .35 | .45 | .12 | Three directions, two lethal |
| 2–4 | Burg, Parish, Depths | .48 | .38 | .06 | The loop; the first shortcuts |
| 5–7 | Blighttown, Quelaag | .44 | .42 | .04 | The descent; the worst traversal in the game |
| 8–10 | Sen's, Anor Londo | .50 | .38 | .06 | **The peak.** The world opens vertically |
| **11–16** | **the four Lord Souls** | **.52** | **.34** | **.04** | **The sag. Four parallel routes of visibly lower quality, chosen in any order.** |
| 17–18 | New Londo / optional | .46 | .36 | .06 | Sif, the Four Kings, the ash lake |
| 19–20 | the Kiln, Gwyn | .58 | .28 | .04 | Short, and quiet |

**The sag is hours 11–16** — Lost Izalith, the Demon Ruins, the Tomb of the Giants, Duke's Archives
— and it is the most consistently criticised stretch of one of the most admired games ever made.
Twenty years of players know it sags. They still finish it.

### E. Why the sag happens, and the two survival mechanisms (the derivation — this is the binding part)

The sag has the same cause in both games and it is structural, not a failure of effort:
**the mid-game is where the main quest stops being able to escalate and has not yet begun to
converge.** Act II of a five-act structure has to distribute information; the player has enough
power to be safe and not enough context to be urgent; the world has already shown its opening
vocabulary and has not yet shown its final one. Every long RPG has this hour. Ours will too.

Both reference games survive it by the **same two mechanisms**, and neither is "make the sag better":

| # | Mechanism | Morrowind | Dark Souls |
|---|---|---|---|
| **SAGSURV-1** | **The main quest hands over the wheel, explicitly.** In the sag the main quest stops pushing and the *player* becomes the source of the next intention. | Caius literally instructs the player to go join a guild and come back. Act II's four informants may be visited in any order, over any span. | The Lordvessel opens four routes simultaneously with no ordering and no urgency. |
| **SAGSURV-2** | **The maximum number of other threads is open at exactly this point.** The sag is not empty; it is *wide*. | Every guild line, the Great Houses, the Temple pilgrimages and hundreds of side quests are all available and mostly unstarted at hour 7. | Every covenant, every optional area, Sif, the Four Kings, the DLC-adjacent depths, PvP, and the whole shortcut network are open. |

Two secondary mechanisms matter and are worth naming because they are cheap:

- **SAGSURV-3 — travel is cheapest in the sag.** By hour 7 the player has walked the routes, so the
  S7 network is maximally open and the same distance costs a fraction of the time. The sag is when
  the world becomes *convenient*, which is a reward for the first six hours.
- **SAGSURV-4 — the sag ends in the run's largest revelation.** Morrowind's sag terminates in
  corprus and Tel Fyr; Dark Souls' terminates in the Kiln. The dip is paid off immediately by the
  peak, and in retrospect the sag reads as the climb.

**The failure that kills a game is not the sag. It is a sag in which the main quest is still the only
thing to do.** That is the state this item's hard fail exists for.

### F. OUR required shape (binding)

Twenty hours. Five acts per `RI-QST06`. Hours are **simulated** hours from the concatenated session
chain, not wall-clock.

**F.1 — Per-hour activity bands.** Each is a band on the hour's frame fractions, not a target.

| Class | Per-hour band | Absolute per-hour limits | Run-wide |
|---|---|---|---|
| `FIGHT` | 0.18 – 0.45 | never > 0.60, never < 0.08 | mean 0.22 – 0.38 |
| `TRANSIT` | 0.10 – 0.30 | **never > 0.35** | mean ≤ 0.28 |
| `EXPLORE` | 0.15 – 0.40 | never < 0.08 | mean ≥ 0.20 |
| `TALK` + `READ` | 0.10 – 0.35 | never < 0.04 | mean ≥ 0.15 |
| `MENU` | — | **never > 0.08** | mean ≤ 0.05 |
| `TRADE` + `CRAFT` | 0.01 – 0.12 | — | mean ≥ 0.03 |
| `TRAVEL_NODE` | 0.00 – 0.10 | — | — |
| `DEAD` + corpse-run | 0.02 – 0.15 | never 0.00 in any 3-hour window | — |
| `IDLE` | — | **never > 0.10** | — |

`TRANSIT` is capped and `EXPLORE` is floored on purpose. They look similar in a trace and they are
opposites: transit is the road you already know, exploration is the ground you do not. `S17`
forbids inflating the hour by slowing the player down; this pair of bands forbids inflating it by
lengthening the road.

**F.2 — Shape invariants across the run** (these are what makes it a shape and not a mean):

| id | Invariant | Bar |
|---|---|---|
| **SH1** | `FIGHT` fraction is **not monotonic**. The run has at least 2 local maxima and 2 local minima with amplitude ≥ 0.10. | ≥ 2 of each |
| **SH2** | The single highest `FIGHT` hour is in the **last 15%** of the run (hour 18–20). | true |
| **SH3** | The single highest `TALK`+`READ` hour is **not** in the first 3 hours and **not** in the last 2. | true |
| **SH4** | Activity-class entropy per hour, `H(hour)`, never falls below **1.6 bits** in any hour after hour 1. An hour that is 90% one class is an hour of grinding. | min ≥ 1.6 bits |
| **SH5** | `EXPLORE` fraction in the final 3 hours ≥ 0.10. The endgame is not a corridor. | ≥ 0.10 |
| **SH6** | Between any two consecutive hours, no class changes by more than 0.30 absolute. Cliffs are `coherence.progression.pacing`'s and are **referred**, not scored here. | referral, not a score |

**F.3 — The sag contract (the flagship of this item).**

`sag_window` := the contiguous 2–4 hour window, wholly inside hours 6–16, minimising the composite
`C(h) = 0.4·novelty_z(h) + 0.3·stakes_z(h) + 0.3·outcome_variety_z(h)`, where `novelty_z` is
`RI-EXP04`'s per-hour first-time rate, `stakes_z` is `RI-QST06`'s act stakes value at that hour, and
`outcome_variety_z` is `PLAYTHROUGH-CRITIC.md` §4.3's S3, each z-scored over the run.

**The sag is permitted. It is not permitted to be empty, and it is not permitted to be narrow.**

| id | Sag rule | Bar | Fail |
|---|---|---|---|
| **SAG-1** | **Depth is bounded.** `min C(h)` over the sag ≥ 0.55 × the run median `C`. | ≥ 0.55 | < 0.40 |
| **SAG-2** | **Width — the wheel is handed over.** Simultaneously available, player-selectable, un-started threads (quests with a known giver or a read journal direction) during **every** sag hour. This is SAGSURV-2 and it is the number the whole contract turns on. | ≥ 6 | ≤ 2 |
| **SAG-3** | **The main quest stops pushing.** No main-quest stage inside the sag window may carry a timer, a forced sequence, or a journal direction that names only one place. Per `RI-QST06`, Act II is simultaneous. | 0 violations | ≥ 1 |
| **SAG-4** | **Firsts do not stop.** No 90-minute window inside the sag with zero first-time events (`RI-EXP04`'s hard fail, restated so it binds here too). | 0 empty windows | ≥ 1 |
| **SAG-5** | **Travel is cheapest here.** Median `TRANSIT` minutes per kilometre of objective-distance in the sag ≤ 0.70 × the same figure in hours 1–5 (SAGSURV-3). | ≤ 0.70 | > 1.00 |
| **SAG-6** | **The sag terminates in the run's largest revelation.** The hour with the maximum `RI-EXP04` novelty *weight* (not rate) is within 3 hours of the sag's end — the Act III irreversible personal cost (SAGSURV-4). | ≤ 3 h | > 6 h |
| **SAG-7** | **Length is bounded.** The sag window is ≤ 4 h and the run contains exactly one. Two disjoint windows both satisfying SAG-1's depth is a different finding: the run has no shape. | 1 window, ≤ 4 h | ≥ 2 windows |

**F.4 — Derived session metrics** (per session; the critic computes these, §A is how a builder hits them):

| Metric | Definition | Bar | Fail |
|---|---|---|---|
| `session_beats_present` | SS1–SS6 detected | ≥ 5/6 in ≥ 2 of 3 | ≤ 3/6 in a majority |
| `corridor_sessions` | sessions with no SS3 | ≤ 1 in 13 | ≥ 4 in 13 |
| `intention_changes` | distinct `intent.jsonl` revisions caused by an encountered thing (S4) | ≥ 2 per session | ≤ 0 in ≥ 3 sessions |
| `transit_fraction` | `TRANSIT` frames / session frames | ≤ 0.30 | > 0.40 |
| `menu_fraction` | `MENU` frames / session frames | ≤ 0.08 | > 0.15 |
| `unfinished_thread_at_stop` | sessions ending with a named unreached thread | **every session** | ≥ 2 without |
| `chosen_stop_fraction` | `stop_kind == "chosen"` / all stops | ≥ 0.50 | ≤ 0.15 |
| `longest_silence_min` | S6 — longest window with no authored event of any class | ≤ 9 min | > 20 min |
| `hour_entropy_min` | min `H(hour)` after hour 1 | ≥ 1.6 bits | < 1.1 bits |

---

## Comparison method

Executable against the real harness (`HARNESS.md` §3) plus amendments `A-EXP1`
(`PLAYTHROUGH-CRITIC.md` §5.1) and `A-EXP2` (§B above).

**Step 0 — the chain.** The playthrough is the tier-appropriate chain from
`PLAYTHROUGH-CRITIC.md` §3 (FULL = 20 h ≈ 13 segments). This item **does not commission its own
playthrough**; it reads the one the role already ran. If the chain is shorter than the declared
tier, this item scores against the tier actually achieved and the shortfall is reported against the
wave, not absorbed.

```bash
node tools/experience/session-run.mjs --session exp-w<N>-s01 --brief <brief> --seed <n> --minutes 90
node tools/experience/log-lint.mjs   --in reports/sessions/exp-w<N>-s01     # must exit 0
# … --resume state-out.json, one fresh agent per segment, per PLAYTHROUGH-CRITIC §5.2 …
```

**Step 1 — histograms.**

```bash
node tools/experience/event-histogram.mjs \
  --chain reports/sessions/exp-w<N>-s01..s13 \
  --classes corpus/95-experience/RI-EXP03.classes.json \
  --out reports/experience/w<N>/event-histogram.json
```

Emits, per simulated hour: frame counts per class, fractions, `H(hour)` in bits, the road-network
membership fraction that separates `TRANSIT` from `EXPLORE`, and `integrity.unclassified_fraction`.
**`unclassified_fraction > 0.05` voids the histogram** — a fifth of the run in an unnamed state is
not a measurement. `RI-EXP03.classes.json` is generated from §B by
`tools/experience/classes-from-md.mjs` so the file and this document cannot drift.

**Step 2 — session beat annotation.** `tools/experience/session-beats.mjs` proposes SS1–SS6 hits
from the trace + `intent.jsonl` signatures in §A and emits candidates with evidence line numbers.
**A candidate is not a hit until a judging agent confirms it**, and per `PLAYTHROUGH-CRITIC.md` §8
that agent **did not play any segment it annotates** and is not shown this item's thresholds. Its
prompt is committed. Isolation level recorded per `§5.5`; `attested` caps this item at 6.

**Step 3 — the sag.** `tools/experience/sag-fit.mjs --histogram … --novelty
reports/experience/w<N>/novelty-curve.json --quests game/data/quests` computes `C(h)`, locates
`sag_window`, and evaluates SAG-1…SAG-7. `SAG-2`'s open-thread count is computed **from the trace's
knowledge state, not from the quest files**: a thread counts as available only if the player has met
its giver or read a journal direction naming it. This is the difference between "the game contains
40 quests" and "the player had 6 things they could do", and it is the whole point of the number.

**Step 4 — the shape.** `tools/experience/shape-check.mjs` evaluates SH1–SH6 and F.1's bands, and
emits `shape.json` with per-hour rows and per-invariant pass/fail. SH6 violations are written to
`referred_to_coherence[]` and **may not move any number in this item's score** (`PLAYTHROUGH-CRITIC`
§1).

**Step 5 — the blind pair (`blind_pair: yes`).** A *different* agent
(`CRITIC-DOCTRINE` §5, `RI-MTH03`) strips three 20-hour shapes to a common form — per-hour class
fractions, entropy, and the SS1–SS6 boolean grid, with no proper nouns, no game names, no axis
labels beyond the class names — and presents them unlabelled: ours, the §C Morrowind reconstruction,
the §D Dark Souls reconstruction. The judge is asked, **before the reveal**: *(a)* which of these
three is a shape and which is a schedule; *(b)* for each, point at the sag and say how the run
survived it; *(c)* rank them. Record blind pick, rationale, reveal. Per `CORPUS-CONTRACT` §6 and
`CRITIC-DOCTRINE` §2.5, **ours ranking first is a signal to distrust the pack** and re-run with a
harsher stripper — it is not a pass condition, and this item does not repeat `RI-DLG07`'s W3 mistake.
The scored outputs are `judge_located_our_sag` and `judge_named_our_survival_mechanism`.

**Step 6 — the sabotage control (mandatory, `PLAYTHROUGH-CRITIC.md` §4.5).** This item is the one
**SAB-E (encounters cloned)** must detect: the orchestrator replaces every encounter with the modal
encounter at that difficulty tier, from the same commit, by data filter. Two matched 90-minute
segments (same seed, same start state, same brief), labelled A/B by a recorded coin flip. The critic
states which is sabotaged and **how it knew, before the reveal**. Required margin:
**activity-class entropy `H` lower in the sabotaged variant by ≥ 50%**, and `session_beats_present`
lower by ≥ 2. If the battery cannot separate them at that margin, this item is **`VOID`, not
`FAIL`** — a broken instrument does not get to produce a score.

**Step 7 — the negative artifact.** For every invariant scored `false`, `shape.json` carries the
computation that would have found it and its output (`PLAYTHROUGH-CRITIC.md` §6). "SAG-2 was not
checked" is not a finding; "SAG-2 = 1 open thread at hour 9, computed from 31 topics known and 1
journal direction read" is.

---

## Scoring

Native scale 0–100, translated per `SCORING.md` §1.2.

| Component | Weight | Full marks |
|---|---|---|
| Session arc (`session_beats_present`, `corridor_sessions`, `intention_changes`) | 25 | ≥5/6 in ≥2 of 3, ≤1 corridor session, ≥2 revisions/session |
| Activity bands (F.1) | 15 | every hour inside every band |
| Shape invariants (SH1–SH5) | 15 | all five |
| **The sag contract (SAG-1…SAG-7)** | **25** | all seven |
| Stop points (`unfinished_thread_at_stop`, `chosen_stop_fraction`) | 10 | thread at every stop, ≥50% chosen |
| Silence and entropy (`longest_silence_min`, `hour_entropy_min`) | 10 | ≤9 min, ≥1.6 bits |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 85 | Meets the bar | 8 |
| 70–84 | Below bar — named remedy required | 6 |
| 50–69 | Loses outright | 4 |
| < 50 | We lose | 2 |

**Native → ladder anchors (`SCORING.md` W7 discipline):** native 55 → ladder 4; native 75 → ladder 6;
native 88 → ladder 8. Ladder 9–10 additionally requires step 5 producing
`judge_located_our_sag = true` **and** `judge_named_our_survival_mechanism = true` against the
reference shapes — i.e. our sag reads as a designed act rather than as a hole.

**Tier scaling.** At `FRAGMENT` (3 h) the sag contract is `unmeasurable ⇒ 0` for its weight and the
item's ceiling is 6, because a three-hour run cannot have a mid-game. At `PARTIAL` (8 h) SAG-1,
SAG-2, SAG-3 and SAG-4 apply and SAG-5/6/7 are `unmeasurable ⇒ 0`. Only `FULL` scores the whole item.
A critic that scores the sag contract on a `FRAGMENT` run has fabricated it.

**Hard fails — any one caps the item at 2:**

1. **A sag in which the main quest is the only available thread.** `SAG-2 ≤ 2` open threads in any
   sag hour. This is the specific failure both reference games avoid and the reason this item exists.
2. **`transit_fraction > 0.40`** in the median session, or run-mean `TRANSIT` > 0.35. The hour comes
   from distance and incident, never from road (`S17`).
3. **`menu_fraction > 0.15`** in the median session. A build where a seventh of play is inventory
   management has a different problem than pacing and this is where it surfaces.
4. **`unfinished_thread_at_stop` false for ≥ 2 sessions.** Sessions that end complete are sessions
   that end.
5. **Any hour after hour 1 with `H(hour) < 1.1 bits`.** An hour that is one activity.
6. **`corridor_sessions ≥ 4` of 13** — the world never changed the player's plan, four times over.
7. **The histogram could not be produced**, or `unclassified_fraction > 0.05`, or `A-EXP2` is absent
   so half the classes collapse into `IDLE` — `unmeasurable ⇒ 0`, fail-closed. Not an excuse.
8. **The sabotage control was not run, or failed to separate at the stated margin** ⇒ **`VOID`**,
   not a low score.

---

## How we lose

- **We delete the sag instead of surviving it.** The most likely reaction to this item is to try to
  make hours 7–14 as dense as hours 1–3. That produces the flat metronome: twenty hours of peaks is
  twenty hours of no peaks, and it costs the run its shape (SH1) and the payoff of SAG-6. The sag
  contract is deliberately a *width* requirement and not a *depth* requirement for exactly this
  reason — the fix for a sag is more open threads, never more explosions.
- **`SAG-2` is satisfied from the quest files.** Somebody counts 40 authored quests, declares 40 open
  threads, and the number passes while the player at hour 9 has one journal direction and no idea
  what else exists. The trace-knowledge-state rule in step 3 exists solely for this, and it is the
  single most gameable number in the item.
- **`TRANSIT` is inflated to hit the hour.** `RI-WLD01` needs an hour to cross the world; the
  cheapest way to get one is a longer road. Then `transit_fraction` climbs, `EXPLORE` falls, and the
  world is a commute. `S17` already forbids the other cheap version (slowing the player down); this
  item's `TRANSIT ≤ 0.35` cap forbids this one.
- **The session beats are annotated by the agent that played.** SS3 in particular is a judgement
  about *why* an intention changed, and the agent that changed it will always say the world did it.
  Step 2's separation is not ceremony.
- **`unfinished_thread_at_stop` becomes a rule the driver enforces.** Somebody makes the session
  driver refuse to stop unless a thread is open. The metric then measures the driver. The stop point
  must remain a decision the agent preregisters and may get wrong.
- **Menus grow because they are where the build is legible.** Alchemy, enchanting, spell-making and
  equip-load are all real Morrowind systems and all of them live in menus. `MENU` capped at 0.08
  against `CRAFT` floored at 0.03 is the shape of the compromise: crafting is play, browsing is not,
  and a build that cannot tell them apart in the trace has built the wrong crafting system.
- **The histogram passes and hour ten is still dead.** Fractions can be right while nothing happens —
  this is `PLAYTHROUGH-CRITIC.md` §4.3's asymmetry, restated: the absence of shape proves deadness;
  the presence of shape proves nothing. That is why `longest_silence_min` (S6) is in the score, why
  `RI-EXP02`'s anecdote rate is a separate item, and why both must be read together before any
  claim is made about hour ten.
- **Nobody runs the twenty hours.** Then `FRAGMENT` tier is declared, the sag contract goes
  `unmeasurable ⇒ 0`, the item ceiling is 6, and the wave carries an unmeasured mid-game into ship.
  This is the same failure `RI-EXP02` names and it is the most likely one here too.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

§A (the six-beat template) is `constructed`, derived from `BAR-CRITIQUE-01` §2.3's sketch and given
trace signatures here. The signatures are the arguable part: SS4 in particular ("a risk taken") is
operationalised as an HP drop, a refusal, or a large gold delta, and a critic could reasonably argue
that a risk the player took and *did not suffer for* is invisible to all three. It is. That is a
known blind spot and it is why SS4 carries no independent hard fail.

§B's class list is `constructed` and depends on amendment `A-EXP2`, which does not exist yet. This
item names the amendment rather than assuming it, and fails closed until it lands.

**§C and §D are the untrustworthy part and are labelled as such.** The per-hour fractions are
*reconstructions from memory of how those games play*, not measurements — no instrumented trace of a
2002 or 2011 game exists in this project and none could be produced here. **No critic may cite the
numbers in §C or §D as measured, in any verdict, ever.** What is well supported, and what the item
actually rests on, is the *qualitative* claim: that Morrowind's Act II informant stretch and Dark
Souls' post-Lordvessel four-route stretch are (a) real, (b) widely and independently described as the
weakest parts of both games, and (c) survived rather than fixed. That claim is `canonical-recall` at
`confidence: high` — the post-Lordvessel decline in Dark Souls and the mid-game reading act in
Morrowind are among the most consistently reported observations about either game.

§E (the two survival mechanisms) is a **derivation, and derivations are arguable.** The claim that
SAGSURV-1 and SAGSURV-2 are the *same* mechanism in both games fuses "Caius tells you to go away"
with "the Lordvessel opens four doors", and a critic who thinks that fusion is wrong should file an
amendment rather than score around it. The counter-argument worth stating: Dark Souls' sag may be
survived instead by *sunk cost and difficulty*, not by width — players finish Lost Izalith because
they have 15 hours invested, not because they had six other things to do. If that is right, SAG-2 is
measuring the wrong thing and the item needs a second survival mechanism. The sabotage control in
step 6 is the only route to settling it empirically, and until it has run at least once this item
carries `calibrated: false` in the verdict and **may not exceed ladder 6**.

§F is `constructed`: our bands, our invariants, our sag contract. Binding anyway per
`CORPUS-CONTRACT` §3 — a constructed bar we can measure beats a recalled number we cannot. The
weakest numbers in it are the band edges (`FIGHT` 0.18–0.45, `TRANSIT` ≤ 0.35, `H ≥ 1.6 bits`);
they are asserted, they are round, and they should be re-derived from the first `FULL` run's own
distribution once one exists, at which point this note is the record of what they were before.
