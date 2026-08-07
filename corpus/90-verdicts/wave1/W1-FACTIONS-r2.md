# W1-FACTIONS round 2 — faction questlines (RI-QST01, RI-QST02, RI-CRM02)

**FAIL — 5.4 / 10 against a wave-1 gate of 7.0.** Up from 4.1. The two `RI-QST01` hard fails are
genuinely cleared, `GAP-FCT-01` is genuinely closed, and the round-1 orphan `factionLawFactor` now
has a real world-side writer that I confirmed by my own perturbation.

It fails because **the round's headline measurements no longer reproduce on the build that ships**.
I re-ran the builder's own probe, unchanged, with its own command line. The report on disk says
16/16. Today it says 8/16, and the check that flips hardest is the one this round was proudest of:

> **on disk** — `P16_the_reputation_was_EARNED` — *"the walk wrote no reputation at all; 398 was
> paid entirely by the quests' own consequences"*
>
> **today** — `P16_the_reputation_was_EARNED` — ***"the walk WROTE reputation 10 (rank term at
> Q-LEDG-01), 22, 36, 52, 70, 90, 112 — every rank derived after that is partly the probe's"***

Nothing in the faction data changed. The world grew a gate, and the probe was never standing in a
world where it could pass.

---

## 1. The single biggest gap

### `GAP-FCT-03` — the round's numbers were taken in a world with nobody in it

`game/src/sim/quest/machine.js:472`, shipped at HEAD, added a presence term to `open()`:

```js
const giverId = (def.giver && def.giver.npc_id) || null;
if (giverId && this.presenceMode !== 'off') {
  const present = !!(this.sim.findNPC && this.sim.findNPC(giverId));
  if (!present) { …
    return { ok: false, reason: `giver absent: ${giverId} is not in this world`, gate: 'giver_presence', giver: giverId };
```

with `this.presenceMode = 'on'` as the default (`machine.js:93`). Its comment is right and I want
it quoted, because it is the doctrine this verdict is enforcing:

> *"A quest is a thing a person asks you to do. If there is no person, there is no quest."*

`faction-probe.mjs` and `faction-seam-probe.mjs` boot a bare world and **never call
`questPresenceGate`** — the string does not appear in either file. So on the current build the
Wet Ledger walk collapses:

| check | on disk (`reports/faction-probe-the_wet_ledger.json`) | re-run today, same command |
|---|---|---|
| `P3_every_rank_reachable` | 18/18 quests became offerable | **7/18** |
| `P4_ladder_reaches_ceiling` | top derived rank **7** at reputation 398 | **rank 4** at reputation 112 |
| `P13_the_seat_was_vacated_by_PLAY` | raised by a resolution: **true** | **false** — *"Endings that raised a ladder flag: NONE"* |
| `P14_rank7_AND_nonviolent_together` | rank 7, 18/18 non-violent, 0 flags poked | **FAIL** — rank 4, 0/0 endings |
| `P15_every_open_went_through_the_offer_gate` | 28 calls, *"none refused by the gate"* | **17 refused**, every one `giver absent:` |
| `P16_the_reputation_was_EARNED` | *"the walk wrote no reputation at all"* | **the walk wrote 7 reputation values** |

The cascade is causal rather than coincidental, and that is what makes it interesting. Because
`open()` refuses, `faction-probe`'s `grantRep()` fallback at lines 307 and 322 fires to satisfy the
rank terms by hand — so **the "no reputation writes" claim was only ever true while every quest
opened.** It was not an independent property of the content. It was a downstream consequence of a
gate that has since changed its mind.

**What this is not.** I nearly filed this as "the faction content is unreachable" and I was wrong.
Running the existing `tools/quests/critic-giver-presence.mjs` across every bootable state in the
build:

```
  quests with a named giver            120
  giver present in SOME bootable state 115
    faction  present  62/62   talkable 62
    main     present  27/32   talkable 27
```

**Every faction giver is placed and talkable** — a better record than the mainline's. The content
is findable. What is broken is the *instrument*, and the fix is two lines: boot an inhabited state,
or call `questPresenceGate('report')` and report the misses. Until one of those happens, no number
in `reports/faction-probe-*.json` may be cited, including every headline in the round-2 status file.

*That a state-aware tool written by a different critic for a different piece is what stopped me
publishing the wrong verdict is the argument for `TOOL-LOOP.md` in one sentence.*

---

## 2. What round 2 actually fixed, verified independently

I want this on the record before §3, because it is substantial and most of it holds.

