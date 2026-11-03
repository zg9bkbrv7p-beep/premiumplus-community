import type {Express,Request} from 'express';
import type {AppContext} from './context';
import {randomUUID} from 'node:crypto';
import {mkdirSync,chmodSync,writeFileSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {z} from 'zod';
import {hash,token,passwordHash,passwordMatches} from './auth';
const email=z.string().trim().toLowerCase().email().max(254);
const password=z.string().min(12).max(256);
const generic={ok:true,message:'If this address is eligible, an email will be sent.'};
function init(c:AppContext){c.db.exec(`CREATE TABLE IF NOT EXISTS identity_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),verified_at INTEGER);
CREATE TABLE IF NOT EXISTS identity_tokens(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS identity_outbox(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS security_audit(id TEXT PRIMARY KEY,user_id TEXT,action TEXT NOT NULL,created_at INTEGER NOT NULL);`);}
function audit(c:AppContext,uid:string,action:string){c.run('INSERT INTO security_audit VALUES(?,?,?,?)',randomUUID(),uid,action,Date.now());}
export function commercialIdentityReady(){const from=process.env.IDENTITY_EMAIL_FROM||'';return process.env.IDENTITY_EMAIL_BACKEND==='resend'&&!!process.env.RESEND_API_KEY&&!!process.env.IDENTITY_ALLOWED_FROM_DOMAIN&&from.split('@')[1]===process.env.IDENTITY_ALLOWED_FROM_DOMAIN;}
async function issue(c:AppContext,uid:string,kind:'recovery'|'verification'){
 const user=c.one('SELECT email FROM users WHERE id=?',uid);if(!user)return;
 const backend=process.env.IDENTITY_EMAIL_BACKEND||'disabled';if(backend==='disabled')return;
 if(backend==='spool'&&(process.env.NODE_ENV==='production'||!isAbsolute(process.env.IDENTITY_SPOOL_DIR||'')))return;
 if(backend!=='spool'&&!commercialIdentityReady())return;
 const raw=token(),id=randomUUID(),url=`${c.origin}/#${kind==='recovery'?'reset':'verify'}&token=${raw}`;
 c.transaction(()=>{c.run('DELETE FROM identity_tokens WHERE user_id=? AND kind=?',uid,kind);c.run('INSERT INTO identity_tokens VALUES(?,?,?,?)',hash(raw),uid,kind,Date.now()+(kind==='recovery'?30*60000:24*3600000));c.run('INSERT INTO identity_outbox VALUES(?,?,?,?,?)',id,uid,kind,'pending',Date.now());});
 try {if(backend==='spool'){const dir=process.env.IDENTITY_SPOOL_DIR!;mkdirSync(dir,{recursive:true,mode:0o700});chmodSync(dir,0o700);writeFileSync(join(dir,id+'.json'),JSON.stringify({to:user.email,kind,url}),{mode:0o600,flag:'wx'});}else{const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.IDENTITY_EMAIL_FROM,to:[user.email],subject:kind==='recovery'?'Reset your password':'Verify your email',text:`Open this link to ${kind==='recovery'?'reset your password':'verify your email'}: ${url}`}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Email delivery failed');}
 c.run("UPDATE identity_outbox SET state='sent' WHERE id=?",id);audit(c,uid,kind+'_sent');}catch{c.run("UPDATE identity_outbox SET state='failed' WHERE id=?",id);c.run('DELETE FROM identity_tokens WHERE hash=?',hash(raw));audit(c,uid,kind+'_delivery_failed');}
}
export async function notifyRegistration(c:AppContext,uid:string){init(c);await issue(c,uid,'verification');}
export function accountIdentity(c:AppContext,uid:string){init(c);return {emailVerified:!!c.one('SELECT verified_at FROM identity_accounts WHERE user_id=?',uid)?.verified_at};}
export function mountIdentity(app:Express,c:AppContext){init(c);
 const limit=(req:Request,kind:string,value:string)=>{c.limited(`identity:${kind}:ip:${req.ip}`,20);c.limited(`identity:${kind}:subject:${hash(value)}`,5);};
 for(const kind of ['recovery','verification'] as const)app.post(`/api/auth/${kind}/request`,async(req,res)=>{const address=email.parse(req.body.email);limit(req,kind,address);const user=c.one('SELECT id FROM users WHERE email=?',address);if(user&&(kind==='recovery'||!accountIdentity(c,user.id).emailVerified))await issue(c,user.id,kind);res.json(generic);});
 const consume=(raw:string,kind:string)=>{const row=c.one('SELECT * FROM identity_tokens WHERE hash=? AND kind=? AND expires>?',hash(raw),kind,Date.now());if(!row)c.fail(400,'This link is invalid or expired. Request a new link.');c.run('DELETE FROM identity_tokens WHERE hash=?',hash(raw));return row;};
 app.post('/api/auth/recovery/reset',(req,res)=>{const input=z.object({token:z.string().regex(/^[a-f0-9]{64}$/),password}).parse(req.body);limit(req,'reset',input.token);const encoded=passwordHash(input.password);c.transaction(()=>{const row=consume(input.token,'recovery');c.run('UPDATE users SET password=? WHERE id=?',encoded,row.user_id);c.run('DELETE FROM sessions WHERE user_id=?',row.user_id);c.run('DELETE FROM identity_tokens WHERE user_id=?',row.user_id);audit(c,row.user_id,'password_reset');});res.json({ok:true});});
 app.post('/api/auth/verification/confirm',(req,res)=>{const raw=z.string().regex(/^[a-f0-9]{64}$/).parse(req.body.token);limit(req,'confirm',raw);c.transaction(()=>{const row=consume(raw,'verification');c.run('INSERT INTO identity_accounts VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET verified_at=excluded.verified_at',row.user_id,Date.now());audit(c,row.user_id,'email_verified');});res.json({ok:true});});
 app.post('/api/auth/password',(req,res)=>{const u=c.owner(req,false);c.csrf(req,c.session(req));limit(req,'password',u.id);const input=z.object({oldPassword:z.string().max(256),newPassword:password}).parse(req.body);if(!passwordMatches(input.oldPassword,c.one('SELECT password FROM users WHERE id=?',u.id).password))c.fail(400,'Current password is incorrect');const encoded=passwordHash(input.newPassword);c.transaction(()=>{c.run('UPDATE users SET password=? WHERE id=?',encoded,u.id);c.run('DELETE FROM sessions WHERE user_id=?',u.id);c.run('DELETE FROM identity_tokens WHERE user_id=?',u.id);audit(c,u.id,'password_changed');});res.clearCookie('vision_session',{path:'/'}).json({ok:true});});
}
