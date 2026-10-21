import {test,expect} from 'bun:test';
import {UnitHighlight,UnitOutlineGeometry} from '../play/unit-highlight.js';
import {meshPart} from '../shared/mesher.js';
import {identity,placementMatrix} from '../shared/math.js';
import {PoseRig} from '../engine/rig.js';
import {Camera} from '../engine/camera.js';
import {PLAY_CONFIG,createPlayConfig} from '../play/config.js';
import {UnitRangeGeometry,unitRangePreview} from '../play/range-preview.js';

const model=await Bun.file(new URL('../assets/models/turret-study.json',import.meta.url)).json();
class Element {
 constructor(document,tag='div'){this.ownerDocument=document;this.tagName=tag;this.children=[];this.parentNode=null;this.dataset={};this.style={};this.attributes=new Map();this.listeners=new Map();this.className='';this.textContent='';this.clientWidth=960;this.clientHeight=640;}
 append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
 remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
 contains(node){return Boolean(node)&&(node===this||this.children.some(child=>child.contains(node)));}
 closest(selector){let node=this;while(node){if(selector==='[data-action="upgrade"]'?node.dataset.action==='upgrade':node.className.split(' ').includes('unit-row')&&node.dataset.unit)return node;node=node.parentNode;}return null;}
 setAttribute(key,value){this.attributes.set(key,String(value));if(key==='data-unit')this.dataset.unit=String(value);}
 removeAttribute(key){this.attributes.delete(key);if(key==='data-unit')delete this.dataset.unit;}
 getAttribute(key){return this.attributes.get(key)??null;}
 hasAttribute(key){return this.attributes.has(key);}
 addEventListener(type,handler){let handlers=this.listeners.get(type);if(!handlers){handlers=new Set();this.listeners.set(type,handlers);}handlers.add(handler);}
 removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
 emit(type,event){for(const handler of this.listeners.get(type)??[])handler(event);}
}
function fixture(){
 const document={activeElement:null,createElementNS(ns,tag){return new Element(this,tag);},addEventListener(){}};
 const canvas=new Element(document,'canvas'),list=new Element(document),overlay=new Element(document,'svg'),world={entries:[],rigs:new Map()},poses=new Map();
 const entries=new Map();
 for(const[id,variant,box]of[['one','base',[8,0,7]],['two','upgrade1',[11,0,9]]]){
  const parts=model.variants[variant].parts,root=placementMatrix(box,0);root[13]=24;
  const rig={model:model.id,role:'defence',variant,root,parts,instances:parts.map(part=>{
   const key=`${model.id}:${variant}:${part.id}`;if(!entries.has(key))entries.set(key,{key,mesh:meshPart(model,part)});
   return {part:part.id,key,index:0,matrix:identity()};
  })};
  const pose=new PoseRig(rig,()=>{});pose.invalidateRoot();pose.update();world.rigs.set(id,rig);poses.set(id,pose);
 }
 world.entries.push(...entries.values());
 const camera=new Camera(canvas,()=>{});camera.setLevel({size:[20,16],path:[],pathHeight:24,terrain:{defaultHeight:24,boxes:[]}});camera.update(1.5);
 const controls={};for(const id of ['one','two','unplaced']){const row=new Element(document);row.className='unit-row';row.dataset.unit=id;const select=new Element(document,'button'),upgrade=new Element(document,'button');select.dataset.action='select';upgrade.dataset.action='upgrade';row.append(select,upgrade);list.append(row);controls[id]={row,select,upgrade};}
 const units=[{id:'one',variant:'base',deployed:true,label:'Gun 01'},{id:'two',variant:'upgrade1',deployed:true,label:'Gun 02'},{id:'unplaced',variant:'base',deployed:false,label:'Gun 03'}];
 return {document,canvas,list,overlay,world,camera,poses,controls,units};
}
const signed=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function project(vp,m,x,y,z,width,height){const wx=m[0]*x+m[4]*y+m[8]*z+m[12],wy=m[1]*x+m[5]*y+m[9]*z+m[13],wz=m[2]*x+m[6]*y+m[10]*z+m[14],w=vp[3]*wx+vp[7]*wy+vp[11]*wz+vp[15];return {x:((vp[0]*wx+vp[4]*wy+vp[8]*wz+vp[12])/w+1)*width/2,y:(1-(vp[1]*wx+vp[5]*wy+vp[9]*wz+vp[13])/w)*height/2};}
function verifyHull(f,geometry,id){
 const width=f.canvas.clientWidth,height=f.canvas.clientHeight,hull=geometry.project(f.world,f.camera,id,width,height);expect(hull.length).toBeGreaterThan(4);
 const meshes=new Map(f.world.entries.map(entry=>[entry.key,entry.mesh]));let checked=0;
 for(const instance of f.world.rigs.get(id).instances){const vertices=meshes.get(instance.key).vertices;
  for(let i=0;i<vertices.length;i+=11){const point=project(f.camera.vp,instance.matrix,vertices[i],vertices[i+1],vertices[i+2],width,height);for(let edge=0;edge<hull.length;edge++)expect(signed(hull[edge],hull[(edge+1)%hull.length],point)).toBeGreaterThanOrEqual(-1e-6);checked++;}
 }
 return {points:hull.map(point=>({...point})),checked};
}

