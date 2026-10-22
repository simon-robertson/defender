import {validId,VARIANTS,ZONES} from './model.js';
import {validateWaterMaterial} from './water.js';
import {BOX_SIZE} from './grid.js';
import {newTerrain,validateTerrain,TerrainField,placementY,setPathHeight} from './terrain.js';
import {validateRoutes,pathBoxUnion,routePath} from './routes.js';
import {ENEMY_STATS} from './enemy.js';
import {isNonCombatPreview} from './preview-mode.js';
import {validateBridges} from './bridges.js';
export const LEVEL_VERSION=4;
// The existing Zone A daylight, also used when an editor draft first opts into
// fixed environment settings. Lighting is fixed while a level is active.
export const defaultEnvironment=()=>({timeOfDay:10.5,sky:{direction:[-.65,1,-.45],color:'#FFF2D9',intensity:.88,ambient:'#B8C8C1',ambientIntensity:.48}});
export function newLevel(id='untitled-level') {return {schema:'defender.level',version:LEVEL_VERSION,id,name:'Untitled level',zone:'A',size:[12,8],waves:5,placements:[],path:[],pathHeight:BOX_SIZE,terrain:newTerrain()};}
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function validateLevel(level,models=null) {
  check(level?.schema==='defender.level'&&level.version===LEVEL_VERSION,'Unsupported level schema/version.');
  check(validId(level.id),'Invalid level ID.');check(typeof level.name==='string'&&level.name.length>0&&level.name.length<=120,'Level name is required.');
  check(Object.hasOwn(ZONES,level.zone),'Invalid zone.');check(level.waves===5,'Every level must have five waves.');
  check(Array.isArray(level.size)&&level.size.length===2&&level.size.every(n=>int(n,1,128)),'Level width and length must be 1–128 boxes.');
  check(level.previewMode===undefined||['landscape','layout','combat'].includes(level.previewMode),'Invalid preview mode.');
  validateRoutes(level);
  if(level.previewMode==='landscape')check(level.path.length===0&&level.routes===undefined&&level.actorRoutes===undefined,'Landscape previews must have no enemy routes.');
  if(level.previewMode==='layout')check(level.path.length>=2,'Path layout previews require a complete route.');
  if(level.previewMode==='combat'){
    check(level.path.length>=2,'Combat previews require a complete route.');
    check(Array.isArray(level.previewActors)&&level.previewActors.length<=16384,'Combat previews require an explicit bounded actor roster.');
  }else check(level.previewActors===undefined,'Explicit combat actors require combat preview mode.');
  validateTerrain(level);check(int(level.pathHeight,1,256),'Path height must be a whole unit from 1–256.');validateBridges(level);if(level.waterMaterial!==undefined)validateWaterMaterial(level.waterMaterial);const terrain=new TerrainField(level);
  if(level.environment){const e=level.environment,s=e.sky;
    check(Number.isFinite(e.timeOfDay)&&e.timeOfDay>=0&&e.timeOfDay<24,'Time of day must be in [0,24).');
    check(s&&Array.isArray(s.direction)&&s.direction.length===3&&s.direction.every(Number.isFinite)&&s.direction[1]>0,'Sky light direction must point above the horizon.');
    check(/^#[0-9a-f]{6}$/i.test(s.color)&&/^#[0-9a-f]{6}$/i.test(s.ambient),'Invalid sky light colour.');
    check([s.intensity,s.ambientIntensity].every(v=>Number.isFinite(v)&&v>=0&&v<=4),'Light intensity must be in [0,4].');
  }
  check(int(level.pathHeight,1,256),'Path height must be a whole unit from 1–256.');
  check(Array.isArray(level.placements)&&level.placements.length<=16384,'Invalid placement count.');
  const cells=new Set(), ids=new Set();
  for(const p of level.placements) {
    check(validId(p.id)&&!ids.has(p.id),'Duplicate or invalid placement ID.');ids.add(p.id);
    check(validId(p.model)&&VARIANTS.includes(p.variant),'Invalid model reference or variant.');
    check(Array.isArray(p.box)&&p.box.length===3&&int(p.box[0],0,level.size[0]-1)&&int(p.box[1],0,255)&&int(p.box[2],0,level.size[1]-1),'Placement is outside level bounds.');
    check(int(p.turn,0,3),'Placement turn must be 0, 1, 2 or 3 quarter-turns.');
    check(p.anchor===undefined||['terrain','absolute'].includes(p.anchor),'Invalid placement anchor.');
    check(p.kind===undefined||p.kind==='detail','Invalid placement kind.');
    if(p.offset!==undefined)check(p.kind==='detail'&&Array.isArray(p.offset)&&p.offset.length===3&&p.offset.every(n=>int(n,-23,23)),'Only detail props may use integer unit offsets, from -23 to 23.');
    placementY(level,p,terrain);
    const key=p.box.join(',');if(p.kind!=='detail'){check(!cells.has(key),'Two models occupy the same placement box.');cells.add(key);}
    if(models){check(models.has(p.model),`Missing model: ${p.model}.`);
      if(isNonCombatPreview(level))check(models.get(p.model).role==='scenery','Landscape and layout previews only support scenery placements.');
      if(models.get(p.model).role==='defence'){
        check(p.kind!=='detail','Player defences must use box-aligned placements.');
        check(placementY(level,p,terrain)===level.pathHeight&&terrain.flatBox(p.box[0],p.box[2])===level.pathHeight,'Player defences must sit on ground at the enemy path height.');
      }
    }
  }
  for(const actor of level.previewActors??[]){
    check(actor&&validId(actor.id)&&!ids.has(actor.id),'Duplicate or invalid preview actor ID.');ids.add(actor.id);
    check(Object.hasOwn(ENEMY_STATS,actor.modelId)&&actor.variant==='base','Invalid preview enemy model or variant.');
    const path=routePath(level,actor.routeId);
    check(typeof actor.routeId==='string'&&path?.length>=2,'Unknown preview actor route.');
    check(Number.isFinite(actor.startDistance)&&actor.startDistance>=0&&actor.startDistance<(path.length-1)*BOX_SIZE,'Preview actor start must lie on its complete route.');
    if(models)check(models.has(actor.modelId)&&models.get(actor.modelId).role==='enemy','Missing preview enemy model.');
  }
  const pathCells=new Set();
  for(const p of pathBoxUnion(level)){
    check(terrain.supportBox(p[0],p[2])===level.pathHeight,'Enemy path boxes must remain flat and dry at the path height, or have a supported bridge.');
    pathCells.add(p.join(','));
  }
  if(models) {
    // Exact bind-pose cell overlap, including tall models in neighbouring Y boxes.
    const occupied=new Set();
    for(const p of level.placements){const baseY=placementY(level,p,terrain);for(const part of models.get(p.model).variants[p.variant].parts)for(const c of part.voxels) {
      let x=c[0],z=c[2];for(let turn=0;turn<p.turn;turn++){const old=x;x=BOX_SIZE-1-z;z=old;}
      const wx=p.box[0]*BOX_SIZE+x+(p.offset?.[0]??0),wz=p.box[2]*BOX_SIZE+z+(p.offset?.[2]??0),key=`${wx},${baseY+c[1]},${wz}`;
      check(wx>=0&&wz>=0&&wx<level.size[0]*BOX_SIZE&&wz<level.size[1]*BOX_SIZE,'A model extends outside the level.');
      if(p.kind==='detail')check(!pathCells.has(`${Math.floor(wx/BOX_SIZE)},0,${Math.floor(wz/BOX_SIZE)}`),'Detail props must stay clear of the enemy path.');
      check(baseY+c[1]>=terrain.height(wx,wz),'A model intersects the ground.');
      check(!terrain.height(wx,wz,true)||baseY+c[1]>=terrain.height(wx,wz,true),'A model intersects water.');
      check(!terrain.bridgeBox(Math.floor(wx/BOX_SIZE),Math.floor(wz/BOX_SIZE))||baseY+c[1]>=level.pathHeight||baseY+c[1]+1<=level.pathHeight-1,'A model intersects a bridge deck.');
      check(!occupied.has(key),'Models overlap in world space (check tall models on stacked layers).');occupied.add(key);
    }}
  }
  return level;
}
export function upgradeLevel(level) {
  if(level?.schema!=='defender.level'||![1,2,3].includes(level.version))return validateLevel(level);
  // Preserve logical placement coordinates. Ground-anchored legacy models rise
  // onto the new default layer; route elevation becomes explicit world units.
  const next={...structuredClone(level),version:LEVEL_VERSION,terrain:newTerrain(),pathHeight:BOX_SIZE};
  const pathLayer=next.path?.[0]?.[1]??0;
  if(!Array.isArray(next.path)||next.path.some(p=>!Array.isArray(p)||p[1]!==pathLayer))throw new Error('Legacy paths must be flat.');
  next.path=next.path.map(p=>[p[0],0,p[2]]);
  setPathHeight(next,BOX_SIZE+pathLayer*BOX_SIZE);
  return validateLevel(next);
}
