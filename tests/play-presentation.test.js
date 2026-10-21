import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {frameTitle} from '../play/presentation.js';
const transform=(m,p)=>[0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]);
test('title framing covers every viewport corner with landscape across portrait and widescreen',()=>{
 for(const [width,height]of [[1280,720],[1920,1080],[2560,1080],[390,844],[720,720]]){
  const canvas={clientWidth:width,clientHeight:height,addEventListener(){},focus(){}};
  const c=new Camera(canvas,()=>{});c.setLevel({size:[20,16],pathHeight:24,path:[],terrain:{defaultHeight:24,boxes:[]}});
  const overview=c.radius;frameTitle(c);expect(c.radius).toBeLessThan(overview);c.update(width/height);
  for(const x of [-1,1])for(const y of [-1,1]){
   const near=transform(c.inverse,[x,y,0,1]),far=transform(c.inverse,[x,y,1,1]),t=(24-near[1])/(far[1]-near[1]);
   const worldX=near[0]+t*(far[0]-near[0]),worldZ=near[2]+t*(far[2]-near[2]);
   expect(worldX).toBeGreaterThan(0);expect(worldX).toBeLessThan(480);expect(worldZ).toBeGreaterThan(0);expect(worldZ).toBeLessThan(384);
  }
  c.frame();expect(c.radius).toBe(overview);
 }
});
