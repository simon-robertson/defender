import {test,expect} from 'bun:test';
import {EnhancerPreview} from '../game/enhancer-preview.js';
import {ENHANCER_STATS} from '../shared/enhancer.js';
import {newLevel} from '../shared/level.js';
import {placementMatrix} from '../shared/math.js';

const placement=(id,x,z,model='turret-study',variant='base',turn=0)=>({id,model,variant,box:[x,0,z],turn});
const generator=(id,x,z,variant='base')=>placement(id,x,z,'power-generator',variant);
const weapon=(p,strength=10)=>({id:p.id,model:p.model,variant:p.variant,strength,cycle:{time:12,readyAt:13,remaining:2,rule:{cooldownSeconds:1,shotIntervalSeconds:.12}},ammo:3,nextLaunchAt:14});
function fixture(placements){
 const level=newLevel('enhancer-unit');level.size=[7,7];level.placements=placements;
 const rigs=new Map(placements.map(p=>{const root=placementMatrix(p.box,p.turn,p.offset);root[13]=24;return [p.id,{model:p.model,variant:p.variant,role:'defence',root}];}));
 return {level,rigs};
}

test('every cardinal adjacent attacking defence receives the same bonus, independent of quarter turn',()=>{
 const g=generator('g',3,3),cardinals=[placement('north',3,2,'turret-study','base',0),placement('east',4,3,'arc-spire','upgrade1',1),placement('south',3,4,'missile-launcher','upgrade2',2),placement('west',2,3,'turret-study','upgrade1',3)];
 const outside=[placement('diagonal',4,4),placement('two-away',5,3),placement('same-box',3,3)],world=fixture([g,...cardinals,...outside]);
 const weapons=[...cardinals,...outside].map((p,i)=>weapon(p,10*(i+1))),before=structuredClone(world.level),enhancers=new EnhancerPreview(world,weapons);
 expect(enhancers.states[0]).toEqual({id:'g',model:'power-generator',variant:'base',active:true,recipientIds:cardinals.map(p=>p.id)});
 for(let i=0;i<weapons.length;i++){
  expect(weapons[i].baseStrength).toBe(10*(i+1));expect(weapons[i].strengthIncrease).toBe(i<4?.25:0);expect(weapons[i].strength).toBe(10*(i+1)*(i<4?1.25:1));
 }
 expect(world.level).toEqual(before);expect(ENHANCER_STATS['power-generator'].base.strengthIncrease).toBe(.25);
 enhancers.dispose();
});

test('dry terrain and rendered root must both match path height; outside boxes never wrap into adjacency',()=>{
 for(const kind of ['raised-terrain','wet-terrain','raised-root','lowered-root','outside-recipient','outside-generator','raised-generator','wet-generator']){
  const g=generator('g',kind==='outside-generator'?-1:0,0),p=placement('weapon',kind==='outside-recipient'?-1:kind==='outside-generator'?0:1,0),world=fixture([g,p]);
  if(kind==='raised-terrain')world.level.terrain.boxes.push({box:[p.box[0],0],ground:25,water:0});
  if(kind==='wet-terrain')world.level.terrain.boxes.push({box:[p.box[0],0],ground:24,water:25});
  if(kind==='raised-root')world.rigs.get(p.id).root[13]=25;
  if(kind==='lowered-root')world.rigs.get(p.id).root[13]=23;
  if(kind==='raised-generator')world.rigs.get(g.id).root[13]=25;
  if(kind==='wet-generator')world.level.terrain.boxes.push({box:[g.box[0],0],ground:24,water:25});
  const state=weapon(p),enhancers=new EnhancerPreview(world,[state]);
  expect(state.strength,kind).toBe(10);expect(enhancers.states[0].active,kind).toBe(false);expect(enhancers.states[0].recipientIds,kind).toEqual([]);enhancers.dispose();
 }
 const g=generator('g',0,0),p=placement('weapon',1,0),world=fixture([g,p]);world.level.pathHeight=20;
 for(const item of [g,p]){world.level.terrain.boxes.push({box:[item.box[0],item.box[2]],ground:20,water:0});world.rigs.get(item.id).root[13]=20;}
 const state=weapon(p),enhancers=new EnhancerPreview(world,[state]);expect(state.strength).toBe(12.5);expect(enhancers.states[0].active).toBe(true);enhancers.dispose();
});

