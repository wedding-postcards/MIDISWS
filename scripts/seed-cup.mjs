import {writeFile} from 'node:fs/promises';
import {Quaternion,Euler} from 'three';
// Four overlapping layers create a filled initial reservoir. Only the
// bottom layer is settled; every exposed layer has rigid-body contacts.
const seed=[];let index=0;
for(let layer=0;layer<4;layer++)for(let iz=-6;iz<=6;iz++)for(let ix=-6;ix<=6;ix++){
  const x=(ix+(iz%2)*.5+(layer%2)*.24)*.184,z=iz*.184*.866+(layer%2)*.032,r=Math.hypot(x,z);
  if(r>.85-layer*.022)continue;
  const a=Math.atan2(z,x),tilt=.18;
  const q=new Quaternion().setFromEuler(new Euler(-Math.sin(a)*tilt+Math.sin(index*3.71)*.12,index*2.399963,Math.cos(a)*tilt+Math.cos(index*5.41)*.12));
  const y=.35-.215*r+(layer===0?-.033:.01+layer*.036)+Math.sin(index*7.3)*.006;
  seed.push([x,y,z,...q.toArray(),0,0,0,0,0,0,layer===0?1:0].map(v=>+v.toFixed(6)));index++;
}
await writeFile('src/physics/abundance-seed.json',JSON.stringify(seed));console.log('Preloaded coins',seed.length,'buried',seed.filter(s=>s[13]).length);
