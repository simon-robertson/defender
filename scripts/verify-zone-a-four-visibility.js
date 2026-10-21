import {createHash} from 'node:crypto';
import {Camera} from '../engine/camera.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {validateLevel} from '../shared/level.js';
import {BOX_SIZE} from '../shared/grid.js';
import {ZONE_A_FOUR_SITES} from './zone-a-four.js';

const root=new URL('../',import.meta.url);
const digest=text=>createHash('sha256').update(text).digest('hex');
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);

// Project one exact occupied cuboid along the orthographic sight direction.
// Convex clipping checks the complete clearing, including between ray samples.
function footprint(bounds,offset,ground,slopeX,slopeZ){
  if(bounds[offset+4]<=ground)return [];
  const points=[],lowY=Math.max(ground,bounds[offset+1]);
  for(const x of [bounds[offset],bounds[offset+3]])for(const y of [lowY,bounds[offset+4]])for(const z of [bounds[offset+2],bounds[offset+5]])
    points.push([x-(y-ground)*slopeX,z-(y-ground)*slopeZ]);
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const lower=[],upper=[];
  for(const point of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),point)<=0)lower.pop();lower.push(point);}
  for(let i=points.length-1;i>=0;i--){const point=points[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),point)<=0)upper.pop();upper.push(point);}
  lower.pop();upper.pop();return [...lower,...upper];
}

function clippedArea(polygon,x,z){
  let points=polygon;
  for(const [axis,limit,sign] of [[0,x,1],[0,x+BOX_SIZE,-1],[1,z,1],[1,z+BOX_SIZE,-1]]){
    if(!points.length)return 0;
    const next=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],insideA=(a[axis]-limit)*sign>=0,insideB=(b[axis]-limit)*sign>=0;
      if(insideA)next.push(a);
      if(insideA!==insideB){const t=(limit-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    }
    points=next;
  }
  let area=0;
  // Translate before summing to avoid cancellation from large world positions.
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];area+=(a[0]-x)*(b[1]-z)-(b[0]-x)*(a[1]-z);}
  return Math.abs(area)*.5;
}

