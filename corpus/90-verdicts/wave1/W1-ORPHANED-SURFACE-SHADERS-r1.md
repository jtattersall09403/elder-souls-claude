# W1-ORPHANED-SURFACE-SHADERS (roadmap `F1` — materials and surface response), round 1

**Verdict: FAIL, 1/10 on its worst axis.** The diagnosis is right, the fix works on the world, the
measurement discipline is among the best in this repo — and the change makes **the player's body and
every NPC's body stop being drawn**. That is live at `HEAD` right now.

**What I could not do is stated first, in the verdict JSON's `method_deviations` and `self_audit`.**

---

## 0. What this verdict is, and what I did not do

I did not build any of this. Fresh context. I read `CLAUDE.md`, `orchestration/RULES.md`,
`corpus/00-doctrine/CRITIC-DOCTRINE.md` §§1–3, `orchestration/HAZARDS.md` §§0, 0b, 11, 12, the
builder's status file `orchestration/status/W1-ORPHANED-SURFACE-SHADERS.json` and the whole of
`corpus/90-verdicts/wave1/artifacts/W1-ORPHANED-SURFACE-SHADERS/README.md`, then went at the
evidence pack (96 files) with the intention of breaking it.

**Three of the brief's four suggested attacks failed to land.** I record that plainly, because a
critic that only reports what it broke is not reporting.

---

## 1. The attacks that failed — the builder's provenance is sound

### 1.1 The pinned baseline is real, and `HAZARDS` §12 is genuinely handled

The brief asked me to check that the pinned commit `03ba530d47` predates the fix. It does **not**,
and it is not supposed to: the design is that the archive of the pinned sha carries the *fixed* tree
and the before-arm is produced on the Pod by `--revert`. I verified the pin itself:

```
$ git log -1 --format='%H %ci' 03ba530d470a46e9784be71305005a598d223b9b
03ba530d470a46e9784be71305005a598d223b9b  2026-08-14 17:36:22 +0000

$ git show 03ba530d47:game/src/render/visual-foundation.js | md5sum   5084d50346026cfd43afb06aed7add43
$ git show 03ba530d47:game/src/render/actor.js             | md5sum   a3a0a7402f48f7ed188a588c817ad76b
```

Those are **byte-identical to the `pre-md5` values in the Pod's own `hardware-ab/revert.log`**, so
the Pod really did receive the pinned sha and not the live working tree. `run.json` independently
records `source.revision: 03ba530d47…`, `source.dirty: false`, `sha256` of the uploaded archive.

### 1.2 The revert was not silently inert this time — I reproduced it byte-for-byte

Run 1's failure mode (an `ENOENT` from a hard-coded path, so the "before" arm was secretly a repeat
of "after") is exactly the thing to check for again. I checked it by running the reversal myself, in
an isolated copy of the pinned sha, rather than by reading a log:

```
before revert   5084d50346026cfd43afb06aed7add43   a3a0a7402f48f7ed188a588c817ad76b
after  revert   5ff49046a21a3eb3dded0e2abed939d8   22989617981ffa6ee8a1813d33c72d89
```

The second row matches the Pod's `post-md5` exactly. Then the part the pack does not do — I compared
those bytes against the **true pre-fix parent commit**. The fix landed in `9ddeb512`; `9ddeb512^` is
the tree before it:

```
$ git show 9ddeb512^:game/src/render/visual-foundation.js | md5sum   5ff49046a21a3eb3dded0e2abed939d8
$ git show 9ddeb512^:game/src/render/actor.js             | md5sum   22989617981ffa6ee8a1813d33c72d89
diff reverted-copy  9ddeb512^  ->  IDENTICAL, both files
```

**So the before-arm on the Pod was byte-identical to the real pre-fix tree, and the after-arm was
byte-identical to the fix as landed. The two arms differ by the fix and by nothing else.** That is a
cleaner arm-freeze than anything else I have seen in this corpus, and it deserves saying.

The one blemish is cosmetic and should still be fixed, because it will make a future critic distrust
a valid log: `revert.log` prints `pre-md5=X (expected Y DRIFTED — anchors still unique, proceeding)`
where `Y` is the *post*-revert expectation, so a perfectly correct revert announces itself as
drifted. I reproduced the same misleading line locally.

