import * as THREE from 'three';
import theatreState from '../public/assets/shopify/sidekick-timeline.json';

type Keyframe = {
  position: number;
  value: number;
  handles: number[];
  connectedRight?: boolean;
};
type Track = { __debugName: string; keyframes: Keyframe[] };

const sheet = theatreState.sheetsById.Scene;
const tracks = sheet.sequence.tracksByObject as unknown as Record<string, { trackData: Record<string, Track> }>;
const staticValues = sheet.staticOverrides.byObject;

function cubic(a: number, b: number, c: number, t: number): number {
  const inv = 1 - t;
  return 3 * inv * inv * t * a + 3 * inv * t * t * b + t * t * t * c;
}

// Theatre stores right handles on the first key and left handles on the next.
function interpolatePair(from: Keyframe, to: Keyframe, position: number): number {
  const fraction = THREE.MathUtils.clamp((position - from.position) / (to.position - from.position), 0, 1);
  const x1 = from.handles[2];
  const y1 = from.handles[3];
  const x2 = to.handles[0];
  const y2 = to.handles[1];
  let low = 0;
  let high = 1;
  for (let step = 0; step < 22; step++) {
    const middle = (low + high) * .5;
    if (cubic(x1, x2, 1, middle) < fraction) low = middle;
    else high = middle;
  }
  const eased = cubic(y1, y2, 1, (low + high) * .5);
  return THREE.MathUtils.lerp(from.value, to.value, eased);
}

export function sampleShopifyTrack(object: 'camera' | 'effects' | 'asset-1', path: string[], position: number): number {
  const name = `${object}:${JSON.stringify(path)}`;
  const track = Object.values(tracks[object].trackData).find(candidate => candidate.__debugName === name);
  if (!track || track.keyframes.length === 0) {
    let value: unknown = staticValues[object];
    for (const key of path) value = (value as Record<string, unknown> | undefined)?.[key];
    if (typeof value !== 'number') throw new Error(`Missing Shopify Theatre track: ${name}`);
    return value;
  }
  const frames = track.keyframes;
  if (position <= frames[0].position) return frames[0].value;
  if (position >= frames[frames.length - 1].position) return frames[frames.length - 1].value;
  for (let index = 0; index < frames.length - 1; index++) {
    if (position <= frames[index + 1].position) return interpolatePair(frames[index], frames[index + 1], position);
  }
  return frames[frames.length - 1].value;
}

// Derived from hg in Effects-WhEp4HUr.js and Tn's section progress:
// for a Sidekick section entering from below, one viewport of scroll equals
// one Theatre sequence unit; at sectionTop == scrollY the sequence is 1.
export function shopifySequenceAtScroll(scrollY: number, sectionTop: number, viewportHeight: number): number {
  return Math.max(0, (scrollY + viewportHeight - sectionTop) / viewportHeight);
}

export type ShopifyCameraSample = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

export function sampleShopifyCamera(sequence: number): ShopifyCameraSample {
  const sampleVector = (property: 'position' | 'target') => new THREE.Vector3(
    sampleShopifyTrack('camera', [property, 'x'], sequence),
    sampleShopifyTrack('camera', [property, 'y'], sequence),
    sampleShopifyTrack('camera', [property, 'z'], sequence),
  );
  return {
    position: sampleVector('position'),
    target: sampleVector('target'),
    fov: sampleShopifyTrack('camera', ['fov'], sequence),
  };
}

export function sampleShopifyOverlay(sequence: number): number {
  return sampleShopifyTrack('effects', ['overlay', 'position'], sequence);
}

const gradients = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

// Exact 256×256, four-octave periodic gradient-noise algorithm from
// Background-CGKUhMwd.js (Tr / ap / Jn / tv / aI / oI / lI).
export function makeShopifyNoiseTexture(): THREE.DataTexture {
  const size = 256;
  const period = 8;
  const permutation = new Uint8Array(512);
  for (let index = 0; index < 256; index++) permutation[index] = index;
  for (let index = 255; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [permutation[index], permutation[other]] = [permutation[other], permutation[index]];
  }
  for (let index = 0; index < 256; index++) permutation[256 + index] = permutation[index];
  const fade = (value: number) => value * value * value * (value * (value * 6 - 15) + 10);
  const lerp = (from: number, to: number, value: number) => from + value * (to - from);
  const grad = (hash: number, x: number, y: number) => {
    const vector = gradients[hash & 7];
    return vector[0] * x + vector[1] * y;
  };
  const perlin = (x: number, y: number, repeat: number) => {
    const cellX = Math.floor(x) & 255;
    const cellY = Math.floor(y) & 255;
    const localX = x - Math.floor(x);
    const localY = y - Math.floor(y);
    const nextX = (cellX + 1) % repeat;
    const nextY = (cellY + 1) % repeat;
    const currentX = cellX % repeat;
    const currentY = cellY % repeat;
    const fadeX = fade(localX);
    const fadeY = fade(localY);
    const a = permutation[permutation[currentX] + currentY];
    const b = permutation[permutation[currentX] + nextY];
    const c = permutation[permutation[nextX] + currentY];
    const d = permutation[permutation[nextX] + nextY];
    return lerp(
      lerp(grad(a, localX, localY), grad(c, localX - 1, localY), fadeX),
      lerp(grad(b, localX, localY - 1), grad(d, localX - 1, localY - 1), fadeX),
      fadeY,
    );
  };
  const octaveNoise = (x: number, y: number) => {
    let value = 0;
    let amplitude = .5;
    let frequency = 1;
    let repeat = period;
    for (let octave = 0; octave < 4; octave++) {
      value += amplitude * perlin(x * frequency, y * frequency, repeat);
      amplitude *= .5;
      frequency *= 2;
      repeat *= 2;
    }
    return value;
  };
  const bytes = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const sample = Math.floor(THREE.MathUtils.clamp((octaveNoise(column / size * period, row / size * period) + 1) * .5 * 255, 0, 255));
    const offset = (row * size + column) * 4;
    bytes[offset] = bytes[offset + 1] = bytes[offset + 2] = sample;
    bytes[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
