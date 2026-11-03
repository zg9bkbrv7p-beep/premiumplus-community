import {test,expect} from 'vitest';
import request from 'supertest';
import {createApp} from '../../server/app';

test('contractor toolkit is private, stores project-scoped reminders, and prevents cross-company access',async()=>{
 const app=createApp(':memory:');try{
  const owner=request.agent(app.http);
  const a=await owner.post('/api/auth/register').set('Origin','http://localhost').send({name:'Ops QA',company:'GQ QA',email:'ops-qa@example.test',password:'fictional-long-password-for-testing'});
  const auth={Origin:'http://localhost','X-CSRF-Token':a.body.csrf};
  const p=(await owner.post('/api/projects').set(auth).send({name:'Fence operations QA',address:'100 Test St'})).body;
  const base=`/api/projects/${p.id}/operations`;
  expect((await request(app.http).get(base)).status).toBe(401);
  const before=await owner.get(base);
  expect(before.status).toBe(200);
  expect(before.body.proposal.missing.length).toBeGreaterThan(0);
  expect(before.body.signed).toBe(false);
  expect(before.body.tasks).toEqual([]);
  expect((await owner.post(base+'/tasks').set(auth).send({kind:'follow_up',title:'Call homeowner',dueDate:'2026-02-31'})).status).toBe(422);
  const saved=await owner.post(base+'/tasks').set(auth).send({kind:'warranty_check',title:'Six-month fence checkup',dueDate:'2027-05-02',notes:'Check rails and posts'});
  expect(saved.status).toBe(201);
  expect((await owner.get(base)).body.tasks).toMatchObject([{id:saved.body.id,status:'open',title:'Six-month fence checkup'}]);
  const other=request.agent(app.http);
  const b=await other.post('/api/auth/register').set('Origin','http://localhost').send({name:'Other',company:'Other LLC',email:'ops-other@example.test',password:'fictional-long-password-for-testing'});
  const bad={Origin:'http://localhost','X-CSRF-Token':b.body.csrf};
  expect((await other.get(base)).status).toBe(404);
  expect((await other.post(base+'/tasks').set(bad).send({kind:'follow_up',title:'Cross-company',dueDate:'2027-05-02'})).status).toBe(404);
  expect((await other.post(base+'/tasks/'+saved.body.id+'/complete').set(bad).send({})).status).toBe(404);
  const done=await owner.post(base+'/tasks/'+saved.body.id+'/complete').set(auth).send({});
  expect(done.status).toBe(200);
  expect(done.body.status).toBe('done');
  expect((await owner.post(base+'/tasks/'+saved.body.id+'/complete').set(auth).send({})).status).toBe(409);
  expect((await owner.get(base)).body.tasks[0].status).toBe('done');
 }finally{app.db.close()}
});

test('deleted draft projects do not leak operations or reminders',async()=>{
 const app=createApp(':memory:');try{
  const owner=request.agent(app.http);
  const a=await owner.post('/api/auth/register').set('Origin','http://localhost').send({name:'Ops QA',company:'GQ QA',email:'ops-draft@example.test',password:'fictional-long-password-for-testing'});
  const h={Origin:'http://localhost','X-CSRF-Token':a.body.csrf};
  const p=(await owner.post('/api/projects').set(h).send({name:'Draft fence'})).body;
  expect((await owner.post(`/api/projects/${p.id}/trash`).set(h).send({confirmName:'Draft fence'})).status).toBe(200);
  expect((await owner.get(`/api/projects/${p.id}/operations`)).status).toBe(404);
 }finally{app.db.close()}
});
