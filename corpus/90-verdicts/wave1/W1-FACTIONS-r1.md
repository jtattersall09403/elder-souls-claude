# W1-FACTIONS round 1 — faction questlines (RI-QST01, RI-QST02, RI-CRM02)

**FAIL — 4.1 / 10 against a wave-1 gate of 7.0.**

This is the best-written content in the tree and it is not yet a system. Three questlines,
twenty-eight quests, a dissenter per line who actually unlocks branches, a refusal that is a
way to win, and journal prose that reads like Morrowind's rather than like a task list. I could
not find a single imperative journal opening in 752 entries. I could not find an empty dialogue
topic in 404. The escalation shape is right on every axis the item names.

It fails on three hard gates and on one defect I found while trying to reach the top of the
ladder without help: **the offer gate — rank, reputation, topics, disposition, and the entire
mutual-exclusion model this piece exists to add — is enforced by `open()` and not by
`resolve()`.** A character who has joined nothing and holds reputation 0, and whom the gate
refuses out loud, applied the Wet Ledger's succession-enabling ending in full.

The builder's own arbitration claim, which I was asked to settle, is **correct**. The tool
builder's contradicting figure is its own stub constant.

---

## 1. The direct conflict, settled by measurement

The faction builder reports the Wet Ledger reaching **reputation 112**, the rank-7 demand. The
tool builder reports `Q-ASSZ-08`, `Q-LEDG-08` and `Q-XULA-08` setting `min_reputation: 112`
against an **attainable ceiling of 100**, driving build viability to 0 of 540.

I drove the shipped gate in the running engine across eleven reputation values with membership
held and everything else fixed, and read back the offer row's own `gate.unmet`
(`reports/critic-faction-arbitration.json`):

| `reputation` | `Q-LEDG-08` gate `unmet` |
|---:|---|
| 100 | `["The Wet Ledger reputation 100/112", "the first chair of the Ledger is empty and you emptied it"]` |
| **111** | `["The Wet Ledger reputation 111/112", "the first chair of the Ledger is empty and you emptied it"]` |
| **112** | `["the first chair of the Ledger is empty and you emptied it"]` |
| 300 | `["the first chair of the Ledger is empty and you emptied it"]` |

The reputation term steps out of `unmet` at exactly 112 and never returns. Identical on
`Q-ASSZ-08` and `Q-XULA-08`. **Coupling on the reputation term = 1.** My null control — 60 → 61,
a boundary the ladder predicts nothing at — moved nothing, so the step is the gate's and not my
perturbation method's.

Independently, statically, over `game/data/quests/**`: summing the best own-faction reputation
delta available on each quest in rank order, the player holds **249 / 208 / 228** at the moment
the rank-7 quest is tested, against a demand of 112. 112 is crossed around quest five of nine on
every line.

**The wrong instrument is `tools/analysis/build-viability.mjs`, at line 1191:**

```js
c.reputation = new Proxy({}, { get: () => 100 });
```

The counterfactual grants `gold = 1e9`, `ranks = 7`, every topic and every world flag — and then
pins every faction reputation at the literal `100`. That literal was correct when the generated
ladder topped out at `rep 0/10/25/40/55/70/85/100`. The ladder moved to 112 and the constant did
not. The file's own comment at line 1599 quotes the stop verbatim —
`"the_imperial_assize reputation 100/112"` — and treats it as a finding about the build rather
than about itself. **0 of 540 is a tool measuring its own stub.**

*Remedy: derive the counterfactual's reputation from the book (the sum of best-per-quest deltas,
which is what I computed), or grant `Infinity` as it does for gold. One line.*

---

## 2. Is the questline good, or merely reachable?

Good. This is the half no tool measures and I want to be unambiguous about it, because the score
below is driven entirely by things that are not the writing.

**Escalation.** Rank 0 is carrying two documents up a staircase and being told not to let them
travel together. Rank 7 is holding a court's seal with no Legate in the province. In between, the
turn lands exactly where `RI-QST01` says it must:

> **Q-ASSZ-02, rank 2, journal 24** — "The roll is exact. Six hundred and eleven leased out this
> season, six hundred and eleven returned, signed at both ends. The signature at both ends is the
> same hand."

That is the first inconsistency, at rank 2, and it is delivered as an observation rather than as
a reveal. The player has been *told* nothing.

