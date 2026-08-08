# W1-ATTR-SCALE — round 1 verdict

**Status: FAIL, 3.0 / 10** (min-over-axes, wave-1 gate 7.0). Critic: fresh context, wrote none of
the work under judgement. Build: HEAD `6bb9003`, branch `claude/morrowind-souls-threejs-game-mou39v`.

The fix is real. The reason given for it is not, and the reason is the part that will be inherited.

---

## The one-paragraph version

W1-ATTR-SCALE found a genuine, wide defect — 42 quest resolutions carrying attribute demands
written on Morrowind's 0–100 scale and skill demands naming keys the register does not have — and
it fixed all 42. I reverted every one of them independently and the auditor goes from **0 defects
to 23**, from **0 ladder inversions to 1**, and from **370/370 non-violent resolutions reachable to
347/370**. That is a real fix with a control arm that genuinely differs, and the piece deserves
credit for it.

But the piece rests every one of those 42 numbers on one premise, stated in capitals in its own
status file: *"THE BOUGHT ATTRIBUTE STREAM IS DEAD IN THE SHIPPED BUILD… no kill, no quest, no
loot path awards souls."* The only evidence ever offered for it is trial C of its CONSUMPTION
probe, which printed `souls 0 -> 0 over 5 kill(s) of 42 entities`.

**It killed nothing.** Its own shipped artifacts —
`reports/attr-scale-consumption-before.json` and `-after.json`, both committed — record five
entries of `{"error":"killEntity('undefined'): no such body"}`. And when I re-ran the claim with
the key the harness actually returns, **ten kills awarded 378 souls**, with a red control that went
red. The premise is false on HEAD.

---

## What I re-measured, and what came back

Everything the builder's `next_step` asked a critic to run, plus the things it did not.

| Command | Result | Artifact |
|---|---|---|
| `node tools/quests/attr-scale-audit.mjs --self-test` | 21/21 rules go red on their own violation | `artifacts/W1-ATTR-SCALE/audit-selftest.txt` |
| `… --sheet p10` | 124 quests, 0 defects, exit 0 | `artifacts/W1-ATTR-SCALE/audit-p10.txt` |
| `… --sheet median` | 0 defects, exit 0 | `artifacts/W1-ATTR-SCALE/audit-median.txt` |
| `node tools/quests/attr-scale-consumption.mjs --after` | 8/8 PASS | (re-run; superseded below) |
| `node tools/quests/attr-scale-consumption.mjs` | 5/8, exit 1 — the flip works | (re-run) |
| `node tools/quests/critic-attr-scale-dtf.mjs` **(minted here)** | fix reproduces: 0 → 23 defects | `artifacts/W1-ATTR-SCALE/dtf.txt` |
| `node tools/quests/critic-attr-scale-souls.mjs` **(minted here)** | **CONTRADICTED**, exit 1 | `artifacts/W1-ATTR-SCALE/souls-award.{txt,json}` |
| `node tools/check-quests.mjs` with two defects reinjected | both printed, exit 0 | `artifacts/W1-ATTR-SCALE/check-quests-injected.txt` |

The tree has grown under other agents since the builder ran: 124 quests and 370 non-violent
resolutions against the 120 / 358 in the status file. Every number below is on HEAD `6bb9003`.

---

## Finding 1 — trial C is an inert control, and it is the piece's load-bearing one

`engine.listEntities()` returns rows shaped `{ eid, kind, archetype, pos, hp }`
(`game/src/engine.js:9989`). There is no `id` field. The probe does:

```js
let ents = (H.listEntities() || []).filter((e) => e.id !== 'player');
…
try { H.killEntity(e.id); } catch (err) { D.kills.push({ id: e.id, error: … }); continue; }
```

Two failures, compounding:

1. `e.id !== 'player'` is `undefined !== 'player'` for every row, so the filter keeps **everything**
   — NPCs and props included. That is where "42 entities" comes from. Measured fresh at boot in my
   run: 36 rows kept, **0 of them enemies**.
2. `H.killEntity(e.id)` is `killEntity('undefined')` and throws every time.

And the verdict predicate scores the exceptions as a pass:

```js
D.kills.every((k) => k.error || k.souls_after === k.souls_before)
```

