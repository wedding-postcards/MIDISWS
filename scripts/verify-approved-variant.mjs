import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve('qa/review-10');await mkdir(dir,{recursive:true});
const seed=JSON.parse(await readFile('src/physics/abundance-surface-v4.json','utf8'));
const worlds=[];
for(const [name,path] of [['approved','assets/versions/review-09-2026-10-02/src/abundance-physics.ts'],['default','src/abundance-physics.ts']]){
  const file=resolve(dir,`${name}-engine.mjs`);
  await writeFile(file,ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  const {AbundancePhysics}=await import(pathToFileURL(file).href);await AbundancePhysics.initialize();
  const p=new AbundancePhysics(seed,true);p.warmup(6);worlds.push(p);
}
for(let i=0;i<180;i++){
  for(const p of worlds)p.update(1/45,true);
  assert.deepEqual(worlds[0].snapshot(),worlds[1].snapshot(),'The default URL must keep approved physics exactly');
}
const result={steps:180,simulatedSeconds:4,defaultMatchesApprovedExactly:true};
await writeFile(resolve(dir,'approved-regression.json'),JSON.stringify(result,null,2));
for(const p of worlds)p.world.free();console.log(JSON.stringify(result));
