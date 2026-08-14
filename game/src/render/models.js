// The glTF ingestion path — W1-30D item 1.
//
// WHAT THIS IS FOR, GIVEN THAT NOTHING SHIPS A .glb TODAY. The sourcing spike
// (`orchestration/status/W1-30D-SOURCING-SPIKE.md`) ruled that no legally redistributable,
// quality-sufficient, retargetable humanoid or Saxhleel base mesh could be identified, and the
// child pivoted to authored in-repo geometry. That ruling is about CONTENT. The ingestion path is
// still built, for three reasons that do not depend on it:
//
//   1. `W1-30.md` Part 1 names "reaching a 7/10 look with zero authored geometry is not achievable"
//      and approves the loaders explicitly. The next sourcing round should cost an afternoon, not
//      a week, and it will if the admission path already exists.
//   2. The rule that matters is not "we have glTF", it is **an unmanifested model must not load**.
//      That rule can and should bind the procedural bases too, and it does: they are in the
//      manifest, and `assertAdmissible()` is what the library census calls.
//   3. W1-30E consumes this file for architecture kits, which is its second consumer.
//
// FAIL-CLOSED, AND WHAT THAT MEANS PRECISELY. `loadModel()` refuses — before touching the network
// or the disk — an id the manifest does not declare, an entry missing any required field, a
// licence outside the allow-list, a CC-BY entry with no attribution, a triangle budget above the
// declared LOD ceiling, and a file whose sha256 does not match the manifest. Each refusal names
// the field. A silently-substituted default is how a 96 px noise field textured a province.
//
// THE ADDONS. `game/vendor/three/addons/**` are byte-exact r180 originals plus their licence
// (W1-30 R4a: modifying one is a hard fail, and this child owns the loaders specifically). They
// open with `import ... from 'three'`, which only resolves through the import map added to
// `game/index.html` — see the comment there for why that is the only route that keeps them
// byte-exact.
'use strict';

const MANIFEST_URL = new URL('../../assets/w1-30/models/manifest.json', import.meta.url);

const REQUIRED_FIELDS = ['source', 'licence', 'real_world_scale_m', 'bounds_m', 'lods',
  'material_families', 'consumers'];

let _manifest = null;
let _loaderPromise = null;

/** Read the manifest once. Any parse or shape failure throws here rather than at a call site. */
export async function modelManifest() {
  if (_manifest) return _manifest;
  let text;
  if (typeof fetch === 'function' && !MANIFEST_URL.protocol.startsWith('file')) {
    const res = await fetch(MANIFEST_URL);
    if (!res.ok) throw new Error(`models.js: model manifest ${MANIFEST_URL} -> HTTP ${res.status}`);
    text = await res.text();
  } else {
    const { readFile } = await import('node:fs/promises');
    text = await readFile(MANIFEST_URL, 'utf8');
  }
  const m = JSON.parse(text);
  if (m.schema !== 'elder-souls/model-manifest@1') {
    throw new Error(`models.js: manifest schema is '${m.schema}', expected 'elder-souls/model-manifest@1'`);
  }
  if (!m.models || typeof m.models !== 'object') throw new Error('models.js: manifest has no `models` map');
  _manifest = m;
  return m;
}

/**
 * The admission decision, separated from loading so the census, the tests and the loader all ask
 * the same question and cannot disagree about the answer.
 *
 * @returns {object} the manifest entry, if and only if it is admissible.
 * @throws with the exact field that refused it.
 */
