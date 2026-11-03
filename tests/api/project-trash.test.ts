import {test,expect} from 'vitest';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createApp} from '../../server/app';

test('unsigned draft goes to recoverable Trash, preserves events, revokes access and restores',async()=>{
 const app=createApp(':memory:');try{
  const owner=request.agent(app.http);
  const auth=await owner.post('/api/auth/register').set('Origin','http://localhost').send({name:'Project QA',company:'GQ QA',email:'trash-qa@example.test',password:'fictional-passphrase-for-testing'});
  const h={Origin:'http://localhost','X-CSRF-Token':auth.body.csrf};
  const post=(url:string,body:any={})=>owner.post(url).set(h).send(body);
  const p=(await post('/api/projects',{name:'Fence QA',address:'Test Only'})).body;
  expect((await owner.get('/api/projects')).body).toHaveLength(1);
  expect((await post(`/api/projects/${p.id}/trash`,{confirmName:'Not fence'})).status).toBe(422);
  expect((await post(`/api/projects/${p.id}/trash`,{confirmName:'Fence QA'})).body).toEqual({ok:true,inTrash:true,permanent:false});
  expect((await owner.get('/api/projects?includeArchived=1')).body).toHaveLength(0);
  expect((await owner.get(`/api/projects/${p.id}`)).status).toBe(404);
  const trash=(await owner.get('/api/projects/trash')).body;
  expect(trash).toHaveLength(1);expect(trash[0].deletedAt).toBeTruthy();
  expect((await owner.patch(`/api/projects/${p.id}/archive`).set(h).send({archived:true,expectedArchived:false})).status).toBe(409);
  expect((await post(`/api/projects/${p.id}/restore-trash`)).status).toBe(200);
  expect((await owner.get('/api/projects')).body[0].id).toBe(p.id);
  const count=app.db.prepare('SELECT COUNT(*) n FROM events WHERE project_id=?').get(p.id) as {n:number};expect(count.n).toBe(3);
 }finally{app.db.close()}
});

test('a signed agreement blocks Trash and another company cannot trash the project',async()=>{
 const app=createApp(':memory:');try{
  const owner=request.agent(app.http);
  const a=await owner.post('/api/auth/register').set('Origin','http://localhost').send({name:'Owner',company:'GQ',email:'signed-owner@example.test',password:'fictional-passphrase-for-testing'});
  const h={Origin:'http://localhost','X-CSRF-Token':a.body.csrf};
  const p=(await owner.post('/api/projects').set(h).send({name:'Signed Fence'})).body;
  const proposalId=randomUUID();
  app.db.prepare('INSERT INTO proposals(id,project_id,revision,status,data,created_at) VALUES(?,?,?,?,?,?)').run(proposalId,p.id,1,'accepted','{}',new Date().toISOString());
  app.db.prepare('INSERT INTO agreements(id,proposal_id,name,accepted_at,snapshot,sha256,total) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),proposalId,'Homeowner',new Date().toISOString(),'{}','a'.repeat(64),1234);
  expect((await owner.post(`/api/projects/${p.id}/trash`).set(h).send({confirmName:'Signed Fence'})).status).toBe(409);
  const other=request.agent(app.http);
  const b=await other.post('/api/auth/register').set('Origin','http://localhost').send({name:'Other',company:'Other',email:'other-trash@example.test',password:'fictional-passphrase-for-testing'});
  const r=await other.post(`/api/projects/${p.id}/trash`).set('Origin','http://localhost').set('X-CSRF-Token',b.body.csrf).send({confirmName:'Signed Fence'});
  expect(r.status).toBe(404);
 }finally{app.db.close()}
});
