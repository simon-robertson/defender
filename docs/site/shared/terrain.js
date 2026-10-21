import {BOX_SIZE} from './grid.js';
import {pathBoxUnion} from './routes.js';
import {bridgeBoxSet} from './bridges.js';

export const MAX_TERRAIN_HEIGHT=256;
const key=(x,z)=>`${x},${z}`;
export const newTerrain=()=>({defaultHeight:BOX_SIZE,boxes:[]});
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
function checkHeights(h,w){if(!integer(h,0,MAX_TERRAIN_HEIGHT)||!integer(w,0,MAX_TERRAIN_HEIGHT)||w!==0&&w<=h)throw new Error('Terrain heights must be whole units from 0–256; water must be above ground.');}
export function validateTerrain(level){
  const t=level.terrain;
  if(!t||t.defaultHeight!==BOX_SIZE||!Array.isArray(t.boxes)||t.boxes.length>level.size[0]*level.size[1])throw new Error('Terrain requires a 24-unit default and bounded boxes.');
  const seen=new Set();
  for(const box of t.boxes){
    if(!Array.isArray(box.box)||box.box.length!==2||!box.box.every((n,i)=>integer(n,0,level.size[i]-1)))throw new Error('Terrain box is outside level bounds.');
    const id=key(...box.box);if(seen.has(id))throw new Error('Duplicate terrain box.');seen.add(id);checkHeights(box.ground,box.water);
  }
  return t;
}

// One height pair per 24x24 horizontal box, never a volume of underground
// voxels. Untouched ground is implicit. Only vertical dimensions use unit steps.
export class TerrainField {
  constructor(level){this.level=level;this.source=new Map(level.terrain.boxes.map(b=>[key(...b.box),b]));this.path=new Set(pathBoxUnion(level).map(p=>key(p[0],p[2])));this.bridges=bridgeBoxSet(level);}
  box(x,z){return this.source.get(key(x,z));}
  height(x,z,water=false){
    if(x<0||z<0||x>=this.level.size[0]*BOX_SIZE||z>=this.level.size[1]*BOX_SIZE)return 0;
    const box=this.box(Math.floor(x/BOX_SIZE),Math.floor(z/BOX_SIZE));return box?(water?box.water:box.ground):(water?0:BOX_SIZE);
  }
  protected(x,z){return this.path.has(key(x,z));}
  setBox(x,z,ground,water){
    if(!integer(x,0,this.level.size[0]-1)||!integer(z,0,this.level.size[1]-1))throw new Error('Terrain box is outside level bounds.');checkHeights(ground,water);
    const id=key(x,z);if(ground===BOX_SIZE&&water===0)this.source.delete(id);else this.source.set(id,{box:[x,z],ground,water});
  }
  paint(x,z,operation,value,visited=new Set()){
    if(!integer(x,0,this.level.size[0]-1)||!integer(z,0,this.level.size[1]-1))return {changed:0,protectedCount:0};
    const id=z*this.level.size[0]+x;if(visited.has(id))return {changed:0,protectedCount:0};visited.add(id);
    if(this.protected(x,z))return {changed:0,protectedCount:1};
    let h=this.height(x*BOX_SIZE,z*BOX_SIZE),w=this.height(x*BOX_SIZE,z*BOX_SIZE,true);const oldH=h,oldW=w;
    if(operation==='raise')h=Math.min(MAX_TERRAIN_HEIGHT,h+1);
    else if(operation==='lower')h=Math.max(0,h-1);
    else if(operation==='flatten')h=value;
    else if(operation==='water')w=value?h+value:0;
    else if(operation==='drain')w=0;
    if(w<=h)w=0;checkHeights(h,w);
    if(h===oldH&&w===oldW)return {changed:0,protectedCount:0};
    this.setBox(x,z,h,w);return {changed:1,protectedCount:0};
  }
  commit(){this.level.terrain={defaultHeight:BOX_SIZE,boxes:[...this.source.values()].sort((a,b)=>a.box[1]-b.box[1]||a.box[0]-b.box[0])};return this.level.terrain;}
  flatBox(x,z){const box=this.box(x,z);return box?.water?null:box?.ground??BOX_SIZE;}
  bridgeBox(x,z){return this.bridges.has(key(x,z));}
  supportBox(x,z){return this.bridgeBox(x,z)?this.level.pathHeight:this.flatBox(x,z);}
}
export function placementY(level,p,field=new TerrainField(level)){
  if(p.anchor==='absolute')return p.box[1]*BOX_SIZE+(p.offset?.[1]??0);
  const h=field.flatBox(p.box[0],p.box[2]);if(h===null)throw new Error(`Placement ${p.id} needs a flat, dry terrain box. Drain its mound before placing a defence.`);
  return h+p.box[1]*BOX_SIZE+(p.offset?.[1]??0);
}
export function setPathHeight(level,height){
  if(!integer(height,1,MAX_TERRAIN_HEIGHT))throw new Error('Path height must be a whole unit from 1–256.');
  if(level.bridges?.length)throw new Error('Edit bridge routes and their bank/deck heights together in source JSON.');
  const field=new TerrainField(level);for(const [bx,,bz]of pathBoxUnion(level))field.setBox(bx,bz,height,0);
  field.commit();level.pathHeight=height;
}
