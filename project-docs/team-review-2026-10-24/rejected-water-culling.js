// Rejected experiment retained only for benchmark reproduction; never imported by the game.
function cornerInsidePlane(bounds,vp,plane){
 const row=plane>>1;
 for(let corner=0;corner<8;corner++){
  const x=bounds[corner&1?3:0],y=bounds[corner&2?4:1],z=bounds[corner&4?5:2];
  const clip=vp[row]*x+vp[4+row]*y+vp[8+row]*z+vp[12+row],w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  if((plane===4?clip:plane&1?w-clip:clip+w)>=0)return true;
 }
 return false;
}
export function waterInView(bounds,vp){
 if(!bounds)return false;
 for(let plane=0;plane<6;plane++){
  const row=plane>>1,sign=plane&1?-1:1;
  const ax=vp[row],ay=vp[4+row],az=vp[8+row],aw=vp[12+row],bx=plane===4?0:vp[3],by=plane===4?0:vp[7],bz=plane===4?0:vp[11],bw=plane===4?0:vp[15];
  const x=bx+sign*ax,y=by+sign*ay,z=bz+sign*az,w=bw+sign*aw;
  const distance=x*bounds[x>=0?3:0]+y*bounds[y>=0?4:1]+z*bounds[z>=0?5:2]+w;
  const scale=(Math.abs(ax)+Math.abs(bx))*Math.max(Math.abs(bounds[0]),Math.abs(bounds[3]))+(Math.abs(ay)+Math.abs(by))*Math.max(Math.abs(bounds[1]),Math.abs(bounds[4]))+(Math.abs(az)+Math.abs(bz))*Math.max(Math.abs(bounds[2]),Math.abs(bounds[5]))+Math.abs(aw)+Math.abs(bw);
  if(Math.abs(distance)<=scale*Number.EPSILON*16){if(!cornerInsidePlane(bounds,vp,plane))return false;}
  else if(distance<0)return false;
 }
 return true;
}
