import assert from 'node:assert/strict';
const source=await Bun.file(new URL('../../play/app.js',import.meta.url)).text();
const snapshot=source.slice(source.indexOf('function snapshot('),source.indexOf('function applyCameraPresentation('));
const telemetry=source.slice(source.indexOf('function paint('),source.indexOf('function fail('));
const run=new Function('assert',`
let now=0,writes=0,statsCalls=0,snapshots=0,lastDiagnostics=-Infinity,diagnosticsPending=false;
const canvas={dataset:new Proxy({}, {set(target,key,value){writes++;target[key]=value;return true;}})},performance={now:()=>now};
const session={paused:false,phase:'wave',level:{id:'moss-01'},wave:{spawns:[]},placements:[],snapshot(){snapshots++;return {phase:this.phase};}};
const engine={stats(){statsCalls++;return {time:2,active:1,spawned:1};},wildlife:{fish:{stats:()=>({})}},firing:{turrets:{states:[]}}};
const screenshotCamera={active:false},cameraViews={sync(){}},renderUI=()=>{},applyCameraPresentation=()=>{},updateHighlight=()=>{},renderer=null,loader=null,actionCamera=null,droneCamera=null;
const busy=false,error='',notice='',selectedId=null,hover=null,hint={textContent:''},damage={},performanceReadout={stats:()=>({})},eligible=[];
${snapshot}
${telemetry}
paint();assert.equal(writes,1);assert.equal(statsCalls,1);assert.equal(snapshots,1);
for(now=1;now<200;now++)diagnostics(undefined,undefined,false);
assert.equal(writes,1);assert.equal(statsCalls,1);assert.equal(snapshots,1);assert.equal(diagnosticsPending,true);
now=200;diagnostics(undefined,undefined,false);assert.equal(writes,2);assert.equal(statsCalls,2);assert.equal(snapshots,2);assert.equal(diagnosticsPending,false);
now=201;session.phase='loadout';paint();assert.equal(writes,3);assert.equal(JSON.parse(canvas.dataset.play).phase,'loadout');assert.equal(statsCalls,3);assert.equal(snapshots,3);
return {passed:true,initialPaint:{engineStats:1,sessionSnapshots:1},skippedCosmeticCalls:199,skippedSnapshots:0,forcedLifecycleImmediate:true};
`);
console.log(JSON.stringify(run(assert)));
