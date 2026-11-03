import {test,expect} from '@playwright/test';

test.use({hasTouch:true,viewport:{width:390,height:844}});
async function project(page:any,baseURL:string){
 const reg=await page.request.post('/api/auth/register',{headers:{Origin:baseURL},data:{name:'Motion QA',company:'Motion QA',email:`edge-${Date.now()}@example.test`,password:'fictional-password-2026'}});
 expect(reg.status()).toBe(201);const{csrf}=await reg.json();
 const p=await(await page.request.post('/api/projects',{headers:{Origin:baseURL,'X-CSRF-Token':csrf},data:{name:'Card finish review',address:'Local visual test — no customer data'}})).json();
 await page.goto('/');await page.locator('.contractor-project-row').filter({hasText:p.name}).click();
 await expect(page.getByRole('heading',{name:'Project Details',exact:true})).toBeVisible();
}
async function orientation(page:any,gamma:number){await page.evaluate((g:number)=>{const e=new Event('deviceorientation');Object.defineProperties(e,{gamma:{value:g},beta:{value:30}});window.dispatchEvent(e);},gamma);}
const finish=(page:any)=>page.locator('.project-details-panel').evaluate((e:Element)=>getComputedStyle(e,'::after').backgroundImage);

// Catches accidental sensor subscription before consent and lost sensor-to-border updates.
test('tilt shine is opt-in, changes only the border and stops when disabled',async({page,baseURL})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class{static requestPermission(){return Promise.resolve('granted');}}});});
 await project(page,baseURL!);const card=page.locator('.project-details-panel');const box=await card.evaluate(e=>({top:(e as HTMLElement).offsetTop,width:e.clientWidth,height:e.clientHeight}));const initial=await finish(page);
 await orientation(page,25);expect(await finish(page)).toBe(initial);
 await page.locator('.project-advanced summary').click();await page.getByRole('button',{name:'Enable tilt shine',exact:true}).click();
 await expect(page.getByRole('button',{name:'Disable tilt shine',exact:true})).toBeVisible();
 await orientation(page,0);await orientation(page,20);await expect.poll(()=>finish(page)).not.toBe(initial);
 expect(await card.evaluate(e=>({top:(e as HTMLElement).offsetTop,width:e.clientWidth,height:e.clientHeight}))).toEqual(box);expect(await card.evaluate(e=>getComputedStyle(e).transform)).toBe('none');
 if(process.env.CARD_SHINE_CAPTURE){
  await card.scrollIntoViewIfNeeded();
  for(let i=0;i<18;i++){
   await orientation(page,-25+i*50/17);
   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
   await card.screenshot({path:`../evidence/edge-${String(i).padStart(2,'0')}.png`});
  }
 }
 await page.getByRole('button',{name:'Disable tilt shine',exact:true}).click();const stopped=await finish(page);await orientation(page,-20);expect(await finish(page)).toBe(stopped);
 await page.locator('.project-advanced summary').click();await page.screenshot({path:'../evidence/card-edge-iphone.png',fullPage:true});
 await page.getByRole('button',{name:'Open Proposal',exact:true}).click();await expect(page.getByRole('button',{name:'Create proposal',exact:true})).toBeVisible();
});

// Catches denied permission accidentally enabling sensors or blocking normal touch interaction.
test('permission denial keeps touch shine and normal scrolling available',async({page,baseURL})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:class{static requestPermission(){return Promise.resolve('denied');}}});});
 await project(page,baseURL!);await page.locator('.project-advanced summary').click();await page.getByRole('button',{name:'Enable tilt shine',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'Tilt access was not enabled'})).toBeVisible();const before=await finish(page);
 await page.locator('.project-details-panel').dispatchEvent('pointermove',{clientX:100,clientY:250,pointerType:'touch'});await expect.poll(()=>finish(page)).not.toBe(before);
 expect(await page.locator('.project-overview').evaluate(e=>getComputedStyle(e).touchAction)).toBe('auto');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

// Catches ignoring the OS accessibility preference, including changes while the page is open.
test('Reduce Motion keeps the finish still and disables tilt controls',async({page,baseURL})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await project(page,baseURL!);const before=await finish(page);
 await page.locator('.project-details-panel').dispatchEvent('pointermove',{clientX:90,clientY:230});await orientation(page,25);expect(await finish(page)).toBe(before);
 await page.locator('.project-advanced summary').click();await expect(page.getByRole('button',{name:'Enable tilt shine',exact:true})).toHaveCount(0);
 await expect(page.getByText('Card shine stays still with Reduce Motion.',{exact:true})).toBeVisible();
});
