# Wave 1 — blind visual runs (RI-VIS06 §E record blocks)

**This file is the location RI-VIS06 §E names**: *"all runs for a wave are appended to
`corpus/90-verdicts/wNN-visual-blind.md`"*. It holds the record block for every blind visual run in
wave 1, and nothing else. The analysis, the cross-tabulation, the scoring and the deviations live in
`corpus/90-verdicts/wave1/W1-VISUAL-BLIND-PROTOCOL-A-r1.md`, which is the verdict.

Protocol B (art direction) has not been run in wave 1. When it is, its blocks are appended below
these, by a different agent — RI-VIS06's side declaration forbids one agent running both.

Judge answers are reproduced verbatim from
`corpus/90-verdicts/wave1/artifacts/W1-VISUAL-BLIND-PROTOCOL-A-r1/judgements/JUDGEMENTS-r1.md`.
The key was read only after all five answers were on disk; the ordering evidence and its limits are
in the verdict, §"Read-after-write".

---

```
BLIND RUN  wave 01  protocol A  pair 01
  ours: char-player__t0800__clear.png (crop 512x512 @ 300,150) — RTX A4500, 1920x1080, seed 20260814
  ref : REF-ER steam-dyules-2764143924.jpg (crop 512x512 @ 100,100)
  key : protocol-a-w1-SEALED-KEY/pair01.reveal/mapping.json   (A=reference, B=ours)  seed 20260814
  judge: fresh agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: high
  SINGLE BIGGEST GAP: "B lacks any material response separation — every surface reads as flat
    diffuse albedo with no specular, roughness variation, or normal-mapped relief, so thatch,
    plaster, stone and grass all respond to light identically."
  SECOND GAP: "B has no readable shadowing — no contact shadows where walls and the bridge meet
    the ground and no ambient occlusion in the eaves, leaving forms floating against an
    unmodulated dark ground plane whose lower half is crushed to near-black with no recoverable
    detail."
  WHAT THE LOSER DOES BETTER: "B holds clean, stable silhouette edges and legible depth staging
    into the distance, whereas A is smeared by heavy blur that destroys fine texture and edge
    definition at the top of the frame."
  REVEAL: A was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  ACTION: single biggest gap -> R1 (bind a PBR material set); second gap -> R2/R3
```

```
BLIND RUN  wave 01  protocol A  pair 02
  ours: char-player__t1300__clear.png (crop 512x512 @ 150,480)
  ref : REF-ER steam-dyules-2764130815.jpg (crop 512x512 @ 1408,300)
  key : protocol-a-w1-SEALED-KEY/pair02.reveal/mapping.json   (A=reference, B=ours)  seed 20260815
  judge: fresh agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: high
  SINGLE BIGGEST GAP: "B has no shadowing or ambient occlusion at all — no contact darkening
    where the wooden step meets the ground or path, so the surfaces read as unlit flat planes
    rather than solids in a lit scene."
  SECOND GAP: "B lacks any depth cue or contrast attenuation, with the same crisp uniform texture
    treatment from foreground to distance, whereas A varies focus and tone with distance."
  WHAT THE LOSER DOES BETTER: "B keeps cleaner, less noisy silhouette edges along the plank
    boundaries and shows no compression-style mottling in its mid-tones."
  REVEAL: A was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  CONFOUND ON THIS PAIR: the reference window is out-of-focus background bokeh (chunk 1 finding 9).
    It biases AGAINST the reference on texture/edges, and it MANUFACTURES the second gap's
    "A varies focus with distance". Discount the second gap; the first stands.
  ACTION: single biggest gap -> R2 (contact shadows + AO)
```

