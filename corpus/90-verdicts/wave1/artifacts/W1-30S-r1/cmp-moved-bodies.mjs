import { execSync } from 'node:child_process';
import fs from 'node:fs';
const old = (p,rev)=>execSync(`git show ${rev}:${p}`,{maxBuffer:1e9}).toString();
const norm = s => s.replace(/\s+/g,'');
// ---- WATER ----
const vfOld = old('game/src/render/visual-foundation.js','3b43ec6c^');
const s = vfOld.indexOf("if(family==='water'){");
const e = vfOld.indexOf("animatedWaterMaterials.add(mat);", s);
const oldWater = vfOld.slice(vfOld.indexOf('\n',s)+1, e+ "animatedWaterMaterials.add(mat);".length);
const wNew = execSync('git show 91fbb20e:game/src/render/water.js',{maxBuffer:1e9}).toString();
const s2 = wNew.indexOf('export function installWaterShader(mat) {');
const e2 = wNew.indexOf('animatedWaterMaterials.add(mat);', s2);
const newWater = wNew.slice(wNew.indexOf('\n',s2)+1, e2+'animatedWaterMaterials.add(mat);'.length);
console.log('WATER shader body token-identical:', norm(oldWater)===norm(newWater));
if(norm(oldWater)!==norm(newWater)){
  const a=norm(oldWater), b=norm(newWater);
  let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++;
  console.log('  first divergence at char',i);
  console.log('  OLD:', JSON.stringify(a.slice(Math.max(0,i-80), i+120)));
  console.log('  NEW:', JSON.stringify(b.slice(Math.max(0,i-80), i+120)));
}
// updateVisualFoundationFrame + bindWaterReflection
for (const fn of ['export function updateVisualFoundationFrame','export function bindWaterReflection']) {
  const cut = (src)=>{const i=src.indexOf(fn); const j=src.indexOf('\n}\n', i); return src.slice(i, j+2);};
  const o = cut(vfOld), n = cut(wNew);
  console.log(`${fn.split(' ').pop()} token-identical:`, norm(o)===norm(n));
  if(norm(o)!==norm(n)){console.log('  OLD:',JSON.stringify(norm(o)));console.log('  NEW:',JSON.stringify(norm(n)));}
}
// ---- COMPOSITOR ----
const rOld = old('game/src/render/renderer.js','0cdfa698');
const cs = rOld.indexOf('  _buildCompositor(w,h) {');
const ce = rOld.indexOf('this.compositeMaterial));', cs);
let oldC = rOld.slice(rOld.indexOf('\n',cs)+1, ce+'this.compositeMaterial));'.length);
const cNew = execSync('git show 91fbb20e:game/src/render/post/composite.js',{maxBuffer:1e9}).toString();
const ns = cNew.indexOf('export function buildCompositor(w, h) {');
const ne = cNew.indexOf('compositeMaterial));', ns);
let newC = cNew.slice(cNew.indexOf('\n',ns)+1, ne+'compositeMaterial));'.length);
// normalise the only permitted rewrite: `this.X` -> `X` (assignment target -> const local)
const rewrite = t => norm(t).replace(/this\./g,'').replace(/const/g,'').replace(/^/,'');
console.log('COMPOSITOR body token-identical after this.->local rewrite:', rewrite(oldC)===rewrite(newC));
if(rewrite(oldC)!==rewrite(newC)){
  const a=rewrite(oldC), b=rewrite(newC);
  let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++;
  console.log('  first divergence at char',i,'of',a.length,'/',b.length);
  console.log('  OLD:', JSON.stringify(a.slice(Math.max(0,i-100), i+150)));
  console.log('  NEW:', JSON.stringify(b.slice(Math.max(0,i-100), i+150)));
}
