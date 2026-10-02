import {chromium} from 'playwright-core';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1,{timeout:45000});
await mkdir('qa/gold-lighting',{recursive:true});
const cases=[
 {name:'pitch-high',color:'#d6a533',roughness:.17,intensity:.64,rotation:-1.3,pitch:1.1},
 {name:'pitch-low',color:'#d6a533',roughness:.17,intensity:.64,rotation:-1.3,pitch:-1.1},
 {name:'pitch-half',color:'#d6a533',roughness:.17,intensity:.64,rotation:-1.3,pitch:.55},
 {name:'pitch-back',color:'#d6a533',roughness:.17,intensity:.64,rotation:-1.3,pitch:2.4},
];
for(const c of cases){await page.evaluate(c=>{const e=window.__midis.experience;e.artwork.environmentRotation.set(c.pitch,c.rotation,0);e.front.environmentRotation.set(c.pitch,c.rotation,0);e.bowl.traverse(o=>{if(o.isMesh){o.material.color.set(c.color);o.material.roughness=c.roughness;o.material.envMapIntensity=c.intensity;}});},c);await page.waitForTimeout(120);await page.screenshot({path:resolve(`qa/gold-lighting/${c.name}.png`),clip:{x:545,y:125,width:360,height:280}});console.log(c.name);}
await browser.close();
