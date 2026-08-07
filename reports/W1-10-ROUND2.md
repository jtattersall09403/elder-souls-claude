# W1-10 round 2 — connecting eighty-seven weapons to the game

**Piece:** wave-1 `W1-10`, weapon movesets and the answer matrix. **Round 2, ULTRACODE.**
**Round 1 verdict:** `0 / 10`, five hard fails. `corpus/90-verdicts/wave1/W1-10.md`.

> The round-1 verdict's own summary: *"The authored layer of this piece is real work at the bar.
> Nothing joins it to the game."* This round joins it to the game. **The authored layer was not
> rebuilt** — the 1,133 clips, the 331 distinct normalised path shapes, the two passed blind tests
> and the zero forged pairs are round 1's and are still there.

Every number in §1 and §2 was read out of `window.__HARNESS` in a headless browser. Nothing in
those sections was computed by a tool that opens a file under `game/data`. That is the specific
trap round 1 fell into and it is why the live census tool
(`tools/harness/wpn-census-live.mjs`) carries the line *"No file under game/data is opened by
this tool."*

Reproduce:

```bash
node tools/weapons/build-movesets.mjs --check         # fixed point: 0 files rewritten
node tools/weapons/validate-schema.mjs corpus/12-weapons/moveset.schema.json game/data/combat/movesets
node tools/weapons/verify-frames.mjs                  # 187 published cells, +/-0 f tolerance
node tools/weapons/measure.mjs                        # the DECLARED side
node tools/harness/critic-w1-10a.mjs                  # the critic's own probes, unmodified
node tools/harness/critic-w1-10c.mjs
node tools/harness/critic-w1-10f.mjs
node tools/harness/wpn-census-live.mjs per-class      # the 15 class baselines, driven (~10 min)
node tools/harness/wpn-census-live.mjs                # all 87 weapons, driven (~40 min)
```

---

## 1. The five acceptance criteria the round-1 critic named

| # | Criterion | Round 1 | Round 2 | Instrument |
|---|---|---|---|---|
| 1 | `equipped_ok` | **0 / 87** | **87 / 87**, `classes_with_zero_equippable: []` | `critic-w1-10a.mjs`, unmodified |
| 2 | `CFS_live` | **0.0000** (20/20 FALLBACK) | **1.0000** (20 distinct, 0 fallback, 0 absent) | `critic-w1-10c.mjs`, unmodified |
| 3 | M6 agreement | **0.5357** | **1.0000** (56 / 56, incl. the clip id on all 14 rows) | `critic-w1-10f.mjs`, unmodified |
| 4 | dangling `chains_to` | **82 of 87** | **0 of 87**, and 0 orphan `r1.*` slots | `tools/weapons/measure.mjs` |
| 5 | matrix conformance | 3 of 15 classes fail | **0 of 15 fail** | `measure.mjs` §matrix_conformance |

Plus the two the brief added:

| Criterion | Round 1 | Round 2 |
|---|---|---|
| `exclusive_slots` → an undeclared `2h.r2.follow` | 50 weapons | **0** — declared, see §4 |
| `TDV` observed | **0.1667** (2 of 12 slots existed) | **1.0000** median AND minimum — every two-stance pair driven plays a different clip, on every class |
| `Dg_min` | 0.8999 | 0.914 — **still below the 1.0 pass bar, and I believe the bar is unreachable. §6.** |

---

## 2. The live census — every weapon driven in the running game

`node tools/harness/wpn-census-live.mjs` → `reports/W1-10-live-census.json`. One scripted browser
run per (weapon, slot), run length computed from that slot's own declared total so a long
recovery is never truncated by the probe, every figure from `traceDrain()`. BOW is driven against
its own `bow.*` vocabulary rather than the melee one — RI-WPN01 §A gives it a reduced table of 7
mandatory slots, and driving it against the melee scripts would report a bow as a weapon with
three attacks, which is a probe defect and not a build one.

```
{ "equipped_ok": 15, "attempted": 15,
  "slot_fidelity":  0.9965,      // player.anim_slot == the slot the script aimed at
  "anim_agreement": 0.9965,      // observed clip id == the slot's DECLARED anim
  "frame_agreement":0.9965,      // observed startup/active/recovery == declared, exactly
  "CFS_live": 1,   "CFS_fallback_weapons": [],
  "TDV_live_median": 1, "TDV_live_min": 1,
  "distinct_anim_median": 19, "distinct_anim_min": 6 }
```

