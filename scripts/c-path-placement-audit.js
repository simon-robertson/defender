// Native player placement validation and exact occupied-vertex enemy bounds.
import {C_OUT,digest} from './c-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {actorsForPreview} from '../game/preview-actors.js';
import {createPlacementRules,enemyRouteEnvelope} from '../play/placement.js';
import {PLAY_CONFIG} from '../play/config.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
import {levelRoutes} from '../shared/routes.js';
export const C_SELECTED=['zone-c-tarn-circuit','zone-c-meltwater-return','zone-c-ridge-confluence','zone-c-sanctuary-fold'];
export async function auditCPlacement(id){
 const text=await Bun.file(new URL(id+'.level.json',C_OUT)).text(),level=JSON.parse(text),manifest=await Bun.file(new URL(id+'.manifest.json',C_OUT)).json(),models=await auditModels(level);
 for(const name of ['arc-spire','missile-launcher','guided-missile',...actorsForPreview(level).map(a=>a.model)])if(!models.has(name))models.set(name,await Bun.file(new URL('../assets/models/'+name+'.json',import.meta.url)).json());
 const rules=createPlacementRules(level,models,{config:PLAY_CONFIG}),rows=[];let prepared;
 try{for(const model of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2'])rows.push({model,variant,ready:manifest.sites.filter(site=>rules.check(site.box,variant,[],null,model).valid).map(s=>s.id),restricted:manifest.sites.map(site=>({site:site.id,...rules.check(site.box,variant,[],null,model)})).filter(row=>!row.valid)});prepared=rules.prepare([]);}finally{rules.dispose();}
 const probe=structuredClone(level);delete probe.previewMode;
 const actors=levelRoutes(probe).flatMap(route=>['tripod','ray'].map(model=>({id:'bounds-'+route.id+'-'+model,model,variant:'base',routeId:route.id,distance:0}))),world=buildWorld(probe,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,actors),bounds=[];
 try{for(const state of enemies.states){const envelope=enemyRouteEnvelope(models.get(state.model)),row={route:state.routeId,species:state.model,envelope,maxRadius:0,minBottom:Infinity,maxTop:-Infinity,samples:0,failures:[]};
  for(let d=0;d<=state.path.length;d++){state.seed=Math.min(d,state.path.length-1e-6);enemies.reset();const centreX=state.x,centreZ=state.z;for(const bone of state.rig.bones){const m=bone.instance.matrix;for(const cell of bone.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const x=cell[0]+dx,y=cell[1]+dy,z=cell[2]+dz,px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13]-level.pathHeight,pz=m[2]*x+m[6]*y+m[10]*z+m[14],r=Math.hypot(px-centreX,pz-centreZ);row.maxRadius=Math.max(row.maxRadius,r);row.minBottom=Math.min(row.minBottom,py);row.maxTop=Math.max(row.maxTop,py);if((r>envelope.radius+1e-4||py<envelope.bottom-1e-4||py>envelope.top+1e-4)&&row.failures.length<8)row.failures.push({distance:d,part:bone.part.id,r,y:py});}}row.samples++;}bounds.push(row);
 }}finally{enemies.dispose();disposeWorld(world);}
 return {id,level:level.id,sourceHash:digest(text),playConfigHash:digest(JSON.stringify(PLAY_CONFIG)),method:'Current createPlacementRules with the recorded PLAY_CONFIG independently checks every site/family/tier. Enemy occupied-cell vertices use shared preview locomotion at every one-unit route pose and endpoints to test the conservative authoring envelopes; canonical poses are finite evidence, not all animation phases. Play-only combat/profile verification belongs to campaign evidence.',rows,prepared,enemyBounds:bounds,passed:prepared.valid&&bounds.every(row=>!row.failures.length)};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):C_SELECTED){const report=await auditCPlacement(id);await Bun.write(new URL(id+'.placement.json',C_OUT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,passed:report.passed,prepared:report.prepared,bounds:report.enemyBounds.map(({envelope,maxRadius,minBottom,maxTop,failures})=>({envelope,maxRadius,minBottom,maxTop,failures})),ready:report.rows.map(r=>({model:r.model,variant:r.variant,ready:r.ready.length,restricted:r.restricted.length}))}));}
