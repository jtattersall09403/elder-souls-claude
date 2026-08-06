---
id: RI-JRN03
title: Desktop controls — the action set, pointer lock, discoverability, and a fresh agent with no manual
kind: structure
side: souls
judges: [input.action.set, input.desktop.pointerlock, input.desktop.keyboard, input.rebinding.model, input.discoverability, input.modality.parity, platform.input.pipeline]
provenance: constructed
confidence: high
blind_pair: no
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding:** **This item owns the canonical action set** (`input.action.set`)
> — the fourteen names in `HARNESS.md` §4 — and the **desktop** input path. `RI-JRN04` owns the
> gamepad and touch paths and consumes the action set without redefining it. `RI-JRN04` owns
> the *gamepad profile data*; this item owns the *rebinding model* both use.
> **`RI-CAM02` owns camera behaviour**; this item owns only the mouse-to-look transform and the
> pointer-lock plumbing that feeds it. **`RI-CMB06` owns lock-on semantics**; this item owns
> only the binding. **`RI-JRN01` O11/O12 own the instruction budget for the opening**; this item
> generalises the in-world-inscription mechanism to the whole game and is bound by that budget.
>
> **`blind_pair: no`.** A keymap is not a thing a blind judge can prefer.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A Souls player sits down at a laptop, opens a link, and within ninety seconds is rolling,
attacking, blocking, locking on and sprinting **without having read anything**, because every
verb is where twenty years of third-person action games taught them to expect it. WASD moves.
The mouse looks, immediately, without a "click to play" step they have to discover. Left
button swings. Right button guards. Shift sprints. Space rolls. E interacts. They never see a
cursor, never see a context menu, never lose control because they pressed Escape.

Then they open the settings and **rebind every single one**, including the mouse buttons and
including the modifier-bearing ones, and it works, and it persists.

The negative half of the bar is the harder half. **The game may not tell them any of this.**
`RI-JRN01` O11 sets the instruction budget for the opening at zero pop-ups and ≤ 6 in-world
inscriptions, and this item does not get to spend a different budget. A control scheme that
requires a legend on screen has failed; the remedy is placement and convention, never text.

And the browser is hostile in ways a native game is not. Pointer lock is revocable by the user
agent at any time and *is* revoked by Escape. Keyboards ghost: on a cheap membrane keyboard,
`W`+`Shift`+`Space` may simply not all register. `Ctrl+W` closes the tab. A right-click opens
a context menu over the boss. `keydown` repeat fires forty times a second. The tab loses focus
and every held key is stuck down forever. None of these are theoretical; all of them are the
default behaviour a browser gives you if you write nothing.

## The reference artifact

### A. `ES/ACTIONS` — the canonical action set (BINDING)

The fourteen names in `HARNESS.md` §4 are the closed set. **They are the vocabulary of the
whole project**: the harness accepts exactly these, every input device maps onto exactly these,
and any new verb requires an amendment to `HARNESS.md`, not a new binding.

| Action | What it is | Souls lineage | Held or discrete |
|---|---|---|---|
| `light` | right-hand light attack, chains | R1 | discrete, buffered |
| `heavy` | right-hand heavy attack, chargeable | R2 | discrete + hold-to-charge |
| `roll` | dodge with i-frames; backstep with no directional input | B tap | discrete |
| `block` | guard | L1 | **held only**, never a toggle |
| `parry` | parry / riposte trigger | L2 | discrete |
| `sprint` | run | B hold | held |
| `jump` | jump | L3 / face | discrete |
| `use_item` | consume selected quick-slot item | X | discrete |
| `interact` | talk, open, take, read, rest | A | discrete |
| `lock_on` | acquire/release hard lock | R3 | discrete |
| `two_hand` | two-hand the right-hand weapon | Y hold | discrete (hold-gated) |
| `swap_right` | cycle right-hand equipment | D→ | discrete |
| `swap_left` | cycle left-hand equipment | D← | discrete |
| `menu` | open the menu surface | Start | discrete |

**Rule A1.** Every action is reachable on **every** input modality (keyboard-only,
keyboard+mouse, gamepad-only, touch-only). This is `RI-JRN01` O17 generalised; an action
reachable only with a mouse is a defect.

