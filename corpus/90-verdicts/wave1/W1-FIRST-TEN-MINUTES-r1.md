# FIRST-TEN-MINUTES — critic verdict, round 1

**Status: FAIL** against the wave-1 gate of 7.0. **Overall 4.0**, min-over-axes.
Commit `a8e4c938da682688f472b8d6b6822e8acb913820`, branch `codex/wave1-build-experiment`.
Critic: fresh context, built none of this work.

**Read this first, because a failing score is a bad summary of this piece.** Two of the three
things it claims are true and I confirmed both with pictures taken on real GPU hardware. The
NPC-placement fix works: Corvus Aldeyn is a body on screen during his own conversation, at 3.5 m
and still at 30 m. The `charOpacity` consumption repair works: perturb the value and the character
changes on screen. The piece also disabled its own rain fix rather than ship it, said so, and was
right to — I re-measured and its diagnosis of its own failure holds. Its status file is one of the
more honest documents in this repository; it named the four best attacks on itself and three of
the four were the right places to look.

It fails on a fourth thing it also claims: **the instruments.** The regression guard it ships is
satisfied by a comment, two columns of its headline table were dead and published as `null`
anyway, one cited null control has no manifest, and the standard method this repo uses to count an
actor's pixels turns out to be contaminated — which I discovered by falling into it myself.

---

## 1. What was tested, and how

Directive §2 is binding, so this is a play session, not a file review. Everything below was driven
through the real input pipeline and photographed.

**On real hardware.** Five RunPod runs, RTX A5000 and L4, `ANGLE (NVIDIA, Vulkan 1.4.312)`,
`swiftshader: false`, each Pod terminated in its own mandatory cleanup with deletion confirmed by
API lookup. This matters more than usual here: every number the builder published is SwiftShader,
and its status file says so plainly.

**Local browsers were the wrong tool today.** `tools/contention.mjs` went from GO to WAIT (5
instances, load 5.49 per core against a 4.0 ceiling) while my first local run was already up. I
kept that one browser and moved everything expensive to the GPU rather than open a second. The
local run was later killed by a tool timeout; nothing rests on it.

**Tool.** `tools/harness/critic-first-ten-play.mjs`, written for this review: spawn, an eight-angle
look-around, the 600-frame walk, walk-up-and-talk with a red-overlay proof of where the other
person's pixels actually are, go through a door, perturb the fade, take a fight.

---

## 2. D3 — people who are not where the conversation is. **Fixed, and I can show it.**

**The recount, done independently.** `before/census-rows.json`: 56 NPCs, **32** within 50 m of the
world origin. The audit's headline is exactly right. The builder's refinement is also right and is
the more useful number: of those 32, only **5** had a body actually drawn there. The other 27 carry
a non-null `at` and room-scale coordinates, and interiors really are a local frame centred on zero
— `game/data/world/interiors/lilmoth-ledger-house.json` has `continuity.interior_spawn: [0, 0, …]`
and `useDoor()` places the body at it. So "interior-local" is a fact about the data, not a
rationalisation. After: **29** at origin coordinates, **0** with a drawn body.

**But the claim that matters is not a coordinate.** It is whether a conversation now happens with a
visible body in front of you. Nobody had measured that, so I did, on an A5000, with the frame
rendered twice from one pose and the differing pixels painted red:

| arm | distance | pixels of that NPC | where they are | artifact |
|---|---|---|---|---|
| Corvus Aldeyn | 3.5 m | **1016** | bbox 92 × 122 px, centroid (469, 245) of a 960 × 540 frame — dead centre | `d3-corvus-3m-overlay-clean.png` |
| Corvus Aldeyn | 30 m | **262** | bbox 27 × 32 px at (433, 196) — correctly small, correctly there | `d3-corvus-30m-overlay-clean.png` |

The engine's own `projectPoint` independently puts him inside both boxes. **The audit's exact
complaint — a dialogue panel over an empty street — is answered.**

