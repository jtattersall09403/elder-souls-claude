---
id: RI-JRN02
title: The first hour as interaction — what the hands do, and when the player becomes competent
kind: structure
side: neutral
judges: [journey.firsthour.interaction, journey.firsthour.competence, input.discoverability]
provenance: constructed
confidence: high
blind_pair: yes
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding, and it is strict here because the overlap is total:**
> `RI-EXP01` (95-experience) owns the **beats** of the first hour — B01–B18, the eleven shared
> structural beats, and every derived target `T_choice`, `T_found`, `T_death`, `T_odd`,
> `T_refusal`, `T_lie`, `N_odd`, `N_persons`, `N_found`, `beats_hit`, `order_violations`,
> `tutorial_text_chars`. **This item never restates one of those numbers and never redefines
> one.** `RI-EXP01` itself says so: *"the interaction view … belongs to `RI-JRN01` and
> `RI-JRN02` and is cited, not duplicated, here."*
> **`RI-JRN01` owns the first ~15 minutes** as a chain of screens and states, stopping at the
> first meaningful choice. **This item owns minutes 0–60 as a chain of *inputs*** — the verb
> grammar, the order verbs are acquired in, the interval between meaningful inputs, and the
> point at which the player is *competent* rather than merely *informed*.
> **`RI-JRN03`/`RI-JRN04` own the bindings**; this item owns which verbs are *exercised* and
> *when*. **`RI-JRN06` owns death and recovery** as a loop; this item owns only the first death
> as an interaction event.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A first hour can hit every beat in `RI-EXP01` and still be a bad hour, because a beat sheet
does not say what the player's hands were doing between beats. Morrowind's first hour is
famously *slow*, and it survives being slow for one reason: **the interval between things the
player chooses to do is short even when the interval between things that happen to them is
long.** You are always picking something up, reading something, asking someone about a word, or
deciding whether to walk around the water. Dark Souls' first hour is the opposite shape — fewer
verbs, exercised harder — and it survives for the mirror reason: **by minute twenty you are
*good* at the three verbs you have.**

The bar is both, and stated as a measurement: **by minute 60 the player has exercised ≥ 11 of
the 14 canonical actions, has repeated each of the five core combat verbs enough to have
visibly improved at it, has never gone longer than 45 seconds without an input that changed
world state, and could not name a single moment where they knew what they wanted to do and the
interface would not let them do it.**

The negative bar, which is the one this item exists to enforce: **an hour that is 90% walking
and dialogue is a Morrowind homage that has forgotten it also has to be Dark Souls, and an hour
that is 90% combat is the reverse.** Both are common. Both pass every other item in the corpus.

## The reference artifact

### A. The verb ledger (BINDING)

The fourteen canonical actions (`RI-JRN03` §A) plus the eight non-combat verbs the Morrowind
half requires. **`first_use` is the latest minute by which the verb must have been *exercised
by the player*, not demonstrated to them.**

