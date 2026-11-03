import {test,expect} from 'vitest';
import {calculateEstimate,defaultEstimateInput} from '../../shared/estimate';
import {measurePlan} from '../../shared/measurements';
import {defaultPlan} from '../../shared/geometry';
test('decimal quantities, waste, markup and taxable subtotal use integer cents',()=>{const input=defaultEstimateInput(measurePlan(defaultPlan()));input.lines=[{id:'flooring',label:'Flooring',unit:'sqft',quantity:2.5,materialCents:100,laborCents:200,wasteBps:1000,taxable:true,provenance:'manual',evidence:''}];input.markupBps=2000;input.taxBps=1000;const e=calculateEstimate(input);expect(e.costCents).toBe(775);expect(e.subtotalCents).toBe(930);expect(e.taxCents).toBe(93);expect(e.totalCents).toBe(1023);expect(e.profitCents).toBe(155)});
test('verified rates require evidence and defaults invent no prices',()=>{const i=defaultEstimateInput(measurePlan(defaultPlan()));expect(calculateEstimate(i).totalCents).toBe(0);i.lines[0].provenance='verified-supplier';expect(()=>calculateEstimate(i)).toThrow()});
