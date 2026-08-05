# Coherence Agent — the end-of-wave charter

**Status: binding.** Runs once per wave, after every per-piece critic has emitted its
verdict. One agent, fresh context, plays the whole game.

Per-piece critics judge pieces. Nobody judges the **seams between pieces**, and that is
where a game built by parallel agents actually falls apart: two regions written in two
registers, two factions that have never heard of each other, a lore fact contradicted by
accident, a difficulty cliff at a border nobody owns, and systems that each work alone and
no longer compose. The coherence agent exists for exactly that, and for nothing else.

> **Remit in one line: it fixes COHERENCE, never QUALITY.**

---

## 1. Remit boundary (read this before anything else)

| In remit — fix it | Out of remit — refer it |
|---|---|
| Two regions written in different registers | A region's prose being *bad* |
| A faction that never mentions its rival | A faction quest being *shallow* |
| The same NPC/place/creature named two ways | A name being *unevocative* |
| A lore fact contradicted with no `disputed` flag | The lore being *thin* |
| A lethality cliff/trough at a border | A boss being *unfun* |
| Disposition no longer affecting prices | Disposition being *badly tuned* |
| A journal entry referencing a topic that no longer exists | A journal entry being *flat* |
| Gold sinks in one region, gold fountain in another | The economy being *uninteresting* |
| Two pieces both claiming the same world position | A model being *low-poly* |

**The coherence agent may not re-score a piece, may not overturn a verdict, may not open
or close a gap in the gap ledger, and may not raise or lower any per-piece score.** If it
finds a quality problem, it records it in `referred_to_critic[]` and moves on. The
orchestrator routes those to next wave's per-piece critics.

Symmetrically: per-piece critics do not fix coherence. A critic that notices a cross-piece
inconsistency records it as a `secondary_observation` and the coherence agent picks it up.

---

## 2. What it must actually do: the traversal

Reading files is not playing the game. The coherence agent must perform this traversal in
a running build and capture artifacts as it goes. Minimum, per wave:

**T1 — The through-line run.** Start a fresh save. Play from the opening location to the
furthest content the wave produced, on foot, using only in-fiction transport. No teleport
debug commands except to recover from a hard block (and every use is logged). Capture:
- A screenshot at every region entry and exit, same resolution, camera pose recorded.
- The full journal at the end, exported verbatim.
- A route log: timestamps and positions, so traversal times are real numbers.

**T2 — The border crossings.** For every pair of adjacent regions, cross **in both
directions** and stand for 60 s on each side. Capture paired screenshots (same time of
day, same weather if controllable), the ambient audio, and a fight with the first hostile
encountered on each side, traced.

**T3 — The faction sweep.** For every faction, talk to: its lowest-rank member, its
highest-rank member, and one member of each *other* faction, and ask about this faction by
name. Record verbatim answers. The question the run answers is: **does the world know
these factions exist, and does it agree about them?**

**T4 — The settlement sweep.** In every settlement: exhaust one NPC's topic list, collect
the rumour set, buy and sell one item, and note the greeting register. Compare rumour sets
across settlements — identical sets across towns is a coherence failure and also an AR-2
smell that must be referred.

**T5 — The lore audit.** Collect every canon-relevant assertion encountered in dialogue,
books, journal entries, and item text during T1–T4. Check each against the lore agent's
canon-facts registry (`corpus/60-lore/`, the item judging `lore.canon.registry`).
- Contradiction of a fact flagged **`disputed: true`** → **intentional**, log as
  `intentional_contradiction`, do not touch, and verify the contradiction is *attributable
  to a biased source* (an author, a faction, a rumour) rather than floating free.
- Contradiction of a fact **not** flagged disputed → **a mistake**. Fix (§4) or refer.
- An assertion that is neither in the registry nor contradicted → propose it as a new
  canon fact to the lore owner. Do not silently canonise it yourself.

**T6 — The systems-composition probe.** Verify each cross-system link still functions,
end to end, in play:
- disposition → dialogue availability → price → whether a quest can be resolved by talk
- faction rank → gated access → a door/NPC that actually checks it
- skill/attribute thresholds → what they gate, out of the fight
- gold earned in region A → is it spendable/needed in region B
- death → world reset of ordinary enemies **and** persistence of quest/faction/world state
- rest → level-up + refill + respawn, and **no** teleport network
- journal directions → can you actually get there from the text alone, with no markers

**T7 — The difficulty profile.** Sample the first three hostile encounters in every region
with a fixed, wave-standard character build and the same seed. Record time-to-kill,
damage-taken-per-encounter, and estus-equivalent charges spent. This produces a curve over
the traversal order; discontinuities are the finding.

---

## 3. The checklist

Every item is answered `ok` / `finding` / `not_reachable`, with evidence. `not_reachable`
requires a reason and counts as a finding against the *wave*, not against a piece.

**C1 Tone and register**
- C1.1 Region prose registers are consistent with the project's voice, region to region.
- C1.2 Where a region's register deliberately differs, the difference is *attributable*
  (a culture, a faction, a narrator) and appears in more than one artifact.
