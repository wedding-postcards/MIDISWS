import * as THREE from 'three';
import * as CANNON from 'cannon-es';

type Coin={body:CANNON.Body; escaped:boolean; visible:boolean; home:THREE.Vector3; spin:THREE.Quaternion};
const COUNT=88;
const q=(a:THREE.Quaternion)=>new CANNON.Quaternion(a.x,a.y,a.z,a.w);

export class CoinFlow {
  private world=new CANNON.World({gravity:new CANNON.Vec3(0,-2.4,0),allowSleep:true});
  private vessel=new CANNON.Body({type:CANNON.Body.KINEMATIC,mass:0});
  private coins:Coin[]=[];
  private inside:THREE.InstancedMesh;
  private outside:THREE.InstancedMesh;
  private align=new THREE.Quaternion();
  private dummy=new THREE.Object3D();
  private tmp=new THREE.Vector3();
  private rotation=new THREE.Quaternion();
  private scale=1;
  private objectScale=1;
  private running=false;
  private wasAtRest=true;
  private lastHit=0;
  readonly stats={inside:COUNT,airborne:0,recycled:0,impacts:0,emitting:false,physicsMs:0,lastSpawnLocal:[0,0,0]};
  readonly geometry:THREE.BufferGeometry;
  readonly material:THREE.MeshStandardMaterial;