**Does a giver lie?** Yes, and the lies are institutional rather than personal.
`Q-ASSZ-04`'s `giver.honest: false`, stated objective *"Recover the Assize's property from a
former officer of the court"*, actual objective *"Get the only evidence against the labour-lease
off the table before the Second Seed vote"*, truth: *"The office has not asked for the books in
eleven years because asking would concede they exist. It is asking now because the vote is four
months away."* That is D1 done properly.

**Does a quest ask you to do something you might refuse?** `Q-ASSZ-03` is the Vabdas quest and it
is better than the Vabdas quest:

> **journal 24** — "The widow is called Ineel-Sa and her husband drowned in the survey's own
> trial cut two winters ago. The compensation on file was offered to him, by name, four months
> after he died."

Four resolutions, of which `res_return_unserved` is a refusal that files itself on the roll
against your name, and `res_move_the_cut` costs the Assize four hundred gold and costs you Doren.
`res_buy_her_out` is the third option nobody mentions, and the journal for it is the best line in
the piece: *"She is on the Gideon road with money instead of nothing, which is not the same as
being right."*

**The dissenter.** `RI-QST01`'s named failure mode is *"we write the corruption as a document the
player finds instead of as a person."* Measured, `notary-sedda-vell` is a `rival_npc` reveal
source on **six** Assize quests and is cited by `requires_knowing` on a resolution in **five** of
them. `npc-wuleen-kus`: 5 and 4. `ee-vashum`: 3 and 3. D3's test asks for ≥3 and ≥2. All three
lines pass, comfortably.

**Where it fails, and I said I would quote it.** Two places.

`Q-XULA-01`, rank 1, `stakes 3`, `deceit: null`. Its four resolutions include
`res_kill_the_crew`, `violence_required: true`, and it pays **+28** — the highest own-faction
reputation on the quest. There is no `talk_to_target` reveal anywhere on it. At rank 1 of the
faction whose entire position is that the coast is a wound, the best-paying answer is to kill the
crew and there is nobody to talk to first. That is `RI-QST02`'s "kill targets with no mouth", on
the line that can least afford it.

`Q-LEDG-08` and `Q-XULA-08` — the two succession quests — carry `deceit: null`. `RI-QST01` puts
rank 7 at *"the player becomes the thing the dissenter warned about, or dismantles it"*, and the
Assize's `Q-ASSZ-08` does exactly that (*"The lie in this quest is not the giver's — it is the
office's account of what the seal is for"*). The other two lines arrive at their seat with
nothing left to be wrong about.

---

## 3. The hard gates

### 3.1 `RI-QST01` — two hard fails, one of them undeclared

| Metric | Target | Hard fail | Assize | Ledger | Xul-Aneekh |
|---|---|---|---:|---:|---:|
| Quests per line | 24–28 | **< 18** | **10** | **9** | **9** |
| Mean quests per rank | 3.0 | **< 2.0** | **1.25** | **1.125** | **1.125** |
| Hidden/`weird` quests | +2 | — | 0 | 0 | 0 |
| Rank of first `deceit` | ≤ 3 | > 4 | 1 | 1 | 2 |
| First `dirty_work` | 4 ±1 | > 6 | 4 | 4 | 4 |
| First `politics` | 5–6 | absent | 5 | 5 | 5 |
| First `succession` | 7 | absent | 7 | 7 | 7 |
| Rival-touching quests | ≥ 6 | < 3 | 8 | 9 | 8 |
| Stakes monotonic 1→10 | required | — | ✓ 2→10 | ✓ 2→10 | ✓ 2→10 |

The builder declared the volume gap (9 against 24–28). It did **not** declare the second gate:
`RI-QST01`'s Scoring block lists *"Mean quests per rank < 2.0 → **fail**"* as a hard fail in its
own right, and every line is at roughly half of it. These are separate gates and both are
breached. Per-rank distribution is `1/1/1/1/2/1/1/1` on all three lines — which is also the
item's named "signature of a spreadsheet rather than a story", though at this volume it is a
symptom of scope rather than of shape.

The line lengths are also not 8/9/8. The three new files hold 9+8+8 = 25 quests; the census by
faction is **10 / 9 / 9**, because `Q-LEDG-01`, `Q-DEEP-01` and `Q-MAG-10` are pre-existing
quests already tagged to these factions. `Q-XULA-02` does not exist anywhere — the Xul-Aneekh
line has a hole at rank 2 that `Q-DEEP-01` fills.

### 3.2 `RI-QST02` — strong, with a hard fail it inherits and one it adds to

