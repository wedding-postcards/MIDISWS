import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const label=process.argv[2]||'current',seconds=Number(process.argv[3]||65);
const dir=resolve('qa/continuous-overflow');await mkdir(dir,{recursive:true});
const source=await readFile('src/abundance-physics.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const engine=resolve(dir,`engine-${label}.mjs`);await writeFile(engine,code);
const {AbundancePhysics}=await import(pathToFileURL(engine).href);
await AbundancePhysics.initialize();
const physics=new AbundancePhysics(JSON.parse(await readFile('src/physics/abundance-seed.json','utf8')));
physics.warmup(6);
const samples=[];let lastExits=0,lastBorn=0,maxInside=0,maxHeight=0,stalled=0,maxStall=0;
const start=performance.now();
for(let frame=0;frame<seconds*45;frame++){
  const before=physics.stats.rimExits;
  physics.update(1/45,true);
  maxInside=Math.max(maxInside,physics.stats.inside);maxHeight=Math.max(maxHeight,physics.stats.heapTop);
  stalled=physics.stats.rimExits===before?stalled+1:0;maxStall=Math.max(stalled,maxStall);
  if((frame+1)%225===0){
    const sample={seconds:(frame+1)/45,exits:physics.stats.rimExits-lastExits,births:physics.stats.born-lastBorn,...physics.stats};
    samples.push(sample);console.log(JSON.stringify(sample));lastExits=physics.stats.rimExits;lastBorn=physics.stats.born;
  }
}
const result={label,seconds,wallSeconds:(performance.now()-start)/1000,maxInside,maxHeight,maxStallSeconds:maxStall/45,samples};
await writeFile(resolve(dir,`${label}.json`),JSON.stringify(result,null,2));
physics.world.free();console.log('Completed',JSON.stringify({label,maxInside,maxHeight,maxStallSeconds:result.maxStallSeconds,wallSeconds:result.wallSeconds}));
