import {mkdir} from 'node:fs/promises';
import {productionLayout} from './production-layouts.js';
import {productionLevel} from './production-level.js';

// Documentation only: show the reserved ground and route independently of art.
const args=process.argv.slice(2);
if(args.length>1||(args.length&&!/^--zone=[ABCD]$/.test(args[0])))throw new Error('Usage: bun scripts/production-plans.js [--zone=A|B|C|D]');
const zones=args.length?[args[0].slice(7)]:['A','B','C','D'];
await mkdir('docs/maps',{recursive:true});
for(const zone of zones){
 const layout=productionLayout(zone),level=productionLevel(zone),scale=32,margin=32,side=layout.size[0]*scale;
 const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side+64} ${side+136}"><rect width="100%" height="100%" fill="#f4f1e8"/><style>text{font-family:system-ui,sans-serif;fill:#25352e}.label{font-size:11px}.title{font-size:20px;font-weight:600}</style><text x="32" y="28" class="title">${zone} · ${level.name}</text>`];
 const cell=(x,z,color,inset=0)=>`<rect x="${margin+x*scale+inset}" y="${48+z*scale+inset}" width="${scale-inset*2}" height="${scale-inset*2}" fill="${color}"/>`;
 for(let z=0;z<layout.size[1];z++)for(let x=0;x<layout.size[0];x++)parts.push(cell(x,z,'#d6d9c9',.5));
 for(const [x,z] of layout.water)parts.push(cell(x,z,'#80a8b4',.5));
 for(const [x,z] of layout.mounds)parts.push(cell(x,z,'#acb09c',.5));
 for(const [x,z] of layout.clear)parts.push(cell(x,z,'#e4e9bd',.5));
 for(const p of level.placements.filter(p=>p.model!=='turret-study'))parts.push(cell(p.box[0],p.box[2],p.kind==='detail'?'#a6b88a':'#647c67',p.kind==='detail'?13:7));
 for(const [x,,z] of level.path)parts.push(cell(x,z,'#c2ad89',.5));
 const points=level.path.map(([x,,z])=>`${margin+(x+.5)*scale},${48+(z+.5)*scale}`).join(' ');
 parts.push(`<polyline points="${points}" fill="none" stroke="#8e7253" stroke-width="2"/>`);
 for(const [i,[x,z]] of layout.towers.entries())parts.push(cell(x,z,'#faf8ec',7),`<text x="${margin+(x+.5)*scale}" y="${48+(z+.5)*scale+4}" text-anchor="middle" class="label">${i+1}</text>`);
 for(const [name,index] of [['IN',0],['OUT',level.path.length-1]]){const [x,,z]=level.path[index];parts.push(`<text x="${margin+(x+.5)*scale}" y="${48+(z+.5)*scale+4}" text-anchor="middle" class="label">${name}</text>`);}
 parts.push(`<text x="32" y="${side+76}" class="label">16 × 16 boxes · each box 24 units · path height 24 · ${level.path.length} route boxes</text><text x="32" y="${side+96}" class="label">Pale green: reserved clear ground · dark green: scenery · blue: water</text><text x="32" y="${side+116}" class="label">1 / 3: base preview turrets · 2: stage-2 preview turret · deployment still pending</text></svg>`);
 await Bun.write(`docs/maps/production-${zone.toLowerCase()}.svg`,parts.join('\n'));
}
