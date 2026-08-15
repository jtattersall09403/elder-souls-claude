# W1-VISUAL-BLIND-PROTOCOL-A-r2 — Protocol A run again, counterbalanced, after three landed remedies

**Item:** `RI-VIS06` (blind comparison protocol), Protocol A only. **Round:** 2.
**Wave:** 1. **Date:** 2026-08-15. **Branch:** `codex/wave1-build-experiment`.
**Commit of record:** `f52ab49566448b7ce2f8402494b1ff1f718a7fca` (pack and capture).
**Pack built by:** the `I3` Protocol A round-2 pack-builder (`orchestration/status/I3-PROTOCOL-A-RERUN.json`).
**Judged by:** five separate fresh Opus agent contexts (CLAUDE.md 0d's visual-work carve-out).
**Verdict written by:** this document, which built nothing and judged nothing.

**Result in one line: ours lost all five pairs again. FIDELITY remains capped at 5, still below
6, and the score did not move despite three landed remedies each measuring green on its own
instrument.**

---

## What I could not do, first

1. **I did not judge, and I could not have.** The five answers were collected and decoded before
   this document existed. My job began at the decoded result. If the judging itself was wrong,
   nothing here detects it.
2. **I do not have a per-pair verbatim transcript.** r1 had `JUDGEMENTS-r1.md`, so its verdict
   could quote which exact sentence belonged to which pair. No `JUDGEMENTS-r2.md` file exists for
   this run — `orchestration/status/I3-PROTOCOL-A-R2-RESULT.json` gives only the aggregate
   synthesis across all five judges. Every quoted gap statement in this document is therefore
   attributed to the run as a whole, not to a specific pair, and `blind_comparisons[].blind_rationale`
   in the JSON says so explicitly rather than inventing a per-pair attribution.
3. **I did not open the sealed key.** Per this task's own brief, `SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/`
   was not opened — not `pairing-r2.json`, not `PAIRING-KEY.json`, not any `pairNN.reveal/mapping.json`.
   The reveal table below is the decode already handed to me, fixed before any image was opened; I did
   not re-derive it myself. `COMMITMENT.json` and `SEAL-README.md`, which describe the seal's design
   rather than its contents, were read.
4. **I cannot independently confirm zero re-asks or discards for r2.** r1's verdict could show this
   from `JUDGEMENTS-r1.md`. For r2, I can only note that `I3-PROTOCOL-A-R2-RESULT.json` reports no
   discard or re-ask — an absence of a report, not a positive confirmation.
5. **I did not re-verify the F1/F2/F3 instrument figures myself.** The orphaned-material count
   (321/422 → 0), the contact-junction ratio (0.722 against a ≥25% bar) and the ambient-lift figure
   (+0.631, three GPUs, control −0.001) are quoted from `I3-PROTOCOL-A-R2-RESULT.json` because that
   file was designated as this verdict's source. They are not re-derived here from the underlying
   `W1-ORPHANED-SURFACE-SHADERS-r1` verdict or its siblings.
6. **I could not remove the largest unresolved deviation, only characterise it again.** The judges
   still inherit the project `CLAUDE.md` (D1), still see the same bokeh-confounded and
   scale-mismatched reference windows on pairs 02/03/05 (D3/D4, deliberately not fixed this round —
   see §4).

---

## 1. The reveal, and why the positional-bias check finally has real power

The decode, fixed before any image was opened (`I3-PROTOCOL-A-RERUN.json`'s counterbalancing plan:
ours on **A** for pairs 01/03/05, ours on **B** for pairs 02/04) and reported already-decoded in
`I3-PROTOCOL-A-R2-RESULT.json`:

| pair | letter A is | letter B is | ours sat on | judge answered | that letter was | confidence |
|---|---|---|---|---|---|---|
| pair01 | **ours** | reference | **A** | **B** | reference | high |
| pair02 | reference | **ours** | **B** | **A** | reference | high |
| pair03 | **ours** | reference | **A** | **B** | reference | high |
| pair04 | reference | **ours** | **B** | **A** | reference | medium |
| pair05 | **ours** | reference | **A** | **B** | reference | high |

**Ours: 0 wins, 5 losses. The reference won 5 of 5 — the same outcome as r1.**

### The positional-bias check, run at full power for the first time

r1's free coin flip put ours on `B` in four of five pairs, leaving exactly one trial able to
distinguish "the judge answers the letter" from "the judge answers the reference." r1's own ruling
(reversible, and reversed here in its favour) required r2 to counterbalance instead: ours on `A` for
`pair01/03/05`, ours on `B` for `pair02/04`, fixed before any image was opened.

That makes the reference's position alternate: **B, A, B, A, B** across pairs 01–05. A judge
answering by a **fixed letter** — always `A`, or always `B` — can match the reference on at most
**3 of 5** pairs under this design, whichever letter it picks (fixed-`A` matches only where the
reference sits on `A`: pairs 02, 04 — 2 of 5; fixed-`B` matches pairs 01, 03, 05 — 3 of 5). **The
observed match is 5 of 5.** No fixed-letter strategy can produce that. This rules out letter-only
answering with strictly more power than r1's single discriminating trial, and it is the direct payoff
of r1's ruling.

**The honest limit, unchanged in kind from r1.** Under the null that answers are independent of
image content, `P(5/5 match) = 1/32 ≈ 0.0313`, one-sided — the same weak-power floor r1 quoted and
the same one `image-leakcheck` prints about its own sweeps. It rules out a *fixed* strategy; it
cannot rule out a probabilistic tilt that happened to land on the reference five times by chance.

**RULING (this verdict, reversible, confirming r1's).** Keep the counterbalanced-sides design for
round 3. It cost nothing, and it turned an unfalsifiable axis (a 5:0 free flip is possible and would
leave zero power) into one with genuine discriminating power. *What would overturn it:* evidence that
counterbalancing itself changes judge behaviour in a way unrelated to content — nothing so far
suggests it.

---

## 2. What the run found: the same two absences, after three remedies that measured green

`I3-PROTOCOL-A-R2-RESULT.json` reports the confidence spread as **four `high`, one `medium`** —
identical to r1's spread — and the aggregate of all five judges' `SINGLE BIGGEST GAP` / `SECOND GAP`
answers names, in the judges' own words (quoted, not paraphrased, exactly as they appear in the
source file):

> **No material differentiation:** "every surface returns the same flat matte olive-grey"; "thatch,
> plaster, stone and ground all return light identically"; "nothing reads as leather, metal, stone
> or vegetation."
>
> **No shadow or ambient occlusion at all:** "no contact darkening and no cast shadows at all, so
> nothing sits in space"; "surfaces meet with no contact darkening."

Those are the same two clusters r1 found (cluster A "no material response separation" and cluster B
"no contact shadow, no AO") — named again, after F1 (materials), F2 (contact shadows + AO) and F3
(ambient fill) landed and each measured green on its own instrument:

| remedy | what it changed | its own instrument result (per `I3-PROTOCOL-A-R2-RESULT.json`) |
|---|---|---|
| F1 — PBR materials | binds albedo/normal/roughness sets | orphaned surface materials 321/422 → 0 |
| F2 — contact shadows + AO | occlusion term, shadow casting | contact-junction ratio 0.722 against a ≥25% bar |
| F3 — ambient/GI fill | tone-mapped shadow lift | ambient lift +0.631, replicated on 3 GPUs, control −0.001 |

**None of the three moved the blind judgement.** This is the headline of the run, and it matters
more than the repeated score: *"Statistics can fail a build and can never pass one."* Each fix passed
a numeric gate built specifically for it — the numbers are real — and none of them changed what five
independent, fresh judges saw.

### The mechanical corroboration, still there, still not allowed to add confidence

`leakcheck-r2.json`'s `local_contrast_med` statistic — the same channel that swept 5/5 toward the
reference in r1 — sweeps **5/5** again this round. `shadow_levels`, which swept 5/5 in r1, sweeps
**3/5** in r2: a partial, not-yet-decisive movement on that one channel, reported here rather than
smoothed into either "unchanged" or "improved." Per Ruling W2, none of this is evidence for the
forced choice already made by the judges — it is recorded as corroboration on file, in both
directions, exactly as strong or weak as the numbers themselves are.

### Two things that make this loss stronger, not weaker — recorded because the task requires it, not because it is comfortable

1. **The judges are structurally biased toward us, and we still lost.** A subagent in this
   repository cannot be spawned without the project `CLAUDE.md` in scope, so no judge here was fully
   naive about an in-development game existing. The pack-builder's own reasoning (`I3-PROTOCOL-A-RERUN.json`
   N1) is that this bias flatters our side — a judge charitable toward "looks like a game build" is
   biased *against* finding a gap. A verdict finding us losing is strengthened by this, not weakened.
