import {MAX_GENERATOR_LIGHTS,GENERATOR_LIGHT_FLOATS,GENERATOR_LIGHT_RADIUS,GENERATOR_LIGHT_STRENGTH,GENERATOR_LIGHT_COLOR} from '../shared/generator-lights.js';

// Static midpoint lights change only when enhancer topology changes. Own no
// world/rig references, animation clock, beam geometry or per-frame work.
export class GeneratorLights {
 constructor(){this.revision=0;this.requestedCount=this.overflow=this.linkCount=this.lightCount=0;this.lightData=new Float32Array(4+MAX_GENERATOR_LIGHTS*GENERATOR_LIGHT_FLOATS);this.byteLength=this.lightData.byteLength;}
 setLinks(links){
  if(!Array.isArray(links))throw new Error('Generator connections must be an array.');
  const count=Math.min(links.length,MAX_GENERATOR_LIGHTS);
  for(let i=0;i<count;i++){
   const {source,target}=links[i]??{};
   if(source?.length!==3||target?.length!==3)throw new Error('Generator endpoints require three coordinates.');
   for(let axis=0;axis<3;axis++)if(!Number.isFinite(source[axis])||!Number.isFinite(target[axis]))throw new Error('Generator endpoints must be finite.');
  }
  const data=this.lightData;data.fill(0);data[0]=count;this.requestedCount=links.length;this.linkCount=this.lightCount=count;this.overflow=links.length-count;
  for(let i=0;i<count;i++){
   const {source,target}=links[i],k=4+i*GENERATOR_LIGHT_FLOATS;
   for(let axis=0;axis<3;axis++)data[k+axis]=source[axis]*.5+target[axis]*.5;
   data[k+3]=GENERATOR_LIGHT_RADIUS;data[k+4]=GENERATOR_LIGHT_COLOR[0];data[k+5]=GENERATOR_LIGHT_COLOR[1];data[k+6]=GENERATOR_LIGHT_COLOR[2];data[k+7]=GENERATOR_LIGHT_STRENGTH;
  }
  this.revision++;
 }
 dispose(){this.requestedCount=this.overflow=this.linkCount=this.lightCount=0;this.lightData.fill(0);this.revision++;}
}