**Rule A2.** `block` is held, never toggled. A toggle-guard changes the stamina economy
(`RI-CMB03`) and the punish model (`RI-AI03`) and is an AR-1 Souls-leakage failure in reverse:
it is a *convenience* contaminating the fight.

**Rule A3.** No action requires a chord (two simultaneous keys) in the default binding. Chords
may be *offered* in rebinding; they may not be *required*, because §D shows they are the first
thing a keyboard drops.

### B. `ES/KEYS` — the default desktop binding (BINDING)

| Action | Primary | Secondary | Rationale |
|---|---|---|---|
| move | `W A S D` | arrow keys | camera-relative (S18, `RI-CAM02`) |
| look | mouse X/Y under pointer lock | — | |
| `light` | **Mouse 0** (left) | `Q` | the swing is the left button in every third-person action game |
| `heavy` | **Mouse 2** (right)… **no** — see below | | |
| `block` | **Mouse 2** (right, held) | `F` | the guard is the right button; this is the convention that matters most |
| `heavy` | **Shift + Mouse 0** is banned (A3). **`R`** | Mouse 3 (back) | |
| `parry` | **Mouse 1** (middle) | `V` | |
| `roll` | **Space** | Mouse 4 (forward) | |
| `sprint` | **Left Shift**, held | — | |
| `jump` | **Left Ctrl**… **no** — see below. **`Space` double-tap is banned.** **`X`** | — | |
| `interact` | **`E`** | Enter | |
| `use_item` | **`Q`**… conflicts with `light` secondary. **`1`** | Mouse 3 | |
| `lock_on` | **Middle-mouse click** conflicts with `parry`. **`Tab`** | Mouse 1 hold ≥ 12 f | |
| `two_hand` | **`G`** (hold ≥ 12 frames) | — | |
| `swap_right` | **`3`** | mouse wheel up | |
| `swap_left` | **`4`** | mouse wheel down | |
| `menu` | **`Escape`** — **see §C, this is the hard one** | `M` | |

**The above table contains three deliberate collisions**, left visible rather than tidied away,
because resolving them is the actual design work and a build that never notices them will ship
one of them:

- `light` on Mouse 0 and `heavy` on Mouse 2 is the obvious mapping, and it is **wrong**,
  because `block` must be held on Mouse 2 — a Souls player's right hand rests on guard. Heavy
  therefore moves to a key. **Ruling: `block` wins Mouse 2. `heavy` = `R`.**
- `jump` on Space collides with `roll`, and a double-tap discriminator on Space is unacceptable
  (it inserts a 12-frame delay into the most latency-sensitive action in the game).
  **Ruling: `roll` wins Space. `jump` = `X`.**
- `lock_on` on middle-mouse collides with `parry`, and middle-click is unreliable (scroll-wheel
  click varies enormously between mice, and some browsers treat it as autoscroll).
  **Ruling: `parry` wins Mouse 1. `lock_on` = `Tab`, and `Tab`'s default focus behaviour must be
  suppressed — see §D.**

**Final default binding, normative:**

```
move        W A S D            (+ arrows)
look        mouse (pointer-locked)
light       Mouse0             (+ nothing)
block       Mouse2  [held]     (+ F [held])
parry       Mouse1             (+ V)
heavy       R                  (+ Mouse3)
roll        Space              (+ Mouse4)
sprint      LeftShift [held]   (+ nothing)
jump        X                  (+ nothing)
interact    E                  (+ Enter)
use_item    1                  (+ nothing)
lock_on     Tab                (+ Mouse1 held >= 12f)
two_hand    G [hold >= 12f]    (+ nothing)
swap_right  3                  (+ wheel up)
swap_left   4                  (+ wheel down)
menu        Escape             (+ M)
```

**Rule B1 — physical keys, not characters.** Bindings are stored and matched against
`KeyboardEvent.code` (`KeyW`, `KeyE`, `Space`), **never** `.key` and never `.keyCode`. On an
AZERTY keyboard `.key` for the W position is `'z'`; a build matching `.key === 'w'` is
unplayable in France and the bug report will say "the controls don't work". This is one line
and it is the single most common internationalisation failure in browser games.

