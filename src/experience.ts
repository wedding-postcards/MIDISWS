import './style.css';
import Lenis from 'lenis';
import { SceneExperience } from './scene';
import type { HeroUiFrame } from './header-interactions';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroPreview = document.body.dataset.heroPreview === 'game';
const lenis = new Lenis({
  duration: 1.05,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: !reduced,
  syncTouch: false,
});
const chapters = [...document.querySelectorAll<HTMLAnchorElement>('.chapter-index a')];
const track = document.querySelector<HTMLElement>('.chapter-track')!;
const hero = document.querySelector<HTMLElement>('.hero')!;
const narrative = document.querySelector<HTMLElement>('.hero-narrative')!;
const story = document.querySelector<HTMLElement>('.hero-story')!;
const wordmark = document.querySelector<HTMLElement>('.hero-wordmark')!;
const caption = document.querySelector<HTMLElement>('.hero-caption')!;
const typeMeasure = document.createElement('canvas').getContext('2d')!;
const scrollCue = document.querySelector<HTMLElement>('.scroll-cue')!;
let wordmarkBounds = { top: 0, left: 0, width: 0, height: 0 };
let range = { start: innerHeight * .7, end: innerHeight * 1.62 };
const transitionRange = () => range;
function measureChapters(): void {
  const titleRect = wordmark.getBoundingClientRect();
  wordmarkBounds = { top: titleRect.top + scrollY, left: titleRect.left, width: titleRect.width, height: titleRect.height };
  document.documentElement.style.setProperty('--wordmark-left', `${titleRect.left}px`);
  document.documentElement.style.setProperty('--wordmark-right', `${document.documentElement.clientWidth - titleRect.right}px`);
  if (heroPreview) {
    const firstLetter = document.createRange();
    firstLetter.selectNodeContents(wordmark);
    firstLetter.setEnd(wordmark.firstChild!, 1);
    const firstRect = firstLetter.getBoundingClientRect();
    document.documentElement.style.setProperty('--wordmark-first-center', `${firstRect.left + firstRect.width / 2}px`);
  }
  // Fit the small inscription to the first two large letters without
  // stretching the glyphs or inserting oversized spaces between words.
  if (!heroPreview) {
    const prefix = document.createRange();
    prefix.selectNodeContents(wordmark);
    prefix.setEnd(wordmark.firstChild!, 2);
    const captionWidth = prefix.getBoundingClientRect().width;
    const captionText = caption.textContent!.trim();
    typeMeasure.font = '500 100px "Cormorant Garamond"';
    const captionUnits = typeMeasure.measureText(captionText).width / 100 + captionText.length * .08;
    caption.style.fontSize = `${captionWidth / captionUnits * .86}px`;
  }
  const narrativeBottom = narrative.getBoundingClientRect().bottom + scrollY;
  const storyBottom = story.getBoundingClientRect().bottom + scrollY;
  const start = Math.max(innerHeight * .65, narrativeBottom - innerHeight * .58);
  const end = Math.ceil(Math.max(start + innerHeight * .92, storyBottom));
  range = { start, end: end - 1 };
  hero.style.minHeight = `${end}px`;
  lenis.resize();
}
measureChapters();
void document.fonts.ready.then(measureChapters);
window.addEventListener('resize', measureChapters);
document.addEventListener('midis:menu-change', event => {
  if ((event as CustomEvent<boolean>).detail) lenis.stop(); else lenis.start();
});
let lastChapter = -1, lastTrack = '', lastPaper = false, lastCue = '';
function updateProgress(scroll: number): void {
  if (heroPreview) {
    const titleTop = wordmarkBounds.top - scroll;
    document.dispatchEvent(new CustomEvent<HeroUiFrame>('midis:hero-ui-frame', { detail: {
      titleTop,
      titleBottom: titleTop + wordmarkBounds.height,
      scrollOffset: scroll,
      introComplete: document.body.classList.contains('intro-complete') || document.body.classList.contains('webgl-failed'),
    } }));
  }
  const cue = String(.85 * Math.max(0, 1 - scroll / (innerHeight * .2)));
  if (cue !== lastCue) { scrollCue.style.setProperty('--scroll-cue-opacity', cue); lastCue = cue; }
  const { start, end } = transitionRange();
  const chapter = scroll >= end - 2 ? 1 : 0;
  if (chapter !== lastChapter) {
    chapters.forEach((link, index) => index === chapter ? link.setAttribute('aria-current', 'location') : link.removeAttribute('aria-current'));
    lastChapter = chapter;
  }
  const value = `${(Math.min(1, Math.max(0, scroll / end)) * 50).toFixed(1)}px`;
  if (value !== lastTrack) { track.style.setProperty('--chapter-progress', value); lastTrack = value; }
  const paper = (scroll - start) / (end - start) > .72;
  if (paper !== lastPaper) { document.body.classList.toggle('on-paper', paper); lastPaper = paper; }
}
chapters.forEach((link, index) => link.addEventListener('click', event => {
  event.preventDefault();
  lenis.scrollTo(index === 0 ? 0 : transitionRange().end, { immediate: reduced });
  history.replaceState(null, '', `${location.pathname}${link.hash}`);
}));
document.querySelector<HTMLAnchorElement>('.louver-brand')?.addEventListener('click', event => {
  event.preventDefault();
  lenis.scrollTo(0, { immediate: reduced });
  history.replaceState(null, '', `${location.pathname}#hero`);
});

async function boot(): Promise<void> {
  try {
    const scene = new SceneExperience(document.querySelector<HTMLCanvasElement>('#scene')!, {
      trial10: true,
      editorial: true,
      // Begin the wipe while the short narrative is still in view, with no
      // empty scroll runway between the words and the second screen.
      transition: transitionRange,
      wordmarkRect: () => ({ ...wordmarkBounds, top: wordmarkBounds.top - scrollY }),
      presentation: heroPreview ? {
        wordmarkGeometry: 'assets/midis/wordmark-alegreya.json',
        wordmarkGold: { peak: 2.1, roughness: .30, envMapIntensity: .75, color: '#c7a364', paintedRelief: true },
        backgroundScale: 1.12,
        backgroundAnchorY: .10,
        figureDropPx: 50,
        headerBottomPx: 114,
      } : undefined,
      frame: now => { lenis.raf(now); return scrollY; },
      onProgress: updateProgress,
    });
    await scene.load();
    lenis.resize();
    lenis.scrollTo(0, { immediate: true, force: true });
    history.replaceState(null, '', `${location.pathname}#hero`);
    scene.start();
  } catch (error) {
    console.error('Unable to start artwork', error);
    document.body.classList.add('webgl-failed');
    document.querySelector('#intro-cover')?.remove();
    document.querySelectorAll<HTMLElement>('[data-intro-ui]').forEach(element => { element.inert = false; });
    const frame = (now: number): void => { lenis.raf(now); updateProgress(scrollY); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }
}
void boot();
