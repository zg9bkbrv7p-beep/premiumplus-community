import type { Plan, Wall } from './geometry';
type Point = Wall['a'];
const same = (a:Point,b:Point) => Math.hypot(a.x-b.x,a.y-b.y)<1e-6;
export function moveEndpoint(plan:Plan,id:string,end:'a'|'b',target:Point):Plan {
 const wall=plan.walls.find(w=>w.id===id);
 if(!wall) return plan;
 const source=wall[end], next=structuredClone(plan);
 for(const w of next.walls) for(const key of ['a','b'] as const) if(same(w[key],source)) w[key]={...target};
 return next;
}
export function moveWall(plan:Plan,id:string,dx:number,dy:number):Plan {
 const wall=plan.walls.find(w=>w.id===id);
 if(!wall) return plan;
 const next=structuredClone(plan);
 for(const w of next.walls) for(const key of ['a','b'] as const) if(same(w[key],wall.a)||same(w[key],wall.b)) w[key]={x:w[key].x+dx,y:w[key].y+dy};
 return next;
}
export function snapWallPoint(point:Point,walls:Wall[],start?:Point|null,tolerance=.15):Point {
 let closest:Point|undefined, distance=tolerance;
 for(const w of walls) for(const p of [w.a,w.b]) { const d=Math.hypot(point.x-p.x,point.y-p.y); if(d<distance) {closest=p;distance=d;} }
 if(closest) return {...closest};
 return {x:start&&Math.abs(point.x-start.x)<tolerance?start.x:point.x,y:start&&Math.abs(point.y-start.y)<tolerance?start.y:point.y};
}
