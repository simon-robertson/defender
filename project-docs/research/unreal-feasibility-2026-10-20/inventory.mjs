// Research-only source inventory. Does not export assets or create an Unreal project.
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PLAY_CONFIG,PLAY_LEVEL_IDS} from '../../../play/config.js';
import {compileModel} from '../../../shared/mesher.js';
import {upgradeModel} from '../../../shared/model.js';
import {validateLevel} from '../../../shared/level.js';
const sources=[];
for(const kind of ['models','levels'])for(const name of (await readdir('assets/'+kind)).filter(x=>x.endsWith('.json')).sort())sources.push('assets/'+kind+'/'+name);
const digest=async p=>createHash('sha256').update(await Bun.file(p).bytes()).digest('hex'),hashes=Object.fromEntries(await Promise.all(sources.map(async p=>[p,await digest(p)])));
const models=[],levels=[];
for(const p of sources){const a=await Bun.file(p).json();if(p.startsWith('assets/models/'))models.push({id:a.id,schema:a.schema,version:a.version,role:a.role??'unspecified',materials:a.materials.length,variants:Object.fromEntries(Object.entries(a.variants).map(([name,v])=>[name,{parts:v.parts.length,voxels:v.parts.reduce((n,p)=>n+p.voxels.length,0),pivots:v.parts.every(p=>Array.isArray(p.pivot)&&p.pivot.length===3),parentedParts:v.parts.filter(p=>p.parent).length}]))});else levels.push({id:a.id,schema:a.schema,version:a.version,placements:a.placements.length,campaign:PLAY_LEVEL_IDS.includes(a.id)});}
const sampleMeshes=[];for(const id of ['scenery-rock','dog','turret-study','missile-launcher','guided-missile','drone-defence']){const source=upgradeModel(await Bun.file('assets/models/'+id+'.json').json()),compiled=compileModel(source);sampleMeshes.push({id,variants:Object.fromEntries(Object.entries(compiled.variants).map(([name,v])=>[name,{parts:v.parts.length,vertices:v.parts.reduce((n,p)=>n+p.vertices.length/11,0),triangles:v.parts.reduce((n,p)=>n+p.indices.length/3,0)}]))});}
for(const id of PLAY_LEVEL_IDS)validateLevel(await Bun.file('assets/levels/'+id+'.json').json());
for(const p of sources)if(await digest(p)!==hashes[p])throw Error('Research changed source: '+p);
const report={scope:'Read-only JSON/mesh availability inventory; no Unreal installation, connection, import, build or performance test.',modelSourceCount:models.length,levelSourceCount:levels.length,campaignLevelCount:PLAY_CONFIG.levels.length,waveCount:PLAY_CONFIG.levels.reduce((n,l)=>n+l.waves.length,0),enemySpawnCount:PLAY_CONFIG.levels.reduce((n,l)=>n+l.waves.reduce((n,w)=>n+w.spawns.length,0),0),playableDefenceFamilies:Object.keys(PLAY_CONFIG.defences??{}),sampleMeshes,models,levels,sourceHashes:hashes,unchangedSourceCount:sources.length};
await Bun.write('docs/research/unreal-feasibility-2026-10-20/inventory.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({modelSources:models.length,levelSources:levels.length,campaignLevels:report.campaignLevelCount,waves:report.waveCount,spawns:report.enemySpawnCount,meshFamiliesChecked:sampleMeshes.length,unchangedSources:sources.length}));
