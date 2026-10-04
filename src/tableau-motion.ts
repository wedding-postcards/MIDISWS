import * as THREE from 'three';
import { Pass } from 'postprocessing';

export type TableauFraming = {
  /** Cup centre in viewport fractions. Values outside 0..1 are intentional. */
  anchorX:number;
  anchorY:number;
  /** Exact projection zoom; does not rescale the cup or its physics. */
  scale:number;
};

export type FigureRegistration = {
  /** Map new image pixels into the original 1398x1711 canvas: old=scale*new+offset. */
  scale:number;
  offsetX:number;
  offsetY:number;
};

export type TableauPresentation = {
  framing:()=>TableauFraming;
  /** Scroll in viewport heights; retargets the existing authored root motion. */
  scrollProgress?:()=>number;
  motionStrength?:number;
  active?:()=>boolean;
  /** Restore the original registered painting and full-bleed backdrop. */
  fullPainting?:boolean;
  /** Flat, unlit lettering behind the painting in fullPainting mode. */
  wordmarkFlatColor?:string;
  /** Fade the exiting title before only small glyph fragments remain. */
  wordmarkOpacity?:()=>number;
  /** Subtle pigment variation sampled from the original painting backdrop. */
  paintedWordmark?:boolean;
  /** The original paper wipe, from 0 (painting) to 1 (fully covered). */
  wipeProgress?:()=>number;
  /** Same 1398x1711 canvas and registration as the original painting. */
  figureTexture?:string;
  figureRegistration?:FigureRegistration;
  /** Alpha channel of a registered RGBA cutout; its RGB is ignored. */
  figureAlphaTexture?:string;
  figureAlphaRegistration?:FigureRegistration;
};

/** Register without resampling the asset or changing the relief/grip UVs. */
export function registerFigureTexture(texture:THREE.Texture,registration?:FigureRegistration):void {
  if(!registration){texture.repeat.set(1030/1398,1527/1711);texture.offset.set(176/1398,0);return;}
  if(![registration.scale,registration.offsetX,registration.offsetY].every(Number.isFinite)||registration.scale<=0){
    throw new RangeError('Figure registration needs a positive scale and finite offsets.');
  }
  const image=texture.image as {width:number;height:number};
  if(!image||!Number.isFinite(image.width)||!Number.isFinite(image.height)||image.width<=0||image.height<=0){
    throw new RangeError('Figure registration requires a loaded image with dimensions.');
  }
  const width=image.width*registration.scale,height=image.height*registration.scale;
  texture.repeat.set(1030/width,1527/height);
  texture.offset.set((176-registration.offsetX)/width,1-(1711-registration.offsetY)/height);
}

/** A projection-only placement. Camera and world-space physics do not move. */
export function frameTableau(camera:THREE.PerspectiveCamera,cup:THREE.Vector3,width:number,height:number,framing:TableauFraming):void {
  if(![framing.anchorX,framing.anchorY,framing.scale].every(Number.isFinite)||framing.scale<=0){
    throw new RangeError('Tableau framing needs finite anchors and a positive scale.');
  }
  camera.clearViewOffset();
  camera.zoom=framing.scale;
  camera.aspect=width/height;
  camera.updateProjectionMatrix();
  const projected=cup.clone().project(camera);
  camera.setViewOffset(width,height,((projected.x*.5+.5)-framing.anchorX)*width,((.5-projected.y*.5)-framing.anchorY)*height,width,height);
}

/** Fit a centred camera-facing inscription despite projection zoom/offset. */
export function placeTableauWordmark(mesh:THREE.Mesh,camera:THREE.PerspectiveCamera,rect:{left:number;top:number;width:number;height:number},width:number,height:number,distance=9):void {
  const forward=camera.getWorldDirection(new THREE.Vector3());
  const onPlane=(x:number,y:number)=>{
    const ray=new THREE.Vector3(x/width*2-1,1-y/height*2,.5).unproject(camera).sub(camera.position);
    return ray.multiplyScalar(distance/ray.dot(forward)).add(camera.position);
  };
  const left=onPlane(rect.left,rect.top+rect.height*.5),right=onPlane(rect.left+rect.width,rect.top+rect.height*.5);
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox!;
  const scale=left.distanceTo(right)/(bounds.max.x-bounds.min.x);
  mesh.quaternion.copy(camera.quaternion);mesh.scale.setScalar(scale);
  mesh.position.copy(left).add(right).multiplyScalar(.5).sub(bounds.getCenter(new THREE.Vector3()).multiplyScalar(scale).applyQuaternion(mesh.quaternion));
}

/** Preserve transparent colour while rebuilding the cup/hand depth for coins. */
export class TableauPass extends Pass {
  constructor(private artwork:THREE.Scene,private front:THREE.Scene,private viewCamera:THREE.Camera,private opaque=false){
    super('Tableau and foreground coins');
  }

