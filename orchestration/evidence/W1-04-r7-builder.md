# BUILDER SWEEP COMPLETE — W1-04

## Execution identity and frozen population

- Tested HEAD: `2b7a661a82b5812e16ba3aad960ba3d19b321379`.
- S42 manifest: **8 settlements, 115 interiors, 17 NPC files / 376 NPC records, and 8 property files**. `tools/world/w1-04-r7-freeze.mjs` records every file ID and SHA-256 in `reports/w1-04-r7/freeze.json`; the denominator is not reduced.
- All 20 judges are classified in that artifact. Applicability is row-level: `owned`, `mixed`, or `external`; external means sibling evidence is required, not that a row was silently passed.

## Implementation and instruments

- Added `tools/world/w1-04-r7-freeze.mjs`, a cheap fail-closed population/applicability gate. It freezes the complete manifests, detects records absent from settlement building plans, audits the literal RI-WLD13 §4 data contract, and exits non-zero on either defect.
- Preserved the r5/r6 production implementation. Fresh evidence did not falsify its fixes: the r6 delete-fix has three independent biting arms, and the live settle arm remains 0/0/0/0 inside footprints at frames 1/30/120/600.
- No cross-piece production code or content was absorbed.

## GREEN builder-admissible rows

- Static/integrity: `check-data`, `check-content`, `check-quests`, `check-souls-world`, `check-append-only`, `check-building-fits-room`, boot-check, and the r6 census completed successfully. `check-content` and `check-quests` retain their printed sibling-owned reporting warnings.
- RI-MTH07: current browser run reports **23/23 CONSUMED across all nine owned paths**. Named consumers include fixed-step settlement lookup, the live door/cell renderer, NPC population and schedule stepping, ownership/crime, lock attempts, shop hours/faction trespass, and live post-load state.
- RI-MTH07 control: **9/9 invertible checks GOES-RED**; 14 scenario rows explicitly remain skipped by that control mode rather than being counted as passes.
- Historical r6 control reproduced at current HEAD: cutting only r6 doorstep predicates restores 10 wall-slab placements and re-entry 96/10/9; cutting the lamp clamp restores 74 bad lamps / 179 clearance meshes; cutting prop inset restores 61 overhang meshes.
- Live continuity regression guard: all 115 records were exercised; footprint collision after exit is **0/0/0/0** at frames 1/30/120/600.

## RED rows

- **S42 / M71 orphan hard fail:** only 112 of 115 interiors have a settlement building row. The complete red set is `barge-hold`, `thorn-house-0`, and `writ-house`. This was not waived and not hidden behind the r6 census's zero exit status.
- **RI-WLD13 native data-contract / M71 hard fail:** 115 of 115 shipped interior records lack at least one required literal field from §4 (`exterior_building_id`, `door_world_pos`, `door_world_bearing_deg`, `storeys`, `apertures`, `seamless`, `see_into`, `water_plane_m`). The current `bounds_m` / nested `continuity` schema is not the native contract.
- **RI-WLD13 M72 identity:** the live 115-record re-entry extension is 112 same room / 1 different room / 2 nothing. `thorn-house-0` opens `thorn-gate`; the two Tidewrack records have no settlement document/door table. The native seeded-60 sample cannot be promoted while its frozen population contains these hard failures.
- Accordingly W1-04 acceptance is RED. No denominator was shrunk and no failure was assigned away.

## NOT_RUN and dependency-blocked rows

- RI-WLD13 M73–M76: **NOT_RUN**. The satisfied plan orders browser/capture work after cheap M71, and M71 is red. M73 also requires a capture population; M75/M76 cannot acquire native force until the native fields and settlement joins exist.
- RI-WLD03 blind M13: **NOT_RUN awaiting an independent critic/judge**. This builder did not judge WLD03 and did not issue a blind PASS.
- Other applicable native rows among the remaining 19 items: **NOT_RUN where no current-commit, independently produced, population-complete sibling evidence was found**. Historical verdict scores were not promoted.
- Wholly external rows in RI-LOR01, RI-LOR02, RI-LOR04, and RI-PRG03 are dependency-blocked on qualifying sibling evidence and caused no W1-04 rebuild.

## Plan defect / authoritative conflict

The satisfied continuation plan is materially incomplete at this HEAD. It directs the builder to preserve the r5/r6 derivation and run native M71. RI-WLD13 §4 requires two independently authored sides and says an interior deriving its numbers from the exterior at load time proves nothing; the item's automatic-fail list assigns score 0 to that shape. The preserved r5/r6 implementation explicitly derives door, footprint-dependent bounds, doorstep, lamps, and prop placement in `applyInteriorBounds()` at boot. In addition, no shipped interior implements the literal §4 record contract. Closing that is not a three-orphan seam patch: it requires authoring and consuming independent continuity records across all 115 interiors and replacing the derivation as acceptance evidence. Treating the current derivation as M71 evidence would violate the governing item.

This is reported as a plan defect rather than papering over M71 or manufacturing 115 fields mechanically from the exterior. The reversible evidence is a corpus amendment permitting the nested contract/runtime derivation, or independently authored interior/exterior records for all 115 that satisfy the existing contract.

## Exact critic handoff

A fresh W1-04 build critic should:

1. Check out this commit's successor and run `node tools/world/w1-04-r7-freeze.mjs` first; require 115/115 placed and 115/115 native-contract complete without changing the denominator.
2. Falsify the freeze gate by injecting an orphan and removing one required contract field; both arms must exit non-zero.
3. Re-run `w1-04-consumption.mjs` and its `--self-test`; do not accept scenario SKIPPED rows as red-control passes.
4. Re-run r6 census/delete-fix and live exit/re-entry; require 115 same-room re-entries and 0/0/0/0 collision settles.
5. Resolve the derivation-vs-independent-record conflict before treating M71 as admissible, then run native M72–M76 on S42 populations.
6. Send WLD03 blind material to a fresh judge. Do not infer or self-certify that result from this builder report.

