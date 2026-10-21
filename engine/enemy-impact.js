import {TURRET_RECOIL} from '../shared/arsenal.js';

export const ENEMY_IMPACT=Object.freeze({kick:32,minPushFraction:.65,omega:4,maxOffset:3,maxSpeed:40,seconds:2,radius:12,spanSeconds:.1,maxSpans:32,searchSteps:7});
export const ENEMY_BALANCE=Object.freeze({dog:Object.freeze({pitch:8,roll:8,bob:-.35,push:1}),walker:Object.freeze({pitch:10,roll:8,bob:-.75,push:1}),spider:Object.freeze({pitch:10,roll:2,bob:.65,push:1})});
const RIGID_BALANCE=Object.freeze({pitch:0,roll:0,bob:0,push:1}),AIR_BALANCE=Object.freeze({pitch:0,roll:0,bob:0,push:.25});
const {omega}=ENEMY_IMPACT,EPS=1e-6;
// Shared rigid-body IK helpers. Matrices are row-major in the leg solver;
// model/renderer matrices remain the existing column-major convention.
export function setImpactBalance(balance,pitch,roll,bob){
 balance.pitch=pitch;balance.roll=roll;balance.bob=bob;
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),r=balance.rotation;
 r[0]=cr;r[1]=-sr*cp;r[2]=sr*sp;r[3]=sr;r[4]=cr*cp;r[5]=-cr*sp;r[6]=0;r[7]=sp;r[8]=cp;
}
export function impactLegTarget(out,balance,hip,fx,fy,fz,x,z,c,s,rootY){
 const p=balance.pivot,r=balance.rotation,dx=c*(fx-x)-s*(fz-z)+12-p[0],dy=fy-rootY-balance.bob-p[1],dz=s*(fx-x)+c*(fz-z)+12-p[2];
 out[0]=p[0]+r[0]*dx+r[3]*dy+r[6]*dz-hip[0];out[1]=p[1]+r[1]*dx+r[4]*dy+r[7]*dz-hip[1];out[2]=p[2]+r[2]*dx+r[5]*dy+r[8]*dz-hip[2];
}
export function impactFootRotation(out,balance,lower,delta){
 const b=balance.rotation,d=balance.footDesired,cd=Math.cos(delta),sd=Math.sin(delta);
 for(let row=0;row<3;row++){d[row*3]=b[row]*cd-b[6+row]*sd;d[row*3+1]=b[3+row];d[row*3+2]=b[row]*sd+b[6+row]*cd;}
 for(let row=0;row<3;row++)for(let col=0;col<3;col++)out[row*3+col]=lower[row]*d[col]+lower[3+row]*d[3+col]+lower[6+row]*d[6+col];
}
export function setRigRotation(rig,id,m){
 const cy=Math.hypot(m[0],m[3]);rig.setRotation(id,cy>1e-8?Math.atan2(m[7],m[8]):Math.atan2(-m[5],m[4]),Math.asin(Math.max(-1,Math.min(1,-m[6]))),cy>1e-8?Math.atan2(m[3],m[0]):0);
}
const value=(a,v,t)=>(a+(v+omega*a)*t)*Math.exp(-omega*t);
function axisRange(out,index,a,v,lo,hi){
 const first=value(a,v,lo),last=value(a,v,hi);out[index]=Math.min(first,last);out[index+1]=Math.max(first,last);
 const b=v+omega*a,t=b?v/(omega*b):-1;
 if(t>lo&&t<hi){const peak=value(a,v,t);out[index]=Math.min(out[index],peak);out[index+1]=Math.max(out[index+1],peak);}
}
function peakAt(maximum,x,z,vx,vz,t){
 if(t<=0||t>ENEMY_IMPACT.seconds)return maximum;
 const px=value(x,vx,t),pz=value(z,vz,t);return Math.max(maximum,px*px+pz*pz);
}
function withinCap(x,z,vx,vz,cap=ENEMY_IMPACT.maxOffset){
 const bx=vx+omega*x,bz=vz+omega*z,b2=bx*bx+bz*bz;
 let maximum=x*x+z*z;
 maximum=peakAt(maximum,x,z,vx,vz,ENEMY_IMPACT.seconds);
 // Squared displacement has at most two stationary points. Check them exactly
 // rather than depending on the frame rate to catch the displacement peak.
 if(b2){
  const a=-omega*b2,b=b2-2*omega*(x*bx+z*bz),c=x*vx+z*vz,d=b*b-4*a*c;
  if(d>=0){const root=Math.sqrt(d);maximum=peakAt(maximum,x,z,vx,vz,(-b-root)/(2*a));maximum=peakAt(maximum,x,z,vx,vz,(-b+root)/(2*a));}
 }
 return maximum<=cap**2;
}
function overlaps(a,b,i=0){return a[0]<b[i+3]-EPS&&a[3]>b[i]+EPS&&a[1]<b[i+4]-EPS&&a[4]>b[i+1]+EPS&&a[2]<b[i+5]-EPS&&a[5]>b[i+2]+EPS;}

