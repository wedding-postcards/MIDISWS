import './style.css';
import './brand-fonts.css';
import './typography-study.css';
import 'lenis/dist/lenis.css';
import './hero-desktop.css';
import Lenis from 'lenis';
import { SceneExperience } from './scene';
import { sampleCharacterFraming } from './character-motion';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if(import.meta.env.DEV)document.title='МИДИС — версия 2 · рабочий макет';
const hero = document.querySelector<HTMLElement>('.tableau')!;
const word = document.querySelector<HTMLElement>('.hero-word')!;
const opening = document.querySelector<HTMLElement>('.story-area')!;
const story = document.querySelector<HTMLElement>('.scroll-story')!;
const closing = document.querySelector<HTMLElement>('.closing-story')!;
const header = document.querySelector<HTMLElement>('.midis-header')!;
const cue = document.querySelector<HTMLElement>('.scroll-invitation')!;
const menu = document.querySelector<HTMLElement>('#club-menu')!;
const scrim = document.querySelector<HTMLElement>('.menu-scrim')!;
const menuTrigger = document.querySelector<HTMLButtonElement>('.global-menu-trigger')!;
const rail = document.querySelector<HTMLElement>('.chapter-rail')!;
// Future chapters remain non-interactive until their real sections exist.
const chapters = [
  { numeral:'I', id:'hero', label:'Главная' },
  { numeral:'II', id:'zones', label:'Зоны и цены' },
  ...['III','IV','V','VI','VII','VIII','IX'].map((numeral,i)=>({numeral,id:`chapter-${i+3}`,label:''})),
  { numeral:'X', id:'visit', label:'Как добраться' },
];
rail.innerHTML = `<ol>${chapters.map(chapter=>document.getElementById(chapter.id)
  ? `<li data-chapter="${chapter.id}"><a href="#${chapter.id}" aria-label="${chapter.label}" title="${chapter.label}">${chapter.numeral}</a><span class="chapter-meter" aria-hidden="true"><i></i></span></li>`
  : `<li class="chapter-pending" aria-hidden="true"><span>${chapter.numeral}</span></li>`).join('')}</ol>`;
const chapterItems = [...rail.querySelectorAll<HTMLElement>('[data-chapter]')];
let chapterPositions: { item:HTMLElement; top:number }[] = [];
const lenis = new Lenis({ duration: .85, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: !reduced, syncTouch: false });
// Shopify's wheel-cadence distinction: high-rate trackpads already provide inertia.
// Reclassify each gesture so switching devices does not leave a stale setting.
let wheelTimes: number[] = [];
window.addEventListener('wheel', event => {
  if (wheelTimes.length && event.timeStamp-wheelTimes[wheelTimes.length-1]>2000) wheelTimes=[];
  wheelTimes.push(event.timeStamp);
  if(wheelTimes.length>10)wheelTimes.shift();
  if(wheelTimes.length>=4){
    const span=wheelTimes[wheelTimes.length-1]-wheelTimes[0];
    lenis.options.duration=span>0&&wheelTimes.length/span*1000>50?.15:.85;
  }
},{passive:true,capture:true});
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const START_WIPE = 2.10;
const END_WIPE = 3.26;
let wipe = 0;
let heroScroll = 0;
let lastScroll = NaN;
let headerTravel = 0;
const storyHeights = new Map<HTMLElement,number>();
const ribbonTops = { opening:0, story:0, closing:0 };
const framing = { anchorX: .37, anchorY: .215, scale: .88 };
let wordBounds = { top: 0, left: 0, width: 0, height: 0 };

