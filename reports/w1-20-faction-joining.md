# W1-20 — the faction skeleton: every line present, one quest deep

**Builder:** W1-20. **Measured at:** `f71088d`, tree dirty with this piece.
**Judged by:** RI-CRM02, RI-LOR01, RI-LOR02, RI-QST01, RI-QST03.
**Probe:** `tools/quests/faction-joining-probe.mjs`. **Shot:**
`docs/shots/2026-08-08-w1-20-the-drowned-court-says-no-in-its-own-words.png`.

The JSON artifacts (`reports/w1-20/joining.json`, `teardown.json`, `deletefix.json`,
`instrument-test.json`) are gitignored under `reports/.gitignore`'s rule — a run artifact is
reproducible from the tool that made it. **Two of the four are not**, and their numbers are
therefore transcribed in full below rather than left on a container: the teardown arm needs a
worktree with this piece's quest file deleted, and the instrument test needs `ui/hud.js` broken
on purpose. Re-run instructions are given with each.

---

## 1. The gap, measured before anything was built

Eight factions carry an eight-rank ladder in `game/data/quests/faction-gates.json`.
`corpus/30-quests/FACTION-ROSTER-DESIGN.md` §1 calls seven of them careers. A census of
`joins_faction` across the whole quest book at `3b0cc43`:

| faction | `joins_faction` routes | in the faction's own voice |
|---|---:|---|
| `the_wet_ledger` | 4 | yes — Q-LEDG-00 |
| `the_imperial_assize` | 3 | yes — Q-ASSZ-00 |
| `the_xul_aneekh` | 3 | yes — Q-XULA-00 |
| `the_dockhands` | 1 | **no** — `mainline-act4.json` Q-MAIN-21 `res_dockhand_rank` |
| `the_ixtu_vakh` | 1 | **no** — `mainline-act4.json` Q-MAIN-19 `res_cutters_rank` |
| `the_rootkeepers` | **0** | **no way in anywhere in the build** |
| `the_drowned_court` | **0** | **no way in anywhere in the build** |

And the consequence was already sitting in the tree, unlooked-at:

- `blackmarsh-coast.json` **Q-SOUL-02** carries `rank_gate: { the_drowned_court, min_rank: 2 }`.
  Nothing in the build joined the Drowned Court, so that gate could never open.
- `blackmarsh-coast.json` **Q-SAP-01** carries `rank_gate: { the_ixtu_vakh, min_rank: 1 }`,
  reachable only after Act IV of the main quest.

## 2. What was built

Four joining quests in `game/data/quests/faction-joining-wave1.json`, one per missing line, and
deliberately **no second quest for any of them** — the plan buys width in wave 1. 120 → 124 quests.

| quest | faction | recruiter | the work |
|---|---|---|---|
| `Q-ROOT-00` The Well That Is Not Counted | `the_rootkeepers` | `rootkeeper-jeen`, Helstrom undertemple | count a sapwell nobody has counted in two years |
| `Q-VAKH-00` A Stoppered Phial and a Buyer Who Waits | `the_ixtu_vakh` | `cutter-neeth`, Helstrom sap-house | carry two phials past the people who hate what is in them |
| `Q-CORT-00` The Fee Is the Same for All of You | `the_drowned_court` | `undertaker-vaskh`, Soulrest burning yard | bring a body in off the salt pans ahead of the tide |
| `Q-DOCK-00` A Place on the Boards | `the_dockhands` | `npc-porter-eeja`, foot of the Gideon crane | work one trial shift on a crane that drops its last foot |

Every resolution grants exactly the rank-1 reputation demand of **10** and no more, so finishing
the quest *is* joining and rank 2 still costs a second quest. **No new NPCs** — all four recruiters
already existed in `game/data/npcs/quest-givers.json` with a `reaction_group` and a post with
coordinates, each already giving a rank-gated quest for a faction nobody could enter.

Twelve `entry_topics` edges in `hooks.json` hand each line's next topic forward
(`the-hollow-count`, `the-phial`, `the-tally-of-the-dead`, `the-short-pay`), so a joining quest
opens that faction's existing rank-gated quest instead of ending in a rank and nothing.

## 3. The refusal, in voice

