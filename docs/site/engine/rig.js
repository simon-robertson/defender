import {identity,multiply} from '../shared/math.js';

// Pivot rotation followed by a translation in the part's rotated local axes.
// Recoil therefore follows the barrels even when their yaw changes. The caller
// owns all storage; angles are radians, translations are world units.
function compose(out,pivot,t,r){
 // Most hinges rotate around one axis. Preserve sin(-0) while avoiding trig
 // for the unchanged axes; matrix arithmetic and its evaluation order stay exact.
 let sx=r[0],cx=1,sy=r[1],cy=1,sz=r[2],cz=1;
 if(sx!==0){cx=Math.cos(sx);sx=Math.sin(sx);}
 if(sy!==0){cy=Math.cos(sy);sy=Math.sin(sy);}
 if(sz!==0){cz=Math.cos(sz);sz=Math.sin(sz);}
 out[0]=cz*cy;out[1]=sz*cy;out[2]=-sy;out[3]=0;
 out[4]=cz*sy*sx-sz*cx;out[5]=sz*sy*sx+cz*cx;out[6]=cy*sx;out[7]=0;
 out[8]=cz*sy*cx+sz*sx;out[9]=sz*sy*cx-cz*sx;out[10]=cy*cx;out[11]=0;
 for(let i=0;i<3;i++)out[12+i]=pivot[i]+out[i]*(t[0]-pivot[0])+out[4+i]*(t[1]-pivot[1])+out[8+i]*(t[2]-pivot[2]);out[15]=1;
}
export class PoseRig {
 constructor(rig,onChange){
  this.root=rig.root;this.onChange=onChange;this.bones=[];this.byId=new Map();this.rootDirty=false;
  const parts=new Map(rig.parts.map(p=>[p.id,p])),instances=new Map(rig.instances.map(i=>[i.part,i]));
  const visit=part=>{
   if(this.byId.has(part.id))return this.byId.get(part.id);
   const parent=part.parent?visit(parts.get(part.parent)):null;
   const bone={part,parent,instance:instances.get(part.id),translation:new Float64Array(3),rotation:new Float64Array(3),local:identity(),pose:identity(),dirty:false,changed:false};
   this.bones.push(bone);this.byId.set(part.id,bone);return bone;
  };
  for(const part of rig.parts)visit(part);
 }
 setTranslation(id,x,y,z){this.setChannel(id,'translation',x,y,z);}
 setRotation(id,x,y,z){this.setChannel(id,'rotation',x,y,z);}
 setChannel(id,channel,x,y,z){
  const bone=this.byId.get(id);if(!bone)throw new Error('Unknown rig part: '+id);const values=bone[channel];
  if(values[0]===x&&values[1]===y&&values[2]===z)return;
  values[0]=x;values[1]=y;values[2]=z;bone.dirty=true;
 }
 invalidateRoot(){this.rootDirty=true;}
 update(){
  let changed=0;
  for(let i=0;i<this.bones.length;i++){
   const b=this.bones[i];b.changed=b.dirty||this.rootDirty||Boolean(b.parent?.changed);if(!b.changed)continue;
   if(b.dirty)compose(b.local,b.part.pivot,b.translation,b.rotation);
   if(b.parent)multiply(b.pose,b.parent.pose,b.local);else b.pose.set(b.local);
   const instance=b.instance;multiply(instance.matrix,this.root,b.pose);this.onChange(instance.key,instance.index,instance.matrix);b.dirty=false;changed++;
  }
  this.rootDirty=false;return changed;
 }
}
