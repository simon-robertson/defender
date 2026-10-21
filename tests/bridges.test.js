import {test,expect} from 'bun:test';
import {newLevel,validateLevel} from '../shared/level.js';
import {newModel} from '../shared/model.js';
import {TerrainField,setPathHeight} from '../shared/terrain.js';
import {TerrainMeshes} from '../shared/terrain-mesh.js';
import {BRIDGE_MATERIALS,bridgeQuads} from '../shared/bridges.js';
import {buildWorld,disposeWorld,terrainGeometry} from '../engine/world.js';
import {Camera,PATH_CAMERA_HEIGHT} from '../engine/camera.js';
import {EnemyImpactClearance} from '../engine/enemy-impact.js';
import {debrisSupport,sweepScenery} from '../engine/debris-collision.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {DefencePreview} from '../game/defence-preview.js';
import {RainField} from '../engine/rain.js';

function crossing(){
 const level=newLevel('bridge-test');level.size=[4,3];level.previewMode='layout';level.path=[[0,0,1],[1,0,1],[2,0,1],[3,0,1]];
 level.terrain.boxes=[{box:[1,1],ground:6,water:20},{box:[2,1],ground:6,water:20}];level.bridges=[{id:'wooden-crossing',boxes:[[1,1],[2,1]]}];return level;
}
test('explicit bridges retain water and bed, add walking support, preserve dry land-only placement and protect source edits',()=>{
 const level=crossing(),before=JSON.stringify(level);expect(validateLevel(level)).toBe(level);const terrain=new TerrainField(level);
 expect(terrain.height(36,36)).toBe(6);expect(terrain.height(36,36,true)).toBe(20);expect(terrain.flatBox(1,1)).toBeNull();expect(terrain.supportBox(1,1)).toBe(24);expect(terrain.supportBox(0,1)).toBe(24);expect(terrain.bridgeBox(1,1)).toBe(true);
 expect(terrain.paint(1,1,'drain',0)).toEqual({changed:0,protectedCount:1});expect(()=>setPathHeight(level,25)).toThrow('source JSON');expect(JSON.stringify(level)).toBe(before);
 const model=newModel('test-defence');model.role='defence';model.variants.base.parts[0].voxels=[[12,0,12,0]];
 const combat={...structuredClone(level),previewMode:undefined,placements:[{id:'not-land',model:model.id,variant:'base',box:[1,1,1],anchor:'absolute',turn:0}]};
 expect(()=>validateLevel(combat,new Map([[model.id,model]]))).toThrow('ground at the enemy path height');
 const scenery=newModel('overlap-prop');scenery.role='scenery';scenery.variants.base.parts[0].voxels=[[12,23,12,0]];
 expect(()=>validateLevel({...level,placements:[{id:'overlap',model:scenery.id,variant:'base',box:[1,0,1],anchor:'absolute',turn:0}]},new Map([[scenery.id,scenery]]))).toThrow('bridge deck');
});

test('offline actual Dog poses retain supported flat soles across both banks and the bridge deck',async()=>{
 const level=crossing();delete level.previewMode;const dog=await Bun.file(new URL('../assets/models/dog.json',import.meta.url)).json(),actors=[{id:'audit-dog',model:dog.id,variant:'base',distance:12}],world=buildWorld(level,new Map([[dog.id,dog]]),{actors}),enemy=new EnemyPreview(world,()=>{},null,actors),terrain=new TerrainField(level);
 try{
  for(let distance=12;distance<=60;distance+=.75){
   enemy.states[0].seed=distance;enemy.pose();const state=enemy.states[0];
   for(const foot of state.gait.feet){
    expect(foot.position[1]).toBeGreaterThanOrEqual(24-1e-6);const data=state.rig.byId.get('paw-'+foot.name),matrix=data.instance.matrix;
    for(const cell of data.part.voxels)if(cell[1]===0){
     const x=cell[0]+.5,z=cell[2]+.5,wx=matrix[0]*x+matrix[8]*z+matrix[12],wy=matrix[1]*x+matrix[9]*z+matrix[13],wz=matrix[2]*x+matrix[10]*z+matrix[14];
     expect(wy).toBeGreaterThanOrEqual(24-1e-4);expect(terrain.supportBox(Math.floor(wx/24),Math.floor(wz/24))).toBe(24);
    }
   }
  }
 }finally{enemy.dispose();disposeWorld(world);}
});