`game/data/dialogue/faction-refusals.json` + `game/src/sim/quest/refusal.js` +
`Engine.factionRefusal()`. **It states no threshold.** Every number is filled from
`FactionGates.evaluate()`, so `faction-gates.json` stays the only source of them and the prose
cannot drift from the rule. `QuestEngine.open()` calls it on the rank-gate refusal path, so the
line is reached from play and not only by a probe; before this, `open()` returned
`the_drowned_court rank 0/2; the_drowned_court reputation 0/22`.

Seven of seven, cold, at rank 0 asking for rank 1:

> **Rootkeepers** — "The slate has 0 beside your name and a Leaf has 10. That is not a rule I made and I cannot rub it out. Go and do some counting."
> **Drowned Court** — "The tally has you at 0. Knee-Deep is 10. You'll get there or you won't, and either way the bay keeps sending them."
> **Dockhands** — "The board doesn't know you. 0 against 10, and the hands put the names up, not me."
> **Ixtu-Vakh** — "I've heard your name 0 times and I want 10. Nobody starts here. Go and be useful where somebody's watching."
> **Wet Ledger** — "The margin has your name in it 0 times and the next line wants 10. The Ledger remembers people by the margin. Give it more to remember."
> **Imperial Assize** — "The roll records 0 against your name and the grade requires 10. Applications are considered when the roll supports them."
> **Xul-Aneekh** — "You are 0 to the hollow and the name you are asking for is 10. Names are not given. They are noticed."

## 4. The headline, measured through play

`node tools/quests/faction-joining-probe.mjs` — cold start, presence gate armed and never
suspended, no rank poked, topic learned through `learnTopic`, resolution skills raised by
`grantSkillUse` and a hearth rest (never `setSkills`), rank read back off the **derived** ladder.

| | |
|---|---:|
| laddered factions | 8 |
| joinable end to end through play | **7** |
| with a route in the faction's own voice | **7** |
| refusals spoken and **whole on the glass** | **7** |
| declared not joinable (`house_dres`, `shadowscale_order`, `deep_kin`) | 3 |

`deep_kin` is the eighth ladder and has no door. It is a duplicate id for the Xul-Aneekh
(`faction-reactions.json` aliases `deep_kin → xul-aneekh`); it is **not** deleted, because that
orphans another piece's `Q-MAG-07`, and it is exempted from the probe's verdict **only** because
`faction-refusals.json` declares it not-joinable in words a player can hear. An exemption a
player cannot be told about is not an exemption.

## 5. CONSUMPTION — RI-MTH07, mandatory under ARBITRATION §3

A rank is perturbed on `the_rootkeepers` and three separate things in the running world move.
None of them is the quest data.

| | consumer | rank 0 | rank 1 | rank 5 |
|---|---|---:|---:|---:|
| **C1** the guard | `syncFactionStandings()` → `standingKey()` → `faction_law_factor` → `warbroodDispositionShift()` | 0 | **+22** | **+34** |
| **C2** the recruiter's mouth | `Engine.factionRefusal()` | refusal on reputation | refusal on the next term | welcome |
| **C3** the offer gate | `QuestEngine.open('Q-SOUL-02')` | rank **and** reputation in the reason | rank **and** reputation in the reason | both terms gone, quest opens |

C1 is the AR-3 crossing and changes **nothing about the enemies** — same archetype ids, same
statblocks, same movesets. What moves is a number the law reads.

Adding `joins_faction` for the two new joinables made `tools/check-data.mjs` assertion A go **red
on the same commit** — *"`the_rootkeepers` can be JOINED by a quest resolution but has no
`faction_law_factor.standing_ids` entry"*. That is the assertion working. Closed with four rows in
`sanction.json` and four `standingKey()` branches; `check-data` now reports **7 joinable factions
mapped, 19/19 rows selectable**.

## 6. DELETE-THE-FIX

**Method.** `git worktree add --detach <tmp> HEAD`; every file this piece wrote copied in
**except** `game/data/quests/faction-joining-wave1.json`; `data-index.mjs --write`; probe run with
`--entry <tmp>/game/index.html` so its route census scans that worktree and not the live tree.

| | armed | control |
|---|---:|---:|
| joinable end to end | **7** | **3** |

| faction | control arm result |
|---|---|
| `the_wet_ledger`, `the_imperial_assize`, `the_xul_aneekh` | **still green** |
| `the_rootkeepers`, `the_drowned_court` | *"no resolution anywhere in the quest book joins this faction — an eight-rank ladder with no door"* |
| `the_dockhands`, `the_ixtu_vakh` | *"open refused: requires Q-MAIN-15 first"* |