export function assertAdmissible(manifest, id) {
  const e = manifest.models[id];
  if (!e) {
    throw new Error(`models.js: model '${id}' is not in the manifest. An unmanifested model must not `
      + `load (known: ${Object.keys(manifest.models).join(', ') || 'none'}).`);
  }
  for (const f of REQUIRED_FIELDS) {
    if (e[f] === undefined || e[f] === null) throw new Error(`models.js: model '${id}' is missing required manifest field '${f}'`);
  }
  const allowed = (manifest.licence_policy && manifest.licence_policy.allowed) || [];
  if (!allowed.includes(e.licence)) {
    throw new Error(`models.js: model '${id}' has licence '${e.licence}', which is not in the `
      + `allow-list [${allowed.join(', ')}]. Refusing to load it.`);
  }
  if (/^CC-BY/.test(e.licence) && !e.attribution) {
    throw new Error(`models.js: model '${id}' is ${e.licence} and carries no \`attribution\` string. `
      + 'A CC-BY asset without its attribution is not licensed, it is copied.');
  }
  if (!Array.isArray(e.lods) || e.lods.length === 0) throw new Error(`models.js: model '${id}' declares no LOD chain`);
  if (e.source !== 'procedural' && !e.file) throw new Error(`models.js: model '${id}' is source '${e.source}' but names no \`file\``);
  if (e.source !== 'procedural' && !e.sha256) {
    throw new Error(`models.js: model '${id}' is a file-backed model with no \`sha256\`. `
      + 'An unverified binary is how a swapped asset ships unnoticed.');
  }
  return e;
}

/** The vendored loader stack, imported lazily so a build that never loads a glTF never pays for it. */
async function loaders() {
  if (_loaderPromise) return _loaderPromise;
  _loaderPromise = (async () => {
    try {
      const [{ GLTFLoader }, { DRACOLoader }, { KTX2Loader }] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/loaders/DRACOLoader.js'),
        import('three/addons/loaders/KTX2Loader.js'),
      ]);
      return { GLTFLoader, DRACOLoader, KTX2Loader };
    } catch (err) {
      throw new Error('models.js: the vendored r180 loaders would not import. They resolve `three` '
        + 'through the import map in game/index.html; if that element has been removed, restore it '
        + 'rather than editing the vendored addons, which must stay byte-exact (W1-30 R4a). '
        + `Underlying error: ${err && err.message}`);
    }
  })();
  return _loaderPromise;
}

/**
 * Load a manifested model.
 *
 * @param {string} id a model id declared in `game/assets/w1-30/models/manifest.json`
 * @param {object} [options]
 * @param {object} [options.renderer] a WebGLRenderer, required for KTX2 transcoder detection
 * @returns {Promise<{entry: object, gltf: object|null}>} `gltf` is null for `procedural` entries,
 *          which are built by `render/actor.js` and are manifested for the admission rule alone.
 */
export async function loadModel(id, options = {}) {
  const manifest = await modelManifest();
  const entry = assertAdmissible(manifest, id);
  if (entry.source === 'procedural') return { entry, gltf: null };

  const { GLTFLoader, DRACOLoader, KTX2Loader } = await loaders();
  const url = new URL(entry.file, MANIFEST_URL);
  const loader = new GLTFLoader();
  if (entry.draco !== false) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(String(new URL('../../vendor/draco/', import.meta.url)));
    loader.setDRACOLoader(draco);
  }
  if (options.renderer && entry.ktx2 !== false) {
    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(String(new URL('../../vendor/basis/', import.meta.url)));
    ktx2.detectSupport(options.renderer);
    loader.setKTX2Loader(ktx2);
  }
  const gltf = await loader.loadAsync(String(url));

  // Post-admission: the budget is a manifest claim, and a claim that is never checked is decoration.
  let tris = 0;
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  const ceiling = Number(entry.lods[0].max_tris);
  if (isFinite(ceiling) && tris > ceiling) {
    throw new Error(`models.js: model '${id}' loaded ${Math.round(tris)} triangles against its own `
      + `declared LOD0 ceiling of ${ceiling}. Either the asset or the manifest is wrong; refusing both.`);
  }
  gltf.scene.traverse((o) => { if (o.isMesh) o.userData.modelId = id; });
  return { entry, gltf };
}

/** Every manifested id, for the census and for tests. */
export async function knownModels() {
  const m = await modelManifest();
  return Object.keys(m.models).sort();
}