```
BLIND RUN  wave 01  protocol A  pair 03
  ours: char-npc__t1300__clear.png (crop 512x512 @ 1100,150)
  ref : REF-ER steam-dyules-2764130857.jpg (crop 512x512 @ 1408,0)
  key : protocol-a-w1-SEALED-KEY/pair03.reveal/mapping.json   (A=ours, B=reference)  seed 20260816
  judge: fresh agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: B
  CONFIDENCE: high
  SINGLE BIGGEST GAP: "A has no surface texture or normal detail — every wall, roof and ground
    plane is a flat untextured color wash, so albedo/roughness/normal maps need to be authored
    and bound to those materials."
  SECOND GAP: "A's shadowed regions are crushed to a near-uniform black with no bounced or
    ambient fill, so an ambient/GI term with tone-mapped shadow lift is needed to keep detail
    readable in shade."
  WHAT THE LOSER DOES BETTER: "A holds cleaner, sharper silhouette edges on its geometry, where
    B is uniformly soft and blurred with almost no crisp edge anywhere."
  REVEAL: B was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  NOTE: this is the ONLY pair on which ours sat on letter A, and it is the only pair on which the
    judge answered B. It is the single trial that discriminates positional bias from side-tracking,
    and it discriminated. See the verdict's cross-tabulation.
  CONFOUND ON THIS PAIR: the reference window is out-of-focus background bokeh (chunk 1 finding 9),
    biasing AGAINST the reference. Ours still lost.
  ACTION: single biggest gap -> R1 (bind a PBR material set); second gap -> R3 (ambient/GI fill)
```

```
BLIND RUN  wave 01  protocol A  pair 04
  ours: char-npc__t0800__clear.png (crop 512x512 @ 150,480)
  ref : REF-ER steam-dyules-2764067220.jpg (crop 512x512 @ 1350,540)
  key : protocol-a-w1-SEALED-KEY/pair04.reveal/mapping.json   (A=reference, B=ours)  seed 20260817
  judge: fresh agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: medium
  SINGLE BIGGEST GAP: "B has no geometry or props at all above the ground plane — it needs actual
    scene content (vegetation, rocks, structures) casting and receiving light rather than a bare
    terrain sheet."
  SECOND GAP: "B lacks any surface-level texture breakup or normal-mapped detail response, so the
    ground reads as a single flat noise wash with no contact shadow or occlusion anywhere."
  WHAT THE LOSER DOES BETTER: "B has a cleaner, smoother tonal gradient across the ground with no
    crawling or aliased edges, and its horizon band gives a mild sense of depth falloff that A's
    uniformly dark frame does not."
  REVEAL: A was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  NOTE: the only `medium` confidence in the set, and the only run whose biggest gap is about scene
    CONTENT rather than shading. Its window is a bare ground crop on our side.
  ACTION: single biggest gap -> R4 (ground-plane dressing); second gap -> R1/R2
```

```
BLIND RUN  wave 01  protocol A  pair 05
  ours: char-player__t1930__clear.png (crop 512x512 @ 1100,150)
  ref : REF-W3 steam-1902321246.jpg (crop 512x512 @ 1350,540)
  key : protocol-a-w1-SEALED-KEY/pair05.reveal/mapping.json   (A=reference, B=ours)  seed 20260818
  judge: fresh agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: high
  SINGLE BIGGEST GAP: "B has no surface texture or normal-mapped material detail — the ground,
    foliage and stone are flat untextured fills that all respond to light identically, so a proper
    albedo/normal/roughness texture set is what needs turning on."
  SECOND GAP: "B lacks any real shadowing or contact occlusion — trees, slabs and the horizon cast
    nothing and the whole frame sits in one uniform low-contrast ambient wash, whereas A shows
    directional falloff, contact darkening and readable detail inside the shadows."
  WHAT THE LOSER DOES BETTER: "B does establish genuine atmospheric depth, with
    distance-attenuated contrast and haze separating the far treeline from the foreground, while
    A's background is largely a dark, undifferentiated blur."
  REVEAL: A was the reference. Ours lost. Expected.
  ESCALATION: not required (ours lost)
  DEVIATION ON THIS PAIR: subject scale differs — ours is a mid-distance dusk walkway, the plate is
    a near-field material close-up under lamplight. Recorded in pairing.json rather than
    substituted; the corpus holds no 1920x1080 low-light plate at mid-distance exterior scale.
  ACTION: single biggest gap -> R1 (bind a PBR material set); second gap -> R2/R3
```