**Rule B2 — the displayed label is localised even though the binding is not.** The settings
surface shows the *character the key produces on this layout* (via `KeyboardLayoutMap` where
available, falling back to the `code`), so a French player sees `Z` where an English player
sees `W`, and both are bound to `KeyW`.

### C. Pointer lock, Escape, and the menu (BINDING — this is the hazard section)

| Id | Hazard | Ruling |
|---|---|---|
| **PL1** | Pointer lock requires a user gesture | It is requested on the **same gesture that starts the game** (`RI-JRN01` O4 — the New/Continue click also unlocks audio and, on mobile, enters fullscreen). **There is no separate "click to play" surface.** A "Click to enable mouse look" overlay is a surface and violates `RI-JRN01` O1 |
| **PL2** | **Escape always exits pointer lock, and the page cannot prevent it** | This is a user-agent guarantee and it is not negotiable. Therefore: `menu` is bound to Escape and the game **treats pointer-lock exit as the menu-open signal**, rather than trying to keep the lock. Pressing Escape opens the menu *and* releases the mouse, which is the only coherent behaviour |
| **PL3** | Escape is also the natural "close the menu" key | Closing the menu re-requests pointer lock. Chrome imposes a short cooldown after an Escape-triggered exit during which a re-request is rejected; the game must **retry on the next user click** rather than fail silently. If the lock is not held, the menu stays open — it must **never** be possible to be in gameplay without a lock and without a visible cursor-driven fallback |
| **PL4** | Lock can be lost at any time (tab switch, OS alert, fullscreen exit, user agent decision) | `pointerlockchange` → **release every held action on that frame** (identical rule to `RI-JRN04` L3) and enter the menu state. The character does not keep sprinting |
| **PL5** | `pointerlockerror` | Retry once on the next click. Never a modal. If it persistently fails, **the game must remain fully playable**: mouse-look falls back to click-drag look, and every action is already keyboard-reachable (A1) |
| **PL6** | Mouse deltas | Read `movementX`/`movementY`, never client coordinates. Deltas are **accumulated per rAF and consumed by the next fixed sim step** (`RI-JRN04` §D edge-latching rule), and converted to degrees **per fixed step**, never per rendered frame. Otherwise look sensitivity changes with frame rate — a `RI-PLT01` HF3 failure |
| **PL7** | High-frequency mice / coalesced events | Use `getCoalescedEvents()` where available so a 1000 Hz mouse's motion is not undersampled at 60 Hz render |
| **PL8** | Pointer acceleration | The raw `movementX` may already be OS-accelerated. The game applies **no additional acceleration** and exposes sensitivity as a single linear scalar plus an optional exponent (default 1.0). A hidden acceleration curve is the reason "the aim feels wrong" and cannot be tuned out |
| **PL9** | Context menu | `contextmenu` is prevented on the canvas, unconditionally. A context menu over a boss fight is a lost run |
| **PL10** | Cursor | Hidden during gameplay. Restored the instant a cursor-driven surface opens. **No custom software cursor drawn on the canvas** — it lags by a frame and is a cheap tell |

### D. Keyboard hazards (BINDING)

