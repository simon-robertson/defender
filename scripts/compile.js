import {upgradeModel} from '../shared/model.js';
import {mkdir,readdir} from 'node:fs/promises';
import {compileModel} from '../shared/mesher.js';
const root=new URL('../',import.meta.url).pathname;
await mkdir(root+'build/models',{recursive:true});
const files=process.argv.slice(2);if(!files.length)for(const file of await readdir(root+'assets/models'))if(file.endsWith('.json'))files.push(root+'assets/models/'+file);
for(const path of files){const mesh=compileModel(upgradeModel(await Bun.file(path).json()));await Bun.write(`${root}build/models/${mesh.id}.mesh.json`,JSON.stringify(mesh));console.log(`Compiled ${mesh.id}: ${Object.values(mesh.variants).reduce((n,v)=>n+v.parts.reduce((s,p)=>s+p.quads,0),0)} quads across three variants.`);}
