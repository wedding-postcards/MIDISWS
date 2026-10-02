import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=resolve('qa/review-10');await mkdir(dir,{recursive:true});
const path=resolve(dir,'verification-engine.mjs');
await writeFile(path,ts.transpileModule(await readFile('src/abundance-physics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {AbundancePhysics}=await import(pathToFileURL(path).href);await AbundancePhysics.initialize();
const seed=JSON.parse(await readFile('src/physics/abundance-central-v5.json','utf8'));
const p=new AbundancePhysics(seed,true,true);p.warmup(6);
const samples=[],batches=[];let previous=0,maxInside=0,maxTop=0,maxAirborne=0;
for(let frame=1;frame<=45*30;frame++){
  p.update(1/45,true);
  maxInside=Math.max(maxInside,p.stats.inside);maxTop=Math.max(maxTop,p.stats.heapTop);maxAirborne=Math.max(maxAirborne,p.stats.airborne);
  assert.ok(p.stats.inside<=420);assert.ok(p.pieces.length<=1100);
  if(frame%9===0){batches.push({second:frame/45,exits:p.stats.rimExits-previous});previous=p.stats.rimExits;}
  if(frame%225===0){const sample={second:frame/45,inside:p.stats.inside,exits:p.stats.rimExits,top:p.stats.heapTop,feedHeld:p.stats.feedHeld};samples.push(sample);console.log(JSON.stringify(sample));}
}
const firstTwo=batches.filter(s=>s.second<=2),firstSecond=batches.filter(s=>s.second<=1).reduce((s,b)=>s+b.exits,0);
assert.ok(firstSecond<=5,'Do not restore the initial rim cascade');
assert.ok(Math.max(...firstTwo.map(s=>s.exits))<=4,'No single opening burst');
assert.ok(maxTop<.47,'Keep a modest bounded mound');
assert.equal(p.stats.feedHeld,0);assert.ok(p.stats.exitSides.every(n=>n>0));
assert.ok(samples.at(-1).exits>samples.at(-2).exits,'Overflow must keep circulating');
assert.ok(Array.from(p.snapshot()).every(Number.isFinite));
// The feeding change must preserve the existing single-coin grab lifecycle.
const index=p.pieces.findIndex(c=>c.state===1&&c.age>=1.3&&c.body.translation().y>.25);
assert.ok(index>=0);const pos={...p.pieces[index].body.translation()};
assert.equal(p.beginGrab({index,state:1,...pos}),true);p.moveGrab({x:pos.x+.3,y:pos.y+.35,z:pos.z});
for(let i=0;i<20;i++)p.update(1/45,true);
const moved=p.pieces[index].fall?.position||p.pieces[index].body.translation();assert.ok(moved.y>pos.y+.2);
p.endGrab();p.update(1/45,true);assert.equal(p.stats.grabbed,-1);
const result={startCoins:seed.length,firstSecond,firstTwoSeconds:firstTwo.reduce((s,b)=>s+b.exits,0),maxInitialBatch:Math.max(...firstTwo.map(s=>s.exits)),maxInside,maxTop,maxAirborne,exitSides:[...p.stats.exitSides],feedHeld:p.stats.feedHeld,grabReleased:p.stats.grabbed===-1,samples,batches};
await writeFile(resolve(dir,'verification.json'),JSON.stringify(result,null,2));p.world.free();console.log('PASS',JSON.stringify({...result,samples:undefined,batches:undefined}));
