import {test,expect} from 'vitest';
import request from 'supertest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../../server/app';
import {createBackup,restoreBackup} from '../../server/backup';
import {measurePlan} from '../../shared/measurements';
test('independent saved geometries and design versions survive database backup and restoration',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'commercial-restore-'));let app=createApp(join(dir,'live.sqlite'));let restored:ReturnType<typeof createApp>|undefined;
 try{
 const agent=request.agent(app.http);const auth=await agent.post('/api/auth/register').set('Origin','http://localhost').send({name:'Independent contractor',company:'Test studio',email:'independent@example.test',password:'fictional-password-2026'});expect(auth.status).toBe(201);const csrf=auth.body.csrf;
 const post=(path:string,body:any)=>agent.post(path).set('Origin','http://localhost').set('X-CSRF-Token',csrf).send(body);
 const a=(await post('/api/projects',{name:'House A'})).body,b=(await post('/api/projects',{name:'House B'})).body;
 const plan={...a.plan,walls:a.plan.walls.map((w:any)=>({...w,a:{x:w.a.x*2,y:w.a.y},b:{x:w.b.x*2,y:w.b.y}}))};
 const saved=await agent.patch('/api/projects/'+a.id).set('Origin','http://localhost').set('X-CSRF-Token',csrf).send({revision:a.revision,plan});expect(saved.status).toBe(200);
 expect((await agent.get('/api/projects/'+b.id)).body.plan).toEqual(b.plan);expect(saved.body.plan).not.toEqual(b.plan);
 const floorA=measurePlan(saved.body.plan).floorAreaM2,floorB=measurePlan(b.plan).floorAreaM2;expect(floorA).toBeCloseTo(floorB*2);
 await post('/api/projects/'+a.id+'/design-versions',{label:'Independent plan A'});
 const backup=join(dir,'backup.sqlite');await createBackup(app.db,backup);const dest=join(dir,'restored.sqlite');restoreBackup(backup,dest);restored=createApp(dest);const session=request.agent(restored.http);expect((await session.get('/api/projects')).status).toBe(401);expect((await session.post('/api/auth/login').set('Origin','http://localhost').send({email:'independent@example.test',password:'fictional-password-2026'})).status).toBe(200);
 expect((await session.get('/api/projects/'+a.id)).body.plan).toEqual(saved.body.plan);expect((await session.get('/api/projects/'+b.id)).body.plan).toEqual(b.plan);expect((await session.get('/api/projects/'+a.id+'/design-versions')).body).toHaveLength(1);
 }finally{app.db.close();restored?.db.close();rmSync(dir,{recursive:true,force:true})}
});
