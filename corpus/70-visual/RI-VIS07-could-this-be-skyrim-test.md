---
id: RI-VIS07
title: The "could this be Skyrim?" test — the art-direction failure detector
kind: text
side: morrowind
judges: [visual.artdirection.mood, visual.artdirection.silhouette, visual.artdirection.palette, visual.artdirection.architecture, visual.artdirection.flora, visual.artdirection.creature]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SIDE DECLARATION: this item is `morrowind`.**
> Cited **only** under `JUDGEMENT SIDE: ART_DIRECTION` (RI-VIS01 §B).
> **This item REFUSES modern-fidelity references and refuses to be affected by them.** No
> RI-VIS03 metric may raise or lower a result here, and a high fidelity score is explicitly
> **not** a mitigation: *"it fails the Skyrim test but the lighting is excellent"* is CC-4 and
> voids the verdict. A perfectly rendered generic fantasy swamp fails this test at 10/10
> fidelity. That is the intended behaviour.
>
> The word "Skyrim" appears throughout this file as the name of the *failure*, not as a
> reference. It is not cited as an image, a target, or a bar. Using a Skyrim screenshot as a
> reference in this item is forbidden — the test needs no image at all.

## The bar

Show a stranger a still frame from our game with no context, no UI, no title, and ask them
what game it is. If the answer names an existing game, or names a genre ("generic fantasy",
"a medieval RPG", "some Souls-like"), **art direction has failed for that frame, at any
fidelity level, with no appeal.**

This is the outermost check in the visual area and the cheapest. RI-VIS05 measures whether we
followed our own specification; this measures whether following it actually produced a world
nobody has seen. A build can pass every palette threshold and every silhouette rule and still
read as Skyrim's Hjaalmarch, because specifications are checked element-by-element and
recognisability is a property of the whole frame. This test is the only instrument that
catches that.

It is named for Skyrim because Skyrim is the specific gravity well this project falls into:
same publisher's franchise, same engine-shaped conventions, a marsh region already exists in
it, and every asset library on Earth is full of Nordic-medieval-fantasy content. "Could this
be Skyrim?" is the question the failure will actually look like.

## The reference artifact

### §A — The protocol

**Judge:** a **fresh agent context**, one per frame, no prior turn from this project. It must
not be told the setting, the franchise, the developer, the genre, or that this is an
in-development game. It must not have read any other VIS item. A judge that has seen RI-VIS05
knows the answer and is disqualified.

**Stimulus:** one 1920×1080 PNG capture, no UI, no debug overlay, no watermark, filename
`frame.png`, metadata stripped, in a temp directory whose path contains no project name.

**The exact prompt (verbatim; do not paraphrase, do not add, do not soften):**

```
Look at this screenshot from a video game.

Answer these questions. Guess even when unsure — "I don't know" is only
acceptable for question 1, and only if you genuinely cannot narrow it down.

1. What game is this?
2. If you don't know the game, what setting or genre is it? Name something
   specific.
3. Name three other games this could plausibly be a screenshot from.
4. In one sentence, describe the place shown, as if telling someone where
   you had been.
5. Is there anything in this image you have never seen in another game?
   If yes, describe it in one sentence. If no, say "no".

Answer in exactly this format:

GAME: <name, or "don't know">
SETTING/GENRE: <specific>
COULD ALSO BE: <game 1>, <game 2>, <game 3>
THE PLACE: <one sentence>
NEVER SEEN BEFORE: <one sentence, or "no">
```

**Runs:** every exterior and interior capture in the wave's fixed set — minimum
`exterior_marsh_noon`, `exterior_marsh_dusk`, `interior_rootway`, `xanmeer_vista`,
`foliage_dense`. Five frames, five fresh judges, no judge sees two frames.

**No re-asking.** One shot per frame. A judge whose output is malformed may be re-asked once
with the format block alone; a judge whose *answer* we dislike may not be re-asked at all.
Re-asking for a better answer is judge-shopping (RI-VIS06 §Scoring) and voids the wave's
art-direction verdict.

### §B — The answer key

The test grades **question 1 and question 2 together**, with questions 3–5 as corroboration.

**FAIL — any of these as the `GAME` or `SETTING/GENRE` answer:**

