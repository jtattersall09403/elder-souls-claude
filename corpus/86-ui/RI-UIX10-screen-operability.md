---
id: RI-UIX10
title: Operability — every affordance a screen draws must be workable through the shipped input path, and the screen must show what it did
kind: structure
side: neutral
judges: [ui.menu.inventory, ui.menu.journal]
provenance: measured
confidence: high
blind_pair: no
---

> **Written by a critic, mid-critique, under `CRITIC-DOCTRINE.md` §1.3.** The piece under review
> was `T4` (the Morrowind screens), round 2, 2026-08-15. **It is scored, and it is one of the
> reasons that piece failed** — §1.3's third guard was corrected earlier the same day and now runs
> one way only: *"a bar you extended may not be the reason you PASS — but it absolutely may be the
> reason you FAIL, and that is the entire point of extending it."*
>
> **Why it exists, in one sentence.** `CRITIC-DOCTRINE` §1.2b was added on 2026-08-15 and requires
> every critic to *operate* an interface rather than photograph it — but **no reference item carries
> a row that a dead, trapped or silent control fails**, so an operability defect had nowhere to
> land except a critic's prose, and prose does not move a number.
>
> **What it does NOT judge, so it does not overlap its neighbours (rule 10).** *Which* buttons are
> bound to what, on which device, and whether the binding table is a model — `RI-JRN03` §A/§B and
> `RI-JRN04` §C, cited and not restated. *Whether the controls are discoverable* — `RI-JRN04` T1 and
> `RI-JRN03` DS5. *What the screen contains* — `RI-UIX03` §B/§C, `RI-UIX04` §A/§B. *What it is made
> of* — `RI-UIX06`. *How full it looks* — `RI-UIX09`. *Whether the world keeps running behind it* —
> `RI-UIX03` §A. This item judges one property only: **press the thing, and does the thing happen,
> and can you see that it happened.**

## The bar

**A screen is a machine, not a picture.** Morrowind's inventory can be worked: every tab selects,
every row picks up, every slot takes what you drop on it, the scroll bar scrolls, and the moment you
equip something the figure in the corner is wearing it. Nothing on that screen is decorative, and
nothing on it makes you wait to find out whether your press landed.

**The failure this item exists to prevent has already happened twice in this project, three weeks
apart, and neither time did any check see it.**

1. **The dialogue window measured `ΔE 0.00` against the owner's own reference capture** — a perfect
   score on every appearance check the corpus held — and **had no pointer path at all**. Every drawn
   control was a picture of a control. The owner found it by opening the game. That is what
   `CRITIC-DOCTRINE` §1.2b was written for.
2. **The journal, on the very build this item was written against, becomes a search box forever**
   after one press of the button its own foot hint invites. Fifteen actions were tried; none returns
   it. `RI-UIX04` scored **10 / 12** on the same build, because every row it has is about what the
   journal *contains*.

**The general shape, and it is the reason this is an item rather than a note:** an appearance bar
and a content bar can both be fully satisfied by a screen nobody can use, and when that happens the
corpus reports a pass. `RI-UIX09` is this item's sibling — it was written because a screen could be
*empty* and score full marks. This one is written because a screen can be *dead* and score full
marks.

## The reference artifact

**No image is acquired by this item, and that is a property of what it judges rather than a
shortcut.** Operability does not live in a still — a photograph of a working screen and a photograph
of a dead one are the same photograph, which is the entire finding behind `CRITIC-DOCTRINE` §1.2b.
The reference for this item is therefore **behavioural**, and it comes from three places already on
disk:

| Source | What it establishes | Where |
|---|---|---|
| `corpus/70-visual/refs/morrowind/REF-A12b/REF-A12b-inventory__mw-15538700.jpg` (+3 siblings) and `REF-A12b-character_sheet__mw-*.jpg` ×4 | **what a Morrowind screen offers**: four category tabs, ~60 pickable object cells, a paper doll with occupied slots, a scroll extent, an encumbrance bar. Every one of those is an affordance, and the count of them is what O1 is measured against. Cited for the **inventory of controls**, never for their appearance. | vendored 2026-08-06 |
| `corpus/70-visual/refs/morrowind/REF-A12/mygui/openmw_*.layout` | the same set expressed as widgets with skins and hit rects — an affordance list a machine can read, which is why §Comparison-method 2 asks for a count rather than a list somebody typed | vendored with the visual acquisition |
| **This repo's own two incidents**, which are the item's real provenance | the dialogue window that measured `ΔE 0.00` and could not be operated (`reports/uix08/drive-probe.json`); the journal that becomes a search box forever (`corpus/90-verdicts/wave1/artifacts/T4-r2c/reports/screens-focus.json`) | 2026-08-15 |

