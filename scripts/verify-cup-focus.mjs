import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dir=resolve('qa/cup-focus');await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[],samples=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173/');await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1,{timeout:60000});
for(let i=0;i<Number(process.argv[2]||5);i++){
  await page.waitForTimeout(i===0?250:3000);
  const data=await page.evaluate(()=>window.__midis.experience.diagnostics);samples.push(data);console.log(i,JSON.stringify(data));
  await page.screenshot({path:resolve(dir,`full-${i}.png`)});
  await page.screenshot({path:resolve(dir,`detail-${i}.png`),clip:{x:450,y:30,width:640,height:560}});
}
await writeFile(resolve(dir,'report.json'),JSON.stringify({errors,samples},null,2));await browser.close();