| Answer class | Examples |
|---|---|
| Names an existing game | "Skyrim", "Oblivion", "Elden Ring", "The Witcher 3", "Valheim", "Dark Souls", "Kingdom Come", "Enshrouded", "Avowed", "Baldur's Gate 3", "Skyrim with mods", "an Elder Scrolls game" |
| Names a generic fantasy genre | "generic fantasy", "medieval fantasy", "high fantasy", "a fantasy RPG", "a Souls-like", "a survival crafting game", "an open-world fantasy game" |
| Names a real-world place with no qualification | "a Louisiana bayou", "a European forest", "the Everglades", "a Scottish moor" |
| Names a familiar fantasy trope location | "an elven forest", "a dwarven ruin", "a haunted swamp", "a goblin camp", "a wizard's tower" |

Note that "an Elder Scrolls game" is a **fail**, not a pass, and this is deliberate and
important. Morrowind's achievement was that it did not look like the rest of its own
franchise. If our frame reads as generically Elder Scrolls, we have inherited the franchise's
average rather than its outlier, which is the exact thing the whole project is built to avoid.

**PASS — the acceptable answers:**

| Answer class | Examples |
|---|---|
| Genuine non-recognition | `GAME: don't know` **and** a `SETTING/GENRE` that is descriptive rather than categorical: "some kind of alien wetland", "a swamp civilisation I don't recognise", "a fungal/organic world" |
| Names Morrowind or an Argonian/Black Marsh setting | "Morrowind", "a Morrowind-like game", "Black Marsh", "Argonian lands", "TES: Morrowind's expansion" — **this is the target answer.** It means the transposition landed: the judge recognised the *lineage* without recognising the *place*. |
| Names the strangeness explicitly | "somewhere biological", "a world built out of trees and shells", "not medieval — something older and organic" |
| Describes rather than categorises | any `SETTING/GENRE` that has to be described because no existing label fits |

**Corroboration signals (do not decide the result on their own, but escalate or rescue it):**

| Signal | Meaning |
|---|---|
| `NEVER SEEN BEFORE: no` | **Escalates a marginal pass to a fail.** If nothing in the frame is novel, the frame is generic even if the judge could not name the game. |
| `NEVER SEEN BEFORE` names an element that is in RI-VIS05's vocabulary (a root cage, a chitin hall, a gilled cypress, the xanmeer's orthogonality) | **Strong pass.** The art direction is doing the work it was designed to do, and we can name which element carried the frame. |
| `NEVER SEEN BEFORE` names something we did not design (a bug, a rendering artefact, a mis-scaled asset) | Not a pass. Record it as a defect. |
| `COULD ALSO BE` lists three games in the same family | Even with `GAME: don't know`, three same-family guesses means the frame sits inside a known space. **Escalates to fail** if all three are Nordic/medieval fantasy. |
| `COULD ALSO BE` lists three wildly unrelated games | Good signal: the frame does not sit in a known space. |
| `THE PLACE` sentence uses only familiar nouns ("a swamp with ruins and trees") | Weak. |
| `THE PLACE` sentence needs invented or qualified nouns ("a flooded stepped pyramid overgrown with something between a mushroom and a tree") | Strong. |

### §C — Per-frame result and the wave roll-up

Each frame yields one of:

| Result | Condition |
|---|---|
| **HARD FAIL** | `GAME` names an existing non-Morrowind game, **or** `SETTING/GENRE` is a generic fantasy category |
| **FAIL** | `GAME: don't know` but `NEVER SEEN BEFORE: no`, or all three `COULD ALSO BE` entries are same-family |
| **PASS** | `GAME: don't know` with a descriptive setting and a `NEVER SEEN BEFORE` naming a designed element |
| **STRONG PASS** | `GAME` names Morrowind / Black Marsh / Argonian, **or** PASS with `THE PLACE` requiring qualified nouns |

**Wave roll-up:** the wave's Skyrim-test result is the **worst** result across the five
frames, not the average. One frame reading as Skyrim means the game reads as Skyrim, because
players do not average their first impressions.

### §D — The interpretation table (what a fail tells the builder)

A fail is not just a verdict; it points at the element that caused it. The judge's `THE PLACE`
sentence and `COULD ALSO BE` list are diagnostic:

| If the judge said… | The element that failed | Remedy in RI-VIS05 |
|---|---|---|
| "a swamp", "a marsh", "a bayou" with no qualifier | Flora is Earth flora; nothing is a hybrid | §D2/§D3 — at least one inexplicable plant per exterior |
| "ruins", "an old temple", "a stone fort" | Architecture is generic; xanmeer orthogonality isn't reading as alien | §E stepped-orthogonal; check §F forbidden forms |
| "a village", "a settlement" | Fen village is huts-on-a-street, not stilted-lashed multi-level | §E stilted lashed |
| "medieval", "a fantasy RPG" | Silhouettes are all `UNASSIGNED`; nothing breaks the skyline strangely | §E silhouette density rule |
| "green and brown" or the palette is described as ordinary | The green trap | §C palette, `ForbiddenHits` |
| "lizard people", "lizard-men" | Creature design is the cliché | §D4 — naga must not read as "a bigger lizard-man" |
| Names Skyrim specifically | Nordic/medieval assets have entered the project | §F forbidden forms sweep; audit asset sources |
| "Elden Ring", "a Souls-like" | Combat framing and enemy silhouettes are leaking Souls' *visual* language | Souls owns the fight's **mechanics** (ARBITRATION §1), never its art; this is a genuine seam failure and belongs in the verdict as such |

That last row matters. ARBITRATION §1 gives Souls authority inside the fight over frames,
stamina, hitboxes and AI — it gives Souls **no visual authority whatsoever**. Dark Souls'
look (grey ruined cathedrals, knights in plate, ash and rust) is generic-fantasy for our
purposes and is on the RI-VIS05 §F forbidden list like anything else. A frame that reads as
"a Souls-like" fails this test exactly as hard as one that reads as Skyrim.

## Comparison method

1. Emit the RI-VIS01 §B declaration, `JUDGEMENT SIDE: ART_DIRECTION`, property `P06` (plus
   whichever of P01–P05, P07 the diagnostic table implicates).
2. For each of the five fixed frames: strip metadata, copy to a neutral temp path as
   `frame.png`, spawn a fresh judge with the §A prompt verbatim, capture the answer exactly.
   ```bash
   for s in exterior_marsh_noon exterior_marsh_dusk interior_rootway xanmeer_vista foliage_dense; do
     d=$(mktemp -d); cp shots/w$W/$s.png $d/frame.png
     pngcrush -rem alla -q $d/frame.png $d/f2.png && mv $d/f2.png $d/frame.png
     # spawn fresh judge with corpus/70-visual/RI-VIS07 §A prompt + $d/frame.png
   done
   ```
   The runner asserts the judge context is empty of project material before sending.
3. Grade each answer against §B. Record the raw answer verbatim in the verdict — the answer
   text is the artefact, and a paraphrased answer is not admissible.
4. Roll up per §C (worst frame wins).
5. For every FAIL / HARD FAIL, use §D to name the responsible element and the RI-VIS05 remedy.
   This becomes a candidate for the wave's single named biggest gap (ARBITRATION §3).
6. Do **not** look at RI-VIS03 metrics or RI-VIS02 references at any point in this procedure.
   If the frame is beautiful, that is irrelevant here and saying so is CC-4.

## Scoring

This test does not produce a score of its own; it produces a **cap** on the ART score from
RI-VIS05, and the caps are severe by design.

| Wave roll-up (worst frame) | Effect on ART score |
|---|---|
| STRONG PASS | no cap |
| PASS | cap 8 |
| FAIL | cap 5 |
| HARD FAIL | **cap 2** |

**Failure threshold: HARD FAIL blocks the wave** via RI-VIS01 §E `min(ART, FIDELITY) ≥ 6`.

**Explicit non-mitigations.** None of the following may raise a cap, and asserting any of them
is CC-3/CC-4 and voids the verdict:
- a high fidelity score
- "the frame we tested was an unfinished area"  → then it should not have been captured; the
  capture set is fixed by name and a wave that cannot fill it is not ready to be judged
- "the judge was being lazy" → judges are fresh and the prompt is fixed; if you believe the
  instrument is broken, amend the instrument by ruling, not this run
- "it reads as Skyrim but that's just the lighting" → lighting is F03, on the other side of
  the bifurcation, and cannot cause a setting to be recognised. If the *lighting* made a judge
  say Skyrim, then the palette and silhouettes were not distinctive enough to override it,
  which is the fail.
- "players will know the setting from context" → the test exists precisely because the first
  screenshot anyone sees has no context.

