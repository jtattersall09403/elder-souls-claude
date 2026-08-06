import { readFileSync, writeFileSync } from 'node:fs';
import { WorldField } from '/home/user/elder-souls-claude/game/src/world/field.js';
globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const R='/home/user/elder-souls-claude/';
const rd=(p)=>JSON.parse(readFileSync(R+p,'utf8'));
const terrain=rd('game/data/world/terrain.json'), regions=rd('game/data/world/regions.json'), water=rd('game/data/world/water.json'), roads=rd('game/data/world/roads.json');
// two fields: one WITHOUT roads (natural terrain), one WITH
const nat = new WorldField(terrain, regions, water);
const wr  = new WorldField(terrain, regions, water); wr.setRoads(roads);

const TIDE={RISING:0.0,HIGH:0.25,FALLING:0.5,LOW:0.75};
const out={legs:[],worst_fill:null,worst_cut:null,worst_edge_slope:null, wall_points:[], causeway_over_water:[]};
let gFill=0,gCut=0,gSlope=0;
for(const leg of roads.legs){
  const p=leg.points; const hw=leg.half_width_m; const outer=hw*3.2;
  let maxFill=0,maxCut=0,maxSlope=0,fillAt=null,cutAt=null,slopeAt=null;
  let fillHist={ '0-1':0,'1-3':0,'3-6':0,'6-12':0,'12+':0 };
  let len=0, overWaterDeckM=0, deepestBeside=0, deepestBesideAt=null;
  for(let i=1;i<p.length;i++){
    const seg=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);
    const n=Math.max(1,Math.ceil(seg/3));
    for(let k=0;k<n;k++){
      const t=(k+0.5)/n;
      const x=p[i-1][0]+(p[i][0]-p[i-1][0])*t, z=p[i-1][1]+(p[i][1]-p[i-1][1])*t;
      const ds=seg/n; len+=ds;
      const hN=nat.heightAt(x,z), hR=wr.heightAt(x,z);
      const d=hR-hN;
      if(d>maxFill){maxFill=d;fillAt=[+x.toFixed(1),+z.toFixed(1)];}
      if(-d>maxCut){maxCut=-d;cutAt=[+x.toFixed(1),+z.toFixed(1)];}
      const a=Math.abs(d);
      if(a<1)fillHist['0-1']+=ds; else if(a<3)fillHist['1-3']+=ds; else if(a<6)fillHist['3-6']+=ds; else if(a<12)fillHist['6-12']+=ds; else fillHist['12+']+=ds;
      // lateral: perpendicular direction
      const dx=p[i][0]-p[i-1][0], dz=p[i][1]-p[i-1][1]; const L=Math.hypot(dx,dz)||1;
      const nx=-dz/L, nz=dx/L;
      // slope at the corridor shoulder (between hw and outer) — the "wall" test
      for(const side of [1,-1]){
        for(const off of [hw, (hw+outer)/2, outer, outer+3]){
          const sx=x+nx*off*side, sz=z+nz*off*side;
          const s=wr.slopeAt(sx,sz);
          if(s>maxSlope){maxSlope=s;slopeAt=[+sx.toFixed(1),+sz.toFixed(1),off,s];}
          if(s>40) out.wall_points.push({leg:leg.id,x:+sx.toFixed(1),z:+sz.toFixed(1),off,slope:+s.toFixed(1)});
        }
        // water just off the causeway at outer+6 m
        const wx=x+nx*(outer+6)*side, wz=z+nz*(outer+6)*side;
        for(const [ph,v] of Object.entries(TIDE)){
          const dep=wr.depthAt(wx,wz,v);
          if(dep>deepestBeside){deepestBeside=dep;deepestBesideAt=[+wx.toFixed(1),+wz.toFixed(1),ph];}
        }
      }
      // deck over water: road centre dry but flanks deep => causeway
      if(deepestBeside>1.4 && wr.depthAt(x,z,TIDE.LOW)<0.05) {}
    }
  }
  if(maxFill>gFill){gFill=maxFill;out.worst_fill={leg:leg.id,m:+maxFill.toFixed(2),at:fillAt};}
  if(maxCut>gCut){gCut=maxCut;out.worst_cut={leg:leg.id,m:+maxCut.toFixed(2),at:cutAt};}
  if(maxSlope>gSlope){gSlope=maxSlope;out.worst_edge_slope={leg:leg.id,deg:+maxSlope.toFixed(1),at:slopeAt};}
  out.legs.push({id:leg.id,len_m:+len.toFixed(1),max_fill_m:+maxFill.toFixed(2),max_cut_m:+maxCut.toFixed(2),
    max_shoulder_slope_deg:+maxSlope.toFixed(1), deepest_water_10m_off_deck_m:+deepestBeside.toFixed(2), at:deepestBesideAt,
    abs_offset_metres:Object.fromEntries(Object.entries(fillHist).map(([k,v])=>[k,+v.toFixed(0)]))});
}
out.wall_points_count=out.wall_points.length;
out.wall_points=out.wall_points.slice(0,20);
console.log(JSON.stringify(out,null,1));
writeFileSync(R+'corpus/90-verdicts/wave1/artifacts/W1-01-r2/critic-road-cutfill.json', JSON.stringify(out,null,1)+'\n');