| Id | Hazard | Ruling |
|---|---|---|
| **KB1** | **Key ghosting / rollover.** Cheap membrane keyboards drop the 3rd or 4th simultaneous key; the combination `W`+`Shift`+`Space` (sprint-roll forward) is the exact one Souls play requires constantly | The default binding is chosen so that **the four most common simultaneous inputs — a movement key, `Shift`, `Space`, and a mouse button — never require more than two keys on the keyboard at once**, because mouse buttons and modifiers are on separate matrix paths. `heavy` on `R` rather than `Shift+Mouse0` is a direct consequence (A3) |
| **KB2** | `keydown` **auto-repeat** | Every handler checks `event.repeat` and ignores repeats. A repeat-driven `light` is an unintended attack chain; a repeat-driven `roll` is a stamina drain the player did not ask for |
| **KB3** | **Browser-reserved chords.** `Ctrl+W` closes the tab, `Ctrl+T`, `Ctrl+N`, `Ctrl+Shift+I`, `F5`, `Ctrl+R`, `Alt+F4` are not interceptable | **No default binding uses `Ctrl` or `Alt` at all.** Rebinding must refuse `Ctrl+W`, `Ctrl+R`, `Ctrl+T`, `Ctrl+N`, `F5`, `F11`, `F12` and any single-key `F*` that the UA reserves, with an in-fiction refusal rather than a validation error |
| **KB4** | `Tab` moves focus | `preventDefault()` on `Tab` while pointer-locked. Additionally the canvas is the only focusable element during gameplay, so there is nowhere for focus to go |
| **KB5** | `Space` scrolls the page | `preventDefault()`. The page must also not be scrollable at all (`overflow: hidden`, canvas fills the viewport) |
| **KB6** | `/` and `'` open quick-find in some browsers; `Backspace` navigated back historically | `preventDefault()` on the canvas for every bound key, and the bound set never includes `Backspace` |
| **KB7** | **Focus loss with keys held.** Alt-tab while holding `W`+`Shift` and the `keyup` never arrives | `blur` and `visibilitychange` → **release every held action**. Without this the character runs into a wall until the player notices. This is the single most common browser-game input bug |
| **KB8** | **IME / dead keys.** A composition session swallows keystrokes | While pointer-locked the canvas is not a text input; any element that accepts text (the name prompt in `RI-JRN01`) releases the lock first and restores it after |
| **KB9** | **Modifier state desync.** `Shift` released while the tab is unfocused leaves `sprint` latched | Same handler as KB7, plus a per-frame reconciliation against `event.getModifierState()` on the next real event |
| **KB10** | Numpad, media keys, `CapsLock` | `code`-based matching handles these correctly; `CapsLock` is never bound (it is a toggle on some platforms and a key on others) |
| **KB11** | Layout assumptions | B1/B2. Additionally the **settings surface must be navigable with arrow keys + Enter alone**, so a player whose binding is broken can fix it |
| **KB12** | Held-action census | `getInputState().held` (`A-JRN6`) must be empty within 1 frame of any blur, lock loss, or disconnect. This is the single measurement that covers KB7, KB9, PL4 and `RI-JRN04` L3 at once |

### E. Rebinding (BINDING)

| Id | Requirement |
|---|---|
| **RB1** | **All fourteen actions rebindable**, plus movement, plus every mouse button. No action is fixed |
| **RB2** | Two bindings per action (primary + secondary), and they may be on different devices |
| **RB3** | Rebinding is done by **pressing the control**, not by choosing from a list |
| **RB4** | Conflicts are detected and shown *before* commit, naming the action that currently owns the control; the player may take it, which unbinds the other and says so |
| **RB5** | An action left with **zero** bindings on the active device is refused (A1) |
| **RB6** | Reserved chords (KB3) and index 16 on a gamepad (`RI-JRN04` §C) are refused with an in-fiction line |
| **RB7** | Per-device profiles: a keyboard binding change does not alter the gamepad profile |
| **RB8** | "Restore defaults", per-device |
| **RB9** | Bindings persist via `RI-JRN05`'s store and survive a cold reload |
| **RB10** | The rebinding surface is completable on **each** modality alone: keyboard-only, gamepad-only, touch-only (this is where A1 is most often broken, because a rebinding UI is the most mouse-shaped screen in any game) |
| **RB11** | The rebinding surface is a **cursor-driven surface** and therefore releases pointer lock on open and re-requests on close (PL3) |

### F. Discoverability without instruction (BINDING)

This is the part that cannot be solved by a keymap, and the part `RI-JRN01` forbids solving
with text. The mechanism is `DS/OPEN` #4, inherited: **writing scratched into the world at the
exact place the verb is first needed.**

