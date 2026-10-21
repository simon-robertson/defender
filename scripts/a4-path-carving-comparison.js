// Comparative reach only. Selected-option production LOS/pitch/flight evidence
// is separate; independent alternatives are not simultaneous placements.
import {A4_OPTIONS} from './a4-path-carving-options.js';
import {levelRoutes} from '../shared/routes.js';
const out=new URL('../docs/a4-path-carving-2026-10-18/',import.meta.url);
const span=windows=>windows.reduce((sum,[a,b])=>sum+b-a,0);
function runs(flags){const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;}
export async function compareA4Options(){
 const options=[];
 for(const [id,option]of Object.entries(A4_OPTIONS)){
  const level=await Bun.file(new URL(id+'.level.json',out)).json(),manifest=await Bun.file(new URL(id+'.manifest.json',out)).json(),routes=levelRoutes(level),sites=[];
  for(const site of option.sites){const coverage={};for(const route of routes){const path=route.path,length=(path.length-1)*24;coverage[route.id]={};for(const range of [48,72,96,120]){const flags=new Uint8Array(length);for(let d=0;d<length;d++){const segment=Math.floor((d+.5)/24),f=((d+.5)%24)/24,a=path[segment],b=path[segment+1],x=(a[0]+f*(b[0]-a[0]))*24,z=(a[2]+f*(b[2]-a[2]))*24;if(Math.hypot(x-site.box[0]*24,z-site.box[1]*24)<=range)flags[d]=1;}coverage[route.id][range]=runs(flags);}}sites.push({...site,coverage});}
  const classification={};for(const site of sites){const reached=routes.filter(r=>span(site.coverage[r.id][48])>0).map(r=>r.id),key=reached.join('+')||'upgrade-only';classification[key]=(classification[key]??0)+1;}
  const bridge=level.bridges?.[0],bridgeRouteIntervals={};for(const route of routes){const indices=route.path.flatMap(([x,,z],i)=>bridge?.boxes.some(b=>b[0]===x&&b[1]===z)?[i]:[]);if(indices.length)bridgeRouteIntervals[route.id]=[Math.min(...indices)*24-12,Math.max(...indices)*24+12];}
  options.push({id,rationale:option.rationale,routes:routes.map(r=>({id:r.id,length:(r.path.length-1)*24})),candidateCount:sites.length,baseRangeRouteClassification:classification,retainedScenery:manifest.retainedPlacements,removedRuins:manifest.removed.filter(p=>p.model.includes('ruin')).map(p=>p.id),bridge:bridge?.boxes??[],bridgeRouteIntervals,sites});
 }
 return {method:'Inclusive horizontal centre-range geometry, one-unit midpoint bins, current gun/Arc ranges48/72 and silo ranges72/96/120. Range96 gun is inactive. No LOS/pitch/flight/guaranteed-damage claim; complete routes are measured independently, including the common tail.',options};
}
if(import.meta.main){const report=await compareA4Options();await Bun.write(new URL('comparison.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.options.map(({sites,...row})=>row),null,2));}
