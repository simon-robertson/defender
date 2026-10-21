// Compact interpretation of the production per-species interval evidence.
const out=new URL('../docs/a2-path-carving-2026-10-18/',import.meta.url);
const span=windows=>windows.reduce((sum,[a,b])=>sum+b-a,0);
function runs(flags){const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;}
export async function summarizeA2Coverage(){
 const audit=await Bun.file(new URL('garden-crossing.audit.json',out)).json(),length=984,bridge=[516,660],rows=[];
 for(const row of audit.geometry.coverage){
  const gun=row.routes.main.eligible,arc=audit.arc.find(a=>a.id===row.id).variants;
  rows.push({id:row.id,box:row.box,group:row.group,baseUseful:['dog','roller','moth'].every(type=>span(gun.base[type])>0&&span(arc.base.surfaceContact[type])>0),gun,arc:Object.fromEntries(Object.entries(arc).map(([variant,value])=>[variant,value.surfaceContact])),totals:Object.fromEntries(['base','upgrade1'].map(variant=>[variant,{gun:Object.fromEntries(['dog','roller','moth'].map(type=>[type,span(gun[variant][type])])),arc:Object.fromEntries(['dog','roller','moth'].map(type=>[type,span(arc[variant].surfaceContact[type])]))}]))});
 }
 const union=[];
 for(const weapon of ['gun','arc'])for(const variant of ['base','upgrade1'])for(const species of ['dog','roller','moth']){
  const flags=new Uint8Array(length);for(const row of rows)for(const [a,b]of row[weapon][variant][species])flags.fill(1,a,b);
  const uncovered=runs(Uint8Array.from(flags,(v,d)=>Number(!v&&d>=bridge[0]&&d<bridge[1])));
  union.push({weapon,variant,species,eligible:runs(flags),bridgeUncovered:uncovered,bridgeUncoveredUnits:span(uncovered)});
 }
 return {sourceHash:audit.sourceHash,routeLength:length,bridgeInterval:bridge,method:'Actual production eligibility/contact at 1-unit midpoint bins. Independent hypothetical-site union is a reachability comparison, not a simultaneous-placement or damage claim.',baseUsefulCount:rows.filter(r=>r.baseUseful).length,upgradeDependentCount:rows.filter(r=>!r.baseUseful).length,sites:rows,union};
}
if(import.meta.main){const report=await summarizeA2Coverage();await Bun.write(new URL('coverage.json',out),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baseUseful:report.baseUsefulCount,upgradeDependent:report.upgradeDependentCount,union:report.union},null,2));}