  render(renderer:THREE.WebGLRenderer,_input:THREE.WebGLRenderTarget|null,output:THREE.WebGLRenderTarget|null):void {
    const autoClear=renderer.autoClear;
    renderer.setRenderTarget(this.renderToScreen?null:output);
    renderer.setClearColor(0x000000,this.opaque?1:0);
    renderer.autoClear=false;
    renderer.clear();
    renderer.render(this.artwork,this.viewCamera);
    // The front scene contains the same depth-only figure and cup as before.
    renderer.clearDepth();
    renderer.render(this.front,this.viewCamera);
    renderer.autoClear=autoClear;
  }
}

const smooth=(value:number,from:number,to:number)=>THREE.MathUtils.smootherstep(value,from,to);
const shoulderPixel=new THREE.Vector2(465,418),elbowPixel=new THREE.Vector2(310,377),wristPixel=new THREE.Vector2(210,275);

function armBand(x:number,y:number,from:THREE.Vector2,to:THREE.Vector2,inner:number,outer:number):number {
  const dx=to.x-from.x,dy=to.y-from.y;
  const along=THREE.MathUtils.clamp(((x-from.x)*dx+(y-from.y)*dy)/(dx*dx+dy*dy),0,1);
  return 1-smooth(Math.hypot(x-from.x-along*dx,y-from.y-along*dy),inner,outer);
}

/** Painting pixel coordinates, before the registered texture crop. */
export function tableauMotionWeights(x:number,y:number):{head:number;body:number;shoulder:number;elbow:number} {
  // Head/torso breathing cannot stretch the independently registered grip.
  const armLock=smooth(x,350,470);
  const head=armLock*(1-smooth(y,375,485))*(1-smooth(x,850,965));
  const torsoRadius=Math.hypot((x-645)/300,(y-610)/370);
  const body=armLock*smooth(y,330,460)*(1-smooth(y,820,980))*(1-smooth(torsoRadius,.45,1));
  // A broad unit-weight plateau covers every finger, thumb and the wrist.
  // Blending starts outside the grip, so its entire surface stays rigid.
  const hand=(1-smooth(x,265,380))*(1-smooth(y,320,460));
  const upper=armBand(x,y,shoulderPixel,elbowPixel,70,145);
  const forearm=armBand(x,y,elbowPixel,wristPixel,60,125);
  const support=1-(1-hand)*(1-upper)*(1-forearm);
  const dx=wristPixel.x-elbowPixel.x,dy=wristPixel.y-elbowPixel.y;
  const along=((x-elbowPixel.x)*dx+(y-elbowPixel.y)*dy)/(dx*dx+dy*dy);
  const shoulder=support*(1-smooth(x,410,690));
  const elbow=support*(hand+(1-hand)*smooth(along,-.40,.65));
  return {head,body,shoulder,elbow};
}

/** Reversible deformation of one continuous mesh, shared by every depth pass. */
export class TableauMotion {
  private positions:THREE.BufferAttribute;
  private rest:Float32Array;
  private head:Float32Array;
  private body:Float32Array;
  private shoulder:Float32Array;
  private elbow:Float32Array;
  private headPivot=new THREE.Vector3();
  private bodyPivot=new THREE.Vector3();
  private shoulderPivot=new THREE.Vector3();
  private elbowPivot=new THREE.Vector3();
  private gripRotation=new THREE.Quaternion();
  private gripOffset=new THREE.Vector3();
  private lastTime=-1;
  private lastStrength=-1;
  private lastGesture=-1;
  private lastPose=0;

  constructor(geometry:THREE.BufferGeometry){
    this.positions=geometry.getAttribute('position') as THREE.BufferAttribute;
    this.positions.setUsage(THREE.DynamicDrawUsage);
    this.rest=new Float32Array(this.positions.array);
    this.head=new Float32Array(this.positions.count);
    this.body=new Float32Array(this.positions.count);
    this.shoulder=new Float32Array(this.positions.count);
    this.elbow=new Float32Array(this.positions.count);
    const uv=geometry.getAttribute('uv');
    let headDistance=Infinity,bodyDistance=Infinity,shoulderDistance=Infinity,elbowDistance=Infinity;
    for(let i=0;i<this.positions.count;i++){
      const x=uv.getX(i)*1030,y=(1-uv.getY(i))*1527;
      const weights=tableauMotionWeights(x,y);
      this.head[i]=weights.head;this.body[i]=weights.body;
      this.shoulder[i]=weights.shoulder;this.elbow[i]=weights.elbow;
      const dh=(x-630)**2+(y-405)**2,db=(x-650)**2+(y-865)**2;
      if(dh<headDistance){headDistance=dh;this.headPivot.fromBufferAttribute(this.positions,i);}
      if(db<bodyDistance){bodyDistance=db;this.bodyPivot.fromBufferAttribute(this.positions,i);}
      const ds=(x-shoulderPixel.x)**2+(y-shoulderPixel.y)**2,de=(x-elbowPixel.x)**2+(y-elbowPixel.y)**2;
      if(ds<shoulderDistance){shoulderDistance=ds;this.shoulderPivot.fromBufferAttribute(this.positions,i);}
      if(de<elbowDistance){elbowDistance=de;this.elbowPivot.fromBufferAttribute(this.positions,i);}
    }
    // A small conservative margin avoids culling a moving feather at the edge.
    geometry.computeBoundingSphere();
    if(geometry.boundingSphere)geometry.boundingSphere.radius+=.025;
  }