`k.error ||` short-circuits true. `D.kills.length > 0` is satisfied by five error records. The
printed line "over 5 kill(s)" counts them. This is RULES.md rule 6's **inert control** in its
purest form: a teardown that does nothing, so both arms are the same arm — and unlike the other
seven trials, trial C is **not flipped by `--after`**, so it passes identically in both modes and
would have passed forever.

The status file's finding 41 — *"spawned dres-raid-party, killed 5 of 6 entities, stepped 60 frames
each. soulsHeld 0 -> 0"* — is not what happened. Nothing was killed.

## Finding 2 — the claim it carried is false on HEAD

`tools/quests/critic-attr-scale-souls.mjs`, minted for this verdict, re-runs the claim with `eid`
and adds the control the original never had:

```
spawn -> kill immediately -> step 60      5 real kills, souls   0 -> 168
spawn -> step 60 -> kill -> step 60       5 real kills, souls 168 -> 378
RED CONTROL sim.souls.enabled = false     3 real kills, souls 378 -> 378
```

`game/src/sim/souls.js:321` awards on the alive→dead transition, 42 souls per infantry body. The
red control kills three more and awards nothing, so the instrument could have seen an absence had
there been one. **The bought attribute stream has a source.** The next level costs 418; ten kills
is 378.

A mechanism worth keeping: `SoulsSystem.step()` pays only a transition it has **seen**, so a body
whose first sight is already a corpse is recorded as settled and never paid. That is exactly why
arm 1's first kill awarded 0 and every later one awarded 42 — the probe's spawn-then-kill-in-one-
`evaluate()` shape would have under-read even with the right key. Rule 8's "let the world run",
one more time.

**In fairness to the builder:** W1-SOULS wired the award path in `dcf1d36` at 16:41 on 7 Aug, and
W1-ATTR-SCALE landed at 16:12. The claim may well have been true when it was written. That is not
a defence of the instrument — trial C could not have told the difference then either, and the
builder's own `next_step` sent a critic to re-run it expecting a pass.

## Finding 3 — the bands are a claim about a file that is not in the commit

`reports/faction-signature-sweep.json` is **gitignored** (`reports/.gitignore:3`). Every ceiling
the auditor enforces is read from it at run time. So:

- the numbers cannot be reproduced from any commit;
- a fresh clone gets `exit 2` (which the tool does honestly and loudly — credit where due, I moved
  the file aside and confirmed it);
- and the file moved. W1-SOULS regenerated it 29 minutes after this piece landed, adding
  `bought_points: 2` to every `reachable_ceiling`. Personality went `18/22/31` → `20/24/33`.

Consequence, measured: **the headline "28 defects → 0" does not reproduce.** My independent revert
of the same 42 resolutions gives **23 → 0**, because five of the 28 (the rank-7 rungs at 22) are no
longer defects under the sweep now on disk. Rule 12 — a measurement is a claim about a commit — is
not satisfiable for this piece as built.

## Finding 4 — the reserve is now nominal

The auditor's entire argument is its `RESERVE = 2`, *"one more than the margin that failed"* in
W1-19 round 1, where nine gates clamped to exactly the ceiling shut Act IV for 11 of 40 signatures.
Both caps are `reachable_ceiling − 2`, and `reachable_ceiling` now includes the bought stream. So
against the ceiling reachable **without** spending level points on that attribute, the margin is:

| attribute | hard cap enforced | ceiling without the bought stream | margin |
|---|---:|---:|---:|
| personality | 22 | 22 | **0** |
| willpower | 23 | 23 | **0** |
| intellect | 23 | 23 | **0** |
| strength | 28 | 28 | **0** |
| … all ten | | | **0** |

Injection sweep on `Q-BLAK-01 res_hold` (the resolution this piece fixed): personality **22 passes
as `dedicated`, defect false**. A character reaches 22 only by maxing both governing skills *and*
spending both of the world's two purchasable level points on personality. That is a margin of zero
by any other build — the shape of the bug the tool exists to prevent, now inside the tool's own
green band. Nothing in the shipped tree sits there today (the highest rung is 20); the guard is
what is gone, not the data.

This is nobody's individual fault and that is the point: it is a **seam regression** between two
pieces that were each locally correct, invisible because the shared artifact is untracked.

## Finding 5 — `A3 (after)` cannot fail

```js
H.setSkills({ 'root-speech': 100 });   // A.at_real_key_100
H.setSkills({ root_speech: 100 });     // A.at_misspelt_key_100  — root-speech is STILL 100
```