**These are `side: morrowind` plates and this item is `side: neutral`, so the bifurcation rule needs
one sentence:** the plates are cited for **what controls exist on the screen**, which is a structural
fact and not a visual judgement. Nothing in this item is a fidelity or an art-direction claim, and a
critic scoring it does not need a `VIS DECLARATION` — but if one is cited for how a control *looks*,
that is `RI-UIX06`'s row, not this one's, and the citation belongs in that pass.

### §A — The three properties

| # | Property | Requirement |
|---|---|---|
| **O1** | **Every drawn affordance is operable** | For every element the screen declares that a player could act on — list row, category, tab, page turn, slot, close control, sort control, search control, transfer control, confirm — there exists at least one input in the build's own action set that operates it, delivered through the **shipped input path**. |
| **O2** | **No state has no exit** | From every state a screen can be driven into, some input in the action set returns it to the state before, or leaves the screen. A sub-view you can enter and cannot leave is worse than one that does not exist, because the player has lost the screen and does not know why. |
| **O3** | **The press is visible** | Within **15 frames (250 ms at 60 Hz)** of an accepted input, something the player can see has changed: the focus moves, the list reorders, the detail changes, the figure changes, or a stated in-progress state appears. An input that is accepted and produces no visible change for longer than that is indistinguishable from a dead control. |

**O3's number is the one to argue with and it is deliberately generous.** 250 ms is four times the
usual UI-response guideline and is set so that a genuinely committed action — `RI-UIX03` P7's
30-frame equip commitment — is *not* failed for taking 30 frames, provided the screen says so. What
O3 fails is **silence**: an action that is queued and then shows nothing at all, so the player
presses again, and again.

### §B — How it is driven, and the two traps

**Real events only.** `KeyboardEvent`, `MouseEvent`, `PointerEvent`, and a synthetic
`navigator.getGamepads()` descriptor. **Never a function the UI also calls, and never a write to the
focus state.** A test that reaches past the input layer cannot see a dead input layer, which is
exactly what shipped: `tools/ui/dialogue-window-probe.mjs` scored 22/25 by assigning
`eng._convPending` while the window could not be operated at all.

**Two instrument traps, both already documented, both of which produce FALSE FAILURES:**

| # | Trap | What it does | Disarm |
|---|---|---|---|
| **I0** | `?harness=1` / `setMode('harness')` | `Engine.setMode` calls `real.detach()`, so a `KeyboardEvent` dispatched at the page reaches nothing and **every check below it fails against a game that is fine**. | `setMode('play-instrumented')` — real listeners, harness-driven clock. Then assert `real.attached` **and** that a movement key moves `input.moveX`, before believing anything. |
| **I1** | device class | `input/real.js applyDeviceClass()` attaches the touch listeners **only** on class `handheld`. On a desktop class a `PointerEvent` reaches nothing. | `setViewport({pointer:'coarse'})`, then assert `real.touch.attached`. |
| **I2** | **a hold gate cannot be crossed on a paused screen** | `desktop.hold_gate_frames` is consumed by `promotedAtRelease(tDown, tUp, gate)`, and `hold-gate.js` `inputNow()` returns **`frame * STEP_MS` in every mode except `play`**. Outside combat an open screen **pauses the world** (`RI-UIX03` §A, working as designed), so `getFrame()` does not advance — measured: still **5** after `stepFrames(20)`. `framesHeld` therefore computes **0** against a 12-frame gate, the hold never promotes, and **a perfectly healthy gated control reports dead**. In mode `play` the gate reads `event.timeStamp` and a real player is unaffected. | Drive the gate in mode `play`, or step the world with the screen shut, or read `real._holds[control].fired` and `framesHeld` rather than the outcome. **Never** conclude from a harness run that a gated control on a paused screen is broken. |

**I2 is new and is contributed by this item, and it is the expensive one.** The `T4` round-2 critic
recorded a `two_hand` failure **three times** — a 4-frame hold, an 8-frame-plus-400 ms-wall-clock
hold, and a 20-frame hold — before reading the four pipeline points that showed the frame counter
frozen at 5. Two of those three would have gone into a verdict as a defect. I0 and I1 are
`dialogue-drive-probe.mjs`'s and are cited rather than re-derived.

### §C — The device arms

`CRITIC-DOCTRINE` §1.2b clause 4: *"on every supported input device, keyboard, mouse, touch and
gamepad, or state plainly which you could not test and score that arm 0 fail-closed."*

