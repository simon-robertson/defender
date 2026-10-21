// Scene release and same-level preparation share the same visible-screen gate.
export function beginPreparationFade(damage,session){
 if(!session.preparing)return false;
 damage.endCritterRun();return damage.hasCritterRemains;
}