// The original legged gaits use a 12-unit radius; expansion actors supply a
// conservative model-specific radius. Bound Y
// independently by joint-chain lengths, allowing any leg rotation while the
// body stays upright. This deliberately overestimates empty space near limbs.
export function enemyImpactHeight(rig,crouch){
 let height=0;
 for(const bone of rig.bones){
  let top=bone,reach=0;
  while(top.parent?.parent){const a=top.part.pivot,b=top.parent.part.pivot;reach+=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);top=top.parent;}
  for(const cell of bone.part.voxels??[])for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
   const p=bone.part.pivot;
   height=Math.max(height,bone.parent?top.part.pivot[1]+reach+Math.hypot(cell[0]+dx-p[0],cell[1]+dy-p[1],cell[2]+dz-p[2]):cell[1]+dy);
  }
 }
 return height+Math.abs(crouch);
}

function defenceBounds(world){
 const result=[];
 for(const data of world.rigs.values())if(data.role==='defence')for(const part of data.parts){
  let x0=Infinity,y0=Infinity,z0=Infinity,x1=-Infinity,y1=-Infinity,z1=-Infinity,radius=0;
  for(const cell of part.voxels??[])for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
   const x=cell[0]+dx,y=cell[1]+dy,z=cell[2]+dz;
   x0=Math.min(x0,x);y0=Math.min(y0,y);z0=Math.min(z0,z);x1=Math.max(x1,x);y1=Math.max(y1,y);z1=Math.max(z1,z);
   radius=Math.max(radius,part.id==='guns'?Math.hypot(x-part.pivot[0],y-part.pivot[1],z-part.pivot[2]):Math.hypot(x-12,z-12));
  }
  if(!Number.isFinite(x0))continue;
  if(data.model==='turret-study'&&part.id!=='base'){
   if(part.id==='guns'){radius+=TURRET_RECOIL.distance;y0=part.pivot[1]-radius;y1=part.pivot[1]+radius;radius+=Math.hypot(part.pivot[0]-12,part.pivot[2]-12);}
   x0=z0=12-radius;x1=z1=12+radius;
  }
  const m=data.root,b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const x of [x0,x1])for(const y of [y0,y1])for(const z of [z0,z1])for(let axis=0;axis<3;axis++){
   const p=m[axis]*x+m[4+axis]*y+m[8+axis]*z+m[12+axis];b[axis]=Math.min(b[axis],p);b[axis+3]=Math.max(b[axis+3],p);
  }
  result.push(...b);
 }
 return new Float64Array(result);
}

