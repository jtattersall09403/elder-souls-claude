# BAR-CRITIQUE-W1-10-R1 — are the weapon bars good enough?

**Critic:** bar-critic, weapons pass 1. **Date:** 2026-08-06.
**Scope:** all of `corpus/12-weapons/` — `RI-WPN01`–`RI-WPN06`, `WEAPON-CRITIC.md`,
`moveset.schema.json`, `AMENDMENT-W1-10-01/-02/-CRITIC-01` — read against
`INTENT-AUDIT-CHARTER.md` §4 (verbatim brief), `ARBITRATION.md` §1/§3/S22/S26,
`SCORING.md` §0 and `CORPUS-CONTRACT.md`, with `corpus/90-verdicts/wave1/W1-10` as the
worked example of what these bars actually did when they were run.
**This critic does not judge the build.** It judges whether these bars would catch a game that
fails the user's intent, and whether they can be passed by a game that does not.

---

# VERDICT: **NOT SATISFIED**

Six defects, of which four are in the instruments and two are holes where no instrument exists.
All six are fixed or filed in this pass; the area is not cleared until the fixes have been *run*
once, because two of them are the kind that only a live measurement can confirm.

The one-line reason:

> **These bars can prove that eighty-seven weapons are different. They cannot prove that any of
> them has an opinion, and in W1-10 they could not tell that not one of the eighty-seven was in
> the game.**

Both of those are visible in the wave-1 record and neither was a critic's failure. `W1-10`
scored 0/10 and found the disconnection — but it found it by *inventing a second column the
charter never asked for*, and its two mandatory blind tests both returned **PASS** on a build in
which `setLoadout()` rejected all 87 weapons. A blind protocol that passes when the artifact is
unreachable is not testing the artifact. That is the single biggest weakness in this area and it
is §R6.

What is genuinely good here, said before the criticism so the criticism is not mistaken for a
survey: `RI-WPN04`'s `CFS` is the best hard fail in the corpus — binary, layered T1–T4 so that
each cheaper fake is caught by the next test, and it fired correctly at 0.0000 on a build every
other check called healthy. `RI-WPN03` M2's forgery check is the only measure in the area that
cannot be satisfied by editing data. `RI-WPN01` §A's mandatory-25 enumeration is a bar you can
write a counter against, which is most of what makes a bar real. Those three are not what is
wrong.

---

# The four referrals

## R1 — Is `Dg_min ≥ 1.0` reachable, or is the bar broken?

**Ruling: the arithmetic is upheld, the threshold is not moved, and the dimension set is
replaced.** Both remedies the builder offered are rejected.

### The builder's claim, verified independently

Recomputed from `RI-WPN02` §B and `RI-WPN04` §A's `r1.1` rows, not from the builder's tool:

| Quantity | Builder | This critic | Verdict |
|---|---|---|---|
| `Dg_min` over the four pinned dimensions alone | 0.396 (SPR–TSW) | **0.380 (SPR–TSW)** | upheld — same pair, same order |
| Best assignment under any mass-monotone hyperarmour ordering | 0.916 (AXE–HLB) | **0.933 (TSW–SPR)** | upheld — both far below 1.0 |
| Unconstrained continuous optimum | 1.601 | **1.583** | upheld |

The small deltas are BOW's unpublished R1 active/recovery split and a different but equally
defensible mass ordering. The conclusion is identical and it is correct: **`Dg_min ≥ 1.0` could
not be reached from the item's own published table without a hyperarmour ladder in which the
mace out-armours the axe and the ultra greatsword under-armours the straight sword.** The
builder was right to file arithmetic instead of curve-fitting, and `RI-MTH04` is the right
citation for why.

The AXE–HLB observation is also right — 15° of arc, 15 cm of lunge and 0.026 of a ratio — and it
is what `RI-WPN02` §B says those two classes are.

### Where the diagnosis stopped one step short

The builder concluded that either the bar must fall or a dimension must be added. **The fault is
in neither the threshold nor the dimension count. It is in which dimensions were called "mass".**

**Defect 1 — reach was misclassified.** `Dg`'s anti-gaming clause excluded D5, D8, D9, D10 and
D12 as scaling with weight. Measured across the fourteen melee classes from §B's own columns:

| Excluded dimension | corr. with weight tier | corr. with `stamina_r1` |
|---|---|---|
| `stamina_r1` | 0.935 | — |
| `motion_value` | 0.889 | 0.965 |
| `poise_damage` | 0.873 | 0.949 |
| **`reach_m`** | **0.586** | **0.556** |

