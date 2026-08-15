# W1-F10-r10 — CRITIC

**Verdict: FAIL. ART 2/10 × FIDELITY 3/10 — an ordered pair, never averaged. Neither moved.**
Aggregation is `min` over axes; the scalar 2 exists only for the progress page.

Round 10's own first line was *"I DID NOT PHOTOGRAPH ANY OF THIS ON HARDWARE, AND THAT IS THE SAME
HOLE r9 AND r8 LEFT."* So that was job one, and it cost about two cents.

---

## The three claims, photographed

**One Pod, one process, four files swapped together.** `f10-r9c-stance-pair.mjs` could not shoot this
pair — it swaps one file against a baseline pinned to r9's own before, and round 10's change is spread
across `clips.js`, `combat/actor.js`, `clips.json` and `render/actor.js` with `15a6841c` as its base.
Swapping only `clips.json` would have put r10's *data* under r9's *code* — a `root_offset` nothing
consumes — and produced a sheet that looked like evidence and contained none. `f10-r10c-pair.mjs`
moves all four, each pinned by sha256 at the swap and again at the restore, with a self-test arm that
requires `stanceRootOffsetY` to be defined **and called** in exactly one arm.

RTX A5000, `ANGLE (NVIDIA, Vulkan 1.4.312)`, 24 frames, 12 per arm, `{"LIVE":12}` on both, 0 red.
**The pair is clean:** three 300×300 background regions — ground left, ground right, sky — report
**0 changed pixels of 90,000** between the arms, so all 219,555 changed pixels in `CP yaw000` belong
to the character, its equipment and its shadow.

### 1. The feet came down, and it is the ankle you can measure

Ground = **2.680 m** in both arms, identical to four decimals.

| foot bone, world y | BEFORE (`15a6841c`) | AFTER (r10) | Δ |
|---|---|---|---|
| `foot_l` | 2.7761 (+96.1 mm) | 2.7681 (**+88.1 mm**) | **−8.0 mm** |
| `foot_r` | 2.7812 (+101.2 mm) | 2.7733 (**+93.3 mm**) | **−7.9 mm** |

The r9 critic photographed the pre-contrapposto baseline at **89.0 / 90.1 mm**. Round 10's lower
ankle now sits at **88.1 mm** — 0.9 mm *below* that baseline. **The hover is gone.** My BEFORE arm
reproduces the r9 critic's AFTER arm to the digit (96.1 / 101.2), which cross-checks two
independently written capture tools against each other.

### 2. The pupil reads — at conversation distance, and nowhere else

The FP capture frames the face at **0.475 m**; the game's own `dialogue_arm_max_m` is 0.60 m, so FP
*is* conversation framing. BEFORE: two flat amber crescents with nothing in them. AFTER: two amber
almonds, each with an all-dark pupil and a white catchlight at its top edge. Counted over an
identical box in both arms — amber **466 → 1113 px** at b180, **280 → 1174 px** at b090.

**And it does not survive the orbit.** At the CP framing of 2.486 m — still closer than the 4.10 m a
player actually orbits at — the same eyes are two amber smudges and the pupil is not resolvable.
The builder's *"no lid, no orbit still stands"* is confirmed and is the larger half: at 9× the eye is
a bead sitting proud of the skin with no rim shadow on any side.

### 3. Nothing broke

`anim-tune` re-run independently: **snapIn 0.0000 on all fourteen**, worst snapOut **0.0122 m**
(dagger:light), 0 of 14 over the 0.35 m line. The r9 bound is exactly 0.0122 and it is met to the
digit. C3's player arm still passes 3 of 3 at both frames on the r9 critic's own unmodified tool.

---

## Two rulings the round asked for, and one it did not

### S59 — the preservation clause on `lr_diff_max_m`: **the builder's ruling stands; the clause is void as written**

The round declined to chase `≤ 0.00109` and named its own overturn condition: *"overturned if the
5.2 mm reads as visible in frames."* **I answered it on hardware, and it is not visible.**

