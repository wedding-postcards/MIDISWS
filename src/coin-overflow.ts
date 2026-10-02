import * as THREE from 'three';
import {softenGold} from './gold-material';
import {sweptEllipseDistance} from './pointer-contact';

const CAPACITY=1100,RADIUS=.094,THICKNESS=.023;

/** Finance geometry and UVs, with a live rigid-body reservoir. Physics runs
 * in a worker; the render thread interpolates the entire heap, not a bed of
 * static decorations. Escaped coins retain the transform at their rim exit. */
export class CoinFlow {
  private worker=new Worker(new URL('./abundance.worker.ts',import.meta.url),{type:'module'});
  private inside:THREE.InstancedMesh;
  private outside:THREE.InstancedMesh;
  private previous=new Float32Array(0);
  private next=new Float32Array(0);
  private rendered=new Float32Array(CAPACITY*8);
  private origins=Array.from({length:CAPACITY},()=>new THREE.Matrix4());
  private states=new Uint8Array(CAPACITY);
  private dummy=new THREE.Object3D();
  private align=new THREE.Quaternion();
  private rotation=new THREE.Quaternion();
  private other=new THREE.Quaternion();
  private bowlRotation=new THREE.Quaternion();
  private bowlInverse=new THREE.Matrix4();
  private temp=new THREE.Vector3();
  private color=new THREE.Color();
  private objectScale=1;
  private busy=false;
  private dt=0;
  private openingTime=0;
  private lastUpdate=0;
  private interval=16.667;
  private contactUntil=new Float64Array(CAPACITY);
  private pointerCamera?:THREE.Camera;
  private viewportWidth=1;
  private viewportHeight=1;
  private normal=new THREE.Vector3();
  private viewDirection=new THREE.Vector3();
  private cameraRight=new THREE.Vector3();
  private cameraUp=new THREE.Vector3();
  private inverseOrigin=new THREE.Matrix4();
  private originRotation=new THREE.Quaternion();
  private originAxes=new THREE.Matrix4();
  private viewPosition=new THREE.Vector3();
  private ray=new THREE.Raycaster();
  private dragPlane=new THREE.Plane();
  private dragOffset=new THREE.Vector3();
  private dragPoint=new THREE.Vector3();
  private dragPointer=new THREE.Vector2();
  private held=-1;
  private animate=false;
  private emitting=true;
  private ready?:()=>void;
  readonly stats={inside:0,airborne:0,emerging:0,bed:0,born:0,rimExits:0,exitSides:[0,0,0,0],impacts:0,heapImpacts:0,grabbed:-1,releases:0,feedRate:20,openingTime:0,pointerMs:0,pointerCandidates:0,emitting:false,physicsMs:0,lastSpawnLocal:[0,0,0],maxExitUp:0,maxExitSpeed:0,movingInside:0};
  readonly geometry:THREE.BufferGeometry;
  readonly material:THREE.MeshStandardMaterial;

  constructor(source:THREE.Mesh,private bowl:THREE.Group,scene:THREE.Scene,front:THREE.Scene,private trial10=false){
    this.geometry=source.geometry.clone();this.geometry.center();this.geometry.computeBoundingBox();
    const size=this.geometry.boundingBox!.getSize(new THREE.Vector3()),dimensions=[size.x,size.y,size.z],axis=dimensions.indexOf(Math.min(...dimensions)),radius=Math.max(...dimensions)/2;
    if(axis===0)this.align.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    if(axis===2)this.align.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    const factors:[number,number,number]=[1,1,1];factors[axis]=radius/RADIUS*THICKNESS/dimensions[axis];this.geometry.scale(...factors);
    bowl.updateWorldMatrix(true,true);bowl.getWorldScale(this.temp);this.objectScale=RADIUS*this.temp.x/radius;
    this.material=(source.material as THREE.MeshStandardMaterial).clone();this.material.metalness=1;this.material.roughness=.23;this.material.envMapIntensity=1.25;
    this.material.emissive.set(0);this.material.emissiveIntensity=0;this.material.color.set('#ffdc89');this.material.side=THREE.FrontSide;this.material.transparent=false;this.material.alphaTest=0;
    const heapMaterial=this.material.clone();heapMaterial.envMapIntensity=2.35;heapMaterial.roughness=.165;softenGold(heapMaterial,8.2);
    this.bowlInverse.copy(bowl.matrixWorld).invert();
    const compileGold=heapMaterial.onBeforeCompile;
    heapMaterial.onBeforeCompile=(shader,renderer)=>{
      compileGold.call(heapMaterial,shader,renderer);
      shader.uniforms.uCupInverse={value:this.bowlInverse};
      shader.vertexShader='uniform mat4 uCupInverse; varying vec3 vCupPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
        vCupPosition=(uCupInverse*modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;`);
      shader.fragmentShader='varying vec3 vCupPosition;\n'+shader.fragmentShader;
      // Hide numerical contact penetration behind the solid metal wall.
      // Free-falling coins use their own material and normal scene depth.
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float cupRadius=length(vCupPosition.xz);
        float cupFloor=-.156+.333*pow(cupRadius/.874,1.83);
        if(cupRadius<.878&&vCupPosition.y<cupFloor-.006)discard;`);
    };
    heapMaterial.customProgramCacheKey=()=> 'midis-gold-inside-cup-v3';
    this.inside=new THREE.InstancedMesh(this.geometry,heapMaterial,CAPACITY);this.outside=new THREE.InstancedMesh(this.geometry,this.material,CAPACITY);
    for(const m of [this.inside,this.outside]){m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;}
    scene.add(this.inside);front.add(this.outside);
    this.worker.onmessage=event=>{
      const {data,stats,ready}=event.data;
      this.previous=this.next.length?this.next:data;this.next=data;
      const now=performance.now();this.interval=Math.max(16,Math.min(120,now-this.lastUpdate));this.lastUpdate=now;
      Object.assign(this.stats,stats);this.busy=false;if(ready){this.previous=data;this.sync(1);this.ready?.();}
    };
  }
  initialize():Promise<void>{return new Promise((resolve,reject)=>{this.ready=resolve;this.worker.onerror=e=>reject(new Error(e.message));this.worker.postMessage({type:'init',trial10:this.trial10});});}

