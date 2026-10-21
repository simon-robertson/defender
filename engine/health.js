// One bounded state per actor. Damage is resolved synchronously at the validated
// hitscan pulse, not by muzzle particles or by a later render callback.
export class Health {
 constructor(maximum){
  if(!Number.isFinite(maximum)||maximum<=0)throw new Error('Maximum health must be finite and positive.');
  this.maximum=maximum;this.reset();
 }
 reset(){this.current=this.maximum;this.hits=0;}
 get alive(){return this.current>0;}
 takeDamage(strength){
  if(!Number.isFinite(strength)||strength<0)throw new Error('Attack strength must be finite and non-negative.');
  if(!this.alive||strength===0)return 0;
  const applied=Math.min(this.current,strength);this.current-=applied;this.hits++;return applied;
 }
}
