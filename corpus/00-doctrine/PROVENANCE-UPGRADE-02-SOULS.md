---
id: PROVENANCE-UPGRADE-02-SOULS
title: Provenance upgrade 02 — verifying the Souls combat corpus against real community data
kind: audit
side: souls
provenance: community-data
confidence: high
supersedes: nothing
amends: nothing (proposals only — the orchestrator applies)
---

# Provenance upgrade 02 — the Souls half

Companion dataset: **`corpus/10-combat/data/souls-frame-data.json`** — every verified upstream
value, per game, per mechanic, with its source URL. That file is the citable reference; this
file is the audit.

**Scope.** `corpus/10-combat/RI-CMB01..08`, `RI-AI01..07`, `corpus/12-weapons/RI-WPN01..06`,
`corpus/15-camera/RI-CAM01..07`, `corpus/20-progression/RI-PRG01` and `RI-PRG07`. Only claims
*about a FromSoftware game* are auditable; a `constructed` number cannot be right or wrong
against an external source, only against our own consistency.

**Rule followed throughout:** nothing was edited. Every amendment below is a proposal.

---

## 0. The answer to the question the brief cared most about

> *"If our combat corpus has quietly blended mechanics from different Souls games into a single
> model that no actual game implements, say so loudly."*

**Two answers, and the second is the serious one.**

**(a) The mechanical blending is real but mostly *declared*, and where it is undeclared it is
still coherent.** RI-CMB01 §B says in plain text that it takes DS3's breakpoints with DS1's
i-frame stinginess and that "neither is ours". That is a design decision on the record, not a
leak. RI-CMB05's poise model *is* a blend — an always-on depleting poise pool (Dark Souls 1 /
Elden Ring) fused with hyperarmour granted only on declared heavy-attack frames (Dark Souls 3)
— and its provenance note attributes the whole thing to DS3, which is wrong. But the fused
model is not fictional: **Elden Ring implements exactly that combination.** The fix is a
citation, not a redesign.

**(b) The corpus has a systematic *unit* error that is much worse than any blend, because it
is invisible to every internal check we have.**

**Souls community frame counts are quoted in 1/30-second ticks — in DS1, DS3 *and* Elden Ring.**
Elden Ring Reforged states it outright ("i-frames values are at 30 FPS"); DS3 corroborates it
arithmetically, since the Carthus Bloodring is documented as raising i-frames "from 12 (.4 sec)
to 16 (.533 sec)", and 12 ÷ 0.4 s = 30 fps exactly.

Our simulation is a **fixed 60 Hz** step, and the corpus adopted the Souls frame *numbers*
without rebasing them. The consequence:

| | Souls (30 fps ticks) | Ours (60 Hz) | Ratio |
|---|---|---|---|
| Light-roll invulnerability | DS3 13 f = **433 ms**; DS1 11 f = **367 ms** | 13 f = **217 ms** | **0.50 / 0.59** |
| Light-roll total duration | DS1 fast roll 24 f = **800 ms** | 26 f = **433 ms** | **0.54** |
| Medium-roll total | DS1 mid roll 33 f = **1100 ms** | 30 f = **500 ms** | **0.45** |
| Fat-roll total | DS1 fat roll 48 f = **1600 ms** | 44 f = **733 ms** | **0.46** |
| Parry active window | recalled as "8–12 frames" (= 267–400 ms) | 7–12 f = **117–200 ms** | **0.50** |
| Backstab animation | Souls-scale critical ≈ 1.3–1.5 s | 62 f = **1033 ms** | ~0.72 |

The pattern is uniform: **our combat runs at roughly double Souls speed in wall-clock time
while looking correct on paper.** Every *ratio* is preserved — our LIGHT roll is invulnerable
for 0.500 of its animation against DS1's fast-roll 0.458, which is why RI-CMB01 §E's derived
table looks healthy — so the error survives every internal consistency check, every blind-pair
comparison of frame vectors, and every M-check in every method script. It surfaces only when a
human plays it and says "this is Souls-ish but wrong": rolls that feel like dashes, parries
that feel like a twitch test, a fight that reads as character-action rather than Souls.

Notably, RI-CMB03 got this *right* in the one place it worked from a figure denominated in
seconds: it took the measured 0.70 s stamina-regen pause and correctly wrote **42 frames** at
60 Hz. The error is confined to figures that were recalled as *frame counts* rather than as
durations.

**Recommended global amendment (orchestrator decision, not mine to make):** either

1. **Rebase** — double every frame count that was inherited from Souls recall (roll windows,
   parry windows, critical animations, and every attack row in RI-CMB02), which invalidates
   the RI-CMB07 exemplar trace and forces its regeneration; or
2. **Declare** — keep the numbers, and add one binding sentence to RI-CMB01 and the doctrine:
   *"Our simulation runs at 60 Hz and our combat is deliberately paced at ~2× Souls wall-clock
   speed. Souls frame counts are 30 fps ticks; a Souls figure of N frames is 2N of ours. No
   frame count in this corpus should be compared to a Souls frame count without this factor."*

Option 2 is cheap and honest. Option 1 is right if the intent was ever "it should feel like
Dark Souls". **What is not acceptable is the status quo, in which §A of RI-CMB01 puts DS1's 11
and DS3's 13 in the same table as our 13 with no unit stated, inviting exactly the false
equivalence the design rationale in §B then rests on.**

---

## 1. Verdict summary

| Verdict | Count |
|---|---:|
| `confirmed` | **39** |
| `needs-amendment` | **9** |
| `contradicted` | **6** |
| `unverifiable` | **10** |
| **Total figures checked** | **64** |