`setSkills` merges. So at the moment A3 reads the gate, the correctly-spelt skill is still at 100
and the floor is satisfied either way. Both disjuncts of the `--after` predicate —
`!why.some(/root-speech/)` and `why === at_real_key_100.why` — hold unconditionally on fixed data,
whatever the engine does with `root_speech`. The claim A3 asserts is true; A3 is not the thing that
established it. Reset `root-speech` to 5 before poking the misspelt key and it becomes a real check.

## Finding 6 — the non-violent headline is scoped narrower than it is labelled

`audit()`'s per-resolution `reachable` predicate looks at **attribute and skill demands only**.
`knowledge`, `requires_knowing`, `disposition`, `items`, `gold` and `faction_rank` are collected
into `NON_STAT_REQUIREMENT_KEYS` for the vacuity test and never consulted for reachability. The
tool then prints:

```
quests with a non-violent resolution REACHABLE  124/124 = 100.0%  MEETS the 45% bar
```

against ARBITRATION's non-combat bar. But the builder's own probe output, on the very resolution it
cites, reads `you do not know rev_destinations | you do not know rev_meno` — a resolution counted
"reachable" that the engine refuses. And W1-19-r2's critic measured that **0 of 35** quests behind
that round's headline had a giver standing anywhere in the world. "No out-of-scale stat demand" is
a useful number; it is not the non-combat bar, and it should not be printed as meeting it.

The builder is right that the resolution-level rate is the sensitive one and right to say so in
capitals. The remaining error is the label, not the choice of denominator.

## Finding 7 — the seam attack comes back clean, and the mirror failure is the live one

The brief's specific charge was that a piece which made attributes a damage multiplier has failed
the Morrowind half. This piece does the opposite, and the consumers are real and nameable:

| consumer | path |
|---|---|
| resolution gates **and** the derived faction rank ladder | `game/src/sim/quest/machine.js:231` |
| persuasion ratings (Personality, Luck) | `game/src/engine.js:2984` `_talkPersuader()` |
| buy/sell price multiplier | `game/src/character/reaction.js:83–90`, fed at `:116` |
| disease attribute drain | `game/src/sim/hazards.js:297` |
| restore / fortify attribute | `game/src/sim/magic/apply.js:199–226` |

And perturbation moves the world: personality 10 → 31 changes `Q-BLAK-01 res_hold`'s refusal string;
`root-speech` 5 → 100 clears the floor after the rename and did not before. That is a genuine
CONSUMPTION pass on the axis the brief flagged. (The observable is a gate's `why` rather than an
NPC visibly behaving differently — acceptable here, since the gate is what the dialogue surface
reads, but it is the weaker of the two forms.)

**The mirror failure is the one that is true**, and it is already filed:
`corpus/20-progression/GAP-W1-skill-and-attribute-scaling-never-reaches-damage.md`. Attributes reach
persuasion, prices, quests, ranks and disease — and reach **nothing inside the fight**.
`effectiveGrade()` and `scalingBonus()` are implemented correctly in
`game/src/character/derive.js` and called from exactly one place: their own definitions. Under the
Arbitration Rule that is the *Souls* half unbuilt, not the Morrowind one. Not this piece's job, and
not counted against it; recorded so nobody reads this verdict as saying the seam is healthy.

## Finding 8 — the wiring fires, and it is a warning

Reinjecting `personality 45` and `scribing 35` into `Q-BLAK-01`: `check-quests` prints both with
their bands and measured ceilings, prints the non-violent consequence, and **exits 0**. Correct
under rule 13 — no fail-closed assertion landed ahead of its data — but it means the next author to
type `personality 40` is warned and not stopped. Worth an eventual promotion once the sweep is
tracked.

---

## Scoring — min over axes, no averaging

