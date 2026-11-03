import {test,expect} from 'vitest';
import {defaultPlan} from '../../shared/geometry';
import {measurePlan} from '../../shared/measurements';
test('closed rooms and shared T partitions have exact polygons',()=>{const p=defaultPlan();p.walls.push({...p.walls[0],id:'partition',a:{x:4,y:0},b:{x:4,y:6}});const m=measurePlan(p);expect(m.rooms).toHaveLength(2);expect(m.floorAreaM2).toBe(48);expect(m.rooms.map(r=>r.areaM2)).toEqual([24,24]);expect(m.rooms.every(r=>r.polygon.length===4)).toBe(true)});
test('open geometry never invents area',()=>{const p=defaultPlan();p.walls.pop();const m=measurePlan(p);expect(m.floorAreaM2).toBe(0);expect(m.warnings.length).toBeGreaterThan(0)});
test('overlapping collinear walls are explicitly ambiguous',()=>{const p=defaultPlan();p.walls.push({...p.walls[0],id:'duplicate'});expect(measurePlan(p).floorAreaM2).toBe(0)});
