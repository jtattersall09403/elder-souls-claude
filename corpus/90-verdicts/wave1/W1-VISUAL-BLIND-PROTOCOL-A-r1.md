# W1-VISUAL-BLIND-PROTOCOL-A-r1 — the first blind fidelity comparison this project has ever run

**Item:** `RI-VIS06` (blind comparison protocol), Protocol A only.
**Wave:** 1. **Date:** 2026-08-14. **Branch:** `codex/wave1-build-experiment`.
**Commit of record for the pack and the capture:** `21795f5f27` (chunk 1). Verdict written at `250aad60`.
**Pack built by:** `RI-VIS06-PROTOCOL-A` chunk 1. **Judged by:** five separate fresh agent contexts.
**Verdict written by:** chunk 2, which built nothing and judged nothing.

**Result in one line: ours lost all five pairs. FIDELITY is capped at 5, which is below 6, which
blocks the wave.**

---

## What I could not do, first

1. **I did not judge, and I could not have.** Rule 25 and RI-VIS06 §A. The five answers were
   collected by the orchestrator from five fresh agent contexts before I existed; my job began at the
   sealed key. If the judging was wrong, nothing in this verdict detects it — I am reading returns,
   not images.
2. **I could not prove the key was unread before judging; I can only show when it was first read.**
   The filesystem is mounted `relatime`, so an atime records the *first* read after a write and is
   not updated by later reads within 24h. Absence of a late atime is therefore not evidence of
   absence of a read. See §Read-after-write for what the timestamps do and do not establish — and
   for one read at 16:08:11Z that I chased down rather than skipped.
3. **I could not remove the biggest protocol deviation, only characterise it.** The judges inherited
   the project `CLAUDE.md` and so were not naive about an in-development game existing. There is no
   way to spawn a subagent without it in this harness. The remedy is owed and named below; it is not
   mine to apply retroactively.
4. **The positional-bias check has exactly one discriminating trial.** Chunk 1's free coin flips put
   ours on B in four of five pairs, so only pair03 can distinguish "the judge answers A" from "the
   judge answers the reference". It distinguished, and it came out the right way — but a design that
   rests a bias check on n=1 is a weak design, and I say so rather than presenting the result as
   stronger than it is. Remedy ruled below.
5. **I did not re-run, re-judge, or seek a second opinion on any pair.** Ours won nothing, so
   RI-VIS06 §C's escalation ladder does not fire; re-running a loss "to check" is judge-shopping and
   the item forbids it explicitly.
6. **Four of the five reference plates are from one game (Elden Ring), and three of those from one
   session.** That is a real narrowing of what "modern reference" means here, forced by
   pixel-density parity. It is not fixable inside this run.

---

## 1. The reveal, and the cross-tabulation that decides whether it means anything

The sealed key is `reports/blind/protocol-a-w1-SEALED-KEY/`, copied to this verdict's artifacts at
`artifacts/W1-VISUAL-BLIND-PROTOCOL-A-r1/key/`. Per-pair assignment comes from
`<pair>.reveal/mapping.json`; the frame and plate identities from `PAIRING-KEY.json`.

| pair | letter A is | letter B is | ours sat on | judge answered | that letter was | confidence |
|---|---|---|---|---|---|---|
| pair01 | reference | **ours** | **B** | A | reference | high |
| pair02 | reference | **ours** | **B** | A | reference | high |
| pair03 | **ours** | reference | **A** | **B** | reference | high |
| pair04 | reference | **ours** | **B** | A | reference | medium |
| pair05 | reference | **ours** | **B** | A | reference | high |

**Ours: 0 wins, 5 losses. The reference won 5 of 5.**

### The positional-bias check, which was able to void this run and did not

The question the judgements file put, correctly: raw answers are **A, A, B, A, A** — 4:1 — and the
coin flips also came out **4:1**. Is that the *same* 4:1, or a coincidence of a judge that likes the
letter A?

**They are the same 4:1, and the coincidence is not a coincidence.** Read the two shaded columns
above together:

