---
id: RI-QST04
title: Quest stage anatomy and the canonical quest schema
kind: structure
side: morrowind
judges: [quests.schema, quests.stages, quests.branching, quests.journal, quests.failure, data.quests]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

A Morrowind quest is not a state machine with a marker on top. It decomposes into: a **giver** with a
disposition threshold; a **topic** that opens it (never a map pin); **prose directions** sufficient to
find the place; a set of **numbered journal indices** that are non-contiguous, first-person, and
occasionally wrong; **branch points** where discovered information or player choice forks the path;
**multiple resolutions** with different methods and requirements; **failure states**, including silent
ones; and a **reward table** that varies by resolution. The bar is that every quest in our game
serialises to one JSON file that captures all of this, such that a critic with no context can run three
commands and get: mean branch count, mean solution count, failure-state coverage, non-combat
resolvability, deceit coverage, and unique-reward fraction. **The schema is the contract for every other
QST item.** If a quest cannot be expressed in it, either the quest is out of spec or the schema needs an
amendment recorded here — never an ad-hoc field.

Schema file: **`corpus/30-quests/quest.schema.json`** (JSON Schema draft 2020-12).

## The reference artifact

### A. Anatomy of a Morrowind quest, part by part

| Part | Morrowind behaviour | Schema field |
|---|---|---|
| Giver | A named NPC in a named interior with a disposition floor; refuses below it | `giver{npc_id, location, disposition_min, honest}` |
| Opening | A **dialogue topic** appears because of a greeting, a rumour, or another topic. Some quests are opened by a book or a corpse and are never "given" | `discovery`, `opens_by{topic, prerequisite_topics, overheard_from}` |
| Wayfinding | Prose: "north of the Odai, past the bridge, the second house on the left" | `directions` |
| Journal | Numbered indices (10, 20, 30, 45, 100…), deliberately sparse so entries can be inserted; text is first-person and records belief | `journal[]{index, text, state, records_belief}` |
| Branches | The quest forks on what the player learns or chooses; some forks are irreversible | `branches[]{at_journal_index, condition, leads_to[], irreversible}` |
| Resolutions | Kill / persuade / bribe / sneak / steal / know-a-thing / refuse / betray, each with its own requirements and outcome | `resolutions[]` |
| Failure | Target dies, item is destroyed, a timer elapses, another faction gets there first. Sometimes the game never says so | `failure_states[]{cause, recoverable, silent}` |
| Consequences | Faction reputation on **more than one** faction; other quests unlocked or locked; world flags | `consequences{}` |
| Reward | Varies by resolution; frequently a unique named item, access, or information rather than gold | `rewards[]{type, unique_named, on_resolution[]}` |
| Deceit | The giver's real objective and the channels through which the player can find out | `deceit{}` (see RI-QST02) |

### B. Journal index convention (binding)

Morrowind's journal indices are sparse integers, not sequence numbers. We adopt:

| Index band | Meaning |
|---|---|
| 1–9 | Rumour / pre-quest awareness ("I have heard that…") |
| 10 | Quest accepted — states the objective **as the player understood it** |
| 11–39 | Progress; each meaningful discovery gets its own index; gaps of ≥ 5 between entries so new ones can be inserted later without renumbering |
| 40–69 | Post-reveal entries; at least one must contradict a sub-40 entry in a deceitful quest |
| 70–89 | Failure states (each failure gets a distinct index) |
| 90–99 | Success states — **one index per resolution**, never a shared "quest complete" |
| 100 | Quest closed / no further entries |

Rules: entries are past-tense first person; no entry begins with an imperative verb; a success index is
never reused across resolutions (this is how the analyser knows the resolutions are actually distinct in
the fiction, not just in the data).

### C. Canonical worked example

An original Black Marsh quest, written to exercise every part of the schema. This file is the reference
a builder copies. (Names are ours; no Morrowind content is reused.)

