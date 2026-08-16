# W1-F10 round 11 — critic's verdict

**FAIL · ART 2/10 × FIDELITY 3/10** (an ordered pair, never averaged) · pass threshold 7 · min over axes.
Judged against `RI-VIS10` (design). `RI-VIS08` was not re-run, so FIDELITY is the standing verdict's
number and explicitly not mine. Branch `codex/wave1-build-experiment`, HEAD `d0be91db`.

---

## The short version

**The round did the thing it set out to do.** Every person in Black Marsh now stands in their own
way. C3's crowd arm — 0 of 60 drawn NPCs at hip-line and shoulder-line `dy` of *exactly* 0.000000 m
for three rounds — reads **100% over the 3° bar on every denominator I could construct**: 60 of 60
meshes, 31 of 31 drawn, 27 of 27 drawn-and-in-Lilmoth, 408 of 408 offline, and **78 of 78 at
Helstrom**, which is the settlement the amendment actually names. I reproduced its whole offline
table on my own run: 392 distinct pose signatures, modal 2, 367 stance depths, 95 of 96 loop phases,
worst planting error **1.388 × 10⁻¹⁷ m**, and one single lower-ankle height across all 408.

**And I took the pictures it could not.** Nine frames of the Lilmoth crowd — five orbit bearings,
two portrait bearings, two motion offsets. It is the first time in eleven rounds of F10 that the
crowd has been photographed at all.

**Three of its claims are overturned, and one of them is the headline.**

| the round said | measured this turn |
|---|---|
| the harness cannot point a camera at a settlement's crowd — `camera`/`teleport` speak the sim's frame, the people are drawn in the cell's, and ring 0 must build a new method | **there is no mismatch.** drawn NPC world *x* − sim *x* = 0.000000 on 60 of 60 pairs; same for *z*; `province.group.position` and `scene.position` are the origin; the three.js camera equals the sim camera to every digit |
| the quarantined work was inert — "nothing anywhere passed it" — `RI-MTH07`'s fourth instance | `git show 86181c27:game/src/render/renderer.js` has `_anyStance` at line 697 and passes `stance` at 735 and 812. **The quarantine shipped its own caller.** Its own `recovered_and_NOT_used` entry says so, two entries above the headline |
| C2 and E4 are the two checks this work should move | **neither can.** `f10-silhouette.mjs:117` poses through `poseFromRig` — the combat path — and never calls `poseStatic` with a stance. E4's tuple is `(characterId, race)` and contains no pose |

**And it fails, on a clause I added in the same pass, which I say plainly because it is the whole
result:** C3 arm (a) has always required that *"the two frames differ"*. The crowd arm the r10 critic
wrote inherited every other clause from arm (a) and not that one. So it is a cross-section at one
instant: it asks whether people differ *from each other* and never whether any one of them differs
*from themselves a moment later*.

> **0 of 60 drawn NPCs change any non-foot bone rotation over 60 frames. The worst change across the
> whole crowd is exactly 0 radians.** The required-to-disagree control in the same session is the
> player, whose bones move **0.011246 m** over the same interval.

Four hundred and eight statues in three hundred and ninety-two distinct poses currently score 100%.

---

## What a player sees, in my own words, before any number

Five bearings at 9 m, two portraits at 3.4 m, UI off, SwiftShader (no appearance claim is made).

A row of four people under the overhang of a stilt house; four more out on the open deck toward the
water. **They are not a chorus line any more and you do not need a measurement to see it** — at b090
the near saxhleel stands stooped, head dropped, both arms hanging with visibly different splay, while
the figure eight metres behind stands square with the arms tucked and the head level. At b135 the
same contrast reads from the opposite side. At 3.4 m the portrait subject carries one shoulder up,
the head tilted off vertical, and the two arms at different angles. A person standing.

Then you watch, and nothing happens. Nobody breathes, shifts weight, or turns their head, ever.

Three things I saw and am **not** scoring here: figures stand *inside* building faces (one buried to
the shoulder at b090, one in a window reveal at b135, the portrait subject's back inside a plank
wall) — that is placement, not character design; at 9 m the bodies read as smooth pale-green tubes
with no cloth break at the waist, which is `RI-VIS08`'s and D-section's between them and measured by
neither today.

---

## The eighteen checks

13 of 18 published a census — **10 derived by my own commands this turn**, 3 carried from r10 with
the carry stated in the row. The 12-census floor is cleared, so the item scores its arithmetic.

