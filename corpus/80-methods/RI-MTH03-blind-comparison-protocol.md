---
id: RI-MTH03
title: The blind-comparison protocol
kind: structure
side: neutral
judges: [process.critic.discipline, process.verdict.format, visual.fidelity, visual.artdirection, dialogue.prose, quests.structure, combat.feel]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Whenever a reference item is marked `blind_pair: yes`, the critic forms its judgement
**before** it knows which artifact is ours. The pack is assembled mechanically, labels are
stripped mechanically, the A/B assignment is randomised from a recorded seed, the reveal
key is written outside the pack directory, and the pick is committed to a file before the
key is opened. This exists because an LLM critic shown "our screenshot vs Elden Ring"
grades the relationship, not the artifact: it hedges toward the thing it was told is ours,
finds charitable framings, and produces a verdict that is a politeness artifact. Blinding
removes the option. The protocol also produces a second, sharper signal for free: **if the
critic picks ours, distrust the critic** (CORPUS-CONTRACT §6) — either the reference was
badly chosen, the stripping leaked, or the critic is not discriminating, and all three are
findings worth more than the original comparison.

## The reference artifact

### A. The pack, as produced by `tools/blind/make-pair.mjs`

```
packs/p1/                       ← everything the judge sees
  A.png                         stripped artifact
  B.png                         stripped artifact
  PROMPT.md                     the judge prompt (below)
  pack.json                     kind, question, hashes of A and B, pack id.
                                Contains NO mapping.
packs/p1.reveal/                ← never inside the pack; held by the operator
  mapping.json                  {"seed":7,"A":"ours","B":"reference",
                                 "ours_source":"…","ref_source":"…","…_sha256":"…"}
```

### B. Stripping rules by artifact kind (implemented, not aspirational)

| Kind | What is removed | Mechanism |
|---|---|---|
| `image` | all PNG metadata/text chunks; filename | decode + re-encode through `pngjs`; pixels byte-identical, chunks gone |
| `trace` | header and footer lines; any key matching the identifying set | JSONL filtered and re-serialised |
| `json` | keys matching `run_id, scenario, path, file, url, build, git, commit, branch, tool, node, data, started_at, ended_at, computed_at, captured_at, source, label, name, title, author, origin, side, provenance` | recursive key filter |
| `text` | phrases matching `elder souls, our game/build/implementation, reference, morrowind, dark souls, elden ring, claude, wave N, run_id, commit <sha>` | regex → `[REDACTED]` |

Both sides go through the **same** stripping path, so the transformation cannot itself be
a tell. Re-encoding images through one encoder also normalises file size as a channel.

### C. The judge prompt (verbatim, emitted into every pack)

> You are judging two artifacts. You do **not** know which is which, and you must not try
> to find out. One of them was produced by the project under review; the other is a
> reference. Guessing based on file size, formatting quirks, or metadata is cheating —
> judge the content.
>
> **How to answer.** Write your answer to a file before anyone reveals the mapping:
> 1. `PICK: A` or `PICK: B` — one line, nothing else on it.
> 2. `CONFIDENCE: high | medium | low`
> 3. Three to six bullet points of **specific, checkable evidence** (pixel regions, frame
>    numbers, quoted lines, field values). No general impressions.
> 4. `WEAKEST POINT:` one sentence naming the strongest argument *against* your own pick.
>
> Do not hedge, do not decline, do not say the two are equivalent.

### D. Default questions by kind

| Kind | Question |
|---|---|
| image (fidelity) | Which image looks like a current-generation, commercially shipped 3D game, and which looks like a hobby WebGL demo? Name the three specific visual properties that decided it. |
| image (art direction) | Which world looks like it was designed by someone with a point of view, and which looks like assets placed on a heightmap? |
| trace | Which combat trace reads like a Souls fight — committed attacks, telegraphed windups, stamina as a real constraint, distance being negotiated — and which reads like naive chase-and-swing? Cite frame ranges. |
| json / text (dialogue) | Which set of lines was written by a game writer for a shipped RPG, and which is placeholder? Quote the lines that decided it. |
| json (quest) | Which quest could be finished in more than one way by a player who never drew a weapon? Cite stage and outcome ids. |

### E. The scored outcome table

| Blind pick | Reveal | Meaning | Consequence |
|---|---|---|---|
| Reference | — | expected; we are behind | normal scoring, gap recorded |
| Ours | — | either we are genuinely ahead, or the critic is not discriminating | **mandatory second pass with a harsher lens**, recorded in the verdict; the item's score is capped at "meets the bar", never "exceeds" |
| "Equivalent" / refusal | — | protocol violation | verdict **void**; re-run with a critic instructed per §C |
| Correct pick but no cited evidence | — | unfalsifiable | verdict **void**; evidence bullets are mandatory |

## Comparison method

**M1 — Build the pack.**

```bash
node tools/blind/make-pair.mjs \
  --ours reports/runs/<runId>/shots/VP01-vista-wide.png \
  --ref  corpus/70-visual/refs/<reference>.png \
  --out  reports/packs/<item>-<n> \
  --item RI-VIS01 --seed <recorded>
```

Verify the pack directory contains only `A.*`, `B.*`, `PROMPT.md`, `pack.json`, and that
the reveal directory is a sibling, not a child.

**M2 — Judge blind.** Hand a fresh agent — one with no access to this conversation and no
knowledge of which side is which — the pack directory and `PROMPT.md` only. It writes
`answer.md` into the pack directory. The agent must not be given the run manifest, the
corpus item, or any path outside the pack.

