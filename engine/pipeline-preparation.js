// Loading-time only: asynchronous creation returns promises until every pipeline
// is ready. The application awaits this before it starts the combat frame loop.
export async function settlePipelineFields(owner,fields){
 const pipelines=await Promise.all(fields.map(field=>owner[field]));
 if(owner.disposed)return;
 for(let i=0;i<fields.length;i++)owner[fields[i]]=pipelines[i];
}
