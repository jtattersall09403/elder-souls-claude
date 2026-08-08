# W1-23 round 4 — critic survey, the measurements behind the verdict

Evidence for `corpus/90-verdicts/wave1/W1-23-r4.md`. Every number here is reproducible by the
command above it. The `.json` artifacts these tools write live beside them under
`reports/w1-23-r4/` and are **untracked by design** — `reports/.gitignore` drops run artifacts
because they are regenerable from the tools, and keeps the written report, which is this file.

Commits: HEAD moved five times under this run. The browser measurements were taken between
`aa542ec` and `f94df62`; each block below stamps the commit its tool printed.

---

## A. On screen — twelve books, twelve rooms

`node tools/lore/critic-w1-23-r4-onscreen.mjs` — exit 0, commit `aa542ec`

Both halves of six registered contradiction pairs. Each leg: `enterInterior`, find the prop whose
`readable_book` is the target, stand 1 m from it toward the room centre, clear the rendered-text
register, press and release `interact` through `queueInputs`, step 8 frames, `renderFrame`, read
`getUIState` and `getRenderedText`.

| book | room | opened | chars drawn | own words on screen | nearest other document |
|---|---|---|---:|---|---:|
| the-blessings-of-the-coast | lilmoth-customs | ✓ | 1,531 | 9/9 | 3.20 m |
| ledger-and-journal-of-andrel-vorin | lilmoth-ledger-house | ✓ | 1,328 | 6/7 | 3.20 m |
| the-relief-of-the-reman-ford | stormhold-praetorium | ✓ | 1,447 | 8/8 | 3.20 m |
| the-water-does-not-take-sides | thorn-hall | ✓ | 1,686 | 6/6 | 4.97 m |
| standing-instruction-for-auxiliaries | stormhold-praetorium | ✓ | 1,579 | 6/7 | 4.52 m |
| the-serjeants-answer | blackrose-warders-hall | ✓ | 1,651 | 3/3 | 4.83 m |
| the-knahaten-years | gideon-chapel | ✓ | 1,644 | 9/9 | 11.59 m |
| what-the-water-went-round | lilmoth-rootpost | ✓ | 1,519 | 5/5 | 4.84 m |
| the-grange-book | gideon-grange | ✓ | 1,681 | 3/3 | 3.80 m |
| told-at-the-weir | thorn-trader | ✓ | 1,650 | 6/6 | 4.49 m |
| the-seventh-recension | soulrest-court-steps | ✓ | 1,581 | 2/2 | 3.29 m |
| for-the-ninth-clause | soulrest-court-steps | ✓ | 1,754 | 6/6 | 4.49 m |

```
opened the right book              12/12
drew ITS OWN words on the screen   12/12
drew another book's words as well      0
control (out of reach, prop present)  4/4 present, 4/4 stayed shut, 0 chars
```

**Two red arms.** The control is the same code with one parameter changed and it reports
`opened: null` and 0 characters drawn — watched failing, not assumed. The cross-talk arm's zero was
checked for vacuity: over the 132 ordered pairs of these twelve books, 6 pairs share two or more of
one book's needle words in the other book's full text, so a build drawing the wrong page would have
been caught.

**Why the round's `getRenderedText()` read 0.** `ui/system.js build()` returns early on
`builtFrame === ctx.frame && lastMode === mode && lastTouchSig === sig`. While a screen is up the
world is paused and `ctx.frame` stops advancing, so the key is constant for the life of the screen.
Clearing the register *after* the book is open and then asking for a frame draws nothing. Clear it
*before* the press and the forced build that opens the book draws into it.

## B. The census — every document in the six most loaded rooms

`node tools/lore/critic-w1-23-r4-shelf.mjs` — exit 1, commit `60b86ad`

