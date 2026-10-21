import {debrisPalette} from '../engine/damage-effects.js';
import {FishPreview} from './fish-preview.js';
import {MISSILE_LAUNCHER_SOCKETS,GUIDED_MISSILE_MODEL} from '../shared/missile-model.js';
import {PoseRig} from '../engine/rig.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';
import {TerrainField} from '../shared/terrain.js';
import {previewLevelForId} from '../shared/preview-levels.js';
import {isNonCombatPreview} from '../shared/preview-mode.js';
import {shortestAngle} from '../engine/path-motion.js';

const TAU=Math.PI*2,FOLD=70*Math.PI/180,FLAP=45*Math.PI/180,STEP=4,SEARCH_BUDGET=512,WAYPOINTS=256;
const HARE_SPEED=20,HARE_HOP_SPAN=8,HARE_HOP_HEIGHT=1.2,BIRD_SPEED=44,FLEE_BOOST=1.5,FEAR_SECONDS=2,ENEMY_DISTANCE=24,EXPLOSION_SLOTS=8,EXPLOSION_SECONDS=1.5;
const EMPTY=Object.freeze([]),IDS={A:['wildlife-hare-moss','wildlife-bird-moss'],B:['wildlife-lizard-ochre','wildlife-bird-ochre'],C:['wildlife-hare-ice','wildlife-bird-ice'],D:['wildlife-beetle-plum','wildlife-bird-plum']};
const HABITATS={A:[[1,2],[9,2],[11,15]],B:[[2,4],[9,14],[14,5]],C:[[2,11],[6,12],[15,14]],D:[[15,4],[13,8],[2,15]]};
const PERCHES={A:[['scene-37',[11.5,44,11.5]],['scene-19',[11.5,37,11.5]],['scene-60',[11.5,44,11.5]]],B:[['scene-34',[11.5,26,11.5]],['scene-4',[10.5,47,11.5]],['scene-48',[11.5,26,11.5]]],C:[['scene-11',[11.5,38,11.5]],['scene-43',[11.5,38,11.5]],['scene-50',[11.5,38,11.5]]],D:[['scene-33',[11.5,42,14.5]],['scene-4',[11.5,43,11.5]],['scene-49',[11.5,42,14.5]]]};
const ROSTERS={};
for(const zone of ['A','B','C','D'])ROSTERS[zone]=Object.freeze([
 ...HABITATS[zone].map((box,i)=>Object.freeze({id:`wildlife-ground-${i+1}`,model:IDS[zone][0],variant:'base',kind:'ground',habitat:Object.freeze(box),offset:i*4})),
 ...PERCHES[zone].map(([perch,point],i)=>Object.freeze({id:`wildlife-bird-${i+1}`,model:IDS[zone][1],variant:'base',kind:'bird',perch,point:Object.freeze(point),offset:2+i*4})),
]);
// A4 has its own landscape and stable scenery IDs. Seeds are safe openings
// and retained canopy anchors, not confinement areas or new wildlife rules.
const A4_ROSTER=Object.freeze([
 ...[[5,9],[11,12],[16,6]].map((box,i)=>Object.freeze({id:`wildlife-ground-${i+1}`,model:IDS.A[0],variant:'base',kind:'ground',habitat:Object.freeze(box),offset:i*4})),
 ...[['a4-land-1-2',[11.5,54,11.5]],['a4-land-16-12',[11.5,54,11.5]],['a4-land-3-14',[11.5,44,11.5]]].map(([perch,point],i)=>Object.freeze({id:`wildlife-bird-${i+1}`,model:IDS.A[1],variant:'base',kind:'bird',perch,point:Object.freeze(point),offset:2+i*4})),
]);
// ID-only calls describe the shared models to preload. A loaded level can
// supply its own seeds without retaining another zone's scenery in memory.
// Legacy fixtures without authored seeds retain their original habitat data.
export function wildlifeActorsForLevel(levelOrId){
 const level=typeof levelOrId==='object'&&levelOrId!==null?levelOrId:null,id=level?.id??levelOrId;
 if(isNonCombatPreview(level)&&level.previewWildlife===undefined)return EMPTY;
 if(level?.previewWildlife===undefined)return id==='moss-04'?A4_ROSTER:ROSTERS[previewLevelForId(id)?.zone]??EMPTY;
 const zone=level.zone,config=level.previewWildlife;
 if(!IDS[zone]||!config||!Array.isArray(config.habitats)||![3,9].includes(config.habitats.length)||!Array.isArray(config.perches)||config.perches.length!==3)throw new Error('A preview requires three or nine ground wildlife seeds and three bird perches.');
 for(const box of config.habitats)if(!Array.isArray(box)||box.length!==2||box.some((n,i)=>!Number.isInteger(n)||n<0||n>=level.size[i]))throw new Error('Invalid authored wildlife habitat.');
 if(config.habitatPoints!==undefined){
  if(!Array.isArray(config.habitatPoints)||config.habitatPoints.length!==config.habitats.length)throw new Error('Invalid authored wildlife habitat points.');
  for(let i=0;i<config.habitats.length;i++){
   const point=config.habitatPoints[i],box=config.habitats[i];
   if(!Array.isArray(point)||point.length!==3||!point.every(Number.isFinite)||point[1]<0||Math.floor(point[0]/24)!==box[0]||Math.floor(point[2]/24)!==box[1])throw new Error('Invalid authored wildlife habitat point.');
  }
 }
 const perchIds=new Set();
 for(const perch of config.perches){
  if(!perch||typeof perch.id!=='string'||perchIds.has(perch.id)||!Array.isArray(perch.point)||perch.point.length!==3||!perch.point.every(Number.isFinite))throw new Error('Invalid authored wildlife perch.');
  perchIds.add(perch.id);
 }
 return Object.freeze([
  ...config.habitats.map((box,i)=>Object.freeze({id:`wildlife-ground-${i+1}`,model:IDS[zone][0],variant:'base',kind:'ground',habitat:Object.freeze(box.slice()),...(config.habitatPoints?{point:Object.freeze(config.habitatPoints[i].slice())}:{}),offset:i*4})),
  ...config.perches.map(({id:perch,point},i)=>Object.freeze({id:`wildlife-bird-${i+1}`,model:IDS[zone][1],variant:'base',kind:'bird',perch,point:Object.freeze(point.slice()),offset:2+i*4})),
 ]);
}
const ease=t=>t*t*(3-2*t);
const hash=text=>{let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return n>>>0||1;};
function random(s){let n=s.random;n^=n<<13;n^=n>>>17;n^=n<<5;s.random=n>>>0;return s.random/4294967296;}
function point(m,x,y,z,out){out[0]=m[0]*x+m[4]*y+m[8]*z+m[12];out[1]=m[1]*x+m[5]*y+m[9]*z+m[13];out[2]=m[2]*x+m[6]*y+m[10]*z+m[14];}
function overlaps(a,b,o=0){return a[0]<b[o+3]-1e-6&&a[3]>b[o]+1e-6&&a[1]<b[o+4]-1e-6&&a[4]>b[o+1]+1e-6&&a[2]<b[o+5]-1e-6&&a[5]>b[o+2]+1e-6;}
function boxClear(bounds,world,defences){
 if(bounds[0]<0||bounds[2]<0||bounds[3]>world.width||bounds[5]>world.length)return false;
 const tree=world.visibility;if(!tree?.bounds)return false;
 let node=0;while(node<tree.nodeCount){if(overlaps(bounds,tree.bounds,node*6)){if(tree.escape[node]===node+1)return false;node++;}else node=tree.escape[node];}
 for(let i=0;i<defences.length;i+=6)if(overlaps(bounds,defences,i))return false;
 return true;
}
function defenceBounds(world){
 const out=[];
 for(const data of world.rigs.values())if(data.role==='defence'){
  let radius=0,height=0;for(const part of data.parts)for(const c of part.voxels){height=Math.max(height,c[1]+1);for(const dx of [0,1])for(const dz of [0,1])radius=Math.max(radius,Math.hypot(c[0]+dx-12,c[2]+dz-12));}
  // Clearance follows model role even before a defence has combat rules.
  // Loaded rounds protrude above the launcher casing; include their tips in bird clearance.
  if(data.model==='missile-launcher')for(const socket of MISSILE_LAUNCHER_SOCKETS[data.variant])height=Math.max(height,socket[1]+GUIDED_MISSILE_MODEL.height);
  // Only the gun turret needs its existing 1.25-unit recoil allowance.
  if(data.model==='turret-study'){
   radius+=TURRET_RECOIL.distance;
   // Scene-build-only envelope: yaw preserves height. Pitch extrema can occur
   // between the mechanical endpoints; recoil is linear at each fixed angle.
   const guns=data.parts.find(part=>part.id===TURRET_PITCH.part);
   if(guns)for(const c of guns.voxels)for(const dy of [0,1])for(const dz of [0,1])for(const recoil of [0,TURRET_RECOIL.distance]){
    const y=c[1]+dy-guns.pivot[1],z=c[2]+dz+recoil-guns.pivot[2];
    for(const angle of [TURRET_PITCH.min,TURRET_PITCH.max])height=Math.max(height,guns.pivot[1]+Math.cos(angle)*y-Math.sin(angle)*z);
    const peak=Math.atan2(-z,y);
    if(peak>=TURRET_PITCH.min&&peak<=TURRET_PITCH.max)height=Math.max(height,guns.pivot[1]+Math.hypot(y,z));
   }
  }
  const m=data.root,x=m[0]*12+m[8]*12+m[12],z=m[2]*12+m[10]*12+m[14],y=m[13];
  out.push(x-radius,y,z-radius,x+radius,y+height,z+radius);
 }
 return new Float64Array(out);
}
function modelEnvelope(data,bird){
 let radius=0,height=0;const add=(x,y,z)=>{radius=Math.max(radius,Math.hypot(x-12,z-12));height=Math.max(height,y);};
 for(const part of data.parts)for(const c of part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){
  const x=c[0]+dx,y=c[1]+dy,z=c[2]+dz;
  if(!bird||part.id==='body'){add(x,y,z);continue;}
  const pivot=part.pivot,px=x-pivot[0],py=y-pivot[1],left=part.id==='wing-l',lo=left?-FLAP:-FOLD,hi=left?FOLD:FLAP,angles=[lo,hi];
  for(const base of [Math.atan2(-py,px),Math.atan2(px,py)])for(let k=-2;k<=2;k++){const angle=base+k*Math.PI;if(angle>lo&&angle<hi)angles.push(angle);}
  for(const a of angles){const co=Math.cos(a),si=Math.sin(a);add(pivot[0]+co*px-si*py,pivot[1]+si*px+co*py,z);}
 }
 return {radius:radius+1e-5,height:height+1e-5};
}
function rigCells(data){
 const cells=new Set(),top=[],p=new Float64Array(3);let maxY=-Infinity;
 for(const part of data.parts)for(const c of part.voxels){point(data.root,c[0]+.5,c[1]+.5,c[2]+.5,p);const x=Math.floor(p[0]),y=Math.floor(p[1]),z=Math.floor(p[2]);cells.add(`${x},${y},${z}`);if(y>maxY){maxY=y;top.length=0;}if(y===maxY)top.push([x,y+1,z]);}
 return {cells,top};
}
function supported(data,cells,x,y,z,yaw){
 const co=Math.cos(yaw),si=Math.sin(yaw);
 for(const part of data.parts)for(const c of part.voxels)if(c[1]===0){
  let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  for(const dx of [0,1])for(const dz of [0,1]){const xx=x+co*(c[0]+dx-12)+si*(c[2]+dz-12),zz=z-si*(c[0]+dx-12)+co*(c[2]+dz-12);minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minZ=Math.min(minZ,zz);maxZ=Math.max(maxZ,zz);}
  for(let xx=Math.floor(minX+1e-6);xx<Math.ceil(maxX-1e-6);xx++)for(let zz=Math.floor(minZ+1e-6);zz<Math.ceil(maxZ-1e-6);zz++)if(!cells.has(`${xx},${Math.floor(y-1e-6)},${zz}`))return false;
 }
 return true;
}
function groundClear(bounds,y,world,field,defences){
 if(bounds[0]<0||bounds[2]<0||bounds[3]>world.width||bounds[5]>world.length)return false;
 for(let z=Math.floor(bounds[2]/24);z<=Math.floor((bounds[5]-1e-6)/24);z++)for(let x=Math.floor(bounds[0]/24);x<=Math.floor((bounds[3]-1e-6)/24);x++)if(field.flatBox(x,z)!==y)return false;
 return boxClear(bounds,world,defences);
}
function navigation(world,field,defences,radius,height){
 const cols=Math.floor(world.width/STEP),rows=Math.floor(world.length/STEP),count=cols*rows,heights=new Float32Array(count).fill(-1),offPath=new Uint8Array(count),edges=new Uint8Array(count),component=new Int32Array(count).fill(-1),bounds=new Float64Array(6);
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
  const px=(x+.5)*STEP,pz=(z+.5)*STEP,y=field.height(px,pz);bounds.set([px-radius,y,pz-radius,px+radius,y+height,pz+radius]);
  if(groundClear(bounds,y,world,field,defences)){
   const node=z*cols+x;heights[node]=y;offPath[node]=1;
   for(let bz=Math.floor(bounds[2]/24);bz<=Math.floor((bounds[5]-1e-6)/24);bz++)for(let bx=Math.floor(bounds[0]/24);bx<=Math.floor((bounds[3]-1e-6)/24);bx++)if(field.protected(bx,bz))offPath[node]=0;
  }
 }
 const dx=[1,0,-1,0],dz=[0,1,0,-1],offsets=new Int32Array([1,cols,-1,-cols]);
 for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
  const node=z*cols+x,y=heights[node];if(y<0)continue;
  for(let dir=0;dir<2;dir++){
   const nx=x+dx[dir],nz=z+dz[dir],next=nz*cols+nx;if(nx>=cols||nz>=rows||heights[next]!==y)continue;
   bounds.set([(Math.min(x,nx)+.5)*STEP-radius,y,(Math.min(z,nz)+.5)*STEP-radius,(Math.max(x,nx)+.5)*STEP+radius,y+height,(Math.max(z,nz)+.5)*STEP+radius]);
   if(groundClear(bounds,y,world,field,defences)){edges[node]|=1<<dir;edges[next]|=1<<(dir+2);}
  }
 }
 const queue=new Uint32Array(count),members=[],starts=[0];let components=0;
 for(let node=0;node<count;node++)if(heights[node]>=0&&component[node]<0){
  let head=0,tail=1;queue[0]=node;component[node]=components;
  while(head<tail){const current=queue[head++];members.push(current);for(let d=0;d<4;d++)if(edges[current]&(1<<d)){const next=current+offsets[d];if(component[next]<0){component[next]=components;queue[tail++]=next;}}}
  starts.push(members.length);components++;
 }
 return {cols,rows,count,heights,offPath,edges,component,offsets,members:new Uint32Array(members),starts:new Uint32Array(starts),queue,parents:new Int32Array(count),seen:new Uint32Array(count),epoch:0,owner:null,head:0,tail:0,goal:0};
}
function flightY(a,b,c,t){const q=1-t;return q*q*q*a+3*q*t*c+t*t*t*b;}
function flightPeak(a,b,c){
 const aa=b-a,bb=2*(a-c),cc=c-a;if(Math.abs(aa)<1e-10)return .5;
 const root=Math.sqrt(bb*bb-4*aa*cc),x=(-bb-root)/(2*aa),y=(-bb+root)/(2*aa);return x>0&&x<1?x:y;
}
function flightClear(s,target,ceiling,world,defences,bounds,start=0){
 const peak=flightPeak(s.y,target.y,ceiling),r=s.radius;
 for(let i=0;i<64;i++){
  const lo=start+(1-start)*i/64,hi=start+(1-start)*(i+1)/64,a=ease(lo),b=ease(hi),x0=s.x+(target.x-s.x)*a,x1=s.x+(target.x-s.x)*b,z0=s.z+(target.z-s.z)*a,z1=s.z+(target.z-s.z)*b,y0=flightY(s.y,target.y,ceiling,lo),y1=flightY(s.y,target.y,ceiling,hi);
  bounds[0]=Math.min(x0,x1)-r;bounds[3]=Math.max(x0,x1)+r;bounds[2]=Math.min(z0,z1)-r;bounds[5]=Math.max(z0,z1)+r;bounds[1]=Math.min(y0,y1);bounds[4]=(peak>lo&&peak<hi?flightY(s.y,target.y,ceiling,peak):Math.max(y0,y1))+s.height;
  if(!boxClear(bounds,world,defences))return false;
 }
 return true;
}