| Id | Requirement | Value |
|---|---|---|
| **DS1** | Tutorial pop-ups, modals, toasts, "press X to Y" banners, control legends, a help overlay | **0**, for the whole game. `RI-JRN01` O11 is not repealed here and this item may not spend a different budget |
| **DS2** | In-world inscriptions teaching a verb | **≤ 6 before the first meaningful choice** (`RI-JRN01` O12) and **≤ 14 in the whole game**. Each is a physical entity with a position, readable via `interact`, written in-fiction by someone who was there |
| **DS3** | Placement | Each inscription is within **8 m** of the first situation that requires its verb, and the situation is **survivable on the first attempt** if the verb is used |
| **DS4** | The verbs that must be discoverable in the first ten minutes | `interact`, `light`, `roll`, `block`, `sprint`. The other nine may be discovered later or by experimentation |
| **DS5** | Interaction prompts | A prompt at an interactable is permitted and is **not** an instruction, on three conditions: it names the *action in the world* ("Pull"), not the control ("Press E to pull"); it appears only within interaction range; and its glyph tracks the active device (`RI-JRN04` L7). **A prompt that contains a control name is an instruction and counts against DS1** |
| **DS6** | The settings surface may state the bindings in full | It is the one place text about controls is allowed, because the player went looking for it |
| **DS7** | Death is a teacher | A player who dies to the first enemy respawns ≤ 40 m away (`RI-JRN06`) and the inscription is on the route back. Repetition, not explanation (`DS/OPEN` #7) |

## Comparison method

Run by `critic.platform` (fleet critic **JC-03**). Two passes: **instrumented** and a **naive
first-time-user pass** (isolation `enforced`), and the naive pass is the one that matters.

```bash
node tools/journey/journey-run.mjs --journey jrn03-desktop --seed 4711 \
     --profile desktop-1080p --input-mode real --layouts qwerty,azerty,qwertz \
     --out reports/journeys/<runId>
```

Requires **`A-JRN1`** (real-input mode), **`A-JRN6`** (`getInputState()` → `{pointerLocked,
hasFocus, activeDevice, held[], bindings, droppedInputs}` plus an `input_dropped` trace event),
and **`A-JRN7`** (the `input_action` trace event). Until they exist every check is
`unmeasurable` and scores **0**, fail-closed.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-K1** | **Action coverage** | Drive every default binding through the real DOM event path; record which action fired from the trace | 14/14 primary, 14/14 where a secondary exists. **Hard fail: any unbound or misrouted action** |
| **M-K2** | **`code` not `key`** | Repeat M-K1 with the CDP layout set to AZERTY and QWERTZ | Identical action map on all three layouts. **Hard fail: any difference** (B1) |
| **M-K3** | **Label localisation** | Screenshot the settings surface on all three layouts | Labels differ; bindings do not (B2) |
| **M-K4** | **No reserved chords** | Enumerate default bindings; check against the KB3 reserved list. Then attempt to rebind to `Ctrl+W` and `F5` | 0 defaults use `Ctrl`/`Alt`; both rebind attempts refused with in-fiction text |
| **M-K5** | **Repeat immunity** | Hold `light` for 120 frames with `repeat: true` events at 30 Hz | Exactly **1** `light` action. **Hard fail: repeat-driven actions** (KB2) |
| **M-K6** | **Blur release** | Hold `W`+`Shift`+`Space`; dispatch `blur`; step 300 frames. Read `getInputState().held` | Empty within **1 frame**; player displacement after blur ≤ 0.05 m. **Hard fail: latched keys** (KB7) |
| **M-K7** | **Visibility release** | Same via `visibilitychange` | Same |
| **M-K8** | **Pointer-lock acquisition** | From a cold profile, count surfaces and gestures between `navigationStart` and `pointerLockElement !== null` | **1 gesture**, **0** additional surfaces. **Hard fail: a "click to play" overlay** (PL1, `RI-JRN01` O1) |
| **M-K9** | **Escape behaviour** | Press Escape during gameplay; screenshot; press Escape again; click | Menu opens and lock releases on the first Escape; menu closes on the second; lock re-acquired on the following click. **0** frames of "gameplay with no lock and no menu" |
| **M-K10** | **Lock-loss release** | Force `pointerlockchange` to unlocked while sprinting | `held` empty within 1 frame; menu state entered (PL4) |
| **M-K11** | **Lock-failure playability** | Force `pointerlockerror` permanently; attempt to complete a combat encounter | Encounter completable; look works by click-drag; **0** modals (PL5) |
| **M-K12** | **Look is frame-rate independent** | With `setRenderRate` at 60/30/15 (`A-JRN11`), feed an identical `movementX` stream; measure degrees turned per fixed step | Identical to 6 dp at all rates. **Hard fail: any drift** (PL6, `RI-PLT01` HF3) |
| **M-K13** | **No added acceleration** | Feed `movementX` at 2, 4, 8, 16 px/event | Degrees turned is exactly linear in total delta, r² ≥ 0.999 (PL8) |
| **M-K14** | **Context menu / scroll / find** | Dispatch right-click, `Space`, `Tab`, `/`, `Backspace`, wheel on the canvas | 0 context menus, 0 scroll, 0 focus change, 0 navigation, 0 quick-find (PL9, KB4–KB6) |
| **M-K15** | **Cursor** | Screenshot mid-combat; inspect the computed cursor style and the canvas for a drawn cursor | Hidden; no software cursor (PL10) |
| **M-K16** | **Rollover safety** | Simulate a 2-key-rollover keyboard (drop any 3rd simultaneous *keyboard* key) and run a sprint-roll-attack sequence | Sequence completes. **Hard fail:** any default action requiring 3 simultaneous keyboard keys (KB1, A3) |
| **M-K17** | **Rebinding round trip** | Rebind 5 actions including a mouse button and one conflicting control; reload cold; re-read | All 5 persist; the conflict was surfaced before commit and named the previous owner (RB4, RB9) |
| **M-K18** | **Rebinding modality parity** | Complete a rebind using keyboard only, then gamepad only, then touch only | 3/3. **Hard fail: any modality that cannot rebind** (RB10, A1) |
| **M-K19** | **Zero-binding refusal** | Attempt to unbind `roll` entirely | Refused (RB5) |
| **M-K20** | **Instruction budget** | Grep the UI-text stream (`A-JRN1`) over a 30-minute session for `Press `, `Tap `, `Click `, `Hold `, `Tutorial`, `Tip:`, and for any key name adjacent to a verb, **excluding** the settings surface | **0 hits.** **Hard fail: any** (DS1, `RI-JRN01` HF3) |
| **M-K21** | **Inscription census** | Count `inscription` entities encountered before the first meaningful choice, and in the whole game; for each, distance to the first situation requiring its verb | ≤ 6 / ≤ 14 / 100% within 8 m (DS2, DS3) |
| **M-K22** | **Prompt purity** | Capture every interaction prompt string in a 30-minute session | **0** contain a key name, a mouse-button name, or a gamepad glyph name as *text* (DS5) |
| **M-K23** | **Input latency** | Frames from real DOM event to the sim step that consumes it, over 200 inputs | p100 ≤ **2 frames**; p50 ≤ 1 |
| **M-K24** | **Dropped inputs** | 10 000 scripted inputs at 20 Hz through the real path; `getInputState().droppedInputs` and the `input_dropped` trace event | **0** |

### Naive pass (isolation: `enforced`) — the first-time-user protocol

This is the protocol the brief asks for, and it is **enforced**, not encouraged: the agent's
context is verified empty of corpus content before it starts (`JOURNEY-CRITIC-FLEET.md` §4).

A fresh agent (fleet role **JC-03N**) receives: the URL, the driver's stdio protocol, one
sentence of premise, **and nothing else**. No corpus. No keymap. No source. No screenshots. It
is asked, in this order, and its answers are recorded verbatim before any reveal:

1. Before touching anything: *"You are about to play a third-person action RPG in a browser on
   a desktop with a keyboard and mouse. Write down which key or button you expect each of these
   to be: move, look, attack, block, dodge, run, interact, open the menu."* (Pre-registration.)
2. Play for fifteen minutes. Then: *"List every action you found you could take. For each, say
   how you found out: **I guessed it**, **I found writing in the world**, **the game told me**,
   or **I pressed everything**."*
3. *"What did you press that did nothing?"*
4. *"Did you ever lose control of the character or the camera? Describe exactly what happened
   and what you did about it."*
5. *"Did the game ever tell you what a control does? Quote it."*
6. *"List everything you could not work out."*

| # | Check | Threshold |
|---|---|---|
| **M-N1** | **Pre-registration hit rate** (1 vs the actual binding) | ≥ **6 of 8** exact. This is the item's headline naive number: the bar is *convention*, and convention is measurable as "a stranger guessed it" |
| **M-N2** | Actions found (2) | ≥ **11 of 14** in fifteen minutes |
| **M-N3** | `found_by` distribution (2) | "the game told me" = **0**. ≥ 1 discovered from writing in the world |
| **M-N4** | Dead presses (3) | Triaged: **unbound-and-harmless** (fine) vs **bound-but-silent** (defect). Defects **0**; hard fail ≥ 2 |
| **M-N5** | **Loss of control (4)** | **0** episodes the agent could not recover from unaided. Any episode involving a context menu, a lost pointer lock with no menu, a stuck key, or a page scroll is a **defect and a hard fail** |
| **M-N6** | Instruction (5) | 0 quotations outside the settings surface |
| **M-N7** | Confusion census (6) | Triaged as in `RI-JRN01` M19: legitimate mystery vs defect. Defects ≤ 1; hard fail ≥ 3 |

## Scoring

Native scale: **0–100**, weighted, plus hard fails that cap at **2**.

| Block | Weight | Checks |
|---|---|---|
| **The controls work at all** | **28** | M-K1 (8), M-K2 (6), M-K5 (4), M-K16 (4), M-K23 (3), M-K24 (3) |
| **The browser does not steal control** | **26** | M-K6 (6), M-K8 (5), M-K9 (5), M-K10 (4), M-K14 (3), M-K11 (3) |
| **Look feels right** | 10 | M-K12 (5), M-K13 (3), M-K15 (2) |
| **Rebinding is real** | 12 | M-K17 (4), M-K18 (5), M-K19 (2), M-K4 (1) |
| **Discoverability without instruction** | 14 | M-K20 (6), M-K21 (4), M-K22 (4) |
| **Naive corroboration** | 10 | M-N1 (4), M-N2 (2), M-N5 (2), M-N3 (1), M-N7 (1) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps the item at 2 and sets `status: FAIL`):**