| room | declared | spawned | min separation | separately openable |
|---|---:|---:|---:|---:|
| soulrest-court-steps | 14 | 14 | 2.60 m | 14/14 |
| gideon-grange | 9 | 9 | 2.66 m | 9/9 |
| gideon-court | 6 | 6 | 3.53 m | **4/6** |
| lilmoth-customs | 6 | 6 | 3.92 m | 6/6 |
| archon-guild-office | 5 | 5 | 3.42 m | 5/5 |
| helstrom-undertemple | 5 | 5 | 3.32 m | **3/5** |

41 of 45. The 2.6 m separation logic holds everywhere, including where it is tightest.

**Limit, stated because it bounds the finding:** only the rooms carrying four or more documents were
walked. The other 77 rooms with readables were not. Because the four failures are a *collision with
a second placement mechanism* rather than crowding, **4 is a lower bound.**

## C. The diagnosis — and the hypothesis it refutes

`node tools/lore/critic-w1-23-r4-blocked.mjs` — exit 1, commit `f94df62`

Pre-registered hypothesis, stated in the tool's header before the run: the exit door. `interact`
is taken for the way out within `DOOR_REACH_M` = 2.6 m of `continuity.interior_spawn` and taken
*before* the engine's prop reach; `render/interior.js` filters document *slots* to >3.8 m from the
spawn, but the player stands a metre off the slot, toward the room centre.

**Refuted.** All four are 10.16–12.18 m from the spawn.

| leg | opened | object→spawn | player→spawn | nearest other prop |
|---|---|---:|---:|---|
| gideon-court / a-short-account-of-the-pacification | — | 13.14 m | 12.18 m | "A tally sheet with a crease across it" 0.72 m |
| gideon-court / the-legates-seal-register | — | 12.66 m | 11.70 m | "A distraint order, the wax under the seal too pale" 0.50 m |
| gideon-court / the-casebook-i | ✓ **control** | 8.80 m | 8.12 m | — |
| helstrom-undertemple / the-coast-survey-line | — | 11.16 m | 10.16 m | "A kin-post kept clear, with no name cut on it" 0.90 m |
| helstrom-undertemple / the-helstrom-kin-list | — | 11.75 m | 10.78 m | "A kin-post, four fourth-days unanswered" 0.77 m |
| lilmoth-customs / the-blessings-of-the-coast | ✓ **control** | 11.10 m | 10.17 m | — |

The competitor in every case is a `game/data/world/readables/site-marks.json` entry at a hard-coded
coordinate (`"pos": [-3.6, 0.9, -4.6]`), and `engine.js:3270` takes the nearest prop inside reach:

```js
for (const o of this.sim.props) {
  if (o.taken) continue;
  const d = Math.hypot(o.pos[0] - p.pos[0], o.pos[2] - p.pos[2]);
  if (d <= o.reach_m && d < bestD) { best = o; bestD = d; }
}
```

`render/interior.js`'s 2.6 m `farEnough()` test is computed over the interior record's `readable[]`
list and nothing else. Two mechanisms, one room, no shared knowledge of coordinates.

## D. The naming band, four arms

`node tools/lore/critic-w1-23-r4-band.mjs` — exit 0

| arm | band | M1 | M2 | M3 | M4 | why |
|---|---:|---:|---:|---:|---:|---|
| 1 shipped | **0** | 9.1% | 5.93% | 2.37% | 0 | hard 0: unclassifiable > 2% |
| 2 the eight blamed names repaired | **3** (ladder 6) | 9.1% | 3.86% | 0.30% | 0 | violation rate → 3 |
| 3 arm 2 + one apostrophe | **0** | 9.1% | 3.86% | 0.30% | 1 | hard 0: a **different** clause |
| 4 arm 2 + 10% legal-but-wrong | 0 | 8.7% | 8.61% | 5.93% | 0 | my degradation also tripped M3 — my arm's defect |

The published remedy, run separately with culture-appropriate names — `Aurelia Hallow`,
`Marcus Sedd`, `Ottavia Tesh`, `Gaius Veth`, `Ashul-Vei`, `Mek-Tei`, `Eshi-Kha`, and `Archein`
stripped as a title: **band 3, ladder 6, M2 3.49%, M3 0.00%, M3 list empty.**