// A straight escape segment never initially approaches its threat. Its
// squared distance is convex, so this derivative check covers the full segment.
function away(x,z,tx,tz,sx,sz){return (x-sx)*(tx-x)+(z-sz)*(tz-z)>=-1e-6;}
function intervalDistance(value,lo,hi){return value<lo?lo-value:value>hi?value-hi:0;}
function arcEscapes(s,x0,y0,z0,x1,y1,z1,ceiling,start){
 const cy=s.y+s.centerOffset,initial=(s.x-s.threatX)**2+(cy-s.threatY)**2+(s.z-s.threatZ)**2,end=(x1-s.threatX)**2+(y1+s.centerOffset-s.threatY)**2+(z1-s.threatZ)**2;
 if(end<=initial+1)return false;const peak=flightPeak(y0,y1,ceiling);
 for(let i=0;i<64;i++){
  const lo=start+(1-start)*i/64,hi=start+(1-start)*(i+1)/64,a=ease(lo),b=ease(hi),ax=x0+(x1-x0)*a,bx=x0+(x1-x0)*b,az=z0+(z1-z0)*a,bz=z0+(z1-z0)*b,ay=flightY(y0,y1,ceiling,lo)+s.centerOffset,by=flightY(y0,y1,ceiling,hi)+s.centerOffset;
  const dx=intervalDistance(s.threatX,Math.min(ax,bx),Math.max(ax,bx)),dz=intervalDistance(s.threatZ,Math.min(az,bz),Math.max(az,bz)),dy=intervalDistance(s.threatY,Math.min(ay,by),peak>lo&&peak<hi?flightY(y0,y1,ceiling,peak)+s.centerOffset:Math.max(ay,by));
  if(dx*dx+dy*dy+dz*dz<initial-1e-5)return false;
 }
 return true;
}