- **HF1** — Bindings matched on `KeyboardEvent.key` rather than `.code` (M-K2).
- **HF2** — Held actions latch on blur, visibility change or pointer-lock loss (M-K6, M-K7, M-K10).
- **HF3** — A "click to play" / "enable mouse look" surface (M-K8) — also `RI-JRN01` HF2.
- **HF4** — A reachable state that is gameplay with no pointer lock and no menu (M-K9).
- **HF5** — Any tutorial pop-up, control legend, or prompt containing a control name (M-K20,
  M-K22) — also `RI-JRN01` HF3.
- **HF6** — Any default action requiring three simultaneous keyboard keys (M-K16).
- **HF7** — Repeat-driven actions (M-K5).
- **HF8** — Look sensitivity coupled to render rate (M-K12) — also `RI-PLT01` HF3.
- **HF9** — A modality that cannot complete rebinding (M-K18) — also `RI-JRN01` HF5.
- **HF10** — The naive agent suffered an unrecoverable loss of control (M-N5).

## How we lose

1. **`e.key === 'w'`.** The game is unplayable on AZERTY and QWERTZ, which is most of Europe, and
   it will never be caught because everyone testing it uses QWERTY. One-line bug, HF1.
2. **The click-to-play overlay.** Pointer lock needs a gesture, so somebody adds a full-screen
   "Click to play" div. It is the path of least resistance, it takes ten minutes, and it adds a
   surface to an opening whose entire bar is *not having surfaces*.
