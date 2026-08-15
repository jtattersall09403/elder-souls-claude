# W1-F10-r9-CRITIC — the contrapposto, judged

**FAIL · ART 2/10 × FIDELITY 3/10** (an ordered pair, never averaged — CC-5)
Branch `codex/wave1-build-experiment`, judged at `7ccf5581`. Pass threshold 7.

**FIDELITY was not re-measured.** The 3 is the standing `W1-F10-CHARACTERS` verdict's number. This
verdict declares `axis: art-direction` and did not run `RI-VIS08`.

---

## The one-line answer

**The stance change is real, it is visible at 2.5 m on real hardware, and `RI-VIS10` C3 genuinely
passes — I re-derived all six numbers with an instrument I wrote myself and they agree to four
decimal places. It also lifted every character in the game about a centimetre off the floor, and the
system the round said would absorb that is mathematically incapable of doing so.**

---

## What the round said it could not do, and what happened to each

| The round's own `what_i_could_not_do` | Outcome |
|---|---|
| "**The stance fix is not photographed on hardware**" | **DONE.** 24 frames, both arms, one process, one Pod, RTX A5000, `{"LIVE":12}` on both arms, 0 red. ~$0.02. |
| "**I shot the player face and did not look at it**" | **DONE.** All eight FP frames opened at 3× and 5×. r8's eye change landed (mean RGB 117/94/38 → 87/71/39) and **still does not read as an eye**. |
| "**I scored 1 of RI-VIS10's 18 checks**" | **12 of 18 censuses now published** — the item's 12-census floor is cleared for the first time, so it scores its arithmetic (**4 of 18 pass → 2/10**) instead of the 0 the floor was forcing. |
| "**The character stands 8.9 mm higher and I did not resolve it**" | **MEASURED — and it is not absorbed.** This is the `biggest_gap`. |
| "**I ruled on the crack pixels**" | **RULING HOLDS.** Both dumped frames opened; the red is daylight beside the body capped by the greatsword's crossguard, exactly as claimed. |
| "**No blind gate**" | Correct and not a blocker: `RI-VIS10` is `blind_pair: no`. But **B1, C4 and D4 need a fresh judge and no critic can spawn one** — three of eighteen checks, 17% of the score, never runnable. **The orchestrator owes these** (`CLAUDE.md` rule 0e). |
| "**I opened 5 motion references of 217**" | Improved by class rather than by count: I added an **M5 boss moveset** and a telegraph clip, which the round opened none of, plus **our own idle in motion**. Still a sample. **There is no K2 creature motion in the reference set at all** — zero files match — which is a hole in the refs, not a shortfall. |

---

## The gap: the contrapposto lifted every character off the ground

Measured three independent ways, and they agree.

| | before | after |
|---|---|---|
| lower ankle, rig, mean over the 96-frame loop | — | **+7.96 mm** (min 7.1, max 8.87) |
| drawn ankle above ground, **running game, RTX A5000**, flat player stand | 0.0890 / 0.0901 m | **0.0961 / 0.1012 m** |
| frames of the idle loop with **both soles clear of the ground** | 24 / 96 | **68 / 96** |
| largest daylight under the lower sole | 2.0 mm | **10.9 mm** |
| left/right foot height difference **as drawn in the game** | 0.0011 m | **0.0052 m** |

**The round's stated reason for leaving it is false.** Its status file says *"r7/r8's foot conform is
designed to absorb exactly this… so it is plausibly absorbed."* `footConformDelta` is
`clamp(groundAt(x,z) − groundY)` — a terrain **difference** term. On flat ground it is exactly zero,
which that file's own comment calls *"the correct null, which a pin can never have"*, and which round
7 measured at **0.0000 m at all three F10 stands**. A term that is identically zero cannot absorb a
constant.

The remedy is one line of data and it is in the verdict JSON.

---

## RI-VIS10, all eighteen

**PASS: B3, C1, C3, E2. FAIL: the other fourteen.**

Three of the passes are worth separating, because two of them are not this round's:

- **C3 — this round's.** Shoulder −0.313° → −6.297°, hip **exactly 0.000°** → +5.000°, at both frames,
  opposite signs, frames differ.
- **C1 — rounds 6–8's, and nobody had re-measured it.** On the standing verdict's own tool, pose and
  41-figure roster: **5.87–6.84 heads, median 6.58, 0 of 41 in band → 7.35–7.84, median 7.57, 41 of 41
  in band.** A hard fail became a pass and the gap ledger did not know.
- **B3 — an earlier round's.** The build now has tail geometry; the standing verdict failed B3 because
  it had none.

And the failures that matter most:

- **C2** — median pairwise IoU **0.8550** (needs ≤ 0.80) and **several pairs at IoU 1.0000**. Not
  similar: identical.
- **E1** — 32 actors for 408 records (needs 34); `townsman` at **23.8%** (ceiling 10%). And on the arm
  this verdict added: **14 reachable rendered bodies for 408 records, one per 29.**
- **B4** — the face reads **1 of 7** landmarks at conversation framing on an RTX A4500. 74.7% of the
  head's vertices are buried behind other surfaces.
- **D3** — **2 of 8** required materials reach a garment. Only `reed` and `chitin`.
- **E4** — **93 pairs** of identically-rendered NPCs standing within 15 m of each other.

---

## What I changed in the bar, and why it cannot be why anything passed

**`RI-VIS10` E1, amended — ADD-only.** The census must now also count the body the renderer *draws*,
not only the `actor` field. `characterFor` picks the body as `FNV1a('npc:'+eid) % pool.length`;
`actor` reaches the simulation and never reaches the camera, yet it is the denominator throughout §D
and §E. **E1 already failed on the old arm and fails harder on the new one**, so this extension is a
reason to fail, never a reason to pass — which `CRITIC-DOCTRINE` §1.3 says is the entire point.

**`HAZARDS` §20a/20b/20c** — the `anim-author` landmine with its reproduction table, the `--pose`
fallback that is benign at phase 0 and not otherwise, and measuring off a shared tree that is
mid-edit.

---

## What I could not do

No fresh judge, so **B1, C4 and D4** are failed closed. I deliberately did not run **D2** and **D5** —
they are the cheapest remaining censuses and they are a piece of work, not a pass. I did not re-run
**RI-VIS08**. My **E4** is a static proxy for a check that asks for a 60-second walk. I drove no
inputs, because this piece ships no interface — so everything here is about pictures and poses, not
about play.
