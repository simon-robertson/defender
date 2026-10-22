import {test,expect} from 'bun:test';
import {Camera} from '../engine/camera.js';
import {frameTitle,createTitleSession} from '../play/presentation.js';
import {PLAY_CONFIG} from '../play/config.js';
import {PlaySession} from '../play/session.js';
const transform=(m,p)=>[0,1,2,3].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]*p[3]);
test('the title uses each checkpoint landscape without importing or modifying the saved run',()=>{
 const saved=new PlaySession();saved.reset();saved.buy();saved.misses=3;
 for(let levelIndex=1;levelIndex<PLAY_CONFIG.levels.length;levelIndex++){
  saved.levelIndex=levelIndex;saved.completedWaves=levelIndex*4;saved.tokens=10;
  const before=saved.snapshot(),title=createTitleSession(PLAY_CONFIG,saved);
  expect(title.phase).toBe('title');expect(title.level.id).toBe(PLAY_CONFIG.levels[levelIndex].id);expect(title.wave.id).toBe(PLAY_CONFIG.levels[levelIndex].waves[0].id);
  expect(title.placements).toEqual([]);expect(title.units).toEqual([]);
  title.reset('loadout');expect(title.level.id).toBe(PLAY_CONFIG.levels[0].id);
  expect(saved.snapshot()).toEqual(before);
 }
});
test('a title with no usable checkpoint opens the first landscape',()=>{
 for(const saved of [null,undefined]){
  const title=createTitleSession(PLAY_CONFIG,saved);
  expect(title.phase).toBe('title');expect(title.level.id).toBe(PLAY_CONFIG.levels[0].id);
 }
});
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