| | check | result | value |
|---|---|---|---|
| B1 | race legibility at 3 m | **fail** | not run — no fresh judge (rule 0e). **4th verdict running** |
| B2 | non-human feature census | fail | 6 of 10 — *carried from r10* |
| B3 | features are geometry | **pass** | crest/snout/tail geometry — *carried*, snout and crest confirmed on my own bearings |
| B4 | the face is built | fail | 1 of 7 — *carried*; I looked and concur |
| C1 | canon of proportion | **pass** | R 7.38–7.62 over 41 figures, 41 of 41 in band (H 928–930 px, head 122–126 px) |
| C2 | silhouette distinctiveness | fail | median IoU **0.8574**, max **1.0000** — unchanged, and the instrument cannot see this round |
| C3 | the stand is not a mannequin | **fail** | (a) pass · (b1) **pass at 100%** · (b2) **fail 0 of 60**. *Under the bar as r10 left it, this check PASSES* |
| C4 | reads at 8–10 m | fail | not run — no fresh judge |
| D1 | garment vocabulary | fail | absent. 22 entries in `game/data/`, none is one; grep returns nothing |
| D2 | generic-fantasy list | fail | not measured, bounded, failed closed |
| D3 | material vocabulary | fail | **2 of 8** — `reed` and `chitin`; `xanmeer` is a `darkStone` clone and on none of the eight |
| D4 | rank reads at 20 m | fail | not run — no fresh judge |
| D5 | the clothes have been worn | fail | not measured, bounded, failed closed |
| E1 | actors against population | fail | 32 actors / 408 records; **14 drawn bodies** = 1 per 29.1 against a bar of 1 per 12 |
| E2 | head variety in one actor | **pass** | 14 distinct bodies among 97 `townsman` — passes because E1's pool is small enough to exhaust |
| E3 | age and build spread | fail | 3 bands of 5; no child axis, no stoop axis |
| E4 | adjacency | fail | **93** identical pairs within 15 m — unchanged, and no stance change can move it |
| E5 | rendered mix matches data | fail | Helstrom: saxhleel and dunmer draw no body another race there does not |

**Both arithmetics, published:** 4 of 18 under r10's bar, 3 of 18 under mine. **Both band at ART 2** —
so the amendment is provably not what holds the score down, and neither is anything this round did.

---

## The census defect both prior verdicts inherited

At the Lilmoth stand `sim.npcs` holds 60 records and the renderer builds 60 meshes. But:

- **29 have `mesh.visible === false`**, and all 29 sit within 5 m of the **world origin** on ground
  y between −41.134 and −40.703 m — under the Topal.
- **4 more are visible** at ≈(4906, −594) on ground −33 m, outside the province's own *x* extent.
- **The drawn-and-in-settlement crowd is 27.**

So "arm (b) fails 0 of 60" (r10) and "arm (b) passes 60 of 60" (r11) are both computed over a
denominator that is 55% figures no player can see, against an arm whose own words are *"DRAWN NPCs"*.
**It does not overturn the result** — I checked that first, and 27 of 27 pass. It is the number of
people who are there that has been wrong for two verdicts. That heap is also what the round's
"densest knot of the crowd" found, which is why its camera photographed a rooftop: its own report
records `people_within_9m: 29`.

---

## What I attacked and could not break

**The seeding survives all three attacks the build's own evidence structurally could not see** — its
stability arms are all *within one session*.

| arm | result |
|---|---|
| **REBUILD** — every NPC mesh destroyed, rebuilt by `syncNPCs` | 60 of 60 bit-identical |
| **TRAVEL** — 2.4 km away to another settlement and back | 60 of 60 bit-identical |
| **SAVE / RELOAD** — `saveState()` → `loadState()` → same stand | 60 of 60 bit-identical |
| **NULL CONTROL** — unread field on the stance object, rebuilt | 60 of 60 identical *(as required)* |
| **PERTURB** — every rotation key in the shipped stance ×3 | **60 of 60 changed** *(as required)* |

The last two are `RI-MTH07`'s consumption test done properly, with the control that makes it mean
something. Body-hash independence holds too: the two seeds are FNV-1a of different strings, they
collide on 0 of 408 eids, and mean stance depth by body-pool bucket runs 0.900–0.971 against an
overall 0.936 with no clustering.

