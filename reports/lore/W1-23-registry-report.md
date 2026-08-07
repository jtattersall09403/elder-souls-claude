# W1-23 — the registry, and whether this is a province or a set of good pieces

**Paths:** `lore.canon.registry`, `lore.canon.argonian`, `lore.canon.geography`, `lore.canon.history`,
`lore.canon.factions`, `lore.canon.prophecy`, `lore.naming.conventions`, `lore.religion.hist`,
`lore.religion.metaphysics`.
**Binding:** RI-LOR06 (contradiction discipline), RI-LOR01, RI-MTH07 / `ARBITRATION.md` §3 (consumption).
**Transcripts:** `reports/lore/canon-census.txt`, `reports/lore/canon-consumption.txt`.

---

## 1. The finding the piece exists for

`corpus/60-lore/data/canon-facts.json` is a good file. It has 54 facts, a schema with four fields
that each exist because of a specific failure, six disputes with rulings, and a validator that has
passed every time it has been run.

**Nothing in `game/` had ever opened it.** Its only two readers in the entire project were
`corpus/80-methods/canon-check.py` and `book-stats.py`, both critic scripts. It could have described
a different game entirely and every instrument in the build would have said the same thing.

That is the RI-MTH07 failure, and this piece's brief names it: *a registry nothing reads is a
document*. The comparison is one file away — `game/data/world/opacity.json` carries a `consumed_by`
list with six real entries, the engine throws at boot on a dangling anchor, and a mystery you delete
from it stops being refused in conversation. The canon registry had none of that.

## 2. What the census found on the untouched build

RI-LOR06's own comparison method, step 4, asks how many registered disputes have **both sides
actually spoken by a real book or a real NPC**, and fails the piece below eight. Step 4 had never
been run by anything, because nothing existed that could read the registry and the game at the same
time. `tools/lore/canon-census.mjs` now does. Run against the build as it stood:

| | before | after |
|---|---|---|
| disputes **fully voiced** (bar ≥8) | **0 of 6** | **21 of 21** |
| contradiction edges in shipped books | 49 | 50 |
| edges **registered** | 10 | **50** |
| edges carrying no `cf` at all | 27 | 0 |
| edges citing a registry fact that is not a dispute | 12 | 0 (10 remain as stale cross-references) |
| edges ruled **not a contradiction** | — | 10 |

Two structural notes on the "before" column.

**The bar was unreachable by arithmetic.** RI-LOR06 requires ≥8 fully-voiced disputes and the
registry contained six. No build, however good, could have scored above 3 of 5 on that check.

**The registry had already been overruled in writing.** `orchestration/status/W1-LIBRARY-MARTIAL.json`
records the martial-library builder deciding that contradiction edges *"DO NOT NEED A REGISTRY FACT …
that is legal by the checker and cleaner by ownership"*. It is legal by the checker. RI-LOR06 §1 is
not the checker: *"Every contradiction in shipped content must be either registered as disputed …
or a bug. There is no third category."* This is RI-LOR06's own "How we lose" #3 — the registry goes
stale — happening deliberately, for a reasonable-sounding reason.

## 3. The registry is now a shipped, consumed artifact

`tools/lore/build-canon.mjs` projects the corpus registry into `game/data/lore/canon.json`, and the
difference between the two files is the design.

**The build gets no answers.** `authorially_true` — the writers' room's ruling on who is right — is
replaced by `truth_seal`, the sha256 of the ruling. A critic proves the dispute was authored *with* a
ruling by re-hashing the corpus half; the running game cannot state it, because the string is not in
the binary. RI-LOR06 §1.2 says nothing in the game corrects a contradiction. A rule that depends on
nobody writing the wrong function is weaker than a rule that depends on the bytes being absent.
Measured: **0 facts ship an `authorially_true` field, 20 disputes ship a 64-character seal, and the
one deliberately-open dispute (CF-D002, who cut the first sapwell) ships unsealed because there is no
answer to seal.**

Three readers, mirroring `world/opacity.js` deliberately so a reader who knows one knows the other:

