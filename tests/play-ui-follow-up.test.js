import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PlaySession} from '../play/session.js';
import {PLAY_CONFIG} from '../play/config.js';
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8'),ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8');
const snapshotCode=app.slice(app.indexOf('function snapshot('),app.indexOf('function applyCameraPresentation('));
const loadingCall=ui.match(/show\(refs\.loading,[^;]+;/)[0];
test('Drone view names the click-drag gesture in markup, runtime hints and accessible instructions',async()=>{
 const html=await readFile(new URL('../play/index.html',import.meta.url),'utf8');
 expect(html).toContain('id="drone-camera-format">Click and drag to target</span>');
 const scope={screenshot:false,droneActive:true,phase:'wave',filming:true,refs:{'drone-camera-format':'format','board-caption':'caption'},text:{},setText:(node,value)=>scope.text[node]=value};
 runInNewContext(ui.match(/const canvasLabel=[^;]+;/)[0]+';globalThis.label=canvasLabel;',scope);
 runInNewContext(ui.match(/setText\(refs\['drone-camera-format'\],[^;]+;/)[0]+ui.match(/setText\(refs\['board-caption'\],[^;]+;/)[0],scope);
 expect(scope.label).toContain('Hold either mouse button and drag');expect(scope.text.format).toBe('Click and drag to target');expect(scope.text.caption).toBe('Drone-cam active.');
});
test('centred Drone hint hides after targeting and while interaction is unavailable',()=>{
 const statement=ui.match(/show\(refs\['drone-camera-format'\],[^;]+;/)[0];
 for(const [change,expected] of [[{},true],[{snapshot:{droneCameraHintDismissed:true}},false],[{phase:'settling'},false],[{filming:false},false],[{paused:true},false],[{busy:true},false],[{error:true},false],[{snapshot:{leaveOpen:true}},false]]){
  const scope={filming:true,phase:'wave',paused:false,busy:false,error:false,snapshot:{},refs:{'drone-camera-format':{}},show:(_,visible)=>scope.visible=visible,...change};runInNewContext(statement,scope);expect(scope.visible).toBe(expected);
 }
});
test('loading follows the requested scene: title backdrops stay clear, real starts and Continue retain the panel',()=>{
 for(const [phase,candidatePhase,busy,error,expected]of [['title',null,true,'',false],['title','title',true,'',false],['title','loadout',true,'',true],['wave','title',true,'',false],['wave','loadout',true,'',true],['loadout',null,false,'',false],['title','loadout',true,'Failed',false]]){
  const session=new PlaySession();session.phase=phase;const candidate=session.fork();candidate.phase=candidatePhase;
  const scope={loop:null,session,audio:{volume:.8},pendingSpec:candidatePhase?{candidate}:null,engine:null,config:PLAY_CONFIG,graphics:{},optionsOpen:false,leaveOpen:false,savedGame:null,savingProgress:false,saveError:'',screenshotCamera:null,busy,error,notice:'',selectedId:null,actionCamera:null,droneCamera:null,loader:null,hover:null};
  runInNewContext(snapshotCode+';globalThis.result=snapshot();',scope);
  expect(scope.result.droneCameraHintDismissed).toBe(false);scope.droneCamera={hasTargeted:true};runInNewContext(snapshotCode+';globalThis.result=snapshot();',scope);expect(scope.result.droneCameraHintDismissed).toBe(true);
  let visible;runInNewContext(loadingCall,{refs:{loading:{}},busy,error,phase,snapshot:scope.result,show:(_,value)=>visible=value});expect(visible).toBe(expected);
 }
});
const positionCode=ui.slice(ui.indexOf('function positionBriefing('),ui.indexOf('function focusable('));
function tooltipFixture(){
 const row={getBoundingClientRect:()=>({left:900,top:300,bottom:380}),closest:()=>null},briefing={hidden:true,style:{},getBoundingClientRect:()=>({width:280,height:160})},entry={row,briefing,hasComparison:true};
 const scope={rows:new Map([['gun',entry]]),briefingEnabled:true,briefingHover:'gun',briefingFocus:null,innerHeight:720,refs:{'unit-list':{closest:()=>({getBoundingClientRect:()=>({top:200,bottom:600})})}},show:(node,visible)=>node.hidden=!visible};
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

test('upgrade comparisons follow actual affordability, unlock and tier eligibility',()=>{
 const disabled=ui.match(/entry\.upgrade\.disabled=[^;]+;/)[0],comparison=ui.match(/const comparison=[^;]+;/)[0];
 const session=new PlaySession();session.reset('loadout');session.buy();
 function inspect(locked=false){const unit=session.snapshot().units[0],entry={upgrade:{}};const scope={unit,entry,hasUpgrade:Boolean(unit.nextVariant),loadout:session.phase==='loadout',locked,upgradeComparison:()=>true};runInNewContext(disabled+comparison+';globalThis.result=comparison;',scope);return scope.result;}
 expect(inspect()).toBe(true);expect(inspect(true)).toBeNull();session.tokens=0;expect(inspect()).toBeNull();session.tokens=1;session.upgrade(session.units[0].id);session.tokens=10;expect(inspect()).toBeNull();session.units[0].variant='upgrade2';expect(inspect()).toBeNull();
});
test('selection alone does not open or retain the comparison; only upgrade hover/focus does',()=>{
 const {scope,entry}=tooltipFixture();scope.position();expect(entry.briefing.hidden).toBe(false);scope.briefingHover=null;scope.position();expect(entry.briefing.hidden).toBe(true);scope.briefingFocus='gun';scope.position();expect(entry.briefing.hidden).toBe(false);
 const clear=ui.match(/if\(button\.dataset\.action==='select'\)\{[^}]+\}/)[0];scope.briefingHover='gun';scope.button={dataset:{action:'select'}};scope.positionBriefing=scope.position;runInNewContext(clear,scope);
 expect(scope.briefingHover).toBeNull();expect(scope.briefingFocus).toBeNull();expect(entry.briefing.hidden).toBe(true);
});

test('the temporary sound control lock survives UI updates and rejects slider events',()=>{
 const lock=ui.match(/soundLevel\.disabled=[^;]+;/)[0],control={disabled:false};runInNewContext(lock,{soundLevel:control});expect(control.disabled).toBe(true);
 const code=app.slice(app.indexOf("document.addEventListener('input',event=>{"),app.indexOf("document.addEventListener('change',async event=>{"));let handler,changes=0;
 runInNewContext(code,{document:{addEventListener:(_,fn)=>handler=fn},disposed:false,busy:false,error:'',session:{phase:'title'},optionsOpen:true,audio:{setVolume(){changes++;}}});
 handler({target:{closest:()=>({disabled:true,value:'100'})}});expect(changes).toBe(0);
});
