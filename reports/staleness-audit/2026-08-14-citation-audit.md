# Citation-staleness audit — documents that hold false beliefs about this repo

**Task:** `AUDIT-CITATION-STALENESS` · **Date:** 2026-08-14 · **Branch:** `codex/wave1-build-experiment`
**Reverse index:** `reports/staleness-audit/reverse-index.md` — **regenerate, never trust the copy**:
`node tools/check-citations.mjs --index`

> **On the two `.json` companions.** `reports/.gitignore` excludes `*.json` and its stated test is
> *"is this reproducible by re-running the tool that made it"*. Both are: the findings are
> `node tools/check-citations.mjs --json`, the index is `node tools/check-citations.mjs --index --json`.
> So they are deliberately **not** tracked, they exist on the container only, and nothing here cites
> them as evidence — every number in this report is reproducible from the two commands above.
> (`HAZARDS.md` §9: evidence under `reports/` can silently never reach the remote. It did not, and
> that is the correct outcome for these two rather than a loss.)

---

## What I could not do — first, not last

1. **This is a sample, not a sweep.** 267 governing documents were machine-scanned for five
   mechanical shapes. Everything a document asserts in ordinary English is invisible to that and
   always will be. `RI-VIS02`'s false "image files are not vendored into this repo" — the
   single highest-blast-radius finding here — **was not found by any check.** It has no path in the
   sentence, so check C could not resolve it. I found it by hand. **Treat a green run as "the five
   shapes I can decide are clean", never as "the documents are current."** The tool prints its own
   coverage on every run for this reason.
2. **Five findings are handed over, not fixed**, because the files have live owners (Ruling O1).
   They are §6 below, each with an acceptance criterion.
3. **Question 4 (stale counts) is answered structurally, not exhaustively.** I did not re-derive
   every figure in the corpus. I established the general fact — see §5 — and built the mechanical
   check for the one sub-shape that a recomputation can never catch (check D).
4. **Check B's warning tier is not triaged.** 18 asset directories are named only by inventory
   documents. I confirmed the two that matter and left the other 16 ranked in §7. Some are
   legitimately inventory-only.
5. **Check C has a known false-positive class I chose not to suppress**: a claim about *command
   output* ("`git diff … ` is empty", "`grep …` is empty") reads as a claim about the path in the
   command. One live instance (`W1-DLG-TOPIC-WEB.md:144`) is a false positive of exactly this kind.
   Suppressing it mechanically would also have suppressed `INTENT-AUDIT-02.md`'s genuinely stale
   grep. I left the noise and named it here.
6. **No browser work, no game runtime.** Text and tooling only, as briefed.

---

## 1. The headline

`ARBITRATION.md` §2 is **scrupulous**. Its append-only rule is honoured: every superseded ruling
is struck through and points at its successor, S30→S35→S38 included. Check A2 confirms it
mechanically and check A1 finds **zero** governing documents citing an overruled S-ruling.

**The rot is one level down, where nobody was looking.** The rulings propagate; the *amendments to
reference items* do not, the *assets* do not, and the *anchors* nobody re-examines are worse than
either. Six items were amended by documents they never named. 282 behaviour references sat on disk
cited by no item. And an `n=0` that drove real prioritisation was a property of a lookup key.

## 2. What was fixed, ranked by blast radius

