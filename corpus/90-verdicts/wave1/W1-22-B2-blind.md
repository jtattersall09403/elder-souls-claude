# W1-22 B2 blind judgement — region ambience SAME/DIFFERENT. **32/32. Separation 1.0000, false-different rate 0.0000.**

**Judge:** `judge-audio-b2`, fresh and blind. **Pack:** `w1-22-b2-78aebc7`, 32 trials, seed `22071`,
built `2026-08-07T18:29:48Z` at commit `78aebc7` (dirty). **HEAD at judging:** `72baa12` (dirty).
**Answers committed before reveal:** `reports/w1-22-critic/b2/answer.md`,
sha256 `fc40b46e6051d0574d066e76f329a8bd8dcff352116113bc20b8c55269ba734d`, at `2026-08-07T18:49:20Z`.
**Procedure pre-registered before the trial data was read:** sha256 `59e49482efb20dd1455a03451ae4053376b446964cc79cb2bc703a6eefe04bac`.

> **Every region in this game sounds clearly different from every other one — and nothing ever
> happens in any of them.** Across all 64 recordings in the pack, 21 minutes and 20 seconds of
> ambience, the pack's onset detector found **zero** discrete sound events. Not one bird, drip,
> gust or creak. Crest factor spans only **10.0–17.4 dB** across every clip, which is what steady
> noise measures; a bed carrying one-shot events measures well above 20. Each region is a single
> unchanging hum, and the only thing that separates one place from the next is the colour of that
> hum and how wide it sits in the stereo field.

> **And the second finding is about the pack, not the game.** I scored 32/32, which under
> CORPUS-CONTRACT §6 is a reason to distrust the judge rather than to celebrate. The reason is
> that the task as instrumented is not hard: same-place pairs differ by **0.14–0.95 dB** mean
> across the spectrum and different-place pairs by **4.39–35.76 dB**, with nothing in between. A
> plain cosine threshold set anywhere in a very wide range scores the same 32/32. The tool's own
> docstring claims it is *"stronger than a cosine threshold, because a judge decides."* On this
> data that claim does not hold: the judge added nothing the front-end had not already decided.

---

## 1. The result

| Measure | Bar | Observed | Result |
|---|---|---|---|
| Overall accuracy | — | **32 / 32 = 1.0000** | — |
| `separation` (correct DIFFERENT / all DIFFERENT) | RI-AUD03 B2 | **24 / 24 = 1.0000** | — |
| `false_different_rate` (SAME called DIFFERENT / all SAME) | ≤ 0.25 (JUDGE.md) | **0 / 8 = 0.0000** | **admissible** |
| `hard` stratum (the 12 globally closest region pairs) | — | **12 / 12** | — |
| `random` stratum | — | **12 / 12** | — |
| `catch` stratum (SAME controls) | — | **8 / 8** | — |
| Trials scored unanswerable | — | **0** | — |

No trial was hedged, declined or left blank. No trial was unanswerable.

## 2. The procedure, stated before I started

Written to disk and hashed before `trials.json` was opened. Full text in the artifact; in summary:

A SAME pair is one place rendered twice at two capture seeds, so it shares its **stationary
spectral character** but not its **event timing**. That fixes which fields are discriminators:

- **Use:** the 24 band levels, the spectral centroid, the stereo correlation, the crest factor.
- **Do not use:** the transient-onset list. Onsets are seed-driven, so scoring on them would
  systematically call SAME pairs DIFFERENT. (As it turned out this was moot — see §4.)

Statistic: `mad_dB` = mean |A − B| over the 24 band levels; `dcent` = fractional centroid shift.
**Rule, fixed in advance: SAME iff `mad_dB < 1.5` and `dcent < 0.05`, else DIFFERENT.** Grounding:
1.5 dB mean deviation across a 24-band spectrum with the spectral centre inside 5% is the size of
re-roll noise, not of a different bed.

