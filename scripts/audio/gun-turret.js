import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAY_CONFIG} from '../../play/config.js';
import {renderRecipe} from './pcm.js';
import {buildAudio} from './build.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const filter=(type,cutoff,q=.707,endCutoff)=>({type,cutoff,q,...(endCutoff===undefined?{}:{endCutoff})});
const noise=(gain,duration,decay,filters,extra={})=>({type:'noise',gain,start:0,duration,attack:.0003,release:Math.min(.035,duration/3),pan:0,decay,filters,...extra});
const tone=(gain,duration,frequency,endFrequency,decay,extra={})=>({type:'sine',gain,start:0,duration,frequency,endFrequency,pitchCurve:'exponential',attack:.0005,release:Math.min(.025,duration/3),pan:0,decay,...extra});
const designs=[
 {id:'dry',name:'A · Dry autocannon',description:'Short, dry crack with a firm body and a small breech clack. Least tail for crowded battles.',duration:.38,layers:[
  noise(.88,.035,.005,[filter('highpass',850),filter('lowpass',13000,.75,6200)]),
  noise(.80,.13,.025,[filter('highpass',120),filter('lowpass',4300,.8,1700)]),
  noise(.40,.12,.029,[filter('bandpass',560,.9,390)]),
  tone(.23,.14,145,68,.028),
  tone(.065,.10,790,755,.018),tone(.045,.075,1397,1370,.011),
  noise(.32,.032,.009,[filter('bandpass',1900,1.3)],{start:.038,attack:.0002}),
  noise(.15,.045,.014,[filter('highpass',700),filter('lowpass',3500)],{start:.115}),
 ]},
 {id:'heavy',name:'B · Heavy punch',description:'Deeper pressure thump, broad muzzle body and a darker mechanical return. The weightiest option.',duration:.52,layers:[
  noise(.70,.04,.006,[filter('highpass',650),filter('lowpass',9500,.75,3600)]),
  noise(.90,.20,.046,[filter('highpass',75),filter('lowpass',2400,.85,700)]),
  noise(.65,.22,.052,[filter('bandpass',280,.85,170)]),
  tone(.38,.20,96,41,.043),tone(.07,.10,327,290,.018),
  noise(.40,.042,.011,[filter('bandpass',950,1.4)],{start:.065}),
  noise(.22,.25,.065,[filter('highpass',160),filter('lowpass',1700,.8,420)],{start:.025,amplitudeMod:{rateHz:37,depth:.25}}),
  noise(.13,.04,.012,[filter('bandpass',1700,.9)],{start:.16}),
 ]},
 {id:'industrial',name:'C · Industrial snap',description:'Sharper upper crack, textured midrange and a quick metallic action. More bite without a long ring.',duration:.36,layers:[
  noise(.90,.028,.0038,[filter('highpass',1600),filter('lowpass',15500,.75,8500)]),
  noise(.85,.105,.023,[filter('highpass',220),filter('lowpass',6200,.8,2800)]),
  noise(.60,.12,.030,[filter('bandpass',1220,.85,680)],{amplitudeMod:{rateHz:73,depth:.16}}),
  tone(.20,.11,184,83,.020),
  tone(.06,.072,1173,1147,.009),tone(.045,.065,1867,1839,.011),tone(.028,.045,3209,3191,.006),
  noise(.38,.024,.006,[filter('bandpass',2400,1.5)],{start:.043,attack:.0002}),
  noise(.15,.035,.010,[filter('highpass',650),filter('lowpass',4800)],{start:.102}),
 ]},
];
export function gunTurretBundle(){
 const recipes=[],groups=[];
 for(const [index,design]of designs.entries()){
  const group={name:design.name+(design.id==='dry'?' · selected':''),description:design.description,recipes:[]};
  for(let take=0;take<3;take++){
   const recipe={id:`gun-${design.id}-${take+1}`,name:`${design.name} · take ${take+1}`,purpose:design.description,sampleRate:48000,channels:1,duration:design.duration,seed:90317+index*5101+take*317,gain:.3,fadeIn:.00015,fadeOut:.06,layers:structuredClone(design.layers)};
   const detune=[1,.987,1.014][take],timeScale=[1,1.018,.984][take];
   for(const layer of recipe.layers){if(layer.type!=='noise'){layer.frequency*=detune;layer.endFrequency*=detune;}for(const f of layer.filters??[]){f.cutoff*=detune;if(f.endCutoff)f.endCutoff*=detune;}if(layer.start>0)layer.start*=timeScale;}
   // Match short-window energy across directions, retaining explicit recipe gain
   // and peak headroom. No runtime normaliser/limiter or per-shot DSP is needed.
   const initial=renderRecipe(recipe);let energy=0;const count=Math.round(.14*48000);for(let i=0;i<count;i++)energy+=initial.samples[i]**2;
   recipe.gain=Number((recipe.gain*Math.min(.052/Math.sqrt(energy/count),.76/initial.analysis.peak)).toFixed(8));
   recipes.push(recipe);group.recipes.push(recipe.id);
  }
  groups.push(group);
 }
 const gun=PLAY_CONFIG.defences['turret-study'].variants;
 const times=profile=>Array.from({length:profile.shotsPerBurst},(_,i)=>Number((i*profile.shotIntervalSeconds).toFixed(6)));
 return {version:1,review:{title:'Gun turret · sound review',description:'Choose a direction by character and repetition. All files are mono; each pulse represents both barrels firing together. Single shots cycle three takes. Burst buttons use the current game timings. Nothing is connected to gameplay yet.',groups,patterns:[{label:'Single shot',times:[0]},{label:'Base cadence',times:[0,gun.base.firing.cooldownSeconds,gun.base.firing.cooldownSeconds*2]},{label:'Upgrade I · 3 shots',times:times(gun.upgrade1.firing)},{label:'Upgrade II · 5 shots',times:times(gun.upgrade2.firing)}]},recipes};
}
if(import.meta.main){
 const directory=join(root,'audio/gun-turret');await mkdir(directory,{recursive:true});const recipeFile=join(directory,'recipes.json');await writeFile(recipeFile,JSON.stringify(gunTurretBundle(),null,2)+'\n');
 const result=await buildAudio(recipeFile);await mkdir(join(directory,'masters'),{recursive:true});
 for(const entry of result.manifest.entries)await copyFile(join(result.output,entry.paths.master),join(directory,'masters',entry.recipe.id+'.wav'));
 const evidence={recipeSha256:result.manifest.recipeSha256,tools:result.manifest.tools,sources:result.manifest.sources,entries:result.manifest.entries.map(({recipe,analysis,decodedAnalysis,files})=>({id:recipe.id,channels:recipe.channels,duration:recipe.duration,analysis,decodedAnalysis,files}))};
 await writeFile(join(directory,'audit.json'),JSON.stringify(evidence,null,2)+'\n');console.log(`Nine mono gun takes in ${result.output}\nAudition: bun run audio:preview`);
}