**What we lose looks like:**
```
frame: exterior_marsh_noon
GAME: Skyrim
SETTING/GENRE: medieval fantasy, a marshland region
COULD ALSO BE: Oblivion, Valheim, Enshrouded
THE PLACE: a foggy swamp with ruined stone towers and dead trees
NEVER SEEN BEFORE: no
=> HARD FAIL. ART capped at 2. Ship gate blocked.
Diagnosis (§D): "ruined stone towers" -> architecture generic; "dead trees" ->
flora is Earth flora; "no" -> nothing novel in frame at all.
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | FAIL roll-up on the worst frame (caps the ART score at 5) | n/a — the roll-up is four-valued and has no rung between FAIL and PASS | PASS roll-up on the worst frame (caps the ART score at 8); STRONG PASS imposes no cap |

**Aggregation (a property of this item, not of the critic):** cap, not score — this item MODIFIES RI-VIS05's ART score and contributes no ladder number of its own. HARD FAIL caps at 2 and blocks the wave. See SCORING.md §1.2's gate-and-cap clause.

## How we lose

- **We pass this test in wave 1 and never run it again.** Early builds are grey boxes and grey
  boxes are unrecognisable, so the test passes trivially. As real assets land — and real
  assets are the ones that come from libraries and from familiar references — recognisability
  climbs. The test must run every wave, and its result in wave 1 means nothing.
- **The judge is not fresh.** Somebody runs it in the same context that just wrote the art
  direction spec. The judge answers "Black Marsh" because it read the file, and we record a
  STRONG PASS for a frame that is pure generic fantasy. This is the single most likely way
  this item produces a false pass.
- **The prompt gets softened.** "What game is this?" becomes "does this look distinctive?"
  and every judge says yes. The prompt is verbatim in §A for exactly this reason; a
  paraphrased prompt voids the run.
- **The unfinished-area excuse.** Every failing frame is declared not-representative. Guard:
  the five frames are fixed by name and are the same five every wave.
- **We accept "an Elder Scrolls game" as a pass** because it sounds like a compliment. It is
  a fail. Inheriting the franchise average is the failure mode; inheriting its outlier is the
  goal.
- **Souls' art leaks in under the Arbitration Rule.** Someone reads "inside the fight, Souls
  wins" as licence for grey cathedrals, plate knights and ash. ARBITRATION §1 grants Souls
  mechanical authority only. Detection: `COULD ALSO BE` fills with Souls titles, or `GAME:
  Elden Ring`. Damage: the fight looks like every other Souls-like and the world it sits in
  stops being ours.
- **The test fails, we agree it fails, and nothing changes** because the diagnosis is "the
  art direction needs work". §D exists so that a fail always names one element and one
  RI-VIS05 section. A fail without a §D row is an incomplete verdict.
- **The frames are chosen to pass.** Someone captures the one beautiful bioluminescent tunnel
  five times. Guard: five *different* fixed frames, three of them exteriors, and exteriors are
  where the failure lives.

## Provenance note

`provenance: constructed`, `confidence: high`.

The test is authored for this project. Its logic is inherited from ARBITRATION §4 (art
direction is judged against Morrowind) and from the observation, which is the whole premise of
the corpus, that Morrowind's defining property is that it did not look like anything else —
including the rest of its own franchise. The prompt text, the §B answer key, the §C roll-up
rule, the §D diagnostic mapping and the §Scoring caps are all ours and have no upstream source.

**Untested at authoring time.** No judge has been run against this prompt. Two things are
likely to need correction after first use:
1. **The five-question format may be too long** and judges may drift out of it. If so, amend
   the prompt here (keeping it verbatim-quotable) rather than improvising at run time.
2. **Question 5 ("never seen before") may be too generous** — an agentic judge may reach for
   novelty to be helpful and name something trivially novel. If early runs show question 5
   passing frames that questions 1–3 clearly fail, tighten it to require the novel element to
   be *structural* (a building, a plant, a creature) rather than incidental (a colour, a
   lighting effect).

The `GAME: don't know` pass condition carries a known risk that is worth stating: modern
judges are good at recognising games, so a `don't know` may indicate an unrecognisable frame
for the *wrong* reason — a grey blockout, an unreadable dark frame, a broken render. The
corroboration signals in §B (especially `NEVER SEEN BEFORE: no` escalating a pass to a fail)
exist to catch this, and a `don't know` on a frame that also hard-fails RI-VIS03's M8 should
be read as "unrecognisable because unfinished", not as an art-direction success. That
cross-check is the one place a critic may *note* the other side's result — it may not use it
to raise a score, only to refuse to award one.