| Verb | Action / system | `first_use` ≤ | Min. repetitions by 60′ | Taught by |
|---|---|---|---|---|
| move | — | 0:01 | continuous | nothing |
| look | — | 0:01 | continuous | nothing |
| `interact` | — | **0:03** | ≥ 25 | placement (a door you must open) |
| take | `interact` on an item | **0:06** | ≥ 12 | `RI-EXP01` B04 |
| talk | `interact` on an NPC | **0:04** | ≥ 9 distinct NPCs | placement |
| read | `interact` on a readable | **0:09** | ≥ 5 | `RI-EXP01` B09 |
| `light` | — | **0:19** | ≥ 40 | inscription (`RI-JRN03` DS2) |
| `roll` | — | **0:19** | ≥ 25 | inscription + consequence |
| `block` | — | **0:21** | ≥ 15 | consequence (an attack you cannot outrun) |
| `sprint` | — | **0:12** | ≥ 20 | distance |
| `lock_on` | — | **0:22** | ≥ 8 | a second enemy |
| `use_item` | — | **0:24** | ≥ 4 | low health |
| `heavy` | — | **0:26** | ≥ 8 | a poise-heavy target |
| `parry` | — | **0:45** *(may be later)* | ≥ 1 | inscription, optional |
| `jump` | — | **0:30** | ≥ 3 | a gap |
| `two_hand` | — | 0:60 *(optional)* | ≥ 0 | — |
| `swap_left/right` | — | **0:35** | ≥ 2 | a second weapon |
| `menu` | — | **0:15** | ≥ 5 | inventory pressure |
| search | container/corpse | **0:25** | ≥ 6 | `RI-EXP01` B10 |
| barter | dialogue service | **0:33** | ≥ 1 | gold + a merchant |
| ask-about-topic | dialogue keyword | **0:05** | ≥ 20 distinct topics | a hyperlinked word |
| rest | HEARTH | **0:20** | ≥ 2 | damage |
| pay | transport / bribe | **0:38** | ≥ 1 | `RI-EXP01` B14 |
| sneak | — | 0:60 *(optional)* | ≥ 0 | — |
| pick/open a lock | — | 0:60 *(optional)* | ≥ 0 | — |
| die | — | 0:18–0:32 | ≥ 1 | `RI-EXP01` `T_death` (**cited, not restated**) |

**Rule V1 — `V_exercised` ≥ 11 of the 14 canonical actions by minute 60.** `RI-EXP01`'s
`V_taught ≥ 7` counts a broader verb list at a lower bar; this item's number is over the closed
action set and is stricter on purpose. They are different measurements and both must pass.

**Rule V2 — no verb is introduced by text.** Every `Taught by` cell is placement, consequence
or an in-world inscription (`RI-JRN03` §F). A verb whose first use was prompted by an
instruction string counts as **not taught** for V1.

**Rule V3 — the combat verbs arrive in order and by necessity.** `light` → `roll` → `block` →
`lock_on` → `use_item` → `heavy`. Each is introduced by an encounter that is survivable without
it and *comfortable* with it. An encounter that is unwinnable without an unlearned verb is a
wall; an encounter that never needs the verb is a reason not to learn it.

### B. The interaction cadence (BINDING)

| Id | Quantity | Definition | Target | Fail |
|---|---|---|---|---|
| **C1** | `gap_max` | Longest interval in the hour with **no** player input that changed world state (a state-changing input = an action that moved an entity, opened a surface, changed a flag, dealt or took damage, or added a journal entry). Pure locomotion does not count | ≤ **45 s** | > 90 s |
| **C2** | `gap_p95` | 95th percentile of the same interval | ≤ **20 s** | > 40 s |
| **C3** | `apm_nc` | State-changing inputs per minute, outside combat | 4–14 | < 2 or > 25 |
| **C4** | `apm_c` | Inputs per minute inside combat | ≥ 45 | < 30 |
| **C5** | `combat_fraction` | Fraction of the hour with any hostile in `AGGRO` | **0.12–0.30** | < 0.08 or > 0.45 |
| **C6** | `dialogue_fraction` | Fraction of the hour with a dialogue surface open | **0.10–0.25** | < 0.05 or > 0.35 |
| **C7** | `traversal_fraction` | Fraction with locomotion and nothing else | ≤ **0.35** | > 0.50 |
| **C8** | `menu_fraction` | Fraction with any menu/inventory surface open | ≤ **0.08** | > 0.15 |
| **C9** | `longest_corridor` | Longest continuous stretch with no interactable, no NPC, no enemy and no readable within 15 m | ≤ **60 s** of walking | > 120 s |
| **C10** | `input_variety_10min` | Distinct actions used in each rolling 10-minute window | ≥ **5** in every window | ≤ 3 in any window |

C5/C6/C7 together are the arbitration balance made numeric. **A build at `combat_fraction`
0.05 has built Morrowind and called it Souls; a build at 0.50 has built Souls and called it
Morrowind.** Neither is caught by any per-subsystem item, because each subsystem is fine.