**Indoors, too.** Inside `lilmoth-ledger-house` the census reports 3 drawn bodies including
`lilmoth-archivist-ledger`, present, 4 m away; `d3-ledger-house-interior-bodies.png` shows a lit
room with beams, candles and two figures in it. This was the builder's own open question 2 and the
answer is yes.

**The null control is real.** `null-presence-only` is the plausible wrong answer, not the trivial
one — keep the presence fix, drop the placement fix — and it fails in the informative direction:
visible bodies at the origin fall 5 → 3, so the headline number *improves*, while
`residents_in_town` stays at 24 and Corvus is still 5.7 km away and merely invisible. I verified
this from the artifact, not from the claim.

**Two caveats, neither fatal.**

- Standing 3.5 m from `lilmoth-yard-brothers` and `dockmaster-weeja-sen` gave **0 px** for each:
  the body is behind the building wall their doorstep placement stands them against, and at
  `lilmoth-rootkeepers` the camera ended up entirely inside geometry. My standoff is an arbitrary
  `+3.5 m` in x and can land the player inside a building, so this is at least as much my method as
  the placement — but "walk up to a townsperson and the camera is in a wall" happened in three of
  four attempts and a successor should look at it.
- Only Lilmoth was ever entered, by the builder or by me. The builder's own open question 1 — does
  the door derivation behave where buildings ring the centre — is still open.

## 3. `charOpacity` — the consumption repair. **Real, demonstrated by perturbation.**

`sim/camera.js:527` computes it; nothing in `game/src/render/` read it. `renderer.js:742
_applyCharacterFade()` is now the consumer, called at line 1142.

RI-MTH07 asks for a perturbation that changes an entity on screen, and it does:

| `charOpacity` written | player meshes carrying a `:camera-fade` clone | player pixels |
|---|---|---|
| 1.00 | 0 | 16 910 |
| 0.50 | 75 | 16 867 |
| 0.25 | 75 | 16 844 |
| 0.00 | — subtree hidden — | **0** |

The material clone is the right call and the reason is recorded in the code: `render/actor.js:473`
hands the *same* armour material instances to every actor, so setting opacity in place would have
faded the whole town. That trap is real — I fell into a version of it myself (§6).

**One claim in the status file is measurably false, though.** It says the fade was wired rather
than deleted partly because "it is the closest thing this build has to a remedy for D1, where the
compressed arm puts the player's own body in the frame." Across all eleven stops of the burial
walk, on hardware:

```
arm_len      3.993 3.993 3.993 3.993 3.993 3.993 3.993 3.993 3.993 3.993 3.993
arm_hit      false … false          (every stop)
charOpacity  1.000 … 1.000          (every stop, including the one where the player is 0 px)
```

The arm never compresses, so the fade never engages, so it is not a remedy for D1 at all. The fade
*does* have a real use — at the `lilmoth-rootkeepers` standoff the arm compressed to about 0.95 m,
inside the 1.3 → 0.9 m band. The behaviour is worth having. The justification given for it is not
the one the numbers support.

## 4. D2 — rain through roofs. **Correctly diagnosed, correctly not shipped.**

Disabling a fix that made things worse and documenting it in the code is the right call, and the
diagnosis of its own failure survives checking. I ran the builder's own tool at HEAD, where the
roof field is passed `null`:

- surviving streaks stay at **192 at every stop**, so the collapse to 1 / 0 / 2 in `after-d1d2` was
  genuinely the roof cull and not a weather ramp;
- streaks under a roof run **15, 20, 26, 28, 36, 32, 27, 36, 32, 23, 32** across the walk. The
  defect is live and gets worse as you walk into town.

The disabled path is structurally inert — `sky.js:233` skips the whole branch when `overhead` is
null — so nothing was left behind. `d3-corvus-3m-conversation.png` happens to show it: rain falling
in front of the deck overhead.

