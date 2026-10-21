import {ENEMY_EXPANSION_RIGS} from '../shared/enemy-expansion-rigs.js';
import {ENEMY_MOVEMENT} from '../shared/enemy-roster.js';
import {shortestAngle} from './path-motion.js';
import {setRigRotation} from './enemy-impact.js';

const TAU=Math.PI*2,EMPTY=Object.freeze([]);
export const ENEMY_EXPANSION_MOVEMENT=Object.freeze(Object.fromEntries(Object.entries(ENEMY_MOVEMENT).map(([id,rule])=>[id,Object.freeze({...rule,crouch:id==='tripod'?.5:-(ENEMY_EXPANSION_RIGS[id].groundOffset??0),cycleSeconds:id==='tripod'?4.2/rule.speed:1,stanceFraction:.72,lift:.5})])));

function mapLink(out,rest,x,y,z){
 const ax=rest[0],ay=rest[1],az=rest[2],vx=ay*z-az*y,vy=az*x-ax*z,vz=ax*y-ay*x,k=1/(1+ax*x+ay*y+az*z);
 out[0]=1-(vy*vy+vz*vz)*k;out[1]=-vz+vx*vy*k;out[2]=vy+vx*vz*k;out[3]=vz+vy*vx*k;out[4]=1-(vx*vx+vz*vz)*k;out[5]=-vx+vy*vz*k;out[6]=-vy+vz*vx*k;out[7]=vx+vz*vy*k;out[8]=1-(vx*vx+vy*vy)*k;
}
function chain(rig,leg,index){
 const [upper,lower,paw]=leg.ids,u=rig.byId.get(upper),l=rig.byId.get(lower),f=rig.byId.get(paw);
 if(!u||!l||!f||l.parent!==u||f.parent!==l)throw new Error('Tripod is missing an articulated leg chain.');
 const hip=u.part.pivot,knee=l.part.pivot,ankle=f.part.pivot,ax=knee[0]-hip[0],ay=knee[1]-hip[1],az=knee[2]-hip[2],bx=ankle[0]-knee[0],by=ankle[1]-knee[1],bz=ankle[2]-knee[2],l1=Math.hypot(ax,ay,az),l2=Math.hypot(bx,by,bz),length=Math.hypot(ax+bx,ay+by,az+bz),nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,n=Math.hypot(nx,ny,nz);
 if(!l1||!l2||!length||!n||ankle[1]!==1)throw new Error('Tripod requires folded legs and one-unit ankles.');
 return{name:paw,upper,lower,paw,hip,ankle,l1,l2,offset:index/3,normal:new Float64Array([nx/n,ny/n,nz/n]),direction:new Float64Array([(ax+bx)/length,(ay+by)/length,(az+bz)/length]),upperDirection:new Float64Array([ax/l1,ay/l1,az/l1]),lowerDirection:new Float64Array([bx/l2,by/l2,bz/l2]),position:new Float64Array(3),from:new Float64Array(3),to:new Float64Array(3),contact:NaN,nextContact:NaN,yaw:0,phase:0,stance:true,reach:0};
}

// Conservative joint-chain envelope, calculated once. Tripod's tested gait has
// its own 12-unit support envelope; free wheel/fan rotations use full radii.
function horizontalEnvelope(rig,bank){
 let radius=0,height=0;
 for(const bone of rig.bones){
  let top=bone,reach=0;while(top.parent?.parent){const a=top.part.pivot,b=top.parent.part.pivot;reach+=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);top=top.parent;}
  for(const cell of bone.part.voxels??[])for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
   const p=bone.part.pivot,partReach=Math.hypot(cell[0]+dx-p[0],cell[1]+dy-p[1],cell[2]+dz-p[2]);
   radius=Math.max(radius,bone.parent?Math.hypot(top.part.pivot[0]-12,top.part.pivot[2]-12)+reach+partReach:Math.hypot(cell[0]+dx-12,cell[2]+dz-12));height=Math.max(height,bone.parent?top.part.pivot[1]+reach+partReach:cell[1]+dy);
  }
 }
 return radius+height*Math.sin(bank);
}

