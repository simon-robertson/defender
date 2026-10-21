import {ZONE_A_FOUR_SITES} from './zone-a-four.js';

const sites=(groups)=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map((box,i)=>({id:`${group}-${i+1}`,group,box})));
// Coordinates are selected only after the corresponding populated landscape
// handoff. Weapon themes are preview comparators, not campaign unlock rules.
export const LEVEL_LAYOUTS={
 'moss-01':{zone:'A',number:1,landscapeSha256:'ac6f2b6b002182fbfedd88e34da751a2d7d85bc26630020f09bd67fd7e5d0d52',
  rationale:'A compact return between northern limestone fragments and the southeast orchard pool; distinct early contact and eastward exit choices.',
  corners:{main:[[0,7],[5,7],[5,5],[11,5],[11,7],[15,7]]},
  positions:[[4,6],[8,6],[13,6]],generator:[4,5],
  sites:sites({early:[[3,8],[4,6],[4,8]],repeat:[[7,6],[8,6],[9,6]],late:[[13,6],[13,8],[14,6]]}),habitats:[[3,8],[7,6],[13,8]],
 },
 'moss-02':{zone:'A',number:2,landscapeSha256:'5752343c25503d8262556f6b393bc0b085998e59550a71da72f686ddec0d1633',
  rationale:'The route wraps below and east of the central limestone garden between two separated pools. Compare the early bend, inner return and eastward catch.',
  corners:{main:[[0,8],[5,8],[5,10],[10,10],[10,6],[13,6],[13,8],[17,8]]},
  positions:[[4,9],[11,7],[15,7]],
  sites:sites({early:[[3,9],[4,9],[6,9]],repeat:[[11,7],[12,7],[11,8]],late:[[14,7],[15,7],[16,7]]}),habitats:[[3,9],[11,8],[16,7]],
 },
 'moss-03':{zone:'A',number:3,landscapeSha256:'fc3403e3a2a88b1c416387e9befaa9a993107bf52266ed62f442ffeed46f8dad',
  rationale:'Two approaches pass the western knolls and southern orchard before merging beside the mere. Main-only early, branch-exclusive southern and shared-tail sites test concentration against distributed launch opportunities.',
  corners:{main:[[0,10],[6,10],[6,7],[11,7],[11,9],[18,9],[18,7],[19,7]],branch:[[5,15],[11,15],[11,9],[18,9],[18,7],[19,7]]},
  actorRoutes:{'preview-dog-1':'branch','preview-roller-1':'branch','preview-moth-1':'branch'},
  positions:[[5,9],[9,14],[16,8]],
  sites:sites({early:[[5,11],[5,9],[7,10]],branch:[[8,14],[9,14],[10,14]],late:[[14,8],[16,8],[17,8]]}),habitats:[[5,11],[8,14],[14,8]],
 },
 'moss-04':{zone:'A',number:4,landscapeSha256:'6a2a373612c98805bc0ebb2609f835ff0f6fb6c33fc30baf3b5a1815d1aaeab9',reuseA4:true,rationale:'Preserve the accepted old garden mere single route, ten sites and exact scenery subtraction as a later single-route counterpoint.',sites:ZONE_A_FOUR_SITES,habitats:[[5,9],[11,12],[16,6]]},
 'ochre-01':{zone:'B',number:1,landscapeSha256:'d23356e3d453f396b0c97be20c36aace164dd27a349301795b87e981896ee113',
  rationale:'A compact offset return above the southern mesas leaves the northwest cistern and sandstone groups intact; compare the first approach, inner elbow and eastward catch.',
  corners:{main:[[0,6],[7,6],[7,8],[9,8],[9,5],[15,5]]},positions:[[4,7],[8,7],[12,4]],
  sites:sites({early:[[3,7],[4,7],[5,7]],repeat:[[8,6],[8,7],[8,9]],late:[[11,4],[12,4],[14,4]]}),habitats:[[3,7],[8,9],[14,4]],
 },
 'ochre-02':{zone:'B',number:2,landscapeSha256:'ab8e206fa919a8b1eb87357c0e69037ab0f071ccfbb7336d825b525608ab773c',
  rationale:'A single climb threads between the broken aqueduct shelves before turning east above the basin; the middle court trades earlier exposure against the ascending return.',
  corners:{main:[[0,6],[5,6],[5,9],[8,9],[8,4],[17,4]]},positions:[[4,7],[6,8],[12,3]],
  sites:sites({early:[[3,7],[4,7],[4,8]],repeat:[[6,7],[6,8],[7,8]],late:[[11,3],[12,3],[14,3]]}),habitats:[[3,7],[7,8],[14,3]],
 },
 'ochre-03':{zone:'B',number:3,landscapeSha256:'40fef25a4aef42f8708357dd64427cfa26a3064772d3c80e6a435951ffb921f9',
  rationale:'A later single route crosses the irregular plain between three mesa masses. Separated launch sites cover a western turn, central crossing and eastern shoreline of the northern mesa.',
  corners:{main:[[0,7],[6,7],[6,5],[11,5],[11,8],[15,8],[15,6],[19,6]]},positions:[[5,6],[10,6],[17,7]],
  sites:sites({early:[[4,6],[5,6],[5,8]],repeat:[[8,6],[10,6],[12,7]],late:[[17,7],[18,7],[18,5]]}),habitats:[[4,6],[12,7],[18,7]],
 },
 'ochre-04':{zone:'B',number:4,landscapeSha256:'81849a342ec98ff1ca0ddc8518ec3973c846371e7d85b69a9b6004da25862c8e',
  rationale:'Two approaches skirt the western oasis and eastern mesa, merging before a shared northern exit. A gun covers the western approach, an enhanced Arc the southern approach, and a silo the common tail.',
  corners:{main:[[0,12],[7,12],[7,8],[10,8],[10,5],[17,5]],branch:[[9,17],[9,13],[10,13],[10,8],[10,5],[17,5]]},
  actorRoutes:{'preview-walker-1':'branch','preview-dune-tread-1':'branch','preview-twin-fan-1':'branch'},positions:[[6,11],[8,14],[14,4]],generator:[8,15],
  sites:sites({early:[[5,11],[6,11],[6,10]],branch:[[8,14],[10,14],[10,15]],late:[[13,4],[14,4],[15,4]]}),habitats:[[5,11],[10,15],[15,4]],
 },
};

export function expandCorners(corners){
 let [x,z]=corners[0];const path=[[x,0,z]];
 for(const [endX,endZ]of corners.slice(1)){if((x===endX)===(z===endZ))throw new Error('Route corners require nonzero orthogonal segments.');while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);path.push([x,0,z]);}}
 return path;
}
