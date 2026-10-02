import R from '@dimforge/rapier3d-compat';
import type {CoinGrab} from './pointer-contact';

export const COIN_RADIUS=.094, COIN_THICKNESS=.023, CAPACITY=1100;
const STEP=1/45, RATE=20;
const FALL_TIME_SCALE=1.3, FEED_SPEED=.035, PILE_LIMIT=752;
type Fall={position:R.Vector;velocity:R.Vector;rotation:R.Rotation;angular:R.Vector};
type Piece={body:R.RigidBody;collider:R.Collider;state:0|1|2;age:number;serial:number;touch:number;fall?:Fall};

/** All visible coins are rigid bodies. A slow, concealed feed introduces
 * volume inside the heap; no upward or sideways launch is prescribed. */
export class AbundancePhysics {
  readonly world=new R.World({x:0,y:-5.6,z:0});
  readonly pieces:Piece[]=[];
  readonly stats={inside:0,airborne:0,emerging:0,bed:0,born:0,rimExits:0,exitSides:[0,0,0,0],impacts:0,heapImpacts:0,grabbed:-1,releases:0,feedRate:RATE,openingTime:0,emitting:false,physicsMs:0,lastSpawnLocal:[0,0,0],maxExitUp:0,maxExitSpeed:0,movingInside:0,heapTop:0,feedHeld:0,recycledInside:0,fallTimeScale:FALL_TIME_SCALE};
  private accumulator=0;
  private feed=0;
  private serial=0;
  private enabled=true;
  private openingTime=0;
  private presentationClock=false;
  private pileLimit:number;
  private grab?:{index:number;target:R.Vector;release:boolean};
  static async initialize():Promise<void>{await R.init();}

