import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('qa/physical-pile',{recursive:true});
const code=ts.transpileModule(await readFile('src/abundance-physics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
await writeFile('qa/physical-pile/engine.mjs',code);
const {AbundancePhysics}=await import('../qa/physical-pile/engine.mjs?'+Date.now());
await AbundancePhysics.initialize();const seed=JSON.parse(await readFile('src/physics/abundance-seed.json','utf8'));const p=new AbundancePhysics(seed);console.log('initial',p.pieces.length);
const started=performance.now();p.warmup(12);console.log('settle ms',performance.now()-started);
await writeFile('qa/physical-pile/settled.json',JSON.stringify(Array.from(p.snapshot())));
let sum=0,max=0;
for(let i=0;i<1080;i++){p.update(1/60,true);sum+=p.stats.physicsMs;max=Math.max(max,p.stats.physicsMs);if(i%180===0)console.log('frame',i,JSON.stringify(p.stats));}
console.log('physics avg/max ms',sum/1080,max);await writeFile('qa/physical-pile/probe.json',JSON.stringify({stats:p.stats,averageMs:sum/1080,maxMs:max,data:Array.from(p.snapshot())}));
await mkdir('src/physics',{recursive:true});await writeFile('src/physics/abundance-seed.json',JSON.stringify(p.seed()));