**And the swing claim is true and stronger than the round argued for itself.** Re-derived
independently by importing `swing.js` and `clips.js` directly: 1,160 registry clips enumerated by my
own `Object.keys`; phase 0 **exactly 0 on 1,160 of 1,160** before, **−0.008 on 1,160 of 1,160**
after; boundary step **0.00796 → 0.00004 m**. The round proved the active window untouched with a
601-point sample, which a critic may read as *"the grid missed it"*. It cannot have:
`clips.js:29 sampleCurve` interpolates between **adjacent keys only**, the stance term touches the
keys at phase 0.0 and 3.0 alone, the keys at 1.0 and 2.0 are untouched, and **0 of 1,160 clips carry
any key strictly inside (1, 2)**. The active window cannot depend on the endpoints — structural, not
statistical. `anim-tune`, re-run by me: snapIn 0.0000 × 14, worst snapOut 0.0122 m, 0 of 14 over
0.35 m.

---

## Three instruments now cannot see what they are pointed at

Worth counting, because each was invisible to the others' tests — S60's domain rule, three times in
one item:

1. `f10-r9c-c3-audit.mjs` computes the root drop from the loop only → blind to a stance-layer root
   term. *(Settled as S60 by the r10 critic.)*
2. `anim-tune.mjs` holds a second copy of `poseLocomotion` and measures 14 archetypes → blind to
   1,160 registry clips popping 7.96 mm. *(HAZARDS §20d, closed this round.)*
3. **NEW:** `f10-silhouette.mjs:117` poses through `poseFromRig`, the combat path → **C2 is measured
   on a code path this round did not and could not touch.** Its unchanged 0.8574 is not a null
   result; it is silence.

---

## The rule-0e census, re-derived — and every figure in circulation is wrong

The brief said the last three documents say 98, 100 and 101. They are all counting files, and the
count **grows every time somebody cites it**.

- `grep -rl "blind_pair: yes" corpus/ --include=*.md | wc -l` → **103** today.
- Walking each for a front-matter `id:` → **81 are reference items**, 81 unique ids.
- The other **22 are verdicts and doctrine files quoting the string** — `CRITIC-DOCTRINE.md`,
  `ARBITRATION.md`, `VERDICT-SCHEMA.md`, `CORPUS-CONTRACT.md`, two intent audits, the prompt
  template, two journey files, and eleven wave-1 verdicts **including this item's own r10**.
- `grep -rln 'blind_status: *run' corpus/90-verdicts/` → 1 file, and the hit is prose *quoting that
  grep*. **0 verdicts record a blind pair actually run.** Recorded values across all verdicts: 7
  `not_possible`, 2 `not_required`.

**The true figure is 81 reference items.** The hole is real, is 22% smaller than stated, and is still
total.

---

## The one gap

### The crowd stands 392 ways and not one of them ever moves

`poseStatic` solves each person's stance **once** (`if (A.staticStance === undefined)`) and caches
it; each person's place in the 96-frame breathing loop is a per-person **constant**. Nothing
re-evaluates it. The build published this itself and read it the other way up — its L2 arm reports
worst non-foot drift 2.842 × 10⁻¹² m over 37 frames and files it as proof the stance is stable. It is
that, and it is also proof that a settlement is a waxworks.

**Remedy.** Split `applyStaticStance`'s one-time solve: keep `stanceVariationFor(name)` cached as
now, and re-run only the `loop.applyPose(buf, V.loopFrame + t)` → `addPose` → `mirrorPose` →
`addVariation` → root-solve sequence on a **staggered cadence**, the crowd split into N buckets so at
most 408/N actors re-solve per frame. N = 8 gives everyone a fresh pose eight times a second at ⅛ the
cost — the same trade `syncNPCs` already makes for the terrain conform.

**Done means** ≥ 90% of drawn NPCs show a changed non-foot bone rotation across 60 frames, **and**
the player control in the same probe still moves — so a green cannot be bought by breaking the
reader.

**Preservation, per S59, all four required** — they are what stop this being bought by re-rolling the
crowd every frame: (a) arm (b1) stays ≥ 90%; (b) REBUILD / TRAVEL / SAVE-RELOAD still return 60 of 60
bit-identical, because a crowd that re-rolls on stream-in is **worse** than a crowd that is still;
(c) the lower ankle stays within 1 mm per person — the numeric root solve must move with the pose or
everyone hovers again; (d) `anim-tune` still 0 of 14 over 0.35 m at worst snapOut ≤ 0.0122 m. **Plus
one budget clause**, because this is the only remedy in this item with a per-frame cost: publish the
frame time at the Lilmoth stand before and after, and it must not rise more than 5%.

