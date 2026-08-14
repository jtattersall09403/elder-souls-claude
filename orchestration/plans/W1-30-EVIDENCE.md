# The evidence standard — the Deck, the orbit, and the defect inventory

**Binding on every W1-30 child and on any piece making a visual or player-experience claim.**
Written 2026-08-14 under `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §2.

> *"it seems to be inspecting relatively few screenshots/images from our actual game… it thinks it's
> fixed the player character body transparency issue, but if you just load the game rotate the
> camera around the player it's immediately obvious that it hasn't."*

One still from one angle is not a measurement. This file defines what is.

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

### Motion — 12 sequences, ≥ 180 frames each

Walk, run, sprint-stop, 180° turn, four-direction roll, jump/fall/land, light attack, heavy attack,
block+hit-reaction, spell release→impact→residue, streamed-boundary walk-through, day→night
time-lapse. Captured as deterministic PNG sequences with per-frame hashes and an animation trace.

**A motion sequence is reviewed as a contact sheet** — every 6th frame tiled, plus the full sequence
as a transient derivative for qualitative judgement with the encoder command and output hash
recorded. A reviewer that looked at one frame of a motion sequence has not reviewed it, and the
contact sheet is the artefact that makes that visible.

### The orbit gate — 24 stops × 3 distances, per character and creature

For the player and for every creature class: the camera orbits at 15° increments at 1.5 m, 4 m and
12 m, at two times of day. 144 frames per subject. This exists because of the transparency defect:
**no character defect may be declared fixed without a clean orbit at the commit that claims it.**

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

### Primary — fresh naive human judgement, anchored

Judges who have not read the plan, seen the code, or judged this piece before. They see the Deck (or
a quarantined subset) alongside **anchored comparison plates**: reference frames from the legal
corpus placed at known ladder positions, so "7" means something outside this project's own head.

Three questions per shot, each 1–10 against the plates:

1. **Craft** — "does this look like it was made by someone who knew what they were doing?"
2. **Place** — "does this look like a specific place with its own character, or generic fantasy?"
   (this is RI-VIS07's question, retained)
3. **The owner's question** — *"is this a screenshot you would send someone to show them a game you
   were excited about?"* Yes/no, and the yes-rate is reported separately because it is the bar the
   owner actually described.

Judges are told which frames are ours and which are references **only after scoring**, and the pack
carries a planted tell the judge must detect before their scores count.

### Secondary — RI-VIS03 M1–M12, as a tripwire only

The statistics keep their literal definitions, units, windows, support counts and hard fails. Their
role changes: **they can fail a build and can never pass one.** A build whose M-battery regresses
against the previous stamped commit is failed without a human looking. A build whose M-battery
improves has established nothing about quality.

This inverts the old contract's weakness. Noise raises texture-detail statistics; noise does not
raise a naive judge's Craft score.

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

**RunPod GPU is available** (`tools/runpod/`, `RUNPOD_API_KEY` and `RUNPOD_GPU_TEMPLATE_ID` in
env) and is the required path for any Deck run that feeds a human judgement or a fidelity metric.
SwiftShader captures are acceptable only for determinism, library-census and boot checks — never for
antialiasing, bloom, AO, IBL, foliage or any appearance claim, because the thing being judged is
partly the thing SwiftShader approximates.

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
