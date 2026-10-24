import {test,expect} from 'bun:test';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {PlaySession} from '../play/session.js';
import {PLAY_CONFIG} from '../play/config.js';

const ui=await readFile(new URL('../play/ui.js',import.meta.url),'utf8');
const app=await readFile(new URL('../play/app.js',import.meta.url),'utf8');
const unlock=ui.match(/const unlockLocation=[^\n]+/)[0];
const shopCode=ui.slice(ui.indexOf('function updateShop('),ui.indexOf('function updateWavePreview('));
const setText=(node,value)=>node.textContent=String(value);
const show=(node,visible)=>node.hidden=!visible;
function shop(snapshot){
 const shopRows=new Map(snapshot.shop.map(item=>[item.model,{row:{classList:{toggle(){}}},name:{},detail:{},button:{attributes:{},setAttribute(name,value){this.attributes[name]=value;}}}]));
 runInNewContext(unlock+'\n'+shopCode+'\nupdateShop(snapshot,false);',{snapshot,shopRows,setText,show,priceLabel:n=>`${n} token${n===1?'':'s'}`,document:{querySelector:()=>null}});
 return shopRows;
}

test('locked purchases name the actual campaign area in visible and accessible text',()=>{
 const session=new PlaySession();session.reset('loadout');
 const rows=shop(session.snapshot());
 expect(rows.get('arc-spire').detail.textContent).toBe('UNLOCK / A2');
 expect(rows.get('arc-spire').button.attributes['aria-label']).toBe('Arc Spire, available at Area A2');
 expect(rows.get('missile-launcher').detail.textContent).toBe('UNLOCK / A3');
 expect(rows.get('missile-launcher').button.disabled).toBe(true);
 const gun=rows.get('turret-study');
 expect(gun.detail.textContent).toBe('DMG 10 / RNG 48');
 expect(gun.button.attributes['aria-label']).toBe('Buy Gun for 1 token');
 expect(gun.button.disabled).toBe(false);
});

test('future within-area purchase gates retain their zone and wave',()=>{
 const config=structuredClone(PLAY_CONFIG);config.defences['arc-spire'].availableFromWave=19;
 for(const variant of Object.values(config.defences['arc-spire'].variants))variant.availableFromWave=19;
 const session=new PlaySession(config);session.reset('loadout');
 const entry=shop(session.snapshot()).get('arc-spire');
 expect(entry.detail.textContent).toBe('UNLOCK / B1 · WAVE 3');
 expect(entry.button.attributes['aria-label']).toBe('Arc Spire, available at Area B1 · WAVE 3');
 expect(entry.button.disabled).toBe(true);
});

test('locked upgrades show their actual area and wave while retaining eligibility',()=>{
 const config=structuredClone(PLAY_CONFIG);config.defences['turret-study'].variants.upgrade2.availableFromWave=19;
 const session=new PlaySession(config);session.reset('loadout');session.buy();session.upgrade(session.units[0].id);
 const snapshot=session.snapshot(),unit=snapshot.units[0],entry={upgrade:{}};
 const code=ui.slice(ui.indexOf('    show(entry.upgrade,'),ui.indexOf('    show(entry.undeploy,'));
 runInNewContext(unlock+'\n'+code,{unit,entry,snapshot,loadout:true,hasUpgrade:true,locked:false,setText,show,priceLabel:n=>`${n} token`});
 expect(entry.upgrade.textContent).toBe('Upgrade II · B1 · WAVE 3');
 expect(entry.upgrade.disabled).toBe(true);
 expect(entry.upgrade.hidden).toBe(false);
});

test('speed action name follows its target state and remains consistent with its tooltip',()=>{
 const code=ui.slice(ui.indexOf("  show(refs['speed-button']"),ui.indexOf("  show(refs['pause-button']"));
 for(const targetTimeScale of [1,2])for(const activeWave of [false,true])for(const locked of [false,true]){
  const button={attributes:{},setAttribute(name,value){this.attributes[name]=value;}};
  runInNewContext(code,{refs:{'speed-button':button},snapshot:{targetTimeScale},activeWave,locked,show});
  const action=targetTimeScale===2?'Return to normal speed':'Double game speed';
  expect(button.attributes['aria-label']).toBe(action);
  expect(button.title).toBe(action+' (T)');
  expect(button.attributes['aria-pressed']).toBe(String(targetTimeScale===2));
  expect(button.hidden).toBe(!activeWave);
  expect(button.disabled).toBe(locked||!activeWave);
 }
});

function actionFixture(action,session,selectedId=null){
 const events=[],scope={action,session,selectedId,id:session.units[0]?.id,notice:'',refreshPlacement:()=>events.push('placement'),paint:()=>events.push('paint'),canvas:{focus(options){events.push(['focus',options.preventScroll]);}}};
 const code=app.slice(app.indexOf("  if(action==='select'&&session.preparing)"),app.indexOf("  if(action==='upgrade')"));
 runInNewContext('(function(){'+code+'})()',scope);
 return {scope,events};
}

test('selecting a defence transfers focus to placement only during deployment',()=>{
 for(const phase of ['loadout','deploy','wave']){
  const session=new PlaySession();session.reset('loadout');session.buy();session.phase=phase;
  const {scope,events}=actionFixture('select',session);
  expect(scope.selectedId).toBe(phase==='wave'?null:session.units[0].id);
  expect(events).toEqual(phase==='wave'?[]:phase==='deploy'?['placement','paint',['focus',true]]:['placement','paint']);
 }
});

test('entering deployment focuses its automatically selected reserve after painting',()=>{
 const session=new PlaySession();session.reset('loadout');session.buy();
 const {scope,events}=actionFixture('deploy',session);
 expect(session.phase).toBe('deploy');expect(scope.selectedId).toBe(session.units[0].id);
 expect(events).toEqual(['placement','paint',['focus',true]]);
 const back=actionFixture('loadout',session,scope.selectedId);
 expect(session.phase).toBe('loadout');expect(back.events).toEqual(['placement','paint']);
});

test('entering deployment without a reserve leaves the normal control focus policy intact',()=>{
 const session=new PlaySession();session.reset('loadout');session.buy();session.units[0].box=[1,0,1];
 const {scope,events}=actionFixture('deploy',session);
 expect(scope.selectedId).toBeNull();expect(events).toEqual(['placement','paint']);
});