1. **`Engine._installCanon()`** resolves every `voiced_by` source and every argued-on topic against
   the data that *actually loaded*, and **throws** on a dangle. A dispute whose sides are held by
   nobody in the build is RI-LOR06's "note dressed as a dispute": it scores as texture and is
   paperwork. 141 references resolve today.
2. **`converse.js infoFor()`** — the behavioural consumer. A dialogue info may declare `cf` (a
   registered dispute) and `pos` (which side it takes), and `CanonRegistry.allows()` offers it **only
   to a speaker the register says holds that side**.
3. **`Engine.getCanonState()`** — which disputes this playthrough has heard argued and from how many
   sides. It reports no rulings and could not.

### The demonstration (`tools/lore/canon-consumption.mjs`, PASS)

Runs the real engine modules over the real shipped data.

- **The province disagrees with itself.** Four topics on which two or three *real shipped people*
  give incompatible registered answers. `the-thinning` returns three: a Deep-Kin elder blames
  root-theft, a Wet Ledger clerk blames too many cuts too close together, a Soulrest labourer says
  the burial ledgers show it first and the Court will not say why. Nothing corrects any of them.
- **Perturbation: 11 of 11.** Strike a speaker out of the register's `holders` and their line
  **vanishes**. Not degrades — vanishes.
- **Control: 409 of 409.** Untagged answers are byte-identical with and without the register. The
  gate is narrow: installing it cannot silence a line that never made a claim.
- **Fail-closed, twice.** A `voiced_by` naming a book nobody wrote goes red; a position with no
  `holders` goes red.
- **Reach: 336 of 336 people** hold at least one registered position.

> **My own perturbation was wrong the first time and the output told me.** Removing the speaker's
> *actor* alone left 4 of 11 lines standing — correctly, because those speakers also matched by
> *faction*. A perturbation that leaves a second route open measures the route it forgot. Fixed to
> strike every holder list, and the fix is commented in the tool.

## 4. Contradiction discipline: the audit

RI-LOR06's standard is that a contradiction is only interesting if both sides are held by somebody
with a reason. Applying it to all 50 shipped edges produced one rule and two kinds of exception,
both now recorded in the registry's new `not_disputes` block so they are not re-litigated every wave.

> **A contradiction is a disagreement about what IS THE CASE. A disagreement about what is WORTH
> DOING is an argument, and the province should be full of them.**

**Four edges are arguments, not contradictions** (all martial): whether a shield that cannot parry is
worth carrying; whether the high grip on the ricasso is worth the reach it gives up; whether a hooked
weapon is fit for a soldier; and whether the shield line may be opened in standing water — that last
is not a disagreement at all but a **regulation against a practice**. The Standing Instruction
correctly states what the Instruction says and Serjeant Brell correctly states what the men do. Both
are true, and the gap between them is the subject.

**One edge is mis-declared: the two books are on the same side.** `the-sap-and-the-knife` and
`what-the-hollow-has-to-trade` are declared opponents on *whether a well may be cut for sale*. Read
together they agree: the cutter's manual says the terms are depth and season and that "whether" is
not in them, and the hollow with one well and nothing else to trade argues the same case from the
other end. The real opponent is the keepers — who hold that a silence is not a permission and who had
**no book**. Registered as CF-D017 with both texts under position A and the keepers voiced in
dialogue.

**Reading the books reversed several of my own first-pass attributions, and that is the argument for
reading them rather than their titles.**

- *The Blessings of the Coast* does **not** claim the Legion goes inland. It says: *"It is further
  said that the Legion does not go inland. This is true, and we say so proudly."* All three texts
  agree on the fact. The interesting disagreement is about the **cause**, which is where the
  province's politics live — the Office says it does not wish to, Tribune Vell says a charter
  requires a signatory and the interior produces none, and the Account the Marsh Keeps says it was
  refused, courteously, in a manner that cannot be appealed. CF-D010 is now that dispute, with three
  positions.
- Prefect Arn's lease book is the **defence**, not the critique. The Casebook is the volume that
  notices the consent question — *"he raises no difficulty at all about consent, and that is because
  it would not occur to him that there was one, and it did not occur to me either."* CF-D009's
  positions were swapped accordingly.
- On the Ninth Clause, **both** shipped dialogue voices treat the clause as existing, so both are
  position A and position B is carried by books alone.

