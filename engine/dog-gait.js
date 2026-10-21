import {shortestAngle} from './path-motion.js';
import {impactLegTarget,impactFootRotation,setRigRotation} from './enemy-impact.js';

const LEG_NAMES=['fl','fr','rl','rr'],PHASES=[0,.5,.5,0];
const clamp=value=>Math.max(-1,Math.min(1,value));
export const DOG_WALK=Object.freeze({speed:12,cycleSeconds:.4,stanceFraction:.55,lift:1.2,crouch:1,turnDistance:6});

// Analytic contact timing uses distance rather than accumulated frame phases.
// Sampling a stance repeatedly returns the same world-space paw transform even
// through a turn. Swing feet interpolate two contacts and lift above the floor.
export class DogGait {
 constructor(rig,path,groundHeight,settings=DOG_WALK){
  this.rig=rig;this.path=path;this.groundHeight=groundHeight;this.settings=settings;
  this.sample=new Float64Array(3);
  this.impactTarget=new Float64Array(3);this.impactLower=new Float64Array(9);this.impactPaw=new Float64Array(9);
  this.feet=LEG_NAMES.map((name,index)=>{
   const upper=rig.byId.get('leg-'+name),lower=rig.byId.get('shin-'+name),paw=rig.byId.get('paw-'+name);
   if(!upper||!lower||!paw||lower.parent!==upper||paw.parent!==lower)throw new Error('Dog is missing its articulated leg chain.');
   const hip=upper.part.pivot,knee=lower.part.pivot,ankle=paw.part.pivot;
   if(hip[0]!==knee[0]||hip[2]!==knee[2]||hip[0]!==ankle[0]||hip[2]!==ankle[2]||hip[1]-knee[1]!==4||knee[1]-ankle[1]!==4||ankle[1]!==1)throw new Error('Dog requires aligned 4 + 4 unit legs and 1-unit ankles.');
   return {name,upper:upper.part.id,lower:lower.part.id,paw:paw.part.id,hip,offset:PHASES[index],position:new Float64Array(3),yaw:0,stance:true,phase:0,reach:0,
    contact:NaN,nextContact:NaN,from:new Float64Array(3),to:new Float64Array(3)};
  });
 }
 anchor(distance,foot,out){
  this.path.sample(distance,this.sample);const c=Math.cos(this.sample[2]),s=Math.sin(this.sample[2]),x=foot.hip[0]-12,z=foot.hip[2]-12;
  out[0]=this.sample[0]+c*x+s*z;out[1]=this.sample[1]-s*x+c*z;out[2]=this.sample[2];
 }
 pose(distance,x,z,yaw,balance=null){
  const rule=this.settings,stride=rule.speed*rule.cycleSeconds,stance=rule.stanceFraction,c=Math.cos(yaw),s=Math.sin(yaw);
  for(let i=0;i<this.feet.length;i++){
   const foot=this.feet[i],cycles=distance/stride+foot.offset,cycle=Math.floor(cycles),phase=cycles-cycle;
   const contact=(cycle-foot.offset+stance/2)*stride;
   // A contact stays fixed for the whole stride. Cache world-space anchors,
   // while still solving the moving body's leg pose every frame. Distance keys
   // also handle skipped strides, backwards samples and preview route wraps.
   if(foot.contact!==contact){this.anchor(contact,foot,foot.from);foot.contact=contact;}
   let fx=foot.from[0],fz=foot.from[1],fy=this.groundHeight+1,footYaw=foot.from[2];
   foot.phase=phase;foot.stance=phase<stance;
   if(!foot.stance){
    if(foot.nextContact!==contact+stride){this.anchor(contact+stride,foot,foot.to);foot.nextContact=contact+stride;}
    const p=(phase-stance)/(1-stance),ease=p*p*(3-2*p);
    fx+=(foot.to[0]-fx)*ease;fz+=(foot.to[1]-fz)*ease;footYaw+=shortestAngle(foot.to[2]-footYaw)*ease;
    fy+=rule.lift*Math.sin(Math.PI*p)**2+(balance?balance.brace*.8*Math.sin(Math.PI*p):0);
   }
   foot.position[0]=fx;foot.position[1]=fy;foot.position[2]=fz;foot.yaw=footYaw;
   let dx=c*(fx-x)-s*(fz-z)-(foot.hip[0]-12),dz=s*(fx-x)+c*(fz-z)-(foot.hip[2]-12),dy=fy-(this.groundHeight-rule.crouch+foot.hip[1]);
   if(balance){impactLegTarget(this.impactTarget,balance,foot.hip,fx,fy,fz,x,z,c,s,this.groundHeight-rule.crouch);dx=this.impactTarget[0];dy=this.impactTarget[1];dz=this.impactTarget[2];}
   const reach=Math.hypot(dx,dy,dz);foot.reach=reach;if(reach>8+1e-8||reach<1e-8)throw new Error('Dog paw target is outside its leg reach.');
   const knee=Math.acos(clamp((reach*reach-32)/32)),hipX=Math.atan2(-dz,Math.hypot(dx,dy))-Math.acos(clamp(reach/8)),hipZ=Math.atan2(dx,-dy);
   this.rig.setRotation(foot.upper,hipX,0,hipZ);this.rig.setRotation(foot.lower,knee,0,0);
   // Invert the full hip/knee orientation, then restore the contact's world yaw.
   // This keeps every sole flat and stationary in stance, including on bends.
   const sum=hipX+knee,cs=Math.cos(sum),ss=Math.sin(sum),cz=Math.cos(hipZ),sz=Math.sin(hipZ),delta=shortestAngle(footYaw-yaw),cd=Math.cos(delta),sd=Math.sin(delta);
   if(balance){
    const r=this.impactLower;r[0]=cz;r[1]=-sz*cs;r[2]=sz*ss;r[3]=sz;r[4]=cz*cs;r[5]=-cz*ss;r[6]=0;r[7]=ss;r[8]=cs;
    impactFootRotation(this.impactPaw,balance,r,delta);setRigRotation(this.rig,foot.paw,this.impactPaw);
   }else this.rig.setRotation(foot.paw,Math.atan2(-ss*cz,ss*sz*sd+cs*cd),Math.asin(clamp(cs*sd-ss*sz*cd)),Math.atan2(-cs*sz*cd-ss*sd,cz*cd));
  }
 }
 dispose(){this.feet.length=0;this.rig=null;this.path=null;}
}
