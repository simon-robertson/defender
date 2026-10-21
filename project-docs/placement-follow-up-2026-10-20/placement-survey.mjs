import {createPlacementRules} from '../../play/placement.js';
import {PLAY_CONFIG} from '../../play/config.js';
import {readdir} from 'node:fs/promises';
const models=new Map();for(const file of await readdir('assets/models'))if(file.endsWith('.json')){const m=await Bun.file('assets/models/'+file).json();models.set(m.id,m);}
const rows=[];
for(const entry of PLAY_CONFIG.levels.slice(4)){
 const source=await Bun.file('assets/levels/'+entry.id+'.json').json(),rules=createPlacementRules(source,models,{config:PLAY_CONFIG}),row={id:entry.id,families:{}};
 for(const model of ['turret-study','arc-spire','missile-launcher'])for(const variant of ['base','upgrade1','upgrade2']){const cells=rules.eligibleCells(variant,[],null,model),counts={};for(const c of cells)counts[c.code??'valid']=(counts[c.code??'valid']??0)+1;row.families[model+':'+variant]={counts,valid:cells.filter(c=>c.valid).map(c=>c.box)};}
 rules.dispose();rows.push(row);
}
console.log(JSON.stringify(rows,null,2));
