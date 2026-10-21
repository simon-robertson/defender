const EMPTY=Object.freeze([]),MODELS=new Set(['turret-study','arc-spire','missile-launcher']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finiteTarget=s=>s&&(s.phase==='active'&&s.health?.alive!==false||s.phase==='scheduled')&&Number.isFinite(s.distance)&&s.path?.sample&&Number.isFinite(s.movement?.speed)&&s.movement.speed>0;

// Read-only editorial forecasts. Never call a combat eligibility/planner method:
// those methods update aim scratch, contact samplers and damage reservations.
export class CameraAnticipation {
 constructor({speed=18,standoff=86}={}){this.speed=speed;this.standoff=standoff;this.point=new Float64Array(3);this.focus=new Float64Array(3);this.sample=new Float64Array(5);this.source=new Float64Array(3);this.byteLength=this.point.byteLength+this.focus.byteLength+this.sample.byteLength+this.source.byteLength;this.reset();}
 reset(){this.active=false;this.target=this.defence=null;this.at=Infinity;this.since=-Infinity;this.nextAt=-Infinity;this.owner=null;this.cursor=this.scans=this.pairs=this.samples=this.revision=0;}
 sourceAt(gun,x,z,ground){
  const out=this.source,sources=gun.sources;if(sources?.length){let best=Infinity,slot=0;for(let i=0;i<sources.length;i+=3){const d=(sources[i]-x)**2+(sources[i+2]-z)**2;if(d<best){best=d;slot=i;}}out[0]=sources[slot];out[1]=sources[slot+1];out[2]=sources[slot+2];return;}
  const root=gun.rig?.root??gun.root,p=gun.gunPivot??gun.pivot;
  out[0]=gun.x;out[2]=gun.z;out[1]=root&&p?root[1]*p[0]+root[5]*p[1]+root[9]*p[2]+root[13]:ground+18;
 }
 readyIn(gun){
  const cycle=gun.cycle;if(!cycle)return 0;
  let ready=Math.max(0,(cycle.remaining?cycle.nextShotAt:cycle.readyAt)-cycle.time);
  if(gun.model==='missile-launcher'&&!(gun.ammo>0)){if(!gun.reloading||!Number.isFinite(gun.reloadUntil))return Infinity;ready=Math.max(ready,gun.reloadUntil-cycle.time);}
  return ready;
 }
 eligible(gun,x,y,z,world){
  if(Math.hypot(x-gun.x,z-gun.z)>gun.maxRange)return false;
  this.sourceAt(gun,x,z,world.level.pathHeight);const source=this.source;
  if(gun.model==='turret-study'||gun.gunPivot){const pitch=Math.atan2(y-source[1],Math.hypot(x-source[0],z-source[2]));if(pitch<(gun.pitch?.min??-.61)||pitch>(gun.pitch?.max??.61))return false;}
  return !gun.requiresLineOfSight||Boolean(world.visibility?.clear(source[0],source[1],source[2],x,y,z,gun.id));
 }
 compelling(engine){
  for(const gun of engine.firing?.states??EMPTY)if(gun.target?.phase==='active'&&gun.target.health?.alive!==false&&gun.lineOfSight){const c=gun.cycle;if(c&&(c.remaining>0||c.time-c.lastShotAt<.7))return true;}
  return false;
 }
 update(engine,world,position){
  const now=engine.time;if(!Number.isFinite(now)||now<this.nextAt)return false;this.nextAt=now+.6;this.scans++;
  if(this.owner!==engine.enemies){this.target=this.defence=null;this.active=false;this.owner=engine.enemies;this.cursor=0;}
  const before=this.active,oldTarget=this.target,oldDefence=this.defence;
  if(this.compelling(engine)){this.active=false;return before;}
  const targets=engine.enemies?.states??engine.enemies?.activeTargets??EMPTY,guns=engine.firing?.states??EMPTY;
  if(this.active&&finiteTarget(this.target)&&guns.includes(this.defence)&&now-this.since<4&&this.at>=now-.5)return false;
  this.active=false;
  const total=targets.length*guns.length,budget=Math.min(total,96);let best=Infinity,bestTarget=null,bestGun=null,bestAt=0,bx=0,by=0,bz=0;
  for(let n=0;n<budget;n++){
   const pair=(this.cursor+n)%total,target=targets[Math.floor(pair/guns.length)],gun=guns[pair%guns.length];this.pairs++;
   if(gun.strength!==undefined&&!(Number.isFinite(gun.strength)&&gun.strength>0))continue;
   if(!finiteTarget(target)||!MODELS.has(gun.model??(gun.gunPivot?'turret-study':''))||!Number.isFinite(gun.maxRange)||gun.maxRange<=0)continue;
   const wait=target.phase==='scheduled'?Math.max(0,(target.spawnAt??Infinity)-(engine.waveTime??0)):0,ready=this.readyIn(gun);if(!Number.isFinite(wait)||ready>18||wait>18)continue;
   const start=Math.max(ready,wait),speed=target.movement.speed,y=Number.isFinite(target.aimY)?target.aimY:target.y;
   if(!Number.isFinite(y))continue;
   // Half-second samples follow the target's actual complete route, including
   // bends/merges. First future viable sample is an approximate filming event.
   for(let t=start;t<=18+1e-9;t+=.5){
    const distance=target.distance+Math.max(0,t-wait)*speed;if(distance>target.path.length)break;target.path.sample(distance,this.sample);this.samples++;
    const x=this.sample[0],z=this.sample[1];if(!this.eligible(gun,x,y,z,world))continue;
    if(t<.15)break; // Existing action remains the ordinary camera's job.
    const fx=x*.65+gun.x*.35,fz=z*.65+gun.z*.35,travel=Math.max(0,Math.hypot(position[0]-fx,position[2]-fz)-this.standoff)/this.speed+2;
    if(t>clamp(travel+3.5,4,18))break;
    const score=t*.65+travel*.28+(gun===oldDefence&&target===oldTarget?-1.2:0);
    if(score<best){best=score;bestTarget=target;bestGun=gun;bestAt=now+t;bx=x;by=y;bz=z;}break;
   }
  }
  if(total)this.cursor=(this.cursor+budget)%total;
  if(bestTarget){
   this.target=bestTarget;this.defence=bestGun;this.at=bestAt;this.point[0]=bx;this.point[1]=by;this.point[2]=bz;this.sourceAt(bestGun,bx,bz,world.level.pathHeight);
   this.focus[0]=bx*.65+bestGun.x*.35;this.focus[1]=by*.75+this.source[1]*.25;this.focus[2]=bz*.65+bestGun.z*.35;this.active=true;
   if(oldTarget!==bestTarget||oldDefence!==bestGun||!before)this.since=now;
  }else{this.target=this.defence=null;}
  const changed=before!==this.active||oldTarget!==this.target||oldDefence!==this.defence;if(changed)this.revision++;return changed;
 }
 stats(){return {active:this.active,target:this.active?this.target?.id??null:null,defence:this.active?this.defence?.id??null:null,at:this.active?this.at:null,point:this.active?Array.from(this.point):null,scans:this.scans,pairs:this.pairs,samples:this.samples,revision:this.revision};}
}