test('outline encloses actual articulated base/upgrade meshes, follows camera and preserves source/matrices',()=>{
 const f=fixture(),geometry=new UnitOutlineGeometry(),source=JSON.stringify(model);
 for(const id of ['one','two']){
  let previous;
  for(const[yaw,pitch,recoil]of[[0,0,0],[.8,.5,.9],[-1.4,-.5,1.25]]){
   const pose=f.poses.get(id);pose.setRotation('head',0,yaw,0);pose.setRotation('guns',pitch,0,0);pose.setTranslation('guns',0,0,recoil);pose.update();
   const before=f.world.rigs.get(id).instances.map(instance=>[...instance.matrix]),result=verifyHull(f,geometry,id);expect(result.checked).toBeGreaterThan(100);
   expect(f.world.rigs.get(id).instances.map(instance=>[...instance.matrix])).toEqual(before);
   if(previous)expect(result.points).not.toEqual(previous);previous=result.points;
  }
 }
 const before=verifyHull(f,geometry,'one').points;f.camera.yaw+=.4;f.camera.update(1.5);expect(verifyHull(f,geometry,'one').points).not.toEqual(before);
 expect(JSON.stringify(model)).toBe(source);geometry.dispose();expect(geometry.world).toBeNull();
});

test('projection reuses unchanged work, follows in-place upgrades/moves and rejects absent or offscreen rigs',()=>{
 const f=fixture(),g=new UnitOutlineGeometry(),first=g.project(f.world,f.camera,'one',960,640),points=g.points,sorted=g.sorted;
 expect(first).not.toBeNull();expect(g.changed).toBe(true);expect(g.project(f.world,f.camera,'one',960,640)).toBe(first);expect(g.changed).toBe(false);expect(g.points).toBe(points);expect(g.sorted).toBe(sorted);
 const before=first.map(point=>({...point}));f.world.rigs.get('one').root[12]+=24;f.poses.get('one').invalidateRoot();f.poses.get('one').update();expect(g.project(f.world,f.camera,'one',960,640)).not.toEqual(before);
 f.world.rigs.set('one',f.world.rigs.get('two'));expect(g.project(f.world,f.camera,'one',960,640)).not.toEqual(before);
 expect(g.project(f.world,f.camera,'missing',960,640)).toBeNull();expect(g.project(f.world,f.camera,'one',0,640)).toBeNull();
 f.camera.target[0]=100000;f.camera.update(1.5);expect(g.project(f.world,f.camera,'two',960,640)).toBeNull();
});

test('whole-row hover including upgrade outranks keyboard focus; leave restores only live focus',()=>{
 const f=fixture(),highlight=new UnitHighlight(f);highlight.update({...f,preparing:true});
 f.document.activeElement=f.controls.one.select;f.list.emit('focusin',{target:f.controls.one.select});expect(f.overlay.getAttribute('data-unit')).toBe('one');
 f.list.emit('pointerover',{target:f.controls.two.upgrade});expect(f.overlay.getAttribute('data-unit')).toBe('two');expect(highlight.labelText.textContent).toBe('Gun 02');
 f.list.emit('pointerout',{target:f.controls.two.upgrade,relatedTarget:f.controls.two.select});expect(f.overlay.getAttribute('data-unit')).toBe('two');
 f.list.emit('pointerout',{target:f.controls.two.select,relatedTarget:null});expect(f.overlay.getAttribute('data-unit')).toBe('one');
 f.list.emit('pointerover',{target:f.controls.unplaced.upgrade});expect(f.overlay.hasAttribute('hidden')).toBe(true);expect(f.overlay.hasAttribute('data-unit')).toBe(false);
 f.document.activeElement=f.canvas;f.list.emit('focusout',{target:f.controls.one.select,relatedTarget:f.canvas});f.list.emit('pointerout',{target:f.controls.unplaced.upgrade,relatedTarget:null});expect(f.overlay.hasAttribute('hidden')).toBe(true);
 expect(f.overlay.style.pointerEvents).toBe('none');highlight.dispose();
});

