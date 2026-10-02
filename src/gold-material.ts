import {ShaderChunk,type MeshStandardMaterial} from 'three';

// Preserve the studio's reflection shapes and luminance, but match its colour
// to the warm painted surroundings. Only the vessel uses this environment.
const vesselEnvironment=ShaderChunk.envmap_physical_pars_fragment.replace(
  'return envMapColor.rgb * envMapIntensity;',
  'float studioLuminance=dot(envMapColor.rgb,vec3(.2126,.7152,.0722)); return studioLuminance*vec3(1.12,1.,.76)*envMapIntensity;',
);

/** Per-object highlight roll-off: keep the painting untouched and preserve
 * the donor's unrestricted HDR reflection on freely tumbling coins. */
export function softenGold(material:MeshStandardMaterial,peak:number):void {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uGoldPeak={value:peak};
    shader.fragmentShader='uniform float uGoldPeak;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
      'float goldPeak=max(outgoingLight.r,max(outgoingLight.g,outgoingLight.b)); outgoingLight *= uGoldPeak/(uGoldPeak+goldPeak);\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey=()=>`gold-highlight-${peak}`;
}

/** Quiet mottling in the alloy breaks up a perfectly uniform new-metal finish.
 * The chased edges remain polished; their geometry supplies the sharp glints. */
export function antiqueGold(material:MeshStandardMaterial,finish:'body'|'edge'|'recess',peak?:number):void {
  const edge=finish==='edge',recess=finish==='recess';
  material.color.set(edge?'#f0c97b':recess?'#9b682e':'#d9ac59');
  material.metalness=1;material.roughness=edge?.105:recess?.36:.21;
  material.envMapIntensity=edge?1.55:recess?.78:1.15;
  material.emissive.set(0);
  softenGold(material,peak??(edge?9.4:recess?4.8:6.2));
  const compile=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',vesselEnvironment);
    shader.vertexShader='varying vec3 vAlloyPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvAlloyPosition=position;');
    shader.fragmentShader=`varying vec3 vAlloyPosition;
      float alloyHash(vec3 p){p=fract(p*.3183099+vec3(.13,.17,.23));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float alloyNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(alloyHash(i),alloyHash(i+vec3(1,0,0)),f.x),mix(alloyHash(i+vec3(0,1,0)),alloyHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(alloyHash(i+vec3(0,0,1)),alloyHash(i+vec3(1,0,1)),f.x),mix(alloyHash(i+vec3(0,1,1)),alloyHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      float patina=alloyNoise(vAlloyPosition*34.);
      float fineAlloy=alloyNoise(vAlloyPosition*170.);
      roughnessFactor=clamp(roughnessFactor+(patina-.5)*${edge?'.012':'.065'}+(fineAlloy-.5)*.018,${edge?'.085':'.13'},.5);
      diffuseColor.rgb*=mix(vec3(.87,.82,.74),vec3(1.),.55+patina*.45);`);
  };
  material.customProgramCacheKey=()=>`midis-antique-gold-v9-warm-studio-${finish}-${peak??'default'}`;
}
