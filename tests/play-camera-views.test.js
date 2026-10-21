import {test,expect} from 'bun:test';
import {CameraViews} from '../play/camera-views.js';

function fixture(){
 const camera={view:'overview'},calls=[];
 const viewpoint=kind=>({enabled:false,active:false,saved:null,setEnabled(value){if(!value&&this.active){camera.view=this.saved;this.active=false;calls.push(kind+' leave');}this.enabled=value;},sync(phase){if(this.enabled&&['wave','settling'].includes(phase)&&!this.active){this.saved=camera.view;camera.view=kind;this.active=true;calls.push(kind+' enter');}else if(!['wave','settling'].includes(phase)&&this.active){camera.view=this.saved;this.active=false;}},advance(dt,state){this.sync(state.phase);calls.push([kind,dt,state.paused]);},bind(world){if(this.active){camera.view=this.saved;this.active=false;}this.world=world;},refresh(){this.bind(this.world);},noteExplosion(state,at){this.explosion=[state,at];}});
 const overview={enabled:true,manualOverride(){calls.push('capture '+camera.view);},resume(){this.enabled=true;calls.push('resume '+camera.view);},setEnabled(v){this.enabled=v;},bind(world){this.world=world;},advance(dt,state){calls.push(['overview',dt,state.paused]);}},drone=viewpoint('drone');
 return {views:new CameraViews(overview,drone),camera,calls,drone,overview};
}

test('Drone restores the saved overview when toggled off and rejects removed camera modes',()=>{
 const f=fixture(),v=f.views;v.sync('wave',{});expect(f.camera.view).toBe('drone');expect(f.drone.saved).toBe('overview');expect(v.active).toBe(f.drone);
 v.toggle('drone');expect(v.active).toBeNull();expect(v.selected).toBe('overview');expect(f.camera.view).toBe('overview');
 expect(()=>v.toggle('live')).toThrow('Unknown camera view.');
});

test('arming in preparation survives landscape binding while Frame cancels an inactive armed choice',()=>{
 const f=fixture(),v=f.views;v.sync('deploy',{});expect(v.active).toBeNull();expect(v.selected).toBe('drone');
 const world={id:'next'};v.bind(world);expect(f.drone.enabled).toBe(true);expect(f.drone.world).toBe(world);v.sync('wave',{});expect(v.active).toBe(f.drone);v.sync('loadout',{});expect(v.active).toBeNull();expect(v.selected).toBe('drone');
 v.frame();v.sync('wave',{});expect(v.selected).toBe('overview');expect(v.active).toBeNull();
});

test('Auto can exit Drone and retains the existing toggle for automatic overview framing',()=>{
 const f=fixture(),v=f.views;f.overview.enabled=false;v.sync('wave',{});v.toggleOverview();expect(v.active).toBeNull();expect(f.overview.enabled).toBe(true);expect(f.camera.view).toBe('overview');
 v.toggleOverview();expect(f.overview.enabled).toBe(false);v.toggleOverview();expect(f.overview.enabled).toBe(true);
});

test('only the owning camera advances the shared overview and paused state is passed unchanged',()=>{
 const f=fixture(),v=f.views,state={phase:'wave',paused:true};f.calls.length=0;v.advance(.02,state);expect(f.calls.some(c=>Array.isArray(c)&&c[0]==='overview')).toBe(false);expect(f.calls.filter(Array.isArray).every(c=>c[2]===true)).toBe(true);
 v.frame();f.calls.length=0;v.advance(.02,state);expect(f.calls.some(c=>Array.isArray(c)&&c[0]==='overview')).toBe(true);
 const blast={x:1,y:2,z:3};v.noteExplosion(blast,9);expect(f.drone.explosion).toEqual([blast,9]);
});

 test('fresh runs default to Drone, preparation stays overview, and manual choice survives waves and levels',()=>{
 const f=fixture(),v=f.views;expect(v.selected).toBe('drone');v.sync('title',{});v.sync('loadout',{});v.sync('deploy',{});expect(v.active).toBeNull();expect(f.camera.view).toBe('overview');
 v.sync('wave',{});expect(v.active).toBe(f.drone);v.sync('settling',{});expect(v.active).toBe(f.drone);v.sync('loadout',{});expect(f.camera.view).toBe('overview');
 v.frame();v.bind({id:'next'});v.sync('wave',{});expect(v.selected).toBe('overview');expect(v.active).toBeNull();
 v.reset();v.sync('deploy',{});expect(v.selected).toBe('drone');expect(v.active).toBeNull();v.sync('wave',{});expect(v.active).toBe(f.drone);
});