- On the **four** pairs where ours sat on **B**, the judges answered **A** — four times out of four.
- On the **one** pair where ours sat on **A**, the judges answered **B**.

The answer letter tracks the *side* on 5 of 5 and tracks the *position* on 4 of 5. A judge choosing
by letter would have answered A on pair03; it answered B. **Deterministic positional bias is ruled
out outright, and the pairs do not need re-running with the sides swapped.**

**Now the honest limit on that.** The test has one informative trial, because the free coin flip put
ours on B four times. Under the null that answers are independent of image content — any fixed-letter
strategy, any coin flip — the probability that all five answers coincide with the key is 1/2^5 =
**0.0313**. That is the same weak-power figure `image-leakcheck.mjs` prints about its own sweeps, and
it is quoted here in the same spirit: it is a floor, not a proof. It can rule out a *deterministic*
letter preference; it cannot rule out a probabilistic tilt toward A that happened to be masked.

And note the asymmetry that matters for this project: **this statistic is being used to fail a build,
not to pass one.** It costs us. Had it come out the other way it would have voided the run, not
excused it.

**RULING (chunk 2, reversible).** Wave 2's Protocol A must **counterbalance the side assignment**
rather than free-flip it: with n pairs, ours sits on A for exactly ⌈n/2⌉ of them, assignment fixed
before any image is looked at. This is not fiddling with the instrument after seeing the answers —
it is a blocked design decided in advance, and the letter carries no information a judge could use,
so balancing it removes a degree of freedom that has no diagnostic value while giving the bias check
n/2 informative trials instead of possibly zero. A free flip can legitimately produce 5:0, under
which the positional-bias check has **no power at all** and the whole run is unfalsifiable on that
axis. *What would overturn it:* evidence that a judge can infer the balancing rule from the pack
(it cannot — the rule lives in the runner, and a judge sees two files), or a wave in which
counterbalancing measurably changes the answers, which would itself be the finding.

---

## 2. Read the gap text: this is one finding repeated, not five findings

Five judges, five fresh contexts, five different image pairs, and the losing side was ours every
time. What they said about it clusters hard:

| cluster | what the judges said about the losing (our) side | pairs | named BIGGEST in |
|---|---|---|---|
| **A — no material response separation** | "flat diffuse albedo with no specular, roughness variation, or normal-mapped relief"; "flat untextured color wash"; "flat untextured fills that all respond to light identically"; "no surface-level texture breakup or normal-mapped detail response" | 01, 03, 04, 05 (4/5) | 3 (01, 03, 05) |
| **B — no shadowing, no contact darkening, no AO** | "no contact shadows where walls and the bridge meet the ground"; "no contact darkening where the wooden step meets the ground"; "trees, slabs and the horizon cast nothing"; "no contact shadow or occlusion anywhere" | 01, 02, 03, 04, 05 (5/5) | 1 (02) |
| **C — shadows crushed, no ambient/GI fill** | "crushed to near-black with no recoverable detail"; "crushed to a near-uniform black with no bounced or ambient fill, so an ambient/GI term with tone-mapped shadow lift is needed" | 01, 03, 05 (3/5) | 0 |
| **D — nothing above the ground plane** | "no geometry or props at all above the ground plane… a bare terrain sheet" | 04 (1/5) | 1 (04) |

Clusters A, B and C are three faces of one condition: **surfaces in our build are not shaded, they
are filled.** A material with no normal/roughness map cannot produce a specular response; a scene
with no occlusion term cannot produce contact darkening; a lighting rig with no ambient/GI fill
cannot keep detail inside a shadow. Four separate judges independently described that condition in
four different pieces of vocabulary. **That is one finding, evidenced five times, and treating it as
five findings would make the remedy list vaguer, not richer.**

Cluster D is genuinely separate — it is about *content* in the frame, not about how the frame is
shaded — and it is the weakest single result in the set (one pair, `medium`, and a crop that happened
to be bare ground on our side).

### Corroboration that does not come from the judges

`image-leakcheck.mjs` computed twelve statistics over the pack **before** anyone judged, and reports
the quality ones without gating on them. Two of them sweep:

