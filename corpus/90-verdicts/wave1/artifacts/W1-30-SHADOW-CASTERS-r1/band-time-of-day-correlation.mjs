import fs from 'node:fs';
const {PNG}=await import('/home/user/elder-souls-claude/tools/node_modules/pngjs/lib/png.js');
const D='/home/user/elder-souls-claude/reports/runpod-gpu/runs/deck-w1-30-shadow-casters/artifacts/deck/w1-30-shadow-casters/frames/';
function lum(f){const p=PNG.sync.read(fs.readFileSync(D+f));const n=p.width*p.height;const y=new Float32Array(n);
 for(let i=0,j=0;i<p.data.length;i+=4,j++)y[j]=0.2126*p.data[i]+0.7152*p.data[i+1]+0.0722*p.data[i+2];
 return {y,w:p.width,h:p.height};}
function hp(o,x0,x1,y0,y1){const out=[];for(let y=y0;y<y1;y++){for(let x=x0;x<x1;x++){let s=0,c=0;for(let k=-4;k<=4;k++){const yy=y+k;if(yy<0||yy>=o.h)continue;s+=o.y[yy*o.w+x];c++;}out.push(o.y[y*o.w+x]-s/c);}}return out;}
function corr(a,b){const n=a.length;let ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;
 let sa=0,sb=0,sab=0;for(let i=0;i<n;i++){const u=a[i]-ma,v=b[i]-mb;sa+=u*u;sb+=v*v;sab+=u*v;}
 return sab/Math.sqrt(sa*sb);}
const times=['t0800','t1300','t1930'];
const imgs={};for(const t of times)imgs[t]=lum('vista-deep-marshes__'+t+'__clear.png');
const X0=560,X1=900,Y0=300,Y1=470;
const H={};for(const t of times)H[t]=hp(imgs[t],X0,X1,Y0,Y1);
console.log('crop',X0+'-'+X1,Y0+'-'+Y1,'px',H.t0800.length);
console.log('rho(t0800,t1300) =',corr(H.t0800,H.t1300).toFixed(3));
console.log('rho(t0800,t1930) =',corr(H.t0800,H.t1930).toFixed(3));
console.log('rho(t1300,t1930) =',corr(H.t1300,H.t1930).toFixed(3));
const other=lum('vista-blackwood__t1300__clear.png');
console.log('NEGATIVE CONTROL rho(deep t1300, blackwood t1300) =',corr(H.t1300,hp(other,X0,X1,Y0,Y1)).toFixed(3));
const rain=lum('vista-deep-marshes__t1300__rain.png');
console.log('rho(clear t1300, rain t1300) =',corr(H.t1300,hp(rain,X0,X1,Y0,Y1)).toFixed(3));