**`GAP-FCT-01` is closed.** `resolve()` now gates on `r.opened` *and* re-runs the offer predicate
(`machine.js:511-521`), and `open()` refuses only on `r.opened` rather than on the existence of a
row. The second bug the builder found in its own fix — that a `reveal()` mint made a quest
**permanently unopenable**, so foreknowledge of a quest destroyed it — is real, is worse than the
one it was sent to fix, and is fixed, including a round-trip through the save with old saves
deriving `opened` from `stage > 0`. Finding that while fixing something else is the round's best
piece of work.

**The volume gates are genuinely cleared**, re-derived by me from the files without touching the
builder's probe:

| | Wet Ledger | Imperial Assize | Xul-Aneekh |
|---|---:|---:|---:|
| quests (incl. pre-existing tagged) | **18** | **18** | **18** |
| mean per rank | **2.250** | **2.250** | **2.250** |
| rank histogram 0→7 | `2 2 3 2 3 2 2 2` | `2 2 2 3 2 2 2 2` | `2 3 2 2 3 2 2 2` |
| hidden (`found`/`overheard`) | 2 | 2 | 2 |

Round 1's `1/1/1/1/2/1/1/1` — the item's own *"signature of a spreadsheet rather than a story"* —
is gone on all three lines. Both `RI-QST01` hard fails are cleared. This is real.

**The reputation really is earned, for the quests that open.** I did not trust `P16`, because it is
checked against `repWrites`, a list the probe's own `grantRep()` wrapper appends to — a true
statement about one wrapper, not about the world. So I monkey-patched every reputation-writing
harness method at the boundary and reconciled the result against the data
(`tools/quests/critic-faction-r2.mjs`, `reports/critic-faction-r2-ledger.json`):

> `C1e` — **live standing 192 vs the sum of the taken resolutions' own declared
> `faction_reputation` 192** — with `setFactionStanding ×0`, `setFactionStandings ×0`,
> `setSkills ×0`, `questSetFlag ×0`.

Nine quests, exact reconciliation, zero writes by any route. The claim is narrower than the
builder's — nine quests, not eighteen — but within its range it survives an instrument that does
not share the builder's blind spot.

**`AR-3`: the fourteenth orphan has a writer, and I confirmed it by play.** After a walk that
joined the Ledger through a *quest*, with **zero** `setFactionStandings` pokes counted at the
boundary:

> `C4a` — `sim.stealth.p.standings` after the walk = **`{"wet-ledger": 4}`**

`Engine.syncFactionStandings()` (`engine.js:3956`, called from `_afterStep()`) derives it from
`questEngine.context().ranks` through `sanction.json`'s `standing_ids`. Round 1 scored this **0 —
orphan**; it is now genuinely consumed.

**`path_to_ten` #8 is done.** `Q-LEDG-08` was `deceit: null` and is now `D4,D12`; `Q-XULA-08` is now
`D6,D12`.

**The refusal→topic chain is sound.** I chased it specifically because it looks broken —
`hooks.json` writes the slug `"the-second-refusal"` and the quest opens on the prose
`"the second refusal"` — and `gate.js:166` routes through `topicsInclude()`, which normalises. Not
a defect.

---

## 3. Is the new two-thirds as good as the old third?

**Yes on the writing. No on the fingerprint, and no on the shape of the fix.**

*Sampling rule, declared before reading and positional rather than chosen: per line, the round-2
quest with the lowest, median and highest new id — `Q-LEDG-09/13/17`, `Q-ASSZ-09/12/16`,
`Q-XULA-02/12/16` — each read against the round-1 quest at the same rank on the same line.*

The prose holds up. `Q-LEDG-09` is a rank-0 errand about weighing a coil of rope dry:

> *"A stone on a coil is nothing. A stone on every coil that came up this season is a barge nobody
> has to account for, and I do not think Belliene worked that out this morning."*

`Q-LEDG-17`, on a man who is not on the quay any more:

> *"The room has four seasons of dust and no belongings in it, which is the wrong way round. A man
> who left in a hurry leaves his things; a man whose things were taken leaves dust on a floor
> somebody swept first."*

`Q-XULA-16`, which is the best of the new `weird` quests:

> *"The interval is the same as the coast's pump at Gideon. I counted both and they are the same
> and the sapwell is nine hours from the pump."*

That is not a tired writer. Round 1's critic praised this material at length and the praise still
holds at three times the volume.

### 3.1 The `eleven` fingerprint got worse, in material written after the sweep found it

