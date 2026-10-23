import {test,expect} from 'bun:test';
import {PLAY_CONFIG,validatePlayConfig,playCapacity,DEFENCE_LABELS,PLAY_MODEL_LIGHTS} from '../play/config.js';
import {PlaySession} from '../play/session.js';
import {ProgressStore} from '../play/progress.js';
import {PORTRAITS} from '../play/portraits.js';

const remaining=['turret-study','arc-spire','missile-launcher','power-generator'];
function storage(run){
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 return Promise.resolve().then(()=>run(values)).finally(()=>{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;});
}
function legacy(){
 return {version:1,configVersion:1,levelId:'moss-04',completedWaves:12,tokens:16,misses:3,nextUnit:7,units:[
  {id:'player-gun-1',model:'turret-study',variant:'upgrade1'},
  {id:'player-drone-defence-2',model:'drone-defence',variant:'base'},
  {id:'player-arc-spire-3',model:'arc-spire',variant:'base'},
  {id:'player-drone-defence-4',model:'drone-defence',variant:'base'},
  {id:'player-missile-launcher-5',model:'missile-launcher',variant:'base'},
  {id:'player-drone-defence-6',model:'drone-defence',variant:'base'},
 ]};
}
async function encode(store,data){
 const key=await store.encryptionKey(),iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('defender/level-checkpoint/v1')},key,new TextEncoder().encode(JSON.stringify(data)));
 const bytes=new Uint8Array(iv.length+encrypted.byteLength);bytes.set(iv);bytes.set(new Uint8Array(encrypted),iv.length);
 return 'D1.'+btoa(String.fromCharCode(...bytes));
}
async function loadData(store,values,data){values.set('defender.progress.v1',await encode(store,data));return store.load();}

test('the campaign and arsenal expose only the remaining four defence families',()=>{
 expect(Object.keys(PLAY_CONFIG.defences)).toEqual(remaining);expect(Object.keys(DEFENCE_LABELS)).toEqual(remaining);
 expect(PLAY_MODEL_LIGHTS['drone-defence']).toBeUndefined();expect(PORTRAITS['drone-defence-base']).toBeUndefined();
 const session=new PlaySession();session.reset();session.levelIndex=15;session.tokens=128;
 expect(session.snapshot().shop.map(item=>item.model)).toEqual(remaining);expect(session.buy('drone-defence')).toBeNull();expect(session.units).toHaveLength(0);expect(session.tokens).toBe(128);
 const config=structuredClone(PLAY_CONFIG);config.defences['drone-defence']={};expect(()=>validatePlayConfig(config)).toThrow('existing campaign defence families');
 const capacity=playCapacity(PLAY_CONFIG);expect(Object.keys(capacity.maxOwnedByFamily)).toEqual(remaining);expect(capacity.modelLights).toBe(410);
});

test('legacy Drone retirement refunds each valid purchase and preserves progress and surviving identities',()=>storage(async values=>{
 const store=new ProgressStore(PLAY_CONFIG),data=legacy(),restored=await loadData(store,values,data),original=values.get('defender.progress.v1');
 expect(restored.tokens).toBe(19);expect(restored.level.id).toBe('moss-04');expect(restored.completedWaves).toBe(12);expect(restored.misses).toBe(3);expect(restored.nextUnit).toBe(7);
 expect(restored.units).toEqual(data.units.filter(unit=>unit.model!=='drone-defence').map(unit=>({...unit,box:null})));
 expect(values.get('defender.progress.v1')).toBe(original);expect((await store.load()).tokens).toBe(19);
 expect(restored.buy()).toBe('player-gun-7');await store.save(restored);const saved=await store.load();expect(saved.tokens).toBe(18);expect(saved.units).toEqual(restored.units);expect(saved.nextUnit).toBe(8);
 await store.save(saved);expect((await store.load()).tokens).toBe(18);
}));

test('all-Drone checkpoints retain the boundary and refund without requiring a surviving unit',()=>storage(async values=>{
 const store=new ProgressStore(PLAY_CONFIG),data={version:1,configVersion:1,levelId:'moss-03',completedWaves:8,tokens:14,misses:0,nextUnit:5,units:Array.from({length:4},(_,index)=>({id:`player-drone-defence-${index+1}`,model:'drone-defence',variant:'base'}))};
 const restored=await loadData(store,values,data);expect(restored.units).toEqual([]);expect(restored.tokens).toBe(18);expect(restored.nextUnit).toBe(5);
 // Spending every refunded token can produce serials beyond the original
 // wallet's unit count, while the current arsenal remains within capacity.
 for(let i=0;i<18;i++)expect(restored.buy()).toBe(`player-gun-${i+5}`);
 expect(restored.tokens).toBe(0);expect(restored.units).toHaveLength(18);await store.save(restored);const saved=await store.load();expect(saved.units).toEqual(restored.units);expect(saved.nextUnit).toBe(23);
}));

test('retirement validates the old unit contract and wallet before issuing any refund',()=>storage(async values=>{
 const store=new ProgressStore(PLAY_CONFIG);
 for(const mutate of [
  data=>data.units[1].variant='upgrade1',
  data=>data.units[1].model='unknown-defence',
  data=>data.units[1].id='player-drone-defence-99',
  data=>data.tokens++,
  data=>data.nextUnit++,
  data=>data.version=2,
  data=>{data.units=Array.from({length:5},(_,index)=>({id:`player-drone-defence-${index+1}`,model:'drone-defence',variant:'base'}));data.tokens=21;data.nextUnit=6;},
  data=>{data.levelId='moss-02';data.completedWaves=4;data.units=[{id:'player-drone-defence-1',model:'drone-defence',variant:'base'}];data.nextUnit=2;data.tokens=9;},
 ]){const data=legacy();mutate(data);await expect(loadData(store,values,data)).rejects.toThrow('incompatible');}
}));

test('ordinary v1 checkpoints and current v2 saves retain their exact arsenal and wallet',()=>storage(async values=>{
 const store=new ProgressStore(PLAY_CONFIG),data={version:1,configVersion:1,levelId:'moss-02',completedWaves:4,tokens:9,misses:0,nextUnit:2,units:[{id:'player-gun-1',model:'turret-study',variant:'base'}]};
 const restored=await loadData(store,values,data);expect(restored.tokens).toBe(9);expect(restored.units[0].id).toBe('player-gun-1');await store.save(restored);expect((await store.load()).units).toEqual(restored.units);
 const corrupt=restored.fork();corrupt.nextUnit=7;expect(()=>store.save(corrupt)).toThrow('incompatible');
}));