| # | Finding | Why it cost the most | Fixed in |
|---|---|---|---|
| **1** | **`RI-VIS02` §"The reference artifact" asserted "image files are not vendored into this repo (copyright)". 131 files are vendored** under `refs/modern/`. `ARBITRATION.md` **S55** already contradicts it in its own words. `BAR-CRITIQUE-IMAGES-02` item 17 flagged this exact sentence and it was never applied. | This is instance-3's shape in the *fidelity* item — a positive false assertion in the document that defines the modern reference set. It told every fidelity builder for eight days that there were no pixels. | `corpus/70-visual/RI-VIS02-…md` — struck, with the count, the licence trail and a pointer to `RI-VIS09` as the register |
| **2** | **`refs/souls-behaviour/` — 282 behaviour references, including 177 named DS1 boss-move GIFs — cited by no item in `10-combat/`.** `RI-VIS09` §2 routes them to `RI-VIS08` only. Not one of `RI-AI01`–`RI-AI07` names them. | The MyGUI shape at five times the scale. `RI-AI06` is *called* "boss design"; 177 boss moves were on disk and it could not see them. `RI-AI02` is about what a windup looks like and had no route to a picture of one. | `RI-AI02`, `RI-AI06` — routing blocks added, **with the behaviour-valid/pixel-valid prohibition stated**, because a frame count taken off a GIF would be a new defect |
| **3** | **`RI-PRG04` §5's spacing table is superseded by the built province and the item never said so.** `AM-W1-13-01` records 95 min → **56.91**, 6 regions → **13**, 28 HEARTHs → **29**. | `RI-JRN06` declares `RI-PRG04` *authoritative* on these numbers, so opening the item is the correct behaviour and it was the failure mode. | `RI-PRG04` §5 — pointer + the delta table, counts kept |
| **4** | **`RI-MTH02` R4 and `RI-PLT03` §C were amended and never pointed at their amendments.** MTH02 pointed only at `AM-W1-00-01`, which is **WITHDRAWN**. | Nobody reading R4 could tell which clauses were original and which were the applied repair (`AM-W1-00-C1`). `RI-PLT03`'s filed hole — every streaming budget defined at a walk, against a 40 m/s transport — was invisible from the item. | `RI-MTH02`, `RI-PLT03` |
| **5** | **`RI-JRN09`** said `tools/experience/session-run.mjs` "does not exist" — it is 47 182 bytes on disk. | It licensed verdicts to answer `blocked_on` for an instrument that exists. Anyone acting on it builds a second one (`COST.md` W3). | `RI-JRN09` — struck, and the excuse explicitly withdrawn |
| **6** | **`RI-EXP06`** said "`corpus/25-magic/` is empty, soul gems have no ruling" — six items live there and **S19 is cited two lines above in the same paragraph**. | The paragraph contradicted itself within four lines and marked B-08 "may not exist". | `RI-EXP06` |
| **7** | **`COST.md` §5 asserted "the parallelism floor of 12 is a floor during this programme too"** while `CLAUDE.md` has said "**The hard floor of 12 is removed**" since the 2026-08-14 directives. | A binding document contradicting the binding document that overrides it, on a number the whole fleet is sized against. | `COST.md` §5 — struck, guard restated as "no reduction in safe concurrency" |
| **8** | `METRICS-IMPLEMENTATION-01` ("`make-anti-ref.mjs` does not exist yet" — it does); `INTENT-AUDIT-02` ("`grep parley subsystems.json` is empty" — 5 matches). | Both would produce a duplicated build. | both, struck in place |

**Every fix is append-only.** Nothing was deleted; the superseded text is struck through and the
correction sits beside it with its date and the task that made it. Where a document's claim was
false because the *build* never did the thing, I recorded it as a gap and did not soften the bar —
`RI-JRN09` is the worked example: the tool exists, so the *excuse* is withdrawn, but "it has never
been run on any build" still stands until somebody measures it.

## 3. The fourth instance — a correctly-computed figure over a wrongly-scoped population

Folded in mid-task. **This is the most dangerous shape found, because every other check passes on
it.** Nothing is missing, nothing is uncited, no absence is asserted, and the arithmetic is exactly
right. The defect is that the **key** is wrong.

Both leads are confirmed, and **stormhold is not the same defect — it is a worse one**:

| Row | Anchor | Anchor's plates on disk | Composition-valid | Sky-visible | Verdict |
|---|---|---:|---:|---:|---|
| `ART-SET-*-thorn` | **REF-A3** (Telvanni grown mushroom towers) | 5 | **0** (all square crops, `RI-VIS09` §3.3) | 0 | structurally incapable of ever being non-zero |
| `ART-SET-*-stormhold` | **REF-A17** | 6 | 1 | **0** | REF-A17 is in `board.json`'s own `slot_routing.`**`interior`**, and the zeroed rows are `ROOFLINE-RELIEF` and `SKY-FRACTION` — **skyline** statistics. An interior anchor has no skyline. |
| *the anchors that fit* | **REF-A19** ("waterside settlement at Hla Oad: a moored longboat beside stilted shacks") | 11 | **6** | 6 | clears the board's own ≥3 |
| | **REF-A11** (Bitter Coast boardwalks, standing water, mist) | 8 | **3** | 3 | clears ≥3 |

So thorn is an anchor that *cannot* yield, and stormhold is a **category error between the anchor's
slot class and the statistic's requirement**. Neither zero is movable by acquiring anything — which
is why treating them as gaps in the world sent prioritisation at a wall.

**The generalisation, which is the deliverable:** *anywhere a document computes a count over a set
selected by a key, ask whether the **key** is right, not just whether the count is right.* That
class is invisible to every check that recomputes the number, because recomputing it reproduces the
wrong answer perfectly. The mechanical discriminator is `n_total(key) > 0 AND n_valid(key) == 0`.

**And the reason it sat unchallenged (lead 2, confirmed):** every zeroed row carries a
`fill_command` telling the next agent how to fix it, and it names
`docs/art-direction/measure-plates.mjs --shots <dir>`. **`measure-plates.mjs` parses only `--out`.**
`--shots` is silently ignored, so the documented remediation runs, exits 0, recomputes the same
population and reproduces `n=0` exactly. A remediation path that has never been executed is
functionally the same as no remediation path, and worse, because it looks like the question has an
answer. That is now **check E**, and it scanned 98 documented commands.

