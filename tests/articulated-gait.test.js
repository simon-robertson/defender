import {test,expect} from 'bun:test';
import {newLevel} from '../shared/level.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {PoseRig} from '../engine/rig.js';
import {PathMotion} from '../engine/path-motion.js';
import {DogGait,DOG_WALK} from '../engine/dog-gait.js';
import {DogPreview} from '../game/dog-preview.js';
import {EnemyPreview,previewActorsForLevel} from '../game/enemy-preview.js';
import {WALKER_WALK,SPIDER_WALK} from '../engine/articulated-gait.js';

const sources=new Map(await Promise.all(['dog','walker','spider'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
// Both turn directions, close consecutive corners and a wrap, independent of
// production composition. Odd/even corners exercise both diagonal Spider pairs;
// all path segments remain exactly one box long.
const route=[[1,1],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[2,5],[2,6],[3,6],[4,6],[5,6]];
function fixture(model,count=3,onChange=()=>{},onDeath=null){
 const id={dog:'moss-01',walker:'ochre-01',spider:'plum-01'}[model],level=newLevel(id);level.path=route.map(([x,z])=>[x,0,z]);
 const actors=previewActorsForLevel(id).slice(0,count),world=buildWorld(level,sources,{actors}),preview=new EnemyPreview(world,onChange,onDeath,actors);
 return {world,preview,dispose(){preview.dispose();disposeWorld(world);}};
}
function atDistance(preview,distance){preview.time=(distance-preview.states[0].seed+preview.path.length)/preview.states[0].movement.speed;preview.pose();}
function transform(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}

// Independent oriented-cell SAT, performed in the other part's local space.
// It checks all distinct rigid parts, including both feet and adjacent chains.
function relative(out,a,b){
 for(let col=0;col<3;col++)for(let row=0;row<3;row++)out[col*4+row]=a[row*4]*b[col*4]+a[row*4+1]*b[col*4+1]+a[row*4+2]*b[col*4+2];
 for(let row=0;row<3;row++)out[12+row]=a[row*4]*(b[12]-a[12])+a[row*4+1]*(b[13]-a[13])+a[row*4+2]*(b[14]-a[14]);
}
function overlaps(m,c,f){
 const d=transform(m,[c[0]+.5,c[1]+.5,c[2]+.5]).map((v,i)=>v-f[i]-.5),axes=[[1,0,0],[0,1,0],[0,0,1],[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]];
 for(let i=0;i<3;i++)for(let j=3;j<6;j++){const a=axes[i],b=axes[j];axes.push([a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]);}
 for(const a of axes){
  const length=Math.hypot(...a);if(length<1e-6)continue;
  const separation=Math.abs(d[0]*a[0]+d[1]*a[1]+d[2]*a[2]),extent=(Math.abs(a[0])+Math.abs(a[1])+Math.abs(a[2])+Math.abs(a[0]*m[0]+a[1]*m[1]+a[2]*m[2])+Math.abs(a[0]*m[4]+a[1]*m[5]+a[2]*m[6])+Math.abs(a[0]*m[8]+a[1]*m[9]+a[2]*m[10]))*.5;
  if(separation>=extent-1e-5*length)return false;
 }
 return true;
}
function firstOverlap(bones,hashes,m){
 for(let i=0;i<bones.length;i++)for(let j=i+1;j<bones.length;j++){
  const a=bones[i],b=bones[j];relative(m,a.pose,b.pose);
  for(const c of b.part.voxels){
   const p=transform(m,[c[0]+.5,c[1]+.5,c[2]+.5]);
   // A rotated unit cube has maximum centre-to-vertex extent sqrt(3)/2.
   for(let x=Math.floor(p[0]-.867);x<=Math.floor(p[0]+.867);x++)for(let y=Math.floor(p[1]-.867);y<=Math.floor(p[1]+.867);y++)for(let z=Math.floor(p[2]-.867);z<=Math.floor(p[2]+.867);z++){
    const other=hashes[i].get(`${x},${y},${z}`);if(other&&overlaps(m,c,other))return {a:a.part.id,b:b.part.id,cell:c.slice(0,3),other:other.slice(0,3)};
   }
  }
 }
 return null;
}

for(const model of ['walker','spider'])test(`folded gaits keep flat planted contacts and all vertices above/inside the route through both turn directions (${model})`,()=>{
  const f=fixture(model,1),s=f.preview.states[0],meshes=new Map(f.world.entries.map(e=>[e.key,e.mesh.vertices])),previous=s.gait.feet.map(()=>({contact:NaN,stance:false,matrix:new Float32Array(16)}));
  let minY=Infinity,maxR=0,maxError=0,contactError=0,bendContacts=0;
  try{
   for(let sample=0;sample<=f.preview.path.length*40;sample++){
    const distance=sample/40;atDistance(f.preview,Math.min(distance,f.preview.path.length-1e-8));
    for(let i=0;i<s.gait.feet.length;i++){
     const foot=s.gait.feet[i],bone=s.rig.byId.get(foot.paw),m=bone.instance.matrix,last=previous[i],position=transform(m,bone.part.pivot);
     for(let k=0;k<3;k++)maxError=Math.max(maxError,Math.abs(position[k]-foot.position[k]));
     maxError=Math.max(maxError,Math.abs(m[1]),Math.abs(m[4]),Math.abs(m[6]),Math.abs(m[9]),Math.abs(m[5]-1));
     if(last.stance&&foot.stance&&last.contact===foot.contact){for(let k=0;k<16;k++)contactError=Math.max(contactError,Math.abs(m[k]-last.matrix[k]));if(Math.abs(Math.sin(s.yaw*2))>.1)bendContacts++;}
     last.contact=foot.contact;last.stance=foot.stance;last.matrix.set(m);
    }
    for(const bone of s.rig.bones){const m=bone.instance.matrix,v=meshes.get(bone.instance.key);for(let j=0;j<v.length;j+=11){const x=m[0]*v[j]+m[4]*v[j+1]+m[8]*v[j+2]+m[12],y=m[1]*v[j]+m[5]*v[j+1]+m[9]*v[j+2]+m[13],z=m[2]*v[j]+m[6]*v[j+1]+m[10]*v[j+2]+m[14];minY=Math.min(minY,y);maxR=Math.max(maxR,Math.hypot(x-s.x,z-s.z));}}
   }
   expect({model,minY}).toEqual({model,minY:expect.any(Number)});expect(minY).toBeGreaterThan(24-1e-4);expect(maxR).toBeLessThan(12);expect(maxError).toBeLessThan(1e-4);expect(contactError).toBeLessThan(1e-4);expect(bendContacts).toBeGreaterThan(100);
  }finally{f.dispose();}
},30000);

for(const model of ['walker','spider'])test(`full articulated strides and turn poses keep every pair of rigid voxel parts separate (${model})`,()=>{
  const f=fixture(model,1),s=f.preview.states[0],bones=s.rig.bones,hashes=bones.map(b=>new Map(b.part.voxels.map(c=>[c.slice(0,3).join(','),c]))),relativeMatrix=new Float64Array(16);let collision=null;
  try{
   for(let sample=0;sample<f.preview.path.length*10;sample++){const distance=sample/10;atDistance(f.preview,distance);collision=firstOverlap(bones,hashes,relativeMatrix);if(collision){collision={model,distance,...collision};break;}}
   expect(collision).toBeNull();
  }finally{f.dispose();}
},60000);

for(const model of ['walker','spider'])test(`gait roots and part transforms are independent of frame rate, skipped strides and multiple wraps (${model})`,()=>{
  const reference=fixture(model),duration=reference.preview.loopSeconds*2+.137;reference.preview.advance(duration);
  try{
   for(const step of [1/30,1/60,1/144,.073]){
    const f=fixture(model);try{let time=0;while(time<duration){const dt=Math.min(step,duration-time);f.preview.advance(dt);time+=dt;}
     for(let i=0;i<3;i++){const a=f.preview.states[i],b=reference.preview.states[i];expect(a.distance).toBeCloseTo(b.distance,7);expect(a.x).toBeCloseTo(b.x,7);expect(a.z).toBeCloseTo(b.z,7);expect(a.yaw).toBeCloseTo(b.yaw,7);for(let j=0;j<a.rig.bones.length;j++)for(let k=0;k<16;k++)expect(a.rig.bones[j].instance.matrix[k]).toBeCloseTo(b.rig.bones[j].instance.matrix[k],4);}
    }finally{f.dispose();}
   }
  }finally{reference.dispose();}
});

for(const [model,count]of [['walker',7],['spider',13]])test(`fixed controller slots share meshes, preserve working storage and stop dead actors without resurrection (${model})`,()=>{
  let changes=0;const deaths=[],f=fixture(model,3,()=>changes++,(id)=>deaths.push(id)),p=f.preview,source=JSON.stringify(sources.get(model));
  const matrices=p.states.flatMap(s=>s.rig.bones.map(b=>b.instance.matrix)),arrays=p.states.flatMap(s=>[s.sample,s.gait.sample,s.gait.upperRotation,s.gait.lowerRotation,s.gait.scratch,...s.gait.feet.flatMap(f=>[f.position,f.from,f.to])]);
  const groups=f.world.entries.filter(e=>e.key.startsWith(model+':'));expect(groups).toHaveLength(count);for(const g of groups)expect(g.transforms).toHaveLength(3);
  try{
   changes=0;p.advance(.1);expect(changes).toBe(count*3);
   expect(p.takeHit(p.states[0],300)).toBe(300);expect(p.alive).toBe(2);expect(deaths).toEqual([p.states[0].id]);expect(p.takeHit(p.states[0],10)).toBe(0);const dead=p.states[0].rig.bones.map(b=>b.instance.matrix.slice());
   for(let frame=0;frame<500;frame++)p.advance(.037);
   p.advance(p.loopSeconds*10+.1);expect(p.states[0].health.current).toBe(0);expect(p.states[0].velocityX).toBe(0);expect(p.states[0].velocityZ).toBe(0);
   for(let i=0;i<dead.length;i++)expect(p.states[0].rig.bones[i].instance.matrix).toEqual(dead[i]);
   const currentMatrices=p.states.flatMap(s=>s.rig.bones.map(b=>b.instance.matrix)),currentArrays=p.states.flatMap(s=>[s.sample,s.gait.sample,s.gait.upperRotation,s.gait.lowerRotation,s.gait.scratch,...s.gait.feet.flatMap(f=>[f.position,f.from,f.to])]);
   for(let i=0;i<matrices.length;i++)expect(currentMatrices[i]).toBe(matrices[i]);for(let i=0;i<arrays.length;i++)expect(currentArrays[i]).toBe(arrays[i]);expect(JSON.stringify(sources.get(model))).toBe(source);
   for(const dt of [-1,NaN,Infinity])expect(()=>p.advance(dt)).toThrow();p.advance(0);expect(p.updatedParts).toBe(0);
   const gaits=p.states.map(s=>s.gait);f.dispose();expect(p.states).toHaveLength(0);expect(p.path).toBeNull();expect(p.onDeath).toBeNull();expect(f.world.actors.size).toBe(0);for(const gait of gaits){expect(gait.path).toBeNull();expect(gait.rig).toBeNull();expect(gait.feet).toHaveLength(0);}
  }finally{if(p.states.length)f.dispose();}
 expect(WALKER_WALK.speed).toBe(18);expect(WALKER_WALK.speed*WALKER_WALK.cycleSeconds).toBe(6);expect(SPIDER_WALK.speed).toBe(12);expect(SPIDER_WALK.speed*SPIDER_WALK.cycleSeconds).toBeCloseTo(2.88,12);expect(SPIDER_WALK.cycleSeconds).toBe(.24);expect(SPIDER_WALK.lift).toBe(.2);expect(SPIDER_WALK.turnInset).toBe(.5);
 expect(previewActorsForLevel('ice-01')).toHaveLength(4);expect(previewActorsForLevel('unknown')).toHaveLength(0);expect(Object.isFrozen(previewActorsForLevel('ochre-01'))).toBe(true);
});

test('four-legged spider alternates diagonal pairs with planted support throughout every stride',()=>{
 const f=fixture('spider',1),gait=f.preview.states[0].gait;let minimum=4,maximum=0;
 try{
  expect(gait.feet.map(foot=>foot.name)).toEqual(['foot-fl','foot-fr','foot-rl','foot-rr']);
  const stride=SPIDER_WALK.speed*SPIDER_WALK.cycleSeconds;
  for(let i=0;i<240;i++){
   atDistance(f.preview,40+i*stride/120);
   const [fl,fr,rl,rr]=gait.feet;
   expect(fl.stance).toBe(rr.stance);expect(fr.stance).toBe(rl.stance);
   const planted=gait.feet.filter(foot=>foot.stance).length;minimum=Math.min(minimum,planted);maximum=Math.max(maximum,planted);
  }
  expect(minimum).toBe(2);expect(maximum).toBe(4);
 }finally{f.dispose();}
});

test('generic dog controller and compatibility wrapper preserve the original dog matrices exactly',()=>{
 const f=fixture('dog'),legacy=fixture('dog'),wrapper=new DogPreview(legacy.world,()=>{}),path=new PathMotion(f.world.level.path,DOG_WALK.turnDistance);
 const original=f.preview.states.map(s=>{const rig=new PoseRig(f.world.actors.get(s.id),()=>{});return {seed:s.seed,rig,gait:new DogGait(rig,path,24),sample:new Float64Array(5)};});
 let time=0;
 try{
  for(const dt of [0,1/60,.137,.37,2.1,13.7,70.003]){
   time=(time+dt)%(path.length/DOG_WALK.speed);f.preview.advance(dt);wrapper.advance(dt);
   const actual=f.preview.states.map(s=>s.rig.bones.map(b=>b.instance.matrix.slice()));
   for(let i=0;i<original.length;i++){
    const s=original[i],distance=(s.seed+time*DOG_WALK.speed)%path.length;path.sample(distance,s.sample);const x=s.sample[0],z=s.sample[1],yaw=s.sample[2],c=Math.cos(yaw),sin=Math.sin(yaw),root=s.rig.root;
    root[0]=c;root[2]=-sin;root[8]=sin;root[10]=c;root[12]=x-12*c-12*sin;root[13]=24-DOG_WALK.crouch;root[14]=z+12*sin-12*c;s.rig.invalidateRoot();s.gait.pose(distance,x,z,yaw);s.rig.update();
    expect(f.preview.states[i].distance).toBe(distance);expect(f.preview.states[i].aimY).toBe(34.5);for(let j=0;j<s.rig.bones.length;j++){expect(actual[i][j]).toEqual(s.rig.bones[j].instance.matrix);expect(wrapper.states[i].rig.bones[j].instance.matrix).toEqual(actual[i][j]);}
   }
  }
 }finally{for(const s of original)s.gait.dispose();wrapper.dispose();legacy.dispose();f.dispose();}
});
