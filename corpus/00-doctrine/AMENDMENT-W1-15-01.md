# AMENDMENT-W1-15-01 — three arithmetic defects in the stealth/crime items, and two harness additions

**Filed by:** wave-1 piece W1-15 (stealth, theft, crime and justice), builder.
**Status:** proposed. Each section states the arithmetic, so a critic can reject it by doing the
same arithmetic rather than by disagreeing with a preference.

Two prior amendments in this project were rejected as unearned. None of the four claims below is
a request to move a bar. Three are cases where a reference item **contradicts itself** and the
build cannot satisfy both halves; one is a vocabulary extension the items themselves demand by
name. Every threshold in every item stands.

---

## §1 — `RI-STL01` §2's stated light exponent cannot produce `RI-STL01` §2's own worked table

### The claim

RI-STL01 §2 gives the visibility formula as

```
V = clamp( L^0.7 × M × S × E × A , 0.05 , 1.30 )
```

and then publishes five worked rows for an INFANTRY (`R` = 16 m) at 8 m. **`γ = 0.7` cannot
produce three of those five rows.** `γ = 1.36` produces all five within 0.5%.

### The arithmetic

Every term but `L` is read straight off the item's own table.

| Row | item `V` | `V` at γ=0.7 | `t` at γ=0.7 | `V` at γ=1.36 | `t` at γ=1.36 | item `t` |
|---|---:|---:|---:|---:|---:|---:|
| 1 sprint, torchlit, heavy, Sneak 5 | 1.300 | 1.3000 *(clamped)* | 1.026 s | 1.3000 *(clamped)* | 1.026 s | **1.03 s** |
| 2 walk, dim, medium, Sneak 5 | 0.339 | **0.6745** | **1.977 s** | 0.3373 | 3.952 s | **3.94 s** |
| 3 crouch, dim, light, Sneak 45 | 0.157 | **0.3151** | **4.232 s** | 0.1576 | 8.461 s | **8.5 s** |
| 4 crouch, unlit, light, Sneak 45, cover | 0.050 *(the item writes "clamped")* | **0.0733 — not clamped** | **18.179 s** | 0.0500 *(clamped)* | 26.667 s | **26.7 s** |
| 5 still, unlit, light, Sneak 100, cover | 0.050 *(clamped)* | 0.0500 *(clamped)* | 26.667 s | 0.0500 *(clamped)* | 26.667 s | **26.7 s** |

Rows 1 and 5 clamp at both exponents and discriminate nothing. Rows 2 and 3 are 2.0× and 2.0×
wrong at γ=0.7. **Row 4 is the decisive one**: the item annotates its `V` as `0.050 (clamped)`,
and at γ=0.7 the raw value is 0.0733, so the floor the item says fired does not fire. The item's
own annotation is false at the item's own stated exponent.

Solving the two unclamped rows for the exponent gives 1.35533 and 1.36351.

### Why the table wins and the exponent loses

The Comparison method makes both normative and they are unsatisfiable together — method 1
asserts conformance to the *formula* on 100k cases, method 2 asserts the five *times* within 5%.
One must yield. The table is chosen because:

1. **It is three constraints and the exponent is one.** Three rows disagree with `0.7`; zero
   rows disagree with `1.36`.
2. **It carries the design intent.** The rows are what §2's prose argues about — "the floor at
   0.05 is a floor, not zero ... it finds you in 27 seconds", "the ceiling is 1.30, above the
   naive 1.00". At γ=0.7 the 27-second row is an 18-second row and the floor never fires.
3. **It agrees with §3's prose.** "The lighting artist is a stealth designer" and
   DARK-COVERAGE's `L ≤ 0.10` threshold both assume darkness is *dark*. At γ=0.7 an `L` = 0.10
   tile multiplies detection by 0.20; at γ=1.36 it multiplies it by 0.044.

### What was built

`game/data/stealth/detection.json` carries `visibility.light_exponent: 1.36` **as data**, with
the full arithmetic and a `how_to_disagree` field. Nothing in the code hardcodes it: set it to
0.7 and `tools/harness/stl-probe.mjs` STL01-M2 fails instead, which is the correct behaviour for
a disputed number.

### Requested

Correct `RI-STL01` §2's formula to `L^1.36`, or restate the five worked rows at `L^0.7`. Either
resolves it; shipping both does not.

---

## §2 — `RI-CRM02` §4's exclusivity table permits three simultaneous sanctioning authorities, and §8 asserts two

### The claim

RI-CRM02 §8's census row reads **"Max simultaneous sanctioning authorities: 2, hard fail ≥ 3"**.
§4's exclusivity table, taken as written, permits **three**.

### The arithmetic

The reachable triple is **Warrant of Attainder + Ledger silence + a ku-vastei Ruling**:

| Pair | Forbidden by any §4 row? |
|---|---|
| Ninth Cohort ≥ 4 and Wet Ledger ≥ 3 | no — Cohort forbids only Morag Tong and Sap-Cutters; Ledger forbids only Xul-Aneekh and Sap-Cutters |
| Ninth Cohort ≥ 4 and ku-vastei | no — the only ku-vastei exclusion in §4 is *Morag Tong contact* |
| Wet Ledger ≥ 3 and ku-vastei | no — no row mentions the pair |