**Not fixed here — `board.json` and `ART.md` belong to `W1-30K`** and a Thorn agent is already
handing over a slot-routing change. The class and the tripwire are the contribution.

## 4. The tripwire — `tools/check-citations.mjs`

Five checks, one per observed shape, wired into `.githooks/pre-commit` as a **warning, not a
block** — on the same reasoning as the prose and ownership gates: the findings are usually in
documents the committer does not own, and a hard block would stop the wrong person. What was
missing was never permission; it was seeing it.

| Check | Shape | Live findings |
|---|---|---:|
| **A1/A2/A3** | a governing document cites a superseded ruling and never names the successor; §2's strikethrough rule broken | **0** errors, 9 warns |
| **A4/A5** | an amended item does not point at its amendment; an amendment that cannot be routed to an item | 2 errors, 12 warns |
| **B1/B2** | a vendored asset directory no work-directing document cites (**named by the inventory that fetched it does not count** — that is the discriminator the MyGUI case turned on) | 1 error, 18 warns |
| **C1** | a positive false assertion of absence | 5 |
| **D1** | a figure computed over a wrongly-scoped population | 4 |
| **E1** | a documented remediation that cannot run | 1 |

**Proof it fires — `node tools/check-citations.mjs --self-test`, 10 arms, 6 required red and 4
required green**, and the suite declares itself vacuous if either side is empty. The red arms
reintroduce **real** instances, not toys:

- `C` reintroduces instance 3 verbatim — a document asserting the `REF-A12b` screenshots are not
  there while 33 of them are — and goes red. Its control asserts absence of a path that really is
  absent and stays green.
- `A1` cites S30 alone and goes red; **its control names S35 and stays green**, so A1 is testing
  the successor pointer and not merely the string "S30".
- `A2` removes S30's strikethrough from a copy of `ARBITRATION.md` and goes red.
- `D` runs the live Thorn row and goes red; **its control repoints the same row at REF-A19 and goes
  green**, so D is testing the anchor and not the zero.
- `E` runs the live `--shots` flag and goes red; its control passes `--out`, which the script does
  read, and stays green.

The tool also refuses to demand a pointer to a **WITHDRAWN** amendment — `AM-W1-00-01` says
"Never applied. Do not cite it." Demanding a back-pointer to it would be committing this tool's own
defect in the other direction.

## 5. Question 4 — counts, and the convention change that is worth more than the edits

**A number in a document with no commit stamp is a number that will be wrong soon, and this is
widespread.** Every stale figure fixed above was unstamped. The corpus already knows the remedy —
`RULES.md` rule 12 says "stamp the commit on every number" and `COST.md`'s prevention rule 1 says
"a fact measured is published as data, not prose" — and neither is enforced anywhere.

**So the remedy is a convention change, not a hundred edits**, and I have said so rather than
starting the hundred edits. Every figure I introduced carries its commit and its re-derivation
command. The mechanical form of the convention — *a numeric claim in a governing document must
carry a commit stamp or a re-derivation command* — is the obvious sixth check and is **not built**;
it is rank 3 in §7 because its false-positive rate needs thought that I did not have budget for.

**`docs/art-direction/board.json` is the model to copy and should be said so plainly**: numbers as
data, with `generated_at_commit`, the statistic, the population and the fill command beside them.
It is also, ironically, where check D found its worst finding — which is the point. Data you can
interrogate fails visibly; prose fails silently.

## 6. Handed over, not fixed — live owners, Ruling O1

