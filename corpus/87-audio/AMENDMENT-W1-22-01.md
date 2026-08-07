# AMENDMENT-W1-22-01 — three defects in `RI-AUD03` found by building to it and measuring

**Filed by:** W1-22 round 3 builder
**Against:** `RI-AUD03` §A (the "Level (rel. bed)" column), §C (the Q2 grading key), B5
**Status:** proposed. **Nothing in this file has been applied to any reference item, and no gate in
the build has been changed to match any of it.** Each item names what the build does *today*, which
in every case is the conservative reading.

Two of the three are contradictions I could not resolve by building harder, and I am referring them
rather than picking a side. The third is a factual error in the item's own table that I re-derived
from the table itself.

---

## A. The B2 judge's crest-factor bar and §A's level band cannot both be satisfied

### The two clauses

The RI-AUD03 B2 blind judge, reporting on the round-1 pack, found no discrete events in 21 minutes
of ambience and corroborated it with a statistic that does not depend on its own onset detector:

> crest factor spans only 10.0–17.4 dB across every clip, which is what steady noise measures; **a
> bed carrying one-shots measures well above 20.**

That is a sound heuristic about recordings of real places, and as a *diagnosis* it was correct — the
events really were buried, and finding them was round 2's main work. The difficulty is what happens
when it is promoted from a diagnosis to an acceptance bar.

`RI-AUD03` §A, the "Level (rel. bed)" column:

> | **L3 event** | … | −6 to +2 dB (may exceed the bed) | … |
> | **L4 creature** | … | −4 to +4 dB | … |

### Why they conflict, with the arithmetic

Crest factor of a clip is its peak over its RMS. Measured on this build at commit `bfa9e4a`, 180 s
× 20 beds × 2 time-of-day bands (`reports/w1-22/ambience-onsets.json`):

| quantity | measured |
|---|---|
| median crest of the bed **alone**, event layers muted | **12.3 dB** |
| median crest of the full mix, events at §A's levels | **16.2 dB** |
| clips reaching the judge's 20 dB | **3 of 40** (the highest is the Hive at 23.3) |

A filtered-noise bed has about 12 dB of crest on its own. To drag a clip's *peak-over-RMS* to 20 dB,
the loudest event has to peak roughly 20 dB above the bed's RMS. A short grain carries 6–10 dB of
its own peak-to-RMS within its envelope, so the event's *window* level has to sit near **+10 dB
relative to the bed**. §A caps L3 at **+2** and L4 at **+4**. **Reaching the judge's bar means
placing the events six to eight decibels outside the band the item specifies.**

This is not a defect in either clause on its own. §A's band is about a *mix*: an event that peaks
10 dB over the bed is a jump-scare, not a distant axe, and the item's own "How we lose" list is
alive to exactly that failure. The judge's heuristic is about *recordings*, where the bed is a real
room whose crest is far lower than synthesised filtered noise. Both are right about their own
subject and they do not compose.

### What the build does today, and what it does not do

`tools/analysis/ambience-onsets.mjs` gate O2 is written on a **within-bed control**: the same render
with the event layers muted, subtracted, so the question is *how much do the events lift the crest
of their own bed* rather than *what absolute number does the clip reach*. The bar is ≥3 dB; the
measured median is 4.7 dB. The absolute figure and the judge's 20 dB are **reported alongside it and
not gated**, so the tension stays visible in every run rather than being resolved by whoever last
edited the tool. That decision was round 2's and I have kept it.

I want to be plain that this is a workaround, not a resolution: the piece is currently measuring a
quantity neither the item nor the judge asked for, because the two things they did ask for are
incompatible.

### What I am NOT proposing

I am not proposing to widen §A's band, and I have not widened it. Six to eight decibels is a large
change to the character of a soundscape and it is not a builder's call to make in order to pass a
statistic.

### Proposed text, for whoever owns this to choose between

**Option 1 — the item states that the crest heuristic does not apply to a synthesised bed.** Add to
§C, after the pairwise-separation paragraph:

> **A note on crest factor.** A corroborating statistic sometimes offered for "nothing happens here"
> is that a bed carrying one-shots measures above 20 dB of crest. That threshold is calibrated on
> *recordings*, whose beds are rooms. A synthesised filtered-noise bed measures about 12 dB of crest
> on its own, and lifting a clip to 20 dB from there would require the event layers to sit 6–8 dB
> outside §A's own "Level (rel. bed)" band. **Where a bed is synthesised, the check is the
> within-bed control: render the same seed with the event layers muted and require the events to
> lift the crest of their own bed by ≥3 dB.** The absolute figure is reported, never gated.

**Option 2 — §A's band is widened, and says why.** Replace the two Level cells with `−6 to +8 dB`
(L3) and `−4 to +10 dB` (L4), and add a sentence to R-something saying the upper half of the band is
reserved for a region's single signature event so that a clip reads as a place where things happen.

**They should not both be taken.** Option 1 costs the item nothing and keeps the mix conservative;
option 2 changes what the game sounds like and should only be taken by someone willing to listen to
the result.

---

## B. §C's grading key has four duplicate triples, not one — and ten regions depend on Q3, not four

### The claim

> Note the key has **no duplicate triples** except (wet, open, living), shared by four coastal/
> rootland regions — those four are separated by Q3 instead (bell buoy / hide-drum / oars /
> lichen-scream), which is why R7's positional emitters and each region's signature L3 are
> load-bearing rather than decorative.

### It is false, and the item's own table proves it

Tabulating §C's thirteen rows by their triple:

