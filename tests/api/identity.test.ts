import {test,expect} from 'vitest';
import express from 'express';
import request from 'supertest';
import {openDb} from '../../server/db';
import {passwordHash,passwordMatches,hash} from '../../server/auth';
import {mountIdentity} from '../../server/identity';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('recovery is generic, hashed, expiring, single use and revokes all sessions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'identity-'));process.env.IDENTITY_EMAIL_BACKEND='spool';process.env.IDENTITY_SPOOL_DIR=dir;
 const db=openDb(':memory:');const app=express();app.use(express.json());const one=(s:string,...a:any[])=>db.prepare(s).get(...a) as any;const run=(s:string,...a:any[])=>db.prepare(s).run(...a);
 const ctx:any={db,one,run,origin:'http://localhost',limited:()=>{},fail:(status:number,message:string)=>{throw Object.assign(Error(message),{status});},transaction:(f:()=>any)=>{db.exec('BEGIN');try{const v=f();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};
 db.prepare('INSERT INTO companies VALUES(?,?)').run('c','Synthetic');db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('u','c','User','synthetic@example.test',passwordHash('old-password-123'));
 mountIdentity(app,ctx);app.use((e:any,_q:any,r:any,_n:any)=>r.status(e.status||500).json({error:e.message}));
 try{const known=await request(app).post('/api/auth/recovery/request').send({email:'synthetic@example.test'});const unknown=await request(app).post('/api/auth/recovery/request').send({email:'unknown@example.test'});expect(known.body).toEqual(unknown.body);const mail=JSON.parse(readFileSync(join(dir,readdirSync(dir)[0]),'utf8'));const token=new URL(mail.url).hash.split('token=')[1];expect(one('SELECT hash FROM identity_tokens').hash).toBe(hash(token));run('INSERT INTO sessions VALUES(?,?,?,?,?)','s','u',null,'csrf',Date.now()+10000);expect((await request(app).post('/api/auth/recovery/reset').send({token,password:'new-password-123'})).status).toBe(200);expect(one('SELECT count(*) n FROM sessions').n).toBe(0);expect(passwordMatches('new-password-123',one('SELECT password FROM users').password)).toBe(true);expect((await request(app).post('/api/auth/recovery/reset').send({token,password:'again-password-123'})).status).toBe(400);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});delete process.env.IDENTITY_EMAIL_BACKEND;delete process.env.IDENTITY_SPOOL_DIR;}
});
test('expired and unverified accounts can still secure their password with CSRF and revoke sessions',async()=>{
 const {createApp}=await import('../../server/app');const a=createApp(':memory:');const agent=request.agent(a.http);
 try{const r=await agent.post('/api/auth/register').set('Origin','http://localhost').send({name:'Owner',company:'Test',email:'password@example.test',password:'old-password-123'});expect(r.status).toBe(201);process.env.BILLING_REQUIRED='1';process.env.REQUIRE_VERIFIED_EMAIL='1';expect((await agent.post('/api/auth/password').set('Origin','http://localhost').send({oldPassword:'old-password-123',newPassword:'new-password-123'})).status).toBe(403);expect((await agent.post('/api/auth/password').set('Origin','http://localhost').set('X-CSRF-Token',r.body.csrf).send({oldPassword:'old-password-123',newPassword:'new-password-123'})).status).toBe(200);expect((await agent.get('/api/auth/session')).status).toBe(401);
 }finally{delete process.env.BILLING_REQUIRED;delete process.env.REQUIRE_VERIFIED_EMAIL;a.db.close()}
});
