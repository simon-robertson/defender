import {loadWorld} from '/engine/world.js';
import {validId} from '/shared/model.js';

// Combat review pages explicitly own historical sources. They never change
// the current game catalogue or reinterpret a landscape as a combat level.
export async function loadArchivedPreviewWorld(id,options={}){
 if(!validId(id))throw new Error('Invalid archived preview ID.');
 const response=await fetch(`/docs/level-rebuild-2026-10-18/previous-levels/${id}.json`,{signal:options.signal,cache:'no-store'});
 if(!response.ok)throw new Error('Unable to load archived preview '+id+'.');
 return loadWorld(id,{...options,sourceLevel:await response.json()});
}
