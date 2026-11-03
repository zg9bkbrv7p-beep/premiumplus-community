/** Contractor-only project assistance. This module never sends customer data to another provider. */
import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppContext } from './context';
import { proposalReadiness } from '../shared/proposalReadiness';
import { calculateTotal, type ProposalData } from '../shared/proposal';

const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
 const parsed=new Date(s+'T00:00:00.000Z');return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===s;
},'Enter a real calendar date');
const taskSchema=z.object({
 kind:z.enum(['follow_up','warranty_check','project_task']),
 title:z.string().trim().min(3).max(160),
 dueDate:isoDate,
 notes:z.string().trim().max(1000).default(''),
}).strict();

export function mountOperations(app:Express,c:AppContext){
 const assertNotArchived=(pid:string)=>{if(c.one("SELECT 1 FROM project_archives WHERE project_id=? AND archived_at IS NOT NULL",pid))c.fail(409,"Restore this archived project before changing contractor tasks");};
 c.db.exec(`CREATE TABLE IF NOT EXISTS contractor_tasks (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(id),
 kind TEXT NOT NULL CHECK(kind IN ('follow_up','warranty_check','project_task')),
 title TEXT NOT NULL,
 due_date TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','done')),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at TEXT NOT NULL,
 completed_at TEXT
 );
 CREATE INDEX IF NOT EXISTS idx_contractor_tasks_project ON contractor_tasks(project_id,due_date);`);

 app.get('/api/projects/:id/operations',(req,res)=>{
   const {p}=c.project(req);
   const prop=c.one('SELECT * FROM proposals WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',p.id);
   const agreement=c.one('SELECT a.* FROM agreements a JOIN proposals pr ON pr.id=a.proposal_id WHERE pr.project_id=? ORDER BY a.accepted_at DESC LIMIT 1',p.id);
   let proposal:ProposalData|undefined;
   try{proposal=prop?JSON.parse(prop.data) as ProposalData:undefined;}catch{ /* report as incomplete, never guess */ }
   const missing=proposalReadiness(proposal,p.address);
   let totalCents:number|null=null;
   try{if(proposal)totalCents=calculateTotal(proposal.items,proposal.options,[]);}catch{ /* incomplete */ }
   const tasks=c.all('SELECT id,kind,title,due_date AS dueDate,notes,status,created_at AS createdAt,completed_at AS completedAt FROM contractor_tasks WHERE project_id=? ORDER BY CASE status WHEN \'open\' THEN 0 ELSE 1 END,due_date,id LIMIT 150',p.id);
   const warrantyFiles=c.all("SELECT id,name,warranty_until AS warrantyUntil,category,visibility FROM project_files WHERE project_id=? AND warranty_until IS NOT NULL ORDER BY warranty_until LIMIT 80",p.id);
   const pending=c.all("SELECT id,title,due_date AS dueDate,kind FROM live_decisions WHERE project_id=? AND status='pending' ORDER BY due_date LIMIT 20",p.id);
   const latestUpdates=c.all('SELECT title,body,progress,created_at AS createdAt FROM project_updates WHERE project_id=? ORDER BY created_at DESC LIMIT 10',p.id);
   const events=c.all('SELECT label,created_at AS createdAt FROM events WHERE project_id=? ORDER BY created_at DESC LIMIT 15',p.id);
   res.json({project:{id:p.id,name:p.name,address:p.address,description:p.description},proposal:{status:prop?.status||'not_started',missing,customerName:proposal?.customerName||'',customerContact:proposal?.customerContact||'',scope:agreement?JSON.parse(agreement.snapshot).proposal?.scope||'':proposal?.scope||'',scopeApproved:!!agreement,totalCents:agreement?.total??totalCents,items:agreement?JSON.parse(agreement.snapshot).proposal?.items||[]:proposal?.items||[]},signed:!!agreement,tasks,warrantyFiles,pending,latestUpdates,events,generatedAt:new Date().toISOString()});
 });
 app.post('/api/projects/:id/operations/tasks',(req,res)=>{
   const {p,u}=c.project(req,true);
   assertNotArchived(p.id);
   const b=taskSchema.parse(req.body),taskId=randomUUID(),created=new Date().toISOString();
   c.transaction(()=>{
    c.run('INSERT INTO contractor_tasks(id,project_id,kind,title,due_date,notes,status,created_by,created_at) VALUES(?,?,?,?,?,?,\'open\',?,?)',taskId,p.id,b.kind,b.title,b.dueDate,b.notes,u.id,created);
    c.event(p.id,'Contractor task added: '+b.title);
   });
   res.status(201).json({id:taskId,status:'open',createdAt:created});
 });
 app.post('/api/projects/:id/operations/tasks/:taskId/complete',(req,res)=>{
   const {p}=c.project(req,true);
   assertNotArchived(p.id);
   const task=c.one('SELECT id,status,title FROM contractor_tasks WHERE project_id=? AND id=?',p.id,req.params.taskId);
   if(!task)c.fail(404,'Task not found');
   if(task.status==='done')c.fail(409,'Task is already complete');
   c.transaction(()=>{c.run("UPDATE contractor_tasks SET status='done',completed_at=? WHERE id=? AND status='open'",new Date().toISOString(),task.id);c.event(p.id,'Contractor task completed: '+task.title)});
   res.json({id:task.id,status:'done'});
 });
}
