# BUILDER DELIVERY COMPLETE — W1-09

Builder-side delivery only. This is neither an independent verdict nor a PASS. No critic, blind, or
independent method was administered or scored by this builder.

## Frozen authority and invariants

The completion started from the current branch HEAD recorded in the machine ledger. The governing set
is the 31-item set in the satisfied W1-09 plan. Every item is classified fail-closed as
`W1-09-owned/applicable`: no owned producer, consumer, coupling, population, or aggregate was
classified away because its fixture belongs to a sibling. There is no claimed sibling reuse and no
`not applicable` row in this delivery.

S40 is preserved exactly: 52-frame cadence; suppression on `f0+1..f0+42`; regeneration on
`f0+43..f0+51`; 6.75 stamina per completed interval; seven starts; 6.5 after the seventh; 13.25 at the
next press; denial at `f0+364`, canonical frame 366. The rejected control remains five rolls/frame 260.

## Fresh builder results

* RI-CMB12 M1 was rerun over all four champion moves and both idle/walk entries. All eight arms clear
  the visible-start floor; `combo_b` remains the binding 19-frame arm. The result contains no
  acceptance failures.
* The current corpus coherence gate passed with zero errors. Its 41 warnings include missing native
  method executables and are retained as corpus debt, not converted to build passes.
* Existing authoritative builder artifacts preserve the exact S40 live result and the enemy reach
  census. Their provenance is explicit in the machine ledger; the independent critic must still
  establish ancestry and determining-input digests before reuse.

## Hard-fail continuation and environment stop

The cheap corpus gate ran first. Browser-backed `cmb-probe --probe all` then failed closed when the
browser target closed. `tools/contention.mjs --gate` reported 14 browser instances against a ceiling
of 5 (exit 3); `boot-check` independently failed to launch with the same closed-target error. No
expensive browser or rendered/blind claim was made after that hard stop. Partial output containing
`__err` values is retained as diagnostic evidence and is not scored.

The production-known RI-CMB04 M9 empty substep changed set, tip-speed residual, wide-sweep residual,
and roll-to-attack transition residual are therefore not represented as repaired or green. The W1-12
M2-LIVE seam and missing sibling evidence remain `NOT_RUN`. This is the only honest completion state:
no missing predicate is waived, averaged away, renormalised, or mislabeled `not applicable`.

## Complete plan-row accounting

`builder-completion-20260810/applicability-ledger.json` accounts for all 31 governing items, records
classification, applicability reason, builder state, evidence, and an explicit `NOT_RUN` independent
state. Counts: 31 governing; 31 owned/applicable; 0 sibling-reused; 0 not-applicable; 0 independent
PASS. The conjunctive aggregate is `NOT_RUN` because required missing/dependency/independent inputs
cannot be treated as green.

No binary artifact is committed. `manifest.sha256` hashes every committed text/JSON command/result
artifact. Transient browser processes and captures are not evidence.

## Exact critic entry point

1. Checkout this commit and verify `builder-completion-20260810/manifest.sha256`.
2. Run `node tools/harness/cmb-exchange.mjs --probe react --out /tmp/w1-09-react.json`; require exit 0,
   no acceptance failures, eight idle/walk arms, and binding `combo_b t_react=19`.
3. Independently reproduce the one-field delete-fix arm (`combo_b.startup=22`) on a copy; require
   `t_react=18` and exit 1, then restore 23 and require 19/exit 0.
4. Start at the first non-green ledger row, rerun cheap deterministic gates, and only then run the
   browser-backed full populations when `node tools/contention.mjs --gate` exits 0. Repair production
   hard failures before downstream evidence.
5. Administer all independent/blind rows with fresh context. Do not accept any builder-side PASS;
   the ledger intentionally contains none. Finally run the conjunctive native-item/W1-09 aggregate
   fail-closed, without renormalising any `NOT_RUN` row.
