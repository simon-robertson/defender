import {test,expect} from 'bun:test';
import {groupRosterUnits,RosterGroups} from '../play/roster.js';
import {nextUnplaced} from '../play/session.js';

class Element {
 constructor(document){this.ownerDocument=document;this.children=[];this.parentNode=null;this.dataset={};this.attributes={};this.textContent='';this.moves=0;}
 append(...children){for(const child of children)this.insertBefore(child,null);}
 insertBefore(child,before){child.remove();child.parentNode=this;this.children.splice(before?this.children.indexOf(before):this.children.length,0,child);this.moves++;}
 remove(){if(this.parentNode){this.parentNode.children.splice(this.parentNode.children.indexOf(this),1);this.parentNode=null;}}
 setAttribute(key,value){this.attributes[key]=String(value);}
}
const units=[{id:'g1',model:'turret-study',variant:'upgrade1',label:'Gun 01'},{id:'m1',model:'missile-launcher',variant:'base',label:'Missile launcher 02'},{id:'a1',model:'arc-spire',variant:'upgrade2',label:'Arc Spire 03'},{id:'g2',model:'turret-study',variant:'base',label:'Gun 04'},{id:'m2',model:'missile-launcher',variant:'upgrade2',label:'Missile launcher 05'}];

test('roster groups all upgrade tiers by defence family while retaining ownership order and identity',()=>{
 const before=JSON.stringify(units),groups=groupRosterUnits(units);
 expect(groups.map(group=>group.model)).toEqual(['turret-study','arc-spire','missile-launcher']);expect(groups.map(group=>group.units.map(unit=>unit.id))).toEqual([['g1','g2'],['a1'],['m1','m2']]);
 expect(groups[0].units[0]).toBe(units[0]);expect(groups[0].units[1].label).toBe('Gun 04');expect(JSON.stringify(units)).toBe(before);expect(groupRosterUnits([])).toEqual([]);expect(groupRosterUnits([{id:'legacy',variant:'base'}])[0].model).toBe('turret-study');
});

test('group updates preserve row controls/focus and avoid moving unchanged DOM; empty families are removed',()=>{
 const document={createElement(){return new Element(this);},activeElement:null},list=new Element(document),roster=new RosterGroups(list),rows=new Map(units.map(unit=>{const row=new Element(document),select=new Element(document),upgrade=new Element(document);row.dataset.unit=select.dataset.unit=upgrade.dataset.unit=unit.id;select.dataset.action='select';upgrade.dataset.action='upgrade';row.append(select,upgrade);return [unit.id,{row,select,upgrade}];}));
 roster.sync(units,rows);const gun=roster.groups.get('turret-study'),arc=roster.groups.get('arc-spire'),silo=roster.groups.get('missile-launcher');document.activeElement=rows.get('g2').upgrade;
 expect(list.children.map(section=>section.dataset.model)).toEqual(['turret-study','arc-spire','missile-launcher']);expect(gun.list.children.map(row=>row.dataset.unit)).toEqual(['g1','g2']);expect(silo.count.textContent).toBe('02');
 const moves=[list.moves,gun.list.moves,arc.list.moves,silo.list.moves];roster.sync(units.map(unit=>({...unit,variant:'upgrade2'})),rows);expect([list.moves,gun.list.moves,arc.list.moves,silo.list.moves]).toEqual(moves);expect(document.activeElement).toBe(rows.get('g2').upgrade);expect(document.activeElement.dataset.unit).toBe('g2');expect(document.activeElement.dataset.action).toBe('upgrade');
 const survivor=units.filter(unit=>unit.model==='turret-study');for(const unit of units.filter(unit=>unit.model!=='turret-study'))rows.get(unit.id).row.remove();roster.sync(survivor,rows);expect(list.children).toEqual([gun.section]);expect(roster.groups.has('arc-spire')).toBe(false);expect(rows.get('g2').row.parentNode).toBe(gun.list);
 roster.sync([],rows);expect(list.children).toHaveLength(0);expect(roster.groups.size).toBe(0);
});

test('deployment advances through the visible grouped rows instead of interleaved purchase order',()=>{
 const owned=structuredClone([...units,{id:'e1',model:'power-generator',variant:'base'},{id:'g3',model:'turret-study',variant:'base'}]),before=owned.map(unit=>unit.id);
 const document={createElement(){return new Element(this);}},list=new Element(document),roster=new RosterGroups(list),rows=new Map(owned.map(unit=>[unit.id,{row:new Element(document)}]));
 for(const unit of owned)rows.get(unit.id).row.dataset.unit=unit.id;
 roster.sync(owned,rows);
 const visible=list.children.flatMap(section=>section.children[1].children.map(row=>row.dataset.unit));
 expect(visible).toEqual(['g1','g2','g3','a1','m1','m2','e1']);
 let selected=nextUnplaced(owned),deployed=[];
 while(selected){deployed.push(selected);owned.find(unit=>unit.id===selected).box=[deployed.length,0,1];selected=nextUnplaced(owned,selected);}
 expect(deployed).toEqual(visible);expect(owned.map(unit=>unit.id)).toEqual(before);
 // Moving a unit in the middle skips already placed rows, then wraps to an
 // earlier recalled unit in the same order the player sees on screen.
 owned.find(unit=>unit.id==='g2').box=null;owned.find(unit=>unit.id==='m2').box=null;
 expect(nextUnplaced(owned,'a1')).toBe('m2');owned.find(unit=>unit.id==='m2').box=[8,0,1];expect(nextUnplaced(owned,'m2')).toBe('g2');
 expect(nextUnplaced(owned,'unknown')).toBe('g2');
});