test('camera/pose updates repaint persistent nodes and phase/scene/ownership changes clear without stale worlds',()=>{
 const f=fixture(),highlight=new UnitHighlight(f),state={...f,preparing:true},before=JSON.stringify(f.units);highlight.update(state);f.list.emit('pointerover',{target:f.controls.one.upgrade});
 const group=highlight.group,polygon=highlight.outline,original=polygon.getAttribute('points');f.camera.pitch+=.1;f.camera.update(1.5);highlight.update(state);expect(highlight.group).toBe(group);expect(highlight.outline).toBe(polygon);expect(polygon.getAttribute('points')).not.toBe(original);
 for(const changes of [{busy:true},{paused:true},{preparing:false}]){highlight.update({...state,...changes});expect(f.overlay.hasAttribute('hidden')).toBe(true);expect(highlight.context).toBeNull();expect(highlight.geometry.world).toBeNull();highlight.update(state);f.list.emit('pointerover',{target:f.controls.one.select});expect(f.overlay.getAttribute('data-unit')).toBe('one');}
 highlight.update({...state,units:f.units.map(unit=>({...unit,deployed:false})),world:{entries:[],rigs:new Map()}});expect(f.overlay.hasAttribute('hidden')).toBe(true);expect(highlight.hoverRow).toBeNull();
 highlight.update(state);f.list.emit('pointerover',{target:f.controls.one.select});highlight.update({...state,units:f.units.filter(unit=>unit.id!=='one')});expect(f.overlay.hasAttribute('hidden')).toBe(true);
 expect(JSON.stringify(f.units)).toBe(before);highlight.dispose();expect(f.overlay.children).toHaveLength(0);expect(highlight.context).toBeNull();expect(highlight.geometry.world).toBeNull();for(const handlers of f.list.listeners.values())expect(handlers.size).toBe(0);
 f.list.emit('pointerover',{target:f.controls.two.select});expect(f.overlay.hasAttribute('hidden')).toBe(true);highlight.dispose();
});

test('ranges use each family and the session override, with no next tier for disabled/max variants',()=>{
 const config=createPlayConfig({defences:{'turret-study':{variants:{base:{stats:{maxRange:53}},upgrade1:{stats:{maxRange:79}}}}}}),before=JSON.stringify(config);
 for(const[model,family]of Object.entries(config.defences))for(let index=0;index<family.enabledVariants.length;index++){
  const variant=family.enabledVariants[index],unit={model,variant};
  if(family.kind==='enhancer'){expect(unitRangePreview(unit,config.defences)).toBeNull();expect(unitRangePreview(unit,config.defences,true)).toBeNull();continue;}
  expect(unitRangePreview(unit,config.defences)).toEqual({variant,range:family.variants[variant].stats.maxRange,upgrade:false});
  const next=family.enabledVariants[index+1],preview=unitRangePreview(unit,config.defences,true);
  expect(preview).toEqual(next?{variant:next,range:family.variants[next].stats.maxRange,upgrade:true}:null);
 }
 expect(unitRangePreview({variant:'base'},config.defences).range).toBe(53);expect(unitRangePreview({variant:'base'},config.defences,true).range).toBe(79);
 const baseOnly=createPlayConfig({defences:{'turret-study':{enabledVariants:['base']}}});expect(unitRangePreview({variant:'base'},baseOnly.defences,true)).toBeNull();
 expect(unitRangePreview({variant:'base'},null)).toBeNull();expect(unitRangePreview({variant:'base',stats:{maxRange:NaN}},null)).toBeNull();expect(JSON.stringify(config)).toBe(before);
});

