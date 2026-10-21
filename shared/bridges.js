import {BOX_SIZE} from './grid.js';
import {validId} from './model.js';
import {levelRoutes,pathBoxUnion} from './routes.js';

export const BRIDGE_THICKNESS=1;
const key=(x,z)=>x+','+z;
const check=(ok,message)=>{if(!ok)throw new Error(message);};

// Validate only after terrain/routes/pathHeight. A bridge is an explicit solid
// deck over water, never a replacement terrain column or defence foundation.
export function validateBridges(level){
 if(level.bridges===undefined)return;
 check(level.previewMode!=='landscape','Landscape previews must have no bridges.');
 check(Array.isArray(level.bridges)&&level.bridges.length<=level.size[0]*level.size[1],'Invalid bridge collection.');
 const terrain=new Map(level.terrain.boxes.map(b=>[key(...b.box),b])),route=new Set(pathBoxUnion(level).map(([x,,z])=>key(x,z))),used=new Set(),ids=new Set();
 const dry=(x,z)=>x>=0&&z>=0&&x<level.size[0]&&z<level.size[1]&&!(terrain.get(key(x,z))?.water)&&(terrain.get(key(x,z))?.ground??BOX_SIZE)===level.pathHeight;
 for(const bridge of level.bridges){
  check(bridge&&validId(bridge.id)&&!ids.has(bridge.id),'Duplicate or invalid bridge ID.');ids.add(bridge.id);
  check(Object.keys(bridge).every(name=>name==='id'||name==='boxes'),'Bridges support only id and ordered boxes; deck height and thickness are fixed.');
  check(Array.isArray(bridge.boxes)&&bridge.boxes.length>0&&bridge.boxes.length<=Math.max(...level.size),'A bridge requires a bounded straight water span.');
  let dx=0,dz=0;
  for(let i=0;i<bridge.boxes.length;i++){
   const box=bridge.boxes[i];check(Array.isArray(box)&&box.length===2&&box.every((n,a)=>Number.isInteger(n)&&n>=0&&n<level.size[a]),'Bridge box is outside level bounds.');
   const id=key(...box),column=terrain.get(id);
   check(!used.has(id),'Bridge boxes must not overlap or repeat.');used.add(id);
   check(route.has(id),'Bridge boxes must belong to an enemy route.');
   check(column?.water>0&&column.water<level.pathHeight-BRIDGE_THICKNESS,'Bridge water must remain below the one-unit deck.');
   if(i){const previous=bridge.boxes[i-1],sx=box[0]-previous[0],sz=box[1]-previous[1];check(Math.abs(sx)+Math.abs(sz)===1,'Bridge boxes must share an edge in order.');if(i===1){dx=sx;dz=sz;}else check(sx===dx&&sz===dz,'Bridge spans must stay straight.');}
  }
  // Every route using any span box must cross the entire deck, in either
  // direction, with real dry banks at both ends and no turns over water.
  let crossings=0;
  for(const entry of levelRoutes(level)){
   const path=entry.path,span=new Set(bridge.boxes.map(box=>key(...box))),indices=[];
   for(let i=0;i<path.length;i++)if(span.has(key(path[i][0],path[i][2])))indices.push(i);
   if(!indices.length)continue;
   check(indices.length===bridge.boxes.length&&indices.every((n,i)=>n===indices[0]+i),'A route must cross each complete bridge span without leaving it.');
   const start=indices[0],end=indices.at(-1),before=path[start-1],after=path[end+1];
   check(before&&after&&dry(before[0],before[2])&&dry(after[0],after[2]),'Bridge ends require dry banks at the path height.');
   const sx=path[start][0]-before[0],sz=path[start][2]-before[2];
   for(let i=start+1;i<=end+1;i++)check(path[i][0]-path[i-1][0]===sx&&path[i][2]-path[i-1][2]===sz,'Routes must cross bridges straight between their banks.');
   if(bridge.boxes.length>1)check(Math.abs(sx)===Math.abs(dx)&&Math.abs(sz)===Math.abs(dz),'Bridge span direction does not match the route.');
   crossings++;
  }
  check(crossings>0,'A bridge requires a complete route crossing.');
 }
}

export const bridgeBoxSet=level=>new Set((level.bridges??[]).flatMap(bridge=>bridge.boxes.map(box=>key(...box))));
export const BRIDGE_MATERIALS=Object.freeze(['#987248','#A27B50','#8D6842','#765438'].map(color=>Object.freeze({color,emission:0,reflectiveness:0})));

// Load/editor-time geometry. Flush contrasting joints preserve full, flat
// support; no overlays or holes. Internal deck faces and bank contacts vanish.
export function bridgeQuads(level,materialStart=0){
 if(!level.bridges?.length)return [];
 const quads=[],deck=bridgeBoxSet(level),terrain=new Map(level.terrain.boxes.map(b=>[key(...b.box),b])),top=level.pathHeight,bottom=top-BRIDGE_THICKNESS;
 const quad=(origin,axis,sign,width,height,material)=>quads.push({origin,axis,sign,width,height,material:materialStart+material});
 for(const bridge of level.bridges??[]){
  const first=bridge.boxes[0],second=bridge.boxes[1],path=levelRoutes(level).find(route=>route.path.some(([x,,z])=>x===first[0]&&z===first[1])).path,index=path.findIndex(([x,,z])=>x===first[0]&&z===first[1]);
  const alongX=second?second[0]!==first[0]:path[index-1][0]!==first[0];
  for(const [bx,bz]of bridge.boxes){
   const x=bx*BOX_SIZE,z=bz*BOX_SIZE;
   for(let along=0;along<BOX_SIZE;along+=4){
    const shade=(Math.floor((alongX?x:z)/4)+along/4)%3;
    if(alongX){quad([x+along,top,z],1,1,BOX_SIZE,3,shade);quad([x+along+3,top,z],1,1,BOX_SIZE,1,3);}
    else{quad([x,top,z+along],1,1,3,BOX_SIZE,shade);quad([x,top,z+along+3],1,1,1,BOX_SIZE,3);}
   }
   quad([x,bottom,z],1,-1,BOX_SIZE,BOX_SIZE,2);
   for(const [dx,dz,axis,sign]of [[-1,0,0,-1],[1,0,0,1],[0,-1,2,-1],[0,1,2,1]]){
    const nx=bx+dx,nz=bz+dz,column=terrain.get(key(nx,nz)),height=column?.ground??BOX_SIZE;
    if(deck.has(key(nx,nz)))continue;
    const low=Math.max(bottom,height);if(low>=top)continue;
    if(axis===0)quad([x+(sign>0?BOX_SIZE:0),low,z],0,sign,top-low,BOX_SIZE,2);
    else quad([x,low,z+(sign>0?BOX_SIZE:0)],2,sign,BOX_SIZE,top-low,2);
   }
  }
 }
 return quads;
}
