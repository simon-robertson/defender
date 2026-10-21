// Fast comparative range geometry only; the selected option has separate
// production LOS/pitch/contact evidence. No attack or economy tuning is implied.
import {A2_OPTIONS} from './a2-path-carving-options.js';
import {expandCorners} from './level-rebuild-layouts.js';
const out=new URL('../docs/a2-path-carving-2026-10-18/',import.meta.url);
function runs(flags){const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;}
export async function compareA2Options(){
 const rows=[];
 for(const [id,option]of Object.entries(A2_OPTIONS)){
  const path=expandCorners(option.corners),length=(path.length-1)*24,manifest=await Bun.file(new URL(id+'.manifest.json',out)).json(),water=new Set(option.bridges.flatMap(b=>b.boxes.map(p=>p.join(',')))),bridgeDistance=[];
  for(let i=0;i<path.length;i++)if(water.has([path[i][0],path[i][2]].join(',')))bridgeDistance.push(i*24);
  const deckInterval=[Math.min(...bridgeDistance)-12,Math.max(...bridgeDistance)+12];
  const ranges={};
  for(const range of [48,72]){
   const union=new Uint8Array(length),siteRows=[];
   for(const site of option.sites){const flags=new Uint8Array(length);for(let d=0;d<length;d++){const segment=Math.floor((d+.5)/24),f=((d+.5)%24)/24,a=path[segment],b=path[segment+1],x=(a[0]+f*(b[0]-a[0]))*24,z=(a[2]+f*(b[2]-a[2]))*24;if(Math.hypot(x-site.box[0]*24,z-site.box[1]*24)<=range){flags[d]=1;union[d]=1;}}siteRows.push({id:site.id,box:site.box,intervals:runs(flags)});}
   const uncovered=runs(Uint8Array.from(union,(v,d)=>Number(!v&&d>=deckInterval[0]&&d<deckInterval[1])));
   ranges[range]={bridgeUncovered:uncovered,totalUncoveredBridgeUnits:uncovered.reduce((s,[a,b])=>s+b-a,0),sites:siteRows};
  }
  rows.push({id,routeLength:length,deckInterval,bridgeBoxes:water.size,candidateBoxes:option.sites.length,retainedScenery:manifest.retainedPlacements,removedRuins:manifest.removed.filter(p=>p.model.includes('ruin')).map(p=>p.id),ranges});
 }
 return {method:'Inclusive horizontal centre-range geometry,1-unit route midpoint bins, union across independent hypothetical dry-ground candidates. This does not imply simultaneous placement or actual LOS/pitch. Bridge interval includes full tile extents; endpoint path centres define route distance.',rows};
}
if(import.meta.main){const report=await compareA2Options();await Bun.write(new URL('comparison.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.rows.map(r=>({id:r.id,length:r.routeLength,deck:r.deckInterval,sites:r.candidateBoxes,retained:r.retainedScenery,gaps:Object.fromEntries(Object.entries(r.ranges).map(([range,v])=>[range,v.bridgeUncovered]))})),null,2));}