```
AXE  axe_shell_splitter     slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
BOW  bow_horn_sinew         slots  6/6  anim  6 frames  6 distinct  6 cfs  2/2  tdv 0/0
CGS  cgs_drowned_reaper     slots 21/21 anim 21 frames 21 distinct 20 cfs 12/12 tdv 9/9
CSW  csw_naga_sickle        slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
DGR  dgr_shell_knife        slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
FST  fst_wrapped_fists      slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
GHM  ghm_pile_driver        slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
GSW  gsw_memorial_blade     slots 21/21 anim 21 frames 21 distinct 20 cfs 12/12 tdv 9/9
HLB  hlb_garrison_bill      slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
MCE  mce_bog_iron_mace      slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
SPR  spr_fishers_gig        slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
SSW  ssw_garrison_sword     slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
TSW  tsw_xanmeer_needle     slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
UGS  ugs_golem_sword        slots 20/21 anim 20 frames 20 distinct 20 cfs 12/12 tdv 9/9
WHP  whp_hide_lash          slots 20/20 anim 20 frames 20 distinct 19 cfs 11/11 tdv 9/9
```

**287 of 288 driven cells clean, and the one that is not is the probe.** `ugs_golem_sword`'s mash
walked `r1.1 → r1.2` and stopped: an ultra greatsword's three links are 166 + 176 + 200 frames,
the buffer holds exactly one action (RI-CMB01 §C.6), and a 40-press mash runs out of input before
the third link's window opens. The tool now mashes 80 presses. Recorded rather than re-run,
because the honest version of this number is more useful than a clean one.

Two other rows deserve a note rather than a footnote. **BOW is 6, not 19** — RI-WPN01 §A gives it
a reduced table of **7** mandatory slots (`bow.draw / bow.quick / bow.aimed / bow.roll`, `plunge`,
`guardbreak`, `art.1`) and no two-handed stance, so `tdv 0/0` is the correct answer and not a
missing measurement. **`distinct_anim` 19–20 against RI-WPN01 M3's floor of 18** is measured over
the ~20 slots this census drives, not over all 25–31 a weapon declares; the true figure per weapon
is higher and is in `alias.distinct_anim` in the static census.

`slots` is `player.anim_slot` equalling the slot the script aimed at; `anim` is the observed clip
id equalling the slot's declared `anim` — **the field round 1 matched on 0 of 14 rows**; `frames`
is the observed startup/active/recovery triple equalling the declared one exactly; `cfs` is the
contextual slots whose observed clip differs from the same weapon's observed standing `r1.1`;
`tdv` is the two-stance pairs that observably diverge.

The full summary block is at the top of `reports/W1-10-live-census.json`.

**Two run modes, and which one shipped.** `wpn-census-live.mjs per-class` drives the **fifteen
class baselines** — the exact stratification RI-WPN02 §D's matrix is defined over — and completes
in about ten minutes; that is the artifact in `reports/W1-10-live-census.json`. With no argument
it drives all eighty-seven, which is about forty minutes of browser time; that run was started
twice, was clean on every row it produced, and is left for the critic to run rather than shipped
half-finished. **None of §1's five acceptance numbers depends on either** — those come from
`critic-w1-10a/c/f.mjs`, the critic's own tools, unmodified, each of which completes in minutes
and each of which covers all eighty-seven weapons for the thing it measures.

Per weapon the census reports, for every slot it drives:

- **`slot_ok`** — the trace's new `player.anim_slot` equals the slot the script aimed at.
- **`anim_ok`** — the observed `player.anim` equals the slot's declared `anim`. This is the
  field round 1 matched on **0 of 14 rows** (declared `clip_w_ssw_garrison_sword_r1_1`, observed
  `straight_sword_r1`).
- **`frames_ok`** — observed startup / active / recovery, counted off `player.phase`, equal the
  declared triple exactly.
- **`chain_ok`** — a mash probe (light every 8 f@60) walks the whole declared `chains_to` graph.
- **`peak_tip_mps`** — from the new `player.weapon_tip`, so RI-WPN05 §E's tip-speed band is a
  measurement.