// Use the actual camera/controllers for endpoint checks: a view choice must
// commit in the same sync call, before any display or simulation frame elapses.
import {Camera} from '../engine/camera.js';
import {ActionCamera} from '../play/action-camera.js';
import {DroneCamera} from '../play/drone-camera.js';
import {SceneryVisibility} from '../engine/visibility.js';
import {newLevel} from '../shared/level.js';
import {multiply} from '../shared/math.js';
function realFixture(id='camera-switch'){
 const c=new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{}),level=newLevel(id);level.size=[20,16];level.path=[[0,0,8],[1,0,8]];
 const world={level,width:480,length:384,actors:new Map(),rigs:new Map(),visibility:new SceneryVisibility(level,new Map())};
 c.setLevel(level);const d=new DroneCamera(c,{random:()=>.35}),o=new ActionCamera(c),v=new CameraViews(o,d);v.bind(world);
 return {c,d,o,v,world,engine:{time:0,enemies:{states:[],activeTargets:[]},firing:{states:[]},wildlife:{states:[]}},dispose(){d.dispose();o.dispose();c.dispose();world.visibility.dispose();}};
}
function projectionEndpoint(c,aspect,perspective){
 c.update(aspect);expect(c.projection[11]).toBe(perspective?-1:0);expect(c.projection[15]).toBe(perspective?0:1);
 const product=new Float32Array(16);multiply(product,c.vp,c.inverse);for(let i=0;i<16;i++)expect(product[i]).toBeCloseTo(i%5===0?1:0,2);
}

test('real camera switches immediately in both directions at every display rate and restores preparation framing',()=>{
 for(const aspect of [.8,1.5,2.4])for(const hz of [30,60,120]){
  const f=realFixture(),{c,d,o,v,engine}=f;
  try{
   c.update(aspect);const overview=[...c.target,c.yaw,c.pitch,c.radius];
   for(const phase of ['wave','loadout','wave','deploy','wave','defeat','wave','complete']){
    v.sync(phase,engine);const live=phase==='wave';expect(d.active).toBe(live);expect(c.mode).toBe(live?'live':'overview');projectionEndpoint(c,aspect,live);
    if(live)expect([...c.eye]).toEqual([...new Float32Array(d.position)]);
    else{expect([...c.target,c.yaw,c.pitch,c.radius]).toEqual(overview);expect([...o.position]).toEqual([...c.target,c.radius]);}
    engine.time+=1/hz;v.advance(1/hz,{engine,phase});projectionEndpoint(c,aspect,live);
   }
  }finally{f.dispose();}
 }
});

test('settling retains Drone, pause freezes its exact displayed pose and resumed flight stays smooth',()=>{
 const f=realFixture(),{c,d,v,engine}=f;
 try{
  v.sync('wave',engine);for(let i=0;i<60;i++){engine.time+=1/60;v.advance(1/60,{engine,phase:'wave'});}c.update(1.5);
  const position=[...d.position],time=d.time,matrix=[...c.vp];v.advance(4,{engine,phase:'wave',paused:true});c.update(1.5);expect([...c.vp]).toEqual(matrix);expect(d.time).toBe(time);
  v.sync('settling',engine);expect(d.active).toBe(true);expect([...d.position]).toEqual(position);
  engine.time+=1/60;v.advance(1/60,{engine,phase:'settling'});expect(d.time).toBeGreaterThan(time);expect(Math.hypot(...d.position.map((x,i)=>x-position[i]))).toBeLessThan(34/60+.001);
  v.sync('loadout',engine);expect(c.mode).toBe('overview');expect(d.active).toBe(false);
 }finally{f.dispose();}
});

test('real Frame, Auto, reset and landscape binding transfer ownership immediately without stale projection state',()=>{
 const f=realFixture(),{c,d,o,v,world,engine}=f;
 try{
  v.sync('wave',engine);c.update(1.5);v.frame();c.frame();expect(c.mode).toBe('overview');expect(v.active).toBeNull();expect(v.selected).toBe('overview');projectionEndpoint(c,1.5,false);
  v.toggle('drone');v.sync('wave',engine);expect(v.active).toBe(d);projectionEndpoint(c,1.5,true);
  v.toggleOverview();expect(v.active).toBeNull();expect(c.mode).toBe('overview');expect(o.enabled).toBe(true);projectionEndpoint(c,1.5,false);
  v.reset();v.sync('loadout',engine);expect(v.selected).toBe('drone');expect(v.active).toBeNull();v.sync('wave',engine);
  v.bind(null);expect(v.active).toBeNull();expect(c.mode).toBe('overview');expect(v.selected).toBe('drone');expect(d.world).toBeNull();expect(o.world).toBeNull();
  const next={...world,level:{...world.level,id:'next-landscape',path:[[4,0,4],[5,0,4]]}};c.setLevel(next.level);v.bind(next);v.sync('loadout',engine);const target=[...c.target];v.sync('wave',engine);projectionEndpoint(c,1.5,true);v.sync('loadout',engine);expect([...c.target]).toEqual(target);projectionEndpoint(c,1.5,false);
 }finally{f.dispose();}
});
