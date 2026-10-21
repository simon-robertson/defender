import {BOX_SIZE} from './grid.js';
export function identity(out=new Float32Array(16)) {out.fill(0);out[0]=out[5]=out[10]=out[15]=1;return out;}
export function multiply(out,a,b) {
  // Output must not alias an input; callers keep reusable scratch matrices.
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;
}
export function translation(x,y,z,out=new Float32Array(16)){identity(out);out[12]=x;out[13]=y;out[14]=z;return out;}
export function rotation(axis,angle,out=new Float32Array(16)) {
  identity(out);const c=Math.cos(angle),s=Math.sin(angle);
  if(axis===0){out[5]=c;out[6]=s;out[9]=-s;out[10]=c;}
  if(axis===1){out[0]=c;out[2]=-s;out[8]=s;out[10]=c;}
  if(axis===2){out[0]=c;out[1]=s;out[4]=-s;out[5]=c;}return out;
}
export function pivotMatrix(pivot,angles=[0,0,0]) {
  let out=translation(...pivot);
  for(const axis of [2,1,0]){const next=new Float32Array(16);multiply(next,out,rotation(axis,angles[axis]*Math.PI/180));out=next;}
  const next=new Float32Array(16);multiply(next,out,translation(-pivot[0],-pivot[1],-pivot[2]));return next;
}
export function partMatrices(parts,poses={}) {
  const matrices=new Map(),byId=new Map(parts.map(p=>[p.id,p]));
  const resolve=part=>{if(matrices.has(part.id))return matrices.get(part.id);const local=pivotMatrix(part.pivot,poses[part.id]);
    if(part.parent){const out=new Float32Array(16);multiply(out,resolve(byId.get(part.parent)),local);matrices.set(part.id,out);}else matrices.set(part.id,local);return matrices.get(part.id);};
  parts.forEach(resolve);return matrices;
}
export function placementMatrix(box,turn,offset=null) {
  const t=translation(box[0]*BOX_SIZE+BOX_SIZE/2,box[1]*BOX_SIZE,box[2]*BOX_SIZE+BOX_SIZE/2),r=rotation(1,-turn*Math.PI/2),a=new Float32Array(16),out=new Float32Array(16);
  multiply(a,t,r);multiply(out,a,translation(-BOX_SIZE/2,0,-BOX_SIZE/2));if(offset){out[12]+=offset[0];out[13]+=offset[1];out[14]+=offset[2];}return out;
}
export function lookAt(out,eye,target) {
  let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];let len=Math.hypot(zx,zy,zz);zx/=len;zy/=len;zz/=len;
  len=Math.hypot(zz,zx);const xx=len>1e-6?zz/len:1,xz=len>1e-6?-zx/len:0,yx=zy*xz,yy=zz*xx-zx*xz,yz=-zy*xx;
  out[0]=xx;out[1]=yx;out[2]=zx;out[3]=0;out[4]=0;out[5]=yy;out[6]=zy;out[7]=0;
  out[8]=xz;out[9]=yz;out[10]=zz;out[11]=0;
  out[12]=-xx*eye[0]-xz*eye[2];out[13]=-yx*eye[0]-yy*eye[1]-yz*eye[2];out[14]=-zx*eye[0]-zy*eye[1]-zz*eye[2];out[15]=1;return out;
}
export function ortho(out,left,right,bottom,top,near,far){out.fill(0);out[0]=2/(right-left);out[5]=2/(top-bottom);out[10]=1/(near-far);out[12]=(left+right)/(left-right);out[13]=(top+bottom)/(bottom-top);out[14]=near/(near-far);out[15]=1;return out;}
// Right-handed perspective with WebGPU's 0–1 depth range.
export function perspective(out,fov,aspect,near,far){const f=1/Math.tan(fov/2);out.fill(0);out[0]=f/aspect;out[5]=f;out[10]=far/(near-far);out[11]=-1;out[14]=near*far/(near-far);return out;}
