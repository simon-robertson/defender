import {groupRosterUnits} from './roster-order.js';
export {groupRosterUnits} from './roster-order.js';

/** Keep the same groups, rows and controls alive across ordinary UI updates. */
export class RosterGroups {
 constructor(list){this.list=list;this.groups=new Map();}
 sync(units,rows){
  const live=new Set();let groupIndex=0;
  for(const group of groupRosterUnits(units)){
   live.add(group.model);let entry=this.groups.get(group.model);
   if(!entry){
    const document=this.list.ownerDocument,section=document.createElement('section'),heading=document.createElement('h3'),count=document.createElement('span'),label=document.createElement('span'),list=document.createElement('div');
    section.className='unit-group';section.dataset.model=group.model;heading.className='unit-group-heading';label.textContent=group.label;count.className='unit-group-count';heading.append(label,count);list.className='unit-group-list';section.append(heading,list);section.setAttribute('aria-label',group.label+' defences');
    entry={section,list,count};this.groups.set(group.model,entry);
   }
   const expected=this.list.children[groupIndex++];if(expected!==entry.section)this.list.insertBefore(entry.section,expected??null);
   const total=String(group.units.length).padStart(2,'0');if(entry.count.textContent!==total)entry.count.textContent=total;
   for(let index=0;index<group.units.length;index++){
    const row=rows.get(group.units[index].id).row,expected=entry.list.children[index];if(row!==expected)entry.list.insertBefore(row,expected??null);
   }
  }
  for(const[model,entry]of this.groups)if(!live.has(model)){entry.section.remove();this.groups.delete(model);}
 }
}
