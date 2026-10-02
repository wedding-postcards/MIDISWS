import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Quaternion,Euler} from 'three';

// This is an offline settle, never work performed on a visitor's computer.
// Keep the approved bed and individual scatter; lay exposed coins flatter.
const dir=resolve('qa/review-06');await mkdir(dir,{recursive:true});
const before=JSON.parse(await readFile('src/physics/abundance-natural-v1.json','utf8'));
const rows=structuredClone(before);let changed=0;
for(let i=0;i<rows.length;i++){
  const p=rows[i];if(p[1]<.23)continue;
  const q=new Quaternion().fromArray(p,3);
  const target=new Quaternion().setFromEuler(new Euler(.08+Math.sin(i*1.71)*.19,i*2.39996,-.12+Math.cos(i*.89)*.14,'YXZ'));
  q.slerp(target,.8).toArray(p,3);changed++;
}
const source=(await readFile('src/abundance-physics.ts','utf8')).replace('STEP=1/45, RATE=20','STEP=1/45, RATE=0');
const file=resolve(dir,'settle-engine.mjs');
await writeFile(file,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {AbundancePhysics}=await import(pathToFileURL(file).href);await AbundancePhysics.initialize();
const physics=new AbundancePhysics(rows);
for(let frame=0;frame<45*8;frame++)physics.update(1/45,true);
const after=physics.seed().map(p=>[...p.slice(0,7),0,0,0,0,0,0]);
// Prepare a few real surface coins at the tipping point around the whole rim.
// They belong to the saved heap; none appear in the air at the first frame.
const rim=[];
for(let sector=0;sector<24;sector++){
  const a=sector/24*Math.PI*2;
  const candidates=after.map((p,i)=>({p,i,r:Math.hypot(p[0],p[2]),angle:Math.atan2(p[2],p[0])}))
    .filter(c=>c.r>.77&&c.r<.93&&c.p[1]>.18&&!rim.includes(c.i))
    .map(c=>({...c,d:Math.abs(Math.atan2(Math.sin(c.angle-a),Math.cos(c.angle-a)))}))
    .filter(c=>c.d<.14).sort((a,b)=>b.r-a.r);
  if(!candidates.length)continue;
  const c=candidates[0],r=.92+(sector%3)*.005;
  c.p[0]*=r/c.r;c.p[2]*=r/c.r;rim.push(c.i);
}
const inspect=seed=>({count:seed.length,top:Math.max(...seed.map(p=>p[1])),upper:seed.filter(p=>p[1]>.23).length,
  flatUpper:seed.filter(p=>p[1]>.23&&Math.abs(1-2*(p[3]**2+p[5]**2))>.9).length,
  broadFaces:seed.filter(p=>p[1]>.16&&Math.abs(1-2*(p[3]**2+p[5]**2))>.85).length});
await writeFile('src/physics/abundance-sunlit-v2.json',JSON.stringify(after));
const metadata={changed,rimReady:rim.length,before:inspect(before),after:inspect(after),settleSeconds:8};
await writeFile(resolve(dir,'startup-metadata.json'),JSON.stringify(metadata,null,2));
physics.world.free();console.log(JSON.stringify(metadata));
