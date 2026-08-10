# W1-16 completion-builder handoff

Tested from current HEAD on 2026-08-10. This is a builder handoff, not an
independent verdict.

## Classification result

`reports/w1-16/bar-matrix.json` is schema v2 and contains 271 explicit rows:
11 builder `GREEN`, 8 independent-only `NOT_RUN`, and 252 named
`DEPENDENCY_BLOCKED` rows. There are **zero ordinary builder-actionable FAIL or
deferred rows**. The previous 20 aggregate hard-fail-set rows were removed and
expanded to 91 source-line-addressed native clauses, so no hard-fail clause is
hidden behind an aggregate.

`DEPENDENCY_BLOCKED` is deliberately red for whole-project closure. It is not a
builder waiver: every such row names its sibling owner/dependency and keeps the
native authority and exact threshold reference. This prevents W1-16 from
silently rebuilding W1-07 character content, W1-21 UI, W1-15 stealth, W1-01
travel, or the other S23-separated siblings while still exposing the required
end-to-end seams to the downstream critic.

Independent/blind rows are `NOT_RUN`; none is reported as PASS. RI-CMB01's
independent animation judgement remains separate from the live S23 tier and
consumption proof.

## Builder-admissible execution

The completion run used Playwright-installed Chromium after
`node tools/contention.mjs --gate` returned GO. The single-browser live suite is
reproduced by:

```sh
node tools/harness/w1-16-r4-live.mjs --probe all --out reports/w1-16/r5-live.json
```

The suite exercises pin/save restoration, pack/equip anti-merge, talisman
weight, an unpinned overloaded state, Feather expiry, player-visible refusal,
and world-side consumption. Its fix and teardown arms must all report
`coupled: true`.

Cheap/static commands used before browser work:

```sh
node tools/analysis/creation-audit.mjs
node tools/analysis/quest-audit.mjs
node tools/analysis/content-stats.mjs --facet race
node tools/analysis/content-stats.mjs --facet ownership
node tools/check-souls-world.mjs --totals
node tools/check-souls-corpus.mjs
node tools/progression/derive-soul-values.mjs --check
node tools/harness/w1-16-r4-offline.mjs
node tools/harness/w1-16-r4-offline.mjs --selftest
```

The creation rerun remains 89/96 with six sibling-owned hard failures; these
are dependency rows rather than being mislabelled builder failures. The quest
audit completed with no integrity problems but retained its native red metrics.
Neither set is handed downstream as an undifferentiated UNMEASURABLE blob.

Regenerate and enforce the completion classification with:

```sh
node tools/progression/w1-16-bar-matrix.mjs
```

The command exits non-zero if any `builder_actionable` row is not `GREEN`.
Dependency and independent rows remain visible and fail-closed for overall
project closure without falsely failing the completed W1-16 builder scope.

## Binary policy

No PNG, WAV, WebM, or other binary evidence is committed by this delivery.
`r5-live.json`, this handoff, and the matrix carry the text results and exact
reproduction commands; they do not substitute for any authority-required
binary evidence an independent judge must collect.
