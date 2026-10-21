// Tactical carving of Artist's revised water-first D landscapes. Complete
// routes stay on supported dry land; future bridge options remain separate.
const sites=groups=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map((box,i)=>({id:`${group}-${i+1}`,group,box})));
export const PLUM_LAYOUTS={
 'plum-01':{zone:'D',number:1,landscapeSha256:'14875c8ca434721c2f0e902344f9105d3ad4908a01dfdca369f35977e565b5b2',
  rationale:'A compact orchard return below the crescent pond. Early approach, inner-return and late-exit choices sit between unequal plum groves rather than in a perimeter band.',
  corners:{main:[[0,6],[6,6],[6,8],[9,8],[9,6],[15,6]]},positions:[[4,7],[7,7],[13,7]],
  sites:sites({early:[[3,7],[4,7],[5,7]],repeat:[[7,7],[8,7],[8,9]],late:[[12,7],[13,7],[14,7]]}),habitats:[[3,7],[8,9],[14,7]],
 },
 'plum-02':{zone:'D',number:2,landscapeSha256:'c6426b653d4c15bb1b5df36fcdf4f070f6f28123b1ca48f6e8629a75e1f2a423',
  rationale:'From the western entrance, the route skirts the north bank of the shallow stream and turns south between the two detached arch groups. The final elbow opens a separate southern catch without flattening the stream or groves.',
  corners:{main:[[0,6],[6,6],[6,8],[10,8],[10,13],[13,13],[13,15]]},positions:[[5,7],[9,10],[12,14]],
  sites:sites({early:[[4,7],[5,7],[7,7]],repeat:[[9,9],[9,10],[9,11]],late:[[11,14],[12,14],[14,14]]}),habitats:[[4,7],[9,11],[14,14]],
 },
 'plum-03':{zone:'D',number:3,landscapeSha256:'56ecd004821bd5696eec9d9b587d0a7c90f639aed220eafb9c4534ed7d208284',
  rationale:'The large eastern lake determines a west-bank route that descends through two offsets toward a southern exit. Silos compare early woodland contact, a repeated central corner and the last shoreline interception; the lake remains a major landform.',
  corners:{main:[[0,7],[6,7],[6,9],[9,9],[9,13],[12,13],[12,15]]},positions:[[5,8],[8,10],[11,14]],
  sites:sites({early:[[4,8],[5,8],[7,8]],repeat:[[8,10],[8,11],[10,12]],late:[[10,14],[11,14],[11,15]]}),habitats:[[4,8],[8,11],[10,14]],
 },
 'plum-04':{zone:'D',number:4,landscapeSha256:'d5d0fe5c83dba9244a23fe443fa3391312283a1b9a3c9e6737931f3ad49a7624',
  rationale:'On the eastern bank of the winding river, a long northern approach wraps around the high grove while a short eastern approach joins its lower corner. Early gun and branch Arc placements trade immediate exposure against the shared downstream silo, which alone receives the generator bonus.',
  corners:{main:[[10,0],[10,6],[14,6],[14,10],[10,10],[10,17]],branch:[[17,8],[16,8],[16,10],[14,10],[10,10],[10,17]]},
  actorRoutes:{'preview-spider-1':'branch','preview-lantern-1':'branch'},positions:[[9,5],[17,9],[11,12]],generator:[11,11],
  sites:sites({early:[[9,3],[9,5],[9,6]],branch:[[17,7],[17,9],[17,10]],late:[[11,12],[11,15],[9,16]]}),habitats:[[9,3],[17,7],[9,16]],
 },
};
