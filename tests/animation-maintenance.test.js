// Combat/layout regressions use the archived populated-route studies.
// Current landscape sources are exercised by landscape-preview-runtime.test.js.
import {test,expect} from 'bun:test';
import {PoseRig} from '../engine/rig.js';
import {identity,multiply} from '../shared/math.js';
import {WildlifePreview,wildlifeActorsForLevel} from '../game/wildlife-preview.js';
import {buildWorld,disposeWorld} from '../engine/world.js';

// Independent pre-optimisation composition oracle, including signed zero.
function reference(out,pivot,t,r){
 const sx=Math.sin(r[0]),cx=Math.cos(r[0]),sy=Math.sin(r[1]),cy=Math.cos(r[1]),sz=Math.sin(r[2]),cz=Math.cos(r[2]);
 out[0]=cz*cy;out[1]=sz*cy;out[2]=-sy;out[3]=0;
 out[4]=cz*sy*sx-sz*cx;out[5]=sz*sy*sx+cz*cx;out[6]=cy*sx;out[7]=0;
 out[8]=cz*sy*cx+sz*sx;out[9]=sz*sy*cx-cz*sx;out[10]=cy*cx;out[11]=0;
 for(let i=0;i<3;i++)out[12+i]=pivot[i]+out[i]*(t[0]-pivot[0])+out[4+i]*(t[1]-pivot[1])+out[8+i]*(t[2]-pivot[2]);out[15]=1;
}
const bytes=value=>new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
test('zero-axis rig composition preserves exact local, inherited and world matrix bytes including negative zero',()=>{
 const parts=[{id:'body',parent:null,pivot:[12,0,12]},{id:'upper',parent:'body',pivot:[6,9,7]},{id:'foot',parent:'upper',pivot:[6,1,7]}];
 const root=identity(),instances=parts.map((p,i)=>({part:p.id,key:'test',index:i,matrix:identity()}));let callbacks=0;
 const rig=new PoseRig({root,parts,instances},()=>callbacks++),local=parts.map(()=>identity()),pose=parts.map(()=>identity()),world=parts.map(()=>identity());
 const angles=[[0,0,0],[-0,0,-0],[.31,0,0],[0,-.73,0],[0,0,1.24],[.2,-.3,.4],[Math.PI/2,Math.PI,-Math.PI/2]];
 for(let frame=0;frame<280;frame++){
  root[12]=frame*.7;root[13]=24;root[14]=-frame*.3;rig.invalidateRoot();
  for(let i=0;i<parts.length;i++){
   const bone=rig.bones[i],a=angles[(frame+i)%angles.length];
   rig.setRotation(parts[i].id,...a);rig.setTranslation(parts[i].id,frame*.01+i,-i,frame*.03);
   // Explicitly include signed-zero channels even when the public change test
   // correctly treats +0 and -0 as the same rotation.
   bone.rotation.set(a);bone.dirty=true;
   reference(local[i],parts[i].pivot,bone.translation,bone.rotation);
   if(i)multiply(pose[i],pose[i-1],local[i]);else pose[i].set(local[i]);multiply(world[i],root,pose[i]);
  }
  expect(rig.update()).toBe(3);
  for(let i=0;i<parts.length;i++){expect(bytes(rig.bones[i].local)).toEqual(bytes(local[i]));expect(bytes(rig.bones[i].pose)).toEqual(bytes(pose[i]));expect(bytes(instances[i].matrix)).toEqual(bytes(world[i]));}
  const saved=callbacks;expect(rig.update()).toBe(0);expect(callbacks).toBe(saved);
 }
});

test('single-axis hinge composition avoids only exact zero-angle trigonometry',()=>{
 const part={id:'body',parent:null,pivot:[12,9,12]},rig=new PoseRig({root:identity(),parts:[part],instances:[{part:'body',key:'test',index:0,matrix:identity()}]},()=>{});
 const sin=Math.sin,cos=Math.cos;let calls=0;
 try{
  Math.sin=function(v){calls++;return sin(v);};Math.cos=function(v){calls++;return cos(v);};
  rig.setRotation('body',.2,0,-0);rig.update();expect(calls).toBe(2);
  calls=0;rig.setRotation('body',.2,1e-100,-.3);rig.update();expect(calls).toBe(6);
  calls=0;rig.setRotation('body',0,-0,0);rig.update();expect(calls).toBe(0);
 }finally{Math.sin=sin;Math.cos=cos;}
});

test('unchanged wildlife poses skip rig work while forced, wing-only and root movement preserve callbacks',async()=>{
 const level=await Bun.file(new URL('../docs/landscape-reset-2026-10-18/previous-levels/moss-01.json',import.meta.url)).json(),actors=wildlifeActorsForLevel(level),models=new Map();
 for(const id of new Set([...level.placements.map(p=>p.model),...actors.map(p=>p.model)]))models.set(id,await Bun.file(new URL(`../assets/models/${id}.json`,import.meta.url)).json());
 const world=buildWorld(level,models,{actors});let callbacks=0;
 const preview=new WildlifePreview(world,()=>callbacks++),bird=preview.states.find(s=>s.kind==='bird'),ground=preview.states.find(s=>s.kind==='ground');
 const originals=preview.states.map(s=>s.rig.update);let updates=0;
 for(const s of preview.states){const update=s.rig.update;s.rig.update=function(){updates++;return update.call(this);};}
 try{
  callbacks=0;preview.updatedParts=0;for(let repeat=0;repeat<60;repeat++)for(const s of preview.states)preview.writePose(s);
  expect(updates).toBe(0);expect(callbacks).toBe(0);expect(preview.updatedParts).toBe(0);
  preview.writePose(bird,true);expect(updates).toBe(1);expect(callbacks).toBe(3);
  const body=bird.rig.byId.get('body').instance.matrix.slice();bird.wing-=.1;preview.writePose(bird);expect(updates).toBe(2);expect(callbacks).toBe(5);expect(bytes(bird.rig.byId.get('body').instance.matrix)).toEqual(bytes(body));
  bird.x+=.25;preview.writePose(bird);expect(updates).toBe(3);expect(callbacks).toBe(8);
  ground.y+=.1;preview.writePose(ground);expect(updates).toBe(4);expect(callbacks).toBe(9);
  preview.writePose(bird);preview.writePose(ground);expect(updates).toBe(4);expect(callbacks).toBe(9);
 }finally{for(let i=0;i<preview.states.length;i++)preview.states[i].rig.update=originals[i];preview.dispose();disposeWorld(world);}
});
