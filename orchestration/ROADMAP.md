# The roadmap

**Derived, not remembered.** Every item below comes from `ROADMAP-COVERAGE-AUDIT`, which enumerated the
repo from disk: **149 reference items, 49 plans, 79 open gaps.** The previous roadmap was written from
an orchestrator's working memory, left 14 whole areas homeless, and was deleted rather than patched.
`CLAUDE.md` rule 0b exists because of it.

**Coverage is proven, not asserted.** `node tools/roadmap-coverage.mjs` regenerates the mapping and
**exits non-zero** if any reference item, plan or open gap has no home, or if the order violates a
recorded dependency. It reports `uncovered: 0` on all three and `dependency_order_violations: 0`.

- **The mapping** — which reference items and gaps each item carries: `reports/roadmap-audit/coverage.md`
- **The reasoning** — inventory, structural findings, the sequencing argument: `reports/roadmap-audit/AUDIT.md`
- **Where we are today, in one screen:** `STATUS.md` at the repo root.

---

## How this is organised, and why not "Morrowind half / Souls half"

The governing rule is unchanged — **inside the fight Souls wins; everywhere else Morrowind wins** — but
it settles *conflicts*; it is not a work breakdown. Measured: **41 of 149 reference items (27.5%) are
`neutral`, `split` or `modern-fidelity`** and belong to neither half, and the 4 explicitly `split` items
are each one piece of work that the split would cut in two.

So: **ring** = when it can run, ordered by dependency and not by importance. **Track** = what it
touches, which is what makes two items safe to run in parallel.

**Work the lowest unfinished ring, two to four agents at a time.** An item is `done` only when it is
delivered **and independently judged at or above the bar** (min-over-axes ≥ 7.0). Delivered and judged
are different words here.

---

## Ring 0 — Instruments. Continuous, never "finished"

They deliver no player-visible change; they decide whether any other claim is true, so they run
alongside everything.

`I1` harness and determinism · `I2` capture and the Deck · `I4` consumption as a gate ·
`I5` **the corpus audited and extended** · `I3` **the blind protocols**

**`I5`'s first job is the character reference set** — images **and motion**, at Skyrim/ESO quality, for
builders to target and critics to compare against. It does not exist, `F10` cannot be judged without
it, and `RI-VIS08` **refuses Morrowind references** for characters (Morrowind characters are ~1,000
triangles). `I5` also owes the **design half** of the character bar: `RI-VIS08` §D stops at *fidelity*
and nothing among the 149 items covers character or creature **design**. Both are binding — see the
character directive in `CLAUDE.md`, which `tools/readpath.mjs` guards.

**`I5` comes before `I3`**, and that ordering is the point: a pack built on reference plates that cannot
satisfy their own rows is not a judgement. Protocol A has run **once** — we lost 5 of 5. Protocol B has
**never run**.

## Ring 1 — The frame

Wave 1 by owner directive: *"it's not worth progressing to wave 2's depth unless we can make the game look pretty good."*

