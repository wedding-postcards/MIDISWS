import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { ShopifyOverlay } from './shopify-overlay';
import { sampleShopifyCamera, sampleShopifyOverlay, shopifySequenceAtScroll } from './shopify-motion';

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const readout = document.querySelector<HTMLElement>('#readout')!;
const title = document.querySelector<HTMLElement>('#title')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#080d1c');
const camera = new THREE.PerspectiveCamera(25, 1, .1, 100);
scene.add(new THREE.AmbientLight('#ffffff', 1));
const key = new THREE.DirectionalLight('#fff0cc', 2);
key.position.set(-2, 4, 3);
scene.add(key);
const pointer = new THREE.Vector2();
const smoothedPointer = new THREE.Vector2();
let overlay: ShopifyOverlay;
let lastTick = 0;

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  overlay?.resize(renderer);
}

function frame(now: number): void {
  const dt = lastTick ? Math.min((now - lastTick) / 1000, .05) : .016;
  lastTick = now;
  const sequence = shopifySequenceAtScroll(window.scrollY, 0, window.innerHeight);
  const track = sampleShopifyCamera(sequence);
  camera.fov = track.fov;
  camera.updateProjectionMatrix();
  smoothedPointer.lerp(pointer, 1 - Math.pow(.9, dt * 60));
  const pan = smoothedPointer.x * .05;
  const tilt = smoothedPointer.y * .05;
  // This is the direct-camera branch of Pa in Butterflies-DLjrCfBq.js.
  const direction = track.position.clone().sub(track.target).normalize();
  const distance = track.position.distanceTo(track.target);
  const rotated = new THREE.Vector3(
    (direction.x * Math.cos(-pan) - direction.z * Math.sin(-pan)) * Math.cos(-tilt),
    direction.y * Math.cos(-tilt) - Math.sin(-tilt),
    direction.x * Math.sin(pan) + direction.z * Math.cos(pan),
  ).normalize();
  camera.position.copy(track.target).add(rotated.multiplyScalar(distance));
  camera.lookAt(track.target);
  const wipe = sampleShopifyOverlay(sequence);
  overlay.setPosition(wipe);
  overlay.setTime(now * .001);
  overlay.render(renderer, scene, camera);
  readout.textContent = `Theatre ${sequence.toFixed(3)} · camera z ${track.position.z.toFixed(3)} · FOV ${track.fov.toFixed(2)} · overlay ${wipe.toFixed(3)}`;
  title.style.opacity = `${Math.max(0, Math.min(1, (1.5 - sequence) * 2))}`;
  requestAnimationFrame(frame);
}

async function init(): Promise<void> {
  resize();
  const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
  const draco = new DRACOLoader().setDecoderPath('/decoders/draco/');
  const loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2);
  const [portrait, stars, mud, sidekick] = await Promise.all([
    ktx2.loadAsync('/assets/shopify/sidekick_desktop.ktx2'),
    ktx2.loadAsync('/assets/shopify/sidekick_stars.ktx2'),
    new THREE.TextureLoader().loadAsync('/assets/shopify/mud_normal.webp'),
    loader.loadAsync('/assets/shopify/sidekick.glb'),
  ]);
  portrait.colorSpace = stars.colorSpace = THREE.SRGBColorSpace;
  portrait.flipY = false;
  stars.flipY = false;
  portrait.repeat.y = -1;
  portrait.offset.y = 1;
  portrait.needsUpdate = true;
  mud.wrapS = mud.wrapT = THREE.RepeatWrapping;
  const starPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ map: stars, transparent: true, toneMapped: false }));
  starPlane.position.z = -1;
  scene.add(starPlane);
  const portraitPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.8 * 890 / 1440), new THREE.MeshBasicMaterial({ map: portrait, transparent: true, depthWrite: false, toneMapped: false }));
  portraitPlane.position.y = -.3;
  scene.add(portraitPlane);
  scene.add(sidekick.scene);
  overlay = new ShopifyOverlay(renderer, mud, new THREE.Vector3(220 / 255, 220 / 255, 208 / 255));
  resize();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
window.addEventListener('pointermove', event => pointer.set(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1)));
init().catch(error => { readout.textContent = String(error); console.error(error); });