2. **Our images are sharper, and we still lost.** Per the aggregate synthesis, three of the five
   judges volunteered that our arm holds cleaner silhouette edges and better fine detail while the
   reference plates are heavily blurred, degraded JPEGs. So this loss is not about resolution,
   aliasing, or sharpness — all of which our side wins. It is specifically about material response
   and light.

---

## 3. Two leaks the pack-builder caught, and what they say about the guard itself

**A HUD name-plate had started drawing into two of five crop windows.** The build now renders a
region name ("western-rootlands") at canvas coordinates x 42–180, y 962–983 — new since r1's capture
on 2026-08-14. r1's crop window at (150,480), reused by r2 for pairs 02 and 04, caught its last two
glyphs. Two of our five arms would have shipped with legible burnt-in text. **`image-leakcheck` was
GREEN on the contaminated version** — a few dozen text pixels move no summary statistic. The
pack-builder found this by opening the crops, not by any tool, and moved the window to (200,480)
before the pack was built and before any judge ran. Because the fix predates judging, it does not
change this run's score — it is recorded because it changes what the judged pack actually contained
relative to any earlier, undocumented window, and because of what it exposed about the gate itself.

**The leak-check battery is a sweep detector, and that is a real, demonstrated limit.** The
pack-builder deliberately built three leaky copies of the real r2 pack, each isolating one channel:
a quantised reference on **every** pair goes RED (`distinct_levels` 0/5, p=0.0313); the identical
injection on only **one** pair goes GREEN and is **missed** (`duplicate_rows` 1/5, p=0.5); the same
injection swept across all five goes RED again (5/5, p=0.0313). **A leak affecting fewer than all
pairs is invisible to this gate, however blatant it is** — exactly the class the HUD name-plate leak
belonged to. Found by eye, not by the tool, and the tool's own limit is now on record rather than
assumed away.

