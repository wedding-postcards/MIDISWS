import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=resolve('qa/review-10');await mkdir(dir,{recursive:true});
const source=await readFile('src/abundance-physics.ts','utf8');
async function engine(name,code){
  const path=resolve(dir,`${name}.mjs`);
  await writeFile(path,ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  const {AbundancePhysics}=await import(pathToFileURL(path).href);await AbundancePhysics.initialize();return AbundancePhysics;
}
const Physics=await engine('trial-engine',source);
const Settler=await engine('settle-engine',source.replace('STEP=1/45, RATE=20','STEP=1/45, RATE=0'));
const initial=JSON.parse(await readFile('src/physics/abundance-surface-v4.json','utf8'));
function shape(p){
  const mature=p.pieces.filter(c=>c.state===1&&c.age>=1.3);
  const rows=mature.map(c=>{const v=c.body.translation(),q=c.body.rotation();return {r:Math.hypot(v.x,v.z),y:v.y,flat:Math.abs(1-2*(q.x*q.x+q.z*q.z))>.9};});
  const percentile=(values,f)=>values.sort((a,b)=>a-b)[Math.floor((values.length-1)*f)]??0;
  return {inside:p.pieces.filter(c=>c.state===1).length,mature:mature.length,top:Math.max(...rows.map(r=>r.y)),
    centerTop:percentile(rows.filter(r=>r.r<.42).map(r=>r.y),.85),outerTop:percentile(rows.filter(r=>r.r>.55&&r.r<.8).map(r=>r.y),.85),
    upperFlat:rows.filter(r=>r.y>.23&&r.flat).length,
    upperTotal:rows.filter(r=>r.y>.23).length};
}
const results=[];let developed;
for(const central of [false,true]){
  const p=new Physics(initial,true,central);p.warmup(6);const samples=[{second:0,...shape(p)}];
  let last=0;const stepTimes=[];
  for(let frame=1;frame<=45*20;frame++){
    const start=performance.now();p.update(1/45,true);stepTimes.push(performance.now()-start);
    assert.ok(p.stats.inside<=420);assert.ok(Number.isFinite(p.stats.heapTop));
    if([90,225,450,900].includes(frame)){
      samples.push({second:frame/45,...shape(p),exits:p.stats.rimExits-last});last=p.stats.rimExits;
    }
  }
  assert.equal(p.stats.feedHeld,0);assert.ok(p.stats.exitSides.every(n=>n>0));
  stepTimes.sort((a,b)=>a-b);
  const result={central,samples,feedHeld:p.stats.feedHeld,exitSides:[...p.stats.exitSides],medianStepMs:stepTimes[Math.floor(stepTimes.length/2)]};
  results.push(result);console.log(JSON.stringify(result));
  if(central)developed=p.seed();p.world.free();
}
// Bake the evolved arrangement after it has settled with no feed. Store only
// stable positions and zero velocities; do not stage coins at the rim.
const settle=new Settler(developed,true,true);
for(let frame=0;frame<45*3;frame++)settle.update(1/45,true);
const seed=settle.seed().filter(row=>Math.hypot(row[0],row[2])<.90).map(row=>[...row.slice(0,7),0,0,0,0,0,0]);
const metadata={source:'central feed after 20 simulated seconds, then 3 seconds settling',startCoins:seed.length,...shape(settle)};
settle.world.free();
await writeFile('src/physics/abundance-central-v5.json',JSON.stringify(seed));
await writeFile(resolve(dir,'preparation.json'),JSON.stringify({results,metadata},null,2));
console.log('SEED',JSON.stringify(metadata));
