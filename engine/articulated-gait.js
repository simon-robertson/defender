import {shortestAngle} from './path-motion.js';
import {impactLegTarget,impactFootRotation} from './enemy-impact.js';

const clamp=value=>Math.max(-1,Math.min(1,value));
// Walker keeps its longer straight stride; a broader yaw blend and a tiny
// turn-only stance widening keep the broad toes from crossing.
export const WALKER_WALK=Object.freeze({speed:18,cycleSeconds:1/3,stanceFraction:.55,lift:.7,crouch:0,turnDistance:12});
// Four diagonal legs take 2.88-unit steps at a slower cadence. Feet tuck slightly
// inward on turns; a low swing keeps the original folded knee housings separate.
// Negative crouch remains the same constant support pose, not a bob.
export const SPIDER_WALK=Object.freeze({speed:12,cycleSeconds:.24,stanceFraction:.55,lift:.2,crouch:-.75,turnDistance:12,turnInset:.5});
const CHAINS={walker:[['thigh-l','shin-l','foot-l',0],['thigh-r','shin-r','foot-r',.5]],spider:['fl','fr','rl','rr'].map((name,i)=>['upper-'+name,'lower-'+name,'foot-'+name,[0,.5,.5,0][i]])};

// Minimal link rotation avoids twisting the accepted rectangular joint housings.
// The actual gait stays well away from antiparallel link targets.
function mapLink(out,rest,x,y,z){
 const ax=rest[0],ay=rest[1],az=rest[2],vx=ay*z-az*y,vy=az*x-ax*z,vz=ax*y-ay*x,k=1/(1+ax*x+ay*y+az*z);
 out[0]=1-(vy*vy+vz*vz)*k;out[1]=-vz+vx*vy*k;out[2]=vy+vx*vz*k;
 out[3]=vz+vy*vx*k;out[4]=1-(vx*vx+vz*vz)*k;out[5]=-vx+vy*vz*k;
 out[6]=-vy+vz*vx*k;out[7]=vx+vz*vy*k;out[8]=1-(vx*vx+vy*vy)*k;
}
function relative(out,a,b){for(let i=0;i<3;i++)for(let j=0;j<3;j++)out[i*3+j]=a[i]*b[j]+a[3+i]*b[3+j]+a[6+i]*b[6+j];}
function rotate(rig,id,m){const cy=Math.hypot(m[0],m[3]);rig.setRotation(id,cy>1e-8?Math.atan2(m[7],m[8]):Math.atan2(-m[5],m[4]),Math.asin(clamp(-m[6])),cy>1e-8?Math.atan2(m[3],m[0]):0);}