| Where | The claim | Owner | Acceptance criterion |
|---|---|---|---|
| `orchestration/NEXT-DISPATCH.md` §2b (~L1500) | "`game/data/dialogue/topics/main-quest-argument.json` **does not exist**… the single largest remaining gap in the main quest". **The file is on disk, 41 419 bytes.** NEXT-DISPATCH's *own* §1444 already says so and says "W1-17's to strike" — the pointer has been sitting there unactioned. | **W1-17**, via `AUDIT-R1-LIST` (running, owns the file) | §2b struck the way the bullets above it are struck, so `node tools/check-citations.mjs --only C` no longer names line 1500 |
| `orchestration/NEXT-DISPATCH.md` L1299 | "`game/src/render/` contains no reference to a weapon or a bone, and no `SkinnedMesh`" — `renderer.js:1402` and `actor.js:596` both use it. The section is already struck as `~~1old~~ — DONE. Kept for the record.`, so this is **deliberate history**, not a defect. | `AUDIT-R1-LIST` | append `<!--citation-ok: struck section, kept as the record-->` to the line; check C then passes it |
| `orchestration/plans/COST-EXPERIMENTS.md:198` | "`docs/data/` does not exist yet" — it holds `cost-ledger.json` and `rigour.json` | live piece on `COST-EXPERIMENTS.md` | struck with the current contents named |
| `orchestration/plans/W1-06.md:294` | "I checked `ARBITRATION.md`: **there is no such ruling yet** — the newest visual seam is S47". **S48–S55 now exist**, several of them camera/visual and at least one (`S50`) ruled from `AMENDMENT-W1-06-03`, this plan's own amendment. | `W1-06-s49-authority-resolution-20260811`, `codex-w1-06-fresh-review-20260811` | the paragraph re-tested against the current §2 and struck or confirmed; the *conclusion* ("this row does not depend on it") may well survive — it is the **figure** that is stale |
| `docs/art-direction/board.json`, `docs/art-direction/ART.md` §3 | the thorn/stormhold anchors of §3 above | **W1-30K** (Thorn agent already handing over slot routing) | `node tools/check-citations.mjs --only D` returns no D1 findings; the fix is a **slot-routing change**, not an acquisition |
| `corpus/87-audio/RI-AUD03`, `corpus/50-world/RI-WLD04` | amended by `AMENDMENT-W1-22-01` / `AM-W1-01-01-wld04-colour-invariant-a7`, neither named by the item | live owners on both | `--only A` returns no A4 findings for them |

## 7. The ranked queue — what remains, in priority order

1. **`refs/morrowind/REF-A21-regions` (39 files) and `REF-A23-ground` (11)** — named by `ART.md`,
   `board.json` and the acquisition report, by **no corpus item**. `REF-A21` is the largest single
   uncited population left and is region/topological material, which the owner's directive 5 asks
   about by name ("do we actually have Morrowind region/topological maps"). **We do. No item says
   so.** One routing row in `RI-VIS09` §2 plus a pointer from `RI-WLD04`/`RI-WLD06` closes it.
2. **`refs/modern/ui/` — 8 plates that no document anywhere names** (the only B1 error). Modern UI
   fidelity references, invisible while six UI items were built. Cheapest fix on this list.
3. **The commit-stamp check (§5).** A numeric claim in a governing document with no commit stamp
   and no re-derivation command. Highest long-term value, needs false-positive work first.
4. **12 amendments that cannot be routed to any item** (check A5) — nine of them the
   `AMENDMENT-W1-10-*` and `AMENDMENT-W1-07-*` families. Each needs its primary target named in its
   own title line; then A4 will start demanding the back-pointers, which is where the value is.
5. **`refs/temporal-substitutes/burst-*` (46 files across 4 dirs)** — cited only by
   `TEMPORAL-ACQUISITION.md` and `ACQUISITION-PROGRESS.md`. Verify these are legitimately
   inventory-only before spending anything.
6. **`REF-A2/A4/A5/A6/A7/A10/A11/A14/A15/A16/A20/A22`** — 12 further inventory-only directories,
   1–6 files each. Low individual value; worth one pass that routes or explicitly de-scopes each.
7. **`ARBITRATION.md` S32, S31, S29, S28 are cited by no governing document at all** (reverse index).
   Not necessarily dead — a critic prompt or a tool may enforce them — but they are rulings **nobody
   can find by reading**, which is how a ruling stops binding.
8. **Extend check C beyond resolvable paths.** The `RI-VIS02` miss is the proof that the highest-value
   findings are the ones with no path in the sentence. A vocabulary of known asset nouns
   ("plates", "screenshots", "layouts", "references") mapped to directories would have caught it.

## 8. The reverse index

`node tools/check-citations.mjs --index` — ruling → every governing document that depends on it,
plus **`stranded_if_changed`**: the dependents that never name the successor, i.e. exactly who a
change to that ruling would strand. Snapshot at `9ddeb512` in `reverse-index.md`/`.json`, but
**regenerate it**: a stored index of what depends on what is precisely the kind of document this
whole audit exists to distrust.

The shape of it, at `9ddeb512` over 267 governing documents:

| Ruling | Dependents | Note |
|---|---:|---|
| S1, S7 | 40 each | the two most load-bearing rulings in the project |
| S15, S8, S22, S18, S13 | 34, 32, 31, 31, 30 | changing any of these touches ~30 documents |
| **S35** | **11** | **superseded in place by S38, and 9 of the 11 never name S38** |
| S30 | 5 | replaced by S35; all 5 name S35 — this one propagated correctly |
| S32, S31, S29, S28 | **0** | cited by no governing document |

The S35 row is the one to act on: it is the ruling the project has already been bitten by, it has
eleven dependents, and nine of them are one edit away from being stranded the next time it moves.
