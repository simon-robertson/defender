// Approved expansion geometry only. Motion rates, health and combat live elsewhere.
// All points use unrotated source coordinates; radians are runtime units.
const wheel=(id,parent,pivot,radius)=>({id,parent,pivot,axis:'x',radius});
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const common={root:[12,0,12],forward:[0,0,-1],body:'body',eyeMaterial:6};
export const ENEMY_EXPANSION_RIGS=freeze({
 roller:{...common,zone:'A',movement:'ground',kind:'wheels',effectOrigin:{part:'body',point:[12,12,12]},groundOffset:.09,
  wheels:[wheel('wheel-l','body',[5,6,12],Math.sqrt(37)),wheel('wheel-r','body',[19,6,12],Math.sqrt(37))]},
 'dune-tread':{...common,zone:'B',movement:'ground',kind:'wheels',effectOrigin:{part:'body',point:[12,6,12]},groundOffset:.17,
  wheels:[...['l','r'].flatMap((side,i)=>[5,12,19].map((z,j)=>wheel(`bogie-${side}${j+1}`,'body',[i?18.5:5.5,3,z],Math.sqrt(10))))]},
 tripod:{...common,zone:'C',movement:'ground',kind:'tripod',effectOrigin:{part:'body',point:[12,21,12]},groundOffset:0,
  inspectionAngleDegrees:6,legs:[
   {ids:['upper-fl','lower-fl','foot-fl'],hip:[9,17,10],knee:[5,10,7],ankle:[4.5,1,6.5]},
   {ids:['upper-fr','lower-fr','foot-fr'],hip:[15,17,10],knee:[19,10,7],ankle:[19.5,1,6.5]},
   {ids:['upper-rear','lower-rear','foot-rear'],hip:[12,17,15],knee:[12,10,18],ankle:[12,1,19.5]},
  ]},
 moth:{...common,zone:'A',movement:'air',kind:'wings',effectOrigin:{part:'body',point:[12,5,11]},groundOffset:0,
  wings:[{id:'wing-fl',pivot:[9,5,9],sign:1},{id:'wing-fr',pivot:[15,5,9],sign:-1},{id:'wing-rl',pivot:[9,5,16],sign:1},{id:'wing-rr',pivot:[15,5,16],sign:-1}],wingAxis:'z',maxFlapDegrees:30,maxBankDegrees:10},
 'twin-fan':{...common,zone:'B',movement:'air',kind:'fans',effectOrigin:{part:'body',point:[12,5,10]},groundOffset:0,
  rotors:[{id:'fan-l',pivot:[5,6.5,12],axis:'y'},{id:'fan-r',pivot:[19,6.5,12],axis:'y'}],maxBankDegrees:10},
 ray:{...common,zone:'C',movement:'air',kind:'bank',effectOrigin:{part:'body',point:[12,3,11]},groundOffset:0,maxBankDegrees:12},
 lantern:{...common,zone:'D',movement:'air',kind:'rotor',effectOrigin:{part:'body',point:[12,7,12]},groundOffset:0,
  rotors:[{id:'rotor',pivot:[12,20.5,12],axis:'y'}],maxBankDegrees:8},
});
export const ENEMY_EXPANSION_IDS=Object.freeze(Object.keys(ENEMY_EXPANSION_RIGS));