function positionStory(el: HTMLElement, top: number): void {
  el.style.transform = `translate3d(0,${top}px,0)`;
  // The viewport clips the text physically. Accessibility follows geometry,
  // never an opacity threshold or an independently timed fade.
  const outside = top >= innerHeight || top+(storyHeights.get(el)??0) <= 0;
  el.inert = outside || !document.body.classList.contains('intro-complete');
  el.setAttribute('aria-hidden', String(outside));
}
function update(scroll: number): void {
  if (lastScroll === scroll) return;
  const previousScroll=lastScroll;
  const delta=Number.isFinite(previousScroll)?Math.max(scroll,innerHeight*.12)-Math.max(previousScroll,innerHeight*.12):0;
  lastScroll = scroll;
  const s = Math.max(0, scroll-hero.offsetTop)/innerHeight;
  heroScroll = s;
  // One scroll signal, overlapping editorial beats. No independent CSS lag.
  // ScenePass samples the donor Theatre Bezier itself: do not ease this twice.
  wipe = clamp((s-START_WIPE)/(END_WIPE-START_WIPE));
  Object.assign(framing,sampleCharacterFraming(reduced?0:s,innerWidth/innerHeight));
  const travel=s*innerHeight;
  word.style.transform = `translate3d(0,${-travel}px,0)`;
  const r = word.getBoundingClientRect();
  wordBounds = { top:r.top, left:r.left, width:r.width, height:r.height };
  // Three positions on one continuous vertical ribbon: no opacity animation.
  positionStory(opening,ribbonTops.opening-travel);
  positionStory(story,ribbonTops.story-travel);
  positionStory(closing,ribbonTops.closing-travel);
  if(s<=.12)headerTravel=0;
  else headerTravel=clamp(headerTravel+delta/(innerHeight*.38));
  const revealHeader=menuOpen||header.contains(document.activeElement);
  header.style.setProperty('--header-travel',String(revealHeader?0:headerTravel));
  header.inert=!document.body.classList.contains('intro-complete')||!revealHeader&&headerTravel>=1;
  document.body.classList.toggle('on-paper',wipe>.8);
  const current = chapterPositions.filter(chapter=>scroll+innerHeight*.12>=chapter.top).at(-1) ?? chapterPositions[0];
  for(const chapter of chapterPositions){
    const active = chapter===current;
    chapter.item.classList.toggle('is-current',active);
    const link=chapter.item.querySelector('a')!;
    if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');
    if(active){
      const next=chapterPositions[chapterPositions.indexOf(chapter)+1];
      chapter.item.style.setProperty('--chapter-progress',String(clamp((scroll-chapter.top)/Math.max(1,(next?.top??document.documentElement.scrollHeight)-chapter.top))));
    }
  }
}

// One contour for border, fill and hover. A single label never crossfades twice.
document.querySelectorAll<HTMLElement>('.relic-action').forEach(action => {
  const label = action.textContent!.trim();
  action.innerHTML = '<span class="action-surface" aria-hidden="true"></span><span class="action-label"></span>';
  action.querySelector('.action-label')!.textContent=label;
});