// Scene-owned, lazy on the first real directional hit. All scratch and terrain
// data are reused; queries allocate nothing and run only when an impulse arrives.
export class EnemyImpactClearance {
 constructor(world){
  this.visibility=world.visibility;this.columns=world.level.size[0];this.rows=world.level.size[1];this.ground=world.level.pathHeight;
  this.heights=new Int16Array(this.columns*this.rows).fill(world.level.terrain.defaultHeight);
  for(const box of world.level.terrain.boxes)this.heights[box.box[0]+box.box[1]*this.columns]=box.water?-1:box.ground;
  for(const bridge of world.level.bridges??[])for(const [x,z]of bridge.boxes)this.heights[x+z*this.columns]=this.ground;
  this.defences=defenceBounds(world);this.bounds=new Float64Array(6);this.support=new Float64Array(6);this.range=new Float64Array(4);this.from=new Float64Array(3);this.to=new Float64Array(3);this.queries=0;this.nodeVisits=0;
 }
 clear(bounds,support=bounds){
  this.queries++;
  if(bounds[0]<0||bounds[2]<0||bounds[3]>this.columns*24||bounds[5]>this.rows*24)return false;
  // Tilted upper housings may overhang a lower bank. Only the grounded feet
  // require support; a higher bank can still intersect the whole body envelope.
  for(let z=Math.floor((bounds[2]+EPS)/24);z<=Math.floor((bounds[5]-EPS)/24);z++)for(let x=Math.floor((bounds[0]+EPS)/24);x<=Math.floor((bounds[3]-EPS)/24);x++)if(this.heights[x+z*this.columns]>bounds[1])return false;
  if(support)for(let z=Math.floor((support[2]+EPS)/24);z<=Math.floor((support[5]-EPS)/24);z++)for(let x=Math.floor((support[0]+EPS)/24);x<=Math.floor((support[3]-EPS)/24);x++)if(this.heights[x+z*this.columns]!==this.ground)return false;
  const tree=this.visibility;if(!tree?.bounds)return false;
  let node=0;
  while(node<tree.nodeCount){this.nodeVisits++;if(overlaps(bounds,tree.bounds,node*6)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];}
  for(let i=0;i<this.defences.length;i+=6)if(overlaps(bounds,this.defences,i))return false;
  return true;
 }
 trajectory(impact,vx,vz,path,distance,speed,height,radius=ENEMY_IMPACT.radius,balance=true){
  const duration=Math.min(ENEMY_IMPACT.seconds,(path.length-distance)/speed),b=this.bounds,r=this.range;
  let time=0;
  // Split at route corners and short time boundaries. Each box encloses the
  // entire continuous spring offset (including extrema), not just endpoints.
  for(let span=0;time<duration-1e-10&&span<ENEMY_IMPACT.maxSpans;span++){
   const start=distance+time*speed,nextCorner=(Math.floor((start+1e-8)/24)+1)*24;
   const end=Math.min(duration,time+ENEMY_IMPACT.spanSeconds,(nextCorner-distance)/speed);
   if(end<=time)return false;
   path.sample(start,this.from);path.sample(distance+end*speed,this.to);
   let x0=Math.min(this.from[0],this.to[0]),x1=Math.max(this.from[0],this.to[0]),z0=Math.min(this.from[1],this.to[1]),z1=Math.max(this.from[1],this.to[1]);
   if(path.bounds){path.bounds(start,distance+end*speed,b);x0=b[0];z0=b[1];x1=b[2];z1=b[3];}
   axisRange(r,0,impact.offsetX,vx,time,end);axisRange(r,2,impact.offsetZ,vz,time,end);
   b[0]=x0-radius+r[0];b[3]=x1+radius+r[1];
   b[2]=z0-radius+r[2];b[5]=z1+radius+r[3];b[1]=this.ground+impact.altitude-impact.verticalPadding;b[4]=this.ground+impact.altitude+height+impact.verticalPadding;
   const foot=this.support,soleRadius=impact.supportRadius;foot[0]=Math.min(this.from[0],this.to[0])-soleRadius;foot[3]=Math.max(this.from[0],this.to[0])+soleRadius;foot[2]=Math.min(this.from[1],this.to[1])-soleRadius;foot[5]=Math.max(this.from[1],this.to[1])+soleRadius;
   foot[0]+=r[0];foot[3]+=r[1];foot[2]+=r[2];foot[5]+=r[3];
   if(!this.clear(b,impact.airborne?null:foot))return false;time=end;
  }
  return time>=duration-1e-10;
 }
 dispose(){this.visibility=null;this.heights=this.defences=this.bounds=this.support=this.range=this.from=this.to=null;}
}

