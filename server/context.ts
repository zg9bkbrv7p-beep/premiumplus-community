import type {DatabaseSync} from 'node:sqlite';
import type {Request,Response} from 'express';
export interface AppContext {
 db:DatabaseSync;
 one:(sql:string,...args:any[])=>any;
 all:(sql:string,...args:any[])=>any[];
 run:(sql:string,...args:any[])=>any;
 transaction:<T>(fn:()=>T)=>T;
 event:(projectId:string,label:string)=>unknown;
 owner:(req:Request,write?:boolean)=>any;
 project:(req:Request,write?:boolean)=>{p:any,u:any};
 client:(req:Request,write?:boolean)=>{s:any,share:any,p:any,prop:any};
 limited:(key:string,max:number)=>void;
 fail:(status:number,message:string)=>never;
 session:(req:Request)=>any;
 csrf:(req:Request,s:any)=>void;
 setSession:(res:Response,userId:string|null,shareId:string|null)=>string;
 projectDto:(p:any)=>any;
 proposalDto:(p:any)=>any;
 agreementDto:(p:any)=>any;
 origin:string;
}
