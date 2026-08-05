# Verdict Schema — the machine-readable output every critic emits

**Schema file:** `corpus/00-doctrine/verdict.schema.json` (JSON Schema draft 2020-12).
**Emit to:** `corpus/90-verdicts/<wave>/<piece_id>.json` (e.g. `corpus/90-verdicts/w2/combat-dodge-core.json`).
**Artifacts to:** `corpus/90-verdicts/<wave>/artifacts/<piece_id>/…`
**Validate with:** `node tools/verdict-validate.mjs corpus/90-verdicts/w2/combat-dodge-core.json`
**Worked example:** `corpus/00-doctrine/examples/verdict.example.json`

A verdict is a **record of measurements**, not an essay. Prose lives in `notes` and in the
gap's `what` / `why_it_matters`. Everything a later agent needs to aggregate is a typed
field, because a project-wide progress page will consume every verdict in
`corpus/90-verdicts/**` and must never have to parse English.

---

## 1. Why the shape is what it is

Three consumers:

1. **The next builder** reads `biggest_gap` and nothing else is required of it.
2. **The next critic** reads `gap_closure`, `reference_items[].checks`, and the artifacts,
   to re-measure.
3. **The aggregator / progress page** reads the flat status fields across all verdicts and
   never opens an artifact.

So every judgement appears **twice**: once as a human sentence, once as an enum or number.
If you find yourself writing a fact only in prose, there is a field for it — use it.

---

## 2. Field reference (grouped)

### Identity and provenance of the run
| Field | Type | Notes |
|---|---|---|
| `schema_version` | `1` | Bump only by amending the schema file. |
| `piece_id` | slug | Stable across waves for the same piece. This is the aggregation key together with `wave`. |
| `piece_title` | string | Human label. |
| `subsystem_paths[]` | canonical paths | **Must exist in `corpus/00-doctrine/subsystems.json`.** The join key to INDEX.md and to the gap ledger. |
| `wave` | int | The time axis. |
| `critic.run_id` | string | Unique per invocation. |
| `critic.role` | string | e.g. `critic.combat`, from `subsystems.json`. |
| `critic.conflict_of_interest` | bool | `true` ⇒ `status` must be `RECUSED` (schema-enforced). |
| `critic.saw_builder_notes_before_blind` | bool | Honesty flag; `true` downgrades the verdict to `PROVISIONAL`. |
| `build.commit_sha` | string | What was judged. Without it the verdict is unreproducible. |
| `build.harness_commands[]` | objects | Exact commands, seeds, exit codes. |

### The bar and the measurement
| Field | Notes |
|---|---|
| `bifurcation` | **Declared before any visual citation.** `axis` ∈ fidelity / art-direction / both-separately / not-visual. Citing across the line voids the verdict (ARBITRATION §4). |
| `reference_items[]` | One entry per **assigned** item. Omitting an assigned item is a VOID condition. |
| `reference_items[].native_scale` / `native_score` / `native_max` / `native_verdict` | The item's **own** scale, quoted from its `## Scoring` section. This is how per-item scales survive aggregation instead of being flattened away. |
| `reference_items[].score_0_10` | The shared ladder value (`SCORING.md`). `justification` is **required** at ≥ 7 and must name an artifact; unjustified ≥ 7 is clamped to 6 by the aggregator. |
| `reference_items[].measured` | `full` / `partial` / `unmeasurable`. `unmeasurable` ⇒ `score_0_10` must be `0` (fail-closed, never "unknown"). |
| `reference_items[].checks[]` | Per-check (M1, M2, …) result, value, threshold, `hard_fail`, evidence. This is the layer that makes verdicts diffable across waves. |
| `reference_items[].hard_fails[]` | Any entry forces `status: FAIL` regardless of score. |
| `reference_items[].how_we_lose_hits[]` | Which predicted failure modes from the item's `## How we lose` actually happened. Cheap to fill, extremely informative in aggregate. |
| `reference_items[].provenance_correction` | Set when the item mislabels provenance (CORPUS-CONTRACT §3 requires failing the item and filing a correction). |

### Evidence
| Field | Notes |
|---|---|
| `artifacts[]` | Every cited file: `path`, `kind`, `produced_by` (the exact command), plus `seed`, `resolution`, `camera_pose`, `duration_s`, `source`. **Empty ⇒ VOID.** Visual artifacts without `camera_pose` are anecdotes and are rejected by the validator. |
| `source_reads[]` | Every source file opened, each tagged with one of the three permitted purposes (CRITIC-DOCTRINE §1.1). Any other purpose voids the verdict. Leaving this empty when you did read source is a self-audit failure. |