Re-running the pre-registered `tools/prose/tic-detector.mjs`, the journal register is *ours 1005
docs / 39,819 words* — which independently confirms the builder's "1005 journal entries" — against
Morrowind's 3,183 reference entries:

| rule | ours /10k | Morrowind /10k | ratio |
|---|---:|---:|---|
| `RULE-01` **eleven** | **29.89** | **0.00** | **∞** |
| `RULE-05` odd-specific teens | 32.65 | 0.00 | ∞ |

Splitting the three faction lines into round-1 and round-2 material with the same pre-registered
rules (my `prose-split.mjs`):

| rule | r1 /10k | **r2 /10k** | r2:r1 |
|---|---:|---:|---:|
| `RULE-01` eleven | 23.55 | **30.90** | **1.31×** |
| `RULE-08` round hundreds | 21.41 | 8.32 | 0.39× |
| `RULE-27` tricolon of clauses | 72.78 | 57.05 | 0.78× |
| `RULE-36` contraction avoidance | 160.55 | 120.05 | 0.75× |

The new material is **cleaner on almost every tic and worse on the one already flagged**. Raw
counts: round 1, 22 instances across 12 quests; round 2, **27 instances across 10**. It concentrates:

- **`Q-ASSZ-12` uses "eleven" nine times in one quest**, and one of its journal entries is
  > *"Hallow wants eleven years of prefect's returns read and summarised, and she wants the summary
  > in one page, and **she said the number eleven three times**."*

  The quest is titled *Eleven Years of Not Asking*. The writer noticed the tic and wrote it into
  the fiction instead of out of the draft.
- `"eleven years"` appears **23 times** across three factions whose fictions are unrelated — the
  Assize's missing Legate, a Xul-Aneekh vote, a struck-off notary — plus `"eleven hundred"` ×4,
  `"eleven gold"` ×4, `"eleven chairs"`, `"eleven thousand"`, `"four hundred and eleven"`.

*Remedy: 27 instances is an afternoon. Keep the Assize's eleven-year gap, which is load-bearing;
re-roll the rest onto different numbers per line.*

### 3.2 The refusal route is one quest written three times

`path_to_ten` #6 is answered, and answered to a template:

| | `Q-LEDG-14` | `Q-ASSZ-14` | `Q-XULA-13` |
|---|---|---|---|
| rank / reputation | 6 / 90 | 6 / 90 | 6 / 90 |
| deceit patterns | `D10` | `D10` | `D10` |
| methods | expose, persuade, refuse | expose, persuade, refuse | refuse, persuade, refuse |
| flags | `_vacant`, `_vacated_on_the_article` | `_vacant`, `_vacated_on_the_term` | `_vacant`, `_vacated_on_the_silence` |
| reputation | 30 / 22 / 8 | 28 / 22 / 10 | 26 / 22 / 10 |
| final refuse flag | `player_refused_the_chair_twice` | `player_refused_the_seal_twice` | `player_refused_the_seat_twice` |

`Q-LEDG-14` and `Q-ASSZ-14` are the same quest with different nouns, down to the middle
resolution paying 22 in both. The mechanism differs in fiction — a two-house clause, an expired
commission, four unasked fourth-days — and that is the good half. The scaffolding underneath is
identical, and `RI-QST01` names exactly this as the failure it is looking for.

### 3.3 Two structural regressions in the new material

- **Deceit rate fell**: 88.0% (22/25) in round-1 quests → **65.4% (17/26)** in round-2. Nine of the
  new quests are `deceit: null`.
- **`records_belief` tripled into an unfalsifiable metric.** 19.7% of round-1 journal entries →
  **56.8%** of round-2, against an `RI-QST02` target of ≥15%. Under a deliberately generous
  first-person-epistemic-marker test, the correspondence between the flag and the text **fell from
  37.0% to 13.4%**. I do not claim the flag is dishonest — several entries my test misses do record
  belief (*"which either means it is true or means somebody taught it to them"*). I claim something
  worse: **nothing anywhere validates `records_belief` against the text.** It is a self-declared
  authorial boolean that `RI-QST02` scores on, and a metric that can be moved by editing a boolean
  is not a metric.

---

## 4. `GAP-FCT-02` — vocabulary drift switched off the violence guard on 43.7% of the new work

`game/src/sim/quest/defs.js:113` is the build's only guard against a resolution that claims a
non-violent method while demanding violence. It works by membership:

```js
const RES_METHODS_NONVIOLENT = new Set([
  'persuade', 'intimidate', 'bribe', 'sneak', 'steal', 'lore_knowledge', 'trade',
  'alchemy', 'magic_utility', 'refuse', 'betray', 'confess', 'wait',
]);
```