---

**Tally: ours 0, reference 5.** Escalation not triggered on any pair, because RI-VIS06 §C fires only
when ours wins. Confidence spread: four `high`, one `medium`.

---

## Round 2 — 2026-08-15, after F1 (materials), F2 (contact shadows/AO), F3 (ambient fill) landed

Pack built by the `I3` Protocol A round-2 pack-builder
(`orchestration/status/I3-PROTOCOL-A-RERUN.json`), counterbalanced sides (ours on A for pairs
01/03/05, B for pairs 02/04, fixed before any image was opened) and an active byte-length
equalisation (F2 in that file). Judged by five fresh Opus agent contexts. Decoded and reported in
`orchestration/status/I3-PROTOCOL-A-R2-RESULT.json`, which is the source for these blocks.

**No `JUDGEMENTS-r2.md` file was produced for this round**, unlike round 1. The per-pair `SINGLE
BIGGEST GAP` / `SECOND GAP` / `WHAT THE LOSER DOES BETTER` lines below are therefore **not
available split by pair** — only the aggregate synthesis across all five judges is on record. Each
block below states this rather than inventing a per-pair attribution. The verdict at
`corpus/90-verdicts/wave1/W1-VISUAL-BLIND-PROTOCOL-A-r2.{json,md}` records the same limitation.

```
BLIND RUN  wave 01  protocol A  pair 01  (round 2)
  ours: one of the six r2 capture setups (char-npc/char-player x 08:00/13:00/19:30, RTX A4500,
    1920x1080, seed 20260814) — the pair-to-capture-slot mapping is in the sealed pairing-r2.json
    and is not opened by this record, per this round's brief.
  ref : one of the same reference-plate population as round 1 (4x Elden Ring, 1x The Witcher 3);
    plate-to-pair mapping likewise sealed.
  key : W1-VISUAL-BLIND-PROTOCOL-A-r2/SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pair01.reveal/mapping.json
    (A=ours, B=reference) — counterbalanced plan, not a free coin flip
  judge: fresh Opus agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: B
  CONFIDENCE: not separable by pair in the source (aggregate spread for the round: 4 high, 1 medium)
  GAP TEXT: not separable by pair — see the round's aggregate synthesis below the last block.
  REVEAL: B was the reference. Ours lost.
  ESCALATION: not required (ours lost)
  ACTION: aggregate gaps -> GAP-W1-visual-fix-not-reaching-blind-frames (diagnosis, ranked above new
    visual work) and the still-open GAP-W1-pbr-material-set-unbound
```

```
BLIND RUN  wave 01  protocol A  pair 02  (round 2)
  ours: one of the six r2 capture setups — pairing sealed, not opened by this record.
  ref : one of the round-1 reference-plate population — pairing sealed, not opened by this record.
  key : W1-VISUAL-BLIND-PROTOCOL-A-r2/SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pair02.reveal/mapping.json
    (A=reference, B=ours) — counterbalanced plan
  judge: fresh Opus agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: not separable by pair in the source
  GAP TEXT: not separable by pair — see the round's aggregate synthesis below the last block.
  REVEAL: A was the reference. Ours lost.
  ESCALATION: not required (ours lost)
  NOTE ON THIS PAIR: the crop window was moved from (150,480) to (200,480) before the pack was
    built, to clear a HUD region name-plate that had begun drawing into the frame since round 1
    (I3-PROTOCOL-A-RERUN.json FINDINGS/F1). image-leakcheck was GREEN on the version containing the
    text; the fix predates any judge running.
  ACTION: aggregate gaps -> GAP-W1-visual-fix-not-reaching-blind-frames and GAP-W1-pbr-material-set-unbound
```

