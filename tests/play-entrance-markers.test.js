import {test,expect} from 'bun:test';
import {pathEntrances,EntranceMarkers} from '../play/entrance-markers.js';
import {PLAY_LEVEL_IDS} from '../play/config.js';
import {levelRoutes} from '../shared/routes.js';
import {Camera} from '../engine/camera.js';
test('every campaign approach has an inward entry anchor, including branches and shared-start deduplication',async()=>{
 for(const id of PLAY_LEVEL_IDS){
  const level=await Bun.file(new URL(`../assets/levels/${id}.json`,import.meta.url)).json(),entries=pathEntrances(level),routes=levelRoutes(level);
  expect(entries.length).toBe(routes.length);
  for(let i=0;i<routes.length;i++){const [a,b]=routes[i].path,e=entries[i];expect([e.x,e.y,e.z]).toEqual([(a[0]+.5)*24,level.pathHeight+.6,(a[2]+.5)*24]);expect(e.dx*(b[0]-a[0])+e.dz*(b[2]-a[2])).toBeGreaterThan(0);}
 }
 const level={path:[[0,0,0],[1,0,0]],routes:[{id:'same',path:[[0,0,0],[0,0,1]]},{id:'empty',path:[]}]};expect(pathEntrances(level)).toHaveLength(1);expect(pathEntrances({path:[]})).toHaveLength(0);
});
class Node {
 constructor(doc){this.ownerDocument=doc;this.style={};this.attrs={};this.children=[];}
 setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}append(...n){this.children.push(...n);}replaceChildren(fragment){this.children=fragment?.children??[];}
}
test('entry badges project with the overview, hide in Drone/title, and clear between areas',()=>{
 const doc={createElementNS(){return new Node(doc);},createDocumentFragment(){return new Node(doc);}},overlay=new Node(doc),markers=new EntranceMarkers(overlay);
 const level={size:[20,16],path:[[0,0,8],[1,0,8]],pathHeight:24,terrain:{defaultHeight:24,boxes:[]}},world={level},camera=new Camera({clientWidth:1200,clientHeight:800,addEventListener(){}},()=>{});camera.setLevel(level);camera.update(1.5);
 markers.update(world,camera,'deploy',1200,800);expect(overlay.attrs.hidden).toBeUndefined();expect(overlay.attrs['aria-label']).toBe('1 enemy path entrance');expect(overlay.children).toHaveLength(1);
 const group=overlay.children[0];expect(group.children).toHaveLength(4);expect(group.children.at(-1).textContent).toBe('ENTRY');expect(group.children[0].attrs.points.includes('NaN')).toBe(false);
 for(const phase of ['wave','settling']){markers.update(world,camera,phase,1200,800);expect(overlay.attrs.hidden).toBe('');}
 markers.update(world,camera,'loadout',1200,800);expect(overlay.attrs.hidden).toBe('');
 markers.update({level:{...level}},camera,'loadout',1200,800);expect(overlay.attrs.hidden).toBeUndefined();
 camera.mode='live';markers.update(world,camera,'wave',1200,800);expect(overlay.attrs.hidden).toBe('');
 camera.mode='overview';markers.update(world,camera,'title',1200,800);expect(overlay.attrs.hidden).toBe('');
 markers.update({level:{path:[]}},camera,'loadout',1200,800);expect(overlay.attrs.hidden).toBe('');markers.dispose();expect(overlay.children).toHaveLength(0);
});
