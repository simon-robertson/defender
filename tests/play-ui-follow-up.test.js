import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PlaySession} from '../play/session.js';
import {PLAY_CONFIG} from '../play/config.js';
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8'),ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8');
const snapshotCode=app.slice(app.indexOf('function snapshot('),app.indexOf('function applyCameraPresentation('));
const loadingCall=ui.match(/show\(refs\.loading,[^;]+;/)[0];
test('loading follows the requested scene: title backdrops stay clear, real starts and Continue retain the panel',()=>{
 for(const [phase,candidatePhase,busy,error,expected]of [['title',null,true,'',false],['title','title',true,'',false],['title','loadout',true,'',true],['wave','title',true,'',false],['wave','loadout',true,'',true],['loadout',null,false,'',false],['title','loadout',true,'Failed',false]]){
  const session=new PlaySession();session.phase=phase;const candidate=session.fork();candidate.phase=candidatePhase;
  const scope={session,audio:{volume:.8},pendingSpec:candidatePhase?{candidate}:null,engine:null,config:PLAY_CONFIG,graphics:{},optionsOpen:false,leaveOpen:false,savedGame:null,savingProgress:false,saveError:'',screenshotCamera:null,busy,error,notice:'',selectedId:null,actionCamera:null,droneCamera:null,loader:null,hover:null};
  runInNewContext(snapshotCode+';globalThis.result=snapshot();',scope);
  let visible;runInNewContext(loadingCall,{refs:{loading:{}},busy,error,phase,snapshot:scope.result,show:(_,value)=>visible=value});expect(visible).toBe(expected);
 }
});
const positionCode=ui.slice(ui.indexOf('function positionBriefing('),ui.indexOf('function focusable('));
function tooltipFixture(){
 const row={getBoundingClientRect:()=>({left:900,top:300,bottom:380}),closest:()=>null},briefing={hidden:true,style:{},getBoundingClientRect:()=>({width:280,height:160})},entry={row,briefing,hasComparison:true};
 const scope={rows:new Map([['gun',entry]]),briefingEnabled:true,briefingHover:null,briefingFocus:null,briefingSelection:'gun',innerHeight:720,refs:{'unit-list':{closest:()=>({getBoundingClientRect:()=>({top:200,bottom:600})})}},show:(node,visible)=>node.hidden=!visible};
 runInNewContext(positionCode+';globalThis.position=positionBriefing;',scope);return {scope,entry};
}
test('comparison sits left of the row and clamps within the viewport',()=>{
 const {scope,entry}=tooltipFixture();scope.position();expect(entry.briefing.hidden).toBe(false);expect(entry.briefing.style.left).toBe('608px');expect(entry.briefing.style.top).toBe('300px');
 entry.row.getBoundingClientRect=()=>({left:100,top:580,bottom:620});scope.position();expect(entry.briefing.style.left).toBe('8px');expect(entry.briefing.style.top).toBe('552px');
});
test('comparisons disappear when locked, unsupported, scrolled away or covered by a modal',()=>{
 for(const change of [f=>f.scope.briefingEnabled=false,f=>f.entry.hasComparison=false,f=>f.entry.row.getBoundingClientRect=()=>({left:900,top:601,bottom:681}),f=>f.entry.row.closest=()=>({})]){
  const f=tooltipFixture();f.scope.position();change(f);f.scope.position();expect(f.entry.briefing.hidden).toBe(true);
 }
});
