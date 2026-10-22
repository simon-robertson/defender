const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reviewPage(entries){
 const cards=entries.map(entry=>{
  const {recipe,analysis,decodedAnalysis,paths,waveform}=entry;
  const wave=waveform.map((peak,i)=>`M${i} ${50-peak*48}v${peak*96}`).join('');
  return `<section><h2>${escape(recipe.name)}</h2><p>${escape(recipe.purpose)}</p><svg viewBox="0 0 512 100" role="img" aria-label="Master waveform"><path d="${wave}" stroke="#d4ad62" stroke-width="1"/></svg><p>${recipe.channels} channel(s) · ${analysis.frames} frames · ${recipe.sampleRate} Hz · peak ${analysis.peak.toFixed(4)} · RMS ${analysis.rms.toFixed(4)}</p>${[['Master WAV',paths.master],['Ogg Opus',paths.ogg],['Decoded Opus WAV',paths.decoded]].filter(([,path])=>path).map(([label,path])=>`<label>${label}<audio controls preload="none" src="${escape(path)}"></audio></label>${recipe.loop?`<button data-path="${escape(path)}" data-start="${recipe.loop.startFrame/recipe.sampleRate}" data-end="${recipe.loop.endFrame/recipe.sampleRate}">Loop ${label}</button>`:''}`).join('')}${recipe.loop?`<p>Boundary jump: master ${analysis.loop.boundaryJump.toFixed(6)}${decodedAnalysis?`, decoded ${decodedAnalysis.loop.boundaryJump.toFixed(6)}`:''}. This is a measurement, not proof of an inaudible seam.</p>`:''}</section>`;
 }).join('');
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Audio pipeline review</title><style>body{color:#e6e8eb;background:#15171a;font:16px system-ui;max-width:900px;margin:40px auto;padding:0 20px}section{border-top:1px solid #41454b;padding:20px 0}h1,h2{color:#dfba76}audio{display:block;width:100%;margin:8px 0 18px}svg{width:100%;height:110px;background:#20242a}button{padding:10px;margin:0 10px 12px 0}#status{min-height:2em}</style><h1>Audio pipeline review</h1><p>Diagnostic sounds only. Use low playback volume initially. Compare the lossless master with the encoded and decoded versions. Loop buttons use decoded Web Audio buffers and explicit master-time boundaries; no gameplay is running.</p><button id="stop">Stop all</button><p id="status" role="status"></p>${cards}<script type="module">
let context=null,source=null,epoch=0;
const status=document.querySelector('#status');
function stop(){epoch++;if(source){source.stop();source.disconnect();source=null;}for(const audio of document.querySelectorAll('audio'))audio.pause();}
document.querySelector('#stop').onclick=stop;
for(const audio of document.querySelectorAll('audio'))audio.addEventListener('play',()=>{epoch++;if(source){source.stop();source.disconnect();source=null;}for(const other of document.querySelectorAll('audio'))if(other!==audio)other.pause();});
for(const button of document.querySelectorAll('[data-path]'))button.onclick=async()=>{
 stop();const own=epoch;context??=new AudioContext();const resumed=context.resume();status.textContent='Decoding…';
 try{await resumed;const response=await fetch(button.dataset.path);if(!response.ok)throw new Error('HTTP '+response.status);const buffer=await context.decodeAudioData(await response.arrayBuffer());if(own!==epoch)return;
 const start=Number(button.dataset.start),end=Number(button.dataset.end);if(end>buffer.duration+1/buffer.sampleRate)throw new Error('Loop exceeds decoded duration');
 source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.loopStart=start;source.loopEnd=Math.min(end,buffer.duration);source.connect(context.destination);source.start(0,start);status.textContent='Looping at '+buffer.sampleRate+' Hz · '+buffer.length+' decoded frames. Stop before switching samples.';
 }catch(error){if(own===epoch)status.textContent=String(error.message);}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();context?.suspend();}});window.addEventListener('pagehide',()=>{stop();context?.close();});
</script></html>`;
}
