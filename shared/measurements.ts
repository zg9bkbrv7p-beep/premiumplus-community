import {length,validatePlan,type Plan} from './geometry';
type Point={x:number;y:number};
export type Measurements={rooms:{id:string;polygon:Point[];areaM2:number;perimeterM:number}[];floorAreaM2:number;perimeterM:number;wallAreaM2:number;baseboardM:number;doorCount:number;windowCount:number;assumptions:string[];warnings:string[]};
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x,sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y}),eps=1e-7;
export function measurePlan(input:Plan):Measurements{
 const m:Measurements={rooms:[],floorAreaM2:0,perimeterM:0,wallAreaM2:0,baseboardM:0,doorCount:0,windowCount:0,assumptions:['Dimensions follow wall centerlines; thickness is excluded.','Paint and drywall use two wall sides with door/window areas deducted on both sides.','Baseboard uses two wall sides with door widths deducted twice; ceilings excluded.'],warnings:[]};
 let p:Plan;try{p=validatePlan(input)}catch{m.warnings.push('Invalid plan: quantities unavailable.');return m}
 m.doorCount=p.openings.filter(o=>o.kind==='door').length;m.windowCount=p.openings.length-m.doorCount;
 m.wallAreaM2=Math.max(0,2*(p.walls.reduce((s,w)=>s+length(w)*w.height,0)-p.openings.reduce((s,o)=>s+o.width*o.height,0)));
 m.baseboardM=Math.max(0,2*(p.walls.reduce((s,w)=>s+length(w),0)-p.openings.filter(o=>o.kind==='door').reduce((s,o)=>s+o.width,0)));
 const splits=p.walls.map(()=>[0,1]);let ambiguous=false;
 p.walls.forEach((a,i)=>p.walls.slice(i+1).forEach((b,k)=>{const j=i+k+1,r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),d=cross(r,s);if(Math.abs(d)<eps){if(Math.abs(cross(q,r))<eps){const rr=r.x*r.x+r.y*r.y,t=(q.x*r.x+q.y*r.y)/rr,u=t+(s.x*r.x+s.y*r.y)/rr;if(Math.min(1,Math.max(t,u))-Math.max(0,Math.min(t,u))>eps)ambiguous=true}return}const t=cross(q,s)/d,u=cross(q,r)/d;if(t>=-eps&&t<=1+eps&&u>=-eps&&u<=1+eps){splits[i].push(Math.max(0,Math.min(1,t)));splits[j].push(Math.max(0,Math.min(1,u)))}}));
 if(ambiguous){m.warnings.push('Overlapping collinear walls are ambiguous; no floor area calculated.');return m}
 const nodes=new Map<string,Point>(),adj=new Map<string,string[]>(),key=(v:Point)=>`${Math.round(v.x/eps)},${Math.round(v.y/eps)}`;
 p.walls.forEach((w,i)=>{const ts=[...new Set(splits[i])].sort((a,b)=>a-b);for(let n=1;n<ts.length;n++){const points=[ts[n-1],ts[n]].map(t=>({x:w.a.x+t*(w.b.x-w.a.x),y:w.a.y+t*(w.b.y-w.a.y)}));const [a,b]=points.map(key);if(a===b)continue;points.forEach(v=>nodes.set(key(v),v));adj.set(a,[...(adj.get(a)||[]),b]);adj.set(b,[...(adj.get(b)||[]),a])}});
 for(const [a,neighbors] of adj){const o=nodes.get(a)!;neighbors.sort((b,c)=>{const v=nodes.get(b)!,w=nodes.get(c)!;return Math.atan2(v.y-o.y,v.x-o.x)-Math.atan2(w.y-o.y,w.x-o.x)})}
 const visited=new Set<string>();let dangling=false;
 for(const [a,ns] of adj){if(ns.length<2)dangling=true;for(const b of ns){if(visited.has(`${a}|${b}`))continue;let u=a,v=b;const polygon:Point[]=[];let closed=false;for(let n=0;n<=p.walls.length*4+10;n++){const edge=`${u}|${v}`;if(visited.has(edge))break;visited.add(edge);polygon.push(nodes.get(u)!);const neighbors=adj.get(v)!;const next=neighbors[(neighbors.indexOf(u)-1+neighbors.length)%neighbors.length];u=v;v=next;if(u===a&&v===b){closed=true;break}}if(!closed)continue;const area=polygon.reduce((s,v,i)=>s+cross(v,polygon[(i+1)%polygon.length]),0)/2;if(area>eps){const unique=new Set(polygon.map(key));if(unique.size!==polygon.length){dangling=true;continue}const perimeter=polygon.reduce((s,v,i)=>{const w=polygon[(i+1)%polygon.length];return s+Math.hypot(v.x-w.x,v.y-w.y)},0);m.rooms.push({id:`room-${m.rooms.length+1}`,polygon,areaM2:area,perimeterM:perimeter})}}}
 // Nested disconnected loops represent holes or overlapping room claims: decline ambiguous area.
 const inside=(v:Point,poly:Point[])=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>v.y)!==(b.y>v.y)&&v.x<(b.x-a.x)*(v.y-a.y)/(b.y-a.y)+a.x)yes=!yes}return yes};
 if(m.rooms.some((a,i)=>m.rooms.some((b,j)=>i!==j&&a.polygon.every(v=>inside(v,b.polygon))))){m.rooms=[];m.warnings.push('Nested disconnected boundaries require manual room review; floor area withheld.')}
 m.floorAreaM2=m.rooms.reduce((s,r)=>s+r.areaM2,0);m.perimeterM=m.rooms.reduce((s,r)=>s+r.perimeterM,0);
 if(dangling)m.warnings.push('Open wall ends detected; only simple closed room faces are counted.');if(!m.rooms.length)m.warnings.push('No unambiguous closed room found; floor area is zero.');return m;
}
export const SQFT_PER_M2=10.763910416709722,FT_PER_M=3.280839895013123;
