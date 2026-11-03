import { describe, expect, it } from 'vitest';
import { appendDimensionedWall } from '../../shared/fusionWall';
import { defaultPlan, validatePlan, length } from '../../shared/geometry';
const preset = {lengthFeet: 12, heightFeet: 8, thicknessInches: 5.5, color: '#e8e2d8'};
describe('Fusion-inspired contractor wall builder',()=>{
 it('appends exact dimensions to an immutable existing plan',()=>{
  const source=defaultPlan();const initial=source.walls.length;
  const next=appendDimensionedWall(source,preset,'wall-new');
  expect(source.walls).toHaveLength(initial);
  expect(next.walls).toHaveLength(initial+1);
  expect(length(next.walls.at(-1)!)).toBeCloseTo(3.6576,6);
  expect(next.walls.at(-1)!.height).toBeCloseTo(2.4384,6);
  expect(next.walls.at(-1)!.thickness).toBeCloseTo(0.1397,6);
  expect(validatePlan(next)).toEqual(next);
 });
 it('rejects impossible or duplicate dimensions without changing the project',()=>{
  const source=defaultPlan();
  expect(()=>appendDimensionedWall(source,{...preset,lengthFeet:0},'new')).toThrow();
  expect(()=>appendDimensionedWall(source,{...preset,lengthFeet:340},'new')).toThrow();
  expect(()=>appendDimensionedWall(source,preset,'w1')).toThrow();
  expect(source.walls).toHaveLength(4);
 });
});
