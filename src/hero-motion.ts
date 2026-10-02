import * as THREE from 'three';
import source from './donor/hero-micro-motion.json';

const track=source.tracks['190:rotation'];
const rest=new THREE.Quaternion().fromArray(track.values[0]).invert();
const a=new THREE.Quaternion(),b=new THREE.Quaternion(),relative=new THREE.Quaternion();
const identity=new THREE.Quaternion();

/** Shopify Hero's authored root sway, retargeted at 14% of its amplitude.
 * It is scroll driven, with the cup/painting kept together as one tableau. */
export function sampleHeroSway(scrollVh:number,out:THREE.Quaternion):number {
  const keys=source.progress;
  const seq=1+THREE.MathUtils.clamp(scrollVh,0,1.5)*.51;
  let from=keys[1],to=keys[2];
  if(seq>to.position){from=to;to=keys[3];}
  const t=THREE.MathUtils.clamp((seq-from.position)/(to.position-from.position),0,1);
  const cubic=(p:number,q:number,v:number)=>3*(1-v)**2*v*p+3*(1-v)*v*v*q+v**3;
  let low=0,high=1;
  for(let i=0;i<18;i++){const mid=(low+high)/2;if(cubic(from.handles[2],to.handles[0],mid)<t)low=mid;else high=mid;}
  const progress=THREE.MathUtils.lerp(from.value,to.value,cubic(from.handles[3],to.handles[1],(low+high)/2));
  const time=Math.max(track.times[0],progress*source.duration);
  let index=0;while(index<track.times.length-2&&track.times[index+1]<time)index++;
  a.fromArray(track.values[index]);b.fromArray(track.values[index+1]);
  out.copy(a).slerp(b,THREE.MathUtils.clamp((time-track.times[index])/(track.times[index+1]-track.times[index]),0,1)).premultiply(rest);
  relative.copy(out);out.copy(identity).slerp(relative,.14);
  return progress;
}