test('overlapping base sources use one strongest bonus; upgrades and empty generators stay inactive',()=>{
 const sources=[generator('north',3,2),generator('south',3,4),generator('up1',2,3,'upgrade1'),generator('up2',4,3,'upgrade2'),generator('empty',0,0)],p=placement('weapon',3,3),world=fixture([...sources,p]);
 const state=weapon(p,75),enhancers=new EnhancerPreview(world,[state]);
 expect(state.baseStrength).toBe(75);expect(state.strengthIncrease).toBe(.25);expect(state.strength).toBe(93.75);
 expect(enhancers.states.map(s=>s.active)).toEqual([true,true,false,false,false]);
 expect(enhancers.states.map(s=>s.recipientIds)).toEqual([['weapon'],['weapon'],[],[],[]]);
 enhancers.dispose();
});

test('only matching scene-owned attacking defence states qualify as recipients',()=>{
 for(const kind of ['missing-placement','missing-rig','wrong-role','wrong-model','wrong-variant','detail','zero-strength','enhancer']){
  const g=generator('g',3,3),p=placement('weapon',4,3),world=fixture([g,p]),state=weapon(p);
  if(kind==='missing-placement')world.level.placements.pop();
  if(kind==='missing-rig')world.rigs.delete(p.id);
  if(kind==='wrong-role')world.rigs.get(p.id).role='scenery';
  if(kind==='wrong-model')state.model='arc-spire';
  if(kind==='wrong-variant')state.variant='upgrade2';
  if(kind==='detail')p.kind='detail';
  if(kind==='zero-strength')state.strength=0;
  if(kind==='enhancer'){p.model=state.model='power-generator';world.rigs.get(p.id).model=p.model;}
  const enhancers=new EnhancerPreview(world,[state]);
  expect(state.strengthIncrease,kind).toBe(0);expect(enhancers.states[0].active,kind).toBe(false);expect(enhancers.states[0].recipientIds,kind).toEqual([]);enhancers.dispose();
 }
 // Existing turret states deliberately have no model discriminator.
 const g=generator('g',3,3),p=placement('weapon',4,3),state=weapon(p);delete state.model;
 const enhancers=new EnhancerPreview(fixture([g,p]),[state]);expect(state.strength).toBe(12.5);enhancers.dispose();
});

test('refresh and reset reuse cached links, preserve timing and never compound the bonus',()=>{
 const g=generator('g',3,3),p=placement('weapon',4,3),world=fixture([g,p]),state=weapon(p),cycle=state.cycle,before=structuredClone(cycle);let changes=0;
 const enhancers=new EnhancerPreview(world,[state],()=>changes++),bindings=enhancers.bindings,recipientIds=enhancers.states[0].recipientIds;
 expect(changes).toBe(1);
 for(let i=0;i<10;i++){expect(enhancers.reset()).toBe(false);expect(enhancers.refresh()).toBe(false);expect(state.strength).toBe(12.5);}
 expect(changes).toBe(1);expect(enhancers.bindings).toBe(bindings);expect(enhancers.states[0].recipientIds).toBe(recipientIds);
 state.strength=10;expect(enhancers.refresh()).toBe(true);expect(state.strength).toBe(12.5);expect(changes).toBe(2);
 state.baseStrength=100;expect(enhancers.reset()).toBe(false);expect(state.baseStrength).toBe(10);expect(state.strength).toBe(12.5);
 expect(state.cycle).toBe(cycle);expect(cycle).toEqual(before);expect(state.ammo).toBe(3);expect(state.nextLaunchAt).toBe(14);
 enhancers.dispose();
});

test('disposal restores borrowed strengths, releases all bindings and cannot call a disposed planner',()=>{
 const g=generator('g',3,3),p=placement('weapon',4,3),world=fixture([g,p]),state=weapon(p);let changes=0;
 const enhancers=new EnhancerPreview(world,[state],()=>changes++),binding=enhancers.bindings[0],source=enhancers.states[0],recipientIds=source.recipientIds;
 enhancers.dispose();expect(changes).toBe(1);expect(state.strength).toBe(10);expect(state.baseStrength).toBe(10);expect(state.strengthIncrease).toBe(0);
 expect(binding.weapon).toBeNull();expect(enhancers.bindings).toEqual([]);expect(enhancers.states).toEqual([]);expect(enhancers.onChange).toBeNull();expect(source.active).toBe(false);expect(recipientIds).toEqual([]);
 expect(world.rigs.size).toBe(2);expect(world.level.placements).toHaveLength(2);expect(enhancers.refresh()).toBe(false);expect(()=>enhancers.dispose()).not.toThrow();expect(changes).toBe(1);
});