Game-wide, over 94 quests: deceit rate **73.4%** (target ≥20%), **12 of 12** patterns used,
multi-channel **78%** (target ≥60%), **7** D5 two-cycles (target ≥2), **22** quests with a
`refuse` resolution (target ≥8), **20** with `consequences.locks` (target ≥6), **0** imperative
journal openings. On its own numbers this is a 9–10 band.

Two hard fails stand:

* **12 quests carry `deceit != null` with zero reveal flagged `before_point_of_no_return`** —
  `Q-MAG-02/04/05/06/07/10/13/16/18/19/24` and `Q-MAIN-32`. Eleven belong to the magic-quest
  piece. **One, `Q-MAG-10`, is `category: faction, faction: the_imperial_assize`** and therefore
  sits inside the census of the line under judgement; its `deceit` block has no `patterns[]` at
  all and a single reveal with no flag. It is also the only quest on any of the three lines whose
  `opens_by.topic` ("the witness") has no body anywhere in `dialogue/topics/**`.
* **D6 is a hard fail and its own Comparison method cannot see it.** `kill_required_npcs` is
  empty on **all 94 quests**, so the item's `jq -s 'map(select((.kill_required_npcs // []) |
  length > 0))'` returns the empty set and D6 passes vacuously. Under D6's prose definition
  ("*or a `combat` resolution against a named NPC*"), **7 of 25 = 28%** carry a `talk_to_target`
  reveal, against a **< 30% hard fail floor**. This piece added one of the 18 failures
  (`Q-XULA-01`). *This is a corpus defect as much as a build one and should be filed as such: a
  probe that cannot fail bought a false pass here.*

`records_belief` is **63 of 752 = 8.4%** against a ≥15% target (hard fail < 5%). Below target,
not fatal — but the three new lines are where the belief-recording journal voice is strongest,
so the deficit is in the older content.

### 3.3 `RI-CRM02` — hard fail, largely unbuilt

| Metric | Target | Hard fail | Shipped |
|---|---|---|---:|
| Sanctioned-murder quests | 27 | **< 15** | **1** (`Q-ASSZ-05`) |
| Mutually exclusive faction pairs | ≥ 8 | < 4 | **5** |
| Sanctioning authorities | 4 | < 3 | **1** represented |
| `favour_owed` flags with call-in content | 4/4 | < 3 | **0** |
| Expulsion / readmission | required (`RI-QST03` §D) | — | **absent** |

`Q-ASSZ-05` is a genuinely excellent single instance of the institution — the Warrant that does
not travel, the target with receipts, the exile at half fee, the return that costs two ranks of
progress and sends someone else. It is one of twenty-seven. The ku-vastei Ruling, the Morag Tong
writ and the Ledger's report-chain interception have no representation at all, and neither does
§5's `factionLawFactor` table, which is the whole AR-3 half of the item.

---

## 4. Mutual exclusion — it works, and it is the best-implemented thing here

Tested three ways in the running engine (`reports/critic-faction-arbitration.json`):

* **Join, then try the rival.** Joining the Wet Ledger at reputation 300 put
  `the_imperial_assize`, `the_ixtu_vakh` and `the_xul_aneekh` into `rivalry_locked_now` and left
  **0 of 10 Assize quests offerable**.
* **Hold both.** Setting both memberships to rank-7 reputation left both at derived rank 4, and
  the declared `rank_ceiling_with_a_second_membership: 5` is honoured.
* **Is the closure spoken?** **30 lockout reasons**, every one a sentence a giver would say:
  > `"The Imperial Assize will not deal with you: you are The Wet Ledger"`
  and, on the Xul-Aneekh with two memberships held,
  > `"The Xul-Aneekh will not deal with you: you are The Imperial Assize and The Wet Ledger"`

The fix the builder describes — `heldRank()` requiring an authored `joins_faction` rather than a
derived reputation rank — is real and holds. This is the one place where the piece crosses the
seam properly and I want it on the record before §5 takes it away.

---

## 5. The single biggest gap

### `GAP-FCT-01` — the offer gate is enforced at `open()` and not at `resolve()`

Found while trying to reach rank 7 without the poke described in §6.
`reports/critic-faction-gate-bypass.json`, six checks, with a passing negative control.

A character who has joined nothing, holds reputation 0, and knows no topics:

| Step | Call | Return |
|---|---|---|
| gate speaks | `questOpen('Q-LEDG-07')` | `{ok:false, reason:"requires Q-LEDG-06 first; the topic \"the underwriters gate\" has not come up yet; the topic \"the veto minute\" has not come up yet; the_wet_ledger rank 0/6; the_wet_ledger reputation 0/90"}` |
| **CONTROL** | `questResolve('Q-LEDG-07','res_show_the_returns')` | `{ok:false, reason:"quest not open"}` |
| the bypass | `questReveal('Q-LEDG-07', <first declared reveal>)` | `{ok:true}` |
| **same call again** | `questResolve('Q-LEDG-07','res_show_the_returns')` | **`{ok:true, …}`** |

The successful call applied, to a non-member the gate had just refused by name:

```
world_flags:        ["ledger_first_chair_settled", "ledger_first_chair_vacant",
                     "corrano_took_it_to_the_assize", "ledger_exposed_from_inside"]
unlocked:           ["Q-LEDG-08"]
faction_reputation: {the_wet_ledger: 14, the_imperial_assize: 40,
                     the_dockhands: 25, house_dres: -40}
npc_disposition:    {factor-ruvela-sath: 40, assizer-corvo: 80}
```

`ledger_first_chair_vacant` is the rank-7 `world_state` term. Derived rank moved 0 → 1.

**Cause, and it is two adjacent lines.** `machine.js resolve()` has exactly one gate on entry —
`const r = this.rec(id); if (!r) return {ok:false, reason:'quest not open'}`. `reveal()` calls
`this.rec(id, true)`, which **creates** that record. The author knew the pattern: at
`machine.js:541` the journal branch of `setFlag()` is guarded with `this.rec(h.quest) &&
!this.isClosed(h.quest)`. The reveal branch immediately above it, at **`machine.js:540`**, is not:

```js
if (h.quest && h.reveal) { const r = this.reveal(h.quest, h.reveal); if (r.ok) fired.push(…); }
if (h.quest && h.journal != null && this.rec(h.quest) && !this.isClosed(h.quest)) { … }
```

**Blast radius, measured rather than assumed.** **0 of 110** rows in `hooks.json` currently carry
a `quest` + `reveal` pair, so the world-side path (`setFlag` → `reveal` → record minted) is
**latent, not live** — it becomes player-reachable the first time any hook adds a `reveal`, which
the schema permits and `machine.js:540` already reads. I am not claiming a player can do this
today.

**It is live for measurement today, and that is why it is the biggest gap.**
`faction-probe.mjs:207` calls `H.questReveal(id, rev)` for every `requires_knowing` immediately
before `H.questResolve(id, row.id)` at line 210, and its `questOpen` calls at lines 246 and 294
discard the return value. **Every resolution in every faction-probe walk was applied outside the
offer gate.** The instrument the piece is graded by cannot distinguish a line that is walkable
from one that is not, which means P3's "9/9 quests became offerable by playing" is the only claim
in the probe that survives — the rest were taken with the gate switched off.

**Remedy.** Two changes, both small:
1. `machine.js resolve()` gates on the offer gate, not on record existence — call the same
   `canOffer`/`open` predicate and return its `reason` when it refuses. `reveal()` should take
   `rec(id, true)` only for a quest that is open, or mint a *knowledge* record distinct from the
   quest record.
2. Guard `machine.js:540` the way `:541` is already guarded.

Then re-run `faction-probe.mjs` and expect it to go red, which is the point.

---

## 6. Breaking the builder's tools

**`faction-probe.mjs`.** P4 reports `top derived rank 7 … at reputation 150` and P9 reports
`17/17 resolutions the walk actually took required no violence`. Both are true. The P10 string
ends, on **all three** reports on disk:

> `(the probe poked in assize_prefect_vacant to clear rank world_state terms)`
> `(the probe poked in ledger_first_chair_vacant to clear rank world_state terms)`
> `(the probe poked in deepkin_speaker_vacant to clear rank world_state terms)`

The rank-5 and rank-6 `world_state` flags *are* in the raised-by-the-quests list on every line.
The **rank-7** one never is. The reason is structural rather than accidental: the chooser adds
`+10000` cost to any violent resolution (`faction-probe.mjs:187`) and then takes the cheapest, so
on all three lines it selects the **refuse** ending of the rank-6 quest — `res_refuse_hulen`,
`res_refuse`, `res_tell_the_hollow` — and those are exactly the endings that do **not** vacate
the seat. I confirmed the mapping in the engine (`reports/critic-faction-ceiling.json`):

| rank-6 quest | endings that vacate the seat | endings that do not |
|---|---|---|
| `Q-ASSZ-07` | `res_remove_him`/betray, `res_resignation`/persuade | `res_file_for_him`/confess, `res_refuse_hulen`/refuse |
| `Q-LEDG-07` | `res_kill_her`/**combat**, `res_show_the_returns`/confess, `res_name_sath`/betray | `res_refuse`/refuse |
| `Q-XULA-07` | `res_put_it_to_the_hollow`/persuade, `res_the_gallery_way`/**combat**, `res_make_them_ask`/confess | `res_tell_the_hollow`/refuse |

So the two headline claims — *rank 7 reached, never set* and *walked entirely without killing* —
are individually true and **jointly untested**. A non-violent route to the seat exists on every
line (`res_resignation`, `res_show_the_returns`, `res_put_it_to_the_hollow`); no recorded run has
ever taken one. And the refuse ending, which `RI-QST02` D4 insists must be *"a way to win, not a
way to lose"*, permanently caps the player at rank 6 on all three lines — the succession quest is
unreachable on the refusal path with no alternative offered.

**`questDef()` is the trimmed-view defect, half repaired.** `api.js:1514–1529` returns `id`,
`title`, `category`, `giver`, `opens_by`, `directions`, `rank_gate`,
`mutually_exclusive_with` — and **no `resolutions` and no `consequences`**. The builder added
`questResolutionRequirements()` to cover the *requires* half after the probe reported
`res_kill_her` non-violent; the *consequences* half is still invisible. A probe inside the
running build cannot discover which ending changes the world, which is precisely why this one
poked the flag instead of picking a vacating ending. My own probe had to read the ids off disk.

**`resolution-reachability.mjs` and `gen-faction-gates.mjs`.** The generator's attribute column
now reads `reports/faction-signature-sweep.json` and throws if the sweep is absent — which means
regenerating gates requires a browser run to have happened first, and a stale sweep silently
re-derives the ladder against an old character builder. `notes_for_successor` says so; the file
does not. Note also that `gate.js` takes the **best** of the two favoured attributes and the
**top two** of the six favoured skills — faithful to Morrowind, and it means the second favoured
attribute is decorative for gating purposes. Any reachability tool computing `min()` over
favoured attributes is measuring nothing; I made that mistake in my first pass and corrected it.

**A tool that is right.** `topic-supply-audit.mjs`'s finding holds and the news is good.

---

## 7. Do the dialogue topics exist and say anything?

**Yes, and this is the clean pass.** The 74-of-76 defect has not recurred.

* **404** topic ids on disk; **0** with an empty body; **0** dangling topic → topic links
  anywhere in the tree.
* `50-factions.json` ships **31** topics, median **3** `infos` and **485** characters each, every
  one with outbound links.
* Exactly **one** `opens_by` topic on the three lines has no body: `Q-MAG-10`'s `"the witness"`,
  pre-existing. 37 tree-wide, none of the other 36 on these lines.

They also say something. `the-tolls`, from a Gideon townsman:

> "I have carried up that ramp for twenty years and I have watched the same barge weighed twice
> and written down once, and I have said so, and the man I said it to is not on the quay any
> more."

*A note on my own instrument: my first extractor read `responses`/`entries`/`variants` and
reported all 31 topics as empty. The bodies are under `infos[].x`. I caught it before it reached
this verdict, and it is exactly the failure mode §5 is about — an instrument that goes red for
its own reasons.*

---

## 8. CONSUMPTION (`RI-MTH07`), AR-1, AR-2, AR-3

| Model shipped | World-side consumer | Perturbation → observation | coupling |
|---|---|---|---:|
| `faction-gates.json` reputation column | `FactionGates.evaluate()` via `QuestEngine.context()` → `canOffer()` | rep 111 → `unmet` contains `"reputation 111/112"`; rep 112 → term absent. Null control 60→61: no change | **1** |
| `faction-gates.json` `world_state` column | same | flag absent → `unmet: ["the first chair of the Ledger is empty and you emptied it"]`, rank 4; flag raised by `res_show_the_returns` → rank rises | **1** |
| `faction-gates.json` `exclusivity` | `QuestEngine.context()` → `ctx.locked` → `canOffer()` | join Ledger → 0 of 10 Assize quests offerable, 30 spoken reasons | **1** |
| `faction-*.json` `consequences.world_flags` | `QuestMachine._applyConsequences()` → `sim.quest.flags` | 37/38/38 flags raised by resolutions the probe did not write | **1** |
| `faction-*.json` `resolutions[].requires` | `canResolve()` | `res_put_it_to_the_hollow` refused with `"willpower 10/22"` | **1** |
| `RI-CRM02` §5 `factionLawFactor` | **none found** | not shipped | **0 — orphan** |
| `RI-QST03` §D expulsion / readmission | **none found** | no data file, no code path; the string appears in one quest and one guard | **0 — absent** |

Everything this piece actually built is consumed. That is a real result and better than most of
wave 1. What is *not* built — the crime-side half of `RI-CRM02` — is absent rather than orphaned,
which is the honest failure of the two.

**AR-1 (Souls leakage into the fight):** none. No dice, no level-scaling, nothing here touches
frames.
**AR-2 (Morrowind leakage):** none found. No objective markers; 0 imperative journal openings in
752 entries; advancement is reputation + attribute + skill + world state, never character level —
`gate.js` throws at construction on a level gate.
**AR-3 (seam sterility):** **not sterile.** `Q-XULA-01`'s `res_kill_the_crew` and `Q-ASSZ-05`'s
`res_execute` put faction standing inside an encounter, `Q-ASSZ-05`'s exile route removes a fight
by geography, and the exclusivity lock removes ten quests' worth of encounters from a save. The
crossing is real but thin, and `RI-CRM02` §5 — the guard who sheathes his sword because of your
rank — is the crossing this piece was supposed to build and did not.

---

## 9. Score

| Item | Score | Why |
|---|---:|---|
| `RI-QST01` faction escalation shape | **3 / 10** | Mean of sub-scores ≈ 8.0 — ladder depth 10, stakes curve 10, corruption reveal 10, rival contradiction 10, task-kind 8, volume 0 — then hard-gated twice: quests per line < 18, mean quests per rank < 2.0. The item's own rule is "any hard fail = we lose". |
| `RI-QST02` deceit patterns | **7 / 10** | Band 9–10 on this piece's own content: 73% deceit rate, 12/12 patterns, 78% multi-channel, 7 D5 cycles, 22 refuse resolutions. Marked down for the D6 floor breach at 28% (one instance added here), the inherited zero-pre-PONR hard fail carrying `Q-MAG-10` inside the Assize census, and `records_belief` at 8.4%. |
| `RI-CRM02` faction crime and writs | **2 / 10** | 1 of 27 sanctioned-murder quests, 5 of ≥8 exclusive pairs, 1 of 4 authorities, 0 of 4 `favour_owed` call-ins, no expulsion path, no `factionLawFactor`. The one writ quest that exists is excellent. |
| **Weighted** | **4.1 / 10** | |

**Hard-fail checks:** `RI-QST01` quests-per-line < 18 — **FAIL**. `RI-QST01` mean quests per rank
< 2.0 — **FAIL**. `RI-CRM02` sanctioned-murder quests < 15 — **FAIL**. `RI-QST02` reachable-reveal
invariant — **FAIL** (12 quests, 11 inherited). `RI-QST02` D6 < 30% — **FAIL** (game-wide).
`RI-QST01` all-honest line — pass. `RI-QST01` level-gated advancement — pass. `RI-QST02` zero
refuse resolutions — pass. `RI-QST02` zero `locks` — pass. AR-1 — pass. AR-2 — pass.

---

## 10. `path_to_ten`

In the order that buys the most:

1. **`GAP-FCT-01` first, because every other number depends on it.** Gate `resolve()` on the
   offer predicate; guard `machine.js:540` as `:541` is guarded. Then re-run `faction-probe.mjs`
   and expect it to fail — a probe that does not go red here was never measuring the ladder.
2. **Walk to the seat.** Change the probe's chooser to prefer, at each rank, a resolution that
   satisfies the *next* rank's `world_state` term, and delete the flag poke entirely. Report
   which of the three lines can reach rank 7 non-violently without help. All three should; none
   has been shown to.
3. **Expose `resolutions` and `consequences` on `questDef()`.** Until a probe can see what an
   ending changes, no probe can pick one, and the poke comes back.
4. **Volume: 9 → 18 minimum, 24 to hit the bar.** The cheapest 9 per line are the ones the shape
   already names and the piece already has slots for: `+2` hidden/`weird` quests per line
   (`discovery: found|overheard`, currently 0 of 6), a second quest at ranks 0–3 and 5–7 to lift
   mean-quests-per-rank over 2.0, and `Q-XULA-02` to close the rank-2 hole.
5. **`Q-XULA-01` gets a mouth.** Add a `talk_to_target` reveal to the crew and a non-violent
   resolution that pays at least what `res_kill_the_crew` pays. That is one of the 18 D6 failures
   closed and the worst-placed one.
6. **A refusal must not end the ladder.** `res_refuse_hulen` / `res_refuse` /
   `res_tell_the_hollow` cap the player at rank 6 forever. Either give each line a second route
   to the vacancy that a refuser can take, or make the refusal itself vacate the seat by a
   different mechanism — the Assize's `res_resignation` shows how.
7. **`RI-CRM02`: build the second authority before the twenty-sixth writ.** The ku-vastei Ruling
   with its blood-price extinction is the highest-value single addition, because it is the only
   one that reaches the interior jurisdiction and it makes `RI-CRM02` §4's "maximum two
   authorities" mean something. `factionLawFactor` on the guard ladder is the AR-3 crossing and
   is cheap — one multiplier, measurable in a trace.
8. **Deceit at rank 7 on two lines.** `Q-LEDG-08` and `Q-XULA-08` arrive at the seat with
   `deceit: null`. `Q-ASSZ-08` shows what the beat is worth.
9. **File the D6 method defect against the corpus, not the build.** `kill_required_npcs` is empty
   on all 94 quests, so `RI-QST02`'s Comparison method #4 is vacuous and has been buying a false
   pass. It should read the prose definition (a `combat` resolution against a named NPC) or the
   field should be populated.

---

## evidence

```yaml
evidence:
  environment:
    node: v22.22.2
    boot_check_before: PASS   # node tools/harness/boot-check.mjs, exit 0
    boot_check_after:  PASS   # node tools/harness/boot-check.mjs, exit 0
    contention: "pgrep -c headless_shell 0 at start, 6-12 during; all browser work taken at 6-8.
                 loadavg 1.07 -> 6.33 peak. No timing figures are claimed; only ranks, counts,
                 booleans and gate strings, which survive contention."
  build:
    commit: 44f8432a0433ea0c55c0f7bea5235b83fa17aefa
    branch: claude/morrowind-souls-threejs-game-mou39v
    dirty: true
    dirty_note: "Concurrent agents were editing game/data/books/**, game/data/dialogue/**,
                 game/data/quests/mainline-act2|3|4.json and game/src/engine.js throughout.
                 Per RI-MTH04 'How we lose' #5 every claim here is confidence: medium at best.
                 None of the dirty paths is a faction quest file, faction-gates.json,
                 sim/quest/gate.js, sim/quest/machine.js or harness/api.js."
  runs:
    - command: "node tools/quests/critic-faction-arbitration.mjs"
      artifact: { path: reports/critic-faction-arbitration.json, sha256_16: 1ef368c229422c82 }
      exit_code: 1
      page_errors: 0
    - command: "node tools/quests/critic-faction-ceiling.mjs"
      artifact: { path: reports/critic-faction-ceiling.json, sha256_16: 21f45a24846a05f8 }
      exit_code: 1
      page_errors: 0
    - command: "node tools/quests/critic-faction-gate-bypass.mjs"
      artifact: { path: reports/critic-faction-gate-bypass.json, sha256_16: dae7c3bb875126b6 }
      exit_code: 1
      page_errors: 0
  builder_artifacts_read:
    - { path: reports/faction-probe-the_imperial_assize.json, sha256_16: 89031b88ed36b8e1 }
    - { path: reports/faction-probe-the_wet_ledger.json,      sha256_16: aaf3d234455e4bb9 }
    - { path: reports/faction-probe-the_xul_aneekh.json,      sha256_16: 61896ab420565a96 }
  claims:
    - { claim: "reputation term leaves gate.unmet at exactly 112", source: reports/critic-faction-arbitration.json, json_path: sections.sweep[1].rows, value: "111 -> 'The Wet Ledger reputation 111/112'; 112 -> absent" }
    - { claim: "null control 60->61 moves nothing",                source: reports/critic-faction-arbitration.json, json_path: sections.sweep[*].rows, value: "derived_rank 4 at both" }
    - { claim: "30 spoken lockout reasons",                        source: reports/critic-faction-arbitration.json, json_path: sections.exclusivity.reasons, value: 30 }
    - { claim: "both memberships cap at derived rank 4, ceiling 5", source: reports/critic-faction-arbitration.json, json_path: sections.exclusivity.both_joined, value: "ledger_rank 4, assize_rank 4, rank_ceiling_declared 5" }
    - { claim: "control: resolve on an unopened quest is refused",  source: reports/critic-faction-gate-bypass.json, json_path: sections.control_resolve, value: '{ok:false, reason:"quest not open"}' }
    - { claim: "after one reveal the same resolve returns ok:true", source: reports/critic-faction-gate-bypass.json, json_path: sections.bypass_resolve.ok, value: true }
    - { claim: "it raises ledger_first_chair_vacant and unlocks Q-LEDG-08", source: reports/critic-faction-gate-bypass.json, json_path: sections.bypass_resolve, value: "world_flags[1]='ledger_first_chair_vacant'; unlocked=['Q-LEDG-08']" }
    - { claim: "the rank-6 refuse ending does not vacate the seat", source: reports/critic-faction-ceiling.json, json_path: sections.endings, value: "Q-ASSZ-07 2 of 4 vacate; Q-LEDG-07 3 of 4; Q-XULA-07 3 of 4; the refuse ending is in the non-vacating set on all three" }
    - { claim: "questDef exposes no resolutions",                   source: reports/critic-faction-ceiling.json, json_path: sections.harness_exposes_resolutions, value: false }
    - { claim: "the probe poked the rank-7 flag on all three lines", source: "reports/faction-probe-*.json", json_path: "checks[?id^=P10].measured", value: "'(the probe poked in <flag> to clear rank world_state terms)'" }
  unmeasured:
    - claim: "Whether a player can reach GAP-FCT-01 in normal play today"
      reason: "0 of 110 hooks.json rows carry a quest+reveal pair, so the setFlag->reveal path at
               machine.js:540 is latent. I did not attempt to construct a dialogue route to
               reveal() outside the harness. The defect is claimed as a MEASUREMENT failure
               (certain) and a LATENT gameplay failure (structural), not as a live exploit."
    - claim: "RI-QST01 §7 blind-band test (redacted titles assigned to rank bands by a fresh judge)"
      reason: "requires a second agent with no exposure to the lines; not run. My §2 reading is
               not a substitute and is not scored as one."
    - claim: "RI-QST02 §8 blind read (three Morrowind briefs against three of ours)"
      reason: "same — blind_pair: yes on both items and I am not blind to either."
    - claim: "RI-CRM02 §5 factionLawFactor arrest-threshold spread (target 5.3x)"
      reason: "no factionLawFactor exists in game/src; the model is absent, so there is nothing to
               perturb. Scored as absent rather than as orphan."
    - claim: "Whether the three lines can each be walked to rank 7 non-violently"
      reason: "blocked on GAP-FCT-01 and on questDef() exposing no consequences — I could not
               drive a gated walk without going through the same bypass I am reporting. A
               vacating non-violent ending EXISTS on each line (res_resignation,
               res_show_the_returns, res_put_it_to_the_hollow); that it is REACHABLE by play is
               unproven, by the builder and by me."
    - claim: "Any timing or throughput figure"
      reason: "box was contended (6-12 browsers); no ms figure is quoted anywhere above."
```

---

## method_deviations

Four tools written mid-critique, per `TOOL-LOOP.md` rule 1. All three browser tools reuse a
single launched browser and run at `--width 320 --height 240` with `setRenderRate(0)`.

| Tool | What it now measures |
|---|---|
| `tools/quests/critic-faction-arbitration.mjs` | reputation sweep 0–300 per line against the live offer gate, with a null control at 60→61; a 140-signature worst-build sweep; three exclusivity trials reading `rivalry_locked_now` and the spoken reasons |
| `tools/quests/critic-faction-ceiling.mjs` | the rank-6 ending perturbation with a null control. Reads resolution **ids** from the authored file because `questDef()` exposes none; every behaviour comes from the engine |
| `tools/quests/critic-faction-gate-bypass.mjs` | the falsification in §5, with a passing negative control that goes red when the record is absent |
| scratchpad `rep-ceiling.mjs`, `qst-bars.mjs`, `d3-d6.mjs`, `topics2.mjs`, `crm-topics.mjs` | static re-derivations of the `RI-QST01`/`RI-QST02`/`RI-CRM02` count tables, independent of `faction-probe.mjs` |

Two instruments of mine went red for their own reasons before they reached this verdict, and I
report both because the round's rule cuts both ways: the topic-body extractor read the wrong
field and called 31 live topics empty (§7), and the first worst-build sweep took `min()` over
favoured attributes where `gate.js` takes `max()` (§6). Neither number appears above except as
these confessions.
