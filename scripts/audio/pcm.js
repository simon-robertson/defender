// Offline authoring only. Nothing in this module is loaded by the game.
const MAX_SECONDS=30, MAX_SAMPLES=48000*MAX_SECONDS;
function number(value,min,max,label){if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be ${min}..${max}`);return value;}
function keys(value,allowed,label){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label} must be an object`);for(const key of Object.keys(value))if(!allowed.includes(key))throw new Error(`Unknown ${label} field: ${key}`);}
export function validateRecipe(recipe){
 keys(recipe,['id','name','purpose','sampleRate','channels','duration','seed','gain','fadeIn','fadeOut','loop','layers'],'recipe');
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(recipe.id))throw new Error('Invalid recipe id');
 for(const key of ['name','purpose'])if(typeof recipe[key]!=='string'||!recipe[key].trim()||recipe[key].length>300)throw new Error(`Invalid ${key}`);
 if(recipe.sampleRate!==48000)throw new Error('Masters use 48000 Hz');
 if(recipe.channels!==1)throw new Error('Sound files must be mono (channels: 1)');
 number(recipe.duration,.02,MAX_SECONDS,'duration');number(recipe.seed,1,0xffffffff,'seed');if(!Number.isInteger(recipe.seed))throw new Error('seed must be an integer');
 number(recipe.gain,0,1,'gain');number(recipe.fadeIn,0,recipe.duration/2,'fadeIn');number(recipe.fadeOut,0,recipe.duration/2,'fadeOut');
 const frames=Math.round(recipe.duration*recipe.sampleRate);
 if(frames*recipe.channels>MAX_SAMPLES)throw new Error('Sample budget exceeded');
 if(recipe.loop!==undefined){keys(recipe.loop,['startFrame','endFrame'],'loop');if(!Number.isInteger(recipe.loop.startFrame)||!Number.isInteger(recipe.loop.endFrame)||recipe.loop.startFrame<0||recipe.loop.endFrame>frames||recipe.loop.endFrame-recipe.loop.startFrame<2)throw new Error('Invalid loop frames');}
 if(!Array.isArray(recipe.layers)||!recipe.layers.length||recipe.layers.length>16)throw new Error('Use 1..16 layers');
 for(const layer of recipe.layers){
  keys(layer,['type','gain','start','duration','frequency','endFrequency','attack','release','cutoff','pan'],'layer');
  if(!['sine','triangle','noise'].includes(layer.type))throw new Error('Unknown layer type');
  number(layer.gain,0,1,'layer gain');number(layer.start,0,recipe.duration,'layer start');number(layer.duration,.001,recipe.duration-layer.start,'layer duration');
  number(layer.attack,0,layer.duration/2,'attack');number(layer.release,0,layer.duration/2,'release');number(layer.pan,0,0,'pan');
  if(layer.pan!==0)throw new Error('Mono layers must have zero pan');
  if(layer.type!=='noise'){number(layer.frequency,1,recipe.sampleRate/4,'frequency');number(layer.endFrequency,1,recipe.sampleRate/4,'endFrequency');}
  if(layer.cutoff!==undefined)number(layer.cutoff,10,recipe.sampleRate/2,'cutoff');
 }
 return recipe;
}
export function renderRecipe(recipe){
 validateRecipe(recipe);
 const rate=recipe.sampleRate,frames=Math.round(recipe.duration*rate),samples=new Float32Array(frames*recipe.channels);
 let rng=recipe.seed>>>0;
 function noise(){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/2147483648-1;}
 for(const layer of recipe.layers){
  const start=Math.round(layer.start*rate),length=Math.min(Math.round(layer.duration*rate),frames-start),alpha=layer.cutoff===undefined?1:1-Math.exp(-2*Math.PI*layer.cutoff/rate);
  let phase=0,filtered=0;
  
  for(let i=0;i<length;i++){
   let value;
   if(layer.type==='noise')value=noise();else{value=layer.type==='sine'?Math.sin(phase*2*Math.PI):1-4*Math.abs(phase-.5);const fraction=i/Math.max(1,length-1);phase=(phase+(layer.frequency+(layer.endFrequency-layer.frequency)*fraction)/rate)%1;}
   filtered+=alpha*(value-filtered);
   const attack=layer.attack*rate,release=layer.release*rate,envelope=Math.min(1,attack?i/attack:1,release?(length-1-i)/release:1),offset=(start+i)*recipe.channels;
   const mixed=filtered*layer.gain*envelope;
   samples[offset]+=mixed;
  }
 }
 for(let i=0;i<frames;i++){
  const envelope=recipe.gain*Math.min(1,recipe.fadeIn?i/(recipe.fadeIn*rate):1,recipe.fadeOut?(frames-1-i)/(recipe.fadeOut*rate):1);
  for(let c=0;c<recipe.channels;c++)samples[i*recipe.channels+c]*=envelope;
 }
 const analysis=analyse(samples,recipe.channels,recipe.loop);
 if(analysis.peak>=1)throw new Error(`${recipe.id} clips (${analysis.peak}); reduce layer/master gain`);
 return {samples,frames,analysis};
}
export function analyse(samples,channels,loop){
 if(!samples.length||samples.length%channels)throw new Error('Invalid PCM frame count');
 const frames=samples.length/channels,dc=new Array(channels).fill(0);let peak=0,sum=0;
 for(let i=0;i<samples.length;i++){const value=samples[i];if(!Number.isFinite(value))throw new Error('Non-finite PCM');peak=Math.max(peak,Math.abs(value));sum+=value*value;dc[i%channels]+=value;}
 for(let c=0;c<channels;c++)dc[c]/=frames;
 const result={peak,rms:Math.sqrt(sum/samples.length),dc,frames};
 if(loop){let jump=0,slopeJump=0;for(let c=0;c<channels;c++){
  const a=loop.startFrame*channels+c,b=(loop.endFrame-1)*channels+c;
  jump=Math.max(jump,Math.abs(samples[a]-samples[b]));
  slopeJump=Math.max(slopeJump,Math.abs((samples[a+channels]-samples[a])-(samples[b]-samples[b-channels])));
 }result.loop={...loop,boundaryJump:jump,slopeJump};}
 return result;
}
export function encodeWav(samples,sampleRate,channels){
 if(sampleRate!==48000||channels!==1)throw new Error('Masters must be 48000 Hz mono');
 const analysis=analyse(samples,channels);if(analysis.peak>=1)throw new Error('PCM clips');
 const dataBytes=samples.length*3,bytes=Buffer.alloc(44+dataBytes+(dataBytes&1));bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(channels,22);bytes.writeUInt32LE(sampleRate,24);bytes.writeUInt32LE(sampleRate*channels*3,28);bytes.writeUInt16LE(channels*3,32);bytes.writeUInt16LE(24,34);bytes.write('data',36);bytes.writeUInt32LE(samples.length*3,40);
 for(let i=0;i<samples.length;i++)bytes.writeIntLE(Math.round(samples[i]*8388607),44+i*3,3);
 return bytes;
}
// Inspect the formats emitted by this tool and opusdec (including extensible float WAV).
export function readWav(bytes){
 const b=Buffer.from(bytes);if(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE')throw new Error('Not a RIFF WAV');
 let format,channels,sampleRate,bits,blockAlign,data;
 for(let p=12;p+8<=b.length;){const id=b.toString('ascii',p,p+4),size=b.readUInt32LE(p+4),start=p+8;if(start+size>b.length)throw new Error('Truncated WAV');
  if(id==='fmt '){if(size<16)throw new Error('Invalid fmt chunk');format=b.readUInt16LE(start);channels=b.readUInt16LE(start+2);sampleRate=b.readUInt32LE(start+4);blockAlign=b.readUInt16LE(start+12);bits=b.readUInt16LE(start+14);if(format===0xfffe){if(size<40)throw new Error('Invalid extensible fmt');format=b.readUInt16LE(start+24);}}
  if(id==='data')data=b.subarray(start,start+size);p=start+size+(size&1);
 }
 if(![1,2].includes(channels)||!sampleRate||!data||!((format===1&&[16,24].includes(bits))||(format===3&&bits===32))||blockAlign!==channels*bits/8||data.length%blockAlign)throw new Error('Unsupported WAV format');
 const samples=new Float32Array(data.length/(bits/8));
 for(let i=0;i<samples.length;i++)samples[i]=format===3?data.readFloatLE(i*4):bits===24?data.readIntLE(i*3,3)/8388608:data.readInt16LE(i*2)/32768;
 analyse(samples,channels);return {samples,channels,sampleRate,frames:samples.length/channels,bits};
}