// Reversible Web Animations timeline: interrupting open/close never resets position.
let menuOpen = false;
const menuDuration = reduced ? 1 : 560;
const menuAnimation = menu.animate([{transform:'translateY(-102%)',opacity:.45},{transform:'translateY(0)',opacity:1}],{duration:menuDuration,easing:'cubic-bezier(.22,.8,.24,1)',fill:'both'});
const scrimAnimation = scrim.animate([{opacity:0},{opacity:1}],{duration:menuDuration,easing:'ease',fill:'both'});
menuAnimation.pause(); scrimAnimation.pause();
menuAnimation.currentTime=0; scrimAnimation.currentTime=0;
function setMenu(open: boolean): void {
  if (menuOpen===open) return;
  menuOpen=open;
  rail.inert=open;
  rail.classList.toggle('is-obscured',open);
  menuTrigger.setAttribute('aria-expanded',String(open));
  menuTrigger.setAttribute('aria-label',open?'Закрыть меню клуба':'Открыть меню клуба');
  if(open){
    menu.hidden=false; scrim.hidden=false; menu.inert=false; menu.setAttribute('aria-hidden','false');
    header.style.setProperty('--header-travel','0'); header.inert=false;
    lenis.stop();
    menuAnimation.playbackRate=1; scrimAnimation.playbackRate=1;
    menuAnimation.play(); scrimAnimation.play();
    menuTrigger.focus({preventScroll:true});
  }else{
    menu.inert=true; menu.setAttribute('aria-hidden','true');
    menuTrigger.focus({preventScroll:true});
    menuAnimation.playbackRate=-1; scrimAnimation.playbackRate=-1;
    menuAnimation.play(); scrimAnimation.play();
    lenis.start();
  }
}
menuAnimation.onfinish=()=>{ if(!menuOpen){ menu.hidden=true; scrim.hidden=true; } };
menuTrigger.addEventListener('click',()=>setMenu(!menuOpen));
scrim.addEventListener('click',()=>setMenu(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setMenu(false);});
document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
  const target=document.querySelector<HTMLElement>(link.hash);
  if(!target)return;
  event.preventDefault(); setMenu(false);
  lenis.scrollTo(target,{immediate:reduced,force:true});
  history.replaceState(null,'',link.hash);
}));
cue.addEventListener('click',()=>lenis.scrollTo(ribbonTops.story-innerHeight*.31,{immediate:reduced}));
function remeasure(): void {
  lastScroll=NaN;lenis.resize();
  for(const block of [opening,story,closing])storyHeights.set(block,block.offsetHeight);
  // The h1 box matches the geometry's actual aspect ratio, including Д's
  // descender. Shared translation then preserves these gaps at every scroll.
  ribbonTops.opening=Math.max(innerHeight*.65,word.offsetTop+word.offsetHeight+24);
  ribbonTops.story=Math.max(innerHeight*1.5,ribbonTops.opening+opening.offsetHeight+innerHeight*.48);
  const storyBottom=ribbonTops.story+story.offsetHeight;
  const previousGap=Math.max(innerHeight*2.58,storyBottom+innerHeight*.42)-storyBottom;
  ribbonTops.closing=storyBottom+previousGap*.8;
  chapterPositions=chapterItems.map(item=>({item,top:document.getElementById(item.dataset.chapter!)!.getBoundingClientRect().top+scrollY}));
  update(scrollY);
}
window.addEventListener('resize',remeasure);
void document.fonts.ready.then(remeasure);
let sceneClock=false;
function fallbackClock(time:number):void{if(sceneClock)return;lenis.raf(time);update(scrollY);requestAnimationFrame(fallbackClock);}
requestAnimationFrame(fallbackClock);
async function boot():Promise<void>{
 try{
  const scene=new SceneExperience(document.querySelector<HTMLCanvasElement>('#scene')!,{
   trial10:true,editorial:true,
   transition:()=>({start:innerHeight*START_WIPE,end:innerHeight*END_WIPE}),
   presentation:{tableau:{fullPainting:true,framing:()=>framing,scrollProgress:()=>heroScroll,wipeProgress:()=>wipe,wordmarkFlatColor:'#d8b36a',paintedWordmark:true,motionStrength:reduced?0:.85,active:()=>scrollY<hero.offsetHeight},wordmarkGeometry:'assets/midis/wordmark-alegreya.json',backgroundScale:1.16,backgroundAnchorY:.125},
   wordmarkRect:()=>wordBounds,
   frame:time=>{lenis.raf(time);update(scrollY);return scrollY;},onProgress:()=>{},
  });
  await scene.load();remeasure();sceneClock=true;hero.dataset.ready='true';scene.start();
 }catch(error){
  console.error('The artwork could not start.',error);
  document.body.classList.add('webgl-failed','intro-complete');hero.dataset.ready='true';
  document.querySelector('#intro-cover')?.remove();
  document.querySelectorAll<HTMLElement>('[data-intro-ui]').forEach(element=>{element.inert=false;});
 }
}
void boot();