### 1.3 The ground control is live, not inert — and it is the *plausible* wrong answer

This was the brief's hardest attack: *establish whether the ground control is the plausible wrong
answer or the trivial one*. It is the plausible one, and the evidence is in the numbers rather than
in the prose.

| natural (ground) | before arm | after arm |
|---|---:|---:|
| yaw 0 pixels moved | **73.28%** | **73.97%** |
| yaw 180 pixels moved | 52.16% | 52.68% |
| maxDelta | **181.71 / 164.84** | **181.71 / 164.84** |
| restore floor | 0.00% | 0.00% |

An inert control is one that *cannot* move. This one moves **73% of the frame in the before arm** —
the arm where the defect is present. That is the whole job of this control: it proves the harness can
perturb a uniform and move a pixel on that Pod, in that arm, so the player's 0.33% is an **absence**
rather than a broken instrument. The 37 selected materials all carry uniforms in both arms
(`materials_selected: 37, with_uniforms: 37`, both arms), and the `maxDelta` is identical to two
decimal places across arms, which is what you would expect if the same intact materials are
responding identically on both sides.

**It is not an inert control wearing a control's clothes, and I could not make it into one.**

### 1.4 CONSUMPTION consumes the shipped path

`tools/visual/w1-30-surface-consumption.mjs` loads `game/index.html`, reads `window.__ENGINE.renderer`,
traverses `R.scene`, selects out of `R.playerMesh`, and writes into `m.userData.surfaceUniforms`'s
**own uniform objects** while deliberately never setting `needsUpdate`. Nothing is reimplemented; the
only route from the write to a pixel is the running renderer already holding those objects. The
`RI-MTH07` shape is correct and the "did the probe reimplement its subject" attack does not land.

---

## 2. The attack that landed — Ruling W2, and the owner's standing directive

> *"if you just load the game rotate the camera around the player it's immediately obvious that it
> hasn't [been fixed]."*

The pack's headline is a **percentage of pixels moved under a synthetic perturbation**. Ruling W2 is
that a statistic can fail a build and can never pass one. So I looked at the ~80 pictures.

**The pack's own after-arm frames show the player with no body.**

| exhibit | before arm (defect present) | after arm (fix applied) |
|---|---|---|
| `exhibit/player-yaw000-*.png` | complete figure: head, arms, legs, torso, sword blade | floating chest barrel, two detached boots, horns, frill, shield |
| `exhibit/player-yaw180-*.png` | complete armoured figure, face, shoulders, gauntlets | floating eyes and horns in mid-air where the head was; arms gone |
| `exhibit/deck-char-player-*.png` | full body | a few olive cylinders and the weapon |
| `hardware-ab/motion-*/contact/walk.png` | a walking figure, 30 frames | a walking pile of equipment, 30 frames |

The parts that survive are precisely the parts that are **not** actor-body materials — the shared
`mats.skin` original on the brow horns, the eyes, the frills (`frillMat`), and the three equipment
sets. The parts that vanish are precisely the two `SkinnedMesh` body materials.

### 2.1 The mechanism, measured rather than reasoned

I built one instrument, `tools/visual/w1-f1-critic-shader-collision.mjs`, and ran it against the
**live page at `HEAD`**. It composes each material's real `onBeforeCompile` chain against a stand-in
carrying the chunks both hooks target, and it reads the renderer's own program diagnostics back out.

```
FAIL  NO-DUPLICATE-UNIFORM-DECLARATION
      124 body material(s) compose a fragment shader declaring a uniform twice: uWetness x2
FAIL  BODY-PROGRAM-IS-RUNNABLE
      66 of 124 actor-body program(s) FAILED TO LINK — the body is not drawn.
      ERROR: 0:81: 'uWetness' : redefinition
      ERROR: 0:1724: 'esWet' : redefinition
PASS  CONTROL-IS-CLEAN            65 equipment/frill materials, 0 duplicates
PASS  CONTROL-PROGRAM-IS-RUNNABLE 0 of 65 equipment/frill programs failed to link
```

(The remaining 58 of 124 simply had not been compiled at the instant I sampled — their diagnostics
are `null`, not green.)

**Two identifier collisions, both fatal, both introduced by this piece:**