- `shadow_levels` — **5/5 name the reference**: our crops carry fewer distinct luma levels below the
  25th percentile than the reference on every pair (p=0.0313, weak).
- `local_contrast_med` — **5/5 name the reference**: less local micro-contrast on every pair.

These are cluster C and cluster A measured mechanically, on the same bytes, by an instrument with no
opinion. They agree with the judges. **They do not add confidence to the verdict** — Ruling W2, and
the brief: a chart is not the thing, and a statistic must not be bolted on to firm up a forced
choice. They are recorded because a mechanical agreement is worth having on file when someone later
asks whether the judges were describing something real.

### What ours does better, and why it does not soften anything

All five `WHAT THE LOSER DOES BETTER` lines name the same thing on our side: clean, stable,
non-aliased silhouette edges, and in two cases legible depth staging or haze. That is a true
observation and it is partly a genuine property of our renderer (no depth of field, no temporal
blur). It is also partly an artefact: **three of the five lines describe blur or softness on the
winning reference**, and chunk 1 recorded before judging that pair02's and pair03's reference windows
sit in background bokeh.

**It does not produce a draw and it does not lift the cap.** RI-VIS06 forbids ties in the prompt and
this verdict does not reintroduce one through the back door. Sharp edges on an untextured, unshadowed
surface are what an untextured, unshadowed surface looks like — they are the absence of the defect,
not the presence of a quality. Recorded as context.

---

## 3. The deliverable: a ranked, buildable remedy list

This is what the rest of the project consumes, and it is worth more than the score. Ranked by how
many independent judges landed on it and how load-bearing it is for the ones below it. Every entry is
phrased as something that can be built or turned on, because that is what RI-VIS06's prompt demanded
of the judges and it would be strange for the verdict to be vaguer than its evidence.

**R1 — Author and bind a real PBR material set (albedo + normal + roughness/metalness) to terrain,
architecture and foliage materials.**
*Evidence:* 4/5 pairs, named SINGLE BIGGEST GAP in 3 of them, all three at `high` confidence.
Corroborated by `local_contrast_med` 5/5.
*Acceptance:* on the same eight capture slots, two named materials in one frame produce measurably
different specular response under the same light — and a blind Protocol A re-run in wave 2 no longer
returns "everything responds to light identically" as any pair's biggest gap.
*Size:* L. This is the wave's named biggest visual gap.

**R2 — Turn on contact shadows and an ambient-occlusion term, and make all scene geometry cast into
the shadow map.**
*Evidence:* 5/5 pairs — the most universal single observation in the set — named BIGGEST in pair02 at
`high`. Every judge described forms floating on an unmodulated plane.
*Acceptance:* every standing object in a capture shows a contact-darkening gradient at its base, and
an AO buffer is non-uniform in eaves, under steps and in creases.
*Size:* M. Cheaper than R1 and it is the one that stops objects looking pasted on.

**R3 — Add an ambient/GI fill term with a tone-mapped shadow lift so shadowed regions retain readable
detail.**
*Evidence:* 3/5 pairs, and pair03's judge wrote the remedy itself: *"an ambient/GI term with
tone-mapped shadow lift is needed to keep detail readable in shade."* Mechanically corroborated:
`shadow_levels` names the reference 5/5.
*Acceptance:* distinct luma levels below the 25th percentile, measured by `image-leakcheck.mjs` on a
wave-2 pack, stop sweeping toward the reference on all pairs.
*Size:* M. Depends on R2 existing to have shadows worth lifting.

**R4 — Dress the ground plane: vegetation, rock scatter and props that cast and receive light, rather
than a bare terrain sheet.**
*Evidence:* 1/5 pairs (pair04), BIGGEST but at `medium` — the only `medium` in the set. Ranked fourth
because one judge at medium confidence on a bare-ground crop is the thinnest evidence here, and
because R1–R3 change how *everything* looks while this changes what is in one kind of frame.
*Acceptance:* no 512×512 subject-neutral window drawn from the eight capture slots contains only
terrain.
*Size:* M.

