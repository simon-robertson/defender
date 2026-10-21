import {ARC_LIGHT_SEGMENTS,ARC_LIGHT_BOUNDS_OFFSET} from '../shared/arc-effects.js';

// Enclose the actual Float32 segment endpoints and every segment's falloff
// radius. Rounded centres/radii receive a conservative float-precision margin;
// rejection can add false positives but must never discard visible light.
export function packTubeLightBounds(data,offset){
 const count=Math.min(data[offset+5],ARC_LIGHT_SEGMENTS),baseRadius=data[offset+3];
 let minX=Infinity,minY=Infinity,minZ=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=-Infinity,radius=0;
 for(let i=0;i<count;i++){
  const k=offset+8+i*8;
  for(let end=0;end<2;end++){const p=k+end*4,x=data[p],y=data[p+1],z=data[p+2];minX=Math.min(minX,x);minY=Math.min(minY,y);minZ=Math.min(minZ,z);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);maxZ=Math.max(maxZ,z);}
  radius=Math.max(radius,Math.abs(baseRadius*data[k+3]));
 }
 const k=offset+ARC_LIGHT_BOUNDS_OFFSET;
 if(!count){data[k]=data[k+1]=data[k+2]=data[k+3]=0;return;}
 const x=Math.fround((minX+maxX)*.5),y=Math.fround((minY+maxY)*.5),z=Math.fround((minZ+maxZ)*.5);
 radius+=Math.hypot(Math.max(Math.abs(minX-x),Math.abs(maxX-x)),Math.max(Math.abs(minY-y),Math.abs(maxY-y)),Math.max(Math.abs(minZ-z),Math.abs(maxZ-z)));
 radius+=Math.max(1,Math.abs(x),Math.abs(y),Math.abs(z),radius)*1e-5;
 data[k]=x;data[k+1]=y;data[k+2]=z;data[k+3]=radius;
}
