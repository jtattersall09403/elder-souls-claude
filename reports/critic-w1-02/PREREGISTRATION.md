# Pre-registration — RI-WLD12 M68 blind judgement, W1-02 round-1 critic

Written **before any frame in `reports/wld12-blind/` was opened** and before `KEY.json` existed on
disk in a complete form. Hashed; the hash is quoted in the verdict so the ordering is checkable.

## 1. What I am answering

RI-WLD12 M68, verbatim: *"Show each unlabeled to a fresh judge: 'is this one place or two? If two,
point at what told you.'"*

- **PASS:** ≥ 80% answered "two" **AND** ≥ 70% name an object or a landform, not a colour.
- **FAIL:** ≥ 25% answer "one", **or** the most common named cue across the whole set is fog or colour.

This is a **quality/perception** question about the border, not a provenance question about the
build. I am not asked which image is ours — there is no reference side in this design, so RI-MTH03
§E's "picked ours → second pass" row is **n/a** and RI-MTH03's `PICK: A/B` format does not apply.
The governing protocol for the *question* is RI-WLD12 M68; RI-MTH03 governs the *hygiene*
(shuffle, key outside the pack, answer hashed before reveal, leak audit).

## 2. I did not build this pack

`tools/world/wld12-blind-pack.mjs` was written and run by the W1-02 builder (pid 3888, started
20:44 today). I did not write it, did not run it, and did not choose the shot list, the seed or the
crossover points. RULES.md rule 25.

## 3. Declared contamination, and how I neutralise it

**I read `tools/world/wld12-blind-pack.mjs` in full before judging.** I had to: the leak audit is
mine and RI-MTH03 M6 cannot be done without reading the builder. Reading it told me three things a
clean-room judge would not know, and I declare all three:

1. Frames come in **pairs** — each border contributes an `across` and an `along` shot from the same
   x,z at the same hour. So the 48 frames are 24 near-duplicate pairs.
2. The order is a **Fisher–Yates shuffle on seed `0xb11d`**, re-derivable from the source.
3. The **scoring rule**, including which answers fail.

Item 3 is the dangerous one and it is also disclosed to any judge by `QUESTION.md` itself. My guard,
fixed here in advance:

- I write the cue as **free text, naming whatever actually decided the frame**, before any
  classification. If colour or fog is what told me, I write colour or fog. I will not substitute an
  object I can also see for the cue that actually decided me.
- Classification into `{object, landform, flora, colour/fog/light, none}` happens **after** all 48
  free-text cues are written, mechanically, from the noun I wrote first.
- I will not use the pair structure (item 1) to reconcile two frames of one border into one answer.
  Each frame is answered on its own.

## 4. The decision rule, fixed in advance

Per frame, independently:

- **"two"** iff I can point to a **spatially localised** discontinuity in the frame — a place where
  the left/near part of the image is made of different stuff from the right/far part: two different
  ground materials meeting, two different plant populations, a built object standing on a line, a
  landform edge. A frame that is uniform, or that varies only smoothly and globally, is **"one"**.
- **"one"** if the frame shows a single continuous kind of place, however pretty.
- A frame that is blank, black, or shows nothing but sky/water with no ground detail is recorded as
  **`unusable`** and reported separately in the denominator rather than silently counted as either.
  (W1-02's own round-2 notes record that two border frames came back a wall of canopy and were
  non-blank by every pixel statistic. A pixel statistic is not a check — I look at the frame.)

**Cue classification:**

| Class | Counts toward the ≥70% bar |
|---|---|
| `object` — a built thing: cairn, gibbet, pole, gate, tripod, slag, bone line, marker | **yes** |
| `landform` — ridge, shore, water edge, cliff, treeline as a *form* | **yes** |
| `flora` — a change in the plant population | **no** (M68 says "an object or a landform") |
| `colour/fog/light` — a tint, a grade, a fog bank, a light change | **no**, and it is the named failure |
| `none` | no |

`flora` is deliberately scored **against** us. M68's pass clause names only "an object or a
landform"; RI-WLD12's failure clause names only fog and colour. Flora falls in the gap, and I
resolve the gap strictly rather than charitably, and report the lenient number alongside so a reader
can see the effect of the choice.

## 5. Order of operations (RI-MTH03 M3)

1. This file written and hashed.
2. Every frame looked at. Free-text cue + verdict written to `ANSWERS.json`.
3. `ANSWERS.json` hashed; both hashes recorded in the verdict.
4. **Only then** `KEY.json` opened.

If `KEY.json` is opened before step 3 for any reason, the comparison is void and the verdict says so.

## 6. What would make me report the result inadmissible

- The pack is incomplete (fewer frames than borders × 2) — reported, and the denominator is what
  actually shipped, stated as such.
- `KEY.json` sits inside the pack directory rather than as a sibling (RI-MTH03 §A). **I already know
  from the source that it does.** This is a protocol defect I will score under RI-MTH03, and it does
  not void the result because I commit my answers before opening it and publish the hash.
- Frames are not 1920×1080 as M68 specifies. **I already know from the source they are 1280×720.**
  Recorded as a declared deviation, not a void.
