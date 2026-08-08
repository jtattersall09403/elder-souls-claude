# Pre-registration — written BEFORE the reveal was opened

Judge `judge-prose-r5`. All fifteen `tNN-*.md` answer files existed and were hashed before this
file was written, and this file was written before `prose-tics-r5.reveal/` was opened.

## 1. My blind PROV picks, in order

t01 **B**, t02 **A**, t03 **A**, t04 **B**, t05 **A**, t06 **A**, t07 **A**, t08 **B**,
t09 **A**, t10 **A**, t11 **B**, t12 **A**, t13 **B**, t14 **A**, t15 **B**

## 2. My blind QUAL picks, in order

t01 **A**, t02 **B**, t03 **A**, t04 **A**, t05 **B**, t06 **B**, t07 **B**, t08 **A**,
t09 **B**, t10 **B**, t11 **A**, t12 **B**, t13 **A**, t14 **B**, t15 **A**

PROV and QUAL disagree on **14 of 15** trials. They agree only on t03, where I judge the
sermon-like passage both the shipped one and the better piece of writing.

## 3. Confidence, honestly stated

I was **voice-matching, not judging**, from roughly trial 4 onward. I recognised one side's
idiolect in t01–t02 and thereafter each trial cost me about one sentence. Per-trial confidence
is therefore not independent: I claim **high confidence on one discrimination**, repeated 15
times, plus register-specific confirmation in each of the three strata.

The correct baseline is the pack's own: **one author per side, ~3 effective trials, a clean
sweep is about 1-in-8 (p≈0.125)**, not 1-in-32768. By guessing I would expect **7.5 of 15**
trials right and would have about a **12.5%** chance of sweeping. Any number below is to be
quoted with that beside it.

## 4. LEAK HYPOTHESIS — pre-declared, so it can be scored rather than remembered favourably

The gate's battery is (per RI-MTH03 §M1a) ~40 **aggregate statistics** — counts, ratios,
densities, profiles. My hypothesis is that r5 leaks through a channel of a different *shape*:
the **presence of a discrete extraction artifact**, which is invisible to any density.

**Rule L-COMPOSITE (no domain knowledge, no reading):** pick the side that contains any of

1. an **empty substitution slot** — a clause ending in `, ?` or ` .` where a variable was
   (`"Do you have a question for me, ?"`, `"Hello again, ."`);
2. a **double-hyphen `--`** used as a dash;
3. **any sentence repeated verbatim two or more times** in the same file.

**Pre-declared prediction.** L-COMPOSITE fires on exactly 6 of 15 trials and picks:

| trial | L-COMPOSITE | which of the three fired |
|---|---|---|
| t01 | **B** | `--` |
| t07 | **A** | verbatim repeat |
| t08 | **B** | `--` + verbatim repeat |
| t09 | **A** | empty slot + verbatim repeat |
| t10 | **A** | empty slot + `--` + verbatim repeat |
| t11 | **B** | verbatim repeat |
| the other 9 | abstains | — |

**It agrees with my own PROV pick on all six.** If the reveal confirms those six, then six of
fifteen trials in this pack are decidable by three regexes with no reading, and the honest
reading is *6/6 on the trials it fires, 0 wrong, abstains on 9* — not a sweep, but not clean
either. The three regexes are cheap to run and none of them is a density.

**Why the gate would not have caught it.** `paren_density`, `uppercase_ratio`, `digit_ratio`,
`chars`, `mean_word_len` etc. all average over the whole file; two occurrences of `--` in an
8,000-character file move no ratio detectably, and "is this exact sentence present three times"
is not a statistic at all. A battery of ratios cannot see a *token*.

**Secondary hypothesis, weaker.** Mid-text lacunae left by the masker — a decapitated word
(`"ods are commonly judged"` for *Gods*, `"he Haeth Mour"` for *The …*), an orphaned article
(`"He finds the annoying, clinging, and vapid"`), a broken clause (`"Thi my own conjecture"`).
I saw these on **t01 B, t05 A, t09 A, t10 A, t14 A** and on no other file. Prediction: **all
five are the same side**, i.e. the masker damages one corpus and not the other. My automated
lacuna probe only catches the t05 case, so this one is judged by eye and I flag it as such.

**Third hypothesis, weakest and offered to be shot down.** `gold` as a bare currency noun fires
A-side on t06, t07, t10 and both-sides on t01. Prediction: those three are the same side.

## 5. What I predict the reveal says about the two axes

If my picks are right, `PROV:` is at ceiling and `QUAL:` is at floor — a judge who can name the
shipped side every time and prefers the *other* side 14 times. Under RI-MTH03 §C.1 that
combination is a leak detector reading positive: it says the blinding is not holding on
provenance while saying something quite separate and more useful about the writing.
