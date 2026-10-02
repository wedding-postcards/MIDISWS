import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const dir=resolve('qa/v2');await mkdir(dir,{recursive:true});
const view={width:1920,height:1080};const page=await browser.newPage({viewport:view,deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1,{timeout:45000});
await page.mouse.move(960,540);
const samples=[];
for(const [name,scroll] of [['opening',0],['first-wheel',.12],['pour',.48],['edge',1.1],['gold',1.85],['story',2.3],['end',3.5],['reverse',0]]){
  await page.evaluate(y=>window.__midis.lenis.scrollTo(y*innerHeight,{immediate:true}),scroll);
  await page.waitForTimeout(name==='pour'?1800:700);
  await page.screenshot({path:resolve(dir,`${name}.png`)});
  samples.push({name,scroll:await page.evaluate(()=>scrollY),diagnostics:await page.evaluate(()=>window.__midis.experience.diagnostics)});
}
await writeFile(resolve(dir,'measurements.json'),JSON.stringify({errors,samples},null,2));
console.log(JSON.stringify({errors,samples:samples.map(s=>({name:s.name,...s.diagnostics}))}));
await browser.close();
