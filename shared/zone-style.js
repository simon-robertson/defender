import {ZONES} from './model.js';

// Small shared art settings, not a cache of loaded zone assets.
export const ZONE_PREVIEWS=Object.freeze([
 {zone:'A',key:'1',level:'moss-01',name:ZONES.A.name,description:'Woodland ruins, quiet water, porcelain sentries.',background:null},
 {zone:'B',key:'2',level:'ochre-01',name:ZONES.B.name,description:'Sandstone terraces, desert plants, porcelain sentries.',background:'#BAA58C'},
 {zone:'C',key:'3',level:'ice-01',name:ZONES.C.name,description:'Snow-capped firs, cold water, ember accents.',background:'#A5ACAC'},
 {zone:'D',key:'4',level:'plum-01',name:ZONES.D.name,description:'Plum canopies, weathered ruins, mint sentries.',background:'#B4ADA5'},
]);
const terrainColors={
 A:['#788C51','#C6BD9E','#4E8F91','#7C9055','#74884E','#809158','#D7CCAE','#E0D5B7','#CEC5A8','#B7B398','#9C9E7F','#868A69','#B9B59A','#C9C2A3','#A7AC90','#D4C9A8'],
 B:['#CC9855','#B97549','#408B91','#D5A45F','#C28B4C','#DBAE6B','#EBD3A4','#F1DCB5','#DEC395','#B79B73','#A65D41','#864B3A','#B68E65','#C29B72','#A97A56','#D1AC7E'],
 C:['#E6E9E5','#798792','#52899F','#EEF0EA','#D8DFDD','#E3E8E4','#A89D86','#B5AA94','#9B927F','#7D7A70','#5E6E7C','#485762','#7C898B','#98A4A3','#697A80','#A7AEAA'],
 D:['#777467','#777780','#5E839B','#807D6F','#6E6C61','#858071','#D7C9B1','#E4D6BD','#CBBEA7','#A59984','#5D5D67','#44434E','#7B8585','#959D96','#69767A','#A4A99E'],
};
export const TERRAIN_MATERIALS=Object.fromEntries(Object.entries(terrainColors).map(([zone,colors])=>[zone,colors.map((color,i)=>({color,reflectiveness:i===2?.65:0,emission:0}))]));

// All 17 shared arsenal slots, including face-override shades and recesses.
// Geometry, material indices and rigid pivots remain identical across zones.
// Identity-light slots 4/14/15 retain emission/castsLight through recolouring;
// slot 2 is secondary armour, including Ice's orange panels, not a light.
const turretColors={
 B:['#F1E8D5','#193E48','#35636A','#D79A4B','#75B6AA','#FAF2E2','#D2C6AE','#B4A88F','#3B6169','#142F37','#56848A','#23484F','#E7B574','#AF7940','#9BD0C2','#508D85','#0E252C'],
 C:['#EDE6D9','#243A4B','#C66C3C','#B5B1A1','#EF854A','#FBF6EA','#CFC6B5','#A49D91','#496477','#182A36','#E69A61','#91472D','#D6D1BF','#8B897C','#FFA46A','#B95D32','#101D2B'],
 D:['#B8DCC6','#302C3D','#655376','#BBB5A2','#F08873','#DCEBDD','#8EB39F','#6D8D7D','#51485B','#231F30','#877199','#4C3E5E','#D4CEBA','#8E8B7B','#FFA994','#BC6358','#181522'],
};
export function modelForZone(model,zone){
 if(zone==='A'||model.colorMode==='authored')return model;
 const enhancer=model.id==='power-generator';
 const colors=(enhancer||['turret-study','arc-spire','missile-launcher','guided-missile'].includes(model.id))?turretColors[zone]:ZONES[zone]?.colors;
 if(!colors)throw new Error('Unknown zone palette.');
 // Enhancers retain their green identity lights across every zone. Ordinary
 // armour and cooling panels still use the shared arsenal palette.
 return {...model,materials:model.materials.map((m,i)=>({...m,color:enhancer&&(i===4||i===14||i===15)?m.color:colors[i]??m.color}))};
}
