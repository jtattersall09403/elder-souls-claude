# W1-23 production builder sweep — 2026-08-10

Commit measured before edits: `2b7a661a82b5812e16ba3aad960ba3d19b321379`.

## Applicability census

W1-23 owns the nine paths listed in `docs/PLAN.md`: canon registry, Argonian canon, geography,
history, factions, prophecy, naming conventions, Hist religion, and religious metaphysics. The
following is the fail-closed native-method census. `APPLICABLE` includes mixed predicates; an
exclusion is used only where the native population is wholly owned by a sibling.

| Judge | Native rows | W1-23 classification and current result |
|---|---:|---|
| RI-CHR03 | 9 + CONSUMPTION | Rows 1 and 6 are `APPLICABLE` to religion/cosmology and names; remaining birthsign mechanics are W1-07/W1-16-owned. Current aggregate judgement is `NOT_RUN` (fresh native critic required). |
| RI-LOR01 | 6 | All six are `APPLICABLE`. Registry projection is green; complete claim/provenance judgement is `NOT_RUN`. |
| RI-LOR02 | 7 | All seven are mixed and therefore `APPLICABLE`. Slavery/politics content is present; native settlement/quest sampling is `NOT_RUN` rather than borrowed from W1-04 or future quest builders. |
| RI-LOR03 | 7 | All seven are `APPLICABLE`. Static M1/M4/M5/M6/M7 execute; M2 and M3 are `NOT_RUN` for independent prose judgement. Static gate remains red on missing written dispute sources and one byline mismatch. |
| RI-LOR04 | 8 | All eight are `APPLICABLE`. M1–M5 are green at native band 4 after source-name repairs; M6 is `NOT_RUN` pending a fresh name judge; M7/M8 remain native aggregate obligations. |
| RI-LOR05 | 9 | Rows 1–3, 7–9 are `APPLICABLE`; rows 4–6 have wholly progression/combat/travel populations owned by W1-16 and related siblings. Complete lore judgement is `NOT_RUN`. |
| RI-LOR06 | 8 | All eight are `APPLICABLE`. M1 and the static M4 census are green. M2 has zero acceptable closure because the historical 657-hit population lacks line dispositions; M3/M5/M6/M7 require independent semantic review and are `NOT_RUN`; M8 is red until the canonical prior-wave comparison artifact is stamped. |
| RI-LOR07 | M1–M7 + divergence | All canon/Argonian/geography rows are `APPLICABLE`; live settlement arrangement belongs to W1-04 but cannot be excluded from this mixed predicate. Full native run is `NOT_RUN`. |
| RI-QST06 | 7 architecture methods | Prophecy and main-quest substrate rows are mixed and therefore `APPLICABLE`; implementation belongs to later narrative quest builders. Current native mainline judgement is `NOT_RUN`, not green. |
| RI-MTH07 | 5 | Registry and naming/library harness models are `APPLICABLE`. Registry coupling is green (199 references, 46/46 line ablations, 407-line null); exhaustive library sweep remains red because 158/163 books change no entity/quest observable in the existing r3 model. |

Deleting a judge row or declaring a mixed lore row inapplicable would make this census incomplete;
the critic handoff must treat either event as an L10 failure.

## Production repairs

* Corrected two stale registry voice references to the dialogue actors that actually own the
  authored positions. `canon-census` and `canon-consumption` now resolve all 199 sources.
* Added the RI-LOR06-required shipped book manifest and taught the authoritative book-stat tool to
  distinguish that index from actual readable records.
* Repaired the eight current unclassifiable source names, plus two current phonotactic failures,
  without checker exceptions. The official validator moved from native band 0 to band 4:
  unknown 8/344 to 0/344, violations 20/344 to 9/344, apostrophes 0, and duplicate Argonian names 0.
* Added `Archein` to the established title-prefix authority rather than exempting the roster entry.

## Green executable rows

* Canon projection is current: 84 facts, 28 disputes, 69 positions, 139 voiced sources.
* Contradiction census: 28/28 fully voiced, 57/57 registered edges, zero dangling sources.
* Registry world coupling: 199/199 sources resolve; 46/46 registered lines disappear under holder
  ablation; 407 unrelated answers remain byte-identical.
* RI-LOR04 static validator: native band 4, clearing the wave-blocking band-3 threshold.
* RI-LOR03 length, series, short-tail, hint ratio (0%), IQR (6.3), authorship (52), and mutual-pair
  count (19) clear their native numeric bars.
* Aggregate data/content/quest/boot checks complete at the builder tree; the quest checker retains
  its pre-existing 12-document warning.

## Red rows and dependency blockers

* `book-stats.py` remains red: CF-D002 has no represented real book, two titled dispute sources are
  unwritten, and one Argonian-labelled book has a Tamrielic byline. These require substantive lore
  decisions/content and are not converted to manifest aliases.
* RI-LOR03 taxonomy remains short by 15 substantive texts (T1 −3, T2 −4, T3 −5, T7 −2, T9 −1).
  No corpus padding was authored in this sweep.
* Current r3 world-coupling evidence says 158/163 texts change no dialogue/quest observable. L1's
  exhaustive current document interaction run and the common placement-index repair were not
  completed here; W1-04 owns placement and must not be absorbed without a demonstrated seam defect.
* RI-LOR06 M2 is red: the required line-by-line disposition ledger for all historical/current secret
  hits does not exist. No automatic keyword output is promoted to semantic triage.
* RI-LOR06 M8 lacks the plan-required accepted pre-W1-23 snapshot designation. This is a plan/execution
  authority gap: Git history offers candidates, but the satisfied plan does not identify which
  accepted commit is canonical. It remains red pending arbitration, not silently selected.
* Full native RI-LOR01/02/05/07 and QST06 mixed-population runs remain dependency work; sibling-owned
  mechanics, settlement placement, character, progression, and future quest/dialogue implementation
  were not absorbed.

## Independent judgement rows — NOT_RUN

RI-LOR03 M2 blind world/provenance ranking; RI-LOR03 M3 author/want/wrong-belief sample; RI-LOR04
M6 twenty-name culture attribution; RI-LOR06 M3 semantic contradiction adjudication; M5 adjudicator
disposition; M6 CF-D002 semantic answer guard; M7 invention-opacity sample; and every qualitative
native scoring row above are `NOT_RUN`. The builder neither answers nor scores packs it builds.

## Exact critic handoff

At the final commit, first rerun `build-canon --check`, `canon-census` plus `--self-test`,
`canon-consumption`, `lor04-validate`, `book-stats.py`, and the aggregate data/content/quest/boot
checks. Falsify the registry by restoring either stale `#notary` voice, and falsify naming by
restoring each old mononym. Then independently execute the named `NOT_RUN` rows with actor-independent
packs and sealed keys. Do not declare W1-23 pass while the book-stat, secret-triage, exhaustive
document consumption, taxonomy, drift, or native-coverage rows above remain red.
