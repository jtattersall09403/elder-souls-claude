# The visual library — how reuse becomes structural

**Binding on every W1-30 child and on every visual piece after it.** Written 2026-08-14 under
`orchestration/OWNER-DIRECTIVES-2026-08-14.md` §3.

> *"if an agent finds an approach that produces a fantastic looking player character, can you reuse
> any of that approach for NPCs? If an agent creates some really nice looking building model, can
> that be tweaked and reused in different places rather than starting from scratch each time?"*

Asserting "reuse things" does not survive contact with twelve concurrent builders. This file is the
mechanism: four registries, three required report rows, and one census tool that fails the build.

---

## 1. The four registries

Everything a visual builder produces lands in exactly one of these. They live under
`game/src/render/lib/` (created by W1-30S) and each has one owning child.

| registry | file | owner | holds |
|---|---|---|---|
| **Materials** | `render/visual-foundation.js` | W1-30C | semantic families, texture sets, PBR response, wear/wetness masks, trim sheets |
| **Model kits** | `render/lib/kits.js` | W1-30E | modular geometry parts + assembly grammars: architecture, props, rocks, landmarks |
| **Lighting recipes** | `render/lib/lighting-recipes.js` | W1-30B | named light rigs: `noon-marsh`, `dusk-canopy`, `interior-hearth`, `cave-emissive`, `storm-flat` |
| **Rigs & clips** | `render/lib/rigs.js` | W1-30D | base meshes, one skeleton, morph/scale variant specs, animation clip sets, attachment sockets |

Two rules make them registries rather than folders:

- **Every entry has a stable string ID and a variant spec.** `kit('helstrom.house', {wear: 0.7,
  palette: 'salt', storeys: 2})` — not a second file called `helstrom-house-2.js`.
- **Nothing outside the registry may construct a governed visual thing.** A material not carrying
  `userData.visualFamily`, a building mesh not carrying `userData.kitId`, a character not carrying
  `userData.rigId` — each is a census failure.

## 2. The variant mechanism — "tweak and reuse", precisely

A variant spec is a plain object interpreted by the registry, never a copy of the definition. Each
registry declares its variant axes and the census rejects anything outside them.

| registry | variant axes |
|---|---|
| materials | palette swatch, wetness 0–1, wear 0–1, tiling scale, trim slot, emissive gain |
| kits | grammar rule set, storey count, palette, wear, footprint, trim selection, asymmetry seed |
| lighting recipes | time of day, weather, region tint, interior/exterior, intensity scalar |
| rigs | body morph set, scale triple, material variant, equipment socket contents, clip set |

The test a builder applies to itself: *if I want a second one of these, am I writing a spec or writing
a definition?* A spec is reuse. A definition needs the two-consumer rule below to justify it.

## 3. The three required report rows

Every visual builder report and every visual critic verdict carries these. A report missing them is
incomplete and the critic returns it.

**CONSUMED** — library IDs used, by registry. A child that hand-built something an existing entry
provides fails, and the critic's check is to name the entry it should have used.

**PUBLISHED** — new library entries added, each with:
- its ID and registry,
- **its two distinct consumers** — two different call sites, in different contexts, that use it. One
  consumer means the entry is not yet library material; it is local code. Either find the second
  consumer or file a written exemption naming why the thing is genuinely singular (a unique landmark,
  a named boss). Exemptions are listed in the verdict and counted; a child with more than three is
  not reusing, it is decorating.

**VARIANTS** — for each published entry, the variant specs already in use. An entry published with no
variants in use is a claim that nobody will ever need it slightly different, which is almost never
true and should be challenged.

## 4. The census tool, which is what actually enforces this

`tools/visual/library-census.mjs` — built by W1-30V, run by every child's cheap gate before any
browser work. It boots the game headless, walks the live scene graph, and reports:

| check | fails when |
|---|---|
| `bypass` | a mesh's material lacks `userData.visualFamily`, or a governed building mesh lacks `userData.kitId`, or a character lacks `userData.rigId` |
| `orphan` | a registry entry has fewer than 2 consumers and no recorded exemption |
| `duplicate` | two entries have the same structural hash (same geometry topology + same material params within tolerance) — i.e. somebody copied instead of varying |
| `unknown` | a variant spec uses an axis the registry does not declare |
| `regression` | the bypass count is higher than at the previous stamped commit |

`bypass` and `regression` are **hard fails**. `orphan` and `duplicate` are reported and must be
answered in the verdict. The tool prints a one-line summary so it can sit in a pre-commit gate:

```
library-census: 0 bypass, 3 orphan (2 exempt), 0 duplicate, 0 unknown — PASS
```

Its own red control: insert a `new THREE.MeshStandardMaterial` onto a world surface, on a copy, and
confirm `bypass` goes to 1 and the tool exits non-zero. A census that cannot go red has not been
built.

## 5. The two worked examples the owner asked about

### A good player character becomes good NPCs

W1-30D builds **one** base Saxhleel mesh and **one** base humanoid mesh, both on **one** skeleton
(`rigs.js` entry `base.saxhleel`, `base.humanoid`, skeleton `es.humanoid.v1`). Every other character
in the game is:

```js
rig('base.saxhleel', {
  morph: {snoutLength: 1.2, crest: 'frilled', build: 'lean'},
  scale: [0.94, 1.06, 1.0],
  material: {family: 'skin', palette: 'deep-marsh-olive', wear: 0.3},
  sockets: {back: kit('prop.reed-pack'), hand_r: kit('weapon.hooked-spear')},
  clips: 'clipset.civilian',
});
```

So the lighting, skin shading, silhouette work, IK and secondary motion that made the player look
good are **the same code path** for every NPC, automatically. D's acceptance counts distinct
characters produced from the two bases; the census fails if any character in the shipped world
carries a mesh that is neither a base nor a variant of one.

The corollary that matters: **improving the base improves everybody at once**, which is the whole
point. A critic finding "the skin reads as plastic at dusk" is one fix, not forty.

### A good building becomes eight settlements

W1-30E builds a kit of parts — `wall`, `corner`, `roof.hip`, `roof.reed`, `door`, `window.shutter`,
`stair`, `trim.course`, `awning`, `sign`, `pier`, `buttress` — and a grammar per settlement that
assembles them. `world-art.js` already names those grammars: Helstrom is `shell-pier-market` on
`walking-root-piles`, Thorn is `spiral-palisade` on `needle-thorn-brace`. Today those are strings;
E's job is to make them assembly rules over shared parts.

A Helstrom house and a Thorn house are then the same parts, different grammar, different palette,
different wear — which is exactly how Morrowind's Vvardenfell reads as one world with six distinct
cultures. E's acceptance: **parts count small, building count large** (target ≥ 40 distinct buildings
from ≤ 25 parts), no settlement with a bespoke building outside the kit without a named exemption,
and a paired-settlement gate where fresh judges must correctly attribute street shots to settlements
above chance.

## 6. What later pieces inherit

W1-21 (UI), W1-28 and every Wave-2 piece consume these registries and publish back into them under
the same three rows. The registries are not a W1-30 artefact; they are how this project builds
anything visual from here. A future piece that hand-rolls a material has broken the rule that made
the previous forty hours of work compound.