**The improvement under test tripped the guard.** `image-leakcheck`'s `bytes` channel swept RED 5/5
on the first r2 pack build: our PNGs run 25–30% larger than the same crop windows in r1 (pair01
330,353 → 422,286 bytes; pair03 340,860 → 442,253 bytes), because real material detail and an
occlusion term carry more high-frequency content than a JPEG-sourced reference crop, whose DCT
quantisation has already smoothed it. `protocol-a-pack.mjs --equalise-bytes` padded each arm with a
zero-filled private ancillary PNG chunk until both files in a pair matched exactly in length. Pixels
are untouched; every quality statistic is identical before and after.

**This equalisation is ACTIVE, and it is not evidence of blindness.** A `bytes` tie in this pack —
`0/0 (5 tied)` in `leakcheck-r2.txt` — is true by construction, not a natural property of the pack,
in the same sense the tool's own `matched` column already treats width and height (equalised by the
crop box) as ties that prove nothing. Recorded plainly rather than banked as a clean pass. **r1's own
pack escaped this exact sweep by one pair** (4 of 5, not 5 of 5) — which means, in hindsight, r1's
GREEN leak-check was one pair away from the same RED this pack hit before equalisation, and r1's
verdict did not know this at the time.

---

## 4. Protocol deviations — carried, active, and new

**D1 (carried from r1, unresolved).** The judges are still not fully naive; a subagent here still
inherits the project `CLAUDE.md`. Per the pack-builder's own N1, this matters *more* in r2 than in
r1, because r2 was the first run where ours winning was a live possibility. Ours lost anyway, so the
strengthening direction (a losing verdict is strengthened by a bias that flatters us) applies again.

**D3/D4 (carried from r1, deliberately not fixed).** pair02/pair03's reference windows are still
background bokeh; pair05's subject scale still mismatches (near-field close-up vs. our mid-distance
dusk walkway), and pair05 is drawn from the weakest source frame in the r2 pack
(`char-player__t1930`, `shadow_levels` 7, local contrast 0.52 per `capture/frame-liveness.json`). The
pack-builder chose, deliberately, not to swap either plate: a changed pair cannot be read against
r1's answer on the same pair, and comparability with r1 is the entire purpose of running r2. Cost
stated plainly: r2 inherits both confounds. Owed remedy unchanged from r1.