**Twenty-one disputes are now registered**, up from six: the house under the Stone Wastes, whether
subjects of the Empire are held as property, whether the lease raises a question of consent, why the
Empire does not hold the interior, what happened at Reman's Ford (four positions), the Ninth Clause,
the Court's unit of return, the eleven boxes, the stone-nest chambers, what happens at a drinking,
whether a well may be cut for sale, the tally-stones, the reaping blades, the Topal shore order, and
whether sight in this province is a competence the country takes away.

**CF-D020 was kept against RI-LOR06's own warning** about disputes the player cannot perceive. The
order of the Topal landmarks is minor — and a player who walks or sails the shore can settle it
without being told. A dispute the player can check is texture; a dispute over a date they can never
reach is a typo with a schema.

### The staleness is not hypothetical: it happened during this run

`CF-D021` was registered **roughly four minutes after its two books landed on disk**, mid-wave, from
a piece still writing. The census went from PASS to FAIL and back inside one session. **With no gate,
the registry falls out of date with the shipped tree within minutes on a busy tree.**
`tools/lore/canon-census.mjs` exits non-zero and should run wherever `check-content.mjs` runs. It is
not wired in here on purpose: a hard gate landed mid-wave would fail another builder's in-flight
book, which is the wrong way to win an argument.

## 5. Deep time: measured, and thin

> *"Morrowind's power comes from a history that predates every faction arguing about it. Is there one
> here, and does anything in the world rest on it?"*

Measured over all of `game/data`:

- **21 distinct years are named in the shipped books and dialogue. Zero of them are outside the
  Third Era.**
- The dated history runs **3E 344 to 3E 425 — 81 years, all of it inside living memory.**
- The registry knows better: **8 registered facts sit before the Third Era** (the Duskfall, the
  xanmeers, the Ruddy Man, the Knahaten Flu at 2E 560–601). Not one of them had a date field, and
  not one had a dispute attached.
- "four hundred" appears 121 times as a span phrase and "four thousand" 18 — the world *gestures* at
  depth constantly and *dates* nothing.

So the honest answer to the brief's question was: **there is deep-time prose, and nothing rested on
it.** Two things changed here.

1. A `when` spine on twelve registry facts, including four whose honest value is `year: null` with
   a note — *"the Duskfall is undated in every in-world source and deliberately so; the three books
   that try give three different spans."* An undatable event is a fact about the province, not a gap
   in the file.
2. **Five of the twenty-one disputes are now about the pre-Duskfall horizon** — CF-D003, CF-D007,
   CF-D013, CF-D015, CF-D018 — each voiced by shipped sources and each read by the running game. Deep
   time is no longer background prose; it is the thing people in the province are wrong about in
   front of the player, which is the only form of history a game can actually deliver.

It is still thin, and the census prints the number every run so the next agent cannot avoid it.

## 6. The Hist, the tribes, the Empire, House Dres

Counted over all of `game/data` on 2026-08-07 and registered as CF-C023 and CF-C024, so both are on
the record as decisions rather than gaps.

**There are no Argonian tribes in this build.** Of the tribes series canon names — Agacephs, Paatru,
Archein, Sarpa, Dead-Water, Miredancers — every one scores **zero**. Kothringi (22) and Lilmothiit (4)
appear, and both are extinct in-world, so they are history rather than society. "Naga" scores 388 and
is a playable race here, not a tribe. The province is organised instead by four constructed bodies:
Deep-Kin 87, Xul-Aneekh 84, Drowned Court 64, Sap-Cutters 53, Wet Ledger 45.

That is defensible — four bodies a player can tell apart beat nine tribe names they cannot — but it
is **ours**, and the failure mode it guards against is a later agent scattering canonical tribe names
through dialogue as texture and thereby claiming a social structure this world does not model. If
tribes are wanted, they need a faction each, not a mention each.

**The slave trade is present chiefly as the Empire's euphemism for it.** "lease"/"Blackrose" 2,240
hits; House Dres 245; slave/slavery **42**; soul-gem or soul trade **15**. A ratio of roughly fifty
to one.