```json
{
  "id": "Q-XANM-07",
  "title": "The Weight of the Ledger",
  "category": "faction",
  "faction": "xanmeer-factors",
  "act": null,
  "rank_gate": { "faction": "xanmeer-factors", "min_rank": 3, "min_reputation": 36 },
  "discovery": "given",
  "giver": {
    "npc_id": "npc_teeba_ei",
    "location": "Stillwater Counting-House, upper floor",
    "disposition_min": 40,
    "honest": false
  },
  "opens_by": {
    "topic": "the flooded warehouse",
    "prerequisite_topics": ["factor's tithe", "Stillwater"],
    "prerequisite_quests": ["Q-XANM-05"]
  },
  "task_kind": "retrieval",
  "stakes": 5,
  "directions": "Follow the boardwalk south from the counting-house until the planks go under water, then take the left branch where the mangroves close overhead. The warehouse sits on stilts about a half-hour's walk out; you will smell it before you see it.",
  "journal": [
    { "index": 4,  "state": "active", "text": "Someone in the counting-house yard said the Factors lost a warehouse to the flood last season and never wrote it off. I do not know what that means yet.", "records_belief": false },
    { "index": 10, "state": "active", "text": "Teeba-Ei asked me to recover the Factors' ledger from the flooded warehouse south of Stillwater. She says it is our property and the marsh is eating it.", "records_belief": true },
    { "index": 20, "state": "active", "text": "The warehouse is not abandoned. A family of six is living on the dry floor, and they say they have been there two years.", "records_belief": false },
    { "index": 25, "state": "active", "text": "Deel-Wassa says the ledger is her mother's, and that the Factors' claim on this warehouse was settled and paid. She offered to show me the settlement mark.", "records_belief": false },
    { "index": 40, "state": "branch",  "text": "The settlement mark is real. Teeba-Ei's own hand is on it. She did not send me to recover a ledger; she sent me to remove the only copy of a debt she has already been paid for.", "records_belief": false },
    { "index": 90, "state": "success", "text": "The warehouse is empty and the ledger is in Teeba-Ei's hands. She counted the pages before she paid me, and did not ask how I had emptied the place.", "records_belief": false },
    { "index": 91, "state": "success", "text": "I took the ledger out of the warehouse without waking anyone. Teeba-Ei paid in full. The family keep their roof for as long as the debt lets them, which I now know is not long.", "records_belief": false },
    { "index": 92, "state": "success", "text": "I told Deel-Wassa what the ledger was for. She has sent the settlement mark to the Xanmeer court, and Teeba-Ei knows it was me.", "records_belief": false },
    { "index": 94, "state": "success", "text": "I copied the settlement mark, gave Teeba-Ei the ledger, and kept the copy. Neither of them knows the other is holding half a truth. I am not sure how long that lasts.", "records_belief": false },
    { "index": 96, "state": "success", "text": "I told Teeba-Ei I would not do it. She did not argue. She simply stopped speaking to me as though I were a Factor.", "records_belief": false },
    { "index": 70, "state": "failure",  "text": "The family are dead and the ledger is ash. Whatever was written in it is now only what Teeba-Ei says it was.", "records_belief": false },
    { "index": 72, "state": "failure",  "text": "The flood took the warehouse before I got back to it.", "records_belief": false }
  ],
  "branches": [
    {
      "id": "br_arrival",
      "at_journal_index": 20,
      "condition": "Player enters the warehouse and encounters the family: fight, talk, or withdraw",
      "leads_to": ["res_burn", "rev_family", "fail_flood"],
      "irreversible": false
    },
    {
      "id": "br_truth",
      "at_journal_index": 40,
      "condition": "Player has seen the settlement mark and must decide who is owed the truth",
      "leads_to": ["res_deliver", "res_expose", "res_copy", "res_refuse"],
      "irreversible": true
    }
  ],
  "resolutions": [
    {
      "id": "res_burn",
      "method": "combat",
      "violence_required": true,
      "journal_index": 90,
      "outcome": "The family is killed or driven out and the ledger delivered. Teeba-Ei pays in full and the debt stands.",
      "morally_better": false,
      "requires": {}
    },
    {
      "id": "res_deliver",
      "method": "steal",
      "violence_required": false,
      "journal_index": 91,
      "outcome": "The ledger is delivered without bloodshed. The family keeps the warehouse but loses the settlement mark and, eventually, the warehouse.",
      "requires": { "skills": { "security": 25 } },
      "requires_knowing": []
    },
    {
      "id": "res_expose",
      "method": "betray",
      "violence_required": false,
      "journal_index": 92,
      "outcome": "The settlement mark reaches the Xanmeer court. Teeba-Ei is censured, the player's standing with the Factors falls hard, and the family keeps the warehouse.",
      "requires": { "disposition": 55 },
      "requires_knowing": ["rev_mark"],
      "exclusive_with": ["res_deliver", "res_copy"]
    },
    {
      "id": "res_copy",
      "method": "lore_knowledge",
      "violence_required": false,
      "journal_index": 94,
      "outcome": "Both parties are satisfied and neither is safe. The copy becomes leverage the player can spend in Q-XANM-11.",
      "requires": {
        "skills": { "scribing": 35 },
        "knowledge": ["topic_marsh_settlement_law"],
        "items": ["item_reed_stylus"]
      },
      "requires_knowing": ["rev_mark"]
    },
    {
      "id": "res_refuse",
      "method": "refuse",
      "violence_required": false,
      "journal_index": 96,
      "outcome": "The player declines. Teeba-Ei never offers Factor work again; the dissenter Factor Wuleen-Kus begins speaking to the player.",
      "requires": {},
      "requires_knowing": ["rev_mark"]
    }
  ],
  "failure_states": [
    { "id": "fail_kill_deel", "cause": "Deel-Wassa dies before journal index 25", "journal_index": 70, "recoverable": false, "consequence": "The settlement mark is never found; res_expose, res_copy and res_refuse become unreachable and the quest can only close via res_burn.", "silent": true },
    { "id": "fail_flood",     "cause": "The seasonal flood arrives (14 in-game days after index 10) with the ledger still in the warehouse", "journal_index": 72, "recoverable": false, "consequence": "Quest closes unresolved; Teeba-Ei's account of the debt becomes the only account; −8 Factor reputation.", "silent": false }
  ],
  "can_fail": true,
  "deceit": {
    "patterns": ["D1", "D2", "D12"],
    "stated_objective": "Recover Factor property from a derelict building",
    "actual_objective": "Destroy evidence that a debt Teeba-Ei collected twice was already settled",
    "truth": "The warehouse was settled and paid for; Teeba-Ei's own mark is on the settlement.",
    "revealed_by": [
      { "id": "rev_family", "channel": "talk_to_target", "source": "npc_deel_wassa", "before_point_of_no_return": true },
      { "id": "rev_mark",   "channel": "ledger",         "source": "item_settlement_mark", "before_point_of_no_return": true },
      { "id": "rev_dissent","channel": "rival_npc",      "source": "npc_wuleen_kus", "before_point_of_no_return": true }
    ],
    "never_revealed": false
  },
  "consequences": {
    "faction_reputation": { "xanmeer-factors": 6, "stillwater-commons": -6 },
    "npc_disposition": { "npc_wuleen_kus": 15 },
    "unlocks": ["Q-XANM-09"],
    "locks": [],
    "world_flags": ["warehouse_ledger_resolved"],
    "kills_npc": []
  },
  "mutually_exclusive_with": [],
  "kill_required_npcs": [],
  "rewards": [
    { "type": "gold", "unique_named": false, "amount": 300, "on_resolution": ["res_burn", "res_deliver", "res_copy"] },
    { "type": "item", "unique_named": true, "id": "item_factors_seal_ring", "name": "Teeba-Ei's Second Seal", "on_resolution": ["res_deliver", "res_copy"] },
    { "type": "information", "unique_named": true, "id": "topic_double_tithe", "name": "the double tithe", "on_resolution": ["res_expose", "res_copy", "res_refuse"] },
    { "type": "ally", "unique_named": true, "id": "npc_wuleen_kus", "name": "Factor Wuleen-Kus", "on_resolution": ["res_expose", "res_refuse"] }
  ],
  "notes": "Reference example for RI-QST04. Exercises D1/D2/D12, 5 resolutions (4 non-violent), 2 failure states (1 silent), branch count 2, 4 rewards of which 3 unique."
}
```

