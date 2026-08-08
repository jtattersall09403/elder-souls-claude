# W1-27 — one ruling, reversible, with the numbers

Written here rather than in `orchestration/NEXT-DISPATCH.md` because `AUDIT-R1-LIST` holds that
file live (`node tools/ownership.mjs`). Move it there when that piece lands; nothing about the
ruling depends on where it sits.

Measured at the commit stamped in `reports/w1-27/coherence.json`.

---

## R1 — the palette assembler in `build-property.mjs` IS a procedural loot table, and the rule is broken

**The claim under test.** `tools/world/build-property.mjs` defends itself in its own header, and
the defence is good enough that it deserves an answer rather than a verdict:

> *A tiny deterministic mixer. NOT a game RNG: it never runs in the simulation, it runs here, once,
> and its output is committed JSON a critic reads. `game/data` is the artifact, not this.*
>
> *The alternative — 4,000 hand-typed object records — is not a better world, it is the same world
> typed slower.*

Both sentences are true. Nothing rolls at run time — `w1-27-coherence.mjs` L1 reports
`runtime_rolls: 0`, and there is no loot roll anywhere in `game/src/`. Morrowind's own contents
were committed records too. If "procedural" means "a die is thrown while the player is standing
there", this build is clean.

**The ruling: that is not what the rule is about, so it does not save this.** The rule exists
because of what the player finds, not when the choosing happened. The numbers:

| | |
|---|---:|
| Placed takeable objects in the province | **1,950** |
| …drawn from a ten-entry palette by `pal[(mix(zoneId:i) + i) % pal.length]` | **1,827 (93.7%)** |
| …hand-placed and unique | **83 (4.3%)** |
| …identical well buckets | 40 |
| Distinct object names in the whole world | **153** |
| Names appearing **more than 40 times** | **15** — hackle-lo leaf bundle ×54, despatch case ×53, legion ration ×51, counting stones ×49, sealed crate ×47 |

Fifty-four identical leaf bundles is the *outcome* a hand-placement rule forbids, and it arrived
without a single die being rolled. `RI-WLD02` M7 already names this exact number as its most
important check — *"instances of a mesh appearing >40 times in the world with identical component
sets"* — and fails a piece at more than 5 of 60 sampled. Here it is 15 distinct names over the 40
mark. The mechanism and the timing differ from a Diablo drop table; the thing on the shelf does
not.

**Where the generator's defence does hold, and it should not be flattened.** The *ownership* layer
it produces is genuinely authored and genuinely good: 280 named people, ownership per-person and
not per-building, faction-shared stock in trade rooms, and a lock tier ranked by the value behind
the door. Coherence work rules which side is authoritative; it does not improve either
(`RI-MTH05` "How we lose" #2). **The roster is not the defect. The contents are.**

**What this is not.** It is not a demand for 4,000 typed records. The path to green that costs
least is the one Morrowind actually used: a large majority of shelves carry *nothing worth
taking*, and the objects that exist are few, specific and placed. 1,827 → a few hundred, each one
written down, is both less work than the current file and a better world.

**Reversible — what would overturn this ruling:**

1. **A different reading of "loot".** If `world.loot.placement` is scoped to *containers and
   corpses* and household furniture is explicitly out of scope, then 1,827 pieces of crockery are
   set dressing and L1 is measuring the wrong noun. I could not find that scoping in the corpus and
   `RI-QST08` (reward design) does not draw it. **A reference item that draws it overturns R1
   immediately**, and L1's filter is one line.
2. **A repeat count under the M7 bar.** If the palette grew until no name appeared more than 40
   times with an identical component set, the assembler would pass the project's own existing
   anti-scatter test, and the argument for hand-typing would be aesthetic rather than measured.
3. **Evidence the objects are unreachable.** They are not — see below — but if a later round made
   household contents non-interactive, they would stop being loot and become scenery, and scenery
   is `RI-WLD04`'s problem, not this one.

**And the thing that stops R1 being a claim about a file.** RULES #11 says a census over data
cannot prove a read dead; the symmetric trap is that it cannot prove one alive either, and a
finding about 1,950 rows in JSON is worth nothing if the world never touches them.
`tools/coherence/w1-27-loot-consumption.mjs` takes a palette object out of the running world and
watches four consumers, then empties every zone's `contents` on the running engine and takes the
same four measurements again:

| | as shipped | zones emptied |
|---|---|---|
| C1 reachable via `listOwnedObjects` | yes | no |
| C2 enters the inventory | yes | no |
| C3 recorded in the world's stolen registry with owner and value | yes | no |
| C4 survives `saveState` → `reset` → `loadState` | yes | no |

All four move. **1,827 is a number about a game.**

---

## R2 — the naming fix was landing in the output while the generator kept the defect. Closed this round.

Not a judgement call, so not a ruling — a repair, recorded here because the *shape* is the one
this project keeps paying for and the next person should recognise it.

`tools/lore/name-rosters.mjs --write` (W1-23 r3/r4) fixed `game/data/world/property/*.json`.
`tools/world/build-property.mjs` **writes that same file, with no flag and no guard**, out of the
`GIVEN`/`EPITHET` stock that produced the defect. Measured on a scratch copy at this commit, one
unguarded run produces:

- **45** distinct named people, down from **280** — the stock is too small not to collide;
- **80.0%** carrying a hyphenated-English descriptive name, against RI-LOR04 §4's attested **11%**
  and W1-23 r3's measured 55.8%;
- `Sedura Rope-Maker` — *sedura* is a Dunmer honorific, so an Argonian called "Sir Rope-Maker",
  which is the verdict's own example, still sitting in the stock;
- and it deletes `build-unique-property.mjs`'s 83 unique objects, which are the only objects in
  the province that are not palette assembly.

Nothing automated runs it — no CI step, no `package.json` script — so this was one person's
afternoon away from erasing two rounds of somebody else's work with no error message.

**Closed** by a four-line `--write` guard that names what must be re-run afterwards. The
delete-the-fix arm is `w1-27-coherence.mjs --self-test`'s `N1/add-the-write-guard`: baseline red,
guard added on a copy, green. Removing the guard restores the old behaviour exactly.

---

## R3 — how authored contradiction was told apart from incoherence, and why nothing good got flagged

The brief is right that a coherence tool which flags the deliberate disagreements is worse than
none. LR1 uses `RI-LOR06`'s **own error list** and no taste of mine: a dispute is authored when it
carries `disputed: true`, **two or more positions**, each with a non-empty `held_by` and at least
one `voiced_by`. Someone wrote both sides and put a mouth on each.

On the shipped tree: **28 authored contradictions over 69 positions, 28 of them fully voiced, 0
malformed.** Every one is design and none is flagged. `RI-LOR06` §4 fails the build below 8 fully
voiced; there are 28.

The first version of LR1 also required a written `in_world_source` and **flagged two good disputes
for it** — CF-D028 is a disagreement held in speech and never written down, which is a fine thing
for a dispute to be. That criterion was wrong and was replaced with the item's own before anything
was published. Recorded because it is precisely the failure mode the brief warned about, and the
tool committed it before the report did.

One real defect survives, and it is the clause `canon-check.py` only applies under
`--books-manifest` — which nothing runs: **CF-D011 cites `book:the-drowned-ford`, and no such book
exists** among the 162 shipped. RI-LOR06's words: *"a contradiction whose sources do not exist is
not tracked, it is claimed."* One line to fix, in whoever owns the book shelf.