| identifier | declared by | declared again by |
|---|---|---|
| `uniform float uWetness` | `installSurfaceShader`, `visual-foundation.js:521` | `installWaterline`, `actor.js:302` |
| `float esWet` | `installSurfaceShader`, `visual-foundation.js:574` | `installWaterline`, `actor.js:310` |

Before this piece, `installWaterline` **assigned** `onBeforeCompile` and deleted the surface hook, so
only one declaration of each ever existed and the program linked. Loss **E** in the builder's own
table — *"`installWaterline` ASSIGNED rather than chaining… Fixed by chaining"* — is what put the two
preambles into one shader. `installWaterline` is called at exactly one site, `actor.js:607`, inside
the `for (const key of ['cloth','skin'])` body loop, which is why the blast radius is *only* actor
bodies and why every other material on the character is untouched. That is a perfect match to the
frames.

### 2.2 It is live at `HEAD`, and it is every character in the game

```
$ git log -1 --format='%h %s'        fb42ad10  V2 compositor work in flight
$ git diff --quiet 03ba530d47 HEAD -- game/src/render/visual-foundation.js  ->  IDENTICAL at HEAD
$ git diff --quiet 03ba530d47 HEAD -- game/src/render/actor.js              ->  IDENTICAL at HEAD
$ git status --porcelain <both files>                                       ->  clean
```

The probe scanned the player **and** `renderer.npcMeshes` / `renderer.enemyMeshes`: **124 actor-body
materials across `saxhleel` and `humanoid` art families**, all with the duplicate. This is not a
player-only defect. `frames-head/head-player-yaw*.png` are my own captures at `HEAD` on this box, and
`head-player-yaw000.png` shows, besides the headless player, **a second floating head-and-horns in the
middle distance** — an NPC with the same defect.

### 2.3 The shipped-configuration A/B the pack captured and never computed

The run saved the **unperturbed** `*-base.png` at every camera in both arms. Same camera, same scene,
same Pod, same GPU; arms differ only by the fix. That is the shipped-configuration before/after, and
it is the number that says what a player sees. It was never computed. I computed it with the
builder's own `movedFraction` maths — `artifacts/W1-ORPHANED-SURFACE-SHADERS-CRITIC/base-frame-ab.mjs`,
reproducible from a fresh clone with no browser and no Pod:

| target | shipped-config pixels moved, before → after |
|---|---:|
| player, 8 orbit angles | 6.42% – **21.84%** (every angle) |
| building, 3 angles | 11.78% – 23.82% |
| deck `street-lilmoth` | 25.65% |
| deck `vista-deep-marshes` | **0.007%** |
| deck `eye-deep-marshes` | **0.005%** |

Two things follow, and they cut in opposite directions.

**The builder's falsifiable prediction is confirmed** — *"terrain and canopy should not change at
all"* — at 0.005% and 0.007%. That is a real, independent specificity result which the pack was
entitled to claim and did not.

**And the player's 6–22% is mostly geometry disappearing, not a surface starting to respond to
light.** The headline "player 0.33% → 5.36%" is a true statement about uniform plumbing that reads, to
anyone who has not opened the frames, as a statement about appearance. It is not one.

---

## 3. Why the whole apparatus stayed green

This is the part worth carrying into the next piece, because it is a *class*.

- The census asks **"does this hook install uniforms?"** It calls the hook against a stand-in and
  inspects the result. It never asks **"does the shader those hooks compose actually link?"** So
  `NO-ORPHANED-SURFACE-PASS`, `NO-DEAD-GHOST-UNIFORMS`, `WETNESS-REACHES-EVERY-SHADED-MATERIAL`,
  `SHADER-UNIFORM-IS-THE-LIVE-ONE` and `NO-HOOK-THREW` are all genuinely PASS at 0 of 422 while the
  bodies are not drawn. **`NO-HOOK-THREW` is the near miss**: the hook does not throw, it emits
  illegal GLSL.
- The consumption probe perturbs `uWear`/`uWetness`/`uWorldWetness`/`uDetailStrength` to extremes the
  shipped build never produces (nothing in `game/src` calls `setWorldWetness()` at all), and measures
  the delta *within* an arm. A material whose program does not link contributes 0 to both the base and
  the perturbed frame, so it is invisible to a within-arm difference.
