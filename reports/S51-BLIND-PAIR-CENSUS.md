# S51 blind-pair census — all 77 items, every one read

**Owner:** census agent, wave 1, branch `codex/wave1-build-experiment`.
**Authority:** `corpus/00-doctrine/ARBITRATION.md` **S51** (with S52, S53), `RI-CMB07`'s wave-1
amendment (`BAR-CRITIQUE-W1-09-R1` §R5), `RI-WPN02`'s wave-1 amendment
(`BAR-CRITIQUE-W1-10-R1` §R6), `RULES.md` rule 25, `OWNER-DIRECTIVES-2026-08-14` Rulings W1/W2.
**Scope:** every corpus item declaring `blind_pair: yes`, classified against S51's four admissible
counterpart classes by the **disconnected-script test**:

> *Could a short script that has read the item's tables, and has never run the game, reproduce the
> judge's answer? If yes, the pack is void, scores `0`, and records `blind: void`.*

**No corpus item was edited.** S51, S52 and S53 still reverse by deleting a table row. The
deliverable is this census plus the ranked edit list in §6, each with the defective clause quoted.

---

## 0. The population is 77, not 109 — and the difference matters

`grep -rl "blind_pair: yes" corpus/` returns **109 files**. That is the number in the brief and it
is a grep artefact, not an item count. Of those 109:

| | count |
|---|---:|
| **Reference items declaring `blind_pair: yes` in front matter** | **77** |
| `corpus/00-doctrine/CORPUS-CONTRACT.md` — the template that *defines* the field (`blind_pair: yes \| no`) | 1 |
| Doctrine files quoting the field (`CRITIC-DOCTRINE`, `BAR-CRITIQUE-01`, `VERDICT-SCHEMA`, `verdict.schema.json`, `CRITIC-PROMPT-TEMPLATE`, `INTENT-AUDIT-01/02` ×2 each, `RI-MTH03`, `JOURNEY-CRITIC-FLEET`, `PLAYTHROUGH-CRITIC`) | 12 |
| Landed **verdicts** in `corpus/90-verdicts/wave1/` that quote it | 19 |
| **Total** | **109** |

The corpus holds **147 reference items** (`node tools/corpus-index.mjs`). So **77 of 147 items —
52% — declare a blind pair.** Every one of those 77 was opened and read for this census. The arbiter
read 18 of them; this covers the remaining 59 as well, and re-derives the arbiter's 18 independently
rather than inheriting them.

---

## 1. Headline, stated before the detail

**The arbiter's 13-in-18 rate does not hold across the population — it is roughly 30%, not 72% —
but the arbiter under-counted its own class, and three new items fail on their face.**

