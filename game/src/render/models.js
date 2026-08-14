// W1-30S seam pass — new, empty.
//
// The glTF ingestion seam for W1-30D (characters/creatures) and W1-30E (architecture). Nothing
// in the shipping game loads a glTF file today (`grep -rn "GLTFLoader|\.glb|\.gltf" game/src`
// returns nothing — see W1-30.md Part 1, item 7), so this file has no existing behaviour to
// preserve; it exists so a caller can be written against a real signature ahead of the loader
// landing. `loadModel()` throws until W1-30D implements it. Future owner: W1-30D.
'use strict';

/**
 * @param {string} id a model id from the future glTF asset manifest
 * @param {object} [options]
 * @returns {Promise<never>}
 */
export async function loadModel(id, options = {}) {
  throw new Error(`render/models.js: loadModel('${id}') is not-yet-implemented`);
}