  constructor(seed?:number[][],private surfaceOnly=false,private centralFeedTrial=false){
    this.pileLimit=surfaceOnly?420:PILE_LIMIT;
    this.world.timestep=STEP;this.world.numSolverIterations=4;
    // A real concave collision surface follows the inner lathed profile.
    const vertices:number[]=[],indices:number[]=[],rings=12,segments=64;
    for(let row=0;row<=rings;row++)for(let j=0;j<segments;j++){
      const r=Math.max(.001,row/rings*.884),a=j/segments*Math.PI*2;
      vertices.push(Math.cos(a)*r,-.156+.333*(r/.874)**1.83,Math.sin(a)*r);
    }
    for(let row=0;row<rings;row++)for(let j=0;j<segments;j++){
      const a=row*segments+j,b=row*segments+(j+1)%segments,c=a+segments,d=b+segments;
      indices.push(a,c,b,b,c,d);
    }
    this.world.createCollider(R.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices)).setFriction(.24).setRestitution(0).setCollisionGroups(0x00040001));
    if(surfaceOnly){
      // One invisible convex support replaces the concealed lower reservoir.
      // Only the visible upper layers remain coins in the solver and renderer.
      const support:number[]=[0,.185,0,0,-.156,0];
      for(const [r,y] of [[.3,.183],[.6,.175],[.78,.155],[.78,-.035]]){
        for(let i=0;i<32;i++){const a=i/32*Math.PI*2;support.push(Math.cos(a)*r,y,Math.sin(a)*r);}
      }
      const shape=R.ColliderDesc.convexHull(new Float32Array(support));
      if(!shape)throw new Error('Coin support could not be built');
      this.world.createCollider(shape.setFriction(.22).setRestitution(0).setCollisionGroups(0x00040001));
    }
    if(seed){
      for(const s of seed){const p=this.create();p.body.setTranslation({x:s[0],y:s[1],z:s[2]},true);p.body.setRotation({x:s[3],y:s[4],z:s[5],w:s[6]},true);p.body.setLinvel({x:s[7],y:s[8],z:s[9]},true);p.body.setAngvel({x:s[10],y:s[11],z:s[12]},true);this.serial++;}
      this.stats.bed=this.pieces.length;this.stats.inside=this.pieces.length;return;
    }
    const spacing=COIN_RADIUS*2.015;
    for(let layer=0;layer<29;layer++){
      const y=-.12+layer*.035;
      const inner=.874*Math.max(0,(y+.156-.015)/.333)**(1/1.83)-COIN_RADIUS*.55;
      const hill=(.84-y)/.70;
      const rmax=Math.min(.795,inner,hill);
      for(let iz=-6;iz<=6;iz++)for(let ix=-6;ix<=6;ix++){
        const x=(ix+(iz%2)*.5+(layer%2)*.26)*spacing,z=iz*spacing*.866+(layer%2)*.035;
        if(Math.hypot(x,z)>rmax)continue;
        const p=this.create();p.body.setTranslation({x:x+Math.sin(this.serial*8.1)*.022,y:y+Math.sin(this.serial*5.77)*.012,z:z+Math.cos(this.serial*3.41)*.022},true);p.body.setRotation(this.rotation(Math.sin(this.serial*1.72)*.34,this.serial*2.39996,Math.cos(this.serial*.83)*.29),true);this.serial++;
      }
    }
    this.stats.bed=this.pieces.length;this.stats.inside=this.pieces.length;
  }

  private create():Piece{
    const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setLinearDamping(.15).setAngularDamping(.3).setCanSleep(true));
    const collider=this.world.createCollider(R.ColliderDesc.cylinder(COIN_THICKNESS/2,COIN_RADIUS).setMass(.04).setFriction(.18).setRestitution(.01).setCollisionGroups(0x00010007),body);
    const p:Piece={body,collider,state:1,age:2,serial:this.serial,touch:0};this.pieces.push(p);return p;
  }

  private rotation(x:number,y:number,z:number){const c1=Math.cos(x/2),s1=Math.sin(x/2),c2=Math.cos(y/2),s2=Math.sin(y/2),c3=Math.cos(z/2),s3=Math.sin(z/2);return{x:s1*c2*c3+c1*s2*s3,y:c1*s2*c3-s1*c2*s3,z:c1*c2*s3+s1*s2*c3,w:c1*c2*c3-s1*s2*s3};}

  private spawn():void {
    // A full reservoir must keep circulating. Reuse only a fully concealed
    // bottom coin at the cap, instead of deadlocking the feeder and outflow.
    let p:Piece|undefined,circulating=false;
    if(this.pieces.filter(p=>p.state===1).length>=this.pileLimit){
      // The compact reservoir has a raised support. Recycle its bottommost
      // mature coin at capacity, rather than waiting for the old floor height.
      let lowest=this.surfaceOnly?Infinity:.06;
      for(const candidate of this.pieces){
        if(candidate.state!==1||candidate.age<1.3||candidate===this.pieces[this.grab?.index??-1])continue;
        const pos=candidate.body.translation();
        if(pos.y<lowest&&Math.hypot(pos.x,pos.z)<(this.surfaceOnly?.65:.58)){lowest=pos.y;p=candidate;}
      }
      if(!p){this.stats.feedHeld++;return;}
      this.stats.recycledInside++;circulating=true;
    }else p=this.pieces.find(p=>p.state===0);
    if(!p){if(this.pieces.length>=CAPACITY)return;p=this.create();}
    const quadrant=this.serial%4,a=quadrant*Math.PI/2+.28+((this.serial*17)%13)/13*1.01;
    this.serial++;const fraction=((this.serial*7)%17)/17;
    // At capacity feed the covered outer half of the reservoir. This keeps
    // the rim supplied without building a taller central mound.
    const r=circulating?(this.surfaceOnly?.54+fraction*.13:.485+fraction*.145):.28+fraction*.28;
    let x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(this.centralFeedTrial&&this.surfaceOnly&&this.serial%5<2){
      // Share the existing flow between two broad concealed central patches.
      // Golden-angle offsets prevent repeated vertical stacks at one point.
      const side=this.serial%2?-1:1,phase=this.serial*2.399963;
      const spread=.22*Math.sqrt(fraction);
      x=side*.25+Math.cos(phase)*spread;z=side*.08+Math.sin(phase)*spread;
    }
    // The full-size coin enters below the rim, concealed inside the pile.
    // The slow feed ends inside the heap, not at its visible surface.
    p.state=1;p.age=0;p.serial=this.serial;p.touch=0;p.fall=undefined;p.body.enableCcd(false);p.body.setEnabled(true);p.body.setBodyType(R.RigidBodyType.KinematicVelocityBased,true);
    const y=this.surfaceOnly?.17:.065;
    p.body.setTranslation({x,y,z},true);p.body.setRotation(this.rotation(0,a,0),true);
    p.body.setLinvel({x:0,y:FEED_SPEED,z:0},true);p.body.setAngvel({x:0,y:0,z:0},true);p.collider.setCollisionGroups(0x00020001);
    this.stats.born++;const pos=p.body.translation();this.stats.lastSpawnLocal=[pos.x,pos.y,pos.z];
  }

  warmup(steps=150):void {for(let i=0;i<steps;i++)this.step(false);this.stats.rimExits=0;this.stats.exitSides.fill(0);}

  update(dt:number,enabled:boolean,presentationTime?:number):void {
    const start=performance.now();if(enabled!==this.enabled){this.releaseGrab();for(const p of this.pieces)if(p.state===1)p.body.setEnabled(enabled);}this.enabled=enabled;this.stats.emitting=enabled;
    this.presentationClock=presentationTime!==undefined;
    if(enabled&&presentationTime!==undefined)this.openingTime=presentationTime;
    this.accumulator+=Math.min(dt,.05);
    let n=0;while(this.accumulator>=STEP&&n++<5){this.step(enabled);this.accumulator-=STEP;}
    this.stats.physicsMs=performance.now()-start;
    let inside=0,airborne=0,emerging=0,moving=0,heapTop=0;
    for(const p of this.pieces){if(p.state===1){inside++;heapTop=Math.max(heapTop,p.body.translation().y);if(p.age<1.3)emerging++;const v=p.body.linvel();if(Math.hypot(v.x,v.y,v.z)>.025)moving++;}else if(p.state===2)airborne++;}
    Object.assign(this.stats,{inside,airborne,emerging,movingInside:moving,heapTop});
  }

  private step(emitting:boolean):void {
    if(emitting){
      if(!this.presentationClock)this.openingTime+=STEP;
      const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
      // One opening accent per visit. The same bounded reservoir circulates
      // faster, with no queue to dump when the user returns from block two.
      const accent=smooth(this.openingTime/.25)*(1-smooth((this.openingTime-2)/2));
      this.stats.feedRate=RATE*(1+2.5*accent);this.stats.openingTime=this.openingTime;
      this.feed+=STEP*this.stats.feedRate;
      while(this.feed>=1){this.feed--;this.spawn();}
    }
    else this.feed=0;
    for(const p of this.pieces){
      if(!p.state)continue;
      const b=p.body;
      const held=this.grab&&this.pieces[this.grab.index]===p;
      if(held){
        const pos=p.fall?.position||b.translation(),old=p.fall?.velocity||b.linvel(),target=this.grab!.target;
        let x=(target.x-pos.x)*18,y=(target.y-pos.y)*18,z=(target.z-pos.z)*18;
        const speed=Math.hypot(x,y,z),scale=speed>4.4?4.4/speed:1;
        x=old.x*.2+x*scale*.8;y=old.y*.2+y*scale*.8;z=old.z*.2+z*scale*.8;
        if(p.fall){Object.assign(p.fall.velocity,{x,y,z});p.fall.angular.x*=.9;p.fall.angular.z*=.9;}
        else {b.setLinvel({x,y,z},true);p.touch=.4;}
      }
      if(p.state===2){
        // Once free of the vessel there are no supporting contacts. Keep the
        // conserved release velocity and integrate gravity independently of
        // the reservoir, including when that reservoir is paused by the wipe.
        // Run only the established free-flight trajectory 30% faster. The
        // weight and contact response inside the approved pile stay intact.
        const fallStep=STEP*FALL_TIME_SCALE;
        const f=p.fall!;if(!held)f.velocity.y-=5.6*fallStep;f.position.x+=f.velocity.x*fallStep;f.position.y+=f.velocity.y*fallStep;f.position.z+=f.velocity.z*fallStep;
        const q=f.rotation,a=f.angular,x=q.x,y=q.y,z=q.z,w=q.w,k=fallStep*.5;
        q.x+=k*(a.x*w+a.y*z-a.z*y);q.y+=k*(a.y*w+a.z*x-a.x*z);q.z+=k*(a.z*w+a.x*y-a.y*x);q.w-=k*(a.x*x+a.y*y+a.z*z);
        const length=Math.hypot(q.x,q.y,q.z,q.w);q.x/=length;q.y/=length;q.z/=length;q.w/=length;
        if(f.position.y< -13&&!held){p.state=0;p.fall=undefined;}
        continue;
      }
      if(!emitting&&p.state===1)continue;
      if(p.state===1&&p.age<1.3){
        p.age+=STEP;
        if(p.age>=1.3){b.setBodyType(R.RigidBodyType.Dynamic,true);b.setLinvel({x:0,y:0,z:0},true);p.collider.setCollisionGroups(0x00010007);}
      }
      if(p.state===1){
        // A dense pile dissipates pressure rather than launching coins.
        // A deliberate mouse contact briefly gets its own bounded velocity.
        const touched=p.touch>0;
        if(touched){p.touch=Math.max(0,p.touch-STEP);if(!p.touch)b.enableCcd(false);}
        const lateralLimit=touched?4.4:.55,upLimit=held?4.4:touched?1.1:.14;
        const v=b.linvel(),pos=b.translation();
        const horizontal=Math.hypot(v.x,v.z),f=horizontal>lateralLimit?lateralLimit/horizontal:1;
        if(v.y>upLimit||f<1)b.setLinvel({x:v.x*f,y:Math.min(v.y,upLimit),z:v.z*f},false);
        const r=Math.hypot(pos.x,pos.z);
        if(r>.925&&(pos.y<.6||touched)){
          p.state=2;this.stats.rimExits++;this.stats.exitSides[Math.abs(pos.x)>Math.abs(pos.z)?(pos.x<0?0:1):(pos.z<0?2:3)]++;
          this.stats.maxExitUp=Math.max(this.stats.maxExitUp,Math.min(v.y,upLimit));this.stats.maxExitSpeed=Math.max(this.stats.maxExitSpeed,Math.min(horizontal,lateralLimit));
          const velocity=b.linvel(),rotation=b.rotation(),angular=b.angvel();
          p.fall={position:{x:pos.x,y:pos.y,z:pos.z},velocity:{x:velocity.x,y:velocity.y,z:velocity.z},rotation:{x:rotation.x,y:rotation.y,z:rotation.z,w:rotation.w},angular:{x:angular.x,y:angular.y,z:angular.z}};
          b.setEnabled(false);
        }
      }
      if(b.translation().y< -13){p.state=0;b.setEnabled(false);}
    }
    this.world.step();
    if(this.grab?.release)this.releaseGrab();
  }

  beginGrab(hit:CoinGrab):boolean {
    const p=this.pieces[hit.index];
    if(!this.enabled||this.grab||!p||p.state!==hit.state||![hit.x,hit.y,hit.z].every(Number.isFinite))return false;
    if(p.state===1&&(p.age<1.3||p.body.translation().y<.16))return false;
    this.grab={index:hit.index,target:{x:hit.x,y:hit.y,z:hit.z},release:false};
    this.stats.grabbed=hit.index;this.stats.impacts++;
    if(p.state===1){p.body.wakeUp();p.body.enableCcd(true);p.touch=.4;this.stats.heapImpacts++;}
    return true;
  }

  moveGrab(target:R.Vector):void {
    if(this.grab&&[target.x,target.y,target.z].every(Number.isFinite))Object.assign(this.grab.target,target);
  }

  endGrab():void {if(this.grab)this.grab.release=true;}

  private releaseGrab():void {
    if(!this.grab)return;
    const p=this.pieces[this.grab.index];
    if(p?.state===1){p.touch=.4;p.body.wakeUp();}
    this.grab=undefined;this.stats.grabbed=-1;this.stats.releases++;
  }

  snapshot():Float32Array{
    const data=new Float32Array(this.pieces.length*8);
    this.pieces.forEach((p,i)=>{const v=p.fall?.position||p.body.translation(),q=p.fall?.rotation||p.body.rotation(),j=i*8;data[j]=v.x;data[j+1]=v.y;data[j+2]=v.z;data[j+3]=q.x;data[j+4]=q.y;data[j+5]=q.z;data[j+6]=q.w;data[j+7]=p.state;});return data;
  }

  seed():number[][]{
    return this.pieces.filter(p=>p.state===1&&p.age>=1.3).map(p=>{const v=p.body.translation(),q=p.body.rotation(),l=p.body.linvel(),a=p.body.angvel();return[v.x,v.y,v.z,q.x,q.y,q.z,q.w,l.x,l.y,l.z,a.x,a.y,a.z].map(n=>+n.toFixed(6));});
  }
}
