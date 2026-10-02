import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Bake the approved simulation offline. Save each individual position and
// quaternion; browser startup never constructs a new stack or waits to settle.
const dir=resolve('qa/approved-startup');await mkdir(dir,{recursive:true});
const original=JSON.parse(await readFile('src/physics/abundance-seed.json','utf8'));
const source=await readFile('src/abundance-physics.ts','utf8');
const engine=resolve(dir,'approved-engine.mjs');
await writeFile(engine,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {AbundancePhysics}=await import(pathToFileURL(engine).href);
await AbundancePhysics.initialize();const physics=new AbundancePhysics(original);physics.warmup(6);
for(let frame=0;frame<105*45;frame++){
  physics.update(1/45,true);
  if((frame+1)%675===0)console.log(`${(frame+1)/45}s: ${physics.stats.inside} inside, ${physics.stats.rimExits} exits`);
}
const seed=physics.seed().map(row=>[...row.slice(0,7),0,0,0,0,0,0]);
const inspect=rows=>({count:rows.length,top:Math.max(...rows.map(r=>r[1])),
  visible:rows.filter(r=>r[1]>.16).length,
  tilted:rows.filter(r=>r[1]>.16&&Math.abs(1-2*(r[3]**2+r[5]**2))<.8).length});
await writeFile('src/physics/abundance-natural-v1.json',JSON.stringify(seed));
await writeFile(resolve(dir,'metadata.json'),JSON.stringify({simulationSeconds:105,
  source:'approved V7 simulation',before:inspect(original),after:inspect(seed),
  notes:'Natural settled arrangement inspired by the user screenshot, not extracted from screenshot pixels. All positions and orientations are retained; initial velocities are zero.'},null,2));
physics.world.free();console.log(JSON.stringify(inspect(seed)));
