import {test,expect} from 'bun:test';
import {GeneratorLights} from '../engine/generator-lights.js';
import {PLAY_CONFIG} from '../play/config.js';
import {MAX_GENERATOR_LIGHTS,GENERATOR_LIGHT_BYTES,GENERATOR_LIGHT_COLOR,GENERATOR_LIGHT_RADIUS,GENERATOR_LIGHT_STRENGTH} from '../shared/generator-lights.js';
const link=()=>({source:[77,34.5,155.5],target:[65,35.5,155.5]});
test('generator lights copy static midpoints and preserve the former green colour, strength and radius',()=>{
 const lights=new GeneratorLights(),input=link();lights.setLinks([input]);input.source.fill(-99);input.target.fill(99);
 expect(lights.lightCount).toBe(1);expect([...lights.lightData.slice(4,8)]).toEqual([71,35,155.5,GENERATOR_LIGHT_RADIUS]);for(let i=0;i<3;i++)expect(lights.lightData[8+i]).toBeCloseTo(GENERATOR_LIGHT_COLOR[i],7);expect(lights.lightData[11]).toBeCloseTo(GENERATOR_LIGHT_STRENGTH,6);expect(lights.byteLength).toBe(GENERATOR_LIGHT_BYTES);expect(lights.instanceData).toBeUndefined();expect(lights.advance).toBeUndefined();
});
test('fixed generator storage covers the conservative campaign economy and reports overflow',()=>{
 const waves=PLAY_CONFIG.levels.reduce((sum,level)=>sum+level.waves.length,0),budget=PLAY_CONFIG.startTokens+(waves-1)*PLAY_CONFIG.waveReward;
 expect(MAX_GENERATOR_LIGHTS).toBeGreaterThanOrEqual(Math.floor(budget/PLAY_CONFIG.defences['power-generator'].purchaseCost)*4);
 const lights=new GeneratorLights(),data=lights.lightData,warn=console.warn,records=[];console.warn=value=>records.push(value);try{lights.setLinks(Array.from({length:MAX_GENERATOR_LIGHTS+3},link));}finally{console.warn=warn;}
 expect(lights.lightCount).toBe(MAX_GENERATOR_LIGHTS);expect(lights.overflow).toBe(3);expect(records).toHaveLength(1);const revision=lights.revision;lights.setLinks([link()]);expect(lights.lightData).toBe(data);expect(lights.revision).toBeGreaterThan(revision);expect(lights.overflow).toBe(0);lights.dispose();expect(lights.lightData.every(v=>v===0)).toBe(true);expect(lights.linkCount).toBe(0);
});
test('invalid topology is rejected before changing an existing light bank',()=>{
 const lights=new GeneratorLights();lights.setLinks([link()]);const data=lights.lightData.slice(),revision=lights.revision;
 for(const input of [null,{},[{}],[{source:[0,1],target:[1,2,3]}],[{source:[0,0,0],target:[NaN,2,3]}]])expect(()=>lights.setLinks(input)).toThrow();expect(lights.lightData).toEqual(data);expect(lights.revision).toBe(revision);
});
