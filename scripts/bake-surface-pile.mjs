import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve('qa/review-08');await mkdir(dir,{recursive:true});
const original=JSON.parse(await readFile('src/physics/abundance-sunlit-v2.json','utf8'));
const visible=original.filter(p=>p[1]>=.155);
const source=(await readFile('src/abundance-physics.ts','utf8')).replace('STEP=1/45, RATE=20','STEP=1/45, RATE=0');
const engine=resolve(dir,'settle-engine.mjs');
await writeFile(engine,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {AbundancePhysics}=await import(pathToFileURL(engine).href);await AbundancePhysics.initialize();
const p=new AbundancePhysics(visible,true);
for(let frame=0;frame<360;frame++)p.update(1/45,true);
const seed=p.seed().map(row=>[...row.slice(0,7),0,0,0,0,0,0]);
// Keep the actual settled positions. Moving 24 coins out to r=.92–.93 made
// them all tip over together at startup; normal feed already supplies the rim.
await writeFile('src/physics/abundance-surface-v4.json',JSON.stringify(seed));
const metadata={original:original.length,removedHidden:original.length-visible.length,startCoins:seed.length,staticSupportColliders:1,artificialRimCoins:0,top:Math.max(...seed.map(p=>p[1])),flatUpper:seed.filter(p=>p[1]>.23&&Math.abs(1-2*(p[3]**2+p[5]**2))>.9).length};
await writeFile(resolve(dir,'startup-metadata.json'),JSON.stringify(metadata,null,2));p.world.free();console.log(JSON.stringify(metadata));
