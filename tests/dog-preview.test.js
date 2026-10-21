import {test,expect} from 'bun:test';
import {firstLevel,sceneryModels} from '../scripts/first-level.js';
import {dogModel} from '../scripts/dog.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PathMotion,shortestAngle} from '../engine/path-motion.js';
import {DogPreview,DOG_PREVIEW_ACTORS} from '../game/dog-preview.js';
import {DOG_WALK} from '../engine/dog-gait.js';

const library=new Map(sceneryModels().map(model=>[model.id,model]));
library.set('dog',dogModel());library.set('turret-study',await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json());
library.set('power-generator',await Bun.file(new URL('../assets/models/power-generator.json',import.meta.url)).json());
function fixture(){const world=buildWorld(firstLevel(),library,{actors:DOG_PREVIEW_ACTORS}),preview=new DogPreview(world,()=>{});return {world,preview};}

test('dog target velocity follows the route and stays bounded across entrance resets',()=>{
 const {world,preview}=fixture(),dog=preview.states[0],sample=dog.sample,path=world.level.path,speed=DOG_WALK.speed;
 const velocity=distance=>{const index=Math.min(Math.floor(distance/24),path.length-2),a=path[index],b=path[index+1];return [(b[0]-a[0])*speed,(b[2]-a[2])*speed];};
 try{
  expect([dog.velocityX,dog.velocityZ]).toEqual(velocity(dog.distance));
  const bend=path.findIndex((point,i)=>i*24>dog.distance&&i>0&&i<path.length-1&&(point[0]-path[i-1][0]!==path[i+1][0]-point[0]||point[2]-path[i-1][2]!==path[i+1][2]-point[2]));expect(bend).toBeGreaterThan(0);
  const afterBend=bend*24+1;preview.advance((afterBend-dog.distance)/speed);expect(dog.distance).toBeCloseTo(afterBend,8);expect([dog.velocityX,dog.velocityZ]).toEqual(velocity(afterBend));
  preview.advance((preview.path.length-.01-dog.distance)/speed);expect(dog.distance).toBeCloseTo(preview.path.length-.01,8);
  preview.advance(.02/speed);expect(dog.distance).toBeCloseTo(.01,8);expect([dog.velocityX,dog.velocityZ]).toEqual(velocity(0));expect(dog.sample).toBe(sample);
  for(const state of preview.states)expect(Math.hypot(state.velocityX,state.velocityZ)).toBe(speed);
 }finally{preview.dispose();disposeWorld(world);}
});

test('three runtime dogs share part meshes without becoming saved scenery or bypassing path clearance',()=>{
 const level=firstLevel(),before=JSON.stringify(level),world=buildWorld(level,library,{actors:DOG_PREVIEW_ACTORS});
 expect(world.actors.size).toBe(3);expect(world.rigs.size).toBe(level.placements.length);expect(JSON.stringify(level)).toBe(before);
 const groups=world.entries.filter(entry=>entry.key.startsWith('dog:'));expect(groups.length).toBe(13);for(const group of groups)expect(group.transforms.length).toBe(3);
 expect(world.assetIds.filter(id=>id==='dog')).toEqual(['dog']);
 for(const actors of [[{...DOG_PREVIEW_ACTORS[0],model:'missing'}],[DOG_PREVIEW_ACTORS[0],DOG_PREVIEW_ACTORS[0]],[{...DOG_PREVIEW_ACTORS[0],id:level.placements[0].id}],[{...DOG_PREVIEW_ACTORS[0],variant:'missing'}]])expect(()=>buildWorld(level,library,{actors})).toThrow();
 const blocked=structuredClone(level);blocked.placements[0].box=level.path[0].slice();expect(()=>buildWorld(blocked,library,{actors:DOG_PREVIEW_ACTORS})).toThrow('blocks the enemy route');
 const other=structuredClone(level);other.id='other-level';expect(new DogPreview(buildWorld(other,library),()=>{}).states.length).toBe(0);
});

test('path motion keeps exact box-centre segments while facing turns continuously',()=>{
 const level=firstLevel(),path=new PathMotion(level.path),sample=new Float64Array(3),previous=new Float64Array(3);
 expect(path.length).toBe((level.path.length-1)*24);path.sample(0,previous);
 for(let d=.2;d<=path.length;d+=.2){
  path.sample(d,sample);const segment=Math.min(Math.floor(d/24),level.path.length-2),a=level.path[segment],b=level.path[segment+1],t=(d-segment*24)/24;
  expect(sample[0]).toBeCloseTo((a[0]+.5+(b[0]-a[0])*t)*24,8);expect(sample[1]).toBeCloseTo((a[2]+.5+(b[2]-a[2])*t)*24,8);
  expect(Math.abs(shortestAngle(sample[2]-previous[2]))).toBeLessThan(.04);previous.set(sample);
 }
 expect(()=>new PathMotion([[0,0,0],[1,0,1]])).toThrow();
});

