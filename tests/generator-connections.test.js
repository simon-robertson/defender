// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {createGeneratorConnections} from '../game/generator-connections.js';
import {EnhancerPreview} from '../game/enhancer-preview.js';
import {placementMatrix} from '../shared/math.js';
import {newLevel} from '../shared/level.js';

const ids=['power-generator','turret-study','arc-spire','missile-launcher'];
const sources=new Map(await Promise.all(ids.map(async id=>[id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json()])));
const variants=['base','upgrade1','upgrade2'],directions=[[0,-1],[1,0],[0,1],[-1,0]];
const key=(x,y,z)=>`${x},${y},${z}`,occupancy=new Map();
for(const model of sources.values())for(const variant of variants)for(const part of model.variants[variant].parts)occupancy.set(part,new Set(part.voxels.map(c=>key(c[0],c[1],c[2]))));
function placement(id,model,x,z,variant='base',turn=0){return {id,model,variant,box:[x,0,z],turn};}
function fixture(placements){
 const level=newLevel('generator-links');level.size=[7,7];level.placements=placements;
 const rigs=new Map(placements.map(p=>{
  const model=sources.get(p.model),root=placementMatrix(p.box,p.turn);root[13]=24;
  return [p.id,{model:p.model,variant:p.variant,role:model.role,root,parts:model.variants[p.variant].parts,
   instances:model.variants[p.variant].parts.map(part=>({part:part.id,matrix:new Float32Array(root)}))}];
 }));
 return {level,rigs};
}
function active(id,recipientIds){return {id,model:'power-generator',variant:'base',active:true,recipientIds};}
function local(rig,p){
 const r=rig.root,x=p[0]-r[12],y=p[1]-r[13],z=p[2]-r[14];
 return [r[0]*x+r[2]*z,y,r[8]*x+r[10]*z];
}
function solid(rig,part,p){const q=local(rig,p);return occupancy.get(part).has(key(...q.map(Math.floor)));}
function solidAny(rig,p){return rig.parts.some(part=>solid(rig,part,p));}
function checkFace(rig,part,point,nx,nz){
 // Independent solid oracle: a tiny inward step enters the actual authored
 // cell, while every outward half-cell sample stays outside that entire part.
 expect(solid(rig,part,[point[0]-nx*.01,point[1],point[2]-nz*.01])).toBe(true);
 for(let d=.01;d<24;d+=.5)expect(solid(rig,part,[point[0]+nx*d,point[1],point[2]+nz*d])).toBe(false);
}

test('every cardinal neighbour, independent quarter turn and recipient upgrade uses real outward fixed surfaces',()=>{
 let cases=0;
 for(const model of ids.slice(1))for(const variant of variants)for(const [dx,dz]of directions)for(let sourceTurn=0;sourceTurn<4;sourceTurn++)for(let targetTurn=0;targetTurn<4;targetTurn++){
  const world=fixture([placement('generator','power-generator',3,3,'base',sourceTurn),placement('receiver',model,3+dx,3+dz,variant,targetTurn)]);
  const links=createGeneratorConnections(world,[active('generator',['receiver'])]);expect(links).toHaveLength(1);
  const link=links[0],sourceRig=world.rigs.get('generator'),targetRig=world.rigs.get('receiver');
  expect(link.source).toBeInstanceOf(Float64Array);expect(link.target).toBeInstanceOf(Float64Array);
  expect(link.sourceId).toBe('generator');expect(link.targetId).toBe('receiver');expect(link.source[1]).toBe(34.5);expect(link.target[1]).toBe(35.5);
  checkFace(sourceRig,sourceRig.parts[0],link.source,dx,dz);
  checkFace(targetRig,targetRig.parts.find(p=>p.id===(model==='turret-study'?'base':'body')),link.target,-dx,-dz);
  expect(Math.hypot(...link.source.map((v,i)=>v-link.target[i]))).toBeGreaterThan(5);
  // Interior of the direct connection is free of both complete bind models.
  for(let i=1;i<64;i++){
   const p=Array.from(link.source,(v,j)=>v+(link.target[j]-v)*i/64);
   expect(solidAny(sourceRig,p)).toBe(false);expect(solidAny(targetRig,p)).toBe(false);
  }
  cases++;
 }
 expect(cases).toBe(576);
});