### C. The competence curve (BINDING) — the thing that is never measured

Beats measure what happened. Cadence measures how busy the player was. Neither measures whether
the player got **better**, and getting better is the entire promise of the Souls half.

**Definition.** Take the first hostile encounter after minute 18 (`E_first`) and the encounter
closest to minute 55 (`E_late`), matched for enemy archetype and count. For each, from the
trace:

| Id | Metric | Definition |
|---|---|---|
| **K1** | `hit_taken_rate` | damage events on the player per 60 s of `COMBAT` |
| **K2** | `roll_efficiency` | fraction of rolls whose i-frame window overlapped an incoming active hitbox |
| **K3** | `stamina_floor` | fraction of combat frames at stamina < 10% (panic indicator) |
| **K4** | `whiff_rate` | attacks whose active window contained no hurtbox |
| **K5** | `block_timing` | fraction of blocked hits where `block` was pressed **after** the enemy's windup began (reactive) rather than held pre-emptively |
| **K6** | `heal_read` | heals begun inside an enemy punish window (`RI-AI03`) — a *negative* competence signal |

**Requirement.** `E_late` must be better than `E_first` on **≥ 4 of 6**, with `roll_efficiency`
improved by **≥ 0.15 absolute** and `hit_taken_rate` reduced by **≥ 30%**, **using the same
agent, the same character build, and no equipment upgrade between them.** If the improvement
requires better gear, the game taught the player to shop, not to fight.

**Rule K7 — the improvement must be attributable to the player, not to the enemy.** `E_late`'s
enemy must have equal or greater `RI-AI05` tier than `E_first`'s. Measuring improvement against
a weaker enemy is meaningless and is the obvious way this check gets gamed.

### D. The frustration ledger (BINDING)

Recorded by the naive agent, verbatim, and triaged. The categories are fixed so a critic cannot
soften one into another.

| Code | Category | Budget in the hour |
|---|---|---|
| **FR-INT** | *"I knew what I wanted to do and could not do it."* Interface, not difficulty | **0.** Any instance is a defect |
| **FR-FIND** | *"I did not know where to go."* | ≤ 2, and each must be resolvable from in-game text (`RI-JRN07`) |
| **FR-DIFF** | *"That killed me and I understood why."* | ≥ 1 required — an hour with zero is not this game |
| **FR-CHEAP** | *"That killed me and I did not understand why."* | **0** |
| **FR-BORE** | *"Nothing happened for a while."* | ≤ 1, and it must coincide with a C1 gap under 45 s |
| **FR-TEXT** | *"The game explained something at me."* | **0** (`RI-JRN01` O11) |

## Comparison method

Run by `critic.ui` with `critic.combat` co-signing block C (fleet critic **JC-02**). Two
passes: **instrumented** over a full 60-minute scripted-plus-agent-driven run, and a **naive
pass** (isolation `enforced`) that is the source of §D.

```bash
node tools/journey/journey-run.mjs --journey jrn02-first-hour --seed 4711 \
     --profile desktop-1080p --input-mode real --duration-min 60 --trace-events \
     --out reports/journeys/<runId>
node tools/journey/cadence.mjs   --in reports/journeys/<runId>
node tools/journey/competence.mjs --in reports/journeys/<runId> --early E_first --late E_late
```