test('uniform path indexing keeps boundary position and travel direction, including clamped endpoints',()=>{
 const path=new PathMotion([[0,0,0],[1,0,0],[1,0,1],[0,0,1]],0),sample=new Float64Array(5);
 for(const [distance,expected]of [[-10,[12,12,1,0]],[0,[12,12,1,0]],[24,[36,12,0,1]],[48,[36,36,-1,0]],[72,[12,36,-1,0]],[100,[12,36,-1,0]]]){
  path.sample(distance,sample);expect([sample[0],sample[1],sample[3],sample[4]]).toEqual(expected);
 }
});

test('cached gait contacts preserve poses while avoiding repeated path sampling within a stride',()=>{
 const {world,preview}=fixture(),path=preview.path,sample=path.sample;let calls=0;
 path.sample=function(distance,out){calls++;return sample.call(this,distance,out);};
 const anchors=preview.states.flatMap(state=>state.gait.feet.flatMap(foot=>[foot.from,foot.to]));
 try{
  for(let frame=0;frame<600;frame++)preview.advance(1/60);
  // 1,800 root samples plus fewer than 650 changed foot contacts over 10s.
  // Before caching, each moving frame sampled every foot (also its next contact
  // in swing), so even the stance-only lower bound was 9,000 total samples.
  expect(calls).toBeLessThan(2450);
  const matrices=preview.states.flatMap(state=>state.rig.bones.map(bone=>bone.instance.matrix.slice()));
  for(const state of preview.states)for(const foot of state.gait.feet){foot.contact=NaN;foot.nextContact=NaN;}
  preview.pose();
  const actual=preview.states.flatMap(state=>state.rig.bones.map(bone=>bone.instance.matrix));
  for(let i=0;i<actual.length;i++)expect(actual[i]).toEqual(matrices[i]);
  const current=preview.states.flatMap(state=>state.gait.feet.flatMap(foot=>[foot.from,foot.to]));
  for(let i=0;i<current.length;i++)expect(current[i]).toBe(anchors[i]);
 }finally{preview.dispose();disposeWorld(world);}
});

test('walking keeps paw contacts planted through bends and all animated geometry above and inside the route',()=>{
 const {world,preview}=fixture(),meshes=new Map(world.entries.map(entry=>[entry.key,entry.mesh.vertices]));
 const previous=preview.states.map(state=>state.gait.feet.map(foot=>({stance:false,phase:0,matrix:new Float32Array(16)})));
 const previousDistance=preview.states.map(state=>state.distance);
 let minimumY=Infinity,maximumRadius=0,maximumReach=0,maximumPawError=0,maximumContactMotion=0,contactsOnBends=0;
 const buffers=world.entries.map(entry=>entry.mesh.vertices),matrices=preview.states.flatMap(state=>state.rig.bones.map(bone=>bone.instance.matrix));
 for(let frame=0;frame<Math.ceil(preview.path.length/DOG_WALK.speed*60);frame++){
  preview.advance(1/60);
  for(let actor=0;actor<preview.states.length;actor++){
   const state=preview.states[actor];
   for(let leg=0;leg<state.gait.feet.length;leg++){
    const foot=state.gait.feet[leg],bone=state.rig.byId.get(foot.paw),m=bone.instance.matrix,pivot=bone.part.pivot,last=previous[actor][leg];
    maximumReach=Math.max(maximumReach,foot.reach);
    for(let axis=0;axis<3;axis++)maximumPawError=Math.max(maximumPawError,Math.abs(m[axis]*pivot[0]+m[4+axis]*pivot[1]+m[8+axis]*pivot[2]+m[12+axis]-foot.position[axis]));
    if(state.distance>=previousDistance[actor]&&last.stance&&foot.stance&&foot.phase>last.phase){
     for(let i=0;i<16;i++)maximumContactMotion=Math.max(maximumContactMotion,Math.abs(m[i]-last.matrix[i]));
     if(Math.abs(Math.sin(state.yaw*2))>.1)contactsOnBends++;
    }
    last.stance=foot.stance;last.phase=foot.phase;last.matrix.set(m);
   }
   previousDistance[actor]=state.distance;
   for(const bone of state.rig.bones){
    const m=bone.instance.matrix,vertices=meshes.get(bone.instance.key);
    for(let i=0;i<vertices.length;i+=11){
     const x=m[0]*vertices[i]+m[4]*vertices[i+1]+m[8]*vertices[i+2]+m[12],y=m[1]*vertices[i]+m[5]*vertices[i+1]+m[9]*vertices[i+2]+m[13],z=m[2]*vertices[i]+m[6]*vertices[i+1]+m[10]*vertices[i+2]+m[14];
     minimumY=Math.min(minimumY,y);maximumRadius=Math.max(maximumRadius,Math.hypot(x-state.x,z-state.z));
    }
   }
  }
 }
 expect(minimumY).toBeGreaterThan(24-1e-4);expect(maximumRadius).toBeLessThan(12);expect(maximumReach).toBeLessThan(8);expect(maximumPawError).toBeLessThan(1e-4);expect(maximumContactMotion).toBeLessThan(1e-4);expect(contactsOnBends).toBeGreaterThan(100);
 for(let i=0;i<buffers.length;i++)expect(world.entries[i].mesh.vertices).toBe(buffers[i]);
 const current=preview.states.flatMap(state=>state.rig.bones.map(bone=>bone.instance.matrix));for(let i=0;i<matrices.length;i++)expect(current[i]).toBe(matrices[i]);
});

