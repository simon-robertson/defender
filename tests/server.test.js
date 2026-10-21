import {test,expect,afterAll} from 'bun:test';
import {mkdtemp,rm,mkdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {newModel} from '../shared/model.js';
import {newLevel,defaultEnvironment} from '../shared/level.js';
import {dogModel} from '../scripts/dog.js';

// A separate asset root prevents integration tests from touching user documents.
const directory=await mkdtemp(join(tmpdir(),'defender-test-'));
const docsDirectory=join(directory,'docs');await mkdir(join(docsDirectory,'concepts'),{recursive:true});
const previousRoot=process.env.DEFENDER_ASSET_ROOT,previousPort=process.env.PORT,previousDocs=process.env.DEFENDER_DOCS_ROOT;
process.env.DEFENDER_ASSET_ROOT=directory;process.env.DEFENDER_DOCS_ROOT=docsDirectory;process.env.PORT='0';
const {server}=await import('../server.js');
if(previousRoot===undefined)delete process.env.DEFENDER_ASSET_ROOT;else process.env.DEFENDER_ASSET_ROOT=previousRoot;
if(previousPort===undefined)delete process.env.PORT;else process.env.PORT=previousPort;
if(previousDocs===undefined)delete process.env.DEFENDER_DOCS_ROOT;else process.env.DEFENDER_DOCS_ROOT=previousDocs;
const origin=`http://127.0.0.1:${server.port}`;
const put=(kind,asset,revision=null,headers={})=>fetch(`${origin}/api/${kind}/${asset.id}`,{method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({asset,revision})});
afterAll(async()=>{server.stop(true);await rm(directory,{recursive:true,force:true});});
test('player entry is separately served with local scripts and no write route',async()=>{
 for(const path of ['/play','/play/']){const response=await fetch(origin+path);expect(response.status).toBe(200);expect(await response.text()).toContain('/play/app.js');expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");}
 expect((await fetch(origin+'/play/session.js')).status).toBe(200);expect((await fetch(origin+'/play/',{method:'PUT'})).status).toBe(405);
 expect((await fetch(origin+'/play/../../package.json')).status).toBe(404);expect(await(await fetch(origin+'/game/')).text()).toContain('/game/');
});

test('design doc renders the current Markdown source on every request and supports canonical/raw/HEAD routes',async()=>{
 const path=join(docsDirectory,'design-doc.md');await Bun.write(path,'# design doc\n\n## First section\n\nCurrent content.\n');
 let response=await fetch(origin+'/docs/design-doc');expect(response.status).toBe(200);expect(response.headers.get('content-type')).toContain('text/html');expect(response.headers.get('cache-control')).toBe('no-cache');expect(response.headers.get('content-security-policy')).toContain("script-src 'self'");expect(await response.text()).toContain('Current content.');
 await Bun.write(path,'# design doc\n\n## Updated section\n\nSaved update.\n');response=await fetch(origin+'/docs/design-doc');expect(await response.text()).toContain('Saved update.');
 const redirect=await fetch(origin+'/docs/design-doc.md',{redirect:'manual'});expect(redirect.status).toBe(308);expect(redirect.headers.get('location')).toBe('/docs/design-doc');
 expect((await fetch(origin+'/docs/design-doc/',{redirect:'manual'})).status).toBe(308);
 const raw=await fetch(origin+'/docs/design-doc.md?raw=1');expect(raw.headers.get('content-type')).toContain('text/plain');expect(await raw.text()).toBe(await Bun.file(path).text());
 const head=await fetch(origin+'/docs/design-doc',{method:'HEAD'});expect(head.status).toBe(200);expect(await head.text()).toBe('');expect((await fetch(origin+'/docs/design-doc',{method:'POST'})).status).toBe(405);
});

test('linked documents and safe images are served with explicit types without exposing HTML or escaped paths',async()=>{
 await Bun.write(join(docsDirectory,'concepts/notes.md'),'# Concept notes\n\n![Art](art.svg)');await Bun.write(join(docsDirectory,'concepts/art.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');await Bun.write(join(docsDirectory,'forbidden.html'),'<script>alert(1)</script>');await Bun.write(join(directory,'private.md'),'PRIVATE');await symlink(join(directory,'private.md'),join(docsDirectory,'linked.md'));
 const notes=await fetch(origin+'/docs/concepts/notes.md');expect(notes.status).toBe(200);expect(await notes.text()).toContain('src="/docs/concepts/art.svg"');
 const image=await fetch(origin+'/docs/concepts/art.svg');expect(image.status).toBe(200);expect(image.headers.get('content-type')).toBe('image/svg+xml');expect(image.headers.get('content-security-policy')).toContain('sandbox');expect(image.headers.get('x-content-type-options')).toBe('nosniff');
 for(const path of ['/docs/forbidden.html','/docs/linked.md','/docs/%2e%2e%2fprivate.md','/docs/%5c..%5cprivate.md','/docs/%00.md','/docs/.hidden.md','/docs/missing.png','/package.json','/server/docs.js'])expect((await fetch(origin+path)).status).toBe(404);
 for(const path of ['/AGENTS.md','/README.md']){const rendered=await fetch(origin+path);expect(rendered.status).toBe(200);expect(rendered.headers.get('content-type')).toContain('text/html');expect((await fetch(origin+path+'?raw=1')).headers.get('content-type')).toContain('text/plain');}
 expect(await(await fetch(origin+'/')).text()).toContain('href="/docs/design-doc"');expect((await fetch(origin+'/tools/design-doc.css')).status).toBe(200);
});
test('source round-trip, stale revision protection, and same-origin save protection',async()=>{
 const model=newModel('round-trip');model.variants.base.parts[0].voxels=[[0,0,0,0]];
 const created=await put('models',model);expect(created.status).toBe(200);const result=await created.json();
 const read=await(await fetch(origin+'/api/models/round-trip')).json();expect(read.asset).toEqual(model);expect(read.revision).toBe(result.revision);
 model.name='Changed';expect((await put('models',model)).status).toBe(409);expect((await put('models',model,result.revision,{Origin:'https://example.com'})).status).toBe(403);
 const saved=await put('models',model,result.revision);expect(saved.status).toBe(200);expect((await saved.json()).revision).not.toBe(result.revision);
});
test('invalid materials and missing references never reach disk',async()=>{
 const model=newModel('bad-material');model.materials[0].emission=1.1;expect((await put('models',model)).status).toBe(400);expect((await fetch(origin+'/api/models/bad-material')).status).toBe(404);
 const level=newLevel('missing-model');level.placements=[{id:'p1',model:'missing',variant:'base',box:[0,0,0],turn:0}];expect((await put('levels',level)).status).toBe(400);
 expect((await fetch(origin+'/package.json')).status).toBe(404);
});
test('enemy source and articulated joints survive the authoring API round-trip',async()=>{
 const model=dogModel();const response=await put('models',model);expect(response.status).toBe(200);
 const saved=await(await fetch(origin+'/api/models/dog')).json();expect(saved.asset).toEqual(model);
 expect(saved.asset.role).toBe('enemy');expect(saved.asset.variants.base.parts).toHaveLength(13);
 const invalid=structuredClone(model);invalid.role='unknown';expect((await put('models',invalid,saved.revision)).status).toBe(400);
 expect((await(await fetch(origin+'/api/models/dog')).json()).revision).toBe(saved.revision);
});
test('legacy library reads upgrade in memory and retain revision protection until saved',async()=>{
 const model=newModel('legacy-source');model.version=1;model.size=[15,24,15];
 for(const variant of Object.values(model.variants))variant.parts[0].pivot=[7.5,0,7.5];
 model.variants.base.parts[0].voxels=[[14,0,14,0]];
 const path=join(directory,'models',model.id+'.json');await Bun.write(path,JSON.stringify(model));
 const read=await(await fetch(origin+'/api/models/'+model.id)).json();
 expect(read.migrated).toBe(true);expect(read.asset.size).toEqual([24,24,24]);expect(read.asset.variants).toEqual(model.variants);
 expect((await Bun.file(path).json()).version).toBe(1);expect((await put('models',read.asset)).status).toBe(409);
 expect((await put('models',read.asset,read.revision)).status).toBe(200);expect((await Bun.file(path).json()).version).toBe(3);
 const level=newLevel('legacy-layout');level.version=1;level.placements=[{id:'p1',model:model.id,variant:'base',box:[2,1,3],turn:1}];
 await Bun.write(join(directory,'levels',level.id+'.json'),JSON.stringify(level));
 const loaded=await(await fetch(origin+'/api/levels/'+level.id)).json();expect(loaded.migrated).toBe(true);expect(loaded.asset).toEqual({...level,version:4});
 expect((await put('levels',loaded.asset,loaded.revision)).status).toBe(200);
});
test('model changes cannot silently invalidate saved layouts',async()=>{
 const model=newModel('stack');model.size[1]=64;model.variants.base.parts[0].voxels=[[0,0,0,0]];const created=await(await put('models',model)).json();
 const level=newLevel('stacked');level.placements=[0,1].map(y=>({id:`p${y}`,model:'stack',variant:'base',box:[0,y,0],turn:0}));expect((await put('levels',level)).status).toBe(200);
 model.variants.base.parts[0].voxels.push([0,24,0,0]);const blocked=await put('models',model,created.revision);expect(blocked.status).toBe(400);expect((await blocked.json()).error).toContain('invalidates level');
});
test('terrain, water and path height survive saves; invalid route edits never replace disk',async()=>{
 const {TerrainField}=await import('../shared/terrain.js');const level=newLevel('terrain-round-trip');level.path=[[0,0,0]];
 const f=new TerrainField(level);f.paint(1,0,'flatten',4);f.paint(1,0,'water',8);f.commit();
 const response=await put('levels',level);expect(response.status).toBe(200);const saved=await response.json();
 const restored=await(await fetch(origin+'/api/levels/'+level.id)).json();expect(restored.asset).toEqual(level);
 const bad=structuredClone(level),field=new TerrainField(bad);field.setBox(0,0,23,0);field.commit();expect((await put('levels',bad,saved.revision)).status).toBe(400);
 expect((await(await fetch(origin+'/api/levels/'+level.id)).json()).revision).toBe(saved.revision);
});
test('engine entry point and detail/environment metadata round-trip without exposing source files',async()=>{
 expect((await fetch(origin+'/game/')).status).toBe(200);expect((await fetch(origin+'/engine/renderer.js')).status).toBe(200);
 expect((await fetch(origin+'/assets/levels/moss-01.json')).status).toBe(404);
 const model=newModel('small-prop');model.colorMode='authored';model.variants.base.parts[0].voxels=[[12,0,12,0]];expect((await put('models',model)).status).toBe(200);
 const level=newLevel('small-props');level.placements=[-4,4].map((x,i)=>({id:'p'+i,model:model.id,variant:'base',box:[1,0,1],turn:0,kind:'detail',offset:[x,0,0]}));
 level.environment={timeOfDay:10.5,weather:'clear',sky:{direction:[-1,1,-1],color:'#FFF2D9',intensity:.88,ambient:'#B8C8C1',ambientIntensity:.48}};
 const saved=await put('levels',level);expect(saved.status).toBe(200);expect((await saved.json()).asset).toEqual(level);
 const loaded=await(await fetch(origin+'/api/levels/small-props')).json();expect(loaded.asset).toEqual(level);
});
test('water settings persist and elevated player defences are rejected before saving',async()=>{
 const {defaultWaterMaterial}=await import('../shared/water.js');const model=newModel('level-defence');model.role='defence';model.variants.base.parts[0].voxels=[[12,0,12,0]];expect((await put('models',model)).status).toBe(200);
 const level=newLevel('water-and-defence');level.waterMaterial=defaultWaterMaterial();level.placements=[{id:'tower',model:model.id,variant:'base',box:[1,0,1],turn:0}];level.path=[[0,0,0]];
 const created=await(await put('levels',level)).json();expect(created.asset.waterMaterial).toEqual(defaultWaterMaterial());
 level.terrain.boxes=[{box:[1,1],ground:32,water:0}];const bad=await put('levels',level,created.revision);expect(bad.status).toBe(400);expect((await bad.json()).error).toContain('enemy path height');
 const saved=await(await fetch(origin+'/api/levels/water-and-defence')).json();expect(saved.asset.terrain.boxes).toEqual([]);
});

test('the per-level weather switch round-trips and rejects unsupported zone weather',async()=>{
 const level=newLevel('rain-setting');level.environment=defaultEnvironment();level.environment.weather={enabled:true};
 const created=await put('levels',level);expect(created.status).toBe(200);const saved=await created.json();
 expect((await(await fetch(origin+'/api/levels/rain-setting')).json()).asset.environment.weather).toEqual({enabled:true});
 const bad=structuredClone(level);bad.zone='B';expect((await put('levels',bad,saved.revision)).status).toBe(400);
 bad.zone='A';bad.environment.weather={enabled:true,type:'fog'};expect((await put('levels',bad,saved.revision)).status).toBe(400);
 level.environment.weather={enabled:false};const disabled=await put('levels',level,saved.revision);expect(disabled.status).toBe(200);
 expect((await(await fetch(origin+'/api/levels/rain-setting')).json()).asset.environment.weather).toEqual({enabled:false});
 const snow=newLevel('snow-setting');snow.zone='C';snow.environment=defaultEnvironment();snow.environment.weather={enabled:true};
 const snowSaved=await put('levels',snow);expect(snowSaved.status).toBe(200);const snowRevision=(await snowSaved.json()).revision;
 expect((await(await fetch(origin+'/api/levels/snow-setting')).json()).asset.environment.weather).toEqual({enabled:true});
 snow.environment.weather.enabled=false;expect((await put('levels',snow,snowRevision)).status).toBe(200);
 expect((await(await fetch(origin+'/api/levels/snow-setting')).json()).asset.environment.weather).toEqual({enabled:false});
 const leaves=newLevel('leaf-setting');leaves.zone='D';leaves.environment=defaultEnvironment();leaves.environment.weather={enabled:true};
 const leafSaved=await put('levels',leaves);expect(leafSaved.status).toBe(200);const leafRevision=(await leafSaved.json()).revision;
 expect((await(await fetch(origin+'/api/levels/leaf-setting')).json()).asset.environment.weather).toEqual({enabled:true});
 leaves.environment.weather.enabled=false;expect((await put('levels',leaves,leafRevision)).status).toBe(200);
 expect((await(await fetch(origin+'/api/levels/leaf-setting')).json()).asset.environment.weather).toEqual({enabled:false});
});