The one flaw is evidential: **`reports/first-ten-minutes/null-d2-unwired/` contains one frame and
no `manifest.json`.** The status file quotes its numbers as if from it. I reproduced them
independently, so the claim is true; it was not evidenced.

## 5. D1 — the buried camera. **Right about the class, wrong about the object.**

Reproduced on an A5000, clean method, player-visible percentage across the walk:

```
6.5  6.4  6.3  5.8  2.3  0.5  0.0  6.1  6.2  6.2  6.2
                              ^ f360
```

Zero. Not one pixel of the character, shadow included. The builder called it "ONE PIXEL"; on
hardware it is none. **RI-CAM01 §C.1's automatic-fail condition — any run of `player_occluded`
longer than 6 consecutive frames — is live and unfixed**, at a sampling interval of 60 frames, so
the true run is somewhere between 60 and 120 frames.

Two corrections to the diagnosis, both from evidence the builder already had:

1. **The occluder is a tree.** `d1-f360-camera-inside-a-tree-rtx-a5000.png` is the camera inside a
   trunk with a green frond across it — and so is the builder's own decisive frame,
   `after-d1d2-006-walk-f0360.png`. The status file prescribes "`settlementSolids()` gaining the
   underside of raised decks". Trees are not in `settlementSolids()` at all, so the prescribed fix
   would not change the frame that proved the diagnosis.
2. **The arm never sees it.** `arm_len` is 3.993 m — full extension — and `arm_hit` is `false` at
   the moment the player is invisible. The status file concludes that "the camera does not collide
   with the town" is *not* the defect because `_settleSettlementSolids()` already feeds the arm a
   `CollisionCell`. That reasoning is sound about buildings and wrong about the frame in question:
   the arm's sphere-cast does not detect this occluder, because it is not in the collision set.

The useful half of the diagnosis stands and was worth the round: it is genuine occlusion, not bad
framing, so a successor can skip that fork. The fix belongs in vegetation collision or a near-field
occluder fade, not in deck undersides.

## 6. The instruments — and one of them is mine

This is the axis the piece fails on.

**a. The consumption sweep's tripwire is satisfied by prose.** Three arms on a sparse copy
(`consumption-sweep-delete-the-fix.log`):

| arm | what was removed | `charOpacity` mentions left in `renderer.js` | sweep |
|---|---|---|---|
| A — trivial | every mention renamed | 0 | **exit 1** |
| B — plausible | the call site `this._applyCharacterFade(c);` | 3 | exit 0 |
| C — plausible | the method body, gutted to `return;` | 2, both prose | exit 0 |

The test is *does any file under `game/src/render/` mention this name*. RI-MTH07 is about
consumption, not mention. The builder's own control for it — "exits 1 before this piece and 0
after" — is arm A, the one deletion nobody performs by accident. This is precisely the inert
control RULES rule 6 names, and it also weakens the sibling claim: 85 of the 98 fields are INTERNAL
by a hand-written allowlist, and the consumer population is `game/src/render/` only, so a HUD-side
consumption failure is invisible to it.

**b. Two dead columns, published as `null`.** `first-ten.mjs` reads `cam.armLen` and
`cam.clipThrough` off `snapshot()`. `snapshot()` returns `makeRecord()`, whose camera block names
them `arm_len_m` and `clip_through` (`sim/record.js:239, 252`). Both were `undefined` at all eleven
stops and were written out as `null` without a warning — and the arm length is the single quantity
that decides between D1's two candidate causes and the only input to `charOpacity`.

