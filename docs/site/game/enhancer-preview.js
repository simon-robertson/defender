import {ENHANCER_STATS} from '../shared/enhancer.js';
import {TerrainField} from '../shared/terrain.js';

// Defence placement is box based, independently of a model's quarter-turn or
// pivot. Both the terrain and actual rendered root must be at path height.
function supported(level,terrain,placement,rig){
 if(!placement||!rig||rig.role!=='defence'||rig.model!==placement.model||rig.variant!==placement.variant||placement.kind==='detail')return false;
 const box=placement.box,x=box?.[0],z=box?.[2];
 return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<level.size[0]&&z<level.size[1]&&
  rig.root?.[13]===level.pathHeight&&terrain.flatBox(x,z)===level.pathHeight;
}

// Static scene topology is resolved once. A reset/refresh only reapplies cached
// strongest bonuses to original strengths; it never reads poses or searches the
// scene. Preview edits require a scene reload; playable preparation rebuilds
// the coordinator against the changed deployment and its fresh weapon states.
export class EnhancerPreview {
 constructor(world,weapons,onChange=null){
  this.states=[];this.bindings=[];this.onChange=onChange;
  const level=world.level,terrain=new TerrainField(level),placements=new Map(level.placements.map(p=>[p.id,p]));
  for(const weapon of weapons){
   const placement=placements.get(weapon.id),rig=world.rigs.get(weapon.id),baseStrength=weapon.baseStrength??weapon.strength;
   const valid=Number.isFinite(baseStrength)&&baseStrength>0&&supported(level,terrain,placement,rig)&&
    placement.model!=='power-generator'&&placement.variant===weapon.variant&&(!weapon.model||placement.model===weapon.model);
   this.bindings.push({weapon,baseStrength,increase:0,x:placement?.box[0],z:placement?.box[2],valid});
  }
  for(const placement of level.placements){
   if(placement.model!=='power-generator')continue;
   const state={id:placement.id,model:placement.model,variant:placement.variant,active:false,recipientIds:[]};
   this.states.push(state);
   if(placement.variant!=='base'||!supported(level,terrain,placement,world.rigs.get(placement.id)))continue;
   const increase=ENHANCER_STATS[state.model][state.variant].strengthIncrease,x=placement.box[0],z=placement.box[2];
   for(const binding of this.bindings){
    if(!binding.valid||Math.abs(binding.x-x)+Math.abs(binding.z-z)!==1)continue;
    state.recipientIds.push(binding.weapon.id);
    binding.increase=Math.max(binding.increase,increase);
   }
   state.active=state.recipientIds.length>0;
  }
  this.refresh();
 }
 refresh(){
  let changed=false;
  for(const binding of this.bindings){
   const weapon=binding.weapon,strength=binding.baseStrength*(1+binding.increase);
   if(weapon.strength!==strength)changed=true;
   weapon.baseStrength=binding.baseStrength;weapon.strengthIncrease=binding.increase;weapon.strength=strength;
  }
  if(changed)this.onChange?.();
  return changed;
 }
 reset(){return this.refresh();}
 dispose(){
  // Restore the borrowed states before their owning controllers release them.
  // Do not notify: the shared planner may already have been disposed.
  this.onChange=null;
  for(const binding of this.bindings){binding.weapon.strength=binding.baseStrength;binding.weapon.strengthIncrease=0;binding.weapon=null;}
  this.bindings.length=0;
  for(const state of this.states){state.active=false;state.recipientIds.length=0;}
  this.states.length=0;
 }
}
