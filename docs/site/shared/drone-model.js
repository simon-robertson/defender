// Authored articulation/clearance only; these are not weapon or flight stats.
const point=(...v)=>Object.freeze(v);
export const DRONE_ROTORS=Object.freeze([
 ['rotor-front-left',5,6,1],['rotor-front-right',19,6,-1],
 ['rotor-rear-left',5,18,-1],['rotor-rear-right',19,18,1],
].map(([id,x,z,spin])=>Object.freeze({id,gimbal:id.replace('rotor-','fan-'),pivot:point(x,z===6?11.5:10.5,z),spin})));
export const DRONE_MODEL=Object.freeze({
 id:'drone-defence',pad:'pad',body:'drone',gunYaw:'gun-yaw',gunPitch:'gun-pitch',
 padPivot:point(12,0,12),bodyPivot:point(12,9,12),gunPivot:point(12,5,9),
 forward:point(0,0,-1),muzzles:Object.freeze([point(10.5,5,2),point(13.5,5,2)]),
 gunYawMin:-15*Math.PI/180,gunYawMax:15*Math.PI/180,
 gunPitchMin:-35*Math.PI/180,gunPitchMax:10*Math.PI/180,
 minimumAimLift:4,minimumTurnLift:10,restLowestY:4,restGap:2,padDeckY:2,
 fanOuterHalfWidth:4,fanOpeningHalfWidth:3,rotorRadius:Math.sqrt(5),
 // Bound the compound pitch/roll vector, rather than each axis separately.
 fanTiltMax:20*Math.PI/180,minimumFanTiltLift:6,
});
export const DRONE_VARIANTS=Object.freeze(Object.fromEntries(
 ['base','upgrade1','upgrade2'].map((id,i)=>[id,Object.freeze({height:[14,16,19][i],chargingHeight:[9,11,13][i]})]),
));

// Level-aircraft envelope about bodyPivot, continuously enclosing permitted
// gun/fan poses and any body yaw. The fan cone gives top14.974615; the gun's
// lowest declared-pitch box corner is Y0.165813. See drone-hull.test.js.
// Neutral values are the existing BASE launch/descent contract; upgrade
// endurance/combat is unassigned and its taller neutral hull is not implied.
export const DRONE_HULL=Object.freeze({
 radius:16.5,below:9,above:6,
 variantAbove:Object.freeze({base:6,upgrade1:7,upgrade2:10}),
 neutralRadius:11,neutralBelow:5,neutralAbove:5,
});