**c. A method this repository reuses is contaminated, and I hit it.** My first pass copied
`vt-seethrough.mjs` §1.1 and hid an actor by setting `colorWrite: false` on its materials. Because
`render/actor.js:473` shares armour material instances across actors, blanking one NPC also blanked
matching parts of the *player*: Corvus at 30 m came back as 6485 px instead of 262.
`method-contaminated-overlay-shared-materials.png` is the proof — the red is painted on the player
in the foreground while the actual NPC is a correct little figure in the middle distance. I caught
it only because I drew the picture instead of trusting the number, and I have switched to toggling
`root.visible`. **`first-ten.mjs`'s D1 column inherits the same defect** — which is why my
percentages (6.2 %) sit above the builder's (3.2 %) everywhere except the burial, where both are
zero and the conclusion is unchanged.

**d. My own retracted claim, stated plainly.** I first reported that D1 did not reproduce on GPU.
It does. My first run played a look-around phase before the walk that left about 24° of residual
yaw, and the player walked past the tree instead of into it. The isolated walk-only arm reproduces
the burial exactly. A contaminated control looks the same as a clean result, which is the whole
reason the isolated arm exists.

---

## 7. Scores

Min-over-axes. No axis is averaged away.

| Axis | Score | Why |
|---|---|---|
| D3 placement and presence | 7.5 | Fix real, verified by picture and by the engine's own projection; genuine plausible-wrong-answer control. Docked because the load-bearing measurement was never taken by the builder, and only one town was ever entered. |
| `charOpacity` consumption repair | 8.0 | Consumer exists, perturbation changes the entity on screen, the shared-material trap avoided deliberately. Docked for a stated D1 justification the numbers contradict. |
| D2 diagnosis and disabled state | 8.0 | Attribution verified at HEAD, disabled path structurally inert, refusing to ship it was right. Docked for the missing control manifest. |
| D1 diagnosis | 5.0 | The occlusion conclusion is correct and valuable; the occluder is misidentified and the prescribed remedy points at the wrong object. |
| Reporting honesty | 9.0 | Names its own failures, the clobber, the SwiftShader limit, the photograph it owes, and the four best attacks on itself. Unusually good. |
| **Instrument integrity** | **4.0** | Tripwire satisfied by a comment; two dead columns published as null; a cited control with no manifest. |

**Overall 4.0 — min. Gate 7.0. FAIL.** Confidence: high on D1, D2, D3 and the sweep; medium on the
conversational-range caveat in §2, which my teleport partly caused.

## 8. The one biggest gap

**`GAP-W1-consumption-sweep-tripwire-is-a-name-grep`.**

The piece's durable artifact is a regression guard that cannot see the regression it exists to
catch. Make it a consumption test rather than a mention test: strip comments and string literals
before matching, and require the name to appear in an executable position that is *reached* —
cheapest sufficient form is to assert the field is read on a live frame (the sweep already has a
harness available to it), or failing that to match only outside comments **and** require a call
path from `render()`. Then re-run all three arms above and require **A, B and C to exit 1** while
the shipped tree exits 0. That is the acceptance: three red arms and one green, not one of each.

Everything else in this verdict is a correction handed over with its numbers, not a build request:
the D1 occluder is vegetation and the arm never fires (§5), the actor-pixel method needs
`root.visible` not `colorWrite` (§6c), `arm_len_m`/`clip_through` are the record's real names (§6b),
and `null-d2-unwired` needs its manifest or its citation withdrawn (§4).

## 9. What I could not do

- **No town but Lilmoth.** The builder's open question 1 is still open; I did not close it either.
- **The fade in motion was never photographed.** I perturbed the value and watched the entity
  change, which is what RI-MTH07 asks, but I did not drive the camera into a wall over a sequence
  and look at whether the fade strobes. The builder said it owed this picture; it is still owed.
- **The fight arm ran but I did not judge it.** It is outside this piece's claims.
- **`root.visible` also removes the character's cast shadow**, so my percentages are body-plus-shadow
  where the builder's are body only. The two are not directly comparable except at zero, where they
  agree.
- Two of six GPU runs died at `PodAgentError: GET /job … HTTP 404` before producing output. Retrying
  worked both times. Worth knowing; not worth a hazard entry on its own yet.
