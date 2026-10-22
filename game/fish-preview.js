import {PoseRig} from '../engine/rig.js';
import {FISH_STEP} from '../shared/fish-habitat.js';
import {shortestAngle} from '../engine/path-motion.js';

const SPEED=4,FLEE_SPEED=18,FEAR_SECONDS=2.4,EVENTS=8;
function random(s){let n=s.random;n^=n<<13;n^=n>>>17;n^=n<<5;s.random=n>>>0;return s.random/4294967296;}
export class FishPreview {
 constructor(world,onPoseChange){
  this.habitat=world.fishHabitat??null;this.states=[];this.time=0;this.events=new Float64Array(this.habitat?EVENTS*6:0);this.cursor=this.impactCount=this.updatedParts=0;
  for(const actor of world.fishActors??[]){
   const h=this.habitat,n=actor.node,x=(n%h.cols+.5)*FISH_STEP,z=(Math.floor(n/h.cols)+.5)*FISH_STEP;
   const s={id:actor.id,kind:'fish',home:n,index:actor.index,node:n,next:-1,previous:-1,pool:h.component[n],waterBody:h.waterComponent[n],surface:h.surface[n],x,y:h.surface[n]-6,z,yaw:actor.index*2.1,rig:new PoseRig(world.actors.get(actor.id),onPoseChange),random:12345+actor.index*7297,tailPhase:actor.index,frightened:false,fleeUntil:0,threatX:0,threatZ:0,spooks:0,journeysCompleted:0,travelled:0,speed:SPEED};
   this.states.push(s);this.pose(s);
  }
 }
 // Called only by a real debris/surface crossing. Copy scalars into a bounded
 // queue; fear detection and planning keep the shared one-critter thinker.
 spookWaterImpact(x,y,z,size,fallSpeed){
  if(!this.habitat)return false;
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(size)||!Number.isFinite(fallSpeed)||size<=0||fallSpeed<0)throw new Error('Invalid fish water impact.');
  const h=this.habitat,col=Math.floor(x/FISH_STEP),row=Math.floor(z/FISH_STEP),node=row*h.cols+col;
  if(col<0||row<0||col>=h.cols||row>=h.rows||h.waterSurface[node]!==y)return false;
  const pool=h.waterComponent[node];
  const k=this.cursor*6;this.cursor=(this.cursor+1)%EVENTS;this.events[k]=x;this.events[k+1]=z;this.events[k+2]=Math.min(64,24+size*6+fallSpeed*.25);this.events[k+3]=this.time+1.5;this.events[k+4]=pool;this.events[k+5]=++this.impactCount;return true;
 }
 think(index){
  const s=this.states[index];if(!s)return;let best=Infinity,threat=-1;
  for(let k=0;k<this.events.length;k+=6)if(this.events[k+3]>this.time&&this.events[k+4]===s.waterBody){const d=Math.hypot(s.x-this.events[k],s.z-this.events[k+1])/this.events[k+2];if(d<1&&d<best){best=d;threat=k;}}
  if(threat>=0){
   if(!s.frightened)s.spooks++;s.frightened=true;s.fleeUntil=this.time+FEAR_SECONDS;s.threatX=this.events[threat];s.threatZ=this.events[threat+1];
   // Reverse a currently approaching edge from this exact position; no snap.
   if(s.next>=0){const h=this.habitat,n=s.next,nx=(n%h.cols+.5)*FISH_STEP,nz=(Math.floor(n/h.cols)+.5)*FISH_STEP,dx=nx-s.x,dz=nz-s.z;
    if((s.x-s.threatX)*dx+(s.z-s.threatZ)*dz<0){s.next=s.node;s.node=n;}}
  }
  if(s.next>=0)return;
  const h=this.habitat,here=Math.hypot(s.x-s.threatX,s.z-s.threatZ);let chosen=-1,score=-Infinity;
  for(let d=0;d<4;d++){
   const n=h.links[s.node*4+d];if(n<0)continue;let occupied=false;for(const other of this.states)if(other!==s&&(other.next===n||other.node===n)){occupied=true;break;}if(occupied)continue;
   const x=(n%h.cols+.5)*FISH_STEP,z=(Math.floor(n/h.cols)+.5)*FISH_STEP,away=Math.hypot(x-s.threatX,z-s.threatZ);
   if(s.frightened&&((s.x-s.threatX)*(x-s.x)+(s.z-s.threatZ)*(z-s.z)<-1e-8||away<=here))continue;
   const value=s.frightened?away:random(s)*2+(n===s.previous?-2:0)+(-Math.sin(s.yaw)*(x-s.x)-Math.cos(s.yaw)*(z-s.z))/FISH_STEP;
   if(value>score){score=value;chosen=n;}
  }
  s.next=chosen;
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid fish delta.');this.updatedParts=0;if(!dt||!this.habitat)return;
  const before=this.time;this.time+=dt;
  for(const s of this.states){
   const scared=Math.max(0,Math.min(dt,s.fleeUntil-before)),budget=SPEED*(dt-scared)+FLEE_SPEED*scared;s.frightened=s.fleeUntil>this.time;s.speed=s.frightened?FLEE_SPEED:SPEED;s.tailPhase+=dt*(s.frightened?22:7);
   if(s.next>=0){
    const h=this.habitat,n=s.next,x=(n%h.cols+.5)*FISH_STEP,z=(Math.floor(n/h.cols)+.5)*FISH_STEP,dx=x-s.x,dz=z-s.z,d=Math.hypot(dx,dz),step=Math.min(budget,d);
    if(d>0){s.x+=dx*step/d;s.z+=dz*step/d;const turn=shortestAngle(Math.atan2(-dx,-dz)-s.yaw);s.yaw+=Math.max(-dt*8,Math.min(dt*8,turn));s.travelled+=step;}
    if(step===d){s.previous=s.node;s.node=n;s.next=-1;s.journeysCompleted++;}
   }
   s.y=s.surface-6+Math.sin(s.tailPhase*.3)*.2;this.pose(s);
  }
 }
 pose(s){
  const c=Math.cos(s.yaw),sin=Math.sin(s.yaw),root=s.rig.root;root[0]=c;root[2]=-sin;root[8]=sin;root[10]=c;root[12]=s.x-12*c-12*sin;root[13]=s.y;root[14]=s.z+12*sin-12*c;
  s.rig.invalidateRoot();s.rig.setRotation('tail',0,Math.sin(s.tailPhase)*.35,0);this.updatedParts+=s.rig.update();
 }
 reset(){
  this.events.fill(0);this.time=this.cursor=this.impactCount=0;
  for(const s of this.states){s.node=s.home;s.next=s.previous=-1;s.x=(s.home%this.habitat.cols+.5)*FISH_STEP;s.z=(Math.floor(s.home/this.habitat.cols)+.5)*FISH_STEP;s.y=s.surface-6;s.yaw=s.index*2.1;s.tailPhase=s.index;s.random=12345+s.index*7297;s.frightened=false;s.fleeUntil=s.spooks=s.journeysCompleted=s.travelled=0;s.speed=SPEED;this.pose(s);}
 }
 stats(){return {time:this.time,impacts:this.impactCount,planningBytes:(this.habitat?.bytes??0)+this.events.byteLength,pools:this.habitat?.pools.length??0,actors:this.states.map(s=>({id:s.id,pool:s.pool,x:s.x,y:s.y,z:s.z,frightened:s.frightened,spooks:s.spooks,journeysCompleted:s.journeysCompleted,travelled:s.travelled,speed:s.speed}))};}
 dispose(){for(const s of this.states)s.rig=null;this.states.length=0;this.habitat=null;this.events=new Float64Array(0);this.time=this.impactCount=this.updatedParts=0;}
}
