import {ENEMY_STATS} from '../shared/enemy.js';
import {MAX_DEBRIS,MAX_DAMAGE_CUBES,MAX_SMOKE,MAX_BLASTS,MAX_DAMAGE_LIGHTS,MAX_DAMAGE_PARTICLES,DAMAGE_CUBE_FLOATS,DAMAGE_PARTICLE_FLOATS,SHOCKWAVE_FLOATS,MISSILE_IMPACT_EFFECT,MISSILE_IMPACT_SMOKE,MISSILE_LAUNCH_SMOKE,MISSILE_TRAIL_SMOKE} from '../shared/damage-effects.js';
import {sweepScenery,debrisSupport} from './debris-collision.js';
import {WaterImpacts} from './water-impact.js';
import {WATER_IMPACT} from '../shared/water-impact.js';

// Palette construction is load-time only. Weight real visible face area rather
// than palette slot order, so a tiny sensor does not become half the wreckage.
export function debrisPalette(world,actor){
 const colors=new Map();
 for(const instance of actor.instances){
  const mesh=world.entries.find(entry=>entry.key===instance.key)?.mesh;if(!mesh)continue;
  for(let q=0;q<mesh.quads.length;q++){
   const k=q*44+6,r=mesh.vertices[k],g=mesh.vertices[k+1],b=mesh.vertices[k+2],key=r+','+g+','+b,area=mesh.quads[q].width*mesh.quads[q].height;
   const color=colors.get(key);if(color)color.area+=area;else colors.set(key,{r,g,b,area});
  }
 }
 const dominant=[...colors.values()].sort((a,b)=>b.area-a.area).slice(0,7),total=dominant.reduce((sum,c)=>sum+c.area,0);
 if(!total)throw new Error('Enemy debris requires a model palette.');
 const palette=new Float32Array(dominant.length*4);let weight=0;
 for(let i=0;i<dominant.length;i++){const c=dominant[i];weight+=c.area/total;palette.set([c.r,c.g,c.b,weight],i*4);}palette[palette.length-1]=1;return palette;
}

function cubeMatrix(out,k,p){
 const sx=Math.sin(p.rx),cx=Math.cos(p.rx),sy=Math.sin(p.ry),cy=Math.cos(p.ry),sz=Math.sin(p.rz),cz=Math.cos(p.rz),s=p.size;
 out[k]=cz*cy*s;out[k+1]=sz*cy*s;out[k+2]=-sy*s;out[k+3]=0;
 out[k+4]=(cz*sy*sx-sz*cx)*s;out[k+5]=(sz*sy*sx+cz*cx)*s;out[k+6]=cy*sx*s;out[k+7]=0;
 out[k+8]=(cz*sy*cx+sz*sx)*s;out[k+9]=(sz*sy*cx-cz*sx)*s;out[k+10]=cy*cx*s;out[k+11]=0;
 out[k+12]=p.x;out[k+13]=p.y;out[k+14]=p.z;out[k+15]=1;out[k+16]=p.r;out[k+17]=p.g;out[k+18]=p.b;out[k+19]=0;
}

// Read the current rigid-part transform, not the route point or targeting aim.
// The centre follows articulated pose changes without allocating event vectors.
function updateOrigin(emitter){
 const m=emitter.originMatrix,p=emitter.config.effectOrigin.point,o=emitter.origin;
 o[0]=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12];
 o[1]=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13];
 o[2]=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14];
}

