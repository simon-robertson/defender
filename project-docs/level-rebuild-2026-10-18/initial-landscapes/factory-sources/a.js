import {zoneAFourLandscape} from '../zone-a-four-landscape.js';

export const A_LANDSCAPES=[
 {zone:'A',number:1,name:'Limestone Orchard',size:[16,14],seed:101,
  composition:'Small southeast orchard pool; unequal western oak knolls and northern limestone fragments. Low flowers occupy the interstices, without a reserved route.',
  water:[[9,11,12],[10,10,13],[11,11,13]],mounds:[[2,3,2.1,2.6,32],[12,2,1.7,1.5,30]],
  groves:[[2,3,3.0,3.3],[7,1,2.8,1.7],[13,3,2.3,2.4],[3,11,3.0,2.0],[8,8,2.1,2.0]],flowers:[[7,5,3.0,2.5],[13,12,2,1]],
  anchors:[['marker',8,2],['wall',9,2],['wall',8,3,1],['rock',9,4],['shrub',7,3],['wall',3,9,1],['rock',4,10],['column',14,8],['rock',12,8],['rock',10,12]],perches:[[1,3,2],[13,2,1],[3,11,0]]},
 {zone:'A',number:2,name:'Twin Pools',size:[18,16],seed:208,
  composition:'Two unequal, separated pools at the northwest and southeast, with cypress accents on their banks. Three oak islands and a broken limestone garden fill the dry mainland.',
  water:[[1,2,3],[2,1,4],[3,1,4],[4,2,3],[10,13,14],[11,12,15],[12,12,15],[13,13,14]],mounds:[[13,2,2.5,1.8,32],[2,12,1.8,2.4,30]],
  groves:[[7,2,3.2,2.0],[15,3,2.4,3.0],[2,12,2.7,3.2],[7,12,2.3,2.0],[10,7,2.0,2.7],[3,6,1.5,1.8,'column']],flowers:[[5,7,3.4,2.3],[16,13,1.4,2]],
  anchors:[['marker',7,6],['wall',8,6],['wall',7,7,1],['shrub',8,7],['rock',9,7],['wall',4,12,1],['column',1,5],['column',12,14],['rock',15,9],['rock',11,11]],perches:[[7,1,0],[15,3,2],[2,13,1]]},
 {zone:'A',number:3,name:'Cypress Rise',size:[20,16],seed:319,
  composition:'Long western wooded knolls contrast with a broad northeast mere. Slender cypress clusters, low southern orchard groups and two detached ruin fragments give this wider landscape a different skyline.',
  water:[[1,15,16],[2,14,17],[3,13,17],[4,13,17],[5,14,16]],mounds:[[2,3,1.7,2.2,32],[3,7,1.8,2.0,30],[16,12,2.2,1.6,32]],
  groves:[[2,3,2.4,3.0,'column'],[3,8,2.7,2.8,'column'],[8,2,2.6,1.8],[17,11,2.4,2.7],[10,13,3.0,1.6],[7,8,1.8,2.1]],flowers:[[12,8,3.3,2.3],[5,13,2.2,1.4]],
  anchors:[['marker',8,4],['wall',9,4],['wall',8,5,1],['rock',10,5],['wall',13,11],['marker',14,12],['shrub',13,12],['spire',2,4],['spire',3,8],['rock',12,3],['column',18,5]],perches:[[8,1,1],[17,12,0],[7,13,2]]},
 {zone:'A',number:4,name:'The Old Garden Mere',size:[18,16],seed:0,
  composition:'The accepted original: northeast mere, western wooded ridge, southeast raised grove and two limestone ruin groups. Geometry, IDs and every placement are unchanged from the frozen A4 precursor.',
  reuse:zoneAFourLandscape,originalSnapshot:'docs/zone-a-four-landscape.json',
  perchRecords:[{id:'a4-land-1-2',model:'scenery-oak-tall',box:[1,0,2],point:[11.5,54,11.5]},{id:'a4-land-16-12',model:'scenery-oak-tall',box:[16,0,12],point:[11.5,54,11.5]},{id:'a4-land-3-14',model:'scenery-oak',box:[3,0,14],point:[11.5,44,11.5]}],
  landmarkIds:['a4-land-9-6','a4-land-10-6','a4-land-9-7','a4-land-11-7','a4-land-11-8','a4-land-4-11','a4-land-5-11']},
];