3. **Escape is fought.** Somebody tries to keep pointer lock through Escape, discovers they
   cannot, and ships a state where Escape releases the mouse but the game keeps running with an
   invisible cursor over the boss. HF4, and it is the most confusing possible failure for a
   player because nothing on screen changed.
4. **Keys stick on alt-tab.** The player switches to a browser tab to look something up, comes
   back, and the character has run into a wall for forty seconds and is dead. KB7 is a
   four-line fix that is written after the first bug report, never before.
5. **Right-click opens the context menu** the first time the player tries to block. One line of
   `preventDefault`. The player thinks the game is broken, and they are right.
6. **Mouse look is `deltaTime`-scaled.** Sensitivity changes with frame rate, so aiming feels
   different in a boss arena than in a corridor. It is invisible to the builder and maddening to
   the player, and it is the same defect as `RI-PLT01` HF3 wearing different clothes.
7. **`Shift`+`Mouse0` for heavy.** Elegant, discoverable, and it ghosts on a cheap keyboard
   exactly when the player is also holding `W`. A3 exists for this.
8. **The control legend.** Controls turn out to be undiscoverable, so somebody adds a small
   translucent legend in the corner "just for the tutorial area". `RI-JRN01` O11 dies, the
   cross-rule fires, and the fix for a `RI-JRN03` gap has broken `RI-JRN01`. **Restated,
   binding: an instruction pop-up or legend may never be the remedy for a discoverability gap.**
