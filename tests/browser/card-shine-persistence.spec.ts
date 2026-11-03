import{test,expect}from'@playwright/test';
test.use({hasTouch:true,viewport:{width:390,height:844}});
async function openProject(page:any,baseURL:string){
 const reg=await page.request.post('/api/auth/register',{headers:{Origin:baseURL},data:{name:'Persistence QA',company:'Persistence QA',email:`shine-persist-${Date.now()}@example.test`,password:'fictional-password-2026'}});expect(reg.status()).toBe(201);const{csrf}=await reg.json();
 const response=await page.request.post('/api/projects',{headers:{Origin:baseURL,'X-CSRF-Token':csrf},data:{name:'Persistent shine QA'}});expect(response.status()).toBe(201);
 await page.goto('/');await page.locator('.contractor-project-row').filter({hasText:'Persistent shine QA'}).click();
}
async function controls(page:any){await page.locator('.project-advanced').evaluate((e:HTMLDetailsElement)=>{e.open=true;});}
async function moves(page:any){
 const gradient=()=>page.locator('.project-details-panel').evaluate((e:Element)=>getComputedStyle(e,'::after').backgroundImage);
 const orient=async(gamma:number)=>{await page.evaluate((g:number)=>{const e=new Event('deviceorientation');Object.defineProperties(e,{gamma:{value:g},beta:{value:30}});window.dispatchEvent(e);},gamma);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>r())));};
 await orient(0);const before=await gradient();await orient(20);await expect.poll(gradient).not.toBe(before);
}
// Reproduces the real bug: Overview unmounts when a project tab opens.
test('enabled shine survives project navigation, reload and temporary Reduce Motion; explicit off persists',async({page,baseURL})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class{static requestPermission(){return Promise.resolve('granted');}}}));
 await openProject(page,baseURL!);await controls(page);await page.getByRole('button',{name:'Enable tilt shine',exact:true}).click();await moves(page);
 const tabs=page.getByRole('navigation',{name:'Project navigation'});
 for(const tab of ['Photo Preview','Proposal','Live Project','Documents']){
  await tabs.getByRole('button',{name:tab,exact:true}).click();await tabs.getByRole('button',{name:'Overview',exact:true}).click();await controls(page);
  await expect(page.getByRole('button',{name:'Disable tilt shine',exact:true})).toBeVisible({timeout:3000});await moves(page);
 }
 await page.reload();await controls(page);await expect(page.getByRole('button',{name:'Disable tilt shine',exact:true})).toBeVisible();await moves(page);
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.getByText('Card shine stays still with Reduce Motion.',{exact:true})).toBeVisible();await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.getByRole('button',{name:'Disable tilt shine',exact:true})).toBeVisible();await moves(page);
 await page.getByRole('button',{name:'Disable tilt shine',exact:true}).click();await page.reload();await controls(page);await expect(page.getByRole('button',{name:'Enable tilt shine',exact:true})).toBeVisible();
});
// A saved cosmetic preference must never be treated as a browser permission grant.
test('revoked browser motion permission leaves a recoverable touch fallback',async({page,baseURL})=>{
 await page.addInitScript(()=>Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class{static requestPermission(){return sessionStorage.getItem('qa-revoked')?Promise.reject(new DOMException('Requires a gesture','NotAllowedError')):Promise.resolve('granted');}}}));
 await openProject(page,baseURL!);await controls(page);await page.getByRole('button',{name:'Enable tilt shine',exact:true}).click();await page.evaluate(()=>sessionStorage.setItem('qa-revoked','true'));await page.reload();await controls(page);
 await expect(page.getByRole('button',{name:'Enable tilt shine',exact:true})).toBeVisible();await expect(page.getByRole('status').filter({hasText:'Tap Enable tilt shine to resume'})).toBeVisible();
 const gradient=()=>page.locator('.project-details-panel').evaluate((e:Element)=>getComputedStyle(e,'::after').backgroundImage);const before=await gradient();await page.locator('.project-details-panel').dispatchEvent('pointermove',{clientX:100,clientY:260,pointerType:'touch'});await expect.poll(gradient).not.toBe(before);
});
