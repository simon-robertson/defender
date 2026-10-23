import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PLAY_CONFIG,validatePlayConfig,playCapacity} from '../play/config.js';
import {PlaySession} from '../play/session.js';
import {ProgressStore} from '../play/progress.js';
import {unitRangePreview} from '../play/range-preview.js';
import {PORTRAITS} from '../play/portraits.js';

test('Drone is a one-token A2 base-only mobile supplement with four owned pads',()=>{
 const family=PLAY_CONFIG.defences['drone-defence'];expect(family).toMatchObject({purchaseCost:1,upgradeCost:null,availableFromWave:5,maxOwned:4,enabledVariants:['base']});
 expect(family.variants.base).toMatchObject({stats:{strength:10,maxRange:72,requiresLineOfSight:true},firing:{shotsPerBurst:10,shotIntervalSeconds:.25,cooldownSeconds:5},flightSeconds:20,rechargeSeconds:10});
 const s=new PlaySession();s.reset();s.tokens=20;expect(s.buy('drone-defence')).toBeNull();s.levelIndex=1;
 const ids=Array.from({length:4},()=>s.buy('drone-defence'));expect(ids.every(Boolean)).toBe(true);expect(s.tokens).toBe(16);expect(s.buy('drone-defence')).toBeNull();expect(s.upgrade(ids[0])).toBe(false);
 expect(s.snapshot().shop.find(item=>item.model==='drone-defence')).toMatchObject({available:true,maxOwned:4,owned:4,flightSeconds:20,rechargeSeconds:10});
 const unit=s.snapshot().units[0];expect(unit.nextVariant).toBeNull();expect(unit.canUpgrade).toBe(false);expect(unitRangePreview(unit,PLAY_CONFIG.defences)).toBeNull();expect(PORTRAITS['drone-defence-base']).toStartWith('data:image/svg+xml,');
 s.prepare('deploy');s.place(ids[0],[3,0,3]);s.undeploy(ids[0]);s.prepare('loadout');expect(s.buy('drone-defence')).toBeNull();
});
test('fleet limit bounds all affordable lights and validation rejects unsupported Drone rules',()=>{
 const cap=playCapacity(PLAY_CONFIG);expect(cap.maxOwnedByFamily['drone-defence']).toBe(4);expect(cap.modelLights).toBe(434);expect(cap.modelLights).toBeLessThanOrEqual(463);
 for(const mutate of [f=>f.maxOwned=5,f=>f.maxOwned=0,f=>f.enabledVariants.push('upgrade1'),f=>f.upgradeCost=1,f=>f.variants.base.flightSeconds=30,f=>f.variants.base.rechargeSeconds=5,f=>f.variants.base.stats.strength=20,f=>f.variants.base.firing.shotsPerBurst=20]){
  const config=structuredClone(PLAY_CONFIG);mutate(config.defences['drone-defence']);expect(()=>validatePlayConfig(config)).toThrow();
 }
});
test('Drone checkpoints round-trip and reject a fifth owned pad, while old gun-only checkpoints still load',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}});
 try{
  const store=new ProgressStore(PLAY_CONFIG),s=new PlaySession();s.reset();s.levelIndex=1;s.tokens=18;
  for(let i=0;i<4;i++)s.buy('drone-defence');s.levelIndex=2;s.completedWaves=8;
  await store.save(s);const restored=await store.load();expect(restored.units).toEqual(s.units);expect(restored.tokens).toBe(14);expect(restored.buy('drone-defence')).toBeNull();
  const invalid=s.fork();invalid.units.push({id:'player-drone-defence-5',model:'drone-defence',variant:'base',box:null});invalid.tokens--;invalid.nextUnit++;
  expect(()=>store.save(invalid)).toThrow('incompatible');expect((await store.load()).units).toHaveLength(4);
  const old=new PlaySession();old.reset();old.buy();old.levelIndex=1;old.completedWaves=4;old.tokens=9;await store.save(old);expect((await store.load()).units[0].model).toBe('turret-study');
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('the arsenal exposes the owned Drone fleet and disables the fifth purchase without an unlock warning',async()=>{
 const ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8'),code=ui.slice(ui.indexOf('function updateShop('),ui.indexOf('function updateWavePreview('));
 const attrs={},button={setAttribute:(key,value)=>attrs[key]=value},entry={name:{},detail:{},button,row:{classList:{toggle(){}}}};
 const scope={shopRows:new Map([['drone-defence',entry]]),refs:{},document:{querySelector:()=>null},setText:(node,value)=>node.textContent=String(value),priceLabel:n=>`${n} token`,show(){}};
 runInNewContext(code+';globalThis.update=updateShop;',scope);
 const s=new PlaySession();s.reset();s.levelIndex=1;s.tokens=8;for(let i=0;i<4;i++)s.buy('drone-defence');const state=s.snapshot();state.shop=state.shop.filter(item=>item.model==='drone-defence');scope.update(state,false);
 expect(entry.detail.textContent).toContain('Fleet 4/4');expect(button.disabled).toBe(true);expect(button.textContent).toBe('FLEET FULL');expect(attrs['aria-label']).toContain('fleet full');
});

test('arsenal and grouped roster place the A2 Drone before the A3 missile launcher',()=>{
 const session=new PlaySession();const order=session.snapshot().shop.map(item=>item.model);
 expect(order).toEqual(['turret-study','arc-spire','drone-defence','missile-launcher','power-generator']);
 expect(order.indexOf('drone-defence')).toBeLessThan(order.indexOf('missile-launcher'));
});
