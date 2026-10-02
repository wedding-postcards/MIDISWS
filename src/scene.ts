import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer, EffectPass, BloomEffect } from 'postprocessing';
import { CoinFlow } from './coin-overflow';
import { ScenePass } from './scene-pass';
import { Dust } from './dust';
import { sampleShopifyOverlay } from './shopify-motion';
import { sampleHeroSway } from './hero-motion';
import { softenGold, antiqueGold } from './gold-material';
import { assetUrl } from './asset-url';

type Rect={top:number;left:number;width:number;height:number};
type Options={
  trial10?:boolean;
  editorial?:boolean;
  frame:(now:number)=>number;
  onProgress:(scroll:number,intro:number)=>void;
  /** Measured document scroll positions, recalculated by the DOM on resize. */
  transition?:()=>{start:number;end:number};
  studyRect?:()=>Rect;
  wordmarkRect?:()=>Rect;
};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp=THREE.MathUtils.clamp;
const figurePoint=(x:number,y:number,z=0)=>new THREE.Vector3(-.04+(x/1030-.5)*(2.65*1030/1527),-.65+(.5-y/1527)*2.65,z);

const CAMERA_PITCH=Math.atan2(.91,6.5);
export class SceneExperience {
  private renderer:THREE.WebGLRenderer;
  private composer:EffectComposer;
  private camera=new THREE.PerspectiveCamera(25,1,.1,100);
  private artwork=new THREE.Scene();
  private backdrop?:THREE.Texture;
  private wordmark?:THREE.Mesh;
  private wordmarkOffset=new THREE.Vector3();
  private cameraFocus=new THREE.Vector3();
  private front=new THREE.Scene();
  private composition=new THREE.Group();
  private coinOccluders=new THREE.Group();
  private cupOccluder?:THREE.Group;
  private pass?:ScenePass;
  private dust?:Dust;
  private bowl?:THREE.Group;
  private pileSun=new THREE.SpotLight('#ffe6ae',20.4,0,.42,.85,2);
  private fallingSun=this.pileSun.clone();
  private goldStrip=new THREE.RectAreaLight('#ffe4ad',4.56,1.8,.18);
  private fallingStrip=this.goldStrip.clone();
  private pileSoftbox=new THREE.RectAreaLight('#ffe3a6',5.2,1.65,.9);
  private helmetSheen={value:0};
  private compositionRest=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-CAMERA_PITCH);
  private palm=new THREE.Vector3();
  private coinFlow?:CoinFlow;
  private pile=new THREE.Group();
  private coinStudy?:THREE.Mesh;
  private pointer=new THREE.Vector2();
  private smoothPointer=new THREE.Vector2();
  private grabbedPointer=-1;
  private lastFrame=0;
  private firstFrame=0;
  private frames:number[]=[];
  private temp=new THREE.Vector3();
  private temp2=new THREE.Vector3();
  private quaternion=new THREE.Quaternion();
  private adaptiveFrames=0;
  private coinRenderObjects:THREE.Object3D[]=[];
  private renderInvalidated=true;
  private wasIdle=false;
  private lastRenderedScroll=NaN;
  private lastRenderedCovered=false;
  private lastMedallionVisible=false;
  private lastStudyRect?:Rect;
  private currentIntro=0;
  private introFinished=false;
  private medallionAngle=0;
  private medallionTarget=0;
  private medallionIntro=0;
  private medallionFacing=new THREE.Quaternion();
  private medallionPointer=new THREE.Vector2();
  private medallionPointerTarget=new THREE.Vector2();
  private pointerSeen=false;
  readonly diagnostics={sequence:1,pose:0,intro:0,drawCalls:0,triangles:0,frameMs:0,pixelRatio:1.35,emitterScreen:[0,0],cameraPosition:[0,0,0],bowlUp:[0,1,0],coins:{} as object,renderPaused:false,medallionVisible:false,transitionProgress:0};

  constructor(canvas:HTMLCanvasElement,private options:Options){
    if(options.trial10){this.pileSoftbox.intensity*=1.1;this.pileSoftbox.width*=1.1;}
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.info.autoReset=false;
    this.composer=new EffectComposer(this.renderer,{frameBufferType:THREE.HalfFloatType,multisampling:0});
    this.artwork.background=new THREE.Color('#170f09');
    this.composition.scale.setScalar(1.55);this.composition.position.set(.45,.09,0);this.composition.rotation.x=-CAMERA_PITCH;this.artwork.add(this.composition);
    // Finance's studio environment supplies the reflection. A modest upper-left
    // key follows the painted scene, with no emissive gold or frontal flood.
    const key=new THREE.DirectionalLight('#ffe6b5',.36);key.position.set(.55,2,-1.8);
    this.artwork.add(key);this.front.add(key.clone());
    this.artwork.add(new THREE.AmbientLight('#ead8b9',.06));this.front.add(new THREE.AmbientLight('#ead8b9',.06));
    // A small warm source above and behind the bowl follows the painted sun.
    // No emissive metal or timed brightness pulses: facets reflect the source.
    RectAreaLightUniformsLib.init();
    // A broad upper-left reflection keeps several resting facets in light.
    // It stays in the cup pass; free-falling coins keep their approved lighting.
    this.artwork.add(this.pileSun,this.pileSun.target,this.goldStrip,this.pileSoftbox);
    this.front.add(this.fallingSun,this.fallingSun.target,this.fallingStrip);
    this.front.add(this.pile,this.coinOccluders);this.coinOccluders.matrixAutoUpdate=false;this.resize();
  }
  async load():Promise<void>{
    const draco=new DRACOLoader().setDecoderPath(assetUrl('decoders/draco/'));
    const ktx=new KTX2Loader().setTranscoderPath(assetUrl('decoders/basis/')).detectSupport(this.renderer);
    const loader=new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx),textures=new THREE.TextureLoader();
    const [painting,bg,mud,relief,bowl,finance,env,wordmarkGeometry]=await Promise.all([
      textures.loadAsync(assetUrl('assets/art/perseus-grip-clean-2026-10-02.png')),textures.loadAsync(assetUrl('assets/art/background.png')),textures.loadAsync(assetUrl('assets/shopify/mud_normal.webp')),
      fetch(assetUrl('assets/midis/perseus-relief-depth.json')).then(r=>r.json()),loader.loadAsync(assetUrl('assets/midis/bowl-v8.glb')),loader.loadAsync(assetUrl('assets/shopify/finance.glb')),ktx.loadAsync(assetUrl('assets/shopify/studio_small_09_1k.pmrem.ktx2')),
      this.options.wordmarkRect?new THREE.BufferGeometryLoader().loadAsync(assetUrl('assets/midis/wordmark-gold.json')):Promise.resolve(undefined),
    ]);
    env.mapping=THREE.CubeUVReflectionMapping;this.artwork.environment=env;this.front.environment=env;
    this.artwork.environmentRotation.set(.85,-1.3,0);this.front.environmentRotation.set(.85,-1.3,0);
    bg.colorSpace=THREE.SRGBColorSpace;bg.anisotropy=4;
    // A screen-filling backdrop, independent from the figure's camera dolly.
    // Cover crops the source proportionally, with only 2.5% parallax overscan.
    this.backdrop=bg;this.artwork.background=bg;
    if(wordmarkGeometry){
      const metal=new THREE.MeshStandardMaterial();
      antiqueGold(metal,'body',2.3);metal.roughness=.26;metal.envMapIntensity=1;
      this.wordmark=new THREE.Mesh(wordmarkGeometry,metal);
      this.wordmark.name='МИДИС — золотая надпись за Персеем';
      this.artwork.add(this.wordmark);
      document.body.classList.add('has-gold-wordmark');
    }
    painting.colorSpace=THREE.SRGBColorSpace;painting.anisotropy=4;
    // The user's second cutout places the same painting at (+176,+184)
    // inside a 1398×1711 canvas. Preserve its supplied alpha and closed grip.
    painting.repeat.set(1030/1398,1527/1711);painting.offset.set(176/1398,0);
    // One continuous projected surface retains every edge of the painting.
    // Its depth is sampled from hitem3d; no arm/neck/leg is cut into a new layer.
    const geometry=new THREE.PlaneGeometry(relief.width,relief.height,relief.columns,relief.rows);
    const positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const depth=relief.depth[i],r=depth/4.355;
      positions.setXYZ(i,(positions.getX(i)-.04)*(1-r)-.2903*r,(positions.getY(i)-.65)*(1-r)-.074*r,depth);
    }
    geometry.computeVertexNormals();
    const paintMaterial=new THREE.MeshBasicMaterial({map:painting,alphaTest:.025,transparent:true,depthWrite:true,side:THREE.DoubleSide,forceSinglePass:true});
    // Original user-supplied fingers remain in front of the 3D shaft.
    paintMaterial.onBeforeCompile=s=>{
      s.uniforms.uHelmetSheen=this.helmetSheen;
      s.vertexShader='varying vec2 vFigureUv;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFigureUv=uv;');
      s.fragmentShader='uniform float uHelmetSheen; varying vec2 vFigureUv;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`vec2 p=vec2(vFigureUv.x*1030.,(1.-vFigureUv.y)*1527.);
        if(p.x<310.&&p.y<163.)diffuseColor.a=0.;
        #include <alphatest_fragment>`);
      s.fragmentShader=s.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
        // Restrict the response to the already painted metal highlight.
        vec2 helmetP=(p-vec2(602.,196.))/vec2(27.,30.);
        float paintedMetal=exp(-dot(helmetP,helmetP)*2.7)*smoothstep(.32,.72,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
        gl_FragColor.rgb+=vec3(1.,.82,.52)*paintedMetal*uHelmetSheen;
        float gripFront=(1.-smoothstep(.90,1.,length((p-vec2(168.,214.))/vec2(40.,36.))))*smoothstep(178.,191.,p.y);
        gl_FragDepth=gl_FragCoord.z-gripFront*.00065;`);
    };
    // Keep the intact supplied index finger in a tiny foreground layer.
    // Reuse the exact original position and leave the underlying hand intact.
    // Subtracting and translating an oval mask erased the neighbouring finger.
    const compilePainting=paintMaterial.onBeforeCompile;
    const indexMask='1.-smoothstep(.90,1.,length((p-vec2(145.,182.))/vec2(16.,21.)))';
    const indexMaterial=paintMaterial.clone();
    indexMaterial.onBeforeCompile=(s,r)=>{
      compilePainting(s,r);
      s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>',`diffuseColor.a*=(${indexMask});\n#include <alphatest_fragment>`);
      s.fragmentShader=s.fragmentShader.replace('gl_FragDepth=gl_FragCoord.z-gripFront*.00065;','gl_FragDepth=gl_FragCoord.z-.00065;');
    };
    indexMaterial.customProgramCacheKey=()=> 'midis-index-finger-front-v2';
    paintMaterial.customProgramCacheKey=()=> 'midis-painted-grip-v8';
    this.composition.add(new THREE.Mesh(geometry,paintMaterial));
    const indexFinger=new THREE.Mesh(geometry,indexMaterial);indexFinger.renderOrder=5;this.composition.add(indexFinger);
    const depthPaint=paintMaterial.clone();depthPaint.colorWrite=false;depthPaint.transparent=false;depthPaint.onBeforeCompile=paintMaterial.onBeforeCompile;
    const depthFigure=new THREE.Mesh(geometry,depthPaint);depthFigure.renderOrder=-100;this.coinOccluders.add(depthFigure);
    const indexDepth=indexMaterial.clone();indexDepth.colorWrite=false;indexDepth.transparent=false;indexDepth.onBeforeCompile=indexMaterial.onBeforeCompile;indexDepth.customProgramCacheKey=indexMaterial.customProgramCacheKey;
    const depthIndex=new THREE.Mesh(geometry,indexDepth);depthIndex.position.copy(indexFinger.position);depthIndex.renderOrder=-100;this.coinOccluders.add(depthIndex);
    const handDepth=relief.depth[Math.round(226/1527*relief.rows)*(relief.columns+1)+Math.round(178/1030*relief.columns)];
    this.palm.copy(figurePoint(168,255,handDepth));const ratio=handDepth/4.355;this.palm.x=this.palm.x*(1-ratio)-.2903*ratio;this.palm.y=this.palm.y*(1-ratio)-.074*ratio;
    this.bowl=bowl.scene;this.bowl.scale.setScalar(.265);
    this.bowl.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;m.side=THREE.FrontSide;antiqueGold(m,m.name.includes('Burnished')?'edge':m.name.includes('Recess')?'recess':'body');}});
    this.placeBowl();
    this.composition.add(this.bowl);this.composition.updateWorldMatrix(true,true);this.bowl.getWorldPosition(this.cameraFocus);
    this.cupOccluder=this.bowl.clone(true);this.cupOccluder.traverse(o=>{if(o instanceof THREE.Mesh){const m=(o.material as THREE.MeshStandardMaterial).clone();m.colorWrite=false;m.transparent=false;o.material=m;o.renderOrder=-100;}});this.coinOccluders.add(this.cupOccluder);
    let source:THREE.Mesh|undefined;finance.scene.traverse(o=>{if(!source&&o instanceof THREE.Mesh&&o.name.includes('coin'))source=o;});
    if(!source)throw new Error('Finance coin mesh missing');
    const existingObjects=new Set([...this.artwork.children,...this.front.children]);
    this.coinFlow=new CoinFlow(source,this.bowl,this.artwork,this.front,this.options.trial10);
    this.coinRenderObjects=[...this.artwork.children,...this.front.children].filter(object=>!existingObjects.has(object));
    await this.coinFlow.initialize();
    if(this.options.editorial&&this.options.studyRect)this.makeMedallion();else if(!this.options.editorial)this.makeStudy(source);
    mud.wrapS=mud.wrapT=THREE.RepeatWrapping;
    this.pass=new ScenePass(this.artwork,this.front,this.camera,mud);this.dust=new Dust(this.artwork,this.pass.noise);
    this.composer.addPass(this.pass);
    this.composer.addPass(new EffectPass(this.camera,new BloomEffect({intensity:2,mipmapBlur:true,resolutionScale:.5,luminanceThreshold:1,luminanceSmoothing:.08})));
    this.resize();await this.renderer.compileAsync(this.artwork,this.camera);
    const studyVisible=this.pile.visible;if(this.options.editorial)this.pile.visible=true;
    await this.renderer.compileAsync(this.front,this.camera);this.pile.visible=studyVisible;
    // Compile postprocessing before removing the curtain; first scroll and
    // the first golden chapter should not pay shader-compilation costs.
    this.bowl.getWorldPosition(this.temp);this.pass.update(sampleShopifyOverlay(1),0,0,this.temp);this.composer.render(0);
    draco.dispose();ktx.dispose();
  }
  private placeBowl():void {
    this.bowl!.quaternion.copy(this.composition.quaternion).invert();
    this.temp.set(0,.65*.265,.014).applyQuaternion(this.bowl!.quaternion);
    this.bowl!.position.copy(this.palm).add(this.temp);
  }
  coinPositions():number[][] {return this.options.editorial&&this.diagnostics.transitionProgress>=1?[]:this.coinFlow?.screenCoins(this.camera,innerWidth,innerHeight)||[];}
  /** Radians: a click/key can use Math.PI / 3; drag supplies its own delta. */
  turnMedallion(delta:number):void {
    if(!this.options.editorial||!Number.isFinite(delta))return;
    this.medallionTarget+=clamp(delta,-Math.PI*2,Math.PI*2);
    if(reduced)this.medallionAngle=this.medallionTarget;
    this.renderInvalidated=true;
  }
  private makeMedallion():void {
    const geometry=this.coinFlow!.geometry,material=this.coinFlow!.material.clone();
    // The close-up has its own material: keep the approved heap/free-fall gold
    // untouched while making the larger minted face catch a broader reflection.
    material.envMapIntensity*=1.25;material.roughness=.23;
    geometry.computeBoundingBox();const size=geometry.boundingBox!.getSize(new THREE.Vector3());
    const dimensions=[size.x,size.y,size.z],axis=dimensions.indexOf(Math.min(...dimensions)),radius=Math.max(...dimensions)/2;
    // Reuse Finance's minted mesh and PBR material, without the old 170-coin pile.
    const medallion=new THREE.Mesh(geometry,material);medallion.scale.setScalar(1/radius);
    this.medallionFacing.setFromEuler(new THREE.Euler(axis===1?Math.PI/2:0,axis===0?Math.PI/2:0,0));
    medallion.quaternion.copy(this.medallionFacing);this.coinStudy=medallion;this.pile.add(medallion);
    // Local studio strip, switched by pile.visibility with the medallion. It is
    // never present while the hero or its falling coins are visible. The strip
    // stays still relative to the pile, so turning the coin moves its highlight.
    const strip=new THREE.RectAreaLight('#ffe2aa',1.1,2.5,.85);
    strip.position.set(-2,-.35,2.7);strip.lookAt(0,0,0);this.pile.add(strip);this.pile.visible=false;
  }
  private makeStudy(source:THREE.Mesh):void {
    const geo=this.coinFlow!.geometry,mat=this.coinFlow!.material.clone();mat.envMapIntensity=.6;mat.roughness=.28;softenGold(mat,1.05);
    geo.computeBoundingBox();const size=geo.boundingBox!.getSize(new THREE.Vector3());const dimensions=[size.x,size.y,size.z],axis=dimensions.indexOf(Math.min(...dimensions)),radius=Math.max(...dimensions)/2;
    const align=new THREE.Quaternion();if(axis===0)align.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);if(axis===2)align.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    const mesh=new THREE.InstancedMesh(geo,mat,170),dummy=new THREE.Object3D();
    for(let i=0;i<170;i++){
      const angle=i*2.399963,r=Math.sqrt((i%45+.5)/45)*(.93-Math.floor(i/45)*.19);
      dummy.position.set(Math.cos(angle)*r,Math.floor(i/45)*.043+Math.sin(i*8.17)*.025,Math.sin(angle)*r*.5);
      dummy.quaternion.setFromEuler(new THREE.Euler(Math.sin(i)*.2,i*.7,Math.cos(i*.8)*.14)).multiply(align);dummy.scale.setScalar(.105/radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    this.pile.add(mesh);
    const large=new THREE.Mesh(geo,mat);large.scale.setScalar(.19/radius);large.position.set(-.13,.60,.08);
    // The Finance coin's thin axis faces the visitor for legible original relief.
    large.rotation.set(axis===1?Math.PI/2:0,axis===0?Math.PI/2:0,-.16);this.coinStudy=large;this.pile.add(large);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.3,1.4),new THREE.ShaderMaterial({
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv; void main(){float d=length((vUv-.5)*2.);gl_FragColor=vec4(.09,.055,.018,.23*pow(1.-smoothstep(.05,1.,d),2.));}',
      transparent:true,depthWrite:false,
    }));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.075;this.pile.add(shadow);
    source.visible=false;
  }
  start():void {
    window.addEventListener('resize',this.resize);window.addEventListener('pointermove',this.move,{passive:true});
    window.addEventListener('pointerdown',this.grab);window.addEventListener('pointerup',this.release);
    window.addEventListener('pointercancel',this.release);window.addEventListener('blur',this.release);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.release();this.wasIdle=true;}this.renderInvalidated=true;});
    requestAnimationFrame(this.tick);
  }
  private grab=(event:PointerEvent):void=>{
    if(reduced||document.hidden||event.pointerType==='touch'||event.button!==0||this.grabbedPointer>=0)return;
    const {start}=this.transitionRange();
    if(this.options.editorial?(scrollY>=start||this.currentIntro<=.4):scrollY>=innerHeight*2.03)return;
    if(this.modalOpen()||event.target instanceof Element&&event.target.closest('a,button,input,textarea,select,label,summary,header,nav,dialog,[role="dialog"],[role="button"],[role="menu"],[contenteditable],[data-scene-ui],[data-ui]'))return;
    if(this.coinFlow?.beginGrab(event.clientX,event.clientY,this.camera,innerWidth,innerHeight)){
      event.preventDefault();this.grabbedPointer=event.pointerId;
      document.documentElement.setPointerCapture(event.pointerId);document.documentElement.classList.add('coin-is-grabbed');
    }
  };
  private release=():void=>{
    this.coinFlow?.endGrab();
    if(this.grabbedPointer>=0&&document.documentElement.hasPointerCapture(this.grabbedPointer))document.documentElement.releasePointerCapture(this.grabbedPointer);
    this.grabbedPointer=-1;document.documentElement.classList.remove('coin-is-grabbed');
  };
  private move=(event:PointerEvent):void=>{
    if(reduced||event.pointerType==='touch')return;
    this.pointerSeen=true;
    if(event.pointerId===this.grabbedPointer){if(event.buttons!==1)this.release();else this.coinFlow?.moveGrab(event.clientX,event.clientY);}
    else this.pointer.set(event.clientX/innerWidth*2-1,-(event.clientY/innerHeight*2-1));
  };
  private resize=():void=>{
    this.release();this.renderInvalidated=true;
    this.renderer.setSize(innerWidth,innerHeight,false);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.composer.setSize(innerWidth,innerHeight);
  };
  private transitionRange():{start:number;end:number} {
    const range=this.options.transition?.(),fallback={start:innerHeight*1.32,end:innerHeight*2.37};
    if(!range||!Number.isFinite(range.start)||!Number.isFinite(range.end))return fallback;
    const start=Math.max(0,range.start);return {start,end:Math.max(start+1,range.end)};
  }
  private modalOpen():boolean {
    return Array.from(document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"]')).some(element=>element.getClientRects().length>0);
  }
  private updateMedallion(dt:number,rect:Rect):boolean {
    const oldAngle=this.medallionAngle,oldIntro=this.medallionIntro,oldX=this.medallionPointer.x,oldY=this.medallionPointer.y;
    if(reduced){this.medallionAngle=this.medallionTarget;this.medallionIntro=1;this.medallionPointer.set(0,0);}
    else {
      this.medallionAngle=THREE.MathUtils.lerp(this.medallionAngle,this.medallionTarget,1-Math.exp(-dt/.16));
      if(Math.abs(this.medallionAngle-this.medallionTarget)<.0005)this.medallionAngle=this.medallionTarget;
      this.medallionIntro=THREE.MathUtils.lerp(this.medallionIntro,1,1-Math.exp(-dt/.16));
      if(this.medallionIntro>.999)this.medallionIntro=1;
      const x=(this.pointer.x*.5+.5)*innerWidth,y=(.5-this.pointer.y*.5)*innerHeight;
      this.medallionPointerTarget.set(0,0);
      if(this.pointerSeen&&x>=rect.left&&x<=rect.left+rect.width&&y>=rect.top&&y<=rect.top+rect.height)this.medallionPointerTarget.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
      this.medallionPointer.lerp(this.medallionPointerTarget,1-Math.exp(-dt/.13));
      if(this.medallionPointer.distanceToSquared(this.medallionPointerTarget)<.000001)this.medallionPointer.copy(this.medallionPointerTarget);
    }
    return oldAngle!==this.medallionAngle||oldIntro!==this.medallionIntro||oldX!==this.medallionPointer.x||oldY!==this.medallionPointer.y;
  }
  private screenPoint(x:number,y:number,z:number,out:THREE.Vector3):THREE.Vector3 {
    out.set(x/innerWidth*2-1,1-y/innerHeight*2,.5).unproject(this.camera).sub(this.camera.position);
    return out.multiplyScalar((z-this.camera.position.z)/out.z).add(this.camera.position);
  }
  private tick=(now:number):void=>{
    // Keep the DOM/Lenis clock alive even when the GPU and physics are idle.
    requestAnimationFrame(this.tick);
    if(!this.firstFrame)this.firstFrame=now;
    const elapsed=(now-this.firstFrame)/1000,rawDt=this.lastFrame?(now-this.lastFrame)/1000:1/60,dt=this.wasIdle?1/60:Math.min(rawDt,.05);this.lastFrame=now;
    const scroll=this.options.frame(now),sequence=1+scroll/innerHeight;
    const intro=reduced?1:clamp(elapsed/2.5,0,1);this.currentIntro=intro;this.options.onProgress(scroll,intro);
    const editorial=!!this.options.editorial,{start,end}=this.transitionRange();
    const transition=editorial?clamp((scroll-start)/(end-start),0,1):0,covered=editorial&&transition>=1;
    const studyRect=this.options.studyRect?.();
    const studyInView=!!studyRect&&studyRect.width>0&&studyRect.height>0&&studyRect.top<innerHeight&&studyRect.top+studyRect.height>0&&studyRect.left<innerWidth&&studyRect.left+studyRect.width>0;
    const medallionVisible=editorial&&covered&&studyInView;
    Object.assign(this.diagnostics,{sequence,intro,transitionProgress:transition,medallionVisible});
    if(document.hidden){this.release();this.wasIdle=true;this.diagnostics.renderPaused=true;this.diagnostics.drawCalls=0;this.diagnostics.triangles=0;return;}
    if(this.grabbedPointer>=0&&((editorial&&scroll>=start)||(!editorial&&scroll>=innerHeight*2.03)||this.modalOpen()))this.release();
    const medallionChanged=medallionVisible?this.updateMedallion(dt,studyRect!):false;
    const boundsChanged=medallionVisible&&(!this.lastStudyRect||studyRect!.top!==this.lastStudyRect.top||studyRect!.left!==this.lastStudyRect.left||studyRect!.width!==this.lastStudyRect.width||studyRect!.height!==this.lastStudyRect.height);
    const activeHero=!covered&&(!reduced||!editorial||scroll!==this.lastRenderedScroll);
    const needsRender=this.renderInvalidated||!this.introFinished||activeHero||covered!==this.lastRenderedCovered||medallionVisible!==this.lastMedallionVisible||medallionChanged||boundsChanged;
    if(!needsRender){this.wasIdle=true;this.diagnostics.renderPaused=true;this.diagnostics.drawCalls=0;this.diagnostics.triangles=0;return;}
    this.diagnostics.renderPaused=false;
    const scrollVh=sequence-1;
    // A restrained pullback gives the figure depth through both text beats.
    // The backdrop remains independently fitted; the lower crop stays below view.
    // Lenis already smooths the scroll. A continuous position mapping avoids
    // the donor camera's hold segment and never stops before the wipe ends.
    const cameraProgress=clamp(scroll/Math.max(end,1),0,1);
    const dolly=reduced?0:cameraProgress;
    // Fit the intact tableau on narrow portrait screens, keeping the cup near
    // the upper fifth. Only the camera changes; hand/cup/coin coordinates stay
    // together. Desktop and the legacy variant retain their approved framing.
    const portrait=editorial&&innerWidth<761&&innerHeight>innerWidth;
    const portraitWidth=2.7,viewAspect=innerWidth/innerHeight;
    const cameraDistance=portrait?Math.max(6.5,portraitWidth/(2*Math.tan(THREE.MathUtils.degToRad(10.5))*viewAspect)):6.5;
    const cameraCenterX=portrait?.22:0,cameraTargetY=portrait?.7-.3*(portraitWidth/viewAspect):-.03,pointerScale=portrait?.28:1;
    const pullback=editorial&&!reduced?(portrait?.035:.065)*dolly:0;
    const retreat=reduced?0:editorial?(cameraDistance-this.cameraFocus.z)*pullback:THREE.MathUtils.smoothstep(scrollVh,.15,1.4)*.18;
    this.camera.fov=21;this.camera.updateProjectionMatrix();
    this.smoothPointer.lerp(this.pointer,reduced?0:1-Math.pow(.9,dt*60));
    // Source pan/tilt are camera angles, not tiny position offsets. The
    // restrained orbit restores visible depth while keeping the hand intact.
    const pointerX=covered||reduced?0:this.smoothPointer.x*pointerScale,pointerY=covered||reduced?0:this.smoothPointer.y*pointerScale;
    const cameraPan=0,cameraLift=-cameraDistance*Math.tan(THREE.MathUtils.degToRad(10.5))*pullback*.75;
    this.camera.position.set(cameraCenterX+cameraPan+pointerX*.23,.88+cameraLift+pointerY*.105,cameraDistance+retreat);this.camera.lookAt(cameraCenterX+cameraPan+pointerX*.03,cameraTargetY+cameraLift,editorial?retreat:0);this.camera.updateMatrixWorld();
    if(this.wordmark&&this.options.wordmarkRect){
      const rect=this.options.wordmarkRect();
      this.wordmark.visible=!covered&&rect.top+rect.height>0&&rect.top<innerHeight;
      if(this.wordmark.visible){
        // Place genuine bevelled lettering on a plane behind the whole relief.
        // The DOM supplies only the scroll trajectory and accessible heading.
        const distance=cameraDistance+2.5;
        const pixel=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))*distance/innerHeight;
        this.wordmarkOffset.set((rect.left+rect.width*.5-innerWidth*.5)*pixel,(innerHeight*.5-rect.top-rect.height*.5)*pixel,-distance).applyQuaternion(this.camera.quaternion);
        this.wordmark.position.copy(this.camera.position).add(this.wordmarkOffset);
        this.wordmark.quaternion.copy(this.camera.quaternion);
        this.wordmark.scale.setScalar(rect.width*pixel);
      }
    }
    // The sky does not zoom with Perseus. Use the whole 2048×1152 source
    // wherever the viewport permits, with a few pixels of independent drift.
    if(this.backdrop){
      const cropX=Math.min(1,viewAspect/(16/9))/1.025,cropY=Math.min(1,(16/9)/viewAspect)/1.025;
      this.backdrop.repeat.set(cropX,cropY);
      this.backdrop.offset.set((1-cropX)*.5+pointerX*.003+dolly*.004,(1-cropY)*.5+pointerY*.002+dolly*.003);
    }
    const pose=sampleHeroSway(reduced?0:editorial?cameraProgress*1.5:scrollVh,this.quaternion);
    this.composition.quaternion.copy(this.compositionRest).multiply(this.quaternion);
    this.composition.position.y=.09+pose*.021;this.placeBowl();this.composition.updateWorldMatrix(true,true);
    // Restore hero/cup depth before the foreground coin pass, so coins
    // spilling off the far rim cannot be painted over the near wall or arm.
    this.artwork.visible=!covered;
    this.coinRenderObjects.forEach(object=>{object.visible=!covered;});
    this.coinOccluders.visible=editorial?!covered:scrollVh<2.03;this.coinOccluders.matrix.copy(this.composition.matrixWorld);this.coinOccluders.matrixWorldNeedsUpdate=true;
    if(this.cupOccluder){this.cupOccluder.position.copy(this.bowl!.position);this.cupOccluder.quaternion.copy(this.bowl!.quaternion);}
    if(!covered)this.coinFlow!.update(dt,(editorial||scrollVh<2.03)&&intro>.4,!reduced&&intro>.4);
    this.dust!.update(reduced?0:elapsed);
    this.bowl!.getWorldPosition(this.temp);
    this.pileSun.position.copy(this.temp).add(this.temp2.set(.55,1.6,-1.8));
    this.pileSun.target.position.copy(this.temp);
    this.fallingSun.position.copy(this.pileSun.position);this.fallingSun.target.position.copy(this.temp).y-=.65;
    this.goldStrip.position.copy(this.temp).add(this.temp2.set(.45,1.1,-1.4));
    this.goldStrip.lookAt(this.temp);
    this.fallingStrip.position.copy(this.goldStrip.position);this.fallingStrip.quaternion.copy(this.goldStrip.quaternion);
    this.pileSoftbox.position.copy(this.temp).add(this.temp2.set(-.85,1.15,-1.35));
    this.pileSoftbox.lookAt(this.temp);
    this.helmetSheen.value=reduced?.12:.035+.32*Math.pow(Math.max(0,1-Math.abs(this.smoothPointer.x+.12)*1.5),5);
    const wipeSequence=editorial?(transition===0?1:1.567+transition*1.266):scrollVh<1.32?1:1.567+(scrollVh-1.32)/1.05*1.266;
    // Reduced motion uses a static painting and a plain opacity transition.
    // At full coverage restore the canvas for the independent large coin.
    if(editorial)this.renderer.domElement.style.opacity=reduced&&!covered?String(1-THREE.MathUtils.smoothstep(transition,0,1)):'1';
    const overlayPosition=editorial&&reduced?(covered?0:-1):sampleShopifyOverlay(wipeSequence);
    this.pass!.update(overlayPosition,editorial&&reduced?0:elapsed,intro,this.temp);
    this.temp.project(this.camera);this.diagnostics.emitterScreen=[(this.temp.x*.5+.5)*innerWidth,(-this.temp.y*.5+.5)*innerHeight];
    this.pile.visible=editorial?medallionVisible:studyInView&&scrollVh>2.22;
    if(this.pile.visible&&studyRect){
      const r=studyRect;
      if(editorial){
        const reveal=1-this.medallionIntro,centerX=r.left+r.width*.5+reveal*r.width*.09,centerY=r.top+r.height*.5+reveal*r.height*.035;
        this.screenPoint(centerX,centerY,.4,this.temp);this.pile.position.copy(this.temp);
        this.screenPoint(centerX+Math.min(r.width,r.height)*.38,centerY,.4,this.temp2);this.pile.scale.setScalar(this.temp.distanceTo(this.temp2));
        this.pile.rotation.set(0,0,0);
        this.quaternion.setFromEuler(new THREE.Euler(.22+this.medallionPointer.y*.12,this.medallionAngle-.65-reveal*.65+this.medallionPointer.x*.2,-.16-reveal*.28));
        this.coinStudy!.quaternion.copy(this.quaternion).multiply(this.medallionFacing);
      }else {
        this.screenPoint(r.left+r.width*.51,r.top+r.height*.64,.4,this.temp);this.pile.position.copy(this.temp);
        this.screenPoint(r.left+r.width*.92,r.top+r.height*.64,.4,this.temp2);this.pile.scale.setScalar(this.temp.distanceTo(this.temp2));
        this.pile.rotation.set(.27,-.25+this.smoothPointer.x*.07,0);
        if(this.coinStudy)this.coinStudy.rotation.y=.4+Math.sin(elapsed*.28)*.23;
      }
    }
    this.renderer.info.reset();this.composer.render(dt);this.introFinished=intro>=1;
    this.frames.push(rawDt*1000);if(this.frames.length>90)this.frames.shift();
    if(!this.wasIdle&&elapsed>5&&sequence<2.7&&rawDt>.035)this.adaptiveFrames++;else this.adaptiveFrames=Math.max(0,this.adaptiveFrames-1);
    if(this.adaptiveFrames>60&&this.renderer.getPixelRatio()>1){this.renderer.setPixelRatio(1);this.resize();this.adaptiveFrames=0;}
    this.bowl!.getWorldQuaternion(this.quaternion);this.temp.set(0,1,0).applyQuaternion(this.quaternion);
    Object.assign(this.diagnostics,{sequence,pose,intro,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,frameMs:this.frames.reduce((a,b)=>a+b,0)/this.frames.length,pixelRatio:this.renderer.getPixelRatio(),cameraPosition:this.camera.position.toArray(),bowlUp:this.temp.toArray(),coins:this.coinFlow!.stats});
    this.renderInvalidated=false;this.lastRenderedScroll=scroll;this.lastRenderedCovered=covered;this.lastMedallionVisible=medallionVisible;this.lastStudyRect=studyRect?{...studyRect}:undefined;this.wasIdle=false;
  };
}
