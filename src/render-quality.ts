/** Supersample standard desktop screens; bound HDR buffers on large monitors. */
export function paintingPixelRatio(width:number,height:number,dpr:number,penalty=0):number {
  const budget=Math.sqrt(4_600_000/Math.max(1,width*height));
  return Math.max(1,Math.min(Math.max(dpr,1.5),1.75,budget)-penalty);
}