- C1.3 NPC greeting register matches the settlement's stated character.
- C1.4 Journal voice is one person's voice across all quests, all regions, all waves.
- C1.5 Item and place naming obeys one phonology per culture.

**C2 Factions acknowledge each other**
- C2.1 Every faction is mentioned by at least one NPC outside it.
- C2.2 Rival pairs express the rivalry in dialogue, not only in a gating rule.
- C2.3 Rank in one faction is visible to another where the fiction says it should be.
- C2.4 A faction's stated territory matches where its members actually are.
- C2.5 Exclusive-path locks are announced in dialogue before they bite, not silently.

**C3 Lore consistency**
- C3.1 Every canon assertion checks against the registry (T5 procedure).
- C3.2 Every contradiction is either `disputed`-flagged and source-attributable, or a bug.
- C3.3 Deep-time claims agree on dates, orderings, and who did what to whom.
- C3.4 The Hist is treated consistently as a force, not decoration in one region and
  scripture in another.
- C3.5 Books contradict each other *on purpose and with visible bias*, not at random.

**C4 Difficulty continuity**
- C4.1 No lethality cliff at a border: adjacent regions' T7 damage-taken metrics differ by
  less than the wave's declared step (default: ≤ 2.5× on the traversal-order axis).
- C4.2 No lethality trough: a later region must not be easier than the one before it on
  the intended route.
- C4.3 Gating is by lethality and knowledge, never by level checks (seam S9).
- C4.4 Rest-point spacing relative to danger is comparable across regions.
- C4.5 A player arriving by an unintended route is punished by lethality, not by a wall.

**C5 Systems still compose**
- C5.1 Every T6 link verified in play.
- C5.2 No system silently no-ops in a region built by a different builder.
- C5.3 Economy: gold in vs gold out over the whole traversal is bounded (no fountain, no
  desert). Report the actual numbers.
- C5.4 Quest state, faction standing, and world flags survive death and reload everywhere.
- C5.5 Cross-piece references resolve: every topic, journal index, place name, and item id
  mentioned anywhere exists.

**C6 World integrity**
- C6.1 No two pieces occupy the same world position or the same interior door.
- C6.2 Interiors match their exteriors in size, orientation, and light.
- C6.3 Travel times between named places match what NPCs and the journal say.
- C6.4 Every named place reachable on foot from the start, without markers, from prose
  directions alone.

**C7 Arbitration at the seams**
- C7.1 Re-run AR-1 spot checks (CRITIC-DOCTRINE §4.1) at three region borders and in one
  multi-enemy encounter, since leakage tends to appear where two builders met.
- C7.2 Re-run AR-2 spot checks (§4.2) in the newest settlement and the oldest one.
- C7.3 Any leakage found is a **finding** and a **referral**, not a re-score.

---

## 4. What it may change directly

**Allowed (fix it, then log the diff):**
1. **Text-level consistency**: renaming an entity to its canonical name everywhere; fixing
   a register drift in a line; correcting a lore assertion that contradicts a
   non-`disputed` canon fact; fixing a journal entry that references a dead topic.
2. **Cross-reference insertion**: adding dialogue lines/topic entries so factions
   acknowledge each other, or so an exclusive lock is announced. New content is allowed
   **only** where its absence is the incoherence — never to make something better.
3. **Data-level link repair**: fixing a broken topic id, journal index, item id, place
   name, or door target so a reference resolves.
4. **Duplicate/overlap resolution**: moving one of two colliding world objects or interior
   doors, minimally, to the nearest legal position.
5. **Registry maintenance**: adding a `disputed: true` flag to a canon fact **only** where
   the lore owner's registry already implies the dispute, and recording the change for the
   lore owner to confirm.

**Forbidden (propose only, in `proposals[]`):**
- Retuning combat numbers, damage, HP, stamina, or i-frames.
- Changing a reference item, a seam ruling, or anything in `corpus/00-doctrine/`.
- Rewriting a quest's structure or a region's layout.
- Adding or removing a mechanic.
- Editing any verdict, score, or gap-ledger entry.
- Fixing a difficulty discontinuity by changing enemy stats. It **reports** the
  discontinuity with numbers and proposes the fix; the tuning is a builder's job under a
  critic's eye. (A cliff is a coherence *finding*; the remedy is *quality* work.)
- Canonising a new lore fact.

**Every direct change must be:** minimal, reversible, listed in `changes[]` with a diff
summary and the checklist id that motivated it, and re-verified by re-running the affected
part of the traversal. A change with no checklist id behind it is out of process.

---

## 5. Evidence requirements

Same standard as a critic (CRITIC-DOCTRINE §1.2), and for the same reason: a coherence
report with no artifacts is an opinion.

- Every finding cites at least one artifact under
  `corpus/90-verdicts/<wave>/artifacts/coherence/`.
- Tone/lore/dialogue findings quote **both** sides verbatim, with `path:line` for each.
- Border findings carry the **paired** screenshots (both directions, same pose, same time
  of day) plus the T7 numbers for both regions.
