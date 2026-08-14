# The evidence standard — the Deck, the orbit, and the defect inventory

**Binding on every W1-30 child and on any piece making a visual or player-experience claim.**
Written 2026-08-14 under `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §2.

> *"it seems to be inspecting relatively few screenshots/images from our actual game… it thinks it's
> fixed the player character body transparency issue, but if you just load the game rotate the
> camera around the player it's immediately obvious that it hasn't."*

One still from one angle is not a measurement. This file defines what is.

> **Amended 2026-08-14** by the W1-30 recriticism round. Three changes, each carrying its rationale
> in `orchestration/plans/W1-30.md` under the amendment ID shown: **R1** — the primary human read is
> `RI-VIS06` Protocol A against profile-matched plates from `corpus/70-visual/refs/modern/`, not a
> new 1–10 ladder (§2 below is rewritten). **R3** — the full Deck runs once at the parent's
> integration critic; child critics run the `child-scoped` profile plus the census sample plus the
> open inventory, and the 144-frame orbit is required for the player and for any subject with an open
> defect, 24 frames for the rest (§1 below). **R3c** — a named SwiftShader fallback so the standard
> stays executable if the GPU transport fails (§4 below).

---

## 1. The Deck — a fixed, versioned shot list

`tools/visual/deck.mjs` (owned by W1-30V) captures the same shots every run, from the running game,
at fixed seed, fixed simulation rate and fixed camera transforms. Its manifest is
`tools/visual/deck.json` and is versioned: changing a shot is a recorded edit, so progress over time
is comparable.

### Stills — 48 setups × 3 times × 2 weathers = 288 frames

| block | setups | why it is in the fixed list |
|---|---|---|
| region vistas | 13 (one per region) | the shot a player judges the world by |
| region eye-level | 13 | vistas flatter; eye-level does not |
| settlement approach | 8 | silhouette and skyline |
| settlement street | 8 | **mandatory** — building quality at 4–8 m cannot hide here |
| named interiors | 4 | interior lighting and dressing |
| character close-up | 1 player + 1 NPC | **mandatory** — no build reaches 7.0 with capsule characters |

Times: 08:00, 13:00, 19:30. Weathers: clear, rain. **Aggregation is the minimum over shots**, never
the mean, and the verdict reproduces the worst three frames per axis.

**Who runs how much of it (R3a).** The 288-still, 12-sequence `full` profile is **2,448 frames**, and
running it in each of eleven children's critic rounds would be ~22,000 frames of duplicated capture
across children that changed disjoint files — waste of exactly the kind `PLAN-LOOP.md` rule 3 forbids.

| profile | who runs it | contents |
|---|---|---|
| `smoke` | any builder, any time | the handful of shots that prove the thing booted and drew |
| `child-scoped` | **every child's critic** | the child's owned shots, **plus every shot named in its own gate table**, **plus the 12-shot unseen census sample**, **plus the complete open defect inventory** |
| `full` | **the parent's integration critic, once, at one stamped commit** | all 288 stills and all 12 sequences |

The bar does not move. The full Deck still gates the parent; the census sample still defeats a
polished-pack-in-front-of-an-unchanged-game; minimum-over-shots is unchanged. What changes is that the
same 288 frames are not recaptured eleven times to prove eleven disjoint things.

### Motion — 12 sequences, ≥ 180 frames each

Walk, run, sprint-stop, 180° turn, four-direction roll, jump/fall/land, light attack, heavy attack,
block+hit-reaction, spell release→impact→residue, streamed-boundary walk-through, day→night
time-lapse. Captured as deterministic PNG sequences with per-frame hashes and an animation trace.

**A motion sequence is reviewed as a contact sheet** — every 6th frame tiled, plus the full sequence
as a transient derivative for qualitative judgement with the encoder command and output hash
recorded. A reviewer that looked at one frame of a motion sequence has not reviewed it, and the
contact sheet is the artefact that makes that visible.

### The orbit gate — 24 stops × 3 distances, per character and creature

The camera orbits at 15° increments at 1.5 m, 4 m and 12 m, at two times of day: 144 frames per
subject. This exists because of the transparency defect: **no character defect may be declared fixed
without a clean orbit at the commit that claims it.**

**The ladder (R3b).** The full 144-frame orbit is required for **the player** and for **any subject
carrying an open row in the defect inventory**. Every other creature class gets **24 stops at one
distance at one time — 24 frames — and escalates to the full 144 the moment any automatic check below
trips.** The guard is preserved where the defect actually lives, at roughly a fifth of the frames; a
class that trips a check has bought itself the full orbit, which is the right place to spend it.

The orbit's automatic checks, before any human looks:
- no fragment of the body renders with `transparent: true` unless it is a declared exemption;
- alpha-blended surface count per frame does not vary with camera angle;
- silhouette area varies smoothly with angle (a discontinuity means a shell popped);
- no interior geometry is visible through the body at any stop.

### The census sample — the anti-beauty-shot arm

Every run adds **12 randomly chosen shots** from the live surface census, seeded by the commit hash,
which the builder cannot know in advance. Their scores enter the same minimum. This is the guard
against the plan's oldest failure mode: a polished fixed-eight pack in front of an unchanged game.

## 2. How images become a number

Three signals, in this order of authority.

### Primary — `RI-VIS06` Protocol A, blind and paired (R1)

**The instrument is `corpus/70-visual/RI-VIS06-blind-comparison-protocol.md`, by path, run as
written.** This standard does not define a second one. Rule 10 exists because this project has
already shipped a good detection model and a broken one at the same time, and an invented judging
ladder alongside an existing anchored protocol is that failure in its purest form.

Judges are fresh and naive: they have not read the plan, seen the code, or judged this piece before.
Each Deck shot is paired **blind** against a **profile-matched** plate:

| Deck shot | pairs against |
|---|---|
| region vista, region eye-level, settlement approach, settlement street | `refs/modern/exterior_daylight/` |
| any night or low-light exterior | `refs/modern/exterior_lowlight/` |
| named interiors | `refs/modern/interior_darkemissive/` |
| character close-up | `refs/modern/character_closeup/` |
| material close-up | `refs/modern/material_closeup/` |
| combat motion sequences | `refs/modern/combat/` |

Protocol A's own ladder mapping and caps apply unchanged, including the one that decides this whole
tree: **a wave in which zero Protocol A pairs ran caps FIDELITY at 7.** W1-30 targets ≥ 7.0. A tree
that never runs Protocol A is capped at exactly its own bar and cannot demonstrate reaching it.

**This is now runnable and was not when the old plan was written.** `refs/modern/` was populated on
2026-08-06 and holds 131 files across seven folders — 43 `exterior_daylight` at 1920×1080 (39
`pixel_metrics_valid`), 24 `exterior_lowlight`, 22 `interior_darkemissive`, 13 `character_closeup`,
12 `combat`, 9 `material_closeup`, 8 `ui`. Every appearance profile the Deck shoots has a population.

**Before any pack is built, W1-30V confirms three things about those plates.** (i) The citation
routing: `RI-VIS09` §2 grants Protocol A `refs/modern/character_closeup/` and bars `refs/modern/hud/`
outright, and that table was written while the other folders were still empty. (ii) Whether the
acquired frames are HUD-free — the acquisition deliberately kept HUD material, and no HUD-bearing
frame may appear on the ref side of a blind pair. (iii) Their licence position; `MANIFEST.json`
records `licence: null` on the `exterior_daylight` records sampled. If the routing does not extend to
the folders acquired on 2026-08-06, that is a **corpus** question for `ARBITRATION.md` — never a
critic's local call, and never resolved by citing whatever happens to be on disk.

**Retained alongside it, unchanged in force:**

- **Place** — RI-VIS07's question, *"does this look like a specific place with its own character, or
  generic fantasy?"*, measured as distance **from** `refs/anti-generic/`, never toward it.
- **Protocol B** against `refs/morrowind/REF-A*` as the art-direction side, per `RI-VIS01`'s
  bifurcation. No cross-side averaging, ever.
- **The owner's question** — *"is this a screenshot you would send someone to show them a game you
  were excited about?"* Yes/no. **Reported as a yes-rate in every verdict, and it is not a gate.** It
  is the bar the owner actually described and it belongs in front of him every round; it is also a
  single unanchored judgement, and this standard exists because unanchored judgements were
  load-bearing once already.
- **Delta rows survive as written** — `Craft ≥ pre-X + 1.5 on the minimum over shots`, and its
  siblings in the child plans. A same-pack before/after comparison needs no external anchor and is
  the most robust number in this document. Where a child states an **absolute** `Craft ≥ 7.0`
  (W1-30D, W1-30E, W1-30G), it is read as its Protocol A equivalent: the blind pair-preference rate
  against the profile-matched plate at the confidence Protocol A defines.

Judges learn which frames are ours **only after scoring**, and every pack carries a planted tell the
judge must detect before their scores count. Pack-builder and judge are always different agents.

### Secondary — RI-VIS03 M1–M12, as a tripwire only

The statistics keep their literal definitions, units, windows, support counts and hard fails. Their
role changes: **they can fail a build and can never pass one.** A build whose M-battery regresses
against the previous stamped commit is failed without a human looking. A build whose M-battery
improves has established nothing about quality.

This inverts the old contract's weakness. Noise raises texture-detail statistics; noise does not win
a blind pair against a shipped game.

### Tertiary — the automatic checks

Orbit checks above; library census (`W1-30-LIBRARY.md` §4); draw-call, triangle, program and
frame-time budgets; determinism (same seed → same frame hash); the sabotage matrix (every declared
feature's off-switch changes pixels measurably).

## 3. The standing defect inventory

`reports/visual-truth/INVENTORY.md`, owned by W1-30V, never closed.

Every defect row carries: an ID, a one-line description in plain English, the Deck shot or orbit stop
that shows it, the child that owns the fix, a severity (`blocks-demo` / `noticeable` / `polish`), and
a state (`open` / `claimed-fixed` / `verified-fixed`).

Three rules:

- **A defect moves to `verified-fixed` only when reproduced as fixed from three different angles or
  three different points in a motion sequence**, by someone other than whoever fixed it.
- **Every child's critic re-runs the whole open inventory in its own Deck run.** A child cannot pass
  while leaving a `blocks-demo` defect in its own owned paths open.
- **A critic that finds no new defect must say so with the evidence.** Under the amended critic rule
  (directive §8) that is a legitimate PASS — but a critic that ran only stills where a motion
  population was specified has not earned it.

## 4. Where the pictures come from

**RunPod GPU is the required path** (`tools/runpod/`, `RUNPOD_API_KEY` and `RUNPOD_GPU_TEMPLATE_ID`
in env) for any Deck run that feeds a human judgement or a fidelity metric. SwiftShader captures are
acceptable only for determinism, library-census and boot checks — never for antialiasing, bloom, AO,
IBL, foliage or any appearance claim, because the thing being judged is partly the thing SwiftShader
approximates.

### If the GPU does not arrive (R3c) — reversible

As written, that paragraph makes this standard **currently unexecutable**: every frame available today
is SwiftShader, and the transport is unproven (`orchestration/status/GPU-TRANSPORT-20260814.md` — SSH
abandoned because the agent proxy re-terminates TLS, an HTTPS control agent in progress, and it may
fail). Unamended, a failure there stalls every child behind a gate none of them can run, which rule 0
forbids. So:

**If the transport is not proven by the time the first child reaches its critic**, appearance gates run
on SwiftShader at the `child-scoped` profile, and:

- **Delta and paired rows are unaffected and stand as full evidence.** `Craft ≥ pre-X + 1.5`, every
  sabotage matrix, every null control, determinism, the library census and every regression tripwire
  compare like with like through the same rasteriser.
- **Protocol A results are recorded as a floor, not an estimate.** Our SwiftShader frame is paired
  against a native capture of a shipped game; the comparison is unequal in our disfavour, so a win is
  real and a loss is not conclusive. State it that way in the verdict, every time.
- **These rows stay open and CARRIED until one native run exists:** MSAA sample quality, anisotropic
  filtering, and every absolute frame-time and draw-call budget. **A child may not be declared
  build-satisfied with a CARRIED budget row quietly closed** — that is the precise shape of the
  failure directive §9 describes, a dashboard reading green over an unmeasured thing.

**Reversal:** the transport lands and this section lapses; the CARRIED rows are re-run natively.
**Falsifier, and the first thing to check on the first native run:** if SwiftShader and native disagree
on a *delta* rather than an absolute, the first bullet is wrong and every delta taken under this
fallback must be recaptured.

`node tools/contention.mjs` before every browser. One reusable browser and one capture pool per run;
byte-identical valid captures are reused across metrics rather than recaptured.

## 5. What is committed and what is not

Committed: `tools/visual/deck.json`, the contact sheets (downsampled tiled JPEGs — small, and they
are the artefact that makes progress visible over time), `reports/visual-truth/INVENTORY.md`, the
text verdicts with exact reproduction commands, and the per-frame hash manifests.

Not committed: raw PNG sequences, orbit frame dumps, transient moving derivatives, anything from an
external reference source beyond its text manifest and hash.

`docs/shots/` receives a dated selection for the progress pages and the twice-daily roundup
(directive §5, §7) — plain English, warm register, "here is what you should now expect to see in the
game".
