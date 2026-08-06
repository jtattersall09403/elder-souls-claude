# Orchestrator rulings — for `corpus-audit` to apply

These were escalated by agents who correctly refused to decide unilaterally. They are now decided.
Apply them across the corpus and record each in `CORPUS-COHERENCE-01.md`.

## R1 — The 30 Hz / 60 Hz rebase (now seam S22)

**Decided: REBASE.** Double every upstream frame count when adopting it, because upstream counts
1/30 s ticks and our sim runs 60 Hz. Our combat currently runs at roughly **double Souls
wall-clock speed** with every internal ratio correct — which is why nothing caught it.

Apply to: `RI-CMB01` (roll i-frames, durations), `RI-CMB02` (the whole attack table), `RI-CMB05`
(parry and critical windows), `RI-CMB08` (flask animation), `RI-AI02`/`RI-AI03` (windup and punish
windows, which were derived against the unrebased player numbers), `RI-WPN01`–`RI-WPN06` (all slot
frame data), `RI-CAM04` (tracking cutoff). **`RI-CMB03`'s 42-frame regen pause is already correct**
— it was the one place the conversion was done properly; do not double it.

Every frame figure must state its unit. A frame count without a framerate is a defect.

**`RI-CMB07`'s exemplar trace is invalidated and must be regenerated.** That cost is accepted.
Flag it in the ledger rather than silently leaving a stale exemplar in place.

## R2 — Equip load (now seam S23)

`RI-CMB01` owns in-fight tier behaviour; `RI-PRG07` owns out-of-fight encumbrance and may keep
finer granularity there provided it has no in-fight effect. On any in-fight disagreement,
RI-CMB01's number stands. Fix both items' method scripts, which currently fail each other.

## R3 — Poise provenance

`RI-CMB05`'s poise model (always-on depleting pool + hyperarmour on declared heavy frames) is
**not fictional — Elden Ring ships exactly that combination.** Its provenance note cites DS3
exclusively and is simply wrong about which game it copied. **This is a citation fix, not a
redesign.** Do not change the model.

## R4 — Stamina floor

`RI-CMB03`'s drop-the-input-below-cost rule is a **construction**, not Souls behaviour: DS3 lets
stamina go negative to −60 and both games gate on `stamina > 0`. It is a good construction for a
trace-verifiable sim. Keep it, and relabel it `constructed` with the divergence recorded — do not
present it as Souls behaviour.

## R5 — Undeclared blends

Two more to declare rather than change: `RI-CMB01` pairs DS3's 30/70 breakpoints with DS1's
tier-duration model (in DS3 light and medium rolls are the same length; light buys distance only),
and `RI-CMB08`'s flask mixes DS1 charge counts with DS3 upgrade rules. Both are defensible; both
must say so.

## R6 — Two manifest defects found by the merge tool (apply when Codex's set has landed)

Found by `tools/refs/merge-manifest.mjs`, deliberately left unfixed to avoid racing Codex on
`MANIFEST.json`. Apply **after** the external acquisition run has landed and been merged:

1. **All five `anti-generic/` records carry `side: "modern-fidelity"`.** §9 requires
   `"anti-generic"`. This one matters: anything selecting the fidelity population by `side` would
   pull five *deliberately generic-fantasy* anchors into the set they exist to be measured against.
2. **Two mwscr images are filed under two slots each**, so REF-A18 and REF-A19 are really 4 images
   each, not 5.
3. The remaining 121 warnings are the `corroboration: "one-host"` gap — unfixable under the old
   proxy, now cheap to close with a second source per file.

## R7 — Biome diversity is binding (now seam S24)

The world is **not** uniformly marsh. The map (`corpus/50-world/black-marsh-map-source.jpg`) is
authoritative and shows mountains, arid rock, jungle, petrified forest, dry moor, a red coast, two
different seas, and wetland — thirteen regions in `regions.json`, each of which must read as a
different place.

Water, tides and wetland belong to **specific regions**, never to the world globally. Any item,
brief or builder instruction implying a globally swampy world must be corrected. `RI-WLD04`'s blind
region-identification test (≥33/39 from unlabelled screenshots, ≥6 of 9 axes differing per pair)
is the enforcement and must be cited by world, art-direction, audio and encounter critics.
