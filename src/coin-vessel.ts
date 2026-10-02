import * as THREE from 'three';
type Coin={position:THREE.Vector3;velocity:THREE.Vector3;rotation:THREE.Quaternion;angular:THREE.Vector3;normal:THREE.Vector3;home:THREE.Vector3;spin:THREE.Quaternion;escaped:boolean;visible:boolean};
const COUNT=72,UP=new THREE.Vector3(0,1,0);

/** Original Finance coin geometry/UV/material. Its baked animation does not
 * include a vessel, so the cup uses analytic contacts and disk supports. */
export class CoinFlow {
  private coins:Coin[]=[];
  private inside:THREE.InstancedMesh;
  private outside:THREE.InstancedMesh;
  private align=new THREE.Quaternion();
  private dummy=new THREE.Object3D();
  private tmp=new THREE.Vector3();
  private delta=new THREE.Vector3();
  private contact=new THREE.Vector3();
  private local=new THREE.Vector3();
  private surfaceVelocity=new THREE.Vector3();
  private previousPoint=new THREE.Vector3();
  private rotation=new THREE.Quaternion();
  private inverse=new THREE.Matrix4();
  private previous=new THREE.Matrix4();
  private bowlRotation=new THREE.Quaternion();
  private scale=1;
  private radius=1;
  private halfHeight=1;
  private objectScale=1;
  private wasAtRest=true;
  private lastHit=0;
  readonly stats={inside:COUNT,airborne:0,recycled:0,impacts:0,emitting:false,physicsMs:0,lastSpawnLocal:[0,0,0]};
  readonly geometry:THREE.BufferGeometry;
  readonly material:THREE.MeshStandardMaterial;
  constructor(source:THREE.Mesh,private bowl:THREE.Group,scene:THREE.Scene,front:THREE.Scene){
    bowl.updateWorldMatrix(true,true);this.previous.copy(bowl.matrixWorld);
    const scale=new THREE.Vector3();bowl.getWorldScale(scale);this.scale=scale.x;
    this.radius=.079*this.scale;this.halfHeight=.009*this.scale;
    this.geometry=source.geometry.clone();this.geometry.center();this.geometry.computeBoundingBox();
    const size=this.geometry.boundingBox!.getSize(new THREE.Vector3()),dimensions=[size.x,size.y,size.z],axis=dimensions.indexOf(Math.min(...dimensions)),radius=Math.max(...dimensions)/2;
    if(axis===0)this.align.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    if(axis===2)this.align.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    const factors:[number,number,number]=[1,1,1];factors[axis]=Math.max(1,radius*.18/dimensions[axis]);this.geometry.scale(...factors);
    this.objectScale=this.radius/radius;
    this.material=(source.material as THREE.MeshStandardMaterial).clone();
    this.material.metalness=1;this.material.roughness=.23;this.material.envMapIntensity=.85;
    this.material.emissive.set(0);this.material.emissiveIntensity=0;this.material.color.set('#ffd477');
    this.material.bumpMap=this.material.map;this.material.bumpScale=.0015;
    this.material.side=THREE.FrontSide;this.material.transparent=false;this.material.alphaTest=0;
    this.inside=new THREE.InstancedMesh(this.geometry,this.material,COUNT);this.outside=new THREE.InstancedMesh(this.geometry,this.material,COUNT);
    for(const m of [this.inside,this.outside]){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;}
    scene.add(this.inside);front.add(this.outside);
    let i=0;
    for(const [layer,n] of [22,18,14,10,6,2].entries())for(let j=0;j<n;j++){
      const a=j*2.399963+layer*.43,r=Math.sqrt((j+.3)/n)*[.69,.60,.49,.37,.24,.08][layer];
      const home=new THREE.Vector3(Math.cos(a)*r,.01+layer*.077+.16*(r/.86)**2,Math.sin(a)*r);
      const spin=new THREE.Quaternion().setFromEuler(new THREE.Euler(.27+Math.sin(i*4.1)*.28,i*2.39996,Math.cos(i*3.2)*.3));
      this.coins.push({position:new THREE.Vector3(),velocity:new THREE.Vector3(),rotation:spin.clone(),angular:new THREE.Vector3(),normal:UP.clone(),home,spin,escaped:false,visible:true});i++;
    }
    this.reset();
  }
  private place(c:Coin,recycle=false):void {
    this.local.copy(c.home);if(recycle)this.local.set((Math.random()-.5)*.12,-.055,(Math.random()-.5)*.14);
    this.stats.lastSpawnLocal=this.local.toArray();c.position.copy(this.local).applyMatrix4(this.bowl.matrixWorld);
    c.rotation.copy(this.bowlRotation).multiply(c.spin);c.normal.copy(UP).applyQuaternion(c.rotation);
    c.velocity.set(0,0,0);c.angular.set(0,0,0);c.escaped=false;c.visible=true;
  }
  reset():void {
    this.bowl.updateWorldMatrix(true,false);this.bowl.getWorldQuaternion(this.bowlRotation);this.previous.copy(this.bowl.matrixWorld);
    for(const c of this.coins)this.place(c);this.stats.physicsMs=0;this.sync();
  }
  update(dt:number,_pose:number,emitting:boolean,rest:boolean):void {
    this.stats.emitting=emitting;
    if(rest){this.reset();this.wasAtRest=true;return;}
    this.bowl.updateWorldMatrix(true,false);this.bowl.getWorldQuaternion(this.bowlRotation);this.inverse.copy(this.bowl.matrixWorld).invert();
    if(this.wasAtRest){this.previous.copy(this.bowl.matrixWorld);this.wasAtRest=false;}
    const started=performance.now(),steps=2,h=Math.min(dt,.042)/steps;
    for(let step=0;step<steps;step++){
      for(const c of this.coins){
        if(!c.visible)continue;
        if(!emitting&&!c.escaped){c.visible=false;continue;}
        c.velocity.y-=3.1*h;c.velocity.multiplyScalar(1-.025*h);c.position.addScaledVector(c.velocity,h);
        if(!c.escaped)this.contactVessel(c,h*steps);
        const speed=c.angular.length();if(speed>.00001){this.tmp.copy(c.angular).multiplyScalar(1/speed);this.rotation.setFromAxisAngle(this.tmp,speed*h);c.rotation.premultiply(this.rotation).normalize();}
        c.angular.multiplyScalar(1-.09*h);c.normal.copy(UP).applyQuaternion(c.rotation);
        if(c.position.y< -5){if(emitting){this.place(c,true);this.stats.recycled++;}else c.visible=false;}
      }
      for(let i=0;i<COUNT;i++){
        const a=this.coins[i];if(!a.visible)continue;
        for(let j=i+1;j<COUNT;j++){
          const b=this.coins[j];if(!b.visible)continue;
          this.delta.subVectors(a.position,b.position);const dist2=this.delta.lengthSq();
          if(dist2>this.radius*this.radius*4||dist2<1e-10)continue;
          const dist=Math.sqrt(dist2);this.delta.multiplyScalar(1/dist);
          const na=Math.min(1,Math.abs(a.normal.dot(this.delta))),nb=Math.min(1,Math.abs(b.normal.dot(this.delta)));
          const support=this.radius*(Math.sqrt(1-na*na)+Math.sqrt(1-nb*nb))+this.halfHeight*(na+nb),overlap=support-dist;
          if(overlap<=0)continue;
          a.position.addScaledVector(this.delta,overlap*.47);b.position.addScaledVector(this.delta,-overlap*.47);
          const closing=this.tmp.subVectors(a.velocity,b.velocity).dot(this.delta);
          if(closing<0){a.velocity.addScaledVector(this.delta,-closing*.53);b.velocity.addScaledVector(this.delta,closing*.53);}
        }
      }
    }
    this.previous.copy(this.bowl.matrixWorld);this.stats.physicsMs=performance.now()-started;this.sync();
  }
  private contactVessel(c:Coin,dt:number):void {
    this.local.copy(c.position).applyMatrix4(this.inverse);const r=Math.hypot(this.local.x,this.local.z);
    if(r>.90){c.escaped=true;c.angular.set(3+c.home.z*5,1.4+c.home.x*3,4+c.home.y*4);return;}
    const y=-.156+.333*(r/.874)**1.83,slope=r>.001?.333*1.83/.874*(r/.874)**.83:0;
    this.contact.set(r>.001?-this.local.x/r*slope:0,1,r>.001?-this.local.z/r*slope:0).normalize();
    this.tmp.copy(this.contact).applyQuaternion(this.bowlRotation);
    const n=Math.min(1,Math.abs(c.normal.dot(this.tmp))),extent=this.radius*Math.sqrt(1-n*n)+this.halfHeight*n,penetration=(y-this.local.y)*this.scale*this.contact.y+extent;
    if(penetration<=0)return;
    c.position.addScaledVector(this.tmp,penetration);
    this.previousPoint.copy(this.local).applyMatrix4(this.previous);
    this.surfaceVelocity.copy(this.local).applyMatrix4(this.bowl.matrixWorld).sub(this.previousPoint).multiplyScalar(1/Math.max(dt,.008));
    this.delta.copy(c.velocity).sub(this.surfaceVelocity);const inward=this.delta.dot(this.tmp);
    if(inward<0)c.velocity.addScaledVector(this.tmp,-inward*1.06);
    this.delta.addScaledVector(this.tmp,-inward);c.velocity.addScaledVector(this.delta,-.022);
    c.angular.z+=this.delta.x*-.08;c.angular.x+=this.delta.z*.08;
  }
  private sync():void {
    let inside=0,outside=0;
    for(const c of this.coins){if(!c.visible)continue;this.dummy.position.copy(c.position);this.dummy.quaternion.copy(c.rotation).multiply(this.align);this.dummy.scale.setScalar(this.objectScale);this.dummy.updateMatrix();if(c.escaped)this.outside.setMatrixAt(outside++,this.dummy.matrix);else this.inside.setMatrixAt(inside++,this.dummy.matrix);}
    this.inside.count=inside;this.outside.count=outside;this.inside.instanceMatrix.needsUpdate=true;this.outside.instanceMatrix.needsUpdate=true;this.stats.inside=inside;this.stats.airborne=outside;
  }
  hit(x:number,y:number,mx:number,my:number,camera:THREE.Camera,width:number,height:number):boolean {
    if(this.wasAtRest||performance.now()-this.lastHit<75||Math.hypot(mx,my)<1)return false;
    let selected:Coin|undefined,nearest=38;
    for(const c of this.coins){if(!c.escaped||!c.visible)continue;this.tmp.copy(c.position).project(camera);const d=Math.hypot((this.tmp.x*.5+.5)*width-x,(-this.tmp.y*.5+.5)*height-y);if(d<nearest){nearest=d;selected=c;}}
    if(!selected)return false;
    selected.velocity.x+=THREE.MathUtils.clamp(mx,-30,30)*.05;selected.velocity.y-=THREE.MathUtils.clamp(my,-30,30)*.05;selected.angular.z+=mx*.2;this.lastHit=performance.now();this.stats.impacts++;return true;
  }
}
