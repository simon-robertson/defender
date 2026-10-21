// Historical routed fixtures retain the combat/animation measurement baseline.
// Read-only before/after operation and byte-exact pose probe.
// Usage: bun tests/helpers/animation-maintenance-probe.js /absolute/source-snapshot
// Snapshot must contain the pre-change engine/, game/ and shared/ directories.
import {fileURLToPath,pathToFileURL} from 'node:url';

const current=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,''),baseline=process.argv[2];
if(!baseline)throw new Error('Pass the pre-change source snapshot directory.');
const {buildWorld,disposeWorld}=await import(pathToFileURL(baseline+'/engine/world.js'));
const runtimes=await Promise.all([baseline,current].map(async root=>({
 ...await import(pathToFileURL(root+'/game/enemy-preview.js')),
 ...await import(pathToFileURL(root+'/game/wildlife-preview.js')),
})));
const ids=['moss-01','ochre-01','ice-01','plum-01'],sources=new Map(),levels=[];
for(const id of ids){
 const level=await Bun.file(current+'/docs/landscape-reset-2026-10-18/previous-levels/'+id+'.json').json(),runtime=runtimes[0];
 const actors=[...runtime.previewActorsForLevel(id),...runtime.wildlifeActorsForLevel(id)],models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)])){
  if(!sources.has(id))sources.set(id,await Bun.file(current+'/assets/models/'+id+'.json').json());models.set(id,sources.get(id));
 }
 levels.push({level,actors,models});
}
function fixture(runtime,source,capture){
 const world=buildWorld(source.level,source.models,{actors:source.actors}),hash=capture?new Bun.CryptoHasher('sha256'):null;
 const count={poseCallbacks:0,matrixBytes:0,rigUpdates:0,boneVisits:0,sin:0,cos:0,acceptedHits:0};let live=false;
 const change=(key,index,matrix)=>{if(!live)return;count.poseCallbacks++;count.matrixBytes+=matrix.byteLength;if(hash){hash.update(key+':'+index);hash.update(matrix);}};
 const enemy=new runtime.EnemyPreview(world,change),wildlife=new runtime.WildlifePreview(world,change);wildlife.setThreatSources(enemy.states);
 if(capture)for(const state of [...enemy.states,...wildlife.states]){
  const rig=state.rig,update=rig.update;rig.update=function(){count.rigUpdates++;count.boneVisits+=this.bones.length;return update.call(this);};
 }
 function record(){
  hash.update(JSON.stringify([enemy.time,enemy.completedLoops,enemy.updatedParts,wildlife.time,wildlife.updatedParts,wildlife.thinkCount,wildlife.lastThinkId,wildlife.lastThinkWork,wildlife.spookCount]));
  for(const state of [...enemy.states,...wildlife.states]){
   const simple={};for(const [key,value]of Object.entries(state))if(typeof value==='number'||typeof value==='string'||typeof value==='boolean'||value===null)simple[key]=value;
   hash.update(JSON.stringify(simple));if(state.route)hash.update(state.route);
   for(const bone of state.rig.bones){hash.update(bone.instance.matrix);hash.update(bone.rotation);hash.update(bone.translation);}
   if(state.gait)for(const foot of state.gait.feet){hash.update(foot.position);hash.update(JSON.stringify([foot.yaw,foot.phase,foot.stance,foot.reach]));}
   if(state.impact)hash.update(JSON.stringify([state.health.current,state.impact.active,state.impact.balanceAllowed,state.impact.offsetX,state.impact.offsetZ,state.impact.pitch,state.impact.roll,state.impact.bob]));
  }
 }
 return {count,run(reactions=false){
  const sin=Math.sin,cos=Math.cos;if(capture){Math.sin=function(x){count.sin++;return sin(x);};Math.cos=function(x){count.cos++;return cos(x);};}
  live=true;const start=performance.now();
  try{for(let frame=0;frame<600;frame++){
   if(reactions&&(frame===90||frame===120||frame===300))for(const state of enemy.states){const hits=state.impact.hits;enemy.takeHit(state,1,frame===300?0:70,-45,frame===300?0:20);if(state.impact.hits>hits&&state.impact.active)count.acceptedHits++;}
   if(reactions&&frame===400&&enemy.states.length)enemy.takeHit(enemy.states[0],1000);
   if(reactions&&frame===450)enemy.reset();
   enemy.advance(1/60);wildlife.advance(1/60);if(hash)record();
  }}finally{Math.sin=sin;Math.cos=cos;}
  return {milliseconds:performance.now()-start,...count,...(hash?{sha256:hash.digest('hex')}:{})};
 },dispose(){enemy.dispose();wildlife.dispose();disposeWorld(world);}};
}
const proof=[];
for(const reactions of [false,true])for(const source of levels){
 const results=[];for(const runtime of runtimes){const f=fixture(runtime,source,true);try{results.push(f.run(reactions));}finally{f.dispose();}}
 if(results[0].sha256!==results[1].sha256)throw new Error('Pose/state mismatch: '+source.level.id+' reactions='+reactions);
 proof.push({level:source.level.id,reactions,before:results[0],after:results[1]});
}
// Alternate execution order after warmup. The timed region contains only the
// actual advance loops (no hashing, instrumentation, source/scene construction).
const samples=[[],[]];
for(let round=0;round<9;round++){
 const total=[0,0];
 for(const source of levels)for(const index of round%2?[1,0]:[0,1]){
  const f=fixture(runtimes[index],source,false);try{total[index]+=f.run().milliseconds;}finally{f.dispose();}
 }
 if(round>=2)for(let i=0;i<2;i++)samples[i].push(total[i]);
}
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
console.log(JSON.stringify({framesPerZone:600,zones:4,proof,timing:{description:'Four real-zone animation/wildlife advance loops, 600 frames each; two warmups, seven alternating-order samples; local CPU evidence, not a frame-rate claim.',beforeMs:samples[0],afterMs:samples[1],beforeMedianMs:median(samples[0]),afterMedianMs:median(samples[1])}},null,2));
