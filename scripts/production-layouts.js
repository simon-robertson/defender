// Authoring data for the four enlarged previews. This is not deployment logic.
// Coordinates are X/Z boxes; heights and coverage are world units.
const SIZE = 16;
const BOX = 24;
const key = (x, z) => `${x},${z}`;
const rectangle = (x0, z0, x1, z1) => {
  const cells = [];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells.push([x, z]);
  return cells;
};

const plans = {
  A: {
    corners: [[0,5],[8,5],[8,7],[4,7],[4,11],[15,11]],
    towers: [[2,6],[5,6],[9,10]],
    // Explicit connected courts and firing corridors, not every in-range box.
    reserveAllBaseCoverage: false,
    courts: [[1,4,3,4],[0,6,3,7],[4,6,7,6],[9,4,10,8],
      [3,8,3,12],[5,8,7,10],[8,9,13,10],[5,12,13,12],[1,8,2,8]],
    water: [...rectangle(0,9,1,14), ...rectangle(2,13,2,14), ...rectangle(3,14,6,14)],
    moundGroups: [[11,2,12,8,28],[13,2,15,6,32],[13,7,15,8,28],[14,9,15,9,28]],
    clusters: [],
    objects: [
      // One principal eastern woodland; the tallest crowns sit on its outer edge.
      ['treeTall',14,3,1],['treeTall',15,5,2],['tree',13,2,2],['tree',15,2],
      ['tree',14,5,3],['young',12,3,1],['young',13,5,2],['column',15,7],
      ['short',12,6,1],['young',13,7,3],['tree',14,7,1],['young',15,8,2],
      // A broken low inner ruin edge gives the hook a coherent landscape anchor.
      ['wall',11,4,1],['rock',11,5,2],['wall',11,6,1],['landmark',12,7],
      ['wall',12,8],['rock',13,8,1],['shrub',14,8,2],['rock',11,1],['shrub',10,1],['shrub',10,3,2],
      // Quiet approach, stream bank and exit framing; no matching corner groves.
      ['rock',2,2,1],['shrub',4,2],['young',7,1,2],
      ['rock',2,9],['shrub',2,10,1],['rock',2,11,2],
      ['rock',7,14,1],['shrub',9,14],['rock',12,14,3],['shrub',14,13,2],
      // Remote woodland has a substantial canopy, tapering before the approach.
      ['tree',0,0,1],['tree',2,0,2],['treeTall',3,0],['young',4,0,3],
      ['column',5,0,2],['tree',6,0,1],['young',8,0,3],['young',0,1],
      ['young',1,1,2],['rock',2,1,1],['shrub',3,1],['young',5,1,3],
      ['tree',6,2,2],['shrub',7,2,1],['rock',8,2],['shrub',1,3,2],
      ['tree',10,0,2],['young',11,0],['shrub',9,1,1],['tree',13,0,3],['short',14,0],
      // A lower bank apron joins an uneven outer woodland tail beyond the exit.
      ['shrub',7,15,2],['young',8,15,1],['rock',9,15],['tree',10,15,3],
      ['shrub',11,14,1],['young',12,15,2],['rock',13,15,1],['shrub',14,15],['young',15,14,3],
    ],
    details: [[10,2],[11,2],[12,1],[13,1],[14,1],[15,3],[15,4],
      [11,3],[12,5],[13,6],[14,6],[11,8],[14,9],[15,10],
      [0,8],[2,12],[3,13],[7,13],[8,14],[10,14],[11,13],[14,14],[15,13],[0,2],[1,1],[3,2]],
    detailAdditions: [[1,0],[7,0],[9,0],[12,0],[15,0],[0,3],[3,3],[4,3],
      [5,2],[8,1],[9,3],[8,13],[9,13],[10,13],[12,13],[13,14]],
  },
  B: {
    corners: [[0,6],[6,6],[6,4],[10,4],[10,10],[8,10],[8,8],[3,8],[3,15]],
    towers: [[4,7],[9,9],[4,12]],
    reserveAllBaseCoverage: false,
    courts: [[1,5,5,5],[1,7,6,7],[7,5,8,6],[9,5,9,9],
      [11,6,11,10],[8,11,10,11],[1,9,2,10],[2,11,2,14],
      [4,9,5,10],[4,11,4,14],[5,7,9,7]],
    water: [...rectangle(12,10,14,13), ...rectangle(15,11,15,12)],
    moundGroups: [[12,0,15,5,32],[11,1,11,3,28],[12,6,14,7,28]],
    clusters: [],
    objects: [
      // One eroded mesa/aqueduct landmark, with a low apron toward the road.
      ['landmark',14,1,1],['landmark',15,4,2],['low',13,2,2],['low',13,4],
      ['low',12,2,1],['column',15,1],['column',14,3,2],['young',12,4,3],
      ['young',13,0],['rock',11,2],['wall',12,5],['wall',13,6,1],
      ['wall',14,6,1],['rock',12,7,2],['shrub',13,8],
      // Oasis shore and sparse outside alternatives remain visually separate.
      ['young',15,9,1],['shrub',15,13,2],['rock',14,14,1],['shrub',12,14],
      ['rock',11,12,3],['wall',11,14,1],['rock',1,2],['shrub',2,3,2],
      ['young',0,3,1],['young',0,12,3],['rock',8,1,2],['shrub',10,1],['rock',7,2],
      // Broken desert shelves and scrub occupy the remote approach ground.
      ['low',0,0,2],['rock',1,0],['low',3,0,1],['young',4,0,3],
      ['rock',0,1,1],['shrub',2,1],['rock',3,1,3],['column',4,1,2],
      ['shrub',5,1,1],['rock',0,2,2],['young',2,2],['rock',4,2,1],
      // Dry southern groups connect to the oasis without narrowing the exit.
      ['rock',6,14,2],['low',7,14],['young',8,14,3],['rock',9,15,1],
      ['low',10,15,2],['shrub',8,12],['rock',9,13,3],['shrub',10,12,1],
      ['rock',6,15],['rock',14,8,1],['young',15,7,2],['shrub',14,9],['rock',15,6,3],
    ],
    details: [[12,1],[14,0],[15,2],[13,3],[15,5],[11,4],[12,6],[14,7],
      [15,8],[11,11],[11,13],[13,14],[15,14],[10,14],[0,1],[3,2],
      [1,3],[6,1],[8,2],[9,1],[0,10],[0,13],[1,14],[6,12],[7,13],[5,15]],
    detailAdditions: [[2,0],[5,0],[6,0],[1,1],[3,3],[4,3],[5,2],[6,2],
      [7,12],[8,13],[9,12],[10,13],[7,15],[8,15],[11,15],[15,10]],
  },
  C: {
    corners: [[5,0],[5,9],[8,9],[8,4],[12,4],[12,15]],
    towers: [[4,3],[6,5],[11,11]],
    reserveAllBaseCoverage: false,
    courts: [[3,1,4,4],[6,1,7,3],[6,4,7,8],[3,5,4,8],[6,10,8,11],
      [9,5,9,8],[9,3,12,3],[11,6,11,13],[13,7,14,13],[10,10,11,12]],
    water: [...rectangle(10,0,15,1), ...rectangle(11,2,15,2), ...rectangle(14,3,15,3)],
    moundGroups: [[0,2,1,8,32],[2,3,2,7,28],[0,9,2,11,28]],
    clusters: [],
    objects: [
      // A single slate/fir bank tapers from the western edge toward the pass.
      ['tree',0,3,1],['tree',1,5,2],['tree',0,7],['tree',1,8,3],
      ['young',2,4,1],['young',2,6,2],['young',1,10,3],['landmark',1,3],
      ['landmark',0,5,1],['broken',2,8,2],['wall',1,11],['wall',2,10,1],
      ['rock',2,2],['rock',0,10,1],['rock',3,11,2],['shrub',3,9],
      // Asymmetric lake and quiet eastern exit use low shore silhouettes.
      ['rock',9,1,2],['rock',10,2],['broken',13,3,1],['shrub',15,5],
      ['rock',15,9,2],['young',15,13,1],['shrub',9,12],
      ['rock',8,13,3],['shrub',6,14],['rock',3,13,1],
      // The slate/fir bank continues into a dense remote shoulder and tail.
      ['tree',0,0,2],['young',1,0],['rock',2,0,1],['landmark',0,1,3],
      ['young',1,1,2],['rock',2,1],['tree',0,6,1],['young',0,8,3],
      ['rock',2,7,2],['young',1,9],['tree',0,12,2],['young',1,12,1],
      ['tree',0,13,3],['landmark',1,13,1],['young',2,13,2],['tree',0,14],
      ['young',1,14,3],['tree',2,15,2],['rock',3,15],['tree',4,14,1],
      ['landmark',5,15,2],['young',6,15,1],['rock',7,13,3],['young',8,15,2],
      ['rock',5,12,1],['shrub',7,12],['shrub',4,12,2],['rock',5,13,3],
    ],
    details: [[0,2],[1,2],[0,4],[1,6],[2,5],[0,9],[2,9],[0,11],[2,12],
      [3,12],[4,13],[6,13],[7,14],[8,14],[9,13],[10,14],[13,14],[14,14],
      [15,11],[15,7],[13,5],[14,4],[9,2],[8,1],[3,0]],
    detailAdditions: [[0,15],[1,15],[2,14],[3,14],[4,15],[5,14],[7,15],[8,12],
      [9,14],[9,15],[10,15],[11,14],[14,15],[15,15],[2,3],[1,7]],
  },
  D: {
    corners: [[9,0],[9,9],[4,9],[4,5],[7,5],[7,3],[0,3]],
    towers: [[10,2],[8,4],[3,2]],
    reserveAllBaseCoverage: false,
    courts: [[10,1,11,4],[7,1,8,2],[8,3,8,6],[5,6,5,8],[7,6,8,8],
      [6,6,6,6],[2,6,3,10],[5,10,9,11],[1,2,5,2],[1,4,5,4],[6,2,6,4]],
    water: [[6,7],[6,8]],
    moundGroups: [[5,12,8,14,28],[9,13,10,14,32],[0,10,1,13,28]],
    clusters: [],
    objects: [
      // Dominant southern ruins and a smaller woodland tail form one backdrop.
      ['landmark',6,13],['wall',5,12],['broken',7,12,1],['wall',8,13,1],
      ['landmark',10,14,1],['broken',9,12,2],['rock',10,12],['young',7,14,2],
      ['tree',9,14,1],['shrub',5,14],['treeTall',0,11,1],['tree',1,13,3],
      ['young',2,12],['young',1,9,2],['shrub',0,14],['rock',2,11,1],
      ['broken',3,12,1],['rock',4,13,2],['rock',3,14],['shrub',4,14,2],
      // Low framing keeps the pale route and Spider's dark legs prominent.
      ['rock',12,2,1],['shrub',12,4],['broken',13,6,2],
      ['rock',12,10,2],['shrub',13,12],['rock',1,1],['shrub',3,0],['broken',0,5,3],
      // The remote eastern grove is broad; its inner edge stays low and open.
      ['rock',12,0,1],['tree',14,0,2],['young',15,1,3],['tree',13,1],
      ['tree',15,3,1],['young',14,4,2],['treeTall',15,5],['rock',12,5,3],
      ['shrub',12,6],['young',14,6,1],['tree',15,7,3],['rock',12,7,2],
      ['tree',14,8,1],['young',15,9,2],['shrub',12,8,3],['young',13,9],
      ['rock',12,9,1],['tree',14,10,3],['treeTall',15,11,2],['shrub',13,11],
      ['young',14,12,1],['rock',15,13,3],
      // Unequal woodland/ruin transitions join the southern backdrop.
      ['young',12,14,2],['tree',13,15],['young',11,15,1],['shrub',14,14,3],
      ['rock',15,15,2],['rock',11,13],['shrub',12,15,1],
      ['young',0,7,2],['shrub',0,8],['rock',1,7,3],
    ],
    details: [[0,10],[1,12],[2,13],[2,14],[4,12],[5,13],[6,14],[7,13],
      [8,14],[9,13],[10,13],[11,14],[12,13],[14,12],[13,10],[14,8],
      [13,5],[12,1],[11,0],[6,0],[4,1],[2,0],[0,4],[1,6],[1,8],[4,11]],
    detailAdditions: [[13,0],[15,0],[14,1],[15,2],[13,3],[14,3],[13,4],[14,5],
      [13,7],[15,8],[14,9],[15,10],[14,11],[11,12],[13,13],[14,15]],
  },
};