**"Supported" is a claim the build makes, not one the critic assumes.** A build that declares no
pointer path for a surface (`game/src/ui/system.js` rule 2: *"no cursor, no hover, no drag, no click
target"*) is not failed for a click doing nothing — **it is failed if it DRAWS something that invites
one and then ignores it.** The distinction is O1's, and it is the whole reason O1 is phrased as
"every drawn affordance" rather than "every device".

| Arm | Passes when | Fails when |
|---|---|---|
| keyboard | every affordance in §A O1 is operable | any is not |
| gamepad | the same set is operable through `GAMEPAD_BINDINGS` | any is not — the owner plays on a GameSir X2s |
| touch | the same set is operable, including the **directional** half (a list you can open and cannot walk is not operable) | any is not, on a `handheld` device class with I1 disarmed |
| mouse | either every drawn affordance responds, **or** the surface declares no pointer path and draws nothing that implies one | a drawn control that a click lands on and nothing happens |

## Comparison method

1. **Boot in `play-instrumented`, disarm I0**, and assert the instrument before measuring:
   ```bash
   node tools/ui/t4-r2-critic-drive.mjs --state ui-journal
   ```
   The probe's `I0` check is the gate: `real.attached`, `ArrowRight → input.moveX ≠ 0`, and a bound
   key producing a non-zero `pendingPress`. **If I0 fails, every result below it is void.**

2. **Enumerate the affordances from the screen's own census**, not from a list you wrote:
   `getUIState().elements` filtered to the actionable kinds (`list_row`, `category`, `panel_header`
   controls, `page_count`, `scroll_extent`, sort and search controls, `detail_panel`, `doll`,
   `quick_slots`). Record the count. **"I operated the screen" with no count is indistinguishable
   from not having looked.**

3. **Operate each one and record the state AFTER**, per §1.2b clause 5. `{action, before, after}`
   for every interaction, in a JSON report. "No error was thrown" is not a record.

4. **O2, the exit walk.** From every sub-view a screen can enter, press **every action in the closed
   set** (`RI-JRN03` §A) one at a time, plus all four axes, and record where each one lands. An exit
   exists or it does not; this is an enumeration, not a judgement. Then close the screen and re-open
   it and check whether the sub-view persisted — a trap that survives a re-open is permanent for the
   session.

5. **O3, the visibility window.** For each accepted input, diff the declared element list, the focus
   record and the rendered text at `f` and at `f+15`. Report the first frame at which anything
   differs, or `none`.

6. **The device arms (§C).** Keyboard by `KeyboardEvent`; gamepad by `setSyntheticPads` with a
   `standard` descriptor; touch by `PointerEvent` after disarming I1, **including a drag in the left
   half for the floating stick**; mouse by `MouseEvent` on a drawn control's own rect.

7. **Record the counts.** Affordances enumerated, affordances operated, states entered, exits found,
   arms run. As `RI-UIX02` §Comparison-method 6 requires and for the same reason.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| OP1 | O1 keyboard — every drawn affordance operable | all | any drawn affordance with no input that works it |
| OP2 | O1 gamepad — the same set through the pad | all | any |
| OP3 | O1 touch — the same set, buttons **and** the directional half | all | a screen that opens on touch and whose list cannot be walked |
| OP4 | O1 mouse — §C's row | responds, or no pointer path declared and nothing drawn implies one | a drawn control a click lands on and ignores |
| OP5 | **O2 — no state without an exit** | every entered state has an exit in the action set | **any state a screen can be driven into with no exit** |
| OP6 | O2 persistence — a sub-view does not survive a close and re-open | it does not | it does, so the trap is permanent for the session |
| OP7 | **O3 — every accepted input shows something within 15 frames** | all | an input accepted with no visible change and no stated in-progress state |
| OP8 | Instrument honesty — I0/I1/I2 disarmed and asserted, counts recorded | all three asserted, counts in the report | a result reported off an undisarmed trap |

Native scale **checks passed / 8**. Any hard fail caps the item at **2**. **Unimplemented scores 0**
— a screen with no input path at all scores 0 here, and that is the intended reading.

| Ladder | 0 | 2 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| Native | no input path to the screen at all | a hard fail is triggered (OP5 or OP7), whatever else passes | 5 / 8, no hard fail | 7 / 8, no hard fail | 8 / 8 on all four device arms |

**Aggregation (a property of this item):** count of passing checks; any hard fail caps at 2.

**What we lose looks like** — the `T4` round-2 measurement, recorded here as the worked example
rather than invented (`corpus/90-verdicts/wave1/artifacts/T4-r2c/reports/`):

```
OP5 journal: `confirm` on the chronicle enters `focus.journal.view = 'search'`.
    15 of 15 actions tried; none returns to the chronicle. `roll` exits the
    whole screen. `backOrSub()` — the method written for exactly this — is
    defined at ui/system.js:711 and CALLED NOWHERE.               HARD FAIL
OP6 re-opening the journal returns to `view: 'search'`, query intact. FAIL
OP7 inventory: confirm on a weapon row, out of combat, 60 frames with the
    screen open: equipment unchanged, doll unchanged, list unchanged,
    detail unchanged. The frame counter is FROZEN at 5 (the pause rule,
    working correctly), so `_finishEquipCommit`'s `frame >= at + 30` cannot
    fire until the screen is shut. It lands 90 frames after you close it.
    Nothing on the screen says so.                                HARD FAIL
OP3 touch: the drawer exposes `menu`/`swap_left`/`swap_right` and they work,
    so a screen opens and its pages turn — and the floating stick does not
    move the focus, so the list inside it cannot be walked.             FAIL
=> 2/8, capped at 2. Every RI-UIX04 structural row passed on the same build.
```

## How we lose

- **This item is read as "add a mouse".** It is not. §C's mouse row explicitly passes a build that
  declares no pointer path; what it fails is a drawn control that lies. The owner plays on a pad and
  a menu that needs a mouse is a menu they cannot use.
- **The probe reaches past the input layer** because that is easier, and reports a working screen.
  Every existing T4 instrument does this (`t4-r2-measure.mjs`, `critic-t4-lean.mjs`,
  `critic-t4-shots.mjs` all drive through `openMenu()` and `uiFocus()`), which is why none of them
  could see any of the three failures above. §B's "real events only" is the whole item.
- **An instrument trap is reported as a defect.** I0, I1 and I2 each turn a healthy build red. The
  `T4` round-2 critic hit I2 twice and would have shipped a false failure against `two_hand` if it
  had not gone and read the gate. **OP8 exists so that "I disarmed the traps" is a check rather than
  a claim**, and a verdict that fails a control without asserting the instrument is not evidence.
- **O3 is used to fail a committed action.** A 30-frame equip commitment is `RI-UIX03` P7 and is
  *required*; O3 does not fail it, it fails a commitment the screen does not show. The fix for the
  T4 case is one drawn element, not a change to the commitment.
- **The exit walk is done by reasoning about the code instead of pressing.** `backOrSub()` exists,
  reads correctly, handles the search view exactly as it should, and is never called. A reader of
  that file would have concluded the exit works. Only pressing fifteen buttons found it.
- **Someone measures operability on the happy path only.** The trap is in the sub-view, the second
  page, the container's far column, the empty category. §2.1's escalation ladder applies here as
  everywhere: take the ugly sample.

## Seam (AR-3)

**Sterile.** Nothing here crosses the Souls/Morrowind line. Both traditions require that a control
you draw is a control that works, and `RI-UIX03` §A P6 — combat inputs stay live while the screen is
open — is the one place the fight and the menu share input, and it is that item's, not this one's.
Record `seam_sterile: true`.

## Provenance note

`provenance: measured`, `confidence: high`.

**`measured` is claimed for the failure cases in §A and the traps in §B**, all of which are
measurements taken on this repo and are cited to artifacts:
`corpus/90-verdicts/wave1/artifacts/T4-r2c/reports/screens-drive.json` (36 checks, every interaction
recorded with its before and after), `.../screens-focus.json` (the fifteen-action exit walk and the
equip timing), and `reports/uix08/drive-probe.json` (the dialogue window, from which I0 and I1 come).

**Everything in §A's thresholds is `constructed`:** the 15-frame visibility window is the only
number in this item, and **it is the number to challenge**. It was chosen as four times the ordinary
100 ms UI-response guideline specifically so that `RI-UIX03` P7's 30-frame equip commitment is not
failed by it — the commitment is 30 frames and O3 allows 15, so a build that shows an in-progress
state on the press passes and a build that shows nothing does not. *Reversible: the evidence that
would overturn 15 is a build whose committed actions all show an in-progress state and which still
fails O3 on an action nobody could reasonably expect to be instant.*

**`confidence: high`, and the reason is stated so a critic does not have to find it:** unlike
`RI-UIX09`, every check here has a demonstrated instance on a real build, in both directions — OP5,
OP6 and OP7 have measured failures and OP1/OP2 have measured passes on the same screens in the same
run, so the item is known to be able to go both red and green.

**Harness additions requested:** none. Everything this item needs already exists —
`setMode('play-instrumented')`, `setRenderRate(0)`, `setViewport`, `setSyntheticPads`, and
`getUIState().focus`. That is deliberate: `RI-UIX02` already owes five analysis tools that do not
run, and a sixth would be a sixth thing that does not run.