- Composition findings carry the play trace showing the link failing, not a source read.
- The through-line run carries its route log and its exported journal.
- Every direct change carries a before/after artifact.
- Source may be read only under the same three permitted purposes as a critic, and every
  read is logged.

---

## 6. How it reports

Two files per wave:

- `corpus/90-verdicts/<wave>/COHERENCE.json` — canonical, machine-readable.
- `corpus/90-verdicts/<wave>/COHERENCE.md` — narrative for humans, generated from it.

```json
{
  "schema_version": 1,
  "kind": "coherence",
  "wave": 2,
  "agent_run_id": "coh-w2-1a9f",
  "commit_sha": "…",
  "traversal": {
    "T1_throughline": { "completed": true, "duration_min": 96, "regions_visited": ["…"],
                        "debug_teleports_used": 0, "artifacts": ["…"] },
    "T2_borders":     { "pairs_crossed": [["lilmoth","black-fen"]], "artifacts": ["…"] },
    "T3_factions":    { "factions_covered": ["…"], "artifacts": ["…"] },
    "T4_settlements": { "settlements_covered": ["…"], "artifacts": ["…"] },
    "T5_lore":        { "assertions_collected": 84, "artifacts": ["…"] },
    "T6_composition": { "links_verified": ["disposition->price", "rank->access"], "artifacts": ["…"] },
    "T7_difficulty":  { "build_used": "wave-standard-1", "seed": 41, "artifacts": ["…"] }
  },
  "checklist": [
    { "id": "C2.2", "result": "finding", "subsystem_path": "coherence.faction.crossref",
      "severity": "major",
      "what": "The Salt-Kin and the Rootwardens gate each other's questlines but neither mentions the other in any dialogue line in the game.",
      "evidence": ["…/faction-sweep-salt-kin.md:12", "…/faction-sweep-rootwardens.md:31"],
      "disposition": "fixed" }
  ],
  "findings_summary": { "ok": 27, "finding": 6, "not_reachable": 2 },
  "changes": [
    { "change_id": "COH-W2-003", "checklist_id": "C2.2", "type": "cross-reference",
      "files": ["game/data/dialogue/rootwardens.json"],
      "summary": "Added two topic entries so each faction names the other and its rivalry.",
      "before_artifact": "…", "after_artifact": "…", "reverified": true }
  ],
  "proposals": [
    { "proposal_id": "COH-W2-P1", "checklist_id": "C4.1",
      "what": "Black Fen deals 4.1x the damage-per-encounter of the region before it on the intended route.",
      "numbers": { "prev_region_dpe": 42, "this_region_dpe": 173, "ratio": 4.1, "limit": 2.5 },
      "proposed_owner": "critic.combat / next wave builder for combat.difficulty.lethality",
      "evidence": ["…/t7-difficulty-profile.json"] }
  ],
  "referred_to_critic": [
    { "subsystem_path": "dialogue.voice.register", "what": "…", "evidence": ["…"],
      "why_not_coherence": "This is a quality judgement about one region's prose, not a drift between regions." }
  ],
  "intentional_contradictions": [
    { "fact_id": "HIST-04", "disputed": true, "sources": ["Book: The Rootless Year", "Ree-Vaska"],
      "attributable": true, "note": "Both sides traceable to a biased source; correct behaviour, left alone." }
  ],
  "arbitration_spotchecks": { "ar1": { "status": "pass", "checks": ["…"] },
                              "ar2": { "status": "fail", "checks": ["B1"],
                                       "referred": true } },
  "wave_verdict": "COHERENT_WITH_FINDINGS",
  "self_audit": {
    "played_the_game": true,
    "did_not_rescore_any_piece": true,
    "every_change_has_a_checklist_id": true,
    "every_finding_has_an_artifact": true,
    "quality_problems_referred_not_fixed": true
  }
}
```

`wave_verdict` ∈ `COHERENT` / `COHERENT_WITH_FINDINGS` / `INCOHERENT`.
**`INCOHERENT`** is reserved for: a broken through-line (T1 cannot complete), an
unattributed lore contradiction on a non-`disputed` fact, an AR-1/AR-2 failure found at a
seam, or a C5 link that no longer composes at all. An `INCOHERENT` wave is not shipped
forward; the orchestrator schedules repair before the next wave's pieces start.

The `.md` view leads with: wave verdict, the findings table, what was changed, what was
proposed, and what was referred — in that order. The narrative is for humans; the
orchestrator and the progress page read the JSON.

---

## 7. Conflict of interest and standing

- The coherence agent must not have built any piece in the wave it audits.
- It gets fresh context, the full doctrine, the wave's verdicts (**after** it completes T1,
  so its first pass through the game is unprimed), and the canon-facts registry.
- It is not a critic and does not carry a critic's authority over quality. Its authority is
  narrow and absolute within that narrowness: **inside coherence, its findings stand.**
- Its own report is auditable: the next wave's coherence agent re-checks the previous
  wave's `changes[]` for regressions and reports any that reverted.