Requires **`A-JRN1`** and **`A-JRN7`** (the extended trace event vocabulary: `input_action`,
`surface_enter/exit`, `dialogue_open`, `topic_select`, `journal_write`, `item`, `search`,
`rest`, `pay`). Until they exist every check is `unmeasurable` and scores **0**, fail-closed.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-I1** | **Verb ledger** | From the trace, first-use minute and repetition count for every row of §A | Every `first_use` met; every repetition minimum met. Report the full table |
| **M-I2** | **`V_exercised`** | Distinct canonical actions used ≥ 1× by minute 60 | ≥ **11/14** (V1). **Hard fail: ≤ 8** |
| **M-I3** | **Verb teaching purity** | For each verb's first use, look back 30 s in the UI-text stream for an instruction string naming that control | **0** verbs preceded by an instruction (V2). **Hard fail: any** — also `RI-JRN01` HF3 |
| **M-I4** | **Verb order** | Order of first use of the six combat verbs | Matches V3. ≤ 1 transposition tolerated; **hard fail: `block` or `roll` first used after `heavy`** |
| **M-I5** | **Necessity** | For the encounter introducing each combat verb, re-run it scripted **without** that verb | Survivable without it (not a wall) **and** ≥ 40% faster/cheaper with it (not pointless). Both, 6/6 |
| **M-I6** | **Cadence** | `cadence.mjs` over the full trace | Every row of §B. **Hard fail: `gap_max` > 90 s, or `combat_fraction` outside [0.08, 0.45]** |
| **M-I7** | **Corridor census** | For each locomotion stretch, distance to the nearest interactable/NPC/enemy/readable at 1 Hz | C9. Cross-checked against `RI-WLD02` density — if they disagree, `RI-WLD02` owns density and this item owns the *time* the player spends without one |
| **M-I8** | **Competence curve** | `competence.mjs` on `E_first` vs `E_late` | ≥ 4/6 improved; `roll_efficiency` +0.15; `hit_taken_rate` −30%; K7 tier check passes. **Hard fail: 0/6 improved** |
| **M-I9** | **Competence attribution** | Diff the character's equipment and level between `E_first` and `E_late` | Identical equipment. If not, re-run `E_late` with `E_first`'s loadout via `loadState` and use that |
| **M-I10** | **Beat citation integrity** | Assert this run's `T_choice`, `T_found`, `T_death`, `beats_hit` etc. are read from `RI-EXP01`'s own tooling and **reported as citations** | This item's verdict contains **0** independently-derived values for `RI-EXP01`-owned metrics. A critic that recomputes them has violated the division of labour and the verdict is corrected, not accepted |
| **M-I11** | **Surface time** | Sum of frames with any full-screen or modal surface open | C8; and **0** frames with a surface open during `COMBAT` other than the dialogue-locked parley (seam S13/S14) |
| **M-I12** | **Journal keeps up** | Every `RI-EXP01` beat that changes an objective produces a journal entry within 5 s | 100%, and every entry is first-person prose (`journal.entry.voice`) |
| **M-I13** | **Frustration ledger** | From the naive pass, §D triage | Every budget met. **Hard fail: any FR-INT or FR-CHEAP** |
| **M-I14** | **Modality parity for the hour** | Repeat the full hour gamepad-only and touch-only (`RI-JRN04`) | 2/2 complete with `V_exercised` ≥ 11. **Hard fail: either cannot complete** |

### Naive pass (isolation: `enforced`)

Fleet role **JC-02N**. Receives the URL, the driver protocol, one sentence of premise, nothing
else. Plays for one hour. Asked, verbatim, answers recorded before any reveal:

1. *"List everything you learned you could do, in the order you learned it, and say whether you
   worked it out or were told."*
2. *"Was there any moment where you knew what you wanted to do and could not do it? Describe it
   exactly."*
3. *"Did you get better at fighting? What specifically are you doing now that you were not doing
   at the start?"*
4. *"Was there a stretch where nothing was happening? How long did it feel?"*
5. *"What do you want to do next, and why?"*

| # | Check | Threshold |
|---|---|---|
| **M-N1** | Verbs listed in (1) | ≥ 11, **0** marked "told" |
| **M-N2** | FR-INT from (2) | **0**. **Hard fail: any** |
| **M-N3** | Self-reported competence (3) | The agent names **≥ 2 specific behaviours** it changed (e.g. "I stopped rolling backwards and started rolling into the swing"). A "yes, I got better" with no specifics scores 0 — corroborate against M-I8 and, if M-I8 improved while the agent cannot say why, record it: an improvement the player cannot perceive is not competence, it is drift |
| **M-N4** | Boredom (4) | ≤ 1 stretch, felt duration ≤ 90 s |
| **M-N5** | **Forward intent (5)** | The answer names a **specific place or person**, not a mechanic. *"I want to go find out what is in the reed-case"* passes; *"level up"* fails. This is the single best one-question test of whether the hour worked |

