# Brief: corpus coherence — constants, front-matter repair, wrong-bar amendments

**Run this LAST**, after the other corpus tasks land (check `node tools/orchestrate.mjs`). You edit other agents' files, which is why you go last.

Closes BAR-CRITIQUE-01 **G7** ("nobody audits the corpus — it has the exact incoherence it exists to prevent in the game"), the **wrong bars W1–W8**, and the index-integrity thin spot. Read `BAR-CRITIQUE-01.md`, `BAR-CRITIQUE-01.json`, `INTENT-AUDIT-01.md` and `INTENT-AUDIT-01.json` in full — they are your work list.

## 1. `corpus/00-doctrine/constants.json` — one owner per shared constant
The corpus has **two authoritative definitions of the same unit, 70% apart**: RI-AI07's traversal minute uses 3.4 m/s over 204 m, while seam **S17** and RI-WLD01 mandate **2.0 m/s**. Every density, beat-structure, runback and sightline figure downstream is corrupted by this. Build the shared-constant registry: each constant, its **single owning item**, its value, its unit, and every item that consumes it. Then **resolve the contradiction by amendment** and restate the affected figures.
Do the same for the other known collision: RI-PRG06's 576 hand-placed enemies vs RI-WLD07's 8 dungeons × 25–60 plus RI-WLD02's 0.7–1.2 hostile groups/min over a 79-minute road network. And the dialogue-scope discrepancy documented in `corpus/40-dialogue/data/README.md` (RI-DLG02 cites 17,298 distinct texts / 504,896 words; recomputation over the vendored file gives 28,050 / 1,869,218) — **rule which scope is canonical and restate RI-DLG02's per-settlement targets against it.**

## 2. `corpus/80-methods/RI-MTH05` — corpus coherence as a judged property
A reference item whose subject is the corpus itself: shared-constant integrity, front-matter validity, no orphaned `judges:` paths, no item judging nothing, no two items contradicting. With an executable check (extend `tools/corpus-index.mjs`) and a **blocking CI gate**.

## 3. Front-matter repair
`node tools/corpus-index.mjs` reports **19 front-matter errors, 31 holes and 206 legacy aliases**. Items with unresolvable `judges:` paths **judge nothing and are invisible to the critic hand-off** — RI-CMB08 (healing, 3,155 words) has all four paths dead; RI-WLD08, the corpus's best liveness instrument, has 5 of 7 dead. Fix every one to canonical paths. Add the new roots other agents registered (`weapon.*`, `magic.*`, `character.*`, `stealth.*`, `crime.*`, `camera.*`, `experience.*`, `composition.*`, `journey.*`) to `subsystems.json`. Then regenerate `INDEX.md` and make `--check` a blocking gate.

## 4. Apply the wrong-bar amendments W1–W8
From BAR-CRITIQUE-01, each with a specified fix — including RI-WLD05's front-loaded strangeness curve, RI-WLD02's global density floors that make deliberate emptiness illegal, RI-DLG07's `ours_win_rate ≥ 0.25` pass condition (which contradicts CORPUS-CONTRACT §6 and CRITIC-DOCTRINE §2.5, where a blind pick landing on ours is evidence the *critic* is broken), the RI-AI07/S17 unit collision, the RI-MTH03 mis-mapping for `combat.feedback.hitstop`, RI-QST05's dependence on stealth/crime, the inconsistent scoring aggregation across areas (10-combat uses weighted sums where 70/100 is "remediable"; 20-progression uses min-over-axes where any axis fails the item), and RI-AI05's unpinned fixture. Coordinate with any parallel amendments proposed in agents' replies.

## 5. Apply the intent-audit corrections
INTENT-AUDIT-01 returned **DRIFTED** with 17 drifts. Doctrine-level ones (ID-01 combat boundary, ID-03 S19/S7 teleport contradiction, ID-09/ID-10 travel) are already fixed in ARBITRATION.md. Apply the **item-level** ones — notably the one-directional travel checks that test only for the ABSENCE of warping (ID-17) and RI-PRG04's scoring that rewards "no warp code path exists" (ID-09). Every travel check must be **two-directional**: failing when the network is missing *and* when it degenerates into warp-to-map-pin.

## 6. `corpus/00-doctrine/CORPUS-COHERENCE-01.md`
The report: what you changed, what you resolved, what remains contradictory, and every constant now under single ownership.

**You MAY edit other agents' reference items** — you are the only agent with that authority. Record every edit in the report.