// Autonomous cosmetic journeys. Only one actor thinks per advance; a shared
// incremental BFS job is resumed on its owner's next scheduled turn. Accepted
// movement and wing poses use delta seconds and reuse all state/buffers.
export class WildlifePreview {
 constructor(world,onPoseChange,actors=wildlifeActorsForLevel(world.level),onVisible=()=>{}){
  this.onVisible=onVisible;this.gibCount=0;
  this.fish=new FishPreview(world,onPoseChange);world.onDebrisWaterImpact=this.fish.states.length?this.fish.spookWaterImpact.bind(this.fish):null;this.states=[];this.time=0;this.updatedParts=0;this.thinkCount=0;this.lastThinkId=null;this.lastThinkWork=0;this.thinker=0;this.world=world;this.defences=null;this.nav=null;this.perches=[];this.treePerches=[];this.bounds=new Float64Array(6);this.planningBytes=0;this.threatSources=EMPTY;this.explosions=new Float64Array(EXPLOSION_SLOTS*5);this.explosionCursor=0;this.spookCount=0;
  for(const s of this.fish.states){s.dead=false;s.gibPalette=debrisPalette(world,world.actors.get(s.id));}
  if(!Array.isArray(actors)||actors.length>12)throw new Error('Invalid cosmetic actor collection.');if(!actors.length)return;
  const field=new TerrainField(world.level),actorIds=new Set();this.defences=defenceBounds(world);let groundRadius=0,groundHeight=0,birdData=null,birdEnvelope=null;
  for(const actor of actors){
   if(actorIds.has(actor.id)||!Number.isFinite(actor.offset)||!['ground','bird'].includes(actor.kind))throw new Error('Invalid cosmetic actor configuration.');actorIds.add(actor.id);
   const data=world.actors.get(actor.id);if(!data||data.model!==actor.model||data.variant!==actor.variant)throw new Error('Wildlife runtime actor is missing.');
   const bird=actor.kind==='bird',envelope=modelEnvelope(data,bird),rig=new PoseRig(data,onPoseChange),hop=actor.model.includes('-hare-')?HARE_HOP_HEIGHT:0;
   if(bird&&(rig.bones.length!==3||!rig.byId.has('body')||!rig.byId.has('wing-l')||!rig.byId.has('wing-r')))throw new Error('Wildlife bird wing rig is missing.');
   const s={id:actor.id,model:actor.model,kind:actor.kind,rig,dead:false,gibPalette:world.entries?debrisPalette(world,data):null,radius:envelope.radius,height:envelope.height,hop,random:hash(world.level.id+actor.id),phase:bird?'perched':'idle',flight:false,x:0,y:0,z:0,yaw:0,wing:FOLD,homeX:0,homeY:0,homeZ:0,readyAt:1+actor.offset*.35,thinkCount:0,frightened:false,fleeUntil:0,spooks:0,fleeJourneys:0,lastSpookKind:null,threatKind:null,threatX:0,threatY:0,threatZ:0,centerOffset:bird?3:envelope.height*.5,journeys:0,journeysCompleted:0,groundComponent:-1,destinationX:0,destinationY:0,destinationZ:0,targetPerch:null,travelled:0,hopSpan:HARE_HOP_SPAN,node:-1,edgeNode:-1,goalNode:-1,route:bird?null:new Uint32Array(WAYPOINTS),routeLength:0,routeIndex:0,blockedFor:0,speed:hop?HARE_SPEED:actor.model.includes('lizard')?6:4,fleeSpeed:bird?66:hop?30:actor.model.includes('lizard')?24:12,perch:-1,goalPerch:-1,fromX:0,fromY:0,fromZ:0,fromYaw:0,fromWing:FOLD,flightTime:0,duration:0,ceiling:0};
   if(bird){birdData=data;birdEnvelope=envelope;}else{
    if(!Array.isArray(actor.habitat)||actor.habitat.length!==2||actor.habitat.some((v,i)=>!Number.isInteger(v)||v<0||v>=world.level.size[i]))throw new Error('Invalid wildlife habitat.');
    const [bx,bz]=actor.habitat,y=field.flatBox(bx,bz);if(y===null)throw new Error('Wildlife habitat must be flat and dry.');
    if(actor.point&&(!Array.isArray(actor.point)||actor.point.length!==3||!actor.point.every(Number.isFinite)||Math.floor(actor.point[0]/24)!==bx||Math.floor(actor.point[2]/24)!==bz||actor.point[1]!==y))throw new Error('Wildlife habitat point must be on its flat dry ground.');
    s.homeX=actor.point?.[0]??(bx+.5)*24;s.homeY=y;s.homeZ=actor.point?.[2]??(bz+.5)*24;groundRadius=Math.max(groundRadius,s.radius);groundHeight=Math.max(groundHeight,s.height+hop);
   }
   this.states.push(s);
  }
  if(groundRadius){
   this.nav=navigation(world,field,this.defences,groundRadius,groundHeight);const nav=this.nav;
   for(const s of this.states)if(s.kind==='ground'){
    let best=-1,distance=Infinity;for(let n=0;n<nav.count;n++)if(nav.heights[n]===s.homeY){const x=(n%nav.cols+.5)*STEP,z=(Math.floor(n/nav.cols)+.5)*STEP,d=(x-s.homeX)**2+(z-s.homeZ)**2;if(d<distance){best=n;distance=d;}}
    if(best<0||distance>100)throw new Error('Wildlife habitat has no safe ground spawn.');s.node=best;s.groundComponent=nav.component[best];s.x=(best%nav.cols+.5)*STEP;s.z=(Math.floor(best/nav.cols)+.5)*STEP;s.y=s.homeY;
   }
   this.planningBytes=Object.values(nav).reduce((n,v)=>n+(ArrayBuffer.isView(v)?v.byteLength:0),0)+this.states.reduce((n,s)=>n+(s.route?.byteLength??0),0);
  }
  if(birdData)this.preparePerches(actors,birdData,birdEnvelope);
  this.maxHeight=world.visibility.bounds[4];for(let i=4;i<this.defences.length;i+=6)this.maxHeight=Math.max(this.maxHeight,this.defences[i]);
  for(const s of this.states){s.destinationX=s.x;s.destinationY=s.y;s.destinationZ=s.z;this.writePose(s,true);}
 }
 // Stage topology without touching live states. Occupied or newly isolated
 // cosmetic animals respawn on verified usable ground/perches at commit.
 prepareDeployment(world){
  const defences=defenceBounds(world),grounds=this.states.filter(s=>s.kind==='ground'),bounds=new Float64Array(6),reject=reason=>({valid:false,code:'wildlife-habitat',reason});
  const nav=grounds.length?navigation(world,new TerrainField(world.level),defences,Math.max(...grounds.map(s=>s.radius)),Math.max(...grounds.map(s=>s.height+s.hop))):null,reroute=[],respawn=[];
  const edge=(a,b)=>a===b||nav.offsets.some((offset,d)=>a+offset===b&&(nav.edges[a]&(1<<d)));
  for(const s of this.states){
   if(s.dead){respawn.push({state:s});continue;}
   bounds.set([s.x-s.radius,s.y,s.z-s.radius,s.x+s.radius,s.y+s.height,s.z+s.radius]);
   if(!boxClear(bounds,world,defences)){respawn.push({state:s});continue;}
   if(s.kind==='bird'){
    if(s.phase==='flying'&&!flightClear({x:s.fromX,y:s.fromY,z:s.fromZ,radius:s.radius,height:s.height},this.perches[s.goalPerch],s.ceiling,world,defences,bounds,Math.min(1,s.flightTime/s.duration)))respawn.push({state:s});
    continue;
   }
   if(nav.heights[s.node]<0||s.edgeNode>=0&&(nav.heights[s.edgeNode]<0||!edge(s.node,s.edgeNode))){respawn.push({state:s});continue;}
   // Also guard the partial current edge, whose start need not be a nav node.
   if(s.edgeNode>=0){const x=(s.edgeNode%nav.cols+.5)*STEP,z=(Math.floor(s.edgeNode/nav.cols)+.5)*STEP;
    bounds.set([Math.min(s.x,x)-s.radius,nav.heights[s.node],Math.min(s.z,z)-s.radius,Math.max(s.x,x)+s.radius,nav.heights[s.node]+s.height+s.hop,Math.max(s.z,z)+s.radius]);
    if(!boxClear(bounds,world,defences)){respawn.push({state:s});continue;}
   }
   const component=nav.component[s.node],begin=nav.starts[component],end=nav.starts[component+1];let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(let i=begin;i<end;i++){const n=nav.members[i],x=n%nav.cols,z=Math.floor(n/nav.cols);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
   if(end-begin<64||Math.max(maxX-minX,maxZ-minZ)*STEP<48){respawn.push({state:s});continue;}
   let previous=s.node,valid=true;for(let i=s.routeIndex;i<s.routeLength;i++){const next=s.route[i];if(nav.heights[next]<0||!edge(previous,next)){valid=false;break;}previous=next;}
   if(!valid||s.phase==='planning')reroute.push(s);
  }
  // Reserve all destinations before mutating a pose. Keep unblocked animals'
  // current positions and goal reservations, and separate replacement spawns.
  const moving=new Set(respawn.map(r=>r.state)),placed=[];
  for(const request of respawn){
   const s=request.state;let best=Infinity,choice=-1;
   if(s.kind==='bird'){
    for(let i=0;i<this.perches.length;i++){
     const p=this.perches[i];bounds.set([p.x-s.radius,p.y,p.z-s.radius,p.x+s.radius,p.y+s.height,p.z+s.radius]);
     if(!boxClear(bounds,world,defences)||this.states.some(o=>o!==s&&o.kind==='bird'&&!moving.has(o)&&(this.perches[o.perch]?.id===p.id||this.perches[o.goalPerch]?.id===p.id))||placed.some(r=>r.state.kind==='bird'&&this.perches[r.perch].id===p.id))continue;
     const d=(p.x-s.x)**2+(p.y-s.y)**2+(p.z-s.z)**2;if(d<best){best=d;choice=i;}
    }
    if(choice<0)return reject('Leave a supported, clear perch for the birds.');request.perch=choice;
   }else{
    for(let c=0;c<nav.starts.length-1;c++){
     const begin=nav.starts[c],end=nav.starts[c+1];if(end-begin<64)continue;
     let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
     for(let i=begin;i<end;i++){const n=nav.members[i];minX=Math.min(minX,n%nav.cols);maxX=Math.max(maxX,n%nav.cols);minZ=Math.min(minZ,Math.floor(n/nav.cols));maxZ=Math.max(maxZ,Math.floor(n/nav.cols));}
     if(Math.max(maxX-minX,maxZ-minZ)*STEP<48)continue;
     for(let i=begin;i<end;i++){
      const node=nav.members[i],x=(node%nav.cols+.5)*STEP,z=(Math.floor(node/nav.cols)+.5)*STEP,y=nav.heights[node],d=(x-s.x)**2+(y-s.y)**2+(z-s.z)**2;if(d>=best)continue;
      if(this.states.some(o=>o!==s&&o.kind==='ground'&&!moving.has(o)&&((x-o.x)**2+(z-o.z)**2<(s.radius+o.radius+2)**2||o.goalNode>=0&&(x-(o.goalNode%nav.cols+.5)*STEP)**2+(z-(Math.floor(o.goalNode/nav.cols)+.5)*STEP)**2<(s.radius+o.radius+2)**2))||placed.some(r=>r.state.kind==='ground'&&(x-(r.node%nav.cols+.5)*STEP)**2+(z-(Math.floor(r.node/nav.cols)+.5)*STEP)**2<(s.radius+r.state.radius+2)**2))continue;
      best=d;choice=node;
     }
    }
    if(choice<0)return reject('Leave connected roaming ground with room for wildlife journeys.');request.node=choice;
   }
   placed.push(request);
  }
  return {valid:true,nav,defences,reroute,respawn};
 }
 commitDeployment(plan){
  this.nav=plan.nav;this.defences=plan.defences;
  for(const {state:s,node,perch}of plan.respawn){
   s.dead=false;this.onVisible(s.id,true);s.frightened=false;s.fleeUntil=0;s.blockedFor=0;s.readyAt=this.time+.2;
   if(s.kind==='ground'){
    s.node=node;s.edgeNode=s.goalNode=-1;s.routeLength=s.routeIndex=0;s.routeInterrupted=false;s.phase='idle';s.x=(node%this.nav.cols+.5)*STEP;s.z=(Math.floor(node/this.nav.cols)+.5)*STEP;s.y=this.nav.heights[node];
   }else{
    const p=this.perches[perch];s.perch=perch;s.goalPerch=-1;s.targetPerch=null;s.flight=false;s.flightTime=0;s.phase='perched';s.x=p.x;s.y=p.y;s.z=p.z;s.yaw=p.yaw;s.wing=FOLD;
   }
   s.homeX=s.destinationX=s.x;s.homeY=s.destinationY=s.y;s.homeZ=s.destinationZ=s.z;this.writePose(s,true);
  }
  for(const s of this.states)if(s.kind==='ground'){
   s.groundComponent=this.nav.component[s.node];
   if(plan.reroute.includes(s)){
    if(s.edgeNode>=0){s.route[0]=s.edgeNode;s.routeIndex=0;s.routeLength=1;s.goalNode=s.edgeNode;s.routeInterrupted=true;s.destinationX=(s.edgeNode%this.nav.cols+.5)*STEP;s.destinationY=this.nav.heights[s.edgeNode];s.destinationZ=(Math.floor(s.edgeNode/this.nav.cols)+.5)*STEP;}
    else{s.phase='idle';s.routeLength=s.routeIndex=0;s.goalNode=-1;s.readyAt=this.time;s.destinationX=s.x;s.destinationY=this.nav.heights[s.node];s.destinationZ=s.z;}
   }
  }
  this.planningBytes=(this.nav?Object.values(this.nav).reduce((n,v)=>n+(ArrayBuffer.isView(v)?v.byteLength:0),0):0)+this.states.reduce((n,s)=>n+(s.route?.byteLength??0),0);
  this.maxHeight=this.world.visibility.bounds[4];for(let i=4;i<this.defences.length;i+=6)this.maxHeight=Math.max(this.maxHeight,this.defences[i]);
 }
 preparePerches(actors,data,envelope){
  const bounds=this.bounds,home=new Float64Array(3);
  const add=(id,x,y,z,yaw,tree)=>{const index=this.perches.length;this.perches.push({id,x,y,z,yaw,tree});if(tree)this.treePerches.push(index);return index;};
  const valid=(cells,x,y,z,yaw)=>{
   if(!supported(data,cells,x,y,z,yaw))return false;
   bounds.set([x-envelope.radius,y,z-envelope.radius,x+envelope.radius,y+envelope.height,z+envelope.radius]);return boxClear(bounds,this.world,this.defences);
  };
  for(const [id,rig]of this.world.rigs)if(/oak|cypress|cactus|fir|plum-tree/.test(rig.model)){
   const {cells,top}=rigCells(rig);let index=-1;
   search:for(const p of top)for(const half of [0,.5])for(let q=0;q<4;q++)if(valid(cells,p[0]+half,p[1],p[2]+half,q*Math.PI/2)){index=add(id,p[0]+half,p[1],p[2]+half,q*Math.PI/2,true);break search;}
  }
  for(const actor of actors)if(actor.kind==='bird'){
   const s=this.states.find(v=>v.id===actor.id),perch=this.world.rigs.get(actor.perch);if(!perch)throw new Error('Wildlife perch is missing.');
   if(!Array.isArray(actor.point)||actor.point.length!==3||actor.point.some(v=>!Number.isFinite(v)))throw new Error('Invalid wildlife perch point.');
   point(perch.root,...actor.point,home);const {cells}=rigCells(perch);let index=-1;
   search:for(const ox of [0,-.5,.5,-1,1,-1.5,1.5])for(const oz of [0,-.5,.5,-1,1,-1.5,1.5])for(let q=0;q<4;q++)if(valid(cells,home[0]+ox,home[1],home[2]+oz,q*Math.PI/2)){index=add(actor.perch,home[0]+ox,home[1],home[2]+oz,q*Math.PI/2,false);break search;}
   if(index<0)throw new Error('Wildlife bird has no supported, clear perch.');
   s.perch=index;const p=this.perches[index];s.x=s.homeX=p.x;s.y=s.homeY=p.y;s.z=s.homeZ=p.z;s.yaw=p.yaw;
  }
 }
 occupied(s,x,z,bird=false,perch=-1){
  for(const other of this.states)if(other!==s&&!other.dead&&other.kind===s.kind){
   if(bird){const id=this.perches[perch].id;if(this.perches[other.perch]?.id===id||this.perches[other.goalPerch]?.id===id)return true;}
   else{
    const radius=s.radius+other.radius+2;if((x-other.x)**2+(z-other.z)**2<radius*radius)return true;
    if(other.goalNode>=0){const nav=this.nav,gx=(other.goalNode%nav.cols+.5)*STEP,gz=(Math.floor(other.goalNode/nav.cols)+.5)*STEP;if((x-gx)**2+(z-gz)**2<radius*radius)return true;}
   }
  }
  return false;
 }
 // Blast lethality is immediate and independent of the one-animal fear
 // thinker. Centres use current 3D animated-root positions, never nav nodes.
 gibExplosion(x,y,z,radius,damage){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<=0)throw new Error('Invalid critter blast.');
  if(!this.world)return 0;let count=0;
  for(const s of this.states)count+=this.gibIfNear(s,x,y,z,radius,damage);
  for(const s of this.fish.states)count+=this.gibIfNear(s,x,y,z,radius,damage);
  this.gibCount+=count;return count;
 }
 gibIfNear(s,x,y,z,radius,damage){
  if(s.dead||(s.x-x)**2+(s.y+(s.centerOffset??2)-y)**2+(s.z-z)**2>radius*radius)return 0;
  damage.gibCritter(s,s.gibPalette,x,y,z,radius);s.dead=true;s.frightened=false;s.flight=false;s.phase='dead';s.goalNode=s.goalPerch=s.edgeNode=-1;s.routeLength=s.routeIndex=0;
  if(this.nav?.owner===s)this.nav.owner=null;
  this.onVisible(s.id,false);return 1;
 }
 prepareCritterRun(){
  if(this.states.some(s=>s.dead)){
   const plan=this.prepareDeployment(this.world);if(!plan.valid)throw new Error(plan.reason);this.commitDeployment(plan);
  }
  for(const s of this.fish.states)if(s.dead){this.fish.respawn(s);this.onVisible(s.id,true);}
  this.explosions?.fill(0);this.fish.events.fill(0);
 }
 get explosionEvents(){return this.spookCount;}
 setThreatSources(enemies){
  if(!Array.isArray(enemies))throw new Error('Wildlife threats must be an existing enemy-state array.');this.threatSources=enemies;
 }
 spookExplosion(x,y,z,radius){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)||!Number.isFinite(radius)||radius<=0)throw new Error('Invalid wildlife explosion threat.');
  if(!this.explosions)return false;const i=this.explosionCursor*5;this.explosions[i]=x;this.explosions[i+1]=y;this.explosions[i+2]=z;this.explosions[i+3]=radius;this.explosions[i+4]=this.time+EXPLOSION_SECONDS;this.explosionCursor=(this.explosionCursor+1)%EXPLOSION_SLOTS;this.spookCount++;return true;
 }
 threatCheck(s){
  let score=Infinity,x=0,y=0,z=0,kind=null;const cy=s.y+s.centerOffset;
  for(const enemy of this.threatSources)if(enemy.health?.alive){
   const d=(s.x-enemy.x)**2+(cy-enemy.aimY)**2+(s.z-enemy.z)**2,r=ENEMY_DISTANCE+s.radius,value=d/(r*r);
   if(value<1&&value<score){score=value;x=enemy.x;y=enemy.aimY;z=enemy.z;kind='enemy';}
  }
  for(let i=0;i<this.explosions.length;i+=5)if(this.explosions[i+4]>this.time){
   const d=(s.x-this.explosions[i])**2+(cy-this.explosions[i+1])**2+(s.z-this.explosions[i+2])**2,r=this.explosions[i+3]+s.radius,value=d/(r*r);
   if(value<1&&value<score){score=value;x=this.explosions[i];y=this.explosions[i+1];z=this.explosions[i+2];kind='explosion';}
  }
  if(kind){
   if(!s.frightened)s.spooks++;s.frightened=true;s.fleeUntil=this.time+FEAR_SECONDS;s.threatKind=s.lastSpookKind=kind;s.threatX=x;s.threatY=y;s.threatZ=z;
   let safe=false;
   if(s.kind==='ground')safe=s.phase==='planning'?this.nav.owner===s&&this.nav.flee:this.groundEscapes(s);
   else if(s.phase==='flying'){const p=this.perches[s.goalPerch];safe=arcEscapes(s,s.fromX,s.fromY,s.fromZ,p.x,p.y,p.z,s.ceiling,s.flightTime/s.duration);}
   if(!safe){
    if(this.nav?.owner===s)this.nav.owner=null;
    s.goalNode=-1;s.goalPerch=-1;s.targetPerch=null;s.routeLength=0;s.phase=s.kind==='ground'?'idle':s.flight?'startled':'perched';s.readyAt=this.time;
    if(s.kind==='ground')s.y=this.nav.heights[s.node];
   }
  }else if(!s.frightened)s.threatKind=null;
 }
 groundEscapes(s){
  if(s.phase!=='hop'&&s.phase!=='scuttle')return false;const n=this.nav;let x=s.x,z=s.z;
  for(let i=s.routeIndex;i<s.routeLength;i++){const node=s.route[i],tx=(node%n.cols+.5)*STEP,tz=(Math.floor(node/n.cols)+.5)*STEP;if(!away(x,z,tx,tz,s.threatX,s.threatZ))return false;x=tx;z=tz;}
  return (x-s.threatX)**2+(z-s.threatZ)**2>(s.x-s.threatX)**2+(s.z-s.threatZ)**2+1;
 }
 startClear(s,node,flee){
  const n=this.nav;if(node<0||n.heights[node]!==n.heights[s.node])return false;
  const x=(node%n.cols+.5)*STEP,z=(Math.floor(node/n.cols)+.5)*STEP;
  // An interrupted actor stays on its already-validated cardinal edge. Only
  // either endpoint of that same edge can seed the next search, without a jump.
  if(Math.abs(x-s.x)>STEP+1e-6||Math.abs(z-s.z)>STEP+1e-6||Math.abs(x-s.x)>1e-6&&Math.abs(z-s.z)>1e-6)return false;
  const r=s.radius,b=this.bounds,y=n.heights[node];b[0]=Math.min(x,s.x)-r;b[1]=y;b[2]=Math.min(z,s.z)-r;b[3]=Math.max(x,s.x)+r;b[4]=y+s.height+s.hop;b[5]=Math.max(z,s.z)+r;
  return boxClear(b,this.world,this.defences)&&this.clearMotion(s,x,z)&&(!flee||away(s.x,s.z,x,z,s.threatX,s.threatZ));
 }
 thinkGround(s){
  const n=this.nav;if(n.owner&&n.owner!==s)return;
  if(!n.owner){
   let goal=-1;const flee=s.frightened;
   if(!flee){
    const component=n.component[s.node],start=n.starts[component],size=n.starts[component+1]-start;
    for(let attempt=0;attempt<8;attempt++){
     const candidate=n.members[start+Math.floor(random(s)*size)],x=(candidate%n.cols+.5)*STEP,z=(Math.floor(candidate/n.cols)+.5)*STEP;
     if((x-s.x)**2+(z-s.z)**2>=(attempt<4?144:STEP*STEP)&&!this.occupied(s,x,z)){goal=candidate;break;}
    }
    if(goal<0){s.readyAt=this.time+1;return;}
   }
   n.owner=s;n.head=0;n.tail=0;n.goal=goal;n.flee=flee;n.threatX=s.threatX;n.threatZ=s.threatZ;n.best=-1;n.bestOff=-1;n.bestOffDistance=-1;n.bestDistance=(s.x-s.threatX)**2+(s.z-s.threatZ)**2;n.escapeDistance=(Math.sqrt(n.bestDistance)+24)**2;n.bestOffDistance=n.bestDistance;n.epoch++;
   if(n.epoch===4294967296){n.seen.fill(0);n.epoch=1;}
   for(let seed=0;seed<2;seed++){const node=seed?s.edgeNode:s.node;if(this.startClear(s,node,flee)&&n.seen[node]!==n.epoch){n.queue[n.tail++]=node;n.parents[node]=-1;n.seen[node]=n.epoch;}}
   if(!n.tail){n.owner=null;s.readyAt=this.time+.1;return;}
   s.goalNode=goal;s.phase='planning';
  }
  let work=0,found=false;
  while(n.head<n.tail&&work<SEARCH_BUDGET){
   const current=n.queue[n.head++],cx=(current%n.cols+.5)*STEP,cz=(Math.floor(current/n.cols)+.5)*STEP;work++;
   if(n.flee){const d=(cx-n.threatX)**2+(cz-n.threatZ)**2;if(!this.occupied(s,cx,cz)){if(d>n.bestDistance){n.best=current;n.bestDistance=d;}if(n.offPath[current]&&d>n.bestOffDistance){n.bestOff=current;n.bestOffDistance=d;if(d>=n.escapeDistance){n.goal=current;found=true;break;}}}}
   else if(current===n.goal){found=true;break;}
   for(let d=0;d<4;d++)if(n.edges[current]&(1<<d)){
    const next=current+n.offsets[d];if(n.seen[next]===n.epoch)continue;
    const x=(next%n.cols+.5)*STEP,z=(Math.floor(next/n.cols)+.5)*STEP;if(this.occupied(s,x,z)||n.flee&&!away(cx,cz,x,z,n.threatX,n.threatZ))continue;
    n.seen[next]=n.epoch;n.parents[next]=current;n.queue[n.tail++]=next;
   }
  }
  this.lastThinkWork=work;
  if(!found&&n.head===n.tail&&n.flee&&n.best>=0){n.goal=n.bestOff>=0?n.bestOff:n.best;found=true;}
  if(found){
   let current=n.goal,count=0;while(current>=0&&count<WAYPOINTS){s.route[count++]=current;current=n.parents[current];}n.owner=null;
   if(current>=0){s.goalNode=-1;s.phase='idle';s.readyAt=this.time+.5;return;}
   for(let i=0;i<count/2;i++){const value=s.route[i];s.route[i]=s.route[count-1-i];s.route[count-1-i]=value;}
   const first=s.route[0],distance=Math.hypot((first%n.cols+.5)*STEP-s.x,(Math.floor(first/n.cols)+.5)*STEP-s.z)+(count-1)*STEP;
   s.hopSpan=distance>0?distance/Math.ceil(distance/HARE_HOP_SPAN):HARE_HOP_SPAN;s.routeLength=count;s.routeIndex=0;s.travelled=0;s.phase=s.hop?'hop':'scuttle';
   if(s.frightened&&!this.groundEscapes(s)){s.routeLength=0;s.goalNode=-1;s.phase='idle';s.readyAt=this.time+.1;return;}
   s.routeInterrupted=false;s.goalNode=n.goal;s.destinationX=(n.goal%n.cols+.5)*STEP;s.destinationY=n.heights[n.goal];s.destinationZ=(Math.floor(n.goal/n.cols)+.5)*STEP;s.journeys++;if(n.flee)s.fleeJourneys++;
  }else if(n.head===n.tail){n.owner=null;s.goalNode=-1;s.phase='idle';s.readyAt=this.time+(s.frightened?.1:1);}
 }
 thinkBird(s){
  if(!this.treePerches.length){s.readyAt=this.time+2;return;}
  const index=this.treePerches[Math.floor(random(s)*this.treePerches.length)],target=this.perches[index];this.lastThinkWork=1;
  if(target.id===this.perches[s.perch].id||this.occupied(s,target.x,target.z,true,index)){s.readyAt=this.time+(s.frightened?.1:.25);return;}
  let ceiling=Math.max(this.maxHeight,s.y,target.y)+(this.maxHeight-Math.min(s.y,target.y))/3+12;
  if(!flightClear(s,target,ceiling,this.world,this.defences,this.bounds)||s.frightened&&!arcEscapes(s,s.x,s.y,s.z,target.x,target.y,target.z,ceiling,0)){
   ceiling+=24;if(!flightClear(s,target,ceiling,this.world,this.defences,this.bounds)||s.frightened&&!arcEscapes(s,s.x,s.y,s.z,target.x,target.y,target.z,ceiling,0)){s.readyAt=this.time+(s.frightened?.1:.5);return;}
  }
  s.goalPerch=index;s.targetPerch=target.id;s.destinationX=target.x;s.destinationY=target.y;s.destinationZ=target.z;s.fromX=s.x;s.fromY=s.y;s.fromZ=s.z;s.fromYaw=s.yaw;s.fromWing=s.wing;s.ceiling=ceiling;s.flightTime=0;
  s.duration=Math.max(1,(Math.hypot(target.x-s.x,target.z-s.z)+2*(ceiling-Math.min(s.y,target.y)))/BIRD_SPEED);s.flight=true;s.phase='flying';s.journeys++;if(s.frightened)s.fleeJourneys++;
 }
 clearMotion(s,x,z){
  const dx=x-s.x,dz=z-s.z,length=dx*dx+dz*dz;
  for(const other of this.states)if(other!==s&&!other.dead&&other.kind==='ground'){
   const t=length?Math.max(0,Math.min(1,((other.x-s.x)*dx+(other.z-s.z)*dz)/length)):0,r=s.radius+other.radius+.25;
   if((s.x+dx*t-other.x)**2+(s.z+dz*t-other.z)**2<r*r)return false;
  }
  return true;
 }
 moveGround(s,dt){
  if(s.phase!=='hop'&&s.phase!=='scuttle')return;let budget=s.speed*dt;const nav=this.nav;
  while(budget>0&&s.routeIndex<s.routeLength){
   const node=s.route[s.routeIndex],tx=(node%nav.cols+.5)*STEP,tz=(Math.floor(node/nav.cols)+.5)*STEP,dx=tx-s.x,dz=tz-s.z,distance=Math.hypot(dx,dz),step=Math.min(distance,budget);
   if(distance<1e-8){s.node=node;s.edgeNode=-1;s.routeIndex++;continue;}s.edgeNode=node;
   const x=s.x+dx*step/distance,z=s.z+dz*step/distance;if(!this.clearMotion(s,x,z)){
    s.blockedFor+=dt;if(s.blockedFor>1){s.phase='idle';s.goalNode=-1;s.routeLength=0;s.readyAt=this.time+.5;s.y=nav.heights[s.node];return;}break;
   }
   s.blockedFor=0;s.x=x;s.z=z;s.travelled+=step;budget-=step;
   const heading=Math.atan2(-dx,-dz),change=shortestAngle(heading-s.yaw),limit=8*step/s.speed;s.yaw+=Math.max(-limit,Math.min(limit,change));
   if(step===distance){s.node=node;s.edgeNode=-1;s.routeIndex++;}
  }
  s.y=nav.heights[s.node]+s.hop*Math.sin(Math.PI*(s.travelled/s.hopSpan%1))**2;
  if(s.routeIndex===s.routeLength){s.phase='idle';s.y=nav.heights[s.node];s.goalNode=-1;s.routeLength=0;if(!s.routeInterrupted)s.journeysCompleted++;s.routeInterrupted=false;s.readyAt=this.time+1.5+random(s)*3;}
 }
 moveBird(s,dt){
  if(s.phase!=='flying')return;s.flightTime=Math.min(s.duration,s.flightTime+dt);const u=s.flightTime/s.duration,t=ease(u),p=this.perches[s.goalPerch];
  s.x=s.fromX+(p.x-s.fromX)*t;s.z=s.fromZ+(p.z-s.fromZ)*t;s.y=flightY(s.fromY,p.y,s.ceiling,u);
  const heading=Math.atan2(s.fromX-p.x,s.fromZ-p.z);s.yaw=heading+shortestAngle(s.fromYaw-heading)*(1-ease(Math.min(1,u/.15)))+shortestAngle(p.yaw-heading)*ease(Math.max(0,(u-.85)/.15));
  const takeoff=ease(Math.min(1,s.flightTime/.3)),landing=ease(Math.max(0,1-(s.duration-s.flightTime)/.3)),flap=FLAP*Math.sin(s.flightTime*6*TAU);s.wing=(s.fromWing*(1-takeoff)+flap*takeoff)*(1-landing)+FOLD*landing;
  if(u===1){s.x=p.x;s.y=p.y;s.z=p.z;s.yaw=p.yaw;s.wing=FOLD;s.perch=s.goalPerch;s.goalPerch=-1;s.targetPerch=null;s.flight=false;s.phase='perched';s.journeysCompleted++;s.readyAt=this.time+2+random(s)*4;}
 }
 writePose(s,force=false){
  const rootChanged=force||s.poseX!==s.x||s.poseY!==s.y||s.poseZ!==s.z||s.poseYaw!==s.yaw,wingChanged=s.kind==='bird'&&(force||s.poseWing!==s.wing);
  if(!rootChanged&&!wingChanged)return;
  if(rootChanged){const c=Math.cos(s.yaw),sin=Math.sin(s.yaw),root=s.rig.root;root[0]=c;root[2]=-sin;root[8]=sin;root[10]=c;root[12]=s.x-12*c-12*sin;root[13]=s.y;root[14]=s.z+12*sin-12*c;s.rig.invalidateRoot();}
  if(wingChanged){s.rig.setRotation('wing-l',0,0,s.wing);s.rig.setRotation('wing-r',0,0,-s.wing);}
  s.poseX=s.x;s.poseY=s.y;s.poseZ=s.z;s.poseYaw=s.yaw;s.poseWing=s.wing;this.updatedParts+=s.rig.update();
 }
 advance(deltaSeconds){
  if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw new Error('Invalid wildlife delta.');this.updatedParts=0;this.lastThinkWork=0;
  if(!deltaSeconds)return;this.fish.advance(deltaSeconds);this.updatedParts+=this.fish.updatedParts;const thinkers=this.states.length+this.fish.states.length;if(!thinkers)return;this.time+=deltaSeconds;
  const turn=this.thinker;this.thinker=(this.thinker+1)%thinkers;
  for(const s of this.states){if(s.dead)continue;const scared=Math.max(0,Math.min(deltaSeconds,s.fleeUntil-(this.time-deltaSeconds))),motionDelta=deltaSeconds+scared*((s.kind==='bird'?FLEE_BOOST:s.fleeSpeed/s.speed)-1);s.frightened=s.fleeUntil>this.time;if(s.kind==='ground')this.moveGround(s,motionDelta);else this.moveBird(s,motionDelta);this.writePose(s);}
  if(turn>=this.states.length){this.fish.think(turn-this.states.length);this.thinkCount++;this.lastThinkId=this.fish.states[turn-this.states.length].id;return;}
  const s=this.states[turn];if(s.dead)return;this.thinkCount++;s.thinkCount++;this.lastThinkId=s.id;this.threatCheck(s);this.writePose(s);
  if(this.time>=s.readyAt&&(s.phase==='idle'||s.phase==='planning'||s.phase==='perched'||s.phase==='startled')){if(s.kind==='ground')this.thinkGround(s);else this.thinkBird(s);}
 }
 dispose(){
  if(this.world)this.world.onDebrisWaterImpact=null;this.fish.dispose();
  for(const s of this.states){s.route=null;s.rig=null;}this.states.length=0;this.nav=null;this.defences=null;this.world=null;this.perches.length=0;this.treePerches.length=0;this.bounds=null;this.updatedParts=0;this.time=0;this.thinkCount=0;this.lastThinkId=null;this.lastThinkWork=0;this.planningBytes=0;this.threatSources=EMPTY;this.explosions=null;this.explosionCursor=0;this.spookCount=0;this.onVisible=null;
 }
}