§4's prose lists the reachable pairs and never notices that their union is reachable too.
Found by exhaustive search over the 16-element join graph
(`tools/harness/stl-probe.mjs`, assertion `CRM02-M5b`), not by reading.

### What was built

One further exclusion, in `game/data/crime/sanction.json`, carrying its own provenance field:

> **Wet Ledger ≥ 3 cannot hold a ku-vastei petition.** The Ledger's product is that no report is
> ever made. A ku-vastei Ruling is a public record of the killing, spoken aloud to a family. The
> two are not merely incompatible services, they are opposite ones, and the Ledger will not pay
> for a silence you intend to break.

This is the only new pair whose in-fiction reason falls out of the two institutions' own stated
products rather than being invented to close an arithmetic hole. It raises §8's
`mutually_exclusive_pairs` count from 10 to 11, which is still inside the "≥ 8" band.

### Requested

Add the row to `RI-CRM02` §4, or lower §8's `max_simultaneous_authorities` to 3 and restate the
hard fail. The corpus should not assert 2 while permitting 3.

---

## §3 — `RI-STL02` §6 declares a fence-greed range that its own method 9 assertion excludes

### The claim, briefly

§6 declares `fenceGreed ∈ [0.85, 1.10]`. Method 9 asserts *"the best achievable fence multiplier
at Mercantile 100 is in [0.58, 0.62]"*. With the item's own `0.35 ×` base and its own worked
`mercantileTerm(100) = 1.71`:

```
0.35 × 1.71 × 1.10 = 0.658   — outside the asserted band
0.35 × 1.71 × 1.00 = 0.599   — the value §6's prose actually computes
```

§6's prose worked case silently uses greed 1.00, not the 1.10 its own range permits.

### What was built

The shipped roster of nine fences tops out at greed **1.02** (`0.35 × 1.71 × 1.02 = 0.6105`),
inside the declared envelope *and* inside the asserted band. `game/data/crime/fences.json`
states this in a `greed_envelope_note` rather than hiding it.

### Requested

Narrow §6's range to `[0.85, 1.02]`, or widen method 9's band to `[0.58, 0.66]`. This is the
smallest of the three and could reasonably be left as an authoring constraint.

---

## §4 — Two harness extensions, both demanded by name by the items they serve

Filed here rather than as a separate document because both are additions to closed sets that
`HARNESS.md` itself declares extensible, and neither changes anything already emitted.

### AM-W1-15-01 — `crouch` enters `HARNESS.md` §4's closed action set

RI-STL01's Comparison method opens: *"Button `crouch` added to `HARNESS.md` §4's closed button
set. Without it, no stealth scenario is scriptable at all. **This is a blocking dependency.**"*
Its "How we lose" states the consequence of not doing it: the item *"scores 0 fail-closed under
`HARNESS.md` §5, and it will look like a stealth-design failure rather than a tooling one."*

Built. Fifteen names now (`game/src/input/actions.js`), bound to `KeyC`/`KeyZ`, both previously
unbound; `auditBindings()` returns `[]`; none of RI-JRN03 §B's three collision rulings is
touched. It is a **toggle**, not a hold, and the reason is stated in the source: RI-STL01 §5 puts
sneak at 0.85 m/s and a 40 m warehouse at 47 s crouched, and a 47-second hold is a hand cramp.

### AM-W1-15-02 — 27 event types enter `HARNESS.md` §5's closed event vocabulary

§5 describes the vocabulary as *"a closed vocabulary, extensible by amendment"*. Four items name
events by string in their Comparison methods and cannot emit them:

| Item | Events it names |
|---|---|
| RI-STL01 | `detect` `challenge` `search_start` `search_end` `zone_alert` `light_snuffed` `distraction` |
| RI-STL02 | `theft` `pickpocket` `lock_attempt` `lock_open` `pick_break` `trespass_enter` `fence_sale` |
| RI-CRM01 | `crime` `witness` `report` `bounty_change` `arrest` `jail_serve` `corpse_found` `bloodprice` |
| RI-CRM02 | `writ` |

Added, plus four of this piece's own — `crouch`, `crouch_refused`, `civ_state`, `lock_ward_set`,
`death_flag` — named separately rather than folded into a neighbour's meaning. The event bus
still throws on an unknown type, so the set is still closed.

---

## What this amendment does NOT ask for

- No threshold is lowered. DARK-COVERAGE stays ≥ 30%, SNUFFABLE ≥ 60%, ownership 100%/92%/240,
  trespass ≥ 180 zones, R5-BYPASS ≥ 67%, BOSS-BYPASS 0, the 17-crime schedule, the jail ledger.
- No binary axis is softened. OPENER-PURITY, NO-METER, lock determinism, bounty persistence,
  S10 handling, mid-fight accrual and the AR-3 encounter flip are all built as written.
- Seam **S21** is applied against `RI-STL02` §5's text rather than amended: ARBITRATION §2 names
  RI-STL02 as the item to be reconciled, and ARBITRATION §5 puts the seam rulings above an
  item's own comparison method. The pickpocket keeps its roll. That is a precedence *application*,
  not an amendment, and it is documented in
  `game/data/stealth/theft.json → pickpocket.the_die.conflict`.