Derived metrics for this file: `resolutions = 5`, non-violent resolutions = 4, `branches = 2`,
`failure_states = 2`, `kill_required_npcs = []` → zero-kill completable, `deceit` present with 3 reveal
channels all reachable, unique rewards = 3/4.

### D. Structural targets (constructed, binding, game-wide)

| Metric | Target | Hard fail |
|---|---|---|
| Schema validation | 100% of quest files validate | any file fails |
| Mean `resolutions.length` | ≥ 2.4 | < 2.0 |
| Quests with `resolutions.length == 1` | ≤ 15% | > 30% |
| Mean `branches.length` | ≥ 1.3 | < 1.0 |
| Quests with ≥ 1 `failure_states` entry | ≥ 70% | < 40% |
| Quests with `can_fail: false` | ≤ 20% | > 40% |
| Silent failures (`silent: true`) | 5–15% of failure states | 0 or > 30% |
| Mean `journal.length` | ≥ 5 | < 4 |
| Journal entries per resolution (distinct success index) | 1.0 exactly | any shared success index |
| Quests with non-empty `directions` | 100% | < 100% (marker-dependence, AR-2) |
| Quests whose `consequences.faction_reputation` has ≥ 2 keys | ≥ 30% | < 10% |

## Comparison method

A fresh agent runs these in order from the repo root. No prior context needed.