test('range circle projects actual horizontal distance and centre, follows moves/camera/tiers and reuses its buffers',()=>{
 const f=fixture(),g=new UnitRangeGeometry(),rig=f.world.rigs.get('one'),root=rig.root,vp=f.camera.vp,before=[...root];
 const centre={x:root[0]*12+root[8]*12+root[12],y:root[1]*12+root[9]*12+root[13],z:root[2]*12+root[10]*12+root[14]};
 const ring=g.project(rig,f.camera,48,960,640),signature=g.signature;expect(ring).toHaveLength(96);
 for(let index=0;index<96;index++){
  const angle=index/96*Math.PI*2,x=centre.x+Math.cos(angle)*48,z=centre.z+Math.sin(angle)*48,point=project(vp,identity(),x,centre.y,z,960,640);
  expect(ring[index].x).toBeCloseTo(point.x,7);expect(ring[index].y).toBeCloseTo(point.y,7);
 }
 const first=ring.map(point=>({...point}));expect(g.project(rig,f.camera,48,960,640)).toBe(ring);expect(g.changed).toBe(false);expect(g.signature).toBe(signature);
 expect(g.project(rig,f.camera,72,960,640)).not.toEqual(first);root[12]+=24;expect(g.project(rig,f.camera,48,960,640)).not.toEqual(first);root.set(before);f.camera.yaw+=.4;f.camera.update(1.5);expect(g.project(rig,f.camera,48,960,640)).not.toEqual(first);
 expect([...root]).toEqual(before);expect(g.project(null,f.camera,48,960,640)).toBeNull();expect(g.project(rig,f.camera,48,0,640)).toBeNull();expect(g.project(rig,f.camera,-1,960,640)).toBeNull();
 const eye=identity();eye[15]=-1;expect(g.project(rig,{vp:eye},48,960,640)).toBeNull();g.reset();expect(g.points).toHaveLength(0);expect(g.signature).toHaveLength(0);
});

test('row and Upgrade previews switch without selection, buying or world mutation and clear at lifecycle boundaries',()=>{
 const f=fixture(),highlight=new UnitHighlight({...f,defences:PLAY_CONFIG.defences}),state={...f,preparing:true},before=JSON.stringify(f.units);highlight.update(state);
 f.list.emit('pointerover',{target:f.controls.one.select});expect(f.overlay.getAttribute('data-range')).toBe(String(PLAY_CONFIG.defences['turret-study'].variants.base.stats.maxRange));expect(f.overlay.getAttribute('data-range-mode')).toBe('current');const current=highlight.range.getAttribute('points');
 f.controls.one.upgrade.disabled=true;f.list.emit('pointerover',{target:f.controls.one.upgrade});expect(f.overlay.getAttribute('data-range')).toBe(String(PLAY_CONFIG.defences['turret-study'].variants.upgrade1.stats.maxRange));expect(f.overlay.getAttribute('data-range-mode')).toBe('next');expect(highlight.labelText.textContent).toContain('NEXT I');expect(highlight.range.getAttribute('points')).not.toBe(current);
 f.list.emit('pointerout',{target:f.controls.one.upgrade,relatedTarget:f.controls.one.select});expect(f.overlay.getAttribute('data-range-mode')).toBe('current');expect(highlight.range.getAttribute('points')).toBe(current);
 f.list.emit('pointerout',{target:f.controls.one.select,relatedTarget:null});expect(f.overlay.hasAttribute('hidden')).toBe(true);expect(f.overlay.hasAttribute('data-range')).toBe(false);
 f.document.activeElement=f.controls.two.upgrade;f.list.emit('focusin',{target:f.controls.two.upgrade});expect(f.overlay.getAttribute('data-range-variant')).toBe('upgrade2');expect(highlight.labelText.textContent).toContain('NEXT II');
 f.list.emit('pointerover',{target:f.controls.one.select});expect(f.overlay.getAttribute('data-unit')).toBe('one');f.list.emit('pointerout',{target:f.controls.one.select,relatedTarget:null});expect(f.overlay.getAttribute('data-unit')).toBe('two');
 f.units[1].variant='upgrade2';f.controls.two.upgrade.hidden=true;highlight.update(state);expect(f.overlay.getAttribute('data-range-mode')).toBe('current');expect(f.overlay.getAttribute('data-range-variant')).toBe('upgrade2');f.units[1].variant='upgrade1';
 for(const changes of [{busy:true},{paused:true},{preparing:false}]){highlight.update({...state,...changes});expect(f.overlay.hasAttribute('data-range')).toBe(false);expect(highlight.rangeGroup.hasAttribute('hidden')).toBe(true);expect(highlight.rangeGeometry.signature).toHaveLength(0);highlight.update(state);}
 f.list.emit('pointerover',{target:f.controls.unplaced.select});expect(f.overlay.hasAttribute('hidden')).toBe(true);expect(JSON.stringify(f.units)).toBe(before);highlight.dispose();expect(f.overlay.children).toHaveLength(0);
});