| Triple | Regions | Count |
|---|---|---|
| (wet, open, living) | Western Rootlands, Eastern Rootlands, Marauder's Coast, Crimson Coast | **4** |
| (dry, open, living) | The Salt Hills, The Clay Moor | **2** |
| (dry, enclosed, living) | The Hive, The Stone Forest | **2** |
| (dry, open, dead) | Valus Ridge, Stone Wastes | **2** |
| (dry, enclosed, dead) | Thornmarsh | 1 |
| (wet, enclosed, living) | Blackwood | 1 |
| (wet, enclosed, dead) | The Deep Marshes | 1 |

Thirteen regions, **seven** distinct triples. Four groups are duplicated, not one. **Ten of the
thirteen regions share their triple with at least one other region**, so Q2 alone can separate at
most seven of thirteen, and the load the item places on Q3 is two and a half times what it says.

(The round-2 builder found the (dry, open, living) pair and recorded it. The other two —
Hive/Stone Forest and Valus Ridge/Stone Wastes — appear to be new here. Valus Ridge and Stone
Wastes is the sharpest of them, because §B builds the Stone Wastes' dying Hist as *the Stone
Forest's chord broken*, so the pair that Q2 cannot separate is also the pair the sound design
deliberately made similar — and Stone Wastes shares its triple with Valus Ridge while sharing its
instrument with Stone Forest.)

### Why it matters rather than being a typo

The sentence is the item's stated justification for R7 and for the signature L3s being
"load-bearing rather than decorative". That justification is *stronger* than the item claims, and a
piece reading the item to decide where to spend effort would under-invest by a factor of two and a
half. It also affects how a B2 pack should be stratified: a hard stratum built on "the four
(wet, open, living) regions" leaves out six regions that are equally undecidable on Q2.

### Proposed replacement text

> Note the key has **seven distinct triples across thirteen regions**, so ten regions share a triple
> with at least one other: (wet, open, living) is shared by four coastal/rootland regions;
> (dry, open, living) by The Salt Hills and The Clay Moor; (dry, enclosed, living) by The Hive and
> The Stone Forest; and (dry, open, dead) by Valus Ridge and the Stone Wastes. Q2 can therefore
> separate at most seven of the thirteen on its own, and **the remaining ten are separated by Q3** —
> the bell buoy, the hide-drum, the oars, the lichen-scream, the legion horn, the kiln roar, the
> Hive's flattening chord and the Stone Wastes' broken Hist. This is why R7's positional emitters
> and each region's signature L3 are load-bearing rather than decorative, and it is why a blind
> pack's hard stratum must be drawn from all four duplicate groups and not only the first.

---

## C. B5 does not say where the listener is standing, and the answer moves a bed by 7 dB

### The clause

> **B5** — integrated LUFS over each clip must be −28..−24 (Stone Wastes exempt at −34 ±2).

### The gap

§C now requires the blind clip to contain the R7 emitters — the grading key separates regions by the
bell buoy and the hide-drum, so a clip without them cannot be answered. But an emitter's contribution
is by construction a function of **where the listener is standing**: R7's rolloff is inverse-distance
clamped at `ref_m` and cut to silence past `audible_m`. So "the integrated loudness of the clip" is
not a property of the bed until the listener's position is fixed, and B5 does not fix it.

This is not hypothetical. Measured on this build, The Clay Moor's kiln is a continuous emitter with
`audible_m` 520 and `ref_m` 45:

| capture | LUFS-I |
|---|---|
| bed alone, no landmarks | **−31.8** |
| listener at the region centroid, kiln in earshot | **−24.7** |

**Seven decibels, same bed, same seed, same second.** Two instruments in this project disagreed by
exactly that amount for a whole round — `ambience-render.mjs` teleports the player into the region
before capturing and saw −24.7; the round-1 critic's probe captures without teleporting, from 3.1 km
away, and saw −31.8 — and the disagreement was carried in a handoff as a regression that had to be
recalibrated away. It was not a regression. The two tools were measuring different quantities, both
of which B5's sentence admits.

### What the build does today

`bed_gain_db` is now calibrated and gated on the bed **without** landmarks, and
`ambience-render.mjs` reports `lufs_i_with_emitters` beside it so the emitter's contribution is
visible rather than baked in. The reasoning is that R7's whole content is that its level depends on
where you stand, which makes it B6's subject and not B5's. Note that this reading makes The Clay
Moor **fail** where the ambiguous one passed; it was not chosen because it was the comfortable
answer, and it needed a real recalibration to satisfy.

### Proposed replacement text

> **B5** — integrated LUFS over each clip must be −28..−24 (Stone Wastes exempt at −34 ±2).
> **The clip for B5 is the bed alone: L1, L2, L3 and L4 with no R7 emitter placed.** An emitter's
> level is a function of the listener's distance and bearing (R7), so a clip containing one has no
> loudness independent of where the listener was put, and B5 would be a check on the probe's
> camera rather than on the mix. The emitters are gated by B6, which is written for exactly that.
> §C's blind clip is a different capture and **does** contain the emitters, because the grading key
> separates regions by them.

---

## Provenance

Every figure above was measured on this tree and is stamped. §A's arithmetic and §C's tabulation are
re-derivable from the item alone. The Clay Moor figures are from
`reports/w1-22/ambience-render.json` and `reports/w1-22/critic-probe-r3.json`; the crest figures
from `reports/w1-22/ambience-onsets.json` at commit `bfa9e4a`, 180 s × 20 beds × 2 tod.
