import {test,expect} from 'bun:test';
import {readdir,readFile} from 'node:fs/promises';
import {BattleDirector} from '../play/battle-director.js';
import {BattleFraming,projectBattlePoint} from '../play/battle-framing.js';
import {Camera} from '../engine/camera.js';
import {PLAY_CONFIG} from '../play/config.js';
const world={width:480,length:384,level:{pathHeight:24,terrain:{boxes:[]}}};
const enemy=(id,x,z,extra={})=>({id,phase:'active',health:{alive:true},x,y:24,z,aimX:x,aimY:42,aimZ:z,distance:200,path:{length:1000},movement:{speed:12},...extra});
const gun=(id,target)=>({id,model:'turret-study',x:target.x+30,z:target.z,target,lineOfSight:true,cycle:{time:0,lastShotAt:0}});
function fixture(){const left=enemy('left',96,190),right=enemy('right',380,190),engine={time:0,enemies:{activeTargets:[left,right]},firing:{states:[gun('l',left),gun('r',right)]}},d=new BattleDirector();return {left,right,engine,d};}
function tick(f,time,{seen=true}={}){f.d.expose(time-f.engine.time,seen);f.engine.time=time;for(const gun of f.engine.firing.states){gun.cycle.time=time;gun.cycle.lastShotAt=time;}f.d.update(f.engine,world);}
test('current combat outranks patrols and idle structures, with no writes to combat state',()=>{
 const f=fixture();f.engine.firing.states.pop();const before=JSON.stringify(f.engine);f.d.update(f.engine,world);expect(f.d.intent.kind).toBe('combat');expect(f.d.intent.subject).toBe(f.left);expect(JSON.stringify(f.engine)).toBe(before);
 f.engine.firing.states.length=0;f.engine.time=4;f.d.update(f.engine,world);expect(f.d.intent.style).toBe('survey');
});
test('a readable shot hands over to comparable fighting without rapid reversals',()=>{
 const f=fixture();f.d.update(f.engine,world);const first=f.d.intent.subject.id;let changes=0,last=first;
 for(let n=1;n<=24;n++){tick(f,n*.35);if(f.d.intent.subject.id!==last){changes++;last=f.d.intent.subject.id;}}
 expect(changes).toBe(1);expect(last).not.toBe(first);
});
test('substantial new fighting takes over sooner, but a single remote burst does not interrupt a new shot',()=>{
 const f=fixture();f.engine.firing.states.pop();f.d.update(f.engine,world);f.d.note(380,42,190,.1,10);tick(f,.35);expect(f.d.intent.subject).toBe(f.left);
 for(let n=2;n<10;n++){f.d.note(380,42,190,n*.35,3);tick(f,n*.35);}
 expect(f.d.intent.subject).toBe(f.right);
});
test('exit pressure takes precedence and releases promptly after the threatening actor leaves',()=>{
 const f=fixture();f.d.update(f.engine,world);f.right.distance=970;for(let n=1;n<=5;n++)tick(f,n*.35);expect(f.d.intent.subject).toBe(f.right);expect(f.d.intent.style).toBe('danger');
 f.right.phase='escaped';f.right.health.alive=false;tick(f,2.1);expect(f.d.intent.subject).toBe(f.left);expect(f.d.intent.kind).toBe('combat');
});
test('a dominant battle gets dramatic and overview shots only after genuine screen time',()=>{
 const f=fixture();f.engine.enemies.activeTargets.pop();f.engine.firing.states.pop();f.d.update(f.engine,world);expect(f.d.intent.style).toBe('battle');
 for(let n=1;n<=18;n++)tick(f,n*.35,{seen:false});expect(f.d.intent.style).toBe('battle');
 for(let n=19;n<=37;n++)tick(f,n*.35);expect(f.d.intent.style).toBe('dramatic');
 for(let n=38;n<=56;n++)tick(f,n*.35);expect(f.d.intent.style).toBe('overview');
});
test('empty scenes keep one calm establishing intention instead of generating endless new shots',()=>{
 const f=fixture();f.engine.enemies.activeTargets=[];f.engine.firing.states=[];f.d.update(f.engine,world);const version=f.d.intent.version;for(let n=1;n<12;n++)tick(f,n*.35,{seen:false});expect(f.d.intent.version).toBe(version);expect(f.d.intent.style).toBe('survey');
});
test('projection agrees with the real game camera, including upward and exterior views',()=>{
 const c=new Camera({clientWidth:860,clientHeight:484,addEventListener(){},focus(){}},()=>{}),out=new Float64Array(3);
 for(const pose of [{x:500,y:90,z:230,yaw:1.2,pitch:.3,fov:56},{x:-15,y:49,z:298,yaw:5.05,pitch:.004,fov:56},{x:204,y:39,z:280,yaw:.27,pitch:-.09,fov:56}]){
  Object.assign(c,{mode:'live',...pose});c.position.set([pose.x,pose.y,pose.z]);c.update(860/484);
  for(const point of [[240,40,190],[0,24,0],[340,80,200]]){const p=projectBattlePoint(pose,...point,860/484,out),m=c.vp,[x,y,z]=point,w=m[3]*x+m[7]*y+m[11]*z+m[15];expect(p[0]).toBeCloseTo((m[0]*x+m[4]*y+m[8]*z+m[12])/w,3);expect(p[1]).toBeCloseTo((m[1]*x+m[5]*y+m[9]*z+m[13])/w,3);}
 }c.dispose();
});

