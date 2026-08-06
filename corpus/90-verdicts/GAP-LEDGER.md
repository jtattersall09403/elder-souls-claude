# GAP LEDGER

> **GENERATED FILE — DO NOT HAND-EDIT.** Regenerate with `node tools/gap-ledger.mjs`.
> Canonical data: `corpus/90-verdicts/GAP-LEDGER.json`. Source: every verdict's
> `biggest_gap` (opens) and `gap_closure[]` (closes). Rules: `SCORING.md` §5.

Generated: 2026-08-06T18:17:48Z · verdicts read: 3 · waves: 1

**The three rules that matter**
1. Every verdict opens exactly one gap. A verdict with no gap is void.
2. A gap is closed only by a **later wave's critic**, re-measuring the gap's own
   `acceptance` condition — **never** by the agent that built the fix.
3. Every open gap on a subsystem path is handed to that path's next builder **up
   front**, as required work (`BUILDER-PROMPT-TEMPLATE.md`).

| total | open | partially-closed | closed | superseded | invalid |
|---:|---:|---:|---:|---:|---:|
| 3 | 3 | 0 | 0 | 0 | 0 |

## Open gaps — required work for the next wave

| Gap | Subsystem path | Sev | Age (waves) | Opened | What | Remedy → acceptance |
|---|---|---|---:|---|---|---|
| `GAP-W1-platform-prng-never-drawn` | `platform.determinism.harness` | blocking | 0 | w1 / w1-00 | The seeded PRNG is reseeded correctly and never drawn from. rng.draws is 0 on every one of 3600 frames in every scenario, state and seed measured. Seeds 1337 and 4242 over a 3600-frame duel differ in exactly one field — .rng.seed, the echo of the input — and in zero simulation fields (r4-seed-sensitivity.txt: 'frames differing in ANY field other than .rng.seed: 0'). RI-MTH02 R4's 5%-of-frames clause is therefore satisfied at 100% by that echo alone, so the rung, tools/harness/determinism.mjs, and any future critic reading either will report seed sensitivity on a build that has none. The build's own ladder prints 'PASS R4 — seed-sensitive ... frames_differing_pct: 100'. | (1) Route at least one simulation quantity through rng.next() inside the fixed step and emit the draw count truthfully — the enemy idle-loop phase offset chosen at spawn is sufficient, cheap, and is exactly the field AM-W1-00-01 wants excluded from R5, so seeding it converts that argument into a measurement. (2) Change tools/harness/determinism.mjs's R4 computation to drop the rng.seed field before counting differing frames, and to fail the rung with reason 'prng_never_drawn' when max(rng.draws) == 0 in either run. (3) Adopt orchestration/amendments/AM-W1-00-C1-mth02-r4-discriminator.md, which states the sharpened rung and moves no threshold. → **Re-run node tools/harness/trace.mjs --scenario cmb-duel-infantry at seeds 1337 and 4242 and diff field-by-field: max(rng.draws) > 0 in both runs, and >= 5% of frames differ in at least one field OTHER than .rng.seed. The second number is currently 0.0% (0 of 3600 frames) and is recorded in r4-seed-sensitivity.txt.** |
| `GAP-W1-platform-save-drops-entity-prev-state` | `platform.save.persistence` | blocking | 0 | w1 / w1-00-r2 | The save does not carry enemies[].prev_state. RI-JRN05 M5 run as written — identical 120-frame pre-roll on both sides, identical 600-frame script, seed 4711, control vs loaded — gives control body_sha256 5d0830f9b9e3ea71… and loaded d52edb76370c7c08…, differing on 219 of 600 frames in exactly that field: control "IDLE", loaded null, from frame 0 onward. The serialised entity record carries state, anim_frame, anim_phase0 and state_entered_ago_frames and stops there. world.entities is a durable path in game/data/save-manifest.json and prev_state is on no volatile list, so manifest rule V1 makes it a defect by the manifest's own terms. The same probe against round-1 commit 8714e38 reproduces it exactly, so it is pre-existing and was missed by both the build and the previous verdict, which recorded M5 as passing. | Serialise prev_state in the entity record next to state and state_entered_ago_frames and restore it in the load path; add prev_state to the World group field list in game/data/save-manifest.json so RI-JRN05 M4's two-directional set-difference covers it; and extend the R9 rung and RI-JRN05 M5 to compare the full field set of the control and loaded traces rather than only body_sha256 of a window, printing the differing field names — round 1's M5 run passed precisely because it did not. → **Re-run RI-JRN05 M5 (or corpus/90-verdicts/wave1/artifacts/W1-00-r2/p10-m5.mjs) at seed 4711 and at one other seed: the control and loaded traces must have identical body_sha256 after re-basing the absolute frame indices, and the field-level diff must be EMPTY. Today it is {"enemies[].prev_state": 219} of 600 frames.** |
| `GAP-W1-world-trunk-road-below-the-waterline` | `world.terrain.form` | blocking | 0 | w1 / W1-01 | The trunk road network is routed along the floors of water bodies. Sampling getWaterAt() at every point of all ten built legs at tide LOW: 1,364 m of road (5.4%) is above knee depth and 574 m (2.3%) is above chest depth, concentrated on the Stormhold-Helstrom leg, which carries 538 m over-knee and 502 m over-chest and reaches a maximum depth of 65.64 m at (2182.52, 2214.63) - ground at 69.66 m under a water surface at 135.30 m. That leg is the first of THE CROSSING, so 502 m of the canonical 6,788 m walk - 7.4%, about 4.2 minutes of the hour - is walked along a lake bed. The player traverses it at 2.0000 m/s in state WALK at full HP and full stamina, with no swim, no wade band, no breath clock and no drowning; a screenshot from that point is a uniformly black-green frame of water volume. Nothing in the instrument suite asks the question: scale-audit.mjs has a TIDEWAY-INVERSION check that measures water depth on exactly one of the ten legs and none on the other nine. | Add water depth to the trunk-routing cost in tools/world/build-roads.mjs: make any cell whose water depth exceeds 0.60 m (band W2) impassable to A*, except on the leg RI-WLD01 §4 declares 'tideway', and re-run the build chain build-terrain -> build-water-hazards -> build-roads. Where a leg genuinely must cross a channel, emit a bridge or causeway deck into game/data/world/roads.json as a raised polyline carrying its own surface height, so the road is over the water rather than under it. Then add the check that does not exist to tools/world/scale-audit.mjs as M2-ROAD-ABOVE-WATER, covering all ten legs at all four tide phases rather than one leg at one phase. → **tools/world/scale-audit.mjs reports 0 m of trunk road above band W2 on every leg except lilmoth-archon, at all four tide phases (RISING, HIGH, FALLING, LOW); lilmoth-archon keeps its declared inversion at <=0.85 m deep at LOW and >=1.40 m at HIGH; and tools/world/crossing.mjs re-measures the crossing on the re-routed network inside 52-65 min and 6,300-7,600 m with mean ground speed still 2.00 +/-0.05 m/s.** |

## Open gaps grouped by subsystem path (the builder hand-off)

- `platform.determinism.harness` — `GAP-W1-platform-prng-never-drawn`
- `platform.save.persistence` — `GAP-W1-platform-save-drops-entity-prev-state`
- `world.terrain.form` — `GAP-W1-world-trunk-road-below-the-waterline`

## Closed and superseded

_None yet._

## Warnings

- corpus/90-verdicts/wave1/W1-00-r2.json: closure of GAP-W1-platform-prng-never-drawn is in the same wave (1) that opened it. Closure must come from a later wave's critic. Ignored.