| | | state |
|---|---|---|
| `G1` | **The camera** — the instrument the body is judged through | `RI-CAM01` 2/10; `RI-CAM03`/`04` never judged. **Diagnosed 14 Aug:** trees are `InstancedMesh` in `province.js` and were never wired into any `CollisionCell`, so the spring arm was working exactly as designed against a set a tree could never be in. **A fix of the correct category already landed** (`b476b55d`, camera-to-actor segment test) and **nobody has re-measured §C.1 against it.** Measurement instrument built; blocked only on the shader regression |
| `F1` | **Materials and surface response** | Delivered, then **judged FAIL 1/10** — the fix exposed a duplicate-uniform collision that stopped **66 of 124** actor-body programs linking, so no character had a body. **Regression fixed and confirmed: 124/124 link**, verified at 8 orbit angles both arms. **Delete-the-fix confirmed** (reverting on a control clone reproduces 66/124 failing with identical GLSL errors) and the new `NO-UNRUNNABLE-PROGRAM-IN-SCENE` census check is **proven to fire** — red on the reintroduced defect while the 5 pre-existing checks stay green, which is the point: it catches a class they structurally cannot. Outstanding: one named statistic (`base-frame-ab.mjs` shipped-config delta) not re-run; and a real tool bug — the collision gate hardcodes its entry and silently ignores `--entry`, which produced a false green on the first delete-the-fix attempt |
| `F2` | **Shadow, contact and ambient occlusion** | **delivered 14 Aug, not yet judged.** The old "AO" was a depth-discontinuity edge detector, max 12% darkening, **blind to any continuous-depth contact** — i.e. blind to the exact case the judges named. Replaced with ten-tap hemisphere SSAO. Contact-junction ratio **0.722** (bar: ≥25% darker than open ground); delete-the-fix returns **1.1347** and correctly fails. **Known artifact:** derivative-based normals read each low-poly terrain facet as its own plane, producing a visible grid on settlement ground — capped at 0.6, not solved; a real fix needs a G-buffer normal target. **Evidence gap: no motion or multi-angle capture** — the owner's standing directive requires both for a visual claim, so this is delivered on stills alone and a critic should say so |
| `T4` | **The Morrowind screens** — inventory, map, character sheet, level-up, journal, out-of-combat HUD, the dialogue window's look, UI diegesis | **Moved from ring 6.** On screen in the first few minutes; we hold Morrowind interface references (`REF-A12b`, 33 plates, plus OpenMW layouts with exact widget rects); journal **7/10**, books **8/10**, inventory 6/10 — several are near the bar already. Combat HUD (`RI-UIX01`) and out-of-combat HUD (`RI-UIX07`) **never judged** |
| `F3` | **Ambient fill** — shadows stop crushing to black | named by 3 of 5 |
| `F4` | Light, sky and atmosphere | |
| `F5` | The frame pipeline — post, tonemap, exposure | |
| `F6` | Terrain and vegetation | |
| `F7` | The water surface | axis-aligned banding open |
| `F8` | The building kit | 4 roof ids against a rule needing ≥5 |
| `F9` | **Interiors and practical light** | **71.8% of the indoor floor reads fully lit** |
| `F10` | **Characters and creatures** — see the character directive in `CLAUDE.md`. **Open hypothesis, owner-supplied 2026-08-15: INVERTED TRIANGLE WINDING.** Another project hit our exact see-through symptom and found it by signed-volume test — front faces culled, so you see the inside of the far surface, across two different generators. **This would have survived every fix we made**, because it is not a hole: our transparency was diagnosed as five geometric holes on a capture later found *void*, and the owner still reports the characters looking wrong. Check per-generator (sweep/lathe/mirror paths flip winding), check `DoubleSide` which *masks* it while leaving normals inward — a plausible contributor to the flat, unformed shading — and land a signed-volume regression guard **proven to fire**. | **No longer blocked — `I5` landed the reference set and `F10` has now been judged** (`W1-F10-CHARACTERS`, 15 Aug, on 93 **hardware** frames + a 3,005-frame bone trace): **ART 1/10 · FIDELITY 3/10**, an ordered pair, never averaged. The owner's *"look frankly ridiculous"* is confirmed and localised: **the rig is sound — foot slide 6 mm, root-motion r = 1.0000, grip error 0.000 m, foot IK 100% on slope and stairs — and the surface hung on it is not built.** Head-count canon 5.87–6.84 against a 7.0–8.0 band (0 of 41 in band); 41 figures collapse to **12** silhouettes with pairs at **IoU 1.0000**; face carries **1 of 7** landmarks; player **15,142** tris against 25,000. **Cheapest first move, one predicate:** `renderer.js:693` routes only `saxhleel`/`naga` to the reptilian body, so the **181 `argonian` NPCs — 44.4% of the roster — render as human mannequins**; 329 of 408 land on `base.humanoid`, which has no eye geometry at all. Ranked buildable list in the verdict §7 |
| `F11` | Animation quality | **1,150 clips authored and undrawn** |
| `F12` | VFX | |
| `F13` | Art direction and region identity | the most under-served |
| `F14` | Performance and LOD | |

## Ring 2 — The body and the fight

| | | state |
|---|---|---|
| `T1` | **Save and load** | three blocking gaps; a reload changes your roll class. Not a platform chore — a precondition of every ring-4 verdict |
| `T2` | **Controls and discoverability** | never measured. You cannot ask a stranger to judge feel through controls they cannot find |
| `G4` | **Enemies that can fight you** | blocking: an attack's swept volume does not cover the attacker's own translation |
| `G2` | The exchange — poise, stagger, i-frames | unmeasurable from the receiving end until `G4` |
| `G3` | Weapons and movesets, **wired** | **87 movesets unreachable** |
| `G5` | Bosses and encounter authorship | |
| `G6` | Combat HUD and impact feedback | |
| `G7` | **How the fight feels** | the owner's explicit ask; needs `G1` and `T2` first |
| `G8` | Healing, status, exhaustion | |

## Ring 3 — A world you can navigate by prose

