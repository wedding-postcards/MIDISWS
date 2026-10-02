import ts from 'typescript';import {readFile,writeFile} from 'node:fs/promises';
const code=ts.transpileModule(await readFile('src/abundance-physics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;await writeFile('qa/physical-pile/engine.mjs',code);
const {AbundancePhysics}=await import('../qa/physical-pile/engine.mjs?'+Date.now());await AbundancePhysics.initialize();
const p=new AbundancePhysics(JSON.parse(await readFile('src/physics/abundance-seed.json','utf8')));
for(let i=0;i<150;i++)p.update(1/45,true);
const describe=()=>p.pieces.filter(p=>p.state===2).slice(0,2).map(p=>({position:p.body.translation(),velocity:p.body.linvel(),type:p.body.bodyType(),enabled:p.body.isEnabled(),sleep:p.body.isSleeping()}));
console.log('before',p.stats.airborne,describe());
for(let i=0;i<240;i++){p.update(1/45,false);if(i%45===0)console.log('after',i,p.stats.airborne,describe());}