// Existing models plus the eight supplementary silhouettes approved for this pass.
const specialModels = {
  A: {young:'scenery-oak-young', short:'scenery-cypress-short'},
  B: {young:'ochre-cactus-young', low:'ochre-mesa-low'},
  C: {young:'ice-fir-young', broken:'ice-pillar-broken'},
  D: {young:'plum-tree-young', broken:'plum-arch-broken'},
};
const specialKinds = {young:'tree', short:'column', low:'landmark', broken:'landmark'};
const clusterOffsets = [[0,0],[1,0],[0,1],[-1,1],[1,2],[2,-1],[-1,-1]];

export function productionPath(corners) {
  const path = [], seen = new Set();
  let [x,z] = corners[0];
  const append = () => {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x<0 || z<0 || x>=SIZE || z>=SIZE || seen.has(key(x,z))) throw new Error('Invalid production route.');
    seen.add(key(x,z)); path.push([x,0,z]);
  };
  append();
  for (const [endX,endZ] of corners.slice(1)) {
    if ((x===endX)===(z===endZ)) throw new Error('Route corners must define a nonzero axis-aligned segment.');
    while (x!==endX || z!==endZ) { x+=Math.sign(endX-x); z+=Math.sign(endZ-z); append(); }
  }
  return path;
}