test('bridge validation rejects invalid metadata, submerged decks, dry fills, route gaps and missing or turning banks',()=>{
 for(const change of [
  l=>l.bridges={},l=>l.bridges=[null],l=>l.bridges[0].id='BAD',l=>l.bridges.push(structuredClone(l.bridges[0])),l=>l.bridges[0].top=25,
  l=>l.bridges[0].boxes=[],l=>l.bridges[0].boxes=[[1,1],[1,1]],l=>l.bridges[0].boxes=[[1,1],[3,1]],l=>l.bridges[0].boxes=[[1,1],[2,2]],l=>l.bridges[0].boxes=[[1.5,1]],l=>l.bridges[0].boxes=[[4,1]],
  l=>l.terrain.boxes[0].water=23,l=>l.terrain.boxes[0].water=0,l=>l.path.shift(),l=>l.path.pop(),l=>l.path=[[1,0,0],[1,0,1],[2,0,1],[3,0,1]],
  l=>l.bridges[0].boxes=[[1,1]],l=>{l.previewMode='landscape';l.path=[];},
 ]){const level=crossing();change(level);expect(()=>validateLevel(level)).toThrow();}
 const single=crossing();single.terrain.boxes.pop();single.bridges[0].boxes.pop();expect(()=>validateLevel(single)).not.toThrow();
 const reverse=crossing();reverse.path.reverse();expect(()=>validateLevel(reverse)).not.toThrow();
});

test('wooden deck and natural terrain exactly match an independent solid-cell surface oracle without hidden or duplicate faces',()=>{
 const level=crossing(),geometry=terrainGeometry(level),actual=new Set(),expected=new Set(),width=level.size[0]*24,length=level.size[1]*24;
 const solid=(x,y,z)=>x>=0&&z>=0&&x<width&&z<length&&y>=0&&y<(x>=24&&x<72&&z>=24&&z<48?6:24)||(x>=24&&x<72&&z>=24&&z<48&&y===23);
 const faceKey=(x,y,z,axis,sign)=>[x,y,z,axis,sign].join(',');
 for(const q of geometry.ground.quads)for(let u=0;u<q.width;u++)for(let v=0;v<q.height;v++){
  const p=q.origin.slice();p[(q.axis+1)%3]+=u;p[(q.axis+2)%3]+=v;const id=faceKey(...p,q.axis,q.sign);expect(actual.has(id)).toBe(false);actual.add(id);
 }
 for(let z=0;z<length;z++)for(let x=0;x<width;x++)for(let y=0;y<24;y++)if(solid(x,y,z))for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const neighbor=[x,y,z];neighbor[axis]+=sign;if(solid(...neighbor))continue;const p=[x,y,z];if(sign>0)p[axis]++;expected.add(faceKey(...p,axis,sign));
 }
 expect(actual).toEqual(expected);
 const raw=bridgeQuads(level);expect(raw.filter(q=>q.axis===1&&q.sign===1).reduce((n,q)=>n+q.width*q.height,0)).toBe(2*24*24);expect(raw.every(q=>q.origin[1]>=23&&q.origin[1]<=24)).toBe(true);
 const reverse=crossing();reverse.path=reverse.path.map(([x,y,z])=>[z,y,x]);reverse.size=[3,4];reverse.terrain.boxes=reverse.terrain.boxes.map(b=>({...b,box:b.box.toReversed()}));reverse.bridges[0].boxes=reverse.bridges[0].boxes.map(b=>b.toReversed());expect(()=>validateLevel(reverse)).not.toThrow();expect(bridgeQuads(reverse).filter(q=>q.axis===1&&q.sign===1).reduce((n,q)=>n+q.width*q.height,0)).toBe(1152);
});

