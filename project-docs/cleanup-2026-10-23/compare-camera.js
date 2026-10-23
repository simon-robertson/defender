// Run with: bun project-docs/cleanup-2026-10-23/compare-camera.js
// The retained baseline is the player's accepted foreground-orbit commit.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {Camera} from '../../engine/camera.js';
import {STUDY_SCENARIOS} from '../../tools/camera-study-scenarios.js';
import {createStudyScene} from '../../tools/camera-study-scene.js';
const root=new URL('../../',import.meta.url),baseline='9b9a186',cleanup='ef7677e';
function oldModule(ref,path,flight){
 let source=execFileSync('git',['show',ref+':'+path],{cwd:root,encoding:'utf8'});
 source=source.replace(/from '([^']+)'/g,(_,specifier)=>"from '"+(specifier==='./drone-flight.js'?flight:new URL(specifier,new URL(path,root)).href)+"'");
 return 'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
}
const flight=oldModule(baseline,'play/drone-flight.js'),{DroneCamera:Before}=await import(oldModule(baseline,'play/drone-camera.js',flight));
const currentFlight=oldModule(cleanup,'play/drone-flight.js'),{DroneCamera}=await import(oldModule(cleanup,'play/drone-camera.js',currentFlight));
const makeCamera=()=>new Camera({clientWidth:1500,clientHeight:1000,addEventListener(){},focus(){}},()=>{});
const report={baseline,cleanup,cameraFrames:0,baselineAimCalls:0,currentAimCalls:0,scenarios:[]};
const nativeFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 const match=/^\/api\/(levels|models)\/([a-z0-9-]+)$/.exec(url);assert.ok(match,'Unexpected asset request');
 return {ok:true,json:async()=>({asset:await Bun.file(new URL(`assets/${match[1]}/${match[2]}.json`,root)).json()})};
};
try{
 for(const hz of [30,60,120]){
  const pair=[];const scene=await createStudyScene(STUDY_SCENARIOS.find(s=>s.id==='split'),{onActivity:(kind,x,y,z,at,weight)=>{if(kind!=='shot')for(const d of pair)d.noteActivity(x,y,z,at,weight);}});
  const before=new Before(makeCamera()),after=new DroneCamera(makeCamera());pair.push(before,after);
  for(const [i,d] of pair.entries()){
   const aim=d.aim;d.aim=function(){report[i===0?'baselineAimCalls':'currentAimCalls']++;return aim.call(this);};d.bind(scene.world);d.setEnabled(true);d.sync('wave',scene.engine);
  }
  try{
   for(let frame=0;frame<hz*20;frame++){
    if(frame===hz*3)for(const d of pair)d.targetAt(0,24,0);
    if(frame===hz*8)for(const d of pair)d.rotate(-70,25);
    scene.engine.advance(1/hz);for(const d of pair)d.advance(1/hz,{engine:scene.engine,phase:'wave'});
    assert.deepEqual(after.stats(),before.stats(),`Displayed camera mismatch at ${hz} Hz frame ${frame}`);report.cameraFrames++;
   }
   report.scenarios.push({id:'split',hz,seconds:scene.engine.time,blockedMoves:after.blockedMoves,focus:[...after.focus],killed:scene.engine.enemies.killed,escaped:scene.engine.enemies.escaped});
  }finally{for(const d of pair)d.dispose();scene.dispose();}
 }
 report.result='exact-match';
}finally{globalThis.fetch=nativeFetch;}
await writeFile(new URL('camera-comparison.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