| Axis | Score | Why |
|---|---:|---|
| **A. The defect class was found and fixed** | **8** | 42 resolutions; independent revert reproduces 0 → 23 defects, 0 → 1 inversion, 370 → 347 reachable. Wider than the brief (11 dead keys, not 2). |
| **B. The classifier is honest in both directions** | **7** | The `skill: 0` ruling is right and has a self-test on each side of the line; bands recomputed at run time; `exit 2` with no sweep. |
| **C. The instrument can go red** | **6** | Auditor self-test 21/21, and mutation testing found a hole the author then closed. But A3-after cannot fail, and the mutations never touched trial C. |
| **D. CONSUMPTION (`RI-MTH07` / ARBITRATION §3)** | **3** | Trials A and B are sound and genuinely coupled. Trial C measured nothing, is not flipped by `--after`, and is the one every band depends on. |
| **E. Reproducibility of the published numbers** | **3** | "28 defects → 0" re-measures as 23 → 0. The load-bearing input is gitignored. |
| **F. The stated root cause** | **0** | *"The bought attribute stream is dead / unfundable"* is false on HEAD: 10 kills, 378 souls, red control clean. Fail-closed. |
| **G. Non-violent floor as reported** | **5** | Right denominator, right warning about the insensitive one; wrong label — "MEETS the 45% bar" from a stat-only predicate. |
| **H. Morrowind-side world coupling** | **8** | Five named out-of-combat consumers, perturbation moves the gate. The seam attack fails to land. |

**min = 0 (axis F).** I am not scoring the piece 0. Axis F is a *claim*, not a subsystem, and the
subsystem it justifies survives its own delete-the-fix. Per this project's own precedent for a
correct fix with a wrong warrant, the overall is set at **3.0** — the min over the axes that
describe the shipped artefact (D and E at 3), with F recorded as fail-closed and named as the
biggest gap. A future round that re-derives the bands with a live souls economy can move D, E and F
together; nothing else needs redoing.

**Gate: 7.0. FAIL.**

---

## Biggest gap — exactly one

**`GAP-W1-attr-scale-ceilings-rest-on-an-unmeasured-souls-economy`**

The 42 rescaled demands were fitted to a ceiling of *creation + earned only*, on the premise that
souls are never awarded. Souls are awarded — 42 per infantry body, measured on HEAD with a red
control — so the real ceiling is higher and rises further as the world is populated (9 hand-placed
enemies today against RI-PRG06 §7's planning figure of ~1,230). Every social gate in three faction
lines is therefore calibrated against a number nobody has measured in the running world, and the
tool that is supposed to notice when that number moves reads it from a file no commit contains.

**Player-facing consequence:** either the rank-8 social endings become free the moment the enemy
roster lands, or they stay unreachable — and nothing in the build can currently tell which.

**Remedy, buildable:**

1. Make `reports/faction-signature-sweep.json` a tracked artifact (drop the ignore, or move it to
   `game/data/progression/`), so a ceiling is a claim about a commit.
2. Replace the sweep's `bought_points` derivation — currently a JSON census of
   `game/data/combat/enemies` × `encounters.json` — with a **measured** figure from
   `tools/quests/critic-attr-scale-souls.mjs`'s arm 2: kill N bodies in the running world, read
   `soulsHeld`, run it through `levels.json`. Rule 11's mirror: a data census cannot prove a read
   *live* any more than it can prove one dead.
3. Fix trial C: `eid` not `id`, filter `kind === 'enemy'`, step before killing, and make the
   predicate fail on a thrown kill rather than pass on one. Then flip it under `--after` like the
   other seven.
4. Re-run `attr-scale-audit --sheet p10` against the corrected sweep and rescale whatever the bands
   then say — in **both** directions; the tool already reports `vacuous`.

**Acceptance:** `tools/quests/critic-attr-scale-souls.mjs` exits 0 (claim holds) *or* the sweep's
`bought_points` equals the measured award divided through `levels.json` to within one point; and
`critic-attr-scale-dtf.mjs` reports a non-zero `margin_at_hard_cap` for every attribute.

---

## Secondary observations, kept so nothing is lost

- `attr-scale-audit` prints `124 quests, 177 resolutions`. 177 is the count of resolutions carrying
  **at least one stat demand** (`byResolution.size`), not the resolution count — the same report's
  non-violent block counts 370. Mislabel, not a defect.
- The consumption probe hard-codes `personality: 31` as "reachable_ceiling.from_max, the best of 240
  sheets". The sweep now says 33. A written-down ceiling inside the probe, which is precisely what
  the auditor's design forbids in itself.
- `B3` before/after are the same assertion with different prose and pass in both arms; harmless, but
  it inflates 8/8 to look like eight independent flips when six of them flip.
- The builder's honesty is above the bar this project normally sees and should be said plainly: it
  named the 14 ladder edits as *not* defects rather than banking 42 defect fixes, it caught and
  reported its own self-test hole through mutation testing, and it recorded the contention with the
  three faction files it was editing under. None of that is why this verdict fails; it fails on one
  probe that could not fail.
