import {AbundancePhysics} from './abundance-physics';
import seed from './physics/abundance-surface-v4.json';
import centralSeed from './physics/abundance-central-v5.json';

let physics:AbundancePhysics;
const send=(ready=false)=>{const data=physics.snapshot();self.postMessage({ready,data,stats:physics.stats},{transfer:[data.buffer as ArrayBuffer]});};
self.onmessage=async(event)=>{
  const message=event.data;
  if(message.type==='init'){
    await AbundancePhysics.initialize();physics=new AbundancePhysics(message.trial10?centralSeed:seed,true,!!message.trial10);physics.warmup(6);send(true);
  }else if(message.type==='step'){
    physics.update(message.dt,message.emitting,message.openingTime);send();
  }else if(message.type==='grab')physics.beginGrab(message.coin);
  else if(message.type==='grab-move')physics.moveGrab(message.target);
  else if(message.type==='grab-end')physics.endGrab();
};
