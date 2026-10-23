import {test,expect} from 'bun:test';
import {createPlacementRules,gunMovementShapes,connectedWildlifePoints,DOG_ROUTE_RADIUS} from '../play/placement.js';
import {newLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {identity} from '../shared/math.js';
import {PoseRig} from '../engine/rig.js';
import {DogGait,DOG_WALK} from '../engine/dog-gait.js';
import {PathMotion} from '../engine/path-motion.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {composePlayLevel} from '../play/engine.js';
import {TURRET_PITCH,TURRET_RECOIL} from '../shared/arsenal.js';

const baseModels=new Map(await Promise.all(['dog','turret-study'].map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
async function sourceFixture(id){
 const source=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).json(),level=composePlayLevel(source),actors=wildlifeActorsForLevel(level),models=new Map(baseModels);
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(a=>a.model)]))if(!models.has(id))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 return {source,models};
}
const placement=(id,box,variant='base')=>({id,model:'turret-study',variant,box,turn:0});
function flat(){const source=newLevel('play-placement-fixture');source.size=[12,8];source.path=Array.from({length:12},(_,x)=>[x,0,3]);return source;}
function rig(parts){return new PoseRig({root:identity(),parts,instances:parts.map(p=>({part:p.id,key:p.id,index:0,matrix:identity()}))},()=>{});}
function vertices(part){const unique=new Map();for(const c of part.voxels)for(const x of [c[0],c[0]+1])for(const y of [c[1],c[1]+1])for(const z of [c[2],c[2]+1])unique.set(`${x},${y},${z}`,[x,y,z]);return [...unique.values()];}

test('all clear grid cells are considered while accepted source assets and A1 preview drones stay independent',async()=>{
 for(const id of ['moss-01','moss-02']){
  const {source,models}=await sourceFixture(id),before=JSON.stringify(source),rules=createPlacementRules(source,models),field=new TerrainField(source);
  try{
   expect(models.has('drone-defence')).toBe(false);
   for(const variant of ['base','upgrade1','upgrade2']){
    const cells=rules.eligibleCells(variant);expect(cells).toHaveLength(320);const valid=cells.filter(c=>c.valid);expect(valid.length).toBeGreaterThanOrEqual(25);
    for(const c of valid){expect(field.flatBox(c.box[0],c.box[2])).toBe(source.pathHeight);expect(field.protected(c.box[0],c.box[2])).toBe(false);expect(rules.check(c.box,variant).valid).toBe(true);}
   }
   expect(rules.check(source.path[0],'base').code).toBe('route');
   if(id==='moss-01'){expect(rules.check([17,0,11],'base').valid).toBe(true);expect(rules.check([17,0,11],'upgrade1').valid).toBe(false);}
   else expect(rules.check([11,0,8],'base').code).toBe('bridge');
  }finally{rules.dispose();}
  expect(JSON.stringify(source)).toBe(before);expect(rules.check([2,0,2],'base').code).toBe('disposed');
 }
});

