import * as THREE from 'three';
import vertexShader from './donor/dust.vert?raw';
import fragmentShader from './donor/dust.frag?raw';

/** Shopify ka()/la()/fa(): original geometry attributes and both shaders.
 * Three depth bands use the donor's blur and point-size variation controls. */
export class Dust {
  private materials:THREE.ShaderMaterial[]=[];
  constructor(scene:THREE.Scene,noise:THREE.Texture){
    for(let layer=0;layer<3;layer++){
      const count=[180,64,22][layer];
      const positions=new Float32Array(count*3),velocities=new Float32Array(count*3),phases=new Float32Array(count),sizes=new Float32Array(count);
      for(let i=0;i<count;i++){
        for(let k=0;k<3;k++){positions[i*3+k]=Math.random()*2-1;velocities[i*3+k]=(Math.random()-.5)*2;}
        phases[i]=Math.random()*Math.PI*2;sizes[i]=.5+Math.random();
      }
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('velocity',new THREE.BufferAttribute(velocities,3));geometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));geometry.setAttribute('sizeScale',new THREE.BufferAttribute(sizes,1));
      const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,uniforms:{uSize:{value:[.075,.24,.84][layer]},uSizeVariation:{value:1},uColor:{value:new THREE.Color('#e4c48c')},uOpacity:{value:[.34,.21,.085][layer]},uBlur:{value:[.85,.25,.02][layer]},uTime:{value:0},uSpeed:{value:.5},uTurbulence:{value:.2},uBlinkSpeed:{value:layer===2?.34:.7},uBlinkMin:{value:.35},tNoise:{value:noise}}});
      const cloud=new THREE.Points(geometry,material);cloud.scale.set(3.2,2,.6);cloud.position.set(-.2,.25,[-.8,.45,1.15][layer]);cloud.frustumCulled=false;scene.add(cloud);this.materials.push(material);
    }
  }
  update(time:number):void { for(const material of this.materials)material.uniforms.uTime.value=time; }
}