```bash
# 0. Validate — everything downstream is void if this fails.
npx ajv-cli validate -s corpus/30-quests/quest.schema.json \
    -d "game/src/data/quests/*.json" --spec=draft2020 --strict=false

# 1. Headline structural metrics.
jq -s '{
  n: length,
  mean_resolutions: ((map(.resolutions|length)|add) / length),
  single_solution_pct: ((map(select((.resolutions|length)==1))|length) / length * 100),
  mean_branches: ((map(.branches // [] | length)|add) / length),
  with_failures_pct: ((map(select((.failure_states|length) > 0))|length) / length * 100),
  silent_failure_pct: (([.[].failure_states[] | select(.silent)]|length)
                       / ([.[].failure_states[]]|length) * 100),
  mean_journal: ((map(.journal|length)|add) / length),
  no_directions: (map(select((.directions // "") | length < 20) | .id)),
  multi_faction_consequence_pct: ((map(select(((.consequences.faction_reputation // {})|length) >= 2))|length) / length * 100)
}' game/src/data/quests/*.json

# 2. Distinct success index per resolution (catches fake branching).
jq -s -r '.[] | . as $q
  | ([$q.resolutions[].journal_index] | group_by(.) | map(select(length>1)) | length) as $dupes
  | select($dupes > 0) | "\($q.id): resolutions share a success journal index"' \
  game/src/data/quests/*.json

# 3. Referential integrity — every branch target must be a declared resolution,
#    failure state, sibling branch, or reveal. (Note the explicit `as $tgt` binding:
#    `index(.)` after a pipe rebinds `.` to the array and silently always passes.)
jq -s -r '.[] | . as $q
  | ([$q.resolutions[].id] + [$q.failure_states[].id]
     + [($q.branches // [])[].id] + [($q.deceit.revealed_by // [])[].id] | unique) as $t
  | ($q.branches // [])[] | . as $b | $b.leads_to[] as $tgt
  | select(($t | index($tgt)) == null)
  | "\($q.id): branch \($b.id) points at unknown target \($tgt)"' game/src/data/quests/*.json

# 4. requires_knowing must reference a declared reveal.
jq -s -r '.[] | . as $q
  | ([($q.deceit.revealed_by // [])[].id]) as $revs
  | $q.resolutions[] | . as $r | (.requires_knowing // [])[] as $k
  | select(($revs | index($k)) == null)
  | "\($q.id):\($r.id) requires unknown reveal \($k)"' game/src/data/quests/*.json

# 5. Journal index discipline (bands from section B).
jq -s -r '.[] | . as $q | $q.journal[]
  | select((.state=="success" and (.index < 90 or .index > 99))
        or (.state=="failure" and (.index < 70 or .index > 89)))
  | "\($q.id): journal \(.index) is state \(.state), outside its band"' game/src/data/quests/*.json
```

Checks 2–5 must all return empty output. Check 1's numbers are compared against section D.

