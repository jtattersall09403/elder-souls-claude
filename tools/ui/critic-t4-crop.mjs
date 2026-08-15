import fs from 'node:fs';
import { PNG } from 'pngjs';
const [,, src, x, y, w, hh, scale, dst] = process.argv;
const p = PNG.sync.read(fs.readFileSync(src));
const S = Number(scale||1), X=Number(x), Y=Number(y), W=Number(w), H=Number(hh);
const o = new PNG({ width: W*S, height: H*S });
for (let j=0;j<H*S;j++) for (let i=0;i<W*S;i++){
  const si=((p.width*(Y+Math.floor(j/S)))+(X+Math.floor(i/S)))<<2, di=((o.width*j)+i)<<2;
  o.data[di]=p.data[si]; o.data[di+1]=p.data[si+1]; o.data[di+2]=p.data[si+2]; o.data[di+3]=255;
}
fs.writeFileSync(dst, PNG.sync.write(o)); console.log('wrote', dst, W*S+'x'+H*S);