  /** Apply the same rigid two-joint transform used by every grip vertex. */
  applyGripTransform(point:THREE.Vector3,orientation?:THREE.Quaternion):void {
    point.applyQuaternion(this.gripRotation).add(this.gripOffset);
    orientation?.premultiply(this.gripRotation);
  }

  update(time:number,strength:number,gesture=0):number {
    if(!Number.isFinite(strength)||strength<0)throw new RangeError('Tableau motionStrength must be finite and non-negative.');
    if(this.lastTime===time&&this.lastStrength===strength&&this.lastGesture===gesture||strength===0&&this.lastStrength===0)return this.lastPose;
    if(strength===0){
      this.positions.copyArray(this.rest);this.positions.needsUpdate=true;
      this.gripRotation.identity();this.gripOffset.set(0,0,0);
      this.lastTime=time;this.lastStrength=0;this.lastGesture=gesture;this.lastPose=0;return 0;
    }
    const arrive=smooth(time,0,2.2)*strength;
    const breath=Math.sin(time*Math.PI*2/8.6)*arrive;
    const attention=(Math.sin(time*Math.PI*2/12.4+.35)-Math.sin(.35))*arrive;
    const directed=THREE.MathUtils.clamp(gesture,0,1)*arrive;
    const bodyAngle=breath*.006-directed*.004;
    const headAngle=attention*.022+directed*.010;
    // Virtual shoulder/elbow joints in the existing relief, not a new rig.
    // The elbow counter-rotates most of the shoulder turn: the held cup
    // remains almost upright, while the forearm describes a visible quiet arc.
    const shoulderAngle=breath*.030-directed*.006;
    const elbowAngle=-shoulderAngle*.94+Math.sin(time*Math.PI*2/10.8)*arrive*.002+directed*.001;
    const cb=Math.cos(bodyAngle),sb=Math.sin(bodyAngle),ch=Math.cos(headAngle),sh=Math.sin(headAngle);
    const cs=Math.cos(shoulderAngle),ss=Math.sin(shoulderAngle),ce=Math.cos(elbowAngle),se=Math.sin(elbowAngle);
    const ex=this.elbowPivot.x,ey=this.elbowPivot.y,sx=this.shoulderPivot.x,sy=this.shoulderPivot.y;
    const tx=ex*(1-ce)+ey*se,ty=ey*(1-ce)-ex*se;
    const gripAngle=shoulderAngle+elbowAngle;
    this.gripRotation.set(0,0,Math.sin(gripAngle/2),Math.cos(gripAngle/2));
    this.gripOffset.set(tx*cs-ty*ss+sx*(1-cs)+sy*ss,tx*ss+ty*cs+sy*(1-cs)-sx*ss,0);
    for(let i=0;i<this.positions.count;i++){
      const j=i*3,x=this.rest[j],y=this.rest[j+1],z=this.rest[j+2],h=this.head[i],b=this.body[i];
      const bx=x-this.bodyPivot.x,by=y-this.bodyPivot.y,hx=x-this.headPivot.x,hy=y-this.headPivot.y;
      // Elbow first, then its shoulder parent. Unit hand weights exactly
      // reproduce applyGripTransform; no texture or depth layer is detached.
      const e=this.elbow[i],s=this.shoulder[i];
      const ax=x+((x-ex)*(ce-1)-(y-ey)*se)*e,ay=y+((x-ex)*se+(y-ey)*(ce-1))*e;
      this.positions.setXYZ(i,
        ax+((ax-sx)*(cs-1)-(ay-sy)*ss)*s+(bx*(cb-1)-by*sb)*b+(hx*(ch-1)-hy*sh)*h,
        ay+((ax-sx)*ss+(ay-sy)*(cs-1))*s+(bx*sb+by*(cb-1))*b+(hx*sh+hy*(ch-1))*h,
        z+breath*.005*b+attention*.003*h,
      );
    }
    this.positions.needsUpdate=true;
    this.lastTime=time;this.lastStrength=strength;this.lastGesture=gesture;this.lastPose=headAngle;
    return headAngle;
  }
}