### Blind pair (`blind_pair: yes`)

Pack: **A** = a stripped input-and-event timeline of our hour (`tools/journey/beat-extract.mjs
--mode interaction`), rendered as one line per state-changing input with proper nouns replaced
by `«person»`/`«place»`/`«thing»`. **B** = a hand-built equivalent timeline for Morrowind's
Seyda Neen hour and Dark Souls' Undead Burg hour, length-matched. Assignment by recorded coin
flip.

**The discriminating question, written before looking:** *"In which timeline does the player
appear to be doing something they decided to do, rather than something the timeline told them to
do?"* If the judge picks ours, CRITIC-DOCTRINE §2.5 applies in full.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

`ARBITRATION` §3's CONSUMPTION check reached the **critics** through the doctrine and reached
**none of the fourteen items** judging the opening, character creation or the journeys — measured
at this pass, `grep -cE 'RI-MTH07|CONSUMPTION|world-side consumer'` returned **0** for every one of
`RI-JRN01`–`RI-JRN08`, `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03` and `RI-EXP01`. Which models
must be enumerated, and what a zero costs, are properties of the item and not of a critic's
diligence. For this item:

1. **Enumerate exhaustively** every model this journey requires to act — every table, graph,
   binding map, budget and record it publishes that the running game must read — and list it in
   the verdict. A sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, plus the null control. For a **journey** the admissible observable is what the player
   could see or do — a drawn string, a rendered object, a surface that appears, an input that is
   accepted or refused, a state that survives. **A harness return value is not an observable**;
   `RI-MTH07` §B1 rules the trace an observer, not a consumer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **The fourth shape.** `RI-MTH07` §A names orphan model, orphan data and orphan predicate.
   `corpus/88-journeys/` produced a fourth — **orphan text**: a string authored, computed
   correctly, carried through the model, exposed through the harness, and never drawn. From the
   player's chair it is identical to a string that was never written. See `RI-JRN09`
   `ES-LEGIBLE/1`.

## Scoring

Native scale **0–100**, weighted, plus hard fails capping at **2**.

| Block | Weight | Checks |
|---|---|---|
| **Verbs — the hands learn the game** | **30** | M-I1 (10), M-I2 (7), M-I3 (7), M-I4 (3), M-I5 (3) |
| **Cadence — the hour is never empty and never a treadmill** | **24** | M-I6 (16), M-I7 (5), M-I11 (3) |
| **Competence — the player got better** | **22** | M-I8 (16), M-I9 (3), M-N3 (3) |
| **Frustration** | 12 | M-I13 (8), M-N2 (4) |
| **Reach and integrity** | 8 | M-I14 (5), M-I10 (2), M-I12 (1) |
| **Forward intent** | 4 | M-N5 (4) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — `V_exercised` ≤ 8 of 14 (M-I2).
- **HF2** — Any verb whose first use was preceded by an instruction string (M-I3).
- **HF3** — `gap_max` > 90 s, or `combat_fraction` outside [0.08, 0.45] (M-I6).
- **HF4** — Zero measured competence improvement across the hour (M-I8).
- **HF5** — Any FR-INT ("I knew what I wanted to do and could not") or FR-CHEAP (M-I13, M-N2).
- **HF6** — The hour cannot be completed gamepad-only or touch-only (M-I14).
- **HF7** — A menu or inventory surface open during combat outside the S13 parley (M-I11).

## How we lose

1. **The hour is a walking simulator with dialogue.** Every `RI-EXP01` beat lands, the prose is
   excellent, and `combat_fraction` is 0.04. The Souls half of the brief has not been built and
   nothing else in the corpus notices, because every combat item passed *in isolation* — they
   were just never reached.