// Shared author-time query for later landscape carves. Callers own the level,
// candidate-site list and model library; nothing is mutated or retained.
export function reviewPlacementVisibility(level,candidateSites,models){
  validateLevel(level,models);
  const canvas={clientWidth:960,clientHeight:768,addEventListener(){}},camera=new Camera(canvas,()=>{});
  camera.setLevel(level);camera.update(1.25);
  const direction=[Math.sin(camera.yaw)*Math.cos(camera.pitch),Math.sin(camera.pitch),Math.cos(camera.yaw)*Math.cos(camera.pitch)];
  const slopeX=direction[0]/direction[1],slopeZ=direction[2]/direction[1],ground=level.pathHeight,rayGround=ground+.01;
  const scenery=level.placements.filter(p=>!['defence','enemy'].includes(models.get(p.model).role));
  const terrain=new SceneryVisibility({...level,placements:[]},models);
  const sources=[{id:'terrain',model:null,box:null,visibility:terrain}];
  for(const placement of scenery)sources.push({...placement,visibility:new SceneryVisibility({...level,placements:[placement]},models)});
  const sites=[];
  for(const site of candidateSites){
    const x=site.box[0]*BOX_SIZE,z=site.box[1]*BOX_SIZE,obstructions=[];
    let terrainSamples=0;
    for(const source of sources){
      const visibility=source.visibility;
      let blockedSamples=0,overlappingCuboids=0,maxCuboidOverlapArea=0;
      for(let ix=.5;ix<BOX_SIZE;ix++)for(let iz=.5;iz<BOX_SIZE;iz++){
        const ox=x+ix,oz=z+iz;
        if(visibility.blocked(ox,rayGround,oz,ox+direction[0]*2000,rayGround+direction[1]*2000,oz+direction[2]*2000))blockedSamples++;
      }
      for(let node=0;node<visibility.nodeCount;node++){
        if(visibility.escape[node]!==node+1)continue;
        const area=clippedArea(footprint(visibility.bounds,node*6,ground,slopeX,slopeZ),x,z);
        if(area>1e-8){overlappingCuboids++;maxCuboidOverlapArea=Math.max(maxCuboidOverlapArea,area);}
      }
      if(source.id==='terrain')terrainSamples=blockedSamples;
      if(blockedSamples||overlappingCuboids)obstructions.push({id:source.id,model:source.model,box:source.box,blockedSamples,overlappingCuboids,maxCuboidOverlapArea});
    }
    sites.push({id:site.id,box:site.box,placement:site.placement??null,raySamples:576,terrainBlockedSamples:terrainSamples,clear:obstructions.length===0,obstructions});
  }
  for(const source of sources)source.visibility.dispose();
  return {
    sceneryPlacements:scenery.length,
    camera:{mode:'default framed orthographic overview',yaw:camera.yaw,pitch:camera.pitch,directionTowardCamera:direction,aspect:1.25,target:Array.from(camera.target),radius:camera.radius},
    method:{groundY:ground,rayOriginY:rayGround,clearingSize:[BOX_SIZE,BOX_SIZE],sampleSpacing:1,sampleOffsets:[.5,23.5],samplesPerSite:576,totalSiteSamples:576*sites.length,rayLength:2000,sceneryScope:'Every retained scenery placement, without a distance filter; exact occupied cuboids from SceneryVisibility.',continuousCheck:'Project each occupied cuboid onto the exact ground plane and convex-clip against the full 24x24 ground rectangle. Any overlap area above 1e-8 square world units fails. Ray origins alone use a0.01-unit lift to avoid ground self-contact.',areaTolerance:1e-8},
    limitations:[
      'Checks scenery and terrain only. Existing defences, moving enemies, wildlife and effects are excluded.',
      'Checks the default overview direction and ground footprint; arbitrary camera rotations and hypothetical future model heights are outside this audit.',
      'The ray grid alone is sampled; the separate continuous projected-cuboid check covers unsampled slivers. Zero-area edge tangency is not counted as an obstruction.',
      'This is geometric visibility, not a GPU pixel, contrast, tactical coverage or weapon line-of-sight test. Source geometry and shared visibility transforms must remain consistent.'
    ],
    sites,passed:sites.every(site=>site.clear),
  };
}

export async function reviewZoneAFourVisibility(){
  const sourcePath='assets/levels/moss-04.json',sourceText=await Bun.file(new URL(sourcePath,root)).text(),level=JSON.parse(sourceText);
  const models=new Map(),modelHashes={};
  for(const id of [...new Set(level.placements.map(p=>p.model))].sort()){
    const text=await Bun.file(new URL(`assets/models/${id}.json`,root)).text();models.set(id,JSON.parse(text));modelHashes[id]=digest(text);
  }
  const {sceneryPlacements,...review}=reviewPlacementVisibility(level,ZONE_A_FOUR_SITES,models),dependencies={};
  for(const path of ['scripts/verify-zone-a-four-visibility.js','scripts/zone-a-four.js','engine/camera.js','engine/visibility.js','shared/terrain.js'])
    dependencies[path]=digest(await Bun.file(new URL(path,root)).text());
  return {
    schema:'defender.authoring-visibility-review',version:1,recordedAt:new Date().toISOString(),
    reproduce:'bun scripts/verify-zone-a-four-visibility.js --write',
    source:{path:sourcePath,sha256:digest(sourceText),placements:level.placements.length,sceneryPlacements,models:modelHashes,dependencies},
    ...review,
  };
}

if(import.meta.main){
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--write'))throw new Error('Usage: bun scripts/verify-zone-a-four-visibility.js [--write]');
  const report=await reviewZoneAFourVisibility();
  if(args.includes('--write'))await Bun.write(new URL('docs/zone-a-four-visibility-review.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,placements:report.source.placements,scenery:report.source.sceneryPlacements,sites:report.sites.length,samples:report.method.totalSiteSamples,sourceHash:report.source.sha256,obstructions:report.sites.filter(site=>!site.clear)},null,2));
  if(!report.passed)process.exitCode=1;
}