// Exact centre-line length inside a horizontal range circle. This is geometric
// coverage, not damage, LOS, balance, or a future guarantee that a site is legal.
export function productionCoverage(path, x, z, range=48) {
  if (!Number.isFinite(range) || range<0) throw new Error('Invalid coverage range.');
  const r=range/BOX;
  let total=0;
  for (let i=1; i<path.length; i++) {
    const a=path[i-1], b=path[i], dx=b[0]-a[0], dz=b[2]-a[2], px=a[0]-x, pz=a[2]-z;
    const projection=px*dx+pz*dz, discriminant=projection*projection-px*px-pz*pz+r*r;
    if (discriminant<=0) continue;
    const extent=Math.sqrt(discriminant);
    total+=Math.max(0,Math.min(1,-projection+extent)-Math.max(0,-projection-extent));
  }
  return total*BOX;
}

export function productionLayout(zone) {
  const plan=plans[zone];
  if (!plan) throw new Error('Unknown production zone.');
  const path=productionPath(plan.corners), route=new Set(path.map(p=>key(p[0],p[2])));
  const clear=new Map(), water=new Set(plan.water.map(([x,z])=>key(x,z)));
  const reserve=(x,z) => { if (!route.has(key(x,z))) clear.set(key(x,z),[x,z]); };
  // Current previews author distinct courts and sight corridors. The optional
  // range-band reservation remains available for comparing authoring studies.
  if (plan.reserveAllBaseCoverage!==false) {
    for (let z=0;z<SIZE;z++) for (let x=0;x<SIZE;x++) if (productionCoverage(path,x,z)>1e-6) reserve(x,z);
  }
  for (const court of plan.courts) for (const [x,z] of rectangle(...court)) reserve(x,z);
  for (const [x,z] of plan.towers) for (const [cx,cz] of rectangle(x-1,z-1,x+1,z+1)) reserve(cx,cz);
  for (const id of water) if (route.has(id)||clear.has(id)) throw new Error(`${zone} water enters reserved ground: ${id}`);
  const blocked=new Set([...route,...clear.keys(),...water]), used=new Set();
  const inside=(x,z)=>x>=0&&z>=0&&x<SIZE&&z<SIZE;
  const available=(x,z)=>inside(x,z)&&!blocked.has(key(x,z))&&!used.has(key(x,z));
  const scenery=[];
  const add=(kind,x,z,turn=0)=>{
    if (!available(x,z)) return false;
    const model=specialModels[zone][kind];
    scenery.push({kind:specialKinds[kind]??kind,x,z,turn,...(model?{model}:{})});
    used.add(key(x,z)); return true;
  };
  // Landmark placements lead; irregular groves fill only their local pockets.
  // Rejected cluster points remain empty instead of shifting towards the route.
  for (const object of plan.objects) add(...object);
  for (const [cx,cz,kinds] of plan.clusters) for (let i=0;i<kinds.length;i++) {
    const [dx,dz]=clusterOffsets[i]; add(kinds[i],cx+dx,cz+dz,(cx+cz+i)%4);
  }
  const details=[];
  for (let i=0;i<plan.details.length;i++) {
    const [x,z]=plan.details[i]; if (!available(x,z)) continue;
    details.push({kind:['tuft','pebbles','flowers'][i%3],x,z,turn:0,offset:[0,0,0]}); used.add(key(x,z));
  }
  // Smaller transition details thicken the existing anchors without consuming
  // deployment courts. Sparse flowers sit among predominantly tufts and stones.
  for (let i=0;i<plan.detailAdditions.length;i++) {
    const [x,z]=plan.detailAdditions[i]; if (!available(x,z)) continue;
    details.push({kind:['tuft','pebbles','tuft','flowers'][i%4],x,z,turn:i%4,offset:[0,0,0]}); used.add(key(x,z));
  }
  const mounds=[];
  for (const [x0,z0,x1,z1,height] of plan.moundGroups) for (const [x,z] of rectangle(x0,z0,x1,z1)) {
    if (!blocked.has(key(x,z))) mounds.push([x,z,height]);
  }
  const towerBoxes=new Set(plan.towers.map(([x,z])=>key(x,z)));
  return {
    size:[SIZE,SIZE], corners:plan.corners.map(p=>p.slice()), towers:plan.towers.map(p=>p.slice()),
    clear:[...clear.values()].filter(([x,z])=>!towerBoxes.has(key(x,z))).sort((a,b)=>a[1]-b[1]||a[0]-b[0]),
    water:plan.water.map(([x,z])=>[x,z,4,12]), mounds, scenery, details,
  };
}

export function productionPlacementCandidates(zone) {
  const layout=productionLayout(zone), path=productionPath(layout.corners);
  return layout.clear.map(([x,z])=>{
    const base=productionCoverage(path,x,z,48), upgrade1=productionCoverage(path,x,z,72);
    return {box:[x,z],baseCoverage:base,upgradeCoverage:upgrade1,
      role:base>=120?'strong':base>=70?'alternative':base>1e-6?'limited':upgrade1>1e-6?'upgrade-dependent':'reserve'};
  });
}

export function productionClearance(zone) {
  const layout=productionLayout(zone);
  return {path:productionPath(layout.corners).map(([x,,z])=>[x,z]),clear:layout.clear,water:layout.water.map(([x,z])=>[x,z])};
}