| | | state |
|---|---|---|
| `W1` | Terrain form and roads | |
| `W2` | Regions that read differently | |
| `W3` | Variety within a region | the "six minutes of one kind of ground" problem |
| `W4` | **Settlements with an outside** | blocking: the inside of 115 buildings was built and the outside of none of 202 |
| `W5` | Doors, interiors, continuity | 76 overlapping pairs; 24 doors open into another building |
| `W6` | **Legibility — landmarks and prose directions** | gates both `P6` and `P3` |
| `W7` | Getting around | |
| `W8` | Dungeons and xanmeers | |
| `W9` | Water and hazards as play | |
| `W10` | The living world — schedules, homes | |
| `W11` | Strangeness and built alienness | |

## Ring 4 — The character and the economies

`C1` creation as a played scene · `C2` levelling and the hearth · `C3` load, inventory, upgrades ·
`C4` **gold** — souls are levelling only · `C5` affliction and disease · `C6` **magic that does what it
says**, 33 effects nothing reads · `C7` stealth and theft — **blocked on `F9`** · `C8` crime and justice

## Ring 5 — People, words and quests

`P1` the topic web and dialogue window *(in flight)* · `P2` voice, disposition, persuasion ·
`P3` the journal — its missing input is **world discovery**, not finished quests ·
`P4` books with a reader — **37,819 words with no reader**, the ledger's only `critical` ·
`P5` lore, canon, names · `P6` **a quest end to end without markers** ·
`P7` quest givers who exist — **9 of 94 stand anywhere a player can reach** · `P8` factions with real
ladders · `P9` **the main quest** · `P10` quest texture and consequence

## Ring 6 — The rest of the platform

`T3` load, streaming, budgets

*(`T4` the screens moved to **ring 1** — see above.)*

## Ring 7 — The whole thing

`E1` the opening · `E2` the first hour as interaction · `E3` death and recovery · `E4` cross-system
payoff and emergence · `E5` build identity · `E6` session shape and pacing ·
`E7` **endings and the last hour** · `E8` returning after a week ·
`E9` **sound** — barely started, and half of atmosphere

---

## Three things this ordering encodes, each bought with evidence

1. **Graphics-first is correct on *gameplay* grounds, not only presentation.** On a 16,996-cell
   chest-height grid across all 115 interiors, **12,210 cells (71.8%) read fully lit** — so the sneak
   model is reading a saturated light field. `F9` sits in ring 1 and `C7` in ring 4 for that reason.
   It is the strongest argument in the repo that the owner's directive is right on merit.
2. **A quarter of the open gaps are "built, correct, and connected to nothing"** — 87 movesets
   unreachable, 1,150 animation clips undrawn, 37,819 words with no reader, the Writ House rendering
   nothing. **Wiring what already exists is the cheapest visible progress available**, and it is a
   first-class kind of increment rather than tidying.
3. **The bar is thinnest exactly where we need it most.** 11 reference items judge 25 `render.*` paths
   — 0.44 per path against combat's 0.94 — 3 of the 11 have never been judged, and `RI-VIS02` scored
   0/10. Extending the bar for graphics is `I5`, in ring 0, because everything visual is judged through
   it.

## Honest position

**38 reference items have never been named by any verdict.** One item (`F1`) was delivered today and is
not yet judged. A completion percentage quoted against anything narrower than this list means nothing.

**The "79 open gaps" figure is inflated and the ledger cannot currently tell you by how much.**
`tools/gap-ledger.mjs` only accepts a closure from a **later wave**, so a gap remediated and
independently re-verified *within* wave 1 can never show as closed — `W1-00-r2` says so in its own
`gap_closure` note. Audited against the tree, at least three of the five headline
"built-but-connected-to-nothing" gaps are substantially fixed already:

- **PRNG never drawn** — fixed in `sim/entities.js` **and** independently judged closed in `W1-00-r2`.
  Blocked from showing closed purely by the wave-numbering rule. **Fix the tool, not the game.**
- **Creation renders nothing** — the symptom is gone; `W1-26-r3` played the whole scene end to end,
  P1–P10 PASS over two runs. A small guard and 11 untested journey nodes remain.
- **The library has no reader** (the ledger's only `critical`) — mechanically wired in `engine.js` and
  `machine.js`, self-verified by its builder against the gap's own acceptance string, **never
  independently judged.**
- **Weapon animation has no rendered consumer** — a 1,506-line `SkinnedMesh` rig exists with
  consumption and delete-the-fix evidence, **unjudged**. It also surfaced a new defect: a greatsword
  blade drawn underground.

**So the cheapest visible progress available is not building — it is judging what is already built.**
Four critics, no builders.

**The one that must not be sold as cheap:** `G3` weapons. The named symptom (`setLoadout()` rejecting
all 87 movesets) is fixed and reconfirmed in `W1-10-r3`, but the item still scores **3/10** because
weapon-class *distinctiveness* fails. That is design and tuning work, not wiring, and it stays in ring 2
behind `F11`.