2. **The mirror: an arena with a village attached.** `combat_fraction` 0.5, `dialogue_fraction`
   0.04, and the Morrowind half is a shop.
3. **Verbs are introduced by a checklist, not by need.** The design doc says "teach block by
   minute 21", so an enemy is placed at minute 21 whose only purpose is to be blocked. M-I5's
   both-directions test — survivable without, meaningfully better with — is what separates a
   taught verb from a scheduled one.
4. **Competence is never measured, so it never happens.** The player is not better at minute 55;
   they just have a better sword. K7 and M-I9 exist because equipment improvement is the easiest
   thing to mistake for skill improvement, and it is the one Morrowind actually does — but
   Souls does not, and inside the fight Souls wins.
5. **`gap_max` is fine on average and terrible once.** There is one seven-minute walk to Lilmoth
   where nothing is placed, and it is the stretch every player remembers. C1 is a **maximum**,
   not a mean, for exactly this reason.
6. **The frustration ledger is collected by an agent that already knows the controls.** FR-INT
   is then structurally impossible to observe, and the most important number in §D reads 0 for
   the wrong reason. Isolation is `enforced` and `JOURNEY-CRITIC-FLEET.md` §4 verifies it.
7. **`parry` is in the game and nobody ever uses it.** Its `first_use` is deliberately ≤ 0:45 and
   optional, which makes it the verb most likely to be *shipped and undiscovered*. If M-I1 shows
   it never fires, the honest reading is not "the player chose not to" — it is that the game
   contains a system nobody knows about.
8. **The hour is tested from a save.** Loading into minute 18 to test the combat verbs skips the
   fact that the player never picked anything up. The run must be continuous from
   `navigationStart`, and the manifest must show it.
9. **This item and `RI-EXP01` both measure `T_death`.** Two numbers, two items, and eventually
   two different values in two verdicts. M-I10 makes recomputation a *correction-triggering*
   error rather than a judgement call.
10. **Touch and gamepad runs are skipped "because the hour is content, not input".** M-I14 is 5
    points and a hard fail because the hour is exactly where a control gap becomes a content gap:
    if `two_hand` is unreachable on touch, the touch player's verb ledger is 13, not 14.

## Provenance note

- **`constructed`, confidence high, and binding** — the verb ledger in §A (every `first_use`
  and every repetition minimum), the cadence targets in §B, the competence curve and its six
  metrics in §C, the frustration taxonomy in §D, and every threshold and weight below them. No
  upstream source states an interaction cadence for a first hour, so we defined one we can
  measure (CORPUS-CONTRACT §3).
- **`canonical-recall`, confidence medium** — the two shape claims that motivate §B: that
  Morrowind's opening hour is dense in *small* player-initiated interactions while being slow in
  incident, and that Dark Souls' is sparse in verbs but deep in repetition of them. These are
  recalled characterisations of the reference games, **not measurements**, and no threshold in
  this item is derived from a number attributed to either game — §B's bands are ours, chosen so
  that both reference shapes would pass and the two degenerate shapes in "How we lose" #1 and #2
  would not.
- **Owned elsewhere, cited not restated:** every beat and every `T_*`/`N_*` metric →
  `RI-EXP01` (M-I10 enforces this). The first 15 minutes as screens and states → `RI-JRN01`.
  Bindings and discoverability mechanism → `RI-JRN03`. Gamepad/touch parity → `RI-JRN04`. Death
  and recovery as a loop → `RI-JRN06`. Enemy tiers → `RI-AI05`. Punish windows → `RI-AI03`.
  World density per 100 m → `RI-WLD02`. Journal voice → `journal.entry.voice`.
- **Harness dependency.** `A-JRN1`, `A-JRN7`; M-I14 additionally needs `A-JRN2`/`A-JRN4`.
  Until they land this item is **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
