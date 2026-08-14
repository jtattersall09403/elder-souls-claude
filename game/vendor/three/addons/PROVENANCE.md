# Vendored three.js r180 addons — provenance

**Byte-exact originals. Do not edit any file in this directory.** W1-30 amendment R4a makes a
modification to a vendored addon a hard fail: a changed addon is a fork, and a fork of a loader is
the kind of thing that works for a year and then silently disagrees with the core it was written
for. If one of these needs to behave differently, wrap it — do not touch it.

**Licence:** MIT, the same licence as the core, in `../LICENSE`. These files come from the same
release of the same repository.

**Version:** three.js **r180** (`0.180.0`), matching `../VERSION`.
**Fetched:** 2026-08-14, from `https://unpkg.com/three@0.180.0/examples/jsm/…`.
**Vendored by:** W1-30D, which owns the loaders (R4a: A owns the post-processing addons, D owns the
loaders, C may vendor `KTX2Loader.js` alone if it needs it first).

| file | upstream path |
|---|---|
| `loaders/GLTFLoader.js` | `examples/jsm/loaders/GLTFLoader.js` |
| `loaders/DRACOLoader.js` | `examples/jsm/loaders/DRACOLoader.js` |
| `loaders/KTX2Loader.js` | `examples/jsm/loaders/KTX2Loader.js` |
| `libs/ktx-parse.module.js` | `examples/jsm/libs/ktx-parse.module.js` |
| `libs/zstddec.module.js` | `examples/jsm/libs/zstddec.module.js` |
| `math/ColorSpaces.js` | `examples/jsm/math/ColorSpaces.js` |
| `utils/WorkerPool.js` | `examples/jsm/utils/WorkerPool.js` |
| `utils/BufferGeometryUtils.js` | `examples/jsm/utils/BufferGeometryUtils.js` |

The last five are transitive dependencies of the three loaders, not choices. They were found by
grepping the loaders' own relative imports rather than guessed, so the set is closed: nothing here
imports a file that is not here, and nothing here imports anything outside this directory except the
bare specifier `three`.

**That bare specifier is why `game/index.html` carries an import map.** Every official addon opens
`import { ... } from 'three'`, which no bundler-free page can resolve without one. The alternative —
rewriting that line to a relative path — is precisely the fork R4a forbids. The map is additive and
inert for existing code: `grep -rn "from 'three'" game/src` returns nothing.

**Not vendored, and needed before a real glTF loads:** the Draco decoder (`vendor/draco/`) and the
Basis transcoder (`vendor/basis/`) WASM blobs. `models.js` points at those paths; nothing in the
repository loads a compressed asset yet, so they have deliberately not been added — an unused 2 MB
of WebAssembly on a disk at 68% is a cost with no return until there is an asset that needs it.
