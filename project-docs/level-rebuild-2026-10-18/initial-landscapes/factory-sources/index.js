import {createHash} from 'node:crypto';
import {makeLandscape,placementId,PROFILES} from './core.js';
import {A_LANDSCAPES} from './a.js';
import {B_LANDSCAPES} from './b.js';
import {C_LANDSCAPES} from './c.js';
import {D_LANDSCAPES} from './d.js';

export const LANDSCAPE_CONFIGS=[...A_LANDSCAPES,...B_LANDSCAPES,...C_LANDSCAPES,...D_LANDSCAPES];
const configs=new Map(LANDSCAPE_CONFIGS.map(c=>[`${c.zone}${c.number}`,c]));
export function landscapeFor(zone,number){const config=configs.get(`${zone}${number}`);if(!config)throw new Error(`Landscape ${zone}${number} is not authored.`);return config.reuse?config.reuse():makeLandscape(config);}
export const snapshotText=level=>JSON.stringify(level,null,2)+'\n';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const LANDSCAPE_INFO=freeze(Object.fromEntries(LANDSCAPE_CONFIGS.map(config=>{
 const p=PROFILES[config.zone],id=`${p.prefix}-${String(config.number).padStart(2,'0')}`,level=landscapeFor(config.zone,config.number);
 const perchCandidates=config.perchRecords??config.perches.map(([x,z])=>({id:placementId(config,x,z),model:p.perchModel,box:[x,0,z],point:[...p.perchPoint]}));
 return [id,{id,zone:config.zone,number:config.number,name:config.name,size:[...config.size],pathHeight:24,snapshot:`docs/landscapes/${id}.json`,sha256:sha256(snapshotText(level)),composition:config.composition,landmarkIds:config.landmarkIds??config.anchors.map(([,x,z])=>placementId(config,x,z)),perchCandidates,...(config.originalSnapshot?{originalSnapshot:config.originalSnapshot}:{})}];
})));
