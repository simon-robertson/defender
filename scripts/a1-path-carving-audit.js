// Offline probes only: no actors/defences are written to the reviewed level.
import {A1_OPTIONS,digest} from './a1-path-carving-options.js';
import {auditModels,auditRouteGeometry} from './level-layout-audit.js';
import {reviewPlacementVisibility} from './verify-zone-a-four-visibility.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {ArcSpirePreview} from '../game/arc-spire-preview.js';
import {placementMatrix} from '../shared/math.js';
import {validateLevel} from '../shared/level.js';
import {TerrainField} from '../shared/terrain.js';
import {DEFENCE_STATS} from '../shared/defence.js';

const root=new URL('../',import.meta.url),out=new URL('docs/a1-path-carving-2026-10-18/',root);
const intervals=flags=>{const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;};

export function auditArcCoverage(level,sites,models){
 const actors=['dog','roller','moth'].map(model=>({id:'arc-survey-'+model,model,variant:'base',distance:0}));
 const world=buildWorld(level,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,actors),length=(level.path.length-1)*24,probes=[];
 try{
  for(const site of sites)for(const variant of ['base','upgrade1']){
   const placement={id:'arc-probe-'+site.id,model:'arc-spire',variant,box:[site.box[0],0,site.box[1]],turn:0},matrix=placementMatrix(placement.box,0);matrix[13]=level.pathHeight;
   let seed=1701;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
   const probeWorld={...world,level:{placements:[placement]},rigs:new Map([[placement.id,{root:matrix}]])};
   probes.push({site,variant,arc:new ArcSpirePreview(probeWorld,enemies.states,random),flags:actors.map(()=>new Uint8Array(length)),centreFlags:actors.map(()=>new Uint8Array(length))});
  }
  for(let distance=0;distance<length;distance++){
   for(const s of enemies.states)s.seed=distance+.5;enemies.reset();
   for(const probe of probes)for(let i=0;i<enemies.states.length;i++){
    const target=enemies.states[i],state=probe.arc.states[0];
    if(probe.arc.eligible(state,target)){probe.centreFlags[i][distance]=1;probe.flags[i][distance]=Number(probe.arc.contacts.sample(target,state.source,world.visibility));}
   }
  }
  return sites.map(site=>({id:site.id,box:site.box,variants:Object.fromEntries(probes.filter(p=>p.site===site).map(p=>[p.variant,{range:DEFENCE_STATS['arc-spire'][p.variant].maxRange,centreEligible:Object.fromEntries(actors.map((a,i)=>[a.model,intervals(p.centreFlags[i])])),surfaceContact:Object.fromEntries(actors.map((a,i)=>[a.model,intervals(p.flags[i])]))}]))}));
 }finally{for(const p of probes)p.arc.dispose();enemies.dispose();disposeWorld(world);}
}

export async function auditA1Option(id){
 const text=await Bun.file(new URL(`${id}.level.json`,out)).text(),saved=JSON.parse(text),sites=A1_OPTIONS[id].sites,models=await auditModels(saved);
 models.set('arc-spire',await Bun.file(new URL('../assets/models/arc-spire.json',import.meta.url)).json());
 validateLevel(saved,models);
 const level=structuredClone(saved);delete level.previewMode;
 const field=new TerrainField(level),path=new Set(level.path.map(([x,,z])=>`${x},${z}`)),siteFailures=[];
 for(const site of sites){
  if(field.flatBox(...site.box)!==level.pathHeight||path.has(site.box.join(',')))siteFailures.push(site.id+': support/route');
  for(const model of ['turret-study','arc-spire'])for(const variant of ['base','upgrade1']){
   const probe={...level,placements:[...level.placements,{id:'individual-'+site.id,model,variant,box:[site.box[0],0,site.box[1]],turn:0}]};
   try{validateLevel(probe,models);}catch(e){siteFailures.push(site.id+'/'+model+'/'+variant+': '+e.message);}
  }
 }
 const geometry=auditRouteGeometry(level,sites,models),arc=auditArcCoverage(level,sites,models),visibility=reviewPlacementVisibility(saved,sites,models);
 return {schema:'defender.a1-carving-option-audit',version:1,id,sourceHash:digest(text),recordedAt:new Date().toISOString(),method:'Synthetic offline copy removes previewMode only to admit production Dog/Roller/Moth and individual weapon probes. Actual level contains scenery and wildlife only. Guns: production actual pitched muzzles at zero/full recoil, per-species 1-unit bins. Arcs: production closest terminal, centre LOS and deterministic production facing-side surface sampling at 1-unit bins. No damage, waves, budget or simultaneous adjacent-defence claim.',siteFailures,geometry,arc,visibility,passed:!siteFailures.length&&!geometry.failures.length&&visibility.passed};
}
if(import.meta.main){
 const ids=process.argv.slice(2);for(const id of ids.length?ids:Object.keys(A1_OPTIONS)){
  const report=await auditA1Option(id);await Bun.write(new URL(`${id}.audit.json`,out),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({id,passed:report.passed,failures:report.siteFailures,geometryFailures:report.geometry.failures,sites:report.geometry.coverage.length,poses:report.geometry.sampledPoses,visibility:report.visibility.passed}));
 }
}
