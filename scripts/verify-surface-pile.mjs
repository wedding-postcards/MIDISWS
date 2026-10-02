import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve('qa/review-07');await mkdir(dir,{recursive:true});
const seconds=30,results=[];
for(const light of [false,true]){
  const label=light?'surface':'full',file=resolve(dir,`${label}-engine.mjs`);
  const path=light?'src/abundance-physics.ts':'assets/versions/review-06-2026-10-02/src/abundance-physics.ts';
  await writeFile(file,ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  const {AbundancePhysics}=await import(pathToFileURL(file).href);await AbundancePhysics.initialize();
  const seed=JSON.parse(await readFile(`src/physics/${light?'abundance-surface-v3':'abundance-sunlit-v2'}.json`,'utf8'));
  const p=new AbundancePhysics(seed,light);p.warmup(6);
  const times=[],samples=[];let maxInside=0,maxTop=0,lastExits=0;
  for(let i=0;i<seconds*45;i++){
    const start=performance.now();p.update(1/45,true);times.push(performance.now()-start);
    maxInside=Math.max(maxInside,p.stats.inside);maxTop=Math.max(maxTop,p.stats.heapTop);
    assert.ok(p.stats.inside<=(light?420:752));
    if((i+1)%225===0){const sample={time:(i+1)/45,exits:p.stats.rimExits-lastExits,inside:p.stats.inside,airborne:p.stats.airborne,top:p.stats.heapTop};samples.push(sample);lastExits=p.stats.rimExits;console.log(label,JSON.stringify(sample));}
  }
  assert.equal(p.stats.feedHeld,0);assert.ok(p.stats.exitSides.every(n=>n>0));
  if(light){
    const index=p.pieces.findIndex(coin=>coin.state===1&&coin.age>=1.3&&coin.body.translation().y>.27);
    assert.ok(index>=0);const pos={...p.pieces[index].body.translation()};
    assert.equal(p.beginGrab({index,state:1,...pos}),true);assert.equal(p.beginGrab({index,state:1,...pos}),false);
    p.moveGrab({x:pos.x+.4,y:pos.y+.4,z:pos.z});for(let i=0;i<20;i++)p.update(1/45,true);
    const end=p.pieces[index].fall?.position||p.pieces[index].body.translation();assert.ok(end.y-pos.y>.25);
    p.endGrab();p.update(1/45,true);assert.equal(p.stats.grabbed,-1);assert.equal(p.stats.impacts,1);
  }
  assert.ok(Array.from(p.snapshot()).every(Number.isFinite));times.sort((a,b)=>a-b);
  const result={label,start:seed.length,maxInside,maxTop,medianStepMs:times[Math.floor(times.length*.5)],p95StepMs:times[Math.floor(times.length*.95)],feedHeld:p.stats.feedHeld,exitSides:p.stats.exitSides,samples};
  results.push(result);p.world.free();console.log('RESULT',JSON.stringify({...result,samples:undefined}));
}
await writeFile(resolve(dir,'comparison.json'),JSON.stringify({seconds,results,medianReduction:1-results[1].medianStepMs/results[0].medianStepMs},null,2));
