import type { TableauFraming } from './tableau-motion';

/** The approved paper transition finishes here. Only character tracks use it. */
export const CHARACTER_EXIT = 3.26;
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const ease=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};

export function sampleCharacterFraming(scroll:number,aspect:number):TableauFraming {
  const approach=ease(scroll/2.4);
  const closeUp=ease((scroll-1.55)/(CHARACTER_EXIT-1.55));
  return {
    scale:Math.min(1.02,aspect*.83)*(1+approach*.17+closeUp*.20),
    anchorX:.37+approach*.025-closeUp*.016,
    anchorY:.215-approach*.025+closeUp*.014,
  };
}

/** Preserve the first two beats, then continue the authored sway through exit. */
export function sampleCharacterRoot(scroll:number):number {
  if(scroll<=1.6)return Math.max(0,scroll)/2.4*1.5;
  const t=clamp((scroll-1.6)/(CHARACTER_EXIT-1.6));
  // Cubic Hermite: matching incoming velocity, no clamp/hold at 2.4 screens.
  return 1+(t*t*(3-2*t))*.5+(t*t*t-2*t*t+t)*1.0375+(t*t*t-t*t)*.1992;
}

/** A small directed gesture on top of breathing; reverses with the scroll. */
export function sampleCharacterGesture(scroll:number):number {
  return ease((scroll-1.4)/(CHARACTER_EXIT-1.4));
}
