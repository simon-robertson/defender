import {PoseRig} from '../../engine/rig.js';
import {identity} from '../../shared/math.js';
import {PathMotion} from '../../engine/path-motion.js';
import {ArticulatedGait,WALKER_WALK,SPIDER_WALK} from '../../engine/articulated-gait.js';
import {EnemyExpansionGait,ENEMY_EXPANSION_MOVEMENT} from '../../engine/enemy-expansion-gait.js';
import {levelRoutes} from '../../shared/routes.js';
import {PLAY_CONFIG} from '../../play/config.js';
const rows={};
for(const [id,prefix]of [['walker','ochre'],['tripod','ice'],['spider','plum']]){
 const model=await Bun.file('assets/models/'+id+'.json').json(),parts=model.variants.base.parts,points=new Map(parts.map(p=>[p.id,[...new Map(p.voxels.flatMap(c=>[0,1].flatMap(dx=>[0,1].flatMap(dy=>[0,1].map(dz=>[c[0]+dx,c[1]+dy,c[2]+dz])))).map(p=>[p.join(','),p])).values()]])),row={parts:{},layers:{}};rows[id]=row;
 for(let n=1;n<=4;n++){
 const level=await Bun.file('assets/levels/'+prefix+'-0'+n+'.json').json(),speed=PLAY_CONFIG.levels.find(l=>l.id===level.id).waves[0].enemyOverrides[id].speed,rule={...(id==='walker'?WALKER_WALK:id==='spider'?SPIDER_WALK:ENEMY_EXPANSION_MOVEMENT[id]),speed};
 for(const route of levelRoutes(level)){
  const rig=new PoseRig({root:identity(),parts,instances:parts.map(p=>({part:p.id,key:p.id,index:0,matrix:identity()}))},()=>{}),path=new PathMotion(route.path,rule.turnDistance),gait=id==='tripod'?new EnemyExpansionGait(rig,path,24,id,rule):new ArticulatedGait(rig,path,24,id,rule),sample=new Float64Array(3);
  for(let d=0;d<path.length;d+=.5){path.sample(d,sample);gait.pose(d,...sample);rig.root[13]=-rule.crouch;rig.invalidateRoot();rig.update();
   for(const bone of rig.bones){const p=row.parts[bone.part.id]??={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],bottom:Infinity,top:-Infinity};
    for(let i=0;i<3;i++){p.min[i]=Math.min(p.min[i],bone.rotation[i]);p.max[i]=Math.max(p.max[i],bone.rotation[i]);}
    for(const [x,y,z]of points.get(bone.part.id)){const m=bone.instance.matrix,px=m[0]*x+m[4]*y+m[8]*z+m[12],py=m[1]*x+m[5]*y+m[9]*z+m[13],pz=m[2]*x+m[6]*y+m[10]*z+m[14],r=Math.hypot(px-12,pz-12);p.bottom=Math.min(p.bottom,py);p.top=Math.max(p.top,py);const h=Math.floor(py);row.layers[h]=Math.max(row.layers[h]??0,r);}
   }
  }
 }
 }
}
console.log(JSON.stringify(rows,null,2));
