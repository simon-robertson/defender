import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {FrameClock} from '../engine/clock.js';
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8'),ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8'),html=await readFile(new URL('../play/index.html',import.meta.url),'utf8');
const toggle=app.slice(app.indexOf('function toggleSpeed(){'),app.indexOf('function snapshot('));
function fixture(){
 const clock=new FrameClock();let paints=0;const scope={disposed:false,busy:false,error:'',document:{hidden:false},frozen:()=>false,session:{phase:'wave'},loop:{clock},paint(){paints++;}};
 runInNewContext(toggle+';globalThis.toggle=toggleSpeed;',scope);return {clock,scope,paints:()=>paints};
}
test('the shared speed action toggles both ways smoothly and rejects unavailable phases and frozen input',()=>{
 const f=fixture();f.clock.tick(0);expect(f.scope.toggle()).toBe(true);expect(f.clock.targetTimeScale).toBe(2);expect(f.clock.timeScale).toBe(1);f.clock.tick(300);expect(f.clock.timeScale).toBeCloseTo(1.5);
 expect(f.scope.toggle()).toBe(true);expect(f.clock.targetTimeScale).toBe(1);expect(f.clock.timeScale).toBeCloseTo(1.5);f.clock.tick(900);expect(f.clock.timeScale).toBe(1);expect(f.paints()).toBe(2);
 for(const phase of ['title','loadout','deploy','defeat','complete']){f.scope.session.phase=phase;expect(f.scope.toggle()).toBe(false);}
 for(const block of [s=>s.busy=true,s=>s.error='error',s=>s.disposed=true,s=>s.document.hidden=true,s=>s.frozen=()=>true]){const f=fixture();block(f.scope);expect(f.scope.toggle()).toBe(false);expect(f.clock.targetTimeScale).toBe(1);}
 f.scope.session.phase='settling';expect(f.scope.toggle()).toBe(true);
});
test('T and the button share the action; repeats, editing and browser modifiers do not trigger it',()=>{
 const code=app.slice(app.indexOf(" if(event.key.toLowerCase()==='t'"),app.indexOf(" if(event.key.toLowerCase()==='p'"));
 for(const patch of [{},{repeat:true},{ctrlKey:true},{metaKey:true},{altKey:true},{target:{tagName:'INPUT'}},{target:{isContentEditable:true}}]){
  let toggles=0,prevented=0;const event={key:'T',repeat:false,ctrlKey:false,metaKey:false,altKey:false,target:{tagName:'CANVAS'},preventDefault(){prevented++;},...patch};
  runInNewContext('(function(){'+code+'})()',{event,toggleSpeed:()=>{toggles++;return true;}});expect(toggles).toBe(Object.keys(patch).length?0:1);expect(prevented).toBe(toggles);
 }
 expect(app).toContain("if(action==='speed'){toggleSpeed();return;}");expect(html).toContain('aria-keyshortcuts="T"');expect(ui).toContain("const waveActions=['title','pause','speed'];");
});
test('speed button reports its target state and locks when play is unavailable',()=>{
 const code=ui.slice(ui.indexOf("  show(refs['speed-button']"),ui.indexOf("  show(refs['pause-button']"));
 for(const targetTimeScale of [1,2])for(const locked of [false,true]){
  const attrs={},button={setAttribute:(key,value)=>attrs[key]=value};
  runInNewContext(code,{refs:{'speed-button':button},activeWave:true,locked,snapshot:{targetTimeScale},show:(node,value)=>node.hidden=!value});
  expect(button.disabled).toBe(locked);expect(attrs['aria-pressed']).toBe(String(targetTimeScale===2));expect(button.title).toContain('(T)');
 }
 const f=fixture();f.scope.toggle();f.clock.tick(0);f.clock.tick(600);
 const reset=app.match(/if\(loop&&!\['wave','settling'\]\.includes\(session.phase\)\)loop.clock.setTimeScale\(1\);/)[0];
 runInNewContext(reset,{loop:{clock:f.clock},session:{phase:'deploy'}});expect(f.clock.timeScale).toBe(1);expect(f.clock.targetTimeScale).toBe(1);
 expect(app).toContain('screenshotCamera.advance(loop.clock.unscaledDeltaSeconds)');
});

test('real playable movement and effects receive the same accelerated fixed ticks at 30/60/120 Hz',async()=>{
 const {PLAY_CONFIG}=await import('../play/config.js'),{loadPlayWorld,disposePlayWorld,PlayEngine}=await import('../play/engine.js');
 const native=globalThis.fetch;globalThis.fetch=async url=>{const [,kind,id]=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);return {ok:true,json:async()=>({asset:await Bun.file(new URL(`../assets/${kind}/${id}.json`,import.meta.url)).json()})};};
 let expected;
 try{for(const hz of [30,60,120]){
  let world,engine,effectTime=0;
  try{
   const wave=PLAY_CONFIG.levels[0].waves[0];world=await loadPlayWorld('moss-01',{wave,critters:false});engine=new PlayEngine(world,{wave,onStep:dt=>effectTime+=dt});engine.startWave();
   const clock=new FrameClock();clock.tick(0);clock.setTimeScale(2,{transitionSeconds:.6});for(let n=1;n<=hz;n++)engine.advance(clock.tick(n*1000/hz));
   expect(engine.waveTime).toBeCloseTo(1.7,8);expect(effectTime).toBeCloseTo(1.7,8);expect(engine.steps).toBe(204);
   const state=engine.enemies.states.map(s=>[s.phase,s.distance,s.x,s.y,s.z]);if(expected)expect(state).toEqual(expected);else expected=state;
  }finally{engine?.dispose();disposePlayWorld(world);}
 }}finally{globalThis.fetch=native;}
});