test('weather rebuild preserves the exact water mesh and matte nonemissive wood without stone or soil on the deck',()=>{
 const level=crossing(),before=JSON.stringify(level),dry=terrainGeometry(level,{enabled:false,type:'rain'}),wet=terrainGeometry(level,{enabled:true,type:'rain'});
 expect(wet.water.vertices).toEqual(dry.water.vertices);expect(wet.water.indices).toEqual(dry.water.indices);expect(BRIDGE_MATERIALS.every(m=>m.emission===0&&m.reflectiveness===0&&!m.castsLight)).toBe(true);
 for(const mesh of [dry.ground,wet.ground])for(let i=0;i<mesh.quads.length;i++){
  const q=mesh.quads[i];if(q.axis!==1||q.sign!==1||q.origin[1]!==24||q.origin[0]<24||q.origin[0]>=72||q.origin[2]<24||q.origin[2]>=48)continue;
  for(let vertex=i*44;vertex<(i+1)*44;vertex+=11){expect(mesh.vertices[vertex+9]).toBe(0);expect(mesh.vertices[vertex+10]).toBe(0);}
  expect(q.material).toBeGreaterThanOrEqual(21);
 }
 expect(JSON.stringify(level)).toBe(before);
 const meshes=new TerrainMeshes(),first=meshes.scene(level),deck=first.find(entry=>entry.key.startsWith('bridge-'));expect(deck).toBeDefined();expect(meshes.scene(level).find(entry=>entry.key===deck.key)).toBe(deck);
 const bankTop=entries=>entries.some(entry=>entry.transforms.some(m=>entry.mesh.quads.some(q=>q.axis===0&&q.sign===1&&q.origin[0]+m[12]===24&&q.origin[1]<=23&&q.origin[1]+q.width>23&&q.origin[2]+m[14]<=36&&q.origin[2]+m[14]+q.height>36)));
 expect(bankTop(first)).toBe(false);
 const changed=structuredClone(level);changed.bridges=[];changed.path=[];const withoutDeck=meshes.scene(changed);expect(withoutDeck.some(entry=>entry.key.startsWith('bridge-'))).toBe(false);expect(meshes.bridge).toBeNull();expect(bankTop(withoutDeck)).toBe(true);
});

test('bridge top supports path camera, off-line ground clearance, debris and rain while preserving an open under-deck gap',()=>{
 const level=crossing(),world=buildWorld(level,new Map()),visibility=world.visibility,clearance=new EnemyImpactClearance(world),camera=new Camera({addEventListener(){},focus(){},clientWidth:1200,clientHeight:800},()=>{});
 try{
  expect(visibility.blocked(36,25,36,36,22,36)).toBe(true);expect(visibility.blocked(36,22,36,60,22,36)).toBe(false);expect(visibility.blocked(36,24.01,36,60,24.01,36)).toBe(false);
  expect(debrisSupport(visibility,36,36,1,30)).toBe(24);const hit=new Float64Array(5);expect(sweepScenery(visibility,36,30,36,0,-12,0,1,hit)).toBe(true);expect(hit[2]).toBe(1);expect(hit[4]).toBe(24);
  expect(clearance.clear([30,24,30,42,44,42])).toBe(true);expect(clearance.heights[1+1*level.size[0]]).toBe(24);
  camera.setLevel(level);expect(camera.toggleMode(()=>.3)).toBe(true);expect(camera.position[1]).toBe(24+PATH_CAMERA_HEIGHT);expect(camera.groundHeight(36,36)).toBe(24);
  const rainy={...world,weather:{type:'rain',enabled:true}},rain=new RainField(rainy);let deckDrops=0;
  for(let i=0;i<rain.instanceData.length;i+=8){const x=rain.instanceData[i],z=rain.instanceData[i+1];if(x>=24&&x<72&&z>=24&&z<48){expect(rain.instanceData[i+2]).toBe(24);deckDrops++;}}
  expect(deckDrops).toBeGreaterThan(0);rain.dispose();
  expect(actorsForPreview(level)).toEqual([]);const enemy=new EnemyPreview(world,()=>{}),defences=new DefencePreview(world,()=>{});expect(enemy.states).toEqual([]);expect(defences.states).toEqual([]);expect(defences.missiles.pool).toBeNull();enemy.dispose();defences.dispose();
 }finally{camera.clearLevel();clearance.dispose();disposeWorld(world);}
 expect(camera.groundHeights).toBeNull();expect(visibility.bounds).toBeNull();
});
