import {validId} from './model.js';

export const MAIN_ROUTE='main';
// Source safety bounds, not an enemy, wave or campaign budget.
export const MAX_LEVEL_ROUTES=16,MAX_ROUTE_POINTS=16384;

// Load/editor-time helpers. Runtime actors cache PathMotion copies and never
// rebuild this union or search the source catalogue during simulation.
export function levelRoutes(level){return [{id:MAIN_ROUTE,path:level.path},...(level.routes??[])];}
export function routePath(level,id=MAIN_ROUTE){return id===MAIN_ROUTE?level.path:level.routes?.find(route=>route.id===id)?.path??null;}
export function actorRouteId(level,actor){return actor.routeId??level.actorRoutes?.[actor.id]??MAIN_ROUTE;}
export function pathBoxUnion(level){
 const seen=new Set(),boxes=[];
 for(const route of levelRoutes(level))for(const p of route.path??[]){const key=p[0]+','+p[2];if(!seen.has(key)){seen.add(key);boxes.push(p);}}
 return boxes;
}
export function validateRoutes(level){
 if(!Array.isArray(level.path)||level.path.length>MAX_ROUTE_POINTS)throw new Error('Invalid path length.');
 if(level.routes!==undefined&&(!Array.isArray(level.routes)||level.routes.length>=MAX_LEVEL_ROUTES))throw new Error('Invalid additional route count.');
 const routes=levelRoutes(level),ids=new Set([MAIN_ROUTE]);let points=level.path.length;
 for(let i=1;i<routes.length;i++){
  const route=routes[i];if(!route||!validId(route.id)||ids.has(route.id)||!Array.isArray(route.path)||route.path.length<2)throw new Error('Additional routes need unique IDs and complete paths.');
  ids.add(route.id);points+=route.path.length;
 }
 if(points>MAX_ROUTE_POINTS)throw new Error('Too many authored route points.');
 const maps=[];
 for(const route of routes){
  if(routes.length>1&&route.path.length<2)throw new Error('Merging routes need a complete primary path.');
  const cells=new Map();
  for(let i=0;i<route.path.length;i++){
   const p=route.path[i];if(!Array.isArray(p)||p.length!==3||!Number.isInteger(p[0])||p[0]<0||p[0]>=level.size[0]||p[1]!==0||!Number.isInteger(p[2])||p[2]<0||p[2]>=level.size[1])throw new Error('Path is outside level bounds.');
   const key=p[0]+','+p[2];if(cells.has(key))throw new Error('Path cannot repeat a box.');cells.set(key,i);
   if(i){const previous=route.path[i-1];if(Math.abs(p[0]-previous[0])+Math.abs(p[2]-previous[2])!==1)throw new Error('Append path boxes in order, sharing an edge on the same layer.');}
  }
  maps.push(cells);
 }
 // Fixed approaches may join, then must stay together. A crossing, reversed
 // edge or split after a merge would require a different authoring contract.
 for(let a=0;a<routes.length;a++)for(let b=a+1;b<routes.length;b++){
  const first=routes[a].path,second=routes[b].path;let i=0,j=-1;
  for(;i<first.length;i++){j=maps[b].get(first[i][0]+','+first[i][2])??-1;if(j>=0)break;}
  if(j<0||first.length-i!==second.length-j)throw new Error('Routes must merge into one identical directed tail.');
  for(;i<first.length;i++,j++)if(first[i][0]!==second[j][0]||first[i][2]!==second[j][2])throw new Error('Routes must merge into one identical directed tail.');
 }
 if(level.actorRoutes!==undefined){
  const assignments=level.actorRoutes;
  if(!assignments||typeof assignments!=='object'||Array.isArray(assignments)||Object.keys(assignments).length>16384)throw new Error('Invalid actor route assignments.');
  for(const [id,route]of Object.entries(assignments))if(!validId(id)||!ids.has(route))throw new Error('Actor route assignment is unknown.');
 }
 return routes;
}
