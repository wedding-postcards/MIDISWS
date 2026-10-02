import ts from 'typescript';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=resolve('qa/review-06');await mkdir(dir,{recursive:true});
const mode=process.argv[2]||'both',seconds=Number(process.argv[3]||30);
async function run(label,sourceFile,seedFile){
  const source=await readFile(sourceFile,'utf8'),engine=resolve(dir,`${label}-engine.mjs`);
  await writeFile(engine,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
  const {AbundancePhysics}=await import(pathToFileURL(engine).href);await AbundancePhysics.initialize();
  const seed=JSON.parse(await readFile(seedFile,'utf8')),p=new AbundancePhysics(seed);p.warmup(6);
  const samples=[],costs=[];let maxInside=0,maxTop=0,lastExits=0,lastBorn=0;
  for(let i=0;i<seconds*45;i++){
    const start=performance.now();p.update(1/45,true);costs.push(performance.now()-start);
    maxInside=Math.max(maxInside,p.stats.inside);maxTop=Math.max(maxTop,p.stats.heapTop);
    assert.ok(p.pieces.length<=1100);assert.ok(p.stats.inside<=752);
    if((i+1)%45===0){
      const sample={time:(i+1)/45,exits:p.stats.rimExits-lastExits,births:p.stats.born-lastBorn,
        inside:p.stats.inside,airborne:p.stats.airborne,rate:p.stats.feedRate,top:p.stats.heapTop};
      samples.push(sample);lastExits=p.stats.rimExits;lastBorn=p.stats.born;
      if(sample.time<=4||sample.time%10===0)console.log(label,JSON.stringify(sample));
    }
  }
  let interaction;
  if(label==='current'){
    assert.equal(p.stats.impacts,0,'No hover input reaches physics');
    const index=p.pieces.findIndex(a=>a.state===1&&a.age>=1.3&&a.body.translation().y>.27);
    assert.ok(index>=0);const pos=p.pieces[index].body.translation();
    assert.equal(p.beginGrab({index,state:1,...pos}),true);
    assert.equal(p.beginGrab({index:index+1,state:1,...pos}),false,'Only one coin held at once');
    const destination={x:pos.x+.5,y:pos.y+.5,z:pos.z+.1};
    p.moveGrab(destination);
    for(let i=0;i<30;i++)p.update(1/45,true);
    const held=p.pieces[index].fall?.position||p.pieces[index].body.translation();
    const distance=Math.hypot(held.x-pos.x,held.y-pos.y,held.z-pos.z);
    assert.ok(distance>.35,'Held coin follows drag');p.endGrab();p.update(1/45,true);
    assert.equal(p.stats.grabbed,-1);assert.equal(p.stats.impacts,1);assert.equal(p.stats.releases,1);
    interaction={oneCoinOnly:true,dragDistance:distance,grabs:p.stats.impacts,releases:p.stats.releases};
    assert.ok(Array.from(p.snapshot()).every(Number.isFinite));
  }
  costs.sort((a,b)=>a-b);
  const result={label,seconds,startCoins:seed.length,maxInside,maxTop,
    first4Exits:samples.slice(0,4).reduce((a,s)=>a+s.exits,0),
    baselineExitsPerSecond:samples.filter(s=>s.time>10).reduce((a,s)=>a+s.exits,0)/(seconds-10),
    medianStepMs:costs[Math.floor(costs.length*.5)],p95StepMs:costs[Math.floor(costs.length*.95)],
    exitSides:p.stats.exitSides,feedHeld:p.stats.feedHeld,interaction,samples};
  await writeFile(resolve(dir,`${label}-result.json`),JSON.stringify(result,null,2));p.world.free();
  console.log('RESULT',JSON.stringify({...result,samples:undefined}));
}
if(mode==='both'||mode==='baseline')await run('baseline','assets/versions/review-05-2026-10-02/src/abundance-physics.ts','src/physics/abundance-natural-v1.json');
if(mode==='both'||mode==='current')await run('current','src/abundance-physics.ts','src/physics/abundance-sunlit-v2.json');