export class DamageEffects {
 constructor(random=Math.random){
  this.random=random;this.onWaterImpact=null;this.time=0;this.visibility=null;this.emitters=[];this.waterImpacts=null;this.waterParticleCount=0;this.emitWaterParticle=this.particle.bind(this);
  this.cubes=Array.from({length:MAX_DAMAGE_CUBES},()=>({active:false,waterEntered:false,resting:false,age:0,restAge:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,wx:0,wy:0,wz:0,size:0,r:0,g:0,b:0,config:null}));
  this.smoke=Array.from({length:MAX_SMOKE},()=>({active:false,launch:false,trail:false,impact:false,age:0,life:0,x:0,y:0,z:0,vx:0,vz:0,rise:0,radius:0,seed:0}));
  this.blasts=Array.from({length:MAX_BLASTS},()=>({active:false,kind:null,age:0,x:0,y:0,z:0,seed:0,config:null,lobes:new Float64Array(16)}));
  this.cubeData=new Float32Array(MAX_DAMAGE_CUBES*DAMAGE_CUBE_FLOATS);this.particleData=new Float32Array(MAX_DAMAGE_PARTICLES*DAMAGE_PARTICLE_FLOATS);this.lightData=new Float32Array(4+MAX_DAMAGE_LIGHTS*8);
  this.shockwaveData=new Float32Array(MAX_BLASTS*SHOCKWAVE_FLOATS);this.shockwaveCount=0;
  this.smokeOrder=new Uint16Array(MAX_SMOKE);this.smokeDepth=new Float64Array(MAX_SMOKE);this.contact=new Float64Array(6);
  this.cubeCount=this.smokeCount=this.blastCount=this.particleCount=this.lightCount=0;this.cubeRevision=0;this.cubesDirty=false;this.activeCubes=this.activeSmoke=this.activeBlasts=0;this.droppedCubes=this.droppedSmoke=this.replacedBlasts=0;
  this.missileImpacts=this.launches=this.droppedMissileBlasts=this.droppedLaunchSmoke=this.missileBlastCount=this.launchSmokeCount=0;
 }
 reset(keepWorld=false){
  this.time=0;this.waterImpacts?.reset(keepWorld);this.waterParticleCount=0;
  if(keepWorld){for(const emitter of this.emitters)emitter.carry=0;}
  else{this.visibility=null;this.emitters.length=0;this.onWaterImpact=null;}
  for(const p of this.cubes){p.active=false;p.config=null;}
  for(const p of this.smoke){p.active=false;p.launch=p.trail=p.impact=false;}
  for(const p of this.blasts){p.active=false;p.kind=null;p.config=null;}
  this.activeCubes=this.activeSmoke=this.activeBlasts=0;
  this.cubeCount=this.smokeCount=this.blastCount=this.particleCount=this.lightCount=0;this.lightData.fill(0);
  this.shockwaveCount=0;this.shockwaveData.fill(0);
  this.droppedCubes=this.droppedSmoke=this.replacedBlasts=0;this.cubeRevision++;this.cubesDirty=false;
  this.missileImpacts=this.launches=this.droppedMissileBlasts=this.droppedLaunchSmoke=this.missileBlastCount=this.launchSmokeCount=0;
 }
 markCubeDirty(){this.cubesDirty=true;}
 setWorld(world,states){
  this.reset();this.visibility=world.visibility;this.onWaterImpact=world.onDebrisWaterImpact??null;
  if(world.level?.terrain?.boxes.some(box=>box.water>0)){this.waterImpacts??=new WaterImpacts(this.random);this.waterImpacts.setWorld(world);}
  if(!states.length)return;
  const palettes=new Map();
  for(const state of states){
   const actor=world.actors.get(state.id),config=ENEMY_STATS[actor.model],key=actor.model+':'+actor.variant;
   if(!config)throw new Error('Missing enemy effect configuration.');
   let palette=palettes.get(key);if(!palette){palette=debrisPalette(world,actor);palettes.set(key,palette);}
   const originMatrix=actor.instances.find(instance=>instance.part===config.effectOrigin.part)?.matrix;
   if(!originMatrix)throw new Error('Enemy effect origin part is missing.');
   this.emitters.push({state,config,palette,carry:0,originMatrix,origin:new Float64Array(3)});
  }
 }
 reserveBlast(kind){
  let oldest=null,missile=null;
  for(const b of this.blasts){
   if(!b.active){b.active=true;b.kind=kind;this.activeBlasts++;return b;}
   if(!oldest||b.age>oldest.age)oldest=b;
   if(b.kind==='missile'&&(!missile||b.age>missile.age))missile=b;
  }
  const blast=missile??(kind==='death'?oldest:null);
  if(blast){this.replacedBlasts++;blast.kind=kind;}else this.droppedMissileBlasts++;
  return blast;
 }
 missileImpact(x,y,z,nx=0,ny=1,nz=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(nx)||!Number.isFinite(ny)||!Number.isFinite(nz))throw new Error('Invalid missile impact origin.');
  this.missileImpacts++;const blast=this.reserveBlast('missile');if(!blast)return null;
  const length=Math.hypot(nx,ny,nz),offset=MISSILE_IMPACT_EFFECT.surfaceOffset;
  if(length){nx/=length;ny/=length;nz/=length;}else{nx=0;ny=1;nz=0;}
  blast.age=0;blast.x=x+nx*offset;blast.y=y+ny*offset;blast.z=z+nz*offset;blast.seed=this.random()*6.28;blast.config=MISSILE_IMPACT_EFFECT;
  // Lobe directions depend on this impact's seed, never on its animation age.
  for(let i=0;i<8;i++){const angle=blast.seed+i*2.39996323;blast.lobes[i*2]=Math.cos(angle);blast.lobes[i*2+1]=Math.sin(angle);}
  this.burstSmoke(blast.x,blast.y,blast.z,MISSILE_IMPACT_SMOKE,true);
  // Borrowed pool entry: callers must copy its scalar event values immediately.
  return blast;
 }
 launchSmoke(x,y,z){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new Error('Invalid missile launch origin.');
  this.launches++;return this.burstSmoke(x,y,z,MISSILE_LAUNCH_SMOKE,false);
 }
 burstSmoke(x,y,z,rule,impact){
  const rng=this.random;let emitted=0;
  for(let i=0;i<rule.count;i++){
   let p=null;for(const candidate of this.smoke)if(!candidate.active){p=candidate;break;}
   if(!p){const dropped=rule.count-i;this.droppedSmoke+=dropped;if(!impact)this.droppedLaunchSmoke+=dropped;break;}
   const angle=(i+rng())/rule.count*Math.PI*2,spread=.4+rng()*1.1,speed=rule.minOutSpeed+rng()*(rule.maxOutSpeed-rule.minOutSpeed),dx=Math.cos(angle),dz=Math.sin(angle);
   p.active=true;p.launch=!impact;p.impact=impact;p.trail=false;p.age=0;p.life=rule.minLife+rng()*(rule.maxLife-rule.minLife);
   p.x=x+dx*spread;p.y=y+.4+rng()*.6;p.z=z+dz*spread;p.vx=dx*speed;p.vz=dz*speed;
   p.rise=rule.minRise+rng()*(rule.maxRise-rule.minRise);p.radius=rule.minRadius+rng()*(rule.maxRadius-rule.minRadius);p.seed=rng()*6.28;
   this.activeSmoke++;emitted++;
  }
  return emitted;
 }
 missileTrail(x,y,z){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new Error('Invalid missile trail origin.');
  let p=null;for(const candidate of this.smoke)if(!candidate.active){p=candidate;break;}
  if(!p){this.droppedSmoke++;return false;}
  const rule=MISSILE_TRAIL_SMOKE;p.active=true;p.launch=p.impact=false;p.trail=true;p.age=0;p.life=rule.life;
  p.x=x;p.y=y;p.z=z;p.vx=p.vz=0;p.rise=rule.rise;p.radius=rule.radius;p.seed=this.random()*6.28;this.activeSmoke++;return true;
 }
 explode(state){
  let emitter=null;for(const candidate of this.emitters)if(candidate.state===state){emitter=candidate;break;}if(!emitter)return;
  const config=emitter.config.explosion,palette=emitter.palette,rng=this.random,paletteOffset=rng();
  updateOrigin(emitter);const origin=emitter.origin;
  const blast=this.reserveBlast('death');
  blast.age=0;blast.x=origin[0];blast.y=origin[1];blast.z=origin[2];blast.seed=rng()*6.28;blast.config=config;
  for(let i=0;i<config.debrisCount;i++){
   let p=null;for(let slot=0;slot<MAX_DEBRIS;slot++){const candidate=this.cubes[slot];if(!candidate.active){p=candidate;break;}}
   if(!p){this.droppedCubes+=config.debrisCount-i;break;}
   // Spread a short burst across the weighted palette instead of allowing a
   // run of random choices to omit the model's pale armour entirely.
   const angle=(i+rng())/config.debrisCount*Math.PI*2,speed=config.minSpeed+rng()*(config.maxSpeed-config.minSpeed),size=config.minCubeSize+rng()*(config.maxCubeSize-config.minCubeSize),color=(paletteOffset+i*.618033988749895)%1;let k=0;
   while(k+4<palette.length&&color>palette[k+3])k+=4;
   p.active=true;p.resting=false;p.waterEntered=false;p.age=p.restAge=0;p.config=config;p.size=size;
   p.x=origin[0];p.y=origin[1];p.z=origin[2];
   p.vx=Math.cos(angle)*speed;p.vz=Math.sin(angle)*speed;p.vy=config.minUpSpeed+rng()*(config.maxUpSpeed-config.minUpSpeed);
   p.rx=rng()*6.28;p.ry=rng()*6.28;p.rz=rng()*6.28;p.wx=(rng()-.5)*18;p.wy=(rng()-.5)*18;p.wz=(rng()-.5)*18;
   p.r=palette[k];p.g=palette[k+1];p.b=palette[k+2];this.activeCubes++;
  }
  this.markCubeDirty();
  // Borrowed pool entry: consumers must copy the event values immediately.
  return blast;
 }
 emitSmoke(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid smoke delta.');
  for(const emitter of this.emitters){
   const state=emitter.state,settings=emitter.config.smoke;
   if(!state.health.alive||state.health.current>=state.health.maximum*settings.threshold){emitter.carry=0;continue;}
   updateOrigin(emitter);const origin=emitter.origin;
   // Never replay an unbounded backlog after a stalled frame.
   emitter.carry+=Math.min(deltaSeconds,settings.life)*settings.rate;
   while(emitter.carry>=1){
    emitter.carry--;let p=null;for(const candidate of this.smoke)if(!candidate.active){p=candidate;break;}
    if(!p){this.droppedSmoke++;continue;}
    const age=emitter.carry/settings.rate,rng=this.random;
    p.active=true;p.launch=p.trail=p.impact=false;p.age=age;p.life=settings.life;p.x=origin[0];p.y=origin[1];p.z=origin[2];
    p.vx=(rng()-.5)*2;p.vz=(rng()-.5)*2;p.rise=settings.riseSpeed;p.radius=settings.radius*(.8+rng()*.4);p.seed=rng()*6.28;this.activeSmoke++;
   }
  }
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid damage effect delta.');
  this.time+=deltaSeconds;if(!deltaSeconds)return;
  this.waterImpacts?.advance(deltaSeconds);
  if(this.activeSmoke)for(const p of this.smoke)if(p.active){p.age+=deltaSeconds;if(p.age>=p.life){p.active=false;this.activeSmoke--;}}
  if(this.activeBlasts)for(const b of this.blasts)if(b.active){b.age+=deltaSeconds;if(b.age>=Math.max(b.config.flashSeconds,b.config.lightSeconds,b.config.waveSeconds)){b.active=false;b.kind=null;b.config=null;this.activeBlasts--;}}
  if(!this.activeCubes)return;
  // Sweeps prevent tunnelling. Substeps resolve ballistic curvature and impacts;
  // at most 120 per cube after a stall, integrating the full elapsed interval.
  const steps=Math.min(120,Math.max(1,Math.ceil(deltaSeconds*120))),dt=deltaSeconds/steps;
  for(const p of this.cubes){
   if(!p.active)continue;
   if(p.resting){p.restAge+=deltaSeconds;if(p.restAge>=p.config.settleSeconds){this.markCubeDirty();p.active=false;p.config=null;this.activeCubes--;}continue;}
   p.age+=deltaSeconds;
   if(p.age>=p.config.maxFlightSeconds){this.markCubeDirty();p.active=false;p.config=null;this.activeCubes--;continue;}
   this.markCubeDirty();
   for(let step=0;step<steps&&!p.resting;step++)this.stepCube(p,dt);
  }
 }
 stepCube(p,dt){
  const water=this.waterImpacts,submerged=p.waterEntered&&p.y<water.height(p.x,p.z)+p.size,gravity=submerged?WATER_IMPACT.underwaterGravity:p.config.gravity,radius=p.size*Math.sqrt(3)/2,hit=this.contact;
  if(submerged){const drag=Math.exp(-WATER_IMPACT.underwaterDrag*dt);p.vx*=drag;p.vy*=drag;p.vz*=drag;p.wx*=drag;p.wy*=drag;p.wz*=drag;}
  p.rx+=p.wx*dt;p.ry+=p.wy*dt;p.rz+=p.wz*dt;
  let remaining=dt;
  for(let contact=0;contact<3&&remaining>1e-6;contact++){
   const dx=p.vx*remaining,dy=p.vy*remaining-.5*gravity*remaining*remaining,dz=p.vz*remaining;
   const solid=sweepScenery(this.visibility,p.x,p.y,p.z,dx,dy,dz,radius,hit);
   if(water&&!p.waterEntered&&water.crossing(p.x,p.y,p.z,dx,dy,dz,radius,solid?hit[0]:1)){
    const contact=water.contact,fraction=contact[0];water.impact(contact[1],contact[2],contact[3],p.size,Math.max(0,-p.vy+gravity*remaining*fraction),p.vx,p.vz);
    this.onWaterImpact?.(contact[1],contact[2],contact[3],p.size,Math.max(0,-p.vy+gravity*remaining*fraction));
    p.x+=dx*fraction;p.y+=dy*fraction;p.z+=dz*fraction;p.vy-=gravity*remaining*fraction;p.waterEntered=true;
    p.vx*=.42;p.vy*=.35;p.vz*=.42;p.wx*=.35;p.wy*=.35;p.wz*=.35;remaining*=1-fraction;continue;
   }
   if(!solid){p.x+=dx;p.y+=dy;p.z+=dz;p.vy-=gravity*remaining;break;}
   const fraction=hit[0],nx=hit[1],ny=hit[2],nz=hit[3];p.x+=dx*fraction+nx*.001;p.y+=dy*fraction+ny*.001;p.z+=dz*fraction+nz*.001;p.vy-=gravity*remaining*fraction;
   const normalSpeed=p.vx*nx+p.vy*ny+p.vz*nz;
   if(normalSpeed<0){
    // Inelastic rebound + friction: pieces quickly lose their launch energy.
    p.vx=(p.vx-normalSpeed*nx)*.62-normalSpeed*nx*.22;p.vy=(p.vy-normalSpeed*ny)*.62-normalSpeed*ny*.22;p.vz=(p.vz-normalSpeed*nz)*.62-normalSpeed*nz*.22;
    p.wx*=.55;p.wy*=.55;p.wz*=.55;
   }
   if(ny>0&&Math.abs(p.vy)<3.5&&Math.hypot(p.vx,p.vz)<9){
    const top=debrisSupport(this.visibility,p.x,p.z,p.size/2,p.y);
    if(Number.isFinite(top)){p.y=top+p.size/2;p.rx=p.rz=0;p.ry=0;p.vx=p.vy=p.vz=p.wx=p.wy=p.wz=0;p.resting=true;p.restAge=0;break;}
   }
   remaining*=1-fraction;
  }
 }
 prepare(viewProjection=null){
  if(this.cubesDirty){
   this.cubeCount=0;
   for(const p of this.cubes)if(p.active)cubeMatrix(this.cubeData,this.cubeCount++*DAMAGE_CUBE_FLOATS,p);
   this.cubeRevision++;this.cubesDirty=false;
  }
  this.smokeCount=this.blastCount=this.particleCount=this.lightCount=this.shockwaveCount=this.missileBlastCount=this.launchSmokeCount=0;this.lightData[0]=0;
  // Reused insertion-sort storage; the tiny smoke pool blends back to front.
  for(let i=0,remaining=this.activeSmoke;i<this.smoke.length&&remaining;i++){
   const p=this.smoke[i];if(!p.active)continue;remaining--;
   const x=p.x+p.vx*p.age,y=p.y+p.rise*p.age,z=p.z+p.vz*p.age,m=viewProjection;
   // Current camera clip depth works in both overview and perspective modes;
   // radial distance orders off-axis particles incorrectly in an overview.
   const depth=m?(m[2]*x+m[6]*y+m[10]*z+m[14])/(m[3]*x+m[7]*y+m[11]*z+m[15]):p.age;
   let j=this.smokeCount++;while(j>0&&this.smokeDepth[j-1]<depth){this.smokeDepth[j]=this.smokeDepth[j-1];this.smokeOrder[j]=this.smokeOrder[j-1];j--;}
   this.smokeDepth[j]=depth;this.smokeOrder[j]=i;
  }
  for(let i=0;i<this.smokeCount;i++){
   const p=this.smoke[this.smokeOrder[i]],u=p.age/p.life;
   if(p.trail){
    const rule=MISSILE_TRAIL_SMOKE;this.particle(p.x,p.y+p.rise*p.age,p.z,p.radius*(1+u*1.8),rule.r,rule.g,rule.b,rule.opacity*(1-u)**1.3,0,p.seed,u);
   }else if(p.launch||p.impact){
    if(p.launch)this.launchSmokeCount++;
    const rule=p.impact?MISSILE_IMPACT_SMOKE:MISSILE_LAUNCH_SMOKE;
    this.particle(p.x+p.vx*p.age,p.y+p.rise*p.age,p.z+p.vz*p.age,p.radius*(1+u*.6),rule.r,rule.g,rule.b,rule.opacity*(1-u)**1.2,0,p.seed,u);
   }else this.particle(p.x+p.vx*p.age,p.y+p.rise*p.age,p.z+p.vz*p.age,p.radius*(.65+u),.04,.045,.05,.65*Math.min(1,u*8)*(1-u),0,p.seed,u);
  }
  this.waterParticleCount=0;if(this.waterImpacts){const before=this.particleCount;this.waterImpacts.prepare(this.emitWaterParticle);this.waterParticleCount=this.particleCount-before;}
  if(this.activeBlasts)for(const b of this.blasts){
   if(!b.active)continue;const config=b.config;
   if(b.age<config.flashSeconds){
    const u=b.age/config.flashSeconds,tail=Math.min(1,b.age/(config.flashRiseSeconds??.08)),green=config.flashGreen??.64,blue=config.flashBlue??.27;
    this.particle(b.x,b.y,b.z,config.size*(.28+.72*tail),1,green-(green-.28)*tail,blue-(blue-.05)*tail,(1-u)**1.25,1,b.seed,u);
    this.blastCount++;if(b.kind==='missile')this.missileBlastCount++;
    if(b.kind==='missile'){
     // Eight rolling lobes surround the core, sharing its flash lifetime.
     for(let i=0;i<8;i++){
      const speed=15+(i%3)*7,travel=speed*b.age;
      this.particle(b.x+b.lobes[i*2]*travel,b.y+2+b.age*(8+(i%3)*4),b.z+b.lobes[i*2+1]*travel,config.size*(.3+.22*tail)*(1-u*.4),1,.35+.06*(i%3),.055,(1-u)**1.7*.9,1,b.seed+i,u);this.blastCount++;
     }
    }
   }
   if(b.age<config.lightSeconds){const k=4+this.lightCount++*8,pulse=(1-b.age/config.lightSeconds)**2,l=this.lightData;l[k]=b.x;l[k+1]=b.y;l[k+2]=b.z;l[k+3]=config.lightRadius;l[k+4]=1;l[k+5]=.64;l[k+6]=.3;l[k+7]=config.lightStrength*pulse;}
   if(b.age>0&&b.age<config.waveSeconds){
    const u=b.age/config.waveSeconds,k=this.shockwaveCount++*SHOCKWAVE_FLOATS,w=this.shockwaveData;
    w[k]=b.x;w[k+1]=b.y;w[k+2]=b.z;w[k+3]=config.waveRadius*u;
    w[k+4]=config.waveWidth;w[k+5]=config.waveStrength*Math.min(1,u*8)*(1-u)**.65;w[k+6]=w[k+7]=0;
   }
  }
  this.lightData[0]=this.lightCount;
 }
 particle(x,y,z,radius,r,g,b,alpha,kind,seed,age,extra=0){
  const k=this.particleCount++*DAMAGE_PARTICLE_FLOATS,a=this.particleData;
  a[k]=x;a[k+1]=y;a[k+2]=z;a[k+3]=radius;a[k+4]=r;a[k+5]=g;a[k+6]=b;a[k+7]=alpha;a[k+8]=kind;a[k+9]=seed;a[k+10]=age;a[k+11]=extra;
 }
}
