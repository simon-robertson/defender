import {DEFENCE_LABELS} from './config.js';

// The visible family order also defines deployment selection. Keep ownership
// arrays and unit identities intact; only the traversal is grouped.
export function groupRosterUnits(units){
 const groups=new Map(Object.keys(DEFENCE_LABELS).map(model=>[model,[]]));
 for(const unit of units){const model=unit.model??'turret-study';if(!groups.has(model))groups.set(model,[]);groups.get(model).push(unit);}
 return [...groups].filter(([,items])=>items.length).map(([model,items])=>({model,label:DEFENCE_LABELS[model]??model,units:items}));
}