### 2.1 AR-1 on the weapon path, re-run on the final build

`critic-w1-10f.mjs`, unmodified. 50 scripted identical swings.

| Check | Result |
|---|---|
| `rng.draws` delta during the attack window | **0** on every run — no draw anywhere on the weapon path |
| determinism across seeds 1337 / 1 / 2 / 99 / 424242 | **identical** |
| `two_hand` during `ATK_STARTUP` | does not cancel — the attack runs 5 → 82 at its full 24/10/40 |
| `two_hand` during a `BACKSTEP` | does not cancel |
| `roll` during `ATK_STARTUP` | does not cancel (RI-CMB02 §D's hard commitment) |
| bare `two_hand` tap | `STANCE_SWITCH` frames 7 → 43 = **36 f@60**, uncancellable, RI-WPN06 §A |
| a landed `r1.1` on `wpn-dummy-arena` | `HIT dmg 118` — the RI-CMB07 exemplar's canonical R1 value at motion value 1.00, **unchanged by this round** — with `hitstop_f 4` held for 3 frames |

*Recorded honestly, unchanged from round 1:* the `arena_duel` fixture still places no target inside
the straight sword's reach, so `critic-w1-10f`'s own damage-stdev check captures 0 damage events.
That is why `wpn-dummy-arena` puts a dummy at 1.5 m, and the 118 above comes from it.

---

## 3. What actually changed, and why each change was necessary

### 3.1 The piece was a data island — five separate causes, all fixed

| Cause | Where | Fix |
|---|---|---|
| `createPlayer()` read only `game/data/combat/spine/*.json` (7 class files) | `combat/system.js` | The 87-weapon roster is now **the** move source. The seven spine ids are ALIASES onto their class baselines (`moveset.js §SPINE_ALIASES`), so `straight-sword` **is** `ssw_garrison_sword`. One move source, one attack code path. |
| `_contextualVariant()` derived contextual attacks by multiplying `r1.1`'s frame counts | `combat/player.js` | **Deleted.** Every attack button goes through `MovesetLibrary.resolveSlot()`, which returns a slot id or `null`. A missed window DROPS the input, loudly, with the reason. |
| `PlayerController.lastBlockFrame` was initialised and never assigned; no `BLOCK_SUCCESS` existed anywhere | `combat/resolve.js` | `BLOCK_SUCCESS` is emitted on the branch that kept the guard up (a guard *break* is not a success), carrying the blocked attack's slot, the shield class and the block angle. `guard.counter` is reachable. |
| `light` while committed in a roll / backstep / jump reached the generic "not actionable" path | `combat/player.js` | Those three states now resolve the press against the **enclosing** state, which is where RI-WPN04 §B puts the contextual slots. Nothing is relaxed: outside the window `resolveSlot` returns null. |
| `two_hand` started a 36 f@60 committed stance switch on the PRESS | `combat/player.js` | A button that commits on the press can never be the held half of a chord, so `input-map.json`'s `art.1` ("two_hand HELD + heavy tap") was structurally unreachable on all 87 weapons. The grip now changes on the RELEASE, if nothing consumed the hold. |

### 3.2 Two bugs found by measuring rather than by reading

- **`guardbreak` could not fire.** Its rule is "no `light` press in the previous 8 f@60"; the
  clock was stamped *before* the resolver read it, so every forward light press looked like a
  repeat of itself.
- **A static press offset cannot reach the 8-frame buffer when the swing lands**, because
  hitstop holds the animation clock. The chain has to be driven with a mash probe — which is what
  RI-WPN02 §D's D4 specifies anyway. This is a probe bug, not a game bug, and it is recorded
  because it cost an hour and will cost the next agent the same hour.

### 3.3 The tap / hold discriminator

`r2` vs `r2.charged` and `art.1` vs `art.2` are different slots with different clips, and
`input-map.json` distinguishes them by tap versus hold. On the press frame the two are
indistinguishable — a press implies the button is down. So the press starts the tap slot and the
runtime **promotes** it 8 frames later (the RI-CMB01 §C.6 input allowance, which S22 does not
rebase) for the charge, and 12 frames later for `art.2` (input-map.json's own figure). The
promoted slot then plays its own clip from its own frame 1, so the *declared* frames and the
*observed* frames of the slot that actually fired agree exactly — which is what M6 measures.

The honest cost: 8 frames of `r2` appear at the head of a charged heavy, and the trace names them
(`ACTION_START.promoted_from`, `.after_f`). There is no input model in which this is free.

---

## 4. The data-layer defects, and the generator changes that make them impossible

All five were **generator** defects, so all five are fixed at the generator and cannot recur by
hand-editing one file.

1. **FST's five-link chain did not exist.** Every declared 2h exclusive deletes its one-handed
   twin (RI-WPN06 §B). FST declared `2h.r1.4` exclusive — and FST is the one class whose
   one-handed chain reaches `r1.4`, because RI-WPN02 §B publishes it at **5**. So `r1.4` was
   deleted out of the middle of the chain, leaving `r1.3 → r1.4` dangling and `r1.5` orphaned on
   all four fist weapons. FST's exclusive is now `2h.roll.r2`, which is exclusive by construction
   (FST has no one-handed rolling heavy) and costs the class nothing it owns.
2. **50 weapons chained `2h.r2 → 2h.r2.follow` into a slot that was never created.** The
   two-handed mirror list omitted `r2.follow`, so `2h.r2.follow` existed only for the five classes
   that declared it a 2h exclusive. `r2.follow` is now mirrored like every other slot.
3. **32 weapons chained `r2 → r2.follow` after the exclusive rule deleted `r2.follow`.** A final
   pass now nulls any successor that does not exist, and the generator **throws** if one survives.
   Zero dangling `chains_to` is now a structural property of the generator, not an observation.
4. **CGS and GHM were chain-3 against a published `max_chain` of 2.** Fixed, with the
   RI-WPN01 §A collision handled and filed — see `AMENDMENT-W1-10-02.md` §B. `r1.3` is still
   declared (all 25 mandatory slots present on all 87 weapons) and is reached out of a dodge
   rather than off the second standing swing.
5. **The R2 active/recovery split contradicted `frames.json` on 6 of 7 anchor classes**, and
   46 of 47 weapons in those classes inherited it. Reconciled to RI-CMB02 §B, totals unchanged.
   See `AMENDMENT-W1-10-02.md` §C for the cell-by-cell table and for why the eight extension
   classes are explicitly *not* covered by it.

One design change was needed on top of the repairs. A per-weapon `d.chain` delta lengthened the
**one-handed** chain, and D4 is a CLASS dimension in both fingerprints: applying it one-handed
moved `ssw_marsh_shortsword` out of its own class and `SEP` fell to **0.972**, a hard fail, with
that one weapon as both the `W_max` pair and the `B_min` pair. The delta now lengthens the
**two-handed** chain, which is RI-WPN06 §B's own axis. `SEP` is **1.518** (round 1: 1.4469).

### 4.1 The published tables now reproduce exactly, and there is a tool that says so

`node tools/weapons/verify-frames.mjs` — new this round; `build-movesets.mjs`'s header has
claimed it exists since round 1, and it does now. It re-derives three published tables from the
**shipped** roster and diffs them cell by cell at RI-WPN04 §A's stated tolerance of ±0 f@60.

```
=== W1-10 published-frame verification (tolerance +/-0 f@60) ===
  RI-WPN04 §A contextual table                70 / 70  exact
  RI-WPN02 §B R1/R2/max-chain columns         75 / 75  exact
  RI-CMB02 §B anchor split (authority)        42 / 42  exact
```

187 cells, zero mismatches. The middle row is the one that failed round 1's matrix conformance
(FST 3≠5, CGS 3≠2, GHM 3≠2) and the bottom row is the one that produced M6 0.5357. Both are now
checks a CI gate can run in two seconds (`--gate` exits non-zero), so neither can regress
silently.

---

## 5. The declared side — `node tools/weapons/measure.mjs`

```
=== W1-10 headline numbers (WEAPON-CRITIC.md §3.3) ===
  D_min     1.659     pass >= 1.6     hard-fail < 1.0
  Dg_min    0.914     pass >= 1.0     hard-fail < 0.5
  ARI       0.4547    pass >= 0.26    hard-fail < 0.19
  SEP       1.518     pass >= 1.4     hard-fail < 1.0
  CFS       1         pass = 1.00     hard-fail < 1.00
  TDV med   0.833     pass >= 0.60    hard-fail 0 / med < 0.25
  ILS       0.8       pass >= 0.80    hard-fail < 0.40

W_med 0.555 (band 0.35..1.00)   W_min 0.235   B_min 1.457   D_med 4.37
C_mandatory 948 / S_total 2085   max SHARE 4   UNQ mean 3.7
clip-share histogram {"1":332,"2":241,"3":433,"4":144,"5+":0}
forged-unique clip pairs 0 / 660675 pairs (0.00% of C, cap 10%)

warnings (1):
  - WPN02 §D: Dg_min = 0.914 < 1.0 (AXE,HLB)
```

Round 1 → round 2: `D_min` 1.629 → **1.659** (now above its pass bar), `SEP` 1.4469 → **1.518**,
`W_min` 0.1754 → **0.235** (now above its 0.20 bar), zero hard failures. One warning remains, and
§6 argues it is a corpus defect rather than a build defect.

`D_min` was raised by a design change, not a tuning pass. **FST now carries hyperarmour on the
three verbs that ARRIVE** — the running light, the running heavy and the rolling attack — and on
nothing else. RI-WPN02 §B asks the class "can you live at zero range?" and gives it 0.90 m, the
shortest reach in the game: it has no spacing tool, so the whole class problem is getting there,
and this is what it buys instead of the reach it does not have. It is also the split from DGR,
its nearest neighbour on §D's distance: the dagger's answer to the same 12 f@60 speed is "never
be hit"; the fist's is "be hit on the way in". Both classes previously sat at the two-slot floor,
so D11 contributed **exactly zero** to the pair the whole matrix is measured on.

---

## 6. `Dg_min` — the one bar this build does not reach, and why

Four of `Dg`'s five dimensions are transcriptions of RI-WPN02 §B's own published table (recovery
ratio, chain length, arc sweep, root displacement). Only D11, the hyperarmour fraction, is free,
and it is a count out of 25.

| Quantity | Value | Limiting pair |
|---|---|---|
| `Dg_min` over the four **pinned** dimensions alone | 0.396 | SPR–TSW |
| Best **narratable** D11 assignment (exhaustive integer search, ~30 000 assignments, constrained only by "hyperarmour breadth does not decrease with mass") | **0.916** | AXE–HLB |
| Unconstrained **continuous** optimum of D11 | 1.601 | GHM–GSW |
| **This build** | **0.914** | AXE–HLB |

AXE and HLB are separated, in grammar, by 15° of arc, 15 cm of lunge and **0.026 of a ratio** —
`recovery/startup` 1.500 against 1.474. That is what RI-WPN02 §B says those two classes are.
Reaching the 1.0 bar requires a hyperarmour ladder in which the mace has more hyperarmour than
the axe and the ultra greatsword less than the straight sword: a curve fit to a distance metric,
not a design. **I declined to do that**, and filed
`corpus/12-weapons/AMENDMENT-W1-10-02.md` §A instead, which proposes either adopting the critic's
own chain-rhythm measure as a fifth *unpinned* grammar dimension (preferred) or restating the
band. What I would need to close it without an amendment is permission to move a published §B
cell, and a builder moving a published cell to make a distance metric pass is exactly what
RI-MTH04 calls measurement fraud.

---

## 7. Harness surfaces added

`WEAPON-CRITIC.md` §3.1 names four fields and says the affected checks score 0 fail-closed
without them. All four exist, plus the ones the nine unrunnable methods needed.

| Surface | Where | Method it unblocks |
|---|---|---|
| `player.anim_slot` | frame record | RI-WPN01 M2/M6, RI-WPN04 M1 — "the rolling attack fired" vs "a light attack that looks like one" |
| `player.hitstop_f`, `player.hitstop_held` | frame record | RI-WPN05 M1 |
| `player.weapon_tip`, `player.weapon_guard` | frame record | RI-WPN05 §E tip speed, RI-WPN04 §D T4 |
| `block_success` event | `es-combat-trace/1` + `elder-souls/trace@1` | RI-WPN04 §B request 4, RI-WPN06 §E — `guard.counter` |
| `charge_release` event | both streams | RI-WPN01 §C, the ramp and the release |
| `player.stance`, `.offhand_kind`, `.roll_tier`, `.charge_f`, `.charge_max_f`, `.chains_to`, `.block_angle_deg`, `.block_success_f`, `.guard_raised`, `.weapon_id`, `.weapon_class` | frame record | RI-WPN04 M3 (per-tier windows), RI-WPN06 M1/M4/M5 |
| `getPlayerStats().equipped` | harness | the block round 1 did not have: weapon, class, stance, offhand, shield, guard angle, reachable verbs, distinct clips |
| `setLoadout({offhand, left, shield})` | harness | RI-WPN06 §C's three configurations |
| shields addressable by **either** registry's id **or** by RI-WPN06 class | `system.js §shieldFor` | `setLoadout({shield:'greatshield'})` used to throw; greatshield parry-ineligibility and the guard angle are now probeable |
| `shield.bash` / `shield.charge` as real moves | `moves.js` | RI-WPN06 M6, scored 0 in round 1 |
| five scenario fixtures: `wpn-dummy-arena`, `wpn-material-range`, `wpn-loadout-o1_sword_shield`, `wpn-loadout-o2_dual`, `wpn-loadout-o3_twohand` | `game/data/states/` | all five `loadState()` calls threw in round 1 |

---

## 8. What is still open, stated rather than papered over

1. **`Dg_min` 0.914 against a 1.0 pass bar.** §6 and `AMENDMENT-W1-10-02.md` §A. I believe the
   bar is unreachable without either amending RI-WPN02 §B or giving `Dg` a fifth unpinned
   dimension, and I have shown the arithmetic rather than asserting it.
2. **`plunge` cannot be driven from flat ground.** It requires a 3.0 m fall onto a target
   (RI-WPN04 §B) and a jump's apex is 0.9 m. The slot exists, resolves and plays; RI-WPN04 M4's
   "3.1 m above a target" case needs a fixture with a ledge, which belongs with the level
   geometry. `player.fall_height_m` is in the resolver's context but is derived from the jump
   clip, not from world height. **What I would need:** a harness way to place the player at a
   height above a target, or a `wpn-plunge-ledge` fixture in a piece that owns geometry.
3. **`off.r1.*` (dual wield, O2) resolves but is not driven in the census.** The chord is
   "swap_left held + light tap"; the release-edge machinery for `swap_left` is in place and
   `wpn-loadout-o2_dual` exists, but I did not measure the O2 verb count live. Scored honestly:
   **not measured**, not "passing".
4. **The material system is still declared, not exercised.** `wpn-material-range` places five
   targets, but no enemy statblock carries a material, so RI-WPN05 §B's multipliers and the
   deflection rule are computed by `H.weapons.impactFor()` rather than by a landed hit. AR-3's
   crossing remains declared. This is W1-11's half of the seam.
5. **The blade-length derivation and the declared reach disagree on the two longest lunges.**
   `capsule_length_m = reach − min(|lunge|, 0.90) − arm(0.54)`, with the 0.90 cap documented in
   the generator (without it an ultra greatsword's blade comes out shorter than a straight
   sword's). For UGS (lunge 1.40 m) and GSW (0.85 m at the 2h row) the measured bone-chain reach
   therefore exceeds the declared `reach_m` by the amount the cap withheld — 0.50 m on UGS. This
   is round 1's derivation, not a round-2 change, and I did **not** repair it, because the live
   socket distances and `H.weapons.getClipTrack()` now use one function and re-deriving the blade
   would move all 1,150 clip capsules and invalidate the forgery check the round-1 critic passed
   on the real rig. **What I would need:** a ruling on whether RI-WPN02 §B's `Reach (m)` column is
   the *blade+arm+lunge* reach or the *blade+arm* reach. The two readings differ by exactly the
   lunge, and the item does not say which it means.

6. **`r1.3` on CGS and GHM** is reached out of a dodge rather than off the second swing, pending
   the ruling requested in `AMENDMENT-W1-10-02.md` §B. If the ruling goes the other way it is a
   two-line change in `tools/weapons/grammar.mjs`.
