import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=resolve('qa/review-08');await mkdir(dir,{recursive:true});
const file=resolve(dir,'engine.mjs');
await writeFile(file,ts.transpileModule(await readFile('src/abundance-physics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
const {AbundancePhysics}=await import(pathToFileURL(file).href);await AbundancePhysics.initialize();
const seeds=await Promise.all(['v3','v4'].map(async version=>JSON.parse(await readFile(`src/physics/abundance-surface-${version}.json`,'utf8'))));
assert.equal(seeds[0].length,seeds[1].length);
let changed=0;
for(let i=0;i<seeds[0].length;i++){
  assert.equal(seeds[0][i][1],seeds[1][i][1],'Keep the approved heap height');
  assert.deepEqual(seeds[0][i].slice(3),seeds[1][i].slice(3),'Keep orientations and velocities');
  if(seeds[0][i][0]!==seeds[1][i][0]||seeds[0][i][2]!==seeds[1][i][2])changed++;
}
assert.equal(changed,24);
const results=[];
for(let version=0;version<2;version++){
  const p=new AbundancePhysics(seeds[version],true);p.warmup(6);const samples=[];
  let last=0;
  for(let frame=0;frame<45*8;frame++){
    p.update(1/45,true);
    if((frame+1)%9===0){samples.push({time:+((frame+1)/45).toFixed(1),exits:p.stats.rimExits-last});last=p.stats.rimExits;}
    assert.ok(p.stats.inside<=420);
  }
  const result={version:version?'v4':'v3',firstSecond:samples.filter(s=>s.time<=1).reduce((sum,s)=>sum+s.exits,0),
    firstTwoSeconds:samples.filter(s=>s.time<=2).reduce((sum,s)=>sum+s.exits,0),
    maxInitialBatch:Math.max(...samples.filter(s=>s.time<=2).map(s=>s.exits)),
    totalExits:p.stats.rimExits,feedHeld:p.stats.feedHeld,samples};
  results.push(result);p.world.free();console.log(JSON.stringify({...result,samples:result.samples.slice(0,10)}));
}
assert.ok(results[1].firstSecond<results[0].firstSecond/3,'The simultaneous rim fall is removed');
assert.ok(results[1].maxInitialBatch<=4,'No opening cascade');
assert.ok(results[1].totalExits>10,'Natural overflow still begins');
assert.equal(results[1].feedHeld,0);
await writeFile(resolve(dir,'startup-comparison.json'),JSON.stringify({changedCoinPositions:changed,results},null,2));
