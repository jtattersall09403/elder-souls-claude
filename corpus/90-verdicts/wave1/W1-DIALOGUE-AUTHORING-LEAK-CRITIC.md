# W1-DIALOGUE-AUTHORING-LEAK — independent critic verdict

**FAIL at 5** (wave-1 gate is 7.0), min-over-axes: `RI-MTH07` 6 · `RI-DLG03` 5 · `RI-UIX05` 5.
Judged at `43d26e6e`, branch `codex/wave1-build-experiment`. Machine-readable verdict:
`W1-DIALOGUE-AUTHORING-LEAK-CRITIC.json`. Evidence:
`artifacts/W1-DIALOGUE-AUTHORING-LEAK-critic/`.

## The one-line version

**Both fixes are real and every number the builder claimed survived independent re-derivation —
including the two it corrected against my brief.** The piece fails on its **guards**, not its
fixes.

## What I could not do, first

- **No browser, by instruction.** The box is over its `HAZARDS` §29 ceiling and the brief directed
  a Node-only pass, so I did not run `tools/contention.mjs` and did not open one. **I never saw a
  pixel of either fix.** No book was opened, no page turned, no greeting read on screen.
  `CRITIC-DOCTRINE` §1.2b's interaction requirement is **unmet** for the reading screen and I score
  those arms fail-closed. `RI-UIX05` K1–K10: **0 of 10 measured.**
- **I could not show the running engine consumes `foldBooks()`.** I verified the call site by
  *reading* `engine.js:4577`, which §1.1 forbids as the basis of a score. All my coupling numbers
  are function-level. Control C proves the distinction bites.
- **Blind gates: `not_possible`, failed closed.** Both governing items are `blind_pair: yes`. I am
  a subagent; I cannot spawn a fresh judge and `create_session` is approval-gated. The debt *is*
  moving — `RI-UIX06` §G has now actually run and returned **HARD FAIL, art capped at 2**. Honest
  census derived this turn: **82** reference items declare `blind_pair: yes`.

## Job 1 — the builder's correction of my brief holds

**The withdrawal of the "25" is right. No true finding was withdrawn.** `Local. Useful.` is the
`ADDRESS` fragment for `(RG-BWC, saxhleel)` at `gen-greetings.mjs:106`, sitting in a five-race
block whose other four members are unambiguously in-world. The 25 shipped occurrences are
`5 bands × 5 lines`, by design.

