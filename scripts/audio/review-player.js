// This function is embedded into the isolated offline audition page. It is not
// the game mixer: decoding/UI allocations are acceptable in this authoring tool.
export function reviewPlayer(){
 let context=null,master=null,epoch=0;
 const sources=new Set(),buffers=new Map(),cursors=new Map(),status=document.querySelector('#status'),volume=document.querySelector('#volume');
 function stop(keepAudio){epoch++;for(const source of sources){try{source.stop();}catch{}source.disconnect();}sources.clear();for(const audio of document.querySelectorAll('audio'))if(audio!==keepAudio)audio.pause();}
 function setVolume(){const gain=Number(volume.value);if(master)master.gain.setValueAtTime(gain,context.currentTime);for(const audio of document.querySelectorAll('audio'))audio.volume=gain;}
 volume.oninput=setVolume;setVolume();document.querySelector('#stop').onclick=()=>{stop();status.textContent='Stopped';};
 for(const audio of document.querySelectorAll('audio'))audio.addEventListener('play',()=>stop(audio));
 for(const button of document.querySelectorAll('[data-path], [data-paths]'))button.onclick=async()=>{
  stop();const own=epoch;
  try{
   const Context=window.AudioContext??window.webkitAudioContext;if(!Context)throw new Error('Web Audio is unavailable');
   context??=new Context();const resumed=context.resume(); // Must run inside the original gesture, before awaiting decoding.
   if(!master){master=context.createGain();master.connect(context.destination);setVolume();}
   status.textContent='Preparing audio…';await resumed;
   const paths=button.dataset.paths?JSON.parse(button.dataset.paths):[button.dataset.path];
   const loaded=await Promise.all(paths.map(async path=>{let buffer=buffers.get(path);if(!buffer){const response=await fetch(path);if(!response.ok)throw new Error('HTTP '+response.status);buffer=await context.decodeAudioData(await response.arrayBuffer());buffers.set(path,buffer);}return buffer;}));
   if(own!==epoch)return;
   const loop=button.dataset.start!==undefined,times=button.dataset.times?JSON.parse(button.dataset.times):[0],key=paths.join('|'),offset=cursors.get(key)??0,when=context.currentTime+.025;
   for(let i=0;i<times.length;i++){
    const buffer=loaded[(offset+i)%loaded.length],source=context.createBufferSource();source.buffer=buffer;source.connect(master);sources.add(source);
    source.onended=()=>{source.disconnect();sources.delete(source);if(own===epoch&&!sources.size)status.textContent='Finished · '+button.textContent;};
    if(loop){const start=Number(button.dataset.start),end=Number(button.dataset.end);if(end>buffer.duration+1/buffer.sampleRate)throw new Error('Loop exceeds decoded duration');source.loop=true;source.loopStart=start;source.loopEnd=Math.min(end,buffer.duration);source.start(when,start);}
    else{source.start(when+times[i]);}
   }
   cursors.set(key,(offset+times.length)%loaded.length);
   status.textContent=loop?'Looping at '+loaded[0].sampleRate+' Hz':button.dataset.name+' · '+button.textContent+' · '+times.length+' pulse(s) · '+loaded[0].sampleRate+' Hz';
  }catch(error){if(own===epoch){stop();status.textContent=String(error.message);}}
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();context?.suspend().catch(()=>{});}});
 window.addEventListener('pagehide',()=>{stop();context?.close().catch(()=>{});});
}
