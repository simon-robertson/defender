import {test,expect} from 'bun:test';
import {enemyRouteEnvelope,createPlacementRules} from '../play/placement.js';
import {PoseRig} from '../engine/rig.js';
import {identity} from '../shared/math.js';
import {PathMotion} from '../engine/path-motion.js';
import {ArticulatedGait,WALKER_WALK} from '../engine/articulated-gait.js';
import {EnemyExpansionGait,ENEMY_EXPANSION_MOVEMENT} from '../engine/enemy-expansion-gait.js';
import {levelRoutes} from '../shared/routes.js';
import {PLAY_CONFIG} from '../play/config.js';
import {readdir} from 'node:fs/promises';
const models=new Map();for(const file of await readdir(new URL('../assets/models',import.meta.url)))if(file.endsWith('.json')){const m=await Bun.file(new URL('../assets/models/'+file,import.meta.url)).json();models.set(m.id,m);}
function vertices(part){return [...new Map(part.voxels.flatMap(c=>[0,1].flatMap(dx=>[0,1].flatMap(dy=>[0,1].map(dz=>[c[0]+dx,c[1]+dy,c[2]+dz])))).map(p=>[p.join(','),p])).values()];}
test('height-specific walking envelopes contain complete native articulated voxels throughout all B/C routes',async()=>{
 let checked=0;
 for(const [id,prefix]of [['walker','ochre'],['tripod','ice']]){
  const model=models.get(id),parts=model.variants.base.parts,points=new Map(parts.map(p=>[p.id,vertices(p)])),profile=PLAY_CONFIG.enemies[id],envelope=enemyRouteEnvelope(model,profile);
  const contains=(y,r)=>envelope.layers.some(l=>y>=l.bottom-1e-4&&y<=l.top+1e-4&&r<=l.radius+1e-4);
  for(let n=1;n<=4;n++){
   const level=await Bun.file(new URL(`../assets/levels/${prefix}-0${n}.json`,import.meta.url)).json();
   for(const route of levelRoutes(level)){
    const rig=new PoseRig({root:identity(),parts,instances:parts.map(p=>({part:p.id,key:p.id,index:0,matrix:identity()}))},()=>{}),rule={...(id==='walker'?WALKER_WALK:ENEMY_EXPANSION_MOVEMENT[id]),speed:profile.speed},path=new PathMotion(route.path,rule.turnDistance),gait=id==='walker'?new ArticulatedGait(rig,path,0,id,rule):new EnemyExpansionGait(rig,path,0,id,rule),sample=new Float64Array(3);
    for(let d=0;d<=path.length;d+=.5){path.sample(d,sample);gait.pose(d,...sample);rig.root[13]=-rule.crouch;rig.invalidateRoot();rig.update();
     for(const bone of rig.bones)for(const [x,y,z]of points.get(bone.part.id)){const m=bone.instance.matrix,px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],pz=m[2]*x+m[6]*y+m[10]*z+m[14];if(!contains(py,Math.hypot(px-12,pz-12)))throw new Error(`${level.id}/${bone.part.id} at ${d}: ${px},${py},${pz} outside envelope`);checked++;}
    }
    gait.dispose();
   }
  }
 }
 expect(checked).toBeGreaterThan(1000000);
},30000);

test('later campaign courts recover narrow-body clearance while paths and real conflicts stay protected',async()=>{
 for(const entry of PLAY_CONFIG.levels.slice(4)){
  const level=await Bun.file(new URL(`../assets/levels/${entry.id}.json`,import.meta.url)).json(),rules=createPlacementRules(level,models,{config:PLAY_CONFIG});
  try{
   const cells=rules.eligibleCells('upgrade2');expect(cells.filter(c=>c.valid).length).toBeGreaterThanOrEqual(entry.zone==='B'?25:8);
   for(const route of levelRoutes(level))expect(rules.check(route.path[0],'upgrade2').code).toBe('route');
   const first=cells.find(c=>c.valid),placed={id:'one',box:first.box,model:'turret-study',variant:'upgrade2',turn:0};expect(rules.check(first.box,'upgrade2',[placed]).code).toBe('occupied');
   if(entry.id==='ochre-01')expect(cells.filter(c=>c.valid).length).toBeGreaterThanOrEqual(40);
  }finally{rules.dispose();}
 }
},30000);

 test('faster per-wave Walker overrides retain the broader fallback rather than using the ten-unit gait envelope',async()=>{
 const level=await Bun.file(new URL('../assets/levels/ochre-01.json',import.meta.url)).json(),config=structuredClone(PLAY_CONFIG);for(const wave of config.levels.find(l=>l.id===level.id).waves)wave.enemyOverrides.walker.speed=12;
 const rules=createPlacementRules(level,models,{config});try{expect(rules.eligibleCells('upgrade2').filter(c=>c.valid).length).toBe(1);}finally{rules.dispose();}
});