**The "exactly one leak" claim survives a differently-shaped sweep.** I traced the consumers
(`converse.js`, `refusal.js`, `text.js`) and collected **4,284 demonstrably-rendered strings**,
then ran **17 patterns of my own**. Post-fix: **9 hits, every one read and cleared** — four
in-world uses of "in one sentence" (the best of them: *"don't put those two names in one sentence
in a room"*), three book-prose false positives, two schema keys my collector over-reached into.
**No second leak.** My own instrument's negative control: the same sweep against the pre-fix file
returns **14**, including all five leak instances at `pools[180..184].lines[3]`.

## Job 2 — the replacement is a correct fix and mediocre writing

The guard holds: the slot was **replaced, not emptied**, and the band still has five stances. But
the builder's claim that the line is *"specific to the Blackwood Company"* does not survive.

| Evidence | Number |
|---|---:|
| Lines in `greetings.json` containing `writ` that belong to **RG-LEDGER** (the writ-house clerks) | **25** |
| …that belong to **RG-BWC** (all of them the new line) | **5** |

`RG-LEDGER`'s own address fragment is *"Name, and what the writ says under it."* — the word is the
clerk group's 5:1, and the new line is its only intruder. It transplants **natively** into
`RG-LEDGER` (*"Documents, or nothing."*), `RG-COURT` (*"Documents to the steward."*) and
`RG-EMPIRE` (*"Take it to the provincial office."*). Three of `RG-BWC`'s other four cold lines name
a Company-proper referent — **Contract**, **the Company**, **the factor**; the replacement names a
province-wide noun. And the builder's own cited precedent shows exactly what was dropped: the camp
greeting is *"**Our** writ is out of **Leyawiin**"* — a possessive and a provenance.

Greetings are how a town tells you what it is. This one tells you someone works in an office.

## Job 3 — the 24 verified, and the order-independence claim is *understated*

Re-derived independently by replicating the loader and the pre-fix inline fold:

- 26 book files, `manifest.json` **5th**, no key collisions, **163** distinct ids.
- Old fold: **24 textless** — my id list matches the builder's exactly.
- New fold: **0**.
- `manifest.json`: 162 entries, **0** with a `text` field, **162 of 162** with a real text-bearing
  counterpart, **0** text-bearing ids missing from it. A genuine catalogue.
- The 163rd id is `the-drowned-ford` — a single-book doc, and the builder's flagged-in-passing note
  that it is uncatalogued is **accurate**.

**Order-independence, 500 shuffled load orders:** the real `foldBooks()` was byte-identical to
baseline in **500 of 500**. The old fold differed in **500 of 500**, with its textless count
ranging **0..162** — pre-fix, the blast radius was a pure accident of file order and could have
been the whole catalogue.

**What the player gets back:** 24 of 163 books (14.7%), **14,670 words**, 13.0% of the book corpus,
moving from the literal drawn word `"undefined"` to real pages.

## Job 4 — the checks, and this is where it fails

| Control | What it does | Expected | Got |
|---|---|---|---|
| **A** | delete the guard inside `foldBooks()` | fail | **fail, exit 1, the old 24 comes back** ✅ |
| **B** | reintroduce the leak at the authored source | both fail | **both fail, exit 1** ✅ |
| **C** | revert `engine.js`'s **call site**, leave `foldBooks()` correct | fail | **all three exit 0** ❌ |
| **D** | hand-author the leak into shipped `greetings.json` | fail | **exit 0 — and the leak is gone from the file** ❌ |
| **E** | hand-author it into a spoken faction-refusal line | fail | **exit 0** ❌ |

Control **D** is the sharpest thing I found. Importing `gen-greetings.mjs` has a top-level write
side-effect, so the check **regenerates the file it is scanning**. The leak is present before the
run (`grep` = 1), **gone after it** (`grep` = 0), and the check reports **PASS**. That file holds
**1,500 of the 4,988** strings the check reaches — **30.1%** of its own surface — and it is the
file this defect lived in. This is the sixth check this project has found that could not fail, and
the worst-shaped: the previous five were blind; this one **deletes the evidence and reports the
absence of evidence**.

Control **E**: `TEXT_KEYS` is a six-name allow-list, and `faction-refusals.json` carries **59
player-facing strings across 7 factions** under `reputation`, `attribute`, `skill_1`, `skill_2`,
`world_state`, `welcome`, `rivalry_locked` — all spoken by `FactionRefusals.speak()`. The check's
header claims it catches leaks "authored directly into a hand-written JSON file". It does not.

Control **C** was a close second for biggest gap: the game ships 24 undefined books again and
nothing goes red. `check-book-fold.mjs`'s header asserts *"a pass here is a pass for the real
consumer"* — `RI-MTH07` §D3, verbatim: *a comment asserting a check is not a check*.

Also noted: `check-greeting-consumer.mjs`'s perturbation arm reads `git show HEAD:...`, so now that
the fix is committed it prints *"(perturbation skipped)"* and exits 0 **forever**. Pin the blob SHA.

## Job 5 — `RI-MTH07`, perturbed with the null control the builder did not run

**Greeting side — coupling 1.00.** Pre-fix `greetings.json` read from git (not regenerated) through
the real `greetingFor()`: **10** distinct leaked lines reachable. Post-fix: **0**.
*Null control A:* 255 `(npc × race)` cells outside `RG-BWC` — **0 changed**.
*Null control B:* 40 `RG-BWC` cells at dispositions 5/40/60/85 — **0 changed**.
I also found a **second live NPC** in that cell the builder did not name — `blackwood-company-camp`,
disposition 20. It spoke the leak too, and is fixed.

**Book side — coupling 1.00**, observed at `wrap()`, the exact call `drawBook` makes:

| Book | Pre-fix drawn lines | Post-fix |
|---|---|---:|
| `the-sap-and-the-ledger` | 1 × `"undefined"` | **98** (4,783 chars — the builder's figure, exact) |
| `crate-tally` | 1 × `"undefined"` | 14 |
| `inscription-third-terrace` | 1 × `"undefined"` | 14 |
| `shore-compass` | 1 × `"undefined"` | 13 |
| `the-egg-speaks-twice` | 1 × `"undefined"` | 88 |

## AR-1 / AR-2

**AR-1 `not_applicable`** — nothing this piece touches is reachable from a fight.
**AR-2 `pass`** — B3: the slot was replaced, not emptied, so no "…" NPC was created. B6: the fix
moves **13% of the book corpus** back into the lore vector, which is the Morrowind direction.

`RI-DLG03` step 7's diegetic lint is an **automatic-fail** dimension, so I ran it verbatim: it
returns **46 hits**. All 46 are artefacts — `\b(quest|` is unanchored and matches **question**.
Word-anchored it returns **5**, all one `RG-VAKH` line, *"Take the marker. It floats when nothing
else does."* — a physical river float, which is precisely the Morrowind way of marking a route, not
a HUD waypoint. Read and cleared. **The item's own instrument, run as written, fails the build for
containing ordinary English**; filed as a `method_gap` and *not* fixed by me, because anchoring a
regex narrows what fails and §1.3 forbids a critic relaxing the bar.

## The bar itself (§1.3)

**Nothing in the corpus governs authoring-instruction leakage into shipped text.**
`grep -rli 'authoring instruction|writer.s instruction|placeholder text|meta-instruction' corpus/ --include=*.md`
returns **zero files**. The nearest thing, `RI-DLG03` step 7, is entirely about Souls UI vocabulary
and **would not have caught "Say it in one line."** This defect was found by a *blind judge looking
at a screenshot*, not by any bar we own. Filed as a `corpus_hole` with a proposed `RI-DLG10`;
**bounded, not built** — and I state the cap it puts on my own verdict: my sweep is scoped to the
surfaces I could trace in one session, and a leak on a surface I did not find is invisible to me
exactly as it is to the builder's check.

## What the builder got right that it did not have to

Three volunteered claims, all verified exactly true: `the-drowned-ford` really is uncatalogued; the
three other `Object.values(this.data.books)` folds at `engine.js:2887`, `:2946` and `:5522` really
are safe (the last by accident — **0** of manifest's 162 stubs carry a `knowledge_key`); and the
broad 43-hit sweep really was not wired into the standing check. **Nothing counts because someone
says so — but this builder's reporting held under every check I could put on it.**