Round 2 introduced five method values that set has never heard of — `comply` (17), `expose` (10),
`lie` (7), `sabotage` (3), `investigate` (1). **38 of the 87 round-2 faction resolutions = 43.7%**
carry an unknown method, and **all 38 unknown-method resolutions in the whole game (of 383) are
this round's.**

I broke it on purpose, with a control (`scratchpad/break-method.mjs`):

```
baseline QuestBook over game/data/quests/**: clean

CONTROL — method inside RES_METHODS_NONVIOLENT
  Q-LEDG-13.res_will_not_witness  method="refuse"  violence_required -> true
  guard: RED  QuestBook: 1 integrity failure … is method refuse and violence_required true

TEST — round-2 method outside RES_METHODS_NONVIOLENT
  Q-LEDG-13.res_renew_it  method="comply"  violence_required -> true
  guard: GREEN — no problem reported
```

No resolution is currently mis-declared, so nothing is broken *today*. What is broken is the
instrument: the round-2 status file's *"check-quests 120 quests PASS"* is, for 43.7% of the new
resolutions, a pass the checker was incapable of withholding. *Remedy: add the five values to the
set (all five are non-violent), or make an unrecognised `method` a problem in its own right — the
second is better, because it fails loud the next time the vocabulary drifts.*

---

## 5. `AR-3` — the honest spread is 3.90×, and it is neither number the builder reported

The builder reported two figures "on purpose": a declared table spread of **5.33×** and a
probe-reachable **1.92×**. Both are correct and both are the wrong number.

I priced every row of `factionLawFactor` against the shipped guard at a fixed bounty of 500
(`C4b`), and derived the same answer statically from `standingKey()`:

| standing | `arrest_at` | reachable by play? |
|---|---:|---|
| `none` | 405 | yes |
| `wet-ledger:1-2` | 506 | yes |
| `wet-ledger:3+` | **709** | yes |
| `xul-aneekh:1-3` | 263 | yes |
| `xul-aneekh:4+` | **182** | yes |
| `ninth-cohort:1-3` | 648 | **no** |
| `ninth-cohort:4+` | **972** | **no** |

* spread over **all** rows = 972/182 = **5.34×** (confirms the declared 5.33×)
* spread over rows **a player can reach** = 709/182 = **3.90×** (confirms my static 1.75/0.45 = 3.889×)

The top of the declared range is not *"in the table and not walked to"*, as the round-2 status file
frames it. It is **unreachable by construction**: `sanction.json`'s `standing_ids` maps
`the_ninth_cohort → ninth-cohort`, and `the_ninth_cohort` **appears in zero quest files and has no
`joins_faction` anywhere in the build**. The same is true of `the_morag_tong`, `shadowscale_order`
and `the_sap_cutters` — **four of the seven map entries point at factions that do not exist.**

And the omission that matters most to this piece:

> **`the_imperial_assize` is not in `standing_ids` at all.** Neither is `the_ixtu_vakh` nor
> `the_dockhands`, both joinable via `Q-MAIN-19`/`Q-MAIN-21`. **Only 2 of the 5 joinable factions
> are wired to the guard ladder.**

A player who walks the Assize — eighteen quests, ending holding a court's seal with no Legate in
the province — moves no guard's arrest threshold by one point. Their standing stays `none`, factor
1.0. A third of the piece has no AR-3 crossing at all. *Remedy: add `the_imperial_assize` to
`standing_ids` (it needs a row in the table, which the Assize's own fiction makes obvious — an
officer of the court is `imperial_law` **up**), and either give `the_ninth_cohort` a join path or
delete its rows so the declared spread stops overstating what ships.*

---

## 6. The two instrument failures the builder reported against itself

Both self-reports are honest and both fixes are weaker than the reports.

**Expulsion biting its own walk** is the best evidence in the round that expulsion is consumed —
the probe went 9/16 on two lines the moment it shipped, because the chooser picked
`res_publish_the_rooms` and `res_to_the_assize`, which are career-ending. The fix reads the
avoided set out of the live gate (`H.factionDiscipline().declared`) rather than hardcoding it, and
reports it as `expulsion_causes_avoided_by_the_walk`. That is the right shape. But note what the
chooser now is: `violence 100000, expels 50000, does-not-raise-a-ladder-flag 20000, unavailable
1000`. It is an optimiser pointed at the exact metric being reported. A player *would* play that
way; a measurement of whether a line is walkable by a *typical* character still has not been taken.

**The seam probe reading its own poke** is the one the brief is right about. Section D's fix is:

```js
H.questSetFlag(flag, false);
const before = { known: H.questTopicsKnown().includes(topic), … };
```

`questSetFlag(flag, false)` **cannot un-seed a topic** — the probe's own comment says *"topics are
permanent"*. So the `before` reading is guaranteed clean by nothing except D having been moved to
the top of the file. The check is order-dependent by construction; the control is inert. It fails
*safe* — contamination would make `before.known` true and S12 would go red, not green — so this is
a fragility rather than a false pass, and I am not scoring it as one. But moving a section is not
making it independent. *Remedy: a `forgetTopic` harness call, or a fresh world per case.*

---

## 7. What is declared not done, scored rather than excused

`RI-CRM02`, re-derived by me from `game/data/quests/**`:

| Metric | Target | Hard fail | r1 | **r2** |
|---|---|---|---:|---:|
| Sanctioned-murder quests | 27 | **< 15** | 1 | **3** — `Q-ASSZ-05`, `Q-XULA-06`, `Q-MAIN-31` |
| Sanctioning authorities | 4 | **< 3** | 1 | **1** |
| `favour_owed` flags with call-in content | 4/4 | < 3 | 0 | **0** — the string appears in **zero** quests build-wide |
| Expulsion / readmission | required | — | absent | **built and live** |
| `factionLawFactor` | 5.3× | < 2× | absent | **3.90× reachable** |

Two hard fails stand on `RI-CRM02` and they are the same two as round 1. The ku-vastei Ruling —
named in round 1's `path_to_ten` #7 as the highest-value single addition, the only authority that
reaches the interior jurisdiction — is still unwritten; `shadowscale_order → ku-vastei` sits in
`standing_ids` pointing at nothing.

**11 zero-pre-PONR quests remain** — `Q-MAG-02/04/05/06/07/13/16/18/19/24` and `Q-MAIN-32`. All
eleven are the magic piece's. `Q-MAG-10`, the one that sat inside the Assize census and made this a
hard fail *for this piece* in round 1, is fixed. **This invariant is now clean on the faction
lines** and the remaining eleven are not chargeable here.

---

## 8. CONSUMPTION (`RI-MTH07`), AR-1, AR-2, AR-3

