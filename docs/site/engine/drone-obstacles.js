import {TURRET_RECOIL} from '../shared/arsenal.js';
import {GUIDED_MISSILE_MODEL,MISSILE_LAUNCHER_SOCKETS} from '../shared/missile-model.js';
import {ENEMY_IMPACT,ENEMY_BALANCE} from './enemy-impact.js';

export const DRONE_OBSTACLE_PREDICTION_SECONDS=1;
// Camera flight supplies its own radius; standalone queries use the same
// compact camera-sized envelope without depending on a combat aircraft hull.
const EPS=1e-6,EMPTY=Object.freeze([]),MAX_PREDICTED_SPEED=96,DEFAULT_QUERY_RADIUS=2.5;
const overlap=(a,b,k)=>a[0]<b[k+3]-EPS&&a[3]>b[k]+EPS&&a[1]<b[k+4]-EPS&&a[4]>b[k+1]+EPS&&a[2]<b[k+5]-EPS&&a[5]>b[k+2]+EPS;
function empty(b,k=0){b[k]=b[k+1]=b[k+2]=Infinity;b[k+3]=b[k+4]=b[k+5]=-Infinity;}
function include(b,k,x,y,z){b[k]=Math.min(b[k],x);b[k+1]=Math.min(b[k+1],y);b[k+2]=Math.min(b[k+2],z);b[k+3]=Math.max(b[k+3],x);b[k+4]=Math.max(b[k+4],y);b[k+5]=Math.max(b[k+5],z);}
function union(a,k,b,j){for(let d=0;d<3;d++){a[k+d]=Math.min(a[k+d],b[j+d]);a[k+d+3]=Math.max(a[k+d+3],b[j+d+3]);}}
function transformed(out,k,b,j,m){
 empty(out,k);
 for(let i=0;i<8;i++){
  const x=b[j+(i&1?3:0)],y=b[j+1+(i&2?3:0)],z=b[j+2+(i&4?3:0)];
  include(out,k,m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]);
 }
}
const ease=t=>t*t*(3-2*t);
const birdY=(a,b,c,t)=>{const q=1-t;return q*q*q*a+3*q*t*c+t*t*t*b;};
function includeRoute(d,path,lo,hi,x,z,y,p){
 if(path.bounds){path.bounds(lo,hi,p);include(d,0,p[0]-x,y,p[1]-z);include(d,0,p[2]-x,y,p[3]-z);return;}
 for(let at=Math.floor(lo/24)*24+24;at<hi;at+=24){path.sample(at,p);include(d,0,p[0]-x,y,p[1]-z);}
 path.sample(hi,p);include(d,0,p[0]-x,y,p[1]-z);
}

// Dog-specific proof from its actual hierarchy, finite body balance and flat
// world-space paw contacts. Other models retain the generic full-angle bound.
function dogYBounds(data,state,locals,cache){
 if(data.model!=='dog'||!state?.gait?.settings)return null;
 const parts=new Map(data.parts.map(p=>[p.id,p])),body=parts.get('body'),rule=ENEMY_BALANCE.dog,settings=state.gait.settings;
 if(!body||body.parent!==null||data.parts.length!==13||!Number.isFinite(settings.lift)||settings.lift<0||!Number.isFinite(settings.crouch)||settings.crouch<0)return null;
 const sr=Math.sin(rule.roll*Math.PI/180),sp=Math.sin(rule.pitch*Math.PI/180),bp=body.pivot,b=cache.get(body)*6;
 if(!Number.isFinite(b))return null;
 const dx=Math.max(Math.abs(locals[b]-bp[0]),Math.abs(locals[b+3]-bp[0])),dz=Math.max(Math.abs(locals[b+2]-bp[2]),Math.abs(locals[b+5]-bp[2]));
 let low=bp[1]+Math.min(0,locals[b+1]-bp[1])-dx*sr-dz*sp,high=bp[1]+Math.max(0,locals[b+4]-bp[1])+dx*sr+dz*sp;
 const radius=part=>{const k=cache.get(part)*6,p=part.pivot;let r=0;for(let c=0;c<8;c++)r=Math.max(r,Math.hypot(locals[k+(c&1?3:0)]-p[0],locals[k+1+(c&2?3:0)]-p[1],locals[k+2+(c&4?3:0)]-p[2]));return r;};
 for(const name of ['fl','fr','rl','rr']){
  const upper=parts.get('leg-'+name),lower=parts.get('shin-'+name),paw=parts.get('paw-'+name);
  if(!upper||!lower||!paw||!cache.has(upper)||!cache.has(lower)||!cache.has(paw)||upper.parent!==body.id||lower.parent!==upper.id||paw.parent!==lower.id||paw.pivot[1]!==1)return null;
  const p=upper.pivot,hip=bp[1]+Math.max(0,p[1]-bp[1])+Math.abs(p[0]-bp[0])*sr+Math.abs(p[2]-bp[2])*sp,hipLow=bp[1]+Math.min(0,p[1]-bp[1])-Math.abs(p[0]-bp[0])*sr-Math.abs(p[2]-bp[2])*sp,length=Math.hypot(lower.pivot[0]-p[0],lower.pivot[1]-p[1],lower.pivot[2]-p[2]),ur=radius(upper),lr=radius(lower),pk=cache.get(paw)*6;
  low=Math.min(low,hipLow-ur,hipLow-length-lr,settings.crouch+1+locals[pk+1]-paw.pivot[1]);
  // Existing DogGait adds at most .8 units of brace to a swinging flat paw.
  high=Math.max(high,hip+ur,hip+length+lr,settings.crouch+1+settings.lift+.8+locals[pk+4]-paw.pivot[1]);
 }
 return {low,high,bob:Math.min(0,rule.bob)};
}

