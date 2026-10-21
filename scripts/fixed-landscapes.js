import {createHash} from 'node:crypto';
import {LEVEL_FOOTPRINT,assertLevelFootprint} from '../shared/level-footprint.js';
import {makeLandscape,placementId,PROFILES} from './landscapes/core.js';
import {LANDSCAPE_CONFIGS,landscapeFor} from './landscapes/index.js';

// New authoring layer. Historical configs, factories and frozen snapshots stay
// unchanged: no route data participates in these compositions.
const clone=value=>structuredClone(value);
const configs=LANDSCAPE_CONFIGS.map(({reuse,...data})=>clone(data));
const byKey=new Map(configs.map(c=>[`${c.zone}${c.number}`,c]));
const adapt=(key,changes)=>Object.assign(byKey.get(key),changes);
// The first landscapes grow an eastern botanical mass and a low southern
// foreground. Existing landforms retain their scale; individual models never
// stretch. Mixed low planting remains between the masses, with no cleared sites.
const extensions={
 A1:{groves:[[17,4,2.5,3.0],[15,13,2.8,1.8]],flowers:[[17,10,2.8,2.4],[7,14,3.5,1.5]]},
 B1:{groves:[[17,3,2.4,2.5],[17,11,2.3,2.8,'rock']],flowers:[[12,14,3.5,1.5],[17,7,2.0,1.8]]},
 C1:{groves:[[17,2,2.6,2.0],[17,12,2.4,2.7]],flowers:[[17,7,2.4,2.3],[7,14,3.3,1.5]]},
 D1:{groves:[[17,9,2.6,3.0],[12,14,3.0,1.8]],flowers:[[17,3,2.4,2.0],[5,14,3.0,1.7]]},
 A2:{groves:[[19,4,1.6,2.8],[18,12,1.7,2.2]],flowers:[[18,8,1.5,2.0]]},
 B2:{groves:[[18,5,1.8,2.8],[18,13,1.8,2.0,'rock']],flowers:[[18,9,1.8,2.0]]},
 C2:{groves:[[18,2,1.9,1.8],[18,12,1.9,2.8]],flowers:[[18,8,1.6,2.0]]},
 D2:{groves:[[18,5,1.9,2.5],[18,13,1.9,2.0]],flowers:[[18,9,1.8,2.2]]},
};
for(const [key,extra]of Object.entries(extensions)){
 const c=byKey.get(key);c.groves.push(...extra.groves);c.flowers.push(...extra.flowers);
 c.composition+=' The fixed canvas adds coherent outer planting, preserving the original landform scale.';
}
// Preserve the west/east river as an edge-to-edge landform on its wider canvas.
byKey.get('C2').water=byKey.get('C2').water.map(([z,l,r])=>[z,l,r===17?19:r]);
// The fourth landscapes change aspect ratio through landform composition,
// rather than scaling model geometry or retaining off-canvas southern strips.
const b4=byKey.get('B4');
b4.mounds=[[10,2,3.1,1.4,32],[16,11,2.1,2.6,34]];
b4.groves=[[10,2,3.8,2.0,'rock'],[16,11,2.7,3.3,'rock'],[3,2,2.4,1.6],[10,8,2.2,2.6],[3,14,2.3,2.4],[10,14,2.8,1.7],[18,5,1.4,2.5]];
b4.flowers=[[8,11,2.2,2.7],[5,14,2,1]];
b4.anchors=b4.anchors.map(([kind,x,z,t])=>[kind,x>=12?x+2:x,z,...(t===undefined?[]:[t])]);
b4.perches=[[3,2,0],[18,7,2],[8,14,1]];
b4.composition+=' Northern shelves and the eastern mesa group occupy the wider canvas; southern planting folds into the shallower foreground.';
const c4=byKey.get('C4');
c4.water=c4.water.map(([z,l,r])=>[z-1,l+1,r+1]);
c4.mounds=[[3,3,2.1,1.8,32],[3,12,1.8,2.2,30],[15,3,2.1,1.5,28]];
c4.groves=[[3,3,2.9,2.5],[3,12,2.4,3.0],[16,3,2.4,2.1],[9,12,1.8,2.3],[8,7,2.0,2.0]];
c4.flowers=[[6,10,2.5,2.8],[15,14,2,1]];
c4.anchors=c4.anchors.map(([kind,x,z,t])=>[kind,x===17?19:x,z>=12?z-1:z,...(t===undefined?[]:[t])]);
c4.perches=[[2,3,0],[2,13,2],[17,2,1]];
c4.composition+=' The full glacial basin moves one box north and east, retaining its outline while the east fir mass uses the new width.';
const d4=byKey.get('D4');
d4.water=d4.water.filter(([z])=>z<16);
d4.mounds=[[3,3,2.0,1.8,32],[15,3,2.0,1.6,30],[16,12,2.3,2.0,34]];
d4.groves=[[3,3,3.0,2.8],[15,3,2.8,2.5],[16,12,3.1,3.0],[3,13.5,1.8,1.8],[10,8,2.0,1.7]];
d4.flowers=[[3,8,2.0,2.6],[11,13,2.5,2.0]];
d4.anchors=d4.anchors.map(([kind,x,z,t])=>[kind,x>=12?x+2:x,z,...(t===undefined?[]:[t])]);
d4.perches=[[2,3,1],[16,2,2],[17,13,0]];
d4.composition+=' The river still exits the south edge; the eastern groves shift into the added width and lower western planting folds north.';
// A4's accepted original remains intact over its entire original18×16 area.
// Only its added eastern two columns are authored by the shared planting core.
adapt('A4',{seed:1801,water:[],mounds:[],groves:[[18.7,1.5,1.8,2.8,'column'],[18.5,12.1,2.2,3.1]],flowers:[[18.5,7,1.8,2.4]],anchors:[],perches:[],composition:'The original18×16 Old Garden Mere remains intact. Two eastern columns extend its northern cypress grove and southeast oak planting, with low flowering understory between them. No paths or clearings are reserved.'});
for(const config of configs)config.size=[...LEVEL_FOOTPRINT];
// Proven seeds are recorded after exact geometry validation, never cleared.
export const FIXED_HABITAT_POINTS={
 "moss-01":[[474,24,362],[6,24,26],[406,24,6]],
 "moss-02":[[462,24,378],[6,24,42],[474,24,6]],
 "moss-03":[[474,24,366],[6,24,18],[98,24,378]],
 "moss-04":[[474,24,362],[6,24,22],[378,24,6]],
 "ochre-01":[[474,24,338],[22,24,6],[94,24,378]],
 "ochre-02":[[474,24,342],[26,24,22],[114,24,378]],
 "ochre-03":[[462,24,378],[18,24,6],[430,24,6]],
 "ochre-04":[[454,24,358],[6,24,6],[70,24,378]],
 "ice-01":[[474,24,378],[6,24,22],[414,24,6]],
 "ice-02":[[474,24,310],[18,24,6],[94,24,378]],
 "ice-03":[[474,24,358],[22,24,6],[82,24,378]],
 "ice-04":[[474,24,358],[6,24,22],[378,24,6]],
 "plum-01":[[474,24,362],[6,24,6],[94,24,378]],
 "plum-02":[[474,24,338],[6,24,18],[98,24,378]],
 "plum-03":[[458,24,378],[22,24,6],[74,24,378]],
 "plum-04":[[462,24,362],[6,24,6],[54,24,378]],
};
export const FIXED_HABITAT_BOXES={
 "moss-01":[[19,15],[0,1],[16,0]],
 "moss-02":[[19,15],[0,1],[19,0]],
 "moss-03":[[19,15],[0,0],[4,15]],
 "moss-04":[[19,15],[0,0],[15,0]],
 "ochre-01":[[19,14],[0,0],[3,15]],
 "ochre-02":[[19,14],[1,0],[4,15]],
 "ochre-03":[[19,15],[0,0],[17,0]],
 "ochre-04":[[18,14],[0,0],[2,15]],
 "ice-01":[[19,15],[0,0],[17,0]],
 "ice-02":[[19,12],[0,0],[3,15]],
 "ice-03":[[19,14],[0,0],[3,15]],
 "ice-04":[[19,14],[0,0],[15,0]],
 "plum-01":[[19,15],[0,0],[3,15]],
 "plum-02":[[19,14],[0,0],[4,15]],
 "plum-03":[[19,15],[0,0],[3,15]],
 "plum-04":[[19,15],[0,0],[2,15]],
};
export const FIXED_LANDSCAPE_CONFIGS=configs;
export function fixedLandscapeFor(zone,number){
 const config=byKey.get(`${zone}${number}`);if(!config)throw new Error(`Landscape ${zone}${number} is not authored.`);
 let level;
 if(zone==='A'&&number===4){
  level=landscapeFor('A',4);const extension=makeLandscape(config);
  level.size=[...LEVEL_FOOTPRINT];level.placements.push(...extension.placements.filter(p=>p.box[0]>=18));
 }else level=makeLandscape(config);
 level.id=`${PROFILES[zone].prefix}-${String(number).padStart(2,'0')}`;
 level.name=config.name;level.previewMode='landscape';
 const perches=config.perchRecords??config.perches.map(([x,z])=>({id:placementId(config,x,z),point:[...PROFILES[zone].perchPoint]}));
 level.previewWildlife={habitats:clone(FIXED_HABITAT_BOXES[level.id]??[]),habitatPoints:clone(FIXED_HABITAT_POINTS[level.id]??[]),perches:perches.map(p=>({id:p.id,point:[...p.point]}))};
 return assertLevelFootprint(level);
}
export const snapshotText=level=>JSON.stringify(level,null,2)+'\n';
export const sha256=text=>createHash('sha256').update(text).digest('hex');
export function fixedLandscapeInfo(zone,number){
 const c=byKey.get(`${zone}${number}`),level=fixedLandscapeFor(zone,number),id=level.id;
 const perchCandidates=c.perchRecords??c.perches.map(([x,z])=>({id:placementId(c,x,z),model:PROFILES[zone].perchModel,box:[x,0,z],point:[...PROFILES[zone].perchPoint]}));
 return {id,zone,number,name:c.name,size:[...LEVEL_FOOTPRINT],pathHeight:24,snapshot:`docs/landscape-reset-2026-10-18/landscapes/${id}.json`,sha256:sha256(snapshotText(level)),composition:c.composition,landmarkIds:c.landmarkIds??c.anchors.map(([,x,z])=>placementId(c,x,z)),perchCandidates};
}
