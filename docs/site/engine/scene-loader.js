// Latest request wins. Release the active scene before any replacement fetch;
// shared renderer resources belong to the application, not to loaded scenes.
export class SceneLoader {
 constructor({load,release,activate,discard,onLoading=()=>{},onReady=()=>{},onError=()=>{}}){
  Object.assign(this,{load,release,activate,discard,onLoading,onReady,onError});
  this.world=null;this.currentId=null;this.requestedId=null;this.loading=false;this.revision=0;this.loads=0;this.unloads=0;this.disposed=false;this.barrier=Promise.resolve();
 }
 async switchTo(id,{force=false}={}){
  if(this.disposed)return false;
  if(!force&&this.requestedId===id&&(this.loading||this.currentId===id))return false;
  const revision=++this.revision;this.controller?.abort();const controller=this.controller=new AbortController();
  this.requestedId=id;this.loading=true;this.onLoading(id);
  const previous=this.world;this.world=null;this.currentId=null;
  let candidate=null;
  try{
   if(previous){this.unloads++;this.barrier=Promise.resolve(this.release(previous));}
   await this.barrier;
   if(this.disposed||revision!==this.revision)return false;
   candidate=await this.load(id,{signal:controller.signal});
   if(this.disposed||revision!==this.revision){this.discard(candidate);return false;}
   this.activate(candidate);this.world=candidate;this.currentId=id;this.loads++;this.loading=false;this.controller=null;this.onReady(id);return true;
  }catch(error){
   controller.abort();
   if(candidate){if(revision===this.revision)this.barrier=Promise.resolve(this.release(candidate));else this.discard(candidate);}
   if(!this.disposed&&revision===this.revision){this.loading=false;this.world=null;this.currentId=null;this.requestedId=null;this.controller=null;this.onError(error,id);}
   return false;
  }
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;this.revision++;this.controller?.abort();this.controller=null;this.loading=false;
  if(this.world){this.unloads++;this.barrier=Promise.resolve(this.release(this.world));}
  this.world=null;this.currentId=null;this.requestedId=null;
 }
}
