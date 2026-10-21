import {test,expect} from 'bun:test';
import {ArcEffects} from '../engine/arc-effects.js';
import {PlasmaLinks} from '../engine/plasma-links.js';
import {packTubeLightBounds} from '../engine/tube-light-bounds.js';
import {ARC_LIGHT_BOUNDS_OFFSET,ARC_LIGHT_FLOATS} from '../shared/arc-effects.js';

function checkBounds(data){
 for(let light=0;light<data[0];light++){
  const base=4+light*ARC_LIGHT_FLOATS,b=base+ARC_LIGHT_BOUNDS_OFFSET,cx=data[b],cy=data[b+1],cz=data[b+2],radius=data[b+3];expect(radius).toBeGreaterThan(0);
  for(let segment=0;segment<data[base+5];segment++){
   const k=base+8+segment*8,falloff=Math.abs(data[base+3]*data[k+3]);
   for(let sample=0;sample<=8;sample++){
    const t=sample/8,x=data[k]+(data[k+4]-data[k])*t,y=data[k+1]+(data[k+5]-data[k+1])*t,z=data[k+2]+(data[k+6]-data[k+2])*t;
    expect(Math.hypot(x-cx,y-cy,z-cz)+falloff).toBeLessThanOrEqual(radius);
   }
  }
 }
}
test('bounds contain complete production plasma and moving/restriking Arc falloff volumes',()=>{
 let seed=17;const arcs=new ArcEffects(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}),plasma=new PlasmaLinks();
 plasma.setLinks([{source:[77,34.5,155.5],target:[65,35.5,155.5]},{source:[0,2,0],target:[0,100,0]}]);
 for(const age of [0,.01,.046,.12]){
  arcs.reset();arcs.emit([220,78,244],[209.5,29.09,175.88],[0,0,1],0);arcs.emit([2,2,2],[2.001,2,2],[0,1,0],0);arcs.advance(age);arcs.prepare();checkBounds(arcs.lightData);
  plasma.time=age*1000;plasma.prepare();checkBounds(plasma.lightData);
 }
});
test('bounds include independently scaled segments, large Float32 coordinates and empty records',()=>{
 const data=new Float32Array(4+ARC_LIGHT_FLOATS);data[0]=1;data[7]=18;data[9]=2;
 data.set([123456,12,-98765,1,123470,5,-98750,1,123470,5,-98750,2,123465,30,-98760,1],12);
 packTubeLightBounds(data,4);checkBounds(data);data[9]=0;packTubeLightBounds(data,4);expect(Array.from(data.slice(4+ARC_LIGHT_BOUNDS_OFFSET))).toEqual([0,0,0,0]);
});
