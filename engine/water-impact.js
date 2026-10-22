import {MAX_WATER_IMPACTS,MAX_WATER_DROPS,WATER_IMPACT} from '../shared/water-impact.js';
import {sweepScenery} from './debris-collision.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

// World binding and event allocation happen outside the particle loop. Surface
// queries use a retained height grid; no fluid solver is needed.
export class WaterImpacts {
 constructor(random=Math.random){
  this.random=random;this.heights=null;this.levels=[];this.visibility=null;this.cols=this.rows=0;
  this.impacts=Array.from({length:MAX_WATER_IMPACTS},()=>({active:false,age:0,x:0,y:0,z:0,power:0,rootPower:0,radiusSpeed:0,inverseWidth:0,seed:0,crown:false}));
  this.drops=Array.from({length:MAX_WATER_DROPS},()=>({active:false,age:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,radius:0,life:0,seed:0}));
  this.contact=new Float64Array(5);this.reset();
 }
 reset(keepWorld=false){
  this.revision=(this.revision??0)+1;
  for(const p of this.impacts)p.active=false;for(const p of this.drops)p.active=false;
  this.count=this.activeDrops=this.entries=this.droppedImpacts=this.droppedDrops=this.particleCount=0;
  if(!keepWorld){this.heights=null;this.levels.length=0;this.visibility=null;this.cols=this.rows=0;}
 }
 setWorld(world){
  this.reset();const level=world.level;this.cols=level.size[0];this.rows=level.size[1];this.visibility=world.visibility;
  this.heights=new Float32Array(this.cols*this.rows);
  for(const box of level.terrain.boxes)if(box.water>0){this.heights[box.box[1]*this.cols+box.box[0]]=box.water;if(!this.levels.includes(box.water))this.levels.push(box.water);}
 }
 height(x,z){const col=Math.floor(x/24),row=Math.floor(z/24);return col>=0&&row>=0&&col<this.cols&&row<this.rows?this.heights?.[row*this.cols+col]??0:0;}
 // Return the first downward surface crossing before the supplied solid hit.
 // A bridge, bank or prop reached first retains ordinary solid collision.
 crossing(ox,oy,oz,dx,dy,dz,radius,before=1){
  if(!(dy<0)||!this.heights)return false;let best=before,found=false;
  for(const height of this.levels){const t=(height+radius-oy)/dy;if(t<0||t>best)continue;const x=ox+dx*t,z=oz+dz*t;if(this.height(x,z)!==height)continue;best=t;this.contact[0]=t;this.contact[1]=x;this.contact[2]=height;this.contact[3]=z;found=true;}
  return found;
 }
 ripple(x,y,z,power,crown=false){
  let event=null;for(const p of this.impacts)if(!p.active){event=p;break;}
  // Returning droplets cannot crowd out the next full debris splash.
  if(!event&&crown)for(const p of this.impacts)if(!p.crown&&(!event||p.age>event.age))event=p;
  if(!event){this.droppedImpacts++;return null;}
  if(!event.active)this.count++;
  event.active=true;event.age=0;event.x=x;event.y=y;event.z=z;event.power=power;event.rootPower=Math.sqrt(power);event.radiusSpeed=9+2*event.rootPower;event.inverseWidth=1/(1.25+.35*event.rootPower);this.revision++;event.seed=this.random()*Math.PI*2;event.crown=crown;return event;
 }
 impact(x,y,z,size,fallSpeed,vx=0,vz=0){
  this.entries++;
  const rng=this.random,power=clamp(Math.pow(size/1.4,1.1)*Math.pow(Math.max(5,fallSpeed)/28,.65),.45,2);
  if(!this.ripple(x,y,z,power,true))return false;
  const rootPower=Math.sqrt(power);
  const count=Math.round(6+power*4);
  for(let i=0;i<count;i++){
   let p=null;for(const drop of this.drops)if(!drop.active){p=drop;break;}if(!p){this.droppedDrops+=count-i;break;}
   const angle=(i+rng())/count*Math.PI*2,out=(7+rng()*10)*rootPower,spread=.35+rng()*.7,cos=Math.cos(angle),sin=Math.sin(angle);
   p.active=true;p.age=0;p.x=x+cos*spread;p.y=y+.6;p.z=z+sin*spread;p.vx=cos*out+vx*.08;p.vy=(16+rng()*16)*rootPower;p.vz=sin*out+vz*.08;p.radius=(.42+rng()*.42)*rootPower;p.life=1.45;p.seed=rng()*6.28;this.activeDrops++;
  }
  return true;
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid water impact delta.');if(!dt)return;
  if(this.count)this.revision++;
  if(this.count)for(const p of this.impacts)if(p.active){p.age+=dt;if(p.age>=WATER_IMPACT.rippleSeconds){p.active=false;this.count--;}}
  if(!this.activeDrops)return;
  const steps=Math.min(120,Math.max(1,Math.ceil(dt*120))),step=dt/steps,drag=Math.exp(-1.5*step);
  for(const p of this.drops)if(p.active){
   p.age+=dt;if(p.age>=p.life){p.active=false;this.activeDrops--;continue;}
   for(let i=0;i<steps&&p.active;i++){
    const dx=p.vx*step,dy=p.vy*step-.5*WATER_IMPACT.gravity*step*step,dz=p.vz*step;
    const solid=sweepScenery(this.visibility,p.x,p.y,p.z,dx,dy,dz,p.radius,this.contact);
    if(this.crossing(p.x,p.y,p.z,dx,dy,dz,p.radius,solid?this.contact[0]:1)){
     const hit=this.contact;this.ripple(hit[1],hit[2],hit[3],clamp(p.radius*.25,.08,.3));
     p.active=false;this.activeDrops--;break;
    }
    if(solid){p.active=false;this.activeDrops--;break;}
    p.x+=dx;p.y+=dy;p.z+=dz;p.vx*=drag;p.vz*=drag;p.vy-=WATER_IMPACT.gravity*step;
   }
  }
 }
 // Pack only active events into retained renderer storage. No event-time GPU
 // allocation; age follows the same paused/slow-motion clock as the splash.
 writeRipples(out){
  let count=0;
  for(const p of this.impacts)if(p.active){
   const k=4+count++*8,u=p.age/WATER_IMPACT.rippleSeconds,start=clamp(p.age/.12,0,1),fade=(1-u)**1.5*start*start*(3-2*start);
   out[k]=p.x;out[k+1]=p.y;out[k+2]=p.z;out[k+3]=p.age;
   // Radius, reciprocal width and derivative amplitude are uniform over the
   // whole ring. Compute them once here rather than in every water pixel.
   out[k+4]=.8+p.radiusSpeed*p.age;out[k+5]=p.inverseWidth;out[k+6]=.32*p.rootPower*fade*p.inverseWidth;out[k+7]=0;
  }
  out[0]=count;return count;
 }
 prepare(emit){
  this.particleCount=0;
  if(!this.count&&!this.activeDrops)return;
  for(const p of this.impacts)if(p.active){
   const u=p.age/WATER_IMPACT.rippleSeconds,radius=.8+p.radiusSpeed*p.age,alpha=.24*p.rootPower*(1-u)**1.5;
   emit(p.x,p.y+.12,p.z,radius,.55,.69,.7,alpha,2,p.seed,u,p.y);this.particleCount++;
   if(p.crown&&p.age<WATER_IMPACT.crownSeconds){const c=p.age/WATER_IMPACT.crownSeconds,r=(2+6*c)*p.rootPower,height=Math.max(.25,10*p.rootPower*Math.sin(c*Math.PI));emit(p.x,p.y+height*.5,p.z,r,.72,.8,.78,.95*(1-c),3,p.seed,c,height/(r*2));this.particleCount++;}
  }
  for(const p of this.drops)if(p.active){emit(p.x,p.y,p.z,p.radius,.52,.67,.7,.94,4,p.seed,clamp(Math.abs(p.vy)/18,1,1.8),0);this.particleCount++;}
 }
}
