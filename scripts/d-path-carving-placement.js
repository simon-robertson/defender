// Source-bound production placement and actual articulated-envelope checks.
import {D_CARVES} from './d-path-carving.js';
import {digest,D_OUT} from './d-path-carving-options.js';
import {auditModels} from './level-layout-audit.js';
import {createPlacementRules,enemyRouteEnvelope} from '../play/placement.js';
import {buildWorld,disposeWorld} from '../engine/world.js';
import {EnemyPreview} from '../game/enemy-preview.js';
export async function auditDPlacement(id){
 const selected=D_CARVES[id],text=await Bun.file(new URL('../assets/levels/'+id+'.json',import.meta.url)).text(),level=JSON.parse(text),models=await auditModels(level);
 for(const model of ['arc-spire','missile-launcher','guided-missile','wildlife-beetle-plum','wildlife-bird-plum'])models.set(model,await Bun.file(new URL('../assets/models/'+model+'.json',import.meta.url)).json());
 const rules=createPlacementRules(level,models),rows=[];
 try{for(const site of selected.sites)for(const model of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2'])rows.push({site:site.id,box:site.box,model,variant,...rules.check(site.box,variant,[],null,model)});}finally{rules.dispose();}
 const actors=['spider','lantern'].map(model=>({id:'hull-'+model,model,variant:'base',distance:0})),synthetic=structuredClone(level);delete synthetic.previewMode;
 const world=buildWorld(synthetic,models,{actors}),enemies=new EnemyPreview(world,()=>{},null,actors),hulls=enemies.states.map(s=>({species:s.model,contract:enemyRouteEnvelope(models.get(s.model)),maximumRadius:0,bottom:Infinity,top:-Infinity,sampledPoses:0,failures:[]}));
 try{for(let distance=0;distance<=Math.max(...enemies.states.map(s=>s.path.length));distance++){
  for(const s of enemies.states)s.seed=Math.min(distance,s.path.length-1e-6);enemies.reset();
  for(let i=0;i<enemies.states.length;i++){const s=enemies.states[i],row=hulls[i];if(distance>s.path.length)continue;row.sampledPoses++;
   for(const b of s.rig.bones)for(const c of b.part.voxels)for(const dx of [0,1])for(const dy of [0,1])for(const dz of [0,1]){const x=c[0]+dx,y=c[1]+dy,z=c[2]+dz,m=b.instance.matrix,px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13]-level.pathHeight,pz=m[2]*x+m[6]*y+m[10]*z+m[14],radius=Math.hypot(px-s.x,pz-s.z);row.maximumRadius=Math.max(row.maximumRadius,radius);row.bottom=Math.min(row.bottom,py);row.top=Math.max(row.top,py);if((radius>row.contract.radius+1e-4||py<row.contract.bottom-1e-4||py>row.contract.top+1e-4)&&row.failures.length<5)row.failures.push({distance,part:b.part.id,radius,y:py});}
  }
 }}finally{enemies.dispose();disposeWorld(world);}
 return {id,sourceHash:digest(text),method:'Production createPlacementRules.check for every declared plot and three weapon stages independently. Actual Spider/Lantern occupied vertices sampled at each1-unit journey distance and endpoints against current production enemyRouteEnvelope; upright locomotion only, directional impact uses its separate production safety gate.',combinations:rows.length,valid:rows.filter(r=>r.valid).length,restricted:rows.filter(r=>!r.valid),perSite:selected.sites.map(s=>({id:s.id,box:s.box,choices:rows.filter(r=>r.site===s.id&&r.valid).map(r=>r.model+'/'+r.variant)})),hulls,passed:hulls.every(r=>!r.failures.length)&&selected.sites.every(s=>rows.some(r=>r.site===s.id&&r.valid))};
}
if(import.meta.main)for(const id of process.argv.slice(2).length?process.argv.slice(2):Object.keys(D_CARVES)){const report=await auditDPlacement(id);await Bun.write(new URL('zone-d-'+id+'-placement.json',D_OUT),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,passed:report.passed,valid:report.valid,restricted:report.restricted.map(r=>({site:r.site,model:r.model,variant:r.variant,code:r.code})),hulls:report.hulls}));}