- **Arithmetic, published.** The CP capture renders **376.2 px/m** at 1080 rows, so 5.2 mm is
  **1.96 px**. The camera a player orbits at is `CAMERA_CONST.arm_free_m` = **4.10 m**
  (`game/src/sim/camera.js:63`), where it is **1.19 px** at 1080p and **0.59 px** at the harness's own
  960×540 default. My capture is a *more* generous test than gameplay, not a less generous one.
- **Look, published.** At 6× with a ruled grid, the two soles are already **13 px** apart for a reason
  that has nothing to do with height — one foot stands 17 mm nearer the camera, and the perspective
  term dominates the height term about 6:1.
- **Noise floor, measured.** The boot band's mean luma-sum is **74.7 of 765** under a dither whose
  per-pixel standard deviation is **45.4**. A sub-2-px edge shift inside a near-black dithered region
  is not something an eye recovers.
- **And round 10 did not cause it.** On hardware the drawn per-foot difference is **0.0052 m in both
  arms** — this is r9's number inherited, not r10's regression.

**Replacement clause, both parts required:** (a) `after.lr_diff_max_m ≤ 0.00600 m` — a real bound,
since 0.00521 sits under it; and (b) preservation on the quantity the original clause was reaching
for and named wrongly: **the lower ankle's absolute height stays within 1 mm of the pre-contrapposto
baseline**. On this build that reads 0.07770 against 0.07774 — **0.04 mm**.

### S60 — the acceptance instrument is blind to the mechanism it accepts