test('placement rejects unsupported ground/units and independently legal guns need simultaneous movement clearance',()=>{
 const source=flat(),rules=createPlacementRules(source,baseModels),first=placement('one',[4,0,4]);
 try{
  expect(rules.check(first.box,'base').valid).toBe(true);expect(rules.check([5,0,4],'base').valid).toBe(true);
  expect(rules.check([5,0,4],'base',[first]).code).toBe('unit-clearance');
  expect(rules.check([6,0,4],'base',[first]).valid).toBe(true);
  expect(rules.check(first.box,'base',[first]).code).toBe('occupied');expect(rules.check(first.box,'base',[first],'one').valid).toBe(true);
  expect(rules.prepare([first,placement('two',[5,0,4])]).valid).toBe(false);expect(rules.prepare([first,placement('two',[6,0,4])]).valid).toBe(true);
  for(const box of [[-1,0,2],[1,1,2],[12,0,2],[2.5,0,2],null])expect(rules.check(box,'base').valid).toBe(false);
  expect(rules.check([4,0,4],'upgrade2').valid).toBe(true);expect(rules.check([4,0,4],'upgrade3').code).toBe('variant');
  expect(rules.prepare([{...first,model:'arc-spire'}]).valid).toBe(false);expect(rules.prepare([first,{...first,box:[6,0,4]}]).valid).toBe(false);
  expect(rules.prepare([null]).valid).toBe(false);expect(rules.check([4,0,4],'base',[null]).valid).toBe(false);
  expect(rules.check([4,0,4],'base',[placement('bad',[100,0,4])]).valid).toBe(false);
 }finally{rules.dispose();}
 for(const column of [{box:[4,4],ground:17,water:20},{box:[4,4],ground:28,water:0}]){const l=flat();l.terrain.boxes=[column];const r=createPlacementRules(l,baseModels);expect(r.check([4,0,4],'base').code).toBe('ground');r.dispose();}
});

test('continuous gun envelopes contain real hierarchical yaw/pitch/recoil transforms including interval interiors',()=>{
 const model=baseModels.get('turret-study');let checked=0;
 for(const variant of ['base','upgrade1','upgrade2']){
  const parts=model.variants[variant].parts,r=rig(parts),points=new Map(parts.map(p=>[p.id,vertices(p)])),shapes=gunMovementShapes(model,variant);
  for(let yaw=0;yaw<360;yaw+=30)for(const degrees of [-35,-29.5,-15,0,8.5,24.5,35])for(const recoil of [0,TURRET_RECOIL.distance]){
   r.setRotation('head',0,yaw*Math.PI/180,0);r.setRotation('guns',degrees*Math.PI/180,0,0);r.setTranslation('guns',0,0,recoil);r.invalidateRoot();r.update();
   for(const bone of r.bones)for(const [x,y,z]of points.get(bone.part.id)){
    const m=bone.instance.matrix,p=[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
    const contained=shapes.some(s=>s.part===bone.part.id&&p[1]>=s.bounds[1]-1e-4&&p[1]<=s.bounds[4]+1e-4&&(s.round?Math.hypot(p[0]-12,p[2]-12)<=s.radius+1e-4:p[0]>=s.bounds[0]-1e-4&&p[0]<=s.bounds[3]+1e-4&&p[2]>=s.bounds[2]-1e-4&&p[2]<=s.bounds[5]+1e-4));
    if(!contained)throw new Error(`${variant}/${bone.part.id} escaped envelope at yaw${yaw}/pitch${degrees}/recoil${recoil}`);checked++;
   }
  }
 }
 expect(checked).toBeGreaterThan(100000);expect(TURRET_PITCH.min).toBe(-35*Math.PI/180);
});

test('current Dog gait stays inside the continuous route capsule throughout both playable journeys and tuning range',async()=>{
 const parts=baseModels.get('dog').variants.base.parts,points=new Map(parts.map(p=>[p.id,vertices(p)]));let checked=0;
 for(const id of ['moss-01','moss-02']){
  const source=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).json();
  for(const speed of [6,12,15]){
   const r=rig(parts),path=new PathMotion(source.path,DOG_WALK.turnDistance),gait=new DogGait(r,path,source.pathHeight,{...DOG_WALK,speed}),sample=new Float64Array(3);
   for(let d=0;d<=path.length;d+=.5){
    path.sample(d,sample);const c=Math.cos(sample[2]),s=Math.sin(sample[2]),root=r.root;root[0]=c;root[2]=-s;root[8]=s;root[10]=c;root[12]=sample[0]-12*c-12*s;root[13]=source.pathHeight-1;root[14]=sample[1]+12*s-12*c;r.invalidateRoot();gait.pose(d,...sample);r.update();
    for(const bone of r.bones)for(const [x,y,z]of points.get(bone.part.id)){const m=bone.instance.matrix,wx=m[0]*x+m[4]*y+m[8]*z+m[12],wy=m[1]*x+m[5]*y+m[9]*z+m[13],wz=m[2]*x+m[6]*y+m[10]*z+m[14];if(Math.hypot(wx-sample[0],wz-sample[1])>DOG_ROUTE_RADIUS+1e-4||wy>source.pathHeight+14+1e-4||wy<source.pathHeight-1e-4)throw new Error(`${id} Dog outside upright route contract at${d}/speed${speed}`);checked++;}
   }
   gait.dispose();
  }
 }
 expect(checked).toBeGreaterThan(1000000);
});