**M3 — Commit before reveal.** `answer.md` must exist and contain a `PICK:` line before
anyone reads `mapping.json`. The critic records the SHA-256 of `answer.md` in its verdict,
so the ordering claim is checkable after the fact.

**M4 — Reveal and record.** Open `mapping.json`. The verdict records, at minimum:

```
pack_id, item, seed, blind_pick, confidence, reveal(A/B → ours/reference),
outcome ∈ {picked-reference, picked-ours, void}, answer_sha256, evidence bullets
```

**M5 — Second pass when we win.** If the blind pick is ours, re-run M2 with a *different*
fresh agent and this added instruction: *"Assume one of these was made by an amateur in a
weekend. Find the evidence for that hypothesis in each artifact and say which one supports
it more strongly."* Both passes go in the verdict.

**M6 — Leak audit (once per wave, not per pack).** Take one pack, and ask a fresh agent:
*"Without judging quality, can you tell which of these two files came from a different
pipeline? What is the tell?"* If it can — consistent JSON key ordering, float precision,
a resolution difference, a compression signature — the stripping rules have a hole and
must be amended before any blind result from that wave is trusted.

## Scoring

This item scores the **protocol**, not the artifacts. Per pack:

| Check | Points |
|---|---|
| Pack built by `make-pair.mjs` (not hand-assembled) | 2 |
| Reveal key outside the pack directory | 2 |
| `answer.md` written before reveal, hash recorded | 3 |
| Pick is A or B, no hedging, no refusal | 2 |
| ≥ 3 specific, checkable evidence bullets | 2 |
| `WEAKEST POINT` present and non-trivial | 1 |
| Reveal outcome recorded in the verdict | 2 |
| Second pass performed when the pick was ours | 2 (n/a → excluded from denominator) |
| Leak audit performed once this wave | 2 (per wave, not per pack) |

| % of applicable points | Verdict |
|---|---|
| 100 | Meets the bar |
| 75–99 | Below bar — the blind result is admissible but the process defect is recorded |
| < 75 | **The blind result is inadmissible**; the item it served falls back to non-blind scoring and the verdict says so |

**Hard fails, independent of score:**

- The judging agent had access to the mapping, the run manifest, or file paths outside the
  pack. The result is void — not discounted, void.
- The pack was assembled by hand with labels "removed by eye".
- A critic reports a blind result for an item whose front-matter says `blind_pair: no`.
- The verdict reports the blind pick but not the reveal, or vice versa.

## How we lose

1. **The critic peeks.** The single most likely failure: an agent with filesystem access
   reads `../pack.reveal/mapping.json`, or infers from the run directory path it was
   handed. Mitigation is structural — hand over the pack directory and nothing else — and
   M3's hash-before-reveal makes the claim auditable rather than trusted.
2. **Metadata leak.** Our PNGs come from Playwright, the reference from a screenshot tool;
   different chunk sets, different sizes. Solved by re-encoding both through the same
   encoder, which is why `make-pair.mjs` decodes and re-writes even when it does not have
   to.
3. **Resolution/aspect leak.** Our shots are exactly 1920×1080; a reference screenshot is
   2560×1440. The judge learns nothing about quality and everything about provenance. Any
   image reference must be resampled to the contract resolution *before* it enters a pack.
4. **Style leak in text.** Our generated dialogue has a consistent tic (em-dashes, a fixed
   sentence rhythm) that a competent judge recognises immediately as machine-made. That is
   a *legitimate* finding about our writing, not a protocol defect — but it must be
   recorded as such rather than being read as "the reference is better at plot".
5. **The reference is too strong.** Comparing a first-wave WebGL scene against an Elden
   Ring capture yields a correct, useless verdict. The reference must be chosen at the
   *next rung*, not the top of the ladder, or the comparison teaches nothing.
6. **The reference is too weak** so we "win", the caps in §E get applied, and the wave
   wastes a cycle on a second pass that finds nothing.
7. **Hedging.** "Both have merits; A is stronger in lighting while B is stronger in
   composition." This is a refusal in a suit and the protocol treats it as void.
8. **Evidence-free correctness.** The judge picks right and writes "B looks more
   professional". Unfalsifiable, uncheckable, and useless to the builder who has to fix it.
9. **Pack reuse across waves.** The same seed and the same pair are used again, and a
   critic that has seen the pack before "remembers" the answer. Pack ids are timestamped
   and seeds recorded so repeats are detectable.
10. **Blinding the wrong axis.** Judging art direction against a modern AAA capture, or
    fidelity against a 2002 screenshot. That is an ARBITRATION §4 hard error and no amount
    of protocol hygiene saves it.

## Provenance note

`provenance: constructed`. The protocol, the stripping rules, the outcome table and the
point weights are **defined for this project**. `tools/blind/make-pair.mjs` implements all
of it and has been exercised on this machine for both `image` and `trace` kinds: packs
were produced, the reveal key landed in a sibling directory, and the PNG re-encode path
was confirmed to preserve pixels while dropping metadata.

The underlying idea is ordinary blinded-assessment methodology (A/B testing, blind taste
tests, double-blind review) adapted to LLM critics; the specific adaptation that matters
here — *if the critic picks ours, distrust the critic* — comes from CORPUS-CONTRACT §6 and
is this project's own rule, not a borrowed one.