This is worth having and worth naming. CF-062 is hard canon: House Dres has raided Black Marsh for
slaves for centuries and slavery remains legal in Morrowind. A province that only ever says "lease"
has adopted the Provincial Office's vocabulary **as narration**, which is exactly the move RI-LOR06
§1.2 forbids at the authorial level. The correction is not to sprinkle the word about. It is that the
euphemism must be somebody's **position** and not the world's voice — which is why CF-D008 now exists,
with *The Blessings of the Coast* registered as **holding** the Empire's line rather than stating it,
against Andrel Vorin's stock column and the second hand in the margin: *"Morrowind is in the Empire.
My mother is in Tear. Both of these are true at once and this sentence is printed by an office that
knows it."* The ruling is B. It is sealed out of the build and nothing in the game says so.

## 7. Prose

Eighteen dialogue infos authored, 798 words, measured with the pre-registered instruments before and
after. Against `tools/prose/spoken-register.mjs --by-source`: **62.9 negations per 10k** (corpus
files run 78–257) and **314.5 contractions per 10k** against Morrowind's reference 327.78 — parity,
and the best-performing dialogue file in the tree on that axis after the two the prose piece
generated. Zero `that is what/why/all`, zero round hundreds, two exclamations and two questions in
798 words.

**Four `-body` forms slipped in and I caught them with the predecessor's rule, not my own taste.**
Recast to concrete actors — *"The Court will not say why"*, *"a guide's grandfather"*, *"four hundred
years of the sentence never being needed"*, *"no sexton at Soulrest has ever read it"* — and **not**
swapped to `-one` forms, because the prose piece proved a `-body`→`-one` swap leaves a 5.5× rule
standing. One "eleven" remains and is load-bearing: the survey of eleven sites is the book's title.

## 8. Constraints

```
python3 corpus/80-methods/canon-check.py --validate-registry   REGISTRY: PASS (71 facts, 21 disputed)
node tools/lore/canon-census.mjs                               CANON CENSUS: PASS (21/21 voiced, 50/50 edges)
node tools/lore/canon-census.mjs --self-test                   SELF-TEST: PASS (10/10, each check broken on purpose)
node tools/lore/canon-consumption.mjs                          CANON CONSUMPTION: PASS
node tools/lore/build-canon.mjs --check                        up to date
node tools/world/opacity-resolve.mjs --leak-scan               CLEAN
node tools/check-data.mjs                                      542 files, 336 NPCs, all settlements resolve
node tools/check-quests.mjs                                    120 quests, hooks and entry topics resolve
node tools/check-content.mjs                                   383 quest resolutions, none lost
node tools/harness/boot-check.mjs                              PASS
```

## 9. What is left, honestly

1. **The census is not a gate.** It exits non-zero and nothing runs it. Wire it where
   `check-content.mjs` runs, once the wave's in-flight library work has landed. Without that, §4's
   four-minute staleness recurs every session.
2. **Ten stale cross-references remain in the books.** Ten `contradicts[].cf` fields name a registry
   *fact* rather than the *dispute* that now registers them (CF-042 → CF-D007, CF-062 → CF-D008,
   CF-060/C001 → CF-D010, CF-C007 → CF-D009). The contradictions are registered — registration is by
   coverage, and two copies of a fact drift — so this is a warning, not a failure. Not fixed here
   because those files were being written by another agent throughout this run.
3. **`game/data/books/manifest.json` does not exist** and RI-LOR06's comparison method §1 invokes
   `canon-check.py --books-manifest game/data/books/manifest.json`. A phantom path inside a gate.
4. **Faction ids are spelled two ways on NPC records** — `drowned-court` 17 / `the_drowned_court` 11,
   `wet-ledger` 23 / `the_wet_ledger` 6, `rootkeepers` 22 / `the_rootkeepers` 4, `ninth-cohort` 44 /
   `ninth_cohort` 1, `house_dres` / `house-dres`. Any matcher comparing these exactly sees a fraction
   of the population **and sees it silently**. `world/canon.js#fold()` normalises; other pieces
   should check whether they do.
5. **CF-D003 still WARNs** in `canon-check.py` (constructed provenance on a hard-canon tier). The
   warning is expected and correct — it is a resolution *of* canon — and it is left standing because
   silencing it would remove the question it exists to ask.