test('wildlife seed selection rejects scenery cages and separates three seeds in genuinely connected roaming ground',()=>{
 const cols=40,members=[0];for(let z=5;z<=15;z++)for(let x=10;x<=30;x++)members.push(z*cols+x);
 const heights=new Float32Array(800).fill(-1);for(const n of members)heights[n]=24;
 const nav={cols,starts:new Uint32Array([0,1,members.length]),members:new Uint32Array(members),heights},points=connectedWildlifePoints(nav,[[2,24,2],[6,24,2],[10,24,2]],5);
 expect(points).toHaveLength(3);expect(points.every(p=>p[0]>=42&&p[2]>=22)).toBe(true);
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)expect(Math.hypot(points[i][0]-points[j][0],points[i][2]-points[j][2])).toBeGreaterThanOrEqual(12);
 expect(connectedWildlifePoints({...nav,starts:new Uint32Array([0,1]),members:new Uint32Array([0])},[[2,24,2]],5)).toBeNull();
});

test('committed player placements reseed blocked wildlife and actual controllers complete connected journeys',async()=>{
 for(const id of ['moss-01','moss-02']){
  const {source,models}=await sourceFixture(id),rules=createPlacementRules(source,models),valid=rules.eligibleCells('base').filter(c=>c.valid),first=valid.find(c=>c.box[0]>1&&c.box[0]<18&&c.box[2]>1&&c.box[2]<14),placements=[placement('one',first.box)];
  const other=valid.find(c=>rules.check(c.box,'base',placements).valid);if(other)placements.push(placement('two',other.box));
  rules.dispose();source.previewWildlife.habitats[0]=[first.box[0],first.box[2]];source.previewWildlife.habitatPoints[0]=[(first.box[0]+.5)*24,24,(first.box[2]+.5)*24];
  const before=JSON.stringify(source),committedRules=createPlacementRules(source,models),prepared=committedRules.prepare(placements);expect(prepared.valid).toBe(true);expect(prepared.wildlifePoints).toHaveLength(wildlifeActorsForLevel(composePlayLevel(source)).filter(actor=>actor.kind==='ground').length);expect(prepared.wildlifePoints[0]).not.toEqual(source.previewWildlife.habitatPoints[0]);
  const again=committedRules.prepare(placements);again.wildlifePoints[0][0]=-100;expect(committedRules.prepare(placements).wildlifePoints[0][0]).toBeGreaterThan(0);
  const level=composePlayLevel(source,placements,{wildlifePoints:prepared.wildlifePoints,models}),actors=wildlifeActorsForLevel(level),world=buildWorld(level,models,{actors}),life=new WildlifePreview(world,()=>{});
  try{
   const nav=life.nav;for(const s of life.states.filter(s=>s.kind==='ground'))expect(nav.starts[s.groundComponent+1]-nav.starts[s.groundComponent]).toBeGreaterThanOrEqual(64);
   for(let frame=0;frame<60*30;frame++)life.advance(1/30);
   for(const s of life.states)expect(s.journeysCompleted).toBeGreaterThan(0);
  }finally{life.dispose();disposeWorld(world);committedRules.dispose();}
  expect(JSON.stringify(source)).toBe(before);
 }
});
