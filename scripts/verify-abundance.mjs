import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const dir=resolve('qa/abundance');await mkdir(dir,{recursive:true});
const errors=[],checks=[],samples=[];
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const snapshot=async(name)=>{
  await page.screenshot({path:resolve(dir,`${name}.png`)});
  const diagnostics=await page.evaluate(()=>window.__midis.experience.diagnostics);samples.push({name,diagnostics});
  console.log(name,JSON.stringify(diagnostics));return diagnostics;
};
const at=async(v)=>{await page.evaluate(v=>window.__midis.lenis.scrollTo(v*innerHeight,{immediate:true}),v);await page.waitForTimeout(120);};
const check=(name,condition)=>{checks.push({name,passed:!!condition});assert(condition,name);};
try{
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro>.17,{timeout:45000});
  await snapshot('01-reveal');
  await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro>.53);await snapshot('02-reveal');
  await page.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1);await page.waitForTimeout(1800);
  const opening=await snapshot('03-opening');
  const structure=await page.evaluate(()=>({sections:document.querySelectorAll('main>section').length,title:document.querySelector('h1').textContent,font:getComputedStyle(document.querySelector('h1')).fontFamily,fontReady:document.fonts.check('20px Forum'),overflow:document.documentElement.scrollWidth>innerWidth}));
  check('Exactly two sections',structure.sections===2);check('Cyrillic title and loaded Forum',structure.title==='МИДИС'&&structure.font.includes('Forum')&&structure.fontReady);check('No horizontal overflow at 1920',!structure.overflow);
  await page.mouse.wheel(0,160);await page.waitForTimeout(70);
  const early=await page.evaluate(()=>({scroll:scrollY,opacity:+document.querySelector('.hero-content').style.opacity}));
  check('Wheel is smoothed, not an immediate jump',early.scroll>0&&early.scroll<160);check('Title remains readable on first wheel',early.opacity>.95);
  await page.waitForTimeout(1000);await snapshot('04-first-wheel');
  const continuity=[];
  for(let i=0;i<8;i++){await page.waitForTimeout(650);continuity.push(await page.evaluate(()=>({...window.__midis.experience.diagnostics.coins})));}
  check('Continuous births at a fixed cadence',continuity.every((s,i)=>i===0||(s.born>continuity[i-1].born&&s.born-continuity[i-1].born<=12)));
  check('Overflow across every rim quadrant',continuity.at(-1).exitSides.every(n=>n>3));
  check('Every birth is below the rim, concealed inside the heap',continuity.every(s=>s.lastSpawnLocal[1]<.17&&Math.hypot(s.lastSpawnLocal[0],s.lastSpawnLocal[2])<.4));
  check('The reservoir is a dense moving pile',continuity.every(s=>s.inside>500&&s.movingInside>60));
  check('Rim exits have no upward launch',continuity.at(-1).maxExitUp<=.15&&continuity.at(-1).maxExitSpeed<=.56);
  await snapshot('05-overflow');
  const before=await page.evaluate(()=>window.__midis.experience.diagnostics.coins.impacts);
  for(let attempt=0;attempt<4;attempt++){
    const point=await page.evaluate(()=>window.__midis.experience.coinPositions().find(([x,y])=>x>100&&x<1800&&y>350&&y<950));
    if(!point){await page.waitForTimeout(100);continue;}
    await page.mouse.move(point[0]-22,point[1]);await page.mouse.move(point[0]+12,point[1]+15,{steps:3});
    if(await page.evaluate(()=>window.__midis.experience.diagnostics.coins.impacts)>before)break;
  }
  check('Pointer gives an impulse to a falling coin',await page.evaluate(()=>window.__midis.experience.diagnostics.coins.impacts)>before);
  await page.mouse.move(90,80);await page.waitForTimeout(650);const left=await snapshot('06-pointer-left');
  await page.mouse.move(1840,985);await page.waitForTimeout(650);const right=await snapshot('07-pointer-right');
  check('Camera orbit responds in both axes',right.cameraPosition[0]-left.cameraPosition[0]>.35&&left.cameraPosition[1]-right.cameraPosition[1]>.15);
  await page.mouse.move(960,540);await page.waitForTimeout(600);
  for(const [name,v] of [['08-title',.39],['09-story',1.16],['10-gold-edge',1.72],['11-cup-covered',2.05],['12-second-block',2.30]]){await at(v);await page.waitForTimeout(350);await snapshot(name);}
  const stopped=await page.evaluate(()=>({...window.__midis.experience.diagnostics.coins}));
  await page.waitForFunction(()=>window.__midis.experience.diagnostics.coins.airborne===0,null,{timeout:8000});
  const drained=await page.evaluate(()=>({...window.__midis.experience.diagnostics.coins}));
  check('No hidden births or new rim exits behind chapter two',stopped.born===drained.born&&stopped.rimExits===drained.rimExits&&!drained.emitting);
  check('Existing airborne coins finish falling',drained.airborne===0);
  await snapshot('13-second-block-settled');
  await at(0);await page.waitForTimeout(1100);const reverse=await snapshot('14-reverse');
  check('Level cup after reverse scroll',Math.abs(reverse.bowlUp[0])<1e-5&&Math.abs(reverse.bowlUp[2])<1e-5&&reverse.bowlUp[1]>.99999);
  await page.locator('#chapter-toggle').click();check('Menu opens',await page.locator('#chapter-toggle').getAttribute('aria-expanded')==='true');
  await page.keyboard.press('Escape');check('Escape closes menu',await page.locator('#chapter-toggle').getAttribute('aria-expanded')==='false');
  await page.locator('#chapter-toggle').click();await page.locator('#chapter-menu a[href="#midisy"]').click();
  await page.waitForFunction(()=>location.hash==='#midisy'&&scrollY>innerHeight*2.2);
  check('Chapter navigation reaches second block',await page.locator('.chapter-index a[href="#midisy"]').getAttribute('aria-current')==='location');
  await page.locator('.identity').click();await page.waitForFunction(()=>scrollY<1);
  for(const [width,height] of [[1600,900],[1366,768],[1008,873]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(450);await snapshot(`15-desktop-${width}`);
    check(`No horizontal overflow at ${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
  const quiet=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
  quiet.on('pageerror',e=>errors.push(e.message));await quiet.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
  await quiet.waitForFunction(()=>window.__midis?.experience.diagnostics.intro===1);await quiet.waitForTimeout(800);
  const reduced=await quiet.evaluate(()=>window.__midis.experience.diagnostics);
  check('Reduced motion disables particle flow and autonomous movement',reduced.coins.born===0&&!reduced.coins.emitting);
  await quiet.screenshot({path:resolve(dir,'16-reduced-motion.png')});await quiet.close();
  check('No browser errors',errors.length===0);
  check('Native GPU frame time stays below 25 ms',samples.filter(s=>s.diagnostics.intro===1).every(s=>s.diagnostics.frameMs<25));
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown';});
  await writeFile(resolve(dir,'acceptance.json'),JSON.stringify({gpu,errors,checks,continuity,samples,structure,early,reduced},null,2));
  console.log('ACCEPTANCE',checks.length,'passed');
}catch(error){await writeFile(resolve(dir,'acceptance.json'),JSON.stringify({errors,checks,samples,failure:String(error)},null,2));console.error(error);process.exitCode=1;}
finally{await browser.close();}
