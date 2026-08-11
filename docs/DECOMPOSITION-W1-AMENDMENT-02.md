# DECOMPOSITION-W1-AMENDMENT-02 — whole-game visual quality moves into Wave 1

**Owner direction:** 2026-08-11.  
**Governing text:** `docs/PLAN.md` (wide before deep),
`corpus/00-doctrine/ARBITRATION.md` §4 (fidelity/art-direction bifurcation),
`corpus/00-doctrine/SCORING.md` §0 (Wave-1 gate 7.0),
`orchestration/PLAN-LOOP.md`, and
`orchestration/plans/BUILDER-EXECUTION-CONTRACT.md`.  
**Applied to:** `docs/PLAN.md` §1, §3, §4, §5, §6;
`corpus/00-doctrine/subsystems.json`; and the Wave-1 dispatch sequence.

## 1. Owner ruling

Visual quality is a Wave-1 feasibility question. Before the project spends on Wave-2 depth, the
whole existing game must have a credible, coherent visual presentation at the Wave-1 **7/10** bar
against the applicable reference axes. Wave 1 must also leave a reusable visual production
foundation that makes later characters, creatures, architecture, flora, materials, effects and
world content enter through the same high-quality paths.

This adds **W1-30 — Whole-game visual foundation and fidelity**. It moves the 21 previously deferred
`render.*` paths from Wave 4 to Wave 1 and assigns them to that piece. W1-30 improves the existing
game across the full applicable visual breadth and establishes shared render, material, asset and
validation conventions for future work. The satisfied plan loop determines the cheapest exact
implementation that reaches the existing bars; this amendment does not preselect an engine rewrite
or asset-production technique.

Wave 4 remains the later visual-debt closure and 10/10 consolidation pass. Its work deepens the
Wave-1 visual foundation and closes remaining visual ledger entries; it introduces no new
`render.*` path.

## 2. W1-30 ownership

**Modern-fidelity paths (12):**

`render.fidelity.lighting`, `render.fidelity.shadows`, `render.fidelity.materials`,
`render.fidelity.atmosphere`, `render.fidelity.vegetation`, `render.fidelity.animation`,
`render.fidelity.postprocess`, `render.fidelity.streaming`, `render.fidelity.ao`,
`render.fidelity.ibl`, `render.fidelity.sky`, `render.fidelity.vfx`.

**Art-direction paths (9):**

`render.art.palette`, `render.art.silhouette`, `render.art.architecture`, `render.art.creature`,
`render.art.composition`, `render.art.weirdness`, `render.art.mood`, `render.art.flora`,
`render.art.materials`.

**Judged by (13, derived from current canonical `judges:` metadata):** RI-CAM07, RI-MAG05,
RI-VIS01, RI-VIS02, RI-VIS03, RI-VIS04, RI-VIS05, RI-VIS06, RI-VIS07, RI-VIS08, RI-VIS09,
RI-WLD03, RI-WLD05.

The two existing modern-fidelity paths stay with their current owners:
`render.fidelity.character` stays in W1-06 and `render.fidelity.water` stays in W1-03. The two
visual-process paths stay in W1-24. W1-30 must consume and integrate those results while keeping
ownership and scoring seams explicit.

## 3. Plan and build order

The W1-30 **plan loop starts immediately** and may run in parallel with current production builders:

```
initial plan → fresh reviewer-editor → fresh reviewer-editor → … → satisfied
```

Every plan version is governed by the builder/critic allocation in `PLAN-LOOP.md` and
`BUILDER-EXECUTION-CONTRACT.md`. The initial draft must include the binding piece-specific
allocation. Builder work includes production implementation and bounded representative live proof.
The fresh build critic owns full capture populations, repeated/fresh/blind comparisons, long runs,
final aggregation, hard fails, score and verdict.

The W1-30 builder is dispatched after both of these production dependencies land:

1. **W1-06** — stable camera and character-presentation path.
2. **W1-24** — the visual bifurcation and repeatable-measurement protocols.

W1-30 then lands **before W1-28**, so the final first-hour integration consumes the whole-game visual
foundation. No Wave-2 builder is dispatchable before W1-30 has completed the independent build-critic
loop at the Wave-1 gate.

## 4. Wave-1 visual gate

W1-30 is plan-satisfied only through the existing repeated fresh reviewer-editor loop. Its build is
satisfied only through the existing builder/fresh-critic loop. The Wave-1 visual exit requires:

- the existing applicable native visual predicates, populations, units and hard fails remain intact;
- the applicable modern-fidelity and art-direction results both reach the Wave-1 ladder floor of
  **7.0**, with the axes judged separately under the bifurcation protocol;
- every existing visual surface claimed by W1-30 is covered by the plan's explicit population, and
  the shared production foundation has a fail-closed check for future visual content using it;
- any score below 10 remains a named debt with `why_not_ten`, `path_to_ten` and `ten_by_wave`.

The initial planner must reconcile any current reference-item contradiction, invalid band or missing
legal reference evidence through the existing ruling mechanism. Such a defect may block the affected
score; it does not permit a local substitute bar or an unrecorded scope reduction.

## 5. Taxonomy effect

The taxonomy still has 330 paths. `render.*` changes from **4 Wave-1 / 21 Wave-4** to
**25 Wave-1 / 0 Wave-4**. The Wave-1 total changes from **255 to 276** and Wave 4 from **21 to 0**.
No path is renamed or duplicated.