```
BLIND RUN  wave 01  protocol A  pair 03  (round 2)
  ours: one of the six r2 capture setups — pairing sealed, not opened by this record.
  ref : one of the round-1 reference-plate population — pairing sealed, not opened by this record.
  key : W1-VISUAL-BLIND-PROTOCOL-A-r2/SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pair03.reveal/mapping.json
    (A=ours, B=reference) — counterbalanced plan
  judge: fresh Opus agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: B
  CONFIDENCE: not separable by pair in the source
  GAP TEXT: not separable by pair — see the round's aggregate synthesis below the last block.
  REVEAL: B was the reference. Ours lost.
  ESCALATION: not required (ours lost)
  ACTION: aggregate gaps -> GAP-W1-visual-fix-not-reaching-blind-frames and GAP-W1-pbr-material-set-unbound
```

```
BLIND RUN  wave 01  protocol A  pair 04  (round 2)
  ours: one of the six r2 capture setups — pairing sealed, not opened by this record.
  ref : one of the round-1 reference-plate population — pairing sealed, not opened by this record.
  key : W1-VISUAL-BLIND-PROTOCOL-A-r2/SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pair04.reveal/mapping.json
    (A=reference, B=ours) — counterbalanced plan
  judge: fresh Opus agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: A
  CONFIDENCE: not separable by pair in the source (this round's one `medium` may or may not be this
    pair — round 1's one `medium` was pair04, but the source for round 2 does not confirm which pair
    carried it this time)
  GAP TEXT: not separable by pair — see the round's aggregate synthesis below the last block.
  REVEAL: A was the reference. Ours lost.
  ESCALATION: not required (ours lost)
  NOTE ON THIS PAIR: the crop window was moved from (150,480) to (200,480) before the pack was
    built, for the same HUD-name-plate reason as pair02.
  ACTION: aggregate gaps -> GAP-W1-visual-fix-not-reaching-blind-frames and GAP-W1-pbr-material-set-unbound
```

```
BLIND RUN  wave 01  protocol A  pair 05  (round 2)
  ours: char-player__t1930__clear.png source frame (per capture/frame-liveness.json, the weakest
    frame in the r2 pack: shadow_levels 7, local contrast 0.52) — exact crop mapping sealed.
  ref : one of the round-1 reference-plate population — pairing sealed, not opened by this record.
  key : W1-VISUAL-BLIND-PROTOCOL-A-r2/SEALED-KEY-DO-NOT-OPEN-UNTIL-JUDGED/pair05.reveal/mapping.json
    (A=ours, B=reference) — counterbalanced plan
  judge: fresh Opus agent context, two image files + PROMPT-A-verbatim.txt and nothing else
  BLIND PICK: B
  CONFIDENCE: not separable by pair in the source
  GAP TEXT: not separable by pair — see the round's aggregate synthesis below.
  REVEAL: B was the reference. Ours lost.
  ESCALATION: not required (ours lost)
  DEVIATION ON THIS PAIR: subject scale still differs, carried unfixed from round 1 (D4) —
    deliberately not corrected so the pair reads against round 1's answer.
  ACTION: aggregate gaps -> GAP-W1-visual-fix-not-reaching-blind-frames and GAP-W1-pbr-material-set-unbound
```

**Round 2 tally: ours 0, reference 5 — same as round 1.** Escalation not triggered on any pair.
Confidence spread: four `high`, one `medium` (identical spread to round 1; which specific pair
carried the `medium` answer is not confirmed by the source for this round).

**Round 2 aggregate gap text, quoted verbatim from `orchestration/status/I3-PROTOCOL-A-R2-RESULT.json`,
not attributable to a specific pair:**

> No material differentiation: "every surface returns the same flat matte olive-grey", "thatch,
> plaster, stone and ground all return light identically", "nothing reads as leather, metal, stone
> or vegetation."
>
> No shadow or ambient occlusion at all: "no contact darkening and no cast shadows at all, so
> nothing sits in space", "surfaces meet with no contact darkening."

**The finding this round adds:** F1 (materials), F2 (contact shadows/AO) and F3 (ambient fill) had
all landed before this round ran, and each measured green on its own instrument. The blind result
did not move. See `corpus/90-verdicts/wave1/W1-VISUAL-BLIND-PROTOCOL-A-r2.md` for the full
cross-tabulation, the counterbalanced positional-bias ruling, and the scoring.
