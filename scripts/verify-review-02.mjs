import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve('qa/review-02');await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1,null,{timeout:60000});
const started=Date.now();
for(let i=0;i<26;i++){
  if(i)await page.waitForTimeout(1000);
  samples.push({seconds:(Date.now()-started)/1000,...await page.evaluate(()=>window.__midis.experience.diagnostics)});
  if([0,10,25].includes(i)){await page.screenshot({path:resolve(dir,`detail-${i}.png`),clip:{x:440,y:30,width:650,height:560}});await page.screenshot({path:resolve(dir,`full-${i}.png`)});console.log(i,JSON.stringify(samples.at(-1)));}
}
await page.mouse.move(120,180);await page.waitForTimeout(700);await page.screenshot({path:resolve(dir,'grip-left.png'),clip:{x:440,y:30,width:650,height:560}});
await page.mouse.move(1810,900);await page.waitForTimeout(700);await page.screenshot({path:resolve(dir,'grip-right.png'),clip:{x:440,y:30,width:650,height:560}});
const depth=await page.evaluate(()=>{
 const x=window.__midis.experience;return {visible:x.coinOccluders.visible,meshes:x.coinOccluders.children.length,figureColorWrite:x.coinOccluders.children[0].material.colorWrite,figureDepthWrite:x.coinOccluders.children[0].material.depthWrite};
});
await page.evaluate(()=>window.__midis.lenis.scrollTo(innerHeight*2.3,{immediate:true}));await page.waitForTimeout(4000);
const hidden=await page.evaluate(()=>({depthVisible:window.__midis.experience.coinOccluders.visible,...window.__midis.experience.diagnostics}));
await page.evaluate(()=>window.__midis.lenis.scrollTo(0,{immediate:true}));await page.waitForTimeout(750);
const reverse=await page.evaluate(()=>window.__midis.experience.diagnostics);
const result={errors,depth,hidden,reverse,samples,checks:{noErrors:errors.length===0,allRimQuadrants:samples.at(-1).coins.exitSides.every(n=>n>=3),boundedHeap:samples.every(s=>s.coins.inside<=752),boundedHeight:samples.every(s=>s.coins.heapTop<.46),fallSpeed:samples.every(s=>s.coins.fallTimeScale===1.3),depthOcclusion:depth.visible&&!depth.figureColorWrite&&depth.figureDepthWrite,hiddenStopsBirths:!hidden.coins.emitting&&!hidden.depthVisible,levelCup:Math.abs(reverse.bowlUp[0])<1e-5&&Math.abs(reverse.bowlUp[2])<1e-5,frameTime:samples.every(s=>s.frameMs<25)}};
await writeFile(resolve(dir,'report.json'),JSON.stringify(result,null,2));console.log('CHECKS',result.checks);await browser.close();
if(Object.values(result.checks).some(v=>!v))process.exitCode=1;
