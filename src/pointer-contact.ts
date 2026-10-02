/** Distance from a swept pointer segment to a coin's projected ellipse.
 * <= 1 is actual contact. Testing the segment prevents fast gestures tunnelling
 * through a small coin between two browser pointer events. */
export function sweptEllipseDistance(
  x0:number,y0:number,x1:number,y1:number,cx:number,cy:number,
  nx:number,ny:number,major:number,minor:number,
):number {
  const length=Math.hypot(nx,ny);
  if(length<.001){nx=0;ny=1;}else{nx/=length;ny/=length;}
  const ax=-ny,ay=nx;
  const fromX=((x0-cx)*ax+(y0-cy)*ay)/major;
  const fromY=((x0-cx)*nx+(y0-cy)*ny)/minor;
  const dx=((x1-x0)*ax+(y1-y0)*ay)/major;
  const dy=((x1-x0)*nx+(y1-y0)*ny)/minor;
  const denominator=dx*dx+dy*dy;
  const t=denominator>1e-9?Math.max(0,Math.min(1,-(fromX*dx+fromY*dy)/denominator)):0;
  return (fromX+dx*t)**2+(fromY+dy*t)**2;
}

export type CoinGrab={index:number;state:1|2;x:number;y:number;z:number};
