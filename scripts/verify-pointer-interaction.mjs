import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
// Historical review-05 sweep comparison. Current click/hold behavior is checked
// by verify-review-06.mjs and verify-grab-lifecycle.mjs.
const dir=resolve('qa/review-05-historical');await mkdir(dir,{recursive:true});
async function compile(name){
  const output=resolve(dir,`${name}.mjs`);
  await writeFile(output,ts.transpileModule(await readFile(`assets/versions/review-05-2026-10-02/src/${name}.ts`,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  return import(pathToFileURL(output).href);
}
const {sweptEllipseDistance:contact}=await compile('pointer-contact');
assert.ok(contact(-100,0,100,0,0,0,0,1,10,4)<=1,'Fast sweep must hit between events');
assert.ok(contact(-100,6,100,6,0,0,0,1,10,4)>1,'No force field outside visible edge');
assert.ok(contact(20,0,40,0,0,0,0,1,10,4)>1,'Distant movement must miss');
assert.ok(contact(0,-100,0,100,0,0,1,0,10,4)<=1,'Rotated edge-on coin must be hit');
const {AbundancePhysics:Current}=await compile('abundance-physics');
const {AbundancePhysics:Approved}=await import(pathToFileURL(resolve('qa/approved-startup/approved-engine.mjs')).href);
await Current.initialize();await Approved.initialize();
const seed=JSON.parse(await readFile('src/physics/abundance-natural-v1.json','utf8'));
const a=new Current(seed),b=new Current(seed);assert.deepEqual(a.snapshot(),b.snapshot(),'Startup transforms must repeat exactly');b.world.free();
a.warmup(6);
const targets=a.pieces.map((p,index)=>({p,index})).filter(({p})=>p.state===1&&p.body.translation().y>.23).sort((a,b)=>b.p.body.translation().y-a.p.body.translation().y).slice(0,32);
const beforePositions=targets.map(({p})=>({...p.body.translation()}));
a.interact(targets.map(({index})=>({index,state:1,x:3.2,y:.65,z:.4})));
assert.equal(a.stats.heapImpacts,32,'A broad sweep must move a handful');
const scoopTimings=[];
for(let i=0;i<45;i++){const time=performance.now();a.update(1/45,true);scoopTimings.push(performance.now()-time);}
const displaced=targets.filter(({p},i)=>{const v=p.fall?.position||p.body.translation(),b=beforePositions[i];return Math.hypot(v.x-b.x,v.y-b.y,v.z-b.z)>.12;}).length;
assert.ok(displaced>=24,'Surface must actually move, not just register pointer contacts');
const falling=a.pieces.findIndex(p=>p.state===2);assert.ok(falling>=0,'Scooped coins must leave the cup');
const oldX=a.pieces[falling].fall.velocity.x;
a.interact([{index:falling,state:2,x:-2,y:.5,z:0}]);
assert.ok(a.pieces[falling].fall.velocity.x<oldX-.5,'Falling coin must deflect immediately');
assert.ok([...a.snapshot()].every(Number.isFinite));
const interaction={contacts:a.stats.impacts,heapContacts:a.stats.heapImpacts,displaced,exits:a.stats.rimExits,meanStepMs:scoopTimings.reduce((x,y)=>x+y,0)/scoopTimings.length,maxStepMs:Math.max(...scoopTimings)};a.world.free();
function benchmark(Type){const p=new Type(seed);p.warmup(6);const timings=[];for(let i=0;i<180;i++){const t=performance.now();p.update(1/45,true);timings.push(performance.now()-t);}p.world.free();timings.sort((a,b)=>a-b);return{median:timings[90],p95:timings[171],mean:timings.reduce((a,b)=>a+b,0)/timings.length};}
const baseline=benchmark(Approved),current=benchmark(Current);
const result={geometryChecks:4,startupCount:seed.length,repeatableStartup:true,interaction,baselineMs:baseline,currentMs:current,notes:'Worker physics benchmark; browser rendering is measured separately. No active pointer during idle benchmark.'};
await writeFile(resolve(dir,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
