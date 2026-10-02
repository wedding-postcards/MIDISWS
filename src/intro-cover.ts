import * as THREE from 'three';
import reveal from './donor/crossfade.original.frag?raw';

/** The DOM is covered by the very same reveal field as the artwork. This
 * temporary surface uses the pass's uniforms, so there is no second clock. */
export class IntroCover {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private geometry = new THREE.PlaneGeometry(2, 2);
  private material: THREE.ShaderMaterial;
  private finished = false;

  constructor(private canvas: HTMLCanvasElement, uniforms: Record<string, THREE.IUniform>) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
    this.renderer.setClearColor(0, 0);
    // Keep the donor's complete threshold/noise calculation, stopping before
    // image mixing. Premultiplied alpha exposes both the scene and HTML below.
    const field = reveal.slice(0, reveal.indexOf('  // Edge mixing'));
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms,
      vertexShader: 'out vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `precision highp float;in vec2 vUv;out vec4 fragColor;${field}
        float cover=1.0-blendFactor;
        outputColor=vec4(vec3(23.0,15.0,9.0)/255.0*cover,cover);
      }
      void main(){mainImage(vec4(0.),vUv,fragColor);}`,
      depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.NoBlending,
    });
    const quad = new THREE.Mesh(this.geometry, this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.resize();
  }

  resize(): void {
    if (!this.finished) this.renderer.setSize(innerWidth, innerHeight, false);
  }

  render(progress: number): void {
    if (this.finished) return;
    if (progress >= 1) { this.finish(); return; }
    this.renderer.render(this.scene, this.camera);
    this.canvas.style.background = 'transparent';
  }

  private finish(): void {
    this.finished = true;
    this.canvas.remove();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    document.querySelectorAll<HTMLElement>('[data-intro-ui]').forEach(element => { element.inert = false; });
    document.body.classList.add('intro-complete');
  }
}