### Blind comparison
| Field | Notes |
|---|---|
| `blind_comparisons[]` | One per item with `blind_pair: yes`. Contains the `question` written **before** looking, `pack_artifacts`, `assignment_seed`, `blind_pick` (A/B), `blind_rationale`, `reveal`, and derived `picked` (ours/reference). |
| `blind_comparisons[].rerun_triggered` | **Must be `true` when `picked == "ours"`** (CRITIC-DOCTRINE §2.5). The validator flags `blind_pick_ours_not_rerun`. |
| `blind_comparisons[].rerun` | The harsher-lens pass: what was sharpened, the extra discriminator, artifacts, `result`, and — if ours still won — `item_capped_at_8` plus the `extension_filed` RI id. |

### Arbitration
| Field | Notes |
|---|---|
| `arbitration.ar1` / `.ar2` | Mandatory on **every** piece. `status` ∈ pass / fail / not_applicable, with per-probe `checks[]` using the ids from CRITIC-DOCTRINE §4.1 (`A1`–`A10`) and §4.2 (`B1`–`B11`). `fail` ⇒ piece fails regardless of score. `not_applicable` needs a reason and is audited. |

### Outcome
| Field | Notes |
|---|---|
| `score.overall_0_10`, `score.pass_threshold`, `score.aggregation`, `score.weights`, `score.band_label`, `score.confidence` | Use `aggregation: "min"` when the items are gates rather than dimensions. |
| `status` | `PASS` / `FAIL` / `VOID` / `PROVISIONAL` / `RECUSED`. |
| `status_reasons[]` | Machine-readable codes: `ar1_fail`, `ar2_fail`, `hard_fail:RI-AI01/M7`, `no_artifacts`, `blind_pick_ours_not_rerun`, `unjustified_high_score`, `bifurcation_violation`, `below_threshold`, `missing_assigned_item:RI-…`. Aggregators group on these. |
| `biggest_gap` | **Exactly one.** `gap_id`, `subsystem_path`, `what`, `why_it_matters`, `evidence[]`, `severity`, and `remedy { action, targets[], acceptance, ref_item, estimated_size }`. Absent ⇒ VOID. |
| `secondary_observations[]` | Explicitly **not** work for the next builder. |
| `gap_closure[]` | Re-measurement of earlier gaps: `gap_id`, `status`, `evidence`, `measured_value`, `closed_by_builder_of_fix` (if `true`, the closure is invalid). |
| `corpus_extended[]` | New/corrected reference items with `reason` ∈ corpus_hole / method_gap / harness_gap / sharper_discriminator / provenance_correction, and `index_regenerated`. |
| `method_deviations[]`, `arbitration_questions[]` | Honesty channels. Never silently deviate; never invent a ruling. |
| `self_audit` | Seven booleans + a required note if any is `false`. |

---

## 3. PASS / FAIL / VOID decision procedure

Evaluate in this order and stop at the first hit.

```
1. critic.conflict_of_interest == true                          -> RECUSED
2. artifacts empty
   OR any cited evidence path missing
   OR biggest_gap absent
   OR bifurcation violated (cross-axis citation)
   OR a score depends on source with no output artifact          -> VOID
3. any reference_items[].hard_fails non-empty
   OR arbitration.ar1.status == "fail"
   OR arbitration.ar2.status == "fail"                           -> FAIL
4. any assigned reference item missing from reference_items[]
   OR blind picked "ours" without rerun_triggered
   OR self_audit has a false without a note
   OR critic.saw_builder_notes_before_blind == true              -> PROVISIONAL
5. score.overall_0_10 < score.pass_threshold                     -> FAIL
6. otherwise                                                     -> PASS
```

`PASS` never means finished. A PASS **always** carries a named gap.

---

## 4. Aggregation contract (what the progress page may rely on)

An aggregator globs `corpus/90-verdicts/*/*.json`, drops anything whose `schema_version`
it does not know, and may rely on:

- **Coverage**: `subsystem_paths[]` ∪ over all verdicts, joined against
  `corpus/00-doctrine/subsystems.json` → judged vs unjudged subsystems.
- **Trend**: `(wave, piece_id) → score.overall_0_10` and per-item
  `(wave, piece_id, ref_item) → score_0_10`, both monotonic keys, safe to chart.
- **Health**: counts of `status`, and `status_reasons[]` histogram.
- **Blind honesty**: fraction of `blind_comparisons[].picked == "reference"` project-wide.
  A project where we "win" blind often is a project with soft critics — surface it.
- **Gap flow**: `biggest_gap` (opened) vs `gap_closure[]` (closed) per subsystem path,
  which is exactly what `tools/gap-ledger.mjs` computes into `GAP-LEDGER.json`/`.md`.