**The class balance was deliberately not used.** It leaked — see §5 — and a rank-based rule
("call the 8 closest SAME") would have exploited the leak rather than answered blind. The absolute
threshold is independent of how many of each there are.

## 3. Why the threshold placement did not matter

The pre-registered threshold of 1.5 dB landed in the middle of an empty gap.

| Metric | SAME pairs (n=8) | DIFFERENT pairs (n=24) | Gap |
|---|---|---|---|
| `mad_dB`, mean band difference (my pre-registered metric) | 0.14 – **0.95** | **4.39** – 35.76 | **4.6×** |
| Cosine distance on linear band power (independent check) | 0.00001 – **0.00105** | **0.15185** – 0.89745 | **145×** |
| The pack's own `proxy_distance` (seen only after reveal) | 0.0000 – **0.0010** | **0.1659** – 0.3896 | **166×** |

Any threshold between 1.0 and 4.3 dB yields the identical partition, so the answer cannot have been
tuned. Two metrics chosen independently — mine before the reveal, the pack's own after — produce
the **same 8-trial SAME set**: `T02 T04 T12 T17 T19 T21 T25 T30`.

A structural check made blind also landed: clustering the 24 distinct band-vectors at cosine < 0.01
recovered **13 acoustic identities, 11 present at both capture seeds and 2 at one**. The reveal
confirms exactly 13 regions, 11 at both seeds and 2 at one, and C(13,2) = 78 pairs — the "78 pairs"
the tool's docstring names.

## 4. What the differences actually were, in plain words

**The regions are told apart entirely by tone colour and stereo width. Nothing else varies.**

The 13 beds sort into four families by where their energy sits:

| Family | Spectral centre | What it would sound like | Count |
|---|---|---|---|
| Deep rumble | 112, 133 Hz | subsonic rumble with the treble essentially gone — high bands sit 57–59 dB below the loudest | 2 |
| Low hum | 327, 350, 514, 588 Hz | a low hum with some upper body | 4 |
| Mid-weighted | 1493, 1870, 1925 Hz | broad, mid-forward | 3 |
| Bright / hissy | 2112, 2280, 2842, 3469 Hz | treble-dominant hiss | 4 |

The second axis is stereo width, and it is **wildly inconsistent**: correlation runs from `0.001`
(fully decorrelated, wide) to `0.999` (effectively mono). **7 of the 24 clips sit above 0.989** —
those regions have no stereo image at all, while others are fully wide. Nothing suggests this is a
designed contrast; it reads as beds built to different rules.

**What is missing is events.** `transient_onsets` is empty for **all 64 recordings**. This is the
single most consequential observation in the pack, and it is corroborated by a detector-free
statistic: crest factor never exceeds **17.4 dB** anywhere. A steady filtered-noise drone measures
10–13 dB; a bed with discrete one-shots over it measures above 20. The two agree. What a player
would experience is that walking from one region to another changes the colour of the hum — a real,
noticeable transition — but standing still anywhere for twenty seconds, **nothing occurs**.

This also explains why the SAME controls were so easy. If a bed is pure filtered noise with no
event layer, a different capture seed can only reroll the noise phase, so the spectrum is
essentially unchanged — hence same-place pairs agreeing to 0.14 dB. **The catch trials are correct
in design and weak in force**, because the thing they vary barely varies.

### Were any two regions indistinguishable?

**No.** The closest distinct pair in the game is **T22**, the two deep-rumble beds at 116 and
131 Hz: 4.39 dB mean difference, 9.2 dB at the worst band (97–121 Hz), pack proxy distance 0.1659.
Because the `hard` stratum is by construction the 12 globally closest of the 78 region pairs, that
0.1659 is the **global minimum over the whole game** — and it is still 166× further apart than the
largest same-place re-roll. Every region is separable.

The honest qualification: T22's two beds are separable but are plainly **the same kind of place** —
both a subsonic rumble with the treble gone. They differ in degree, not in character. If two regions
in this game are meant to feel unlike each other, these two are the pair that does not.