**R5 — Depth of field / focal falloff. DO NOT BUILD ON THIS EVIDENCE.**
Listed to be struck, not to be done. pair02's second gap says ours lacks focus variation with
distance — but pair02's reference window **is** background bokeh, so the judge was comparing our
in-focus render to an out-of-focus plate and that observation is manufactured by the confound. pair04
and pair05 point the *other* way, crediting ours with haze and depth falloff the reference window
lacked. The evidence is contradictory and one arm of it is known-defective. **Rebuild pair02/pair03
against an in-focus plate before anyone treats DOF as a gap.**

---

## 4. Protocol deviations — five of them, stated here and not in a footnote

RI-VIS06's whole purpose is to be the one instrument that cannot be talked into a good answer. A
verdict that hides its own deviations is exactly the failure it exists to prevent. All five are
recorded in the verdict JSON's `method_deviations[]` as well.

**D1 — The judges were not fully naive: they inherited the project `CLAUDE.md`.**
RI-VIS06 §A requires the judge be given "no indication that one image is from an in-development
game". A subagent in this repository cannot be spawned without the project instructions in scope, so
that requirement was **not fully met**.
*What survives:* the blinding that carries the result is *which arm is ours*, and nothing in
`CLAUDE.md` names an image, a frame, a plate, or a letter. Both arms passed a seven-way leak check;
metadata is stripped; dimensions, bit depth, colour type and interlace are identical.
*Direction of the residual bias, which is the part that matters:* a judge who knows a game is being
built might be charitable toward whichever image looks like a game build. That flatters **our** side
and biases **against** finding a gap. **A verdict that finds our side losing is strengthened by this
deviation, not weakened.** A verdict finding our side winning would have been fatally weakened by it
— which is the reverse of the direction you would want if you were trying to launder a result.
*Owed remedy:* run the judges from a working directory with no project `CLAUDE.md` in scope and
record that the context was clean. Until that is done, every Protocol A verdict carries this line.

**D2 — Four of five reference plates come from one game, and three of those from one session.**
Pixel-density parity forced it: a 512×512 native crop out of a 3840×2160 plate magnifies surfaces on
exactly one arm, which is the leak RI-VIS06 names as teaching you nothing about fidelity. Restricting
the reference side to 1920×1080 plates excluded the entire Red Dead Redemption 2 holding, REF-RD, and
both 4K plates — and the daylight-overcast lighting profile with them. The set is 4× Elden Ring +
1× The Witcher 3.
*Direction:* unknown, and it narrows what "modern reference" means. It is a real limit on
generalisation, not a bias with a sign.
*Owed remedy:* acquire 1920×1080 native plates across at least three more titles and two more
lighting profiles before wave 2's run.

**D3 — pair02's and pair03's reference windows are out-of-focus background bokeh.**
The Godrick plates put their depth of field on the creature; every subject-neutral region of those
frames sits behind the focal plane.
*Direction: this biases AGAINST the reference and can only flatter us* on texture detail and edges.
**Ours lost both anyway**, which makes the loss on those two pairs harder, not softer. Its one real
cost is R5 above: it manufactured a depth-of-field "gap" that is not evidence.
*Owed remedy:* one 1920×1080 in-focus daylight exterior plate makes both pairs rebuildable; chunk 1
recorded the pairing table is a one-line edit from doing it.

**D4 — pair05's subject scale differs.** Ours is a mid-distance dusk walkway; the plate is a
near-field material close-up under lamplight. The corpus holds no 1920×1080 low-light plate at
mid-distance exterior scale.
*Direction:* a near-field close-up shows more surface detail per pixel than a mid-distance view, so
this biases **against ours**. It is the weakest pair in the set and it is labelled as such in
`pairing.json` rather than substituted.
*Owed remedy:* acquire a low-light mid-distance exterior plate; until then pair05 should be dropped
rather than kept, and the wave run on four pairs with the skip recorded.