**D6 — active byte-length equalisation (new this round).** See §3. Recorded in `method_deviations[]`
as `affects_scores: true` because the pack's leak-check GREEN depends on it, and because it is a
direct consequence of the work under test (more material detail costs more bytes).

**D7 — a leak caught by eye and a demonstrated gate limit (new this round).** See §3. Recorded as
`affects_scores: false` because the leak was fixed before any judge saw the pack, but kept in the
record because of what it demonstrates about the instrument generally: a single-pair leak is
currently uncatchable by anything except a human opening every crop.

**Not a deviation, recorded to close the question, as far as this verdict can tell:** no discard or
re-ask is reported anywhere in `I3-PROTOCOL-A-R2-RESULT.json`. This verdict cannot confirm that with
r1's level of certainty (see "What I could not do," item 4), and says so rather than asserting it.

---

## 5. Scoring — re-derived for r2, not copied from r1

### The cap that applies

RI-VIS06 §Scoring, Protocol A outcome table, applied fresh against r2's own reported spread:

| row | condition | cap | applies to r2? |
|---|---|---|---|
| 1 | Ours loses all pairs at `CONFIDENCE: high` | **5** | **nearest applicable** |
| 2 | Ours loses all pairs, **≥ 2** at `CONFIDENCE: medium/low` | 7 | no — one `medium`, not two |
| 3 | Ours loses some, wins some (post-escalation) | 8 | no — ours won none |
| 4 | Ours wins ≥ half post-escalation | none | no |
| 5 | Zero pairs ran | (S55) | no — five ran |

r2's spread is **four `high`, one `medium`** — identical to r1's, checked independently against r2's
own reported numbers rather than assumed. Row 2's own stated threshold is **≥ 2** medium/low answers;
one is not two, so row 2 does not apply, and row 1 (**cap 5**) is the only remaining row describing a
clean sweep of losses. Same result as r1, arrived at by re-applying the table to this run's own data,
not by copying r1's number forward.

### S55's arithmetic — inert again, for the same reason

Five pairs ran, so the zero-runs clause does not fire. Both its numbers are inert here, exactly as in
r1. What actually applies is the outcome table: cap 5.

### Status

**FAIL.** Cap 5 < pass threshold 6; RI-VIS06 §Failure threshold: *"any cap below 6 blocks the
wave."* Exactly one biggest gap is named per ARBITRATION §3 — **not** a re-statement of r1's gap, but
`GAP-W1-visual-fix-not-reaching-blind-frames`, the sharper finding this run actually produced: three
remedies that measured green on their own instruments did not move the judgement, so the next unit of
work is diagnosing *why*, ranked above building anything new.

`GAP-W1-pbr-material-set-unbound` (opened by r1) is **not closed** by this run. It is re-measured in
`gap_closure[]` and left **open**: the acceptance clause names a wave-2 re-run and this is a second
run still inside wave 1, and in any case the aggregate synthesis still names the material-response
absence. This verdict does not have r2's per-pair breakdown needed to say with r1's precision whether
it was any specific pair's *single biggest* gap this round — only that it appears in the aggregate.

---

## 6. Where this leaves round 3

The five §E blocks for this round are appended to `corpus/90-verdicts/w01-visual-blind.md`, the
location RI-VIS06 §E names. Nothing here recommends a re-judge of these five pairs — the finding is
sound and consistent with the corroborating statistics. What is owed before Protocol A runs a third
time:

1. **Diagnose the reach problem** (`GAP-W1-visual-fix-not-reaching-blind-frames`): force AO to full
   strength and force all material sets bound on the exact five capture setups, and find out whether
   the terrain-artifact AO cap (`uAOMaxOcclusion` 0.6, added to hide a normal-grid artifact) is
   hiding F1/F2's effect on precisely the kind of scene this pack draws from.
2. **Close D3/D4**, still owed from r1: an in-focus daylight exterior plate for pair02/pair03, a
   low-light mid-distance exterior plate for pair05.
3. **Close D1**: run the judges from a working directory with no project `CLAUDE.md` in scope.
4. **Do not build a fourth visual feature before (1) is answered.** Per `I3-PROTOCOL-A-R2-RESULT.json`'s
   own instruction: building more on top of an instrument that has not been shown to reach the judged
   frames is spending against a measurement we do not yet trust.
