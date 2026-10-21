import {D_OPTIONS,D_OUT,readDBaseline} from './d-path-carving-options.js';
import {levelRoutes,pathBoxUnion} from '../shared/routes.js';

const windows=flags=>{const result=[];let start=-1;for(let i=0;i<=flags.length;i++){if(flags[i]&&start<0)start=i;if(!flags[i]&&start>=0){result.push([start,i]);start=-1;}}return result;};
const span=runs=>runs.reduce((sum,[a,b])=>sum+b-a,0);
export function extraPavedJoins(level){
 const key=([x,,z])=>`${x},${z}`,edges=new Set(),cells=new Set(pathBoxUnion(level).map(key));
 const edge=(a,b)=>[a,b].sort().join('|');
 for(const {path}of levelRoutes(level))for(let i=1;i<path.length;i++)edges.add(edge(key(path[i-1]),key(path[i])));
 const result=[];for(const cell of cells){const [x,z]=cell.split(',').map(Number);for(const next of [`${x+1},${z}`,`${x},${z+1}`])if(cells.has(next)&&!edges.has(edge(cell,next)))result.push([cell,next]);}return result;
}
export async function compareDOptions(){
 const options=[];
 for(const [id,option]of Object.entries(D_OPTIONS)){
  const level=await Bun.file(new URL('zone-d-'+id+'.level.json',D_OUT)).json(),manifest=await Bun.file(new URL('zone-d-'+id+'.manifest.json',D_OUT)).json(),routes=levelRoutes(level),sites=[];
  for(const site of manifest.sites){const coverage={};for(const route of routes){const path=route.path,length=(path.length-1)*24;coverage[route.id]={};for(const range of [48,72,96,120]){const flags=new Uint8Array(length);for(let d=0;d<length;d++){const segment=Math.floor((d+.5)/24),f=((d+.5)%24)/24,a=path[segment],b=path[segment+1],x=(a[0]+f*(b[0]-a[0]))*24,z=(a[2]+f*(b[2]-a[2]))*24;if(Math.hypot(x-site.box[0]*24,z-site.box[1]*24)<=range)flags[d]=1;}coverage[route.id][range]=windows(flags);}}sites.push({...site,coverage});}
  const classification={};for(const s of sites){const key=routes.filter(r=>span(s.coverage[r.id][48])>0).map(r=>r.id).join('+')||'upgrade-only';classification[key]=(classification[key]??0)+1;}
  const repeat=sites.flatMap(s=>routes.flatMap(r=>{const w=s.coverage[r.id][48];return w.length>1?[{id:s.id,box:s.box,route:r.id,windows:w,gaps:w.slice(1).map((v,i)=>v[0]-w[i][1]),total:span(w)}]:[];})).sort((a,b)=>b.total-a.total);
  options.push({id,level:level.id,title:option.title,rationale:option.rationale,routes:manifest.routes,candidateCount:sites.length,baseRangeRouteClassification:classification,strongestRepeatedExamples:repeat.slice(0,8),retainedScenery:manifest.retainedPlacements,baselineScenery:manifest.baselinePlacements,removedWalls:manifest.removed.filter(p=>p.model==='plum-wall').map(p=>p.id),rejectedSites:manifest.rejectedSites,extraPavedJoins:extraPavedJoins(level),bridges:option.bridges,sites});
 }
 return {method:'Ideal horizontal centre-range only, one-unit midpoint bins; gun/Arc48/72, inactive gun96 and silo72/96/120. Separate production geometry/LOS/pitch/contact/flight reports govern selected designs. Each plot is an independent alternative; overlapping route intervals are not additive damage.',options};
}
const xml=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const palette=['#E9B969','#A6C6B6','#B8A9D5','#D9A5A2','#C6CF85','#88B3CE','#E8CEB2'];
export async function drawDOption(id){
 const option=D_OPTIONS[id],baseline=await readDBaseline(option.level),level=await Bun.file(new URL('zone-d-'+id+'.level.json',D_OUT)).json(),manifest=await Bun.file(new URL('zone-d-'+id+'.manifest.json',D_OUT)).json(),kept=new Set(level.placements.map(p=>p.id)),groups=[...new Set(manifest.sites.map(s=>s.group))],colors=Object.fromEntries(groups.map((g,i)=>[g,palette[i%palette.length]])),parts=[];
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="710" viewBox="0 0 1320 710"><rect width="1320" height="710" fill="#252721"/><style>text{font-family:system-ui,sans-serif;fill:#F0EDE4}.small{font-size:12px}</style><text x="35" y="36" font-size="24" font-weight="700">${xml(option.title)} — ${option.level}</text><text x="35" y="62" font-size="13">${manifest.routes.map(r=>r.id+': '+r.length).join(' / ')} world units · ${manifest.sites.length} surveyed full plots · ${level.placements.length}/${baseline.placements.length} scenery retained · terrain and water unchanged</text>`);
 for(let panel=0;panel<2;panel++){
  parts.push(`<g transform="translate(${35+panel*650},112)"><text x="0" y="-24" font-size="15">${panel?'Carve + full surveyed ground':'Route over untouched landscape'}</text><rect width="600" height="480" fill="#9A9394"/>`);
  for(const b of baseline.terrain.boxes)parts.push(`<rect x="${b.box[0]*30}" y="${b.box[1]*30}" width="30" height="30" fill="${b.water>0?'#6B9691':b.ground>30?'#746A79':'#88808A'}"/>`);
  if(panel)for(const s of manifest.sites)parts.push(`<rect x="${s.box[0]*30}" y="${s.box[1]*30}" width="30" height="30" fill="${colors[s.group]}" fill-opacity=".88" stroke="#F6E8CA" stroke-width=".8"><title>${xml(s.id)} [${s.box}]</title></rect>`);
  for(let z=0;z<=16;z++)parts.push(`<path d="M 0,${z*30} H 600" stroke="#69553A" stroke-opacity=".2"/>`);for(let x=0;x<=20;x++)parts.push(`<path d="M ${x*30},0 V 480" stroke="#69553A" stroke-opacity=".2"/>`);
  for(const p of baseline.placements)if(!panel||kept.has(p.id)){const x=p.box[0]*30+15,z=p.box[2]*30+15,wall=p.model.includes('wall'),mesa=p.model.includes('mesa'),cactus=p.model.includes('tree'),r=cactus?(p.model.includes('young')?5:8):mesa?(p.model.includes('low')?8:11):p.model.includes('rock')?6:p.model.includes('shrub')?4:2;parts.push(wall?`<rect x="${x-11}" y="${z-4}" width="22" height="8" fill="#D8C9A4"/>`:mesa?`<rect x="${x-r}" y="${z-r}" width="${r*2}" height="${r*2}" fill="#8D6047"/>`:`<circle cx="${x}" cy="${z}" r="${r}" fill="${cactus?'#655376':p.model.includes('rock')?'#9D8060':'#887E4D'}"/>`);}
  for(const [i,r]of levelRoutes(level).entries()){const points=r.path.map(([x,,z])=>`${x*30+15},${z*30+15}`).join(' ');parts.push(`<polyline points="${points}" fill="none" stroke="#5A594A" stroke-width="26" stroke-linejoin="miter"/><polyline points="${points}" fill="none" stroke="${i?'#D8E0D3':'#D9CDB0'}" stroke-width="23" stroke-linejoin="miter"/>`);}
  for(const b of option.bridges)for(const [x,z]of b.boxes){parts.push(`<rect x="${x*30}" y="${z*30}" width="30" height="30" fill="#98704A"/>`);for(let n=3;n<30;n+=6)parts.push(`<path d="M ${x*30},${z*30+n} H ${x*30+30}" stroke="#66472F" stroke-width="1.2"/>`);}
  for(const [i,r]of levelRoutes(level).entries()){const points=r.path.map(([x,,z])=>`${x*30+15},${z*30+15}`).join(' ');parts.push(`<polyline points="${points}" fill="none" stroke="${i?'#487D99':'#B15D45'}" stroke-width="2" stroke-dasharray="6 5"/>`);for(const [j,p]of [r.path[0],r.path.at(-1)].entries())parts.push(`<circle cx="${p[0]*30+15}" cy="${p[2]*30+15}" r="9" fill="${j?'#A8493C':'#367C58'}"/><text x="${p[0]*30+15}" y="${p[2]*30+19}" font-size="10" text-anchor="middle">${j?'X':i?'E':'W'}</text>`);}
  for(const p of baseline.previewWildlife.perches){const found=baseline.placements.find(q=>q.id===p.id);parts.push(`<path d="M ${found.box[0]*30+9},${found.box[2]*30+6} l 6,-6 l 6,6 l -6,6 Z" fill="#F4D663" stroke="#574D2D"/>`);}
  for(let x=0;x<20;x++)parts.push(`<text class="small" x="${x*30+15}" y="-5" text-anchor="middle">${x}</text>`);for(let z=0;z<16;z++)parts.push(`<text class="small" x="-8" y="${z*30+19}" text-anchor="end">${z}</text>`);parts.push('</g>');
 }
 let x=35;for(const group of groups){parts.push(`<rect x="${x}" y="624" width="13" height="13" fill="${colors[group]}"/><text x="${x+18}" y="636" font-size="12">${xml(group)}</text>`);x+=group.length*6.5+46;}
 parts.push('<text x="35" y="677" font-size="12">Same scale in both panels. Yellow diamonds: original supported bird perches retained. Full plots are independently surveyed alternatives, not fixed build pads or simultaneous compatibility claims.</text></svg>');
 await Bun.write(new URL('zone-d-'+id+'.svg',D_OUT),parts.join('\n'));
}
if(import.meta.main){const report=await compareDOptions();await Bun.write(new URL('zone-d-comparison.json',D_OUT),JSON.stringify(report,null,2)+'\n');for(const id of Object.keys(D_OPTIONS))await drawDOption(id);console.log(JSON.stringify(report.options.map(({sites,strongestRepeatedExamples,rejectedSites,...row})=>row),null,2));}
