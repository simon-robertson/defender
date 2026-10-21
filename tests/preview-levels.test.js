import {test,expect} from 'bun:test';
import {PREVIEW_LEVELS,previewLevelForId,previewLevelsForZone,PreviewSelection,previewShortcut} from '../shared/preview-levels.js';
import {SceneLoader} from '../engine/scene-loader.js';

test('catalogue contains A1 combat, fifteen independently selectable path layouts',()=>{
 expect(PREVIEW_LEVELS).toHaveLength(16);
 expect(new Set(PREVIEW_LEVELS.map(profile=>profile.level)).size).toBe(16);
 for(const [zone,prefix]of [['A','moss'],['B','ochre'],['C','ice'],['D','plum']]){
  const levels=previewLevelsForZone(zone),numbers=[1,2,3,4];expect(levels.map(profile=>profile.level)).toEqual(numbers.map(number=>prefix+'-0'+number));
  expect(levels.map(profile=>profile.number)).toEqual(numbers);expect(levels[1].description).toContain('Path layout preview');
  expect(levels.map(profile=>profile.previewMode)).toEqual(zone==='A'?['combat','layout','layout','layout']:['layout','layout','layout','layout']);
  // Historical ID-based tooling still identifies the former missile studies.
  expect(levels.map(profile=>profile.missiles)).toEqual([false,false,true,true]);
  expect(previewLevelForId(prefix+'-02')).toBe(levels[1]);expect(Object.isFrozen(levels[1])).toBe(true);
 }
 expect(previewLevelForId('moss-04').number).toBe(4);expect(previewLevelForId('ochre-04').number).toBe(4);expect(previewLevelsForZone('E')).toEqual([]);
 expect(previewLevelForId('moss-01').description).toContain('Drone combat preview');
 expect(previewLevelForId('moss-03').description).toContain('Path layout preview');
 expect(PREVIEW_LEVELS.filter(p=>p.previewMode==='combat')).toHaveLength(1);expect(PREVIEW_LEVELS.filter(p=>p.previewMode==='layout')).toHaveLength(15);expect(PREVIEW_LEVELS.filter(p=>p.previewMode==='landscape')).toHaveLength(0);
});
test('requested selection starts at A1 and retains the level number across zones',()=>{
 const selection=new PreviewSelection();expect(selection.profile.level).toBe('moss-01');
 expect(selection.selectLevel(2).level).toBe('moss-02');expect(selection.selectZone('B').level).toBe('ochre-02');
 expect(selection.selectZone('D').level).toBe('plum-02');expect(selection.selectLevel(1).level).toBe('plum-01');
 expect(selection.selectZone('A').level).toBe('moss-01');
 expect(selection.selectLevel(3).level).toBe('moss-03');expect(selection.selectZone('D').level).toBe('plum-03');
 expect(selection.selectZone('A').level).toBe('moss-03');expect(selection.selectLevel(4).level).toBe('moss-04');
 expect(selection.selectZone('B').level).toBe('ochre-04');
 for(const number of [1,2,3,4]){
  selection.selectLevel(number);
  for(const [zone,prefix]of [['C','ice'],['D','plum'],['A','moss'],['B','ochre']])expect(selection.selectZone(zone).level).toBe(prefix+'-0'+number);
 }
});
test('unavailable levels do nothing while a zone with fewer levels clamps the selection',()=>{
 const catalogue=PREVIEW_LEVELS.filter(profile=>profile.zone!=='B'||profile.number===1),selection=new PreviewSelection(catalogue);
 selection.selectLevel(2);expect(selection.selectLevel(5)).toBeNull();expect(selection.selectZone('E')).toBeNull();expect(selection.profile.level).toBe('moss-02');
 expect(selection.selectZone('B').level).toBe('ochre-01');expect(selection.selectZone('A').level).toBe('moss-01');
});
test('shifted punctuation selects levels and unshifted digits retain zone shortcuts',()=>{
 expect(previewShortcut({key:'!',code:'Digit1',shiftKey:true})).toEqual({kind:'level',number:1});
 for(const key of ['@','"','2'])expect(previewShortcut({key,code:'Digit2',shiftKey:true})).toEqual({kind:'level',number:2});
 expect(previewShortcut({key:'£',code:'Digit3',shiftKey:true})).toEqual({kind:'level',number:3});
 expect(previewShortcut({key:'$',code:'Digit4',shiftKey:true})).toEqual({kind:'level',number:4});
 expect(previewShortcut({key:'%',code:'Digit5',shiftKey:true})).toEqual({kind:'level',number:5});
 expect(previewShortcut({key:'2',shiftKey:true})).toEqual({kind:'level',number:2});
 for(const [key,zone]of [['1','A'],['2','B'],['3','C'],['4','D']])expect(previewShortcut({key,code:'Digit'+key,shiftKey:false})).toEqual({kind:'zone',zone});
 expect(previewShortcut({key:'5',code:'Digit5'})).toBeNull();expect(previewShortcut({key:')',code:'Digit0',shiftKey:true})).toBeNull();
});
test('shortcuts ignore repeated, modified, handled and editable-field events',()=>{
 const event={key:'@',code:'Digit2',shiftKey:true};
 for(const modifier of ['repeat','defaultPrevented','ctrlKey','metaKey','altKey'])expect(previewShortcut({...event,[modifier]:true})).toBeNull();
 for(const tagName of ['INPUT','TEXTAREA','SELECT'])expect(previewShortcut({...event,target:{tagName}})).toBeNull();
 expect(previewShortcut({...event,target:{isContentEditable:true}})).toBeNull();
 expect(previewShortcut({...event,target:{tagName:'BUTTON'}})).toEqual({kind:'level',number:2});
});
test('level requests during a pending zone load use the requested zone and only the latest activates',async()=>{
 const pending=new Map(),active=[],discarded=[],selection=new PreviewSelection();
 const loader=new SceneLoader({load:id=>new Promise(resolve=>pending.set(id,resolve)),activate:world=>active.push(world.id),release:()=>{},discard:world=>discarded.push(world.id)});
 const first=loader.switchTo(selection.selectZone('B').level);await Promise.resolve();
 const second=loader.switchTo(selection.selectLevel(2).level);await Promise.resolve();
 expect(loader.requestedId).toBe('ochre-02');expect(selection.profile.level).toBe('ochre-02');
 pending.get('ochre-02')({id:'ochre-02'});expect(await second).toBe(true);
 pending.get('ochre-01')({id:'ochre-01'});expect(await first).toBe(false);
 expect(active).toEqual(['ochre-02']);expect(discarded).toEqual(['ochre-01']);expect(loader.currentId).toBe('ochre-02');
 loader.dispose();
});
test('a failed level request keeps its requested selection and can be retried with the same button',async()=>{
 const selection=new PreviewSelection();let fail=true;
 const loader=new SceneLoader({load:async id=>{if(fail)throw new Error('missing source');return {id};},activate:()=>{},release:()=>{},discard:()=>{}});
 const profile=selection.selectLevel(2);expect(await loader.switchTo(profile.level)).toBe(false);
 expect(loader.currentId).toBeNull();expect(loader.requestedId).toBeNull();expect(selection.profile.level).toBe('moss-02');
 fail=false;expect(await loader.switchTo(selection.selectLevel(2).level)).toBe(true);expect(loader.currentId).toBe('moss-02');
 loader.dispose();
});
