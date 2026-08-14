# Protocol A, wave 1 — the five judge returns, verbatim

**Collected by the orchestrator, 2026-08-14, and recorded here unedited.** Do not clean these up, do
not re-ask a judge whose answer you dislike, and do not paraphrase them into the verdict — RI-VIS06's
comparison method step 4 says capture the answer exactly as returned.

## How they were run, stated so the verdict can be honest about its own instrument

**Five separate fresh agent contexts, one per pair.** Each was given exactly two things: the absolute
paths of `A.png` and `B.png` for its pair, and the verbatim prompt from
`reports/blind/protocol-a-w1/PROMPT-A-verbatim.txt`. Each was instructed to read only those two files,
to search nothing, to run nothing, and to reply with the answer block and nothing else. All five
complied with the format on the first attempt; none was re-asked; none mentioned the setting, so
RI-VIS06's prompt-leak discard condition did not trigger on any of them.

**No judge was told which side was ours, and the orchestrator did not read the sealed key before or
during collection.** `reports/blind/protocol-a-w1-SEALED-KEY/` was listed (filenames only) to confirm
it existed; no `.reveal` file and no `pairing.json` was opened.

### The contamination that could not be removed, named rather than hidden

**A judge agent in this repository inherits the project's `CLAUDE.md`**, which describes the project as
a game in development. There is no way to spawn a subagent without it. So the judges were *not* naive
about the existence of an in-development game, and RI-VIS06 §A's requirement that the judge be given
"no indication that one image is from an in-development game" was **not fully met**. This must be
recorded in the verdict as a protocol deviation.

**What it does and does not compromise, argued rather than waved away.** The blinding that carries the
result is *which arm is ours*, and that survives: `CLAUDE.md` names no image, the crops are
subject-neutral 512×512 at native resolution, metadata is stripped, both arms passed the seven-way
leak check, and nothing in the inherited context distinguishes A from B on any pair. The residual risk
is a **bias in direction, not in identification** — a judge who knows a game is being built might be
charitable toward whichever image looks like a game build, which would flatter our side and bias
*against* finding a gap. That direction matters: it is the safe direction for a backstop whose job is
to catch us being too pleased with ourselves. A verdict that finds our side losing is therefore
*strengthened* by this deviation, not weakened by it. A verdict that finds our side winning would be
weakened by it and should be treated with suspicion.

**Owed remedy, for whoever runs Protocol A next:** run the judges from a working directory with no
project `CLAUDE.md` in scope, and record that the context was clean. Until that is done, every Protocol
A verdict carries this deviation.

---

## pair01

```
WINNER: A
CONFIDENCE: high
SINGLE BIGGEST GAP: B lacks any material response separation — every surface reads as flat diffuse albedo with no specular, roughness variation, or normal-mapped relief, so thatch, plaster, stone and grass all respond to light identically.
SECOND GAP: B has no readable shadowing — no contact shadows where walls and the bridge meet the ground and no ambient occlusion in the eaves, leaving forms floating against an unmodulated dark ground plane whose lower half is crushed to near-black with no recoverable detail.
WHAT THE LOSER DOES BETTER: B holds clean, stable silhouette edges and legible depth staging into the distance, whereas A is smeared by heavy blur that destroys fine texture and edge definition at the top of the frame.
```

## pair02

```
WINNER: A
CONFIDENCE: high
SINGLE BIGGEST GAP: B has no shadowing or ambient occlusion at all — no contact darkening where the wooden step meets the ground or path, so the surfaces read as unlit flat planes rather than solids in a lit scene.
SECOND GAP: B lacks any depth cue or contrast attenuation, with the same crisp uniform texture treatment from foreground to distance, whereas A varies focus and tone with distance.
WHAT THE LOSER DOES BETTER: B keeps cleaner, less noisy silhouette edges along the plank boundaries and shows no compression-style mottling in its mid-tones.
```

## pair03

```
WINNER: B
CONFIDENCE: high
SINGLE BIGGEST GAP: A has no surface texture or normal detail — every wall, roof and ground plane is a flat untextured color wash, so albedo/roughness/normal maps need to be authored and bound to those materials.
SECOND GAP: A's shadowed regions are crushed to a near-uniform black with no bounced or ambient fill, so an ambient/GI term with tone-mapped shadow lift is needed to keep detail readable in shade.
WHAT THE LOSER DOES BETTER: A holds cleaner, sharper silhouette edges on its geometry, where B is uniformly soft and blurred with almost no crisp edge anywhere.
```

## pair04

```
WINNER: A
CONFIDENCE: medium
SINGLE BIGGEST GAP: B has no geometry or props at all above the ground plane — it needs actual scene content (vegetation, rocks, structures) casting and receiving light rather than a bare terrain sheet.
SECOND GAP: B lacks any surface-level texture breakup or normal-mapped detail response, so the ground reads as a single flat noise wash with no contact shadow or occlusion anywhere.
WHAT THE LOSER DOES BETTER: B has a cleaner, smoother tonal gradient across the ground with no crawling or aliased edges, and its horizon band gives a mild sense of depth falloff that A's uniformly dark frame does not.
```

## pair05

```
WINNER: A
CONFIDENCE: high
SINGLE BIGGEST GAP: B has no surface texture or normal-mapped material detail — the ground, foliage and stone are flat untextured fills that all respond to light identically, so a proper albedo/normal/roughness texture set is what needs turning on.
SECOND GAP: B lacks any real shadowing or contact occlusion — trees, slabs and the horizon cast nothing and the whole frame sits in one uniform low-contrast ambient wash, whereas A shows directional falloff, contact darkening and readable detail inside the shadows.
WHAT THE LOSER DOES BETTER: B does establish genuine atmospheric depth, with distance-attenuated contrast and haze separating the far treeline from the foreground, while A's background is largely a dark, undifferentiated blur.
```

---

## Two things the verdict must check, and one it must resist

**Positional bias.** Raw winners are **A, A, B, A, A** — four A to one B. Chunk 1 recorded that the
coin flips also came out **4:1**, and explicitly declined to reseed for a prettier split on the grounds
that adjusting an instrument after looking at it is how instruments die. That is the right call and it
leaves a specific job here: **cross the winners against the sealed key and check whether the 4:1 in
answers is the 4:1 in the key, or independent of it.** If they coincide, the judges are tracking the
key rather than the side, and the result is strong; if the winners are 4:1 toward the *letter* A
regardless of which side A is, that is positional bias and the pairs must be re-run with the sides
swapped before any of this counts.

**Whether the losing image is the same side every time.** Read the gap text, not just the winner. Four
of five gap descriptions name the same cluster on the loser — no material response separation, no
contact shadow or ambient occlusion, flat untextured fills, everything responding to light
identically. pair03's winner is the other letter but its gap text describes *the same defect*. If that
cluster lands on one side consistently, the five pairs are one finding repeated, not five findings.

**What to resist.** Do not let "the loser does better" lines soften the verdict into a draw. Three of
them name blur, softness or noise on the *winner*, which is a real observation about the reference
plates — chunk 1 recorded that pair02 and pair03's reference windows sit in background bokeh, and that
this biases **against** the reference and can only flatter us. The forced choice is the measurement;
the consolation line is context.
