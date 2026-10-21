import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ROOT,gather} from './build.js';
import {staticServer} from './serve.js';
import {PLAY_CONFIG} from '../../docs/site/play/config.js';
import {loadPlayWorld,disposePlayWorld,PlayEngine} from '../../docs/site/play/engine.js';
import {PORTRAITS} from '../../docs/site/play/portraits.js';
const requestedModels=new Set();
const server=staticServer({port:0}),native=globalThis.fetch,report={at:new Date().toISOString(),checks:[],levels:[]};
try{
 const manifest=JSON.parse(await readFile(ROOT+'/build/deployment/manifest.json','utf8'));
 const gathered=await gather();
 assert.equal(gathered.outputs.size,manifest.files.length);
 for(const file of manifest.files){
  const bytes=await readFile(ROOT+'/'+file.path),hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,file.sha256,file.path);assert.deepEqual(bytes,gathered.outputs.get(file.path).data);
 }
 report.checks.push('All output hashes match manifest and freshly gathered source transformations');
 for(const prefix of ['/','/defender/']){
  for(const file of manifest.files){
   const response=await native(new URL(prefix+file.path.slice('docs/'.length),server.url));assert.equal(response.status,200,file.path);
   const type=response.headers.get('content-type');assert.ok(type,file.path);
   assert.ok(file.path.endsWith('.js')?/javascript/.test(type):file.path.endsWith('.json')?/json/.test(type):file.path.endsWith('.css')?/css/.test(type):/html/.test(type),file.path+': '+type);
   assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),file.sha256);
  }
  assert.equal((await native(new URL(prefix+'site/play',server.url),{redirect:'manual'})).status,301);
  assert.equal((await native(new URL(prefix+'api/levels/moss-01',server.url))).status,404);
  report.checks.push(`Every runtime resource, correct MIME, exact bytes and directory redirect passed at ${prefix}; APIs unavailable`);
 }
 assert.ok(Object.values(PORTRAITS).every(value=>value.startsWith('data:image/svg+xml,')));
 for(const [model,family]of Object.entries(PLAY_CONFIG.defences))for(const variant of family.enabledVariants)assert.ok(PORTRAITS[model+'-'+variant]);
 for(const model of Object.keys(PLAY_CONFIG.enemies))assert.ok(PORTRAITS[model+'-base']);
 report.checks.push('Portrait resources are embedded SVGs; all campaign enemies and available defence tiers covered');
 for(const [index,level]of PLAY_CONFIG.levels.entries()){
  const requests=[];
  globalThis.fetch=async(url,options)=>{
   const resource=new URL(url),base=new URL('../../docs/site/',import.meta.url);
   assert.equal(resource.protocol,'file:');assert.ok(resource.href.startsWith(base.href));
   const relative=resource.href.slice(base.href.length);assert.ok(/^assets\/(levels|models)\/[a-z0-9-]+\.json$/.test(relative));requests.push(relative);if(relative.startsWith('assets/models/'))requestedModels.add(relative.slice(14,-5));
   return native(new URL((index%2?'/defender/site/':'/site/')+relative,server.url),options);
  };
  const world=await loadPlayWorld(level.id,{wave:level.waves[0]});let engine;
  try{
   assert.equal(world.level.id,level.id);assert.equal(world.playCritters,true);assert.ok(world.actors.size>0);
   engine=new PlayEngine(world,{config:PLAY_CONFIG});
   for(const wave of level.waves){engine.prepareWave(wave);assert.equal(engine.enemies.states.length,wave.spawns.length);engine.startWave();engine.advance(.25);assert.ok(engine.stats().spawned>0);engine.stopWave();}
   report.levels.push({id:level.id,models:world.playModels.size,requests:requests.length,waves:level.waves.length,critters:engine.wildlife.states.length,fish:engine.wildlife.fish.states.length});
  }finally{engine?.dispose();disposePlayWorld(world);}
 }
 const noCritters=await loadPlayWorld('moss-02',{wave:PLAY_CONFIG.levels[1].waves[0],critters:false});
 try{assert.equal(noCritters.playCritters,false);assert.equal(noCritters.fishActors.length,0);assert.ok(![...noCritters.actors.keys()].some(k=>k.startsWith('wildlife-')));}finally{disposePlayWorld(noCritters);}
 assert.deepEqual([...requestedModels].sort(),manifest.models);
 report.checks.push('Actual packaged loader/engine loads all sixteen levels through static HTTP; all 64 wave rosters start; no-critters world excludes fish/land/birds');
 report.result='passed';
}finally{globalThis.fetch=native;server.stop(true);await writeFile(ROOT+'/build/deployment/static-validation.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