## 5. Leak audit — three the author missed, one they closed correctly

RI-MTH03 M6 run independently. The pack's `leak_audit` field records one leak found and closed by
the author (un-normalised clip loudness). That fix is **sound**, and better than claimed:

- **Verified clean.** `loudness_lufs` is the constant `-23.0` in all 64 recordings. More than that,
  I checked every remaining field algebraically and **all of them are level-invariant by
  construction** — `crest_factor_db` is peak/RMS, the band levels are relative to the clip's own
  loudest band, the centroid derives from normalised bands, and stereo correlation and onset rise
  are ratios. The loudness channel is genuinely closed, not merely blanked in one field.

Three the author did not catch:

1. **The class balance is disclosed inside the pack.** `reports/w1-22-critic/b2/JUDGE.md` sits in
   the pack directory and states *"`separation` over the 24 DIFFERENT trials, and
   `false_different_rate` over the 8 SAME trials."* `PROMPT.md`, in the same directory, promises
   *"You are not told how many of each."* **The pack contradicts its own prompt.** RI-MTH03 §A
   specifies the pack contains the artifacts, `PROMPT.md` and `pack.json`; operator notes belong in
   the reveal sibling. Any judge that lists the directory sees the answer's shape.
2. **The balance is also recoverable from the builder.** `tools/blind/audio-pack-b2.mjs` hardcodes
   `hard = all.slice(0, 12)`, `picked.length < 12` and `catchRegions.length < 8`. A judge asked to
   audit the builder for leaks — as this one was — reads the class balance out of the source as an
   unavoidable side effect of the audit.
3. **The builder prints the strata's separation to stdout.** Lines 249–250 log the catch-pair
   proxy distances and the hard-stratum distances at build time. Anyone who builds the pack and
   reads the console is handed the exact numeric boundary between SAME and DIFFERENT — which
   calibrates a threshold perfectly. These belong in the reveal directory, not on the terminal.

**Did the leaks change my answer? No, and this is checkable.** I never ran the builder, so leak 3
never reached me. Leaks 1 and 2 gave me the count, which I declared in advance I would not use; and
because the pre-registered threshold sits inside a 4.6× empty gap, no count information could have
moved any trial across it. The absolute rule and a count-constrained rule return the identical
partition here, so the leak is real but inert **on this pack**. It would not be inert on a harder one.

## 6. Pack integrity defect — the declared hash does not match the pack

`pack.json` declares `trials_sha256: 3ab1e3b84faebdf821d62a1627d16e72a40644e99792922d981b11e343c7c768`.
Recomputing it over `trials.json` the way the builder does gives
`14684a7c7203ff06f8d547ab715c88e846da7d8c886f44ad2032063f94c90749`. **They do not match.**

The cause is identifiable. `trials.json` contains the literal token `-23.0` **64 times** — a form
`JSON.stringify` cannot emit, since it renders that value as `-23`. The pretty-printed round trip is
exactly **128 bytes shorter** than the file on disk: 64 recordings × 2 characters. `mapping.json` is
timestamped `18:29` while `trials.json` and `pack.json` are `18:31`. Together these establish that
**the pack was built once and then text-substituted in place** rather than rebuilt — a cheap fix for
the loudness leak that avoided a second browser run, but one that leaves the pack's declared
integrity hash describing the original leaky build.

Consequence: **the blinding is intact** (I verified mechanically that no loudness variance survives)
but **RI-MTH03 M3's auditability claim is broken for this pack** — the recorded hash can no longer
be used to prove the trials a judge saw are the trials the builder made. My own answer hash is
unaffected and does carry that guarantee.

## 7. The seven-step unblinding order does not exist

