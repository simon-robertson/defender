// The old speculative defence-forecast director was retired by the rebuild.
// Approach shots now show incoming enemies with broad level context.
import {test,expect} from 'bun:test';
import {BattleDirector} from '../play/battle-director.js';
import {DroneCamera} from '../play/drone-camera.js';
import {Camera} from '../engine/camera.js';
const camera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
test('pre-combat approach framing follows arrivals without promoting idle defences over fighting',()=>{
 const world={width:480,length:384,level:{pathHeight:24}},target={id:'arrival',phase:'active',health:{alive:true},x:120,y:24,z:180,aimX:120,aimY:40,aimZ:180,distance:40,path:{length:1000},movement:{speed:12}},gun={id:'idle',model:'turret-study',x:350,z:200,target:null,lineOfSight:false,cycle:{time:0,lastShotAt:-Infinity}},engine={time:0,enemies:{activeTargets:[target]},firing:{states:[gun]}},d=new BattleDirector();
 d.update(engine,world);expect(d.intent.kind).toBe('approach');expect(d.intent.style).toBe('survey');expect(d.count).toBe(1);
 const snapshot=JSON.stringify(engine);d.expose(2,true);engine.time=2;d.update(engine,world);expect(d.intent.subject).toBe(target);engine.time=0;expect(JSON.stringify(engine)).toBe(snapshot);
 engine.time=3;gun.target=target;gun.lineOfSight=true;gun.cycle.time=gun.cycle.lastShotAt=3;d.update(engine,world);expect(d.intent.kind).toBe('combat');expect(d.intent.style).toBe('battle');expect(d.count).toBe(2);
});
test('drone derives its gimbal from the fixed anchor without depth-of-field state',()=>{
 const c=camera(),d=new DroneCamera(c);d.position.set([100,224,100]);d.focus.set([200,24,0]);
 const position=[...d.position],focus=[...d.focus];d.aim();
 expect(d.yaw).toBeCloseTo(-Math.PI/4,10);expect(d.pitch).toBeCloseTo(Math.atan2(200,Math.sqrt(20000)),10);expect([...d.position]).toEqual(position);expect([...d.focus]).toEqual(focus);
 d.apply();expect(c.yaw).toBe(d.yaw);expect(c.pitch).toBe(d.pitch);expect(d.focusDistance).toBeUndefined();expect(c.focusDistance).toBeUndefined();
});
