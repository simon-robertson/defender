import {PlaySession} from './session.js';

const STORAGE_KEY='defender.progress.v1',PREFIX='D1.',MAX_SAVE_LENGTH=65536;
const CONTEXT=new TextEncoder().encode('defender/level-checkpoint/v1');
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const requireSave=valid=>{if(!valid)throw new Error('Saved progress is incompatible or damaged.');};

// Only a completed-level boundary is persisted. Runtime actors, placements,
// combat reservations and partially completed waves never enter the save.
function checkpoint(session){
 requireSave(session.phase==='loadout'&&session.waveIndex===0&&session.levelIndex>0);
 return {version:1,configVersion:session.config.version,levelId:session.level.id,completedWaves:session.completedWaves,tokens:session.tokens,misses:session.misses,nextUnit:session.nextUnit,
  units:session.units.map(unit=>({id:unit.id,model:unit.model??'turret-study',variant:unit.variant}))};
}

function restore(config,data){
 requireSave(data?.version===1&&data.configVersion===config.version);
 const levelIndex=config.levels.findIndex(level=>level.id===data.levelId);
 requireSave(levelIndex>0);
 const completed=config.levels.slice(0,levelIndex).reduce((sum,level)=>sum+level.waves.length,0),budget=config.startTokens+completed*config.waveReward;
 requireSave(data.completedWaves===completed&&integer(data.tokens,0,budget)&&integer(data.misses,0,config.missLimit-1));
 const maxUnits=Math.floor(budget/Math.min(...Object.values(config.defences).map(family=>family.purchaseCost)));
 requireSave(Array.isArray(data.units)&&data.units.length<=maxUnits&&data.nextUnit===data.units.length+1);
 let spent=0;const familyCounts=new Map();
 const units=data.units.map((unit,index)=>{
  requireSave(unit&&typeof unit.model==='string'&&Object.hasOwn(config.defences,unit.model));
  const count=(familyCounts.get(unit.model)??0)+1;familyCounts.set(unit.model,count);requireSave(count<=(config.defences[unit.model].maxOwned??Infinity));
  const family=config.defences[unit.model],variants=family.kind==='enhancer'?['base']:family.enabledVariants,tier=variants.indexOf(unit.variant);
  requireSave(tier>=0&&unit.id===`player-${unit.model==='turret-study'?'gun':unit.model}-${index+1}`);
  requireSave((family.availableFromWave??1)<=completed);
  for(let rank=0;rank<=tier;rank++)requireSave((family.variants[variants[rank]].availableFromWave??family.availableFromWave??1)<=completed);
  spent+=family.purchaseCost+tier*(family.upgradeCost??0);
  return {id:unit.id,model:unit.model,variant:unit.variant,box:null};
 });
 requireSave(data.tokens+spent===budget);
 const session=new PlaySession(config);session.reset('loadout');
 Object.assign(session,{levelIndex,completedWaves:completed,tokens:data.tokens,misses:data.misses,nextUnit:data.nextUnit,units});
 return session;
}

export class ProgressStore {
 constructor(config){this.config=config;this.key=null;this.pending=Promise.resolve();}
 async encryptionKey(){
  // The bundled key obscures local data and authenticates edits. It cannot
  // establish server-trusted progress: the entire game runs on the client.
  this.key??=crypto.subtle.digest('SHA-256',new TextEncoder().encode('Defender checkpoint envelope / 2026 / 6f389ac2'))
   .then(bytes=>crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']));
  return this.key;
 }
 async load(){
  const encoded=globalThis.localStorage.getItem(STORAGE_KEY);if(encoded===null)return null;
  requireSave(encoded.length<=MAX_SAVE_LENGTH&&encoded.startsWith(PREFIX)&&/^[A-Za-z0-9+/]+={0,2}$/.test(encoded.slice(PREFIX.length)));
  const bytes=Uint8Array.from(atob(encoded.slice(PREFIX.length)),char=>char.charCodeAt(0));requireSave(bytes.length>=29);
  const key=await this.encryptionKey(),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.subarray(0,12),additionalData:CONTEXT},key,bytes.subarray(12));
  return restore(this.config,JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(plain)));
 }
 save(session){
  // Capture synchronously, before the next loadout can change the live session.
  const data=checkpoint(session),saved=restore(this.config,data);
  const write=async()=>{
   const key=await this.encryptionKey(),iv=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:CONTEXT},key,new TextEncoder().encode(JSON.stringify(data)));
   const bytes=new Uint8Array(iv.length+encrypted.byteLength);bytes.set(iv);bytes.set(new Uint8Array(encrypted),iv.length);
   let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
   const encoded=PREFIX+btoa(binary);requireSave(encoded.length<=MAX_SAVE_LENGTH);
   // One atomic replacement preserves the previous checkpoint on write failure.
   globalThis.localStorage.setItem(STORAGE_KEY,encoded);return saved;
  };
  this.pending=this.pending.catch(()=>{}).then(write);return this.pending;
 }
 clear(){this.pending=this.pending.catch(()=>{}).then(()=>globalThis.localStorage.removeItem(STORAGE_KEY));return this.pending;}
}