**Amendment rule:** if a builder needs a field the schema lacks, they add it to
`corpus/30-quests/quest.schema.json` **and** append a row to a `## Schema amendments` section in this
file with the wave number and rationale, per CORPUS-CONTRACT §5. Ad-hoc fields are rejected by
`additionalProperties: false` at validation time, which is deliberate.

## Scoring

| Band | Condition |
|---|---|
| 9–10 | 100% validate; mean resolutions ≥ 2.4; mean branches ≥ 1.3; ≥ 70% have failure states; integrity checks 2–5 all clean; journal bands respected |
| 7–8 | 100% validate; mean resolutions ≥ 2.0; mean branches ≥ 1.0; ≥ 55% have failure states |
| 5–6 | Validates; mean resolutions ≥ 1.6; branching present on the important quests only |
| 3–4 | Validates but is a linear task list with a schema wrapper: mean resolutions < 1.5, mean branches < 0.5 |
| 0–2 | Does not validate, or quests are not data at all (hard-coded in TypeScript) |

**Hard fails:** any file failing validation; mean resolutions < 2.0; any quest with `directions`
missing (that is a quest that requires a marker, an AR-2 violation); any branch or `requires_knowing`
pointing at a non-existent id (a branch that cannot be taken is not a branch).

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band.

## How we lose

- **The schema becomes a formality.** Every quest gets one resolution, zero branches, `can_fail: false`,
  and a two-entry journal, and it all validates perfectly. Validation is necessary and worth nothing on
  its own; checks 1–5 are the real gate.
- **Fake branching.** Three "resolutions" that share a journal index, an identical outcome string and
  the same reward. Check 2 exists because this is the cheapest way to hit a number dishonestly.
- **Dangling branches.** `leads_to` names a resolution that was cut. The quest silently dead-ends and
  nobody notices because nothing validates references. Check 3.
- **Journals as task lists.** "Go to the flooded warehouse. Retrieve the ledger. Return to Teeba-Ei."
  Three entries, imperative voice, zero belief, indistinguishable from an objective marker printed as
  text. RI-QST02's regex catches the voice; the band rule here catches the structure.
- **No failure states.** `can_fail: false` everywhere, because a failable quest needs a failure journal
  entry, a consequence, and a designer decision about recoverability. The result is a game where nothing
  the player does can go wrong, which is the opposite of Morrowind.
- **Directions cut for scope.** We ship `directions: ""` on half the quests and add a marker "just for
  testing". The marker never comes out. This is the specific mechanism by which AR-2 leakage happens.
- **Quests in code.** Someone writes the first ten quests as TypeScript objects with functions in them
  because a callback is convenient, and then no static analysis is possible for the whole project. The
  schema must be the only home for quest content; behaviour hooks belong in a separate systems layer
  keyed by `world_flags`.
- **Index renumbering.** A builder renumbers journal indices to be contiguous because sparse integers
  "look like a bug". Then no entry can be inserted without touching save data, and the band convention
  that lets check 5 work is destroyed.
- **Schema drift.** Two builders add `objectives[]` and `steps[]` independently and both get rejected by
  `additionalProperties: false`, so someone sets it to `true`. The moment that flag flips, this item
  and every metric in QST01/02/05/07/08 stop meaning anything.

## Provenance note

- **The schema, the journal band convention, the worked example and every target in section D are
  `constructed`** for this project. They are binding per CORPUS-CONTRACT §3.
- **Section A** is `canonical-recall`, `confidence: medium-high`: Morrowind quests are given by named
  NPCs behind disposition thresholds, opened by dialogue topics, tracked by sparse numbered first-person
  journal indices, and directed by prose. This is well-established behaviour of the engine and of the
  Construction Set's journal/dialogue model; no numeric claims are made about it here.
- The worked example `Q-XANM-07` is **original content** written for this corpus. It contains no
  Morrowind names, items, or plot. It exists to be copied structurally, not narratively — and the
  Black Marsh specifics in it are placeholders subordinate to whatever `corpus/60-lore/` establishes.
- Confidence is `high` because unlike the other QST items this one asserts almost nothing about
  Morrowind; it asserts a format we control and can verify mechanically.
