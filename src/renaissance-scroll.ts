import original from './donor/renaissance-mouse.original.json';

type Keyframe = { t: number; s: number[] };
const mouse = original as unknown as {
  fr: number;
  op: number;
  layers: { ks: { p: { k: Keyframe[] }; o: { k: Keyframe[] } } }[];
};
const dot = document.querySelector<SVGGElement>('.renaissance-mouse-dot')!;
const progress = document.querySelector<SVGGeometryElement>('.renaissance-scroll-progress')!;
const keys = mouse.layers[0].ks;

// Both source easing handles have x == y: position and opacity interpolate linearly.
function sample(frames: Keyframe[], time: number): number[] {
  if (time <= frames[0].t) return frames[0].s;
  for (let i = 1; i < frames.length; i++) {
    if (time <= frames[i].t) {
      const previous = frames[i - 1];
      const ratio = (time - previous.t) / (frames[i].t - previous.t);
      return previous.s.map((value, index) => value + (frames[i].s[index] - value) * ratio);
    }
  }
  return frames.at(-1)!.s;
}

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const times = [...new Set([0, mouse.op, ...keys.p.k.map(k => k.t), ...keys.o.k.map(k => k.t)])].sort((a, b) => a - b);
  dot.animate(times.map(time => {
    const [x, y] = sample(keys.p.k, time);
    return { transform: `translate(${x}px, ${y}px)`, opacity: sample(keys.o.k, time)[0] / 100, offset: time / mouse.op };
  }), { duration: mouse.op / mouse.fr * 1000, iterations: Infinity, easing: 'linear' });
}

// Exact donor formula: 360 - 360 * scrollTop / (scrollHeight - innerHeight).
function updateScrollIndicator(): void {
  const extent = document.documentElement.scrollHeight - innerHeight;
  const fraction = extent > 0 ? Math.min(1, Math.max(0, scrollY / extent)) : 0;
  progress.style.strokeDashoffset = String(360 - 360 * fraction);
}
window.addEventListener('scroll', updateScrollIndicator, { passive: true });
window.addEventListener('resize', updateScrollIndicator);
updateScrollIndicator();