`tools/lore/lor04-validate.mjs` has no `IS_MAIN` guard, so importing it runs the whole validation
and exits the importer. `critic-w1-23-r4-band.mjs` copies the shipped bytes beside the original,
removes exactly that one line, prints the line it removed, and refuses to run if it is gone.

## E. Before and after, both arms of the shipped validator

```
node tools/lore/lor04-validate.mjs --at 97bb918     exit 1
  M1 56.6% §4 FAILED   M2 65.09%   M3 12.58%   M6 125   M7 43 reused, 18 slugs
  generated  260 people, 175 Argonian: descriptive 69.7%, violations 76.19%, unclassifiable 12.70%
  hand        77 people,  44 Argonian: descriptive  4.5%, violations 22.73%, unclassifiable 12.12%

node tools/lore/lor04-validate.mjs                  exit 1
  M1  9.1% §4 held     M2  5.93%   M3  2.37%   M6  14   M7  0 reused,  0 slugs
  generated  282 people, 186 Argonian: descriptive 10.2%, violations  1.85%, unclassifiable  0.00%
  hand        77 people,  44 Argonian: descriptive  4.5%, violations 22.73%, unclassifiable 12.12%
```

The hand-authored row is byte-identical across both arms. That is the proof no authored name was
touched.

Renames counted directly out of git: **521 of 692 named people renamed**, **0 people moved between
`pop-*.json` and an authored file**. 22 of the 282 in the AFTER generated arm are
`game/data/npcs/pop-trades.json`, a neighbour's file that arrived at `34d1387` and never went
through `namegen.mjs` — two of its names, `Heem-La` and `Okur`, are attested Bethesda/ZOS Argonians.

## F. The blind culture-attribution pack, RI-LOR04 §6

`node tools/lore/critic-w1-23-r4-blind.mjs` — pack drawn at `6803a05`. Twenty-one names, three
cultures. Khajiit excluded on purpose: §5 makes it the only culture permitted an apostrophe, so all
six on the roster are answerable from one character. Two consecutive runs at one commit are
byte-identical; the roster is not stable, so the pack is written out in the verdict §5.

**21/21 = 100%.** 18/18 excluding three names contaminated earlier in the session. 15/15 over the
non-hyphenated subset, where the hyphen cannot help.

## G. Reproduced, unchanged, from round 3's own instruments

```
node tools/lore/critic-w1-23-r3-reach.mjs --self-test   14/14 PASS
node tools/lore/critic-w1-23-r3-reach.mjs               163 texts, 163 reachable
                                                        19 mutual pairs: BOTH 19, ONE 0, NEITHER 0
                                                        28 disputed facts: 15 move, 13 move NOTHING
                                                        control (undisputed CF-001): 0 of 172,692 changed
node tools/lore/place-library.mjs --self-test           7/7 PASS
node tools/lore/place-library.mjs --check               exit 0
node tools/lore/mk-short-measures.mjs                   shortfall 15, unfiled 0, T4 61 against 16
node tools/boot-check.mjs --entry <git archive HEAD>    exit 0 — HEAD boots
```

Pair split re-derived from the shipped interior records, independently of `place-library`'s own
bookkeeping: **19/19 both placed, 3 same-room (all `soulrest-court-steps`, all present at
`e97347f`, an ancestor of every r4 commit), 16 in different rooms, 13 in different settlements.**

Corpus recount: **163 texts, 112,884 words**, median 547, p90 1,453, 21 `wrong_on_purpose`, 0
unfiled, Argonian-authored 52 (≥14), skill-book 63 (≥26), multi-volume series 5 (≥3),
quest-mechanism share 27.6%.

Attested `x`-density re-derived over the full mined corpus (`tools/uesp/mine-argonian-names.mjs`):
**48 of 324 Jel-shaped names carry `x` = 14.8%**, long vowel 37.7%. The shipped roster is at 42%,
which clears RI-LOR04 comparison-method §5's ≥40% floor and diverges from §4's own table by nearly
three times.
