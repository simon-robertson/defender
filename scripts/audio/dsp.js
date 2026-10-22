// Offline mono authoring DSP. Coefficients: W3C Audio EQ Cookbook (RBJ),
// https://www.w3.org/TR/audio-eq-cookbook/ (LPF/HPF/constant-0dB-peak BPF).
export class Biquad {
 constructor(type,cutoff,q,sampleRate){this.type=type;this.sampleRate=sampleRate;this.x1=this.x2=this.y1=this.y2=0;this.configure(cutoff,q);}
 configure(cutoff,q){
  const w=2*Math.PI*cutoff/this.sampleRate,c=Math.cos(w),alpha=Math.sin(w)/(2*q),a0=1+alpha;
  if(this.type==='lowpass'){this.b0=(1-c)/2/a0;this.b1=(1-c)/a0;this.b2=this.b0;}
  else if(this.type==='highpass'){this.b0=(1+c)/2/a0;this.b1=-(1+c)/a0;this.b2=this.b0;}
  else if(this.type==='bandpass'){this.b0=alpha/a0;this.b1=0;this.b2=-alpha/a0;}
  else throw new Error('Unknown biquad type');
  this.a1=-2*c/a0;this.a2=(1-alpha)/a0;
 }
 process(value){const y=this.b0*value+this.b1*this.x1+this.b2*this.x2-this.a1*this.y1-this.a2*this.y2;this.x2=this.x1;this.x1=value;this.y2=this.y1;this.y1=y;return y;}
}