Reach is by a wide margin the *least* mass-correlated thing `Dg` throws away, and the item's own
"How we lose" #4 says why that should have been obvious: *"Reach must be a consequence of the
bone chain."* Reach is geometry. §A defines four of the fifteen classes purely by spacing —
*"Can you win by never being reached?"*, *"Can you live at zero range?"* — and §B's constraints
table demands a ≥2.5 m reach spread with the rationale *"Spacing must be a build decision"*.
Excluding the most player-legible geometric property in the game from the geometry distance was
a category error, and it is the whole of the SPR–TSW problem: those two classes are genuinely
near-identical in chain, arc, root and ratio, and differ by **0.90 m of reach**.

**Defect 2 — BOW is inside the z-normalisation population, and it destroys reach.** BOW's
`22.0 m` projectile range against a melee span of 0.90–3.60 m puts the reach mean at 3.57 with
sd 4.98. The melee roster is compressed into a z-span of **0.542** where the melee-only span is
**3.599** — a **6.64×** loss.

**This defect is not confined to `Dg`.** D5 is one of the twelve dimensions of the headline
`D_min`, and of `RI-WPN03` §D.2's `F87` from which `SEP`, `W_min` and `W_med` are computed. Every
one of those numbers has been reading a reach column with 85% of its discrimination normalised
away, including the `D_min = 1.629` and `SEP = 1.4469` reported in W1-10. Neither the weapon
critic nor the builder found this; it is this pass's own finding and it is the most consequential
single line in this document, because it means four published headline numbers were measured with
a broken instrument and are not evidence of what they were taken to be.

**Defect 3 — nothing looked past the first hit.** `AMENDMENT-W1-10-CRITIC-01` Defect 2 is upheld
in full. Of five dimensions, only `max_chain_len` saw the second swing.

### The repair, and the witness

