// The exact production player DOM/app in an independent review session.
// No player state, assets or active /play/ tab are modified.
const source=new DOMParser().parseFromString(await(await fetch('/play/')).text(),'text/html');
document.head.replaceChildren(...source.head.childNodes);document.body.replaceChildren(...source.body.childNodes);
for(const script of document.body.querySelectorAll('script'))script.remove();
const app=document.createElement('script');app.type='module';app.src='/play/app.js';document.body.append(app);

const tests=document.createElement('aside');tests.id='review-controls';tests.style.cssText='position:fixed;right:12px;bottom:32px;z-index:100;background:#22372e;color:#fff;padding:8px;font:12px monospace';
const button=document.createElement('button');button.textContent='Check paused WASD movement';tests.append(button);const hide=document.createElement('button');hide.textContent='Hide review controls';hide.onclick=()=>tests.hidden=true;tests.append(hide);const result=document.createElement('pre');result.id='review-check';tests.append(result);document.body.append(tests);
button.onclick=async()=>{
 const canvas=document.getElementById('world'),before=JSON.parse(canvas.dataset.play??'{}');
 if(!before.screenshotMode){result.textContent='Enter paused screenshot mode first';return;}
 button.disabled=true;
 try{
  const positions=[];
  for(const key of ['w','s','a','d']){
   const start=JSON.parse(canvas.dataset.play);canvas.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
   await new Promise(resolve=>setTimeout(resolve,300));canvas.dispatchEvent(new KeyboardEvent('keyup',{key,bubbles:true}));
   const end=JSON.parse(canvas.dataset.play),distance=Math.hypot(...end.camera.position.map((value,i)=>value-start.camera.position[i]));
   if(distance<5||end.engine.time!==before.engine.time||end.droneCameraTime!==before.droneCameraTime)throw new Error('Movement/freeze mismatch for '+key);
   positions.push({key,distance,time:end.engine.time});
  }
  result.textContent=JSON.stringify({passed:true,positions});
 }catch(error){result.textContent=JSON.stringify({passed:false,error:String(error)});}finally{button.disabled=false;canvas.focus();}
};