  update(dt:number,emitting:boolean,animate:boolean):void {
    this.animate=animate;this.emitting=emitting||!animate;this.bowl.updateWorldMatrix(true,false);this.bowl.getWorldQuaternion(this.bowlRotation);this.bowlInverse.copy(this.bowl.matrixWorld).invert();
    if(animate){
      this.dt+=dt;if(emitting)this.openingTime+=dt;
      if(!this.busy){this.busy=true;this.worker.postMessage({type:'step',dt:Math.min(this.dt,.05),emitting,openingTime:this.openingTime});this.dt=0;}
    }
    this.sync(animate?THREE.MathUtils.clamp((performance.now()-this.lastUpdate)/this.interval,0,1):1,animate?dt:1);
    if(this.held>=0){if(!animate||!emitting)this.endGrab();else this.sendGrabTarget();}
  }

  private sync(alpha:number,dt=1):void {
    let inside=0,outside=0;const now=performance.now();
    this.bowl.getWorldQuaternion(this.bowlRotation);
    for(let i=0;i<this.next.length/8;i++){
      const j=i*8,state=this.next[j+7];if(!state){this.states[i]=0;continue;}
      const previous=this.previous.length>j+7&&this.previous[j+7]===state?this.previous:this.next;
      // Filter solver chatter only while a coin is supported by the pile.
      // The free-flight path retains the exact previous interpolation.
      const supported=state===1&&this.states[i]===1&&now>this.contactUntil[i],settle=1-Math.exp(-dt/.14);
      for(let k=0;k<3;k++){
        const target=THREE.MathUtils.lerp(previous[j+k],this.next[j+k],alpha);
        this.rendered[j+k]=supported?THREE.MathUtils.lerp(this.rendered[j+k],target,settle):target;
      }
      this.temp.fromArray(this.rendered,j);this.rotation.fromArray(previous,j+3);this.other.fromArray(this.next,j+3);this.rotation.slerp(this.other,alpha);
      if(supported){this.other.fromArray(this.rendered,j+3);this.rotation.copy(this.other.slerp(this.rotation,settle));}
      this.rotation.toArray(this.rendered,j+3);this.rendered[j+7]=state;
      if(state===2&&this.states[i]!==2)this.origins[i].copy(this.bowl.matrixWorld);
      this.states[i]=state;
      this.dummy.position.copy(this.temp).applyMatrix4(state===2?this.origins[i]:this.bowl.matrixWorld);
      if(state===2)this.originRotation.setFromRotationMatrix(this.originAxes.extractRotation(this.origins[i]));
      this.dummy.quaternion.copy(state===2?this.originRotation:this.bowlRotation).multiply(this.rotation).multiply(this.align);this.dummy.scale.setScalar(this.objectScale);this.dummy.updateMatrix();
      if(state===2)this.outside.setMatrixAt(outside++,this.dummy.matrix);
      else if(this.emitting){
        // A little contact occlusion gives the lower pile depth; upper coins
        // keep the unflattened studio reflections and intermittent bloom.
        const shade=THREE.MathUtils.lerp(.46,1,THREE.MathUtils.smoothstep(this.temp.y,-.06,.30));
        this.color.setRGB(shade,shade,shade);this.inside.setColorAt(inside,this.color);this.inside.setMatrixAt(inside++,this.dummy.matrix);
      }
    }
    this.inside.count=inside;this.outside.count=outside;this.inside.instanceMatrix.needsUpdate=true;this.outside.instanceMatrix.needsUpdate=true;if(this.inside.instanceColor)this.inside.instanceColor.needsUpdate=true;
  }
  screenCoins(camera:THREE.Camera,width:number,height:number):number[][]{
    const result:number[][]=[];for(let i=0;i<this.next.length/8;i++)if(this.states[i]===2){this.temp.fromArray(this.rendered,i*8).applyMatrix4(this.origins[i]).project(camera);result.push([(this.temp.x*.5+.5)*width,(.5-this.temp.y*.5)*height]);}return result;
  }
  beginGrab(x:number,y:number,camera:THREE.Camera,width:number,height:number):boolean {
    if(!this.animate||!this.emitting||this.held>=0)return false;
    const start=performance.now();
    this.pointerCamera=camera;this.viewportWidth=width;this.viewportHeight=height;
    this.cameraRight.setFromMatrixColumn(camera.matrixWorld,0);
    this.cameraUp.setFromMatrixColumn(camera.matrixWorld,1);
    const focal=camera.projectionMatrix.elements[5]*height*.5;
    const worldRadius=RADIUS*this.bowl.scale.x*this.bowl.parent!.scale.x;
    let selected=-1,nearest=Infinity,candidates=0;
    for(let i=0;i<this.next.length/8;i++){
      const state=this.states[i];if(!state)continue;
      const j=i*8;
      // The concealed feeder and supporting bed are never grabbed through metal.
      if(state===1&&this.rendered[j+1]<.16)continue;
      const transform=state===2?this.origins[i]:this.bowl.matrixWorld;
      this.temp.fromArray(this.rendered,j).applyMatrix4(transform);
      this.viewDirection.copy(camera.position).sub(this.temp).normalize();
      const depth=-this.viewPosition.copy(this.temp).applyMatrix4(camera.matrixWorldInverse).z;
      if(depth<=0)continue;
      this.rotation.fromArray(this.rendered,j+3);
      this.originRotation.setFromRotationMatrix(this.originAxes.extractRotation(transform));
      this.normal.set(0,1,0).applyQuaternion(this.rotation).applyQuaternion(this.originRotation);
      const facing=Math.abs(this.normal.dot(this.viewDirection)),nx=this.normal.dot(this.cameraRight),ny=-this.normal.dot(this.cameraUp);
      this.temp.project(camera);
      const sx=(this.temp.x*.5+.5)*width,sy=(.5-this.temp.y*.5)*height,radius=worldRadius*focal/depth;
      if(sx< -radius||sx>width+radius||sy< -radius||sy>height+radius)continue;
      // Only a button-down on the visible coin silhouette starts a grab.
      // One pixel accommodates its bevel; there is no surrounding force field.
      if(sweptEllipseDistance(x,y,x,y,sx,sy,nx,ny,radius+1,radius*Math.max(.13,facing)+1)>1)continue;
      candidates++;if(depth<nearest){selected=i;nearest=depth;}
    }
    this.stats.pointerCandidates=candidates;this.stats.pointerMs=performance.now()-start;
    if(selected<0)return false;
    this.held=selected;this.contactUntil[selected]=Infinity;
    const j=selected*8,state=this.states[selected],transform=state===2?this.origins[selected]:this.bowl.matrixWorld;
    this.temp.fromArray(this.rendered,j).applyMatrix4(transform);
    camera.getWorldDirection(this.normal);this.dragPlane.setFromNormalAndCoplanarPoint(this.normal,this.temp);
    this.dragPointer.set(x/width*2-1,1-y/height*2);this.ray.setFromCamera(this.dragPointer,camera);
    this.ray.ray.intersectPlane(this.dragPlane,this.dragPoint);this.dragOffset.copy(this.temp).sub(this.dragPoint);
    this.worker.postMessage({type:'grab',coin:{index:selected,state,x:this.rendered[j],y:this.rendered[j+1],z:this.rendered[j+2]}});
    return true;
  }

  moveGrab(x:number,y:number):void {
    if(this.held>=0)this.dragPointer.set(x/this.viewportWidth*2-1,1-y/this.viewportHeight*2);
  }

  private sendGrabTarget():void {
    const state=this.states[this.held];if(!state)return;
    this.ray.setFromCamera(this.dragPointer,this.pointerCamera!);
    if(this.ray.ray.intersectPlane(this.dragPlane,this.dragPoint)){
      this.dragPoint.add(this.dragOffset);
      this.inverseOrigin.copy(state===2?this.origins[this.held]:this.bowl.matrixWorld).invert();
      this.dragPoint.applyMatrix4(this.inverseOrigin);
      this.worker.postMessage({type:'grab-move',target:{x:this.dragPoint.x,y:this.dragPoint.y,z:this.dragPoint.z}});
    }
  }

  endGrab():void {
    if(this.held<0)return;
    this.sendGrabTarget();this.worker.postMessage({type:'grab-end'});
    this.contactUntil[this.held]=performance.now()+450;this.held=-1;
  }
}