export class EnemyImpact {
 constructor(height,model='dog',pivot=[12,9,12],{airborne=false,altitude=0,radius=ENEMY_IMPACT.radius,verticalPadding=0}={}){
  this.height=height;this.rule=ENEMY_BALANCE[model]??(airborne?AIR_BALANCE:RIGID_BALANCE);this.airborne=airborne;this.altitude=altitude;this.radius=this.supportRadius=radius;this.verticalPadding=verticalPadding;this.pivot=pivot;this.rotation=new Float64Array(9);this.footDesired=new Float64Array(9);
  this.hits=this.restricted=0;this.hitDistance=this.distance=this.speed=0;this.clear();
 }
 accepts(scale,kx,kz,tx,tz,clearance,path,distance,speed,balance){
  let vx=this.velocityX+kx*scale,vz=this.velocityZ+kz*scale;const length=Math.hypot(vx,vz);
  if(length>ENEMY_IMPACT.maxSpeed){vx*=ENEMY_IMPACT.maxSpeed/length;vz*=ENEMY_IMPACT.maxSpeed/length;}
  const kick=omega*Math.E;
  return withinCap(this.offsetX,this.offsetZ,vx,vz)&&withinCap(this.tiltX,this.tiltZ,this.tiltVelocityX+tx*scale*kick,this.tiltVelocityZ+tz*scale*kick,1)&&withinCap(this.brace,0,this.braceVelocity+scale*kick,0,1)&&clearance.trajectory(this,vx,vz,path,distance,speed,this.height+2,this.radius+1.5*(this.active?1:scale),balance);
 }
 kick(vx,vy,vz,clearance,path,distance,speed,yaw=0){
  if(!Number.isFinite(vx)||!Number.isFinite(vy)||!Number.isFinite(vz))return false;
  const length=Math.hypot(vx,vy,vz);if(!length)return false;
  const horizontal=Math.hypot(vx,vz),tx=horizontal>length*.15?vx/horizontal:-Math.sin(yaw),tz=horizontal>length*.15?vz/horizontal:-Math.cos(yaw);
  // A steep strike still breaks balance. Use forward stumbling when its
  // horizontal bearing is negligible, rather than erase the visible impulse.
  const push=ENEMY_IMPACT.kick*Math.max(ENEMY_IMPACT.minPushFraction,horizontal/length)*this.rule.push,kx=tx*push,kz=tz*push;
  this.hits++;
  if(!clearance||!this.height){this.restricted++;return false;}
  // The compact Dog shoulders have almost no spare articulation at corners.
  // Preserve its complete accepted gait there, with a flat-foot impact skid.
  let balance=true;
  if(this.rule===ENEMY_BALANCE.dog)for(let i=1;i<path.heading.length;i++)if(path.heading[i]!==path.heading[i-1]&&path.distance[i]+path.turnDistance>=distance&&path.distance[i]-path.turnDistance<=distance+speed*ENEMY_IMPACT.seconds){balance=false;break;}
  if(this.active){if(this.balanceAllowed&&!balance){this.restricted++;return false;}balance=this.balanceAllowed;}
  let scale=1;
  if(!this.accepts(1,kx,kz,tx,tz,clearance,path,distance,speed,balance)){
   this.restricted++;
   if(!this.accepts(0,kx,kz,tx,tz,clearance,path,distance,speed,balance))return false;
   let lo=0,hi=1;
   for(let i=0;i<ENEMY_IMPACT.searchSteps;i++){const middle=(lo+hi)*.5;if(this.accepts(middle,kx,kz,tx,tz,clearance,path,distance,speed,balance))lo=middle;else hi=middle;}
   scale=lo;if(!scale)return false;
  }
  this.velocityX+=kx*scale;this.velocityZ+=kz*scale;const speedNow=Math.hypot(this.velocityX,this.velocityZ);
  if(speedNow>ENEMY_IMPACT.maxSpeed){this.velocityX*=ENEMY_IMPACT.maxSpeed/speedNow;this.velocityZ*=ENEMY_IMPACT.maxSpeed/speedNow;}
  const kick=omega*Math.E*scale;this.tiltVelocityX+=tx*kick;this.tiltVelocityZ+=tz*kick;this.braceVelocity+=kick;
  this.balanceAllowed=balance;this.hitDistance=this.distance=distance;this.speed=speed;this.age=0;this.active=true;return true;
 }
 advance(dt){
  if(!this.active)return;
  this.age+=dt;if(this.age>=ENEMY_IMPACT.seconds){this.clear();return;}
  const decay=Math.exp(-omega*dt),bx=this.velocityX+omega*this.offsetX,bz=this.velocityZ+omega*this.offsetZ;
  this.offsetX=(this.offsetX+bx*dt)*decay;this.offsetZ=(this.offsetZ+bz*dt)*decay;
  this.velocityX=(this.velocityX-omega*bx*dt)*decay;this.velocityZ=(this.velocityZ-omega*bz*dt)*decay;
  const tx=this.tiltVelocityX+omega*this.tiltX,tz=this.tiltVelocityZ+omega*this.tiltZ,brace=this.braceVelocity+omega*this.brace;
  this.tiltX=(this.tiltX+tx*dt)*decay;this.tiltZ=(this.tiltZ+tz*dt)*decay;this.brace=(this.brace+brace*dt)*decay;
  this.tiltVelocityX=(this.tiltVelocityX-omega*tx*dt)*decay;this.tiltVelocityZ=(this.tiltVelocityZ-omega*tz*dt)*decay;this.braceVelocity=(this.braceVelocity-omega*brace*dt)*decay;
 }
 orient(yaw,distance,yawRate=0){
  this.distance=distance;const c=Math.cos(yaw),s=Math.sin(yaw),radians=Math.PI/180;
  if(!this.balanceAllowed){setImpactBalance(this,0,0,0);this.pitchRate=this.rollRate=this.bobRate=0;return;}
  const u=c*this.tiltX-s*this.tiltZ,v=s*this.tiltX+c*this.tiltZ;
  const du=c*this.tiltVelocityX-s*this.tiltVelocityZ-yawRate*v,dv=s*this.tiltVelocityX+c*this.tiltVelocityZ+yawRate*u;
  const diagonal=this.rule===ENEMY_BALANCE.spider?1-.5*Math.abs(u):1,diagonalRate=this.rule===ENEMY_BALANCE.spider?-.5*Math.sign(u)*du:0;
  setImpactBalance(this,v*this.rule.pitch*radians*diagonal,-u*this.rule.roll*radians,this.brace*this.rule.bob);
  this.pitchRate=(dv*diagonal+v*diagonalRate)*this.rule.pitch*radians;this.rollRate=-du*this.rule.roll*radians;this.bobRate=this.braceVelocity*this.rule.bob;
 }
 freeze(){this.active=false;this.velocityX=this.velocityZ=this.tiltVelocityX=this.tiltVelocityZ=this.braceVelocity=this.pitchRate=this.rollRate=this.bobRate=0;}
 clear(counters=false){this.active=false;this.balanceAllowed=true;this.offsetX=this.offsetZ=this.velocityX=this.velocityZ=this.age=this.tiltX=this.tiltZ=this.tiltVelocityX=this.tiltVelocityZ=this.brace=this.braceVelocity=this.pitchRate=this.rollRate=this.bobRate=0;setImpactBalance(this,0,0,0);if(counters)this.hits=this.restricted=0;}
}
