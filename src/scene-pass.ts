import * as THREE from 'three';
import { Pass } from 'postprocessing';
import overlay from './overlay.original.frag?raw';
import reveal from './donor/crossfade.original.frag?raw';
import { makeShopifyNoiseTexture } from './shopify-motion';
import { IntroCover } from './intro-cover';

const vertex = `out vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const fullscreen = (code:string) => new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:vertex,fragmentShader:`precision highp float;in vec2 vUv;out vec4 fragColor;${code}`,depthTest:false,depthWrite:false,toneMapped:false});

/** The two donor shaders remain verbatim. HDR survives compositing until the
 * final Bloom + ToneMapping pass; this avoids the old clipped white metal. */
export class ScenePass extends Pass {
  private artworkTarget = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
  private revealTarget = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  private quadScene = new THREE.Scene();
  private quadCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2));
  private overlay = fullscreen(`uniform sampler2D tInput;${overlay}void main(){mainImage(texture(tInput,vUv),vUv,fragColor);}`);
  private reveal = fullscreen(`${reveal}void main(){mainImage(vec4(0.),vUv,fragColor);}`);
  private revealProgress = 0;
  private introCover?: IntroCover;
  readonly noise = makeShopifyNoiseTexture();
  constructor(private artwork:THREE.Scene,private front:THREE.Scene,private viewCamera:THREE.PerspectiveCamera,mud:THREE.Texture,artworkSamples=4) {
    super('Shopify CrossFade + Overlay + foreground');
    this.artworkTarget.samples=artworkSamples;
    const black = new THREE.DataTexture(new Uint8Array([23,15,9,255]),1,1,THREE.RGBAFormat);
    black.colorSpace=THREE.SRGBColorSpace; black.needsUpdate=true;
    this.overlay.uniforms={tInput:{value:this.artworkTarget.texture},tMudNormal:{value:mud},tNoise:{value:this.noise},uPosition:{value:-1},uTime:{value:0},uColor:{value:new THREE.Vector3(.86,.81,.69)},uResolution:{value:new THREE.Vector2(1,1)}};
    this.reveal.uniforms={tCurrent:{value:black},tNext:{value:this.artworkTarget.texture},tMudNormal:{value:mud},tNoise:{value:this.noise},uProgress:{value:0},uAspect:{value:1},uTime:{value:0},uResolution:{value:new THREE.Vector2(1,1)},uMouse:{value:new THREE.Vector2(.36,.65)},uIsHero:{value:1},uIsFallback:{value:0},uProjectionView:{value:new THREE.Matrix4()},uFadeCenterPoint:{value:new THREE.Vector3()},uDarken:{value:0}};
    this.quad.frustumCulled=false; this.quadScene.add(this.quad);
    const curtain=document.querySelector<HTMLCanvasElement>('#intro-cover');
    if(curtain)this.introCover=new IntroCover(curtain,this.reveal.uniforms);
  }
  update(position:number,time:number,intro:number,origin:THREE.Vector3):void {
    this.overlay.uniforms.uPosition.value=position;
    this.overlay.uniforms.uTime.value=time;
    this.revealProgress=intro;
    this.reveal.uniforms.uProgress.value=intro*1.5;
    this.reveal.uniforms.uTime.value=time;
    this.reveal.uniforms.uProjectionView.value.multiplyMatrices(this.viewCamera.projectionMatrix,this.viewCamera.matrixWorldInverse);
    this.reveal.uniforms.uFadeCenterPoint.value.copy(origin);
  }
  setSize(width:number,height:number):void {
    this.artworkTarget.setSize(width,height);this.revealTarget.setSize(width,height);
    this.overlay.uniforms.uResolution.value.set(width,height);
    this.reveal.uniforms.uResolution.value.set(width,height);this.reveal.uniforms.uAspect.value=width/height;
    this.introCover?.resize();
  }
  render(renderer:THREE.WebGLRenderer,_input:THREE.WebGLRenderTarget|null,output:THREE.WebGLRenderTarget|null):void {
    renderer.setRenderTarget(this.artworkTarget);renderer.clear();renderer.render(this.artwork,this.viewCamera);
    if(this.revealProgress<1){
      this.quad.material=this.reveal;renderer.setRenderTarget(this.revealTarget);renderer.clear();renderer.render(this.quadScene,this.quadCamera);
      this.overlay.uniforms.tInput.value=this.revealTarget.texture;
    } else this.overlay.uniforms.tInput.value=this.artworkTarget.texture;
    renderer.setRenderTarget(this.renderToScreen?null:output);renderer.clear();this.quad.material=this.overlay;renderer.render(this.quadScene,this.quadCamera);
    renderer.autoClear=false;renderer.clearDepth();renderer.render(this.front,this.viewCamera);renderer.autoClear=true;
    this.introCover?.render(this.revealProgress);
  }
}