test('root and gait agree across frame rates, uneven frames and multiple preview loops',()=>{
 const reference=fixture(),time=reference.preview.path.length/DOG_WALK.speed*2+.137;reference.preview.advance(time);
 for(const step of [1/30,1/60,1/144,.073]){
  const {preview}=fixture();let elapsed=0;while(elapsed<time){const dt=Math.min(step,time-elapsed);preview.advance(dt);elapsed+=dt;}
  for(let i=0;i<3;i++){
   const actual=preview.states[i],expected=reference.preview.states[i];expect(actual.distance).toBeCloseTo(expected.distance,7);expect(shortestAngle(actual.yaw-expected.yaw)).toBeCloseTo(0,7);
   for(let bone=0;bone<actual.rig.bones.length;bone++)for(let j=0;j<16;j++)expect(actual.rig.bones[bone].instance.matrix[j]).toBeCloseTo(expected.rig.bones[bone].instance.matrix[j],4);
  }
 }
 for(const delta of [-1,NaN,Infinity])expect(()=>reference.preview.advance(delta)).toThrow();
});

test('dog preview teardown releases actor and path references without adding or retaining slots',()=>{
 const {world,preview}=fixture(),gaits=preview.states.map(state=>state.gait),count=world.entries.length;preview.advance(10000);expect(preview.states.length).toBe(3);expect(world.entries.length).toBe(count);
 preview.dispose();disposeWorld(world);expect(preview.states.length).toBe(0);expect(preview.path).toBeNull();expect(world.actors.size).toBe(0);expect(world.rigs.size).toBe(0);expect(world.entries.length).toBe(0);expect(world.assetIds.length).toBe(0);
 for(const gait of gaits){expect(gait.feet.length).toBe(0);expect(gait.path).toBeNull();expect(gait.rig).toBeNull();}
});

// Independent oriented-box SAT oracle for posed limb cells against the static
// chassis. Allocations here belong only to test code, never the runtime gait.
function overlapsBodyCell(matrix,cell,x,y,z){
 const centre=[x+.5,y+.5,z+.5],delta=[0,1,2].map(i=>matrix[i]*(cell[0]+.5)+matrix[4+i]*(cell[1]+.5)+matrix[8+i]*(cell[2]+.5)+matrix[12+i]-centre[i]);
 const basis=[[1,0,0],[0,1,0],[0,0,1]],rotated=[0,4,8].map(i=>Array.from(matrix.slice(i,i+3))),axes=[...basis,...rotated];
 for(const a of basis)for(const b of rotated)axes.push([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);
 for(const axis of axes){
  const length=Math.hypot(...axis);if(length<1e-6)continue;
  const separation=Math.abs(delta.reduce((sum,c,i)=>sum+c*axis[i],0));
  const extent=(axis.reduce((sum,c)=>sum+Math.abs(c),0)+rotated.reduce((sum,b)=>sum+Math.abs(b.reduce((dot,c,i)=>dot+c*axis[i],0)),0))*.5;
  if(separation>=extent-1e-5*length)return false;
 }
 return true;
}
test('turn abduction and folded steps keep moving limb cells clear of the dog chassis',()=>{
 const {preview}=fixture(),body=new Set(library.get('dog').variants.base.parts.find(part=>part.id==='body').voxels.map(cell=>cell.slice(0,3).join(',')));
 let collision=null;
 outer:for(let frame=0;frame<Math.ceil(preview.path.length/DOG_WALK.speed*60);frame++){
  preview.advance(1/60);const state=preview.states[0];
  for(const bone of state.rig.bones){
   if(bone.part.id==='body')continue;const m=bone.pose;
   for(const cell of bone.part.voxels){
    const centre=[0,1,2].map(i=>m[i]*(cell[0]+.5)+m[4+i]*(cell[1]+.5)+m[8+i]*(cell[2]+.5)+m[12+i]);
    for(let y=Math.floor(centre[1]-1);y<=Math.floor(centre[1]+1);y++)for(let x=Math.floor(centre[0]-1);x<=Math.floor(centre[0]+1);x++)for(let z=Math.floor(centre[2]-1);z<=Math.floor(centre[2]+1);z++){
     if(body.has(x+','+y+','+z)&&overlapsBodyCell(m,cell,x,y,z)){collision={distance:state.distance,part:bone.part.id,cell:cell.slice(0,3),body:[x,y,z]};break outer;}
    }
   }
  }
 }
 expect(collision).toBeNull();
});