9. **"Press E to open."** The most natural prompt string in the world, and it is an instruction.
   DS5's rule — name the action, not the control — is what makes the prompt legal, and it is the
   sort of distinction that gets flattened during implementation.
10. **Rebinding is a mouse-only screen.** It is a list of rows with click targets, which is what
    a settings screen is, and it is unusable on a gamepad — so a player whose binding is broken
    cannot fix it with the device they have. HF9.
11. **Rebinding stores `keyCode`.** Deprecated, inconsistent, and it round-trips wrong for
    everything except letters and digits.
12. **Nobody tests with a fresh browser profile.** Pointer lock behaves differently on the very
    first request an origin ever makes, and the second-run experience is the only one anyone
    sees after day one. `RI-JRN01` "How we lose" #13 applies verbatim here.
13. **The naive agent is given the keymap.** The first-time-user protocol is expensive and
    inconvenient, so somebody runs it with an agent that has read this file. The pre-registration
    number M-N1 then measures nothing at all, and it is the only measurement in the corpus that
    can tell us whether the controls are *conventional*. `JOURNEY-CRITIC-FLEET.md` §4's isolation
    enforcement exists entirely because this shortcut is so tempting.

## Provenance note

- **`constructed`, confidence high, and binding** — §A rules A1–A3, the whole of §B including
  the three collision rulings, §C, §D, §E, §F, and every threshold and weight in
  `## Comparison method` and `## Scoring`. The fourteen action names themselves are **inherited
  verbatim from `HARNESS.md` §4** and are not this item's invention; the item claims ownership
  of their *semantics* and *bindings*, not their existence.
- **`canonical-recall`, confidence high** — the browser behaviours in §C and §D: that Escape
  always exits pointer lock and cannot be prevented; that pointer lock requires a user gesture
  and can fail; that `movementX`/`movementY` are the correct deltas under lock; that
  `getCoalescedEvents()` exists; that `KeyboardEvent.key` is layout-dependent and `.code` is
  physical; that `keydown` auto-repeats and exposes `event.repeat`; that `Ctrl+W`/`F5`/`F11`/
  `F12` are not interceptable; that `Tab` moves focus and `Space` scrolls; that keys held at
  blur do not produce `keyup`. These are established web-platform behaviours, recalled, **not
  measured here**. The specific Chrome cooldown after an Escape-triggered pointer-lock exit
  (PL3) is recalled at **confidence medium** and the ruling is written so that it does not
  matter whether the cooldown is 1 s or 2 s: the game retries on the next user click either way.
- **`canonical-recall`, confidence medium** — the Souls control lineage in §A's third column
  (R1 light, R2 heavy, L1 guard, L2 parry, B roll/sprint, Y two-hand, R3 lock-on) and the
  desktop conventions in §B (WASD, left-click attack, right-click guard, Shift sprint, Space
  dodge, E interact). These are recalled genre conventions; **M-N1 exists precisely to test them
  empirically rather than to assert them**, which is why the naive pre-registration is worth 4
  points on its own.
- **Owned elsewhere, cited not restated:** the gamepad and touch bindings → `RI-JRN04`. Camera
  rates, spring arm and lock-on framing → `RI-CAM02`/`RI-CAM03`/`RI-CAM04`. Lock-on semantics →
  `RI-CMB06`. Input buffering → `combat.input.buffer`. The instruction budget and inscription
  mechanism → `RI-JRN01` O11/O12. Binding persistence → `RI-JRN05`. Frame-rate independence →
  `RI-PLT01` M7/HF3. Respawn distance → `RI-JRN06`.
- **Harness dependency.** `A-JRN1`, `A-JRN6`, `A-JRN7`; M-K12 additionally needs `A-JRN11`;
  M-K2 needs CDP keyboard-layout control (**`A-JRN12`**). Until they land this item is
  **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
