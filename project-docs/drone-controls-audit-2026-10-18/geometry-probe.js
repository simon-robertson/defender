// Independent occupied-corner audit, not an implementation-shaped test.
import {newLevel} from '../../shared/level.js';
import {buildWorld,disposeWorld} from '../../engine/world.js';
import {PoseRig} from '../../engine/rig.js';
import {DRONE_MODEL as M,DRONE_ROTORS,DRONE_HULL} from '../../shared/drone-model.js';
const model=await Bun.file(new URL('../../assets/models/drone-defence.json',import.meta.url)).json(),results=[];
for(const variant of ['base','upgrade1','upgrade2']){
 const result={variant,poses:0,corners:0,maxHorizontalRadius:0,lowest:Infinity,highest:-Infinity,violations:0,firstViolation:null},level=newLevel('independent-corner-audit');level.placements=[{id:'drone',model:model.id,variant,box:[4,0,4],turn:0}];
 const world=buildWorld(level,new Map([[model.id,model]])),rig=new PoseRig(world.rigs.get('drone'),()=>{}),data=world.rigs.get('drone'),corners=data.parts.filter(p=>p.id!==M.pad).map(p=>({id:p.id,points:p.voxels.flatMap(c=>Array.from({length:8},(_,i)=>[c[0]+(i&1?1:0),c[1]+(i&2?1:0),c[2]+(i&4?1:0)])),matrix:rig.byId.get(p.id).instance.matrix}));
 for(let heading=0;heading<8;heading++)for(let direction=0;direction<16;direction++)for(const yaw of [M.gunYawMin,0,M.gunYawMax])for(const pitch of [M.gunPitchMin,0,M.gunPitchMax]){
  rig.setRotation(M.body,0,heading*Math.PI/4,0);rig.setTranslation(M.body,0,24,0);rig.setRotation(M.gunYaw,0,yaw,0);rig.setRotation(M.gunPitch,pitch,0,0);
  for(let i=0;i<DRONE_ROTORS.length;i++){const rotor=DRONE_ROTORS[i],angle=direction*Math.PI/4+(direction>=8?i*Math.PI/2:0);rig.setRotation(rotor.gimbal,Math.cos(angle)*M.fanTiltMax,0,Math.sin(angle)*M.fanTiltMax);rig.setRotation(rotor.id,0,(direction*.173+heading*.31)*rotor.spin,0);}rig.update();result.poses++;
  const body=rig.byId.get(M.body).instance.matrix,cx=body[0]*12+body[4]*9+body[8]*12+body[12],cy=body[1]*12+body[5]*9+body[9]*12+body[13],cz=body[2]*12+body[6]*9+body[10]*12+body[14],above=DRONE_HULL.variantAbove[variant];
  for(const part of corners){const m=part.matrix;for(const p of part.points){const x=m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12]-cx,y=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13]-cy,z=m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]-cz,r=Math.hypot(x,z);result.corners++;result.maxHorizontalRadius=Math.max(result.maxHorizontalRadius,r);result.lowest=Math.min(result.lowest,y);result.highest=Math.max(result.highest,y);if(r>DRONE_HULL.radius+1e-4||y < -DRONE_HULL.below-1e-4||y>above+1e-4){result.violations++;result.firstViolation??={part:part.id,heading,direction,yaw,pitch,point:p,relative:[x,y,z]};}}}
 }
 disposeWorld(world);results.push(result);
}
const report={date:'2026-10-18',method:'Actual occupied-cell corners transformed through production PoseRig for8aircraft headings,16collective/differential fan patterns at20degrees,9gun yaw/pitch endpoint combinations and all3variants. Rotor phases vary across poses. Finite transform audit complements continuous geometry proof; it does not certify arbitrary intermediate compound angles by sampling alone.',hull:DRONE_HULL,results};
await Bun.write(new URL('./geometry.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
