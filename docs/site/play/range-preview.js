const SEGMENTS=96;
const CIRCLE=Array.from({length:SEGMENTS},(_,index)=>{const angle=index*Math.PI*2/SEGMENTS;return [Math.cos(angle),Math.sin(angle)];});

/** Read the session's configured tiers; preview defaults never supply ranges. */
export function unitRangePreview(unit,defences,upgrade=false){
 if(!unit)return null;
 const family=defences?.[unit.model??'turret-study'],variants=family?.enabledVariants??[],index=variants.indexOf(unit.variant);
 if(family?.kind==='enhancer'||unit.kind==='enhancer')return null;
 const variant=upgrade?(index>=0?variants[index+1]:unit.nextVariant):unit.variant;
 if(!variant)return null;
 const stats=family?.variants[variant]?.stats??(upgrade?unit.nextStats:unit.stats),range=stats?.maxRange;
 return Number.isFinite(range)&&range>0?{variant,range,upgrade}:null;
}

/** Horizontal centre-distance range, projected at the deployed ground plane. */
export class UnitRangeGeometry {
 constructor(){this.signature=[];this.points=[];this.changed=false;}
 reset(){this.signature.length=0;this.points.length=0;this.changed=true;}
 project(rig,camera,range,width,height){
  this.changed=false;
  if(rig?.role!=='defence'||!rig.root||!camera?.vp||!Number.isFinite(range)||range<=0||width<=0||height<=0){this.reset();return null;}
  const root=rig.root,vp=camera.vp,pivot=rig.model==='turret-study'?rig.parts?.find(part=>part.id==='head')?.pivot:null;
  const localX=pivot?.[0]??12,localZ=pivot?.[2]??12;
  const x=root[0]*localX+root[8]*localZ+root[12],y=root[1]*localX+root[9]*localZ+root[13],z=root[2]*localX+root[10]*localZ+root[14];
  const signature=this.signature;
  let changed=signature.length!==22||signature[0]!==x||signature[1]!==y||signature[2]!==z||signature[3]!==range||signature[4]!==width||signature[5]!==height;
  for(let index=0;index<16;index++)if(signature[index+6]!==vp[index])changed=true;
  if(!changed)return this.points.length?this.points:null;
  signature[0]=x;signature[1]=y;signature[2]=z;signature[3]=range;signature[4]=width;signature[5]=height;
  for(let index=0;index<16;index++)signature[index+6]=vp[index];this.changed=true;
  for(let index=0;index<SEGMENTS;index++){
   const wx=x+CIRCLE[index][0]*range,wz=z+CIRCLE[index][1]*range,w=vp[3]*wx+vp[7]*y+vp[11]*wz+vp[15];
   // Preparation uses the overview. Reject a circle crossing the eye plane
   // rather than drawing an inverted or unbounded perspective overlay.
   if(!Number.isFinite(w)||w<=1e-6){this.points.length=0;this.signature.length=0;return null;}
   const px=((vp[0]*wx+vp[4]*y+vp[8]*wz+vp[12])/w+1)*width*.5,py=(1-(vp[1]*wx+vp[5]*y+vp[9]*wz+vp[13])/w)*height*.5;
   if(!Number.isFinite(px)||!Number.isFinite(py)){this.reset();return null;}
   const point=this.points[index]??(this.points[index]={x:0,y:0});point.x=px;point.y=py;
  }
  return this.points;
 }
}
