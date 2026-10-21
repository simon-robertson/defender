import {validateLevel} from '../../shared/level.js';
import {validateModel} from '../../shared/model.js';
import {TerrainField,placementY} from '../../shared/terrain.js';
import {SceneryVisibility} from '../../engine/visibility.js';
import {landscapeFor,LANDSCAPE_INFO,snapshotText,sha256} from './index.js';

const root=new URL('../../',import.meta.url),modelCache=new Map();
async function modelFor(id){if(!modelCache.has(id)){const model=await Bun.file(new URL(`assets/models/${id}.json`,root)).json();validateModel(model);modelCache.set(id,model);}return modelCache.get(id);}
const key=(x,z)=>`${x},${z}`;
function clearBox(visibility,a){
 for(let n=0;n<visibility.nodeCount;){const b=visibility.bounds,o=n*6;
  if(a[0]<b[o+3]-1e-6&&a[3]>b[o]+1e-6&&a[1]<b[o+4]-1e-6&&a[4]>b[o+1]+1e-6&&a[2]<b[o+5]-1e-6&&a[5]>b[o+2]+1e-6){if(visibility.escape[n]===n+1)return false;n++;}else n=visibility.escape[n];
 }return true;
}
function soleSupported(model,point,bird){
 const occupied=new Set(model.variants.base.parts.flatMap(p=>p.voxels.map(c=>c.slice(0,3).join(','))));
 for(const part of bird.variants.base.parts)for(const [x,y,z]of part.voxels)if(y===0)
  for(let ix=Math.floor(point[0]+x-12+1e-6);ix<Math.ceil(point[0]+x-11-1e-6);ix++)
   for(let iz=Math.floor(point[2]+z-12+1e-6);iz<Math.ceil(point[2]+z-11-1e-6);iz++)
    if(!occupied.has(`${ix},${point[1]-1},${iz}`))return false;
 return true;
}

export async function validateLandscape(info,level=landscapeFor(info.zone,info.number)){
 const models=new Map();for(const id of new Set(level.placements.map(p=>p.model))){const model=await modelFor(id);if(model.role!=='scenery'||id.startsWith('wildlife-')||model.materials.some(m=>m.emission!==0||m.reflectiveness!==0))throw new Error(`Unapproved baseline model/material ${id}`);models.set(id,model);}
 validateLevel(level,models);
 if(level.path.length||level.environment.weather.enabled)throw new Error('Baseline must have no route and weather must default off.');
 if(sha256(snapshotText(level))!==info.sha256)throw new Error('Canonical landscape mismatch.');
 const fresh=landscapeFor(info.zone,info.number);
 if(fresh===level||fresh.placements===level.placements||fresh.terrain===level.terrain||fresh.placements[0]===level.placements[0]||snapshotText(fresh)!==snapshotText(level))throw new Error('Landscape factory must return independent, identical data.');
 const field=new TerrainField(level),flat=new Set(),coverage=new Set(level.placements.map(p=>key(p.box[0],p.box[2]))),terrain={flatDry:0,raisedDry:0,water:0};
 for(let z=0;z<level.size[1];z++)for(let x=0;x<level.size[0];x++){
  const h=field.flatBox(x,z);terrain[h===null?'water':h===24?'flatDry':'raisedDry']++;
  if(h===24)flat.add(key(x,z));
  if(h!==null&&!coverage.has(key(x,z)))throw new Error(`Unpopulated dry box ${x},${z}.`);
 }
 const pending=[[...flat][0]],visited=new Set();
 while(pending.length){const current=pending.pop();if(visited.has(current))continue;visited.add(current);const [x,z]=current.split(',').map(Number);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const next=key(x+dx,z+dz);if(flat.has(next)&&!visited.has(next))pending.push(next);}}
 if(visited.size!==flat.size||flat.size<level.size[0]*level.size[1]*.65)throw new Error('Landscape needs broad, connected Y24 dry ground.');
 const bird=await modelFor(`wildlife-bird-${info.id.split('-')[0]}`),visibility=new SceneryVisibility(level,models),perches=[];
 for(const candidate of info.perchCandidates){
  const placement=level.placements.find(p=>p.id===candidate.id);if(!placement||placement.model!==candidate.model)throw new Error('Missing perch anchor.');
  if(!soleSupported(models.get(placement.model),candidate.point,bird))throw new Error(`Unsupported perch ${candidate.id}.`);
  let [x,y,z]=candidate.point;for(let q=0;q<placement.turn;q++){const next=24-z;z=x;x=next;}
  x+=placement.box[0]*24;y+=placementY(level,placement,field);z+=placement.box[2]*24;
  if(!clearBox(visibility,[x-6,y,z-6,x+6,y+8,z+6]))throw new Error(`Obstructed bird envelope ${candidate.id}.`);
  perches.push({...candidate,worldPoint:[x,y,z],footSupport:true,clearEnvelope:{radius:6,height:8}});
 }
 const clearGround=[];
 for(let z=2;z<level.size[1]*24;z+=4)for(let x=2;x<level.size[0]*24;x+=4){
  const a=[x-6,24,z-6,x+6,35,z+6];if(a[0]<0||a[2]<0||a[3]>level.size[0]*24||a[5]>level.size[1]*24)continue;
  let dry=true;for(let bz=Math.floor(a[2]/24);bz<=Math.floor((a[5]-1e-6)/24);bz++)for(let bx=Math.floor(a[0]/24);bx<=Math.floor((a[3]-1e-6)/24);bx++)if(field.flatBox(bx,bz)!==24)dry=false;
  if(dry&&clearBox(visibility,a))clearGround.push([x,24,z]);
 }
 if(clearGround.length<100)throw new Error('Insufficient dry cosmetic habitat.');
 const habitatCandidates=[];
 for(let i=0;i<3;i++){let best=null,score=-1;for(const point of clearGround){const distance=habitatCandidates.length?Math.min(...habitatCandidates.map(p=>Math.hypot(point[0]-p[0],point[2]-p[2]))):Math.hypot(point[0]-level.size[0]*8,point[2]-level.size[1]*8);if(distance>score){score=distance;best=point;}}habitatCandidates.push(best);}
 visibility.dispose();
 return {id:info.id,sha256:info.sha256,size:level.size,placements:level.placements.length,pathBoxes:0,models:models.size,modelCounts:Object.fromEntries([...models.keys()].sort().map(id=>[id,level.placements.filter(p=>p.model===id).length])),terrain,connectedFlatDry:visited.size,allDryBoxesPopulated:true,perches,habitat:{sampleSpacing:4,clearRadius:6,clearHeight:11,clearGroundSamples:clearGround.length,candidateWorldPoints:habitatCandidates,limitation:'Available baseline ground samples, not reserved habitats or a guarantee after tactical carving.'}};
}

