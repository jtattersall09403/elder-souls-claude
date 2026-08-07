# `GAP-W1-region-1-has-no-boss`

**Filed by:** W1-SOULS round 3, against the enemy-roster piece and `W1-POPULATION`.
**Item:** `RI-PRG06` §1 / §3 (the soul budget), `RI-AI05` §D (the region mix).
**Status:** open. Reported by `node tools/progression/derive-soul-values.mjs --check` as an
`ANCHOR GAP`; fatal under `--check --strict`. **Not a soul-economy defect and not fixable here.**

## The measurement

`RI-PRG06` §3's region 1 is ninety-three bodies paying 12,665 souls, and it is not flat:

| tier | bodies | souls | share of the region |
|---|---:|---:|---:|
| trash | 90 | 8,065 | 64% |
| miniboss | 2 | 1,600 | 13% |
| boss | 1 | 3,000 | 24% |
| | **93** | **12,665** | |

**One boss and two minibosses are 4,600 souls — 36% of the region — from 3% of its bodies.**

The shipped world's danger tier 1 has neither. What is placed is fifteen bodies:
`{ beast_slitherfang: 5, drowned_lesser: 6, inf_trash: 4 }` — the three cheapest statblocks in
the build, all `tier: "trash"`. Both `elite` bodies in the game are fog gates, at danger tiers 2
and 5. So the placed tier-1 roster pays a mean kill of **24.93** against the anchor's **41.96**,
which is **−40.6%**, and it is short by almost exactly the set pieces that are missing.

## Why it was invisible until round 3, and this is the part worth reading

Rounds 1 and 2 anchored `K` on `RI-PRG06` §1's **all-tier** region-1 mean — `12,665 / 93 = 136.18`
— and pinned that number to `inf_trash`, which is `tier: "trash"` at `TIER_PREMIUM 1.0`. §3's own
R1 *trash* mean is `8,065 / 90 = 89.61`. **The ratio is 1.520, and it is the boss's share, spread
over the trash.**

That made the arithmetic come out. A region 1 built entirely from trash reached §1's region total,
because every trash body was silently carrying 1.52× its own weight to cover a boss that does not
exist. The shortfall was real the whole time and the anchor was paying it off.

Round 3 pins the anchor to the trash mean and lets `TIER_PREMIUM` carry the set pieces, which is
what the premium has always claimed to be. Region 1 now pays less, the shortfall is visible, and
it is attributable to the thing that actually causes it. The `ANCHOR` assertion in
`derive-soul-values --check` is what keeps it visible.

## What would close it

A tier-appropriate **boss** and two **minibosses** placed at danger tier 1. Nothing in the soul
economy can substitute: souls are derived from a body's own mass, and paying an under-massed body
more because of where it stands would be region-scaling a reward, which is the shape seam **S9**
forbids in terms. The bodies have to be built.

This is the same finding the round-2 verdict already reached from the other side — *"Region 1 is
not short because its trash is mispriced. It is short because it has no boss"* — filed here with a
name so it can be assigned, and with an assertion that goes red until it is.

## Related

* `RI-PRG06` `--check` ROSTER GAP (4 rows): no tier-appropriate archetype exists above danger
  tier 1 either. `guard_legion` is placed from tier 3 and is worth an R1 body; `drowned_greater`
  from tier 4; `cst_sap_speaker` and `champion_hist_marked` are both under-massed for the gates
  they hold.
* `W1-POPULATION-r1` §3/§4: the same roster poverty measured as an `RI-AI05` failure — fewer than
  eight distinct archetypes, RANGED and ELITE at 0% in every region.
