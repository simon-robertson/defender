// Developer snapshots are expensive JSON/DOM writes, not simulation state.
// Use real time so slow motion still publishes up to ten snapshots per second.
export class InspectionSampler {
 constructor(){this.reset();}
 reset(){this.age=Infinity;}
 advance(unscaledDeltaSeconds){
  this.age+=unscaledDeltaSeconds;
  if(this.age<.1-1e-9)return false;
  this.age=0;return true; // Never catch up with a burst after a long frame.
 }
}