if(import.meta.main){
 const args=process.argv.slice(2),zone=args.find(arg=>/^[ABCD]$/.test(arg));
 if(!zone||args.some(arg=>!['A','B','C','D','--check','--write'].includes(arg)))throw new Error('Usage: bun scripts/landscapes/build.js A|B|C|D [--check|--write]');
 const infos=Object.values(LANDSCAPE_INFO).filter(info=>info.zone===zone),reports=[];
 for(const info of infos){
  const level=landscapeFor(zone,info.number),report=await validateLandscape(info,level),target=Bun.file(new URL(info.snapshot,root));
  if(args.includes('--check')){if(sha256(await target.text())!==info.sha256)throw new Error(`Snapshot differs: ${info.snapshot}`);}
  else if(!await target.exists()||args.includes('--write'))await Bun.write(target,snapshotText(level));
  else if(sha256(await target.text())!==info.sha256)throw new Error(`Existing snapshot differs; use explicit --write: ${info.snapshot}`);
  if(info.originalSnapshot&&sha256(await Bun.file(new URL(info.originalSnapshot,root)).text())!==info.sha256)throw new Error('Accepted A4 baseline changed.');
  reports.push(report);console.log(JSON.stringify({id:info.id,placements:report.placements,terrain:report.terrain,perches:report.perches.length,clearGroundSamples:report.habitat.clearGroundSamples,sha256:info.sha256}));
 }
 if(!args.includes('--check')){
  await Bun.write(new URL(`docs/landscapes/${zone.toLowerCase()}-metadata.json`,root),JSON.stringify({zone,scope:'Frozen path-free landscape baseline; no route or defence reservations.',levels:infos},null,2)+'\n');
  await Bun.write(new URL(`docs/landscapes/${zone.toLowerCase()}-validation.json`,root),JSON.stringify({zone,command:`bun scripts/landscapes/build.js ${zone} --check`,checks:['Existing approved scenery only; all materials matte and nonemissive.','validateLevel checks actual source cells: no overlaps, world/terrain/water intersections.','Canonical factory/source hash and independent fresh objects.','Every dry box populated; all Y24 ground connected and at least65% of total boxes.','Three supported bird perches with a clear6-unit-radius/8-unit-high envelope.','Dry ground habitat samples with a clear6-unit-radius/11-unit-high envelope.'],levels:reports},null,2)+'\n');
 }
}