| Model shipped | World-side consumer | Perturbation → observation | coupling |
|---|---|---|---:|
| `machine.js` `r.opened` (the round's fix) | `resolve()`/`note()`/`takeBranch()`/`isOpen()` | builder's delete-the-fix reproduces the r1 verdict exactly; bypass probe 6/6. **Not re-derived by me** — see `unmeasured` | 1 (builder) |
| `faction-*.json` `consequences.faction_reputation` | `_applyConsequences()` → `sim.quest.factions` | live standing **192** == sum of taken deltas **192**, with 0 writes by any route (`C1e`) | **1** |
| `faction-gates.json` ladder | `FactionGates.evaluate()` → `canOffer()` | rank 3→4 refusals spoken by name; `C1a` walk stalls at *"the_wet_ledger rank 3/4"* | **1** |
| `faction-gates.json` exclusivity | `context()` → `ctx.locked` | builder P6: joining the Assize closed 7 Ledger offers, spoken reason | 1 (builder) |
| `sanction.json` `standing_ids` | `Engine.syncFactionStandings()` → `sim.stealth.p.standings` | walk joined by quest → `{"wet-ledger":4}`, **0 harness pokes** (`C4a`) | **1** |
| `sanction.json` `faction_law_factor` rows | `standingKey()` → `thresholds.arrest_at` | 709 / 506 / 263 / 182 by standing at fixed bounty 500 (`C4b`) | **1** |
| `faction_law_factor` rows for `ninth-cohort`, `morag-tong`, `ku-vastei`, `sap-cutters` | `standingKey()` — but **no faction reaches them** | priced (972, 648) and **unreachable by any play** | **0 — orphan rows** |
| `RI-QST03` §D expulsion / readmission | `ctx.locked`, `QuestEngine.readmit()` | bit the builder's own walk unprompted — 16/16 → 9/16 | 1 (builder) |
| `resolutions[].method` | `defs.js:113` violence guard | **43.7% of new resolutions are invisible to it** (§4, control passes) | **0 for the new vocabulary** |
| `journal[].records_belief` | **none found** | no checker validates the flag against the text | **0 — unfalsifiable** |

**AR-1 (Souls leakage into the fight):** none. Nothing here touches frames, and round 2 added
**zero** violent resolutions to 87.

**AR-2 (Morrowind leakage):** none. 0 imperative journal openings in 1005 entries; advancement is
reputation + attribute + skill + world state, never level.

**AR-3 (seam sterility):** **not sterile, and thinner in proportion than round 1.** The
`syncFactionStandings` → `standingKey` → `arrest_at` chain is a genuine, newly-live crossing and it
is the round's best structural work. Against that: round 2 added 26 quests and **87 resolutions of
which not one is violent** (round 1: 5 of 91), so the piece's only encounter-touching crossings are
still the round-1 ones, and the Assize's eighteen quests cross the seam nowhere at all (§5).
`seam_sterile: false`.

---

## 9. Score

| Item | r1 | **r2** | Why |
|---|---:|---:|---|
| `RI-QST01` faction escalation shape | 3 | **7** | Both hard fails cleared and I re-derived them: 18/18/18, mean 2.250, histograms no longer flat, 2 hidden per line. Prose holds at 3× volume. Held off higher by sitting *exactly* on the 18 floor against a 24–28 target, the deceit rate falling 88%→65% in new material, and the refusal route being one template three times. |
| `RI-QST02` deceit patterns | 7 | **7** | Pre-PONR now clean on these lines (`Q-MAG-10` fixed); `Q-XULA-01` has a mouth; D6 32% clears the 30% floor; rank-7 deceit added on both lines. Offset by `GAP-FCT-02` disabling the violence guard on 43.7% of the new work, and `records_belief` tripling into a metric nothing validates. |
| `RI-CRM02` faction crime and writs | 2 | **3** | Expulsion/readmission built and live; `factionLawFactor` no longer an orphan and confirmed by my own perturbation. Still hard-failed twice: 3 of 27 writ quests, 1 of 4 authorities, 0 of 4 `favour_owed`, and 4 of 7 `standing_ids` rows point at factions that do not exist. |
| **Weighted** | 4.1 | **5.4** | Equal weights give 5.67; **−0.3 applied for measurement integrity** (`RI-MTH04`) — the round's headline artifacts assert claims the shipped build does not support, and nothing in the tree says so. |

**Hard-fail checks.** `RI-QST01` quests-per-line < 18 — **PASS** (was FAIL). `RI-QST01` mean quests
per rank < 2.0 — **PASS** (was FAIL). `RI-QST01` all-honest line — pass. `RI-QST01` level-gated
advancement — pass. `RI-QST02` reachable-reveal invariant **on this piece's census** — **PASS**
(was FAIL). `RI-QST02` D6 < 30% — **PASS** at 32%. `RI-QST02` zero refuse resolutions — pass.
`RI-CRM02` sanctioned-murder quests < 15 — **FAIL** (3). `RI-CRM02` sanctioning authorities < 3 —
**FAIL** (1). `RI-CRM02` `factionLawFactor` < 2× — pass at 3.90×. AR-1 — pass. AR-2 — pass.

---

## 10. `path_to_ten`

1. **`GAP-FCT-03` first, because every number in the round depends on it.** Make
   `faction-probe.mjs` and `faction-seam-probe.mjs` boot an inhabited state, or call
   `questPresenceGate('report')` and publish the miss list. Then re-run all three lines and
   **expect the report to change** — a probe that returns 16/16 unchanged is still not standing in
   the world. Until then no `reports/faction-probe-*.json` figure may be cited.
2. **The refusing walk, end to end.** Still unmeasured — by the builder, who said so, and by me,
   whose chooser stalled at rank 4. Add `--refuse` to `faction-probe.mjs`: take the rank-6 refuse
   ending on purpose and assert rank 7 anyway. It is the cheapest remaining measurement in the
   piece and it is the one claim of round 2 that rests entirely on construction.
3. **`the_imperial_assize` into `sanction.json` `standing_ids`**, with its own row. Eighteen quests
   ending in a court's seal currently move no guard in the province. One map entry and one table
   row is the largest AR-3 gain available anywhere in this piece.
4. **Delete or fund the four orphan `standing_ids` rows.** `the_ninth_cohort`, `the_morag_tong`,
   `shadowscale_order`, `the_sap_cutters` appear in zero quest files. Either give one a join path —
   the ku-vastei Ruling is `path_to_ten` #7 from round 1 and is still the highest-value single
   addition — or stop counting their rows in the declared 5.33×.
5. **`GAP-FCT-02`: make an unrecognised `method` a problem**, not just add the five. A set that
   silently ignores what it does not know will drift again.
6. **Re-roll the elevens.** 27 instances, one afternoon. Keep the Assize's eleven-year gap; change
   the rest. `Q-ASSZ-12` uses it nine times and names itself after it.
7. **Give `records_belief` a test or stop scoring it.** A checker that requires a first-person
   epistemic marker, or the flag is decoration.
8. **Break the refusal template.** Give one of the three second-route quests a different rank, a
   different pattern set and a different resolution count, so the mechanism reads as three
   institutions rather than one function.
9. **`RI-CRM02` volume.** 3 of 27 writs and 1 of 4 authorities are the two hard fails that survive
   the round. Neither moves without new content.

---

## evidence

```yaml
evidence:
  environment:
    node: v22.22.2
    boot_check_before: "FAIL then PASS — see note"
    boot_check_before_note: |
      My first `node tools/harness/boot-check.mjs` exited 12: `ReferenceError: SoulsSystem is not
      defined` at engine.js:375. This was a CONCURRENT agent's in-flight edit (W1-SOULS added
      `new SoulsSystem(...)` with no import), not the faction round, and not committed. It
      self-repaired about four minutes later and boot-check has been PASS for every measurement
      reported here. No faction measurement was taken against the broken tree.
    boot_check_after: PASS
    contention: |
      HIGH THROUGHOUT and declared per AGENT-PROTOCOL. `pgrep -c headless_shell` was 11 at start
      and 12/16/18/24/30 at successive checks; loadavg 9.83 -> 16.45 on four cores. This is above
      the protocol's cap of ~8, so the authoring, static and data phases were done FIRST with no
      browser open, and browser work was taken one page at a time, sequentially, never concurrently,
      at --width 320 --height 240 with setRenderRate(0). NO TIMING FIGURE IS CLAIMED ANYWHERE in
      this verdict. Every browser number above is a rank, a count, a boolean or a gate string,
      which the protocol records as surviving contention.
  build:
    commit: e1661f46df21e5089b4b6085665ec8188e95cae7
    branch: claude/morrowind-souls-threejs-game-mou39v
    dirty: true
    dirty_note: |
      The working tree churned continuously under other agents during this critique
      (game/src/engine.js, game/src/harness/api.js, game/src/sim/events.js, game/src/sim/step.js,
      game/data/books/**, tools/analysis/build-viability.mjs). `git worktree add` to isolate a
      clean tree TIMED OUT at 2 minutes on this 11 GB repo and was abandoned. The round-2 faction
      work is COMMITTED at e1661f4; none of the dirty paths is a faction quest file,
      faction-gates.json, sanction.json, sim/quest/gate.js, sim/quest/machine.js or sim/crime/**.
      Per RI-MTH04 "How we lose" #5 every claim here is confidence: medium at best.
  runs:
    - command: "node tools/quests/faction-probe.mjs --line the_wet_ledger"
      note: "THE DECISIVE RUN — the builder's own tool, unchanged, on the shipped build"
      result: "FAIL — 8/16 checks, against 16/16 in reports/faction-probe-the_wet_ledger.json"
      exit_code: 1
      page_errors: 0
    - command: "node tools/quests/critic-faction-r2.mjs --line the_wet_ledger"
      artifact: reports/critic-faction-r2-ledger.json
      result: "11/16"
      exit_code: 1
      page_errors: 0
    - command: "node tools/quests/critic-giver-presence.mjs"
      note: "existing tool, not mine; it is what stopped me publishing a wrong finding"
      result: "faction givers present in some bootable state 62/62, talkable 62"
      exit_code: 0
    - command: "node tools/prose/tic-detector.mjs"
      result: "journal register: ours 1005 docs / 39819 words; RULE-01 eleven 29.89/10k vs ref 0.00"
      exit_code: 0
    - command: "node scratchpad/break-method.mjs"
      note: "instrument test with control; exit 3 = control RED and test GREEN, i.e. the guard is blind"
      exit_code: 3
  builder_artifacts_read:
    - reports/faction-probe-the_wet_ledger.json
    - reports/faction-probe-the_imperial_assize.json
    - reports/faction-probe-the_xul_aneekh.json
    - reports/faction-seam-probe.json
  independently_rederived:
    - { claim: "18 quests per line, mean 2.250 per rank", method: "static census of game/data/quests/** by faction, incl. pre-existing tagged quests", agrees_with_builder: true }
    - { claim: "1005 journal entries", method: "tools/prose/tic-detector.mjs journal register doc count", agrees_with_builder: true }
    - { claim: "factionLawFactor probe-reachable spread 1.92x", method: "1.25/0.65 from sanction.json rows", agrees_with_builder: true }
    - { claim: "factionLawFactor declared spread 5.33x", method: "live arrest_at 972/182 = 5.34x", agrees_with_builder: true }
    - { claim: "REACHABLE-BY-PLAY spread is 3.90x, not 5.33x", method: "live arrest_at 709/182, and statically 1.75/0.45 = 3.889 via standingKey() + standing_ids join-path audit", agrees_with_builder: false }
    - { claim: "the walk writes no reputation", method: "monkey-patched every reputation-writing harness method at the boundary; reconciled live standing 192 against sum-of-declared-deltas 192", agrees_with_builder: "for the 9 quests that opened, yes; the 18-quest version does not reproduce" }
  unmeasured:
    - claim: "The end-to-end REFUSING walk (refuse at rank 6, still reach rank 7)"
      reason: |
        MY INSTRUMENT, NOT THE BUILD. My walk chooser raises attributes only for a resolution's
        `requires` and never for the RANK gate, and never sets disposition, so it stalled at
        Q-LEDG-04 on "the_wet_ledger rank 3/4" having applied 9/18 and never reached the rank-6
        quest. C2c and C3a are therefore inconclusive and are NOT scored against the build. This
        remains unmeasured by the builder (which said so plainly) and by me. It is path_to_ten #2.
    - claim: "The multi-signature sweep across the 18-quest lines"
      reason: "same stall — all 8 signatures reached rank 4, which measures my chooser and not the ladder."
    - claim: "The Imperial Assize and Xul-Aneekh lines re-run under the presence gate"
      reason: "one line was enough to establish non-reproducibility and the box was at 24-30 browsers; I did not spend three more page loads to make the same point."
    - claim: "The builder's delete-the-fix falsification of GAP-FCT-01"
      reason: "I read the fix and the bypass tool and accepted the builder's 6/6 rather than re-deriving it; my browser budget went to the claims nobody had checked."
    - claim: "RI-QST01 §7 blind-band test and RI-QST02 §8 blind read"
      reason: "blind_pair: yes on both items; I am not blind to either. Same as round 1."
    - claim: "Any timing or throughput figure"
      reason: "box at 11-30 browsers and loadavg 9.8-16.5 throughout; no ms figure is quoted anywhere."
```

---

## method_deviations

One tool written mid-critique, per `TOOL-LOOP.md` rule 1, plus three scratchpad scripts. The
browser tool reuses a single launched page at `--width 320 --height 240` with `setRenderRate(0)`.

| Tool | What it now measures |
|---|---|
| `tools/quests/critic-faction-r2.mjs` | **New, mine.** C0 giver-presence census through the shipped gate; C1 a reputation audit that **monkey-patches every reputation-writing harness method at the boundary** rather than trusting `faction-probe`'s own `repWrites` list, and reconciles the live standing against the sum of the taken resolutions' declared deltas; C2 a refusing walk; C3 an 8-signature sweep; C4 `factionLawFactor` perturbed **by play** plus a per-row pricing of the whole table. It suspends the presence gate for C1–C4 **deliberately and says so in its output**, to separate the faction round's own work from a gate it did not introduce. |
| scratchpad `break-method.mjs` | The §4 instrument test: mutates one resolution to `violence_required: true` and asks whether `QuestBook` throws, once for a known method (control, must go red) and once for a round-2 method. Exit 3 encodes "control red, test green". |
| scratchpad `prose-split.mjs` | Applies `tools/prose/rules.pre-registered.json` — the pre-registered rules, unmodified — separately to round-1 and round-2 faction journal and directions text. |
| scratchpad `struct.mjs` | Static re-derivation of the `RI-QST01`/`RI-QST02` count tables per half, independent of `faction-probe.mjs`. |

Existing tools run unmodified: `tools/quests/faction-probe.mjs` (the decisive run),
`tools/quests/critic-giver-presence.mjs`, `tools/prose/tic-detector.mjs`,
`tools/harness/boot-check.mjs`.

**Two of my own instruments went red for their own reasons and I report both**, because the round's
rule cuts both ways. My first `critic-faction-r2` run reported *"0/17 givers, 53 of 53 quests given
by nobody"* and I was one paragraph from filing "the faction content is unreachable" as the biggest
gap; `critic-giver-presence.mjs` — a tool written by a different critic for a different piece —
showed 62/62 faction givers present and talkable across the build's states, and the finding became
a much narrower and more accurate one about the *probe's* boot. And my `records_belief` marker
regex initially missed *"I do not think"*, reporting 4.2% where a corrected, generous test reports
13.4%; only the corrected number appears above.
