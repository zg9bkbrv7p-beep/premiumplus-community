import {test,expect} from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import {createApp} from '../../server/app';
const region=[{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}];
async function setup(provider?:any){
 const app=createApp(':memory:','http://localhost',{remodelProvider:provider});const user=request.agent(app.http);
 const r=await user.post('/api/auth/register').set('Origin','http://localhost').send({name:'Photo QA',company:'GQ Test Renovations',email:'workflow@example.test',password:'fictional-password-2026'});
 const send=(path:string,body:any,method:'post'|'put'='post')=>user[method](path).set('Origin','http://localhost').set('X-CSRF-Token',r.body.csrf).send(body);
 const project=(await send('/api/projects',{name:'Fictional photo project',address:'Test site'})).body;
 const bytes=await sharp({create:{width:300,height:200,channels:3,background:'#355444'}}).png().toBuffer();
 const photo=(await send(`/api/projects/${project.id}/remodel/photos`,{name:'source.png',base64:bytes.toString('base64')})).body;
 return {...app,user,send,project,photo,base:`/api/projects/${project.id}/remodel`};
}
test('a saved photo reopens its private change description while generation stays disabled',async()=>{
 const f=await setup();try{
  const brief='Replace the marked fence with six-foot cedar boards and a warm brown finish.';
  const saved=await f.send(`${f.base}/photos/${f.photo.id}/mark`,{region,material:'wood',brief},'put');
  expect(saved.status).toBe(200);expect(saved.body.brief).toBe(brief);
  expect((await f.user.get(f.base)).body.photos[0].brief).toBe(brief);
  expect((await f.user.get('/api/projects')).body[0].previewPhoto.imageUrl).toBe(f.photo.imageUrl);
  const result=await f.send(f.base+'/concepts',{photoId:f.photo.id,region,material:'wood',brief,consent:true,requestKey:'private-workflow-0001'});
  expect(result.status).toBe(503);expect(f.db.prepare('SELECT count(*) n FROM remodel_concepts').get()).toEqual({n:0});
  expect((await f.send(`${f.base}/photos/${f.photo.id}/mark`,{region,material:'wood',brief:'x'.repeat(2001)},'put')).status).toBe(422);
  const {defaultProposal}=await import('../proposal-fixture');
  const proposal=(await f.send(`/api/projects/${f.project.id}/proposals`,defaultProposal('Homeowner view'))).body;
  const share=(await f.send(`/api/projects/${f.project.id}/shares`,{proposalId:proposal.id})).body;
  const homeowner=request.agent(f.http);await homeowner.post('/api/client/exchange').set('Origin','http://localhost').send({token:share.token});
  const view=await homeowner.get('/api/client/project');expect(view.status).toBe(200);
  expect(view.body.project.previewPhoto).toBeNull();
  expect((await homeowner.get(f.photo.imageUrl)).status).toBe(401);

 }finally{f.db.close();}
});
test('explicit generation retains the requested changes and produces a private branded homeowner PDF',async()=>{
 let received='';const provider={name:'test-only',model:'synthetic-test',edit:async(input:any)=>{received=input.brief;return{image:await sharp({create:{width:1024,height:1024,channels:3,background:'#805b3f'}}).png().toBuffer()};}};
 const f=await setup(provider);try{
  const brief='Replace the marked fence with cedar, keeping the gate and the existing house unchanged.';
  await f.send('/api/company',{name:'GQ Test Renovations',address:'Fictional business address',phone:'Test contact'},'put');
  const r=await f.send(f.base+'/concepts',{photoId:f.photo.id,region,material:'wood',brief,consent:true,requestKey:'pdf-workflow-0000001'});expect(r.status).toBe(202);
  let concept:any;for(let i=0;i<150;i++){concept=(await f.user.get(f.base)).body.concepts.find((c:any)=>c.id===r.body.id);if(concept.status==='ready'||concept.status==='failed')break;await new Promise(resolve=>setTimeout(resolve,10));}
  expect(concept.status).toBe('ready');expect(received).toBe(brief);expect(concept.brief).toBe(brief);
  const pdf=await f.user.get(`${f.base}/concepts/${concept.id}/pdf`);
  expect(pdf.status).toBe(200);expect(pdf.headers['content-type']).toContain('application/pdf');expect(pdf.headers['cache-control']).toContain('no-store');expect(pdf.headers['content-disposition']).toContain('attachment');expect(pdf.body.subarray(0,5).toString()).toBe('%PDF-');
  const outsider=request.agent(f.http);await outsider.post('/api/auth/register').set('Origin','http://localhost').send({name:'Other',company:'Other',email:'other-workflow@example.test',password:'fictional-password-2026'});
  expect((await outsider.get(`${f.base}/concepts/${concept.id}/pdf`)).status).toBe(404);
  expect((await f.user.get(`${f.base}/concepts/missing/pdf`)).status).toBe(404);
 }finally{f.db.close();}
});