`f10-r9c-c3-audit.mjs` still reports `rise_of_lower_ankle_m.mean = 0.00796` on this tree, and always
will: its `pose()` reproduces `poseLocomotion` as it stood *before* round 10 and computes `rootDy`
from the loop only. **The metric is evaluated off the support of the thing it measures** — no fix of
this shape can turn it green, and a build that deleted the stance entirely would score better on it
than one that compensated correctly. The builder refused to edit it (*"editing a critic's acceptance
instrument to agree with my own fix is metric-shopping"*), which was right and is why the
disagreement was visible at all. **The hardware settles it**; the criterion should name
`f10-r10-stance-height.mjs`'s `rise_vs_before_engine_r10_m` instead. The r9 tool needs a one-line
mirror of `actor.js:401` before anyone quotes it again.

### HAZARDS §20d — the landmine was filed with the wrong mechanism

The round records `swing.js`'s `r2()` as *"two decimal places… the smallest value it can emit is
10 mm"* and concludes *"fixing the generator needs a precision change, not a value change."*

`game/src/combat/swing.js:64` is `Math.round(x * 1000) / 1000` — **three** decimals. Smallest step
1 mm; `-0.00796` would survive as `-0.008`, an error of 0.04 mm. **The endpoints die at lines
311–318**, where `rootY` is built from hard-coded literals — `[0.0, 0.0]` at phase 0 — with no stance
term in the expression at all. Reproduced on a copy: `anim-author --only thrust` returns
`thrust.root_offset.y = [[0,0],…,[3,0]]` against a shipped `[[0,-0.00796],…,[3,-0.00796]]`.

**The warning is right and urgent. The diagnosis would have sent the next builder to widen a rounding
function that is already wide enough.** The same run re-derives §20a: `idle_loop` `spine_00.rx`
0.68 → 0.45 and `neck.rx` 0.75 → 0.5, still live.

---

## The biggest gap: the stance reaches one character

Round 10 reported that `syncNPCs` calls `poseStatic` only. **I checked it in the running game, which
is the arm it had not done.** Reading `bone.matrixWorld` off the objects the renderer drew, at the
Lilmoth crowd stand:

| | hip-line `dy` | shoulder-line `dy` |
|---|---|---|
| the player | −0.018289 m | +0.047948 m |
| **all 60 drawn NPCs** | **0.000000 m** | **0.000000 m** |

Exactly zero, not small. So RI-VIS10 §F#6 — *"a symmetric A-pose with the arms lowered, identical on
every NPC"* — is present on every NPC in every settlement, unchanged by two rounds of work aimed
squarely at it. **The r9 verdict's own `why_it_matters` is wrong on its NPC half:** the *layer* is
shared, the *code path that applies it* is not.

The remedy is cheap and the builder named it first: `poseStatic` already binds presentation meshes
**once** against `built.restWorld` and caches it. Bake the stance layer — and a per-NPC `idle_loop`
phase offset — into that one-time bind. Same per-frame cost, 408 characters.

> **My own instrument nearly produced a false confirmation of this**, and it is worth recording. The
> first version hashed each bone's *local* quaternion and reported the player and all 60 NPCs sharing
> one identical signature. `poseFromRig` writes bone **world** matrices and never touches the local
> quaternion, so a local-rotation reader is blind to the player's pose by construction. Self-test arm
> 1 — *"the player's signature must differ from the modal NPC signature"* — went red and caught it.

---

## RI-VIS10 — 13 of 18 censuses published, 3 of 18 pass

| | check | result | value |
|---|---|---|---|
| B1 | race legibility at 3 m | **fail** | not run — no fresh judge (rule 0e). **The orchestrator owes this.** |
| B2 | non-human feature census | fail | **6 of 10 — up from 5.** Row 3 (non-human eye) moved from NO to YES. |
| B3 | features are geometry | **pass** | crest, snout and tail each present and geometry; re-derived from my own 8-bearing orbit |
| B4 | the face is built | fail | 1 of 7 landmarks. The item's own §A puts the *eye* in VIS08 — so the pupil cannot move B4, and the **orbit** is exactly what would |
| C1 | canon of proportion | **pass** | R 7.38 / 7.50 / 7.68 over 41 figures; 41 of 41 in band; 928–930 px figure, 121–126 px head |
| C2 | silhouette distinctiveness | fail | median IoU 0.8574 over 552 pairs; **max 1.0000** — identical, not similar |
| C3 | the stand is not a mannequin | **fail** | arm (a) PASSES; **arm (b) fails 0 of 60** (see the amendment below) |
| C4 | reads at player distance | fail | not run — no fresh judge. **The orchestrator owes this.** |
| D1 | garment vocabulary | fail | the table does not exist; re-verified this turn |
| D2 | generic-fantasy list absent | fail | census not published — deliberately bounded, ≥3 cap not applied |
| D3 | material vocabulary | fail | **2 of 8**; re-derived by a second route (`actor.js:1497` builds exactly `reed`, `chitin`, `xanmeer`) and agrees with r9 |
| D4 | rank reads at 20 m | fail | not run — no fresh judge. **The orchestrator owes this.** |
| D5 | the clothes have been worn | fail | census not published — deliberately bounded |
| E1 | actors against population | fail | 32/408 = 1 per 12.75 (`townsman` 23.8%); **14 drawn bodies = 1 per 29.14** |
| E2 | head variety in one actor | **pass** | 14 distinct bodies among 97 `townsman` — and 14 is the *whole* pool |
| E3 | age and build spread | fail | 3 bands of 5; no child, no stooped-old axis exists |
| E4 | adjacency | fail | 93 pairs within 15 m — and they are the same body in the **same pose** |
| E5 | rendered mix matches data | fail | 2 of 4 races ≥5% in Helstrom draw no distinct body |

`DESIGN = 10 × 3/18 = 1.67` → band **0–2**. Under the bar as r9 left it the build passes 4 of 18 —
**the band and the ART score are 2 either way**, so the amendment below is provably not what holds
the score down.

### Bar extension — RI-VIS10 C3 gains a crowd arm (ADD-only)

C3 measured one idle on one character while the same item's §F#6 states the failure as *"identical on
every NPC. C3."* A build could author a stance on a layer no NPC evaluates, pass C3, and leave §F#6
present on 408 of 409 figures — which is what happened. **C3 now passes only if both arms pass:** the
player's three numbers, *and* ≥90% of drawn NPCs showing ≥2 of 3 over 3°.

Guards, per CRITIC-DOCTRINE §1.3: **ADD-only** (arm (a) unchanged, no threshold moved); **not the
reason anything passes** — it moves this round 4/18 → 3/18 and retroactively fails r9's C3, exactly as
the B3 amendment did to the verdict that wrote it; **bounded** — one browser session and a bone read,
and the instrument is banked and self-tested.

---

## Did either axis move?

**No — and that is not the same as nothing having happened.** Round 10 landed two improvements that
are real, measured and now photographed on paid hardware, and RI-VIS10's arithmetic cannot register
either, because both live inside checks that fail for other reasons: B2 moved 5/10 → 6/10 against a
7/10 bar, and the eye's *orbit* is B4's while its *geometry* is VIS08's.

**I have deliberately not amended the bar to reward them.** An amendment that raises the score of the
round that prompted it is the self-serving move §1.3 forbids. The one amendment I did file makes the
score worse.

FIDELITY did not move because RI-VIS08 was not run and no claim is made about it.

---

## What a player sees, in my own words, before any number

Eight bearings on an RTX A5000, whole figure in frame. A pale blue-grey padded barrel with no waist,
on two thick parallel tubes ending in olive drums. A small dark head with a muzzle and two cone
spikes. A very long dark tail sweeping out behind — real geometry, and it reads more like a
scorpion's sting than a lizard's tail: as long as a leg, curving up then to a point, rooted high. A
black hexagonal shield slab and a greatsword across the body. **At every one of the eight bearings
both legs are vertical and parallel, the boots level and shoulder-width, and the pelvis is not
displaced over either leg.** The contrapposto that passes C3 at 5° is not legible as a stance at the
distance a player stands. The difference between the arms is visible in a difference mask and is not
visible as a person shifting their weight.

---

## What I could not do, as plainly as what I did

1. **B1, C4 and D4** — no fresh judge, CLAUDE.md rule 0e. **The orchestrator owes all three, for the
   third verdict running.** 17% of this item's score has never been runnable by any critic this
   project has spawned.
2. **D2 and D5** — deliberately not run and bounded. They remain the cheapest way to move this score,
   and they have been the cheapest way for two rounds.
3. **RI-VIS08 not re-run**, so FIDELITY is not mine.
4. I shot **CP and FP only**, so I have no character-against-a-void crack frames — B2 row 9 (clawed
   hand) is carried from r9 and labelled as carried, in the census row itself.
5. I did not shoot the **30° orbit pair** B3 nominally asks for; I used 0° and 45° from the same
   eight-bearing sheet, which answers the contour-motion question by the same mechanism at a wider
   baseline. Declared, not substituted silently.
6. My NPC probe ran on **60 drawn NPCs at one settlement**, not 408 across eighteen. 60 of 60 at
   exactly 0.000000 is a strong sample, but it is a sample.
7. I opened **no new motion references**; the motion question was settled last round and this round's
   change is a translation and a bead.

**Cost:** one Pod, RTX A5000 at $0.270/hr, ~4 minutes of Pod life, terminated in mandatory cleanup
with deletion confirmed by a 404. Roughly **$0.02**. One local SwiftShader browser session after
`contention.mjs` returned GO. Everything else offline against a `git archive HEAD` scratch tree.

---

## One thing the round did that deserves saying plainly

Its `what_i_could_not_do` list is six entries long, leads with the criterion it *failed* rather than
the fix it landed, publishes a search that did not succeed with all three of its floors, names the
number that moved the wrong way, and tells the next round the cheapest thing to do is photograph its
own work. **Two of those six entries I closed in an afternoon for two cents, and I could only close
them because they were written down.** The one entry that was wrong was wrong in a way that was
checkable in ten minutes — precisely because it named the file and the line.