export function engineFromShot(shot){
 const s=shot.scene,targets=s.enemies.map(e=>enemy(e.id,e.position[0],e.position[2],{model:e.model,y:e.position[1],aimX:e.aim[0],aimY:e.aim[1],aimZ:e.aim[2],distance:e.distance,path:{length:e.routeLength},movement:{speed:PLAY_CONFIG.enemies[e.model].speed},airborne:e.airborne})),byId=new Map(targets.map(s=>[s.id,s]));
 const guns=s.defences.filter(s=>s.model!=='power-generator').map(s=>({id:s.id,model:s.model,x:s.position[0],z:s.position[2],target:byId.get(s.targetId),lineOfSight:s.lineOfSight,rig:{root:{13:s.position[1]}},cycle:{time:s.seconds,lastShotAt:s.seconds}}));
 const d=new BattleDirector();for(const e of s.activity)d.note(e.x,e.y,e.z,e.at,e.weight);const engine={time:s.seconds,enemies:{activeTargets:targets},firing:{states:guns}};return {d,engine};
}
test('the player’s preferred split-front view scores above the rejected view of the same frozen battle',async()=>{
 const dir=new URL('../project-docs/drone-camera-study/shots/',import.meta.url),shots=await Promise.all((await readdir(dir)).filter(f=>f.endsWith('.json')).map(async file=>JSON.parse(await readFile(new URL(file,dir),'utf8'))));
 expect(shots.length).toBeGreaterThanOrEqual(16);const preferred=shots.find(s=>s.id==='6ae13f30-f9ff-40af-8988-a4cca23266c9'),avoid=shots.find(s=>s.verdict==='avoid');
 const source=JSON.parse(await readFile(new URL(`../assets/levels/${preferred.scene.levelId}.json`,import.meta.url),'utf8')),w={level:source,width:source.size[0]*24,length:source.size[1]*24},f=new BattleFraming(),{d,engine}=engineFromShot(preferred);f.bind(w);d.update(engine,w);
 function score(s){const c=s.camera;return {...f.evaluate({x:c.position[0],y:c.position[1],z:c.position[2],yaw:c.yaw,pitch:c.pitch,fov:c.fov},d,c.viewport[0]/c.viewport[1])};}
 const good=score(preferred),bad=score(avoid);console.log({preferred:good,rejected:bad,style:d.intent.style,anchor:Array.from(d.intent.anchor)});expect(good.score).toBeGreaterThan(bad.score+.1);expect(good.action).toBeGreaterThan(bad.action);
});