- `mesh.visible` stays `true`, `material.needsUpdate` stays honest, `pageErrors` stays `[]` — a GLSL
  link failure arrives on `console.error`, which nothing in the harness was listening to.
- **Delete-the-fix was run through the census only, never through a frame.** RULES rule 6 says the old
  number must come back; the census's old number did come back. A frame comparison would have shown a
  body appearing.

The single missing tripwire is one line of intent: **no material in the scene may have
`program.diagnostics.runnable === false`.**

---

## 4. Scores

Aggregation is `min` over axes, per the wave-1 gate.

| item | axis | score | why |
|---|---|---:|---|
| `RI-VIS08` | character model / materials / silhouette | **1** | the player's and every NPC's body is not drawn. B1, B3, B4, B6, B7 are not merely failed but unmeasurable — the surfaces they measure produce no fragment. B8 "eyes are separate geometry" technically passes and does so conspicuously: they float unattached in mid-air. §E's tell list has no entry for this because nobody imagined it. |
| `RI-VIS04` | §1 PBR materials | **4** | genuinely improved on world surfaces — buildings move 11.8–23.8% of pixels in shipped configuration with real `wear` 0.2–0.9 and `wearFrom:'geometry'`, and that is a real gain the pack under-claimed. But §1's MIN BAR is "albedo + roughness on **every** material", and on 124 actor-body materials the program does not link at all. Band 3–4, "structurally pre-modern", for characters. |
| `RI-MTH07` | world coupling / CONSUMPTION | **6** | consumer named and shipped; perturbation of the material's own objects with no `needsUpdate`; live positive control at 73% in the before arm; restore floor 0.00% at every site in both arms; one Pod, one GPU, identical renderer string, arms byte-verified by me. Docked on the instrumentation-honesty axis only: the pack captured the frames that disprove its own headline and did not compare them. |
| `RI-MTH04` | measurement integrity | **6** | every number I re-derived resolved, and the three-run history — including a self-reported silently-inert revert — is unusually honest. Docked because delete-the-fix ran through the census alone, and because six checks across two instruments were green over a broken build. |

**Overall: 1/10. Pass threshold 7. FAIL.**

The score is not a judgement of the work's quality — the diagnosis, the seam choice, the
`clone`-not-`copy` reasoning and the arm discipline are all first-rate. It is a judgement of what is
in the game.

---

## 5. What NOT to hold against this piece

Per the dispatch, and I agree on the evidence: **this piece does not implement ambient occlusion,
contact shadows or ambient fill, and was not asked to.** `worldMaterial()` sets `aoMap: authored ?
null : …` and every family has an authored set, so `aoMap` is null everywhere; there is no
screen-space AO pass in `game/src/render`. Five of five blind judges named contact shadow as the
biggest gap. That is real and it belongs to `F2`/`F3`. It is not imported into this verdict and it is
not the biggest gap here.

---

## 6. The one gap, and the remedy

Named in full in the verdict JSON as `GAP-W1-F1-actor-body-shader-does-not-link`. In short:

**Rename the two colliding identifiers in `installWaterline` (`actor.js:287–327`) so its preamble
cannot collide with `installSurfaceShader`'s**: `uWetness` → `uWaterlineWetness` (declaration at
`actor.js:302`, the `shader.uniforms` assignment at `:297`, and the two uses at `:310`/`:311`), and
the local `float esWet` → `esWaterlineWet` (`:310`, used at `:313` and `:319`). Prefix `esBand` and
`esMeniscus` at the same time — they are unique today by luck, not by design.

**Cheapest gate first, and it already exists and is already red:**
`node tools/visual/w1-f1-critic-shader-collision.mjs` must return all four checks green — in
particular `BODY-PROGRAM-IS-RUNNABLE` at 0 of ≥100 actor-body programs failing to link.

**Then, and only then**, re-take the frame evidence and re-run
`base-frame-ab.mjs`; the player's body must be present at all eight orbit angles in **both** arms,
so that the shipped-config delta is attributable to shading rather than to geometry appearing.

**And add the missing tripwire**, because this class will return the moment a thirteenth hook is
added: a check that no material in the live scene has `program.diagnostics.runnable === false`. The
census's five checks cannot see a link failure and never could.

I have not touched `game/src`. Rule 23: a failing build critic does not become the builder.
