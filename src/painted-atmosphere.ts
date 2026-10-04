import * as THREE from 'three';

/** Local light inside the painting pass, so the paper edge covers it naturally. */
export class PaintedAtmosphere {
  readonly mesh: THREE.Mesh;
  private projected = new THREE.Vector3();
  private uniforms = {
    uSun: { value: new THREE.Vector2() },
    uCup: { value: new THREE.Vector2() },
    uAspect: { value: 1 },
    uTime: { value: 0 },
  };

  constructor() {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        varying vec2 vUv;
        uniform vec2 uSun,uCup;
        uniform float uAspect,uTime;
        void main(){
          vec2 sun=(vUv-uSun)*vec2(uAspect,1.);
          vec2 cup=(vUv-uCup)*vec2(uAspect,1.);
          // Broad, irregular haze, not an expanding ring or pulsing lamp.
          float drift=sin(sun.x*19.+sun.y*13.+uTime*.07)*.5
                     +sin(sun.x*31.-sun.y*17.-uTime*.045)*.25;
          float halo=exp(-dot(sun/vec2(.25,.17),sun/vec2(.25,.17))*1.8);
          float core=exp(-dot(sun/vec2(.105,.075),sun/vec2(.105,.075))*2.);
          float mist=halo*(.078+drift*.012)+core*.038;
          float bowl=exp(-dot(cup/vec2(.145,.032),cup/vec2(.145,.032))*2.)*.037;
          gl_FragColor=vec4(vec3(1.,.68,.31)*(mist+bowl),1.);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }));
    this.mesh.name = 'Свет нарисованного солнца и дымка у чаши';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  update(background: THREE.Texture, bowl: THREE.Object3D, camera: THREE.Camera, time: number): void {
    this.uniforms.uSun.value.set(
      (955.46 / 2048 - background.offset.x) / background.repeat.x,
      (1 - 180.63 / 1152 - background.offset.y) / background.repeat.y,
    );
    // Follow the rim, including the animated hand and pointer camera.
    this.projected.set(0, .055, 0);
    bowl.localToWorld(this.projected).project(camera);
    this.uniforms.uCup.value.set(this.projected.x * .5 + .5, this.projected.y * .5 + .5);
    this.uniforms.uAspect.value = innerWidth / innerHeight;
    this.uniforms.uTime.value = time;
  }
}
