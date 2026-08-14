import { execSync } from 'node:child_process';
import fs from 'node:fs';
const WT='/tmp/claude-0/-home-user-elder-souls-claude/3c195166-6f14-54d0-bf0f-867f7b39d84b/scratchpad/wt-before';
const norm = s => s.replace(/\s+/g,'');
const git = (rev,p)=>execSync(`git show ${rev}:${p}`,{maxBuffer:1e9}).toString();
const slice=(s,a,b)=>{const i=s.indexOf(a); const j=s.indexOf(b,i); return s.slice(i,j+b.length);};
let fail=0;
// compositor: reverted vs true pre-seam (0cdfa698)
const trueR = git('0cdfa698','game/src/render/renderer.js');
const revR  = fs.readFileSync(WT+'/game/src/render/renderer.js','utf8');
const A = slice(trueR,'  _buildCompositor(w,h) {','this.compositeMaterial));');
const B = slice(revR ,'  _buildCompositor(w,h) {','this.compositeMaterial));');
console.log('reverted _buildCompositor == pre-seam original:', norm(A)===norm(B));
if(norm(A)!==norm(B)){fail++;let i=0;const a=norm(A),b=norm(B);while(a[i]===b[i])i++;console.log(' OLD:',JSON.stringify(a.slice(i-60,i+120)));console.log(' NEW:',JSON.stringify(b.slice(i-60,i+120)));}
// water: reverted vs true pre-seam (3b43ec6c^)
const trueV = git('3b43ec6c^','game/src/render/visual-foundation.js');
const revV  = fs.readFileSync(WT+'/game/src/render/visual-foundation.js','utf8');
for(const [a,b,name] of [["if(family==='water'){",'animatedWaterMaterials.add(mat);','water block'],
                         ['export function updateVisualFoundationFrame','\n}\n','updateVisualFoundationFrame'],
                         ['export function bindWaterReflection','\n}\n','bindWaterReflection'],
                         ['const animatedWaterMaterials=new Set();','new THREE.Matrix4();','module state']]){
  const x=slice(trueV,a,b), y=slice(revV,a,b);
  const eq = norm(x)===norm(y);
  console.log(`reverted ${name} == pre-seam original:`, eq);
  if(!eq){fail++;console.log('  OLD:',JSON.stringify(norm(x).slice(0,300)));console.log('  NEW:',JSON.stringify(norm(y).slice(0,300)));}
}
// night factor + prepass call restored
console.log('reverted night-factor line restored:', revR.includes('this.province.setNightFactor(1 - Math.max(0, Math.min(1, elev * 1.6 + 0.28)) * 1.6);'));
console.log('reverted inline water-reflection call restored:', revR.includes('    this._renderWaterReflection(sim.frame);'));
console.log('no seam symbols left in before-tree:', !revR.includes('registerComposite')&&!revR.includes('registerPrePass')&&!revR.includes('setLightingFrame'));
const revS = fs.readFileSync(WT+'/game/src/render/sky.js','utf8');
console.log('sky.js lastFrame removed:', !revS.includes('lastFrame')&&!revS.includes('buildLightingFrame'));
console.log(fail? 'REVERT NOT FAITHFUL':'REVERT FAITHFUL');