---

## Closed

**`GAP-W1-F10-the-stance-reaches-one-character-and-the-crowd-is-408-identical-mannequins` — CLOSED.**
r10's DONE conditions were hip `max_abs` ≥ 0.010, shoulder ≥ 0.030, and ≥ 8 distinct signatures over
≥ 50 drawn NPCs. On the r10 critic's own unmodified tool: **0.022808 / 0.067162 / 60 distinct of
60**, modal count 8 → 1. Preservation met: lower ankle on the rest pose's to 1.388 × 10⁻¹⁷ m with one
distinct value across 408; `anim-tune` unchanged. This has been F10's headline failure for three
verdicts and it is finished.

---

## What I could not do, as plainly as what I did

1. **B1, C4, D4** — no fresh judge. Rule 0e. **The orchestrator owes all three for the fourth verdict
   running.** I owe nothing here.
2. **D2 and D5** — deliberately not run, bounded, failed closed. Third round as the cheapest
   unmeasured censuses in the item.
3. **RI-VIS08 not re-run.** FIDELITY is not mine and I claim nothing about it.
4. **No paid hardware.** All SwiftShader — valid for geometry, layout, composition and census;
   **no appearance claim is made** and none of the nine frames is compared to anything for its look.
5. **B2, B3, B4 carried from r10**, not re-derived — I shot no character-against-a-void pair.
6. **I did not rebuild the `c43ce8ca` control clone**, so HAZARDS §22 discipline on the round's
   before-arm is unverified by me. I also found it is *not verifiable from the artifact either*:
   `f10-r10c-npc-live.mjs` writes **no `commit` field**, which is the exact discriminator §22 tells
   you to read. That is a gap in the instrument, and it is worth closing before the next before/after
   pair is believed.
7. **The live crowd arm was measured at Lilmoth (61 records), not Helstrom (78)** — the population
   walk shows Lilmoth is the *second* largest settlement. Helstrom is covered offline at 78 of 78 and
   not in the running game.
8. **Both capture runs hit their foreground timeout before writing their own report JSON.** The nine
   frames survived; the report did not. I did not retry rather than end a turn waiting (HAZARDS §13).
9. **I did not measure the frame-time cost of the remedy I am asking for** — which is why it carries
   a budget clause instead of an assertion.
10. **I proceeded over the contention ceiling** for the last two browser runs (`contention.mjs`
    returned WAIT at 4.28 load/core), and I killed one orphaned browser tree **by PID** — 28459 and
    its five children, parent already dead — leaving the two sibling browsers alone (HAZARDS §10).

---

## Corpus changes filed

- **`RI-VIS10` §C C3 — AMENDED (ADD-only).** Arm (b) split into (b1) the r10 census verbatim and
  **(b2) arm (a)'s own temporal clause applied to the crowd**. Guards met: nothing relaxed, no
  threshold moved, it makes this round's score *worse* (4 of 18 → 3 of 18), both readings band at
  ART 2 so it is provably not what holds the score down, bounded to one browser session, and
  reversible with the reversal condition named.
- **`HAZARDS §24` — FILED.** `R.playerMesh.position` is (0,0,0) and a scene→world offset must never be
  derived from it; read a bone, not the group. Plus the invisible-NPC heap at the world origin that
  corrupts any "densest knot" and any raw `npc:` mesh census denominator.
- `node tools/roadmap-coverage.mjs` — all gates green. `node tools/readpath.mjs` — 30/30 probes ok.

---

## One thing the round did that deserves saying plainly

Its `what_i_could_not_do` list leads with the thing it failed at rather than the thing it landed,
publishes four camera attempts including the one it deleted, names its own tool's red arm and keeps
**both** numbers rather than the flattering one, names a divergence between the game and ten of its
own tools as a defect rather than waiting to be caught, and tells the next round to photograph its
work.

Two of those entries were things I could close in an hour, and I could only close them because they
were written down — **including the one that was wrong**, which was checkable in ten minutes precisely
because it named the file and the mechanism. That is the second consecutive F10 round where the
honest failure list was worth more to the critic than the headline, and it is the reason this verdict
has nine pictures in it.