test('links follow only cached eligible enhancer recipients, once per source and receiver',()=>{
 const placements=[placement('g','power-generator',3,3),placement('north','arc-spire',3,2,'upgrade1'),placement('east','missile-launcher',4,3,'upgrade2'),placement('west','turret-study',2,3),
  placement('south','turret-study',3,4),placement('diagonal','turret-study',4,4),placement('far','turret-study',5,3),placement('empty','power-generator',0,0),placement('other','power-generator',1,3),placement('inactive','power-generator',4,2,'upgrade1')];
 const world=fixture(placements),weapons=placements.filter(p=>p.model!=='power-generator'&&p.id!=='south').map(p=>({id:p.id,model:p.model,variant:p.variant,strength:10}));
 const enhancers=new EnhancerPreview(world,weapons),before=JSON.stringify(enhancers.states),links=createGeneratorConnections(world,enhancers.states);
 expect(links.map(p=>[p.sourceId,p.targetId])).toEqual([['g','north'],['g','east'],['g','west'],['other','west']]);
 expect(JSON.stringify(enhancers.states)).toBe(before);
 expect(createGeneratorConnections(world,[active('g',['west','west']),active('g',['west'])])).toHaveLength(1);
 expect(createGeneratorConnections(world,[{...active('g',['west']),active:false}])).toEqual([]);
 expect(createGeneratorConnections(world,[])).toEqual([]);
 enhancers.dispose();expect(createGeneratorConnections(world,enhancers.states)).toEqual([]);
});

test('stale, unsupported and non-cardinal state entries cannot attach to an unrelated rig or moving part',()=>{
 for(const fault of ['missing-source','wrong-source-model','wrong-source-variant','missing-source-part','missing-target','wrong-role','unknown-model','missing-fixed-part','parented-part','raised-target','diagonal','distant']){
  const world=fixture([placement('g','power-generator',3,3),placement('target','turret-study',4,3)]),source=world.rigs.get('g'),target=world.rigs.get('target');
  if(fault==='missing-source')world.rigs.delete('g');
  if(fault==='wrong-source-model')source.model='arc-spire';
  if(fault==='wrong-source-variant')source.variant='upgrade1';
  if(fault==='missing-source-part')source.parts=[];
  if(fault==='missing-target')world.rigs.delete('target');
  if(fault==='wrong-role')target.role='scenery';
  if(fault==='unknown-model')target.model='dog';
  if(fault==='missing-fixed-part')target.parts=target.parts.filter(p=>p.id!=='base');
  if(fault==='parented-part')target.parts=target.parts.map(p=>p.id==='base'?{...p,parent:'head'}:p);
  if(fault==='raised-target')target.root[13]++;
  if(fault==='diagonal')target.root[14]+=24;
  if(fault==='distant')target.root[12]+=24;
  expect(createGeneratorConnections(world,[active('g',['target'])]),fault).toEqual([]);
 }
});

test('saved A1 pair has a readable shoulder span that is independent of animation and owns no scene references',async()=>{
 const level=await Bun.file(new URL('../project-docs/level-rebuild-2026-10-18/previous-levels/moss-01.json',import.meta.url)).json(),generators=level.placements.filter(p=>p.model==='power-generator');
 expect(generators).toHaveLength(1);
 const generator=generators[0],recipients=level.placements.filter(p=>p.model==='turret-study'&&p.variant==='base'&&p.box[1]===generator.box[1]&&Math.abs(p.box[0]-generator.box[0])+Math.abs(p.box[2]-generator.box[2])===1);
 expect(generator.variant).toBe('base');expect(recipients).toHaveLength(1);
 const recipient=recipients[0],world=fixture([generator,recipient]),enhancers=new EnhancerPreview(world,[{id:recipient.id,model:recipient.model,variant:recipient.variant,strength:10}]);
 const links=createGeneratorConnections(world,enhancers.states),before=structuredClone(links);expect(links).toHaveLength(1);
 expect(links[0].sourceId).toBe(generator.id);expect(links[0].targetId).toBe(recipient.id);
 expect(Array.from(links[0].source)).toEqual([77,34.5,155.5]);expect(Array.from(links[0].target)).toEqual([65,35.5,155.5]);
 const sourceRig=world.rigs.get(generator.id),targetRig=world.rigs.get(recipient.id);
 checkFace(sourceRig,sourceRig.parts.find(p=>p.id==='body'),links[0].source,-1,0);
 checkFace(targetRig,targetRig.parts.find(p=>p.id==='base'),links[0].target,1,0);
 expect(Math.hypot(...links[0].source.map((v,i)=>v-links[0].target[i]))).toBeCloseTo(Math.sqrt(145),9);
 // Head and gun matrices can yaw, pitch and recoil arbitrarily without moving
 // an endpoint. The helper intentionally reads only the fixed placement root.
 for(const instance of world.rigs.get(recipient.id).instances)if(instance.part!=='base')instance.matrix.fill(99);
 expect(createGeneratorConnections(world,enhancers.states)).toEqual(before);
 const next=createGeneratorConnections(world,enhancers.states);expect(next[0].source).not.toBe(links[0].source);expect(next[0].target).not.toBe(links[0].target);
 expect(Object.keys(links[0])).toEqual(['source','target','sourceId','targetId']);
 enhancers.dispose();world.rigs.clear();expect(links).toEqual(before);
});