// Two-link IK uses actual folded bind vectors. Contact transforms are cached
// per stride, including yaw, and feet counter-rotate to stay flat and planted.
export class ArticulatedGait {
 constructor(rig,path,groundHeight,model,settings=model==='walker'?WALKER_WALK:SPIDER_WALK){
  if(!CHAINS[model])throw new Error('Unsupported articulated enemy.');
  this.model=model;this.rig=rig;this.path=path;this.groundHeight=groundHeight;this.settings=settings;
  this.sample=new Float64Array(3);this.upperRotation=new Float64Array(9);this.lowerRotation=new Float64Array(9);this.scratch=new Float64Array(9);
  this.impactTarget=new Float64Array(3);
  this.feet=CHAINS[model].map(([upperId,lowerId,pawId,offset])=>{
   const upper=rig.byId.get(upperId),lower=rig.byId.get(lowerId),paw=rig.byId.get(pawId);
   if(!upper||!lower||!paw||lower.parent!==upper||paw.parent!==lower)throw new Error('Enemy is missing its articulated leg chain.');
   const hip=upper.part.pivot,knee=lower.part.pivot,ankle=paw.part.pivot;
   const ax=knee[0]-hip[0],ay=knee[1]-hip[1],az=knee[2]-hip[2],bx=ankle[0]-knee[0],by=ankle[1]-knee[1],bz=ankle[2]-knee[2],l1=Math.hypot(ax,ay,az),l2=Math.hypot(bx,by,bz),length=Math.hypot(ax+bx,ay+by,az+bz);
   let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;const n=Math.hypot(nx,ny,nz);nx/=n;ny/=n;nz/=n;
   if(!l1||!l2||!n||!length||ankle[1]!==1)throw new Error('Enemy requires folded two-link legs and one-unit ankles.');
   return {name:pawId,upper:upperId,lower:lowerId,paw:pawId,hip,ankle,l1,l2,offset,normal:new Float64Array([nx,ny,nz]),direction:new Float64Array([(ax+bx)/length,(ay+by)/length,(az+bz)/length]),upperDirection:new Float64Array([ax/l1,ay/l1,az/l1]),lowerDirection:new Float64Array([bx/l2,by/l2,bz/l2]),position:new Float64Array(3),from:new Float64Array(3),to:new Float64Array(3),contact:NaN,nextContact:NaN,yaw:0,phase:0,stance:true,reach:0};
  });
 }
 anchor(distance,foot,out){
  this.path.sample(distance,this.sample);const c=Math.cos(this.sample[2]),s=Math.sin(this.sample[2]);
  const spread=this.model==='walker'?.35:-(this.settings.turnInset??0);
  const x=foot.ankle[0]-12+Math.sign(foot.ankle[0]-12)*spread*Math.abs(Math.sin(this.sample[2]*2)),z=foot.ankle[2]-12;
  out[0]=this.sample[0]+c*x+s*z;out[1]=this.sample[1]-s*x+c*z;out[2]=this.sample[2];
 }
 pose(distance,x,z,yaw,balance=null){
  const rule=this.settings,stride=rule.speed*rule.cycleSeconds,stance=rule.stanceFraction,c=Math.cos(yaw),s=Math.sin(yaw),ru=this.upperRotation,rl=this.lowerRotation,tmp=this.scratch;
  for(let i=0;i<this.feet.length;i++){
   const foot=this.feet[i],cycles=distance/stride+foot.offset,cycle=Math.floor(cycles),phase=cycles-cycle,contact=(cycle-foot.offset+stance/2)*stride;
   if(foot.contact!==contact){this.anchor(contact,foot,foot.from);foot.contact=contact;}
   let fx=foot.from[0],fz=foot.from[1],fy=this.groundHeight+1,footYaw=foot.from[2];foot.phase=phase;foot.stance=phase<stance;
   if(!foot.stance){
    if(foot.nextContact!==contact+stride){this.anchor(contact+stride,foot,foot.to);foot.nextContact=contact+stride;}
    const p=(phase-stance)/(1-stance),ease=p*p*(3-2*p);fx+=(foot.to[0]-fx)*ease;fz+=(foot.to[1]-fz)*ease;footYaw+=shortestAngle(foot.to[2]-footYaw)*ease;fy+=rule.lift*Math.sin(Math.PI*p)**2;
   }
   foot.position[0]=fx;foot.position[1]=fy;foot.position[2]=fz;foot.yaw=footYaw;
   let dx=c*(fx-x)-s*(fz-z)-(foot.hip[0]-12),dz=s*(fx-x)+c*(fz-z)-(foot.hip[2]-12),dy=fy-(this.groundHeight-rule.crouch+foot.hip[1]);
   if(balance){impactLegTarget(this.impactTarget,balance,foot.hip,fx,fy,fz,x,z,c,s,this.groundHeight-rule.crouch);dx=this.impactTarget[0];dy=this.impactTarget[1];dz=this.impactTarget[2];}
   const reach=Math.hypot(dx,dy,dz),l1=foot.l1,l2=foot.l2;
   foot.reach=reach;if(reach>=l1+l2||reach<=Math.abs(l1-l2))throw new Error('Enemy foot target is outside its leg reach.');
   if(this.model==='walker'){
    // Fixed X hip bearings preserve shoulder clearance; the lower joint supplies
    // the small lateral correction needed while a foot stays planted on a turn.
   const kx=foot.upperDirection[0]*l1,ay=foot.upperDirection[1]*l1,az=foot.upperDirection[2]*l1,planarLength=Math.hypot(ay,az),planarReach=Math.hypot(dy,dz),uy=dy/planarReach,uz=dz/planarReach;
   const along=(l1*l1-l2*l2+reach*reach-2*dx*kx)/(2*planarReach),height=Math.sqrt(Math.max(0,planarLength*planarLength-along*along));
   if(Math.abs(along)>planarLength+1e-8)throw new Error('Enemy hinge target is outside reach.');
   const sign=(-uz*ay+uy*az)>=0?1:-1,ky=uy*along-uz*height*sign,kz=uz*along+uy*height*sign;
   const angle=Math.atan2(ay*kz-az*ky,ay*ky+az*kz),ca=Math.cos(angle),sa=Math.sin(angle);
   ru[0]=1;ru[1]=0;ru[2]=0;ru[3]=0;ru[4]=ca;ru[5]=-sa;ru[6]=0;ru[7]=sa;ru[8]=ca;mapLink(rl,foot.lowerDirection,(dx-kx)/l2,(dy-ky)/l2,(dz-kz)/l2);
   }else{
    // Spider bend planes follow each target; the constant body support height
    // gives its folded knees enough clearance for the flat-footed swing.
   const ux=dx/reach,uy=dy/reach,uz=dz/reach,d=foot.direction,n=foot.normal,qx=d[1]*uz-d[2]*uy,qy=d[2]*ux-d[0]*uz,qz=d[0]*uy-d[1]*ux,dot=d[0]*ux+d[1]*uy+d[2]*uz;
   let nx=n[0],ny=n[1],nz=n[2];
   // Minimal rotation transports the bend plane with the target direction.
   // The antiparallel case uses a half-turn about the bind plane normal.
   if(dot>-.999999999){let kx=qy*nz-qz*ny,ky=qz*nx-qx*nz,kz=qx*ny-qy*nx,scale=1/(1+dot);nx+=kx+(qy*kz-qz*ky)*scale;ny+=ky+(qz*kx-qx*kz)*scale;nz+=kz+(qx*ky-qy*kx)*scale;}
   const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
   const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along)),kx=ux*along+(uy*nz-uz*ny)*height,ky=uy*along+(uz*nx-ux*nz)*height,kz=uz*along+(ux*ny-uy*nx)*height;
   mapLink(ru,foot.upperDirection,kx/l1,ky/l1,kz/l1);
   // Preserve the upper joint orientation while bending the lower link,
   // avoiding an unnecessary twist across the open knee connector.
   const rest=foot.lowerDirection;tmp[0]=ru[0]*rest[0]+ru[1]*rest[1]+ru[2]*rest[2];tmp[1]=ru[3]*rest[0]+ru[4]*rest[1]+ru[5]*rest[2];tmp[2]=ru[6]*rest[0]+ru[7]*rest[1]+ru[8]*rest[2];
   mapLink(rl,tmp,(dx-kx)/l2,(dy-ky)/l2,(dz-kz)/l2);
   for(let i=0;i<3;i++)for(let j=0;j<3;j++)tmp[i*3+j]=rl[i*3]*ru[j]+rl[i*3+1]*ru[3+j]+rl[i*3+2]*ru[6+j];rl.set(tmp);
   }
   rotate(this.rig,foot.upper,ru);relative(tmp,ru,rl);rotate(this.rig,foot.lower,tmp);
   const delta=shortestAngle(footYaw-yaw),cd=Math.cos(delta),sd=Math.sin(delta);
   if(balance)impactFootRotation(tmp,balance,rl,delta);
   else for(let row=0;row<3;row++){tmp[row*3]=rl[row]*cd-rl[6+row]*sd;tmp[row*3+1]=rl[3+row];tmp[row*3+2]=rl[row]*sd+rl[6+row]*cd;}
   rotate(this.rig,foot.paw,tmp);
  }
 }
 dispose(){this.feet.length=0;this.rig=null;this.path=null;}
}