`RI-WPN02` §D now specifies **nine `GRAMMAR_DIMS`** over the **14 melee classes** (BOW excluded
by §A's own words — *"the only class with no melee grammar"*): the four pinned dimensions, reach,
hyperarmour fraction, and three free chain-grammar dimensions G7 `chain_arc_range`, G8
`chain_shape_count`, G9 `chain_root_ratio`, all measured from hitbox records and never from
declared JSON. Free dimensions go from one to four.

**A bar critic who rules a bar reachable and does not produce a witness has done the same thing
as a builder who curve-fits.** So, computed and recorded:

All four rows over the same 14 melee classes, so the comparison is of dimension sets and
nothing else. Reproduce with `node corpus/80-methods/m-wpn02-dg-witness.mjs`.

| Dimension set | `Dg_min` | limiting pair | `Dg_med` |
|---|---|---|---|
| As published (D2, D4, D6, D7, D11) | 0.4580 | AXE–MCE | 2.692 |
| + reach only | 0.4770 | AXE–MCE | 2.947 |
| + chain grammar only | 0.8047 | TSW–SPR | 4.048 |
| **Repaired set, both** | **1.4445** | TSW–SPR | 4.227 |
| Repaired set, best mass-monotone `D11` | 2.3485 | — | — |

Both new derived constraints are met **on the nose** by the witness — 7 of 14 classes at
`chain_shape_count ≥ 2` against a floor of 7, and 10 of 14 at `chain_arc_range ≥ 20°` against a
floor of 10. That is deliberate: the witness is a floor design, not a comfortable one, and a bar
whose witness clears it by a mile has been set too low.

`D11` in the first four rows is a **plainly narratable** ladder, not an optimised one: nothing
for FST/DGR/CSW, then 2/4/6/8/8/8/10/14/16/18/20 of the mandatory 25 rising monotonically with
mass through TSW→UGS. The chain design behind G7–G9 is consistent with every §A role and every
§C class rule and is written out in the ruling's working.

Note what the middle two rows say: **reach alone moves the SPR–TSW pair and does nothing for
AXE–MCE; the chain triple alone does the reverse.** Neither repair is sufficient. Both are
adopted, and `Dg_min ≥ 1.0` **stands unmoved** with 0.44 of headroom at a design anyone can write
down.

**On Option 2 (restate the band at 0.90):** rejected on principle. A threshold reached by
lowering it has stopped being a bar, and 0.90 was chosen because the build measured 0.914. That
is curve-fitting the corpus instead of the roster, which is worse, because the roster gets
re-measured every wave and the corpus does not.

**On Option 1 (`Rh` as D13):** rejected on arithmetic — see R2.

---

## R2 — `AMENDMENT-W1-10-CRITIC-01` and `-02`, clause by clause

The full clause tables are written into the two amendment files themselves, so a builder or
critic reading them reads the disposition rather than a cross-reference. In summary:

### `AMENDMENT-W1-10-CRITIC-01`

**Defect 1 (`ARI`'s bands unreachable from below) — ADOPTED.** The arithmetic is right and I
re-derived it: `C_min = Σ mandatory_k · ⌈N_k/4⌉`, so the 0.19 hard fail could never fire and the
0.26 pass bar was always true. The measured 0.4547 sat comfortably inside a band it could not
have left. **One correction, which strengthens the finding.** `C_min = 664` assumes sharing is
confined *within a class*; §C never said so — `SHARE(c)` was defined over the whole game — so a
roster could legally have put a dagger and an ultra greatsword on one clip and driven the true
floor to `⌈S_total/4⌉ = 517`, `ARI = 0.2504`. A grotesque design and a passing number. The
`SHARE` scope is therefore tightened to **within-class** in `RI-WPN03` §C, which is what everyone
assumed and nobody wrote, and it is what makes the replacement bands mean anything. With the
chain-2 ruling (R3) the floor is `C_min = 656`, `ARI_min = 0.3177`; bands land at **PASS ≥ 0.42,
HARD FAIL < 0.33**. The amendment's 0.32 sat 0.0015 above the floor and would have been
decorative.

**Defect 2 (nothing measures the chain) — DIAGNOSIS UPHELD, INSTRUMENT REJECTED.**

This is where the harshest thing in this document lives, and it is aimed at a proposal both the
critic and the builder endorsed.

`RI-CMB02` §C's chain multipliers are **class-uniform**: hit 2 startup ×0.78 recovery ×1.05, hit
3 recovery ×1.35, for every class alike. Therefore, for any conforming build:

- every `Rh` **ratio** component is `r1_recovery / r1_startup` × a constant — a rescaling of D2,
  a dimension `Dg` already has;
- every `Rh` **gap** component is a linear function of `r1_startup`, measuring
  **−0.976 correlated with startup** across the fourteen melee classes.

| `Rh` component | corr. with `r1_startup` |
|---|---|
| ratio block (0–4) | −0.78 to −0.83 |
| **gap block (5–8)** | **−0.85, −0.97, −0.97, −0.85** |

Adopting Option 1 would have added nine components to `Dg`, five of them a rescaling of a
dimension it already had and four of them **`r1_startup` in disguise** — importing the single
most mass-correlated quantity in the corpus into the distance that exists to strip mass out. It
raises `Dg_min` from 0.458 to 0.594 on the pinned set, and adding raw `r1_startup` alone gets
0.481 of that for free. **It is a bar that would have been passed by making the weapons more
different in mass**, which is the exact failure `Dg` is the only check against. Neither filing
noticed, and both are frank documents; this is what "the bar critic pushes on the bar" is for.

The replacement is `RI-WPN03` §D.3 `Chg` and `RI-WPN02` §D's G7–G9: the chain measured as a
sequence of **shapes, arcs, root travel and swing planes**, from hitbox records. A chain is a
sequence of swings, not a sequence of frame ratios.

**Both of the builder's refinements are adopted**, and they were good ones:
- *Make it separate classes, not only weapons* — yes; that is G7–G9 in `GRAMMAR_DIMS`.
- *Pad with the weapon's own last link, not its `r1.1`* — yes, and it matters far more for `Chg`
  than it did for `Rh`: padding a chain-2 class with its opener makes it look like a weapon that
  repeats itself.

**`Rh_min < 0.03` as a hard fail — REJECTED, not deferred.** The builder asked to adopt it as a
PASS band now and promote it in wave 2, on the honest ground that the amendment admits the value
was set by analogy. The instinct is right and the remedy does not go far enough, for two reasons
the deferral would have carried forward intact:

1. **It punishes the deviations this area says are the real ones.** With class-uniform
   multipliers, `Rh` within a class is a function of frame overrides alone. A weapon whose
   deviation is a new clip, a new `shape` or a new arc — the expensive, animator-cost overrides
   `RI-WPN03` §B distinguishes from parameter nudges, and exactly what `DEV_id` on `r1.1`/`r1.3`
   exists to buy — sits at `Rh` distance **0** from its baseline and hard-fails. That inverts
   `WEAPON-CRITIC` §1 corollary 1: numbers are not variation. A hard fail that rewards nudging
   frames over authoring animation is worse than no hard fail.
2. **It fires on BOW by construction.** BOW's chain is one link, so `Rh` is entirely padding and
   within-class `Rh_min` is structurally 0 for all five bows. Measured on the shipped roster,
   BOW has **one** distinct chain-frame signature across five weapons — and so do parts of DGR
   (4 of 6), CGS (4 of 5), GHM (4 of 5) and HLB (4 of 6). The proposed hard fail would have
   fired immediately on a roster the same corpus calls *"the strongest thing in the piece"*.

A threshold that fires on a whole class by construction is not a measurement. `Chg` therefore
carries PASS bands and **no hard fail in wave 1**; any wave-2 hard fail must come from the
measured distribution and not by analogy with `W_med`. That is the same discipline `ARI`'s defect
demanded, applied in the other direction.

### `AMENDMENT-W1-10-02`

§A — upheld on arithmetic, both options rejected (R1). §B — adopted and extended (R3). §C — noted;
no amendment needed, and the observation that the eight extension classes are *not* covered by
`RI-CMB02` is the useful half of the filing.

**§D's request to downgrade the over-fragmentation bar to a warning — REJECTED, and this is the
one clause in either document that argues for an easier standard rather than a better one.**

The stated tension is with *"the `UNQ ≥ 4` and `DEV_id > 0` bars two subsections away"*. **There
is no `UNQ ≥ 4` bar.** §C requires `UNQ ≥ 1` per weapon, `mean UNQ ≥ 2.0`, and `DEV ≥ 4` — and
`DEV` is satisfiable entirely by parameter overrides that cost no clips at all. Those floors force
`ARI` to roughly **0.32–0.35**; the fragmentation bar sits at **0.60**. The claimed tension is a
quarter of the range wide and it does not exist. The builder's own shipped roster disproves it
empirically: `ARI = 0.4547` with `UNQ` mean 3.70 and zero weapons at `DEV_id == 0` — both sets of
bars satisfied simultaneously, with 0.15 of clearance to the fragmentation bar.

`WEAPON-CRITIC` §1 corollary 3 is binding: *"'Subtly unique' is two-sided. Eighty-seven
snowflakes fails as surely as three animations… a critic that only ever pushes for more
difference is not applying this bar."* The fragmentation clause is the **only** bar in the entire
area enforcing the second side. It stays a fail. It has been moved to 0.60 and stated explicitly
as a fail rather than a band, so nobody has to infer it again.

---

## R3 — `r1.3` mandatory vs `max_chain 2`

**Ruling: the builder's proposal is adopted, and a third contradiction it did not find is fixed
with it.**

`RI-WPN01` §A slot 3 made `r1.3` mandatory on every melee weapon and called it *"terminal for 11
of 15 classes"*; `RI-WPN02` §B publishes CGS and GHM at `max_chain` **2** and §C repeats it in
prose. Both could not stand. `RI-WPN01`'s own §"The bar" says it does not own frame values and
that `RI-WPN02` §A/§B extends the table — so **§B's chain column wins**, and `r1.3` / `2h.r1.3`
are conditioned on `max_chain ≥ 3`, exactly as `r1.4` already is on the same column.

Counting the column: chain-4+ is DGR, FST, CSW (3 classes); chain-3 is TSW, SSW, SPR, AXE, MCE,
HLB, WHP, GSW, UGS (9); chain-2 is CGS, GHM; BOW is 1. **`r1.3` is terminal for nine, not
eleven** — the "11" was arrived at by counting the two chain-2 classes as terminating at a slot
their published chain length says they never reach.

**The third contradiction, found in this pass.** Slot 4 reads *"`r1.4` legal only for DGR, FST,
CSW, **TSW** (see RI-WPN02 §B chain-length column)"* — and §B publishes TSW at `max_chain` **3**.
The parenthetical cites the very column that refutes the list it is attached to. TSW is struck
from slot 4. Three mutually inconsistent statements about chain length lived in two adjacent
sections of one item and neither the round-1 critic nor the round-2 builder found all three; that
is the cost of a table being transcribed rather than derived.

Three consequences are written into the items rather than left to be rediscovered:

1. **The mandatory count for a chain-2 class is 23.** `S_total` becomes `72×25 + 10×23 + 5×7 =
   2065`, which moves `ARI`'s floor and therefore its bands. M1 reports
   `slots_present / mandatory_for_class`, never `/25`.
2. **`M/O` is a function of the class, so a build may not choose.** A CGS weapon declaring `r1.3`
   anyway is publishing a chain length that contradicts §B, and the mash probe decides.
3. **The round-2 workaround is not adopted.** Declaring `r1.3` and reaching it only out of a
   dodge (`roll.r1 → r1.3`) is genuinely clever and it is a defensible design — but it
   contradicts §A slot 10, which publishes `roll.r1 → r1.2`, and it was taken unilaterally. A
   class may diverge from the published chain graph **only** by an explicit `RI-WPN02` §C row, so
   the divergence is on the record and a critic measures it rather than discovering it. Improvised
   chain graphs are how a slot table stops being a contract. The design itself is welcome; file
   it as a §C row and it is legal.

---

## R4 — Is there a `Reach (m)` ambiguity?

**Ruling: yes, it is real, it was live, and under S26 it was about to produce a false failure.**

`RI-WPN02` §B's `Reach (m)` column was used as both a blade length and an effective reach, while
M1 sub-probe C measured *"the largest distance at which a hit fires"* — a measurement that
**necessarily includes the attacker's root lunge**, because the attacker translates during the
attack. On UGS those two readings differ by **1.40 m**. M3's conformance tolerance is ±0.10 m. The
item would therefore have failed a correct build by a factor of fourteen, or been "fixed" by
shrinking a blade — and either outcome would have been recorded as a build defect.

Resolved in §B:

1. **`Reach (m)` is blade reach**, measured with root translation suppressed. It must stay
   independent of `Root Δz`, which is a separate published column *and a separate fingerprint
   dimension*; a reach silently containing the lunge would make D5 and D7 partially the same
   number, which is a second, quieter way the fingerprint would have been overstating itself.
2. **`threat_m = Reach + Root Δz`** is the player-facing spacing figure, derived and never
   authored, with a melee spread requirement of ≥3.0 m. It is what a player actually learns and
   what encounter designers must read.

**And S26 binds here harder than anywhere else in the corpus.** The old sub-probe C started at
0.6 m and stepped *outward*, recording only the largest hitting distance. That instrument
**cannot see an interior gap** — which is precisely the defect S26 exists for — cannot report a
minimum reaching distance, and folds the lunge into the number. Three defects in one probe. It is
replaced by C1/C2/C3: blade reach with root motion off, threat sweep with it on, and the S26 body
corridor, over a 0.20–5.00 m range, with **contiguity a hard fail** and `reach_min_m ≤ 0.60 m`.

This matters more than it sounds. The W1-09 hole that produced S26 was **1.2 m** wide. UGS
declares a **1.40 m** R1 lunge and a **1.90 m** R2 lunge — the largest root translations in the
game, on the class most likely to be built last. `corpus/12-weapons/` is where the biggest
lunges live and it had **no S26 check at all**; the ruling landed in `ARBITRATION.md` and never
propagated to the items whose numbers it governs. That is the *stalled correction* drift the
intent charter §6 names, and it is the second instance of it in this document.

---

# R5 — Pushing on the bar: five holes

## H1 — Nothing measures whether a player can tell a mace from an axe *while playing*

Every blind test in this area hands the critic a **trace file or a plot**:
`RI-WPN02`'s three-trace test, `RI-WPN03` M6's twelve-trace clustering, `RI-WPN04`'s ten
root-track plots, `RI-WPN06`'s two stance traces. `RI-WPN05` M6's eight-frame impact sequences
are the only images in the area, and they judge impact rather than moveset.

A trace carries `arc_sweep_deg`, `reach_m`, `root_dz_m`, `shape` and every declared frame field.
Separating eighty-seven statistically distinct movesets from those columns is **tautological** —
the trace *is* the statistics. The W1-10 blind pick is the proof, and it is a good-faith
recitation of the design document: *"reach 1.75 m, 12–22 f startups, arcs 120–183° with three
305–360° `spin` slots"*. That is a reading test on a spreadsheet with its header removed, and it
returned PASS on a build where **not one of the 87 movesets could be equipped.**

Fixed in three places: `RI-WPN02`'s and `RI-WPN03` M6's blind packs must now be generated through
`setLoadout()` plus an input script **in the live simulation**, and must carry **no design
columns** — per-frame world positions of player, weapon tip and hitbox capsules, target state,
input stream, and nothing else. If a style cannot be described from motion alone, the difference
is in the spreadsheet and not in the hand. A pack buildable from JSON is **VOID**, not PASS.

## H2 — The heavy attack has no bar of its own

The user named five verbs. Four have real bars. **The heavy does not.**

`RI-WPN01` §C's charge contract is excellent and it measures the *charge* — ramp monotonicity,
hyperarmour onset, single stamina deduction, uncancellability. Nothing anywhere requires the
heavy attack to be **a different shape from the light**. §C states the rule once, for AXE alone
— *"`r2` is a `slash_v` overhead, not a bigger `r1`"* — in a class-rules table, and no method
generalises it. A roster in which all fourteen heavies are their lights with more frames and a
bigger motion value passes every item in this area.

Filed as `RI-WPN02` **M5b**: `r2` must differ from `r1.1` on `shape`, or arc by ≥30°, or root by
≥0.20 m, or swing-plane inclination by ≥30°. **Frame counts and motion value do not count** —
they are the numbers, and numbers are not variation. Weight 10, ≤2 of 14 classes may fail.

Walking the other four for completeness: **light** is covered by `RI-WPN02` §B and `RI-WPN05`
§E's mass bands, which are genuine quality bars rather than presence checks. **Combos** were
uncovered and are now `Chg` + G7–G9, with the tempo half filed as H5. **Roll-then-attack** and
**backstep-then-attack** are the best-covered things in the area — `CFS`, the `Wgrid`, the
equip-load tier conformance, and M5's situational-superiority test, which is the only *quality*
bar among the five. Note that `RI-WPN04`'s own "How we lose" #9 predicts M5 will be skipped as
too expensive, and in W1-10 it was indeed scored 0 fail-closed as unrunnable. **The one check in
this area that asks whether a contextual attack is any good has never been run.**

## H3 — Nothing measures what a Souls player means by a weapon's identity — THE BIGGEST HOLE

`RI-WPN02`'s own opening paragraph promises the thing:

> *"…the enemies that were easy are now hard while the enemies that were hard are now easy."*

**No method measures that sentence.** Six items and twenty-eight methods measure *dispersion*:
eleven fingerprint dimensions, a reuse index, a fidelity score, a divergence ratio, a legibility
score, a subtlety band. Dispersion is not character. A roster of eighty-seven statistically
distinct movesets in which every weapon is roughly equally good against every enemy passes all
six items outright, and it contains no weapons — only skins. `RI-WPN02` M6's wrong-footing probe
comes closest and it measures the **variance** of outcomes across classes, which a roster of
uniformly-good weapons with different swing speeds also produces.

A weapon that is distinct in eleven measured dimensions and has no character passes everything
here. That is the hole, and it is the one the user's brief actually points at: *"each weapon has
a subtly unique attack pattern"* is a claim about what a weapon is **for**, and its corollary is
what it is **wrong for**.

Filed as a new reference item: **`RI-WPN07` — weapon character**. A 14 × 10 class × archetype
advantage matrix measured from play under a fixed competent-play policy; every class must be top-3
against at least one archetype and bottom-3 against at least one (`DOM = DUD = 0`); rank span ≥ 6;
no two classes ranking the archetypes at Spearman > 0.80; and a headline **`RVS`** — the fraction
of the 91 class pairs for which *which weapon is better depends on what you are fighting* — at
PASS ≥ 0.70, HARD FAIL < 0.40. It carries a mandatory **policy-sensitivity control** (M5): the
ranking must survive a deliberately wrong operator, or the matrix is measuring the script and
every number in it is void. Its blind pair is the wrong-weapon test, the only blind test in the
area that asks about character rather than difference.

`RVS < 0.40` is the sentence this area could not previously say: **the roster is a power ladder.
Weapons differ; they do not disagree.**

## H4 — Animation quality is judged on 28 clips out of 1 133

The prompt's example is the right one: a prior critic found motion wrong where every number was
right — a straight sword sweeping 615°, a tip speed 2.69× declared, poses snapping 2.5 m in a
frame. What in `corpus/12-weapons/` would have caught those?

- **615° sweep** — `RI-WPN02` M3 (arc off by >10°) and M5 (`slash_h ⇒ 90–200°`) catch it, **but
  only on `r1.1`**. M5 is a census of the chain-root slot; the other twenty-four slots are
  unmeasured for arc conformance.
- **Tip speed 2.69× declared** — `RI-WPN05` §E's peak-tip-speed bands catch it, **per class, on
  the baseline's `r1.1` and `r2`**. Twenty-eight clips of 1 133.
- **A 2.5 m pose snap** — nothing measures bone displacement per frame. §E's tip-speed continuity
  row is the closest and it constrains the *tip's speed*, not any bone's position, and it too runs
  on 28 clips.

And there is a **stalled correction**: `RI-WPN03` M2's forgery check compares clip tracks in
**absolute metres**, so two clips that are the same curve at a different size or speed pass
trivially — a `mixer.timeScale` retime and a uniform scale defeat it by construction, which is
`RI-WPN02` "How we lose" #1 exactly. The W1-10 critic found this, went past the item, built the
missing normalised-shape cluster, reported 331 distinct path shapes at 10% tolerance — **and the
check stayed in the verdict and never reached the item.**

Both fixed: `RI-WPN03` **M2b** adopts the normalised-shape census with a floor of `0.20 × C`
distinct path shapes at 10% (W1-10 measured `0.29 × C`, so the floor is set below a real
measurement rather than by analogy), and `RI-WPN05` **§E.2** adds four per-clip rows measured on
**every clip in the game** — pose discontinuity ≤ 0.25 m/frame, tip-speed ceiling, per-slot arc
conformance, and ≥3 distinct keyframes per clip — with pose teleports > 1.0 m and a >5% rate of
two-pose lerps as hard fails.

The shape of this hole is worth naming: the corpus measured clip **identity** exhaustively and
clip **quality** on a sample of twenty-eight.

## H5 — Every combo in the game has the same rhythm, by corpus construction

Found while ruling on `Rh`. `RI-CMB02` §C's chain multipliers are class-uniform, so for any
conforming build a dagger's four-hit chain and an ultra greatsword's three-hit chain accelerate
and decelerate in exactly the same proportions; only the scale differs. The user named **combos**
as one of the five things a weapon must own, and at the level of rhythm **the corpus currently
guarantees that no weapon owns its combo.** A builder who varied it would be publishing frame
data contradicting `RI-CMB02`, which `RI-WPN02` §B's authority note forbids.

`RI-CMB02` belongs to `critic.combat` and is not this critic's to edit. Filed as
`AMENDMENT-W1-10-BAR-01`: make the chain rows a **default** with a ±0.20 per-class deviation
budget declared in `RI-WPN02` §B, require ≥6 of 14 melee classes to deviate, and extend the
`recovery / startup ≥ 1.40` readability rule to **every link** rather than only the chain root.
Until it lands, `Chg` and G7–G9 carry the chain axis on geometry alone — correct, and half of
what the user asked for.

---

# R6 — CONSUMPTION, S26, and what is now redundant

**Is anything redundant with the CONSUMPTION check?** No — and that is the problem. `RI-WPN01`
M6's declared-vs-observed agreement is the same *shape* as CONSUMPTION but strictly weaker: it
compares numbers, and it can pass while nothing in the world changes. Nothing in this area
demonstrates consumption by perturbing the model and watching an entity behave differently.

**`ARBITRATION.md` §3's CONSUMPTION check landed in wave 1 and never reached `WEAPON-CRITIC.md`.**
That is the third stalled correction in this pass and it is the most expensive one. The evidence
is the W1-10 verdict itself: five of the seven headline numbers passed on declared data while
`setLoadout()` rejected all 87 weapons, and both mandatory blind tests returned PASS on the same
disconnected layer. The critic caught the disconnection — honourably, and it is why the piece
scored 0 — but it caught it by **inventing a second column the charter never asked for**. A
charter that depends on a critic being cleverer than its own procedure is not a charter.

Written into `WEAPON-CRITIC.md`:

- **§3.3 is now nine headline numbers, each in a `declared` and an `observed` column, and the
  `observed` column is the score.** A number computable from `movesets/*.json` with the game
  disconnected is `unmeasurable ⇒ 0`, never "passing on the declared side"; the `declared` column
  is diagnostic and can never raise a score.
- **§3.1 gains a CONSUMPTION preflight**: `setLoadout()` every roster weapon, report
  `equipped_ok / 87` and `classes_with_zero_equippable`, and if the runtime cannot equip them,
  every number in §3.3 is 0 and the verdict says so in its first line.
- **A named world-side consumer and a perturbation demonstration** are now mandatory verdict
  fields.
- **All three blind packs** (the third is `RI-WPN07` M4) must be runtime-generated and stripped of
  design columns, or the result is VOID.
- Matching hard-fail clauses added to `RI-WPN02` and `RI-WPN03`.

**Is anything obsoleted by S26?** Nothing is obsolete; one thing was **defective**. `RI-WPN02` M1
sub-probe C is replaced, as ruled in R4 — the old outward sweep was structurally incapable of
detecting the interior gap S26 was written to catch, in the area of the corpus with the largest
root translations in the game.

---

# The single biggest weakness

**The bars in this area verify the artifact and not the game, and their blind tests — the one
instrument that was supposed to be immune to that — are the worst offenders.**

W1-10 is the demonstration and it should be read as a bar failure, not only a build failure: a
piece scoring **0/10**, with the movesets provably unreachable from the running game, returned
**PASS on both mandatory blind comparisons**, `ARI` passing, `SEP` passing, `D_min` passing,
`TDV` passing and `ILS` passing. Six of the seven headline numbers and both blind tests were
green on a layer no player could touch. The bars measured a very good spreadsheet, accurately.

Everything in R6 exists for this, and it is the fix that most needs to be *run* before this area
is declared satisfied — because it is the only one whose correctness cannot be established by
argument.

---

# What was changed, and where

| Change | File | Referral / hole |
|---|---|---|
| `GRAMMAR_DIMS` replaced: nine dimensions, 14 melee classes, reach admitted, G7–G9 chain grammar; `Dg_min ≥ 1.0` held; reachability witness recorded | `RI-WPN02` §D | R1 |
| D5 z-normalised over melee only; BOW substituted with the melee mean in the 15-class vector | `RI-WPN02` §D | R1 |
| `Reach (m)` defined as blade reach; `threat_m` derived; spread constraint added | `RI-WPN02` §B | R4 |
| M1 sub-probe C replaced with the S26 form (C1/C2/C3, minimum reach, contiguity hard fail) | `RI-WPN02` M1 | R4 |
| M5b — the heavy must be a different shape, not a longer light | `RI-WPN02` M5b | H2 |
| Blind pack must be runtime-generated and design-column-free | `RI-WPN02`, `RI-WPN03` M6 | H1, R6 |
| CONSUMPTION hard fails; scoring weights re-cut | `RI-WPN02`, `RI-WPN03` | R6 |
| `r1.3` conditioned on `max_chain ≥ 3`; "11 of 15" → 9; TSW struck from `r1.4`; per-class mandatory counts | `RI-WPN01` §A, M1 | R3 |
| `ARI` bands replaced (PASS ≥ 0.42, HARD FAIL < 0.33); floor corrected to 656 / 0.3177; `SHARE` scoped within-class; fragmentation bar held as a **fail** at 0.60 | `RI-WPN03` §C, §D.1 | R2 |
| §D.3 `Chg` — the chain grammar distance, replacing `Rh` | `RI-WPN03` §D.3 | R2 |
| M2b — the normalised-shape census, propagated from the W1-10 verdict | `RI-WPN03` M2 | H4 |
| §E.2 — per-clip motion integrity over every clip in the game | `RI-WPN05` §E | H4 |
| Nine headline numbers, declared/observed columns, CONSUMPTION preflight, three blind packs | `WEAPON-CRITIC` §3.1, §3.3, §6, §8 | R6 |
| **New item: weapon character, the advantage matrix and `RVS`** | `RI-WPN07` | **H3** |
| Amendment request: per-class chain multipliers | `AMENDMENT-W1-10-BAR-01` → `RI-CMB02` | H5 |
| Rulings recorded clause by clause in the filings themselves | `AMENDMENT-W1-10-CRITIC-01`, `-02` | R2 |
| `weapon.identity.character` registered | `subsystems.json`, `INDEX.md` | H3 |

---

# Conditions for SATISFIED

This area is cleared when all six hold. Five are checks; the sixth is the one that matters.

1. **`Dg_min` is recomputed over the nine `GRAMMAR_DIMS`, measured, and reported with G7–G9
   sourced from hitbox records.** If a well-made roster still cannot clear 1.0 with the repaired
   set, that is new evidence and the ruling reopens — but the witness at 1.4445 says it will.
2. **`RI-WPN07` M1 has been run once**, the 14 × 10 rank matrix is in a verdict, and M5's
   policy-sensitivity control passed. Until then `RVS` is an argument, not a measurement, and its
   `≥ 0.70` bar is explicitly provisional in the item's own provenance note.
3. **`Chg`'s within-class distribution is published**, so a wave-2 hard fail can be set from data
   rather than by analogy.
4. **Every reach in the roster has been measured under the S26 sub-probe** and every class's
   reachable band is contiguous. The classes to look at first are UGS, GSW and CGS.
5. **`RI-WPN04` M5 has been run at least once.** The only quality bar among the five verbs the
   user named has never executed.
6. **A weapons verdict has been produced in which the `observed` column is populated for all nine
   headline numbers, a world-side consumer is named, and a perturbation demonstration is
   attached.** Until that has happened once, nothing in this area is known to be measuring the
   game.

Until then: **NOT SATISFIED.**

---

## Provenance

`provenance: constructed`, confidence **high** on the arithmetic and **medium** on the two new
thresholds. Every figure in R1 and R2 is reproducible from `RI-WPN02` §B's published columns and
`RI-WPN04` §A's `r1.1` rows by any reader with fifty lines of script: the pinned-only `Dg_min`
0.380, the mass-monotone optimum 0.933, the unconstrained optimum 1.583, the four
mass-correlation figures, the reach z-span ratio 6.64, the nine `Rh`-component correlations
against `r1_startup`, the `ARI` floors 656 / 0.3177 and 517 / 0.2504, and the repaired-set witness
at 1.4445. The chain-frame-signature counts per class are read from
`game/data/combat/movesets/*.json` in the tree at `5e1a861`.

`RVS ≥ 0.70` and `Chg`'s bands are **set by argument, not measured**, and both items say so in
their own provenance notes. That is deliberate and it is the standard this ruling applied to
`Rh_min < 0.03` when it rejected it; it would be dishonest to exempt my own thresholds from it.
Both must be re-derived from wave 2's first full run.

`Dg_min ≥ 1.0`, `CFS = 1.00`, `SEP ≥ 1.4`, `W_med ∈ [0.35, 1.00]` and `TDV ≥ 0.60` are
**unchanged**. Nothing in this pass lowered a bar.