Plus **1 corpus-wide unit finding** (§0) and **4 internal contradictions between our own items**
(§11), one of which (§7) is severe.

Eleven amendments are proposed against the nine `needs-amendment` rows — two of the extra
amendments (5 and 10) add divergence disclosures against `contradicted` rows rather than
changing any number.

No figure was silently changed. No reference item was edited.

---

## 2. RI-CMB01 — roll i-frames and equip load

Item's own provenance: §A `community-data` / medium; §B–§E `constructed` / high.

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 1 | DS1 breakpoints 25% / 50% / 100% | Fast ≤25%, Medium 25–50%, Slow/Fat 50–100%, cannot roll >100% ([DS Wiki, Rolling](https://darksouls.fandom.com/wiki/Rolling)) | **confirmed** |
| 2 | DS3 breakpoints 30% / 70% / 100% | ≤29.9% light, 30.0–70.0% regular, 70.1–99.9% slow, ≥100% overburdened ([Fextralife DS3 Equipment Load](https://darksouls3.wiki.fextralife.com/Equipment+Load)) | **confirmed** |
| 3 | DS1 light roll 11 i-frames | 11 | **confirmed** |
| 4 | DS1 medium roll "11 (more ending lag)" | 11 i-frames, recovery-after-iframes 4 vs fast roll's 3, total 33 f vs 24 f | **confirmed** |
| 5 | DS1 fat roll "~11 nominal but effectively negated by instability + lag" | 11 i-frames, **25 instability frames** (1.4× damage taken), total 48 f | **confirmed** — and better-founded than the item knew; the mechanism is named "Instability Frames" and is documented |
| 6 | Ninja-flip (DWGR, ≤25%) = 13, instability removed | "removes all Instability Frames … grants 2 additional iFrames … total 13" | **confirmed** |
| 7 | DS3 i-frames 13 / 13 / 12 | 13 light, 13 medium, 12 heavy | **confirmed** |
| 8 | Item's self-correction: "the brief said DS1 was 30/70; that is a conflation, DS1 is 25/50" | Correct. DS1 is 25/50 | **confirmed** — this correction was right and should be kept |
| 9 | "DS1: i-frames are stingy, recovery is the differentiator" | Correct on both halves *when both games are read at 30 fps*: DS1 11 f vs DS3 13 f, and DS1's tiers differ only in recovery/instability, never in i-frames | **confirmed** |
| 10 | DS3 roll "chainable ~10× on a full bar" | Not reachable from a citable source | **unverifiable** |
| 11 | §A quotes DS1's and DS3's frame counts with no framerate; §B then declares a 60 Hz sim and adopts the numbers | Souls counts are 30 fps ticks (see §0) | **needs-amendment** |
| 12 | Our LIGHT 26 f vs MEDIUM 30 f (different roll durations by tier) | DS3's light and medium rolls have **identical** duration — light buys distance only. DS1's differ (24/33/48). So §B's *breakpoints* are DS3's but its *duration model* is DS1's | **needs-amendment** — a second, undeclared blend sitting on top of the declared one |
| 13 | "A roll is uncancellable" (§C.3) | Consistent with all three games for the roll itself | **confirmed** |
| 14 | Our OVERLOADED forbids sprinting and jump attacks | DS3: overburdened "cannot roll, back step, or run"; DS1: cannot roll, staggers, cannot sprint | **confirmed** |

### Proposed amendment 1 — RI-CMB01 §A, add a framerate column and a unit warning

Replace the table caption region of §A with:

> ### A. Upstream models (what the two games actually do)
>
> **Unit warning, binding on any reading of this table.** All community frame counts for
> FromSoftware titles are quoted in **1/30 s ticks**, regardless of the framerate the game
> renders at ([Elden Ring Reforged](https://err.fandom.com/wiki/Combat_Mechanics) states this
> explicitly; corroborated in DS3 by the Carthus Bloodring, documented as raising i-frames
> "from 12 (.4 sec) to 16 (.533 sec)" — 12 ÷ 0.4 s = 30 fps). Our simulation is **60 Hz**.
> **A Souls figure of N frames is 2N of ours.** DS1's 11 i-frames are 367 ms; DS3's 13 are
> 433 ms; our LIGHT roll's 13 are 217 ms.

and add a `real-time` row to the table:

| Property | Dark Souls 1 (PTDE/Remastered) | Dark Souls 3 |
|---|---|---|
| i-frames, light roll | 11 f @30 fps = **367 ms** | 13 f @30 fps = **433 ms** |
| i-frames, medium roll | 11 f @30 fps = **367 ms** (recovery 4 f vs 3 f; total 33 f vs 24 f) | 13 f @30 fps = **433 ms** (same total duration as light) |
| i-frames, heavy/fat roll | 11 f, but **25 instability frames** at 1.4× damage taken; total 48 f = 1.60 s | 12 f @30 fps = **400 ms** |
| Total animation, light / mid / fat | 24 / 33 / 48 f = **0.80 / 1.10 / 1.60 s** | light and medium identical; light covers more ground |
| What the light tier buys | shorter recovery and fewer instability frames | **distance only** — the animation is the same length |

Sources: [Rolling — Dark Souls Wiki](https://darksouls.fandom.com/wiki/Rolling),
[Rolling — DS Remastered Wiki](https://dark-souls-remastered.fandom.com/wiki/Rolling),
[Equipment Load — Fextralife DS3](https://darksouls3.wiki.fextralife.com/Equipment+Load).

### Proposed amendment 2 — RI-CMB01 §B, state the pacing decision

Append to §B, immediately after the tier table:

> **Pacing declaration (binding).** `ES-ROLL/1`'s frame counts are 60 Hz counts and are
> **not** rebased Souls figures. Our LIGHT roll is 433 ms long with 217 ms of invulnerability;
> DS1's fast roll is 800 ms with 367 ms; DS3's light roll is ~730 ms with 433 ms. We are
> therefore running combat at roughly **2× Souls wall-clock speed with the Souls
> invulnerable-fraction preserved** (ours 0.500, DS1 fast roll 0.458). This is a deliberate
> choice for a 15–25 hour game and it is the single most consequential difference between our
> combat and its models. Any future comparison of one of our frame counts to a Souls frame
> count without the ×2 factor is an error.

*(If the orchestrator prefers option 1 — rebase — this paragraph is replaced by a doubling of
every frame count in §B and a regeneration of the RI-CMB07 exemplar.)*

### Proposed amendment 3 — RI-CMB01 §B, declare the duration-model blend

Append to the §B preamble sentence:

> …with **DS1's tier-duration model** (light, medium and heavy rolls have different total
> lengths, as in DS1's 24/33/48; DS3's light and medium rolls are the same length and differ
> only in distance covered).

---

## 3. RI-CMB03 — stamina economy

Item's own provenance: §A shape `community-data` / medium; costs and delays `constructed`.

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 15 | Base regen **45 / second**, flat | DS1: "Base Stamina recovery is 45 per second". DS3: "Standard rate appears to be 45 stamina/second" ([DS1](https://darksouls.wiki.fextralife.com/Stamina), [DS3](https://darksouls3.wiki.fextralife.com/Stamina)) | **confirmed** — in *both* games, which is a stronger result than the item claimed |
| 16 | Regen does not scale with any stat | DS1: "Stamina recovery rate is not influenced by the maximum Stamina (or the Endurance value)" | **confirmed** |
| 17 | Regen delay after a spend = **42 frames (0.700 s)** | DS3 community frame-by-frame measurement: 0.70 s with no regen items ([Steam](https://steamcommunity.com/app/374320/discussions/0/133257324792331846/)) | **confirmed** — and correctly converted to 60 Hz. This is the one place the corpus handled units properly |
| 18 | Regen ×**0.20** while guard raised | DS1: "blocking/raising the shield or climbing a ladder (−80%)" | **confirmed, exact** |
| 19 | Regen ×**0.80** above 70% equip load | DS3: 45/s → **37/s** above 70% load (ratio 0.822); the Equipment Load page phrases it as "about 20% slower" | **confirmed** (our 0.80 vs measured 0.822 — within the item's own tolerance) |
| 20 | Regen ×**0.60** when `OVERLOADED` | DS1: over 100% encumbrance is **−30%**, i.e. ×0.70. No game applies −40% | **needs-amendment** (or an explicit divergence note) |
| 21 | Stamina floor **0.0**, "never negative … costs clamp; they do not create debt" | DS3: "Stamina can go into negative values if you overuse your remaining stamina", floor **−60**, negative stamina recovers at the same rate | **contradicted** |
| 22 | "Insufficient stamina drops the input … no partial roll, no queued roll, no debt" — and §The bar's "stamina must gate inputs by dropping them" | **No Souls game does this.** DS1 and DS3 gate actions on `stamina > 0`, not on `stamina ≥ cost`; an action begun with 1 stamina completes and overdraws | **contradicted** |
| 23 | DS1-grounded regen shape overall | Confirmed as above | **confirmed** |
| 24 | Blocking costs stamina proportional to the blow and to shield stability; guard break on overdraw opens a riposte | Qualitatively correct across DS1/DS3, but no citable numeric stability formula was reached | **unverifiable** (numbers), **confirmed** (shape) |
| 25 | Pool: 90 @END 10 → 180 @END 40 → 203 @END 99 | DS3: 95 @END 11 → **160** @END 40 → 170 @END 99 | **confirmed as a divergence** — ours is ~12% larger at cap and has a shallower post-40 tail; `constructed`, no amendment needed beyond recording it |

### Proposed amendment 4 — RI-CMB03 §A, the `OVERLOADED` multiplier

Replace the `Regen multiplier, OVERLOADED | ×0.60 | Stacks` row's note with:

> ×0.60 · Stacks. **Divergent by construction:** DS1 applies −30% (×0.70) over 100%
> encumbrance ([Stamina — Fextralife DS1](https://darksouls.wiki.fextralife.com/Stamina)); DS3
> has no equivalent tier because it forbids all stamina actions when overburdened. We are
> harsher than either, deliberately, because `OVERLOADED` in our game is a state a player can
> be in for minutes at a time while hauling loot (RI-PRG07) and must be uncomfortable.

### Proposed amendment 5 — RI-CMB03, the stamina floor is ours, not Souls'

Add to the provenance note, and correct the framing in `## The bar`:

> **Divergence from all Souls titles, deliberate and binding.** Dark Souls 3 lets stamina go
> **negative**, to a floor of −60, and gates actions on `stamina > 0` rather than on
> `stamina ≥ cost` — an attack begun with 1 stamina completes and overdraws
> ([Stamina — Fextralife DS3](https://darksouls3.wiki.fextralife.com/Stamina)). DS1 behaves
> the same way. Our rule — **the input is dropped, the bar never goes negative, there is no
> debt** — is a construction, not a recollection, and `## The bar`'s claim that "the player
> learns the bar by being denied" describes *our* game and not its models. It is a better rule
> for a fixed-step, frame-exact, trace-verifiable simulation (a dropped input is a
> `no_stamina` event a critic can count; an overdraw is a floating-point state a critic
> cannot), and it should stay — but it must stop being presented as Souls behaviour.

---

## 4. RI-CMB05 — poise, stagger, hyperarmour, criticals

Item's own provenance: `confidence: medium`, DS3 shape `community-data` / low–medium.
This is the item with the real attribution problem.

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 26 | "Poise health is a pool" (DS3) | True: DS3 has a hidden poise health of **100** on all player-model characters ([Fextralife DS3 Poise](https://darksouls3.wiki.fextralife.com/Poise)) | **confirmed** |
| 27 | "A hit's poise damage is scaled by the defender's Poise stat" (DS3) | True: "The stat Poise will reduce how much poise damage a weapon inflicts to this poise health, by a percentage equal to the amount of Poise" | **confirmed** |
| 28 | "The stagger point is reached when poise health hits zero" (DS3) | Half-true and dangerously so. In DS3 **you are only able to resist stagger during active-poise (hyperarmour) frames; at any other time you are staggered regardless of remaining poise health.** A DS3 player who is standing, walking or running has no functional poise at all | **needs-amendment** |
| 29 | **Our §A model:** an always-on poise pool that depletes on every hit and staggers at zero | That is **not DS3**. It is **Dark Souls 1** (threshold, always active) and **Elden Ring** (poise HP = the visible stat, always active, stagger at 0) ([Fextralife ER Poise](https://eldenring.wiki.fextralife.com/Poise)) | **needs-amendment** — mechanics fine, attribution wrong |
| 30 | Hyperarmour is granted only during declared frames of heavy attacks and generally requires two-handing on mid-weight classes | Confirmed for DS3: hyperarmour ("active poise") is carried by Ultra Greatswords, Great Hammers, two-handed Greatswords and certain Weapon Arts | **confirmed** |
| 31 | A fully charged strong attack increases poise health by roughly 50% (our ×1.50) | DS3: "all attacks and actions with active poise will give a multiplier to your current [poise health]" — the mechanism is confirmed; the specific 1.50 for a full charge was not reachable from a citable source | **confirmed (mechanism) / unverifiable (coefficient)** |
| 32 | `poise_resist` cap **0.60** at `armour_poise` 72 | DS3's maximum achievable Poise stat is **50.15–67.22**, i.e. a 50–67% reduction in incoming poise damage. Our 0.60 cap sits squarely in the real band | **confirmed** — a good number that the item did not know was good |
| 33 | Poise resets to full when the stagger animation ends | ER: "toughness instantly resets to maximum after being staggered" | **confirmed** (as ER behaviour) |
| 34 | Poise regeneration: 90 f (1.5 s) delay, then **20 / second** linear | **No game does gradual player poise regeneration.** DS1 refills instantly on a timer reset. ER: player poise does **not** regenerate — it fully resets after **30 s** without a hit (enemies regenerate on a 6–15 s timer scaling with their poise) | **needs-amendment** — record as a construction |
| 35 | Overflow: (not addressed in our §A) | ER explicitly discards overflow — a 50-poise-damage hit against 1 remaining poise HP staggers and refills to full rather than carrying 49 into the next bar. Our formula carries the negative into the reset and therefore behaves differently | **needs-amendment** (a one-line rule, and an easy win: it prevents chain-stagger) |
| 36 | Parry active windows 7–12 frames (our §D), grounded on recalled "8–12 frames" | Fextralife's DS3 Parry page carries **no** frame data and no per-shield chart was reachable from a citable source. Separately, the recalled 8–12 is a 30 fps figure, so at 60 Hz it should be 16–24 | **unverifiable** (values) + **needs-amendment** (units) |
| 37 | "Unparryable attacks are declared per-move and must be a minority of any enemy's moveset" | DS3 makes **whole weapon classes** unparryable: two-handed R1 **and** R2 from Ultra Greatswords, Greataxes and Great Hammers, Curved Greatsword 2H R2, all whips, and all player jump/plunge attacks ([Fextralife DS3 Parry](https://darksouls3.wiki.fextralife.com/Parry)) | **contradicted** as a description of Souls; fine as our design, but it should be recorded as a divergence |
| 38 | Partial parry | DS3 has a window before and after the active parry frames in which a hit is treated as a **normal block** — damage and stamina loss, but no stagger. Our model has no analogue: a mistimed parry in our game is a clean whiff | **contradicted** (as an omission), worth considering as an addition |
| 39 | Backstab grants the attacker invulnerability for the bulk but not all of the animation; guard break opens a riposte; criticals are positional and deterministic | Qualitatively correct across all three games; no citable frame data | **unverifiable** (frames), **confirmed** (shape) |
| 40 | Backstab sector ±35° / 1.20 m, animation 62 f, riposte 78 f | `constructed`; no external check exists | **unverifiable** |

### Proposed amendment 6 — RI-CMB05, fix the attribution (the important one)

Replace the first bullet of the provenance note with:

> - **`community-data`, confidence medium: our poise model is Elden Ring's, not Dark Souls
>   III's.** `ES-POISE/1` is an always-active pool that depletes on every hit and staggers at
>   zero. **Dark Souls III does not work that way.** DS3 keeps a hidden poise health of 100 and
>   uses the Poise stat to reduce incoming poise damage, but *"you are only able to resist
>   stagger during active poise, and at any other time you can be staggered regardless of how
>   much poise health you have left"*
>   ([Poise — Fextralife DS3](https://darksouls3.wiki.fextralife.com/Poise)). A DS3 player who
>   is not mid-swing has no functional poise. **Elden Ring** is the game that implements what we
>   implement: poise HP equal to the visible poise stat, always active, stagger at zero, instant
>   reset to maximum after a stagger, and overflow damage discarded rather than carried
>   ([Poise — Fextralife Elden Ring](https://eldenring.wiki.fextralife.com/Poise)). What we take
>   from DS3 is the *hyperarmour* half — active poise granted only during declared frames of
>   heavy attacks on large weapon classes, which is confirmed. Our model is therefore
>   **ER's poise + DS3's hyperarmour, which is what Elden Ring itself ships**; it is a coherent
>   design, but it must be cited as Elden Ring and not as Dark Souls III.
>   Two of our numbers survive contact with the sources unusually well: DS3's maximum
>   achievable Poise is 50.15–67.22, so our `poise_resist` cap of **0.60** is in the real band;
>   and the DS3 formula circulated by the community
>   (`Stagger Point = Poise Health − (Poise Damage × Poise/100)`) is a different formula from
>   ours, which we did not adopt and must not claim to have.

### Proposed amendment 7 — RI-CMB05 §A, poise regeneration is ours

Add below the §A table:

> **Divergence, deliberate.** No Souls title regenerates *player* poise gradually. Dark Souls 1
> refills poise instantly when its timer resets; Elden Ring does not regenerate player poise at
> all and simply resets it to maximum after 30 s without a hit (enemy poise *does* regenerate,
> on a 6–15 s timer scaling with the enemy's poise value)
> ([Poise — Fextralife Elden Ring](https://eldenring.wiki.fextralife.com/Poise)). Our
> 90-frame delay plus 20/s linear refill is a construction chosen because a continuously
> readable poise bar is measurable in a trace and a 30-second cliff is not.

### Proposed amendment 8 — RI-CMB05 §A, add the overflow rule

Add as a new §A rule:

> **Overflow is discarded.** When a blow takes `poise_health` below zero, the excess is thrown
> away: the stagger fires and `poise_health` is restored to `poise_health_max`, never to
> `poise_health_max + (negative remainder)`. This is Elden Ring's rule
> ([Poise — Fextralife Elden Ring](https://eldenring.wiki.fextralife.com/Poise)) and it exists
> to prevent a single heavy blow from consuming two poise bars and producing a chain-stagger.

### Proposed amendment 9 — RI-CMB05 §D, record the parryability divergence

Add below the Parry table:

> **Divergence from Dark Souls III, deliberate.** DS3 makes entire weapon *classes*
> unparryable — two-handed R1 and R2 from Ultra Greatswords, Greataxes and Great Hammers, the
> Curved Greatsword two-handed R2, all whips, and all player jump and plunge attacks
> ([Parry — Fextralife DS3](https://darksouls3.wiki.fextralife.com/Parry)). We make
> unparryability a **per-move** property declared in the statblock rather than a class
> property, so that a heavy enemy still has a parryable move and the parry remains a live
> option in every fight. DS3 also carries a **partial parry** — a window before and after the
> active frames in which a hit is treated as an ordinary block, costing damage and stamina but
> not staggering. We have no such window: a mistimed parry in our game is a clean whiff. That
> is harsher than DS3 and should be revisited if parry proves undroppably difficult in play.

---

## 5. RI-CMB08 — healing flask

Item's own provenance is exemplary: it explicitly says the real Estus frame data is **not**
reproduced and that 65 frames should not be attributed to it. Nothing here contradicts the
item; the finding is that its *charge model* silently mixes three games.

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 41 | Finite, rest-refilled healing flask; charges spent regardless of outcome; no passive regeneration | Correct for DS1, DS3, ER | **confirmed** |
| 42 | **5 charges at game start** | DS1: an unkindled bonfire restores **5** — but the charge count in DS1 is a property of the **bonfire** (5 / 10 / 15 / 20 via kindling and the Rite of Kindling), not of the flask. DS3 starts you with **3** Estus + 1 Ashen | **needs-amendment** (source attribution) |
| 43 | **Maximum 15 charges** | DS3's cap is **15 total, split by the player between Estus and Ashen Estus**. DS1's cap is 20 | **confirmed** as DS3-derived; the shared-with-Ashen structure is not carried over, which is fine |
| 44 | **Flask level +0 … +10** | DS3 exactly (Undead Bone Shards). DS1 caps at **+7**; ER at +12 | **confirmed** as DS3-derived |
| 45 | Heal is a **percentage of max HP** (40.0% → 72.0%) | **No Souls game heals a percentage.** DS1 Estus: flat **300 → 800** HP across +0…+7 ([DS Wiki](https://darksouls.fandom.com/wiki/Estus_Flask_(Dark_Souls))). DS3 Estus: flat **250 → 600** HP across +0…+10, with steeply diminishing returns (+85 HP for the first upgrade, +10 for the last) ([Fextralife DS3](https://darksouls3.wiki.fextralife.com/Estus+Flask)) | **contradicted** as Souls behaviour; **good design** on its own terms — see amendment |
| 46 | "Charges refilled by resting or respawning. **Nothing else.**" | DS3 also refills Estus from a **hidden gauge filled by souls from fallen enemies**, and from defeating invaders/players ([Fextralife DS3](https://darksouls3.wiki.fextralife.com/Estus+Flask)) | **contradicted** as a description of Souls; our rule is stricter and is a legitimate construction |
| 47 | 65-frame drink animation, 21/31/13 phase split | No frame data exists publicly for any game's drink animation | **unverifiable** — correctly declared as such by the item |

### Proposed amendment 10 — RI-CMB08, name the blend and defend the percentage heal

Add to the provenance note:

> **The charge model is a three-game blend and should say so.** "5 at start" is Dark Souls 1
> (an unkindled bonfire restores 5 — though in DS1 the charge count belongs to the *bonfire*,
> which can be kindled to 10/15/20, not to the flask); "maximum 15" is Dark Souls 3's flask cap
> (which DS3 splits between Estus and Ashen Estus, a structure we do not carry); "+0…+10" is
> Dark Souls 3's Undead Bone Shard ladder (DS1 caps at +7, Elden Ring at +12).
>
> **The percentage heal is ours and is a deliberate improvement, not a recollection.** Every
> FromSoftware flask heals a **flat** amount: DS1 300→800 HP over +0…+7
> ([DS Wiki](https://darksouls.fandom.com/wiki/Estus_Flask_(Dark_Souls))), DS3 250→600 HP over
> +0…+10 ([Fextralife DS3](https://darksouls3.wiki.fextralife.com/Estus+Flask)). Flat healing
> is why a DS3 flask that is a full heal at SL20 is a third of a bar at SL120, and why the
> flask ladder has to be tuned around an assumed HP curve. Our `heal_pct = 0.400 + 0.032 ×
> level` keeps the flask's *meaning* constant across the whole game and decouples RI-CMB08 from
> RI-PRG02's HP curve. Note also that DS3's real upgrade curve is steeply **concave** (+85 HP
> for the first upgrade, +10 for the last) where ours is exactly **linear**; that is a second
> divergence and it makes late flask upgrades more valuable in our game than in DS3.

---

## 6. RI-PRG01 — the soul cost curve

This item audits clean. Its Dark Souls reference column is **exactly right**, digit for digit.

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 48 | DS formula, levels 13+: `0.02n³ + 3.06n² + 105.6n − 895` | Verbatim on both wikis ([DS1](https://darksouls.wiki.fextralife.com/Level), [DS3](https://darksouls3.wiki.fextralife.com/Level)) | **confirmed** |
| 49 | DS formula, levels 2–12: `0.0068n³ − 0.06n² + 17.1n + 639` | Fextralife DS1 says the cubic applies "for level 12 and beyond"; both formulas evaluate to **847** at n=12, so the 12-vs-13 boundary is cosmetic and produces no numeric conflict. DS3 describes levels 2–12 as "about 2.5% per level", which the low-band fit reproduces | **confirmed** |
| 50 | "identical in DS1 and DS3" | Same cubic, same table shape, same 2–12 band. **DS3 rounds down where DS1 rounds to nearest**, worth 0–1 souls per level (DS1 L25 = 3970, DS3 = 3969; DS1 L30 = 5567, DS3 = 5566) | **confirmed** with a one-line caveat |
| 51 | Every cell of the DS reference column, L2 → L140 | 673 / 724 / 811 / 1445 / 2601 / 3970 / 5567 / 9505 / 14535 / 20777 / 28351 / 37377 / 47975 / 60265 / 74367 / 90401 / 108487 / 128745 — **all 18 sampled cells match the shipped DS1 table exactly** | **confirmed** |
| 52 | "SL120 functions in Dark Souls as a meta target" | Design commentary, not a checkable figure | **unverifiable** (and harmless) |

### Proposed amendment 11 — RI-PRG01, one caveat sentence

Change *"`DS` columns use the community-documented Dark Souls formula (identical in DS1 and DS3)"*
to:

> `DS` columns use the community-documented Dark Souls formula. It is the same formula in DS1
> and DS3 — `0.02n³ + 3.06n² + 105.6n − 895` for level 13+ — with one difference: **DS3 rounds
> down** where DS1 rounds to nearest, so DS3 is 0–1 souls cheaper at some levels (DS1 L25 =
> 3970 vs DS3 3969). The DS columns here are DS1's shipped table, verified cell-by-cell against
> [Fextralife — Level (DS1)](https://darksouls.wiki.fextralife.com/Level).

**Upgrade:** the DS reference column's provenance moves from `community-data / medium` to
`community-data / high`. It is not a "player-reconstructed fit accurate to a few souls" as the
item modestly claims — it is the shipped table, and our column reproduces it exactly.

---

## 7. RI-PRG07 — equip load

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 53 | "DS1 at 25/50/100, DS3 at 30/70/100" | Both correct | **confirmed** |
| 54 | "our 30/55/80/100 is a four-tier variant of that idea, not a copy of either" | Correct, and honestly stated | **confirmed** |
| 55 | i-frame and roll-distance columns held provisionally, owned by `corpus/10-combat/` | Correct, and the item says so | **confirmed (as a disclosure)** |

### The corpus's worst internal contradiction is here, and it is not small

RI-PRG07 §2 and RI-CMB01 §B describe **different equip-load systems**, and both are written as
binding.

| | RI-CMB01 §B (`ES-ROLL/1`) | RI-PRG07 §2 |
|---|---|---|
| Number of tiers | **4** | **5** |
| Breakpoints | 30 / 70 / 100 | **30 / 55 / 80 / 100** |
| Tier names | LIGHT, MEDIUM, HEAVY, OVERLOADED | Light, Medium, Heavy, Overburdened, Immobilised |
| I-frames | 13 / 11 / **5** / 0 | 13 / 11 / **9** / **7** / — |
| Roll distance | 5.20 / 4.40 / **2.60** / 1.10 m | 5.2 / 4.4 / **3.5** / **2.4** / 0.8 m |
| Roll stamina | **22 / 26 / 34 / 40** | **20 / 22 / 25 / 32 / 40** |
| Stamina regen | ×1.00 / ×1.00 / ×0.80 / ×0.60 | ×1.00 / **×0.93** / **×0.85** / ×0.70 / ×0.40 |

Every column disagrees. RI-PRG07 attempts to resolve this in advance — *"The i-frame,
roll-distance and stamina-cost columns are provisional and subordinate to
`corpus/10-combat/` … What this item owns and does not concede is the **tier structure**:
four tiers, at 30/55/80/100"* — but **the tier structure is exactly what conflicts.** The
clause cedes everything except the one thing in dispute, so the conflict is not resolvable by
reading the items; it needs an orchestrator ruling.

The stakes are concrete. RI-CMB01's **M5 threshold-cliff check** fails a build whose i-frame
count changes anywhere other than at 30.00→30.01 and 70.00→70.01. A builder who implements
RI-PRG07's ladder produces transitions at 55% and 80% and fails M5 — while a builder who
implements RI-CMB01's ladder fails RI-PRG07's method 4, which *"asserts exactly four
transitions, at ratios 0.30, 0.55, 0.80 and 1.00"*. **The two items' own test suites fail each
other.** No amount of external verification catches this; it is a pure internal conflict and it
is the most likely reason our build will not converge.

One point in RI-PRG07's favour worth preserving whichever way the ruling goes: its table header
reads **"I-frames @60 fps"**. It is the only equip-load table in the corpus that states its
framerate, and it is the practice §0 recommends everywhere.

One further note for whoever rules: DS3 explicitly removed equip load's effect on movement
speed below 100% ("Unlike Dark Souls 1, Equipment Load has no impact on run speed or sprint
speed when it is under 100%",
[Fextralife DS3](https://darksouls3.wiki.fextralife.com/Equipment+Load)). RI-CMB01's `HEAVY`
tier applies a 0.72× animation speed. That is DS1's model, and it is a third place where the
30/70 DS3 breakpoints have DS1 behaviour hung off them.

---

## 8. RI-CAM01–07 — the camera

| # | Claim | Real source says | Verdict |
|---|---|---|---|
| 56 | "Dark Souls III auto-rotates the camera behind a moving player; Elden Ring exposes it as a 'Camera Auto Rotation' setting" (RI-CAM02 provenance) | **Correct.** Elden Ring ships an explicit Camera Auto Rotation option (System → Camera), on by default; DS3's is not exposed in-game, which is why a Nexus mod exists purely to disable it ([Nexus](https://www.nexusmods.com/darksouls3/mods/2028), [Steam](https://steamcommunity.com/app/1245620/discussions/0/3183486320470225224/)) | **confirmed** — the earlier correction the brief referred to was applied correctly and needs no further action |
| 57 | RI-CAM02's ruling: keep auto-recentre but gate it behind a committed sprint | Design decision; both upstream games gate it on *any* movement, so ours is a narrower, more player-respecting variant | **confirmed as a declared divergence** |
| 58 | RI-CAM03: players compare Elden Ring's large-enemy framing unfavourably with DS3's and Sekiro's | Widely reported; the item already cites it as "corroboration that the problem is real, not a source for any number" | **confirmed** |
| 59 | Lock-on acquisition 14.0 m / break 18.0 m (RI-CMB06 §A) | No citable figure for any Souls game was reached | **unverifiable** — correctly declared `constructed` |
| 60 | Lock does not auto-hop to the next enemy on target death | Consistent with DS1/DS3/ER behaviour as reported, but no citable statement was found | **unverifiable** (shape recalled correctly) |
| 61 | Every camera spring half-life, boom length, framing band and latency in RI-CAM01/03/06 | `constructed`; no external analogue exists to check against | **unverifiable** — correctly declared |

The camera corpus needs **no amendments**. Its provenance notes are the most accurate in the
Souls half: they say exactly which rows are constructed, which are recalled, and which are
context-only, and the one externally checkable claim in the set is right.

---

## 9. RI-CMB02, RI-CMB04, RI-CMB06, RI-AI01–07, RI-WPN01–06

These are wholly `constructed`. RI-CMB02's provenance note is the model the rest of the corpus
should follow — *"No cell is a measurement of any FromSoftware title and none should be cited as
one"* — and it separately lists the qualitative properties it recalled as grounding. Those
qualitative claims were checked where possible:

| # | Grounding claim (RI-CMB02) | Verdict |
|---|---|---|
| 62 | "Heavy attacks carry hyperarmour on large weapons and not on small ones" | **confirmed** — DS3 grants active poise to Ultra Greatswords, Great Hammers, two-handed Greatswords and certain Weapon Arts ([Fextralife DS3 Poise](https://darksouls3.wiki.fextralife.com/Poise)) |
| 63 | "Recovery is partially roll-cancellable but startup and active frames never are" | **confirmed** as the shape of DS1/DS3/ER; no citable per-class cancel windows exist |
| 64 | "Daggers swing in a small fraction of the time an ultra greatsword does"; "active windows are a small minority of any swing"; "two-handing changes poise damage more than timing"; "R1 chains shorten their own startup" | **unverifiable** — no public per-weapon frame-data table was reached in this pass (see §10) |

**But the §0 unit finding applies to RI-CMB02 with full force.** Its straight-sword R1 startup
of 12 f is 200 ms at 60 Hz; its ultra-greatsword R1 of 29 f is 483 ms; its UGS R2 of 52 f is
867 ms. Souls attacks in the equivalent classes are, in wall-clock terms, roughly twice that.
The item is entitled to its own pacing — it says so — but the two pinned cells
(`Ps = 13` and `Ps = 26`) are pinned in *frames*, and if the orchestrator chooses the "rebase"
option in §0 they must move together with RI-AI03's punish-window figures.

**No amendment is proposed for these items** beyond whatever the §0 ruling implies. They are
honestly labelled and there is nothing external to check them against.

---

## 10. What could not be verified, and why

| Figure | Why not |
|---|---|
| Per-weapon-class attack frame data (startup / active / recovery) for **any** FromSoftware title | No citable public frame-data table was reached in this pass. Extracted param tables **do** exist — `EquipParamWeapon`, `AtkParam`, `BehaviorParam`, and the community's `Paramdex` repository — and a successor should start there. This is the single highest-value remaining target: it would let RI-CMB02's *shape* claims be checked properly. |
| Elden Ring per-tier roll i-frame counts | Community testing is openly contradictory. Fextralife's Dodging page declines to give a table; some testers report light = medium, others report light + 3. Elden Ring Reforged's 13/12/11 is a **mod's rebalance**, not vanilla. |
| Per-shield parry startup and active frames in any game | Fextralife's DS3 Parry page carries no frame data. The community per-shield charts were not reachable from a citable source. |
| Backstab and riposte animation lengths and invulnerability windows | Same. |
| Estus drink animation length in frames | Same — and RI-CMB08 already says so. |
| Lock-on acquisition and break ranges in metres | No game publishes these; no community measurement was found. |
| DS1's exact post-spend stamina regen delay | DS1 is documented as *animation-gated* ("Attacking stops all Stamina recovery until the animation finishes") rather than carrying a fixed delay. The 0.70 s figure our corpus uses is a **DS3** measurement. This is not an error — but RI-CMB03's provenance attributes the delay to "reported Dark Souls 1 behaviour", and the source is DS3. |
| Shield stability → stamina-cost formula | No citable formula reached for any game. |
| DS3 "chainable ~10× rolls on a full bar" | Roll stamina costs per equip-load tier were not found. |
| `en.uesp.net` | Still 403 (UESP's own bot protection). Not relevant to this task. |
| `darksouls.wikidot.com`, `darksouls3.wikidot.com` | Blocked by this environment's host allowlist ("Host not in allowlist"). Fextralife and Fandom cover the same ground. |

### Access notes for successors

- **Fandom blocks plain `curl` and `WebFetch` with 403**, but its API is open:
  `https://<wiki>.fandom.com/api.php?action=parse&page=<Page>&prop=wikitext&format=json`.
  This is how the DS1 roll frame table was obtained.
- **Fextralife serves fine to `curl`** with a desktop User-Agent, but returns 403 to `WebFetch`.
  Strip tags locally.
- **Reddit's JSON endpoints 403.** Steam community, Nexus and GitHub are reachable.

---

## 11. Contradictions found between our own items

1. **RI-PRG07 vs RI-CMB01 — the equip-load ladder. The most serious finding in this audit
   after §0.** Five tiers at 30/55/80/100 vs four at 30/70/100; i-frames 13/11/9/7 vs
   13/11/5/0; three more columns disagree. RI-PRG07's escape clause cedes the numeric columns
   but explicitly refuses to concede the tier structure, which is the thing in dispute. The
   two items' own method scripts fail each other: RI-CMB01's M5 demands cliffs at exactly
   30.00% and 70.00%; RI-PRG07's method 4 asserts exactly four transitions at 0.30, 0.55, 0.80
   and 1.00. Needs an orchestrator ruling before any implementation work. (§7)
2. **RI-CMB01 §A's framing vs RI-CMB01 §B's rationale.** §B justifies its i-frame counts by
   "DS1's stinginess … fewer i-frames than DS3". That comparison is only meaningful because
   both games' counts are 30 fps ticks — a fact §A never states, while §B's own counts are
   60 Hz. Two different units in one argument. (§0)
3. **RI-CMB03 `## The bar` vs RI-CMB03's provenance note.** The bar presents the
   drop-the-input stamina gate as the thing that "makes the economy feel like Souls"; the
   provenance note correctly lists it as constructed. No Souls game implements it. (§3)
4. **RI-CMB05's provenance vs RI-CMB05's model.** Cites DS3 exclusively; implements Elden
   Ring. (§4)

---

## 12. What this audit did *not* find

Worth stating plainly, because the brief asked for the failure mode and the honest answer is
that most of the corpus survived:

- **No fabricated citation.** Every URL in every provenance note that was checked resolves and
  supports what it is cited for.
- **No number was found to be wrong where the item claimed high confidence in a
  `community-data` figure.** DS1's 25/50, DS3's 30/70, 11 and 13 i-frames, 45 stamina/second,
  the −80% guard-raised regen, the 0.70 s regen pause, the whole DS soul-cost column — all
  correct.
- **No Morrowind leakage into the Souls combat path.** No dodge-chance, no agility roll, no
  to-hit check appears anywhere in RI-CMB01–08. ARBITRATION S1 holds.
- **The items that said "we did not verify this" were telling the truth**, and in two cases
  (RI-CMB02, RI-CMB08) they explicitly forbade citing their numbers as FromSoftware figures.
  That discipline is why this audit was cheap.

The corpus's problem is not dishonesty. It is a unit.
