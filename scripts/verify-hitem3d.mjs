import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const dir=resolve('qa/hitem3d-site');await mkdir(dir,{recursive:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1,{timeout:45000});
const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
const samples=[];
for(const [name,scroll] of [['opening',0],['first-wheel',.13],['pour',.58],['held',1.18],['edge',1.72],['gold',2.30],['end',2.65],['reverse',0]]){
 await page.evaluate(y=>window.__midis.lenis.scrollTo(y*innerHeight,{immediate:true}),scroll);
 await page.waitForTimeout(name==='first-wheel'||name==='pour'?750:350);
 await page.screenshot({path:resolve(dir,`${name}.png`)});
 samples.push({name,diagnostics:await page.evaluate(()=>window.__midis.experience.diagnostics)});
 console.log(name,JSON.stringify(samples.at(-1).diagnostics));
}
await writeFile(resolve(dir,'measurements.json'),JSON.stringify({gpu,errors,samples},null,2));
console.log(JSON.stringify({gpu,errors}));await browser.close();