**The control is not inert.** Three of seven stay green. If the teardown did nothing every line
would pass; if it were a blunt instrument every line would fail. Exactly the four this piece added
went red.

**And it measured something that had only been asserted.** Ruling S-W1-20-A said the Dockhands and
the Ixtu-Vakh were reachable only through a main-quest Act IV resolution. The control arm returned
`requires Q-MAIN-15 first` for both, which is that claim as a fact rather than as a reading of the
data.

**Second, separate control.** The refusal *voice* has its own teardown,
`__breakFactionRefusalVoice()`, inside the probe. It mutes speech and nothing else: both arms still
refuse with byte-identical reasons (`gate_unchanged_by_the_control: true`) and differ only in
whether a person hears anything (`control_went_red: true`, `arms_genuinely_differ: true`).

## 7. RULE 4 — the instrument was wrong twice, and the second one looked like a pass

Re-run: set `const maxW = 99999 * s;` in `game/src/ui/hud.js` and run the probe.

1. The probe's on-screen check first asked whether **some** drawn run was a substring of the
   refusal. It returned `true` for a sentence with its first four words and its last five off the
   paper. `ui/hud.js` drew one unwrapped centred run on a 400-unit panel, so a 676 px refusal ran
   off both ends of it — and `getRenderedText()` reported `clipped: false`, because nothing had
   clipped it. **The photograph caught what the probe did not.**
2. Rewritten to compare the joined rows against the whole line *and* the element's fit report — and
   the fit was computed inside `hud.js` against the same `maxW` the wrapper uses. Setting `maxW` to
   99999 **moved the yardstick with it**, and the test came back green on a line measuring 823 px
   across a 400 px panel. That is an inert control, and every signal said it had passed.
3. The fit is now derived in `ui/system.js` from the element **rect**, which the drawing code does
   not set. Same break: `widest_px 823.4`, `panel_w 400`, `overflow_px 423.4`, `fits false`,
   **7 of 7 lines red, probe exit 1.**

`ui/hud.js` wraps the toast now, to three lines with an ellipsis on overflow. This affects **every**
toast in the build — equip refusals, cast refusals — not only faction ones. A short toast keeps the
same rect and the same coverage.

## 8. What this piece did NOT do

- **Escalation, expulsion and rivalry** inside the four new lines. Wave 2; the plan says so.
  `faction-discipline.json` still covers the three carried lines only.
- **Depth.** Each new line is exactly one quest, against the carried lines' eighteen. A critic
  scoring **RI-QST01**'s *mean quests per rank ≥ 2.0* over all seven lines will find it far below
  the hard fail. That is ruling S-W1-20-C and the brief, not an oversight.
- **The Drowned Court still cannot reach Q-SOUL-02 by play.** It wants rank 2 = 22 reputation and
  RI-QST03 §B caps a quest at +4..+10. The gate now *moves with the rank* — shown by perturbation —
  but the second quest that carries a player over it is wave 2.
- **`deep_kin`** still has a ladder and no door, by ruling S-W1-20-B.
- **`game/data/progression/factions.json` was not promoted into a real roster.** Its only reader is
  `tools/lib/gamedata.mjs` — tools-side, not world-side — so a bigger model there would be a model
  nothing in the running world reads. It now declares what it is and names the ladder of record.
  Reversible the moment a world-side consumer for a roster exists.
- **The four recruiters were not walked to.** `travelToGiver()` proves each is in the populated
  world at a post with coordinates; it does not walk. Five of six enchanter posts in this game were
  unreachable on foot and only a walk found that out.

## 9. Gates at finish

`boot-check` PASS · `check-data` PASS (7 joinable mapped, 19/19 rows selectable) ·
`check-quests` PASS (124 quests) · `check-content` PASS · `check-append-only` PASS.

`check-prose`: **67 regressions, the same count as before this piece.**
`faction-joining-wave1.json` is not in the list — 0 stings, 0 tics, contractions in band. It is the
only faction quest file in the tree that is clean; the three carried ones each carry a sting
overshoot and a contraction undershoot.

`check-shipped-files` reports `game/src/__ghost.js` missing, imported by `game/src/__gatecheck.js`.
That is **another agent's staged gate-falsification fixture**, present in the index when I
committed. Not mine, not touched.