**D5 — two reference windows were moved after looking.** pair02 and pair03 originally took their
window at (100,100), which caught a creature limb at the frame edge; RI-VIS06 §A asks for a
subject-neutral patch, so both were moved to clean masonry. Recorded in `pairing.json` per pair by
chunk 1 rather than quietly applied.
*Direction:* toward compliance with §A. Any adjustment made after looking is a degree of freedom, and
it is on the record so a later reader can weigh it.

**Not a deviation, recorded to close the question:** none of the five judges mentioned the setting, so
RI-VIS06 §A's prompt-leak discard condition did not fire on any run. All five returned the required
answer block on the first attempt, so no run was re-asked and none was discarded. The prompt was
quoted byte-for-byte from `PROMPT-A-verbatim.txt`; it was not paraphrased. One agent per pair; no
agent answered both Protocol A and Protocol B, because Protocol B has not been run. No best-of-N.
**None of RI-VIS06's five void conditions fired.**

---

## 5. Read-after-write — what the timestamps establish, and what they cannot

RI-VIS06 §D voids the protocol if the key was readable before judging, and asks the runner to assert
read-after-write ordering. Here is the actual evidence rather than an assertion.

| event | time (UTC, 2026-08-14) | source |
|---|---|---|
| key files written (`mapping.json` ×5, `PAIRING-KEY.json`) | 16:02:11 – 16:02:45 | mtime |
| pack images written | 16:02:28 – 16:02:45 | mtime |
| chunk 1's own last artefact write (`frames/`) | 16:07:54 | mtime |
| **`pairing.json` and `leakcheck.json` first read** | **16:08:11.134** | atime |
| chunk 1's handoff status file written | 16:10:26 | mtime |
| **judgements captured to disk** | **16:18:03** | mtime |
| key opened by chunk 2 (this verdict) | after 16:18:03 | this session |

**The one read that needed chasing.** `pairing.json` and `leakcheck.json` both name which arm is the
reference, and both were first read at 16:08:11 — ten minutes *before* the judgements landed. I did
not skip this. It falls inside chunk 1's own run window (last artefact 16:07:54, status file 16:10:26)
and both files are quoted in chunk 1's handoff, which cites the leak-check sweeps and the pairing
notes. `image-leakcheck.mjs` reads `<pair>.reveal/mapping.json` and neither of these two files, so the
read was not the tool. The consistent explanation is **chunk 1 reading its own key while composing
its own handoff** — chunk 1 built the key, already knew it, and did not judge. That is not a
violation. The alternative — the orchestrator reading it before dispatch — is not excluded by the
timestamps alone, and I record that rather than asserting it away.

**Why it would not change the result even if it were the orchestrator.** The orchestrator dispatched
all five pairs, one judge each, with no selection to make and no pair withheld; each judge received
two file paths and the prompt text and nothing else. Key knowledge held by a dispatcher cannot reach
a fresh context that was handed two images.

**The limit on all of this, stated plainly:** the filesystem is mounted `relatime`. An atime records
the first read after a write and is *not* updated by subsequent reads inside 24 hours. So these
timestamps can prove that a read happened; they cannot prove that one did not. The
`mapping.json` atimes of 16:02:58 are the pack builder's own final assertion pass and are consistent
with no later read — but they are not proof of one.

**The leak check was re-run by chunk 2 after the key was opened** and is byte-identical in verdict:
`GATE: GREEN`, exit 0, structural gate clean on all five pairs, no held-out provenance channel
sweeping. Output at `artifacts/…/leakcheck-rerun-chunk2.txt`. The tool prints its own caveat and it
is quoted rather than suppressed: *"Five trials is weak power: a clean sweep by chance is p=0.0313 per
rule, one-sided… GATE: GREEN — no held-out provenance channel decides the pack. Power is weak; this
is a floor, not a proof."*

---

## 6. Scoring, and Ruling S55's arithmetic — the first wave in which the clause has had teeth

### The cap that applies

RI-VIS06 §Scoring, Protocol A outcome table:

