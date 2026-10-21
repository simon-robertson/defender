import {ZONE_A_FOUR_SITES} from './zone-a-four.js';
import {PLUM_LAYOUTS} from './level-rebuild-d.js';
import {ICE_LAYOUTS} from './level-rebuild-c.js';

const sites=(groups)=>Object.entries(groups).flatMap(([group,boxes])=>boxes.map((box,i)=>({id:`${group}-${i+1}`,group,box})));
// Coordinates are selected only after the corresponding populated landscape
// handoff. Weapon themes are preview comparators, not campaign unlock rules.
export const LEVEL_LAYOUTS={
 ...PLUM_LAYOUTS,
 ...ICE_LAYOUTS,
 'moss-01':{zone:'A',number:1,landscapeSha256:'7d4ab1a02c83a7ce62670e64cb5dfa9be95b4f2923eb75dab2608a60c0818e35',
  rationale:'A compact return on the dry orchard mainland between northern limestone fragments and scattered southern groves; distinct early contact and eastward exit choices.',
  corners:{main:[[0,7],[5,7],[5,5],[11,5],[11,7],[15,7]]},
  positions:[[4,6],[8,6],[13,6]],generator:[4,5],
  sites:sites({early:[[3,8],[4,6],[4,8]],repeat:[[7,6],[8,6],[9,6]],late:[[13,6],[13,8],[14,6]]}),habitats:[[3,8],[7,6],[13,8]],
 },
 'moss-02':{zone:'A',number:2,landscapeSha256:'2cd7f34566e7bdb3e48a88ba480b086cb92bc1664853ef71c91b03bbec4f076f',
  rationale:'A western mainland return creates repeat exposure beside the limestone garden before the route follows the broad lake’s southern shore. The late catch adds southern shoreline coverage away from the early court.',
  corners:{main:[[0,8],[4,8],[4,3],[6,3],[6,10],[8,10],[8,13],[17,13]]},
  positions:[[3,7],[5,6],[14,14]],
  sites:sites({early:[[2,7],[3,7],[3,5]],repeat:[[5,5],[5,6],[5,8]],late:[[13,14],[14,14],[15,14]]}),habitats:[[2,7],[5,8],[15,14]],
 },
 'moss-03':{zone:'A',number:3,landscapeSha256:'60d2e503c5a057b0f544a11f4f68c63dbb56a5ddd4d1c5dd57cddeba1723f100',
  rationale:'Two dry approaches thread the western knolls and southern orchard, merging below the winding stream into a shared southern tail. Branch-specific and shared coverage compete without crossing water or raising defence ground.',
  corners:{main:[[0,10],[6,10],[6,7],[11,7],[11,9],[12,9],[12,14],[19,14]],branch:[[5,15],[10,15],[10,12],[12,12],[12,14],[19,14]]},
  actorRoutes:{'preview-dog-1':'branch','preview-roller-1':'branch','preview-moth-1':'branch'},
  positions:[[5,9],[9,13],[18,15]],
  sites:sites({early:[[5,11],[5,9],[7,10]],branch:[[8,14],[9,13],[9,14]],late:[[13,15],[18,15],[19,13]]}),habitats:[[5,11],[8,14],[19,13]],
 },
 'moss-04':{zone:'A',number:4,landscapeSha256:'6a2a373612c98805bc0ebb2609f835ff0f6fb6c33fc30baf3b5a1815d1aaeab9',reuseA4:true,rationale:'Preserve the accepted old garden mere single route and ten attack sites as a later single-route counterpoint, with three extra local tree removals exposing the generator support ground.',sites:ZONE_A_FOUR_SITES,habitats:[[5,9],[11,12],[16,6]]},
 'ochre-01':{zone:'B',number:1,landscapeSha256:'b0f7f64033e5d2174682a2cf1e99feb4422518c69082c3478f5ff7753cff6218',
  rationale:'A compact offset return above the southern mesas leaves the northwest cistern and sandstone groups intact; compare the first approach, inner elbow and eastward catch.',
  corners:{main:[[0,6],[7,6],[7,8],[9,8],[9,5],[15,5]]},positions:[[4,7],[8,7],[12,6]],
  sites:sites({early:[[3,7],[4,7],[5,7]],repeat:[[8,6],[8,7],[8,9]],late:[[12,6],[13,6],[14,6]]}),habitats:[[3,7],[8,9],[14,6]],
 },
 'ochre-02':{zone:'B',number:2,landscapeSha256:'ff669a9ed28073bcfaa4ce46ddc9b2482ce2ca6726332a3269248dc0864df02b',
  rationale:'The winding river separates two banks. A northern return and descending eastern-bank route preserve its aqueduct groups, while southern sites provide a distinct final catch without crossing water.',
  corners:{main:[[17,2],[12,2],[12,5],[16,5],[16,8],[11,8],[11,9],[14,9],[14,15]]},positions:[[13,3],[15,6],[15,13]],
  sites:sites({early:[[13,3],[14,3],[14,4]],repeat:[[15,6],[15,7],[13,7]],late:[[15,13],[15,14],[13,15]]}),habitats:[[14,3],[13,7],[15,14]],
 },
 'ochre-03':{zone:'B',number:3,landscapeSha256:'1d4f649794f08f84deec59a949851e029fe299af4f010aec4cb86ea7d600ee01',
  rationale:'A later single route crosses the irregular plain between three mesa masses. Separated launch sites cover a western turn, central crossing and eastern edge of the northern mesa.',
  corners:{main:[[0,7],[6,7],[6,5],[11,5],[11,8],[15,8],[15,6],[19,6]]},positions:[[5,6],[10,6],[17,7]],
  sites:sites({early:[[4,6],[5,6],[5,8]],repeat:[[8,6],[10,6],[12,7]],late:[[17,7],[18,7],[18,5]]}),habitats:[[4,6],[12,7],[18,7]],
 },
 'ochre-04':{zone:'B',number:4,landscapeSha256:'7885bb1ed9fe32807ba110c4b5a1036cc56ce394bc8537ebca711f11ad54c013',
  rationale:'A northeast approach follows the large oasis’s eastern shore while a second approaches from the south. They merge below the mesa into a common southern tail; a gun, enhanced branch Arc and shared-tail silo demonstrate distributed coverage.',
  corners:{main:[[17,3],[12,3],[12,5],[11,5],[11,9],[10,9],[10,15],[17,15]],branch:[[5,17],[10,17],[10,15],[17,15]]},
  actorRoutes:{'preview-walker-1':'branch','preview-dune-tread-1':'branch','preview-twin-fan-1':'branch'},positions:[[13,4],[9,16],[16,16]],generator:[9,15],
  sites:sites({early:[[13,4],[14,4],[15,4]],branch:[[8,16],[9,16],[11,17]],late:[[15,16],[16,16],[17,16]]}),habitats:[[14,4],[8,16],[15,16]],
 },
};

export function expandCorners(corners){
 let [x,z]=corners[0];const path=[[x,0,z]];
 for(const [endX,endZ]of corners.slice(1)){if((x===endX)===(z===endZ))throw new Error('Route corners require nonzero orthogonal segments.');while(x!==endX||z!==endZ){x+=Math.sign(endX-x);z+=Math.sign(endZ-z);path.push([x,0,z]);}}
 return path;
}
