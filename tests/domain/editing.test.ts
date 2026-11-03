import { describe, it, expect } from 'vitest';
import { defaultPlan, validatePlan } from '../../shared/geometry';
import { moveEndpoint, moveWall, snapWallPoint } from '../../shared/editing';
describe('connected wall editing', () => {
 it('moves every shared endpoint without mutating the source', () => { const p=defaultPlan(); const n=moveEndpoint(p,'w1','b',{x:9,y:0}); expect(n.walls[1].a).toEqual({x:9,y:0}); expect(p.walls[0].b.x).toBe(8); expect(validatePlan(n)).toEqual(n); });
 it('translates a wall and keeps its neighbors connected', () => { const n=moveWall(defaultPlan(),'w1',1,1); expect(n.walls[3].b).toEqual(n.walls[0].a); expect(n.walls[1].a).toEqual(n.walls[0].b); });
 it('snaps to nearby endpoints before orthogonal alignment', () => { const p=defaultPlan(); expect(snapWallPoint({x:8.05,y:.03},p.walls,{x:2,y:.05})).toEqual({x:8,y:0}); expect(snapWallPoint({x:3.1,y:2.04},[],{x:1,y:2})).toEqual({x:3.1,y:2}); });
});