| Disposition | items | share of 77 |
|---|---:|---:|
| **VOID — counterpart derived from a published design table** (S51's named defect) | **16** | 21% |
| **VOID — second arm has no stated provenance at all** (fails closed under S51) | **7** | 9% |
| **VOID — already ruled so by its own amendment** (`RI-CMB07`) | 1 | 1% |
| **DECLARED BUT ABSENT — `blind_pair: yes` with no blind apparatus anywhere in the item** | **2** | 3% |
| **MISDECLARED — the instrument is single-arm; there is no counterpart and none is needed** | 8 | 10% |
| **VALID — class A, an authentic external artefact** | 23 | 30% |
| **VALID — class C, an authored exemplar of the same kind** | 9 | 12% |
| **VALID — class D, a within-build contrast** | 11 | 14% |
| **Total** | **77** | 100% |

Each item is counted once, on its **primary** disposition. Two further items carry a valid class-A
leg alongside a void one (`RI-WLD10`, `RI-CAM07`) and are counted as void; `RI-DLG07` carries a
class-C leg alongside its class-A body and is counted as A.

**Cleared: 51 of 77 items (66%) carry a counterpart that survives the disconnected-script test.**
Defective in some way: 26 (34%) — 24 void or fail-closed, 2 declaring a pack that does not exist.
Nine more are honestly-instrumented but mislabelled and cost nothing but a field.

**The single most useful structural finding, and it is what makes the damage survivable:** in
almost every void item the defect sits in an **unweighted appendix line** — a paragraph beginning
`**Blind pair:** …` placed immediately before the `Native → ladder anchors` block, in the same
position, in the same words, across the wave-0 combat, weapons and camera items. It is a template
artefact that propagated. The item's *weighted* human read, where it has one, is almost always a
different and valid instrument: a within-build legibility or learnability panel (class D). See §4.

---

## 2. What is void — every item, with the defective clause quoted

### 2a. Counterpart generated from a published design table — 16 items

Thirteen were named by S51 from reading. **Three are new and had not been read by anyone:**
`RI-AI02`, `RI-MAG01`, and one leg of `RI-WLD10`.

| Item | Quoted defective clause | Weighted? | Landed result |
|---|---|---|---|
| `RI-AI01` | *"a reference series generated from the tables in §C/§D"* | no | never built |
| **`RI-AI02`** *(new)* | *"Also present the same panel for a reference enemy **generated from §F**; compare accuracy. If ours is more than 15 percentage points below the reference, we lose."* | **the comparative leg rides on M4's weight 3** | `not_possible` (W1-09-r3) |
| `RI-AI03` | *"one generated from §B/§E"* | no | `not_possible` (W1-09-r2) |
| `RI-AI04` | *"two unlabelled string-graph DOT renderings (ours, and §E)"* | no | never built |
| `RI-AI05` | *"ten unlabelled 90-second behaviour fingerprints (ours) mixed with **ten generated from §B**"* | no | `not_possible` ×2 — S51 reclassifies as `instrument_positive_control` |
| `RI-AI06` | *"two unlabelled move tables (ours, and §E)"* | no | never built |
| `RI-AI07` | *"two unlabelled loop tables (ours, and §G)"* | no | `not_possible` (W1-04-r1) |
| `RI-CMB01` | *"one from our build, **one generated from §B**"* | no | `not_possible` ×3, each diagnosing the degeneracy |
| `RI-CAM01` | *"one generated from **§C's law** against the route's collision profile"* | no | never built |
| `RI-CAM02` | *"one generated from **§C's law**"* | no | **done ×2** — `picked: reference`, then `tie` |
| `RI-CAM03` | *"one generated from §C/§D"* | no | never built |
| `RI-CAM04` | *"ours and one **generated from §D**"* | no | never built |
| `RI-CAM06` | *"ours and one **generated from §A/§E**"* | no | **done** — `tie` |
| `RI-WPN05` | *"a reference set **generated from §A/§C**"* | no | never built |
| **`RI-MAG01`** *(new)* | *"Hand a critic ours and **one generated from §C**, unlabeled"* | no (M1–M8 = 100; M9 carries no weight) | **done** — `tie` |
| **`RI-WLD10`** *(new, one leg only)* | appendix: *"one ours, one **generated from §2** and from Morrowind captures"* — the §2-generated half is void; M56 §5's Morrowind-water half is class A and is the weighted one | no (appendix); M56 weight 4 is class A | `not_possible` |

`RI-MAG01`'s landed run is the most instructive thing in this census, because the critic wrote
S51's terminal symptom in its own words before S51 existed:

> *"The two vectors are identical … There is no feature by which to prefer one, **which is the
> strongest possible result** for a commitment vector: the discriminating question has no
> discriminating answer because the build reproduces the specification exactly."*
> — `W1-14.json`, `blind_comparisons[RI-MAG01]`

That is convergence-as-correctness read as a pass. Under S51 it is `inert`, not "the strongest
possible result". The verdict is not re-scored (§5), but the sentence should not stand as a model.

### 2b. Second arm with no stated provenance — 7 items

S51 verified five. **Two are new:** `RI-WPN01` and one arm of `RI-CAM07`.

| Item | Quoted clause | What the record shows the arm actually was |
|---|---|---|
| `RI-CMB02` | *"hand the critic two `C[action][k]` commitment grids and two frame censuses, unlabelled"* | W1-09: *"our 14-row frame census and RI-CMB02 §A/§B are **bit-identical**"* |
| `RI-CMB03` | *"two stamina-vs-frame plots for the same 60-second input script"* | W1-09-r3: *"No stamina-curve reference series exists in the corpus; §D gives **bands**, not a series"* |
| `RI-CMB05` | *"two `S[k]` hyperarmour probe vectors and two `B[angle][radius]` backstab fields"* | W1-09-r3: *"the item pairs against **numbers**, which are not blindable"* |
| `RI-CMB06` | *"two M4 result tables — 64 rows … unlabelled"* | W1-09: *"Ours is **exact against §B**, so the two sides coincide"* |
| `RI-CMB08` | *"two 60-second HP-vs-frame plots with heal events marked but unlabelled"* | never built |
| **`RI-WPN01`** *(new)* | *"hand the critic **two** `weapons × slots` clip-id grids with weapon names and clip names hashed"* — the second grid's origin is never stated | never built |
| **`RI-CAM07`** *(new, one arm only)* | *"two 32 px silhouette sheets, ours and **a Morrowind-transposition reference from RI-VIS05**"* — `RI-VIS05` publishes palette/flora/silhouette **tables**, not silhouette sheets; the named artefact does not exist | never built. Its *fidelity* arm (*"a modern reference character crop from RI-VIS02"*) is class A and is now buildable — see §3 |

Every one of these five combat items had a critic independently diagnose the degeneracy and record
`not_possible` rather than claim a pass. **The corpus's critics found S51 five times before the
arbiter named it.** That is the strongest available evidence that the ruling is right.

### 2c. Already ruled void by its own amendment — 1 item

`RI-CMB07`. Its §Blind-pair section is the source text of the whole doctrine: *"A pack whose
counterpart is generated from §D, from this item's text, or from any published design table is
`VOID`."* Correctly records `blind_pair: not_possible` until the exemplar is regenerated, at which
point it becomes **class B** (both sides runtime-generated). Nothing owed.

### 2d. Declared but absent — 2 items, and this is a new class

| Item | Finding |
|---|---|
| **`RI-UIX01`** (combat HUD) | Front matter says `blind_pair: yes`. **The string "blind" appears exactly once in the entire file — in that front-matter line.** No pack, no counterpart, no judge, no question. The item is 100% instrument. |
| **`RI-UIX06`** (diegesis and UI style) | Same: `blind_pair: yes`, no pack anywhere. Its §G *"could this be Bootstrap?"* test — six fresh judges, weighted `AD7` — **is** a real human read, but it is a single-arm naming test with no counterpart, not a pair. |

Neither is an S51 defect (nothing is derivable, because nothing exists). Both are a **bar defect of
the same family** the arbiter named: a field asserting an instrument that was never written. A
builder reading `RI-UIX01` sees `blind_pair: yes` and has nothing to build.

---

## 3. What is valid — reported as loudly as what is broken

**51 of 77 items carry an admissible counterpart.** This is the majority of the corpus's blind
apparatus and it is in good order.

### Class A — an authentic external artefact (23 items, plus a valid leg in 2 more)

`RI-QST01`, `RI-QST02`, `RI-QST08` (real Morrowind quest lines, briefs and rewards) ·
`RI-DLG01` (the Balmora topic graph, §B, from a `Morrowind.esm` extraction) ·
`RI-DLG03` (§A/§B are *"verbatim Morrowind text, `community-data`"*) ·
`RI-DLG07` (categories 1–4 and 6 are verbatim, speaker-attributed extraction) ·
`RI-WLD03` M13 step 4, `RI-WLD05` M26, `RI-WLD06` M32, `RI-WLD08` M46, `RI-WLD10` M56 §5,
`RI-WLD14` M84, `RI-WLD15` M-W15-5 (Morrowind screenshots, journals, clips, water, buildings) ·
`RI-LOR03` (four named real Morrowind books) ·
`RI-VIS02`, `RI-VIS05`, `RI-VIS06`, `RI-VIS08` (via `RI-VIS06` Protocols A and B) ·
`RI-UIX03`, `RI-UIX04`, `RI-UIX05` (Morrowind inventory, journal and book pages) ·
`RI-JRN07`, `RI-JRN08` (real Morrowind journal entries) ·
`RI-MAG05` A-M6/F-M6 · `RI-CAM07` fidelity arm.

**A material change the corpus text has not caught up with.** Several of these items still say the
reference side does not exist — `RI-VIS06`:244 *"Until `refs/modern/` is populated, Protocol A runs
only on the pairs for which we hold a legally usable reference image"*, and its provenance note
*"`refs/modern/` is empty"*. **It is no longer empty.** On disk today:

| directory | files |
|---|---:|
| `corpus/70-visual/refs/modern/` (7 slots incl. `character_closeup/` at 13) | **131** |
| `corpus/70-visual/refs/morrowind/` (24 `REF-A*` slots) | **278** |
| `corpus/70-visual/refs/souls-behaviour/` — boss move GIFs, telegraph clips, attack chains, parries, a 60 fps boss-fight capture | **302** |
| `corpus/70-visual/refs/anti-generic/`, `context/`, `temporal-substitutes/` | present |

So `RI-VIS02`, `RI-VIS08` and `RI-CAM07`'s fidelity arm are **buildable now and were not when they
were written**, and — this is the important one — **`refs/souls-behaviour/anim/telegraph/` and
`.../ds1-boss-moves/` are a genuine class-A counterpart for the AI items that S51 voided.**
`RI-AI02`'s readability panel and `RI-AI06`'s learnability panel can be run against real Elden Ring
and Dark Souls windup clips instead of against a table. That is a strictly better instrument than
the one being replaced and it costs an acquisition that has already happened.

### Class C — an authored exemplar of the same kind (9 items, plus `RI-DLG07`'s category 5)

S51 is explicit that *"provenance is not what makes a counterpart void; derivability from the
acceptance table is"*, and names `RI-DLG05` §B as the model. Ten items are in that class and all
ten are legitimate:

`RI-DLG05` (ten constructed journal entries) · `RI-DLG07` category 5 (declared `constructed`, and
labelled as such so no critic mis-cites it) · `RI-DLG08` · `RI-QST06` (a reconstructed Morrowind
act table) · `RI-JRN01` (`MW/OPEN`), `RI-JRN02` (hand-built Seyda Neen and Undead Burg timelines) ·
`RI-EXP01` (§A/§B reference beat logs), `RI-EXP02` (constructed Morrowind/Souls anecdotes),
`RI-EXP03` (§C/§D shape reconstructions), `RI-EXP05` (reconstructed Vivec/Dagoth Ur and
Frampt/Kaathe exchanges).

**`RI-DLG08` is the best specimen in the corpus and should be the pattern others copy.** Three arms
— ours, 12 matched real Morrowind excerpts, and 12 *deliberately bad* LLM-written excerpts
**committed to `corpus/40-dialogue/data/badprose-arm.json` before the run, with the commit hash
recorded in the verdict so it cannot be tuned.** That is a plausible wrong answer, pre-registered.

**`RI-EXP02`, `RI-EXP03` and `RI-EXP05` solve a second problem S51 does not reach:** their scored
outputs are `judge_cannot_name_a_consistent_tell`, `judge_located_our_sag`,
`judge_named_our_antagonists_strongest_claim` — *not a win rate*. `RI-EXP02` says why in its own
text: *"this item deliberately does not repeat `RI-DLG07`'s W3 mistake"*.

**Amber flag on the class, named rather than buried:** six of these ten counterparts are
`canonical-recall` **reconstructions** of an external work, not captures of it. They survive the
disconnected-script test (no script can rank three stripped hours for *"which is the opening of a
game people still talk about in twenty years"*), so they are **not** void. But the build is partly
built toward them, so they carry a weaker form of the same convergence pressure. The named repair
is an actual capture, not a rewrite — and for `RI-JRN01`/`RI-JRN02` that is now cheap.

### Class D — a within-build contrast (11 items)

Both arms ours, differing by exactly the mechanism under test, judged on the artefact as a player
meets it. S51 names `RI-CMB09` M7 as the clean specimen and *"does not touch it"*.

`RI-CMB09` M7 · **`RI-CMB10` M6** (see §7) · `RI-WPN02`, `RI-WPN03` M6 (both amended to
runtime-generated, design columns stripped) · `RI-WPN04` · `RI-WPN06` · **`RI-WPN07` M4** —
*"Record the same scripted encounter twice … **through the runtime a player uses**"*, both arms
ours, and PASS requires the judge to **name a mechanism**, not an outcome; it is already fully
S51-compliant and is the model for the class · `RI-CAM05` M1 · **`RI-PRG09` M8** (see §7) ·
`RI-CMP03` §F — six of our own builds, and the item states outright *"this is not an ours-vs-theirs
blind pack and the distrust rule does not apply"* · `RI-WLD09` M-OP6 (our declared voids against our
own unfinished terrain — a real plausible wrong answer).

Two notes that must travel with this class, both from S51 and Ruling W2:

1. **A class-D contrast may never be recorded as a reference pair.** Six of these eleven items
   declare `blind_pair: yes` and then run a class-D instrument. The honest record is
   `blind_status: not_possible` **with the reason**, and the contrast beside it as a named
   substitute instrument.
2. **Four of them ask a distinguishability question, not a quality question** — `RI-WPN04`
   (*"which five are the same move?"*), `RI-WPN06` (*"are these the same weapon?"*), `RI-WPN03` M6's
   grouping half, `RI-CAM05` (*"which five are the combat shots?"*). Under Ruling W2 **distinguishable
   is not good.** `RI-WPN03` already handles this correctly by making the *second* half — naming a
   within-group difference — the thing that can fail: *"**FAIL** if the grouping is correct but no
   within-group difference can be named."* The others do not.

   `RI-CAM05` is a deliberate and legitimate inversion and should not be "fixed": it **passes when
   the arms are indistinguishable**, because the claim under test is that combat and exploration
   framing are identical. It is the one place in the corpus where convergence is the correct pass
   condition, and it is not the S51 defect — both arms are ours and no table encodes framing.

### Misdeclared but honest — 8 items

`blind_pair: yes` with an instrument that is **single-arm by design**: a legibility or naming
census. There is no counterpart, none is needed, and a real person answers a real question.

`RI-VIS07` — and the item says so itself: *"Using a Skyrim screenshot as a reference in this item
is forbidden — **the test needs no image at all**."* · `RI-VIS09` (the reference *registry*; it
supplies the `--ref` side of other items' packs and is not a judged build item — a category error) ·
`RI-WLD04` M17 (the item's primary instrument: 39 frames, 13 region names, assign each) ·
`RI-WLD12` M68 (*"is this one place or two?"*, weight 16) · `RI-DLG06` step 6 (18 of our lines to
six archetype descriptions; individually disqualifying) · `RI-AUD01` M2, `RI-AUD03` §C, `RI-AUD05`
VO-5 (classify our own clips).

None is void. All eight are field errors that cost a builder a wasted search. `RI-UIX06`'s §G
Bootstrap test is the same shape but the item is counted under **ABSENT** above, because §G is not
presented as its blind pair.

---

## 4. Why the blast radius is smaller than 13-in-18 predicted — the template line

Sixteen items draw a counterpart from a table. **Fifteen of the sixteen do it in an unweighted
appendix**, and the appendix is textually the same paragraph in every one: a block opening
`**Blind pair:** …`, sitting between the last `M`-check and the `Native → ladder anchors` row that
`BAR-CRITIQUE-01 W7` added. It reads as a house style that was applied across the wave-0 combat,
weapons and camera items and never revisited.

Meanwhile the *weighted* human read in those same items is usually a different instrument, and it
usually survives:

| Item | Void appendix (unweighted) | Weighted human read — and its class |
|---|---|---|
| `RI-AI02` | *"a reference enemy generated from §F"* | M4's primary leg: 40 greyscale silhouette windup clips **of ours**, name the incoming move, ≥80% — **class D**, weight 3 |
| `RI-AI04` | *"(ours, and §E)"* | M10: 12 clips of **our** enemy, predict the third move, before and after 30 min of study — **class D**, weight 3 |
| `RI-AI06` | *"(ours, and §E)"* | M4 learnability panel + C10's naive→studied prediction rise — **class D** |
| `RI-AI07` | *"(ours, and §G)"* | M3: *"20 stills, half from ambush approaches and half from non-ambush stretches"* — **class D**, and a proper plausible wrong answer |
| `RI-WPN05` | *"generated from §A/§C"* | M6's *"blind human-equivalent test"*: 10 rendered 8-frame impact sequences, name the material and the weapon weight — **class D**, and **weight 15**, the largest weighted human read in the weapons area |
| `RI-CAM01/02/03/04/06` | *"generated from §C's law"* etc. | none — these items are wholly instrument, and deleting the appendix leaves them with no human read at all (§7) |
| `RI-MAG01` | *"generated from §C"* | none — M1–M8 are all instrument |
| `RI-CMB01/02/03/05/06/08` | the appendix *is* the read | none |

**So the practical damage concentrates in the camera area, the wave-0 combat items and
`RI-MAG01`.** Everywhere else, S51 removes a decorative line and leaves the real instrument standing.

---

## 5. Retroactivity: no landed verdict is invalidated — checked across all 78 wave-1 verdicts

S51 found none among its 18 and said it was looking at a fifth of the population. **The full sweep
agrees, and now on evidence rather than sampling.** Every `blind_comparisons[]` entry in all 78
wave-1 verdict files was read. Fifty-five carry at least one entry; sixteen entries have
`status: "done"`.

Of the sixteen `done` results, **six sit on a pack this census rules void.** Every one of the six is
either a tie or a loss:

| Verdict | Item | Pack | Pick | For or against us |
|---|---|---|---|---|
| `W1-00` | `RI-CAM02` | void (§C-generated) | `B` | **reference — against us** |
| `W1-00` | `RI-CAM06` | void (§A/§E-generated) | `tie` | neither |
| `W1-00-r2` | `RI-CAM02` | void | `tie` | neither |
| `W1-09` | `RI-CMB03` | void (no provenance) | `B` | **reference — against us** |
| `W1-09-r2` | `RI-CMB07` | void by its own amendment | `B` | **reference — against us** |
| `W1-14` | `RI-MAG01` | void (§C-generated) | `tie` | neither |

**Not one void pack in this project's history has produced a result in our favour.** The remaining
ten `done` results sit on valid packs (`RI-WLD04` ×2, `RI-WLD12`, `RI-JRN01`, `RI-WPN02` ×3,
`RI-WPN03` ×3), and two more (`W1-LIBRARY-r1`/`RI-LOR03`, `W1-PROSE-BLIND-r1`/`RI-MTH03`) were
already recorded `void` or self-corrected by their own critics for a *different* defect — question
form, not counterpart provenance — and both landed against us as well.

**S51's asymmetry clause is therefore applied and carried into every disposition in §6:**

> Where a void pack produced a result **against** us, the finding stands and the score is **not**
> raised. S51 voids a pack as evidence of *quality*; it must never become a route for laundering a
> failure into "unmeasured".

Concretely: `W1-00` is not re-scored upward on `RI-CAM02`; `W1-09` is not re-scored upward on
`RI-CMB03`; `W1-09-r2` is not re-scored upward on `RI-CMB07`. `W1-14`'s `RI-MAG01` tie contributed
**no points either way** — the item's scoring table is `M1(15) M2(15) M3(15) M4(15) M5(15) M6(10)
M7(10) M8(5) = 100` and **M9, the blind pair, carries no weight** — so the 85/100 native and 7/10
ladder stand untouched. The only correction owed there is textual: the phrase *"the strongest
possible result"* should read `inert`.

**Answer to the second open question: no item is void in a way that invalidates an existing
verdict.** The mechanism is now understood rather than observed — the void packs are unweighted
appendix lines, so they could not move a score even when they ran.

---

## 6. Corpus edits owed — ranked, none performed

Ranked by *how much a builder or critic is misled today*, not by count.

| # | Item(s) | Edit owed | Why this rank |
|---|---|---|---|
| **1** | `RI-UIX01` | Either write a blind section or set `blind_pair: no` and add `human_read: instrument`. The file's only occurrence of "blind" is the front-matter line. | A builder is told a pack exists that has never existed. Zero-cost to fix, maximal confusion. |
| **2** | `RI-UIX06` | Same, and record §G's Bootstrap test as the item's human read rather than implying a pair. | Same defect; §G means it does not lose a person. |
| **3** | `RI-MAG01` | Replace M9's *"one generated from §C"*. No admissible counterpart exists → `blind_status: not_possible`, reason *"no admissible counterpart; §C is inadmissible under S51"*. Add the class-D substitute the item already pays for: the same `H[k]` sweep against a **deleted-commitment copy** (`hard_until` removed), runtime-generated, both arms ours. | The **only void pack that landed a `done` result whose rationale is S51's terminal symptom verbatim**. Left as written it teaches the wrong lesson. |
| **4** | `RI-AI02` | Delete the *"reference enemy generated from §F"* leg. **Replace with class A, which is now on disk:** `corpus/70-visual/refs/souls-behaviour/anim/telegraph/` (8 Elden Ring windup clips) and `anim/ds1-boss-moves/` (Artorias, Bed of Chaos, Butterfly). M4's primary leg is unchanged and keeps its weight 3. | The only void leg that rides on a **weight**. And it is the one item where the fix is an upgrade, not a deletion. |
| **5** | `RI-AI06`, `RI-AI04` | Same substitution — `ds1-boss-moves/` is a real boss move set and `anim/attacks/` holds Elden Ring neutral and strong chains. Replace *"(ours, and §E)"*. | Two more items that go from void to class A for free. |
| **6** | `RI-AI01`, `RI-AI03`, `RI-AI05`, `RI-AI07` | Append S51's box: counterpart clause replaced, `blind_status: not_possible` with reason, class-D contrast named beside it. `RI-AI01` and `RI-AI05` already have their disposition written in S51 and need only transcription. **`RI-AI03` and `RI-AI05` additionally owe a human read** — checked, neither has another human-in-the-loop check, and S51 reduces `RI-AI05`'s to a positive control (§7b). `RI-AI07` keeps M3 and needs only the appendix replaced. | Unweighted; S51 has already ruled two of the four. |
| **7** | `RI-CAM01`, `RI-CAM02`, `RI-CAM03`, `RI-CAM04`, `RI-CAM06` | Replace *"generated from §C's law"* etc. **and supply a human read**, because deleting the appendix leaves each of these five with none (§7b). | Five items, one area, and the largest single block where S51 costs a person rather than saving one. |
| **8** | `RI-CMB02`, `RI-CMB03`, `RI-CMB05`, `RI-CMB06`, `RI-CMB08` | Add the missing provenance sentence. On the evidence of three rounds of `not_possible`, the honest sentence is *"no admissible counterpart exists; §A/§B are inadmissible under S51"* + a named class-D ablation. | S51 named these five; the verdict record already says what they are. |
| **9** | `RI-WPN01` | State the second grid's provenance. It has none. A class-D ablation (our slot table against a deleted-slot-dispatch copy) is the natural arm and §How-we-lose item 2 already describes it. | New; unweighted; unbuilt. |
| **10** | `RI-CAM07` | The art-direction arm names an artefact that does not exist (*"a Morrowind-transposition reference from RI-VIS05"* — `RI-VIS05` publishes tables). Point it at `refs/morrowind/REF-A*` (278 files) or at an authored class-C silhouette sheet. Fidelity arm needs no change and is now buildable (`refs/modern/character_closeup/`, 13 files). | Half-valid; the fix is a path, not a rewrite. |
| **11** | `RI-CMB10`, `RI-PRG09`, `RI-CMB09`, `RI-WPN02`, `RI-WPN03`, `RI-WPN04`, `RI-WPN06`, `RI-WPN07`, `RI-CAM05`, `RI-CMP03`, `RI-WLD09` | Re-record: `blind_status: not_possible` with reason, **plus** the class-D contrast named as a substitute instrument — never as a reference pair. `RI-CMP03` already words this correctly and is the model sentence. | Bookkeeping, but S51 makes it binding, and it is what stops a class-D result being cited as ours-vs-theirs. |
| **12** | `RI-WPN04`, `RI-WPN06` | Add `RI-WPN03` M6's second half: a correct separation with **no nameable mechanism** is a FAIL. Under Ruling W2 distinguishable is not good. | Converts a mechanism check into a quality read at the cost of one sentence. |
| **13** | `RI-VIS07`, `RI-VIS09`, `RI-WLD04`, `RI-WLD12`, `RI-DLG06`, `RI-AUD01`, `RI-AUD03`, `RI-AUD05` | Set `blind_pair: no` and add `human_read: instrument` (S52's proposed field). **`RI-VIS07` is the S52 case exactly**: `no` is the right value and the naming test is the human read. | Costs nothing, removes eight false trails. |
| **14** | `RI-VIS06`, `RI-VIS02` | Strike the stale *"`refs/modern/` is empty"* / *"Until `refs/modern/` is populated"* text. It is 131 files. `RI-VIS06`'s cap — *"a wave in which zero Protocol A pairs ran caps FIDELITY at 7"* — is now avoidable and nobody has noticed. | A live score cap resting on a fact that stopped being true. |
| **15** | `RI-MAG05` | A-M6 has been blocked twice (`W1-14-r2`, `W1-14-r3`) because *"`refs/morrowind/` carries no capture indexed as a spell-effect frame"*. Owed to `RI-VIS09`: index a spell-effect slot. | An acquisition, not a rewrite; two rounds already lost to it. |
| **16** | `RI-WLD08`, `RI-WLD15`, `RI-WLD03` | Class A is correct but the artefact is not held: 60 s Morrowind video clips, a matched walk strip, eight Morrowind town top-downs. File as acquisition debt against `RI-VIS09`, not as an item defect. | Correctly specified, unbuildable today; must not be silently downgraded. |

**Not owed, and deliberately so:** `RI-CMB07` (already amended), `RI-DLG08` (exemplary — copy it),
`RI-EXP02`/`RI-EXP03`/`RI-EXP05` (already refuse win-rate scoring), `RI-CMP03` (already declares
itself not-ours-vs-theirs), `RI-WPN07` (already S51-compliant), `RI-CAM05` (its convergence pass
condition is correct and must not be "fixed"), and all 21 class-A items.

---

## 7. The two things S51 left open

### 7a. `RI-CMB10` — the item worded differently, which the arbiter did not chase

`RI-CMB10`'s blind section is **M6 — Legibility (`blind_pair: yes`)**, and it is worded differently
because it is a different *kind* of test:

> *"Capture 1280×720 frames, HUD off, of a character at meter 0.00 / 0.24 / 0.26 / 0.75 /
> just-procced, for each status, at 8 m. — Present the **0.24 and 0.26 pair unlabeled**: *"which of
> these two is about to bleed?"* **FAIL** if a fresh judge cannot tell."*

**Ruling: `RI-CMB10` is NOT void. It is a textbook S51 class D** — both arms ours, both rendered
frames, differing by exactly the mechanism under test (the 0.25 tell threshold), judged on the
artefact as a player meets it. No script that has read §A–§E can answer it; the answer lives in
pixels. It is the same shape as `RI-CMB09` M7, which S51 explicitly protects, and the near-threshold
0.24/0.26 spacing makes the wrong arm *plausible* rather than trivial — `HAZARDS` §0's requirement.

Two things are nevertheless owed, and they are edits 11 and 13 above:

1. It is recorded as `blind_pair: yes`, and S51 says a class-D contrast *"is not a substitute for a
   reference pair and may never be recorded as one"*. The honest record is `blind_status:
   not_possible` — this corpus holds no external status-effect VFX artefact — with M6 beside it as a
   **named substitute instrument**.
2. **M6 is the only human read in the entire item.** M1–M5, M7 and M8 are all counters and sweeps.
   Whatever is done to the field, M6 must not be dropped in the tidying.

`RI-PRG09` is the identical case in the progression area — M8's *"show an afflicted and a healthy
character unlabeled and ask which is ill"* — and gets the identical ruling.

### 7b. Which pieces would be left with no human read at all — and which class supplies one

S51's own falsifier: *"if a piece under this row ends a wave with no human read of any kind …
the ruling has cost more than the defect."* Applying S51 as written leaves **sixteen items with no
person anywhere in the bar** — five camera, six combat, two AI, and one each in magic, weapons and
UI. Every other void item keeps a weighted class-D panel (§4). Naming all sixteen, and the class
that supplies a read:

| Item | Human read after S51 | Class that supplies one, and what it costs |
|---|---|---|
| `RI-CAM01` | **none** | **D** — our shipped arm against a **deleted-return-law copy** (§C's fast-out/slow-return removed, spring restored). Both `arm_len_m` traces runtime-generated, same authored interior route, unlabelled, question written first. The delete-the-fix copy is already required by rule 6, so this costs one capture. |
| `RI-CAM02` | **none** | **D** — our 180° reversal against a **deleted-turn-rate-cap copy** (the snap the item calls "the tell" is the ablation). Plausible wrong answer, not a trivial one. |
| `RI-CAM03` | **none** | **D** — our NDC scatter against a **deleted-framing-bias copy** (target-centring only, player anchor unconstrained). |
| `RI-CAM04` | **none** | **D** — measured `Tc`/budget against a **deleted-weight-scaling copy** (one budget for all 14 classes). |
| `RI-CAM06` | **none** | **D** — our `camera.pos.y` residual against a **head-bob-coupled copy**. The item already names the discriminator (a peak at the footfall frequency), so the ablation is exactly the failure it fears. *Caution, from `W1-00`:* our residual was bit-exactly zero over 900 samples, which made the pack degenerate from the other side. The ablated arm must be a **plausible** bob, not an absent one — `W1-00-r2` recorded `not_possible` for precisely this and was right to. |
| `RI-CMB01` | **none** | **D** — i-frame probe against a **deleted-equip-load-tiering copy**, judged as a rendered roll rather than as a vector; `RI-CMB09` M7's protocol transfers directly. Alternatively **A**: `refs/souls-behaviour/anim/stance/` holds three Elden Ring Quickstep clips. |
| `RI-CMB02`, `RI-CMB03`, `RI-CMB05`, `RI-CMB06`, `RI-CMB08` | **none** | **D** in every case, and each item's own §How-we-lose already describes the ablation (a one-clip attack, a stamina bar that is a readout, vacuous hyperarmour, a camera-relative roll, a heal with no commitment). `RI-CMB03`'s ablation is already half-built: `W1-09`'s reference arm behaved exactly as the ablation should, which is why it won. |
| `RI-AI03` | **none** — checked; the item has no other human-in-the-loop check | **D** — our per-move PWR distribution against a **deleted-recovery-variation copy** (one recovery length for every move), judged as rendered punish attempts rather than as a table. |
| `RI-AI05` | **none** — S51 reclassifies its only human check as an `instrument_positive_control`, which *"may never be reported as a quality read"* | **D** — the ten fingerprints against a **collapsed-roster copy** (all archetypes sharing one behaviour tree). This is the arm that makes the positive control mean something. |
| `RI-MAG01` | **none** | **D** — the `H[k]` sweep against a **deleted-`hard_until` copy**. |
| `RI-UIX01` | **none**, and it had none before S51 | **D** — the shipped HUD against a **numbers-on-enemies copy** (the item's own X1 forbidden element), same combat frame, judged *"which of these is a game that trusts you to look at the fight?"* |
| `RI-WPN01` | **none** | **D** — our slot grid against a **deleted-slot-dispatch copy**, judged on rendered motion, not on the grid. |

**The pattern, and it is cheap:** in every one of these sixteen the class-D arm is a **delete-the-fix
copy that rule 6 already requires the builder to produce.** `tools/control-clone.mjs` builds one for
0.2 MB and hard-links the rest (`HAZARDS` §5a). The marginal cost of a human read in the camera area
is one extra capture pass per item, not a new instrument.

**And the S52 precedent binds here.** S52's finding was that `blind_pair: no` was *right* for the
stealth items and the inference drawn from it was wrong — what those items owed was a **played
gate**, not a flipped field. The same applies in reverse to everything in this section: **do not
flip these items to keep `blind_pair: yes` with a table-derived arm.** That manufactures the very
defect S51 forbids. Record `blind_status: not_possible` honestly, and put a class-D contrast beside
it.

---

## 8. What this census did not do — plainly

- **No corpus item was edited.** By instruction, and so all three S-rulings stay one-step reversible.
  §6 is a list of edits *owed*, not applied. Nobody has committed to a round for them.
- **No pack was built and no judge was run.** This is a reading of 77 items and 78 verdicts. Where an
  item's counterpart is class A but the artefact is not on disk (`RI-WLD08`'s Morrowind video clips,
  `RI-WLD15`'s walk strip, `RI-WLD03`'s eight town top-downs, `RI-MAG05`'s spell-effect frames),
  this census records the debt; it did not go and acquire them.
- **The class-D ablations proposed in §7b are proposals, not measurements.** None has been built and
  none is known to discriminate. `W1-00`'s `RI-CAM06` result is the standing warning: an ablation
  that fails by *accident* — a bit-exact zero residual — proves nothing, and `HAZARDS` §0 says so.
  Each proposal needs a separability check by a third fresh reader before it can carry weight.
- **Item-internal weights were read from each item's `## Scoring` table, not recomputed.** Where this
  census says "unweighted", it means the clause does not appear as a row in that table.
- **Wave-0 and wave-2/3 verdicts were not swept** — only the 78 files in `corpus/90-verdicts/wave1/`.
  `corpus/90-verdicts/` holds no other verdict directory today, so the sweep is complete for what
  exists, but it is not a claim about future waves.
- **`RI-MTH03` was read but is not in the population** — it does not declare `blind_pair: yes` in
  front matter. Its protocol is cited by many items that do; if `RI-MTH03` itself is amended, the
  amendment reaches them without touching them, which is worth knowing before anyone edits 26 files.

---

## 9. One-line disposition for all 77 items

`A` external artefact · `C` authored exemplar · `D` within-build contrast · `VOID-T` table-derived ·
`VOID-U` no stated provenance · `ABSENT` declared with no apparatus · `SINGLE` single-arm instrument,
field misdeclared · `†` newly found by this census, not in the arbiter's 18.

| Item | Class | Note |
|---|---|---|
| RI-AI01 | VOID-T | S51 disposition already written |
| RI-AI02 † | VOID-T (leg) + D | weighted leg valid; §F leg void; class A now on disk |
| RI-AI03 | VOID-T | |
| RI-AI04 | VOID-T (appendix) + D | M10 valid, weight 3 |
| RI-AI05 | VOID-T | reclassified `instrument_positive_control` by S51 |
| RI-AI06 | VOID-T (appendix) + D | M4/C10 valid |
| RI-AI07 | VOID-T (appendix) + D | M3 ambush panel valid |
| RI-CMB01 | VOID-T | 3× `not_possible`, degeneracy diagnosed each time |
| RI-CMB02 | VOID-U | *"bit-identical to §A/§B"* |
| RI-CMB03 | VOID-U | *"§D gives bands, not a series"*; landed **against us** |
| RI-CMB05 | VOID-U | *"pairs against numbers, which are not blindable"* |
| RI-CMB06 | VOID-U | *"exact against §B, so the two sides coincide"* |
| RI-CMB07 | VOID (self-amended) | the source doctrine; class B when the exemplar returns |
| RI-CMB08 | VOID-U | |
| RI-CMB09 | **D** | S51's named clean specimen |
| RI-CMB10 † | **D** | S51's first open question — **valid**, §7a |
| RI-WPN01 † | VOID-U | second grid has no provenance |
| RI-WPN02 | **D** | amended: runtime-generated, columns stripped |
| RI-WPN03 | **D** | weight 8; the two-half structure is the model |
| RI-WPN04 | **D** | mechanism check; owes the "name a difference" half |
| RI-WPN05 | VOID-T (appendix) + D | M6's human-equivalent test valid, **weight 15** |
| RI-WPN06 | **D** | mechanism check; owes the same half |
| RI-WPN07 | **D** | fully S51-compliant already |
| RI-CAM01 | VOID-T | **no human read after S51** |
| RI-CAM02 | VOID-T | **no human read**; landed **against us** and once `tie` |
| RI-CAM03 | VOID-T | **no human read** |
| RI-CAM04 | VOID-T | **no human read** |
| RI-CAM05 | **D** | inverted pass condition, correct as written |
| RI-CAM06 | VOID-T | **no human read**; landed `tie` |
| RI-CAM07 † | VOID-U (art arm) + A (fidelity arm) | counted void; fidelity arm now buildable |
| RI-PRG09 † | **D** | M8 is the item's only human read |
| RI-MAG01 † | VOID-T | landed `tie` with S51's symptom in the rationale; **unweighted** |
| RI-MAG05 | A + SINGLE | A-M6 blocked twice on an unindexed refs slot |
| RI-QST01 | A | |
| RI-QST02 | A | |
| RI-QST06 | C | reconstructed act table |
| RI-QST08 | A | |
| RI-DLG01 | A | Balmora graph from `Morrowind.esm` extraction |
| RI-DLG03 | A | *"verbatim Morrowind text"* |
| RI-DLG05 | C | S51's named model for class C |
| RI-DLG06 | SINGLE | disqualifying weight; honest single-arm |
| RI-DLG07 | A + C | cats 1–4/6 verbatim, cat 5 declared `constructed` |
| RI-DLG08 | **C** | **best specimen in the corpus** — pre-committed bad arm |
| RI-WLD03 | A + D | Morrowind top-downs not held: acquisition debt |
| RI-WLD04 | SINGLE | primary instrument; valid |
| RI-WLD05 | A + SINGLE | |
| RI-WLD06 | A | |
| RI-WLD08 | A | Morrowind video clips not held: acquisition debt |
| RI-WLD09 | D + divergence | M-OP6 class D; M-OP3 is not a pair |
| RI-WLD10 † | VOID-T (appendix) + A (weighted) | counted void; M56 §5 valid and is the weighted leg |
| RI-WLD12 | SINGLE | weight 16; valid |
| RI-WLD14 | A + D | M84 has a real third arm (marketplace pack) |
| RI-WLD15 | A | walk strip not held: acquisition debt |
| RI-LOR03 | A | landed `void` on question form, **against us** |
| RI-VIS02 | A | now buildable — 131 modern refs |
| RI-VIS05 | A | 278 Morrowind refs |
| RI-VIS06 | A + amber | §B2 spec-conformance survives only because it runs through a render |
| RI-VIS07 | SINGLE | *"the test needs no image at all"* — the S52 case |
| RI-VIS08 | A | `refs/modern/character_closeup/` = 13 files |
| RI-VIS09 | SINGLE | category error: it is the registry |
| RI-UIX01 † | **ABSENT** | one occurrence of "blind" in the whole file |
| RI-UIX03 | A | |
| RI-UIX04 | A | |
| RI-UIX05 | A | art-neutralised, which is what makes it a layout answer |
| RI-UIX06 † | **ABSENT** | §G is a real read but is not a pair |
| RI-AUD01 | SINGLE | rule 25's finding was against a *verdict*, not this text |
| RI-AUD03 | SINGLE + D | B2 pairwise is within-build |
| RI-AUD05 | SINGLE | |
| RI-JRN01 | C | landed: pick on ours → harsher pass → **reference wins on review** |
| RI-JRN02 | C | |
| RI-JRN07 | A | |
| RI-JRN08 | A | |
| RI-CMP03 | **D** | already declares itself not-ours-vs-theirs — model sentence |
| RI-EXP01 | C | |
| RI-EXP02 | C | scores `judge_cannot_name_a_consistent_tell`, not a win rate |
| RI-EXP03 | C | scores `judge_located_our_sag` |
| RI-EXP05 | C | scores `judge_named_our_antagonists_strongest_claim` |

**77 rows. 51 cleared, 24 void or fail-closed, 2 absent.**

### Reversal

This file is a report. Deleting it changes nothing in the corpus, no item file was touched, and no
verdict was re-scored. S51, S52 and S53 each still reverse by deleting one table row.