- **Corpus growth**: `corpus_extended[]` per wave.
- **Regression detection**: any `reference_items[].checks[].result` moving
  `pass → fail` between waves on the same `(piece_id, ref_item, check id)`.

Rules for the aggregator, so verdicts and page never disagree:
- Clamp `score_0_10 ≥ 7` with no `justification` to `6`, and emit
  `unjustified_high_score`.
- Ignore `gap_closure[]` entries with `closed_by_builder_of_fix: true`.
- Treat `PROVISIONAL` as **not judged** for coverage purposes.
- Never average across subsystem paths to produce a single "project score" without also
  showing the **minimum** — a project is as good as its worst judged subsystem.

---

## 5. Worked example

See `corpus/00-doctrine/examples/verdict.example.json` for a complete, schema-valid
verdict (a FAIL on `combat.dodge.iframes` with an AR-1 pass, one blind comparison the
reference won, and one buildable gap — it validates clean with
`node tools/verdict-validate.mjs corpus/00-doctrine/examples/verdict.example.json`). Abridged:

```jsonc
{
  "schema_version": 1,
  "piece_id": "combat-dodge-core",
  "subsystem_paths": ["combat.dodge.iframes", "combat.dodge.recovery"],
  "wave": 1,
  "critic": { "run_id": "crit-w1-dodge-3f9a", "role": "critic.combat",
              "started_at": "2026-08-05T09:00:00Z", "finished_at": "2026-08-05T10:12:00Z",
              "conflict_of_interest": false },
  "bifurcation": { "axis": "not-visual", "declared_before_citation": true },
  "reference_items": [{
    "id": "RI-CMB01", "path": "corpus/10-combat/RI-CMB01-roll-iframes-equip-load.md",
    "side": "souls", "kind": "number",
    "native_scale": "0-100 weighted (M1..M5); >=90 parity, 70-89 gap named, <70 we lose",
    "native_score": 35, "native_max": 100, "native_verdict": "we lose",
    "score_0_10": 3, "measured": "full",
    "checks": [{ "id": "M2", "result": "fail", "value": 7,
                 "threshold": "13 frames, boundaries exact",
                 "hard_fail": false,
                 "evidence": ["corpus/90-verdicts/w1/artifacts/combat-dodge-core/roll-iframe-sweep.json"] }],
    "hard_fails": [],
    "how_we_lose_hits": ["i-frames tied to animation length rather than an explicit window"],
    "evidence": ["corpus/90-verdicts/w1/artifacts/combat-dodge-core/roll-iframe-sweep.json"]
  }],
  "artifacts": [{ "path": "corpus/90-verdicts/w1/artifacts/combat-dodge-core/roll-iframe-sweep.json",
                  "kind": "report",
                  "produced_by": "node tools/harness/iframe-sweep.mjs --seed 41 --frames 240",
                  "seed": 41, "source": "ours" }],
  "arbitration": { "ar1": { "status": "pass", "checks": [{ "id": "A1", "result": "pass" }] },
                   "ar2": { "status": "not_applicable",
                            "not_applicable_reason": "no world-facing surface in this piece",
                            "checks": [] } },
  "score": { "overall_0_10": 3, "pass_threshold": 6, "aggregation": "mean",
             "band_label": "Skeleton", "confidence": "high" },
  "status": "FAIL",
  "status_reasons": ["below_threshold"],
  "biggest_gap": {
    "gap_id": "GAP-W1-combat-dodge-iframe-window",
    "subsystem_path": "combat.dodge.iframes",
    "what": "Roll grants 7 invulnerable frames measured across 120 scripted rolls; RI-CMB01 requires 13, opening at frame 4.",
    "why_it_matters": "Players who dodge on the correct read still get hit, so the fight teaches nothing.",
    "evidence": ["corpus/90-verdicts/w1/artifacts/combat-dodge-core/roll-iframe-sweep.json"],
    "severity": "blocking",
    "remedy": {
      "action": "Replace the animation-length-derived invulnerability with an explicit i-frame window opened at roll frame 4 and closed at frame 16, driven by the roll state machine rather than the clip.",
      "targets": ["game/src/combat/dodge.ts", "game/src/combat/state/roll.ts"],
      "acceptance": "iframe-sweep reports 13 invulnerable frames over 120 rolls at light load, first invulnerable frame index 4, and 0 damage events inside the window.",
      "ref_item": "RI-CMB01", "estimated_size": "S"
    }
  },
  "corpus_extended": [],
  "self_audit": { "judged_output_not_source": true, "ran_every_assigned_method": true,
                  "blind_done_where_required": true, "named_exactly_one_gap": true,
                  "remedy_is_buildable": true, "no_banned_reasoning_used": true,
                  "escalation_ladder_used_if_gap_seemed_small": true }
}
```
