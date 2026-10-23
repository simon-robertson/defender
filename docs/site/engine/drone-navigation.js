import {DRONE_PREVIEW as T} from '../shared/drone.js';
import {DRONE_MODEL} from '../shared/drone-model.js';
import {sweptDroneBoxIntersects} from './drone-clearance.js';

const EPS=1e-6;
export function droneBoxesOverlap(a,b,k=0){return a[0]<b[k+3]-EPS&&a[3]>b[k]+EPS&&a[1]<b[k+4]-EPS&&a[4]>b[k+1]+EPS&&a[2]<b[k+5]-EPS&&a[5]>b[k+2]+EPS;}

// Static, four-neighbour horizontal lanes joined by explicitly clear vertical
// lanes. Runtime searches reuse one queue/parent/distance set per aircraft.
// Bounds enclose the complete swept hull, so turns cannot cut scenery corners.
export class DroneNavigation {
 constructor(world){
  this.world=world;this.visibility=world.visibility;this.width=world.width;this.length=world.length;this.ground=world.level.pathHeight;
  this.cols=Math.floor(this.width/T.step)+1;this.rows=Math.floor(this.length/T.step)+1;this.plane=this.cols*this.rows;this.count=this.plane*T.transitLayers.length;
  this.free=new Uint8Array(this.count);this.edges=new Uint8Array(this.count);this.bounds=new Float64Array(6);this.point=new Float64Array(3);this.knots=new Float64Array((this.count+1)*3);this.queries=0;this.nodeVisits=0;
  const boxes=[];this.padIndices=new Map();
  for(const [id,data]of world.rigs)if(data.role==='defence'){
   // Only the fixed pad obstructs flight: the aircraft is handled by the fleet
   // check using its current pose, never a stale bind-pose obstacle.
   const parts=data.model==='drone-defence'?data.parts.filter(p=>p.id===DRONE_MODEL.pad):data.parts,m=data.root;
   const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
   for(const p of parts)for(const c of p.voxels)for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)for(let dz=0;dz<2;dz++){
    const x=m[0]*(c[0]+dx)+m[4]*(c[1]+dy)+m[8]*(c[2]+dz)+m[12],y=m[1]*(c[0]+dx)+m[5]*(c[1]+dy)+m[9]*(c[2]+dz)+m[13],z=m[2]*(c[0]+dx)+m[6]*(c[1]+dy)+m[10]*(c[2]+dz)+m[14];
    b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.min(b[2],z);b[3]=Math.max(b[3],x);b[4]=Math.max(b[4],y);b[5]=Math.max(b[5],z);
   }
   this.padIndices.set(id,boxes.length);boxes.push(...b);
  }
  this.defences=new Float64Array(boxes);
  for(let node=0;node<this.count;node++){this.position(node,this.point);this.free[node]=this.clearSegment(this.point[0],this.point[1],this.point[2],this.point[0],this.point[1],this.point[2])?1:0;}
  for(let node=0;node<this.count;node++)if(this.free[node]){
   const x=node%this.cols,z=Math.floor(node/this.cols)%this.rows,layer=Math.floor(node/this.plane);
   for(let dir=0;dir<3;dir++){
    if(dir===0&&x+1>=this.cols||dir===1&&z+1>=this.rows||dir===2&&layer+1>=T.transitLayers.length)continue;
    const next=node+(dir===0?1:dir===1?this.cols:this.plane);if(!this.free[next])continue;
    this.position(node,this.point);const ax=this.point[0],ay=this.point[1],az=this.point[2];this.position(next,this.point);
    if(this.clearSegment(ax,ay,az,this.point[0],this.point[1],this.point[2])){this.edges[node]|=1<<dir;this.edges[next]|=1<<(dir+3);}
   }
  }
  this.offsets=new Int32Array([1,this.cols,this.plane,-1,-this.cols,-this.plane]);
  this.byteLength=this.free.byteLength+this.edges.byteLength+this.defences.byteLength+this.offsets.byteLength+this.bounds.byteLength+this.point.byteLength+this.knots.byteLength;
 }
 position(node,out){out[0]=(node%this.cols)*T.step;out[1]=this.ground+DRONE_MODEL.bodyPivot[1]+T.transitLayers[Math.floor(node/this.plane)];out[2]=(Math.floor(node/this.cols)%this.rows)*T.step;return out;}
 clearBox(b,ignorePad=-1){
  this.queries++;
  if(b[0]<0||b[2]<0||b[3]>this.width||b[5]>this.length)return false;
  const tree=this.visibility;if(!tree?.bounds)return false;let node=0;
  while(node<tree.nodeCount){this.nodeVisits++;if(droneBoxesOverlap(b,tree.bounds,node*6)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];}
  for(let i=0;i<this.defences.length;i+=6)if(i!==ignorePad&&droneBoxesOverlap(b,this.defences,i))return false;
  return true;
 }
 sweptBounds(ax,ay,az,bx,by,bz,r=T.hullRadius){const b=this.bounds;b[0]=Math.min(ax,bx)-r;b[1]=Math.min(ay,by)-T.hullBelow;b[2]=Math.min(az,bz)-r;b[3]=Math.max(ax,bx)+r;b[4]=Math.max(ay,by)+T.hullAbove;b[5]=Math.max(az,bz)+r;return b;}
 clearSegment(ax,ay,az,bx,by,bz){
  const b=this.sweptBounds(ax,ay,az,bx,by,bz);this.queries++;
  if(b[0]<0||b[2]<0||b[3]>this.width||b[5]>this.length)return false;
  const tree=this.visibility;if(!tree?.bounds)return false;let node=0;
  while(node<tree.nodeCount){this.nodeVisits++;if(droneBoxesOverlap(b,tree.bounds,node*6)&&sweptDroneBoxIntersects(tree.bounds,node*6,ax,ay,az,bx,by,bz)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];}
  for(let i=0;i<this.defences.length;i+=6)if(sweptDroneBoxIntersects(this.defences,i,ax,ay,az,bx,by,bz))return false;
  return true;
 }
 neutralVertical(state,top){
  // This narrow, unturned departure is the authored mechanical pad contract.
  // Its vertical sweep includes all counter-rotating fans and the neutral gun.
  const b=this.bounds,m=state.rig.root,x=state.homeX,z=state.homeZ;
  const hx=11*(Math.abs(m[0])+Math.abs(m[8])),hz=11*(Math.abs(m[2])+Math.abs(m[10]));
  b[0]=x-hx;b[1]=state.ground+DRONE_MODEL.restLowestY;b[2]=z-hz;b[3]=x+hx;b[4]=top+5;b[5]=z+hz;
  // Own pad is a deliberately interleaved authored assembly; its swept exact
  // neutral pose was separately checked by the model's mechanical tests.
  return this.clearBox(b,state.padIndex);
 }
 home(state){
  const x=Math.round(state.homeX/T.step),z=Math.round(state.homeZ/T.step);
  for(let layer=0;layer<T.transitLayers.length;layer++){
   const node=layer*this.plane+z*this.cols+x;this.position(node,this.point);
   if(this.free[node]&&this.neutralVertical(state,this.point[1]))return node;
  }
  return -1;
 }
 createSearch(){return {queue:new Uint32Array(this.count),parents:new Int32Array(this.count),distance:new Float64Array(this.count),path:new Uint32Array(this.count),pathLength:0,pathIndex:0,start:-1,visited:0};}
 search(state,fleet=null){
  const s=state.nav,p=this.point;s.parents.fill(-2);s.distance.fill(Infinity);let start=-1,best=Infinity;
  for(let node=0;node<this.count;node++)if(this.free[node]){
   this.position(node,p);const d=Math.abs(p[0]-state.x)+Math.abs(p[1]-state.y)+Math.abs(p[2]-state.z);
   if(d<best&&this.clearSegment(state.x,state.y,state.z,p[0],p[1],p[2])&&(!fleet||fleet.fleetClear(state,state.x,state.y,state.z,p[0],p[1],p[2]))){best=d;start=node;if(d<1e-8)break;}
  }
  s.start=start;s.visited=0;if(start<0)return false;
  let head=0,tail=1;s.queue[0]=start;s.parents[start]=-1;s.distance[start]=best;
  while(head<tail){const node=s.queue[head++];for(let d=0;d<6;d++)if(this.edges[node]&(1<<d)){
   const next=node+this.offsets[d];if(s.parents[next]!==-2)continue;
   if(fleet){this.position(node,p);const x=p[0],y=p[1],z=p[2];this.position(next,p);if(!fleet.fleetClear(state,x,y,z,p[0],p[1],p[2]))continue;}
   s.parents[next]=node;s.distance[next]=s.distance[node]+(d%3===2?24:T.step);s.queue[tail++]=next;
  }}
  s.visited=tail;return true;
 }
 route(state,goal){
  const s=state.nav;if(goal<0||s.parents[goal]===-2)return false;
  let node=goal,count=0;while(node>=0&&count<this.count){s.path[count++]=node;node=s.parents[node];}
  for(let i=0;i<count/2;i++){const value=s.path[i];s.path[i]=s.path[count-1-i];s.path[count-1-i]=value;}
  s.pathLength=count;s.pathIndex=0;return true;
 }
 smooth(state,fleet){
  const route=state.nav,knots=this.knots,p=this.point,motion=state.motion;let count=1,index=0;
  knots[0]=state.x;knots[1]=state.y;knots[2]=state.z;
  while(index<route.pathLength){
   const k=(count-1)*3,ax=knots[k],ay=knots[k+1],az=knots[k+2];let last=route.pathLength-1;
   for(;last>index;last--){this.position(route.path[last],p);if(this.clearSegment(ax,ay,az,p[0],p[1],p[2])&&fleet.fleetClear(state,ax,ay,az,p[0],p[1],p[2]))break;}
   this.position(route.path[last],p);if(Math.hypot(p[0]-ax,p[1]-ay,p[2]-az)>1e-7){const next=count++*3;knots[next]=p[0];knots[next+1]=p[1];knots[next+2]=p[2];}index=last+1;
  }
  motion.clear();if(count===1)return true;
  let x=knots[0],y=knots[1],z=knots[2];
  for(let i=1;i<count-1;i++){
   const k=i*3,cx=knots[k],cy=knots[k+1],cz=knots[k+2],px=knots[k-3]-cx,py=knots[k-2]-cy,pz=knots[k-1]-cz,nx=knots[k+3]-cx,ny=knots[k+4]-cy,nz=knots[k+5]-cz,prev=Math.hypot(px,py,pz),next=Math.hypot(nx,ny,nz),cut=Math.min(T.cornerRadius,prev*.3,next*.3);
   const ax=cx+px*cut/prev,ay=cy+py*cut/prev,az=cz+pz*cut/prev,bx=cx+nx*cut/next,by=cy+ny*cut/next,bz=cz+nz*cut/next,b=this.bounds,r=T.hullRadius;
   b[0]=Math.min(ax,cx,bx)-r;b[1]=Math.min(ay,cy,by)-T.hullBelow;b[2]=Math.min(az,cz,bz)-r;b[3]=Math.max(ax,cx,bx)+r;b[4]=Math.max(ay,cy,by)+T.hullAbove;b[5]=Math.max(az,cz,bz)+r;
   const round=cut>1&&this.clearBox(b)&&fleet.fleetBoxClear(state,b);
   if(round){if(!motion.add(x,y,z,0,0,0,ax,ay,az,false)||!motion.add(ax,ay,az,cx,cy,cz,bx,by,bz,true))return false;x=bx;y=by;z=bz;}
   else{if(!motion.add(x,y,z,0,0,0,cx,cy,cz,false,0))return false;x=cx;y=cy;z=cz;}
  }
  const last=(count-1)*3;return motion.add(x,y,z,0,0,0,knots[last],knots[last+1],knots[last+2],false,0);
 }
 dispose(){this.world=this.visibility=null;this.padIndices.clear();this.free=this.edges=this.defences=this.offsets=this.bounds=this.point=this.knots=null;this.count=this.byteLength=0;}
}
