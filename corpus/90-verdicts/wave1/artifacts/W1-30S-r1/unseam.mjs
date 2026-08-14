#!/usr/bin/env node
/**
 * unseam.mjs — mechanically REVERT the W1-30S seam inside a throwaway worktree, so that a
 * before/after frame-hash comparison isolates the seam and nothing else.
 *
 * It reconstructs the "before" by inlining the moved bodies back FROM THE MOVED FILES
 * THEMSELVES, so no body is retyped and a transcription error cannot masquerade as a
 * behaviour change. Every anchor below is asserted; a missing anchor aborts.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: unseam.mjs <worktree>'); process.exit(2); }
const R = (p) => path.join(ROOT, p);
const read = (p) => fs.readFileSync(R(p), 'utf8');
const write = (p, s) => fs.writeFileSync(R(p), s);
let ok = true;
const must = (cond, msg) => { if (!cond) { console.error('ANCHOR MISS: ' + msg); ok = false; } };
const cut = (s, a, b, msg) => {
  const i = s.indexOf(a); must(i >= 0, msg + ' (start)');
  if (i < 0) return null;
  const j = s.indexOf(b, i); must(j >= 0, msg + ' (end)');
  if (j < 0) return null;
  return { i, j: j + b.length, text: s.slice(i, j + b.length) };
};
const rep = (s, from, to, msg) => { must(s.includes(from), msg); return s.split(from).join(to); };

// ---------------------------------------------------------------- 1. composite.js -> renderer.js
const comp = read('game/src/render/post/composite.js');
const compBody = cut(comp, '  // Preserve scene-linear HDR', 'compositeMaterial));', 'composite body');
// re-indent by 2 and restore `this.` receivers exactly as the pre-seam method had them
let inlineComp = compBody.text
  .replace(/^ {2}/gm, '  ')
  .replace(/const worldTarget=/, 'this.worldTarget=')
  .replace(/const compositeMaterial=/, 'this.compositeMaterial=')
  .replace(/const compositeScene=new THREE\.Scene\(\); const compositeCamera=/, 'this.compositeScene=new THREE.Scene(); this.compositeCamera=')
  .replace(/\bworldTarget\./g, 'this.worldTarget.')
  .replace(/value:worldTarget\./g, 'value:this.worldTarget.')
  .replace(/compositeScene\.add\(new THREE\.Mesh\(new THREE\.PlaneGeometry\(2,2\),compositeMaterial\)\)/,
           'this.compositeScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.compositeMaterial))')
  .replace(/this\.this\./g, 'this.');
inlineComp = '  _buildCompositor(w,h) {\n' + inlineComp + '\n  }\n';

// ---------------------------------------------------------------- 2. water.js -> visual-foundation.js
const wat = read('game/src/render/water.js');
const watBody = cut(wat, '  // A deterministic, presentation-only ripple field.', 'animatedWaterMaterials.add(mat);', 'water body');
const inlineWater = "  if(family==='water'){\n"
  + watBody.text.replace(/^ {2}/gm, '    ')
  + '\n  }\n';
const updFn = cut(wat, '/** Drive all live water shaders', '\n}\n', 'updateVisualFoundationFrame');
const bindFn = cut(wat, "/** Bind the renderer's true mirrored scene pass", '\n}\n', 'bindWaterReflection');
const waterState = 'const animatedWaterMaterials=new Set();\n'
  + 'let waterReflectionTexture=null,waterReflectionResolution=new THREE.Vector2(1,1),waterReflectionStrength=0,waterReflectionMatrix=new THREE.Matrix4();\n';

// ---------------------------------------------------------------- apply: visual-foundation.js
let vf = read('game/src/render/visual-foundation.js');
vf = rep(vf,
  "// W1-30S seam: the water surface shader lives in render/water.js (future owner: W1-30H).\n// worldMaterial() below still decides that the 'water' family gets it; only the shader body\n// and its live phase/reflection state moved.\nimport { installWaterShader } from './water.js';\n",
  '', 'vf: water import');
vf = rep(vf, 'const authoredCache=new Map();\n', 'const authoredCache=new Map();\n' + waterState, 'vf: water module state');
vf = rep(vf,
  "  // W1-30S seam: the animated ripple/reflection shader lives in render/water.js now (future\n  // owner: W1-30H). worldMaterial() still decides that 'water' gets it.\n  if(family==='water') installWaterShader(mat);\n",
  inlineWater, 'vf: installWaterShader call');
vf = rep(vf, '\nexport function visualFoundationCensus(root) {',
  '\n' + updFn.text + '\n' + bindFn.text + '\nexport function visualFoundationCensus(root) {', 'vf: re-add exports');
write('game/src/render/visual-foundation.js', vf);

// ---------------------------------------------------------------- apply: renderer.js
let rn = read('game/src/render/renderer.js');
rn = rep(rn,
  "import { visualFoundationCensus, VISUAL_FEATURES, FEATURE_CONSUMERS } from './visual-foundation.js';",
  "import { visualFoundationCensus, VISUAL_FEATURES, FEATURE_CONSUMERS, updateVisualFoundationFrame, bindWaterReflection } from './visual-foundation.js';",
  'renderer: import line');
const impBlock = cut(rn, '// W1-30S seam: the water surface shader\'s frame/reflection drivers moved to water.js',
  "import { buildCompositor } from './post/composite.js';\n", 'renderer: seam import block');
rn = rn.slice(0, impBlock.i) + rn.slice(impBlock.j);
const ctor = cut(rn, '    // W1-30S seam: renderer.registerPrePass(fn)',
  '    this.registerComposite(buildCompositor(canvas.width, canvas.height));\n', 'renderer: ctor seam');
rn = rn.slice(0, ctor.i) + '    this._buildCompositor(canvas.width,canvas.height);\n' + rn.slice(ctor.j);
const methods = cut(rn, '  /** W1-30S seam. A\'s composite module installs here',
  '  setLightingFrame(obj) {\n    this.lightingFrame = obj;\n    return obj;\n  }\n', 'renderer: seam methods');
rn = rn.slice(0, methods.i) + inlineComp + rn.slice(methods.j);
const pub = cut(rn, '    // W1-30S seam: publish the frame\'s lighting summary sky.js just computed.\n',
  '    this.setLightingFrame(this.sky.lastFrame);\n', 'renderer: setLightingFrame call');
rn = rn.slice(0, pub.i) + rn.slice(pub.j);
const nightC = cut(rn, '      //\n      // W1-30S: this used to recompute', 'instead of the arithmetic.\n', 'renderer: night comment');
rn = rn.slice(0, nightC.i) + rn.slice(nightC.j);
rn = rep(rn, '        this.province.setNightFactor(1 - this.lightingFrame.day * 1.6);',
  '        const elev = Math.sin(((sim.env.timeOfDay - 6) / 24) * Math.PI * 2);\n'
  + '        this.province.setNightFactor(1 - Math.max(0, Math.min(1, elev * 1.6 + 0.28)) * 1.6);',
  'renderer: night factor');
const pp = cut(rn, '    // W1-30S seam: registered prepasses run here', '    for (const pass of this._prePasses) pass(sim.frame);\n', 'renderer: prepass loop');
rn = rn.slice(0, pp.i) + '    this._renderWaterReflection(sim.frame);\n' + rn.slice(pp.j);
write('game/src/render/renderer.js', rn);

// ---------------------------------------------------------------- apply: sky.js
let sk = read('game/src/render/sky.js');
sk = rep(sk,
  "// W1-30S seam: renderer.js pushes this frame's lighting summary through\n// `renderer.setLightingFrame(obj)`. Building the object here reads values apply() already\n// computed for its own uniforms/lights; it does not change what those values are.\nimport { buildLightingFrame } from './lighting.js';\n",
  '', 'sky: import');
const lf = cut(sk, "    // W1-30S seam: publish this frame's lighting summary.", '    });\n', 'sky: lastFrame block');
sk = sk.slice(0, lf.i) + sk.slice(lf.j);
write('game/src/render/sky.js', sk);

// ---------------------------------------------------------------- remove the published seam files
for (const f of ['game/src/render/water.js', 'game/src/render/post/composite.js', 'game/src/render/lighting.js']) {
  fs.rmSync(R(f), { force: true });
}
if (!ok) { console.error('\nREVERT ABORTED — anchors missed; the before-tree is NOT trustworthy.'); process.exit(1); }
console.log('seam reverted in ' + ROOT);