| row | condition | cap | applies? |
|---|---|---|---|
| 1 | Ours loses all pairs at `CONFIDENCE: high` | **5** | **nearest applicable** |
| 2 | Ours loses all pairs, **≥ 2** at `CONFIDENCE: medium/low` | 7 | **no** — one medium, not two |
| 3 | Ours loses some, wins some (post-escalation) | 8 | no — ours won none |
| 4 | Ours wins ≥ half post-escalation | none | no |
| 5 | Zero pairs ran | (see below) | no — five ran |

Our spread is **four `high`, one `medium`**, which sits between rows 1 and 2. **Applied: cap 5.**
Row 2 states its own threshold explicitly as **≥ 2** medium/low answers; one is not two, so row 2 does
not apply, and the only remaining row describing a clean sweep of losses is row 1. The table is built
so that a single softer answer does not lift the cap — that is what the "≥ 2" is doing there.

*Reversible, and here is what would overturn it:* an amendment to RI-VIS06 that interpolates the cap
across the confidence spread rather than stepping at 2; or a wave-2 re-run in which pair04's window
(the bare-ground crop that drew the only `medium`) returns a `high` answer in either direction, which
collapses the ambiguity entirely. I have not invented a threshold — I have applied the two the item
already states and said which one the evidence misses.

### S55, stated as the arithmetic the ruling was written to fix

**Five pairs ran, so the zero-runs clause does not fire at all.** Both its old and new numbers are
inert here. That is precisely why the counterfactual is worth writing down, and this verdict is the
first place in the project's history where it can be:

| scenario | pre-S55 text | post-S55 text (as amended today) | what actually happened |
|---|---|---|---|
| Zero Protocol A pairs run — **the state of every wave before today** | FIDELITY capped at **7** | FIDELITY capped at **2**, `status: FAIL` | n/a |
| Five pairs run, ours loses all five | cap **5** (outcome table) | cap **5** (unchanged) | **this** |

Read the top row against the wave-1 gate of **≥ 7.0** (`SCORING.md` §1, band 1). A cap of **7** lands
exactly on the pass line: a wave could decline to run the only place a human looks at a picture and
still pass at the bar, which is the defect S55 names — *"the guard was written with teeth and shipped
with none."* Under the amended clause the same absence costs **5 points and a hard fail**.

**So the honest statement of what this exercise bought.** It did not rescue the wave. It replaced an
absence — worth a free pass under the old text, worth a hard fail under the new one — with a
**measured** cap of 5. Five is still below 6, so RI-VIS06's own failure threshold blocks the wave via
the RI-VIS01 §E `min()` gate, and below 7.0, so it does not meet the wave-1 bar either. The
difference between a blocked wave that knows why and a blocked wave that does not is this document
and the four remedies in §3.

I read the amended clause as written and applied it as written: it is unconditional, it does not care
why the protocol did not run, and it is not split by cause. It simply does not fire, because the
protocol ran.

### Status

**FAIL.** Cap 5 < pass threshold 6; RI-VIS06 §Failure threshold: *"any cap below 6 blocks the wave."*
Exactly one biggest gap is named, per ARBITRATION §3, and per RI-VIS06 §Comparison method step 8 it
comes from the highest-confidence losing runs: of the four `high`-confidence losses, three named the
material-response gap as their single biggest. That is **GAP-W1-pbr-material-set-unbound**, and it
came from agents that could not see the label.

---

## 7. Where this leaves the next wave

The five §E record blocks are at `corpus/90-verdicts/w01-visual-blind.md`, which is the location
RI-VIS06 §E names and which did not exist before today. The pack, the key, the verbatim prompt, the
five judgements and both leak-check runs are under
`corpus/90-verdicts/wave1/artifacts/W1-VISUAL-BLIND-PROTOCOL-A-r1/` so that anyone can re-derive this
table from a fresh clone rather than taking it on trust.

The instrument now exists and has been fired once. Three things must happen before it fires again,
and none of them is a re-judge: counterbalance the side assignment (§1), run the judges in a context
with no project `CLAUDE.md` (D1), and rebuild pair02/pair03 against an in-focus plate (D3, and it is
a one-line edit). The fourth thing is the point of the whole exercise: **build R1, R2 and R3, and run
this again in wave 2 to find out whether they moved a judge that cannot see the label.**
