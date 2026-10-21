import {A2_OPTIONS,readA2Baseline} from './a2-path-carving-options.js';
import {expandCorners} from './level-rebuild-layouts.js';
const root=new URL('../',import.meta.url),out=new URL('docs/a2-path-carving-2026-10-18/',root);
const xml=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const colors={'westReturn':'#91C7BC','garden':'#B8A0DB','eastLanding':'#D8B2D1','southCourt':'#B8CE75','westCourt':'#91C7BC','approach':'#B8A0DB','eastBank':'#D8B2D1','entry':'#E6AF62','ruin-meadow':'#91C7BC','east-shoulder':'#B8A0DB','south-return':'#D8B2D1','late':'#B8CE75','north':'#E6AF62','west-return':'#91C7BC','central':'#B8A0DB','east-return':'#D8B2D1','west':'#E6AF62','south':'#91C7BC','north-return':'#B8A0DB'};
function scenery(p,removed){const x=p.box[0]*30+15,z=p.box[2]*30+15,c=removed?'#D9BCB4':p.model.includes('ruin')?'#D7CEAF':p.model.includes('rock')?'#90948B':'#395947',opacity=removed?.32:.9;let shape;
 if(p.model.includes('oak'))shape=`<circle cx="${x}" cy="${z}" r="${p.model.includes('tall')?11:p.model.includes('young')?7:10}"/>`;
 else if(p.model.includes('cypress'))shape=`<path d="M ${x},${z-11} L ${x+6},${z+9} L ${x-6},${z+9} Z"/>`;
 else if(p.model.includes('ruin'))shape=`<rect x="${x-11}" y="${z-4}" width="22" height="8"/>`;
 else if(p.model.includes('rock'))shape=`<path d="M ${x-8},${z+6} L ${x-6},${z-5} L ${x+4},${z-8} L ${x+9},${z+5} Z"/>`;
 else if(p.model.includes('shrub'))shape=`<circle cx="${x}" cy="${z}" r="5"/>`;
 else shape=`<circle cx="${x}" cy="${z}" r="2"/>`;
 return `<g fill="${c}" opacity="${opacity}">${shape}</g>`;
}
export async function drawA2Option(id){
 const baseline=await readA2Baseline(),option=A2_OPTIONS[id],level=await Bun.file(new URL(`${id}.level.json`,out)).json(),manifest=await Bun.file(new URL(`${id}.manifest.json`,out)).json(),kept=new Set(level.placements.map(p=>p.id)),path=expandCorners(option.corners),parts=[];
 parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="1320" height="700" viewBox="0 0 1320 700"><rect width="1320" height="700" fill="#18231E"/><style>text{font-family:system-ui,sans-serif;fill:#EEEFE8} .small{font-size:12px}</style><text x="35" y="36" font-size="24" font-weight="700">${xml(option.title)} — A2 route comparison</text><text x="35" y="61" font-size="13">${manifest.routeLength} world units · ${option.sites.length} full candidate boxes · ${level.placements.length}/258 scenery retained · no terrain changes</text>`);
 for(let panel=0;panel<2;panel++){
  parts.push(`<g transform="translate(${35+panel*650},110)"><text x="0" y="-22" font-size="15">${panel?'Proposed carve + full candidate ground':'Same route over the untouched garden'}</text><rect width="600" height="480" fill="#70836A"/>`);
  for(const b of baseline.terrain.boxes)parts.push(`<rect x="${b.box[0]*30}" y="${b.box[1]*30}" width="30" height="30" fill="${b.water>0?'#4B91A3':'#4F6C4D'}"/>`);
  if(panel)for(const s of option.sites)parts.push(`<rect x="${s.box[0]*30}" y="${s.box[1]*30}" width="30" height="30" fill="${colors[s.group]}" fill-opacity=".82" stroke="#E9E8D5" stroke-width=".7"><title>${xml(s.id)} [${s.box}]</title></rect>`);
  for(let z=0;z<=16;z++)parts.push(`<path d="M 0,${z*30} H 600" stroke="#24382B" stroke-opacity=".15"/>`);
  for(let x=0;x<=20;x++)parts.push(`<path d="M ${x*30},0 V 480" stroke="#24382B" stroke-opacity=".15"/>`);
  for(const p of baseline.placements)if(!panel||kept.has(p.id))parts.push(scenery(p,false));
  const line=path.map(([x,,z])=>`${x*30+15},${z*30+15}`).join(' ');
  parts.push(`<polyline points="${line}" fill="none" stroke="#3C463D" stroke-width="26" stroke-linejoin="miter"/><polyline points="${line}" fill="none" stroke="#EEE0B9" stroke-width="23" stroke-linejoin="miter"/>`);
  for(const bridge of option.bridges)for(const [x,z] of bridge.boxes){parts.push(`<rect x="${x*30}" y="${z*30}" width="30" height="30" fill="#997148"/>`);for(let i=3;i<30;i+=6)parts.push(`<path d="M ${x*30+i},${z*30} V ${z*30+30}" stroke="#61472F" stroke-width="1.2"/>`);}
  if(!panel)parts.push(`<polyline points="${line}" fill="none" stroke="#C45C42" stroke-width="3" stroke-dasharray="6 5"/>`);
  for(let i=0;i<option.corners.length;i++){const [x,z]=option.corners[i];parts.push(`<circle cx="${x*30+15}" cy="${z*30+15}" r="7" fill="${i===0?'#2F8056':i===option.corners.length-1?'#AC493B':'#546C70'}"/><text x="${x*30+15}" y="${z*30+18}" font-size="8" text-anchor="middle">${i+1}</text>`);}
  for(let x=0;x<20;x++)parts.push(`<text class="small" x="${x*30+15}" y="-5" text-anchor="middle">${x}</text>`);
  for(let z=0;z<16;z++)parts.push(`<text class="small" x="-8" y="${z*30+19}" text-anchor="end">${z}</text>`);
  parts.push('</g>');
 }
 let x=35;for(const group of new Set(option.sites.map(s=>s.group))){parts.push(`<rect x="${x}" y="620" width="14" height="14" fill="${colors[group]}"/><text x="${x+20}" y="632" font-size="13">${xml(group)}</text>`);x+=group.length*7+58;}
 parts.push('<text x="35" y="671" font-size="12">Candidate ground is an authoring study, not fixed build pads. Numbered route corners show travel order. Scenery symbols represent saved placements; scale is identical.</text></svg>');
 await Bun.write(new URL(`${id}.svg`,out),parts.join('\n'));
}
if(import.meta.main)for(const id of Object.keys(A2_OPTIONS))if(await Bun.file(new URL(`${id}.level.json`,out)).exists())await drawA2Option(id);
