import * as THREE from 'three';
import originalFragment from './overlay.original.frag?raw';
import { makeShopifyNoiseTexture } from './shopify-motion';

const vertex = `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Original Shopify Overlay is kept verbatim in overlay.original.frag.
// This wrapper supplies EffectPass's inputColor/mainImage contract to Three.
const fragment = `
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;
  uniform sampler2D tInput;
  ${originalFragment}
  void main() {
    mainImage(texture(tInput, vUv), vUv, fragColor);
    fragColor = linearToOutputTexel(fragColor);
  }
`;

export class ShopifyOverlay {
  private target: THREE.WebGLRenderTarget;
  private effectScene = new THREE.Scene();
  private effectCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  readonly noise = makeShopifyNoiseTexture();

  constructor(renderer: THREE.WebGLRenderer, mud: THREE.Texture, gold: THREE.Vector3) {
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, {
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: {
        tInput: { value: this.target.texture },
        tMudNormal: { value: mud },
        tNoise: { value: this.noise },
        uPosition: { value: -1 },
        uTime: { value: 0 },
        uColor: { value: gold },
        uResolution: { value: size.clone() },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    screen.frustumCulled = false;
    this.effectScene.add(screen);
  }

  setPosition(value: number): void { this.material.uniforms.uPosition.value = value; }
  setTime(value: number): void { this.material.uniforms.uTime.value = value; }

  resize(renderer: THREE.WebGLRenderer): void {
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    this.target.setSize(size.x, size.y);
    this.material.uniforms.uResolution.value.copy(size);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(this.effectScene, this.effectCamera);
  }
}