My brief describes "a seven-step unblinding order". **There is no such order recorded anywhere** —
not in the pack, not in `b2.reveal/` (which contains only `mapping.json`), not in the builder, and
not in RI-MTH03. The only recorded order is `JUDGE.md`'s three steps, and RI-MTH03 M3's hash
requirement. I followed those: hand the judge `PROMPT.md` + `trials.json` only → write `answer.md` →
hash it → then and only then open `../b2.reveal/mapping.json`. I am reporting the discrepancy rather
than inventing a seven-step sequence to have complied with.

## 8. RI-MTH03 protocol score for this pack

| Check | Points | Awarded |
|---|---|---|
| Pack built by a tool, not hand-assembled | 2 | **1** — tool-built, then hand-edited post-build (§6) |
| Reveal key outside the pack directory | 2 | **2** — `b2.reveal/` is a sibling |
| `answer.md` written before reveal, hash recorded | 3 | **3** |
| Answer is SAME or DIFFERENT, no hedging, no refusal | 2 | **2** — 32/32 answered |
| ≥ 3 specific, checkable evidence items | 2 | **2** — every trial line carries numbers |
| `WEAKEST POINT` present and non-trivial | 1 | **1** — §9 |
| Reveal outcome recorded | 2 | **2** |
| Second pass when the pick was ours | n/a | excluded — no "ours" side in a SAME/DIFFERENT design |
| Leak audit performed | 2 | **2** — author's, plus this independent one (§5) |
| **Total** | **16** | **15 = 93.75%** |

**Band: 75–99% → below bar; the blind result is admissible and the process defect is recorded.**
The defect is §6, and it is the hand-edit, not the blinding.

## 9. Weakest point

**The strongest argument against my own result is that it is too good to be informative.** 32/32
with a 166× margin does not demonstrate that a judge can tell these regions apart; it demonstrates
that the pack's DSP front-end already separated them before I saw anything, and that I read off the
gap. If RI-AUD03 B2 exists to answer *"can a player tell these places apart?"*, this pack cannot
answer it, because the thing a player actually discriminates on — events, dynamics, motion,
musical character — is precisely the thing §4 shows is absent, and the pack measures the one
channel the system does implement. **A pack that scores 1.0000 on its first outing should be made
harder before its number is cited**, and the obvious way is to stop comparing whole-region beds and
start comparing a region against itself at different times of day, or against a neighbouring region
after both are loudness- and spectrum-matched.

The secondary weakness: my SAME/DIFFERENT rule is a spectral-stationarity rule, and it would fail
exactly where the game is currently silent — two places sharing a bed but differing in their event
layer would read as SAME to me and DIFFERENT to a player. That failure mode is unobservable here
only because there is no event layer to differ in.

---

**Method deviations.** Two analysis scripts written for this judgement, declared per TOOL-LOOP:
`analyse.mjs` (per-trial band statistics, degeneracy and float-precision leak audit, alternative-metric
sensitivity check) and `mkanswer.mjs` (emits `answer.md` so every trial's stated reason carries its
real numbers). Both read only `reports/w1-22-critic/b2/trials.json`. **No browser was launched and
no clip was rendered** — the pack already existed, and `pgrep -c headless_shell` read **30** with
loadavg **20.28** at start and **12.35** at finish, far above the protocol's cap of ~8. Re-rendering
would have been both wasteful and, under that load, unreliable. No timing figure is reported here,
so contention does not affect any number above; all figures are ratios, counts and levels computed
from a frozen artifact.

**Quarantine.** I did not read `corpus/90-verdicts/wave1/W1-22-r1.md`, `orchestration/status/W1-22.json`,
`orchestration/status/critic-w1-22.json`, any `RI-AUD*` item, or any file under `game/data/`. I read
`AGENT-PROTOCOL.md`, `RI-MTH03`, `tools/blind/audio-pack-b2.mjs`, the four files in the pack directory,
and — after hashing my answers — `b2.reveal/mapping.json`. Region identities were recovered
structurally from the reveal and are not named here; I have no knowledge of what any region is
supposed to sound like.
