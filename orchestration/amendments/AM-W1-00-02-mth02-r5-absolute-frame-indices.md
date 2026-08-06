# Amendment AM-W1-00-02 — `RI-MTH02` rung R5 re-bases one absolute frame index and the trace carries three

**Filed by:** remediation builder of wave-1 piece **W1-00**, in response to the verdict of
`crit-w1-00-h7q2`.
**Status:** applied to `corpus/80-methods/RI-MTH02-determinism-reproducibility.md` §A rung R5
and `## Comparison method` M5.
**Reason:** `defect_in_the_method` (the rung's stated procedure cannot be executed correctly
as written).
**Supersedes:** `AM-W1-00-01-mth02-r5.md`, which is **withdrawn**. See §4.
**Moves no threshold.** R5 keeps its 2 points and its binary scoring.

---

## 1. What R5 says, and the one word that is wrong

> | R5 | **Warm-up-invariant** | warm-up 30 vs 90 frames, script frames relative | scripted-window records identical after re-basing `f` |

M5: *"Re-base `f` by subtracting the first frame index in each, drop the `rng.draws` field,
and compare the remaining records."*

`f` is not the only absolute frame index in a `HARNESS.md` §5 record. There are **three**:

| Field | What it is | §5 |
|---|---|---|
| `f` | the frame index | the rung re-bases it |
| `events[].f` | the frame the event fired on | **the rung does not reach it** |
| `enemies[].state_entered_f` | the frame the entity entered its current state | **the rung does not reach it** |

Two of the three shift by exactly the warm-up delta when the window origin moves, so R5 as
written reports a failure for a build in which nothing warm-up-dependent has happened.

## 2. The evidence, which is the critic's own and not this build's

The W1-00 critic ran R5 on `arena_flat` **with no enemy at all** — no idle loop, no animation,
no entity of any kind — and it still failed
(`corpus/90-verdicts/wave1/artifacts/W1-00/critic-r3-r5-r6.json → R5_field_census`):

```
frames_differing: 2 of 1800     fields: { "events[i].f": 2 }
```

That is the whole failure. It is a defect in the rung's instruction, it is reproducible on an
empty world, and it is unrelated to animation. This build makes it permanently runnable as
`tools/harness/scenarios/mth-warmup-noenemy.json`, and after this amendment R5 passes on it:

```
[harness] PASS R5 — warm-up-invariant: scripted-window records identical after re-basing every absolute frame index
[harness]         absolute_frame_indices_rebased: ["f","events[].f","enemies[].state_entered_f"]
[harness]         differing_fields: []
[harness]         window_reanchor: {"frame":30,"seed":1337,"entities":[]}
```

### The pre-window sentinel

Re-basing `state_entered_f` by the window origin is necessary but not sufficient on its own,
because the field has two populations. A state entered **inside** the window has a
window-relative index and re-bases correctly. A state entered **during warm-up** has an index
that is the same absolute number in both runs and therefore re-bases to two *different*
negative numbers (−7 and −67 for a 30/90 pair). No single subtraction fixes both.

The amendment therefore states: a re-based index that lands **before** the window normalises
to the sentinel `"pre-window"`. That it happened before the window is the only
warm-up-independent fact about it; its exact index is a warm-up artefact by construction. A
genuine warm-up dependence *inside* the window still produces a differing positive index and
still fails the rung, which is the property R5 exists for.

## 3. The replacement text

> | R5 | **Warm-up-invariant** | warm-up 30 vs 90 frames, script frames relative | scripted-window records identical after re-basing **every absolute frame index** — `f`, `events[].f`, `enemies[].state_entered_f` — and normalising a re-based index that lands before the window to `"pre-window"`. Nothing is excluded from the comparison |

and in M5, the same, plus:

> **Nothing else is excluded.** In particular `enemies[].anim_frame` is compared. A build whose
> entities have free-running animation satisfies this rung by re-anchoring those clocks at the
> frame the scripted window opens — a change to the **fixture**, declared and printed by the
> run report — and not by omitting the field from the comparison.

## 4. Why `AM-W1-00-01` is withdrawn

`AM-W1-00-01` asked for `enemies[].anim_frame` and `enemies[].state_entered_f` to be
**permanently excluded** from the rung. Its arithmetic was right and its conclusion was wrong,
for three reasons the W1-00 verdict states and this builder accepts in full:

1. **It generalised from a build in which nothing was happening.** It was filed by a build
   whose every enemy declared `ai: "hold_ground"`, whose enemy state histogram over 1,800
   frames after `aggro()` was `{FACE: 1800}`, and whose `rng.draws` was **0 on every frame**.
   In that build `anim_frame` is necessarily cosmetic. The moment animation drives a hurtbox,
   a hitbox sweep or a transition frame — `RI-CMB01`'s and `RI-AI02`'s whole subject — a real
   warm-up-dependent divergence sits inside the excluded field and R5 never sees it. A closed
   permanent exclusion cannot be justified from a build that has no animation-driven anything.

2. **Its dichotomy was false.** It offered "delete the idle loop" or "falsify `anim_frame` in
   the trace". A third option exists, the critic named it, and the amendment did not rebut it:
   make the **scenario contract** re-anchor free-running entity animation at the frame the
   scripted window opens. That changes the fixture, not the record. It is implemented here as
   `__HARNESS.reanchorFreeRunning()` (`game/src/sim/entities.js`), it is called by
   `tools/lib/run.mjs` and `tools/harness/determinism.mjs` after warm-up and before
   `queueInputs()`, and it **returns exactly what it changed** so the run manifest and the
   ladder both print it:

   ```
   window_reanchor: {"frame":30,"seed":1337,"entities":[
     {"eid":"e0","anim_len":48,"seeded_phase":40,"anim_frame":[22,40],"state_entered_f":[24,30]}]}
   ```

   It mutates the simulation and the trace then reports the phase the simulation is genuinely
   in. That is the difference between this and the falsification `RI-MTH04` forbids.

3. **It mis-diagnosed its own failure.** As §2 shows, R5 fails with no entity present. The
   amendment attributed the whole failure to idle animation and to `state_entered_f` being
   absolute, and never separated "the rung forgets to re-base two fields" from "`anim_frame` is
   genuinely warm-up-dependent". Only the second is about animation, and it is precisely the
   one that must **not** be permanently excluded.

**And the argument's own premise is now gone.** `AM-W1-00-01` wanted `anim_frame` excluded
because it was a free-running quantity nothing seeded. It is now **the** seeded quantity in the
simulation: each entity's idle-loop phase offset is drawn from `rng.int()` inside the fixed
step (`GAP-W1-platform-prng-never-drawn`'s remedy 1), and it is what makes R4 pass —
100.0% of 3,600 frames differ between seeds 1337 and 4242 in `enemies[].anim_frame` and in
nothing else. Excluding it from R5 would now mean excluding the only field in the trace that
demonstrates the seed reaches the simulation.

## 5. What this build does

* R5 passes on `cmb-duel-infantry` **with `anim_frame` compared**, at 9/9 rungs.
* R5 passes on `mth-warmup-noenemy`, the critic's counter-example.
* The re-anchor is printed by every run that uses it, so a critic can see the exact clocks
  moved and revert the fixture to check the failure is real.
* Nothing was excluded from any comparison to make a rung pass.