// Scene-owned model envelopes. Queries never walk voxels, sample paths, create
// objects or change poses. A positive horizon uses the entire cached one-second
// sweep, conservatively also covering all shorter requested horizons.
export class DroneObstacles {
 constructor(world,enemies=EMPTY){
  this.records=[];this.matrices=[];this.disposed=false;this.predictionSeconds=DRONE_OBSTACLE_PREDICTION_SECONDS;this.groundExclusions=null;this.groundExclusionCapacity=world.rigs.size;
  this.updates=0;this.queries=0;this.partTests=0;this.actorTests=0;this.activeActors=0;this.activeParts=0;this.lastBlockedId=null;
  const locals=[],indices=[],envelopes=[],cache=new Map();
  const add=(id,data,state,kind)=>{
   const first=this.matrices.length,byId=new Map(data.parts.map(p=>[p.id,p])),instances=new Map(data.instances.map(i=>[i.part,i]));
   const env=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
   for(const part of data.parts){
    if(!part.voxels.length)continue;
    let index=cache.get(part);
    if(index===undefined){
     index=locals.length/6;cache.set(part,index);const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
     for(const cell of part.voxels){include(b,0,cell[0],cell[1],cell[2]);include(b,0,cell[0]+1,cell[1]+1,cell[2]+1);}locals.push(...b);
    }
    const instance=instances.get(part.id);if(!instance)throw new Error('Drone obstacle part has no live matrix: '+id+'/'+part.id);
    this.matrices.push(instance.matrix);indices.push(index);
    // All-angle joint-chain bounds are conservative over future articulation.
    // Fixed defence parts retain their authored boxes. The only translating
    // solid defence joint is the existing 1.25-unit turret recoil.
    const moving=kind==='enemy'||kind==='wildlife'||data.model==='turret-study'&&(part.id==='head'||part.id==='guns');
    if(!moving){union(env,0,locals,index*6);continue;}
    let top=part,reach=0;
    while(top.parent){const parent=byId.get(top.parent);if(!parent)throw new Error('Drone obstacle parent is missing.');reach+=Math.hypot(top.pivot[0]-parent.pivot[0],top.pivot[1]-parent.pivot[1],top.pivot[2]-parent.pivot[2]);top=parent;}
    let radius=0;const b=index*6;
    for(let corner=0;corner<8;corner++)radius=Math.max(radius,Math.hypot(locals[b+(corner&1?3:0)]-part.pivot[0],locals[b+1+(corner&2?3:0)]-part.pivot[1],locals[b+2+(corner&4?3:0)]-part.pivot[2]));
    radius+=reach+(data.model==='turret-study'&&part.id===TURRET_RECOIL.part?TURRET_RECOIL.distance:0);
    include(env,0,top.pivot[0]-radius,top.pivot[1]-radius,top.pivot[2]-radius);include(env,0,top.pivot[0]+radius,top.pivot[1]+radius,top.pivot[2]+radius);
   }
   // Loaded rounds belong to the fixed launcher envelope. Reserve their wells
   // even when empty; actual missile actors (seated or flying) are excluded.
   if(data.model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[data.variant]??EMPTY){const r=GUIDED_MISSILE_MODEL.radius;include(env,0,socket[0]-r,socket[1],socket[2]-r);include(env,0,socket[0]+r,socket[1]+GUIDED_MISSILE_MODEL.height,socket[2]+r);}
   if(first===this.matrices.length)return;
   envelopes.push(...env);this.records.push({id,kind,state,root:data.root,first,count:this.matrices.length-first,lap:state?.lap??0,seen:false,dogY:dogYBounds(data,state,locals,cache)});
  };
  for(const [id,data]of world.rigs)if(data.role==='defence')add(id,data,null,'defence');
  for(const [id,data]of world.actors??EMPTY){if(data.model===GUIDED_MISSILE_MODEL.id)continue;const state=enemies.find(s=>s.id===id)??null;add(id,data,state,state||data.role==='enemy'?'enemy':'wildlife');}
  this.localBounds=new Float64Array(locals);this.localIndices=new Uint32Array(indices);this.poseEnvelope=new Float64Array(envelopes);
  const actors=this.records.length,parts=this.matrices.length;
  this.current=new Float64Array(parts*6);this.actorCurrent=new Float64Array(actors*6);this.predicted=new Float64Array(actors*6);this.baseEnvelope=new Float64Array(actors*6);this.entrancePredicted=new Float64Array(actors*6);this.entranceActive=new Uint8Array(actors);this.previous=new Float64Array(actors*3);this.observedVelocity=new Float64Array(actors*3);this.active=new Uint8Array(actors);
  this.bounds=new Float64Array(6);this.timedBounds=new Float64Array(6);this.sample=new Float64Array(5);this.displacement=new Float64Array(6);
  this.byteLength=this.localBounds.byteLength+this.localIndices.byteLength+this.poseEnvelope.byteLength+this.current.byteLength+this.actorCurrent.byteLength+this.predicted.byteLength+this.baseEnvelope.byteLength+this.entrancePredicted.byteLength+this.entranceActive.byteLength+this.previous.byteLength+this.observedVelocity.byteLength+this.active.byteLength+this.bounds.byteLength+this.timedBounds.byteLength+this.sample.byteLength+this.displacement.byteLength;
  this.update(0);
 }
 setWildlife(states,groundExclusions=null){
  if(this.disposed)throw new Error('Drone obstacles are disposed.');
  if(!Array.isArray(states))throw new Error('Drone obstacles require wildlife states.');
  if(groundExclusions!==null){
   if(!(groundExclusions instanceof Float64Array)||groundExclusions.length%6||groundExclusions.length>this.groundExclusionCapacity*6)throw new Error('Invalid wildlife ground exclusion capacity.');
   for(let k=0;k<groundExclusions.length;k+=6)for(let axis=0;axis<3;axis++)if(!Number.isFinite(groundExclusions[k+axis])||!Number.isFinite(groundExclusions[k+axis+3])||groundExclusions[k+axis]>groundExclusions[k+axis+3])throw new Error('Invalid wildlife ground exclusion bounds.');
  }
  // Borrow WildlifePreview's immutable scene-owned defence-clearance cache.
  // It is never changed here, and this reference is released on scene unload.
  this.groundExclusions=groundExclusions;
  for(const state of states){const record=this.records.find(r=>r.id===state.id&&r.kind==='wildlife');if(!record)throw new Error('Wildlife is outside this scene obstacle capacity: '+state.id);record.state=state;record.seen=false;}
  this.update(0);
 }
 groundPredictionExcluded(query,predicted,offset,index){
  const exclusions=this.groundExclusions;if(!exclusions||this.records[index].state?.kind!=='ground'||overlap(query,this.actorCurrent,index*6))return false;
  const x0=Math.max(query[0],predicted[offset]),y0=Math.max(query[1],predicted[offset+1]),z0=Math.max(query[2],predicted[offset+2]),x1=Math.min(query[3],predicted[offset+3]),y1=Math.min(query[4],predicted[offset+4]),z1=Math.min(query[5],predicted[offset+5]);
  // Every permitted ground route keeps the complete animal envelope outside
  // these fixed volumes. Only an intersection wholly contained in one volume
  // is impossible; protruding predicted space and all current guards remain.
  for(let k=0;k<exclusions.length;k+=6)if(x0>=exclusions[k]&&y0>=exclusions[k+1]&&z0>=exclusions[k+2]&&x1<=exclusions[k+3]&&y1<=exclusions[k+4]&&z1<=exclusions[k+5])return true;
  return false;
 }
 entrance(record,index){
  const s=record.state,path=s?.path,speed=s?.movement?.speed;
  if(record.kind!=='enemy'||!path||!(path.length>0)||!Number.isFinite(s.distance)||!(speed>0))return;
  const travel=s.distance+speed*this.predictionSeconds;if(travel<path.length)return;
  const k=index*6,d=this.displacement,p=this.sample,end=Math.min(path.length,travel-path.length);
  // The preview teleports to its entrance. Keep that future occupied region
  // separate from the exit-side sweep; joining the boxes blocks the whole map.
  path.sample(0,p);const x=p[0],z=p[1],dx=x-s.x,dz=z-s.z,dy=-(s.impact?.bob??0);d.fill(0);
  includeRoute(d,path,0,end,x,z,0,p);
  for(let axis=0;axis<3;axis++){const shift=axis===0?dx:axis===1?dy:dz;this.entrancePredicted[k+axis]=this.predicted[k+axis]+shift+d[axis];this.entrancePredicted[k+axis+3]=this.predicted[k+axis+3]+shift+d[axis+3];}
  this.entranceActive[index]=1;
 }
 motion(record,dt,index){
  const s=record.state,d=this.displacement;d.fill(0);if(!s||record.kind==='defence')return;
  const h=this.predictionSeconds,p=this.sample;
  if(record.kind==='enemy'&&s.path&&Number.isFinite(s.distance)&&s.movement?.speed>0){
   const path=s.path,start=s.distance,end=Math.min(path.length,start+s.movement.speed*h);path.sample(start,p);const x=p[0],z=p[1];
   // Curved flight contributes its complete per-axis bounds, including extrema
   // between neighbouring bends. Ground routes retain their authored edges.
   includeRoute(d,path,start,end,x,z,0,p);
   const vy=Number.isFinite(s.velocityY)?s.velocityY:0;include(d,0,0,Math.max(-MAX_PREDICTED_SPEED,Math.min(MAX_PREDICTED_SPEED,vy))*h,0);
   if(s.impact?.active){const impact=s.impact,x=ENEMY_IMPACT.maxOffset+Math.abs(impact.offsetX??0),z=ENEMY_IMPACT.maxOffset+Math.abs(impact.offsetZ??0),y=Math.abs(ENEMY_BALANCE[s.model]?.bob??0)+Math.abs(impact.bob??0);d[0]-=x;d[3]+=x;d[2]-=z;d[5]+=z;d[1]-=y;d[4]+=y;}
   return;
  }
  if(s.kind==='bird'&&s.phase==='flying'&&s.duration>0){
   const a=Math.min(1,s.flightTime/s.duration),b=Math.min(1,(s.flightTime+h*(s.frightened?1.5:1))/s.duration),t=ease(b),x=s.fromX+(s.destinationX-s.fromX)*t,z=s.fromZ+(s.destinationZ-s.fromZ)*t;
   include(d,0,x-s.x,birdY(s.fromY,s.destinationY,s.ceiling,b)-s.y,z-s.z);
   // Exact cubic Y extrema (flightY's derivative is quadratic).
   const aa=s.destinationY-s.fromY,bb=2*(s.fromY-s.ceiling),cc=s.ceiling-s.fromY,disc=bb*bb-4*aa*cc;
   if(Math.abs(aa)<1e-10){const u=bb?-cc/bb:-1;if(u>a&&u<b)include(d,0,0,birdY(s.fromY,s.destinationY,s.ceiling,u)-s.y,0);}
   else if(disc>=0)for(let sign=-1;sign<=1;sign+=2){const u=(-bb+sign*Math.sqrt(disc))/(2*aa);if(u>a&&u<b)include(d,0,0,birdY(s.fromY,s.destinationY,s.ceiling,u)-s.y,0);}
   return;
  }
  // Ground wildlife can turn at its next navigation edge. A bounded reachable
  // disk covers every direction without changing its movement or destination.
  if(s.kind==='ground'){
   if(s.phase==='hop'||s.phase==='scuttle'){const radius=(s.frightened?s.fleeSpeed:s.speed)*h;d[0]=d[2]=-radius;d[3]=d[5]=radius;d[1]=-Math.max(0,s.hop??0);d[4]=Math.max(0,s.hop??0);}return;
  }
  // Fallback for custom actors: observed translation, ignoring resets/laps and
  // displacement faster than the explicit prediction bound (no teleport trail).
  if(record.seen&&dt>0&&record.lap===(s.lap??0)){
   const k=index*3,dx=s.x-this.previous[k],dy=s.y-this.previous[k+1],dz=s.z-this.previous[k+2],speed=Math.hypot(dx,dy,dz)/dt;
   if(speed<=MAX_PREDICTED_SPEED)include(d,0,dx*h/dt,dy*h/dt,dz*h/dt);
  }
 }
 update(dt=0){
  if(this.disposed)return;if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid drone obstacle delta.');
  this.updates++;this.activeActors=this.activeParts=0;
  for(let i=0;i<this.records.length;i++){
   const r=this.records[i],s=r.state,k=i*6;this.active[i]=s?.health?.alive===false?0:1;this.entranceActive[i]=0;
   if(!this.active[i]){r.seen=false;continue;}this.activeActors++;this.activeParts+=r.count;empty(this.actorCurrent,k);
   for(let p=r.first;p<r.first+r.count;p++){transformed(this.current,p*6,this.localBounds,this.localIndices[p]*6,this.matrices[p]);union(this.actorCurrent,k,this.current,p*6);}
   transformed(this.predicted,k,this.poseEnvelope,k,r.root);
   if(r.dogY){
    const nominal=Number.isFinite(s.groundHeight)?s.groundHeight-s.gait.settings.crouch:r.root[13]-(s.impact?.bob??0);
    this.predicted[k+1]=Math.max(this.predicted[k+1],nominal+r.dogY.low+r.dogY.bob);
    this.predicted[k+4]=Math.min(this.predicted[k+4],nominal+r.dogY.high);
   }
   // Wildlife's runtime envelope includes every allowed wing pose and its
   // compact body. Prefer that tight contract over an unrestricted joint sphere.
   if(s?.kind&&Number.isFinite(s.radius)&&Number.isFinite(s.height)){
    this.predicted[k]=s.x-s.radius;this.predicted[k+1]=s.y;this.predicted[k+2]=s.z-s.radius;this.predicted[k+3]=s.x+s.radius;this.predicted[k+4]=s.y+s.height;this.predicted[k+5]=s.z+s.radius;
   }
   union(this.predicted,k,this.actorCurrent,k);for(let axis=0;axis<6;axis++)this.baseEnvelope[k+axis]=this.predicted[k+axis];
   const j=i*3;this.observedVelocity[j]=this.observedVelocity[j+1]=this.observedVelocity[j+2]=0;
   if(s&&r.seen&&dt>0&&r.lap===(s.lap??0)){const vx=(s.x-this.previous[j])/dt,vy=(s.y-this.previous[j+1])/dt,vz=(s.z-this.previous[j+2])/dt;if(Math.hypot(vx,vy,vz)<=MAX_PREDICTED_SPEED){this.observedVelocity[j]=vx;this.observedVelocity[j+1]=vy;this.observedVelocity[j+2]=vz;}}
   this.entrance(r,i);this.motion(r,dt,i);
   for(let d=0;d<3;d++){this.predicted[k+d]+=this.displacement[d];this.predicted[k+d+3]+=this.displacement[d+3];}
   if(s){const j=i*3;this.previous[j]=s.x;this.previous[j+1]=s.y;this.previous[j+2]=s.z;r.lap=s.lap??0;r.seen=true;}
  }
 }
 timedOverlap(index){
  const k=index*6,b=this.timedBounds,d=this.displacement;
  for(let axis=0;axis<3;axis++){b[axis]=this.baseEnvelope[k+axis]+d[axis];b[axis+3]=this.baseEnvelope[k+axis+3]+d[axis+3];}
  return overlap(this.bounds,b,0)&&!this.groundPredictionExcluded(this.bounds,b,0,index);
 }
 routeTimedOverlap(record,index,lo,hi,wrapped){
  const s=record.state,path=s.path,d=this.displacement,p=this.sample;path.sample(s.distance,p);
  const x=wrapped?s.x:p[0],z=wrapped?s.z:p[1],y=wrapped?-(s.impact?.bob??0):0;
  empty(d);path.sample(lo,p);include(d,0,p[0]-x,y,p[1]-z);includeRoute(d,path,lo,hi,x,z,y,p);
  if(!wrapped&&s.impact?.active){const impact=s.impact,px=ENEMY_IMPACT.maxOffset+Math.abs(impact.offsetX??0),pz=ENEMY_IMPACT.maxOffset+Math.abs(impact.offsetZ??0),py=Math.abs(ENEMY_BALANCE[s.model]?.bob??0)+Math.abs(impact.bob??0);d[0]-=px;d[3]+=px;d[2]-=pz;d[5]+=pz;d[1]-=py;d[4]+=py;}
  return this.timedOverlap(index);
 }
 recordTimedOverlap(record,index,start,end){
  const s=record.state,d=this.displacement;
  if(record.kind==='enemy'&&s?.path?.length>0&&Number.isFinite(s.distance)&&s.movement?.speed>0){
   const path=s.path,a=s.distance+s.movement.speed*start,b=s.distance+s.movement.speed*end,firstLap=Math.floor(a/path.length),lastLap=Math.floor(b/path.length);
   if(b-a>=path.length)return this.routeTimedOverlap(record,index,0,path.length,true);
   if(firstLap===lastLap)return this.routeTimedOverlap(record,index,a%path.length,b%path.length,firstLap>0);
   return this.routeTimedOverlap(record,index,a%path.length,path.length,firstLap>0)||this.routeTimedOverlap(record,index,0,b%path.length,true);
  }
  d.fill(0);
  if(s?.kind==='bird'&&s.phase==='flying'&&s.duration>0){
   // A currently frightened bird can lose its speed boost within this window.
   // Cover the earliest normal-speed and latest boosted phase, rather than
   // placing it too far ahead after an unobserved fright expiry.
   const a=Math.min(1,(s.flightTime+start)/s.duration),b=Math.min(1,(s.flightTime+end*(s.frightened?1.5:1))/s.duration),ea=ease(a),eb=ease(b);
   empty(d);include(d,0,s.fromX+(s.destinationX-s.fromX)*ea-s.x,birdY(s.fromY,s.destinationY,s.ceiling,a)-s.y,s.fromZ+(s.destinationZ-s.fromZ)*ea-s.z);include(d,0,s.fromX+(s.destinationX-s.fromX)*eb-s.x,birdY(s.fromY,s.destinationY,s.ceiling,b)-s.y,s.fromZ+(s.destinationZ-s.fromZ)*eb-s.z);
   const aa=s.destinationY-s.fromY,bb=2*(s.fromY-s.ceiling),cc=s.ceiling-s.fromY,disc=bb*bb-4*aa*cc;
   if(Math.abs(aa)<1e-10){const u=bb?-cc/bb:-1;if(u>a&&u<b){const y=birdY(s.fromY,s.destinationY,s.ceiling,u)-s.y;d[1]=Math.min(d[1],y);d[4]=Math.max(d[4],y);}}
   else if(disc>=0)for(let sign=-1;sign<=1;sign+=2){const u=(-bb+sign*Math.sqrt(disc))/(2*aa);if(u>a&&u<b){const y=birdY(s.fromY,s.destinationY,s.ceiling,u)-s.y;d[1]=Math.min(d[1],y);d[4]=Math.max(d[4],y);}}
  }else if(s?.kind==='ground'){
   if(s.phase==='hop'||s.phase==='scuttle'){const radius=(s.frightened?s.fleeSpeed:s.speed)*end;d[0]=d[2]=-radius;d[3]=d[5]=radius;d[1]=-Math.max(0,s.hop??0);d[4]=Math.max(0,s.hop??0);}
  }else if(record.kind!=='defence')for(let axis=0;axis<3;axis++){const v=this.observedVelocity[index*3+axis];d[axis]=Math.min(v*start,v*end);d[axis+3]=Math.max(v*start,v*end);}
  return this.timedOverlap(index);
 }
 clearTimedSegment(ax,ay,az,bx,by,bz,radius=DEFAULT_QUERY_RADIUS,startSeconds=0,endSeconds=0,halfHeight=radius,above=halfHeight){
  this.queries++;this.lastBlockedId=null;if(this.disposed)return true;
  const start=Math.max(0,Math.min(this.predictionSeconds,startSeconds)),end=Math.max(start,Math.min(this.predictionSeconds,endSeconds)),b=this.bounds;
  b[0]=Math.min(ax,bx)-radius;b[1]=Math.min(ay,by)-halfHeight;b[2]=Math.min(az,bz)-radius;b[3]=Math.max(ax,bx)+radius;b[4]=Math.max(ay,by)+above;b[5]=Math.max(az,bz)+radius;
  for(let i=0;i<this.records.length;i++)if(this.active[i]){const r=this.records[i];if(r.state?.health?.alive===false)continue;this.actorTests++;if(this.recordTimedOverlap(r,i,start,end)){this.lastBlockedId=r.id;return false;}}
  return true;
 }
 clearBox(bounds,predictSeconds=0){
  this.queries++;this.lastBlockedId=null;if(this.disposed)return true;
  const future=predictSeconds>0;
  for(let i=0;i<this.records.length;i++)if(this.active[i]){
   const r=this.records[i];if(r.state?.health?.alive===false)continue;this.actorTests++;
   if(future&&this.entranceActive[i]&&overlap(bounds,this.entrancePredicted,i*6)){this.lastBlockedId=r.id;return false;}
   const envelope=future||r.kind==='defence';
   if(!overlap(bounds,envelope?this.predicted:this.actorCurrent,i*6))continue;
   if(future&&this.groundPredictionExcluded(bounds,this.predicted,i*6,i))continue;
   if(envelope){this.lastBlockedId=r.id;return false;}
   for(let p=r.first;p<r.first+r.count;p++){this.partTests++;if(overlap(bounds,this.current,p*6)){this.lastBlockedId=r.id;return false;}}
  }
  return true;
 }
 clearSegment(ax,ay,az,bx,by,bz,radius=DEFAULT_QUERY_RADIUS,predictSeconds=0,below=radius,above=below){
  if(this.disposed)return true;const b=this.bounds;b[0]=Math.min(ax,bx)-radius;b[1]=Math.min(ay,by)-below;b[2]=Math.min(az,bz)-radius;b[3]=Math.max(ax,bx)+radius;b[4]=Math.max(ay,by)+above;b[5]=Math.max(az,bz)+radius;return this.clearBox(b,predictSeconds);
 }
 segmentClear(ax,ay,az,bx,by,bz,radius=DEFAULT_QUERY_RADIUS,predictSeconds=0,below=radius,above=below){return this.clearSegment(ax,ay,az,bx,by,bz,radius,predictSeconds,below,above);}
 pointClear(x,y,z,radius=DEFAULT_QUERY_RADIUS,predictSeconds=0,below=radius,above=below){return this.clearSegment(x,y,z,x,y,z,radius,predictSeconds,below,above);}
 reset(){if(this.disposed)return;for(const r of this.records)r.seen=false;this.previous.fill(0);this.update(0);this.lastBlockedId=null;}
 dispose(){
  if(this.disposed)return;this.disposed=true;this.records.length=0;this.matrices.length=0;
  this.localBounds=this.localIndices=this.poseEnvelope=this.current=this.actorCurrent=this.predicted=this.baseEnvelope=this.entrancePredicted=this.entranceActive=this.previous=this.observedVelocity=this.active=this.bounds=this.timedBounds=this.sample=this.displacement=null;
  this.groundExclusions=null;this.groundExclusionCapacity=0;
  this.byteLength=this.activeActors=this.activeParts=0;this.lastBlockedId=null;
 }
}