// Every joint and scratch array is retained per actor. Cosmetic mechanisms use
// elapsed seconds/distance; only the Tripod needs cached world-space contacts.
export class EnemyExpansionGait {
 constructor(rig,path,groundHeight,model,settings=ENEMY_EXPANSION_MOVEMENT[model]){
  const contract=ENEMY_EXPANSION_RIGS[model];if(!contract||!settings)throw new Error('Unknown expansion enemy.');
  this.rig=rig;this.path=path;this.groundHeight=groundHeight;this.model=model;this.settings=settings;this.contract=contract;
  this.sample=new Float64Array(3);this.upperRotation=new Float64Array(9);this.lowerRotation=new Float64Array(9);this.scratch=new Float64Array(9);this.bodyRoll=this.bodyRollRate=0;
  this.feet=contract.legs?.map((leg,i)=>chain(rig,leg,i))??[];
  this.radius=this.feet.length?12:horizontalEnvelope(rig,(contract.maxBankDegrees??0)*Math.PI/180);
  for(const entries of [contract.wheels,contract.wings,contract.rotors])for(const entry of entries??[])if(!rig.byId.has(entry.id))throw new Error('Expansion enemy is missing '+entry.id);
 }
 anchor(distance,foot,out){
  this.path.sample(distance,this.sample);const c=Math.cos(this.sample[2]),s=Math.sin(this.sample[2]),x=foot.ankle[0]-12,z=foot.ankle[2]-12;
  out[0]=this.sample[0]+c*x+s*z;out[1]=this.sample[1]-s*x+c*z;out[2]=this.sample[2];
 }
 pose(distance,x,z,yaw,_balance=null,time=distance/this.settings.speed,yawRate=0,yawAcceleration=0){
  const contract=this.contract,rig=this.rig,maxBank=(contract.maxBankDegrees??0)*Math.PI/180,bank=maxBank?Math.tanh(yawRate*.12/maxBank):0;
  this.bodyRoll=maxBank*bank;this.bodyRollRate=maxBank?(1-bank*bank)*yawAcceleration*.12:0;
  for(const wheel of contract.wheels??EMPTY)rig.setRotation(wheel.id,(-time*this.settings.speed/wheel.radius)%TAU,0,0);
  const wings=contract.wings??EMPTY;
  if(wings.length){
   // Left/right partners have the same phase. Retain the original +0 and
   // multiplication order, including signed-zero behaviour at reset.
   const front=Math.sin(time*TAU*4.5+0),rear=wings.length>2?Math.sin(time*TAU*4.5+.35*Math.PI):front;
   for(let i=0;i<wings.length;i++){const wing=wings[i],angle=wing.sign*contract.maxFlapDegrees*Math.PI/180*(i>=2?rear:front);rig.setRotation(wing.id,0,0,angle);}
  }
  for(let i=0;i<(contract.rotors?.length??0);i++)rig.setRotation(contract.rotors[i].id,0,(time*TAU*7*(i%2?-1:1))%TAU,0);
  if(this.feet.length)this.poseFeet(distance,x,z,yaw);
 }
 poseFeet(distance,x,z,yaw){
  const rule=this.settings,stride=rule.speed*rule.cycleSeconds,stance=rule.stanceFraction,c=Math.cos(yaw),s=Math.sin(yaw),ru=this.upperRotation,rl=this.lowerRotation,tmp=this.scratch;
  for(const foot of this.feet){
   const cycles=distance/stride+foot.offset,cycle=Math.floor(cycles),phase=cycles-cycle,contact=(cycle-foot.offset+stance/2)*stride;
   if(foot.contact!==contact){this.anchor(contact,foot,foot.from);foot.contact=contact;}
   let fx=foot.from[0],fz=foot.from[1],fy=this.groundHeight+1,footYaw=foot.from[2];foot.phase=phase;foot.stance=phase<stance;
   if(!foot.stance){if(foot.nextContact!==contact+stride){this.anchor(contact+stride,foot,foot.to);foot.nextContact=contact+stride;}const p=(phase-stance)/(1-stance),ease=p*p*(3-2*p);fx+=(foot.to[0]-fx)*ease;fz+=(foot.to[1]-fz)*ease;footYaw+=shortestAngle(foot.to[2]-footYaw)*ease;fy+=rule.lift*Math.sin(Math.PI*p)**2;}
   foot.position[0]=fx;foot.position[1]=fy;foot.position[2]=fz;foot.yaw=footYaw;
   const dx=c*(fx-x)-s*(fz-z)-(foot.hip[0]-12),dz=s*(fx-x)+c*(fz-z)-(foot.hip[2]-12),dy=fy-(this.groundHeight-rule.crouch+foot.hip[1]),reach=Math.hypot(dx,dy,dz),l1=foot.l1,l2=foot.l2;
   foot.reach=reach;if(reach>=l1+l2||reach<=Math.abs(l1-l2))throw new Error('Tripod foot target is outside its leg reach.');
   const ux=dx/reach,uy=dy/reach,uz=dz/reach,d=foot.direction,n=foot.normal,qx=d[1]*uz-d[2]*uy,qy=d[2]*ux-d[0]*uz,qz=d[0]*uy-d[1]*ux,dot=d[0]*ux+d[1]*uy+d[2]*uz;
   let nx=n[0],ny=n[1],nz=n[2];
   if(dot>-.999999999){const kx=qy*nz-qz*ny,ky=qz*nx-qx*nz,kz=qx*ny-qy*nx,scale=1/(1+dot);nx+=kx+(qy*kz-qz*ky)*scale;ny+=ky+(qz*kx-qx*kz)*scale;nz+=kz+(qx*ky-qy*kx)*scale;}
   const nl=Math.hypot(nx,ny,nz);nx/=nl;ny/=nl;nz/=nl;
   const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along)),kx=ux*along+(uy*nz-uz*ny)*height,ky=uy*along+(uz*nx-ux*nz)*height,kz=uz*along+(ux*ny-uy*nx)*height;
   mapLink(ru,foot.upperDirection,kx/l1,ky/l1,kz/l1);const rest=foot.lowerDirection;tmp[0]=ru[0]*rest[0]+ru[1]*rest[1]+ru[2]*rest[2];tmp[1]=ru[3]*rest[0]+ru[4]*rest[1]+ru[5]*rest[2];tmp[2]=ru[6]*rest[0]+ru[7]*rest[1]+ru[8]*rest[2];mapLink(rl,tmp,(dx-kx)/l2,(dy-ky)/l2,(dz-kz)/l2);
   for(let i=0;i<3;i++)for(let j=0;j<3;j++)tmp[i*3+j]=rl[i*3]*ru[j]+rl[i*3+1]*ru[3+j]+rl[i*3+2]*ru[6+j];rl.set(tmp);
   setRigRotation(this.rig,foot.upper,ru);for(let i=0;i<3;i++)for(let j=0;j<3;j++)tmp[i*3+j]=ru[i]*rl[j]+ru[3+i]*rl[3+j]+ru[6+i]*rl[6+j];setRigRotation(this.rig,foot.lower,tmp);
   const delta=shortestAngle(footYaw-yaw),cd=Math.cos(delta),sd=Math.sin(delta);for(let row=0;row<3;row++){tmp[row*3]=rl[row]*cd-rl[6+row]*sd;tmp[row*3+1]=rl[3+row];tmp[row*3+2]=rl[row]*sd+rl[6+row]*cd;}setRigRotation(this.rig,foot.paw,tmp);
  }
 }
 dispose(){this.feet.length=0;this.rig=this.path=null;}
}