  constructor(source:THREE.Mesh,private bowl:THREE.Group,scene:THREE.Scene,front:THREE.Scene){
    bowl.updateWorldMatrix(true,true);
    const worldScale=new THREE.Vector3();bowl.getWorldScale(worldScale);this.scale=worldScale.x;
    this.world.broadphase=new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations=7;
    this.world.defaultContactMaterial.friction=.075;this.world.defaultContactMaterial.restitution=.12;
    this.world.defaultContactMaterial.contactEquationStiffness=1e6;
    this.vessel.collisionFilterGroup=2;this.vessel.collisionFilterMask=1;this.makeVessel();this.world.addBody(this.vessel);
    this.geometry=source.geometry.clone();this.geometry.center();this.geometry.computeBoundingBox();
    const size=this.geometry.boundingBox!.getSize(new THREE.Vector3());const dimensions=[size.x,size.y,size.z];const axis=dimensions.indexOf(Math.min(...dimensions));const radius=Math.max(...dimensions)/2;
    if(axis===0)this.align.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);
    if(axis===2)this.align.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    // Keep the Finance bevel and UVs. Give its minted edge a readable thickness.
    const gs=[1,1,1];gs[axis]=Math.max(1,radius*.135/dimensions[axis]);this.geometry.scale(gs[0],gs[1],gs[2]);
    this.objectScale=.078*this.scale/radius;
    this.material=(source.material as THREE.MeshStandardMaterial).clone();
    this.material.metalness=1;this.material.roughness=.24;this.material.envMapIntensity=1;
    this.material.emissive.set(0);this.material.emissiveIntensity=0;this.material.color.set('#ffffff');
    this.material.side=THREE.FrontSide;this.material.transparent=false;this.material.alphaTest=0;this.material.needsUpdate=true;
    this.inside=new THREE.InstancedMesh(this.geometry,this.material,COUNT);this.outside=new THREE.InstancedMesh(this.geometry,this.material,COUNT);
    for(const mesh of [this.inside,this.outside]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;}
    scene.add(this.inside);front.add(this.outside);
    const grid:THREE.Vector3[]=[];
    for(let row=-5;row<=5;row++)for(let col=-5;col<=5;col++){
      const x=(col+row*.5)*.162,z=row*.1403;
      if(Math.hypot(x,z)<.72)grid.push(new THREE.Vector3(x,0,z));
    }
    grid.sort((a,b)=>a.lengthSq()-b.lengthSq());
    let index=0;
    for(const [layer,n] of [34,28,18,8].entries())for(let j=0;j<n;j++){
      const p=grid[j].clone();const r=Math.hypot(p.x,p.z);
      p.y=Math.max(-.115+.32*Math.pow(r/.86,1.8),-.035)+layer*.067+.025;
      const a=layer*.37;p.applyAxisAngle(new THREE.Vector3(0,1,0),a);
      const body=new CANNON.Body({mass:.007,shape:new CANNON.Cylinder(.078*this.scale,.078*this.scale,.0105*this.scale,12),linearDamping:.035,angularDamping:.04,sleepTimeLimit:.4,sleepSpeedLimit:.035});
      body.collisionFilterGroup=1;body.collisionFilterMask=3;this.world.addBody(body);
      const spin=new THREE.Quaternion().setFromEuler(new THREE.Euler((j%3-1)*.06,index*2.39996,(j%5-2)*.04));
      this.coins.push({body,escaped:false,visible:true,home:p,spin});index++;
    }
    this.reset();
  }
  private makeVessel():void {
    // The convex collision strips follow V2's actual interior profile.
    const profile=[[0,-.155],[.24,-.128],[.41,-.083],[.58,-.014],[.735,.075],[.872,.177]];
    const segments=16;
    for(let ring=0;ring<profile.length-1;ring++)for(let j=0;j<segments;j++){
      const a=j*Math.PI*2/segments,cs=Math.cos(a),sn=Math.sin(a);
      const [r0,y0]=profile[ring],[r1,y1]=profile[ring+1];const dr=r1-r0,dy=y1-y0,len=Math.hypot(dr,dy);
      const tangent=new THREE.Vector3(cs*dr/len,dy/len,sn*dr/len),normal=new THREE.Vector3(-cs*dy/len,dr/len,-sn*dy/len),edge=new THREE.Vector3(-sn,0,cs);
      const basis=new THREE.Matrix4().makeBasis(tangent,normal,edge);
      const r=(r0+r1)/2;
      this.vessel.addShape(new CANNON.Box(new CANNON.Vec3(len*this.scale*.52,.008*this.scale,r1*Math.PI/segments*this.scale*1.06)),new CANNON.Vec3(cs*r*this.scale,(y0+y1)/2*this.scale,sn*r*this.scale),q(new THREE.Quaternion().setFromRotationMatrix(basis)));
    }
  }
  private vesselPose():void {
    this.bowl.updateWorldMatrix(true,false);this.bowl.getWorldPosition(this.tmp);this.bowl.getWorldQuaternion(this.rotation);
    this.vessel.position.set(this.tmp.x,this.tmp.y,this.tmp.z);this.vessel.quaternion.set(this.rotation.x,this.rotation.y,this.rotation.z,this.rotation.w);this.vessel.aabbNeedsUpdate=true;
  }
  private place(coin:Coin,recycle=false):void {
    const local=recycle?new THREE.Vector3((Math.random()-.5)*.18,-.07,(Math.random()-.5)*.18):coin.home;
    this.stats.lastSpawnLocal=local.toArray();
    this.tmp.copy(local);this.bowl.localToWorld(this.tmp);
    coin.body.position.set(this.tmp.x,this.tmp.y,this.tmp.z);
    this.bowl.getWorldQuaternion(this.rotation);this.rotation.multiply(coin.spin);coin.body.quaternion.set(this.rotation.x,this.rotation.y,this.rotation.z,this.rotation.w);
    coin.body.velocity.setZero();coin.body.angularVelocity.setZero();coin.body.wakeUp();coin.escaped=false;coin.visible=true;
  }
  reset():void {
    this.vesselPose();this.running=false;
    for(const coin of this.coins)this.place(coin);
    this.sync();
  }
  update(dt:number,pose:number,emitting:boolean,rest:boolean):void {
    this.stats.emitting=emitting;
    if(rest){if(!this.wasAtRest)this.reset();this.wasAtRest=true;this.sync();return;}
    this.wasAtRest=false;this.vesselPose();this.running=true;
    const started=performance.now();
    this.world.step(1/60,Math.min(dt,.034),2);
    this.stats.physicsMs=performance.now()-started;
    for(const coin of this.coins){
      if(!coin.visible)continue;
      const p=coin.body.position;this.tmp.set(p.x,p.y,p.z);this.bowl.worldToLocal(this.tmp);
      if(!coin.escaped&&(Math.hypot(this.tmp.x,this.tmp.z)>.94||this.tmp.y<-.24)){
        coin.escaped=true;
        // Angular velocity comes from contact. Add a small varied tumble only
        // when the body crosses the real rim, with no screen-space side force.
        coin.body.angularVelocity.x+=(coin.home.x+.2)*5;
        coin.body.angularVelocity.z+=2+pose*2;
      }
      if(p.y< -4.5){if(emitting){this.place(coin,true);this.stats.recycled++;}else {coin.visible=false;coin.body.sleep();}}
    }
    this.sync();
  }
  private sync():void {
    let inside=0,outside=0;
    for(const coin of this.coins){
      if(!coin.visible)continue;
      const b=coin.body;this.dummy.position.set(b.position.x,b.position.y,b.position.z);this.dummy.quaternion.set(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w).multiply(this.align);this.dummy.scale.setScalar(this.objectScale);this.dummy.updateMatrix();
      if(coin.escaped)this.outside.setMatrixAt(outside++,this.dummy.matrix);else this.inside.setMatrixAt(inside++,this.dummy.matrix);
    }
    this.inside.count=inside;this.outside.count=outside;this.inside.instanceMatrix.needsUpdate=true;this.outside.instanceMatrix.needsUpdate=true;this.stats.inside=inside;this.stats.airborne=outside;
  }
  hit(x:number,y:number,mx:number,my:number,camera:THREE.Camera,width:number,height:number):boolean {
    if(!this.running||performance.now()-this.lastHit<75||Math.hypot(mx,my)<1)return false;
    let selected:Coin|undefined,nearest=35;
    for(const coin of this.coins){if(!coin.escaped||!coin.visible)continue;const p=coin.body.position;this.tmp.set(p.x,p.y,p.z).project(camera);const d=Math.hypot((this.tmp.x*.5+.5)*width-x,(-this.tmp.y*.5+.5)*height-y);if(d<nearest){nearest=d;selected=coin;}}
    if(!selected)return false;
    const m=selected.body.mass;selected.body.applyImpulse(new CANNON.Vec3(THREE.MathUtils.clamp(mx,-30,30)*m*.065,-THREE.MathUtils.clamp(my,-30,30)*m*.065,m*.12));this.lastHit=performance.now();this.stats.impacts++;return true;
  }
}
