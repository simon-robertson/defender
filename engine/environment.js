// A fixed art-directed daylight setting, evaluated only when the level loads or
// its author settings change. The direction describes the sun at noon; its XZ
// heading stays authored while time selects elevation and daylight strength.
export function levelLighting(environment){
 const sky=environment.sky,daylight=Math.max(0,Math.sin((environment.timeOfDay-6)*Math.PI/12));
 return {...sky,direction:[sky.direction[0],sky.direction[1]*Math.max(.04,daylight),sky.direction[2]],
  intensity:sky.intensity*daylight,ambientIntensity:sky.ambientIntensity*(.18+.82*daylight)};
}
