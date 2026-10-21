const out=new URL('../docs/a4-path-carving-2026-10-18/',import.meta.url);
const span=windows=>windows.reduce((sum,[a,b])=>sum+b-a,0);
function intervals(flags){const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;}
export async function summarizeA4Coverage(){
 const audit=await Bun.file(new URL('ruin-and-mere-tour.audit.json',out)).json(),sites=[],classification={},clearance=await Bun.file(new URL('ruin-and-mere-tour.clearance.json',out)).json();
 for(const row of audit.geometry.coverage){
  const arc=audit.arc.find(a=>a.id===row.id).routes,routes={};
  for(const [routeId,data]of Object.entries(row.routes)){const gun=data.eligible;routes[routeId]={length:data.length,gun,arc:Object.fromEntries(Object.entries(arc[routeId].variants).map(([variant,v])=>[variant,v.surfaceContact])),totals:Object.fromEntries(['base','upgrade1'].map(variant=>[variant,{gun:Object.fromEntries(['dog','roller','moth'].map(type=>[type,span(gun[variant][type])])),arc:Object.fromEntries(['dog','roller','moth'].map(type=>[type,span(arc[routeId].variants[variant].surfaceContact[type])]))}]))};}
  const reached=Object.entries(routes).filter(([,r])=>['dog','roller','moth'].every(type=>span(r.gun.base[type])>0&&span(r.arc.base[type])>0)).map(([id])=>id),role=reached.join('+')||'upgrade-dependent';classification[role]=(classification[role]??0)+1;sites.push({id:row.id,box:row.box,group:row.group,baseUseful:reached.length>0,coverageRole:role,routes});
 }
 const independentSiteUnion=[];
 for(const route of Object.keys(sites[0].routes))for(const weapon of ['gun','arc'])for(const variant of ['base','upgrade1'])for(const species of ['dog','roller','moth']){
  const flags=new Uint8Array(sites[0].routes[route].length);for(const site of sites)if(!clearance.excluded.some(e=>e.site===site.id&&e.model===(weapon==='gun'?'turret-study':'arc-spire')&&e.variant===variant))for(const [a,b]of site.routes[route][weapon][variant][species])flags.fill(1,a,b);
  independentSiteUnion.push({route,weapon,variant,species,eligible:intervals(flags),uncovered:intervals(Uint8Array.from(flags,v=>Number(!v)))});
 }
 return {sourceHash:audit.sourceHash,excluded:clearance.excluded,method:'Independent-site unions omit declared weapon/variant exclusions. Actual production gun eligibility and Arc surface contact at one-unit midpoint bins, per species and complete approach. Base classification requires positive opportunity with both weapons against all three species. Intervals are journey distances on the single route; do not add overlapping coverage as unique damage.',classification,baseUsefulCount:sites.filter(s=>s.baseUseful).length,independentSiteUnion,sites};
}
if(import.meta.main){const report=await summarizeA4Coverage();await Bun.write(new URL('coverage.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseUseful:report.baseUsefulCount,classification:report.classification}));}
